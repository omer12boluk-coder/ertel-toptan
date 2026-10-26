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
