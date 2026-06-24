'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, INK, INK2, INK3, PAPER, PAPER2, PAPER3, FONT } from '@/lib/constants';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// ── PaymentForm ────────────────────────────────────────────────

function PaymentForm({ orderId, grandTotal, breakdown }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);

    // Sikkerhedsnet: hvis confirmPayment hænger (fx netværkstimeout),
    // resettes knappen automatisk efter 60 sekunder med en fejlbesked.
    const timeoutId = setTimeout(() => {
      setPaying(false);
      setError('Betalingen tog for lang tid — prøv igen.');
    }, 60000);

    try {
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/betaling/success?order_id=${orderId}`,
        },
      });

      clearTimeout(timeoutId);

      if (stripeError) {
        setError(stripeError.message);
        setPaying(false);
      }
      // If no error: Stripe redirects — nothing more to do here
    } catch (err) {
      clearTimeout(timeoutId);
      setError('Der skete en teknisk fejl — prøv igen.');
      setPaying(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 24 }}>
        <PaymentElement options={{
          layout: 'tabs',
          terms: { card: 'never', ideal: 'never', sepaDebit: 'never', sofort: 'never', auBecsDebit: 'never', bancontact: 'never', giropay: 'never', p24: 'never' },
        }} />
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FCA5A5', fontFamily: FONT, fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={paying || !stripe} style={{
        width: '100%', padding: '15px', borderRadius: 99,
        background: paying || !stripe ? PAPER3 : PRIMARY,
        color: paying || !stripe ? INK3 : '#fff',
        border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 16,
        cursor: paying || !stripe ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
      }}>
        {paying ? 'Behandler betaling…' : `Betal ${grandTotal?.toFixed(2).replace('.', ',')} kr.`}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>Sikker betaling via Stripe · SSL krypteret</span>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function BetalingPage() {
  const { orderId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const clientSecret = searchParams.get('cs');
  const grandTotalParam = parseFloat(searchParams.get('total') || '0');
  const breakdownParam = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('bd') || '[]')); } catch { return []; } })();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (clientSecret) setReady(true);
    else router.push('/indkøbsvogn');
  }, [clientSecret]);

  if (!ready || !clientSecret) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FONT, color: INK3 }}>Indlæser betaling…</div>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: { colorPrimary: PRIMARY, fontFamily: FONT, borderRadius: '12px' },
      rules: { '.Block': { boxShadow: 'none' } },
    },
    loader: 'never',
  };

  return (
    <div style={{ minHeight: '100vh', background: PAPER, paddingTop: 84, paddingBottom: 60 }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px' }}>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK, letterSpacing: '-0.03em', marginBottom: 6 }}>Betal</h1>
        <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginBottom: 28 }}>Dine penge er i sikre hænder — betaling sker via Stripe.</p>

        {/* Order summary */}
        <div style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${PAPER3}`, padding: 20, marginBottom: 24 }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, marginBottom: 14 }}>Ordreoversigt</div>
          {breakdownParam.map((g, i) => (
            <div key={i} style={{ marginBottom: i < breakdownParam.length - 1 ? 16 : 0, paddingBottom: i < breakdownParam.length - 1 ? 16 : 0, borderBottom: i < breakdownParam.length - 1 ? `1px solid ${PAPER2}` : 'none' }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK, marginBottom: 8 }}>{g.sellerName}</div>
              {g.items.map((item, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK2 }}>{item.title || item.listingTitle}</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK2 }}>{item.price} kr.</span>
                </div>
              ))}
              {g.shippingTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>Levering</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{g.shippingTotal} kr.</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>Bytogleg beskyttelse</span>
                <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{g.serviceFee?.toFixed(2)} kr.</span>
              </div>
              {g.cashAdjustment > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>Kontant mellemlag</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{g.cashAdjustment.toFixed(2)} kr.</span>
                </div>
              )}
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${PAPER2}`, marginTop: 14, paddingTop: 14, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: INK }}>I alt</span>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PRIMARY }}>{grandTotalParam.toFixed(2).replace('.', ',')} kr.</span>
          </div>
        </div>

        {/* Buyer protection info */}
        <div style={{ background: GREEN_TINT, borderRadius: 14, border: `1px solid ${GREEN_SOFT}`, padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🛡️</span>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, marginBottom: 4 }}>Bytogleg beskyttelse</div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, lineHeight: 1.5 }}>
              Bytogleg beskyttelse dækker dig hvis varen ikke ankommer eller ikke matcher beskrivelsen. Pakkemærkat oprettes automatisk.
            </div>
          </div>
        </div>

        {/* Stripe Elements */}
        <div style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${PAPER3}`, padding: 24 }}>
          <Elements stripe={stripePromise} options={options}>
            <PaymentForm orderId={orderId} grandTotal={grandTotalParam} breakdown={breakdownParam} />
          </Elements>
        </div>

        <button onClick={() => router.push('/indkøbsvogn')} style={{ background: 'none', border: 'none', fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK3, cursor: 'pointer', padding: '16px 0', display: 'block', margin: '0 auto' }}>
          ← Tilbage til kurv
        </button>
      </div>
    </div>
  );
}
