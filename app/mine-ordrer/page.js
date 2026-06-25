'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/supabase';
import { useActiveUser } from '@/providers/AppProvider';
import { PRIMARY, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3, FONT, CORAL } from '@/lib/constants';
import CarrierLogo from '@/components/CarrierLogo';

// Et bytte hvor JEG modtager modpartens varer (indgående). Tracking, ingen mærkat.
function SwapReceiveCard({ r, router, onReceived }) {
  const [marking, setMarking] = useState(false);
  const sh = r.shipment;
  async function markReceived() {
    setMarking(true);
    const res = await fetch('/api/swaps/mark-received', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: r.id }),
    });
    setMarking(false);
    if (res.ok) onReceived(r.id);
  }
  const status = r.completed
    ? (sh ? '🚚 På vej til dig' : '🤝 Aftalt levering')
    : '⏳ Afventer betaling';
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${PAPER3}`, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK }}>🔄 Bytte · fra {r.otherName}</span>
        <span style={{ marginLeft: 'auto', fontFamily: FONT, fontSize: 11, fontWeight: 700, color: INK3 }}>{status}</span>
      </div>
      {r.items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>{it.emoji || '🧸'}</span>
          <span style={{ fontFamily: FONT, fontSize: 13, color: INK }}>{it.title}</span>
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {sh?.tracking_url && (
          <a href={sh.tracking_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 99, background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>📦 Spor pakken</a>
        )}
        {sh?.tracking_number && !sh?.tracking_url && (
          <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 12, color: INK3 }}>Tracking: {sh.tracking_number}</div>
        )}
        {r.completed && !sh && (
          <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 12, color: INK3 }}>I aftaler selv afhentning/levering.</div>
        )}
        {!r.completed && (
          <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 12, color: INK3 }}>Pakken bookes når begge parter har betalt.</div>
        )}
        {r.completed && (r.received ? (
          <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PRIMARY }}>✓ Du har bekræftet modtagelse</div>
        ) : (
          <button disabled={marking} onClick={markReceived} style={{ padding: '11px', borderRadius: 99, border: `1.5px solid ${PRIMARY}`, background: marking ? PAPER2 : GREEN_TINT, color: marking ? INK3 : PRIMARY, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: marking ? 'default' : 'pointer' }}>{marking ? 'Gemmer…' : '✅ Marker som modtaget'}</button>
        ))}
        <button onClick={() => router.push(r.conversation_id ? `/beskeder?conv=${r.conversation_id}` : '/beskeder')} style={{ padding: '11px', borderRadius: 99, background: PAPER2, border: 'none', fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK3, cursor: 'pointer' }}>💬 Åbn byttehandel</button>
      </div>
    </div>
  );
}

const STATUS_CFG = {
  pending:   { label: '⏳ Afventer',   color: INK3,     bg: PAPER2 },
  paid:      { label: '✅ Betalt',     color: '#92610A', bg: '#FEF3C7' },
  shipped:   { label: '🚚 Sendt',      color: PRIMARY,  bg: GREEN_TINT },
  delivered: { label: '📦 Leveret',    color: '#166534', bg: '#DCFCE7' },
  refunded:  { label: '↩️ Refunderet', color: CORAL,    bg: '#FEE2E2' },
  failed:    { label: 'Mislykket',     color: CORAL,    bg: '#FEE2E2' },
  cancelled: { label: 'Annulleret',    color: INK3,     bg: PAPER2 },
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

const STATUS_STEPS = ['paid', 'shipped', 'delivered'];
const STATUS_STEP_LABELS = ['Betalt', 'Afsendt', 'Leveret'];

function OrderProgress({ status }) {
  const step = STATUS_STEPS.indexOf(status);
  if (step < 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '12px 0 4px' }}>
      {STATUS_STEP_LABELS.map((lbl, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEP_LABELS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                border: `2px solid ${done || active ? PRIMARY : PAPER3}`,
                background: done ? PRIMARY : active ? GREEN_TINT : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: done ? '#fff' : active ? PRIMARY : INK3, fontWeight: 800,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 9, fontWeight: active ? 700 : 500, color: done || active ? PRIMARY : INK3, marginTop: 3, textAlign: 'center' }}>{lbl}</div>
            </div>
            {i < STATUS_STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? PRIMARY : PAPER3, margin: '0 2px', marginBottom: 14 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order, onUpdate, autoOpen }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen ?? false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (autoOpen && cardRef.current) {
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [autoOpen]);
  const [confirming, setConfirming] = useState(false);
  const groups = order.order_groups || [];
  const firstItem = groups[0]?.items?.[0];
  const itemCount = groups.reduce((s, g) => s + (g.items?.length || 0), 0);
  const grandTotal = order.grand_total ?? groups.reduce((s, g) => s + (g.itemTotal || 0) + (g.shippingTotal || 0) + (g.serviceFee || 0), 0);
  const trackingUrl = order.tracking_url || groups.find(g => g.tracking_url)?.tracking_url;
  const trackingNumber = order.tracking_number || groups.find(g => g.tracking_number)?.tracking_number;
  const isShipping = groups.some(g => g.shippingMethod && g.shippingMethod !== 'pickup' && g.shippingMethod !== 'custom');

  async function handleConfirmReceived() {
    setConfirming(true);
    const { error } = await db.from('orders')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', order.id);
    setConfirming(false);
    if (!error) onUpdate(order.id, 'delivered');
  }

  return (
    <div ref={cardRef} style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${autoOpen ? '#2D6A4F' : PAPER3}`, overflow: 'hidden', marginBottom: 12, transition: 'border-color 0.3s' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, marginBottom: 4 }}>
            {firstItem ? `${firstItem.emoji || '📦'} ${firstItem.title}${itemCount > 1 ? ` +${itemCount - 1} mere` : ''}` : `Ordre #${order.id.slice(0, 8).toUpperCase()}`}
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

          {/* Status progress */}
          {['paid','shipped','delivered'].includes(order.status) && isShipping && (
            <OrderProgress status={order.status} />
          )}

          {/* Groups */}
          {groups.map((g, gi) => (
            <div key={gi} style={{ marginTop: 14, paddingTop: gi > 0 ? 14 : 0, borderTop: gi > 0 ? `1px solid ${PAPER2}` : 'none' }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: INK2, marginBottom: 8 }}>Fra {g.sellerName}</div>
              {(g.items || []).map((item, ii) => (
                <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK }}>{item.emoji || '📦'} {item.title}</span>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK, fontWeight: 600 }}>{fmtKr(item.price)}</span>
                </div>
              ))}
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${PAPER3}` }}>
                {g.shippingTotal > 0 && (() => {
                  const carrierCode = g.shippingMethod?.startsWith('parcel_shop_') || g.shippingMethod?.startsWith('home_')
                    ? g.shippingMethod.replace('parcel_shop_', '').replace('home_', '') : null;
                  const typeLabel = g.shippingMethod?.startsWith('parcel_shop_') ? 'Pakkeshop' : g.shippingMethod?.startsWith('home_') ? 'Hjemlevering' : (SHIPPING_LABELS[g.shippingMethod] || g.shippingMethod);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: INK3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        Levering ({typeLabel}) {carrierCode && <CarrierLogo carrier={carrierCode} />}
                      </span>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{fmtKr(g.shippingTotal)}</span>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>Bytogleg beskyttelse</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{fmtKr(g.serviceFee)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Total */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px solid ${PAPER2}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK }}>I alt</span>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: PRIMARY }}>{fmtKr(grandTotal)}</span>
          </div>
          {order.paid_at && (
            <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, textAlign: 'right', marginTop: 2 }}>
              Betalt {fmtDate(order.paid_at)}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {trackingUrl && (
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', textAlign: 'center', padding: '11px', borderRadius: 99,
                background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, textDecoration: 'none',
              }}>
                📦 Spor pakken
              </a>
            )}
            {trackingNumber && !trackingUrl && (
              <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 12, color: INK3 }}>
                Tracking: {trackingNumber}
              </div>
            )}
            {order.status === 'shipped' && (
              <button
                disabled={confirming}
                onClick={handleConfirmReceived}
                style={{
                  padding: '11px', borderRadius: 99, border: `1.5px solid ${PRIMARY}`,
                  background: confirming ? PAPER2 : GREEN_TINT,
                  color: confirming ? INK3 : PRIMARY,
                  fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: confirming ? 'default' : 'pointer',
                }}>
                {confirming ? 'Gemmer…' : '✅ Marker som modtaget'}
              </button>
            )}
            <button
              onClick={() => router.push('/beskeder')}
              style={{
                padding: '11px', borderRadius: 99, background: PAPER2, border: 'none',
                fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK3, cursor: 'pointer',
              }}>
              💬 Chat med sælger
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MineOrdrerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('order');
  const { institutionId } = useActiveUser();
  const [orders, setOrders] = useState([]);
  const [swapReceives, setSwapReceives] = useState([]);
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
          .select('id, created_at, grand_total, status, order_groups, tracking_number, tracking_url, paid_at')
          .eq('buyer_id', user.id)
          .not('status', 'in', '("pending","failed","cancelled")')
          .order('created_at', { ascending: false });
        if (cancelled) return;
        if (dbErr) { setError('Kunne ikke hente ordrer.'); setLoading(false); return; }
        // Bytte-afsend-ordrer (porto for det DU sender) hører til "Skal sendes", ikke køb.
        const kob = (data || []).filter(o => !String(o.order_groups?.[0]?.sellerName || '').startsWith('Byttehandel'));
        setOrders(kob);
      } catch {
        if (!cancelled) setError('Noget gik galt. Prøv igen.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Bytte — du modtager (modpartens indgående bundt + tracking)
  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;
    (async () => {
      const { data: props } = await db.from('swap_proposals')
        .select('id, conversation_id, escrow_status, initiator_institution_id, owner_institution_id, offered_items, requested_items, initiator_shipment_id, owner_shipment_id, initiator_received, owner_received')
        .or(`initiator_institution_id.eq.${institutionId},owner_institution_id.eq.${institutionId}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });
      if (cancelled || !props?.length) return;
      const incomingShipIds = props.map(p => p.initiator_institution_id === institutionId ? p.owner_shipment_id : p.initiator_shipment_id).filter(Boolean);
      const otherIds = [...new Set(props.map(p => p.initiator_institution_id === institutionId ? p.owner_institution_id : p.initiator_institution_id).filter(Boolean))];
      const [{ data: ships }, { data: insts }] = await Promise.all([
        incomingShipIds.length ? db.from('shipments').select('id,tracking_number,tracking_url,status').in('id', incomingShipIds) : Promise.resolve({ data: [] }),
        otherIds.length ? db.from('institutions').select('id,name').in('id', otherIds) : Promise.resolve({ data: [] }),
      ]);
      const shipById = Object.fromEntries((ships || []).map(s => [s.id, s]));
      const nameById = Object.fromEntries((insts || []).map(i => [i.id, i.name]));
      const receives = props.map(p => {
        const meInit = p.initiator_institution_id === institutionId;
        return {
          id: p.id,
          conversation_id: p.conversation_id,
          items: (meInit ? p.requested_items : p.offered_items) || [],
          otherName: nameById[meInit ? p.owner_institution_id : p.initiator_institution_id] || 'Modpart',
          shipment: shipById[meInit ? p.owner_shipment_id : p.initiator_shipment_id] || null,
          completed: p.escrow_status === 'both_paid_released',
          received: meInit ? p.initiator_received : p.owner_received,
        };
      }).filter(r => r.items.length);
      if (!cancelled) setSwapReceives(receives);
    })();
    return () => { cancelled = true; };
  }, [institutionId]);

  return (
    <div style={{ minHeight: '100vh', background: PAPER, paddingTop: 84, paddingBottom: 60 }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontFamily: FONT, fontSize: 13, color: INK3, cursor: 'pointer', padding: '0 0 20px', fontWeight: 600 }}>
          Tilbage
        </button>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK, letterSpacing: '-0.03em', marginBottom: 6 }}>Mine køb</h1>
        <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginBottom: 28 }}>Følg og modtag det du har købt og byttet dig til.</p>

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

        {!loading && !error && orders.length === 0 && swapReceives.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128717;</div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: INK, marginBottom: 8 }}>Du har ingen køb endnu</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginBottom: 24 }}>
              N&#229;r du k&#248;ber eller bytter dig til noget, vises det her.
            </div>
            <button onClick={() => router.push('/opslag')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Udforsk opslag &#8594;
            </button>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            {swapReceives.length > 0 && <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK2, margin: '0 0 12px' }}>Køb</div>}
            {orders.map(order => (
              <OrderCard key={order.id} order={order} autoOpen={highlightId === order.id}
                onUpdate={(id, status) => setOrders(os => os.map(o => o.id === id ? { ...o, status } : o))} />
            ))}
          </>
        )}

        {!loading && swapReceives.length > 0 && (
          <>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK2, margin: `${orders.length > 0 ? '24px' : '0'} 0 12px` }}>Bytte — på vej til dig</div>
            {swapReceives.map(r => <SwapReceiveCard key={r.id} r={r} router={router}
              onReceived={(id) => setSwapReceives(rs => rs.map(x => x.id === id ? { ...x, received: true } : x))} />)}
          </>
        )}
      </div>
    </div>
  );
}

export default function MineOrdrerPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F6F2EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'sans-serif', color: '#7B8F87' }}>Indlæser…</span></div>}>
      <MineOrdrerContent />
    </Suspense>
  );
}
