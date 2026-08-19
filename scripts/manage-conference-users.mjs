#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const EXPECTED_PROJECT_REF = 'gqymcyupsfemseybtmle';
const PRODUCTION_CONFIRMATION = 'VOFMUN-2026';
const CLEANUP_CONFIRMATION = 'DELETE-QA-USERS';
const REQUIRED_COLUMNS = ['email', 'first_name', 'last_name', 'role', 'committee_code', 'country', 'school', 'grade'];
const ROLES = new Set(['delegate', 'chair', 'admin', 'secretariat']);
const STAFF_ROLES = new Set(['admin', 'secretariat']);
const LEGACY_TABLES = {
  delegate: { table: 'Delegate', id: 'delegateID' },
  chair: { table: 'Chair', id: 'chairID' },
  admin: { table: 'Admin', id: 'adminID' },
  secretariat: { table: 'Secretariat', id: 'secretariatID' },
};
const DEFAULT_EMAILS_PER_HOUR = 25;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeText = (value) => String(value || '').trim();
const normalizeCommitteeCode = (value) => normalizeText(value).toUpperCase();
const chunk = (values, size = 50) => {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
};

export const projectRefFromUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = '.supabase.co';
    return hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) : null;
  } catch {
    return null;
  }
};

export const computeInviteDelayMs = (emailsPerHour) => {
  const numeric = Number(emailsPerHour);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10000) {
    throw new Error('--emails-per-hour must be an integer between 1 and 10000.');
  }
  return Math.ceil(3_600_000 / numeric);
};

const isValidEmail = (value) => {
  if (!value || value.length > 254 || value.includes(' ') || value.includes('\n') || value.includes('\r')) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
};

const parseCsvTable = (input) => {
  const text = String(input || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((entry) => entry.some((value) => normalizeText(value) !== ''));
  if (nonEmptyRows.length === 0) throw new Error('Roster CSV is empty.');
  const headers = nonEmptyRows[0].map((value) => normalizeText(value).toLowerCase());
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length > 0) throw new Error(`CSV contains duplicate column(s): ${[...new Set(duplicateHeaders)].join(', ')}`);
  const records = nonEmptyRows.slice(1).map((values, rowIndex) => {
    if (values.length > headers.length) throw new Error(`CSV row ${rowIndex + 2} contains too many columns.`);
    const record = { _row: rowIndex + 2 };
    headers.forEach((header, index) => {
      record[header] = normalizeText(values[index]);
    });
    return record;
  });
  return { headers, records };
};

export const parseCsv = (input) => {
  const { headers, records } = parseCsvTable(input);
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  const unknown = headers.filter((column) => !REQUIRED_COLUMNS.includes(column));
  if (missing.length > 0) throw new Error(`CSV is missing required column(s): ${missing.join(', ')}`);
  if (unknown.length > 0) throw new Error(`CSV contains unsupported column(s): ${unknown.join(', ')}`);
  return records;
};

export const parseCleanupCsv = (input) => {
  const { headers, records } = parseCsvTable(input);
  if (!headers.includes('email')) throw new Error('Cleanup CSV requires an email column.');
  const unknown = headers.filter((column) => !REQUIRED_COLUMNS.includes(column));
  if (unknown.length > 0) throw new Error(`Cleanup CSV contains unsupported column(s): ${unknown.join(', ')}`);
  const emails = new Map();
  return records.map((record) => {
    const email = normalizeEmail(record.email);
    if (!isValidEmail(email)) throw new Error(`Cleanup row ${record._row}: invalid email address.`);
    if (emails.has(email)) throw new Error(`Cleanup rows ${emails.get(email)} and ${record._row}: duplicate email ${email}.`);
    emails.set(email, record._row);
    return { row: record._row, email };
  });
};

