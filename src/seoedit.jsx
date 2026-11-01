// Ayarlar › Ürünler › Google tanıtım yazıları (1.11.2026): kategori ve marka sayfalarının üstündeki kısa yazı (settings.seoText).
// Boş olanlara hazır öneri (seodrafts.js) gösterilir; "Ekle" ile yazıya geçer, yönetici düzeltip Kaydet der.
import { useMemo, useState } from 'react';
import { Icon } from './ui.jsx';
import { SEO_DRAFTS } from './seodrafts.js';

export function SeoTextSettings({ d, set, catRows, catalog }) {
  const [tab, setTab] = useState('c');
  const [q, setQ] = useState('');
  const T = d.seoText || { c: {}, b: {} };
  const brands = useMemo(() => {
    const m = new Map();
    for (const p of catalog) { if (!p.b || !p.a) continue; const k = p.b.toLowerCase(); const x = m.get(k) || { k, name: p.b, n: 0 }; x.n++; m.set(k, x); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [catalog]);
  const rows = tab === 'c'
    ? catRows.filter(([, , , n]) => n > 0).map(([id, name, depth, n]) => ({ key: String(id), name, depth, n }))
    : brands.map((b) => ({ key: b.k, name: b.name, depth: 0, n: b.n }));
  const nq = q.trim().toLocaleLowerCase('tr');
  const list = nq ? rows.filter((r) => r.name.toLocaleLowerCase('tr').includes(nq)) : rows;
  const put = (key, v) => {
    const cur = { ...(T[tab] || {}) };
    if (v && v.trim()) cur[key] = v; else delete cur[key];
    set('seoText', { ...T, [tab]: cur });
  };
  const drafts = SEO_DRAFTS[tab];
  const missing = rows.filter((r) => !T[tab]?.[r.key] && drafts[r.key]);
  const addAll = () => {
    const cur = { ...(T[tab] || {}) };
    missing.forEach((r) => { cur[r.key] = drafts[r.key]; });
    set('seoText', { ...T, [tab]: cur });
  };
  const filled = rows.filter((r) => T[tab]?.[r.key]).length;
  return <>
    <p className="fine">Kategori ya da marka sayfasında, ürünlerin üstünde görünen kısa tanıtım yazısı. Hem müşteri okur hem Google: “2UUL”, “sıcak hava istasyonu” gibi aramalarda sayfanın ne hakkında olduğunu anlamasını sağlar. 2-3 cümle yeterli; boş bırakılan sayfada yazı çıkmaz.</p>
    <div className="seg-mini seo-tabs">
      <button className={tab === 'c' ? 'on' : ''} onClick={() => setTab('c')}>Kategoriler</button>
      <button className={tab === 'b' ? 'on' : ''} onClick={() => setTab('b')}>Markalar</button>
    </div>
    <div className="seo-top">
      <input className="seo-q" placeholder={tab === 'c' ? 'Kategori ara' : 'Marka ara'} value={q} onChange={(e) => setQ(e.target.value)} />
      <span className="muted">{filled} / {rows.length} yazılı</span>
      {missing.length > 0 && <button className="btn outline sm" onClick={addAll}><Icon n="sparkle" s={14} />Önerilen {missing.length} yazıyı ekle</button>}
    </div>
    <div className="seo-list">
      {list.map((r) => {
        const v = T[tab]?.[r.key] || '';
        const dr = !v && drafts[r.key];
        return (
          <div key={r.key} className="seo-row" style={{ '--d': r.depth }}>
            <div className="seo-h"><b>{r.name}</b><span className="muted">{r.n} ürün</span>{v && <span className="seo-ok">✓</span>}</div>
            {dr ? (
              <div className="seo-draft">
                <p>{dr}</p>
                <button className="btn ghost sm" onClick={() => put(r.key, dr)}><Icon n="plus" s={14} />Önerilen yazıyı ekle</button>
              </div>
            ) : (
              <textarea rows={v ? 3 : 1} placeholder="Tanıtım yazısı (boş = yazı yok)" value={v} onChange={(e) => put(r.key, e.target.value)} />
            )}
          </div>
        );
      })}
      {!list.length && <p className="muted">Sonuç yok.</p>}
    </div>
  </>;
}
