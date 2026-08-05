import fs from 'node:fs';

const loginSource = fs.readFileSync('app/login/page.tsx', 'utf8');
const sessionSource = fs.readFileSync('app/context/sessionContext.tsx', 'utf8');

if (/initial=\{\{[^{}]*opacity:\s*0/.test(loginSource)) {
  throw new Error('Login page still server-renders hidden motion content.');
}

if (!sessionSource.includes('event === "INITIAL_SESSION" && !session')) {
  throw new Error('Session bootstrap does not recover a persisted session from a transient null INITIAL_SESSION.');
}

if (!sessionSource.includes('? readPersistedSession()')) {
  throw new Error('Session bootstrap persisted-session fallback is missing.');
}

console.log('Auth bootstrap regression checks passed.');
