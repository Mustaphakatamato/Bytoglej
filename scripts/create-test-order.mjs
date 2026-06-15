/**
 * Opretter en test-ordre i sandbox for musta_2670@hotmail.com (sælger).
 * Booker sandbox-forsendelse → henter label → uploader til Supabase Storage →
 * indsætter ordre med status 'shipped' så sælger kan downloade label på /mine-opgaver.
 *
 * Kør med: node scripts/create-test-order.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
readFileSync(resolve(__dir, '../.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .forEach(l => { const [k, ...v] = l.split('='); process.env[k.trim()] = v.join('=').trim(); });

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHIPMONDO_URL = process.env.SHIPMONDO_BASE_URL;
const SHIP_USER     = process.env.SHIPMONDO_API_USER;
const SHIP_KEY      = process.env.SHIPMONDO_API_KEY;

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, SHIPMONDO_URL, SHIP_USER, SHIP_KEY })) {
  if (!v) { console.error(`❌ Mangler ${k} i .env.local`); process.exit(1); }
}

const shipHeaders = {
  Authorization: 'Basic ' + Buffer.from(`${SHIP_USER}:${SHIP_KEY}`).toString('base64'),
  'Content-Type': 'application/json',
};
const supaHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Sælger = musta_2670@hotmail.com (ASD 234 ApS)
const SELLER = {
  id:            'a3ab1665-4d67-4119-82e5-daaa1f8f67a6',
  institutionId: '660c77c2-bb1d-49cd-a293-be2a9c798c92',
  name:          'ASD 234 ApS',
  email:         'musta_2670@hotmail.com',
  phone:         '28775050',
  address:       'Høje Gladsaxe 43, 3. th.',
  zip:           '2860',
  city:          'Søborg',
};

const BUYER = {
  name:    'Testkøber Børnehave',
  email:   'mustaphakatamato@gmail.com',
  address: 'Hundige Strandvej 55',
  zip:     '2670',
  city:    'Greve',
  phone:   '12345678',
};

async function main() {
  console.log(`🔗 Shipmondo: ${SHIPMONDO_URL}`);
  console.log(`📦 Booker testforsendelse (PostNord pakkeshop, 0-1 kg)...\n`);

  // 1. Book sandbox-forsendelse
  const shipRes = await fetch(`${SHIPMONDO_URL}/shipments`, {
    method: 'POST',
    headers: shipHeaders,
    body: JSON.stringify({
      own_agreement: false,
      product_code: 'PDK_MC',
      service_codes: 'EMAIL_NT',
      reference: 'TEST-ORDER-' + Date.now(),
      parcels: [{ weight: 500, length: 30, width: 20, height: 15 }],
      sender: { name: SELLER.name, address1: SELLER.address, zipcode: SELLER.zip, city: SELLER.city, country_code: 'DK', email: SELLER.email, mobile: SELLER.phone },
      receiver: { name: BUYER.name, address1: BUYER.address, zipcode: BUYER.zip, city: BUYER.city, country_code: 'DK', email: BUYER.email, mobile: BUYER.phone },
      automatic_select_service_point: true,
    }),
  });
  if (!shipRes.ok) { console.error('❌ Booking fejlede:', await shipRes.text()); process.exit(1); }
  const shipment = await shipRes.json();
  const shipmondoId = String(shipment.id);
  const trackingNumber = shipment.packages?.[0]?.pkg_no ?? shipment.pkg_no ?? null;
  console.log(`✅ Booket — Shipmondo ID ${shipmondoId}, tracking ${trackingNumber}`);

  // 2. Hent label
  const labelRes = await fetch(`${SHIPMONDO_URL}/shipments/${shipmondoId}/labels`, { headers: shipHeaders });
  if (!labelRes.ok) { console.error('❌ Label-hentning fejlede:', await labelRes.text()); process.exit(1); }
  const labelData = await labelRes.json();
  const base64 = labelData?.[0]?.base64;
  if (!base64) { console.error('❌ Ingen label modtaget'); process.exit(1); }
  console.log(`✅ Label hentet (${Math.round(base64.length / 1024)} KB)`);

  // 3. Upload til Supabase Storage
  const labelPath = `${shipmondoId}.pdf`;
  const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/shipping-labels/${labelPath}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: Buffer.from(base64, 'base64'),
  });
  if (!upRes.ok) { console.error('❌ Storage-upload fejlede:', await upRes.text()); process.exit(1); }
  const labelUrl = `${SUPABASE_URL}/storage/v1/object/public/shipping-labels/${labelPath}`;
  console.log(`✅ Label uploadet → ${labelUrl}`);

  // 4. Indsæt test-ordre
  const orderGroup = {
    note: null,
    items: [{ emoji: '🧸', price: 99, title: 'TEST: Bamse til labeltest', category: 'plush-small', listingId: null, sizeCategory: '1000' }],
    sellerId: SELLER.id,
    itemTotal: 99,
    sellerZip: SELLER.zip,
    groupTotal: 99 + 34.8 + 5,
    sellerCity: SELLER.city,
    sellerName: SELLER.name,
    serviceFee: 5,
    pickupPoint: { id: '95672', name: 'Kioskland', address: 'Greve Midtby Center 10b, 2670, Greve' },
    sellerEmail: SELLER.email,
    sellerPhone: SELLER.phone,
    tracking_url: shipment.tracking_link ?? null,
    label_pdf_url: labelUrl,
    sellerAddress: SELLER.address,
    shippingTotal: 34.8,
    shippingMethod: 'parcel_shop_gls',
    tracking_number: trackingNumber,
    sellerInstitutionId: SELLER.institutionId,
    shipmondo_shipment_id: shipmondoId,
  };

  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: { ...supaHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({
      payment_intent_id: 'pi_test_' + Date.now(),
      buyer_id: null,
      buyer_name: BUYER.name,
      buyer_email: BUYER.email,
      buyer_address: BUYER.address,
      buyer_zip: BUYER.zip,
      buyer_city: BUYER.city,
      buyer_phone: BUYER.phone,
      grand_total: 138.8,
      status: 'shipped',
      order_groups: [orderGroup],
      shipmondo_shipment_id: shipmondoId,
      tracking_number: trackingNumber,
      tracking_url: shipment.tracking_link ?? null,
      label_pdf_url: labelUrl,
      paid_at: new Date().toISOString(),
      shipped_at: new Date().toISOString(),
    }),
  });
  if (!orderRes.ok) { console.error('❌ Ordre-indsættelse fejlede:', await orderRes.text()); process.exit(1); }
  const [order] = await orderRes.json();

  console.log(`\n✅ Test-ordre oprettet: ${order.id}`);
  console.log(`\n👉 Log ind som ${SELLER.email} og gå til /mine-opgaver`);
  console.log(`   Du skulle nu se ordren med en "🖨️ Download pakkemærkat (PDF)" knap.`);
}

main().catch(e => { console.error('Fejl:', e); process.exit(1); });
