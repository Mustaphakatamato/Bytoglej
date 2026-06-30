// CO2 Calculator — obligatoriske tests (metode v1.1)
// Kør med: npx vitest run __tests__/co2-calculator.test.js --globals
//
// v1.1: transport = fast pakke-emission (0,2 kg) pr. forsendelse, distance-
// uafhængig. Displacement = 0,4 (Vinted/Vaayu-niveau). Bundter summerer
// produktion over varer og trækker transport fra ÉN gang.

import { calculateCO2Savings, aggregateSavings } from '../lib/co2/calculator';
import { EMISSION_FACTORS, LEGACY_CATEGORY_MAP, METHODOLOGY_VERSION } from '../lib/co2/emission-factors';

// ─── 1. Korrekte tal for kendte inputs ────────────────────────────────────────
describe('calculateCO2Savings — korrekte resultater (v1.1)', () => {
  test('books: 1.0 × 0.4 − 0.2 pakke = 0.2 kg netto', () => {
    const r = calculateCO2Savings({ categoryId: 'books' });
    expect(r.breakdown.productionSavedKg).toBeCloseTo(0.4, 2);
    expect(r.breakdown.transportCostKg).toBeCloseTo(0.2, 2);
    expect(r.netSavedKg).toBeCloseTo(0.2, 1);
  });

  test('ride-on-toys: 30 × 0.4 − 0.2 = 11.8 kg', () => {
    const r = calculateCO2Savings({ categoryId: 'ride-on-toys' });
    expect(r.netSavedKg).toBeCloseTo(11.8, 1);
  });

  test('children-furniture: korrekt dekomposition', () => {
    const r = calculateCO2Savings({ categoryId: 'children-furniture' });
    expect(r.breakdown.categoryFactor).toBe(20.0);
    expect(r.breakdown.displacementRate).toBe(0.4);
    expect(r.breakdown.productionSavedKg).toBeCloseTo(8.0, 2);
    expect(r.breakdown.parcelEmissionKg).toBeCloseTo(0.2, 2);
    expect(r.netSavedKg).toBeCloseTo(7.8, 1);
  });

  test('metodologi-version er korrekt', () => {
    const r = calculateCO2Savings({ categoryId: 'books' });
    expect(r.methodologyVersion).toBe('1.1');
  });

  test('calculatedAt er valid ISO timestamp', () => {
    const r = calculateCO2Savings({ categoryId: 'puzzles' });
    expect(() => new Date(r.calculatedAt)).not.toThrow();
    expect(new Date(r.calculatedAt).getTime()).toBeGreaterThan(0);
  });
});

// ─── 2. Bundter: produktion summeres, transport trækkes fra én gang ───────────
describe('bundter (categoryIds)', () => {
  test('3 bøger i samme forsendelse: 3 × 0.4 − 0.2 = 1.0 kg', () => {
    const r = calculateCO2Savings({ categoryIds: ['books', 'books', 'books'] });
    expect(r.breakdown.itemCount).toBe(3);
    expect(r.breakdown.aggregated).toBe(true);
    expect(r.breakdown.productionSavedKg).toBeCloseTo(1.2, 2);
    expect(r.netSavedKg).toBeCloseTo(1.0, 1);
  });

  test('blandet bundt summerer korrekt og trækker kun ÉN pakke fra', () => {
    // wooden-toys (2.0) + electronic-toys (12.0): produktion = (2+12)×0.4 = 5.6
    const r = calculateCO2Savings({ categoryIds: ['wooden-toys', 'electronic-toys'] });
    expect(r.breakdown.productionSavedKg).toBeCloseTo(5.6, 2);
    expect(r.breakdown.transportCostKg).toBeCloseTo(0.2, 2);
    expect(r.netSavedKg).toBeCloseTo(5.4, 1);
  });

  test('categoryIds vinder over categoryId hvis begge gives', () => {
    const r = calculateCO2Savings({ categoryId: 'books', categoryIds: ['ride-on-toys'] });
    expect(r.breakdown.categoryId).toBe('ride-on-toys');
  });
});

// ─── 3. Aldrig negativ besparelse ─────────────────────────────────────────────
describe('calculateCO2Savings — aldrig negativ', () => {
  test('alle kategorier returnerer netSavedKg ≥ 0', () => {
    Object.keys(EMISSION_FACTORS).forEach(id => {
      const r = calculateCO2Savings({ categoryId: id });
      expect(r.netSavedKg).toBeGreaterThanOrEqual(0);
    });
  });

  test('hverdagskategorier giver nu positivt udslag (ikke 0)', () => {
    ['books', 'wooden-toys', 'construction-toys', 'board-games'].forEach(id => {
      const r = calculateCO2Savings({ categoryId: id });
      expect(r.netSavedKg).toBeGreaterThan(0);
    });
  });
});

// ─── 4. Persisterede beregninger ændres ikke ──────────────────────────────────
describe('immutabilitet af persisterede beregninger', () => {
  test('snapshot af beregning matcher ved replay med samme inputs', () => {
    const original = calculateCO2Savings({ categoryId: 'outdoor-toys' });
    const snapshot = JSON.parse(JSON.stringify(original));
    expect(snapshot.netSavedKg).toBe(original.netSavedKg);
    expect(snapshot.breakdown.categoryFactor).toBe(original.breakdown.categoryFactor);
    expect(snapshot.breakdown.productionSavedKg).toBe(original.breakdown.productionSavedKg);
    expect(snapshot.breakdown.transportCostKg).toBe(original.breakdown.transportCostKg);
    expect(snapshot.methodologyVersion).toBe(original.methodologyVersion);
  });
});

