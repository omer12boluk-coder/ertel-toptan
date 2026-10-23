// Hem uygulama hem eşitleme betiği (tools/sync-platin.mjs) kullanır; başka dosyaya bağımlı olmamalı.
// Siteden gelen adlarda bazen Windows-1252 kalıntısı görünmez karakterler (ör. 0x96 = uzun tire) ya da
// &#8211; gibi kodlar kalıyor; yazı tipinde karşılığı olmadığı için kutu olarak görünüyorlar.
const CP1252 = { 0x80: '€', 0x82: ',', 0x84: '"', 0x85: '...', 0x8b: '<', 0x91: "'", 0x92: "'", 0x93: '"', 0x94: '"', 0x95: '-', 0x96: '-', 0x97: '-', 0x99: '™', 0x9b: '>' };
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', deg: '°', times: '×', hellip: '...', trade: '™', reg: '®', copy: '©' };
const RE_DASH = new RegExp('[\u2010-\u2015\u2212\u2043\uFE58\uFE63\uFF0D]', 'g');
const RE_SQ = new RegExp('[\u2018\u2019\u201A\u2032]', 'g');
const RE_DQ = new RegExp('[\u201C\u201D\u201E\u2033]', 'g');
const RE_SP = new RegExp('[\u00A0\u2000-\u200A\u202F\u205F\u3000]', 'g');
const RE_C1 = new RegExp('[\u0080-\u009F]', 'g');
const RE_BAD = new RegExp('[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFFD\uE000-\uF8FF]', 'g');
export function cleanText(s) {
  if (s == null) return s;
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(RE_C1, (c) => CP1252[c.charCodeAt(0)] ?? ' ')
    .replace(RE_DASH, '-') // her tür tire -> normal tire
    .replace(RE_SQ, "'").replace(RE_DQ, '"')
    .replace(RE_SP, ' ') // özel boşluklar
    .replace(RE_BAD, '') // görünmez / bozuk karakterler
    .replace(/\s+/g, ' ').trim();
}
