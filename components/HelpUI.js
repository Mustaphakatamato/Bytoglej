'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER3, BUTTER, CORAL, SKY, FONT } from '@/lib/constants';

/* Søgefelt, bruges i hero og kan styres udefra. */
export function HelpSearch({ defaultValue = '', autoFocus = false, big = false }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const submit = (e) => {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? `/hjaelp/soeg?q=${encodeURIComponent(t)}` : '/hjaelp');
  };
  return (
    <form onSubmit={submit} style={{ position: 'relative', width: '100%', maxWidth: big ? 560 : 480, margin: '0 auto' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Søg i hjælpecentret…"
        aria-label="Søg i hjælpecentret"
        style={{
          width: '100%', boxSizing: 'border-box', fontFamily: FONT, fontSize: 16,
          padding: big ? '16px 18px 16px 50px' : '14px 18px 14px 48px',
          borderRadius: 999, border: 'none', outline: 'none', color: INK,
          background: '#fff', boxShadow: '0 6px 24px rgba(19,63,43,0.12)',
        }}
      />
    </form>
  );
}

/* Brødkrumme-sti tilbage til hjælpecentret. */
export function HelpBreadcrumb({ trail }) {
  const router = useRouter();
  return (
    <nav aria-label="Sti" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 18, fontFamily: FONT, fontSize: 13 }}>
      {trail.map((t, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {last ? (
              <span style={{ color: INK3, fontWeight: 600 }}>{t.label}</span>
            ) : (
              <button onClick={() => router.push(t.href)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: PRIMARY, fontWeight: 600, fontFamily: FONT, fontSize: 13 }}>
                {t.label}
              </button>
            )}
            {!last && <span aria-hidden="true" style={{ color: INK3 }}>›</span>}
          </span>
        );
      })}
    </nav>
  );
}

const NOTE_STYLES = {
  info: { bg: GREEN_TINT, border: GREEN_SOFT, icon: 'ℹ️', accent: PRIMARY },
  tip:  { bg: '#FEF9C3', border: '#FDE68A', icon: '💡', accent: '#92400E' },
  warn: { bg: '#FEF2F2', border: '#FECACA', icon: '⚠️', accent: '#B91C1C' },
};

/* Renderer for et artikel-indhold (blocks[]). */
export function ArticleBlocks({ blocks }) {
  const router = useRouter();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          return <h2 key={i} style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK, letterSpacing: '-0.02em', margin: '10px 0 -4px' }}>{b.text}</h2>;
        }
        if (b.type === 'p') {
          return <p key={i} style={{ fontFamily: FONT, fontSize: 16, lineHeight: 1.75, color: INK2, margin: 0 }}>{b.text}</p>;
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: FONT, fontSize: 15.5, lineHeight: 1.65, color: INK2 }}>
                  <span aria-hidden="true" style={{ color: PRIMARY, flexShrink: 0, marginTop: 2 }}>✓</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, counterReset: 'step' }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', fontFamily: FONT, fontSize: 15.5, lineHeight: 1.6, color: INK2 }}>
                  <span aria-hidden="true" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: GREEN_TINT, color: PRIMARY, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{j + 1}</span>
                  <span style={{ paddingTop: 2 }}>{it}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (b.type === 'note') {
          const s = NOTE_STYLES[b.tone] || NOTE_STYLES.info;
          return (
            <div key={i} style={{ display: 'flex', gap: 12, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 14, padding: '14px 16px' }}>
              <span aria-hidden="true" style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.4 }}>{s.icon}</span>
              <p style={{ fontFamily: FONT, fontSize: 14.5, lineHeight: 1.6, color: s.accent, margin: 0, fontWeight: 500 }}>{b.text}</p>
            </div>
          );
        }
        if (b.type === 'cta') {
          return (
            <button key={i} onClick={() => router.push(b.href)} style={{
              alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8,
              background: PRIMARY, color: '#fff', border: 'none', borderRadius: 999,
              padding: '12px 22px', fontFamily: FONT, fontWeight: 700, fontSize: 14.5, cursor: 'pointer',
            }}>
              {b.label} <span aria-hidden="true">→</span>
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}

/* Lille kort til en artikel (bruges i lister og "relaterede"). */
export function ArticleRow({ article, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
      background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
      transition: 'box-shadow 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,34,28,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      <span aria-hidden="true" style={{ fontSize: 22, flexShrink: 0, width: 28, textAlign: 'center' }}>{article.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 15.5, color: INK, letterSpacing: '-0.01em' }}>{article.title}</span>
        <span style={{ display: 'block', fontFamily: FONT, fontSize: 13, color: INK3, marginTop: 2, lineHeight: 1.45 }}>{article.excerpt}</span>
      </span>
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0 }}><path d="M1 1l5 5-5 5" stroke={INK3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

/* Grøn hero-top der genbruges på alle hjælpe-sider. */
export function HelpHero({ children, isMobile, compact = false }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
      paddingTop: compact ? 110 : 140, paddingBottom: compact ? (isMobile ? 70 : 84) : (isMobile ? 80 : 110),
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 18% 30%, rgba(255,255,255,0.08) 0%, transparent 45%), radial-gradient(circle at 85% 70%, rgba(207,227,216,0.08) 0%, transparent 45%)' }} />
      <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto', padding: '0 24px', zIndex: 2 }}>
        {children}
      </div>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }}>
        <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill={PAPER} />
      </svg>
    </div>
  );
}
