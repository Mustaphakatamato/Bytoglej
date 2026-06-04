'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

const FONT = "'Sora', sans-serif";

const STEPS = [
  {
    emoji: '🧸',
    bg: '#FFFBEB',
    accent: '#D97706',
    label: '01',
    title: 'Legetøjet samler støv',
    desc: 'Du har cykler, puslespil eller møbler der ikke bruges. Et andet sted vil de gøre børn glade — men de bare fylder hos jer.',
    points: ['Legetøj der ikke bruges', 'Møbler der er gået ud af mode', 'Cykler og udstyr der er for store', 'Materialer fra afsluttede projekter'],
  },
  {
    emoji: '📸',
    bg: '#F0FDF4',
    accent: '#16A34A',
    label: '02',
    title: 'Opret et opslag på 2 min.',
    desc: 'Tag ét billede. Vores AI scanner det og udfylder automatisk titel, kategori, stand og beskrivelse. Vælg pris eller byt.',
    points: ['AI udfylder titel og beskrivelse', 'Vælg køb, byt eller byd', 'Synlig for alle verificerede institutioner', 'Ingen annonceringsomkostninger'],
  },
  {
    emoji: '💬',
    bg: '#EFF6FF',
    accent: '#2563EB',
    label: '03',
    title: 'Institutioner byder og skriver',
    desc: 'Verificerede børnehaver og skoler kontakter dig direkte via platformen. Forhandl, byd eller accepter — du bestemmer.',
    points: ['Direkte beskeder i platformen', 'Modtag bud og forhandl', 'Byttetilbud fra andre institutioner', 'Notifikationer på nye henvendelser'],
  },
  {
    emoji: '🚀',
    bg: '#FDF4FF',
    accent: '#9333EA',
    label: '04',
    title: 'Nyt hjem, ny glæde',
    desc: 'I aftaler pris og afhentning. Legetøjet giver glæde et nyt sted — og I har skabt plads og fået penge eller noget nyt i bytte.',
    points: ['Aftaler pris og afhentning direkte', 'Pengene går til jer', 'Platformen registrerer handlen', 'CO₂-besparelse beregnes automatisk'],
  },
];

