// SADECE OKUMA: markanın resmi sitesini tarayıcıda açar, logo öğesinin ekran görüntüsünü alır (logos-raw/).
import { chromium } from 'playwright';
import fs from 'node:fs';
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, ' ').slice(0, 3000)}`);
const SITES = { 'ma-ant': 'https://www.ma-ant.com/', 'mijing': 'http://www.gdmijing.com/', 'ifixes': 'https://www.ifixestool.com/', 'korad': 'https://www.koradtechnology.com/',
  'soptop': 'https://www.soptop.net/', 'doseer': 'https://www.doseer.com/', 'alpha': 'https://www.macdermidalpha.com/', 'ersa': 'https://www.kurtzersa.com/', 'luowei': 'http://www.gzluowei.cn/',
  'xzz': 'https://www.xinzhizao.com/', 'ycs': 'https://ycstools.com/', 'oss-team': 'https://www.ossteam.com/', 'kaisi': 'https://www.kaisitool.com/', 'mega-idea': 'https://www.mega-idea.cn/' };
fs.mkdirSync('logos-raw', { recursive: true });
const b = await chromium.launch();
for (const [k, u] of Object.entries(SITES)) {
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    await pg.goto(u, { timeout: 30000, waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4000);
    const hs = await pg.$$('img[src*="logo" i], img[alt*="logo" i], img[class*="logo" i], [class*="logo" i] img, [id*="logo" i] img, [class*="logo" i] svg, header img, a[href="/"] img');
    let n = 0; const seen = new Set();
    for (const h of hs) {
      const bb = await h.boundingBox(); if (!bb || bb.width < 40 || bb.height < 12 || bb.y > 400) continue;
      const key = Math.round(bb.x) + ',' + Math.round(bb.y); if (seen.has(key)) continue; seen.add(key);
      await h.screenshot({ path: `logos-raw/${k}__shot__${n}.png`, omitBackground: true }); 
      const src = await h.evaluate((e) => e.currentSrc || e.src || e.outerHTML.slice(0, 80)); fs.appendFileSync('logos-raw/_list.txt', `${k}__shot__${n}.png\t${src}\n`);
      if (++n >= 3) break;
    }
    if (!n) await pg.screenshot({ path: `logos-raw/${k}__page.png`, clip: { x: 0, y: 0, width: 1440, height: 220 } });
    note(k, `${u} → ${n} logo · ${await pg.title()}`);
  } catch (e) { note(k, 'hata ' + e.message.slice(0, 120)); }
  await pg.close();
}
await b.close();
