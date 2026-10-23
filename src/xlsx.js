// Küçük, bağımlılıksız .xlsx / .csv okuyucu (ilk sayfayı satır nesnelerine çevirir)

async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Geçerli bir Excel (.xlsx) dosyası değil');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = {};
  const td = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
    files[name] = { method, csize, off };
    p += 46 + nlen + xlen + clen;
  }
  return {
    has: (n) => !!files[n],
    async text(n) {
      const f = files[n]; if (!f) return null;
      const lnl = dv.getUint16(f.off + 26, true), lxl = dv.getUint16(f.off + 28, true);
      const start = f.off + 30 + lnl + lxl;
      const data = u8.subarray(start, start + f.csize);
      const raw = f.method === 0 ? data : await inflateRaw(data);
      return td.decode(raw);
    },
  };
}

function colIndex(ref) {
  const m = /^([A-Z]+)/.exec(ref); let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

export async function readSheet(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseCSV(await file.text());
  const z = await unzip(await file.arrayBuffer());
  const P = new DOMParser();
  const strings = [];
  const ss = await z.text('xl/sharedStrings.xml');
  if (ss) {
    const d = P.parseFromString(ss, 'application/xml');
    for (const si of d.getElementsByTagName('si')) {
      let s = ''; for (const t of si.getElementsByTagName('t')) s += t.textContent; strings.push(s);
    }
  }
  // ilk sayfanın yolunu bul
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wbRels = await z.text('xl/_rels/workbook.xml.rels');
  const wb = await z.text('xl/workbook.xml');
  if (wb && wbRels) {
    const wd = P.parseFromString(wb, 'application/xml');
    const first = wd.getElementsByTagName('sheet')[0];
    const rId = first?.getAttribute('r:id') || first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rd = P.parseFromString(wbRels, 'application/xml');
    for (const r of rd.getElementsByTagName('Relationship')) {
      if (r.getAttribute('Id') === rId) { const t = r.getAttribute('Target').replace(/^\//, ''); sheetPath = t.startsWith('xl/') ? t : 'xl/' + t; }
    }
  }
  const xml = await z.text(sheetPath);
  if (!xml) throw new Error('Excel sayfası okunamadı');
  const d = P.parseFromString(xml, 'application/xml');
  const rows = [];
  for (const row of d.getElementsByTagName('row')) {
    const arr = [];
    let ci = 0;
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r'); if (ref) ci = colIndex(ref);
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent;
      let val;
      if (t === 's') val = strings[Number(v)];
      else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
      else if (t === 'str' || t === 'b') val = v;
      else val = v == null ? null : isNaN(Number(v)) ? v : Number(v);
      arr[ci] = val; ci++;
    }
    rows.push(arr);
  }
  return toObjects(rows);
}

function toObjects(rows) {
  const head = (rows.shift() || []).map((h) => String(h ?? '').trim());
  return rows.filter((r) => r.some((v) => v != null && v !== '')).map((r) => {
    const o = {}; head.forEach((h, i) => { if (h) o[h] = r[i] ?? null; }); return o;
  });
}

function parseCSV(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return toObjects(rows.map((r) => r.map((v) => (v !== '' && !isNaN(Number(v)) ? Number(v) : v))));
}

// Excel satırlarını ürün kaydına çevir. İki PlatinMarket dışa aktarımını da tanır:
//  - "Ürünler" (urun_id, urun_satis_fiyat, urun_stok…)  - "Ürünler Varyasyonlu" (Ürün ID, Ürün Resmi 1-10, Etiketler…)
// Sadece dosyada bulunan alanlar döner; birleştirmede diğer alanlar korunur.
const pick = (o, keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]; return undefined; };
const has = (o, keys) => keys.some((k) => k in o);
const fileName = (v) => String(v).trim().split('?')[0].split('/').pop().replace(/^\d+X-/, '');
export function rowsToProducts(rows) {
  const items = [], descs = {};
  const K = {
    id: ['urun_id', 'Ürün ID', 'id', 'ID'], k: ['urun_stok_kod', 'Stok Kodu', 'stok_kod', 'kod'], n: ['urun_isim', 'Ürün Adı', 'isim', 'urun_adi'],
    c: ['urun_kategori_kod', 'Ürün Kategori Id 1', 'kategori_kod'], c2: ['Ürün Kategori Id 2'], r: ['urun_satis_fiyat', 'Fiyat', 'satis_fiyat'],
    w: ['urunum_pro_s_price', 'İndirimli Fiyat', 'toptan', 'toptan_fiyat'], cur: ['urun_pb', 'Para Birimi', 'pb'], s: ['urun_stok', 'stok', 'Stok'],
    a: ['urun_durum', 'Ürün Durumu', 'durum'], b: ['Marka', 'marka'], t: ['Etiketler', 'etiketler'], u: ['Ürün URL'], desc: ['Ürün Açıklaması'],
  };
  const imgCols = Array.from({ length: 10 }, (_, i) => 'Ürün Resmi ' + (i + 1));
  for (const o of rows) {
    const id = Number(pick(o, K.id));
    if (!id) continue;
    const p = { id };
    const v = (f) => pick(o, K[f]);
    if (v('k') != null) p.k = String(v('k'));
    if (v('n') != null) p.n = String(v('n')).replace(/\s+/g, ' ').trim();
    if (v('c') != null) p.c = Number(v('c')) || 0;
    if (has(o, K.c2)) { const c2 = Number(v('c2')); if (c2 && c2 !== p.c) p.c2 = c2; }
    if (v('r') != null) p.r = Number(v('r')) || 0;
    if (Number(v('w')) > 0) p.w = Number(v('w'));
    if (v('cur') != null) { const pb = String(v('cur')).toUpperCase(); p.cur = pb === 'TL' ? 'TRY' : pb; }
    if (v('s') != null) p.s = Number(v('s')) || 0;
    if (v('a') != null) p.a = Number(v('a')) ? 1 : 0;
    if (has(o, K.b)) { const b = String(v('b') ?? '').trim(); p.b = b === '-' ? '' : b; }
    if (has(o, K.t)) p.t = [...new Set(String(v('t') ?? '').split(',').map((x) => x.trim()).filter(Boolean))].join(',');
    if (v('u') != null) p.u = String(v('u'));
    if (has(o, imgCols)) {
      const files = imgCols.map((c) => o[c]).filter((x) => x != null && String(x).trim()).map(fileName);
      p.pi = files[0] || ''; p.im = files.slice(1);
    }
    const d = v('desc'); if (d != null && String(d).trim()) descs[id] = String(d).trim();
    items.push(p);
  }
  return { items, descs };
}

const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
function same(a, b) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (empty(a[k]) && empty(b[k])) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}
// Mevcut kataloğa birleştir: dosyada olmayan alanlar, elle yüklenen resimler ve elle girilen toptan fiyatlar korunur.
export function mergeCatalog(current, incoming) {
  const byId = new Map(current.map((p) => [p.id, p]));
  let added = 0, updated = 0;
  const seen = new Set();
  for (const n of incoming) {
    seen.add(n.id);
    const o = byId.get(n.id);
    if (!o) { byId.set(n.id, { k: '', n: '', c: 0, r: 0, w: null, cur: 'USD', s: 0, a: 1, ...n }); added++; continue; }
    const m = { ...o, ...n };
    if (n.w == null) m.w = o.w ?? null;
    if (!same(m, o)) updated++;
    byId.set(n.id, m);
  }
  const missing = current.filter((p) => !seen.has(p.id)).length;
  const list = [...byId.values()].sort((a, b) => b.id - a.id);
  return { list, added, updated, missing };
}
