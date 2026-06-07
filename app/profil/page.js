'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';

const FONT = "'Sora', sans-serif";

function MenuItem({ icon, label, value, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', display:'flex', alignItems:'center', gap:14,
      padding:'15px 20px', background:'none', border:'none', cursor:'pointer', textAlign:'left',
      borderBottom:`1px solid ${PAPER3}`,
    }}>
      <span style={{ fontSize:18, width:24, textAlign:'center', flexShrink:0 }}>{icon}</span>
      <span style={{ flex:1, fontFamily:FONT, fontSize:15, fontWeight:600, color: danger ? '#e11d48' : INK }}>{label}</span>
      {value && <span style={{ fontFamily:FONT, fontSize:13, color:INK3, marginRight:4 }}>{value}</span>}
      {!danger && <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke={INK3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );
}

function MenuSection({ children }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)' }}>
      {children}
    </div>
  );
}

export default function ProfilPage() {
  const router = useRouter();
  const { effectiveInstitution, loggedIn, setLoggedIn } = useApp();
  const { realUserId, userId, institutionId: ctxInstId, institution: ctxInst } = useActiveUser();
  const institution = effectiveInstitution || ctxInst;
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [co2Total, setCo2Total] = useState(null);
  const [tradeCount, setTradeCount] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!institution?.id) return;
    const instId = institution.id;
    const instName = institution.name;

    // CO2 total
    db.from('transaction_co2_savings')
      .select('net_saved_kg')
      .or(`seller_institution_id.eq.${instId},buyer_institution_id.eq.${instId}`)
      .then(({ data }) => {
        if (data?.length) setCo2Total(data.reduce((s, r) => s + (r.net_saved_kg || 0), 0));
      });

    // Trade count
    db.from('conversations')
      .select('id', { count:'exact', head:true })
      .or(`owner_institution_id.eq.${instId},initiator_institution_id.eq.${instId}`)
      .eq('deal_completed', true)
      .then(({ count }) => { if (count !== null) setTradeCount(count); });

    // Pending seller tasks
    const uid = realUserId || userId;
    const ownerParts = [`owner_institution_id.eq.${instId}`];
    if (uid) ownerParts.push(`owner_id.eq.${uid}`);
    if (instName) ownerParts.push(`owner_name.eq.${instName}`);
    db.from('conversations')
      .select('id,is_handled,handled_action,deal_completed,deal_type')
      .or(ownerParts.join(','))
      .eq('deal_completed', false)
      .then(({ data }) => {
        if (data) setPendingCount(data.filter(c =>
          (!c.is_handled && c.deal_type === 'køb') ||
          (c.is_handled && c.handled_action === 'order_confirmed' && !c.deal_completed)
        ).length);
      });
  }, [institution?.id]);

  async function handleLogout() {
    await db.auth.signOut();
    setLoggedIn(false);
    router.push('/');
  }

  const initials = institution?.name?.slice(0, 2).toUpperCase() || '?';
  const bg = '#F6F2EA';

  return (
    <div style={{ minHeight:'100vh', background:bg, paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto', padding:isMobile?'0':'0 16px' }}>

        {/* Header */}
        <div style={{ background:'#fff', padding:'28px 20px 20px', marginBottom:12, boxShadow:'0 1px 3px rgba(22,34,28,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
            {institution?.logo_url ? (
              <img src={institution.logo_url} alt="" style={{ width:60, height:60, borderRadius:'50%', objectFit:'cover', border:`2px solid ${PAPER3}` }} />
            ) : (
              <div style={{ width:60, height:60, borderRadius:'50%', background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:22, fontFamily:FONT, flexShrink:0 }}>
                {initials}
              </div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{institution?.name || '—'}</div>
              <button onClick={() => institution?.name && router.push('/institution/' + encodeURIComponent(institution.name))}
                style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:FONT, fontSize:13, color:PRIMARY, fontWeight:600, marginTop:2 }}>
                Se min profil →
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[
              { label:'Handeler', value: tradeCount !== null ? tradeCount : '—', icon:'🔄' },
              { label:'CO₂ sparet', value: co2Total !== null ? `${co2Total.toFixed(1)} kg` : '—', icon:'🌱' },
              { label:'Opgaver', value: pendingCount > 0 ? pendingCount : '—', icon:'📋', highlight: pendingCount > 0 },
            ].map(stat => (
              <div key={stat.label} style={{ background: stat.highlight ? '#FEF9C3' : PAPER2, borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                <div style={{ fontSize:18, marginBottom:2 }}>{stat.icon}</div>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color: stat.highlight ? '#92400E' : INK }}>{stat.value}</div>
                <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginTop:1 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12, padding:isMobile?'0 0 12px':'0 0 12px' }}>

          {/* Handel */}
          <MenuSection>
            <MenuItem icon="📋" label="Mine handeler" value={pendingCount > 0 ? `${pendingCount} afventer` : undefined} onClick={() => router.push('/mine-handeler')} />
            <MenuItem icon="🏷️" label="Mine opslag" onClick={() => router.push('/dashboard')} />
            <MenuItem icon="❤️" label="Favoritopslag" onClick={() => router.push('/?vis=favoritter')} />
            <MenuItem icon="💬" label="Beskeder" onClick={() => router.push('/beskeder')} />
          </MenuSection>

          {/* Konto */}
          <MenuSection>
            <MenuItem icon="✏️" label="Rediger profil" onClick={() => router.push('/profil/rediger')} />
            <MenuItem icon="🌱" label="Bæredygtighed" onClick={() => router.push('/baeredygtighed')} />
          </MenuSection>

          {/* Support */}
          <MenuSection>
            <MenuItem icon="❓" label="Hjælp & vejledning" onClick={() => router.push('/hvordan')} />
            <MenuItem icon="📧" label="Kontakt os" onClick={() => router.push('/kontakt')} />
          </MenuSection>

          {/* Log ud */}
          <MenuSection>
            <MenuItem icon="🚪" label="Log ud" danger onClick={handleLogout} />
          </MenuSection>

          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <span style={{ fontFamily:FONT, fontSize:11, color:INK3 }}>Privatlivspolitik · Vilkår og betingelser</span>
          </div>
        </div>
      </div>
    </div>
  );
}
