// Kategori ağacı (sitenin "Kategoriler" sayfasından) + açıklama HTML temizleyici
import TREE from './categories.json';
import { CATEGORY_NAMES } from './config.js';

const BASE = new Map(TREE.map(([id, name, parent], i) => [id, { name, parent, i }]));

export function baseCatName(id) { return BASE.get(id)?.name || CATEGORY_NAMES[id] || null; }

// S: ayarlar, codes: katalogda geçen kategori kodları
export function buildTree(S, codes = []) {
  const nodes = new Map();
  const add = (id, name, parent, i) => nodes.set(id, { id, name, parent, i, children: [] });
  for (const [id, b] of BASE) add(id, b.name, b.parent, b.i);
  for (const c of codes) if (c != null && !nodes.has(c)) add(c, CATEGORY_NAMES[c] || null, 0, 1000 + c);
  for (const n of nodes.values()) {
    const o = S.categories?.[n.id] || {};
    n.name = o.name || n.name || 'Kategori ' + n.id;
    n.hidden = !!o.hidden;
    n.order = o.order ?? n.i;
  }
  const roots = [];
  for (const n of nodes.values()) (n.parent && nodes.has(n.parent) ? nodes.get(n.parent).children : roots).push(n);
  const sort = (arr) => { arr.sort((a, b) => a.order - b.order); arr.forEach((x) => sort(x.children)); };
  sort(roots);
  const ancestors = (id) => { const out = []; let n = nodes.get(id), g = 0; while (n && g++ < 10) { out.push(n.id); n = n.parent ? nodes.get(n.parent) : null; } return out; };
  const isHidden = (id) => ancestors(id).some((x) => nodes.get(x)?.hidden);
  return { nodes, roots, ancestors, isHidden };
}

// Ürünün bulunduğu tüm kategoriler (kendisi + üstleri, 1. ve 2. kategori)
export function productCats(p, tree) {
  const s = new Set(tree.ancestors(p.c));
  if (p.c2 != null) for (const x of tree.ancestors(p.c2)) s.add(x);
  return s;
}

// ---- Açıklama HTML'ini güvenli hale getir (sadece temel biçim, resim ve bağlantı)
const OK = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'IMG', 'A', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'HR']);
export function cleanHtml(html) {
  const doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
  const walk = (el) => {
    for (const c of [...el.children]) {
      if (!OK.has(c.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON'].includes(c.tagName)) { c.remove(); continue; }
        walk(c); c.replaceWith(...c.childNodes); continue;
      }
      const href = c.getAttribute('href'), src = c.getAttribute('src');
      for (const a of [...c.attributes]) c.removeAttribute(a.name);
      if (c.tagName === 'A' && href && /^https?:\/\//i.test(href)) { c.setAttribute('href', href); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); }
      if (c.tagName === 'IMG') { if (src && /^https:\/\//i.test(src)) { c.setAttribute('src', src); c.setAttribute('loading', 'lazy'); c.setAttribute('alt', ''); } else { c.remove(); continue; } }
      walk(c);
    }
  };
  const root = doc.body.firstElementChild;
  walk(root);
  return root.innerHTML.replace(/(<br>\s*){3,}/g, '<br><br>');
}

// JSON'u ~maxBytes büyüklüğünde parçalara böler (Firestore doküman sınırı 1 MB)
export function chunkBySize(arr, maxBytes = 650000) {
  const out = []; let cur = [], size = 0;
  for (const x of arr) {
    const s = JSON.stringify(x).length * 1.15;
    if (cur.length && size + s > maxBytes) { out.push(cur); cur = []; size = 0; }
    cur.push(x); size += s;
  }
  if (cur.length) out.push(cur);
  return out;
}
