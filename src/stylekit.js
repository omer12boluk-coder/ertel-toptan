// Stil Stüdyosu (look.style): mağazanın genel görünüşü — yazı tipleri, köşeler, gölge/çerçeve, ürün resimleri, bölüm başlıkları,
// boşluklar. Her özellik AYRI bir html sınıfıyla açılır (st-…); ayarlanmamış özellik mağazayı hiç değiştirmez (eski görünüm piksel
// piksel aynı kalır). Sadece mağazada (role public) ve tasarım modunun önizleme çerçevesinde uygulanır; yönetim paneli değişmez.
import { FONT_BY, ensureFonts } from './slidex.jsx';

const fam = (id) => (FONT_BY[id]?.fam ? `'${FONT_BY[id].fam}', system-ui, sans-serif` : '');

// hazır stiller: tek tıkla birçok ayar (pal = isteğe bağlı renkler: ana renk, fiyat, sayfa zemini)
export const STYLE_PRESETS = [
  { id: 'apple', n: 'Apple sade', d: 'Inter Tight başlık, Inter metin, ölçülü yumuşak köşeler, hap düğmeler, hafif gölge (5.11.2026)', pv: ['#f5f5f7', '#0a66d6', '#ffffff'],
    s: { head: 'intert', body: 'inter', price: 'intert', hw: 700, hls: -0.02, rCard: 18, rBox: 24, rHero: 30, rBtn: 999, shadow: 'soft', border: 'none', imgFit: 'contain', imgBg: '#ffffff', imgPad: 12, hover: 'lift', title: 'plain', gap: 44 },
    pal: { accent: '#0a66d6', price: '#1d1d1f', bg: '#f5f5f7' } },
  { id: 'lux', n: 'Lüks sade', d: 'Beymen tarzı: köşesiz, gölgesiz, bol boşluk, büyük harf ince başlıklar, kare ürün resimleri', pv: ['#ffffff', '#111111', '#f4f4f4'],
    s: { head: 'montserrat', body: 'inter', price: 'inter', hw: 500, hup: true, hls: 0.14, rCard: 0, rBox: 0, rHero: 0, rBtn: 0, shadow: 'none', border: 'none', imgFit: 'contain', imgBg: '#f4f4f4', imgPad: 0, hover: 'zoom', title: 'center', gap: 56, pw: 500 },
    pal: { accent: '#111111', price: '#111111', bg: '#ffffff' } },
  { id: 'modern', n: 'Modern minimal', d: 'Temiz yazı, yumuşak köşeler, hap düğmeler, hafif gölge', pv: ['#f7f7f8', '#4f46e5', '#ffffff'],
    s: { head: 'inter', body: 'inter', price: 'inter', hw: 800, hup: false, hls: -0.01, rCard: 16, rBox: 22, rHero: 26, rBtn: 999, shadow: 'soft', border: 'thin', imgFit: 'contain', imgBg: '#ffffff', imgPad: 14, hover: 'lift', title: 'plain', gap: 40, pw: 800 },
    pal: { accent: '#4f46e5', price: '#111827', bg: '#f7f7f8' } },
  { id: 'classic', n: 'Klasik / eski usul', d: 'Zarif tırnaklı başlıklar, krem zemin, ince çizgiler, az yuvarlak köşe', pv: ['#f6f0e4', '#7a2e1d', '#fffdf8'],
    s: { head: 'playfair', body: 'merri', price: 'playfair', hw: 700, hup: false, hls: 0, rCard: 4, rBox: 6, rHero: 6, rBtn: 4, shadow: 'none', border: 'bold', imgFit: 'contain', imgBg: '#fffdf8', imgPad: 14, hover: 'none', title: 'line', gap: 44, pw: 700 },
    pal: { accent: '#7a2e1d', price: '#7a2e1d', bg: '#f6f0e4' } },
  { id: 'bold', n: 'Güçlü vitrin', d: 'Kalın dar başlıklar, belirgin gölge, canlı renk: kampanya havası', pv: ['#f2f2f2', '#e11d48', '#111111'],
    s: { head: 'anton', body: 'rubik', price: 'anton', hw: 400, hup: true, hls: 0.02, rCard: 10, rBox: 14, rHero: 16, rBtn: 10, shadow: 'strong', border: 'none', imgFit: 'contain', imgBg: '#ffffff', imgPad: 12, hover: 'lift', title: 'bar', gap: 36, pw: 400 },
    pal: { accent: '#e11d48', price: '#e11d48', bg: '#f2f2f2' } },
  { id: 'soft', n: 'Yumuşak / sevimli', d: 'Yuvarlak yazı, çok yuvarlak köşeler, pastel zemin', pv: ['#fdf4f8', '#db2777', '#ffffff'],
    s: { head: 'fredoka', body: 'nunito', price: 'fredoka', hw: 700, hup: false, hls: 0, rCard: 26, rBox: 30, rHero: 32, rBtn: 999, shadow: 'soft', border: 'none', imgFit: 'contain', imgBg: '#ffffff', imgPad: 16, hover: 'lift', title: 'dot', gap: 40, pw: 700 },
    pal: { accent: '#db2777', price: '#be185d', bg: '#fdf4f8' } },
  { id: 'tech', n: 'Teknik / atölye', d: 'Dar başlık, rakamlar teknik yazıyla, keskin köşe, ince çerçeve', pv: ['#eef2f6', '#0ea5e9', '#0f172a'],
    s: { head: 'barlowc', body: '', price: 'mono', hw: 800, hup: true, hls: 0.03, rCard: 6, rBox: 8, rHero: 10, rBtn: 6, shadow: 'none', border: 'thin', imgFit: 'contain', imgBg: '#ffffff', imgPad: 12, hover: 'lift', title: 'bar', gap: 32, pw: 700 },
    pal: { accent: '#0284c7', price: '#0f172a', bg: '#eef2f6' } },
  { id: 'photo', n: 'Fotoğraf ağırlıklı', d: 'Resimler kutuyu doldurur (kare kırpılır), yazılar küçük, köşeler hafif', pv: ['#ffffff', '#0f172a', '#e5e7eb'],
    s: { head: 'poppins', body: 'inter', price: 'poppins', hw: 600, hup: false, hls: 0, rCard: 8, rBox: 12, rHero: 14, rBtn: 8, shadow: 'none', border: 'none', imgFit: 'cover', imgBg: '#ffffff', imgPad: 0, hover: 'zoom', title: 'plain', gap: 40, pw: 600 },
    pal: { accent: '#0f172a', price: '#0f172a', bg: '#ffffff' } },
];
export const PRESET_BY = Object.fromEntries(STYLE_PRESETS.map((p) => [p.id, p]));

