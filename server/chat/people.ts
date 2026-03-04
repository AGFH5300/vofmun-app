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
  row: {
    id?: string;
    adminID?: string;
    chairID?: string;
    delegateID?: string;
    secretariatID?: string;
    first_name?: string | null;
    last_name?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    email?: string | null;
  },
  role: ChatPersonRole,
  extras?: { committee?: string | null; country?: string | null }
): User => {
  const id = row.id || row.adminID || row.chairID || row.delegateID || row.secretariatID || '';
  const first = row.first_name ?? row.firstname ?? null;
  const last = row.last_name ?? row.lastname ?? null;
  return {
    id,
    email: row.email || '',
    full_name: formatDisplayName(first, last),
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

  const { data: appUsers, error } = await supabaseAdmin
    .from('app_users')
    .select('id, role, first_name, last_name, email, country, committee_id')
    .in('id', uniqueIds);

  if (error) {
    console.error('[people search] app_users lookup error', error);
    return {};
  }

  const committeeMap = await mapCommitteeCodes((appUsers || []).map((row) => row.committee_id));

  const map: Record<string, ChatPersonDetails> = {};
  (appUsers || []).forEach((row) => {
    map[row.id] = {
      id: row.id,
      role: row.role as ChatPersonRole,
      firstname: row.first_name || null,
      lastname: row.last_name || null,
      email: row.email || null,
      country: row.country || null,
      committeeCode: row.committee_id ? committeeMap.get(row.committee_id) || null : null,
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

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, role, email, first_name, last_name, country, committee_id')
    .or(`email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},country.ilike.${pattern}`)
    .limit(50);

  if (error) {
    console.error('[people search] app_users error', error);
    return [];
  }

  const committeeMap = await mapCommitteeCodes((data || []).map((row) => row.committee_id));

  const combined = (data || [])
    .map((row) => ({
      id: row.id,
      role: row.role as ChatPersonRole,
      displayName: formatDisplayName(row.first_name, row.last_name),
      email: row.email || null,
      country: row.country || null,
      committeeCode: row.committee_id ? committeeMap.get(row.committee_id) || null : null,
    }))
    .filter((person) => matchesQuery(person, normalizedQuery));

  if (!viewerId) {
    return combined;
  }

  const viewer = await getUserContext(viewerId);
  return combined.filter((person) => isVisibleToViewer(viewer, person));
};
