// SADECE OKUMA + indirme: logosu olmayan markaların logo adaylarını bulur, logos-raw/ klasörüne indirir (teşhis dalı).
import fs from 'node:fs';
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, ' ').slice(0, 3500)}`);
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', Accept: '*/*' };
const get = async (u, t = 20000) => { const c = new AbortController(); const k = setTimeout(() => c.abort(), t); try { return await fetch(u, { headers: UA, signal: c.signal, redirect: 'follow' }); } finally { clearTimeout(k); } };
const BR = { 'YCS': ['ycs'], 'Ma Ant': ['maant', 'ma-ant'], 'Mijing': ['mijing'], 'Mega-Idea': ['mega-idea', 'megaidea', 'mega idea'], 'XZZ': ['xzz', 'xinzhizao'], 'Lanrui': ['lanrui'], 'OSS Team': ['oss'],
  'Alpha': ['alpha'], 'JTX': ['jtx'], 'Ersa': ['ersa'], 'Doseer': ['doseer'], 'Uyue': ['uyue'], 'SUGON': ['sugon'], 'Kaisi': ['kaisi'], 'Xuan Hou': ['xuanhou', 'xuan hou'], 'TBK': ['tbk'], 'Fluke': ['fluke'],
  'LUOWEI': ['luowei'], 'iFixes': ['ifixes'], 'F64': ['f64'], 'I2C': ['i2c'], 'SOPTOP': ['soptop'], 'Korad': ['korad'] };
const SITES = { 'Ma Ant': 'https://www.ma-ant.com/', 'Mijing': 'http://www.gdmijing.com/', 'SUGON': 'https://www.sugoncn.com/', 'LUOWEI': 'http://www.gzluowei.cn/', 'iFixes': 'https://www.ifixestool.com/',
  'TBK': 'https://www.shenwangda.com/', 'Fluke': 'https://www.fluke.com/', 'Ersa': 'https://www.ersa.com/', 'Korad': 'https://www.koradtechnology.com/', 'SOPTOP': 'https://www.soptop.net/', 'Mega-Idea': 'https://www.qianli.cn/', 'Doseer': 'https://www.doseer.com/', 'XZZ': 'https://www.xinzhizao.com/' };
fs.mkdirSync('logos-raw', { recursive: true });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
let n = 0;
async function save(brand, url, tag) {
  try { const r = await get(url); if (!r.ok) return; const ct = r.headers.get('content-type') || ''; const b = Buffer.from(await r.arrayBuffer()); if (b.length < 200) return;
    const ext = /svg/.test(ct) || /\.svg/i.test(url) ? 'svg' : /png/.test(ct) ? 'png' : /webp/.test(ct) ? 'webp' : /gif/.test(ct) ? 'gif' : 'jpg';
    const f = `logos-raw/${slug(brand)}__${tag}__${n++}.${ext}`; fs.writeFileSync(f, b); fs.appendFileSync('logos-raw/_list.txt', `${f}\t${url}\n`); } catch {}
}
// 1) diyfixtool (Shopify) koleksiyon resimleri
const cols = [];
for (let p = 1; p <= 6; p++) { try { const r = await get(`https://www.diyfixtool.com/collections.json?limit=250&page=${p}`); if (!r.ok) break; const j = await r.json(); if (!j.collections?.length) break; cols.push(...j.collections); } catch { break; } }
note('diyfixtool', `${cols.length} koleksiyon`);
for (const [b, keys] of Object.entries(BR)) {
  const hit = cols.filter((c) => c.image?.src && keys.some((k) => (c.title + ' ' + c.handle).toLowerCase().includes(k)));
  if (hit.length) note('Koleksiyon ' + b, hit.slice(0, 4).map((c) => c.title + ' → ' + c.image.src).join(' | '));
  for (const c of hit.slice(0, 3)) await save(b, c.image.src.startsWith('//') ? 'https:' + c.image.src : c.image.src, 'dfx');
}
// 2) resmi siteler: logo içeren img/svg
for (const [b, u] of Object.entries(SITES)) {
  try {
    const r = await get(u); const h = await r.text(); const base = r.url || u;
    const found = new Set();
    for (const m of h.matchAll(/<img[^>]+>/gi)) { const t = m[0]; if (!/logo/i.test(t)) continue; const s = /(?:data-src|src)=["']([^"']+)["']/i.exec(t); if (s) found.add(new URL(s[1], base).href); }
    for (const m of h.matchAll(/["']([^"']*logo[^"']*\.(?:png|svg|webp|jpg))["']/gi)) found.add(new URL(m[1], base).href);
    note('Site ' + b, `${r.status} ${[...found].slice(0, 5).join(' | ')}`);
    for (const f of [...found].slice(0, 4)) await save(b, f, 'site');
  } catch (e) { note('Site ' + b, 'hata ' + e.message); }
}
note('Bitti', `${n} dosya`);
