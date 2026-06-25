import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// requireAuth validerer brugeren ud fra (1) session-cookies sat af middleware og,
// hvis de mangler, (2) et Bearer-token i Authorization-headeren. Fallback'et er
// vigtigt på mobil (Safari ITP), hvor cookien ofte ikke følger med — dér sender
// klienten i stedet access_token som Bearer. Begge veje validerer JWT'en hos Supabase.
export async function requireAuth(req) {
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

  // 1) Cookie-baseret session
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user;

  // 2) Fallback: Bearer-token fra Authorization-headeren
  const authHeader = req?.headers?.get?.('authorization') || req?.headers?.get?.('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const { data: { user: tokenUser } } = await supabase.auth.getUser(token);
      if (tokenUser) return tokenUser;
    }
  }

  return null;
}

export const UNAUTHORIZED = () =>
  Response.json({ error: 'Ikke godkendt' }, { status: 401 });
