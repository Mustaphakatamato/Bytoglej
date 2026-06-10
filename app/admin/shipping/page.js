'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, PAPER, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';

const FONT = "'Sora', sans-serif";

const STATUS_STYLES = {
  pending:    { bg:'#FEF9C3', color:'#92400e', label:'Afventer' },
  booked:     { bg:'#EFF6FF', color:'#2563EB', label:'Booket' },
  printed:    { bg:'#F0FDF4', color:'#16a34a', label:'Printet' },
  in_transit: { bg:'#EFF6FF', color:'#1d4ed8', label:'I transit' },
  delivered:  { bg:'#F0FDF4', color:'#16a34a', label:'Leveret ✓' },
  failed:     { bg:'#FEF2F2', color:'#e11d48', label:'Fejlet' },
  cancelled:  { bg:'#F3F4F6', color:'#6B7280', label:'Annulleret' },
};
const INV_STATUS = {
  draft:    { color:'#6B7570', label:'Kladde' },
  sent:     { color:'#2563EB', label:'Sendt' },
  paid:     { color:'#16a34a', label:'Betalt ✓' },
  overdue:  { color:'#e11d48', label:'Overskredet' },
  cancelled:{ color:'#6B7570', label:'Annulleret' },
};

export default function AdminShippingPage() {
  const router = useRouter();
  const { isAdmin } = useApp();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [editInst, setEditInst] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('shipments');

  useEffect(() => {
    if (isAdmin === false) { router.push('/dashboard'); return; }
    if (isAdmin) loadAll();
  }, [isAdmin]);

  async function loadAll() {
    setLoading(true);
    const [s, inv, inst] = await Promise.all([
      db.from('shipments')
        .select('id,status,carrier,service_type,size_category,tracking_number,tracking_url,cost_dkk,total_charged_to_seller_dkk,booked_at,delivered_at,seller_institution_id,buyer_institution_id,conversations(listing_title,owner_name,initiator_name)')
        .order('booked_at', { ascending: false })
        .limit(100),
      db.from('shipping_invoices')
        .select('id,invoice_number,institution_id,period_start,period_end,total_amount_dkk,status,due_date,sent_at,paid_at,institutions(name,email)')
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('institutions')
        .select('id,name,email,shipping_billing_enabled,shipping_credit_limit_dkk,shipping_current_balance_dkk')
        .order('name'),
    ]);
    setShipments(s.data || []);
    setInvoices(inv.data || []);
    setInstitutions(inst.data || []);
    setLoading(false);
  }

  async function markInvoicePaid(id) {
    await db.from('shipping_invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    setInvoices(invs => invs.map(i => i.id === id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i));
  }

  async function saveInstSettings() {
    if (!editInst) return;
    setSaving(true);
    await db.from('institutions').update({
      shipping_billing_enabled: editInst.shipping_billing_enabled,
      shipping_credit_limit_dkk: Number(editInst.shipping_credit_limit_dkk),
    }).eq('id', editInst.id);
    setInstitutions(insts => insts.map(i => i.id === editInst.id ? { ...i, ...editInst } : i));
    setEditInst(null);
    setSaving(false);
  }

  const filteredShipments = statusFilter === 'all' ? shipments : shipments.filter(s => s.status === statusFilter);
  const totalRevenue = shipments.reduce((s, r) => s + Number(r.total_charged_to_seller_dkk || r.cost_dkk || 0), 0);
  const unpaidInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + Number(i.total_amount_dkk || 0), 0);

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:PAPER, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily:FONT, color:INK3, fontSize:15 }}>Indlæser…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:PAPER, paddingTop:80, paddingBottom:80 }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 24px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:32 }}>
          <button onClick={()=>router.push('/admin')} style={{ background:'none', border:'none', color:INK3, cursor:'pointer', fontFamily:FONT, fontSize:13, padding:'6px 0', display:'flex', alignItems:'center', gap:6 }}>
            ← Admin
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:28, color:INK, letterSpacing:'-0.04em', margin:0 }}>📦 Forsendelser</h1>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:32 }}>
          {[
            { label:'Totale forsendelser', value:shipments.length, color:PRIMARY },
            { label:'Leverede forsendelser', value:shipments.filter(s=>s.status==='delivered').length, color:'#16a34a' },
            { label:'Total omsætning (kr.)', value:`${totalRevenue.toFixed(0)} kr.`, color:PRIMARY },
            { label:'Udestående fakturaer', value:`${unpaidTotal.toFixed(0)} kr.`, color:'#e11d48' },
          ].map((s,i) => (
            <div key={i} style={{ background:PAPER2, borderRadius:16, padding:'18px 20px', border:'1px solid rgba(22,34,28,0.07)' }}>
              <div style={{ fontFamily:FONT, fontSize:12, color:INK3, marginBottom:6 }}>{s.label}</div>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:24, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {[['shipments','Forsendelser'],['invoices','Fakturaer'],['institutions','Institutioner']].map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)}
              style={{ padding:'8px 18px', borderRadius:99, border:`1.5px solid ${tab===key?PRIMARY:PAPER3}`, background:tab===key?GREEN_TINT:'transparent', color:tab===key?PRIMARY:INK3, fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Shipments tab */}
        {tab === 'shipments' && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {['all','pending','booked','in_transit','delivered','failed'].map(s => (
                <button key={s} onClick={()=>setStatusFilter(s)}
                  style={{ padding:'5px 14px', borderRadius:99, border:`1.5px solid ${statusFilter===s?PRIMARY:PAPER3}`, background:statusFilter===s?GREEN_TINT:'transparent', color:statusFilter===s?PRIMARY:INK3, fontFamily:FONT, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                  {s === 'all' ? 'Alle' : (STATUS_STYLES[s]?.label || s)}
                </button>
              ))}
            </div>
            <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${PAPER3}`, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FONT }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${PAPER3}` }}>
                    {['Opslag','Sælger','Køber','Carrier','Størrelse','Tracking','Status','Beløb','Dato'].map(h => (
                      <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:700, color:INK3, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredShipments.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding:'32px', textAlign:'center', color:INK3 }}>Ingen forsendelser</td></tr>
                  ) : filteredShipments.map((s,i) => {
                    const st = STATUS_STYLES[s.status] || STATUS_STYLES.pending;
                    return (
                      <tr key={s.id} style={{ borderBottom:i<filteredShipments.length-1?`1px solid ${PAPER2}`:'none', background:i%2===0?'#fff':PAPER }}>
                        <td style={{ padding:'10px 16px', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.conversations?.listing_title || '—'}</td>
                        <td style={{ padding:'10px 16px', color:INK2 }}>{s.conversations?.owner_name || '—'}</td>
                        <td style={{ padding:'10px 16px', color:INK2 }}>{s.conversations?.initiator_name || '—'}</td>
                        <td style={{ padding:'10px 16px', color:INK3 }}>{s.carrier}</td>
                        <td style={{ padding:'10px 16px', color:INK3 }}>{s.size_category}</td>
                        <td style={{ padding:'10px 16px' }}>
                          {s.tracking_number
                            ? <a href={s.tracking_url||'#'} target="_blank" rel="noopener noreferrer" style={{ color:PRIMARY, fontWeight:600, textDecoration:'underline' }}>{s.tracking_number}</a>
                            : '—'}
                        </td>
                        <td style={{ padding:'10px 16px' }}>
                          <span style={{ background:st.bg, color:st.color, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700 }}>{st.label}</span>
                        </td>
                        <td style={{ padding:'10px 16px', fontWeight:700, color:INK }}>{Number(s.total_charged_to_seller_dkk||s.cost_dkk||0).toFixed(2)} kr.</td>
                        <td style={{ padding:'10px 16px', color:INK3, whiteSpace:'nowrap' }}>{(s.booked_at||'').slice(0,10)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Invoices tab */}
        {tab === 'invoices' && (
          <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${PAPER3}`, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FONT }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${PAPER3}` }}>
                  {['Fakturanr.','Institution','Periode','Total','Status','Forfald',''].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:700, color:INK3, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:INK3 }}>Ingen fakturaer endnu</td></tr>
                ) : invoices.map((inv,i) => {
                  const ist = INV_STATUS[inv.status] || INV_STATUS.sent;
                  return (
                    <tr key={inv.id} style={{ borderBottom:i<invoices.length-1?`1px solid ${PAPER2}`:'none' }}>
                      <td style={{ padding:'10px 16px', fontWeight:700 }}>{inv.invoice_number}</td>
                      <td style={{ padding:'10px 16px' }}>{inv.institutions?.name || '—'}</td>
                      <td style={{ padding:'10px 16px', color:INK3 }}>{inv.period_start} – {inv.period_end}</td>
                      <td style={{ padding:'10px 16px', fontWeight:700 }}>{Number(inv.total_amount_dkk).toFixed(2)} kr.</td>
                      <td style={{ padding:'10px 16px' }}>
                        <span style={{ color:ist.color, fontWeight:700, fontSize:12 }}>{ist.label}</span>
                      </td>
                      <td style={{ padding:'10px 16px', color: new Date(inv.due_date) < new Date() && inv.status !== 'paid' ? '#e11d48' : INK3 }}>{inv.due_date}</td>
                      <td style={{ padding:'10px 16px' }}>
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <button onClick={()=>markInvoicePaid(inv.id)}
                            style={{ background:'#F0FDF4', border:'none', borderRadius:99, padding:'5px 14px', fontSize:12, fontWeight:700, color:'#16a34a', cursor:'pointer', fontFamily:FONT }}>
                            Marker betalt ✓
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Institutions tab */}
        {tab === 'institutions' && (
          <>
            {editInst && (
              <div style={{ background:'#fff', borderRadius:16, border:`2px solid ${PRIMARY}`, padding:'20px 24px', marginBottom:20 }}>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:INK, marginBottom:14 }}>Rediger: {editInst.name}</div>
                <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FONT, fontSize:13, cursor:'pointer' }}>
                    <input type="checkbox" checked={editInst.shipping_billing_enabled}
                      onChange={e=>setEditInst(ei=>({...ei, shipping_billing_enabled:e.target.checked}))} />
                    Forsendelse aktiveret
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FONT, fontSize:13 }}>
                    Kreditgrænse (kr.):
                    <input type="number" value={editInst.shipping_credit_limit_dkk} min={0} step={100}
                      onChange={e=>setEditInst(ei=>({...ei, shipping_credit_limit_dkk:e.target.value}))}
                      style={{ padding:'6px 10px', borderRadius:8, border:`1.5px solid ${PAPER3}`, fontFamily:FONT, fontSize:13, width:100 }} />
                  </label>
                  <button onClick={saveInstSettings} disabled={saving}
                    style={{ background:PRIMARY, color:'#fff', border:'none', borderRadius:99, padding:'8px 20px', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {saving ? 'Gemmer…' : 'Gem'}
                  </button>
                  <button onClick={()=>setEditInst(null)}
                    style={{ background:'none', border:'none', color:INK3, fontFamily:FONT, fontSize:13, cursor:'pointer' }}>
                    Annuller
                  </button>
                </div>
              </div>
            )}
            <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${PAPER3}`, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FONT }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${PAPER3}` }}>
                    {['Institution','E-mail','Forsendelse','Kreditgrænse','Aktuel saldo',''].map(h => (
                      <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:700, color:INK3, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {institutions.map((inst,i) => (
                    <tr key={inst.id} style={{ borderBottom:i<institutions.length-1?`1px solid ${PAPER2}`:'none' }}>
                      <td style={{ padding:'10px 16px', fontWeight:700 }}>{inst.name}</td>
                      <td style={{ padding:'10px 16px', color:INK3 }}>{inst.email}</td>
                      <td style={{ padding:'10px 16px' }}>
                        <span style={{ background:inst.shipping_billing_enabled?'#F0FDF4':'#F3F4F6', color:inst.shipping_billing_enabled?'#16a34a':'#6B7280', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                          {inst.shipping_billing_enabled ? 'Aktiveret' : 'Ikke aktiveret'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 16px', fontWeight:600 }}>{Number(inst.shipping_credit_limit_dkk||0).toFixed(0)} kr.</td>
                      <td style={{ padding:'10px 16px', color: Number(inst.shipping_current_balance_dkk||0) > Number(inst.shipping_credit_limit_dkk||500)*0.8 ? '#e11d48' : INK2, fontWeight:600 }}>
                        {Number(inst.shipping_current_balance_dkk||0).toFixed(0)} kr.
                      </td>
                      <td style={{ padding:'10px 16px' }}>
                        <button onClick={()=>setEditInst({...inst})}
                          style={{ background:GREEN_TINT, border:'none', borderRadius:99, padding:'5px 14px', fontSize:12, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>
                          Rediger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
