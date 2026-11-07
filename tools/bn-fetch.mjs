// Banner için ürün resimlerini R2'den (resim.ertelmarket.com) indirir → bn-raw/ (teşhis dalı, sadece okuma).
import fs from 'node:fs';
const L = JSON.parse(fs.readFileSync('tools/bn-list.json'));
fs.mkdirSync('bn-raw', { recursive: true });
let ok = 0, bad = [];
for (const [id, k, f] of L) {
  const u = f.startsWith('r2:') ? 'https://resim.ertelmarket.com/' + f.slice(3) : /^https?:/.test(f) ? f : 'https://resim.ertelmarket.com/platin/' + encodeURIComponent(f);
  try { const r = await fetch(u); if (!r.ok) { bad.push(id + ':' + r.status); continue; } const b = Buffer.from(await r.arrayBuffer()); const ext = (f.match(/\.(\w+)$/) || [, 'jpg'])[1].toLowerCase(); fs.writeFileSync(`bn-raw/${id}_${k}.${ext}`, b); ok++; } catch (e) { bad.push(id + ':' + e.message); }
}
console.log(`::notice title=Resim::${ok} indi, hata: ${bad.join(' ')}`);
