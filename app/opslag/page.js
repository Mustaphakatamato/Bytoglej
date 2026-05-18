'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { PRIMARY, LISTING_TAGS } from '@/lib/constants';

const CITIES = ['alle','Aarhus','København','Odense','Aalborg','Esbjerg','Randers','Vejle','Kolding'];
import { useWindowWidth, useDebounce, haversine } from '@/lib/hooks';
import { Btn, SkeletonCard } from '@/components/ui';
import ListingCard from '@/components/ListingCard';
import { useApp } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';

const MapContainer = dynamic(() => import('@/components/MapView'), { ssr: false });

const geoCache = {};
const NOM_HEADERS = { 'User-Agent': 'LegetojsByt/1.0 (kontakt@legetojsbyt.dk)', 'Accept-Language': 'da' };
async function geocodeCity(city) {
  if (geoCache[city]) return geoCache[city];
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city+', Danmark')}&format=json&limit=1&countrycodes=dk`, { headers: NOM_HEADERS });
    const d = await r.json();
    if (d[0]) { geoCache[city] = { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) }; return geoCache[city]; }
  } catch {}
  return null;
}

export default function OpslagPage() {
  const router = useRouter();
  const { listings, loadingListings: loading, setActiveListing, favs, toggleFav } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 640;
  const [filter, setFilter] = useState('alle');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('alle');
  const [sort, setSort] = useState('newest');
  const [maxDist, setMaxDist] = useState('alle');
  const [activeTags, setActiveTags] = useState([]);
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const tagDropRef = useRef(null);
  useEffect(() => {
    if (!tagDropOpen) return;
    function handleClick(e) { if (tagDropRef.current && !tagDropRef.current.contains(e.target)) setTagDropOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [tagDropOpen]);
  const [viewMode, setViewMode] = useState('list');
  const [userCoords, setUserCoords] = useState(null);
  const [userHasCoords, setUserHasCoords] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [listingCoords, setListingCoords] = useState({});
  const dSearch = useDebounce(search, 180);

  useEffect(() => {
    db.auth.getUser().then(async ({ data:{ user } }) => {
      if (!user) { setUserHasCoords(false); return; }
      const { data: inst } = await db.from('institutions').select('city,zipcode,latitude,longitude').eq('email', user.email).maybeSingle();
      if (!inst) { setUserHasCoords(false); return; }
      if (inst.latitude && inst.longitude) {
        setUserCoords({ lat: inst.latitude, lon: inst.longitude });
        setUserHasCoords(true);
        return;
      }
      setUserHasCoords(false);
      setGeoLoading(true);
      const q = inst.zipcode ? `${inst.zipcode} ${inst.city}, Danmark` : `${inst.city}, Danmark`;
      const coords = await geocodeCity(q);
      if (coords) setUserCoords(coords);
      setGeoLoading(false);
    });
  }, []);

  useEffect(() => {
    if (maxDist === 'alle' && viewMode !== 'map') return;
    const cities = [...new Set(listings.map(l => l.city).filter(Boolean))];
    cities.forEach(async c => {
      if (listingCoords[c]) return;
      const coords = await geocodeCity(c);
      if (coords) setListingCoords(prev => ({ ...prev, [c]: coords }));
    });
  }, [maxDist, viewMode, listings]);

  const filtered = useMemo(() => {
    let r = listings.filter(l => {
      const matchType   = filter==='alle' || l.type===filter;
      const matchCity   = city==='alle'   || l.city===city;
      const matchSearch = !dSearch || l.title.toLowerCase().includes(dSearch.toLowerCase()) || (l.institution_name||'').toLowerCase().includes(dSearch.toLowerCase()) || (l.tags||[]).some(t=>t.toLowerCase().includes(dSearch.toLowerCase()));
      const matchTag = activeTags.length === 0 || activeTags.every(t => (l.tags||[]).includes(t));
      let matchDist = true;
      if (maxDist !== 'alle' && userCoords && l.city) {
        const coords = listingCoords[l.city];
        if (coords) matchDist = haversine(userCoords.lat, userCoords.lon, coords.lat, coords.lon) <= Number(maxDist);
        else matchDist = true;
      }
      return matchType && matchCity && matchSearch && matchDist && matchTag;
    });
    if (sort==='newest')     r = [...r].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if (sort==='price-asc')  r = [...r].sort((a,b)=>(a.price||0)-(b.price||0));
    if (sort==='price-desc') r = [...r].sort((a,b)=>(b.price||0)-(a.price||0));
    if (sort==='bids')       r = [...r].sort((a,b)=>(b.bid_count||0)-(a.bid_count||0));
    if (maxDist !== 'alle' && userCoords) {
      r = [...r].sort((a,b) => {
        const ca = listingCoords[a.city], cb = listingCoords[b.city];
        const da = ca ? haversine(userCoords.lat, userCoords.lon, ca.lat, ca.lon) : 9999;
        const db2 = cb ? haversine(userCoords.lat, userCoords.lon, cb.lat, cb.lon) : 9999;
        return da - db2;
      });
    }
    return r;
  }, [listings, filter, city, dSearch, sort, maxDist, userCoords, listingCoords, activeTags]);

  function handleListingClick(l) {
    setActiveListing(l);
    router.push('/opslag/detail');
  }

  function goToInstitution(name) {
    router.push('/institution/' + encodeURIComponent(name));
  }

  return (
    <div style={{ minHeight:'100vh', paddingTop:68, background:'#fffcf8' }}>
      <div style={{ position:'sticky', top:68, zIndex:1000, background:'rgba(255,252,248,0.97)', borderBottom:'1px solid #f0eeeb', backdropFilter:'blur(14px)', padding:isMobile?'10px 12px':'14px 24px' }}>
        <div style={{ maxWidth:1140, margin:'0 auto', display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, background:'#f5f4f2', borderRadius:12, display:'flex', alignItems:'center', padding:'10px 14px', gap:10, border:'1.5px solid #eceae6' }}>
              <span style={{ color:'#bbb', fontSize:16 }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Søg i opslag..." style={{ border:'none', background:'transparent', outline:'none', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", flex:1, minWidth:0 }} />
              {search && <button onClick={()=>setSearch('')} style={{ border:'none', background:'none', color:'#bbb', fontSize:15 }}>✕</button>}
            </div>
            <div style={{ display:'flex', borderRadius:12, overflow:'hidden', border:'1.5px solid #e5e4e0', flexShrink:0 }}>
              {[['list','☰','Liste'],['map','🗺','Kort']].map(([mode, icon, label]) => (
                <button key={mode} onClick={()=>setViewMode(mode)}
                  style={{ padding:isMobile?'8px 12px':'9px 16px', border:'none', background:viewMode===mode?PRIMARY:'#f5f4f2', color:viewMode===mode?'#fff':'#666', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:5, transition:'all 0.15s', whiteSpace:'nowrap' }}>
                  {icon}{!isMobile && ' '+label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['alle','køb','byd','byt'].map(f => (
                <button key={f} onClick={()=>setFilter(f)} style={{ padding:isMobile?'7px 14px':'9px 18px', borderRadius:99, border:filter===f?'none':'1.5px solid #ddd', background:filter===f?PRIMARY:'#fff', color:filter===f?'#fff':'#555', fontSize:13, fontWeight:700, fontFamily:"'Nunito',sans-serif", transition:'all 0.15s', textTransform:'capitalize', whiteSpace:'nowrap' }}>{f}</button>
              ))}
            </div>
            <select value={city} onChange={e=>setCity(e.target.value)} style={{ padding:'8px 12px', borderRadius:12, border:'1.5px solid #eceae6', fontSize:13, background:'#f5f4f2', fontFamily:"'Nunito Sans',sans-serif", outline:'none' }}>
              {CITIES.map(c=><option key={c} value={c}>{c==='alle'?'Alle byer':c}</option>)}
            </select>
            {viewMode === 'list' && (
              <select value={sort} onChange={e=>setSort(e.target.value)} style={{ padding:'8px 12px', borderRadius:12, border:'1.5px solid #eceae6', fontSize:13, background:'#f5f4f2', fontFamily:"'Nunito Sans',sans-serif", outline:'none' }}>
                <option value="newest">Nyeste først</option>
                <option value="price-asc">Pris: lav → høj</option>
                <option value="price-desc">Pris: høj → lav</option>
                <option value="bids">Flest bud</option>
              </select>
            )}
            <div style={{ position:'relative' }}>
              <select value={maxDist} onChange={e=>setMaxDist(e.target.value)} style={{ padding:'10px 36px 10px 14px', borderRadius:12, border:`1.5px solid ${maxDist!=='alle'?PRIMARY:'#eceae6'}`, fontSize:14, background:maxDist!=='alle'?'#e8f5ee':'#f5f4f2', fontFamily:"'Nunito Sans',sans-serif", outline:'none', color:maxDist!=='alle'?PRIMARY:'#555', fontWeight:maxDist!=='alle'?700:400, appearance:'none', cursor:'pointer' }}>
                <option value="alle">📍 Afstand</option>
                <option value="5">Inden for 5 km</option>
                <option value="10">Inden for 10 km</option>
                <option value="25">Inden for 25 km</option>
                <option value="50">Inden for 50 km</option>
                <option value="100">Inden for 100 km</option>
              </select>
              {geoLoading && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:12 }}>⏳</span>}
              {!userCoords && maxDist!=='alle' && <div style={{ position:'absolute', top:'110%', left:0, background:'#fff', border:'1.5px solid #fca5a5', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#b91c1c', whiteSpace:'nowrap', zIndex:10, boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>Log ind for at bruge afstandsfilter</div>}
            </div>
            <div ref={tagDropRef} style={{ position:'relative' }}>
              <button onClick={()=>setTagDropOpen(o=>!o)}
                style={{ padding:'8px 14px', borderRadius:12, border:`1.5px solid ${activeTags.length?'#2563eb':'#eceae6'}`, background:activeTags.length?'#eff6ff':'#f5f4f2', fontSize:13, fontWeight:activeTags.length?700:400, color:activeTags.length?'#2563eb':'#555', cursor:'pointer', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
                🏷️ Kategorier
                {activeTags.length > 0 && <span style={{ background:'#2563eb', color:'#fff', borderRadius:99, padding:'1px 7px', fontSize:11, fontWeight:700 }}>{activeTags.length}</span>}
                <span style={{ fontSize:10, color:'#aaa' }}>{tagDropOpen ? '▲' : '▼'}</span>
              </button>
              {tagDropOpen && (
                <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:1000, background:'#fff', border:'1.5px solid #e5e5e5', borderRadius:14, boxShadow:'0 8px 28px rgba(0,0,0,0.12)', padding:12, minWidth:280 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'#555' }}>Vælg kategorier</span>
                    {activeTags.length > 0 && <button onClick={()=>setActiveTags([])} style={{ fontSize:11, fontWeight:700, color:'#2563eb', background:'none', border:'none', cursor:'pointer' }}>Ryd alle</button>}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {LISTING_TAGS.map(t => {
                      const sel = activeTags.includes(t);
                      return (
                        <button key={t} onClick={()=>setActiveTags(prev => sel ? prev.filter(x=>x!==t) : [...prev, t])}
                          style={{ padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, border:sel?'2px solid #2563eb':'1.5px solid #ddd', background:sel?'#eff6ff':'#f9f9f9', color:sel?'#2563eb':'#666', cursor:'pointer', transition:'all 0.12s' }}>
                          {sel ? '✓ ' : ''}{t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1140, margin:'0 auto', padding:isMobile?'16px 12px':'28px 24px' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:8 }}>
          <p style={{ color:'#999', fontSize:14, margin:0 }}>
            {loading ? 'Henter opslag…' : `${filtered.length} opslag`}{dSearch && ` for "${dSearch}"`}
            {viewMode === 'map' && !loading && <span style={{ marginLeft:8, fontSize:12, color:'#bbb' }}>— pins baseret på by</span>}
          </p>
        </div>

        {viewMode === 'map' ? (
          <MapContainer
            listings={filtered}
            listingCoords={listingCoords}
            userCoords={userCoords}
            onListingClick={handleListingClick}
            isMobile={isMobile}
          />
        ) : loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
            {[1,2,3,4,5,6].map(i=><SkeletonCard key={i}/>)}
          </div>
        ) : filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'#aaa' }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🔍</div>
            <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:20 }}>Ingen opslag fundet</div>
            <p style={{ marginTop:8, fontSize:15 }}>Prøv at ændre dine filtre</p>
            <Btn variant="outline" onClick={()=>{ setFilter('alle'); setSearch(''); setCity('alle'); setActiveTags([]); }} radius={22} style={{ marginTop:20, padding:'11px 24px' }}>Nulstil filtre</Btn>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
            {filtered.map(l=>(
              <ListingCard key={l.id} listing={l} favs={favs} toggleFav={toggleFav} onClick={()=>handleListingClick(l)} onInstitutionClick={goToInstitution} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
