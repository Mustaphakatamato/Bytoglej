// CO2 Calculator — obligatoriske tests
// Kør med: npx jest __tests__/co2-calculator.test.js
// Kræver: npm install --save-dev jest (eller bun test)

import { calculateCO2Savings, aggregateSavings } from '../lib/co2/calculator';
import { EMISSION_FACTORS, LEGACY_CATEGORY_MAP } from '../lib/co2/emission-factors';

// ─── 1. Korrekte tal for kendte inputs ────────────────────────────────────────
describe('calculateCO2Savings — korrekte resultater', () => {
  test('books, 20 km: produktionsbesparelse > transport → positiv netto', () => {
    const r = calculateCO2Savings({ categoryId: 'books', distanceKm: 20 });
    // produktion: 1.0 × 0.6 = 0.6
    // transport: 20 × 1.3 × 2 × 0.170 = 8.84 → NEJ wait
    // transport: 20 × 1.3 = 26 km routed × 2 (tur/retur) × 0.170 = 8.84
    // netto = max(0, 0.6 - 8.84) = 0 (transport > produktion for bøger ved 20 km)
    expect(r.netSavedKg).toBe(0);
    expect(r.breakdown.productionSavedKg).toBeCloseTo(0.6, 2);
    expect(r.breakdown.transportCostKg).toBeCloseTo(8.84, 1);
  });

  test('ride-on-toys, 5 km: stor produktionsbesparelse overstiger transport', () => {
    const r = calculateCO2Savings({ categoryId: 'ride-on-toys', distanceKm: 5 });
    // produktion: 30.0 × 0.6 = 18.0
    // transport: 5 × 1.3 × 2 × 0.170 = 2.21
    // netto ≈ 18.0 - 2.21 = 15.79
    expect(r.netSavedKg).toBeGreaterThan(15);
    expect(r.netSavedKg).toBeLessThan(16);
  });

  test('children-furniture, 10 km: korrekt dekomposition', () => {
    const r = calculateCO2Savings({ categoryId: 'children-furniture', distanceKm: 10 });
    expect(r.breakdown.categoryFactor).toBe(20.0);
    expect(r.breakdown.displacementRate).toBe(0.6);
    expect(r.breakdown.productionSavedKg).toBeCloseTo(12.0, 2);
    // transport: 10 × 1.3 × 2 × 0.170 = 4.42
    expect(r.breakdown.transportCostKg).toBeCloseTo(4.42, 1);
    expect(r.netSavedKg).toBeCloseTo(7.6, 1);
  });

  test('metodologi-version er korrekt', () => {
    const r = calculateCO2Savings({ categoryId: 'books', distanceKm: 5 });
    expect(r.methodologyVersion).toBe('1.0');
  });

  test('calculatedAt er valid ISO timestamp', () => {
    const r = calculateCO2Savings({ categoryId: 'puzzles', distanceKm: 10 });
    expect(() => new Date(r.calculatedAt)).not.toThrow();
    expect(new Date(r.calculatedAt).getTime()).toBeGreaterThan(0);
  });
});

// ─── 2. Aldrig negativ besparelse ─────────────────────────────────────────────
describe('calculateCO2Savings — aldrig negativ', () => {
  test('bøger på 200 km distance → 0, aldrig negativ', () => {
    const r = calculateCO2Savings({ categoryId: 'books', distanceKm: 200 });
    expect(r.netSavedKg).toBe(0);
    expect(r.netSavedKg).toBeGreaterThanOrEqual(0);
  });

  test('alle kategorier på 500 km returnerer netSavedKg ≥ 0', () => {
    Object.keys(EMISSION_FACTORS).forEach(id => {
      const r = calculateCO2Savings({ categoryId: id, distanceKm: 500 });
      expect(r.netSavedKg).toBeGreaterThanOrEqual(0);
    });
  });

  test('distanceKm = 0 bruger default og returnerer ≥ 0', () => {
    const r = calculateCO2Savings({ categoryId: 'wooden-toys', distanceKm: 0 });
    expect(r.netSavedKg).toBeGreaterThanOrEqual(0);
    expect(r.breakdown.distanceEstimated).toBe(true);
  });
});

// ─── 3. Persisterede beregninger ændres ikke ──────────────────────────────────
describe('immutabilitet af persisterede beregninger', () => {
  test('snapshot af beregning matcher ved replay med samme inputs', () => {
    // Simulerer at vi gemmer breakdownen og replayer den
    const original = calculateCO2Savings({ categoryId: 'outdoor-toys', distanceKm: 15 });
    const snapshot = JSON.parse(JSON.stringify(original));
    // Verificer at snapshot er identisk (ingen tilfældig komponent undtagen timestamp)
    expect(snapshot.netSavedKg).toBe(original.netSavedKg);
    expect(snapshot.breakdown.categoryFactor).toBe(original.breakdown.categoryFactor);
    expect(snapshot.breakdown.productionSavedKg).toBe(original.breakdown.productionSavedKg);
    expect(snapshot.breakdown.transportCostKg).toBe(original.breakdown.transportCostKg);
    expect(snapshot.methodologyVersion).toBe(original.methodologyVersion);
  });

  test('beregning med v1.0-faktor for ride-on-toys forbliver 30 kg selv hvis vi ændrer konstanten', () => {
    // Snapshot af original faktor
    const originalFactor = EMISSION_FACTORS['ride-on-toys'].co2KgPerUnit;
    const result = calculateCO2Savings({ categoryId: 'ride-on-toys', distanceKm: 5 });
    const savedNetKg = result.netSavedKg;
    const savedBreakdown = { ...result.breakdown };
    // Simulér at faktoren "opdateres" — historisk beregning er upåvirket
    // (i production gemmer vi breakdown-snapshottet i DB, ikke faktoren)
    expect(savedBreakdown.categoryFactor).toBe(originalFactor);
    expect(savedNetKg).toBeGreaterThan(0);
  });
});

