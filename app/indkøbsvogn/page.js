'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { CATEGORIES } from '@/lib/categories';
import { authedFetch } from '@/lib/authed-fetch';

export default function CartPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;
  const { cart, removeFromCart, clearCart, setSelectedConvId, showToast } = useApp();
  const { userId, institutionId, institution } = useActiveUser();
  const [sending, setSending] = useState(false);

  // Group by seller institution
  const groups = useMemo(() => {
    const map = {};
    for (const item of (cart || [])) {
      const key = item.ownerInstitutionName;
      if (!map[key]) map[key] = { ownerInstitutionName: key, ownerId: item.ownerId, items: [] };
      map[key].items.push(item);
    }
    return Object.values(map);
  }, [cart]);

  // Per-group selected + note state
  const [selected, setSelected] = useState({});
  const [notes, setNotes] = useState({});
  // Delivery: shipping_options per listingId, and chosen method per group
  const [shippingOptions, setShippingOptions] = useState({});
  const [deliveryChoices, setDeliveryChoices] = useState({});

  useEffect(() => {
    const ids = (cart || []).map(i => i.listingId).filter(Boolean);
    if (!ids.length) return;
    db.from('shipping_options').select('*').in('listing_id', ids).then(({ data }) => {
      if (!data) return;
      const map = {};
      for (const so of data) map[so.listing_id] = so;
      setShippingOptions(map);
    });
  }, [cart?.length]);

  function isSelected(name) {
    return name in selected ? selected[name] : true; // default: selected
  }
  function toggleSelected(name) {
    setSelected(prev => ({ ...prev, [name]: !isSelected(name) }));
  }
  function setNote(name, val) {
    setNotes(prev => ({ ...prev, [name]: val }));
  }

  const selectedGroups = groups.filter(g => isSelected(g.ownerInstitutionName));
  const selectedItems = selectedGroups.flatMap(g => g.items);
  const selectedTotal = selectedItems.reduce((s, i) => s + (i.price || 0), 0);

  async function handleCheckout() {
    if (!userId) { router.push('/login'); return; }
    if (selectedGroups.length === 0) { showToast('Vælg mindst én sælger', 'error'); return; }
    setSending(true);
    try {
      const senderName = institution?.name || 'Ukendt institution';
      const myInstId = institutionId || null;
      let lastConvId = null;

      for (const group of selectedGroups) {
        if (group.ownerInstitutionName?.toLowerCase() === senderName?.toLowerCase()) {
          showToast('Du kan ikke købe dine egne opslag', 'error');
          continue;
        }
        const groupNote = notes[group.ownerInstitutionName]?.trim() || null;
        const { data: ownerInst } = await db.from('institutions')
          .select('id,email,name')
          .ilike('name', group.ownerInstitutionName)
          .maybeSingle();

        const orFilter = myInstId
          ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${userId}`
          : `initiator_id.eq.${userId}`;
        const firstItem = group.items[0];
        const { data: existing } = await db.from('conversations')
          .select('id,owner_unread')
          .eq('listing_id', firstItem.listingId)
          .or(orFilter)
          .maybeSingle();

        let convId, ownerUnread;
        if (existing) {
          convId = existing.id;
          ownerUnread = existing.owner_unread || 0;
        } else {
          const { data: conv } = await db.from('conversations').insert({
            listing_id: firstItem.listingId,
            listing_title: firstItem.listingTitle,
            listing_emoji: firstItem.listingEmoji || '🛒',
            listing_color: firstItem.listingColor,
            listing_image: firstItem.images?.[0] || null,
            initiator_id: userId,
            initiator_name: senderName,
            initiator_institution_id: myInstId,
            owner_id: group.ownerId,
            owner_name: group.ownerInstitutionName,
            owner_institution_id: ownerInst?.id || null,
          }).select().single();
          convId = conv?.id;
          ownerUnread = 0;

          if (conv && ownerInst?.email && ownerInst.email.toLowerCase() !== (institution?.email || '').toLowerCase()) {
            authedFetch('/api/notify-message', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName, listingTitle: firstItem.listingTitle, listingEmoji: firstItem.listingEmoji, convId }),
            }).catch(() => {});
          }
        }

        if (!convId) continue;

        const groupDelivery = deliveryChoices[group.ownerInstitutionName] || null;
        const buyData = {
          items: group.items.map(i => ({ listingId: i.listingId, title: i.listingTitle, price: i.price, emoji: i.listingEmoji, category: i.category })),
          totalPrice: group.items.reduce((s, i) => s + (i.price || 0), 0),
          note: groupNote,
          buyerName: senderName,
          delivery_method: groupDelivery,
        };
        const msgText = `Købsforespørgsel: ${group.items.map(i => i.listingTitle).join(', ')} — ${buyData.totalPrice} kr.`;
        await db.from('chat_messages').insert({
          conversation_id: convId,
          sender_id: userId,
          sender_name: senderName,
          content: JSON.stringify(buyData),
          message_type: 'buy_request',
        });
        await db.from('conversations').update({
          last_message: msgText,
          last_message_at: new Date().toISOString(),
          owner_unread: ownerUnread + 1,
          ...(groupDelivery ? { delivery_method: groupDelivery } : {}),
        }).eq('id', convId);

        // Remove sent items from cart
        for (const item of group.items) removeFromCart(item.listingId);
        lastConvId = convId;
      }

      showToast(`${selectedGroups.length > 1 ? `${selectedGroups.length} forespørgsler` : 'Forespørgsel'} sendt! 🎉`);
      if (lastConvId) setSelectedConvId(lastConvId);
      router.push('/beskeder');
    } catch {
      showToast('Noget gik galt — prøv igen', 'error');
    }
    setSending(false);
  }

  if ((cart?.length || 0) === 0) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🛒</div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: INK, marginBottom: 8 }}>Din kurv er tom</div>
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 28, textAlign: 'center' }}>
          Find køb-opslag og tryk "Læg i kurv" for at samle dine indkøb.
        </p>
        <button onClick={() => router.push('/opslag')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Se opslag →
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>

        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 34, color: INK, letterSpacing: '-0.03em', marginBottom: 6 }}>
          Din indkøbsvogn
        </h1>
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 32 }}>
          {cart.length} vare{cart.length !== 1 ? 'r' : ''} fra {groups.length} sælger{groups.length !== 1 ? 'e' : ''} — vælg hvilke forespørgsler du vil sende nu
        </p>

        {/* Groups */}
        {groups.map((group) => {
          const name = group.ownerInstitutionName;
          const sel = isSelected(name);
          const groupTotal = group.items.reduce((s, i) => s + (i.price || 0), 0);
          return (
            <div key={name} style={{ background: '#fff', borderRadius: 20, border: `2px solid ${sel ? PRIMARY : PAPER3}`, marginBottom: 20, overflow: 'hidden', opacity: sel ? 1 : 0.55, transition: 'all 0.2s' }}>

              {/* Group header with checkbox */}
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${PAPER2}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => toggleSelected(name)}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel ? PRIMARY : PAPER3}`, background: sel ? PRIMARY : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                  {sel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: sel ? PRIMARY : PAPER3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sel ? '#fff' : INK3, fontWeight: 800, fontSize: 14, fontFamily: FONT, flexShrink: 0, transition: 'all 0.2s' }}>
                  {name?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, flex: 1 }}>{name}</div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: sel ? PRIMARY : INK3 }}>{groupTotal > 0 ? `${groupTotal} kr.` : '—'}</div>
              </div>

              {/* Items */}
              {group.items.map((item, ii) => {
                const cat = CATEGORIES.find(c => c.key === item.category);
                return (
                  <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: `1px solid ${PAPER2}` }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: item.images?.[0] ? '#ddd' : (item.listingColor || GREEN_TINT), overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                      {item.images?.[0]
                        ? <img src={item.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (item.listingEmoji || '🧸')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, lineHeight: 1.3 }}>{item.listingTitle}</div>
                      {cat && <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, marginTop: 1 }}>{cat.emoji} {cat.label}</div>}
                    </div>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: item.price ? PRIMARY : INK3, flexShrink: 0 }}>
                      {item.price ? `${item.price} kr.` : '—'}
                    </div>
                    <button onClick={() => removeFromCart(item.listingId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK3, padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}

              {/* Delivery method selection */}
              {(() => {
                const firstSo = shippingOptions[group.items[0]?.listingId];
                if (!firstSo) return null;
                const opts = [];
                if (firstSo.allow_pickup) opts.push({ key:'pickup', icon:'📍', label:'Afhentes', sub: firstSo.pickup_address || null });
                if (firstSo.allow_shipping) opts.push({ key:'shipping', icon:'📦', label:'Pakkepost', sub: firstSo.shipping_included_in_price ? 'Porto inkluderet' : 'Porto betales separat' });
                if (firstSo.allow_custom) opts.push({ key:'custom', icon:'🤝', label:'Aftales', sub: 'I aftaler levering direkte' });
                if (!opts.length) return null;
                const chosen = deliveryChoices[name];
                return (
                  <div style={{ padding: '0 20px 12px' }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: INK2, marginBottom: 8 }}>Vælg leveringsmetode</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {opts.map(opt => (
                        <button key={opt.key} onClick={() => setDeliveryChoices(prev => ({ ...prev, [name]: opt.key }))}
                          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:12, border:`2px solid ${chosen===opt.key ? PRIMARY : PAPER3}`, background: chosen===opt.key ? GREEN_TINT : '#fff', cursor:'pointer', fontFamily:FONT, fontSize:12, fontWeight:600, color: chosen===opt.key ? PRIMARY : INK2, transition:'all 0.15s' }}>
                          <span>{opt.icon}</span>
                          <div style={{ textAlign:'left' }}>
                            <div>{opt.label}</div>
                            {opt.sub && <div style={{ fontSize:10, color: chosen===opt.key ? PRIMARY : INK3, fontWeight:400 }}>{opt.sub}</div>}
                          </div>
                          {chosen===opt.key && <span style={{ fontSize:12, color:PRIMARY }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Per-group note */}
              <div style={{ padding: '12px 20px' }}>
                <textarea
                  value={notes[name] || ''}
                  onChange={e => setNote(name, e.target.value)}
                  placeholder={`Besked til ${name} (valgfri) — fx hvornår du kan hente`}
                  rows={2}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, fontFamily: FONT, fontSize: 13, resize: 'none', outline: 'none', background: PAPER2, boxSizing: 'border-box', color: INK2 }}
                />
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div style={{ background: GREEN_TINT, borderRadius: 16, border: `1px solid ${GREEN_SOFT}`, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: FONT, fontSize: 14, color: INK2 }}>
              {selectedGroups.length === 0
                ? 'Ingen sælgere valgt'
                : `Sender til ${selectedGroups.length} ud af ${groups.length} sælger${groups.length !== 1 ? 'e' : ''}`}
            </span>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK }}>{selectedTotal > 0 ? `${selectedTotal} kr.` : '—'}</span>
          </div>
          <p style={{ fontFamily: FONT, fontSize: 12, color: INK3, margin: 0 }}>
            Ikke-valgte sælgere forbliver i kurven til næste gang.
          </p>
        </div>

        <button onClick={handleCheckout} disabled={sending || selectedGroups.length === 0} style={{
          width: '100%', padding: '16px', borderRadius: 99,
          background: (sending || selectedGroups.length === 0) ? PAPER3 : PRIMARY,
          color: (sending || selectedGroups.length === 0) ? INK3 : '#fff',
          border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 16,
          cursor: (sending || selectedGroups.length === 0) ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        }}>
          {sending
            ? 'Sender…'
            : selectedGroups.length === 0
              ? 'Vælg mindst én sælger'
              : `Send ${selectedGroups.length > 1 ? `${selectedGroups.length} forespørgsler` : 'forespørgsel'} →`}
        </button>

        <button onClick={() => router.back()} style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 99, background: 'none', border: 'none', fontFamily: FONT, fontWeight: 600, fontSize: 14, color: INK3, cursor: 'pointer' }}>
          ← Fortsæt med at handle
        </button>
      </div>
    </div>
  );
}