export const validateRosterShape = (rawRows) => {
  if (!Array.isArray(rawRows) || rawRows.length === 0) throw new Error('Roster must contain at least one user.');
  const rows = [];
  const errors = [];
  const emailRows = new Map();
  const rosterSeats = new Map();

  for (const raw of rawRows) {
    const row = {
      row: raw._row,
      email: normalizeEmail(raw.email),
      firstName: normalizeText(raw.first_name),
      lastName: normalizeText(raw.last_name),
      role: normalizeText(raw.role).toLowerCase(),
      committeeCode: normalizeCommitteeCode(raw.committee_code),
      country: normalizeText(raw.country),
      school: normalizeText(raw.school),
      grade: normalizeText(raw.grade),
    };

    if (!isValidEmail(row.email)) errors.push(`Row ${row.row}: invalid email address.`);
    if (row.email.endsWith('@example.com')) errors.push(`Row ${row.row}: replace the example.com placeholder email.`);
    if (!row.firstName || !row.lastName) errors.push(`Row ${row.row}: first_name and last_name are required.`);
    if (!ROLES.has(row.role)) errors.push(`Row ${row.row}: role must be delegate, chair, admin, or secretariat.`);
    if (emailRows.has(row.email)) errors.push(`Rows ${emailRows.get(row.email)} and ${row.row}: duplicate email ${row.email}.`);
    else emailRows.set(row.email, row.row);

    if (row.role === 'delegate') {
      if (!row.committeeCode || !row.country || !row.school) {
        errors.push(`Row ${row.row}: delegates require committee_code, country, and school.`);
      }
      const seatKey = `${row.committeeCode}\u0000${row.country.toLowerCase()}`;
      if (rosterSeats.has(seatKey)) {
        errors.push(`Rows ${rosterSeats.get(seatKey)} and ${row.row}: duplicate delegate seat ${row.committeeCode}/${row.country}.`);
      } else {
        rosterSeats.set(seatKey, row.row);
      }
    } else if (row.role === 'chair') {
      if (!row.committeeCode) errors.push(`Row ${row.row}: chairs require committee_code.`);
      if (row.country || row.school || row.grade) errors.push(`Row ${row.row}: chair country, school, and grade must be blank.`);
    } else if (STAFF_ROLES.has(row.role)) {
      if (row.committeeCode || row.country || row.school || row.grade) {
        errors.push(`Row ${row.row}: admin/secretariat committee, country, school, and grade must be blank.`);
      }
    }
    rows.push(row);
  }

  if (errors.length > 0) throw new Error(`Roster validation failed:\n- ${errors.join('\n- ')}`);
  return rows;
};

const parseArguments = (argv) => {
  const [action = 'help', ...rest] = argv;
  const options = { action };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2).replaceAll('-', '_');
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
};

const loadEnvironment = async () => {
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
};

const createAdminClient = async () => {
  await loadEnvironment();
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) in .env.local.');
  if (!serviceRoleKey) throw new Error('Set the server-only SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  const projectRef = projectRefFromUrl(url);
  if (projectRef !== EXPECTED_PROJECT_REF) {
    throw new Error(`Refusing project ${projectRef || 'unknown'}; expected ${EXPECTED_PROJECT_REF}.`);
  }
  return {
    projectRef,
    supabase: createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }),
  };
};

const loadRoster = (rosterPath) => {
  if (!rosterPath || rosterPath === true) throw new Error('Provide --roster /absolute/or/relative/path.csv.');
  const absolutePath = path.resolve(process.cwd(), rosterPath);
  const contents = fs.readFileSync(absolutePath, 'utf8');
  return {
    absolutePath,
    hash: createHash('sha256').update(contents).digest('hex'),
    rows: validateRosterShape(parseCsv(contents)),
  };
};

const loadCleanupRoster = (rosterPath) => {
  if (!rosterPath || rosterPath === true) throw new Error('Provide --roster /absolute/or/relative/path.csv.');
  const absolutePath = path.resolve(process.cwd(), rosterPath);
  const contents = fs.readFileSync(absolutePath, 'utf8');
  const rows = parseCleanupCsv(contents);
  if (rows.length === 0) throw new Error('Cleanup roster must contain at least one email.');
  return {
    absolutePath,
    hash: createHash('sha256').update(contents).digest('hex'),
    rows,
  };
};

