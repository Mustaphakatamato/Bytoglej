import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveInstitution } from '@/lib/gdpr-institution';
import { gdprExportHtml } from '@/lib/gdpr-export-html';

// GET /api/gdpr/export
//
// GDPR art. 15 (indsigt) + art. 20 (dataportabilitet): samler alle
// personoplysninger byt&leg behandler om den indloggede brugers institution.
// Standard-leverancen er en pæn, læsevenlig HTML-rapport, som klienten gemmer
// som en fil (download). Maskinlæsbar JSON bevares via ?format=json.
//
// Hver hentning logges i data_export_log, så institutionen kan se en historik
// over hvornår data er hentet, og vi har en audit-trail på indsigtsanmodninger.
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const format = new URL(req.url).searchParams.get('format') === 'json' ? 'json' : 'html';

  const supa = createServerClient();

  // Find institutionen (ejer via email, ellers medlem).
  const institution = await resolveInstitution(supa, user);

  if (!institution?.id) {
    return NextResponse.json({ error: 'Ingen institution fundet' }, { status: 403 });
  }

  const instId = institution.id;
  const instName = institution.name;

  // Hent alle relaterede data parallelt.
  const [
    { data: members },
    { data: listings },
    { data: orders },
    { data: conversations },
    { data: consentLog },
  ] = await Promise.all([
    supa.from('institution_members').select('*').eq('institution_id', instId),
    supa.from('listings').select('*').or(`user_id.eq.${user.id},institution_name.ilike."${instName}"`),
    supa.from('orders').select('*')
      .or(`buyer_institution_id.eq.${instId},buyer_id.eq.${user.id}`)
      .order('created_at', { ascending: false }).limit(500),
    supa.from('conversations').select('*')
      .or(`owner_institution_id.eq.${instId},initiator_institution_id.eq.${instId}`)
      .order('created_at', { ascending: false }).limit(500),
    supa.from('consent_log').select('*').eq('institution_id', instId)
      .order('changed_at', { ascending: false }),
  ]);

  // Ordrer hvor institutionen er SÆLGER ligger i order_groups (JSONB) —
  // filtreres client-side jf. arkitektur-konventionen.
  const sellerOrders = await supa.from('orders')
    .select('*')
    .in('status', ['paid', 'shipped', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(500);
  const asSeller = (sellerOrders.data || [])
    .filter(o => (o.order_groups || []).some(g =>
      g.sellerInstitutionId === instId || g.sellerId === user.id))
    .map(o => o.id);

  const exportData = {
    _meta: {
      genereret:    new Date().toISOString(),
      beskrivelse:  'Eksport af personoplysninger fra byt&leg (GDPR art. 15 & 20).',
      dataansvarlig:'byt&leg',
      bruger_id:    user.id,
      bruger_email: user.email,
    },
    institution,
    medarbejdere:        members || [],
    opslag:              listings || [],
    ordrer_som_koeber:   orders || [],
    ordre_ids_som_saelger: asSeller,
    samtaler:            conversations || [],
    samtykke_historik:   consentLog || [],
  };

  const base = `bytogleg-data-${instName?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'eksport'}-${new Date().toISOString().slice(0, 10)}`;

  // Registrér hentningen i downloadhistorikken (append-only, kan ikke
  // forfalskes fra klienten). Fejler logningen, blokerer vi ikke selve
  // eksporten — brugerens ret til indsigt vægter højere.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null;
  const { error: logErr } = await supa.from('data_export_log').insert({
    institution_id: instId,
    exported_by:    user.id,
    format,
    ip_address:     ip,
    user_agent:     userAgent,
  });
  if (logErr) console.error('[gdpr/export] log-fejl:', logErr);

  if (format === 'json') {
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}.json"`,
      },
    });
  }

  // Standard: pæn HTML-rapport leveret som en fil, brugeren kan gemme og
  // genåbne (i stedet for en flygtig printdialog).
  return new NextResponse(gdprExportHtml(exportData), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${base}.html"`,
    },
  });
}
