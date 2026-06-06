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
    desc: 'Du har cykler, puslespil eller møbler der ikke bruges. Et andet sted vil de gøre børn glade — men de fylder bare hos jer.',
    points: ['Legetøj der ikke bruges', 'Møbler der er gået ud af mode', 'Cykler og udstyr der er for store', 'Materialer fra afsluttede projekter'],
  },
  {
    emoji: '📸',
    bg: '#F0FDF4',
    accent: '#16A34A',
    label: '02',
    title: 'Opret et opslag på 2 min.',
    desc: 'Tag ét billede. Vores AI scanner det og udfylder automatisk titel, kategori, stand og beskrivelse. Du vælger selv pris eller byt.',
    points: ['AI udfylder titel og beskrivelse', 'Vælg køb, byt eller byd', 'Synlig for alle verificerede institutioner', 'Ingen annonceringsomkostninger'],
  },
  {
    emoji: '💬',
    bg: '#EFF6FF',
    accent: '#2563EB',
    label: '03',
    title: 'Institutioner byder og skriver',
    desc: 'Verificerede børnehaver og skoler kontakter dig direkte. Forhandl, send modbud, tilbyd et bytte — du bestemmer.',
    points: ['Direkte beskeder i platformen', 'Modtag bud og forhandl', 'Byttetilbud fra andre institutioner', 'Notifikationsmail på alle nye beskeder'],
  },
  {
    emoji: '🚀',
    bg: '#FDF4FF',
    accent: '#9333EA',
    label: '04',
    title: 'Nyt hjem, ny glæde',
    desc: 'I aftaler pris og afhentning. Legetøjet giver glæde et nyt sted — og platformen beregner automatisk CO₂-besparelsen.',
    points: ['Aftaler pris og afhentning direkte', 'Pengene går til jer', 'Handlen registreres på platformen', 'CO₂-besparelse beregnes automatisk'],
  },
];

const AI_FEATURES = [
  {
    emoji: '📸',
    color: '#16A34A',
    bg: '#F0FDF4',
    title: 'Billedscanning',
    desc: 'Tag et foto af dit legetøj og lad AI udfylde titel, beskrivelse, kategori, aldersgruppe og stand på få sekunder. Ingen manuel indtastning.',
  },
  {
    emoji: '✍️',
    color: '#7C3AED',
    bg: '#F5F3FF',
    title: 'Søges-assistent',
    desc: 'Skriv frit hvad du leder efter — fx "Vi mangler cykler til 5-årige" — og AI oversætter det til et struktureret søges-opslag klar til publicering.',
  },
  {
    emoji: '🔍',
    color: '#2563EB',
    bg: '#EFF6FF',
    title: 'Intelligent søgning',
    desc: 'Skriv naturligt hvad du leder efter. AI forstår kategorier og aldersgrupper og finder de mest relevante opslag — ikke kun dem med præcis samme ord.',
  },
  {
    emoji: '📝',
    color: '#D97706',
    bg: '#FFFBEB',
    title: 'Beskrivelsesforbedring',
    desc: 'Har du en kort eller upræcis beskrivelse? AI kan udvide og forbedre den så opslaget fremstår mere professionelt og tiltrækker flere henvendelser.',
  },
];

const PLATFORM_FEATURES = [
  { emoji: '💌', title: 'E-mailnotifikationer', desc: 'Får du en ny besked? Vi sender dig straks en mail — så du aldrig går glip af en handelsmulighed.' },
  { emoji: '🤝', title: 'Bud og modbud', desc: 'Modtag bud under udbudsprisen, send et modbud eller acceptér direkte. Hele forhandlingen sker i chatten.' },
  { emoji: '🔄', title: 'Byttetilbud', desc: 'Tilbyd et af jeres egne opslag som betaling. Klik "Jeg har noget der matcher" og vælg fra jeres egne listings.' },
  { emoji: '🗺️', title: 'Kortvisning', desc: 'Se opslag på et danmarkskort og find institutioner tæt på jer. Filtrer efter afstand og find lokale handelspartnere.' },
  { emoji: '📊', title: 'Mit dashboard', desc: 'Overblik over alle dine opslag, aktive handler, beskeder og statistik. Rediger, deaktiver eller sæt til "Reserveret" med ét klik.' },
  { emoji: '♻️', title: 'CO₂-beregner', desc: 'Platformen beregner automatisk CO₂-besparelsen ved hver handel baseret på afstand og produkttype.' },
  { emoji: '🔎', title: 'Søges-opslag', desc: 'Mangler I noget bestemt? Opret et søges-opslag og lad andre institutioner komme til jer med tilbud der matcher.' },
  { emoji: '🔔', title: 'Kurv og ønskeliste', desc: 'Gem interessante opslag i kurven og vend tilbage til dem. Del opslag direkte med kolleger via link.' },
  { emoji: '🛡️', title: 'Kun verificerede institutioner', desc: 'Alle brugere verificeres via CVR- eller P-nummer. Ingen private — kun rigtige institutioner.' },
];

