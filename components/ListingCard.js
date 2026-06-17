'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, PAPER2, INK, INK3, CORAL, TYPE_CFG, CONDITION_COLORS, FONT } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import { db } from '@/lib/supabase';

import { calcServiceFee, SWAP_PROTECTION_FEE } from '@/lib/pricing';
export { calcServiceFee, SWAP_PROTECTION_FEE };

import { useApp } from '@/providers/AppProvider';

export function BuyerProtectionPopup({ price, fee, onClose, image, emoji }) {
  const total = price + fee;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const modal = (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:420, padding:'28px 24px', boxShadow:'0 24px 64px rgba(22,34,28,0.22)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <span style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color:'#111' }}>Prisoversigt</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888', lineHeight:1, padding:4 }}>✕</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14, paddingBottom:18, borderBottom:'1px solid #eee' }}>
          <div style={{ width:40, height:40, borderRadius:8, background:'#f0f0f0', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {image
              ? <img src={image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ fontSize:22 }}>{emoji || '📦'}</span>}
          </div>
          <div>
            <div style={{ fontFamily:FONT, fontSize:14, color:'#111', fontWeight:600 }}>Varens pris</div>
            <div style={{ fontFamily:FONT, fontSize:14, color:'#111' }}>{price.toFixed(2).replace('.',',')} kr.</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14, paddingTop:18, paddingBottom:18, borderBottom:'1px solid #eee' }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:'#E6F4F1', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="#2D6A4F"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FONT, fontSize:14, color:'#111', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
              Gebyr for køberbeskyttelse
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div style={{ fontFamily:FONT, fontSize:14, color:'#111' }}>{fee.toFixed(2).replace('.',',')} kr.</div>
          </div>
        </div>
        <div style={{ marginTop:20, marginBottom:20, fontFamily:FONT, fontSize:13, color:'#666', lineHeight:1.6 }}>
          Vores gebyr for køberbeskyttelse er obligatorisk ved køb på byt&amp;leg. Det tilføjes til hvert køb og dækker dig hvis varen ikke ankommer som beskrevet.
        </div>
        <div style={{ background:'#f5f5f5', borderRadius:12, padding:'14px 16px', marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:'#111' }}>I alt inkl. beskyttelse</span>
          <span style={{ fontFamily:FONT, fontWeight:800, fontSize:16, color:'#2D6A4F' }}>{total.toFixed(2).replace('.',',')} kr.</span>
        </div>
        <button onClick={onClose} style={{ width:'100%', padding:'16px', borderRadius:99, background:'#2D6A4F', color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:'pointer' }}>
          OK, luk
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function TradeProtectionPopup({ fee = SWAP_PROTECTION_FEE, porto, onClose }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  const hasPorto = typeof porto === 'number' && porto > 0;
  const total = fee + (hasPorto ? porto : 0);
  const kr = n => `${n.toFixed(2).replace('.', ',')} kr.`;

  const modal = (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:420, padding:'28px 24px', boxShadow:'0 24px 64px rgba(22,34,28,0.22)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <span style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color:'#111' }}>Byttebeskyttelse</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888', lineHeight:1, padding:4 }}>✕</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14, paddingBottom:18, borderBottom:'1px solid #eee' }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:'#E6F4F1', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="#2D6A4F"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FONT, fontSize:14, color:'#111', fontWeight:600 }}>Gebyr for byttebeskyttelse</div>
            <div style={{ fontFamily:FONT, fontSize:14, color:'#111' }}>{kr(fee)}</div>
          </div>
        </div>
        {hasPorto && (
          <div style={{ display:'flex', alignItems:'center', gap:14, paddingTop:18, paddingBottom:18, borderBottom:'1px solid #eee' }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20 }}>📦</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FONT, fontSize:14, color:'#111', fontWeight:600 }}>Porto for din vare</div>
              <div style={{ fontFamily:FONT, fontSize:14, color:'#111' }}>{kr(porto)}</div>
            </div>
          </div>
        )}
        <div style={{ marginTop:20, marginBottom:20, fontFamily:FONT, fontSize:13, color:'#666', lineHeight:1.6 }}>
          Ved en byttehandel betaler <strong>begge parter</strong> et fast gebyr på {kr(fee)} for byttebeskyttelse. Beskyttelsen dækker jer hvis den modtagne vare ikke ankommer eller ikke matcher beskrivelsen. Begge pakkemærkater frigives først når <strong>begge parter har betalt</strong> — så ingen sender uden at modparten også har forpligtet sig.
        </div>
        <div style={{ background:'#f5f5f5', borderRadius:12, padding:'14px 16px', marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:'#111' }}>{hasPorto ? 'Du betaler i alt' : 'Du betaler'}</span>
          <span style={{ fontFamily:FONT, fontWeight:800, fontSize:16, color:'#2D6A4F' }}>{kr(total)}</span>
        </div>
        <button onClick={onClose} style={{ width:'100%', padding:'16px', borderRadius:99, background:'#2D6A4F', color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:'pointer' }}>
          OK, luk
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default function ListingCard({ listing, onClick, favs, toggleFav, onInstitutionClick }) {
  const router = useRouter();
  const { realUserId, institution } = useApp();
  const isOwn = listing.user_id === realUserId || (institution?.name && listing.institution_name === institution.name);
  const isFav = favs.includes(listing.id);
  const [popping, setPopping] = useState(false);
  const [showFeePopup, setShowFeePopup] = useState(false);
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
      height: '100%',
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
            <img src={imgs[imgIdx]} alt={listing.title || ''} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', position:'absolute', inset:0, opacity: hovered ? 0 : 1, transition:'opacity 0.3s ease' }} />
            <img src={imgs[(imgIdx + 1) % imgs.length]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', position:'absolute', inset:0, opacity: hovered ? 1 : 0, transition:'opacity 0.3s ease' }} />
          </>
        ) : imgs.length === 1 ? (
          <img src={imgs[0]} alt={listing.title || ''} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
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
          {(() => {
            const so = listing.shipping_options?.[0];
            if (!so && !listing.can_ship) return null;
            const badges = [];
            if (so?.allow_pickup) badges.push({ icon:'📍', label:'Afhentes', bg:'#F0FDF4', color:'#16a34a' });
            if (so?.allow_shipping || (!so && listing.can_ship)) badges.push({ icon:'📦', label:'Kan sendes', bg:'#EFF6FF', color:'#2563EB' });
            if (so?.allow_custom) badges.push({ icon:'🤝', label:'Aftalt', bg:'#FEF9C3', color:'#92400e' });
            return badges.map(b => (
              <span key={b.label} style={{ display:'inline-flex', alignItems:'center', gap:3, background:b.bg, color:b.color, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>
                {b.icon} {b.label}
              </span>
            ));
          })()}
        </div>

        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK, marginBottom: 2, lineHeight: 1.3 }}>{listing.title}</div>
        {listing.brand && <div style={{ fontSize: 11, color: INK3, fontFamily: FONT, fontWeight: 600, marginBottom: 4 }}>{listing.brand}</div>}
        {listing.description && (
          <div style={{ fontSize: 12, color: INK3, lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {listing.description}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          {listing.price
            ? (() => {
                const fee = calcServiceFee(listing.price);
                const total = listing.price + fee;
                return (
                  <div style={{ marginBottom:4 }}>
                    <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginBottom:2 }}>{listing.price} kr.</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color:PRIMARY }}>{total.toFixed(2).replace('.',',')} kr. inkl.</span>
                      <button onClick={e=>{ e.stopPropagation(); setShowFeePopup(true); }} style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', color:PRIMARY, flexShrink:0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill={PRIMARY} opacity="0.85"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                    {showFeePopup && <BuyerProtectionPopup price={listing.price} fee={fee} image={listing.images?.[0]} emoji={listing.emoji} onClose={() => setShowFeePopup(false)} />}
                  </div>
                );
              })()
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