const assertWriteConfirmation = ({ options, projectRef, rosterCount, action }) => {
  if (!options.apply) throw new Error(`${action} is write-capable; add --apply after reviewing preflight output.`);
  if (options.confirm_project !== projectRef) throw new Error(`Add --confirm-project ${projectRef}.`);
  if (Number(options.confirm_count) !== rosterCount) throw new Error(`Add --confirm-count ${rosterCount}.`);
  if (!['qa', 'production'].includes(options.mode)) throw new Error('Add --mode qa or --mode production.');
  if (options.mode === 'production' && options.confirm_production !== PRODUCTION_CONFIRMATION) {
    throw new Error(`Production writes require --confirm-production ${PRODUCTION_CONFIRMATION}.`);
  }
};

export const validateRedirect = (redirectTo, mode) => {
  let url;
  try {
    url = new URL(redirectTo);
  } catch {
    throw new Error('Provide a valid HTTPS --redirect-to URL.');
  }
  if (url.protocol !== 'https:') throw new Error('Invitation redirect must use HTTPS.');
  if (!url.pathname.endsWith('/reset-password')) throw new Error('Invitation redirect must end with /reset-password.');
  if (mode === 'production' && url.hostname !== 'app.vofmun.org') {
    throw new Error('Production invitation redirects must use app.vofmun.org.');
  }
  return url.toString();
};

