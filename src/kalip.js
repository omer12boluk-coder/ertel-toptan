// Kalıp bulucu: işlemci (chipset) kodlarını metinden çıkarır ve telefonla kalıbı eşleştirir.
// Ortak kod: tarayıcıda (mağaza) ve tools/kalip-build.mjs'te (veri hazırlama) kullanılır.

// Pazarlama adı → parça kodu (GSMArena'nın sayfasında kod yazmayanlar için yedek tablo)
const SNAP = {
  '8 elite gen 5': 'SM8850', '8 elite': 'SM8750', '8 gen 3': 'SM8650', '8s gen 4': 'SM8735', '8s gen 3': 'SM8635', '8 gen 2': 'SM8550', '8+ gen 1': 'SM8475', '8 gen 1': 'SM8450',
  '7+ gen 3': 'SM7675', '7 gen 3': 'SM7550', '7s gen 3': 'SM7635', '7s gen 2': 'SM7435', '7+ gen 2': 'SM7475', '7 gen 1': 'SM7450', '6 gen 1': 'SM6450', '6s gen 3': 'SM6375', '4 gen 2': 'SM4450', '4s gen 2': 'SM4635', '4 gen 1': 'SM4375',
  '888+': 'SM8350', '888': 'SM8350', '870': 'SM8250', '865+': 'SM8250', '865': 'SM8250', '860': 'SM8150', '855+': 'SM8150', '855': 'SM8150', '845': 'SDM845', '835': 'MSM8998', '801': 'MSM8974', '800': 'MSM8974', '617': 'MSM8952', '616': 'MSM8939', '615': 'MSM8939', '430': 'MSM8937', '821': 'MSM8996', '820': 'MSM8996',
  '782': 'SM7325', '780': 'SM7350', '778g+': 'SM7325', '778g': 'SM7325', '768': 'SM7250', '765g': 'SM7250', '765': 'SM7250', '750': 'SM7225', '732': 'SM7150', '730g': 'SM7150', '730': 'SM7150', '720': 'SM7125', '712': 'SDM712', '710': 'SDM710',
  '695': 'SM6375', '690': 'SM6350', '685': 'SM6225', '680': 'SM6225', '678': 'SM6150', '675': 'SM6150', '670': 'SDM670', '665': 'SM6125', '662': 'SM6115', '660': 'SDM660', '652': 'MSM8976', '650': 'MSM8956', '636': 'SDM636', '632': 'SDM632', '630': 'SDM630', '626': 'MSM8953', '625': 'MSM8953',
  '480+': 'SM4350', '480': 'SM4350', '460': 'SM4250', '450': 'SDM450', '439': 'SDM439', '435': 'MSM8940', '430': 'MSM8937', '429': 'SDM429', '427': 'MSM8920', '425': 'MSM8917', '410': 'MSM8916', '212': 'MSM8909', '210': 'MSM8909',
};
const DIM = {
  '700': 'MT6833', '720': 'MT6853', '800': 'MT6873', '810': 'MT6833', '820': 'MT6875', '900': 'MT6877', '920': 'MT6877', '930': 'MT6855', '1000+': 'MT6889', '1000': 'MT6885', '1080': 'MT6877', '1100': 'MT6891', '1200': 'MT6893', '1300': 'MT6893',
  '6020': 'MT6833', '6080': 'MT6833', '6100+': 'MT6835', '6300': 'MT6835', '7020': 'MT6833', '7030': 'MT6855', '7050': 'MT6877', '7200': 'MT6886', '7300': 'MT6878', '7300x': 'MT6878', '8000': 'MT6895', '8020': 'MT6877', '8050': 'MT6893', '8100': 'MT6895', '8200': 'MT6896', '8300': 'MT6897', '8350': 'MT6897',
  '9500': 'MT6993', '8400': 'MT6899', '8450': 'MT6899', '7400': 'MT6878', '6400': 'MT6835',
  '9000': 'MT6983', '9000+': 'MT6983', '9200': 'MT6985', '9200+': 'MT6985', '9300': 'MT6989', '9300+': 'MT6989', '9400': 'MT6991', '9400+': 'MT6991',
};
const HELIO = {
  a20: 'MT6761', a22: 'MT6761', a25: 'MT6762', p22: 'MT6762', g25: 'MT6762', p35: 'MT6765', g35: 'MT6765', g36: 'MT6765', g37: 'MT6765', p60: 'MT6771', p70: 'MT6771', p65: 'MT6768', g70: 'MT6769', g80: 'MT6769', g81: 'MT6769', g85: 'MT6769', g88: 'MT6769', g90: 'MT6785', g90t: 'MT6785', g95: 'MT6785',
  g91: 'MT6781', g96: 'MT6781', g99: 'MT6789', g100: 'MT6789', p90: 'MT6779', p95: 'MT6779', p23: 'MT6763', p20: 'MT6757', p25: 'MT6757', p10: 'MT6755', x20: 'MT6797', x25: 'MT6797', x27: 'MT6797', x10: 'MT6795', x30: 'MT6799',
};
const KIRIN = { 650: 'HI6250', 655: 'HI6250', 658: 'HI6250', 659: 'HI6250', 935: 'HI3650', 950: 'HI3650', 955: 'HI3650', 925: 'HI3630', 930: 'HI3630', 620: 'HI6220', 710: 'HI6260', '710a': 'HI6260', '710f': 'HI6260', 810: 'HI6280', 960: 'HI3660', 970: 'HI3670', 980: 'HI3680', 985: 'HI6290', 990: 'HI3690', 9000: 'HI36A0', '9000e': 'HI36A0' };
// Exynos pazarlama adı ↔ Samsung parça numarası (S5E3830 = Exynos 850); kalıplarda çoğu zaman parça numarası yazar ("Samsung 3830 XGO")
const EXY = { 850: '3830', 980: '9630', 990: '9830', 1080: '9815', 1280: '8825', 1330: '8535', 1380: '8835', 1480: '8845', 1580: '8855', 2100: '9840', 2200: '9925', 2400: '9945' };
const EXY_R = Object.fromEntries(Object.entries(EXY).map(([k, v]) => [v, k]));


