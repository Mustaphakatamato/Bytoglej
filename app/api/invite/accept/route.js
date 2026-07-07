import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// Accepter en medarbejder-invitation SERVER-SIDE med service role.
//
// Tidligere skete accepten klientside: den nyoprettede bruger forsøgte selv at
// upserte sig ind i institution_members. Men RLS-policyen "Admin inserts members"
// tillader kun ejer/leder/admin at indsætte — invitéen er ingen af delene, så
// insertet blev tavst blokeret, og medarbejderen fik en konto uden adgang til
// institutionen. Her udføres oprettelse + tilknytning med service role, så RLS
// ikke blokerer, og token'et (ikke en session) er beviset på adgang.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 });
  }

  const token = String(body?.token || '').trim();
  const password = String(body?.password || '');
  if (!token) return NextResponse.json({ error: 'Manglende token' }, { status: 400 });
  // Spejl klientens minimumskrav server-side (klient-validering kan omgås).
  if (password.length < 8) {
    return NextResponse.json({ error: 'Adgangskoden skal være mindst 8 tegn' }, { status: 400 });
  }

  const supa = createServerClient();

  // 1) Valider invitationen (findes, ikke brugt, ikke udløbet).
  const { data: inv } = await supa
    .from('institution_invitations')
    .select('id, email, institution_id, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!inv) return NextResponse.json({ error: 'Ugyldigt link', status: 'invalid' }, { status: 404 });
  if (inv.accepted_at) return NextResponse.json({ error: 'Invitationen er allerede brugt', status: 'used' }, { status: 409 });
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitationen er udløbet', status: 'expired' }, { status: 410 });
  }

  const email = String(inv.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Invitationen mangler e-mail' }, { status: 400 });

  // 2) Opret brugeren (auto-bekræftet — modtagelsen af invitationsmailen på
  // denne adresse er beviset på, at brugeren ejer indbakken). Findes kontoen
  // allerede, tilknyttes den blot; adgangskoden ændres ikke.
  let existing = false;
  const { error: createErr } = await supa.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    const msg = (createErr.message || '').toLowerCase();
    const alreadyRegistered =
      createErr.code === 'email_exists' ||
      msg.includes('already been registered') ||
      msg.includes('already registered') ||
      msg.includes('already exists');
    if (!alreadyRegistered) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }
    existing = true;
  }

  // 3) Tilknyt medarbejderen til institutionen (service role → RLS blokerer ikke).
  const { error: memberErr } = await supa.from('institution_members').upsert(
    { institution_id: inv.institution_id, email, role: 'member' },
    { onConflict: 'institution_id,email', ignoreDuplicates: true }
  );
  if (memberErr) {
    return NextResponse.json({ error: 'Kunne ikke tilknytte medarbejderen', detail: memberErr.message }, { status: 500 });
  }

  // 4) Markér invitationen brugt (kun hvis den stadig er ubrugt — idempotent).
  await supa
    .from('institution_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inv.id)
    .is('accepted_at', null);

  // existing=true → kontoen fandtes; klienten kan ikke logge ind med den
  // indtastede adgangskode, så den beder brugeren logge ind manuelt.
  return NextResponse.json({ ok: true, existing, email });
}
