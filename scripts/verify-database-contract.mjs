import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDirectory = 'supabase/migrations';
const migrations = fs.readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql')).sort();
assert.equal(migrations[0], '20260801000000_initial_schema_contract.sql', 'The reproducible schema contract must run first.');

const baseline = fs.readFileSync(path.join(migrationsDirectory, migrations[0]), 'utf8');
for (const table of [
  '"Committee"', '"Delegate"', '"Chair"', '"Admin"', '"Secretariat"', 'app_users',
  '"Resos"', '"Speech"', 'chat_rooms', 'room_members', 'messages', 'friend_requests',
]) {
  assert.ok(
    baseline.toLowerCase().includes(`create table if not exists public.${table}`.toLowerCase()),
    `Missing baseline table ${table}`,
  );
}

assert.doesNotMatch(
  baseline,
  /create or replace function public\.mark_message_receipts/i,
  'The backdated baseline must not replace the deployed receipt function.',
);

const operations = fs.readFileSync('supabase/migrations/20260815161500_complete_operations.sql', 'utf8');
for (const table of ['app_notifications', 'notification_reads', 'conference_settings']) {
  assert.match(operations, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  assert.match(operations, new RegExp(`grant .* on table public\\.${table} to service_role`, 'i'));
}

const chairOperations = fs.readFileSync('supabase/migrations/20260819190000_chair_operations.sql', 'utf8');
for (const table of ['committee_matrix_seats', 'chair_committee_sessions', 'chair_delegate_metrics']) {
  assert.match(chairOperations, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  assert.match(chairOperations, new RegExp(`grant .* on table public\\.${table} to service_role`, 'i'));
  assert.match(chairOperations, new RegExp(`revoke .* on table public\\.${table} from public, anon, authenticated`, 'i'));
}
assert.doesNotMatch(
  chairOperations,
  /committee_id\s+text/i,
  'Chair data must use the UUID committee key from the VOFMUN schema.',
);
assert.equal(
  (chairOperations.match(/committee_id\s+uuid\s+not null references public\."Committee"\("committeeID"\)/gi) || []).length,
  3,
  'All chair tables must reference the UUID committee key.',
);
for (const committee of ['GA1', 'UNHRC', 'UNODC', 'ECOSOC', 'UNSC', 'ICRCC']) {
  assert.ok(chairOperations.includes(`'${committee}'`), `Missing committee matrix seed for ${committee}`);
}

process.stdout.write(`Database contract verified across ${migrations.length} migrations.\n`);
