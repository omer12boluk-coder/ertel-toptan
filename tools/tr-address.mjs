// Adres listeleri (il → ilçe → mahalle) — yılda bir "Adres listesi" işi (tr-address.yml) çalıştırır.
// Kaynak: npm turkey-neighbourhoods (MIT). Kullanım: node tools/tr-address.mjs <paket klasörü>
// Yazar: src/tr-ilce.json {il: {k: plaka, d: [ilçe]}} ve hosting/public/tr/<plaka>.json {ilçe: [mahalle]}.
// Güvenlik: veri eksik/bozuk gelirse (il < 81, toplam mahalle eskisinin %90'ından az) hiçbir şey yazmaz.
import fs from 'node:fs';
import path from 'node:path';

const pkg = process.argv[2];
if (!pkg) { console.error('kullanım: node tools/tr-address.mjs <paket klasörü>'); process.exit(1); }
const read = (f) => JSON.parse(fs.readFileSync(path.join(pkg, 'src/data', f), 'utf8'));
const cities = read('cityNamesByCode.json');
const dists = read('districtsByCityCode.json');
const hoods = read('neighbourhoodsByDistrictAndCityCode.json');

const trSort = (a, b) => a.localeCompare(b, 'tr');
const codes = Object.keys(cities);
if (codes.length < 81) { console.error('il sayısı eksik: ' + codes.length); process.exit(1); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ilcePath = path.join(ROOT, 'src/tr-ilce.json');
const trDir = path.join(ROOT, 'hosting/public/tr');
const count = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).reduce((n, f) => n + Object.values(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).reduce((m, a) => m + a.length, 0), 0) : 0;
const before = count(trDir);
const after = codes.reduce((n, k) => n + Object.values(hoods[k] || {}).reduce((m, a) => m + a.length, 0), 0);
if (before && after < before * 0.9) { console.error(`mahalle sayısı çok düştü (${before} → ${after}), yazılmadı`); process.exit(1); }

const old = fs.existsSync(ilcePath) ? JSON.parse(fs.readFileSync(ilcePath, 'utf8')) : {};
const ilce = {};
for (const k of codes) ilce[cities[k]] = { k, d: [...(dists[k] || [])].sort(trSort) };

// değişiklik özeti (Actions notu)
const notes = [];
for (const [il, v] of Object.entries(ilce)) {
  const o = old[il]?.d || [];
  const add = v.d.filter((d) => !o.includes(d)); const del = o.filter((d) => !v.d.includes(d));
  if (!old[il]) notes.push(`yeni il: ${il}`);
  if (add.length) notes.push(`${il} yeni ilçe: ${add.join(', ')}`);
  if (del.length) notes.push(`${il} kalkan ilçe: ${del.join(', ')}`);
}
fs.writeFileSync(ilcePath, JSON.stringify(ilce));
fs.mkdirSync(trDir, { recursive: true });
for (const k of codes) fs.writeFileSync(path.join(trDir, k + '.json'), JSON.stringify(hoods[k] || {}));
console.log(`iller ${codes.length}, mahalleler ${before} → ${after}`);
for (const n of notes.slice(0, 30)) console.log('::notice title=Adres listesi::' + n);
console.log(`::notice title=Adres listesi::mahalle sayısı ${before} → ${after}${notes.length ? ' · ' + notes.length + ' ilçe değişikliği' : ''}`);
