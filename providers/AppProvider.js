'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/supabase';
import { ADMIN_EMAIL } from '@/lib/constants';
import { useFavs } from '@/lib/hooks';

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
  const [loadingListings, setLoadingListings] = useState(true);
  const [realUserId,      setRealUserId]      = useState(null);
  const [realEmail,       setRealEmail]       = useState(null);
  const [unreadTotal,     setUnreadTotal]     = useState(0);
  const [toast,           setToast]           = useState(null);
  const [activeListing,   setActiveListing]   = useState(null);
  const [selectedConvId,  setSelectedConvId]  = useState(null);
  const [activeInstName,  setActiveInstName]  = useState(null);
  const [favs,            toggleFav]          = useFavs();

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
      const amInit = c.initiator_institution_id ? c.initiator_institution_id === instId : c.initiator_id === userId;
      return sum + (amInit ? (c.initiator_unread || 0) : (c.owner_unread || 0));
    }, 0);
    setUnreadTotal(total);
  }

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
      if (user) fetchUnread(user.id);
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
    listings, loadingListings, fetchListings,
    realUserId, realEmail,
    unreadTotal, fetchUnread,
    toast, setToast, showToast,
    activeListing, setActiveListing,
    selectedConvId, setSelectedConvId,
    activeInstName, setActiveInstName,
    favs, toggleFav,
    effectiveInstitution,
  };

  return (
    <ActiveUserContext.Provider value={activeUserValue}>
      <AppContext.Provider value={appValue}>
        {children}
      </AppContext.Provider>
    </ActiveUserContext.Provider>
  );
}
