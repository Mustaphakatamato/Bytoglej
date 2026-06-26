import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPPORT_FACTS } from '@/lib/support-knowledge';

export const maxDuration = 30;

// Service-role client. Support tables are locked to clients (see RLS migration);
// all persistence goes through this route, which treats the conversation UUID as a
// capability token. Admins use their own admin RLS policies in the admin module.
const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const SYSTEM_PROMPT = `Du er en supportassistent for byt&leg - en dansk B2B-markedsplads for institutioner.

ABSOLUT VIGTIGE REGLER - FØLG DEM ALTID:
1. Svar KUN på dansk
2. Svar KUN hvis du er 100% sikker baseret på fakta nedenfor
3. Hvis du er i tvivl, svar med: "Det ved jeg ikke med sikkerhed." og sæt escalate: true
4. Du MÅ ALDRIG gætte, spekulere eller opfinde information
5. Hvis brugeren spørger om noget specifikt (deres konto, en ordre, et opslag, en betaling) — svar ALTID at det kræver supportteamet og sæt escalate: true
6. Hold svar korte og præcise — max 3 sætninger
7. Du må ALDRIG love noget du ikke ved er sandt

ESKALÉR ALTID TIL MENNESKE (sæt escalate: true) HVIS:
- Spørgsmålet handler om en specifik ordre, konto, opslag eller betaling
- Du ikke kender svaret med 100% sikkerhed
- Brugeren er frustreret eller beder om at tale med en person
- Spørgsmålet handler om tekniske fejl eller bugs
- Spørgsmålet ikke er dækket af fakta nedenfor

---
${SUPPORT_FACTS}
---

Svar altid i dette JSON-format:
{"reply": "din besked her", "escalate": false}

Sæt escalate: true hvis du ikke kan hjælpe med sikkerhed, eller hvis brugeren skal tale med et menneske.`;

const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : null) || null;

async function runBot(message, history) {
  if (!process.env.GROQ_API_KEY) {
    return { reply: 'Chatbotten er ikke tilgængelig lige nu. Du kan sende din besked videre til vores supportteam.', escalate: true, reason: 'no_key' };
  }
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const recentHistory = (Array.isArray(history) ? history : []).slice(-10).map(m => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content,
    }));
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      temperature: 0.1, // Lav temperatur = mere faktuel, mindre kreativ
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...recentHistory,
        { role: 'user', content: message },
      ],
    });
    const parsed = JSON.parse(completion.choices[0].message.content);
    const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'Det ved jeg ikke med sikkerhed.';
    const escalate = parsed.escalate === true || !parsed.reply;
    return { reply, escalate, reason: escalate ? 'escalate' : null };
  } catch (e) {
    console.error('support-chat bot error:', e.message);
    return { reply: 'Beklager, der opstod en fejl. Du kan sende din besked videre til vores supportteam.', escalate: true, reason: 'error' };
  }
}

async function saveMessage(conversationId, role, content) {
  await adminDb.from('support_messages').insert({ conversation_id: conversationId, role, content });
}

// GET ?conversationId=X — load history for a conversation (capability = knowing the UUID).
export async function GET(req) {
  const conversationId = new URL(req.url).searchParams.get('conversationId');
  if (!conversationId) return NextResponse.json({ messages: [], status: null });

  const { data: conv } = await adminDb
    .from('support_conversations').select('status').eq('id', conversationId).maybeSingle();
  if (!conv) return NextResponse.json({ messages: [], status: null });

  const { data: msgs } = await adminDb
    .from('support_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return NextResponse.json({ messages: msgs || [], status: conv.status });
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const message = clean(body.message, 4000);
  const mode = body.mode === 'human' ? 'human' : body.mode === 'handoff' ? 'handoff' : 'bot';
  let conversationId = body.conversationId || null;

  // ── Ensure a conversation exists ──────────────────────────────────────────────
  if (!conversationId) {
    const { data: conv, error } = await adminDb.from('support_conversations').insert({
      user_id: body.userId || null,
      user_name: clean(body.userName),
      user_email: clean(body.userEmail),
      institution_name: clean(body.institutionName),
      status: mode === 'bot' ? 'bot' : 'waiting_human',
      last_message: message || '',
    }).select('id, status').single();
    if (error) {
      console.error('support-chat create conv error:', error.message);
      return NextResponse.json({ error: 'Kunne ikke oprette samtale' }, { status: 500 });
    }
    conversationId = conv.id;
  }

  // Update contact details if provided (e.g. guest fills in name/email at handoff)
  const contact = {};
  if (clean(body.userName))        contact.user_name = clean(body.userName);
  if (clean(body.userEmail))       contact.user_email = clean(body.userEmail);
  if (clean(body.institutionName)) contact.institution_name = clean(body.institutionName);

  // ── Handoff: just flag the conversation for a human, no new message ────────────
  if (mode === 'handoff') {
    const { data: c } = await adminDb.from('support_conversations').select('admin_unread').eq('id', conversationId).single();
    await adminDb.from('support_conversations').update({
      status: 'waiting_human',
      admin_unread: (c?.admin_unread || 0) + 1,
      ...contact,
    }).eq('id', conversationId);
    return NextResponse.json({ conversationId, humanMode: true });
  }

  if (!message) return NextResponse.json({ error: 'Ingen besked' }, { status: 400 });

  // Decide whether this conversation is in human mode already
  const { data: convRow } = await adminDb.from('support_conversations').select('status, admin_unread').eq('id', conversationId).single();
  const isHuman = mode === 'human' || ['waiting_human', 'open'].includes(convRow?.status);

  // Save the user message
  await saveMessage(conversationId, 'user', message);

  // ── Human mode: hand to support, no bot reply ─────────────────────────────────
  if (isHuman) {
    await adminDb.from('support_conversations').update({
      status: 'waiting_human',
      last_message: message,
      last_message_at: new Date().toISOString(),
      admin_unread: (convRow?.admin_unread || 0) + 1,
      ...contact,
    }).eq('id', conversationId);
    return NextResponse.json({ conversationId, humanMode: true });
  }

  // ── Bot mode ──────────────────────────────────────────────────────────────────
  const { reply, escalate, reason } = await runBot(message, body.history);
  await saveMessage(conversationId, 'bot', reply);
  await adminDb.from('support_conversations').update({
    last_message: reply,
    last_message_at: new Date().toISOString(),
    ...contact,
  }).eq('id', conversationId);

  // Log every escalation for future fine-tuning
  if (escalate) {
    try {
      await adminDb.from('support_bot_escalations').insert({
        conversation_id: conversationId,
        question: message,
        bot_reply: reply,
        history: (Array.isArray(body.history) ? body.history : []).slice(-10),
        reason: reason || 'escalate',
      });
    } catch (e) {
      console.error('support-chat escalation log error:', e.message);
    }
  }

  return NextResponse.json({ conversationId, reply, escalate });
}
