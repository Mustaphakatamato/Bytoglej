'use client';
// v2
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, SKY, TYPE_CFG, FONT } from '@/lib/constants';
import { useWindowWidth, useDebounce, useFeedListings } from '@/lib/hooks';
import { SkeletonCard } from '@/components/ui';
import ListingCard, { calcServiceFee, BuyerProtectionPopup } from '@/components/ListingCard';
import PullToRefresh from '@/components/PullToRefresh';
import { useApp } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { getCO2Comparison } from '@/lib/co2/calculator';
import { LogoLockup } from '@/components/Logo';
import { STATS_CONFIG } from '@/lib/stats-config';

/* ── Compact mobile listing card (Vinted-style) ───────────── */
function MobileCard({ listing, onClick, favs, toggleFav }) {
  const router = useRouter();
  const { realUserId, institution } = useApp();
  const isOwn = listing.user_id === realUserId || (institution?.name && listing.institution_name === institution.name);
  const isFav = favs.includes(listing.id);
  const [popping, setPopping] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [showFeePopup, setShowFeePopup] = useState(false);
  const imgs = listing.images?.length ? listing.images : [];
  const hasMultiple = imgs.length > 1;
  const startX = useRef(0);
  const moved = useRef(false);

  async function handleFav(e) {
    e.stopPropagation();
    const { data: { user } } = await db.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setPopping(true);
    setTimeout(() => setPopping(false), 350);
    toggleFav(listing.id);
  }

  function onTouchStart(e) { startX.current = e.touches[0].clientX; moved.current = false; }
  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40 && hasMultiple) {
      moved.current = true;
      setImgIdx(i => dx < 0 ? (i+1)%imgs.length : (i-1+imgs.length)%imgs.length);
    }
  }

  return (
    <div onClick={e => { if (moved.current) { moved.current = false; return; } onClick(e); }} style={{ borderRadius: 12, overflow: 'hidden', background: '#fff', cursor: 'pointer', border: '1px solid rgba(22,34,28,0.07)', boxShadow: '0 1px 4px rgba(22,34,28,0.05)' }}>
      <div style={{ aspectRatio: '3/4', background: GREEN_TINT, position: 'relative', overflow: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {imgs.length > 0
          ? <img src={imgs[imgIdx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, opacity: 0.6 }}>{listing.emoji || '🧸'}</div>}
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
        {!isOwn && <button
          className={`fav-btn${popping ? ' fav-pop' : ''}`}
          onClick={handleFav}
          style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? '#e11d48' : 'none'} stroke={isFav ? '#e11d48' : '#888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{listing.title}</div>
        {listing.price
          ? (() => {
              const fee = calcServiceFee(listing.price);
              const total = listing.price + fee;
              return (
                <div>
                  <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginBottom:1 }}>{listing.price} kr.</div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:INK }}>{total.toFixed(2).replace('.',',')} kr. inkl.</span>
                    <button onClick={e=>{ e.stopPropagation(); setShowFeePopup(true); }} style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="#2D6A4F" opacity="0.85"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                  {showFeePopup && <BuyerProtectionPopup price={listing.price} fee={fee} image={listing.images?.[0]} emoji={listing.emoji} onClose={() => setShowFeePopup(false)} />}
                </div>
              );
            })()
          : <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: CORAL }}>Byttes kun</div>}
        {listing.condition && <div style={{ fontSize: 11, color: INK3, marginTop: 2 }}>{listing.condition}</div>}
      </div>
    </div>
  );
}

/* ── Mobile home feed (Vinted-style) ──────────────────────── */
function MobileHomeFeed({ listings, loading }) {
  const router = useRouter();
  const { setActiveListing, favs, toggleFav } = useApp();
  const newest = useMemo(() => listings.slice(0, 40), [listings]);

  return (
    <div style={{ background: PAPER, minHeight: '100vh', paddingTop: 68 }}>
      <div style={{ padding: '14px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: INK, letterSpacing: '-0.03em' }}>Nyeste opslag</div>
        <button onClick={() => router.push('/opslag')} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 700, color: PRIMARY, fontFamily: FONT, cursor: 'pointer' }}>Se alle →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, padding: '6px 8px 16px' }}>
        {loading
          ? [1,2,3,4,5,6,7,8].map(i => <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 12 }} />)
          : newest.map(l => (
              <MobileCard key={l.id} listing={l} favs={favs} toggleFav={toggleFav} onClick={() => { setActiveListing(l); router.push('/opslag/detail'); }} />
            ))}
      </div>
    </div>
  );
}

