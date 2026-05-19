'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, INK, PAPER } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useState, useEffect } from 'react';
import { Btn } from '@/components/ui';

function Mark09({ size = 36, bg = PRIMARY }) {
  const r = Math.round(size * 0.18);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="byt&leg" style={{ flexShrink:0 }}>
      <rect x="0" y="0" width="64" height="64" rx={r * 64 / size} fill={bg} />
      <text x="32" y="27" textAnchor="middle" fontFamily="'Sora',sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill={PAPER}>byt</text>
      <text x="32" y="49" textAnchor="middle" fontFamily="'Sora',sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill={PAPER}>
        <tspan fill={PAPER}>&amp;</tspan>leg<tspan fill={PAPER}>.</tspan>
      </text>
    </svg>
  );
}

export default function NavWrapper() {
  const { loggedIn, setLoggedIn, unreadTotal, isAdmin, adminInst, setAdminInst, allInstitutions, toast, setToast } = useApp();
  const { institution } = useActiveUser();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {isAdmin && loggedIn && (
        <div style={{ background:GREEN_DEEP, color:'#fff', padding:'7px 20px', display:'flex', alignItems:'center', gap:12, fontSize:13, fontFamily:"'Sora',sans-serif", position:'fixed', top:0, left:0, right:0, zIndex:9999, flexWrap:'wrap' }}>
          <Link href="/admin" style={{ fontWeight:800, fontSize:12, color:GREEN_SOFT, letterSpacing:'0.04em', textDecoration:'none', textTransform:'uppercase', flexShrink:0 }}>Admin</Link>
          <div style={{ width:1, height:16, background:'rgba(255,255,255,0.15)', flexShrink:0 }} />
          <select
            value={adminInst?.id || ''}
            onChange={e => { const i = allInstitutions.find(x => x.id === e.target.value); setAdminInst(i || null); }}
            style={{ background:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer', maxWidth:280 }}>
            <option value="">— Agér som institution —</option>
            {allInstitutions.map(i => <option key={i.id} value={i.id}>{i.name}{i.city ? ` · ${i.city}` : ''}</option>)}
          </select>
          {adminInst && (
            <>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.75)' }}>Viser som: <strong style={{ color:'#fff' }}>{adminInst.name}</strong></span>
              <button onClick={()=>setAdminInst(null)} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'none', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:"'Sora',sans-serif" }}>✕ Afslut</button>
            </>
          )}
        </div>
      )}
      <Nav
        pathname={pathname}
        navigate={p => { router.push(p); window.scrollTo({ top:0, behavior:'smooth' }); }}
        loggedIn={loggedIn}
        setLoggedIn={setLoggedIn}
        unreadTotal={unreadTotal}
        institution={institution}
        adminBar={isAdmin && loggedIn}
        isAdmin={isAdmin}
      />
      {toast && <ToastDisplay msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
    </>
  );
}

