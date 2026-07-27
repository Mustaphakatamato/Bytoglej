'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, SKY, ACCENT, ACCENT2, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { calcServiceFee, BuyerProtectionPopup } from '@/components/ListingCard';
import { getShippingPrice } from '@/lib/shipping-rates';
import { CATEGORIES } from '@/lib/categories';

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
import OfferModal from '@/components/OfferModal';
import SwapProposalModal from '@/components/SwapProposalModal';
import { authedFetch } from '@/lib/authed-fetch';

function ImageGallery({ images, color, emoji, title, isFav, favCount, onToggleFav }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const w = useWindowWidth();
  const mobile = w < 768;
  // Lidt lavere billede på mobil, så pris + købsknapper når over folden.
  const imgH = w < 500 ? 340 : mobile ? 380 : 380;
  // Kant-til-kant på mobil (bryd ud af sidens 16px padding), afrundet kort på desktop.
  const outerStyle = mobile
    ? { margin:'0 -16px 12px', position:'relative' }
    : { marginBottom:20 };
  const frameStyle = { position:'relative', height:imgH, borderRadius: mobile ? 0 : 20, overflow:'hidden', background:'#f5f5f5' };
  // Flydende hjerte-pille (Vinted-stil) — kun på mobil hvor billedet er kant-til-kant.
  const HeartPill = mobile && onToggleFav ? (
    <button onClick={(e)=>{ e.stopPropagation(); onToggleFav(); }}
      style={{ position:'absolute', bottom:14, right:14, background:'#fff', border:'none', borderRadius:99, padding:'9px 14px', display:'flex', alignItems:'center', gap:7, cursor:'pointer', boxShadow:'0 2px 10px rgba(0,0,0,0.18)', zIndex:3 }}>
      <span style={{ fontSize:17, lineHeight:1 }}>{isFav ? '❤️' : '🤍'}</span>
      {favCount > 0 && <span style={{ fontFamily:FONT, fontSize:14, fontWeight:700, color:INK }}>{favCount}</span>}
    </button>
  ) : null;
  if (!images || images.length === 0) {
    return (
      <div style={outerStyle}>
        <div style={{ ...frameStyle, background:color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:100 }}>
          {emoji||'🧸'}
          {HeartPill}
        </div>
      </div>
    );
  }
  return (
    <div style={outerStyle}>
      <div style={frameStyle}>
        <img src={images[active]} alt={title || ''} onClick={()=>setLightbox(true)} style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', cursor:'zoom-in' }} />
        {!mobile && <div style={{ position:'absolute', bottom:12, right:12, background:'rgba(0,0,0,0.48)', color:'#fff', borderRadius:8, padding:'4px 10px', fontSize:11, fontWeight:600, pointerEvents:'none' }}>🔍 Klik for fuld visning</div>}
        {HeartPill}
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
      {images.length > 1 && !mobile && (
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
  const params = useParams();
  const { activeListing, setActiveListing, favs, toggleFav, setSelectedConvId, showToast, loggedIn, isAdmin, addToCart, cart } = useApp();
  const { isAdminView: ctxIsAdmin, adminInstName, institution: ctxInstitution, institutionId: ctxInstId } = useActiveUser();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  // If navigated directly via shared URL, fetch listing from DB
  const urlId = params?.id;
  const listing = (activeListing?.id && (!urlId || String(activeListing.id) === String(urlId)))
    ? activeListing
    : null;

  useEffect(() => {
    if (!urlId || listing) return;
    db.from('listings')
      .select('*')
      .eq('id', urlId)
      .maybeSingle()
      .then(({ data }) => { if (data) setActiveListing(data); else router.replace('/opslag'); });
  }, [urlId]);

  const inCart = cart?.some(c => c.listingId === listing?.id);
  const [offerModal, setOfferModal] = useState(false);
  const [swapProposalModal, setSwapProposalModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [ownListings, setOwnListings] = useState([]);
  const [isFav, setIsFav] = useState(favs?.includes(listing?.id) || false);
  const [localFavCount, setLocalFavCount] = useState(listing?.fav_count || 0);
  const [shareModal, setShareModal] = useState(false);
  const [showFeePopup, setShowFeePopup] = useState(false);
  const [adminEditModal, setAdminEditModal] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState(null);
  const [adminEditSaving, setAdminEditSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [shareNote, setShareNote] = useState('');
  const [shareSending, setShareSending] = useState(false);
  const [myInstName, setMyInstName] = useState(null);
  const [instListings, setInstListings] = useState([]);
  const [similarListings, setSimilarListings] = useState([]);
  const [instListingsLoaded, setInstListingsLoaded] = useState(false);
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
  const [sellerBundle,     setSellerBundle]     = useState(null);

  useEffect(() => {
    if (!listing) return;
    db.from('listings')
      .select('id,title,description,type,condition,age_group,price,estimated_value,images,emoji,color,city,institution_name,fav_count,is_active,tags,created_at')
      .eq('institution_name', listing.institution_name)
      .eq('is_active', true)
      .neq('id', listing.id)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (data) setInstListings(data);
        setInstListingsLoaded(true);
      });
  }, [listing?.id]);

  useEffect(() => {
    if (!instListingsLoaded || instListings.length > 0 || !listing) return;
    const q = db.from('listings')
      .select('id,title,description,type,condition,age_group,price,estimated_value,images,emoji,color,city,institution_name,fav_count,is_active,tags,created_at')
      .eq('is_active', true)
      .neq('id', listing.id)
      .neq('institution_name', listing.institution_name)
      .order('created_at', { ascending: false });
    if (listing.category) q.eq('category', listing.category);
    q.limit(8).then(({ data }) => { if (data?.length) setSimilarListings(data); });
  }, [instListingsLoaded, instListings.length, listing?.id]);

  useEffect(() => {
    if (!listing) return;
    db.auth.getUser().then(async ({ data:{ user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email);
      db.from('listings').select('id,title,emoji,color,images,price,estimated_value,type,reserved_until').eq('user_id', user.id).eq('is_active', true).eq('is_sold', false).neq('id', listing.id).neq('type', 'søges')
        .then(({ data }) => { if (data) setOwnListings(data.filter(l => !l.reserved_until || new Date(l.reserved_until).getTime() <= Date.now())); });
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
    });
  }, []);

  const isOwn = !!(
    (ctxInstitution && listing?.institution_name?.toLowerCase() === ctxInstitution.name?.toLowerCase()) ||
    (currentUserId && listing?.user_id === currentUserId) ||
    // Fanger også offentlig visning af egen profil og holdmedlemmer, hvor
    // ctxInstitution kan være tom og user_id kan tilhøre en anden i institutionen.
    (myInstName && listing?.institution_name?.toLowerCase() === myInstName.toLowerCase())
  );

  const reservedActive = !!(
    listing?.reserved_until && new Date(listing.reserved_until).getTime() > Date.now()
  );
  const isReservedForMe = reservedActive &&
    listing.reserved_for_institution_id &&
    listing.reserved_for_institution_id === (ctxInstId || ctxInstitution?.id);
  const isReservedForOther = reservedActive && !isReservedForMe && !!listing.reserved_for_institution_id;

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
    if (!listing?.institution_name) { setSellerBundle(null); return; }
    db.from('institutions')
      .select('bundle_discount_enabled, bundle_discount_tiers')
      .eq('name', listing.institution_name)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.bundle_discount_enabled && Array.isArray(data.bundle_discount_tiers) && data.bundle_discount_tiers.length) {
          setSellerBundle(data.bundle_discount_tiers);
        } else {
          setSellerBundle(null);
        }
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
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:80, color:GREEN_SOFT, lineHeight:1, marginBottom:16, userSelect:'none' }}>–</div>
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, marginBottom:16, color:INK }}>Intet opslag valgt</div>
          <button onClick={()=>router.push('/opslag')} style={{ background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'10px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'Sora',sans-serif" }}>← Tilbage til markedsplads</button>
        </div>
      </div>
    );
  }

  // Kræv login; ellers send til login med redirect tilbage til denne side.
  async function requireLogin() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
      return false;
    }
    return true;
  }

  async function handleToggleFav() {
    if (!(await requireLogin())) return;
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
    if (isOwn) { showToast('Dette er dit eget opslag.', 'info'); return; }
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
    } catch (e) { showToast('Noget gik galt. Prøv igen', 'error'); }
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

  // Relaterede opslag: sælgers andre opslag, ellers lignende fra samme kategori.
  // På desktop placeres sektionen i venstre kolonne under billedet (fylder tomrummet
  // ved siden af den høje info-kolonne); på mobil i bunden i fuld bredde.
  const relatedSection = (instListings.length > 0 || similarListings.length > 0) && (() => {
    const isSeller = instListings.length > 0;
    const displayListings = isSeller ? instListings : similarListings;
    const cols = isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
    const limit = 6;
    const wrapperStyle = isMobile
      ? { maxWidth:1140, margin:'0 auto', padding:'24px 16px 40px' }
      : { padding:'32px 0 8px' };
    return (
      <div style={wrapperStyle}>
        {/* Bundlerabat-banner — kun ved sælgers egne opslag */}
        {isSeller && sellerBundle && !isOwn && (() => {
          const maxPct = Math.max(...sellerBundle.map(t => t.percent || 0));
          return (
            <div style={{ background:'#fff', border:`1px solid ${PAPER3}`, borderRadius:16, padding:isMobile?'14px 16px':'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>📦</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?15:16, color:INK, letterSpacing:'-0.02em' }}>Køb bundle</div>
                <div style={{ fontFamily:FONT, fontSize:13, color:INK3, marginTop:1 }}>Op til {maxPct}% rabat når du køber flere varer fra {listing.institution_name}</div>
              </div>
              <button onClick={()=>goToInstitution(listing.institution_name)} style={{ background:PRIMARY, border:'none', borderRadius:99, padding:isMobile?'10px 16px':'11px 22px', fontFamily:FONT, fontWeight:700, fontSize:isMobile?13:14, color:'#fff', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                Lav et bundle
              </button>
            </div>
          );
        })()}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:12 }}>
          <div>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?18:20, color:INK, marginBottom:3 }}>
              {isSeller ? `Flere fra ${listing.institution_name}` : 'Lignende opslag'}
            </h2>
            <p style={{ fontSize:13, color:INK3, fontFamily:FONT }}>
              {isSeller ? `${instListings.length} ${instListings.length === 1 ? 'opslag' : 'andre opslag'}` : 'Måske du også finder det her'}
            </p>
          </div>
          {isSeller && (
            <button onClick={()=>goToInstitution(listing.institution_name)}
              style={{ background:'none', border:`1.5px solid ${PAPER3}`, borderRadius:99, padding:'7px 16px', fontSize:13, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT, whiteSpace:'nowrap', flexShrink:0 }}>
              Se alle →
            </button>
          )}
        </div>
        <div style={{ display:'grid', gridTemplateColumns: cols, gap: isMobile ? 10 : 14 }}>
          {displayListings.slice(0, limit).map(l => {
            const typeColors = { køb: { bg:'#EEF4FF', text:'#2563EB' }, byt: { bg:'#FFF3E8', text:'#C2551E' }, søges: { bg:'#F5F0FF', text:'#7C3AED' }, gratis: { bg:'#F0FFF4', text:'#15803D' } };
            const tc = typeColors[l.type] || { bg:PAPER3, text:INK3 };
            return (
              <div key={l.id} onClick={()=>{ setActiveListing(l); router.push('/opslag/' + l.id); }} style={{ cursor:'pointer', background:PAPER2, borderRadius:16, overflow:'hidden', border:`1px solid ${PAPER3}`, transition:'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(22,34,28,0.1)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}>
                <div style={{ height: isMobile ? 120 : 140, background: l.images?.[0] ? '#e8e6e3' : (l.color||'#FFD166'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:isMobile?40:48, overflow:'hidden', position:'relative' }}>
                  {l.images?.[0]
                    ? <img src={l.images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : (l.emoji || '🧸')}
                  <div style={{ position:'absolute', top:8, left:8, background:tc.bg, color:tc.text, borderRadius:99, padding:'3px 9px', fontSize:10, fontWeight:700, fontFamily:FONT }}>
                    {l.type}
                  </div>
                </div>
                <div style={{ padding: isMobile ? '10px 10px 12px' : '11px 12px 14px' }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:isMobile?12:13, color:INK, marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.title}</div>
                  <div style={{ fontSize:11, color:INK3, fontFamily:FONT, marginBottom:4 }}>{l.condition} · {l.age_group}</div>
                  {l.price
                    ? <div style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?14:15, color:PRIMARY }}>{l.price} kr.</div>
                    : <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:GREEN_DEEP }}>Gratis</div>}
                </div>
              </div>
            );
          })}
        </div>
        {isSeller && instListings.length > limit && (
          <div style={{ textAlign:'center', marginTop:20 }}>
            <button onClick={()=>goToInstitution(listing.institution_name)}
              style={{ background:GREEN_TINT, border:`1.5px solid ${GREEN_SOFT}`, borderRadius:99, padding:'11px 28px', fontSize:14, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>
              Se alle {instListings.length} opslag fra {listing.institution_name} →
            </button>
          </div>
        )}
      </div>
    );
  })();

  // Grå sektionsbånd (Vinted-stil) — kant-til-kant på mobil.
  const bandStyle = { height:8, background:PAPER2, margin: isMobile ? '18px -16px' : '22px 0', borderRadius: isMobile ? 0 : 8, border:`1px solid ${PAPER3}`, borderLeft:'none', borderRight:'none' };
  const Band = () => <div style={bandStyle} aria-hidden />;

  // Kan varen sendes? (bruges til badge i seller-kortet)
  const _so = listing.shipping_options?.[0];
  const canShipSeller = _so?.allow_shipping || (!_so && listing.can_ship);

  // Sælger-/institutionskort (Vinted-stil): avatar, navn, rating, tryghedsbadges, kontakt.
  const sellerCard = (
    <div style={{ background:'#fff', borderRadius:18, padding:'16px 18px', border:`1px solid ${PAPER3}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div onClick={()=>goToInstitution(listing.institution_name)}
          style={{ width:46, height:46, borderRadius:14, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:FONT, fontWeight:800, fontSize:19, flexShrink:0, cursor:'pointer' }}>
          {(listing.institution_name||'?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div onClick={()=>goToInstitution(listing.institution_name)}
            style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:INK, cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {listing.institution_name}
          </div>
          {trustScore ? (
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
              <span style={{ color:'#F5A623', fontSize:13, letterSpacing:1 }}>
                {'★★★★★'.slice(0, Math.round(trustScore.pct/20))}{'☆☆☆☆☆'.slice(0, 5-Math.round(trustScore.pct/20))}
              </span>
              <span style={{ fontSize:12, color:INK3, fontFamily:FONT }}>({trustScore.count})</span>
            </div>
          ) : listing.city ? (
            <div style={{ fontSize:12, color:INK3, fontFamily:FONT, marginTop:2 }}>📍 {listing.city}</div>
          ) : null}
        </div>
        {!isOwn && (
          <button onClick={handleFollow} disabled={followLoading}
            style={{ padding:'6px 14px', borderRadius:99, border:`1.5px solid ${isFollowing ? PRIMARY : '#ccc'}`, background: isFollowing ? GREEN_TINT : '#fff', color: isFollowing ? PRIMARY : INK3, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT, transition:'all 0.2s', flexShrink:0 }}>
            {isFollowing ? '✓ Følger' : '+ Følg'}
          </button>
        )}
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:14 }}>
        {['✓ CVR-verificeret', '✓ Sikker handel', canShipSeller ? '✓ Sender med pakkepost' : null].filter(Boolean).map((b,i) => (
          <span key={i} style={{ fontSize:11, fontWeight:700, color:PRIMARY, background:GREEN_TINT, borderRadius:99, padding:'5px 12px', fontFamily:FONT }}>{b}</span>
        ))}
      </div>
      {!isOwn && (
        <button onClick={()=>onStartConv && onStartConv(listing)}
          style={{ width:'100%', marginTop:14, padding:'12px', borderRadius:14, border:`1.5px solid ${PRIMARY}`, background:'#fff', color:PRIMARY, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:FONT }}>
          💬 Skriv til sælger
        </button>
      )}
    </div>
  );

  // Beskrivelse — på desktop står den over prisen, på mobil under købsknapperne,
  // så knapperne ligger umiddelbart efter billedet i stedet for langt nede.
  const descriptionBlock = listing.description ? (
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
  ) : null;

  return (
    <>
    <div style={{ minHeight:'100vh', paddingTop: isMobile ? 80 : 124, background:PAPER }} className="page-enter">
      <div style={{ maxWidth:1140, margin:'0 auto', padding:'16px 16px 0' }}>
        <button onClick={()=>router.push('/opslag')} style={{ background:'none', border:'none', fontSize:13, fontWeight:600, color:INK3, cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:'8px 0', fontFamily:FONT }}>← Markedsplads</button>
      </div>
      <div style={{ maxWidth:1140, margin:'0 auto', padding: isMobile ? '16px 16px' : '20px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 420px', gap: isMobile ? 24 : 48, alignItems:'start' }}>

          {/* LEFT: Gallery */}
          <div>
            {!isOwn && (
              <button onClick={async ()=>{ if (await requireLogin()) setReportModal(true); }}
                style={{ display:'block', marginLeft:'auto', marginBottom:8, background:'none', border:'none', padding:'2px 2px', fontSize:11, fontWeight:500, color:INK3, opacity:0.5, cursor:'pointer', fontFamily:FONT, textDecoration:'underline', textDecorationColor:'rgba(0,0,0,0.18)', textUnderlineOffset:2 }}>
                Rapportér opslag
              </button>
            )}
            <ImageGallery images={listing.images} color={listing.color} emoji={listing.emoji} title={listing.title}
              isFav={isFav} favCount={localFavCount} onToggleFav={isMobile && !isOwn ? handleToggleFav : undefined} />
            {/* Category path + brand under image */}
            {(listing.brand || listing.category) && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                {listing.category && (() => {
                  const cat = CATEGORIES.find(c => c.key === listing.category);
                  if (!cat) return null;
                  return (
                    <span style={{ fontSize:12, color:INK3, fontFamily:FONT }}>
                      {cat.emoji} {cat.label}{listing.subcategory ? ` › ${listing.subcategory}` : ''}
                    </span>
                  );
                })()}
                {listing.brand && listing.category && <span style={{ color:PAPER3, fontSize:12 }}>·</span>}
                {listing.brand && <span style={{ fontSize:12, color:INK2, fontFamily:FONT, fontWeight:700 }}>{listing.brand}</span>}
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
            {/* På desktop: relaterede opslag under billedet (fylder tomrummet) */}
            {!isMobile && relatedSection}
          </div>

          {/* RIGHT: Info + Actions */}
          <div style={{ position: isMobile ? 'static' : 'sticky', top: 96 }}>
            {/* Institution (kort link — det fulde sælgerkort vises længere nede) */}
            <div style={{ fontSize:12, color:INK3, fontFamily:FONT, marginBottom:8, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <span onClick={()=>goToInstitution(listing.institution_name)} style={{ color:PRIMARY, cursor:'pointer', fontWeight:600, textDecoration:'underline', textDecorationColor:'transparent' }}
                onMouseEnter={e=>e.target.style.textDecorationColor=PRIMARY} onMouseLeave={e=>e.target.style.textDecorationColor='transparent'}>
                {listing.institution_name}
              </span>
              {listing.city && <span>· {listing.city}</span>}
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


            {/* Description with expand (desktop — på mobil ligger den under knapperne) */}
            {!isMobile && descriptionBlock}

            {/* Price */}
            <div style={{ marginBottom:16 }}>
              {listing.price
                ? (() => {
                    const fee = calcServiceFee(listing.price);
                    const total = listing.price + fee;
                    return (
                      <div>
                        {listing.original_price && listing.original_price > listing.price && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                            <span style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:INK3, textDecoration:'line-through' }}>{listing.original_price} kr.</span>
                            <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12, background:'#FEE2E2', color:'#e11d48', borderRadius:99, padding:'2px 8px' }}>
                              -{Math.round((1 - listing.price / listing.original_price) * 100)}%
                            </span>
                          </div>
                        )}
                        {/* Sælgers pris — lille og grå */}
                        <div style={{ fontFamily:FONT, fontSize:15, color:INK3, marginBottom:4 }}>{listing.price} kr.</div>
                        {/* Inkl. beskyttelse — stor og fremhævet */}
                        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:32, color:PRIMARY, letterSpacing:'-0.03em' }}>
                            {total.toFixed(2).replace('.',',')} kr. inkl.
                          </div>
                          <button onClick={() => setShowFeePopup(true)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill={PRIMARY} opacity="0.85"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          {(() => {
                            const so = listing.shipping_options?.[0];
                            const canShip = so?.allow_shipping || (!so && listing.can_ship);
                            if (!canShip) return null;
                            return <span style={{ fontSize:13, fontWeight:700, color:'#2563EB', background:'#EFF6FF', borderRadius:99, padding:'4px 12px', border:'1px solid #93c5fd', fontFamily:FONT }}>+ fragt</span>;
                          })()}
                        </div>
                        {showFeePopup && <BuyerProtectionPopup price={listing.price} fee={fee} image={listing.images?.[0]} emoji={listing.emoji} onClose={() => setShowFeePopup(false)} />}
                      </div>
                    );
                  })()
                : listing.type === 'byt' ? <div style={{ fontSize:20, color:CORAL, fontWeight:800, fontFamily:FONT }}>Byttes{listing.estimated_value ? <span style={{ fontSize:14, fontWeight:700 }}> · anslået værdi {listing.estimated_value} kr.</span> : ' kun'}</div>
                : null}
            </div>

            {/* Action buttons — vises inline lige efter prisen, også på mobil
                (bundbjælken er stadig der som genvej når man scroller). */}
            {!isOwn ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                {isReservedForOther && (
                  <div style={{ background:'#FEF3C7', border:'1.5px solid #F59E0B', borderRadius:14, padding:'12px 16px', fontSize:13, fontFamily:FONT, color:'#92400E', fontWeight:600 }}>
                    ⏳ Varen er reserveret til en anden køber og kan ikke købes lige nu.
                  </div>
                )}
                {isReservedForMe && (
                  <button onClick={()=>{ setSelectedConvId && setSelectedConvId(null); router.push('/beskeder'); }}
                    style={{ width:'100%', textAlign:'left', background:'#ECFDF5', border:`1.5px solid ${PRIMARY}`, borderRadius:14, padding:'12px 16px', fontSize:13, fontFamily:FONT, color:PRIMARY, fontWeight:600, cursor:'pointer' }}>
                    🎉 Du har et accepteret tilbud på denne vare. Gå til beskeder for at betale →
                  </button>
                )}
                {listing.type==='køb' && !reservedActive && <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleAddToCart} style={{ justifyContent:'center', padding:'15px', fontSize:16 }}>{inCart ? '🛒 Gå til kurv →' : (() => { const so = listing.shipping_options?.[0]; const canShip = so?.allow_shipping || (!so && listing.can_ship); const tag = canShip ? (so?.shipping_included_in_price ? ' inkl. fragt' : ' + fragt') : ''; const total = listing.price + calcServiceFee(listing.price); return `🛒 Læg i kurv (${total.toFixed(2).replace('.',',')} kr.${tag})`; })()}</Btn>}
                {listing.type==='køb' && !reservedActive && <Btn variant="outline" radius={22} onClick={()=>{ if(!loggedIn){ router.push('/login'); return; } setOfferModal(true); }} style={{ justifyContent:'center', padding:'13px', fontSize:15 }}>🏷️ Giv et tilbud</Btn>}
                {listing.type==='byt' && !reservedActive && <Btn variant="primary" color={ACCENT} radius={22} onClick={()=>{ if(!loggedIn){ router.push('/login'); return; } setSwapProposalModal(true); }} style={{ justifyContent:'center', padding:'15px', fontSize:16 }}>🔄 Foreslå bytte</Btn>}
                {listing.type==='søges' && <button onClick={()=>setSøgesModal(true)}
                  style={{ width:'100%', padding:'15px', borderRadius:22, border:'none', background:'#7C3AED', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:FONT, transition:'all 0.2s' }}>
                  🎯 Jeg har noget der matcher
                </button>}
                {/* På mobil ligger "Skriv til sælger" i sælgerkortet og i bundbjælken */}
                {!isMobile && (
                <button onClick={()=>onStartConv && onStartConv(listing)}
                  style={{ width:'100%', padding:'13px', borderRadius:22, border:`1.5px solid ${PRIMARY}`, background:'#fff', color:PRIMARY, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:FONT, transition:'all 0.2s' }}>
                  💬 Skriv til sælger
                </button>
                )}
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

            {/* Beskrivelse på mobil — under knapperne */}
            {isMobile && descriptionBlock}

            <OfferModal
              open={offerModal}
              onClose={()=>setOfferModal(false)}
              listing={listing}
              showToast={showToast}
              onSubmitted={(data)=>{ if (data?.conversationId && setSelectedConvId) setSelectedConvId(data.conversationId); router.push('/beskeder'); }}
            />

            <SwapProposalModal
              open={swapProposalModal}
              onClose={()=>setSwapProposalModal(false)}
              listing={listing}
              ownListings={ownListings}
              showToast={showToast}
              onSubmitted={(data)=>{ if (data?.conversationId && setSelectedConvId) setSelectedConvId(data.conversationId); router.push('/beskeder'); }}
            />

            {/* Grå bånd + sælger-/institutionskort (Vinted-stil) */}
            <Band />
            {sellerCard}
            <Band />

            {/* Heart + share */}
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {!isMobile && (
              <button onClick={handleToggleFav}
                style={{ flex:2, padding:'11px 8px', borderRadius:16, border:`1.5px solid ${isFav?'#fca5a5':'#e5e5e5'}`, background:isFav?'#fff0f3':'#fff', color:isFav?'#e11d48':'#555', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:FONT, transition:'all 0.2s' }}>
                {isFav ? '❤️ Gemt' : '🤍 Gem'}
                {localFavCount > 0 && <span style={{ background:isFav?'#fca5a5':'#eee', color:isFav?'#c0392b':'#888', borderRadius:99, padding:'1px 7px', fontSize:11 }}>{localFavCount}</span>}
              </button>
              )}
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

            {/* Metadata box */}
            <div style={{ background:PAPER2, borderRadius:18, padding:'16px 20px', border:`1px solid ${PAPER3}`, marginBottom:14 }}>
              {[
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
              if (so?.allow_shipping || (!so && listing.can_ship)) rows.push({ icon:'📦', label:'Sendes med pakkepost', color:'#2563EB', bg:'#EFF6FF', detail: so?.shipping_size_category ? `Pakkestr.: ${so.shipping_size_category}` : null, subChip: so?.shipping_included_in_price ? { text:'Porto inkluderet i prisen', bg:'#F0FDF4', color:'#16a34a', border:'#86efac' } : { text:'Porto betales af køber', bg:'#FEF9C3', color:'#92400e', border:'#fde047' } });
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

            {/* Tryghedsboks — sikker handel via platformen */}
            <div style={{ background:GREEN_TINT, borderRadius:14, padding:'14px 16px', display:'flex', gap:12, alignItems:'flex-start', marginTop:14 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:1 }}><path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill={PRIMARY} opacity="0.9"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PRIMARY }}>Køb og sælg sikkert</div>
                <div style={{ fontSize:12, color:INK3, fontFamily:FONT, marginTop:2, lineHeight:1.5 }}>Alle handler går gennem CVR-verificerede institutioner med sikker betaling og køberbeskyttelse via platformen.</div>
              </div>
            </div>

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

      {/* På mobil: relaterede opslag i bunden (fuld bredde) */}
      {isMobile && relatedSection}

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
              body: JSON.stringify({ listingId:listing.id, listingTitle:listing.title, reason:reportReason, note:reportNote, reporterEmail:user?.email||'', reporterInstitution:inst?.name||'' }) });
          } catch {}
          setReportSending(false); setReportModal(false); setReportReason(''); setReportNote('');
          showToast('Tak! Vi kigger på det hurtigst muligt');
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
            {[['TITEL','title','text'],['BESKRIVELSE','description','textarea'],['PRIS (KR.), TOM = INGEN PRIS','price','number'],['STAND','condition','text']].map(([label, field, type]) => (
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
