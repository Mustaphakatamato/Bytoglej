import { db } from './supabase';

// Cache per session to avoid repeated DB round-trips
const _cache = {};

export async function checkIsAdmin(userId) {
  if (!userId) return false;
  if (_cache[userId] !== undefined) return _cache[userId];
  const { data } = await db.from('admins').select('id').eq('user_id', userId).maybeSingle();
  _cache[userId] = !!data;
  return !!data;
}

export function clearAdminCache(userId) {
  if (userId) delete _cache[userId];
  else Object.keys(_cache).forEach(k => delete _cache[k]);
}
