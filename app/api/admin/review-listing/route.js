import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { notify } from '@/lib/notify';
import { brandedEmail } from '@/lib/email-template';

// Escape brugerinput før det lægges ind i e-mail-HTML.
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();

  // Verify admin
  const { data: adminRow } = await supa.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: 'Ikke admin' }, { status: 403 });

  const { listing_id, action, reason } = await req.json();
  if (!listing_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Ugyldige parametre' }, { status: 400 });
  }
  if (action === 'reject' && !reason?.trim()) {
    return NextResponse.json({ error: 'Begrundelse er påkrævet ved afvisning' }, { status: 400 });
  }

  // Fetch listing + institution_id for notification
  const { data: listing } = await supa
    .from('listings')
    .select('id, title, institution_name, review_status')
    .eq('id', listing_id)
    .maybeSingle();

  // Look up institution_id so RLS SELECT on notifications works for the seller
  let institutionId = null;
  if (listing?.institution_name) {
    const { data: inst } = await supa
      .from('institutions')
      .select('id')
      .eq('name', listing.institution_name)
      .maybeSingle();
    institutionId = inst?.id || null;
  }

  if (!listing) return NextResponse.json({ error: 'Opslag ikke fundet' }, { status: 404 });
  if (listing.review_status !== 'pending') {
    return NextResponse.json({ error: 'Opslaget er ikke i afventende tilstand' }, { status: 409 });
  }

  if (action === 'approve') {
    await supa.from('listings').update({
      review_status: 'approved',
      is_active: true,
      review_reason: null,
    }).eq('id', listing_id);

    await notify(supa, {
      institutionId,
      institutionName: listing.institution_name,
      type: 'listing_review_approved',
      title: 'Dit opslag er godkendt! 🎉',
      body: `Dit opslag "${listing.title}" er godkendt og er nu live på markedspladsen.`,
      data: { listing_id: listing.id, listing_title: listing.title },
      url: `/opslag/${listing.id}`,
    }).catch(() => {});
  } else {
    await supa.from('listings').delete().eq('id', listing_id);

    // Mail med mulighed for at være uenig → knap åbner supportchatten med en
    // fortekst om det afviste opslag, så support med det samme kan se hvilket
    // opslag og hvilken begrundelse institutionen er uenig i.
    // (?support=uenig&opslag=<titel>&grund=<begrundelse>)
    const grund = reason.trim().slice(0, 300);
    const supportUrl = `https://bytogleg.dk/?support=uenig&opslag=${encodeURIComponent(listing.title || '')}&grund=${encodeURIComponent(grund)}`;
    const rejectHtml = brandedEmail({
      heading: 'Dit opslag kunne ikke godkendes',
      bodyHtml: `
        <p style="margin:0 0 14px;">Vi har gennemgået dit opslag <strong>&ldquo;${esc(listing.title)}&rdquo;</strong>, men det kunne desværre ikke godkendes denne gang.</p>
        <p style="margin:0 0 14px;"><strong>Begrundelse:</strong> ${esc(reason.trim())}</p>
        <div style="background:#F6F2EA;border-radius:12px;padding:16px 18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-weight:700;color:#16221C;">Er du uenig i afgørelsen?</p>
          <p style="margin:0;">Tror du, vi har taget fejl? Tryk på knappen nedenfor — så åbner vi vores supportchat med det samme, og en fra teamet kigger på sagen igen.</p>
        </div>`,
      ctaText: 'Jeg er uenig – kontakt support',
      ctaUrl: supportUrl,
      preheader: `Dit opslag "${listing.title}" kunne ikke godkendes`,
    });

    await notify(supa, {
      institutionId,
      institutionName: listing.institution_name,
      type: 'listing_review_rejected',
      title: 'Dit opslag kunne ikke godkendes',
      body: `Dit opslag "${listing.title}" kunne ikke godkendes. Begrundelse: ${reason.trim()}`,
      data: { listing_id: listing.id, listing_title: listing.title, reason: reason.trim() },
      emailHtml: rejectHtml,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
