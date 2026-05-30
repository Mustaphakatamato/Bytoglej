// Geocoding til CO₂-afstandsberegning
// Primær: DAWA (Danmarks Adressers Web API) — gratis, dansk præcision
// Fallback: Nominatim (OpenStreetMap) — bruges hvis DAWA returnerer intet

/**
 * Geocoder dansk adresse med DAWA API.
 * Returnerer { lat, lon } eller null ved fejl/ingen resultat.
 */
export async function dawaGeocode(address, zipcode, city) {
  if (!address && !zipcode && !city) return null;
  try {
    const q = [address, zipcode, city].filter(Boolean).join(', ');
    const url = `https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(q)}&format=json&per_side=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`DAWA ${res.status}`);
    const data = await res.json();
    if (data?.[0]?.adgangspunkt?.koordinater) {
      const [lon, lat] = data[0].adgangspunkt.koordinater;
      return { lat, lon };
    }
    // Try fuzzy DAWA search via autocomplete
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
 * Geocoder adresse — prøver DAWA først, falder tilbage til Nominatim.
 */
export async function geocodeForCO2(address, zipcode, city) {
  const dawa = await dawaGeocode(address, zipcode, city);
  if (dawa) return dawa;
  // Nominatim fallback
  try {
    const q = encodeURIComponent(`${address || ''}, ${zipcode || ''} ${city || ''}, Denmark`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (d?.[0]) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
  } catch {}
  return null;
}
