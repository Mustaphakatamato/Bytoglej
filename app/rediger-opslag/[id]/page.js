'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, CONDITIONS, AGE_GROUPS } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";

export default function RedigerOpslagPage() {
  const router = useRouter();
  const { id } = useParams();
  const { showToast, fetchListings } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 768;
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [listing, setListing] = useState(null);

  // Existing uploaded images (URLs already in storage)
  const [existingImgs, setExistingImgs] = useState([]);
  // New local files to upload
  const [newFiles, setNewFiles] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);

  const [draggingIdx, setDraggingIdx] = useState(null);
  const dragState = useRef({ dragging: null, lastOver: null });

  const [form, setForm] = useState({
    title: '', type: 'køb', price: '', age_group: '3-6 år',
    description: '', condition: 'God', emoji: '🧸', color: '#FFD166',
    tags: [], min_bid: '', category: '', subcategory: '',
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: l } = await db.from('listings').select('*').eq('id', id).single();
      if (!l) { showToast('Opslag ikke fundet', 'error'); router.push('/profil'); return; }
      if (l.user_id !== user.id) {
        // Check institution member
        const { data: mem } = await db.from('institution_members').select('institutions(name)').eq('email', user.email).maybeSingle();
        const instName = mem?.institutions?.name;
        if (l.institution_name !== instName) { showToast('Ingen adgang', 'error'); router.push('/profil'); return; }
      }
      setListing(l);
      setExistingImgs(l.images || []);
      setForm({
        title: l.title || '',
        type: l.type || 'køb',
        price: l.price || '',
        age_group: l.age_group || '3-6 år',
        description: l.description || '',
        condition: l.condition || 'God',
        emoji: l.emoji || '🧸',
        color: l.color || '#FFD166',
        tags: l.tags || [],
        min_bid: l.min_bid || '',
        category: l.category || '',
        subcategory: l.subcategory || '',
      });
      setLoading(false);
    }
    load();
  }, [id]);

  // Combine existing + new for total count check
  const totalImgs = existingImgs.length + newFiles.length;

  function removeExisting(i) {
    setExistingImgs(prev => prev.filter((_, j) => j !== i));
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = 6 - totalImgs;
    const toAdd = files.slice(0, remaining);
    const previews = toAdd.map(f => URL.createObjectURL(f));
    setNewFiles(prev => [...prev, ...toAdd]);
    setNewPreviews(prev => [...prev, ...previews]);
    e.target.value = '';
  }

  function removeNew(i) {
    URL.revokeObjectURL(newPreviews[i]);
    setNewFiles(f => f.filter((_, j) => j !== i));
    setNewPreviews(p => p.filter((_, j) => j !== i));
  }

  // Drag/drop for existing images
  function shiftExisting(from, to) {
    if (from === to || from === null || to === null) return;
    setExistingImgs(prev => { const a = [...prev]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });
  }

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
        shiftExisting(from, to);
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

  function onDragStart(e, i) { e.dataTransfer.effectAllowed = 'move'; dragState.current = { dragging: i, lastOver: null }; setDraggingIdx(i); }
  function onDragOver(e, i) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const from = dragState.current.dragging;
    if (from !== null && i !== from && i !== dragState.current.lastOver) {
      dragState.current.lastOver = i;
      shiftExisting(from, i);
      dragState.current.dragging = i;
      setDraggingIdx(i);
    }
  }
  function onDrop(e) { e.preventDefault(); }
  function onDragEnd() { dragState.current = { dragging: null, lastOver: null }; setDraggingIdx(null); }

  async function handleSave() {
    if (!form.title.trim()) return;
    if (form.type === 'køb' && !String(form.price).trim()) { showToast('Angiv en pris for køb-opslag', 'error'); return; }
    if (!form.description.trim()) { showToast('Tilføj en beskrivelse', 'error'); return; }
    setSaving(true);

    // Upload any new images
    const uploadedUrls = [];
    for (const file of newFiles) {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: up } = await db.storage.from('listing-images').upload(path, file, { contentType: file.type });
      if (up) {
        const { data: { publicUrl } } = db.storage.from('listing-images').getPublicUrl(up.path);
        uploadedUrls.push(publicUrl);
      }
    }

    const allImages = [...existingImgs, ...uploadedUrls];

    const newPrice = form.type === 'køb' ? Number(form.price) || null : null;
    const oldPrice = listing?.price || null;
    const storedOriginal = listing?.original_price || null;
    let originalPrice;
    if (newPrice && oldPrice && newPrice < oldPrice) {
      // Price reduced — store the previous price as original (only if not already discounted)
      originalPrice = storedOriginal || oldPrice;
    } else if (!newPrice || !storedOriginal || newPrice >= storedOriginal) {
      // Price raised back or cleared — remove discount indicator
      originalPrice = null;
    } else {
      originalPrice = storedOriginal;
    }

    const { error } = await db.from('listings').update({
      title: form.title,
      type: form.type,
      price: newPrice,
      age_group: form.age_group,
      description: form.description,
      condition: form.condition,
      emoji: form.emoji,
      color: form.color,
      tags: form.tags || [],
      min_bid: form.type === 'byd' && form.min_bid ? Number(form.min_bid) : null,
      category: form.category || null,
      subcategory: form.subcategory || null,
      images: allImages,
    }).eq('id', id);

    setSaving(false);
    if (error) { showToast('Noget gik galt — prøv igen', 'error'); return; }

    // Update original_price separately — fails silently if column doesn't exist yet
    db.from('listings').update({ original_price: originalPrice }).eq('id', id).then(() => {});
    fetchListings?.();
    showToast('Opslag opdateret ✓');
    router.push('/profil');
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${PAPER3}`, fontSize: 14, outline: 'none', fontFamily: FONT, background: '#fff', color: INK, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 7, fontFamily: FONT, color: INK2 };
  const step1Valid = form.title.trim() && (form.type !== 'køb' || form.price);
  const step2Valid = form.description.trim();

  if (loading) return (
    <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: PAPER }} className="page-enter">

      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, paddingTop: 90, paddingBottom: 36, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 140 : 240, color: 'rgba(255,255,255,0.04)', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>✎</span>
        </div>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          <button onClick={() => router.push('/profil')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 99, padding: '7px 16px', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Tilbage til dashboard
          </button>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 36, color: '#fff', letterSpacing: '-0.04em', marginBottom: 8, lineHeight: 1.1 }}>Rediger opslag</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, margin: 0 }}>{listing?.title}</p>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 28, maxWidth: 320 }}>
            {[{ n: 1, label: 'Basisinfo' }, { n: 2, label: 'Detaljer & billeder' }].map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 1 ? 0 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: step > s.n ? 'pointer' : 'default' }} onClick={() => { if (step > s.n) { setStep(s.n); scrollTop(); } }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= s.n ? '#fff' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 13, color: step >= s.n ? PRIMARY : 'rgba(255,255,255,0.5)', flexShrink: 0, transition: 'all 0.2s' }}>{step > s.n ? '✓' : s.n}</div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: step >= s.n ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', fontFamily: FONT, whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
                {i < 1 && <div style={{ flex: 1, height: 2, background: step > 1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)', margin: '0 12px', minWidth: 24, transition: 'background 0.3s' }} />}
              </div>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 1440 48" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', display: 'block' }} preserveAspectRatio="none">
          <path d="M0,24 C360,48 1080,0 1440,24 L1440,48 L0,48 Z" fill={PAPER} />
        </svg>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '28px 16px 80px' : '40px 24px 80px' }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: isMobile ? '24px 20px' : '36px 36px', boxShadow: '0 2px 16px rgba(22,34,28,0.07)', border: `1px solid ${PAPER2}` }}>

          {/* Step 1: Basic info */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Handelsform</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['køb', 'byd', 'byt'].map(t => (
                    <button key={t} onClick={() => setForm({ ...form, type: t })} style={{ flex: 1, padding: '12px 8px', borderRadius: 12, background: form.type === t ? TYPE_CFG[t].bg : PAPER2, color: form.type === t ? TYPE_CFG[t].color : INK3, fontFamily: FONT, fontWeight: 700, fontSize: 13, border: form.type === t ? `2px solid ${TYPE_CFG[t].color}` : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                      {TYPE_CFG[t].icon} {TYPE_CFG[t].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Titel <span style={{ color: '#e53e3e' }}>*</span></label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Fx: LEGO Duplo stor kasse" style={inputStyle} />
              </div>

              {form.type === 'køb' && (
                <div>
                  <label style={labelStyle}>Pris (kr.) <span style={{ color: '#e53e3e' }}>*</span></label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Fx 250" min="1" style={{ ...inputStyle, border: `1.5px solid ${!form.price ? '#FCA5A5' : PAPER3}` }} />
                </div>
              )}
              {form.type === 'byd' && (
                <div>
                  <label style={labelStyle}>Mindste bud (kr.) <span style={{ fontWeight: 400, color: INK3 }}>— valgfri</span></label>
                  <input type="number" value={form.min_bid || ''} onChange={e => setForm({ ...form, min_bid: e.target.value })} placeholder="Lad stå tom for intet minimum" min="1" style={inputStyle} />
                </div>
              )}

              <div>
                <label style={labelStyle}>Aldersgruppe</label>
                <select value={form.age_group} onChange={e => setForm({ ...form, age_group: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {AGE_GROUPS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Kategori <span style={{ fontWeight: 400, color: INK3 }}>(valgfri)</span></label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: form.category ? 10 : 0 }}>
                  {CATEGORIES.map(cat => {
                    const sel = form.category === cat.key;
                    return (
                      <button key={cat.key} type="button"
                        onClick={() => setForm(f => ({ ...f, category: sel ? '' : cat.key, subcategory: '' }))}
                        style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, border: sel ? `2px solid ${PRIMARY}` : '2px solid transparent', background: sel ? GREEN_TINT : PAPER2, color: sel ? PRIMARY : INK3, cursor: 'pointer', fontFamily: FONT, transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>{cat.emoji}</span><span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
                {form.category && (() => {
                  const catObj = CATEGORIES.find(c => c.key === form.category);
                  if (!catObj) return null;
                  return (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {catObj.sub.map(sub => {
                        const selSub = form.subcategory === sub;
                        return (
                          <button key={sub} type="button"
                            onClick={() => setForm(f => ({ ...f, subcategory: selSub ? '' : sub }))}
                            style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, border: selSub ? `2px solid ${PRIMARY}` : `1.5px solid ${PAPER3}`, background: selSub ? GREEN_TINT : PAPER2, color: selSub ? PRIMARY : INK3, cursor: 'pointer', fontFamily: FONT }}>
                            {sub}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <button onClick={() => { if (step1Valid) { setStep(2); scrollTop(); } }} disabled={!step1Valid} style={{ width: '100%', padding: '14px', borderRadius: 99, background: step1Valid ? PRIMARY : PAPER3, color: step1Valid ? '#fff' : INK3, border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: step1Valid ? 'pointer' : 'not-allowed', marginTop: 4, transition: 'all 0.2s' }}>
                Næste: Detaljer & billeder →
              </button>
            </div>
          )}

          {/* Step 2: Details + images */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Beskrivelse <span style={{ color: '#e53e3e' }}>*</span></label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }} />
              </div>

              <div>
                <label style={labelStyle}>Stand</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CONDITIONS.map(c => (
                    <button key={c} onClick={() => setForm({ ...form, condition: c })} style={{ padding: '9px 18px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: form.condition === c ? `2px solid ${PRIMARY}` : '2px solid transparent', background: form.condition === c ? GREEN_TINT : PAPER2, color: form.condition === c ? PRIMARY : INK3, fontFamily: FONT, cursor: 'pointer', transition: 'all 0.12s' }}>{c}</button>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Billeder <span style={{ fontWeight: 400, color: INK3 }}>(op til 6)</span></label>
                  {totalImgs > 0 && totalImgs < 6 && (
                    <button type="button" onClick={() => fileRef.current?.click()} style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, background: GREEN_TINT, border: 'none', borderRadius: 99, padding: '5px 12px', cursor: 'pointer', fontFamily: FONT }}>+ Tilføj</button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

                {totalImgs === 0 ? (
                  <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${PAPER3}`, borderRadius: 16, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: PAPER }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = PRIMARY}
                    onMouseLeave={e => e.currentTarget.style.borderColor = PAPER3}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: GREEN_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 4, fontFamily: FONT }}>Klik for at uploade billeder</div>
                    <div style={{ fontSize: 12, color: INK3, fontFamily: FONT }}>JPG, PNG eller WEBP · Maks 6 billeder</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {/* Existing images (draggable) */}
                    {existingImgs.map((src, i) => (
                      <div key={`ex-${i}`} data-img-idx={i} draggable
                        onDragStart={e => onDragStart(e, i)} onDragOver={e => onDragOver(e, i)} onDrop={onDrop} onDragEnd={onDragEnd}
                        onTouchStart={e => { e.preventDefault(); startTouchDrag(i, e); }}
                        onContextMenu={e => e.preventDefault()}
                        style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: i === 0 && newFiles.length === 0 ? `2px solid ${PRIMARY}` : '2px solid transparent', cursor: draggingIdx !== null ? 'grabbing' : 'grab', transform: draggingIdx === i ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s', touchAction: 'none', userSelect: 'none' }}>
                        <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                        <button onClick={e => { e.stopPropagation(); removeExisting(i); }} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,34,28,0.7)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'auto' }}>✕</button>
                        {i === 0 && <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}><div style={{ background: PRIMARY, borderRadius: 6, padding: '2px 8px', fontSize: 9, color: '#fff', fontWeight: 700, fontFamily: FONT }}>Forside</div></div>}
                      </div>
                    ))}
                    {/* New images (local previews) */}
                    {newPreviews.map((src, i) => (
                      <div key={`new-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '2px dashed #86efac' }}>
                        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={e => { e.stopPropagation(); removeNew(i); }} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,34,28,0.7)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}><div style={{ background: '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 9, color: '#fff', fontWeight: 700, fontFamily: FONT }}>Nyt</div></div>
                      </div>
                    ))}
                    {totalImgs < 6 && (
                      <div onClick={() => fileRef.current?.click()} style={{ aspectRatio: '1', borderRadius: 12, border: `2px dashed ${PAPER3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: PAPER, fontSize: 28, color: INK3 }}>+</div>
                    )}
                  </div>
                )}
                {existingImgs.length > 1 && <div style={{ fontSize: 11, color: INK3, textAlign: 'center', marginTop: 6, fontFamily: FONT }}>Hold og træk for at ændre rækkefølge · Det første er forsiden</div>}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => { setStep(1); scrollTop(); }} style={{ flex: 1, padding: '13px', borderRadius: 99, background: PAPER2, color: INK2, border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  ← Tilbage
                </button>
                <button onClick={handleSave} disabled={saving || !step2Valid} style={{ flex: 2, padding: '13px', borderRadius: 99, background: saving || !step2Valid ? PAPER3 : PRIMARY, color: saving || !step2Valid ? INK3 : '#fff', border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: saving || !step2Valid ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                  {saving ? <><Spinner /> Gemmer…</> : '✓ Gem ændringer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
