// Tek seferlik: bir ürün sayfasında açıklamanın nerede durduğunu bul (siteye 1 istek + besleme)
const xml = await (await fetch('https://www.ertelgsm.com/xml-cikti/gm', { headers: { 'User-Agent': 'ERTEL-B2B-sync/1.0' } })).text();
const e = xml.split('<entry>').find((x) => x.includes('<g:mpn>ert04000<'));
const link = e.match(/<g:link>([^<]+)</)[1].replace(/&amp;/g, '&');
const r = await fetch(link, { headers: { 'User-Agent': 'ERTEL-B2B-sync/1.0' } });
console.log('content-type', r.headers.get('content-type'));
const buf = new Uint8Array(await r.arrayBuffer());
for (const enc of ['utf-8', 'windows-1254']) { const t = new TextDecoder(enc).decode(buf); const i = t.indexOf('cep telefonu'); console.log(enc, i, t.slice(i - 30, i + 40)); }
const h = new TextDecoder('utf-8').decode(buf);
const i = h.indexOf('LB Tool');
console.log('=== LB Tool ilk geçtiği yer', i);
let j = h.indexOf('LB Tool'); let n = 0;
while (j >= 0 && n < 6) { console.log('--- @', j, '\n', h.slice(Math.max(0, j - 1500), j + 300).replace(/\s+/g, ' ')); j = h.indexOf('LB Tool', j + 10); n++; }
