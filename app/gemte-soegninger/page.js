'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER3, INK, INK3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";

function relDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('da-DK', { day:'numeric', month:'short', year:'numeric' });
}

export default function GemteSoegningerPage() {
  const router = useRouter();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const { data: { user } } = await db.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const { data } = await db.from('saved_searches')
        .select('*')
        .ilike('email', user.email)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        setSearches(data || []);
        setLoading(false);
      }
    }
    boot();
    return () => { cancelled = true; };
  }, []);

  async function deleteSearch(id) {
    await db.from('saved_searches').delete().eq('id', id);
    setSearches(ss => ss.filter(s => s.id !== id));
  }

  function openSearch(s) {
    const params = new URLSearchParams();
    if (s.query) params.set('search', s.query);
    if (s.category) params.set('category', s.category);
    router.push('/opslag?' + params.toString());
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 0' }}>
          <button onClick={() => router.push('/profil')} style={{ background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0 }}>Gemte søgninger</h1>
        </div>

        <div style={{ padding:'16px 16px 0' }}>
          {loading ? (
            <div style={{ padding:'60px 0', textAlign:'center' }}><Spinner /></div>
          ) : searches.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center', background:'#fff', borderRadius:16 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>Ingen gemte søgninger</div>
              <div style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>Gem en søgning fra opslag-siden for at se den her</div>
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)' }}>
              {searches.map((s, i) => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom: i < searches.length - 1 ? `1px solid ${PAPER3}` : 'none' }}>
                  <div onClick={() => openSearch(s)} style={{ flex:1, cursor:'pointer', minWidth:0 }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.query || s.category || 'Søgning'}
                    </div>
                    {s.category && s.query && (
                      <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:2 }}>{s.category}</div>
                    )}
                    <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginTop:2 }}>{relDate(s.created_at)}</div>
                  </div>
                  <button onClick={() => openSearch(s)}
                    style={{ background:GREEN_TINT, border:'none', borderRadius:99, padding:'6px 14px', fontFamily:FONT, fontWeight:700, fontSize:12, color:PRIMARY, cursor:'pointer', flexShrink:0 }}>
                    Søg
                  </button>
                  <button onClick={() => deleteSearch(s.id)}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:INK3, flexShrink:0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
