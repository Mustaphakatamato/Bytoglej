import { NextResponse } from 'next/server';
export async function POST(req) {
  try {
    const { category, message, institutionName, userEmail, page } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Besked mangler' }, { status: 400 });

    if (!process.env.RESEND_API_KEY) {
      console.error('[feedback] RESEND_API_KEY er ikke sat');
      return NextResponse.json({ error: 'E-mail ikke konfigureret (RESEND_API_KEY mangler)' }, { status: 500 });
    }

    const to = process.env.ADMIN_NOTIFICATION_EMAIL || 'mustaphakatamato@gmail.com';
    const categoryLabel = { bug: '🐛 Fejl/bug', suggestion: '💡 Forslag', general: '⭐ Generel feedback' }[category] || category;

    const res = await fetch('https://api.resend.com/emails', {
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
              <tr><td style="padding:8px 0;color:#6B7570;vertical-align:top;">Institution</td><td style="padding:8px 0;">${institutionName || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7570;vertical-align:top;">E-mail</td><td style="padding:8px 0;">${userEmail || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7570;vertical-align:top;">Side</td><td style="padding:8px 0;font-family:monospace;font-size:13px;">${page || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7570;vertical-align:top;">Besked</td><td style="padding:8px 0;white-space:pre-wrap;">${message.trim()}</td></tr>
            </table>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[feedback] Resend fejl:', res.status, detail);
      return NextResponse.json({ error: `Resend fejlede (${res.status})`, detail }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
