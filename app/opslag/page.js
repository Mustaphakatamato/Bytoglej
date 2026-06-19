'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, URGENCY_OPTIONS, FONT } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import { useWindowWidth, useFeedListings } from '@/lib/hooks';
import { Btn, SkeletonCard, SkeletonMobileCard } from '@/components/ui';
import ListingCard, { calcServiceFee, BuyerProtectionPopup } from '@/components/ListingCard';
import PullToRefresh from '@/components/PullToRefresh';
import ImageSearchModal from '@/components/ImageSearchModal';
import { useApp } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { authedFetch } from '@/lib/authed-fetch';


function MobileListingCard({ l, isFav, onToggleFav, onOpen }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [showFeePopup, setShowFeePopup] = useState(false);
  const imgs = l.images?.length ? l.images : [];
  const hasMultiple = imgs.length > 1;
  const startX = useRef(0);
  const moved = useRef(false);

  function onTouchStart(e) { startX.current = e.touches[0].clientX; moved.current = false; }
  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40 && hasMultiple) {
      moved.current = true;
      setImgIdx(i => dx < 0 ? (i+1)%imgs.length : (i-1+imgs.length)%imgs.length);
    }
  }

  return (
    <div onClick={e => { if (moved.current) { moved.current = false; return; } onOpen(); }} style={{ borderRadius: 12, overflow: 'hidden', background: '#fff', cursor: 'pointer', border: '1px solid rgba(22,34,28,0.07)', boxShadow: '0 1px 4px rgba(22,34,28,0.05)' }}>
      <div style={{ aspectRatio: '3/4', background: GREEN_TINT, position: 'relative', overflow: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {imgs.length > 0
          ? <img src={imgs[imgIdx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, opacity: 0.6 }}>{l.emoji || '🧸'}</div>}
        {hasMultiple && <>
          <button onClick={e=>{ e.stopPropagation(); setImgIdx(i=>(i-1+imgs.length)%imgs.length); }} style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:28, height:28, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, zIndex:5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={e=>{ e.stopPropagation(); setImgIdx(i=>(i+1)%imgs.length); }} style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:28, height:28, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, zIndex:5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <div style={{ position:'absolute', bottom:42, left:'50%', transform:'translateX(-50%)', display:'flex', gap:4, zIndex:5 }}>
            {imgs.map((_,i)=><div key={i} style={{ width:6, height:6, borderRadius:'50%', background: i===imgIdx?'#fff':'rgba(255,255,255,0.5)', transition:'background 0.2s' }}/>)}
          </div>
        </>}
        <button onClick={async e => { e.stopPropagation(); onToggleFav(l.id); }} style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', cursor: 'pointer', zIndex: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? '#e11d48' : 'none'} stroke={isFav ? '#e11d48' : '#888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{l.title}</div>
        {l.price
          ? (() => {
              const fee = calcServiceFee(l.price);
              const total = l.price + fee;
              return (
                <div>
                  <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginBottom:1 }}>{l.price} kr.</div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:INK }}>{total.toFixed(2).replace('.',',')} kr. inkl.</span>
                    <button onClick={e=>{ e.stopPropagation(); setShowFeePopup(true); }} style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="#2D6A4F" opacity="0.85"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                  {showFeePopup && <BuyerProtectionPopup price={l.price} fee={fee} image={l.images?.[0]} emoji={l.emoji} onClose={() => setShowFeePopup(false)} />}
                </div>
              );
            })()
          : <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: CORAL }}>Byttes kun</div>}
        {l.condition && <div style={{ fontSize: 11, color: INK3, marginTop: 2 }}>{l.condition}</div>}
        {(() => {
          const so = l.shipping_options?.[0];
          const badges = [];
          if (so?.allow_pickup) badges.push('📍');
          if (so?.allow_shipping || (!so && l.can_ship)) badges.push('📦');
          if (so?.allow_custom) badges.push('🤝');
          if (!badges.length) return null;
          return <div style={{ fontSize: 11, color: INK3, marginTop: 2 }}>{badges.join('  ')}</div>;
        })()}
      </div>
    </div>
  );
}

