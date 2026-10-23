// ERTEL B2B — site değişiklik bekçisi (Cloudflare Worker, dakikada bir)
// Sitenin ürün beslemesini okur, bir öncekiyle karşılaştırır. Ürün kalkmış/eklenmiş, ad/resim/marka değişmiş
// ya da bir ürünün fiyatı (kur değişiminden bağımsız olarak) değişmişse GitHub'daki "Siteyle eşitle" işini başlatır.
// Ağır iş (kataloğu güncellemek) GitHub'da yapılır; burada sadece hafif bir karşılaştırma var (ücretsiz planın 10 ms sınırı).

// Ayrıca küçük bir web adresi sunar (uygulama kullanır):
//   GET  /rate   Harem Altın dolar satış kuru  → { usd, src: 'harem', at }
//   POST /check  yönetim paneli açılınca: sitede değişiklik varsa hemen eşitler
//   POST /sync   yönetim panelindeki "Şimdi eşitle": siteyi hemen kontrol edip eşitlemeyi başlatır
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(check(env)); },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    const json = (o, st = 200, extra = {}) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...extra } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    try {
      if (url.pathname === '/rate' && url.searchParams.has('debug')) { const d = await haremDebug(); return json(d); }
      if (url.pathname === '/rate') {
        const r = await haremRate();
        return r ? json(r, 200, { 'Cache-Control': 'public, max-age=30' }) : json({ error: 'kur alınamadı' }, 502);
      }
      // Ürün resimleri için aracı: site CDN'i başka siteden resim okumaya izin vermediği için liste resmini çizerken buradan alınır
      if (url.pathname === '/img') {
        const u = url.searchParams.get('u') || '';
        if (!/^https:\/\/platincdn\.com\/3519\//.test(u)) return json({ error: 'izin yok' }, 400);
        const r = await fetch(u, { cf: { cacheTtl: 86400, cacheEverything: true } });
        if (!r.ok) return new Response(null, { status: r.status, headers: cors });
        return new Response(r.body, { headers: { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=604800', ...cors } });
      }
      if (url.pathname === '/check' && req.method === 'POST') return json({ result: await check(env) }); // sadece değişiklik varsa eşitler
      if (url.pathname === '/sync' && req.method === 'POST') return json({ result: await check(env, { force: true }) });
      if (url.pathname === '/') return json({ ok: true, name: 'ertel-b2b-watch' });
    } catch (e) { return json({ error: String(e.message || e) }, 500); }
    return json({ error: 'bulunamadı' }, 404);
  },
};

async function haremDebug() {
  try { const d = await haremSocketOnce(9000); return { ok: true, keys: Object.keys(d || {}).slice(0, 10), usd: d?.data?.USDTRY || d?.USDTRY || null }; }
  catch (e) { return { ok: false, err: String(e.message || e) }; }
}

// Harem Altın: canlı fiyat sayfası (canlipiyasalar.haremaltin.com) fiyatları Socket.IO ile yayınlıyor;
// aynı yayına bağlanıp ilk "price_changed" mesajındaki USDTRY satış fiyatını alıyoruz.
// Harem'e yük olmasın diye sonuç ~45 sn bellekte tutulur.
let rateCache = null;
export async function haremRate() {
  if (rateCache && Date.now() - rateCache.fetched < 45000) return rateCache.r;
  try {
    const data = await haremSocketOnce(9000);
    const u = data?.data?.USDTRY || data?.USDTRY;
    const usd = parseFloat(String(u?.satis ?? '').replace(',', '.'));
    if (usd > 1) {
      const r = { usd, alis: parseFloat(String(u.alis ?? '').replace(',', '.')) || null, src: 'harem', at: Date.now(), t: u.tarih || null };
      rateCache = { r, fetched: Date.now() };
      return r;
    }
  } catch (e) { console.log('harem', String(e)); }
  return rateCache?.r || null;
}

function haremSocketOnce(ms) {
  return new Promise(async (resolve, reject) => {
    let ws; const timer = setTimeout(() => { try { ws?.close(); } catch {} reject(new Error('zaman aşımı')); }, ms);
    try {
      const res = await fetch('https://hrmsocketonly.haremaltin.com/socket.io/?EIO=4&transport=websocket', {
        headers: { Upgrade: 'websocket', Origin: 'https://canlipiyasalar.haremaltin.com', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
      });
      ws = res.webSocket;
      if (!ws) throw new Error('websocket açılamadı: HTTP ' + res.status);
      ws.accept();
      ws.addEventListener('message', (ev) => {
        const m = typeof ev.data === 'string' ? ev.data : '';
        if (m.startsWith('0')) ws.send('40'); // Engine.IO açıldı → Socket.IO ana kanala bağlan
        else if (m === '2') ws.send('3'); // ping → pong
        else if (m.startsWith('42')) {
          try {
            const [ev2, payload] = JSON.parse(m.slice(2));
            if (ev2 === 'price_changed') { clearTimeout(timer); try { ws.close(1000); } catch {} resolve(payload); }
          } catch {}
        }
      });
      ws.addEventListener('close', () => { clearTimeout(timer); reject(new Error('bağlantı kapandı')); });
    } catch (e) { clearTimeout(timer); reject(e); }
  });
}

function field(s, tag, from) {
  const a = s.indexOf('<g:' + tag + '>', from);
  if (a < 0) return '';
  const b = s.indexOf('</g:' + tag + '>', a);
  return s.slice(a + tag.length + 4, b);
}

export function parseFeed(xml) {
  const items = [];
  let i = xml.indexOf('<entry>');
  while (i >= 0) {
    const j = xml.indexOf('</entry>', i);
    const e = xml.slice(i, j);
    items.push({ id: field(e, 'id', 0), sig: field(e, 'title', 0) + '|' + field(e, 'image_link', 0) + '|' + field(e, 'brand', 0) + '|' + field(e, 'availability', 0), tl: parseFloat(field(e, 'price', 0)) || 0 });
    i = xml.indexOf('<entry>', j);
  }
  return items;
}

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Fiyatlar TL geldiği için kur değişince hepsi aynı oranda değişir; bu "değişiklik" sayılmaz.
export function priceChanged(prev, items) {
  if (!prev) return true;
  const ratios = [];
  for (const it of items) { const p = prev[it.id]; if (p > 0 && it.tl > 0) ratios.push(it.tl / p); }
  if (!ratios.length) return true;
  ratios.sort((a, b) => a - b);
  const k = ratios[Math.floor(ratios.length / 2)];
  for (const it of items) { const p = prev[it.id]; if (p > 0 && Math.abs(it.tl / p - k) > k * 0.003) return true; }
  return false;
}

export async function check(env, { force = false } = {}) {
  const res = await fetch(env.FEED_URL + '?t=' + Date.now(), { headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'ERTEL-B2B-watch/1.0' }, cf: { cacheTtl: 0 } });
  if (!res.ok) return 'feed ' + res.status;
  const items = parseFeed(await res.text());
  if (items.length < 100) return 'too few';
  const sig = await sha(items.map((x) => x.id + '|' + x.sig).join('\n'));
  const prices = {}; for (const x of items) prices[x.id] = x.tl;
  const [lastSig, lastPrices] = await Promise.all([env.KV.get('sig'), env.KV.get('prices', 'json')]);
  const changed = force || sig !== lastSig || priceChanged(lastPrices, items);
  if (!changed) {
    // sadece kur değiştiyse yeni fiyatları sessizce sakla
    if (lastPrices && items.some((x) => lastPrices[x.id] !== x.tl)) await env.KV.put('prices', JSON.stringify(prices));
    return 'same';
  }
  const last = Number(await env.KV.get('lastDispatch')) || 0;
  if (Date.now() - last < (force ? 45 : 120) * 1000) return 'throttled'; // GitHub'ı sık sık tetikleme (elle: 45 sn, otomatik: 2 dk)
  const gh = await fetch(`https://api.github.com/repos/${env.REPO}/actions/workflows/sync.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'ertel-b2b-watch', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main' }),
  });
  if (gh.status !== 204) return 'github ' + gh.status;
  await Promise.all([env.KV.put('sig', sig), env.KV.put('prices', JSON.stringify(prices)), env.KV.put('lastDispatch', String(Date.now()))]);
  return 'dispatched';
}
