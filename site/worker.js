// ertelmarket.com site bekçisi (Cloudflare Workers static assets önünde).
//
// 1) /__/auth/* ve /__/firebase/* → erteltoptan.firebaseapp.com (Firebase'in önerdiği "giriş geçidi").
//    Google ile giriş penceresi / yönlendirmesi sitenin kendi adresinden geçer (Safari üçüncü taraf saymaz). 31.10.2026
//
// 2) Google görünürlüğü (31.10.2026): mağaza tek sayfalık bir uygulama; sayfanın içi tarayıcıda, Firebase'den gelen
//    veriyle çizilir. Arama motoru sayfayı ilk açtığında boş bir iskelet görür. Bu yüzden:
//    - herkese: her sayfaya kendi başlığı, açıklaması, asıl adresi (canonical), paylaşım önizlemesi (OG) ve Google'ın
//      okuduğu ürün / mağaza bilgisi (JSON-LD) <head>'e yazılır. Görünen sayfa AYNEN kalır.
//    - arama motoru ve önizleme botlarına ek olarak sayfanın yazılı hâli (#ssr: başlık, ürünler, açıklama, linkler)
//      uygulamanın önüne konur. İçerik uygulamanın gösterdiğinin aynısı (Google'ın "dinamik çizim" yöntemi).
//    - /sitemap.xml: bütün ürünler, markalar (/marka/<ad>), kategoriler (/kategori/<ad>), setler.
//    Sayfalar: /, /urunler, /kalip, /marka/<ad>, /kategori/<ad>, /urun/<no>, /set/<id> (eski /magaza/... de).
//    Veri: Firestore'un herkese açık kayıtları (pubcatalog, settings/public, desc/descb). Toplu dizin her veri
//    merkezinde 6 saat önbellekte (caches.default — KV DEĞİL, günlük yazma sınırına dokunmaz), sayfa başına sonuç 1 gün.
//    Hata olursa sayfa hiç dokunulmadan döner (site asla bozulmaz).
import { slugify, catSlugs } from '../src/seo.js';
import CAT_TREE from '../src/categories.json';

const FB = 'https://erteltoptan.firebaseapp.com';
const FS = 'https://firestore.googleapis.com/v1/projects/erteltoptan/databases/(default)/documents/';
const IMG = 'https://resim.ertelmarket.com/';
const SITE = 'https://ertelmarket.com';
const NAME = 'ERTEL GSM';
const VER = 'v2'; // önbellek anahtarı: sayfa düzeni değişince artır
const BOT = /bot\b|bot\/|crawl|spider|slurp|google|bing|yandex|baidu|duckduck|facebookexternalhit|facebot|whatsapp|telegram|slack|linkedin|discord|pinterest|skypeuripreview|vkshare|embedly|viber|snapchat|petal|applebot|preview/i;

// ---- Firestore REST (herkese açık okuma)
function val(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return null;
}
async function doc(path) {
  const r = await fetch(FS + path); if (!r.ok) return null;
  const d = await r.json(); return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)]));
}

