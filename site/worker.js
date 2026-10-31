// ertelmarket.com/__/auth/* ve /__/firebase/* → erteltoptan.firebaseapp.com (Firebase'in önerdiği "giriş geçidi").
// Google ile giriş penceresi / yönlendirmesi sitenin kendi adresinden geçer: Safari bunu üçüncü taraf saymaz
// (telefonda açılır pencere engeli ve yönlendirme sonrası oturumun kaybolması böyle çözülür). 31.10.2026
//
// Link önizlemesi (31.10.2026): /urun/<no> ve /set/<id> adresleri WhatsApp, Telegram, iMessage, Facebook gibi
// önizleme botlarına ürün adı + resmiyle (fiyatsız) OG etiketleri döner. Normal ziyaretçiye dokunulmaz (sayfa aynen).
// Veri Firestore'un herkese açık kayıtlarından (pubcatalog, settings/public); her adres 1 gün önbellekte.
const FB = 'https://erteltoptan.firebaseapp.com';
const FS = 'https://firestore.googleapis.com/v1/projects/erteltoptan/databases/(default)/documents/';
const IMG = 'https://resim.ertelmarket.com/';
const BOT = /facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|pinterest|skypeuripreview|vkshare|googlebot|bingbot|applebot|redditbot|embedly|viber|snapchat|yandex|petalbot|duckduckbot|preview/i;

function val(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return null;
}
async function doc(path) {
  const r = await fetch(FS + path); if (!r.ok) return null;
  const d = await r.json(); return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)]));
}
async function product(id) {
  const meta = await doc('pubcatalog/_meta'); if (!meta) return null;
  for (let i = 0; i < (Number(meta.chunks) || 1); i++) {
    const c = await doc('pubcatalog/c' + i);
    const p = (c?.items || []).find((x) => x && String(x.id) === String(id));
    if (p) return p;
  }
  return null;
}
// WhatsApp webp önizleme resmini göstermiyor → önce JPEG/PNG olanı seç (sitenin kendi resimleri R2'de orijinal JPEG; yüklenenler webp)
const isWebp = (f) => /\.webp($|\?)/i.test(f) || String(f).startsWith('r2:');
const firstImg = (p) => { const all = [p?.pi, ...(p?.im || [])].filter((f) => f && !String(f).startsWith('v:')); return all.find((f) => !isWebp(f)) || all[0] || null; };
function imgUrl(f) {
  if (!f) return IMG + 'platin/_none.jpg';
  f = String(f);
  if (/^https?:\/\//.test(f)) return f;
  if (f.startsWith('r2:')) return IMG + f.slice(3);
  if (f.startsWith('/')) return 'https://ertelmarket.com' + f;
  return IMG + 'platin/' + encodeURIComponent(f); // büyük resim = orijinal JPEG (küçük resimler webp'e çevrilmişti)
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function ogFor(path) {
  let m = /^\/(?:magaza\/)?urun\/(\d+)/.exec(path);
  if (m) {
    const p = await product(m[1]); if (!p) return null;
    return { title: p.n, desc: [p.b, 'ERTEL GSM · Telefon tamir ekipmanları'].filter(Boolean).join(' · '), img: imgUrl(firstImg(p)) };
  }
  m = /^\/(?:magaza\/)?set\/([\w-]+)/.exec(path);
  if (m) {
    const S = await doc('settings/public'); const set = (S?.sets || []).find((x) => x && x.id === m[1]); if (!set) return null;
    const p = set.items?.[0] ? await product(set.items[0].id) : null;
    return { title: set.name, desc: (set.desc || '') + (set.desc ? ' · ' : '') + (set.items || []).length + ' ürünlük set · ERTEL GSM', img: imgUrl(firstImg(p)) };
  }
  return null;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/__/auth/') || url.pathname.startsWith('/__/firebase/')) {
      const r = await fetch(FB + url.pathname + url.search, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body, redirect: 'manual' });
      return new Response(r.body, r);
    }
    const page = await env.ASSETS.fetch(req);
    if (req.method !== 'GET' || !BOT.test(req.headers.get('user-agent') || '')) return page;
    try {
      const cache = caches.default; const key = new Request('https://og2.cache' + url.pathname);
      let og = await cache.match(key).then((r) => r?.json()).catch(() => null);
      if (!og) {
        og = await ogFor(url.pathname);
        if (og) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(og), { headers: { 'Cache-Control': 'max-age=86400', 'Content-Type': 'application/json' } })));
      }
      if (!og) return page;
      const tags = `<meta property="og:type" content="product"><meta property="og:site_name" content="ERTEL GSM"><meta property="og:title" content="${esc(og.title)}"><meta property="og:description" content="${esc(og.desc)}"><meta property="og:image" content="${esc(og.img)}"><meta property="og:url" content="${esc(url.origin + url.pathname)}"><meta name="twitter:card" content="summary_large_image"><meta name="description" content="${esc(og.desc)}">`;
      return new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(og.title + ' · ERTEL GSM'); } })
        .on('head', { element(e) { e.append(tags, { html: true }); } })
        .transform(page);
    } catch { return page; }
  },
};
