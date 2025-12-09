import supabaseAdmin from '../../lib/supabaseAdmin';
import { User } from '../../lib/chat/types';

const mapProfile = (raw: any, role: User['role']): User => ({
  id: raw.adminID || raw.delegateID || raw.chairID || raw.secretariatID || raw.id,
  email: raw.email || '',
  username: raw.username || raw.email || undefined,
  full_name: [raw.firstname, raw.lastname, raw.full_name, raw.name].filter(Boolean).join(' ') || 'Unknown',
  avatar_url: raw.avatar_url || null,
  role_title: role?.charAt(0).toUpperCase() + role?.slice(1),
  committee: raw.committee?.name || raw.committeeCode || raw.committeeID || raw.committee || null,
  country: raw.country?.name || raw.country || null,
  role,
});

type TableConfig = {
  table: string;
  role: User['role'];
  select: string;
};

const TABLES: TableConfig[] = [
  { table: 'Admin', role: 'admin', select: 'adminID, firstname, lastname, email, username' },
  {
    table: 'Chair',
    role: 'chair',
    select: 'chairID, firstname, lastname, email, username, committeeID, committee:Committee(*)',
  },
  {
    table: 'Delegate',
    role: 'delegate',
    select: 'delegateID, firstname, lastname, email, username, committeeID, country, committee:Committee(*), country:Country(*)',
  },
  { table: 'Secretariat', role: 'secretariat', select: 'secretariatID, firstname, lastname, email, username' },
];

const applyNameFilter = (rows: any[], query: string) => {
  const lowered = query.toLowerCase();
  return rows.filter((row) => {
    const first = row.firstname?.toLowerCase() || '';
    const last = row.lastname?.toLowerCase() || '';
    const combined = `${row.firstname || ''} ${row.lastname || ''}`.toLowerCase();
    return first.includes(lowered) || last.includes(lowered) || combined.includes(lowered);
  });
};

export const searchPeople = async (query: string): Promise<User[]> => {
  if (!supabaseAdmin) {
    console.error('[people search] Supabase admin client is not configured.');
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const isEmailQuery = trimmed.includes('@');
  const pattern = `%${trimmed}%`;

  console.log('[people search] incoming query', { query: trimmed, isEmail: isEmailQuery });

  const results: User[] = [];

  for (const config of TABLES) {
    let builder = supabaseAdmin.from(config.table).select(config.select).limit(20);

    if (isEmailQuery) {
      builder = builder.ilike('email', pattern);
    } else {
      builder = builder.or(`firstname.ilike.${pattern},lastname.ilike.${pattern}`);
    }

    const { data, error } = await builder;

    if (error) {
      console.error(`[people search] ${config.table} error`, error);
      continue;
    }

    const rows = data || [];
    const filteredRows = isEmailQuery ? rows : applyNameFilter(rows, trimmed);

    console.log(`[people search] ${config.table} matches:`, filteredRows.length);

    filteredRows.forEach((row) => results.push(mapProfile(row, config.role)));
  }

  console.log('[people search] total returned', results.length);

  return results;
};

export const mapProfileForChat = mapProfile;