// ---- resim: WhatsApp webp önizlemeyi göstermiyor → önce JPEG/PNG olanı seç (sitenin kendi resimleri R2'de orijinal JPEG)
const isWebp = (f) => /\.webp($|\?)/i.test(f) || String(f).startsWith('r2:');
const firstImg = (p) => { const all = [p?.pi, ...(p?.im || [])].filter((f) => f && !String(f).startsWith('v:')); return all.find((f) => !isWebp(f)) || all[0] || null; };
function imgUrl(f) {
  if (!f) return IMG + 'platin/_none.jpg';
  f = String(f);
  if (/^https?:\/\//.test(f)) return f;
  if (f.startsWith('r2:')) return IMG + f.slice(3);
  if (f.startsWith('/')) return SITE + f;
  return IMG + 'platin/' + encodeURIComponent(f);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
const usd = (r) => (Number(r) > 0 ? '$' + Number(r).toFixed(2) : '');
const strip = (html) => String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

// ---- Toplu dizin: ürünler (kısa), ayarlardan dükkân bilgisi, setler, kategori ayarları
let MEM = null;
async function siteIndex(ctx) {
  if (MEM && Date.now() - MEM.at < 20 * 60e3) return MEM;
  const key = new Request('https://seo-index.cache/' + VER);
  try { const r = await caches.default.match(key); if (r) { const j = await r.json(); if (Date.now() - j.at < 6 * 3600e3) return (MEM = prep(j)); } } catch {}
  const [meta, S] = await Promise.all([doc('pubcatalog/_meta'), doc('settings/public')]);
  if (!meta) throw new Error('katalog yok');
  const chunks = await Promise.all(Array.from({ length: Number(meta.chunks) || 1 }, (_, i) => doc('pubcatalog/c' + i)));
  const items = [];
  for (const c of chunks) for (const p of c?.items || []) {
    if (!p || !p.a || p.so || p.id == null || !p.n) continue;
    items.push([String(p.id), p.n, p.b || '', p.c ?? null, p.c2 ?? null, Number(p.r) || 0, Number(p.s) || 0, firstImg(p) || '', p.k || '']);
  }
  const sh = S?.shop || {}, ft = S?.footer || {};
  const idx = {
    at: Date.now(), items,
    shop: { name: sh.name || S?.brand?.appName || NAME, address: ft.address || sh.address || '', phone: sh.phone || ft.phones?.[0]?.phone || '', ig: ft.instagram || '', fb: ft.facebook || '', intro: ft.about || '' },
    catOver: S?.categories || {},
    sets: (S?.sets || []).filter((s) => s && s.id && s.name).map((s) => ({ id: s.id, name: s.name, desc: s.desc || '', items: (s.items || []).map((x) => String(x.id)) })),
  };
  ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(idx), { headers: { 'Cache-Control': 'max-age=21600', 'Content-Type': 'application/json' } })).catch(() => {}));
  return (MEM = prep(idx));
}
// dizinden türetilenler (önbelleğe yazılmaz): markalar, kategoriler, sayılar
function prep(idx) {
  const P = idx.items.map(([id, n, b, c, c2, r, s, img, k]) => ({ id, n, b, c, c2, r, s, img, k }));
  const byId = new Map(P.map((p) => [p.id, p]));
  // markalar: aynı adın farklı yazılışları tek sayfa (en çok kullanılan yazılış)
  const brands = new Map();
  for (const p of P) {
    if (!p.b) continue; const sl = slugify(p.b); if (!sl) continue;
    const e = brands.get(sl) || { slug: sl, names: new Map(), ids: [] };
    e.names.set(p.b, (e.names.get(p.b) || 0) + 1); e.ids.push(p.id); brands.set(sl, e);
  }
  for (const e of brands.values()) e.name = [...e.names].sort((a, b) => b[1] - a[1])[0][0];
  // kategoriler: site ağacı + panelde verilen adlar; gizlenenler (ve altları) yok
  const over = idx.catOver || {};
  const slugs = catSlugs(CAT_TREE, over);
  const node = new Map(CAT_TREE.map(([id, n, par]) => [id, { id, name: (over[id]?.name || n || '').trim(), par, hidden: !!over[id]?.hidden, ids: [] }]));
  const anc = (id) => { const out = []; let x = node.get(id), g = 0; while (x && g++ < 10) { out.push(x.id); x = x.par ? node.get(x.par) : null; } return out; };
  const hidden = (id) => anc(id).some((x) => node.get(x)?.hidden);
  for (const p of P) { const s = new Set([...anc(p.c), ...(p.c2 != null ? anc(p.c2) : [])]); for (const c of s) node.get(c)?.ids.push(p.id); }
  const cats = new Map();
  for (const n of node.values()) if (!hidden(n.id) && n.ids.length) cats.set(slugs.get(n.id), { ...n, slug: slugs.get(n.id), path: anc(n.id).reverse().map((x) => node.get(x)) });
  const catById = new Map([...cats.values()].map((c) => [c.id, c]));
  return { ...idx, P, byId, brands, cats, catById };
}

