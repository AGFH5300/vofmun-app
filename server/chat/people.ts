import supabaseAdmin from '../../lib/supabaseAdmin';

type ChatPersonRole = 'admin' | 'chair' | 'delegate' | 'secretariat';

export type ChatPerson = {
  id: string;
  role: ChatPersonRole;
  displayName: string;
  email: string | null;
  committeeCode?: string | null;
  country?: string | null;
};

const formatDisplayName = (first?: string | null, last?: string | null) =>
  `${first || ''} ${last || ''}`.trim() || 'Unknown';

const logTableResult = (table: string, rows: unknown[]) => {
  console.log(`[people search] ${table} rows`, rows.length);
};

const matchesQuery = (person: ChatPerson, normalizedQuery: string) => {
  const haystacks = [
    person.displayName,
    person.email || '',
    person.country || '',
    person.committeeCode || '',
  ]
    .join(' ')
    .toLowerCase();

  return haystacks.includes(normalizedQuery);
};

export const searchPeople = async (query: string): Promise<ChatPerson[]> => {
  const trimmed = query.trim();
  console.log('[people search] incoming query', trimmed);

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
    logTableResult('Admin', rows);

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
    logTableResult('Chair', rows);

    return rows
      .map((row) => ({
        id: row.chairID,
        role: 'chair',
        displayName: formatDisplayName(row.firstname, row.lastname),
        email: row.email || null,
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
    logTableResult('Delegate', rows);

    const includesBob = rows.some((row) => (row.email || '').toLowerCase() === 'bob.smith@example.com');
    console.log('[people search] Delegate contains bob.smith@example.com:', includesBob);

    const committeeIds = rows.map((row) => row.committeeID).filter(Boolean);
    const committeeMap = new Map<string, string | null>();

    if (committeeIds.length) {
      const { data: committees, error: committeeError } = await supabaseAdmin
        .from('Committee')
        .select('committeeID, committeeCode')
        .in('committeeID', committeeIds);

      if (committeeError) {
        console.error('[people search] Committee lookup error', committeeError);
      }

      committees?.forEach((committee) => {
        committeeMap.set(committee.committeeID, committee.committeeCode || null);
      });
    }

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
    logTableResult('Secretariat', rows);

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
  console.log('[people search] total returned', combined.length);

  return combined;
};
