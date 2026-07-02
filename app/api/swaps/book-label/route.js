import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution } from '@/lib/institution-server';
import { createShipment, fetchShipmentLabel } from '@/lib/shipmondo/client';

// (Gen)genererer pakkemærkaten for kalderens UDGÅENDE bundt i en byttehandel.
// Parallelt med købs-flowets /api/seller-orders/book-label — så en part aldrig
// sidder fast uden mærkat, hvis den automatiske booking ved betaling fejlede.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }
  const proposalId = body.proposalId;
  if (!proposalId) return NextResponse.json({ error: 'Mangler forslag' }, { status: 400 });

  const supa = createServerClient();
  const { data: p } = await supa.from('swap_proposals')
    .select('*').eq('id', proposalId).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Byttehandlen findes ikke' }, { status: 404 });

  const inst = await resolveCallerInstitution(supa, user);
  const myInstId = inst?.id || null;

  let party = null;
  if (p.initiator_id === user.id || (myInstId && p.initiator_institution_id === myInstId)) party = 'initiator';
  else if (myInstId && p.owner_institution_id === myInstId) party = 'owner';
  if (!party) return NextResponse.json({ error: 'Du er ikke en del af denne byttehandel' }, { status: 403 });

  if (p.escrow_status !== 'both_paid_released') {
    return NextResponse.json({ error: 'Byttehandlen er ikke betalt af begge parter endnu' }, { status: 400 });
  }

  const isInit = party === 'initiator';
  // Min udgående bundt → modtages af modparten. Modpartens leveringsvalg afgør
  // om der overhovedet skal en label (custom = aftalt levering, ingen label).
  const recipientDelivery = isInit ? p.owner_delivery : p.initiator_delivery;
  if (recipientDelivery === 'custom') {
    return NextResponse.json({ error: 'Denne del leveres efter aftale — ingen pakkemærkat' }, { status: 400 });
  }

  const shipmentField  = isInit ? 'initiator_shipment_id' : 'owner_shipment_id';
  const myShipmentId   = p[shipmentField];
  const myInstitutionId  = isInit ? p.initiator_institution_id : p.owner_institution_id;
  const recipientInstId  = isInit ? p.owner_institution_id : p.initiator_institution_id;
  const recipientPickup  = isInit ? p.owner_pickup : p.initiator_pickup;
  const myBundle       = isInit ? (p.offered_items || []) : (p.requested_items || []);

  // 1. Findes labelen allerede?
  if (myShipmentId) {
    const { data: sh } = await supa.from('shipments')
      .select('id, label_pdf_url, tracking_number, tracking_url, shipmondo_shipment_id')
      .eq('id', myShipmentId).maybeSingle();
    if (sh?.label_pdf_url) {
      return NextResponse.json({ ok: true, label_pdf_url: sh.label_pdf_url, tracking_number: sh.tracking_number, tracking_url: sh.tracking_url });
    }
    // 2. Forsendelse booket men label mangler → hent labelen (ingen ny booking).
    if (sh?.shipmondo_shipment_id) {
      try {
        const labelUrl = await fetchShipmentLabel(sh.shipmondo_shipment_id);
        if (!labelUrl) return NextResponse.json({ error: 'Labelen er endnu ikke klar hos Shipmondo. Prøv igen om lidt.' }, { status: 502 });
        await supa.from('shipments').update({ label_pdf_url: labelUrl }).eq('id', sh.id);
        return NextResponse.json({ ok: true, label_pdf_url: labelUrl, tracking_number: sh.tracking_number, tracking_url: sh.tracking_url });
      } catch (e) {
        return NextResponse.json({ error: `Pakkemærkat kunne ikke hentes: ${e.message}` }, { status: 502 });
      }
    }
  }

  // 3. Ingen forsendelse → book den nu.
  const [{ data: senderInst }, { data: receiverInst }] = await Promise.all([
    supa.from('institutions').select('*').eq('id', myInstitutionId).maybeSingle(),
    supa.from('institutions').select('*').eq('id', recipientInstId).maybeSingle(),
  ]);
  if (!senderInst || !receiverInst) {
    return NextResponse.json({ error: 'Institutionsoplysninger mangler' }, { status: 400 });
  }

  // Bundtstørrelse: største kategori blandt mine varer (matcher swapBundleSize).
  const RANK = { small: 1, medium: 2, large: 3 };
  const listingIds = myBundle.map(i => i.listing_id).filter(Boolean);
  let sizeCategory = 'medium', rank = 0;
  if (listingIds.length) {
    const { data: so } = await supa.from('shipping_options').select('shipping_size_category').in('listing_id', listingIds);
    for (const s of (so || [])) {
      const r = RANK[s.shipping_size_category] || 2;
      if (r > rank) { rank = r; sizeCategory = s.shipping_size_category; }
    }
  }

  try {
    const result = await createShipment({
      sender:   { name: senderInst.name,   address: senderInst.address || 'Ukendt', zip_code: senderInst.zipcode || '2100', city: senderInst.city || 'København', country_code: 'DK', email: senderInst.email, phone: senderInst.phone || '' },
      receiver: { name: receiverInst.name, address: receiverInst.address || 'Ukendt', zip_code: receiverInst.zipcode || '2100', city: receiverInst.city || 'København', country_code: 'DK', email: receiverInst.email, phone: receiverInst.phone || '' },
      carrier: 'gls', service_type: 'parcel_shop', size_category: sizeCategory,
      reference: p.conversation_id || proposalId,
      pickup_point_id: recipientPickup?.id || null,
    });

    const { data: shipment, error: shipErr } = await supa.from('shipments').insert({
      conversation_id: p.conversation_id,
      swap_proposal_id: proposalId,
      seller_institution_id: senderInst.id,
      buyer_institution_id: receiverInst.id,
      shipmondo_shipment_id: result.shipmondo_shipment_id,
      carrier: 'gls', service_type: 'parcel_shop', size_category: sizeCategory,
      cost_dkk: result.price_dkk,
      markup_dkk: 0,
      total_charged_to_seller_dkk: 0,
      prepaid: true,
      tracking_number: result.tracking_number,
      tracking_url: result.tracking_url,
      label_pdf_url: result.label_pdf_url,
      status: 'booked',
      booked_at: new Date().toISOString(),
    }).select().single();
    if (shipErr) throw new Error(shipErr.message);

    await supa.from('swap_proposals').update({ [shipmentField]: shipment.id }).eq('id', proposalId);

    return NextResponse.json({
      ok: true,
      label_pdf_url:   result.label_pdf_url,
      tracking_number: result.tracking_number,
      tracking_url:    result.tracking_url,
    });
  } catch (e) {
    console.error('[swaps/book-label] fejl:', e.message);
    return NextResponse.json({ error: `Pakkemærkat kunne ikke oprettes: ${e.message}` }, { status: 502 });
  }
}
