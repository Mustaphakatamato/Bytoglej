'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER2, PAPER3, INK, INK3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";

function MenuItem({ icon, label, value, badge, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', display:'flex', alignItems:'center', gap:14,
      padding:'15px 20px', background:'none', border:'none', cursor:'pointer', textAlign:'left',
      borderBottom:`1px solid ${PAPER3}`,
    }}>
      <span style={{ fontSize:18, width:24, textAlign:'center', flexShrink:0 }}>{icon}</span>
      <span style={{ flex:1, fontFamily:FONT, fontSize:15, fontWeight:600, color: danger ? '#e11d48' : INK }}>{label}</span>
      {badge > 0 && (
        <span style={{ background:'#EF476F', color:'#fff', borderRadius:99, fontSize:11, fontWeight:800, minWidth:20, height:20, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 6px', flexShrink:0 }}>{badge}</span>
      )}
      {value && <span style={{ fontFamily:FONT, fontSize:13, color:INK3, marginRight:4, flexShrink:0 }}>{value}</span>}
      {!danger && <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink:0 }}><path d="M1 1l5 5-5 5" stroke={INK3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
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
  const { effectiveInstitution, setLoggedIn } = useApp();
  const { realUserId, userId } = useActiveUser();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [institution, setInstitution] = useState(effectiveInstitution || null);
  const [loading, setLoading] = useState(true);
  const [co2Total, setCo2Total] = useState(null);
  const [tradeCount, setTradeCount] = useState(null);
  const [activeListingCount, setActiveListingCount] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      let inst = effectiveInstitution || null;
      let uid = realUserId || userId;

      if (!inst) {
        const { data: { user } } = await db.auth.getUser();
        if (!user || cancelled) { setLoading(false); return; }
        uid = user.id;

        const { data: ownInst } = await db.from('institutions')
          .select('*').ilike('email', user.email).maybeSingle();
        if (ownInst) {
          inst = ownInst;
        } else {
          const { data: mem } = await db.from('institution_members')
            .select('role,institutions(*)').eq('email', user.email).maybeSingle();
          if (mem?.institutions) inst = { ...mem.institutions, _memberRole: mem.role };
        }
      }

      if (cancelled) return;
      setInstitution(inst);
      setLoading(false);

      if (!inst?.id) return;
      const instId = inst.id;
      const instName = inst.name;

      db.from('transaction_co2_savings')
        .select('net_saved_kg')
        .or(`seller_institution_id.eq.${instId},buyer_institution_id.eq.${instId}`)
        .then(({ data }) => {
          if (!cancelled) setCo2Total(data?.reduce((s, r) => s + (r.net_saved_kg || 0), 0) ?? 0);
        });

      db.from('conversations')
        .select('id', { count:'exact', head:true })
        .or(`owner_institution_id.eq.${instId},initiator_institution_id.eq.${instId}`)
        .eq('deal_completed', true)
        .then(({ count }) => { if (!cancelled) setTradeCount(count ?? 0); });

      const listingQueries = [];
      if (uid) listingQueries.push(
        db.from('listings').select('id').eq('user_id', uid).eq('is_active', true).eq('is_sold', false)
      );
      if (instName) listingQueries.push(
        db.from('listings').select('id').ilike('institution_name', instName).eq('is_active', true).eq('is_sold', false)
      );
      if (listingQueries.length) {
        Promise.all(listingQueries).then(results => {
          if (!cancelled) {
            const ids = new Set(results.flatMap(r => (r.data || []).map(l => l.id)));
            setActiveListingCount(ids.size);
          }
        });
      }

      const ownerParts = [`owner_institution_id.eq.${instId}`];
      if (uid) ownerParts.push(`owner_id.eq.${uid}`);
      if (instName) ownerParts.push(`owner_name.eq.${instName}`);
      db.from('conversations')
        .select('id,is_handled,handled_action,deal_completed,deal_type')
        .or(ownerParts.join(','))
        .eq('deal_completed', false)
        .then(({ data }) => {
          if (!cancelled && data) setPendingCount(data.filter(c =>
            (!c.is_handled && c.deal_type === 'køb') ||
            (c.is_handled && c.handled_action === 'order_confirmed' && !c.deal_completed)
          ).length);
        });
    }

    boot();
    return () => { cancelled = true; };
  }, [effectiveInstitution?.id]);

  async function handleLogout() {
    await db.auth.signOut();
    setLoggedIn(false);
    router.push('/');
  }

  const initials = institution?.name?.slice(0, 2).toUpperCase() || '?';

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#F6F2EA', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto', padding:isMobile?'0':'0 16px' }}>

        {/* Header */}
        <div style={{ background:'#fff', padding:'28px 20px 20px', marginBottom:12, boxShadow:'0 1px 3px rgba(22,34,28,0.06)', borderRadius: isMobile ? 0 : 16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:18 }}>
            {institution?.logo_url ? (
              <img src={institution.logo_url} alt="" style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:`2px solid ${PAPER3}`, flexShrink:0 }} />
            ) : (
              <div style={{ width:64, height:64, borderRadius:'50%', background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:24, fontFamily:FONT, flexShrink:0 }}>
                {initials}
              </div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {institution?.name || '—'}
              </div>
              {institution?.city && (
                <div style={{ fontFamily:FONT, fontSize:13, color:INK3, marginTop:2 }}>{institution.city}</div>
              )}
              {institution?.name && (
                <button onClick={() => router.push('/institution/' + encodeURIComponent(institution.name))}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:FONT, fontSize:13, color:PRIMARY, fontWeight:600, marginTop:4 }}>
                  Se offentlig profil →
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[
              { icon:'🏷️', value: activeListingCount ?? '—', label:'Aktive opslag', highlight: false, to:'/mine-opslag' },
              { icon:'🔄', value: tradeCount ?? '—', label:'Handler', highlight: false, to:'/mine-handeler' },
              { icon:'📋', value: pendingCount, label:'Opgaver', highlight: pendingCount > 0, to:'/mine-opgaver' },
            ].map(s => (
              <div key={s.label} onClick={() => router.push(s.to)} style={{ background: s.highlight ? '#FEF9C3' : PAPER2, borderRadius:12, padding:'12px 8px', textAlign:'center', cursor:'pointer' }}>
                <div style={{ fontSize:20, marginBottom:3 }}>{s.icon}</div>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color: s.highlight ? '#92400E' : INK }}>{s.value}</div>
                <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'0 0 12px' }}>

          <MenuSection>
            <MenuItem icon="🏷️" label="Mine opslag" value={activeListingCount !== null ? `${activeListingCount} aktive` : undefined} onClick={() => router.push('/mine-opslag')} />
            <MenuItem icon="📋" label="Mine opgaver" badge={pendingCount} onClick={() => router.push('/mine-opgaver')} />
            <MenuItem icon="🔄" label="Mine handler" onClick={() => router.push('/mine-handeler')} />
            <MenuItem icon="💬" label="Beskeder" onClick={() => router.push('/beskeder')} />
            <MenuItem icon="❤️" label="Favoritopslag" onClick={() => router.push('/?vis=favoritter')} />
            <MenuItem icon="🔍" label="Gemte søgninger" onClick={() => router.push('/gemte-soegninger')} />
          </MenuSection>

          <MenuSection>
            <MenuItem icon="✏️" label="Rediger profil" onClick={() => router.push('/profil/rediger')} />
            <MenuItem icon="🌱" label="Bæredygtighed" value={co2Total !== null ? `${co2Total.toFixed(1)} kg CO₂` : undefined} onClick={() => router.push('/baeredygtighed/metode')} />
          </MenuSection>

          <MenuSection>
            <MenuItem icon="❓" label="Hjælp & vejledning" onClick={() => router.push('/hvordan')} />
            <MenuItem icon="📧" label="Kontakt os" onClick={() => router.push('/kontakt')} />
          </MenuSection>

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