function ToastDisplay({ msg, type='success', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, []);
  const icon = type==='success' ? '✅' : type==='error' ? '❌' : 'ℹ️';
  return (
    <div style={{ position:'fixed', bottom:'max(32px, env(safe-area-inset-bottom, 32px))', left:'50%', transform:'translateX(-50%)', background:'#1c1a17', color:'#fff', borderRadius:99, padding:'13px 26px', fontWeight:700, fontSize:14, fontFamily:"'Nunito',sans-serif", zIndex:2000, boxShadow:'0 10px 40px rgba(0,0,0,0.35)', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap', animation:'slideUp 0.3s ease', maxWidth:'calc(100vw - 32px)' }}>
      <span style={{ fontSize:18 }}>{icon}</span> {msg}
    </div>
  );
}

function Nav({ pathname, navigate, loggedIn, setLoggedIn, unreadTotal, institution, adminBar, isAdmin }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const w = useWindowWidth();
  const isMobile = w < 768;

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isHome = pathname === '/';
  const transparent = isHome && !scrolled && !menuOpen;
  const navTop = adminBar ? 36 : 0;

  function go(path) { navigate(path); }

  return (
    <nav style={{ position:'fixed', top:navTop, left:0, right:0, zIndex:500, background:transparent?'transparent':'rgba(246,242,234,0.96)', backdropFilter:transparent?'none':'blur(18px)', boxShadow:transparent?'none':'0 1px 0 rgba(22,34,28,0.08)', transition:'all 0.3s' }}>
      <div style={{ maxWidth:1140, margin:'0 auto', display:'flex', alignItems:'center', height:68, gap:isMobile?12:24, padding:'0 16px' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', flexShrink:0, textDecoration:'none' }}>
          <Mark09 size={36} bg={transparent ? 'rgba(255,255,255,0.15)' : PRIMARY} />
          <span style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:isMobile?17:19, letterSpacing:'-0.04em', lineHeight:1.05 }}>
            <span style={{ display:'block', color:transparent?'#fff':INK }}>byt</span>
            <span style={{ display:'block', color:transparent?'rgba(255,255,255,0.9)':INK }}>
              <span style={{ color:transparent?'#fff':PRIMARY }}>&amp;</span>leg<span style={{ color:transparent?'#fff':PRIMARY }}>.</span>
            </span>
          </span>
        </Link>

        {!isMobile && (
          <div style={{ display:'flex', gap:4, flex:1, justifyContent:'center' }}>
            {[['/opslag','Markedsplads'],['/hvordan','Sådan virker det'],['/om-os','Om os'],['/kontakt','Kontakt']].map(([p,label]) => (
              <Link key={p} href={p} style={{ background:'none', border:'none', padding:'8px 16px', fontSize:14, fontWeight:600, color:pathname===p?PRIMARY:transparent?'rgba(255,255,255,0.85)':'#555', borderRadius:8, borderBottom:pathname===p?`2px solid ${PRIMARY}`:'2px solid transparent', transition:'all 0.15s', textDecoration:'none', display:'inline-flex', alignItems:'center' }}>{label}</Link>
            ))}
            {isAdmin && loggedIn && (
              <Link href="/admin" style={{ background:pathname==='/admin'?GREEN_TINT:'none', border:'none', padding:'8px 14px', fontSize:13, fontWeight:700, color:pathname==='/admin'?PRIMARY:'#777', borderRadius:8, borderBottom:pathname==='/admin'?`2px solid ${PRIMARY}`:'2px solid transparent', transition:'all 0.15s', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M4.93 4.93a10 10 0 000 14.14"/></svg>
                Admin
              </Link>
            )}
          </div>
        )}

        {isMobile && <div style={{ flex:1 }} />}

        {!isMobile && (
          <div style={{ display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
            {loggedIn ? <>
              <Link href="/dashboard" style={{ background:'none', border:'none', fontWeight:600, fontSize:14, color:transparent?'rgba(255,255,255,0.9)':'#555', cursor:'pointer', padding:'8px 12px', borderRadius:8, textDecoration:'none' }}>Min institution</Link>
              <Link href="/beskeder" style={{ background:'none', border:'none', fontWeight:600, fontSize:14, color:transparent?'rgba(255,255,255,0.9)':'#555', cursor:'pointer', padding:'8px 12px', borderRadius:8, position:'relative', display:'flex', alignItems:'center', gap:6, textDecoration:'none' }}>
                💬 Beskeder
                {unreadTotal > 0 && <span style={{ background:'#EF476F', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px', lineHeight:1 }}>{unreadTotal > 9 ? '9+' : unreadTotal}</span>}
              </Link>
              <div onClick={async()=>{ await db.auth.signOut(); setLoggedIn(false); go('/'); }} title="Log ud" style={{ width:38, height:38, borderRadius:'50%', background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', overflow:'hidden', flexShrink:0, border:`2px solid ${PRIMARY}` }}>
                {institution?.logo_url
                  ? <img src={institution.logo_url} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span>{institution?.name?.charAt(0)?.toUpperCase() || 'M'}</span>}
              </div>
            </> : <>
              <Link href="/login" style={{ background:'none', border:'none', fontWeight:600, fontSize:14, color:transparent?'rgba(255,255,255,0.9)':'#555', cursor:'pointer', padding:'8px 12px', borderRadius:32, textDecoration:'none' }}>Log ind</Link>
              <Link href="/signup" style={{ background:PRIMARY, color:'#fff', fontWeight:700, fontSize:14, padding:'9px 20px', borderRadius:22, textDecoration:'none', display:'inline-flex', alignItems:'center' }}>Tilmeld institution</Link>
            </>}
          </div>
        )}

        {isMobile && (
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            {loggedIn && unreadTotal > 0 && (
              <Link href="/beskeder" style={{ background:'none', border:'none', cursor:'pointer', position:'relative', padding:'6px', lineHeight:1, display:'inline-flex', textDecoration:'none' }}>
                <span style={{ fontSize:22, color:transparent?'#fff':'#333' }}>💬</span>
                <span style={{ position:'absolute', top:2, right:2, background:'#EF476F', color:'#fff', borderRadius:99, fontSize:10, fontWeight:800, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1 }}>{unreadTotal > 9 ? '9+' : unreadTotal}</span>
              </Link>
            )}
            <button onClick={()=>setMenuOpen(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', padding:'8px 4px', display:'flex', flexDirection:'column', gap:5, alignItems:'center', justifyContent:'center', width:36, height:36 }}>
              <div style={{ width:22, height:2.5, background:transparent&&!menuOpen?'#fff':'#333', borderRadius:2, transition:'transform 0.2s, opacity 0.2s', transform:menuOpen?'rotate(45deg) translate(5px,5px)':'none' }} />
              <div style={{ width:22, height:2.5, background:transparent&&!menuOpen?'#fff':'#333', borderRadius:2, opacity:menuOpen?0:1, transition:'opacity 0.2s' }} />
              <div style={{ width:22, height:2.5, background:transparent&&!menuOpen?'#fff':'#333', borderRadius:2, transition:'transform 0.2s, opacity 0.2s', transform:menuOpen?'rotate(-45deg) translate(5px,-5px)':'none' }} />
            </button>
          </div>
        )}
      </div>

      {isMobile && menuOpen && (
        <div style={{ background:'rgba(246,242,234,0.99)', borderTop:`1px solid #ECE6DA`, padding:'8px 16px 20px', animation:'slideDown 0.2s ease' }}>
          {[['/opslag','🛍️ Markedsplads'],['/hvordan','❓ Sådan virker det'],['/om-os','ℹ️ Om os'],['/kontakt','✉️ Kontakt']].map(([p,label]) => (
            <Link key={p} href={p} style={{ display:'block', width:'100%', textAlign:'left', borderBottom:'1px solid #f0eeeb', padding:'14px 4px', fontSize:15, fontWeight:pathname===p?700:600, color:pathname===p?PRIMARY:'#333', textDecoration:'none' }}>{label}</Link>
          ))}
          <div style={{ marginTop:12 }}>
            {loggedIn ? <>
              <Link href="/dashboard" style={{ display:'block', width:'100%', textAlign:'left', borderBottom:'1px solid #f0eeeb', padding:'14px 4px', fontSize:15, fontWeight:600, color:'#333', textDecoration:'none' }}>🏢 Min institution</Link>
              <Link href="/beskeder" style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left', borderBottom:'1px solid #f0eeeb', padding:'14px 4px', fontSize:15, fontWeight:600, color:'#333', textDecoration:'none' }}>
                💬 Beskeder
                {unreadTotal > 0 && <span style={{ background:'#EF476F', color:'#fff', borderRadius:99, fontSize:11, fontWeight:800, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>{unreadTotal > 9 ? '9+' : unreadTotal}</span>}
              </Link>
              {isAdmin && (
                <Link href="/admin" style={{ display:'block', width:'100%', textAlign:'left', borderBottom:'1px solid #f0eeeb', padding:'14px 4px', fontSize:15, fontWeight:700, color:PRIMARY, textDecoration:'none' }}>⚙️ Admin</Link>
              )}
              <button onClick={async()=>{ await db.auth.signOut(); setLoggedIn(false); go('/'); }} style={{ marginTop:12, width:'100%', background:'#f5f4f2', border:'none', borderRadius:12, padding:'13px', fontSize:14, fontWeight:700, color:'#555', cursor:'pointer' }}>Log ud</button>
            </> : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
                <Link href="/login" style={{ display:'flex', justifyContent:'center', width:'100%', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, fontWeight:700, fontSize:15, padding:'12px', borderRadius:22, textDecoration:'none' }}>Log ind</Link>
                <Link href="/signup" style={{ display:'flex', justifyContent:'center', width:'100%', background:PRIMARY, color:'#fff', fontWeight:700, fontSize:15, padding:'12px', borderRadius:22, textDecoration:'none' }}>Tilmeld institution</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