/* ── Hero (Vinted-inspired, supports NEXT_PUBLIC_HERO_IMAGE_URL) ── */
function HeroSection({ stats }) {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;
  const heroImageUrl = process.env.NEXT_PUBLIC_HERO_IMAGE_URL || null;
  const hasImage = !!heroImageUrl;

  /* ── shared content pieces ── */
  const pill = (
    <div style={{
      display: 'inline-block',
      background: hasImage ? 'rgba(22,101,52,0.10)' : 'rgba(255,255,255,0.12)',
      borderRadius: 999, padding: '6px 18px',
      fontSize: 12, fontWeight: 600,
      color: hasImage ? PRIMARY : 'rgba(255,255,255,0.8)',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      marginBottom: 20, fontFamily: FONT,
    }}>
      Markedsplads for institutioner
    </div>
  );

  const headline = (
    <h1 style={{
      fontFamily: FONT, fontWeight: 800,
      fontSize: isMobile ? 36 : 52,
      letterSpacing: '-0.04em', lineHeight: 1.0,
      color: hasImage ? INK : '#fff',
      marginBottom: 18,
    }}>
      Legetøj til glæde<br />
      <span style={{ color: hasImage ? PRIMARY : GREEN_SOFT }}>for alle.</span>
    </h1>
  );

  const subtitle = (
    <p style={{
      fontSize: isMobile ? 14 : 16,
      color: hasImage ? INK3 : 'rgba(255,255,255,0.68)',
      lineHeight: 1.65,
      marginBottom: 28,
    }}>
      Den første markedsplads hvor børnehaver, skoler og SFO'er køber, sælger og bytter legetøj direkte med hinanden — sikkert og bæredygtigt.
    </p>
  );

  const ctaButtons = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32, justifyContent: isMobile ? 'center' : 'flex-start' }}>
      <button onClick={() => router.push('/signup')} style={{
        background: hasImage ? PRIMARY : PAPER,
        color: hasImage ? '#fff' : PRIMARY,
        border: 'none', borderRadius: 999,
        padding: isMobile ? '12px 24px' : '13px 30px',
        fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', letterSpacing: '-0.01em',
      }}>
        Tilmeld institution
      </button>
      <button onClick={() => router.push('/opslag')} style={{
        background: 'transparent',
        color: hasImage ? INK2 : 'rgba(255,255,255,0.88)',
        border: hasImage ? `1.5px solid ${PAPER3}` : '1.5px solid rgba(255,255,255,0.3)',
        borderRadius: 999,
        padding: isMobile ? '12px 20px' : '13px 26px',
        fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', letterSpacing: '-0.01em',
      }}>
        Se markedspladsen →
      </button>
    </div>
  );

  const showStat = (key, count) =>
    STATS_CONFIG.showStats && count >= (STATS_CONFIG.thresholds[key] ?? 0);

  const anyStatVisible = stats && (
    showStat('institutions', stats.institutions) ||
    showStat('listings', stats.listings) ||
    showStat('trades', stats.deals)
  );

  const statsRow = anyStatVisible ? (
    <div style={{ display: 'flex', gap: isMobile ? 24 : 36, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
      {showStat('institutions', stats.institutions) && (
        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 28, color: hasImage ? INK : '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.institutions}</div>
          <div style={{ fontSize: 11, color: hasImage ? INK3 : 'rgba(255,255,255,0.5)', marginTop: 3, fontFamily: FONT, letterSpacing: '0.02em' }}>institutioner tilmeldt</div>
        </div>
      )}
      {showStat('listings', stats.listings) && (
        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 28, color: hasImage ? INK : '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.listings}</div>
          <div style={{ fontSize: 11, color: hasImage ? INK3 : 'rgba(255,255,255,0.5)', marginTop: 3, fontFamily: FONT, letterSpacing: '0.02em' }}>aktive opslag</div>
        </div>
      )}
      {showStat('trades', stats.deals) && (
        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 28, color: hasImage ? INK : '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.deals}</div>
          <div style={{ fontSize: 11, color: hasImage ? INK3 : 'rgba(255,255,255,0.5)', marginTop: 3, fontFamily: FONT, letterSpacing: '0.02em' }}>handler gennemført</div>
        </div>
      )}
    </div>
  ) : STATS_CONFIG.startupMessage ? (
    <div style={{ fontSize: 12, color: hasImage ? INK3 : 'rgba(255,255,255,0.5)', fontFamily: FONT, fontStyle: 'italic' }}>
      {STATS_CONFIG.startupMessage}
    </div>
  ) : null;

  /* ── NO IMAGE: original green gradient layout ── */
  if (!hasImage) {
    return (
      <section style={{
        background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
        paddingTop: isMobile ? 100 : 120,
        paddingBottom: isMobile ? 60 : 80,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 240 : 420, color: 'rgba(255,255,255,0.035)', lineHeight: 1, letterSpacing: '-0.06em' }}>byt</span>
        </div>

        <div style={{ position: 'relative', maxWidth: 780, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          {pill}
          {headline}
          <p style={{ fontSize: isMobile ? 15 : 18, color: 'rgba(255,255,255,0.68)', lineHeight: 1.65, maxWidth: 520, margin: '0 auto 36px' }}>
            Den første markedsplads hvor børnehaver, skoler og SFO'er køber, sælger og bytter legetøj direkte med hinanden — sikkert og bæredygtigt.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
            <button onClick={() => router.push('/signup')} style={{
              background: PAPER, color: PRIMARY,
              border: 'none', borderRadius: 999, padding: isMobile ? '13px 28px' : '15px 36px',
              fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', letterSpacing: '-0.01em',
            }}>
              Tilmeld institution
            </button>
            <button onClick={() => router.push('/opslag')} style={{
              background: 'transparent', color: 'rgba(255,255,255,0.88)',
              border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 999, padding: isMobile ? '13px 24px' : '15px 32px',
              fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', letterSpacing: '-0.01em',
            }}>
              Se markedspladsen →
            </button>
          </div>
          {anyStatVisible ? (
            <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 28 : 56, flexWrap: 'wrap' }}>
              {showStat('institutions', stats.institutions) && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 34, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.institutions}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: FONT, letterSpacing: '0.02em' }}>institutioner tilmeldt</div>
                </div>
              )}
              {showStat('listings', stats.listings) && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 34, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.listings}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: FONT, letterSpacing: '0.02em' }}>aktive opslag</div>
                </div>
              )}
              {showStat('trades', stats.deals) && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 34, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.deals}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: FONT, letterSpacing: '0.02em' }}>handler gennemført</div>
                </div>
              )}
            </div>
          ) : STATS_CONFIG.startupMessage ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: FONT, fontStyle: 'italic' }}>
              {STATS_CONFIG.startupMessage}
            </div>
          ) : null}
        </div>

        {/* Wave */}
        <svg viewBox="0 0 1440 72" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
          <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill={PAPER} />
        </svg>
      </section>
    );
  }

  /* ── WITH IMAGE ── */

  /* Mobile: image fills background with dark overlay, centered white text */
  if (isMobile) {
    return (
      <section style={{
        position: 'relative', overflow: 'hidden',
        paddingTop: 100, paddingBottom: 60,
        minHeight: '75vh',
        display: 'flex', alignItems: 'center',
      }}>
        {/* Background image */}
        <img src={heroImageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,24,16,0.58)' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, fontFamily: FONT }}>
            Markedsplads for institutioner
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 36, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#fff', marginBottom: 18 }}>
            Legetøj til glæde<br /><span style={{ color: GREEN_SOFT }}>for alle.</span>
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, marginBottom: 28 }}>
            Den første markedsplads hvor børnehaver, skoler og SFO'er køber, sælger og bytter legetøj direkte med hinanden — sikkert og bæredygtigt.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32, justifyContent: 'center' }}>
            <button onClick={() => router.push('/signup')} style={{ background: PAPER, color: PRIMARY, border: 'none', borderRadius: 999, padding: '12px 24px', fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>
              Tilmeld institution
            </button>
            <button onClick={() => router.push('/opslag')} style={{ background: 'transparent', color: 'rgba(255,255,255,0.88)', border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 999, padding: '12px 20px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>
              Se markedspladsen →
            </button>
          </div>
          {statsRow}
        </div>

        {/* Wave into next section */}
        <svg viewBox="0 0 1440 72" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
          <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill={PAPER} />
        </svg>
      </section>
    );
  }

  /* Desktop: image fills right side, white floating card on left */
  return (
    <section style={{
      position: 'relative', overflow: 'hidden',
      minHeight: '88vh',
      display: 'flex', alignItems: 'stretch',
    }}>
      {/* Right: hero image — left-anchored zoom nudges both kids right, clear of the card */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <img src={heroImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.12)', transformOrigin: '0% 45%', display: 'block' }} />
        {/* soft left fade so the card blends in without washing out the boy */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 14%, rgba(255,255,255,0.40) 30%, rgba(255,255,255,0) 44%)' }} />
      </div>

      {/* Left: floating white card — anchored to the viewport edge, responsive width */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', padding: '120px 0 100px', width: '100%', paddingLeft: 'clamp(32px, 6vw, 96px)', paddingRight: 32 }}>
        <div style={{
          background: 'rgba(255,255,255,0.97)',
          borderRadius: 24,
          padding: '52px 48px',
          maxWidth: 'clamp(340px, 33vw, 440px)',
          boxShadow: '0 24px 80px rgba(10,24,16,0.13), 0 2px 8px rgba(10,24,16,0.06)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'inline-block', background: GREEN_TINT, borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, fontFamily: FONT }}>
            Markedsplads for institutioner
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 52, letterSpacing: '-0.04em', lineHeight: 1.0, color: INK, marginBottom: 18 }}>
            Legetøj til glæde<br /><span style={{ color: PRIMARY }}>for alle.</span>
          </h1>
          <p style={{ fontSize: 16, color: INK3, lineHeight: 1.65, marginBottom: 28 }}>
            Den første markedsplads hvor børnehaver, skoler og SFO'er køber, sælger og bytter legetøj direkte med hinanden — sikkert og bæredygtigt.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 36 }}>
            <button onClick={() => router.push('/signup')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 999, padding: '13px 30px', fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>
              Tilmeld institution
            </button>
            <button onClick={() => router.push('/opslag')} style={{ background: 'transparent', color: INK2, border: `1.5px solid ${PAPER3}`, borderRadius: 999, padding: '13px 26px', fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>
              Se markedspladsen →
            </button>
          </div>
          {anyStatVisible ? (
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {showStat('institutions', stats.institutions) && (
                <div>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: INK, letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.institutions}</div>
                  <div style={{ fontSize: 11, color: INK3, marginTop: 3, fontFamily: FONT, letterSpacing: '0.02em' }}>institutioner tilmeldt</div>
                </div>
              )}
              {showStat('listings', stats.listings) && (
                <div>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: INK, letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.listings}</div>
                  <div style={{ fontSize: 11, color: INK3, marginTop: 3, fontFamily: FONT, letterSpacing: '0.02em' }}>aktive opslag</div>
                </div>
              )}
              {showStat('trades', stats.deals) && (
                <div>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: INK, letterSpacing: '-0.04em', lineHeight: 1 }}>{stats.deals}</div>
                  <div style={{ fontSize: 11, color: INK3, marginTop: 3, fontFamily: FONT, letterSpacing: '0.02em' }}>handler gennemført</div>
                </div>
              )}
            </div>
          ) : STATS_CONFIG.startupMessage ? (
            <div style={{ fontSize: 12, color: INK3, fontFamily: FONT, fontStyle: 'italic' }}>
              {STATS_CONFIG.startupMessage}
            </div>
          ) : null}
        </div>
      </div>

      {/* Wave into next section */}
      <svg viewBox="0 0 1440 72" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
        <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill={PAPER} />
      </svg>
    </section>
  );
}

/* ── Journey steps data ───────────────────────────────────── */
const JOURNEY_STEPS = [
  { emoji: '🧸', bg: '#FFFBEB', accent: '#D97706', n: '01', title: 'Legetøjet samler støv', desc: 'Du har cykler, puslespil eller møbler der ikke bruges. Et andet sted vil de gøre børn glade.' },
  { emoji: '📸', bg: '#F0FDF4', accent: '#16A34A', n: '02', title: 'Opret et opslag på 2 min.', desc: 'Tag ét billede. AI udfylder titel, kategori og beskrivelse automatisk. Nemmere end en brugtannonce.' },
  { emoji: '💬', bg: '#EFF6FF', accent: '#2563EB', n: '03', title: 'Institutioner byder og skriver', desc: 'Verificerede børnehaver og skoler kontakter dig direkte. Byd, byt eller sælg — du bestemmer.' },
  { emoji: '🚀', bg: '#FDF4FF', accent: '#9333EA', n: '04', title: 'Nyt hjem, ny glæde', desc: 'I aftaler pris og afhentning. Legetøjet giver glæde et nyt sted — og du har skabt plads.' },
];

/* ── How steps — shared grid, works on both mobile and desktop ── */
function HowStepsSection() {
  const w = useWindowWidth();
  const isMobile = w < 768;
  const cardRefs = useRef([]);
  const [visible, setVisible] = useState(new Set());

  useEffect(() => {
    const observers = cardRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) setVisible(v => new Set([...v, i]));
      }, { threshold: 0.18 });
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <section style={{ background: PAPER, padding: isMobile ? '60px 20px 80px' : '80px 24px 100px', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes how-fade-up {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .how-card-visible {
          animation: how-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .how-card-hidden {
          opacity: 0;
        }
      `}</style>

      {/* Section header */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? 40 : 56 }}>
        <div style={{ display: 'inline-block', background: GREEN_TINT, borderRadius: 999, padding: '5px 16px', fontSize: 11, fontWeight: 700, color: PRIMARY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, fontFamily: FONT }}>
          Sådan virker det
        </div>
        <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 30 : 42, color: INK, letterSpacing: '-0.04em', lineHeight: 1.1, margin: 0 }}>
          Fra støv til glæde
        </h2>
      </div>

      {/* 4-card grid: 2×2 on mobile, 1×4 on desktop */}
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? 16 : 24,
      }}>
        {JOURNEY_STEPS.map((step, i) => (
          <div
            key={i}
            ref={el => cardRefs.current[i] = el}
            className={visible.has(i) ? 'how-card-visible' : 'how-card-hidden'}
            style={{
              animationDelay: `${i * 0.1}s`,
              background: '#fff',
              borderRadius: 20,
              padding: isMobile ? '24px 20px' : '32px 28px',
              boxShadow: '0 2px 16px rgba(22,34,28,0.07), 0 1px 4px rgba(22,34,28,0.04)',
              border: '1px solid rgba(22,34,28,0.06)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Big step number watermark */}
            <div style={{
              position: 'absolute', top: 8, right: 14,
              fontFamily: FONT, fontWeight: 800,
              fontSize: isMobile ? 56 : 72,
              color: step.accent,
              opacity: 0.10,
              lineHeight: 1,
              userSelect: 'none',
              letterSpacing: '-0.06em',
            }}>
              {step.n}
            </div>

            {/* Emoji */}
            <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: isMobile ? 14 : 20, lineHeight: 1 }}>
              {step.emoji}
            </div>

            {/* Title */}
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 14 : 16, color: INK, marginBottom: 8, lineHeight: 1.3 }}>
              {step.title}
            </div>

            {/* Description */}
            <p style={{ fontSize: isMobile ? 12 : 13, color: INK3, lineHeight: 1.65, margin: 0 }}>
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Wave into TradeTypesStrip (GREEN_TINT) */}
      <svg viewBox="0 0 1440 72" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
        <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill={GREEN_TINT} />
      </svg>
    </section>
  );
}

/* ── Trade types strip ────────────────────────────────────── */
function TradeTypesStrip() {
  const w = useWindowWidth();
  const isMobile = w < 640;

  return (
    <section style={{ background: GREEN_TINT, padding: isMobile ? '40px 20px' : '48px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 16 : 0 }}>
        {[
          { key: 'køb', title: 'Køb', sub: 'Fastpris', desc: 'Se prisen og køb med det samme.' },
          { key: 'byt', title: 'Byt', sub: 'Bytehandel', desc: 'Tilbyd et af jeres egne opslag i bytte.' },
          { key: 'byd', title: 'Byd', sub: 'Forhandl', desc: 'Send et bud og aftal en pris der passer begge.' },
        ].map((t, i) => {
          const tc = TYPE_CFG[t.key];
          return (
            <div key={i} style={{
              padding: isMobile ? '20px 24px' : '28px 32px',
              borderRight: !isMobile && i < 2 ? `1px solid ${GREEN_SOFT}` : 'none',
              textAlign: isMobile ? 'left' : 'center',
              display: 'flex', flexDirection: isMobile ? 'row' : 'column',
              alignItems: isMobile ? 'center' : 'initial',
              gap: isMobile ? 16 : 0,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: isMobile ? 0 : '0 auto 14px' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: tc.color }} />
              </div>
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, marginBottom: 2 }}>{t.title}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: tc.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: FONT }}>{t.sub}</div>
                <p style={{ fontSize: 13, color: INK3, lineHeight: 1.6, margin: 0 }}>{t.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Wave into MissionSection (GREEN_DEEP) */}
      <svg viewBox="0 0 1440 72" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
        <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill={GREEN_DEEP} />
      </svg>
    </section>
  );
}

/* ── Listings preview ─────────────────────────────────────── */
function ListingsPreview({ listings, loading, goToInstitution }) {
  const router = useRouter();
  const { setActiveListing, favs, toggleFav } = useApp();
  const [filter, setFilter] = useState('alle');
  const w = useWindowWidth();
  const isMobile = w < 640;

  const shown = useMemo(() => {
    let r = filter === 'alle' ? listings : listings.filter(l => l.type === filter);
    return r.slice(0, 8);
  }, [listings, filter]);

  return (
    <section style={{ background: PAPER2, padding: isMobile ? '48px 16px 72px' : '64px 24px 96px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 38, color: INK, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 4 }}>
              Nye opslag
            </div>
            <p style={{ color: INK3, fontSize: 14, fontFamily: FONT }}>Fra verificerede institutioner i hele Danmark</p>
          </div>
          <button onClick={() => router.push('/opslag')} style={{
            background: 'none', border: `1.5px solid ${PRIMARY}`, color: PRIMARY,
            borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700,
            fontFamily: FONT, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            Se alle annoncer →
          </button>
        </div>

        {/* Type pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
          {[{ key: 'alle', label: 'Alle' }, ...Object.entries(TYPE_CFG).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => {
            const active = filter === key;
            const tc = key !== 'alle' ? TYPE_CFG[key] : null;
            return (
              <button key={key} onClick={() => setFilter(key)} style={{
                padding: '6px 16px', borderRadius: 999, fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                border: active ? 'none' : `1.5px solid ${PAPER3}`,
                background: active ? (tc ? tc.color : PRIMARY) : PAPER,
                color: active ? '#fff' : INK2,
              }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 18 }}>
          {loading
            ? [1,2,3,4].map(i => <SkeletonCard key={i} />)
            : shown.map(l => (
                <ListingCard key={l.id} listing={l} favs={favs} toggleFav={toggleFav}
                  onClick={() => { setActiveListing(l); router.push('/opslag/detail'); }}
                  onInstitutionClick={goToInstitution}
                />
              ))
          }
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: 'center', marginTop: 44 }}>
          <button onClick={() => router.push('/opslag')} style={{
            background: PRIMARY, color: '#fff',
            border: 'none', borderRadius: 999, padding: '14px 40px',
            fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
          }}>
            Se alle {listings.length} annoncer
          </button>
        </div>
      </div>

      {/* Wave into HowStepsSection (PAPER) */}
      <svg viewBox="0 0 1440 72" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
        <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill={PAPER} />
      </svg>
    </section>
  );
}

/* ── Mission ──────────────────────────────────────────────── */
function MissionSection() {
  const w = useWindowWidth();
  const isMobile = w < 768;

  const points = [
    { title: 'Kun verificerede institutioner', desc: 'CVR-tjek sikrer at alle på platformen er godkendte.' },
    { title: 'Spar penge', desc: 'Kvalitetslegetøj til en brøkdel af nyprisen.' },
    { title: 'Cirkulær økonomi', desc: 'Giv legetøj nyt liv frem for at smide det ud.' },
    { title: 'Valgfri transport', desc: 'Levering direkte til institutionen hvis ønsket.' },
  ];

  return (
    <section style={{ background: GREEN_DEEP, padding: isMobile ? '72px 20px' : '100px 24px', position: 'relative', overflow: 'hidden' }}>
      {/* texture */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 15% 50%, rgba(42,125,79,0.4) 0%, transparent 55%), radial-gradient(circle at 85% 20%, rgba(207,227,216,0.06) 0%, transparent 50%)`, pointerEvents: 'none' }} />

      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 48 : 72 }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '5px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontFamily: FONT }}>
            Vores mission
          </div>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 44, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.05, marginBottom: 16 }}>
            Vi tror på at legetøj<br />fortjener flere liv.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, lineHeight: 1.65, maxWidth: 460, margin: '0 auto' }}>
            byt&amp;leg forbinder danske institutioner i et fællesskab, hvor ressourcer deles og miljøet passes på.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: isMobile ? 16 : 20 }}>
          {points.map((p, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '28px 28px',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN_SOFT, marginBottom: 16 }} />
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: '#fff', marginBottom: 6 }}>{p.title}</div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: 0 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wave into PlatformCO2Stat (GREEN_TINT) */}
      <svg viewBox="0 0 1440 72" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
        <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill={GREEN_TINT} />
      </svg>
    </section>
  );
}

