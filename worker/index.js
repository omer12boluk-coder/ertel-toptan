// ERTEL B2B — site değişiklik bekçisi (Cloudflare Worker, dakikada bir)
// Sitenin ürün beslemesini okur, bir öncekiyle karşılaştırır. Ürün kalkmış/eklenmiş, ad/resim/marka değişmiş
// ya da bir ürünün fiyatı (kur değişiminden bağımsız olarak) değişmişse GitHub'daki "Siteyle eşitle" işini başlatır.
// Ağır iş (kataloğu güncellemek) GitHub'da yapılır; burada sadece hafif bir karşılaştırma var (ücretsiz planın 10 ms sınırı).

// Ayrıca küçük bir web adresi sunar (uygulama kullanır):
//   GET  /rate   Harem Altın dolar satış kuru  → { usd, src: 'harem', at }
//   POST /check  yönetim paneli açılınca: sitede değişiklik varsa hemen eşitler
//   POST /sync   yönetim panelindeki "Şimdi eşitle": siteyi hemen kontrol edip eşitlemeyi başlatır
//   POST /notify mağazada sipariş verilince: dükkan sahibine Telegram + e-posta (Resend) bildirimi
//   GET  /push/key, POST /push/sub {id, sub}, POST /push/status {id}  müşteriye sipariş durumu bildirimi (web push)
//   POST /tg-link {code} Telegram botuna yazılan kodu bulup o sohbeti bildirim alıcısı yapar (sadece ilk bağlantı)
// Ücretsiz KV günde 1.000 yazma: dolarsa put/delete HATA ATAR → sipariş, bildirim vb. dursun istemeyiz.
// Yazma hatası günlüğe düşer, iş devam eder (okumalar dokunulmadan; ör. vapid anahtarı okunamazsa yeniden üretilmesin).
function safeEnv(env) {
  if (!env.KV || env.KV.__safe) return env;
  const kv = env.KV;
  const KV = { __safe: true, get: (...a) => kv.get(...a), list: (...a) => kv.list(...a), getWithMetadata: (...a) => kv.getWithMetadata(...a),
    put: (...a) => kv.put(...a).catch((e) => console.log('KV yazma atlandı', a[0], String(e.message || e))),
    delete: (...a) => kv.delete(...a).catch((e) => console.log('KV silme atlandı', a[0], String(e.message || e))) };
  return { ...env, KV };
}
export default {
  async scheduled(event, env, ctx) {
    env = safeEnv(env);
    ctx.waitUntil(check(env)); ctx.waitUntil(dhlWatch(env).catch((e) => console.log('dhlWatch', e.message)));
    // ürün talebi fotoğrafları: saatte bir, süresi dolanlar (Ayarlar > Ürün talebi > gün) silinir
    if (new Date(event.scheduledTime || Date.now()).getUTCMinutes() === 17) ctx.waitUntil(preqSweep(env).catch((e) => console.log('preqSweep', e.message)));
    if (new Date(event.scheduledTime || Date.now()).getUTCMinutes() === 37) ctx.waitUntil(issueSweep(env).catch((e) => console.log('issueSweep', e.message)));
  },
  async fetch(req, env, ctx) {
    env = safeEnv(env);
    const url = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hash' };
    const json = (o, st = 200, extra = {}) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...extra } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    try {
      if (url.pathname === '/rate' && url.searchParams.has('debug')) { const d = await haremDebug(); return json(d); }
      if (url.pathname === '/rate') {
        const r = await haremRate();
        return r ? json(r, 200, { 'Cache-Control': 'public, max-age=30' }) : json({ error: 'kur alınamadı' }, 502);
      }
      // Yönetici resim yükleme (Ürünü düzenle > +) ve yüklenen / kopyalanan resimleri gösterme (Cloudflare R2 deposu)
      if (url.pathname === '/up' && req.method === 'POST') return json(await upImage(req, env));
      if (url.pathname === '/upv' && req.method === 'POST') return json(await upVideo(req, env));
      if (url.pathname === '/up/has' && req.method === 'GET') return json(await upHas(env, url));
      if (url.pathname === '/up/list' && req.method === 'GET') return json(await upList(req, env, url));
      if (url.pathname.startsWith('/p/') && (req.method === 'GET' || req.method === 'HEAD')) return await servePic(req, env, url, ctx, cors);
      // Ürün talebi (mağaza üyesi fotoğraf + açıklama): yükleme (kotalı), silme (fotoğraflar da), yeni talep / yanıt bildirimi
      if (url.pathname === '/preq/up' && req.method === 'POST') return json(await preqUp(req, env));
      if (url.pathname === '/preq/del' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await preqDel(req, env, b)); }
      if (url.pathname === '/preq/new' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await preqNew(req, env, b, url.origin)); }
      if (url.pathname === '/preq/reply' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await preqReply(req, env, b)); }
      // Sorun bildirimi (mağaza üyesi: fotoğraf / video + açıklama; yönetici durum + açıklama + fotoğrafla yanıtlar)
      if (url.pathname === '/issue/up' && req.method === 'POST') return json(await issueUp(req, env));
      if (url.pathname === '/issue/aup' && req.method === 'POST') return json(await issueAdminUp(req, env));
      if (url.pathname === '/issue/del' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await issueDel(req, env, b)); }
      if (url.pathname === '/issue/new' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await issueNew(req, env, b, url.origin)); }
      if (url.pathname === '/issue/reply' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await issueReply(req, env, b)); }
      if (url.pathname === '/issue/msg' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await issueMsg(req, env, b)); }
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
      // Mağaza siparişi bekçiden geçer: fiyatlar kataloğdan yeniden hesaplanır, sipariş sunucu anahtarıyla yazılır (fiyat oynanamaz)
      if (url.pathname === '/order' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await placeOrder(req, env, b, ctx)); }
      if (url.pathname === '/notify' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifyOrder(env, String(b.id || ''))); }
      if (url.pathname === '/notify-test' && req.method === 'POST') { if (await env.KV.get('ntest')) return json({ ok: false, error: 'Biraz bekleyip tekrar deneyin' }); await env.KV.put('ntest', '1', { expirationTtl: 120 }); return json(await notifySend(env, { subject: 'ERTEL GSM · bildirim denemesi', text: 'Bu bir deneme bildirimidir. Mağazadan sipariş gelince buna benzer bir mesaj alacaksınız.' })); }
      if (url.pathname === '/tg-link' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await tgLink(env, String(b.code || ''))); }
      if (url.pathname === '/') return json({ ok: true, name: 'ertel-b2b-watch', notify: await notifyStatus(env) });
      // müşteriye sipariş durumu bildirimi (web push)
      if (url.pathname === '/push/key') return json({ key: (await vapidKeys(env)).pub });
      if (url.pathname === '/push/sub' && req.method === 'POST') { const b = await req.json().catch(() => ({})); const r = await pushSub(env, b); if (r.ok && b.hello && !(await env.KV.get('ph:' + b.id))) { await env.KV.put('ph:' + b.id, '1', { expirationTtl: 60 }); r.test = await pushStatus(env, String(b.id), true).catch((e) => ({ error: e.message })); } return json(r); }
      if (url.pathname === '/push/admin' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await adminSub(env, b)); }
      if (url.pathname === '/notify-cancel' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifyCancel(env, String(b.id || ''))); }
      if (url.pathname === '/notify-lcart' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifyLcart(env, String(b.id || ''))); }
      if (url.pathname === '/notify-req' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifyReq(env, b)); }
      if (url.pathname === '/push/fav' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await pushFav(env, req.headers.get('X-Key') || '', b)); }
      if (url.pathname === '/push/back-admin' && req.method === 'POST') { const err = await adminOf(req); if (err) return json({ ok: false, error: err }, 403); const b = await req.json().catch(() => ({})); return json(await sendBack(env, b)); }
      if (url.pathname === '/push/back' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await pushBack(env, req.headers.get('X-Key') || '', b)); }
      if (url.pathname === '/rev/new' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await revNew(req, env, b)); }
      if (url.pathname === '/push/member' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await pushMember(env, b)); }
      if (url.pathname === '/notify-usage' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifyUsage(env, req.headers.get('X-Key') || '', b)); }
      if (url.pathname === '/notify-sync' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifySync(env, req.headers.get('X-Key') || '', b)); }
      if (url.pathname.startsWith('/dhl/') && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await dhl(env, url.pathname.slice(5), b)); }
      if (url.pathname === '/push/status' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await pushStatus(env, String(b.id || ''))); }
      // Ürün videosu: iPhone Safari videoyu parça parça (Range) ister; dosya bekçinin kendi dosyalarından okunup dilimlenir
      if (url.pathname.startsWith('/v/') && (req.method === 'GET' || req.method === 'HEAD') && env.ASSETS) return await serveVideo(req, env, url, cors);
      // R2 videoları: bazı Türk internet sağlayıcıları r2.dev adresini engelliyor; video bekçi üzerinden (Cloudflare içinden) parça parça aktarılır
      if (url.pathname.startsWith('/r2/') && (req.method === 'GET' || req.method === 'HEAD')) return await proxyR2(req, url, cors);
      if (url.pathname.startsWith('/r2obj/')) return await r2Obj(req, env, url);
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
    // sadece kur değiştiyse yeni fiyatları sessizce sakla — en çok 3 saatte bir (30.10.2026: yarım saat → 3 saat) (ücretsiz KV: günde 1.000 yazma;
    // TL fiyatlar kurla her dakika oynarsa her dakika yazıyordu). Karşılaştırma oran (medyan) ile yapıldığı için eski taban da yeter.
    if (lastPrices && Date.now() - (lastPrices._at || 0) > 180 * 60000 && items.some((x) => lastPrices[x.id] !== x.tl)) await env.KV.put('prices', JSON.stringify({ ...prices, _at: Date.now() }));
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
  await Promise.all([env.KV.put('sig', sig), env.KV.put('prices', JSON.stringify({ ...prices, _at: Date.now() })), env.KV.put('lastDispatch', String(Date.now()))]);
  return 'dispatched';
}

