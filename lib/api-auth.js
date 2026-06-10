import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export async function requireAuth(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supa.auth.getUser(token);
  return user ?? null;
}

export const UNAUTHORIZED = () =>
  Response.json({ error: 'Ikke godkendt' }, { status: 401 });
