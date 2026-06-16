import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabase-server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { escapeHtml } from '@/lib/escape-html';

// POST — generate a password recovery link and email it (admin only).
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const adminDb = createServerClient();
  const { data: adminCheck } = await adminDb.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { email } = await req.json();
    const targetEmail = String(email || '').trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json({ error: 'Ugyldig e-mail' }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
    const { data: linkData, error: linkError } = await adminDb.auth.admin.generateLink({
      type: 'recovery',
      email: targetEmail,
      options: { redirectTo: `${base}/login` },
    });
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) return NextResponse.json({ error: 'Kunne ikke generere link' }, { status: 500 });

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'byt&leg <noreply@bytogleg.dk>',
        to: targetEmail,
        subject: 'Nulstil din adgangskode til byt&leg',
        html: `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08)">
            <div style="background:linear-gradient(160deg,#1B4332 0%,#2D6A4F 100%);padding:36px;text-align:center">
              <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.04em">byt<span style="opacity:0.6">&amp;</span>leg.</span>
            </div>
            <div style="padding:36px">
              <h1 style="font-size:22px;font-weight:800;color:#16221C;margin:0 0 14px">Nulstil din adgangskode</h1>
              <p style="font-size:15px;color:#7B8F87;line-height:1.6;margin:0 0 24px">En administrator har anmodet om at nulstille adgangskoden for <strong style="color:#16221C">${escapeHtml(targetEmail)}</strong>. Klik på knappen herunder for at vælge en ny adgangskode.</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${actionLink}" style="display:inline-block;background:#2D6A4F;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 38px;border-radius:99px">Nulstil adgangskode →</a>
              </div>
              <p style="font-size:12px;color:#7B8F87;line-height:1.6">Hvis du ikke har anmodet om dette, kan du ignorere denne e-mail.</p>
            </div>
          </div>
        `,
      }).catch(() => {});
    }

    await adminDb.from('admin_audit_log').insert({
      admin_id: user.id,
      admin_email: user.email,
      action: 'reset_password',
      target_type: 'user',
      target_id: null,
      target_name: targetEmail,
      details: {},
    });

    return NextResponse.json({ ok: true, emailed: !!process.env.RESEND_API_KEY });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
