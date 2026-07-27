import Stripe from 'stripe';

// Fælles Stripe-opsætning for alle server-routes. Samlet ét sted, så skiftet
// mellem test- og live-nøgler kun afhænger af miljøvariabler — og så en fejl-
// konfiguration (test-nøgler i produktion, eller test-secret + live-publishable)
// fanges med det samme i stedet for at give tavse eller uforståelige fejl.
//
// Miljøvariabler:
//   STRIPE_SECRET_KEY                    sk_live_… i produktion, sk_test_… ellers
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   pk_live_… / pk_test_… — SKAL matche secret
//   STRIPE_WEBHOOK_SECRET                whsec_… (må indeholde flere, adskilt af komma)
//   STRIPE_ALLOW_TEST_MODE_IN_PROD       'true' slår produktions-guarden fra (bevidst undtagelse)

export const PAYMENT_METHOD_TYPES = ['card', 'mobilepay'];

// Udleder nøgle-tilstand af præfikset. Returnerer 'live', 'test' eller null (ukendt).
export function keyMode(key) {
  if (typeof key !== 'string' || !key) return null;
  if (/^(sk|pk|rk)_live_/.test(key)) return 'live';
  if (/^(sk|pk|rk)_test_/.test(key)) return 'test';
  return null;
}

// Hvilken tilstand kører serveren i lige nu (ud fra den hemmelige nøgle).
export function stripeMode() {
  return keyMode(process.env.STRIPE_SECRET_KEY);
}

// Kun en rigtig produktions-deployment på Vercel tæller. Et lokalt
// `next build && next start` (NODE_ENV=production, ingen VERCEL_ENV) må gerne
// køre med test-nøgler.
export function isProductionDeployment() {
  return process.env.VERCEL_ENV === 'production';
}

// Kaster hvis Stripe er forkert konfigureret. Fejler bevidst LUKKET i produktion:
// hellere en synlig fejl end at fuldføre ordrer på test-betalinger, hvor varerne
// bliver sendt uden at der nogensinde er trukket penge.
export function assertStripeConfig() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('STRIPE_SECRET_KEY er ikke sat');

  const secretMode = keyMode(secret);
  const publishableMode = keyMode(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  if (secretMode && publishableMode && secretMode !== publishableMode) {
    throw new Error(
      `Stripe-nøglerne matcher ikke: STRIPE_SECRET_KEY er ${secretMode}-mode, ` +
      `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY er ${publishableMode}-mode. ` +
      'Begge skal være live (eller begge test) i samme miljø.'
    );
  }

  if (isProductionDeployment() && secretMode !== 'live' && process.env.STRIPE_ALLOW_TEST_MODE_IN_PROD !== 'true') {
    throw new Error(
      'Stripe kører med test-nøgler i produktion. Sæt sk_live_… og pk_live_… på ' +
      'Vercel (Production), eller sæt STRIPE_ALLOW_TEST_MODE_IN_PROD=true hvis det er bevidst.'
    );
  }
}

let cachedClient = null;
let cachedKey = null;

// Stripe-klienten. API-versionen pinnes ikke — SDK'ens egen version bruges.
export function getStripe() {
  assertStripeConfig();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!cachedClient || cachedKey !== key) {
    cachedClient = new Stripe(key);
    cachedKey = key;
  }
  return cachedClient;
}

// Webhook-signaturnøgler. Flere kan angives komma-adskilt, så test- og live-
// endpointet kan køre side om side under skiftet (hver Stripe-endpoint har sin
// egen whsec). Livemode-guarden i webhooken sikrer at test-events ikke fuldfører
// rigtige ordrer.
export function webhookSecrets() {
  return (process.env.STRIPE_WEBHOOK_SECRET || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Verificerer webhook-signaturen mod hver konfigureret nøgle. Kaster hvis ingen passer.
export function constructWebhookEvent(stripe, body, signature) {
  const secrets = webhookSecrets();
  if (!secrets.length) throw new Error('STRIPE_WEBHOOK_SECRET er ikke sat');
  let lastErr = null;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(body, signature, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// Ordrer betalt fuldt ud fra institutionens saldo får et syntetisk id
// (`wallet_<uuid>`) og findes ikke hos Stripe — de må aldrig sendes til API'et.
export function isStripePaymentIntentId(id) {
  return typeof id === 'string' && id.startsWith('pi_');
}

// MobilePay skal aktiveres separat i live-mode (Stripe Dashboard → Betalingsmetoder)
// og kan være under godkendelse på skiftedagen. Er den ikke aktiv, ville hele
// checkout'et fejle — derfor falder vi tilbage til kort alene og logger tydeligt,
// i stedet for at lukke butikken.
export async function createPaymentIntent(stripe, params, logPrefix = '[stripe]') {
  try {
    return await stripe.paymentIntents.create({ payment_method_types: PAYMENT_METHOD_TYPES, ...params });
  } catch (err) {
    if (!isPaymentMethodUnavailableError(err)) throw err;
    console.error(
      `${logPrefix} MobilePay er ikke aktiveret på Stripe-kontoen (${stripeMode() || 'ukendt'}-mode) — ` +
      'opretter betalingen med kort alene. Aktivér MobilePay i Stripe Dashboard.'
    );
    return await stripe.paymentIntents.create({ payment_method_types: ['card'], ...params });
  }
}

function isPaymentMethodUnavailableError(err) {
  if (err?.type !== 'StripeInvalidRequestError') return false;
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('mobilepay') || String(err?.param || '').startsWith('payment_method_types');
}
