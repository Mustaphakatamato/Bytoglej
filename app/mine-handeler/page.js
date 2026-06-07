'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";

const STATUS_FILTERS = ['Alle', 'I gang', 'Fuldført'];

function statusOf(conv) {
  if (conv.deal_completed) return 'Fuldført';
  if (conv.is_handled) return 'I gang';
  return 'I gang';
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

function OrderCard({ conv, role, onClick }) {
  const status = statusOf(conv);
  const otherParty = role === 'solgt' ? conv.initiator_name : conv.owner_name;
  const statusColor = status === 'Fuldført' ? { bg:'#D1FAE5', color:'#065F46' } : { bg:'#FEF9C3', color:'#92400E' };
  const deliveryIcon = conv.delivery_method === 'shipping' ? '📦' : conv.delivery_method === 'pickup' ? '📍' : '🤝';

  return (
    <button onClick={onClick} style={{
      width:'100%', display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
      background:'#fff', border:'none', borderBottom:`1px solid ${PAPER3}`,
      cursor:'pointer', textAlign:'left',
    }}>
      {/* Emoji */}
      <div style={{ width:44, height:44, borderRadius:10, background: conv.listing_color || GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, overflow:'hidden' }}>
        {conv.listing_image
          ? <img src={conv.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : conv.listing_emoji || '🧸'}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
          <span style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{conv.listing_title}</span>
        </div>
        <div style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>
          {role === 'solgt' ? 'Til: ' : 'Fra: '}{otherParty}
          {conv.delivery_method && <span> · {deliveryIcon}</span>}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
        <span style={{ fontFamily:FONT, fontSize:10, fontWeight:700, background:statusColor.bg, color:statusColor.color, borderRadius:99, padding:'2px 8px' }}>{status}</span>
        <span style={{ fontFamily:FONT, fontSize:11, color:INK3 }}>{relDate(conv.last_message_at)}</span>
      </div>
    </button>
  );
}

export default function MineHandelerPage() {
  const router = useRouter();
  const { effectiveInstitution } = useApp();
  const { realUserId, userId, institution: ctxInst } = useActiveUser();
  const institution = effectiveInstitution || ctxInst;
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [tab, setTab] = useState('solgt');
  const [filter, setFilter] = useState('Alle');
  const [sold, setSold] = useState([]);
  const [bought, setBought] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!institution?.id) return;
    load();
  }, [institution?.id]);

  async function load() {
    setLoading(true);
    const instId = institution.id;
    const instName = institution.name;
    const uid = realUserId || userId;

    const [{ data: soldData }, { data: boughtData }] = await Promise.all([
      // Sold = I am the owner
      db.from('conversations')
        .select('id,listing_title,listing_emoji,listing_color,listing_image,initiator_name,owner_name,is_handled,handled_action,deal_completed,deal_type,delivery_method,last_message_at')
        .or([`owner_institution_id.eq.${instId}`, uid ? `owner_id.eq.${uid}` : null, instName ? `owner_name.eq.${instName}` : null].filter(Boolean).join(','))
        .or('is_handled.eq.true,deal_completed.eq.true')
        .in('deal_type', ['køb','byd','byt','bundle'])
        .order('last_message_at', { ascending:false })
        .limit(50),

      // Bought = I am the initiator
      db.from('conversations')
        .select('id,listing_title,listing_emoji,listing_color,listing_image,initiator_name,owner_name,is_handled,handled_action,deal_completed,deal_type,delivery_method,last_message_at')
        .or([`initiator_institution_id.eq.${instId}`, uid ? `initiator_id.eq.${uid}` : null, instName ? `initiator_name.eq.${instName}` : null].filter(Boolean).join(','))
        .or('is_handled.eq.true,deal_completed.eq.true')
        .in('deal_type', ['køb','byd','byt','bundle'])
        .order('last_message_at', { ascending:false })
        .limit(50),
    ]);

    if (soldData) setSold(soldData);
    if (boughtData) setBought(boughtData);
    setLoading(false);
  }

  const list = tab === 'solgt' ? sold : bought;
  const filtered = filter === 'Alle' ? list : list.filter(c => statusOf(c) === filter);

  function goToConv(id) {
    router.push('/beskeder?conv=' + id);
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 0' }}>
          <button onClick={() => router.push('/profil')} style={{ background:'none', border:'none', cursor:'pointer', padding:'6px', display:'flex', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0 }}>Mine handeler</h1>
        </div>

        {/* Solgt / Købt tabs */}
        <div style={{ display:'flex', borderBottom:`2px solid ${PAPER3}`, background:'#fff', marginTop:12 }}>
          {['solgt','købt'].map(t => (
            <button key={t} onClick={() => { setTab(t); setFilter('Alle'); }}
              style={{ flex:1, padding:'13px', border:'none', background:'none', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:15, color: tab===t ? PRIMARY : INK3, borderBottom: tab===t ? `2px solid ${PRIMARY}` : '2px solid transparent', marginBottom:-2, textTransform:'capitalize' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div style={{ display:'flex', gap:8, padding:'12px 16px', overflowX:'auto' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'7px 16px', borderRadius:99, border:`1.5px solid ${filter===f ? PRIMARY : PAPER3}`, background: filter===f ? GREEN_TINT : '#fff', color: filter===f ? PRIMARY : INK2, fontFamily:FONT, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)' }}>
          {loading ? (
            <div style={{ padding:'40px 0', textAlign:'center' }}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>
                {filter === 'Alle' ? `Ingen ${tab === 'solgt' ? 'solgte' : 'købte'} varer endnu` : `Ingen ${filter.toLowerCase()} handeler`}
              </div>
              <div style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>
                {tab === 'solgt' ? 'Når du sælger noget, vises det her' : 'Når du køber noget, vises det her'}
              </div>
            </div>
          ) : (
            filtered.map(conv => (
              <OrderCard key={conv.id} conv={conv} role={tab} onClick={() => goToConv(conv.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
