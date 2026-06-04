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

// ── Bidirectional scroll-scrubbed journey ─────────────────────────────────────
function JourneySection({ isMobile }) {
  const sectionRef = useRef(null);
  const stepRefs = useRef([]);
  const emojiRefs = useRef([]);
  const numRefs = useRef([]);
  const bgRef = useRef(null);
  const progressBarRef = useRef(null);
  const dotRefs = useRef([]);
  const labelRef = useRef(null);

  useEffect(() => {
    let raf;

    const smooth = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const update = () => {
      if (!sectionRef.current) return;
      const { top, height } = sectionRef.current.getBoundingClientRect();
      const scrolled = -top;
      const total = height - window.innerHeight;
      const progress = Math.max(0, Math.min(0.9999, scrolled / total));

      if (progressBarRef.current) {
        progressBarRef.current.style.height = `${progress * 100}%`;
      }

      const n = STEPS.length;
      const rawActive = progress * n;
      const baseIdx = Math.min(n - 1, Math.floor(rawActive));

      if (isMobile) {
        // ── Mobile: one step at a time, scroll-zone based ──
        // Each step owns 1/n of the scroll range; only that step is shown.
        // Within its zone the step slides up slightly for a parallax feel.
        const zoneLocal = rawActive - baseIdx; // 0→1 within active zone

        STEPS.forEach((step, i) => {
          const el = stepRefs.current[i];
          if (!el) return;

          if (i === baseIdx) {
            // Slide in from below when entering (0→0.25), rest, then slide up when exiting (0.75→1)
            // Last step never exits
            let ty = 0;
            if (zoneLocal < 0.25) {
              ty = 36 * (1 - zoneLocal / 0.25);
            } else if (zoneLocal > 0.75 && i < n - 1) {
              ty = -36 * ((zoneLocal - 0.75) / 0.25);
            }
            el.style.opacity = '1';
            el.style.transform = `translateY(${ty}px)`;
            el.style.pointerEvents = 'auto';
          } else {
            el.style.opacity = '0';
            el.style.transform = 'translateY(0px)';
            el.style.pointerEvents = 'none';
          }

          // Dot indicators
          const dot = dotRefs.current[i];
          if (dot) {
            dot.style.background = i === baseIdx ? STEPS[baseIdx].accent : '#ccc';
            dot.style.width = i === baseIdx ? '20px' : '7px';
          }
        });

        // Step label
        if (labelRef.current) {
          labelRef.current.textContent = `${STEPS[baseIdx].label} / 04`;
          labelRef.current.style.color = STEPS[baseIdx].accent;
        }

        if (bgRef.current) bgRef.current.style.background = STEPS[baseIdx].bg;

      } else {
        // ── Desktop: crossfade between steps ──
        const local = rawActive - Math.floor(rawActive);
        const xStart = 0.6;

        STEPS.forEach((step, i) => {
          let opacity, ty;

          if (i === baseIdx) {
            if (i === n - 1) { opacity = 1; ty = 0; }
            else {
              const t = smooth(Math.max(0, (local - xStart) / (1 - xStart)));
              opacity = 1 - t;
              ty = -32 * t;
            }
          } else if (i === baseIdx + 1) {
            const t = smooth(Math.max(0, (local - xStart) / (1 - xStart)));
            opacity = t;
            ty = 32 * (1 - t);
          } else {
            opacity = 0;
            ty = i < baseIdx ? -32 : 32;
          }

          const el = stepRefs.current[i];
          if (el) {
            el.style.opacity = String(Math.max(0, opacity));
            el.style.transform = `translateY(${ty}px)`;
            el.style.pointerEvents = opacity > 0.4 ? 'auto' : 'none';
          }

          const emojiEl = emojiRefs.current[i];
          if (emojiEl) {
            const scale = 0.9 + 0.1 * Math.max(0, opacity);
            emojiEl.style.opacity = String(Math.max(0, opacity));
            emojiEl.style.transform = `scale(${scale}) translateY(${ty * 0.5}px)`;
          }

          const numEl = numRefs.current[i];
          if (numEl) {
            numEl.style.opacity = String(Math.max(0, opacity) * 0.12);
          }
        });

        if (bgRef.current) bgRef.current.style.background = STEPS[baseIdx].bg;
      }
    };

    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [isMobile]);

  const sectionHeight = isMobile ? `${STEPS.length * 80}vh` : `${STEPS.length * 100 + 30}vh`;

  return (
    <div ref={sectionRef} style={{ height: sectionHeight, position: 'relative' }}>
      {/* Sticky viewport */}
      <div style={{
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        display: 'flex', alignItems: 'center',
      }}>
        {/* Bg color wash */}
        <div ref={bgRef} style={{
          position: 'absolute', inset: 0,
          background: STEPS[0].bg,
          opacity: 0.22,
          transition: 'background 0.5s ease',
        }} />

        {/* Progress bar (left edge) */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: PAPER3, zIndex: 10 }}>
          <div ref={progressBarRef} style={{ width: '100%', height: '0%', background: PRIMARY, borderRadius: 2, transition: 'height 0.05s linear' }} />
        </div>

        {isMobile ? (
          /* ── Mobile layout ── */
          <div style={{ width: '100%', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>

            {/* Header row: label + step counter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 0' }}>
              <div style={{ display: 'inline-block', background: GREEN_TINT, borderRadius: 999, padding: '5px 14px', fontSize: 11, fontWeight: 700, color: PRIMARY, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: FONT }}>
                Sådan virker det
              </div>
              <div ref={labelRef} style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: STEPS[0].accent, letterSpacing: '0.04em' }}>
                01 / 04
              </div>
            </div>

            {/* Steps — all layered, only active one has opacity:1 */}
            <div style={{ position: 'relative', flex: 1 }}>
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  ref={el => stepRefs.current[i] = el}
                  style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '12px 28px 0',
                    opacity: i === 0 ? 1 : 0,
                    willChange: 'transform, opacity',
                  }}
                >
                  {/* Step number watermark */}
                  <div style={{
                    position: 'absolute', top: '4%', right: '6%',
                    fontFamily: FONT, fontWeight: 800, fontSize: 88,
                    color: step.accent, lineHeight: 1, userSelect: 'none',
                    opacity: 0.1, pointerEvents: 'none',
                  }}>
                    {step.label}
                  </div>

                  {/* Emoji box */}
                  <div style={{
                    width: 120, height: 120, borderRadius: 36,
                    background: step.bg, border: `2.5px solid ${step.accent}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 56, marginBottom: 24,
                    boxShadow: `0 16px 40px ${step.accent}33`,
                    flexShrink: 0,
                  }}>
                    {step.emoji}
                  </div>

                  {/* Text */}
                  <div style={{ textAlign: 'center', maxWidth: 320 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: INK, letterSpacing: '-0.03em', marginBottom: 10, lineHeight: 1.15 }}>{step.title}</div>
                    <div style={{ fontSize: 14, color: INK3, lineHeight: 1.65, fontFamily: FONT, marginBottom: 18 }}>{step.desc}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start', maxWidth: 260, margin: '0 auto' }}>
                      {step.points.map((p, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: step.accent, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: INK2, fontFamily: FONT, fontWeight: 600 }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dot indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 0 24px' }}>
              {STEPS.map((s, i) => (
                <div
                  key={i}
                  ref={el => dotRefs.current[i] = el}
                  style={{
                    width: i === 0 ? '20px' : '7px', height: 7, borderRadius: 4,
                    background: i === 0 ? STEPS[0].accent : '#ccc',
                    transition: 'width 0.2s, background 0.2s',
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ── Desktop layout ── */
          <div style={{
            width: '100%', maxWidth: 1160, margin: '0 auto', padding: '0 64px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80,
            alignItems: 'center', position: 'relative', zIndex: 1,
          }}>
            {/* LEFT: visual panels — all stacked, animated */}
            <div style={{ position: 'relative', height: 480 }}>
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  ref={el => emojiRefs.current[i] = el}
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: 48, background: step.bg,
                    border: `2.5px solid ${step.accent}33`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 16,
                    boxShadow: `0 24px 80px ${step.accent}33`,
                    opacity: i === 0 ? 1 : 0,
                  }}
                >
                  <div style={{ fontSize: 110, lineHeight: 1 }}>{step.emoji}</div>
                  {/* Watermark number */}
                  <div ref={el => numRefs.current[i] = el} style={{
                    position: 'absolute', bottom: 20, right: 28,
                    fontFamily: FONT, fontWeight: 800, fontSize: 120,
                    color: step.accent, opacity: 0.12, lineHeight: 1,
                    userSelect: 'none', letterSpacing: '-0.06em',
                  }}>
                    {step.label}
                  </div>
                  {/* Progress dots inside panel */}
                  <div style={{ display: 'flex', gap: 8, position: 'absolute', bottom: 24, left: 28 }}>
                    {STEPS.map((s, j) => (
                      <div key={j} style={{
                        width: j === i ? 24 : 6, height: 6, borderRadius: 3,
                        background: j === i ? step.accent : step.accent + '44',
                        transition: 'width 0.3s',
                      }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT: text — all stacked */}
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PRIMARY, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Sådan virker det</div>

              {STEPS.map((step, i) => (
                <div
                  key={i}
                  ref={el => stepRefs.current[i] = el}
                  style={{
                    position: i === 0 ? 'relative' : 'absolute',
                    top: i === 0 ? undefined : 32,
                    left: 0, right: 0,
                    opacity: i === 0 ? 1 : 0,
                  }}
                >
                  <h2 style={{
                    fontFamily: FONT, fontWeight: 800, fontSize: 40,
                    color: INK, letterSpacing: '-0.04em', lineHeight: 1.05, margin: '0 0 16px',
                  }}>{step.title}</h2>
                  <p style={{ fontSize: 16, color: INK2, lineHeight: 1.7, marginBottom: 28, fontFamily: FONT, maxWidth: 420 }}>{step.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {step.points.map((p, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: step.accent, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: INK2, fontFamily: FONT, fontWeight: 600 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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

      {/* ── Scroll-scrubbed journey ── */}
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