// ---- Sipariş bildirimi -----------------------------------------------------------------------------
// Uygulama siparişi kaydedince /notify'a sadece sipariş kimliğini yollar. Bilgiler Firestore'dan okunur (sahte bildirim gönderilemez),
// aynı sipariş için bir kez bildirilir. Kanallar: Telegram + e-posta (Resend), aşağıda.
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
async function notifyOrder(env, id, internal) {
  if (!/^[\w-]{10,40}$/.test(id)) return { ok: false, error: 'kimlik' };
  if (!internal && await env.KV.get('n:' + id)) return { ok: true, already: true };
  const r = await fetch(FS + 'orders/' + id);
  if (!r.ok) return { ok: false, error: 'sipariş yok' };
  const doc = await r.json();
  const o = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fsVal(v)]));
  if (Date.now() - Date.parse(doc.createTime) > 30 * 60 * 1000) return { ok: false, error: 'eski sipariş' };
  // bekçinin yazdığı sipariş (via 'srv') yazılır yazılmaz bildirildi: dışarıdan /notify ile tekrar bildirilemez, KV yazması da gerekmez
  if (!internal && o.via === 'srv') return { ok: true, already: true };
  if (!internal) await env.KV.put('n:' + id, '1', { expirationTtl: 60 * 60 * 24 * 30 });
  const tot = Object.entries(o.total || {}).map(([c, v]) => money(v, c)).join(' + ');
  const lines = (o.items || []).map((i) => `• ${i.qty} × ${i.n} (${i.k || ''}) ${i.price != null ? money(i.price, i.cur) : ''}`).join('\n');
  const deliv = o.delivery?.method === 'pickup' ? 'Dükkandan teslim' : 'Kargo' + (o.delivery?.addr ? ` · ${o.delivery.addr.district || ''} / ${o.delivery.addr.city || ''}` : '');
  const pay = { havale: 'Havale / EFT', card: 'Kredi kartı (link)', shop: 'Dükkanda ödeme' }[o.pay] || o.pay;
  const link = `https://ertelmarket.com/admin/s/${id}`;
  const text = `🛒 Yeni sipariş #${o.no}\n${o.contact?.name || ''} · ${o.contact?.phone || ''}\n${(o.items || []).length} ürün · ${tot}\n${deliv} · ${pay}${o.note ? '\nNot: ' + o.note : ''}\n\n${lines}\n\nPanelde aç: ${link}`;
  await adminPush(env, { title: `🛒 Yeni sipariş #${o.no} · ${tot}`, body: `${o.contact?.name || ''} · ${(o.items || []).length} ürün · ${deliv}`, url: '/admin/s/' + id, tag: 'ao-' + id }).catch(() => {});
  return notifySend(env, { subject: `Yeni sipariş #${o.no} · ${o.contact?.name || ''} · ${tot}`, text, link, short: `🛒 Yeni sipariş #${o.no}\n${o.contact?.name || ''} · ${(o.items || []).length} ürün · ${tot}\n${deliv}\nPanelde aç: ${link}`, replyTo: o.contact?.email });
}
// E-posta gövdesi: düz metin + belirgin "Panelde aç" düğmesi
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function mailHtml(subject, text, link) {
  const body = esc(text.replace(/\n*Panelde aç: \S+\s*$/, '')).replace(/\n/g, '<br>');
  const btn = link ? `<p style="margin:24px 0 8px"><a href="${esc(link)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Siparişi panelde aç</a></p><p style="color:#64748b;font-size:12px">Düğme açılmazsa: ${esc(link)}</p>` : '';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;max-width:560px"><h2 style="font-size:18px;margin:0 0 12px">${esc(subject)}</h2><div>${body}</div>${btn}<p style="color:#94a3b8;font-size:12px;margin-top:24px">ERTEL GSM · erteltoptan.web.app</p></div>`;
}
// ---- bildirim kanalları ----
// Telegram: TELEGRAM_TOKEN (BotFather) + KV 'tg-chat' (panelden kodla bağlanır)
// E-posta: RESEND_KEY varsa Resend (siparis@ertelmarket.com, olmazsa onboarding@resend.dev → hesap sahibinin e-postası), yoksa FormSubmit
const TG = (env, m) => 'https://api.telegram.org/bot' + env.TELEGRAM_TOKEN + '/' + m;
async function tgBot(env) {
  if (!env.TELEGRAM_TOKEN) return null;
  let u = await env.KV.get('tg-bot');
  if (!u) { const r = await fetch(TG(env, 'getMe')).then((x) => x.json()).catch(() => null); u = r?.result?.username || ''; if (u) await env.KV.put('tg-bot', u, { expirationTtl: 86400 }); }
  return u || null;
}
async function notifyStatus(env) {
  const chat = env.TELEGRAM_TOKEN ? JSON.parse((await env.KV.get('tg-chat')) || 'null') : null;
  return { email: !!(env.NOTIFY_EMAIL && env.RESEND_KEY), emailVia: env.RESEND_KEY ? 'resend' : 'formsubmit', telegram: !!env.TELEGRAM_TOKEN, telegramBot: await tgBot(env), telegramLinked: chat ? chat.name || true : false };
}
async function tgLink(env, code) {
  if (!env.TELEGRAM_TOKEN) return { ok: false, error: 'Telegram bot anahtarı (TELEGRAM_TOKEN) henüz eklenmemiş' };
  if (await env.KV.get('tg-chat')) return { ok: true, already: true };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Kod hatalı' };
  const r = await fetch(TG(env, 'getUpdates') + '?limit=100').then((x) => x.json()).catch(() => null);
  const m = (r?.result || []).map((u) => u.message).filter(Boolean).reverse().find((x) => (x.text || '').replace(/\D/g, '') === code && x.chat?.type === 'private');
  if (!m) {
    const msgs = (r?.result || []).map((u) => u.message).filter(Boolean);
    const last = msgs.length ? (msgs[msgs.length - 1].text || '(yazı değil)').slice(0, 40) : '';
    return { ok: false, error: r?.ok === false ? 'Telegram hatası: ' + (r.description || '') : msgs.length ? `Kod bulunamadı. Bota en son gelen mesaj: “${last}”. Bota sadece ${code} yazıp gönderin.` : `Bota hiç mesaj gelmemiş. Telegram’da botun sohbetine ${code} yazıp gönderin, sonra tekrar Bağla’ya basın.` };
  }
  const name = [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') || m.chat.username || 'Telegram';
  await env.KV.put('tg-chat', JSON.stringify({ id: m.chat.id, name }));
  await fetch(TG(env, 'sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: m.chat.id, text: '✅ Bağlandı. Yeni mağaza siparişleri buraya bildirilecek.' }) }).catch(() => {});
  return { ok: true, name };
}
async function notifySend(env, { subject, text, short, replyTo, link, noEmail, photo }) {
  const out = {};
  if (env.TELEGRAM_TOKEN) {
    const chat = JSON.parse((await env.KV.get('tg-chat')) || 'null');
    if (!chat) out.telegram = 'bağlanmamış';
    else try {
      // fotoğraflı bildirim (ürün talebi): önce resim + kısa yazı; olmazsa düz mesaj
      let j = null;
      if (photo) { const r = await fetch(TG(env, 'sendPhoto'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat.id, photo, caption: (subject + '\n\n' + text).slice(0, 1000) }) }); j = await r.json().catch(() => ({})); }
      if (!j?.ok) { const r = await fetch(TG(env, 'sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat.id, text: (subject + '\n\n' + text).slice(0, 4000), disable_web_page_preview: true }) }); j = await r.json().catch(() => ({})); if (!j.ok) j.description = j.description || r.status; }
      out.telegram = j.ok ? 'gönderildi' : 'hata: ' + j.description;
    } catch (e) { out.telegram = 'hata: ' + e; }
  } else out.telegram = 'TELEGRAM_TOKEN eklenmemiş';
  if (noEmail) out.email = 'yok';
  else if (env.NOTIFY_EMAIL && env.RESEND_KEY) {
    try {
      // Gönderen: kendi alan adımız (ertelmarket.com Resend'de doğrulandı → spam'e düşmez). Alan adı sorunu olursa eski adres.
      const send = (from) => fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [env.NOTIFY_EMAIL], subject, text, html: mailHtml(subject, text, link), ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
      let r = await send(env.MAIL_FROM || 'ERTEL GSM <siparis@ertelmarket.com>');
      if (!r.ok && (r.status === 403 || r.status === 422)) r = await send('ERTEL GSM <onboarding@resend.dev>');
      const j = await r.json().catch(() => ({})); out.email = r.ok ? 'gönderildi' : 'hata: ' + (j.message || r.status);
    } catch (e) { out.email = 'hata: ' + e; }
  } else if (env.NOTIFY_EMAIL) {
    try {
      const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(env.NOTIFY_EMAIL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://erteltoptan.web.app', Referer: 'https://erteltoptan.web.app/' },
        body: JSON.stringify({ _subject: subject, _template: 'box', _captcha: 'false', ...(replyTo ? { _replyto: replyTo } : {}), Mesaj: text }),
      });
      out.email = (await r.text()).slice(0, 300);
    } catch (e) { out.email = 'hata: ' + e; }
  }
  return { ok: true, ...out };
}

async function serveVideo(req, env, url, cors) {
  const name = url.pathname.slice(3);
  if (!/^[\w.-]+\.(mp4|webm|jpg|webp)$/.test(name)) return new Response('yok', { status: 404, headers: cors });
  const a = await env.ASSETS.fetch(new Request(new URL('/_m/' + name, url.origin)));
  if (!a.ok) return new Response('yok', { status: 404, headers: cors });
  const buf = await a.arrayBuffer();
  const size = buf.byteLength;
  const type = name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.webm') ? 'video/webm' : name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400', ...cors, 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges' };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('Range') || '');
  if (!m) return new Response(req.method === 'HEAD' ? null : buf, { headers: { ...base, 'Content-Length': String(size) } });
  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
  let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : size - 1;
  if (m[1] === '') end = size - 1;
  if (!(start >= 0) || start >= size || end < start) return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } });
  end = Math.min(end, size - 1);
  return new Response(req.method === 'HEAD' ? null : buf.slice(start, end + 1), { status: 206, headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
}

async function proxyR2(req, url, cors) {
  const m = /^\/r2\/([0-9a-f]{32})\/([\w.\-~%/]+)$/.exec(url.pathname);
  if (!m || m[2].includes('..')) return new Response('yok', { status: 404, headers: cors });
  const h = new Headers();
  const range = req.headers.get('Range'); if (range) h.set('Range', range);
  const r = await fetch(`https://pub-${m[1]}.r2.dev/${m[2]}`, { method: req.method, headers: h, cf: { cacheEverything: true, cacheTtl: 86400 } });
  const out = new Headers({ ...cors, 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges', 'Cache-Control': 'public, max-age=86400' });
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) { const v = r.headers.get(k); if (v) out.set(k, v); }
  if (!out.has('accept-ranges')) out.set('accept-ranges', 'bytes');
  return new Response(req.method === 'HEAD' ? null : r.body, { status: r.status, headers: out });
}

// ---- Müşteriye sipariş durumu bildirimi (Web Push) ------------------------------------------------------
// Müşteri sipariş sayfasında "Bildirimleri aç" deyince tarayıcı aboneliği /push/sub ile siparişe bağlanır (KV: ps:<siparişId>).
// Yönetici durumu değiştirince uygulama /push/status {id} çağırır; durum Firestore'dan okunur (sahte bildirim gönderilemez),
// aynı durum için bir kez gönderilir. iPhone'da (iOS 16.4+) site ana ekrana eklenince çalışır.
// Şifreleme: RFC 8291 (aes128gcm), kimlik: VAPID (RFC 8292). Anahtar çifti ilk istekte üretilip KV'de saklanır.
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const cat = (...a) => { const n = a.reduce((x, y) => x + y.length, 0); const o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const te = new TextEncoder();
async function vapidKeys(env) {
  let k = await env.KV.get('vapid', 'json');
  if (k) return k;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  k = { pub, jwk }; await env.KV.put('vapid', JSON.stringify(k));
  return k;
}
async function vapidAuth(env, endpoint) {
  const k = await vapidKeys(env);
  const aud = new URL(endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:' + (env.NOTIFY_EMAIL || 'omer.12boluk@gmail.com') })));
  const key = await crypto.subtle.importKey('jwk', k.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + c));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${k.pub}`;
}
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
export async function encryptPush(sub, payload) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, cat(te.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
async function pushOne(env, sub, data) {
  const body = await encryptPush(sub, JSON.stringify(data));
  const r = await fetch(sub.endpoint, { method: 'POST', body, headers: { Authorization: await vapidAuth(env, sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' } });
  return r.status;
}
const PUSH_TEXTS = { confirmed: 'Siparişiniz onaylandı.', preparing: 'Siparişiniz hazırlanıyor.', shipped: 'Siparişiniz kargoya verildi.', ready: 'Siparişiniz hazır, dükkândan teslim alabilirsiniz.', done: 'Siparişiniz teslim edildi. Teşekkür ederiz!', cancelled: 'Siparişiniz iptal edildi.' };
async function fsDoc(path) {
  const r = await fetch(FS + path); if (!r.ok) return null;
  const doc = await r.json(); return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fsVal(v)]));
}
// Aboneliği listeye ekle — SADECE değiştiyse yaz (ücretsiz KV günde 1.000 yazma; her sayfa açılışında her sipariş için
// yeniden yazmak 30.10.2026'da kotanın %90'ını doldurmuştu). Aynı cihaz zaten kayıtlıysa ve kaydı 20 günden yeniyse dokunulmaz.
async function addSub(env, key, me, max, ttl) {
  const list = (await env.KV.get(key, 'json')) || [];
  const old = list.find((x) => x.endpoint === me.endpoint);
  if (old && old.keys?.auth === me.keys.auth && old.keys?.p256dh === me.keys.p256dh && Date.now() - (old.t || 0) < 20 * 864e5) return false;
  await env.KV.put(key, JSON.stringify([{ ...me, t: Date.now() }, ...list.filter((x) => x.endpoint !== me.endpoint)].slice(0, max)), { expirationTtl: ttl });
  return true;
}
async function pushSub(env, b) {
  const id = String(b.id || ''); const s = b.sub || {};
  if (!/^[\w-]{10,40}$/.test(id) || !/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return { ok: false, error: 'eksik' };
  const o = await fsDoc('orders/' + id); if (!o) return { ok: false, error: 'sipariş yok' };
  const me = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  await addSub(env, 'ps:' + id, me, 5, 60 * 60 * 24 * 120);
  // üye siparişi: cihaz üyeye de bağlanır → üyenin SONRAKİ siparişlerinin bildirimleri de bu cihaza gelir
  // (siparişi Safari'den verip bildirimi ana ekran uygulamasında açan da haber alsın)
  if (o.uid && /^[\w-]{6,64}$/.test(o.uid)) {
    await addSub(env, 'pm:' + o.uid, me, 8, 60 * 60 * 24 * 365);
  }
  return { ok: true };
}
async function pushStatus(env, id, test) {
  if (!/^[\w-]{10,40}$/.test(id)) return { ok: false, error: 'kimlik' };
  const o = await fsDoc('orders/' + id); if (!o) return { ok: false, error: 'sipariş yok' };
  const own = (await env.KV.get('ps:' + id, 'json')) || [];
  const mem = o.uid ? (await env.KV.get('pm:' + o.uid, 'json')) || [] : [];
  const list = [...own, ...mem.filter((m) => !own.some((x) => x.endpoint === m.endpoint))];
  if (!list.length) return { ok: true, sent: 0, subs: 0 };
  const st = o.status || 'new';
  if (!test) {
    // kargoda: takip no sonradan eklenince / düzeltilince bir kez daha bildirilir (durum aynı kalsa da)
    const mark = st === 'shipped' ? 'shipped:' + (o.cargo?.code || '') : st;
    if (st === 'new' || (await env.KV.get('pl:' + id)) === mark) return { ok: true, sent: 0, same: true };
    await env.KV.put('pl:' + id, mark, { expirationTtl: 60 * 60 * 24 * 120 });
  }
  const pub = (await fsDoc('settings/public')) || {};
  const O = pub.orders || {};
  if (O.push === false && !test) return { ok: true, sent: 0, off: true };
  const shop = pub.brand?.appName || 'ERTEL GSM';
  const custom = O.pushTexts?.[st] === 'Siparişiniz onaylandı, hazırlanıyor.' ? '' : O.pushTexts?.[st]; // eski varsayılan metin ("hazırlanıyor" artık ayrı adım)
  let body = test ? 'Bildirimler açık. Siparişinizin durumu değişince buradan haber vereceğiz.' : (custom || PUSH_TEXTS[st] || 'Siparişinizin durumu güncellendi.');
  if (!test && st === 'shipped' && o.cargo?.code) body += ` ${o.cargo.company || 'Kargo'} takip no: ${o.cargo.code}`;
  // her durum ayrı etiket: aynı etiket iPhone'da öncekinin yerine SESSİZCE geçiyor, ekrana düşmüyordu (31.10.2026)
  const data = { title: `${shop} · Sipariş #${o.no}`, body, url: '/s/' + id, tag: 'o-' + id + '-' + (test ? 'test' : st === 'shipped' ? 'k' + (o.cargo?.code || '') : st) };
  const keep = []; let sent = 0; const codes = [];
  for (const s of list) { const code = await pushOne(env, s, data).catch(() => 0); codes.push(code); if (code >= 200 && code < 300) sent++; if (code !== 404 && code !== 410) keep.push(s); }
  if (keep.length !== list.length) {
    const ok = (x) => keep.some((k) => k.endpoint === x.endpoint);
    await env.KV.put('ps:' + id, JSON.stringify(own.filter(ok)), { expirationTtl: 60 * 60 * 24 * 120 });
    if (o.uid) await env.KV.put('pm:' + o.uid, JSON.stringify(mem.filter(ok)), { expirationTtl: 60 * 60 * 24 * 365 });
  }
  return { ok: true, sent, subs: list.length, codes };
}

// ---- Yönetici bildirimleri (web push): yeni sipariş, müşteri iptali, yeni bayi talebi / mesajı ----------------
// Abonelik: yönetici panelden açar; kimliği Firebase oturum anahtarıyla (ID token) Firestore'dan users/{uid}.role okunarak doğrulanır.
const tokUid = (t) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).user_id || ''; } catch { return ''; } };
async function fsAuth(path, tok) {
  const r = await fetch(FS + path, { headers: { Authorization: 'Bearer ' + tok } }); if (!r.ok) return null; // Firestore anahtarı kendisi doğrular
  const doc = await r.json(); return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fsVal(v)]));
}
async function adminSub(env, b) {
  const tok = String(b.token || ''); const uid = tokUid(tok); const s = b.sub || {};
  if (!uid || !/^https:\/\//.test(s.endpoint || '')) return { ok: false, error: 'eksik' };
  const u = await fsAuth('users/' + uid, tok);
  if (u?.role !== 'admin') return { ok: false, error: 'Yönetici oturumu doğrulanamadı' };
  const list = (await env.KV.get('ps-admin', 'json')) || [];
  const rest = list.filter((x) => x.endpoint !== s.endpoint);
  if (b.off) { await env.KV.put('ps-admin', JSON.stringify(rest)); return { ok: true, off: true }; }
  if (!s.keys?.p256dh || !s.keys?.auth) return { ok: false, error: 'eksik' };
  const sub = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  await addSub(env, 'ps-admin', sub, 10, 60 * 60 * 24 * 365);
  if (b.hello) await pushOne(env, sub, { title: 'ERTEL Yönetim', body: 'Bildirimler açık. Yeni sipariş, iptal ve bayi talepleri buraya gelecek.', url: '/admin', tag: 'a-hello', icon: '/icon-admin-192.png' }).catch(() => 0);
  return { ok: true };
}
async function adminPush(env, data) {
  const list = (await env.KV.get('ps-admin', 'json')) || [];
  if (!list.length) return 0;
  const keep = []; let sent = 0;
  for (const s of list) { const code = await pushOne(env, s, { icon: '/icon-admin-192.png', ...data }).catch(() => 0); if (code >= 200 && code < 300) sent++; if (code !== 404 && code !== 410) keep.push(s); }
  if (keep.length !== list.length) await env.KV.put('ps-admin', JSON.stringify(keep));
  return sent;
}
// Müşteri siparişini iptal edince (sipariş herkese açık okunur, durum gerçekten 'cancelled' mı bakılır)
async function notifyCancel(env, id) {
  if (!/^[\w-]{10,40}$/.test(id)) return { ok: false, error: 'kimlik' };
  if (await env.KV.get('nc:' + id)) return { ok: true, already: true };
  const o = await fsDoc('orders/' + id);
  if (!o || o.status !== 'cancelled') return { ok: false, error: 'iptal değil' };
  const last = (o.history || []).slice(-1)[0] || {};
  if (last.by !== 'customer') return { ok: true, skip: 'yönetici iptali' };
  await env.KV.put('nc:' + id, '1', { expirationTtl: 60 * 60 * 24 * 30 });
  const tot = Object.entries(o.total || {}).map(([c, v]) => money(v, c)).join(' + ');
  const link = `https://ertelmarket.com/admin/s/${id}`;
  const text = `❌ Müşteri siparişi iptal etti #${o.no}\n${o.contact?.name || ''} · ${o.contact?.phone || ''}\n${(o.items || []).length} ürün · ${tot}\n\nPanelde aç: ${link}`;
  await adminPush(env, { title: `❌ Sipariş iptal edildi #${o.no}`, body: `${o.contact?.name || ''} · ${tot} · müşteri iptal etti`, url: '/admin/s/' + id, tag: 'ao-' + id }).catch(() => {});
  return notifySend(env, { subject: `İptal: sipariş #${o.no} · ${o.contact?.name || ''} · ${tot}`, text, link, replyTo: o.contact?.email });
}
// Sepet linki onaylanınca (lcart.jsx): sepet herkese açık tek belge olarak okunur, durumu gerçekten 'sent' mi ve
// yeni mi (30 dk) bakılır → Telegram + e-posta + yönetici push, sepet başına bir kez (KV nl:, tek yazma).
async function notifyLcart(env, id) {
  if (!/^[\w-]{10,40}$/.test(id)) return { ok: false, error: 'kimlik' };
  if (await env.KV.get('nl:' + id)) return { ok: true, already: true };
  const r = await fetch(FS + 'lcarts/' + id);
  if (!r.ok) return { ok: false, error: 'sepet yok' };
  const doc = await r.json();
  const c = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fsVal(v)]));
  if (c.status !== 'sent' || !c.sub) return { ok: false, error: 'onaylanmamış' };
  if (Date.now() - Date.parse(doc.updateTime) > 30 * 60 * 1000) return { ok: false, error: 'eski' };
  await env.KV.put('nl:' + id, '1', { expirationTtl: 60 * 60 * 24 * 30 });
  const byId = new Map((c.items || []).map((i) => [i.id, i]));
  const its = (c.sub.items || []).map((x) => byId.get(x.id) && { ...byId.get(x.id), qty: x.qty }).filter(Boolean);
  const totBy = {}; for (const i of its) totBy[i.cur || 'USD'] = (totBy[i.cur || 'USD'] || 0) + (Number(i.price) || 0) * (Number(i.qty) || 0);
  const tot = Object.entries(totBy).map(([cu, v]) => money(v, cu)).join(' + ');
  const s = c.sub; const a = s.delivery?.addr;
  const deliv = s.delivery?.method === 'pickup' ? 'Dükkandan teslim' : 'Kargo' + (a ? ` · ${a.district || ''} / ${a.city || ''}` : '');
  const pay = { havale: 'Havale / EFT', card: 'Kredi kartı (link)', shop: 'Dükkanda ödeme' }[s.pay] || s.pay || '';
  const lines = its.map((i) => `• ${i.qty} × ${i.n} (${i.k || ''}) ${money(i.price, i.cur)}`).join('\n');
  const link = 'https://ertelmarket.com/admin/sepetler';
  const who = `${s.contact?.name || ''} · ${s.contact?.phone || ''}`;
  const text = `🔗 Sepet linki onaylandı #${c.no}${c.name ? ' (' + c.name + ')' : ''}\n${who}\n${its.length} ürün · ${tot}\n${deliv}${pay ? ' · ' + pay : ''}${s.note ? '\nNot: ' + s.note : ''}\n\n${lines}\n\nPanelde aç: ${link}`;
  await adminPush(env, { title: `🔗 Sepet linki onaylandı #${c.no} · ${tot}`, body: `${s.contact?.name || ''} · ${its.length} ürün · ${deliv}`, url: '/admin/sepetler', tag: 'al-' + id }).catch(() => {});
  return notifySend(env, { subject: `Sepet linki onaylandı #${c.no} · ${s.contact?.name || ''} · ${tot}`, text, link, short: `🔗 Sepet linki onaylandı #${c.no}\n${who}\n${its.length} ürün · ${tot}\n${link}` });
}
// Bayi yeni talep açınca / mesaj yazınca. Talep, bayinin kendi oturum anahtarıyla okunur (başkası adına bildirim yollanamaz).
const REQ_TYPE = { order: 'Bayi siparişi', reserve: 'Hazırlayın, geliyorum', quote: 'Fiyat sor', message: 'Mesaj' };
async function notifyReq(env, b) {
  const id = String(b.id || ''); const tok = String(b.token || ''); const uid = tokUid(tok);
  if (!/^[\w-]{10,40}$/.test(id) || !uid) return { ok: false, error: 'eksik' };
  const msg = !!b.msg; const key = (msg ? 'nm:' : 'nr:') + id;
  if (await env.KV.get(key)) return { ok: true, already: true };
  const r = await fsAuth('requests/' + id, tok);
  if (!r || r.uid !== uid) return { ok: false, error: 'talep yok' };
  await env.KV.put(key, '1', { expirationTtl: msg ? 120 : 60 * 60 * 24 * 30 }); // mesajlar 2 dakikada en çok bir bildirim
  const who = (r.userName || '') + (r.shop ? ` (${r.shop})` : '');
  const link = `https://ertelmarket.com/admin/t/${id}`;
  if (msg) { await adminPush(env, { title: `💬 ${who}`, body: String(r.lastMsg || 'Yeni mesaj').slice(0, 140), url: '/admin/t/' + id, tag: 'ar-' + id }); return { ok: true }; }
  const n = (r.items || []).length;
  const lines = (r.items || []).slice(0, 30).map((i) => `• ${i.qty || 1} × ${i.n || ''}${i.k ? ` (${i.k})` : ''}`).join('\n');
  const head = `${REQ_TYPE[r.type] || 'Talep'}${n ? ` · ${n} ürün` : ''}`;
  await adminPush(env, { title: `${r.type === 'order' ? '🛒 Yeni bayi siparişi' : '📨 Yeni talep'} #${r.no || ''} · ${who}`, body: (head + (r.note ? ' · ' + r.note : '')).slice(0, 160), url: '/admin/t/' + id, tag: 'ar-' + id }).catch(() => {});
  const text = `📨 Yeni bayi talebi #${r.no || ''}\n${who}\n${head}${r.pickup ? '\nGeliş: ' + r.pickup : ''}${r.note ? '\nNot: ' + r.note : ''}${lines ? '\n\n' + lines : ''}\n\nPanelde aç: ${link}`;
  return notifySend(env, { subject: `${r.type === 'order' ? 'Yeni bayi siparişi' : 'Yeni talep'} #${r.no || ''} · ${who}`, text, link });
}

