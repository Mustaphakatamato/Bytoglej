'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

const STATUS_FILTERS = ['Alle', 'Afventer', 'Accepteret', 'Fuldført', 'Afvist'];

function statusOf(conv) {
  if (conv.deal_completed) return 'Fuldført';
  if (conv.is_handled) {
    if (conv.handled_action === 'rejected') return 'Afvist';
    if (conv.handled_action === 'order_confirmed') return 'Accepteret';
  }
  return 'Afventer';
}

function statusStyle(status) {
  switch (status) {
    case 'Fuldført':   return { bg:'#D1FAE5', color:'#065F46' };
    case 'Accepteret': return { bg:'#DBEAFE', color:'#1D4ED8' };
    case 'Afvist':     return { bg:'#FEE2E2', color:'#DC2626' };
    default:           return { bg:'#FEF9C3', color:'#92400E' };
  }
}

function dealTypeLabel(type) {
  switch (type) {
    case 'køb':    return 'Køb';
    case 'byd':    return 'Tilbud';
    case 'byt':    return 'Bytte';
    case 'bundle': return 'Bundle';
    default:       return 'Forespørgsel';
  }
}

function relDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 86400) return d.toLocaleTimeString('da-DK', { hour:'2-digit', minute:'2-digit' });
  if (diff < 7 * 86400) return d.toLocaleDateString('da-DK', { weekday:'short' });
  return d.toLocaleDateString('da-DK', { day:'numeric', month:'short' });
}

function InquiryCard({ conv, onClick }) {
  const status = statusOf(conv);
  const sc = statusStyle(status);

  return (
    <button onClick={onClick} style={{
      width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
      background:'#fff', border:'none', borderBottom:`1px solid ${PAPER3}`,
      cursor:'pointer', textAlign:'left',
    }}>
      {/* Thumbnail */}
      <div style={{
        width:52, height:52, borderRadius:12,
        background: conv.listing_color || GREEN_TINT,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:26, flexShrink:0, overflow:'hidden',
      }}>
        {conv.listing_image
          ? <img src={conv.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : (conv.listing_emoji || '🧸')}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>
          {conv.listing_title || 'Ukendt opslag'}
        </div>
        <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginBottom:3 }}>
          {conv.owner_name
            ? <>Til: <span style={{ fontWeight:600, color:INK2 }}>{conv.owner_name}</span></>
            : 'Ukendt sælger'}
        </div>
        <span style={{ fontFamily:FONT, fontSize:11, fontWeight:700, background:'#F3F4F6', color:INK3, borderRadius:99, padding:'2px 8px' }}>
          {dealTypeLabel(conv.deal_type)}
        </span>
      </div>

      {/* Status + date */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
        <span style={{ fontFamily:FONT, fontSize:10, fontWeight:700, background:sc.bg, color:sc.color, borderRadius:99, padding:'3px 9px', whiteSpace:'nowrap' }}>
          {status}
        </span>
        <span style={{ fontFamily:FONT, fontSize:11, color:INK3 }}>{relDate(conv.last_message_at || conv.created_at)}</span>
        <svg width="6" height="10" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke={INK3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </button>
  );
}

export default function MineForespørgslerPage() {
  const router = useRouter();
  const { effectiveInstitution } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww > 0 && ww < 768;

  const [filter, setFilter] = useState('Alle');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      let inst = effectiveInstitution || null;
      if (!inst) {
        const { data: ownInst } = await db.from('institutions')
          .select('id,name,email').ilike('email', user.email).maybeSingle();
        if (ownInst) {
          inst = ownInst;
        } else {
          const { data: mem } = await db.from('institution_members')
            .select('role,institutions(id,name,email)').eq('email', user.email).maybeSingle();
          if (mem?.institutions) inst = mem.institutions;
        }
      }

      if (cancelled) return;

      const uid = user.id;
      const instId = inst?.id;
      const instName = inst?.name;

      const parts = [];
      if (instId) parts.push(`initiator_institution_id.eq.${instId}`);
      if (uid)    parts.push(`initiator_id.eq.${uid}`);
      if (instName) parts.push(`initiator_name.eq.${instName}`);

      if (!parts.length) { setLoading(false); return; }

      const { data } = await db.from('conversations')
        .select('id,listing_title,listing_emoji,listing_color,listing_image,owner_name,is_handled,handled_action,deal_completed,deal_type,last_message_at,created_at')
        .or(parts.join(','))
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (!cancelled) {
        setItems(data || []);
        setLoading(false);
      }
    }

    boot();
    return () => { cancelled = true; };
  }, [effectiveInstitution?.id]);

  const filtered = filter === 'Alle' ? items : items.filter(c => statusOf(c) === filter);

  const counts = STATUS_FILTERS.slice(1).reduce((acc, s) => {
    acc[s] = items.filter(c => statusOf(c) === s).length;
    return acc;
  }, {});

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop: isMobile ? 60 : 80, paddingBottom:90 }}>
      <div style={{ maxWidth:600, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 0' }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div>
            <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0 }}>Sendte forespørgsler</h1>
            {!loading && (
              <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:1 }}>
                {items.length} {items.length === 1 ? 'forespørgsel' : 'forespørgsler'} i alt
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, padding:'12px 16px', overflowX:'auto', scrollbarWidth:'none' }}>
          {STATUS_FILTERS.map(f => {
            const cnt = f === 'Alle' ? items.length : (counts[f] || 0);
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding:'7px 14px', borderRadius:99,
                border:`1.5px solid ${filter === f ? PRIMARY : PAPER3}`,
                background: filter === f ? GREEN_TINT : '#fff',
                color: filter === f ? PRIMARY : INK2,
                fontFamily:FONT, fontWeight:600, fontSize:13,
                cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                display:'flex', alignItems:'center', gap:5,
              }}>
                {f}
                {cnt > 0 && (
                  <span style={{
                    background: filter === f ? PRIMARY : PAPER3,
                    color: filter === f ? '#fff' : INK3,
                    borderRadius:99, fontSize:11, fontWeight:800,
                    minWidth:18, height:18, display:'inline-flex',
                    alignItems:'center', justifyContent:'center', padding:'0 5px',
                  }}>{cnt}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)', margin:'0 0 16px' }}>
          {loading ? (
            <div style={{ padding:'48px 0', textAlign:'center' }}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>
                {filter === 'Alle' ? 'Ingen forespørgsler endnu' : `Ingen ${filter.toLowerCase()} forespørgsler`}
              </div>
              <div style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>
                Når du sender en forespørgsel på et opslag, vises den her
              </div>
            </div>
          ) : (
            filtered.map(conv => (
              <InquiryCard key={conv.id} conv={conv}
                onClick={() => router.push('/beskeder?conv=' + conv.id)} />
            ))
          )}
        </div>

      </div>
    </div>
  );
}
