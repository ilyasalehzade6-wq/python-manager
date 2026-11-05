
const CACHE_NAME = 'pulse-portal-v' + Date.now();
const STATIC_ASSETS = ['./', './index.html', './dashboard.html', './css/style.css', './css/dashboard.css', './js/license-utils.js', './js/config.js', './js/auth.js', './js/dashboard.js', './manifest.json'];

self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (url.hostname.includes('supabase') || url.hostname.includes('jsdelivr') || url.hostname.includes('cdn')) return;

    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(fetch(event.request).then(response => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return response;
        }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html'))));
        return;
    }

    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
    })));
});