// ─── 5. Aggregeringer ─────────────────────────────────────────────────────────
describe('aggregateSavings', () => {
  const mockRows = [
    { net_saved_kg: 5.2, calculated_at: `${new Date().getFullYear()}-03-01T10:00:00Z` },
    { net_saved_kg: 3.1, calculated_at: `${new Date().getFullYear()}-06-15T10:00:00Z` },
    { net_saved_kg: 12.0, calculated_at: `${new Date().getFullYear() - 1}-11-01T10:00:00Z` },
    { net_saved_kg: 0.0, calculated_at: `${new Date().getFullYear()}-01-01T10:00:00Z` },
  ];

  test('total er summen af alle rækker', () => {
    expect(aggregateSavings(mockRows).total).toBeCloseTo(20.3, 1);
  });
  test('thisYear medregner kun indeværende år', () => {
    expect(aggregateSavings(mockRows).thisYear).toBeCloseTo(8.3, 1);
  });
  test('lastYear medregner kun forrige år', () => {
    expect(aggregateSavings(mockRows).lastYear).toBeCloseTo(12.0, 1);
  });
  test('count matcher antal rækker', () => {
    expect(aggregateSavings(mockRows).count).toBe(4);
  });
  test('tom array returnerer nuller', () => {
    const agg = aggregateSavings([]);
    expect(agg.total).toBe(0);
    expect(agg.count).toBe(0);
  });
});

// ─── 6. Edge cases ────────────────────────────────────────────────────────────
describe('edge cases', () => {
  test('ukendt kategori falder tilbage til "other" (2.0 kg)', () => {
    const r = calculateCO2Savings({ categoryId: 'ikkeeksisterende-kategori' });
    expect(r.breakdown.categoryFactor).toBe(2.0);
    expect(r.breakdown.categoryId).toBe('other');
  });

  test('intet input giver "other" og netto ≥ 0', () => {
    const r = calculateCO2Savings({});
    expect(r.breakdown.categoryId).toBe('other');
    expect(r.netSavedKg).toBeGreaterThanOrEqual(0);
  });
});

// ─── 6b. DB-drevne overrides (admin-config) ───────────────────────────────────
describe('factors/methodology overrides', () => {
  test('factors-override bruges i stedet for hardcodede værdier', () => {
    const factors = { 'books': { co2KgPerUnit: 50, sources: ['X'] }, 'other': { co2KgPerUnit: 2 } };
    const r = calculateCO2Savings({ categoryId: 'books', factors });
    expect(r.breakdown.categoryFactor).toBe(50);
    expect(r.breakdown.productionSavedKg).toBeCloseTo(20, 2); // 50 × 0.4
  });

  test('methodology-override ændrer displacement og pakke-emission', () => {
    const methodology = { version: '2.0', displacementRate: 0.6, parcelCo2Kg: 0.5 };
    const r = calculateCO2Savings({ categoryId: 'children-furniture', methodology });
    expect(r.methodologyVersion).toBe('2.0');
    expect(r.breakdown.displacementRate).toBe(0.6);
    expect(r.breakdown.productionSavedKg).toBeCloseTo(12, 2); // 20 × 0.6
    expect(r.breakdown.transportCostKg).toBeCloseTo(0.5, 2);
    expect(r.netSavedKg).toBeCloseTo(11.5, 1);
  });

  test('uden overrides er resultatet identisk med hardcodede defaults', () => {
    const a = calculateCO2Savings({ categoryId: 'wooden-toys' });
    const b = calculateCO2Savings({ categoryId: 'wooden-toys', factors: undefined, methodology: undefined });
    expect(b.netSavedKg).toBe(a.netSavedKg);
    expect(b.breakdown.categoryFactor).toBe(a.breakdown.categoryFactor);
  });
});

// ─── 7. Legacy category mapping ───────────────────────────────────────────────
describe('legacy category mapping', () => {
  test('alle legacy-nøgler resolver til gyldige nye nøgler', () => {
    Object.entries(LEGACY_CATEGORY_MAP).forEach(([oldKey, newKey]) => {
      expect(EMISSION_FACTORS[newKey]).toBeDefined();
    });
  });
  test('gammel "mobler" nøgle resolver til children-furniture (20 kg)', () => {
    const r = calculateCO2Savings({ categoryId: 'mobler' });
    expect(r.breakdown.categoryFactor).toBe(20.0);
    expect(r.breakdown.categoryId).toBe('children-furniture');
  });
  test('gammel "udendoers" nøgle resolver til outdoor-toys (4 kg)', () => {
    const r = calculateCO2Savings({ categoryId: 'udendoers' });
    expect(r.breakdown.categoryFactor).toBe(4.0);
  });
});

// ─── 8. Alle kategorier har gyldig data ───────────────────────────────────────
describe('emission factors integritet', () => {
  test('alle kategorier har co2KgPerUnit > 0', () => {
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
  test('METHODOLOGY_VERSION er 1.1', () => {
    expect(METHODOLOGY_VERSION).toBe('1.1');
  });
});
