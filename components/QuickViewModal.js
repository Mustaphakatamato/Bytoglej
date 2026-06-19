'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, FONT } from '@/lib/constants';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { authedFetch } from '@/lib/authed-fetch';
const ACCENT  = '#F4A261';
const ACCENT2 = '#4361EE';

export default function QuickViewModal({ listing, onClose }) {
  const router = useRouter();
  const { setActiveListing, setSelectedConvId, showToast, cart, addToCart, removeFromCart } = useApp();
  const { userId, institutionId, institution, userEmail } = useActiveUser();
  const [imgIdx,       setImgIdx]       = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [ownListings,  setOwnListings]  = useState([]);
  const [mode, setMode] = useState('main'); // 'main' | 'bid' | 'swap' | 'buy'
  const [bidAmount,    setBidAmount]    = useState('');
  const [selectedSwapId, setSelectedSwapId] = useState(null);
  const [swapOffer,    setSwapOffer]    = useState('');
  const [trustScore,   setTrustScore]  = useState(null);

  useEffect(() => {
    if (!listing.institution_name) return;
    db.from('transaction_reviews')
      .select('description_score, contact_score, trade_again')
      .eq('reviewed_institution_name', listing.institution_name)
      .then(({ data }) => {
        if (!data?.length) return;
        const avg = data.reduce((s,r) => s + (r.description_score + r.contact_score) / 2, 0) / data.length;
        const pct = Math.round((avg / 3) * 100);
        setTrustScore({ pct, count: data.length, wouldTradeAgain: Math.round(data.filter(r=>r.trade_again==='ja').length / data.length * 100) });
      });
  }, [listing.institution_name]);

  const imgs = listing.images?.length ? listing.images : [];
  const tc = TYPE_CFG[listing.type] || { label: listing.type, color: INK3, bg: PAPER2 };

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') { if (mode !== 'main') setMode('main'); else onClose(); } };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose, mode]);

  useEffect(() => {
    if (mode === 'swap' && !ownListings.length) {
      db.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        db.from('listings').select('id,title,emoji,color,images')
          .eq('user_id', user.id).eq('is_active', true).neq('id', listing.id)
          .then(({ data }) => { if (data) setOwnListings(data); });
      });
    }
  }, [mode]);

  async function getConvId(user, ownerInst) {
    const myInstId = institutionId || null;
    const senderName = institution?.name || user.email;
    const orFilter = myInstId ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${user.id}` : `initiator_id.eq.${user.id}`;
    const { data: existing } = await db.from('conversations').select('id,owner_unread').eq('listing_id', listing.id).or(orFilter).maybeSingle();
    if (existing) return { convId: existing.id, ownerUnread: existing.owner_unread || 0, senderName };
    const { data: conv } = await db.from('conversations').insert({
      listing_id: listing.id,
      listing_title: listing.title,
      listing_emoji: listing.emoji || '🧸',
      listing_color: listing.color || GREEN_TINT,
      listing_image: imgs[0] || null,
      initiator_id: user.id,
      initiator_name: senderName,
      initiator_institution_id: myInstId,
      owner_id: listing.user_id,
      owner_name: listing.institution_name,
      owner_institution_id: ownerInst?.id || null,
    }).select().single();
    if (conv && ownerInst?.email && ownerInst.email.toLowerCase() !== user.email.toLowerCase()) {
      authedFetch('/api/notify-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName, listingTitle: listing.title, listingEmoji: listing.emoji, convId: conv.id }),
      }).catch(() => {});
    }
    return { convId: conv?.id, ownerUnread: 0, senderName };
  }

  async function handleContact() {
    if (isOwn) { showToast('Du kan ikke sende en besked til dig selv', 'error'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); setSaving(false); return; }
      const { data: ownerInst } = await db.from('institutions').select('id,email,name').ilike('name', listing.institution_name).maybeSingle();
      const { convId } = await getConvId(user, ownerInst);
      if (convId) { setSelectedConvId(convId); onClose(); router.push('/beskeder'); }
    } catch { showToast('Noget gik galt. Prøv igen', 'error'); }
    setSaving(false);
  }

  async function handleBid() {
    if (!bidAmount) return;
    setSaving(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); setSaving(false); return; }
      if (listing.min_bid && Number(bidAmount) < listing.min_bid) {
        showToast(`Mindste bud er ${listing.min_bid} kr.`, 'error'); setSaving(false); return;
      }
      const { data: ownerInst } = await db.from('institutions').select('id,email,name').ilike('name', listing.institution_name).maybeSingle();
      const { convId, ownerUnread, senderName } = await getConvId(user, ownerInst);
      if (convId) {
        const bidMsg = `Bud: ${bidAmount} kr.`;
        await db.from('chat_messages').insert({ conversation_id: convId, sender_id: user.id, sender_name: senderName, content: bidMsg, message_type: 'bid', bid_amount: Number(bidAmount), bid_status: 'pending' });
        await db.from('conversations').update({ last_message: bidMsg, last_message_at: new Date().toISOString(), owner_unread: ownerUnread + 1 }).eq('id', convId);
        await db.from('listings').update({ bid_count: (listing.bid_count || 0) + 1 }).eq('id', listing.id);
        setSelectedConvId(convId); onClose(); router.push('/beskeder');
        showToast(`Bud på ${bidAmount} kr. afsendt! 🎉`);
      }
    } catch { showToast('Noget gik galt. Prøv igen', 'error'); }
    setSaving(false);
  }

  async function handleSwap() {
    const chosen = ownListings.find(l => l.id === selectedSwapId);
    if (!chosen && !swapOffer.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); setSaving(false); return; }
      const { data: ownerInst } = await db.from('institutions').select('id,email,name').ilike('name', listing.institution_name).maybeSingle();
      const { convId, ownerUnread, senderName } = await getConvId(user, ownerInst);
      if (convId) {
        const swapContent = JSON.stringify({ swap_listing_id: chosen?.id || null, swap_title: chosen?.title || null, swap_emoji: chosen?.emoji || null, swap_color: chosen?.color || null, swap_image: chosen?.images?.[0] || null, note: swapOffer.trim() || null });
        const lastMsg = chosen ? `🔄 Bytteforslag: "${chosen.title}"` : `🔄 Bytteforslag: ${swapOffer}`;
        await db.from('chat_messages').insert({ conversation_id: convId, sender_id: user.id, sender_name: senderName, content: swapContent, message_type: 'swap' });
        await db.from('conversations').update({ last_message: lastMsg, last_message_at: new Date().toISOString(), owner_unread: ownerUnread + 1 }).eq('id', convId);
        setSelectedConvId(convId); onClose(); router.push('/beskeder');
        showToast('Bytteforslag sendt!');
      }
    } catch { showToast('Noget gik galt. Prøv igen', 'error'); }
    setSaving(false);
  }

  function openFullPage() {
    setActiveListing(listing);
    onClose();
    router.push('/opslag/detail');
  }

  const isOwn = !!(institution && listing.institution_name?.toLowerCase() === institution.name?.toLowerCase());
  const inCart = cart?.some(c => c.listingId === listing.id);

  function handleAddToCart(e) {
    e.stopPropagation();
    if (inCart) { router.push('/indkøbsvogn'); onClose(); return; }
    addToCart({
      listingId: listing.id,
      listingTitle: listing.title,
      listingEmoji: listing.emoji || '🧸',
      listingColor: listing.color || GREEN_TINT,
      price: listing.price,
      category: listing.category,
      images: listing.images || [],
      ownerInstitutionName: listing.institution_name,
      ownerId: listing.user_id,
    });
    showToast(`"${listing.title}" lagt i kurven 🛒`);
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.65)', zIndex:10003, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={mode === 'main' ? onClose : undefined}>
      <div style={{ background:PAPER, borderRadius:24, maxWidth:580, width:'100%', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(22,34,28,0.3)', position:'relative' }} onClick={e=>e.stopPropagation()}>

        <button onClick={()=>{ if (mode !== 'main') setMode('main'); else onClose(); }} style={{ position:'absolute', top:12, right:12, zIndex:10, width:34, height:34, borderRadius:'50%', background:'rgba(22,34,28,0.55)', border:'none', color:'#fff', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
          {mode !== 'main' ? '←' : '✕'}
        </button>

        {/* Image */}
        <div style={{ height:260, background: imgs.length ? '#f5f5f5' : (listing.color || GREEN_TINT), position:'relative', borderRadius:'24px 24px 0 0', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {imgs.length
            ? <img src={imgs[imgIdx]} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            : <span style={{ fontSize:80, opacity:0.3 }}>{listing.emoji || '🧸'}</span>}
          {imgs.length > 1 && (
            <>
              <button onClick={e=>{e.stopPropagation();setImgIdx(i=>(i-1+imgs.length)%imgs.length);}} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', background:'rgba(22,34,28,0.5)', border:'none', borderRadius:'50%', width:36, height:36, color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
              <button onClick={e=>{e.stopPropagation();setImgIdx(i=>(i+1)%imgs.length);}} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'rgba(22,34,28,0.5)', border:'none', borderRadius:'50%', width:36, height:36, color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
              <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', gap:5 }}>
                {imgs.map((_,i) => <div key={i} style={{ width:i===imgIdx?14:6, height:6, borderRadius:99, background:i===imgIdx?'#fff':'rgba(255,255,255,0.45)', transition:'all 0.2s' }} />)}
              </div>
            </>
          )}
        </div>

        <div style={{ padding:'20px 24px 28px' }}>
          {/* ── MAIN view ── */}
          {mode === 'main' && (
            <>
              <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                <span style={{ background:tc.bg, color:tc.color, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{tc.label}</span>
                {listing.condition && <span style={{ background:PAPER3, color:INK2, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{listing.condition}</span>}
                {listing.age_group && <span style={{ background:PAPER2, color:INK3, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:600, fontFamily:FONT }}>{listing.age_group}</span>}
                {(() => {
                  const so = listing.shipping_options?.[0];
                  if (!so && !listing.can_ship) return null;
                  const badges = [];
                  if (so?.allow_pickup) badges.push({ icon:'📍', label:'Afhentes', bg:'#F0FDF4', color:'#16a34a' });
                  if (so?.allow_shipping || (!so && listing.can_ship)) badges.push({ icon:'📦', label:'Sendes', bg:'#EFF6FF', color:'#2563EB' });
                  if (so?.allow_custom) badges.push({ icon:'🤝', label:'Aftalt levering', bg:'#FEF9C3', color:'#92400e' });
                  return badges.map(b => <span key={b.label} style={{ background:b.bg, color:b.color, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{b.icon} {b.label}</span>);
                })()}
              </div>
              <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:INK, letterSpacing:'-0.03em', marginBottom:8, lineHeight:1.2 }}>{listing.title}</h2>
              <div style={{ marginBottom:12 }}>
                {listing.price
                  ? <span style={{ display:'inline-flex', alignItems:'baseline', gap:6, flexWrap:'wrap' }}>
                      {listing.original_price && listing.original_price > listing.price && (
                        <span style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:INK3, textDecoration:'line-through' }}>{listing.original_price} kr.</span>
                      )}
                      <span style={{ fontFamily:FONT, fontWeight:800, fontSize:22, color: listing.original_price && listing.original_price > listing.price ? '#e11d48' : PRIMARY }}>{listing.price} kr.</span>
                    </span>
                  : listing.type === 'byt' ? <span style={{ fontSize:15, color:CORAL, fontWeight:700, fontFamily:FONT }}>Byttes kun</span>
                  : <span style={{ fontSize:15, color:ACCENT2, fontWeight:700, fontFamily:FONT }}>Afgiv bud</span>}
                {listing.type === 'byd' && listing.min_bid && <span style={{ fontSize:12, color:INK3, marginLeft:8, fontFamily:FONT }}>Mindstebud: {listing.min_bid} kr.</span>}
              </div>
              {listing.description && <p style={{ fontSize:14, color:INK2, lineHeight:1.65, marginBottom:14, fontFamily:FONT }}>{listing.description}</p>}
              {listing.tags?.length > 0 && (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:14 }}>
                  {listing.tags.map(t => <span key={t} style={{ background:GREEN_TINT, color:PRIMARY, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{t}</span>)}
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'10px 14px', background:PAPER2, borderRadius:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:14, fontFamily:FONT, flexShrink:0 }}>
                  {listing.institution_name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK }}>{listing.institution_name}</div>
                  {listing.city && <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>{listing.city}</div>}
                </div>
                {trustScore && (
                  <div style={{ flexShrink:0, textAlign:'center', background:PRIMARY, borderRadius:10, padding:'4px 10px' }}>
                    <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:'#fff', lineHeight:1 }}>{trustScore.pct}%</div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', fontFamily:FONT, fontWeight:600 }}>Tillid</div>
                  </div>
                )}
              </div>
              {isOwn ? (
                <div style={{ background:GREEN_TINT, borderRadius:14, padding:'12px 16px', marginBottom:12, textAlign:'center' }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PRIMARY }}>Dit eget opslag</div>
                </div>
              ) : (
                <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                  {listing.type === 'køb' && (
                    <>
                      <button onClick={handleAddToCart}
                        style={{ flex:2, padding:'14px', borderRadius:99, background:inCart?'#16a34a':PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                        {inCart ? 'I kurven, gå til kurv →' : 'Læg i kurv'}
                      </button>
                      <button onClick={handleContact} disabled={saving}
                        style={{ flex:1, padding:'14px', borderRadius:99, background:saving?PAPER3:GREEN_TINT, color:saving?INK3:PRIMARY, border:`1.5px solid ${PRIMARY}`, fontFamily:FONT, fontWeight:600, fontSize:13, cursor:saving?'not-allowed':'pointer', transition:'all 0.2s' }}>
                        {saving ? '…' : 'Skriv til sælger'}
                      </button>
                    </>
                  )}
                  {listing.type === 'byd' && (
                    <>
                      <button onClick={()=>setMode('bid')}
                        style={{ flex:2, padding:'14px', borderRadius:99, background:ACCENT2, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:'pointer' }}>
                        Afgiv bud
                      </button>
                      <button onClick={handleContact} disabled={saving}
                        style={{ flex:1, padding:'14px', borderRadius:99, background:saving?PAPER3:GREEN_TINT, color:saving?INK3:PRIMARY, border:`1.5px solid ${PRIMARY}`, fontFamily:FONT, fontWeight:600, fontSize:13, cursor:saving?'not-allowed':'pointer', transition:'all 0.2s' }}>
                        {saving ? '…' : 'Skriv til sælger'}
                      </button>
                    </>
                  )}
                  {listing.type === 'byt' && (
                    <>
                      <button onClick={()=>setMode('swap')}
                        style={{ flex:2, padding:'14px', borderRadius:99, background:CORAL, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:'pointer' }}>
                        Foreslå bytte
                      </button>
                      <button onClick={handleContact} disabled={saving}
                        style={{ flex:1, padding:'14px', borderRadius:99, background:saving?PAPER3:GREEN_TINT, color:saving?INK3:PRIMARY, border:`1.5px solid ${PRIMARY}`, fontFamily:FONT, fontWeight:600, fontSize:13, cursor:saving?'not-allowed':'pointer', transition:'all 0.2s' }}>
                        {saving ? '…' : 'Skriv til sælger'}
                      </button>
                    </>
                  )}
                  <button onClick={openFullPage}
                    style={{ flex:1, padding:'14px', borderRadius:99, background:PAPER2, color:INK2, border:'none', fontFamily:FONT, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                    Se fuld side →
                  </button>
                </div>
              )}
              {/* Delivery options summary */}
              {(() => {
                const so = listing.shipping_options?.[0];
                if (!so) return null;
                const rows = [];
                if (so.allow_pickup) rows.push({ icon:'📍', label:'Afhentes', detail: so.pickup_address || 'Kontakt sælger for adresse' });
                if (so.allow_shipping) rows.push({ icon:'📦', label:'Pakke', detail: so.shipping_size_category ? `Størrelse: ${so.shipping_size_category}${so.shipping_included_in_price ? ' · Porto inkluderet' : ' · Porto betales af køber'}` : 'Sendes med pakkepost' });
                if (so.allow_custom) rows.push({ icon:'🤝', label:'Aftalt levering', detail: 'Aftales individuelt med sælger' });
                if (!rows.length) return null;
                return (
                  <div style={{ background:PAPER2, borderRadius:14, padding:'12px 14px', border:`1px solid ${PAPER3}`, marginBottom:10 }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:INK2, marginBottom:8 }}>Levering</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {rows.map(r => (
                        <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:INK3, fontFamily:FONT }}>
                          <span style={{ fontSize:14, flexShrink:0 }}>{r.icon}</span>
                          <span style={{ fontWeight:600, color:INK2 }}>{r.label}</span>
                          <span style={{ color:INK3 }}>· {r.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {!isOwn && (
                <div style={{ display:'flex', alignItems:'center', gap:12, background:PAPER2, borderRadius:14, padding:'12px 14px', border:`1px solid ${PAPER3}` }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>📦</span>
                  <div style={{ flex:1, fontSize:12, color:INK3, fontFamily:FONT, lineHeight:1.5 }}>
                    Vil du lave et bundttilbud?{' '}
                    <span onClick={()=>{ onClose(); router.push('/institution/'+encodeURIComponent(listing.institution_name)); }}
                      style={{ color:PRIMARY, fontWeight:700, cursor:'pointer', textDecoration:'underline' }}>
                      Gå til {listing.institution_name}s side →
                    </span>
                  </div>
                </div>
              )}
              {isOwn && (
                <button onClick={openFullPage} style={{ width:'100%', padding:'13px', borderRadius:99, background:PAPER2, color:INK2, border:'none', fontFamily:FONT, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  Se fuld side →
                </button>
              )}
            </>
          )}

          {/* ── BID view ── */}
          {mode === 'bid' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ background:PAPER2, borderRadius:12, padding:16 }}>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK }}>{listing.title}</div>
                <div style={{ color:INK3, fontSize:13, marginTop:4, fontFamily:FONT }}>{listing.institution_name}{listing.min_bid ? ` · Mindste bud: ${listing.min_bid} kr.` : ''}</div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:8, fontFamily:FONT }}>
                  Dit bud (kr.){listing.min_bid ? ` (minimum ${listing.min_bid} kr.)` : ''}
                </label>
                <input type="number" value={bidAmount} onChange={e=>setBidAmount(e.target.value)}
                  placeholder={listing.min_bid ? `Minimum ${listing.min_bid} kr.` : 'Fx 150'} min={listing.min_bid||1}
                  style={{ width:'100%', padding:'13px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:16, fontFamily:FONT, fontWeight:700, outline:'none', background:PAPER2, boxSizing:'border-box' }} />
                {listing.min_bid && bidAmount && Number(bidAmount) < listing.min_bid && (
                  <p style={{ fontSize:12, color:'#e11d48', marginTop:4, fontFamily:FONT }}>Mindste bud er {listing.min_bid} kr.</p>
                )}
              </div>
              <button onClick={handleBid} disabled={saving || !bidAmount || (listing.min_bid && Number(bidAmount) < listing.min_bid)}
                style={{ width:'100%', padding:'14px', borderRadius:99, background:(!saving && bidAmount) ? ACCENT2 : PAPER3, color:(!saving && bidAmount)?'#fff':INK3, border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:(!saving && bidAmount)?'pointer':'not-allowed', transition:'all 0.2s' }}>
                {saving ? 'Sender…' : 'Send bud'}
              </button>
            </div>
          )}

          {/* ── SWAP view ── */}
          {mode === 'swap' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ background:'#FCEAE6', borderRadius:12, padding:'12px 14px', borderLeft:`3px solid ${CORAL}` }}>
                <div style={{ fontSize:12, color:CORAL, fontWeight:700, marginBottom:3, fontFamily:FONT }}>De tilbyder:</div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:INK }}>{listing.title}</div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:10, fontFamily:FONT }}>
                  {ownListings.length > 0 ? 'Vælg hvad I tilbyder:' : 'Beskriv hvad I tilbyder:'}
                </label>
                {ownListings.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:200, overflowY:'auto', marginBottom:12 }}>
                    {ownListings.map(l => (
                      <div key={l.id} onClick={()=>setSelectedSwapId(l.id === selectedSwapId ? null : l.id)}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, border:`2px solid ${selectedSwapId===l.id?ACCENT:'rgba(22,34,28,0.1)'}`, background:selectedSwapId===l.id?'#FEF0E3':PAPER2, cursor:'pointer', transition:'all 0.15s' }}>
                        <div style={{ width:40, height:40, borderRadius:10, background:l.images?.[0]?PAPER3:(l.color||'#FFD166'), display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                          {l.images?.[0] ? <img src={l.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (l.emoji||'🧸')}
                        </div>
                        <span style={{ fontWeight:600, fontSize:14, fontFamily:FONT, flex:1 }}>{l.title}</span>
                        {selectedSwapId===l.id && <span style={{ color:ACCENT, fontSize:18 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
                <textarea value={swapOffer} onChange={e=>setSwapOffer(e.target.value)}
                  placeholder={ownListings.length > 0 ? 'Eller beskriv frit hvad I tilbyder…' : 'Beskriv hvad I tilbyder i bytte…'}
                  rows={3}
                  style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:14, resize:'none', fontFamily:FONT, outline:'none', background:PAPER2, boxSizing:'border-box' }} />
              </div>
              <button onClick={handleSwap} disabled={saving || (!selectedSwapId && !swapOffer.trim())}
                style={{ width:'100%', padding:'14px', borderRadius:99, background:(!saving && (selectedSwapId || swapOffer.trim())) ? CORAL : PAPER3, color:(!saving && (selectedSwapId || swapOffer.trim()))?'#fff':INK3, border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:(!saving&&(selectedSwapId||swapOffer.trim()))?'pointer':'not-allowed', transition:'all 0.2s' }}>
                {saving ? 'Sender…' : 'Send bytteforslag'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