/* ── Platform CO₂ stat — Niveau 3 ────────────────────────── */
function PlatformCO2Stat() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 640;
  const [totalKg, setTotalKg] = useState(null);
  const [tradeCount, setTradeCount] = useState(null);

  useEffect(() => {
    db.from('transaction_co2_savings')
      .select('net_saved_kg', { count: 'exact' })
      .then(({ data, count }) => {
        if (data) {
          const sum = data.reduce((s, r) => s + (r.net_saved_kg || 0), 0);
          setTotalKg(Math.round(sum * 10) / 10);
          setTradeCount(count || data.length);
        }
      });
  }, []);

  const displayTons = totalKg != null && totalKg >= 10;
  const displayVal  = totalKg == null ? '…'
    : displayTons ? (totalKg / 1000).toFixed(2) + ' tons'
    : totalKg + ' kg';
  const comparison  = totalKg ? getCO2Comparison(totalKg) : null;

  return (
    <section style={{ background: GREEN_TINT, padding: isMobile ? '56px 20px' : '80px 24px', textAlign: 'center', borderTop: `1px solid ${GREEN_SOFT}` }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: PRIMARY, marginBottom: 14, opacity: 0.7 }}>
          Fællesskabets miljøindsats
        </div>
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: isMobile ? 32 : 52, color: PRIMARY, letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 8px' }}>
          🌱 ≈ {displayVal} CO₂e
        </h2>
        <p style={{ fontSize: 15, color: '#3A473D', fontFamily: "'Sora',sans-serif", marginBottom: 6 }}>
          estimeret sparet af byt&amp;leg-fællesskabet
          {tradeCount ? ` på tværs af ${tradeCount} handler` : ''}
        </p>
        {comparison && <p style={{ fontSize: 13, color: PRIMARY, fontFamily: "'Sora',sans-serif", marginBottom: 0, opacity: 0.8 }}>{comparison}</p>}
        <button onClick={() => router.push('/baeredygtighed/metode')}
          style={{ marginTop: 18, background: 'none', border: `1.5px solid ${PRIMARY}`, borderRadius: 99, padding: '7px 18px', fontSize: 12, fontWeight: 700, color: PRIMARY, cursor: 'pointer', fontFamily: "'Sora',sans-serif" }}>
          Sådan beregner vi det →
        </button>
        <p style={{ fontSize: 10, color: PRIMARY, opacity: 0.5, fontFamily: "'Sora',sans-serif", marginTop: 10 }}>
          Alle tal er estimater baseret på publiceret LCA-litteratur. Se metode-siden for fuld dokumentation.
        </p>
      </div>
    </section>
  );
}

