// Cache name - bump when deploying breaking changes
const CACHE = 'gymflow-v3'

self.addEventListener('install', () => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (Supabase, YouTube, etc.)
  if (!event.request.url.startsWith(self.location.origin)) return

  // Network-first: always try the network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful GET responses for offline fallback
        if (
          event.request.method === 'GET' &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const clone = networkResponse.clone()
          caches.open(CACHE).then((cache) => {
            cache.put(event.request, clone).catch(() => {})
          })
        }
        return networkResponse
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // HTML fallback
          if (event.request.headers.get('Accept')?.includes('text/html')) {
            return caches.match('/offline.html').then((offline) =>
              offline || new Response(
                'Estás desconectado y el recurso no está disponible en caché.',
                { status: 503, statusText: 'Service Unavailable' }
              )
            )
          }
          return new Response(
            'Falló la conexión de red.',
            { status: 504, statusText: 'Gateway Timeout' }
          )
        })
      })
  )
})
