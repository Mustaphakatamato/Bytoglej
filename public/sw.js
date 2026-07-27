// ─────────────────────────────────────────────────────────────
// Byt&Leg Service Worker
//
// VERSIONING: increment CACHE_VERSION when deploying changes that
// should bust existing caches (e.g. after major UI updates).
// Format: 'bytleg-vN'  →  bump N by 1.
// ─────────────────────────────────────────────────────────────
const CACHE_VERSION = 'bytleg-v2';

const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE  = `${CACHE_VERSION}-images`;
const API_CACHE    = `${CACHE_VERSION}-api`;

const MAX_IMAGE_ENTRIES = 50;

// Kort-tiles håndteres IKKE af service workeren — se fetch-handleren.
const TILE_HOSTS = ['api.maptiler.com', 'basemaps.cartocdn.com'];

const PRECACHE_URLS = [
  '/',
  '/opslag',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate — purge old caches ───────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and Supabase auth/realtime WebSocket
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.pathname.startsWith('/auth/') || url.hostname.includes('realtime')) return;

  // Kort-tiles → lad browseren håndtere dem direkte, uden om alle strategier.
  // De ville ellers ryge i image-grenen nedenfor, og det er skadeligt på tre måder:
  //  1. Ét kortopslag henter snesevis af tiles og fortrænger rigtige billeder i
  //     IMAGE_CACHE, som kun rummer MAX_IMAGE_ENTRIES og smider én ad gangen ud.
  //  2. Tiles er cross-origin, så svarene er opaque (response.ok === false) og
  //     bliver aldrig cachet alligevel — strategien koster kun overhead.
  //  3. Vigtigst: fejler fetch, returnerer staleWhileRevalidate en syntetisk
  //     503 'Offline'. Den når <img> som et gyldigt svar, så tilen fejler, og
  //     den ægte netværksfejl (fx 429 eller en CSP-blokering) bliver skjult i
  //     DevTools bag service worker-svaret.
  if (TILE_HOSTS.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`))) return;

  // Supabase API or own API routes → network-first
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Images → stale-while-revalidate
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)(\?.*)?$/)
  ) {
    e.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // Next.js static chunks → cache-first (content-hashed, safe forever)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Fonts & other static assets → cache-first
  if (
    request.destination === 'font' ||
    request.destination === 'style' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML navigation → network-first, offline fallback
  if (request.mode === 'navigate') {
    e.respondWith(networkFirst(request, STATIC_CACHE, '/offline.html'));
    return;
  }
});

// ── Strategies ────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache       = await caches.open(cacheName);
  const cached      = await cache.match(request);
  const fetchPromise = fetch(request).then(async response => {
    if (response.ok) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > MAX_IMAGE_ENTRIES) {
        await cache.delete(keys[0]);
      }
    }
    return response;
  }).catch(() => null);
  return cached || (await fetchPromise) || new Response('Offline', { status: 503 });
}

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json().catch?.(() => null) ?? null;
  const title = data?.title ?? 'Byt&Leg';
  const body  = data?.body  ?? 'Du har en ny besked!';
  const url   = data?.url   ?? '/beskeder';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const existing = wins.find(w => w.url.includes(url) && 'focus' in w);
      return existing ? existing.focus() : clients.openWindow(url);
    })
  );
});
