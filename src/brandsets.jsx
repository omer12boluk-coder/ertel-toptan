// 5.11.2026: mağazada Markalar (/markalar) ve Setler (/setler) sayfaları — üst menüdeki Markalar ▾ ve Setler bunlara gider
import { useMemo, useState } from 'react';
import { useStore, store, go } from './store.js';
import { Icon, Empty } from './ui.jsx';
import { norm } from './utils.js';
import { useVisibleProducts } from './catalog.jsx';
import { ShopImg } from './shophome.jsx';
import { SetGrid, liveSets } from './sets.jsx';

// marka listesi: mağazadaki görünür ürünlerden, ürün sayısına göre; logo Ayarlar › Markalar ya da ana sayfa marka kutularından
export function useBrandList() {
  const vis = useVisibleProducts(false);
  const BL = useStore((s) => s.settings.brandLogos || {});
  const HB = useStore((s) => s.settings.shopHome?.brands || []);
  return useMemo(() => {
    const lk = {};
    for (const b of HB) if (b?.name && b.logo) lk[b.name.toLocaleLowerCase('tr')] = { logo: b.logo, color: b.color };
    for (const [k, v] of Object.entries(BL)) if (v?.logo || v?.color) lk[k.toLocaleLowerCase('tr')] = { ...(lk[k.toLocaleLowerCase('tr')] || {}), ...v };
    const m = new Map(); for (const p of vis) if (p.b) m.set(p.b, (m.get(p.b) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ n, c, ...(lk[n.toLocaleLowerCase('tr')] || {}) }));
  }, [vis, BL, HB]);
}
export const openBrand = (n) => { store.set({ catalogGo: { brand: n } }); go('katalog'); };

export function BrandTile({ b, onClick, small }) {
  return <button type="button" className={'bp-tile' + (small ? ' sm' : '')} onClick={onClick} style={b.color ? { '--bc': b.color } : undefined} title={b.n}>
    <span className="bp-logo">{b.logo ? <ShopImg v={b.logo} className="logo" alt={b.n} /> : <b>{b.n}</b>}</span>
    {!small && <span className="bp-meta"><b>{b.n}</b><small>{b.c} ürün</small></span>}
  </button>;
}

export function BrandsPage() {
  const list = useBrandList();
  const [q, setQ] = useState('');
  const shown = q.trim() ? list.filter((b) => norm(b.n).includes(norm(q))) : list;
  const withLogo = shown.filter((b) => b.logo), noLogo = shown.filter((b) => !b.logo);
  return <div className="page bp-page">
    <header className="bp-head">
      <h1>Markalar</h1>
      <p>{list.length} marka · telefon tamir ekipmanının önde gelen üreticileri</p>
      <label className="bp-search"><Icon n="search" s={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marka ara…" aria-label="Marka ara" /></label>
    </header>
    {!shown.length && <Empty icon="tag" title="Marka bulunamadı" />}
    {withLogo.length > 0 && <div className="bp-grid">{withLogo.map((b) => <BrandTile key={b.n} b={b} onClick={() => openBrand(b.n)} />)}</div>}
    {noLogo.length > 0 && <>
      <h2 className="bp-h2">Diğer markalar</h2>
      <div className="bp-chips">{noLogo.map((b) => <button key={b.n} type="button" className="chip" onClick={() => openBrand(b.n)}>{b.n}<small>{b.c}</small></button>)}</div>
    </>}
  </div>;
}

export function SetsPage() {
  const S = useStore((s) => s.settings);
  const n = liveSets(S).length;
  return <div className="page bp-page">
    <header className="bp-head">
      <h1>Setler</h1>
      <p>{n ? n + ' hazır set · birlikte alınca daha uygun' : 'Hazır ürün setleri'}</p>
    </header>
    <SetGrid />
  </div>;
}
