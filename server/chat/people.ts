// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import supabaseAdmin from '../../lib/supabaseAdmin';
import { User } from '../../lib/chat/types';

type ChatPersonRole = 'admin' | 'chair' | 'delegate' | 'secretariat';

export type ChatPerson = {
  id: string;
  role: ChatPersonRole;
  displayName: string;
  email: string | null;
  committeeCode?: string | null;
  country?: string | null;
};

export type ChatPersonDetails = {
  id: string;
  role: ChatPersonRole;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  committeeCode?: string | null;
  country?: string | null;
};

export type ViewerContext = {
  id: string;
  role: ChatPersonRole;
  committeeCodes: string[];
  country?: string | null;
};

const formatDisplayName = (first?: string | null, last?: string | null) =>
  `${first || ''} ${last || ''}`.trim() || 'Unknown';

export const mapProfileForChat = (
  row: { adminID?: string; chairID?: string; delegateID?: string; secretariatID?: string; firstname?: string | null; lastname?: string | null; email?: string | null },
  role: ChatPersonRole,
  extras?: { committee?: string | null; country?: string | null }
): User => {
  const id = row.adminID || row.chairID || row.delegateID || row.secretariatID || '';
  return {
    id,
    email: row.email || '',
    full_name: formatDisplayName(row.firstname, row.lastname),
    role,
    role_title: role.charAt(0).toUpperCase() + role.slice(1),
    committee: extras?.committee || null,
    country: extras?.country || null,
  };
};

const countrySearchTokens = (country?: string | null) => {
  if (!country) return '';

  const normalizedCountry = country.toLowerCase();
  const aliases: string[] = [];

  if (
    normalizedCountry.includes('united kingdom') ||
    normalizedCountry.includes('united kindom') ||
    normalizedCountry.includes('uk')
  ) {
    aliases.push('uk', 'united kingdom', 'united kindom');
  }

  return `${country} ${aliases.join(' ')}`.trim();
};

const matchesQuery = (person: ChatPerson, normalizedQuery: string) => {
  const haystacks = [
    person.displayName,
    person.email || '',
    countrySearchTokens(person.country),
    person.committeeCode || '',
  ]
    .join(' ')
    .toLowerCase();

  return haystacks.includes(normalizedQuery);
};

const mapCommitteeCodes = async (committeeIds: (string | null | undefined)[]) => {
  const ids = Array.from(new Set(committeeIds.filter(Boolean) as string[]));
  const committeeMap = new Map<string, string | null>();

  if (ids.length) {
    const { data: committees, error: committeeError } = await supabaseAdmin
      .from('Committee')
      .select('committeeID, committeeCode')
      .in('committeeID', ids);

    if (committeeError) {
      console.error('[people search] Committee lookup error', committeeError);
    }

    committees?.forEach((committee) => {
      committeeMap.set(committee.committeeID, committee.committeeCode || null);
    });
  }

  return committeeMap;
};


const getCommitteeCodeFromId = async (committeeId?: string | null) => {
  if (!committeeId) return null;
  const committeeMap = await mapCommitteeCodes([committeeId]);
  return committeeMap.get(committeeId) || null;
};

const fetchChairCommitteeMap = async (chairIds: string[]) => {
  if (chairIds.length === 0) return new Map<string, string | null>();

  const { data: chairLinks, error } = await supabaseAdmin
    .from('Committee-Chair')
    .select('chairID, committeeID')
    .in('chairID', chairIds);

  if (error) {
    console.error('[people search] Committee-Chair lookup error', error);
    return new Map();
  }

  const committeeIds = Array.from(new Set((chairLinks || []).map((link) => link.committeeID).filter(Boolean)));
  const committeeMap = await mapCommitteeCodes(committeeIds);

  const chairCommitteeMap = new Map<string, string | null>();
  (chairLinks || []).forEach((link) => {
    chairCommitteeMap.set(link.chairID, committeeMap.get(link.committeeID) || null);
  });

  return chairCommitteeMap;
};

