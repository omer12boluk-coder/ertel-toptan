// GEÇİCİ: telefon özellik siteleri GitHub'dan açılıyor mu
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8' };
const U = [
  'https://www.gsmarena.com/xiaomi_redmi_note_10_pro_5g-10859.php',
  'https://www.gsmarena.com/makers.php3',
  'https://phonedb.net/index.php?m=device&s=list',
  'https://www.devicespecifications.com/en/model/c6b1559f',
  'https://nanoreview.net/en/phone/xiaomi-redmi-note-10-pro-5g',
  'https://www.kimovil.com/en/where-to-buy-xiaomi-redmi-note-10-pro-5g',
  'https://www.phonemore.com/specs/xiaomi/redmi-note-10-pro-5g/',
  'https://www.epey.com/akilli-telefonlar/',
  'https://www.mobilesdatabase.com/',
  'https://phonesdata.com/en/',
];
for (const u of U) {
  try { const r = await fetch(u, { headers: UA, redirect: 'follow' }); const t = await r.text(); const m = /(Dimensity[^<"]{0,40}|MT68\d\d\w*|Chipset[^<]{0,80})/i.exec(t); console.log(`::notice::${r.status} ${t.length}b ${u} → ${m ? m[1].replace(/\s+/g, ' ') : '-'}`); }
  catch (e) { console.log(`::notice::HATA ${u} ${e.message}`); }
}