// ── Scroll-reveal timeline ────────────────────────────────────────────────────
function JourneySection({ isMobile }) {
  const rowRefs = useRef([]);

  useEffect(() => {
    const observers = rowRefs.current.map((el) => {
      if (!el) return null;
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          } else if (entry.boundingClientRect.top > 0) {
            // Element is below viewport → user scrolled back up → reset so it re-animates
            el.style.opacity = '0';
            el.style.transform = 'translateY(52px)';
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
      );
      io.observe(el);
      return io;
    });
    return () => observers.forEach(io => io?.disconnect());
  }, []);

  // Circle size + padding determines where the center line sits
  const pad   = isMobile ? 20 : 40;
  const czSz  = isMobile ? 48 : 56;
  const lineX = pad + czSz / 2 - 1; // center of circles, minus half line width

  return (
    <div style={{ background: PAPER, padding: isMobile ? '72px 0 88px' : '100px 0 120px' }}>

      {/* ── Section header ── */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? 60 : 80, padding: '0 24px' }}>
        <div style={{ display: 'inline-block', background: GREEN_TINT, borderRadius: 999, padding: '5px 16px', fontSize: 11, fontWeight: 700, color: PRIMARY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontFamily: FONT }}>
          Sådan virker det
        </div>
        <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 30 : 46, letterSpacing: '-0.04em', color: INK, margin: '0 0 12px', lineHeight: 1.05 }}>
          Rejsen fra støv til glæde
        </h2>
        <p style={{ color: INK3, fontSize: isMobile ? 15 : 17, maxWidth: 400, margin: '0 auto', fontFamily: FONT, lineHeight: 1.65 }}>
          Fire trin. Ingen gebyrer. Bare legetøj der finder et nyt hjem.
        </p>
      </div>

      {/* ── Timeline ── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: `0 ${pad}px`, position: 'relative' }}>

        {/* Vertical connecting line */}
        <div style={{
          position: 'absolute',
          left: lineX,
          top: czSz / 2,
          bottom: czSz / 2,
          width: 2,
          background: PAPER3,
          borderRadius: 1,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 36 : 48 }}>
          {STEPS.map((step, i) => (
            <div
              key={i}
              ref={el => rowRefs.current[i] = el}
              style={{
                display: 'flex',
                gap: isMobile ? 20 : 28,
                alignItems: 'flex-start',
                opacity: 0,
                transform: 'translateY(52px)',
                transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              {/* Circle on timeline */}
              <div style={{
                flexShrink: 0,
                width: czSz, height: czSz, borderRadius: '50%',
                background: '#fff',
                border: `2px solid ${step.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isMobile ? 22 : 24,
                boxShadow: `0 4px 18px ${step.accent}44`,
                position: 'relative', zIndex: 2,
              }}>
                {step.emoji}
              </div>

              {/* Card */}
              <div style={{
                flex: 1,
                background: '#fff',
                borderRadius: isMobile ? 16 : 20,
                padding: isMobile ? '18px 20px' : '24px 28px',
                boxShadow: '0 1px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
                borderLeft: `3px solid ${step.accent}`,
                position: 'relative', overflow: 'hidden',
              }}>

                {/* Watermark step number */}
                <div style={{
                  position: 'absolute', top: -4, right: 12,
                  fontFamily: FONT, fontWeight: 800,
                  fontSize: isMobile ? 64 : 80,
                  color: step.accent, opacity: 0.07,
                  lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
                  letterSpacing: '-0.05em',
                }}>
                  {step.label}
                </div>

                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, color: step.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Trin {step.label}
                </div>

                <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 17 : 20, color: INK, letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.2 }}>
                  {step.title}
                </h3>

                <p style={{ fontSize: isMobile ? 13 : 14, color: INK3, lineHeight: 1.65, fontFamily: FONT, margin: '0 0 14px' }}>
                  {step.desc}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {step.points.map((p, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: step.accent, flexShrink: 0 }} />
                      <span style={{ fontSize: isMobile ? 11 : 12, color: INK2, fontFamily: FONT, fontWeight: 600 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
        paddingTop: 140, paddingBottom: isMobile ? 80 : 120,
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 200 : 340, color: 'rgba(255,255,255,0.04)', lineHeight: 1, letterSpacing: '-0.05em' }}>?</span>
        </div>
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 24, fontFamily: FONT }}>
            Sådan virker det
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 36 : 56, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#fff', marginBottom: 20 }}>
            Fra støv<br />til glæde
          </h1>
          <p style={{ fontSize: isMobile ? 15 : 17, color: 'rgba(255,255,255,0.72)', lineHeight: 1.65, maxWidth: 480, margin: '0 auto 0', fontFamily: FONT }}>
            Scroll ned og se rejsen — fra ubrugt legetøj til nyt hjem.
          </p>
        </div>
        <svg viewBox="0 0 1440 80" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill={PAPER} />
        </svg>
      </div>

      {/* ── Scroll-reveal timeline ── */}
      <JourneySection isMobile={isMobile} />

      {/* ── Trade types ── */}
      <div style={{ background: GREEN_DEEP, padding: isMobile ? '64px 20px' : '100px 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 20% 50%, rgba(42,125,79,0.4) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(207,227,216,0.08) 0%, transparent 50%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 820, margin: '0 auto', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 40 : 64 }}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 42, letterSpacing: '-0.04em', color: '#fff', marginBottom: 12 }}>Tre måder at handle på</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, fontFamily: FONT }}>Vælg den model der passer til situationen</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 16 : 24 }}>
            {[
              { label: 'Køb', sub: 'Fastpris', desc: 'Se prisen — køb med det samme. Ingen forhandling, ingen ventetid.' },
              { label: 'Byd', sub: 'Forhandl', desc: 'Send et bud under udbudsprisen og aftal en pris der passer begge parter.' },
              { label: 'Byt', sub: 'Bytehandel', desc: 'Tilbyd et af jeres egne opslag i bytte. Penge er ikke nødvendigt.' },
            ].map((t, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '32px 28px', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 36, color: 'rgba(255,255,255,0.15)', letterSpacing: '-0.05em', marginBottom: 4, lineHeight: 1 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: '#fff', marginBottom: 4, letterSpacing: '-0.03em' }}>{t.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: GREEN_SOFT, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, fontFamily: FONT }}>{t.sub}</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, fontFamily: FONT }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`, padding: isMobile ? '64px 24px' : '100px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 30 : 46, letterSpacing: '-0.04em', color: '#fff', marginBottom: 16, lineHeight: 1.05 }}>Klar til at komme i gang?</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, lineHeight: 1.65, marginBottom: 36, fontFamily: FONT }}>Tilmeld din institution i dag og bliv en del af et bæredygtigt fællesskab.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/signup')} style={{ background: PAPER, color: PRIMARY, border: 'none', borderRadius: 999, padding: '14px 32px', fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>Tilmeld institution</button>
            <button onClick={() => router.push('/opslag')} style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 999, padding: '14px 32px', fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Se markedspladsen →</button>
          </div>
        </div>
      </div>

    </div>
  );
}