/* ── CTA banner ───────────────────────────────────────────── */
function CtaBanner() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 640;

  return (
    <section style={{
      background: `linear-gradient(135deg, ${PRIMARY} 0%, ${GREEN_DEEP} 100%)`,
      padding: isMobile ? '72px 24px' : '100px 24px',
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 70% 30%, rgba(241,196,75,0.07) 0%, transparent 50%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto' }}>
        <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 30 : 46, letterSpacing: '-0.04em', color: '#fff', marginBottom: 14, lineHeight: 1.05 }}>
          Klar til at komme i gang?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 16, lineHeight: 1.65, marginBottom: 36 }}>
          Tilmeld din institution gratis og bliv en del af Danmarks bæredygtige legetøjsfællesskab.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/signup')} style={{
            background: PAPER, color: PRIMARY, border: 'none', borderRadius: 999,
            padding: '14px 32px', fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
          }}>
            Tilmeld institution
          </button>
          <button onClick={() => router.push('/opslag')} style={{
            background: 'transparent', color: 'rgba(255,255,255,0.85)',
            border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 999,
            padding: '14px 32px', fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
          }}>
            Se markedspladsen →
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const { listings, loadingListings, fetchListings, refreshSeed, realUserId, institution } = useApp();
  const w = useWindowWidth();
  const isMobile = w !== null && w < 768;
  const [heroStats, setHeroStats] = useState(null);

  useEffect(() => {
    Promise.all([
      db.from('institutions').select('id', { count: 'exact', head: true }),
      db.from('listings').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_sold', false),
      db.from('conversations').select('id', { count: 'exact', head: true }).eq('deal_completed', true),
    ]).then(([{ count: instCount }, { count: listCount }, { count: dealCount }]) => {
      setHeroStats({
        institutions: instCount || 0,
        listings: listCount || 0,
        deals: dealCount || 0,
      });
    });
  }, []);

  const ownFiltered = listings.filter(l =>
    l.user_id !== realUserId && !(institution?.name && l.institution_name === institution.name)
  );
  const visibleListings = useFeedListings(ownFiltered, refreshSeed);

  if (isMobile) {
    return (
      <PullToRefresh onRefresh={fetchListings}>
        <MobileHomeFeed listings={visibleListings} loading={loadingListings} />
        <HowStepsSection />
        <MissionSection />
      </PullToRefresh>
    );
  }

  function goToInstitution(name) {
    router.push('/institution/' + encodeURIComponent(name));
  }

  return (
    <>
      <HeroSection stats={heroStats} />
      <ListingsPreview listings={visibleListings} loading={loadingListings} goToInstitution={goToInstitution} />
      <HowStepsSection />
      <TradeTypesStrip />
      <MissionSection />
      <PlatformCO2Stat />
      <CtaBanner />
    </>
  );
}
