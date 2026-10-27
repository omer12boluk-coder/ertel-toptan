// Kalıp bulucu telefon listesini güncel tutar. CLAUDE.md > "Kalıp telefon listesini güncelle" bölümüne bakın.
//
//   node tools/kalip-update.mjs bytecharts <klon klasörü>
//       github.com/bytecharts/device_specs_gsmarena klonundaki <marka>/<model>/details.json dosyalarından
//       telefon → işlemci satırlarını tools/kalip/base.json'a ekler / günceller (tablet, saat, işlemcisiz atlanır).
//   node tools/kalip-update.mjs missing
//       Herkese açık katalogdaki (Firestore pubcatalog, okumaya açık) kalıpların işlemci kodlarından hiçbir telefonda
//       geçmeyenleri tools/kalip/eksik.json'a yazar → bunlar için telefon araştırılıp extra.json'a eklenir.
//       (Firestore'a GitHub Actions'tan erişilir; Claude'un konteynerinden erişilemeyebilir.)
//   node tools/kalip-update.mjs add "Samsung Galaxy S30" "Qualcomm SM9575 Snapdragon 8 Elite Gen 6 (2 nm)" "https://kaynak..."
//       tools/kalip/extra.json'a bir model ekler / düzeltir (aynı ad varsa üzerine yazar).
// Her değişiklikten sonra: node tools/kalip-build.mjs  (hosting/public/kalip/phones.json'u üretir)
import fs from 'node:fs';
import path from 'node:path';
import { chipCodes, phoneCodes, isStencil } from '../src/kalip.js';

const [mode, a1, a2, a3] = process.argv.slice(2);
const BASE = 'tools/kalip/base.json', EXTRA = 'tools/kalip/extra.json', EKSIK = 'tools/kalip/eksik.json';
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []);
const write = (f, v, pretty) => fs.writeFileSync(f, pretty ? JSON.stringify(v, null, 1) + '\n' : JSON.stringify(v));
const key = (n) => n.toLowerCase().replace(/\s+/g, ' ').trim();
const today = new Date().toISOString().slice(0, 10);

if (mode === 'bytecharts') {
  const root = a1; if (!root || !fs.existsSync(root)) throw new Error('klon klasörü yok: ' + root);
  const BR = { apple: 'Apple', google: 'Google', motorola: 'Motorola', nokia: 'Nokia', oneplus: 'OnePlus', oppo: 'Oppo', samsung: 'Samsung', sony: 'Sony', vivo: 'vivo', xiaomi: 'Xiaomi', realme: 'Realme', honor: 'Honor', huawei: 'Huawei', tecno: 'Tecno', infinix: 'Infinix', nothing: 'Nothing', poco: 'Poco' };
  const SKIP = /\b(watch|gear|band|fit|tab|pad|buds|ring)\b|ipad|watch\d/i;
  const base = read(BASE); const idx = new Map(base.map((p, i) => [key(p.n), i]));
  let add = 0, upd = 0;
  for (const b of fs.readdirSync(root)) {
    const bd = path.join(root, b); if (b.startsWith('.') || !fs.statSync(bd).isDirectory()) continue;
    const slug = b.split('-')[0]; const brand = BR[slug] || slug[0].toUpperCase() + slug.slice(1);
    for (const m of fs.readdirSync(bd)) {
      const f = path.join(bd, m, 'details.json'); if (!fs.existsSync(f)) continue;
      let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8')).data; } catch { continue; }
      const sp = d?.specifications || {};
      const chip = String(sp.Platform?.Chipset || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s*\n\s*/g, '; ').trim();
      let n = String(d.model || m.replace(/_/g, ' ')).replace(/\s+/g, ' ').trim(); if (!n.toLowerCase().startsWith(brand.toLowerCase())) n = brand + ' ' + n;
      const size = /([\d.]+)\s*inches/.exec(sp.Display?.Size || '');
      if (!chip || SKIP.test(n) || (size && +size[1] >= 7.5 && !/fold|flip|mix|open/i.test(n))) continue;
      const k = key(n);
      if (idx.has(k)) { if (base[idx.get(k)].c !== chip) { base[idx.get(k)].c = chip; upd++; } }
      else { idx.set(k, base.length); base.push({ n, c: chip }); add++; }
    }
  }
  base.sort((x, y) => x.n.toLowerCase().localeCompare(y.n.toLowerCase()));
  write(BASE, base);
  console.log(`bytecharts: ${add} yeni, ${upd} güncellenen; base ${base.length} model`);
}

if (mode === 'missing') {
  // Firestore REST: pubcatalog/_meta → c0..cN (items dizisi). Değerler {stringValue|integerValue|...} biçiminde.
  const P = 'https://firestore.googleapis.com/v1/projects/erteltoptan/databases/(default)/documents/pubcatalog/';
  const val = (v) => (v == null ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue
    : 'arrayValue' in v ? (v.arrayValue.values || []).map(val) : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)])) : null);
  const get = async (id) => { const r = await fetch(P + id); if (!r.ok) throw new Error(`${id}: ${r.status}`); return Object.fromEntries(Object.entries((await r.json()).fields || {}).map(([k, x]) => [k, val(x)])); };
  const meta = await get('_meta'); const items = [];
  for (let i = 0; i < meta.chunks; i++) items.push(...((await get('c' + i)).items || []));
  const phones = JSON.parse(fs.readFileSync('hosting/public/kalip/phones.json', 'utf8')).p;
  const have = new Set(phones.flatMap((p) => p[2].split(' ').filter(Boolean)));
  const miss = {};
  for (const p of items) {
    if (p.a === 0 || !(p.kc || isStencil(p))) continue;
    const ks = new Set([...chipCodes(p.n), ...String(p.kc || '').split(' ').filter((x) => x && x !== '-' && !x.startsWith('m:'))]);
    for (const c of ks) if (/^(SM|MT|SDM|MSM|HI|EX|E)\d/.test(c) && !have.has(c)) (miss[c] = miss[c] || []).push(p.n);
  }
  const list = Object.entries(miss).map(([kod, kaliplar]) => ({ kod, kaliplar })).sort((x, y) => y.kod.localeCompare(x.kod));
  write(EKSIK, { tarih: today, not: 'Katalogdaki kalıplarda geçen ama telefon listesinde hiçbir telefona bağlı olmayan işlemci kodları', kodlar: list }, true);
  console.log(`${items.length} ürün tarandı; telefonu olmayan ${list.length} işlemci kodu → ${EKSIK}`);
}

if (mode === 'add') {
  if (!a1 || !a2) throw new Error('kullanım: add "Model adı" "İşlemci satırı" "kaynak"');
  const extra = read(EXTRA).filter((p) => key(p.n) !== key(a1));
  extra.push({ n: a1.trim(), c: a2.trim(), src: a3 || '', d: today });
  extra.sort((x, y) => x.n.toLowerCase().localeCompare(y.n.toLowerCase()));
  write(EXTRA, extra, true);
  console.log(`eklendi: ${a1} → ${a2} → kodlar: ${[...phoneCodes(a2)].join(' ') || 'TANINMADI (parça kodunu da yazın, ör. SM9575)'}`);
}
