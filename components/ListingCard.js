'use client';
import { useState } from 'react';
import { PRIMARY, CONDITION_COLORS } from '@/lib/constants';
import { db } from '@/lib/supabase';

export default function ListingCard({ listing, onClick, favs, toggleFav, onInstitutionClick }) {
  const isFav = favs.includes(listing.id);
  const [popping, setPopping] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [localFavCount, setLocalFavCount] = useState(listing.fav_count || 0);
  const imgs = listing.images?.length ? listing.images : [];
  function handleFav(e) {
    e.stopPropagation();
    const adding = !isFav;
    toggleFav(listing.id);
    setPopping(true);
    setTimeout(()=>setPopping(false), 350);
    const newCount = Math.max(0, localFavCount + (adding ? 1 : -1));
    setLocalFavCount(newCount);
    db.from('listings').update({ fav_count: newCount }).eq('id', listing.id).select()
      .then(({ data, error }) => { console.log('[fav_count]', { newCount, id: listing.id, data, error }); });
  }
  function prevImg(e) { e.stopPropagation(); setImgIdx(i => (i - 1 + imgs.length) % imgs.length); }
  function nextImg(e) { e.stopPropagation(); setImgIdx(i => (i + 1) % imgs.length); }
  const condStyle = CONDITION_COLORS[listing.condition] || { bg:'#f3f4f6', color:'#555' };
  const typeColors = { køb:{ bg:'#e6f9f0', color:'#1a7a4a' }, byd:{ bg:'#fef3c7', color:'#92400e' }, byt:{ bg:'#dbeafe', color:'#1e40af' } };
  const tc = typeColors[listing.type] || { bg:'#f3f4f6', color:'#555' };
  const typeLabel = { køb:'Køb', byd:'Byd', byt:'Byt' }[listing.type] || listing.type;
  return (
    <div className="card" onClick={onClick} style={{ background:'#fff', borderRadius:16, overflow:'hidden', cursor:'pointer', boxShadow:'0 2px 12px rgba(0,0,0,0.07)', position:'relative', display:'flex', flexDirection:'column' }}>
      <div style={{ height:180, background:imgs.length?'#e8e6e3':listing.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', flexShrink:0 }}>
        {imgs.length
          ? <img src={imgs[imgIdx]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          : <span style={{ fontSize:64 }}>{listing.emoji||'🧸'}</span>
        }
        {imgs.length > 1 && <>
          <button onClick={prevImg} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.62)', border:'none', borderRadius:'50%', width:34, height:34, color:'#fff', fontSize:20, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>‹</button>
          <button onClick={nextImg} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.62)', border:'none', borderRadius:'50%', width:34, height:34, color:'#fff', fontSize:20, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>›</button>
          <div style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', display:'flex', gap:4 }}>
            {imgs.map((_,i) => <div key={i} style={{ width:i===imgIdx?14:6, height:6, borderRadius:99, background:i===imgIdx?'#fff':'rgba(255,255,255,0.5)', transition:'all 0.2s' }} />)}
          </div>
        </>}
        <button className={`fav-btn${popping?' fav-pop':''}`} onClick={handleFav}
          style={{ position:'absolute', top:10, left:10, background:isFav?'#fff0f3':'rgba(255,255,255,0.95)', border:'none', borderRadius:'50%', width:32, height:32, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
          {isFav ? '❤️' : '🤍'}
        </button>
      </div>
      <div style={{ padding:'12px 14px 16px', flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
          <span style={{ background:tc.bg, color:tc.color, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{typeLabel}</span>
          {listing.condition && <span style={{ background:condStyle.bg, color:condStyle.color, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{listing.condition}</span>}
        </div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15, marginBottom:4, lineHeight:1.3 }}>{listing.title}</div>
        {listing.description && <div style={{ fontSize:12, color:'#777', lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{listing.description}</div>}
        <div style={{ marginTop:'auto' }}>
          {listing.price
            ? <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:17, color:PRIMARY, marginBottom:4 }}>{listing.price} kr.</div>
            : <div style={{ fontSize:13, color:'#3B82C4', fontWeight:700, marginBottom:4 }}>Byttes kun</div>}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:11, color:'#aaa' }}>
              <span onClick={onInstitutionClick ? e=>{ e.stopPropagation(); onInstitutionClick(listing.institution_name); } : undefined}
                style={{ cursor:onInstitutionClick?'pointer':'default', textDecoration:onInstitutionClick?'underline':'none', textDecorationColor:'#ccc' }}>
                {listing.institution_name}
              </span>
              {listing.city ? `, ${listing.city}` : ''}
            </div>
            {localFavCount > 0 && <div style={{ fontSize:11, color:'#e57373', fontWeight:700 }}>♥ {localFavCount}</div>}
          </div>
          {listing.tags?.length > 0 && (
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
              {listing.tags.map(t => (
                <span key={t} style={{ background:'#f0f7ff', color:'#2563eb', borderRadius:99, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
