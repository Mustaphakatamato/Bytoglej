import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { escapeHtml } from '@/lib/escape-html';

export const maxDuration = 30;

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const ROLE_LABEL = { user: 'Dig', bot: 'AI-assistent', admin: 'byt&leg support', system: 'System' };

// Send a chat transcript to the user's email. Capability = knowing the conversation UUID.
// If the conversation has no email on file (anonymous), the caller must supply one.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const conversationId = body.conversationId;
  if (!conversationId) return NextResponse.json({ error: 'conversationId mangler' }, { status: 400 });

  const { data: conv } = await adminDb
    .from('support_conversations')
    .select('user_email, user_name, institution_name, created_at')
    .eq('id', conversationId).maybeSingle();
  if (!conv) return NextResponse.json({ error: 'Samtale findes ikke' }, { status: 404 });

  const provided = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const to = conv.user_email || provided;
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: 'needs_email' }, { status: 400 });
  }

  // Persist the email if we didn't already have it (so future replies can notify too)
  if (!conv.user_email && provided) {
    await adminDb.from('support_conversations').update({ user_email: provided }).eq('id', conversationId);
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'E-mail er ikke konfigureret' }, { status: 500 });
  }

  const { data: msgs } = await adminDb
    .from('support_messages')
    .select('role, content, message_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  const rows = (msgs || []).map(m => {
    const time = new Date(m.created_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (m.message_type === 'system') {
      return `<tr><td colspan="2" style="padding:8px 0;text-align:center;color:#6B7570;font-size:12px;font-style:italic;">${escapeHtml(m.content)}</td></tr>`;
    }
    let text = m.content;
    if (m.message_type === 'image') {
      try { const d = JSON.parse(m.content); text = `[Billede]${d.caption ? ' ' + d.caption : ''}` + (d.urls || []).map(u => `\n${u}`).join(''); } catch { text = '[Billede]'; }
    }
    const label = ROLE_LABEL[m.role] || m.role;
    const mine = m.role === 'user';
    return `<tr>
      <td style="padding:6px 10px;vertical-align:top;white-space:nowrap;color:#6B7570;font-size:12px;">${escapeHtml(time)}</td>
      <td style="padding:6px 10px;vertical-align:top;">
        <div style="font-weight:700;font-size:12px;color:${mine ? '#2A7D4F' : '#16221C'};margin-bottom:2px;">${escapeHtml(label)}</div>
        <div style="font-size:14px;color:#16221C;white-space:pre-wrap;">${escapeHtml(text)}</div>
      </td>
    </tr>`;
  }).join('');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'byt&leg <noreply@bytogleg.dk>',
        to: [to],
        subject: 'Din chat-udskrift fra byt&leg',
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;">
          <h2 style="color:#1B4332;margin:0 0 4px;">Din chat-udskrift</h2>
          <p style="color:#6B7570;font-size:13px;margin:0 0 20px;">Samtale med byt&amp;leg support</p>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #DAD3C4;">${rows || '<tr><td>Ingen beskeder</td></tr>'}</table>
          <p style="color:#6B7570;font-size:12px;margin:24px 0 0;">Du modtager denne udskrift fordi den blev anmodet i chatten. Spørgsmål? Skriv til support@bytogleg.dk</p>
        </div>`,
      }),
    });
    if (!res.ok) { console.error('[transcript] Resend fejl:', res.status, await res.text()); return NextResponse.json({ error: 'Kunne ikke sende' }, { status: 500 }); }
  } catch (e) {
    console.error('[transcript] fejl:', e.message);
    return NextResponse.json({ error: 'Kunne ikke sende' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: to });
}
