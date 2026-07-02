'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/authed-fetch';
import { PRIMARY, GREEN_TINT, GREEN_DEEP, INK, INK2, INK3, PAPER, PAPER2, PAPER3, FONT, CORAL } from '@/lib/constants';

function fmtKr(n) {
  return `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

const LEDGER_LABELS = {
  sale_credit:         { label: 'Salg', sign: '+', color: PRIMARY },
  purchase_debit:      { label: 'Køb betalt fra konto', sign: '−', color: INK2 },
  withdrawal_debit:    { label: 'Udbetaling', sign: '−', color: INK2 },
  withdrawal_reversal: { label: 'Udbetaling tilbageført', sign: '+', color: PRIMARY },
  refund_credit:       { label: 'Refusion', sign: '+', color: PRIMARY },
  adjustment:          { label: 'Justering', sign: '', color: INK2 },
};
const PAYOUT_CFG = {
  pending:  { label: 'Afventer', bg: '#FEF9C3', color: '#92400E' },
  paid:     { label: 'Udbetalt', bg: '#DCFCE7', color: '#166534' },
  rejected: { label: 'Afvist',   bg: '#FEE2E2', color: '#B91C1C' },
};

export default function MinKontoPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/wallet');
      if (res.status === 401) { router.push('/login'); return; }
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Kunne ikke hente kontoen.'); setLoading(false); return; }
      setData(json);
    } catch {
      setError('Noget gik galt. Prøv igen.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleWithdraw() {
    setWithdrawing(true);
    setMsg(null);
    try {
      const res = await authedFetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),   // tom = hele saldoen
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ type: 'error', text: json.error || 'Kunne ikke hæve.' });
      } else {
        setMsg({ type: 'ok', text: `Udbetaling af ${fmtKr(json.amount)} er anmodet. Du får besked, når den er overført.` });
        setShowConfirm(false);
        await load();
      }
    } catch {
      setMsg({ type: 'error', text: 'Noget gik galt. Prøv igen.' });
    }
    setWithdrawing(false);
  }

  const balance = data?.balance || 0;
  const canWithdraw = balance > 0 && data?.hasBankDetails;

  return (
    <div style={{ minHeight: '100vh', background: PAPER, paddingTop: 84, paddingBottom: 60 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontFamily: FONT, fontSize: 13, color: INK3, cursor: 'pointer', padding: '0 0 20px', fontWeight: 600 }}>
          Tilbage
        </button>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK, letterSpacing: '-0.03em', marginBottom: 6 }}>Min konto</h1>
        <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginBottom: 24 }}>Penge du har tjent ved salg. Brug dem i din næste handel eller hæv dem til jeres bankkonto.</p>

        {loading && <div style={{ textAlign: 'center', padding: 40, fontFamily: FONT, color: INK3 }}>Henter konto…</div>}
        {error && <div style={{ background: '#FEE2E2', borderRadius: 12, padding: '14px 16px', fontFamily: FONT, fontSize: 13, color: '#DC2626' }}>{error}</div>}

        {!loading && !error && data && (
          <>
            {/* Saldo-kort */}
            <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, borderRadius: 20, padding: '28px 24px', color: '#fff', marginBottom: 20 }}>
              <div style={{ fontFamily: FONT, fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Til rådighed</div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em' }}>{fmtKr(balance)}</div>
              <button
                disabled={!canWithdraw}
                onClick={() => { setMsg(null); setShowConfirm(true); }}
                style={{
                  marginTop: 18, width: '100%', padding: '13px', borderRadius: 99, border: 'none',
                  background: canWithdraw ? '#fff' : 'rgba(255,255,255,0.25)',
                  color: canWithdraw ? PRIMARY : 'rgba(255,255,255,0.7)',
                  fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: canWithdraw ? 'pointer' : 'default',
                }}>
                💸 Hæv til bankkonto
              </button>
              {!data.hasBankDetails && (
                <button onClick={() => router.push('/profil/rediger')} style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: '#fff', fontFamily: FONT, fontSize: 12, textDecoration: 'underline', cursor: 'pointer', opacity: 0.9 }}>
                  Tilføj bankoplysninger for at kunne hæve →
                </button>
              )}
            </div>

            {msg && (
              <div style={{ background: msg.type === 'ok' ? GREEN_TINT : '#FEE2E2', borderRadius: 12, padding: '12px 16px', fontFamily: FONT, fontSize: 13, color: msg.type === 'ok' ? GREEN_DEEP : '#B91C1C', marginBottom: 16 }}>
                {msg.text}
              </div>
            )}

            {/* Afventende udbetalinger */}
            {(data.payouts || []).filter(p => p.status === 'pending').length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK2, marginBottom: 10 }}>Udbetalinger</div>
                {data.payouts.map(p => {
                  const cfg = PAYOUT_CFG[p.status] || PAYOUT_CFG.pending;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 12, border: `1px solid ${PAPER3}`, padding: '12px 16px', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK }}>{fmtKr(p.amount)}</div>
                        <div style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>Anmodet {fmtDate(p.requested_at)}</div>
                      </div>
                      <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 99, fontSize: 11, fontWeight: 800, padding: '4px 10px' }}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Posteringshistorik */}
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK2, marginBottom: 10 }}>Historik</div>
            {(data.ledger || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: FONT, fontSize: 13, color: INK3 }}>
                Ingen posteringer endnu. Når du sælger noget, vises indtjeningen her.
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${PAPER3}`, overflow: 'hidden' }}>
                {data.ledger.map((l, i) => {
                  const cfg = LEDGER_LABELS[l.type] || { label: l.type, sign: '', color: INK2 };
                  const positive = Number(l.amount) >= 0;
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: i > 0 ? `1px solid ${PAPER2}` : 'none' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.label}</div>
                        {l.note && <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.note}</div>}
                        <div style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>{fmtDate(l.created_at)}</div>
                      </div>
                      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: positive ? PRIMARY : INK, marginLeft: 12, whiteSpace: 'nowrap' }}>
                        {positive ? '+' : '−'}{fmtKr(Math.abs(Number(l.amount)))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bekræft udbetaling */}
      {showConfirm && (
        <div onClick={() => !withdrawing && setShowConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', maxWidth: 380, width: '100%' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, marginBottom: 8 }}>Hæv {fmtKr(balance)}?</div>
            <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, lineHeight: 1.6, marginBottom: 20 }}>
              Beløbet overføres til jeres registrerede bankkonto. Det kan tage et par bankdage. Saldoen reserveres med det samme.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button disabled={withdrawing} onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: 99, background: PAPER2, border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK2, cursor: 'pointer' }}>Annullér</button>
              <button disabled={withdrawing} onClick={handleWithdraw} style={{ flex: 1, padding: '12px', borderRadius: 99, background: withdrawing ? PAPER3 : PRIMARY, border: 'none', fontFamily: FONT, fontWeight: 800, fontSize: 14, color: '#fff', cursor: withdrawing ? 'default' : 'pointer' }}>{withdrawing ? 'Hæver…' : 'Bekræft'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
