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
  first_name: string | null;
  last_name: string | null;
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
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  },
  role: ChatPersonRole,
  extras?: { committee?: string | null; country?: string | null }
): User => {
  const id = row.id || '';
  const first = row.first_name ?? null;
  const last = row.last_name ?? null;
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
  if (!supabaseAdmin) return new Map<string, string | null>();
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
      first_name: row.first_name || null,
      last_name: row.last_name || null,
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