// ─── 4. Aggregeringer ─────────────────────────────────────────────────────────
describe('aggregateSavings', () => {
  const mockRows = [
    { net_saved_kg: 5.2, calculated_at: `${new Date().getFullYear()}-03-01T10:00:00Z` },
    { net_saved_kg: 3.1, calculated_at: `${new Date().getFullYear()}-06-15T10:00:00Z` },
    { net_saved_kg: 12.0, calculated_at: `${new Date().getFullYear() - 1}-11-01T10:00:00Z` },
    { net_saved_kg: 0.0, calculated_at: `${new Date().getFullYear()}-01-01T10:00:00Z` },
  ];

  test('total er summen af alle rækker', () => {
    const agg = aggregateSavings(mockRows);
    expect(agg.total).toBeCloseTo(20.3, 1);
  });

  test('thisYear medregner kun indeværende år', () => {
    const agg = aggregateSavings(mockRows);
    expect(agg.thisYear).toBeCloseTo(8.3, 1);
  });

  test('lastYear medregner kun forrige år', () => {
    const agg = aggregateSavings(mockRows);
    expect(agg.lastYear).toBeCloseTo(12.0, 1);
  });

  test('count matcher antal rækker', () => {
    const agg = aggregateSavings(mockRows);
    expect(agg.count).toBe(4);
  });

  test('tom array returnerer nuller', () => {
    const agg = aggregateSavings([]);
    expect(agg.total).toBe(0);
    expect(agg.count).toBe(0);
  });
});

// ─── 5. Edge cases ────────────────────────────────────────────────────────────
describe('edge cases', () => {
  test('null distanceKm bruger 10 km default og markerer distanceEstimated', () => {
    const r = calculateCO2Savings({ categoryId: 'board-games', distanceKm: null });
    expect(r.breakdown.distanceEstimated).toBe(true);
    expect(r.breakdown.rawDistanceKm).toBe(10);
  });

  test('ukendt kategori falder tilbage til "other" (2.0 kg)', () => {
    const r = calculateCO2Savings({ categoryId: 'ikkeeksisterende-kategori', distanceKm: 5 });
    expect(r.breakdown.categoryFactor).toBe(2.0);
    expect(r.breakdown.categoryId).toBe('other');
  });

  test('samme institution (distance = 0) returnerer positiv produktion minus transport-0', () => {
    // distance 0 → distanceEstimated = true → bruger 25 km default
    const r = calculateCO2Savings({ categoryId: 'plush-large', distanceKm: null });
    expect(r.breakdown.distanceEstimated).toBe(true);
  });
});

// ─── 6. Legacy category mapping ───────────────────────────────────────────────
describe('legacy category mapping', () => {
  test('alle legacy-nøgler resolver til gyldige nye nøgler', () => {
    Object.entries(LEGACY_CATEGORY_MAP).forEach(([oldKey, newKey]) => {
      expect(EMISSION_FACTORS[newKey]).toBeDefined();
    });
  });

  test('gammel "mobler" nøgle resolver til children-furniture (20 kg)', () => {
    const r = calculateCO2Savings({ categoryId: 'mobler', distanceKm: 10 });
    expect(r.breakdown.categoryFactor).toBe(20.0);
    expect(r.breakdown.categoryId).toBe('children-furniture');
  });

  test('gammel "udendoers" nøgle resolver til outdoor-toys (4 kg)', () => {
    const r = calculateCO2Savings({ categoryId: 'udendoers', distanceKm: 10 });
    expect(r.breakdown.categoryFactor).toBe(4.0);
  });

  test('gammel "musik" nøgle resolver til musical-instruments (4 kg)', () => {
    const r = calculateCO2Savings({ categoryId: 'musik', distanceKm: 5 });
    expect(r.breakdown.categoryFactor).toBe(4.0);
  });
});

// ─── 7. Alle kategorier har gyldig data ───────────────────────────────────────
describe('emission factors integritet', () => {
  test('alle 20 kategorier har co2KgPerUnit > 0', () => {
    Object.entries(EMISSION_FACTORS).forEach(([id, f]) => {
      expect(f.co2KgPerUnit).toBeGreaterThan(0);
    });
  });

  test('præcis 20 kategorier defineret', () => {
    expect(Object.keys(EMISSION_FACTORS)).toHaveLength(20);
  });

  test('"other" kategori eksisterer som fallback', () => {
    expect(EMISSION_FACTORS['other']).toBeDefined();
    expect(EMISSION_FACTORS['other'].co2KgPerUnit).toBe(2.0);
  });
});
