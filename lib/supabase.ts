// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLIC_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const isBrowser = typeof window !== 'undefined';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
  },
  global: {
    headers: {
      apikey: supabaseKey,
    },
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers || {});

      if (!headers.has('apikey')) {
        headers.set('apikey', supabaseKey);
      }

      return fetch(input, { ...init, headers });
    }
  }
});

export default supabase;