const fetchAllAuthUsers = async (supabase) => {
  const users = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Unable to list Auth users: ${error.message}`);
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) return users;
  }
};

const fetchByEmails = async (supabase, table, columns, emails) => {
  const rows = [];
  for (const emailBatch of chunk(emails)) {
    const { data, error } = await supabase.from(table).select(columns).in('email', emailBatch);
    if (error) throw new Error(`Unable to read ${table}: ${error.message}`);
    rows.push(...(data || []));
  }
  return rows;
};

const loadLiveDirectory = async (supabase, roster) => {
  const emails = roster.map((row) => row.email);
  const [authUsers, committeesResult, matrixResult, appUsersResult, ...legacyResults] = await Promise.all([
    fetchAllAuthUsers(supabase),
    supabase.from('Committee').select('committeeID, committeeCode, name, fullname'),
    supabase.from('committee_matrix_seats').select('committee_id, country_name, sort_order'),
    supabase.from('app_users').select('id, email, first_name, last_name, role, committee_id, country, school, grade, legacy_id'),
    ...Object.values(LEGACY_TABLES).map(({ table, id }) =>
      fetchByEmails(supabase, table, '*', emails).then((rows) => ({ table, id, rows })),
    ),
  ]);
  if (committeesResult.error) throw new Error(`Unable to read committees: ${committeesResult.error.message}`);
  if (matrixResult.error) throw new Error(`Unable to read committee matrices: ${matrixResult.error.message}`);
  if (appUsersResult.error) throw new Error(`Unable to read app_users: ${appUsersResult.error.message}`);
  return {
    authUsers,
    committees: committeesResult.data || [],
    matrixSeats: matrixResult.data || [],
    appUsers: appUsersResult.data || [],
    legacyRows: legacyResults,
  };
};

const sameNullable = (left, right) => (left || null) === (right || null);

export const buildPlan = (roster, live) => {
  const errors = [];
  const committeeByCode = new Map(live.committees.map((committee) => [normalizeCommitteeCode(committee.committeeCode), committee]));
  const matrixByCommittee = new Map();
  for (const seat of live.matrixSeats) {
    if (!matrixByCommittee.has(seat.committee_id)) matrixByCommittee.set(seat.committee_id, new Map());
    matrixByCommittee.get(seat.committee_id).set(seat.country_name.toLowerCase(), seat.country_name);
  }
  const authByEmail = new Map(live.authUsers.map((user) => [normalizeEmail(user.email), user]));
  const appByEmail = new Map(live.appUsers.map((user) => [normalizeEmail(user.email), user]));
  const occupiedSeats = new Map();
  for (const user of live.appUsers.filter((entry) => entry.role === 'delegate' && entry.committee_id && entry.country)) {
    occupiedSeats.set(`${user.committee_id}\u0000${user.country.toLowerCase()}`, normalizeEmail(user.email));
  }
  const legacyByEmail = new Map();
  for (const group of live.legacyRows) {
    for (const row of group.rows) {
      const email = normalizeEmail(row.email);
      if (!legacyByEmail.has(email)) legacyByEmail.set(email, []);
      legacyByEmail.get(email).push({ ...row, table: group.table, idColumn: group.id });
    }
  }

  const items = roster.map((row) => {
    const committee = row.committeeCode ? committeeByCode.get(row.committeeCode) : null;
    if (row.committeeCode && !committee) errors.push(`Row ${row.row}: unknown committee ${row.committeeCode}.`);
    let canonicalCountry = row.country || null;
    if (row.role === 'delegate' && committee) {
      canonicalCountry = matrixByCommittee.get(committee.committeeID)?.get(row.country.toLowerCase()) || null;
      if (!canonicalCountry) errors.push(`Row ${row.row}: ${row.country} is not in the ${row.committeeCode} matrix.`);
      const occupiedBy = canonicalCountry ? occupiedSeats.get(`${committee.committeeID}\u0000${canonicalCountry.toLowerCase()}`) : null;
      if (occupiedBy && occupiedBy !== row.email) {
        errors.push(`Row ${row.row}: ${row.committeeCode}/${canonicalCountry} is already assigned to ${occupiedBy}.`);
      }
    }

    const authUser = authByEmail.get(row.email) || null;
    const appUser = appByEmail.get(row.email) || null;
    const legacyCandidates = legacyByEmail.get(row.email) || [];
    const expectedLegacy = LEGACY_TABLES[row.role];
    const legacy = legacyCandidates.find((candidate) => candidate.table === expectedLegacy.table) || null;
    const wrongLegacy = legacyCandidates.filter((candidate) => candidate.table !== expectedLegacy.table);
    if (wrongLegacy.length > 0) errors.push(`Row ${row.row}: email already exists in a different legacy role table.`);
    if (authUser && appUser && authUser.id !== appUser.id) errors.push(`Row ${row.row}: Auth and app_users UUIDs do not match.`);
    if (!authUser && appUser) errors.push(`Row ${row.row}: app_users profile exists without an Auth user.`);
    if (appUser && appUser.role !== row.role) errors.push(`Row ${row.row}: existing app role ${appUser.role} conflicts with ${row.role}.`);
    if (legacy?.auth_user_id && authUser && legacy.auth_user_id !== authUser.id) {
      errors.push(`Row ${row.row}: legacy profile is linked to a different Auth UUID.`);
    }
    if (appUser && committee && appUser.committee_id !== committee.committeeID) {
      errors.push(`Row ${row.row}: existing committee assignment conflicts with ${row.committeeCode}.`);
    }
    if (appUser?.country && canonicalCountry && appUser.country.toLowerCase() !== canonicalCountry.toLowerCase()) {
      errors.push(`Row ${row.row}: existing delegate country conflicts with ${canonicalCountry}.`);
    }

    const complete = Boolean(
      authUser &&
      appUser &&
      legacy &&
      legacy.auth_user_id === authUser.id &&
      appUser.id === authUser.id &&
      appUser.role === row.role &&
      sameNullable(appUser.committee_id, committee?.committeeID || null) &&
      (row.role !== 'delegate' || (appUser.country || '').toLowerCase() === (canonicalCountry || '').toLowerCase()),
    );
    return {
      ...row,
      committeeId: committee?.committeeID || null,
      canonicalCountry,
      authUser,
      appUser,
      legacy,
      status: complete ? 'complete' : authUser ? 'repair' : 'create',
    };
  });

  const finalAdmins = new Set([
    ...live.appUsers.filter((user) => user.role === 'admin').map((user) => user.id),
    ...items.filter((item) => item.role === 'admin').map((item) => item.email),
  ]);
  if (finalAdmins.size === 0) errors.push('The final directory would contain no administrator. Include at least one admin in the roster.');
  if (errors.length > 0) throw new Error(`Live preflight failed:\n- ${errors.join('\n- ')}`);
  return items;
};

const roleResoPerms = (role) => ({
  'view:ownreso': role === 'delegate',
  'view:allreso': ['chair', 'admin', 'secretariat'].includes(role),
  'update:ownreso': role === 'delegate',
  'update:reso': [],
});

const legacyPayload = (item, authUserId) => {
  const legacy = LEGACY_TABLES[item.role];
  const legacyId = item.legacy?.[legacy.id] || authUserId;
  const base = {
    auth_user_id: authUserId,
    firstname: item.firstName,
    lastname: item.lastName,
    email: item.email,
  };
  if (item.role === 'delegate') {
    return {
      delegateID: legacyId,
      ...base,
      resoPerms: roleResoPerms(item.role),
      country: item.canonicalCountry,
      school: item.school,
      grade: item.grade || null,
      committeeID: item.committeeId,
    };
  }
  if (item.role === 'chair') return { chairID: legacyId, ...base, committeeID: item.committeeId };
  if (item.role === 'admin') return { adminID: legacyId, ...base };
  return { secretariatID: legacyId, ...base };
};

const appUserPayload = (item, authUserId) => ({
  id: authUserId,
  email: item.email,
  first_name: item.firstName,
  last_name: item.lastName,
  role: item.role,
  committee_id: ['delegate', 'chair'].includes(item.role) ? item.committeeId : null,
  country: item.role === 'delegate' ? item.canonicalCountry : null,
  school: item.role === 'delegate' ? item.school : null,
  grade: item.role === 'delegate' ? item.grade || null : null,
  reso_perms: roleResoPerms(item.role),
  updated_at: new Date().toISOString(),
});

const rollbackNewUser = async (supabase, item, authUserId) => {
  const legacy = LEGACY_TABLES[item.role];
  await supabase.from('app_users').delete().eq('id', authUserId);
  if (!item.legacy) await supabase.from(legacy.table).delete().eq(legacy.id, authUserId);
  await supabase.auth.admin.deleteUser(authUserId);
};

const provisionOne = async (supabase, item, redirectTo) => {
  if (item.status === 'complete') return { status: 'skipped_complete', auth_user_id: item.authUser.id };
  let authUserId = item.authUser?.id || null;
  let createdAuth = false;
  try {
    if (!authUserId) {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(item.email, { redirectTo });
      if (error || !data?.user?.id) throw new Error(error?.message || 'Invitation did not return an Auth user.');
      authUserId = data.user.id;
      createdAuth = true;
    }
    const legacy = LEGACY_TABLES[item.role];
    const legacyId = item.legacy?.[legacy.id] || authUserId;
    const { error: legacyError } = await supabase
      .from(legacy.table)
      .upsert(legacyPayload(item, authUserId), { onConflict: legacy.id });
    if (legacyError) throw new Error(`legacy profile: ${legacyError.message}`);
    const { error: appError } = await supabase.from('app_users').upsert(appUserPayload(item, authUserId), { onConflict: 'id' });
    if (appError) throw new Error(`app_users profile: ${appError.message}`);
    const [{ data: verifiedApp, error: verifyAppError }, { data: verifiedLegacy, error: verifyLegacyError }] = await Promise.all([
      supabase.from('app_users').select('id, role, committee_id, country').eq('id', authUserId).single(),
      supabase.from(legacy.table).select(`${legacy.id}, auth_user_id`).eq(legacy.id, legacyId).single(),
    ]);
    if (verifyAppError || verifyLegacyError || !verifiedApp || !verifiedLegacy) throw new Error('post-provision verification failed.');
    if (verifiedApp.role !== item.role || verifiedLegacy.auth_user_id !== authUserId) throw new Error('post-provision identity mismatch.');
    return { status: createdAuth ? 'invited' : 'repaired', auth_user_id: authUserId };
  } catch (error) {
    if (createdAuth && authUserId) await rollbackNewUser(supabase, item, authUserId).catch(() => undefined);
    throw error;
  }
};

const privateLogPath = (action, mode) => {
  const directory = path.resolve(process.cwd(), '.private', 'conference-user-logs');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  return path.join(directory, `${stamp}-${mode}-${action}.json`);
};

const writePrivateLog = (filePath, payload) => {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
};

const printPlan = (items) => {
  console.table(items.map((item) => ({
    email: item.email,
    role: item.role,
    committee: item.committeeCode || '-',
    country: item.canonicalCountry || '-',
    action: item.status,
  })));
  const summary = items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
  console.log('Plan summary:', summary);
  return summary;
};

const preflight = async (supabase, roster) => {
  const live = await loadLiveDirectory(supabase, roster.rows);
  const items = buildPlan(roster.rows, live);
  const summary = printPlan(items);
  return { items, live, summary };
};

const runProvision = async ({ supabase, projectRef, roster, options }) => {
  assertWriteConfirmation({ options, projectRef, rosterCount: roster.rows.length, action: 'provision' });
  const redirectTo = validateRedirect(options.redirect_to, options.mode);
  const emailsPerHour = Number(options.emails_per_hour || DEFAULT_EMAILS_PER_HOUR);
  const delayMs = computeInviteDelayMs(emailsPerHour);
  const { items, summary } = await preflight(supabase, roster);
  const logFile = privateLogPath('provision', options.mode);
  const log = {
    action: 'provision',
    mode: options.mode,
    projectRef,
    rosterPath: roster.absolutePath,
    rosterSha256: roster.hash,
    redirectTo,
    emailsPerHour,
    delayMs,
    startedAt: new Date().toISOString(),
    preflight: summary,
    results: [],
  };
  writePrivateLog(logFile, log);
  console.log(`Invitation pacing: ${emailsPerHour}/hour (${delayMs}ms between newly sent emails).`);
  const inviteItems = items.filter((item) => item.status === 'create');
  let sent = 0;
  for (const item of items) {
    console.log(`[${log.results.length + 1}/${items.length}] ${item.email}: ${item.status}`);
    try {
      const result = await provisionOne(supabase, item, redirectTo);
      log.results.push({ email: item.email, role: item.role, committee: item.committeeCode || null, ...result });
      if (result.status === 'invited') {
        sent += 1;
        if (sent < inviteItems.length) await sleep(delayMs);
      }
    } catch (error) {
      log.results.push({
        email: item.email,
        role: item.role,
        committee: item.committeeCode || null,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    writePrivateLog(logFile, log);
  }
  log.completedAt = new Date().toISOString();
  writePrivateLog(logFile, log);
  const failures = log.results.filter((result) => result.status === 'error');
  console.log(`Provisioning log: ${logFile}`);
  console.log(`invited=${log.results.filter((result) => result.status === 'invited').length}`);
  console.log(`repaired=${log.results.filter((result) => result.status === 'repaired').length}`);
  console.log(`skipped=${log.results.filter((result) => result.status === 'skipped_complete').length}`);
  console.log(`errors=${failures.length}`);
  if (failures.length > 0) process.exitCode = 2;
};

const runStatus = async ({ supabase, projectRef, roster, options }) => {
  const { items, live, summary } = await preflight(supabase, roster);
  const authByEmail = new Map(live.authUsers.map((user) => [normalizeEmail(user.email), user]));
  const statusRows = items.map((item) => {
    const auth = authByEmail.get(item.email);
    return {
      email: item.email,
      role: item.role,
      committee: item.committeeCode || '-',
      directory: item.status,
      invited_at: auth?.invited_at || null,
      confirmed_at: auth?.email_confirmed_at || auth?.confirmed_at || null,
      last_sign_in_at: auth?.last_sign_in_at || null,
    };
  });
  console.table(statusRows);
  const logFile = privateLogPath('status', options.mode || 'audit');
  writePrivateLog(logFile, {
    action: 'status',
    projectRef,
    rosterPath: roster.absolutePath,
    rosterSha256: roster.hash,
    generatedAt: new Date().toISOString(),
    summary,
    users: statusRows,
  });
  console.log(`Status report: ${logFile}`);
};

const deleteWhereIn = async (supabase, table, column, values) => {
  if (values.length === 0) return;
  for (const valueBatch of chunk(values)) {
    const { error } = await supabase.from(table).delete().in(column, valueBatch);
    if (error) throw new Error(`Unable to clean ${table}.${column}: ${error.message}`);
  }
};

const listStorageDirectory = async (supabase, bucket, prefix) => {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Unable to list ${bucket}/${prefix}: ${error.message}`);
    const batch = data || [];
    for (const entry of batch) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) files.push(relative);
      else files.push(...(await listStorageDirectory(supabase, bucket, relative)));
    }
    if (batch.length < 1000) return files;
  }
};

