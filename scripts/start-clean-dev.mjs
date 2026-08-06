import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nextOutputDir = path.join(root, '.next');

try {
  fs.rmSync(nextOutputDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  console.warn('[dev-cache] Removed the complete .next directory before development startup.');
} catch (error) {
  console.error('[dev-cache] Unable to remove the complete .next directory.', error);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', 'server/chat/server.ts'],
  {
    cwd: root,
    env: {
      ...process.env,
      VOFMUN_CLEAN_DEV_STARTED: '1',
    },
    stdio: 'inherit',
  },
);

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));

child.once('error', (error) => {
  console.error('[dev-server] Failed to start the unified development server.', error);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
