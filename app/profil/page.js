'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER2, PAPER3, INK, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

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

function ActivityCard({ icon, label, sublabel, value, badge, highlight, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: highlight ? '#FEF9C3' : '#fff',
      border: `1px solid ${highlight ? '#FDE68A' : PAPER3}`,
      borderRadius: 16,
      padding: '20px 18px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      transition: 'box-shadow 0.15s',
      boxShadow: '0 1px 4px rgba(22,34,28,0.06)',
      position: 'relative',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,34,28,0.12)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(22,34,28,0.06)'}
    >
      {badge > 0 && (
        <span style={{
          position:'absolute', top:12, right:12,
          background:'#EF476F', color:'#fff', borderRadius:99,
          fontSize:11, fontWeight:800, minWidth:20, height:20,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'0 6px',
        }}>{badge}</span>
      )}
      <span style={{ fontSize:28, lineHeight:1 }}>{icon}</span>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:22, color: highlight ? '#92400E' : INK, marginTop:4 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontFamily:FONT, fontSize:14, fontWeight:700, color: highlight ? '#92400E' : INK }}>{label}</div>
      {sublabel && <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:2 }}>{sublabel}</div>}
    </button>
  );
}

export default function ProfilPage() {
  const router = useRouter();
  const { effectiveInstitution, setLoggedIn } = useApp();
  const { realUserId, userId } = useActiveUser();
  const ww = useWindowWidth();
  const isMobile = ww > 0 && ww < 768;

  const [institution, setInstitution] = useState(effectiveInstitution || null);
  const [loading, setLoading] = useState(true);
  const [co2Total, setCo2Total] = useState(null);
  const [tradeCount, setTradeCount] = useState(null);
  const [activeListingCount, setActiveListingCount] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [sentCount, setSentCount] = useState(null);
  const [notifPermission, setNotifPermission] = useState('default');
  const [notifLoading, setNotifLoading] = useState(false);
  const [inboxNotifs, setInboxNotifs] = useState([]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifPermission(Notification.permission);
  }, []);

  async function handleNotifToggle() {
    if (notifPermission === 'denied') {
      alert('Push-notifikationer er blokeret i din browser. Gå til browser-indstillinger og tillad notifikationer for bytogleg.dk, og prøv igen.');
      return;
    }
    if (notifPermission === 'granted') {
      setNotifLoading(true);
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          const { data: { session } } = await db.auth.getSession();
          if (session) {
            await fetch('/api/push-subscribe', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
          }
        }
        setNotifPermission('default');
      } catch {}
      setNotifLoading(false);
      return;
    }
    setNotifLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission !== 'granted') { setNotifLoading(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { setNotifLoading(false); return; }
      const pad = '='.repeat((4 - vapidKey.length % 4) % 4);
      const b64 = (vapidKey + pad).replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from([...window.atob(b64)].map(c => c.charCodeAt(0)));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const { data: { session } } = await db.auth.getSession();
      if (session && sub) {
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ subscription: sub }),
        });
      }
    } catch {}
    setNotifLoading(false);
  }

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

      if (instName) {
        db.from('notifications')
          .select('*')
          .eq('institution_name', instName)
          .order('created_at', { ascending: false })
          .limit(20)
          .then(({ data }) => { if (!cancelled && data) setInboxNotifs(data); });
      }

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

      const sentParts = [`initiator_institution_id.eq.${instId}`];
      if (uid) sentParts.push(`initiator_id.eq.${uid}`);
      db.from('conversations')
        .select('id', { count:'exact', head:true })
        .or(sentParts.join(','))
        .then(({ count }) => { if (!cancelled) setSentCount(count ?? 0); });

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

  /* ── MOBILE layout (unchanged) ── */
  if (isMobile) {
    return (
      <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:60, paddingBottom:90 }}>
        <div style={{ maxWidth:540, margin:'0 auto' }}>
          <div style={{ background:'#fff', padding:'28px 20px 20px', marginBottom:12, boxShadow:'0 1px 3px rgba(22,34,28,0.06)' }}>
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
            </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'0 0 12px' }}>
            {inboxNotifs.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 20px 0 20px', marginBottom:6 }}>
                  Beskeder fra byt&amp;leg {inboxNotifs.filter(n=>!n.read).length > 0 && <span style={{ background:'#EF476F', color:'#fff', borderRadius:99, fontSize:10, fontWeight:800, padding:'1px 7px', marginLeft:6 }}>{inboxNotifs.filter(n=>!n.read).length}</span>}
                </div>
                <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)' }}>
                  {inboxNotifs.map((n, i) => (
                    <button key={n.id} onClick={async () => {
                      if (!n.read) {
                        await db.from('notifications').update({ read: true }).eq('id', n.id);
                        setInboxNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                      }
                    }} style={{ width:'100%', display:'flex', alignItems:'flex-start', gap:12, padding:'14px 20px', background: n.read ? 'transparent' : '#FFF7ED', border:'none', borderBottom: i < inboxNotifs.length-1 ? `1px solid ${PAPER3}` : 'none', cursor:'pointer', textAlign:'left' }}>
                      <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{n.type === 'listing_review_approved' ? '✅' : n.type === 'listing_review_rejected' ? '❌' : '📬'}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:FONT, fontWeight: n.read ? 600 : 800, fontSize:14, color:INK, marginBottom:3 }}>{n.title}</div>
                        <div style={{ fontFamily:FONT, fontSize:12, color:INK3, lineHeight:1.5 }}>{n.body}</div>
                        <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginTop:4 }}>{new Date(n.created_at).toLocaleDateString('da-DK', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                      </div>
                      {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background:'#EF476F', flexShrink:0, marginTop:6 }} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 20px 0' }}>Jeg sælger</div>
            <MenuSection>
              <MenuItem icon="🏷️" label="Mine opslag" value={activeListingCount !== null ? `${activeListingCount} aktive` : undefined} onClick={() => router.push('/mine-opslag')} />
              <MenuItem icon="📋" label="Mine salg" badge={pendingCount} onClick={() => router.push('/mine-opgaver')} />
            </MenuSection>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 20px 0' }}>Jeg køber</div>
            <MenuSection>
              <MenuItem icon="🛍️" label="Mine ordrer" onClick={() => router.push('/mine-ordrer')} />
              <MenuItem icon="🔄" label="Byttehandler" onClick={() => router.push('/mine-handeler')} />
              <MenuItem icon="❤️" label="Favoritter" onClick={() => router.push('/favoritter')} />
              <MenuItem icon="🔍" label="Gemte søgninger" onClick={() => router.push('/gemte-soegninger')} />
            </MenuSection>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 20px 0' }}>Konto</div>
            <MenuSection>
              <MenuItem icon="👥" label="Medarbejdere" onClick={() => router.push('/medarbejdere')} />
            </MenuSection>
            <MenuSection>
              <MenuItem icon="⚙️" label="Indstillinger" onClick={() => router.push('/profil/rediger')} />
              <MenuItem icon="🌱" label="Bæredygtighed" value={co2Total !== null ? `${co2Total.toFixed(1)} kg CO₂` : undefined} onClick={() => router.push('/baeredygtighed/metode')} />
              {typeof Notification !== 'undefined' && (
                <button onClick={notifLoading ? undefined : handleNotifToggle} style={{
                  width:'100%', display:'flex', alignItems:'center', gap:14,
                  padding:'15px 20px', background:'none', border:'none', cursor: notifLoading ? 'default' : 'pointer', textAlign:'left',
                  borderBottom:`1px solid ${PAPER3}`,
                }}>
                  <span style={{ fontSize:18, width:24, textAlign:'center', flexShrink:0 }}>
                    {notifPermission === 'granted' ? '🔔' : '🔕'}
                  </span>
                  <span style={{ flex:1, fontFamily:FONT, fontSize:15, fontWeight:600, color:INK }}>
                    {notifLoading ? 'Vent…' : notifPermission === 'granted' ? 'Notifikationer aktiveret' : 'Aktiver notifikationer'}
                  </span>
                  <span style={{
                    fontFamily:FONT, fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:99,
                    background: notifPermission === 'granted' ? '#dcfce7' : notifPermission === 'denied' ? '#fee2e2' : PAPER2,
                    color: notifPermission === 'granted' ? '#16a34a' : notifPermission === 'denied' ? '#dc2626' : INK3,
                    flexShrink:0,
                  }}>
                    {notifPermission === 'granted' ? 'Til' : notifPermission === 'denied' ? 'Blokeret' : 'Fra'}
                  </span>
                </button>
              )}
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

  /* ── DESKTOP layout (Vinted-style) ── */
  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:88, paddingBottom:60 }}>
      <div style={{ maxWidth:1160, margin:'0 auto', padding:'0 32px', display:'flex', gap:32, alignItems:'flex-start' }}>

        {/* ── Left sidebar ── */}
        <div style={{ width:280, flexShrink:0, position:'sticky', top:100, display:'flex', flexDirection:'column', gap:12 }}>

          {/* Profile card */}
          <div style={{ background:'#fff', borderRadius:20, padding:'28px 24px', boxShadow:'0 1px 6px rgba(22,34,28,0.08)', textAlign:'center' }}>
            {/* Avatar */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
              {institution?.logo_url ? (
                <img src={institution.logo_url} alt="" style={{ width:96, height:96, borderRadius:'50%', objectFit:'cover', border:`3px solid ${PAPER3}` }} />
              ) : (
                <div style={{ width:96, height:96, borderRadius:'50%', background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:34, fontFamily:FONT }}>
                  {initials}
                </div>
              )}
            </div>

            {/* Name */}
            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:INK, lineHeight:1.2, marginBottom:6 }}>
              {institution?.name || '—'}
            </div>

            {/* City */}
            {institution?.city && (
              <div style={{ fontFamily:FONT, fontSize:14, color:INK3, display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginBottom:8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {institution.city}
              </div>
            )}

            {/* Type badge */}
            {institution?.institution_type && (
              <div style={{ display:'inline-block', background:GREEN_TINT, color:PRIMARY, fontFamily:FONT, fontSize:12, fontWeight:700, padding:'3px 12px', borderRadius:99, marginBottom:14 }}>
                {institution.institution_type}
              </div>
            )}

            {/* Stats row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, margin:'0 -4px 18px', paddingTop:14, borderTop:`1px solid ${PAPER3}` }}>
              {[
                { value: activeListingCount ?? '—', label: 'Opslag' },
                { value: tradeCount ?? '—', label: 'Handler' },
                { value: co2Total !== null ? `${co2Total.toFixed(0)}` : '—', label: 'kg CO₂' },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center', padding:'8px 4px' }}>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK }}>{s.value}</div>
                  <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginTop:1 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <button onClick={() => router.push('/profil/rediger')} style={{
              width:'100%', background:PRIMARY, color:'#fff', border:'none', borderRadius:99,
              fontFamily:FONT, fontWeight:700, fontSize:14, padding:'11px 0', cursor:'pointer', marginBottom:8,
            }}>
              ⚙️ Indstillinger
            </button>
            {institution?.name && (
              <button onClick={() => router.push('/institution/' + encodeURIComponent(institution.name))} style={{
                width:'100%', background:'none', color:PRIMARY, border:`1.5px solid ${PRIMARY}`, borderRadius:99,
                fontFamily:FONT, fontWeight:700, fontSize:14, padding:'10px 0', cursor:'pointer',
              }}>
                Se offentlig profil →
              </button>
            )}
          </div>

          {/* Settings card */}
          <div style={{ background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 1px 6px rgba(22,34,28,0.08)' }}>
            {typeof Notification !== 'undefined' && (
              <button onClick={notifLoading ? undefined : handleNotifToggle} style={{
                width:'100%', display:'flex', alignItems:'center', gap:12,
                padding:'14px 18px', background:'none', border:'none', cursor: notifLoading ? 'default' : 'pointer',
                textAlign:'left', borderBottom:`1px solid ${PAPER3}`,
              }}>
                <span style={{ fontSize:16, width:22, textAlign:'center', flexShrink:0 }}>
                  {notifPermission === 'granted' ? '🔔' : '🔕'}
                </span>
                <span style={{ flex:1, fontFamily:FONT, fontSize:14, fontWeight:600, color:INK }}>
                  {notifLoading ? 'Vent…' : 'Notifikationer'}
                </span>
                <span style={{
                  fontFamily:FONT, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99,
                  background: notifPermission === 'granted' ? '#dcfce7' : notifPermission === 'denied' ? '#fee2e2' : PAPER2,
                  color: notifPermission === 'granted' ? '#16a34a' : notifPermission === 'denied' ? '#dc2626' : INK3,
                }}>
                  {notifPermission === 'granted' ? 'Til' : notifPermission === 'denied' ? 'Blokeret' : 'Fra'}
                </span>
              </button>
            )}
            {[
              { icon:'👥', label:'Medarbejdere', to:'/medarbejdere' },
              { icon:'❓', label:'Hjælp & vejledning', to:'/hvordan' },
              { icon:'📧', label:'Kontakt os', to:'/kontakt' },
            ].map(item => (
              <button key={item.to} onClick={() => router.push(item.to)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:12,
                padding:'14px 18px', background:'none', border:'none', cursor:'pointer',
                textAlign:'left', borderBottom:`1px solid ${PAPER3}`,
              }}>
                <span style={{ fontSize:16, width:22, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                <span style={{ flex:1, fontFamily:FONT, fontSize:14, fontWeight:600, color:INK }}>{item.label}</span>
                <svg width="6" height="10" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke={INK3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ))}
            <button onClick={handleLogout} style={{
              width:'100%', display:'flex', alignItems:'center', gap:12,
              padding:'14px 18px', background:'none', border:'none', cursor:'pointer', textAlign:'left',
            }}>
              <span style={{ fontSize:16, width:22, textAlign:'center', flexShrink:0 }}>🚪</span>
              <span style={{ fontFamily:FONT, fontSize:14, fontWeight:600, color:'#e11d48' }}>Log ud</span>
            </button>
          </div>

          <div style={{ textAlign:'center', padding:'4px 0' }}>
            <span style={{ fontFamily:FONT, fontSize:11, color:INK3 }}>Privatlivspolitik · Vilkår og betingelser</span>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex:1, minWidth:0 }}>

          {/* In-app notification inbox */}
          {inboxNotifs.length > 0 && (
            <div style={{ marginBottom:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FONT, fontWeight:700, fontSize:12, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                Beskeder fra byt&amp;leg
                {inboxNotifs.filter(n=>!n.read).length > 0 && <span style={{ background:'#EF476F', color:'#fff', borderRadius:99, fontSize:10, fontWeight:800, padding:'1px 7px' }}>{inboxNotifs.filter(n=>!n.read).length}</span>}
              </div>
              <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 6px rgba(22,34,28,0.08)' }}>
                {inboxNotifs.map((n, i) => (
                  <button key={n.id} onClick={async () => {
                    if (!n.read) {
                      await db.from('notifications').update({ read: true }).eq('id', n.id);
                      setInboxNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                    }
                  }} style={{ width:'100%', display:'flex', alignItems:'flex-start', gap:14, padding:'16px 20px', background: n.read ? 'transparent' : '#FFF7ED', border:'none', borderBottom: i < inboxNotifs.length-1 ? `1px solid ${PAPER3}` : 'none', cursor:'pointer', textAlign:'left' }}>
                    <span style={{ fontSize:22, flexShrink:0, marginTop:1 }}>{n.type === 'listing_review_approved' ? '✅' : n.type === 'listing_review_rejected' ? '❌' : '📬'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FONT, fontWeight: n.read ? 600 : 800, fontSize:15, color:INK, marginBottom:4 }}>{n.title}</div>
                      <div style={{ fontFamily:FONT, fontSize:13, color:INK3, lineHeight:1.5 }}>{n.body}</div>
                      <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginTop:6 }}>{new Date(n.created_at).toLocaleDateString('da-DK', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                    </div>
                    {!n.read && <div style={{ width:9, height:9, borderRadius:'50%', background:'#EF476F', flexShrink:0, marginTop:6 }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Jeg sælger */}
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Jeg sælger</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:14, marginBottom:28 }}>
            <ActivityCard
              icon="🏷️"
              label="Mine opslag"
              sublabel="Aktive annoncer"
              value={activeListingCount ?? '—'}
              onClick={() => router.push('/mine-opslag')}
            />
            <ActivityCard
              icon="📋"
              label="Mine salg"
              sublabel="Ordrer & opgaver"
              value={pendingCount || null}
              badge={pendingCount}
              highlight={pendingCount > 0}
              onClick={() => router.push('/mine-opgaver')}
            />
          </div>

          {/* Jeg køber */}
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Jeg køber</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginBottom:28 }}>
            <ActivityCard
              icon="🛍️"
              label="Mine ordrer"
              sublabel="Stripe-betalte køb"
              value={null}
              onClick={() => router.push('/mine-ordrer')}
            />
            <ActivityCard
              icon="🔄"
              label="Byttehandler"
              sublabel="Byt & aftaler"
              value={tradeCount ?? '—'}
              onClick={() => router.push('/mine-handeler')}
            />
            <ActivityCard
              icon="❤️"
              label="Favoritter"
              sublabel="Gemte annoncer"
              value={null}
              onClick={() => router.push('/favoritter')}
            />
          </div>

          {/* Discover */}
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Opdage</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:14, marginBottom:28 }}>
            <ActivityCard
              icon="🔍"
              label="Gemte søgninger"
              sublabel="Søge-notifikationer"
              value={null}
              onClick={() => router.push('/gemte-soegninger')}
            />
            <ActivityCard
              icon="🌱"
              label="Bæredygtighed"
              sublabel={co2Total !== null ? `${co2Total.toFixed(1)} kg CO₂ sparet` : 'Se din impact'}
              value={null}
              onClick={() => router.push('/baeredygtighed/metode')}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
