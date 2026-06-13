import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase-server';

const BASE_URL  = 'https://app.shipmondo.com/api/public/v3';
const API_USER  = process.env.SHIPMONDO_API_USER;
const API_KEY   = process.env.SHIPMONDO_API_KEY;
const IS_MOCK   = (!API_USER || !API_KEY) || process.env.SHIPMONDO_MOCK === 'true';

// ── Helpers ───────────────────────────────────────────────────

function authHeader() {
  // Shipmondo HTTP Basic Auth: brugernavn:adgangsnøgle
  const encoded = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

async function shipmondoRequest(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: authHeader(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ShipmondoError(`Shipmondo ${method} ${path} fejlede (${res.status}): ${text}`, res.status);
  }
  return res.json();
}

export class ShipmondoError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'ShipmondoError';
    this.statusCode = statusCode;
  }
}

// ── Mock data ─────────────────────────────────────────────────

const MOCK_PRICES = {
  postnord_service_point: { small: 49, medium: 65, large: 89,  xlarge: 139 },
  postnord_home_delivery: { small: 69, medium: 89, large: 119, xlarge: 179 },
  dao_parcel_shop:        { small: 45, medium: 59, large: 79,  xlarge: 119 },
  dao_home_delivery:      { small: 65, medium: 79, large: 109, xlarge: 159 },
  gls_parcel_shop:        { small: 48, medium: 62, large: 85,  xlarge: 130 },
};

const MOCK_PICKUP_POINTS = [
  { id: 'pp-001', name: 'Netto Vesterbro',   address: 'Vesterbrogade 45, 1620 København V', distance_m: 230 },
  { id: 'pp-002', name: 'SuperBrugsen City', address: 'Vester Farimagsgade 7, 1606 København V', distance_m: 580 },
  { id: 'pp-003', name: 'Fakta Frederiksberg', address: 'Frederiksberg Allé 12, 1820 Frederiksberg C', distance_m: 920 },
];

