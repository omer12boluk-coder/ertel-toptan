// Çevrimdışı kabuk: önce sunucudan en yeni sürümü ister; ağ 6 sn içinde cevap vermezse ya da internet yoksa
// kayıtlı son sürümü gösterir (WhatsApp'tan açılan linklerin sonsuza kadar dönmemesi için).
const C = 'ertel-toptan-v4';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const key = e.request.mode === 'navigate' ? '/index.html' : e.request;
  const keep = e.request.mode === 'navigate' || /\.(js|png|webmanifest)$/.test(u.pathname);
  const net = fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok && keep) { const cp = r.clone(); e.waitUntil(caches.open(C).then((c) => c.put(key, cp))); }
    return r;
  });
  const cached = () => caches.match(key);
  e.respondWith(
    Promise.race([net, new Promise((res) => setTimeout(() => res(null), 6000))])
      .then(async (r) => r || (await cached()) || net)
      .catch(async () => (await cached()) || Response.error())
  );
});

// Sipariş durumu bildirimi (bekçiden şifreli gelir): başlık, metin, tıklanınca açılacak sayfa
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ERTEL GSM', { body: d.body || '', icon: d.icon || '/icon-192.png', badge: '/icon-192.png', tag: d.tag, renotify: true, data: { url: d.url || '/magaza' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const u0 = new URL(e.notification.data?.url || '/', self.location.origin); u0.searchParams.set('n', '1'); // bildirimden açıldı: uygulama 'kaldığı yer'e atlamasın
  const url = u0.href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if (c.url.startsWith(self.location.origin) && 'navigate' in c) return c.focus().then(() => c.navigate(url));
    return self.clients.openWindow(url);
  }));
});
