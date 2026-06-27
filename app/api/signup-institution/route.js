import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// Opretter institutions-rækken server-side (service-role) under signup.
// Nødvendigt fordi email-bekræftelse betyder at brugeren IKKE har en session lige
// efter db.auth.signUp() — en klient-side insert ville derfor blive afvist af RLS
// (auth.uid() er NULL). Misbrug forhindres ved at verificere at auth-brugeren
// faktisk findes med den angivne email, og at der ikke allerede er en institution.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const email = (body.email || '').toLowerCase().trim();
  const userId = body.userId;
  if (!email || !userId) return NextResponse.json({ error: 'Mangler bruger' }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: 'Mangler institutionsnavn' }, { status: 400 });

  const supa = createServerClient();

  // Verificér at auth-brugeren findes og matcher emailen (ingen oprettelse for fremmede emails).
  const { data: authData, error: authErr } = await supa.auth.admin.getUserById(userId);
  if (authErr || !authData?.user || (authData.user.email || '').toLowerCase() !== email) {
    return NextResponse.json({ error: 'Bruger ikke fundet' }, { status: 403 });
  }

  // Idempotent: spring over hvis institutionen allerede findes (fx ved retry).
  const { data: existing } = await supa.from('institutions').select('id').ilike('email', email).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, alreadyExists: true });

  const { error } = await supa.from('institutions').insert({
    cvr: body.cvr || null,
    pnr: body.pnr || null,
    name: body.name,
    kommune: body.kommune || null,
    institution_type: body.institution_type || null,
    ownership_type: body.ownership_type || null,
    address: body.address || null,
    zipcode: body.zipcode || null,
    city: body.city || null,
    children_count: body.children_count || null,
    phone: body.phone || null,
    website: body.website || null,
    leader_name: body.leader_name || null,
    leader_phone: body.leader_phone || null,
    leader_email: body.leader_email || null,
    contact_name: body.contact_name || null,
    email,
    is_approved: false,
  });
  if (error) {
    console.error('[signup-institution] insert fejl:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
