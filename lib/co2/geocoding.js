// Geocoding til CO₂-afstandsberegning
// Strategi (i rækkefølge):
//   1. Nominatim med fuld adresse (præcis, ingen auth-krav)
//   2. DAWA adresse-søgning (præcis, kan kræve token)
//   3. DAWA postnummer-centroid (groft fallback)

// Fjern lejlighedsbetegnelser som "1th", "2tv", "st." fra adresse
function stripApartment(addr) {
  if (!addr) return addr;
  return addr.replace(/,?\s*\d{0,3}\s*\.?\s*(th|tv|mf|st|sal)\b\.?/gi, '').trim();
}

/**
 * Nominatim med fuld adresse — bruges som primær da den ikke kræver auth.
 */
async function nominatimAddress(address, zipcode, city) {
  const clean = stripApartment(address);
  const q = [clean, zipcode, city, 'Denmark'].filter(Boolean).join(', ');
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=dk`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'bytogleg-co2/1.0 (mustaphakatamato@gmail.com)' },
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.[0]) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
  } catch {}
  return null;
}

/**
 * DAWA adresse-søgning — præcis men kræver muligvis token.
 */
async function dawaAddressSearch(address, zipcode, city) {
  try {
    const cleanAddr = stripApartment(address);
    const q = [cleanAddr, zipcode, city].filter(Boolean).join(', ');
    const url = `https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(q)}&format=json&per_side=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.[0]?.adgangspunkt?.koordinater) {
      const [lon, lat] = data[0].adgangspunkt.koordinater;
      return { lat, lon };
    }
    // Prøv DAWA autocomplete som sekundær
    const url2 = `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(q)}&per_side=1`;
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(4000) });
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2?.[0]?.adresse?.href) {
        const res3 = await fetch(data2[0].adresse.href, { signal: AbortSignal.timeout(4000) });
        if (res3.ok) {
          const addr = await res3.json();
          if (addr?.adgangspunkt?.koordinater) {
            const [lon, lat] = addr.adgangspunkt.koordinater;
            return { lat, lon };
          }
        }
      }
    }
  } catch {}
  return null;
}

/**
 * DAWA postnummer-centroid — groft fallback, giver samme punkt for hele postnummerområdet.
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
 * Prøver tre strategier i rækkefølge, returnerer null ved total fejl.
 */
export async function geocodeForCO2(address, zipcode, city) {
  // 1. Nominatim med fuld adresse (ingen auth, præcis på gadeniveau)
  const nom = await nominatimAddress(address, zipcode, city);
  if (nom) return nom;

  // 2. DAWA adresse-søgning
  const full = await dawaAddressSearch(address, zipcode, city);
  if (full) return full;

  // 3. DAWA postnummer-centroid (groft — giver samme punkt for hele postnummerområdet)
  const zip = await dawaZipcodeCenter(zipcode);
  if (zip) return zip;

  return null;
}

// Legacy export
export const dawaGeocode = dawaAddressSearch;
