'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, LISTING_TAGS } from '@/lib/constants';

const CITIES = ['alle','Aarhus','København','Odense','Aalborg','Esbjerg','Randers','Vejle','Kolding'];
import { useWindowWidth, useDebounce, haversine } from '@/lib/hooks';
import { Btn, SkeletonCard } from '@/components/ui';
import ListingCard from '@/components/ListingCard';
import { useApp } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';

const MapContainer = dynamic(() => import('@/components/MapView'), { ssr: false });

const FONT = "'Sora', sans-serif";

const geoCache = {};
const NOM_HEADERS = { 'User-Agent': 'BytogLeg/1.0 (support@bytogleg.dk)', 'Accept-Language': 'da' };
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
  const { listings, loadingListings: loading, setActiveListing, favs, toggleFav, showToast, loggedIn, setQuickViewListing } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 640;
  const [filter, setFilter] = useState('alle');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('alle');
  const [sort, setSort] = useState('newest');
  const [maxDist, setMaxDist] = useState('alle');
  const [activeTags, setActiveTags] = useState([]);
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const [saveSearchModal, setSaveSearchModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);
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
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('type');
    const c = params.get('city');
    const s = params.get('search');
    const tgs = params.get('tags');
    const md = params.get('maxDist');
    if (t && t !== 'alle') setFilter(t);
    if (c && c !== 'alle') setCity(c);
    if (s) setSearch(s);
    if (tgs) { try { setActiveTags(JSON.parse(tgs)); } catch {} }
    if (md && md !== 'alle') setMaxDist(md);
  }, []);

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
      const matchType   = filter === 'alle' || l.type === filter;
      const matchCity   = city === 'alle'   || l.city === city;
      const matchSearch = !dSearch || l.title.toLowerCase().includes(dSearch.toLowerCase()) || (l.institution_name||'').toLowerCase().includes(dSearch.toLowerCase()) || (l.tags||[]).some(t => t.toLowerCase().includes(dSearch.toLowerCase()));
      const matchTag = activeTags.length === 0 || activeTags.every(t => (l.tags||[]).includes(t));
      let matchDist = true;
      if (maxDist !== 'alle' && userCoords && l.city) {
        const coords = listingCoords[l.city];
        if (coords) matchDist = haversine(userCoords.lat, userCoords.lon, coords.lat, coords.lon) <= Number(maxDist);
        else matchDist = true;
      }
      return matchType && matchCity && matchSearch && matchDist && matchTag;
    });
    if (sort === 'newest')     r = [...r].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if (sort === 'price-asc')  r = [...r].sort((a,b) => (a.price||0) - (b.price||0));
    if (sort === 'price-desc') r = [...r].sort((a,b) => (b.price||0) - (a.price||0));
    if (sort === 'bids')       r = [...r].sort((a,b) => (b.bid_count||0) - (a.bid_count||0));
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

  async function handleSaveSearch() {
    if (!saveSearchName.trim()) return;
    setSavingSearch(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { setSavingSearch(false); return; }
      const { data: inst } = await db.from('institutions').select('id,name,email').ilike('email', user.email).maybeSingle();
      const filters = {};
      if (filter !== 'alle') filters.type = filter;
      if (city !== 'alle') filters.city = city;
      if (activeTags.length) filters.tags = activeTags;
      if (dSearch) filters.search = dSearch;
      if (maxDist !== 'alle') filters.maxDist = maxDist;
      const { error: insertErr } = await db.from('saved_searches').insert({
        institution_id: inst?.id || null,
        email: user.email,
        institution_name: inst?.name || null,
        name: saveSearchName.trim(),
        filters,
      });
      if (insertErr) { showToast?.('Fejl: ' + insertErr.message, 'error'); setSavingSearch(false); return; }
      showToast?.('Søgning gemt! Slå notifikationer til på dit dashboard 🔔');
    } catch {}
    setSavingSearch(false);
    setSaveSearchModal(false);
    setSaveSearchName('');
  }

  function handleListingClick(l) {
    setQuickViewListing(l);
  }

  function goToInstitution(name) {
    router.push('/institution/' + encodeURIComponent(name));
  }

  const selectStyle = {
    padding: '8px 12px', borderRadius: 99, border: `1.5px solid ${PAPER3}`,
    fontSize: 13, background: PAPER2, fontFamily: FONT, outline: 'none',
    color: INK2, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>

      {/* ── Compact header ── */}
      <div style={{
        background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
        paddingTop: 108, paddingBottom: 48,
        textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 160 : 260, color: 'rgba(255,255,255,0.04)', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>byt</span>
        </div>
        <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '5px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            Markedsplads
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 40, letterSpacing: '-0.04em', color: '#fff', marginBottom: 10, lineHeight: 1.1 }}>
            Find legetøj til jeres institution
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            Køb, byd eller byt direkte med andre verificerede institutioner
          </p>
        </div>
        <svg viewBox="0 0 1440 48" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
          <path d="M0,24 C360,48 1080,0 1440,24 L1440,48 L0,48 Z" fill={PAPER} />
        </svg>
      </div>

      {/* ── Sticky filter bar ── */}
      <div style={{
        position: 'sticky', top: 68, zIndex: 100,
        background: `rgba(246,242,234,0.97)`,
        borderBottom: `1px solid ${PAPER2}`,
        backdropFilter: 'blur(16px)',
        padding: isMobile ? '10px 14px' : '12px 24px',
      }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Search + view toggle row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              flex: 1, background: PAPER2, borderRadius: 99,
              display: 'flex', alignItems: 'center', padding: '9px 16px', gap: 10,
              border: `1.5px solid ${PAPER3}`,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                <circle cx="6" cy="6" r="5" stroke={INK} strokeWidth="1.5"/>
                <path d="M10 10L13 13" stroke={INK} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Søg opslag, institution eller kategori..."
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: FONT, flex: 1, minWidth: 0, color: INK }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', color: INK3, fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
              )}
            </div>
            <div style={{ display: 'flex', borderRadius: 99, overflow: 'hidden', border: `1.5px solid ${PAPER3}`, flexShrink: 0 }}>
              {[['list', 'Liste'], ['map', 'Kort']].map(([mode, label]) => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{
                  padding: isMobile ? '8px 12px' : '8px 18px',
                  border: 'none',
                  background: viewMode === mode ? PRIMARY : PAPER2,
                  color: viewMode === mode ? '#fff' : INK3,
                  fontWeight: 700, fontSize: 13, fontFamily: FONT,
                  cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter pills row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Type filter */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'alle', label: 'Alle' },
                { key: 'køb',  label: TYPE_CFG.køb.label },
                { key: 'byd',  label: TYPE_CFG.byd.label },
                { key: 'byt',  label: TYPE_CFG.byt.label },
              ].map(({ key, label }) => {
                const active = filter === key;
                const tc = key !== 'alle' ? TYPE_CFG[key] : null;
                return (
                  <button key={key} onClick={() => setFilter(key)} style={{
                    padding: isMobile ? '6px 14px' : '7px 16px',
                    borderRadius: 99,
                    border: active ? 'none' : `1.5px solid ${PAPER3}`,
                    background: active ? (tc ? tc.color : PRIMARY) : PAPER2,
                    color: active ? (key === 'køb' ? '#fff' : key === 'byd' ? '#fff' : '#fff') : INK2,
                    fontSize: 13, fontWeight: 700, fontFamily: FONT,
                    transition: 'all 0.15s', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* City select */}
            <div style={{ position: 'relative' }}>
              <select value={city} onChange={e => setCity(e.target.value)} style={selectStyle}>
                {CITIES.map(c => <option key={c} value={c}>{c === 'alle' ? 'Alle byer' : c}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: INK3, pointerEvents: 'none' }}>▼</span>
            </div>

            {/* Sort */}
            {viewMode === 'list' && (
              <div style={{ position: 'relative' }}>
                <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
                  <option value="newest">Nyeste</option>
                  <option value="price-asc">Pris ↑</option>
                  <option value="price-desc">Pris ↓</option>
                  <option value="bids">Flest bud</option>
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: INK3, pointerEvents: 'none' }}>▼</span>
              </div>
            )}

            {/* Distance */}
            <div style={{ position: 'relative' }}>
              <select value={maxDist} onChange={e => setMaxDist(e.target.value)} style={{
                ...selectStyle,
                border: `1.5px solid ${maxDist !== 'alle' ? PRIMARY : PAPER3}`,
                background: maxDist !== 'alle' ? GREEN_TINT : PAPER2,
                color: maxDist !== 'alle' ? PRIMARY : INK2,
                fontWeight: maxDist !== 'alle' ? 700 : 400,
              }}>
                <option value="alle">Afstand</option>
                <option value="5">Inden for 5 km</option>
                <option value="10">Inden for 10 km</option>
                <option value="25">Inden for 25 km</option>
                <option value="50">Inden for 50 km</option>
                <option value="100">Inden for 100 km</option>
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: maxDist !== 'alle' ? PRIMARY : INK3, pointerEvents: 'none' }}>▼</span>
              {!userCoords && maxDist !== 'alle' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: PAPER, border: `1.5px solid ${CORAL}`, borderRadius: 10, padding: '8px 12px', fontSize: 12, color: CORAL, fontFamily: FONT, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 10 }}>
                  Log ind for at bruge afstandsfilter
                </div>
              )}
            </div>

            {/* Tags dropdown */}
            <div ref={tagDropRef} style={{ position: 'relative' }}>
              <button onClick={() => setTagDropOpen(o => !o)} style={{
                padding: '7px 14px', borderRadius: 99,
                border: `1.5px solid ${activeTags.length ? PRIMARY : PAPER3}`,
                background: activeTags.length ? GREEN_TINT : PAPER2,
                fontSize: 13, fontWeight: activeTags.length ? 700 : 500,
                color: activeTags.length ? PRIMARY : INK2,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: FONT, whiteSpace: 'nowrap',
              }}>
                Kategorier
                {activeTags.length > 0 && (
                  <span style={{ background: PRIMARY, color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{activeTags.length}</span>
                )}
                <span style={{ fontSize: 9, color: activeTags.length ? PRIMARY : INK3 }}>{tagDropOpen ? '▲' : '▼'}</span>
              </button>
              {tagDropOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000,
                  background: PAPER, border: `1.5px solid ${PAPER2}`,
                  borderRadius: 16, padding: 14, minWidth: 280,
                  boxShadow: '0 12px 40px rgba(22,34,28,0.12)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: INK2, fontFamily: FONT }}>Vælg kategorier</span>
                    {activeTags.length > 0 && (
                      <button onClick={() => setActiveTags([])} style={{ fontSize: 11, fontWeight: 700, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>Ryd alle</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {LISTING_TAGS.map(t => {
                      const sel = activeTags.includes(t);
                      return (
                        <button key={t} onClick={() => setActiveTags(prev => sel ? prev.filter(x => x !== t) : [...prev, t])}
                          style={{
                            padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, fontFamily: FONT,
                            border: sel ? `2px solid ${PRIMARY}` : `1.5px solid ${PAPER3}`,
                            background: sel ? GREEN_TINT : PAPER2,
                            color: sel ? PRIMARY : INK3, cursor: 'pointer', transition: 'all 0.12s',
                          }}>
                          {t}
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

      {/* ── Listings ── */}
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: isMobile ? '20px 14px 40px' : '28px 24px 60px' }}>

        {/* Result count */}
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ color: INK3, fontSize: 13, margin: 0, fontFamily: FONT }}>
            {loading ? 'Henter opslag…' : `${filtered.length} opslag`}
            {dSearch && <span> for "<strong style={{ color: INK2 }}>{dSearch}</strong>"</span>}
            {viewMode === 'map' && !loading && <span style={{ marginLeft: 8, fontSize: 12 }}>— pins baseret på by</span>}
          </p>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {(filter !== 'alle' || city !== 'alle' || activeTags.length || maxDist !== 'alle' || dSearch) && (
              <button onClick={() => { setFilter('alle'); setSearch(''); setCity('alle'); setActiveTags([]); setMaxDist('alle'); }} style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0 }}>
                Nulstil filtre
              </button>
            )}
            {loggedIn && (filter !== 'alle' || city !== 'alle' || activeTags.length || maxDist !== 'alle' || dSearch) && (
              <button onClick={() => setSaveSearchModal(true)} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: PRIMARY, border: 'none', borderRadius: 99, cursor: 'pointer', fontFamily: FONT, padding: '5px 14px', display:'flex', alignItems:'center', gap:5 }}>
                🔔 Gem søgning
              </button>
            )}
          </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
            {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0 120px' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 60 : 96, color: GREEN_SOFT, lineHeight: 1, letterSpacing: '-0.05em', marginBottom: 12, userSelect: 'none' }}>0</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 20 : 26, color: INK, marginBottom: 8, letterSpacing: '-0.03em' }}>Ingen opslag fundet</div>
            <p style={{ fontSize: 15, color: INK3, marginBottom: 28 }}>Prøv at ændre eller nulstille dine filtre</p>
            <button onClick={() => { setFilter('alle'); setSearch(''); setCity('alle'); setActiveTags([]); setMaxDist('alle'); }} style={{
              background: 'none', border: `1.5px solid ${PRIMARY}`, color: PRIMARY,
              borderRadius: 99, padding: '10px 24px', fontSize: 14, fontWeight: 700,
              fontFamily: FONT, cursor: 'pointer',
            }}>
              Nulstil filtre
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
            {filtered.map(l => (
              <ListingCard key={l.id} listing={l} favs={favs} toggleFav={toggleFav} onClick={() => handleListingClick(l)} onInstitutionClick={goToInstitution} />
            ))}
          </div>
        )}
      </div>

      {saveSearchModal && (
        <div onClick={()=>setSaveSearchModal(false)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#FDFAF4', borderRadius:20, padding:28, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:'#16221C', marginBottom:8, marginTop:0 }}>Gem søgning 🔔</h2>
            <p style={{ fontSize:13, color:'#6B7570', marginBottom:20, fontFamily:FONT }}>Gem dine aktive filtre. Du kan slå e-mail-notifikationer til/fra på dit dashboard.</p>
            <label style={{ display:'block', fontFamily:FONT, fontWeight:700, fontSize:13, color:'#3A473D', marginBottom:6 }}>Navn på søgning</label>
            <input
              value={saveSearchName}
              onChange={e=>setSaveSearchName(e.target.value)}
              placeholder="Fx: Udeleg under 100 kr."
              style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid #DAD3C4', background:'#ECE6DA', fontSize:14, fontFamily:FONT, color:'#16221C', outline:'none', boxSizing:'border-box', marginBottom:16 }}
            />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setSaveSearchModal(false)} style={{ flex:1, padding:'12px', borderRadius:12, background:'#ECE6DA', border:'none', fontWeight:700, cursor:'pointer', fontFamily:FONT, fontSize:14, color:'#3A473D' }}>Annuller</button>
              <button onClick={handleSaveSearch} disabled={savingSearch||!saveSearchName.trim()} style={{ flex:2, padding:'12px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontWeight:700, cursor:savingSearch||!saveSearchName.trim()?'not-allowed':'pointer', opacity:savingSearch||!saveSearchName.trim()?0.6:1, fontFamily:FONT, fontSize:14 }}>
                {savingSearch ? 'Gemmer…' : '🔔 Gem søgning'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
