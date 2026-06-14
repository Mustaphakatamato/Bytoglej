import { createServerClient } from './supabase-server';

export async function checkIsAdmin(userId) {
  if (!userId) return false;
  const supa = createServerClient();
  const { data } = await supa.from('admins').select('id').eq('user_id', userId).maybeSingle();
  return !!data;
}
