/**
 * Backfill: genererer description_embedding for eksisterende opslag der mangler den.
 *
 * Eksisterende opslag har ikke image_description (ny kolonne), så vi falder tilbage
 * på "titel. beskrivelse". Nye opslag får embedding automatisk ved upload.
 *
 * Embeddings laves gratis via vores Supabase edge function (gte-small).
 * Kun ikke-"søges"-opslag indgår (søges udelukkes fra billedsøgning).
 *
 * Kør med: node scripts/backfill-embeddings.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));
readFileSync(resolve(__dir, '../.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .forEach(l => { const [k, ...v] = l.split('='); process.env[k.trim()] = v.join('=').trim(); });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, ANON_KEY })) {
  if (!v) { console.error(`❌ Mangler ${k} i .env.local`); process.exit(1); }
}

const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function embed(text) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.embedding)) throw new Error(json.error || 'ingen vektor');
  return json.embedding;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const { data: rows, error } = await supa
    .from('listings')
    .select('id, title, description, image_description')
    .is('description_embedding', null)
    .neq('type', 'søges');

  if (error) { console.error('❌ Kunne ikke hente opslag:', error.message); process.exit(1); }
  console.log(`Fandt ${rows.length} opslag uden embedding.`);

  let ok = 0, skipped = 0, failed = 0;
  for (const [i, row] of rows.entries()) {
    const text = (row.image_description || `${row.title || ''}. ${row.description || ''}`).trim();
    if (!text || text === '.') { skipped++; continue; }
    try {
      const embedding = await embed(text);
      const { error: upErr } = await supa.from('listings').update({ description_embedding: embedding }).eq('id', row.id);
      if (upErr) throw new Error(upErr.message);
      ok++;
      if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${rows.length} …`);
      await sleep(150); // skån Groq/edge rate limits
    } catch (e) {
      failed++;
      console.warn(`  ⚠️  ${row.id}: ${e.message}`);
    }
  }

  console.log(`\n✅ Færdig. Embedded: ${ok}  |  Sprunget over (tom tekst): ${skipped}  |  Fejlet: ${failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
