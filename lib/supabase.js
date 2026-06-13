import { createBrowserClient } from '@supabase/ssr';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cookie-based client: tokens stored in cookies (Secure + SameSite) instead of localStorage
export const db = createBrowserClient(SUPA_URL, SUPA_KEY);
