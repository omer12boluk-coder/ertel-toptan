// Kalıp bulucu verisi: GSMArena'dan telefon → işlemci (chipset) listesi çıkarır. Çıktı out/ klasörüne.
import fs from 'node:fs';
const MODE = process.argv[2] || 'probe';
fs.mkdirSync('out', { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(u, { headers: UA }).catch((e) => ({ ok: false, status: 'ERR ' + e.message }));
    if (r.ok) return await r.text();
    console.log('  ', r.status, u); if (r.status === 404) return null;
    await sleep(r.status === 429 ? 60000 * (i + 1) : 5000);
  }
  return null;
}
if (MODE === 'probe') {
  const s = await get('https://www.gsmarena.com/search.php3');
  fs.writeFileSync('out/search.html', s || 'NULL');
  const p = await get('https://www.gsmarena.com/xiaomi_redmi_note_10_pro_5g-10859.php');
  fs.writeFileSync('out/phone.html', p || 'NULL');
}

if (MODE === 'crawl') {
  const s = await get('https://www.gsmarena.com/search.php3');
  const sel = s.slice(s.indexOf('name="sChipset"')); const opts = [...sel.slice(0, sel.indexOf('</select>')).matchAll(/<option value="(\d+)">([^<]+)/g)].filter((m) => m[1] !== '0');
  const seen = new Set(); const phones = {}; const chips = {}; const log = [];
  const parseList = (h) => [...h.matchAll(/<li><a href="([^"]+\.php)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/g)].map((m) => ({ u: m[1], n: m[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() }));
  for (const [, id, name] of opts) {
    if (seen.has(id)) continue; seen.add(id);
    await sleep(2500);
    const h = await get(`https://www.gsmarena.com/results.php3?sChipset=${id}`);
    if (!h) { log.push(`${name}: YOK`); continue; }
    if (id === '79') fs.writeFileSync('out/results-79.html', h);
    const list = parseList(h.slice(h.indexOf('class="makers"')));
    log.push(`${name}: ${list.length}`);
    for (const p of list) (phones[p.u] = phones[p.u] || { n: p.n, c: [] }).c.push(name);
    // parça kodu (SM8250-AC, MT6769Z…) için bir telefon sayfasına bak (ilk 2 telefon)
    for (const p of list.slice(0, 2)) {
      await sleep(2500); const ph = await get('https://www.gsmarena.com/' + p.u); const m = ph && /data-spec="chipset">([^<]+)/.exec(ph);
      if (m) { chips[name] = chips[name] || []; chips[name].push(m[1].trim()); }
    }
  }
  // Apple (A serisi, finder'da yok)
  for (let pg = 1; pg <= 6; pg++) {
    await sleep(2500);
    const h = await get(pg === 1 ? 'https://www.gsmarena.com/apple-phones-48.php' : `https://www.gsmarena.com/apple-phones-f-48-0-p${pg}.php`);
    if (!h) break;
    const list = parseList(h.slice(h.indexOf('class="makers"'))).filter((p) => /iphone/i.test(p.n));
    if (!list.length) break;
    for (const p of list) {
      if (phones[p.u]) continue; await sleep(2500);
      const ph = await get('https://www.gsmarena.com/' + p.u); const m = ph && /data-spec="chipset">([^<]+)/.exec(ph);
      phones[p.u] = { n: p.n.startsWith('Apple') ? p.n : 'Apple ' + p.n, c: [m ? m[1].trim() : '?'] }; log.push(`${p.n}: ${phones[p.u].c[0]}`);
    }
  }
  fs.writeFileSync('out/phones.json', JSON.stringify(Object.entries(phones).map(([u, v]) => ({ u, ...v }))));
  fs.writeFileSync('out/chips.json', JSON.stringify(chips, null, 1));
  fs.writeFileSync('out/log.txt', log.join('\n'));
  console.log(`::notice::${Object.keys(phones).length} telefon`);
}
