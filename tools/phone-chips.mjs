// Kalıp bulucu verisi: GSMArena'dan telefon → işlemci (chipset) listesi çıkarır. Çıktı out/ klasörüne.
import fs from 'node:fs';
const MODE = process.argv[2] || 'probe';
fs.mkdirSync('out', { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' };
let LASTERR = ''; const T0 = Date.now(); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(u, { headers: UA }).catch((e) => ({ ok: false, status: 'ERR ' + e.message }));
    if (r.ok) return await r.text();
    console.log('  ', r.status, u); LASTERR = `${r.status} ${u}`; if (r.status === 404) return null;
    if (r.text && !fs.existsSync('out/err.html')) { try { fs.writeFileSync('out/err.html', await r.text()); } catch {} }
    await sleep(r.status === 429 ? 30000 : 5000);
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
  const seen = new Set(); const phones = {}; const chips = {};
  const save = () => { fs.writeFileSync('out/phones.json', JSON.stringify(Object.entries(phones).map(([u, v]) => ({ u, ...v })))); fs.writeFileSync('out/log.txt', log.join('\n')); }; const log = [];
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
    if (seen.size % 10 === 0) save();
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
      phones[p.u] = { n: p.n.startsWith('Apple') ? p.n : 'Apple ' + p.n, c: [m ? m[1].trim() : '?'] }; log.push(`${p.n}: ${phones[p.u].c[0]}`); save();
    }
  }
  fs.writeFileSync('out/phones.json', JSON.stringify(Object.entries(phones).map(([u, v]) => ({ u, ...v }))));
  fs.writeFileSync('out/chips.json', JSON.stringify(chips, null, 1));
  fs.writeFileSync('out/log.txt', log.join('\n'));
  console.log(`::notice::${Object.keys(phones).length} telefon`);
}

