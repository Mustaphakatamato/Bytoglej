'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER2, PAPER3, INK, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';
import { formatOrderNumber } from '@/lib/order-number';

// ── Stripe order card (automatic label) ───────────────────────
//
// Vinted-mønster: sælger kan ALTID komme videre herfra —
// hente/gengenerere pakkemærkaten, markere afsendt og følge status.

function StripeOrderCard({ order, myGroup, onMarkedSent, onGroupPatch }) {
  const router = useRouter();
  const { showToast } = useApp();
  const [open, setOpen] = useState(order.status === 'paid');
  const [marking, setMarking] = useState(false);
  const [booking, setBooking] = useState(false);

  const isPaid     = order.status === 'paid';
  const isShipped  = order.status === 'shipped';
  const isDone     = order.status === 'delivered';
  // Leveringsmetode afgør hele kortets sprog. En afhentnings-/aftalt-ordre må
  // ALDRIG vise "pakkemærkat genereres" (det modsiger købsmailen til sælger).
  const method     = myGroup.shippingMethod;
  const isShipping = !!method && (method.startsWith('parcel_shop_') || method.startsWith('home_'));
  const isPickup   = !isShipping;
  const labelUrl   = myGroup.label_pdf_url;
  const tracking   = myGroup.tracking_number;
  const trackingUrl = myGroup.tracking_url;
  const orderNo    = formatOrderNumber(order);

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('da-DK', { day:'numeric', month:'short' });
  }

  async function handleMarkSent() {
    setMarking(true);
    let json = {};
    try {
      const res = await fetch('/api/seller-mark-sent', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Noget gik galt');
      onMarkedSent(order.id);
      showToast?.(isPickup ? 'Markeret som klar til afhentning — køberen har fået besked!' : 'Markeret som afsendt — køberen har fået besked!');
    } catch (e) {
      showToast?.(e.message || 'Kunne ikke markere som afsendt', 'error');
    }
    setMarking(false);
  }

  async function handleBookLabel() {
    setBooking(true);
    try {
      const res = await fetch('/api/seller-orders/book-label', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Pakkemærkat kunne ikke oprettes');
      onGroupPatch(order.id, myGroup, {
        label_pdf_url:   json.label_pdf_url,
        tracking_number: json.tracking_number,
        tracking_url:    json.tracking_url,
        label_error:     null,
      });
      showToast?.('Pakkemærkaten er klar!');
      if (json.label_pdf_url) window.open(json.label_pdf_url, '_blank', 'noopener');
    } catch (e) {
      showToast?.(e.message || 'Pakkemærkat kunne ikke oprettes', 'error');
    }
    setBooking(false);
  }

  const badge = isDone
    ? { text: isPickup ? 'AFHENTET' : 'LEVERET', bg: '#DCFCE7', color: '#166534' }
    : isShipped
      ? { text: isPickup ? 'AFVENTER KØBER' : 'SENDT', bg: '#DBEAFE', color: '#1D4ED8' }
      : isPickup
        ? { text: 'KLAR TIL AFHENTNING', bg: '#FEF9C3', color: '#92400E' }
        : labelUrl
          ? { text: 'SKAL SENDES', bg: '#FEF9C3', color: '#92400E' }
          : { text: 'LABEL MANGLER', bg: '#FEE2E2', color: '#B91C1C' };

  const steps = isShipping
    ? [
        { done: true,                 label: 'Betaling modtaget' },
        { done: !!labelUrl,           label: 'Pakkemærkat klar' },
        { done: isShipped || isDone,  label: 'Pakke afsendt' },
        { done: isDone,               label: 'Leveret' },
      ]
    : [
        { done: true,                 label: 'Betaling modtaget' },
        { done: isShipped || isDone,  label: 'Klar til afhentning' },
        { done: isDone,               label: 'Afhentet af køber' },
      ];

  return (
    <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${PAPER3}`, marginBottom:10, overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', background:'none', border:'none', cursor:'pointer',
        padding:'14px 16px', display:'flex', alignItems:'center', gap:12, textAlign:'left',
      }}>
        <div style={{ width:44, height:44, borderRadius:10, background:GREEN_TINT, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
          {(myGroup.items?.[0]?.emoji) || '📦'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {(myGroup.items || []).map(i => i.title).join(', ')}
          </div>
          <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:1 }}>
            Køber: <strong style={{ color:INK }}>{order.buyer_name}</strong> · {fmtDate(order.paid_at)} · Ordre {orderNo}
          </div>
        </div>
        <span style={{ background:badge.bg, color:badge.color, borderRadius:99, fontSize:10, fontWeight:800, padding:'3px 8px', flexShrink:0 }}>
          {badge.text}
        </span>
      </button>

      {open && (
        <div style={{ borderTop:`1px solid ${PAPER2}`, padding:'14px 16px' }}>
          {(myGroup.items || []).map((item, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontFamily:FONT, fontSize:13, color:INK }}>{item.emoji || '📦'} {item.title}</span>
              <span style={{ fontFamily:FONT, fontSize:13, color:INK, fontWeight:600 }}>{item.price} kr.</span>
            </div>
          ))}

          <div style={{ borderTop:`1px dashed ${PAPER3}`, marginTop:10, paddingTop:10, display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>Levering</span>
            <span style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>{myGroup.shippingTotal ?? 0} kr.</span>
          </div>
          {myGroup.pickupPoint && (
            <div style={{ marginTop:6, fontFamily:FONT, fontSize:12, color:INK3 }}>
              📍 Sendes til: {myGroup.pickupPoint.name}{myGroup.pickupPoint.address ? `, ${myGroup.pickupPoint.address}` : ''}
            </div>
          )}

          {/* Trin-oversigt */}
          <div style={{ marginTop:14, background:PAPER2, borderRadius:12, padding:'12px 14px' }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom: i < steps.length - 1 ? 8 : 0 }}>
                <div style={{
                  width:20, height:20, borderRadius:'50%', flexShrink:0,
                  background: s.done ? PRIMARY : '#fff',
                  border: `2px solid ${s.done ? PRIMARY : PAPER3}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, color:'#fff', fontWeight:800,
                }}>
                  {s.done ? '✓' : ''}
                </div>
                <span style={{ fontFamily:FONT, fontSize:12, fontWeight: s.done ? 700 : 500, color: s.done ? INK : INK3 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {isPaid && isShipping && (
            <div style={{ marginTop:10, fontFamily:FONT, fontSize:11, color:INK3 }}>
              ⏱ Send helst pakken inden 5 hverdage, så køberen ikke venter unødigt.
            </div>
          )}

          <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
            {isShipping && labelUrl && (
              <>
                <a href={labelUrl} target="_blank" rel="noopener noreferrer" style={{
                  display:'block', textAlign:'center', padding:'11px', borderRadius:99,
                  background:PRIMARY, color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:14,
                  textDecoration:'none',
                }}>
                  🖨️ Download pakkemærkat (PDF)
                </a>
                <div style={{ fontFamily:FONT, fontSize:11, color:INK3, textAlign:'center' }}>
                  Mærkatet er også sendt til institutionens e-mail.
                </div>
              </>
            )}

            {isShipping && !labelUrl && !isDone && (
              <>
                <div style={{ background:'#FEE2E2', borderRadius:12, padding:'10px 14px', fontFamily:FONT, fontSize:13, color:'#B91C1C' }}>
                  Pakkemærkaten er ikke klar endnu. Generér den her — det tager få sekunder.
                </div>
                <button
                  disabled={booking}
                  onClick={handleBookLabel}
                  style={{
                    padding:'11px', borderRadius:99, border:'none',
                    background: booking ? PAPER2 : PRIMARY,
                    color: booking ? INK3 : '#fff',
                    fontFamily:FONT, fontWeight:700, fontSize:14, cursor: booking ? 'default' : 'pointer',
                  }}>
                  {booking ? 'Genererer…' : '🔄 Generér pakkemærkat'}
                </button>
              </>
            )}

            {isPickup && (
              <div style={{ background:'#E8F1EC', borderRadius:12, padding:'10px 14px', fontFamily:FONT, fontSize:13, color:'#133F2B' }}>
                🤝 {method === 'custom' ? 'Aftalt levering' : 'Afhentning'}: Køberen henter varen hos jer — der oprettes ingen pakkemærkat. Aftal tid og sted via beskeder med køber.
              </div>
            )}

            {tracking && (
              <div style={{ fontFamily:FONT, fontSize:12, color:INK3, textAlign:'center' }}>
                Tracking: {tracking}
              </div>
            )}
            {trackingUrl && (isShipped || isDone) && (
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{
                display:'block', textAlign:'center', padding:'11px', borderRadius:99,
                background:GREEN_TINT, color:PRIMARY, border:`1.5px solid ${PRIMARY}`,
                fontFamily:FONT, fontWeight:700, fontSize:13, textDecoration:'none',
              }}>
                📦 Spor pakken
              </a>
            )}

            {isPaid && (
              <button
                disabled={marking}
                onClick={handleMarkSent}
                style={{
                  padding:'11px', borderRadius:99, border:`1.5px solid ${PRIMARY}`,
                  background: marking ? PAPER2 : GREEN_TINT,
                  color: marking ? INK3 : PRIMARY,
                  fontFamily:FONT, fontWeight:700, fontSize:13, cursor: marking ? 'default' : 'pointer',
                }}>
                {marking ? 'Gemmer…' : isPickup ? '🤝 Marker som klar til afhentning' : '🚚 Marker som afsendt'}
              </button>
            )}
            {isShipped && (
              <div style={{ textAlign:'center', fontFamily:FONT, fontSize:12, color:INK3 }}>
                Venter på at køberen bekræfter modtagelse.
              </div>
            )}

            {!isShipping && isPaid && (
              <button
                disabled={marking}
                onClick={handleMarkSent}
                style={{
                  padding:'11px', borderRadius:99, border:`1.5px solid ${PRIMARY}`,
                  background: marking ? PAPER2 : GREEN_TINT,
                  color: marking ? INK3 : PRIMARY,
                  fontFamily:FONT, fontWeight:700, fontSize:13, cursor: marking ? 'default' : 'pointer',
                }}>
                {marking ? 'Gemmer…' : '🤝 Marker som afhentet'}
              </button>
            )}

            <button
              onClick={() => router.push(myGroup.conversationId ? `/beskeder?conv=${myGroup.conversationId}` : '/beskeder')}
              style={{
                padding:'11px', borderRadius:99, background:PAPER2, border:'none',
                fontFamily:FONT, fontWeight:600, fontSize:13, color:INK3, cursor:'pointer',
              }}>
              💬 Åbn beskeder med køber
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chat-based task card (barter / pickup / custom) ────────────

function isShippingConv(conv) {
  return conv.delivery_method === 'shipping' || !!conv.shipment_id;
}

function stepOf(conv) {
  if (conv.deal_completed) return isShippingConv(conv) ? 3 : 2;
  if (conv.shipment_id)   return 2;
  if (conv.is_handled)    return 1;
  return 0;
}

const STEPS_SHIP   = ['Ny ordre', 'Bekræftet', 'Label genereret', 'Afsendt'];
const STEPS_PICKUP = ['Ny ordre', 'Bekræftet', 'Afhentet'];

function ProgressBar({ step, shipping }) {
  const labels = shipping ? STEPS_SHIP : STEPS_PICKUP;
  return (
    <div style={{ display:'flex', alignItems:'center', margin:'10px 0 4px' }}>
      {labels.map((lbl, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <div key={lbl} style={{ display:'flex', alignItems:'center', flex: i < labels.length - 1 ? 1 : 'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth: shipping ? 46 : 54 }}>
              <div style={{
                width:22, height:22, borderRadius:'50%',
                border:`2px solid ${done||active ? PRIMARY : PAPER3}`,
                background: done ? PRIMARY : active ? GREEN_TINT : '#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, color: done ? '#fff' : active ? PRIMARY : INK3,
                fontWeight:800, flexShrink:0,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <div style={{ fontFamily:FONT, fontSize:8, fontWeight: active?700:500, color: done||active ? PRIMARY : INK3, marginTop:3, textAlign:'center', lineHeight:1.2 }}>{lbl}</div>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex:1, height:2, background: done ? PRIMARY : PAPER3, margin:'0 2px', marginBottom:16 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChatTaskCard({ conv, onAction, actionLoading }) {
  const step     = stepOf(conv);
  const shipping = isShippingConv(conv);
  const router   = useRouter();
  const isNew    = step === 0;
  const isConf   = step === 1;
  const isLabeled = step === 2 && shipping;
  const isDone   = conv.deal_completed;

  return (
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(22,34,28,0.08)', border:`1px solid ${PAPER3}`, marginBottom:10 }}>
      <div style={{ display:'flex', gap:12, padding:'14px 16px 8px', alignItems:'center' }}>
        <div style={{ width:48, height:48, borderRadius:10, background:conv.listing_color||GREEN_TINT, flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
          {conv.listing_image
            ? <img src={conv.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
            : conv.listing_emoji || '🧸'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{conv.listing_title}</div>
          <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:1 }}>
            Køber: <strong style={{ color:INK }}>{conv.initiator_name}</strong>
            <span> · {shipping ? '📦 Forsendelse' : conv.delivery_method === 'pickup' ? '📍 Afhentning' : '🤝 Aftalt levering'}</span>
          </div>
        </div>
        {isNew && (
          <span style={{ background:'#FEF9C3', color:'#92400E', borderRadius:99, fontSize:10, fontWeight:800, padding:'3px 8px', flexShrink:0 }}>NY</span>
        )}
      </div>

      <div style={{ padding:'0 16px' }}>
        <ProgressBar step={step} shipping={shipping} />
      </div>

      <div style={{ padding:'8px 16px 14px', display:'flex', gap:8, flexWrap:'wrap' }}>
        {isNew && (
          <button
            disabled={actionLoading === conv.id}
            onClick={() => onAction(conv, 'confirm')}
            style={{ flex:1, minWidth:120, padding:'10px', borderRadius:99, background: actionLoading===conv.id ? PAPER3 : PRIMARY, color: actionLoading===conv.id ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor: actionLoading===conv.id ? 'default' : 'pointer' }}>
            {actionLoading===conv.id ? 'Bekræfter…' : '✅ Bekræft ordre'}
          </button>
        )}
        {isConf && !shipping && (
          <button
            disabled={actionLoading === conv.id}
            onClick={() => onAction(conv, 'pickup_done')}
            style={{ flex:1, minWidth:120, padding:'10px', borderRadius:99, background: actionLoading===conv.id ? PAPER3 : PRIMARY, color: actionLoading===conv.id ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor: actionLoading===conv.id ? 'default' : 'pointer' }}>
            {actionLoading===conv.id ? 'Gemmer…' : '🤝 Marker som afhentet'}
          </button>
        )}
        {isLabeled && (
          <button
            disabled={actionLoading === conv.id}
            onClick={() => onAction(conv, 'mark_sent')}
            style={{ flex:1, minWidth:120, padding:'10px', borderRadius:99, background: actionLoading===conv.id ? PAPER3 : PRIMARY, color: actionLoading===conv.id ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor: actionLoading===conv.id ? 'default' : 'pointer' }}>
            {actionLoading===conv.id ? 'Gemmer…' : '🚚 Marker som afsendt'}
          </button>
        )}
        {isDone && (
          <span style={{ fontFamily:FONT, fontSize:12, color:'#065F46', fontWeight:700, background:'#D1FAE5', borderRadius:99, padding:'8px 14px' }}>✓ Gennemført</span>
        )}
        <button
          onClick={() => router.push('/beskeder?conv=' + conv.id)}
          style={{ padding:'10px 14px', borderRadius:99, background:PAPER2, color:INK3, border:'none', fontFamily:FONT, fontWeight:600, fontSize:12, cursor:'pointer', marginLeft: isDone ? 'auto' : 0 }}>
          Chat
        </button>
      </div>
    </div>
  );
}

// ── Bytte: min udgående bundt (med pakkemærkat) ───────────────
//
// Samme model som købs-kortet: hent/gengenerér label, marker afsendt,
// følg om modparten har bekræftet modtagelse.

function SwapSendCard({ s, router, onPatch }) {
  const { showToast } = useApp();
  const [marking, setMarking] = useState(false);
  const [booking, setBooking] = useState(false);

  const labelUrl  = s.shipment?.label_pdf_url;
  const tracking  = s.shipment?.tracking_number;
  const trackingUrl = s.shipment?.tracking_url;
  const isCustom  = s.recipientDelivery === 'custom';   // aftalt levering, ingen label
  const paidBoth  = s.completed;                         // begge har betalt
  const sent      = s.sent;
  const received  = s.recipientReceived;
  const needsLabel = paidBoth && !isCustom && !labelUrl;

  async function handleMarkSent() {
    setMarking(true);
    try {
      const res = await fetch('/api/swaps/mark-sent', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: s.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Noget gik galt');
      onPatch(s.id, { sent: true });
      showToast?.('Markeret som afsendt — modparten har fået besked!');
    } catch (e) {
      showToast?.(e.message || 'Kunne ikke markere som afsendt', 'error');
    }
    setMarking(false);
  }

  async function handleBookLabel() {
    setBooking(true);
    try {
      const res = await fetch('/api/swaps/book-label', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: s.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Pakkemærkat kunne ikke oprettes');
      onPatch(s.id, { shipment: { ...(s.shipment || {}), label_pdf_url: json.label_pdf_url, tracking_number: json.tracking_number, tracking_url: json.tracking_url } });
      showToast?.('Pakkemærkaten er klar!');
      if (json.label_pdf_url) window.open(json.label_pdf_url, '_blank', 'noopener');
    } catch (e) {
      showToast?.(e.message || 'Pakkemærkat kunne ikke oprettes', 'error');
    }
    setBooking(false);
  }

  const badge = !paidBoth
    ? { text: 'AFVENTER BETALING', bg: '#FEF9C3', color: '#92400E' }
    : received
      ? { text: 'MODTAGET', bg: '#DCFCE7', color: '#166534' }
      : sent
        ? { text: 'AFSENDT', bg: '#DBEAFE', color: '#1D4ED8' }
        : isCustom
          ? { text: 'SKAL LEVERES', bg: '#FEF9C3', color: '#92400E' }
          : labelUrl
            ? { text: 'SKAL SENDES', bg: '#FEF9C3', color: '#92400E' }
            : { text: 'LABEL MANGLER', bg: '#FEE2E2', color: '#B91C1C' };

  const steps = isCustom
    ? [
        { done: paidBoth,          label: 'Begge har betalt' },
        { done: sent,              label: 'Overdraget' },
        { done: received,          label: 'Modtaget' },
      ]
    : [
        { done: paidBoth,          label: 'Begge har betalt' },
        { done: !!labelUrl,        label: 'Pakkemærkat klar' },
        { done: sent,              label: 'Afsendt' },
        { done: received,          label: 'Modtaget' },
      ];

  return (
    <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${PAPER3}`, marginBottom:10, padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <div style={{ width:44, height:44, borderRadius:10, background:GREEN_TINT, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{s.items[0]?.emoji || '🔄'}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK }}>🔄 Bytte · til {s.otherName}</div>
          <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:1 }}>Du sender {s.items.length} vare(r)</div>
        </div>
        <span style={{ background:badge.bg, color:badge.color, borderRadius:99, fontSize:10, fontWeight:800, padding:'3px 8px', flexShrink:0 }}>
          {badge.text}
        </span>
      </div>
      {s.items.map((it, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ fontSize:15 }}>{it.emoji || '🧸'}</span>
          <span style={{ fontFamily:FONT, fontSize:13, color:INK }}>{it.title}</span>
        </div>
      ))}

      {/* Trin-oversigt */}
      {paidBoth && (
        <div style={{ marginTop:12, background:PAPER2, borderRadius:12, padding:'12px 14px' }}>
          {steps.map((st, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom: i < steps.length - 1 ? 8 : 0 }}>
              <div style={{
                width:20, height:20, borderRadius:'50%', flexShrink:0,
                background: st.done ? PRIMARY : '#fff',
                border: `2px solid ${st.done ? PRIMARY : PAPER3}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, color:'#fff', fontWeight:800,
              }}>{st.done ? '✓' : ''}</div>
              <span style={{ fontFamily:FONT, fontSize:12, fontWeight: st.done ? 700 : 500, color: st.done ? INK : INK3 }}>{st.label}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
        {!paidBoth && (
          <div style={{ background:'#FEF9C3', borderRadius:12, padding:'10px 14px', fontFamily:FONT, fontSize:13, color:'#92400E' }}>Pakkemærkaten oprettes når begge parter har betalt deres del.</div>
        )}

        {paidBoth && isCustom && (
          <div style={{ background:'#E8F1EC', borderRadius:12, padding:'10px 14px', fontFamily:FONT, fontSize:13, color:'#133F2B' }}>
            🤝 Aftalt levering: I leverer selv varen til {s.otherName}. Aftal tid og sted via beskeder.
          </div>
        )}

        {paidBoth && !isCustom && labelUrl && (
          <a href={labelUrl} target="_blank" rel="noopener noreferrer" style={{ display:'block', textAlign:'center', padding:'11px', borderRadius:99, background:PRIMARY, color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:14, textDecoration:'none' }}>🖨️ Download pakkemærkat (PDF)</a>
        )}

        {needsLabel && (
          <>
            <div style={{ background:'#FEE2E2', borderRadius:12, padding:'10px 14px', fontFamily:FONT, fontSize:13, color:'#B91C1C' }}>
              Pakkemærkaten er ikke klar endnu. Generér den her — det tager få sekunder.
            </div>
            <button disabled={booking} onClick={handleBookLabel} style={{ padding:'11px', borderRadius:99, border:'none', background: booking ? PAPER2 : PRIMARY, color: booking ? INK3 : '#fff', fontFamily:FONT, fontWeight:700, fontSize:14, cursor: booking ? 'default' : 'pointer' }}>
              {booking ? 'Genererer…' : '🔄 Generér pakkemærkat'}
            </button>
          </>
        )}

        {tracking && <div style={{ fontFamily:FONT, fontSize:12, color:INK3, textAlign:'center' }}>Tracking: {tracking}</div>}
        {trackingUrl && (sent || received) && (
          <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{ display:'block', textAlign:'center', padding:'11px', borderRadius:99, background:GREEN_TINT, color:PRIMARY, border:`1.5px solid ${PRIMARY}`, fontFamily:FONT, fontWeight:700, fontSize:13, textDecoration:'none' }}>📦 Spor pakken</a>
        )}

        {paidBoth && !sent && (isCustom || labelUrl) && (
          <button disabled={marking} onClick={handleMarkSent} style={{ padding:'11px', borderRadius:99, border:`1.5px solid ${PRIMARY}`, background: marking ? PAPER2 : GREEN_TINT, color: marking ? INK3 : PRIMARY, fontFamily:FONT, fontWeight:700, fontSize:13, cursor: marking ? 'default' : 'pointer' }}>
            {marking ? 'Gemmer…' : isCustom ? '🤝 Marker som overdraget' : '🚚 Marker som afsendt'}
          </button>
        )}
        {sent && !received && (
          <div style={{ textAlign:'center', fontFamily:FONT, fontSize:12, color:INK3 }}>Venter på at {s.otherName} bekræfter modtagelse.</div>
        )}
        {received && (
          <div style={{ textAlign:'center', fontFamily:FONT, fontSize:13, fontWeight:700, color:PRIMARY }}>✓ {s.otherName} har modtaget din del</div>
        )}

        <button onClick={() => router.push(s.conversation_id ? `/beskeder?conv=${s.conversation_id}` : '/beskeder')} style={{ padding:'11px', borderRadius:99, background:PAPER2, border:'none', fontFamily:FONT, fontWeight:600, fontSize:13, color:INK3, cursor:'pointer' }}>💬 Åbn byttehandel</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function MineOpgaverPage() {
  const router = useRouter();
  const { effectiveInstitution, showToast } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [stripeOrders, setStripeOrders] = useState([]);
  const [chatTasks, setChatTasks] = useState([]);
  const [swapSends, setSwapSends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('aktive');
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await db.auth.getUser();
    if (!user) { setLoading(false); return; }

    let inst = effectiveInstitution || null;
    if (!inst) {
      const { data: ownInst } = await db.from('institutions').select('*').ilike('email', user.email).maybeSingle();
      if (ownInst) { inst = ownInst; }
      else {
        const { data: mem } = await db.from('institution_members').select('role,institutions(*)').eq('email', user.email).maybeSingle();
        if (mem?.institutions) inst = { ...mem.institutions, _memberRole: mem.role };
      }
    }

    const uid    = user.id;
    const instId = inst?.id;
    const instName = inst?.name;

    // 1. Stripe orders where I'm a seller — via service-role API route (bypasses RLS)
    {
      const res = await fetch('/api/seller-orders', { credentials: 'same-origin' });
      if (res.ok) {
        const json = await res.json();
        setStripeOrders(json.orders || []);
      }
    }

    // 2. Chat-based tasks (barter / pickup / legacy)
    const parts = [];
    if (instId)   parts.push(`owner_institution_id.eq.${instId}`);
    if (uid)      parts.push(`owner_id.eq.${uid}`);
    if (instName) parts.push(`owner_name.eq.${instName}`);

    if (parts.length) {
      const { data } = await db.from('conversations')
        .select('id,listing_title,listing_emoji,listing_color,listing_image,initiator_name,is_handled,handled_action,deal_completed,deal_type,delivery_method,shipment_id,last_message_at,owner_name,initiator_institution_id')
        .or(parts.join(','))
        .in('deal_type', ['byt', 'bundle', 'køb'])
        .order('last_message_at', { ascending: false })
        .limit(100);
      setChatTasks(data || []);
    }

    // 3. Bytte — du sender (din udgående bundt + din pakkemærkat)
    if (instId) {
      const { data: props } = await db.from('swap_proposals')
        .select('id, conversation_id, escrow_status, initiator_institution_id, owner_institution_id, offered_items, requested_items, initiator_shipment_id, owner_shipment_id, initiator_sent, owner_sent, initiator_delivery, owner_delivery, initiator_received, owner_received')
        .or(`initiator_institution_id.eq.${instId},owner_institution_id.eq.${instId}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });
      if (props?.length) {
        const myShipIds = props.map(p => p.initiator_institution_id === instId ? p.initiator_shipment_id : p.owner_shipment_id).filter(Boolean);
        const otherIds = [...new Set(props.map(p => p.initiator_institution_id === instId ? p.owner_institution_id : p.initiator_institution_id).filter(Boolean))];
        const [{ data: ships }, { data: insts }] = await Promise.all([
          myShipIds.length ? db.from('shipments').select('id,label_pdf_url,tracking_number,tracking_url').in('id', myShipIds) : Promise.resolve({ data: [] }),
          otherIds.length ? db.from('institutions_public').select('id,name').in('id', otherIds) : Promise.resolve({ data: [] }),
        ]);
        const shipById = Object.fromEntries((ships || []).map(x => [x.id, x]));
        const nameById = Object.fromEntries((insts || []).map(x => [x.id, x.name]));
        setSwapSends(props.map(p => {
          const meInit = p.initiator_institution_id === instId;
          return {
            id: p.id,
            conversation_id: p.conversation_id,
            items: (meInit ? p.offered_items : p.requested_items) || [],
            otherName: nameById[meInit ? p.owner_institution_id : p.initiator_institution_id] || 'Modpart',
            shipment: shipById[meInit ? p.initiator_shipment_id : p.owner_shipment_id] || null,
            completed: p.escrow_status === 'both_paid_released',
            // Min udgående status: mit sent-flag, om modparten har bekræftet modtagelse,
            // og modpartens leveringsvalg der afgør om der er en label.
            sent:            meInit ? p.initiator_sent : p.owner_sent,
            recipientReceived: meInit ? p.owner_received : p.initiator_received,
            recipientDelivery: meInit ? p.owner_delivery : p.initiator_delivery,
          };
        }).filter(s => s.items.length));
      } else {
        setSwapSends([]);
      }
    }

    setLoading(false);
  }, [effectiveInstitution?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(conv, action) {
    setActionLoading(conv.id);
    try {
      const { data: { user } } = await db.auth.getUser();
      const now = new Date().toISOString();
      const senderName = effectiveInstitution?.name || conv.owner_name || 'Sælger';

      if (action === 'confirm') {
        const msg = `✅ ${senderName} har bekræftet din ordre.`;
        await db.from('chat_messages').insert({ conversation_id: conv.id, sender_id: user.id, sender_name: senderName, content: msg });
        const upd = { is_handled: true, handled_at: now, handled_action: 'order_confirmed', deal_type: 'køb', last_message: msg, last_message_at: now, initiator_unread: 1 };
        await db.from('conversations').update(upd).eq('id', conv.id);
        setChatTasks(ts => ts.map(t => t.id === conv.id ? { ...t, ...upd } : t));
        showToast?.('Ordre bekræftet!');
      } else if (action === 'mark_sent') {
        const msg = `🚚 ${senderName} har afsendt pakken.`;
        await db.from('chat_messages').insert({ conversation_id: conv.id, sender_id: user.id, sender_name: senderName, content: msg });
        const upd = { deal_completed: true, deal_completed_at: now, delivery_status: 'sent', last_message: msg, last_message_at: now, initiator_unread: 1 };
        await db.from('conversations').update(upd).eq('id', conv.id);
        setChatTasks(ts => ts.map(t => t.id === conv.id ? { ...t, ...upd } : t));
        showToast?.('Markeret som afsendt!');
      } else if (action === 'pickup_done') {
        const msg = `🤝 ${senderName} har markeret varen som afhentet.`;
        await db.from('chat_messages').insert({ conversation_id: conv.id, sender_id: user.id, sender_name: senderName, content: msg });
        const upd = { deal_completed: true, deal_completed_at: now, last_message: msg, last_message_at: now, initiator_unread: 1 };
        await db.from('conversations').update(upd).eq('id', conv.id);
        setChatTasks(ts => ts.map(t => t.id === conv.id ? { ...t, ...upd } : t));
        showToast?.('Markeret som afhentet!');
      }
    } catch {
      showToast?.('Noget gik galt', 'error');
    }
    setActionLoading(null);
  }

  const activeChatTasks = chatTasks.filter(t => !t.deal_completed);
  const doneChatTasks   = chatTasks.filter(t => t.deal_completed);
  const activeStripe    = stripeOrders.filter(o => o.status === 'paid' || o.status === 'shipped');
  const doneStripe      = stripeOrders.filter(o => o.status === 'delivered');
  // Bytter, hvor modparten har bekræftet modtagelse, er gennemført.
  const activeSwapSends = swapSends.filter(s => !s.recipientReceived);
  const doneSwapSends   = swapSends.filter(s => s.recipientReceived);

  const totalActive  = activeStripe.length + activeChatTasks.length + activeSwapSends.length;
  const totalDone    = doneStripe.length + doneChatTasks.length + doneSwapSends.length;

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 0' }}>
          <button onClick={() => router.push('/profil')} style={{ background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0, flex:1 }}>Skal sendes</h1>
          {totalActive > 0 && (
            <span style={{ background:'#FEF9C3', color:'#92400E', borderRadius:99, fontSize:12, fontWeight:700, padding:'4px 12px' }}>
              {totalActive} afventer
            </span>
          )}
        </div>

        <div style={{ display:'flex', borderBottom:`2px solid ${PAPER3}`, background:'#fff', marginTop:12 }}>
          {[['aktive',`Aktive (${totalActive})`], ['gennemforte',`Gennemførte (${totalDone})`]].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ flex:1, padding:'13px', border:'none', background:'none', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:15, color: filter===val ? PRIMARY : INK3, borderBottom: filter===val ? `2px solid ${PRIMARY}` : '2px solid transparent', marginBottom:-2 }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ padding:'12px 16px 0' }}>
          {loading ? (
            <div style={{ padding:'60px 0', textAlign:'center' }}><Spinner /></div>
          ) : (
            <>
              {filter === 'aktive' && (
                <>
                  {activeStripe.length === 0 && activeChatTasks.length === 0 && activeSwapSends.length === 0 && (
                    <div style={{ padding:'60px 20px', textAlign:'center', background:'#fff', borderRadius:16 }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>Intet at sende lige nu</div>
                      <div style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>Alt er klaret, godt gået!</div>
                    </div>
                  )}
                  {activeSwapSends.map(s => <SwapSendCard key={s.id} s={s} router={router}
                    onPatch={(id, patch) => setSwapSends(list => list.map(x => x.id === id ? { ...x, ...patch } : x))} />)}
                  {activeStripe.map(order =>
                    order.myGroups.map((g, gi) => (
                      <StripeOrderCard key={`${order.id}-${gi}`} order={order} myGroup={g}
                        onMarkedSent={id => setStripeOrders(os => os.map(o => o.id === id ? { ...o, status: 'shipped' } : o))}
                        onGroupPatch={(id, group, patch) => setStripeOrders(os => os.map(o => o.id === id
                          ? { ...o, myGroups: o.myGroups.map(x => x === group ? { ...x, ...patch } : x) }
                          : o))} />
                    ))
                  )}
                  {activeChatTasks.map(conv => (
                    <ChatTaskCard key={conv.id} conv={conv} onAction={handleAction} actionLoading={actionLoading} />
                  ))}
                </>
              )}
              {filter === 'gennemforte' && (
                <>
                  {doneStripe.length === 0 && doneChatTasks.length === 0 && doneSwapSends.length === 0 && (
                    <div style={{ padding:'60px 20px', textAlign:'center', background:'#fff', borderRadius:16 }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>Ingen gennemførte handler endnu</div>
                      <div style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>Handler vises her når de er afsluttet</div>
                    </div>
                  )}
                  {doneSwapSends.map(s => <SwapSendCard key={s.id} s={s} router={router}
                    onPatch={(id, patch) => setSwapSends(list => list.map(x => x.id === id ? { ...x, ...patch } : x))} />)}
                  {doneStripe.map(order =>
                    order.myGroups.map((g, gi) => (
                      <StripeOrderCard key={`${order.id}-${gi}`} order={order} myGroup={g} onMarkedSent={() => {}} onGroupPatch={() => {}} />
                    ))
                  )}
                  {doneChatTasks.map(conv => (
                    <ChatTaskCard key={conv.id} conv={conv} onAction={handleAction} actionLoading={actionLoading} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
