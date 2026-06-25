import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { escapeHtml } from '@/lib/escape-html';

// Admin-handlinger på et rapporteret opslag: gør inaktivt eller slet — begge med
// en notifikation til sælger. Spejler mønstret i /api/admin/review-listing.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();

  // Verificér admin
  const { data: adminRow } = await supa.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: 'Ikke admin' }, { status: 403 });

  const { report_id, action, message } = await req.json();
  if (!report_id || !['deactivate', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'Ugyldige parametre' }, { status: 400 });
  }
  if (action === 'delete' && !message?.trim()) {
    return NextResponse.json({ error: 'Begrundelse er påkrævet ved sletning' }, { status: 400 });
  }

  // Hent rapporten + tilknyttet opslag
  const { data: report } = await supa
    .from('listing_reports')
    .select('id, listing_id')
    .eq('id', report_id)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: 'Rapport ikke fundet' }, { status: 404 });
  if (!report.listing_id) return NextResponse.json({ error: 'Opslaget findes ikke længere' }, { status: 409 });

  const { data: listing } = await supa
    .from('listings')
    .select('id, title, institution_name')
    .eq('id', report.listing_id)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: 'Opslag ikke fundet' }, { status: 404 });

  // Find institution_id + e-mail så sælgeren kan få notifikation (RLS) og mail
  let institutionId = null;
  let sellerEmail = null;
  let sellerContact = null;
  if (listing.institution_name) {
    const { data: inst } = await supa
      .from('institutions')
      .select('id, email, contact_name')
      .eq('name', listing.institution_name)
      .maybeSingle();
    institutionId = inst?.id || null;
    sellerEmail = inst?.email || null;
    sellerContact = inst?.contact_name || null;
  }

  const trimmed = (message || '').trim();

  if (action === 'deactivate') {
    await supa.from('listings').update({ is_active: false }).eq('id', listing.id);

    await supa.from('notifications').insert({
      institution_id: institutionId,
      institution_name: listing.institution_name,
      type: 'listing_deactivated',
      title: 'Dit opslag er gjort inaktivt',
      body: trimmed
        ? `Dit opslag "${listing.title}" er gjort inaktivt af byt&leg. ${trimmed}`
        : `Dit opslag "${listing.title}" er gjort inaktivt af byt&leg efter en indberetning.`,
      data: { listing_id: listing.id, listing_title: listing.title, message: trimmed || null },
    }).catch(() => {});

    // Marker rapporten som behandlet (opslaget findes stadig)
    await supa.from('listing_reports').update({
      status: 'reviewed',
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
    }).eq('id', report.id);
  } else {
    // Notificér FØR sletning — listing_reports slettes via ON DELETE CASCADE
    await supa.from('notifications').insert({
      institution_id: institutionId,
      institution_name: listing.institution_name,
      type: 'listing_removed',
      title: 'Dit opslag er fjernet',
      body: `Dit opslag "${listing.title}" er fjernet af byt&leg. Begrundelse: ${trimmed}`,
      data: { listing_id: listing.id, listing_title: listing.title, reason: trimmed },
    }).catch(() => {});

    await supa.from('listings').delete().eq('id', listing.id);

    // Send e-mail til sælger med begrundelsen
    if (sellerEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'byt&leg <noreply@bytogleg.dk>',
          to: sellerEmail,
          subject: `Dit opslag "${listing.title}" er fjernet`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
              <h2 style="color:#133F2B;margin:0 0 16px">Dit opslag er fjernet</h2>
              <p style="font-size:14px;color:#16221c;line-height:1.6;margin:0 0 12px">Hej ${escapeHtml(sellerContact || listing.institution_name || '')},</p>
              <p style="font-size:14px;color:#16221c;line-height:1.6;margin:0 0 16px">
                Vi har fjernet dit opslag <strong>"${escapeHtml(listing.title)}"</strong> fra byt&amp;leg.
              </p>
              <div style="background:#FEF2F2;border-left:3px solid #DC2626;border-radius:8px;padding:14px 16px;margin:0 0 16px">
                <div style="font-size:12px;color:#991B1B;font-weight:700;margin-bottom:4px">Begrundelse</div>
                <div style="font-size:14px;color:#16221c;white-space:pre-wrap">${escapeHtml(trimmed)}</div>
              </div>
              <p style="font-size:13px;color:#6B7570;line-height:1.6;margin:0">
                Har du spørgsmål, kan du svare på denne mail eller kontakte os via support.
              </p>
            </div>
          `,
        });
      } catch (e) {
        console.error('[report-action] e-mail til sælger fejlede:', e.message);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