const cleanupTestUsers = async ({ supabase, projectRef, roster, options }) => {
  if (options.mode !== 'qa') throw new Error('cleanup-test requires --mode qa.');
  assertWriteConfirmation({ options, projectRef, rosterCount: roster.rows.length, action: 'cleanup-test' });
  if (options.confirm_cleanup !== CLEANUP_CONFIRMATION) {
    throw new Error(`cleanup-test requires --confirm-cleanup ${CLEANUP_CONFIRMATION}.`);
  }
  const live = await loadLiveDirectory(supabase, roster.rows);
  const targetEmails = new Set(roster.rows.map((row) => row.email));
  const authTargets = live.authUsers.filter((user) => targetEmails.has(normalizeEmail(user.email)));
  const appTargets = live.appUsers.filter((user) => targetEmails.has(normalizeEmail(user.email)));
  const legacyAdminTargets = live.legacyRows
    .find((group) => group.table === 'Admin')
    ?.rows.filter((row) => targetEmails.has(normalizeEmail(row.email))) || [];
  if (appTargets.some((user) => user.role === 'admin') || legacyAdminTargets.length > 0) {
    throw new Error('cleanup-test refuses to delete administrators. Remove the permanent bootstrap admin from the cleanup email list.');
  }
  const targetIds = [...new Set([...authTargets.map((user) => user.id), ...appTargets.map((user) => user.id)])];
  console.log(`Exact cleanup scope: ${targetEmails.size} roster emails, ${targetIds.length} linked UUIDs.`);

  const { data: rooms, error: roomsError } = targetIds.length
    ? await supabase.from('chat_rooms').select('id, created_by').in('created_by', targetIds)
    : { data: [], error: null };
  if (roomsError) throw new Error(`Unable to inspect test chat rooms: ${roomsError.message}`);
  const roomIds = (rooms || []).map((room) => room.id);
  if (roomIds.length > 0) {
    const { data: members, error: membersError } = await supabase.from('room_members').select('room_id, user_id').in('room_id', roomIds);
    if (membersError) throw new Error(`Unable to inspect room members: ${membersError.message}`);
    const externalMembers = (members || []).filter((member) => !targetIds.includes(String(member.user_id)));
    if (externalMembers.length > 0) {
      throw new Error('Cleanup stopped: a test-created room contains a user outside the exact QA roster.');
    }
  }

  const { data: attachmentRows, error: attachmentError } = targetIds.length
    ? await supabase.from('message_attachments').select('bucket, path, created_by').in('created_by', targetIds)
    : { data: [], error: null };
  if (attachmentError) throw new Error(`Unable to inspect attachments: ${attachmentError.message}`);
  const storagePaths = new Set((attachmentRows || []).filter((row) => row.bucket === 'chat-attachments').map((row) => row.path));
  for (const roomId of roomIds) {
    for (const objectPath of await listStorageDirectory(supabase, 'chat-attachments', roomId)) storagePaths.add(objectPath);
  }
  for (const pathBatch of chunk([...storagePaths], 100)) {
    const { error } = await supabase.storage.from('chat-attachments').remove(pathBatch);
    if (error) throw new Error(`Unable to remove chat attachment objects: ${error.message}`);
  }

  await deleteWhereIn(supabase, 'chat_rooms', 'id', roomIds);
  await deleteWhereIn(supabase, 'message_attachments', 'created_by', targetIds);
  await deleteWhereIn(supabase, 'message_hidden_for_users', 'user_id', targetIds);
  await deleteWhereIn(supabase, 'messages', 'user_id', targetIds);
  await deleteWhereIn(supabase, 'room_members', 'user_id', targetIds);
  await deleteWhereIn(supabase, 'friend_requests', 'sender_id', targetIds);
  await deleteWhereIn(supabase, 'friend_requests', 'receiver_id', targetIds);
  await deleteWhereIn(supabase, 'friendships', 'user1_id', targetIds);
  await deleteWhereIn(supabase, 'friendships', 'user2_id', targetIds);
  await deleteWhereIn(supabase, 'support_requests', 'user_id', targetIds);
  await deleteWhereIn(supabase, 'pending_chat_attachments', 'created_by', targetIds);
  await deleteWhereIn(supabase, 'notification_reads', 'user_id', targetIds);
  await deleteWhereIn(supabase, 'chair_delegate_metrics', 'delegate_id', targetIds);
  await deleteWhereIn(supabase, 'app_notifications', 'created_by', targetIds);

  for (const group of live.legacyRows) {
    const ids = group.rows.filter((row) => targetEmails.has(normalizeEmail(row.email))).map((row) => row[group.id]);
    await deleteWhereIn(supabase, group.table, group.id, ids);
  }
  await deleteWhereIn(supabase, 'app_users', 'id', targetIds);
  for (const authUser of authTargets) {
    const { error } = await supabase.auth.admin.deleteUser(authUser.id);
    if (error) throw new Error(`Unable to delete Auth user ${normalizeEmail(authUser.email)}: ${error.message}`);
  }

  const remainingAuth = (await fetchAllAuthUsers(supabase)).filter((user) => targetEmails.has(normalizeEmail(user.email)));
  const { data: remainingProfiles, error: verifyError } = await supabase.from('app_users').select('id, email').in('email', [...targetEmails]);
  if (verifyError) throw new Error(`Unable to verify cleanup: ${verifyError.message}`);
  if (remainingAuth.length > 0 || (remainingProfiles || []).length > 0) throw new Error('Cleanup verification failed: target identities remain.');
  const logFile = privateLogPath('cleanup-test', 'qa');
  writePrivateLog(logFile, {
    action: 'cleanup-test',
    projectRef,
    rosterSha256: roster.hash,
    completedAt: new Date().toISOString(),
    deletedEmails: [...targetEmails],
    deletedAuthUserIds: authTargets.map((user) => user.id),
    deletedRoomIds: roomIds,
    deletedStorageObjectCount: storagePaths.size,
  });
  console.log(`QA cleanup complete. Audit log: ${logFile}`);
};

