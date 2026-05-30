// Geocoding til CO₂-afstandsberegning
// Strategi (i rækkefølge):
//   1. DAWA adresse-søgning (fuld adresse)
//   2. DAWA postnummer-centroid (kun postnummer → hurtig fallback)
//   3. Nominatim med by-navn

/**
 * Prøver DAWA adresse-søgning med fuld tekst.
 * Returnerer { lat, lon } eller null.
 */
async function dawaAddressSearch(address, zipcode, city) {
  try {
    const q = [address, zipcode, city].filter(Boolean).join(', ');
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
 * Slår postnummer op via DAWA og returnerer centroid-koordinater.
 * Fungerer selv om address-feltet er et institutionsnavn frem for en gadeadresse.
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
 * Nominatim-søgning med korrekt User-Agent og by-navn.
 */
async function nominatimCity(city, zipcode) {
  const term = [zipcode, city, 'Denmark'].filter(Boolean).join(' ');
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&format=json&limit=1&countrycodes=dk`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'bytogleg-co2/1.0 (mustaphakatamato@live.dk)' },
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.[0]) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
  } catch {}
  return null;
}

/**
 * Geocoder en dansk institutions-adresse til { lat, lon }.
 * Prøver tre strategier i rækkefølge, returnerer null ved total fejl.
 */
export async function geocodeForCO2(address, zipcode, city) {
  // 1. Fuld adresse via DAWA (bedst præcision)
  const full = await dawaAddressSearch(address, zipcode, city);
  if (full) return full;

  // 2. Postnummer-centroid via DAWA (fungerer selv om address er institutionsnavn)
  const zip = await dawaZipcodeCenter(zipcode);
  if (zip) return zip;

  // 3. By-navn via Nominatim
  const nom = await nominatimCity(city, zipcode);
  if (nom) return nom;

  return null;
}

// Legacy export — bruges ikke direkte men bevaret for import-kompatibilitet
export const dawaGeocode = dawaAddressSearch;