export const fetchPeopleDetailsByIds = async (ids: string[]): Promise<Record<string, ChatPersonDetails>> => {
  if (!supabaseAdmin) return {};
  if (ids.length === 0) return {};

  const uniqueIds = Array.from(new Set(ids));

  const [admins, chairs, delegates, secretariat] = await Promise.all([
    supabaseAdmin.from('Admin').select('adminID, firstname, lastname, email').in('adminID', uniqueIds),
    supabaseAdmin.from('Chair').select('chairID, firstname, lastname, email').in('chairID', uniqueIds),
    supabaseAdmin
      .from('Delegate')
      .select('delegateID, firstname, lastname, email, country, committeeID')
      .in('delegateID', uniqueIds),
    supabaseAdmin.from('Secretariat').select('secretariatID, firstname, lastname, email').in('secretariatID', uniqueIds),
  ]);

  const chairCommitteeMap = await fetchChairCommitteeMap((chairs.data || []).map((row) => row.chairID));
  const delegateCommitteeMap = await mapCommitteeCodes((delegates.data || []).map((row) => row.committeeID));

  const map: Record<string, ChatPersonDetails> = {};

  (admins.data || []).forEach((row) => {
    map[row.adminID] = {
      id: row.adminID,
      role: 'admin',
      firstname: row.firstname || null,
      lastname: row.lastname || null,
      email: row.email || null,
    };
  });

  (chairs.data || []).forEach((row) => {
    map[row.chairID] = {
      id: row.chairID,
      role: 'chair',
      firstname: row.firstname || null,
      lastname: row.lastname || null,
      email: row.email || null,
      committeeCode: chairCommitteeMap.get(row.chairID) || null,
    };
  });

  (delegates.data || []).forEach((row) => {
    map[row.delegateID] = {
      id: row.delegateID,
      role: 'delegate',
      firstname: row.firstname || null,
      lastname: row.lastname || null,
      email: row.email || null,
      country: row.country || null,
      committeeCode: row.committeeID ? delegateCommitteeMap.get(row.committeeID) || null : null,
    };
  });

  (secretariat.data || []).forEach((row) => {
    map[row.secretariatID] = {
      id: row.secretariatID,
      role: 'secretariat',
      firstname: row.firstname || null,
      lastname: row.lastname || null,
      email: row.email || null,
    };
  });

  return map;
};

export const getUserContext = async (userId: string): Promise<ViewerContext | null> => {
  if (!supabaseAdmin) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appUser } = await (supabaseAdmin as any)
    .from('app_users')
    .select('id, role, country, committee_id')
    .eq('id', userId)
    .maybeSingle();

  if (appUser) {
    const committeeCode = await getCommitteeCodeFromId(appUser.committee_id);
    return {
      id: appUser.id,
      role: appUser.role,
      committeeCodes: committeeCode ? [committeeCode] : [],
      country: appUser.country || null,
    };
  }

  const { data: delegate } = await supabaseAdmin
    .from('Delegate')
    .select('delegateID, country, committeeID')
    .eq('delegateID', userId)
    .maybeSingle();

  if (delegate) {
    const committeeMap = await mapCommitteeCodes([delegate.committeeID]);
    const committeeCode = delegate.committeeID ? committeeMap.get(delegate.committeeID) || null : null;
    return {
      id: delegate.delegateID,
      role: 'delegate',
      committeeCodes: committeeCode ? [committeeCode] : [],
      country: delegate.country || null,
    };
  }

  const { data: chair } = await supabaseAdmin
    .from('Chair')
    .select('chairID')
    .eq('chairID', userId)
    .maybeSingle();

  if (chair) {
    const committeeMap = await fetchChairCommitteeMap([chair.chairID]);
    const committeeCode = committeeMap.get(chair.chairID) || null;
    return {
      id: chair.chairID,
      role: 'chair',
      committeeCodes: committeeCode ? [committeeCode] : [],
    };
  }

  const { data: admin } = await supabaseAdmin
    .from('Admin')
    .select('adminID')
    .eq('adminID', userId)
    .maybeSingle();

  if (admin) {
    return { id: admin.adminID, role: 'admin', committeeCodes: [] };
  }

  const { data: secretariat } = await supabaseAdmin
    .from('Secretariat')
    .select('secretariatID')
    .eq('secretariatID', userId)
    .maybeSingle();

  if (secretariat) {
    return { id: secretariat.secretariatID, role: 'secretariat', committeeCodes: [] };
  }

  return null;
};

export const isVisibleToViewer = (viewer: ViewerContext | null, person: ChatPerson | null) => {
  if (!viewer) return false;
  if (!person) return false;
  if (viewer.id === person.id) return false;

  return true;
};

export const fetchPersonById = async (userId: string): Promise<ChatPerson | null> => {
  if (!supabaseAdmin) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appUser } = await (supabaseAdmin as any)
    .from('app_users')
    .select('id, role, email, first_name, last_name, country, committee_id')
    .eq('id', userId)
    .maybeSingle();

  if (appUser) {
    const committeeCode = await getCommitteeCodeFromId(appUser.committee_id);
    return {
      id: appUser.id,
      role: appUser.role,
      displayName: formatDisplayName(appUser.first_name, appUser.last_name),
      email: appUser.email || null,
      country: appUser.country || null,
      committeeCode,
    };
  }

  const { data: admin } = await supabaseAdmin
    .from('Admin')
    .select('adminID, firstname, lastname, email')
    .eq('adminID', userId)
    .maybeSingle();
  if (admin) {
    return {
      id: admin.adminID,
      role: 'admin',
      displayName: formatDisplayName(admin.firstname, admin.lastname),
      email: admin.email || null,
    };
  }

  const { data: chair } = await supabaseAdmin
    .from('Chair')
    .select('chairID, firstname, lastname, email')
    .eq('chairID', userId)
    .maybeSingle();
  if (chair) {
    const chairCommitteeMap = await fetchChairCommitteeMap([chair.chairID]);
    return {
      id: chair.chairID,
      role: 'chair',
      displayName: formatDisplayName(chair.firstname, chair.lastname),
      email: chair.email || null,
      committeeCode: chairCommitteeMap.get(chair.chairID) || null,
    };
  }

  const { data: delegate } = await supabaseAdmin
    .from('Delegate')
    .select('delegateID, firstname, lastname, email, country, committeeID')
    .eq('delegateID', userId)
    .maybeSingle();
  if (delegate) {
    const committeeMap = await mapCommitteeCodes([delegate.committeeID]);
    return {
      id: delegate.delegateID,
      role: 'delegate',
      displayName: formatDisplayName(delegate.firstname, delegate.lastname),
      email: delegate.email || null,
      country: delegate.country || null,
      committeeCode: delegate.committeeID ? committeeMap.get(delegate.committeeID) || null : null,
    };
  }

  const { data: sec } = await supabaseAdmin
    .from('Secretariat')
    .select('secretariatID, firstname, lastname, email')
    .eq('secretariatID', userId)
    .maybeSingle();
  if (sec) {
    return {
      id: sec.secretariatID,
      role: 'secretariat',
      displayName: formatDisplayName(sec.firstname, sec.lastname),
      email: sec.email || null,
    };
  }

  return null;
};

