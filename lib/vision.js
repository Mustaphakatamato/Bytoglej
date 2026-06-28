// Vision-analyse via Google Gemini (@google/generative-ai er allerede en dependency).
// Valgt frem for Groq/qwen3.6-27b pga. hastighed, pålidelig JSON og et langt mere
// generøst gratis-loft (separat kvote fra Groq-tekst).
//
// Skift model med VISION_MODEL env (default gemini-2.0-flash). Skift tilbage til Groq
// ved at gendanne git-historikken for scan-toy / scan-image / describe-images.

import { GoogleGenerativeAI } from '@google/generative-ai';

// gemini-2.0-flash har INGEN gratis-kvote (0/0/0) → vælg en model med gratis-loft.
// gemini-2.5-flash: 5 RPM / 20 RPD gratis. Skift med VISION_MODEL env.
const MODEL = process.env.VISION_MODEL || 'gemini-2.5-flash';

// Accepter de gængse navne, så det virker uanset hvad nøglen hedder i Vercel.
function geminiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || process.env.GOOGLE_GEMINI_API_KEY
    || process.env.GEMINI_KEY
    || '';
}

export function visionConfigured() {
  return !!geminiKey();
}

// Hent et billede fra en URL og returnér det som Gemini inlineData.
async function urlToInlineData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kunne ikke hente billede (${res.status})`);
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());
  return { mimeType, data: buf.toString('base64') };
}

/**
 * Analysér ÉT billede med en prompt.
 * @param {object}  opts
 * @param {string} [opts.base64]   billede som base64 (uden data:-prefix)
 * @param {string} [opts.mimeType] mime-type for base64-billedet
 * @param {string} [opts.url]      alternativt: hent billedet fra denne URL
 * @param {string}  opts.prompt    instruktion til modellen
 * @param {boolean}[opts.json]     true → bed om application/json (kalderen parser selv)
 * @param {number} [opts.maxOutputTokens]
 * @param {number} [opts.temperature]
 * @returns {Promise<string>} modellens tekstsvar (trimmet)
 */
export async function visionAnalyze({ base64, mimeType, url, prompt, json = false, maxOutputTokens = 256, temperature = 0 }) {
  const key = geminiKey();
  if (!key) throw new Error('GEMINI_API_KEY mangler');
  const inline = base64
    ? { mimeType: mimeType || 'image/jpeg', data: base64 }
    : await urlToInlineData(url);

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens,
      temperature,
      // gemini-2.5-* er thinking-modeller — tænke-tokens spiser output-budgettet og
      // giver afkortede/tomme svar. Slå thinking fra for direkte svar.
      thinkingConfig: { thinkingBudget: 0 },
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  });

  // Retry-med-backoff på rate-limit (429) — gratis-loftet rammes let ved bursts,
  // og en kort pause lader kaldet selv-hele i stedet for at fejle mod brugeren.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent([
        { inlineData: inline },
        { text: prompt },
      ]);
      return (result.response.text() || '').trim();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const isRateLimit = /429|too many requests|resource[_ ]?exhausted|rate limit/i.test(msg);
      if (isRateLimit && attempt < 2) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
