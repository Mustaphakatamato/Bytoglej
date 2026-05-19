'use client';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2 } from '@/lib/constants';
import { Btn } from '@/components/ui';
import { useWindowWidth } from '@/lib/hooks';

const steps = [
  {
    n: '01',
    title: 'Tilmeld din institution',
    desc: 'Opret en profil med CVR-nummer og kontaktoplysninger. Vi verificerer alle institutioner — så alle ved de handler med nogen man kan stole på.',
    points: ['CVR-verificering', 'Kontaktoplysninger', 'Ansvarlig person', 'Godkendt på 1-2 hverdage'],
    cta: 'Tilmeld nu',
    path: '/signup',
  },
  {
    n: '02',
    title: 'Opret dine annoncer',
    desc: 'Upload billeder og beskriv det legetøj I ønsker at sælge, sætte i bud eller bytte. Gode billeder og ærlige beskrivelser giver langt flere henvendelser.',
    points: ['Billeder fra flere vinkler', 'Stand og alder', 'Pris eller bytteønske', 'Kategorisering'],
    cta: 'Se eksempler',
    path: '/opslag',
  },
  {
    n: '03',
    title: 'Find det I mangler',
    desc: 'Søg og filtrer på kategori, afstand og pris. Gem favoritter. Få besked når nyt legetøj dukker op i jeres nærhed.',
    points: ['Søg på afstand', 'Kategori og prisfiltre', 'Gem favoritter', 'Notifikationer'],
    cta: 'Gå til markedsplads',
    path: '/opslag',
  },
  {
    n: '04',
    title: 'Gennemfør handlen',
    desc: 'Køb direkte, afgiv bud eller foreslå et bytte — alt sker sikkert igennem platformen. Handel med sindsro.',
    points: ['Fastpris køb', 'Bud og forhandling', 'Bytte med egne annoncer', 'Valgfri transportservice'],
    cta: 'Start nu',
    path: '/signup',
  },
];

const tradeTypes = [
  { label: 'Køb', sub: 'Fastpris', desc: 'Se prisen — køb med det samme. Ingen forhandling, ingen ventetid.' },
  { label: 'Byd', sub: 'Forhandl', desc: 'Send et bud under udbudsprisen og aftal en pris der passer begge parter.' },
  { label: 'Byt', sub: 'Bytehandel', desc: 'Tilbyd et af jeres egne opslag i bytte. Penge er ikke nødvendigt.' },
];

