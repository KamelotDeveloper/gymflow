// Cache name - update this when deploying new versions
const CACHE = 'gymflow-v2'
// List of static assets to cache during install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.css',
  '/assets/index.js'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE)
          .map((cacheName) => caches.delete(cacheName))
      )
    })
    .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (e.g., to Supabase, YouTube, etc.)
  if (!event.request.url.startsWith(self.location.origin)) {
    // Let browser handle cross-origin requests normally
    return fetch(event.request)
  }

  // Handle same-origin requests with cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        return cachedResponse
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Only cache successful GET requests
        if (
          event.request.method === 'GET' &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          // Clone the response because it's a stream and we need to consume it twice
          const responseClone = networkResponse.clone()
          caches.open(CACHE).then((cache) => {
            cache.put(event.request, responseClone).catch(() => {
              // Fail silently if caching fails
              console.warn('Failed to cache response for', event.request.url)
            })
          })
        }
        return networkResponse
      }).catch(() => {
        // If network fails, try to return a fallback for HTML requests
        if (event.request.headers.get('Accept').includes('text/html')) {
          return caches.match('/offline.html').then((offlineResponse) => {
            return offlineResponse || new Response(
              'You are offline and the requested resource is not available.',
              { status: 503, statusText: 'Service Unavailable' }
            )
          })
        }
        // For non-HTML requests, return a network error response
        return new Response(
          'Network request failed',
          { status: 504, statusText: 'Gateway Timeout' }
        )
      })
    }).catch(() => {
      // Final fallback: return a generic offline response
      return new Response(
        'You are offline and the requested resource is not available.',
        { status: 503, statusText: 'Service Unavailable' }
      )
    })
  )
}

