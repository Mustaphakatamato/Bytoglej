'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3, CORAL, BUTTER, SKY, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import Reveal, { useReducedMotion } from '@/components/Reveal';
import { Mark09 } from '@/components/Logo';

/* ────────────────────────────────────────────────────────────
   "Sådan virker det": komplet visuelt redesign (Blød Eng-tema)
   Hvert workflow forklares som et blødt, visuelt trin-for-trin.
   ──────────────────────────────────────────────────────────── */

const PURPLE = '#7C3AED';

/* ── Genbrugelige byggesten ─────────────────────────────────── */

function Wave({ fill, position = 'bottom' }) {
  const isTop = position === 'top';
  return (
    <svg viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: 'absolute', left: 0, right: 0, width: '100%', display: 'block', zIndex: 1,
        [isTop ? 'top' : 'bottom']: -1, transform: isTop ? 'rotate(180deg)' : 'none' }}>
      <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill={fill} />
    </svg>
  );
}

function Eyebrow({ children, accent = PRIMARY, dark = false }) {
  return (
    <div style={{
      display: 'inline-block',
      background: dark ? 'rgba(255,255,255,0.1)' : `${accent}1a`,
      borderRadius: 999, padding: '6px 16px',
      fontSize: 11, fontWeight: 700,
      color: dark ? 'rgba(255,255,255,0.75)' : accent,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      marginBottom: 18, fontFamily: FONT,
    }}>
      {children}
    </div>
  );
}

function SectionHead({ eyebrow, title, sub, accent = PRIMARY, dark = false, isMobile, maxWidth = 460 }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: isMobile ? 44 : 64, padding: '0 4px' }}>
      <Reveal variant="up"><Eyebrow accent={accent} dark={dark}>{eyebrow}</Eyebrow></Reveal>
      <Reveal variant="up" delay={60}>
        <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 44, letterSpacing: '-0.04em',
          color: dark ? '#fff' : INK, margin: '0 0 14px', lineHeight: 1.05 }}>
          {title}
        </h2>
      </Reveal>
      <Reveal variant="up" delay={120}>
        <p style={{ color: dark ? 'rgba(255,255,255,0.6)' : INK3, fontSize: isMobile ? 15 : 17,
          maxWidth, margin: '0 auto', fontFamily: FONT, lineHeight: 1.65 }}>
          {sub}
        </p>
      </Reveal>
    </div>
  );
}

