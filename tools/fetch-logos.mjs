// Marka logolarını markaların kendi sitelerinden indirir (GitHub Actions "Marka logolarını getir").
// Çıktı: brand-assets/<marka>-<n>.<uzantı> + manifest.json — sonra elle seçilip hosting/public/brands/ altına alınır.
import { mkdir, writeFile } from 'node:fs/promises';
const SITES = {
  ersa: ['https://www.ersa.com/en/'],
  fluke: ['https://www.fluke.com/en-us'],
  unit: ['https://meters.uni-trend.com/', 'https://www.uni-trend.com/'],
  korad: ['https://www.koradtechnology.com/'],
  quick: ['https://www.quick-global.com/', 'https://www.quicksolder.com/en/'],
  yihua: ['https://www.yihuatools.com/', 'https://www.yihua-soldering.com/'],
  megaidea: ['https://www.qianli.cn/en/pro'],
  mijing: ['https://www.mijing.cn/', 'http://www.mijing-tools.com/'],
  rf4: ['https://www.rf4.com.cn/', 'https://rf4tools.com/'],
  xzz: ['https://www.xinzhizao.com/', 'https://xzz.ltd/'],
  ycs: ['https://www.ycstools.com/'],
  maant: ['https://www.maant.com/'],
  kaisi: ['https://www.kaisi.com.cn/', 'https://kaisitools.com/'],
  sugon: ['https://www.sugon-tools.com/', 'https://sugontools.com/'],
  ossteam: ['https://www.ossteam.com/'],
  ifixes: ['https://ifixes.com/'],
};
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
const abs = (u, base) => { try { return new URL(u.replace(/&amp;/g, '&'), base).href; } catch { return null; } };
const out = {};
await mkdir('brand-assets', { recursive: true });
for (const [brand, urls] of Object.entries(SITES)) {
  out[brand] = [];
  let n = 0;
  for (const url of urls) {
    let html = '';
    try { const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(20000) }); html = await r.text(); out[brand].push({ page: url, status: r.status }); }
    catch (e) { out[brand].push({ page: url, error: String(e) }); continue; }
    const cands = new Set();
    // <img ... logo ...>  ve  brand sayfasında marka adını taşıyan resimler
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const src = (tag.match(/\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i) || [])[1];
      if (!src || src.startsWith('data:')) continue;
      const hay = tag.toLowerCase();
      if (hay.includes('logo') || hay.includes(brand.replace('megaidea', 'mega'))) cands.add(abs(src, url));
    }
    for (const m of html.matchAll(/<link\b[^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/gi)) { const h = (m[0].match(/href=["']([^"']+)["']/i) || [])[1]; if (h) cands.add(abs(h, url)); }
    const og = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1]; if (og) cands.add(abs(og, url));
    for (const c of [...cands].filter(Boolean).slice(0, 8)) {
      try {
        const r = await fetch(c, { headers: { ...UA, Referer: url }, signal: AbortSignal.timeout(20000) });
        if (!r.ok) continue;
        const ct = r.headers.get('content-type') || '';
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 200) continue;
        const ext = ct.includes('svg') ? 'svg' : ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('icon') ? 'ico' : ct.includes('gif') ? 'gif' : 'jpg';
        const file = `${brand}-${++n}.${ext}`;
        await writeFile('brand-assets/' + file, buf);
        out[brand].push({ file, src: c, bytes: buf.length, from: url });
      } catch (e) { out[brand].push({ src: c, error: String(e).slice(0, 120) }); }
    }
  }
}
await writeFile('brand-assets/manifest.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.filter((x) => x.file).length]))));
