'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { authedFetch } from '@/lib/authed-fetch';
import PickupPointPicker from '@/components/PickupPointPicker';
import { PRIMARY, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';

const kr = n => `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;
const SIZE_RANK = { small: 1, medium: 2, large: 3, xlarge: 4 };

export default function SwapPaymentPage() {
  const { proposalId } = useParams();
  const router = useRouter();
  const { showToast } = useApp();
  const { institutionId, institution } = useActiveUser();

  const [proposal, setProposal] = useState(null);
  const [receiver, setReceiver] = useState(null);
  const [sizeCategory, setSizeCategory] = useState('medium');
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState(null); // 'parcel_shop' | 'custom'
  const [pickupPoint, setPickupPoint] = useState(null);
  const [paying, setPaying] = useState(false);

  // Pickup-vælger
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerData, setPickerData] = useState({ loading: false, points: [], cheapest_carrier: null, buyer_coords: null });

  // Hvilken part er jeg, og hvad sender jeg?
  const party = useMemo(() => {
    if (!proposal || !institutionId) return null;
    if (proposal.initiator_institution_id === institutionId) return 'initiator';
    if (proposal.owner_institution_id === institutionId) return 'owner';
    return null;
  }, [proposal, institutionId]);

  const outgoing = useMemo(() => {
    if (!proposal || !party) return [];
    return party === 'initiator' ? (proposal.offered_items || []) : (proposal.requested_items || []);
  }, [proposal, party]);

  const receiverInstId = party && proposal
    ? (party === 'initiator' ? proposal.owner_institution_id : proposal.initiator_institution_id)
    : null;

  const alreadyPaid = proposal && party && (party === 'owner' ? proposal.owner_paid : proposal.initiator_paid);
  const cash = proposal && party && proposal.cash_payer === party ? (Number(proposal.cash_adjustment) || 0) : 0;
  const protection = Number(proposal?.protection_fee) || 10;
  const porto = method === 'parcel_shop' ? (Number(pickupPoint?.price) || 0) : 0;
  const total = Math.round((porto + protection + cash) * 100) / 100;

  // Indlæs forslag + modtager + bundt-størrelse
  useEffect(() => {
    if (!proposalId) return;
    let cancelled = false;
    (async () => {
      const { data: p } = await db.from('swap_proposals').select('*').eq('id', proposalId).maybeSingle();
      if (cancelled) return;
      setProposal(p || null);
      if (p) {
        const myParty = p.initiator_institution_id === institutionId ? 'initiator'
          : p.owner_institution_id === institutionId ? 'owner' : null;
        const recvId = myParty === 'initiator' ? p.owner_institution_id : p.initiator_institution_id;
        const out = myParty === 'initiator' ? (p.offered_items || []) : (p.requested_items || []);
        const outIds = out.map(i => i.listing_id).filter(Boolean);
        const [{ data: recv }, { data: so }] = await Promise.all([
          recvId ? db.from('institutions').select('name, address, zipcode, city').eq('id', recvId).maybeSingle() : Promise.resolve({ data: null }),
          outIds.length ? db.from('shipping_options').select('shipping_size_category').in('listing_id', outIds) : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        setReceiver(recv || null);
        let best = 'medium', rank = 0;
        for (const s of (so || [])) { const r = SIZE_RANK[s.shipping_size_category] || 2; if (r > rank) { rank = r; best = s.shipping_size_category; } }
        setSizeCategory(best);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [proposalId, institutionId]);

  async function openPicker() {
    setMethod('parcel_shop');
    setPickerOpen(true);
    if (pickerData.points.length) return;
    setPickerData(d => ({ ...d, loading: true }));
    try {
      const res = await authedFetch('/api/shipping/pickup-points-all', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip: receiver?.zipcode || '2100',
          sizeCategory,
          sellerName: institution?.name,          // afsender = mig
          buyerInstitutionId: receiverInstId,     // modtager = modparten
        }),
      });
      const json = await res.json();
      setPickerData({ loading: false, points: json.points || [], cheapest_carrier: json.cheapest_carrier, buyer_coords: json.buyer_coords });
    } catch {
      setPickerData({ loading: false, points: [], cheapest_carrier: null, buyer_coords: null });
    }
  }

  async function pay() {
    if (!method) { showToast?.('Vælg en leveringsmulighed', 'error'); return; }
    if (method === 'parcel_shop' && !pickupPoint) { showToast?.('Vælg et udleveringssted', 'error'); return; }
    setPaying(true);
    try {
      const res = await authedFetch('/api/payments/create-swap-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          deliveryMethod: method === 'custom' ? 'custom' : 'shipping',
          pickupPointId: pickupPoint?.id || null,
          pickupPoint: pickupPoint || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast?.(data.error || 'Noget gik galt. Prøv igen.', 'error'); setPaying(false); return; }
      const bd = encodeURIComponent(JSON.stringify(data.breakdown));
      router.push(`/betaling/${data.orderId}?cs=${encodeURIComponent(data.clientSecret)}&total=${data.grandTotal}&bd=${bd}`);
    } catch { showToast?.('Noget gik galt. Prøv igen.', 'error'); setPaying(false); }
  }

  if (loading) return <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 100, paddingLeft: 24, paddingRight: 24, fontFamily: FONT, color: INK3 }}>Henter byttehandel…</div>;
  if (!proposal || !party) return <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 100, paddingLeft: 24, paddingRight: 24, fontFamily: FONT, color: INK }}>Byttehandlen blev ikke fundet, eller du er ikke en del af den. <button onClick={() => router.push('/beskeder')} style={linkBtn}>← Til beskeder</button></div>;
  if (alreadyPaid) return <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 100, paddingLeft: 24, paddingRight: 24, fontFamily: FONT, color: INK }}>✓ Du har allerede betalt din del af denne byttehandel. <button onClick={() => router.push('/beskeder')} style={linkBtn}>← Til beskeder</button></div>;

  const methodCard = (m, label, sub, price, onClick) => {
    const active = method === m;
    return (
      <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: `2px solid ${active ? PRIMARY : PAPER3}`, background: active ? GREEN_TINT : '#fff', cursor: 'pointer', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK }}>{label}</div>
          {sub && <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: price === 0 ? PRIMARY : INK }}>{price === 0 ? 'Gratis' : price != null ? kr(price) : ''}</div>
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 100, paddingLeft: 16, paddingRight: 16, paddingBottom: 60, fontFamily: FONT }}>
      <button onClick={() => router.push('/beskeder')} style={linkBtn}>← Tilbage til beskeder</button>
      <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: INK, margin: '8px 0 4px' }}>Betal din del af byttet</h1>
      <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginTop: 0 }}>Du sender dine varer til {receiver?.name || 'modparten'}. Vælg leveringsmetode herunder.</p>

      {/* Dine udgående varer */}
      <div style={{ background: PAPER, border: `1px solid ${PAPER2}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK2, marginBottom: 10 }}>Dine varer ({outgoing.length})</div>
        {outgoing.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ fontSize: 18 }}>{it.emoji || '🧸'}</span>
            <span style={{ fontFamily: FONT, fontSize: 14, color: INK }}>{it.title}</span>
          </div>
        ))}
      </div>

      {/* Leveringsvalg */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK2, marginBottom: 10 }}>Leveringsmulighed</div>
        {methodCard('parcel_shop',
          pickupPoint ? `📦 ${pickupPoint.name}` : '📦 Pakkeshop',
          pickupPoint ? pickupPoint.address : 'Vælg afhentningssted nær modparten',
          method === 'parcel_shop' ? (pickupPoint?.price ?? null) : null,
          openPicker)}
        {methodCard('custom', '🤝 Aftalt levering', 'I aftaler selv afhentning eller levering (ingen pakkemærkat)', 0,
          () => { setMethod('custom'); setPickupPoint(null); })}
      </div>

      {/* Prisoversigt */}
      <div style={{ background: '#fff', border: `1px solid ${PAPER2}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: INK2, marginBottom: 10 }}>Din andel</div>
        <Row label="Levering" value={method === 'custom' ? 'Gratis' : (pickupPoint ? kr(porto) : 'Vælg metode')} />
        <Row label="Bytogleg beskyttelse" value={kr(protection)} />
        {cash > 0 && <Row label="Kontant mellemlag" value={kr(cash)} />}
        <div style={{ borderTop: `1px solid ${PAPER2}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: INK }}>I alt</span>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PRIMARY }}>{kr(total)}</span>
        </div>
      </div>

      <button onClick={pay} disabled={paying || !method || (method === 'parcel_shop' && !pickupPoint)}
        style={{ width: '100%', padding: '15px', borderRadius: 14, background: PRIMARY, border: 'none', color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 16, cursor: (paying || !method || (method === 'parcel_shop' && !pickupPoint)) ? 'default' : 'pointer', opacity: (paying || !method || (method === 'parcel_shop' && !pickupPoint)) ? 0.55 : 1 }}>
        {paying ? 'Et øjeblik…' : `Betal ${kr(total)} →`}
      </button>

      {pickerOpen && (
        <PickupPointPicker
          points={pickerData.points}
          cheapestCarrier={pickerData.cheapest_carrier}
          buyerCoords={pickerData.buyer_coords}
          addressLabel={receiver?.name}
          onConfirm={(pt) => {
            if (pt) { setPickupPoint({ id: pt.id, name: pt.name, address: pt.address, carrier_code: pt.carrier_code, price: pt.price }); setMethod('parcel_shop'); }
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
      <span style={{ fontFamily: FONT, fontSize: 13, color: INK3 }}>{label}</span>
      <span style={{ fontFamily: FONT, fontSize: 13, color: INK2 }}>{value}</span>
    </div>
  );
}

const linkBtn = { background: 'none', border: 'none', color: PRIMARY, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 };
