'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import ListingCard from '@/components/ListingCard';

export default function InstitutionPage() {
  const params = useParams();
  const institutionName = decodeURIComponent(params.name);
  const router = useRouter();
  const { favs, toggleFav, setActiveListing } = useApp();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inst, setInst] = useState(null);
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      db.from('listings').select('*').eq('institution_name', institutionName).eq('is_active', true).eq('is_sold', false).order('created_at', { ascending: false }),
      db.from('institutions').select('*').eq('name', institutionName).maybeSingle(),
    ]).then(([{ data: lst }, { data: instData }]) => {
      if (lst) setListings(lst);
      if (instData) setInst(instData);
      setLoading(false);
    });
  }, [institutionName]);

  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:'#f8f5f0' }} className="page-enter">
      <div style={{ maxWidth:1140, margin:'0 auto', padding:isMobile?'24px 16px':'36px 24px' }}>
        <button onClick={()=>router.push('/opslag')} style={{ background:'none', border:'none', color:PRIMARY, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
          ← Tilbage til opslag
        </button>
        <div style={{ background:'#fff', borderRadius:22, padding:isMobile?'20px 16px':'28px 32px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{ width:60, height:60, borderRadius:16, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
              {inst?.logo_url
                ? <img src={inst.logo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                : <span style={{ color:'#fff', fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:22 }}>{institutionName.charAt(0).toUpperCase()}</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:isMobile?22:28, marginBottom:4 }}>{institutionName}</h1>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:13, color:'#888' }}>
                {inst?.city && <span>📍 {inst.city}</span>}
                {inst?.institution_type && <span>🏫 {inst.institution_type}</span>}
                {inst?.ownership_type && <span>🏢 {inst.ownership_type}</span>}
                {inst?.phone && <span>📞 {inst.phone}</span>}
              </div>
            </div>
            <div style={{ background:'#E8F5EE', borderRadius:12, padding:'10px 18px', textAlign:'center', flexShrink:0 }}>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:22, color:PRIMARY }}>{listings.length}</div>
              <div style={{ fontSize:12, color:'#888' }}>aktive opslag</div>
            </div>
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>⏳</div>
            <p>Indlæser opslag…</p>
          </div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb', background:'#fff', borderRadius:22, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
            <p style={{ fontSize:14 }}>Ingen aktive opslag fra {institutionName}</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(auto-fill,minmax(260px,1fr))', gap:isMobile?12:16 }}>
            {listings.map(l => (
              <ListingCard key={l.id} listing={l} favs={favs} toggleFav={toggleFav}
                onClick={()=>{ setActiveListing(l); router.push('/opslag/detail'); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
