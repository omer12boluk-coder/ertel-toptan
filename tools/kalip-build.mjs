// Kalıp bulucu verisini hazırlar: GSMArena taramasının çıktısı (kalip-data dalı: phones.json + chips.json)
// → hosting/public/kalip/phones.json  { v, p: [[telefon adı, işlemci, "KOD KOD"]] }
// Kullanım: node tools/kalip-build.mjs <kalip-data klasörü>
import fs from 'node:fs';
import { phoneCodes } from '../src/kalip.js';
const dir = process.argv[2] || 'out';
const phones = JSON.parse(fs.readFileSync(dir + '/phones.json', 'utf8'));
const chips = fs.existsSync(dir + '/chips.json') ? JSON.parse(fs.readFileSync(dir + '/chips.json', 'utf8')) : {};
const vend = (c) => (/^Snapdragon/.test(c) ? 'Qualcomm ' : /^(Dimensity|Helio)/.test(c) ? 'Mediatek ' : /^Exynos/.test(c) ? 'Samsung ' : /^Kirin/.test(c) ? 'HiSilicon ' : '') + c;
// Telefon sayfasındaki satır: "Exynos 2400 (4 nm) - International; Qualcomm SM8650-AC Snapdragon 8 Gen 3 (4 nm) - USA"
// → her varyant ayrı; ekranda kısa ad ("Qualcomm Snapdragon 8 Gen 3"), kodlar tam satırdan
const split = (c) => String(c).split(/\s*;\s*|\s+(?:or|\/)\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
const pretty = (c) => {
  let s = c.replace(/\s*\([^)]*\)/g, '').replace(/\s+-\s+.*$/, '').replace(/\s+/g, ' ').trim();
  if (/snapdragon|dimensity|helio|kirin|tiger|tensor/i.test(s)) s = s.replace(/\b(?:SM|SDM|MSM|MT|Hi)\d{3,4}[A-Z0-9]*(?:-[A-Z0-9]+)*\s+/g, '');
  return s.replace(/^MediaTek/i, 'Mediatek');
};
const out = []; const seen = new Set();
for (const ph of phones) {
  if (/\b(watch|band|buds|gear|fit)|watch\d/i.test(ph.n)) continue; // saat/bileklik/kulaklık değil
  const n = ph.n.replace(/\s+/g, ' ').trim(); if (!n || seen.has(n)) continue; seen.add(n);
  let raw = [...new Set(ph.c.flatMap(split))].filter((c) => c && c !== '?');
  // Bölgeye göre işlemci ("Exynos 9825 - EMEA/LATAM; Snapdragon 855 - USA/China"): Türkiye'de uluslararası sürüm satılır →
  // uluslararası/Avrupa/global sürümü varsa yalnızca onu (ve bölgesi yazmayanları) al
  // öncelik: Avrupa/EMEA > uluslararası/global > ROW (S22: "Exynos 2200 - Europe; Snapdragon - ROW" → Türkiye'de Exynos)
  const REG = /\)?\s+-\s+(.+)$/; const reg = (c) => (REG.exec(c) || [])[1] || '';
  const TIERS = [/europe|emea/i, /international|global/i, /\brow\b|world/i];
  const tier = TIERS.find((rx) => raw.some((c) => rx.test(reg(c))));
  if (tier) raw = raw.filter((c) => tier.test(reg(c)));
  const cs = raw;
  if (!cs.length) continue;
  const codes = new Set();
  for (const c of cs) { for (const x of phoneCodes(c)) codes.add(x); for (const s of chips[c] || []) for (const x of phoneCodes(s)) codes.add(x); }
  out.push([n, [...new Set(cs.map((c) => pretty(/^(Apple|Google|Unisoc|Qualcomm|Mediatek|MediaTek|Samsung|HiSilicon|Spreadtrum|Intel|Nvidia)/.test(c) ? c : vend(c))))].join(' / '), [...codes].join(' ')]);
}
out.sort((a, b) => a[0].localeCompare(b[0]));
fs.mkdirSync('hosting/public/kalip', { recursive: true });
fs.writeFileSync('hosting/public/kalip/phones.json', JSON.stringify({ v: Date.now(), p: out }));
console.log(out.length, 'telefon;', out.filter((x) => !x[2]).length, 'kodsuz');
