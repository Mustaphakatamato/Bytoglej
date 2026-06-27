// Engangs-backfill: giv eksisterende opslag en visuel billedbeskrivelse +
// embedding ud fra deres billeder, så de bliver søgbare via AI-billedsøgning.
//
// Kør:  GROQ_API_KEY=gsk_... node scripts/backfill-image-embeddings.mjs
// (Supabase-nøgler læses fra .env.local)

import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

// ── Indlæs .env.local ──────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
if (!SUPA_URL || !SERVICE_KEY || !GROQ_KEY) {
  console.error('Mangler env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY og/eller GROQ_API_KEY');
  process.exit(1);
}

const supa = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });
const groq = new Groq({ apiKey: GROQ_KEY });

const MAX_IMAGES = 4;
const VISION_PROMPT = 'Beskriv KUN hvad du ser på billedet i 1-2 korte danske sætninger: genstandstype, hovedfarve(r), materiale, form og evt. tekst/logo/mærke samt distinkte træk. Ingen vurdering af stand, alder eller egnethed. Intet salgssprog. Kun beskrivelsen.';

async function describeImage(url) {
  try {
    const c = await groq.chat.completions.create({
      model: 'qwen/qwen3.6-27b', max_tokens: 120, reasoning_effort: 'none',
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url } },
        { type: 'text', text: VISION_PROMPT },
      ]}],
    });
    return (c.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } catch (e) { console.error('  vision-fejl:', e?.message); return ''; }
}

async function embedText(text) {
  const res = await fetch(`${SUPA_URL}/functions/v1/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  const j = await res.json();
  return Array.isArray(j.embedding) ? j.embedding : null;
}

const { data: listings, error } = await supa
  .from('listings')
  .select('id, title, description, images')
  .eq('is_active', true)
  .neq('type', 'søges')
  .not('images', 'is', null);
if (error) { console.error(error); process.exit(1); }

const withImages = (listings || []).filter(l => (l.images || []).filter(Boolean).length);
console.log(`Behandler ${withImages.length} opslag med billeder…\n`);

let ok = 0, fail = 0;
for (const l of withImages) {
  const images = (l.images || []).filter(Boolean).slice(0, MAX_IMAGES);
  const descs = (await Promise.all(images.map(describeImage))).filter(Boolean);
  const imageDescription = descs.join(' ') || null;
  const embedSource = (imageDescription || `${l.title || ''}. ${l.description || ''}`).trim();
  let embedding = null;
  try { embedding = await embedText(embedSource); } catch (e) { console.error('  embed-fejl:', e?.message); }

  const update = {};
  if (imageDescription) update.image_description = imageDescription;
  if (embedding) update.description_embedding = embedding;
  if (Object.keys(update).length) {
    const { error: uerr } = await supa.from('listings').update(update).eq('id', l.id);
    if (uerr) { console.error(`✗ ${l.title}:`, uerr.message); fail++; continue; }
  }
  console.log(`✓ ${l.title} — ${images.length} billede(r)${imageDescription ? `: ${imageDescription.slice(0, 70)}…` : ' (ingen beskrivelse)'}`);
  ok++;
}
console.log(`\nFærdig. OK: ${ok}, fejl: ${fail}`);