// R2'ye yazma kapısı (resim taşıma işi, tools/r2-mirror.mjs): PUT/GET /r2obj/<anahtar>, başlık X-Key = sha256('r2:' + TELEGRAM_TOKEN).
// Sadece platin/ klasörü. Cloudflare REST API toplu yüklemede koruma sayfası (403) döndürdüğü için bekçinin kendi R2 bağlantısı kullanılır.
// POST /up (FormData big + th, Authorization: Bearer <Firebase oturum anahtarı>) → R2 up/<yıl+ay>/<rastgele>.<uzantı> (+ _t küçük resim)
async function adminOf(req) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''); const uid = tokUid(tok);
  if (!uid) return 'Oturum yok';
  const u = await fsAuth('users/' + uid, tok);
  return u?.role === 'admin' ? null : 'Yönetici oturumu doğrulanamadı';
}
// Dosyanın parmak izi (h, istemci hesaplar) varsa anahtar up/h/<h>.<uzantı>: aynı dosya ikinci kez yüklenmez
const hashKey = (h, ext) => (/^[0-9a-f]{16,64}$/.test(h || '') ? `up/h/${h}.${ext}` : null);
async function findByHash(env, h) {
  if (!/^[0-9a-f]{16,64}$/.test(h || '')) return null;
  const l = await env.R2.list({ prefix: `up/h/${h}.`, limit: 2 });
  return l.objects.find((o) => !o.key.includes('_t.'))?.key || null;
}
// GET /up/has?h=… → {key} (depoda varsa) · GET /up/list?cursor=… (yönetici) → yüklenen resim / videolar, yeni üstte
async function upHas(env, url) { return { ok: true, key: await findByHash(env, url.searchParams.get('h')) }; }
async function upList(req, env, url) {
  const err = await adminOf(req); if (err) return { ok: false, error: err };
  const l = await env.R2.list({ prefix: 'up/', limit: 1000, cursor: url.searchParams.get('cursor') || undefined, include: ['httpMetadata'] });
  const items = l.objects.filter((o) => !/_t\.\w+$/.test(o.key)).map((o) => ({ k: o.key, s: o.size, t: +new Date(o.uploaded), v: /^video\//.test(o.httpMetadata?.contentType || '') || /\.(mp4|webm|mov)$/i.test(o.key) }));
  items.sort((a, b) => b.t - a.t);
  return { ok: true, items, cursor: l.truncated ? l.cursor : null };
}
async function upImage(req, env) {
  if (!env.R2) return { ok: false, error: 'Depo bağlı değil' };
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''); const uid = tokUid(tok);
  if (!uid) return { ok: false, error: 'Oturum yok' };
  const u = await fsAuth('users/' + uid, tok);
  if (u?.role !== 'admin') return { ok: false, error: 'Yönetici oturumu doğrulanamadı' };
  const fd = await req.formData().catch(() => null); const big = fd?.get('big'), th = fd?.get('th');
  if (!big || typeof big === 'string') return { ok: false, error: 'Dosya yok' };
  if (big.size > 6e6 || (th && typeof th !== 'string' && th.size > 2e6)) return { ok: false, error: 'Dosya çok büyük' };
  const [type, ext] = big.type === 'image/jpeg' ? ['image/jpeg', 'jpg'] : big.type === 'image/png' ? ['image/png', 'png'] : ['image/webp', 'webp'];
  const h = String(fd.get('h') || ''); const old = await findByHash(env, h); if (old) return { ok: true, key: old, dup: true };
  const d = new Date(); const rnd = crypto.randomUUID().replace(/-/g, '').slice(0, 14);
  const key = hashKey(h, ext) || `up/${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}/${rnd}.${ext}`;
  const meta = { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } };
  const bigBuf = await big.arrayBuffer();
  await env.R2.put(key, bigBuf, meta);
  await env.R2.put(key.replace(/\.(\w+)$/, '_t.$1'), th && typeof th !== 'string' ? await th.arrayBuffer() : bigBuf, meta);
  return { ok: true, key };
}
// POST /upv (gövde = video dosyasının kendisi, en çok ~95 MB; ücretsiz planda istek sınırı 100 MB) → R2 up/<yıl+ay>/<rastgele>.<uzantı>
async function upVideo(req, env) {
  if (!env.R2) return { ok: false, error: 'Depo bağlı değil' };
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''); const uid = tokUid(tok);
  if (!uid) return { ok: false, error: 'Oturum yok' };
  const u = await fsAuth('users/' + uid, tok);
  if (u?.role !== 'admin') return { ok: false, error: 'Yönetici oturumu doğrulanamadı' };
  const type = (req.headers.get('Content-Type') || '').split(';')[0];
  const ext = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }[type];
  if (!ext) return { ok: false, error: 'Sadece MP4, WebM ya da MOV video' };
  const len = Number(req.headers.get('Content-Length') || 0);
  if (!len) return { ok: false, error: 'Dosya boyutu bilinmiyor' };
  if (len > 95e6) return { ok: false, error: 'Video 95 MB\'tan büyük olamaz' };
  const d = new Date(); const rnd = crypto.randomUUID().replace(/-/g, '').slice(0, 14);
  const h = req.headers.get('X-Hash') || ''; const old = await findByHash(env, h); if (old) return { ok: true, key: old, dup: true };
  const key = hashKey(h, ext) || `up/${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}/${rnd}.${ext}`;
  await env.R2.put(key, req.body, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  return { ok: true, key };
}
// GET /p/<anahtar>: depodaki resim (sadece up/ ve platin/), tarayıcıda 1 yıl önbellek
async function servePic(req, env, url, ctx, cors) {
  const key = decodeURIComponent(url.pathname.slice(3));
  if (!env.R2 || !/^(up|platin|pr|is)\//.test(key) || key.includes('_manifest') || key.split('/').some((x) => x === '..' || x === '.')) return new Response('yok', { status: 404, headers: cors });
  // ürün talebi fotoğrafı: silinebildiği için uzun önbellek yok (Cloudflare önbelleğine de konmaz)
  const tmp = /^(pr|is)\//.test(key);
  if (tmp && !/\.(mp4|webm|mov)$/i.test(key)) {
    const o = await env.R2.get(key);
    if (!o) return new Response('yok', { status: 404, headers: { ...cors, 'Cache-Control': 'no-store' } });
    return new Response(req.method === 'HEAD' ? null : o.body, { headers: { 'Content-Type': o.httpMetadata?.contentType || 'image/webp', 'Cache-Control': 'private, max-age=3600', ...cors } });
  }
  // video: iPhone parça parça ister (Range) → 206
  const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('Range') || '');
  if (rg || /\.(mp4|webm|mov)$/i.test(key)) {
    const head = await env.R2.head(key); if (!head) return new Response('yok', { status: 404, headers: cors });
    const size = head.size; let a = 0, b = size - 1;
    if (rg) { if (rg[1] === '') { a = Math.max(0, size - Number(rg[2])); } else { a = Number(rg[1]); if (rg[2] !== '') b = Math.min(size - 1, Number(rg[2])); } }
    if (a > b || a >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, ...cors } });
    const h = { 'Content-Type': head.httpMetadata?.contentType || 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(b - a + 1), 'Cache-Control': tmp ? 'private, max-age=3600' : 'public, max-age=31536000, immutable', ETag: head.httpEtag, 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges', ...cors };
    if (rg) h['Content-Range'] = `bytes ${a}-${b}/${size}`;
    if (req.method === 'HEAD') return new Response(null, { status: rg ? 206 : 200, headers: h });
    const o = await env.R2.get(key, { range: { offset: a, length: b - a + 1 } });
    return new Response(o.body, { status: rg ? 206 : 200, headers: h });
  }
  const ck = new Request(url.origin + url.pathname);
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch {}
  const o = await env.R2.get(key);
  if (!o) return new Response('yok', { status: 404, headers: { ...cors, 'Cache-Control': 'public, max-age=60' } });
  const r = new Response(req.method === 'HEAD' ? null : o.body, { headers: { 'Content-Type': o.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: o.httpEtag, ...cors } });
  if (req.method === 'GET') try { ctx.waitUntil(caches.default.put(ck, r.clone())); } catch {}
  return r;
}
async function r2Obj(req, env, url) {
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  if (!env.R2 || !env.TELEGRAM_TOKEN) return json({ ok: false, error: 'R2 bağlı değil' }, 500);
  const want = [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('r2:' + env.TELEGRAM_TOKEN)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  if ((req.headers.get('X-Key') || '') !== want) return json({ ok: false, error: 'yetki' }, 403);
  const key = decodeURIComponent(url.pathname.slice('/r2obj/'.length));
  if (!key.startsWith('platin/') || key.split('/').some((x) => x === '..' || x === '.')) return json({ ok: false, error: 'izin verilmeyen yol' }, 400);
  if (req.method === 'PUT') {
    await env.R2.put(key, req.body, { httpMetadata: { contentType: req.headers.get('Content-Type') || 'application/octet-stream', cacheControl: 'public, max-age=31536000, immutable' } });
    return json({ ok: true });
  }
  if (req.method === 'GET') { const o = await env.R2.get(key); return o ? new Response(o.body, { headers: { 'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream' } }) : json({ ok: false, error: 'yok' }, 404); }
  return json({ ok: false, error: 'yöntem' }, 405);
}

// Favorideki ürünün fiyatı düştü (eşitleme bildirir; anahtar sync ile aynı): üyenin cihazlarına (KV pm:<uid>) bildirim. Yükselişte gönderilmez.
async function pushFav(env, key, b) {
  if (!env.TELEGRAM_TOKEN) return { ok: false, error: 'anahtar yok' };
  const want = [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('sync:' + env.TELEGRAM_TOKEN)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (key !== want) return { ok: false, error: 'yetki' };
  const pub = (await fsDoc('settings/public')) || {};
  if (pub.orders?.push === false) return { ok: true, off: true };
  let sent = 0, users = 0;
  for (const { uid, items } of (Array.isArray(b.list) ? b.list : []).slice(0, 500)) {
    if (!/^[\w-]{6,64}$/.test(String(uid)) || !Array.isArray(items) || !items.length) continue;
    const subs = (await env.KV.get('pm:' + uid, 'json')) || []; if (!subs.length) continue; users++;
    const it = items[0]; const m = (v) => '$' + Number(v).toFixed(2).replace(/\.00$/, '');
    const data = items.length === 1
      ? { title: '💸 Favorinizdeki ürünün fiyatı düştü', body: `${it.n}: ${m(it.from)} → ${m(it.to)}`, url: '/urun/' + it.id, tag: 'fav-' + it.id }
      : { title: `💸 ${items.length} favori ürününüzün fiyatı düştü`, body: items.slice(0, 3).map((x) => `${String(x.n).slice(0, 40)}: ${m(x.to)}`).join(' · '), url: '/urunler', tag: 'fav' };
    const keep = [];
    for (const s of subs) { const code = await pushOne(env, s, data).catch(() => 0); if (code >= 200 && code < 300) sent++; if (code !== 404 && code !== 410) keep.push(s); }
    if (keep.length !== subs.length) await env.KV.put('pm:' + uid, JSON.stringify(keep), { expirationTtl: 60 * 60 * 24 * 365 });
  }
  return { ok: true, users, sent };
}
// Üye siparişi olmadan da telefon bildirimini açabilsin (favori fiyat düşüşü): oturum anahtarıyla members/{uid} okunur, cihaz pm:<uid>'e bağlanır
async function pushMember(env, b) {
  const tok = String(b.token || ''); const uid = tokUid(tok); const s = b.sub || {};
  if (!uid || !/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return { ok: false, error: 'eksik' };
  const m = await fsAuth('members/' + uid, tok); if (!m) return { ok: false, error: 'Üye doğrulanamadı' };
  const me = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  await addSub(env, 'pm:' + uid, me, 8, 60 * 60 * 24 * 365);
  return { ok: true };
}

// PlatinMarket eşitlemesinde değişen ürünler (GitHub Actions'taki eşitleme bildirir; anahtar: sha256('sync:' + TELEGRAM_TOKEN))
// Günlük kullanım raporu (tools/usage-report.mjs): sadece Telegram, aynı anahtarla
async function notifyUsage(env, key, b) {
  if (!env.TELEGRAM_TOKEN) return { ok: false, error: 'anahtar yok' };
  const want = [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('sync:' + env.TELEGRAM_TOKEN)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (key !== want) return { ok: false, error: 'yetki' };
  return notifySend(env, { subject: '📊 Günlük kullanım', text: String(b.text || '').slice(0, 3000), link: 'https://ertelmarket.com/admin/ayarlar', noEmail: true });
}
async function notifySync(env, key, b) {
  if (!env.TELEGRAM_TOKEN) return { ok: false, error: 'anahtar yok' };
  const want = [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('sync:' + env.TELEGRAM_TOKEN)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (key !== want) return { ok: false, error: 'yetki' };
  const items = Array.isArray(b.items) ? b.items : []; const n = Number(b.count) || items.length;
  if (!n) return { ok: true, sent: 0 };
  const c = (t) => items.filter((x) => x.t === t).length;
  const mw = items.filter((x) => x.t === 'price' && x.w != null).length;
  const parts = [[c('price'), 'fiyat değişti'], [mw, 'elle toptanlı ürün kontrol bekliyor'], [c('new'), 'yeni ürün'], [c('name'), 'adı değişti'], [c('hidden'), 'sitede pasife alındı'], [c('deleted'), 'siteden silindi'], [c('shown'), 'geri satışta']].filter(([x]) => x).map(([x, l]) => `${x} ${l}`).join(' · ');
  const line = (x) => x.t === 'price' ? `💲 ${x.k} ${x.n}: $${x.from} → $${x.to}${x.w != null ? ` · ⚠️ elle toptan $${x.w}, kontrol edin` : ''}` : x.t === 'new' ? `🆕 ${x.k} ${x.n}` : x.t === 'name' ? `✏️ ${x.k}: ${x.from} → ${x.n}` : x.t === 'hidden' ? `⏸️ pasif: ${x.k} ${x.n}` : x.t === 'deleted' ? `🗑️ silindi: ${x.k} ${x.n}` : `✅ ${x.k} ${x.n}`;
  const link = 'https://ertelmarket.com/admin';
  await adminPush(env, { title: `🔄 Siteden ${n} değişiklik`, body: parts || 'Ürün bilgileri güncellendi', url: '/admin', tag: 'sync' }).catch(() => {});
  const text = `${parts}\n\n${items.map(line).join('\n')}${n > items.length ? `\n… ve ${n - items.length} değişiklik daha` : ''}\n\nPanelde aç: ${link}`;
  return notifySend(env, { subject: `🔄 PlatinMarket: ${n} ürün değişikliği`, text, link, noEmail: true });
}

// ---- DHL eCommerce (eski MNG Kargo SOAP servisi) ----------------------------------------------------------------
// Sadece yönetici (Firebase oturum anahtarı → users/{uid}.role admin). Giriş: Worker gizli ayarları DHL_USER / DHL_PASS.
// create: siparişi DHL'e "sipariş" olarak kaydeder (SiparisGirisiDetayliV3) → online şubede Gönder > Toplu Gönderi Listesi'ne düşer.
//   Müşteri barkodu (pChBarkod) = referans. DHL'in kendi "Siparişten Gönderi Hazırlama Barkodu" kâğıdındaki büyük barkod da
//   tam bu değer (26.10.2026'da DHL çıktısı okutularak doğrulandı) → etiketi sitede biz basıyoruz, şube okutunca gönderi oluşur.
// track: KargoBilgileriByReferans → takip no (MNG_GONDERI_NO, şube okutunca dolar), durum, şube. cancel: MusteriSiparisIptal.
const DHL_URL = 'https://service.mngkargo.com.tr/musterikargosiparis/musterikargosiparis.asmx';
const xesc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
async function soap(env, op, inner) {
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${op} xmlns="http://tempuri.org/">${inner}</${op}></soap:Body></soap:Envelope>`;
  const r = await fetch(DHL_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"http://tempuri.org/${op}"` }, body, signal: AbortSignal.timeout(30000) });
  let t = await r.text(); if (env.DHL_PASS) t = t.split(env.DHL_PASS).join('***');
  const inside = (t.match(/<soap:Body>([\s\S]*)<\/soap:Body>/) || [, t])[1];
  const fault = (t.match(/<faultstring>([\s\S]*?)<\/faultstring>/) || [])[1];
  // şema (xs:schema) çok uzun; eskiden 6000 karakterde kesince asıl satır (Table1) kesilip takip no hiç okunamıyordu
  return { http: r.status, raw: inside.replace(/<xs:schema[\s\S]*?<\/xs:schema>/g, '').slice(0, 30000), fault };
}
const tagv = (x, t) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(x || ''); return m ? m[1] : ''; };
const kv = (o) => Object.entries(o).map(([k, v]) => `<${k}>${xesc(v)}</${k}>`).join('');
// KargoBilgileriByReferans cevabının ilk satırı → düz nesne
function dhlRow(raw) {
  const row = /<Table1\b[^>]*>([\s\S]*?)<\/Table1>/.exec(raw || ''); if (!row) return null;
  const o = {}; for (const m of row[1].matchAll(/<(\w+)[^>]*>([^<]*)<\/\1>/g)) o[m[1]] = m[2].trim();
  return o;
}
// --- Otomatik takip: DHL'e aktarılan referanslar KV'de bekler ('dhl-pend' {ref: {s: 'wait'|'ship', t}}).
// Bekçi 5 dakikada bir (TR 08-23) DHL'e sorar; takip no gelince ya da teslim edilince GitHub "DHL takip" işini
// tetikler — o iş siparişe takip no / durum yazar ve müşteriye bildirim gönderir (bekçinin Firestore'a yazma yetkisi yok).
async function dhlPend(env, ref, st) {
  const m = (await env.KV.get('dhl-pend', 'json')) || {};
  if (st === null) delete m[ref]; else m[ref] = { s: st || m[ref]?.s || 'wait', t: m[ref]?.t || Date.now() };
  await env.KV.put('dhl-pend', JSON.stringify(m));
}
async function dhlWatch(env) {
  if (!env.DHL_USER || !env.DHL_PASS) return;
  const now = new Date(); const h = (now.getUTCHours() + 3) % 24; const shipping = h >= 8 && h < 23;
  if (now.getUTCMinutes() % (shipping ? 5 : 30) !== 0) return;
  const m = (await env.KV.get('dhl-pend', 'json')) || {}; let need = false, dirty = false;
  for (const [ref, v] of Object.entries(m).slice(0, 30)) {
    if (Date.now() - v.t > 20 * 864e5) { delete m[ref]; dirty = true; continue; } // 20 günden eski: bırak
    if (v.s === 'ship' && now.getUTCMinutes() % 30 !== 0) continue; // yoldakini yarım saatte bir sor (teslim edildi mi)
    const x = await dhlInfo(env, ref).catch(() => null); if (!x?.found) continue;
    if (x.delivered) { delete m[ref]; dirty = need = true; }
    else if (x.code && v.s !== 'ship') { m[ref] = { ...v, s: 'ship' }; dirty = need = true; }
  }
  if (dirty) await env.KV.put('dhl-pend', JSON.stringify(m));
  if (need) await fetch(`https://api.github.com/repos/${env.REPO}/actions/workflows/dhl-track.yml/dispatches`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'ertel-b2b-watch', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main' }),
  });
}
async function dhlInfo(env, ref) {
  const r = await soap(env, 'KargoBilgileriByReferans', kv({ pMusteriNo: env.DHL_USER, pSifre: env.DHL_PASS, pSiparisNo: ref, pGonderiNo: '', pFaturaSeri: '', pFaturaNo: '', pIrsaliyeNo: '', pEFaturaNo: '', pRaporType: '' }));
  const x = dhlRow(r.raw);
  if (!x) return { ok: !r.fault, found: false, ref, fault: r.fault };
  return { ok: true, found: true, ref, code: x.MNG_GONDERI_NO || '', url: x.KARGO_TAKIP_URL || '', statu: x.KARGO_STATU || '', text: x.KARGO_STATU_ACIKLAMA || '', delivered: !!(x.TESLIM_TARIHI || /teslim edildi/i.test(x.KARGO_STATU_ACIKLAMA || '')), from: x.CIKIS_SUBESI || '', to: x.TESLIM_SUBESI || '', eta: x.TAHMINI_TESLIM_TARIHI || '', at: x.KARGO_STATU_TARIHI || '' };
}
async function dhl(env, act, b) {
  if (!env.DHL_USER || !env.DHL_PASS) return { ok: false, error: 'DHL giriş bilgileri bekçiye eklenmemiş (DHL_USER / DHL_PASS)' };
  const tok = String(b.token || ''); const uid = tokUid(tok);
  const u = uid && (await fsAuth('users/' + uid, tok));
  if (u?.role !== 'admin') return { ok: false, error: 'Yönetici oturumu doğrulanamadı' };
  if (act === 'sync') { // birkaç siparişin takip bilgisini birden sor (yönetim paneli açılınca)
    const refs = (Array.isArray(b.refs) ? b.refs : []).map(String).filter((r) => /^[\w-]{3,30}$/.test(r)).slice(0, 25);
    const out = {}; for (const r of refs) { out[r] = await dhlInfo(env, r).catch((e) => ({ ok: false, error: e.message })); if (out[r]?.found && !out[r].delivered) await dhlPend(env, r); }
    return { ok: true, items: out };
  }
  const id = String(b.id || ''); if (!/^[\w-]{10,40}$/.test(id)) return { ok: false, error: 'kimlik' };
  // sepet linki (lcarts) de aynı yoldan DHL'e aktarılır: müşterinin onayladığı adres/iletişim sipariş gibi okunur
  const lc = b.col === 'lcarts';
  let o;
  if (lc) { const c = await fsDoc('lcarts/' + id); if (!c || !c.sub) return { ok: false, error: 'sepet yok ya da onaylanmamış' }; o = { no: c.no, dhl: c.dhl, delivery: c.sub.delivery || {}, contact: c.sub.contact || {} }; }
  else o = await fsDoc('orders/' + id);
  if (!o) return { ok: false, error: 'sipariş yok' };
  const ref = String(o.dhl?.ref || b.ref || ((lc ? 'ERTELL' : 'ERTEL') + o.no)).replace(/[^\w-]/g, '').slice(0, 30); // DHL'deki sipariş (referans) no = müşteri barkodu
  const U = env.DHL_USER, P = env.DHL_PASS;
  if (act === 'create') {
    const a = o.delivery?.addr || {};
    const kg = Math.max(1, Math.round(Number(b.kg) || 1)), desi = Math.max(1, Math.round(Number(b.desi) || 1));
    const icerik = String(b.icerik || 'DOSYA / ZARF').replace(/[:;]/g, ' ').slice(0, 60);
    const phone = String(a.phone || o.contact?.phone || '').replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '');
    const fields = {
      pChIrsaliyeNo: '', pPrKiymet: '', pChBarkod: ref, pChIcerik: icerik,
      pGonderiHizmetSekli: 'NORMAL', pTeslimSekli: 1, pFlAlSms: 1, pFlGnSms: 0, // ZORUNLU: yoksa DHL 'Object reference not set' verir (26.10.2026)
      pKargoParcaList: `${kg}:${desi}:1:${icerik}:1:;`, pAliciMusteriMngNo: '', pAliciMusteriBayiNo: '', pAliciMusteriAdi: String(a.name || o.contact?.name || '').slice(0, 60), pChSiparisNo: ref,
      pLuOdemeSekli: b.pay === 'P' ? 'P' : 'U', pFlAdresFarkli: '1', pChIl: String(a.city || '').toLocaleUpperCase('tr-TR'), pChIlce: String(a.district || '').toLocaleUpperCase('tr-TR'),
      pChAdres: [a.hood, a.address].filter(Boolean).join(' ').slice(0, 250), pChSemt: '', pChMahalle: '', pChMeydanBulvar: '', pChCadde: '', pChSokak: '',
      pChTelEv: '', pChTelCep: phone, pChTelIs: '', pChFax: '', pChEmail: String(o.contact?.email || ''), pChVergiDairesi: '', pChVergiNumarasi: '',
      pFlKapidaOdeme: 0, pMalBedeliOdemeSekli: '', pPlatformKisaAdi: '', pPlatformSatisKodu: '', pKullaniciAdi: U, pSifre: P,
    };
    const r = await soap(env, 'SiparisGirisiDetayliV3', kv(fields));
    const res = tagv(r.raw, 'SiparisGirisiDetayliV3Result').trim();
    if (!r.fault && /^0*1$/.test(res)) { await dhlPend(env, ref); return { ok: true, ref, kg, desi, icerik }; }
    // aynı referans daha önce kaydedilmişse (ör. yarıda kalan deneme) DHL'de var mı bak
    const ex = await dhlInfo(env, ref).catch(() => null);
    if (ex?.found) { await dhlPend(env, ref); return { ok: true, ref, kg, desi, icerik, existed: true }; }
    return { ok: false, ref, error: r.fault || res || 'DHL kaydı kabul etmedi', raw: r.raw.slice(0, 1500) };
  }
  if (act === 'track') return dhlInfo(env, ref);
  if (act === 'cancel') {
    const d = new Date(o.dhl?.at || Date.now()); const tarih = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    const r = await soap(env, 'MusteriSiparisIptal', kv({ pKullaniciAdi: U, pSifre: P, pMusteriSiparisNo: ref, pSiparisTarihi: tarih }));
    const res = tagv(r.raw, `MusteriSiparisIptalResult`).trim();
    return { ok: !r.fault, ref, result: res, fault: r.fault };
  }
  return { ok: false, error: 'işlem' };
}

