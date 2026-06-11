'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/supabase';
import { checkIsAdmin } from '@/lib/admin';
import ChatBubble from '@/components/ChatBubble';
import FeedbackWidget from '@/components/FeedbackWidget';
import { authedFetch } from '@/lib/authed-fetch';

const PAGE_SIZE = 60;

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...window.atob(b64)].map(c => c.charCodeAt(0)));
}

async function registerPush() {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    });
    if (sub) {
      authedFetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      }).catch(() => {});
    }
  } catch {}
}

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
  const [pendingApproval, setPendingApproval] = useState(false);
  const [adminInst,       setAdminInst]       = useState(null);
  const [allInstitutions, setAllInstitutions] = useState([]);
  const [listings,        setListings]        = useState([]);
  const [refreshSeed,     setRefreshSeed]     = useState(0);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [hasMore,         setHasMore]         = useState(true);
  const listingsOffsetRef = useRef(0);
  const [realUserId,      setRealUserId]      = useState(null);
  const [realEmail,       setRealEmail]       = useState(null);
  const [unreadTotal,     setUnreadTotal]     = useState(0);
  const [toast,           setToast]           = useState(null);
  const [activeListing,   setActiveListing]   = useState(null);
  const [selectedConvId,  setSelectedConvId]  = useState(null);
  const [activeInstName,  setActiveInstName]  = useState(null);
  const [favs,            setFavs]            = useState([]);
  const [cart,            setCart]            = useState([]);

  const effectiveInstitution = adminInst || institution;

  async function loadInstitution(email, userId) {
    const e = email.toLowerCase();

    // Check sessionStorage cache first (avoids DB calls on every page refresh)
    const cacheKey = `ltb_inst_${userId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { ts, isAdmin: ca, inst, allInsts } = JSON.parse(cached);
        if (Date.now() - ts < 5 * 60 * 1000) { // 5-minute TTL
          if (ca) { setIsAdmin(true); setInstitution(null); if (allInsts) setAllInstitutions(allInsts); }
          else if (inst) setInstitution(inst);
          return;
        }
      }
    } catch {}

    // Run admin check + institution lookup in parallel
    const [adminStatus, instResult] = await Promise.all([
      checkIsAdmin(userId),
      db.from('institutions').select('*').ilike('email', e).maybeSingle(),
    ]);

    if (adminStatus) {
      setIsAdmin(true);
      setInstitution(null);
      const { data: all } = await db.from('institutions').select('*').order('name');
      if (all) setAllInstitutions(all);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), isAdmin: true, allInsts: all })); } catch {}
      return;
    }

    if (instResult.data) {
      setInstitution(instResult.data);
      if (instResult.data.is_approved === false) setPendingApproval(true);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), isAdmin: false, inst: instResult.data })); } catch {}
      return;
    }

    // Fallback: check institution_members
    const { data: mem } = await db.from('institution_members').select('role,institutions(*)').ilike('email', e).maybeSingle();
    if (mem?.institutions) {
      const inst = { ...mem.institutions, _memberRole: mem.role };
      setInstitution(inst);
      if (inst.is_approved === false) setPendingApproval(true);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), isAdmin: false, inst })); } catch {}
    }
  }

  const LISTING_COLS = 'id,title,description,price,original_price,type,condition,age_group,category,subcategory,emoji,color,images,institution_name,user_id,city,fav_count,bid_count,created_at,is_active,is_sold,can_ship,urgency,shipping_options(allow_pickup,allow_shipping,allow_custom)';

  async function fetchListings() {
    setLoadingListings(true);
    const { data } = await db.from('listings')
      .select(LISTING_COLS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);
    if (data) {
      setListings(data);
      setHasMore(data.length === PAGE_SIZE);
      listingsOffsetRef.current = data.length;
    }
    setLoadingListings(false);
    setRefreshSeed(s => s + 1);
  }

  async function loadMoreListings() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const offset = listingsOffsetRef.current;
    const { data } = await db.from('listings')
      .select(LISTING_COLS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (data) {
      setListings(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const fresh = data.filter(l => !existingIds.has(l.id));
        return [...prev, ...fresh];
      });
      setHasMore(data.length === PAGE_SIZE);
      listingsOffsetRef.current = offset + data.length;
    }
    setLoadingMore(false);
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

  // ─── Cart ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem('ltb_cart') || '[]')); } catch { setCart([]); }
  }, []);

  function addToCart(item) {
    setCart(prev => {
      if (prev.some(c => c.listingId === item.listingId)) return prev;
      const next = [...prev, item];
      try { localStorage.setItem('ltb_cart', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function removeFromCart(listingId) {
    setCart(prev => {
      const next = prev.filter(c => c.listingId !== listingId);
      try { localStorage.setItem('ltb_cart', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function clearCart() {
    setCart([]);
    try { localStorage.removeItem('ltb_cart'); } catch {}
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
        loadInstitution(session.user.email, session.user.id);
        fetchUnread(session.user.id);
        registerPush();
      }
    });
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      if (session) {
        setRealUserId(session.user.id);
        setRealEmail(session.user.email);
        setLoggedIn(true);
        loadInstitution(session.user.email, session.user.id);
        fetchUnread(session.user.id);
        if (event === 'SIGNED_IN') registerPush();
      } else {
        try { Object.keys(sessionStorage).filter(k => k.startsWith('ltb_inst_')).forEach(k => sessionStorage.removeItem(k)); } catch {}
        setRealUserId(null); setRealEmail(null); setLoggedIn(false);
        setInstitution(null); setUnreadTotal(0); setIsAdmin(false);
        setAdminInst(null); setAllInstitutions([]); setPendingApproval(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const ch1 = db.channel('rt-listings').on('postgres_changes', { event:'*', schema:'public', table:'listings' }, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new?.is_active) {
        setListings(prev => [payload.new, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        if (payload.new?.is_active === false) {
          setListings(prev => prev.filter(l => l.id !== payload.new.id));
        } else {
          setListings(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l));
        }
      } else if (payload.eventType === 'DELETE') {
        setListings(prev => prev.filter(l => l.id !== payload.old.id));
      }
    }).subscribe();
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
    pendingApproval,
    listings, loadingListings, fetchListings, refreshSeed,
    loadMoreListings, hasMore, loadingMore,
    realUserId, realEmail,
    unreadTotal, fetchUnread,
    toast, setToast, showToast,
    activeListing, setActiveListing,
    selectedConvId, setSelectedConvId,
    activeInstName, setActiveInstName,
    favs, toggleFav, setFavs,
    cart, addToCart, removeFromCart, clearCart,
    effectiveInstitution,
  };

  return (
    <ActiveUserContext.Provider value={activeUserValue}>
      <AppContext.Provider value={appValue}>
        {children}
        <ChatBubble />
        <FeedbackWidget
          loggedIn={loggedIn}
          institutionName={effectiveInstitution?.name || null}
          userEmail={realEmail}
        />
      </AppContext.Provider>
    </ActiveUserContext.Provider>
  );
}
