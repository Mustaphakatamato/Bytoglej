'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, PAPER2, INK, INK3, CORAL, TYPE_CFG, CONDITION_COLORS } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import { db } from '@/lib/supabase';

import { useApp } from '@/providers/AppProvider';

const FONT = "'Sora', sans-serif";

export default function ListingCard({ listing, onClick, favs, toggleFav, onInstitutionClick }) {
  const router = useRouter();
  const { realUserId, institution } = useApp();
  const isOwn = listing.user_id === realUserId || (institution?.name && listing.institution_name === institution.name);
  const isFav = favs.includes(listing.id);
  const [popping, setPopping] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const imgs = listing.images?.length ? listing.images : [];

  async function handleFav(e) {
    e.stopPropagation();
    const { data: { user } } = await db.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setPopping(true);
    setTimeout(() => setPopping(false), 350);
    toggleFav(listing.id);
  }

  function prevImg(e) { e.stopPropagation(); setImgIdx(i => (i - 1 + imgs.length) % imgs.length); }
  function nextImg(e) { e.stopPropagation(); setImgIdx(i => (i + 1) % imgs.length); }

  const tc = TYPE_CFG[listing.type] || { label: listing.type, color: INK3, bg: PAPER2 };
  const condStyle = CONDITION_COLORS[listing.condition] || { bg: PAPER2, color: INK3 };

  return (
    <div className="card" onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      background: PAPER2,
      borderRadius: 20,
      overflow: 'hidden',
      cursor: 'pointer',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(22,34,28,0.06)',
      boxShadow: '0 1px 4px rgba(22,34,28,0.06)',
    }}>
      {/* Image */}
      <div style={{
        height: 180,
        background: imgs.length ? '#ddd' : GREEN_TINT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        {imgs.length > 1 ? (
          <>
            <img src={imgs[imgIdx]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', position:'absolute', inset:0, opacity: hovered ? 0 : 1, transition:'opacity 0.3s ease' }} />
            <img src={imgs[(imgIdx + 1) % imgs.length]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', position:'absolute', inset:0, opacity: hovered ? 1 : 0, transition:'opacity 0.3s ease' }} />
          </>
        ) : imgs.length === 1 ? (
          <img src={imgs[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        ) : (
          <span style={{ fontSize:52, opacity:0.45 }}>{listing.emoji || '🧸'}</span>
        )}
        {imgs.length > 1 && <>
          <button onClick={prevImg} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(22,34,28,0.52)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={nextImg} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(22,34,28,0.52)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
            {imgs.map((_, i) => <div key={i} style={{ width: i === imgIdx ? 14 : 6, height: 6, borderRadius: 99, background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }} />)}
          </div>
        </>}
        {!isOwn && <button
          className={`fav-btn${popping ? ' fav-pop' : ''}`}
          onClick={handleFav}
          style={{
            position: 'absolute', bottom: 10, right: 10,
            background: isFav ? 'rgba(22,34,28,0.72)' : 'rgba(246,242,234,0.88)',
            border: 'none', borderRadius: '50%', width: 34, height: 34,
            fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? '#e11d48' : 'none'} stroke={isFav ? '#e11d48' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {listing._isNew && <span style={{ background: '#22c55e', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800, fontFamily: FONT }}>Ny</span>}
          <span style={{ background: tc.bg, color: tc.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, fontFamily: FONT }}>{tc.label}</span>
          {listing.condition && (
            <span style={{ background: condStyle.bg, color: condStyle.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, fontFamily: FONT }}>{listing.condition}</span>
          )}
          {listing.category && (() => {
            const cat = CATEGORIES.find(c => c.key === listing.category);
            if (!cat) return null;
            return (
              <span style={{ display:'inline-flex', alignItems:'center', gap:3, background: GREEN_TINT, color: PRIMARY, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, fontFamily: FONT }}>
                <span>{cat.emoji}</span>
                <span>{listing.subcategory || cat.label}</span>
              </span>
            );
          })()}
          {listing.can_ship && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:3, background:'#EFF6FF', color:'#2563EB', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>
              📦 Kan sendes
            </span>
          )}
        </div>

        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK, marginBottom: 4, lineHeight: 1.3 }}>{listing.title}</div>
        {listing.description && (
          <div style={{ fontSize: 12, color: INK3, lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {listing.description}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          {listing.price
            ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: PRIMARY, marginBottom: 4 }}>{listing.price} kr.</div>
            : <div style={{ fontSize: 13, color: CORAL, fontWeight: 700, marginBottom: 4, fontFamily: FONT }}>Byttes kun</div>
          }
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: INK3, fontFamily: FONT }}>
              <span
                onClick={onInstitutionClick ? e => { e.stopPropagation(); onInstitutionClick(listing.institution_name); } : undefined}
                style={{ cursor: onInstitutionClick ? 'pointer' : 'default', textDecoration: onInstitutionClick ? 'underline' : 'none', textDecorationColor: GREEN_SOFT }}>
                {listing.institution_name}
              </span>
              {listing.city ? `, ${listing.city}` : ''}
            </div>
            {listing.fav_count > 0 && <div style={{ fontSize: 11, color: CORAL, fontWeight: 700 }}>♥ {listing.fav_count}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
