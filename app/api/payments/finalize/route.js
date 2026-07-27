import { NextResponse } from 'next/server';
import { getStripe, isStripePaymentIntentId } from '@/lib/stripe';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { finalizePurchase, handleSwapPayment, handleSwapProposalPayment } from '@/app/api/webhooks/stripe/route';

// Finaliserer en gennemført betaling synkront når køberen vender tilbage til
// /betaling/success. Kører SAMME idempotente logik som Stripe-webhooken, så
// visningerne (Mine køb, beskeder, sælgers status) er konsistente med det samme
// — også når webhooken er forsinket eller aldrig nåede frem (fx lokalt/staging).
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }
  const orderId = body.orderId;
  if (!orderId) return NextResponse.json({ error: 'Mangler ordre-id' }, { status: 400 });

  const supa = createServerClient();
  const { data: order } = await supa
    .from('orders')
    .select('id, buyer_id, payment_intent_id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Ordre ikke fundet' }, { status: 404 });
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Ingen adgang til denne ordre' }, { status: 403 });

  // Allerede finaliseret (af webhooken eller et tidligere kald) → intet at gøre.
  if (['paid', 'shipped', 'delivered'].includes(order.status)) {
    return NextResponse.json({ ok: true, status: order.status });
  }
  if (!order.payment_intent_id) return NextResponse.json({ ok: false, status: order.status });
  // Wallet-ordrer (syntetisk `wallet_…`-id) finaliseres allerede i create-intent.
  if (!isStripePaymentIntentId(order.payment_intent_id)) {
    return NextResponse.json({ ok: false, status: order.status });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    console.error('[finalize] Stripe-konfiguration:', e.message);
    return NextResponse.json({ error: 'Stripe ikke konfigureret' }, { status: 500 });
  }

  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(order.payment_intent_id);
  } catch (e) {
    console.error('[finalize] Kunne ikke hente PaymentIntent:', e.message);
    return NextResponse.json({ error: 'Kunne ikke hente betalingsstatus' }, { status: 502 });
  }

  // Kun finaliser hvis betalingen faktisk er gennemført. Ellers er webhooken fallback.
  if (pi.status !== 'succeeded') {
    return NextResponse.json({ ok: false, status: order.status, payment_status: pi.status });
  }

  try {
    if (pi.metadata?.type === 'swap') {
      if (pi.metadata?.swap_proposal_id) await handleSwapProposalPayment(pi, supa);
      else await handleSwapPayment(pi, supa);
    } else {
      await finalizePurchase(pi, supa);
    }
  } catch (e) {
    console.error('[finalize] Finalisering fejlede:', e.message);
    // Webhooken forsøger igen — meld blokeret, men ikke en hård fejl for klienten.
    return NextResponse.json({ ok: false, status: order.status, error: 'Finalisering fejlede' }, { status: 200 });
  }

  return NextResponse.json({ ok: true, finalized: true });
}
