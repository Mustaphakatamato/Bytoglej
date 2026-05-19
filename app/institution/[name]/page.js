'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, INK, INK2, INK3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import ListingCard from '@/components/ListingCard';

export default function InstitutionPage() {
  const params = useParams();
  const institutionName = decodeURIComponent(params.name);
  const router = useRouter();
  const { favs, toggleFav, setActiveListing, setSelectedConvId } = useApp();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inst, setInst] = useState(null);
  const [contacting, setContacting] = useState(false);
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

  async function handleContact() {
    setContacting(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); setContacting(false); return; }
      const { data: myInst } = await db.from('institutions').select('id,name').ilike('email', user.email).maybeSingle();
      if (myInst?.name === institutionName) { setContacting(false); return; }
      const { data: ownerInst } = await db.from('institutions').select('id,user_id,email,name').eq('name', institutionName).maybeSingle();
      if (!ownerInst) { setContacting(false); return; }
      const myInstId = myInst?.id || null;
      const userName = myInst?.name || user.email;
      const { data: existing } = await db.from('conversations')
        .select('id')
        .is('listing_id', null)
        .eq('owner_institution_id', ownerInst.id)
        .or(myInstId ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${user.id}` : `initiator_id.eq.${user.id}`)
        .maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: conv } = await db.from('conversations').insert({
          listing_id: null,
          listing_title: `Besked til ${institutionName}`,
          listing_emoji: '💬',
          listing_color: '#CFE3D8',
          listing_image: null,
          initiator_id: user.id,
          initiator_name: userName,
          initiator_institution_id: myInstId,
          owner_id: ownerInst.id,
          owner_name: ownerInst.name,
          owner_institution_id: ownerInst.id,
        }).select().single();
        convId = conv?.id;
        if (convId && ownerInst.email && ownerInst.email.toLowerCase() !== user.email.toLowerCase()) {
          fetch('/api/notify-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName: userName, listingTitle: institutionName, listingEmoji: '💬', convId }),
          }).catch(() => {});
        }
      }
      if (convId && setSelectedConvId) setSelectedConvId(convId);
      router.push('/beskeder');
    } catch {}
    setContacting(false);
  }

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
          <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #e8e6e3' }}>
            <button onClick={handleContact} disabled={contacting} style={{ padding:'11px 24px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, cursor:contacting?'not-allowed':'pointer', opacity:contacting?0.7:1, display:'flex', alignItems:'center', gap:8 }}>
              {contacting ? '…' : '💬 Send besked til institution'}
            </button>
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
