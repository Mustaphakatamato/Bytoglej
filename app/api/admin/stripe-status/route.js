import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { getStripe, keyMode, stripeMode, webhookSecrets, isProductionDeployment, isStripePaymentIntentId } from '@/lib/stripe';

// Admin-diagnostik til go-live: svarer på "kører vi live eller test lige nu, og
// hænger konfigurationen sammen?" Læser kun — ændrer intet.
// Brug: GET /api/admin/stripe-status (kræver admin-login).

export const runtime = 'nodejs';

async function requireAdmin(req) {
  const user = await requireAuth(req);
  if (!user) return { error: UNAUTHORIZED() };
  const supa = createServerClient();
  const { data: adminCheck } = await supa.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminCheck) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { supa };
}

export async function GET(req) {
  const { error, supa } = await requireAdmin(req);
  if (error) return error;

  const secretMode = stripeMode();
  const publishableMode = keyMode(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const secrets = webhookSecrets();

  const status = {
    vercel_env: process.env.VERCEL_ENV || null,
    is_production_deployment: isProductionDeployment(),
    secret_key_mode: secretMode,
    publishable_key_mode: publishableMode,
    keys_match: !!secretMode && secretMode === publishableMode,
    webhook_secrets_configured: secrets.length,
    allow_test_mode_in_prod: process.env.STRIPE_ALLOW_TEST_MODE_IN_PROD === 'true',
    account: null,
    latest_order_payment_intent: null,
    problems: [],
  };

  if (!secretMode) status.problems.push('STRIPE_SECRET_KEY mangler eller har ukendt format.');
  if (!publishableMode) status.problems.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY mangler eller har ukendt format.');
  if (secretMode && publishableMode && secretMode !== publishableMode) {
    status.problems.push(`Nøglerne matcher ikke: secret=${secretMode}, publishable=${publishableMode}.`);
  }
  if (!secrets.length) status.problems.push('STRIPE_WEBHOOK_SECRET mangler — webhooken afvises.');
  if (status.is_production_deployment && secretMode !== 'live') {
    status.problems.push('Produktion kører IKKE med live-nøgler.');
  }

  let stripe = null;
  try {
    stripe = getStripe();
  } catch (e) {
    status.problems.push(e.message);
  }

  if (stripe) {
    // Kontoens tilstand: kan der overhovedet tages imod betalinger og udbetales?
    try {
      const acct = await stripe.accounts.retrieve();
      status.account = {
        id: acct.id,
        country: acct.country || null,
        default_currency: acct.default_currency || null,
        charges_enabled: acct.charges_enabled ?? null,
        payouts_enabled: acct.payouts_enabled ?? null,
        details_submitted: acct.details_submitted ?? null,
        // Videregives råt fra Stripe — hvilke capabilities der findes afhænger af
        // kontotypen. MobilePay-status bekræftes i Dashboard → Betalingsmetoder.
        capabilities: acct.capabilities || null,
      };
      if (acct.charges_enabled === false) status.problems.push('Stripe-kontoen kan ikke modtage betalinger (charges_enabled=false).');
      if (acct.payouts_enabled === false) status.problems.push('Stripe-kontoen kan ikke udbetale (payouts_enabled=false).');
    } catch (e) {
      status.problems.push(`Kunne ikke hente Stripe-kontoen: ${e.message}`);
    }

    // Mode-drift: findes den nyeste ordres PaymentIntent i den tilstand vi kører i?
    // "Not found" betyder typisk at ordren blev oprettet med test-nøgler, mens
    // serveren nu kører live (eller omvendt).
    const { data: recent } = await supa
      .from('orders')
      .select('id, payment_intent_id, created_at')
      .not('payment_intent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);
    const latest = (recent || []).find(o => isStripePaymentIntentId(o.payment_intent_id));
    if (latest) {
      try {
        const pi = await stripe.paymentIntents.retrieve(latest.payment_intent_id);
        status.latest_order_payment_intent = {
          order_id: latest.id,
          created_at: latest.created_at,
          found: true,
          livemode: pi.livemode,
          status: pi.status,
        };
      } catch (e) {
        status.latest_order_payment_intent = {
          order_id: latest.id,
          created_at: latest.created_at,
          found: false,
          error: e.message,
        };
        status.problems.push('Nyeste ordres PaymentIntent findes ikke i den aktuelle Stripe-tilstand — data stammer fra den anden mode.');
      }
    }
  }

  return NextResponse.json({ ok: status.problems.length === 0, ...status });
}
