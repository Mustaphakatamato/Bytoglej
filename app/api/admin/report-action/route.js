import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

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

  // Find institution_id så sælgeren kan se notifikationen (RLS)
  let institutionId = null;
  if (listing.institution_name) {
    const { data: inst } = await supa
      .from('institutions')
      .select('id')
      .eq('name', listing.institution_name)
      .maybeSingle();
    institutionId = inst?.id || null;
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
  }

  return NextResponse.json({ ok: true });
}