// ---- Ürün talebi (28.10.2026) ------------------------------------------------------------------------
// Mağaza üyesi aradığı ürünün fotoğrafını (en çok 3) + açıklamasını gönderir; yönetici "gelecek (tarih) / mağazada var /
// getiremiyoruz / mesaj" diye yanıtlar, üyenin zil + telefon bildirimine düşer.
// Kötüye kullanım önlemleri (R2 şişmesin):
//   - sadece doğrulanmış üye (members/{uid} kendi oturum anahtarıyla okunur), dosya başına en çok 700 KB, sadece webp/jpeg (ilk baytlara bakılır)
//   - üye günde en çok settings/public.preq.perDay talep (varsayılan 5), tüm mağaza günde en çok 300 (KV sayaçları, 2 gün yaşar)
//   - fotoğraflar R2 pr/<talep>/<n>.<uzantı>; talep silinince hemen, değilse preq.days gün (varsayılan 30) sonra saatlik temizlikte silinir
const PQ_FILE = 700e3, PQ_FILES = 3, PQ_ALL = 300;
const pqDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Türkiye günü
const pqId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);
const tokClaims = (t) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; } };
const bearer = (req) => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
async function pqSettings() { const pub = (await fsDoc('settings/public').catch(() => null)) || {}; const q = pub.preq || {}; return { on: q.on !== false, perDay: Math.min(50, Math.max(1, Number(q.perDay) || 5)), days: Math.min(365, Math.max(1, Number(q.days) || 30)), shop: pub.brand?.appName || 'ERTEL GSM' }; }
async function pqMember(tok) {
  const uid = tokUid(tok); if (!uid) return { error: 'Oturum yok, yeniden giriş yapın' };
  const m = await fsAuth('members/' + uid, tok); if (!m) return { error: 'Üyelik doğrulanamadı' };
  const tc = tokClaims(tok); if (!tc.email_verified && !['google.com', 'facebook.com'].includes(tc.firebase?.sign_in_provider) && !m.byAdmin) return { error: 'Önce e-posta adresinizi doğrulayın' };
  return { uid, m };
}
// POST /preq/up (FormData f0..f2; Authorization: Bearer <üye oturum anahtarı>) → { id, keys: ['pr/<id>/0.webp', …] }
async function preqUp(req, env) {
  if (!env.R2) return { ok: false, error: 'Depo bağlı değil' };
  const who = await pqMember(bearer(req)); if (who.error) return { ok: false, error: who.error };
  const S = await pqSettings(); if (!S.on) return { ok: false, error: 'Ürün talebi şu an kapalı' };
  const fd = await req.formData().catch(() => null); if (!fd) return { ok: false, error: 'Eksik bilgi' };
  const files = []; for (let i = 0; i < 6; i++) { const f = fd.get('f' + i); if (f && typeof f !== 'string') files.push(f); }
  if (files.length > PQ_FILES) return { ok: false, error: `En çok ${PQ_FILES} fotoğraf eklenebilir` };
  const bufs = [];
  for (const f of files) {
    if (f.size > PQ_FILE) return { ok: false, error: 'Fotoğraf çok büyük' };
    const b = new Uint8Array(await f.arrayBuffer());
    const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    if (!webp && !jpg) return { ok: false, error: 'Sadece fotoğraf yüklenebilir' };
    bufs.push({ b, ext: webp ? 'webp' : 'jpg', type: webp ? 'image/webp' : 'image/jpeg' });
  }
  const day = pqDay(); const ku = `pq:${who.uid}:${day}`, ka = `pq:all:${day}`;
  const [nu, na] = await Promise.all([env.KV.get(ku), env.KV.get(ka)]).then((a) => a.map((x) => Number(x) || 0));
  if (nu >= S.perDay) return { ok: false, error: `Bugün en çok ${S.perDay} talep gönderebilirsiniz. Yarın tekrar deneyin.` };
  if (na >= PQ_ALL) return { ok: false, error: 'Bugün çok fazla talep geldi, yarın tekrar deneyin.' };
  await Promise.all([env.KV.put(ku, String(nu + 1), { expirationTtl: 172800 }), env.KV.put(ka, String(na + 1), { expirationTtl: 172800 })]);
  const id = pqId(); const keys = [];
  for (const [i, x] of bufs.entries()) { const key = `pr/${id}/${i}.${x.ext}`; await env.R2.put(key, x.b, { httpMetadata: { contentType: x.type }, customMetadata: { uid: who.uid } }); keys.push(key); }
  return { ok: true, id, keys, left: S.perDay - nu - 1 };
}
async function pqDropFiles(env, id) {
  if (!env.R2 || !/^[A-Za-z0-9]{10,40}$/.test(id)) return 0;
  const l = await env.R2.list({ prefix: `pr/${id}/`, limit: 20 });
  if (l.objects.length) await env.R2.delete(l.objects.map((o) => o.key));
  return l.objects.length;
}
// POST /preq/del {id} (yönetici ya da talebin sahibi): fotoğraflar R2'den, talep Firestore'dan (aynı oturum anahtarıyla) silinir
async function preqDel(req, env, b) {
  const id = String(b.id || ''); const tok = bearer(req); const uid = tokUid(tok);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !uid) return { ok: false, error: 'eksik' };
  const admin = !(await adminOf(req));
  if (!admin) { const d = await fsAuth('preq/' + id, tok); if (d && d.uid !== uid) return { ok: false, error: 'yetki' }; }
  const files = await pqDropFiles(env, id);
  const r = await fetch(FS + 'preq/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
  return { ok: r.ok, files, error: r.ok ? undefined : 'Talep silinemedi (' + r.status + ')' };
}
const PQ_KIND = { eta: 'Getireceğiz', have: 'Mağazada var', no: 'Temin edemiyoruz', note: 'Mesaj' };
const trDate = (d) => { const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }); };
// POST /preq/new {id} (üye oturumu): yeni talep → Telegram (ilk fotoğrafla) + yönetici telefon bildirimi, bir kez
async function preqNew(req, env, b, origin) {
  const id = String(b.id || ''); const tok = bearer(req); const uid = tokUid(tok);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !uid) return { ok: false, error: 'eksik' };
  if (await env.KV.get('nq:' + id)) return { ok: true, already: true };
  const d = await fsAuth('preq/' + id, tok); if (!d || d.uid !== uid) return { ok: false, error: 'talep yok' };
  await env.KV.put('nq:' + id, '1', { expirationTtl: 60 * 60 * 24 * 7 });
  const who = [d.name, d.phone].filter(Boolean).join(' · ');
  const link = `https://ertelmarket.com/admin/u/${id}`;
  const n = (d.photos || []).length;
  const pics = (d.photos || []).map((k) => origin + '/p/' + k);
  await adminPush(env, { title: `📷 Ürün talebi · ${d.name || 'Üye'}`, body: (String(d.text || '') || `${n} fotoğraf`).slice(0, 160), url: '/admin/u/' + id, tag: 'aq-' + id }).catch(() => {});
  const text = `📷 Yeni ürün talebi #${d.no || ''}\n${who}${d.email ? '\n' + d.email : ''}\n\n${d.text || '(açıklama yok)'}${n ? `\n\n${n} fotoğraf:\n` + pics.join('\n') : ''}\n\nPanelde yanıtla: ${link}`;
  return notifySend(env, { subject: `Ürün talebi #${d.no || ''} · ${d.name || ''}`, text, link, replyTo: d.email, photo: pics[0] });
}
// POST /preq/reply {id} (yönetici): son yanıt üyenin telefonlarına (KV pm:<uid>) bildirilir; aynı yanıt bir kez
async function preqReply(req, env, b) {
  const err = await adminOf(req); if (err) return { ok: false, error: err };
  const id = String(b.id || ''); if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { ok: false, error: 'eksik' };
  const d = await fsAuth('preq/' + id, bearer(req)); if (!d) return { ok: false, error: 'talep yok' };
  const r = (d.replies || []).slice(-1)[0]; if (!r || !d.uid) return { ok: true, sent: 0 };
  if ((await env.KV.get('pqr:' + id)) === String(r.at)) return { ok: true, same: true };
  await env.KV.put('pqr:' + id, String(r.at), { expirationTtl: 60 * 60 * 24 * 60 });
  const subs = (await env.KV.get('pm:' + d.uid, 'json')) || []; if (!subs.length) return { ok: true, sent: 0, subs: 0 };
  const S = await pqSettings();
  const head = r.k === 'eta' ? `Ürününüz ${r.d ? trDate(r.d) + ' civarında' : 'yakında'} gelecek.` : r.k === 'have' ? 'Aradığınız ürün mağazamızda.' : r.k === 'no' ? 'Maalesef bu ürünü temin edemiyoruz.' : '';
  const body = [head, r.t].filter(Boolean).join(' ').slice(0, 200) || 'Talebiniz yanıtlandı.';
  const data = { title: `${S.shop} · Ürün talebiniz`, body, url: r.k === 'have' && r.p ? '/urun/' + r.p : '/talep', tag: 'pq-' + id };
  const keep = []; let sent = 0;
  for (const s of subs) { const code = await pushOne(env, s, data).catch(() => 0); if (code >= 200 && code < 300) sent++; if (code !== 404 && code !== 410) keep.push(s); }
  if (keep.length !== subs.length) await env.KV.put('pm:' + d.uid, JSON.stringify(keep), { expirationTtl: 60 * 60 * 24 * 365 });
  return { ok: true, sent, subs: subs.length };
}
// Saatlik: süresi dolan talep fotoğrafları (yüklenme + preq.days gün) silinir. Talebi hiç oluşturulmamış (yarım kalan) yüklemeler de 1 günde gider.
async function preqSweep(env) {
  if (!env.R2) return 0;
  const S = await pqSettings(); const limit = Date.now() - S.days * 864e5; const orphan = Date.now() - 864e5;
  let cursor, gone = 0;
  for (let page = 0; page < 20; page++) {
    const l = await env.R2.list({ prefix: 'pr/', limit: 1000, cursor, include: ['customMetadata'] });
    const old = l.objects.filter((o) => +new Date(o.uploaded) < limit).map((o) => o.key);
    for (let i = 0; i < old.length; i += 500) { await env.R2.delete(old.slice(i, i + 500)); gone += old.slice(i, i + 500).length; }
    if (!l.truncated) break; cursor = l.cursor;
  }
  // yarım kalanlar: fotoğraf yüklendi ama talep kaydı hiç yazılmadı (Firestore'da yok) → 1 gün sonra silinir
  const ids = new Set(); let c2;
  for (let page = 0; page < 5; page++) {
    const l = await env.R2.list({ prefix: 'pr/', limit: 1000, cursor: c2 });
    for (const o of l.objects) if (+new Date(o.uploaded) < orphan) ids.add(o.key.split('/')[1]);
    if (!l.truncated) break; c2 = l.cursor;
  }
  for (const id of [...ids].slice(0, 40)) { const r = await fetch(FS + 'preq/' + id); if (r.status === 404) gone += await pqDropFiles(env, id); }
  return gone;
}


