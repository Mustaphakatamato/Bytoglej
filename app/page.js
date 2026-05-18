'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, ACCENT, ACCENT2 } from '@/lib/constants';
import { useWindowWidth, useDebounce } from '@/lib/hooks';
import { Btn, SkeletonCard } from '@/components/ui';
import ListingCard from '@/components/ListingCard';
import { useApp } from '@/providers/AppProvider';

function HeroSection() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;
  return (
    <section style={{ background:'linear-gradient(135deg,#a8d5c2 0%,#7bbfaa 60%,#5eab94 100%)', padding:isMobile?'100px 20px 60px':'120px 24px 80px', overflow:'hidden', position:'relative' }}>
      <div style={{ maxWidth:1140, margin:'0 auto', display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?32:64, alignItems:'center' }}>
        <div className="page-enter">
          <h1 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:isMobile?'clamp(32px,9vw,48px)':'clamp(36px,5vw,60px)', lineHeight:1.1, letterSpacing:'-1.5px', marginBottom:16, color:'#1a3a2e' }}>
            Byt, køb og sælg<br/>legetøj<br/><span style={{ color:'#2d6a4f' }}>nemt mellem<br/>institutioner</span>
          </h1>
          <p style={{ fontSize:isMobile?15:16, color:'#2d5045', lineHeight:1.7, marginBottom:28, maxWidth:440 }}>
            Den første markedsplads hvor børnehaver, skoler og SFO'er kan handle legetøj og udstyr bæredygtigt. Spar penge, hjælp miljøet og giv legetøj nyt liv.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <Btn variant="primary" color="#2d6a4f" radius={22} onClick={()=>router.push('/signup')} style={{ padding:isMobile?'13px 22px':'14px 28px', fontSize:15, boxShadow:'0 4px 18px rgba(45,106,79,0.35)' }}>🚀 Kom i gang nu</Btn>
            <button onClick={()=>router.push('/hvordan')} style={{ background:'rgba(255,255,255,0.35)', border:'1.5px solid rgba(255,255,255,0.6)', borderRadius:22, padding:isMobile?'13px 18px':'14px 24px', fontSize:15, fontWeight:700, color:'#1a3a2e', cursor:'pointer', display:'flex', alignItems:'center', gap:8, backdropFilter:'blur(8px)', fontFamily:"'Nunito Sans',sans-serif" }}>▷ Se hvordan det virker</button>
          </div>
        </div>

        {!isMobile && (
          <div style={{ position:'relative' }}>
            <div style={{ borderRadius:24, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', aspectRatio:'4/3' }}>
              <img src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=680&auto=format&fit=crop&q=80" alt="Legetøj og kreative aktiviteter" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            </div>
            <div style={{ position:'absolute', top:-14, left:-14, background:'#fff', borderRadius:14, padding:'10px 16px', boxShadow:'0 8px 28px rgba(0,0,0,0.12)', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>🛡️</span>
              <div>
                <div style={{ fontWeight:700, fontSize:12, color:PRIMARY }}>Verificerede</div>
                <div style={{ fontSize:11, color:'#888' }}>institutioner</div>
              </div>
            </div>
            <div style={{ position:'absolute', bottom:-14, right:-14, background:'#fff', borderRadius:14, padding:'10px 16px', boxShadow:'0 8px 28px rgba(0,0,0,0.12)', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>♻️</span>
              <div>
                <div style={{ fontWeight:700, fontSize:12, color:ACCENT }}>100% bæredygtig</div>
                <div style={{ fontSize:11, color:'#888' }}>genbrug</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HowSection() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 640;
  const steps = [
    { icon:'👤', n:'1', title:'Tilmeld din institution', desc:'Opret en verificeret profil for din børnehave, skole eller SFO med CVR-nummer' },
    { icon:'📷', n:'2', title:'Upload legetøj', desc:'Tag billeder af legetøj I ikke bruger og opret annoncer med pris eller bytteønsker' },
    { icon:'🤝', n:'3', title:'Køb, byt eller byd', desc:'Find perfekt legetøj til jeres børn og gennemfør sikre handler mellem institutioner' },
  ];
  return (
    <section style={{ padding:isMobile?'60px 20px':'80px 24px', background:'#fff' }}>
      <div style={{ maxWidth:1140, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:isMobile?36:56 }}>
          <h2 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:'clamp(22px,3.5vw,38px)', letterSpacing:'-0.5px', marginBottom:10 }}>Sådan fungerer Legetøjsbyt.dk</h2>
          <p style={{ color:'#888', fontSize:15 }}>En simpel og sikker måde for institutioner at dele ressourcer på</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:isMobile?28:40, textAlign:'center' }}>
          {steps.map((s,i) => (
            <div key={i} style={{ animation:`slideUp 0.45s ease ${i*0.1}s both`, display:isMobile?'flex':'block', alignItems:isMobile?'flex-start':'', textAlign:isMobile?'left':'center', gap:isMobile?16:0 }}>
              <div style={{ width:60, height:60, borderRadius:'50%', background:'#e8f5ee', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:isMobile?'0':'0 auto 16px', flexShrink:0 }}>{s.icon}</div>
              <div>
                <h3 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:17, marginBottom:8 }}>{s.n}. {s.title}</h3>
                <p style={{ color:PRIMARY, fontSize:13, lineHeight:1.65, maxWidth:isMobile?'none':240, margin:isMobile?0:'0 auto' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ListingsPreview({ listings, loading, goToInstitution }) {
  const router = useRouter();
  const { setActiveListing, favs, toggleFav } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('alle');
  const w = useWindowWidth();
  const isMobile = w < 640;
  const dSearch = useDebounce(search, 180);
  const shown = useMemo(() => {
    let r = listings;
    if (filter !== 'alle') r = r.filter(l => l.type === filter);
    if (dSearch) r = r.filter(l => l.title.toLowerCase().includes(dSearch.toLowerCase()) || (l.institution_name||'').toLowerCase().includes(dSearch.toLowerCase()));
    return r.slice(0, 4);
  }, [listings, filter, dSearch]);

  return (
    <section style={{ padding:isMobile?'48px 16px':'80px 24px', background:'#f5f6f7' }}>
      <div style={{ maxWidth:1140, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:8, flexWrap:'wrap', gap:12 }}>
          <div>
            <h2 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:'clamp(24px,3vw,36px)', letterSpacing:'-0.5px', marginBottom:4 }}>Markedsplads</h2>
            <p style={{ color:'#888', fontSize:14 }}>Udforsk tusindvis af legetøj fra verificerede institutioner</p>
          </div>
          <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>router.push('/opslag')} style={{ padding:'11px 22px', fontSize:14, whiteSpace:'nowrap' }}>Se alle annoncer</Btn>
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:'14px 20px', display:'flex', gap:12, marginBottom:28, boxShadow:'0 1px 8px rgba(0,0,0,0.06)', flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Søg efter legetøj, kategori eller institution..." style={{ flex:1, minWidth:200, border:'none', outline:'none', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", color:'#333' }} />
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ border:'1px solid #e5e5e5', borderRadius:10, padding:'8px 14px', fontSize:13, fontFamily:"'Nunito Sans',sans-serif", color:'#555', outline:'none', background:'#fff' }}>
            <option value="alle">Alle kategorier</option>
            <option value="køb">Køb</option>
            <option value="byd">Byd</option>
            <option value="byt">Byt</option>
          </select>
          <select style={{ border:'1px solid #e5e5e5', borderRadius:10, padding:'8px 14px', fontSize:13, fontFamily:"'Nunito Sans',sans-serif", color:'#555', outline:'none', background:'#fff' }}>
            <option>Afstand</option>
          </select>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))', gap:20 }}>
          {loading ? [1,2,3,4].map(i=><SkeletonCard key={i}/>) : shown.map(l=>(
            <ListingCard key={l.id} listing={l} favs={favs} toggleFav={toggleFav} onClick={()=>{ setActiveListing(l); router.push('/opslag/detail'); }} onInstitutionClick={goToInstitution} />
          ))}
        </div>

        <div style={{ textAlign:'center', marginTop:36 }}>
          <Btn variant="primary" color={PRIMARY} radius={99} onClick={()=>router.push('/opslag')} style={{ padding:'13px 36px', fontSize:15 }}>Se alle {listings.length} annoncer</Btn>
        </div>
      </div>
    </section>
  );
}