// --- brands: Telefon bulucu (results.php3) bot kontrolüne takıldığı için markaların telefon listesi sayfaları
// (en yeniden eskiye) + her telefonun kendi sayfasındaki "Chipset" satırı. Önceki çıktı out/phones.json'dan devam eder.
// BUDGET_MIN dakika dolunca durur (kalanını bir sonraki çalıştırma tamamlar).
if (MODE === 'brands') {
  const BUDGET = (+process.env.BUDGET_MIN || 300) * 60000;
  // [GSMArena'daki marka adı, kaç sayfa (sayfa başı ~50 model, en yeniler önce)]
  const WANT = [['Samsung', 9], ['Apple', 4], ['Xiaomi', 10], ['Huawei', 6], ['Honor', 5], ['Oppo', 6], ['Realme', 5], ['vivo', 6], ['OnePlus', 2], ['Google', 1], ['Tecno', 4], ['Infinix', 3], ['Motorola', 5], ['Nokia', 3], ['Nothing', 1], ['Sony', 2], ['TCL', 2], ['ZTE', 3], ['Asus', 2], ['Lenovo', 2], ['Meizu', 1], ['LG', 2], ['HTC', 1], ['Alcatel', 1], ['Blackview', 1], ['Ulefone', 1], ['Oukitel', 1], ['Cat', 1]];
  const FALLBACK = { Samsung: 'samsung-phones-9', Apple: 'apple-phones-48', Xiaomi: 'xiaomi-phones-80', Huawei: 'huawei-phones-58', Honor: 'honor-phones-121', Oppo: 'oppo-phones-82', Realme: 'realme-phones-118', vivo: 'vivo-phones-98', OnePlus: 'oneplus-phones-95', Google: 'google-phones-107', Motorola: 'motorola-phones-4', Nokia: 'nokia-phones-1', Sony: 'sony-phones-7', LG: 'lg-phones-20', Asus: 'asus-phones-46', ZTE: 'zte-phones-62', Lenovo: 'lenovo-phones-73', HTC: 'htc-phones-45', Alcatel: 'alcatel-phones-5' };
  const SKIP = /\b(watch|band|buds|gear|fit|ring|tag|vr|earbuds|freebuds|fitness)\b/i;
  const prev = fs.existsSync('out/phones.json') ? JSON.parse(fs.readFileSync('out/phones.json', 'utf8')) : [];
  const phones = {}; for (const p of prev) if (p.c && p.c[0] && p.c[0] !== '?') phones[p.u] = { n: p.n, c: p.c };
  const log = fs.existsSync('out/log.txt') ? fs.readFileSync('out/log.txt', 'utf8').split('\n').slice(-3000) : [];
  const save = () => { fs.writeFileSync('out/phones.json', JSON.stringify(Object.entries(phones).map(([u, v]) => ({ u, ...v })))); fs.writeFileSync('out/log.txt', log.join('\n')); };
  const parseList = (h) => [...h.matchAll(/<li><a href="([^"]+\.php)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/g)].map((m) => ({ u: m[1], n: m[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() }));
  let blocked = 0; const t0 = Date.now(); let added = 0;
  const mk = await get('https://www.gsmarena.com/makers.php3');
  const makers = {}; for (const m of (mk || '').matchAll(/href="?([a-z0-9_]+-phones-\d+)\.php"?[^>]*>([^<]+)</gi)) makers[m[2].trim().toLowerCase()] = m[1];
  log.push(`# ${new Date().toISOString()} başladı; ${Object.keys(makers).length} marka bulundu, önceden ${Object.keys(phones).length} telefon`);
  outer: for (const [brand, pages] of WANT) {
    const slug = makers[brand.toLowerCase()] || FALLBACK[brand]; if (!slug) { log.push(`${brand}: marka bulunamadı`); continue; }
    const [, base, id] = /^(.+)-phones-(\d+)$/.exec(slug);
    for (let pg = 1; pg <= pages; pg++) {
      if (Date.now() - t0 > BUDGET) { log.push('# süre doldu'); break outer; }
      await sleep(2000);
      const h = await get(pg === 1 ? `https://www.gsmarena.com/${slug}.php` : `https://www.gsmarena.com/${base}-phones-f-${id}-0-p${pg}.php`);
      const list = h && h.includes('class="makers"') ? parseList(h.slice(h.indexOf('class="makers"'))) : [];
      if (!list.length) { log.push(`${brand} s${pg}: liste boş/engel`); if (h && !h.includes('class="makers"')) blocked++; if (blocked > 5) break outer; break; }
      blocked = 0; let pgNew = 0;
      for (const p of list) {
        if (phones[p.u] || SKIP.test(p.n)) continue;
        if (Date.now() - t0 > BUDGET) { log.push('# süre doldu'); break outer; }
        await sleep(1800);
        const ph = await get('https://www.gsmarena.com/' + p.u, 3);
        if (!ph) { log.push(`${p.n}: sayfa açılmadı (${LASTERR})`); if (++blocked > 5) break outer; continue; }
        if (!ph.includes('specs-list') && !ph.includes('data-spec')) { log.push(`${p.n}: engel`); if (!fs.existsSync('out/block.html')) fs.writeFileSync('out/block.html', ph); if (++blocked > 5) break outer; continue; }
        blocked = 0;
        const m = /data-spec="chipset"[^>]*>([\s\S]*?)<\/td>/.exec(ph);
        const chip = m ? m[1].replace(/<br\s*\/?>/gi, '; ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
        const name = p.n.toLowerCase().startsWith(brand.toLowerCase()) ? p.n : `${brand === 'vivo' ? 'vivo' : brand} ${p.n}`;
        if (!chip) { log.push(`${name}: işlemci yok`); continue; }
        phones[p.u] = { n: name, c: [chip] }; added++; pgNew++;
        if (added % 25 === 0) { save(); console.log(`${added} yeni (${Math.round((Date.now() - t0) / 60000)} dk) — son: ${name}: ${chip}`); }
      }
      log.push(`${brand} s${pg}: ${list.length} model, ${pgNew} yeni`);
    }
  }
  save();
  console.log(`::notice::${added} yeni telefon, toplam ${Object.keys(phones).length}`);
}
