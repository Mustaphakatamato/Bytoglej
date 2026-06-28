import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { checkIsAdmin } from '@/lib/admin';
import { SUPPORT_FACTS } from '@/lib/support-knowledge';
import { helpArticleIndexForAI } from '@/lib/help-content';

export const maxDuration = 30;

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// Admin-only helper. Drafts a reply (or summarises the problem) for a support agent.
// Unlike the customer bot, this writes FOR a human who reviews before sending — but it
// still must not invent facts. Where it isn't sure, it flags what the agent should check.
const SYSTEM_PROMPT = `Du er en intern assistent for byt&legs supportteam. Du hjælper en menneskelig medarbejder med at besvare henvendelser hurtigt.

REGLER:
- Skriv på dansk, venligt og professionelt — som en supportmedarbejder hos byt&leg.
- Brug KUN de verificerede fakta nedenfor. Find ALDRIG på priser, regler, datoer eller løfter.
- Hvis henvendelsen kræver noget du ikke kan vide (en konkret ordre, konto, betaling, et bestemt opslag), så lad være med at gætte: skriv et udkast der beder om de nødvendige oplysninger, ELLER skriv kort hvad medarbejderen selv skal slå op/tjekke. Marker den slags med "[TJEK:]".
- Lov aldrig noget der ikke fremgår af fakta (fx EAN-fakturering eller automatisk udbetaling — de findes ikke endnu).
- Hold udkastet kort og brugbart (typisk 2-5 sætninger). Ingen emoji.

---
${SUPPORT_FACTS}
---

${helpArticleIndexForAI()}

Du må gerne lade udkastet henvise kunden til en relevant hjælpeartikel med dens sti (fx /hjaelp/artikel/opret-opslag-med-ai). Brug kun stier fra listen.

Svar i dette JSON-format:
{"draft": "dit svarudkast til kunden", "summary": "1 sætning: hvad handler henvendelsen om / hvad er problemet", "needs_info": ["evt. ting medarbejderen bør tjekke eller spørge om"]}`;

const ROLE_LABEL = { user: 'KUNDE', bot: 'AI-BOT', admin: 'SUPPORT' };

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();
  if (!await checkIsAdmin(user.id)) return UNAUTHORIZED();

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY ikke konfigureret' }, { status: 500 });
  }

  const body = await req.json();
  const conversationId = body.conversationId;
  if (!conversationId) return NextResponse.json({ error: 'conversationId mangler' }, { status: 400 });
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim().slice(0, 500) : '';

  // Load the conversation + messages
  const { data: conv } = await adminDb
    .from('support_conversations')
    .select('user_name, institution_name')
    .eq('id', conversationId).maybeSingle();
  const { data: msgs } = await adminDb
    .from('support_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(40);

  if (!msgs || !msgs.length) {
    return NextResponse.json({ error: 'Ingen beskeder i samtalen' }, { status: 400 });
  }

  const transcript = msgs.map(m => `${ROLE_LABEL[m.role] || m.role}: ${m.content}`).join('\n');
  const who = conv?.institution_name || conv?.user_name || 'Ukendt institution';

  const userPrompt = `Henvendelse fra: ${who}

SAMTALE INDTIL NU:
${transcript}
${instruction ? `\nMEDARBEJDERENS INSTRUKTION TIL DIG: ${instruction}` : ''}

Lav et svarudkast medarbejderen kan sende (eller redigere) til kunden. Svar KUN med JSON.`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b', // erstatter udfaset llama-3.3-70b-versatile (Groq shutdown 2026-08-16)
      max_tokens: 1024,
      temperature: 0.3,
      reasoning_effort: 'low', // gpt-oss er reasoning-model — giv plads til JSON efter reasoning
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    const parsed = JSON.parse(completion.choices[0].message.content);
    return NextResponse.json({
      draft: typeof parsed.draft === 'string' ? parsed.draft : '',
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      needs_info: Array.isArray(parsed.needs_info) ? parsed.needs_info.filter(x => typeof x === 'string') : [],
    });
  } catch (e) {
    console.error('support-assist error:', e.message);
    return NextResponse.json({ error: 'AI-forslag fejlede. Prøv igen.' }, { status: 500 });
  }
}
