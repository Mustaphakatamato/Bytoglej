'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER3, INK, INK3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";

function ListingCard({ l, isFav, onToggle }) {
  const router = useRouter();
  const typeLabels = { køb:'Til salg', byt:'Byttes', byd:'Afgiv bud', søges:'Søges' };
  const typeColors = { køb:{ bg:'#D1FAE5', color:'#065F46' }, byt:{ bg:'#DBEAFE', color:'#1E40AF' }, byd:{ bg:'#EDE9FE', color:'#5B21B6' }, søges:{ bg:'#FEF9C3', color:'#92400E' } };
  const tc = typeColors[l.type] || { bg:PAPER3, color:INK3 };

  return (
    <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)', border:`1px solid ${PAPER3}`, cursor:'pointer' }}
      onClick={() => router.push('/opslag/' + l.id)}>
      <div style={{ height:140, background:l.color || GREEN_TINT, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:52 }}>
        {l.images?.[0]
          ? <img src={l.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : l.emoji || '🧸'}
        <button
          onClick={e => { e.stopPropagation(); onToggle(l.id); }}
          style={{ position:'absolute', top:8, right:8, background:'rgba(255,255,255,0.9)', border:'none', borderRadius:'50%', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16 }}>
          {isFav ? '❤️' : '🤍'}
        </button>
      </div>
      <div style={{ padding:'10px 12px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
          <span style={{ fontFamily:FONT, fontSize:10, fontWeight:700, background:tc.bg, color:tc.color, borderRadius:99, padding:'2px 8px' }}>{typeLabels[l.type] || l.type}</span>
        </div>
        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>{l.title}</div>
        <div style={{ fontFamily:FONT, fontSize:11, color:INK3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.institution_name}</div>
        {l.price > 0 && (
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:PRIMARY, marginTop:4 }}>{l.price} kr.</div>
        )}
      </div>
    </div>
  );
}

export default function FavoritterPage() {
  const router = useRouter();
  const { favs, toggleFav } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();

      let ids = [];

      // Primary: fetch from DB by user_id (authoritative)
      if (user) {
        const { data: favRows } = await db.from('listing_favorites')
          .select('listing_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (favRows?.length) ids = favRows.map(r => r.listing_id);
      }

      // Fallback: use localStorage favs
      if (!ids.length && favs?.length) ids = favs;

      if (!ids.length || cancelled) { setLoading(false); return; }

      const { data } = await db.from('listings')
        .select('id,title,emoji,color,images,price,type,institution_name,is_active,is_sold')
        .in('id', ids)
        .eq('is_active', true)
        .eq('is_sold', false);

      if (!cancelled) {
        // Preserve the favorites order
        const map = Object.fromEntries((data || []).map(l => [l.id, l]));
        setListings(ids.map(id => map[id]).filter(Boolean));
        setLoading(false);
      }
    }

    boot();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 0' }}>
          <button onClick={() => router.push('/profil')} style={{ background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0, flex:1 }}>Favoritopslag</h1>
          {!loading && listings.length > 0 && (
            <span style={{ background:'#FEE2E2', color:'#e11d48', borderRadius:99, fontSize:12, fontWeight:700, padding:'3px 10px' }}>
              ❤️ {listings.length}
            </span>
          )}
        </div>

        <div style={{ padding:'12px 16px 0' }}>
          {loading ? (
            <div style={{ padding:'60px 0', textAlign:'center' }}><Spinner /></div>
          ) : listings.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center', background:'#fff', borderRadius:16 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🤍</div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>Ingen favoritopslag endnu</div>
              <div style={{ fontFamily:FONT, fontSize:13, color:INK3, marginBottom:20 }}>Tryk på hjertet på et opslag for at gemme det her</div>
              <button onClick={() => router.push('/opslag')}
                style={{ background:PRIMARY, border:'none', borderRadius:99, padding:'10px 24px', fontFamily:FONT, fontWeight:700, fontSize:14, color:'#fff', cursor:'pointer' }}>
                Udforsk opslag
              </button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {listings.map(l => (
                <ListingCard key={l.id} l={l} isFav={favs?.includes(l.id)} onToggle={toggleFav} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
