'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, INK, INK3, PAPER, PAPER3, FONT } from '@/lib/constants';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { removeFromCart } = useApp();
  const orderId = searchParams.get('order_id');
  const status = searchParams.get('redirect_status');
  const [countdown, setCountdown] = useState(5);

  const succeededParam = status === 'succeeded';

  // Ejerskabstjek: verificér at ordren tilhører den aktuelle bruger
  // før vi viser "Betaling gennemført" og rydder kurven.
  const [verifying, setVerifying] = useState(succeededParam);
  const [verifyError, setVerifyError] = useState(null);

  useEffect(() => {
    if (!succeededParam) return;
    let cancelled = false;

    async function verifyOrder() {
      try {
        if (!orderId) {
          if (!cancelled) { setVerifyError('Ordre-id mangler i adressen.'); setVerifying(false); }
          return;
        }
        const { data: { user } } = await db.auth.getUser();
        if (!user) {
          if (!cancelled) { setVerifyError('Du skal være logget ind for at se denne ordre.'); setVerifying(false); }
          return;
        }
        // RLS på orders tillader kun buyer_id = auth.uid(); .eq() er ekstra værn
        const { data: order, error } = await db
          .from('orders')
          .select('id, buyer_id')
          .eq('id', orderId)
          .eq('buyer_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !order) {
          setVerifyError('Ordren blev ikke fundet eller tilhører ikke din konto.');
          setVerifying(false);
          return;
        }
        // Ordren er verificeret — ryd nu de gemte vare-IDs fra kurven
        try {
          const raw = sessionStorage.getItem('pending_cart_ids');
          if (raw) {
            const ids = JSON.parse(raw);
            if (Array.isArray(ids)) for (const lid of ids) removeFromCart(lid);
            sessionStorage.removeItem('pending_cart_ids');
          }
        } catch { /* ignorér — kurven ryddes blot ikke */ }
        setVerifying(false);
      } catch {
        if (!cancelled) { setVerifyError('Kunne ikke verificere ordren — prøv igen.'); setVerifying(false); }
      }
    }

    verifyOrder();
    return () => { cancelled = true; };
  }, [succeededParam, orderId]);

  const success = succeededParam && !verifying && !verifyError;

  useEffect(() => {
    if (!success) return;
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(t); router.push('/beskeder'); return 0; }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [success]);

  if (succeededParam && verifying) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <span style={{ fontFamily: FONT, color: INK3 }}>Bekræfter din ordre…</span>
      </div>
    );
  }

  if (succeededParam && verifyError) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>⚠️</div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: INK, marginBottom: 10 }}>Kunne ikke bekræfte ordren</h1>
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 28 }}>{verifyError}</p>
          <button onClick={() => router.push('/beskeder')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '14px 32px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Gå til beskeder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {success ? (
          <>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
            <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK, letterSpacing: '-0.03em', marginBottom: 10 }}>Betaling gennemført!</h1>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, lineHeight: 1.6, marginBottom: 28 }}>
              Sælger har modtaget besked og pakkemærkaten er oprettet automatisk. Du kan følge din ordre i beskeder.
            </p>

            <div style={{ background: GREEN_TINT, borderRadius: 16, border: `1px solid ${GREEN_SOFT}`, padding: '18px 20px', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, marginBottom: 8 }}>Hvad sker der nu?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: '📦', text: 'Sælger pakker varen og sender den afsted' },
                  { icon: '🚚', text: 'Du modtager en notifikation når pakken er sendt' },
                  { icon: '🏠', text: 'Pakken leveres til dit valgte afhentningssted' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ fontFamily: FONT, fontSize: 13, color: INK3 }}>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => router.push('/beskeder')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '14px 32px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>
              Gå til beskeder →
            </button>
            <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>Omdirigerer om {countdown} sekunder…</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 56, marginBottom: 20 }}>❌</div>
            <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: INK, marginBottom: 10 }}>Betaling mislykkedes</h1>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 28 }}>Der skete en fejl med din betaling. Du er ikke blevet trukket.</p>
            <button onClick={() => router.push('/indkøbsvogn')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '14px 32px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Prøv igen
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function BetalingSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: FONT, color: INK3 }}>Indlæser…</span></div>}>
      <SuccessContent />
    </Suspense>
  );
}
