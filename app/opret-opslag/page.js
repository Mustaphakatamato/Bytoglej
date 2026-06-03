'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, CONDITIONS, AGE_GROUPS, URGENCY_OPTIONS } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import { useWindowWidth } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif"; // ui



function PreviewCard({ form, imgPreview }) {
  const tc = TYPE_CFG[form.type] || { label: form.type, color: INK3, bg: PAPER2 };
  return (
    <div style={{ background:PAPER2, borderRadius:20, overflow:'hidden', border:'1px solid rgba(22,34,28,0.06)', boxShadow:'0 4px 24px rgba(22,34,28,0.10)' }}>
      <div style={{ height:200, background:imgPreview ? '#ddd' : (form.color || GREEN_TINT), display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
        {imgPreview
          ? <img src={imgPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ fontSize:72, opacity:0.5 }}>{form.emoji || '🧸'}</span>
        }
      </div>
      <div style={{ padding:'14px 16px 18px' }}>
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ background:tc.bg, color:tc.color, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{tc.label}</span>
          {form.condition && <span style={{ background:PAPER3, color:INK2, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{form.condition}</span>}
          {form.category && (() => {
            const cat = CATEGORIES.find(c => c.key === form.category);
            if (!cat) return null;
            return (
              <span style={{ display:'inline-flex', alignItems:'center', gap:3, background:GREEN_TINT, color:PRIMARY, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>
                <span>{cat.emoji}</span>
                <span>{form.subcategory || cat.label}</span>
              </span>
            );
          })()}
        </div>
        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:INK, marginBottom:6, lineHeight:1.3 }}>{form.title || 'Titel på opslag'}</div>
        {form.description && <div style={{ fontSize:12, color:INK3, lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{form.description}</div>}
        <div style={{ marginTop:8 }}>
          {form.price && form.type === 'køb'
            ? <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:PRIMARY }}>{form.price} kr.</div>
            : form.type === 'byt' ? <div style={{ fontSize:13, color:CORAL, fontWeight:700, fontFamily:FONT }}>Byttes kun</div>
            : form.type === 'byd' ? <div style={{ fontSize:13, color:'#7C3AED', fontWeight:700, fontFamily:FONT }}>Afgiv bud</div>
            : null
          }
        </div>
      </div>
    </div>
  );
}

export default function OpretOpslagPage() {
  const router = useRouter();
  const { showToast, fetchListings } = useApp();
  const { institution: ctxInstitution, userId: ctxUserId, isAdminView: ctxIsAdmin } = useActiveUser();
  const ww = useWindowWidth();
  const isMobile = ww < 768;
  const fileRef = useRef(null);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiApply, setAiApply] = useState({ title: true, description: true });
  const [aiRegenerating, setAiRegenerating] = useState({ title: false, description: false });
  const [institution, setInstitution] = useState(ctxInstitution || null);
  const [imgFiles, setImgFiles] = useState([]);
  const [imgPreviews, setImgPreviews] = useState([]);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const dragState = useRef({ dragging: null, lastOver: null });
  const [copiedFrom, setCopiedFrom] = useState(null);
  const [form, setForm] = useState({
    title:'', type:'køb', price:'', age_group:'3-6 år',
    description:'', condition:'God', emoji:'🧸', color:'#FFD166',
    tags:[], min_bid:'', category:'', subcategory:'', urgency:'ingen',
  });

  useEffect(() => {
    db.auth.getUser().then(async ({ data:{ user } }) => {
      if (!user) { router.push('/login'); return; }
      if (!institution) {
        const { data: own } = await db.from('institutions').select('*').ilike('email', user.email).maybeSingle();
        if (own) { setInstitution(own); return; }
        const { data: mem } = await db.from('institution_members').select('role,institutions(*)').eq('email', user.email).maybeSingle();
        if (mem?.institutions) setInstitution({ ...mem.institutions, _memberRole: mem.role });
      }
    });
  }, []);

  useEffect(() => {
    const fromId = new URLSearchParams(window.location.search).get('from');
    if (!fromId) return;
    db.from('listings').select('*').eq('id', fromId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setCopiedFrom(data.title);
      setForm({
        title: data.title,
        type: data.type || 'køb',
        price: data.price || '',
        age_group: data.age_group || '3-6 år',
        description: data.description || '',
        condition: data.condition || 'God',
        emoji: data.emoji || '🧸',
        color: data.color || '#FFD166',
        tags: data.tags || [],
        min_bid: data.min_bid || '',
        category: data.category || '',
        subcategory: data.subcategory || '',
      });
    });
  }, []);

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = 6 - imgFiles.length;
    const toAdd = files.slice(0, remaining);
    const newPreviews = toAdd.map(f => URL.createObjectURL(f));
    setImgFiles(prev => [...prev, ...toAdd]);
    setImgPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = '';
  }

  function removeImg(i) {
    URL.revokeObjectURL(imgPreviews[i]);
    setImgFiles(f => f.filter((_,j) => j!==i));
    setImgPreviews(p => p.filter((_,j) => j!==i));
  }

  function shiftImg(from, to) {
    if (from === to || from === null || to === null) return;
    setImgFiles(prev => { const a=[...prev]; const [x]=a.splice(from,1); a.splice(to,0,x); return a; });
    setImgPreviews(prev => { const a=[...prev]; const [x]=a.splice(from,1); a.splice(to,0,x); return a; });
  }

  // Touch drag — images shuffle live as finger moves
  function startTouchDrag(i, e) {
    dragState.current = { dragging: i, lastOver: null };
    setDraggingIdx(i);
    const onMove = (ev) => {
      ev.preventDefault();
      const t = ev.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const item = el?.closest('[data-img-idx]');
      if (!item) return;
      const to = Number(item.dataset.imgIdx);
      const from = dragState.current.dragging;
      if (Number.isFinite(to) && to !== from && to !== dragState.current.lastOver) {
        dragState.current.lastOver = to;
        shiftImg(from, to);
        dragState.current.dragging = to;
        setDraggingIdx(to);
      }
    };
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      dragState.current = { dragging: null, lastOver: null };
      setDraggingIdx(null);
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { once: true });
  }

  // Desktop HTML5 drag — same live-shuffle behaviour
  function onDragStart(e, i) {
    e.dataTransfer.effectAllowed = 'move';
    dragState.current = { dragging: i, lastOver: null };
    setDraggingIdx(i);
  }
  function onDragOver(e, i) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const from = dragState.current.dragging;
    if (from !== null && i !== from && i !== dragState.current.lastOver) {
      dragState.current.lastOver = i;
      shiftImg(from, i);
      dragState.current.dragging = i;
      setDraggingIdx(i);
    }
  }
  function onDrop(e) { e.preventDefault(); }
  function onDragEnd() {
    dragState.current = { dragging: null, lastOver: null };
    setDraggingIdx(null);
  }

  async function handleImprove() {
    setAiImproving(true);
    try {
      const res = await fetch('/api/improve-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description, type: form.type, condition: form.condition, age_group: form.age_group, tags: form.tags }),
      });
      const json = await res.json();
      if (json.error) { showToast('AI-forbedring mislykkedes — prøv igen', 'error'); }
      else { setAiSuggestion(json); setAiApply({ title: true, description: true }); }
    } catch { showToast('AI-forbedring mislykkedes — prøv igen', 'error'); }
    setAiImproving(false);
  }

  async function handleRegenerate(field) {
    setAiRegenerating(r => ({ ...r, [field]: true }));
    try {
      const res = await fetch('/api/improve-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description, type: form.type, condition: form.condition, age_group: form.age_group, tags: form.tags }),
      });
      const json = await res.json();
      if (!json.error) setAiSuggestion(prev => ({ ...prev, [field]: json[field] }));
    } catch {}
    setAiRegenerating(r => ({ ...r, [field]: false }));
  }

  function applyAiSuggestion() {
    setForm(f => ({
      ...f,
      title: aiApply.title ? aiSuggestion.title : f.title,
      description: aiApply.description ? aiSuggestion.description : f.description,
    }));
    setAiSuggestion(null);
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    if (form.type === 'køb' && !String(form.price).trim()) { showToast('Angiv en pris for køb-opslag', 'error'); return; }
    if (!form.description.trim()) { showToast('Tilføj en beskrivelse', 'error'); return; }
    setSaving(true);
    const { data:{ user } } = await db.auth.getUser();
    let inst = institution;
    if (!inst && user) {
      const { data } = await db.from('institutions').select('*').ilike('email', user.email).maybeSingle();
      if (data) inst = data;
    }
    const isSøges = form.type === 'søges';
    const insertData = {
      title: form.title, type: form.type,
      price: (form.type==='køb' || isSøges) ? Number(form.price)||null : null,
      age_group: form.age_group, description: form.description,
      condition: form.condition, city: inst?.city || '',
      institution_name: inst?.name || 'Min institution',
      user_id: user?.id || null,
      emoji: isSøges ? '🔍' : form.emoji,
      color: isSøges ? '#F5F0FF' : form.color,
      tags: form.tags || [], images: [], bid_count: 0, is_active: true,
      category: form.category || null, subcategory: form.subcategory || null,
    };
    if (form.type==='byd' && form.min_bid) insertData.min_bid = Number(form.min_bid);
    const { data: listing, error } = await db.from('listings').insert(insertData).select().single();
    if (error) { console.error('Insert error:', error); showToast('Noget gik galt — prøv igen', 'error'); setSaving(false); return; }
    // urgency: update separately so it fails silently if column doesn't exist yet
    if (isSøges && listing?.id) {
      await db.from('listings').update({ urgency: form.urgency || 'ingen' }).eq('id', listing.id).then(() => {});
    }
    if (!isSøges && imgFiles.length > 0) {
      const urls = [];
      for (const file of imgFiles) {
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${listing.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: up } = await db.storage.from('listing-images').upload(path, file, { contentType: file.type });
        if (up) { const { data:{publicUrl} } = db.storage.from('listing-images').getPublicUrl(up.path); urls.push(publicUrl); }
      }
      if (urls.length) await db.from('listings').update({ images: urls }).eq('id', listing.id);
    }
    // Fire-and-forget: saved-search email notifications
    fetch('/api/match-searches', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ listingId:listing.id, title:listing.title, type:listing.type, tags:listing.tags||[], city:listing.city, age_group:listing.age_group }),
    }).catch(()=>{});
    // Fire-and-forget: in-app auto-match notifications (both directions)
    fetch('/api/auto-match-soges', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        mode: isSøges ? 'new-søges' : 'new-listing',
        listingId: listing.id, category: listing.category,
        age_group: listing.age_group, condition: listing.condition,
        title: listing.title, institutionName: inst?.name, institutionId: inst?.id,
      }),
    }).catch(()=>{});
    fetchListings?.();
    setSaving(false);
    showToast(isSøges ? 'Søges-opslag publiceret! Tjek mulige matches på dit dashboard 🔍' : 'Opslag publiceret! 🎉');
    router.push('/dashboard');
  }

  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:14, outline:'none', fontFamily:FONT, background:'#fff', color:INK, boxSizing:'border-box' };
  const labelStyle = { display:'block', fontSize:13, fontWeight:700, marginBottom:7, fontFamily:FONT, color:INK2 };

  const step1Valid = form.title.trim() && (form.type !== 'køb' || form.price);
  const step2Valid = form.description.trim();

  return (
    <div style={{ minHeight:'100vh', background:PAPER }} className="page-enter">


      {/* Header */}
      <div style={{ background:`linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, paddingTop:90, paddingBottom:36, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <span style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?140:240, color:'rgba(255,255,255,0.04)', lineHeight:1, letterSpacing:'-0.05em', userSelect:'none' }}>+</span>
        </div>
        <div style={{ maxWidth:900, margin:'0 auto', padding:'0 24px', position:'relative' }}>
          <button onClick={()=>router.push('/dashboard')} style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:99, padding:'7px 16px', color:'rgba(255,255,255,0.8)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:FONT, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
            ← Tilbage til dashboard
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?26:36, color:'#fff', letterSpacing:'-0.04em', marginBottom:8, lineHeight:1.1 }}>{copiedFrom ? 'Opret lignende opslag' : 'Opret nyt opslag'}</h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.6)', fontFamily:FONT, margin:0 }}>{copiedFrom ? 'Oplysningerne er udfyldt fra dit tidligere opslag — tilpas og publicer' : 'Udfyld oplysningerne nedenfor — det tager kun 2 minutter'}</p>
          {copiedFrom && (
            <div style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.15)', borderRadius:99, padding:'6px 14px' }}>
              <span style={{ fontSize:14 }}>📋</span>
              <span style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.9)', fontFamily:FONT }}>Kopieret fra: {copiedFrom}</span>
            </div>
          )}

          {/* Step indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:0, marginTop:28, maxWidth:320 }}>
            {[{n:1,label:'Basisinfo'},{n:2,label:'Detaljer & billeder'}].map((s,i) => (
              <div key={s.n} style={{ display:'flex', alignItems:'center', flex:i<1?0:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, cursor: step>s.n?'pointer':'default' }} onClick={()=>{ if(step>s.n) setStep(s.n); }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background: step>=s.n ? '#fff' : 'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, fontWeight:800, fontSize:13, color: step>=s.n ? PRIMARY : 'rgba(255,255,255,0.5)', flexShrink:0, transition:'all 0.2s' }}>{step>s.n ? '✓' : s.n}</div>
                  <span style={{ fontSize:12, fontWeight:600, color: step>=s.n ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', fontFamily:FONT, whiteSpace:'nowrap' }}>{s.label}</span>
                </div>
                {i<1 && <div style={{ flex:1, height:2, background: step>1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)', margin:'0 12px', minWidth:24, transition:'background 0.3s' }} />}
              </div>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 1440 48" style={{ position:'absolute', bottom:-1, left:0, right:0, width:'100%', display:'block' }} preserveAspectRatio="none">
          <path d="M0,24 C360,48 1080,0 1440,24 L1440,48 L0,48 Z" fill={PAPER} />
        </svg>
      </div>

      {/* Body */}
      <div style={{ maxWidth:900, margin:'0 auto', padding:isMobile?'28px 16px 60px':'40px 24px 80px' }}>
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 340px', gap:32, alignItems:'start' }}>

          {/* Form */}
          <div style={{ background:'#fff', borderRadius:24, padding:isMobile?'24px 20px':'36px 36px', boxShadow:'0 2px 16px rgba(22,34,28,0.07)', border:`1px solid ${PAPER2}` }}>
            {step === 1 && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                <div>
                  <label style={labelStyle}>Opslagstype</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {['køb','byd','byt','søges'].map(t => (
                      <button key={t} onClick={()=>setForm({...form,type:t})} style={{ flex:'1 1 80px', padding:'12px 8px', borderRadius:12, background:form.type===t?TYPE_CFG[t].bg:PAPER2, color:form.type===t?TYPE_CFG[t].color:INK3, fontFamily:FONT, fontWeight:700, fontSize:13, border:form.type===t?`2px solid ${TYPE_CFG[t].color}`:'2px solid transparent', cursor:'pointer', transition:'all 0.15s' }}>
                        {TYPE_CFG[t].icon} {TYPE_CFG[t].label}
                      </button>
                    ))}
                  </div>
                  {form.type === 'søges' && (
                    <div style={{ marginTop:10, background:'#F5F0FF', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#7C3AED', fontFamily:FONT, fontWeight:600 }}>
                      🔍 Søges-opslag vises i en separat fane og matcher automatisk eksisterende opslag
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Titel <span style={{ color:'#e53e3e' }}>*</span></label>
                  <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Fx: LEGO Duplo stor kasse, 120 klodser" style={inputStyle} />
                </div>

                {form.type === 'køb' && (
                  <div>
                    <label style={labelStyle}>Pris (kr.) <span style={{ color:'#e53e3e' }}>*</span></label>
                    <input type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Fx 250" min="1" style={{ ...inputStyle, border:`1.5px solid ${!form.price?'#FCA5A5':PAPER3}` }} />
                  </div>
                )}
                {form.type === 'byd' && (
                  <div>
                    <label style={labelStyle}>Mindste bud (kr.) <span style={{ fontWeight:400, color:INK3 }}>— valgfri</span></label>
                    <input type="number" value={form.min_bid||''} onChange={e=>setForm({...form,min_bid:e.target.value})} placeholder="Lad stå tom for intet minimum" min="1" style={inputStyle} />
                  </div>
                )}
                {form.type === 'søges' && (
                  <div>
                    <label style={labelStyle}>Budget (kr.) <span style={{ fontWeight:400, color:INK3 }}>— valgfri, lad stå tom hvis byt</span></label>
                    <input type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Fx 200" min="0" style={inputStyle} />
                  </div>
                )}
                {form.type === 'søges' && (
                  <div>
                    <label style={labelStyle}>Hvor hurtigt har I brug for det?</label>
                    <div style={{ display:'flex', gap:8 }}>
                      {URGENCY_OPTIONS.map(u => (
                        <button key={u.key} onClick={()=>setForm({...form,urgency:u.key})}
                          style={{ flex:1, padding:'10px 6px', borderRadius:12, background:form.urgency===u.key?'#F5F0FF':PAPER2, color:form.urgency===u.key?'#7C3AED':INK3, fontFamily:FONT, fontWeight:700, fontSize:12, border:form.urgency===u.key?'2px solid #7C3AED':'2px solid transparent', cursor:'pointer', transition:'all 0.15s', textAlign:'center' }}>
                          {u.emoji}<br /><span style={{ fontSize:11 }}>{u.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Aldersgruppe</label>
                  <select value={form.age_group} onChange={e=>setForm({...form,age_group:e.target.value})} style={{ ...inputStyle, cursor:'pointer' }}>
                    {AGE_GROUPS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>

                {/* Category picker */}
                <div>
                  <label style={labelStyle}>Kategori <span style={{ fontWeight:400, color:INK3 }}>(valgfri)</span></label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: form.category ? 10 : 0 }}>
                    {CATEGORIES.map(cat => {
                      const sel = form.category === cat.key;
                      return (
                        <button key={cat.key} type="button"
                          onClick={() => setForm(f => ({ ...f, category: sel ? '' : cat.key, subcategory: '' }))}
                          style={{ padding:'6px 14px', borderRadius:99, fontSize:12, fontWeight:700, border: sel ? `2px solid ${PRIMARY}` : '2px solid transparent', background: sel ? GREEN_TINT : PAPER2, color: sel ? PRIMARY : INK3, cursor:'pointer', fontFamily:FONT, transition:'all 0.12s', display:'flex', alignItems:'center', gap:5 }}>
                          <span>{cat.emoji}</span><span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {form.category && (() => {
                    const catObj = CATEGORIES.find(c => c.key === form.category);
                    if (!catObj) return null;
                    return (
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:INK3, fontFamily:FONT, marginBottom:6 }}>Underkategori <span style={{ fontWeight:400 }}>(valgfri)</span></div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {catObj.sub.map(sub => {
                            const selSub = form.subcategory === sub;
                            return (
                              <button key={sub} type="button"
                                onClick={() => setForm(f => ({ ...f, subcategory: selSub ? '' : sub }))}
                                style={{ padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, border: selSub ? `2px solid ${PRIMARY}` : `1.5px solid ${PAPER3}`, background: selSub ? GREEN_TINT : PAPER2, color: selSub ? PRIMARY : INK3, cursor:'pointer', fontFamily:FONT, transition:'all 0.12s' }}>
                                {sub}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <button onClick={()=>{ if(step1Valid) { setStep(2); window.scrollTo({ top:0, behavior:'instant' }); } }} disabled={!step1Valid} style={{ width:'100%', padding:'14px', borderRadius:99, background:step1Valid?PRIMARY:PAPER3, color:step1Valid?'#fff':INK3, border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:step1Valid?'pointer':'not-allowed', marginTop:4, transition:'all 0.2s' }}>
                  Næste: Detaljer & billeder →
                </button>
              </div>
            )}

            {step === 2 && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
                    <label style={{ ...labelStyle, marginBottom:0 }}>Beskrivelse <span style={{ color:'#e53e3e' }}>*</span></label>
                    {(form.title.trim() || form.description.trim()) && (
                      <button type="button" onClick={handleImprove} disabled={aiImproving} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:99, background: aiImproving ? PAPER2 : `linear-gradient(135deg, #7C3AED, ${PRIMARY})`, color: aiImproving ? INK3 : '#fff', border:'none', fontSize:12, fontWeight:700, cursor: aiImproving ? 'not-allowed' : 'pointer', fontFamily:FONT, transition:'all 0.2s', flexShrink:0 }}>
                        {aiImproving ? <><Spinner /> Forbedrer…</> : <>✨ Forbedre med AI</>}
                      </button>
                    )}
                  </div>
                  <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                    placeholder={form.type==='søges'
                      ? 'Beskriv hvad I leder efter, stand-krav, og hvad I evt. tilbyder i bytte…'
                      : 'Beskriv legetøjets stand, hvad der medfølger, mål, begrundelse for salg osv.'}
                    rows={4} style={{ ...inputStyle, resize:'vertical', minHeight:100 }} />
                </div>

                <div>
                  <label style={labelStyle}>{form.type==='søges' ? 'Minimum acceptable stand' : 'Stand'}</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {CONDITIONS.map(c => (
                      <button key={c} onClick={()=>setForm({...form,condition:c})} style={{ padding:'9px 18px', borderRadius:99, fontSize:13, fontWeight:600, border: form.condition===c ? `2px solid ${PRIMARY}` : '2px solid transparent', background: form.condition===c ? GREEN_TINT : PAPER2, color: form.condition===c ? PRIMARY : INK3, fontFamily:FONT, cursor:'pointer', transition:'all 0.12s' }}>{c}</button>
                    ))}
                  </div>
                  {form.type==='søges' && <div style={{ fontSize:11, color:INK3, fontFamily:FONT, marginTop:6 }}>Vi accepterer denne stand eller bedre</div>}
                </div>

                {form.type !== 'søges' && <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <label style={{ ...labelStyle, marginBottom:0 }}>Billeder <span style={{ fontWeight:400, color:INK3 }}>(op til 6)</span></label>
                    {imgFiles.length > 0 && imgFiles.length < 6 && (
                      <button type="button" onClick={()=>fileRef.current?.click()} style={{ fontSize:12, fontWeight:700, color:PRIMARY, background:GREEN_TINT, border:'none', borderRadius:99, padding:'5px 12px', cursor:'pointer', fontFamily:FONT }}>+ Tilføj</button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display:'none' }} />
                  {imgPreviews.length === 0 ? (
                    <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${PAPER3}`, borderRadius:16, padding:'36px 20px', textAlign:'center', cursor:'pointer', background:PAPER, transition:'border-color 0.15s' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=PRIMARY}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=PAPER3}>
                      <div style={{ width:52, height:52, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:INK, marginBottom:4, fontFamily:FONT }}>Klik for at uploade billeder</div>
                      <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>JPG, PNG eller WEBP · Maks 6 billeder</div>
                      <div style={{ fontSize:11, color:INK3, marginTop:4, fontFamily:FONT }}>Billeder med personer bliver automatisk afvist</div>
                    </div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      {imgPreviews.map((src,i) => (
                        <div
                          key={i}
                          data-img-idx={i}
                          draggable
                          onDragStart={e=>onDragStart(e,i)}
                          onDragOver={e=>onDragOver(e,i)}
                          onDrop={e=>onDrop(e,i)}
                          onDragEnd={onDragEnd}
                          onTouchStart={e=>{ e.preventDefault(); startTouchDrag(i, e); }}
                          onContextMenu={e=>e.preventDefault()}
                          style={{ position:'relative', aspectRatio:'1', borderRadius:12, overflow:'hidden', border: i===0 ? `2px solid ${PRIMARY}` : '2px solid transparent', transform: draggingIdx===i ? 'scale(1.08)' : 'scale(1)', boxShadow: draggingIdx===i ? '0 8px 24px rgba(22,34,28,0.22)' : 'none', opacity: draggingIdx !== null && draggingIdx !== i ? 0.75 : 1, cursor: draggingIdx!==null ? 'grabbing' : 'grab', transition:'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s', userSelect:'none', WebkitUserSelect:'none', WebkitTouchCallout:'none', touchAction:'none', zIndex: draggingIdx===i ? 2 : 1 }}>
                          <img src={src} alt="" draggable={false} style={{ width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none', userSelect:'none', WebkitUserSelect:'none', WebkitTouchCallout:'none' }} />
                          <button onClick={e=>{e.stopPropagation();removeImg(i);}} style={{ position:'absolute', top:5, right:5, width:22, height:22, borderRadius:'50%', background:'rgba(22,34,28,0.7)', border:'none', color:'#fff', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, touchAction:'auto' }}>✕</button>
                          {i===0 && <div style={{ position:'absolute', bottom:5, left:0, right:0, display:'flex', justifyContent:'center', pointerEvents:'none' }}><div style={{ background:PRIMARY, borderRadius:6, padding:'2px 8px', fontSize:9, color:'#fff', fontWeight:700, fontFamily:FONT }}>Forside</div></div>}
                        </div>
                      ))}
                      {imgFiles.length < 6 && (
                        <div onClick={()=>fileRef.current?.click()} style={{ aspectRatio:'1', borderRadius:12, border:`2px dashed ${PAPER3}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:PAPER, fontSize:28, color:INK3 }}>+</div>
                      )}
                    </div>
                  )}
                  {imgPreviews.length > 1 && <div style={{ fontSize:11, color:INK3, textAlign:'center', marginTop:6, fontFamily:FONT }}>Hold og træk billeder for at ændre rækkefølge · Det første er forsiden</div>}
                </div>}

                <div style={{ display:'flex', gap:10, marginTop:4 }}>
                  <button onClick={()=>setStep(1)} style={{ flex:1, padding:'13px', borderRadius:99, background:PAPER2, color:INK2, border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    ← Tilbage
                  </button>
                  <button onClick={handleCreate} disabled={saving||!step2Valid} style={{ flex:2, padding:'13px', borderRadius:99, background: saving||!step2Valid ? PAPER3 : PRIMARY, color: saving||!step2Valid ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor: saving||!step2Valid ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s' }}>
                    {saving ? <><Spinner /> Publicerer…</> : '✓ Publicer opslag'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {!isMobile && (
            <div style={{ position:'sticky', top:96 }}>
              <div style={{ fontSize:11, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12, fontFamily:FONT }}>Live forhåndsvisning</div>
              <PreviewCard form={form} imgPreview={imgPreviews[0]} />
              {institution && (
                <div style={{ marginTop:14, background:GREEN_TINT, borderRadius:14, padding:'12px 16px', display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:14, fontFamily:FONT, flexShrink:0 }}>
                    {institution.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK }}>{institution.name}</div>
                    <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>{institution.city}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Comparison Modal */}
      {aiSuggestion && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={()=>setAiSuggestion(null)}>
          <div style={{ background:'#fff', borderRadius:24, padding:isMobile?'24px 20px':'32px 36px', maxWidth:700, width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(22,34,28,0.22)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, #7C3AED, ${PRIMARY})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>✨</div>
              <div>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, letterSpacing:'-0.03em' }}>AI-forslag til dit opslag</div>
                <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>Klik på den version du vil bruge for hvert felt</div>
              </div>
            </div>

            <div style={{ height:1, background:PAPER2, margin:'16px 0' }} />

            {/* Title comparison */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:INK2, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Titel</div>
              <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:10 }}>
                <div onClick={()=>setAiApply(a=>({...a,title:false}))} style={{ borderRadius:14, padding:'14px 16px', border:`2px solid ${!aiApply.title ? PRIMARY : PAPER2}`, background:!aiApply.title ? GREEN_TINT : PAPER, cursor:'pointer', transition:'all 0.15s', position:'relative' }}>
                  {!aiApply.title && <div style={{ position:'absolute', top:10, right:10, width:18, height:18, borderRadius:'50%', background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:800 }}>✓</div>}
                  <div style={{ fontSize:10, fontWeight:700, color:INK3, fontFamily:FONT, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Dit eget</div>
                  <div style={{ fontSize:14, fontWeight:600, color:INK, fontFamily:FONT, lineHeight:1.4 }}>{form.title || <span style={{ color:INK3, fontStyle:'italic' }}>Ingen titel</span>}</div>
                </div>
                <div onClick={()=>setAiApply(a=>({...a,title:true}))} style={{ borderRadius:14, padding:'14px 16px', border:`2px solid ${aiApply.title ? '#7C3AED' : PAPER2}`, background:aiApply.title ? '#F5F0FF' : PAPER, cursor:'pointer', transition:'all 0.15s', position:'relative' }}>
                  {aiApply.title && <div style={{ position:'absolute', top:10, right:10, width:18, height:18, borderRadius:'50%', background:'#7C3AED', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:800 }}>✓</div>}
                  <div style={{ fontSize:10, fontWeight:700, color:'#7C3AED', fontFamily:FONT, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>✨ AI-forslag</div>
                  <div style={{ fontSize:14, fontWeight:600, color:INK, fontFamily:FONT, lineHeight:1.4 }}>{aiRegenerating.title ? <span style={{ color:INK3, fontStyle:'italic' }}>Genererer nyt forslag…</span> : aiSuggestion.title}</div>
                  <button type="button" onClick={e=>{ e.stopPropagation(); handleRegenerate('title'); }} disabled={aiRegenerating.title} style={{ marginTop:10, display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:'#7C3AED', background:'rgba(124,58,237,0.08)', border:'none', borderRadius:99, padding:'4px 10px', cursor: aiRegenerating.title ? 'not-allowed' : 'pointer', fontFamily:FONT, opacity: aiRegenerating.title ? 0.5 : 1 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                    Nyt forslag
                  </button>
                </div>
              </div>
            </div>

            {/* Description comparison */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:INK2, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Beskrivelse</div>
              <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:10 }}>
                <div onClick={()=>setAiApply(a=>({...a,description:false}))} style={{ borderRadius:14, padding:'14px 16px', border:`2px solid ${!aiApply.description ? PRIMARY : PAPER2}`, background:!aiApply.description ? GREEN_TINT : PAPER, cursor:'pointer', transition:'all 0.15s', position:'relative' }}>
                  {!aiApply.description && <div style={{ position:'absolute', top:10, right:10, width:18, height:18, borderRadius:'50%', background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:800 }}>✓</div>}
                  <div style={{ fontSize:10, fontWeight:700, color:INK3, fontFamily:FONT, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Dit eget</div>
                  <div style={{ fontSize:13, color:INK2, fontFamily:FONT, lineHeight:1.6 }}>{form.description || <span style={{ fontStyle:'italic', color:INK3 }}>Ingen beskrivelse</span>}</div>
                </div>
                <div onClick={()=>setAiApply(a=>({...a,description:true}))} style={{ borderRadius:14, padding:'14px 16px', border:`2px solid ${aiApply.description ? '#7C3AED' : PAPER2}`, background:aiApply.description ? '#F5F0FF' : PAPER, cursor:'pointer', transition:'all 0.15s', position:'relative' }}>
                  {aiApply.description && <div style={{ position:'absolute', top:10, right:10, width:18, height:18, borderRadius:'50%', background:'#7C3AED', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:800 }}>✓</div>}
                  <div style={{ fontSize:10, fontWeight:700, color:'#7C3AED', fontFamily:FONT, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>✨ AI-forslag</div>
                  <div style={{ fontSize:13, color:INK2, fontFamily:FONT, lineHeight:1.6 }}>{aiRegenerating.description ? <span style={{ color:INK3, fontStyle:'italic' }}>Genererer nyt forslag…</span> : aiSuggestion.description}</div>
                  <button type="button" onClick={e=>{ e.stopPropagation(); handleRegenerate('description'); }} disabled={aiRegenerating.description} style={{ marginTop:10, display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:'#7C3AED', background:'rgba(124,58,237,0.08)', border:'none', borderRadius:99, padding:'4px 10px', cursor: aiRegenerating.description ? 'not-allowed' : 'pointer', fontFamily:FONT, opacity: aiRegenerating.description ? 0.5 : 1 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                    Nyt forslag
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setAiSuggestion(null)} style={{ flex:1, padding:'13px', borderRadius:99, background:PAPER2, color:INK2, border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Annuller
              </button>
              <button onClick={applyAiSuggestion} style={{ flex:2, padding:'13px', borderRadius:99, background:`linear-gradient(135deg, #7C3AED, ${PRIMARY})`, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:'pointer' }}>
                Anvend valgte →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
