import fs from 'node:fs';

const loginSource = fs.readFileSync('app/login/page.tsx', 'utf8');
const sessionSource = fs.readFileSync('app/context/sessionContext.tsx', 'utf8');
const serverSource = fs.readFileSync('server/chat/server.ts', 'utf8');
const typewriterSource = fs.readFileSync('components/ui/typewriter.tsx', 'utf8');

if (/initial=\{\{[^{}]*opacity:\s*0/.test(loginSource)) {
  throw new Error('Login page still server-renders hidden motion content.');
}

if (!sessionSource.includes('event === "INITIAL_SESSION" && !session')) {
  throw new Error('Session bootstrap does not recover a persisted session from a transient null INITIAL_SESSION.');
}

if (!sessionSource.includes('? readPersistedSession()')) {
  throw new Error('Session bootstrap persisted-session fallback is missing.');
}

if (!serverSource.includes('httpServer: server')) {
  throw new Error('Next is not attached to the shared HTTP server, so development WebSocket upgrades can fail.');
}

if (!serverSource.includes('new WebSocketServer({ noServer: true })') || !serverSource.includes('nextApp.getUpgradeHandler()')) {
  throw new Error('Chat and Next WebSocket upgrades are not explicitly separated.');
}

if (!serverSource.includes('webpack: true') || !serverSource.includes('turbopack: false')) {
  throw new Error('Replit development mode is not pinned to the stable webpack HMR path.');
}

if (!typewriterSource.includes('useState(FALLBACK_TEXT)') || !typewriterSource.includes('setHasMounted(true)')) {
  throw new Error('Typewriter does not provide SSR fallback text followed by client animation.');
}

if (!loginSource.includes('disabled={!isClientReady || loading}') || !loginSource.includes('Preparing secure login...')) {
  throw new Error('Login can submit before React hydration and silently reload the page.');
}

console.log('Auth, hydration, and WebSocket regression checks passed.');
