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