// ---- ürün açıklaması (descb kovası, ürün başına tek küçük belge)
async function descOf(id) {
  try {
    const meta = await doc('desc/_meta'); const bk = Number(meta?.bk) || 0; if (!bk) return '';
    const n = Number.isFinite(Number(id)) ? Math.abs(Math.trunc(Number(id))) % bk : 0;
    const b = await doc('descb/b' + n); return strip(b?.d?.[id] || '');
  } catch { return ''; }
}

// ---- sayfa başına: başlık, açıklama, JSON-LD, botlar için yazılı içerik
const A = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
function prodList(I, ids, max = 240) {
  const list = ids.map((id) => I.byId.get(id)).filter(Boolean);
  list.sort((a, b) => (b.s > 0) - (a.s > 0) || a.n.localeCompare(b.n, 'tr'));
  return '<ul>' + list.slice(0, max).map((p) => `<li>${A('/urun/' + p.id, p.n)}${p.b ? ' · ' + esc(p.b) : ''}${p.r ? ' · ' + usd(p.r) + ' +KDV' : ''}${p.s > 0 ? '' : ' · stokta yok'}</li>`).join('') + '</ul>' + (list.length > max ? `<p>… ve ${list.length - max} ürün daha.</p>` : '');
}
const brandLinks = (I) => '<ul>' + [...I.brands.values()].sort((a, b) => b.ids.length - a.ids.length).map((b) => `<li>${A('/marka/' + b.slug, b.name + ' ürünleri')} (${b.ids.length})</li>`).join('') + '</ul>';
const catLinks = (I, list) => '<ul>' + list.map((c) => `<li>${A('/kategori/' + c.slug, c.name)} (${c.ids.length})</li>`).join('') + '</ul>';
const topCats = (I) => [...I.cats.values()].filter((c) => !c.par || !I.catById.has(c.par));
const crumbs = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + url })) });
function storeLd(I) {
  const s = I.shop;
  return { '@type': 'Store', '@id': SITE + '/#store', name: NAME, url: SITE + '/', logo: SITE + '/icon-512.png', image: SITE + '/icon-512.png',
    description: 'Telefon tamircileri için havya, sıcak hava istasyonu, mikroskop, entegre, kalıp ve tamir ekipmanları.',
    ...(s.phone ? { telephone: s.phone } : {}), ...(s.address ? { address: { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: 'Fatih', addressRegion: 'İstanbul', addressCountry: 'TR' } } : {}),
    sameAs: [s.ig, s.fb].filter((x) => x && /^https?:/.test(x)) };
}

