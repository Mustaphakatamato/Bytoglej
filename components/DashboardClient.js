'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, CONDITIONS, AGE_GROUPS, LISTING_TAGS } from '@/lib/constants';
import { useWindowWidth, geocodeAddress, relTime } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Badge, Btn, Spinner, Modal } from '@/components/ui';

const FONT = "'Sora', sans-serif";

const SCAN_MSGS = [
  { icon:'🔍', text:'Scanner billedet for personer…' },
  { icon:'🛡️', text:'Beskytter børns privatliv…' },
  { icon:'🤖', text:'AI-model analyserer pixels…' },
  { icon:'🔬', text:'Tjekker ansigter og silhuetter…' },
  { icon:'✨', text:'Næsten der…' },
];

function ScanningLoader() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(i => (i + 1) % SCAN_MSGS.length); setFade(true); }, 300);
    }, 1800);
    return () => clearInterval(iv);
  }, []);
  const msg = SCAN_MSGS[idx];
  return (
    <div style={{ border:`2px dashed ${GREEN_SOFT}`, borderRadius:14, padding:'32px 20px', textAlign:'center', background:GREEN_TINT }}>
      <div style={{ fontSize:38, marginBottom:10, transition:'opacity 0.3s', opacity:fade?1:0 }}>{msg.icon}</div>
      <div style={{ fontSize:14, fontWeight:700, color:PRIMARY, marginBottom:6, transition:'opacity 0.3s', opacity:fade?1:0, fontFamily:FONT }}>{msg.text}</div>
      <div style={{ margin:'12px auto 0', width:'80%', height:4, background:PAPER3, borderRadius:99, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:'40%', background:PRIMARY, borderRadius:99, animation:'scanBar 1.4s ease-in-out infinite' }} />
      </div>
      <div style={{ fontSize:11, color:INK3, marginTop:10, fontFamily:FONT }}>Dette tager typisk 2–5 sekunder</div>
    </div>
  );
}

