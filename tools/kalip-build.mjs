// Kalıp bulucu verisini hazırlar: GSMArena taramasının çıktısı (kalip-data dalı: phones.json + chips.json)
// → hosting/public/kalip/phones.json  { v, p: [[telefon adı, işlemci, "KOD KOD"]] }
// Kullanım: node tools/kalip-build.mjs <kalip-data klasörü>
import fs from 'node:fs';
import { phoneCodes } from '../src/kalip.js';
const dir = process.argv[2] || 'out';
const phones = JSON.parse(fs.readFileSync(dir + '/phones.json', 'utf8'));
const chips = fs.existsSync(dir + '/chips.json') ? JSON.parse(fs.readFileSync(dir + '/chips.json', 'utf8')) : {};
const vend = (c) => (/^Snapdragon/.test(c) ? 'Qualcomm ' : /^(Dimensity|Helio)/.test(c) ? 'Mediatek ' : /^Exynos/.test(c) ? 'Samsung ' : /^Kirin/.test(c) ? 'HiSilicon ' : '') + c;
const out = []; const seen = new Set();
for (const ph of phones) {
  const n = ph.n.replace(/\s+/g, ' ').trim(); if (!n || seen.has(n)) continue; seen.add(n);
  const cs = [...new Set(ph.c)].filter((c) => c && c !== '?');
  if (!cs.length) continue;
  const codes = new Set();
  for (const c of cs) { for (const x of phoneCodes(c)) codes.add(x); for (const s of chips[c] || []) for (const x of phoneCodes(s)) codes.add(x); }
  out.push([n, cs.map((c) => (/^Apple|^Google|^Unisoc/.test(c) ? c.replace(/\s*\(.*$/, '') : vend(c))).join(' / '), [...codes].join(' ')]);
}
out.sort((a, b) => a[0].localeCompare(b[0]));
fs.mkdirSync('hosting/public/kalip', { recursive: true });
fs.writeFileSync('hosting/public/kalip/phones.json', JSON.stringify({ v: Date.now(), p: out }));
console.log(out.length, 'telefon;', out.filter((x) => !x[2]).length, 'kodsuz');