function MissionSection() {
  const w = useWindowWidth();
  const isMobile = w < 768;
  const points = [
    { icon:'🛡️', color:'#e8f5ee', title:'Sikker handel', desc:'Kun verificerede institutioner med CVR-nummer' },
    { icon:'💛', color:'#fff9e6', title:'Spar penge', desc:'Få kvalitetslegetøj til en brøkdel af nyprisen' },
    { icon:'♻️', color:'#e8f5ee', title:'Bæredygtighed', desc:'Fremm genbrug og hjælp miljøet' },
    { icon:'🚚', color:'#fff3e8', title:'Transport service', desc:'Valgfri levering direkte til jeres institution' },
  ];
  return (
    <section style={{ padding:isMobile?'60px 20px':'80px 24px', background:'#fff' }}>
      <div style={{ maxWidth:1140, margin:'0 auto', display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?32:64, alignItems:'center' }}>
        <div>
          <h2 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:'clamp(24px,3.5vw,42px)', letterSpacing:'-0.5px', marginBottom:14 }}>Vores mission</h2>
          <p style={{ color:'#555', fontSize:15, lineHeight:1.75, marginBottom:28 }}>Vi tror på en fremtid hvor legetøj får flere liv. Legetøjsbyt.dk forbinder danske institutioner i et bæredygtigt fællesskab, hvor ressourcer deles og miljøet passes på.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {points.map((p,i) => (
              <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:p.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{p.icon}</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{p.title}</div>
                  <div style={{ fontSize:13, color:'#888' }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isMobile && (
          <div style={{ position:'relative' }}>
            <div style={{ borderRadius:24, overflow:'hidden', boxShadow:'0 16px 48px rgba(0,0,0,0.12)', aspectRatio:'4/3' }}>
              <img src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=680&auto=format&fit=crop&q=80" alt="Klasseværelse" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            </div>
            <div style={{ position:'absolute', top:-16, right:-16, background:'#fff', borderRadius:16, padding:'14px 20px', boxShadow:'0 8px 28px rgba(0,0,0,0.12)', textAlign:'center' }}>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:28, color:ACCENT2 }}>156</div>
              <div style={{ fontSize:12, color:'#888' }}>institutioner tilmeldt</div>
            </div>
            <div style={{ position:'absolute', bottom:-16, left:-16, background:'#fff', borderRadius:16, padding:'14px 20px', boxShadow:'0 8px 28px rgba(0,0,0,0.12)', textAlign:'center' }}>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:28, color:PRIMARY }}>2.847</div>
              <div style={{ fontSize:12, color:'#888' }}>handler gennemført</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 640;
  return (
    <footer style={{ background:'#1c1a17', color:'#888', padding:isMobile?'48px 20px 28px':'60px 24px 36px' }}>
      <div style={{ maxWidth:1140, margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'2fr 1fr 1fr 1fr', gap:isMobile?'28px 16px':48, marginBottom:40 }}>
          <div style={{ gridColumn:isMobile?'1 / -1':'auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center' }}>♻️</div>
              <span style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:18, color:'#fff' }}>LegetøjsByt</span>
            </div>
            <p style={{ fontSize:14, lineHeight:1.65, maxWidth:260 }}>Danmarks markedsplads for brugt institutionslegetøj. CVR-verificeret og bæredygtigt.</p>
          </div>
          {[{title:'Platform',links:[['opslag','Markedsplads'],['hvordan','Sådan virker det']]},{title:'Support',links:[['kontakt','Kontakt os'],['kontakt','FAQ']]},{title:'Om os',links:[['om-os','Om LegetøjsByt'],['om-os','Vores værdier']]}].map((col,i) => (
            <div key={i}>
              <div style={{ color:'#fff', fontWeight:700, fontSize:14, marginBottom:14 }}>{col.title}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {col.links.map(([p,l]) => <a key={l} onClick={()=>router.push('/'+p)} style={{ color:'#666', fontSize:14, cursor:'pointer', transition:'color 0.15s' }}>{l}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid #2a2a2a', paddingTop:24, display:'flex', justifyContent:'space-between', fontSize:13, flexWrap:'wrap', gap:12 }}>
          <span>© 2025 LegetøjsByt ApS</span>
          <span>Lavet med ♻️ i Danmark</span>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { listings, loadingListings } = useApp();

  function goToInstitution(name) {
    router.push('/institution/' + encodeURIComponent(name));
  }

  return (
    <>
      <HeroSection />
      <HowSection />
      <ListingsPreview listings={listings} loading={loadingListings} goToInstitution={goToInstitution} />
      <MissionSection />
      <Footer />
    </>
  );
}