function mockShipmentId() {
  return `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/**
 * Uploader en base64-kodet PDF-label til Supabase Storage og returnerer den offentlige URL.
 * Shipmondo v3 returnerer labels som base64 (label_base64) — ikke som et link.
 * @returns {Promise<string|null>}
 */
async function uploadLabelBase64(base64, shipmentId) {
  if (!base64 || !shipmentId) return null;
  try {
    const supa = createServerClient();
    const buffer = Buffer.from(base64, 'base64');
    const path = `${shipmentId}.pdf`;
    const { error } = await supa.storage.from('shipping-labels').upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) {
      console.error('[shipmondo] label upload fejl:', error.message);
      return null;
    }
    const { data } = supa.storage.from('shipping-labels').getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.error('[shipmondo] label upload exception:', e.message);
    return null;
  }
}

// ── 1. getPriceQuote ──────────────────────────────────────────

/**
 * Henter estimeret pris for en forsendelse.
 * Bruges ved opslag-oprettelse og køber-checkout.
 * I produktion caches resultater i shipmondo_price_cache.
 *
 * @param {{ carrier: string, service_type: string, size_category: string, from_zip?: string, to_zip?: string }}
 * @returns {{ price_dkk: number, carrier: string, service_type: string, size_category: string, estimated_days: string }}
 */
export async function getPriceQuote({ carrier, service_type, size_category, from_zip, to_zip }) {
  if (IS_MOCK) {
    const key = `${carrier}_${service_type}`;
    const prices = MOCK_PRICES[key];
    if (!prices) throw new ShipmondoError(`Ukendt carrier/service kombination: ${key}`, 400);
    const price = prices[size_category];
    if (!price) throw new ShipmondoError(`Ukendt størrelseskategori: ${size_category}`, 400);
    return {
      price_dkk: price,
      carrier,
      service_type,
      size_category,
      estimated_days: service_type === 'home_delivery' ? '1-3 hverdage' : '2-4 hverdage',
    };
  }

  // Rigtig Shipmondo rate-quote API
  // https://app.shipmondo.com/api/public/v3/docs#tag/Shipments/operation/getRates
  const data = await shipmondoRequest('POST', '/shipments/rates', {
    sender: { zip_code: from_zip || '8000' },
    receiver: { zip_code: to_zip || '2100', country_code: 'DK' },
    parcels: [sizeToParcel(size_category)],
    carrier_code: carrierCode(carrier),
    product_code: serviceCode(carrier, service_type),
  });

  return {
    price_dkk: data.price?.value ?? data.total_price,
    carrier,
    service_type,
    size_category,
    estimated_days: data.delivery_time?.description ?? '2-4 hverdage',
  };
}

// ── 2. listPickupPoints ───────────────────────────────────────

/**
 * Returnerer nærmeste pakkeshops for en given transportør og postnummer.
 *
 * @param {{ zip_code: string, carrier: string, limit?: number }}
 * @returns {Array<{ id, name, address, distance_m }>>}
 */
export async function listPickupPoints({ zip_code, carrier, limit = 5 }) {
  if (IS_MOCK) {
    return MOCK_PICKUP_POINTS.slice(0, limit).map(p => ({ ...p, carrier }));
  }

  // https://app.shipmondo.com/api/public/v3/docs#tag/ServicePoints/operation/getServicePoints
  const params = new URLSearchParams({
    zip_code,
    country_code: 'DK',
    carrier_code: carrierCode(carrier),
    quantity: String(limit),
  });
  const data = await shipmondoRequest('GET', `/service_points?${params}`);
  return (data.service_points ?? data).map(p => ({
    id:         p.id ?? p.service_point_id,
    name:       p.name,
    address:    `${p.address}, ${p.zip_code} ${p.city}`,
    distance_m: p.distance,
    carrier,
  }));
}

// ── 3. createShipment ─────────────────────────────────────────

/**
 * Booker en faktisk forsendelse hos Shipmondo.
 * Kaldes server-side når en pakke-handel accepteres.
 *
 * @param {{
 *   sender: { name, address, zip_code, city, country_code, email, phone },
 *   receiver: { name, address, zip_code, city, country_code, email, phone },
 *   carrier: string,
 *   service_type: string,
 *   size_category: string,
 *   reference: string,          // handels-ID (conversation_id)
 *   pickup_point_id?: string,
 * }}
 * @returns {{ shipmondo_shipment_id, tracking_number, tracking_url, label_pdf_url, price_dkk }}
 */
export async function createShipment({ sender, receiver, carrier, service_type, size_category, reference, pickup_point_id }) {
  if (IS_MOCK) {
    const id = mockShipmentId();
    return {
      shipmondo_shipment_id: id,
      tracking_number:  `TRK${Date.now()}`,
      tracking_url:     `https://tracking.postnord.com/en/?id=TRK${Date.now()}`,
      label_pdf_url:    null,   // ingen rigtig label i mock
      price_dkk:        MOCK_PRICES[`${carrier}_${service_type}`]?.[size_category] ?? 65,
    };
  }

  // https://app.shipmondo.com/api/public/v3/docs#tag/Shipments/operation/createShipment
  const testMode = process.env.SHIPMONDO_TEST_MODE === 'true';
  const body = {
    test_mode: testMode,
    own_agreement: false,   // vi bruger Shipmondo's aftaler
    sender: {
      name:         sender.name,
      address1:     sender.address,
      zipcode:      sender.zip_code,
      city:         sender.city,
      country_code: sender.country_code ?? 'DK',
      email:        sender.email,
      mobile:       sender.phone,
    },
    receiver: {
      name:         receiver.name,
      address1:     receiver.address,
      zipcode:      receiver.zip_code,
      city:         receiver.city,
      country_code: receiver.country_code ?? 'DK',
      email:        receiver.email,
      mobile:       receiver.phone,
    },
    parcels:       [sizeToParcel(size_category)],
    carrier_code:  carrierCode(carrier),
    product_code:  serviceCode(carrier, service_type),
    service_codes: 'EMAIL_NT',
    reference:     reference,
    service_point: pickup_point_id ? { id: pickup_point_id } : undefined,
  };

  const data = await shipmondoRequest('POST', '/shipments', body);

  // Tracking number: may be at top level or inside packages array
  const pkg = data.packages?.[0];
  const trackingNumber = pkg?.pkg_no ?? data.pkg_no ?? data.tracking_number ?? null;

  // Label: Shipmondo v3 returnerer PDF'en som base64 på shipment-objektet (label_base64),
  // IKKE som et link. Hvis den ikke er med i POST-svaret, hentes shipment igen.
  let labelBase64 = data.label_base64 ?? pkg?.label_base64 ?? null;
  if (!labelBase64 && data.id) {
    try {
      const full = await shipmondoRequest('GET', `/shipments/${data.id}`);
      labelBase64 = full.label_base64 ?? full.packages?.[0]?.label_base64 ?? null;
    } catch {
      // label fetch failed — not critical
    }
  }

  // Upload PDF'en til Supabase Storage → offentlig URL der virker i email og UI
  const labelPdfUrl = await uploadLabelBase64(labelBase64, data.id);

  return {
    shipmondo_shipment_id: String(data.id),
    tracking_number:  trackingNumber,
    tracking_url:     data.tracking_link ?? null,
    label_pdf_url:    labelPdfUrl,
    price_dkk:        parseFloat(data.price) || null,
  };
}

// ── 4. getShipmentStatus ──────────────────────────────────────

