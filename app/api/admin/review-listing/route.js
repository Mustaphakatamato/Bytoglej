import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { notify } from '@/lib/notify';

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

    await notify(supa, {
      institutionId,
      institutionName: listing.institution_name,
      type: 'listing_review_rejected',
      title: 'Dit opslag kunne ikke godkendes',
      body: `Dit opslag "${listing.title}" kunne ikke godkendes. Begrundelse: ${reason.trim()}`,
      data: { listing_id: listing.id, listing_title: listing.title, reason: reason.trim() },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
