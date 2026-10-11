/**
 * 🛠️ Service Worker — پالس مدیریت
 */
const CACHE_NAME = 'pulse-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/dashboard.css',
    './js/license-utils.js',
    './js/config.js',
    './js/dashboard.js',
    './js/members.js',
    './js/attendance.js',
    './js/finance.js',
    './js/reports.js',
    './js/settings.js',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
];

// ─── Install ───
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.warn('[SW] Some assets failed:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

// ─── Activate ───
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

// ─── Fetch ───
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Supabase و CDN → network only
    if (url.hostname.includes('supabase') ||
        url.hostname.includes('jsdelivr') ||
        url.hostname.includes('cdn')) {
        return;
    }

    // صفحه‌های HTML → network first
    if (event.request.mode === 'navigate' ||
        event.request.destination === 'document') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request)
                    .then(r => r || caches.match('./index.html')))
        );
        return;
    }

    // بقیه → cache first
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }))
    );
});

// ─── Push Notifications (اختیاری) ───
self.addEventListener('push', event => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'پیام جدید',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        dir: 'rtl',
        lang: 'fa',
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'پالس مدیریت', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
