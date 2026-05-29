'use client';
// v2
import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, SKY, TYPE_CFG } from '@/lib/constants';
import { useWindowWidth, useDebounce } from '@/lib/hooks';
import { SkeletonCard } from '@/components/ui';
import ListingCard from '@/components/ListingCard';
import PullToRefresh from '@/components/PullToRefresh';
import { useApp } from '@/providers/AppProvider';
import { LogoLockup } from '@/components/Logo';
import { db } from '@/lib/supabase';

const FONT = "'Sora', sans-serif";

/* ── Compact mobile listing card (Vinted-style) ───────────── */
function MobileCard({ listing, onClick, favs, toggleFav }) {
  const router = useRouter();
  const { realUserId, institution } = useApp();
  const isOwn = listing.user_id === realUserId || (institution?.name && listing.institution_name === institution.name);
  const isFav = favs.includes(listing.id);
  const [popping, setPopping] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
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
          ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: INK }}>{listing.price} kr.</div>
          : <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: CORAL }}>Byttes kun</div>}
        {listing.condition && <div style={{ fontSize: 11, color: INK3, marginTop: 2 }}>{listing.condition}</div>}
      </div>
    </div>
  );
}

/* ── Mobile home feed (Vinted-style) ──────────────────────── */
function MobileHomeFeed({ listings, loading }) {
  const router = useRouter();
  const { setQuickViewListing, favs, toggleFav } = useApp();
  const newest = useMemo(() => [...listings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 40), [listings]);

  return (
    <div style={{ background: PAPER, minHeight: '100vh', paddingTop: 68 }}>
      <div style={{ padding: '14px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: INK, letterSpacing: '-0.03em' }}>Nyeste opslag</div>
        <button onClick={() => router.push('/opslag')} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 700, color: PRIMARY, fontFamily: FONT, cursor: 'pointer' }}>Se alle →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '6px 8px 16px' }}>
        {loading
          ? [1,2,3,4,5,6,7,8].map(i => <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 12 }} />)
          : newest.map(l => (
              <MobileCard key={l.id} listing={l} favs={favs} toggleFav={toggleFav} onClick={() => setQuickViewListing(l)} />
            ))}
      </div>
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────── */
function HeroSection() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;

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
        {/* Pill badge */}
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 28, fontFamily: FONT }}>
          Markedsplads for institutioner
        </div>

        <h1 style={{
          fontFamily: FONT, fontWeight: 800,
          fontSize: isMobile ? 38 : 64,
          letterSpacing: '-0.04em', lineHeight: 1.0,
          color: '#fff', marginBottom: 22,
        }}>
          Legetøj til glæde<br />
          <span style={{ color: GREEN_SOFT }}>for alle.</span>
        </h1>

        <p style={{ fontSize: isMobile ? 15 : 18, color: 'rgba(255,255,255,0.68)', lineHeight: 1.65, maxWidth: 520, margin: '0 auto 36px' }}>
          Den første markedsplads hvor børnehaver, skoler og SFO'er køber, sælger og bytter legetøj direkte med hinanden — sikkert og bæredygtigt.
        </p>

        {/* CTA buttons */}
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

        {/* Stats row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 28 : 56, flexWrap: 'wrap' }}>
          {[
            { n: '2.847', label: 'handler gennemført' },
            { n: '156',   label: 'institutioner tilmeldt' },
            { n: '12,5 ton', label: 'CO₂ sparet' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 34, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: FONT, letterSpacing: '0.02em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Wave */}
      <svg viewBox="0 0 1440 72" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
        <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill={PAPER} />
      </svg>
    </section>
  );
}

