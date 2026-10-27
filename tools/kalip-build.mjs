// Kalıp bulucu telefon listesini derler:
//   tools/kalip/base.json  — veri setlerinden gelen liste [{n: "Samsung Galaxy A55", c: "Exynos 1480 (4 nm)"}]
//                            (Kaggle GSMArena 2019 + bytecharts/device_specs_gsmarena; tools/kalip-update.mjs günceller)
//   tools/kalip/extra.json — elle / Claude'un araştırıp eklediği modeller [{n, c, src, d}]; aynı adda base'in önüne geçer
// → hosting/public/kalip/phones.json  { v, p: [[telefon adı, işlemci, "KOD KOD"]] }
// Kullanım: node tools/kalip-build.mjs
import fs from 'node:fs';
import { phoneCodes } from '../src/kalip.js';
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []);
const base = read('tools/kalip/base.json'); const extra = read('tools/kalip/extra.json');
const key = (n) => n.toLowerCase().replace(/\s+/g, ' ').trim();
const byName = new Map();
for (const p of base) byName.set(key(p.n), p);
for (const p of extra) byName.set(key(p.n), p); // elle eklenen kazanır
const vend = (c) => (/^Snapdragon/.test(c) ? 'Qualcomm ' : /^(Dimensity|Helio)/.test(c) ? 'Mediatek ' : /^Exynos/.test(c) ? 'Samsung ' : /^Kirin/.test(c) ? 'HiSilicon ' : '') + c;
// "Exynos 2400 (4 nm) - International; Qualcomm SM8650-AC Snapdragon 8 Gen 3 (4 nm) - USA"
// → her varyant ayrı; ekranda kısa ad ("Qualcomm Snapdragon 8 Gen 3"), kodlar tam satırdan
const split = (c) => String(c).split(/\s*;\s*|\s+(?:or|\/)\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
const pretty = (c) => {
  let s = c.replace(/\s*\([^)]*\)/g, '').replace(/\s+-\s+.*$/, '').replace(/\s+/g, ' ').trim();
  if (/snapdragon|dimensity|helio|kirin|tiger|tensor/i.test(s)) s = s.replace(/\b(?:SM|SDM|MSM|MT|Hi)\d{3,4}[A-Z0-9]*(?:-[A-Z0-9]+)*\s+/g, '');
  return s.replace(/^MediaTek/i, 'Mediatek');
};
const out = [];
for (const ph of byName.values()) {
  if (/\b(watch|band|buds|gear|fit)|watch\d/i.test(ph.n)) continue; // saat/bileklik/kulaklık değil
  const n = ph.n.replace(/\s+/g, ' ').trim(); if (!n) continue;
  let raw = [...new Set(split(ph.c))].filter((c) => c && c !== '?');
  // Bölgeye göre işlemci: Türkiye'de Avrupa/uluslararası sürüm satılır. Öncelik Europe/EMEA > International/Global > ROW
  // (Note10: "Exynos 9825 - EMEA; Snapdragon 855 - USA/China" → Exynos; S22: "Exynos 2200 - Europe; Snapdragon - ROW" → Exynos)
  const REG = /\)?\s+-\s+(.+)$/; const reg = (c) => (REG.exec(c) || [])[1] || '';
  const TIERS = [/europe|emea|t[uü]rk/i, /international|global/i, /\brow\b|world/i];
  const tier = TIERS.find((rx) => raw.some((c) => rx.test(reg(c))));
  if (tier) raw = raw.filter((c) => tier.test(reg(c)));
  if (!raw.length) continue;
  const codes = new Set();
  for (const c of raw) for (const x of phoneCodes(c)) codes.add(x);
  out.push([n, [...new Set(raw.map((c) => pretty(/^(Apple|Google|Unisoc|Qualcomm|Mediatek|MediaTek|Samsung|HiSilicon|Spreadtrum|Intel|Nvidia)/.test(c) ? c : vend(c))))].join(' / '), [...codes].join(' ')]);
}
out.sort((a, b) => a[0].localeCompare(b[0]));
fs.mkdirSync('hosting/public/kalip', { recursive: true });
fs.writeFileSync('hosting/public/kalip/phones.json', JSON.stringify({ v: Date.now(), p: out }));
console.log(out.length, 'telefon;', out.filter((x) => !x[2]).length, 'kodsuz;', extra.length, 'elle eklenen');
