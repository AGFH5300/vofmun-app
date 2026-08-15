import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const server = read('server/chat/server.ts');
const chair = read('app/chair/page.tsx');
const delegatesRoute = read('app/api/delegates/route.ts');
const chat = read('app/messages/context/ChatContext.tsx');

assert.match(server, /'\/api\/delegates'/, 'The custom server must forward the delegates route to Next.');
assert.match(chair, /withBrowserAuthHeaders/, 'Chair API calls must include the verified Supabase bearer token.');
assert.match(delegatesRoute, /getVerifiedSessionUserFromRequest/, 'The delegates API must verify the access token.');
assert.match(delegatesRoute, /actor\.role === 'chair'/, 'Chair updates must be committee-scoped.');
assert.match(chat, /getReceiptRetryDelay/, 'Receipt delivery must use the terminal/transient retry policy.');

console.log('Release contracts verified.');