export const searchPeople = async (query: string, viewerId?: string): Promise<ChatPerson[]> => {
  const trimmed = query.trim();

  if (!supabaseAdmin) {
    console.error('[people search] Supabase admin client is not configured');
    return [];
  }

  if (trimmed.length < 2) return [];

  const normalizedQuery = trimmed.toLowerCase();
  const pattern = `%${trimmed}%`;

  const adminPromise = (async (): Promise<ChatPerson[]> => {
    const builder = supabaseAdmin
      .from('Admin')
      .select('adminID, firstname, lastname, email')
      .limit(20);

    const { data, error } = await builder.or(
      `email.ilike.${pattern},firstname.ilike.${pattern},lastname.ilike.${pattern}`
    );

    if (error) {
      console.error('[people search] Admin error', error);
      return [];
    }

    const rows = data || [];
    return rows
      .map((row) => ({
        id: row.adminID,
        role: 'admin',
        displayName: formatDisplayName(row.firstname, row.lastname),
        email: row.email || null,
      }))
      .filter((person) => matchesQuery(person, normalizedQuery));
  })();

  const chairPromise = (async (): Promise<ChatPerson[]> => {
    const builder = supabaseAdmin
      .from('Chair')
      .select('chairID, firstname, lastname, email')
      .limit(20);

    const { data, error } = await builder.or(
      `email.ilike.${pattern},firstname.ilike.${pattern},lastname.ilike.${pattern}`
    );

    if (error) {
      console.error('[people search] Chair error', error);
      return [];
    }

    const rows = data || [];
    const chairCommitteeMap = await fetchChairCommitteeMap(rows.map((row) => row.chairID));

    return rows
      .map((row) => ({
        id: row.chairID,
        role: 'chair',
        displayName: formatDisplayName(row.firstname, row.lastname),
        email: row.email || null,
        committeeCode: chairCommitteeMap.get(row.chairID) || null,
      }))
      .filter((person) => matchesQuery(person, normalizedQuery));
  })();

  const delegatePromise = (async (): Promise<ChatPerson[]> => {
    const builder = supabaseAdmin
      .from('Delegate')
      .select('delegateID, firstname, lastname, email, country, committeeID')
      .limit(20);

    const { data, error } = await builder.or(
      `email.ilike.${pattern},firstname.ilike.${pattern},lastname.ilike.${pattern},country.ilike.${pattern}`
    );

    if (error) {
      console.error('[people search] Delegate error', error);
      return [];
    }

    const rows = data || [];
    const committeeMap = await mapCommitteeCodes(rows.map((row) => row.committeeID));

    return rows
      .map((row) => ({
        id: row.delegateID,
        role: 'delegate',
        displayName: formatDisplayName(row.firstname, row.lastname),
        email: row.email || null,
        country: row.country || null,
        committeeCode: row.committeeID ? committeeMap.get(row.committeeID) || null : null,
      }))
      .filter((person) => matchesQuery(person, normalizedQuery));
  })();

  const secretariatPromise = (async (): Promise<ChatPerson[]> => {
    const builder = supabaseAdmin
      .from('Secretariat')
      .select('secretariatID, firstname, lastname, email')
      .limit(20);

    const { data, error } = await builder.or(
      `email.ilike.${pattern},firstname.ilike.${pattern},lastname.ilike.${pattern}`
    );

    if (error) {
      console.error('[people search] Secretariat error', error);
      return [];
    }

    const rows = data || [];
    return rows
      .map((row) => ({
        id: row.secretariatID,
        role: 'secretariat',
        displayName: formatDisplayName(row.firstname, row.lastname),
        email: row.email || null,
      }))
      .filter((person) => matchesQuery(person, normalizedQuery));
  })();

  const [admins, chairs, delegates, secretariat] = await Promise.all([
    adminPromise,
    chairPromise,
    delegatePromise,
    secretariatPromise,
  ]);

  const combined = [...admins, ...chairs, ...delegates, ...secretariat];

  if (!viewerId) {
    return combined;
  }

  const viewer = await getUserContext(viewerId);
  return combined.filter((person) => isVisibleToViewer(viewer, person));
};
