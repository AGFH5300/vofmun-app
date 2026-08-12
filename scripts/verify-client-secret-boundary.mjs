import fs from 'node:fs';
import path from 'node:path';

const clientRoot = path.join(process.cwd(), '.next', 'static');
if (!fs.existsSync(clientRoot)) {
  throw new Error('Production client output is missing; run next build before this check.');
}

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });

const clientChunks = walk(clientRoot).filter((filePath) => filePath.endsWith('.js'));
if (clientChunks.length === 0) {
  throw new Error('No emitted browser JavaScript chunks were found.');
}

const forbiddenLiterals = [
  'ci-service-role-canary-not-for-client',
  'ci-news-api-canary-not-for-client',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'NEWS_API_KEY',
  'supabaseAdmin',
];

const credentialPatterns = [
  { label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'Stripe secret key', pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { label: 'GitHub token', pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { label: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

let scannedBytes = 0;
for (const filePath of clientChunks) {
  const source = fs.readFileSync(filePath, 'utf8');
  scannedBytes += Buffer.byteLength(source);

  for (const literal of forbiddenLiterals) {
    if (source.includes(literal)) {
      throw new Error(`Server-only identifier or canary leaked into browser chunk ${path.relative(process.cwd(), filePath)}: ${literal}`);
    }
  }

  for (const { label, pattern } of credentialPatterns) {
    if (pattern.test(source)) {
      throw new Error(`${label} pattern found in browser chunk ${path.relative(process.cwd(), filePath)}`);
    }
  }
}

const chatSource = fs.readFileSync('app/messages/context/ChatContext.tsx', 'utf8');
for (const forbiddenLog of [
  "logChatDebug('socket:onopen:send_auth', authPayload",
  "logChatDebug('socket:onmessage:raw'",
  "console.debug('sendMessage payload'",
]) {
  if (chatSource.includes(forbiddenLog)) {
    throw new Error(`Sensitive chat payload logging has regressed: ${forbiddenLog}`);
  }
}

const supabaseClientSource = fs.readFileSync('lib/supabase.ts', 'utf8');
if (/NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE|ADMIN_KEY)/.test(supabaseClientSource)) {
  throw new Error('A server-only Supabase credential is configured as a public browser variable.');
}

process.stdout.write(`Client secret boundary passed: ${clientChunks.length} browser chunks, ${scannedBytes} bytes scanned.\n`);