export const SHADOWS = [['', 'Varsayılan'], ['none', 'Yok'], ['soft', 'Hafif'], ['strong', 'Belirgin']];
export const BORDERS = [['', 'Varsayılan'], ['none', 'Yok'], ['thin', 'İnce'], ['bold', 'Kalın']];
export const HOVERS = [['', 'Varsayılan'], ['lift', 'Yukarı kalksın'], ['zoom', 'Sadece resim büyüsün'], ['none', 'Hareket yok']];
export const TITLES = [['', 'Varsayılan (renkli çubuk)'], ['plain', 'Sade'], ['bar', 'Çubuk'], ['dot', 'Nokta'], ['line', 'Alt çizgi'], ['center', 'Ortalı, ince']];

const set = (r, k, v) => (v == null || v === '' ? r.style.removeProperty(k) : r.style.setProperty(k, v));
const has = (v) => v != null && v !== '';

// stil → { vars: CSS değişkenleri, cls: html sınıfları, fonts: yüklenecek yazı tipi kimlikleri }
export function styleOut(st) {
  const s = st || {}; const vars = {}; const cls = []; const fonts = [];
  if (s.head && fam(s.head)) { vars['--st-head'] = fam(s.head); cls.push('st-fh'); fonts.push(s.head); }
  if (s.body && fam(s.body)) { vars['--st-body'] = fam(s.body); cls.push('st-fb'); fonts.push(s.body); }
  if (s.price && fam(s.price)) { vars['--st-price'] = fam(s.price); cls.push('st-fp'); fonts.push(s.price); }
  if (has(s.hw)) { vars['--st-hw'] = String(s.hw); cls.push('st-hw'); }
  if (s.hup) cls.push('st-hup');
  if (has(s.hls)) { vars['--st-hls'] = s.hls + 'em'; cls.push('st-hls'); }
  if (has(s.hz)) { vars['--st-hz'] = String(s.hz); cls.push('st-hz'); }
  if (has(s.pw)) { vars['--st-pw'] = String(s.pw); cls.push('st-pw'); }
  if (has(s.rCard)) { vars['--pcard-r'] = s.rCard + 'px'; vars['--st-rcard'] = s.rCard + 'px'; } // 7.11.2026 (11) Claude düzeni kartları da --st-rcard okur
  if (has(s.rBox)) { vars['--st-rbox'] = s.rBox + 'px'; cls.push('st-rbox'); }
  if (has(s.rHero)) { vars['--st-rhero'] = s.rHero + 'px'; cls.push('st-rhero'); }
  if (has(s.rBtn)) { vars['--st-rbtn'] = s.rBtn + 'px'; cls.push('st-rbtn'); }
  if (s.shadow) cls.push('st-sh-' + s.shadow);
  if (s.border) cls.push('st-bd-' + s.border);
  if (s.imgFit === 'cover') cls.push('st-img-cover');
  if (has(s.imgBg)) { vars['--st-imgbg'] = s.imgBg; cls.push('st-imgbg'); }
  if (has(s.imgPad)) { vars['--st-imgpad'] = s.imgPad + 'px'; cls.push('st-imgpad'); }
  if (s.hover) cls.push('st-hv-' + s.hover);
  if (s.title) cls.push('st-tt-' + s.title);
  if (has(s.gap)) { vars['--st-gap'] = s.gap + 'px'; cls.push('st-gap'); }
  if (cls.length || Object.keys(vars).length) cls.push('st-on');
  return { vars, cls, fonts };
}
const ALL_VARS = ['--st-head', '--st-body', '--st-price', '--st-hw', '--st-hls', '--st-hz', '--st-pw', '--st-rbox', '--st-rhero', '--st-rbtn', '--st-imgbg', '--st-imgpad', '--st-gap'];
// html köküne uygula (mağaza: document.documentElement; tasarım: çerçevenin kökü). --pcard-r'yi useTheme ayrıca yazar.
export function applyStyle(r, st) {
  const { vars, cls, fonts } = styleOut(st);
  [...r.classList].filter((c) => c.startsWith('st-')).forEach((c) => r.classList.remove(c));
  cls.forEach((c) => r.classList.add(c));
  ALL_VARS.forEach((k) => set(r, k, vars[k]));
  if (vars['--pcard-r']) r.style.setProperty('--pcard-r', vars['--pcard-r']);
  if (fonts.length) ensureFonts(r.ownerDocument, fonts);
}
