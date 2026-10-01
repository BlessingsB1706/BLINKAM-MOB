const CACHE_NAME = 'blinkam-v2';
const PRECACHE = [
  './',
  './BlinkAm_Landing_page.html',
  './register.html',
  './log.html',
  './nin_verification.html',
  './home_feed.html',
  './iris.html',
  './manifest.json',
  './config.js',
  './pwa.js',
  './icon-192.png',
  './icon-512.png'
];
const RUNTIME_CDN_HOSTS = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
const OFFLINE_FALLBACK = './BlinkAm_Landing_page.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Pages: network first so deploys show up immediately, cache as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_FALLBACK)))
    );
    return;
  }

  // Static assets (own files + CDN styles/fonts/libs): stale-while-revalidate.
  if (sameOrigin || RUNTIME_CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => putInCache(request, response)).catch(() => cached);
        return cached || network;
      })
    );
  }
  // Everything else (Supabase, Dojah, Paystack APIs) goes straight to the network.
});
