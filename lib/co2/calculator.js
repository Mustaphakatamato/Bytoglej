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
 * @param {{ categoryId: string, distanceKm: number|null }} params
 * @returns {{ netSavedKg, breakdown, methodologyVersion, calculatedAt }}
 */
export function calculateCO2Savings({ categoryId, distanceKm, isRoutedDistance = false }) {
  const resolvedId = EMISSION_FACTORS[categoryId]
    ? categoryId
    : (LEGACY_CATEGORY_MAP[categoryId] || 'other');

  const factor = EMISSION_FACTORS[resolvedId] || EMISSION_FACTORS['other'];

  const distanceEstimated = distanceKm == null || distanceKm <= 0;
  const rawDistance       = distanceEstimated ? DEFAULT_DISTANCE_KM : distanceKm;
  // Når vi har faktisk kørselsafstand fra OSRM bruges ingen buffer
  const routeBuffer       = isRoutedDistance ? 1.0 : ROUTE_BUFFER;
  const routedDistance    = rawDistance * routeBuffer;

  const productionSavedKg = factor.co2KgPerUnit * DISPLACEMENT_RATE;
  const transportCostKg   = routedDistance * TRANSPORT_KG_PER_KM * 2; // × 2: tur/retur
  const netSavedKg        = Math.max(0, productionSavedKg - transportCostKg);

  return {
    netSavedKg: round1(netSavedKg),
    breakdown: {
      categoryId:         resolvedId,
      categoryFactor:     factor.co2KgPerUnit,
      productionSavedKg:  round2(productionSavedKg),
      transportCostKg:    round2(transportCostKg),
      displacementRate:   DISPLACEMENT_RATE,
      transportFactor:    TRANSPORT_KG_PER_KM,
      routeBuffer,
      distanceKm:         round1(routedDistance),
      rawDistanceKm:      rawDistance,
      distanceEstimated,
      distanceSource:     isRoutedDistance ? 'osrm' : (distanceEstimated ? 'default' : 'haversine'),
      sources:            factor.sources,
    },
    methodologyVersion: METHODOLOGY_VERSION,
    calculatedAt: new Date().toISOString(),
  };
}

/** Hverdagssammenligning — vis altid mindst én ved siden af CO2-tal */
export function getCO2Comparison(kg) {
  if (!kg || kg <= 0) return null;
  if (kg < 3)   return `≈ ${Math.round(kg * 6)} km kørsel i bil`;
  if (kg < 12)  return `≈ ${Math.round(kg * 6)} km kørsel i bil`;
  if (kg < 20)  return `≈ ${(kg / 10).toFixed(1)} bomulds-t-shirts produceret`;
  if (kg < 60)  return `≈ ${Math.round(kg * 6)} km kørsel i bil`;
  if (kg < 120) return `≈ ${Math.round(kg / 50)} flyrejse${kg >= 100 ? 'r' : ''} København–Aarhus`;
  return `≈ ${(kg / 100).toFixed(1)} års elforbrug for en LED-pære (4t/dag)`;
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
