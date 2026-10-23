// Çevrimdışı kabuk: her zaman önce sunucudan en yeni sürümü ister, internet yoksa son sürümü gösterir.
const C = 'ertel-toptan-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((r) => { if (r.ok && (e.request.mode === 'navigate' || /\.(js|png|webmanifest)$/.test(u.pathname))) { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request.mode === 'navigate' ? '/index.html' : e.request, cp)); } return r; })
      .catch(() => caches.match(e.request.mode === 'navigate' ? '/index.html' : e.request))
  );
});
