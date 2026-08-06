import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const port = 5099;
const origin = `http://127.0.0.1:${port}`;
const logs = [];

const child = spawn('npx', ['tsx', 'server/chat/server.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    CHAT_PORT: String(port),
    VITE_SUPABASE_URL: 'https://build-check.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'build-check-service-role-key',
    NEXT_PUBLIC_SUPABASE_URL: 'https://build-check.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'build-check-anon-key',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    logs.push(chunk);
    process.stdout.write(chunk);
  });
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForLogin() {
  const deadline = Date.now() + 90_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Unified server exited before becoming ready (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(`${origin}/login`, { redirect: 'manual' });
      if (response.status === 200) return;
      lastError = new Error(`Unexpected /login status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError || new Error('Timed out waiting for /login.');
}

function expectWebSocketOpen(pathname, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${pathname}`, {
      headers: { Origin: origin },
    });
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error(`Timed out opening ${pathname}`));
    }, timeoutMs);

    socket.once('open', () => {
      clearTimeout(timeout);
      socket.close();
      resolve();
    });
    socket.once('unexpected-response', (_request, response) => {
      clearTimeout(timeout);
      reject(new Error(`${pathname} returned HTTP ${response.statusCode}`));
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

try {
  await waitForLogin();
  await expectWebSocketOpen('/_next/webpack-hmr');
  await expectWebSocketOpen('/chat-ws');
  console.log('Unified server WebSocket smoke test passed.');
} catch (error) {
  console.error('Unified server WebSocket smoke test failed.');
  console.error(error);
  console.error(logs.join(''));
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(5_000).then(() => child.kill('SIGKILL')),
  ]);
}
