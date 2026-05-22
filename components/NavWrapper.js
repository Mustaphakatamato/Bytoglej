'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3 } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import { useWindowWidth } from '@/lib/hooks';
import { useState, useEffect, useRef, useMemo, Suspense } from 'react';

const FONT = "'Sora', sans-serif";

function Mark09({ size = 36, bg = PRIMARY }) {
  const r = Math.round(size * 0.18);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="byt&leg" style={{ flexShrink:0 }}>
      <rect x="0" y="0" width="64" height="64" rx={r * 64 / size} fill={bg} />
      <text x="32" y="27" textAnchor="middle" fontFamily="'Sora',sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill={PAPER}>byt</text>
      <text x="32" y="49" textAnchor="middle" fontFamily="'Sora',sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill={PAPER}>
        <tspan fill={PAPER}>&amp;</tspan>leg<tspan fill={PAPER}>.</tspan>
      </text>
    </svg>
  );
}

export default function NavWrapper() {
  const { loggedIn, setLoggedIn, unreadTotal, isAdmin, toast, setToast } = useApp();
  const { institution } = useActiveUser();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <Suspense fallback={null}>
        <Nav
          pathname={pathname}
          navigate={p => { router.push(p); window.scrollTo({ top:0, behavior:'smooth' }); }}
          loggedIn={loggedIn}
          setLoggedIn={setLoggedIn}
          unreadTotal={unreadTotal}
          institution={institution}
          isAdmin={isAdmin}
          router={router}
        />
      </Suspense>
      {toast && <ToastDisplay msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
    </>
  );
}