// ---- Sorun bildirimi (29.10.2026) -------------------------------------------------------------------------
// Mağaza üyesi sorunlu ürünün fotoğraf(lar)ını / kısa videosunu + açıklamasını gönderir; yönetici durum (İşleme alındı,
// İnceleniyor…) + açıklama + isterse fotoğrafla yanıtlar → üyenin telefonuna bildirim. Kayıt Firestore issues/{id}.
// Kötüye kullanım önlemleri (R2 şişmesin):
//   - sadece e-postası doğrulanmış üye; tek gönderimde en çok 4 fotoğraf (≤ 800 KB, webp/jpeg) + 1 video (≤ 40 MB, mp4/mov/webm ilk baytlarına bakılır)
//   - üye günde en çok settings/public.issue.perDay bildirim (varsayılan 3), aynı ağ (IP) saatte en çok 6 yükleme, tüm mağaza günde en çok 150
//   - dosyalar R2 is/<id>/…; bildirim silinince hemen, değilse issue.days gün (varsayılan 45) sonra saatlik temizlikte silinir
const IS_IMG = 800e3, IS_VID = 40e6, IS_IMGS = 4, IS_ALL = 150, IS_IP = 6;
async function isSettings() { const pub = (await fsDoc('settings/public').catch(() => null)) || {}; const q = pub.issue || {}; return { on: q.on !== false, perDay: Math.min(20, Math.max(1, Number(q.perDay) || 3)), days: Math.min(365, Math.max(1, Number(q.days) || 45)), shop: pub.brand?.appName || 'ERTEL GSM' }; }
function sniff(b) {
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: 'webp', type: 'image/webp', img: 1 };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg', img: 1 };
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) { const brand = String.fromCharCode(b[8], b[9], b[10], b[11]); return brand === 'qt  ' ? { ext: 'mov', type: 'video/quicktime', vid: 1 } : { ext: 'mp4', type: 'video/mp4', vid: 1 }; }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: 'webm', type: 'video/webm', vid: 1 };
  return null;
}
// POST /issue/up (FormData f0..f3 fotoğraf, v video; Authorization: Bearer <üye oturum anahtarı>) → { id, files: [{k, t:'i'|'v'}] }
async function issueUp(req, env) {
  if (!env.R2) return { ok: false, error: 'Depo bağlı değil' };
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > IS_VID + IS_IMGS * IS_IMG + 1e6) return { ok: false, error: 'Dosyalar çok büyük. Videoyu daha kısa çekin (20-30 sn).' };
  const who = await pqMember(bearer(req)); if (who.error) return { ok: false, error: who.error };
  const S = await isSettings(); if (!S.on) return { ok: false, error: 'Sorun bildirimi şu an kapalı' };
  const day = pqDay(); const ip = req.headers.get('CF-Connecting-IP') || 'x'; const hour = new Date().toISOString().slice(0, 13);
  const ku = `is:${who.uid}:${day}`, ka = `is:all:${day}`, ki = `isip:${ip}:${hour}`;
  const [nu, na, ni] = await Promise.all([env.KV.get(ku), env.KV.get(ka), env.KV.get(ki)]).then((a) => a.map((x) => Number(x) || 0));
  if (nu >= S.perDay) return { ok: false, error: `Bugün en çok ${S.perDay} sorun bildirimi gönderebilirsiniz. Acil ise WhatsApp'tan yazın.` };
  if (ni >= IS_IP) return { ok: false, error: 'Bu bağlantıdan çok sık gönderim yapıldı. Biraz sonra tekrar deneyin.' };
  if (na >= IS_ALL) return { ok: false, error: 'Bugün çok fazla bildirim geldi, yarın tekrar deneyin.' };
  const fd = await req.formData().catch(() => null); if (!fd) return { ok: false, error: 'Eksik bilgi' };
  const items = [];
  for (let i = 0; i < 8; i++) { const f = fd.get('f' + i); if (f && typeof f !== 'string') items.push({ f, vid: false }); }
  const v = fd.get('v'); if (v && typeof v !== 'string') items.push({ f: v, vid: true });
  if (items.filter((x) => !x.vid).length > IS_IMGS) return { ok: false, error: `En çok ${IS_IMGS} fotoğraf eklenebilir` };
  const bufs = [];
  for (const x of items) {
    if (x.f.size > (x.vid ? IS_VID : IS_IMG)) return { ok: false, error: x.vid ? 'Video çok büyük (en çok 40 MB). Daha kısa çekin.' : 'Fotoğraf çok büyük' };
    const b = new Uint8Array(await x.f.arrayBuffer()); const t = sniff(b);
    if (!t || (x.vid ? !t.vid : !t.img)) return { ok: false, error: x.vid ? 'Video biçimi desteklenmiyor (MP4 / MOV)' : 'Sadece fotoğraf yüklenebilir' };
    bufs.push({ b, ...t });
  }
  await Promise.all([env.KV.put(ku, String(nu + 1), { expirationTtl: 172800 }), env.KV.put(ka, String(na + 1), { expirationTtl: 172800 }), env.KV.put(ki, String(ni + 1), { expirationTtl: 7200 })]);
  const id = pqId(); const files = []; let n = 0;
  for (const x of bufs) { const key = `is/${id}/${x.vid ? 'v' : 'c'}${n++}.${x.ext}`; await env.R2.put(key, x.b, { httpMetadata: { contentType: x.type }, customMetadata: { uid: who.uid } }); files.push({ k: key, t: x.vid ? 'v' : 'i' }); }
  return { ok: true, id, files, left: S.perDay - nu - 1 };
}
// POST /issue/aup?id=<bildirim> (yönetici, FormData f0..f5 fotoğraf) → { files } — yanıta eklenen fotoğraflar (is/<id>/a…)
async function issueAdminUp(req, env) {
  const err = await adminOf(req); if (err) return { ok: false, error: err };
  if (!env.R2) return { ok: false, error: 'Depo bağlı değil' };
  const id = new URL(req.url).searchParams.get('id') || ''; if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { ok: false, error: 'eksik' };
  const fd = await req.formData().catch(() => null); if (!fd) return { ok: false, error: 'Eksik bilgi' };
  const files = [];
  for (let i = 0; i < 6; i++) {
    const f = fd.get('f' + i); if (!f || typeof f === 'string') continue;
    if (f.size > 2e6) return { ok: false, error: 'Fotoğraf çok büyük' };
    const b = new Uint8Array(await f.arrayBuffer()); const t = sniff(b); if (!t?.img) return { ok: false, error: 'Sadece fotoğraf' };
    const key = `is/${id}/a${Date.now().toString(36)}${i}.${t.ext}`; await env.R2.put(key, b, { httpMetadata: { contentType: t.type } }); files.push({ k: key, t: 'i' });
  }
  return { ok: true, files };
}
async function isDropFiles(env, id) {
  if (!env.R2 || !/^[A-Za-z0-9]{10,40}$/.test(id)) return 0;
  let n = 0, cursor;
  for (let p = 0; p < 5; p++) { const l = await env.R2.list({ prefix: `is/${id}/`, limit: 100, cursor }); if (l.objects.length) { await env.R2.delete(l.objects.map((o) => o.key)); n += l.objects.length; } if (!l.truncated) break; cursor = l.cursor; }
  return n;
}
// POST /issue/del {id} (yönetici ya da sahibi): tüm dosyalar R2'den, kayıt Firestore'dan silinir
async function issueDel(req, env, b) {
  const id = String(b.id || ''); const tok = bearer(req); const uid = tokUid(tok);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !uid) return { ok: false, error: 'eksik' };
  const admin = !(await adminOf(req));
  if (!admin) { const d = await fsAuth('issues/' + id, tok); if (d && d.uid !== uid) return { ok: false, error: 'yetki' }; }
  const files = await isDropFiles(env, id);
  const r = await fetch(FS + 'issues/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
  return { ok: r.ok, files, error: r.ok ? undefined : 'Kayıt silinemedi (' + r.status + ')' };
}
// POST /issue/new {id} (üye): yeni sorun bildirimi → Telegram (ilk fotoğrafla) + yönetici telefon bildirimi, bir kez
async function issueNew(req, env, b, origin) {
  const id = String(b.id || ''); const tok = bearer(req); const uid = tokUid(tok);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !uid) return { ok: false, error: 'eksik' };
  if (await env.KV.get('ni:' + id)) return { ok: true, already: true };
  const d = await fsAuth('issues/' + id, tok); if (!d || d.uid !== uid) return { ok: false, error: 'kayıt yok' };
  await env.KV.put('ni:' + id, '1', { expirationTtl: 60 * 60 * 24 * 7 });
  const who = [d.name, d.phone].filter(Boolean).join(' · ');
  const link = `https://ertelmarket.com/admin/i/${id}`;
  const fl = d.files || []; const pics = fl.filter((x) => x.t === 'i').map((x) => origin + '/p/' + x.k); const vids = fl.filter((x) => x.t === 'v').map((x) => origin + '/p/' + x.k);
  await adminPush(env, { title: `🛠️ Sorun bildirimi · ${d.name || 'Üye'}`, body: [d.prod, d.text].filter(Boolean).join(' · ').slice(0, 160) || `${fl.length} dosya`, url: '/admin/i/' + id, tag: 'ai-' + id }).catch(() => {});
  const text = `🛠️ Yeni sorun bildirimi #${d.no || ''}\n${who}${d.email ? '\n' + d.email : ''}${d.order ? '\nSipariş: #' + d.order : ''}${d.prod ? '\nÜrün: ' + d.prod : ''}\n\n${d.text || '(açıklama yok)'}${pics.length ? `\n\n${pics.length} fotoğraf:\n` + pics.join('\n') : ''}${vids.length ? '\n\nVideo:\n' + vids.join('\n') : ''}\n\nPanelde yanıtla: ${link}`;
  return notifySend(env, { subject: `Sorun bildirimi #${d.no || ''} · ${d.name || ''}`, text, link, replyTo: d.email, photo: pics[0] });
}
const IS_ST = { received: 'İşleme alındı', review: 'İnceleniyor', action: 'Sizden bir adım bekleniyor', shipping: 'Değişim / iade için gönderin', solved: 'Çözüldü', closed: 'Kapatıldı' };
// POST /issue/reply {id} (yönetici): son yanıt üyenin telefonlarına; aynı yanıt bir kez
async function issueReply(req, env, b) {
  const err = await adminOf(req); if (err) return { ok: false, error: err };
  const id = String(b.id || ''); if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { ok: false, error: 'eksik' };
  const d = await fsAuth('issues/' + id, bearer(req)); if (!d) return { ok: false, error: 'kayıt yok' };
  const r = (d.replies || []).filter((x) => x.by !== 'c').slice(-1)[0]; if (!r || !d.uid) return { ok: true, sent: 0 };
  if ((await env.KV.get('isr:' + id)) === String(r.at)) return { ok: true, same: true };
  await env.KV.put('isr:' + id, String(r.at), { expirationTtl: 60 * 60 * 24 * 60 });
  const subs = (await env.KV.get('pm:' + d.uid, 'json')) || []; if (!subs.length) return { ok: true, sent: 0, subs: 0 };
  const S = await isSettings();
  const body = [r.s && IS_ST[r.s] ? IS_ST[r.s] + '.' : '', r.t].filter(Boolean).join(' ').slice(0, 200) || 'Sorun bildiriminiz yanıtlandı.';
  const data = { title: `${S.shop} · Sorun bildiriminiz #${d.no || ''}`, body, url: '/sorun', tag: 'is-' + id };
  const keep = []; let sent = 0;
  for (const s of subs) { const code = await pushOne(env, s, data).catch(() => 0); if (code >= 200 && code < 300) sent++; if (code !== 404 && code !== 410) keep.push(s); }
  if (keep.length !== subs.length) await env.KV.put('pm:' + d.uid, JSON.stringify(keep), { expirationTtl: 60 * 60 * 24 * 365 });
  return { ok: true, sent, subs: subs.length };
}
// POST /issue/msg {id} (üye ek mesaj yazdı): yöneticiye telefon bildirimi, 2 dakikada en çok bir
async function issueMsg(req, env, b) {
  const id = String(b.id || ''); const tok = bearer(req); const uid = tokUid(tok);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !uid) return { ok: false, error: 'eksik' };
  if (await env.KV.get('nim:' + id)) return { ok: true, already: true };
  const d = await fsAuth('issues/' + id, tok); if (!d || d.uid !== uid) return { ok: false, error: 'kayıt yok' };
  await env.KV.put('nim:' + id, '1', { expirationTtl: 120 });
  const r = (d.replies || []).slice(-1)[0] || {};
  await adminPush(env, { title: `🛠️ #${d.no || ''} · ${d.name || 'Üye'} yazdı`, body: String(r.t || 'Yeni mesaj').slice(0, 160), url: '/admin/i/' + id, tag: 'ai-' + id }).catch(() => {});
  return { ok: true };
}
// Saatlik: süresi dolan dosyalar (yüklenme + issue.days gün) silinir; kaydı hiç yazılmamış yüklemeler 1 günde gider
async function issueSweep(env) {
  if (!env.R2) return 0;
  const S = await isSettings(); const limit = Date.now() - S.days * 864e5; const orphan = Date.now() - 864e5;
  let cursor, gone = 0; const ids = new Set();
  for (let page = 0; page < 20; page++) {
    const l = await env.R2.list({ prefix: 'is/', limit: 1000, cursor });
    const old = l.objects.filter((o) => +new Date(o.uploaded) < limit).map((o) => o.key);
    for (let i = 0; i < old.length; i += 500) { await env.R2.delete(old.slice(i, i + 500)); gone += old.slice(i, i + 500).length; }
    for (const o of l.objects) if (+new Date(o.uploaded) < orphan && +new Date(o.uploaded) >= limit) ids.add(o.key.split('/')[1]);
    if (!l.truncated) break; cursor = l.cursor;
  }
  for (const id of [...ids].slice(0, 40)) { const r = await fetch(FS + 'issues/' + id); if (r.status === 404) gone += await isDropFiles(env, id); }
  return gone;
}