/* Blødt tællende tal, springer til slutværdi ved reduceret bevægelse */
function CountUp({ to, suffix = '', duration = 1600, decimals = 0 }) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (reduced) { setVal(to); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = now => {
          const p = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(to * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration, reduced]);

  return <span ref={ref}>{val.toLocaleString('da-DK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/* ── AI-scanner-mockup: foto scannes → felter udfyldes ──────── */
function AiMockup({ isMobile }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(false);
  const [filled, setFilled] = useState(0);
  const ref = useRef(null);

  const fields = [
    { label: 'Titel', value: 'Trælegetøj, togbane' },
    { label: 'Kategori', value: 'Byggeleg · Motorik' },
    { label: 'Aldersgruppe', value: '3–6 år' },
    { label: 'Stand', value: 'Meget god' },
  ];

  useEffect(() => {
    if (reduced) { setFilled(fields.length); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setActive(true); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!active || reduced) return;
    const timers = fields.map((_, i) => setTimeout(() => setFilled(f => Math.max(f, i + 1)), 700 + i * 360));
    return () => timers.forEach(clearTimeout);
  }, [active, reduced]);

  return (
    <div ref={ref} style={{ display: 'flex', justifyContent: 'center', perspective: 1000 }}>
      <div style={{
        width: isMobile ? 248 : 280, borderRadius: 34, padding: 12,
        background: 'linear-gradient(160deg, #2a3a30, #16221c)',
        boxShadow: '0 30px 70px rgba(19,63,43,0.32), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>
        {/* skærm */}
        <div style={{ background: PAPER, borderRadius: 24, overflow: 'hidden' }}>
          {/* foto-område med scan */}
          <div style={{ position: 'relative', height: isMobile ? 150 : 168,
            background: `radial-gradient(circle at 50% 40%, ${GREEN_SOFT}, ${GREEN_TINT})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <span aria-hidden="true" style={{ fontSize: isMobile ? 66 : 76, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.12))' }}>🚂</span>
            {!reduced && active && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: '45%',
                background: 'linear-gradient(90deg, transparent, rgba(42,125,79,0.32), transparent)',
                animation: 'scanBar 2.1s ease-in-out infinite' }} />
            )}
            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(22,34,28,0.78)', color: '#fff', borderRadius: 999, padding: '5px 11px',
              fontSize: 10.5, fontWeight: 700, fontFamily: FONT, letterSpacing: '0.02em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: BUTTER,
                animation: reduced ? 'none' : 'pulse 1.4s infinite' }} />
              AI scanner…
            </div>
          </div>
          {/* auto-udfyldte felter */}
          <div style={{ padding: '14px 14px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {fields.map((f, i) => {
              const on = i < filled;
              return (
                <div key={i} style={{
                  background: '#fff', border: `1px solid ${on ? GREEN_SOFT : PAPER3}`, borderRadius: 11,
                  padding: '9px 12px',
                  opacity: on ? 1 : 0.45,
                  transform: on ? 'translateY(0)' : 'translateY(6px)',
                  transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: INK3, letterSpacing: '0.08em',
                    textTransform: 'uppercase', fontFamily: FONT, marginBottom: 3 }}>{f.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: on ? INK : INK3, fontFamily: FONT }}>
                      {on ? f.value : '· · ·'}
                    </span>
                    {on && <span aria-hidden="true" style={{ color: PRIMARY, fontSize: 13 }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Leverings-rute: to prikker, pakke der rejser ───────────── */
function DeliveryRoute({ isMobile }) {
  const reduced = useReducedMotion();
  return (
    <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto', padding: isMobile ? '8px 0 4px' : '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Node emoji="🏫" label="Sælger sender" sub="Pakker og afsender selv" accent={PRIMARY} isMobile={isMobile} />
        <div style={{ flex: 1, position: 'relative', height: 60, margin: '0 -4px' }}>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
            <path d="M4,30 C60,4 140,56 196,30" fill="none" stroke={SKY} strokeWidth="2.5"
              strokeDasharray="6 7" strokeLinecap="round" opacity="0.65" />
          </svg>
          <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: 0,
            transform: 'translateY(-50%)', fontSize: 26, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))',
            animation: reduced ? 'none' : 'pkgMove 4.5s ease-in-out infinite' }}>📦</div>
        </div>
        <Node emoji="🧸" label="Køber modtager" sub="Henter eller får leveret" accent={CORAL} isMobile={isMobile} />
      </div>
    </div>
  );
}
function Node({ emoji, label, sub, accent, isMobile }) {
  return (
    <div style={{ textAlign: 'center', flexShrink: 0, width: isMobile ? 92 : 120 }}>
      <div style={{ width: isMobile ? 54 : 64, height: isMobile ? 54 : 64, borderRadius: '50%', margin: '0 auto 10px',
        background: '#fff', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isMobile ? 26 : 30, boxShadow: `0 8px 26px ${accent}40` }}>
        <span aria-hidden="true">{emoji}</span>
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 12.5 : 14, color: INK, letterSpacing: '-0.02em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: isMobile ? 10.5 : 12, color: INK3, lineHeight: 1.35 }}>{sub}</div>
    </div>
  );
}

/* ── Byt-diagram ────────────────────────────────────────────── */
function SwapDiagram({ isMobile }) {
  const card = (emoji, who, accent) => (
    <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 18, padding: isMobile ? '18px 14px' : '22px 18px',
      border: `1px solid ${PAPER3}`, textAlign: 'center', boxShadow: '0 4px 28px rgba(0,0,0,0.06)' }}>
      <div style={{ width: 50, height: 50, borderRadius: 14, margin: '0 auto 10px', background: `${accent}14`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}><span aria-hidden="true">{emoji}</span></div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: INK, marginBottom: 4 }}>{who}</div>
      <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, lineHeight: 1.5 }}>sender sin pakke</div>
    </div>
  );
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'stretch',
      flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 0 }}>
      {card('🧸', 'Institution A', PURPLE)}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '2px 0' : '0 14px', gap: 8 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 26px ${PURPLE}3a`, border: `1px solid ${PAPER3}` }}>
          <Mark09 size={38} />
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: '0.02em' }}>holder balancen</div>
      </div>
      {card('🚲', 'Institution B', PURPLE)}
    </div>
  );
}

/* ── Data ───────────────────────────────────────────────────── */

const CREATE_STEPS = [
  { n: '1', emoji: '📸', title: 'Tag ét billede', desc: 'Fotografér legetøjet med telefonen. Det er alt du skal gøre for at starte.' },
  { n: '2', emoji: '✨', title: 'AI udfylder resten', desc: 'På få sekunder foreslår vores AI titel, kategori, aldersgruppe, stand og beskrivelse.' },
  { n: '3', emoji: '🏷️', title: 'Vælg køb, byd eller byt', desc: 'Sæt en fast pris, åbn for bud, eller tilbyd det som bytte. Du bestemmer.' },
  { n: '4', emoji: '🚀', title: 'Publicér', desc: 'Opslaget er straks synligt for alle verificerede institutioner i hele landet.' },
];

const TRADE_TYPES = [
  { emoji: '🏷️', label: 'Køb', sub: 'Fastpris', color: PRIMARY,
    desc: 'Se prisen og køb med det samme. Læg i kurv og betal trygt, så er handlen på plads.',
    points: ['Ingen forhandling', 'Køberbeskyttelse på alle køb'] },
  { emoji: '💰', label: 'Byd', sub: 'Forhandl', color: BUTTER,
    desc: 'Send et bud under udbudsprisen og forhandl via chat med modbud. Når begge siger ja, reserveres varen til dig i 24 timer.',
    points: ['Modbud frem og tilbage', 'Accepteret bud reserveres i 24 t'] },
  { emoji: '🔄', label: 'Byt', sub: 'Bytehandel', color: PURPLE,
    desc: 'Tilbyd et af jeres egne opslag som betaling. Find noget I begge mangler, helt uden penge imellem jer.',
    points: ['Bundt for bundt', 'Begge sender en pakke, trygt og beskyttet'] },
];

const AI_FEATURES = [
  { emoji: '📸', title: 'Billedscanning', desc: 'Tag et foto og lad AI udfylde titel, beskrivelse, kategori, aldersgruppe og stand på sekunder.' },
  { emoji: '✍️', title: 'Søges-assistent', desc: 'Skriv frit hvad I mangler, fx "cykler til 5-årige", og AI laver et færdigt søges-opslag.' },
  { emoji: '🔍', title: 'Intelligent søgning', desc: 'Skriv naturligt. AI forstår kategorier og aldersgrupper og finder de mest relevante opslag.' },
  { emoji: '📝', title: 'Beskrivelsesforbedring', desc: 'AI kan udvide og forfine en kort beskrivelse, så opslaget tiltrækker flere henvendelser.' },
  { emoji: '🚫', title: 'Automatisk billedtjek', desc: 'AI opdager automatisk hvis der er mennesker eller børn på et billede, og afviser opslaget. Sådan holder vi platformen sikker og privatlivet beskyttet.' },
];

/* ── Side ───────────────────────────────────────────────────── */

export default function HowItWorksPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const w = useWindowWidth();
  const isMobile = w < 768;

  const HERO_TOYS = ['🧸', '🚲', '🧩', '🎨', '🚂', '⚽'];

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @keyframes pkgMove { 0%,100% { left:0; transform:translateY(-50%) rotate(-4deg); } 50% { left:calc(100% - 26px); transform:translateY(-90%) rotate(4deg); } }
        @keyframes drift1 { 0%,100% { transform:translateY(0) rotate(-3deg); } 50% { transform:translateY(-22px) rotate(3deg); } }
        @keyframes drift2 { 0%,100% { transform:translateY(0) rotate(2deg); } 50% { transform:translateY(-16px) rotate(-2deg); } }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
        paddingTop: 140, paddingBottom: isMobile ? 96 : 130, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* bløde lys-blobs */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 18% 30%, rgba(255,255,255,0.10) 0%, transparent 45%), radial-gradient(circle at 85% 75%, rgba(207,227,216,0.10) 0%, transparent 45%)' }} />
        {/* svævende legetøj */}
        {!isMobile && HERO_TOYS.map((t, i) => {
          const pos = [{ top: '22%', left: '8%' }, { top: '64%', left: '14%' }, { top: '30%', left: '88%' },
            { top: '70%', left: '84%' }, { top: '16%', left: '70%' }, { top: '78%', left: '50%' }][i];
          return (
            <span key={i} aria-hidden="true" style={{ position: 'absolute', ...pos, fontSize: 34, opacity: 0.22,
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.2))',
              animation: reduced ? 'none' : `${i % 2 ? 'drift2' : 'drift1'} ${5 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s` }}>{t}</span>
          );
        })}
        <div style={{ position: 'relative', maxWidth: 660, margin: '0 auto', padding: '0 24px', zIndex: 2 }}>
          <Reveal variant="up">
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 999,
              padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24, fontFamily: FONT }}>
              Sådan virker det
            </div>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 40 : 64, letterSpacing: '-0.045em',
              lineHeight: 1.0, color: '#fff', marginBottom: 22 }}>
              Fra hylde<br />til hjerte
            </h1>
          </Reveal>
          <Reveal variant="up" delay={160}>
            <p style={{ fontSize: isMobile ? 16 : 19, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6,
              maxWidth: 500, margin: '0 auto', fontFamily: FONT }}>
              Opret, køb, byd eller byt på få minutter. Vi guider dig gennem hvert skridt,
              fra det første foto til pakken er fremme.
            </p>
          </Reveal>
        </div>
        <Wave fill={PAPER} position="bottom" />
      </div>

      {/* ── 1. Opret et opslag ── */}
      <div style={{ background: PAPER, padding: isMobile ? '72px 20px 80px' : '110px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionHead isMobile={isMobile} eyebrow="Kom i gang" accent={PRIMARY}
            title="Opret et opslag på 2 minutter"
            sub="Et enkelt foto er nok. AI klarer det kedelige, så du kan koncentrere dig om det vigtige." />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.05fr',
            gap: isMobile ? 40 : 56, alignItems: 'center' }}>
            <Reveal variant={isMobile ? 'up' : 'left'}><AiMockup isMobile={isMobile} /></Reveal>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>
              {CREATE_STEPS.map((s, i) => (
                <Reveal key={i} variant={isMobile ? 'up' : 'right'} delay={i * 90}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 13, background: GREEN_TINT,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>
                      <span aria-hidden="true">{s.emoji}</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 12, color: PRIMARY }}>{s.n}</span>
                        <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 16 : 18, color: INK,
                          letterSpacing: '-0.02em', margin: 0 }}>{s.title}</h3>
                      </div>
                      <p style={{ fontSize: isMobile ? 13.5 : 14.5, color: INK3, lineHeight: 1.65, fontFamily: FONT, margin: 0 }}>{s.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Tre måder at handle på ── */}
      <div style={{ background: PAPER2, padding: isMobile ? '72px 20px 80px' : '110px 40px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <SectionHead isMobile={isMobile} eyebrow="Handelstyper" accent={PRIMARY}
            title="Tre måder at handle på"
            sub="Vælg den model der passer til jer og situationen. Det hele sker trygt inde på platformen." />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 16 : 22 }}>
            {TRADE_TYPES.map((t, i) => (
              <Reveal key={i} variant="up" delay={i * 110}>
                <div className="card" style={{ background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 22,
                  padding: isMobile ? '26px 22px' : '30px 26px', borderTop: `3px solid ${t.color}`, height: '100%',
                  boxShadow: '0 4px 30px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 15, background: `${t.color}1a`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>
                    <span aria-hidden="true">{t.emoji}</span>
                  </div>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 21, color: INK, marginBottom: 3, letterSpacing: '-0.03em' }}>{t.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontFamily: FONT }}>{t.sub}</div>
                  <p style={{ fontSize: 14, color: INK3, lineHeight: 1.65, fontFamily: FONT, margin: '0 0 16px' }}>{t.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${PAPER2}`, paddingTop: 14 }}>
                    {t.points.map((p, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                        <span aria-hidden="true" style={{ color: t.color, fontSize: 13, lineHeight: 1.5, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 12.5, color: INK2, fontFamily: FONT, fontWeight: 600, lineHeight: 1.5 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. Byt i dybden ── */}
      <div style={{ background: GREEN_TINT, padding: isMobile ? '72px 20px 80px' : '110px 40px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <SectionHead isMobile={isMobile} eyebrow="Bytehandel" accent={PURPLE}
            title="Byt uden penge imellem jer"
            sub="To institutioner bytter bundt for bundt. Begge sender hver sin pakke, og byt&leg holder hånden under handlen, så ingen kommer i klemme." />
          <Reveal variant="scale"><SwapDiagram isMobile={isMobile} /></Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 12 : 16, marginTop: isMobile ? 32 : 44 }}>
            {[
              { emoji: '🤝', t: 'I bliver enige', d: 'Find et bytte I begge er glade for, og godkend handlen i chatten.' },
              { emoji: '📦', t: 'Begge sender', d: 'I sender hver jeres pakke samtidig, så ingen venter på den anden.' },
              { emoji: '🛡️', t: 'Tryg byttehandel', d: 'En byttebeskyttelse på 10 kr pr. part sikrer en tryg handel for begge.' },
            ].map((s, i) => (
              <Reveal key={i} variant="up" delay={i * 90}>
                <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px', border: `1px solid ${GREEN_SOFT}`, height: '100%' }}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}><span aria-hidden="true">{s.emoji}</span></div>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: INK, marginBottom: 6, letterSpacing: '-0.02em' }}>{s.t}</div>
                  <p style={{ fontSize: 13, color: INK3, lineHeight: 1.6, fontFamily: FONT, margin: 0 }}>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. Levering ── */}
      <div style={{ background: PAPER, padding: isMobile ? '72px 20px 80px' : '110px 40px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <SectionHead isMobile={isMobile} eyebrow="Levering" accent={SKY}
            title="Send pakken som I plejer"
            sub="Institutionerne sender selv pakkerne til hinanden. Pakkerne kan sendes med PostNord, DAO eller GLS. Bor I tæt på hinanden, kan I også aftale at hente direkte." maxWidth={520} />
          <Reveal variant="up"><DeliveryRoute isMobile={isMobile} /></Reveal>
        </div>
      </div>

      {/* ── 5. Tryg betaling & beskyttelse (mørk trust-sektion) ── */}
      <div style={{ background: GREEN_DEEP, padding: isMobile ? '88px 20px 96px' : '128px 40px', position: 'relative', overflow: 'hidden' }}>
        <Wave fill={PAPER} position="top" />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 20% 40%, rgba(42,125,79,0.45) 0%, transparent 55%), radial-gradient(circle at 82% 70%, rgba(207,227,216,0.07) 0%, transparent 50%)' }} />
        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <SectionHead isMobile={isMobile} dark eyebrow="Tryghed"
            title="Beskyttet hele vejen"
            sub="Pengene frigives først når handlen går som den skal. Det gælder både køb og bytte." />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 16 : 22 }}>
            {[
              { emoji: '🛡️', t: 'Køberbeskyttelse', tag: '5% + 5 kr', d: 'På alle køb og bud. Ankommer varen ikke, eller passer den slet ikke med opslaget, får du pengene tilbage.' },
              { emoji: '🔄', t: 'Byttebeskyttelse', tag: '10 kr pr. part', d: 'Ved bytte er begge parter dækket. byt&leg holder handlen i balance, til begge pakker er sendt.' },
            ].map((c, i) => (
              <Reveal key={i} variant="up" delay={i * 110}>
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 22, padding: isMobile ? '26px 24px' : '32px 30px', backdropFilter: 'blur(10px)', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      <span aria-hidden="true">{c.emoji}</span>
                    </div>
                    <div>
                      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.02em' }}>{c.t}</div>
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: GREEN_SOFT, marginTop: 2 }}>{c.tag}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, fontFamily: FONT, margin: 0 }}>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal variant="up" delay={120}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: isMobile ? 10 : 16,
              marginTop: isMobile ? 28 : 40 }}>
              {['Kun verificerede institutioner', 'Sikker betaling med Stripe', 'Ingen skjulte gebyrer'].map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.7)',
                  fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
                  <span aria-hidden="true" style={{ color: GREEN_SOFT }}>✓</span>{p}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
        <Wave fill={GREEN_TINT} position="bottom" />
      </div>

      {/* ── 6. CO₂-besparelse ── */}
      <div style={{ background: GREEN_TINT, padding: isMobile ? '80px 20px' : '120px 40px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <Reveal variant="up"><Eyebrow accent={PRIMARY}>Bæredygtighed</Eyebrow></Reveal>
          <Reveal variant="up" delay={60}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 44, letterSpacing: '-0.04em',
              color: INK, margin: '0 0 14px', lineHeight: 1.05 }}>
              Se din klimagevinst<br />ved hver handel
            </h2>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <p style={{ color: INK3, fontSize: isMobile ? 15 : 17, maxWidth: 480, margin: '0 auto 40px', fontFamily: FONT, lineHeight: 1.65 }}>
              Hver gang legetøj genbruges i stedet for at blive købt nyt, sparer I CO₂.
              Platformen beregner det automatisk ud fra produkttype og afstand.
            </p>
          </Reveal>
          <Reveal variant="scale" delay={120}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? 16 : 28,
              background: '#fff', borderRadius: 24, padding: isMobile ? '22px 26px' : '28px 44px',
              boxShadow: '0 18px 50px rgba(19,63,43,0.12)', border: `1px solid ${GREEN_SOFT}` }}>
              <div style={{ fontSize: isMobile ? 44 : 58 }}><span aria-hidden="true">🌱</span></div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 40 : 58, color: PRIMARY,
                  letterSpacing: '-0.04em', lineHeight: 1 }}>
                  <CountUp to={12.4} decimals={1} /> kg
                </div>
                <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, fontWeight: 600, marginTop: 4 }}>
                  CO₂ sparet, typisk pr. handel*
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal variant="up" delay={200}>
            <p style={{ color: INK3, fontSize: 12, marginTop: 20, fontFamily: FONT, fontStyle: 'italic' }}>
              *Illustrativt eksempel. Din faktiske besparelse beregnes for hver enkelt handel.
            </p>
          </Reveal>
        </div>
      </div>

      {/* ── 7. AI gør det nemt (mørk) ── */}
      <div style={{ background: GREEN_DEEP, padding: isMobile ? '88px 20px 96px' : '120px 40px', position: 'relative', overflow: 'hidden' }}>
        <Wave fill={GREEN_TINT} position="top" />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 15% 60%, rgba(42,125,79,0.5) 0%, transparent 55%), radial-gradient(circle at 85% 20%, rgba(207,227,216,0.07) 0%, transparent 50%)' }} />
        <div style={{ maxWidth: 920, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <SectionHead isMobile={isMobile} dark eyebrow="Kunstig intelligens"
            title="AI gør det nemt"
            sub="Vi bruger AI til at spare jer tid, fra billede til færdigt opslag på sekunder." />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: isMobile ? 16 : 20 }}>
            {AI_FEATURES.map((f, i) => (
              <Reveal key={i} variant="up" delay={i * 90}
                style={{ gridColumn: (!isMobile && i === AI_FEATURES.length - 1 && AI_FEATURES.length % 2 === 1) ? '1 / -1' : undefined }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '26px 26px', backdropFilter: 'blur(10px)', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      <span aria-hidden="true">{f.emoji}</span>
                    </div>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.02em' }}>{f.title}</div>
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, fontFamily: FONT, margin: 0 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`,
        padding: isMobile ? '80px 24px' : '120px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(207,227,216,0.08) 0%, transparent 50%)' }} />
        <Reveal variant="up" style={{ position: 'relative', maxWidth: 540, margin: '0 auto' }}>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 30 : 46, letterSpacing: '-0.04em',
            color: '#fff', marginBottom: 16, lineHeight: 1.05 }}>Klar til at komme i gang?</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1.65, marginBottom: 36, fontFamily: FONT }}>
            Tilmeld din institution i dag. Det tager under 5 minutter og er gratis.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/signup')} style={{ background: PAPER, color: PRIMARY, border: 'none',
              borderRadius: 999, padding: '15px 34px', fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>
              Tilmeld institution
            </button>
            <button onClick={() => router.push('/opslag')} style={{ background: 'transparent', color: 'rgba(255,255,255,0.9)',
              border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 999, padding: '15px 34px', fontSize: 15,
              fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>
              Se markedspladsen →
            </button>
          </div>
        </Reveal>
      </div>

    </div>
  );
}
