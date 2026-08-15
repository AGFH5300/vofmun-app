import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const server = read('server/chat/server.ts');
const chair = read('app/chair/page.tsx');
const delegatesRoute = read('app/api/delegates/route.ts');
const chat = read('app/messages/context/ChatContext.tsx');
const admin = read('app/admin/page.tsx');
const liveUpdates = read('app/live-updates/page.tsx');
const navbar = read('components/ui/customnav.tsx');
const login = read('app/login/page.tsx');

assert.match(server, /'\/api\/delegates'/, 'The custom server must forward the delegates route to Next.');
assert.match(chair, /withBrowserAuthHeaders/, 'Chair API calls must include the verified Supabase bearer token.');
assert.match(delegatesRoute, /getVerifiedSessionUserFromRequest/, 'The delegates API must verify the access token.');
assert.match(delegatesRoute, /actor\.role === 'chair'/, 'Chair updates must be committee-scoped.');
assert.match(chat, /getReceiptRetryDelay/, 'Receipt delivery must use the terminal/transient retry policy.');
for (const route of [
  '/api/health',
  '/api/delegates',
  '/api/notifications',
  '/api/conference',
  '/api/admin/support-requests',
  '/api/admin/notifications',
  '/api/admin/users',
]) {
  assert.ok(server.includes(`'${route}'`), `The custom server must forward ${route}.`);
}
assert.match(admin, /Admin Control Centre/, 'Admin operations must be available in the app.');
assert.match(admin, /Provision Account/, 'Invitation-only account provisioning must be available to staff.');
assert.match(liveUpdates, /\/api\/conference/, 'Live updates must use configured conference content.');
assert.doesNotMatch(liveUpdates, /const conferenceSchedule/, 'The schedule must not be hard-coded in the client.');
assert.match(navbar, /\/api\/notifications/, 'The navbar must use the durable notification source.');
assert.doesNotMatch(login, /\.signUp\s*\(/, 'Public signup must remain intentionally absent.');
assert.equal(fs.existsSync('app/signup/page.tsx'), false, 'A public signup page must not be added.');

process.stdout.write('Release contracts verified.\n');
