// CO2 Besparelsesberegner — Metode v1.0
// Se /baeredygtighed/metode og docs/CO2_METHODOLOGY.md for fuld dokumentation.
//
// FORMEL:
//   produktion_sparet = kategori_co2 × DISPLACEMENT_RATE
//   transport_omkostning = (distance × ROUTE_BUFFER × 2) × TRANSPORT_KG_PER_KM
//   netto_sparet = max(0, produktion_sparet − transport_omkostning)

import { EMISSION_FACTORS, LEGACY_CATEGORY_MAP, METHODOLOGY_VERSION } from './emission-factors';

const DISPLACEMENT_RATE       = 0.6;   // konservativt estimat, range 0.5–0.9 (S3, S6, S7)
const TRANSPORT_KG_PER_KM     = 0.170; // EU gennemsnitlig bil real-world (EEA 2024, S8)
const ROUTE_BUFFER            = 1.3;   // 30% buffer: haversine → faktisk kørselsrute
const DEFAULT_DISTANCE_KM     = 10;    // typisk afstand inden for samme kommune

/**
 * Beregner estimeret CO2-besparelse for én handel.
 *
 * `factors` og `methodology` er valgfrie overrides: bruges de ikke, falder
 * beregningen tilbage til de hardcodede v1.0-værdier. Server-flowet sender
 * de aktive værdier fra `co2_emission_factors` / `co2_methodology_versions`
 * ind her, så admin-redigering faktisk får effekt på fremtidige handler.
 *
 * @param {{
 *   categoryId: string,
 *   distanceKm: number|null,
 *   isRoutedDistance?: boolean,
 *   factors?: Record<string,{co2KgPerUnit:number,sources?:string[]}>,
 *   methodology?: { version?, displacementRate?, transportKgPerKm?, routeBuffer?, defaultDistanceKm? }
 * }} params
 * @returns {{ netSavedKg, breakdown, methodologyVersion, calculatedAt }}
 */
export function calculateCO2Savings({ categoryId, distanceKm, isRoutedDistance = false, factors, methodology }) {
  const fac = factors || EMISSION_FACTORS;
  const m   = methodology || {};
  const displacementRate    = m.displacementRate   ?? DISPLACEMENT_RATE;
  const transportKgPerKm    = m.transportKgPerKm    ?? TRANSPORT_KG_PER_KM;
  const routeBufferDefault  = m.routeBuffer         ?? ROUTE_BUFFER;
  const defaultDistanceKm   = m.defaultDistanceKm   ?? DEFAULT_DISTANCE_KM;
  const methodologyVersion  = m.version             ?? METHODOLOGY_VERSION;

  const resolvedId = fac[categoryId]
    ? categoryId
    : (fac[LEGACY_CATEGORY_MAP[categoryId]] ? LEGACY_CATEGORY_MAP[categoryId] : 'other');

  const factor = fac[resolvedId] || fac['other'] || EMISSION_FACTORS['other'];

  const distanceEstimated = distanceKm == null || distanceKm <= 0;
  const rawDistance       = distanceEstimated ? defaultDistanceKm : distanceKm;
  // Når vi har faktisk kørselsafstand fra OSRM bruges ingen buffer
  const routeBuffer       = isRoutedDistance ? 1.0 : routeBufferDefault;
  const routedDistance    = rawDistance * routeBuffer;

  const productionSavedKg = factor.co2KgPerUnit * displacementRate;
  const transportCostKg   = routedDistance * transportKgPerKm * 2; // × 2: tur/retur
  const netSavedKg        = Math.max(0, productionSavedKg - transportCostKg);

  return {
    netSavedKg: round1(netSavedKg),
    breakdown: {
      categoryId:         resolvedId,
      categoryFactor:     factor.co2KgPerUnit,
      productionSavedKg:  round2(productionSavedKg),
      transportCostKg:    round2(transportCostKg),
      displacementRate,
      transportFactor:    transportKgPerKm,
      routeBuffer,
      distanceKm:         round1(routedDistance),
      rawDistanceKm:      rawDistance,
      distanceEstimated,
      distanceSource:     isRoutedDistance ? 'osrm' : (distanceEstimated ? 'default' : 'haversine'),
      sources:            factor.sources || [],
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