/* ── How it works ─────────────────────────────────────────── */
function HowSection() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 640;

  const steps = [
    { n: '01', title: 'Tilmeld din institution', desc: 'Opret en verificeret profil med CVR-nummer. Godkendt på 1–2 hverdage.' },
    { n: '02', title: 'Opret dine annoncer', desc: 'Upload billeder og beskriv legetøjet. Sæt en pris eller bytteønske.' },
    { n: '03', title: 'Køb, byt eller byd', desc: 'Find det I mangler og gennemfør sikre handler direkte via platformen.' },
  ];

  return (
    <section style={{ background: PAPER, padding: isMobile ? '72px 20px' : '100px 24px', position: 'relative' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 48 : 72 }}>
          <div style={{ display: 'inline-block', background: GREEN_TINT, borderRadius: 999, padding: '5px 16px', fontSize: 11, fontWeight: 600, color: PRIMARY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontFamily: FONT }}>
            Sådan virker det
          </div>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 44, letterSpacing: '-0.04em', color: INK, lineHeight: 1.05 }}>
            Tre trin.<br /><span style={{ color: PRIMARY }}>Ét fællesskab.</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 40 : 0, position: 'relative' }}>
          {/* connector line desktop */}
          {!isMobile && (
            <div style={{ position: 'absolute', top: 44, left: '16.6%', right: '16.6%', height: 1, background: `linear-gradient(to right, ${GREEN_SOFT}, ${PRIMARY}, ${GREEN_SOFT})`, zIndex: 0 }} />
          )}
          {steps.map((s, i) => (
            <div key={i} style={{ textAlign: isMobile ? 'left' : 'center', padding: isMobile ? 0 : '0 28px', position: 'relative', zIndex: 1, display: isMobile ? 'flex' : 'block', gap: isMobile ? 20 : 0, alignItems: isMobile ? 'flex-start' : 'initial' }}>
              {/* Step number circle */}
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: PAPER2,
                border: `2px solid ${GREEN_SOFT}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: isMobile ? '0' : '0 auto 24px',
                flexShrink: 0,
              }}>
                <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: PRIMARY, letterSpacing: '-0.04em' }}>{s.n}</span>
              </div>
              <div style={{ paddingTop: isMobile ? 8 : 0 }}>
                <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, marginBottom: 8, letterSpacing: '-0.02em' }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: INK3, lineHeight: 1.65, maxWidth: isMobile ? 'none' : 220, margin: isMobile ? 0 : '0 auto' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: isMobile ? 48 : 64 }}>
          <button onClick={() => router.push('/hvordan')} style={{
            background: 'none', border: `1.5px solid ${PRIMARY}`, color: PRIMARY,
            borderRadius: 999, padding: '11px 28px', fontSize: 14, fontWeight: 700,
            fontFamily: FONT, cursor: 'pointer', letterSpacing: '-0.01em',
          }}>
            Læs mere om processen →
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Trade types strip ────────────────────────────────────── */
function TradeTypesStrip() {
  const w = useWindowWidth();
  const isMobile = w < 640;

  return (
    <section style={{ background: GREEN_TINT, padding: isMobile ? '40px 20px' : '48px 24px' }}>
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
    </section>
  );
}

/* ── Listings preview ─────────────────────────────────────── */
function ListingsPreview({ listings, loading, goToInstitution }) {
  const router = useRouter();
  const { setActiveListing, favs, toggleFav, setQuickViewListing } = useApp();
  const [filter, setFilter] = useState('alle');
  const w = useWindowWidth();
  const isMobile = w < 640;

  const shown = useMemo(() => {
    let r = filter === 'alle' ? listings : listings.filter(l => l.type === filter);
    return r.slice(0, 8);
  }, [listings, filter]);

  return (
    <section style={{ background: PAPER2, padding: isMobile ? '48px 16px 72px' : '64px 24px 96px' }}>
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
                  onClick={() => setQuickViewListing(l)}
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
  const { listings, loadingListings, fetchListings, realUserId, institution } = useApp();
  const w = useWindowWidth();
  const isMobile = w !== null && w < 768;

  const visibleListings = listings.filter(l =>
    l.user_id !== realUserId && !(institution?.name && l.institution_name === institution.name)
  );

  if (isMobile) {
    return <PullToRefresh onRefresh={fetchListings}><MobileHomeFeed listings={visibleListings} loading={loadingListings} /></PullToRefresh>;
  }

  function goToInstitution(name) {
    router.push('/institution/' + encodeURIComponent(name));
  }

  return (
    <>
      <HeroSection />
      <ListingsPreview listings={visibleListings} loading={loadingListings} goToInstitution={goToInstitution} />
      <HowSection />
      <TradeTypesStrip />
      <MissionSection />
      <CtaBanner />
    </>
  );
}
