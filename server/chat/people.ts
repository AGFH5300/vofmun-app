import supabaseAdmin from '@/lib/supabaseAdmin';
import { User } from '@/lib/chat/types';

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

export const searchPeople = async (query: string): Promise<User[]> => {
  if (!supabaseAdmin) throw new Error('Supabase admin client is not configured.');

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const ilike = `%${trimmed}%`;
  const baseFilter = `firstname.ilike.${ilike},lastname.ilike.${ilike},email.ilike.${ilike}`;

  const normalizedQuery = trimmed.toLowerCase();
  const broadenSearch = {
    admin: normalizedQuery.includes('admin'),
    chair: normalizedQuery.includes('chair'),
    delegate: normalizedQuery.includes('delegate'),
    secretariat: normalizedQuery.includes('secretariat'),
  };

  const buildQuery = (table: string, select: string, broaden: boolean) => {
    const base = supabaseAdmin.from(table).select(select).limit(20);
    return broaden ? base : base.or(baseFilter);
  };

  console.log('[people search] incoming query', { query: trimmed, length: trimmed.length });

  const [{ data: admins }, { data: chairs }, { data: delegates }, { data: secs }] = await Promise.all([
    buildQuery('Admin', 'adminID, firstname, lastname, email, username', broadenSearch.admin),
    buildQuery('Chair', 'chairID, firstname, lastname, email, username, committeeID, committee:Committee(*)', broadenSearch.chair),
    buildQuery(
      'Delegate',
      'delegateID, firstname, lastname, email, username, committeeID, country, committee:Committee(*), country:Country(*)',
      broadenSearch.delegate
    ),
    buildQuery('Secretariat', 'secretariatID, firstname, lastname, email, username', broadenSearch.secretariat),
  ]);

  const results: User[] = [];
  (admins || []).forEach((row) => results.push(mapProfile(row, 'admin')));
  (chairs || []).forEach((row) => results.push(mapProfile(row, 'chair')));
  (delegates || []).forEach((row) => results.push(mapProfile(row, 'delegate')));
  (secs || []).forEach((row) => results.push(mapProfile(row, 'secretariat')));

  const matchesQuery = (profile: User) => {
    const haystack = [
      profile.full_name,
      profile.email,
      profile.role_title,
      profile.role,
      profile.committee,
      profile.country,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  };

  const filtered = results.filter((profile) => matchesQuery(profile));
  console.log('[people search] results', {
    admins: admins?.length || 0,
    chairs: chairs?.length || 0,
    delegates: delegates?.length || 0,
    secretariat: secs?.length || 0,
    returned: filtered.length,
  });

  const sampleDelegate = delegates?.[0];
  if (sampleDelegate) {
    console.log('[people search] sample delegate', {
      id: sampleDelegate.delegateID || sampleDelegate.id,
      email: sampleDelegate.email,
      name: [sampleDelegate.firstname, sampleDelegate.lastname].filter(Boolean).join(' '),
    });
  }

  return filtered;
};

export const mapProfileForChat = mapProfile;