// ---- Gelince haber ver (29.10.2026): eşitleme stoğa giren ve bekleyeni olan ürünleri bildirir (X-Key sync anahtarı)
// b.list = [{uid, items: [{id, n}]}] → üyenin cihazlarına (pm:<uid>) "Beklediğiniz ürün geldi"
async function pushBack(env, key, b) {
  if (!env.TELEGRAM_TOKEN) return { ok: false, error: 'anahtar yok' };
  const want = [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('sync:' + env.TELEGRAM_TOKEN)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (key !== want) return { ok: false, error: 'yetki' };
  return sendBack(env, b);
}
async function sendBack(env, b) {
  const pub = (await fsDoc('settings/public')) || {};
  if (pub.feat?.notify === false) return { ok: true, off: true };
  const shop = pub.brand?.appName || 'ERTEL GSM';
  let sent = 0, users = 0;
  for (const { uid, items } of (Array.isArray(b.list) ? b.list : []).slice(0, 1000)) {
    if (!/^[\w-]{6,64}$/.test(String(uid)) || !Array.isArray(items) || !items.length) continue;
    const subs = (await env.KV.get('pm:' + uid, 'json')) || []; if (!subs.length) continue; users++;
    const it = items[0];
    const data = items.length === 1
      ? { title: '🔔 Beklediğiniz ürün geldi', body: `${String(it.n).slice(0, 120)} tekrar stokta. Dokunun, hemen sepete ekleyin.`, url: '/urun/' + it.id + '?hb=1', tag: 'back-' + it.id }
      : { title: `🔔 Beklediğiniz ${items.length} ürün geldi`, body: items.slice(0, 3).map((x) => String(x.n).slice(0, 40)).join(' · '), url: '/hesap/haber-beklenenler', tag: 'back' };
    data.title = data.title + ' · ' + shop;
    const keep = [];
    for (const s of subs) { const code = await pushOne(env, s, data).catch(() => 0); if (code >= 200 && code < 300) sent++; if (code !== 404 && code !== 410) keep.push(s); }
    if (keep.length !== subs.length) await env.KV.put('pm:' + uid, JSON.stringify(keep), { expirationTtl: 60 * 60 * 24 * 365 });
  }
  return { ok: true, users, sent };
}
// ---- Yeni ürün yorumu (üye oturumu): yöneticiye telefon bildirimi, bir kez
async function revNew(req, env, b) {
  const id = String(b.id || ''); const tok = bearer(req); const uid = tokUid(tok);
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(id) || !uid) return { ok: false, error: 'eksik' };
  if (await env.KV.get('nrv:' + id)) return { ok: true, already: true };
  const d = await fsAuth('reviews/' + id, tok); if (!d || d.uid !== uid) return { ok: false, error: 'yorum yok' };
  await env.KV.put('nrv:' + id, '1', { expirationTtl: 60 * 60 * 24 * 30 });
  await adminPush(env, { title: `⭐ Yeni yorum ${'★'.repeat(Number(d.stars) || 0)} · ${d.name || 'Üye'}`, body: (String(d.text || '') || 'Sadece yıldız verdi').slice(0, 160) + (d.status === 'pending' ? ' · onay bekliyor' : ''), url: '/admin/musteriler', tag: 'rv-' + id }).catch(() => {});
  return { ok: true };
}


