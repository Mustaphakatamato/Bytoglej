'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, SKY, ACCENT, ACCENT2, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'Lige nu';
  if (mins < 60) return `${mins} min. siden`;
  if (hours < 24) return `${hours} time${hours > 1 ? 'r' : ''} siden`;
  if (days === 1) return 'I går';
  if (days < 30) return `${days} dag${days > 1 ? 'e' : ''} siden`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} uge${weeks > 1 ? 'r' : ''} siden`;
  const months = Math.floor(days / 30);
  return `${months} måned${months > 1 ? 'er' : ''} siden`;
}
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Badge, Btn, Spinner, Modal } from '@/components/ui';
import { authedFetch } from '@/lib/authed-fetch';

function ImageGallery({ images, color, emoji, title }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const w = useWindowWidth();
  const imgH = w < 500 ? 260 : w < 768 ? 320 : 380;
  if (!images || images.length === 0) {
    return <div style={{ height:imgH, background:color||'#FFD166', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, fontSize:100 }}>{emoji||'🧸'}</div>;
  }
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ position:'relative', height:imgH, borderRadius:20, overflow:'hidden', background:'#f5f5f5' }}>
        <img src={images[active]} alt={title || ''} onClick={()=>setLightbox(true)} style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', cursor:'zoom-in' }} />
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
          <img src={images[active]} alt={title || ''} onClick={e=>e.stopPropagation()} style={{ maxWidth:'92vw', maxHeight:'88vh', objectFit:'contain', borderRadius:10, boxShadow:'0 8px 48px rgba(0,0,0,0.5)' }} />
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
  const { activeListing: listing, setActiveListing, favs, toggleFav, setSelectedConvId, showToast, loggedIn, isAdmin, addToCart, cart } = useApp();
  const { isAdminView: ctxIsAdmin, adminInstName, institution: ctxInstitution, institutionId: ctxInstId } = useActiveUser();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const inCart = cart?.some(c => c.listingId === listing?.id);
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
  const [adminEditModal, setAdminEditModal] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState(null);
  const [adminEditSaving, setAdminEditSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [shareNote, setShareNote] = useState('');
  const [shareSending, setShareSending] = useState(false);
  const [myInstName, setMyInstName] = useState(null);
  const [existingBid, setExistingBid] = useState(null);
  const [instListings, setInstListings] = useState([]);
  const [favoriters, setFavoriters] = useState([]);
  const [expandDesc, setExpandDesc] = useState(false);
  const [trustScore,       setTrustScore]       = useState(null);
  const [shareDropdown,    setShareDropdown]    = useState(false);
  const [linkCopied,       setLinkCopied]       = useState(false);
  const [isFollowing,      setIsFollowing]      = useState(false);
  const [followLoading,    setFollowLoading]    = useState(false);
  const [søgesModal,       setSøgesModal]       = useState(false);
  const [søgesOffer,       setSøgesOffer]       = useState('');
  const [søgesSelectedId,  setSøgesSelectedId]  = useState(null);
  const [reportModal,      setReportModal]      = useState(false);
  const [reportReason,     setReportReason]     = useState('');
  const [reportNote,       setReportNote]       = useState('');
  const [reportSending,    setReportSending]    = useState(false);

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

  const isOwn = !!(
    (ctxInstitution && listing?.institution_name?.toLowerCase() === ctxInstitution.name?.toLowerCase()) ||
    (currentUserId && listing?.user_id === currentUserId)
  );

  useEffect(() => { if (listing) setIsFav(favs?.includes(listing.id) || false); }, [favs, listing?.id]);

  useEffect(() => {
    if (!listing || !isOwn) return;
    db.from('listing_favorites').select('institution_name,created_at').eq('listing_id', listing.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setFavoriters(data); });
  }, [listing?.id, isOwn]);

  useEffect(() => {
    if (!listing?.institution_name) return;
    db.from('transaction_reviews')
      .select('description_score, contact_score')
      .eq('reviewed_institution_name', listing.institution_name)
      .then(({ data }) => {
        if (!data || data.length < 3) return;
        const avg = data.reduce((s,r) => s + (r.description_score + r.contact_score) / 2, 0) / data.length;
        setTrustScore({ pct: Math.round((avg / 3) * 100), count: data.length });
      });
  }, [listing?.institution_name]);

  useEffect(() => {
    if (!listing?.institution_name) return;
    db.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      db.from('institution_follows')
        .select('id')
        .eq('follower_user_id', user.id)
        .eq('institution_name', listing.institution_name)
        .maybeSingle()
        .then(({ data }) => setIsFollowing(!!data));
    });
  }, [listing?.institution_name]);

  async function handleFollow() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) { showToast('Log ind for at følge', 'error'); return; }
    setFollowLoading(true);
    if (isFollowing) {
      await db.from('institution_follows').delete().eq('follower_user_id', user.id).eq('institution_name', listing.institution_name);
      setIsFollowing(false);
    } else {
      await db.from('institution_follows').insert({ follower_user_id: user.id, institution_name: listing.institution_name });
      setIsFollowing(true);
      showToast(`Du følger nu ${listing.institution_name} ⭐`);
    }
    setFollowLoading(false);
  }

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
    if (listing.institution_name?.toLowerCase() === userName?.toLowerCase()) {
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
        authedFetch('/api/notify-message', {
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

  async function handleSøgesMatch() {
    if (!søgesOffer.trim() && !søgesSelectedId) return;
    setSaving(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: myInst } = await db.from('institutions').select('id,name').ilike('email', user.email).maybeSingle();
      const userName = myInst?.name || user.email;
      const myInstId = myInst?.id || null;
      const { data: ownerInstData } = await db.from('institutions').select('id,email,name').eq('name', listing.institution_name).maybeSingle();
      const ownerInstId = ownerInstData?.id || null;

      const { data: existing } = await db.from('conversations')
        .select('id').eq('listing_id', listing.id)
        .or(myInstId ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${user.id}` : `initiator_id.eq.${user.id}`)
        .maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: conv } = await db.from('conversations').insert({
          listing_id: listing.id, listing_title: listing.title,
          listing_emoji: listing.emoji, listing_color: listing.color,
          listing_image: listing.images?.[0] || null,
          initiator_id: user.id, initiator_name: userName, initiator_institution_id: myInstId,
          owner_id: listing.user_id, owner_name: listing.institution_name, owner_institution_id: ownerInstId,
        }).select().single();
        convId = conv?.id;
      }

      if (convId) {
        const selectedListing = ownListings.find(l => l.id === søgesSelectedId);
        let content, msgType;
        if (selectedListing) {
          content = JSON.stringify({
            swap_listing_id: selectedListing.id,
            swap_title:      selectedListing.title,
            swap_image:      selectedListing.images?.[0] || null,
            swap_color:      selectedListing.color || '#FFD166',
            swap_emoji:      selectedListing.emoji || '🧸',
            note:            søgesOffer.trim() || null,
          });
          msgType = 'swap';
        } else {
          content = søgesOffer.trim() || 'Hej! Jeg har noget der måske matcher dit søges-opslag.';
          msgType = null;
        }

        await db.from('chat_messages').insert({ conversation_id: convId, sender_id: user.id, sender_name: userName, content, message_type: msgType });
        const lastMsg = selectedListing ? `Tilbyder: ${selectedListing.title}` : content;
        await db.from('conversations').update({ last_message: lastMsg, last_message_at: new Date().toISOString(), owner_unread: 1 }).eq('id', convId);

        if (ownerInstData?.email && ownerInstData.email.toLowerCase() !== user.email.toLowerCase()) {
          authedFetch('/api/notify-message', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ ownerEmail: ownerInstData.email, ownerName: ownerInstData.name, senderName: userName, listingTitle: listing.title, listingEmoji: listing.emoji || '🔍', convId }),
          }).catch(() => {});
        }
        setSøgesModal(false); setSøgesOffer(''); setSøgesSelectedId(null);
        setSelectedConvId(convId); router.push('/beskeder');
      }
    } catch (e) { showToast('Noget gik galt — prøv igen', 'error'); }
    setSaving(false);
  }

  function handleAddToCart() {
    if (isOwn) { showToast('Du kan ikke købe dit eget opslag', 'error'); return; }
    if (!loggedIn) { router.push('/login'); return; }
    if (inCart) { router.push('/indkøbsvogn'); return; }
    addToCart({
      listingId: listing.id,
      listingTitle: listing.title,
      listingEmoji: listing.emoji || '🧸',
      listingColor: listing.color,
      price: listing.price,
      category: listing.category,
      images: listing.images || [],
      ownerInstitutionName: listing.institution_name,
      ownerId: listing.user_id,
    });
    showToast(`"${listing.title}" lagt i kurven 🛒`);
    router.push('/indkøbsvogn');
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
          authedFetch('/api/notify-message', {
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

  return (
    <>
    <div style={{ minHeight:'100vh', paddingTop:80, background:PAPER }} className="page-enter">
      <div style={{ maxWidth:1140, margin:'0 auto', padding:'16px 16px 0' }}>
        <button onClick={()=>router.push('/opslag')} style={{ background:'none', border:'none', fontSize:13, fontWeight:600, color:INK3, cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:'8px 0', fontFamily:FONT }}>← Markedsplads</button>
      </div>
      <div style={{ maxWidth:1140, margin:'0 auto', padding: isMobile ? '16px 16px' : '20px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 420px', gap: isMobile ? 24 : 48, alignItems:'start' }}>

          {/* LEFT: Gallery */}
          <div>
            <ImageGallery images={listing.images} color={listing.color} emoji={listing.emoji} title={listing.title} />
            {/* "Dit eget opslag" + rediger on mobile only */}
            {isOwn && isMobile && (
              <div style={{ background:GREEN_TINT, borderRadius:16, padding:'14px 18px', marginTop:16 }}>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PRIMARY, marginBottom:10, textAlign:'center' }}>Dit eget opslag</div>
                <button onClick={()=>router.push(`/rediger-opslag/${listing.id}`)} style={{ width:'100%', padding:'11px', borderRadius:14, background:PRIMARY, border:'none', color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>Rediger opslag</button>
              </div>
            )}
            {/* Bundttilbud hint (not own, not mobile) */}
            {!isOwn && !isMobile && (
              <div style={{ background:PAPER2, borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, border:`1px solid ${PAPER3}`, marginTop:16 }}>
                <span style={{ fontSize:22, flexShrink:0 }}>📦</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:INK, marginBottom:2 }}>Vil du lave et bundttilbud?</div>
                  <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>
                    Gå til <strong onClick={()=>goToInstitution(listing.institution_name)} style={{ color:PRIMARY, cursor:'pointer' }}>{listing.institution_name}s side</strong> for at vælge flere ting.
                  </div>
                </div>
                <button onClick={()=>goToInstitution(listing.institution_name)} style={{ background:PRIMARY, border:'none', borderRadius:99, padding:'7px 12px', fontSize:11, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:FONT, whiteSpace:'nowrap', flexShrink:0 }}>Se side →</button>
              </div>
            )}
            {/* Admin */}
            {isAdmin && (
              <div style={{ background:'#FFF7ED', borderRadius:20, padding:20, border:`1.5px solid #FDBA74`, marginTop:16 }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:'#B45309', marginBottom:12 }}>⚙ Admin</div>
                <button onClick={() => { setAdminEditForm({ title: listing.title||'', description: listing.description||'', price: listing.price||'', condition: listing.condition||'', is_active: listing.is_active }); setAdminEditModal(true); }}
                  style={{ width:'100%', padding:'11px', borderRadius:14, background:'#B45309', border:'none', color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                  Rediger opslag
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Info + Actions */}
          <div style={{ position: isMobile ? 'static' : 'sticky', top: 96 }}>
            {/* Institution name + follow */}
            <div style={{ fontSize:12, color:INK3, fontFamily:FONT, marginBottom:8, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <span onClick={()=>goToInstitution(listing.institution_name)} style={{ color:PRIMARY, cursor:'pointer', fontWeight:600, textDecoration:'underline', textDecorationColor:'transparent' }}
                onMouseEnter={e=>e.target.style.textDecorationColor=PRIMARY} onMouseLeave={e=>e.target.style.textDecorationColor='transparent'}>
                {listing.institution_name}
              </span>
              {listing.city && <span>· {listing.city}</span>}
              {!isOwn && (
                <button onClick={handleFollow} disabled={followLoading}
                  style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:99, border:`1.5px solid ${isFollowing ? PRIMARY : '#ccc'}`, background: isFollowing ? GREEN_TINT : '#fff', color: isFollowing ? PRIMARY : INK3, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FONT, transition:'all 0.2s', flexShrink:0 }}>
                  {isFollowing ? '✓ Følger' : '+ Følg'}
                </button>
              )}
            </div>

            {/* Title */}
            <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize: isMobile ? 22 : 28, letterSpacing:'-0.03em', marginBottom:12, color:INK, lineHeight:1.2 }}>{listing.title}</h1>

            {/* Badges */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              <Badge type={listing.type} />
              {listing.condition && <span style={{ background:PAPER2, color:INK2, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{listing.condition}</span>}
              {listing.age_group && <span style={{ background:PAPER2, color:INK3, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:600, fontFamily:FONT }}>👶 {listing.age_group}</span>}
              {(() => {
                const so = listing.shipping_options?.[0];
                if (!so && !listing.can_ship) return null;
                const badges = [];
                if (so?.allow_pickup) badges.push({ icon:'📍', label:'Afhentes', bg:'#F0FDF4', color:'#16a34a' });
                if (so?.allow_shipping || (!so && listing.can_ship)) badges.push({ icon:'📦', label:'Kan sendes', bg:'#EFF6FF', color:'#2563EB' });
                if (so?.allow_custom) badges.push({ icon:'🤝', label:'Aftalt levering', bg:'#FEF9C3', color:'#92400e' });
                return badges.map(b => <span key={b.label} style={{ background:b.bg, color:b.color, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{b.icon} {b.label}</span>);
              })()}
            </div>

            {/* Description with expand */}
            {listing.description && (
              <div style={{ marginBottom:16 }}>
                <p style={{ color:INK2, fontSize:14, lineHeight:1.7, fontFamily:FONT, margin:0,
                  display: expandDesc ? 'block' : '-webkit-box',
                  WebkitLineClamp: expandDesc ? undefined : 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: expandDesc ? 'visible' : 'hidden',
                }}>{listing.description}</p>
                {listing.description.length > 160 && (
                  <button onClick={()=>setExpandDesc(e=>!e)} style={{ background:'none', border:'none', color:PRIMARY, fontSize:13, fontWeight:700, cursor:'pointer', padding:'4px 0', fontFamily:FONT }}>
                    {expandDesc ? 'Læs mindre ↑' : 'Læs mere ↓'}
                  </button>
                )}
              </div>
            )}

            {/* Price */}
            <div style={{ marginBottom:16 }}>
              {listing.price
                ? <div>
                    {listing.original_price && listing.original_price > listing.price && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:INK3, textDecoration:'line-through' }}>{listing.original_price} kr.</span>
                        <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12, background:'#FEE2E2', color:'#e11d48', borderRadius:99, padding:'2px 8px' }}>
                          -{Math.round((1 - listing.price / listing.original_price) * 100)}%
                        </span>
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
                      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:32, color: listing.original_price && listing.original_price > listing.price ? '#e11d48' : PRIMARY, letterSpacing:'-0.03em' }}>{listing.price} kr.</div>
                      {(() => {
                        const so = listing.shipping_options?.[0];
                        if (!so?.allow_shipping) return null;
                        return so.shipping_included_in_price
                          ? <span style={{ fontSize:13, fontWeight:700, color:'#16a34a', background:'#F0FDF4', borderRadius:99, padding:'4px 12px', border:'1px solid #86efac', fontFamily:FONT }}>inkl. fragt</span>
                          : <span style={{ fontSize:13, fontWeight:700, color:'#2563EB', background:'#EFF6FF', borderRadius:99, padding:'4px 12px', border:'1px solid #93c5fd', fontFamily:FONT }}>+ fragt</span>;
                      })()}
                    </div>
                  </div>
                : listing.type === 'byt' ? <div style={{ fontSize:20, color:CORAL, fontWeight:800, fontFamily:FONT }}>Byttes kun</div>
                : <div style={{ fontSize:20, color:ACCENT2, fontWeight:800, fontFamily:FONT }}>Afgiv bud</div>}
              {bidCount > 0 && <div style={{ color:INK3, fontSize:12, fontFamily:FONT, marginTop:4 }}>{bidCount} bud afgivet</div>}
              {listing.type === 'byd' && listing.min_bid && <div style={{ color:INK3, fontSize:12, fontFamily:FONT }}>Mindstebud: {listing.min_bid} kr.</div>}
            </div>

            {/* Action buttons */}
            {!isOwn ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                {listing.type==='køb' && <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleAddToCart} style={{ justifyContent:'center', padding:'15px', fontSize:16 }}>{inCart ? '🛒 Gå til kurv →' : (() => { const so = listing.shipping_options?.[0]; const tag = so?.allow_shipping ? (so.shipping_included_in_price ? ' inkl. fragt' : ' + fragt') : ''; return `🛒 Læg i kurv — ${listing.price} kr.${tag}`; })()}</Btn>}
                {listing.type==='byd' && <Btn variant="primary" color={ACCENT2} radius={22} onClick={()=>setBidModal(true)} style={{ justifyContent:'center', padding:'15px', fontSize:16 }}>📊 Afgiv bud</Btn>}
                {listing.type==='byt' && <Btn variant="primary" color={ACCENT} radius={22} onClick={()=>setSwapModal(true)} style={{ justifyContent:'center', padding:'15px', fontSize:16 }}>🔄 Foreslå bytte</Btn>}
                {listing.type==='søges' && <button onClick={()=>setSøgesModal(true)}
                  style={{ width:'100%', padding:'15px', borderRadius:22, border:'none', background:'#7C3AED', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:FONT, transition:'all 0.2s' }}>
                  🎯 Jeg har noget der matcher
                </button>}
                <button onClick={()=>onStartConv && onStartConv(listing)}
                  style={{ width:'100%', padding:'13px', borderRadius:22, border:`1.5px solid ${PRIMARY}`, background:'#fff', color:PRIMARY, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:FONT, transition:'all 0.2s' }}>
                  💬 Skriv til sælger
                </button>
              </div>
            ) : (
              <div style={{ background:GREEN_TINT, borderRadius:16, padding:'16px 20px', marginBottom:20 }}>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PRIMARY, marginBottom:12, textAlign:'center' }}>Dit eget opslag</div>
                <button onClick={()=>router.push(`/rediger-opslag/${listing.id}`)} style={{ width:'100%', padding:'12px', borderRadius:14, background:PRIMARY, border:'none', color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer', marginBottom: favoriters.length ? 12 : 0 }}>Rediger opslag</button>
                {favoriters.length > 0 && (
                  <div style={{ borderTop:`1px solid ${GREEN_SOFT}`, paddingTop:12, marginTop:4 }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:PRIMARY, marginBottom:8 }}>❤️ {favoriters.length} {favoriters.length===1?'institution har gemt':'institutioner har gemt'} dit opslag</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {favoriters.map((f,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:26, height:26, borderRadius:8, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:FONT, fontWeight:800, fontSize:11, flexShrink:0 }}>{(f.institution_name||'?').charAt(0).toUpperCase()}</div>
                          <span style={{ fontFamily:FONT, fontSize:12, fontWeight:600, color:INK }}>{f.institution_name||'Ukendt'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Trust checkmarks */}
            <div style={{ display:'flex', gap:isMobile?10:16, flexWrap:'wrap', marginBottom:16 }}>
              {[
                '✓ CVR-verificeret',
                '✓ Sikker handel',
                listing.created_at ? `✓ ${timeAgo(listing.created_at)}` : null,
              ].filter(Boolean).map((item, i) => (
                <span key={i} style={{ fontSize:11, color:PRIMARY, fontWeight:700, fontFamily:FONT }}>{item}</span>
              ))}
            </div>

            {/* Heart + share */}
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              <button onClick={handleToggleFav}
                style={{ flex:2, padding:'11px 8px', borderRadius:16, border:`1.5px solid ${isFav?'#fca5a5':'#e5e5e5'}`, background:isFav?'#fff0f3':'#fff', color:isFav?'#e11d48':'#555', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:FONT, transition:'all 0.2s' }}>
                {isFav ? '❤️ Gemt' : '🤍 Gem'}
                {localFavCount > 0 && <span style={{ background:isFav?'#fca5a5':'#eee', color:isFav?'#c0392b':'#888', borderRadius:99, padding:'1px 7px', fontSize:11 }}>{localFavCount}</span>}
              </button>
              <button onClick={()=>{ navigator.clipboard.writeText(window.location.href).catch(()=>{}); setLinkCopied(true); setTimeout(()=>setLinkCopied(false),2200); }}
                style={{ flex:1, padding:'11px 8px', borderRadius:16, border:'1.5px solid #e5e5e5', background:'#fff', color:linkCopied?PRIMARY:'#555', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontFamily:FONT, transition:'all 0.2s' }}>
                {linkCopied ? '✓' : '🔗'}
              </button>
              {(currentUserId || loggedIn) && teamMembers.length > 0 && (
                <button onClick={()=>setShareModal(true)}
                  style={{ flex:1, padding:'11px 8px', borderRadius:16, border:'1.5px solid #e5e5e5', background:'#fff', color:'#555', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontFamily:FONT }}>
                  👥
                </button>
              )}
              <button onClick={()=>{ window.location.href=`mailto:?subject=${encodeURIComponent(listing.title)}&body=${encodeURIComponent('Kig på dette opslag: '+window.location.href)}`; }}
                style={{ flex:1, padding:'11px 8px', borderRadius:16, border:'1.5px solid #e5e5e5', background:'#fff', color:'#555', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontFamily:FONT }}>
                📧
              </button>
            </div>
            {!isOwn && (
              <button onClick={()=>setReportModal(true)} style={{ background:'none', border:'none', fontSize:12, color:INK3, cursor:'pointer', fontFamily:FONT, padding:'4px 0', textDecoration:'underline', textDecorationColor:PAPER3, marginBottom:4 }}>
                Rapportér opslag
              </button>
            )}

            {/* Metadata box */}
            <div style={{ background:PAPER2, borderRadius:18, padding:'16px 20px', border:`1px solid ${PAPER3}`, marginBottom:14 }}>
              {[
                ['Institution', listing.institution_name, 'inst'],
                ['By', listing.city],
                ['Aldersgruppe', listing.age_group],
                ['Stand', listing.condition],
                listing.created_at ? ['Opslået', timeAgo(listing.created_at)] : null,
              ].filter(Boolean).map(([label, val, key], i, arr) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontFamily:FONT, padding:'7px 0', borderBottom: i < arr.length - 1 ? `1px solid ${PAPER3}` : 'none' }}>
                  <span style={{ color:INK3 }}>{label}</span>
                  <span onClick={key==='inst' ? ()=>goToInstitution(val) : undefined}
                    style={{ fontWeight:600, cursor:key==='inst'?'pointer':'default', color: key==='inst' ? PRIMARY : INK2, textDecoration:key==='inst'?'underline':'none', textDecorationColor:GREEN_SOFT }}>
                    {val}
                  </span>
                </div>
              ))}
            </div>

            {/* Delivery options */}
            {(() => {
              const so = listing.shipping_options?.[0];
              if (!so && !listing.can_ship) return null;
              const rows = [];
              if (so?.allow_pickup) rows.push({ icon:'📍', label:'Afhentes', color:'#16a34a', bg:'#F0FDF4', detail: so.pickup_address || null, sub: so.pickup_hours?.text || so.pickup_notes || null });
              if (so?.allow_shipping || (!so && listing.can_ship)) rows.push({ icon:'📦', label:'Sendes med pakkepost', color:'#2563EB', bg:'#EFF6FF', detail: so?.shipping_size_category ? `Pakkestr.: ${so.shipping_size_category}` : null, subChip: so?.shipping_included_in_price == null ? null : (so?.shipping_included_in_price ? { text:'Porto inkluderet i prisen', bg:'#F0FDF4', color:'#16a34a', border:'#86efac' } : { text:'Porto betales af køber', bg:'#FEF9C3', color:'#92400e', border:'#fde047' }) });
              if (so?.allow_custom) rows.push({ icon:'🤝', label:'Aftalt levering', color:'#92400e', bg:'#FEF9C3', detail: 'Aftales individuelt', sub: null });
              if (!rows.length) return null;
              return (
                <div style={{ background:PAPER2, borderRadius:18, padding:'16px 20px', border:`1px solid ${PAPER3}`, marginBottom:14 }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK, marginBottom:12 }}>Leveringsmuligheder</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {rows.map(r => (
                      <div key={r.label} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', background:r.bg, borderRadius:12 }}>
                        <span style={{ fontSize:18, flexShrink:0, marginTop:1 }}>{r.icon}</span>
                        <div>
                          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:r.color }}>{r.label}</div>
                          {r.detail && <div style={{ fontSize:12, color:INK3, fontFamily:FONT, marginTop:2 }}>{r.detail}</div>}
                          {r.sub && <div style={{ fontSize:11, color:INK3, fontFamily:FONT, marginTop:1 }}>{r.sub}</div>}
                          {r.subChip && <span style={{ display:'inline-block', marginTop:5, fontSize:11, fontWeight:700, color:r.subChip.color, background:r.subChip.bg, border:`1px solid ${r.subChip.border}`, borderRadius:99, padding:'2px 9px', fontFamily:FONT }}>{r.subChip.text}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* CVR badge */}
            <div style={{ background:GREEN_TINT, borderRadius:14, padding:'12px 16px', display:'flex', gap:10, alignItems:'center', borderLeft:`3px solid ${PRIMARY}`, marginBottom: trustScore ? 10 : 0 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:PRIMARY, flexShrink:0 }} />
              <div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:PRIMARY }}>CVR-verificeret institution</div>
                <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>Handler sker sikkert via platformen</div>
              </div>
            </div>

            {/* Trust score */}
            {trustScore && (
              <div style={{ background:PAPER2, borderRadius:14, padding:'12px 16px', border:`1px solid ${PAPER3}`, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:PRIMARY, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:'#fff', lineHeight:1 }}>{trustScore.pct}%</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.75)', fontFamily:FONT, fontWeight:600 }}>Tillid</div>
                </div>
                <div>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK }}>Tillidsrating</div>
                  <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>Baseret på {trustScore.count} anmeldelse{trustScore.count!==1?'r':''}</div>
                </div>
              </div>
            )}

            {/* Mobile: bundttilbud */}
            {!isOwn && isMobile && (
              <div style={{ background:PAPER2, borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, border:`1px solid ${PAPER3}`, marginTop:14 }}>
                <span style={{ fontSize:20, flexShrink:0 }}>📦</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:INK, marginBottom:2 }}>Vil du lave et bundttilbud?</div>
                  <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>Gå til <strong onClick={()=>goToInstitution(listing.institution_name)} style={{ color:PRIMARY, cursor:'pointer' }}>{listing.institution_name}s side</strong></div>
                </div>
                <button onClick={()=>goToInstitution(listing.institution_name)} style={{ background:PRIMARY, border:'none', borderRadius:99, padding:'7px 12px', fontSize:11, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:FONT, whiteSpace:'nowrap', flexShrink:0 }}>Se →</button>
              </div>
            )}
          </div>

        </div>
      </div>

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
                <div key={l.id} onClick={()=>{ setActiveListing(l); router.push('/opslag/detail'); }} style={{ cursor:'pointer', background:PAPER2, borderRadius:16, overflow:'hidden', border:`1px solid ${PAPER3}`, transition:'transform 0.15s, box-shadow 0.15s' }}
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

    {/* Rapport modal */}
    <Modal open={reportModal} onClose={()=>{ setReportModal(false); setReportReason(''); setReportNote(''); }} title="Rapportér opslag">
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <p style={{ fontSize:13, color:INK3, fontFamily:FONT, margin:0 }}>Hjælp os med at holde platformen tryg. Vi gennemgår alle rapporter.</p>
        <div>
          <label style={{ display:'block', fontSize:13, fontWeight:700, color:INK2, fontFamily:FONT, marginBottom:8 }}>Årsag <span style={{ color:'#e53e3e' }}>*</span></label>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {['Misvisende beskrivelse','Upassende indhold','Forbudt genstand','Spam eller duplikat','Andet'].map(r => (
              <button key={r} type="button" onClick={()=>setReportReason(r)}
                style={{ padding:'10px 14px', borderRadius:12, border:`2px solid ${reportReason===r?'#e11d48':'rgba(22,34,28,0.1)'}`, background:reportReason===r?'#FFF0F3':'#fff', color:reportReason===r?'#e11d48':INK2, fontSize:13, fontWeight:reportReason===r?700:500, cursor:'pointer', textAlign:'left', fontFamily:FONT, transition:'all 0.12s' }}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display:'block', fontSize:13, fontWeight:700, color:INK2, fontFamily:FONT, marginBottom:6 }}>Tilføj note <span style={{ fontWeight:400, color:INK3 }}>(valgfri)</span></label>
          <textarea value={reportNote} onChange={e=>setReportNote(e.target.value)} placeholder="Beskriv problemet kort…" rows={2}
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:`1.5px solid ${PAPER3}`, fontSize:13, outline:'none', fontFamily:FONT, background:'#fff', color:INK, boxSizing:'border-box', resize:'vertical' }} />
        </div>
        <Btn variant="primary" color="#e11d48" radius={22} onClick={async()=>{
          if (!reportReason) return;
          setReportSending(true);
          try {
            const { data:{ user } } = await db.auth.getUser();
            const { data: inst } = user ? await db.from('institutions').select('name').ilike('email', user.email).maybeSingle() : { data: null };
            await fetch('/api/report-listing', { method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ listingId:listing.id, listingTitle:listing.title, reason:reportReason, note:reportNote, reporterName:inst?.name||user?.email||'Ukendt' }) });
          } catch {}
          setReportSending(false); setReportModal(false); setReportReason(''); setReportNote('');
          showToast('Tak — vi kigger på det hurtigst muligt');
        }} disabled={reportSending||!reportReason} style={{ justifyContent:'center', padding:'13px', fontSize:14 }}>
          {reportSending ? <><Spinner/>Sender…</> : 'Send rapport'}
        </Btn>
        <Btn variant="ghost" onClick={()=>{ setReportModal(false); setReportReason(''); setReportNote(''); }} style={{ justifyContent:'center' }}>Annuller</Btn>
      </div>
    </Modal>

    {/* Søges match modal */}
    <Modal open={søgesModal} onClose={()=>{ setSøgesModal(false); setSøgesOffer(''); setSøgesSelectedId(null); }} title="Jeg har noget der matcher 🎯">
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {ownListings.length > 0 && (
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:INK2, fontFamily:FONT, marginBottom:10 }}>Vælg et af dine opslag <span style={{ fontWeight:400, color:INK3 }}>(valgfri)</span></div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:240, overflowY:'auto' }}>
              {ownListings.map(l => {
                const sel = søgesSelectedId === l.id;
                return (
                  <div key={l.id} onClick={() => setSøgesSelectedId(sel ? null : l.id)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:14, border:`2px solid ${sel ? '#7C3AED' : PAPER3}`, background: sel ? '#F5F0FF' : PAPER, cursor:'pointer', transition:'all 0.15s' }}>
                    <div style={{ width:44, height:44, borderRadius:10, overflow:'hidden', flexShrink:0, background: l.color || GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                      {l.images?.[0] ? <img src={l.images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (l.emoji || '🧸')}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color: sel ? '#4C1D95' : INK, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.title}</div>
                      {l.price && <div style={{ fontSize:12, color: sel ? '#7C3AED' : INK3, fontFamily:FONT }}>{l.price} kr.</div>}
                    </div>
                    {sel && <div style={{ width:20, height:20, borderRadius:'50%', background:'#7C3AED', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <label style={{ display:'block', fontSize:13, fontWeight:700, color:INK2, fontFamily:FONT, marginBottom:8 }}>
            {søgesSelectedId ? 'Tilføj en besked' : 'Skriv hvad du kan tilbyde'} {!søgesSelectedId && <span style={{ color:'#e53e3e' }}>*</span>}
          </label>
          <textarea value={søgesOffer} onChange={e => setSøgesOffer(e.target.value)}
            placeholder={søgesSelectedId ? 'Fx: Den er i rigtig god stand og bruges ikke mere...' : 'Beskriv hvad du har, stand, evt. pris eller byttebetingelser...'}
            rows={3} style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:13, outline:'none', fontFamily:FONT, background:'#fff', color:INK, boxSizing:'border-box', resize:'vertical', lineHeight:1.55 }} />
        </div>
        <Btn variant="primary" color="#7C3AED" radius={22} onClick={handleSøgesMatch}
          disabled={saving || (!søgesOffer.trim() && !søgesSelectedId)}
          style={{ justifyContent:'center', padding:'14px', fontSize:15 }}>
          {saving ? <><Spinner/>Sender…</> : '🎯 Send til ' + listing.institution_name}
        </Btn>
        <Btn variant="ghost" onClick={()=>{ setSøgesModal(false); setSøgesOffer(''); setSøgesSelectedId(null); }} style={{ justifyContent:'center' }}>Annuller</Btn>
      </div>
    </Modal>

    {/* Admin edit modal */}
    {adminEditModal && adminEditForm && (
      <div onClick={() => setAdminEditModal(false)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:32, maxWidth:520, width:'100%', boxShadow:'0 20px 60px rgba(22,34,28,0.2)' }}>
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:INK, marginBottom:20 }}>Rediger opslag <span style={{ fontSize:14, color:'#B45309', fontWeight:600 }}>(admin)</span></div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[['TITEL','title','text'],['BESKRIVELSE','description','textarea'],['PRIS (KR.) — TOM = INGEN PRIS','price','number'],['STAND','condition','text']].map(([label, field, type]) => (
              <div key={field}>
                <label style={{ display:'block', fontFamily:FONT, fontWeight:700, fontSize:12, color:'#6B7570', marginBottom:6 }}>{label}</label>
                {type === 'textarea'
                  ? <textarea value={adminEditForm[field]} onChange={e => setAdminEditForm(f => ({...f,[field]:e.target.value}))} rows={4} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #DAD3C4', fontSize:14, fontFamily:FONT, outline:'none', boxSizing:'border-box', background:'#fff', resize:'vertical' }} />
                  : <input type={type} value={adminEditForm[field]} onChange={e => setAdminEditForm(f => ({...f,[field]:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #DAD3C4', fontSize:14, fontFamily:FONT, outline:'none', boxSizing:'border-box', background:'#fff' }} />
                }
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="checkbox" id="admin-active" checked={adminEditForm.is_active} onChange={e => setAdminEditForm(f => ({...f, is_active:e.target.checked}))} style={{ width:18, height:18, cursor:'pointer', accentColor:PRIMARY }} />
              <label htmlFor="admin-active" style={{ fontFamily:FONT, fontWeight:600, fontSize:14, color:INK, cursor:'pointer' }}>Opslag er aktivt</label>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:24 }}>
            <button onClick={() => setAdminEditModal(false)} style={{ flex:1, padding:'12px', borderRadius:99, background:'#ECE6DA', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, color:'#3A473D', cursor:'pointer' }}>Annuller</button>
            <button disabled={adminEditSaving} onClick={async () => {
              setAdminEditSaving(true);
              const update = { title: adminEditForm.title, description: adminEditForm.description, price: adminEditForm.price ? Number(adminEditForm.price) : null, condition: adminEditForm.condition, is_active: adminEditForm.is_active };
              const { error } = await db.from('listings').update(update).eq('id', listing.id);
              if (!error) { setActiveListing({ ...listing, ...update }); setAdminEditModal(false); showToast?.('Opslag opdateret'); }
              setAdminEditSaving(false);
            }} style={{ flex:2, padding:'12px', borderRadius:99, background:'#B45309', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, color:'#fff', cursor: adminEditSaving ? 'not-allowed' : 'pointer' }}>
              {adminEditSaving ? 'Gemmer…' : 'Gem ændringer'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
