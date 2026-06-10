import { db } from './supabase';

export async function authedFetch(url, opts = {}) {
  const { data: { session } } = await db.auth.getSession();
  return fetch(url, {
    ...opts,
    headers: {
      ...opts.headers,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
}
