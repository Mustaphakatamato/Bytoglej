'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/supabase';
import { ADMIN_EMAIL } from '@/lib/constants';
import QuickViewModal from '@/components/QuickViewModal';
import ChatBubble from '@/components/ChatBubble';

// ─── Active User Context ──────────────────────────────────────────────────────
export const ActiveUserContext = createContext({
  userId: null, userEmail: null, institution: null, institutionId: null,
  isAdminView: false, realUserId: null, adminInstName: null,
});
export function useActiveUser() { return useContext(ActiveUserContext); }

// ─── App Context (navigation state + listings + toast) ───────────────────────
export const AppContext = createContext(null);
export function useApp() { return useContext(AppContext); }

export function AppProvider({ children }) {
  const [loggedIn,        setLoggedIn]        = useState(false);
  const [institution,     setInstitution]     = useState(null);
  const [isAdmin,         setIsAdmin]         = useState(false);
  const [adminInst,       setAdminInst]       = useState(null);
  const [allInstitutions, setAllInstitutions] = useState([]);
  const [listings,        setListings]        = useState([]);
  const [refreshSeed,     setRefreshSeed]     = useState(0);
  const [loadingListings, setLoadingListings] = useState(true);
  const [realUserId,      setRealUserId]      = useState(null);
  const [realEmail,       setRealEmail]       = useState(null);
  const [unreadTotal,     setUnreadTotal]     = useState(0);
  const [toast,           setToast]           = useState(null);
  const [quickViewListing, setQuickViewListing] = useState(null);
  const [activeListing,   setActiveListing]   = useState(null);
  const [selectedConvId,  setSelectedConvId]  = useState(null);
  const [activeInstName,  setActiveInstName]  = useState(null);
  const [favs,            setFavs]            = useState([]);

  const effectiveInstitution = adminInst || institution;

  async function loadInstitution(email) {
    const e = email.toLowerCase();

    // Platform admin — no institution binding, neutral start
    if (e === ADMIN_EMAIL.toLowerCase()) {
      setIsAdmin(true);
      setInstitution(null);
      const { data: all } = await db.from('institutions').select('*').order('name');
      if (all) setAllInstitutions(all);
      return;
    }

    const { data } = await db.from('institutions').select('*').ilike('email', e).maybeSingle();
    if (data) {
      setInstitution(data);
      return;
    }
    const { data: mem } = await db.from('institution_members').select('role,institutions(*)').ilike('email', e).maybeSingle();
    if (mem?.institutions) setInstitution({ ...mem.institutions, _memberRole: mem.role });
  }

  async function fetchListings() {
    setLoadingListings(true);
    const { data } = await db.from('listings').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (data) setListings(data);
    setLoadingListings(false);
    setRefreshSeed(s => s + 1);
  }

  async function fetchUnread(userId) {
    const instId = effectiveInstitution?.id;
    const orParts = [`initiator_id.eq.${userId}`, `owner_id.eq.${userId}`];
    if (instId) orParts.push(`owner_institution_id.eq.${instId}`, `initiator_institution_id.eq.${instId}`);
    const { data } = await db.from('conversations')
      .select('initiator_id,initiator_unread,owner_id,owner_unread,owner_institution_id,initiator_institution_id')
      .or(orParts.join(','));
    if (!data) return;
    const total = data.reduce((sum, c) => {
      const amInit = instId
        ? (c.initiator_institution_id ? c.initiator_institution_id === instId : c.initiator_id === userId)
        : c.initiator_id === userId;
      return sum + (amInit ? (c.initiator_unread || 0) : (c.owner_unread || 0));
    }, 0);
    setUnreadTotal(total);
  }

  // ─── Favourites ───────────────────────────────────────────────────────────────
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem('ltb_favs') || '[]')); } catch { setFavs([]); }
  }, []);

  async function toggleFav(listingId) {
    // Optimistic local update
    let adding;
    setFavs(prev => {
      adding = !prev.includes(listingId);
      const next = adding ? [...prev, listingId] : prev.filter(id => id !== listingId);
      try { localStorage.setItem('ltb_favs', JSON.stringify(next)); } catch {}
      return next;
    });

    // Sync to DB
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;

    // Block favoriting own listings
    const { data: listingRow } = await db.from('listings').select('user_id, institution_name').eq('id', listingId).maybeSingle();
    if (listingRow) {
      const ownedByUser = listingRow.user_id === user.id;
      const ownedByInst = institution?.name && listingRow.institution_name === institution.name;
      if (ownedByUser || ownedByInst) return;
    }

    if (adding) {
      const effectiveInst = adminInst || institution;
      const { error } = await db.from('listing_favorites').upsert({
        listing_id: listingId,
        user_id: user.id,
        institution_id: effectiveInst?.id || null,
        institution_name: effectiveInst?.name || null,
      }, { onConflict: 'listing_id,user_id' });
      if (error) console.error('listing_favorites insert error:', error.message);
    } else {
      const { error } = await db.from('listing_favorites')
        .delete()
        .eq('listing_id', listingId)
        .eq('user_id', user.id);
      if (error) console.error('listing_favorites delete error:', error.message);
    }

    // Update fav_count to match real DB count
    const { count } = await db
      .from('listing_favorites')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId);
    if (count != null) {
      db.from('listings').update({ fav_count: count }).eq('id', listingId);
    }
  }

  // Re-fetch when institution loads (fetchUnread may have run before institution was ready)
  useEffect(() => {
    if (realUserId) fetchUnread(realUserId);
  }, [effectiveInstitution?.id]);

  // Keep a ref so the always-on realtime subscription calls the latest fetchUnread (avoids stale closure)
  const fetchUnreadRef = useRef(fetchUnread);
  useEffect(() => { fetchUnreadRef.current = fetchUnread; });

  useEffect(() => {
    fetchListings();
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setRealUserId(session.user.id);
        setRealEmail(session.user.email);
        setLoggedIn(true);
        loadInstitution(session.user.email);
        fetchUnread(session.user.id);
      }
    });
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      if (session) {
        setRealUserId(session.user.id);
        setRealEmail(session.user.email);
        setLoggedIn(true);
        loadInstitution(session.user.email);
        fetchUnread(session.user.id);
      } else {
        setRealUserId(null); setRealEmail(null); setLoggedIn(false);
        setInstitution(null); setUnreadTotal(0); setIsAdmin(false);
        setAdminInst(null); setAllInstitutions([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const ch1 = db.channel('rt-listings').on('postgres_changes', { event:'*', schema:'public', table:'listings' }, fetchListings).subscribe();
    const ch2 = db.channel('rt-convs-app').on('postgres_changes', { event:'*', schema:'public', table:'conversations' }, async () => {
      const { data:{ user } } = await db.auth.getUser();
      if (user) fetchUnreadRef.current(user.id);
    }).subscribe();
    return () => { db.removeChannel(ch1); db.removeChannel(ch2); };
  }, []);

  function showToast(msg, type = 'success') { setToast({ msg, type }); }

  const activeUserValue = {
    userId:        realUserId,
    userEmail:     adminInst ? adminInst.email : realEmail,
    institution:   effectiveInstitution,
    institutionId: effectiveInstitution?.id || null,
    isAdminView:   !!adminInst,
    realUserId,
    adminInstName: adminInst?.name || null,
  };

  const appValue = {
    loggedIn, setLoggedIn,
    institution, setInstitution,
    isAdmin, adminInst, setAdminInst,
    allInstitutions,
    listings, loadingListings, fetchListings, refreshSeed,
    realUserId, realEmail,
    unreadTotal, fetchUnread,
    toast, setToast, showToast,
    activeListing, setActiveListing,
    selectedConvId, setSelectedConvId,
    activeInstName, setActiveInstName,
    favs, toggleFav, setFavs,
    effectiveInstitution,
    quickViewListing, setQuickViewListing,
  };

  return (
    <ActiveUserContext.Provider value={activeUserValue}>
      <AppContext.Provider value={appValue}>
        {children}
        {quickViewListing && <QuickViewModal listing={quickViewListing} onClose={()=>setQuickViewListing(null)} />}
        <ChatBubble />
      </AppContext.Provider>
    </ActiveUserContext.Provider>
  );
}
