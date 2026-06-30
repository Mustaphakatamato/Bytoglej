// CO2 Besparelsesberegner — Metode v1.1
// Se /baeredygtighed/metode og docs/CO2_METHODOLOGY.md for fuld dokumentation.
//
// FORMEL (v1.1):
//   produktion_sparet    = Σ (kategori_co2 × DISPLACEMENT_RATE)   // summeret over varer i forsendelsen
//   transport_omkostning = PARCEL_CO2_KG                          // fast pr. forsendelse (pakkenetværk)
//   netto_sparet         = max(0, produktion_sparet − transport_omkostning)
//
// Ændring fra v1.0: transport modelleres nu som en faktisk konsolideret PAKKE
// (~200 g/forsendelse, last-mile pakkedata), trukket fra ÉN gang pr. handel —
// ikke som en privatbil tur/retur pr. vare. Displacement sænket til 0,4 på linje
// med Vinted/Vaayu (39–40%). Begge ændringer matcher branchens konsekvens-LCA.

import { EMISSION_FACTORS, LEGACY_CATEGORY_MAP, METHODOLOGY_VERSION } from './emission-factors';

const DISPLACEMENT_RATE = 0.4;   // andel af handler der reelt erstatter et nyt køb (Vinted/Vaayu: 0,39–0,40, S6/S9)
const PARCEL_CO2_KG     = 0.2;   // gennemsnitlig last-mile pakkeemission, ~200 g (pakkeshop/PUDO, S10)

/**
 * Beregner estimeret CO2-besparelse for én handel (én forsendelse).
 *
 * Accepterer enten `categoryId` (én vare) eller `categoryIds` (bundt/flere varer).
 * For bundter summeres produktionsbesparelsen over alle varer, mens transporten
 * kun trækkes fra ÉN gang — varerne sendes i samme forsendelse.
 *
 * `factors`/`methodology` er valgfrie DB-drevne overrides (admin-config); uden
 * dem bruges de hardcodede v1.1-værdier.
 *
 * @param {{
 *   categoryId?: string,
 *   categoryIds?: string[],
 *   factors?: Record<string,{co2KgPerUnit:number,sources?:string[]}>,
 *   methodology?: { version?, displacementRate?, parcelCo2Kg? }
 * }} params
 * @returns {{ netSavedKg, breakdown, methodologyVersion, calculatedAt }}
 */
export function calculateCO2Savings({ categoryId, categoryIds, factors, methodology } = {}) {
  const fac = factors || EMISSION_FACTORS;
  const m   = methodology || {};
  const displacementRate   = m.displacementRate ?? DISPLACEMENT_RATE;
  const parcelCo2Kg        = m.parcelCo2Kg      ?? PARCEL_CO2_KG;
  const methodologyVersion = m.version          ?? METHODOLOGY_VERSION;

  const list = (Array.isArray(categoryIds) && categoryIds.length) ? categoryIds : [categoryId];

  const resolve = (id) => fac[id]
    ? id
    : (fac[LEGACY_CATEGORY_MAP[id]] ? LEGACY_CATEGORY_MAP[id] : 'other');

  let productionSavedKg = 0;
  let primaryFactor = null;
  let primaryId = null;
  for (const id of list) {
    const rid = resolve(id);
    const f = fac[rid] || fac['other'] || EMISSION_FACTORS['other'];
    productionSavedKg += f.co2KgPerUnit * displacementRate;
    if (primaryFactor == null) { primaryFactor = f; primaryId = rid; }
  }

  const transportCostKg = parcelCo2Kg;            // én forsendelse, distance-uafhængig (pakkenetværk-gennemsnit)
  const netSavedKg      = Math.max(0, productionSavedKg - transportCostKg);

  return {
    netSavedKg: round1(netSavedKg),
    breakdown: {
      categoryId:        primaryId || 'other',
      categoryFactor:    primaryFactor ? primaryFactor.co2KgPerUnit : EMISSION_FACTORS['other'].co2KgPerUnit,
      productionSavedKg: round2(productionSavedKg),
      transportCostKg:   round2(transportCostKg),
      displacementRate,
      parcelEmissionKg:  parcelCo2Kg,
      itemCount:         list.length,
      aggregated:        list.length > 1,
      transportModel:    'parcel',
      sources:           (primaryFactor && primaryFactor.sources) || [],
    },
    methodologyVersion,
    calculatedAt: new Date().toISOString(),
  };
}

/** Hverdagssammenligning — vis altid mindst én ved siden af CO2-tal */
export function getCO2Comparison(kg) {
  if (!kg || kg <= 0) return null;
  if (kg < 5)   return `≈ ${Math.round(kg * 6)} km kørsel i personbil`;
  if (kg < 15)  return `≈ ${Math.round(kg * 6)} km kørsel i personbil`;
  if (kg < 30)  return `≈ ${Math.round(kg / 8)} bomulds-t-shirt${kg >= 16 ? 's' : ''} produceret`;
  if (kg < 80)  return `≈ ${Math.round(kg * 6)} km kørsel i personbil`;
  if (kg < 200) return `≈ ${(kg / 90).toFixed(1)} flyrejse${kg >= 180 ? 'r' : ''} København–London (én vej)`;
  return `≈ ${(kg / 200).toFixed(1)} tur-retur flyrejser til Mallorca`;
}

/** Aggregér array af netSavedKg-værdier til institutionsstatistik */
export function aggregateSavings(savingsRows) {
  const total    = savingsRows.reduce((sum, r) => sum + (r.net_saved_kg || 0), 0);
  const count    = savingsRows.length;
  const thisYear = savingsRows.filter(r => new Date(r.calculated_at).getFullYear() === new Date().getFullYear())
                              .reduce((sum, r) => sum + (r.net_saved_kg || 0), 0);
  const lastYear = savingsRows.filter(r => new Date(r.calculated_at).getFullYear() === new Date().getFullYear() - 1)
                              .reduce((sum, r) => sum + (r.net_saved_kg || 0), 0);
  return { total: round1(total), thisYear: round1(thisYear), lastYear: round1(lastYear), count };
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
