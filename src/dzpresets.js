// Tasarım paketleri (5.11.2026): tasarım modundaki TÜM görünüm ayarlarının tek tıkla kaydedilip geri yüklenmesi.
// Paket sadece görünümü taşır: ürünler, reklam yazıları/resimleri/linkleri, bölüm sırası pakete GİRMEZ (onlar içerik).
// Kayıtlı paketler settings.dzPresets'te (herkese açık ayarlara gitmez). Yerleşik paket: 'apple' (Apple sade, Claude'un önerisi).

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
