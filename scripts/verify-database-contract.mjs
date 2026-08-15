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

const operations = fs.readFileSync('supabase/migrations/20260815161500_complete_operations.sql', 'utf8');
for (const table of ['app_notifications', 'notification_reads', 'conference_settings']) {
  assert.match(operations, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  assert.match(operations, new RegExp(`grant .* on table public\\.${table} to service_role`, 'i'));
}

process.stdout.write(`Database contract verified across ${migrations.length} migrations.\n`);
