// GEÇİCİ deneme: epey liste + bir ürün sayfası erişilebiliyor mu, yapı nasıl
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'tr-TR,tr;q=0.9' };
const r1 = await fetch('https://www.epey.com/akilli-telefonlar/2/', { headers: UA }); const t1 = await r1.text();
const links = [...new Set([...t1.matchAll(/href="(https:\/\/www\.epey\.com\/akilli-telefonlar\/[a-z0-9-]+\.html)"/g)].map((m) => m[1]))];
console.log(`::notice::liste ${r1.status} ${t1.length} bayt, ${links.length} link: ${links.slice(0, 5).join(' ')}`);
const r2 = await fetch(links[0] || 'https://www.epey.com/akilli-telefonlar/samsung-galaxy-a12.html', { headers: UA }); const t2 = await r2.text();
const i = t2.indexOf('Yonga Seti'); console.log(`::notice::ürün ${r2.status} ${t2.length} bayt; yonga: ${i < 0 ? 'YOK' : t2.slice(i, i + 700).replace(/\s+/g, ' ').replace(/::/g, ':')}`);
const j = t2.indexOf('<h1'); console.log(`::notice::h1: ${t2.slice(j, j + 300).replace(/\s+/g, ' ')}`);
