'use client';
import { useState, useEffect } from 'react';
import { PRIMARY, GREEN_TINT, GREEN_DEEP, PAPER, PAPER2, PAPER3, INK, INK3, FONT } from '@/lib/constants';
import { authedFetch } from '@/lib/authed-fetch';

const CATEGORIES = [
  { key: 'bug',        label: 'Fejl / bug',  emoji: '🐛' },
  { key: 'suggestion', label: 'Forslag',      emoji: '💡' },
  { key: 'general',   label: 'Generelt',      emoji: '⭐' },
];

const FIRST_SHOWN_KEY = 'ltb_pilot_welcomed';

export default function FeedbackWidget({ loggedIn, institutionName, userEmail }) {
  const [open, setOpen]         = useState(false);
  const [category, setCategory] = useState('general');
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [isFirst, setIsFirst]   = useState(false);

  // Auto-open on first login
  useEffect(() => {
    if (!loggedIn) return;
    try {
      if (!localStorage.getItem(FIRST_SHOWN_KEY)) {
        const t = setTimeout(() => {
          setIsFirst(true);
          setOpen(true);
          localStorage.setItem(FIRST_SHOWN_KEY, '1');
        }, 1500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [loggedIn]);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await authedFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message, institutionName, userEmail }),
      });
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setMessage('');
        setCategory('general');
        setIsFirst(false);
      }, 2200);
    } catch {
      setSending(false);
    }
    setSending(false);
  }

  function handleClose() {
    setOpen(false);
    setSent(false);
    setMessage('');
    setIsFirst(false);
  }

  if (!loggedIn) return null;

  return (
    <>
      {/* ── Floating button — mirrors chat bubble on the left ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Pilot-feedback"
        style={{
          position: 'fixed',
          bottom: 'calc(84px + env(safe-area-inset-bottom, 0px) + 14px)',
          left: 20,
          zIndex: 9990,
          width: 46, height: 46, borderRadius: '50%',
          background: open ? PRIMARY : PAPER,
          border: `1.5px solid ${open ? PRIMARY : PAPER3}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(22,34,28,0.14)',
          fontSize: 20,
          transition: 'all 0.15s',
        }}
      >
        🚀
      </button>

      {/* ── Modal backdrop ── */}
      {open && (
        <>
          <div
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.35)', zIndex: 9991, backdropFilter: 'blur(2px)' }}
          />

          {/* ── Modal — centred on mobile, anchored bottom-left on desktop ── */}
          <div style={{
            position: 'fixed',
            bottom: 'calc(84px + env(safe-area-inset-bottom, 0px) + 68px)',
            left: 20,
            zIndex: 9992,
            width: 'min(340px, calc(100vw - 40px))',
            background: PAPER, borderRadius: 20,
            boxShadow: '0 8px 40px rgba(22,34,28,0.18)',
            border: `1px solid ${PAPER3}`,
            fontFamily: FONT, overflow: 'hidden',
          }}>

            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, padding: '20px 20px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>
                    {isFirst ? 'Velkommen til pilotfasen! 🚀' : 'Giv os feedback'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                    {isFirst
                      ? 'Vi er stadig i gang med at bygge byt&leg. Har du opdaget noget der ikke virker, eller et forslag til os?'
                      : 'Hjælp os med at gøre byt&leg bedre for alle institutioner.'}
                  </div>
                </div>
                <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
            </div>

            {sent ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🙏</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: INK, marginBottom: 6 }}>Tak for din feedback!</div>
                <div style={{ fontSize: 13, color: INK3 }}>Vi kigger på det hurtigst muligt.</div>
              </div>
            ) : (
              <div style={{ padding: '16px 20px 20px' }}>
                {/* Category */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setCategory(c.key)}
                      style={{
                        flex: 1, padding: '8px 4px', border: `1.5px solid ${category === c.key ? PRIMARY : PAPER3}`,
                        borderRadius: 12, background: category === c.key ? GREEN_TINT : '#fff',
                        cursor: 'pointer', fontFamily: FONT, fontSize: 11, fontWeight: 700,
                        color: category === c.key ? PRIMARY : INK3,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        transition: 'all 0.12s',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{c.emoji}</span>
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Text area */}
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={
                    category === 'bug' ? 'Beskriv hvad der gik galt og hvad du forsøgte at gøre…'
                    : category === 'suggestion' ? 'Hvad ville gøre byt&leg bedre for jer?'
                    : 'Hvad tænker du om byt&leg indtil videre?'
                  }
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 12px', border: `1.5px solid ${PAPER3}`,
                    borderRadius: 12, background: PAPER2, fontFamily: FONT, fontSize: 13,
                    color: INK, resize: 'none', outline: 'none', boxSizing: 'border-box',
                    lineHeight: 1.55,
                  }}
                  onFocus={e => { e.target.style.borderColor = PRIMARY; }}
                  onBlur={e => { e.target.style.borderColor = PAPER3; }}
                />

                {institutionName && (
                  <div style={{ fontSize: 11, color: INK3, marginTop: 8 }}>
                    Sender som <strong style={{ color: INK }}>{institutionName}</strong>
                  </div>
                )}

                {/* Send */}
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  style={{
                    width: '100%', marginTop: 12, padding: '12px',
                    borderRadius: 12, border: 'none',
                    background: message.trim() && !sending ? PRIMARY : PAPER3,
                    color: message.trim() && !sending ? '#fff' : INK3,
                    fontFamily: FONT, fontWeight: 700, fontSize: 14,
                    cursor: message.trim() && !sending ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}
                >
                  {sending ? 'Sender…' : 'Send feedback'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
