// A4: "Følg en vare" via favoritter.
//
// Datamodel: vi GENBRUGER `listing_favorites` som følg/watch-relation
// (favorit = følg). Tabellen har allerede (listing_id, user_id, institution_id,
// institution_name), så ingen ny tabel er nødvendig — favorit og følg er smeltet
// sammen, som ønsket.
//
// notifyFollowersAvailable() kaldes når en (reserveret) vare bliver ledig igen
// — fx når en byttehandels betalingsfrist udløber uden betaling. Hver følger får
// besked på alle tre kanaler (klokke + e-mail + push) via den fælles notify().

import { notify } from '@/lib/notify';

/**
 * Notificér alle der følger (har som favorit) de angivne varer om at de er
 * til salg igen. Bruger en service-role supabase-klient.
 *
 * @param {object} supa        service-role klient
 * @param {string[]} listingIds varer der netop blev frigivet/ledige igen
 */
export async function notifyFollowersAvailable(supa, listingIds) {
  const ids = (listingIds || []).filter(Boolean);
  if (!ids.length) return;

  const [{ data: favs }, { data: listings }] = await Promise.all([
    supa.from('listing_favorites').select('listing_id, institution_id, institution_name').in('listing_id', ids),
    supa.from('listings').select('id, title, reserved_for_institution_id').in('id', ids),
  ]);
  if (!favs?.length) return;

  const titleById = new Map((listings || []).map(l => [l.id, l.title]));

  // Dedupér pr. (institution, vare) — én institution skal kun have én besked pr. vare.
  const seen = new Set();
  for (const f of favs) {
    const instKey = f.institution_id || f.institution_name;
    if (!instKey) continue;
    const key = `${instKey}|${f.listing_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const title = titleById.get(f.listing_id) || 'En vare du følger';
    await notify(supa, {
      institutionId: f.institution_id || null,
      institutionName: f.institution_name || null,
      type: 'followed_listing_available',
      title: 'En vare du følger er ledig igen 🔔',
      body: `"${title}" er til salg igen — vær hurtig hvis du vil sikre dig den.`,
      data: { listing_id: f.listing_id },
      url: `/opslag/${f.listing_id}`,
    }).catch(() => {});
  }
}
