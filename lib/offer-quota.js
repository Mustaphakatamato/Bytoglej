import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution } from '@/lib/institution-server';

// Anti-spam: hvor mange tilbud en køber må sende pr. kalenderdag.
export const DAILY_OFFER_LIMIT = 20;

// Kalenderdato i Europe/Copenhagen som "YYYY-MM-DD" (til dagligt loft).
export function cphDate(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

// Antal tilbud køberen har sendt i dag (Copenhagen-kalenderdag).
// Henter et lille 36-timers vindue og tæller dagens i JS for at undgå
// tidszone-matematik i SQL.
export async function offersUsedToday(supa, { buyerInstitutionId, buyerId }) {
  const windowStart = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  let q = supa.from('offers')
    .select('id, created_at')
    .eq('proposed_by', 'buyer')
    .gte('created_at', windowStart);
  q = buyerInstitutionId ? q.eq('buyer_institution_id', buyerInstitutionId) : q.eq('buyer_id', buyerId);
  const { data } = await q;
  const today = cphDate(new Date());
  return (data || []).filter(o => cphDate(new Date(o.created_at)) === today).length;
}

// Resterende tilbud i dag for den aktuelle bruger.
export async function getOfferQuota(user) {
  const supa = createServerClient();
  const buyerInst = await resolveCallerInstitution(supa, user);
  const used = await offersUsedToday(supa, {
    buyerInstitutionId: buyerInst?.id || null,
    buyerId: user.id,
  });
  return { used, remainingToday: Math.max(0, DAILY_OFFER_LIMIT - used), dailyLimit: DAILY_OFFER_LIMIT };
}
