import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();
  try {
    const { token, email, institution_name, invited_by } = await req.json();
    if (!token || !email || !institution_name) {
      return NextResponse.json({ error: 'Manglende felter' }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
    const inviteUrl = `${base}/invitasjon/${token}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'byt&leg <noreply@bytogleg.dk>',
        to: [email],
        subject: `Du er inviteret til ${institution_name} på byt&leg`,
        html: emailHtml(institution_name, invited_by, inviteUrl),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: 'E-mail kunne ikke sendes', detail: body }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function emailHtml(institutionName, invitedBy, inviteUrl) {
  const from = invitedBy
    ? `<strong style="color:#16221C">${invitedBy}</strong> har inviteret dig til at blive medarbejder hos`
    : 'Du er inviteret til at blive medarbejder hos';
  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);box-shadow:0 4px 24px rgba(22,34,28,0.07);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2D6A4F 100%);padding:40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
      <p style="color:rgba(255,255,255,0.65);margin:16px 0 0;font-size:14px;letter-spacing:0.02em;">Danmarks legetøjsbyttemarked for institutioner</p>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:26px;font-weight:800;color:#16221C;margin:0 0 16px;letter-spacing:-0.03em;">Du er inviteret!</h1>
      <p style="font-size:15px;color:#7B8F87;line-height:1.65;margin:0 0 28px;">
        ${from} <strong style="color:#16221C">${institutionName}</strong> på byt&amp;leg, platformen der giver legetøj et nyt liv mellem børnehaver, vuggestuer og skoler.
      </p>
      <div style="text-align:center;margin:36px 0;">
        <a href="${inviteUrl}" style="display:inline-block;background:#2D6A4F;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:17px 40px;border-radius:99px;letter-spacing:-0.01em;">Accepter invitation →</a>
      </div>
      <div style="background:#F0FAF5;border-left:3px solid #52B788;border-radius:0 10px 10px 0;padding:14px 18px;margin-top:28px;">
        <p style="font-size:13px;color:#2D6A4F;margin:0;font-weight:600;">Linket er gyldigt i 7 dage.</p>
        <p style="font-size:13px;color:#7B8F87;margin:6px 0 0;">Kender du ikke afsenderen? Se da bort fra denne e-mail.</p>
      </div>
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#7B8F87;margin:0;">byt&amp;leg &middot; <a href="https://bytogleg.dk" style="color:#2D6A4F;text-decoration:none;">bytogleg.dk</a> &middot; <a href="mailto:support@bytogleg.dk" style="color:#2D6A4F;text-decoration:none;">support@bytogleg.dk</a></p>
    </div>
  </div>
</body>
</html>`;
}
