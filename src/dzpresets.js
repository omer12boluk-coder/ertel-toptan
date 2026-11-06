// Tasarım paketleri (5.11.2026): tasarım modundaki TÜM görünüm ayarlarının tek tıkla kaydedilip geri yüklenmesi.
// Paket sadece görünümü taşır: ürünler, reklam yazıları/resimleri/linkleri, bölüm sırası pakete GİRMEZ (onlar içerik).
// Kayıtlı paketler settings.dzPresets'te (herkese açık ayarlara gitmez). Yerleşik paket: 'apple' (Apple sade, Claude'un önerisi).

import { withPbSlides } from './photobn.jsx';
const pick = (o, ks) => { const r = {}; ks.forEach((k) => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
const strip = (o, ks) => { const r = { ...(o || {}) }; ks.forEach((k) => delete r[k]); return r; };
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

export const BRAND_KEYS = ['accent', 'priceAccent', 'nameColor', 'theme'];
export const CARD_KEYS = ['add', 'addPos', 'stockTag', 'hoverImgs', 'swipeImgs', 'productView', 'productViewM', 'descShort', 'brand'];
const HOME_KEYS0 = ['heroNav', 'heroH', 'marquee', 'mqSpeed', 'mqSpeedM', 'mqZ', 'mqZM', 'brandSize', 'brandLogoScale', 'brandCta', 'promosLay', 'gap'];
// 5.11.2026 (2): bölüm sırası, gizli bölümler, genişlik/yer de pakete girer (kayıtlı paket bunları geri yükler)
export const HOME_KEYS = [...HOME_KEYS0, 'layout', 'hidden', 'geo'];
export const SLIDE_KEYS = ['bg', 'theme', 'xc', 'bs', 'btn', 'ist', 'tc', 'sc'];
export const PROMO_KEYS = ['color', 'tc', 'f', 'ta', 'ibg', 'pat'];
const LOOK_SKIP = ['myPacks']; // kendi kaydettiğin tema stüdyosu temaları pakete bağlı değil, hep kalır

// şu anki görünümün kopyası (d = tasarım taslağı ya da ayarlar)
export function snapshot(d) {
  const H = d.shopHome || {};
  const blocks = {};
  Object.entries(H.blocks || {}).forEach(([id, b]) => { if (b?.t === 'promos') blocks[id] = (b.items || []).map((x) => pick(x, PROMO_KEYS)); });
  return clone({
    look: strip(d.look, LOOK_SKIP),
    brand: pick(d.brand, BRAND_KEYS),
    cards: pick(d.cards, CARD_KEYS),
    home: pick(H, HOME_KEYS), ks: HOME_KEYS,
    slides: (H.slides || []).map((s) => pick(s, SLIDE_KEYS)),
    promos: (H.promos || []).map((x) => pick(x, PROMO_KEYS)),
    blocks,
  });
}

// paketi taslağa uygula: paketteki görünüm anahtarları yazılır, pakette olmayan görünüm anahtarları SİLİNİR (böylece geri dönüş birebir olur)
// p.merge (hazır paketler): SADECE paketin yazdığı ayarlar değişir, gerisi (ör. 'Ürüne basınca') olduğu gibi kalır.
// Kayıtlı paket (snapshot): birebir geri dönüş — pakette olmayan görünüm anahtarı silinir.
export function applyPreset(d, p) {
  const n = clone(d); const H = (n.shopHome = n.shopHome || {});
  if (p.merge) {
    n.look = { ...(n.look || {}), ...clone(p.look || {}) };
    n.brand = { ...(n.brand || {}), ...clone(p.brand || {}) };
    n.cards = { ...(n.cards || {}), ...clone(p.cards || {}) };
    Object.assign(H, clone(p.home || {}));
    if (p.layoutFn === 'claude') Object.assign(H, claudeLayout(H));
    if (p.layoutFn === 'p0') Object.assign(H, p0Layout(H));
    if (p.layoutFn === 'cd') Object.assign(H, cdLayout(H));
  } else {
    n.look = { ...clone(p.look || {}), ...(d.look?.myPacks ? { myPacks: clone(d.look.myPacks) } : {}) };
    n.brand = { ...strip(n.brand, BRAND_KEYS), ...clone(p.brand || {}) };
    n.cards = { ...strip(n.cards, CARD_KEYS), ...clone(p.cards || {}) };
    (p.ks || HOME_KEYS0).forEach((k) => delete H[k]); Object.assign(H, clone(p.home || {}));
    // kayıttaki raf kimliği artık yoksa (raf yeniden oluşturulduysa) aynı sıradaki mevcut rafla eşlenir
    if (Array.isArray(H.layout)) {
      const R = (H.sections || []).filter((r) => r.id).map((r) => 'rail:' + r.id);
      const miss = R.filter((k) => !H.layout.includes(k));
      H.layout = H.layout.map((k) => (k.startsWith('rail:') && !R.includes(k) && miss.length ? miss.shift() : k));
    }
  }
  // Claude düzeninden başka pakete geçince: o paketin gizlediği eski reklamlar geri açılır (geri dönüş birebir)
  if (p.layoutFn !== 'cd' && Array.isArray(H.slides)) H.slides = H.slides.map((s) => (s?.offBy === 'cd' ? strip(s, ['off', 'offBy']) : s));
  // listedeki sıraya göre (paket kaydedildiğinden beri reklam eklendiyse fazlası döngüyle renk alır)
  const each = (list, src, keys) => (list || []).map((x, i) => {
    if (!src?.length) return x;
    return { ...strip(x, keys), ...clone(src[i % src.length] || {}) };
  });
  // hazır pakette (merge) kullanıcının KENDİ seçtiği banner arka planı (ör. Altın varak) korunur; sadece arka planı seçilmemiş banner renk alır
  H.slides = p.merge ? (H.slides || []).map((x, i) => (x.bg || !p.slides?.length ? x : { ...x, ...clone(p.slides[i % p.slides.length]) })) : each(H.slides, p.slides, SLIDE_KEYS);
  H.promos = each(H.promos, p.promos, PROMO_KEYS);
  if (H.blocks) Object.entries(H.blocks).forEach(([id, b]) => { if (b?.t !== 'promos') return; const src = p.blocks?.[id] || p.promos; H.blocks[id] = { ...b, items: each(b.items, src, PROMO_KEYS) }; });
  return n;
}

// hangi paket şu an uygulanmış gibi görünüyor (kayıtla birebir aynıysa)
export const sameAs = (d, p) => { try { return JSON.stringify(snapshot(d)) === JSON.stringify(snapshot(applyPreset(d, p))); } catch { return false; } };

// ---- Paket 1: Claude'un tasarımı (5.11.2026 (2)) ------------------------------------------------------------------------------
// Tema Stüdyosu'ndaki 'Apple · renk ağı' teması (renk ağı zemin + buzlu cam kartlar) + Apple açık site teması + sayfa düzeni toparlama.
// SADECE aşağıdakileri değiştirir (merge); ürün açılışı, fiyat gösterimi, reklam yazıları/resimleri/linkleri aynen kalır.
const APPLE_SLIDES = [{ bg: 'p-midnight' }, { bg: 'p-graphite' }, { bg: 'p-sage' }, { bg: 'p-copper' }, { bg: 'p-ink' }];
const APPLE_BOXES = ['#24324f', '#3f5a4b', '#7a4a32', '#3a3a42', '#2c3f63', '#5c4a6b'];
// sayfa düzeni: banner → avantajlar → öne çıkan kutular → ilk raf → marka şeridi → diğer raflar ve bölümler → setler → favoriler → alt bant.
// Büyük marka kutuları ızgarası gizlenir (markalar zaten kayan şeritte ve üst menüdeki Markalar ▾ menüsünde; sayfada çok yer kaplıyordu).
export function claudeLayout(H) {
  const L = Array.isArray(H.layout) ? H.layout : [];
  const has = (k) => L.includes(k);
  const rails = L.filter((k) => k.startsWith('rail:')); const blocks = L.filter((k) => k.startsWith('b:'));
  const want = ['hero', 'usps', 'promos', rails[0], 'marquee', ...rails.slice(1), ...blocks, 'sets', 'fav', 'brands'].filter((k) => k && has(k));
  const rest = L.filter((k) => !want.includes(k) && k !== 'cta');
  const layout = [...want, ...rest, ...(has('cta') ? ['cta'] : [])];
  const hidden = [...new Set([...(H.hidden || []), 'brands'])];
  return { layout, hidden };
}
export const CLAUDE_CHANGES = ['Büyük marka kutuları ızgarası gizlendi (markalar kayan şeritte ve üst menüde var)', 'Öne çıkan kutular avantaj şeridinin hemen altına alındı', 'Kayan marka şeridi ilk ürün rafının altına alındı', 'Alt bant (WhatsApp) en sona'];
export const APPLE = {
  id: 'apple', builtin: true, merge: true, layoutFn: 'claude', name: 'Claude’un tasarımı', note: 'Apple · renk ağı teması, buzlu cam kartlar, Inter yazı, orta genişlik, toparlanmış sayfa düzeni',
  sw: ['#f5f5f7', '#0a66d6', '#24324f', '#f2a876'],
  data: {
    merge: true, layoutFn: 'claude',
    look: {
      site: 'apple', glass: true, header: 'search', hideTop: 'top', botnav: 'glass', motion: 'clear', motionD: 'soft', pill: 'flow',
      width: 'mid', edge: 24, boxPat: 'glow', bgFx: '', logoTone: '', decor: { id: '', amt: 'md', front: true },
      pack: { id: 'apple-mesh', parts: {}, amt: 'md' }, keep: {},
      style: { head: 'intert', body: 'inter', price: 'intert', hw: 700, hls: -0.02, rCard: 18, rBox: 24, rHero: 30, rBtn: 999, shadow: 'soft', border: 'none', imgFit: 'contain', imgBg: '#ffffff', imgPad: 12, hover: 'lift', title: 'plain', gap: 44 },
    },
    brand: { theme: 'light' },
    home: { heroNav: { full: '', dots: 'bars', dpos: '', arr: 'glass' }, marquee: 'mono', gap: 40 },
    slides: APPLE_SLIDES.map((s) => ({ ...s, xc: '', bs: '' })),
    promos: APPLE_BOXES.map((c) => ({ color: c })),
    blocks: {},
  },
};

// ---- Paket 0 (6.11.2026): sıfırdan yeni ana sayfa ------------------------------------------------------------------------------
// Yeni bölümler (p0:*) eklenir; eski bölümler GİZLENİR (silinmez, Katmanlar'dan göz simgesiyle açılır). Paket 2'ye basınca birebir eski hâl.
const P0_ORDER = ['p0:hero', 'p0:find', 'p0:cats', '@rail0', 'p0:pick', '@rail1', 'p0:sets', 'p0:brands', 'p0:trust'];
const OLD_FIXED = ['hero', 'usps', 'marquee', 'brands', 'promos', 'fav', 'sets'];
export function p0Layout(H) {
  const L0 = (Array.isArray(H.layout) ? H.layout : []).filter((k) => !k.startsWith('p0:'));
  const rails = (H.sections || []).map((r, i) => 'rail:' + (r.id || i)).filter((k) => !L0.length || L0.includes(k));
  const want = P0_ORDER.map((k) => (k === '@rail0' ? rails[0] : k === '@rail1' ? rails[1] : k)).filter(Boolean);
  const rest = L0.filter((k) => !want.includes(k) && k !== 'cta');
  const layout = [...want, ...rest, 'cta'];
  const hidden = [...new Set([...(H.hidden || []).filter((k) => !want.includes(k)), ...OLD_FIXED, ...rest.filter((k) => k.startsWith('rail:') || k.startsWith('b:'))])];
  return { layout, hidden };
}
export const P0_CHANGES = ['Üçlü vitrin: ilk reklam büyük kutuda (sonrakilerle sırayla döner), 2. ve 3. reklam yanda', 'Hızlı bulucu: telefon modelini yaz, uyan kalıp ve parçalar orada çıksın + hızlı kategori/marka geçişi', 'Kategori karoları (resimler kategorideki ürünlerden)', 'Tamircinin seçimi: öne çıkanlardan bir büyük + dört küçük', 'Atölyeni kur: setler tek bantta', 'Akan marka bandı (gri logolar, üstüne gelince renkli)', 'Güven şeridi (avantaj yazıların)', 'Porselen beyaz kutular, siyah seçili hap, gri Sepete ekle', 'Ürünler’e basınca önce kategoriler (Tüm ürünler sağ üstte)', 'Eski bölümler gizlendi, silinmedi (Katmanlar › göz simgesi)'];
export const P0 = {
  id: 'p0', builtin: true, merge: true, layoutFn: 'p0', num: 0, name: 'Yeni mağaza', note: 'Sıfırdan yeni ana sayfa: üçlü vitrin, hızlı bulucu, kategori karoları, seçki ızgarası, set bandı, marka bandı · porselen kutular',
  sw: ['#f5f5f4', '#16181d', '#2f62d6', '#c97a3a'],
  data: {
    merge: true, layoutFn: 'p0',
    look: {
      site: 'apple', glass: true, header: 'search', hideTop: 'top', botnav: 'glass', motion: 'clear', motionD: 'soft', pill: 'flow', pillTone: 'dark', addColor: 'gray', porc: true, prodHub: true,
      width: '', edge: 28, boxPat: 'glow', bgFx: 'glow', logoTone: '', decor: { id: '', amt: 'md', front: true }, pack: {}, keep: {}, shopAccent: '#2f62d6', bg: '#f5f5f4',
      style: { head: 'manrope', body: 'inter', price: 'manrope', hw: 800, hls: -0.025, rCard: 20, rBox: 28, rHero: 32, rBtn: 999, shadow: 'soft', border: 'none', imgFit: 'contain', imgBg: '#ffffff', imgPad: 12, hover: 'lift', title: 'plain', gap: 56 },
    },
    brand: { theme: 'light' },
    home: { gap: 56 },
    slides: [{ bg: 'p-midnight' }, { bg: 'p-copper' }, { bg: 'p-mist' }, { bg: 'p-graphite' }, { bg: 'p-ink' }].map((x) => ({ ...x, xc: '', bs: '' })),
    promos: [], blocks: {},
  },
};

// ---- Claude düzeni (7.11.2026): fotoğraflı bannerların diliyle ana sayfa (cdhome.jsx, docs/banner-kurallari.md) ----------------------
// Bannerlar kullanıcının reklam listesine taşınır (pb satırları), eski reklamlar GİZLENİR (off, silinmez). Eski bölümler gizlenir, rafların ilk ikisi yeni kartlarla.
const CD_ORDER = ['cd:hero', 'p0:find', 'cd:pick', '@rail0', 'cd:sets', 'cd:brands', '@rail1', 'cd:mq', 'p0:trust'];
export function cdLayout(H) {
  const L0 = (Array.isArray(H.layout) ? H.layout : []).filter((k) => !k.startsWith('p0:') && !k.startsWith('cd:'));
  const rails = (H.sections || []).map((r, i) => 'rail:' + (r.id || i)).filter((k) => !L0.length || L0.includes(k));
  const want = CD_ORDER.map((k) => (k === '@rail0' ? rails[0] : k === '@rail1' ? rails[1] : k)).filter(Boolean);
  const rest = L0.filter((k) => !want.includes(k) && k !== 'cta');
  const layout = [...want, ...rest, ...(H.layout || []).filter((k) => k.startsWith('p0:') && !want.includes(k)), 'cta'];
  const hidden = [...new Set([...(H.hidden || []).filter((k) => !want.includes(k)), ...OLD_FIXED, 'p0:hero', 'p0:cats', 'p0:pick', 'p0:sets', 'p0:brands', ...rest.filter((k) => k.startsWith('rail:') || k.startsWith('b:'))])];
  return { layout, hidden, slides: withPbSlides(H.slides) };
}
export const CD_CHANGES = ['Banner: 7 fotoğraflı banner sizin reklam listenizde (yazı, sıra, aç/kapa); eski reklamlarınız gizlendi, silinmedi', 'Bu hafta masamızdan: haftanın ürünü + dört ürün, logolu, kısa adlı', 'Atölyeni kur: her set kendi kartında', 'Markalar: büyük marka kartları', 'Akan şerit: renkli logolar', 'Ürün rafları: yeni kart dili (fiyat ve Sepete ekle hep aynı hizada)', 'Hızlı bulucu ve güven şeridi Paket 0’dan', 'Eski bölümler gizlendi, silinmedi'];
export const CD = {
  id: 'cd', builtin: true, merge: true, layoutFn: 'cd', name: 'Claude düzeni', note: 'Fotoğraflı bannerların diliyle: sade zemin, marka logoları, kısa adlar, tek düğme · tasarım modu v3',
  sw: ['#f5f5f7', '#1d1d1f', '#2f62d6', '#ffffff'],
  data: {
    merge: true, layoutFn: 'cd',
    look: {
      site: 'apple', cd: true, glass: true, header: 'search', hideTop: 'top', botnav: 'glass', motion: 'clear', motionD: 'soft', pill: 'flow', porc: false, prodHub: true,
      width: '', edge: 28, boxPat: 'none', bgFx: 'plain', logoTone: '', decor: { id: '', amt: 'md', front: true }, pack: {}, keep: {}, shopAccent: '#2f62d6', bg: '#f5f5f7',
      style: { head: 'intert', body: 'inter', price: 'intert', hw: 600, hls: -0.03, rCard: 24, rBox: 28, rHero: 30, rBtn: 999, shadow: 'none', border: 'none', imgFit: 'contain', imgBg: '#ffffff', imgPad: 12, hover: 'none', title: 'plain', gap: 64 },
    },
    brand: { theme: 'light' },
    home: { gap: 64 },
    slides: [], promos: [], blocks: {},
  },
};

// eski kayıtlı paketlere (bölüm sırası saklanmadan önce kaydedilmiş) yayındaki bölüm sırası eklenir — paketler sırayı hiç değiştirmediği için doğru
export function upgradePresets(list, H) {
  let ch = false;
  const out = (list || []).map((p) => {
    if (p.data?.ks) return p; ch = true;
    return { ...p, data: { ...p.data, home: { ...pick(H || {}, ['layout', 'hidden', 'geo']), ...(p.data?.home || {}) }, ks: HOME_KEYS } };
  });
  return ch ? out : null;
}

// köşe seçimi → stil stüdyosu köşe değerleri
export const CORNERS = [
  ['sharp', 'Sivri', { rCard: 4, rBox: 6, rHero: 8, rBtn: 8 }],
  ['soft', 'Yumuşak', { rCard: 18, rBox: 24, rHero: 30, rBtn: 999 }],
  ['round', 'Çok yuvarlak', { rCard: 26, rBox: 34, rHero: 40, rBtn: 999 }],
];
export const WIDTHS = [['narrow', 'Dar', 1280], ['mid', 'Orta', 1440], ['', 'Geniş', 1640], ['full', 'Tam ekran', 0]];
export const BOX_PATS = [['', 'Halka'], ['glow', 'Yumuşak ışık'], ['grid', 'İnce ızgara'], ['wave', 'Dalga'], ['none', 'Düz']];
export const BG_FX = [['', 'Temanın'], ['glow', 'Yumuşak ışık'], ['plain', 'Düz']];
export const BOX_COLORS = [['#24324f', 'Gece mavisi'], ['#3f5a4b', 'Adaçayı'], ['#7a4a32', 'Bakır'], ['#3a3a42', 'Grafit'], ['#2c3f63', 'Mürekkep'], ['#5c4a6b', 'Erik'], ['#e9e4da', 'Kum'], ['#dfe7f5', 'Sis']];

// sayfa genişliği / kenar boşluğu / kutu deseni / zemin ışığı → html sınıfları + CSS değişkenleri (mağaza useTheme + tasarım çerçevesi)
export const LAYOUT_CLS = ['pw-narrow', 'pw-mid', 'pw-full', 'pg-edge', 'bp-glow', 'bp-grid', 'bp-wave', 'bp-none', 'bgfx-glow', 'bgfx-plain'];
export function layoutOut(L = {}) {
  const cls = []; const vars = { '--pw-max': '', '--pg-edge': '' };
  const w = WIDTHS.find((x) => x[0] === L.width);
  if (w && w[0]) { cls.push('pw-' + w[0]); vars['--pw-max'] = w[2] ? w[2] + 'px' : 'none'; }
  if (L.edge != null && L.edge !== '') { cls.push('pg-edge'); vars['--pg-edge'] = Number(L.edge) + 'px'; }
  if (['glow', 'grid', 'wave', 'none'].includes(L.boxPat)) cls.push('bp-' + L.boxPat);
  if (['glow', 'plain'].includes(L.bgFx)) cls.push('bgfx-' + L.bgFx);
  return { cls, vars };
}
export function applyLayout(r, L) {
  const { cls, vars } = layoutOut(L);
  LAYOUT_CLS.forEach((c) => r.classList.toggle(c, cls.includes(c)));
  Object.entries(vars).forEach(([k, v]) => (v ? r.style.setProperty(k, v) : r.style.removeProperty(k)));
}

// telefonda farklı seçilen görünüm ayarları (anahtar + 'M'): telefonda onlar geçerli
export const DEV_KEYS = ['header', 'hideTop', 'glass', 'pill'];
export function lookFor(L = {}, phone) {
  if (!phone || !L) return L || {};
  const o = { ...L };
  DEV_KEYS.forEach((k) => { if (L[k + 'M'] !== undefined && L[k + 'M'] !== null) o[k] = L[k + 'M']; });
  return o;
}
