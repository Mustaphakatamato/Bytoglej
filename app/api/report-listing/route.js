import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { escapeHtml } from '@/lib/escape-html';
import { brandedEmail } from '@/lib/email-template';

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@bytogleg.dk';

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  try {
    const body = await req.json();
    // Rå værdier til DB-insert (escapes kun til email-HTML nedenfor)
    const rawListingId = String(body.listingId || '').slice(0, 100);
    const rawReason = String(body.reason || '').slice(0, 200);
    const rawNote = String(body.note || '').slice(0, 2000);
    const rawReporterEmail = String(body.reporterEmail || user.email || '').slice(0, 200);
    const rawReporterInstitution = String(body.reporterInstitution || '').slice(0, 200);
    if (!rawListingId || !rawReason) return NextResponse.json({ error: 'Mangler data' }, { status: 400 });

    // 1) Gem i DB først, så rapporten dukker op i admin — uanset om email lykkes
    const db = createServerClient();
    const { error: dbErr } = await db.from('listing_reports').insert({
      listing_id: rawListingId,
      reporter_email: rawReporterEmail || null,
      reporter_institution_name: rawReporterInstitution || null,
      reason: rawReason,
      details: rawNote || null,
    });
    if (dbErr) console.error('[report-listing] DB insert fejl:', dbErr.message);

    // 2) Send notifikations-email til admin
    const resend = new Resend(process.env.RESEND_API_KEY);
    const listingId = escapeHtml(rawListingId);
    const listingTitle = escapeHtml(String(body.listingTitle || '').slice(0, 200));
    const reason = escapeHtml(rawReason);
    const note = escapeHtml(rawNote);
    const reporterName = escapeHtml(rawReporterInstitution || rawReporterEmail || 'Ukendt');

    await resend.emails.send({
      from: 'byt&leg <noreply@bytogleg.dk>',
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `Rapporteret opslag: ${listingTitle || listingId}`,
      html: brandedEmail({
        heading: 'Opslag rapporteret',
        bodyHtml: `
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#666;width:140px">Opslag ID</td><td style="padding:8px 0;font-weight:600">${listingId}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Titel</td><td style="padding:8px 0;font-weight:600">${listingTitle || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Årsag</td><td style="padding:8px 0;font-weight:600;color:#e11d48">${reason}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Rapporteret af</td><td style="padding:8px 0">${reporterName || 'Ukendt'}</td></tr>
            ${note ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top">Note</td><td style="padding:8px 0">${note}</td></tr>` : ''}
          </table>`,
        ctaText: 'Gå til admin',
        ctaUrl: 'https://bytogleg.dk/admin',
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('report-listing error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