const GEN = { '8 GEN 1': 'SM8450', '8+ GEN 1': 'SM8475', '8 GEN 2': 'SM8550', '8 GEN 3': 'SM8650', '7 GEN 1': 'SM7450', '7+ GEN 2': 'SM7475', '7 GEN 3': 'SM7550', '7S GEN 2': 'SM7435' };

// Metindeki tüm işlemci kodlarını normalize ederek bulur (kalıp adı/açıklaması ya da telefonun işlemci satırı)
export function chipCodes(text) {
  const t = ' ' + String(text || '').toUpperCase().replace(/&NBSP;|<[^>]+>/g, ' ').replace(/\s+/g, ' ') + ' ';
  const out = new Set();
  for (const m of t.matchAll(/\bMT\s?(\d{4})/g)) out.add('MT' + m[1]);
  for (const m of t.matchAll(/(?:^|[\s/(,-])(6[5-9]\d\d|8\d{3})[VZWA](?=[\s/),.-]|$)/g)) out.add('MT' + m[1]); // "/ 6893Z" gibi MT'siz yazılanlar
  for (const m of t.matchAll(/\bSM(\d{4})(?!\d)/g)) out.add('SM' + m[1]);
  for (const m of t.matchAll(/\b(?:SDM|SMD)\s?(\d{3})\b/g)) out.add('SDM' + m[1]);
  for (const m of t.matchAll(/\bMSM\s?(\d{4})/g)) out.add('MSM' + m[1]);
  for (const m of t.matchAll(/\b([78])\s?(\+|S)?\s?GEN\s?(\d)/g)) { const c = GEN[`${m[1]}${m[2] || ''} GEN ${m[3]}`]; if (c) out.add(c); }
  for (const m of t.matchAll(/\bEXYNOS\s?(\d{3,4})/g)) out.add('EX' + m[1]);
  for (const m of t.matchAll(/\b(?:S5E|SAMSUNG\s?)(\d{4})(?!\d)/g)) if (EXY_R[m[1]]) out.add('E' + m[1]); // "SAMSUNG 3830", "S5E9925"
  for (const m of t.matchAll(/\bE(3\d{3}|8\d{3}|9\d{3})P?\b/g)) out.add('E' + m[1]);
  for (const m of t.matchAll(/\bHI\s?(3[0-9][0-9A-F][0-9A-F]|6[0-9]{3})\b/g)) out.add('HI' + m[1]);
  // Apple A serisi: "A15", "A18 Pro", "A8 - A19Pro" (aralık)
  const appleOk = /IPHONE|APPLE/.test(t) || !/SAMSUNG|GALAXY|\bSAM\s?\d/.test(t); // Samsung'un A15 gibi model adları iPhone işlemcisi sanılmasın
  const apple = (n, pro) => appleOk && out.add('A' + n + (pro ? 'P' : ''));
  for (const m of t.matchAll(/\bA(\d{1,2})\s?(PRO)?\s?[-–]\s?A?(\d{1,2})\s?(PRO)?\b/g)) {
    const a = +m[1], b = +m[3]; if (a < 4 || b > 30 || b <= a) continue;
    for (let i = a; i <= b; i++) { apple(i); if (i >= 17) apple(i, 1); }
    if (!m[4] && b >= 17) out.delete('A' + b + 'P');
  }
  for (const m of t.matchAll(/(?:^|[\s/(,])A(\d{1,2})\s?(PRO|BIONIC)?(?=[\s/),.]|$)/g)) { const n = +m[1]; if (n >= 4 && n <= 30) apple(n, m[2] === 'PRO'); }
  // Exynos adı ve parça numarası birbirini tamamlar: EX850 ↔ E3830
  for (const c of [...out]) { let m; if ((m = /^EX(\d+)$/.exec(c)) && EXY[m[1]]) out.add('E' + EXY[m[1]]); else if ((m = /^E(\d{4})$/.exec(c)) && EXY_R[m[1]]) out.add('EX' + EXY_R[m[1]]); }
  return out;
}

