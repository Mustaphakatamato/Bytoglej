// Server-side CO2-persistering til handler afsluttet i Stripe-webhooken.
//
// Metode v1.1: transporten modelleres som én konsolideret pakke (fast emission,
// distance-uafhængig), så der er ingen geocoding/routing-netværkskald — hverken
// her eller i klienten. Produktionsbesparelsen summeres over varerne i handlen,
// og transporten trækkes fra ÉN gang (én forsendelse).
//
// Dækker ALLE handelstyper: køb, bud (byd) og bytte (byt). Er idempotent —
// én handel (= én samtale) registreres præcis én gang, så et webhook-retry
// eller et samtidigt klient-kald aldrig dobbelt-tæller.

import { calculateCO2Savings } from './calculator';
import { EMISSION_FACTORS, METHODOLOGY_VERSION } from './emission-factors';

// Indlæser de AKTIVE emissions-faktorer + metodologi-parametre fra databasen,
// så admin-redigering (/admin/co2-config) faktisk slår igennem. Fejler kaldet,
// returneres null og beregningen falder tilbage til de hardcodede v1.1-værdier.
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
        // parcel_emission_g er v1.1-kolonnen; uden den falder vi tilbage til default.
        parcelCo2Kg:      v.parcel_emission_g != null ? Number(v.parcel_emission_g) / 1000 : undefined,
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

    const { factors, methodology } = await loadCO2Config(supa);
    const opts = {};
    if (factors)     opts.factors = factors;
    if (methodology) opts.methodology = methodology;

    // Produktion summeres over varerne, transport trækkes fra én gang (én forsendelse).
    const cats = (categoryIds && categoryIds.length) ? categoryIds : [null];
    const result = calculateCO2Savings({ categoryIds: cats, ...opts });
    const net = result.netSavedKg;
    const breakdown = { ...result.breakdown, dealType };

    const { error } = await supa.from('transaction_co2_savings').insert({
      transaction_id:        transactionId,
      listing_category_id:   result.breakdown.categoryId || 'other',
      net_saved_kg:          net,
      breakdown,
      methodology_version:   result.methodologyVersion || METHODOLOGY_VERSION,
      calculated_at:         result.calculatedAt || new Date().toISOString(),
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
