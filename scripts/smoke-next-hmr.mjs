import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import vm from 'node:vm';

const port = 5099;
const origin = `http://127.0.0.1:${port}`;
const logs = [];
let finalExitCode = 0;

// Reproduce the exact Replit failure before startup. The clean development
// wrapper must delete this malformed stale chunk before Next begins compiling.
const staleLayoutPath = path.join(process.cwd(), '.next', 'static', 'chunks', 'app', 'layout.js');
fs.mkdirSync(path.dirname(staleLayoutPath), { recursive: true });
fs.writeFileSync(staleLayoutPath, 'const staleLayoutChunk = @;\n', 'utf8');

const child = spawn(process.execPath, ['scripts/start-clean-dev.mjs'], {
  detached: true,
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
      if (response.status === 200) return response.text();
      lastError = new Error(`Unexpected /login status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError || new Error('Timed out waiting for /login.');
}

async function verifyGeneratedClientChunks(html) {
  const scriptSources = Array.from(
    html.matchAll(/<script[^>]+src=["']([^"']+\.js(?:\?[^"']*)?)["']/g),
    (match) => match[1],
  );
  const chunkSources = Array.from(new Set(
    scriptSources.filter((source) => source.startsWith('/_next/static/chunks/')),
  ));

  if (chunkSources.length === 0) {
    throw new Error('The login response did not reference any Next client chunks.');
  }

  let sawLayoutChunk = false;
  for (const sourcePath of chunkSources) {
    const chunkUrl = new URL(sourcePath, origin);
    const response = await fetch(chunkUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`${sourcePath} returned HTTP ${response.status}`);
    }

    const source = await response.text();
    try {
      new vm.Script(source, { filename: chunkUrl.pathname });
    } catch (error) {
      const lines = source.split('\n');
      const lineNumber = Number(error?.stack?.match(/:(\d+):(\d+)/)?.[1] || 0);
      const contextStart = Math.max(0, lineNumber - 3);
      const contextEnd = Math.min(lines.length, lineNumber + 2);
      console.error(lines.slice(contextStart, contextEnd).join('\n'));
      throw new Error(`Generated client chunk is not valid JavaScript: ${sourcePath}\n${error}`);
    }

    if (chunkUrl.pathname.endsWith('/app/layout.js')) {
      sawLayoutChunk = true;
    }
  }

  if (!sawLayoutChunk) {
    const layoutPath = '/_next/static/chunks/app/layout.js';
    const response = await fetch(new URL(layoutPath, origin), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`${layoutPath} returned HTTP ${response.status}`);
    }
    const source = await response.text();
    new vm.Script(source, { filename: layoutPath });
  }

  console.log(`Validated ${chunkSources.length} generated Next client chunk(s), including app/layout.js.`);
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

function stopServer(signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // The process may already have exited.
    }
  }
}

const hardTimeout = setTimeout(() => {
  console.error('Unified server WebSocket smoke test exceeded 120 seconds.');
  stopServer('SIGKILL');
  process.exit(1);
}, 120_000);
hardTimeout.unref();

try {
  const loginHtml = await waitForLogin();
  await verifyGeneratedClientChunks(loginHtml);
  // Next 16.3 uses the unified /_next/hmr endpoint and requires the same
  // per-client id query parameter generated by its browser development client.
  await expectWebSocketOpen('/_next/hmr?id=vofmun-ci-smoke');
  await expectWebSocketOpen('/chat-ws');
  console.log('Unified server WebSocket smoke test passed.');
} catch (error) {
  finalExitCode = 1;
  console.error('Unified server WebSocket smoke test failed.');
  console.error(error);
  console.error(logs.join(''));
} finally {
  clearTimeout(hardTimeout);
  stopServer('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(5_000),
  ]);
  stopServer('SIGKILL');
  process.exit(finalExitCode);
}
