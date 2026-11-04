/**
 * TaskFlow — Service Worker (PWA Phase 2)
 * Versioned Cache, Network-First for App Code (HTML/CSS/JS), Cache-First for Icons
 */

const CACHE_VERSION = 'taskflow-cache-v3';

const CORE_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/config.js',
    './js/app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    './icons/icon.svg'
];

// Install: Pre-cache core application shell assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .catch((err) => {
                // Never hang installation if a non-critical asset fails to cache
                console.warn('[SW] Pre-cache warning:', err);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: Clean up old cache versions and claim clients immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('taskflow-cache-') && key !== CACHE_VERSION)
                    .map((oldKey) => caches.delete(oldKey))
            ))
            .then(() => self.clients.claim())
    );
});

// Helper: Check if request is a same-origin static asset we should manage
function isCacheableSameOriginRequest(request, url) {
    if (request.method !== 'GET') return false;
    if (url.origin !== self.location.origin) return false;

    // Never cache test/diagnostic endpoints or API calls
    if (url.pathname.startsWith('/__') || url.pathname.startsWith('/api/')) {
        return false;
    }
    return true;
}

// Fetch: Network-First for HTML/CSS/JS/Manifest (so deployments update immediately),
// with instant fallback to Cache when offline. Cache-First for icons.
self.addEventListener('fetch', (event) => {
    const request = event.request;
    let url;
    try {
        url = new URL(request.url);
    } catch (_) {
        return;
    }

    if (!isCacheableSameOriginRequest(request, url)) {
        return;
    }

    const isNavigation = request.mode === 'navigate' || request.destination === 'document';
    const isIcon = url.pathname.includes('/icons/');

    if (isIcon) {
        // Cache-First for icons
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request)
                    .then((networkResp) => {
                        if (networkResp && networkResp.status === 200) {
                            const clone = networkResp.clone();
                            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone)).catch(() => {});
                        }
                        return networkResp;
                    })
                    .catch(() => caches.match('./icons/icon-192.png'));
            })
        );
        return;
    }

    // Network-First for HTML, CSS, JS, and Manifest so new deployments are never stuck on stale code
    event.respondWith(
        fetch(request)
            .then((networkResp) => {
                if (networkResp && networkResp.status === 200 && networkResp.type === 'basic') {
                    const clone = networkResp.clone();
                    caches.open(CACHE_VERSION)
                        .then((cache) => {
                            cache.put(request, clone);
                            if (isNavigation) {
                                cache.put('./index.html', networkResp.clone());
                            }
                        })
                        .catch(() => {});
                }
                return networkResp;
            })
            .catch(() => {
                return caches.match(request, { ignoreSearch: true }).then((cached) => {
                    if (cached) return cached;
                    if (isNavigation) {
                        return caches.match('./index.html');
                    }
                    return new Response('Offline', {
                        status: 503,
                        statusText: 'Offline'
                    });
                });
            })
    );
});

// Notification click handler: Focus existing TaskFlow window or open a new one
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow('./');
            }
        })
    );
});

