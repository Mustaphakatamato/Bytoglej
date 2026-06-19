'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

const faqs = [
  {
    q: 'Hvem kan tilmelde sig byt&leg?',
    a: 'Alle CVR-registrerede institutioner i Danmark kan tilmelde sig. Det inkluderer vuggestuer, børnehaver, SFO\'er, folkeskoler, fritidsklubber og andre godkendte institutioner.',
  },
  {
    q: 'Hvad koster det at bruge platformen?',
    a: 'byt&leg er gratis at bruge. Vi tager ingen kommission eller gebyrer for handler. Målet er at fremme bæredygtig genbrug i institutionssektoren.',
  },
  {
    q: 'Hvordan verificeres min institution?',
    a: 'Når du angiver dit CVR-nummer, slår vi det automatisk op i Erhvervsstyrelsens register. Vi bekræfter at jeres institution er aktiv og godkendt. Processen tager typisk 1-2 hverdage.',
  },
  {
    q: 'Kan jeg sælge privat legetøj på platformen?',
    a: 'Nej, byt&leg er udelukkende for institutioner. Alt legetøj der handles på platformen skal tilhøre den pågældende institution og bruges i institutionsmæssig sammenhæng.',
  },
  {
    q: 'Hvad sker der hvis et produkt ikke er som beskrevet?',
    a: 'Vi opfordrer altid til at inspicere produktet inden betaling. Har I en tvist, kan I kontakte os via support, og vi vil hjælpe med mægling mellem institutionerne.',
  },
  {
    q: 'Tilbyder I transport eller levering?',
    a: 'Vi samarbejder med transportpartnere der kan levere legetøj mellem institutioner. Vælg "Valgfri transportservice" under en handel for at se priser og muligheder i jeres område.',
  },
  {
    q: 'Hvordan sletter jeg min institutions konto?',
    a: 'Kontakt os på support@bytogleg.dk, så sørger vi for at slette alle jeres data i overensstemmelse med GDPR. Handler og beskeder anonymiseres og opbevares i op til 30 dage herefter.',
  },
];

const channels = [
  {
    n: '01',
    title: 'E-mail',
    val: 'support@bytogleg.dk',
    sub: 'Svar inden for 1-2 hverdage',
  },
  {
    n: '02',
    title: 'Platform-chat',
    val: 'Åbn beskeder på platformen',
    sub: 'For registrerede institutioner',
  },
];

export default function KontaktPage() {
  const [open, setOpen] = useState(null);
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
        {/* Decorative watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: isMobile ? 200 : 340, color: 'rgba(255,255,255,0.04)', lineHeight: 1, letterSpacing: '-0.05em' }}>@</span>
        </div>

        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 24 }}>
            Kontakt
          </div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: isMobile ? 36 : 56, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#fff', marginBottom: 20 }}>
            Vi er her for<br />at hjælpe
          </h1>
          <p style={{ fontSize: isMobile ? 15 : 17, color: 'rgba(255,255,255,0.72)', lineHeight: 1.65, maxWidth: 420, margin: '0 auto' }}>
            Skriv til os eller find svaret i vores FAQ
          </p>
        </div>

        {/* Wave bottom */}
        <svg viewBox="0 0 1440 80" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill={PAPER} />
        </svg>
      </div>

      {/* ── Contact Channels ── */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '60px 20px' : '100px 40px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1px 1fr',
          gap: 0,
          alignItems: 'center',
        }}>
          {channels.map((c, i) => (
            <>
              <div key={c.n} style={{
                padding: isMobile ? '32px 0' : '40px 48px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: "'Sora',sans-serif",
                  fontWeight: 800,
                  fontSize: isMobile ? 80 : 100,
                  color: GREEN_SOFT,
                  lineHeight: 0.85,
                  letterSpacing: '-0.05em',
                  marginBottom: isMobile ? 16 : 20,
                  userSelect: 'none',
                }}>
                  {c.n}
                </div>
                <div style={{
                  fontFamily: "'Sora',sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  color: INK,
                  marginBottom: 10,
                  letterSpacing: '-0.02em',
                }}>
                  {c.title}
                </div>
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: PRIMARY,
                  marginBottom: 8,
                  fontFamily: "'Sora',sans-serif",
                }}>
                  {c.val}
                </div>
                <div style={{ fontSize: 13, color: INK3, lineHeight: 1.5 }}>
                  {c.sub}
                </div>
              </div>

              {/* Vertical divider between items on desktop, horizontal on mobile */}
              {i === 0 && (
                <div key="divider" style={
                  isMobile
                    ? { height: 1, background: GREEN_SOFT, margin: '0 0' }
                    : { width: 1, alignSelf: 'stretch', background: GREEN_SOFT }
                } />
              )}
            </>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div style={{ background: GREEN_TINT, padding: isMobile ? '64px 20px' : '100px 40px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Sora',sans-serif",
            fontWeight: 800,
            fontSize: isMobile ? 28 : 42,
            letterSpacing: '-0.04em',
            color: INK,
            textAlign: 'center',
            marginBottom: isMobile ? 40 : 64,
          }}>
            Ofte stillede spørgsmål
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {faqs.map((f, i) => {
              const isOpen = open === i;
              const isLast = i === faqs.length - 1;
              return (
                <div key={i} style={{ borderBottom: isLast ? 'none' : `1px solid ${GREEN_SOFT}` }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '22px 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      textAlign: 'left',
                      gap: 16,
                    }}
                  >
                    <span style={{
                      fontFamily: "'Sora',sans-serif",
                      fontWeight: 600,
                      fontSize: isMobile ? 14 : 16,
                      color: isOpen ? PRIMARY : INK,
                      lineHeight: 1.4,
                      transition: 'color 0.2s',
                    }}>
                      {f.q}
                    </span>
                    <span style={{
                      fontSize: 20,
                      color: isOpen ? PRIMARY : INK3,
                      flexShrink: 0,
                      transition: 'transform 0.2s, color 0.2s',
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      display: 'inline-block',
                      lineHeight: 1,
                      fontWeight: 300,
                    }}>
                      +
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{
                      paddingBottom: 24,
                      fontSize: 14,
                      color: INK2,
                      lineHeight: 1.75,
                    }}>
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`,
        padding: isMobile ? '64px 24px' : '100px 40px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 70% 30%, rgba(207,227,216,0.08) 0%, transparent 50%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Sora',sans-serif",
            fontWeight: 800,
            fontSize: isMobile ? 30 : 46,
            letterSpacing: '-0.04em',
            color: '#fff',
            marginBottom: 16,
            lineHeight: 1.05,
          }}>
            Klar til at tilmelde jer?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, lineHeight: 1.65, marginBottom: 36 }}>
            Bliv en del af et bæredygtigt fællesskab af institutioner der giver legetøj nyt liv.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/signup')}
              style={{
                background: PAPER,
                color: PRIMARY,
                border: 'none',
                borderRadius: 999,
                padding: '14px 32px',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'Sora',sans-serif",
                cursor: 'pointer',
                letterSpacing: '-0.01em',
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
                borderRadius: 999,
                padding: '14px 32px',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "'Sora',sans-serif",
                cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}
            >
              Se opslag →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
