'use client';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

const values = [
  { title: 'Tillid',            desc: 'Kun verificerede institutioner med CVR-nummer får adgang. Hvert opslag er knyttet til en reel institution.' },
  { title: 'Gennemsigtighed',   desc: 'Åbne beskrivelser, tydelig prisangivelse og ingen skjulte gebyrer. Det I ser, er det I får.' },
  { title: 'Bæredygtighed',     desc: 'Vi fremmer genbrug og cirkulær økonomi — legetøj der bruges, bruges igen.' },
  { title: 'Fællesskab',        desc: 'Platformen skaber forbindelser mellem institutioner på tværs af kommuner og landsdele.' },
];

const institutionTypes = [
  'Vuggestuer', 'Børnehaver', 'Folkeskoler', "SFO'er", 'Fritidsklubber', 'Private institutioner',
];

const stats = [
  { n: '2.847',  label: 'Handler gennemført' },
  { n: '156',    label: 'Institutioner tilmeldt' },
  { n: '12,5 ton', label: 'CO₂ sparet' },
];

export default function OmOsPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden' }} className="page-enter">

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
        paddingTop: 140,
        paddingBottom: isMobile ? 80 : 120,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* faint watermark */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', userSelect: 'none',
        }}>
          <span style={{
            fontFamily: "'Sora',sans-serif", fontWeight: 800,
            fontSize: isMobile ? 160 : 300,
            color: 'rgba(255,255,255,0.04)',
            lineHeight: 1, letterSpacing: '-0.05em',
          }}>
            byt&amp;leg
          </span>
        </div>

        <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 999, padding: '6px 18px',
            fontSize: 12, fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 24,
          }}>
            Om os
          </div>
          <h1 style={{
            fontFamily: "'Sora',sans-serif", fontWeight: 800,
            fontSize: isMobile ? 34 : 58,
            letterSpacing: '-0.04em', lineHeight: 1.0,
            color: '#fff', marginBottom: 24,
          }}>
            Vi hjælper danske institutioner<br />med at genbruge legetøj
          </h1>
          <p style={{
            fontSize: isMobile ? 15 : 18,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.65, maxWidth: 500, margin: '0 auto',
          }}>
            byt&amp;leg er en platform bygget specifikt til institutioner — bæredygtigt, sikkert og nemt.
          </p>
        </div>

        {/* wave bottom */}
        <svg viewBox="0 0 1440 80" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill={PAPER} />
        </svg>
      </div>

      {/* ── Mission / Values ── */}
      <div style={{ background: PAPER, padding: isMobile ? '72px 20px' : '112px 40px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 48 : 72 }}>
            <h2 style={{
              fontFamily: "'Sora',sans-serif", fontWeight: 800,
              fontSize: isMobile ? 26 : 40,
              letterSpacing: '-0.04em', color: INK, marginBottom: 12,
            }}>
              Vores værdier
            </h2>
            <p style={{ color: INK3, fontSize: 15, maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
              Fire principper der guider alt hvad vi gør.
            </p>
          </div>

          {/* 2-col grid (desktop), 1-col (mobile) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 0,
          }}>
            {values.map((v, i) => {
              const isLastRow = i >= values.length - (isMobile ? 1 : 2);
              const isLeftCol = i % 2 === 0;
              return (
                <div key={i} style={{
                  padding: isMobile ? '32px 0' : '40px 40px 40px 0',
                  borderBottom: isLastRow ? 'none' : `1px solid ${GREEN_SOFT}`,
                  borderRight: (!isMobile && isLeftCol) ? `1px solid ${GREEN_SOFT}` : 'none',
                  paddingLeft: (!isMobile && !isLeftCol) ? 40 : 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: PRIMARY,
                      flexShrink: 0,
                      marginTop: 7,
                    }} />
                    <div>
                      <div style={{
                        fontFamily: "'Sora',sans-serif", fontWeight: 800,
                        fontSize: 18, color: INK,
                        marginBottom: 8, letterSpacing: '-0.02em',
                      }}>
                        {v.title}
                      </div>
                      <p style={{ fontSize: 14, color: INK2, lineHeight: 1.7, margin: 0 }}>
                        {v.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Institution types ── */}
      <div style={{ background: GREEN_TINT, padding: isMobile ? '72px 20px' : '100px 40px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: "'Sora',sans-serif", fontWeight: 800,
            fontSize: isMobile ? 26 : 40,
            letterSpacing: '-0.04em', color: INK,
            marginBottom: 16,
          }}>
            Bygget til institutioner
          </h2>
          <p style={{ color: INK3, fontSize: 15, lineHeight: 1.65, marginBottom: isMobile ? 40 : 56 }}>
            Alle typer af danske daginstitutioner er velkomne.
          </p>

          {/* pills */}
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            gap: 12, justifyContent: 'center',
            marginBottom: isMobile ? 36 : 48,
          }}>
            {institutionTypes.map((t, i) => (
              <span key={i} style={{
                background: GREEN_SOFT,
                color: PRIMARY,
                borderRadius: 999,
                padding: isMobile ? '10px 22px' : '12px 28px',
                fontSize: isMobile ? 14 : 15,
                fontFamily: "'Sora',sans-serif",
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}>
                {t}
              </span>
            ))}
          </div>

          <p style={{
            fontSize: 13, color: INK3, fontStyle: 'italic',
            maxWidth: 440, margin: '0 auto', lineHeight: 1.65,
          }}>
            Alle institutioner verificeres med CVR-nummer for at sikre troværdighed og sikkerhed for alle parter.
          </p>
        </div>
      </div>

      {/* ── Impact stats ── */}
      <div style={{
        background: GREEN_DEEP,
        padding: isMobile ? '72px 20px' : '112px 40px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* subtle radial glow */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(42,125,79,0.35) 0%, transparent 55%), radial-gradient(circle at 80% 30%, rgba(207,227,216,0.06) 0%, transparent 50%)`,
          pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: 900, margin: '0 auto', position: 'relative',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
          gap: isMobile ? 48 : 0,
          textAlign: 'center',
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              borderRight: (!isMobile && i < stats.length - 1) ? '1px solid rgba(255,255,255,0.08)' : 'none',
              padding: isMobile ? 0 : '0 48px',
            }}>
              <div style={{
                fontFamily: "'Sora',sans-serif", fontWeight: 800,
                fontSize: isMobile ? 64 : 96,
                color: '#fff',
                lineHeight: 1,
                letterSpacing: '-0.05em',
                marginBottom: 12,
              }}>
                {s.n}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontFamily: "'Sora',sans-serif",
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Manifesto / Vision ── */}
      <div style={{ background: PAPER, padding: isMobile ? '80px 20px' : '120px 40px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* large opening quote mark */}
          <div style={{
            fontFamily: "'Sora',sans-serif", fontWeight: 800,
            fontSize: isMobile ? 80 : 120,
            color: GREEN_SOFT,
            lineHeight: 0.7,
            marginBottom: isMobile ? 24 : 32,
            userSelect: 'none',
          }}>
            &ldquo;
          </div>

          <p style={{
            fontSize: isMobile ? 18 : 22,
            color: INK,
            lineHeight: 1.7,
            fontFamily: "'Sora',sans-serif",
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: 24,
          }}>
            Vi arbejder konstant p&aring; at forbedre platformen og tilf&oslash;je nye funktioner der g&oslash;r det endnu nemmere for institutioner at handle b&aelig;redygtigt.
          </p>

          <p style={{
            fontSize: isMobile ? 15 : 17,
            color: INK2,
            lineHeight: 1.75,
            fontFamily: "'Sora',sans-serif",
            marginBottom: 0,
          }}>
            Vores m&aring;l er at blive den foretrukne platform for alle danske institutioner &mdash; og at inspirere til lignende initiativer i resten af Norden.
          </p>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`,
        padding: isMobile ? '72px 24px' : '112px 40px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle at 70% 30%, rgba(207,227,216,0.07) 0%, transparent 50%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Sora',sans-serif", fontWeight: 800,
            fontSize: isMobile ? 30 : 46,
            letterSpacing: '-0.04em', color: '#fff',
            marginBottom: 16, lineHeight: 1.05,
          }}>
            Tilmeld din institution i dag
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.65)', fontSize: 16,
            lineHeight: 1.65, marginBottom: 36,
          }}>
            Bliv en del af et b&aelig;redygtigt f&aelig;llesskab af institutioner der v&aelig;lger genbrug f&oslash;rst.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/signup')}
              style={{
                background: PAPER, color: PRIMARY,
                border: 'none', borderRadius: 999,
                padding: '14px 32px',
                fontSize: 15, fontWeight: 700,
                fontFamily: "'Sora',sans-serif",
                cursor: 'pointer', letterSpacing: '-0.01em',
              }}
            >
              Tilmeld institution
            </button>
            <button
              onClick={() => router.push('/opslag')}
              style={{
                background: 'transparent',
                color: 'rgba(255,255,255,0.85)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                borderRadius: 999, padding: '14px 32px',
                fontSize: 15, fontWeight: 600,
                fontFamily: "'Sora',sans-serif",
                cursor: 'pointer', letterSpacing: '-0.01em',
              }}
            >
              Se opslag &rarr;
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
