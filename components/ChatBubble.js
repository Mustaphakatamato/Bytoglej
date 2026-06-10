'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK3, CORAL, FONT } from '@/lib/constants';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { useWindowWidth } from '@/lib/hooks';

const PANEL_W = 320;

export default function ChatBubble() {
  const router   = useRouter();
  const pathname = usePathname();
  const { unreadTotal, fetchUnread } = useApp();
  const { userId: ctxUserId, institution, institutionId, isAdminView, adminInstName, realUserId } = useActiveUser();

  const [open,       setOpen]       = useState(false);
  const [convs,      setConvs]      = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [newMsg,     setNewMsg]     = useState('');
  const [sending,    setSending]    = useState(false);

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const loadConvsRef = useRef(null);

  const w = useWindowWidth();
  const isMobile = w > 0 && w < 768;
  const bubbleBottom = isMobile ? 'calc(84px + env(safe-area-inset-bottom, 0px) + 14px)' : '20px';
  const panelBottom  = isMobile ? 'calc(84px + env(safe-area-inset-bottom, 0px) + 78px)' : '80px';

  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplashDone(true), 1400); return () => clearTimeout(t); }, []);

  const userId = realUserId || ctxUserId;
  const hidden = !splashDone || !userId || !!pathname?.startsWith('/beskeder');

  // ── helpers ─────────────────────────────────────────────────────────────────
  const amInit = useCallback((conv) => {
    if (institutionId) {
      if (conv.initiator_institution_id) return conv.initiator_institution_id === institutionId;
    }
    return conv.initiator_id === userId;
  }, [institutionId, userId]);

  const myUnread  = (conv) => amInit(conv) ? (conv.initiator_unread || 0) : (conv.owner_unread || 0);
  const otherName = (conv) => amInit(conv) ? conv.owner_name : conv.initiator_name;
  const mySender  = (conv) => {
    if (isAdminView && adminInstName) return adminInstName;
    return amInit(conv) ? conv.initiator_name : conv.owner_name;
  };

  // ── load conversations ───────────────────────────────────────────────────────
  const loadConvs = useCallback(async () => {
    if (!userId) return;
    const orParts = [`initiator_id.eq.${userId}`, `owner_id.eq.${userId}`];
    if (institutionId) orParts.push(`owner_institution_id.eq.${institutionId}`, `initiator_institution_id.eq.${institutionId}`);
    if (institution?.name) orParts.push(`owner_name.eq.${institution.name}`, `initiator_name.eq.${institution.name}`);
    const { data } = await db.from('conversations').select('*').or(orParts.join(',')).order('last_message_at', { ascending: false });
    if (data) setConvs(data);
  }, [userId, institutionId, institution?.name]);

  // Keep ref fresh so realtime callback always calls latest version
  useEffect(() => { loadConvsRef.current = loadConvs; }, [loadConvs]);

  // ── open conversation ────────────────────────────────────────────────────────
  async function openConvInBubble(conv) {
    setActiveConv(conv);
    setMessages([]);
    const { data } = await db.from('chat_messages').select('*')
      .eq('conversation_id', conv.id).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 80);
    markRead(conv);
  }

  async function markRead(conv) {
    const isInit = amInit(conv);
    const patch  = isInit ? { initiator_unread: 0 } : { owner_unread: 0 };
    await db.from('conversations').update(patch).eq('id', conv.id);
    setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, ...patch } : c));
    fetchUnread(userId);
  }

  // ── send ─────────────────────────────────────────────────────────────────────
  async function send() {
    const content = newMsg.trim();
    if (!content || !activeConv || sending) return;
    setSending(true);
    setNewMsg('');
    const name   = mySender(activeConv);
    const isInit = amInit(activeConv);
    const { data: msg } = await db.from('chat_messages').insert({
      conversation_id: activeConv.id,
      sender_id: userId,
      sender_name: name,
      content,
    }).select().single();
    const unreadPatch = isInit
      ? { owner_unread: (activeConv.owner_unread || 0) + 1 }
      : { initiator_unread: (activeConv.initiator_unread || 0) + 1 };
    const upd = { last_message: content, last_message_at: new Date().toISOString(), ...unreadPatch };
    await db.from('conversations').update(upd).eq('id', activeConv.id);
    setActiveConv(c => ({ ...c, ...upd }));
    setConvs(cs => cs.map(c => c.id === activeConv.id ? { ...c, ...upd } : c)
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
    if (msg) {
      setMessages(ms => ms.some(x => x.id === msg.id) ? ms : [...ms, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  // ── effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hidden || !open) return;
    loadConvs();
  }, [open, hidden, loadConvs]);

  // Realtime: conv list
  useEffect(() => {
    if (hidden || !userId) return;
    const ch = db.channel('bubble-convs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' },
        () => loadConvsRef.current?.())
      .subscribe();
    return () => db.removeChannel(ch);
  }, [hidden, userId]);

  // Realtime: messages in active conv
  useEffect(() => {
    if (hidden || !activeConv) return;
    const ch = db.channel(`bubble-msgs-${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConv.id}` },
        ({ new: m }) => {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
          // Auto-mark read when message is from the other party
          if (m.sender_id !== userId) {
            setActiveConv(conv => {
              if (!conv) return conv;
              const isInit = institutionId
                ? conv.initiator_institution_id === institutionId
                : conv.initiator_id === userId;
              const patch = isInit ? { initiator_unread: 0 } : { owner_unread: 0 };
              db.from('conversations').update(patch).eq('id', conv.id);
              setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, ...patch } : c));
              fetchUnread(userId);
              return { ...conv, ...patch };
            });
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConv.id}` },
        ({ new: m }) => setMessages(prev => prev.map(x => x.id === m.id ? m : x)))
      .subscribe();
    return () => db.removeChannel(ch);
  }, [activeConv?.id, hidden, userId, institutionId]);

  // Focus input when entering a conv
  useEffect(() => {
    if (activeConv) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeConv?.id]);

  // ── message renderer ─────────────────────────────────────────────────────────
  function renderMsg(m, mine) {
    if (m.message_type === 'image') {
      let d = null;
      try { d = JSON.parse(m.content); } catch {}
      if (d?.urls?.length) {
        return (
          <div style={{ borderRadius: 12, overflow: 'hidden', maxWidth: 180 }}>
            <div style={{ display: 'grid', gridTemplateColumns: d.urls.length > 1 ? '1fr 1fr' : '1fr', gap: 2 }}>
              {d.urls.slice(0, 4).map((url, i) => (
                <img key={i} src={url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} alt="" />
              ))}
            </div>
            {d.caption && <div style={{ padding: '5px 8px', fontSize: 12, color: mine ? '#fff' : INK, background: mine ? PRIMARY : PAPER3, fontFamily: FONT }}>{d.caption}</div>}
          </div>
        );
      }
      return <span style={{ fontSize: 12 }}>📷 Billede</span>;
    }
    if (m.message_type === 'bundle') return <span style={{ fontSize: 12 }}>📦 Bundttilbud — tryk for at se</span>;
    if (m.message_type === 'bid')    return <span style={{ fontSize: 12 }}>💰 Bud</span>;
    if (m.message_type === 'swap')   return <span style={{ fontSize: 12 }}>🔄 Bytteforslag</span>;
    if (m.message_type === 'buy_request') {
      let d = null;
      try { d = JSON.parse(m.content); } catch {}
      return (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Købsforespørgsel
          </div>
          {d?.items?.map((item, i) => (
            <div key={i} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <span>{item.emoji} {item.title}</span>
              {item.price && <span style={{ fontWeight: 700 }}>{item.price} kr.</span>}
            </div>
          ))}
          {d?.totalPrice > 0 && (
            <div style={{ fontSize: 12, fontWeight: 800, borderTop: '1px solid rgba(22,34,28,0.1)', marginTop: 4, paddingTop: 4, textAlign: 'right' }}>
              Total: {d.totalPrice} kr.
            </div>
          )}
        </div>
      );
    }
    return <span style={{ fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word', fontFamily: FONT }}>{m.content}</span>;
  }

  // ── render ───────────────────────────────────────────────────────────────────
  if (hidden) return null;

  return (
    <>
      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      {open && (
        <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9997 }} />
        <div style={{
          position: 'fixed', bottom: panelBottom, right: 20, width: PANEL_W, height: 500,
          background: PAPER, borderRadius: 20, zIndex: 9998,
          boxShadow: '0 8px 48px rgba(22,34,28,0.18)', border: `1px solid ${PAPER3}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FONT,
        }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: `1px solid ${PAPER3}`, flexShrink: 0 }}>
            {activeConv ? (
              <>
                <button onClick={() => { setActiveConv(null); setMessages([]); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px 4px 0', color: INK3, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
                  ←
                </button>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {otherName(activeConv)}
                </div>
                <button
                  onClick={() => { router.push('/beskeder?conv=' + activeConv.id); setOpen(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: PRIMARY, fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>
                  Åbn fuldt →
                </button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: INK }}>Beskeder</div>
                <button onClick={() => { router.push('/beskeder'); setOpen(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: PRIMARY, fontWeight: 700, fontFamily: FONT, marginRight: 12 }}>
                  Se alle →
                </button>
                <button onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK3, fontSize: 18, lineHeight: 1, padding: 2 }}>
                  ✕
                </button>
              </>
            )}
          </div>

          {/* Conversation list */}
          {!activeConv && (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {convs.length === 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: INK3, fontSize: 13 }}>Ingen samtaler endnu</div>
              )}
              {convs.map(conv => {
                const unread = myUnread(conv);
                return (
                  <div key={conv.id}
                    onClick={() => openConvInBubble(conv)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', borderBottom: `1px solid ${PAPER2}`, background: unread > 0 ? PAPER2 : 'transparent', transition: 'background 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = PAPER3; }}
                    onMouseLeave={e => { e.currentTarget.style.background = unread > 0 ? PAPER2 : 'transparent'; }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: GREEN_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: PRIMARY, flexShrink: 0 }}>
                      {otherName(conv)?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {otherName(conv)}
                      </div>
                      <div style={{ fontSize: 11, color: unread > 0 ? INK : INK3, fontWeight: unread > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                        {conv.last_message || '—'}
                      </div>
                    </div>
                    {unread > 0 && (
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: PRIMARY, flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Chat view */}
          {activeConv && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {messages.map(m => {
                  const mine     = m.sender_id === userId;
                  const special  = ['image', 'bundle', 'bid', 'swap', 'buy_request'].includes(m.message_type);
                  const isImg    = m.message_type === 'image';
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '78%',
                        background: isImg ? 'transparent' : special ? (mine ? '#FEF3EC' : PAPER3) : (mine ? PRIMARY : PAPER3),
                        color: mine && !special ? '#fff' : INK,
                        borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        padding: isImg ? 0 : '8px 12px',
                        overflow: 'hidden',
                        border: special && !isImg ? `1px solid ${mine ? CORAL : 'rgba(22,34,28,0.1)'}` : 'none',
                      }}>
                        {renderMsg(m, mine)}
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: INK3, fontSize: 12, marginTop: 16 }}>Ingen beskeder endnu</div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ borderTop: `1px solid ${PAPER3}`, padding: '10px 12px', display: 'flex', gap: 8, flexShrink: 0, background: PAPER }}>
                <input
                  ref={inputRef}
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Skriv en besked…"
                  style={{ flex: 1, padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${PAPER3}`, fontSize: 13, fontFamily: FONT, outline: 'none', background: PAPER2, color: INK }}
                />
                <button
                  onClick={send}
                  disabled={sending || !newMsg.trim()}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: newMsg.trim() ? PRIMARY : PAPER3, border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={newMsg.trim() ? '#fff' : INK3} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
        </>
      )}

      {/* ── Bubble button ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: bubbleBottom, right: 20, width: 54, height: 54, borderRadius: '50%',
          background: PRIMARY, border: 'none', cursor: 'pointer', zIndex: 9999,
          boxShadow: '0 4px 20px rgba(42,125,79,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(42,125,79,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(42,125,79,0.35)'; }}>
        {open ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!open && unreadTotal > 0 && (
          <div style={{
            position: 'absolute', top: 1, right: 1, minWidth: 18, height: 18,
            background: CORAL, borderRadius: 99, border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: FONT, padding: '0 3px',
          }}>
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </div>
        )}
      </button>
    </>
  );
}
