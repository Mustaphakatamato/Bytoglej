import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { checkIsAdmin } from '@/lib/admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();
  const isAdmin = await checkIsAdmin(user.id);
  if (!isAdmin) return NextResponse.json({ error: 'Kun admins' }, { status: 403 });

  try {
    const { institutionId, action, note } = await req.json();
    if (!institutionId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Ugyldig anmodning' }, { status: 400 });
    }

    // Fetch institution to get email + name
    const { data: inst } = await supabase.from('institutions').select('name,email,contact_name').eq('id', institutionId).maybeSingle();
    if (!inst) return NextResponse.json({ error: 'Institution ikke fundet' }, { status: 404 });

    if (action === 'approve') {
      await supabase.from('institutions').update({ is_approved: true, approved_at: new Date().toISOString() }).eq('id', institutionId);

      // Send approval email to institution
      if (process.env.RESEND_API_KEY) {
        const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'byt&leg <noreply@bytogleg.dk>',
            to: [inst.email],
            subject: 'Din institution er godkendt på byt&leg 🎉',
            html: `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);box-shadow:0 4px 24px rgba(22,34,28,0.07);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2D6A4F 100%);padding:40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:26px;font-weight:800;color:#16221C;margin:0 0 16px;">Velkommen til byt&amp;leg! 🎉</h1>
      <p style="font-size:15px;color:#7B8F87;line-height:1.65;margin:0 0 24px;">Hej ${inst.contact_name || inst.name},<br><br>Din institution <strong style="color:#16221C">${inst.name}</strong> er nu godkendt og du har fuld adgang til platformen.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${base}/dashboard" style="display:inline-block;background:#2D6A4F;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:17px 40px;border-radius:99px;">Gå til dashboard →</a>
      </div>
      ${note ? `<div style="background:#F0FAF5;border-left:3px solid #52B788;border-radius:0 10px 10px 0;padding:14px 18px;"><p style="font-size:13px;color:#2D6A4F;margin:0;font-weight:600;">Besked fra byt&amp;leg:</p><p style="font-size:13px;color:#7B8F87;margin:6px 0 0;">${note}</p></div>` : ''}
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#7B8F87;margin:0;">byt&amp;leg &middot; <a href="https://bytogleg.dk" style="color:#2D6A4F;text-decoration:none;">bytogleg.dk</a></p>
    </div>
  </div>
</body></html>`,
          }),
        }).catch(() => {});
      }
    } else {
      // Reject: delete institution record
      await supabase.from('institutions').delete().eq('id', institutionId);

      if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'byt&leg <noreply@bytogleg.dk>',
            to: [inst.email],
            subject: 'Opdatering om din ansøgning til byt&leg',
            html: `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2D6A4F 100%);padding:40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
    </div>
    <div style="padding:40px;">
      <p style="font-size:15px;color:#7B8F87;line-height:1.65;">Hej ${inst.contact_name || inst.name},<br><br>Vi har desværre ikke kunne godkende <strong style="color:#16221C">${inst.name}</strong> på nuværende tidspunkt.</p>
      ${note ? `<div style="background:#FEF2F2;border-left:3px solid #FCA5A5;border-radius:0 10px 10px 0;padding:14px 18px;margin:20px 0;"><p style="font-size:13px;color:#DC2626;margin:0;">${note}</p></div>` : ''}
      <p style="font-size:13px;color:#7B8F87;">Kontakt os på <a href="mailto:support@bytogleg.dk" style="color:#2D6A4F;">support@bytogleg.dk</a> hvis du har spørgsmål.</p>
    </div>
  </div>
</body></html>`,
          }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