/**
 * Henter aktuel status og tracking-events (fallback hvis webhook fejler).
 *
 * @param {string} shipmondo_shipment_id
 * @returns {{ status: string, tracking_events: Array, tracking_number: string }}
 */
export async function getShipmentStatus(shipmondo_shipment_id) {
  if (IS_MOCK) {
    return {
      status: 'in_transit',
      tracking_number: 'TRK123456',
      tracking_events: [
        { timestamp: new Date(Date.now() - 86400000).toISOString(), description: 'Pakken er afleveret hos transportør', location: 'Aarhus' },
        { timestamp: new Date().toISOString(),                      description: 'Pakken er i transit',                  location: 'Brøndby' },
      ],
    };
  }

  const data = await shipmondoRequest('GET', `/shipments/${shipmondo_shipment_id}`);
  return {
    status:           mapShipmondoStatus(data.state),
    tracking_number:  data.tracking_number,
    tracking_events:  (data.tracking_events ?? []).map(e => ({
      timestamp:   e.timestamp,
      description: e.description,
      location:    e.location,
    })),
  };
}

// ── 5. handleWebhook ─────────────────────────────────────────

/**
 * Validerer og parser en indgående Shipmondo webhook-payload.
 * Returner et normaliseret event-objekt.
 *
 * Verificering af Shipmondo webhook-signatur:
 * Shipmondo sender en HMAC-SHA256 signatur i X-Shipmondo-Hmac-SHA256 headeren.
 *
 * @param {{ payload: object, signature: string, secret: string }}
 * @returns {{ event_type, shipmondo_shipment_id, tracking_number, data }}
 */
export function handleWebhook({ payload, signature, secret }) {
  // Verificer signatur — fail closed: hvis der er konfigureret en secret,
  // SKAL der være en gyldig signatur (en angriber kan ellers blot udelade headeren).
  if (secret) {
    if (!signature) {
      throw new ShipmondoError('Manglende webhook-signatur', 401);
    }
    const computed = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    const a = Buffer.from(computed);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new ShipmondoError('Ugyldig webhook-signatur', 401);
    }
  }

  const eventType = payload.event_type ?? payload.type;
  const shipment  = payload.shipment ?? payload.data?.shipment ?? payload;

  return {
    event_type:             normalizeEventType(eventType),
    shipmondo_shipment_id:  String(shipment.id ?? payload.shipment_id),
    tracking_number:        shipment.tracking_number,
    data:                   payload,
  };
}

// ── Helpers: mapping ─────────────────────────────────────────

function carrierCode(carrier) {
  return { postnord: 'pdk', dao: 'dao', gls: 'gls' }[carrier] ?? carrier;
}

function serviceCode(carrier, service_type) {
  // Produktkoder skal matche dem vi viser/prissætter i lib/shipping-rates.js
  const map = {
    postnord: { service_point: 'PDK_MC', parcel_shop: 'PDK_MC', home_delivery: 'PDK_HOMEDELIVERY' },
    pdk:      { service_point: 'PDK_MC', parcel_shop: 'PDK_MC', home_delivery: 'PDK_HOMEDELIVERY' },
    dao:      { parcel_shop: 'DAO_DROPPOINT',  home_delivery: 'DAO_STH' },
    gls:      { parcel_shop: 'GLSDK_SD' },
  };
  return map[carrier]?.[service_type] ?? service_type.toUpperCase();
}

function sizeToParcel(size_category) {
  const sizes = {
    small:  { weight: 2000, length: 35, width: 25, height: 20 },
    medium: { weight: 5000, length: 50, width: 35, height: 25 },
    large:  { weight: 15000, length: 60, width: 40, height: 40 },
    xlarge: { weight: 30000, length: 100, width: 60, height: 60 },
  };
  const s = sizes[size_category] ?? sizes.medium;
  return { weight: s.weight, length: s.length, width: s.width, height: s.height };
}

function mapShipmondoStatus(state) {
  const map = {
    created:    'pending',
    booked:     'booked',
    printed:    'printed',
    transit:    'in_transit',
    delivered:  'delivered',
    cancelled:  'cancelled',
    error:      'failed',
  };
  return map[state?.toLowerCase()] ?? 'pending';
}

function normalizeEventType(raw) {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase().replace(/[.\-]/g, '_');
  if (s.includes('booked'))    return 'shipment.booked';
  if (s.includes('printed'))   return 'shipment.printed';
  if (s.includes('transit'))   return 'shipment.in_transit';
  if (s.includes('delivered')) return 'shipment.delivered';
  if (s.includes('failed') || s.includes('error')) return 'shipment.failed';
  return raw;
}

// ── Eksportér mock-flag til brug i tests og API-routes ────────
export const isMockMode = IS_MOCK;
