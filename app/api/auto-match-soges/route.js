import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();
  try {
    const { mode, listingId, category, age_group, condition, title, urgency,
            institutionName, institutionId } = await req.json();

    if (!mode || !listingId) return NextResponse.json({ matched: 0 });

    const notifications = [];

    if (mode === 'new-søges') {
      // A new "søges" was created — find existing active listings that match
      let q = supabase
        .from('listings')
        .select('id, title, institution_name, user_id, category, age_group, condition')
        .eq('is_active', true)
        .eq('is_sold', false)
        .neq('type', 'søges');

      if (category) q = q.eq('category', category);
      if (age_group) q = q.eq('age_group', age_group);

      const { data: matches } = await q.limit(50);
      if (matches?.length) {
        const seen = new Set();
        for (const m of matches) {
          // Skip same institution
          if (m.institution_name === institutionName) continue;
          const key = m.institution_name || m.user_id;
          if (seen.has(key)) continue;
          seen.add(key);

          notifications.push({
            institution_name: m.institution_name,
            type: 'auto_match_soges',
            title: `Nogen søger noget du måske har!`,
            body: `${institutionName || 'En institution'} leder efter "${title}" — dit opslag "${m.title}" kan måske matche.`,
            data: { søgesListingId: listingId, matchedListingId: m.id, søgesTitle: title },
          });
        }
      }
    } else if (mode === 'new-listing') {
      // A new regular listing was created — find active søges that match
      let q = supabase
        .from('listings')
        .select('id, title, institution_name, user_id, category, age_group, urgency')
        .eq('is_active', true)
        .eq('type', 'søges');

      if (category) q = q.eq('category', category);
      if (age_group) q = q.eq('age_group', age_group);

      const { data: søgesMatches } = await q.limit(50);
      if (søgesMatches?.length) {
        const seen = new Set();
        for (const s of søgesMatches) {
          if (s.institution_name === institutionName) continue;
          const key = s.institution_name || s.user_id;
          if (seen.has(key)) continue;
          seen.add(key);

          notifications.push({
            institution_name: s.institution_name,
            type: 'auto_match_listing',
            title: `Et nyt opslag matcher din søgning!`,
            body: `"${title}" fra ${institutionName || 'en institution'} matcher din søgning "${s.title}".`,
            data: { søgesListingId: s.id, matchedListingId: listingId, matchedTitle: title },
          });
        }
      }
    }

    if (!notifications.length) return NextResponse.json({ matched: 0 });

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      // Table may not exist yet — fail silently
      return NextResponse.json({ matched: 0, note: 'notifications table not ready' });
    }

    return NextResponse.json({ matched: notifications.length });
  } catch (e) {
    return NextResponse.json({ matched: 0, error: e.message });
  }
}