export default function DashboardClient() {
  const router = useRouter();
  const {
    listings: allListings,
    fetchListings: onListingCreated,
    showToast,
    favs,
    toggleFav,
    setActiveListing,
    unreadTotal,
    institution: ctxAppInstitution,
    setInstitution: setAppInstitution,
    adminInst,
    setAdminInst,
    effectiveInstitution,
  } = useApp();
  const { userId: ctxUserId, institution: ctxInstitution, isAdminView: ctxIsAdmin, adminInstName, realUserId: ctxRealUserId } = useActiveUser();

  const instProp = effectiveInstitution;

  const [newOpen,    setNewOpen]    = useState(false);
  const [step,       setStep]       = useState(1);
  const [saving,     setSaving]     = useState(false);
  const [imgFiles,   setImgFiles]   = useState([]);
  const [imgPreviews,setImgPreviews]= useState([]);
  const [tipsOpen,   setTipsOpen]   = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [myListings, setMyListings] = useState([]);
  const [institution, setInstitution] = useState(instProp || null);
  const [instLoading, setInstLoading] = useState(true);
  const [authUserId,  setAuthUserId]  = useState(null);
  const [form, setForm] = useState({ title:'', type:'køb', price:'', age_group:'3-6 år', description:'', condition:'God', emoji:'🧸', color:'#FFD166', tags:[] });
  const [editListing, setEditListing] = useState(null);
  const [editForm,    setEditForm]    = useState(null);
  const [editSaving,  setEditSaving]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileRef = useRef(null);
  const logoRef = useRef(null);
  const listingsRef = useRef(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const [tradesOpen, setTradesOpen] = useState(false);
  const [trades, setTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [actLoading, setActLoading] = useState(false);

  const [incomingConvs, setIncomingConvs] = useState([]);

  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);

  const isAdmin = !!institution && !institution._memberRole;

  function onInstitutionChange(updated) {
    if (adminInst) { setAdminInst(updated); }
    else { setAppInstitution(updated); }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setInstLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user || cancelled) { setInstLoading(false); return; }
      setAuthUserId(user.id);

      let inst = null;
      if (ctxIsAdmin && instProp) {
        inst = instProp;
      } else {
        const { data: ownInst } = await db.from('institutions').select('*').ilike('email', user.email).maybeSingle();
        if (ownInst) { inst = ownInst; }
        else {
          const { data: mem } = await db.from('institution_members').select('role,institutions(*)').eq('email', user.email).maybeSingle();
          if (mem?.institutions) inst = { ...mem.institutions, _memberRole: mem.role };
        }
        if (!cancelled && inst) setInstitution(inst);
      }

      if (inst && inst.address && !inst.latitude) {
        geocodeAddress(inst.address, inst.zipcode, inst.city).then(coords => {
          if (coords) {
            db.from('institutions').update({ latitude: coords.lat, longitude: coords.lon }).eq('email', inst.email);
            if (!cancelled) setInstitution(prev => prev ? { ...prev, latitude: coords.lat, longitude: coords.lon } : prev);
          }
        });
      }

      await fetchMyListings(ctxIsAdmin ? null : user.id, inst?.name);

      let incoming;
      const instId = inst?.id;
      const orParts = [];
      if (instId) orParts.push(`owner_institution_id.eq.${instId}`, `initiator_institution_id.eq.${instId}`);
      if (!ctxIsAdmin) orParts.push(`owner_id.eq.${user.id}`, `initiator_id.eq.${user.id}`);
      if (inst?.name) orParts.push(`owner_name.eq.${inst.name}`, `initiator_name.eq.${inst.name}`);
      if (orParts.length) {
        const { data: inc } = await db.from('conversations')
          .select('*').or(orParts.join(','))
          .order('last_message_at', { ascending: false });
        incoming = inc;
      }
      if (!cancelled && incoming) setIncomingConvs(incoming);
      if (!cancelled) setInstLoading(false);
    }
    boot();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ctxIsAdmin) { fetchMyListings(null, instProp?.name || institution?.name); }
    else if (authUserId) { fetchMyListings(authUserId, institution?.name); }
  }, [allListings]);

  async function fetchMyListings(userId, instName) {
    let q = db.from('listings').select('*').or('is_active.eq.true,is_sold.eq.true').order('created_at', { ascending: false });
    if (userId && instName) { q = q.or(`user_id.eq.${userId},institution_name.eq.${instName}`); }
    else if (userId) { q = q.eq('user_id', userId); }
    else if (instName) { q = q.eq('institution_name', instName); }
    else { return; }
    const { data } = await q;
    if (data) setMyListings(data);
  }

  function openEdit(l) {
    setEditForm({ title:l.title, type:l.type, price:l.price||'', age_group:l.age_group, description:l.description||'', condition:l.condition||'God', emoji:l.emoji||'🧸', color:l.color||'#FFD166', tags:l.tags||[] });
    setEditListing(l);
  }

  async function handleUpdate() {
    if (!editForm.title.trim()) return;
    if (editForm.type === 'køb' && !String(editForm.price).trim()) { showToast('Angiv en pris for køb-opslag', 'error'); return; }
    setEditSaving(true);
    const { error } = await db.from('listings').update({
      title: editForm.title, type: editForm.type,
      price: editForm.type==='køb' ? Number(editForm.price)||null : null,
      age_group: editForm.age_group, description: editForm.description,
      condition: editForm.condition, city: institution?.city || editListing?.city || '',
      emoji: editForm.emoji, color: editForm.color, tags: editForm.tags || [],
    }).eq('id', editListing.id);
    setEditSaving(false);
    if (error) { showToast('Noget gik galt', 'error'); return; }
    setEditListing(null); setEditForm(null);
    showToast('Opslag opdateret ✓');
    fetchMyListings(ctxIsAdmin ? null : authUserId, institution?.name);
    onListingCreated();
  }

  async function handleDelete(id) {
    const { error } = await db.from('listings').update({ is_active: false }).eq('id', id);
    setConfirmDelete(null);
    if (error) { showToast('Noget gik galt', 'error'); return; }
    showToast('Opslag slettet');
    fetchMyListings(ctxIsAdmin ? null : authUserId, institution?.name);
    onListingCreated();
  }

  const cocoModelRef = useRef(null);
  const cocoLoadingRef = useRef(null);
  async function getCocoModel() {
    if (cocoModelRef.current) return cocoModelRef.current;
    if (!cocoLoadingRef.current) cocoLoadingRef.current = window.cocoSsd.load();
    cocoModelRef.current = await cocoLoadingRef.current;
    return cocoModelRef.current;
  }
  useEffect(() => { getCocoModel(); }, []);

  async function detectPerson(file) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = async () => {
        try {
          const model = await getCocoModel();
          const predictions = await model.detect(img);
          const hasPerson = predictions.some(p => p.class === 'person' && p.score > 0.4);
          resolve(hasPerson);
        } catch { resolve(false); }
        finally { URL.revokeObjectURL(img.src); }
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const toAdd = files.slice(0, 6 - imgFiles.length);
    e.target.value = '';
    if (!toAdd.length) return;
    setAiAnalyzing(true);
    const safeFiles = [], safePreviews = [];
    for (const file of toAdd) {
      const hasPerson = await detectPerson(file);
      if (hasPerson) { showToast('Billede afvist: personer må ikke være synlige på billederne', 'error'); }
      else { safeFiles.push(file); safePreviews.push(URL.createObjectURL(file)); }
    }
    setImgFiles(f => [...f, ...safeFiles]);
    setImgPreviews(p => [...p, ...safePreviews]);
    setAiAnalyzing(false);
  }

  function removeImg(i) {
    URL.revokeObjectURL(imgPreviews[i]);
    setImgFiles(f=>f.filter((_,j)=>j!==i));
    setImgPreviews(p=>p.filter((_,j)=>j!==i));
  }

  function resetModal() {
    imgPreviews.forEach(URL.revokeObjectURL);
    setImgFiles([]); setImgPreviews([]); setTipsOpen(false); setStep(1);
    setForm({ title:'', type:'køb', price:'', age_group:'3-6 år', description:'', condition:'God', emoji:'🧸', color:'#FFD166', tags:[], min_bid:'' });
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    if (form.type === 'køb' && !String(form.price).trim()) { showToast('Angiv en pris for køb-opslag', 'error'); return; }
    setSaving(true);
    const { data: { user } } = await db.auth.getUser();
    let inst = institution;
    if (!inst && user) {
      const { data } = await db.from('institutions').select('*').eq('email', user.email).maybeSingle();
      if (data) { inst = data; setInstitution(data); }
    }
    const insertData = {
      title: form.title, type: form.type,
      price: form.type==='køb' ? Number(form.price)||null : null,
      age_group: form.age_group, description: form.description,
      condition: form.condition, city: inst?.city || institution?.city || '',
      institution_name: inst?.name || 'Min institution',
      user_id: user?.id || null,
      emoji: form.emoji, color: form.color,
      tags: form.tags || [], images: [], bid_count: 0, is_active: true,
    };
    if (form.type==='byd' && form.min_bid) insertData.min_bid = Number(form.min_bid);
    const { data: listing, error } = await db.from('listings').insert(insertData).select().single();
    if (error) { console.error('Listing insert error:', error); showToast('Noget gik galt — prøv igen', 'error'); setSaving(false); return; }
    if (imgFiles.length > 0) {
      const urls = [];
      for (const file of imgFiles) {
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${listing.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: up } = await db.storage.from('listing-images').upload(path, file, { contentType: file.type });
        if (up) { const { data:{publicUrl} } = db.storage.from('listing-images').getPublicUrl(up.path); urls.push(publicUrl); }
      }
      if (urls.length > 0) await db.from('listings').update({ images: urls }).eq('id', listing.id);
    }
    setSaving(false); setNewOpen(false); resetModal();
    showToast('Opslag publiceret!');
    onListingCreated();
    fetchMyListings(ctxIsAdmin ? null : (user?.id || authUserId), inst?.name || institution?.name);
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !authUserId || !institution) return;
    const validTypes = ['image/jpeg','image/png','image/webp','image/gif'];
    if (!validTypes.includes(file.type)) { showToast('Kun JPG, PNG eller WEBP tilladt', 'error'); return; }
    setLogoUploading(true);
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `institution-logos/${authUserId}-${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from('listing-images').upload(path, file);
    if (upErr) { showToast('Upload fejlede', 'error'); setLogoUploading(false); return; }
    const { data: { publicUrl } } = db.storage.from('listing-images').getPublicUrl(path);
    const { error: dbErr } = await db.from('institutions').update({ logo_url: publicUrl }).eq('email', institution.email);
    if (!dbErr) {
      const updated = { ...institution, logo_url: publicUrl };
      setInstitution(updated);
      onInstitutionChange?.(updated);
      showToast('Logo opdateret ✓');
    } else { showToast('Kunne ikke gemme logo', 'error'); }
    setLogoUploading(false);
    e.target.value = '';
  }

  async function fetchTrades() {
    setTradesLoading(true);
    const instId = institution?.id;
    const uid = authUserId;
    const orParts = [];
    if (instId) orParts.push(`owner_institution_id.eq.${instId}`, `initiator_institution_id.eq.${instId}`);
    if (uid) orParts.push(`initiator_id.eq.${uid}`, `owner_id.eq.${uid}`);
    if (institution?.name) orParts.push(`owner_name.eq.${institution.name}`, `initiator_name.eq.${institution.name}`);
    if (!orParts.length) { setTradesLoading(false); return; }
    const { data } = await db.from('conversations').select('*').or(orParts.join(',')).eq('deal_completed', true).order('deal_completed_at', { ascending: false });
    if (data) setTrades(data);
    setTradesLoading(false);
  }

  async function fetchActivity() {
    setActLoading(true);
    const instId = institution?.id;
    const uid = authUserId;
    const orParts = [];
    if (instId) orParts.push(`initiator_institution_id.eq.${instId}`);
    if (uid) orParts.push(`initiator_id.eq.${uid}`);
    if (institution?.name) orParts.push(`initiator_name.eq.${institution.name}`);
    if (!orParts.length) { setActLoading(false); return; }
    const { data } = await db.from('conversations').select('*').or(orParts.join(',')).order('last_message_at', { ascending: false });
    if (data) setActivity(data);
    setActLoading(false);
  }

  async function fetchMembers() {
    if (!institution?.id) return;
    const { data } = await db.from('institution_members').select('*').eq('institution_id', institution.id).order('created_at');
    if (data) setMembers(data);
  }
  async function addMember() {
    if (!memberEmail.trim() || !institution?.id) return;
    setMemberSaving(true);
    const { error } = await db.from('institution_members').insert({ institution_id: institution.id, email: memberEmail.trim().toLowerCase(), role: 'member' });
    setMemberSaving(false);
    if (error) { showToast(error.code==='23505' ? 'Brugeren er allerede tilføjet' : 'Noget gik galt', 'error'); return; }
    setMemberEmail(''); fetchMembers(); showToast('Bruger tilføjet ✓');
  }
  async function removeMember(id) {
    await db.from('institution_members').delete().eq('id', id);
    setMembers(ms => ms.filter(m => m.id !== id));
    showToast('Bruger fjernet');
  }

  const favListings = allListings ? allListings.filter(l=>favs?.includes(l.id)) : [];
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:10, border:`1.5px solid ${PAPER3}`, fontSize:14, outline:'none', fontFamily:FONT, background:PAPER2 };
  const labelStyle = { display:'block', fontSize:13, fontWeight:700, marginBottom:6, fontFamily:FONT, color:INK2 };

  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:PAPER }} className="page-enter">
      <div style={{ maxWidth:1140, margin:'0 auto', padding:isMobile?'24px 16px':'36px 24px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:isMobile?'flex-start':'center', justifyContent:'space-between', marginBottom:isMobile?24:36, flexWrap:'wrap', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:isMobile?14:20 }}>
            <div onClick={()=>logoRef.current?.click()} title="Klik for at skifte logo" style={{ width:isMobile?56:72, height:isMobile?56:72, borderRadius:18, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden', flexShrink:0, border:`3px solid ${PAPER2}`, boxShadow:'0 2px 12px rgba(22,34,28,0.14)', position:'relative' }}>
              {logoUploading
                ? <Spinner />
                : institution?.logo_url
                  ? <img src={institution.logo_url} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span style={{ color:'#fff', fontFamily:FONT, fontWeight:800, fontSize:isMobile?22:28 }}>{institution?.name?.charAt(0)?.toUpperCase() || '?'}</span>}
              <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(22,34,28,0.52)', color:'#fff', fontSize:9, fontWeight:700, textAlign:'center', padding:'3px 0', letterSpacing:0.5, fontFamily:FONT }}>SKIFT</div>
            </div>
            <input ref={logoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoUpload} />
            <div>
              <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?22:30, letterSpacing:'-0.03em', color:INK }}>
                {institution?.name || (instLoading ? 'Indlæser…' : 'Min institution')}
              </h1>
              <p style={{ color:INK3, fontSize:13, marginTop:4, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontFamily:FONT }}>
                <span>{institution ? `${institution.pnr ? `P-nr: ${institution.pnr}` : `CVR: ${institution.cvr}`} · ${institution.city}` : instLoading ? '…' : 'Institution ikke fundet'}</span>
                {institution?._memberRole && <span style={{ background:GREEN_TINT, color:PRIMARY, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>Medarbejder</span>}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {authUserId && <Btn variant="outline" color={PRIMARY} radius={22} onClick={()=>router.push('/profil')} style={{ fontSize:isMobile?12:13, padding:isMobile?'8px 14px':'10px 18px', fontFamily:FONT }}>Rediger profil</Btn>}
            {isAdmin && <Btn variant="outline" color={PRIMARY} radius={22} onClick={()=>{ setMembersOpen(true); fetchMembers(); }} style={{ fontSize:isMobile?12:13, padding:isMobile?'8px 14px':'10px 18px', fontFamily:FONT }}>Brugere</Btn>}
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>setNewOpen(true)} style={{ fontSize:isMobile?14:15, padding:isMobile?'10px 18px':'12px 24px', fontFamily:FONT }}>+ Opret opslag</Btn>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:isMobile?12:16, marginBottom:isMobile?24:32 }}>
          {[
            { n:myListings.filter(l=>l.is_active&&!l.is_sold).length, label:'Aktive opslag', color:PRIMARY, onClick:()=>listingsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}) },
            { n:trades.length||0, label:'Handler', color:PRIMARY, onClick:()=>{ setTradesOpen(true); fetchTrades(); } },
            { n:activity.length||0, label:'Sendte tilbud', color:PRIMARY, onClick:()=>{ setActivityOpen(true); fetchActivity(); } },
            { n:incomingConvs.filter(c=>!c.is_handled&&c.owner_unread>0).length||0, label:'Ulæste anmodninger', color:CORAL, onClick:()=>{ const el=document.getElementById('incoming-section'); if(el) el.scrollIntoView({behavior:'smooth'}); } },
          ].map((s,i)=>(
            <div key={i} onClick={s.onClick} style={{ background:PAPER2, borderRadius:20, padding:'20px 22px', border:'1px solid rgba(22,34,28,0.07)', boxShadow:'0 1px 4px rgba(22,34,28,0.06)', animation:`slideUp 0.4s ease ${i*0.08}s both`, cursor:'pointer', transition:'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(22,34,28,0.10)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 4px rgba(22,34,28,0.06)'; }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:32, lineHeight:1, color:s.n>0?s.color:INK3, marginBottom:4 }}>{s.n}</div>
              <div style={{ fontSize:13, color:INK3, fontFamily:FONT }}>{s.label}</div>
              <div style={{ fontSize:11, color:PAPER3, marginTop:6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?16:24 }}>

          {/* Mine opslag */}
          <div ref={listingsRef} style={{ background:PAPER2, borderRadius:22, padding:isMobile?20:28, border:'1px solid rgba(22,34,28,0.07)', boxShadow:'0 1px 4px rgba(22,34,28,0.06)' }}>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, marginBottom:20, color:INK }}>Mine opslag</h2>
            {myListings.length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>0</div>
                <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Ingen opslag endnu — opret dit første!</p>
              </div>
            ) : myListings.map(l=>(
              <div key={l.id} style={{ border:`1px solid ${l.is_sold?'#FECACA':'rgba(22,34,28,0.08)'}`, borderRadius:14, marginBottom:10, overflow:'hidden', opacity:l.is_sold?0.85:1, background:l.is_sold?'#FFF5F5':PAPER }}>
                <div onClick={()=>{ setActiveListing(l); router.push('/opslag/detail'); }} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', cursor:'pointer' }}>
                  <div style={{ width:48, height:48, borderRadius:10, background:l.images?.[0]?PAPER3:l.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0, overflow:'hidden', position:'relative' }}>
                    {l.images?.[0] ? <img src={l.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : l.emoji||'🧸'}
                    {l.is_sold && <div style={{ position:'absolute', inset:0, background:'rgba(22,34,28,0.45)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10 }}><span style={{ fontSize:9, fontWeight:900, color:'#fff', letterSpacing:0.3, fontFamily:FONT }}>SOLGT</span></div>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{l.title}</div>
                    <div style={{ fontSize:12, color:INK3, marginTop:2, fontFamily:FONT }}>{l.city} · {l.age_group}</div>
                    {l.is_sold && l.sold_to && <div style={{ fontSize:11, color:'#e11d48', fontWeight:700, marginTop:2, fontFamily:FONT }}>Solgt til {l.sold_to} · {new Date(l.sold_at).toLocaleDateString('da-DK',{day:'numeric',month:'short',year:'numeric'})}</div>}
                  </div>
                  {l.is_sold
                    ? <span style={{ background:'#FEE2E2', color:'#e11d48', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:800, flexShrink:0, fontFamily:FONT }}>SOLGT</span>
                    : <Badge type={l.type} />}
                  {!l.is_sold && <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>openEdit(l)} style={{ background:GREEN_TINT, border:'none', borderRadius:99, padding:'6px 12px', fontSize:12, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>Rediger</button>
                    <button onClick={()=>setConfirmDelete(l.id)} style={{ background:'#FEF2F2', border:'none', borderRadius:99, padding:'6px 12px', fontSize:12, fontWeight:700, color:'#e11d48', cursor:'pointer', fontFamily:FONT }}>Slet</button>
                  </div>}
                </div>
                {confirmDelete===l.id && (
                  <div style={{ background:'#FFF5F5', borderTop:`1px solid #FECACA`, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, color:'#B91C1C', fontWeight:600, fontFamily:FONT }}>Slet dette opslag permanent?</span>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={()=>setConfirmDelete(null)} style={{ background:PAPER3, border:'none', borderRadius:99, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:FONT }}>Annuller</button>
                      <button onClick={()=>handleDelete(l.id)} style={{ background:'#e11d48', border:'none', borderRadius:99, padding:'6px 14px', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:FONT }}>Ja, slet</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mine favoritter */}
          <div style={{ background:PAPER2, borderRadius:22, padding:isMobile?20:28, border:'1px solid rgba(22,34,28,0.07)', boxShadow:'0 1px 4px rgba(22,34,28,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK }}>Mine favoritter</h2>
              {favListings.length>0 && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:99, padding:'2px 10px', fontSize:12, fontWeight:700, color:'#e11d48', fontFamily:FONT }}>{favListings.length}</div>}
            </div>
            {favListings.length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>♡</div>
                <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Tryk ❤️ på et opslag for at gemme det her</p>
                <button onClick={()=>router.push('/opslag')} style={{ marginTop:14, background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Browse opslag</button>
              </div>
            ) : favListings.map(l=>(
              <div key={l.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', border:`1px solid rgba(22,34,28,0.08)`, borderRadius:14, marginBottom:10, cursor:'pointer', transition:'border-color 0.15s', background:PAPER }}
                onClick={()=>{ setActiveListing(l); router.push('/opslag/detail'); }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=GREEN_SOFT}
                onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(22,34,28,0.08)'}>
                <div style={{ width:48, height:48, borderRadius:10, background:l.images?.[0]?PAPER3:l.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0, overflow:'hidden' }}>
                  {l.images?.[0] ? <img src={l.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : l.emoji||'🧸'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{l.title}</div>
                  <div style={{ fontSize:12, color:INK3, marginTop:2, fontFamily:FONT }}>{l.institution_name} · {l.city}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                  <Badge type={l.type} />
                  <button onClick={e=>{ e.stopPropagation(); toggleFav(l.id); }} style={{ fontSize:14, background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1 }}>❤️</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indkommende anmodninger */}
        <div id="incoming-section" style={{ background:PAPER2, borderRadius:22, padding:isMobile?20:28, border:'1px solid rgba(22,34,28,0.07)', boxShadow:'0 1px 4px rgba(22,34,28,0.06)', marginTop:isMobile?16:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK }}>Indkommende anmodninger</h2>
            {incomingConvs.filter(c=>!c.is_handled&&c.owner_unread>0).length > 0 && <div style={{ background:CORAL, color:'#fff', borderRadius:99, padding:'2px 10px', fontSize:12, fontWeight:800, fontFamily:FONT }}>{incomingConvs.filter(c=>!c.is_handled&&c.owner_unread>0).length} ny</div>}
          </div>
          {(() => {
            const pending = incomingConvs.filter(c=>!c.is_handled);
            if (pending.length === 0) return (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>—</div>
                <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Ingen ubehandlede anmodninger på dine opslag</p>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {pending.slice(0,10).map(c => (
                  <div key={c.id} onClick={()=>router.push('/beskeder')} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', border:`1px solid ${c.owner_unread>0?GREEN_SOFT:'rgba(22,34,28,0.08)'}`, borderRadius:14, cursor:'pointer', background:c.owner_unread>0?GREEN_TINT:PAPER, transition:'all 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=PRIMARY}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=c.owner_unread>0?GREEN_SOFT:'rgba(22,34,28,0.08)'}>
                    <div style={{ width:44, height:44, borderRadius:12, background:c.listing_image?PAPER3:c.listing_color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, overflow:'hidden', position:'relative' }}>
                      {c.listing_image ? <img src={c.listing_image} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : c.listing_emoji||'🧸'}
                      {c.owner_unread>0 && <div style={{ position:'absolute', top:-4, right:-4, width:16, height:16, background:CORAL, borderRadius:'50%', border:`2px solid ${PAPER2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, color:'#fff' }}>{c.owner_unread>9?'9+':c.owner_unread}</div>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FONT, fontWeight:c.owner_unread>0?700:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{c.initiator_name}</div>
                      <div style={{ fontSize:12, color:INK3, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:FONT }}>{c.listing_title}</div>
                      <div style={{ fontSize:12, color:c.owner_unread>0?INK:INK3, fontWeight:c.owner_unread>0?600:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:FONT }}>{c.last_message || 'Samtale startet'}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                      <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>{relTime(c.last_message_at)}</div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </div>
                  </div>
                ))}
                {pending.length > 10 && <button onClick={()=>router.push('/beskeder')} style={{ background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer', alignSelf:'center', marginTop:4, fontFamily:FONT }}>Se alle {pending.length} →</button>}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={!!editListing} onClose={()=>{setEditListing(null);setEditForm(null);}} title="Rediger opslag">
        {editForm && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label style={labelStyle}>Titel *</label>
              <input value={editForm.title} onChange={e=>setEditForm({...editForm,title:e.target.value})} style={inputStyle} /></div>
            <div><label style={labelStyle}>Handelsform</label>
              <div style={{ display:'flex', gap:8 }}>
                {['køb','byd','byt'].map(t=>(
                  <button key={t} onClick={()=>setEditForm({...editForm,type:t})} style={{ flex:1, padding:'10px', borderRadius:10, background:editForm.type===t?TYPE_CFG[t].bg:PAPER3, color:editForm.type===t?TYPE_CFG[t].color:INK3, fontFamily:FONT, fontWeight:700, fontSize:13, border:editForm.type===t?`2px solid ${TYPE_CFG[t].color}`:'2px solid transparent' }}>{TYPE_CFG[t].icon} {TYPE_CFG[t].label}</button>
                ))}
              </div>
            </div>
            {editForm.type==='køb' && (
              <div><label style={labelStyle}>Pris (kr.)</label>
                <input type="number" value={editForm.price} onChange={e=>setEditForm({...editForm,price:e.target.value})} placeholder="Fx 250" style={inputStyle} /></div>
            )}
            <div><label style={labelStyle}>Aldersgruppe</label>
              <select value={editForm.age_group} onChange={e=>setEditForm({...editForm,age_group:e.target.value})} style={{ ...inputStyle, cursor:'pointer' }}>
                {AGE_GROUPS.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Beskrivelse</label>
              <textarea value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} rows={3} style={{ ...inputStyle, resize:'none' }} /></div>
            <div><label style={labelStyle}>Stand</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {CONDITIONS.map(c=>(
                  <button key={c} onClick={()=>setEditForm({...editForm,condition:c})} style={{ padding:'8px 14px', borderRadius:99, fontSize:13, fontWeight:600, border:editForm.condition===c?`2px solid ${PRIMARY}`:'2px solid transparent', background:editForm.condition===c?GREEN_TINT:PAPER3, color:editForm.condition===c?PRIMARY:INK3, fontFamily:FONT }}>{c}</button>
                ))}
              </div>
            </div>
            <div><label style={labelStyle}>Tags <span style={{ fontWeight:400, color:INK3 }}>(op til 5)</span></label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {LISTING_TAGS.map(t => {
                  const sel = editForm.tags?.includes(t);
                  return <button key={t} type="button" onClick={()=>setEditForm(f=>({ ...f, tags: sel ? f.tags.filter(x=>x!==t) : (f.tags||[]).length < 5 ? [...(f.tags||[]), t] : f.tags }))} style={{ padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, border:sel?`2px solid ${PRIMARY}`:'2px solid transparent', background:sel?GREEN_TINT:PAPER3, color:sel?PRIMARY:INK3, cursor:'pointer', fontFamily:FONT }}>{t}</button>;
                })}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button onClick={()=>{setEditListing(null);setEditForm(null);}} style={{ flex:1, padding:'13px', borderRadius:99, background:PAPER3, border:'none', fontWeight:700, fontFamily:FONT, color:INK3 }}>Annuller</button>
              <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleUpdate} disabled={editSaving} style={{ flex:2, justifyContent:'center', padding:'13px', fontSize:14 }}>
                {editSaving ? <><Spinner/>Gemmer…</> : 'Gem ændringer'}
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Trades modal */}
      <Modal open={tradesOpen} onClose={()=>setTradesOpen(false)} title="Gennemførte handler">
        <div>
          {tradesLoading
            ? <div style={{ textAlign:'center', padding:'32px 0', color:INK3, fontFamily:FONT }}>Indlæser…</div>
            : trades.length === 0
              ? (
                <div style={{ textAlign:'center', padding:'40px 0' }}>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>0</div>
                  <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Ingen gennemførte handler endnu</p>
                  <p style={{ fontSize:12, color:INK3, marginTop:6, fontFamily:FONT }}>Handler optræder her når et bud accepteres</p>
                </div>
              )
              : trades.map(t => {
                const isSeller = t.owner_institution_id === institution?.id || t.owner_name === institution?.name;
                const otherParty = isSeller ? t.initiator_name : t.owner_name;
                const dealDate = t.deal_completed_at || t.handled_at;
                return (
                  <div key={t.id} style={{ border:`1px solid ${GREEN_SOFT}`, borderRadius:14, padding:'14px 16px', marginBottom:10, background:GREEN_TINT }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ flex:1, minWidth:0, marginRight:12 }}>
                        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, marginBottom:2, color:INK }}>{t.listing_title || 'Direkte besked'}</div>
                        <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>
                          {isSeller ? 'Solgt til' : 'Købt fra'} <strong style={{ color:INK }}>{otherParty}</strong>
                        </div>
                      </div>
                      <span style={{ background:PRIMARY, color:'#fff', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:800, flexShrink:0, fontFamily:FONT }}>Gennemført</span>
                    </div>
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:11, color:INK3, fontFamily:FONT }}>
                      <span>{dealDate ? new Date(dealDate).toLocaleDateString('da-DK',{day:'numeric',month:'long',year:'numeric'}) : '—'}</span>
                      {t.deal_type && <span>{t.deal_type === 'byd' ? 'Bud accepteret' : t.deal_type === 'byt' ? 'Bytte' : 'Køb'}</span>}
                    </div>
                    <button onClick={()=>router.push('/beskeder')} style={{ marginTop:10, background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'5px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Se samtale →</button>
                  </div>
                );
              })}
        </div>
      </Modal>

      {/* Activity modal */}
      <Modal open={activityOpen} onClose={()=>setActivityOpen(false)} title="Sendte tilbud og forespørgsler">
        <div>
          {actLoading
            ? <div style={{ textAlign:'center', padding:'32px 0', color:INK3, fontFamily:FONT }}>Indlæser…</div>
            : activity.length === 0
              ? (
                <div style={{ textAlign:'center', padding:'40px 0' }}>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>0</div>
                  <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Ingen afgivne bud eller byttetilbud endnu</p>
                  <p style={{ fontSize:12, color:INK3, marginTop:6, fontFamily:FONT }}>Gå til Markedsplads for at finde opslag at byde på</p>
                </div>
              )
              : activity.map(c => {
                const statusBadge = c.deal_completed
                  ? { label:'Handel gennemført', bg:GREEN_TINT, color:PRIMARY }
                  : c.handled_action === 'rejected'
                    ? { label:'Afvist', bg:'#FEF2F2', color:'#e11d48' }
                    : c.handled_action === 'countered'
                      ? { label:'Modbud modtaget', bg:'#FFFBEB', color:'#B45309' }
                      : { label:'Afventer svar', bg:PAPER3, color:INK3 };
                return (
                  <div key={c.id} onClick={()=>router.push('/beskeder')} style={{ border:`1px solid rgba(22,34,28,0.08)`, borderRadius:14, padding:'14px 16px', marginBottom:10, cursor:'pointer', transition:'all 0.15s', background:PAPER }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=GREEN_SOFT}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(22,34,28,0.08)'}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0, marginRight:12 }}>
                        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{c.listing_title || 'Direkte besked'}</div>
                        <div style={{ fontSize:12, color:INK3, marginTop:2, fontFamily:FONT }}>Til <strong style={{ color:INK }}>{c.owner_name}</strong></div>
                      </div>
                      <span style={{ background:statusBadge.bg, color:statusBadge.color, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, flexShrink:0, fontFamily:FONT }}>{statusBadge.label}</span>
                    </div>
                    <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>{relTime(c.last_message_at)}</div>
                  </div>
                );
              })}
        </div>
      </Modal>

      {/* Members modal */}
      <Modal open={membersOpen} onClose={()=>setMembersOpen(false)} title="Brugere under institutionen">
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:GREEN_TINT, borderRadius:12, padding:'12px 14px', fontSize:13, color:INK, fontFamily:FONT, borderLeft:`3px solid ${GREEN_SOFT}` }}>
            Tilføj medarbejdere der skal kunne uploade og favorisere opslag. De logger ind med deres egen e-mail.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} placeholder="medarbejder@institution.dk" type="email"
              onKeyDown={e=>e.key==='Enter'&&addMember()}
              style={inputStyle} />
            <Btn variant="primary" color={PRIMARY} radius={12} onClick={addMember} disabled={memberSaving||!memberEmail.trim()} style={{ padding:'11px 18px', fontSize:13 }}>
              {memberSaving ? <Spinner /> : '+ Tilføj'}
            </Btn>
          </div>
          {members.length === 0
            ? <div style={{ textAlign:'center', padding:'20px 0', color:INK3, fontSize:13, fontFamily:FONT }}>Ingen medarbejdere tilføjet endnu</div>
            : members.map(m => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', border:`1px solid rgba(22,34,28,0.08)`, borderRadius:12, background:PAPER }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:PRIMARY, flexShrink:0, fontFamily:FONT }}>
                  {m.email.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:FONT, color:INK }}>{m.email}</div>
                  <div style={{ fontSize:11, color:INK3, marginTop:1, fontFamily:FONT }}>Medarbejder · Tilføjet {new Date(m.created_at).toLocaleDateString('da-DK')}</div>
                </div>
                <button onClick={()=>removeMember(m.id)} style={{ background:'#FEF2F2', border:'none', borderRadius:99, padding:'6px 12px', fontSize:12, fontWeight:700, color:'#e11d48', cursor:'pointer', fontFamily:FONT }}>Fjern</button>
              </div>
            ))}
        </div>
      </Modal>

      {/* New listing modal */}
      <Modal open={newOpen} onClose={()=>{setNewOpen(false);resetModal();}} title={`Nyt opslag — trin ${step}/2`}>
        {step===1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label style={labelStyle}>Titel *</label>
              <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Fx: LEGO Duplo stor kasse" style={inputStyle} /></div>
            <div><label style={labelStyle}>Handelsform</label>
              <div style={{ display:'flex', gap:8 }}>
                {['køb','byd','byt'].map(t=>(
                  <button key={t} onClick={()=>setForm({...form,type:t})} style={{ flex:1, padding:'10px', borderRadius:10, background:form.type===t?TYPE_CFG[t].bg:PAPER3, color:form.type===t?TYPE_CFG[t].color:INK3, fontFamily:FONT, fontWeight:700, fontSize:13, border:form.type===t?`2px solid ${TYPE_CFG[t].color}`:'2px solid transparent' }}>{TYPE_CFG[t].icon} {TYPE_CFG[t].label}</button>
                ))}
              </div>
            </div>
            {form.type==='køb' && (
              <div><label style={labelStyle}>Pris (kr.) <span style={{ color:'#e53e3e' }}>*</span></label>
                <input type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Fx 250" min="1" style={{ ...inputStyle, border:`1.5px solid ${!form.price?'#FCA5A5':PAPER3}` }} />
                {!form.price && <p style={{ fontSize:12, color:'#e53e3e', marginTop:4, fontFamily:FONT }}>Pris er påkrævet ved køb-opslag</p>}
              </div>
            )}
            {form.type==='byd' && (
              <div><label style={labelStyle}>Mindste bud (kr.) <span style={{ fontWeight:400, color:INK3 }}>— valgfri</span></label>
                <input type="number" value={form.min_bid||''} onChange={e=>setForm({...form,min_bid:e.target.value})} placeholder="Fx 100 — lad stå tom for intet minimum" min="1" style={inputStyle} /></div>
            )}
            <div><label style={labelStyle}>Aldersgruppe</label>
              <select value={form.age_group} onChange={e=>setForm({...form,age_group:e.target.value})} style={{ ...inputStyle, cursor:'pointer' }}>
                {AGE_GROUPS.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Tags <span style={{ fontWeight:400, color:INK3 }}>(vælg op til 5)</span></label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {LISTING_TAGS.map(t => {
                  const sel = (form.tags||[]).includes(t);
                  return <button key={t} type="button" onClick={()=>setForm(f=>({ ...f, tags: sel ? (f.tags||[]).filter(x=>x!==t) : (f.tags||[]).length < 5 ? [...(f.tags||[]), t] : (f.tags||[]) }))} style={{ padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, border:sel?`2px solid ${PRIMARY}`:'2px solid transparent', background:sel?GREEN_TINT:PAPER3, color:sel?PRIMARY:INK3, cursor:'pointer', fontFamily:FONT }}>{t}</button>;
                })}
              </div>
            </div>
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>{ const ok = form.title.trim() && (form.type!=='køb'||form.price); if(ok) setStep(2); }} disabled={!form.title.trim()||(form.type==='køb'&&!form.price)} style={{ justifyContent:'center', padding:'13px', fontSize:14 }}>Næste →</Btn>
          </div>
        )}
        {step===2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div><label style={labelStyle}>Beskrivelse</label>
              <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Beskriv legetøjets stand, hvad der medfølger, mål osv." rows={3} style={{ ...inputStyle, resize:'none', border:`1.5px solid ${!form.description.trim()?'#FCA5A5':PAPER3}` }} />
              {!form.description.trim() && <p style={{ fontSize:12, color:'#e53e3e', marginTop:4, fontFamily:FONT }}>Beskrivelse er påkrævet</p>}
            </div>
            <div><label style={labelStyle}>Stand</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {CONDITIONS.map(c=>(
                  <button key={c} onClick={()=>setForm({...form,condition:c})} style={{ padding:'8px 14px', borderRadius:99, fontSize:13, fontWeight:600, border:form.condition===c?`2px solid ${PRIMARY}`:'2px solid transparent', background:form.condition===c?GREEN_TINT:PAPER3, color:form.condition===c?PRIMARY:INK3, fontFamily:FONT }}>{c}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <label style={{ ...labelStyle, marginBottom:0 }}>Billeder <span style={{ fontWeight:400, color:INK3 }}>(op til 6)</span></label>
                {imgFiles.length < 6 && !aiAnalyzing && (
                  <button type="button" onClick={()=>fileRef.current?.click()} style={{ fontSize:12, fontWeight:700, color:PRIMARY, background:GREEN_TINT, border:'none', borderRadius:99, padding:'5px 12px', cursor:'pointer', fontFamily:FONT }}>+ Tilføj billede</button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display:'none' }} disabled={aiAnalyzing} />
              {aiAnalyzing ? (
                <ScanningLoader />
              ) : imgPreviews.length === 0 ? (
                <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${PAPER3}`, borderRadius:14, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:PAPER }}>
                  <div style={{ width:48, height:48, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:INK, marginBottom:4, fontFamily:FONT }}>Klik for at uploade billeder</div>
                  <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>JPG, PNG eller WEBP · Maks 6 billeder</div>
                  <div style={{ fontSize:11, color:INK3, marginTop:4, fontFamily:FONT }}>Billeder med personer bliver automatisk afvist</div>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {imgPreviews.map((src,i)=>(
                    <div key={i} style={{ position:'relative', aspectRatio:'1', borderRadius:10, overflow:'hidden' }}>
                      <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      <button onClick={()=>removeImg(i)} style={{ position:'absolute', top:4, right:4, width:22, height:22, borderRadius:'50%', background:'rgba(22,34,28,0.6)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>✕</button>
                      {i===0 && <div style={{ position:'absolute', bottom:4, left:4, background:'rgba(22,34,28,0.55)', borderRadius:4, padding:'2px 6px', fontSize:10, color:'#fff', fontWeight:700, fontFamily:FONT }}>Forside</div>}
                    </div>
                  ))}
                  {imgFiles.length < 6 && (
                    <div onClick={()=>fileRef.current?.click()} style={{ aspectRatio:'1', borderRadius:10, border:`2px dashed ${PAPER3}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:PAPER }}>
                      <span style={{ fontSize:24, color:INK3 }}>+</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ background:'#FFFBEB', border:`1.5px solid #FDE68A`, borderRadius:14, overflow:'hidden' }}>
              <button type="button" onClick={()=>setTipsOpen(o=>!o)} style={{ width:'100%', background:'none', border:'none', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#7A5C00', fontFamily:FONT }}>Tips til gode produktbilleder</span>
                <span style={{ fontSize:12, color:INK3, transition:'transform 0.2s', display:'inline-block', transform:tipsOpen?'rotate(180deg)':'none' }}>▼</span>
              </button>
              {tipsOpen && (
                <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    ['💡','Godt lys','Tag billeder ved et vindue i dagslys. Undgå direkte sollys der skaber hårde skygger.'],
                    ['🎯','Ren baggrund','Brug en hvid væg, et lyst gulv eller et stykke hvidt karton som baggrund.'],
                    ['🔄','Alle vinkler','Tag billeder forfra, bagfra og fra siden — og et nærbillede af eventuelle detaljer.'],
                    ['⚠️','Vis slitage ærligt','Fotografér ridser, brud og slidte dele. Det skaber tillid og færre misforståelser.'],
                    ['📏','Vis størrelsen','Læg en genstand som en mønt eller lineal ved siden af for at vise proportioner.'],
                    ['✨','Rent legetøj','Vask eller tør legetøjet af inden fotografering — det gør en stor forskel.'],
                  ].map(([icon,title,desc])=>(
                    <div key={title} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <span style={{ fontSize:18, lineHeight:1.4, flexShrink:0 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:INK, marginBottom:1, fontFamily:FONT }}>{title}</div>
                        <div style={{ fontSize:12, color:INK3, lineHeight:1.55, fontFamily:FONT }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(() => {
              const missingDesc = !form.description.trim();
              const missingImg  = imgFiles.length === 0;
              const missing = [missingDesc && 'beskrivelse', missingImg && 'mindst ét billede'].filter(Boolean);
              return (<>
                {missing.length > 0 && (
                  <div style={{ background:'#FFFBEB', border:`1.5px solid #FDE68A`, borderRadius:10, padding:'10px 14px', fontSize:13, color:'#92400E', display:'flex', gap:8, alignItems:'center', fontFamily:FONT }}>
                    <span>⚠️</span>
                    <span>Mangler: <strong>{missing.join(' og ')}</strong></span>
                  </div>
                )}
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={()=>setStep(1)} style={{ flex:1, padding:'13px', borderRadius:99, background:PAPER3, border:'none', fontWeight:700, fontFamily:FONT, color:INK3 }}>← Tilbage</button>
                  <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleCreate} disabled={saving || missingDesc || missingImg} style={{ flex:2, justifyContent:'center', padding:'13px', fontSize:14 }}>
                    {saving ? <><Spinner/>{imgFiles.length>0?'Uploader…':'Publicerer…'}</> : 'Publicer opslag'}
                  </Btn>
                </div>
              </>);
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
