// Server-side CO2-persistering til bytter afsluttet i Stripe-webhooken.
// Bruger institutionernes CACHEDE koordinater + haversine (ingen geocoding/
// routing-netværkskald i webhooken). Klient-flowet (MessagesClient) har sin
// egen variant med OSRM-routing; denne er en robust, netværksfri pendant.

import { calculateCO2Savings } from './calculator';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Registrér CO2-besparelse for et gennemført bytte. Summerer pr. byttet vare
// (konservativt mht. transport for bundter). Non-fatal — blokerer aldrig.
export async function persistSwapCO2(supa, { transactionId, ownerInstId, initiatorInstId, ownerName, initiatorName, categoryIds }) {
  try {
    const [{ data: o }, { data: i }] = await Promise.all([
      ownerInstId ? supa.from('institutions').select('latitude, longitude').eq('id', ownerInstId).maybeSingle() : Promise.resolve({ data: null }),
      initiatorInstId ? supa.from('institutions').select('latitude, longitude').eq('id', initiatorInstId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    let distanceKm = null;
    if (o?.latitude && i?.latitude) {
      const raw = haversineKm(o.latitude, o.longitude, i.latitude, i.longitude);
      distanceKm = raw >= 0.5 ? raw : 3;
    }

    const cats = (categoryIds && categoryIds.length) ? categoryIds : [null];
    let net = 0;
    let primary = null;
    for (const c of cats) {
      const r = calculateCO2Savings({ categoryId: c, distanceKm, isRoutedDistance: false });
      net += r.netSavedKg;
      if (!primary) primary = r;
    }
    net = Math.round(net * 10) / 10;
    const breakdown = { ...(primary?.breakdown || {}), aggregated: cats.length > 1, itemCount: cats.length };

    await Promise.all([
      supa.from('transaction_co2_savings').insert({
        transaction_id: transactionId,
        listing_category_id: primary?.breakdown?.categoryId || 'other',
        net_saved_kg: net,
        breakdown,
        methodology_version: primary?.methodologyVersion,
        calculated_at: primary?.calculatedAt || new Date().toISOString(),
        seller_institution_id: ownerInstId || null,
        buyer_institution_id: initiatorInstId || null,
        seller_name: ownerName || null,
        buyer_name: initiatorName || null,
      }),
      supa.from('conversations').update({ co2_net_saved_kg: net, co2_breakdown: breakdown }).eq('id', transactionId),
    ]);
  } catch (err) {
    console.error('[CO2] persistSwapCO2 failed (non-fatal):', err?.message);
  }
}
