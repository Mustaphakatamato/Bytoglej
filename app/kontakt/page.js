'use client';
import { useState } from 'react';
import { PRIMARY } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

export default function KontaktPage() {
  const [open, setOpen] = useState(null);
  const w = useWindowWidth();
  const isMobile = w < 640;
  const faqs = [
    { q:'Hvem kan tilmelde sig byt&amp;leg?', a:'Alle CVR-registrerede institutioner i Danmark kan tilmelde sig. Det inkluderer vuggestuer, børnehaver, SFO\'er, folkeskoler, fritidsklubber og andre godkendte institutioner.' },
    { q:'Hvad koster det at bruge platformen?', a:'byt&amp;leg er gratis at bruge. Vi tager ingen kommission eller gebyrer for handler. Målet er at fremme bæredygtig genbrug i institutionssektoren.' },
    { q:'Hvordan verificeres min institution?', a:'Når du angiver dit CVR-nummer, slår vi det automatisk op i Erhvervsstyrelsens register. Vi bekræfter at jeres institution er aktiv og godkendt. Processen tager typisk 1-2 hverdage.' },
    { q:'Kan jeg sælge privat legetøj på platformen?', a:'Nej — byt&amp;leg er udelukkende for institutioner. Alt legetøj der handles på platformen skal tilhøre den pågældende institution og bruges i institutionsmæssig sammenhæng.' },
    { q:'Hvad sker der hvis et produkt ikke er som beskrevet?', a:'Vi opfordrer altid til at inspicere produktet inden betaling. Har I en tvist, kan I kontakte os via support, og vi vil hjælpe med mægling mellem institutionerne.' },
    { q:'Tilbyder I transport eller levering?', a:'Vi samarbejder med transportpartnere der kan levere legetøj mellem institutioner. Vælg "Valgfri transportservice" under en handel for at se priser og muligheder i jeres område.' },
    { q:'Hvordan sletter jeg min institutions konto?', a:'Kontakt os på support@legetoejsbyt.dk, så sørger vi for at slette alle jeres data i overensstemmelse med GDPR. Handler og beskeder anonymiseres og opbevares i op til 30 dage herefter.' },
  ];
  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:'#f8f9fa' }} className="page-enter">
      <div style={{ maxWidth:760, margin:'0 auto', padding:isMobile?'32px 16px 60px':'48px 24px 80px' }}>

        <div style={{ textAlign:'center', marginBottom:isMobile?32:48 }}>
          <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:900, fontSize:isMobile?28:38, letterSpacing:'-0.5px', marginBottom:10 }}>Kontakt os</h1>
          <p style={{ color:'#888', fontSize:16 }}>Vi er her for at hjælpe — skriv til os eller find svaret nedenfor</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?12:16, marginBottom:isMobile?32:48 }}>
          {[{icon:'✉️',title:'E-mail',val:'support@legetoejsbyt.dk',sub:'Svar inden for 1-2 hverdage'},{icon:'💬',title:'Chat',val:'Åbn beskeder på platformen',sub:'Tilgængelig for registrerede institutioner'}].map((c,i)=>(
            <div key={i} style={{ background:'#fff', borderRadius:16, padding:'24px', textAlign:'center', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>{c.icon}</div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{c.title}</div>
              <div style={{ fontSize:13, color:PRIMARY, fontWeight:600, marginBottom:4 }}>{c.val}</div>
              <div style={{ fontSize:12, color:'#999' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:24, marginBottom:20 }}>Ofte stillede spørgsmål</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {faqs.map((f,i) => (
            <div key={i} style={{ background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
              <button onClick={()=>setOpen(open===i?null:i)} style={{ width:'100%', background:'none', border:'none', padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', textAlign:'left', gap:12 }}>
                <span style={{ fontWeight:700, fontSize:14, color:'#1c1a17' }}>{f.q}</span>
                <span style={{ fontSize:20, color:'#aaa', flexShrink:0, transition:'transform 0.2s', transform:open===i?'rotate(45deg)':'rotate(0deg)' }}>+</span>
              </button>
              {open===i && (
                <div style={{ padding:'0 22px 18px', fontSize:14, color:'#555', lineHeight:1.75, borderTop:'1px solid #f0f0f0', paddingTop:14 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
