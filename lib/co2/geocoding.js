// Geocoding + routing til CO₂-afstandsberegning
//
// Geocoding-strategi (i rækkefølge):
//   1. Nominatim med gadeniveau-adresse (ingen auth)
//   2. DAWA postnummer-centroid (groft fallback)
//
// Afstand:
//   OSRM routing API → faktisk kørselsafstand (ingen buffer-estimat nødvendigt)
//   Fallback: haversine × 1.3

// Fjern lejlighedsbetegnelser og redundant by/postnummer fra adressestreng
function cleanAddress(addr) {
  if (!addr) return addr;
  // Fjern etage/side: "1th", "2. tv", "st.", "mf", "sal"
  let s = addr.replace(/,?\s*\d{0,3}\s*\.?\s*(th|tv|mf|st\.?|sal)\b\.?/gi, '');
  // Hvis adressen allerede indeholder et 4-cifret postnummer, returner som den er
  return s.trim();
}

const NOMINATIM_HEADERS = { 'User-Agent': 'bytogleg-co2/1.0 (mustaphakatamato@gmail.com)' };

async function nominatimFetch(params) {
  const qs = new URLSearchParams({ ...params, format: 'json', limit: '1', countrycodes: 'dk' });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      signal: AbortSignal.timeout(5000),
      headers: NOMINATIM_HEADERS,
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.[0]) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
  } catch {}
  return null;
}

/**
 * Nominatim geocoding med strukturerede parametre (mere præcist end fri tekst).
 * Prøver tre strategier i faldende præcision.
 */
async function nominatimGeocode(address, zipcode, city) {
  const street = cleanAddress(address);

  // 1. Struktureret søgning: street + postalcode (mest præcist)
  if (street && zipcode) {
    const r = await nominatimFetch({ street, postalcode: String(zipcode).replace(/\D/g, '') });
    if (r) return r;
  }

  // 2. Struktureret søgning: street + city
  if (street && city) {
    const r = await nominatimFetch({ street, city, country: 'dk' });
    if (r) return r;
  }

  // 3. Postnummer + by (grov men hurtig)
  if (zipcode || city) {
    const r = await nominatimFetch({ postalcode: String(zipcode || '').replace(/\D/g, ''), city: city || '', country: 'dk' });
    if (r) return r;
  }

  return null;
}

/**
 * DAWA postnummer-centroid — bruges som sidste geocoding-fallback.
 */
async function dawaZipcodeCenter(zipcode) {
  if (!zipcode) return null;
  const clean = String(zipcode).replace(/\D/g, '').slice(0, 4);
  if (clean.length < 4) return null;
  try {
    const res = await fetch(`https://api.dataforsyningen.dk/postnumre/${clean}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.visueltcenter) {
      const [lon, lat] = d.visueltcenter;
      return { lat, lon };
    }
  } catch {}
  return null;
}

/**
 * Geocoder en dansk institutions-adresse til { lat, lon }.
 */
export async function geocodeForCO2(address, zipcode, city) {
  const nom = await nominatimGeocode(address, zipcode, city);
  if (nom) return nom;

  const zip = await dawaZipcodeCenter(zipcode);
  if (zip) return zip;

  return null;
}

/**
 * Henter faktisk kørselsafstand i km via OSRM (OpenStreetMap routing).
 * Kræver ingen API-nøgle. Returnerer null ved fejl.
 *
 * @param {{ lat: number, lon: number }} coordA
 * @param {{ lat: number, lon: number }} coordB
 */
export async function getRoutingDistanceKm(coordA, coordB) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${coordA.lon},${coordA.lat};${coordB.lon},${coordB.lat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.code === 'Ok' && d.routes?.[0]?.distance) {
      return d.routes[0].distance / 1000; // meter → km
    }
  } catch {}
  return null;
}

// Legacy export
export const dawaGeocode = nominatimGeocode;
