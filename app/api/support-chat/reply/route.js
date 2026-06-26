import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { checkIsAdmin } from '@/lib/admin';
import { escapeHtml } from '@/lib/escape-html';

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// Email the user that support has replied. Best-effort — never blocks the reply.
async function notifyUser(conv, message) {
  if (!process.env.RESEND_API_KEY) return;
  const to = conv?.user_email;
  if (!to) return; // anonymous users without an email can't be notified
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
  const name = conv.user_name || conv.institution_name || '';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'byt&leg <noreply@bytogleg.dk>',
        to: [to],
        subject: 'Svar fra byt&leg support',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <h2 style="color:#1B4332;margin:0 0 16px;">Du har fået svar fra supporten</h2>
            <p style="color:#3A473D;font-size:15px;margin:0 0 16px;">${name ? `Hej ${escapeHtml(name)},` : 'Hej,'}</p>
            <p style="color:#3A473D;font-size:15px;margin:0 0 8px;">Vores supportteam har svaret på din henvendelse:</p>
            <div style="background:#E8F1EC;border-radius:12px;padding:16px 18px;color:#16221C;font-size:15px;line-height:1.6;white-space:pre-wrap;margin:0 0 20px;">${escapeHtml(message)}</div>
            <a href="${base}/kontakt" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;">Åbn chatten og svar</a>
            <p style="color:#6B7570;font-size:12px;margin:24px 0 0;">Du modtager denne mail fordi du har skrevet til byt&amp;leg support. Åbn chat-boblen på platformen for at fortsætte samtalen.</p>
          </div>
        `,
      }),
    });
    if (!res.ok) console.error('[support-reply] Resend fejl:', res.status, await res.text());
  } catch (e) {
    console.error('[support-reply] email fejl:', e.message);
  }
}

// Admin sends a reply in a support conversation, or changes its status.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();
  if (!await checkIsAdmin(user.id)) return UNAUTHORIZED();

  const body = await req.json();
  const conversationId = body.conversationId;
  if (!conversationId) return NextResponse.json({ error: 'conversationId mangler' }, { status: 400 });

  // Status-only update (e.g. close / reopen / claim)
  if (body.status && !body.message) {
    const allowed = ['bot', 'waiting_human', 'open', 'closed'];
    if (!allowed.includes(body.status)) return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 });
    await adminDb.from('support_conversations')
      .update({ status: body.status, admin_unread: 0 })
      .eq('id', conversationId);
    return NextResponse.json({ ok: true });
  }

  const message = String(body.message || '').trim().slice(0, 4000);
  if (!message) return NextResponse.json({ error: 'Ingen besked' }, { status: 400 });

  await adminDb.from('support_messages').insert({
    conversation_id: conversationId, role: 'admin', content: message,
  });

  const { data: conv } = await adminDb
    .from('support_conversations')
    .select('user_unread, user_email, user_name, institution_name')
    .eq('id', conversationId).single();

  await adminDb.from('support_conversations').update({
    status: 'open',
    last_message: message,
    last_message_at: new Date().toISOString(),
    user_unread: (conv?.user_unread || 0) + 1,
    admin_unread: 0,
  }).eq('id', conversationId);

  // Notify the user by email (best-effort, does not block the response)
  await notifyUser(conv, message);

  return NextResponse.json({ ok: true });
}
