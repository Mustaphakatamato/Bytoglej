'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3, CORAL, BUTTER, SKY, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { db } from '@/lib/supabase';
import { STATS_CONFIG } from '@/lib/stats-config';
import Reveal, { useReducedMotion } from '@/components/Reveal';

/* ────────────────────────────────────────────────────────────
   "Om os": komplet visuelt redesign (Blød Eng-tema)
   Varmt, menneskeligt, missionsdrevet, samme bevægelsessprog
   som "Sådan virker det".
   ──────────────────────────────────────────────────────────── */

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

const values = [
  { emoji: '🔒', title: 'Tillid', desc: 'Kun verificerede institutioner med CVR-nummer får adgang. Hvert opslag er knyttet til en reel institution.' },
  { emoji: '👐', title: 'Gennemsigtighed', desc: 'Åbne beskrivelser, tydelig prisangivelse og ingen skjulte gebyrer. Det I ser, er det I får.' },
  { emoji: '♻️', title: 'Bæredygtighed', desc: 'Vi fremmer genbrug og cirkulær økonomi. Legetøj der bruges, bruges igen.' },
  { emoji: '🤝', title: 'Fællesskab', desc: 'Platformen skaber forbindelser mellem institutioner på tværs af kommuner og landsdele.' },
];

const reasons = [
  { emoji: '💰', accent: BUTTER, title: 'Bedre økonomi', desc: 'Få værdi ud af legetøj der ellers samlede støv, og find det I mangler til en brøkdel af nyprisen. Hver krone bliver i den pædagogiske verden.' },
  { emoji: '🌍', accent: PRIMARY, title: 'Bæredygtighed', desc: 'Genbrug frem for nyindkøb sparer CO₂ og ressourcer. I lever op til kommunens klimamål, helt automatisk og dokumenterbart.' },
  { emoji: '🫶', accent: CORAL, title: 'Fællesskab', desc: 'I bliver del af et netværk af institutioner der hjælper hinanden. Det legetøj jeres børn er vokset fra, glæder andres.' },
];

const institutionTypes = ['Vuggestuer', 'Børnehaver', 'Folkeskoler', "SFO'er", 'Fritidsklubber', 'Private institutioner'];

