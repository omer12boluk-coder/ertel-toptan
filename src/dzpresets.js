// Tasarım paketleri (5.11.2026): tasarım modundaki TÜM görünüm ayarlarının tek tıkla kaydedilip geri yüklenmesi.
// Paket sadece görünümü taşır: ürünler, reklam yazıları/resimleri/linkleri, bölüm sırası pakete GİRMEZ (onlar içerik).
// Kayıtlı paketler settings.dzPresets'te (herkese açık ayarlara gitmez). Yerleşik paket: 'apple' (Apple sade, Claude'un önerisi).

const pick = (o, ks) => { const r = {}; ks.forEach((k) => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
const strip = (o, ks) => { const r = { ...(o || {}) }; ks.forEach((k) => delete r[k]); return r; };
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

export const BRAND_KEYS = ['accent', 'priceAccent', 'nameColor', 'theme'];
export const CARD_KEYS = ['add', 'addPos', 'stockTag', 'hoverImgs', 'swipeImgs', 'productView', 'productViewM', 'descShort', 'brand'];
export const HOME_KEYS = ['heroNav', 'heroH', 'marquee', 'mqSpeed', 'mqSpeedM', 'mqZ', 'mqZM', 'brandSize', 'brandLogoScale', 'brandCta', 'promosLay', 'gap'];
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
    home: pick(H, HOME_KEYS),
    slides: (H.slides || []).map((s) => pick(s, SLIDE_KEYS)),
    promos: (H.promos || []).map((x) => pick(x, PROMO_KEYS)),
    blocks,
  });
}

// paketi taslağa uygula: paketteki görünüm anahtarları yazılır, pakette olmayan görünüm anahtarları SİLİNİR (böylece geri dönüş birebir olur)
export function applyPreset(d, p) {
  const n = clone(d); const H = (n.shopHome = n.shopHome || {});
  n.look = { ...clone(p.look || {}), ...(d.look?.myPacks ? { myPacks: clone(d.look.myPacks) } : {}) };
  n.brand = { ...strip(n.brand, BRAND_KEYS), ...clone(p.brand || {}) };
  n.cards = { ...strip(n.cards, CARD_KEYS), ...clone(p.cards || {}) };
  HOME_KEYS.forEach((k) => delete H[k]); Object.assign(H, clone(p.home || {}));
  // listedeki sıraya göre (paket kaydedildiğinden beri reklam eklendiyse fazlası döngüyle renk alır)
  const each = (list, src, keys) => (list || []).map((x, i) => {
    if (!src?.length) return x;
    return { ...strip(x, keys), ...clone(src[i % src.length] || {}) };
  });
  H.slides = each(H.slides, p.slides, SLIDE_KEYS);
  H.promos = each(H.promos, p.promos, PROMO_KEYS);
  if (H.blocks) Object.entries(H.blocks).forEach(([id, b]) => { if (b?.t !== 'promos') return; const src = p.blocks?.[id] || p.promos; H.blocks[id] = { ...b, items: each(b.items, src, PROMO_KEYS) }; });
  return n;
}

// hangi paket şu an uygulanmış gibi görünüyor (kayıtla birebir aynıysa)
export const sameAs = (d, p) => { try { return JSON.stringify(snapshot(d)) === JSON.stringify(snapshot(applyPreset(d, p))); } catch { return false; } };

// ---- Paket 1: Apple sade (Claude'un sıfırdan önerisi) -------------------------------------------------------------------------
// banner arka planları: derin, sakin tonlar (presets.js 'p-*'); reklam kutuları: uyumlu derin + açık tonlar
const APPLE_SLIDES = [{ bg: 'p-midnight' }, { bg: 'p-graphite' }, { bg: 'p-sage' }, { bg: 'p-copper' }, { bg: 'p-ink' }];
const APPLE_BOXES = ['#24324f', '#3f5a4b', '#7a4a32', '#3a3a42', '#2c3f63', '#5c4a6b'];
export const APPLE = {
  id: 'apple', builtin: true, name: 'Apple sade', note: 'Claude’un önerisi: açık gri zemin, yumuşak ışık, tek mavi vurgu, ölçülü köşeler, Inter yazı',
  sw: ['#f5f5f7', '#0a66d6', '#24324f', '#3f5a4b'],
  data: {
    look: {
      site: 'apple', glass: true, header: 'search', hideTop: 'top', botnav: 'glass', motion: 'clear',
      shopAccent: '#0a66d6', shopPrice: '#1d1d1f', bg: '#f5f5f7', cardR: 18,
      width: 'mid', edge: 24, corner: 'soft', boxPat: 'glow', bgFx: 'glow', logoTone: '',
      decor: { id: '', amt: 'md', front: true }, pack: null,
      style: { head: 'intert', body: 'inter', price: 'intert', hw: 700, hls: -0.02, rCard: 18, rBox: 24, rHero: 30, rBtn: 999, shadow: 'soft', border: 'none', imgFit: 'contain', imgBg: '#ffffff', imgPad: 12, hover: 'lift', title: 'plain', gap: 44 },
      keep: {},
    },
    brand: { theme: 'light' },
    cards: { addPos: 'bottom', stockTag: true },
    home: { heroNav: { full: '', dots: 'bars', dpos: '', arr: 'glass' }, marquee: 'mono', gap: 44, promosLay: { lay: 'grid' } },
    slides: APPLE_SLIDES.map((s) => ({ ...s, xc: '', bs: '' })),
    promos: APPLE_BOXES.map((c) => ({ color: c, pat: 'glow' })),
    blocks: {},
  },
};

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
