'use client';
// dashboard
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, CONDITIONS, AGE_GROUPS, LISTING_TAGS } from '@/lib/constants';
import { useWindowWidth, geocodeAddress, relTime } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Badge, Btn, Spinner, Modal, SkeletonDashboardBox } from '@/components/ui';
import PullToRefresh from '@/components/PullToRefresh';
import { getCO2Comparison, aggregateSavings } from '@/lib/co2/calculator';
import { CATEGORIES } from '@/lib/categories';

const FONT = "'Sora', sans-serif";

function GridCard({ l, setQuickViewListing, openEdit, onCopy, toggleActive, toggleReserved, setConfirmDelete, confirmDelete, handleDelete, bulkMode, selected, onToggleSelect }) {
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = l.images || [];
  const hasMultiple = imgs.length > 1;
  const startX = useRef(0);
  const moved = useRef(false);

  function onTouchStart(e) { startX.current = e.touches[0].clientX; moved.current = false; }
  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40 && hasMultiple) {
      moved.current = true;
      setImgIdx(i => dx < 0 ? (i+1)%imgs.length : (i-1+imgs.length)%imgs.length);
    }
  }

  return (
    <div onClick={bulkMode ? ()=>onToggleSelect(l.id) : undefined} style={{ border:`2px solid ${selected?PRIMARY:l.is_sold?'#FECACA':l.is_active?'rgba(22,34,28,0.08)':'rgba(22,34,28,0.04)'}`, borderRadius:14, overflow:'hidden', background:selected?GREEN_TINT:l.is_sold?'#FFF5F5':l.is_active?PAPER:'rgba(22,34,28,0.03)', opacity:l.is_active||l.is_sold?1:0.7, cursor:bulkMode?'pointer':'default', transition:'border-color 0.15s, background 0.15s' }}>
      <div onClick={e=>{ if (bulkMode) return; if (moved.current) { moved.current=false; return; } setQuickViewListing(l); }} style={{ cursor:bulkMode?'pointer':'pointer', position:'relative' }}>
        <div style={{ height:110, background:imgs[imgIdx]?PAPER3:l.color||'#FFD166', position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {imgs[imgIdx] ? <img src={imgs[imgIdx]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : <span style={{ fontSize:32 }}>{l.emoji||'🧸'}</span>}
          {l.is_sold && <div style={{ position:'absolute', inset:0, background:'rgba(22,34,28,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}><span style={{ fontSize:10, fontWeight:900, color:'#fff', letterSpacing:0.5, fontFamily:FONT }}>SOLGT</span></div>}
          {!l.is_sold && !l.is_active && <div style={{ position:'absolute', inset:0, background:'rgba(22,34,28,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}><span style={{ fontSize:10, fontWeight:900, color:'#fff', letterSpacing:0.5, fontFamily:FONT }}>INAKTIV</span></div>}
          {l.is_reserved && !l.is_sold && <div style={{ position:'absolute', top:6, left:6, background:'#F59E0B', borderRadius:99, padding:'2px 7px', fontSize:9, fontWeight:800, color:'#fff', fontFamily:FONT, zIndex:3 }}>RESERV.</div>}
          {bulkMode && (
            <div style={{ position:'absolute', top:6, right:6, width:22, height:22, borderRadius:6, border:`2px solid ${selected?PRIMARY:'rgba(255,255,255,0.8)'}`, background:selected?PRIMARY:'rgba(255,255,255,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:6, backdropFilter:'blur(2px)' }}>
              {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          )}
          {hasMultiple && <>
            <button onClick={e=>{ e.stopPropagation(); setImgIdx(i=>(i-1+imgs.length)%imgs.length); }} style={{ position:'absolute', left:4, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.55)', border:'none', borderRadius:'50%', width:26, height:26, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, zIndex:5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={e=>{ e.stopPropagation(); setImgIdx(i=>(i+1)%imgs.length); }} style={{ position:'absolute', right:4, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.55)', border:'none', borderRadius:'50%', width:26, height:26, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, zIndex:5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', display:'flex', gap:4, zIndex:5 }}>
              {imgs.map((_,i)=><div key={i} style={{ width:6, height:6, borderRadius:'50%', background: i===imgIdx?'#fff':'rgba(255,255,255,0.5)', transition:'background 0.2s' }}/>)}
            </div>
          </>}
        </div>
        <div style={{ padding:'8px 10px 4px' }}>
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:INK }}>{l.title}</div>
          <Badge type={l.type} />
        </div>
      </div>
      {!l.is_sold && !bulkMode && <div style={{ display:'flex', gap:4, padding:'6px 10px 10px', flexWrap:'wrap' }} onClick={e=>e.stopPropagation()}>
        <button onClick={()=>openEdit(l)} style={{ flex:1, background:GREEN_TINT, border:'none', borderRadius:99, padding:'5px 0', fontSize:11, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>Rediger</button>
        <button onClick={()=>onCopy(l.id)} style={{ flex:1, background:PAPER2, border:`1px solid ${PAPER3}`, borderRadius:99, padding:'5px 0', fontSize:11, fontWeight:700, color:INK2, cursor:'pointer', fontFamily:FONT }}>Kopier</button>
        <button onClick={()=>toggleActive(l.id, l.is_active)} style={{ flex:1, background:l.is_active?'#FEF9C3':'#F0FDF4', border:'none', borderRadius:99, padding:'5px 0', fontSize:11, fontWeight:700, color:l.is_active?'#B45309':'#15803D', cursor:'pointer', fontFamily:FONT }}>{l.is_active?'Deaktivér':'Aktivér'}</button>
        <button onClick={()=>toggleReserved(l.id, l.is_reserved)} style={{ flex:1, background:l.is_reserved?'#FEF3C7':'#FAFAF9', border:'none', borderRadius:99, padding:'5px 0', fontSize:11, fontWeight:700, color:l.is_reserved?'#B45309':INK3, cursor:'pointer', fontFamily:FONT }}>{l.is_reserved?'Frigiv':'Reserver'}</button>
      </div>}
      {confirmDelete===l.id && (
        <div style={{ background:'#FFF5F5', borderTop:`1px solid #FECACA`, padding:'8px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:11, color:'#B91C1C', fontWeight:600, fontFamily:FONT }}>Slet?</span>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setConfirmDelete(null)} style={{ background:PAPER3, border:'none', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:FONT }}>Nej</button>
            <button onClick={()=>handleDelete(l.id)} style={{ background:'#e11d48', border:'none', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:FONT }}>Ja</button>
          </div>
        </div>
      )}
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
    setQuickViewListing,
    unreadTotal,
    institution: ctxAppInstitution,
    setInstitution: setAppInstitution,
    adminInst,
    setAdminInst,
    effectiveInstitution,
    setLoggedIn,
  } = useApp();
  const { userId: ctxUserId, institution: ctxInstitution, isAdminView: ctxIsAdmin, adminInstName, realUserId: ctxRealUserId } = useActiveUser();

  const instProp = effectiveInstitution;

  const [myListings, setMyListings] = useState([]);
  const [institution, setInstitution] = useState(instProp || null);
  const [instLoading, setInstLoading] = useState(true);
  const [authUserId,  setAuthUserId]  = useState(null);
  const [editListing, setEditListing] = useState(null);
  const [editForm,    setEditForm]    = useState(null);
  const [editSaving,  setEditSaving]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
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
  const [invitations, setInvitations] = useState([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);

  const [savedSearches, setSavedSearches] = useState([]);
  const [listingFavoriters, setListingFavoriters] = useState([]);
  const [co2Savings, setCo2Savings] = useState([]);
  const [co2Period, setCo2Period] = useState('total');
  const [co2ModalOpen, setCo2ModalOpen] = useState(false);
  const [co2ListOpen, setCo2ListOpen] = useState(false);
  const [co2ModalData, setCo2ModalData] = useState(null);

  const isAdmin = !!institution && !institution._memberRole;
  const [listingsView, setListingsView] = useState('list');
  const [tradesTab, setTradesTab] = useState('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [matchesModal, setMatchesModal] = useState(null); // søges listing
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  async function startMatchConversation(match) {
    if (!institution || !authUserId) { router.push('/login'); return; }
    const { data: existing } = await db.from('conversations')
      .select('id')
      .eq('listing_id', match.id)
      .or(`owner_institution_id.eq.${institution.id},initiator_institution_id.eq.${institution.id}`)
      .maybeSingle();
    if (existing) { setMatchesModal(null); router.push(`/beskeder?conv=${existing.id}`); return; }
    const { data: created } = await db.from('conversations').insert({
      owner_id: authUserId,
      owner_name: match.institution_name,
      initiator_name: institution.name,
      initiator_institution_id: institution.id,
      listing_id: match.id,
      listing_title: match.title,
      listing_image: match.images?.[0] || null,
      listing_emoji: match.emoji || '🧸',
      listing_color: match.color || '#FFD166',
      listing_type: match.type,
    }).select('id').single();
    setMatchesModal(null);
    router.push(created?.id ? `/beskeder?conv=${created.id}` : '/beskeder');
  }

  async function openMatches(søgesListing) {
    setMatchesModal(søgesListing);
    setMatches([]);
    setMatchesLoading(true);
    const conditionRank = { 'Ny':0, 'Meget god':1, 'God':2, 'Acceptabel':3 };
    const minRank = conditionRank[søgesListing.condition] ?? 3;

    let q = db.from('listings')
      .select('id,title,description,condition,category,age_group,price,images,emoji,color,institution_name,type,is_active,is_sold')
      .eq('is_active', true)
      .eq('is_sold', false)
      .neq('type', 'søges')
      .neq('institution_name', søgesListing.institution_name);

    if (søgesListing.category) q = q.eq('category', søgesListing.category);
    if (søgesListing.age_group) q = q.eq('age_group', søgesListing.age_group);

    const { data } = await q.limit(100);
    if (data) {
      const keywords = (søgesListing.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const scored = data
        .filter(l => {
          const rank = conditionRank[l.condition] ?? 3;
          return rank <= minRank;
        })
        .map(l => {
          const text = (l.title + ' ' + (l.description || '')).toLowerCase();
          const score = keywords.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
          return { ...l, _score: score };
        })
        .sort((a, b) => b._score - a._score);
      setMatches(scored);
    }
    setMatchesLoading(false);
  }

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

      const listings = await fetchMyListings(ctxIsAdmin ? null : user.id, inst?.name);
      if (!cancelled) await fetchListingFavoriters(listings);
      if (!cancelled) fetchCO2Savings(inst, user.id);
      if (!cancelled) fetchTrades(inst, user.id);

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

      const { data: ss } = await db.from('saved_searches').select('*').ilike('email', user.email).order('created_at', { ascending: false });
      if (!cancelled && ss) setSavedSearches(ss);

      if (!cancelled) setInstLoading(false);
    }
    boot();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    async function refresh() {
      let data;
      if (ctxIsAdmin) { data = await fetchMyListings(null, instProp?.name || institution?.name); }
      else if (authUserId) { data = await fetchMyListings(authUserId, institution?.name); }
      if (data?.length) fetchListingFavoriters(data);
    }
    refresh();
  }, [allListings]);

  async function fetchMyListings(userId, instName) {
    let q = db.from('listings').select('*').order('created_at', { ascending: false });
    if (userId && instName) { q = q.or(`user_id.eq.${userId},institution_name.eq.${instName}`); }
    else if (userId) { q = q.eq('user_id', userId); }
    else if (instName) { q = q.eq('institution_name', instName); }
    else { return []; }
    const { data } = await q;
    if (data) setMyListings(data);
    return data || [];
  }

  async function fetchListingFavoriters(listings) {
    if (!listings?.length) return;
    const ids = listings.map(l => l.id);
    const { data, error } = await db.from('listing_favorites')
      .select('listing_id, institution_name, institution_id, user_id, created_at')
      .in('listing_id', ids)
      .order('created_at', { ascending: false });
    if (error) console.error('fetchListingFavoriters error:', error.message);
    if (data?.length) setListingFavoriters(data);
  }

  async function fetchCO2Savings(inst, uid) {
    if (!inst?.id) return;
    const { data } = await db.from('transaction_co2_savings')
      .select('net_saved_kg, breakdown, methodology_version, calculated_at, transaction_id, seller_name, buyer_name, listing_category_id')
      .or(`seller_institution_id.eq.${inst.id},buyer_institution_id.eq.${inst.id}`)
      .order('calculated_at', { ascending: false });
    if (data) setCo2Savings(data);
  }

  function openEdit(l) {
    router.push(`/rediger-opslag/${l.id}`);
  }

  function copyListing(id) {
    router.push(`/opret-opslag?from=${id}`);
  }

  function toggleSelectId(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(myListings.filter(l => !l.is_sold).map(l => l.id)));
  }

  function exitBulk() {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkConfirmDelete(false);
  }

  async function handleBulkActivate(activate) {
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => db.from('listings').update({ is_active: activate }).eq('id', id)));
    showToast(`${ids.length} opslag ${activate ? 'aktiveret' : 'deaktiveret'} ✓`);
    exitBulk();
    fetchMyListings(ctxIsAdmin ? null : authUserId, institution?.name);
    onListingCreated();
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => db.from('listings').update({ is_active: false }).eq('id', id)));
    showToast(`${ids.length} opslag slettet`);
    exitBulk();
    fetchMyListings(ctxIsAdmin ? null : authUserId, institution?.name);
    onListingCreated();
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

  async function toggleActive(id, currentActive) {
    await db.from('listings').update({ is_active: !currentActive }).eq('id', id);
    fetchMyListings(ctxIsAdmin ? null : authUserId, institution?.name);
    onListingCreated();
  }

  async function toggleReserved(id, currentReserved) {
    await db.from('listings').update({ is_reserved: !currentReserved }).eq('id', id);
    fetchMyListings(ctxIsAdmin ? null : authUserId, institution?.name);
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

  async function fetchTrades(inst, uid) {
    setTradesLoading(true);
    const instId = (inst ?? institution)?.id;
    const userId = uid ?? authUserId;
    const instName = (inst ?? institution)?.name;
    const orParts = [];
    if (instId) orParts.push(`owner_institution_id.eq.${instId}`, `initiator_institution_id.eq.${instId}`);
    if (userId) orParts.push(`initiator_id.eq.${userId}`, `owner_id.eq.${userId}`);
    if (instName) orParts.push(`owner_name.eq.${instName}`, `initiator_name.eq.${instName}`);
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
    const [{ data: mems }, { data: invs }] = await Promise.all([
      db.from('institution_members').select('*').eq('institution_id', institution.id).order('created_at'),
      db.from('institution_invitations').select('*').eq('institution_id', institution.id).is('accepted_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ]);
    if (mems) setMembers(mems);
    if (invs) setInvitations(invs);
  }
  async function inviteMember() {
    const email = memberEmail.trim().toLowerCase();
    if (!email || !institution?.id) return;
    // Check for existing member
    const alreadyMember = members.some(m => m.email.toLowerCase() === email);
    const alreadyInvited = invitations.some(i => i.email.toLowerCase() === email);
    if (alreadyMember) { showToast('Denne e-mail er allerede tilknyttet institutionen', 'error'); return; }
    if (alreadyInvited) { showToast('En invitation er allerede sendt til denne e-mail', 'error'); return; }
    setMemberSaving(true);
    // Insert invitation record
    const { data: inv, error: invErr } = await db.from('institution_invitations').insert({
      institution_id: institution.id,
      institution_name: institution.name,
      email,
      invited_by: institution.name,
    }).select().single();
    if (invErr) {
      showToast('Noget gik galt', 'error');
      setMemberSaving(false);
      return;
    }
    // Send email via API route
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inv.token, email, institution_name: institution.name, invited_by: institution.name }),
    });
    setMemberSaving(false);
    if (!res.ok) {
      await db.from('institution_invitations').delete().eq('id', inv.id);
      showToast('E-mail kunne ikke sendes — prøv igen', 'error');
      return;
    }
    setMemberEmail('');
    fetchMembers();
    showToast(`Invitation sendt til ${email} ✓`);
  }
  async function cancelInvitation(id) {
    await db.from('institution_invitations').delete().eq('id', id);
    setInvitations(is => is.filter(i => i.id !== id));
    showToast('Invitation annulleret');
  }
  async function removeMember(id) {
    await db.from('institution_members').delete().eq('id', id);
    setMembers(ms => ms.filter(m => m.id !== id));
    showToast('Bruger fjernet');
  }

  const favListings = allListings ? allListings.filter(l=>favs?.includes(l.id)) : [];

  const favoritersGrouped = myListings
    .filter(l => listingFavoriters.some(f => f.listing_id === l.id) || l.fav_count > 0)
    .map(l => ({ listing: l, favoriters: listingFavoriters.filter(f => f.listing_id === l.id) }));
  const rlsBlocked = !listingFavoriters.length && myListings.some(l => l.fav_count > 0);

  async function startConversationWithFavoriter(listing, favoriterInstId, favoriterInstName) {
    if (!institution) return;
    let convId = null;
    if (favoriterInstId && institution.id) {
      const { data: existing } = await db.from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .or(`owner_institution_id.eq.${institution.id},initiator_institution_id.eq.${institution.id}`)
        .or(`owner_institution_id.eq.${favoriterInstId},initiator_institution_id.eq.${favoriterInstId}`)
        .maybeSingle();
      if (existing) {
        convId = existing.id;
      } else {
        const { data: created } = await db.from('conversations').insert({
          owner_id: authUserId,
          owner_name: institution.name,
          owner_institution_id: institution.id,
          initiator_institution_id: favoriterInstId,
          initiator_name: favoriterInstName,
          listing_id: listing.id,
          listing_title: listing.title,
          listing_image: listing.images?.[0] || null,
          listing_emoji: listing.emoji || '🧸',
          listing_color: listing.color || '#FFD166',
          listing_type: listing.type,
        }).select('id').single();
        convId = created?.id;
      }
    }
    router.push(convId ? `/beskeder?conv=${convId}` : '/beskeder');
  }

  const soldTrades = trades.filter(t => t.owner_institution_id === institution?.id || t.owner_name === institution?.name);
  const boughtTrades = trades.filter(t => !(t.owner_institution_id === institution?.id || t.owner_name === institution?.name));

  async function toggleSearchNotify(id, currentValue) {
    const newVal = !currentValue;
    await db.from('saved_searches').update({ notify: newVal }).eq('id', id);
    setSavedSearches(prev => prev.map(s => s.id === id ? { ...s, notify: newVal } : s));
  }

  async function deleteSearch(id) {
    await db.from('saved_searches').delete().eq('id', id);
    setSavedSearches(prev => prev.filter(s => s.id !== id));
    showToast('Søgning slettet');
  }

  function applySearch(filters) {
    const params = new URLSearchParams();
    if (filters.type && filters.type !== 'alle') params.set('type', filters.type);
    if (filters.city && filters.city !== 'alle') params.set('city', filters.city);
    if (filters.search) params.set('search', filters.search);
    if (filters.tags && filters.tags.length) params.set('tags', JSON.stringify(filters.tags));
    if (filters.maxDist && filters.maxDist !== 'alle') params.set('maxDist', filters.maxDist);
    const qs = params.toString();
    router.push('/opslag' + (qs ? '?' + qs : ''));
  }

  function filterSummary(filters) {
    const parts = [];
    if (filters.type && filters.type !== 'alle') parts.push(filters.type);
    if (filters.city && filters.city !== 'alle') parts.push(`📍 ${filters.city}`);
    if (filters.search) parts.push(`"${filters.search}"`);
    if (filters.tags && filters.tags.length) parts.push(...filters.tags);
    if (filters.maxDist && filters.maxDist !== 'alle') parts.push(`inden for ${filters.maxDist} km`);
    return parts;
  }

  const ww = useWindowWidth();
  const isMobile = ww < 768;

  async function handleRefresh() {
    const listings = await fetchMyListings(ctxIsAdmin ? null : authUserId, institution?.name);
    if (listings?.length) await fetchListingFavoriters(listings);
    fetchCO2Savings(institution, authUserId);
    fetchTrades(institution, authUserId);
    onListingCreated();
  }

  const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:10, border:`1.5px solid ${PAPER3}`, fontSize:14, outline:'none', fontFamily:FONT, background:PAPER2 };
  const labelStyle = { display:'block', fontSize:13, fontWeight:700, marginBottom:6, fontFamily:FONT, color:INK2 };

  if (instLoading) return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:PAPER }}>
      <div style={{ maxWidth:1140, margin:'0 auto', padding:isMobile?'24px 16px':'36px 24px', display:'flex', flexDirection:'column', gap:20 }}>
        <SkeletonDashboardBox rows={1} />
        <SkeletonDashboardBox rows={3} />
        <SkeletonDashboardBox rows={3} />
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={handleRefresh}>
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
                {institution?.name || 'Min institution'}
              </h1>
              <p style={{ color:INK3, fontSize:13, marginTop:4, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontFamily:FONT }}>
                <span>{institution ? `${institution.pnr ? `P-nr: ${institution.pnr}` : `CVR: ${institution.cvr}`} · ${institution.city}` : instLoading ? '…' : 'Institution ikke fundet'}</span>
                {institution?._memberRole && <span style={{ background:GREEN_TINT, color:PRIMARY, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>Medarbejder</span>}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {authUserId && <Btn variant="outline" color={PRIMARY} radius={22} onClick={()=>router.push('/profil')} style={{ fontSize:isMobile?12:13, padding:isMobile?'8px 14px':'10px 18px', fontFamily:FONT }}>Rediger profil</Btn>}
            {isAdmin && <Btn variant="outline" color={PRIMARY} radius={22} onClick={()=>{ setMembersOpen(true); fetchMembers(); }} style={{ fontSize:isMobile?12:13, padding:isMobile?'8px 14px':'10px 18px', fontFamily:FONT }}>Medarbejdere</Btn>}
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>router.push('/opret-opslag')} style={{ fontSize:isMobile?14:15, padding:isMobile?'10px 18px':'12px 24px', fontFamily:FONT }}>+ Opret opslag</Btn>
            {isMobile && authUserId && (
              <button onClick={async()=>{ await db.auth.signOut(); setLoggedIn(false); router.push('/'); }} style={{ background:'#FEF2F2', border:'none', borderRadius:22, padding:'8px 14px', fontSize:12, fontWeight:700, color:'#DC2626', cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', gap:6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Log ud
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(3,1fr)', gap:isMobile?12:16, marginBottom:isMobile?24:32 }}>
          {[
            { n:myListings.filter(l=>l.is_active&&!l.is_sold).length, label:'Aktive opslag', color:PRIMARY, onClick:()=>listingsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}) },
            { n:trades.length||0, label:'Handler', color:PRIMARY, onClick:()=>{ setTradesTab('all'); setTradesOpen(true); fetchTrades(); } },
            { n:activity.length||0, label:'Sendte tilbud', color:PRIMARY, onClick:()=>{ setActivityOpen(true); fetchActivity(); } },
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
          <div ref={listingsRef} style={{ background:PAPER2, borderRadius:22, padding:isMobile?20:28, border:'1px solid rgba(22,34,28,0.07)', boxShadow:'0 1px 4px rgba(22,34,28,0.06)', minWidth:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0 }}>Mine opslag</h2>
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                {myListings.length > 0 && (
                  <button onClick={()=>{ if(bulkMode){exitBulk();}else{setBulkMode(true);} }} style={{ padding:'5px 12px', borderRadius:99, border:`1.5px solid ${bulkMode?PRIMARY:PAPER3}`, background:bulkMode?GREEN_TINT:'transparent', color:bulkMode?PRIMARY:INK3, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:FONT }}>
                    {bulkMode ? 'Annuller' : 'Vælg'}
                  </button>
                )}
                {bulkMode && myListings.length > 0 && (
                  <button onClick={selectedIds.size === myListings.filter(l=>!l.is_sold).length ? ()=>setSelectedIds(new Set()) : selectAll} style={{ padding:'5px 12px', borderRadius:99, border:`1.5px solid ${PAPER3}`, background:'transparent', color:INK3, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:FONT }}>
                    {selectedIds.size === myListings.filter(l=>!l.is_sold).length ? 'Fravælg alle' : 'Vælg alle'}
                  </button>
                )}
                {!bulkMode && <>
                  <button onClick={()=>setListingsView('list')} title="Listevisning" style={{ width:32, height:32, borderRadius:8, border:`1.5px solid ${listingsView==='list'?PRIMARY:PAPER3}`, background:listingsView==='list'?GREEN_TINT:'transparent', color:listingsView==='list'?PRIMARY:INK3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  </button>
                  <button onClick={()=>setListingsView('grid')} title="Gittervisning" style={{ width:32, height:32, borderRadius:8, border:`1.5px solid ${listingsView==='grid'?PRIMARY:PAPER3}`, background:listingsView==='grid'?GREEN_TINT:'transparent', color:listingsView==='grid'?PRIMARY:INK3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  </button>
                </>}
              </div>
            </div>
            {myListings.filter(l=>!l.is_sold).length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>0</div>
                <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Ingen opslag endnu — opret dit første!</p>
              </div>
            ) : listingsView === 'grid' ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                {myListings.filter(l=>!l.is_sold).map(l=>(
                  <GridCard key={l.id} l={l} setQuickViewListing={setQuickViewListing} openEdit={openEdit} onCopy={copyListing} toggleActive={toggleActive} toggleReserved={toggleReserved} setConfirmDelete={setConfirmDelete} confirmDelete={confirmDelete} handleDelete={handleDelete} bulkMode={bulkMode} selected={selectedIds.has(l.id)} onToggleSelect={toggleSelectId} />
                ))}
              </div>
            ) : myListings.filter(l=>!l.is_sold).map(l=>(
              <div key={l.id} onClick={bulkMode?()=>toggleSelectId(l.id):undefined} style={{ border:`1.5px solid ${bulkMode&&selectedIds.has(l.id)?PRIMARY:l.is_sold?'#FECACA':l.is_active?'rgba(22,34,28,0.08)':'rgba(22,34,28,0.04)'}`, borderRadius:14, marginBottom:10, overflow:'hidden', opacity:l.is_active||l.is_sold?1:0.7, background:bulkMode&&selectedIds.has(l.id)?GREEN_TINT:l.is_sold?'#FFF5F5':l.is_active?PAPER:'rgba(22,34,28,0.02)', cursor:bulkMode?'pointer':'default', transition:'border-color 0.15s, background 0.15s' }}>
                <div onClick={bulkMode?undefined:()=>setQuickViewListing(l)} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', cursor:bulkMode?'pointer':'pointer' }}>
                  {bulkMode && (
                    <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${selectedIds.has(l.id)?PRIMARY:PAPER3}`, background:selectedIds.has(l.id)?PRIMARY:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                      {selectedIds.has(l.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  )}
                  <div style={{ width:48, height:48, borderRadius:10, background:l.images?.[0]?PAPER3:l.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0, overflow:'hidden', position:'relative' }}>
                    {l.images?.[0] ? <img src={l.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : l.emoji||'🧸'}
                    {l.is_sold && <div style={{ position:'absolute', inset:0, background:'rgba(22,34,28,0.45)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10 }}><span style={{ fontSize:9, fontWeight:900, color:'#fff', letterSpacing:0.3, fontFamily:FONT }}>SOLGT</span></div>}
                    {!l.is_sold && !l.is_active && <div style={{ position:'absolute', inset:0, background:'rgba(22,34,28,0.35)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10 }}><span style={{ fontSize:9, fontWeight:900, color:'#fff', letterSpacing:0.3, fontFamily:FONT }}>INAKTIV</span></div>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:INK }}>{l.title}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, color:INK3, fontFamily:FONT }}>{l.city} · {l.age_group}</span>
                      {l.is_reserved && !l.is_sold && <span style={{ background:'#FEF3C7', color:'#B45309', borderRadius:99, padding:'1px 8px', fontSize:10, fontWeight:800, fontFamily:FONT }}>Reserveret</span>}
                    </div>
                    {l.is_sold && l.sold_to && <div style={{ fontSize:11, color:'#e11d48', fontWeight:700, marginTop:2, fontFamily:FONT }}>Solgt til {l.sold_to} · {new Date(l.sold_at).toLocaleDateString('da-DK',{day:'numeric',month:'short',year:'numeric'})}</div>}
                  </div>
                  {l.is_sold
                    ? <span style={{ background:'#FEE2E2', color:'#e11d48', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:800, flexShrink:0, fontFamily:FONT }}>SOLGT</span>
                    : !l.is_active
                      ? <span style={{ background:PAPER3, color:INK3, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, flexShrink:0, fontFamily:FONT }}>Inaktiv</span>
                      : <Badge type={l.type} />}
                </div>
                {!l.is_sold && !bulkMode && <div style={{ display:'flex', gap:isMobile?6:6, padding:isMobile?'0 12px 10px':'0 14px 10px', flexWrap:'wrap' }} onClick={e=>e.stopPropagation()}>
                  {l.type === 'søges' && (
                    <button onClick={()=>openMatches(l)} style={{ flex:isMobile?'1 0 100%':undefined, background:'#F5F0FF', border:'1px solid #DDD6FE', borderRadius:99, padding:isMobile?'7px 0':'6px 12px', fontSize:12, fontWeight:700, color:'#7C3AED', cursor:'pointer', fontFamily:FONT }}>🔍 Se mulige matches</button>
                  )}
                  <button onClick={()=>openEdit(l)} style={{ flex:isMobile?1:undefined, background:GREEN_TINT, border:'none', borderRadius:99, padding:isMobile?'7px 0':'6px 12px', fontSize:12, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>Rediger</button>
                  <button onClick={()=>copyListing(l.id)} style={{ flex:isMobile?1:undefined, background:PAPER2, border:`1px solid ${PAPER3}`, borderRadius:99, padding:isMobile?'7px 0':'6px 12px', fontSize:12, fontWeight:700, color:INK2, cursor:'pointer', fontFamily:FONT }}>Kopier</button>
                  <button onClick={()=>toggleActive(l.id, l.is_active)} title={l.is_active?'Deaktivér opslag':'Aktivér opslag'} style={{ flex:isMobile?1:undefined, background:l.is_active?'#FEF9C3':'#F0FDF4', border:'none', borderRadius:99, padding:isMobile?'7px 0':'6px 12px', fontSize:12, fontWeight:700, color:l.is_active?'#B45309':'#15803D', cursor:'pointer', fontFamily:FONT }}>{l.is_active?'Deaktivér':'Aktivér'}</button>
                  {!isMobile && <button onClick={()=>toggleReserved(l.id, l.is_reserved)} style={{ background:l.is_reserved?'#FEF3C7':PAPER3, border:'none', borderRadius:99, padding:'6px 12px', fontSize:12, fontWeight:700, color:l.is_reserved?'#B45309':INK3, cursor:'pointer', fontFamily:FONT }}>{l.is_reserved?'Frigiv':'Reserver'}</button>}
                  {!isMobile && <button onClick={()=>setConfirmDelete(l.id)} style={{ background:'#FEF2F2', border:'none', borderRadius:99, padding:'6px 12px', fontSize:12, fontWeight:700, color:'#e11d48', cursor:'pointer', fontFamily:FONT }}>Slet</button>}
                </div>}
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
          <div style={{ background:PAPER2, borderRadius:22, padding:isMobile?20:28, border:'1px solid rgba(22,34,28,0.07)', boxShadow:'0 1px 4px rgba(22,34,28,0.06)', minWidth:0, overflow:'hidden' }}>
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
                onClick={()=>setQuickViewListing(l)}
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

        {/* Interesserede i dine opslag */}
        <div style={{ background:PAPER2, borderRadius:22, padding:isMobile?20:28, border:'1px solid rgba(22,34,28,0.07)', boxShadow:'0 1px 4px rgba(22,34,28,0.06)', marginTop:isMobile?16:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0 }}>Interesserede i dine opslag</h2>
            {listingFavoriters.length > 0 && (
              <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:99, padding:'2px 10px', fontSize:12, fontWeight:700, color:'#e11d48', fontFamily:FONT }}>
                ♥ {listingFavoriters.length}
              </div>
            )}
          </div>
          {favoritersGrouped.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>♡</div>
              <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Ingen har favoriseret dine opslag endnu</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {false && (
                <div style={{ background:'#FEF9C3', border:'1px solid #FDE047', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#92400E', fontFamily:FONT }}>
                  <strong>Tæller vises, men ikke hvem</strong> — kontakt os for at aktivere fuldt visning af interesserede.
                </div>
              )}
              {favoritersGrouped.map(({ listing, favoriters }) => (
                <div key={listing.id} style={{ border:`1px solid rgba(22,34,28,0.08)`, borderRadius:16, overflow:'hidden', background:PAPER }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: favoriters.length > 0 ? `1px solid rgba(22,34,28,0.06)` : 'none', background:GREEN_TINT }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:listing.images?.[0]?PAPER3:listing.color||'#FFD166', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, overflow:'hidden' }}>
                      {listing.images?.[0] ? <img src={listing.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : listing.emoji||'🧸'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{listing.title}</div>
                      <div style={{ fontSize:11, color:PRIMARY, fontWeight:600, fontFamily:FONT }}>
                        {favoriters.length > 0 ? `${favoriters.length} ${favoriters.length === 1 ? 'interesseret' : 'interesserede'}` : `${listing.fav_count || '?'} interesserede`}
                      </div>
                    </div>
                  </div>
                  {favoriters.length === 0 && listing.fav_count > 0 && (
                    <div style={{ padding:'10px 16px', fontSize:12, color:INK3, fontStyle:'italic', fontFamily:FONT }}>
                      {listing.fav_count} {listing.fav_count === 1 ? 'person har' : 'personer har'} vist interesse — de var ikke logget ind
                    </div>
                  )}
                  {favoriters.length > 0 && <div>
                    {favoriters.map((f, idx) => (
                      <div key={`${f.listing_id}-${f.user_id}-${idx}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom: idx < favoriters.length - 1 ? `1px solid rgba(22,34,28,0.05)` : 'none' }}>
                        <div style={{ width:36, height:36, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:PRIMARY, flexShrink:0, fontFamily:FONT, border:`2px solid ${GREEN_SOFT}` }}>
                          {(f.institution_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.institution_name || 'Ukendt institution'}</div>
                          <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>{relTime(f.created_at)}</div>
                        </div>
                        <button
                          onClick={() => startConversationWithFavoriter(listing, f.institution_id, f.institution_name)}
                          style={{ background:PRIMARY, color:'#fff', border:'none', borderRadius:99, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT, flexShrink:0, whiteSpace:'nowrap' }}>
                          Skriv →
                        </button>
                      </div>
                    ))}
                  </div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gemte søgninger */}
        <div style={{ background:PAPER2, borderRadius:22, padding:isMobile?20:28, border:'1px solid rgba(22,34,28,0.07)', boxShadow:'0 1px 4px rgba(22,34,28,0.06)', marginTop:isMobile?16:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0 }}>Gemte søgninger 🔔</h2>
            {savedSearches.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:12, color:INK3, fontFamily:FONT }}>Notificer alle</span>
                <button
                  onClick={async () => {
                    const anyOff = savedSearches.some(s => !s.notify);
                    const newVal = anyOff;
                    await Promise.all(savedSearches.map(s => db.from('saved_searches').update({ notify: newVal }).eq('id', s.id)));
                    setSavedSearches(prev => prev.map(s => ({ ...s, notify: newVal })));
                  }}
                  style={{ width:44, height:24, borderRadius:99, border:'none', cursor:'pointer', position:'relative', background: savedSearches.every(s=>s.notify) ? PRIMARY : PAPER3, transition:'background 0.2s' }}
                >
                  <div style={{ position:'absolute', top:3, left: savedSearches.every(s=>s.notify) ? 22 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            )}
          </div>
          {savedSearches.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:40, color:GREEN_SOFT, marginBottom:10 }}>🔍</div>
              <p style={{ fontSize:14, color:INK3, fontFamily:FONT, margin:0 }}>Ingen gemte søgninger endnu</p>
              <p style={{ fontSize:12, color:INK3, fontFamily:FONT, marginTop:6 }}>Gå til <span onClick={()=>router.push('/opslag')} style={{ color:PRIMARY, fontWeight:700, cursor:'pointer' }}>markedspladsen</span> og tryk "Gem søgning"</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {savedSearches.map(s => {
                const pills = filterSummary(s.filters || {});
                return (
                  <div key={s.id} style={{ background:PAPER, borderRadius:14, padding:'14px 16px', border:`1px solid ${PAPER3}`, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, marginBottom:pills.length?6:0 }}>{s.name}</div>
                      {pills.length > 0 && (
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {pills.map((p,i) => (
                            <span key={i} style={{ background:GREEN_TINT, color:PRIMARY, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{p}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, color:INK3, fontFamily:FONT }}>🔔</span>
                        <button
                          onClick={() => toggleSearchNotify(s.id, s.notify)}
                          style={{ width:40, height:22, borderRadius:99, border:'none', cursor:'pointer', position:'relative', background: s.notify ? PRIMARY : PAPER3, transition:'background 0.2s', flexShrink:0 }}
                        >
                          <div style={{ position:'absolute', top:2, left: s.notify ? 20 : 2, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
                        </button>
                      </div>
                      <button onClick={() => applySearch(s.filters || {})} style={{ padding:'7px 14px', borderRadius:99, background:PRIMARY, color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT, whiteSpace:'nowrap' }}>
                        Anvend →
                      </button>
                      <button onClick={() => deleteSearch(s.id)} style={{ width:30, height:30, borderRadius:'50%', background:'none', border:`1.5px solid ${PAPER3}`, color:INK3, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }} title="Slet søgning">
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CO2 widget — Niveau 2: pr. institution */}
        {(() => {
          const stats = aggregateSavings(co2Savings);
          const periodVal = co2Period === 'year' ? stats.thisYear : co2Period === 'last' ? stats.lastYear : stats.total;
          const comparison = getCO2Comparison(periodVal);
          return (
            <div style={{ background:'#F0FDF4', borderRadius:22, padding:isMobile?20:28, border:`1px solid ${GREEN_SOFT}`, boxShadow:'0 1px 4px rgba(22,34,28,0.06)', marginTop:isMobile?16:24 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0 }}>🌱 Din miljømæssige indsats</h2>
                <button onClick={()=>router.push('/baeredygtighed/metode')} style={{ fontSize:11, color:PRIMARY, fontWeight:700, fontFamily:FONT, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Sådan beregner vi det</button>
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                {[['total','Total'],['year','I år'],['last','Sidste år']].map(([k,l]) => (
                  <button key={k} onClick={()=>setCo2Period(k)}
                    style={{ padding:'6px 14px', borderRadius:99, border:`1.5px solid ${co2Period===k?PRIMARY:GREEN_SOFT}`, background:co2Period===k?PRIMARY:'transparent', color:co2Period===k?'#fff':PRIMARY, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT, transition:'all 0.15s' }}>
                    {l}
                  </button>
                ))}
              </div>
              {co2Savings.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0' }}>
                  <p style={{ fontSize:14, color:INK3, fontFamily:FONT, margin:0 }}>Ingen gennemførte handler endnu — besparelser beregnes automatisk</p>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8 }}>
                    <span style={{ fontFamily:FONT, fontWeight:800, fontSize:isMobile?36:48, color:PRIMARY, lineHeight:1 }}>≈ {periodVal}</span>
                    <span style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:PRIMARY }}>kg CO₂e</span>
                    <span style={{ fontSize:14, color:INK3, fontFamily:FONT }}>sparet (estimeret)</span>
                  </div>
                  {comparison && <div style={{ fontSize:13, color:INK3, fontFamily:FONT, marginBottom:8 }}>{comparison}</div>}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>På tværs af {stats.count} byttehandel{stats.count !== 1 ? 'er' : ''}</div>
                    <button onClick={() => setCo2ListOpen(v => !v)} style={{ fontSize:12, color:PRIMARY, fontWeight:700, fontFamily:FONT, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                      {co2ListOpen ? 'Skjul handler' : 'Se handler'}
                    </button>
                  </div>
                  {co2ListOpen && (
                    <div style={{ borderTop:`1px solid ${GREEN_SOFT}`, paddingTop:8, marginTop:8 }}>
                      {co2Savings.filter(s => s.net_saved_kg > 0).map((s, idx) => {
                        const isOwner = s.seller_name === institution?.name;
                        const partner = isOwner ? s.buyer_name : s.seller_name;
                        const role = isOwner ? 'Solgt til' : 'Købt fra';
                        const catLabel = CATEGORIES.find(c => c.key === s.breakdown?.categoryId)?.label || s.listing_category_id || s.breakdown?.categoryId || 'Handel';
                        return (
                          <div key={idx} onClick={() => { setCo2ModalData(s); setCo2ModalOpen(true); }}
                            style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${GREEN_SOFT}`, cursor:'pointer' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontFamily:FONT, fontSize:13, fontWeight:700, color:INK, marginBottom:2 }}>{catLabel}</div>
                              <div style={{ fontFamily:FONT, fontSize:11, color:INK3 }}>{role} <strong style={{ color:INK2 }}>{partner || '—'}</strong></div>
                              <div style={{ fontFamily:FONT, fontSize:11, color:INK3 }}>{new Date(s.calculated_at).toLocaleDateString('da-DK', { day:'numeric', month:'short', year:'numeric' })}</div>
                            </div>
                            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:PRIMARY, marginLeft:12, whiteSpace:'nowrap' }}>≈ {s.net_saved_kg} kg</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

      </div>

      {/* CO2 breakdown modal */}
      <Modal open={co2ModalOpen} onClose={()=>setCo2ModalOpen(false)} title="🌱 Estimeret CO₂-besparelse">
        {co2ModalData && (() => {
          const b = co2ModalData.breakdown || {};
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'#F0FDF4', borderRadius:14, padding:'16px' }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:28, color:PRIMARY, marginBottom:4 }}>≈ {co2ModalData.net_saved_kg} kg CO₂e</div>
                <div style={{ fontSize:13, color:INK3, fontFamily:FONT }}>Estimeret besparelse ved denne handel</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  ['Kategori-faktor', `${b.categoryFactor} kg CO₂e/enhed`],
                  ['Displacement rate', `${b.displacementRate} (60% erstatter nyt køb)`],
                  ['Estimeret produktionsbesparelse', `${b.productionSavedKg} kg CO₂e`],
                  [`Transport-omkostning (${b.rawDistanceKm} km${b.distanceEstimated ? ', estimeret' : ''}, tur/retur)`, `${b.transportCostKg} kg CO₂e`],
                  ['Netto besparelse', `${co2ModalData.net_saved_kg} kg CO₂e`],
                ].map(([label, val]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'8px 0', borderBottom:`1px solid ${PAPER2}` }}>
                    <span style={{ fontSize:13, color:INK3, fontFamily:FONT }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:INK, fontFamily:FONT, textAlign:'right' }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:INK3, fontFamily:FONT }}>Beregnet ud fra metode v{co2ModalData.methodology_version} · Alle tal er estimater</div>
              <button onClick={()=>{ setCo2ModalOpen(false); router.push('/baeredygtighed/metode'); }}
                style={{ padding:'10px', borderRadius:99, background:GREEN_TINT, border:`1px solid ${GREEN_SOFT}`, color:PRIMARY, fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Læs om beregningsmetoden →
              </button>
            </div>
          );
        })()}
      </Modal>

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

      {/* Trades drawer — rendered via portal to escape page-enter stacking context */}
      {tradesOpen && typeof document !== 'undefined' && createPortal(
        <div onClick={()=>setTradesOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.65)', zIndex:10002, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:PAPER, borderRadius:isMobile?'20px 20px 0 0':'24px', padding:isMobile?`24px 20px calc(env(safe-area-inset-bottom, 0px) + 80px)`:'36px', width:'100%', maxWidth:isMobile?'100%':500, boxShadow:'0 28px 70px rgba(22,34,28,0.25)', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
              <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:22, letterSpacing:'-0.03em', color:INK, margin:0 }}>Gennemførte handler</h2>
              <button onClick={()=>setTradesOpen(false)} style={{ background:PAPER2, border:'none', borderRadius:999, width:34, height:34, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:INK2, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {[['all','Alle'], ['sold','Solgt'], ['bought','Købt']].map(([key, label]) => (
                <button key={key} onClick={()=>setTradesTab(key)}
                  style={{ flex:1, padding:'8px', borderRadius:99, border:`1.5px solid ${tradesTab===key?PRIMARY:PAPER3}`, background:tradesTab===key?GREEN_TINT:'transparent', color:tradesTab===key?PRIMARY:INK3, fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>
            {tradesLoading
              ? <div style={{ textAlign:'center', padding:'32px 0', color:INK3, fontFamily:FONT }}>Indlæser…</div>
              : (() => {
                  const filtered = tradesTab === 'sold' ? soldTrades : tradesTab === 'bought' ? boughtTrades : trades;
                  if (filtered.length === 0) return (
                    <div style={{ textAlign:'center', padding:'40px 0' }}>
                      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>0</div>
                      <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Ingen gennemførte handler endnu</p>
                      <p style={{ fontSize:12, color:INK3, marginTop:6, fontFamily:FONT }}>Handler optræder her når et bud accepteres</p>
                    </div>
                  );
                  return filtered.map(t => {
                    const isSeller = t.owner_institution_id === institution?.id || t.owner_name === institution?.name;
                    const otherParty = isSeller ? t.initiator_name : t.owner_name;
                    const dealDate = t.deal_completed_at || t.handled_at;
                    const tradeCo2 = co2Savings.find(s => s.transaction_id === t.id);
                    return (
                      <div key={t.id} style={{ border:`1px solid ${isSeller?GREEN_SOFT:'#BFDBFE'}`, borderRadius:14, padding:'14px 16px', marginBottom:10, background:isSeller?GREEN_TINT:'#EFF6FF' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:8 }}>
                          <div style={{ width:48, height:48, borderRadius:10, background:t.listing_image?PAPER3:(t.listing_color||'#FFD166'), flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                            {t.listing_image
                              ? <img src={t.listing_image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              : (t.listing_emoji || '🧸')}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, marginBottom:2, color:INK }}>{t.listing_title || 'Direkte besked'}</div>
                                <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>
                                  {isSeller ? 'Solgt til' : 'Købt fra'} <strong style={{ color:INK }}>{otherParty}</strong>
                                </div>
                              </div>
                              <span style={{ background:isSeller?PRIMARY:'#3B82F6', color:'#fff', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:800, flexShrink:0, fontFamily:FONT }}>{isSeller?'Solgt':'Købt'}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:11, color:INK3, fontFamily:FONT }}>
                          <span>{dealDate ? new Date(dealDate).toLocaleDateString('da-DK',{day:'numeric',month:'long',year:'numeric'}) : '—'}</span>
                          {t.deal_type && <span>{t.deal_type === 'byd' ? 'Bud accepteret' : t.deal_type === 'byt' ? 'Bytte' : 'Køb'}</span>}
                        </div>
                        {tradeCo2 && (
                          <button onClick={()=>{ setCo2ModalData(tradeCo2); setCo2ModalOpen(true); }}
                            style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:5, background:'#F0FDF4', border:`1px solid ${GREEN_SOFT}`, borderRadius:99, padding:'4px 10px', fontSize:12, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>
                            🌱 ≈ {tradeCo2.net_saved_kg} kg CO₂e sparet
                          </button>
                        )}
                        <button onClick={()=>router.push(`/beskeder?conv=${t.id}`)} style={{ marginTop:10, background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'5px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Se samtale →</button>
                      </div>
                    );
                  });
                })()}
          </div>
        </div>,
        document.body
      )}

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
      <Modal open={membersOpen} onClose={()=>setMembersOpen(false)} title="Medarbejdere">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:GREEN_TINT, borderRadius:'0 10px 10px 0', padding:'12px 14px', fontSize:13, color:INK, fontFamily:FONT, borderLeft:`3px solid ${GREEN_SOFT}`, lineHeight:1.55 }}>
            Inviter medarbejdere med deres e-mailadresse. De modtager en invitation og opretter selv deres konto.
          </div>

          {/* Invite input */}
          <div style={{ display:'flex', gap:8 }}>
            <input value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} placeholder="medarbejder@institution.dk" type="email"
              onKeyDown={e=>e.key==='Enter'&&inviteMember()}
              style={{ ...inputStyle, flex:1 }} />
            <Btn variant="primary" color={PRIMARY} radius={99} onClick={inviteMember} disabled={memberSaving||!memberEmail.trim()} style={{ padding:'11px 18px', fontSize:13, whiteSpace:'nowrap' }}>
              {memberSaving ? <Spinner /> : 'Send invitation'}
            </Btn>
          </div>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div>
              <div style={{ fontFamily:FONT, fontSize:12, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Afventer svar</div>
              {invitations.map(inv => (
                <div key={inv.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', border:`1px solid rgba(22,34,28,0.08)`, borderRadius:12, background:PAPER, marginBottom:8 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'#FFFBEB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#B45309', flexShrink:0, fontFamily:FONT }}>
                    {inv.email.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:FONT, color:INK }}>{inv.email}</div>
                    <div style={{ fontSize:11, color:'#B45309', marginTop:2, fontFamily:FONT, fontWeight:600 }}>
                      Invitation sendt · udløber {new Date(inv.expires_at).toLocaleDateString('da-DK', { day:'numeric', month:'short' })}
                    </div>
                  </div>
                  <button onClick={()=>cancelInvitation(inv.id)} style={{ background:'#FEF2F2', border:'none', borderRadius:99, padding:'5px 10px', fontSize:11, fontWeight:700, color:'#e11d48', cursor:'pointer', fontFamily:FONT }}>Annuller</button>
                </div>
              ))}
            </div>
          )}

          {/* Accepted members */}
          <div>
            {(members.length > 0 || invitations.length > 0) && (
              <div style={{ fontFamily:FONT, fontSize:12, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Aktive medarbejdere</div>
            )}
            {members.length === 0 && invitations.length === 0
              ? <div style={{ textAlign:'center', padding:'24px 0', color:INK3, fontSize:13, fontFamily:FONT }}>Ingen medarbejdere tilknyttet endnu</div>
              : members.length === 0
                ? <div style={{ textAlign:'center', padding:'12px 0', color:INK3, fontSize:13, fontFamily:FONT }}>Ingen aktive medarbejdere endnu</div>
                : members.map(m => (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', border:`1px solid rgba(22,34,28,0.08)`, borderRadius:12, background:PAPER, marginBottom:8 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:PRIMARY, flexShrink:0, fontFamily:FONT }}>
                      {m.email.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:FONT, color:INK }}>{m.email}</div>
                      <div style={{ fontSize:11, color:INK3, marginTop:1, fontFamily:FONT }}>Medarbejder · Tilmeldt {new Date(m.created_at).toLocaleDateString('da-DK')}</div>
                    </div>
                    <button onClick={()=>removeMember(m.id)} style={{ background:'#FEF2F2', border:'none', borderRadius:99, padding:'6px 12px', fontSize:12, fontWeight:700, color:'#e11d48', cursor:'pointer', fontFamily:FONT }}>Fjern</button>
                  </div>
                ))
            }
          </div>
        </div>
      </Modal>

    </div>

    {/* Bulk action bar */}
    {bulkMode && selectedIds.size > 0 && (
      <div style={{ position:'fixed', bottom:isMobile?72:24, left:'50%', transform:'translateX(-50%)', zIndex:500, display:'flex', alignItems:'center', gap:8, background:PAPER2, borderRadius:99, padding:'10px 16px', boxShadow:'0 8px 32px rgba(22,34,28,0.18)', border:`1px solid rgba(22,34,28,0.10)`, flexWrap:'wrap', justifyContent:'center', maxWidth:'calc(100vw - 32px)' }}>
        <span style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK, paddingRight:4 }}>{selectedIds.size} valgt</span>
        <div style={{ width:1, height:20, background:PAPER3 }} />
        <button onClick={()=>handleBulkActivate(true)} style={{ padding:'7px 14px', borderRadius:99, background:'#F0FDF4', border:'none', color:'#15803D', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Aktivér alle</button>
        <button onClick={()=>handleBulkActivate(false)} style={{ padding:'7px 14px', borderRadius:99, background:'#FEF9C3', border:'none', color:'#B45309', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Deaktivér alle</button>
        {!bulkConfirmDelete
          ? <button onClick={()=>setBulkConfirmDelete(true)} style={{ padding:'7px 14px', borderRadius:99, background:'#FEF2F2', border:'none', color:'#e11d48', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Slet alle</button>
          : <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, color:'#e11d48', fontWeight:600, fontFamily:FONT }}>Er du sikker?</span>
              <button onClick={handleBulkDelete} style={{ padding:'7px 14px', borderRadius:99, background:'#e11d48', border:'none', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:FONT }}>Ja, slet</button>
              <button onClick={()=>setBulkConfirmDelete(false)} style={{ padding:'7px 14px', borderRadius:99, background:PAPER3, border:'none', color:INK3, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Nej</button>
            </div>
        }
        <button onClick={exitBulk} style={{ padding:'7px 12px', borderRadius:99, background:PAPER3, border:'none', color:INK3, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>✕</button>
      </div>
    )}

    {/* Matches modal */}
    {matchesModal && typeof document !== 'undefined' && createPortal(
      <div onClick={()=>setMatchesModal(null)} style={{ position:'fixed', inset:0, background:'rgba(22,34,28,0.65)', zIndex:10002, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:PAPER, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 -8px 40px rgba(22,34,28,0.2)' }}>
          {/* Header */}
          <div style={{ padding:'20px 20px 14px', borderBottom:`1px solid ${PAPER2}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:16, color:INK }}>Mulige matches</div>
              <button onClick={()=>setMatchesModal(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:INK3, lineHeight:1, padding:4 }}>✕</button>
            </div>
            <div style={{ fontFamily:FONT, fontSize:12, color:INK3 }}>
              Opslag der passer til "<strong style={{color:INK}}>{matchesModal.title}</strong>" · {matchesModal.condition}+ · {matchesModal.age_group}
            </div>
          </div>

          {/* Content */}
          <div style={{ overflowY:'auto', flex:1, padding:'12px 16px 24px' }}>
            {matchesLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[1,2,3].map(i => <div key={i} style={{ height:72, background:PAPER2, borderRadius:12, animation:'pulse 1.5s ease-in-out infinite' }} />)}
              </div>
            ) : matches.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:INK, marginBottom:6 }}>Ingen matches fundet endnu</div>
                <div style={{ fontSize:13, color:INK3, fontFamily:FONT }}>Prøv igen senere — nye opslag tilføjes løbende</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {matches.map(m => (
                  <div key={m.id} onClick={()=>{ setMatchesModal(null); setQuickViewListing(m); }} style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${m._score > 0 ? '#DDD6FE' : PAPER2}`, padding:'12px 14px', display:'flex', gap:12, alignItems:'center', cursor:'pointer' }}>
                    <div style={{ width:52, height:52, borderRadius:10, background:m.images?.[0]?PAPER3:m.color||GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0, overflow:'hidden' }}>
                      {m.images?.[0] ? <img src={m.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : m.emoji||'🧸'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</div>
                      <div style={{ fontSize:11, color:INK3, fontFamily:FONT, marginTop:2 }}>{m.institution_name} · {m.condition}</div>
                      {m._score > 0 && <div style={{ fontSize:10, color:'#7C3AED', fontWeight:700, fontFamily:FONT, marginTop:2 }}>{'★'.repeat(Math.min(m._score,3))} God match</div>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                      {m.price > 0 && <div style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:PRIMARY }}>{m.price} kr.</div>}
                      <button onClick={()=>startMatchConversation(m)} style={{ background:'#7C3AED', color:'#fff', border:'none', borderRadius:99, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FONT, whiteSpace:'nowrap' }}>
                        Kontakt →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}

    </PullToRefresh>
  );
}