export default function HowItWorksPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden' }} className="page-enter">

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
        paddingTop: 140, paddingBottom: isMobile ? 80 : 120,
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* big watermark number */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', userSelect:'none' }}>
          <span style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize: isMobile ? 200 : 340, color:'rgba(255,255,255,0.04)', lineHeight:1, letterSpacing:'-0.05em' }}>?</span>
        </div>
        <div style={{ position:'relative', maxWidth:640, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'inline-block', background:'rgba(255,255,255,0.12)', borderRadius:999, padding:'6px 18px', fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.8)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:24 }}>
            Sådan virker det
          </div>
          <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize: isMobile ? 36 : 56, letterSpacing:'-0.04em', lineHeight:1.0, color:'#fff', marginBottom:20 }}>
            Fra annonce<br/>til handel — enkelt.
          </h1>
          <p style={{ fontSize: isMobile ? 15 : 17, color:'rgba(255,255,255,0.72)', lineHeight:1.65, maxWidth:480, margin:'0 auto' }}>
            byt&amp;leg er bygget til institutioner. Fire trin er alt hvad der skal til.
          </p>
        </div>
        {/* wave bottom */}
        <svg viewBox="0 0 1440 80" style={{ position:'absolute', bottom:-1, left:0, right:0, width:'100%', display:'block' }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill={PAPER} />
        </svg>
      </div>

      {/* ── Steps flow ── */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '60px 20px' : '100px 40px', position:'relative' }}>

        {/* vertical spine */}
        {!isMobile && (
          <div style={{
            position:'absolute', left:'50%', top: 0, bottom: 0,
            width: 2, background: `linear-gradient(to bottom, ${GREEN_SOFT}, ${PRIMARY}, ${GREEN_SOFT})`,
            transform:'translateX(-50%)', opacity:0.35,
          }} />
        )}

        {steps.map((s, i) => {
          const isRight = i % 2 === 0;
          return (
            <div key={s.n} style={{
              display:'flex',
              flexDirection: isMobile ? 'column' : (isRight ? 'row' : 'row-reverse'),
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: isMobile ? 24 : 64,
              marginBottom: isMobile ? 72 : 120,
              position:'relative',
            }}>
              {/* content side */}
              <div style={{ flex:1, textAlign: isMobile ? 'left' : (isRight ? 'right' : 'left') }}>
                <div style={{
                  fontFamily:"'Sora',sans-serif", fontWeight:800,
                  fontSize: isMobile ? 80 : 100,
                  color: GREEN_SOFT,
                  lineHeight:0.85,
                  letterSpacing:'-0.05em',
                  marginBottom: isMobile ? -12 : -20,
                  userSelect:'none',
                }}>
                  {s.n}
                </div>
                <h2 style={{
                  fontFamily:"'Sora',sans-serif", fontWeight:800,
                  fontSize: isMobile ? 24 : 30,
                  letterSpacing:'-0.03em', color: INK,
                  marginBottom:12, lineHeight:1.1,
                }}>
                  {s.title}
                </h2>
                <p style={{ fontSize:15, color:INK2, lineHeight:1.7, marginBottom:20, maxWidth:340, marginLeft: (!isMobile && !isRight) ? 0 : 'auto', marginRight: (!isMobile && isRight) ? 0 : 'auto' }}>
                  {s.desc}
                </p>
                <button onClick={() => router.push(s.path)} style={{
                  background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY,
                  borderRadius:999, padding:'9px 22px', fontSize:13, fontWeight:700,
                  fontFamily:"'Sora',sans-serif", cursor:'pointer',
                  letterSpacing:'-0.01em',
                  transition:'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = PRIMARY; e.currentTarget.style.color = PAPER; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = PRIMARY; }}
                >
                  {s.cta} →
                </button>
              </div>

              {/* center dot on spine */}
              {!isMobile && (
                <div style={{
                  width:16, height:16, borderRadius:'50%',
                  background: PRIMARY,
                  flexShrink:0,
                  boxShadow:`0 0 0 6px ${GREEN_TINT}`,
                  zIndex:2,
                }} />
              )}

              {/* checklist side */}
              <div style={{ flex:1 }}>
                <div style={{
                  background: GREEN_TINT,
                  borderRadius:20, padding: isMobile ? '20px 20px' : '28px 28px',
                  borderLeft: `3px solid ${PRIMARY}`,
                }}>
                  {s.points.map((p, j) => (
                    <div key={j} style={{
                      display:'flex', alignItems:'center', gap:12,
                      paddingBottom: j < s.points.length - 1 ? 14 : 0,
                      marginBottom: j < s.points.length - 1 ? 14 : 0,
                      borderBottom: j < s.points.length - 1 ? `1px solid ${GREEN_SOFT}` : 'none',
                    }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:PRIMARY, flexShrink:0 }} />
                      <span style={{ fontSize:14, fontWeight:600, color:GREEN_DEEP }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Trade types ── */}
      <div style={{ background: GREEN_DEEP, padding: isMobile ? '64px 20px' : '100px 40px', position:'relative', overflow:'hidden' }}>
        {/* background texture */}
        <div style={{ position:'absolute', inset:0, backgroundImage:`radial-gradient(circle at 20% 50%, rgba(42,125,79,0.4) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(207,227,216,0.08) 0%, transparent 50%)`, pointerEvents:'none' }} />
        <div style={{ maxWidth:820, margin:'0 auto', position:'relative' }}>
          <div style={{ textAlign:'center', marginBottom: isMobile ? 40 : 64 }}>
            <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize: isMobile ? 28 : 42, letterSpacing:'-0.04em', color:'#fff', marginBottom:12 }}>
              Tre måder at handle på
            </h2>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:15 }}>Vælg den model der passer til situationen</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 16 : 24 }}>
            {tradeTypes.map((t, i) => (
              <div key={i} style={{
                background:'rgba(255,255,255,0.06)',
                border:`1px solid rgba(255,255,255,0.12)`,
                borderRadius:20, padding:'32px 28px',
                backdropFilter:'blur(10px)',
              }}>
                <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:36, color:'rgba(255,255,255,0.15)', letterSpacing:'-0.05em', marginBottom:4, lineHeight:1 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, color:'#fff', marginBottom:4, letterSpacing:'-0.03em' }}>{t.label}</div>
                <div style={{ fontSize:12, fontWeight:600, color:GREEN_SOFT, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:16 }}>{t.sub}</div>
                <p style={{ fontSize:14, color:'rgba(255,255,255,0.6)', lineHeight:1.65 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Verification flow ── */}
      <div style={{ maxWidth:820, margin:'0 auto', padding: isMobile ? '64px 20px' : '100px 40px' }}>
        <div style={{ textAlign:'center', marginBottom: isMobile ? 40 : 64 }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize: isMobile ? 26 : 38, letterSpacing:'-0.04em', color:INK, marginBottom:12 }}>
            Kun verificerede institutioner
          </h2>
          <p style={{ color:INK3, fontSize:15, maxWidth:440, margin:'0 auto', lineHeight:1.65 }}>
            Alle der handler på byt&amp;leg er gennemgået. Det giver tryghed for alle parter.
          </p>
        </div>

        {/* horizontal flow */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 0, position:'relative' }}>
          {/* connector line */}
          {!isMobile && (
            <div style={{ position:'absolute', top:32, left:'16.6%', right:'16.6%', height:2, background:`linear-gradient(to right, ${GREEN_SOFT}, ${PRIMARY}, ${GREEN_SOFT})`, zIndex:0 }} />
          )}
          {[
            { n:'1', title:'CVR-tjek', desc:'Vi tjekker at nummeret er gyldigt og tilhører en aktiv institution.' },
            { n:'2', title:'Kontaktverificering', desc:'Vi bekræfter at oplysningerne stemmer med den pågældende institution.' },
            { n:'3', title:'Fuld adgang', desc:'Godkendt — I kan nu handle, kommunikere og oprette annoncer.' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign:'center', padding: isMobile ? '0 0 40px' : '0 24px', position:'relative', zIndex:1 }}>
              <div style={{
                width:64, height:64, borderRadius:'50%',
                background: PRIMARY, color: PAPER,
                fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22,
                display:'flex', alignItems:'center', justifyContent:'center',
                margin:'0 auto 20px',
                boxShadow:`0 0 0 10px ${GREEN_TINT}`,
              }}>
                {item.n}
              </div>
              <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:16, color:INK, marginBottom:8 }}>{item.title}</div>
              <p style={{ fontSize:13, color:INK3, lineHeight:1.65, maxWidth:200, margin:'0 auto' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`,
        padding: isMobile ? '64px 24px' : '100px 40px',
        textAlign:'center', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:`radial-gradient(circle at 70% 30%, rgba(241,196,75,0.08) 0%, transparent 50%)`, pointerEvents:'none' }} />
        <div style={{ position:'relative', maxWidth:520, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize: isMobile ? 30 : 46, letterSpacing:'-0.04em', color:'#fff', marginBottom:16, lineHeight:1.05 }}>
            Klar til at komme i gang?
          </h2>
          <p style={{ color:'rgba(255,255,255,0.65)', fontSize:16, lineHeight:1.65, marginBottom:36 }}>
            Tilmeld din institution i dag og bliv en del af et bæredygtigt fællesskab af institutioner.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <button onClick={() => router.push('/signup')} style={{
              background: PAPER, color: PRIMARY,
              border:'none', borderRadius:999, padding:'14px 32px',
              fontSize:15, fontWeight:700, fontFamily:"'Sora',sans-serif",
              cursor:'pointer', letterSpacing:'-0.01em',
            }}>
              Tilmeld institution
            </button>
            <button onClick={() => router.push('/opslag')} style={{
              background:'transparent', color:'rgba(255,255,255,0.85)',
              border:'1.5px solid rgba(255,255,255,0.3)', borderRadius:999, padding:'14px 32px',
              fontSize:15, fontWeight:600, fontFamily:"'Sora',sans-serif",
              cursor:'pointer', letterSpacing:'-0.01em',
            }}>
              Se markedspladsen →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
