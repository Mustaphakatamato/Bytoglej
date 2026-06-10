'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER2, PAPER3, INK, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

function isShipping(conv) {
  return conv.delivery_method === 'shipping' || !!conv.shipment_id;
}

function stepOf(conv) {
  if (conv.deal_completed) return isShipping(conv) ? 3 : 2;
  if (conv.shipment_id)   return 2; // label generated, awaiting "sent"
  if (conv.is_handled)    return 1; // confirmed, needs packing/label
  return 0;                          // new order
}

const STEPS_SHIP   = ['Ny ordre', 'Bekræftet', 'Label genereret', 'Afsendt'];
const STEPS_PICKUP = ['Ny ordre', 'Bekræftet', 'Afhentet'];

function ProgressBar({ step, shipping }) {
  const labels = shipping ? STEPS_SHIP : STEPS_PICKUP;
  return (
    <div style={{ display:'flex', alignItems:'center', margin:'10px 0 4px' }}>
      {labels.map((lbl, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <div key={lbl} style={{ display:'flex', alignItems:'center', flex: i < labels.length - 1 ? 1 : 'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth: shipping ? 46 : 54 }}>
              <div style={{
                width:22, height:22, borderRadius:'50%',
                border:`2px solid ${done||active ? PRIMARY : PAPER3}`,
                background: done ? PRIMARY : active ? GREEN_TINT : '#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, color: done ? '#fff' : active ? PRIMARY : INK3,
                fontWeight:800, flexShrink:0,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <div style={{ fontFamily:FONT, fontSize:8, fontWeight: active?700:500, color: done||active ? PRIMARY : INK3, marginTop:3, textAlign:'center', lineHeight:1.2 }}>{lbl}</div>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex:1, height:2, background: done ? PRIMARY : PAPER3, margin:'0 2px', marginBottom:16 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ conv, onAction, actionLoading }) {
  const step     = stepOf(conv);
  const shipping = isShipping(conv);
  const router   = useRouter();
  const isNew    = step === 0;
  const isConf   = step === 1;
  const isLabeled = step === 2 && shipping;
  const isDone   = conv.deal_completed;

  return (
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(22,34,28,0.08)', border:`1px solid ${PAPER3}`, marginBottom:10 }}>
      <div style={{ display:'flex', gap:12, padding:'14px 16px 8px', alignItems:'center' }}>
        <div style={{ width:48, height:48, borderRadius:10, background:conv.listing_color||GREEN_TINT, flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
          {conv.listing_image
            ? <img src={conv.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
            : conv.listing_emoji || '🧸'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{conv.listing_title}</div>
          <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginTop:1 }}>
            Køber: <strong style={{ color:INK }}>{conv.initiator_name}</strong>
            <span> · {shipping ? '📦 Forsendelse' : conv.delivery_method === 'pickup' ? '📍 Afhentning' : '🤝 Aftalt levering'}</span>
          </div>
        </div>
        {isNew && (
          <span style={{ background:'#FEF9C3', color:'#92400E', borderRadius:99, fontSize:10, fontWeight:800, padding:'3px 8px', flexShrink:0 }}>NY</span>
        )}
      </div>

      <div style={{ padding:'0 16px' }}>
        <ProgressBar step={step} shipping={shipping} />
      </div>

      <div style={{ padding:'8px 16px 14px', display:'flex', gap:8, flexWrap:'wrap' }}>
        {isNew && (
          <button
            disabled={actionLoading === conv.id}
            onClick={() => onAction(conv, 'confirm')}
            style={{ flex:1, minWidth:120, padding:'10px', borderRadius:99, background: actionLoading===conv.id ? PAPER3 : PRIMARY, color: actionLoading===conv.id ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor: actionLoading===conv.id ? 'default' : 'pointer' }}>
            {actionLoading===conv.id ? 'Bekræfter…' : '✅ Bekræft ordre'}
          </button>
        )}

        {isConf && shipping && (
          <button
            onClick={() => router.push('/beskeder?conv=' + conv.id)}
            style={{ flex:1, minWidth:120, padding:'10px', borderRadius:99, background:GREEN_TINT, color:PRIMARY, border:`1.5px solid ${PRIMARY}`, fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            📦 Generer forsendelseslabel →
          </button>
        )}

        {isConf && !shipping && (
          <button
            disabled={actionLoading === conv.id}
            onClick={() => onAction(conv, 'pickup_done')}
            style={{ flex:1, minWidth:120, padding:'10px', borderRadius:99, background: actionLoading===conv.id ? PAPER3 : PRIMARY, color: actionLoading===conv.id ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor: actionLoading===conv.id ? 'default' : 'pointer' }}>
            {actionLoading===conv.id ? 'Gemmer…' : '🤝 Marker som afhentet'}
          </button>
        )}

        {isLabeled && (
          <button
            disabled={actionLoading === conv.id}
            onClick={() => onAction(conv, 'mark_sent')}
            style={{ flex:1, minWidth:120, padding:'10px', borderRadius:99, background: actionLoading===conv.id ? PAPER3 : PRIMARY, color: actionLoading===conv.id ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor: actionLoading===conv.id ? 'default' : 'pointer' }}>
            {actionLoading===conv.id ? 'Gemmer…' : '🚚 Marker som afsendt'}
          </button>
        )}

        {isDone && (
          <span style={{ fontFamily:FONT, fontSize:12, color:'#065F46', fontWeight:700, background:'#D1FAE5', borderRadius:99, padding:'8px 14px' }}>✓ Gennemført</span>
        )}

        <button
          onClick={() => router.push('/beskeder?conv=' + conv.id)}
          style={{ padding:'10px 14px', borderRadius:99, background:PAPER2, color:INK3, border:'none', fontFamily:FONT, fontWeight:600, fontSize:12, cursor:'pointer', marginLeft: isDone ? 'auto' : 0 }}>
          Chat
        </button>
      </div>
    </div>
  );
}

export default function MineOpgaverPage() {
  const router = useRouter();
  const { effectiveInstitution, showToast } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('aktive');
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await db.auth.getUser();
    if (!user) { setLoading(false); return; }

    let inst = effectiveInstitution || null;
    if (!inst) {
      const { data: ownInst } = await db.from('institutions').select('*').ilike('email', user.email).maybeSingle();
      if (ownInst) { inst = ownInst; }
      else {
        const { data: mem } = await db.from('institution_members').select('role,institutions(*)').eq('email', user.email).maybeSingle();
        if (mem?.institutions) inst = { ...mem.institutions, _memberRole: mem.role };
      }
    }

    const uid    = user.id;
    const instId = inst?.id;
    const instName = inst?.name;

    const parts = [];
    if (instId)   parts.push(`owner_institution_id.eq.${instId}`);
    if (uid)      parts.push(`owner_id.eq.${uid}`);
    if (instName) parts.push(`owner_name.eq.${instName}`);
    if (!parts.length) { setLoading(false); return; }

    const { data } = await db.from('conversations')
      .select('id,listing_title,listing_emoji,listing_color,listing_image,initiator_name,is_handled,handled_action,deal_completed,deal_type,delivery_method,shipment_id,last_message_at,owner_name,initiator_institution_id')
      .or(parts.join(','))
      .in('deal_type', ['køb','byd','byt','bundle'])
      .order('last_message_at', { ascending: false })
      .limit(100);

    setTasks(data || []);
    setLoading(false);
  }, [effectiveInstitution?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(conv, action) {
    setActionLoading(conv.id);
    try {
      const { data: { user } } = await db.auth.getUser();
      const now = new Date().toISOString();
      const senderName = effectiveInstitution?.name || conv.owner_name || 'Sælger';

      if (action === 'confirm') {
        const msg = `✅ ${senderName} har bekræftet din ordre.`;
        await db.from('chat_messages').insert({ conversation_id: conv.id, sender_id: user.id, sender_name: senderName, content: msg });
        const upd = { is_handled: true, handled_at: now, handled_action: 'order_confirmed', deal_type: 'køb', last_message: msg, last_message_at: now, initiator_unread: 1 };
        await db.from('conversations').update(upd).eq('id', conv.id);
        setTasks(ts => ts.map(t => t.id === conv.id ? { ...t, ...upd } : t));
        showToast?.('Ordre bekræftet!');

      } else if (action === 'mark_sent') {
        const msg = `🚚 ${senderName} har afsendt pakken. Hold øje med din e-mail for sporingsinformation.`;
        await db.from('chat_messages').insert({ conversation_id: conv.id, sender_id: user.id, sender_name: senderName, content: msg });
        const upd = { deal_completed: true, deal_completed_at: now, delivery_status: 'sent', last_message: msg, last_message_at: now, initiator_unread: 1 };
        await db.from('conversations').update(upd).eq('id', conv.id);
        setTasks(ts => ts.map(t => t.id === conv.id ? { ...t, ...upd } : t));
        showToast?.('Markeret som afsendt!');

      } else if (action === 'pickup_done') {
        const msg = `🤝 ${senderName} har markeret varen som afhentet. Handlen er gennemført!`;
        await db.from('chat_messages').insert({ conversation_id: conv.id, sender_id: user.id, sender_name: senderName, content: msg });
        const upd = { deal_completed: true, deal_completed_at: now, last_message: msg, last_message_at: now, initiator_unread: 1 };
        await db.from('conversations').update(upd).eq('id', conv.id);
        setTasks(ts => ts.map(t => t.id === conv.id ? { ...t, ...upd } : t));
        showToast?.('Markeret som afhentet!');
      }
    } catch {
      showToast?.('Noget gik galt', 'error');
    }
    setActionLoading(null);
  }

  const active  = tasks.filter(t => !t.deal_completed);
  const done    = tasks.filter(t => t.deal_completed);
  const newCnt  = active.filter(t => !t.is_handled).length;
  const inProg  = active.filter(t => t.is_handled).length;
  const shown   = filter === 'aktive' ? active : done;

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 0' }}>
          <button onClick={() => router.push('/profil')} style={{ background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0, flex:1 }}>Mine opgaver</h1>
        </div>

        {!loading && (newCnt > 0 || inProg > 0) && (
          <div style={{ display:'flex', gap:8, padding:'12px 16px 0' }}>
            {newCnt > 0 && <span style={{ background:'#FEF9C3', color:'#92400E', borderRadius:99, fontSize:12, fontWeight:700, padding:'4px 12px' }}>{newCnt} ny{newCnt !== 1 ? 'e' : ''} ordre</span>}
            {inProg > 0 && <span style={{ background:GREEN_TINT, color:PRIMARY, borderRadius:99, fontSize:12, fontWeight:700, padding:'4px 12px' }}>{inProg} i gang</span>}
          </div>
        )}

        <div style={{ display:'flex', borderBottom:`2px solid ${PAPER3}`, background:'#fff', marginTop:12 }}>
          {[['aktive','Aktive'], ['gennemforte','Gennemførte']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ flex:1, padding:'13px', border:'none', background:'none', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:15, color: filter===val ? PRIMARY : INK3, borderBottom: filter===val ? `2px solid ${PRIMARY}` : '2px solid transparent', marginBottom:-2 }}>
              {lbl} ({val==='aktive' ? active.length : done.length})
            </button>
          ))}
        </div>

        <div style={{ padding:'12px 16px 0' }}>
          {loading ? (
            <div style={{ padding:'60px 0', textAlign:'center' }}><Spinner /></div>
          ) : shown.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center', background:'#fff', borderRadius:16 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>{filter==='aktive' ? '🎉' : '📭'}</div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6 }}>
                {filter==='aktive' ? 'Ingen aktive opgaver' : 'Ingen gennemførte handler endnu'}
              </div>
              <div style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>
                {filter==='aktive' ? 'Alle dine handler er gennemførte 🎉' : 'Handler vises her når de er afsluttet'}
              </div>
            </div>
          ) : (
            shown.map(conv => (
              <TaskCard key={conv.id} conv={conv} onAction={handleAction} actionLoading={actionLoading} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
