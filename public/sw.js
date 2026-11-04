/* Jabr service worker: tətbiq qabığını keşləyir (offline açılış), Firebase sorğularına toxunmur. */
const VERSION = 'jabr-v3'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/offline.html']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // Səhifə naviqasiyası: əvvəl şəbəkə, alınmasa keşlənmiş qabıq / offline səhifəsi
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { caches.open(VERSION).then((c) => c.put('/index.html', r.clone())); return r })
      .catch(() => caches.match('/index.html').then((r) => r || caches.match('/offline.html'))))
    return
  }
  // Hash-li statik fayllar dəyişmir: əvvəl keş
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) } return r })))
  }
})
