'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK3, CORAL, FONT } from '@/lib/constants';
import { useWindowWidth, relTime, haversine, geocodeAddress } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Badge, Btn, Spinner, SkeletonMessageRow } from '@/components/ui';
import { TradeProtectionPopup } from '@/components/ListingCard';
import { authedFetch } from '@/lib/authed-fetch';
import PullToRefresh from '@/components/PullToRefresh';
import { calculateCO2Savings } from '@/lib/co2/calculator';
import { geocodeForCO2, getRoutingDistanceKm } from '@/lib/co2/geocoding';
const INK2 = '#3A473D';

// Komprimer billede client-side før upload. Forhindrer "object exceeded the
// maximum allowed size" og gør upload hurtig, men beholder god kvalitet hos
// modtageren (op til 1600px på længste led, JPEG kvalitet 0.82).
function compressImage(file, maxPx = 1600, quality = 0.82) {
  return new Promise(resolve => {
    if (!file?.type?.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => resolve(blob && blob.size < file.size
          ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
          : file),
        'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function ConvSwipeRow({ children, enabled, onSwipeLeft, onSwipeRight, leftBg, rightBg, leftLabel, rightLabel }) {
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const curOffset = useRef(0);
  const isHoriz = useRef(false);
  const swiped = useRef(false);
  const rowRef = useRef(null);
  const leftCbRef = useRef(onSwipeLeft);
  const rightCbRef = useRef(onSwipeRight);
  useEffect(() => { leftCbRef.current = onSwipeLeft; }, [onSwipeLeft]);
  useEffect(() => { rightCbRef.current = onSwipeRight; }, [onSwipeRight]);
  const THRESHOLD = 80;

  useEffect(() => {
    if (!enabled) return;
    const el = rowRef.current;
    if (!el) return;
    function onStart(e) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      isHoriz.current = false;
      swiped.current = false;
      curOffset.current = 0;
    }
    function onMove(e) {
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;
      if (!isHoriz.current) {
        if (Math.abs(dy) > Math.abs(dx) + 4) return;
        if (Math.abs(dx) > 8) isHoriz.current = true;
        else return;
      }
      e.preventDefault();
      curOffset.current = Math.max(-180, Math.min(180, dx));
      setOffset(curOffset.current);
      setSettling(false);
    }
    function onEnd() {
      const dx = curOffset.current;
      setSettling(true);
      if (dx < -THRESHOLD && leftCbRef.current) {
        swiped.current = true;
        setOffset(-window.innerWidth);
        setTimeout(() => { leftCbRef.current(); setOffset(0); setSettling(false); }, 260);
      } else if (dx > THRESHOLD && rightCbRef.current) {
        swiped.current = true;
        rightCbRef.current();
        setTimeout(() => { setOffset(0); setSettling(false); }, 10);
      } else {
        setOffset(0);
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [enabled]);

  if (!enabled) return children;

  const revealRight = Math.max(0, -offset);
  const revealLeft  = Math.max(0, offset);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* swipe-right → left action background */}
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:revealLeft, background:rightBg, display:'flex', alignItems:'center', paddingLeft:20, overflow:'hidden' }}>
        {revealLeft > 30 && <span style={{ color:'#fff', fontSize:12, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap' }}>{rightLabel}</span>}
      </div>
      {/* swipe-left → right action background */}
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:revealRight, background:leftBg, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:20, overflow:'hidden' }}>
        {revealRight > 30 && <span style={{ color:'#fff', fontSize:12, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap' }}>{leftLabel}</span>}
      </div>
      {/* sliding row */}
      <div
        ref={rowRef}
        style={{ transform:`translateX(${offset}px)`, transition: settling ? 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none', position:'relative', zIndex:1, willChange:'transform' }}
        onClick={e => { if (swiped.current) { e.stopPropagation(); swiped.current = false; } }}
      >
        {children}
      </div>
    </div>
  );
}

function LoginInline({ onLogin }) {
  const router = useRouter();
  const { setLoggedIn } = useApp();
  const [step,     setStep]     = useState('email');
  const [email,    setEmail]    = useState('');
  const [pass,     setPass]     = useState('');
  const [checking, setChecking] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [showPass, setShowPass] = useState(false);
  const passRef = useRef(null);

  useEffect(() => {
    if (step === 'password') setTimeout(() => passRef.current?.focus(), 80);
  }, [step]);

  function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }

  async function handleEmail(e) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!isValidEmail(email)) { setError('Skriv en gyldig e-mail (fx navn@institution.dk)'); return; }
    setChecking(true); setError(null);
    const emailLower = email.trim().toLowerCase();
    const [{ data: inst }, { data: member }] = await Promise.all([
      db.from('institutions').select('email').ilike('email', emailLower).maybeSingle(),
      db.from('institution_members').select('email').ilike('email', emailLower).maybeSingle(),
    ]);
    setChecking(false);
    if (inst || member) { setStep('password'); }
    else { router.push('/signup?email=' + encodeURIComponent(email.trim())); }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { data: authData, error } = await db.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) { setError('Forkert adgangskode — prøv igen'); return; }
    setLoggedIn(true);
    onLogin?.();
  }

  const inp = { width:'100%', padding:'13px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, background:PAPER2, fontSize:15, fontFamily:FONT, color:INK, outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ width:'100%', maxWidth:380 }}>
      <div style={{ width:64, height:64, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      </div>

      {step === 'email' && (
        <>
          <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:24, color:INK, letterSpacing:'-0.03em', marginBottom:6, textAlign:'center' }}>Log ind eller tilmeld dig</h2>
          <p style={{ fontFamily:FONT, fontSize:14, color:INK3, marginBottom:28, textAlign:'center' }}>Skriv din e-mail for at komme i gang</p>
          <form onSubmit={handleEmail} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={{ display:'block', fontFamily:FONT, fontWeight:700, fontSize:13, color:INK2, marginBottom:6 }}>E-mail</label>
              <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError(null);}} placeholder="navn@institution.dk" autoFocus required style={inp} />
            </div>
            {error && <div style={{ background:'#FEF2F2', borderLeft:'3px solid #EF4444', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#B91C1C', fontFamily:FONT }}>{error}</div>}
            <button type="submit" disabled={checking||!email.trim()} style={{ width:'100%', padding:'14px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:(checking||!email.trim())?'not-allowed':'pointer', opacity:(checking||!email.trim())?0.6:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {checking ? <><Spinner />Tjekker…</> : 'Fortsæt →'}
            </button>
          </form>
        </>
      )}

      {step === 'password' && (
        <>
          <button onClick={()=>{setStep('email');setPass('');setError(null);}} style={{ background:'none', border:'none', cursor:'pointer', color:INK3, fontFamily:FONT, fontSize:13, fontWeight:600, padding:'0 0 16px', display:'flex', alignItems:'center', gap:6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Skift e-mail
          </button>
          <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:24, color:INK, letterSpacing:'-0.03em', marginBottom:6 }}>Velkommen tilbage</h2>
          <p style={{ fontFamily:FONT, fontSize:14, color:INK3, marginBottom:24 }}>Adgangskode til <strong style={{ color:INK }}>{email}</strong></p>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={{ display:'block', fontFamily:FONT, fontWeight:700, fontSize:13, color:INK2, marginBottom:6 }}>Adgangskode</label>
              <div style={{ position:'relative' }}>
                <input ref={passRef} type={showPass?'text':'password'} value={pass} onChange={e=>{setPass(e.target.value);setError(null);}} placeholder="••••••••" required style={{ ...inp, paddingRight:46 }} />
                <button type="button" onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:INK3, padding:0, display:'flex', alignItems:'center' }}>
                  <svg width={18} height={18} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    {showPass ? <><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="2.5"/><line x1="3" y1="3" x2="17" y2="17"/></> : <><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="2.5"/></>}
                  </svg>
                </button>
              </div>
              <div style={{ textAlign:'right', marginTop:8 }}>
                <span onClick={()=>router.push('/glemt-adgangskode')} style={{ fontFamily:FONT, fontWeight:600, fontSize:12, color:PRIMARY, cursor:'pointer' }}>Glemt adgangskode?</span>
              </div>
            </div>
            {error && <div style={{ background:'#FEF2F2', borderLeft:'3px solid #EF4444', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#B91C1C', fontFamily:FONT }}>{error}</div>}
            <button type="submit" disabled={loading||!pass} style={{ width:'100%', padding:'14px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:(loading||!pass)?'not-allowed':'pointer', opacity:(loading||!pass)?0.6:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading ? <><Spinner />Logger ind…</> : 'Log ind →'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function MessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedConvId, setSelectedConvId, setActiveListing, fetchUnread } = useApp();
  const { isAdminView: ctxIsAdmin, adminInstName, institution: ctxInstitution, institutionId: ctxInstId, realUserId, userId: ctxUserId } = useActiveUser();

  const [userId,      setUserId]      = useState(null);
  const [userEmail,   setUserEmail]   = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [convs,       setConvs]       = useState([]);
  const [active,      setActive]      = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [newMsg,      setNewMsg]      = useState('');
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [msgLoad,     setMsgLoad]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [emojiOpen,   setEmojiOpen]   = useState(false);
  const [showArchived,setShowArchived]= useState(false);
  const [rejectingBid,setRejectingBid]= useState(null);
  const [rejectNote,  setRejectNote]  = useState('');
  const [counterBidMsg,setCounterBidMsg] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSearch, setComposeSearch] = useState('');
  const [composeResults, setComposeResults] = useState([]);
  const [composeTarget, setComposeTarget] = useState(null);
  const [composeMsg, setComposeMsg] = useState('');
  const [counterAmount,setCounterAmount] = useState('');
  const [offersById,  setOffersById]  = useState({}); // tilbud i den aktive samtale, by id
  const [swapPreview,  setSwapPreview]  = useState(null);
  const [shares,      setShares]      = useState([]);
  const [activeShare, setActiveShare] = useState(null);
  const [draftConv,       setDraftConv]       = useState(null);
  const [chatImages,      setChatImages]      = useState([]);
  const [fullsizeImage,   setFullsizeImage]   = useState(null);
  const [uploadError,     setUploadError]     = useState(null);
  const [bundleAcceptedAt,setBundleAcceptedAt]= useState({});
  const [checkoutDeliveries, setCheckoutDeliveries] = useState({});
  const [goingToPayment,   setGoingToPayment]   = useState(null);
  const [swapPaying,       setSwapPaying]       = useState(false);
  const [swapDelivery,     setSwapDelivery]     = useState('shipping');
  const [nowTs,            setNowTs]            = useState(() => Date.now());
  const [showSwapProtection, setShowSwapProtection] = useState(false);
  const [bidCarrier, setBidCarrier] = useState({});
  const [carrierPickerMsg, setCarrierPickerMsg] = useState(null);
  const [shipmentInfo, setShipmentInfo] = useState(null);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [invoiceConfirmed, setInvoiceConfirmed] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [convMenuOpen, setConvMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportNote,   setReportNote]   = useState('');
  const [reportSending,setReportSending]= useState(false);
  const [reportDone,   setReportDone]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { conv } | { all: true }
  const [deleting,     setDeleting]     = useState(false);
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const REPORT_REASONS = [
    'Upassende eller stødende sprog',
    'Spam eller reklame',
    'Svindel eller mistænkelig adfærd',
    'Vildledende opslag',
    'Andet',
  ];

  const EMOJI_LIST = ['😊','😄','😂','🥰','😍','👍','👏','🙌','❤️','🎉','✅','🤔','😅','🙏','🚀','💪','🌟','😮','🤝','📦','♻️','👶','🏫','🧸','🎠','⚽'];
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const fileInputRef = useRef(null);

  // Tikker hvert minut så 24-timers nedtællingen på accepterede bud opdateres.
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    db.auth.getUser().then(({ data: { user } }) => {
      setAuthChecked(true);
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setUserEmail(user.email);
      loadConvs(user.id);
      if (!ctxIsAdmin) loadShares(user.email);
    });
  }, [ctxIsAdmin, adminInstName, ctxInstId]);

  async function loadShares(email) {
    const { data } = await db.from('listing_shares').select('*').eq('to_email', email).order('created_at', { ascending: false });
    if (data) setShares(data);
  }

  async function markShareRead(share) {
    if (share.read) return;
    await db.from('listing_shares').update({ read: true }).eq('id', share.id);
    setShares(ss => ss.map(s => s.id === share.id ? { ...s, read: true } : s));
  }

  async function openSharedListing(share) {
    const { data } = await db.from('listings').select('*').eq('id', share.listing_id).maybeSingle();
    if (data && setActiveListing) { setActiveListing(data); router.push('/opslag/detail'); }
  }

  useEffect(() => {
    if (!convs.length) return;
    const urlConvId = searchParams.get('conv');
    const targetId = urlConvId || selectedConvId;
    if (!targetId) return;
    const c = convs.find(x => x.id === targetId);
    if (c && active?.id !== c.id) openConv(c, false);
  }, [convs, searchParams]);

  useEffect(() => {
    if (!userId) return;
    const ch = db.channel('convs-rt').on('postgres_changes', { event:'*', schema:'public', table:'conversations' }, () => {
      if (ctxIsAdmin && adminInstName) loadConvsByName(adminInstName);
      else loadConvs(userId);
    }).subscribe();
    return () => db.removeChannel(ch);
  }, [userId, ctxIsAdmin, adminInstName]);

  useEffect(() => {
    if (!userEmail) return;
    const ch = db.channel('shares-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'listing_shares', filter:`to_email=eq.${userEmail}` },
        ({ new: s }) => setShares(prev => [s, ...prev]))
      .subscribe();
    return () => db.removeChannel(ch);
  }, [userEmail]);

  async function loadConvs(uid) {
    setLoading(true);
    const instId   = ctxInstId  || ctxInstitution?.id;
    const instName = ctxInstitution?.name;
    const orParts  = [];
    if (instId) orParts.push(`owner_institution_id.eq.${instId}`, `initiator_institution_id.eq.${instId}`);
    if (uid)      orParts.push(`initiator_id.eq.${uid}`, `owner_id.eq.${uid}`);
    if (instName) orParts.push(`owner_name.eq.${instName}`, `initiator_name.eq.${instName}`);
    if (!orParts.length) { setLoading(false); return; }
    const { data } = await db.from('conversations').select('*')
      .or(orParts.join(','))
      .order('last_message_at', { ascending: false });
    if (data) setConvs(data);
    setLoading(false);
  }

  async function loadConvsByName(name) {
    setLoading(true);
    const { data } = await db.from('conversations').select('*')
      .or(`owner_name.eq.${name},initiator_name.eq.${name}`)
      .order('last_message_at', { ascending: false });
    if (data) setConvs(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!composeSearch.trim()) { setComposeResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await db.from('institutions').select('id,name,email,city').ilike('name', `%${composeSearch}%`).limit(6);
      if (data) setComposeResults(data);
    }, 300);
    return () => clearTimeout(t);
  }, [composeSearch]);

  async function handleComposeSend() {
    if (!composeTarget || !composeMsg.trim()) return;
    const senderName = ctxIsAdmin && adminInstName ? adminInstName : (userEmail ? userEmail : 'Ukendt');
    const { data: existing } = await db.from('conversations').select('id').eq('owner_name', composeTarget.name).ilike('initiator_name', senderName).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const effectiveUid = realUserId || userId;
      const { data: targetInst } = await db.from('institutions').select('id').eq('name', composeTarget.name).maybeSingle();
      const { data: conv } = await db.from('conversations').insert({
        listing_id: null, listing_title: 'Direkte besked', listing_emoji: '💬', listing_color: '#e0e7ff',
        initiator_id: effectiveUid, initiator_name: senderName,
        initiator_institution_id: ctxInstId || null,
        owner_id: null, owner_name: composeTarget.name,
        owner_institution_id: targetInst?.id || null,
      }).select().single();
      convId = conv?.id;
    }
    if (!convId) return;
    const effectiveUid = realUserId || userId;
    await db.from('chat_messages').insert({ conversation_id: convId, sender_id: effectiveUid, sender_name: senderName, content: composeMsg });
    await db.from('conversations').update({ last_message: composeMsg, last_message_at: new Date().toISOString() }).eq('id', convId);
    setComposeOpen(false); setComposeSearch(''); setComposeTarget(null); setComposeMsg('');
    setSelectedConvId(convId);
    loadConvs(effectiveUid);
  }

  async function openConv(conv, updateUrl = true) {
    setActive(conv);
    setShipmentInfo(null);
    setInvoiceConfirmed(false);
    setSelectedConvId(conv.id);
    if (updateUrl && searchParams.get('conv') !== conv.id) {
      router.push('/beskeder?conv=' + conv.id);
    }
    setMsgLoad(true);
    const { data } = await db.from('chat_messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true });
    if (data) setMessages(data);
    // Hent tilbud (offers) for samtalen — bruges til live status på tilbud-bobler.
    db.from('offers').select('*').eq('conversation_id', conv.id)
      .then(({ data: offerRows }) => setOffersById(Object.fromEntries((offerRows || []).map(o => [o.id, o]))));
    setMsgLoad(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
    inputRef.current?.focus();
    const isInit = amInitiator(conv);
    if ((isInit && conv.initiator_unread > 0) || (!isInit && conv.owner_unread > 0)) {
      const patch = isInit ? { initiator_unread: 0 } : { owner_unread: 0 };
      await db.from('conversations').update(patch).eq('id', conv.id);
      setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, ...patch } : c));
    }
    // Load shipment if one exists for this conversation
    if (conv.shipment_id) {
      db.from('shipments').select('tracking_number,tracking_url,label_pdf_url,status,carrier').eq('id', conv.shipment_id).maybeSingle()
        .then(({ data: s }) => { if (s) setShipmentInfo(s); });
    }
  }

  useEffect(() => {
    const urlConvId = searchParams.get('conv');
    if (!urlConvId && active) {
      setActive(null);
      setMessages([]);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!active) return;
    const ch = db.channel(`msgs-${active.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'chat_messages', filter:`conversation_id=eq.${active.id}` },
        ({ new: m }) => {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
        })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'chat_messages', filter:`conversation_id=eq.${active.id}` },
        ({ new: m }) => { setMessages(prev => prev.map(x => x.id === m.id ? m : x)); })
      .subscribe();
    return () => db.removeChannel(ch);
  }, [active?.id]);

  useEffect(() => {
    const ids = Object.keys(bundleAcceptedAt);
    if (ids.length === 0) return;
    const earliest = Math.min(...Object.values(bundleAcceptedAt));
    const msLeft = earliest + 5 * 60 * 1000 - Date.now();
    if (msLeft <= 0) { setBundleAcceptedAt({}); return; }
    const t = setTimeout(() => {
      const now = Date.now();
      setBundleAcceptedAt(prev => Object.fromEntries(Object.entries(prev).filter(([,ts]) => now - ts < 5*60*1000)));
    }, msLeft);
    return () => clearTimeout(t);
  }, [bundleAcceptedAt]);

  async function uploadImages(files, convId) {
    const urls = [];
    for (const rawFile of files) {
      const file = await compressImage(rawFile);
      const ext = (file.type === 'image/jpeg') ? 'jpg' : (file.name.split('.').pop() || 'jpg');
      const path = `${convId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploadData, error } = await db.storage.from('chat-images').upload(path, file, { upsert: true, contentType: file.type });
      if (!error && uploadData) {
        const { data: urlData } = db.storage.from('chat-images').getPublicUrl(uploadData.path ?? path);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      } else if (error) {
        console.error('Image upload failed:', error.message, error);
        return { urls: [], errorMsg: error.message };
      }
    }
    return { urls, errorMsg: null };
  }

  async function sendDraftFirstMessage() {
    const content = newMsg.trim();
    const effectiveUid = realUserId || userId;
    if ((!content && chatImages.length === 0) || !effectiveUid) return;
    setSending(true);
    const { senderName, target } = draftConv;
    const { data: existing } = await db.from('conversations').select('id')
      .eq('owner_name', target.name).ilike('initiator_name', senderName).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: conv } = await db.from('conversations').insert({
        listing_id: null, listing_title: 'Direkte besked', listing_emoji: '💬', listing_color: '#e0e7ff',
        initiator_id: effectiveUid, initiator_name: senderName,
        initiator_institution_id: ctxInstId || null,
        owner_id: null, owner_name: target.name,
        owner_institution_id: target.id || null,
      }).select().single();
      convId = conv?.id;
    }
    if (!convId) { setSending(false); return; }
    let msgContent = content;
    let msgType = null;
    if (chatImages.length > 0) {
      const { urls, errorMsg } = await uploadImages(chatImages, convId);
      if (urls.length === 0) { setUploadError(errorMsg || 'Billedet kunne ikke uploades. Prøv igen eller vælg et andet billede.'); setSending(false); return; }
      setUploadError(null);
      msgType = 'image';
      msgContent = JSON.stringify({ urls, caption: content });
      setChatImages([]);
    }
    const insertData = { conversation_id: convId, sender_id: effectiveUid, sender_name: senderName, content: msgContent };
    if (msgType) insertData.message_type = msgType;
    await db.from('chat_messages').insert(insertData);
    const lastMsg = msgType === 'image' ? '📷 Billede' : content;
    await db.from('conversations').update({ last_message: lastMsg, last_message_at: new Date().toISOString(), owner_unread: 1 }).eq('id', convId);
    setNewMsg('');
    setDraftConv(null);
    setSelectedConvId(convId);
    setSending(false);
    loadConvs(effectiveUid);
  }

  async function send() {
    const content = newMsg.trim();
    const effectiveUserId = realUserId || userId;
    if ((!content && chatImages.length === 0) || !active || !effectiveUserId) return;
    setSending(true);
    setNewMsg('');
    const instId = ctxInstId || ctxInstitution?.id;
    const isInit = active.initiator_institution_id && instId
      ? active.initiator_institution_id === instId
      : (ctxIsAdmin && adminInstName
        ? active.initiator_name === adminInstName
        : active.initiator_id === effectiveUserId);
    const senderName = ctxIsAdmin && adminInstName
      ? adminInstName
      : (isInit ? active.initiator_name : active.owner_name);
    if (chatImages.length > 0) {
      const { urls, errorMsg } = await uploadImages(chatImages, active.id);
      if (urls.length === 0) { setUploadError(errorMsg || 'Billedet kunne ikke uploades. Prøv igen eller vælg et andet billede.'); setSending(false); return; }
      setUploadError(null);
      const imageContent = JSON.stringify({ urls, caption: content });
      setChatImages([]);
      const { data: imgMsg } = await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effectiveUserId, sender_name: senderName, content: imageContent, message_type: 'image' }).select().single();
      const unreadPatch = isInit ? { owner_unread: (active.owner_unread||0)+1 } : { initiator_unread: (active.initiator_unread||0)+1 };
      const updated = { last_message: '📷 Billede', last_message_at: new Date().toISOString(), ...unreadPatch };
      await db.from('conversations').update(updated).eq('id', active.id);
      setActive(a => ({ ...a, ...updated }));
      setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...updated } : c).sort((a,b) => new Date(b.last_message_at)-new Date(a.last_message_at)));
      if (imgMsg) {
        setMessages(ms => [...ms, imgMsg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
      }
      notifyRecipient(isInit, senderName, '📷 Billede');
      setSending(false);
      return;
    }
    const { data: txtMsg } = await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effectiveUserId, sender_name: senderName, content }).select().single();
    const unreadPatch = isInit ? { owner_unread: (active.owner_unread||0)+1 } : { initiator_unread: (active.initiator_unread||0)+1 };
    const updated = { last_message: content, last_message_at: new Date().toISOString(), ...unreadPatch };
    await db.from('conversations').update(updated).eq('id', active.id);
    setActive(a => ({ ...a, ...updated }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...updated } : c).sort((a,b) => new Date(b.last_message_at)-new Date(a.last_message_at)));
    if (txtMsg) {
      setMessages(ms => [...ms, txtMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
    }
    notifyRecipient(isInit, senderName, content);
    setSending(false);
  }

  function notifyRecipient(isInit, senderName, messagePreview) {
    const recipientName = isInit ? active.owner_name : active.initiator_name;
    if (!recipientName) return;
    db.from('institutions').select('email,contact_name').ilike('name', recipientName).maybeSingle().then(({ data: inst }) => {
      if (!inst?.email) return;
      authedFetch('/api/notify-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail: inst.email,
          ownerName: inst.contact_name || recipientName,
          senderName,
          listingTitle: active.listing_title || 'din samtale',
          listingEmoji: active.listing_emoji || '💬',
          convId: active.id,
        }),
      }).catch(() => {});
    });
  }

  async function archiveConv(conv, e) {
    e.stopPropagation();
    const isInit = amInitiator(conv);
    const field = isInit ? 'archived_by_initiator' : 'archived_by_owner';
    await db.from('conversations').update({ [field]: true }).eq('id', conv.id);
    setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, [field]: true } : c));
    if (active?.id === conv.id) setActive(null);
  }

  async function unarchiveConv(conv, e) {
    e.stopPropagation();
    const isInit = amInitiator(conv);
    const field = isInit ? 'archived_by_initiator' : 'archived_by_owner';
    await db.from('conversations').update({ [field]: false }).eq('id', conv.id);
    setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, [field]: false } : c));
    if (active?.id === conv.id) setActive(null);
  }

  // Server-side sletning via service role — pålidelig uanset RLS.
  async function performDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const isAll = !!deleteTarget.all;
    const targets = isAll ? convs.filter(c => isArchived(c)) : [deleteTarget.conv];
    const ids = targets.map(c => c.id);
    if (!ids.length) { setDeleting(false); setDeleteTarget(null); return; }
    try {
      const res = await authedFetch('/api/delete-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_ids: ids }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) throw new Error(result.error || 'Sletning fejlede');
      const idSet = new Set(ids);
      setConvs(cs => cs.filter(c => !idSet.has(c.id)));
      if (active && idSet.has(active.id)) { setActive(null); setMessages([]); }
    } catch (err) {
      setUploadError(err.message || 'Samtalen kunne ikke slettes. Prøv igen.');
    }
    setDeleting(false);
    setDeleteTarget(null);
    setConvMenuOpen(false);
  }

  async function submitReport() {
    if (!reportTarget || !reportReason) return;
    setReportSending(true);
    try {
      await authedFetch('/api/report-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: reportTarget.id,
          otherParty: otherName(reportTarget),
          listingTitle: reportTarget.listing_title,
          reason: reportReason,
          note: reportNote,
          reporterName: ctxIsAdmin && adminInstName ? adminInstName : (ctxInstitution?.name || userEmail),
        }),
      });
      setReportDone(true);
    } catch {
      setReportDone(true); // vis altid kvittering — e-mail er fire-and-forget
    }
    setReportSending(false);
  }

  function effectiveSenderName() {
    if (ctxIsAdmin && adminInstName) return adminInstName;
    return active.owner_id === userId ? active.owner_name : active.initiator_name;
  }

  async function persistCO2Saving(conversation, categoryId) {
    try {
      let distanceKm = null;
      const [ownerRes, initiatorRes] = await Promise.all([
        conversation.owner_institution_id
          ? db.from('institutions').select('latitude,longitude,address,zipcode,city').eq('id', conversation.owner_institution_id).maybeSingle()
          : Promise.resolve({ data: null }),
        conversation.initiator_institution_id
          ? db.from('institutions').select('latitude,longitude,address,zipcode,city').eq('id', conversation.initiator_institution_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      let o = ownerRes.data;
      let i = initiatorRes.data;
      // Geocode if coordinates not cached
      if (o && !o.latitude) {
        const c = await geocodeForCO2(o.address, o.zipcode, o.city);
        if (c) {
          db.from('institutions').update({ latitude: c.lat, longitude: c.lon }).eq('id', conversation.owner_institution_id);
          o = { ...o, latitude: c.lat, longitude: c.lon };
        }
      }
      if (i && !i.latitude) {
        const c = await geocodeForCO2(i.address, i.zipcode, i.city);
        if (c) {
          db.from('institutions').update({ latitude: c.lat, longitude: c.lon }).eq('id', conversation.initiator_institution_id);
          i = { ...i, latitude: c.lat, longitude: c.lon };
        }
      }
      let isRoutedDistance = false;
      if (o?.latitude && i?.latitude) {
        // Forsøg OSRM routing (faktisk kørselsafstand, ingen buffer nødvendig)
        const routed = await getRoutingDistanceKm(
          { lat: o.latitude, lon: o.longitude },
          { lat: i.latitude, lon: i.longitude }
        );
        if (routed != null && routed >= 0.5) {
          distanceKm = routed;
          isRoutedDistance = true;
        } else {
          // Fallback: haversine — < 0.5 km = sandsynligvis samme postnummer-centroid → 3 km minimum
          const raw = haversine(o.latitude, o.longitude, i.latitude, i.longitude);
          distanceKm = raw >= 0.5 ? raw : 3;
        }
      }
      // Fetch listing category if not provided
      let resolvedCategory = categoryId;
      if (!resolvedCategory && conversation.listing_id) {
        const { data: listing } = await db.from('listings').select('category').eq('id', conversation.listing_id).maybeSingle();
        resolvedCategory = listing?.category || null;
      }
      const result = calculateCO2Savings({ categoryId: resolvedCategory, distanceKm, isRoutedDistance });
      await Promise.all([
        db.from('transaction_co2_savings').insert({
          transaction_id: conversation.id,
          listing_category_id: result.breakdown.categoryId,
          net_saved_kg: result.netSavedKg,
          breakdown: result.breakdown,
          methodology_version: result.methodologyVersion,
          calculated_at: result.calculatedAt,
          seller_institution_id: conversation.owner_institution_id || null,
          buyer_institution_id: conversation.initiator_institution_id || null,
          seller_name: conversation.owner_name || null,
          buyer_name: conversation.initiator_name || null,
        }),
        db.from('conversations').update({
          co2_net_saved_kg: result.netSavedKg,
          co2_breakdown: result.breakdown,
        }).eq('id', conversation.id),
      ]);
    } catch (err) {
      // Non-fatal — log only, never block the deal flow
      console.error('[CO2] persistCO2Saving failed (non-fatal):', err?.message);
    }
  }

  async function handleAcceptBid(msg) {
    const senderName = effectiveSenderName();
    const effUid1 = realUserId || userId;
    await db.from('chat_messages').update({ bid_status: 'accepted' }).eq('id', msg.id);

    // Fetch shipping options for checkout step
    let shippingOptions = null;
    if (active.listing_id) {
      const { data: listingData } = await db.from('listings').select('shipping_options').eq('id', active.listing_id).maybeSingle();
      shippingOptions = listingData?.shipping_options?.[0] || null;
    }

    const checkoutContent = JSON.stringify({
      listing_id: active.listing_id,
      listing_title: active.listing_title,
      deal_type: 'byd',
      amount: msg.bid_amount,
      shipping_options: shippingOptions,
    });
    const confirmMsg = `✅ ${senderName} har accepteret dit bud på ${msg.bid_amount} kr. — vælg leveringsmetode for at afslutte købet.`;
    const { data: newMsg } = await db.from('chat_messages').insert({
      conversation_id: active.id,
      sender_id: effUid1,
      sender_name: senderName,
      content: checkoutContent,
      message_type: 'checkout_pending',
    }).select().single();

    const now = new Date().toISOString();
    const upd = {
      last_message: confirmMsg, last_message_at: now,
      initiator_unread: (active.initiator_unread||0)+1,
      is_handled: true, handled_at: now, handled_action: 'accepted',
    };
    await db.from('conversations').update(upd).eq('id', active.id);
    setActive(a => ({ ...a, ...upd }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
    setMessages(ms => [...ms.map(m => m.id === msg.id ? { ...m, bid_status: 'accepted' } : m), ...(newMsg ? [newMsg] : [])]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
  }

  async function handleBuyerCheckout(checkoutMsg, deliveryMethod) {
    const effUid = realUserId || userId;
    const checkoutData = (() => { try { return JSON.parse(checkoutMsg.content); } catch { return {}; } })();
    const isShipping = deliveryMethod === 'shipping';

    await db.from('chat_messages').update({ bid_status: 'checkout_done', bid_note: deliveryMethod }).eq('id', checkoutMsg.id);

    const deliveryLabel = deliveryMethod === 'pickup' ? 'afhentning' : deliveryMethod === 'shipping' ? 'pakke via transportør' : 'aftalt levering';
    const senderName = active.initiator_name;
    const confirmContent = `🎉 Handel gennemført! Levering: ${deliveryLabel}`;
    const { data: confirmMsg } = await db.from('chat_messages').insert({
      conversation_id: active.id,
      sender_id: effUid,
      sender_name: senderName,
      content: confirmContent,
    }).select().single();

    if (checkoutData.listing_id) {
      await db.from('listings').update({
        is_sold: true, is_active: false,
        sold_at: new Date().toISOString(),
        sold_to: active.initiator_name,
        sold_to_institution_id: active.initiator_institution_id || null,
      }).eq('id', checkoutData.listing_id);
    }

    const now = new Date().toISOString();
    const upd = {
      last_message: confirmContent, last_message_at: now,
      owner_unread: (active.owner_unread||0)+1,
      deal_completed: true, deal_completed_at: now,
      deal_type: checkoutData.deal_type || 'byd',
    };
    await db.from('conversations').update(upd).eq('id', active.id);
    setActive(a => ({ ...a, ...upd }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
    setMessages(ms => [
      ...ms.map(x => x.id === checkoutMsg.id ? { ...x, bid_status: 'checkout_done', bid_note: deliveryMethod } : x),
      ...(confirmMsg ? [confirmMsg] : []),
    ]);
    setCheckoutDeliveries(prev => { const n={...prev}; delete n[checkoutMsg.id]; return n; });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);

    const convWithFallback = active.initiator_institution_id ? active : { ...active, initiator_institution_id: ctxInstId || null };
    persistCO2Saving(convWithFallback, active.listing_category || null);

    if (isShipping) {
      try {
        const res = await fetch('/api/book-shipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: active.id,
            listing_id: checkoutData.listing_id,
            delivery_method: 'shipping',
            buyer_name: active.initiator_name,
            seller_name: active.owner_name,
          }),
        });
        const result = await res.json();
        if (result.ok) {
          const info = {
            tracking_number: result.tracking_number,
            tracking_url: result.tracking_url,
            label_pdf_url: result.label_pdf_url,
            status: 'booked',
          };
          setShipmentInfo(info);
          const trackingContent = JSON.stringify({
            type: 'shipment',
            tracking_number: result.tracking_number,
            tracking_url: result.tracking_url,
            label_pdf_url: result.label_pdf_url,
          });
          const { data: trackMsg } = await db.from('chat_messages').insert({
            conversation_id: active.id,
            sender_id: effUid,
            sender_name: senderName,
            content: trackingContent,
            message_type: 'shipment',
          }).select().single();
          if (trackMsg) setMessages(ms => [...ms, trackMsg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
        }
      } catch {}
    }
  }

  async function handleAcceptSwap(msg) {
    const swapData = (() => { try { return JSON.parse(msg.content); } catch { return {}; } })();
    await db.from('chat_messages').update({ bid_status: 'accepted' }).eq('id', msg.id);
    const now = new Date().toISOString();
    const upd = {
      swap_accepted: true,
      swap_initiator_listing_id: swapData.swap_listing_id || null,
      swap_owner_listing_id: active.listing_id || null,
      deal_type: 'byt',
      is_handled: true, handled_at: now, handled_action: 'accepted',
      last_message: '🔄 Byttehandel godkendt — begge parter betaler for forsendelse',
      last_message_at: now,
      initiator_unread: (active.initiator_unread||0)+1,
    };
    await db.from('conversations').update(upd).eq('id', active.id);
    setActive(a => ({ ...a, ...upd }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
    setMessages(ms => ms.map(x => x.id === msg.id ? { ...x, bid_status: 'accepted' } : x));
  }

  async function handleRejectSwap(msg) {
    const senderName = effectiveSenderName();
    const effUid = realUserId || userId;
    await db.from('chat_messages').update({ bid_status: 'rejected' }).eq('id', msg.id);
    const rejectMsg = `${senderName} har afvist bytteforslaget`;
    await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid, sender_name: senderName, content: rejectMsg });
    const now = new Date().toISOString();
    const upd = {
      last_message: rejectMsg, last_message_at: now,
      initiator_unread: (active.initiator_unread||0)+1,
      is_handled: true, handled_at: now, handled_action: 'rejected',
    };
    await db.from('conversations').update(upd).eq('id', active.id);
    setActive(a => ({ ...a, ...upd }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
    setMessages(ms => ms.map(x => x.id === msg.id ? { ...x, bid_status: 'rejected' } : x));
  }

  async function handleSwapPayment(deliveryMethod) {
    setSwapPaying(true);
    try {
      const res = await authedFetch('/api/payments/create-swap-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: active.id, deliveryMethod }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Noget gik galt — prøv igen'); setSwapPaying(false); return; }
      const bd = encodeURIComponent(JSON.stringify(data.breakdown));
      router.push(`/betaling/${data.orderId}?cs=${encodeURIComponent(data.clientSecret)}&total=${data.grandTotal}&bd=${bd}`);
    } catch { alert('Noget gik galt — prøv igen'); setSwapPaying(false); }
  }

  async function handleBidPayment(checkoutMsg, selectedCarrier) {
    setGoingToPayment(checkoutMsg.id);
    const checkoutData = (() => { try { return JSON.parse(checkoutMsg.content); } catch { return {}; } })();
    const so = checkoutData.shipping_options;
    let shippingMethod = 'custom';
    if (so?.allow_shipping) shippingMethod = selectedCarrier || 'parcel_shop_gls';
    else if (so?.allow_pickup) shippingMethod = 'pickup';
    try {
      const res = await authedFetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerInstitutionId: ctxInstId || ctxInstitution?.id,
          conversationId: active.id,
          checkoutMessageId: checkoutMsg.id,
          ...(checkoutData.offer_id ? { offerId: checkoutData.offer_id } : {}),
          groups: [{ sellerName: active.owner_name, items: [checkoutData.offer_id ? { listingId: checkoutData.listing_id, offerId: checkoutData.offer_id } : { listingId: checkoutData.listing_id, fromBid: true }], shippingMethod }],
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Noget gik galt — prøv igen'); setGoingToPayment(null); return; }
      const bd = encodeURIComponent(JSON.stringify(data.breakdown));
      router.push(`/betaling/${data.orderId}?cs=${encodeURIComponent(data.clientSecret)}&total=${data.grandTotal}&bd=${bd}`);
    } catch { alert('Noget gik galt — prøv igen'); setGoingToPayment(null); }
  }

  async function handleRejectBid() {
    const msg = rejectingBid;
    const senderName = effectiveSenderName();
    await db.from('chat_messages').update({ bid_status: 'rejected', bid_note: rejectNote }).eq('id', msg.id);
    const rejectMsg = `${senderName} har afvist dit bud på ${msg.bid_amount} kr. for "${active.listing_title}"${rejectNote ? ' – ' + rejectNote : ''}`;
    const effUid2 = realUserId || userId;
    await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid2, sender_name: senderName, content: rejectMsg });
    const now = new Date().toISOString();
    const upd = {
      last_message: rejectMsg, last_message_at: now,
      initiator_unread: (active.initiator_unread||0)+1,
      is_handled: true, handled_at: now, handled_action: 'rejected',
    };
    await db.from('conversations').update(upd).eq('id', active.id);
    setActive(a => ({ ...a, ...upd }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
    setMessages(ms => ms.map(m => m.id === msg.id ? { ...m, bid_status: 'rejected', bid_note: rejectNote } : m));
    setRejectingBid(null); setRejectNote('');
  }

  async function handleCounterBid() {
    const amount = Number(counterAmount);
    if (!amount) return;
    const msg = counterBidMsg;
    await db.from('chat_messages').update({ bid_status: 'countered' }).eq('id', msg.id);
    const senderName = effectiveSenderName();
    const counterContent = `Modbud: ${amount} kr. for "${active.listing_title}"`;
    const effUid3 = realUserId || userId;
    await db.from('chat_messages').insert({
      conversation_id: active.id, sender_id: effUid3, sender_name: senderName,
      content: counterContent, message_type: 'bid', bid_amount: amount, bid_status: 'pending',
    });
    const now = new Date().toISOString();
    const upd = {
      last_message: counterContent, last_message_at: now,
      initiator_unread: (active.initiator_unread||0)+1,
      is_handled: true, handled_at: now, handled_action: 'countered',
    };
    await db.from('conversations').update(upd).eq('id', active.id);
    setActive(a => ({ ...a, ...upd }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
    setCounterBidMsg(null); setCounterAmount('');
  }

  // Svar på et tilbud (offers): accept / afvis / modbud. Sælger svarer på
  // køber-tilbud; køber svarer på sælgers modbud. Følgebeskeder (checkout,
  // afvisning, modbud) indsættes server-side og dukker op via realtime.
  async function handleOfferRespond(offer, action, extra = {}) {
    if (!offer?.id) return;
    try {
      const res = await authedFetch('/api/offers/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id, action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || 'Noget gik galt — prøv igen'); return; }
      const newStatus = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'countered';
      setOffersById(prev => ({
        ...prev,
        [offer.id]: { ...(prev[offer.id] || offer), status: newStatus },
        ...(data.offer ? { [data.offer.id]: data.offer } : {}),
      }));
    } catch { alert('Noget gik galt — prøv igen'); }
  }

  async function toggleReadUnread(conv, e) {
    e.stopPropagation();
    const isInit = amInitiator(conv);
    const field = isInit ? 'initiator_unread' : 'owner_unread';
    const currentUnread = isInit ? (conv.initiator_unread || 0) : (conv.owner_unread || 0);
    const newVal = currentUnread > 0 ? 0 : 1;
    await db.from('conversations').update({ [field]: newVal }).eq('id', conv.id);
    setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, [field]: newVal } : c));
    if (userId) fetchUnread(userId);
  }

  function onKey(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

  async function openActiveListing() {
    if (!active?.listing_id) return;
    const { data } = await db.from('listings').select('*').eq('id', active.listing_id).maybeSingle();
    if (data && setActiveListing) { setActiveListing(data); router.push('/opslag/detail'); }
  }

  function amInitiator(c) {
    const instId = ctxInstId || ctxInstitution?.id;
    const uid    = realUserId || userId;
    if (c.initiator_institution_id && instId) return c.initiator_institution_id === instId;
    if (ctxIsAdmin && adminInstName) return c.initiator_name === adminInstName;
    return c.initiator_id === uid;
  }

  const myUnread = c => amInitiator(c) ? (c.initiator_unread||0) : (c.owner_unread||0);
  const otherName  = c => amInitiator(c) ? c.owner_name : c.initiator_name;
  const isArchived = c => amInitiator(c) ? (c.archived_by_initiator||false) : (c.archived_by_owner||false);
  const filtered = convs
    .filter(c => showArchived ? isArchived(c) : !isArchived(c))
    .filter(c => otherName(c).toLowerCase().includes(search.toLowerCase()) || c.listing_title.toLowerCase().includes(search.toLowerCase()));
  const totalUnread = convs.filter(c => !isArchived(c)).reduce((s,c) => s + myUnread(c), 0);

  if (!authChecked) return <div style={{ minHeight:'100vh', background:PAPER }} />;
  if (!userId) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px 48px', background:PAPER }} className="page-enter">
      <LoginInline onLogin={() => window.location.reload()} />
    </div>
  );

  const unreadShares = shares.filter(s => !s.read).length;
  const showList = !isMobile || (!active && !activeShare && !draftConv);
  const showChat = !isMobile || !!active || !!activeShare || !!draftConv;

  return (
    <div style={{ height: isMobile ? 'calc(100dvh - 84px - env(safe-area-inset-bottom, 0px))' : '100vh', display:'flex', flexDirection:'column', paddingTop:68, background:PAPER }} className="page-enter">
      {/* Shared hidden file input for image attachments */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:'none' }}
        onChange={e=>{
          const files = Array.from(e.target.files || []);
          if (files.length) { setChatImages(imgs=>[...imgs,...files]); setUploadError(null); e.target.value=''; }
        }} />
      <div style={{ flex:1, display:'flex', overflow:'hidden', maxWidth:1200, width:'100%', margin:'0 auto', padding:isMobile?'8px 0 0':'16px 16px 0' }}>

        {/* ── Conversation list ── */}
        {showList && <div style={{ width:isMobile?'100%':320, flexShrink:0, display:'flex', flexDirection:'column', background:isMobile?PAPER:PAPER2, borderRadius:isMobile?0:'18px 18px 0 0', border:isMobile?'none':'1px solid rgba(22,34,28,0.08)', boxShadow:isMobile?'none':'0 1px 6px rgba(22,34,28,0.06)', marginRight:isMobile?0:12, overflow:'hidden' }}>
          <div style={{ padding: isMobile ? '16px 16px 10px' : '20px 18px 12px', borderBottom: isMobile ? `1px solid rgba(22,34,28,0.07)` : 'none' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isMobile ? 14 : 12 }}>
              <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize: isMobile ? 22 : 20, color:INK }}>Indbakke</h2>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {totalUnread > 0 && !showArchived && <div style={{ background:'#e11d48', color:'#fff', borderRadius:99, padding:'2px 9px', fontSize:12, fontWeight:800, fontFamily:FONT }}>{totalUnread}</div>}
                <button onClick={() => { if (userId) loadConvs(userId); }} title="Opdater" style={{ background:'transparent', border:`1.5px solid ${PAPER3}`, color:INK3, borderRadius:99, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                </button>
                <button onClick={()=>setComposeOpen(true)} title="Ny besked" style={{ background:PRIMARY, border:'none', color:'#fff', borderRadius:99, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>
            </div>

            {composeOpen && (
              <div style={{ background:GREEN_TINT, borderRadius:14, padding:14, marginBottom:12, border:`1.5px solid ${GREEN_SOFT}` }}>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, marginBottom:8, color:INK }}>Ny besked til institution</div>
                <input value={composeSearch} onChange={e=>setComposeSearch(e.target.value)} placeholder="Søg institution ved navn…" style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${PAPER3}`, fontSize:13, outline:'none', marginBottom:6, fontFamily:FONT, background:PAPER2 }} />
                {composeResults.length > 0 && !composeTarget && (
                  <div style={{ background:PAPER2, borderRadius:10, border:`1.5px solid ${PAPER3}`, marginBottom:6, maxHeight:140, overflowY:'auto' }}>
                    {composeResults.map(r => (
                      <div key={r.id} onClick={()=>{
                        const senderName = ctxIsAdmin && adminInstName ? adminInstName : (userEmail || 'Ukendt');
                        setDraftConv({ target: r, senderName });
                        setComposeOpen(false); setComposeSearch(''); setComposeResults([]); setComposeTarget(null);
                        setActive(null); setMessages([]);
                      }} style={{ padding:'10px 12px', cursor:'pointer', borderBottom:`1px solid ${PAPER3}`, fontSize:13, fontFamily:FONT }}
                        onMouseEnter={e=>e.currentTarget.style.background=GREEN_TINT}
                        onMouseLeave={e=>e.currentTarget.style.background=''}>
                        <strong>{r.name}</strong>{r.city ? <span style={{ color:INK3, marginLeft:6 }}>· {r.city}</span> : ''}
                      </div>
                    ))}
                  </div>
                )}
                {composeTarget && (
                  <>
                    <textarea value={composeMsg} onChange={e=>setComposeMsg(e.target.value)} placeholder={`Skriv besked til ${composeTarget.name}…`} rows={3} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${PAPER3}`, fontSize:13, resize:'none', outline:'none', marginBottom:6, fontFamily:FONT, background:PAPER2 }} />
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={()=>{ setComposeTarget(null); setComposeSearch(''); setComposeMsg(''); }} style={{ flex:1, padding:'8px', borderRadius:10, background:PAPER3, border:'none', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:FONT }}>Annuller</button>
                      <button onClick={handleComposeSend} disabled={!composeMsg.trim()} style={{ flex:2, padding:'8px', borderRadius:10, background:composeMsg.trim()?PRIMARY:PAPER3, border:'none', color:composeMsg.trim()?'#fff':INK3, fontWeight:700, fontSize:12, cursor:composeMsg.trim()?'pointer':'default', fontFamily:FONT }}>Send besked</button>
                    </div>
                  </>
                )}
                {!composeTarget && <button onClick={()=>{ setComposeOpen(false); setComposeSearch(''); setComposeResults([]); }} style={{ fontSize:12, color:INK3, background:'none', border:'none', cursor:'pointer', marginTop:4, fontFamily:FONT }}>Annuller</button>}
              </div>
            )}

            {isMobile ? (
              <div style={{ display:'flex', gap:0, borderRadius:12, overflow:'hidden', border:`1.5px solid ${PAPER3}`, background:PAPER2 }}>
                <button onClick={()=>setShowArchived(false)} style={{ flex:1, padding:'8px 0', border:'none', background:!showArchived?PRIMARY:'transparent', color:!showArchived?'#fff':INK3, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Meddelelser</button>
                <button onClick={()=>setShowArchived(true)} style={{ flex:1, padding:'8px 0', border:'none', background:showArchived?PRIMARY:'transparent', color:showArchived?'#fff':INK3, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Arkiveret</button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                <button onClick={()=>setShowArchived(false)} style={{ flex:1, padding:'6px 0', borderRadius:99, border:'none', background:!showArchived?PRIMARY:PAPER3, color:!showArchived?'#fff':INK3, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Aktive</button>
                <button onClick={()=>setShowArchived(true)} style={{ flex:1, padding:'6px 0', borderRadius:99, border:'none', background:showArchived?PRIMARY:PAPER3, color:showArchived?'#fff':INK3, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Arkiveret</button>
                {showArchived && convs.filter(c=>isArchived(c)).length > 0 && (
                  <button onClick={(e)=>{ e.stopPropagation(); setDeleteTarget({ all:true }); }} title="Slet alle arkiverede" style={{ padding:'6px 10px', borderRadius:99, border:'none', background:'#FEF2F2', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0, fontFamily:FONT }}>Slet alle</button>
                )}
              </div>
            )}

            <div style={{ position:'relative', marginTop: isMobile ? 10 : 0 }}>
              <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', display:'flex', alignItems:'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Søg samtaler…" style={{ width:'100%', padding:'10px 12px 10px 32px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:14, outline:'none', background:isMobile?PAPER2:PAPER2, fontFamily:FONT }} />
            </div>
            {isMobile && showArchived && convs.filter(c=>isArchived(c)).length > 0 && (
              <button onClick={(e)=>{ e.stopPropagation(); setDeleteTarget({ all:true }); }} style={{ marginTop:8, width:'100%', padding:'7px', borderRadius:10, border:'none', background:'#FEF2F2', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Slet alle arkiverede</button>
            )}
          </div>

          <div style={{ flex:1, overflowY:'auto' }}>
            {shares.length > 0 && (
              <div style={{ borderBottom:`1px solid rgba(22,34,28,0.08)` }}>
                <div style={{ padding:'8px 16px 4px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:0.5, fontFamily:FONT }}>Delte opslag</span>
                  {unreadShares > 0 && <span style={{ background:CORAL, color:'#fff', borderRadius:99, padding:'1px 7px', fontSize:10, fontWeight:800 }}>{unreadShares}</span>}
                </div>
                {shares.slice(0,5).map(s => {
                  const isAct = activeShare?.id === s.id;
                  return (
                    <div key={s.id} onClick={()=>{ setActiveShare(s); setActive(null); markShareRead(s); }}
                      style={{ display:'flex', gap:10, padding:'10px 16px', cursor:'pointer', background:isAct?GREEN_TINT:PAPER2, borderLeft:isAct?`3px solid ${PRIMARY}`:'3px solid transparent', opacity:s.read&&!isAct?0.65:1, transition:'all 0.15s' }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:s.listing_image?PAPER3:s.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, overflow:'hidden' }}>
                        {s.listing_image ? <img src={s.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : s.listing_emoji||'🧸'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:FONT, fontWeight:s.read?600:800, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{s.listing_title}</div>
                        <div style={{ fontSize:11, color:INK3, marginTop:2, fontFamily:FONT }}>Fra {s.from_name} · {relTime(s.created_at)}</div>
                      </div>
                      {!s.read && <div style={{ width:8, height:8, borderRadius:'50%', background:CORAL, flexShrink:0, alignSelf:'center' }} />}
                    </div>
                  );
                })}
              </div>
            )}

            {loading
              ? [1,2,3,4].map(i => <SkeletonMessageRow key={i} />)
              : filtered.length === 0
                ? (
                  <div style={{ padding: isMobile ? '48px 24px' : 40, textAlign:'center' }}>
                    <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>{showArchived ? '0' : '—'}</div>
                    <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>{showArchived ? 'Ingen arkiverede samtaler' : 'Ingen samtaler endnu'}</p>
                    {!showArchived && <button onClick={()=>router.push('/opslag')} style={{ marginTop:16, background:PRIMARY, border:'none', color:'#fff', borderRadius:99, padding:'10px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Find opslag</button>}
                  </div>
                )
              : filtered.map(c => {
                const unread = myUnread(c);
                const isAct = active?.id === c.id;
                const archived = isArchived(c);
                const avatarLetter = otherName(c)?.charAt(0)?.toUpperCase() || '?';
                return (
                  <ConvSwipeRow
                    key={c.id}
                    enabled={isMobile && !archived}
                    onSwipeLeft={() => archiveConv(c, { stopPropagation: () => {} })}
                    onSwipeRight={() => toggleReadUnread(c, { stopPropagation: () => {} })}
                    leftBg="#e11d48" leftLabel="Arkiver"
                    rightBg={unread > 0 ? '#3B82F6' : PRIMARY}
                    rightLabel={unread > 0 ? 'Markér læst' : 'Markér ulæst'}>
                  <div style={{ display:'flex', gap:12, padding: isMobile ? '14px 16px' : '13px 16px', cursor:'pointer', background:isAct?GREEN_TINT:(isMobile?PAPER:PAPER2), borderLeft:isAct?`3px solid ${PRIMARY}`:'3px solid transparent', transition:'background 0.15s', position:'relative', borderBottom:`1px solid rgba(22,34,28,${isMobile?'0.07':'0.05'})` }}
                    onClick={()=>openConv(c)}>
                    <div style={{ width: isMobile?52:46, height: isMobile?52:46, borderRadius: isMobile?'50%':12, background:c.listing_image?PAPER3:c.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize: isMobile?20:22, flexShrink:0, overflow:'hidden', position:'relative' }}>
                      {c.listing_image ? <img src={c.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (isMobile ? <span style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:'rgba(22,34,28,0.6)' }}>{avatarLetter}</span> : c.listing_emoji||'🧸')}
                      {isMobile && unread > 0 && <div style={{ position:'absolute', top:2, right:2, width:10, height:10, borderRadius:'50%', background:'#e11d48', border:'2px solid white' }} />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: isMobile?3:3 }}>
                        <div style={{ fontFamily:FONT, fontWeight:unread>0?800:600, fontSize: isMobile?15:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth: isMobile?'60%':110, color:INK }}>{otherName(c)}</div>
                        <div style={{ fontSize: isMobile?12:11, color:INK3, flexShrink:0, marginLeft:4, fontFamily:FONT }}>{relTime(c.last_message_at)}</div>
                      </div>
                      {!isMobile && <div style={{ fontSize:12, color:INK3, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:2, fontFamily:FONT }}>
                        {c.listing_title}
                        {amInitiator(c) && <span style={{ marginLeft:6, background:GREEN_TINT, color:PRIMARY, borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700 }}>Sendt</span>}
                      </div>}
                      {isMobile && <div style={{ fontSize:12, color:PRIMARY, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:2, fontFamily:FONT }}>{c.listing_title}</div>}
                      <div style={{ fontSize: isMobile?13:12, color:unread>0?INK:INK3, fontWeight:unread>0?600:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:FONT }}>{c.last_message || 'Samtale startet'}</div>
                    </div>
                    {!isMobile && (archived ? (
                      <div style={{ display:'flex', gap:2, flexShrink:0, alignSelf:'center' }}>
                        <button onClick={e=>unarchiveConv(c,e)} title="Flyt til indbakke" style={{ background:'none', border:'none', fontSize:13, cursor:'pointer', padding:'4px', color:INK3, fontFamily:FONT }}>↑</button>
                        <button onClick={e=>{ e.stopPropagation(); setDeleteTarget({ conv:c }); }} title="Slet permanent" style={{ background:'none', border:'none', fontSize:13, cursor:'pointer', padding:'4px', color:INK3 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:2, flexShrink:0, alignSelf:'center' }}>
                        <button onClick={e=>toggleReadUnread(c,e)} title={unread > 0 ? 'Markér som læst' : 'Markér som ulæst'}
                          style={{ background:'none', border:'none', cursor:'pointer', padding:'4px', color:unread>0?'#e11d48':INK3, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {unread > 0
                            ? <div style={{ width:8, height:8, borderRadius:'50%', background:'#e11d48' }} />
                            : <div style={{ width:8, height:8, borderRadius:'50%', border:'1.5px solid', borderColor:INK3 }} />}
                        </button>
                        <button onClick={e=>archiveConv(c,e)} title="Arkiver" style={{ background:'none', border:'none', cursor:'pointer', padding:'4px', color:INK3 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                        </button>
                      </div>
                    ))}
                    {isMobile && archived && (
                      <div style={{ display:'flex', gap:2, flexShrink:0, alignSelf:'center' }}>
                        <button onClick={e=>unarchiveConv(c,e)} title="Flyt til indbakke" style={{ background:'none', border:'none', fontSize:13, cursor:'pointer', padding:'4px', color:INK3, fontFamily:FONT }}>↑</button>
                        <button onClick={e=>{ e.stopPropagation(); setDeleteTarget({ conv:c }); }} title="Slet permanent" style={{ background:'none', border:'none', fontSize:13, cursor:'pointer', padding:'4px', color:INK3 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  </ConvSwipeRow>
                );
              })}
          </div>
        </div>}

        {/* ── Chat panel ── */}
        {showChat && <div style={{ flex:1, display:'flex', flexDirection:'column', background:isMobile?PAPER:PAPER2, borderRadius:isMobile?0:'18px 18px 0 0', border:isMobile?'none':'1px solid rgba(22,34,28,0.08)', boxShadow:isMobile?'none':'0 1px 6px rgba(22,34,28,0.06)', overflow:'hidden' }}>
          {!active && !activeShare && draftConv ? (
            <>
              <div style={{ padding:'10px 12px', borderBottom:`1px solid rgba(22,34,28,0.08)`, display:'flex', alignItems:'center', gap:12, background: isMobile ? PAPER : PAPER2 }}>
                {isMobile && <button onClick={()=>setDraftConv(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 4px', flexShrink:0, display:'flex', alignItems:'center', color:INK }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>}
                <div style={{ width:44, height:44, borderRadius:12, background:'#e0e7ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>💬</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:INK3, fontWeight:600, marginBottom:2, fontFamily:FONT }}>Ny samtale med</div>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{draftConv.target.name}</div>
                  {draftConv.target.city && <div style={{ fontSize:12, color:INK3, marginTop:1, fontFamily:FONT }}>{draftConv.target.city}</div>}
                </div>
                <button onClick={()=>setDraftConv(null)} style={{ background:PAPER3, border:'none', borderRadius:99, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT, color:INK3 }}>Annuller</button>
              </div>
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', background:PAPER, padding:24 }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>Start samtalen</div>
                <div style={{ fontSize:13, color:INK3, fontFamily:FONT, textAlign:'center', maxWidth:280 }}>Skriv din første besked til <strong>{draftConv.target.name}</strong> nedenfor. Samtalen oprettes, når du sender.</div>
              </div>
              <div style={{ borderTop:`1px solid rgba(22,34,28,0.08)`, background:PAPER2, position:'relative' }}>
                {chatImages.length > 0 && (
                  <div style={{ padding:'8px 16px 0', display:'flex', gap:6, flexWrap:'wrap' }}>
                    {chatImages.map((file, idx) => (
                      <div key={idx} style={{ position:'relative', width:52, height:52, borderRadius:8, overflow:'hidden', border:`1.5px solid ${PAPER3}` }}>
                        <img src={URL.createObjectURL(file)} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                        <button onClick={()=>setChatImages(imgs=>imgs.filter((_,i)=>i!==idx))}
                          style={{ position:'absolute', top:2, right:2, width:16, height:16, borderRadius:'50%', background:'rgba(22,34,28,0.6)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:10, lineHeight:1, padding:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ padding:'12px 16px', display:'flex', gap:8, alignItems:'flex-end' }}>
                  <button onClick={()=>fileInputRef.current?.click()} title="Vedhæft billede"
                    style={{ background:'none', border:'none', cursor:'pointer', padding:'8px', borderRadius:10, flexShrink:0, color:chatImages.length>0?PRIMARY:INK3, lineHeight:1, height:44, display:'flex', alignItems:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </button>
                  <textarea ref={inputRef} value={newMsg} onChange={e=>setNewMsg(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendDraftFirstMessage();} }}
                    placeholder={`Skriv besked til ${draftConv.target.name}… (Enter for at sende)`} rows={1}
                    style={{ flex:1, padding:'11px 14px', borderRadius:14, border:`1.5px solid ${PAPER3}`, fontSize:14, resize:'none', fontFamily:FONT, outline:'none', lineHeight:1.5, maxHeight:120, overflowY:'auto', background:PAPER }}
                    onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                  />
                  <button onClick={sendDraftFirstMessage} disabled={(!newMsg.trim()&&chatImages.length===0)||sending}
                    style={{ width:44, height:44, borderRadius:14, background:(newMsg.trim()||chatImages.length>0)?PRIMARY:PAPER3, border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:(newMsg.trim()||chatImages.length>0)?'pointer':'default', transition:'background 0.2s', flexShrink:0 }}>
                    {sending ? <Spinner /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={(newMsg.trim()||chatImages.length>0)?'#fff':INK3} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
                  </button>
                </div>
              </div>
            </>
          ) : !active && !activeShare ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GREEN_SOFT} strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              </div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:INK3 }}>Vælg en samtale</div>
              <div style={{ fontSize:13, marginTop:6, color:INK3, fontFamily:FONT }}>eller start en ny fra et opslag</div>
            </div>
          ) : activeShare && !active ? (
            <>
              <div style={{ padding:'10px 12px', borderBottom:`1px solid rgba(22,34,28,0.08)`, display:'flex', alignItems:'center', gap:12, background: isMobile ? PAPER : PAPER2 }}>
                {isMobile && <button onClick={()=>setActiveShare(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 4px', flexShrink:0, display:'flex', alignItems:'center', color:INK }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>}
                <div style={{ width:38, height:38, borderRadius:10, background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:INK }}>Delt opslag</div>
                  <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>Fra {activeShare.from_name}</div>
                </div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:14, background:PAPER }}>
                <div style={{ width:'100%', maxWidth:380 }}>
                  <div style={{ background:PAPER2, borderRadius:20, overflow:'hidden', border:'1px solid rgba(22,34,28,0.08)', boxShadow:'0 2px 12px rgba(22,34,28,0.07)' }}>
                    <div style={{ height:200, background:activeShare.listing_image?PAPER3:activeShare.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:80, overflow:'hidden' }}>
                      {activeShare.listing_image ? <img src={activeShare.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : activeShare.listing_emoji||'🧸'}
                    </div>
                    <div style={{ padding:'16px 20px 20px' }}>
                      <div style={{ marginBottom:10 }}><Badge type={activeShare.listing_type} /></div>
                      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:20, marginBottom:4, color:INK }}>{activeShare.listing_title}</div>
                      <div style={{ fontSize:13, color:INK3, marginBottom:8, fontFamily:FONT }}>{activeShare.listing_institution_name}{activeShare.listing_city ? ` · ${activeShare.listing_city}` : ''}</div>
                      {activeShare.listing_price && <div style={{ fontFamily:FONT, fontWeight:800, fontSize:24, color:PRIMARY }}>{activeShare.listing_price} kr.</div>}
                    </div>
                  </div>
                  {activeShare.note && (
                    <div style={{ background:GREEN_TINT, border:`1.5px solid ${GREEN_SOFT}`, borderRadius:14, padding:'12px 16px', marginTop:12 }}>
                      <div style={{ fontSize:12, color:PRIMARY, fontWeight:700, marginBottom:4, fontFamily:FONT }}>Besked fra {activeShare.from_name}</div>
                      <div style={{ fontSize:14, color:INK, lineHeight:1.55, fontFamily:FONT }}>{activeShare.note}</div>
                    </div>
                  )}
                  <div style={{ fontSize:11, color:INK3, textAlign:'center', marginTop:10, fontFamily:FONT }}>Delt {relTime(activeShare.created_at)}</div>
                  <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>openSharedListing(activeShare)} style={{ justifyContent:'center', width:'100%', marginTop:14, padding:'13px', fontSize:15 }}>
                    Se opslag →
                  </Btn>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: isMobile ? '10px 12px' : '12px 16px', borderBottom:`1px solid rgba(22,34,28,0.08)`, display:'flex', alignItems:'center', gap: isMobile ? 10 : 12, background: isMobile ? PAPER : PAPER2 }}>
                {isMobile && (
                  <button onClick={()=>{ setActive(null); setMessages([]); router.push('/beskeder'); }} style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 4px', flexShrink:0, display:'flex', alignItems:'center', color:INK }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  </button>
                )}
                <div style={{ width: isMobile?42:44, height: isMobile?42:44, borderRadius: isMobile?'50%':12, background:active.listing_image?PAPER3:active.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize: isMobile?18:22, flexShrink:0, overflow:'hidden' }}>
                  {active.listing_image ? <img src={active.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : active.listing_emoji||'🧸'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  {!isMobile && <div style={{ fontSize:11, color:INK3, fontWeight:600, marginBottom:2, fontFamily:FONT }}>Samtale om</div>}
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize: isMobile?16:15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{isMobile ? otherName(active) : active.listing_title}</div>
                  <div style={{ fontSize:12, color:INK3, marginTop:1, fontFamily:FONT }}>{isMobile ? active.listing_title : <>med <strong style={{ color:INK }}>{otherName(active)}</strong></>}</div>
                </div>
                {!isMobile && active.listing_id && (
                  <button onClick={openActiveListing} style={{ fontSize:12, fontWeight:700, color:PRIMARY, background:GREEN_TINT, border:'none', borderRadius:99, padding:'6px 14px', cursor:'pointer', whiteSpace:'nowrap', fontFamily:FONT }}>Se opslag →</button>
                )}
                <button onClick={()=>setConvMenuOpen(true)} title="Indstillinger" style={{ background:'transparent', border:`1.5px solid ${PAPER3}`, color:INK3, borderRadius:99, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
                </button>
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '16px 12px' : '20px 24px', display:'flex', flexDirection:'column', gap:6, background:PAPER }}>
                {msgLoad
                  ? <div style={{ textAlign:'center', color:INK3, paddingTop:40, fontFamily:FONT }}>Indlæser…</div>
                  : messages.length === 0
                    ? (
                      <div style={{ textAlign:'center', paddingTop:60 }}>
                        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>—</div>
                        <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Send den første besked for at starte samtalen</p>
                      </div>
                    )
                    : (() => {
                      const myInstId   = ctxInstId || ctxInstitution?.id;
                      const myInstName = ctxInstitution?.name;
                      const isOwnerInConv = ctxIsAdmin && adminInstName
                        ? active.owner_name === adminInstName
                        : active.owner_id === userId
                          || (myInstId   && active.owner_institution_id === myInstId)
                          || (myInstName && active.owner_name?.toLowerCase() === myInstName?.toLowerCase());
                      let lastDate = null;
                      return messages.map((m, i) => {
                        const effUid = realUserId || userId;
                        const mine = ctxIsAdmin && adminInstName
                          ? m.sender_name === adminInstName
                          : m.sender_id === effUid;
                        const d = new Date(m.created_at);
                        const dateStr = d.toLocaleDateString('da-DK',{weekday:'long',day:'numeric',month:'long'});
                        const showDate = dateStr !== lastDate;
                        lastDate = dateStr;
                        const prevMine = i>0 && (ctxIsAdmin && adminInstName ? messages[i-1].sender_name === adminInstName : messages[i-1].sender_id === userId);
                        const grouped = mine === prevMine && !showDate && m.message_type !== 'bid' && messages[i-1]?.message_type !== 'bid' && m.message_type !== 'swap' && messages[i-1]?.message_type !== 'swap' && m.message_type !== 'bundle' && messages[i-1]?.message_type !== 'bundle' && m.message_type !== 'image' && messages[i-1]?.message_type !== 'image' && m.message_type !== 'buy_request' && messages[i-1]?.message_type !== 'buy_request' && m.message_type !== 'checkout_pending' && messages[i-1]?.message_type !== 'checkout_pending' && m.message_type !== 'shipment' && messages[i-1]?.message_type !== 'shipment' && m.message_type !== 'payment_confirmed' && messages[i-1]?.message_type !== 'payment_confirmed';
                        const isBid = m.message_type === 'bid';
                        const isOffer = m.message_type === 'offer';
                        const offerData = isOffer ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const isSwap = m.message_type === 'swap';
                        const isBundle = m.message_type === 'bundle';
                        const isImage = m.message_type === 'image';
                        const isBuyRequest = m.message_type === 'buy_request';
                        const isCheckout = m.message_type === 'checkout_pending';
                        const isShipment = m.message_type === 'shipment';
                        const bundleData = isBundle ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const swapData = isSwap ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const imageData = isImage ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const buyData = isBuyRequest ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const checkoutData = isCheckout ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const shipmentData = isShipment ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const isPaymentConfirmed = m.message_type === 'payment_confirmed';
                        const paymentData = isPaymentConfirmed ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        return (
                          <React.Fragment key={m.id}>
                            {showDate && <div style={{ textAlign:'center', margin:'12px 0 4px', fontSize:11, fontWeight:600, color:INK3, letterSpacing:0.5, fontFamily:FONT }}>{dateStr}</div>}
                            {isBuyRequest ? (
                              <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                                {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:PRIMARY, flexShrink:0, marginRight:8, alignSelf:'flex-end', fontFamily:FONT }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                                <div style={{ maxWidth:'85%' }}>
                                  {!mine && <div style={{ fontSize:11, fontWeight:700, color:INK3, marginBottom:3, marginLeft:2, fontFamily:FONT }}>{m.sender_name}</div>}
                                  <div style={{ background:mine?GREEN_TINT:PAPER3, border:`1.5px solid ${mine?PRIMARY:'rgba(22,34,28,0.12)'}`, borderRadius:16, padding:'14px 16px', minWidth:220 }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                                      <span style={{ fontSize:11, fontWeight:700, color:PRIMARY, textTransform:'uppercase', letterSpacing:0.6, fontFamily:FONT }}>Købsforespørgsel</span>
                                      {active?.is_handled && active?.handled_action === 'accepted' && <span style={{ fontSize:11, fontWeight:700, color:PRIMARY, background:'#D1FAE5', padding:'2px 8px', borderRadius:99, fontFamily:FONT, textTransform:'none', letterSpacing:0 }}>Bekræftet</span>}
                                    </div>
                                    {buyData?.items?.map((item, ii) => (
                                      <div key={ii} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                                        <span style={{ fontSize:18 }}>{item.emoji || '🧸'}</span>
                                        <span style={{ fontFamily:FONT, fontSize:13, fontWeight:600, color:INK, flex:1 }}>{item.title}</span>
                                        {item.price && <span style={{ fontFamily:FONT, fontSize:13, fontWeight:700, color:PRIMARY }}>{item.price} kr.</span>}
                                      </div>
                                    ))}
                                    <div style={{ borderTop:`1px solid rgba(22,34,28,0.1)`, marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                      <span style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>Total</span>
                                      <span style={{ fontFamily:FONT, fontSize:15, fontWeight:800, color:INK }}>{buyData?.totalPrice || 0} kr.</span>
                                    </div>
                                    {buyData?.note && <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(22,34,28,0.04)', borderRadius:8, fontFamily:FONT, fontSize:12, color:INK3 }}>{buyData.note}</div>}
                                    {/* Step 1: Seller confirms the order */}
                                    {isOwnerInConv && !mine && !(active?.is_handled) && (
                                      <button onClick={async () => {
                                        if (confirmingOrder) return;
                                        setConfirmingOrder(true);
                                        const effUid = realUserId || userId;
                                        const senderName = effectiveSenderName();
                                        const confirmMsg = `✅ ${senderName} har bekræftet din ordre — du modtager snart en faktura.`;
                                        const { data: newMsg } = await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid, sender_name: senderName, content: confirmMsg }).select().single();
                                        for (const item of (buyData?.items || [])) {
                                          await db.from('listings').update({ is_sold: true, is_active: false, sold_at: new Date().toISOString(), sold_to: active.initiator_name, sold_to_institution_id: active.initiator_institution_id }).eq('id', item.listingId);
                                        }
                                        const now = new Date().toISOString();
                                        const convUpd = { last_message: confirmMsg, last_message_at: now, initiator_unread: (active.initiator_unread||0)+1, is_handled: true, handled_at: now, handled_action: 'order_confirmed', deal_type: 'køb' };
                                        await db.from('conversations').update(convUpd).eq('id', active.id);
                                        setMessages(ms => [...ms, ...(newMsg ? [newMsg] : [])]);
                                        setActive(a => ({ ...a, ...convUpd }));
                                        setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...convUpd } : c));
                                        setConfirmingOrder(false);
                                        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
                                      }} disabled={confirmingOrder} style={{ width:'100%', marginTop:12, padding:'11px', borderRadius:99, background:confirmingOrder?PAPER3:PRIMARY, color:confirmingOrder?INK3:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:confirmingOrder?'default':'pointer' }}>
                                        {confirmingOrder ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Spinner />Bekræfter…</span> : '✅ Bekræft ordre'}
                                      </button>
                                    )}

                                    {/* Step 2: Seller generates label — only after order confirmed */}
                                    {isOwnerInConv && !mine && active?.is_handled && active?.handled_action === 'order_confirmed' && !active?.deal_completed && buyData?.delivery_method === 'shipping' && (
                                      <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid rgba(22,34,28,0.1)` }}>
                                        <div style={{ fontFamily:FONT, fontSize:12, fontWeight:700, color:INK, marginBottom:10 }}>Klar til at sende pakken?</div>
                                        <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginBottom:12 }}>
                                          <input type="checkbox" checked={invoiceConfirmed} onChange={e => setInvoiceConfirmed(e.target.checked)}
                                            style={{ marginTop:2, width:16, height:16, accentColor:PRIMARY, cursor:'pointer', flexShrink:0 }} />
                                          <span style={{ fontFamily:FONT, fontSize:13, color:INK2, lineHeight:1.5 }}>
                                            Jeg bekræfter at faktura er sendt eller vil blive sendt til <strong>{active.initiator_name}</strong>
                                          </span>
                                        </label>
                                        <button onClick={async () => {
                                          if (!invoiceConfirmed || generatingLabel) return;
                                          setGeneratingLabel(true);
                                          const effUid = realUserId || userId;
                                          const senderName = effectiveSenderName();
                                          try {
                                            const res = await fetch('/api/book-shipment', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({
                                                conversation_id: active.id,
                                                listing_id: buyData?.items?.[0]?.listingId || active.listing_id,
                                                delivery_method: 'shipping',
                                                buyer_name: active.initiator_name,
                                                seller_name: senderName,
                                              }),
                                            });
                                            const result = await res.json();
                                            if (result.ok) {
                                              setShipmentInfo({ tracking_number: result.tracking_number, tracking_url: result.tracking_url, label_pdf_url: result.label_pdf_url, status: 'booked' });
                                              const trackingContent = JSON.stringify({ type: 'shipment', tracking_number: result.tracking_number, tracking_url: result.tracking_url, label_pdf_url: result.label_pdf_url });
                                              const { data: trackMsg } = await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid, sender_name: senderName, content: trackingContent, message_type: 'shipment' }).select().single();
                                              const now = new Date().toISOString();
                                              const convUpd = { last_message: '📦 Label genereret — marker som afsendt i Mine opgaver', last_message_at: now, owner_unread: 0, shipment_id: result.shipment_id, delivery_method: 'shipping' };
                                              await db.from('conversations').update(convUpd).eq('id', active.id);
                                              const convWithFallback = active.initiator_institution_id ? active : { ...active, initiator_institution_id: ctxInstId || null };
                                              persistCO2Saving(convWithFallback, buyData?.items?.[0]?.category || null);
                                              if (trackMsg) setMessages(ms => [...ms, trackMsg]);
                                              setActive(a => ({ ...a, ...convUpd }));
                                              setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...convUpd } : c));
                                              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
                                            }
                                          } catch {}
                                          setGeneratingLabel(false);
                                        }} disabled={!invoiceConfirmed || generatingLabel}
                                          style={{ width:'100%', padding:'11px', borderRadius:99, background:invoiceConfirmed&&!generatingLabel?PRIMARY:PAPER3, color:invoiceConfirmed&&!generatingLabel?'#fff':INK3, border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:invoiceConfirmed&&!generatingLabel?'pointer':'default' }}>
                                          {generatingLabel ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Spinner />Genererer label…</span> : '📦 Generer forsendelseslabel'}
                                        </button>
                                      </div>
                                    )}

                                    {/* Step 2 (pickup): close deal after order confirmed */}
                                    {isOwnerInConv && !mine && active?.is_handled && active?.handled_action === 'order_confirmed' && !active?.deal_completed && buyData?.delivery_method !== 'shipping' && (
                                      <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid rgba(22,34,28,0.1)` }}>
                                        <button onClick={async () => {
                                          const effUid = realUserId || userId;
                                          const senderName = effectiveSenderName();
                                          const msg = `✅ Afhentning bekræftet af ${senderName}.`;
                                          const { data: newMsg } = await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid, sender_name: senderName, content: msg }).select().single();
                                          const now = new Date().toISOString();
                                          const convUpd = { last_message: msg, last_message_at: now, initiator_unread: (active.initiator_unread||0)+1, deal_completed: true, deal_completed_at: now };
                                          await db.from('conversations').update(convUpd).eq('id', active.id);
                                          const convWithFallback = active.initiator_institution_id ? active : { ...active, initiator_institution_id: ctxInstId || null };
                                          persistCO2Saving(convWithFallback, buyData?.items?.[0]?.category || null);
                                          if (newMsg) setMessages(ms => [...ms, newMsg]);
                                          setActive(a => ({ ...a, ...convUpd }));
                                          setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...convUpd } : c));
                                          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
                                        }} style={{ width:'100%', padding:'11px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                                          ✓ Bekræft afhentning og afslut handel
                                        </button>
                                      </div>
                                    )}

                                    {/* Completed state */}
                                    {isOwnerInConv && !mine && active?.deal_completed && (
                                      <div style={{ marginTop:10, textAlign:'center', fontFamily:FONT, fontSize:12, color:PRIMARY, fontWeight:700 }}>
                                        {buyData?.delivery_method === 'shipping' ? '📦 Forsendelse afsendt ✓' : '✓ Handel afsluttet'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : isCheckout && checkoutData ? (
                              <div style={{ margin:'10px 0', padding:'0 4px' }}>
                                <div style={{
                                  background: m.bid_status === 'checkout_done' ? GREEN_TINT : '#FFFBEB',
                                  border: `2px solid ${m.bid_status === 'checkout_done' ? PRIMARY : '#FDE68A'}`,
                                  borderRadius:16, padding:'16px',
                                }}>
                                  {(() => {
                                    const deadline = new Date(m.created_at).getTime() + 24 * 60 * 60 * 1000;
                                    const remaining = deadline - nowTs;
                                    const expired = remaining <= 0;
                                    const hrs = Math.max(0, Math.floor(remaining / 3600000));
                                    const mins = Math.max(0, Math.floor((remaining % 3600000) / 60000));
                                    const deadlineStr = new Date(deadline).toLocaleString('da-DK', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
                                    const done = m.bid_status === 'checkout_done';
                                    const paying = goingToPayment === m.id;
                                    return (
                                      <>
                                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                                          <span style={{ fontSize:18 }}>{done ? '✅' : '🛍️'}</span>
                                          <div>
                                            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:INK }}>
                                              {done ? 'Handel gennemført!' : 'Dit bud er accepteret 🎉'}
                                            </div>
                                            <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:1 }}>
                                              {checkoutData.listing_title} · {checkoutData.deal_type === 'byd' ? `${checkoutData.amount} kr.` : 'Bytte'}
                                            </div>
                                          </div>
                                        </div>

                                        {done ? (
                                          <div style={{ fontFamily:FONT, fontSize:13, color:INK2, fontWeight:600 }}>
                                            {m.bid_note === 'pickup' ? '📍 Afhentning' : m.bid_note === 'shipping' ? '📦 Pakke via transportør' : '🤝 Aftalt levering'}
                                          </div>
                                        ) : isOwnerInConv ? (
                                          <div style={{ fontFamily:FONT, fontSize:13, color:'#B45309', fontWeight:600, textAlign:'center', padding:'8px 0' }}>
                                            {expired ? '⏰ Tilbuddet udløb — køber betalte ikke i tide' : `⏳ Afventer købers betaling (udløber ${deadlineStr})`}
                                          </div>
                                        ) : expired ? (
                                          <div style={{ fontFamily:FONT, fontSize:13, color:'#B45309', fontWeight:600, textAlign:'center', padding:'8px 0', lineHeight:1.5 }}>
                                            ⏰ Tilbuddet er udløbet — buddet er ikke længere reserveret til denne pris.
                                          </div>
                                        ) : (
                                          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                            <div style={{ background:'#FEF9C3', border:'1px solid #FDE68A', borderRadius:12, padding:'10px 12px' }}>
                                              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:'#92400e' }}>⏳ Reserveret til dig i 24 timer</div>
                                              <div style={{ fontFamily:FONT, fontSize:12, color:'#92400e', marginTop:2, lineHeight:1.5 }}>
                                                Betal inden <strong>{deadlineStr}</strong> for at sikre prisen — {hrs}t {mins}m tilbage.
                                              </div>
                                            </div>
                                            <button
                                              onClick={()=>{
                                                if (paying) return;
                                                const so = checkoutData?.shipping_options;
                                                if (so?.allow_shipping) { setCarrierPickerMsg(m); }
                                                else { handleBidPayment(m, so?.allow_pickup ? 'pickup' : 'custom'); }
                                              }}
                                              disabled={paying}
                                              style={{ padding:'13px', borderRadius:99, background:paying?PAPER3:PRIMARY, border:'none', color:paying?INK3:'#fff', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:paying?'default':'pointer' }}>
                                              {paying ? 'Forbereder betaling…' : '💳 Gå til betaling'}
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : isSwap ? (
                              <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                                {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:PRIMARY, flexShrink:0, marginRight:8, alignSelf:'flex-end', fontFamily:FONT }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                                <div style={{ maxWidth:'78%' }}>
                                  {!mine && <div style={{ fontSize:11, fontWeight:700, color:INK3, marginBottom:3, marginLeft:2, fontFamily:FONT }}>{m.sender_name}</div>}
                                  <div style={{ background:mine?'#FEF3EC':PAPER3, border:`1.5px solid ${mine?CORAL:'rgba(22,34,28,0.12)'}`, borderRadius:16, padding:'14px 16px', minWidth:200 }}>
                                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                                      <span style={{ fontSize:11, fontWeight:700, color:CORAL, textTransform:'uppercase', letterSpacing:0.6, fontFamily:FONT }}>Bytteforslag</span>
                                      {m.bid_status==='accepted' && <span style={{ fontSize:11, fontWeight:700, color:PRIMARY, background:'#D1FAE5', padding:'2px 8px', borderRadius:99, fontFamily:FONT }}>Godkendt</span>}
                                      {m.bid_status==='rejected' && <span style={{ fontSize:11, fontWeight:700, color:'#e11d48', background:'#FEE2E2', padding:'2px 8px', borderRadius:99, fontFamily:FONT }}>Afvist</span>}
                                    </div>
                                    {swapData?.swap_title ? (
                                      <div onClick={swapData.swap_listing_id ? async ()=>{ const {data}=await db.from('listings').select('*').eq('id',swapData.swap_listing_id).maybeSingle(); if(data) setSwapPreview(data); } : undefined}
                                        style={{ display:'flex', alignItems:'center', gap:10, background:PAPER2, borderRadius:10, padding:'10px 12px', marginBottom: swapData?.note ? 8 : 0, cursor: swapData.swap_listing_id ? 'pointer' : 'default', transition:'opacity 0.15s' }}
                                        onMouseEnter={e=>{ if(swapData.swap_listing_id) e.currentTarget.style.opacity='0.85'; }}
                                        onMouseLeave={e=>{ e.currentTarget.style.opacity='1'; }}>
                                        <div style={{ width:44, height:44, borderRadius:8, background:swapData.swap_image?PAPER3:swapData.swap_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, overflow:'hidden' }}>
                                          {swapData.swap_image ? <img src={swapData.swap_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : swapData.swap_emoji||'🧸'}
                                        </div>
                                        <div style={{ flex:1 }}>
                                          <div style={{ fontSize:12, color:INK3, fontWeight:600, fontFamily:FONT }}>Tilbyder:</div>
                                          <div style={{ fontWeight:700, fontSize:14, color:INK, fontFamily:FONT }}>{swapData.swap_title}</div>
                                        </div>
                                        {swapData.swap_listing_id && <span style={{ fontSize:11, color:PRIMARY, fontWeight:600, fontFamily:FONT }}>Se opslag →</span>}
                                      </div>
                                    ) : null}
                                    {swapData?.note && (
                                      <div style={{ fontSize:13, color:INK, marginTop: swapData?.swap_title ? 8 : 0, lineHeight:1.5, fontFamily:FONT }}>{swapData.note}</div>
                                    )}
                                  </div>

                                  {/* Ejeren kan godkende/afvise et bytteforslag */}
                                  {!mine && isOwnerInConv && !m.bid_status && !active?.swap_accepted && !active?.deal_completed && (
                                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                                      <button onClick={()=>handleAcceptSwap(m)} style={{ flex:1, padding:'10px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>Godkend byttehandel</button>
                                      <button onClick={()=>handleRejectSwap(m)} style={{ padding:'10px 14px', borderRadius:99, background:'#fff', color:'#e11d48', border:'1.5px solid #FCA5A5', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>Afvis</button>
                                    </div>
                                  )}

                                  {/* Escrow: begge parter betaler beskyttelse + porto */}
                                  {m.bid_status==='accepted' && active?.swap_accepted && (() => {
                                    const party = isOwnerInConv ? 'owner' : 'initiator';
                                    const myPaid    = party==='owner' ? active.swap_owner_paid     : active.swap_initiator_paid;
                                    const otherPaid = party==='owner' ? active.swap_initiator_paid : active.swap_owner_paid;
                                    const youSend    = party==='owner' ? active.listing_title : (swapData?.swap_title || 'din vare');
                                    const youReceive = party==='owner' ? (swapData?.swap_title || 'deres vare') : active.listing_title;
                                    const completed = active.deal_completed;
                                    return (
                                      <div style={{ marginTop:10, background:'#FFFBEB', border:`2px solid ${completed?PRIMARY:'#FDE68A'}`, borderRadius:14, padding:'14px' }}>
                                        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:INK, marginBottom:8 }}>{completed ? '🎉 Byttehandel gennemført!' : '🔄 Byttehandel godkendt'}</div>
                                        <div style={{ fontFamily:FONT, fontSize:12, color:INK2, lineHeight:1.7, marginBottom:10 }}>
                                          <div>📤 Du sender: <strong>{youSend}</strong></div>
                                          <div>📥 Du modtager: <strong>{youReceive}</strong></div>
                                        </div>
                                        {completed ? (
                                          <div style={{ fontFamily:FONT, fontSize:12, color:PRIMARY, fontWeight:700 }}>Begge har betalt — pakkemærkater er klar. Se forsendelsesbesked nedenfor.</div>
                                        ) : myPaid ? (
                                          <div style={{ fontFamily:FONT, fontSize:12, color:INK2 }}>
                                            <div style={{ color:PRIMARY, fontWeight:700 }}>✓ Du har betalt</div>
                                            <div style={{ color:INK3, marginTop:2 }}>{otherPaid ? 'Begge har betalt — afslutter…' : '⏳ Afventer den anden part betaler'}</div>
                                          </div>
                                        ) : (
                                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                            <div style={{ display:'flex', gap:6 }}>
                                              {[{k:'shipping',ic:'📦',l:'Send som pakke'},{k:'custom',ic:'🤝',l:'Aftalt levering'}].map(o=>(
                                                <button key={o.k} onClick={()=>setSwapDelivery(o.k)} style={{ flex:1, padding:'8px', borderRadius:10, border:`2px solid ${swapDelivery===o.k?PRIMARY:'#FDE68A'}`, background:swapDelivery===o.k?GREEN_TINT:'#fff', cursor:'pointer', fontFamily:FONT, fontSize:11, fontWeight:700, color:INK }}>{o.ic} {o.l}</button>
                                              ))}
                                            </div>
                                            <div style={{ fontFamily:FONT, fontSize:11, color:INK3, lineHeight:1.5 }}>
                                              {swapDelivery==='shipping' ? 'Du betaler porto for din vare + 10 kr byttebeskyttelse. Porto beregnes på betalingssiden.' : 'Du betaler 10 kr byttebeskyttelse. I aftaler selv leveringen.'}
                                              {' '}<button onClick={()=>setShowSwapProtection(true)} style={{ background:'none', border:'none', padding:0, color:PRIMARY, fontFamily:FONT, fontSize:11, fontWeight:700, textDecoration:'underline', cursor:'pointer' }}>Hvad er byttebeskyttelse?</button>
                                            </div>
                                            <button onClick={()=>{ if(!swapPaying) handleSwapPayment(swapDelivery); }} disabled={swapPaying} style={{ padding:'11px', borderRadius:99, background:swapPaying?PAPER3:PRIMARY, color:swapPaying?INK3:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:swapPaying?'default':'pointer' }}>{swapPaying ? 'Forbereder betaling…' : '💳 Gå til betaling'}</button>
                                            <div style={{ fontFamily:FONT, fontSize:11, color:INK3 }}>{otherPaid ? 'Den anden part har betalt ✓' : 'Den anden part har endnu ikke betalt'}</div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <div style={{ fontSize:10, color:INK3, marginTop:3, textAlign:mine?'right':'left', fontFamily:FONT }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                                </div>
                              </div>
                            ) : isBundle && bundleData ? (
                              <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                                {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:PRIMARY, flexShrink:0, marginRight:8, alignSelf:'flex-end', fontFamily:FONT }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                                <div style={{ maxWidth:'82%' }}>
                                  {!mine && <div style={{ fontSize:11, fontWeight:700, color:INK3, marginBottom:3, marginLeft:2, fontFamily:FONT }}>{m.sender_name}</div>}
                                  <div style={{
                                    background: m.bid_status==='accepted' ? GREEN_TINT : m.bid_status==='rejected' ? '#FEF2F2' : mine ? GREEN_TINT : PAPER3,
                                    border: `1.5px solid ${m.bid_status==='accepted' ? PRIMARY : m.bid_status==='rejected' ? '#FCA5A5' : mine ? PRIMARY : 'rgba(22,34,28,0.12)'}`,
                                    borderRadius:16, padding:'14px 16px', minWidth:220
                                  }}>
                                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                        <span style={{ fontSize:16 }}>📦</span>
                                        <span style={{ fontSize:11, fontWeight:700, color: m.bid_status==='accepted'?PRIMARY:m.bid_status==='rejected'?'#e11d48':PRIMARY, textTransform:'uppercase', letterSpacing:0.6, fontFamily:FONT }}>Bundttilbud</span>
                                      </div>
                                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                        {m.bid_status==='accepted' && <span style={{ fontSize:11, fontWeight:700, color:PRIMARY, background:'#D1FAE5', padding:'2px 8px', borderRadius:99, fontFamily:FONT }}>Accepteret</span>}
                                        {m.bid_status==='rejected' && <span style={{ fontSize:11, fontWeight:700, color:'#e11d48', background:'#FEE2E2', padding:'2px 8px', borderRadius:99, fontFamily:FONT }}>Afvist</span>}
                                      </div>
                                    </div>
                                    {bundleData.bundle_items?.length > 0 && (
                                      <div style={{ marginBottom:10 }}>
                                        <div style={{ fontSize:10, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:0.5, fontFamily:FONT, marginBottom:6 }}>Ønsker ({bundleData.bundle_items.length})</div>
                                        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                          {bundleData.bundle_items.map((item, idx) => (
                                            <div key={idx} style={{ display:'flex', alignItems:'center', gap:8, background:PAPER2, borderRadius:8, padding:'6px 8px' }}>
                                              <div style={{ width:28, height:28, borderRadius:6, background:item.image?PAPER3:(item.color||GREEN_TINT), flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                                                {item.image ? <img src={item.image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (item.emoji||'🧸')}
                                              </div>
                                              <div style={{ fontSize:12, fontWeight:600, color:INK, fontFamily:FONT, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {bundleData.offer_items?.length > 0 && (
                                      <div style={{ marginBottom: bundleData.note ? 10 : 0 }}>
                                        <div style={{ fontSize:10, fontWeight:700, color:CORAL, textTransform:'uppercase', letterSpacing:0.5, fontFamily:FONT, marginBottom:6 }}>Tilbyder ({bundleData.offer_items.length})</div>
                                        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                          {bundleData.offer_items.map((item, idx) => (
                                            <div key={idx} style={{ display:'flex', alignItems:'center', gap:8, background:PAPER2, borderRadius:8, padding:'6px 8px' }}>
                                              <div style={{ width:28, height:28, borderRadius:6, background:item.image?PAPER3:(item.color||GREEN_TINT), flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                                                {item.image ? <img src={item.image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (item.emoji||'🧸')}
                                              </div>
                                              <div style={{ fontSize:12, fontWeight:600, color:INK, fontFamily:FONT, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {(() => {
                                      const bTotal = bundleData.bundle_items?.reduce((s,i)=>s+(Number(i.price)||0),0)||0;
                                      const oTotal = bundleData.offer_items?.reduce((s,i)=>s+(Number(i.price)||0),0)||0;
                                      if (bTotal === 0 && oTotal === 0) return null;
                                      return (
                                        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, background:mine?'rgba(42,125,79,0.07)':PAPER2, borderRadius:10, padding:'10px 12px' }}>
                                          <div style={{ flex:1, textAlign:'center' }}>
                                            <div style={{ fontSize:9, color:INK3, fontWeight:700, fontFamily:FONT, marginBottom:2, textTransform:'uppercase', letterSpacing:0.5 }}>Ønsker</div>
                                            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:INK }}>{bTotal > 0 ? `${bTotal.toLocaleString('da-DK')} kr.` : '—'}</div>
                                          </div>
                                          <div style={{ fontSize:15, color:INK3 }}>⇄</div>
                                          <div style={{ flex:1, textAlign:'center' }}>
                                            <div style={{ fontSize:9, color:CORAL, fontWeight:700, fontFamily:FONT, marginBottom:2, textTransform:'uppercase', letterSpacing:0.5 }}>Tilbyder</div>
                                            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:CORAL }}>{oTotal > 0 ? `${oTotal.toLocaleString('da-DK')} kr.` : '—'}</div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    {bundleData.note && (
                                      <div style={{ fontSize:13, color:INK, lineHeight:1.5, fontFamily:FONT, marginTop:8, paddingTop:8, borderTop:`1px solid rgba(22,34,28,0.08)` }}>{bundleData.note}</div>
                                    )}
                                    {/* Accept / Reject — only for owner, only when pending */}
                                    {(!m.bid_status || m.bid_status === 'pending') && isOwnerInConv && !mine && (
                                      <div style={{ display:'flex', gap:8, marginTop:12, paddingTop:12, borderTop:`1px solid rgba(22,34,28,0.08)` }}>
                                        <button onClick={async () => {
                                          const senderName = effectiveSenderName();
                                          const effUid = realUserId || userId;
                                          await db.from('chat_messages').update({ bid_status: 'accepted' }).eq('id', m.id);

                                          // Fetch shipping options for checkout
                                          let shippingOptions = null;
                                          if (active.listing_id) {
                                            const { data: ld } = await db.from('listings').select('shipping_options').eq('id', active.listing_id).maybeSingle();
                                            shippingOptions = ld?.shipping_options?.[0] || null;
                                          }

                                          const bundleTotal = bundleData?.bundle_items?.reduce((s,i)=>s+(Number(i.price)||0),0)||0;
                                          const checkoutContent = JSON.stringify({
                                            listing_id: active.listing_id,
                                            listing_title: active.listing_title,
                                            deal_type: 'bundle',
                                            amount: bundleTotal,
                                            bundle_items: bundleData?.bundle_items,
                                            shipping_options: shippingOptions,
                                          });
                                          const previewMsg = `✅ ${senderName} har accepteret bundttilbuddet — vælg leveringsmetode for at afslutte.`;
                                          const { data: newMsg } = await db.from('chat_messages').insert({
                                            conversation_id: active.id,
                                            sender_id: effUid,
                                            sender_name: senderName,
                                            content: checkoutContent,
                                            message_type: 'checkout_pending',
                                          }).select().single();
                                          const now = new Date().toISOString();
                                          const upd = { last_message: previewMsg, last_message_at: now, initiator_unread: (active.initiator_unread||0)+1, is_handled: true, handled_at: now, handled_action: 'accepted' };
                                          await db.from('conversations').update(upd).eq('id', active.id);
                                          setActive(a => ({ ...a, ...upd }));
                                          setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
                                          setMessages(ms => [...ms.map(x => x.id === m.id ? { ...x, bid_status: 'accepted' } : x), ...(newMsg ? [newMsg] : [])]);
                                          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
                                        }} style={{ flex:1, padding:'8px 16px', borderRadius:99, background:PRIMARY, border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>
                                          Accepter
                                        </button>
                                        <button onClick={async () => {
                                          const senderName = effectiveSenderName();
                                          const effUid = realUserId || userId;
                                          await db.from('chat_messages').update({ bid_status: 'rejected' }).eq('id', m.id);
                                          const rejectMsg = `❌ ${senderName} har afvist dit bundttilbud.`;
                                          const { data: newMsg } = await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid, sender_name: senderName, content: rejectMsg }).select().single();
                                          const now = new Date().toISOString();
                                          const upd = { last_message: rejectMsg, last_message_at: now, initiator_unread: (active.initiator_unread||0)+1, is_handled: true, handled_at: now, handled_action: 'rejected' };
                                          await db.from('conversations').update(upd).eq('id', active.id);
                                          setActive(a => ({ ...a, ...upd }));
                                          setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
                                          setMessages(ms => [...ms.map(x => x.id === m.id ? { ...x, bid_status: 'rejected' } : x), ...(newMsg ? [newMsg] : [])]);
                                          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
                                        }} style={{ flex:1, padding:'8px 16px', borderRadius:99, background:'#FEF2F2', border:'1.5px solid #FCA5A5', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>
                                          Afvis
                                        </button>
                                      </div>
                                    )}
                                    {m.bid_status === 'accepted' && isOwnerInConv && bundleAcceptedAt[m.id] && (
                                      <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid rgba(22,34,28,0.08)` }}>
                                        <button onClick={async () => {
                                          if (Date.now() - bundleAcceptedAt[m.id] >= 5 * 60 * 1000) {
                                            setBundleAcceptedAt(prev => { const n={...prev}; delete n[m.id]; return n; });
                                            return;
                                          }
                                          const senderName = effectiveSenderName();
                                          const effUid = realUserId || userId;
                                          await db.from('chat_messages').update({ bid_status: 'pending' }).eq('id', m.id);
                                          const retractMsg = `↩️ ${senderName} har trukket sin accept af bundttilbuddet tilbage.`;
                                          const { data: newMsg } = await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid, sender_name: senderName, content: retractMsg }).select().single();
                                          const now = new Date().toISOString();
                                          const upd = { last_message: retractMsg, last_message_at: now, initiator_unread: (active.initiator_unread||0)+1, is_handled: false, handled_at: null, handled_action: null };
                                          await db.from('conversations').update(upd).eq('id', active.id);
                                          setActive(a => ({ ...a, ...upd }));
                                          setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
                                          setMessages(ms => [...ms.map(x => x.id === m.id ? { ...x, bid_status: 'pending' } : x), ...(newMsg ? [newMsg] : [])]);
                                          setBundleAcceptedAt(prev => { const n={...prev}; delete n[m.id]; return n; });
                                          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
                                        }} style={{ width:'100%', padding:'7px', borderRadius:99, background:'transparent', border:`1.5px solid ${PAPER3}`, color:INK3, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>
                                          Fortryd accept
                                        </button>
                                        <div style={{ fontSize:10, color:INK3, textAlign:'center', marginTop:4, fontFamily:FONT }}>Kan trækkes tilbage i 5 min.</div>
                                      </div>
                                    )}
                                    {(!m.bid_status || m.bid_status === 'pending') && !isOwnerInConv && !mine && (
                                      <div style={{ fontSize:12, color:INK3, fontWeight:600, fontFamily:FONT, marginTop:8 }}>Afventer svar…</div>
                                    )}
                                    {(!m.bid_status || m.bid_status === 'pending') && mine && (
                                      <div style={{ fontSize:12, color:INK3, fontWeight:600, fontFamily:FONT, marginTop:8 }}>Afventer svar…</div>
                                    )}
                                  </div>
                                  <div style={{ fontSize:10, color:INK3, marginTop:3, textAlign:mine?'right':'left', fontFamily:FONT }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                                </div>
                              </div>
                            ) : isOffer ? (() => {
                              const live = (offerData && offersById[offerData.offer_id]) || null;
                              const status = live?.status || 'pending';
                              const amount = (live?.amount ?? offerData?.amount) || 0;
                              const proposedBy = live?.proposed_by || (offerData?.counter ? (mine ? 'seller' : 'buyer') : 'buyer');
                              const canRespond = status === 'pending' && !!live &&
                                ((proposedBy === 'buyer' && isOwnerInConv) || (proposedBy === 'seller' && !isOwnerInConv));
                              const badge = status==='accepted' ? ['Accepteret', PRIMARY, '#D1FAE5']
                                : status==='rejected' ? ['Afvist', '#e11d48', '#FEE2E2']
                                : status==='countered' ? ['Modbud sendt', '#B45309', '#FEF9C3']
                                : status==='cancelled' ? ['Erstattet', INK3, PAPER3]
                                : status==='completed' ? ['Gennemført', PRIMARY, '#D1FAE5'] : null;
                              const accepted = status==='accepted' || status==='completed';
                              return (
                                <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                                  {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:PRIMARY, flexShrink:0, marginRight:8, alignSelf:'flex-end', fontFamily:FONT }}>{(m.sender_name||'?').charAt(0).toUpperCase()}</div>}
                                  <div style={{ maxWidth:'78%' }}>
                                    {!mine && <div style={{ fontSize:11, fontWeight:700, color:INK3, marginBottom:3, marginLeft:2, fontFamily:FONT }}>{m.sender_name}</div>}
                                    <div style={{ background: accepted ? GREEN_TINT : status==='rejected' ? '#FEF2F2' : mine ? '#EEF4FF' : PAPER3, border:`2px solid ${accepted ? PRIMARY : status==='rejected' ? '#FCA5A5' : mine ? '#93C5FD' : 'rgba(22,34,28,0.12)'}`, borderRadius:16, padding:'14px 16px' }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                        <span style={{ fontSize:18 }}>🏷️</span>
                                        <span style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color: status==='rejected' ? '#e11d48' : PRIMARY }}>{amount} kr.</span>
                                        <span style={{ fontSize:12, color:INK3, fontWeight:600, fontFamily:FONT }}>{offerData?.counter ? 'modbud' : 'tilbud'}</span>
                                        {badge && <span style={{ fontSize:11, fontWeight:700, color:badge[1], background:badge[2], padding:'2px 8px', borderRadius:99, fontFamily:FONT }}>{badge[0]}</span>}
                                      </div>
                                      {canRespond && (
                                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                                          <button onClick={()=>handleOfferRespond(live,'accept')} style={{ padding:'8px 16px', borderRadius:99, background:PRIMARY, border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Accepter</button>
                                          <button onClick={()=>{ const n = window.prompt('Begrundelse (valgfrit)') || ''; handleOfferRespond(live,'reject',{ note:n }); }} style={{ padding:'8px 16px', borderRadius:99, background:'#FEF2F2', border:'1.5px solid #FCA5A5', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Afvis</button>
                                          <button onClick={()=>{ const v = window.prompt('Dit modbud (kr.)'); const a = Number(v); if (a > 0) handleOfferRespond(live,'counter',{ counterAmount:a }); }} style={{ padding:'8px 16px', borderRadius:99, background:'#FFFBEB', border:'1.5px solid #FDE68A', color:'#B45309', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Modbud</button>
                                        </div>
                                      )}
                                      {status==='pending' && !canRespond && (
                                        <div style={{ fontSize:12, color:INK3, fontWeight:600, fontFamily:FONT, marginTop:8 }}>Afventer svar…</div>
                                      )}
                                    </div>
                                    <div style={{ fontSize:10, color:INK3, marginTop:3, textAlign:mine?'right':'left', fontFamily:FONT }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                                  </div>
                                </div>
                              );
                            })() : isBid ? (
                              <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                                {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:PRIMARY, flexShrink:0, marginRight:8, alignSelf:'flex-end', fontFamily:FONT }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                                <div style={{ maxWidth:'78%' }}>
                                  {!mine && <div style={{ fontSize:11, fontWeight:700, color:INK3, marginBottom:3, marginLeft:2, fontFamily:FONT }}>{m.sender_name}</div>}
                                  <div style={{
                                    background: m.bid_status==='accepted' ? GREEN_TINT : m.bid_status==='rejected' ? '#FEF2F2' : mine ? '#EEF4FF' : PAPER3,
                                    border: `2px solid ${m.bid_status==='accepted' ? PRIMARY : m.bid_status==='rejected' ? '#FCA5A5' : mine ? '#93C5FD' : 'rgba(22,34,28,0.12)'}`,
                                    borderRadius:16, padding:'14px 16px'
                                  }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                      <div style={{ width:28, height:28, borderRadius:'50%', background: m.bid_status==='accepted'?PRIMARY:m.bid_status==='rejected'?'#EF4444':'#3B82F6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                                          {m.bid_status==='accepted' ? <polyline points="20 6 9 17 4 12"/> : m.bid_status==='rejected' ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>}
                                        </svg>
                                      </div>
                                      <span style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color: m.bid_status==='accepted'?PRIMARY:m.bid_status==='rejected'?'#e11d48':'#2563EB' }}>{m.bid_amount} kr.</span>
                                      <span style={{ fontSize:12, color:INK3, fontWeight:600, fontFamily:FONT }}>bud</span>
                                      {m.bid_status==='accepted' && <span style={{ fontSize:11, fontWeight:700, color:PRIMARY, background:'#D1FAE5', padding:'2px 8px', borderRadius:99, fontFamily:FONT }}>Accepteret</span>}
                                      {m.bid_status==='rejected' && <span style={{ fontSize:11, fontWeight:700, color:'#e11d48', background:'#FEE2E2', padding:'2px 8px', borderRadius:99, fontFamily:FONT }}>Afvist</span>}
                                      {m.bid_status==='countered' && <span style={{ fontSize:11, fontWeight:700, color:'#B45309', background:'#FEF9C3', padding:'2px 8px', borderRadius:99, fontFamily:FONT }}>Modbud sendt</span>}
                                    </div>
                                    {m.bid_note && <div style={{ fontSize:12, color:INK3, marginBottom:8, fontStyle:'italic', fontFamily:FONT }}>"{m.bid_note}"</div>}
                                    {m.bid_status === 'pending' && isOwnerInConv && !mine && (
                                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                                        <button onClick={()=>handleAcceptBid(m)} style={{ padding:'8px 16px', borderRadius:99, background:PRIMARY, border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Accepter</button>
                                        <button onClick={()=>{ setRejectingBid(m); setRejectNote(''); }} style={{ padding:'8px 16px', borderRadius:99, background:'#FEF2F2', border:'1.5px solid #FCA5A5', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Afvis</button>
                                        <button onClick={()=>{ setCounterBidMsg(m); setCounterAmount(''); }} style={{ padding:'8px 16px', borderRadius:99, background:'#FFFBEB', border:'1.5px solid #FDE68A', color:'#B45309', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Modbud</button>
                                      </div>
                                    )}
                                    {m.bid_status === 'pending' && (!isOwnerInConv || mine) && (
                                      <div style={{ fontSize:12, color:INK3, fontWeight:600, fontFamily:FONT }}>Afventer svar…</div>
                                    )}
                                  </div>
                                  <div style={{ fontSize:10, color:INK3, marginTop:3, textAlign:mine?'right':'left', fontFamily:FONT }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                                </div>
                              </div>
                            ) : isImage && imageData ? (
                              <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                                {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:PRIMARY, flexShrink:0, marginRight:8, alignSelf:'flex-end', fontFamily:FONT }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                                <div style={{ maxWidth:'68%' }}>
                                  {!mine && <div style={{ fontSize:11, fontWeight:700, color:INK3, marginBottom:3, marginLeft:2, fontFamily:FONT }}>{m.sender_name}</div>}
                                  <div style={{ borderRadius:16, overflow:'hidden', border:`1px solid rgba(22,34,28,0.1)` }}>
                                    <div style={{ display:'grid', gridTemplateColumns:imageData.urls?.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap:2 }}>
                                      {(imageData.urls || []).map((url, idx) => (
                                        <img key={idx} src={url} onClick={()=>setFullsizeImage(url)}
                                          style={{ width:'100%', aspectRatio:'1/1', objectFit:'cover', cursor:'pointer', display:'block', maxWidth:220 }} alt="" />
                                      ))}
                                    </div>
                                    {imageData.caption && (
                                      <div style={{ background:mine?PRIMARY:PAPER3, color:mine?'#fff':INK, padding:'8px 12px', fontSize:14, lineHeight:1.5, fontFamily:FONT }}>{imageData.caption}</div>
                                    )}
                                  </div>
                                  <div style={{ fontSize:10, color:INK3, marginTop:3, textAlign:mine?'right':'left', fontFamily:FONT }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                                </div>
                              </div>
                            ) : isShipment && shipmentData ? (
                              <div style={{ margin:'16px 0' }}>
                                <div style={{ background:GREEN_TINT, border:`2px solid ${PRIMARY}`, borderRadius:16, padding:'16px 18px' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                                    <span style={{ fontSize:22 }}>📦</span>
                                    <div>
                                      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:INK }}>Pakke på vej!</div>
                                      <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:1 }}>
                                        {d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})} · {d.toLocaleDateString('da-DK',{day:'numeric',month:'short'})}
                                      </div>
                                    </div>
                                  </div>
                                  {shipmentData.tracking_number && (
                                    <div style={{ background:'rgba(42,125,79,0.1)', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
                                      <div style={{ fontFamily:FONT, fontSize:11, fontWeight:700, color:PRIMARY, textTransform:'uppercase', letterSpacing:0.5, marginBottom:3 }}>Trackingnummer</div>
                                      <div style={{ fontFamily:FONT, fontSize:16, fontWeight:800, color:INK, letterSpacing:0.5 }}>{shipmentData.tracking_number}</div>
                                    </div>
                                  )}
                                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                    {shipmentData.tracking_url && (
                                      <a href={shipmentData.tracking_url} target="_blank" rel="noreferrer"
                                        style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 14px', borderRadius:99, background:PRIMARY, color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:13, textDecoration:'none' }}>
                                        Følg pakken →
                                      </a>
                                    )}
                                    {shipmentData.label_pdf_url && isOwnerInConv && (
                                      <a href={shipmentData.label_pdf_url} target="_blank" rel="noreferrer"
                                        style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 14px', borderRadius:99, background:PAPER3, color:INK, fontFamily:FONT, fontWeight:700, fontSize:13, textDecoration:'none', border:`1.5px solid rgba(22,34,28,0.12)` }}>
                                        🖨️ Print label
                                      </a>
                                    )}
                                  </div>
                                  {isOwnerInConv && (
                                    <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(42,125,79,0.07)', borderRadius:10 }}>
                                      <div style={{ fontFamily:FONT, fontSize:12, fontWeight:700, color:INK, marginBottom:4 }}>Næste skridt som sælger</div>
                                      <ol style={{ margin:0, paddingLeft:16, fontFamily:FONT, fontSize:12, color:INK2, lineHeight:1.8 }}>
                                        <li>Print forsendelseslabelen</li>
                                        <li>Klæb den på pakken</li>
                                        <li>Aflevér pakken på nærmeste udleveringssted</li>
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : isPaymentConfirmed && paymentData ? (
                              <div style={{ margin:'16px 0' }}>
                                <div style={{ background:GREEN_TINT, border:`2px solid ${PRIMARY}`, borderRadius:16, padding:'16px 18px' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                                    <span style={{ fontSize:22 }}>✅</span>
                                    <div>
                                      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:INK }}>Betaling bekræftet</div>
                                      <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:1 }}>
                                        {d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})} · {d.toLocaleDateString('da-DK',{day:'numeric',month:'short'})}
                                      </div>
                                    </div>
                                  </div>
                                  {(paymentData.items || []).map((item, ii) => (
                                    <div key={ii} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                                      <span style={{ fontFamily:FONT, fontSize:13, color:INK }}>{item.emoji || '📦'} {item.title}</span>
                                      <span style={{ fontFamily:FONT, fontSize:13, color:INK, fontWeight:700 }}>{item.price} kr.</span>
                                    </div>
                                  ))}
                                  <div style={{ borderTop:`1px solid rgba(42,125,79,0.2)`, marginTop:10, paddingTop:10 }}>
                                    {paymentData.shippingTotal > 0 && (
                                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                                        <span style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>Levering</span>
                                        <span style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>{paymentData.shippingTotal} kr.</span>
                                      </div>
                                    )}
                                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                                      <span style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:INK }}>I alt betalt</span>
                                      <span style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:PRIMARY }}>{((paymentData.itemTotal || 0) + (paymentData.shippingTotal || 0) + (paymentData.serviceFee || 0)).toFixed(2).replace('.',',')} kr.</span>
                                    </div>
                                  </div>
                                  {paymentData.pickupPoint && (
                                    <div style={{ marginTop:10, fontFamily:FONT, fontSize:12, color:INK3 }}>
                                      📍 Afhentes: {paymentData.pickupPoint.name}{paymentData.pickupPoint.address ? `, ${paymentData.pickupPoint.address}` : ''}
                                    </div>
                                  )}
                                  {paymentData.tracking?.label_pdf_url && isOwnerInConv && (
                                    <a href={paymentData.tracking.label_pdf_url} target="_blank" rel="noreferrer"
                                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:12, padding:'10px 14px', borderRadius:99, background:PRIMARY, color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:13, textDecoration:'none' }}>
                                      🖨️ Download pakkemærkat
                                    </a>
                                  )}
                                  {!paymentData.tracking?.label_pdf_url && isOwnerInConv && paymentData.shippingMethod && paymentData.shippingMethod !== 'pickup' && paymentData.shippingMethod !== 'custom' && (
                                    <div style={{ marginTop:10, background:'rgba(42,125,79,0.07)', borderRadius:10, padding:'10px 12px', fontFamily:FONT, fontSize:12, color:INK2 }}>
                                      Pakkemærkaten er sendt til din e-mail — tjek din indbakke.
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:grouped?2:10 }}>
                                {!mine && !grouped && <div style={{ width:30, height:30, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:PRIMARY, flexShrink:0, marginRight:8, alignSelf:'flex-end', fontFamily:FONT }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                                {!mine && grouped && <div style={{ width:30, marginRight:8, flexShrink:0 }} />}
                                <div style={{ maxWidth:'68%' }}>
                                  {!mine && !grouped && <div style={{ fontSize:11, fontWeight:700, color:INK3, marginBottom:3, marginLeft:2, fontFamily:FONT }}>{m.sender_name}</div>}
                                  <div style={{ background:mine?PRIMARY:PAPER3, color:mine?'#fff':INK, borderRadius:mine?'18px 18px 4px 18px':'18px 18px 18px 4px', padding:'10px 14px', fontSize:14, lineHeight:1.5, wordBreak:'break-word', boxShadow:'0 1px 2px rgba(22,34,28,0.06)', fontFamily:FONT }}>
                                    {m.content}
                                  </div>
                                  <div style={{ fontSize:10, color:INK3, marginTop:3, textAlign:mine?'right':'left', marginLeft:mine?0:2, fontFamily:FONT }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                <div ref={bottomRef} />
              </div>

              {/* Pinned shipment strip — seller only */}
              {shipmentInfo && (() => {
                const _myInstId   = ctxInstId || ctxInstitution?.id;
                const _myInstName = ctxInstitution?.name;
                const isOwner = (ctxIsAdmin && adminInstName)
                  ? active?.owner_name === adminInstName
                  : active?.owner_id === userId
                    || (_myInstId   && active?.owner_institution_id === _myInstId)
                    || (_myInstName && active?.owner_name?.toLowerCase() === _myInstName?.toLowerCase());
                if (!isOwner) return null;
                return (
                  <div style={{ borderTop:`1.5px solid ${PRIMARY}`, background:GREEN_TINT, padding:'10px 16px', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:16 }}>📦</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:INK }}>Forsendelse booket</div>
                      {shipmentInfo.tracking_number && <div style={{ fontFamily:FONT, fontSize:11, color:INK3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shipmentInfo.tracking_number}</div>}
                    </div>
                    {shipmentInfo.label_pdf_url && (
                      <a href={shipmentInfo.label_pdf_url} target="_blank" rel="noreferrer"
                        style={{ padding:'6px 12px', borderRadius:99, background:PRIMARY, color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:11, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}>
                        🖨️ Print label
                      </a>
                    )}
                    {shipmentInfo.tracking_url && (
                      <a href={shipmentInfo.tracking_url} target="_blank" rel="noreferrer"
                        style={{ padding:'6px 12px', borderRadius:99, background:PAPER3, color:INK, fontFamily:FONT, fontWeight:700, fontSize:11, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0, border:`1px solid rgba(22,34,28,0.1)` }}>
                        Spor →
                      </a>
                    )}
                  </div>
                );
              })()}

              {/* Reject bar */}
              {rejectingBid && (
                <div style={{ borderTop:`1px solid #FECACA`, background:'#FEF2F2', padding:'14px 16px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#B91C1C', marginBottom:8, fontFamily:FONT }}>Afvis bud på {rejectingBid.bid_amount} kr.</div>
                  <textarea value={rejectNote} onChange={e=>setRejectNote(e.target.value)} placeholder="Evt. kommentar (valgfri)" rows={2} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #FCA5A5', fontSize:13, resize:'none', fontFamily:FONT, outline:'none', marginBottom:8 }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>setRejectingBid(null)} style={{ flex:1, padding:'8px', borderRadius:99, background:PAPER3, border:'none', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:FONT }}>Annuller</button>
                    <button onClick={handleRejectBid} style={{ flex:1, padding:'8px', borderRadius:99, background:'#e11d48', border:'none', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:FONT }}>Bekræft afvisning</button>
                  </div>
                </div>
              )}

              {/* Counter bid bar */}
              {counterBidMsg && (
                <div style={{ borderTop:`1px solid #FDE68A`, background:'#FFFBEB', padding:'14px 16px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#7A5C00', marginBottom:8, fontFamily:FONT }}>Send modbud (originalt bud: {counterBidMsg.bid_amount} kr.)</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="number" value={counterAmount} onChange={e=>setCounterAmount(e.target.value)} placeholder="Dit modbud (kr.)" style={{ flex:1, padding:'9px 12px', borderRadius:10, border:'1.5px solid #FDE68A', fontSize:14, fontWeight:700, outline:'none', fontFamily:FONT }} />
                    <button onClick={()=>setCounterBidMsg(null)} style={{ padding:'8px 14px', borderRadius:99, background:PAPER3, border:'none', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:FONT }}>✕</button>
                    <button onClick={handleCounterBid} disabled={!counterAmount} style={{ padding:'8px 16px', borderRadius:99, background:counterAmount?PRIMARY:PAPER3, border:'none', color:counterAmount?'#fff':INK3, fontWeight:700, fontSize:13, cursor:counterAmount?'pointer':'default', fontFamily:FONT }}>Send</button>
                  </div>
                </div>
              )}

              {/* Input bar */}
              <div style={{ borderTop:`1px solid rgba(22,34,28,0.08)`, background: isMobile ? PAPER : PAPER2, position:'relative' }}>
                {uploadError && (
                  <div style={{ background:'#FEF2F2', borderTop:'1px solid #FCA5A5', padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <span style={{ fontSize:12, color:'#B91C1C', fontFamily:FONT, fontWeight:600 }}>⚠ {uploadError}</span>
                    <button onClick={()=>setUploadError(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#B91C1C', fontSize:14, padding:0 }}>✕</button>
                  </div>
                )}
                {emojiOpen && (
                  <div style={{ position:'absolute', bottom:'100%', left:0, right:0, background:PAPER2, borderTop:`1px solid rgba(22,34,28,0.08)`, padding:'10px 12px', display:'flex', flexWrap:'wrap', gap:4 }}>
                    {EMOJI_LIST.map(em => (
                      <button key={em} onClick={()=>{ setNewMsg(msg=>msg+em); setEmojiOpen(false); inputRef.current?.focus(); }}
                        style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', padding:'4px', borderRadius:8, lineHeight:1 }}>{em}</button>
                    ))}
                  </div>
                )}
                {chatImages.length > 0 && (
                  <div style={{ padding:'8px 16px 0', display:'flex', gap:6, flexWrap:'wrap' }}>
                    {chatImages.map((file, idx) => (
                      <div key={idx} style={{ position:'relative', width:52, height:52, borderRadius:8, overflow:'hidden', border:`1.5px solid ${PAPER3}` }}>
                        <img src={URL.createObjectURL(file)} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                        <button onClick={()=>setChatImages(imgs=>imgs.filter((_,i)=>i!==idx))}
                          style={{ position:'absolute', top:2, right:2, width:16, height:16, borderRadius:'50%', background:'rgba(22,34,28,0.6)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:10, lineHeight:1, padding:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ padding:'12px 16px', display:'flex', gap:8, alignItems:'flex-end' }}>
                  <button onClick={()=>setEmojiOpen(v=>!v)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:'8px', borderRadius:10, flexShrink:0, color:INK3, lineHeight:1, height:44, display:'flex', alignItems:'center' }}>😊</button>
                  <button onClick={()=>fileInputRef.current?.click()} title="Vedhæft billede"
                    style={{ background:'none', border:'none', cursor:'pointer', padding:'8px', borderRadius:10, flexShrink:0, color:chatImages.length>0?PRIMARY:INK3, lineHeight:1, height:44, display:'flex', alignItems:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </button>
                  <textarea ref={inputRef} value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={onKey}
                    placeholder="Skriv en besked…" rows={1}
                    style={{ flex:1, padding:'11px 14px', borderRadius:14, border:`1.5px solid ${PAPER3}`, fontSize:14, resize:'none', fontFamily:FONT, outline:'none', lineHeight:1.5, maxHeight:120, minHeight:44, overflowY:'auto', background:PAPER }}
                    onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                  />
                  <button onClick={send} disabled={(!newMsg.trim()&&chatImages.length===0)||sending}
                    style={{ width:44, height:44, borderRadius:14, background:(newMsg.trim()||chatImages.length>0)?PRIMARY:PAPER3, border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:(newMsg.trim()||chatImages.length>0)?'pointer':'default', transition:'background 0.2s', flexShrink:0 }}>
                    {sending ? <Spinner /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={(newMsg.trim()||chatImages.length>0)?'#fff':INK3} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>}
      </div>

      {/* Byttebeskyttelse-popup */}
      {showSwapProtection && <TradeProtectionPopup onClose={()=>setShowSwapProtection(false)} />}

      {/* Transportørvalg-modal — åbnes når køber klikker "Gå til betaling" på et bud med forsendelse */}
      {carrierPickerMsg && (() => {
        const msg = carrierPickerMsg;
        const sel = bidCarrier[msg.id] || 'parcel_shop_gls';
        const paying = goingToPayment === msg.id;
        const carriers = [
          { k:'parcel_shop_gls', ic:'🟡', l:'GLS pakkeshop', desc:'Hurtig og billig, afleveres i nærmeste GLS-butik' },
          { k:'parcel_shop_pdk', ic:'🔴', l:'PostNord pakkeshop', desc:'Afhentes i PostNord-punkt eller posthus' },
          { k:'parcel_shop_dao', ic:'🔵', l:'DAO pakkeshop', desc:'Leveres til en lokal DAO-pakkeshop' },
        ];
        return (
          <div onClick={()=>{ if(!paying) setCarrierPickerMsg(null); }} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.55)', zIndex:2000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:PAPER2, borderRadius:'24px 24px 0 0', padding:'28px 24px 40px', width:'100%', maxWidth:520, boxShadow:'0 -8px 32px rgba(22,34,28,0.16)' }}>
              <div style={{ width:40, height:4, borderRadius:99, background:PAPER3, margin:'0 auto 24px' }} />
              <h3 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, marginBottom:6 }}>Vælg afhentningssted</h3>
              <p style={{ fontFamily:FONT, fontSize:13, color:INK3, marginBottom:20, lineHeight:1.5 }}>Vælg hvilken transportør og pakkeshop du vil have pakken leveret til.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
                {carriers.map(o => (
                  <button key={o.k} onClick={()=>setBidCarrier(prev=>({...prev,[msg.id]:o.k}))}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:14, border:`2px solid ${sel===o.k?PRIMARY:'rgba(22,34,28,0.10)'}`, background:sel===o.k?GREEN_TINT:PAPER, cursor:'pointer', textAlign:'left', transition:'all 0.12s' }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>{o.ic}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK }}>{o.l}</div>
                      <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:2 }}>{o.desc}</div>
                    </div>
                    <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${sel===o.k?PRIMARY:'rgba(22,34,28,0.20)'}`, background:sel===o.k?PRIMARY:'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {sel===o.k && <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={()=>{ if(!paying) { handleBidPayment(msg, sel); setCarrierPickerMsg(null); } }}
                disabled={paying}
                style={{ width:'100%', padding:'15px', borderRadius:99, background:paying?PAPER3:PRIMARY, border:'none', color:paying?INK3:'#fff', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:paying?'default':'pointer' }}>
                {paying ? 'Forbereder betaling…' : '💳 Bekræft og gå til betaling'}
              </button>
              {!paying && <button onClick={()=>setCarrierPickerMsg(null)} style={{ width:'100%', marginTop:12, padding:'12px', borderRadius:99, background:'transparent', border:'none', color:INK3, fontFamily:FONT, fontWeight:600, fontSize:14, cursor:'pointer' }}>Annuller</button>}
            </div>
          </div>
        );
      })()}

      {/* Swap preview modal */}
      {swapPreview && (
        <div onClick={()=>setSwapPreview(null)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:PAPER2, borderRadius:24, padding:28, maxWidth:480, width:'100%', boxShadow:'0 16px 48px rgba(22,34,28,0.18)', position:'relative', maxHeight:'80vh', overflowY:'auto', border:'1px solid rgba(22,34,28,0.08)' }}>
            <button onClick={()=>setSwapPreview(null)} style={{ position:'absolute', top:16, right:16, background:PAPER3, border:'none', borderRadius:99, width:32, height:32, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:INK3 }}>✕</button>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:CORAL, textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 }}>Tilbudt i bytte</div>
            <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:16, background:swapPreview.images?.[0]?PAPER3:swapPreview.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:64, marginBottom:16, overflow:'hidden' }}>
              {swapPreview.images?.[0] ? <img src={swapPreview.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : swapPreview.emoji||'🧸'}
            </div>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:22, marginBottom:6, color:INK }}>{swapPreview.title}</h2>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
              <span style={{ fontSize:13, color:INK3, fontFamily:FONT }}>{swapPreview.city}</span>
              <span style={{ fontSize:13, color:INK3, fontFamily:FONT }}>{swapPreview.age_group}</span>
              <span style={{ fontSize:13, color:INK3, fontWeight:600, fontFamily:FONT }}>Stand: {swapPreview.condition}</span>
            </div>
            {swapPreview.description && <p style={{ fontSize:14, color:INK, lineHeight:1.75, marginBottom:16, fontFamily:FONT }}>{swapPreview.description}</p>}
            <div style={{ fontSize:13, color:INK3, fontFamily:FONT }}>Opslået af <strong style={{ color:INK }}>{swapPreview.institution_name}</strong></div>
            <button onClick={()=>{ setSwapPreview(null); setActiveListing(swapPreview); router.push('/opslag/detail'); }}
              style={{ marginTop:16, width:'100%', padding:'13px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:FONT }}>
              Se fuldt opslag →
            </button>
          </div>
        </div>
      )}

      {/* Fullsize image modal */}
      {fullsizeImage && (
        <div onClick={()=>setFullsizeImage(null)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.88)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <button onClick={()=>setFullsizeImage(null)} style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.15)', border:'none', borderRadius:99, width:36, height:36, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>✕</button>
          <img src={fullsizeImage} onClick={e=>e.stopPropagation()} style={{ maxWidth:'100%', maxHeight:'90vh', borderRadius:12, objectFit:'contain', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' }} alt="" />
        </div>
      )}

      {/* Conversation options sheet (Detaljer) */}
      {convMenuOpen && active && (
        <div onClick={()=>setConvMenuOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.5)', zIndex:2500, display:'flex', alignItems: isMobile?'flex-end':'center', justifyContent:'center', padding: isMobile?0:24, animation:'fadeIn 0.18s ease' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:PAPER2, borderRadius: isMobile?'20px 20px 0 0':20, width:'100%', maxWidth: isMobile?'100%':380, boxShadow:'0 16px 48px rgba(22,34,28,0.2)', overflow:'hidden', paddingBottom: isMobile?'env(safe-area-inset-bottom, 0px)':0 }}>
            <div style={{ padding:'18px 20px 12px', borderBottom:`1px solid rgba(22,34,28,0.08)`, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:active.listing_image?PAPER3:active.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, overflow:'hidden' }}>
                {active.listing_image ? <img src={active.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : active.listing_emoji||'🧸'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:INK, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{active.listing_title}</div>
                <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>med {otherName(active)}</div>
              </div>
              <button onClick={()=>setConvMenuOpen(false)} style={{ background:PAPER3, border:'none', borderRadius:99, width:30, height:30, fontSize:14, cursor:'pointer', color:INK3, flexShrink:0 }}>✕</button>
            </div>
            <div style={{ padding:'8px 0 12px' }}>
              {(() => {
                const itemStyle = { display:'flex', alignItems:'center', gap:14, width:'100%', padding:'13px 20px', background:'none', border:'none', cursor:'pointer', fontFamily:FONT, fontSize:15, fontWeight:600, color:INK, textAlign:'left' };
                const archived = isArchived(active);
                const unread = myUnread(active);
                const Item = ({ icon, label, color, onClick }) => (
                  <button onClick={onClick} style={{ ...itemStyle, color: color||INK }}
                    onMouseEnter={e=>e.currentTarget.style.background=PAPER3}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}>
                    <span style={{ width:22, display:'flex', justifyContent:'center', flexShrink:0 }}>{icon}</span>{label}
                  </button>
                );
                return (
                  <>
                    {active.listing_id && (
                      <Item icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                        label="Se opslag" onClick={()=>{ setConvMenuOpen(false); openActiveListing(); }} />
                    )}
                    <Item icon={unread>0
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill={INK2}/></svg>}
                      label={unread>0 ? 'Markér som læst' : 'Markér som ulæst'}
                      onClick={()=>{ toggleReadUnread(active, { stopPropagation:()=>{} }); setConvMenuOpen(false); }} />
                    <Item icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>}
                      label={archived ? 'Flyt til indbakke' : 'Arkivér samtale'}
                      onClick={()=>{ (archived?unarchiveConv:archiveConv)(active, { stopPropagation:()=>{} }); setConvMenuOpen(false); }} />
                    <div style={{ height:1, background:'rgba(22,34,28,0.08)', margin:'6px 20px' }} />
                    <Item icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>}
                      label="Rapportér samtale" color="#B45309"
                      onClick={()=>{ setReportTarget(active); setReportReason(''); setReportNote(''); setReportDone(false); setConvMenuOpen(false); }} />
                    <Item icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>}
                      label="Slet samtale" color="#e11d48"
                      onClick={()=>{ setConvMenuOpen(false); setDeleteTarget({ conv: active }); }} />
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Report conversation modal */}
      {reportTarget && (
        <div onClick={()=>setReportTarget(null)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.55)', zIndex:2600, display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'fadeIn 0.18s ease' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:PAPER2, borderRadius:22, padding:24, maxWidth:420, width:'100%', boxShadow:'0 16px 48px rgba(22,34,28,0.2)', maxHeight:'85vh', overflowY:'auto' }}>
            {reportDone ? (
              <div style={{ textAlign:'center', padding:'12px 0' }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, marginBottom:6 }}>Tak for din rapport</h3>
                <p style={{ fontFamily:FONT, fontSize:14, color:INK3, lineHeight:1.5, marginBottom:18 }}>byt&leg gennemgår samtalen hurtigst muligt. Vi kontakter dig hvis vi har brug for mere information.</p>
                <button onClick={()=>setReportTarget(null)} style={{ width:'100%', padding:'13px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:'pointer' }}>Luk</button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <h3 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK }}>Rapportér samtale</h3>
                  <button onClick={()=>setReportTarget(null)} style={{ background:PAPER3, border:'none', borderRadius:99, width:30, height:30, fontSize:14, cursor:'pointer', color:INK3 }}>✕</button>
                </div>
                <p style={{ fontFamily:FONT, fontSize:13, color:INK3, marginBottom:16 }}>Hjælp os med at holde byt&leg trygt. Hvad er der galt med samtalen med <strong style={{ color:INK }}>{otherName(reportTarget)}</strong>?</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {REPORT_REASONS.map(r => (
                    <button key={r} onClick={()=>setReportReason(r)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, border:`1.5px solid ${reportReason===r?PRIMARY:PAPER3}`, background:reportReason===r?GREEN_TINT:PAPER, cursor:'pointer', textAlign:'left', fontFamily:FONT, fontSize:14, fontWeight:600, color:INK }}>
                      <span style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${reportReason===r?PRIMARY:PAPER3}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {reportReason===r && <span style={{ width:9, height:9, borderRadius:'50%', background:PRIMARY }} />}
                      </span>
                      {r}
                    </button>
                  ))}
                </div>
                <textarea value={reportNote} onChange={e=>setReportNote(e.target.value)} placeholder="Uddyb gerne (valgfri)…" rows={3}
                  style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:14, resize:'none', fontFamily:FONT, outline:'none', background:PAPER, marginBottom:16, boxSizing:'border-box' }} />
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={()=>setReportTarget(null)} style={{ flex:1, padding:'13px', borderRadius:99, background:PAPER3, border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer', color:INK }}>Annuller</button>
                  <button onClick={submitReport} disabled={!reportReason||reportSending} style={{ flex:2, padding:'13px', borderRadius:99, background:reportReason?'#B45309':PAPER3, border:'none', color:reportReason?'#fff':INK3, fontFamily:FONT, fontWeight:700, fontSize:14, cursor:reportReason&&!reportSending?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    {reportSending ? <><Spinner />Sender…</> : 'Send rapport'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div onClick={()=>!deleting&&setDeleteTarget(null)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.55)', zIndex:2600, display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'fadeIn 0.18s ease' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:PAPER2, borderRadius:22, padding:24, maxWidth:380, width:'100%', boxShadow:'0 16px 48px rgba(22,34,28,0.2)' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </div>
            <h3 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, marginBottom:8 }}>
              {deleteTarget.all ? `Slet ${convs.filter(c=>isArchived(c)).length} arkiverede samtaler?` : 'Slet denne samtale?'}
            </h3>
            <p style={{ fontFamily:FONT, fontSize:14, color:INK3, lineHeight:1.5, marginBottom:20 }}>
              {deleteTarget.all
                ? 'Alle arkiverede samtaler og deres beskeder slettes permanent. Dette kan ikke fortrydes.'
                : <>Samtalen med <strong style={{ color:INK }}>{otherName(deleteTarget.conv)}</strong> og alle beskeder slettes permanent. Dette kan ikke fortrydes.</>}
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setDeleteTarget(null)} disabled={deleting} style={{ flex:1, padding:'13px', borderRadius:99, background:PAPER3, border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:deleting?'default':'pointer', color:INK }}>Annuller</button>
              <button onClick={performDelete} disabled={deleting} style={{ flex:1, padding:'13px', borderRadius:99, background:'#e11d48', border:'none', color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:deleting?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {deleting ? <><Spinner />Sletter…</> : 'Slet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
