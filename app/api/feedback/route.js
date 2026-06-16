import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { escapeHtml } from '@/lib/escape-html';

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export async function POST(req) {
  try {
    const body = await req.json();
    const category = String(body.category || 'general').slice(0, 50);
    const message = String(body.message || '').trim().slice(0, 5000);
    const institutionName = String(body.institutionName || '').slice(0, 200);
    const userEmail = String(body.userEmail || '').slice(0, 200);
    const page = String(body.page || '').slice(0, 500);
    const screenshotUrl = String(body.screenshotUrl || '').slice(0, 1000) || null;
    if (!message) return NextResponse.json({ error: 'Besked mangler' }, { status: 400 });

    // 1) Gem i DB først — altid, uanset om email-afsendelse lykkes
    const { error: dbErr } = await adminDb.from('feedback').insert({
      category: category || 'general',
      message,
      institution_name: institutionName || null,
      user_email: userEmail || null,
      page: page || null,
      screenshot_url: screenshotUrl,
    });
    if (dbErr) console.error('[feedback] DB insert fejl:', dbErr.message);

    // 2) Send notifikations-email (fejl her returnerer success — feedback er allerede gemt)
    if (process.env.RESEND_API_KEY) {
      const to = process.env.ADMIN_NOTIFICATION_EMAIL || 'mustaphakatamato@gmail.com';
      const categoryLabel = { bug: '🐛 Fejl/bug', suggestion: '💡 Forslag', general: '⭐ Generel feedback' }[category] || escapeHtml(category);
      const screenshotRow = screenshotUrl
        ? `<tr><td style="padding:8px 0;color:#6B7570;width:120px;vertical-align:top;">Screenshot</td><td style="padding:8px 0;"><a href="${escapeHtml(screenshotUrl)}" style="color:#1B4332;">Se billede</a></td></tr>`
        : '';

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'byt&leg <noreply@bytogleg.dk>',
          to: [to],
          subject: `[Pilot-feedback] ${categoryLabel} — ${institutionName || userEmail || 'Ukendt'}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <h2 style="color:#1B4332;margin:0 0 16px;">Ny pilot-feedback</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#6B7570;width:120px;vertical-align:top;">Kategori</td><td style="padding:8px 0;font-weight:600;">${categoryLabel}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7570;vertical-align:top;">Institution</td><td style="padding:8px 0;">${escapeHtml(institutionName) || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7570;vertical-align:top;">E-mail</td><td style="padding:8px 0;">${escapeHtml(userEmail) || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7570;vertical-align:top;">Side</td><td style="padding:8px 0;font-family:monospace;font-size:13px;">${escapeHtml(page) || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7570;vertical-align:top;">Besked</td><td style="padding:8px 0;white-space:pre-wrap;">${escapeHtml(message)}</td></tr>
                ${screenshotRow}
              </table>
              ${screenshotUrl ? `<img src="${escapeHtml(screenshotUrl)}" alt="Screenshot" style="margin-top:16px;max-width:100%;border-radius:8px;border:1px solid #e5e7eb;" />` : ''}
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        console.error('[feedback] Resend fejl:', emailRes.status, await emailRes.text());
      }
    } else {
      console.warn('[feedback] RESEND_API_KEY mangler — email ikke sendt');
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
