// ERTEL B2B — site değişiklik bekçisi (Cloudflare Worker, dakikada bir)
// Sitenin ürün beslemesini okur, bir öncekiyle karşılaştırır. Ürün kalkmış/eklenmiş, ad/resim/marka değişmiş
// ya da bir ürünün fiyatı (kur değişiminden bağımsız olarak) değişmişse GitHub'daki "Siteyle eşitle" işini başlatır.
// Ağır iş (kataloğu güncellemek) GitHub'da yapılır; burada sadece hafif bir karşılaştırma var (ücretsiz planın 10 ms sınırı).

// Ayrıca küçük bir web adresi sunar (uygulama kullanır):
//   GET  /rate   Harem Altın dolar satış kuru  → { usd, src: 'harem', at }
//   POST /check  yönetim paneli açılınca: sitede değişiklik varsa hemen eşitler
//   POST /sync   yönetim panelindeki "Şimdi eşitle": siteyi hemen kontrol edip eşitlemeyi başlatır
//   POST /notify mağazada sipariş verilince: dükkan sahibine e-posta (FormSubmit) + WhatsApp (CallMeBot) bildirimi
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
      if (url.pathname === '/notify' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifyOrder(env, String(b.id || ''))); }
      if (url.pathname === '/notify-test' && req.method === 'POST') { if (await env.KV.get('ntest')) return json({ ok: false, error: 'Biraz bekleyip tekrar deneyin' }); await env.KV.put('ntest', '1', { expirationTtl: 120 }); return json(await notifySend(env, { subject: 'ERTEL GSM · bildirim denemesi', text: 'Bu bir deneme bildirimidir. Mağazadan sipariş gelince buna benzer bir mesaj alacaksınız.' })); }
      if (url.pathname === '/') return json({ ok: true, name: 'ertel-b2b-watch', notify: { email: !!env.NOTIFY_EMAIL, whatsapp: !!(env.NOTIFY_WA && env.CALLMEBOT_KEY) } });
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
    items.push({ id: field(e, 'id', 0), sig: field(e, 'title', 0) + '|' + field(e, 'image_link', 0) + '|' + field(e, 'brand', 0) + '|' + field(e, 'availability', 0), tl: (() => { const r = parseFloat(field(e, 'price', 0)) || 0, s = parseFloat(field(e, 'sale_price', 0)) || 0; return s > 0 && (!r || s < r) ? s : r; })() });
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

// ---- Sipariş bildirimi -----------------------------------------------------------------------------
// Uygulama siparişi kaydedince /notify'a sadece sipariş kimliğini yollar. Bilgiler Firestore'dan okunur (sahte bildirim gönderilemez),
// aynı sipariş için bir kez bildirilir. E-posta: FormSubmit (ilk seferde e-postadaki "Activate" ile onay ister). WhatsApp: CallMeBot.
const FS = 'https://firestore.googleapis.com/v1/projects/erteltoptan/databases/(default)/documents/';
function fsVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fsVal(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
  return null;
}
const money = (n, c = 'USD') => (c === 'USD' ? '$' : '') + Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + (c === 'USD' ? '' : ' ' + c);
async function notifyOrder(env, id) {
  if (!/^[\w-]{10,40}$/.test(id)) return { ok: false, error: 'kimlik' };
  if (await env.KV.get('n:' + id)) return { ok: true, already: true };
  const r = await fetch(FS + 'orders/' + id);
  if (!r.ok) return { ok: false, error: 'sipariş yok' };
  const doc = await r.json();
  const o = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fsVal(v)]));
  if (Date.now() - Date.parse(doc.createTime) > 30 * 60 * 1000) return { ok: false, error: 'eski sipariş' };
  await env.KV.put('n:' + id, '1', { expirationTtl: 60 * 60 * 24 * 30 });
  const tot = Object.entries(o.total || {}).map(([c, v]) => money(v, c)).join(' + ');
  const lines = (o.items || []).map((i) => `• ${i.qty} × ${i.n} (${i.k || ''}) ${i.price != null ? money(i.price, i.cur) : ''}`).join('\n');
  const deliv = o.delivery?.method === 'pickup' ? 'Dükkandan teslim' : 'Kargo' + (o.delivery?.addr ? ` · ${o.delivery.addr.district || ''} / ${o.delivery.addr.city || ''}` : '');
  const pay = { havale: 'Havale / EFT', card: 'Kredi kartı (link)', shop: 'Dükkanda ödeme' }[o.pay] || o.pay;
  const link = `https://erteltoptan.web.app/admin/s/${id}`;
  const text = `🛒 Yeni sipariş #${o.no}\n${o.contact?.name || ''} · ${o.contact?.phone || ''}\n${(o.items || []).length} ürün · ${tot}\n${deliv} · ${pay}${o.note ? '\nNot: ' + o.note : ''}\n\n${lines}\n\nPanelde aç: ${link}`;
  return notifySend(env, { subject: `Yeni sipariş #${o.no} · ${o.contact?.name || ''} · ${tot}`, text, short: `🛒 Yeni sipariş #${o.no}\n${o.contact?.name || ''} · ${(o.items || []).length} ürün · ${tot}\n${deliv}\nPanelde aç: ${link}`, replyTo: o.contact?.email });
}
async function notifySend(env, { subject, text, short, replyTo }) {
  const out = {};
  if (env.NOTIFY_EMAIL) {
    try {
      const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(env.NOTIFY_EMAIL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://erteltoptan.web.app', Referer: 'https://erteltoptan.web.app/' },
        body: JSON.stringify({ _subject: subject, _template: 'box', _captcha: 'false', ...(replyTo ? { _replyto: replyTo } : {}), Mesaj: text }),
      });
      out.email = (await r.text()).slice(0, 300);
    } catch (e) { out.email = 'hata: ' + e; }
  }
  if (env.NOTIFY_WA && env.CALLMEBOT_KEY) {
    try {
      const u = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(env.NOTIFY_WA)}&apikey=${encodeURIComponent(env.CALLMEBOT_KEY)}&text=${encodeURIComponent((short || text).slice(0, 1200))}`;
      const r = await fetch(u); out.whatsapp = r.status + ' ' + (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
    } catch (e) { out.whatsapp = 'hata: ' + e; }
  } else out.whatsapp = 'CALLMEBOT_KEY eklenmemiş';
  return { ok: true, ...out };
}
