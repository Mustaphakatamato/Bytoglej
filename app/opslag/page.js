'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import { useWindowWidth } from '@/lib/hooks';
import { Btn, SkeletonCard } from '@/components/ui';
import ListingCard from '@/components/ListingCard';
import { useApp } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';

const MapContainer = nextDynamic(() => import('@/components/MapView'), { ssr: false });

const FONT = "'Sora', sans-serif";

function MobileListingCard({ l, isFav, onToggleFav, onOpen }) {
  const [imgIdx, setImgIdx] = useState(0);
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
          ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: INK }}>{l.price} kr.</div>
          : <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: CORAL }}>Byttes kun</div>}
        {l.condition && <div style={{ fontSize: 11, color: INK3, marginTop: 2 }}>{l.condition}</div>}
      </div>
    </div>
  );
}

/* ── Mobile category browser (Vinted-style equal boxes) ──── */
function CategoryBrowser({ onSelect }) {
  return (
    <div style={{ padding: '8px 8px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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

function OpslagInner() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const { listings, loadingListings: loading, setActiveListing, favs, toggleFav, showToast, loggedIn, setQuickViewListing } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 640;
  const [filter, setFilter] = useState('alle');
  const [sort, setSort] = useState('newest');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [pendingCategory, setPendingCategory] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [saveSearchModal, setSaveSearchModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);

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

  const filtered = useMemo(() => {
    let r = listings.filter(l => {
      const matchType   = filter === 'alle' || l.type === filter;
      const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) || (l.institution_name||'').toLowerCase().includes(search.toLowerCase());
      const matchCategory = !category || l.category === category;
      const matchSubcategory = !subcategory || l.subcategory === subcategory;
      return matchType && matchSearch && matchCategory && matchSubcategory;
    });
    if (sort === 'newest')     r = [...r].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if (sort === 'price-asc')  r = [...r].sort((a,b) => (a.price||0) - (b.price||0));
    if (sort === 'price-desc') r = [...r].sort((a,b) => (b.price||0) - (a.price||0));
    if (sort === 'bids')       r = [...r].sort((a,b) => (b.bid_count||0) - (a.bid_count||0));
    return r;
  }, [listings, filter, search, sort, category, subcategory]);

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

  const noFilters = !category && !search && filter === 'alle';
  const showCategoryBrowser    = isMobile && noFilters && !pendingCategory;
  const showSubcategoryBrowser = isMobile && noFilters && !!pendingCategory;

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>

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
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: PAPER2, borderRadius: 99, display: 'flex', alignItems: 'center', padding: '9px 16px', gap: 10, border: `1.5px solid ${PAPER3}` }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                <circle cx="6" cy="6" r="5" stroke={INK} strokeWidth="1.5"/>
                <path d="M10 10L13 13" stroke={INK} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input value={search} readOnly placeholder="Brug søgefeltet ovenfor..."
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: FONT, flex: 1, minWidth: 0, color: INK }} />
              {search && <span style={{ fontSize: 13, color: INK2, fontFamily: FONT, fontWeight: 600 }}>"{search}"</span>}
            </div>
            <div style={{ display: 'flex', borderRadius: 99, overflow: 'hidden', border: `1.5px solid ${PAPER3}`, flexShrink: 0 }}>
              {[['list', 'Liste'], ['map', 'Kort']].map(([mode, label]) => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '8px 18px', border: 'none', background: viewMode === mode ? PRIMARY : PAPER2, color: viewMode === mode ? '#fff' : INK3, fontWeight: 700, fontSize: 13, fontFamily: FONT, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {category && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: PRIMARY, fontFamily: FONT }}>
              {(() => { const catObj = CATEGORIES.find(c => c.key === category); return catObj ? <><span>{catObj.emoji} {catObj.label}</span>{subcategory && <><span style={{ opacity: 0.5 }}>›</span><span>{subcategory}</span></>}</> : null; })()}
              <button onClick={() => { setCategory(''); setSubcategory(''); }} style={{ marginLeft: 4, background: 'none', border: 'none', color: PRIMARY, cursor: 'pointer', fontSize: 13, fontWeight: 800, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
            <div style={{ position: 'relative' }}>
              <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
                <option value="newest">Nyeste</option>
                <option value="price-asc">Pris ↑</option>
                <option value="price-desc">Pris ↓</option>
                <option value="bids">Flest bud</option>
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: INK3, pointerEvents: 'none' }}>▼</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── Mobile: top spacer (replaces sticky filter bar) ── */}
      {isMobile && <div style={{ height: 68 }} />}

      {/* ── Category browser (mobile, no filters active) ── */}
      {showCategoryBrowser && (
        <CategoryBrowser onSelect={cat => { setPendingCategory(cat); window.scrollTo({ top: 0, behavior: 'instant' }); }} />
      )}

      {/* ── Subcategory browser (mobile) ── */}
      {showSubcategoryBrowser && (
        <SubcategoryBrowser
          categoryKey={pendingCategory}
          onBack={() => setPendingCategory('')}
          onSelectAll={() => { setCategory(pendingCategory); setPendingCategory(''); window.scrollTo({ top: 0, behavior: 'instant' }); }}
          onSelectSub={sub => { setCategory(pendingCategory); setSubcategory(sub); setPendingCategory(''); window.scrollTo({ top: 0, behavior: 'instant' }); }}
        />
      )}

      {/* ── Listings ── */}
      {!showCategoryBrowser && !showSubcategoryBrowser && (
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: isMobile ? '12px 8px 40px' : '28px 24px 60px' }}>

        {/* Mobile: back button + breadcrumb */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 10px', borderBottom: `1px solid ${PAPER2}`, marginBottom: 12 }}>
            <button onClick={() => { setCategory(''); setSubcategory(''); setPendingCategory(''); router.push('/opslag'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: PRIMARY, fontFamily: FONT, fontWeight: 700, fontSize: 14, padding: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              {(() => {
                const catObj = CATEGORIES.find(c => c.key === category);
                if (search) return `"${search}"`;
                if (catObj && subcategory) return `${catObj.emoji} ${catObj.label} › ${subcategory}`;
                if (catObj) return `${catObj.emoji} ${catObj.label}`;
                return 'Alle opslag';
              })()}
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: INK3, fontFamily: FONT }}>{loading ? '' : `${filtered.length} opslag`}</span>
          </div>
        )}

        {/* Desktop: Result count row */}
        {!isMobile && (
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ color: INK3, fontSize: 13, margin: 0, fontFamily: FONT }}>
            {loading ? 'Henter opslag…' : `${filtered.length} opslag`}
            {search && <span> for "<strong style={{ color: INK2 }}>{search}</strong>"</span>}
          </p>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {(filter !== 'alle' || search || category || subcategory) && (
              <button onClick={() => { setFilter('alle'); setCategory(''); setSubcategory(''); setPendingCategory(''); router.push('/opslag'); }} style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0 }}>
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

        {viewMode === 'map' && !isMobile ? (
          <MapContainer
            listings={filtered}
            listingCoords={{}}
            userCoords={null}
            onListingClick={handleListingClick}
            isMobile={isMobile}
          />
        ) : loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(240px,1fr))', gap: isMobile ? 8 : 18 }}>
            {[1,2,3,4,5,6].map(i => isMobile
              ? <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 12 }} />
              : <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0 120px' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 60 : 96, color: GREEN_SOFT, lineHeight: 1, letterSpacing: '-0.05em', marginBottom: 12, userSelect: 'none' }}>0</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 20 : 26, color: INK, marginBottom: 8, letterSpacing: '-0.03em' }}>Ingen opslag fundet</div>
            <p style={{ fontSize: 15, color: INK3, marginBottom: 28 }}>Prøv at ændre eller nulstille dine filtre</p>
            <button onClick={() => { setFilter('alle'); setCategory(''); setSubcategory(''); setPendingCategory(''); router.push('/opslag'); }} style={{
              background: 'none', border: `1.5px solid ${PRIMARY}`, color: PRIMARY,
              borderRadius: 99, padding: '10px 24px', fontSize: 14, fontWeight: 700,
              fontFamily: FONT, cursor: 'pointer',
            }}>
              Nulstil filtre
            </button>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {filtered.map(l => {
              const isFav = favs.includes(l.id);
              return (
                <MobileListingCard key={l.id} l={l} isFav={isFav} onOpen={() => handleListingClick(l)} onToggleFav={async id => {
                  const adding = !isFav;
                  toggleFav(id);
                  const { data: { user } } = await db.auth.getUser();
                  if (user) {
                    if (adding) {
                      const { data: member } = await db.from('institution_members').select('institution_id, institutions(id, name)').eq('email', user.email).maybeSingle();
                      const inst = member?.institutions;
                      db.from('listing_favorites').upsert({ listing_id: id, user_id: user.id, institution_id: inst?.id || null, institution_name: inst?.name || null }, { onConflict: 'listing_id,user_id' });
                    } else {
                      db.from('listing_favorites').delete().eq('listing_id', id).eq('user_id', user.id);
                    }
                  }
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