export default function OmOsPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const w = useWindowWidth();
  const isMobile = w < 768;
  const [liveStats, setLiveStats] = useState(null);

  useEffect(() => {
    if (!STATS_CONFIG.showStats) return;
    Promise.all([
      db.from('institutions_public').select('id', { count: 'exact', head: true }),
      db.from('conversations').select('id', { count: 'exact', head: true }).eq('deal_completed', true),
      db.from('transaction_co2_savings').select('net_saved_kg'),
    ]).then(([{ count: instCount }, { count: dealCount }, { data: co2Data }]) => {
      const totalKg = (co2Data || []).reduce((s, r) => s + (r.net_saved_kg || 0), 0);
      const co2Tons = totalKg >= 1000 ? (totalKg / 1000).toFixed(1) + ' ton' : Math.round(totalKg) + ' kg';
      setLiveStats({ institutions: instCount || 0, deals: dealCount || 0, co2: co2Tons });
    });
  }, []);

  const showStats = STATS_CONFIG.showStats && liveStats &&
    (STATS_CONFIG.thresholds.institutions <= liveStats.institutions || STATS_CONFIG.thresholds.trades <= liveStats.deals);

  const HERO_TOYS = ['🧸', '🧩', '🚲', '🎨', '⚽', '🪁'];

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @keyframes omDrift1 { 0%,100% { transform:translateY(0) rotate(-3deg); } 50% { transform:translateY(-20px) rotate(3deg); } }
        @keyframes omDrift2 { 0%,100% { transform:translateY(0) rotate(2deg); } 50% { transform:translateY(-14px) rotate(-2deg); } }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
        paddingTop: 140, paddingBottom: isMobile ? 96 : 130, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 20% 28%, rgba(255,255,255,0.10) 0%, transparent 45%), radial-gradient(circle at 82% 76%, rgba(207,227,216,0.10) 0%, transparent 45%)' }} />
        {!isMobile && HERO_TOYS.map((t, i) => {
          const pos = [{ top: '24%', left: '9%' }, { top: '66%', left: '13%' }, { top: '28%', left: '87%' },
            { top: '72%', left: '85%' }, { top: '16%', left: '72%' }, { top: '80%', left: '48%' }][i];
          return (
            <span key={i} aria-hidden="true" style={{ position: 'absolute', ...pos, fontSize: 34, opacity: 0.22,
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.2))',
              animation: reduced ? 'none' : `${i % 2 ? 'omDrift2' : 'omDrift1'} ${5 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s` }}>{t}</span>
          );
        })}
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', padding: '0 24px', zIndex: 2 }}>
          <Reveal variant="up">
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 999,
              padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24, fontFamily: FONT }}>
              Om os
            </div>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 36 : 60, letterSpacing: '-0.045em',
              lineHeight: 1.02, color: '#fff', marginBottom: 22 }}>
              Godt legetøj<br />fortjener et nyt hjem
            </h1>
          </Reveal>
          <Reveal variant="up" delay={160}>
            <p style={{ fontSize: isMobile ? 16 : 19, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6,
              maxWidth: 540, margin: '0 auto', fontFamily: FONT }}>
              byt&amp;leg forbinder danske institutioner, så det ene barns kasserede skat
              bliver det næste barns yndlingslegetøj. Bæredygtigt, sikkert og nemt.
            </p>
          </Reveal>
        </div>
        <Wave fill={PAPER} position="bottom" />
      </div>

      {/* ── Problemet → løsningen ── */}
      <div style={{ background: PAPER, padding: isMobile ? '76px 20px 84px' : '120px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 28 : 48, alignItems: 'stretch' }}>
            <Reveal variant={isMobile ? 'up' : 'left'}>
              <div style={{ background: '#fff', borderRadius: 24, padding: isMobile ? '28px 24px' : '40px 36px',
                border: `1px solid ${PAPER3}`, height: '100%', boxShadow: '0 4px 30px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 15, background: `${CORAL}1a`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 18 }}>
                  <span aria-hidden="true">📦</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: CORAL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: FONT }}>Problemet</div>
                <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 26, color: INK, letterSpacing: '-0.03em', margin: '0 0 14px', lineHeight: 1.2 }}>
                  Brugbart legetøj ender på lageret
                </h2>
                <p style={{ fontSize: isMobile ? 14.5 : 15.5, color: INK2, lineHeight: 1.75, fontFamily: FONT, margin: 0 }}>
                  Hver institution har depoter fulde af cykler, puslespil og møbler der ikke længere bruges.
                  Samtidig køber naboinstitutionen det samme nyt. Tingene smides ud eller samler støv,
                  og budgettet og klimaet betaler prisen.
                </p>
              </div>
            </Reveal>
            <Reveal variant={isMobile ? 'up' : 'right'} delay={100}>
              <div style={{ background: GREEN_DEEP, borderRadius: 24, padding: isMobile ? '28px 24px' : '40px 36px',
                height: '100%', position: 'relative', overflow: 'hidden' }}>
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                  backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(42,125,79,0.5) 0%, transparent 55%)' }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 18 }}>
                    <span aria-hidden="true">✨</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GREEN_SOFT, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: FONT }}>Løsningen</div>
                  <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 26, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 14px', lineHeight: 1.2 }}>
                    Én markedsplads, bygget til jer
                  </h2>
                  <p style={{ fontSize: isMobile ? 14.5 : 15.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, fontFamily: FONT, margin: 0 }}>
                    byt&amp;leg gør det nemt at sælge, købe og bytte brugt legetøj og pædagogiske materialer
                    mellem verificerede institutioner. AI hjælper med opslaget, og betalingen foregår trygt på
                    platformen. Selve pakken sender I selv, så I beholder værdien og sparer på klimaet.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* ── Hvorfor det giver mening ── */}
      <div style={{ background: PAPER2, padding: isMobile ? '76px 20px 84px' : '110px 40px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 44 : 64 }}>
            <Reveal variant="up">
              <div style={{ display: 'inline-block', background: `${PRIMARY}1a`, borderRadius: 999, padding: '6px 16px',
                fontSize: 11, fontWeight: 700, color: PRIMARY, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18, fontFamily: FONT }}>
                Hvorfor byt&amp;leg
              </div>
            </Reveal>
            <Reveal variant="up" delay={60}>
              <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 44, letterSpacing: '-0.04em', color: INK, margin: '0 0 14px', lineHeight: 1.05 }}>
                Tre gode grunde
              </h2>
            </Reveal>
            <Reveal variant="up" delay={120}>
              <p style={{ color: INK3, fontSize: isMobile ? 15 : 17, maxWidth: 460, margin: '0 auto', fontFamily: FONT, lineHeight: 1.65 }}>
                Det giver mening for pengepungen, for planeten og for fællesskabet.
              </p>
            </Reveal>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 16 : 22 }}>
            {reasons.map((r, i) => (
              <Reveal key={i} variant="up" delay={i * 110}>
                <div className="card" style={{ background: '#fff', borderRadius: 22, padding: isMobile ? '26px 22px' : '32px 28px',
                  border: `1px solid ${PAPER3}`, borderTop: `3px solid ${r.accent}`, height: '100%', boxShadow: '0 4px 30px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: `${r.accent}1f`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 18 }}>
                    <span aria-hidden="true">{r.emoji}</span>
                  </div>
                  <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: INK, letterSpacing: '-0.03em', margin: '0 0 10px' }}>{r.title}</h3>
                  <p style={{ fontSize: 14, color: INK3, lineHeight: 1.7, fontFamily: FONT, margin: 0 }}>{r.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── Den bæredygtige vinkel (mørk grøn) ── */}
      <div style={{ background: GREEN_DEEP, padding: isMobile ? '92px 20px 100px' : '128px 40px', position: 'relative', overflow: 'hidden' }}>
        <Wave fill={PAPER2} position="top" />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 18% 35%, rgba(42,125,79,0.45) 0%, transparent 55%), radial-gradient(circle at 84% 72%, rgba(207,227,216,0.07) 0%, transparent 50%)' }} />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <Reveal variant="up">
            <div style={{ fontSize: isMobile ? 52 : 64, marginBottom: 20 }}><span aria-hidden="true">🌱</span></div>
          </Reveal>
          <Reveal variant="up" delay={60}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 44, letterSpacing: '-0.04em', color: '#fff', margin: '0 0 18px', lineHeight: 1.1 }}>
              Genbrug er den nemmeste klimahandling
            </h2>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: isMobile ? 15 : 17, maxWidth: 560, margin: '0 auto 12px', fontFamily: FONT, lineHeight: 1.75 }}>
              Når legetøj får et nyt liv i stedet for at blive produceret på ny, spares råstoffer, transport og CO₂.
              byt&amp;leg beregner besparelsen automatisk for hver handel, så I kan dokumentere jeres bidrag.
            </p>
          </Reveal>

          {showStats ? (
            <Reveal variant="up" delay={160}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
                gap: isMobile ? 36 : 0, marginTop: isMobile ? 40 : 56 }}>
                {[
                  { n: liveStats.deals.toLocaleString('da-DK'), label: 'Handler gennemført' },
                  { n: liveStats.institutions.toLocaleString('da-DK'), label: 'Institutioner tilmeldt' },
                  { n: liveStats.co2, label: 'CO₂ sparet' },
                ].map((s, i, arr) => (
                  <div key={i} style={{ borderRight: (!isMobile && i < arr.length - 1) ? '1px solid rgba(255,255,255,0.1)' : 'none', padding: isMobile ? 0 : '0 32px' }}>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 52 : 76, color: '#fff', lineHeight: 1, letterSpacing: '-0.05em', marginBottom: 10 }}>{s.n}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: FONT }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          ) : (
            <Reveal variant="up" delay={160}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: isMobile ? 10 : 14, marginTop: isMobile ? 32 : 44 }}>
                {['Mindre spild', 'Cirkulær økonomi', 'Dokumenterbar CO₂-besparelse'].map((p, i) => (
                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '9px 18px', color: 'rgba(255,255,255,0.8)', fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>
                    <span aria-hidden="true" style={{ color: GREEN_SOFT }}>✓</span>{p}
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>
        <Wave fill={PAPER} position="bottom" />
      </div>

      {/* ── Værdier ── */}
      <div style={{ background: PAPER, padding: isMobile ? '76px 20px 84px' : '116px 40px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 44 : 64 }}>
            <Reveal variant="up">
              <div style={{ display: 'inline-block', background: `${PRIMARY}1a`, borderRadius: 999, padding: '6px 16px',
                fontSize: 11, fontWeight: 700, color: PRIMARY, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18, fontFamily: FONT }}>
                Vores værdier
              </div>
            </Reveal>
            <Reveal variant="up" delay={60}>
              <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 44, letterSpacing: '-0.04em', color: INK, margin: '0 0 14px', lineHeight: 1.05 }}>
                Fire principper
              </h2>
            </Reveal>
            <Reveal variant="up" delay={120}>
              <p style={{ color: INK3, fontSize: isMobile ? 15 : 17, maxWidth: 420, margin: '0 auto', fontFamily: FONT, lineHeight: 1.65 }}>
                De guider alt hvad vi bygger.
              </p>
            </Reveal>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 14 : 18 }}>
            {values.map((v, i) => (
              <Reveal key={i} variant="up" delay={i * 80}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: '#fff', borderRadius: 18,
                  padding: isMobile ? '20px 20px' : '26px 26px', border: `1px solid ${PAPER3}`, height: '100%' }}>
                  <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 14, background: GREEN_TINT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23 }}>
                    <span aria-hidden="true">{v.emoji}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: INK, marginBottom: 7, letterSpacing: '-0.02em' }}>{v.title}</div>
                    <p style={{ fontSize: 13.5, color: INK2, lineHeight: 1.65, margin: 0, fontFamily: FONT }}>{v.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bygget til institutioner ── */}
      <div style={{ background: GREEN_TINT, padding: isMobile ? '76px 20px 84px' : '110px 40px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <Reveal variant="up">
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 40, letterSpacing: '-0.04em', color: INK, margin: '0 0 16px', lineHeight: 1.1 }}>
              Bygget til institutioner
            </h2>
          </Reveal>
          <Reveal variant="up" delay={60}>
            <p style={{ color: INK3, fontSize: isMobile ? 15 : 16, lineHeight: 1.65, marginBottom: isMobile ? 36 : 48, fontFamily: FONT }}>
              Alle typer af danske daginstitutioner er velkomne.
            </p>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: isMobile ? 32 : 44 }}>
              {institutionTypes.map((t, i) => (
                <span key={i} style={{ background: '#fff', color: PRIMARY, borderRadius: 999, border: `1px solid ${GREEN_SOFT}`,
                  padding: isMobile ? '10px 22px' : '12px 28px', fontSize: isMobile ? 14 : 15, fontFamily: FONT, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal variant="up" delay={160}>
            <p style={{ fontSize: 13, color: INK3, fontStyle: 'italic', maxWidth: 460, margin: '0 auto', lineHeight: 1.65, fontFamily: FONT }}>
              Alle institutioner verificeres med CVR-nummer for at sikre troværdighed og sikkerhed for alle parter.
            </p>
          </Reveal>
        </div>
      </div>

      {/* ── Manifest / vision ── */}
      <div style={{ background: PAPER, padding: isMobile ? '80px 20px' : '120px 40px' }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <Reveal variant="up">
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 80 : 120, color: GREEN_SOFT, lineHeight: 0.7, marginBottom: isMobile ? 20 : 28, userSelect: 'none' }} aria-hidden="true">
              &ldquo;
            </div>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <p style={{ fontSize: isMobile ? 19 : 24, color: INK, lineHeight: 1.6, fontFamily: FONT, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 24px' }}>
              Vi arbejder konstant på at forbedre platformen og tilføje funktioner der gør det endnu nemmere
              for institutioner at handle bæredygtigt.
            </p>
          </Reveal>
          <Reveal variant="up" delay={140}>
            <p style={{ fontSize: isMobile ? 15 : 17, color: INK2, lineHeight: 1.75, fontFamily: FONT, margin: 0 }}>
              Vores mål er at blive den foretrukne platform for alle danske institutioner, og at inspirere
              til lignende initiativer i resten af Norden.
            </p>
          </Reveal>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`,
        padding: isMobile ? '80px 24px' : '120px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(207,227,216,0.08) 0%, transparent 50%)' }} />
        <Reveal variant="up" style={{ position: 'relative', maxWidth: 540, margin: '0 auto' }}>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 30 : 46, letterSpacing: '-0.04em', color: '#fff', marginBottom: 16, lineHeight: 1.05 }}>
            Tilmeld din institution i dag
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1.65, marginBottom: 36, fontFamily: FONT }}>
            Bliv en del af et bæredygtigt fællesskab af institutioner der vælger genbrug først.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/signup')} style={{ background: PAPER, color: PRIMARY, border: 'none',
              borderRadius: 999, padding: '15px 34px', fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', letterSpacing: '-0.01em' }}>
              Tilmeld institution
            </button>
            <button onClick={() => router.push('/opslag')} style={{ background: 'transparent', color: 'rgba(255,255,255,0.9)',
              border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 999, padding: '15px 34px', fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', letterSpacing: '-0.01em' }}>
              Se opslag →
            </button>
          </div>
        </Reveal>
      </div>

    </div>
  );
}