function ToastDisplay({ msg, type='success', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, []);
  const icon = type==='success' ? '✅' : type==='error' ? '❌' : 'ℹ️';
  return (
    <div style={{ position:'fixed', bottom:'max(32px, env(safe-area-inset-bottom, 32px))', left:'50%', transform:'translateX(-50%)', background:'#1c1a17', color:'#fff', borderRadius:99, padding:'13px 26px', fontWeight:700, fontSize:14, fontFamily:FONT, zIndex:2000, boxShadow:'0 10px 40px rgba(0,0,0,0.35)', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap', animation:'slideUp 0.3s ease', maxWidth:'calc(100vw - 32px)' }}>
      <span style={{ fontSize:18 }}>{icon}</span> {msg}
    </div>
  );
}

// ── Search bar ─────────────────────────────────────────────────────────────────
function SearchBar({ transparent, router }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { listings } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const wrapRef = useRef(null);

  // Sync from URL when already on /opslag
  useEffect(() => {
    if (pathname === '/opslag') setQ(searchParams.get('search') || '');
  }, [pathname, searchParams]);

  // Close on outside click
  useEffect(() => {
    function handle(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Build suggestions whenever q changes
  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const results = [];
    const seen = new Set();

    function add(label, type, href) {
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ label, type, href });
    }

    // Category + subcategory matches
    for (const cat of CATEGORIES) {
      if (cat.label.toLowerCase().includes(term))
        add(`${cat.emoji} ${cat.label}`, 'kategori', `/opslag?category=${cat.key}`);
      for (const sub of cat.sub) {
        if (sub.toLowerCase().includes(term))
          add(`${cat.emoji} ${sub}`, 'kategori', `/opslag?category=${cat.key}&subcategory=${encodeURIComponent(sub)}`);
      }
    }

    // Listing title matches
    for (const l of listings) {
      if (l.title?.toLowerCase().includes(term))
        add(l.title, 'opslag', `/opslag?search=${encodeURIComponent(l.title)}`);
      if (results.length >= 8) break;
    }

    // Institution matches
    for (const l of listings) {
      if (l.institution_name?.toLowerCase().includes(term))
        add(l.institution_name, 'institution', `/institution/${encodeURIComponent(l.institution_name)}`);
      if (results.length >= 9) break;
    }

    return results.slice(0, 8);
  }, [q, listings]);

  const showDrop = open && focused && q.trim().length >= 2;

  function go(href) {
    router.push(href);
    setOpen(false);
    setCursor(-1);
  }

  function submit(e) {
    e.preventDefault();
    if (cursor >= 0 && suggestions[cursor]) { go(suggestions[cursor].href); return; }
    const params = new URLSearchParams();
    if (q.trim()) params.set('search', q.trim());
    router.push('/opslag' + (params.toString() ? '?' + params : ''));
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!showDrop) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, suggestions.length)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    if (e.key === 'Escape')    { setOpen(false); setCursor(-1); }
  }

  // Total items = suggestions + "Søg efter X" row
  const totalItems = suggestions.length + 1;
  const searchRowIdx = suggestions.length;

  return (
    <div ref={wrapRef} style={{ flex:1, maxWidth:560, position:'relative' }}>
      <form onSubmit={submit}>
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          background: transparent ? 'rgba(255,255,255,0.15)' : (showDrop ? PAPER : PAPER2),
          borderRadius: showDrop ? '16px 16px 0 0' : 99,
          border: `1.5px solid ${transparent ? 'rgba(255,255,255,0.3)' : (showDrop ? PAPER3 : PAPER3)}`,
          borderBottom: showDrop ? 'none' : undefined,
          padding:'0 6px 0 16px',
          transition:'border-radius 0.15s, background 0.15s',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0, opacity: transparent ? 0.7 : 0.4 }}>
            <circle cx="6" cy="6" r="5" stroke={transparent ? '#fff' : INK} strokeWidth="1.5"/>
            <path d="M10 10L13 13" stroke={transparent ? '#fff' : INK} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); setCursor(-1); }}
            onFocus={() => { setFocused(true); setOpen(true); }}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            placeholder="Søg efter legetøj, institution..."
            autoComplete="off"
            style={{
              flex:1, border:'none', background:'transparent', outline:'none',
              fontSize:14, fontFamily:FONT, color: transparent ? '#fff' : INK,
              padding:'10px 0',
            }}
          />
          {q && (
            <button type="button" onClick={() => { setQ(''); setOpen(false); }} style={{ background:'none', border:'none', color: transparent ? 'rgba(255,255,255,0.7)' : INK3, fontSize:14, cursor:'pointer', padding:'4px', lineHeight:1, flexShrink:0 }}>✕</button>
          )}
          <button type="submit" style={{
            background: transparent ? 'rgba(255,255,255,0.25)' : PRIMARY,
            color:'#fff', border:'none', borderRadius:99,
            padding:'7px 18px', fontSize:13, fontWeight:700, fontFamily:FONT,
            cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
          }}>
            Søg
          </button>
        </div>
      </form>

      {/* Dropdown */}
      {showDrop && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:700,
          background: PAPER,
          border: `1.5px solid ${PAPER3}`,
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          overflow:'hidden',
          boxShadow: '0 12px 32px rgba(22,34,28,0.12)',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => go(s.href)}
              onMouseEnter={() => setCursor(i)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'11px 16px', cursor:'pointer',
                background: cursor === i ? PAPER2 : 'transparent',
                transition:'background 0.1s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0, opacity:0.3 }}>
                <circle cx="6" cy="6" r="5" stroke={INK} strokeWidth="1.5"/>
                <path d="M10 10L13 13" stroke={INK} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ flex:1, fontSize:14, color:INK, fontFamily:FONT }}>
                {highlightMatch(s.label, q)}
              </span>
              <span style={{ fontSize:11, color:INK3, fontFamily:FONT, flexShrink:0 }}>{s.type}</span>
            </div>
          ))}
          {/* "Søg efter X" row */}
          <div
            onMouseDown={submit}
            onMouseEnter={() => setCursor(searchRowIdx)}
            style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'11px 16px', cursor:'pointer',
              background: cursor === searchRowIdx ? PAPER2 : 'transparent',
              borderTop: suggestions.length ? `1px solid ${PAPER2}` : 'none',
              transition:'background 0.1s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0, opacity:0.5 }}>
              <circle cx="6" cy="6" r="5" stroke={PRIMARY} strokeWidth="1.5"/>
              <path d="M10 10L13 13" stroke={PRIMARY} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:14, color:PRIMARY, fontFamily:FONT, fontWeight:600 }}>
              Søg efter &ldquo;{q.trim()}&rdquo;
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1 || !query.trim()) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: PRIMARY, fontWeight: 700 }}>{text.slice(idx, idx + query.trim().length)}</strong>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

