import { createClient } from '@supabase/supabase-js';

export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Throws on error so handlers don't silently continue.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`supabase: ${error.message}`);
  return data;
}