// ---- Sunucu tarafı sipariş (POST /order {id, order}; üye ise Authorization: Bearer <üye oturum anahtarı>) -------------
// Tarayıcıdan gelen fiyat ve toplamlara GÜVENİLMEZ: her kalemin fiyatı herkese açık katalogdan (pubcatalog, liste fiyatı r)
// yeniden alınır. Sepetteki fiyat katalogdan farklıysa sipariş yazılmaz, { ok:false, code:'price', items } döner (müşteri
// güncel fiyatı görüp tekrar onaylar). Durum, tarih, geçmiş gibi alanları sunucu koyar. Yazma Firebase servis hesabıyla
// (gizli ayar FIREBASE_SA) yapılır; bu yüzden ileride kurallarda müşterinin doğrudan sipariş yazması kapatılabilir.
const ORD_FIELDS = ['contact', 'delivery', 'invoice', 'pay', 'note', 'legal'];
const ORD_PAYS = ['havale', 'card', 'shop'];
let pubCache = null; // { v, map: Map(id → ürün) } — aynı Worker örneğinde katalog sürümü değişmedikçe tekrar okunmaz
async function pubPrices() {
  const meta = await fsDoc('pubcatalog/_meta'); if (!meta) throw new Error('Katalog okunamadı');
  if (pubCache && pubCache.v === meta.version) return pubCache.map;
  const parts = await Promise.all(Array.from({ length: Number(meta.chunks) || 1 }, (_, i) => fsDoc('pubcatalog/c' + i)));
  const map = new Map();
  for (const part of parts) for (const p of part?.items || []) if (p && p.id != null) map.set(String(p.id), p);
  pubCache = { v: meta.version, map };
  return map;
}
const r2c = (n) => Math.round(Number(n) * 100) / 100;
// Setler (31.10.2026): tanımlar settings/public.sets; set kalemi fiyatı katalogdan değil setin paket fiyatından (pp) doğrulanır
let setCache = null;
async function pubSets() {
  if (setCache && setCache.at > Date.now() - 60000) return setCache.map;
  const d = await fsDoc('settings/public'); const map = new Map();
  for (const x of Array.isArray(d?.sets) ? d.sets : []) if (x && x.on && x.id) map.set(String(x.id), x);
  setCache = { at: Date.now(), map }; return map;
}
async function placeOrder(req, env, b, ctx) {
  const id = String(b.id || ''); const o = b.order || {};
  if (!/^[A-Za-z0-9]{15,40}$/.test(id)) return { ok: false, error: 'Geçersiz sipariş kimliği' };
  if (!env.FIREBASE_SA && !b.check) return { ok: false, code: 'setup', error: 'Sunucu sipariş anahtarı henüz eklenmemiş' };
  // aşırı kullanım sınırı: aynı bağlantıdan saatte en çok 15 sipariş
  const ip = req.headers.get('CF-Connecting-IP') || 'x'; const kr = 'ord-ip:' + ip + ':' + Math.floor(Date.now() / 3600000);
  const nr = Number(await env.KV.get(kr)) || 0;
  if (nr >= 15) return { ok: false, error: 'Çok fazla sipariş denemesi, biraz sonra tekrar deneyin' };
  // üye siparişi: oturum anahtarı Firestore'a sorularak doğrulanır (anahtar sahte ise üye kaydı okunamaz)
  let uid = null;
  if (o.uid && !b.check) {
    const tok = bearer(req); uid = tokUid(tok);
    if (!uid || uid !== o.uid || !(await fsAuth('members/' + uid, tok))) return { ok: false, code: 'auth', error: 'Oturum doğrulanamadı, yeniden giriş yapın' };
  }
  const list = Array.isArray(o.items) ? o.items : [];
  if (!list.length || list.length > 300) return { ok: false, error: 'Sepet boş ya da çok büyük' };
  const pay = String(o.pay || ''); if (!ORD_PAYS.includes(pay)) return { ok: false, error: 'Ödeme yöntemi geçersiz' };
  if (pay === 'shop' && o.delivery?.method !== 'pickup') return { ok: false, error: 'Dükkânda ödeme sadece dükkândan teslimde seçilebilir' };
  if (!['cargo', 'pickup'].includes(o.delivery?.method)) return { ok: false, error: 'Teslimat yöntemi geçersiz' };
  const cat = await pubPrices();
  const items = [], changed = [], total = {};
  // set kalemleri: set yayında olmalı, ürün sette olmalı, fiyat = paket fiyatı, adet = set adedi × setteki adet, en az min(3, set boyu) ürün
  const sets = list.some((it) => it?.set) ? await pubSets() : null; const groups = new Map();
  for (const it of list) {
    if (!it?.set) continue;
    const def = sets.get(String(it.set.id)); const di = def && (def.items || []).find((x) => String(x.id) === String(it.id));
    if (!def || !di) return { ok: false, code: 'set', error: 'Sepetteki set değişti, sepeti yenileyip tekrar deneyin' };
    const k = String(it.set.k || it.set.id); const g = groups.get(k) || { def, ids: new Set(), mult: null }; groups.set(k, g);
    if (g.ids.has(String(it.id))) return { ok: false, code: 'set', error: 'Sette aynı ürün iki kez olamaz, sepeti yenileyin' }; // aynı ürünü tekrarlayıp 'en az 3 ürün' şartını aşmasın
    const m = Math.floor(Number(it.qty)) / Math.max(1, Math.floor(di.qty) || 1);
    if (!(m >= 1) || m !== Math.floor(m) || (g.mult != null && g.mult !== m)) return { ok: false, code: 'set', error: 'Set adetleri tutmuyor, sepeti yenileyin' };
    g.mult = m; g.ids.add(String(it.id));
    it._pp = r2c(di.pp);
  }
  for (const g of groups.values()) { const all = (g.def.items || []).length; if (g.ids.size < Math.min(3, all) || (g.def.rm === false && g.def.stock !== 'skip' && g.ids.size < all)) return { ok: false, code: 'set', error: 'Set eksik, sepeti yenileyin' }; }
  for (const it of list) {
    const p = cat.get(String(it?.id));
    const qty = Math.floor(Number(it?.qty));
    if (!p) { changed.push({ id: it?.id, n: it?.n, gone: true }); continue; }
    if (!(qty >= 1 && qty <= 9999)) return { ok: false, error: 'Adet geçersiz: ' + p.n };
    if (it.set) { // paket fiyatı
      const cur = p.cur || 'USD'; const price = it._pp;
      if (!(Math.abs(Number(it.price) - price) < 0.005)) return { ok: false, code: 'set', error: 'Set fiyatı güncellendi, sepeti yenileyin' };
      items.push({ id: p.id, k: p.k, n: p.n, cur, qty, price, set: { id: String(it.set.id), n: String(it.set.n || '').slice(0, 120), k: String(it.set.k || '').slice(0, 300) }, ...(p.r > 0 ? { list: Number(p.r) } : {}), ...(p.pi != null ? { pi: p.pi } : {}), ...(p.u ? { u: p.u } : {}) });
      total[cur] = (total[cur] || 0) + price * qty;
      continue;
    }
    const price = Number(p.r) > 0 ? Number(p.r) : null; const cur = p.cur || 'USD';
    if (price == null) { changed.push({ id: p.id, n: p.n, gone: true }); continue; }
    if (!(Math.abs(Number(it.price) - price) < 0.005) || (it.cur || 'USD') !== cur) changed.push({ id: p.id, n: p.n, price, cur });
    items.push({ id: p.id, k: p.k, n: p.n, cur, qty, price, ...(p.pi != null ? { pi: p.pi } : {}), ...(p.u ? { u: p.u } : {}) });
    total[cur] = (total[cur] || 0) + price * qty;
  }
  if (changed.length) return { ok: false, code: 'price', error: 'Bazı ürünlerin fiyatı değişti', items: changed };
  if (b.check) return { ok: true, check: true }; // sadece fiyat kontrolü (siparişte üye olurken hesap açmadan önce)
  const t = Date.now(); const rate = await haremRate().catch(() => null);
  const doc = {
    no: /^[A-Z0-9]{4,10}$/.test(String(o.no || '')) ? String(o.no) : Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''),
    // kartla ödeme (link gönderilir) siparişi doğrudan 'Onaylandı' başlar (uygulamadaki davranış, 29.10.2026)
    uid, member: !!uid, status: pay === 'card' ? 'confirmed' : 'new', createdAt: t, updatedAt: t, unread: 1, history: pay === 'card' ? [{ s: 'new', at: t }, { s: 'confirmed', at: t, by: 'card' }] : [{ s: 'new', at: t }],
    items, total, rate: rate?.usd || (Number(o.rate) > 0 ? Number(o.rate) : null), via: 'srv',
  };
  for (const k of ORD_FIELDS) if (o[k] !== undefined && o[k] !== null) doc[k] = o[k];
  if (typeof doc.note === 'string') doc.note = doc.note.slice(0, 1000);
  if (JSON.stringify(doc).length > 200000) return { ok: false, error: 'Sipariş çok büyük' };
  const w = await fsCreate(env, 'orders', id, doc);
  if (!w.ok) return { ok: false, error: w.exists ? 'Bu sipariş zaten kayıtlı' : 'Sipariş kaydedilemedi, tekrar deneyin' };
  await env.KV.put(kr, String(nr + 1), { expirationTtl: 7200 });
  ctx.waitUntil(notifyOrder(env, id, true).catch((e) => console.log('notify', e.message)));
  return { ok: true, id, no: doc.no, total, items };
}