async function seoFor(path, I) {
  const brandsTop = [...I.brands.values()].sort((a, b) => b.ids.length - a.ids.length).slice(0, 6).map((b) => b.name);
  if (path === '/' || path === '') {
    return {
      title: `${NAME} | Telefon Tamir Ekipmanları – Havya, Sıcak Hava, Mikroskop`,
      desc: `Telefon tamircileri için havya, sıcak hava istasyonu, mikroskop, entegre ve kalıp. ${brandsTop.join(', ')} ve daha fazlası. Tahtakale, İstanbul.`,
      ld: [storeLd(I), { '@type': 'WebSite', name: NAME, url: SITE + '/', potentialAction: { '@type': 'SearchAction', target: SITE + '/urunler?q={q}', 'query-input': 'required name=q' } }],
      body: `<h1>${esc(NAME)} – Telefon tamir ekipmanları</h1><p>${esc(I.shop.intro || 'Telefon tamircileri için havya, sıcak hava istasyonu, mikroskop, entegre, kalıp ve tamir ekipmanları. Tahtakale, İstanbul.')}</p>`
        + `<p>${A('/urunler', 'Tüm ürünler')} · ${A('/kalip', 'Kalıp bulucu')}</p><h2>Markalar</h2>${brandLinks(I)}<h2>Kategoriler</h2>${catLinks(I, topCats(I))}`
        + (I.shop.address ? `<p>Adres: ${esc(I.shop.address)}${I.shop.phone ? ' · Telefon: ' + esc(I.shop.phone) : ''}</p>` : ''),
    };
  }
  if (path === '/urunler') {
    return { title: `Tüm Ürünler | ${NAME}`, desc: `${I.P.length} ürün: ${brandsTop.join(', ')} marka telefon tamir ekipmanları. ${NAME} online mağaza.`,
      ld: [crumbs([[NAME, '/'], ['Tüm ürünler', '/urunler']])],
      body: `<h1>Tüm ürünler</h1><h2>Kategoriler</h2>${catLinks(I, topCats(I))}<h2>Markalar</h2>${brandLinks(I)}<h2>Ürünler</h2>${prodList(I, I.P.map((p) => p.id), 400)}` };
  }
  if (path === '/kalip') {
    return { title: `Kalıp Bulucu – Telefon Modeline Göre Reball Kalıbı | ${NAME}`, desc: 'Telefon modelini yazın, işlemcisine uyan reball kalıplarını ve setleri bulun. iPhone, Samsung, Xiaomi ve daha fazlası.',
      ld: [crumbs([[NAME, '/'], ['Kalıp bulucu', '/kalip']])], body: `<h1>Kalıp bulucu</h1><p>Telefon modelini yazın; işlemcisine uyan reball kalıpları ve kalıp setleri listelenir.</p><p>${A('/urunler', 'Tüm ürünler')}</p>` };
  }
  let m = /^\/marka\/([a-z0-9-]+)$/.exec(path);
  if (m) {
    const b = I.brands.get(m[1]); if (!b) return null;
    const inStock = b.ids.filter((id) => I.byId.get(id)?.s > 0).length;
    return { title: `${b.name} Ürünleri ve Fiyatları | ${NAME}`, desc: `${b.name} marka telefon tamir ekipmanları: ${b.ids.length} ürün${inStock ? `, ${inStock} tanesi stokta` : ''}. ${NAME}, Tahtakale İstanbul. Hızlı kargo.`,
      ld: [crumbs([[NAME, '/'], ['Markalar', '/urunler'], [b.name, '/marka/' + b.slug]]), { '@type': 'CollectionPage', name: `${b.name} ürünleri`, url: SITE + '/marka/' + b.slug, about: { '@type': 'Brand', name: b.name } }],
      img: imgUrl(I.byId.get(b.ids[0])?.img), body: `<h1>${esc(b.name)} ürünleri</h1><p>${esc(NAME)} online mağazada ${b.ids.length} ${esc(b.name)} ürünü.</p>${prodList(I, b.ids)}<h2>Diğer markalar</h2>${brandLinks(I)}` };
  }
  m = /^\/kategori\/([a-z0-9-]+)$/.exec(path);
  if (m) {
    const c = I.cats.get(m[1]); if (!c) return null;
    const subs = [...I.cats.values()].filter((x) => x.par === c.id);
    const trail = c.path.filter((x) => I.catById.has(x.id));
    return { title: `${c.name} | ${NAME}`, desc: `${c.name}: ${c.ids.length} ürün. Telefon tamir ekipmanları ${NAME} online mağazada, Tahtakale İstanbul.`,
      ld: [crumbs([[NAME, '/'], ...trail.map((x) => [x.name, '/kategori/' + I.catById.get(x.id).slug])]), { '@type': 'CollectionPage', name: c.name, url: SITE + '/kategori/' + c.slug }],
      img: imgUrl(I.byId.get(c.ids[0])?.img),
      body: `<p>${trail.map((x) => A('/kategori/' + I.catById.get(x.id).slug, x.name)).join(' › ')}</p><h1>${esc(c.name)}</h1>${subs.length ? '<h2>Alt kategoriler</h2>' + catLinks(I, subs) : ''}<h2>Ürünler</h2>${prodList(I, c.ids)}` };
  }
  m = /^\/urun\/(\d+)$/.exec(path);
  if (m) {
    const p = I.byId.get(m[1]); if (!p) return null;
    const d = await descOf(p.id);
    const b = p.b ? I.brands.get(slugify(p.b)) : null; const c = I.catById.get(p.c) || I.catById.get(p.c2);
    const trail = c ? c.path.filter((x) => I.catById.has(x.id)) : [];
    const desc = cut(d, 155) || `${p.n}${p.b ? ' · ' + p.b : ''}${c ? ' · ' + c.name : ''}. ${NAME} online mağaza, Tahtakale İstanbul.`;
    const offer = p.r ? { '@type': 'Offer', url: SITE + '/urun/' + p.id, price: Number(p.r).toFixed(2), priceCurrency: 'USD', availability: 'https://schema.org/' + (p.s > 0 ? 'InStock' : 'OutOfStock'), itemCondition: 'https://schema.org/NewCondition',
      priceSpecification: { '@type': 'UnitPriceSpecification', price: Number(p.r).toFixed(2), priceCurrency: 'USD', valueAddedTaxIncluded: false }, seller: { '@type': 'Organization', name: NAME } } : undefined;
    return { title: `${cut(p.n, 70)} | ${NAME}`, desc, type: 'product', img: imgUrl(p.img),
      ld: [{ '@type': 'Product', name: p.n, image: [imgUrl(p.img)], ...(p.k ? { sku: p.k } : {}), ...(p.b ? { brand: { '@type': 'Brand', name: p.b } } : {}), ...(d ? { description: cut(d, 1000) } : {}), ...(c ? { category: c.name } : {}), ...(offer ? { offers: offer } : {}) },
        crumbs([[NAME, '/'], ...trail.map((x) => [x.name, '/kategori/' + I.catById.get(x.id).slug]), [p.n, '/urun/' + p.id]])],
      body: `<p>${trail.map((x) => A('/kategori/' + I.catById.get(x.id).slug, x.name)).join(' › ')}</p><h1>${esc(p.n)}</h1><img src="${esc(imgUrl(p.img))}" alt="${esc(p.n)}" width="400">`
        + `<p>${b ? 'Marka: ' + A('/marka/' + b.slug, b.name) + ' · ' : ''}${p.k ? 'Stok kodu: ' + esc(p.k) + ' · ' : ''}${p.r ? 'Fiyat: ' + usd(p.r) + ' +KDV · ' : ''}${p.s > 0 ? 'Stokta' : 'Stokta yok'}</p>`
        + (d ? `<div>${esc(cut(d, 4000)).replace(/\n/g, '<br>')}</div>` : '') + (b ? `<h2>Diğer ${esc(b.name)} ürünleri</h2>${prodList(I, b.ids.filter((x) => x !== p.id), 24)}` : '') };
  }
  m = /^\/set\/([\w-]+)$/.exec(path);
  if (m) {
    const s = I.sets.find((x) => x.id === m[1]); if (!s) return null;
    const first = I.byId.get(s.items[0]);
    return { title: `${s.name} – Set | ${NAME}`, desc: cut((s.desc ? s.desc + ' · ' : '') + `${s.items.length} ürünlük set. ${NAME}`, 160), img: imgUrl(first?.img),
      ld: [crumbs([[NAME, '/'], [s.name, '/set/' + s.id]])], body: `<h1>${esc(s.name)}</h1><p>${esc(s.desc)}</p>${prodList(I, s.items)}` };
  }
  return null;
}

