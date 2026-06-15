import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

// Gyldige samtykke-/præferencetyper → den kolonne på institutions de spejles til.
const CONSENT_COLUMNS = {
  marketing:      'marketing_consent',
  profile_public: 'profile_public',
};

// POST /api/gdpr/consent  { type: 'marketing'|'profile_public', granted: boolean }
//
// Registrerer et samtykke/præference-skift server-side: appender til den
// uforanderlige consent_log (med timestamp + IP) og opdaterer den effektive
// værdi på institutions. Klienten skriver aldrig selv til DB — samtykke skal
// kunne dokumenteres og må ikke kunne forfalskes.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 });
  }

  const { type, granted } = body;
  const column = CONSENT_COLUMNS[type];
  if (!column || typeof granted !== 'boolean') {
    return NextResponse.json({ error: 'Ugyldig samtykketype' }, { status: 400 });
  }

  const supa = createServerClient();

  // Find brugerens institution (ejer via email, ellers medlem) — samme mønster
  // som /api/seller-orders.
  const { data: ownInst } = await supa.from('institutions')
    .select('id').ilike('email', user.email).maybeSingle();
  let instId = ownInst?.id ?? null;

  if (!instId) {
    const { data: mem } = await supa.from('institution_members')
      .select('institutions(id)').ilike('email', user.email).maybeSingle();
    if (mem?.institutions) instId = mem.institutions.id;
  }

  if (!instId) {
    return NextResponse.json({ error: 'Ingen institution fundet' }, { status: 403 });
  }

  // 1) Append til audit-loggen (uforanderligt bevis)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null;

  const { error: logErr } = await supa.from('consent_log').insert({
    institution_id: instId,
    consent_type:   type,
    granted,
    changed_by:     user.id,
    ip_address:     ip,
    user_agent:     userAgent,
  });
  if (logErr) {
    console.error('[gdpr/consent] log-fejl:', logErr);
    return NextResponse.json({ error: 'Kunne ikke registrere samtykke' }, { status: 500 });
  }

  // 2) Spejl den effektive værdi på institutions (hurtig læsning)
  const { error: updErr } = await supa.from('institutions')
    .update({ [column]: granted })
    .eq('id', instId);
  if (updErr) {
    console.error('[gdpr/consent] update-fejl:', updErr);
    return NextResponse.json({ error: 'Kunne ikke gemme indstilling' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type, granted });
}
