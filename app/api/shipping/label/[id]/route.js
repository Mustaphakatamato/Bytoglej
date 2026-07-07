import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { checkIsAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

// Serverer en pakkemærkat fra den PRIVATE shipping-labels bucket via en kortlivet
// signed URL. Kun afsender-institutionen (der skal printe labelen) — eller en admin —
// må hente den. Erstatter den tidligere permanente offentlige URL, så fragtlabels
// med navne+adresser ikke længere er læsbare for enhver med linket.
export async function GET(req, { params }) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const { id } = await params; // = shipmondo_shipment_id (= filnavn <id>.pdf)
  if (!id) return NextResponse.json({ error: 'Mangler id' }, { status: 400 });

  const supa = createServerClient();

  const { data: ship } = await supa
    .from('shipments')
    .select('seller_institution_id')
    .eq('shipmondo_shipment_id', id)
    .maybeSingle();
  if (!ship) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  // Autoriser: admin, eller medlem af afsender-institutionen (samme mønster som
  // create-intent's institutions-medlemskabstjek).
  const isAdmin = await checkIsAdmin(user.id);
  if (!isAdmin) {
    const email = (user.email || '').toLowerCase();
    let allowed = false;
    if (ship.seller_institution_id) {
      const { data: inst } = await supa
        .from('institutions')
        .select('email, leader_email')
        .eq('id', ship.seller_institution_id)
        .maybeSingle();
      allowed = !!inst && [inst.email, inst.leader_email]
        .filter(Boolean)
        .some(e => e.toLowerCase() === email);
      if (!allowed) {
        const { data: mem } = await supa
          .from('institution_members')
          .select('id')
          .eq('institution_id', ship.seller_institution_id)
          .ilike('email', email)
          .maybeSingle();
        allowed = !!mem;
      }
    }
    if (!allowed) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  const { data: signed, error } = await supa
    .storage.from('shipping-labels')
    .createSignedUrl(`${id}.pdf`, 120);
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Pakkemærkat ikke tilgængelig' }, { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
