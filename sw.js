/* BYgf — Service worker: membuat aplikasi bisa dibuka offline (hanya cache aset; TANPA notifikasi push).
   Strategi: file aplikasi = jaringan dulu (selalu dapat versi terbaru saat online), cache sebagai cadangan offline.
   Data pengguna tidak disimpan di sini — tetap di localStorage + Firebase. Naikkan VERSION saat merilis agar cache lama dibersihkan. */
const VERSION = 'bygf-v9.10.1';
const PRECACHE = [
 "./",
 "css/auth.css",
 "css/bygf-modules.css",
 "css/bygf-shell.css",
 "css/bygf-themes.css",
 "css/components.css",
 "css/home-popups.css",
 "css/home.css",
 "css/kuliah.css",
 "css/modules.css",
 "css/reminder.css",
 "css/themes.css",
 "css/variables.css",
 "icons/apple-touch-icon.png",
 "icons/favicon-48.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "index.html",
 "js/app/auth.js",
 "js/app/backup.js",
 "js/app/config.js",
 "js/app/core.js",
 "js/app/db.js",
 "js/app/firebase.js",
 "js/app/guard.js",
 "js/app/handlers.js",
 "js/app/insights.js",
 "js/app/main.js",
 "js/app/notify.js",
 "js/app/premium.js",
 "js/app/pwa.js",
 "js/app/quick-scan.js",
 "js/app/quick-template.js",
 "js/app/state.js",
 "js/app/theme.js",
 "js/app/ui.js",
 "js/app/utils.js",
 "js/bottom-nav.js",
 "js/kuliah-pro.js",
 "js/modules/core.js",
 "js/modules/daily.js",
 "js/modules/goals.js",
 "js/modules/fun.js",
 "js/modules/home.js",
 "js/modules/journal.js",
 "js/modules/vault.js",
 "js/modules/lecture.js",
 "js/modules/meal.js",
 "js/modules/notes.js",
 "js/modules/search.js",
 "js/notify-queue.js",
 "js/side-nav.js",
 "js/tugas-reminder.js",
 "manifest.json"
];
const CDN_HOSTS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(VERSION).then(c => Promise.all(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bygf-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request; if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin === location.origin) { // file aplikasi: jaringan dulu
        e.respondWith(fetch(req).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })
            .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html').then(x => x || caches.match('./')) : Response.error()))));
        return;
    }
    if (url.hostname === 'www.google.com' && url.pathname.startsWith('/s2/favicons')) { // logo situs (Brankas): cache dulu agar tetap tampil saat offline
        e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const co = res.clone(); caches.open(VERSION).then(c => c.put(req, co)); } return res; })));
        return;
    }
    if (CDN_HOSTS.includes(url.hostname)) { // pustaka/font CDN: cache dulu, perbarui di belakang
        e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit); return hit || net; }));
    }
    // selain itu (Firebase/API) dibiarkan langsung ke jaringan
});
