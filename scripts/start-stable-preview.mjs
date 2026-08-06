import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let activeChild;
let stopping = false;

const run = (argumentsList, extraEnvironment = {}) => new Promise((resolve, reject) => {
  const child = spawn(npmCommand, argumentsList, {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      ...extraEnvironment,
    },
    stdio: 'inherit',
  });
  activeChild = child;

  child.once('error', reject);
  child.once('exit', (code, signal) => {
    activeChild = undefined;
    if (signal) {
      reject(new Error(`${argumentsList.join(' ')} stopped with ${signal}`));
      return;
    }
    resolve(code ?? 1);
  });
});

const stop = (signal) => {
  if (stopping) return;
  stopping = true;
  if (activeChild && !activeChild.killed) activeChild.kill(signal);
};

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

try {
  fs.rmSync(path.join(root, '.next'), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  console.warn('[stable-preview] Removed .next before creating the production preview.');

  const buildCode = await run(['run', 'build'], { NODE_ENV: 'production' });
  if (buildCode !== 0) process.exit(buildCode);

  console.warn('[stable-preview] Build complete. Starting without HMR or Fast Refresh.');
  const startCode = await run(['run', 'start'], { NODE_ENV: 'production' });
  process.exit(startCode);
} catch (error) {
  if (!stopping) console.error('[stable-preview] Failed to create or start the preview.', error);
  process.exit(stopping ? 0 : 1);
}
