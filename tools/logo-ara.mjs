// Marka logosu arama (Actions'ta çalışır; konteyner dış sitelere çıkamaz). Claude 7.11.2026.
// MARKALAR="YCS,Ma Ant,…" → out/logo/<marka>/<n>.<uzantı> + out/logo/index.json
// Kaynaklar: (1) Shopify mağazalarının /collections.json listesi (marka koleksiyonunun kapak resmi çoğunlukla logodur)
//            (2) markanın kendi sitesi (SITELER="Marka=https://… …"): og:image, 'logo' geçen <img>, apple-touch-icon
import fs from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
const brands = (process.env.MARKALAR || '').split(',').map((s) => s.trim()).filter(Boolean);
const sites = (process.env.SITELER || '').split(/\s+/).filter(Boolean).map((p) => { const i = p.indexOf('='); return [p.slice(0, i), p.slice(i + 1)]; });
const SHOPS = ['https://www.diyfixtool.com', 'https://www.quecoo.com', 'https://www.iprogadgets.com', 'https://refoxtech.com', 'https://www.fonefunshop.com', 'https://brandshd.co.nz'];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s) => norm(s) || 'x';
const out = {}; const titles = []; const add = (b, url, from) => { (out[b] ||= []); if (!out[b].some((x) => x.url === url)) out[b].push({ url, from }); };
const get = async (u, t = 20000) => { const c = new AbortController(); const tm = setTimeout(() => c.abort(), t); try { const r = await fetch(u, { headers: UA, signal: c.signal, redirect: 'follow' }); return r.ok ? r : null; } catch { return null; } finally { clearTimeout(tm); } };
for (const shop of SHOPS) {
  for (let page = 1; page <= 8; page++) {
    const r = await get(`${shop}/collections.json?limit=250&page=${page}`); if (!r) break;
    let j; try { j = await r.json(); } catch { break; }
    const cs = j.collections || []; if (!cs.length) break;
    for (const c of cs) titles.push(shop.replace(/^https:\/\/(www\.)?/, '') + '\t' + c.handle + '\t' + c.title + '\t' + (c.image?.src ? 'img' : '-'));
    for (const c of cs) for (const b of brands) {
      const t = norm(c.title), h = norm(c.handle), nb = norm(b);
      if ((t === nb || t === nb + 'tool' || h === nb + 'tool' || h === nb || t === nb + 'tools' || h === nb + 'tools' || t === nb + 'brand' || t.startsWith(nb + 'tool')) && c.image?.src) add(b, c.image.src, shop + '/collections/' + c.handle);
    }
  }
}
for (const [b, site] of sites) {
  const r = await get(site); if (!r) { console.log(`::warning title=Site açılmadı::${b} ${site}`); continue; }
  const html = await r.text(); const abs = (u) => { try { return new URL(u.replace(/&amp;/g, '&'), r.url).href; } catch { return null; } };
  const found = new Set();
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) { const tag = m[0]; if (!/logo/i.test(tag)) continue; const s = tag.match(/\b(?:data-src|src)=["']([^"']+)["']/i)?.[1]; if (s) found.add(abs(s)); }
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]*>/gi)) { const s = m[0].match(/content=["']([^"']+)["']/i)?.[1]; if (s) found.add(abs(s)); }
  for (const m of html.matchAll(/<link[^>]+rel=["'](?:apple-touch-icon|icon)[^"']*["'][^>]*>/gi)) { const s = m[0].match(/href=["']([^"']+)["']/i)?.[1]; if (s) found.add(abs(s)); }
  for (const u of [...found].filter(Boolean).slice(0, 8)) add(b, u, site);
}
fs.mkdirSync('out/logo', { recursive: true });
const idx = {};
for (const [b, list] of Object.entries(out)) {
  const d = `out/logo/${slug(b)}`; fs.mkdirSync(d, { recursive: true }); idx[b] = [];
  let n = 0;
  for (const it of list.slice(0, 8)) {
    const u = it.url.startsWith('//') ? 'https:' + it.url : it.url; const r = await get(u); if (!r) continue;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 200) continue;
    const ext = (u.split('?')[0].match(/\.(png|jpe?g|webp|svg|gif|ico|avif)$/i)?.[1] || 'img').toLowerCase();
    const f = `${d}/${++n}.${ext}`; fs.writeFileSync(f, buf); idx[b].push({ f: f.slice(4), url: u, from: it.from, size: buf.length });
  }
  console.log(`::notice title=${b}::${idx[b].length} aday`);
}
for (const b of brands) if (!idx[b]) console.log(`::warning title=${b}::aday yok`);
fs.writeFileSync('out/logo/koleksiyonlar.txt', titles.join('\n'));
for (const sh of SHOPS) console.log(`::notice title=Mağaza::${sh} ${titles.filter((t) => t.startsWith(sh.replace(/^https:\/\/(www\.)?/, ''))).length} koleksiyon`);
fs.writeFileSync('out/logo/index.json', JSON.stringify(idx, null, 1));
