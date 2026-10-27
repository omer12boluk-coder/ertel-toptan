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
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(check(env)); ctx.waitUntil(dhlWatch(env).catch((e) => console.log('dhlWatch', e.message))); },
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
      if (url.pathname === '/tg-link' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await tgLink(env, String(b.code || ''))); }
      if (url.pathname === '/') return json({ ok: true, name: 'ertel-b2b-watch', notify: await notifyStatus(env) });
      // müşteriye sipariş durumu bildirimi (web push)
      if (url.pathname === '/push/key') return json({ key: (await vapidKeys(env)).pub });
      if (url.pathname === '/push/sub' && req.method === 'POST') { const b = await req.json().catch(() => ({})); const r = await pushSub(env, b); if (r.ok && b.hello && !(await env.KV.get('ph:' + b.id))) { await env.KV.put('ph:' + b.id, '1', { expirationTtl: 60 }); ctx.waitUntil(pushStatus(env, String(b.id), true)); } return json(r); }
      if (url.pathname === '/push/admin' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await adminSub(env, b)); }
      if (url.pathname === '/notify-cancel' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifyCancel(env, String(b.id || ''))); }
      if (url.pathname === '/notify-req' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifyReq(env, b)); }
      if (url.pathname === '/notify-sync' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await notifySync(env, req.headers.get('X-Key') || '', b)); }
      if (url.pathname.startsWith('/dhl/') && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await dhl(env, url.pathname.slice(5), b)); }
      if (url.pathname === '/push/status' && req.method === 'POST') { const b = await req.json().catch(() => ({})); return json(await pushStatus(env, String(b.id || ''))); }
      // Ürün videosu: iPhone Safari videoyu parça parça (Range) ister; dosya bekçinin kendi dosyalarından okunup dilimlenir
      if (url.pathname.startsWith('/v/') && (req.method === 'GET' || req.method === 'HEAD') && env.ASSETS) return await serveVideo(req, env, url, cors);
      // R2 videoları: bazı Türk internet sağlayıcıları r2.dev adresini engelliyor; video bekçi üzerinden (Cloudflare içinden) parça parça aktarılır
      if (url.pathname.startsWith('/r2/') && (req.method === 'GET' || req.method === 'HEAD')) return await proxyR2(req, url, cors);
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
// E-posta: RESEND_KEY varsa Resend (onboarding@resend.dev → hesap sahibinin e-postası), yoksa FormSubmit
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
async function notifySend(env, { subject, text, short, replyTo, link, noEmail }) {
  const out = {};
  if (env.TELEGRAM_TOKEN) {
    const chat = JSON.parse((await env.KV.get('tg-chat')) || 'null');
    if (!chat) out.telegram = 'bağlanmamış';
    else try {
      const r = await fetch(TG(env, 'sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat.id, text: (subject + '\n\n' + text).slice(0, 4000), disable_web_page_preview: true }) });
      const j = await r.json().catch(() => ({})); out.telegram = j.ok ? 'gönderildi' : 'hata: ' + (j.description || r.status);
    } catch (e) { out.telegram = 'hata: ' + e; }
  } else out.telegram = 'TELEGRAM_TOKEN eklenmemiş';
  if (noEmail) out.email = 'yok';
  else if (env.NOTIFY_EMAIL && env.RESEND_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'ERTEL GSM <onboarding@resend.dev>', to: [env.NOTIFY_EMAIL], subject, text, html: mailHtml(subject, text, link), ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
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
async function pushSub(env, b) {
  const id = String(b.id || ''); const s = b.sub || {};
  if (!/^[\w-]{10,40}$/.test(id) || !/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return { ok: false, error: 'eksik' };
  const o = await fsDoc('orders/' + id); if (!o) return { ok: false, error: 'sipariş yok' };
  const me = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  const list = (await env.KV.get('ps:' + id, 'json')) || [];
  await env.KV.put('ps:' + id, JSON.stringify([me, ...list.filter((x) => x.endpoint !== s.endpoint)].slice(0, 5)), { expirationTtl: 60 * 60 * 24 * 120 });
  // üye siparişi: cihaz üyeye de bağlanır → üyenin SONRAKİ siparişlerinin bildirimleri de bu cihaza gelir
  // (siparişi Safari'den verip bildirimi ana ekran uygulamasında açan da haber alsın)
  if (o.uid && /^[\w-]{6,64}$/.test(o.uid)) {
    const ml = (await env.KV.get('pm:' + o.uid, 'json')) || [];
    await env.KV.put('pm:' + o.uid, JSON.stringify([me, ...ml.filter((x) => x.endpoint !== s.endpoint)].slice(0, 8)), { expirationTtl: 60 * 60 * 24 * 365 });
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
  const data = { title: `${shop} · Sipariş #${o.no}`, body, url: '/magaza/s/' + id, tag: 'o-' + id };
  const keep = []; let sent = 0;
  for (const s of list) { const code = await pushOne(env, s, data).catch(() => 0); if (code >= 200 && code < 300) sent++; if (code !== 404 && code !== 410) keep.push(s); }
  if (keep.length !== list.length) {
    const ok = (x) => keep.some((k) => k.endpoint === x.endpoint);
    await env.KV.put('ps:' + id, JSON.stringify(own.filter(ok)), { expirationTtl: 60 * 60 * 24 * 120 });
    if (o.uid) await env.KV.put('pm:' + o.uid, JSON.stringify(mem.filter(ok)), { expirationTtl: 60 * 60 * 24 * 365 });
  }
  return { ok: true, sent, subs: list.length };
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
  await env.KV.put('ps-admin', JSON.stringify([sub, ...rest].slice(0, 10)));
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
  const link = `https://erteltoptan.web.app/admin/s/${id}`;
  const text = `❌ Müşteri siparişi iptal etti #${o.no}\n${o.contact?.name || ''} · ${o.contact?.phone || ''}\n${(o.items || []).length} ürün · ${tot}\n\nPanelde aç: ${link}`;
  await adminPush(env, { title: `❌ Sipariş iptal edildi #${o.no}`, body: `${o.contact?.name || ''} · ${tot} · müşteri iptal etti`, url: '/admin/s/' + id, tag: 'ao-' + id }).catch(() => {});
  return notifySend(env, { subject: `İptal: sipariş #${o.no} · ${o.contact?.name || ''} · ${tot}`, text, link, replyTo: o.contact?.email });
}
// Bayi yeni talep açınca / mesaj yazınca. Talep, bayinin kendi oturum anahtarıyla okunur (başkası adına bildirim yollanamaz).
const REQ_TYPE = { reserve: 'Hazırlayın, geliyorum', quote: 'Fiyat sor', message: 'Mesaj' };
async function notifyReq(env, b) {
  const id = String(b.id || ''); const tok = String(b.token || ''); const uid = tokUid(tok);
  if (!/^[\w-]{10,40}$/.test(id) || !uid) return { ok: false, error: 'eksik' };
  const msg = !!b.msg; const key = (msg ? 'nm:' : 'nr:') + id;
  if (await env.KV.get(key)) return { ok: true, already: true };
  const r = await fsAuth('requests/' + id, tok);
  if (!r || r.uid !== uid) return { ok: false, error: 'talep yok' };
  await env.KV.put(key, '1', { expirationTtl: msg ? 120 : 60 * 60 * 24 * 30 }); // mesajlar 2 dakikada en çok bir bildirim
  const who = (r.userName || '') + (r.shop ? ` (${r.shop})` : '');
  const link = `https://erteltoptan.web.app/admin/t/${id}`;
  if (msg) { await adminPush(env, { title: `💬 ${who}`, body: String(r.lastMsg || 'Yeni mesaj').slice(0, 140), url: '/admin/t/' + id, tag: 'ar-' + id }); return { ok: true }; }
  const n = (r.items || []).length;
  const lines = (r.items || []).slice(0, 30).map((i) => `• ${i.qty || 1} × ${i.n || ''}${i.k ? ` (${i.k})` : ''}`).join('\n');
  const head = `${REQ_TYPE[r.type] || 'Talep'}${n ? ` · ${n} ürün` : ''}`;
  await adminPush(env, { title: `📨 Yeni talep #${r.no || ''} · ${who}`, body: (head + (r.note ? ' · ' + r.note : '')).slice(0, 160), url: '/admin/t/' + id, tag: 'ar-' + id }).catch(() => {});
  const text = `📨 Yeni bayi talebi #${r.no || ''}\n${who}\n${head}${r.pickup ? '\nGeliş: ' + r.pickup : ''}${r.note ? '\nNot: ' + r.note : ''}${lines ? '\n\n' + lines : ''}\n\nPanelde aç: ${link}`;
  return notifySend(env, { subject: `Yeni talep #${r.no || ''} · ${who}`, text, link });
}

// PlatinMarket eşitlemesinde değişen ürünler (GitHub Actions'taki eşitleme bildirir; anahtar: sha256('sync:' + TELEGRAM_TOKEN))
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
  const link = 'https://erteltoptan.web.app/admin';
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
  const r = await fetch(DHL_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"http://tempuri.org/${op}"` }, body });
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
  const o = await fsDoc('orders/' + id); if (!o) return { ok: false, error: 'sipariş yok' };
  const ref = String(o.dhl?.ref || b.ref || ('ERTEL' + o.no)).replace(/[^\w-]/g, '').slice(0, 30); // DHL'deki sipariş (referans) no = müşteri barkodu
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
