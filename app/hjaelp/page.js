'use client';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { CATEGORIES, POPULAR_SLUGS, GUIDE_STEPS, getArticle, countInCategory } from '@/lib/help-content';
import { HelpSearch, HelpHero, ArticleRow } from '@/components/HelpUI';

function openSupportBubble() {
  const btn = document.querySelector('[data-support-bubble]');
  if (btn) btn.click();
}

export default function HelpCenterPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w > 0 && w < 768;

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Hero med søgning ── */}
      <HelpHero isMobile={isMobile}>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 22, fontFamily: FONT }}>
          Hjælpecenter
        </div>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 34 : 52, letterSpacing: '-0.045em', lineHeight: 1.05, color: '#fff', marginBottom: 16 }}>
          Hvordan kan vi hjælpe?
        </h1>
        <p style={{ fontSize: isMobile ? 15 : 18, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto 28px', fontFamily: FONT }}>
          Find svar på alt om at sælge, købe og bytte legetøj på byt&leg.
        </p>
        <HelpSearch big />
      </HelpHero>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '40px 20px 80px' : '56px 40px 100px' }}>

        {/* ── Din guide til byt&leg ── */}
        <section style={{ marginBottom: isMobile ? 48 : 64 }}>
          <div style={{
            background: `linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`,
            borderRadius: 24, padding: isMobile ? '28px 22px' : '36px 40px', position: 'relative', overflow: 'hidden',
          }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'radial-gradient(circle at 85% 20%, rgba(207,227,216,0.10) 0%, transparent 50%)' }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.14)', borderRadius: 999, padding: '5px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, fontFamily: FONT }}>
                Ny på platformen?
              </div>
              <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 24 : 30, letterSpacing: '-0.03em', color: '#fff', margin: '0 0 8px' }}>
                Din guide til byt&leg
              </h2>
              <p style={{ fontFamily: FONT, fontSize: isMobile ? 14 : 15.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 22px', maxWidth: 520 }}>
                Følg de syv trin fra konto til din første handel. Vi guider dig hele vejen.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {GUIDE_STEPS.map((step, i) => {
                  const a = getArticle(step.slug);
                  if (!a) return null;
                  return (
                    <button key={step.slug} onClick={() => router.push(`/hjaelp/artikel/${a.slug}`)} style={{
                      display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14,
                      padding: '13px 16px', cursor: 'pointer',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    >
                      <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#fff', color: PRIMARY, fontFamily: FONT, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      <span style={{ flex: 1, fontFamily: FONT, fontWeight: 600, fontSize: 14.5, color: '#fff' }}>{step.label}</span>
                      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0 }}><path d="M1 1l5 5-5 5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Kategorier ── */}
        <section style={{ marginBottom: isMobile ? 48 : 64 }}>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 26, letterSpacing: '-0.03em', color: INK, margin: '0 0 20px' }}>
            Gennemse efter emne
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 14 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.slug} onClick={() => router.push(`/hjaelp/${cat.slug}`)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16, textAlign: 'left',
                background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 18, padding: '22px 22px', cursor: 'pointer',
                transition: 'box-shadow 0.15s, transform 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 26px rgba(22,34,28,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
              >
                <span style={{ flexShrink: 0, width: 50, height: 50, borderRadius: 14, background: `${cat.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                  <span aria-hidden="true">{cat.icon}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: FONT, fontWeight: 800, fontSize: 17, color: INK, letterSpacing: '-0.02em', marginBottom: 4 }}>{cat.title}</span>
                  <span style={{ display: 'block', fontFamily: FONT, fontSize: 13.5, color: INK3, lineHeight: 1.55, marginBottom: 8 }}>{cat.desc}</span>
                  <span style={{ display: 'block', fontFamily: FONT, fontSize: 12, color: cat.color, fontWeight: 700 }}>{countInCategory(cat.slug)} artikler →</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Populære artikler ── */}
        <section style={{ marginBottom: isMobile ? 48 : 64 }}>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 26, letterSpacing: '-0.03em', color: INK, margin: '0 0 20px' }}>
            Populære artikler
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
            {POPULAR_SLUGS.map(slug => {
              const a = getArticle(slug);
              if (!a) return null;
              return <ArticleRow key={slug} article={a} onClick={() => router.push(`/hjaelp/artikel/${a.slug}`)} />;
            })}
          </div>
        </section>

        {/* ── AI-assistent CTA ── */}
        <section>
          <div style={{
            background: GREEN_TINT, border: `1px solid ${GREEN_SOFT}`, borderRadius: 24,
            padding: isMobile ? '28px 22px' : '36px 40px',
            display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: 24,
          }}>
            <div style={{ flexShrink: 0, width: 60, height: 60, borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: '0 6px 20px rgba(19,63,43,0.10)' }}>
              <span aria-hidden="true">💬</span>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 20 : 23, letterSpacing: '-0.02em', color: INK, margin: '0 0 6px' }}>
                Fandt du ikke svaret?
              </h2>
              <p style={{ fontFamily: FONT, fontSize: 14.5, color: INK2, lineHeight: 1.6, margin: 0 }}>
                Spørg vores AI-assistent. Den svarer med det samme på de fleste spørgsmål og sender dig videre til supportteamet, hvis den er i tvivl.
              </p>
            </div>
            <button onClick={openSupportBubble} style={{
              flexShrink: 0, background: PRIMARY, color: '#fff', border: 'none', borderRadius: 999,
              padding: '14px 26px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              Chat med os
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
