// PlatinMarket ürün resimlerinin KÜÇÜK hâllerini R2'de üretir: platin/<dosya> → platin/t/<dosya> (350px genişlik, webp).
// Siteye bağlamaz (adres hosting/public/config.js IMG_PLATIN açılınca kullanılır). Kaldığı yerden devam eder:
// dizin platin/t/_manifest.json { files: { <dosya>: bayt } }. Okuma/yazma bekçinin R2 kapısından (/r2obj/, X-Key).
// Ortam: WATCH_URL, TELEGRAM_TOKEN. Seçenek: --limit N (deneme), --minutes M.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const LIMIT = arg('--limit', 0), MINUTES = arg('--minutes', 300), W = (process.env.WATCH_URL || '').replace(/\/$/, '');
const auth = { 'X-Key': createHash('sha256').update('r2:' + process.env.TELEGRAM_TOKEN).digest('hex') };
const note = (t, m) => console.log(`::notice title=${t}::${m}`);
const enc = (k) => k.split('/').map(encodeURIComponent).join('/');
const get = async (k) => { for (let i = 0; i < 4; i++) { const r = await fetch(W + '/r2obj/' + enc(k), { headers: auth }).catch(() => null); if (r?.ok) return Buffer.from(await r.arrayBuffer()); if (r?.status === 404) return null; await new Promise((s) => setTimeout(s, 1500 * (i + 1))); } throw new Error('okunamadı ' + k); };
const put = async (k, body, type) => { for (let i = 0; i < 4; i++) { const r = await fetch(W + '/r2obj/' + enc(k), { method: 'PUT', headers: { ...auth, 'Content-Type': type }, body }).catch(() => null); if (r?.ok) return; await new Promise((s) => setTimeout(s, 1500 * (i + 1))); } throw new Error('yazılamadı ' + k); };
const t0 = Date.now();
const src = JSON.parse((await get('platin/_manifest.json')).toString()).files || {};
const man = JSON.parse((await get('platin/t/_manifest.json'))?.toString() || '{"files":{}}');
const todo = Object.keys(src).filter((f) => !(f in man.files));
note('Küçük resim', `${Object.keys(src).length} resim, hazır ${Object.keys(man.files).length}, yapılacak ${todo.length}`);
let done = 0, fail = [], bytes = 0, i = 0;
const save = () => put('platin/t/_manifest.json', JSON.stringify(man), 'application/json');
async function worker() {
  while (i < todo.length && (!LIMIT || done + fail.length < LIMIT) && Date.now() - t0 < MINUTES * 60000) {
    const f = todo[i++];
    try {
      const b = await get('platin/' + f); if (!b) { fail.push(f + ': yok'); continue; }
      const out = await sharp(b, { failOn: 'none' }).rotate().resize({ width: 350, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      await put('platin/t/' + f, out, 'image/webp');
      man.files[f] = out.length; bytes += out.length; done++;
      if (done % 200 === 0) { await save(); console.log(`ilerleme: ${done}`); } // not değil: GitHub adım başına 10 not gösteriyor
    } catch (e) { fail.push(f + ': ' + String(e.message || e).slice(0, 60)); }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
await save();
if (fail.length) note('Yapılamayanlar', fail.slice(0, 15).join(' | ') + (fail.length > 15 ? ` … +${fail.length - 15}` : ''));
note('Küçük resim bitti', `bu çalışmada ${done} (${(bytes / 1048576).toFixed(1)} MB), hata ${fail.length}; toplam hazır ${Object.keys(man.files).length}/${Object.keys(src).length}`);
