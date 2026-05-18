'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, ACCENT, ACCENT2 } from '@/lib/constants';
import { useWindowWidth, relTime } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Badge, Btn, Spinner } from '@/components/ui';

export default function MessagesClient() {
  const router = useRouter();
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
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const EMOJI_LIST = ['😊','😄','😂','🥰','😍','👍','👏','🙌','❤️','🎉','✅','🤔','😅','🙏','🚀','💪','🌟','😮','🤝','📦','♻️','👶','🏫','🧸','🎠','⚽'];
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

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
    if (!selectedConvId || !convs.length) return;
    const c = convs.find(x => x.id === selectedConvId);
    if (c) openConv(c);
  }, [selectedConvId, convs]);

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

  async function openConv(conv) {
    setActive(conv);
    setSelectedConvId(conv.id);
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

  async function send() {
    const content = newMsg.trim();
    const effectiveUserId = realUserId || userId;
    if (!content || !active || !effectiveUserId) return;
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
    const confirmMsg = `${senderName} har accepteret dit bud på ${msg.bid_amount} kr. for "${active.listing_title}" 🎉`;
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
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', paddingTop:80 }} className="page-enter">
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>💬</div>
        <h2 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:24, marginBottom:8 }}>Log ind for at se dine beskeder</h2>
        <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>router.push('/login')} style={{ marginTop:16, padding:'13px 32px', fontSize:15 }}>Log ind</Btn>
      </div>
    </div>
  );

  const unreadShares = shares.filter(s => !s.read).length;
  const showList = !isMobile || (!active && !activeShare);
  const showChat = !isMobile || !!active || !!activeShare;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', paddingTop:68, background:'#f8f5f0' }} className="page-enter">
      <div style={{ flex:1, display:'flex', overflow:'hidden', maxWidth:1200, width:'100%', margin:'0 auto', padding:isMobile?'8px 0 0':'16px 16px 0' }}>

        {showList && <div style={{ width:isMobile?'100%':320, flexShrink:0, display:'flex', flexDirection:'column', background:'#fff', borderRadius:isMobile?0:'18px 18px 0 0', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', marginRight:isMobile?0:12, overflow:'hidden' }}>
          <div style={{ padding:'20px 18px 12px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <h2 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:20 }}>Beskeder</h2>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {totalUnread > 0 && !showArchived && <div style={{ background:'#e11d48', color:'#fff', borderRadius:99, padding:'2px 9px', fontSize:12, fontWeight:800 }}>{totalUnread}</div>}
                <button onClick={()=>setComposeOpen(true)} title="Ny besked" style={{ background:PRIMARY, border:'none', color:'#fff', borderRadius:99, width:30, height:30, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>✏️</button>
              </div>
            </div>
            {composeOpen && (
              <div style={{ background:'#f8f7f5', borderRadius:14, padding:14, marginBottom:10, border:`1.5px solid ${PRIMARY}` }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>✏️ Ny besked til institution</div>
                <input value={composeSearch} onChange={e=>setComposeSearch(e.target.value)} placeholder="Søg institution ved navn…" style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #e5e5e5', fontSize:13, outline:'none', marginBottom:6 }} />
                {composeResults.length > 0 && !composeTarget && (
                  <div style={{ background:'#fff', borderRadius:10, border:'1.5px solid #eee', marginBottom:6, maxHeight:140, overflowY:'auto' }}>
                    {composeResults.map(r => (
                      <div key={r.id} onClick={()=>{ setComposeTarget(r); setComposeSearch(r.name); setComposeResults([]); }} style={{ padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid #f0eeeb', fontSize:13 }}>
                        <strong>{r.name}</strong>{r.city ? <span style={{ color:'#aaa', marginLeft:6 }}>· {r.city}</span> : ''}
                      </div>
                    ))}
                  </div>
                )}
                {composeTarget && (
                  <>
                    <textarea value={composeMsg} onChange={e=>setComposeMsg(e.target.value)} placeholder={`Skriv besked til ${composeTarget.name}…`} rows={3} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #e5e5e5', fontSize:13, resize:'none', outline:'none', marginBottom:6, fontFamily:"'Nunito Sans',sans-serif" }} />
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={()=>{ setComposeTarget(null); setComposeSearch(''); setComposeMsg(''); }} style={{ flex:1, padding:'8px', borderRadius:10, background:'#f5f4f2', border:'none', fontWeight:700, fontSize:12, cursor:'pointer' }}>Annuller</button>
                      <button onClick={handleComposeSend} disabled={!composeMsg.trim()} style={{ flex:2, padding:'8px', borderRadius:10, background:composeMsg.trim()?PRIMARY:'#e5e5e5', border:'none', color:'#fff', fontWeight:700, fontSize:12, cursor:composeMsg.trim()?'pointer':'default' }}>Send besked</button>
                    </div>
                  </>
                )}
                {!composeTarget && <button onClick={()=>{ setComposeOpen(false); setComposeSearch(''); setComposeResults([]); }} style={{ fontSize:12, color:'#aaa', background:'none', border:'none', cursor:'pointer', marginTop:4 }}>Annuller</button>}
              </div>
            )}
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              <button onClick={()=>setShowArchived(false)} style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', background:!showArchived?PRIMARY:'#f0eeeb', color:!showArchived?'#fff':'#888', fontSize:12, fontWeight:700, cursor:'pointer' }}>Aktive</button>
              <button onClick={()=>setShowArchived(true)} style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', background:showArchived?PRIMARY:'#f0eeeb', color:showArchived?'#fff':'#888', fontSize:12, fontWeight:700, cursor:'pointer' }}>Arkiveret</button>
              {showArchived && convs.filter(c=>isArchived(c)).length > 0 && (
                <button onClick={deleteAllArchived} title="Slet alle arkiverede" style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'#fff0f0', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>🗑️ Slet alle</button>
              )}
            </div>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'#bbb' }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Søg samtaler…" style={{ width:'100%', padding:'9px 12px 9px 34px', borderRadius:10, border:'1.5px solid #eee', fontSize:13, outline:'none', background:'#fafaf8' }} />
            </div>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {shares.length > 0 && (
              <div style={{ borderBottom:'2px solid #f0eeeb' }}>
                <div style={{ padding:'10px 16px 6px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.5 }}>Delte opslag</span>
                  {unreadShares > 0 && <span style={{ background:'#EF476F', color:'#fff', borderRadius:99, padding:'1px 7px', fontSize:10, fontWeight:800 }}>{unreadShares}</span>}
                </div>
                {shares.slice(0,5).map(s => {
                  const isAct = activeShare?.id === s.id;
                  return (
                    <div key={s.id} onClick={()=>{ setActiveShare(s); setActive(null); markShareRead(s); }}
                      style={{ display:'flex', gap:10, padding:'10px 16px', cursor:'pointer', background:isAct?'#f0faf5':'#fff', borderLeft:isAct?`3px solid ${PRIMARY}`:'3px solid transparent', opacity:s.read&&!isAct?0.65:1, transition:'all 0.15s' }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:s.listing_image?'#e8e6e3':s.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, overflow:'hidden' }}>
                        {s.listing_image ? <img src={s.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : s.listing_emoji||'🧸'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:s.read?600:800, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.listing_title}</div>
                        <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>📤 Fra {s.from_name} · {relTime(s.created_at)}</div>
                      </div>
                      {!s.read && <div style={{ width:8, height:8, borderRadius:'50%', background:'#EF476F', flexShrink:0, alignSelf:'center' }} />}
                    </div>
                  );
                })}
              </div>
            )}
            {loading ? <div style={{ padding:24, textAlign:'center', color:'#bbb', fontSize:13 }}>Indlæser…</div>
            : filtered.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'#bbb' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>{showArchived ? '📭' : '💬'}</div>
                <p style={{ fontSize:13 }}>{showArchived ? 'Ingen arkiverede samtaler' : 'Ingen samtaler endnu'}</p>
                {!showArchived && <button onClick={()=>router.push('/opslag')} style={{ marginTop:12, background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Find opslag</button>}
              </div>
            ) : filtered.map(c => {
              const unread = myUnread(c);
              const isAct = active?.id === c.id;
              const archived = isArchived(c);
              return (
                <div key={c.id} style={{ display:'flex', gap:12, padding:'13px 16px', cursor:'pointer', background:isAct?'#f0faf5':'#fff', borderLeft:isAct?`3px solid ${PRIMARY}`:'3px solid transparent', transition:'background 0.15s', position:'relative' }}
                  onClick={()=>openConv(c)}>
                  <div style={{ width:46, height:46, borderRadius:12, background:c.listing_image?'#e8e6e3':c.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, overflow:'hidden', position:'relative' }}>
                    {c.listing_image ? <img src={c.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : c.listing_emoji||'🧸'}
                    {unread>0 && !archived && <div style={{ position:'absolute', top:-4, right:-4, width:18, height:18, background:'#e11d48', borderRadius:'50%', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#fff' }}>{unread>9?'9+':unread}</div>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                      <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:unread>0?800:600, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:110 }}>{otherName(c)}</div>
                      <div style={{ fontSize:11, color:'#bbb', flexShrink:0, marginLeft:4 }}>{relTime(c.last_message_at)}</div>
                    </div>
                    <div style={{ fontSize:12, color:'#888', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:2 }}>
                      📦 {c.listing_title}
                      {amInitiator(c) && <span style={{ marginLeft:6, background:'#f0f9f4', color:'#2d6a4f', borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700 }}>Sendt</span>}
                    </div>
                    <div style={{ fontSize:12, color:unread>0?'#333':'#aaa', fontWeight:unread>0?600:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.last_message || 'Samtale startet'}</div>
                  </div>
                  {archived ? (
                    <div style={{ display:'flex', gap:2 }}>
                      <button onClick={e=>unarchiveConv(c,e)} title="Flyt til indbakke" style={{ background:'none', border:'none', fontSize:15, cursor:'pointer', padding:'4px', color:'#888' }}>📤</button>
                      <button onClick={e=>deleteConv(c,e)} title="Slet permanent" style={{ background:'none', border:'none', fontSize:15, cursor:'pointer', padding:'4px', color:'#ccc' }}>🗑️</button>
                    </div>
                  ) : (
                    <button onClick={e=>archiveConv(c,e)} title="Arkiver" style={{ background:'none', border:'none', fontSize:16, cursor:'pointer', padding:'4px', color:'#ccc', flexShrink:0, alignSelf:'center' }}>📥</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>}

        {showChat && <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fff', borderRadius:isMobile?0:'18px 18px 0 0', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', overflow:'hidden' }}>
          {!active && !activeShare ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', color:'#ccc' }}>
              <div style={{ fontSize:56, marginBottom:16 }}>💬</div>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:18, color:'#bbb' }}>Vælg en samtale</div>
              <div style={{ fontSize:13, marginTop:6, color:'#ddd' }}>eller start en ny fra et opslag</div>
            </div>
          ) : activeShare && !active ? (
            <>
              <div style={{ padding:'12px 16px', borderBottom:'1.5px solid #f0eeeb', display:'flex', alignItems:'center', gap:12, background:'#fafaf8' }}>
                {isMobile && <button onClick={()=>setActiveShare(null)} style={{ background:'none', border:'none', fontSize:22, color:'#555', cursor:'pointer', padding:'4px 6px 4px 0', lineHeight:1, flexShrink:0 }}>←</button>}
                <div style={{ fontSize:22 }}>📤</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15 }}>Delt opslag</div>
                  <div style={{ fontSize:12, color:'#888' }}>Fra {activeShare.from_name}</div>
                </div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
                <div style={{ width:'100%', maxWidth:380 }}>
                  <div style={{ background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.10)' }}>
                    <div style={{ height:200, background:activeShare.listing_image?'#e8e6e3':activeShare.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:80, overflow:'hidden' }}>
                      {activeShare.listing_image ? <img src={activeShare.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : activeShare.listing_emoji||'🧸'}
                    </div>
                    <div style={{ padding:'16px 20px 20px' }}>
                      <div style={{ marginBottom:10 }}><Badge type={activeShare.listing_type} /></div>
                      <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:20, marginBottom:4 }}>{activeShare.listing_title}</div>
                      <div style={{ fontSize:13, color:'#888', marginBottom:8 }}>{activeShare.listing_institution_name}{activeShare.listing_city ? ` · ${activeShare.listing_city}` : ''}</div>
                      {activeShare.listing_price && <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:26, color:PRIMARY }}>{activeShare.listing_price} kr.</div>}
                    </div>
                  </div>
                  {activeShare.note && (
                    <div style={{ background:'#f0faf5', border:`1.5px solid #c6e8d4`, borderRadius:14, padding:'12px 16px', marginTop:12 }}>
                      <div style={{ fontSize:12, color:PRIMARY, fontWeight:700, marginBottom:4 }}>💬 Besked fra {activeShare.from_name}</div>
                      <div style={{ fontSize:14, color:'#333', lineHeight:1.55 }}>{activeShare.note}</div>
                    </div>
                  )}
                  <div style={{ fontSize:11, color:'#bbb', textAlign:'center', marginTop:10 }}>Delt {relTime(activeShare.created_at)}</div>
                  <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>openSharedListing(activeShare)} style={{ justifyContent:'center', width:'100%', marginTop:14, padding:'13px', fontSize:15 }}>
                    Se opslag →
                  </Btn>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding:'12px 16px', borderBottom:'1.5px solid #f0eeeb', display:'flex', alignItems:'center', gap:12, background:'#fafaf8' }}>
                {isMobile && (
                  <button onClick={()=>setActive(null)} style={{ background:'none', border:'none', fontSize:22, color:'#555', cursor:'pointer', padding:'4px 6px 4px 0', lineHeight:1, flexShrink:0 }}>←</button>
                )}
                <div style={{ width:44, height:44, borderRadius:12, background:active.listing_image?'#e8e6e3':active.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, overflow:'hidden' }}>
                  {active.listing_image ? <img src={active.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : active.listing_emoji||'🧸'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:'#aaa', fontWeight:600, marginBottom:2 }}>Samtale om</div>
                  <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{active.listing_title}</div>
                  <div style={{ fontSize:12, color:'#888', marginTop:1 }}>med <strong>{otherName(active)}</strong></div>
                </div>
                <button onClick={()=>router.push('/opslag/detail')} style={{ fontSize:12, fontWeight:700, color:PRIMARY, background:'#E8F5EE', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', whiteSpace:'nowrap' }}>Se opslag →</button>
              </div>

              <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:6 }}>
                {msgLoad ? <div style={{ textAlign:'center', color:'#bbb', paddingTop:40 }}>Indlæser…</div>
                : messages.length === 0 ? (
                  <div style={{ textAlign:'center', color:'#bbb', paddingTop:60 }}>
                    <div style={{ fontSize:40, marginBottom:10 }}>👋</div>
                    <p style={{ fontSize:14 }}>Send den første besked for at starte samtalen</p>
                  </div>
                ) : (() => {
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
                    const grouped = mine === prevMine && !showDate && m.message_type !== 'bid' && messages[i-1]?.message_type !== 'bid' && m.message_type !== 'swap' && messages[i-1]?.message_type !== 'swap';
                    const isBid = m.message_type === 'bid';
                    const isSwap = m.message_type === 'swap';
                    const swapData = isSwap ? (() => { try { return JSON.parse(m.content); } catch { return null; } })() : null;
                    return (
                      <React.Fragment key={m.id}>
                        {showDate && <div style={{ textAlign:'center', margin:'12px 0 4px', fontSize:11, fontWeight:600, color:'#bbb', letterSpacing:0.5 }}>{dateStr}</div>}
                        {isSwap ? (
                          <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                            {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:'#f0eeeb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#888', flexShrink:0, marginRight:8, alignSelf:'flex-end' }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                            <div style={{ maxWidth:'78%' }}>
                              {!mine && <div style={{ fontSize:11, fontWeight:700, color:'#aaa', marginBottom:3, marginLeft:2 }}>{m.sender_name}</div>}
                              <div style={{ background:mine?'#FEF0E3':'#f0f2f5', border:`1.5px solid ${mine?ACCENT:'#e0ddd8'}`, borderRadius:16, padding:'14px 16px', minWidth:200 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:ACCENT, textTransform:'uppercase', letterSpacing:0.6, marginBottom:10 }}>🔄 Bytteforslag</div>
                                {swapData?.swap_title ? (
                                  <div onClick={swapData.swap_listing_id ? async ()=>{ const {data}=await db.from('listings').select('*').eq('id',swapData.swap_listing_id).maybeSingle(); if(data) setSwapPreview(data); } : undefined}
                                    style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', borderRadius:10, padding:'10px 12px', marginBottom: swapData?.note ? 8 : 0, cursor: swapData.swap_listing_id ? 'pointer' : 'default', transition:'opacity 0.15s' }}
                                    onMouseEnter={e=>{ if(swapData.swap_listing_id) e.currentTarget.style.opacity='0.85'; }}
                                    onMouseLeave={e=>{ e.currentTarget.style.opacity='1'; }}>
                                    <div style={{ width:44, height:44, borderRadius:8, background:swapData.swap_image?'#e8e6e3':swapData.swap_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, overflow:'hidden' }}>
                                      {swapData.swap_image ? <img src={swapData.swap_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : swapData.swap_emoji||'🧸'}
                                    </div>
                                    <div style={{ flex:1 }}>
                                      <div style={{ fontSize:12, color:'#aaa', fontWeight:600 }}>Tilbyder:</div>
                                      <div style={{ fontWeight:700, fontSize:14, color:'#1c1a17' }}>{swapData.swap_title}</div>
                                    </div>
                                    {swapData.swap_listing_id && <span style={{ fontSize:11, color:ACCENT, fontWeight:600 }}>Se opslag →</span>}
                                  </div>
                                ) : null}
                                {swapData?.note && (
                                  <div style={{ fontSize:13, color:'#555', marginTop: swapData?.swap_title ? 8 : 0, lineHeight:1.5 }}>{swapData.note}</div>
                                )}
                              </div>
                              <div style={{ fontSize:10, color:'#bbb', marginTop:3, textAlign:mine?'right':'left' }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                            </div>
                          </div>
                        ) : isBid ? (
                          <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:10 }}>
                            {!mine && <div style={{ width:30, height:30, borderRadius:'50%', background:'#f0eeeb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#888', flexShrink:0, marginRight:8, alignSelf:'flex-end' }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                            <div style={{ maxWidth:'78%' }}>
                              {!mine && <div style={{ fontSize:11, fontWeight:700, color:'#aaa', marginBottom:3, marginLeft:2 }}>{m.sender_name}</div>}
                              <div style={{
                                background: m.bid_status==='accepted' ? '#e8f5ee' : m.bid_status==='rejected' ? '#fff0f0' : mine ? '#e8f0fb' : '#f0f2f5',
                                border: `2px solid ${m.bid_status==='accepted' ? PRIMARY : m.bid_status==='rejected' ? '#fca5a5' : mine ? ACCENT2 : '#e0ddd8'}`,
                                borderRadius:16, padding:'14px 16px'
                              }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                  <span style={{ fontSize:20 }}>{m.bid_status==='accepted'?'✅':m.bid_status==='rejected'?'❌':'📊'}</span>
                                  <span style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:17, color: m.bid_status==='accepted'?PRIMARY:m.bid_status==='rejected'?'#e11d48':ACCENT2 }}>{m.bid_amount} kr.</span>
                                  <span style={{ fontSize:12, color:'#888', fontWeight:600 }}>bud</span>
                                  {m.bid_status==='accepted' && <span style={{ fontSize:11, fontWeight:700, color:PRIMARY, background:'#d1fae5', padding:'2px 8px', borderRadius:99 }}>Accepteret</span>}
                                  {m.bid_status==='rejected' && <span style={{ fontSize:11, fontWeight:700, color:'#e11d48', background:'#fee2e2', padding:'2px 8px', borderRadius:99 }}>Afvist</span>}
                                  {m.bid_status==='countered' && <span style={{ fontSize:11, fontWeight:700, color:'#b45309', background:'#fef9c3', padding:'2px 8px', borderRadius:99 }}>Modbud sendt</span>}
                                </div>
                                {m.bid_note && <div style={{ fontSize:12, color:'#666', marginBottom:8, fontStyle:'italic' }}>"{m.bid_note}"</div>}
                                {m.bid_status === 'pending' && isOwnerInConv && !mine && (
                                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                                    <button onClick={()=>handleAcceptBid(m)} style={{ padding:'8px 16px', borderRadius:10, background:PRIMARY, border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>✅ Accepter</button>
                                    <button onClick={()=>{ setRejectingBid(m); setRejectNote(''); }} style={{ padding:'8px 16px', borderRadius:10, background:'#fff0f0', border:'1.5px solid #fca5a5', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer' }}>❌ Afvis</button>
                                    <button onClick={()=>{ setCounterBidMsg(m); setCounterAmount(''); }} style={{ padding:'8px 16px', borderRadius:10, background:'#fff8e1', border:'1.5px solid #ffe08a', color:'#b45309', fontSize:12, fontWeight:700, cursor:'pointer' }}>🔄 Modbud</button>
                                  </div>
                                )}
                                {m.bid_status === 'pending' && (!isOwnerInConv || mine) && (
                                  <div style={{ fontSize:12, color:'#888', fontWeight:600 }}>⏳ Afventer svar</div>
                                )}
                              </div>
                              <div style={{ fontSize:10, color:'#bbb', marginTop:3, textAlign:mine?'right':'left' }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start', marginTop:grouped?2:10 }}>
                            {!mine && !grouped && <div style={{ width:30, height:30, borderRadius:'50%', background:'#f0eeeb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#888', flexShrink:0, marginRight:8, alignSelf:'flex-end' }}>{m.sender_name.charAt(0).toUpperCase()}</div>}
                            {!mine && grouped && <div style={{ width:30, marginRight:8, flexShrink:0 }} />}
                            <div style={{ maxWidth:'68%' }}>
                              {!mine && !grouped && <div style={{ fontSize:11, fontWeight:700, color:'#aaa', marginBottom:3, marginLeft:2 }}>{m.sender_name}</div>}
                              <div style={{ background:mine?PRIMARY:'#f0f2f5', color:mine?'#fff':'#1c1a17', borderRadius:mine?'18px 18px 4px 18px':'18px 18px 18px 4px', padding:'10px 14px', fontSize:14, lineHeight:1.5, wordBreak:'break-word', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                                {m.content}
                              </div>
                              <div style={{ fontSize:10, color:'#bbb', marginTop:3, textAlign:mine?'right':'left', marginLeft:mine?0:2 }}>{d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
                <div ref={bottomRef} />
              </div>

              {rejectingBid && (
                <div style={{ borderTop:'2px solid #fecaca', background:'#fff5f5', padding:'14px 16px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#b91c1c', marginBottom:8 }}>❌ Afvis bud på {rejectingBid.bid_amount} kr.</div>
                  <textarea value={rejectNote} onChange={e=>setRejectNote(e.target.value)} placeholder="Evt. kommentar (valgfri)" rows={2} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #fca5a5', fontSize:13, resize:'none', fontFamily:"'Nunito Sans',sans-serif", outline:'none', marginBottom:8 }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>setRejectingBid(null)} style={{ flex:1, padding:'8px', borderRadius:10, background:'#f5f4f2', border:'none', fontWeight:700, fontSize:13, cursor:'pointer' }}>Annuller</button>
                    <button onClick={handleRejectBid} style={{ flex:1, padding:'8px', borderRadius:10, background:'#e11d48', border:'none', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>Bekræft afvisning</button>
                  </div>
                </div>
              )}

              {counterBidMsg && (
                <div style={{ borderTop:'2px solid #ffe08a', background:'#fffbef', padding:'14px 16px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#7a5c00', marginBottom:8 }}>🔄 Send modbud (originalt bud: {counterBidMsg.bid_amount} kr.)</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="number" value={counterAmount} onChange={e=>setCounterAmount(e.target.value)} placeholder="Dit modbud (kr.)" style={{ flex:1, padding:'9px 12px', borderRadius:10, border:'1.5px solid #ffe08a', fontSize:14, fontWeight:700, outline:'none' }} />
                    <button onClick={()=>setCounterBidMsg(null)} style={{ padding:'8px 14px', borderRadius:10, background:'#f5f4f2', border:'none', fontWeight:700, fontSize:13, cursor:'pointer' }}>✕</button>
                    <button onClick={handleCounterBid} disabled={!counterAmount} style={{ padding:'8px 16px', borderRadius:10, background:counterAmount?ACCENT:'#e5e5e5', border:'none', color:'#fff', fontWeight:700, fontSize:13, cursor:counterAmount?'pointer':'default' }}>Send</button>
                  </div>
                </div>
              )}

              <div style={{ borderTop:'1.5px solid #f0eeeb', background:'#fff', position:'relative' }}>
                {emojiOpen && (
                  <div style={{ position:'absolute', bottom:'100%', left:0, right:0, background:'#fff', borderTop:'1.5px solid #f0eeeb', padding:'10px 12px', display:'flex', flexWrap:'wrap', gap:4 }}>
                    {EMOJI_LIST.map(em => (
                      <button key={em} onClick={()=>{ setNewMsg(msg=>msg+em); setEmojiOpen(false); inputRef.current?.focus(); }}
                        style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', padding:'4px', borderRadius:8, lineHeight:1 }}>{em}</button>
                    ))}
                  </div>
                )}
                <div style={{ padding:'12px 16px', display:'flex', gap:8, alignItems:'flex-end' }}>
                  <button onClick={()=>setEmojiOpen(v=>!v)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', padding:'8px', borderRadius:10, flexShrink:0, color:'#aaa', lineHeight:1, height:44, display:'flex', alignItems:'center' }}>😊</button>
                  <textarea ref={inputRef} value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={onKey}
                    placeholder="Skriv en besked… (Enter for at sende)" rows={1}
                    style={{ flex:1, padding:'11px 14px', borderRadius:14, border:'1.5px solid #e5e5e5', fontSize:14, resize:'none', fontFamily:"'Nunito Sans',sans-serif", outline:'none', lineHeight:1.5, maxHeight:120, overflowY:'auto' }}
                    onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                  />
                  <button onClick={send} disabled={!newMsg.trim()||sending}
                    style={{ width:44, height:44, borderRadius:14, background:newMsg.trim()?PRIMARY:'#e5e5e5', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:newMsg.trim()?'pointer':'default', transition:'background 0.2s', flexShrink:0 }}>
                    {sending ? <Spinner /> : <span style={{ fontSize:18, color:'#fff' }}>↑</span>}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>}
      </div>
      {swapPreview && (
        <div onClick={()=>setSwapPreview(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:24, padding:28, maxWidth:480, width:'100%', boxShadow:'0 16px 48px rgba(0,0,0,0.18)', position:'relative', maxHeight:'80vh', overflowY:'auto' }}>
            <button onClick={()=>setSwapPreview(null)} style={{ position:'absolute', top:16, right:16, background:'#f5f4f2', border:'none', borderRadius:99, width:32, height:32, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:11, color:ACCENT, textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 }}>🔄 Tilbudt i bytte</div>
            <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:16, background:swapPreview.images?.[0]?'#e8e6e3':swapPreview.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:64, marginBottom:16, overflow:'hidden' }}>
              {swapPreview.images?.[0] ? <img src={swapPreview.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : swapPreview.emoji||'🧸'}
            </div>
            <h2 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:22, marginBottom:6 }}>{swapPreview.title}</h2>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
              <span style={{ fontSize:13, color:'#888' }}>📍 {swapPreview.city}</span>
              <span style={{ fontSize:13, color:'#888' }}>👶 {swapPreview.age_group}</span>
              <span style={{ fontSize:13, color:'#888', fontWeight:600 }}>Stand: {swapPreview.condition}</span>
            </div>
            {swapPreview.description && <p style={{ fontSize:14, color:'#555', lineHeight:1.75, marginBottom:16 }}>{swapPreview.description}</p>}
            <div style={{ fontSize:13, color:'#888' }}>Opslået af <strong style={{ color:'#333' }}>{swapPreview.institution_name}</strong></div>
            <button onClick={()=>{ setSwapPreview(null); setActiveListing(swapPreview); router.push('/opslag/detail'); }}
              style={{ marginTop:16, width:'100%', padding:'13px', borderRadius:14, background:ACCENT, color:'#fff', border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              Se fuldt opslag →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
