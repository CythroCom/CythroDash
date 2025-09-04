// Service Worker for performance optimization and caching
const CACHE_NAME = 'pterodactyl-dashboard-v1'
const STATIC_CACHE_NAME = 'pterodactyl-static-v1'
const DYNAMIC_CACHE_NAME = 'pterodactyl-dynamic-v1'

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  // Add other static assets as needed
]

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/servers/,
  /\/api\/user/,
  // Add other API patterns
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[SW] Static assets cached')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[SW] Service worker activated')
        return self.clients.claim()
      })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  event.respondWith(handleFetch(request))
})

async function handleFetch(request) {
  const url = new URL(request.url)
  
  try {
    // Strategy 1: Cache First for static assets
    if (isStaticAsset(url)) {
      return await cacheFirst(request, STATIC_CACHE_NAME)
    }
    
    // Strategy 2: Network First for API calls
    if (isApiCall(url)) {
      return await networkFirst(request, DYNAMIC_CACHE_NAME)
    }
    
    // Strategy 3: Stale While Revalidate for other resources
    return await staleWhileRevalidate(request, DYNAMIC_CACHE_NAME)
    
  } catch (error) {
    console.error('[SW] Fetch error:', error)
    
    // Fallback to cache if available
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page or error response
    return new Response('Offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    })
  }
}

// Cache First strategy - good for static assets
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    console.log('[SW] Cache hit:', request.url)
    return cachedResponse
  }
  
  console.log('[SW] Cache miss, fetching:', request.url)
  const networkResponse = await fetch(request)
  
  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone())
  }
  
  return networkResponse
}

// Network First strategy - good for API calls
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  
  try {
    console.log('[SW] Network first:', request.url)
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    throw error
  }
}

// Stale While Revalidate strategy - good for frequently updated content
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  // Fetch in background to update cache
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  }).catch(() => {
    // Ignore network errors in background
  })
  
  // Return cached version immediately if available
  if (cachedResponse) {
    console.log('[SW] Stale while revalidate - cache hit:', request.url)
    return cachedResponse
  }
  
  // Wait for network if no cache
  console.log('[SW] Stale while revalidate - no cache, waiting for network:', request.url)
  return await fetchPromise
}

// Helper functions
function isStaticAsset(url) {
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
         url.pathname === '/' ||
         url.pathname.startsWith('/_next/static/')
}

function isApiCall(url) {
  return url.pathname.startsWith('/api/') ||
         API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)
  
  if (event.tag === 'server-actions') {
    event.waitUntil(syncServerActions())
  }
})

async function syncServerActions() {
  try {
    // Get pending actions from IndexedDB or localStorage
    const pendingActions = await getPendingActions()
    
    for (const action of pendingActions) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        })
        
        // Remove successful action
        await removePendingAction(action.id)
        
        // Notify clients of success
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_SUCCESS',
              action: action
            })
          })
        })
        
      } catch (error) {
        console.error('[SW] Failed to sync action:', error)
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// Placeholder functions for action queue management
async function getPendingActions() {
  // Implement IndexedDB or localStorage retrieval
  return []
}

async function removePendingAction(actionId) {
  // Implement action removal
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received')
  
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Dashboard',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192x192.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('Pterodactyl Dashboard', options)
  )
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action)
  
  event.notification.close()
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        return cache.addAll(event.data.urls)
      })
    )
  }
})
