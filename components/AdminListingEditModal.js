'use client';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, TYPE_CFG, CONDITIONS, AGE_GROUPS, FONT } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import BrandPicker from '@/components/BrandPicker';
import { Spinner } from '@/components/ui';

// Fuld redigerings-modal til admin — spejler opret/rediger-flowet, så admin
// kan redigere alt (inkl. billeder og forsendelse) på vegne af institutionen.
export default function AdminListingEditModal({ listing, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [existingImgs, setExistingImgs] = useState(listing.images || []);
  const [newFiles, setNewFiles] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const dragState = useRef({ dragging: null, lastOver: null });

  const [form, setForm] = useState({
    title: listing.title || '',
    type: listing.type || 'køb',
    price: listing.price ?? '',
    age_group: listing.age_group || '3-6 år',
    description: listing.description || '',
    condition: listing.condition || 'God',
    tags: listing.tags || [],
    min_bid: listing.min_bid || '',
    category: listing.category || '',
    subcategory: listing.subcategory || '',
    brand: listing.brand || '',
  });

  const [delivery, setDelivery] = useState({ shipping: !!listing.can_ship, weight_g: 1000 });

  function sizeToWeightG(size) {
    if (size == null) return 1000;
    const legacy = { small: 1000, medium: 5000, large: 15000, xlarge: 20000 };
    if (size in legacy) return legacy[size];
    const g = parseInt(size, 10);
    return isNaN(g) ? 1000 : g;
  }

  const WEIGHT_BANDS_UI = [
    { weight_g: 1000,  label: '0–1 kg' },
    { weight_g: 5000,  label: '1–5 kg' },
    { weight_g: 10000, label: '5–10 kg' },
    { weight_g: 15000, label: '10–15 kg' },
    { weight_g: 20000, label: '15–20 kg' },
  ];

  // Hent eksisterende forsendelses-indstillinger
  useEffect(() => {
    db.from('shipping_options').select('allow_shipping, shipping_size_category').eq('listing_id', listing.id).maybeSingle()
      .then(({ data: so }) => {
        if (so) setDelivery({ shipping: so.allow_shipping ?? !!listing.can_ship, weight_g: sizeToWeightG(so.shipping_size_category) });
      });
  }, [listing.id]);

  // Luk på Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => { newPreviews.forEach(p => URL.revokeObjectURL(p)); }, [newPreviews]);

  const totalImgs = existingImgs.length + newFiles.length;
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = [];
    for (const f of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) { setError(`"${f.name}" er ikke et understøttet format`); continue; }
      if (f.size > MAX_IMAGE_SIZE) { setError(`"${f.name}" er for stor. Maks 10 MB`); continue; }
      valid.push(f);
    }
    const remaining = 6 - totalImgs;
    const toAdd = valid.slice(0, remaining);
    setNewFiles(prev => [...prev, ...toAdd]);
    setNewPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  }

  function removeExisting(i) { setExistingImgs(prev => prev.filter((_, j) => j !== i)); }
  function removeNew(i) {
    URL.revokeObjectURL(newPreviews[i]);
    setNewFiles(f => f.filter((_, j) => j !== i));
    setNewPreviews(p => p.filter((_, j) => j !== i));
  }

  function shiftExisting(from, to) {
    if (from === to || from == null || to == null) return;
    setExistingImgs(prev => { const a = [...prev]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });
  }
  function onDragStart(e, i) { e.dataTransfer.effectAllowed = 'move'; dragState.current = { dragging: i, lastOver: null }; setDraggingIdx(i); }
  function onDragOver(e, i) {
    e.preventDefault();
    const from = dragState.current.dragging;
    if (from !== null && i !== from && i !== dragState.current.lastOver) {
      dragState.current.lastOver = i;
      shiftExisting(from, i);
      dragState.current.dragging = i;
      setDraggingIdx(i);
    }
  }
  function onDragEnd() { dragState.current = { dragging: null, lastOver: null }; setDraggingIdx(null); }

  async function handleSave() {
    if (!form.title.trim()) { setError('Titel mangler'); return; }
    if (form.type === 'køb' && !String(form.price).trim()) { setError('Angiv en pris for køb-opslag'); return; }
    if (!form.description.trim()) { setError('Tilføj en beskrivelse'); return; }
    setSaving(true);
    setError(null);

    const uploadedUrls = [];
    for (const file of newFiles) {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${listing.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: up, error: upErr } = await db.storage.from('listing-images').upload(path, file, { contentType: file.type });
      if (upErr) { setSaving(false); setError('Kunne ikke uploade billede: ' + upErr.message); return; }
      if (up) {
        const { data: { publicUrl } } = db.storage.from('listing-images').getPublicUrl(up.path);
        uploadedUrls.push(publicUrl);
      }
    }
    const allImages = [...existingImgs, ...uploadedUrls];

    const newPrice = form.type === 'køb' ? Number(form.price) || null : null;
    const oldPrice = listing.price || null;
    const storedOriginal = listing.original_price || null;
    let originalPrice;
    if (newPrice && oldPrice && newPrice < oldPrice) originalPrice = storedOriginal || oldPrice;
    else if (!newPrice || !storedOriginal || newPrice >= storedOriginal) originalPrice = null;
    else originalPrice = storedOriginal;

    const patch = {
      title: form.title,
      type: form.type,
      price: newPrice,
      age_group: form.age_group,
      description: form.description,
      condition: form.condition,
      tags: form.tags || [],
      min_bid: form.type === 'byd' && form.min_bid ? Number(form.min_bid) : null,
      category: form.category || null,
      subcategory: form.subcategory || null,
      brand: form.brand || null,
      images: allImages,
      can_ship: delivery.shipping || false,
      original_price: originalPrice,
    };

    const { error: updErr } = await db.from('listings').update(patch).eq('id', listing.id);
    if (updErr) { setSaving(false); setError('Noget gik galt: ' + updErr.message); return; }

    await db.from('shipping_options').upsert({
      listing_id: listing.id,
      allow_pickup: true,
      allow_shipping: delivery.shipping,
      allow_custom: false,
      shipping_size_category: delivery.shipping && delivery.weight_g ? String(delivery.weight_g) : null,
      shipping_included_in_price: false,
    }, { onConflict: 'listing_id' });

    setSaving(false);
    onSaved?.({ ...listing, ...patch });
  }

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${PAPER3}`, fontSize: 14, outline: 'none', fontFamily: FONT, background: '#fff', color: INK, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 7, fontFamily: FONT, color: INK2 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,31,23,0.55)', zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: PAPER, borderRadius: 20, boxShadow: '0 12px 48px rgba(0,0,0,0.3)', overflow: 'hidden', fontFamily: FONT, marginBottom: 32 }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.02em' }}>Rediger opslag</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{listing.institution_name || '—'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Handelsform */}
          <div>
            <label style={labelStyle}>Handelsform</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['køb', 'byd', 'byt'].map(t => (
                <button key={t} onClick={() => setForm({ ...form, type: t })} style={{ flex: 1, padding: '11px 8px', borderRadius: 12, background: form.type === t ? TYPE_CFG[t].bg : PAPER2, color: form.type === t ? TYPE_CFG[t].color : INK3, fontFamily: FONT, fontWeight: 700, fontSize: 13, border: form.type === t ? `2px solid ${TYPE_CFG[t].color}` : '2px solid transparent', cursor: 'pointer' }}>
                  {TYPE_CFG[t].icon} {TYPE_CFG[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Titel */}
          <div>
            <label style={labelStyle}>Titel</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          </div>

          {/* Pris / min bud */}
          {form.type === 'køb' && (
            <div>
              <label style={labelStyle}>Pris (kr.)</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} min="1" style={inputStyle} />
            </div>
          )}
          {form.type === 'byd' && (
            <div>
              <label style={labelStyle}>Mindste bud (kr.) <span style={{ fontWeight: 400, color: INK3 }}>(valgfri)</span></label>
              <input type="number" value={form.min_bid || ''} onChange={e => setForm({ ...form, min_bid: e.target.value })} min="1" style={inputStyle} />
            </div>
          )}

          {/* Aldersgruppe */}
          <div>
            <label style={labelStyle}>Aldersgruppe</label>
            <select value={form.age_group} onChange={e => setForm({ ...form, age_group: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
              {AGE_GROUPS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          {/* Kategori + Varemærke */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Kategori <span style={{ fontWeight: 400, color: INK3 }}>(valgfri)</span></label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: '' }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value=''>Vælg kategori…</option>
                {CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>)}
              </select>
            </div>
            {form.category && (() => {
              const catObj = CATEGORIES.find(c => c.key === form.category);
              if (!catObj?.sub?.length) return null;
              return (
                <div>
                  <label style={labelStyle}>Underkategori <span style={{ fontWeight: 400, color: INK3 }}>(valgfri)</span></label>
                  <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value=''>Vælg underkategori…</option>
                    {catObj.sub.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>
              );
            })()}
            <div>
              <label style={labelStyle}>Varemærke <span style={{ fontWeight: 400, color: INK3 }}>(valgfri)</span></label>
              <BrandPicker value={form.brand} onChange={v => setForm(f => ({ ...f, brand: v }))} />
            </div>
          </div>

          {/* Beskrivelse */}
          <div>
            <label style={labelStyle}>Beskrivelse</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }} />
          </div>

          {/* Stand */}
          <div>
            <label style={labelStyle}>Stand</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CONDITIONS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, condition: c })} style={{ padding: '9px 18px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: form.condition === c ? `2px solid ${PRIMARY}` : '2px solid transparent', background: form.condition === c ? GREEN_TINT : PAPER2, color: form.condition === c ? PRIMARY : INK3, fontFamily: FONT, cursor: 'pointer' }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Forsendelse */}
          <div>
            <label style={labelStyle}>Forsendelse</label>
            <div style={{ borderRadius: 14, border: `1.5px solid ${delivery.shipping ? '#2563EB' : PAPER3}`, background: delivery.shipping ? '#EFF6FF' : '#fff', overflow: 'hidden' }}>
              <button type="button" onClick={() => setDelivery(d => ({ ...d, shipping: !d.shipping }))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${delivery.shipping ? '#2563EB' : PAPER3}`, background: delivery.shipping ? '#2563EB' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {delivery.shipping && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: delivery.shipping ? '#2563EB' : INK }}>📦 Kan sendes med pakke</div>
              </button>
              {delivery.shipping && (
                <div style={{ padding: '0 16px 16px' }}>
                  <label style={{ ...labelStyle, fontSize: 12, marginBottom: 6 }}>Hvad vejer pakken ca.?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {WEIGHT_BANDS_UI.map(band => {
                      const sel = delivery.weight_g === band.weight_g;
                      return (
                        <button key={band.weight_g} type="button" onClick={() => setDelivery(d => ({ ...d, weight_g: band.weight_g }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${sel ? '#2563EB' : PAPER3}`, background: sel ? '#EFF6FF' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${sel ? '#2563EB' : PAPER3}`, background: sel ? '#2563EB' : 'transparent', flexShrink: 0 }} />
                          <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: sel ? '#2563EB' : INK }}>{band.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Billeder */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Billeder <span style={{ fontWeight: 400, color: INK3 }}>(op til 6)</span></label>
              {totalImgs > 0 && totalImgs < 6 && (
                <button type="button" onClick={() => fileRef.current?.click()} style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, background: GREEN_TINT, border: 'none', borderRadius: 99, padding: '5px 12px', cursor: 'pointer', fontFamily: FONT }}>+ Tilføj</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
            {totalImgs === 0 ? (
              <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${PAPER3}`, borderRadius: 16, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: PAPER2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 4, fontFamily: FONT }}>Klik for at uploade billeder</div>
                <div style={{ fontSize: 12, color: INK3, fontFamily: FONT }}>JPG, PNG eller WEBP · Maks 6 billeder</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {existingImgs.map((src, i) => (
                  <div key={`ex-${i}`} data-img-idx={i} draggable
                    onDragStart={e => onDragStart(e, i)} onDragOver={e => onDragOver(e, i)} onDrop={e => e.preventDefault()} onDragEnd={onDragEnd}
                    style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: i === 0 && newFiles.length === 0 ? `2px solid ${PRIMARY}` : '2px solid transparent', cursor: draggingIdx !== null ? 'grabbing' : 'grab', transform: draggingIdx === i ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s', userSelect: 'none' }}>
                    <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                    <button onClick={e => { e.stopPropagation(); removeExisting(i); }} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,34,28,0.7)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
                    {i === 0 && <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}><div style={{ background: PRIMARY, borderRadius: 6, padding: '2px 8px', fontSize: 9, color: '#fff', fontWeight: 700, fontFamily: FONT }}>Forside</div></div>}
                  </div>
                ))}
                {newPreviews.map((src, i) => (
                  <div key={`new-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '2px dashed #86efac' }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={e => { e.stopPropagation(); removeNew(i); }} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,34,28,0.7)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
                    <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}><div style={{ background: '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 9, color: '#fff', fontWeight: 700, fontFamily: FONT }}>Nyt</div></div>
                  </div>
                ))}
                {totalImgs < 6 && (
                  <div onClick={() => fileRef.current?.click()} style={{ aspectRatio: '1', borderRadius: 12, border: `2px dashed ${PAPER3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: PAPER2, fontSize: 28, color: INK3 }}>+</div>
                )}
              </div>
            )}
            {existingImgs.length > 1 && <div style={{ fontSize: 11, color: INK3, textAlign: 'center', marginTop: 6, fontFamily: FONT }}>Træk for at ændre rækkefølge · Det første er forsiden</div>}
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: 10, fontSize: 13, color: '#DC2626', fontFamily: FONT, fontWeight: 600 }}>⚠️ {error}</div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 99, background: PAPER2, color: INK2, border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Annuller</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 99, background: saving ? PAPER3 : PRIMARY, color: saving ? INK3 : '#fff', border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? <><Spinner /> Gemmer…</> : '✓ Gem ændringer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
