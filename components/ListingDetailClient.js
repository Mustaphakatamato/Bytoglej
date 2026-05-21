'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, SKY, ACCENT, ACCENT2 } from '@/lib/constants';

const FONT = "'Sora', sans-serif";
import { useWindowWidth } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Badge, Btn, Spinner, Modal } from '@/components/ui';

function ImageGallery({ images, color, emoji }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const w = useWindowWidth();
  const imgH = w < 500 ? 260 : w < 768 ? 320 : 380;
  if (!images || images.length === 0) {
    return <div style={{ height:imgH, background:color||'#FFD166', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, fontSize:100 }}>{emoji||'🧸'}</div>;
  }
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ position:'relative', height:imgH, borderRadius:20, overflow:'hidden', background:'#f0eeeb' }}>
        <img src={images[active]} alt="" onClick={()=>setLightbox(true)} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', cursor:'zoom-in' }} />
        <div style={{ position:'absolute', bottom:12, right:12, background:'rgba(0,0,0,0.48)', color:'#fff', borderRadius:8, padding:'4px 10px', fontSize:11, fontWeight:600, pointerEvents:'none' }}>🔍 Klik for fuld visning</div>
        {images.length > 1 && <>
          <button onClick={()=>setActive(i=>(i-1+images.length)%images.length)}
            style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,0.92)', border:'none', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}>‹</button>
          <button onClick={()=>setActive(i=>(i+1)%images.length)}
            style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,0.92)', border:'none', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}>›</button>
          <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
            {images.map((_,i)=><div key={i} onClick={()=>setActive(i)} style={{ width:i===active?20:8, height:8, borderRadius:4, background:i===active?'#fff':'rgba(255,255,255,0.5)', cursor:'pointer', transition:'all 0.2s' }} />)}
          </div>
        </>}
      </div>
      {images.length > 1 && (
        <div style={{ display:'flex', gap:8, marginTop:10, overflowX:'auto', paddingBottom:4 }}>
          {images.map((src,i)=>(
            <div key={i} onClick={()=>setActive(i)} style={{ width:72, height:72, borderRadius:12, overflow:'hidden', flexShrink:0, cursor:'pointer', border:`2.5px solid ${i===active?PRIMARY:'transparent'}`, transition:'border-color 0.15s' }}>
              <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
          ))}
        </div>
      )}
      {lightbox && (
        <div onClick={()=>setLightbox(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.93)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
          <img src={images[active]} alt="" onClick={e=>e.stopPropagation()} style={{ maxWidth:'92vw', maxHeight:'88vh', objectFit:'contain', borderRadius:10, boxShadow:'0 8px 48px rgba(0,0,0,0.5)' }} />
          {images.length > 1 && <>
            <button onClick={e=>{e.stopPropagation();setActive(i=>(i-1+images.length)%images.length);}} style={{ position:'absolute', left:20, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:'50%', width:52, height:52, fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <button onClick={e=>{e.stopPropagation();setActive(i=>(i+1)%images.length);}} style={{ position:'absolute', right:20, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:'50%', width:52, height:52, fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
          </>}
          <button onClick={()=>setLightbox(false)} style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:'50%', width:44, height:44, fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          <div style={{ position:'absolute', bottom:20, color:'rgba(255,255,255,0.6)', fontSize:13 }}>{active+1} / {images.length}</div>
        </div>
      )}
    </div>
  );
}

export default function ListingDetailClient() {
  const router = useRouter();
  const { activeListing: listing, setActiveListing, favs, toggleFav, setSelectedConvId, showToast, loggedIn, setQuickViewListing } = useApp();
  const { isAdminView: ctxIsAdmin, adminInstName, institution: ctxInstitution, institutionId: ctxInstId } = useActiveUser();

  const [buyModal,  setBuyModal]  = useState(false);
  const [buyStep,   setBuyStep]   = useState(1);
  const [bidModal,  setBidModal]  = useState(false);
  const [swapModal, setSwapModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [swapOffer, setSwapOffer] = useState('');
  const [selectedSwapId, setSelectedSwapId] = useState(null);
  const [bidCount,  setBidCount]  = useState(listing?.bid_count||0);
  const [saving,    setSaving]    = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [ownListings, setOwnListings] = useState([]);
  const [isFav, setIsFav] = useState(favs?.includes(listing?.id) || false);
  const [localFavCount, setLocalFavCount] = useState(listing?.fav_count || 0);
  const [shareModal, setShareModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [shareNote, setShareNote] = useState('');
  const [shareSending, setShareSending] = useState(false);
  const [myInstName, setMyInstName] = useState(null);
  const [existingBid, setExistingBid] = useState(null);
  const [instListings, setInstListings] = useState([]);

  useEffect(() => {
    if (!listing) return;
    db.from('listings')
      .select('id,title,description,type,condition,age_group,price,images,emoji,color,city,institution_name,fav_count,is_active,tags,created_at')
      .eq('institution_name', listing.institution_name)
      .eq('is_active', true)
      .neq('id', listing.id)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => { if (data) setInstListings(data); });
  }, [listing?.id]);

  useEffect(() => {
    if (!listing) return;
    db.auth.getUser().then(async ({ data:{ user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email);
      db.from('listings').select('id,title,emoji,color,images').eq('user_id', user.id).eq('is_active', true).neq('id', listing.id)
        .then(({ data }) => { if (data) setOwnListings(data); });
      const { data: inst } = await db.from('institutions').select('id,name,email').eq('email', user.email).maybeSingle();
      if (inst) {
        setMyInstName(inst.name);
        const { data: mems } = await db.from('institution_members').select('*').eq('institution_id', inst.id);
        if (mems?.length) setTeamMembers(mems);
      } else {
        const { data: mem } = await db.from('institution_members').select('role,institutions(id,name,email)').eq('email', user.email).maybeSingle();
        if (mem?.institutions) {
          setMyInstName(mem.institutions.name);
          const { data: mems } = await db.from('institution_members').select('*').eq('institution_id', mem.institutions.id);
          const adminEntry = { id: 'admin', email: mem.institutions.email, role: 'admin' };
          setTeamMembers([adminEntry, ...(mems||[])]);
        }
      }
      const { data: liveList } = await db.from('listings').select('bid_count').eq('id', listing.id).maybeSingle();
      if (liveList) setBidCount(liveList.bid_count || 0);
      const { data: existingConv } = await db.from('conversations').select('id').eq('listing_id', listing.id).eq('initiator_id', user.id).maybeSingle();
      if (existingConv) {
        const { data: pendingBid } = await db.from('chat_messages').select('*').eq('conversation_id', existingConv.id).eq('message_type', 'bid').eq('bid_status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (pendingBid) setExistingBid(pendingBid);
      }
    });
  }, []);

  useEffect(() => { if (listing) setIsFav(favs?.includes(listing.id) || false); }, [favs, listing?.id]);

  if (!listing) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', paddingTop:80, background:PAPER }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:80, color:GREEN_SOFT, lineHeight:1, marginBottom:16, userSelect:'none' }}>—</div>
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, marginBottom:16, color:INK }}>Intet opslag valgt</div>
          <button onClick={()=>router.push('/opslag')} style={{ background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'10px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'Sora',sans-serif" }}>← Tilbage til markedsplads</button>
        </div>
      </div>
    );
  }

  const isOwn = !!(ctxInstitution && listing.institution_name === ctxInstitution.name);

  function handleToggleFav() {
    const adding = !isFav;
    toggleFav?.(listing.id);
    setIsFav(v => !v);
    const newCount = Math.max(0, localFavCount + (adding ? 1 : -1));
    setLocalFavCount(newCount);
    db.from('listings').update({ fav_count: newCount }).eq('id', listing.id);
  }

  async function handleShare() {
    if (!selectedEmails.length || !currentUserId) return;
    setShareSending(true);
    await Promise.all(selectedEmails.map(email =>
      db.from('listing_shares').insert({
        listing_id: listing.id,
        listing_title: listing.title,
        listing_image: listing.images?.[0] || null,
        listing_type: listing.type,
        listing_price: listing.price || null,
        listing_emoji: listing.emoji,
        listing_color: listing.color,
        listing_institution_name: listing.institution_name,
        listing_city: listing.city,
        from_user_id: currentUserId,
        from_name: myInstName || 'Ukendt',
        to_email: email,
        note: shareNote.trim() || null,
      })
    ));
    setShareSending(false);
    setShareModal(false); setSelectedEmails([]); setShareNote('');
    showToast(`Opslag delt med ${selectedEmails.length} medarbejder${selectedEmails.length > 1 ? 'e' : ''}! 📤`);
  }

  async function onStartConv(listing) {
    const { data:{ user } } = await db.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: myInst } = await db.from('institutions').select('id,name').ilike('email', user.email).maybeSingle();
    const userName = myInst?.name || user.email;
    const myInstId = myInst?.id || null;
    if (listing.institution_name === userName) {
      showToast('Dette er dit eget opslag.', 'info'); return;
    }
    const { data: ownerInstData } = await db.from('institutions').select('id,email,name').eq('name', listing.institution_name).maybeSingle();
    const ownerInstId = ownerInstData?.id || null;
    const { data: existing } = await db.from('conversations')
      .select('id')
      .eq('listing_id', listing.id)
      .or(myInstId
        ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${user.id}`
        : `initiator_id.eq.${user.id}`)
      .maybeSingle();
    if (existing) { setSelectedConvId(existing.id); router.push('/beskeder'); return; }
    const { data: conv } = await db.from('conversations').insert({
      listing_id:               listing.id,
      listing_title:            listing.title,
      listing_emoji:            listing.emoji,
      listing_color:            listing.color,
      listing_image:            listing.images?.[0] || null,
      initiator_id:             user.id,
      initiator_name:           userName,
      initiator_institution_id: myInstId,
      owner_id:                 listing.user_id,
      owner_name:               listing.institution_name,
      owner_institution_id:     ownerInstId,
    }).select().single();
    if (conv) {
      if (ownerInstData?.email && ownerInstData.email.toLowerCase() !== user.email.toLowerCase()) {
        fetch('/api/notify-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerEmail: ownerInstData.email,
            ownerName: ownerInstData.name,
            senderName: userName,
            listingTitle: listing.title,
            listingEmoji: listing.emoji || '🧸',
            convId: conv.id,
          }),
        }).catch(() => {});
      }
      setSelectedConvId(conv.id); router.push('/beskeder');
    }
  }

  function goToInstitution(name) {
    router.push('/institution/' + encodeURIComponent(name));
  }

  async function handleBuy() {
    setSaving(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      const { data: inst } = await db.from('institutions').select('id,name').ilike('email', user.email).maybeSingle();
      const buyerName = inst?.name || myInstName || user.email;
      const buyerInstId = inst?.id || ctxInstId || null;
      const { data: ownerInst } = await db.from('institutions').select('id,email,name').eq('name', listing.institution_name).maybeSingle();
      const ownerInstId = ownerInst?.id || null;
      const buyMsg = `🏷️ ${buyerName} ønsker at købe "${listing.title}" til ${listing.price} kr.`;
      let convId = null;
      const orFind = buyerInstId
        ? `initiator_institution_id.eq.${buyerInstId},initiator_id.eq.${user.id}`
        : `initiator_id.eq.${user.id}`;
      const { data: existing } = await db.from('conversations').select('id,owner_unread').eq('listing_id', listing.id).or(orFind).maybeSingle();
      if (existing) {
        convId = existing.id;
      } else {
        const { data: conv } = await db.from('conversations').insert({
          listing_id: listing.id, listing_title: listing.title,
          listing_emoji: listing.emoji, listing_color: listing.color,
          listing_image: listing.images?.[0] || null,
          initiator_id: user.id, initiator_name: buyerName,
          initiator_institution_id: buyerInstId,
          owner_id: listing.user_id, owner_name: listing.institution_name,
          owner_institution_id: ownerInstId,
        }).select().single();
        convId = conv?.id;
      }
      if (convId) {
        await db.from('chat_messages').insert({ conversation_id: convId, sender_id: user.id, sender_name: buyerName, content: buyMsg });
        await db.from('conversations').update({ last_message: buyMsg, last_message_at: new Date().toISOString(), owner_unread: (existing?.owner_unread||0)+1 }).eq('id', convId);
        if (!existing && ownerInst?.email && ownerInst.email.toLowerCase() !== user.email.toLowerCase()) {
          fetch('/api/notify-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName: buyerName, listingTitle: listing.title, listingEmoji: listing.emoji || '🧸', convId }),
          }).catch(() => {});
        }
        if (setSelectedConvId) setSelectedConvId(convId);
      }
    } catch {}
    setSaving(false); setBuyModal(false); setBuyStep(1);
    showToast('Køb bekræftet! Sælger er notificeret via beskeder.');
    router.push('/beskeder');
  }

  async function handleBid() {
    if (!bidAmount) return;
    if (!currentUserId) { showToast('Log ind for at byde', 'error'); return; }
    if (listing.min_bid && Number(bidAmount) < listing.min_bid) {
      showToast(`Mindste bud er ${listing.min_bid} kr.`, 'error'); return;
    }
    setSaving(true);
    const newCount = bidCount + 1;
    try {
      const { data: { user } } = await db.auth.getUser();
      const { data: inst } = await db.from('institutions').select('id,name').ilike('email', user.email).maybeSingle();
      const userName = inst?.name || user.email;
      const bidderInstId = inst?.id || ctxInstId || null;
      const { data: ownerInst } = await db.from('institutions').select('id,email,name').eq('name', listing.institution_name).maybeSingle();
      const ownerInstId = ownerInst?.id || null;
      let convId = null; let ownerUnread = 0;
      const orFind = bidderInstId
        ? `initiator_institution_id.eq.${bidderInstId},initiator_id.eq.${currentUserId}`
        : `initiator_id.eq.${currentUserId}`;
      const { data: existing } = await db.from('conversations').select('id,owner_unread').eq('listing_id', listing.id).or(orFind).maybeSingle();
      if (existing) { convId = existing.id; ownerUnread = existing.owner_unread || 0; }
      else {
        const { data: conv } = await db.from('conversations').insert({
          listing_id: listing.id, listing_title: listing.title,
          listing_emoji: listing.emoji, listing_color: listing.color,
          listing_image: listing.images?.[0] || null,
          initiator_id: currentUserId, initiator_name: userName,
          initiator_institution_id: bidderInstId,
          owner_id: listing.user_id, owner_name: listing.institution_name,
          owner_institution_id: ownerInstId,
        }).select().single();
        convId = conv?.id;
      }
      if (convId) {
        const bidMsg = `Bud: ${bidAmount} kr.`;
        const { data: newBidMsg } = await db.from('chat_messages').insert({
          conversation_id: convId, sender_id: currentUserId, sender_name: userName,
          content: bidMsg, message_type: 'bid', bid_amount: Number(bidAmount), bid_status: 'pending',
        }).select().single();
        await db.from('conversations').update({ last_message: bidMsg, last_message_at: new Date().toISOString(), owner_unread: ownerUnread+1 }).eq('id', convId);
        await db.from('listings').update({ bid_count: newCount }).eq('id', listing.id);
        setBidCount(newCount); setBidModal(false); setSaving(false);
        if (newBidMsg) setExistingBid(newBidMsg);
        showToast(`Bud på ${bidAmount} kr. afsendt! 🎉`);
        if (!existing && ownerInst?.email && ownerInst.email.toLowerCase() !== currentUserEmail?.toLowerCase()) {
          fetch('/api/notify-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName: userName, listingTitle: listing.title, listingEmoji: listing.emoji || '🧸', convId }),
          }).catch(() => {});
        }
        if (setSelectedConvId) setSelectedConvId(convId);
        router.push('/beskeder'); return;
      }
    } catch(err) { console.error(err); }
    setSaving(false); setBidModal(false);
  }

  async function handleWithdrawBid() {
    if (!existingBid) return;
    if (!window.confirm('Træk dit bud tilbage?')) return;
    await db.from('chat_messages').update({ bid_status: 'withdrawn' }).eq('id', existingBid.id);
    const newCount = Math.max(0, bidCount - 1);
    await db.from('listings').update({ bid_count: newCount }).eq('id', listing.id);
    setBidCount(newCount); setExistingBid(null);
    showToast('Bud trukket tilbage');
  }

  async function handleSwap() {
    const chosen = ownListings.find(l => l.id === selectedSwapId);
    if (!chosen && !swapOffer.trim()) return;
    setSaving(true);
    const offerText = chosen ? `Bytteforslag: "${chosen.title}"` : `Bytteforslag: ${swapOffer}`;
    try {
      const { data:{ user } } = await db.auth.getUser();
      if (user) {
        const { data: inst } = await db.from('institutions').select('id,name').eq('email', user.email).maybeSingle();
        const userName = inst?.name || user.email;
        const swapperInstId = inst?.id || ctxInstId || null;
        const { data: swapOwnerInst } = await db.from('institutions').select('id').eq('name', listing.institution_name).maybeSingle();
        const swapOwnerInstId = swapOwnerInst?.id || null;
        const orSwapFind = swapperInstId
          ? `initiator_institution_id.eq.${swapperInstId},initiator_id.eq.${user.id}`
          : `initiator_id.eq.${user.id}`;
        const { data: existing } = await db.from('conversations')
          .select('id,owner_unread').eq('listing_id', listing.id).or(orSwapFind).maybeSingle();
        let convId = existing?.id;
        if (!convId) {
          const { data: conv } = await db.from('conversations').insert({
            listing_id: listing.id, listing_title: listing.title,
            listing_emoji: listing.emoji, listing_color: listing.color,
            listing_image: listing.images?.[0] || null,
            initiator_id: user.id, initiator_name: userName,
            initiator_institution_id: swapperInstId,
            owner_id: listing.user_id, owner_name: listing.institution_name,
            owner_institution_id: swapOwnerInstId,
          }).select().single();
          convId = conv?.id;
        }
        if (convId) {
          const swapContent = JSON.stringify({
            swap_listing_id: chosen?.id || null,
            swap_title: chosen?.title || null,
            swap_emoji: chosen?.emoji || null,
            swap_color: chosen?.color || null,
            swap_image: chosen?.images?.[0] || null,
            note: swapOffer.trim() || null,
          });
          const lastMsg = chosen ? `🔄 Bytteforslag: "${chosen.title}"` : `🔄 Bytteforslag: ${swapOffer}`;
          await db.from('chat_messages').insert({ conversation_id: convId, sender_id: user.id, sender_name: userName, content: swapContent, message_type: 'swap' });
          await db.from('conversations').update({ last_message: lastMsg, last_message_at: new Date().toISOString(), owner_unread: (existing?.owner_unread||0)+1 }).eq('id', convId);
          setSaving(false); setSwapModal(false); setSelectedSwapId(null); setSwapOffer('');
          showToast('Bytteforslag sendt!');
          if (setSelectedConvId) setSelectedConvId(convId);
          router.push('/beskeder');
          return;
        }
      }
    } catch {}
    setSaving(false); setSwapModal(false); setSelectedSwapId(null); setSwapOffer('');
    showToast('Bytteforslag sendt!');
  }

  const ww = useWindowWidth();
  const isMobile = ww < 768;

  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:PAPER }} className="page-enter">
      <div style={{ maxWidth:1140, margin:'0 auto', padding:'24px 16px 0' }}>
        <button onClick={()=>router.push('/opslag')} style={{ background:'none', border:'none', fontSize:14, fontWeight:600, color:INK3, cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:'8px 0', fontFamily:FONT }}>← Tilbage til markedsplads</button>
      </div>
      <div style={{ maxWidth:1140, margin:'0 auto', padding:isMobile?'16px 16px':'20px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 380px', gap:isMobile?24:40, alignItems:'start' }}>
          <div>
            <ImageGallery images={listing.images} color={listing.color} emoji={listing.emoji} />
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              <Badge type={listing.type} />
              <span style={{ fontSize:13, color:'#888' }}>📍 {listing.city}</span>
              <span style={{ fontSize:13, color:'#888' }}>👶 {listing.age_group}</span>
              <span style={{ fontSize:13, color:listing.condition==='Ny'?PRIMARY:'#888', fontWeight:600 }}>Stand: {listing.condition}</span>
            </div>
            <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?24:30, letterSpacing:'-0.03em', marginBottom:8, color:INK }}>{listing.title}</h1>
            <p style={{ color:INK3, fontSize:14, marginBottom:16, fontFamily:FONT }}>Opslået af <strong onClick={()=>goToInstitution(listing.institution_name)} style={{ color:PRIMARY, cursor:'pointer', textDecoration:'underline', textDecorationColor:GREEN_SOFT }}>{listing.institution_name}</strong></p>
            <p style={{ color:INK2, lineHeight:1.75, fontSize:15, marginBottom:isMobile?20:32, fontFamily:FONT }}>{listing.description}</p>
            {!isOwn && (
              <div style={{ background:GREEN_TINT, borderRadius:20, padding:isMobile?18:24, borderLeft:`3px solid ${PRIMARY}` }}>
                <h3 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, marginBottom:8, color:INK }}>Kontakt institutionen</h3>
                <p style={{ fontSize:13, color:INK3, marginBottom:16, lineHeight:1.55, fontFamily:FONT }}>Send en besked direkte til {listing.institution_name} for at aftale nærmere, byde en pris eller foreslå et bytte.</p>
                <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>onStartConv && onStartConv(listing)} style={{ padding:'12px 24px', width:'100%', justifyContent:'center', fontSize:15 }}>
                  💬 Åbn besked
                </Btn>
              </div>
            )}
            {isOwn && (
              <div style={{ background:GREEN_TINT, borderRadius:20, padding:20, border:`1.5px solid ${GREEN_SOFT}`, textAlign:'center' }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:PRIMARY, marginBottom:4 }}>Dit eget opslag</div>
                <div style={{ fontSize:13, color:INK3, fontFamily:FONT }}>Rediger det fra din dashboard</div>
              </div>
            )}
          </div>

          <div style={{ position:isMobile?'static':'sticky', top:96 }}>
            <div style={{ background:PAPER2, borderRadius:22, padding:28, border:`1px solid ${PAPER3}`, marginBottom:14 }}>
              {listing.price && <div style={{ fontFamily:FONT, fontWeight:800, fontSize:36, color:PRIMARY, marginBottom:8, letterSpacing:'-0.03em' }}>{listing.price} kr.</div>}
              {bidCount > 0 && <div style={{ color:INK3, fontSize:13, marginBottom:16, fontFamily:FONT }}><strong style={{ color:SKY }}>{bidCount} bud</strong> afgivet</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {!isOwn && listing.type==='køb' && <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>setBuyModal(true)} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>🏷️ Køb nu — {listing.price} kr.</Btn>}
                {!isOwn && listing.type==='byd' && <Btn variant="primary" color={ACCENT2} radius={22} onClick={()=>setBidModal(true)} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>📊 Afgiv bud</Btn>}
                {!isOwn && listing.type==='byt' && <Btn variant="primary" color={ACCENT} radius={22} onClick={()=>setSwapModal(true)} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>🔄 Foreslå bytte</Btn>}
                <button onClick={handleToggleFav} style={{ width:'100%', padding:'13px', borderRadius:22, border:`1.5px solid ${isFav?'#fca5a5':'#e5e5e5'}`, background:isFav?'#fff0f3':'#fff', color:isFav?'#e11d48':'#555', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.2s' }}>
                  {isFav ? '❤️ Gemt' : '🤍 Gem opslag'}
                  {localFavCount > 0 && <span style={{ background:isFav?'#fca5a5':'#eee', color:isFav?'#c0392b':'#888', borderRadius:99, padding:'1px 8px', fontSize:12 }}>{localFavCount}</span>}
                </button>
                {(currentUserId || loggedIn) && (
                  <button onClick={()=>setShareModal(true)} style={{ width:'100%', padding:'13px', borderRadius:22, border:'1.5px solid #e5e5e5', background:'#fff', color:'#555', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    📤 Del med medarbejder
                  </button>
                )}
              </div>
              <div style={{ borderTop:`1px solid ${PAPER3}`, marginTop:20, paddingTop:16, display:'flex', flexDirection:'column', gap:10 }}>
                {[['Institution',listing.institution_name,'inst'],['By',listing.city],['Aldersgruppe',listing.age_group],['Stand',listing.condition]].map(([label,val,key],i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontFamily:FONT }}>
                    <span style={{ color:INK3 }}>{label}</span>
                    <span onClick={key==='inst' ? ()=>goToInstitution(val) : undefined}
                      style={{ fontWeight:600, cursor:key==='inst'?'pointer':'default', color:key==='inst'?PRIMARY:INK2, textDecoration:key==='inst'?'underline':'none', textDecorationColor:GREEN_SOFT }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:GREEN_TINT, borderRadius:16, padding:'14px 18px', display:'flex', gap:12, alignItems:'center', borderLeft:`3px solid ${PRIMARY}` }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:PRIMARY, flexShrink:0 }} />
              <div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PRIMARY }}>CVR-verificeret institution</div>
                <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>Handler sker sikkert via platformen</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={buyModal} onClose={()=>{ setBuyModal(false); setBuyStep(1); }} title={buyStep===1?"Køb vare":"Er du sikker?"}>
        {buyStep===1 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:PAPER2, borderRadius:12, padding:16 }}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK }}>{listing.title}</div>
              <div style={{ color:INK3, fontSize:13, marginTop:4, fontFamily:FONT }}>{listing.institution_name} · {listing.city}</div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:600, fontFamily:FONT }}>
              <span style={{ color:INK2 }}>Pris</span>
              <span style={{ color:PRIMARY, fontWeight:800, fontSize:18 }}>{listing.price} kr.</span>
            </div>
            <div style={{ background:GREEN_TINT, border:`1px solid ${GREEN_SOFT}`, borderRadius:10, padding:'12px 14px', fontSize:13, color:INK2, fontFamily:FONT }}>Betaling og afhentning aftales direkte med institutionen efter bekræftelse.</div>
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>setBuyStep(2)} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>Fortsæt →</Btn>
            <Btn variant="ghost" onClick={()=>{ setBuyModal(false); setBuyStep(1); }} style={{ justifyContent:'center' }}>Annuller</Btn>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:GREEN_TINT, border:`2px solid ${PRIMARY}`, borderRadius:12, padding:16, textAlign:'center' }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:16, color:INK }}>Bekræft køb af</div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:PRIMARY, marginTop:4 }}>{listing.title}</div>
              <div style={{ fontWeight:800, fontSize:22, color:PRIMARY, marginTop:8, fontFamily:FONT }}>{listing.price} kr.</div>
              <div style={{ color:INK3, fontSize:13, marginTop:4, fontFamily:FONT }}>fra {listing.institution_name}</div>
            </div>
            <div style={{ fontSize:13, color:INK3, textAlign:'center', fontFamily:FONT }}>Sælger modtager en besked og kontakter dig for at aftale betaling og afhentning.</div>
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleBuy} disabled={saving} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>{saving?<><Spinner/>Sender…</>:'✅ Bekræft køb'}</Btn>
            <Btn variant="ghost" onClick={()=>setBuyStep(1)} style={{ justifyContent:'center' }}>← Tilbage</Btn>
          </div>
        )}
      </Modal>

      <Modal open={bidModal} onClose={()=>setBidModal(false)} title="Afgiv bud">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:PAPER2, borderRadius:12, padding:16 }}>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK }}>{listing.title}</div>
            <div style={{ color:INK3, fontSize:13, marginTop:4, fontFamily:FONT }}>{bidCount} nuværende bud{listing.min_bid ? ` · Mindste bud: ${listing.min_bid} kr.` : ''}</div>
          </div>
          {existingBid ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'#e8f0fb', border:`2px solid ${ACCENT2}`, borderRadius:12, padding:16, textAlign:'center' }}>
                <div style={{ fontSize:13, color:'#666', marginBottom:4 }}>Dit aktuelle bud</div>
                <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:26, color:ACCENT2 }}>{existingBid.bid_amount} kr.</div>
                <div style={{ fontSize:12, color:'#888', marginTop:4 }}>⏳ Afventer svar fra sælger</div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:8 }}>Opdater dit bud (kr.)</label>
                <input type="number" value={bidAmount} onChange={e=>setBidAmount(e.target.value)} placeholder={`Fx ${existingBid.bid_amount}`} style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:16, fontFamily:"'Nunito',sans-serif", fontWeight:700, outline:'none' }} />
                {listing.min_bid && bidAmount && Number(bidAmount) < listing.min_bid && <p style={{ fontSize:12, color:'#e11d48', marginTop:4 }}>Mindste bud er {listing.min_bid} kr.</p>}
              </div>
              <Btn variant="primary" color={ACCENT2} radius={22} onClick={async()=>{
                if (!bidAmount || (listing.min_bid && Number(bidAmount)<listing.min_bid)) return;
                setSaving(true);
                await db.from('chat_messages').update({ bid_amount: Number(bidAmount) }).eq('id', existingBid.id);
                setExistingBid(e => ({...e, bid_amount: Number(bidAmount)}));
                setSaving(false); setBidModal(false); setBidAmount('');
                showToast('Bud opdateret ✓');
              }} disabled={saving||!bidAmount} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>{saving?<><Spinner/>…</>:'Opdater bud'}</Btn>
              <Btn variant="ghost" onClick={handleWithdrawBid} style={{ justifyContent:'center', color:'#e11d48' }}>🗑️ Træk bud tilbage</Btn>
            </div>
          ) : (
            <>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:8 }}>Dit bud (kr.){listing.min_bid ? ` — minimum ${listing.min_bid} kr.` : ''}</label>
                <input type="number" value={bidAmount} onChange={e=>setBidAmount(e.target.value)} placeholder={listing.min_bid ? `Minimum ${listing.min_bid} kr.` : 'Fx 150'} min={listing.min_bid||1} style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:16, fontFamily:"'Nunito',sans-serif", fontWeight:700, outline:'none' }} />
                {listing.min_bid && bidAmount && Number(bidAmount) < listing.min_bid && <p style={{ fontSize:12, color:'#e11d48', marginTop:4 }}>Mindste bud er {listing.min_bid} kr.</p>}
              </div>
              <Btn variant="primary" color={ACCENT2} radius={22} onClick={handleBid} disabled={saving||!bidAmount||(listing.min_bid&&Number(bidAmount)<listing.min_bid)} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>{saving?<><Spinner/>Sender…</>:'Send bud'}</Btn>
            </>
          )}
          <Btn variant="ghost" onClick={()=>setBidModal(false)} style={{ justifyContent:'center' }}>Luk</Btn>
        </div>
      </Modal>

      <Modal open={swapModal} onClose={()=>{ setSwapModal(false); setSelectedSwapId(null); setSwapOffer(''); }} title="Foreslå bytte">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'#FCEAE6', borderRadius:12, padding:16, borderLeft:`3px solid ${CORAL}` }}>
            <div style={{ fontSize:13, color:CORAL, fontWeight:600, marginBottom:4, fontFamily:FONT }}>De tilbyder:</div>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK }}>{listing.title}</div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:10 }}>Vælg hvad I tilbyder i bytte:</label>
            {ownListings.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:220, overflowY:'auto' }}>
                {ownListings.map(l => (
                  <div key={l.id} onClick={()=>setSelectedSwapId(l.id===selectedSwapId?null:l.id)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, border:`2px solid ${selectedSwapId===l.id?ACCENT:'#e5e5e5'}`, background:selectedSwapId===l.id?'#FEF0E3':'#fff', cursor:'pointer', transition:'all 0.15s' }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:l.images?.[0]?'#e8e6e3':l.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                      {l.images?.[0] ? <img src={l.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : l.emoji||'🧸'}
                    </div>
                    <span style={{ fontWeight:600, fontSize:14 }}>{l.title}</span>
                    {selectedSwapId===l.id && <span style={{ marginLeft:'auto', color:ACCENT, fontSize:18 }}>✓</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background:'#f8f7f5', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#999', marginBottom:4 }}>Du har ingen aktive opslag at tilbyde — skriv det manuelt nedenfor.</div>
            )}
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6, color:'#888' }}>
              {ownListings.length > 0 ? 'Eller skriv en fri beskrivelse:' : 'Beskriv hvad I tilbyder:'}
            </label>
            <textarea value={swapOffer} onChange={e=>setSwapOffer(e.target.value)} placeholder="Fx: Vi tilbyder vores cykeltrailer i god stand…" rows={3} style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:14, resize:'none', fontFamily:"'Nunito Sans',sans-serif", outline:'none' }} />
          </div>
          <Btn variant="primary" color={ACCENT} radius={22} onClick={handleSwap} disabled={saving||(!selectedSwapId&&!swapOffer.trim())} style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>{saving?<><Spinner/>Sender…</>:'Send bytteforslag'}</Btn>
          <Btn variant="ghost" onClick={()=>{ setSwapModal(false); setSelectedSwapId(null); setSwapOffer(''); }} style={{ justifyContent:'center' }}>Annuller</Btn>
        </div>
      </Modal>

      {/* Other listings from same institution */}
      {instListings.length > 0 && (
        <div style={{ maxWidth:1140, margin:'0 auto', padding:isMobile?'24px 16px 40px':'32px 24px 56px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?18:22, color:INK, marginBottom:4 }}>
                Flere fra {listing.institution_name}
              </h2>
              <p style={{ fontSize:13, color:INK3, fontFamily:FONT }}>{instListings.length} {instListings.length === 1 ? 'opslag' : 'andre opslag'}</p>
            </div>
            <button onClick={()=>goToInstitution(listing.institution_name)}
              style={{ background:'none', border:`1.5px solid ${PAPER3}`, borderRadius:99, padding:'7px 16px', fontSize:13, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT, whiteSpace:'nowrap' }}>
              Se alle →
            </button>
          </div>
          <div style={{
            display:'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? 10 : 16,
          }}>
            {instListings.slice(0, isMobile ? 6 : 8).map(l => {
              const typeColors = { køb: { bg:'#EEF4FF', text:'#2563EB' }, byt: { bg:'#FFF3E8', text:'#C2551E' }, byd: { bg:'#F5F0FF', text:'#7C3AED' }, gratis: { bg:'#F0FFF4', text:'#15803D' } };
              const tc = typeColors[l.type] || { bg:PAPER3, text:INK3 };
              return (
                <div key={l.id} onClick={()=>setQuickViewListing?.(l)} style={{ cursor:'pointer', background:PAPER2, borderRadius:16, overflow:'hidden', border:`1px solid ${PAPER3}`, transition:'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(22,34,28,0.1)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}>
                  <div style={{ height: isMobile ? 120 : 160, background: l.images?.[0] ? '#e8e6e3' : (l.color||'#FFD166'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:isMobile?40:56, overflow:'hidden', position:'relative' }}>
                    {l.images?.[0]
                      ? <img src={l.images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : (l.emoji || '🧸')}
                    <div style={{ position:'absolute', top:8, left:8, background:tc.bg, color:tc.text, borderRadius:99, padding:'3px 9px', fontSize:10, fontWeight:700, fontFamily:FONT }}>
                      {l.type}
                    </div>
                  </div>
                  <div style={{ padding: isMobile ? '10px 10px 12px' : '12px 14px 16px' }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:isMobile?12:13, color:INK, marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.title}</div>
                    <div style={{ fontSize:11, color:INK3, fontFamily:FONT, marginBottom:4 }}>{l.condition} · {l.age_group}</div>
                    {l.price
                      ? <div style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?14:16, color:PRIMARY }}>{l.price} kr.</div>
                      : <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:GREEN_DEEP }}>Gratis</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {instListings.length > (isMobile ? 6 : 8) && (
            <div style={{ textAlign:'center', marginTop:20 }}>
              <button onClick={()=>goToInstitution(listing.institution_name)}
                style={{ background:GREEN_TINT, border:`1.5px solid ${GREEN_SOFT}`, borderRadius:99, padding:'11px 28px', fontSize:14, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>
                Se alle {instListings.length} opslag fra {listing.institution_name} →
              </button>
            </div>
          )}
        </div>
      )}

      <Modal open={shareModal} onClose={()=>{ setShareModal(false); setSelectedEmails([]); setShareNote(''); }} title="Del med medarbejder">
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'#f8f7f5', borderRadius:12, padding:14, display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ width:44, height:44, borderRadius:10, background:listing.images?.[0]?'#e8e6e3':listing.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0, overflow:'hidden' }}>
              {listing.images?.[0] ? <img src={listing.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : listing.emoji||'🧸'}
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>{listing.title}</div>
              <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{listing.institution_name} · {listing.city}</div>
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, marginBottom:8, color:'#555' }}>Vælg medarbejdere</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:200, overflowY:'auto' }}>
              {teamMembers.filter(m => m.email !== currentUserEmail).map(m => {
                const sel = selectedEmails.includes(m.email);
                return (
                  <div key={m.id} onClick={()=>setSelectedEmails(es => sel ? es.filter(e=>e!==m.email) : [...es, m.email])}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, border:`2px solid ${sel?PRIMARY:'#e5e5e5'}`, background:sel?'#e8f5ee':'#fff', cursor:'pointer', transition:'all 0.15s' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:'#e8f0fb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:ACCENT2, flexShrink:0 }}>
                      {m.email.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.email}</div>
                      {m.role === 'admin' && <div style={{ fontSize:11, color:'#aaa' }}>Admin</div>}
                    </div>
                    {sel && <span style={{ color:PRIMARY, fontSize:18, flexShrink:0 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, marginBottom:6, color:'#555' }}>Tilføj besked <span style={{ fontWeight:400, color:'#aaa' }}>(valgfri)</span></label>
            <textarea value={shareNote} onChange={e=>setShareNote(e.target.value)} placeholder="Fx: Hvad synes I om dette?" rows={2} style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #e5e5e5', fontSize:14, resize:'none', fontFamily:"'Nunito Sans',sans-serif", outline:'none' }} />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>{ setShareModal(false); setSelectedEmails([]); setShareNote(''); }} style={{ flex:1, padding:'12px', borderRadius:12, background:'#f5f4f2', border:'none', fontWeight:700, cursor:'pointer', fontFamily:"'Nunito',sans-serif" }}>Annuller</button>
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleShare} disabled={shareSending||!selectedEmails.length} style={{ flex:2, justifyContent:'center', padding:'12px', fontSize:14 }}>
              {shareSending ? <><Spinner/>Sender…</> : `📤 Del${selectedEmails.length ? ` med ${selectedEmails.length}` : ''}`}
            </Btn>
          </div>
        </div>
      </Modal>

    </div>
  );
}