function JourneySection({ isMobile }) {
  const cardRefs = useRef([]);

  useEffect(() => {
    const observers = cardRefs.current.map((el, i) => {
      if (!el) return null;
      const isEven = i % 2 === 0;
      const resetTransform = isMobile
        ? 'translateY(88px) scale(0.93)'
        : `translateX(${isEven ? '-80px' : '80px'}) scale(0.94)`;

      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0) translateX(0) scale(1)';
          } else if (entry.boundingClientRect.top > 0) {
            el.style.opacity = '0';
            el.style.transform = resetTransform;
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px -56px 0px' }
      );
      io.observe(el);
      return io;
    });
    return () => observers.forEach(io => io?.disconnect());
  }, [isMobile]);

  function CardContent({ step, isMobile, isLeft }) {
    return (
      <>
        <div style={{ position:'absolute', top:-6, right:isLeft?'auto':14, left:isLeft?14:'auto', fontFamily:FONT, fontWeight:800, fontSize:isMobile?72:96, color:step.accent, opacity:0.07, lineHeight:1, userSelect:'none', pointerEvents:'none', letterSpacing:'-0.05em' }}>
          {step.label}
        </div>
        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:10, color:step.accent, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
          Trin {step.label}
        </div>
        <h3 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?18:22, color:INK, letterSpacing:'-0.03em', margin:'0 0 10px', lineHeight:1.15 }}>
          {step.title}
        </h3>
        <p style={{ fontSize:isMobile?13:14, color:INK3, lineHeight:1.7, fontFamily:FONT, margin:'0 0 16px' }}>
          {step.desc}
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {step.points.map((p, j) => (
            <div key={j} style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:step.accent, flexShrink:0 }} />
              <span style={{ fontSize:isMobile?12:13, color:INK2, fontFamily:FONT, fontWeight:600 }}>{p}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div style={{ background:PAPER, padding:isMobile?'72px 0 88px':'100px 0 120px' }}>
      <div style={{ textAlign:'center', marginBottom:isMobile?64:88, padding:'0 24px' }}>
        <div style={{ display:'inline-block', background:GREEN_TINT, borderRadius:999, padding:'5px 16px', fontSize:11, fontWeight:700, color:PRIMARY, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16, fontFamily:FONT }}>
          Sådan virker det
        </div>
        <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?30:48, letterSpacing:'-0.04em', color:INK, margin:'0 0 14px', lineHeight:1.05 }}>
          Rejsen fra støv til glæde
        </h2>
        <p style={{ color:INK3, fontSize:isMobile?15:17, maxWidth:400, margin:'0 auto', fontFamily:FONT, lineHeight:1.65 }}>
          Fire trin. Ingen gebyrer. Bare legetøj der finder et nyt hjem.
        </p>
      </div>

      {isMobile ? (
        <div style={{ maxWidth:520, margin:'0 auto', padding:'0 20px', position:'relative' }}>
          <div style={{ position:'absolute', left:43, top:24, bottom:24, width:2, background:PAPER3, borderRadius:1 }} />
          <div style={{ display:'flex', flexDirection:'column', gap:36 }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
                <div style={{ flexShrink:0, width:48, height:48, borderRadius:'50%', background:'#fff', border:`2px solid ${step.accent}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:`0 6px 24px ${step.accent}55`, position:'relative', zIndex:2 }}>
                  {step.emoji}
                </div>
                <div ref={el => cardRefs.current[i] = el} style={{ flex:1, background:'#fff', borderRadius:16, padding:'18px 20px', boxShadow:'0 4px 32px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04)', borderLeft:`3px solid ${step.accent}`, position:'relative', overflow:'hidden', opacity:0, transform:'translateY(88px) scale(0.93)', transition:'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)' }}>
                  <CardContent step={step} isMobile={true} isLeft={false} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 40px', position:'relative' }}>
          <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', top:28, bottom:28, width:2, background:PAPER3, borderRadius:1 }} />
          <div style={{ display:'flex', flexDirection:'column', gap:56 }}>
            {STEPS.map((step, i) => {
              const isEven = i % 2 === 0;
              return (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 1fr', alignItems:'flex-start' }}>
                  <div style={{ paddingRight:40, display:'flex', justifyContent:'flex-end' }}>
                    {isEven && (
                      <div ref={el => cardRefs.current[i] = el} style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:20, padding:'28px 32px', boxShadow:'0 4px 40px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04)', borderRight:`3px solid ${step.accent}`, position:'relative', overflow:'hidden', opacity:0, transform:'translateX(-80px) scale(0.94)', transition:'opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s cubic-bezier(0.16,1,0.3,1)' }}>
                        <CardContent step={step} isMobile={false} isLeft={true} />
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', justifyContent:'center', paddingTop:10, position:'relative', zIndex:2 }}>
                    <div style={{ width:56, height:56, borderRadius:'50%', background:'#fff', border:`2.5px solid ${step.accent}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, boxShadow:`0 6px 28px ${step.accent}55` }}>
                      {step.emoji}
                    </div>
                  </div>
                  <div style={{ paddingLeft:40 }}>
                    {!isEven && (
                      <div ref={el => cardRefs.current[i] = el} style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:20, padding:'28px 32px', boxShadow:'0 4px 40px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04)', borderLeft:`3px solid ${step.accent}`, position:'relative', overflow:'hidden', opacity:0, transform:'translateX(80px) scale(0.94)', transition:'opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s cubic-bezier(0.16,1,0.3,1)' }}>
                        <CardContent step={step} isMobile={false} isLeft={false} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HowItWorksPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;

  return (
    <div style={{ background:PAPER, minHeight:'100vh', overflowX:'hidden' }}>

      {/* Hero */}
      <div style={{ background:`linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, paddingTop:140, paddingBottom:isMobile?80:120, textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', userSelect:'none' }}>
          <span style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?200:340, color:'rgba(255,255,255,0.04)', lineHeight:1, letterSpacing:'-0.05em' }}>?</span>
        </div>
        <div style={{ position:'relative', maxWidth:640, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'inline-block', background:'rgba(255,255,255,0.12)', borderRadius:999, padding:'6px 18px', fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.8)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:24, fontFamily:FONT }}>
            Sådan virker det
          </div>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?36:56, letterSpacing:'-0.04em', lineHeight:1.0, color:'#fff', marginBottom:20 }}>
            Fra støv<br />til glæde
          </h1>
          <p style={{ fontSize:isMobile?15:17, color:'rgba(255,255,255,0.72)', lineHeight:1.65, maxWidth:480, margin:'0 auto', fontFamily:FONT }}>
            Danmarks første markedsplads for institutioner. AI-drevet, bæredygtig og gratis.
          </p>
        </div>
        <svg viewBox="0 0 1440 80" style={{ position:'absolute', bottom:-1, left:0, right:0, width:'100%', display:'block' }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill={PAPER} />
        </svg>
      </div>

      {/* Journey timeline */}
      <JourneySection isMobile={isMobile} />

      {/* AI features */}
      <div style={{ background:GREEN_DEEP, padding:isMobile?'64px 20px':'100px 40px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:`radial-gradient(circle at 15% 60%, rgba(42,125,79,0.5) 0%, transparent 55%), radial-gradient(circle at 85% 20%, rgba(207,227,216,0.07) 0%, transparent 50%)`, pointerEvents:'none' }} />
        <div style={{ maxWidth:920, margin:'0 auto', position:'relative' }}>
          <div style={{ textAlign:'center', marginBottom:isMobile?40:60 }}>
            <div style={{ display:'inline-block', background:'rgba(255,255,255,0.1)', borderRadius:999, padding:'5px 16px', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16, fontFamily:FONT }}>
              Kunstig intelligens
            </div>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?28:44, letterSpacing:'-0.04em', color:'#fff', marginBottom:12, lineHeight:1.05 }}>
              AI gør det nemt
            </h2>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:isMobile?14:16, fontFamily:FONT, maxWidth:420, margin:'0 auto', lineHeight:1.65 }}>
              Vi bruger AI til at spare dig for tid — fra billede til færdigt opslag på sekunder.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(2,1fr)', gap:isMobile?16:20 }}>
            {AI_FEATURES.map((f, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'28px 28px', backdropFilter:'blur(10px)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:f.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{f.emoji}</div>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color:'#fff', letterSpacing:'-0.02em' }}>{f.title}</div>
                </div>
                <p style={{ fontSize:14, color:'rgba(255,255,255,0.6)', lineHeight:1.7, fontFamily:FONT, margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trade types */}
      <div style={{ background:PAPER2, padding:isMobile?'64px 20px':'100px 40px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:isMobile?40:60 }}>
            <div style={{ display:'inline-block', background:GREEN_TINT, borderRadius:999, padding:'5px 16px', fontSize:11, fontWeight:700, color:PRIMARY, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16, fontFamily:FONT }}>
              Handelstyper
            </div>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?28:44, letterSpacing:'-0.04em', color:INK, marginBottom:12, lineHeight:1.05 }}>
              Tre måder at handle på
            </h2>
            <p style={{ color:INK3, fontSize:isMobile?14:16, fontFamily:FONT, maxWidth:400, margin:'0 auto', lineHeight:1.65 }}>
              Vælg den model der passer til jer og situationen.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:isMobile?14:20 }}>
            {[
              { emoji:'🏷️', label:'Køb', sub:'Fastpris', desc:'Se prisen — køb med det samme. Ingen forhandling, ingen ventetid. Ideelt når begge parter ved hvad tingen er værd.', color:PRIMARY },
              { emoji:'💰', label:'Byd', sub:'Forhandl', desc:'Send et bud under udbudsprisen og forhandl via chat med modbud. Handlen er på plads når begge accepterer.', color:'#D97706' },
              { emoji:'🔄', label:'Byt', sub:'Bytehandel', desc:'Tilbyd et af jeres egne opslag som betaling. Penge er ikke nødvendigt — find noget I begge mangler.', color:'#7C3AED' },
            ].map((t, i) => (
              <div key={i} style={{ background:'#fff', border:`1px solid ${PAPER3}`, borderRadius:20, padding:'28px 24px', borderTop:`3px solid ${t.color}` }}>
                <div style={{ fontSize:28, marginBottom:12 }}>{t.emoji}</div>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:INK, marginBottom:4, letterSpacing:'-0.03em' }}>{t.label}</div>
                <div style={{ fontSize:11, fontWeight:700, color:t.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14, fontFamily:FONT }}>{t.sub}</div>
                <p style={{ fontSize:14, color:INK3, lineHeight:1.65, fontFamily:FONT, margin:0 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform features grid */}
      <div style={{ background:PAPER, padding:isMobile?'64px 20px':'100px 40px' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:isMobile?40:60 }}>
            <div style={{ display:'inline-block', background:GREEN_TINT, borderRadius:999, padding:'5px 16px', fontSize:11, fontWeight:700, color:PRIMARY, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16, fontFamily:FONT }}>
              Platform
            </div>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?28:44, letterSpacing:'-0.04em', color:INK, marginBottom:12, lineHeight:1.05 }}>
              Alt hvad I behøver
            </h2>
            <p style={{ color:INK3, fontSize:isMobile?14:16, fontFamily:FONT, maxWidth:420, margin:'0 auto', lineHeight:1.65 }}>
              byt&amp;leg er bygget specielt til institutioner — ikke en generisk markedsplads.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:isMobile?12:16 }}>
            {PLATFORM_FEATURES.map((f, i) => (
              <div key={i} style={{ background:'#fff', border:`1px solid ${PAPER3}`, borderRadius:16, padding:'20px 20px' }}>
                <div style={{ fontSize:24, marginBottom:10 }}>{f.emoji}</div>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:INK, marginBottom:6, letterSpacing:'-0.02em' }}>{f.title}</div>
                <p style={{ fontSize:13, color:INK3, lineHeight:1.65, fontFamily:FONT, margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ background:`linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`, padding:isMobile?'64px 24px':'100px 40px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'relative', maxWidth:520, margin:'0 auto' }}>
          <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?30:46, letterSpacing:'-0.04em', color:'#fff', marginBottom:16, lineHeight:1.05 }}>Klar til at komme i gang?</h2>
          <p style={{ color:'rgba(255,255,255,0.65)', fontSize:16, lineHeight:1.65, marginBottom:36, fontFamily:FONT }}>Tilmeld din institution i dag — det tager under 5 minutter og er gratis.</p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <button onClick={()=>router.push('/signup')} style={{ background:PAPER, color:PRIMARY, border:'none', borderRadius:999, padding:'14px 32px', fontSize:15, fontWeight:700, fontFamily:FONT, cursor:'pointer' }}>Tilmeld institution</button>
            <button onClick={()=>router.push('/opslag')} style={{ background:'transparent', color:'rgba(255,255,255,0.85)', border:'1.5px solid rgba(255,255,255,0.3)', borderRadius:999, padding:'14px 32px', fontSize:15, fontWeight:600, fontFamily:FONT, cursor:'pointer' }}>Se markedspladsen →</button>
          </div>
        </div>
      </div>

    </div>
  );
}
