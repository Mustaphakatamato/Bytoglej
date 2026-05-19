'use client';
import { PRIMARY, ACCENT, ACCENT2 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

export default function OmOsPage() {
  const w = useWindowWidth();
  const isMobile = w < 640;
  const values = [
    { icon:'🛡️', title:'Tillid', desc:'Kun verificerede institutioner med CVR-nummer' },
    { icon:'✓', title:'Gennemsigtighed', desc:'Åbne beskrivelser og fair prissætning' },
    { icon:'🌿', title:'Bæredygtighed', desc:'Fremme genbrug og cirkulær økonomi' },
    { icon:'👥', title:'Fællesskab', desc:'Skabe forbindelser mellem institutioner' },
  ];
  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:'#f8f9fa' }} className="page-enter">
      <div style={{ maxWidth:860, margin:'0 auto', padding:isMobile?'32px 16px 60px':'48px 24px 80px' }}>

        <div style={{ textAlign:'center', marginBottom:isMobile?36:52 }}>
          <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:900, fontSize:isMobile?28:38, letterSpacing:'-0.5px', marginBottom:10 }}>Om byt&amp;leg</h1>
          <p style={{ color:'#888', fontSize:16, maxWidth:520, margin:'0 auto' }}>Vi hjælper danske institutioner med at genbruge legetøj — bæredygtigt, sikkert og nemt.</p>
        </div>

        <div style={{ background:'#fff', borderRadius:20, padding:32, boxShadow:'0 1px 8px rgba(0,0,0,0.06)', marginBottom:28 }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, marginBottom:24 }}>Vores værdier</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {values.map((v,i) => (
              <div key={i} style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'#f0f9f4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, color:PRIMARY }}>{v.icon}</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{v.title}</div>
                  <div style={{ fontSize:13, color:'#2A7D4F' }}>{v.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:20, padding:32, boxShadow:'0 1px 8px rgba(0,0,0,0.06)', marginBottom:28 }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, marginBottom:8 }}>Hvem kan bruge platformen?</h2>
          <div style={{ background:'#fffcf8', border:'1px solid #f0ece6', borderRadius:14, padding:'20px 24px' }}>
            <p style={{ fontSize:13, color:ACCENT, fontWeight:600, marginBottom:14 }}>byt&amp;leg er designet specifikt til danske institutioner:</p>
            <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'8px 32px' }}>
              {['Vuggestuer','Børnehaver','Folkeskoler','SFO\'er','Fritidsklubber','Private institutioner'].map((t,i)=>(
                <div key={i} style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, color:'#444' }}>
                  <span style={{ color:PRIMARY, fontSize:14 }}>✓</span> {t}
                </div>
              ))}
            </div>
            <p style={{ fontSize:12, color:'#888', marginTop:14, fontStyle:'italic' }}>Alle institutioner skal verificeres med CVR-nummer for at sikre troværdighed og sikkerhed.</p>
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:20, padding:32, boxShadow:'0 1px 8px rgba(0,0,0,0.06)', marginBottom:28 }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, marginBottom:24 }}>Vores impact</h2>
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:isMobile?10:16 }}>
            {[{n:'2.847',label:'Handler gennemført',color:'#2A7D4F'},{n:'156',label:'Institutioner tilmeldt',color:'#3B82C4'},{n:'12,5',label:'Ton CO₂ sparet',color:'#F4831F'}].map((s,i)=>(
              <div key={i} style={{ background:'#f8f9fa', borderRadius:14, padding:'20px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:900, fontSize:32, color:s.color }}>{s.n}</div>
                <div style={{ fontSize:13, color:'#888', marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:20, padding:32, boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, marginBottom:16 }}>Fremtiden</h2>
          <p style={{ fontSize:14, color:'#555', lineHeight:1.75, marginBottom:12 }}>Vi arbejder konstant på at forbedre platformen og tilføje nye funktioner der gør det endnu nemmere for institutioner at handle bæredygtigt.</p>
          <p style={{ fontSize:14, color:'#555', lineHeight:1.75, marginBottom:20 }}>Vores mål er at blive den foretrukne platform for alle danske institutioner og at inspirere til lignende initiativer i resten af Norden.</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {['Miljøvenlig','Fællesskab','Innovation'].map((tag,i)=>(
              <span key={i} style={{ background:['#E8F5EE','#E8F0FB','#FEF0E3'][i], color:[PRIMARY,ACCENT2,ACCENT][i], borderRadius:99, padding:'5px 14px', fontSize:12, fontWeight:700 }}>{tag}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
