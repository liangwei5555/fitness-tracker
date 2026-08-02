// Basic service worker for PWA installability
self.addEventListener('install', (e) => {
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})
// Cache-first for app shell, network-first for API
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return // Don't cache API
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone()
      caches.open('app-v1').then(c => c.put(e.request, clone))
      return res
    }))
  )
})
