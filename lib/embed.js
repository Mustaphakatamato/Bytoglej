// Henter en 384-dim tekst-embedding fra vores Supabase edge function (gratis gte-small).
// Bruges af /api/embed-listing (ved upload) og /api/ai-image-search (ved søgning).

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function embedText(text) {
  const clean = (text || '').trim();
  if (!clean) return null;

  const res = await fetch(`${SUPA_URL}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // apikey/Authorization er ikke påkrævet (verify_jwt=false) men sendes så vi kan
      // stramme funktionen til verify_jwt=true uden at ændre kaldere.
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ text: clean }),
  });

  if (!res.ok) throw new Error(`embed-funktion fejlede: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.embedding)) throw new Error(json.error || 'embed-svar manglede vektor');
  return json.embedding;
}
