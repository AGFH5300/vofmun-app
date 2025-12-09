import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
      headers.set("apikey", supabaseKey);
      headers.set("Authorization", `Bearer ${supabaseKey}`);

      return fetch(input, { ...init, headers });
    }
  }
});

export default supabase;
