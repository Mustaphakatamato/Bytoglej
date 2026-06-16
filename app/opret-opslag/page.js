'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, CONDITIONS, AGE_GROUPS, URGENCY_OPTIONS, FONT } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import BrandPicker from '@/components/BrandPicker';
import { useWindowWidth } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';
import { authedFetch } from '@/lib/authed-fetch';

// Dansk kr-format: komma som decimaltegn, to decimaler
function fmtKr(n) {
  return `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;
}

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
  const { showToast, fetchListings, setInstitution: setGlobalInstitution } = useApp();
  const { institution: ctxInstitution, userId: ctxUserId, isAdminView: ctxIsAdmin } = useActiveUser();
  const ww = useWindowWidth();
  const isMobile = ww < 768;
  const fileRef = useRef(null);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [checkingImages, setCheckingImages] = useState(false);
  const scanRef = useRef(null);
  const søgesTextareaRef = useRef(null);
  const [søgesQuery, setSøgesQuery] = useState('');
  const [søgesFilling, setSøgesFilling] = useState(false);
  const [søgesFilled, setSøgesFilled] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiFilledFields, setAiFilledFields] = useState({ title: false, description: false });
  const [priceSuggestion, setPriceSuggestion] = useState(null); // { basis, comparable_count, suggested_min, suggested_max, suggested_price }
  const [aiScanData, setAiScanData] = useState(null); // AI-forslag gemt til log ved submit
  const [aiApply, setAiApply] = useState({ title: true, description: true });
  const [aiRegenerating, setAiRegenerating] = useState({ title: false, description: false });
  const [institution, setInstitution] = useState(ctxInstitution || null);
  const [imgFiles, setImgFiles] = useState([]);
  const [imgPreviews, setImgPreviews] = useState([]);
  const [imgError, setImgError] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const dragState = useRef({ dragging: null, lastOver: null });
  const [copiedFrom, setCopiedFrom] = useState(null);
  const [form, setForm] = useState({
    title:'', type:'køb', price:'', age_group:'3-6 år',
    description:'', condition:'God', emoji:'🧸', color:'#FFD166',
    tags:[], min_bid:'', category:'', subcategory:'', brand: null, urgency:'ingen', can_ship: false,
  });

  // Leveringsvalg
  // Afhentning er altid muligt (håndteres i kurven). Her vælger sælger kun om
  // der også tilbydes forsendelse, og i så fald størrelse + porto-håndtering.
  const [delivery, setDelivery] = useState({
    shipping: false, weight_g: 1000,
  });
  const [deliveryDefaultApplied, setDeliveryDefaultApplied] = useState(false);

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

  // Smart defaults for delivery based on category (weight_g in grams)
  const CATEGORY_DELIVERY = {
    'books':               { pickup:true, shipping:true,  weight_g: 1000  },
    'puzzles':             { pickup:true, shipping:true,  weight_g: 1000  },
    'board-games':         { pickup:true, shipping:true,  weight_g: 5000  },
    'plush-small':         { pickup:true, shipping:true,  weight_g: 1000  },
    'plush-large':         { pickup:true, shipping:true,  weight_g: 5000  },
    'wooden-toys':         { pickup:true, shipping:true,  weight_g: 5000  },
    'plastic-toys-small':  { pickup:true, shipping:true,  weight_g: 1000  },
    'plastic-toys-medium': { pickup:true, shipping:true,  weight_g: 5000  },
    'plastic-toys-large':  { pickup:true, shipping:false, weight_g: 10000 },
    'construction-toys':   { pickup:true, shipping:true,  weight_g: 5000  },
    'outdoor-toys':        { pickup:true, shipping:false                   },
    'ride-on-toys':        { pickup:true, shipping:false                   },
    'electronic-toys':     { pickup:true, shipping:true,  weight_g: 5000  },
    'children-furniture':  { pickup:true, shipping:false                   },
    'baby-equipment':      { pickup:true, shipping:true,  weight_g: 5000  },
    'musical-instruments': { pickup:true, shipping:true,  weight_g: 5000  },
    'sports-equipment':    { pickup:true, shipping:false                   },
    'costumes-roleplay':   { pickup:true, shipping:true,  weight_g: 1000  },
    'art-craft-supplies':  { pickup:true, shipping:true,  weight_g: 1000  },
    'other':               { pickup:true, shipping:false                   },
  };

  useEffect(() => {
    if (!form.category || deliveryDefaultApplied) return;
    const d = CATEGORY_DELIVERY[form.category];
    if (!d) return;
    setDelivery(prev => ({
      ...prev,
      shipping: d.shipping ?? prev.shipping,
      weight_g: d.weight_g ?? prev.weight_g,
    }));
    setDeliveryDefaultApplied(true);
  }, [form.category]);


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

  async function checkImageSafe(file) {
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await authedFetch('/api/scan-image', { method: 'POST', body: fd });
      const json = await res.json();
      return json.safe !== false;
    } catch { return true; }
  }

  // Billedvalidering: maks 10MB per billede, kun gængse billedformater
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Validér type og størrelse før vi går videre
    const validFiles = [];
    for (const f of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        showToast(`"${f.name}" er ikke et understøttet format — brug JPG, PNG, WEBP eller GIF`, 'error');
        continue;
      }
      if (f.size > MAX_IMAGE_SIZE) {
        showToast(`"${f.name}" er for stor — maks 10 MB per billede`, 'error');
        continue;
      }
      validFiles.push(f);
    }
    if (!validFiles.length) { e.target.value = ''; return; }

    const remaining = 6 - imgFiles.length;
    const candidates = validFiles.slice(0, remaining);
    setCheckingImages(true);
    const results = await Promise.all(candidates.map(f => checkImageSafe(f)));
    setCheckingImages(false);
    const safe = candidates.filter((_, i) => results[i]);
    const rejected = candidates.length - safe.length;
    if (rejected > 0) showToast(`${rejected} billede${rejected > 1 ? 'r' : ''} afvist — indeholder personer`, 'error');
    if (!safe.length) { e.target.value = ''; return; }
    const newPreviews = safe.map(f => URL.createObjectURL(f));
    setImgFiles(prev => [...prev, ...safe]);
    setImgPreviews(prev => [...prev, ...newPreviews]);
    setImgError(false);
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
      const res = await authedFetch('/api/improve-listing', {
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
      const res = await authedFetch('/api/improve-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description, type: form.type, condition: form.condition, age_group: form.age_group, tags: form.tags }),
      });
      const json = await res.json();
      if (!json.error) setAiSuggestion(prev => ({ ...prev, [field]: json[field] }));
    } catch {}
    setAiRegenerating(r => ({ ...r, [field]: false }));
  }

  function compressImage(file, maxPx = 800, quality = 0.72) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleScanToy(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setScanError(null);
    setScanning(true);
    try {
      const compressed = await compressImage(file);
      const safe = await checkImageSafe(compressed);
      if (!safe) { setScanError('Billedet afvist — indeholder personer. Upload et billede uden personer.'); setScanning(false); return; }
      const fd = new FormData();
      fd.append('image', compressed);
      const res = await authedFetch('/api/scan-toy', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.error) {
        setScanError(res.status === 422 ? json.error : 'Scan mislykkedes — prøv igen');
        setScanning(false);
        return;
      }
      setForm(f => ({
        ...f,
        title: json.title || f.title,
        category: json.category || f.category,
        condition: json.condition || f.condition,
        age_group: json.age_group || f.age_group,
        description: json.description || f.description,
        // Forudfyld pris med forslaget (kun for køb, og kun hvis feltet er tomt)
        price: (f.type === 'køb' && !f.price && json.price?.suggested_price) ? String(json.price.suggested_price) : f.price,
      }));
      setAiFilledFields({ title: !!json.title, description: !!json.description });
      setPriceSuggestion(json.price || null);
      setAiScanData({
        scan_type: 'scan-toy',
        model_used: 'meta-llama/llama-4-scout-17b-16e-instruct',
        ai_raw_response: json,
        ai_title: json.title || null,
        ai_description: json.description || null,
        ai_category: json.category || null,
        ai_condition: json.condition || null,
        ai_age_group: json.age_group || null,
        ai_price_min: json.price?.suggested_min || null,
        ai_price_max: json.price?.suggested_max || null,
        ai_price_suggested: json.price?.suggested_price || null,
        ai_price_basis: json.price?.basis || null,
        ai_price_comparable_count: json.price?.comparable_count ?? null,
      });
      const preview = URL.createObjectURL(file);
      setImgFiles(prev => prev.length < 6 ? [file, ...prev] : prev);
      setImgPreviews(prev => prev.length < 6 ? [preview, ...prev] : prev);
      setImgError(false);
      showToast('AI har udfyldt felterne — tjek og juster 🎉');
    } catch { setScanError('Scan mislykkedes — prøv igen'); }
    setScanning(false);
  }

  async function handleFillSøges() {
    if (!søgesQuery.trim()) return;
    setSøgesFilling(true);
    try {
      const res = await authedFetch('/api/fill-soges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: søgesQuery }),
      });
      const json = await res.json();
      if (json.error) { showToast('AI kunne ikke udfylde — prøv igen', 'error'); }
      else {
        setForm(f => ({
          ...f,
          title: json.title || f.title,
          description: json.description || f.description,
          category: json.category || f.category,
          age_group: json.age_group || f.age_group,
          condition: json.condition || f.condition,
        }));
        setAiFilledFields({ title: !!json.title, description: !!json.description });
        setAiScanData({
          scan_type: 'fill-soges',
          model_used: 'llama-3.1-8b-instant',
          input_query: søgesQuery,
          ai_raw_response: json,
          ai_title: json.title || null,
          ai_description: json.description || null,
          ai_category: json.category || null,
          ai_condition: json.condition || null,
          ai_age_group: json.age_group || null,
        });
        setSøgesFilled(true);
      }
    } catch { showToast('AI kunne ikke udfylde — prøv igen', 'error'); }
    setSøgesFilling(false);
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
    if (!form.category) { showToast('Vælg en kategori', 'error'); return; }
    const selectedCat = CATEGORIES.find(c => c.key === form.category);
    if (selectedCat?.sub?.length > 0 && !form.subcategory) { showToast('Vælg en underkategori', 'error'); return; }
    if (form.brand === null || form.brand === undefined) { showToast('Vælg et varemærke (eller "Intet varemærke")', 'error'); return; }
    if (delivery.shipping && !delivery.weight_g) { showToast('Vælg pakkevægt for forsendelse', 'error'); return; }
    setSaving(true);
    try {
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
      category: form.category || null, subcategory: form.subcategory || null, brand: form.brand || null,
      can_ship: delivery.shipping || false,
    };
    if (form.type==='byd' && form.min_bid) insertData.min_bid = Number(form.min_bid);
    const { data: listing, error } = await db.from('listings').insert(insertData).select().single();
    if (error) { console.error('Insert error:', error); showToast('Noget gik galt — prøv igen', 'error'); setSaving(false); return; }
    // urgency: update separately so it fails silently if column doesn't exist yet
    if (isSøges && listing?.id) {
      await db.from('listings').update({ urgency: form.urgency || 'ingen' }).eq('id', listing.id).then(() => {});
    }
    // Save delivery/shipping options
    if (listing?.id && !isSøges) {
      const { error: soError } = await db.from('shipping_options').insert({
        listing_id: listing.id,
        allow_pickup: true,      // afhentning er altid muligt — køber aftaler direkte
        allow_shipping: delivery.shipping,
        allow_custom: false,
        shipping_size_category: delivery.shipping && delivery.weight_g ? String(delivery.weight_g) : null,
        shipping_included_in_price: false,
      });
      // Fejl her må ikke være tavs — ellers mister opslaget sin vægt/forsendelse uden advarsel.
      if (soError) console.error('shipping_options insert error:', soError);
    }
    if (imgFiles.length > 0) {
      const urls = [];
      for (const file of imgFiles) {
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${listing.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: up } = await db.storage.from('listing-images').upload(path, file, { contentType: file.type });
        if (up) { const { data:{publicUrl} } = db.storage.from('listing-images').getPublicUrl(up.path); urls.push(publicUrl); }
      }
      if (urls.length) await db.from('listings').update({ images: urls }).eq('id', listing.id);
    }
    // Fire-and-forget: log AI-scan kun ved faktisk submit
    if (aiScanData) {
      const finalPrice = form.price ? Number(form.price) : null;
      const aiPrice = aiScanData.ai_price_suggested;
      const priceDelta = aiPrice && finalPrice ? finalPrice - aiPrice : null;
      const priceDeltaPct = aiPrice && priceDelta != null ? Math.round(priceDelta / aiPrice * 10000) / 100 : null;
      const normalize = s => (s || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
      const aiWords = new Set(normalize(aiScanData.ai_description));
      const finalWords = new Set(normalize(form.description));
      const overlap = aiWords.size ? [...aiWords].filter(w => finalWords.has(w)).length / aiWords.size : 0;
      db.from('ai_scan_logs').insert({
        ...aiScanData,
        user_id: user?.id,
        institution_name: inst?.name || null,
        listing_id: listing.id,
        final_title: form.title,
        final_description: form.description,
        final_category: form.category || null,
        final_condition: form.condition || null,
        final_age_group: form.age_group || null,
        final_price: finalPrice,
        used_title: (form.title.trim().toLowerCase() === (aiScanData.ai_title || '').trim().toLowerCase()),
        used_description: overlap >= 0.7,
        used_price: aiPrice && finalPrice ? Math.abs(priceDeltaPct) <= 15 : null,
        price_delta: priceDelta,
        price_delta_pct: priceDeltaPct,
        submitted: true,
        submitted_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});
    }
    // Fire-and-forget: saved-search email notifications
    authedFetch('/api/match-searches', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ listingId:listing.id, title:listing.title, type:listing.type, tags:listing.tags||[], city:listing.city, age_group:listing.age_group }),
    }).catch(()=>{});
    // Fire-and-forget: in-app auto-match notifications (both directions)
    authedFetch('/api/auto-match-soges', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        mode: isSøges ? 'new-søges' : 'new-listing',
        listingId: listing.id, category: listing.category,
        age_group: listing.age_group, condition: listing.condition,
        title: listing.title, institutionName: inst?.name, institutionId: inst?.id,
      }),
    }).catch(()=>{});
    fetchListings?.();
    showToast(isSøges ? 'Søges-opslag publiceret! Tjek mulige matches på dit dashboard 🔍' : 'Opslag publiceret! 🎉');
    router.push('/profil');
    } catch (e) {
      console.error('handleCreate error:', e);
      showToast('Noget gik galt — prøv igen', 'error');
    } finally {
      setSaving(false);
    }
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:14, outline:'none', fontFamily:FONT, background:'#fff', color:INK, boxSizing:'border-box' };
  const labelStyle = { display:'block', fontSize:13, fontWeight:700, marginBottom:7, fontFamily:FONT, color:INK2 };

  const deliveryValid = true;   // afhentning er altid muligt → levering er altid gyldig
  const step1Valid = form.title.trim() && (form.type !== 'køb' || form.price) && deliveryValid;
  const needsImage = form.type !== 'søges';
  const step2Valid = form.description.trim() && (!needsImage || imgFiles.length > 0);

  return (
    <div style={{ minHeight:'100vh', background:PAPER }} className="page-enter">


      {/* Header */}
      <div style={{ background:`linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, paddingTop:90, paddingBottom:36, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <span style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?140:240, color:'rgba(255,255,255,0.04)', lineHeight:1, letterSpacing:'-0.05em', userSelect:'none' }}>+</span>
        </div>
        <div style={{ maxWidth:900, margin:'0 auto', padding:'0 24px', position:'relative' }}>
          <button onClick={()=>router.push('/profil')} style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:99, padding:'7px 16px', color:'rgba(255,255,255,0.8)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:FONT, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
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
                <div style={{ display:'flex', alignItems:'center', gap:8, cursor: step>s.n?'pointer':'default' }} onClick={()=>{ if(step>s.n) { setStep(s.n); scrollTop(); } }}>
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

                <style>{`
                  @keyframes spin { to { transform: rotate(360deg); } }
                  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
                  input[type=number]::-webkit-inner-spin-button,
                  input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
                  input[type=number] { -moz-appearance:textfield; }
                `}</style>

                {/* AI assistant: søges text input OR image scan */}
                {form.type === 'søges' ? (
                  <div style={{ background:'#F5F0FF', borderRadius:16, padding:'18px 20px', border:'2px solid #DDD6FE' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>✨</div>
                      <div>
                        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:'#4C1D95' }}>AI udfylder oplysningerne</div>
                        <div style={{ fontSize:12, color:'#6D28D9', fontFamily:FONT }}>Beskriv med dine egne ord hvad I leder efter</div>
                      </div>
                    </div>
                    <textarea
                      ref={søgesTextareaRef}
                      value={søgesQuery}
                      onChange={e => {
                        setSøgesQuery(e.target.value);
                        setSøgesFilled(false);
                        const el = søgesTextareaRef.current;
                        if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                      }}
                      placeholder="Fx: Vi mangler et dukkekøkken til vores 3-5 årige. Gerne med tilbehør. Stand skal minimum være god."
                      rows={1}
                      style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1.5px solid #C4B5FD', fontSize:13, outline:'none', fontFamily:FONT, background:'#fff', color:INK, boxSizing:'border-box', resize:'none', lineHeight:1.55, overflow:'hidden', minHeight:72 }}
                    />
                    {søgesFilled ? (
                      <div style={{ marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:700, color:'#059669', fontFamily:FONT }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Felterne er udfyldt — tjek og juster nedenfor
                        </div>
                        <button type="button" onClick={() => { setSøgesFilled(false); handleFillSøges(); }}
                          style={{ fontSize:12, fontWeight:700, color:'#7C3AED', background:'rgba(124,58,237,0.1)', border:'none', borderRadius:99, padding:'5px 12px', cursor:'pointer', fontFamily:FONT }}>
                          Prøv igen
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={handleFillSøges} disabled={søgesFilling || !søgesQuery.trim()}
                        style={{ marginTop:10, width:'100%', padding:'11px', borderRadius:99, background: søgesFilling || !søgesQuery.trim() ? '#DDD6FE' : 'linear-gradient(135deg,#7C3AED,#4F46E5)', color: søgesFilling || !søgesQuery.trim() ? '#7C3AED' : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor: søgesFilling || !søgesQuery.trim() ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.15s' }}>
                        {søgesFilling ? (
                          <>
                            <svg style={{ animation:'spin 0.9s linear infinite' }} width="16" height="16" viewBox="0 0 40 40" fill="none">
                              <circle cx="20" cy="20" r="17" stroke="rgba(255,255,255,0.3)" strokeWidth="4"/>
                              <path d="M20 3 A17 17 0 0 1 37 20" stroke="#fff" strokeWidth="4" strokeLinecap="round"/>
                            </svg>
                            AI udfylder…
                          </>
                        ) : '✨ AI udfylder resten'}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <input ref={scanRef} type="file" accept="image/*" onChange={handleScanToy} style={{ display:'none' }} />
                    <div onClick={()=>!scanning && scanRef.current?.click()} style={{ border:`2px dashed ${scanning ? PRIMARY : PAPER3}`, borderRadius:16, padding:'18px 20px', textAlign:'center', cursor: scanning ? 'default' : 'pointer', background: scanning ? GREEN_TINT : PAPER, transition:'all 0.15s', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}
                      onMouseEnter={e=>{ if(!scanning) e.currentTarget.style.borderColor = PRIMARY; }}
                      onMouseLeave={e=>{ if(!scanning) e.currentTarget.style.borderColor = PAPER3; }}>
                      {scanning ? (
                        <>
                          <div style={{ width:40, height:40, position:'relative', flexShrink:0 }}>
                            <svg style={{ animation:'spin 0.9s linear infinite', position:'absolute', inset:0 }} width="40" height="40" viewBox="0 0 40 40" fill="none">
                              <circle cx="20" cy="20" r="17" stroke={PAPER3} strokeWidth="3"/>
                              <path d="M20 3 A17 17 0 0 1 37 20" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round"/>
                            </svg>
                            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🔍</div>
                          </div>
                          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:PRIMARY, animation:'pulse 1.4s ease-in-out infinite' }}>Analyserer billede…</div>
                          <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>AI udfylder felterne automatisk</div>
                        </>
                      ) : (
                        <>
                          <div style={{ width:40, height:40, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📷</div>
                          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK }}>Scan legetøj med AI</div>
                          <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>Tag et billede — AI udfylder titel, kategori, stand og beskrivelse automatisk</div>
                        </>
                      )}
                    </div>
                    {scanError && (
                      <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px' }}>
                        <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:'#B91C1C', marginBottom:4 }}>Billedet kunne ikke bruges</div>
                          <div style={{ fontFamily:FONT, fontSize:12, color:'#DC2626', lineHeight:1.5 }}>{scanError}</div>
                          <button onClick={() => { setScanError(null); scanRef.current?.click(); }} style={{ marginTop:8, background:'#B91C1C', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, fontFamily:FONT, cursor:'pointer' }}>
                            Prøv et andet billede
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1, height:1, background:PAPER3 }} />
                  <span style={{ fontSize:12, color:INK3, fontFamily:FONT, fontWeight:600 }}>{form.type === 'søges' ? 'eller udfyld manuelt' : 'eller udfyld manuelt'}</span>
                  <div style={{ flex:1, height:1, background:PAPER3 }} />
                </div>

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
                  <input value={form.title} onChange={e=>{ setForm({...form,title:e.target.value}); setAiFilledFields(f=>({...f,title:false})); }} placeholder="Fx: LEGO Duplo stor kasse, 120 klodser" style={inputStyle} />
                  {aiFilledFields.title && (
                    <div style={{ fontSize:11, color:'#7C3AED', fontFamily:FONT, marginTop:5, display:'flex', alignItems:'center', gap:4 }}>
                      ✨ AI-forslag — tjek og tilpas teksten efter behov
                    </div>
                  )}
                </div>

                {form.type === 'køb' && (
                  <div>
                    <label style={labelStyle}>Pris (kr.) <span style={{ color:'#e53e3e' }}>*</span></label>
                    <input type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Fx 250" min="1" style={{ ...inputStyle, border:`1.5px solid ${!form.price?'#FCA5A5':PAPER3}` }} />
                    {priceSuggestion?.suggested_min != null && (
                      <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6, fontFamily:FONT, fontSize:12, color:INK3 }}>
                        <span>✨</span>
                        <span>Foreslået: <strong style={{ color:INK }}>{priceSuggestion.suggested_min}–{priceSuggestion.suggested_max} kr.</strong></span>
                        <span style={{ color:INK3 }}>· {priceSuggestion.basis === 'median' ? `baseret på ${priceSuggestion.comparable_count} lignende varer` : 'AI-estimat'}</span>
                      </div>
                    )}
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

                <div>
                  <label style={labelStyle}>Aldersgruppe</label>
                  <select value={form.age_group} onChange={e=>setForm({...form,age_group:e.target.value})} style={{ ...inputStyle, cursor:'pointer' }}>
                    {AGE_GROUPS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>

                {form.type !== 'søges' && (
                  <div>
                    <label style={labelStyle}>Levering</label>
                    <div style={{ background:GREEN_TINT, border:`1px solid ${GREEN_SOFT}`, borderRadius:12, padding:'11px 14px', marginBottom:10, fontFamily:FONT, fontSize:13, color:INK2, lineHeight:1.5 }}>
                      📍 Køber kan <strong>hente selv hos jer</strong> — det aftaler I direkte. Vil du også tilbyde forsendelse, så slå det til nedenfor.
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

                      {/* Pakke (valgfri) */}
                      <div style={{ borderRadius:14, border:`1.5px solid ${delivery.shipping ? '#2563EB' : PAPER3}`, background: delivery.shipping ? '#EFF6FF' : '#fff', overflow:'hidden', transition:'all 0.15s' }}>
                        <button type="button" onClick={()=>setDelivery(d=>({...d, shipping:!d.shipping}))}
                          style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'13px 16px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                          <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${delivery.shipping ? '#2563EB' : PAPER3}`, background:delivery.shipping ? '#2563EB' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {delivery.shipping && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color: delivery.shipping ? '#2563EB' : INK }}>📦 Vi kan sende med pakke</div>
                            <div style={{ fontSize:12, color:INK3, marginTop:1 }}>PostNord, DAO eller GLS — porto betales af køber eller inkluderet</div>
                          </div>
                        </button>
                        {delivery.shipping && (
                          <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:12 }}>
                            <div>
                              <label style={{ ...labelStyle, fontSize:12, marginBottom:6 }}>Hvad vejer pakken ca.?</label>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                                {[
                                  { weight_g: 1000,  label: '0–1 kg',   examples: 'Lille bamse, børnebog, lille puslespil' },
                                  { weight_g: 5000,  label: '1–5 kg',   examples: 'Monopoly, LEGO Classic-sæt, løbecykel' },
                                  { weight_g: 10000, label: '5–10 kg',  examples: 'Stort DUPLO-sæt, legetøjskøkken (lille)' },
                                  { weight_g: 15000, label: '10–15 kg', examples: 'Træ-køkken, aktivitetsbord, stor DUPLO-kasse' },
                                  { weight_g: 20000, label: '15–20 kg', examples: 'Elektrisk elbil, mindre trampolin' },
                                ].map(band => {
                                  const sel = delivery.weight_g === band.weight_g;
                                  return (
                                    <button key={band.weight_g} type="button"
                                      onClick={() => setDelivery(d => ({ ...d, weight_g: band.weight_g }))}
                                      style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', borderRadius:10, border:`1.5px solid ${sel ? '#2563EB' : PAPER3}`, background: sel ? '#EFF6FF' : '#fff', cursor:'pointer', textAlign:'left', transition:'all 0.12s' }}>
                                      <div style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${sel ? '#2563EB' : PAPER3}`, background: sel ? '#2563EB' : 'transparent', flexShrink:0, marginTop:2 }} />
                                      <div>
                                        <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color: sel ? '#2563EB' : INK }}>{band.label}</div>
                                        <div style={{ fontFamily:FONT, fontSize:11, color:INK3, marginTop:2, lineHeight:1.4 }}>{band.examples}</div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div style={{ background:'#EFF6FF', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#1D4ED8', fontFamily:FONT, fontWeight:600 }}>
                              ℹ️ Prisen du har sat er ekskl. porto — køber betaler den billigste porto oveni ved checkout.
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {/* Category picker */}
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label style={labelStyle}>Kategori <span style={{ color:'#e53e3e' }}>*</span></label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: '' }))} style={{ ...inputStyle, cursor:'pointer' }}>
                      <option value=''>Vælg kategori…</option>
                      {CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>)}
                    </select>
                  </div>
                  {form.category && (() => {
                    const catObj = CATEGORIES.find(c => c.key === form.category);
                    if (!catObj?.sub?.length) return null;
                    return (
                      <div>
                        <label style={labelStyle}>Underkategori <span style={{ color:'#e53e3e' }}>*</span></label>
                        <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} style={{ ...inputStyle, cursor:'pointer' }}>
                          <option value=''>Vælg underkategori…</option>
                          {catObj.sub.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                        </select>
                      </div>
                    );
                  })()}
                  <div>
                    <label style={labelStyle}>Varemærke <span style={{ color:'#e53e3e' }}>*</span></label>
                    <BrandPicker value={form.brand} onChange={v => setForm(f => ({ ...f, brand: v }))} />
                  </div>
                </div>

                <button onClick={()=>{ if(step1Valid) { setStep(2); scrollTop(); } }} disabled={!step1Valid} style={{ width:'100%', padding:'14px', borderRadius:99, background:step1Valid?PRIMARY:PAPER3, color:step1Valid?'#fff':INK3, border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:step1Valid?'pointer':'not-allowed', marginTop:4, transition:'all 0.2s' }}>
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
                  <textarea value={form.description} onChange={e=>{ setForm({...form,description:e.target.value}); setAiFilledFields(f=>({...f,description:false})); }}
                    placeholder={form.type==='søges'
                      ? 'Beskriv hvad I leder efter, stand-krav, og hvad I evt. tilbyder i bytte…'
                      : 'Beskriv legetøjets stand, hvad der medfølger, mål, begrundelse for salg osv.'}
                    rows={4} style={{ ...inputStyle, resize:'vertical', minHeight:100 }} />
                  {aiFilledFields.description && (
                    <div style={{ fontSize:11, color:'#7C3AED', fontFamily:FONT, marginTop:5, display:'flex', alignItems:'center', gap:4 }}>
                      ✨ AI-forslag — tjek og tilpas teksten efter behov
                    </div>
                  )}
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

                {true && <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <label style={{ ...labelStyle, marginBottom:0 }}>
                    Billeder {needsImage ? <span style={{ color:'#e53e3e' }}>*</span> : <span style={{ fontWeight:400, color:INK3 }}>(valgfri)</span>}
                  </label>
                    {imgFiles.length > 0 && imgFiles.length < 6 && !checkingImages && (
                      <button type="button" onClick={()=>fileRef.current?.click()} style={{ fontSize:12, fontWeight:700, color:PRIMARY, background:GREEN_TINT, border:'none', borderRadius:99, padding:'5px 12px', cursor:'pointer', fontFamily:FONT }}>+ Tilføj</button>
                    )}
                    {checkingImages && (
                      <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:PRIMARY, fontFamily:FONT }}><Spinner /> AI tjekker…</span>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display:'none' }} disabled={checkingImages} />
                  {imgPreviews.length === 0 ? (
                    <div onClick={()=>!checkingImages && fileRef.current?.click()} style={{ border:`2px dashed ${checkingImages ? PRIMARY : PAPER3}`, borderRadius:16, padding:'36px 20px', textAlign:'center', cursor: checkingImages ? 'default' : 'pointer', background: checkingImages ? GREEN_TINT : PAPER, transition:'all 0.15s' }}
                      onMouseEnter={e=>{ if(!checkingImages) e.currentTarget.style.borderColor=PRIMARY; }}
                      onMouseLeave={e=>{ if(!checkingImages) e.currentTarget.style.borderColor=PAPER3; }}>
                      {checkingImages ? (
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                          <Spinner />
                          <div style={{ fontSize:13, fontWeight:700, color:PRIMARY, fontFamily:FONT }}>AI tjekker billeder…</div>
                          <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>Analyserer om billederne er sikre at bruge</div>
                        </div>
                      ) : (
                        <>
                          <div style={{ width:52, height:52, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          </div>
                          <div style={{ fontSize:14, fontWeight:700, color:INK, marginBottom:4, fontFamily:FONT }}>Klik for at uploade billeder</div>
                          <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>JPG, PNG eller WEBP · Maks 6 billeder</div>
                          <div style={{ fontSize:11, color:INK3, marginTop:4, fontFamily:FONT }}>Billeder med personer bliver automatisk afvist</div>
                        </>
                      )}
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
                        <div onClick={()=>!checkingImages && fileRef.current?.click()} style={{ aspectRatio:'1', borderRadius:12, border:`2px dashed ${checkingImages ? PRIMARY : PAPER3}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor: checkingImages ? 'default' : 'pointer', background: checkingImages ? GREEN_TINT : PAPER, gap:4 }}>
                          {checkingImages ? <Spinner /> : <span style={{ fontSize:28, color:INK3 }}>+</span>}
                        </div>
                      )}
                    </div>
                  )}
                  {imgPreviews.length > 1 && <div style={{ fontSize:11, color:INK3, textAlign:'center', marginTop:6, fontFamily:FONT }}>Hold og træk billeder for at ændre rækkefølge · Det første er forsiden</div>}
                  {imgError && needsImage && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px', marginTop:8 }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
                      <span style={{ fontFamily:FONT, fontSize:13, fontWeight:600, color:'#B91C1C' }}>Du skal uploade mindst ét billede for at oprette et opslag.</span>
                    </div>
                  )}
                </div>}

                <div style={{ display:'flex', gap:10, marginTop:4 }}>
                  <button onClick={()=>{ setStep(1); scrollTop(); }} style={{ flex:1, padding:'13px', borderRadius:99, background:PAPER2, color:INK2, border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    ← Tilbage
                  </button>
                  <button
                    onClick={() => {
                      if (needsImage && imgFiles.length === 0) { setImgError(true); return; }
                      handleCreate();
                    }}
                    disabled={saving || !form.description.trim()}
                    style={{ flex:2, padding:'13px', borderRadius:99, background: saving || !form.description.trim() ? PAPER3 : PRIMARY, color: saving || !form.description.trim() ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:15, cursor: saving || !form.description.trim() ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s' }}>
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
