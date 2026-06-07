import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Uses service role key to bypass RLS in API routes.
// Falls back to anon key (limited write access) if service key not configured.
export function createServerClient() {
  return createClient(SUPA_URL, SERVICE_KEY || ANON_KEY, {
    auth: { persistSession: false },
  });
}
