'use client';
import { useState, useEffect } from 'react';
import { Modal, Btn, Spinner } from '@/components/ui';
import { PRIMARY, INK, INK2, INK3, GREEN_TINT, GREEN_SOFT, PAPER2, PAPER3, FONT } from '@/lib/constants';
import { calcServiceFee } from '@/lib/pricing';
import { getShippingPrice } from '@/lib/shipping-rates';
import { authedFetch } from '@/lib/authed-fetch';

const kr = n => `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;

// Vinted-stil tilbud-popup. Bruges på alle køb-/byd-opslag.
export default function OfferModal({ open, onClose, listing, onSubmitted, showToast }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [quota, setQuota] = useState(null); // { remainingToday, dailyLimit }
  const [showProtectionInfo, setShowProtectionInfo] = useState(false);

  const price = Number(listing?.price) || 0;
  const hasPrice = price > 0;
  const minBid = Number(listing?.min_bid) || 0;

  // Hurtigvalg ud fra prisen (afrundet til hele kroner).
  const quick = hasPrice
    ? [
        { label: '−10%', value: Math.round(price * 0.9 * 100) / 100 },
        { label: '−20%', value: Math.round(price * 0.8 * 100) / 100 },
        { label: 'Fuld pris', value: price },
      ]
    : [];

  useEffect(() => {
    if (!open) return;
    setAmount(hasPrice ? String(Math.round(price * 0.9 * 100) / 100) : (minBid ? String(minBid) : ''));
    setNote('');
    setQuota(null);
    authedFetch('/api/offers/quota')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.remainingToday === 'number') setQuota(d); })
      .catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const num = Number(amount);
  const valid = Number.isFinite(num) && num > 0 && (!minBid || num >= minBid);

  // Live prisoversigt: tilbud + estimeret porto (fra) + køberbeskyttelse.
  const so = listing?.shipping_options?.[0];
  const canShip = so?.allow_shipping || (!so && listing?.can_ship);
  const portoIncluded = so?.shipping_included_in_price;
  const portoFrom = canShip && !portoIncluded ? getShippingPrice('parcel_shop_gls', so?.shipping_size_category) : 0;
  const protection = valid ? calcServiceFee(num) : 0;
  const totalCa = valid ? num + (portoFrom || 0) + protection : 0;

  async function submit() {
    if (!valid) {
      if (minBid && num < minBid) showToast?.(`Mindstebud er ${minBid} kr.`, 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await authedFetch('/api/offers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, amount: num, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast?.(data.error || 'Tilbuddet kunne ikke sendes', 'error');
        setSaving(false);
        return;
      }
      showToast?.(`Tilbud på ${kr(num)} sendt! 🎉`);
      // Notificér sælger (e-mail + push) — fire-and-forget.
      if (data.seller?.email) {
        authedFetch('/api/notify-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerEmail: data.seller.email,
            ownerName: data.seller.name,
            senderName: data.buyerName || 'En institution',
            listingTitle: listing.title,
            listingEmoji: listing.emoji || '🧸',
            convId: data.conversationId,
          }),
        }).catch(() => {});
      }
      onSubmitted?.(data);
      setSaving(false);
      onClose?.();
    } catch {
      showToast?.('Noget gik galt — prøv igen', 'error');
      setSaving(false);
    }
  }

  const row = (label, value, extra) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:FONT, fontSize:13 }}>
      <span style={{ color:INK3 }}>{label}</span>
      <span style={{ color:INK2, fontWeight:600 }}>{extra}{value}</span>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Giv et tilbud">
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {hasPrice && (
          <div style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>
            Pris: <strong style={{ color:INK }}>{kr(price)}</strong>
          </div>
        )}

        {quick.length > 0 && (
          <div style={{ display:'flex', gap:8 }}>
            {quick.map(q => {
              const active = num === q.value;
              return (
                <button key={q.label} type="button" onClick={() => setAmount(String(q.value))}
                  style={{
                    flex:1, padding:'10px 6px', borderRadius:12, cursor:'pointer',
                    border:`1.5px solid ${active ? PRIMARY : PAPER3}`,
                    background: active ? GREEN_TINT : '#fff',
                    fontFamily:FONT, fontWeight:700, fontSize:13,
                    color: active ? PRIMARY : INK2,
                  }}>
                  <div>{q.label}</div>
                  <div style={{ fontSize:11, color:INK3, fontWeight:600 }}>{kr(q.value)}</div>
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK2, display:'block', marginBottom:6 }}>
            Dit tilbud (kr.)
          </label>
          <input
            type="number" inputMode="numeric" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={minBid ? `Mindst ${minBid} kr.` : 'Fx 150'}
            style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`,
              fontSize:16, fontFamily:FONT, fontWeight:700, outline:'none', boxSizing:'border-box' }}
          />
          {minBid > 0 && (
            <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginTop:6 }}>Mindstebud: {kr(minBid)}</div>
          )}
        </div>

        <input
          type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Besked til sælger (valgfrit)"
          maxLength={500}
          style={{ width:'100%', padding:'10px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`,
            fontSize:14, fontFamily:FONT, outline:'none', boxSizing:'border-box' }}
        />

        {valid && (
          <div style={{ background:GREEN_TINT, border:`1px solid ${GREEN_SOFT}`, borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:7 }}>
            {row('Dit tilbud', kr(num))}
            {canShip && !portoIncluded && row('Porto (fra)', kr(portoFrom), '~')}
            {portoIncluded && row('Porto', 'inkluderet')}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:FONT, fontSize:13 }}>
                <button type="button" onClick={() => setShowProtectionInfo(v => !v)}
                  style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:INK3, fontFamily:FONT, fontSize:13 }}>
                  Køberbeskyttelse <span style={{ fontSize:12, color:PRIMARY }}>ℹ️</span>
                </button>
                <span style={{ color:INK2, fontWeight:600 }}>{kr(protection)}</span>
              </div>
              {showProtectionInfo && (
                <div style={{ marginTop:6, padding:'8px 10px', background:'#f0fdf4', borderRadius:8, fontFamily:FONT, fontSize:12, color:INK2, lineHeight:1.6 }}>
                  5% af tilbudsbeløbet + 5 kr. Dækker dig hvis sælger ikke sender varen, og sikrer sikker betaling via vores platform.
                </div>
              )}
            </div>
            <div style={{ borderTop:`1px solid ${GREEN_SOFT}`, marginTop:2, paddingTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:INK }}>Du betaler ca.</span>
              <span style={{ fontFamily:FONT, fontWeight:800, fontSize:16, color:PRIMARY }}>{kr(totalCa)}</span>
            </div>
            {canShip && !portoIncluded && (
              <div style={{ fontFamily:FONT, fontSize:11, color:INK3, lineHeight:1.5 }}>Porto beregnes præcist ved betaling, når du vælger leveringsmetode.</div>
            )}
          </div>
        )}

        <Btn variant="primary" onClick={submit} disabled={!valid || saving}
          style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>
          {saving ? <><Spinner/> Sender…</> : 'Send tilbud'}
        </Btn>

        {quota && (
          <div style={{ fontFamily:FONT, fontSize:12, color: quota.remainingToday > 0 ? INK3 : '#b91c1c', textAlign:'center' }}>
            {quota.remainingToday > 0
              ? `${quota.remainingToday} af ${quota.dailyLimit} tilbud tilbage i dag`
              : 'Du har brugt dagens tilbud — prøv igen i morgen'}
          </div>
        )}
      </div>
    </Modal>
  );
}
