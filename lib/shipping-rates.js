// Shipmondo platform rates 2025/2026 for DK→DK (incl. all surcharges).
// Source: shipmondo.com published rates. Quote API not supported for these carriers.
// Delt mellem /api/shipping/quote (visning) og /api/payments/create-intent (validering).

export const RATES = {
  pdk_parcel_shop: {
    // PDK_MC - PostNord Service Point
    label: 'PostNord pakkeshop',
    carrier_code: 'pdk', product_code: 'PDK_MC', type: 'parcel_shop',
    prices: { small: 37.60, medium: 52.50, large: 82.00, xlarge: 135.00 },
  },
  gls_parcel_shop: {
    // GLSDK_SD - GLS ShopDelivery
    label: 'GLS pakkeshop',
    carrier_code: 'gls', product_code: 'GLSDK_SD', type: 'parcel_shop',
    prices: { small: 34.80, medium: 48.00, large: 75.00, xlarge: 125.00 },
  },
  dao_home: {
    // DAO_STH - daoHOME
    label: 'DAO hjemlevering',
    carrier_code: 'dao', product_code: 'DAO_STH', type: 'home_delivery',
    prices: { small: 49.00, medium: 65.00, large: 95.00, xlarge: 155.00 },
  },
};

/**
 * Slår den autoritative serverpris op for en leveringsmetode valgt i kurven.
 * @param {string} method  fx 'parcel_shop_pdk', 'home_dao', 'pickup', 'custom'
 * @param {string} size    'small' | 'medium' | 'large' | 'xlarge'
 * @returns {number|null}  pris i DKK, 0 for pickup/custom, null hvis ukendt metode
 */
export function getShippingPrice(method, size = 'medium') {
  if (!method || method === 'pickup' || method === 'custom') return 0;
  let type, carrier;
  if (method.startsWith('parcel_shop_')) { type = 'parcel_shop';  carrier = method.slice('parcel_shop_'.length); }
  else if (method.startsWith('home_'))   { type = 'home_delivery'; carrier = method.slice('home_'.length); }
  else return null;
  const rate = Object.values(RATES).find(r => r.carrier_code === carrier && r.type === type);
  if (!rate) return null;
  return rate.prices[size] ?? rate.prices.medium;
}