// ── Category strip ─────────────────────────────────────────────────────────────
function CategoryStrip({ router }) {
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('category') || '';
  const activeSubcategory = searchParams.get('subcategory') || '';
  const [hoveredCat, setHoveredCat] = useState(null);
  const w = useWindowWidth();
  const isMobile = w < 768;

  function goCategory(key) { router.push('/opslag?category=' + key); }
  function goSubcategory(key, sub) { router.push('/opslag?category=' + key + '&subcategory=' + encodeURIComponent(sub)); }
  function clearCategory() { router.push('/opslag'); }

  const activeCatObj = CATEGORIES.find(c => c.key === activeCategory);

  return (
    <div style={{ position:'relative' }} onMouseLeave={() => setHoveredCat(null)}>
      {/* Strip row */}
      <div style={{ borderTop:`1px solid ${PAPER2}`, overflowX:'auto', scrollbarWidth:'none', msOverflowStyle:'none' }}>
        <div style={{ maxWidth:1140, margin:'0 auto', padding:'0 16px', display:'flex', alignItems:'center', gap:2, height:44, whiteSpace:'nowrap' }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => isActive ? clearCategory() : goCategory(cat.key)}
                onMouseEnter={() => !isMobile && setHoveredCat(cat.key)}
                style={{
                  display:'inline-flex', alignItems:'center', gap:5,
                  padding:'5px 13px', border:'none', cursor:'pointer', flexShrink:0,
                  background: isActive ? GREEN_TINT : 'transparent',
                  color: isActive ? PRIMARY : INK2,
                  fontFamily:FONT, fontWeight: isActive ? 700 : 500, fontSize:13,
                  whiteSpace:'nowrap',
                  borderRadius: isActive ? '8px 8px 0 0' : 99,
                  borderBottom: isActive ? `2px solid ${PRIMARY}` : '2px solid transparent',
                  transition:'all 0.12s',
                }}
              >
                <span style={{ fontSize:14 }}>{cat.emoji}</span>
                <span>{cat.label}</span>
                {isActive && (
                  <span onClick={e => { e.stopPropagation(); clearCategory(); }} style={{ marginLeft:2, fontSize:11, opacity:0.6, cursor:'pointer', fontWeight:800 }}>×</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile subcategory breadcrumb */}
      {isMobile && activeSubcategory && activeCatObj && (
        <div style={{ padding:'4px 16px 6px', background:GREEN_TINT, display:'flex', alignItems:'center', gap:6, fontSize:12, color:PRIMARY, fontFamily:FONT, fontWeight:600 }}>
          <span>{activeCatObj.emoji} {activeCatObj.label}</span>
          <span style={{ opacity:0.5 }}>›</span>
          <span>{activeSubcategory}</span>
          <button onClick={clearCategory} style={{ marginLeft:'auto', background:'none', border:'none', color:PRIMARY, cursor:'pointer', fontSize:14, fontWeight:800 }}>×</button>
        </div>
      )}

      {/* Desktop hover dropdown */}
      {!isMobile && hoveredCat && (
        <div
          onMouseEnter={() => setHoveredCat(hoveredCat)}
          onMouseLeave={() => setHoveredCat(null)}
          style={{
            position:'absolute', top:'100%', left:0, right:0, zIndex:600,
            background:'rgba(246,242,234,0.98)', backdropFilter:'blur(16px)',
            borderTop:`1px solid ${PAPER2}`, borderBottom:`1px solid ${PAPER2}`,
            boxShadow:'0 12px 32px rgba(22,34,28,0.1)',
          }}
        >
          <div style={{ maxWidth:1140, margin:'0 auto', padding:'16px', display:'flex', flexWrap:'wrap', gap:8 }}>
            {CATEGORIES.find(c => c.key === hoveredCat)?.sub.map(sub => {
              const isActiveSub = activeSubcategory === sub && activeCategory === hoveredCat;
              return (
                <button
                  key={sub}
                  onClick={() => { goSubcategory(hoveredCat, sub); setHoveredCat(null); }}
                  onMouseEnter={e => { if (!isActiveSub) { e.currentTarget.style.background = GREEN_TINT; e.currentTarget.style.color = PRIMARY; } }}
                  onMouseLeave={e => { if (!isActiveSub) { e.currentTarget.style.background = PAPER2; e.currentTarget.style.color = INK2; } }}
                  style={{
                    padding:'6px 16px', borderRadius:99,
                    border: isActiveSub ? `2px solid ${PRIMARY}` : `1.5px solid ${PAPER3}`,
                    background: isActiveSub ? GREEN_TINT : PAPER2,
                    color: isActiveSub ? PRIMARY : INK2,
                    fontFamily:FONT, fontWeight: isActiveSub ? 700 : 500, fontSize:13,
                    cursor:'pointer', transition:'all 0.12s',
                  }}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main nav ───────────────────────────────────────────────────────────────────
function Nav({ pathname, navigate, loggedIn, setLoggedIn, unreadTotal, institution, isAdmin, router }) {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [searchOpen,setSearchOpen]= useState(false);
  const w = useWindowWidth();
  const isMobile = w < 768;

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);

  const isHome = pathname === '/';
  const transparent = isHome && !scrolled && !menuOpen && !searchOpen;
  const showCategoryStrip = !transparent && !scrolled;

  function go(p) { navigate(p); }

  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:500, background:transparent?'transparent':'rgba(246,242,234,0.96)', backdropFilter:transparent?'none':'blur(18px)', boxShadow:transparent?'none':'0 1px 0 rgba(22,34,28,0.08)', transition:'all 0.3s' }}>

      {/* ── Main row ── */}
      <div style={{ maxWidth:1140, margin:'0 auto', display:'flex', alignItems:'center', height:68, gap:isMobile?10:20, padding:'0 16px' }}>

        {/* Logo */}
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', flexShrink:0, textDecoration:'none' }}>
          <Mark09 size={34} bg={transparent ? 'rgba(255,255,255,0.15)' : PRIMARY} />
          {!isMobile && (
            <span style={{ fontFamily:FONT, fontWeight:800, fontSize:18, letterSpacing:'-0.04em', lineHeight:1.05 }}>
              <span style={{ display:'block', color:transparent?'#fff':INK }}>byt</span>
              <span style={{ display:'block', color:transparent?'rgba(255,255,255,0.9)':INK }}>
                <span style={{ color:transparent?'#fff':PRIMARY }}>&amp;</span>leg<span style={{ color:transparent?'#fff':PRIMARY }}>.</span>
              </span>
            </span>
          )}
        </Link>

        {/* Search bar — desktop */}
        {!isMobile && (
          <Suspense fallback={null}>
            <SearchBar transparent={transparent} router={router} />
          </Suspense>
        )}

        {/* Mobile: search icon */}
        {isMobile && (
          <button onClick={() => setSearchOpen(v => !v)} style={{ background:'none', border:'none', cursor:'pointer', padding:8, color:transparent?'#fff':INK2, display:'flex', alignItems:'center' }}>
            <svg width="19" height="19" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        <div style={{ flex: isMobile ? 1 : 0 }} />

        {/* Right actions — desktop */}
        {!isMobile && (
          <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            {isAdmin && loggedIn && (
              <Link href="/admin" style={{ padding:'8px 12px', fontSize:13, fontWeight:700, color:pathname==='/admin'?PRIMARY:INK3, borderRadius:8, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M4.93 4.93a10 10 0 000 14.14"/></svg>
                Admin
              </Link>
            )}
            {loggedIn ? (
              <>
                <Link href="/beskeder" style={{ position:'relative', display:'flex', alignItems:'center', gap:5, padding:'8px 12px', fontSize:14, fontWeight:600, color:transparent?'rgba(255,255,255,0.9)':INK2, textDecoration:'none', borderRadius:8 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Beskeder
                  {unreadTotal > 0 && <span style={{ background:'#EF476F', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px', lineHeight:1 }}>{unreadTotal > 9 ? '9+' : unreadTotal}</span>}
                </Link>
                <Link href="/dashboard" style={{ padding:'8px 12px', fontSize:14, fontWeight:600, color:transparent?'rgba(255,255,255,0.9)':INK2, textDecoration:'none', borderRadius:8 }}>
                  Min institution
                </Link>
                <Link href="/opret-opslag" style={{ background:PRIMARY, color:'#fff', fontWeight:700, fontSize:13, padding:'8px 18px', borderRadius:22, textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                  + Opret opslag
                </Link>
                <button onClick={async()=>{ await db.auth.signOut(); setLoggedIn(false); go('/'); }} title="Log ud" style={{ width:36, height:36, borderRadius:'50%', background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', overflow:'hidden', flexShrink:0, border:`2px solid ${PRIMARY}` }}>
                  {institution?.logo_url
                    ? <img src={institution.logo_url} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <span>{institution?.name?.charAt(0)?.toUpperCase() || '?'}</span>}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" style={{ padding:'8px 14px', fontSize:14, fontWeight:600, color:transparent?'rgba(255,255,255,0.9)':INK2, textDecoration:'none', borderRadius:22 }}>
                  Log ind
                </Link>
                <Link href="/signup" style={{ background:PRIMARY, color:'#fff', fontWeight:700, fontSize:13, padding:'8px 18px', borderRadius:22, textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                  Tilmeld institution
                </Link>
              </>
            )}
          </div>
        )}

        {/* Mobile right: messages + hamburger */}
        {isMobile && (
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            {loggedIn && (
              <Link href="/beskeder" style={{ position:'relative', display:'inline-flex', padding:6, textDecoration:'none', color:transparent?'#fff':INK2 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {unreadTotal > 0 && <span style={{ position:'absolute', top:2, right:2, background:'#EF476F', color:'#fff', borderRadius:99, fontSize:10, fontWeight:800, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1 }}>{unreadTotal > 9 ? '9+' : unreadTotal}</span>}
              </Link>
            )}
            <button onClick={()=>setMenuOpen(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 4px', display:'flex', flexDirection:'column', gap:5, alignItems:'center', justifyContent:'center', width:36, height:36 }}>
              <div style={{ width:22, height:2.5, background:transparent&&!menuOpen?'#fff':'#333', borderRadius:2, transition:'transform 0.2s, opacity 0.2s', transform:menuOpen?'rotate(45deg) translate(5px,5px)':'none' }} />
              <div style={{ width:22, height:2.5, background:transparent&&!menuOpen?'#fff':'#333', borderRadius:2, opacity:menuOpen?0:1, transition:'opacity 0.2s' }} />
              <div style={{ width:22, height:2.5, background:transparent&&!menuOpen?'#fff':'#333', borderRadius:2, transition:'transform 0.2s, opacity 0.2s', transform:menuOpen?'rotate(-45deg) translate(5px,-5px)':'none' }} />
            </button>
          </div>
        )}
      </div>

      {/* Mobile search bar (expandable) */}
      {isMobile && searchOpen && (
        <div style={{ padding:'0 14px 12px', background:'rgba(246,242,234,0.99)' }}>
          <Suspense fallback={null}>
            <SearchBar transparent={false} router={router} />
          </Suspense>
        </div>
      )}

      {/* Category strip */}
      {showCategoryStrip && <CategoryStrip router={router} />}

      {/* Mobile menu */}
      {isMobile && menuOpen && (
        <div style={{ background:'rgba(246,242,234,0.99)', borderTop:`1px solid #ECE6DA`, padding:'8px 16px 20px', animation:'slideDown 0.2s ease' }}>
          {/* Categories quick links */}
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:INK3, letterSpacing:'0.06em', textTransform:'uppercase', padding:'10px 4px 8px', fontFamily:FONT }}>Kategorier</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {CATEGORIES.map(cat => (
                <Link key={cat.key} href={`/opslag?category=${cat.key}`} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:99, background:PAPER2, color:INK2, fontSize:12, fontWeight:600, textDecoration:'none', fontFamily:FONT }}>
                  {cat.emoji} {cat.label}
                </Link>
              ))}
            </div>
          </div>
          <div style={{ borderTop:`1px solid ${PAPER2}`, marginTop:8 }}>
            {loggedIn ? <>
              <Link href="/dashboard" style={{ display:'block', borderBottom:`1px solid ${PAPER2}`, padding:'14px 4px', fontSize:15, fontWeight:600, color:INK, textDecoration:'none', fontFamily:FONT }}>🏢 Min institution</Link>
              <Link href="/opret-opslag" style={{ display:'block', borderBottom:`1px solid ${PAPER2}`, padding:'14px 4px', fontSize:15, fontWeight:700, color:PRIMARY, textDecoration:'none', fontFamily:FONT }}>+ Opret opslag</Link>
              {isAdmin && (
                <Link href="/admin" style={{ display:'block', borderBottom:`1px solid ${PAPER2}`, padding:'14px 4px', fontSize:15, fontWeight:700, color:PRIMARY, textDecoration:'none', fontFamily:FONT }}>⚙️ Admin</Link>
              )}
              <button onClick={async()=>{ await db.auth.signOut(); setLoggedIn(false); go('/'); }} style={{ marginTop:12, width:'100%', background:PAPER2, border:'none', borderRadius:12, padding:'13px', fontSize:14, fontWeight:700, color:INK2, cursor:'pointer', fontFamily:FONT }}>Log ud</button>
            </> : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:12 }}>
                <Link href="/login" style={{ display:'flex', justifyContent:'center', width:'100%', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, fontWeight:700, fontSize:15, padding:'12px', borderRadius:22, textDecoration:'none', fontFamily:FONT }}>Log ind</Link>
                <Link href="/signup" style={{ display:'flex', justifyContent:'center', width:'100%', background:PRIMARY, color:'#fff', fontWeight:700, fontSize:15, padding:'12px', borderRadius:22, textDecoration:'none', fontFamily:FONT }}>Tilmeld institution</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
