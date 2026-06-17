'use client';
import { useState, useEffect } from 'react';
import { Modal, Btn, Spinner } from '@/components/ui';
import { PRIMARY, INK, INK2, INK3, GREEN_TINT, GREEN_SOFT, PAPER2, PAPER3, CORAL, FONT } from '@/lib/constants';
import { db } from '@/lib/supabase';
import { authedFetch } from '@/lib/authed-fetch';

const kr = n => `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;

// Bundt-for-bundt bytteforslag: vælg egne varer at tilbyde + modpartens
// varer du vil have + valgfrit kontant mellemlag.
export default function SwapProposalModal({ open, onClose, listing, ownListings = [], showToast, onSubmitted }) {
  const [offeredIds, setOfferedIds] = useState([]);
  const [extraRequestedIds, setExtraRequestedIds] = useState([]);
  const [ownerListings, setOwnerListings] = useState([]);
  const [cash, setCash] = useState('');
  const [cashPayer, setCashPayer] = useState('initiator');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !listing) return;
    setOfferedIds([]); setExtraRequestedIds([]); setCash(''); setCashPayer('initiator');
    // Hent modpartens øvrige aktive varer (ud over den primære).
    db.from('listings')
      .select('id, title, price, emoji, color, images')
      .eq('institution_name', listing.institution_name)
      .eq('is_active', true).eq('is_sold', false)
      .then(({ data }) => setOwnerListings((data || []).filter(l => l.id !== listing.id)));
  }, [open, listing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const offered = ownListings.filter(l => offeredIds.includes(l.id));
  const requested = [listing, ...ownerListings.filter(l => extraRequestedIds.includes(l.id))].filter(Boolean);
  const offeredValue = offered.reduce((s, l) => s + (Number(l.price) || 0), 0);
  const requestedValue = requested.reduce((s, l) => s + (Number(l.price) || 0), 0);
  const cashNum = Number(cash) || 0;
  const diff = requestedValue - offeredValue; // >0: initiator giver mindre værdi

  const toggle = (arr, setArr, id) => setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  const valid = (offered.length > 0 || cashNum > 0) && requested.length > 0
    && cashNum >= 0 && (cashNum === 0 || (cashPayer === 'initiator' || cashPayer === 'owner'));

  async function submit() {
    if (!valid) { showToast?.('Vælg mindst én vare at tilbyde (eller et kontant beløb)', 'error'); return; }
    setSaving(true);
    try {
      const res = await authedFetch('/api/swaps/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeredListingIds: offeredIds,
          requestedListingIds: requested.map(l => l.id),
          cashAdjustment: cashNum,
          cashPayer: cashNum > 0 ? cashPayer : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast?.(data.error || 'Forslaget kunne ikke sendes', 'error'); setSaving(false); return; }
      showToast?.('Bytteforslag sendt! 🔄');
      if (data.owner?.email) {
        authedFetch('/api/notify-message', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerEmail: data.owner.email, ownerName: data.owner.name,
            senderName: data.initiatorName || 'En institution',
            listingTitle: listing.title, listingEmoji: listing.emoji || '🧸', convId: data.conversationId,
          }),
        }).catch(() => {});
      }
      onSubmitted?.(data);
      setSaving(false);
      onClose?.();
    } catch { showToast?.('Noget gik galt — prøv igen', 'error'); setSaving(false); }
  }

  const itemRow = (l, checked, onToggle) => (
    <button key={l.id} type="button" onClick={onToggle}
      style={{ display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:10,
        border:`1.5px solid ${checked ? PRIMARY : PAPER3}`, background: checked ? GREEN_TINT : '#fff', cursor:'pointer', marginBottom:6 }}>
      <div style={{ width:28, height:28, borderRadius:7, background:l.color || PAPER2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0, overflow:'hidden' }}>
        {l.images?.[0] ? <img src={l.images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (l.emoji || '🧸')}
      </div>
      <span style={{ flex:1, minWidth:0, fontFamily:FONT, fontSize:13, fontWeight:600, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.title}</span>
      <span style={{ fontFamily:FONT, fontSize:12, fontWeight:700, color:INK3 }}>{l.price ? kr(l.price) : '—'}</span>
      <span style={{ fontSize:14 }}>{checked ? '✅' : '＋'}</span>
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title="Foreslå bytte">
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        {/* Du vil have */}
        <div>
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:INK2, marginBottom:8 }}>Du vil have</div>
          {itemRow(listing, true, () => {})}
          {ownerListings.length > 0 && (
            <>
              <div style={{ fontFamily:FONT, fontSize:11, color:INK3, margin:'6px 0' }}>Tilføj flere fra {listing.institution_name}:</div>
              {ownerListings.map(l => itemRow(l, extraRequestedIds.includes(l.id), () => toggle(extraRequestedIds, setExtraRequestedIds, l.id)))}
            </>
          )}
        </div>

        {/* Du tilbyder */}
        <div>
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:INK2, marginBottom:8 }}>Du tilbyder</div>
          {ownListings.length === 0
            ? <div style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>Du har ingen aktive opslag at tilbyde.</div>
            : ownListings.map(l => itemRow(l, offeredIds.includes(l.id), () => toggle(offeredIds, setOfferedIds, l.id)))}
        </div>

        {/* Værdi-hint */}
        <div style={{ background:GREEN_TINT, border:`1px solid ${GREEN_SOFT}`, borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:6, fontFamily:FONT, fontSize:13 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:INK3 }}>Du tilbyder</span><span style={{ fontWeight:700, color:INK2 }}>{kr(offeredValue)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:INK3 }}>Du vil have</span><span style={{ fontWeight:700, color:INK2 }}>{kr(requestedValue)}</span></div>
          {diff !== 0 && (
            <div style={{ fontSize:11, color:INK3, lineHeight:1.5 }}>
              {diff > 0
                ? `Du beder om ${kr(diff)} mere i værdi — overvej at lægge et kontant beløb oveni.`
                : `Du tilbyder ${kr(-diff)} mere i værdi.`}
            </div>
          )}
        </div>

        {/* Kontant mellemlag */}
        <div>
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:INK2, marginBottom:8 }}>Kontant mellemlag (valgfrit)</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="number" inputMode="numeric" value={cash} onChange={e => setCash(e.target.value)} placeholder="0"
              style={{ width:110, padding:'10px 12px', borderRadius:10, border:`1.5px solid ${PAPER3}`, fontSize:15, fontWeight:700, fontFamily:FONT, outline:'none' }} />
            <span style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>kr. betales af</span>
            <div style={{ display:'flex', gap:6 }}>
              {[['initiator','mig'],['owner','modpart']].map(([val,lab]) => (
                <button key={val} type="button" onClick={()=>setCashPayer(val)}
                  style={{ padding:'8px 12px', borderRadius:99, border:`1.5px solid ${cashPayer===val?PRIMARY:PAPER3}`, background:cashPayer===val?GREEN_TINT:'#fff', color:cashPayer===val?PRIMARY:INK2, fontFamily:FONT, fontWeight:700, fontSize:12, cursor:'pointer' }}>{lab}</button>
              ))}
            </div>
          </div>
        </div>

        <Btn variant="primary" onClick={submit} disabled={!valid || saving} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>
          {saving ? <><Spinner/> Sender…</> : 'Send bytteforslag'}
        </Btn>
      </div>
    </Modal>
  );
}