// Telefonun işlemci satırından (ör. "Qualcomm SM7150-AC Snapdragon 732G (8 nm)") kodlar
export function phoneCodes(chip) {
  const out = chipCodes(chip); const s = String(chip || '').toLowerCase();
  let m;
  if ((m = /snapdragon ((?:\d\+?s? gen \d)|(?:\d\s?elite(?: gen \d)?)|\d{3}\+?g?\+?)/.exec(s))) { const k = m[1].replace(/(\d)\s?elite/, '$1 elite'); const c = SNAP[k] || SNAP[k.replace(/g\+?$/, '')] || SNAP[k.replace(/\+$/, '')]; if (c && !out.has(c)) out.add(c); }
  if ((m = /dimensity (\d{3,4}\+?x?)/.exec(s))) { const c = DIM[m[1]] || DIM[m[1].replace(/[+x]$/, '')]; if (c && ![...out].some((x) => x.startsWith('MT'))) out.add(c); }
  if ((m = /helio ([apgx]\d{2,3}t?)/.exec(s))) { const c = HELIO[m[1]] || HELIO[m[1].replace(/t$/, '')]; if (c && ![...out].some((x) => x.startsWith('MT'))) out.add(c); }
  if ((m = /kirin (\d{3,4}[a-z]?)/.exec(s))) { const c = KIRIN[m[1]] || KIRIN[m[1].replace(/[a-z]$/, '')]; if (c) out.add(c); }
  return out;
}

// birden çok işlemcide ilk (ana) işlemcinin üreticisi
export const vendorOf = (chip) => { const s = String(chip || '').split(' / ')[0].toLowerCase(); return /apple|\ba\d{1,2}\b/.test(s) ? 'apple' : /snapdragon|qualcomm/.test(s) ? 'qualcomm' : /mediatek|dimensity|helio/.test(s) ? 'mediatek' : /exynos/.test(s) ? 'exynos' : /kirin|hisilicon/.test(s) ? 'kirin' : /tensor/.test(s) ? 'tensor' : /unisoc|tiger|spreadtrum/.test(s) ? 'unisoc' : ''; };

// --- kalıp ürünleri ---
const nrm = (s) => String(s ?? '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => ({ ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' }[c])).toLowerCase();
export const tagList = (p) => (Array.isArray(p.t) ? p.t : String(p.t || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
// kalıp mı: adında / etiketinde "kalıp / kalıbı" geçen ya da Amaoe CPU / entegre ürünü (işlemcinin kendisi değil)
// Kalıp kategorisi (44) ve alt kategorileri: 3D, normal saç, Samsung/Xiaomi/Huawei/iPhone/iPad, birleştirme
const STENCIL_CATS = new Set([44, 68, 69, 87, 102, 103, 104, 105, 106]);
// kalıp mı: Kalıp kategorisinde, adında / etiketinde "kalıp / kalıbı" geçen, ya da Amaoe ürünü olup adında işlemci kodu /
// seri adı (U-MTK 8, MU 6, MQ 6, U-QSU4) / CPU-entegre geçen. Markasız "Mediatek MT6781V" (işlemcinin kendisi) kalıp değildir.
export const isStencil = (p) => {
  if (STENCIL_CATS.has(+p.c) || STENCIL_CATS.has(+p.c2)) return true;
  const n = nrm(p.n);
  if (/kalip|kalib|stencil/.test(n + ' ' + nrm(tagList(p).join(' ')))) return true;
  if (!/amaoe/.test(n + ' ' + nrm(p.b || ''))) return false;
  if (/flux|lehim|pasta|tel\b|ped|tutucu|cimbiz|bant|kablo|tabla(?!li)/.test(n) && !/kalip/.test(n)) return false;
  // seri adı büyük harfle yazılır (U-MTK 8, U-QSD12, MU 6); "Neşter Ucu 4" gibi adlar eşleşmesin. Entegre kategorisindeki
  // sade kodlu Amaoe ürünü (MT6177MV) işlemcinin kendisi olabilir → kod tek başına yetmez.
  return /cpu|islemci|entegre|sablon/.test(n) || /\bU-?[A-Z]{2,4}\s?\d|\bM[UQS]\s?\d/.test(p.n) || (+p.c !== 6 && chipCodes(p.n).size > 0);
};
// herkese açık katalog için kalıbın işlemci kodları + etiketteki telefon modelleri ("m:note10pro"); etiketler gizli kalır
export function stencilKeys(p) {
  if (!isStencil(p)) return null;
  const tags = tagList(p);
  const k = [...chipCodes(p.n + ' ' + tags.join(' / '))];
  const m = tags.map((x) => nrm(x).replace(/[\s-]+/g, '')).filter((x) => x.length >= 5 && /\d/.test(x) && /[a-z]/.test(x) && !k.includes(x.toUpperCase())).map((x) => 'm:' + x);
  return [...k, ...m].join(' ') || '-';
}
