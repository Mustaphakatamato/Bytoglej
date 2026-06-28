// Vision-analyse via Groq (qwen3.6-27b). Valgt for gratis-loftet: Groq giver
// 200K tokens/dag + 1000 req/dag — markant mere end Geminis ~20/dag. Vi nedskalerer
// billeder hårdt (klient-side compressImage + komprimerede storage-uploads), så
// token-forbruget pr. kald er lavt og dags-loftet rækker til ~500 scanninger.
//
// Skift model med VISION_MODEL env. Samme interface som før (visionAnalyze +
// visionConfigured), så kaldestederne er uændrede.

import Groq from 'groq-sdk';

const MODEL = process.env.VISION_MODEL || 'qwen/qwen3.6-27b';

export function visionConfigured() {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Analysér ÉT billede med en prompt.
 * @param {object}  opts
 * @param {string} [opts.base64]   billede som base64 (uden data:-prefix)
 * @param {string} [opts.mimeType] mime-type for base64-billedet
 * @param {string} [opts.url]      alternativt: en billede-URL (Groq henter den selv)
 * @param {string}  opts.prompt    instruktion til modellen
 * @param {boolean}[opts.json]     uudnyttet for Groq — prompten styrer JSON, og
 *                                 kalderen udtrækker objektet via regex (matcher den
 *                                 oprindelige, fungerende scan-toy-adfærd).
 * @param {number} [opts.maxOutputTokens]
 * @param {number} [opts.temperature]
 * @returns {Promise<string>} modellens tekstsvar (trimmet, uden <think>…</think>)
 */
export async function visionAnalyze({ base64, mimeType, url, prompt, json = false, maxOutputTokens = 256, temperature = 0 }) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY mangler');
  const imageUrl = base64 ? `data:${mimeType || 'image/jpeg'};base64,${base64}` : url;
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Retry-med-backoff på rate-limit (429) — kort pause lader kaldet selv-hele.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: maxOutputTokens,
        temperature,
        reasoning_effort: 'none', // qwen3.6 er en thinking-model — slå reasoning fra
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        }],
      });
      // Strip evt. <think>…</think> som sikring hvis reasoning ikke slås helt fra.
      return (completion.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const isRateLimit = /429|too many requests|rate limit|rate_limit/i.test(msg);
      if (isRateLimit && attempt < 2) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
