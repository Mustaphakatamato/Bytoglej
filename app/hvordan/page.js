'use client';
import { useRouter } from 'next/navigation';
import { PRIMARY } from '@/lib/constants';
import { Btn } from '@/components/ui';
import { useWindowWidth } from '@/lib/hooks';

export default function HowItWorksPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 640;
  const steps = [
    { n:1, icon:'👤', bg:'#7C3AED', title:'Tilmeld din institution', desc:'Start med at oprette en profil for din institution. Du skal bruge CVR-nummer og kontaktoplysninger. Vi verificerer alle institutioner for at sikre en tryg handelsplatform.', checks:['CVR-verificering','Institutionens kontaktoplysninger','Ansvarlig kontaktperson','Godkendelse inden for 1-2 hverdage'] },
    { n:2, icon:'📷', bg:'#F59E0B', title:'Opret annoncer', desc:'Upload billeder og beskrivelser af det legetøj I ønsker at sælge eller bytte. Jo mere detaljeret beskrivelse, jo bedre.', checks:['Tydelige billeder fra flere vinkler','Beskrivelse af stand og alder','Pris eller bytteønske','Kategorisering for nem søgning'] },
    { n:3, icon:'🔍', bg:'#3B82F6', title:'Find og søg', desc:'Søg efter det legetøj I har brug for. Brug filtre til at finde præcis det I søger baseret på kategori, afstand og pris.', checks:['Avancerede søgefiltre','Søgning på afstand','Kategori og prisfiltre','Gem favoritter til senere'] },
    { n:4, icon:'🤝', bg:'#7C3AED', title:'Gennemfør handlen', desc:'Vælg mellem at købe, afgive bud eller foreslå et bytte. Vi tilbyder også transportservice hvis I ikke kan mødes.', checks:['Køb direkte til fastpris','Afgiv bud og forhandl pris','Foreslå bytte med egne annoncer','Valgfri transportservice'] },
  ];
  const tradeTypes = [
    { icon:'💰', title:'Køb', color:'#2A7D4F', desc:'Køb direkte til den angivne pris', ex:'Du ser et legetøj til 450 kr og køber det med det samme' },
    { icon:'🤝', title:'Byd', color:'#F59E0B', desc:'Afgiv et bud lavere end udbudsprisen', ex:'Du byder 350 kr på et legetøj til 450 kr og afventer svar' },
    { icon:'🔄', title:'Byt', color:'#3B82F6', desc:'Tilbyd et af dine egne produkter i bytte', ex:'Du tilbyder dit puslespil i bytte for deres byggeklodser' },
  ];
  const features = [
    { icon:'🛡️', title:'Sikker platform', desc:'Alle institutioner verificeres med CVR-nummer' },
    { icon:'💬', title:'Direkte kommunikation', desc:'Kommuniker direkte med andre institutioner' },
    { icon:'🚚', title:'Transport service', desc:'Valgfri levering mellem institutioner' },
    { icon:'⭐', title:'Bedømmelser', desc:'Bedøm og blive bedømt for at bygge tillid' },
  ];
  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:'#f8f9fa' }} className="page-enter">
      <div style={{ maxWidth:860, margin:'0 auto', padding:isMobile?'32px 16px 60px':'48px 24px 80px' }}>

        <div style={{ textAlign:'center', marginBottom:isMobile?36:52 }}>
          <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:900, fontSize:isMobile?28:38, letterSpacing:'-0.5px', marginBottom:10 }}>Hvordan virker det?</h1>
          <p style={{ color:'#888', fontSize:15 }}>En simpel guide til at komme i gang med byt&amp;leg</p>
        </div>

        {steps.map((s,i) => (
          <div key={i} style={{ display:'flex', gap:isMobile?16:24, marginBottom:isMobile?20:28, alignItems:'flex-start' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0, color:'#fff' }}>{s.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ background:s.bg, color:'#fff', borderRadius:99, fontSize:11, fontWeight:800, padding:'3px 10px' }}>Trin {s.n}</span>
                <h3 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:19, margin:0 }}>{s.title}</h3>
              </div>
              <p style={{ color:'#555', fontSize:14, lineHeight:1.65, marginBottom:12 }}>{s.desc}</p>
              <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:12, padding:'14px 18px' }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Dette skal du have klar:</div>
                {s.checks.map((c,j) => (
                  <div key={j} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2A7D4F', marginBottom:j<s.checks.length-1?6:0 }}>
                    <span style={{ fontSize:14 }}>✅</span> {c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:isMobile?22:26, textAlign:'center', margin:isMobile?'36px 0 18px':'52px 0 24px' }}>Tre måder at handle på</h2>
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:isMobile?12:16, marginBottom:isMobile?36:52 }}>
          {tradeTypes.map((t,i) => (
            <div key={i} style={{ background:'#fff', borderRadius:16, padding:'24px 20px', textAlign:'center', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>{t.icon}</div>
              <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:18, marginBottom:6 }}>{t.title}</div>
              <div style={{ fontSize:13, color:'#555', marginBottom:12, lineHeight:1.55 }}>{t.desc}</div>
              <div style={{ fontSize:12, color:'#888', fontStyle:'italic', lineHeight:1.5 }}><strong>Eksempel:</strong> {t.ex}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:isMobile?22:26, textAlign:'center', marginBottom:16 }}>Yderligere funktioner</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:isMobile?10:14, marginBottom:isMobile?36:52 }}>
          {features.map((f,i) => (
            <div key={i} style={{ background:'#fff', borderRadius:14, padding:'18px 20px', display:'flex', gap:14, alignItems:'flex-start', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize:24, flexShrink:0 }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{f.title}</div>
                <div style={{ fontSize:13, color:'#666' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:'#fff', borderRadius:20, padding:32, boxShadow:'0 1px 8px rgba(0,0,0,0.06)', marginBottom:52, textAlign:'center' }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:24, marginBottom:6 }}>Verificeringsproces</h2>
          <div style={{ fontSize:48, margin:'16px 0 6px' }}>🛡️</div>
          <h3 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:18, color:PRIMARY, marginBottom:6 }}>Kun verificerede institutioner</h3>
          <p style={{ fontSize:14, color:'#888', marginBottom:28 }}>Vi sikrer tryghed ved at verificere alle institutioner før de får adgang</p>
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:isMobile?16:20 }}>
            {[['1','CVR-tjek','Vi tjekker at CVR-nummeret er gyldigt og aktivt'],['2','Kontaktverificering','Vi kontakter institutionen for at bekræfte legitimitet'],['3','Godkendelse','Efter godkendelse får I fuld adgang til platformen']].map(([n,title,desc],i)=>(
              <div key={i}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:PRIMARY, color:'#fff', fontWeight:800, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>{n}</div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{title}</div>
                <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:isMobile?22:26, textAlign:'center', marginBottom:16 }}>Tips til succesfuld handel</h2>
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?12:16, marginBottom:isMobile?36:52 }}>
          {[{title:'Gode annoncer',tips:['Tag tydelige billeder i godt lys','Beskriv stand og eventuelle skader ærligt','Angiv aldersgruppe og antal dele','Sæt en rimelig pris baseret på stand']},{title:'Sikker handel',tips:['Kommuniker altid gennem platformen','Mød på offentlige steder eller brug transport','Tjek produktet før betaling','Giv feedback efter handlen']}].map((col,i)=>(
            <div key={i} style={{ background:'#fff', borderRadius:14, padding:'20px 22px', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>{col.title}</div>
              {col.tips.map((t,j)=>(
                <div key={j} style={{ display:'flex', gap:8, fontSize:13, color:'#2A7D4F', marginBottom:j<col.tips.length-1?8:0 }}>✅ {t}</div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ background:'#fff', borderRadius:20, padding:'36px 32px', textAlign:'center', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:900, fontSize:26, marginBottom:8 }}>Klar til at komme i gang?</h2>
          <p style={{ color:'#888', fontSize:14, marginBottom:24 }}>Tilmeld din institution i dag og bliv en del af det bæredygtige fællesskab</p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>router.push('/signup')} style={{ padding:'13px 28px', fontSize:15 }}>👤 Tilmeld institution</Btn>
            <Btn variant="outline" radius={22} onClick={()=>router.push('/opslag')} style={{ padding:'13px 28px', fontSize:15 }}>Se markedspladsen →</Btn>
          </div>
        </div>

      </div>
    </div>
  );
}
