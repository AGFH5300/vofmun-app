import { createClient } from '@supabase/supabase-js';

// Read from both Vite-style client env vars and traditional process.env so the
// client keeps working across local dev, SSR, and hosted environments. We also
// support the common NEXT_PUBLIC/SUPABASE_* naming schemes so deployments that
// are configured for Next.js still work when the frontend runs on Vite.
const viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;

const supabaseUrl =
  viteEnv?.VITE_SUPABASE_URL ||
  viteEnv?.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseKey =
  viteEnv?.VITE_SUPABASE_ANON_KEY ||
  viteEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLIC_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  global: {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    },
    // Ensure every request includes the required API key headers so Supabase
    // never rejects the call with "No API key found".
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers || {});

      if (!headers.has('apikey')) {
        headers.set('apikey', supabaseKey);
      }
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${supabaseKey}`);
      }

      return fetch(input, { ...init, headers });
    }
  }
});

export default supabase;
