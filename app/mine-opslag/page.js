'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";
const FILTERS = ['Alle', 'Aktive', 'Inaktive', 'Solgt'];

function ListingCard({ l, favoriters, onToggleActive, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const statusLabel = l.is_sold ? 'Solgt' : l.is_active ? 'Aktiv' : 'Inaktiv';
  const statusColor = l.is_sold
    ? { bg:'#FECACA', color:'#991B1B' }
    : l.is_active ? { bg:'#D1FAE5', color:'#065F46' }
    : { bg:PAPER3, color:INK3 };
  const likers = favoriters.filter(f => f.listing_id === l.id);

  return (
    <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)', border:`1px solid ${PAPER3}` }}>
      <div style={{ display:'flex', gap:12, padding:'12px 14px', alignItems:'center' }}>
        <div style={{ width:52, height:52, borderRadius:10, background:l.color || GREEN_TINT, flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
          {l.images?.[0]
            ? <img src={l.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
            : l.emoji || '🧸'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <span style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{l.title}</span>
            <span style={{ fontFamily:FONT, fontSize:10, fontWeight:700, background:statusColor.bg, color:statusColor.color, borderRadius:99, padding:'2px 8px', flexShrink:0 }}>{statusLabel}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>
              {l.price ? `${l.price} kr` : 'Byt / Gratis'}
            </span>
            {likers.length > 0 && (
              <button onClick={() => setShowLikers(v => !v)}
                style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:FONT, fontSize:12, color:PRIMARY, fontWeight:600, display:'flex', alignItems:'center', gap:3 }}>
                ❤️ {likers.length} interesseret{likers.length !== 1 ? 'e' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {showLikers && likers.length > 0 && (
        <div style={{ background:GREEN_TINT, padding:'8px 14px', borderTop:`1px solid ${PAPER3}` }}>
          <div style={{ fontFamily:FONT, fontSize:12, fontWeight:700, color:PRIMARY, marginBottom:4 }}>Interesserede:</div>
          {likers.map((f, i) => (
            <div key={i} style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>· {f.institution_name || 'Ukendt'}</div>
          ))}
        </div>
      )}

      {!l.is_sold && (
        <div style={{ display:'flex', gap:6, padding:'0 14px 12px' }}>
          <button onClick={() => onToggleActive(l.id, l.is_active)}
            style={{ flex:1, background:l.is_active?'#FEF9C3':'#F0FDF4', border:'none', borderRadius:99, padding:'7px 0', fontSize:12, fontWeight:700, color:l.is_active?'#B45309':'#15803D', cursor:'pointer', fontFamily:FONT }}>
            {l.is_active ? 'Deaktivér' : 'Aktivér'}
          </button>
          <button onClick={() => setConfirmDelete(true)}
            style={{ background:PAPER2, border:'none', borderRadius:99, padding:'7px 12px', fontSize:12, fontWeight:700, color:'#e11d48', cursor:'pointer', fontFamily:FONT }}>
            Slet
          </button>
        </div>
      )}

      {confirmDelete && (
        <div style={{ background:'#FFF5F5', borderTop:`1px solid #FECACA`, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FONT, fontSize:13, color:'#B91C1C', fontWeight:600 }}>Er du sikker?</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ background:PAPER3, border:'none', borderRadius:99, padding:'5px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:FONT }}>Annuller</button>
            <button onClick={() => onDelete(l.id)} style={{ background:'#e11d48', border:'none', borderRadius:99, padding:'5px 14px', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:FONT }}>Slet</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MineOpslagPage() {
  const router = useRouter();
  const { effectiveInstitution, showToast } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [listings, setListings] = useState([]);
  const [favoriters, setFavoriters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Alle');

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Always get auth user for reliable uid
      const { data: { user } } = await db.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      let inst = effectiveInstitution || null;
      if (!inst) {
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

      const SELECT = 'id,title,emoji,color,images,price,type,is_active,is_sold,created_at';

      const promises = [];
      if (user.id) {
        promises.push(
          db.from('listings').select(SELECT).eq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(100)
        );
      }
      if (inst?.name) {
        promises.push(
          db.from('listings').select(SELECT).ilike('institution_name', inst.name)
            .order('created_at', { ascending: false }).limit(100)
        );
      }
      if (!promises.length) { setLoading(false); return; }

      const results = await Promise.all(promises);
      if (cancelled) return;

      const seen = new Set();
      const rows = results
        .flatMap(r => r.data || [])
        .filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setListings(rows);

      // Fetch who liked each listing
      if (rows.length) {
        const { data: favs } = await db.from('listing_favorites')
          .select('listing_id,institution_name,institution_id,user_id')
          .in('listing_id', rows.map(l => l.id));
        if (!cancelled) setFavoriters(favs || []);
      }

      setLoading(false);
    }

    boot();
    return () => { cancelled = true; };
  }, [effectiveInstitution?.id]);

  async function toggleActive(id, isActive) {
    await db.from('listings').update({ is_active: !isActive }).eq('id', id);
    setListings(ls => ls.map(l => l.id === id ? { ...l, is_active: !isActive } : l));
  }

  async function deleteListing(id) {
    await db.from('listings').delete().eq('id', id);
    setListings(ls => ls.filter(l => l.id !== id));
    showToast?.('Opslag slettet');
  }

  const filtered = filter === 'Alle' ? listings
    : filter === 'Aktive' ? listings.filter(l => l.is_active && !l.is_sold)
    : filter === 'Inaktive' ? listings.filter(l => !l.is_active && !l.is_sold)
    : listings.filter(l => l.is_sold);

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 0' }}>
          <button onClick={() => router.push('/profil')} style={{ background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0, flex:1 }}>Mine opslag</h1>
          <button onClick={() => router.push('/opret-opslag')}
            style={{ background:PRIMARY, border:'none', borderRadius:99, padding:'8px 16px', fontFamily:FONT, fontWeight:700, fontSize:13, color:'#fff', cursor:'pointer' }}>
            + Nyt opslag
          </button>
        </div>

        <div style={{ display:'flex', gap:8, padding:'12px 16px', overflowX:'auto' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'7px 16px', borderRadius:99, border:`1.5px solid ${filter===f ? PRIMARY : PAPER3}`, background: filter===f ? GREEN_TINT : '#fff', color: filter===f ? PRIMARY : INK2, fontFamily:FONT, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              {f}
            </button>
          ))}
        </div>

        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {loading ? (
            <div style={{ padding:'60px 0', textAlign:'center' }}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center', background:'#fff', borderRadius:16 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>
                {filter === 'Alle' ? 'Ingen opslag endnu' : `Ingen ${filter.toLowerCase()} opslag`}
              </div>
              <div style={{ fontFamily:FONT, fontSize:13, color:INK3, marginBottom:20 }}>
                Opret dit første opslag og kom i gang
              </div>
              {filter === 'Alle' && (
                <button onClick={() => router.push('/opret-opslag')}
                  style={{ background:PRIMARY, border:'none', borderRadius:99, padding:'10px 24px', fontFamily:FONT, fontWeight:700, fontSize:14, color:'#fff', cursor:'pointer' }}>
                  Opret opslag
                </button>
              )}
            </div>
          ) : (
            filtered.map(l => (
              <ListingCard key={l.id} l={l} favoriters={favoriters}
                onToggleActive={toggleActive}
                onDelete={deleteListing}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
