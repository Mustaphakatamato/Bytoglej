// Shipmondo platform rates 2025/2026 for DK→DK (incl. all surcharges).
// Table-based estimates — live quotes require full address info (only available at checkout).
// Delt mellem /api/shipping/quote (visning) og /api/payments/create-intent (validering).

// Weight bands per carrier, sorted by max_g ascending.
// key format: <carrier>_<band> — bruges som size_category i databasen.
export const WEIGHT_BANDS = {
  gls: [
    { key: 'gls_0_1',   label: '0–1 kg',   max_g: 1000,  price: 34.80 },
    { key: 'gls_1_5',   label: '1–5 kg',   max_g: 5000,  price: 48.00 },
    { key: 'gls_5_10',  label: '5–10 kg',  max_g: 10000, price: 65.00 },
    { key: 'gls_10_15', label: '10–15 kg', max_g: 15000, price: 82.00 },
    { key: 'gls_15_20', label: '15–20 kg', max_g: 20000, price: 105.00 },
  ],
  pdk: [
    { key: 'pdk_0_1',   label: '0–1 kg',   max_g: 1000,  price: 37.60 },
    { key: 'pdk_1_2',   label: '1–2 kg',   max_g: 2000,  price: 45.00 },
    { key: 'pdk_2_5',   label: '2–5 kg',   max_g: 5000,  price: 52.50 },
    { key: 'pdk_5_10',  label: '5–10 kg',  max_g: 10000, price: 69.00 },
    { key: 'pdk_10_15', label: '10–15 kg', max_g: 15000, price: 82.00 },
    { key: 'pdk_15_20', label: '15–20 kg', max_g: 20000, price: 110.00 },
  ],
};

export const CARRIER_LABELS = {
  gls: 'GLS pakkeshop',
  pdk: 'PostNord pakkeshop',
};

// Legacy flat-rate lookup (used by create-intent for backwards-compat with old orders).
export const RATES = {
  pdk_parcel_shop: {
    label: 'PostNord pakkeshop',
    carrier_code: 'pdk', product_code: 'PDK_MC', type: 'parcel_shop',
    prices: { small: 37.60, medium: 52.50, large: 82.00, xlarge: 135.00 },
  },
  gls_parcel_shop: {
    label: 'GLS pakkeshop',
    carrier_code: 'gls', product_code: 'GLSDK_SD', type: 'parcel_shop',
    prices: { small: 34.80, medium: 48.00, large: 75.00, xlarge: 125.00 },
  },
  dao_home: {
    label: 'DAO hjemlevering',
    carrier_code: 'dao', product_code: 'DAO_STH', type: 'home_delivery',
    prices: { small: 49.00, medium: 65.00, large: 95.00, xlarge: 155.00 },
  },
};

/**
 * Konverter en size_category (vægt i gram som streng, fx "1000", eller en legacy-nøgle
 * 'small'/'medium'/'large'/'xlarge') til en legacy-størrelse til RATES-opslag.
 */
export function sizeToLegacy(size) {
  if (size == null) return 'medium';
  // Legacy-nøgle?
  if (['small', 'medium', 'large', 'xlarge'].includes(size)) return size;
  // Vægt i gram (streng eller tal)?
  const g = parseInt(size, 10);
  if (!isNaN(g)) {
    if (g <= 1000)  return 'small';
    if (g <= 5000)  return 'medium';
    if (g <= 15000) return 'large';
    return 'xlarge';
  }
  return 'medium';
}

/**
 * Find the band entry for a given size_category key (e.g. 'gls_1_5').
 * Falls back to legacy size key lookup for backwards compatibility.
 */
export function getBandByKey(key) {
  for (const bands of Object.values(WEIGHT_BANDS)) {
    const found = bands.find(b => b.key === key);
    if (found) return found;
  }
  return null;
}

/**
 * Find the cheapest matching band for a carrier given weight in grams.
 */
export function suggestBand(carrier, weight_g) {
  const bands = WEIGHT_BANDS[carrier];
  if (!bands) return null;
  return bands.find(b => weight_g <= b.max_g) ?? bands[bands.length - 1];
}

/**
 * Get the cheapest shipping price for a given size_category (weight_g string or legacy key).
 * Used server-side for validation at checkout.
 */
export function getShippingPrice(method, size = 'medium') {
  if (!method || method === 'pickup' || method === 'custom') return 0;

  // New format: weight in grams as numeric string (e.g. "1500")
  const weight_g = parseInt(size, 10);
  if (!isNaN(weight_g) && String(weight_g) === String(size)) {
    // Find cheapest band across all carriers for this weight
    let cheapest = null;
    for (const bands of Object.values(WEIGHT_BANDS)) {
      const band = bands.find(b => weight_g <= b.max_g) ?? bands[bands.length - 1];
      if (cheapest === null || band.price < cheapest) cheapest = band.price;
    }
    return cheapest ?? 49;
  }

  // Legacy weight-band key (e.g. 'gls_1_5')
  const band = getBandByKey(size);
  if (band) return band.price;

  // Legacy method-based lookup
  let type, carrier;
  if (method.startsWith('parcel_shop_')) { type = 'parcel_shop';  carrier = method.slice('parcel_shop_'.length); }
  else if (method.startsWith('home_'))   { type = 'home_delivery'; carrier = method.slice('home_'.length); }
  else return null;
  const rate = Object.values(RATES).find(r => r.carrier_code === carrier && r.type === type);
  if (!rate) return null;
  return rate.prices[size] ?? rate.prices.medium;
}
