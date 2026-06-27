// Genererer en visuel beskrivelse af ALLE billeder på et opslag (uanset om
// brugeren trykkede "Scan med AI") og gemmer den samlede beskrivelse +
// en semantisk embedding. Dermed er ethvert opslag med billede søgbart via
// AI-billedsøgning — symmetrisk med søgesiden, der beskriver søgefotoet med
// samme vision-model og embedder beskrivelsen.
//
// Bruges af /api/embed-listing (oprettelse + redigering) og af backfill-scriptet.

import Groq from 'groq-sdk';
import { embedText } from '@/lib/embed';

const VISION_MODEL = 'qwen/qwen3.6-27b'; // Groqs vision-model (reasoning slås fra)
const MAX_IMAGES = 4;                    // loft pr. opslag (latens/omkostning)
const VISION_PROMPT = 'Beskriv KUN hvad du ser på billedet i 1-2 korte danske sætninger: genstandstype, hovedfarve(r), materiale, form og evt. tekst/logo/mærke samt distinkte træk. Ingen vurdering af stand, alder eller egnethed. Intet salgssprog. Kun beskrivelsen.';

async function describeImage(groq, url) {
  try {
    const c = await groq.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 120,
      reasoning_effort: 'none', // qwen3.6 er en thinking-model — slå reasoning fra
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url } },
          { type: 'text', text: VISION_PROMPT },
        ],
      }],
    });
    return (c.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } catch (e) {
    console.error('[describe-images] vision-fejl:', e?.message);
    return '';
  }
}

/**
 * Beskriv alle billeder på et opslag og gem image_description + description_embedding.
 *
 * @param {object} supa         service-role supabase-klient
 * @param {string} listingId
 * @param {string} [fallbackText] tekst der bruges til embedding hvis opslaget ingen billeder har
 * @returns {Promise<{ok:boolean, described?:number, hasEmbedding?:boolean, error?:string}>}
 */
export async function describeImagesAndEmbed(supa, listingId, fallbackText) {
  const { data: listing } = await supa
    .from('listings')
    .select('id, title, description, images')
    .eq('id', listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: 'Opslag ikke fundet' };

  const images = (listing.images || []).filter(Boolean).slice(0, MAX_IMAGES);

  let imageDescription = null;
  if (images.length && process.env.GROQ_API_KEY) {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const descs = (await Promise.all(images.map(u => describeImage(groq, u)))).filter(Boolean);
    if (descs.length) imageDescription = descs.join(' ');
  }

  // Til billed-match embeddes PRIMÆRT den visuelle beskrivelse (symmetrisk med
  // søgesiden). Uden billeder/vision falder vi tilbage til tekst, så opslaget
  // stadig får en embedding.
  const embedSource = (imageDescription
    || (fallbackText || '').trim()
    || `${listing.title || ''}. ${listing.description || ''}`).trim();

  let embedding = null;
  try { embedding = await embedText(embedSource); }
  catch (e) { console.error('[describe-images] embed-fejl:', e?.message); }

  const update = {};
  if (imageDescription) update.image_description = imageDescription;
  if (embedding) update.description_embedding = embedding;
  if (Object.keys(update).length) {
    const { error } = await supa.from('listings').update(update).eq('id', listingId);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, described: images.length, hasEmbedding: !!embedding };
}