function headTags(o, url) {
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': o.ld || [] }).replace(/</g, '\\u003c');
  return `<meta name="description" content="${esc(o.desc)}"><link rel="canonical" href="${esc(url)}"><meta name="x-seo-path" content="${esc(new URL(url).pathname)}">`
    + `<meta property="og:type" content="${o.type || 'website'}"><meta property="og:site_name" content="${NAME}"><meta property="og:locale" content="tr_TR"><meta property="og:title" content="${esc(o.title)}">`
    + `<meta property="og:description" content="${esc(o.desc)}"><meta property="og:url" content="${esc(url)}">${o.img ? `<meta property="og:image" content="${esc(o.img)}">` : ''}`
    + `<meta name="twitter:card" content="${o.img ? 'summary_large_image' : 'summary'}"><script type="application/ld+json">${ld}</script>`;
}

// sayfa sonucu: dizin + açıklama 1 gün önbellekte (aynı adres için Firestore'a tekrar gidilmez)
async function pageSeo(path, ctx) {
  const key = new Request('https://seo-page.cache/' + VER + path);
  try { const r = await caches.default.match(key); if (r) return await r.json(); } catch {}
  const I = await siteIndex(ctx);
  const o = await seoFor(path, I);
  ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(o), { headers: { 'Cache-Control': 'max-age=' + (o ? 86400 : 1800), 'Content-Type': 'application/json' } })).catch(() => {}));
  return o;
}

