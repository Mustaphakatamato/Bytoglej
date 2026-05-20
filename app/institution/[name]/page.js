'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_TINT, GREEN_SOFT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import ListingCard from '@/components/ListingCard';

const FONT = "'Sora', sans-serif";

function ItemChip({ item, removable, onRemove }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, background:PAPER2, borderRadius:10, padding:'8px 10px', position:'relative' }}>
      <div style={{ width:36, height:36, borderRadius:8, background:item.images?.[0] ? PAPER3 : (item.color||GREEN_TINT), flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
        {item.images?.[0] ? <img src={item.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (item.emoji||'🧸')}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:INK, lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</div>
        <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>{item.condition||''}</div>
      </div>
      {removable && (
        <button onClick={()=>onRemove(item.id)} style={{ background:'none', border:'none', color:INK3, cursor:'pointer', fontSize:14, padding:'0 2px', lineHeight:1 }}>✕</button>
      )}
    </div>
  );
}

export default function InstitutionPage() {
  const params = useParams();
  const institutionName = decodeURIComponent(params.name);
  const router = useRouter();
  const { favs, toggleFav, setActiveListing, setSelectedConvId } = useApp();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inst, setInst] = useState(null);
  const [contacting, setContacting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bundleModal, setBundleModal] = useState(false);
  const [myListings, setMyListings] = useState([]);
  const [offerSelected, setOfferSelected] = useState([]);
  const [bundleNote, setBundleNote] = useState('');
  const [sendingBundle, setSendingBundle] = useState(false);
  const [myInst, setMyInst] = useState(null);
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      db.from('listings').select('*').eq('institution_name', institutionName).eq('is_active', true).eq('is_sold', false).order('created_at', { ascending: false }),
      db.from('institutions').select('*').eq('name', institutionName).maybeSingle(),
    ]).then(([{ data: lst }, { data: instData }]) => {
      if (lst) setListings(lst);
      if (instData) setInst(instData);
      setLoading(false);
    });
  }, [institutionName]);

  async function enterSelectMode() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: me } = await db.from('institutions').select('*').ilike('email', user.email).maybeSingle();
    if (me?.name === institutionName) return;
    setMyInst(me);
    if (me) {
      const { data: mine } = await db.from('listings').select('*').eq('institution_name', me.name).eq('is_active', true).eq('is_sold', false).order('created_at', { ascending: false });
      setMyListings(mine || []);
    }
    setSelectMode(true);
    setSelected([]);
  }

  function toggleSelect(listing) {
    setSelected(prev => prev.find(x => x.id === listing.id) ? prev.filter(x => x.id !== listing.id) : [...prev, listing]);
  }

  function toggleOffer(listing) {
    setOfferSelected(prev => prev.find(x => x.id === listing.id) ? prev.filter(x => x.id !== listing.id) : [...prev, listing]);
  }

  function cancelSelect() {
    setSelectMode(false);
    setSelected([]);
    setOfferSelected([]);
    setBundleNote('');
  }

  async function sendBundle() {
    if (!selected.length) return;
    setSendingBundle(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); setSendingBundle(false); return; }
      const { data: ownerInst } = await db.from('institutions').select('id,user_id,email,name').eq('name', institutionName).maybeSingle();
      if (!ownerInst) { setSendingBundle(false); return; }
      const myInstId = myInst?.id || null;
      const userName = myInst?.name || user.email;

      const bundleTitle = selected.length === 1 ? selected[0].title : `Bundttilbud — ${selected.length} opslag`;
      const { data: conv } = await db.from('conversations').insert({
        listing_id: null,
        listing_title: bundleTitle,
        listing_emoji: '📦',
        listing_color: PRIMARY,
        listing_image: selected[0]?.images?.[0] || null,
        initiator_id: user.id,
        initiator_name: userName,
        initiator_institution_id: myInstId,
        owner_id: ownerInst.id,
        owner_name: ownerInst.name,
        owner_institution_id: ownerInst.id,
      }).select().single();

      if (!conv?.id) { setSendingBundle(false); return; }

      const bundleContent = JSON.stringify({
        bundle_items: selected.map(l => ({ id: l.id, title: l.title, emoji: l.emoji, color: l.color, image: l.images?.[0] || null })),
        offer_items: offerSelected.map(l => ({ id: l.id, title: l.title, emoji: l.emoji, color: l.color, image: l.images?.[0] || null })),
        note: bundleNote.trim(),
      });

      await db.from('chat_messages').insert({
        conversation_id: conv.id,
        sender_id: user.id,
        sender_name: userName,
        content: bundleContent,
        message_type: 'bundle',
      });

      await db.from('conversations').update({ initiator_unread: 0, owner_unread: 1 }).eq('id', conv.id);

      if (ownerInst.email && ownerInst.email.toLowerCase() !== user.email.toLowerCase()) {
        fetch('/api/notify-message', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName: userName, listingTitle: bundleTitle, listingEmoji: '📦', convId: conv.id }),
        }).catch(() => {});
      }

      if (setSelectedConvId) setSelectedConvId(conv.id);
      router.push('/beskeder');
    } catch (e) { console.error(e); }
    setSendingBundle(false);
  }

  async function handleContact() {
    setContacting(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); setContacting(false); return; }
      const { data: myInstData } = await db.from('institutions').select('id,name').ilike('email', user.email).maybeSingle();
      if (myInstData?.name === institutionName) { setContacting(false); return; }
      const { data: ownerInst } = await db.from('institutions').select('id,user_id,email,name').eq('name', institutionName).maybeSingle();
      if (!ownerInst) { setContacting(false); return; }
      const myInstId = myInstData?.id || null;
      const userName = myInstData?.name || user.email;
      const { data: existing } = await db.from('conversations')
        .select('id').is('listing_id', null).eq('owner_institution_id', ownerInst.id)
        .or(myInstId ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${user.id}` : `initiator_id.eq.${user.id}`)
        .maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: conv } = await db.from('conversations').insert({
          listing_id: null, listing_title: `Besked til ${institutionName}`,
          listing_emoji: '💬', listing_color: '#CFE3D8', listing_image: null,
          initiator_id: user.id, initiator_name: userName,
          initiator_institution_id: myInstId, owner_id: ownerInst.id,
          owner_name: ownerInst.name, owner_institution_id: ownerInst.id,
        }).select().single();
        convId = conv?.id;
        if (convId && ownerInst.email && ownerInst.email.toLowerCase() !== user.email.toLowerCase()) {
          fetch('/api/notify-message', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName: userName, listingTitle: institutionName, listingEmoji: '💬', convId }),
          }).catch(() => {});
        }
      }
      if (convId && setSelectedConvId) setSelectedConvId(convId);
      router.push('/beskeder');
    } catch {}
    setContacting(false);
  }

  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:'#f8f5f0' }} className="page-enter">
      <div style={{ maxWidth:1140, margin:'0 auto', padding:isMobile?'24px 16px':'36px 24px' }}>
        <button onClick={()=>router.push('/opslag')} style={{ background:'none', border:'none', color:PRIMARY, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
          ← Tilbage til opslag
        </button>

        {/* Institution header */}
        <div style={{ background:'#fff', borderRadius:22, padding:isMobile?'20px 16px':'28px 32px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{ width:60, height:60, borderRadius:16, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
              {inst?.logo_url
                ? <img src={inst.logo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                : <span style={{ color:'#fff', fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:22 }}>{institutionName.charAt(0).toUpperCase()}</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:isMobile?22:28, marginBottom:4 }}>{institutionName}</h1>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:13, color:'#888' }}>
                {inst?.city && <span>📍 {inst.city}</span>}
                {inst?.institution_type && <span>🏫 {inst.institution_type}</span>}
                {inst?.ownership_type && <span>🏢 {inst.ownership_type}</span>}
                {inst?.phone && <span>📞 {inst.phone}</span>}
              </div>
            </div>
            <div style={{ background:'#E8F5EE', borderRadius:12, padding:'10px 18px', textAlign:'center', flexShrink:0 }}>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:22, color:PRIMARY }}>{listings.length}</div>
              <div style={{ fontSize:12, color:'#888' }}>aktive opslag</div>
            </div>
          </div>
          <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #e8e6e3', display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={handleContact} disabled={contacting} style={{ padding:'11px 24px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:contacting?'not-allowed':'pointer', opacity:contacting?0.7:1, display:'flex', alignItems:'center', gap:8 }}>
              {contacting ? '…' : '💬 Send besked'}
            </button>
            {listings.length > 0 && (
              <button onClick={selectMode ? cancelSelect : enterSelectMode} style={{ padding:'11px 24px', borderRadius:99, background:selectMode?PAPER3:'#fff', color:selectMode?INK2:PRIMARY, border:`2px solid ${selectMode?PAPER3:PRIMARY}`, fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                {selectMode ? '✕ Annuller valg' : '📦 Lav bundttilbud'}
              </button>
            )}
          </div>
          {selectMode && (
            <div style={{ marginTop:12, padding:'10px 14px', background:GREEN_TINT, borderRadius:12, fontSize:13, color:PRIMARY, fontFamily:FONT, fontWeight:600 }}>
              Vælg de opslag du vil have — klik på dem for at markere
            </div>
          )}
        </div>

        {/* Listings grid */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>⏳</div>
            <p>Indlæser opslag…</p>
          </div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb', background:'#fff', borderRadius:22, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
            <p style={{ fontSize:14 }}>Ingen aktive opslag fra {institutionName}</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(auto-fill,minmax(260px,1fr))', gap:isMobile?12:16, paddingBottom:selectMode&&selected.length>0?100:0 }}>
            {listings.map(l => {
              const isSelected = selected.find(x => x.id === l.id);
              return (
                <div key={l.id} style={{ position:'relative', cursor:selectMode?'pointer':'default' }}
                  onClick={selectMode ? ()=>toggleSelect(l) : undefined}>
                  <div style={{ transition:'transform 0.12s', transform: isSelected ? 'scale(0.97)' : 'scale(1)', outline: isSelected ? `3px solid ${PRIMARY}` : '3px solid transparent', borderRadius:16, overflow:'hidden' }}>
                    <ListingCard listing={l} favs={favs} toggleFav={selectMode ? ()=>{} : toggleFav}
                      onClick={selectMode ? ()=>toggleSelect(l) : ()=>{ setActiveListing(l); router.push('/opslag/detail'); }} />
                  </div>
                  {selectMode && (
                    <div style={{ position:'absolute', top:10, right:10, width:26, height:26, borderRadius:'50%', background: isSelected ? PRIMARY : 'rgba(255,255,255,0.9)', border:`2px solid ${isSelected?PRIMARY:PAPER3}`, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', transition:'all 0.15s' }}>
                      {isSelected && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating bundle bar */}
      {selectMode && selected.length > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200, background:GREEN_DEEP, padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, boxShadow:'0 -4px 24px rgba(22,34,28,0.25)' }}>
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:'#fff' }}>
            {selected.length} opslag valgt
          </div>
          <button onClick={()=>setBundleModal(true)} style={{ padding:'12px 28px', borderRadius:99, background:'#fff', color:GREEN_DEEP, border:'none', fontFamily:FONT, fontWeight:800, fontSize:14, cursor:'pointer' }}>
            Fortsæt med bundttilbud →
          </button>
        </div>
      )}

      {/* Bundle modal */}
      {bundleModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={()=>setBundleModal(false)}>
          <div style={{ background:'#fff', borderRadius:24, padding:isMobile?'22px 18px':'32px 32px', maxWidth:680, width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(22,34,28,0.22)' }} onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📦</div>
              <div>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, letterSpacing:'-0.03em' }}>Bundttilbud</div>
                <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>til {institutionName}</div>
              </div>
            </div>

            {/* What they want */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:8 }}>Du vil have ({selected.length})</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {selected.map(l => (
                  <ItemChip key={l.id} item={l} removable onRemove={id => setSelected(prev => prev.filter(x => x.id !== id))} />
                ))}
              </div>
            </div>

            <div style={{ height:1, background:PAPER2, margin:'16px 0' }} />

            {/* What they offer */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:8 }}>
                Du tilbyder <span style={{ fontWeight:400, color:INK3 }}>(vælg dine opslag — valgfri)</span>
              </div>
              {myListings.length === 0 ? (
                <div style={{ padding:'16px', borderRadius:12, background:PAPER, border:`1.5px dashed ${PAPER3}`, fontSize:13, color:INK3, fontFamily:FONT, textAlign:'center' }}>
                  Du har ingen aktive opslag at tilbyde
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflowY:'auto' }}>
                  {myListings.map(l => {
                    const isOff = offerSelected.find(x => x.id === l.id);
                    return (
                      <div key={l.id} onClick={()=>toggleOffer(l)} style={{ cursor:'pointer', outline: isOff ? `2px solid ${PRIMARY}` : '2px solid transparent', borderRadius:12, transition:'all 0.12s', background: isOff ? GREEN_TINT : 'transparent' }}>
                        <ItemChip item={l} removable={false} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note */}
            <div style={{ marginBottom:22 }}>
              <div style={{ fontSize:11, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:8 }}>Tilføj en note <span style={{ fontWeight:400 }}>(valgfri)</span></div>
              <textarea value={bundleNote} onChange={e=>setBundleNote(e.target.value)} placeholder="Fx: Vi er meget interesserede i disse — kan vi aftale en pris?" rows={2} style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:13, fontFamily:FONT, resize:'none', outline:'none', boxSizing:'border-box', color:INK }} />
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setBundleModal(false)} style={{ flex:1, padding:'13px', borderRadius:99, background:PAPER2, color:INK2, border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Tilbage
              </button>
              <button onClick={sendBundle} disabled={sendingBundle||selected.length===0} style={{ flex:2, padding:'13px', borderRadius:99, background:sendingBundle?PAPER3:PRIMARY, color:sendingBundle?INK3:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:sendingBundle?'not-allowed':'pointer' }}>
                {sendingBundle ? 'Sender…' : `Send bundttilbud →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
