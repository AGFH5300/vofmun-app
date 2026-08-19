import assert from 'node:assert/strict';
import test from 'node:test';

// The production command is plain ESM so it can be run with Node without a
// transpilation step. Its pure validation helpers are exported for regression tests.
// @ts-expect-error JavaScript module intentionally has no declaration file.
import { buildPlan, computeInviteDelayMs, parseCsv, projectRefFromUrl, validateRedirect, validateRosterShape } from '../scripts/manage-conference-users.mjs';

test('CSV parser handles quoted school names and normalizes roster fields', () => {
  const rows = parseCsv(`email,first_name,last_name,role,committee_code,country,school,grade\nTEST@EXAMPLE.ORG, First , Last ,delegate,ga1,Republic of India,"School, Dubai",11\n`);
  const roster = validateRosterShape(rows);
  assert.equal(roster[0].email, 'test@example.org');
  assert.equal(roster[0].committeeCode, 'GA1');
  assert.equal(roster[0].school, 'School, Dubai');
});

test('roster validation rejects duplicate committee seats', () => {
  const rows = parseCsv(`email,first_name,last_name,role,committee_code,country,school,grade\nfirst@test.org,First,User,delegate,GA1,Republic of India,School A,11\nsecond@test.org,Second,User,delegate,GA1,Republic of India,School B,11\n`);
  assert.throws(() => validateRosterShape(rows), /duplicate delegate seat/i);
});

test('staff and chair shape rules are enforced', () => {
  const rows = parseCsv(`email,first_name,last_name,role,committee_code,country,school,grade\nadmin@test.org,Admin,User,admin,GA1,,,\nchair@test.org,Chair,User,chair,,,,\n`);
  assert.throws(() => validateRosterShape(rows), /admin\/secretariat.*must be blank|chairs require committee_code/i);
});

test('project and redirect safety helpers reject wrong production targets', () => {
  assert.equal(projectRefFromUrl('https://gqymcyupsfemseybtmle.supabase.co'), 'gqymcyupsfemseybtmle');
  assert.equal(projectRefFromUrl('https://example.com'), null);
  assert.throws(() => validateRedirect('https://preview.example/reset-password', 'production'), /app\.vofmun\.org/);
  assert.equal(validateRedirect('https://app.vofmun.org/reset-password', 'production'), 'https://app.vofmun.org/reset-password');
});

test('email pacing is derived from the configured hourly limit', () => {
  assert.equal(computeInviteDelayMs(30), 120000);
  assert.equal(computeInviteDelayMs(100), 36000);
  assert.throws(() => computeInviteDelayMs(0), /between 1 and 10000/);
});

test('live-directory plan creates new users and skips fully linked users', () => {
  const roster = validateRosterShape(parseCsv(`email,first_name,last_name,role,committee_code,country,school,grade\nadmin@test.org,Admin,User,admin,,,,\ndelegate@test.org,Delegate,User,delegate,GA1,Republic of India,Test School,11\n`));
  const committeeId = '00000000-0000-4000-8000-000000000101';
  const authId = '11111111-1111-4111-8111-111111111111';
  const live = {
    authUsers: [{ id: authId, email: 'delegate@test.org' }],
    committees: [{ committeeID: committeeId, committeeCode: 'GA1', name: 'General Assembly', fullname: 'GA1' }],
    matrixSeats: [{ committee_id: committeeId, country_name: 'Republic of India', sort_order: 1 }],
    appUsers: [{
      id: authId,
      email: 'delegate@test.org',
      first_name: 'Delegate',
      last_name: 'User',
      role: 'delegate',
      committee_id: committeeId,
      country: 'Republic of India',
      school: 'Test School',
      grade: '11',
      legacy_id: authId,
    }],
    legacyRows: [
      { table: 'Delegate', id: 'delegateID', rows: [{ delegateID: authId, auth_user_id: authId, email: 'delegate@test.org' }] },
      { table: 'Chair', id: 'chairID', rows: [] },
      { table: 'Admin', id: 'adminID', rows: [] },
      { table: 'Secretariat', id: 'secretariatID', rows: [] },
    ],
  };
  const plan = buildPlan(roster, live);
  assert.equal(plan.find((item) => item.email === 'admin@test.org')?.status, 'create');
  assert.equal(plan.find((item) => item.email === 'delegate@test.org')?.status, 'complete');
});
