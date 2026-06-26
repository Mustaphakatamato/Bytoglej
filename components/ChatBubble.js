'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK3, CORAL, FONT } from '@/lib/constants';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { useWindowWidth } from '@/lib/hooks';

const PANEL_W = 340;
const SUPPORT_CONV_KEY = 'bl_support_conv_id';

// Gør interne stier (/signup) og URL'er klikbare i support-beskeder.
// Token-baseret for at undgå at ramme skråstreger midt i ord (fx "ja/nej").
function linkify(text, onNavigate) {
  if (!text) return text;
  return String(text).split(/(\s+)/).map((tok, i) => {
    const m = tok.match(/^([([]*)((?:https?:\/\/[^\s]+)|(?:\/[a-zA-Z][a-zA-Z0-9\-/]*))([)\].,!?:;]*)$/);
    if (!m) return tok;
    const [, pre, url, post] = m;
    const external = /^https?:/.test(url);
    return (
      <React.Fragment key={i}>
        {pre}
        <a
          href={url}
          onClick={external ? undefined : (e) => { e.preventDefault(); onNavigate?.(url); }}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 700 }}
        >{url}</a>
        {post}
      </React.Fragment>
    );
  });
}

// ── Support chat ──────────────────────────────────────────────────────────────

function SupportChat({ userId, userName, institutionName, onNavigate }) {
  const GREETING = { role: 'bot', content: 'Hej! Jeg er byt&legs AI-assistent. Hvad kan jeg hjælpe dig med?' };
  const [messages, setMessages]   = useState([GREETING]); // {role:'user'|'bot'|'admin', content}
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [convId, setConvId]       = useState(null);
  const [escalated, setEscalated] = useState(false); // bot couldn't answer → offer human
  const [human, setHuman]         = useState(false);  // conversation handed to support
  const [submitted, setSubmitted] = useState(false);  // guest form sent
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [showForm, setShowForm]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const isGuest = !userId;

  // Load or restore conversation history via the API (capability = the stored UUID)
  useEffect(() => {
    const stored = localStorage.getItem(SUPPORT_CONV_KEY);
    if (!stored) return;
    setConvId(stored);
    (async () => {
      try {
        const res = await fetch(`/api/support-chat?conversationId=${encodeURIComponent(stored)}`);
        const { messages: hist, status } = await res.json();
        if (Array.isArray(hist) && hist.length) {
          setMessages(hist.map(m => ({ id: m.id, role: m.role, content: m.content })));
          if (status === 'waiting_human' || status === 'open') { setEscalated(true); setHuman(true); setSubmitted(true); }
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [messages, loading]);

  // Realtime admin replies — only for logged-in users (RLS scopes reads to the owner).
  useEffect(() => {
    if (!convId || !userId) return;
    const ch = db.channel(`support-msgs-${convId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_messages',
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: m }) => {
        if (m.role === 'admin') {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, { id: m.id, role: 'admin', content: m.content }]);
        }
      })
      .subscribe();
    return () => db.removeChannel(ch);
  }, [convId, userId]);

  // Anonymous visitors have no RLS identity for realtime, so poll the API for admin
  // replies every 5s while the chat is open (component is only mounted when open).
  useEffect(() => {
    if (!convId || userId) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/support-chat?conversationId=${encodeURIComponent(convId)}`);
        const { messages: hist } = await res.json();
        if (!Array.isArray(hist)) return;
        setMessages(prev => {
          const have = new Set(prev.map(x => x.id).filter(Boolean));
          const incoming = hist.filter(m => m.role === 'admin' && !have.has(m.id))
            .map(m => ({ id: m.id, role: 'admin', content: m.content }));
          return incoming.length ? [...prev, ...incoming] : prev;
        });
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [convId, userId]);

  // Post to the support API; persistence + bot run server-side. Returns the response JSON.
  async function callApi(payload) {
    const res = await fetch('/api/support-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: convId,
        userId: userId || null,
        userName: userName || guestName || null,
        userEmail: guestEmail || null,
        institutionName: institutionName || null,
        ...payload,
      }),
    });
    const data = await res.json();
    if (data.conversationId && data.conversationId !== convId) {
      setConvId(data.conversationId);
      localStorage.setItem(SUPPORT_CONV_KEY, data.conversationId);
    }
    return data;
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);

    // History for the AI: drop the static greeting + the just-added user message
    const history = newMessages.slice(1, -1).filter(m => m.role !== 'admin');

    try {
      const data = await callApi({ message: text, history, mode: human ? 'human' : 'bot' });
      if (data.humanMode) {
        setHuman(true);
      } else if (data.reply) {
        const reply = data.escalate
          ? data.reply + (/[.!?]$/.test(data.reply) ? '' : '.') + ' Vil du have mig til at sende din besked videre til vores supportteam?'
          : data.reply;
        setMessages(m => [...m, { role: 'bot', content: reply }]);
        if (data.escalate) setEscalated(true);
      }
    } catch {
      setMessages(m => [...m, { role: 'bot', content: 'Beklager, der opstod en fejl. Prøv igen.' }]);
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function submitEscalationForm() {
    try {
      await callApi({ mode: 'handoff' });
    } catch {}
    setHuman(true);
    setSubmitted(true);
    setShowForm(false);
    setMessages(m => [...m, { role: 'bot', content: 'Tak! Vores supportteam har modtaget din henvendelse og vender tilbage inden for 1-2 hverdage. Du kan skrive videre herunder.' }]);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m, i) => {
          const isUser  = m.role === 'user';
          const isAdmin = m.role === 'admin';
          return (
            <div key={m.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 2 }}>
              {!isUser && (
                <div style={{ fontSize: 10, fontWeight: 700, color: INK3, fontFamily: FONT, paddingLeft: 4 }}>
                  {isAdmin ? 'Support' : 'AI-assistent'}
                </div>
              )}
              <div style={{
                maxWidth: '82%',
                background: isUser ? PRIMARY : isAdmin ? '#E8F5E9' : PAPER3,
                color: isUser ? '#fff' : INK,
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '9px 13px',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: FONT,
                border: isAdmin ? `1px solid ${PRIMARY}22` : 'none',
                whiteSpace: 'pre-wrap',
              }}>
                {linkify(m.content, onNavigate)}
              </div>
            </div>
          );
        })}

        {loading && !human && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: INK3, fontFamily: FONT, paddingLeft: 4 }}>AI-assistent</div>
            <div style={{ background: PAPER3, borderRadius: '16px 16px 16px 4px', padding: '10px 14px', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: INK3,
                  animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Escalation CTA */}
        {escalated && !human && !showForm && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => isGuest ? setShowForm(true) : submitEscalationForm()}
              style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '8px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', marginTop: 4 }}>
              Ja, kontakt support
            </button>
          </div>
        )}

        {/* Guest form for escalation */}
        {showForm && !human && (
          <div style={{ background: PAPER2, borderRadius: 12, padding: 14, border: `1px solid ${PAPER3}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: INK, fontFamily: FONT }}>Hvem skal vi kontakte?</div>
            <input
              placeholder="Dit navn"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${PAPER3}`, fontSize: 13, fontFamily: FONT, outline: 'none', background: PAPER }}
            />
            <input
              placeholder="Din e-mail"
              type="email"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${PAPER3}`, fontSize: 13, fontFamily: FONT, outline: 'none', background: PAPER }}
            />
            <button
              onClick={submitEscalationForm}
              disabled={!guestEmail.trim()}
              style={{ background: guestEmail.trim() ? PRIMARY : PAPER3, color: guestEmail.trim() ? '#fff' : INK3, border: 'none', borderRadius: 99, padding: '9px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: guestEmail.trim() ? 'pointer' : 'default' }}>
              Send til support
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Status banner when handed to a human */}
      {human && (
        <div style={{ flexShrink: 0, background: '#E8F5E9', borderTop: `1px solid ${PRIMARY}22`, padding: '7px 14px', fontSize: 11, fontWeight: 600, color: PRIMARY, fontFamily: FONT, textAlign: 'center' }}>
          Du skriver nu med vores supportteam
        </div>
      )}

      {/* Input */}
      <div style={{ borderTop: `1px solid ${PAPER3}`, padding: '10px 12px', display: 'flex', gap: 8, flexShrink: 0, background: PAPER }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={human ? 'Skriv til support…' : 'Skriv et spørgsmål…'}
          disabled={loading}
          style={{ flex: 1, padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${PAPER3}`, fontSize: 13, fontFamily: FONT, outline: 'none', background: PAPER2, color: INK }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{ width: 36, height: 36, borderRadius: '50%', background: input.trim() && !loading ? PRIMARY : PAPER3, border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? '#fff' : INK3} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

// ── Conversations (existing beskeder) ─────────────────────────────────────────

function ConvsPanel({ userId, institutionId, institution, isAdminView, adminInstName, realUserId, fetchUnread, router, setOpen }) {
  const [convs,      setConvs]      = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [newMsg,     setNewMsg]     = useState('');
  const [sending,    setSending]    = useState(false);
  const [swapProps,  setSwapProps]  = useState({});
  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const loadConvsRef = useRef(null);

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

  const loadConvs = useCallback(async () => {
    if (!userId) return;
    const orParts = [`initiator_id.eq.${userId}`, `owner_id.eq.${userId}`];
    if (institutionId) orParts.push(`owner_institution_id.eq.${institutionId}`, `initiator_institution_id.eq.${institutionId}`);
    if (institution?.name) orParts.push(`owner_name.eq.${institution.name}`, `initiator_name.eq.${institution.name}`);
    const { data } = await db.from('conversations').select('*').or(orParts.join(',')).order('last_message_at', { ascending: false });
    if (data) setConvs(data);
  }, [userId, institutionId, institution?.name]);

  useEffect(() => { loadConvsRef.current = loadConvs; }, [loadConvs]);
  useEffect(() => { loadConvs(); }, [loadConvs]);

  useEffect(() => {
    if (!userId) return;
    const ch = db.channel('bubble-convs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' },
        () => loadConvsRef.current?.())
      .subscribe();
    return () => db.removeChannel(ch);
  }, [userId]);

  useEffect(() => {
    if (!activeConv) return;
    const ch = db.channel(`bubble-msgs-${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConv.id}` },
        ({ new: m }) => {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
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
  }, [activeConv?.id, userId, institutionId, fetchUnread]);

  useEffect(() => {
    const ids = messages
      .filter(m => m.message_type === 'swap_proposal')
      .map(m => { try { return JSON.parse(m.content)?.proposal_id; } catch { return null; } })
      .filter(id => id && !swapProps[id]);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await db.from('swap_proposals').select('*').in('id', [...new Set(ids)]);
      if (!cancelled && data?.length) setSwapProps(p => ({ ...p, ...Object.fromEntries(data.map(x => [x.id, x])) }));
    })();
    return () => { cancelled = true; };
  }, [messages, swapProps]);

  useEffect(() => {
    if (activeConv) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeConv?.id]);

  async function openConv(conv) {
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
    const unreadField = isInit ? 'owner_unread' : 'initiator_unread';
    const upd = { last_message: content, last_message_at: new Date().toISOString() };
    await db.from('conversations').update(upd).eq('id', activeConv.id);
    // Inkrementér modtagerens ulæst-tæller atomisk i DB i stedet for at lægge
    // +1 oven på en evt. forældet cachet værdi (som ellers opblæser tælleren).
    await db.rpc('bump_conv_unread', { p_conv_id: activeConv.id, p_field: unreadField });
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
      return <span style={{ fontSize: 12 }}>Billede</span>;
    }
    if (m.message_type === 'bundle') return <span style={{ fontSize: 12 }}>Bundttilbud. Tryk for at se</span>;
    if (m.message_type === 'bid')    return <span style={{ fontSize: 12 }}>Bud</span>;
    if (m.message_type === 'offer') {
      let d = null;
      try { d = JSON.parse(m.content); } catch {}
      return <span style={{ fontSize: 12 }}>Tilbud: {d?.amount ?? '?'} kr.</span>;
    }
    if (m.message_type === 'swap') return <span style={{ fontSize: 12 }}>Bytteforslag</span>;
    if (m.message_type === 'swap_proposal') {
      let pid = null;
      try { pid = JSON.parse(m.content)?.proposal_id; } catch {}
      const p = pid ? swapProps[pid] : null;
      if (!p) return <span style={{ fontSize: 12 }}>Bytteforslag…</span>;
      const krp = n => `${(Number(n) || 0).toFixed(2).replace('.', ',')} kr.`;
      const party = activeConv && amInit(activeConv) ? 'initiator' : 'owner';
      const cash = Number(p.cash_adjustment) || 0;
      const iGive = party === 'initiator' ? (p.offered_items || []) : (p.requested_items || []);
      const iGet  = party === 'initiator' ? (p.requested_items || []) : (p.offered_items || []);
      const iAmCash    = cash > 0 && p.cash_payer === party;
      const otherIsCash = cash > 0 && p.cash_payer && p.cash_payer !== party;
      const sum = arr => arr.reduce((s, it) => s + (Number(it.price) || 0), 0);
      const badge = p.escrow_status === 'both_paid_released' ? ['Gennemført', PRIMARY, '#D1FAE5']
        : p.escrow_status === 'cancelled_timeout' ? ['Frist udløb', '#e11d48', '#FEE2E2']
        : p.status === 'rejected' ? ['Afvist', '#e11d48', '#FEE2E2']
        : p.status === 'accepted' ? ['Godkendt', '#B45309', '#FEF9C3'] : null;
      const itemRow = (it, ix) => (
        <div key={ix} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: it.image ? PAPER : (it.color || '#FFD166'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {it.image ? <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (it.emoji || '')}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: INK, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
          {Number(it.price) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: INK, fontFamily: FONT, flexShrink: 0 }}>{krp(it.price)}</span>}
        </div>
      );
      const cashRow = key => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>$</div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: INK, fontFamily: FONT }}>Kontant mellemlag</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: INK, fontFamily: FONT, flexShrink: 0 }}>{krp(cash)}</span>
        </div>
      );
      const section = (label, items, hasCash, total) => (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: INK3, textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: FONT }}>{label}</span>
            {(items.length > 0 || hasCash) && <span style={{ fontSize: 12, fontWeight: 800, color: INK, fontFamily: FONT }}>{krp(total)}</span>}
          </div>
          {(items.length > 0 || hasCash)
            ? <>{items.map(itemRow)}{hasCash && cashRow(`${label}-c`)}</>
            : <span style={{ fontSize: 11, color: INK3, fontFamily: FONT }}>-</span>}
        </div>
      );
      return (
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: INK, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontFamily: FONT }}>
            Bytteforslag
            {badge && <span style={{ fontSize: 9, fontWeight: 700, color: badge[1], background: badge[2], padding: '1px 6px', borderRadius: 99 }}>{badge[0]}</span>}
          </div>
          {section('Du giver', iGive, iAmCash, sum(iGive) + (iAmCash ? cash : 0))}
          {section('Du far', iGet, otherIsCash, sum(iGet) + (otherIsCash ? cash : 0))}
        </div>
      );
    }
    if (m.message_type === 'buy_request') {
      let d = null;
      try { d = JSON.parse(m.content); } catch {}
      return (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: PRIMARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            Kobsforesprasel
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sub-header when in conv */}
      {activeConv && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${PAPER3}`, flexShrink: 0 }}>
          <button onClick={() => { setActiveConv(null); setMessages([]); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 10px 2px 0', color: INK3, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
            {otherName(activeConv)}
          </div>
          <button
            onClick={() => { router.push('/beskeder?conv=' + activeConv.id); setOpen(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: PRIMARY, fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>
            Abn fuldt →
          </button>
        </div>
      )}

      {/* Conv list */}
      {!activeConv && (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 6px', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: INK3, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Samtaler</div>
            <button onClick={() => { router.push('/beskeder'); setOpen(false); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: PRIMARY, fontWeight: 700, fontFamily: FONT }}>
              Se alle →
            </button>
          </div>
          {convs.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: INK3, fontSize: 13, fontFamily: FONT }}>Ingen samtaler endnu</div>
          )}
          {convs.map(conv => {
            const unread = myUnread(conv);
            return (
              <div key={conv.id}
                onClick={() => openConv(conv)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer', borderBottom: `1px solid ${PAPER2}`, background: unread > 0 ? PAPER2 : 'transparent', transition: 'background 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = PAPER3; }}
                onMouseLeave={e => { e.currentTarget.style.background = unread > 0 ? PAPER2 : 'transparent'; }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: GREEN_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: PRIMARY, flexShrink: 0, fontFamily: FONT }}>
                  {otherName(conv)?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
                    {otherName(conv)}
                  </div>
                  <div style={{ fontSize: 11, color: unread > 0 ? INK : INK3, fontWeight: unread > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1, fontFamily: FONT }}>
                    {conv.last_message || '-'}
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
              const mine    = m.sender_id === userId;
              const special = ['image', 'bundle', 'bid', 'swap', 'swap_proposal', 'buy_request'].includes(m.message_type);
              const isImg   = m.message_type === 'image';
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
              <div style={{ textAlign: 'center', color: INK3, fontSize: 12, marginTop: 16, fontFamily: FONT }}>Ingen beskeder endnu</div>
            )}
            <div ref={bottomRef} />
          </div>

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
  );
}

// ── Main ChatBubble ───────────────────────────────────────────────────────────

export default function ChatBubble() {
  const router   = useRouter();
  const pathname = usePathname();
  const { unreadTotal, fetchUnread } = useApp();
  const { userId: ctxUserId, institution, institutionId, isAdminView, adminInstName, realUserId } = useActiveUser();

  const [open, setOpen]   = useState(false);
  const [tab, setTab]     = useState('support'); // 'messages' | 'support'

  const w = useWindowWidth();
  const isMobile = w > 0 && w < 768;
  const bubbleBottom = isMobile ? 'calc(84px + env(safe-area-inset-bottom, 0px) + 14px)' : '20px';
  const panelBottom  = isMobile ? 'calc(84px + env(safe-area-inset-bottom, 0px) + 78px)' : '80px';

  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplashDone(true), 1400); return () => clearTimeout(t); }, []);

  const userId = realUserId || ctxUserId;

  // Hidden on beskeder and admin pages
  const hidden = !splashDone || !!pathname?.startsWith('/beskeder') || !!pathname?.startsWith('/admin');

  // When logged in and has unread messages, default to messages tab
  useEffect(() => {
    if (open && userId && unreadTotal > 0) setTab('messages');
  }, [open, userId, unreadTotal]);

  if (hidden) return null;

  const isLoggedIn = !!userId;

  return (
    <>
      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9997 }} />
          <div style={{
            position: 'fixed', bottom: panelBottom, right: 20, width: PANEL_W, height: 520,
            background: PAPER, borderRadius: 20, zIndex: 9998,
            boxShadow: '0 8px 48px rgba(22,34,28,0.18)', border: `1px solid ${PAPER3}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FONT,
          }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: INK, fontFamily: FONT }}>byt&amp;leg</div>
                  <div style={{ fontSize: 11, color: PRIMARY, fontFamily: FONT, fontWeight: 600 }}>Online</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK3, fontSize: 18, lineHeight: 1, padding: 4 }}>
                ✕
              </button>
            </div>

            {/* Tabs — only show if logged in */}
            {isLoggedIn && (
              <div style={{ display: 'flex', padding: '10px 16px 0', gap: 0, flexShrink: 0 }}>
                {[
                  { id: 'support',  label: 'Support' },
                  { id: 'messages', label: 'Beskeder', badge: unreadTotal > 0 ? unreadTotal : null },
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    flex: 1, background: 'none', border: 'none',
                    borderBottom: tab === t.id ? `2px solid ${PRIMARY}` : `2px solid ${PAPER3}`,
                    padding: '8px 4px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                    color: tab === t.id ? PRIMARY : INK3, cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}>
                    {t.label}
                    {t.badge && (
                      <span style={{ background: CORAL, color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 800, padding: '1px 6px', fontFamily: FONT }}>
                        {t.badge > 99 ? '99+' : t.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginTop: isLoggedIn ? 0 : 8 }}>
              {(!isLoggedIn || tab === 'support') && (
                <SupportChat
                  userId={userId}
                  userName={institution?.name || adminInstName || null}
                  institutionName={institution?.name || adminInstName || null}
                  onNavigate={(path) => { router.push(path); setOpen(false); }}
                />
              )}
              {isLoggedIn && tab === 'messages' && (
                <ConvsPanel
                  userId={userId}
                  institutionId={institutionId}
                  institution={institution}
                  isAdminView={isAdminView}
                  adminInstName={adminInstName}
                  realUserId={realUserId}
                  fetchUnread={fetchUnread}
                  router={router}
                  setOpen={setOpen}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Bubble button ─────────────────────────────────────────────────── */}
      <button
        data-support-bubble
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
