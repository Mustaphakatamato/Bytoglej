import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// requireAuth reads the session from HttpOnly-compatible cookies set by the middleware.
// The _req parameter is kept for backward compat but is unused — cookies() from next/headers
// is the authoritative source so that getUser() always hits Supabase to validate the JWT.
export async function requireAuth(_req) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch {}
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export const UNAUTHORIZED = () =>
  Response.json({ error: 'Ikke godkendt' }, { status: 401 });
