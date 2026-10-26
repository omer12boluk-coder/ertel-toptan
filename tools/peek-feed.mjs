// Tek seferlik inceleme: beslemedeki bir ürünün tüm alanları + ürün sayfasındaki açıklama/resim/kategori yapısı (siteye 2 istek)
const FEED = 'https://www.ertelgsm.com/xml-cikti/gm';
const xml = await (await fetch(FEED, { headers: { 'User-Agent': 'ERTEL-B2B-sync/1.0' } })).text();
const e = xml.split('<entry>')[1].split('</entry>')[0];
console.log('=== BESLEME ÖRNEK ÜRÜN ===');
for (const m of e.matchAll(/<(g:[\w]+|[\w]+)>([\s\S]*?)<\/\1>/g)) console.log(m[1], '=', m[2].replace(/\s+/g, ' ').slice(0, 200));
const tags = new Set([...xml.slice(0, 400000).matchAll(/<(g:\w+)>/g)].map((m) => m[1])); console.log('TÜM ETİKETLER:', [...tags].join(', '));
const link = (e.match(/<link[^>]*href="([^"]+)"/) || e.match(/<g:link>([^<]+)</) || e.match(/<link>([^<]+)</) || [])[1];
console.log('LINK', link);
if (link) {
  const h = await (await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  console.log('=== SAYFA', h.length, 'bayt ===');
  const ld = [...h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].slice(0, 1500));
  console.log('LD+JSON:', ld.join('\n---\n'));
  for (const k of ['og:image', 'description', 'breadcrumb', 'product-description', 'productDescription', 'urun-aciklama', 'pictures/']) {
    const i = h.indexOf(k); console.log('#', k, i, i >= 0 ? h.slice(Math.max(0, i - 200), i + 400).replace(/\s+/g, ' ') : '');
  }
  const imgs = [...new Set([...h.matchAll(/https?:\/\/[^"' )]+\/pictures\/[^"' )]+/g)].map((m) => m[0]))]; console.log('RESİMLER', imgs.length, imgs.slice(0, 15).join('\n'));
}
