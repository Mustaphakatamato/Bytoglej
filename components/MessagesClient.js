'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK3, CORAL } from '@/lib/constants';
import { useWindowWidth, relTime } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Badge, Btn, Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";

export default function MessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedConvId, setSelectedConvId, setActiveListing } = useApp();
  const { isAdminView: ctxIsAdmin, adminInstName, institution: ctxInstitution, institutionId: ctxInstId, realUserId, userId: ctxUserId } = useActiveUser();

  const [userId,      setUserId]      = useState(null);
  const [userEmail,   setUserEmail]   = useState(null);
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
  const [swapPreview,  setSwapPreview]  = useState(null);
  const [shares,      setShares]      = useState([]);
  const [activeShare, setActiveShare] = useState(null);
  const [draftConv,    setDraftConv]    = useState(null);
  const [chatImages,   setChatImages]   = useState([]);
  const [fullsizeImage,setFullsizeImage]= useState(null);
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const EMOJI_LIST = ['😊','😄','😂','🥰','😍','👍','👏','🙌','❤️','🎉','✅','🤔','😅','🙏','🚀','💪','🌟','😮','🤝','📦','♻️','👶','🏫','🧸','🎠','⚽'];
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    db.auth.getUser().then(({ data: { user } }) => {
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
    setSelectedConvId(conv.id);
    if (updateUrl && searchParams.get('conv') !== conv.id) {
      router.push('/beskeder?conv=' + conv.id);
    }
    setMsgLoad(true);
    const { data } = await db.from('chat_messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setMsgLoad(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
    inputRef.current?.focus();
    const isInit = amInitiator(conv);
    if ((isInit && conv.initiator_unread > 0) || (!isInit && conv.owner_unread > 0)) {
      const patch = isInit ? { initiator_unread: 0 } : { owner_unread: 0 };
      await db.from('conversations').update(patch).eq('id', conv.id);
      setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, ...patch } : c));
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
          setMessages(prev => [...prev, m]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
        })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'chat_messages', filter:`conversation_id=eq.${active.id}` },
        ({ new: m }) => { setMessages(prev => prev.map(x => x.id === m.id ? m : x)); })
      .subscribe();
    return () => db.removeChannel(ch);
  }, [active?.id]);

  async function uploadImages(files, convId) {
    const urls = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${convId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await db.storage.from('chat-images').upload(path, file, { upsert: false });
      if (!error) {
        const { data: { publicUrl } } = db.storage.from('chat-images').getPublicUrl(path);
        urls.push(publicUrl);
      }
    }
    return urls;
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
      const urls = await uploadImages(chatImages, convId);
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
      const urls = await uploadImages(chatImages, active.id);
      const imageContent = JSON.stringify({ urls, caption: content });
      setChatImages([]);
      await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effectiveUserId, sender_name: senderName, content: imageContent, message_type: 'image' });
      const unreadPatch = isInit ? { owner_unread: (active.owner_unread||0)+1 } : { initiator_unread: (active.initiator_unread||0)+1 };
      const updated = { last_message: '📷 Billede', last_message_at: new Date().toISOString(), ...unreadPatch };
      await db.from('conversations').update(updated).eq('id', active.id);
      setActive(a => ({ ...a, ...updated }));
      setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...updated } : c).sort((a,b) => new Date(b.last_message_at)-new Date(a.last_message_at)));
      setSending(false);
      return;
    }
    await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effectiveUserId, sender_name: senderName, content });
    const unreadPatch = isInit ? { owner_unread: (active.owner_unread||0)+1 } : { initiator_unread: (active.initiator_unread||0)+1 };
    const updated = { last_message: content, last_message_at: new Date().toISOString(), ...unreadPatch };
    await db.from('conversations').update(updated).eq('id', active.id);
    setActive(a => ({ ...a, ...updated }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...updated } : c).sort((a,b) => new Date(b.last_message_at)-new Date(a.last_message_at)));
    setSending(false);
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

  async function deleteAllArchived(e) {
    e.stopPropagation();
    const archived = convs.filter(c => isArchived(c));
    if (!archived.length) return;
    if (!window.confirm(`Slet ${archived.length} arkiverede samtaler permanent?`)) return;
    if (!window.confirm('Er du helt sikker? Dette kan ikke fortrydes.')) return;
    for (const c of archived) {
      await db.from('chat_messages').delete().eq('conversation_id', c.id);
      await db.from('conversations').delete().eq('id', c.id);
    }
    setConvs(cs => cs.filter(c => !isArchived(c)));
    if (active && isArchived(active)) { setActive(null); setMessages([]); }
  }

  async function deleteConv(conv, e) {
    e.stopPropagation();
    if (!window.confirm('Slet denne samtale permanent?')) return;
    await db.from('chat_messages').delete().eq('conversation_id', conv.id);
    await db.from('conversations').delete().eq('id', conv.id);
    setConvs(cs => cs.filter(c => c.id !== conv.id));
    if (active?.id === conv.id) { setActive(null); setMessages([]); }
  }

  function effectiveSenderName() {
    if (ctxIsAdmin && adminInstName) return adminInstName;
    return active.owner_id === userId ? active.owner_name : active.initiator_name;
  }

  async function handleAcceptBid(msg) {
    const senderName = effectiveSenderName();
    await db.from('chat_messages').update({ bid_status: 'accepted' }).eq('id', msg.id);
    const confirmMsg = `${senderName} har accepteret dit bud på ${msg.bid_amount} kr. for "${active.listing_title}"`;
    const effUid1 = realUserId || userId;
    await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid1, sender_name: senderName, content: confirmMsg });
    if (active.listing_id) {
      await db.from('listings').update({
        is_sold: true, is_active: false,
        sold_at: new Date().toISOString(),
        sold_to: active.initiator_name,
        sold_to_institution_id: active.initiator_institution_id || null,
      }).eq('id', active.listing_id);
    }
    const now = new Date().toISOString();
    const upd = {
      last_message: confirmMsg, last_message_at: now,
      initiator_unread: (active.initiator_unread||0)+1,
      is_handled: true, handled_at: now, handled_action: 'accepted',
      deal_completed: true, deal_completed_at: now, deal_type: 'byd',
    };
    await db.from('conversations').update(upd).eq('id', active.id);
    setActive(a => ({ ...a, ...upd }));
    setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
    setMessages(ms => ms.map(m => m.id === msg.id ? { ...m, bid_status: 'accepted' } : m));
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

  async function toggleReadUnread(conv, e) {
    e.stopPropagation();
    const isInit = amInitiator(conv);
    const field = isInit ? 'initiator_unread' : 'owner_unread';
    const currentUnread = isInit ? (conv.initiator_unread || 0) : (conv.owner_unread || 0);
    const newVal = currentUnread > 0 ? 0 : 1;
    await db.from('conversations').update({ [field]: newVal }).eq('id', conv.id);
    setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, [field]: newVal } : c));
  }

  function onKey(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

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

  if (!userId) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', paddingTop:80, background:PAPER }} className="page-enter">
      <div style={{ textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
        <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:22, marginBottom:8, color:INK }}>Log ind for at se dine beskeder</h2>
        <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>router.push('/login')} style={{ marginTop:16, padding:'13px 32px', fontSize:15 }}>Log ind</Btn>
      </div>
    </div>
  );

  const unreadShares = shares.filter(s => !s.read).length;
  const showList = !isMobile || (!active && !activeShare && !draftConv);
  const showChat = !isMobile || !!active || !!activeShare || !!draftConv;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', paddingTop:68, background:PAPER }} className="page-enter">
      {/* Shared hidden file input for image attachments */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:'none' }}
        onChange={e=>{
          const files = Array.from(e.target.files || []);
          if (files.length) { setChatImages(imgs=>[...imgs,...files]); e.target.value=''; }
        }} />
      <div style={{ flex:1, display:'flex', overflow:'hidden', maxWidth:1200, width:'100%', margin:'0 auto', padding:isMobile?'8px 0 0':'16px 16px 0' }}>

        {/* ── Conversation list ── */}
        {showList && <div style={{ width:isMobile?'100%':320, flexShrink:0, display:'flex', flexDirection:'column', background:PAPER2, borderRadius:isMobile?0:'18px 18px 0 0', border:'1px solid rgba(22,34,28,0.08)', boxShadow:'0 1px 6px rgba(22,34,28,0.06)', marginRight:isMobile?0:12, overflow:'hidden' }}>
          <div style={{ padding:'20px 18px 12px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:INK }}>Beskeder</h2>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {totalUnread > 0 && !showArchived && <div style={{ background:'#e11d48', color:'#fff', borderRadius:99, padding:'2px 9px', fontSize:12, fontWeight:800, fontFamily:FONT }}>{totalUnread}</div>}
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

            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              <button onClick={()=>setShowArchived(false)} style={{ flex:1, padding:'6px 0', borderRadius:99, border:'none', background:!showArchived?PRIMARY:PAPER3, color:!showArchived?'#fff':INK3, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Aktive</button>
              <button onClick={()=>setShowArchived(true)} style={{ flex:1, padding:'6px 0', borderRadius:99, border:'none', background:showArchived?PRIMARY:PAPER3, color:showArchived?'#fff':INK3, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Arkiveret</button>
              {showArchived && convs.filter(c=>isArchived(c)).length > 0 && (
                <button onClick={deleteAllArchived} title="Slet alle arkiverede" style={{ padding:'6px 10px', borderRadius:99, border:'none', background:'#FEF2F2', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0, fontFamily:FONT }}>Slet alle</button>
              )}
            </div>

            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', display:'flex', alignItems:'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Søg samtaler…" style={{ width:'100%', padding:'9px 12px 9px 32px', borderRadius:10, border:`1.5px solid ${PAPER3}`, fontSize:13, outline:'none', background:PAPER2, fontFamily:FONT }} />
            </div>
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
              ? <div style={{ padding:24, textAlign:'center', color:INK3, fontSize:13, fontFamily:FONT }}>Indlæser…</div>
              : filtered.length === 0
                ? (
                  <div style={{ padding:40, textAlign:'center' }}>
                    <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>{showArchived ? '0' : '—'}</div>
                    <p style={{ fontSize:13, color:INK3, fontFamily:FONT }}>{showArchived ? 'Ingen arkiverede samtaler' : 'Ingen samtaler endnu'}</p>
                    {!showArchived && <button onClick={()=>router.push('/opslag')} style={{ marginTop:12, background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Find opslag</button>}
                  </div>
                )
              : filtered.map(c => {
                const unread = myUnread(c);
                const isAct = active?.id === c.id;
                const archived = isArchived(c);
                return (
                  <div key={c.id} style={{ display:'flex', gap:12, padding:'13px 16px', cursor:'pointer', background:isAct?GREEN_TINT:PAPER2, borderLeft:isAct?`3px solid ${PRIMARY}`:'3px solid transparent', transition:'background 0.15s', position:'relative', borderBottom:`1px solid rgba(22,34,28,0.05)` }}
                    onClick={()=>openConv(c)}>
                    <div style={{ width:46, height:46, borderRadius:12, background:c.listing_image?PAPER3:c.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, overflow:'hidden', position:'relative' }}>
                      {c.listing_image ? <img src={c.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : c.listing_emoji||'🧸'}
                      {unread>0 && !archived && <div style={{ position:'absolute', top:-4, right:-4, width:18, height:18, background:'#e11d48', borderRadius:'50%', border:`2px solid ${PAPER2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#fff' }}>{unread>9?'9+':unread}</div>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                        <div style={{ fontFamily:FONT, fontWeight:unread>0?800:600, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:110, color:INK }}>{otherName(c)}</div>
                        <div style={{ fontSize:11, color:INK3, flexShrink:0, marginLeft:4, fontFamily:FONT }}>{relTime(c.last_message_at)}</div>
                      </div>
                      <div style={{ fontSize:12, color:INK3, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:2, fontFamily:FONT }}>
                        {c.listing_title}
                        {amInitiator(c) && <span style={{ marginLeft:6, background:GREEN_TINT, color:PRIMARY, borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700 }}>Sendt</span>}
                      </div>
                      <div style={{ fontSize:12, color:unread>0?INK:INK3, fontWeight:unread>0?600:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:FONT }}>{c.last_message || 'Samtale startet'}</div>
                    </div>
                    {archived ? (
                      <div style={{ display:'flex', gap:2, flexShrink:0, alignSelf:'center' }}>
                        <button onClick={e=>unarchiveConv(c,e)} title="Flyt til indbakke" style={{ background:'none', border:'none', fontSize:13, cursor:'pointer', padding:'4px', color:INK3, fontFamily:FONT }}>↑</button>
                        <button onClick={e=>deleteConv(c,e)} title="Slet permanent" style={{ background:'none', border:'none', fontSize:13, cursor:'pointer', padding:'4px', color:INK3 }}>
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
                    )}
                  </div>
                );
              })}
          </div>
        </div>}

        {/* ── Chat panel ── */}
        {showChat && <div style={{ flex:1, display:'flex', flexDirection:'column', background:PAPER2, borderRadius:isMobile?0:'18px 18px 0 0', border:'1px solid rgba(22,34,28,0.08)', boxShadow:'0 1px 6px rgba(22,34,28,0.06)', overflow:'hidden' }}>
          {!active && !activeShare && draftConv ? (
            <>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid rgba(22,34,28,0.08)`, display:'flex', alignItems:'center', gap:12, background:PAPER2 }}>
                {isMobile && <button onClick={()=>setDraftConv(null)} style={{ background:'none', border:'none', fontSize:20, color:INK3, cursor:'pointer', padding:'4px 6px 4px 0', lineHeight:1, flexShrink:0 }}>←</button>}
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
              <div style={{ padding:'12px 16px', borderBottom:`1px solid rgba(22,34,28,0.08)`, display:'flex', alignItems:'center', gap:12, background:PAPER2 }}>
                {isMobile && <button onClick={()=>setActiveShare(null)} style={{ background:'none', border:'none', fontSize:20, color:INK3, cursor:'pointer', padding:'4px 6px 4px 0', lineHeight:1, flexShrink:0 }}>←</button>}
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
              <div style={{ padding:'12px 16px', borderBottom:`1px solid rgba(22,34,28,0.08)`, display:'flex', alignItems:'center', gap:12, background:PAPER2 }}>
                {isMobile && (
                  <button onClick={()=>router.back()} style={{ background:'none', border:'none', fontSize:20, color:INK3, cursor:'pointer', padding:'4px 6px 4px 0', lineHeight:1, flexShrink:0 }}>←</button>
                )}
                <div style={{ width:44, height:44, borderRadius:12, background:active.listing_image?PAPER3:active.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, overflow:'hidden' }}>
                  {active.listing_image ? <img src={active.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : active.listing_emoji||'🧸'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:INK3, fontWeight:600, marginBottom:2, fontFamily:FONT }}>Samtale om</div>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{active.listing_title}</div>
                  <div style={{ fontSize:12, color:INK3, marginTop:1, fontFamily:FONT }}>med <strong style={{ color:INK }}>{otherName(active)}</strong></div>
                </div>
                <button onClick={()=>router.push('/opslag/detail')} style={{ fontSize:12, fontWeight:700, color:PRIMARY, background:GREEN_TINT, border:'none', borderRadius:99, padding:'6px 14px', cursor:'pointer', whiteSpace:'nowrap', fontFamily:FONT }}>Se opslag →</button>
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:6, background:PAPER }}>
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
                      const isOwnerInConv = ctxIsAdmin && adminInstName
                        ? active.owner_name === adminInstName
                        : active.owner_id === userId;
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
                        const grouped = mine === prevMine && !showDate && m.message_type !== 'bid' && messages[i-1]?.message_type !== 'bid' && m.message_type !== 'swap' && messages[i-1]?.message_type !== 'swap' && m.message_type !== 'bundle' && messages[i-1]?.message_type !== 'bundle' && m.message_type !== 'image' && messages[i-1]?.message_type !== 'image';
                        const isBid = m.message_type === 'bid';
                        const isSwap = m.message_type === 'swap';
                        const isBundle = m.message_type === 'bundle';
                        const isImage = m.message_type === 'image';
                        const bundleData = isBundle ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const swapData = isSwap ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        const imageData = isImage ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                        return (
                          <React.Fragment key={m.id}>
                            {showDate && <div style={{ textAlign:'center', margin:'12px 0 4px', fontSize:11, fontWeight:600, color:INK3, letterSpacing:0.5, fontFamily:FONT }}>{dateStr}</div>}
                            {isSwap ? (
                              <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                                {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:PRIMARY, flexShrink:0, marginRight:8, alignSelf:'flex-end', fontFamily:FONT }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                                <div style={{ maxWidth:'78%' }}>
                                  {!mine && <div style={{ fontSize:11, fontWeight:700, color:INK3, marginBottom:3, marginLeft:2, fontFamily:FONT }}>{m.sender_name}</div>}
                                  <div style={{ background:mine?'#FEF3EC':PAPER3, border:`1.5px solid ${mine?CORAL:'rgba(22,34,28,0.12)'}`, borderRadius:16, padding:'14px 16px', minWidth:200 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:CORAL, textTransform:'uppercase', letterSpacing:0.6, marginBottom:10, fontFamily:FONT }}>Bytteforslag</div>
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
                                    {bundleData.note && (
                                      <div style={{ fontSize:13, color:INK, lineHeight:1.5, fontFamily:FONT, marginTop:8, paddingTop:8, borderTop:`1px solid rgba(22,34,28,0.08)` }}>{bundleData.note}</div>
                                    )}
                                    {/* Accept / Reject — only for owner, only when pending */}
                                    {(!m.bid_status || m.bid_status === 'pending') && isOwnerInConv && !mine && (
                                      <div style={{ display:'flex', gap:8, marginTop:12, paddingTop:12, borderTop:`1px solid rgba(22,34,28,0.08)` }}>
                                        <button onClick={async () => {
                                          const senderName = effectiveSenderName();
                                          await db.from('chat_messages').update({ bid_status: 'accepted' }).eq('id', m.id);
                                          const confirmMsg = `${senderName} har accepteret bundttilbuddet.`;
                                          const effUid = realUserId || userId;
                                          await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid, sender_name: senderName, content: confirmMsg });
                                          const now = new Date().toISOString();
                                          const upd = { last_message: confirmMsg, last_message_at: now, initiator_unread: (active.initiator_unread||0)+1, is_handled: true, handled_at: now, handled_action: 'accepted' };
                                          await db.from('conversations').update(upd).eq('id', active.id);
                                          setActive(a => ({ ...a, ...upd }));
                                          setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
                                          setMessages(ms => ms.map(x => x.id === m.id ? { ...x, bid_status: 'accepted' } : x));
                                        }} style={{ flex:1, padding:'8px 16px', borderRadius:99, background:PRIMARY, border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>
                                          Accepter
                                        </button>
                                        <button onClick={async () => {
                                          const senderName = effectiveSenderName();
                                          await db.from('chat_messages').update({ bid_status: 'rejected' }).eq('id', m.id);
                                          const rejectMsg = `${senderName} har afvist bundttilbuddet.`;
                                          const effUid = realUserId || userId;
                                          await db.from('chat_messages').insert({ conversation_id: active.id, sender_id: effUid, sender_name: senderName, content: rejectMsg });
                                          const now = new Date().toISOString();
                                          const upd = { last_message: rejectMsg, last_message_at: now, initiator_unread: (active.initiator_unread||0)+1, is_handled: true, handled_at: now, handled_action: 'rejected' };
                                          await db.from('conversations').update(upd).eq('id', active.id);
                                          setActive(a => ({ ...a, ...upd }));
                                          setConvs(cs => cs.map(c => c.id === active.id ? { ...c, ...upd } : c));
                                          setMessages(ms => ms.map(x => x.id === m.id ? { ...x, bid_status: 'rejected' } : x));
                                        }} style={{ flex:1, padding:'8px 16px', borderRadius:99, background:'#FEF2F2', border:'1.5px solid #FCA5A5', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>
                                          Afvis
                                        </button>
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
                            ) : isBid ? (
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
              <div style={{ borderTop:`1px solid rgba(22,34,28,0.08)`, background:PAPER2, position:'relative' }}>
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
                    placeholder="Skriv en besked… (Enter for at sende)" rows={1}
                    style={{ flex:1, padding:'11px 14px', borderRadius:14, border:`1.5px solid ${PAPER3}`, fontSize:14, resize:'none', fontFamily:FONT, outline:'none', lineHeight:1.5, maxHeight:120, overflowY:'auto', background:PAPER }}
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
    </div>
  );
}
