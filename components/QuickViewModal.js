'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG } from '@/lib/constants';
import { useApp, useActiveUser } from '@/providers/AppProvider';

const FONT = "'Sora', sans-serif";

export default function QuickViewModal({ listing, onClose }) {
  const router = useRouter();
  const { setActiveListing, setSelectedConvId, showToast } = useApp();
  const { userId, institutionId, institution } = useActiveUser();
  const [imgIdx, setImgIdx] = useState(0);
  const [contacting, setContacting] = useState(false);

  const imgs = listing.images?.length ? listing.images : [];
  const tc = TYPE_CFG[listing.type] || { label: listing.type, color: INK3, bg: PAPER2 };

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function handleContact() {
    setContacting(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); setContacting(false); return; }
      const { data: ownerInst } = await db.from('institutions').select('id,user_id,email,name').ilike('name', listing.institution_name).maybeSingle();
      const myInstId = institutionId || null;
      const senderName = institution?.name || user.email;
      const orFilter = myInstId ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${user.id}` : `initiator_id.eq.${user.id}`;
      const { data: existing } = await db.from('conversations').select('id').eq('listing_id', listing.id).or(orFilter).maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: conv } = await db.from('conversations').insert({
          listing_id: listing.id,
          listing_title: listing.title,
          listing_emoji: listing.emoji || '🧸',
          listing_color: listing.color || GREEN_TINT,
          listing_image: imgs[0] || null,
          initiator_id: user.id,
          initiator_name: senderName,
          initiator_institution_id: myInstId,
          owner_id: listing.user_id,
          owner_name: listing.institution_name,
          owner_institution_id: ownerInst?.id || null,
        }).select().single();
        convId = conv?.id;
        if (convId && ownerInst?.email && ownerInst.email.toLowerCase() !== user.email.toLowerCase()) {
          fetch('/api/notify-message', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName, listingTitle: listing.title, listingEmoji: listing.emoji, convId }),
          }).catch(() => {});
        }
      }
      if (convId) {
        if (setSelectedConvId) setSelectedConvId(convId);
        onClose();
        router.push('/beskeder');
      }
    } catch { showToast('Noget gik galt — prøv igen', 'error'); }
    setContacting(false);
  }

  function openFullPage() {
    setActiveListing(listing);
    onClose();
    router.push('/opslag/detail');
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:PAPER, borderRadius:24, maxWidth:620, width:'100%', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(22,34,28,0.3)', position:'relative' }} onClick={e=>e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose} style={{ position:'absolute', top:12, right:12, zIndex:10, width:34, height:34, borderRadius:'50%', background:'rgba(22,34,28,0.55)', border:'none', color:'#fff', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>✕</button>

        {/* Image */}
        <div style={{ height:260, background:imgs.length ? '#ddd' : (listing.color || GREEN_TINT), position:'relative', borderRadius:'24px 24px 0 0', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {imgs.length
            ? <img src={imgs[imgIdx]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <span style={{ fontSize:80, opacity:0.3 }}>{listing.emoji || '🧸'}</span>
          }
          {imgs.length > 1 && (
            <>
              <button onClick={e=>{e.stopPropagation();setImgIdx(i=>(i-1+imgs.length)%imgs.length);}} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', background:'rgba(22,34,28,0.5)', border:'none', borderRadius:'50%', width:36, height:36, color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
              <button onClick={e=>{e.stopPropagation();setImgIdx(i=>(i+1)%imgs.length);}} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'rgba(22,34,28,0.5)', border:'none', borderRadius:'50%', width:36, height:36, color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
              <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', gap:5 }}>
                {imgs.map((_,i) => <div key={i} style={{ width:i===imgIdx?14:6, height:6, borderRadius:99, background:i===imgIdx?'#fff':'rgba(255,255,255,0.45)', transition:'all 0.2s' }} />)}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div style={{ padding:'20px 24px 24px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ background:tc.bg, color:tc.color, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{tc.label}</span>
            {listing.condition && <span style={{ background:PAPER3, color:INK2, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{listing.condition}</span>}
            {listing.age_group && <span style={{ background:PAPER2, color:INK3, borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:600, fontFamily:FONT }}>{listing.age_group}</span>}
          </div>

          <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:INK, letterSpacing:'-0.03em', marginBottom:8, lineHeight:1.2 }}>{listing.title}</h2>

          <div style={{ marginBottom:12 }}>
            {listing.type === 'køb' && listing.price
              ? <span style={{ fontFamily:FONT, fontWeight:800, fontSize:22, color:PRIMARY }}>{listing.price} kr.</span>
              : listing.type === 'byt'
              ? <span style={{ fontSize:15, color:CORAL, fontWeight:700, fontFamily:FONT }}>Byttes kun</span>
              : <span style={{ fontSize:15, color:'#7C3AED', fontWeight:700, fontFamily:FONT }}>Afgiv bud</span>
            }
            {listing.type === 'byd' && listing.min_bid && <span style={{ fontSize:12, color:INK3, marginLeft:8, fontFamily:FONT }}>Mindstebud: {listing.min_bid} kr.</span>}
          </div>

          {listing.description && (
            <p style={{ fontSize:14, color:INK2, lineHeight:1.65, marginBottom:14, fontFamily:FONT }}>{listing.description}</p>
          )}

          {listing.tags?.length > 0 && (
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:14 }}>
              {listing.tags.map(t => <span key={t} style={{ background:GREEN_TINT, color:PRIMARY, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{t}</span>)}
            </div>
          )}

          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'10px 14px', background:PAPER2, borderRadius:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:14, fontFamily:FONT, flexShrink:0 }}>
              {listing.institution_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK }}>{listing.institution_name}</div>
              {listing.city && <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>{listing.city}</div>}
            </div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleContact} disabled={contacting} style={{ flex:2, padding:'14px', borderRadius:99, background:contacting?PAPER3:PRIMARY, color:contacting?INK3:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:contacting?'not-allowed':'pointer', transition:'all 0.2s' }}>
              {contacting ? 'Åbner samtale…' : listing.type === 'byt' ? 'Foreslå bytte' : listing.type === 'byd' ? 'Afgiv bud' : 'Kontakt sælger'}
            </button>
            <button onClick={openFullPage} style={{ flex:1, padding:'14px', borderRadius:99, background:PAPER2, color:INK2, border:'none', fontFamily:FONT, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              Se fuld side →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
