// Google görünürlüğü (31.10.2026): marka ve kategori sayfalarının adresleri (/marka/<ad>, /kategori/<ad>).
// Hem mağaza uygulaması (src) hem site bekçisi (site/worker.js) bu dosyayı kullanır → ikisinde de adresler birebir aynı.
// Bu dosyaya tarayıcıya ya da başka modüle bağlı bir şey EKLEME (bekçi de içe aktarıyor).

const TR = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
export function slugify(s) {
  return String(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase()
    .replace(/i̇/g, 'i')
    .replace(/[çğıöşüâîû]/g, (c) => TR[c] || c)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Kategori adresleri: ad → adres; aynı adlı kategoride (ör. iki "Sıcak Hava İstasyonu") üst kategorinin adı başa eklenir.
// tree: categories.json [[id, ad, üst]], over: settings.categories {id: {name, hidden}}
export function catSlugs(tree, over = {}) {
  const name = new Map(tree.map(([id, n]) => [id, (over?.[id]?.name || n || '').trim()]));
  const parent = new Map(tree.map(([id, , p]) => [id, p]));
  const base = new Map(tree.map(([id]) => [id, slugify(name.get(id))]));
  const count = new Map(); for (const s of base.values()) count.set(s, (count.get(s) || 0) + 1);
  const out = new Map(); const used = new Set();
  for (const [id] of [...tree].sort((a, b) => a[0] - b[0])) {
    let s = base.get(id);
    if (!s) s = 'kategori-' + id;
    if (count.get(base.get(id)) > 1 && parent.get(id)) s = slugify(name.get(parent.get(id)) + ' ' + name.get(id));
    if (used.has(s)) s = s + '-' + id;
    used.add(s); out.set(id, s);
  }
  return out; // Map(id → adres parçası)
}

// /marka/<ad> ya da /kategori/<ad> (mağazanın mantıksal adresi /magaza/... da olabilir)
export function seoRoute(path) {
  const m = /^(?:\/magaza)?\/(marka|kategori)\/([a-z0-9-]+)\/?$/.exec(path || '');
  return m ? { t: m[1], slug: m[2] } : null;
}
