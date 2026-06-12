'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3, FONT, CORAL } from '@/lib/constants';

const STATUS_CFG = {
  pending:   { label: 'Afventer betaling', color: INK3,     bg: PAPER2 },
  paid:      { label: 'Betalt',            color: '#92610A', bg: '#FEF3C7' },
  shipped:   { label: 'Sendt',             color: PRIMARY,  bg: GREEN_TINT },
  delivered: { label: 'Leveret',           color: '#166534', bg: '#DCFCE7' },
  refunded:  { label: 'Refunderet',        color: CORAL,    bg: '#FEE2E2' },
  failed:    { label: 'Mislykket',         color: CORAL,    bg: '#FEE2E2' },
  cancelled: { label: 'Annulleret',        color: INK3,     bg: PAPER2 },
};

const SHIPPING_LABELS = {
  parcel_shop_pdk: 'PostNord pakkeshop',
  parcel_shop_gls: 'GLS pakkeshop',
  home_dao:        'DAO hjemlevering',
  pickup:          'Afhentning',
  custom:          'Egen aftale',
};

function fmtKr(n) {
  return `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      background: cfg.bg, color: cfg.color,
      fontFamily: FONT, fontWeight: 700, fontSize: 11,
    }}>
      {cfg.label}
    </span>
  );
}

function OrderCard({ order }) {
  const [open, setOpen] = useState(false);
  const groups = order.order_groups || [];
  const grandTotal = groups.reduce((s, g) => s + (g.itemTotal || 0) + (g.shippingTotal || 0) + (g.serviceFee || 0), 0);

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${PAPER3}`, overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, marginBottom: 4 }}>
            Ordre #{order.id.slice(0, 8).toUpperCase()}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>{fmtDate(order.created_at)}</div>
        </div>
        <StatusBadge status={order.status} />
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: INK, minWidth: 80, textAlign: 'right' }}>
          {fmtKr(grandTotal)}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${PAPER2}`, padding: '16px 18px' }}>
          {groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: gi < groups.length - 1 ? 20 : 0, paddingBottom: gi < groups.length - 1 ? 20 : 0, borderBottom: gi < groups.length - 1 ? `1px solid ${PAPER2}` : 'none' }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: INK2, marginBottom: 10 }}>
                Fra {g.sellerName}
              </div>

              {(g.items || []).map((item, ii) => (
                <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK }}>
                    {item.emoji || '📦'} {item.title}
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK, fontWeight: 600 }}>
                    {fmtKr(item.price)}
                  </span>
                </div>
              ))}

              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${PAPER3}` }}>
                {g.shippingTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>
                      Levering ({SHIPPING_LABELS[g.shippingMethod] || g.shippingMethod})
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{fmtKr(g.shippingTotal)}</span>
                  </div>
                )}
                {g.shippingMethod === 'pickup' && (
                  <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 4 }}>Afhentning</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>Bytogleg beskyttelse</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{fmtKr(g.serviceFee)}</span>
                </div>
              </div>

              {g.tracking_number && (
                <div style={{ background: GREEN_TINT, borderRadius: 10, padding: '10px 12px', marginTop: 10 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: INK, marginBottom: 4 }}>
                    Sporingsoplysninger
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: INK2, marginBottom: g.tracking_url ? 6 : 0 }}>
                    Tracking-nummer: {g.tracking_number}
                  </div>
                  {g.tracking_url && (
                    <a href={g.tracking_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: FONT, fontSize: 12, color: PRIMARY, fontWeight: 700, textDecoration: 'none' }}>
                      Spor pakken →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px solid ${PAPER2}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK }}>I alt</span>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: PRIMARY }}>{fmtKr(grandTotal)}</span>
          </div>

          {order.paid_at && (
            <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, textAlign: 'right', marginTop: 4 }}>
              Betalt {fmtDate(order.paid_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MineOrdrerPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { user } } = await db.auth.getUser();
        if (!user) { router.push('/login'); return; }
        const { data, error: dbErr } = await db
          .from('orders')
          .select('*')
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false });
        if (cancelled) return;
        if (dbErr) { setError('Kunne ikke hente ordrer.'); setLoading(false); return; }
        setOrders(data || []);
      } catch {
        if (!cancelled) setError('Noget gik galt. Prøv igen.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: PAPER, paddingTop: 84, paddingBottom: 60 }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontFamily: FONT, fontSize: 13, color: INK3, cursor: 'pointer', padding: '0 0 20px', fontWeight: 600 }}>
          Tilbage
        </button>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK, letterSpacing: '-0.03em', marginBottom: 6 }}>Mine ordrer</h1>
        <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginBottom: 28 }}>Oversigt over dine k&#248;b p&#229; byt&amp;leg.</p>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span style={{ fontFamily: FONT, fontSize: 14, color: INK3 }}>Henter ordrer&#8230;</span>
          </div>
        )}

        {error && (
          <div style={{ background: '#FEE2E2', borderRadius: 12, padding: '14px 16px', fontFamily: FONT, fontSize: 13, color: '#DC2626' }}>
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128717;</div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: INK, marginBottom: 8 }}>Ingen ordrer endnu</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginBottom: 24 }}>
              N&#229;r du k&#248;ber noget p&#229; byt&amp;leg, vises dine ordrer her.
            </div>
            <button onClick={() => router.push('/')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Udforsk opslag &#8594;
            </button>
          </div>
        )}

        {!loading && orders.map(order => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
