'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, GREEN_DEEP, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { CATEGORIES } from '@/lib/categories';
import { authedFetch } from '@/lib/authed-fetch';

// ── Helpers ────────────────────────────────────────────────────

function RadioRow({ chosen, value, onChoose, icon, label, sublabel, price, loading, priceFixed }) {
  const active = chosen === value;
  return (
    <button type="button" onClick={() => onChoose(value)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 14,
      border: `2px solid ${active ? PRIMARY : PAPER3}`,
      background: active ? GREEN_TINT : '#fff',
      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
      marginBottom: 8,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: active ? PRIMARY : INK }}>{label}</div>
        {sublabel && <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2 }}>{sublabel}</div>}
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        {loading
          ? <span style={{ fontSize: 12, color: INK3, fontFamily: FONT }}>Henter…</span>
          : price != null
            ? <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: active ? PRIMARY : INK2 }}>
                {priceFixed ? 'Ca.' : 'Fra'} {price} kr.
              </span>
            : null}
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${active ? PRIMARY : PAPER3}`,
        background: active ? PRIMARY : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function CartPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;
  const { cart, removeFromCart, clearCart, setSelectedConvId, showToast } = useApp();
  const { userId, institutionId, institution } = useActiveUser();
  const [sending, setSending] = useState(false);

  // Group cart items by seller
  const groups = useMemo(() => {
    const map = {};
    for (const item of (cart || [])) {
      const key = item.ownerInstitutionName;
      if (!map[key]) map[key] = { ownerInstitutionName: key, ownerId: item.ownerId, items: [] };
      map[key].items.push(item);
    }
    return Object.values(map);
  }, [cart]);

  const [selected, setSelected] = useState({});
  const [notes, setNotes] = useState({});
  const [shippingOptions, setShippingOptions] = useState({});  // listingId → shipping_options row
  const [listingsCanShip, setListingsCanShip] = useState({});  // listingId → can_ship bool

  // Per-group delivery state
  // { [sellerName]: { method: 'parcel_shop'|'home_delivery'|'pickup'|'custom', pickupPoint: obj|null, price: number|null } }
  const [deliveryState, setDeliveryState] = useState({});

  // Quote data: sizeCategory → { parcel_shop: { min_price }, home_delivery: { min_price } }
  const [quotes, setQuotes] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Pickup points: sellerName → { loading, points, chosen }
  const [pickupState, setPickupState] = useState({});

  // Load shipping_options + listings.can_ship + price quotes
  useEffect(() => {
    const ids = (cart || []).map(i => i.listingId).filter(Boolean);
    if (!ids.length) return;

    Promise.all([
      db.from('shipping_options').select('*').in('listing_id', ids),
      db.from('listings').select('id, can_ship').in('id', ids),
    ]).then(([{ data: soData }, { data: lstData }]) => {
      const soMap = {};
      if (soData) for (const so of soData) soMap[so.listing_id] = so;
      setShippingOptions(soMap);

      const canShipMap = {};
      if (lstData) for (const l of lstData) canShipMap[l.id] = l.can_ship;
      setListingsCanShip(canShipMap);

      // Fetch price quotes for unique size categories (fallback to 'medium' for legacy can_ship listings)
      const soSizes = (soData || []).map(s => s.shipping_size_category).filter(Boolean);
      const hasLegacyShip = (lstData || []).some(l => l.can_ship && !soMap[l.id]);
      const sizes = [...new Set([...soSizes, ...(hasLegacyShip ? ['medium'] : [])])];
      if (!sizes.length) return;
      setQuotesLoading(true);
      Promise.all(sizes.map(size =>
        authedFetch(`/api/shipping/quote?size=${size}`)
          .then(r => r.ok ? r.json() : null)
          .then(json => json ? { size, data: json } : null)
          .catch(() => null)
      )).then(results => {
        const q = {};
        for (const r of results) if (r) q[r.size] = r.data;
        setQuotes(q);
        setQuotesLoading(false);
      });
    });
  }, [cart?.length]);

  function isSelected(name) { return name in selected ? selected[name] : true; }
  function toggleSelected(name) { setSelected(p => ({ ...p, [name]: !isSelected(name) })); }

  function setDeliveryMethod(sellerName, method, price) {
    setDeliveryState(p => ({ ...p, [sellerName]: { ...p[sellerName], method, price: price ?? null, pickupPoint: null } }));
    if (method === 'parcel_shop') loadPickupPoints(sellerName);
  }

  function loadPickupPoints(sellerName, carrier = 'postnord') {
    const zip = institution?.zipcode || institution?.zip_code || '2100';
    setPickupState(p => ({ ...p, [sellerName]: { loading: true, points: [], chosen: null, error: null } }));
    authedFetch(`/api/shipping/pickup-points?zip=${zip}&carrier=${carrier}`)
      .then(r => r.json().then(j => ({ ok: r.ok, status: r.status, json: j })))
      .then(({ ok, status, json }) => {
        if (!ok) {
          const msg = json?.error || `Fejl ${status}`;
          console.error('[pickup-points] API fejl:', msg);
          setPickupState(p => ({ ...p, [sellerName]: { loading: false, points: [], chosen: null, error: msg } }));
        } else {
          setPickupState(p => ({ ...p, [sellerName]: { loading: false, points: json?.points || [], chosen: null, error: null } }));
        }
      })
      .catch(err => {
        console.error('[pickup-points] Netværksfejl:', err);
        setPickupState(p => ({ ...p, [sellerName]: { loading: false, points: [], chosen: null, error: String(err) } }));
      });
  }

  function choosePickupPoint(sellerName, point) {
    setPickupState(p => ({ ...p, [sellerName]: { ...p[sellerName], chosen: point } }));
    setDeliveryState(p => ({ ...p, [sellerName]: { ...p[sellerName], pickupPoint: point } }));
  }

  // Compute totals
  const selectedGroups = groups.filter(g => isSelected(g.ownerInstitutionName));
  const itemsTotal = selectedGroups.flatMap(g => g.items).reduce((s, i) => s + (i.price || 0), 0);
  const shippingTotal = selectedGroups.reduce((s, g) => {
    const ds = deliveryState[g.ownerInstitutionName];
    return s + (ds?.price || 0);
  }, 0);
  const grandTotal = itemsTotal + shippingTotal;

  async function handleCheckout() {
    if (!userId) { router.push('/login'); return; }
    if (selectedGroups.length === 0) { showToast('Vælg mindst én sælger', 'error'); return; }

    // Validate delivery choices
    for (const group of selectedGroups) {
      const name = group.ownerInstitutionName;
      const firstSo = shippingOptions[group.items[0]?.listingId];
      const canShip = firstSo?.allow_shipping || (!firstSo && listingsCanShip[group.items[0]?.listingId]);
      if (canShip && !deliveryState[name]?.method) {
        showToast('Vælg leveringsmetode for alle sælgere', 'error'); return;
      }
      if (deliveryState[name]?.method?.startsWith('parcel_shop_') && !pickupState[name]?.chosen) {
        showToast('Vælg et afhentningssted', 'error'); return;
      }
    }

    setSending(true);
    try {
      const senderName = institution?.name || 'Ukendt institution';
      const myInstId = institutionId || null;
      let lastConvId = null;

      for (const group of selectedGroups) {
        const name = group.ownerInstitutionName;
        if (name?.toLowerCase() === senderName?.toLowerCase()) {
          showToast('Du kan ikke købe dine egne opslag', 'error'); continue;
        }
        const groupNote = notes[name]?.trim() || null;
        const ds = deliveryState[name] || {};
        const pp = pickupState[name]?.chosen || null;

        const { data: ownerInst } = await db.from('institutions')
          .select('id,email,name').ilike('name', name).maybeSingle();

        const orFilter = myInstId
          ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${userId}`
          : `initiator_id.eq.${userId}`;
        const firstItem = group.items[0];
        const { data: existing } = await db.from('conversations')
          .select('id,owner_unread').eq('listing_id', firstItem.listingId).or(orFilter).maybeSingle();

        let convId, ownerUnread;
        if (existing) {
          convId = existing.id; ownerUnread = existing.owner_unread || 0;
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
            owner_name: name,
            owner_institution_id: ownerInst?.id || null,
          }).select().single();
          convId = conv?.id; ownerUnread = 0;
          if (conv && ownerInst?.email && ownerInst.email.toLowerCase() !== (institution?.email || '').toLowerCase()) {
            authedFetch('/api/notify-message', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName, listingTitle: firstItem.listingTitle, listingEmoji: firstItem.listingEmoji, convId }),
            }).catch(() => {});
          }
        }
        if (!convId) continue;

        // Map UI method → DB delivery_method
        const dbDeliveryMethod = (ds.method?.startsWith('parcel_shop_') || ds.method?.startsWith('home_')) ? 'shipping' : (ds.method || null);

        const buyData = {
          items: group.items.map(i => ({ listingId: i.listingId, title: i.listingTitle, price: i.price, emoji: i.listingEmoji, category: i.category })),
          totalPrice: group.items.reduce((s, i) => s + (i.price || 0), 0),
          shippingPrice: ds.price || null,
          shippingMethod: ds.method || null,
          pickupPoint: pp ? { id: pp.id, name: pp.name, address: pp.address } : null,
          note: groupNote,
          buyerName: senderName,
          buyerAddress: institution?.address || null,
          buyerZip: institution?.zipcode || null,
          buyerCity: institution?.city || null,
          delivery_method: dbDeliveryMethod,
        };

        const msgText = `Købsforespørgsel: ${group.items.map(i => i.listingTitle).join(', ')} — ${buyData.totalPrice + (ds.price || 0)} kr.`;
        await db.from('chat_messages').insert({
          conversation_id: convId, sender_id: userId, sender_name: senderName,
          content: JSON.stringify(buyData), message_type: 'buy_request',
        });
        await db.from('conversations').update({
          last_message: msgText,
          last_message_at: new Date().toISOString(),
          owner_unread: ownerUnread + 1,
          ...(dbDeliveryMethod ? { delivery_method: dbDeliveryMethod } : {}),
        }).eq('id', convId);

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
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 28, textAlign: 'center' }}>Find køb-opslag og tryk "Læg i kurv" for at samle dine indkøb.</p>
        <button onClick={() => router.push('/opslag')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Se opslag →</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, paddingTop: 84, paddingBottom: 60 }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '0 16px' : '0 32px', display: isMobile ? 'block' : 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>

        {/* ── Left column ── */}
        <div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 24 : 30, color: INK, letterSpacing: '-0.03em', marginBottom: 4 }}>Din indkøbsvogn</h1>
          <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginBottom: 28 }}>
            {cart.length} vare{cart.length !== 1 ? 'r' : ''} fra {groups.length} sælger{groups.length !== 1 ? 'e' : ''}
          </p>

          {groups.map((group) => {
            const name = group.ownerInstitutionName;
            const sel = isSelected(name);
            const firstSo = shippingOptions[group.items[0]?.listingId];
            const canShip = firstSo?.allow_shipping || (!firstSo && listingsCanShip[group.items[0]?.listingId]);
            const canPickup = firstSo?.allow_pickup;
            const canCustom = firstSo?.allow_custom;
            const sizeKey = firstSo?.shipping_size_category || 'medium';
            const quote = quotes[sizeKey];
            const ds = deliveryState[name] || {};
            const ps = pickupState[name] || {};
            const groupItemTotal = group.items.reduce((s, i) => s + (i.price || 0), 0);

            return (
              <div key={name} style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${PAPER3}`, marginBottom: 24, overflow: 'hidden' }}>

                {/* Seller header */}
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${PAPER2}`, display: 'flex', alignItems: 'center', gap: 10, cursor: groups.length > 1 ? 'pointer' : 'default' }} onClick={() => groups.length > 1 && toggleSelected(name)}>
                  {groups.length > 1 && (
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel ? PRIMARY : PAPER3}`, background: sel ? PRIMARY : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                      {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  )}
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, flex: 1 }}>{name}</div>
                  <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PRIMARY }}>{groupItemTotal > 0 ? `${groupItemTotal} kr.` : '—'}</span>
                </div>

                {/* Items */}
                <div style={{ padding: '12px 20px', borderBottom: `1px solid ${PAPER2}` }}>
                  {group.items.map((item, ii) => {
                    const cat = CATEGORIES.find(c => c.key === item.category);
                    return (
                      <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: ii < group.items.length - 1 ? 12 : 0, marginBottom: ii < group.items.length - 1 ? 12 : 0, borderBottom: ii < group.items.length - 1 ? `1px solid ${PAPER2}` : 'none' }}>
                        <div style={{ width: 56, height: 56, borderRadius: 12, background: item.images?.[0] ? '#ddd' : (item.listingColor || GREEN_TINT), overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                          {item.images?.[0] ? <img src={item.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (item.listingEmoji || '🧸')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, lineHeight: 1.3 }}>{item.listingTitle}</div>
                          {cat && <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, marginTop: 2 }}>{cat.emoji} {cat.label}</div>}
                        </div>
                        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: PRIMARY, flexShrink: 0 }}>{item.price ? `${item.price} kr.` : '—'}</span>
                        <button onClick={() => removeFromCart(item.listingId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK3, padding: 4, flexShrink: 0 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Address */}
                {institution && (
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${PAPER2}` }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, marginBottom: 10 }}>Adresse</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${PAPER3}`, background: PAPER2 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <div>
                        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK }}>{institution.name}</div>
                        {(institution.address || institution.city) && (
                          <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 1 }}>
                            {[institution.address, institution.zipcode, institution.city].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Delivery method */}
                {(canShip || canPickup || canCustom) && (
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${PAPER2}` }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, marginBottom: 12 }}>Leveringsmulighed</div>

                    {canPickup && (
                      <RadioRow
                        chosen={ds.method} value="pickup"
                        onChoose={() => setDeliveryMethod(name, 'pickup', 0)}
                        icon="📍" label="Afhentes hos sælger"
                        sublabel={firstSo?.pickup_address || null}
                        price={0}
                      />
                    )}

                    {canShip && (quote?.parcel_shop?.options ?? []).map(opt => (
                      <RadioRow
                        key={opt.product_code}
                        chosen={ds.method} value={`parcel_shop_${opt.carrier_code}`}
                        onChoose={() => {
                          setDeliveryState(p => ({ ...p, [name]: { ...p[name], method: `parcel_shop_${opt.carrier_code}`, price: opt.price_dkk, pickupPoint: null, selectedCarrier: opt.carrier_code } }));
                          loadPickupPoints(name, opt.carrier_code);
                        }}
                        icon="📦" label={opt.label}
                        sublabel="Afhent på pakkeshop nær dig"
                        price={opt.price_dkk}
                        loading={quotesLoading && !quote}
                        priceFixed={true}
                      />
                    ))}

                    {canShip && (quote?.home_delivery?.options ?? []).map(opt => (
                      <RadioRow
                        key={opt.product_code}
                        chosen={ds.method} value={`home_${opt.carrier_code}`}
                        onChoose={() => setDeliveryState(p => ({ ...p, [name]: { ...p[name], method: `home_${opt.carrier_code}`, price: opt.price_dkk, pickupPoint: null } }))}
                        icon="🏠" label={opt.label}
                        sublabel={institution ? [institution.address, institution.zipcode, institution.city].filter(Boolean).join(', ') : 'Leveres til institutionens adresse'}
                        price={opt.price_dkk}
                        loading={quotesLoading && !quote}
                        priceFixed={true}
                      />
                    ))}

                    {canCustom && (
                      <RadioRow
                        chosen={ds.method} value="custom"
                        onChoose={() => setDeliveryMethod(name, 'custom', 0)}
                        icon="🤝" label="Aftales individuelt"
                        sublabel="I aftaler levering direkte i chatten"
                        price={null}
                      />
                    )}
                  </div>
                )}

                {/* Pickup point selector */}
                {ds.method?.startsWith('parcel_shop_') && (
                  <div style={{ padding: '0 20px 16px', borderBottom: `1px solid ${PAPER2}` }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, marginBottom: 10 }}>
                      Leveringsoplysninger
                    </div>
                    {ps.loading ? (
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: PAPER2, fontFamily: FONT, fontSize: 13, color: INK3 }}>Henter pakkeshops…</div>
                    ) : ps.error ? (
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FCA5A5', fontFamily: FONT, fontSize: 12, color: '#DC2626' }}>
                        Kunne ikke hente pakkeshops: {ps.error}
                        <button onClick={() => loadPickupPoints(name)} style={{ marginLeft: 8, fontFamily: FONT, fontSize: 12, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Prøv igen</button>
                      </div>
                    ) : ps.points?.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ps.points.map(pt => (
                          <button key={pt.id} type="button" onClick={() => choosePickupPoint(name, pt)} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
                            border: `1.5px solid ${ps.chosen?.id === pt.id ? PRIMARY : PAPER3}`,
                            background: ps.chosen?.id === pt.id ? GREEN_TINT : '#fff',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                          }}>
                            <span style={{ fontSize: 16 }}>📍</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: ps.chosen?.id === pt.id ? PRIMARY : INK }}>{pt.name}</div>
                              <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, marginTop: 1 }}>{pt.address}</div>
                              {pt.distance_m && <div style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>{pt.distance_m < 1000 ? `${pt.distance_m} m` : `${(pt.distance_m / 1000).toFixed(1)} km`} væk</div>}
                            </div>
                            {ps.chosen?.id === pt.id && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button type="button" onClick={() => loadPickupPoints(name)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1.5px dashed ${PAPER3}`, background: PAPER2, fontFamily: FONT, fontSize: 13, color: INK3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Vælg et afhentningssted
                      </button>
                    )}
                  </div>
                )}

                {/* Note */}
                <div style={{ padding: '14px 20px' }}>
                  <textarea
                    value={notes[name] || ''}
                    onChange={e => setNotes(p => ({ ...p, [name]: e.target.value }))}
                    placeholder={`Besked til ${name} (valgfri)`}
                    rows={2}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, fontFamily: FONT, fontSize: 13, resize: 'none', outline: 'none', background: PAPER2, boxSizing: 'border-box', color: INK2, lineHeight: 1.5 }}
                    onFocus={e => { e.target.style.borderColor = PRIMARY; }}
                    onBlur={e => { e.target.style.borderColor = PAPER3; }}
                  />
                </div>
              </div>
            );
          })}

          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontFamily: FONT, fontWeight: 600, fontSize: 14, color: INK3, cursor: 'pointer', padding: '4px 0' }}>
            ← Fortsæt med at handle
          </button>
        </div>

        {/* ── Right column: Price overview ── */}
        <div style={{ position: isMobile ? 'static' : 'sticky', top: 100 }}>
          <div style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${PAPER3}`, padding: '24px', marginTop: isMobile ? 24 : 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: INK, marginBottom: 20 }}>Prisoversigt</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: FONT, fontSize: 14, color: INK2 }}>Ordre</span>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: INK }}>{itemsTotal.toFixed(2).replace('.', ',')} kr.</span>
              </div>

              {selectedGroups.map(g => {
                const ds = deliveryState[g.ownerInstitutionName] || {};
                if (!ds.method || ds.price == null) return null;
                const label = ds.method?.startsWith('parcel_shop_') ? 'Pakkeshop' : ds.method?.startsWith('home_') ? 'Hjemlevering' : 'Afhentning';
                return (
                  <div key={g.ownerInstitutionName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: FONT, fontSize: 14, color: INK2 }}>Levering ({label})</span>
                    <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: ds.price > 0 ? INK : '#16a34a' }}>
                      {ds.price > 0 ? `${ds.price.toFixed(2).replace('.', ',')} kr.` : 'Gratis'}
                    </span>
                  </div>
                );
              })}

              {selectedGroups.some(g => !deliveryState[g.ownerInstitutionName]?.method) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT, fontSize: 14, color: INK3 }}>Levering</span>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK3 }}>Vælg metode</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${PAPER2}`, paddingTop: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: INK }}>Samlet beløb</span>
                <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PRIMARY }}>{grandTotal.toFixed(2).replace('.', ',')} kr.</span>
              </div>
              {shippingTotal === 0 && selectedGroups.some(g => {
                const ds = deliveryState[g.ownerInstitutionName];
                return !ds?.method;
              }) && (
                <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, marginTop: 4 }}>Ekskl. levering</div>
              )}
            </div>

            <button onClick={handleCheckout} disabled={sending || selectedGroups.length === 0} style={{
              width: '100%', padding: '15px', borderRadius: 99,
              background: (sending || selectedGroups.length === 0) ? PAPER3 : PRIMARY,
              color: (sending || selectedGroups.length === 0) ? INK3 : '#fff',
              border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 15,
              cursor: (sending || selectedGroups.length === 0) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginBottom: 10,
            }}>
              {sending ? 'Sender…' : `Send forespørgsel →`}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>Dine oplysninger er krypterede og sikre</span>
            </div>
          </div>

          {groups.length > 1 && (
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: GREEN_TINT, border: `1px solid ${GREEN_SOFT}` }}>
              <p style={{ fontFamily: FONT, fontSize: 12, color: INK3, margin: 0 }}>
                Ikke-valgte sælgere forbliver i kurven til næste gang.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
