import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

function wordOverlap(a, b) {
  if (!a || !b) return 0;
  const normalize = s => s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const aWords = new Set(normalize(a));
  const bWords = new Set(normalize(b));
  if (!aWords.size) return 0;
  return [...aWords].filter(w => bWords.has(w)).length / aWords.size;
}

export async function PATCH(req, { params }) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const { id } = await params;
  const body = await req.json();
  const { final_title, final_description, final_category, final_condition, final_age_group, final_price, listing_id } = body;

  const supa = createServerClient();

  // Hent eksisterende log for at beregne deltas
  const { data: existing } = await supa
    .from('ai_scan_logs')
    .select('user_id, ai_title, ai_description, ai_price_suggested')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  }

  // Beregn metrics
  const usedTitle = !!ai_title && !!final_title &&
    final_title.trim().toLowerCase() === existing.ai_title?.trim().toLowerCase();

  const usedDescription = wordOverlap(existing.ai_description, final_description) >= 0.7;

  let usedPrice = null, priceDelta = null, priceDeltaPct = null;
  const aiPrice = existing.ai_price_suggested;
  const finalPriceNum = Number(final_price);
  if (aiPrice && finalPriceNum) {
    priceDelta = finalPriceNum - aiPrice;
    priceDeltaPct = Math.round((priceDelta / aiPrice) * 10000) / 100;
    usedPrice = Math.abs(priceDeltaPct) <= 15;
  }

  const { error } = await supa
    .from('ai_scan_logs')
    .update({
      listing_id: listing_id || null,
      final_title: final_title || null,
      final_description: final_description || null,
      final_category: final_category || null,
      final_condition: final_condition || null,
      final_age_group: final_age_group || null,
      final_price: finalPriceNum || null,
      used_title: usedTitle,
      used_description: usedDescription,
      used_price: usedPrice,
      price_delta: priceDelta,
      price_delta_pct: priceDeltaPct,
      submitted: true,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('ai-scan-logs PATCH error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