/* ── Mobile category browser (Vinted-style equal boxes) ──── */
function CategoryBrowser({ onSelect }) {
  return (
    <div style={{ padding: '8px 8px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={() => onSelect('')} style={{
          background: '#fff', border: '1px solid rgba(22,34,28,0.07)',
          borderRadius: 16, padding: '20px 16px', height: 96,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          cursor: 'pointer', boxShadow: '0 1px 4px rgba(22,34,28,0.05)',
          fontFamily: FONT, textAlign: 'left', gridColumn: '1 / -1',
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: INK, lineHeight: 1.25, flex: 1 }}>Alle kategorier</span>
          <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0, marginLeft: 4, alignSelf: 'flex-end' }}>🧸</span>
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => onSelect(cat.key)} style={{
            background: '#fff', border: '1px solid rgba(22,34,28,0.07)',
            borderRadius: 16, padding: '20px 16px', height: 96,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            cursor: 'pointer', boxShadow: '0 1px 4px rgba(22,34,28,0.05)',
            fontFamily: FONT, textAlign: 'left', position: 'relative', overflow: 'hidden',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: INK, lineHeight: 1.25, flex: 1, zIndex: 1 }}>{cat.label}</span>
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0, marginLeft: 4, alignSelf: 'flex-end' }}>{cat.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Mobile subcategory list (Vinted-style rows) ─────────── */
function SubcategoryBrowser({ categoryKey, onBack, onSelectAll, onSelectSub }) {
  const cat = CATEGORIES.find(c => c.key === categoryKey);
  if (!cat) return null;

  const rowStyle = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', background: 'none', border: 'none', borderBottom: `1px solid ${PAPER2}`,
    cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
  };

  return (
    <div>
      <button onClick={onBack} style={{ ...rowStyle, borderBottom: `2px solid ${PAPER2}`, paddingTop: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          <span style={{ fontWeight: 800, fontSize: 16, color: INK }}>{cat.emoji} {cat.label}</span>
        </div>
      </button>

      <button onClick={onSelectAll} style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: GREEN_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⊞</div>
          <span style={{ fontWeight: 600, fontSize: 15, color: INK }}>Alle {cat.label}</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      {cat.sub.map(sub => (
        <button key={sub} onClick={() => onSelectSub(sub)} style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: PAPER2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              {cat.emoji}
            </div>
            <span style={{ fontWeight: 500, fontSize: 15, color: INK }}>{sub}</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      ))}
    </div>
  );
}

function SøgesCard({ l, onContact }) {
  const urgency = URGENCY_OPTIONS.find(u => u.key === l.urgency) || URGENCY_OPTIONS[2];
  const catObj = CATEGORIES.find(c => c.key === l.category);

  return (
    <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid #EDE9FE`, boxShadow:'0 2px 8px rgba(124,58,237,0.06)', padding:'18px 20px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'#F5F0FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🔍</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{l.title}</div>
            <div style={{ fontSize:11, color:'#7C3AED', fontFamily:FONT, fontWeight:600, marginTop:2 }}>{l.institution_name || 'Ukendt institution'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4, background: urgency.key==='haster'?'#FEF2F2': urgency.key==='måneden'?'#FFFBEB':'#F0FDF4', borderRadius:99, padding:'3px 10px', flexShrink:0, whiteSpace:'nowrap' }}>
          <span style={{ fontSize:11 }}>{urgency.emoji}</span>
          <span style={{ fontSize:11, fontWeight:700, fontFamily:FONT, color: urgency.key==='haster'?'#DC2626': urgency.key==='måneden'?'#D97706':'#16A34A' }}>{urgency.label}</span>
        </div>
      </div>

      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {catObj && <span style={{ fontSize:11, fontWeight:600, color:INK3, background:PAPER2, borderRadius:99, padding:'3px 10px', fontFamily:FONT }}>{catObj.emoji} {catObj.label}</span>}
        {l.age_group && <span style={{ fontSize:11, fontWeight:600, color:INK3, background:PAPER2, borderRadius:99, padding:'3px 10px', fontFamily:FONT }}>{l.age_group}</span>}
        {l.condition && <span style={{ fontSize:11, fontWeight:600, color:INK3, background:PAPER2, borderRadius:99, padding:'3px 10px', fontFamily:FONT }}>{l.condition}+</span>}
        {l.price > 0 && <span style={{ fontSize:11, fontWeight:700, color:'#7C3AED', background:'#EDE9FE', borderRadius:99, padding:'3px 10px', fontFamily:FONT }}>Budget: {l.price} kr.</span>}
      </div>

      {l.description && (
        <div style={{ fontSize:12, color:INK3, fontFamily:FONT, lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{l.description}</div>
      )}

      <button onClick={onContact} style={{ marginTop:2, padding:'10px', borderRadius:99, background:'#7C3AED', color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer', textAlign:'center' }}>
        Vi har noget der matcher →
      </button>
    </div>
  );
}

function OpslagInner() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const { listings: allListings, loadingListings: loading, fetchListings, refreshSeed, setActiveListing, favs, toggleFav, showToast, loggedIn, realUserId, institution, loadMoreListings, hasMore, loadingMore, imgSearchOpen, setImgSearchOpen } = useApp();
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMoreListings();
    }, { rootMargin: '200px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMoreListings]);
  const ownFiltered = allListings.filter(l =>
    l.user_id !== realUserId && !(institution?.name && l.institution_name === institution.name)
  );
  const listings = useFeedListings(ownFiltered, refreshSeed);
  const ww = useWindowWidth();
  const isMobile = ww < 640;
  const [mainTab, setMainTab] = useState('opslag');
  const [filter, setFilter] = useState('alle');
  const [sort, setSort] = useState('newest');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [pendingCategory, setPendingCategory] = useState('');
  const [browserDismissed, setBrowserDismissed] = useState(false);
const [saveSearchModal, setSaveSearchModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiKind, setAiKind] = useState('text'); // 'text' | 'image'
  const [imgSearching, setImgSearching] = useState(false);
  const aiInputRef = useRef(null);
  const [followedNames, setFollowedNames] = useState(null);
  const [showFollowed, setShowFollowed] = useState(false);

  useEffect(() => {
    db.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      db.from('institution_follows').select('institution_name').eq('follower_user_id', user.id)
        .then(({ data }) => setFollowedNames(data?.map(r => r.institution_name) || []));
    });
  }, []);

  // Reactive sync from URL (handles nav SearchBar navigation)
  useEffect(() => {
    const t = urlParams.get('type');
    const cat = urlParams.get('category');
    const sub = urlParams.get('subcategory');
    setFilter(t && t !== 'alle' ? t : 'alle');
    setCategory(cat || '');
    setSubcategory(sub || '');
    setPendingCategory('');
  }, [urlParams]);

  const search = urlParams.get('search') || '';

  const søgesListings = useMemo(() => {
    return listings.filter(l => l.type === 'søges').sort((a,b) => {
      const urgencyOrder = { haster: 0, måneden: 1, ingen: 2 };
      return (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2);
    });
  }, [listings]);

  const filteredNormal = useMemo(() => {
    let r = listings.filter(l => {
      if (l.type === 'søges') return false;
      const matchType   = filter === 'alle' || l.type === filter;
      const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) || (l.institution_name||'').toLowerCase().includes(search.toLowerCase());
      const matchCategory = !category || l.category === category;
      const matchSubcategory = !subcategory || l.subcategory === subcategory;
      const matchFollow = !showFollowed || (followedNames?.includes(l.institution_name));
      return matchType && matchSearch && matchCategory && matchSubcategory && matchFollow;
    });
    if (sort === 'newest')     { /* order comes from useFeedListings */ }
    if (sort === 'price-asc')  r = [...r].sort((a,b) => (a.price||0) - (b.price||0));
    if (sort === 'price-desc') r = [...r].sort((a,b) => (b.price||0) - (a.price||0));
    if (sort === 'bids')       r = [...r].sort((a,b) => (b.bid_count||0) - (a.bid_count||0));
    return r;
  }, [listings, filter, search, sort, category, subcategory, showFollowed, followedNames]);

  const filtered = aiResults !== null ? aiResults : filteredNormal;

  async function handleSaveSearch() {
    if (!saveSearchName.trim()) return;
    setSavingSearch(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { setSavingSearch(false); return; }
      const { data: inst } = await db.from('institutions').select('id,name,email').ilike('email', user.email).maybeSingle();
      const filters = {};
      if (filter !== 'alle') filters.type = filter;
      if (search) filters.search = search;
      if (category) filters.category = category;
      if (subcategory) filters.subcategory = subcategory;
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
    setActiveListing(l);
    router.push('/opslag/detail');
  }

  function goToInstitution(name) {
    router.push('/institution/' + encodeURIComponent(name));
  }

  const selectStyle = {
    padding: '8px 12px', borderRadius: 99, border: `1.5px solid ${PAPER3}`,
    fontSize: 13, background: PAPER2, fontFamily: FONT, outline: 'none',
    color: INK2, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
  };

  async function handleAiSearch(e) {
    e?.preventDefault();
    if (!aiQuery.trim() || aiSearching) return;
    setAiSearching(true);
    setAiResults(null);
    try {
      const res = await authedFetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery }),
      });
      const json = await res.json();
      if (json.error) { showToast(json.error, 'error'); }
      else { setAiKind('text'); setAiResults(json.listings || []); setAiExplanation(json.explanation || ''); }
    } catch { showToast('AI-søgning mislykkedes. Prøv igen', 'error'); }
    setAiSearching(false);
  }

  function clearAiSearch() {
    setAiMode(false);
    setAiQuery('');
    setAiResults(null);
    setAiExplanation('');
  }

  async function runImageSearch(blob) {
    if (imgSearching) return;
    setImgSearching(true);
    setAiResults(null);
    setAiQuery('');
    try {
      const fd = new FormData();
      fd.append('image', blob, 'soegning.jpg');
      const res = await authedFetch('/api/ai-image-search', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.error) { showToast(json.error, 'error'); }
      else { setAiKind('image'); setAiResults(json.listings || []); setImgSearchOpen(false); }
    } catch { showToast('Billedsøgning mislykkedes. Prøv igen', 'error'); }
    setImgSearching(false);
  }

  const noFilters = !category && !search && filter === 'alle';
  // aiResults === null: ellers skjuler kategori-browseren billed-/AI-resultater på mobil
  const showCategoryBrowser    = isMobile && noFilters && !pendingCategory && !aiMode && !browserDismissed && aiResults === null;
  const showSubcategoryBrowser = isMobile && noFilters && !!pendingCategory && !aiMode && aiResults === null;

  return (
    <PullToRefresh onRefresh={fetchListings}>
    <div style={{ minHeight: '100vh', background: PAPER }}>

      {imgSearchOpen && (
        <ImageSearchModal
          onClose={() => { if (!imgSearching) setImgSearchOpen(false); }}
          onSearch={runImageSearch}
          searching={imgSearching}
        />
      )}

      {/* ── Desktop header only ── */}
      {!isMobile && (
      <div style={{
        background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
        paddingTop: 152, paddingBottom: 48,
        textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 260, color: 'rgba(255,255,255,0.04)', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>byt</span>
        </div>
        <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '5px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            Markedsplads
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, letterSpacing: '-0.04em', color: '#fff', marginBottom: 10, lineHeight: 1.1 }}>
            Find legetøj til jeres institution
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            Køb, byt eller byd direkte med andre verificerede institutioner
          </p>
        </div>
        <svg viewBox="0 0 1440 48" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
          <path d="M0,24 C360,48 1080,0 1440,24 L1440,48 L0,48 Z" fill={PAPER} />
        </svg>
      </div>
      )}

      {/* ── Sticky filter bar — desktop only ── */}
      {!isMobile && (
      <div style={{
        position: 'sticky', top: 68, zIndex: 100,
        background: `rgba(246,242,234,0.97)`,
        borderBottom: `1px solid ${PAPER2}`,
        backdropFilter: 'blur(16px)',
        padding: '12px 24px',
      }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {category && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: PRIMARY, fontFamily: FONT }}>
              {(() => { const catObj = CATEGORIES.find(c => c.key === category); return catObj ? <><span>{catObj.emoji} {catObj.label}</span>{subcategory && <><span style={{ opacity: 0.5 }}>›</span><span>{subcategory}</span></>}</> : null; })()}
              <button onClick={() => { setCategory(''); setSubcategory(''); }} style={{ marginLeft: 4, background: 'none', border: 'none', color: PRIMARY, cursor: 'pointer', fontSize: 13, fontWeight: 800, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
          )}
          {/* AI search bar — shown when aiMode active */}
          {aiMode && (
            <form onSubmit={handleAiSearch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, background: '#fff', borderRadius: 99, display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 10, border: `2px solid ${PRIMARY}`, boxShadow: `0 0 0 3px ${PRIMARY}22` }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
                <input
                  ref={aiInputRef}
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  placeholder="Beskriv hvad du leder efter… fx 'noget børn kan ride på udendørs'"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: FONT, flex: 1, minWidth: 0, color: INK }}
                  autoFocus
                />
                {aiQuery && <button type="button" onClick={() => setAiQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: INK3, padding: 0, lineHeight: 1 }}>×</button>}
              </div>
              <button type="submit" disabled={!aiQuery.trim() || aiSearching} style={{ padding: '9px 20px', borderRadius: 99, border: 'none', background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: FONT, cursor: aiQuery.trim() && !aiSearching ? 'pointer' : 'default', opacity: !aiQuery.trim() || aiSearching ? 0.5 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {aiSearching ? 'Søger…' : 'Søg'}
              </button>
              <button type="button" onClick={clearAiSearch} style={{ padding: '9px 16px', borderRadius: 99, border: `1.5px solid ${PAPER3}`, background: PAPER2, color: INK2, fontWeight: 700, fontSize: 13, fontFamily: FONT, cursor: 'pointer', flexShrink: 0 }}>
                Annuller
              </button>
            </form>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {!aiMode && (
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ key: 'alle', label: 'Alle' }, { key: 'køb', label: TYPE_CFG.køb.label }, { key: 'byd', label: TYPE_CFG.byd.label }, { key: 'byt', label: TYPE_CFG.byt.label }].map(({ key, label }) => {
                  const active = filter === key;
                  const tc = key !== 'alle' ? TYPE_CFG[key] : null;
                  return (
                    <button key={key} onClick={() => setFilter(key)} style={{ padding: '7px 16px', borderRadius: 99, border: active ? 'none' : `1.5px solid ${PAPER3}`, background: active ? (tc ? tc.color : PRIMARY) : PAPER2, color: active ? '#fff' : INK2, fontSize: 13, fontWeight: 700, fontFamily: FONT, transition: 'all 0.15s', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {!aiMode && followedNames?.length > 0 && (
              <button onClick={() => setShowFollowed(f => !f)}
                style={{ padding: '7px 16px', borderRadius: 99, border: showFollowed ? 'none' : `1.5px solid ${PAPER3}`, background: showFollowed ? PRIMARY : PAPER2, color: showFollowed ? '#fff' : INK2, fontSize: 13, fontWeight: 700, fontFamily: FONT, transition: 'all 0.15s', cursor: 'pointer', whiteSpace: 'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                ★ Institutioner jeg følger {showFollowed && `(${followedNames.length})`}
              </button>
            )}
            {!aiMode && (
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
            {/* AI search toggle button */}
            <button
              onClick={() => { if (aiMode) clearAiSearch(); else { setAiMode(true); setTimeout(() => aiInputRef.current?.focus(), 50); } }}
              style={{ padding: '7px 16px', borderRadius: 99, border: aiMode ? 'none' : `1.5px solid ${PAPER3}`, background: aiMode ? PRIMARY : PAPER2, color: aiMode ? '#fff' : INK2, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', marginLeft: 'auto' }}
            >
              ✨ AI tekst søgning
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ── Mobile: top spacer (replaces sticky filter bar) ── */}
      {isMobile && <div style={{ height: 68 }} />}

      {/* ── Main tab switcher ── */}
      <div style={{ maxWidth:1140, margin:'0 auto', padding: isMobile ? '12px 16px 0' : '16px 24px 0', display:'flex', gap:4, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        {[{ key:'opslag', label:'Opslag' }, { key:'søges', label:`Søges (${søgesListings.length})` }].map(({ key, label }) => (
          <button key={key} onClick={() => setMainTab(key)} style={{ padding: isMobile ? '8px 16px' : '9px 20px', borderRadius:99, border:'none', background: mainTab===key ? (key==='søges' ? '#7C3AED' : PRIMARY) : PAPER2, color: mainTab===key ? '#fff' : INK3, fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s' }}>
            {key === 'søges' && <span style={{ marginRight:5 }}>🔍</span>}{label}
          </button>
        ))}
      </div>
      {/* Mobile: dedikeret søge-række (AI tekst + billede) — egen linje så den er tydelig */}
      {isMobile && (
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '8px 16px 0', display: 'flex', gap: 8 }}>
          <button
            onClick={() => { if (aiMode) clearAiSearch(); else { setAiMode(true); setTimeout(() => aiInputRef.current?.focus(), 50); } }}
            style={{ flex: 1, justifyContent: 'center', padding: '10px 16px', borderRadius: 99, border: 'none', background: aiMode ? PRIMARY : PAPER2, color: aiMode ? '#fff' : INK2, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ✨ AI tekst søgning
          </button>
          <button
            onClick={() => setImgSearchOpen(true)}
            style={{ flex: 1, justifyContent: 'center', padding: '10px 16px', borderRadius: 99, border: 'none', background: PAPER2, color: INK2, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            📷 Søg med billede
          </button>
        </div>
      )}
      {/* Mobile AI search bar */}
      {isMobile && aiMode && (
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '8px 16px 0' }}>
          <form onSubmit={handleAiSearch} style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '8px 14px', gap: 8, border: `2px solid ${PRIMARY}`, boxShadow: `0 0 0 3px ${PRIMARY}22` }}>
              <span style={{ fontSize: 15 }}>✨</span>
              <input
                ref={aiInputRef}
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                placeholder="Beskriv hvad du leder efter…"
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: FONT, flex: 1, minWidth: 0, color: INK }}
                autoFocus
              />
              {aiQuery && <button type="button" onClick={() => setAiQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: INK3, padding: 0, lineHeight: 1 }}>×</button>}
            </div>
            <button type="submit" disabled={!aiQuery.trim() || aiSearching} style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: FONT, cursor: 'pointer', opacity: !aiQuery.trim() || aiSearching ? 0.5 : 1, flexShrink: 0 }}>
              {aiSearching ? '…' : 'Søg'}
            </button>
          </form>
        </div>
      )}

      {/* ── Søges tab ── */}
      {mainTab === 'søges' && (
        <div style={{ maxWidth:1140, margin:'0 auto', padding: isMobile ? '16px 8px 40px' : '24px 24px 60px' }}>
          <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:10, background:'#F5F0FF', borderRadius:12, padding:'12px 16px' }}>
            <span style={{ fontSize:20 }}>🔍</span>
            <div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:'#7C3AED' }}>Andre institutioner søger</div>
              <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>Har du noget der matcher? Send dem en besked!</div>
            </div>
          </div>
          {loading ? (
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
              {[1,2,3].map(i => <div key={i} style={{ height:160, background:PAPER2, borderRadius:16, animation:'pulse 1.5s ease-in-out infinite' }} />)}
            </div>
          ) : søgesListings.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0 80px' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:INK, marginBottom:8 }}>Ingen aktive søges-opslag</div>
              <p style={{ fontSize:14, color:INK3 }}>Institutioner kan oprette søges-opslag for at finde specifikt legetøj</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
              {søgesListings.map(l => (
                <SøgesCard key={l.id} l={l} onContact={() => {
                  if (!loggedIn) { router.push('/login'); return; }
                  setActiveListing(l);
                  router.push('/opslag/detail');
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Category browser (mobile, no filters active) ── */}
      {mainTab === 'opslag' && showCategoryBrowser && (
        <CategoryBrowser onSelect={cat => {
          if (cat === '') { setBrowserDismissed(true); window.scrollTo({ top: 0, behavior: 'instant' }); }
          else { setPendingCategory(cat); window.scrollTo({ top: 0, behavior: 'instant' }); }
        }} />
      )}

      {/* ── Subcategory browser (mobile) ── */}
      {mainTab === 'opslag' && showSubcategoryBrowser && (
        <SubcategoryBrowser
          categoryKey={pendingCategory}
          onBack={() => setPendingCategory('')}
          onSelectAll={() => { setCategory(pendingCategory); setPendingCategory(''); window.scrollTo({ top: 0, behavior: 'instant' }); }}
          onSelectSub={sub => { setCategory(pendingCategory); setSubcategory(sub); setPendingCategory(''); window.scrollTo({ top: 0, behavior: 'instant' }); }}
        />
      )}

      {/* ── Listings ── */}
      {mainTab === 'opslag' && !showCategoryBrowser && !showSubcategoryBrowser && (
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: isMobile ? '12px 8px 40px' : '28px 24px 60px' }}>

        {/* Mobile: back button + breadcrumb */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 10px', borderBottom: `1px solid ${PAPER2}`, marginBottom: 12 }}>
            <button onClick={() => { setCategory(''); setSubcategory(''); setPendingCategory(''); setBrowserDismissed(false); router.push('/opslag'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: PRIMARY, fontFamily: FONT, fontWeight: 700, fontSize: 14, padding: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              {(() => {
                const catObj = CATEGORIES.find(c => c.key === category);
                if (search) return `"${search}"`;
                if (catObj && subcategory) return `${catObj.emoji} ${catObj.label} › ${subcategory}`;
                if (catObj) return `${catObj.emoji} ${catObj.label}`;
                return 'Alle opslag';
              })()}
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {loggedIn && (filter !== 'alle' || search || category || subcategory) && (
                <button onClick={() => setSaveSearchModal(true)} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: PRIMARY, border: 'none', borderRadius: 99, cursor: 'pointer', fontFamily: FONT, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🔔 Gem
                </button>
              )}
              <span style={{ fontSize: 12, color: INK3, fontFamily: FONT }}>{loading ? '' : `${filtered.length} opslag`}</span>
            </div>
          </div>
        )}

        {/* Resultat-banner */}
        {aiResults !== null && (
          <div style={{ marginBottom: 14, background: `${PRIMARY}11`, border: `1.5px solid ${PRIMARY}33`, borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18 }}>{aiKind === 'image' ? '📷' : '✨'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {aiKind === 'image' ? (
                <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PRIMARY }}>Lignende opslag</span>
              ) : (
                <>
                  <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PRIMARY }}>{aiExplanation}</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginLeft: 8 }}>{aiResults.length} opslag fundet</span>
                </>
              )}
            </div>
            <button onClick={clearAiSearch} style={{ background: 'none', border: `1.5px solid ${PRIMARY}44`, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: PRIMARY, fontFamily: FONT, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              × Ryd
            </button>
          </div>
        )}

        {/* Desktop: Result count row */}
        {!isMobile && !aiResults && (
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ color: INK3, fontSize: 13, margin: 0, fontFamily: FONT }}>
            {loading ? 'Henter opslag…' : `${filtered.length} opslag`}
            {search && <span> for "<strong style={{ color: INK2 }}>{search}</strong>"</span>}
          </p>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {(filter !== 'alle' || search || category || subcategory) && (
              <button onClick={() => { setFilter('alle'); setCategory(''); setSubcategory(''); setPendingCategory(''); setBrowserDismissed(false); router.push('/opslag'); }} style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0 }}>
                Nulstil filtre
              </button>
            )}
            {loggedIn && (filter !== 'alle' || search || category || subcategory) && (
              <button onClick={() => setSaveSearchModal(true)} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: PRIMARY, border: 'none', borderRadius: 99, cursor: 'pointer', fontFamily: FONT, padding: '5px 14px', display:'flex', alignItems:'center', gap:5 }}>
                🔔 Gem søgning
              </button>
            )}
          </div>
        </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(auto-fill,minmax(240px,1fr))', gap: isMobile ? 8 : 18 }}>
            {[1,2,3,4,5,6].map(i => isMobile
              ? <SkeletonMobileCard key={i} />
              : <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0 120px' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 60 : 96, color: GREEN_SOFT, lineHeight: 1, letterSpacing: '-0.05em', marginBottom: 12, userSelect: 'none' }}>0</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 20 : 26, color: INK, marginBottom: 8, letterSpacing: '-0.03em' }}>Ingen opslag fundet</div>
            <p style={{ fontSize: 15, color: INK3, marginBottom: 28 }}>Prøv at ændre eller nulstille dine filtre</p>
            <button onClick={() => { setFilter('alle'); setCategory(''); setSubcategory(''); setPendingCategory(''); setBrowserDismissed(false); router.push('/opslag'); }} style={{
              background: 'none', border: `1.5px solid ${PRIMARY}`, color: PRIMARY,
              borderRadius: 99, padding: '10px 24px', fontSize: 14, fontWeight: 700,
              fontFamily: FONT, cursor: 'pointer',
            }}>
              Nulstil filtre
            </button>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {filtered.map(l => {
              const isFav = favs.includes(l.id);
              return (
                <MobileListingCard key={l.id} l={l} isFav={isFav} onOpen={() => handleListingClick(l)} onToggleFav={async id => {
                  const { data: { user } } = await db.auth.getUser();
                  if (!user) { router.push('/login'); return; }
                  toggleFav(id);
                }} />
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
            {filtered.map(l => (
              <ListingCard key={l.id} listing={l} favs={favs} toggleFav={toggleFav} onClick={() => handleListingClick(l)} onInstitutionClick={goToInstitution} />
            ))}
          </div>
        )}
        {/* Infinite scroll sentinel */}
        {!loading && hasMore && (
          <div ref={sentinelRef} style={{ height: 1, marginTop: 32 }}>
            {loadingMore && <div style={{ textAlign: 'center', padding: '16px 0', color: INK3, fontSize: 14, fontFamily: FONT }}>Henter flere opslag…</div>}
          </div>
        )}
      </div>
      )}

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
    </PullToRefresh>
  );
}

import { Suspense } from 'react';
export default function OpslagPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: PAPER }} />}>
      <OpslagInner />
    </Suspense>
  );
}