async function sitemap(ctx) {
  const key = new Request('https://seo-sitemap.cache/' + VER);
  try { const r = await caches.default.match(key); if (r) return new Response(r.body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'max-age=3600' } }); } catch {}
  const I = await siteIndex(ctx);
  const urls = [['/', '1.0'], ['/urunler', '0.9'], ['/kalip', '0.6'],
    ...[...I.brands.values()].map((b) => ['/marka/' + b.slug, '0.8']),
    ...[...I.cats.values()].map((c) => ['/kategori/' + c.slug, '0.8']),
    ...I.sets.map((s) => ['/set/' + s.id, '0.6']),
    ...I.P.map((p) => ['/urun/' + p.id, p.s > 0 ? '0.7' : '0.4'])];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(([u, pr]) => `<url><loc>${SITE}${esc(u)}</loc><priority>${pr}</priority></url>`).join('\n') + '\n</urlset>\n';
  ctx.waitUntil(caches.default.put(key, new Response(xml, { headers: { 'Cache-Control': 'max-age=21600' } })).catch(() => {}));
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'max-age=3600' } });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/__/auth/') || url.pathname.startsWith('/__/firebase/')) {
      const r = await fetch(FB + url.pathname + url.search, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body, redirect: 'manual' });
      return new Response(r.body, r);
    }
    if (url.pathname === '/sitemap.xml') { try { return await sitemap(ctx); } catch (e) { return new Response('sitemap: ' + e.message, { status: 503 }); } }
    const page = await env.ASSETS.fetch(req);
    if (req.method !== 'GET' || !(page.headers.get('content-type') || '').includes('text/html')) return page;
    // asıl adres: /magaza öneki ve sondaki / atılır, sorgu (?q=…) asıl adresin parçası değil
    const path = (url.pathname.replace(/^\/magaza(?=\/|$)/, '') || '/').replace(/(.)\/+$/, '$1');
    let o = null;
    try { o = await pageSeo(path, ctx); } catch { return page; }
    if (!o) return page;
    const bot = BOT.test(req.headers.get('user-agent') || '');
    const canon = SITE + path;
    const rw = new HTMLRewriter()
      // etiketler <title>'ın HEMEN ARKASINA: sayfa ~1,6 MB, WhatsApp sadece ilk kısmını okuyor
      .on('title', { element(e) { e.setInnerContent(o.title); e.after(headTags(o, canon), { html: true }); } });
    if (bot && o.body) rw.on('div#root', { element(e) { e.before(`<div id="ssr" style="max-width:960px;margin:0 auto;padding:16px;font:15px/1.5 system-ui,sans-serif">${o.body}<p>${A('/', NAME + ' ana sayfa')} · ${A('/urunler', 'Tüm ürünler')}</p></div>`, { html: true }); } });
    const res = rw.transform(page);
    const h = new Headers(res.headers); h.set('Vary', 'User-Agent');
    return new Response(res.body, { status: res.status, headers: h });
  },
};
