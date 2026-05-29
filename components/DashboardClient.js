'use client';
// dashboard
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, TYPE_CFG, CONDITIONS, AGE_GROUPS, LISTING_TAGS } from '@/lib/constants';
import { useWindowWidth, geocodeAddress, relTime } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Badge, Btn, Spinner, Modal } from '@/components/ui';

const FONT = "'Sora', sans-serif";

function GridCard({ l, setQuickViewListing, openEdit, toggleActive, toggleReserved, setConfirmDelete, confirmDelete, handleDelete }) {
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
    <div style={{ border:`1px solid ${l.is_sold?'#FECACA':l.is_active?'rgba(22,34,28,0.08)':'rgba(22,34,28,0.04)'}`, borderRadius:14, overflow:'hidden', background:l.is_sold?'#FFF5F5':l.is_active?PAPER:'rgba(22,34,28,0.03)', opacity:l.is_active||l.is_sold?1:0.7 }}>
      <div onClick={e=>{ if (moved.current) { moved.current=false; return; } setQuickViewListing(l); }} style={{ cursor:'pointer' }}>
        <div style={{ height:110, background:imgs[imgIdx]?PAPER3:l.color||'#FFD166', position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {imgs[imgIdx] ? <img src={imgs[imgIdx]} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : <span style={{ fontSize:32 }}>{l.emoji||'🧸'}</span>}
          {l.is_sold && <div style={{ position:'absolute', inset:0, background:'rgba(22,34,28,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}><span style={{ fontSize:10, fontWeight:900, color:'#fff', letterSpacing:0.5, fontFamily:FONT }}>SOLGT</span></div>}
          {!l.is_sold && !l.is_active && <div style={{ position:'absolute', inset:0, background:'rgba(22,34,28,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}><span style={{ fontSize:10, fontWeight:900, color:'#fff', letterSpacing:0.5, fontFamily:FONT }}>INAKTIV</span></div>}
          {l.is_reserved && !l.is_sold && <div style={{ position:'absolute', top:6, left:6, background:'#F59E0B', borderRadius:99, padding:'2px 7px', fontSize:9, fontWeight:800, color:'#fff', fontFamily:FONT, zIndex:3 }}>RESERV.</div>}
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
      {!l.is_sold && <div style={{ display:'flex', gap:4, padding:'6px 10px 10px', flexWrap:'wrap' }} onClick={e=>e.stopPropagation()}>
        <button onClick={()=>openEdit(l)} style={{ flex:1, background:GREEN_TINT, border:'none', borderRadius:99, padding:'5px 0', fontSize:11, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>Rediger</button>        <button onClick={()=>toggleActive(l.id, l.is_active)} style={{ flex:1, background:l.is_active?'#FEF9C3':'#F0FDF4', border:'none', borderRadius:99, padding:'5px 0', fontSize:11, fontWeight:700, color:l.is_active?'#B45309':'#15803D', cursor:'pointer', fontFamily:FONT }}>{l.is_active?'Deaktivér':'Aktivér'}</button>
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

  const isAdmin = !!institution && !institution._memberRole;
  const [listingsView, setListingsView] = useState('list');
  const [tradesTab, setTradesTab] = useState('all');

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
    if (ctxIsAdmin) { fetchMyListings(null, instProp?.name || institution?.name); }
    else if (authUserId) { fetchMyListings(authUserId, institution?.name); }
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
    const { data } = await db.rpc('get_listing_favorites_for_owner', { p_listing_ids: ids });
    if (data) setListingFavoriters(data);
  }

  function openEdit(l) {
    router.push(`/rediger-opslag/${l.id}`);
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
    .filter(l => listingFavoriters.some(f => f.listing_id === l.id) || (l.fav_count > 0 && !listingFavoriters.length))
    .map(l => ({ listing: l, favoriters: listingFavoriters.filter(f => f.listing_id === l.id) }));
  const rlsBlocked = !listingFavoriters.length && myListings.some(l => l.fav_count > 0);

  async function startConversationWithFavoriter(listing, favoriterInstId, favoriterInstName) {
    if (!institution) return;
    if (favoriterInstId && institution.id) {
      const { data: existing } = await db.from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .or(`owner_institution_id.eq.${institution.id},initiator_institution_id.eq.${institution.id}`)
        .or(`owner_institution_id.eq.${favoriterInstId},initiator_institution_id.eq.${favoriterInstId}`)
        .maybeSingle();
      if (!existing) {
        await db.from('conversations').insert({
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
        });
      }
    }
    router.push('/beskeder');
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
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:isMobile?12:16, marginBottom:isMobile?24:32 }}>
          {[
            { n:myListings.filter(l=>l.is_active&&!l.is_sold).length, label:'Aktive opslag', color:PRIMARY, onClick:()=>listingsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}) },
            { n:soldTrades.length||0, label:'Solgt', color:PRIMARY, onClick:()=>{ setTradesTab('sold'); setTradesOpen(true); fetchTrades(); } },
            { n:boughtTrades.length||0, label:'Købt', color:PRIMARY, onClick:()=>{ setTradesTab('bought'); setTradesOpen(true); fetchTrades(); } },
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
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={()=>setListingsView('list')} title="Listevisning" style={{ width:32, height:32, borderRadius:8, border:`1.5px solid ${listingsView==='list'?PRIMARY:PAPER3}`, background:listingsView==='list'?GREEN_TINT:'transparent', color:listingsView==='list'?PRIMARY:INK3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <button onClick={()=>setListingsView('grid')} title="Gittervisning" style={{ width:32, height:32, borderRadius:8, border:`1.5px solid ${listingsView==='grid'?PRIMARY:PAPER3}`, background:listingsView==='grid'?GREEN_TINT:'transparent', color:listingsView==='grid'?PRIMARY:INK3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </button>
              </div>
            </div>
            {myListings.length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, lineHeight:1, marginBottom:12 }}>0</div>
                <p style={{ fontSize:14, color:INK3, fontFamily:FONT }}>Ingen opslag endnu — opret dit første!</p>
              </div>
            ) : listingsView === 'grid' ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                {myListings.map(l=>(
                  <GridCard key={l.id} l={l} setQuickViewListing={setQuickViewListing} openEdit={openEdit} toggleActive={toggleActive} toggleReserved={toggleReserved} setConfirmDelete={setConfirmDelete} confirmDelete={confirmDelete} handleDelete={handleDelete} />
                ))}
              </div>
            ) : myListings.map(l=>(
              <div key={l.id} style={{ border:`1px solid ${l.is_sold?'#FECACA':l.is_active?'rgba(22,34,28,0.08)':'rgba(22,34,28,0.04)'}`, borderRadius:14, marginBottom:10, overflow:'hidden', opacity:l.is_active||l.is_sold?1:0.7, background:l.is_sold?'#FFF5F5':l.is_active?PAPER:'rgba(22,34,28,0.02)' }}>
                <div onClick={()=>setQuickViewListing(l)} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', cursor:'pointer' }}>
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
                {!l.is_sold && <div style={{ display:'flex', gap:isMobile?6:6, padding:isMobile?'0 12px 10px':'0 14px 10px', flexWrap:'wrap' }} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>openEdit(l)} style={{ flex:isMobile?1:undefined, background:GREEN_TINT, border:'none', borderRadius:99, padding:isMobile?'7px 0':'6px 12px', fontSize:12, fontWeight:700, color:PRIMARY, cursor:'pointer', fontFamily:FONT }}>Rediger</button>
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
              {rlsBlocked && (
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
                  return (
                    <div key={t.id} style={{ border:`1px solid ${isSeller?GREEN_SOFT:'#BFDBFE'}`, borderRadius:14, padding:'14px 16px', marginBottom:10, background:isSeller?GREEN_TINT:'#EFF6FF' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div style={{ flex:1, minWidth:0, marginRight:12 }}>
                          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, marginBottom:2, color:INK }}>{t.listing_title || 'Direkte besked'}</div>
                          <div style={{ fontSize:12, color:INK3, fontFamily:FONT }}>
                            {isSeller ? 'Solgt til' : 'Købt fra'} <strong style={{ color:INK }}>{otherParty}</strong>
                          </div>
                        </div>
                        <span style={{ background:isSeller?PRIMARY:'#3B82F6', color:'#fff', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:800, flexShrink:0, fontFamily:FONT }}>{isSeller?'Solgt':'Købt'}</span>
                      </div>
                      <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:11, color:INK3, fontFamily:FONT }}>
                        <span>{dealDate ? new Date(dealDate).toLocaleDateString('da-DK',{day:'numeric',month:'long',year:'numeric'}) : '—'}</span>
                        {t.deal_type && <span>{t.deal_type === 'byd' ? 'Bud accepteret' : t.deal_type === 'byt' ? 'Bytte' : 'Køb'}</span>}
                      </div>
                      <button onClick={()=>router.push('/beskeder')} style={{ marginTop:10, background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, borderRadius:99, padding:'5px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Se samtale →</button>
                    </div>
                  );
                });
              })()}
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
  );
}
