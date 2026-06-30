// Server-side CO2-persistering til handler afsluttet i Stripe-webhooken.
// Bruger institutionernes CACHEDE koordinater + haversine (ingen geocoding/
// routing-netværkskald i webhooken). Klient-flowet (MessagesClient) har sin
// egen variant med OSRM-routing; denne er en robust, netværksfri pendant.
//
// Dækker ALLE handelstyper: køb, bud (byd) og bytte (byt). Er idempotent —
// én handel (= én samtale) registreres præcis én gang, så et webhook-retry
// eller et samtidigt klient-kald aldrig dobbelt-tæller.

import { calculateCO2Savings } from './calculator';
import { EMISSION_FACTORS, METHODOLOGY_VERSION } from './emission-factors';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Indlæser de AKTIVE emissions-faktorer + metodologi-parametre fra databasen,
// så admin-redigering (/admin/co2-config) faktisk slår igennem. Fejler kaldet,
// returneres null og beregningen falder tilbage til de hardcodede v1.0-værdier.
async function loadCO2Config(supa) {
  try {
    const [factorsRes, versionRes] = await Promise.all([
      supa.from('co2_emission_factors').select('id, co2_kg_per_unit, source_ids, active'),
      supa.from('co2_methodology_versions').select('*').eq('active', true).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
    ]);

    let factors = null;
    const rows = factorsRes.data;
    if (Array.isArray(rows) && rows.length) {
      factors = {};
      for (const r of rows) {
        if (r.active === false) continue;
        factors[r.id] = { co2KgPerUnit: Number(r.co2_kg_per_unit), sources: r.source_ids || [] };
      }
      if (!factors.other) factors.other = EMISSION_FACTORS.other; // sikr fallback-kategori
    }

    let methodology = null;
    const v = versionRes.data;
    if (v) {
      methodology = {
        version:          v.version || METHODOLOGY_VERSION,
        displacementRate: Number(v.displacement_rate),
        transportKgPerKm: Number(v.transport_emission_g_per_km) / 1000,
        routeBuffer:      Number(v.route_buffer_factor) || undefined,
        defaultDistanceKm: Number(v.default_distance_km) || undefined,
      };
    }

    return { factors, methodology };
  } catch (err) {
    console.error('[CO2] loadCO2Config failed (using hardcoded fallback):', err?.message);
    return { factors: null, methodology: null };
  }
}

/**
 * Registrér CO2-besparelse for én gennemført handel (køb/byd/byt).
 * Summerer pr. handlet vare (konservativt mht. transport for bundter).
 * Idempotent: findes der allerede en række for samtalen, gøres intet.
 * Non-fatal — kaster aldrig, blokerer aldrig handelsflowet.
 *
 * @param {object} supa - service-role Supabase-klient
 * @param {{ transactionId, dealType?, sellerInstId?, buyerInstId?, sellerName?, buyerName?, categoryIds? }} params
 */
export async function persistTransactionCO2(supa, { transactionId, dealType = 'køb', sellerInstId, buyerInstId, sellerName, buyerName, categoryIds }) {
  try {
    if (!transactionId) return;

    // Idempotens: registrér hver samtale præcis én gang. Forhindrer dobbelt-
    // tælling når både klient og webhook (eller et retry) rammer samme handel.
    const { data: existing } = await supa
      .from('transaction_co2_savings')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();
    if (existing) return;

    const [{ data: o }, { data: i }] = await Promise.all([
      sellerInstId ? supa.from('institutions').select('latitude, longitude').eq('id', sellerInstId).maybeSingle() : Promise.resolve({ data: null }),
      buyerInstId  ? supa.from('institutions').select('latitude, longitude').eq('id', buyerInstId).maybeSingle()  : Promise.resolve({ data: null }),
    ]);

    let distanceKm = null;
    if (o?.latitude && i?.latitude) {
      const raw = haversineKm(o.latitude, o.longitude, i.latitude, i.longitude);
      distanceKm = raw >= 0.5 ? raw : 3;
    }

    const { factors, methodology } = await loadCO2Config(supa);
    const opts = {};
    if (factors)     opts.factors = factors;
    if (methodology) opts.methodology = methodology;

    const cats = (categoryIds && categoryIds.length) ? categoryIds : [null];
    let net = 0;
    let primary = null;
    for (const c of cats) {
      const r = calculateCO2Savings({ categoryId: c, distanceKm, isRoutedDistance: false, ...opts });
      net += r.netSavedKg;
      if (!primary) primary = r;
    }
    net = Math.round(net * 10) / 10;
    const breakdown = { ...(primary?.breakdown || {}), dealType, aggregated: cats.length > 1, itemCount: cats.length };

    const { error } = await supa.from('transaction_co2_savings').insert({
      transaction_id:        transactionId,
      listing_category_id:   primary?.breakdown?.categoryId || 'other',
      net_saved_kg:          net,
      breakdown,
      methodology_version:   primary?.methodologyVersion || METHODOLOGY_VERSION,
      calculated_at:         primary?.calculatedAt || new Date().toISOString(),
      seller_institution_id: sellerInstId || null,
      buyer_institution_id:  buyerInstId || null,
      seller_name:           sellerName || null,
      buyer_name:            buyerName || null,
    });

    // 23505 = unique-violation: et samtidigt kald nåede at indsætte først. Det er
    // ikke en fejl — handlen er registreret. Andre fejl logges (non-fatal).
    if (error && error.code !== '23505') {
      console.error('[CO2] persistTransactionCO2 insert failed (non-fatal):', error.message);
      return;
    }
    if (error) return; // dublet — undlad at overskrive samtale-summen

    await supa.from('conversations').update({ co2_net_saved_kg: net, co2_breakdown: breakdown }).eq('id', transactionId);
  } catch (err) {
    console.error('[CO2] persistTransactionCO2 failed (non-fatal):', err?.message);
  }
}

// Bagudkompatibelt alias for byttehandler (bevarer eksisterende kald-signatur).
export async function persistSwapCO2(supa, { transactionId, ownerInstId, initiatorInstId, ownerName, initiatorName, categoryIds }) {
  return persistTransactionCO2(supa, {
    transactionId,
    dealType: 'byt',
    sellerInstId: ownerInstId,
    buyerInstId: initiatorInstId,
    sellerName: ownerName,
    buyerName: initiatorName,
    categoryIds,
  });
}