const printHelp = () => {
  console.log(`VOFMUN conference user manager

Commands:
  preflight     Validate a roster against live Auth, roles, committees, and matrices (read-only)
  provision     Invite new users and repair incomplete profiles (idempotent)
  status        Reconcile roster, Auth invitation state, and application profiles (read-only)
  cleanup-test  Delete only the exact non-admin QA roster and its isolated test data

Required environment (.env.local, never commit):
  SUPABASE_URL=https://${EXPECTED_PROJECT_REF}.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=...

Examples:
  npm run conference:users -- preflight --roster .private/qa-roster.csv
  npm run conference:users -- provision --mode qa --roster .private/qa-roster.csv \\
    --redirect-to https://your-stable-preview.example/reset-password \\
    --emails-per-hour 25 --apply --confirm-project ${EXPECTED_PROJECT_REF} --confirm-count 8
  npm run conference:users -- status --mode qa --roster .private/qa-roster.csv
  npm run conference:users -- cleanup-test --mode qa --roster .private/qa-roster.csv \\
    --apply --confirm-project ${EXPECTED_PROJECT_REF} --confirm-count 8 \\
    --confirm-cleanup ${CLEANUP_CONFIRMATION}
  npm run conference:users -- provision --mode production --roster .private/conference-roster.csv \\
    --redirect-to https://app.vofmun.org/reset-password --emails-per-hour 100 \\
    --apply --confirm-project ${EXPECTED_PROJECT_REF} --confirm-count 125 \\
    --confirm-production ${PRODUCTION_CONFIRMATION}

Re-run provision to retry failures; fully complete users are skipped.`);
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.action === 'help' || options.help) return printHelp();
  if (!['preflight', 'provision', 'status', 'cleanup-test'].includes(options.action)) {
    throw new Error(`Unknown action ${options.action}. Run with help.`);
  }
  const roster = options.action === 'cleanup-test' ? loadCleanupRoster(options.roster) : loadRoster(options.roster);
  const { supabase, projectRef } = await createAdminClient();
  if (options.action === 'preflight') {
    await preflight(supabase, roster);
    return;
  }
  if (options.action === 'status') {
    await runStatus({ supabase, projectRef, roster, options });
    return;
  }
  if (options.action === 'cleanup-test') {
    await cleanupTestUsers({ supabase, projectRef, roster, options });
    return;
  }
  await runProvision({ supabase, projectRef, roster, options });
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
