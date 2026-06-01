// Find Hitler service worker — offline shell + static caching.
// Never touches /api or /socket.io (live gameplay + realtime stay network-only).
const CACHE = 'fh-v1'
const SHELL = ['/']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return

  // navigations: network-first, fall back to cached shell offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(request, cp)); return r })
        .catch(() => caches.match(request).then((m) => m || caches.match('/')))
    )
    return
  }

  // static assets: cache-first
  if (/_next\/static|\.(png|svg|css|js|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((m) => m || fetch(request).then((r) => {
        const cp = r.clone(); caches.open(CACHE).then((c) => c.put(request, cp)); return r
      }))
    )
  }
})
