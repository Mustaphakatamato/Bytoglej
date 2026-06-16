'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, GREEN_DEEP, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { CATEGORIES } from '@/lib/categories';
import { authedFetch } from '@/lib/authed-fetch';
import CarrierLogo from '@/components/CarrierLogo';
import PickupPointPicker from '@/components/PickupPointPicker';

// ── Helpers ────────────────────────────────────────────────────

// Dansk kr-format: komma + to decimaler
function fmtKr(n) {
  return `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;
}

// Vælg den billigste carrier blandt options for en given type (prefix 'parcel_shop' | 'home').
// Bruger live-priser når de er hentet, ellers tabel-estimatet.
// Når live-priser er hentet springes carriers der fejlede (null/0) over — fx en carrier
// der ikke er aktiveret på Shipmondo-kontoen — så de ikke vælges på et forkert estimat.
function cheapestOption(options, livePricesForName, prefix) {
  if (!options?.length) return null;
  const haveLive = livePricesForName && Object.keys(livePricesForName).length > 0;
  let best = null, bestPrice = Infinity;
  for (const opt of options) {
    const method = `${prefix}_${opt.carrier_code}`;
    const live = livePricesForName?.[method];
    if (haveLive && (live == null || live <= 0)) continue; // carrier utilgængelig live
    const price = live ?? opt.price_dkk;
    if (price != null && price < bestPrice) { bestPrice = price; best = opt; }
  }
  // Hvis alle live-priser fejlede, fald tilbage til billigste estimat.
  if (!best) best = options[0];
  return best;
}

function RadioRow({ chosen, value, onChoose, icon, label, sublabel, price, estimate, loading, isFree, carrierBadge }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: active ? PRIMARY : INK }}>{label}</span>
          {carrierBadge}
        </div>
        {sublabel && <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2 }}>{sublabel}</div>}
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        {isFree
          ? <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: active ? PRIMARY : INK2 }}>Gratis</span>
          : loading
            ? <span style={{ fontSize: 12, color: INK3, fontFamily: FONT, animation: 'ltbPulse 1.1s ease-in-out infinite', whiteSpace: 'nowrap' }}>Henter priser…</span>
            : price != null
              ? <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: active ? PRIMARY : INK2, whiteSpace: 'nowrap' }}>{fmtKr(price)}</span>
              : estimate != null
                ? <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: active ? PRIMARY : INK2, whiteSpace: 'nowrap' }}>Ca. {fmtKr(estimate)}</span>
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
  const [showFeeInfo, setShowFeeInfo] = useState(false);

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
  const [sellerDiscounts, setSellerDiscounts] = useState({});

  // Quote data: sizeCategory → { parcel_shop: { min_price }, home_delivery: { min_price } }
  const [quotes, setQuotes] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Live Shipmondo-priser pr. gruppe+metode: { [sellerName]: { [method]: price_dkk } }
  // Hentes ved indlæsning så kurven viser samme pris som checkout opkræver.
  const [livePrices, setLivePrices] = useState({});
  const [livePricesLoading, setLivePricesLoading] = useState({}); // { [sellerName]: bool }
  const [sellerInfo, setSellerInfo] = useState({}); // { [name]: { address, zipcode, city } } til afhentnings-adresse

  // Pickup points: sellerName → { loading, points, chosen }
  const [pickupState, setPickupState] = useState({});
  // Vinted-lignende kort-vælger: hvilken sælger er åben + cachede punkter på tværs af carriers
  const [pickerFor, setPickerFor] = useState(null);
  const [pickerData, setPickerData] = useState({}); // { [sellerName]: { loading, points, cheapest_carrier, error } }

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
      const soSizes = (soData || []).map(s => s.allow_shipping ? (s.shipping_size_category || 'medium') : null).filter(Boolean);
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

  // Hent live Shipmondo-priser for alle leveringsmuligheder så snart estimat-quotes er klar,
  // så kurven viser den eksakte pris (samme som checkout) uden brugeren skal vælge først.
  useEffect(() => {
    if (!institutionId || !groups.length || quotesLoading || !Object.keys(quotes).length) return;
    groups.forEach(group => {
      const name = group.ownerInstitutionName;
      const firstLid = group.items?.[0]?.listingId;
      const size = shippingOptions[firstLid]?.shipping_size_category || 'medium';
      const q = quotes[size];
      if (!q) return;
      const methods = [
        ...(q.parcel_shop?.options || []).map(o => `parcel_shop_${o.carrier_code}`),
        ...(q.home_delivery?.options || []).map(o => `home_${o.carrier_code}`),
      ];
      if (!methods.length) return;
      setLivePricesLoading(p => ({ ...p, [name]: true }));
      authedFetch('/api/shipping/live-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerName: name, buyerInstitutionId: institutionId, sizeCategory: size, methods }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(json => { if (json?.prices) setLivePrices(p => ({ ...p, [name]: { ...p[name], ...json.prices } })); })
        .catch(() => {})
        .finally(() => setLivePricesLoading(p => ({ ...p, [name]: false })));
    });
  }, [groups, quotes, quotesLoading, shippingOptions, institutionId]);

  // Hent sælgeres adresser og bundle-rabat-indstillinger
  useEffect(() => {
    const names = [...new Set(groups.map(g => g.ownerInstitutionName).filter(Boolean))];
    if (!names.length) return;
    db.from('institutions')
      .select('name, address, zipcode, city, bundle_discount_enabled, bundle_discount_tiers')
      .in('name', names)
      .then(({ data }) => {
        const addrMap = {};
        const discMap = {};
        for (const i of (data || [])) {
          addrMap[i.name] = i;
          discMap[i.name] = { enabled: i.bundle_discount_enabled, tiers: i.bundle_discount_tiers };
        }
        setSellerInfo(addrMap);
        setSellerDiscounts(discMap);
      });
  }, [groups]);

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
    const method = deliveryState[sellerName]?.method;
    if (method) fetchLivePrice(sellerName, method, point.id);
  }

  // Åbner kort-vælgeren og henter udleveringssteder fra alle carriers (cachet pr. sælger).
  async function openPickupPicker(sellerName) {
    setPickerFor(sellerName);
    if (pickerData[sellerName]?.points?.length) return;
    setPickerData(p => ({ ...p, [sellerName]: { loading: true, points: [] } }));
    const group = groups.find(g => g.ownerInstitutionName === sellerName);
    const firstLid = group?.items?.[0]?.listingId;
    const size = shippingOptions[firstLid]?.shipping_size_category || 'medium';
    const zip = institution?.zipcode || institution?.zip_code || '2100';
    try {
      const res = await authedFetch('/api/shipping/pickup-points-all', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip, sizeCategory: size, sellerName, buyerInstitutionId: institutionId }),
      });
      const json = await res.json();
      setPickerData(p => ({ ...p, [sellerName]: { loading: false, points: json.points || [], cheapest_carrier: json.cheapest_carrier, buyer_coords: json.buyer_coords } }));
    } catch {
      setPickerData(p => ({ ...p, [sellerName]: { loading: false, points: [], error: true } }));
    }
  }

  // Kaldes når køber bekræfter et udleveringssted i kort-vælgeren — sætter carrier + pris + punkt.
  function confirmPickupPoint(sellerName, point) {
    const method = `parcel_shop_${point.carrier_code}`;
    const chosen = { id: point.id, name: point.name, address: point.address, carrier_code: point.carrier_code };
    setDeliveryState(p => ({ ...p, [sellerName]: { ...p[sellerName], method, price: point.price, pickupPoint: chosen, selectedCarrier: point.carrier_code } }));
    setPickupState(p => ({ ...p, [sellerName]: { ...p[sellerName], chosen } }));
    setPickerFor(null);
  }

  // Henter den eksakte Shipmondo-pris så kurven matcher det checkout opkræver.
  // Opdaterer ds.price; falder stille tilbage til estimatet hvis kaldet fejler.
  async function fetchLivePrice(sellerName, method, servicePointId) {
    const group = groups.find(g => g.ownerInstitutionName === sellerName);
    const firstLid = group?.items?.[0]?.listingId;
    const size = shippingOptions[firstLid]?.shipping_size_category || 'medium';
    setDeliveryState(p => ({ ...p, [sellerName]: { ...p[sellerName], priceLoading: true } }));
    try {
      const res = await authedFetch('/api/shipping/live-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerName, buyerInstitutionId: institutionId, sizeCategory: size, methods: [method], servicePointId }),
      });
      const json = await res.json();
      const livePrice = json?.prices?.[method];
      if (livePrice != null) setLivePrices(p => ({ ...p, [sellerName]: { ...p[sellerName], [method]: livePrice } }));
      setDeliveryState(p => ({
        ...p,
        [sellerName]: {
          ...p[sellerName],
          priceLoading: false,
          ...(livePrice != null ? { price: livePrice } : {}),
        },
      }));
    } catch {
      setDeliveryState(p => ({ ...p, [sellerName]: { ...p[sellerName], priceLoading: false } }));
    }
  }

  // Compute totals
  const selectedGroups = groups.filter(g => isSelected(g.ownerInstitutionName));
  const itemsTotal = selectedGroups.flatMap(g => g.items).reduce((s, i) => s + (i.price || 0), 0);
  const shippingTotal = selectedGroups.reduce((s, g) => {
    const ds = deliveryState[g.ownerInstitutionName];
    return s + (ds?.price || 0);
  }, 0);

  function calcServiceFee(itemTotal) {
    return Math.round((itemTotal * 0.05 + 5) * 100) / 100;
  }

  function calcBundleDiscount(itemTotal, itemCount, discSettings) {
    if (!discSettings?.enabled || !discSettings?.tiers?.length) return 0;
    const sorted = [...discSettings.tiers].sort((a, b) => b.min_items - a.min_items);
    const tier = sorted.find(t => itemCount >= t.min_items);
    if (!tier) return 0;
    return Math.round(itemTotal * (tier.percent / 100) * 100) / 100;
  }

  function getGroupDiscount(g) {
    const groupItemTotal = g.items.reduce((x, i) => x + (i.price || 0), 0);
    return calcBundleDiscount(groupItemTotal, g.items.length, sellerDiscounts[g.ownerInstitutionName]);
  }

  const discountTotal = selectedGroups.reduce((s, g) => s + getGroupDiscount(g), 0);

  const serviceFeeTotal = selectedGroups.reduce((s, g) => {
    const groupItemTotal = g.items.reduce((x, i) => x + (i.price || 0), 0);
    const discount = getGroupDiscount(g);
    return s + calcServiceFee(groupItemTotal - discount);
  }, 0);

  const grandTotal = itemsTotal - discountTotal + shippingTotal + serviceFeeTotal;

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

      // Check buyer isn't buying their own items
      for (const group of selectedGroups) {
        if (group.ownerInstitutionName?.toLowerCase() === senderName?.toLowerCase()) {
          showToast('Du kan ikke købe dine egne opslag', 'error');
          setSending(false);
          return;
        }
      }

      // Build groups payload for payment intent
      const groupsPayload = selectedGroups.map(group => {
        const name = group.ownerInstitutionName;
        const ds = deliveryState[name] || {};
        const pp = pickupState[name]?.chosen || null;
        return {
          sellerName: name,
          sellerId: group.ownerId,
          sellerInstitutionId: null,
          items: group.items.map(i => ({
            listingId: i.listingId,
            title: i.listingTitle,
            price: i.price,
            emoji: i.listingEmoji,
            category: i.category,
          })),
          shippingMethod: ds.method || null,
          shippingPrice: ds.price || 0,
          pickupPoint: pp ? { id: pp.id, name: pp.name, address: pp.address } : null,
          note: notes[name]?.trim() || null,
        };
      });

      const res = await authedFetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: groupsPayload, buyerInstitutionId: institutionId }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Kunne ikke oprette betaling', 'error');
        setSending(false);
        return;
      }

      // Ryd IKKE kurven her — gem de valgte vare-IDs i sessionStorage.
      // Kurven ryddes først på success-siden når redirect_status=succeeded,
      // så varerne ikke forsvinder hvis betalingen fejler eller browseren lukkes.
      try {
        const pendingIds = selectedGroups.flatMap(g => g.items.map(i => i.listingId)).filter(Boolean);
        sessionStorage.setItem('pending_cart_ids', JSON.stringify(pendingIds));
      } catch { /* sessionStorage utilgængelig — kurven beholdes blot */ }

      // Redirect to payment page with client secret
      const params = new URLSearchParams({
        cs: data.clientSecret,
        total: String(data.grandTotal),
        bd: encodeURIComponent(JSON.stringify(data.breakdown)),
      });
      router.push(`/betaling/${data.orderId}?${params}`);
    } catch (e) {
      console.error(e);
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
    <>
    <style>{`@keyframes ltbPulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }`}</style>
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
            // Afhentning er altid en mulighed med mindre sælger eksplicit har slået den fra.
            const canPickup = firstSo ? firstSo.allow_pickup !== false : true;
            const sizeKey = firstSo?.shipping_size_category || 'medium';
            const quote = quotes[sizeKey];
            const ds = deliveryState[name] || {};
            const ps = pickupState[name] || {};
            const groupItemTotal = group.items.reduce((s, i) => s + (i.price || 0), 0);
            const groupDiscount = getGroupDiscount(group);
            const discSettings = sellerDiscounts[name];

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
                  {groupDiscount > 0 && (
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: '#16a34a', background: '#dcfce7', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>
                      -{discSettings?.tiers ? [...discSettings.tiers].sort((a,b)=>b.min_items-a.min_items).find(t=>group.items.length>=t.min_items)?.percent : 0}% rabat
                    </span>
                  )}
                  <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: groupDiscount > 0 ? '#16a34a' : PRIMARY }}>
                    {groupItemTotal > 0 ? `${(groupItemTotal - groupDiscount).toFixed(0)} kr.` : '—'}
                    {groupDiscount > 0 && <span style={{ textDecoration: 'line-through', color: INK3, fontSize: 12, marginLeft: 4 }}>{groupItemTotal} kr.</span>}
                  </span>
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

                {/* Bundle discount hint */}
                {discSettings?.enabled && discSettings?.tiers?.length > 0 && groupDiscount === 0 && (() => {
                  const sorted = [...discSettings.tiers].sort((a, b) => a.min_items - b.min_items);
                  const nextTier = sorted.find(t => t.min_items > group.items.length);
                  if (!nextTier) return null;
                  const needed = nextTier.min_items - group.items.length;
                  return (
                    <div style={{ padding: '10px 20px', background: '#f0fdf4', borderBottom: `1px solid ${PAPER2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>🎉</span>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: '#15803d' }}>
                        Tilføj {needed} vare{needed !== 1 ? 'r' : ''} mere fra {name} og få {nextTier.percent}% bundlerabat!
                      </span>
                    </div>
                  );
                })()}

                {discSettings?.enabled && groupDiscount > 0 && (
                  <div style={{ padding: '10px 20px', background: '#f0fdf4', borderBottom: `1px solid ${PAPER2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>✅</span>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: '#15803d', fontWeight: 700 }}>
                      Bundlerabat på {[...discSettings.tiers].sort((a,b)=>b.min_items-a.min_items).find(t=>group.items.length>=t.min_items)?.percent}% anvendt — du sparer {groupDiscount.toFixed(2).replace('.', ',')} kr.!
                    </span>
                  </div>
                )}

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

                {/* Delivery method — afhentning er altid en mulighed */}
                {(
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${PAPER2}` }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, marginBottom: 4 }}>Leveringsmulighed</div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>ℹ️</span><span>Porto beregnes ud fra pakkens størrelse og vægt</span>
                    </div>

                    {canPickup && (
                      <RadioRow
                        chosen={ds.method} value="pickup"
                        onChoose={() => setDeliveryMethod(name, 'pickup', 0)}
                        icon="📍" label={`Jeg henter selv hos ${name}`}
                        sublabel={
                          [sellerInfo[name]?.address, sellerInfo[name]?.zipcode, sellerInfo[name]?.city].filter(Boolean).join(', ')
                          || firstSo?.pickup_address
                          || 'I aftaler tid og sted direkte i beskeder'
                        }
                        isFree
                      />
                    )}

                    {canShip && (() => {
                      // Køber får automatisk den billigste carrier — intet carrier-valg.
                      const cheapestParcel = cheapestOption(quote?.parcel_shop?.options, livePrices[name], 'parcel_shop');
                      const cheapestHome   = cheapestOption(quote?.home_delivery?.options, livePrices[name], 'home');
                      const loadingPrice = (n, m) => (livePricesLoading[n] || (quotesLoading && !quote)) && livePrices[n]?.[m] == null;
                      return (
                        <>
                          {cheapestParcel && (() => {
                            const isParcel = ds.method?.startsWith('parcel_shop_');
                            const shownCarrier = ds.selectedCarrier || cheapestParcel.carrier_code;
                            const cheapestLp = livePrices[name]?.[`parcel_shop_${cheapestParcel.carrier_code}`];
                            return (
                              <RadioRow
                                chosen={isParcel ? ds.method : null} value={`parcel_shop_${shownCarrier}`}
                                onChoose={() => openPickupPicker(name)}
                                icon="📦" label="Pakkeshop"
                                carrierBadge={<CarrierLogo carrier={shownCarrier} />}
                                sublabel={ds.pickupPoint ? `📍 ${ds.pickupPoint.name}` : 'Vælg afhentningssted nær dig'}
                                price={isParcel ? ds.price : cheapestLp}
                                estimate={cheapestParcel.price_dkk}
                                loading={loadingPrice(name, `parcel_shop_${cheapestParcel.carrier_code}`)}
                              />
                            );
                          })()}

                          {cheapestHome && (() => {
                            const method = `home_${cheapestHome.carrier_code}`;
                            const lp = livePrices[name]?.[method];
                            return (
                              <RadioRow
                                chosen={ds.method} value={method}
                                onChoose={() => {
                                  setDeliveryState(p => ({ ...p, [name]: { ...p[name], method, price: lp ?? cheapestHome.price_dkk, pickupPoint: null } }));
                                  if (lp == null) fetchLivePrice(name, method, null);
                                }}
                                icon="🏠" label="Hjemlevering"
                                carrierBadge={<CarrierLogo carrier={cheapestHome.carrier_code} />}
                                sublabel={institution ? [institution.address, institution.zipcode, institution.city].filter(Boolean).join(', ') : 'Leveres til institutionens adresse'}
                                price={lp}
                                estimate={cheapestHome.price_dkk}
                                loading={loadingPrice(name, method)}
                              />
                            );
                          })()}
                        </>
                      );
                    })()}

                  </div>
                )}

                {/* Valgt afhentningssted (vælges i kort-modalen) */}
                {ds.method?.startsWith('parcel_shop_') && (
                  <div style={{ padding: '0 20px 16px', borderBottom: `1px solid ${PAPER2}` }}>
                    {ds.pickupPoint ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${PRIMARY}`, background: GREEN_TINT }}>
                        <span style={{ fontSize: 16 }}>📍</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PRIMARY }}>{ds.pickupPoint.name}</div>
                          <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, marginTop: 1 }}>{ds.pickupPoint.address}</div>
                        </div>
                        <button type="button" onClick={() => openPickupPicker(name)} style={{ flexShrink: 0, fontFamily: FONT, fontSize: 12, fontWeight: 700, color: PRIMARY, background: '#fff', border: `1.5px solid ${PRIMARY}`, borderRadius: 99, padding: '6px 14px', cursor: 'pointer' }}>Skift</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => openPickupPicker(name)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1.5px dashed ${PAPER3}`, background: PAPER2, fontFamily: FONT, fontSize: 13, fontWeight: 600, color: PRIMARY, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
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

              {discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT, fontSize: 14, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>
                    🎉 Bundlerabat
                  </span>
                  <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: '#16a34a' }}>
                    -{discountTotal.toFixed(2).replace('.', ',')} kr.
                  </span>
                </div>
              )}

              {selectedGroups.map(g => {
                const ds = deliveryState[g.ownerInstitutionName] || {};
                if (!ds.method || ds.price == null) return null;
                const isShip = ds.method?.startsWith('parcel_shop_') || ds.method?.startsWith('home_');
                const label = ds.method?.startsWith('parcel_shop_') ? 'Pakkeshop' : ds.method?.startsWith('home_') ? 'Hjemlevering' : 'Afhentning';
                const carrierCode = isShip ? ds.method.replace('parcel_shop_', '').replace('home_', '') : null;
                return (
                  <div key={g.ownerInstitutionName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FONT, fontSize: 14, color: INK2, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      Levering ({label}) {carrierCode && <CarrierLogo carrier={carrierCode} />}
                    </span>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={() => setShowFeeInfo(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: 14, color: INK2 }}>Gebyr for Køberbeskyttelse</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </button>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: INK }}>{serviceFeeTotal.toFixed(2).replace('.', ',')} kr.</span>
              </div>
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
              {sending ? 'Opretter betaling…' : `Betal ${grandTotal.toFixed(2).replace('.', ',')} kr. →`}
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

    {/* Køberbeskyttelse info-modal */}
    {showFeeInfo && (
      <div onClick={() => setShowFeeInfo(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0 0' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '28px 24px 36px', width: '100%', maxWidth: 520, boxShadow: '0 -4px 40px rgba(0,0,0,0.12)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: PAPER3, margin: '0 auto 24px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: GREEN_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🛡️</div>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: INK, letterSpacing: '-0.02em' }}>Bytogleg Køberbeskyttelse</div>
              <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginTop: 2 }}>Gebyr: {serviceFeeTotal.toFixed(2).replace('.', ',')} kr.</div>
            </div>
          </div>

          <p style={{ fontFamily: FONT, fontSize: 14, color: INK2, lineHeight: 1.65, marginBottom: 20 }}>
            Bytogleg Køberbeskyttelse dækker dig i tilfælde, hvor tingene ikke går som forventet. Gebyret bidrager til at sikre en tryg handel for alle.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            {[
              { icon: '📦', title: 'Varen ankommer ikke', text: 'Modtager du ikke varen inden for den forventede leveringstid, refunderer vi hele beløbet.' },
              { icon: '🔍', title: 'Varen matcher ikke beskrivelsen', text: 'Er varen i væsentligt ringere stand end beskrevet, hjælper vi dig med at få pengene tilbage.' },
              { icon: '🔒', title: 'Sikker betaling', text: 'Dine betalingsoplysninger håndteres af Stripe og deles aldrig med sælger.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: PAPER2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, lineHeight: 1.5 }}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setShowFeeInfo(false)} style={{ width: '100%', padding: '14px', borderRadius: 99, background: PRIMARY, color: '#fff', border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Forstået
          </button>
        </div>
      </div>
    )}

    {/* Kort-vælger til afhentningssted (alle carriers) */}
    {pickerFor && (
      pickerData[pickerFor]?.loading
        ? <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px 32px', fontFamily: FONT, fontSize: 14, color: INK3 }}>Henter afhentningssteder…</div>
          </div>
        : <PickupPointPicker
            points={pickerData[pickerFor]?.points || []}
            cheapestCarrier={pickerData[pickerFor]?.cheapest_carrier}
            buyerCoords={pickerData[pickerFor]?.buyer_coords || null}
            addressLabel={[institution?.address, [institution?.zipcode, institution?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null}
            onConfirm={(pt) => confirmPickupPoint(pickerFor, pt)}
            onClose={() => setPickerFor(null)}
          />
    )}
    </>
  );
}
