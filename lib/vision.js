// Vision-analyse via Google Gemini (@google/generative-ai er allerede en dependency).
// Valgt frem for Groq/qwen3.6-27b pga. hastighed, pålidelig JSON og et langt mere
// generøst gratis-loft (separat kvote fra Groq-tekst).
//
// Skift model med VISION_MODEL env (default gemini-2.0-flash). Skift tilbage til Groq
// ved at gendanne git-historikken for scan-toy / scan-image / describe-images.

import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = process.env.VISION_MODEL || 'gemini-2.0-flash';

export function visionConfigured() {
  return !!process.env.GEMINI_API_KEY;
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
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY mangler');
  const inline = base64
    ? { mimeType: mimeType || 'image/jpeg', data: base64 }
    : await urlToInlineData(url);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens,
      temperature,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const result = await model.generateContent([
    { inlineData: inline },
    { text: prompt },
  ]);
  return (result.response.text() || '').trim();
}
