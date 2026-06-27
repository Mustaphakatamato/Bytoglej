import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { notify } from '@/lib/notify';
import { escapeHtml } from '@/lib/escape-html';
import { brandedEmail } from '@/lib/email-template';

// Admin-handlinger på et rapporteret opslag: aktivér/inaktivér eller slet.
// Alle sender notifikation + e-mail til sælger. Spejler /api/admin/review-listing.
const FROM = 'byt&leg <noreply@bytogleg.dk>';

function sellerEmailHtml({ heading, contact, intro, reason }) {
  return brandedEmail({
    heading,
    bodyHtml: `
      <p style="margin:0 0 12px">Hej ${escapeHtml(contact || '')},</p>
      <p style="margin:0 0 16px">${intro}</p>
      ${reason ? `<div style="background:#FEF2F2;border-left:3px solid #DC2626;border-radius:8px;padding:14px 16px;margin:0 0 16px">
        <div style="font-size:12px;color:#991B1B;font-weight:700;margin-bottom:4px">Begrundelse</div>
        <div style="font-size:14px;color:#16221c;white-space:pre-wrap">${escapeHtml(reason)}</div>
      </div>` : ''}
      <p style="font-size:13px;color:#6B7570;line-height:1.6;margin:0">Har du spørgsmål, kan du svare på denne mail eller kontakte os via support.</p>
    `,
  });
}

async function sendSellerEmail(to, subject, html) {
  if (!to || !process.env.RESEND_API_KEY) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (e) {
    console.error('[report-action] e-mail til sælger fejlede:', e.message);
  }
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();

  // Verificér admin
  const { data: adminRow } = await supa.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: 'Ikke admin' }, { status: 403 });

  const { report_id, action, message } = await req.json();
  if (!report_id || !['activate', 'deactivate', 'delete'].includes(action)) {
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
    .select('id, title, institution_name, is_active')
    .eq('id', report.listing_id)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: 'Opslag ikke fundet' }, { status: 404 });

  // Find institution_id + e-mail så sælger kan få notifikation (RLS) og mail
  let institutionId = null, sellerEmail = null, sellerContact = null;
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
  const contactName = sellerContact || listing.institution_name || '';

  // Snapshot af opslaget på rapporten, så historik overlever en sletning
  const snapshot = { listing_title: listing.title, listing_institution_name: listing.institution_name };

  if (action === 'deactivate') {
    await supa.from('listings').update({ is_active: false }).eq('id', listing.id);
    await notify(supa, {
      institutionId, institutionName: listing.institution_name, sendEmail: false, // e-mail sendes nedenfor med pænere skabelon
      type: 'listing_deactivated',
      title: 'Dit opslag er gjort inaktivt',
      body: trimmed
        ? `Dit opslag "${listing.title}" er gjort inaktivt af byt&leg. ${trimmed}`
        : `Dit opslag "${listing.title}" er gjort inaktivt af byt&leg efter en indberetning.`,
      data: { listing_id: listing.id, listing_title: listing.title, message: trimmed || null },
      url: '/mine-opslag',
    }).catch(() => {});
    await supa.from('listing_reports').update({ ...snapshot, resolution: 'deactivated' }).eq('id', report.id);
    await sendSellerEmail(sellerEmail, `Dit opslag "${listing.title}" er gjort inaktivt`,
      sellerEmailHtml({
        heading: 'Dit opslag er gjort inaktivt',
        contact: contactName,
        intro: `Vi har gjort dit opslag <strong>"${escapeHtml(listing.title)}"</strong> inaktivt på byt&amp;leg, så det ikke længere er synligt på markedspladsen.`,
        reason: trimmed || null,
      }));
  } else if (action === 'activate') {
    await supa.from('listings').update({ is_active: true }).eq('id', listing.id);
    await notify(supa, {
      institutionId, institutionName: listing.institution_name, sendEmail: false,
      type: 'listing_activated',
      title: 'Dit opslag er aktivt igen',
      body: `Dit opslag "${listing.title}" er aktivt igen og synligt på markedspladsen.`,
      data: { listing_id: listing.id, listing_title: listing.title },
      url: `/opslag/${listing.id}`,
    }).catch(() => {});
    await supa.from('listing_reports').update({ ...snapshot, resolution: null }).eq('id', report.id);
    await sendSellerEmail(sellerEmail, `Dit opslag "${listing.title}" er aktivt igen`,
      sellerEmailHtml({
        heading: 'Dit opslag er aktivt igen',
        contact: contactName,
        intro: `Dit opslag <strong>"${escapeHtml(listing.title)}"</strong> er nu aktivt igen og synligt på markedspladsen.`,
        reason: null,
      }));
  } else { // delete
    // Marker rapporten som behandlet FØR sletning (FK SET NULL bevarer rækken)
    await supa.from('listing_reports').update({
      ...snapshot,
      status: 'removed',
      resolution: 'removed',
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
    }).eq('id', report.id);
    await notify(supa, {
      institutionId, institutionName: listing.institution_name, sendEmail: false,
      type: 'listing_removed',
      title: 'Dit opslag er fjernet',
      body: `Dit opslag "${listing.title}" er fjernet af byt&leg. Begrundelse: ${trimmed}`,
      data: { listing_id: listing.id, listing_title: listing.title, reason: trimmed },
      url: '/mine-opslag',
    }).catch(() => {});
    await supa.from('listings').delete().eq('id', listing.id);
    await sendSellerEmail(sellerEmail, `Dit opslag "${listing.title}" er fjernet`,
      sellerEmailHtml({
        heading: 'Dit opslag er fjernet',
        contact: contactName,
        intro: `Vi har fjernet dit opslag <strong>"${escapeHtml(listing.title)}"</strong> fra byt&amp;leg.`,
        reason: trimmed,
      }));
  }

  return NextResponse.json({ ok: true, is_active: action === 'activate' });
}