// Firestore'a servis hesabıyla yazma (kurallara takılmaz). Erişim anahtarı ~55 dk KV'de saklanır (imza her istekte atılmasın).
const b64uBytes = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = (s) => b64uBytes(new TextEncoder().encode(s));
let saMem = null;
export async function saToken(env) {
  if (saMem && saMem.exp > Date.now() + 60000) return saMem.tok;
  const hit = await env.KV.get('sa-tok', 'json').catch(() => null); if (hit && hit.exp > Date.now() + 60000) { saMem = hit; return hit.tok; }
  const sa = JSON.parse(env.FIREBASE_SA);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64uStr(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + unsigned + '.' + b64uBytes(sig) });
  const j = await r.json().catch(() => ({})); if (!j.access_token) throw new Error('Servis anahtarı alınamadı');
  saMem = { tok: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 300000 };
  await env.KV.put('sa-tok', JSON.stringify(saMem), { expirationTtl: 3300 }).catch(() => {});
  return j.access_token;
}
function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, toFs(x)])) } };
  return { nullValue: null };
}
export async function fsCreate(env, col, id, data) {
  const tok = await saToken(env);
  const r = await fetch(FS + col + '?documentId=' + encodeURIComponent(id), { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: toFs(data).mapValue.fields }) });
  if (r.ok) return { ok: true };
  return { ok: false, exists: r.status === 409, status: r.status };
}
