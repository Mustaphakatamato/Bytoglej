import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { sendPushToUser } from '@/lib/push';

export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();
  try {
    const { ownerEmail, ownerName, senderName, listingTitle, listingEmoji, convId } =
      await req.json();

    if (!ownerEmail) {
      return NextResponse.json({ error: 'ownerEmail er påkrævet' }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
    const link = `${base}/beskeder`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'byt&leg <noreply@bytogleg.dk>',
        to: [ownerEmail],
        subject: `${senderName} har sendt dig en besked om ${listingEmoji} ${listingTitle}`,
        html: emailHtml({ ownerName, senderName, listingTitle, listingEmoji, link }),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: 'E-mail kunne ikke sendes', detail: body }, { status: 502 });
    }

    // Send push notification to recipient (fire-and-forget)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VAPID_PRIVATE_KEY) {
      try {
        const adminSupa = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false } }
        );
        const { data: { users } } = await adminSupa.auth.admin.listUsers({ perPage: 1000 });
        const owner = users?.find(u => u.email?.toLowerCase() === ownerEmail.toLowerCase());
        if (owner?.id) {
          sendPushToUser(owner.id, {
            title: `${senderName} har sendt dig en besked`,
            body: `${listingEmoji || ''} ${listingTitle}`.trim(),
            url: '/beskeder',
          });
        }
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function emailHtml({ ownerName, senderName, listingTitle, listingEmoji, link }) {
  const greeting = ownerName ? `Hej ${ownerName},` : 'Hej,';
  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);box-shadow:0 4px 24px rgba(22,34,28,0.07);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2A7D4F 100%);padding:40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
      <p style="color:rgba(255,255,255,0.65);margin:16px 0 0;font-size:14px;letter-spacing:0.02em;">Danmarks legetøjsbyttemarkeds for institutioner</p>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:24px;font-weight:800;color:#16221C;margin:0 0 8px;letter-spacing:-0.03em;">Ny besked!</h1>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 24px;">${greeting}</p>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 28px;">
        <strong style="color:#16221C">${senderName}</strong> har sendt dig en besked om dit opslag
        <strong style="color:#16221C">${listingEmoji} ${listingTitle}</strong>.
      </p>
      <div style="text-align:center;margin:36px 0;">
        <a href="${link}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:17px 40px;border-radius:99px;letter-spacing:-0.01em;">Se besked →</a>
      </div>
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#6B7570;margin:0;">byt&amp;leg &middot; <a href="https://bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">bytogleg.dk</a> &middot; <a href="mailto:support@bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">support@bytogleg.dk</a></p>
    </div>
  </div>
</body>
</html>`;
}
