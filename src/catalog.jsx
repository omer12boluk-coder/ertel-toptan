import { useMemo, useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, setQty, go, api, toast, store, openRequest, setCatalog } from './store.js';
import { Icon, Thumb, Stepper, Sheet, Empty, useInfinite, openMenu, copyText } from './ui.jsx';
import { norm, fmt, priceFor, catName, now, ls } from './utils.js';
import { links } from './route.js';
import { ProductEdit, SyncButton } from './admin.jsx';
import { buildTree, productCats, cleanHtml } from './cats.js';
import { TLHint, useRate, fmtTL } from './listsheet.jsx';
import { GuestGuide } from './guestcart.jsx';

export function useTree() {
  const { catalog, settings: S } = useStore();
  return useMemo(() => buildTree(S, [...new Set(catalog.flatMap((p) => [p.c, p.c2]).filter((x) => x != null))]), [catalog, S.categories]);
}

export function useVisibleProducts(admin) {
  const { catalog, settings: S } = useStore();
  const tree = useTree();
  return useMemo(() => catalog.filter((p) => {
    if (admin) return true;
    if (!p.a && !S.catalog.showInactive) return false;
    if (S.catalog.hideOutOfStock && p.s <= 0) return false;
    if (tree.isHidden(p.c)) return false;
    return true;
  }), [catalog, S, admin, tree]);
}

// Resim adresleri: elle yüklenen > siteden gelen (1. resim + ekler)
export function imageList(p, S, size) {
  const t = size === 'lg' ? S.catalog.imageLarge || S.catalog.imageThumb : S.catalog.imageThumb;
  const files = [p.pi, ...(p.im || [])].filter(Boolean);
  const abs = (f) => /^(https?:)?\/\/|^\//.test(f); // tam adres (elle eklenen resim) olduğu gibi kullanılır
  return files.map((f) => (abs(f) ? f : t && t.includes('{pi}') ? t.replaceAll('{pi}', f) : null)).filter(Boolean);
}

export function stockInfo(p, S) {
  if (S.catalog.stockMode === 'hidden') return null;
  if (p.s <= 0) return { t: 'Stok yok', tone: 'bad' };
  if (S.catalog.stockMode === 'number') return { t: p.s + ' adet', tone: p.s <= S.catalog.lowStock ? 'warn' : 'ok' };
  return p.s <= S.catalog.lowStock ? { t: 'Az kaldı', tone: 'warn' } : { t: 'Stokta', tone: 'ok' };
}

// Fiyatın altındaki ek satırlar (Ayarlar > Fiyatlandırma > Ürün fiyatının gösterimi): TL karşılığı, soluk KDV dahil tutar
// Mağaza (public) ve bayi için ayrı seçilir: showTL/showVatInc/plusVat (mağaza), b2bTL/b2bVatInc/b2bPlusVat (bayi)
export function priceShow(S, role) {
  const P = S.pricing || {};
  return role === 'public' ? { tl: !!P.showTL, inc: !!P.showVatInc, plus: !!P.plusVat } : { tl: role === 'admin' || !!P.b2bTL, inc: !!P.b2bVatInc, plus: !!P.b2bPlusVat };
}
// "Sepete ekle" düğmesinin görünümü (Ayarlar > Ürün kartları): auto | text | icon | plus
export const cardAdd = (S, role) => (role === 'public' || !role ? S.cards?.add : S.cards?.addB2b) || (role === 'public' || !role ? 'auto' : 'text');
function PriceExtras({ v, cur, S: So, role: ro }) {
  const S0 = useStore((s) => s.settings);
  const r0 = useStore((s) => s.user?.role);
  const rate = useRate();
  const S = So || S0, role = ro || r0;
  if (v == null || isNaN(v)) return null;
  const sh = priceShow(S, role);
  const vat = Number(S.pricing.vatPct) || 0;
  const tl = (x) => (rate && cur === 'USD' ? fmtTL(x * rate.usd) : cur === 'TRY' ? fmtTL(x) : null);
  const inc = sh.inc && vat > 0 ? v * (1 + vat / 100) : null;
  return <>
    {sh.tl && (rate && cur === 'USD' ? <span className="tl-hint num">≈ {fmtTL(v * rate.usd)}</span> : <TLHint v={v} cur={cur} />)}
    {inc != null && <span className="vat-inc num">KDV dahil {fmt(inc, cur)}{tl(inc) && cur !== 'TRY' ? ' · ' + tl(inc) : ''}</span>}
  </>;
}
function PlusVat({ S: So, role: ro }) { const S0 = useStore((s) => s.settings); const r0 = useStore((s) => s.user?.role); const S = So || S0; return priceShow(S, ro || r0).plus && Number(S.pricing.vatPct) > 0 ? <em className="plusvat">+KDV</em> : null; }

// S / role verilirse (Ayarlar önizlemesi) o ayarlar ve o müşteri tipiyle çizilir
export function PriceBlock({ p, big, S: So, role: ro }) {
  const st = useStore();
  const S = So || st.settings; const role = ro || st.user?.role;
  const user = ro ? { role: ro, tier: S.tiers?.[0]?.id } : st.user;
  const pr = priceFor(p, S, user, ro ? null : st.userPrices);
  const ex = { S, role };
  if (role === 'public') {
    return (
      <div className={'price' + (big ? ' big' : '')}>
        {pr.mine == null ? <span className="price-ask">Fiyat sorun</span> : <span className="price-mine"><small>Fiyat:</small>{fmt(pr.mine, p.cur)}<PlusVat {...ex} /></span>}
        <PriceExtras v={pr.mine} cur={p.cur} {...ex} />
      </div>
    );
  }
  if (!big && S.pricing.showRetail && pr.list > 0 && pr.mine != null) return (
    <div className="price dual">
      <span className="pv"><small>Liste</small><b className="num">{fmt(pr.list, p.cur)}</b></span>
      <span className="pv mine"><small>{pr.src === 'ozel' ? 'Size özel' : 'Toptan'}</small><b className="num">{fmt(pr.mine, p.cur)}<PlusVat {...ex} /></b></span>
      <PriceExtras v={pr.mine} cur={p.cur} {...ex} />
    </div>
  );
  return (
    <div className={'price' + (big ? ' big' : '')}>
      {S.pricing.showRetail && pr.list > 0 && <span className="price-list">Liste: <b className="num">{fmt(pr.list, p.cur)}</b></span>}
      {pr.mine == null
        ? <span className="price-ask">Fiyat sorun</span>
        : <span className="price-mine"><small>{pr.src === 'ozel' ? 'Size özel:' : 'Toptan:'}</small>{fmt(pr.mine, p.cur)}<PlusVat {...ex} /></span>}
      <PriceExtras v={pr.mine} cur={p.cur} {...ex} />
    </div>
  );
}
// Ayarlar > Ürün kartları önizlemesi: gerçek kart düzeniyle (mağaza ya da bayi)
export function CardPreview({ p, S, role }) {
  const st = stockInfo(p, S);
  return (
    <ul className={'plist pgrid pv-cards add-' + cardAdd(S, role)}>
      <li className="prow">
        <span className="prow-main">
          <span className="cimg"><Thumb p={p} /></span>
          <div className="prow-info">
            <span className="prow-name">{p.n}</span>
            <span className="prow-meta">{S.catalog.showBrand && p.b && <span className="brand-tag">{p.b}</span>}{st && <span className={'dot tone-' + st.tone}>{st.t}</span>}</span>
          </div>
        </span>
        <div className="prow-side">
          <PriceBlock p={p} S={S} role={role} />
          <button className="btn sm add" type="button" aria-label="Sepete ekle"><Icon n="plus" s={15} className="add-plus" /><span className="add-cart" aria-hidden="true"><Icon n="cart" s={18} /><i>+</i></span><span className="add-l">Sepete ekle</span></button>
        </div>
      </li>
    </ul>
  );
}

export function Catalog({ admin }) {
  const { settings: S, cart, user } = useStore();
  const all = useVisibleProducts(admin);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(null);
  const [sort, setSort] = useState('default');
  const [stockOnly, setStockOnly] = useState(false);
  const [limit, setLimit] = useState(S.catalog.pageSize);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [catSheet, setCatSheet] = useState(false);
  const [adminFilter, setAdminFilter] = useState('all');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState(''); // '' | 'u10' | '10-50' | '50-200' | '200+'
  const [newOnly, setNewOnly] = useState(false);
  const [imgOnly, setImgOnly] = useState(false);
  // görünüm: kutu kutu (varsayılan) ya da sıra sıra; cihazda hatırlanır
  const [view, setView0] = useState(() => (admin ? 'list' : ls.get('cat-view', 'grid')));
  const setView = (v) => { setView0(v); if (!admin) ls.set('cat-view', v); };
  const tree = useTree();
  const intent = useStore((s) => s.intent);
  useEffect(() => { if (admin && intent === 'newProduct') { store.set({ intent: null }); setEdit({}); } }, [intent]);
  // başka ekrandan (mağaza ana sayfası) gelen filtre: marka / kategori / arama
  const browse = useStore((s) => s.catalogGo);
  useEffect(() => { if (!browse) return; setQ(browse.q || ''); setCat(browse.cat ?? null); setBrand(browse.brand || ''); store.set({ catalogGo: null }); }, [browse]);
  const changedN = useMemo(() => (admin ? all.filter((p) => p.pc).length : 0), [all, admin]);

  const pcats = useMemo(() => new Map(all.map((p) => [p.id, productCats(p, tree)])), [all, tree]);
  const counts = useMemo(() => {
    const m = new Map();
    for (const s of pcats.values()) for (const c of s) m.set(c, (m.get(c) || 0) + 1);
    return m;
  }, [pcats]);
  const brands = useMemo(() => {
    const m = new Map(); for (const p of all) if (p.b) m.set(p.b, (m.get(p.b) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'));
  }, [all]);
  const openPath = useMemo(() => new Set(cat == null ? [] : tree.ancestors(cat)), [cat, tree]);

  const PR = { u10: [0, 10], '10-50': [10, 50], '50-200': [50, 200], '200+': [200, Infinity] };
  const newest = useMemo(() => { const ids = all.filter((p) => p.nw).map((p) => p.id); return new Set(ids.length >= 20 ? ids : [...all].sort((a, b) => b.id - a.id).slice(0, 120).map((p) => p.id)); }, [all]);
  // scoped: kategori + marka da uygulanır; false: sadece arama ve diğer filtreler (kategoride bulunamazsa tüm ürünlerden göstermek için)
  const filterList = (scoped) => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    const useTags = admin || S.catalog.searchTags;
    const [lo, hi] = PR[price] || [0, Infinity];
    let r = all.filter((p) => (!scoped || cat == null || pcats.get(p.id)?.has(cat)) && (!scoped || !brand || p.b === brand) && (!stockOnly || p.s > 0)
      && (!price || (p.r >= lo && p.r < hi)) && (!newOnly || newest.has(p.id)) && (!imgOnly || p.pi || p.img)
      && toks.every((t) => p._s.includes(t) || (useTags && p._t.includes(t))));
    if (toks.length) r = [...r].sort((a, b) => toks.filter((t) => b._s.includes(t)).length - toks.filter((t) => a._s.includes(t)).length);
    if (admin && adminFilter === 'inactive') r = r.filter((p) => !p.a);
    if (admin && adminFilter === 'nowholesale') r = r.filter((p) => p.w == null);
    if (admin && adminFilter === 'noimg') r = r.filter((p) => !p.img && !p.pi);
    if (admin && adminFilter === 'notags') r = r.filter((p) => !p.t);
    if (admin && adminFilter === 'pricechanged') r = r.filter((p) => p.pc);
    if (admin && adminFilter === 'new') r = r.filter((p) => p.nw);
    if (admin && adminFilter === 'siteoff') r = r.filter((p) => p.so);
    if (sort === 'asc') r = [...r].sort((a, b) => a.r - b.r);
    if (sort === 'desc') r = [...r].sort((a, b) => b.r - a.r);
    if (sort === 'name') r = [...r].sort((a, b) => a.n.localeCompare(b.n, 'tr'));
    if (sort === 'stock') r = [...r].sort((a, b) => (b.s > 0) - (a.s > 0));
    return r;
  };
  const deps = [all, q, cat, sort, stockOnly, adminFilter, admin, brand, pcats, S.catalog.searchTags, price, newOnly, imgOnly, newest];
  const scopedList = useMemo(() => filterList(true), deps);
  const scoped = cat != null || !!brand;
  const globalList = useMemo(() => (q.trim() && scoped ? filterList(false) : null), deps);
  // kategori / marka seçiliyken aranan şey orada yoksa: tüm ürünlerde ara (müşteri "neden çıkmıyor" demesin)
  const widened = !!globalList && scopedList.length === 0 && globalList.length > 0;
  const list = widened ? globalList : scopedList;
  const moreOutside = globalList && !widened ? globalList.length - scopedList.length : 0;
  const scopeName = [cat != null ? tree.nodes.get(cat)?.name || catName(S, cat) : null, brand || null].filter(Boolean).join(' · ');
  const clearAll = () => { setQ(''); setCat(null); setBrand(''); setStockOnly(false); setPrice(''); setNewOnly(false); setImgOnly(false); };
  const actives = [
    q.trim() && ['“' + q.trim() + '”', () => setQ('')],
    cat != null && [tree.nodes.get(cat)?.name || catName(S, cat), () => setCat(null)],
    brand && [brand, () => setBrand('')],
    stockOnly && ['Stoktakiler', () => setStockOnly(false)],
    price && [{ u10: '$10 altı', '10-50': '$10–50', '50-200': '$50–200', '200+': '$200 üstü' }[price], () => setPrice('')],
    newOnly && ['Yeni gelenler', () => setNewOnly(false)],
    imgOnly && ['Resimli', () => setImgOnly(false)],
  ].filter(Boolean);

  useEffect(() => setLimit(S.catalog.pageSize), [q, cat, sort, stockOnly, adminFilter, brand, price, newOnly, imgOnly]);
  const more = useCallback(() => setLimit((l) => l + S.catalog.pageSize), [S.catalog.pageSize]);
  const sentinel = useInfinite(more);
  const shown = list.slice(0, limit);
  const cartCount = Object.keys(cart).length;

  return (
    <div className="catalog">
      <div className="cat-layout">
        <aside className="cat-side" aria-label="Kategoriler">
          <h3 className="eyebrow">Kategoriler</h3>
          <button className={'cat-link' + (cat == null ? ' on' : '')} onClick={() => setCat(null)}><span>Tümü</span><b>{all.length}</b></button>
          <CatTree nodes={tree.roots} counts={counts} cat={cat} open={openPath} onPick={setCat} />
        </aside>

        <section className="cat-main">
          <div className="toolbar">
            <div className="search">
              <Icon n="search" s={18} />
              <input id="cat-search" type="search" placeholder={scopeName ? `${scopeName} içinde ara… (tüm ürünlerde de bakarız)` : 'Ürün adı veya stok kodu… (ör. jcid face id)'} value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button className="icon-btn sm" onClick={() => setQ('')} aria-label="Temizle"><Icon n="x" s={16} /></button>}
            </div>
            <div className="chips" role="tablist" aria-label="Kategori">
              <button className="chip only-m" onClick={() => setCatSheet(true)}><Icon n="filter" s={15} />{cat == null ? 'Kategoriler' : tree.nodes.get(cat)?.name || catName(S, cat)}</button>
              {cat != null && <button className="chip on only-m" onClick={() => setCat(null)}>Tümü <Icon n="x" s={14} /></button>}
              <button className={'chip' + (stockOnly ? ' on' : '')} onClick={() => setStockOnly(!stockOnly)}>Stoktakiler</button>
              <button className={'chip' + (newOnly ? ' on' : '')} onClick={() => setNewOnly(!newOnly)}><Icon n="star" s={14} />Yeni gelenler</button>
              <label className={'chip select' + (price ? ' on' : '')}>
                <Icon n="tag" s={14} />
                <select id="cat-price" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Fiyat aralığı">
                  <option value="">Tüm fiyatlar</option><option value="u10">$10 altı</option><option value="10-50">$10 – $50</option><option value="50-200">$50 – $200</option><option value="200+">$200 üstü</option>
                </select>
              </label>
              <button className={'chip' + (imgOnly ? ' on' : '')} onClick={() => setImgOnly(!imgOnly)}><Icon n="camera" s={14} />Resimli</button>
              {brands.length > 1 && (
                <label className={'chip select' + (brand ? ' on' : '')}>
                  <select id="cat-brand" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Marka">
                    <option value="">Tüm markalar</option>
                    {brands.map(([b, n]) => <option key={b} value={b}>{b} ({n})</option>)}
                  </select>
                </label>
              )}
              <label className="chip select">
                <Icon n="sort" s={15} />
                <select id="cat-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sıralama">
                  <option value="default">Yeni eklenen</option>
                  <option value="asc">Fiyat artan</option>
                  <option value="desc">Fiyat azalan</option>
                  <option value="name">İsim A–Z</option>
                  <option value="stock">Stoktakiler önce</option>
                </select>
              </label>
              {admin && (
                <label className="chip select">
                  <select id="adm-filter" value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} aria-label="Filtre">
                    <option value="all">Tüm ürünler</option>
                    <option value="inactive">Pasif olanlar</option>
                    <option value="nowholesale">Toptan fiyatı girilmemiş</option>
                    <option value="noimg">Resmi olmayanlar</option>
                    <option value="notags">Etiketi olmayanlar</option>
                    <option value="pricechanged">Liste fiyatı değişenler</option>
                    <option value="new">Siteden yeni gelenler</option>
                    <option value="siteoff">Sitede satışta olmayanlar</option>
                  </select>
                </label>
              )}
              {admin && <button className="chip accent" onClick={() => setEdit({})}><Icon n="plus" s={15} />Yeni ürün</button>}
              {admin && <SyncButton small />}
            </div>
          </div>

          {admin && changedN > 0 && adminFilter !== 'pricechanged' && (
            <div className="banner warn price-alert"><Icon n="tag" /><div><b>{changedN} ürünün liste fiyatı değişti.</b> Toptan fiyatlarını kontrol edin; kontrol edene kadar toptan fiyat liste fiyatını geçemez.</div><button className="btn sm outline" onClick={() => setAdminFilter('pricechanged')}>Göster</button></div>
          )}
          
          {actives.length > 0 && (
            <div className="af-row" aria-label="Seçili filtreler">
              {actives.map(([l, off], i) => <button key={i} className="af-chip" onClick={off} title="Filtreyi kaldır">{l}<Icon n="x" s={13} /></button>)}
              {actives.length > 1 && <button className="link af-clear" onClick={clearAll}>Tümünü temizle</button>}
            </div>
          )}
          {widened && <div className="banner info widen"><Icon n="search" /><div><b>“{q.trim()}” {scopeName} içinde yok.</b> Tüm ürünlerde bulunan {list.length} sonucu gösteriyoruz.</div><button className="btn sm outline" onClick={() => { setCat(null); setBrand(''); }}>Filtreyi kaldır</button></div>}
          {moreOutside > 0 && <div className="banner info widen"><Icon n="search" /><div>{scopeName} dışında da <b>{moreOutside} sonuç</b> var.</div><button className="btn sm outline" onClick={() => { setCat(null); setBrand(''); }}>Tüm ürünlerde ara</button></div>}
          <div className="result-line">
            <span>{list.length.toLocaleString('tr-TR')} ürün{!widened && scopeName && <> · <b>{scopeName}</b></>}</span>
            <span className="view-sw" role="group" aria-label="Görünüm">
              <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Kutu kutu" title="Kutu kutu"><Icon n="grid" s={17} /></button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="Sıra sıra" title="Sıra sıra"><Icon n="list" s={17} /></button>
            </span>
            {!admin && cartCount > 0 && <button className="link" onClick={() => go('sepet')}>Sepette {cartCount} kalem →</button>}
          </div>

          {shown.length === 0 ? (
            <Empty icon="search" title="Bu aramayla eşleşen ürün yok"><p>Kelimeyi kısaltmayı ya da filtreleri kaldırmayı deneyin.</p>{actives.length > 0 && <button className="btn primary" onClick={clearAll}><Icon n="x" s={15} />Tüm filtreleri temizle</button>}</Empty>
          ) : (
            <ul className={'plist' + (view === 'grid' ? ' pgrid' : '') + ' add-' + cardAdd(S, user?.role)}>
              {shown.map((p) => <ProductRow key={p.id} p={p} admin={admin} onOpen={() => (admin ? setEdit(p) : setOpen(p))} />)}
            </ul>
          )}
          {limit < list.length && <div ref={sentinel} className="more"><button className="btn ghost" onClick={more}>Daha fazla göster ({list.length - limit})</button></div>}
        </section>
      </div>

      {catSheet && (
        <Sheet title="Kategoriler" onClose={() => setCatSheet(false)}>
          <div className="cat-grid">
            <button className={'cat-link' + (cat == null ? ' on' : '')} onClick={() => { setCat(null); setCatSheet(false); }}><span>Tümü</span><b>{all.length}</b></button>
            <CatTree nodes={tree.roots} counts={counts} cat={cat} all onPick={(c) => { setCat(c); setCatSheet(false); }} />
          </div>
        </Sheet>
      )}
      {open && <ProductSheet p={open} onClose={() => setOpen(null)} />}
      {edit && <ProductEdit p={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CatTree({ nodes, counts, cat, open, onPick, all: expandAll, admin, depth = 0 }) {
  return nodes.filter((n) => (counts.get(n.id) || 0) > 0 && (admin || !n.hidden)).map((n) => {
    const kids = n.children.filter((k) => (counts.get(k.id) || 0) > 0);
    const expanded = expandAll || open?.has(n.id);
    return (
      <div key={n.id} className="cat-node">
        <button className={'cat-link' + (cat === n.id ? ' on' : '') + (depth ? ' sub' : '')} style={{ '--d': depth }} onClick={() => onPick(n.id)}>
          <span>{n.name}{kids.length > 0 && !expandAll && <i className="cat-caret" aria-hidden="true">{expanded ? '▾' : '▸'}</i>}</span><b>{counts.get(n.id)}</b>
        </button>
        {expanded && kids.length > 0 && <CatTree nodes={kids} counts={counts} cat={cat} open={open} onPick={onPick} all={expandAll} admin={admin} depth={depth + 1} />}
      </div>
    );
  });
}

function ProductRow({ p, admin, onOpen }) {
  const { settings: S, cart, user } = useStore();
  const qty = cart[p.id] || 0;
  const [hov, setHov] = useState(false); // bilgisayar: üstüne gelince (birden çok resim varsa) yazılar aşağı kayar, küçük resimler çıkar
  const [ix, setIx] = useState(0);
  const multi = FINE && S.cards?.hoverImgs !== false && [p.pi, ...(p.im || [])].filter(Boolean).length > 1;
  const st = stockInfo(p, S);
  const site = links.product(p, S);
  const menu = (e) => openMenu(e, admin ? [
    { label: 'Düzenle', icon: 'edit', onClick: onOpen },
    { label: p.a ? 'Pasif yap (bayilerden gizle)' : 'Aktif yap', icon: p.a ? 'eyeoff' : 'eye', onClick: () => quickSave(p, { a: p.a ? 0 : 1 }, p.a ? 'Ürün pasif yapıldı' : 'Ürün aktif yapıldı') },
    p.pc && { label: 'Fiyat uyarısını kaldır', icon: 'check', onClick: () => quickSave(p, { pc: null }, 'Uyarı kaldırıldı') },
    '-',
    { label: 'Stok kodunu kopyala', icon: 'copy', hint: p.k, onClick: () => copyText(p.k) },
    { label: 'Ürün adını kopyala', icon: 'copy', onClick: () => copyText(p.n) },
    site && { label: 'Sitede aç', icon: 'ext', onClick: () => window.open(site, '_blank', 'noopener') },
  ] : [
    { label: 'Ürünü aç', icon: 'zoom', onClick: onOpen },
    { label: qty ? `Sepete 1 tane daha ekle (${qty})` : 'Sepete ekle', icon: 'plus', onClick: () => { setQty(p.id, qty + 1); toast('Sepete eklendi'); } },
    qty > 0 && { label: 'Sepetten çıkar', icon: 'trash', danger: true, onClick: () => setQty(p.id, 0) },
    user?.role !== 'public' && S.requests.allowQuote && { label: 'Bu ürünü sor', icon: 'chat', onClick: () => askAbout(p, Math.max(1, qty)) },
    '-',
    { label: 'Stok kodunu kopyala', icon: 'copy', hint: p.k, onClick: () => copyText(p.k) },
    site && user?.role !== 'public' && { label: 'Sitede aç', icon: 'ext', onClick: () => window.open(site, '_blank', 'noopener') },
  ], p.n.length > 42 ? p.n.slice(0, 40) + '…' : p.n);
  return (
    <li className={'prow' + (!p.a ? ' inactive' : '') + (p.pc && admin ? ' changed' : '') + (hov && multi ? ' hov' : '')} onContextMenu={menu}
      onMouseEnter={multi ? () => setHov(true) : undefined} onMouseLeave={multi ? () => { setHov(false); setIx(0); } : undefined}>
      <button className="prow-main" onClick={onOpen}>
        <CardImg p={p} hov={hov && multi} ix={ix} setIx={setIx} />
        <div className="prow-info">
          <span className="prow-name">{p.n}</span>
          <span className="prow-meta">
            {admin && <code>{p.k}</code>}
            {S.catalog.showBrand && p.b && <span className="brand-tag">{p.b}</span>}
            {st && <span className={'dot tone-' + st.tone}>{st.t}</span>}
            {admin && !p.t && <span className="dot tone-muted">Etiketsiz</span>}
            {admin && !p.a && <span className="dot tone-muted">Pasif</span>}
            {admin && p.w == null && <span className="dot tone-warn">Toptan: oto</span>}
            {admin && p.nw && <span className="dot tone-info">Siteden yeni</span>}
            {admin && p.so && <span className="dot tone-muted">Sitede satışta değil</span>}
            {admin && p.pc && <span className="dot tone-bad">Liste {fmt(p.pc.r0, p.cur)} → {fmt(p.r, p.cur)}</span>}
          </span>
        </div>
      </button>
      <div className="prow-side">
        <PriceBlock p={p} />
        {admin ? (
          <button className="btn sm ghost" onClick={onOpen}><Icon n="edit" s={15} />Düzenle</button>
        ) : qty > 0 ? (
          <Stepper small value={qty} onChange={(v) => setQty(p.id, v)} />
        ) : (
          <button className="btn sm add" onClick={() => setQty(p.id, 1)} aria-label="Sepete ekle" title="Sepete ekle"><Icon n="plus" s={15} className="add-plus" /><span className="add-cart" aria-hidden="true"><Icon n="cart" s={18} /><i>+</i></span><span className="add-l">Sepete ekle</span></button>
        )}
      </div>
    </li>
  );
}

// Kart resmi: bilgisayarda üstüne gelince (birden fazla resim varsa) altta küçük resimler kayarak çıkar; küçük resmin
// üstünde gezinince büyük resim değişir, fare çıkınca ilk resme döner (sadece kutu görünümünde; satır görünümünde gizli)
const FINE = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
function CardImg({ p, hov, ix, setIx }) {
  const S = useStore((s) => s.settings);
  const [seen, setSeen] = useState(false); // küçük resimler bir kez yüklenince kapanırken de görünür kalsın (animasyon)
  useEffect(() => { if (hov) setSeen(true); }, [hov]);
  const n = [p.pi, ...(p.im || [])].filter(Boolean).length;
  // telefon: birden çok resim varsa kartı açmadan parmakla kaydırılır, altta hangi resimde olduğunu gösteren çizgiler
  if (!FINE && n > 1 && S.cards?.swipeImgs !== false) return <SwipeImgs p={p} />;
  const urls = seen ? imageList(p, S, 'lg') : [];
  const ths = seen ? imageList(p, S, 'sm') : [];
  return (
    <span className={'cimg' + (hov ? ' on' : '')}>
      <Thumb p={p} />
      {seen && urls.length > 1 && <>
        <img className={'cimg-alt' + (hov && ix > 0 ? ' on' : '')} src={urls[ix] || urls[0]} alt="" />
        <span className="cimg-bar" aria-hidden="true">{urls.slice(0, 6).map((_, i) => <i key={i} className={i === ix ? 'on' : ''} />)}</span>
        <span className="cimg-strip" aria-hidden={!hov}>{ths.slice(0, 5).map((u, i) => <span key={i} className={'cimg-th' + (i === ix ? ' on' : '')} style={{ '--k': i }} onMouseEnter={() => setIx(i)}><img src={u} alt="" loading="lazy" /></span>)}{ths.length > 5 && <span className="cimg-th more" style={{ '--k': 5 }}>+{ths.length - 5}</span>}</span>
      </>}
    </span>
  );
}
// Telefonda kart resmi: yana kaydırılan resimler (kaydırma kartı açmaz), altta konum çizgileri
function SwipeImgs({ p }) {
  const S = useStore((s) => s.settings);
  const urls = imageList(p, S, 'sm');
  const [k, setK] = useState(0);
  const ref = useRef(null);
  const onScroll = () => { const el = ref.current; if (!el) return; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== k) setK(i); };
  if (urls.length < 2) return <span className="cimg"><Thumb p={p} /></span>;
  return (
    <span className="cimg sw">
      <span className="cimg-sw" ref={ref} onScroll={onScroll}>
        <span className="cimg-sw-i"><Thumb p={p} /></span>
        {urls.slice(1, 8).map((u, i) => <span key={i} className="cimg-sw-i"><img src={u} alt="" loading="lazy" draggable="false" /></span>)}
      </span>
      <span className="cimg-dots" aria-hidden="true">{urls.slice(0, 8).map((_, i) => <i key={i} className={i === k ? 'on' : ''} />)}</span>
    </span>
  );
}

export function ProductSheet({ p, onClose, viewOnly = false }) {
  const { settings: S, cart, user, userPrices } = useStore();
  const [qty, setQ] = useState(cart[p.id] || 1);
  const st = stockInfo(p, S);
  const pr = priceFor(p, S, user, userPrices);
  const ask = async () => { onClose(); await askAbout(p, qty); };
  return (
    <Sheet wide title="Ürün detayı" onClose={onClose} footer={viewOnly ? null : <>
      {S.requests.allowQuote && user?.role !== 'public' && <button className="btn ghost" onClick={ask}><Icon n="chat" s={16} />Bu ürünü sor</button>}
      <button className="btn primary" onClick={() => { setQty(p.id, qty); toast('Sepete eklendi'); onClose(); }}><Icon n="cart" s={16} />{cart[p.id] ? 'Sepeti güncelle' : 'Sepete ekle'}</button>
    </>}>
      <div className="pdetail">
        <Gallery p={p} />
        <div className="pdetail-info">
          <h3>{p.n}</h3>
          <div className="prow-meta"><code>{p.k}</code>{p.b && <span className="brand-tag">{p.b}</span>}<span>{catName(S, p.c)}</span>{st && <span className={'dot tone-' + st.tone}>{st.t}</span>}</div>
          <PriceBlock p={p} big />
          {!viewOnly && <div className="qty-line">
            <span>Adet</span>
            <Stepper value={qty} min={1} onChange={setQ} />
            {pr.mine != null && <b className="num">{fmt(pr.mine * qty, p.cur)}</b>}
          </div>}
        </div>
      </div>
      {S.catalog.showDescription && <Description id={p.id} />}
    </Sheet>
  );
}

export function Gallery({ p }) {
  const S = useStore((s) => s.settings);
  const urls = imageList(p, S, 'lg');
  const thumbs = imageList(p, S, 'sm');
  // kaydırma sayfaları: elle yüklenen resim (fs), siteden resimler; video varsa ikinci sırada
  const slides = (p.img ? [{ t: 'fs' }] : []).concat(urls.map((u, z) => ({ t: 'img', u, z, th: thumbs[z] || u })));
  if (p.vd) slides.splice(Math.min(1, slides.length), 0, { t: 'vid', u: p.vd, poster: p.vdp || '' });
  const [i, setI] = useState(0);
  const [bad, setBad] = useState({});
  const [zoom, setZoom] = useState(null);
  const track = useRef(null);
  const box = zoom != null && <Lightbox urls={urls} thumbs={thumbs} start={zoom} title={p.n} onClose={() => setZoom(null)} />;
  if (slides.length <= 1) return (
    <>
      <button className="gal-single" onClick={() => urls.length && setZoom(0)} aria-label="Resmi büyüt" disabled={!urls.length}>
        <Thumb p={p} size="lg" />{urls.length > 0 && <span className="gal-zoom"><Icon n="zoom" s={16} /></span>}
      </button>
      {box}
    </>
  );
  // Küçük resme basınca kayma bitene kadar ara resimler "seçili" sayılmasın (çerçeve bir ona bir buna atlıyordu)
  const aim = useRef(null);
  const goTo = (k) => { setI(k); const el = track.current; if (!el) return; aim.current = { k, t: Date.now() }; el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); };
  const onScroll = (e) => {
    const el = e.currentTarget; const w = el.clientWidth || 1;
    const a = aim.current;
    if (a) { if (Math.abs(el.scrollLeft - a.k * w) < 2 || Date.now() - a.t > 900) aim.current = null; else return; }
    setI(Math.round(el.scrollLeft / w));
  };
  const grab = () => { aim.current = null; }; // parmakla kaydırmaya başlayınca normal takibe dön
  const isVid = slides[i]?.t === 'vid';
  return (
    <div className="gallery">
      <div className="gal-stage">
        <div className="gal-track" ref={track} onScroll={onScroll} onTouchStart={grab} onWheel={grab}>
          {slides.map((x, k) => (
            <div className="gal-slide" key={k}>
              {x.t === 'fs' ? <Thumb p={{ ...p, pi: null }} size="lg" />
                : x.t === 'vid' ? <PlayVideo src={x.u} poster={x.poster} active={i === k} />
                : bad[k] ? <Thumb p={{ ...p, pi: null, img: null }} size="lg" /> : (
                <button className="gal-open" onClick={() => setZoom(x.z)} aria-label="Resmi büyüt">
                  <img src={x.u} alt={`${p.n} – resim ${k + 1}`} loading={k ? 'lazy' : 'eager'} onError={() => setBad((b) => ({ ...b, [k]: 1 }))} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!isVid && <span className="gal-count num"><Icon n="zoom" s={13} /> {i + 1} / {slides.length}</span>}
        {i > 0 && <button className="gal-nav prev" onClick={() => goTo(i - 1)} aria-label="Önceki"><Icon n="back" s={18} /></button>}
        {i < slides.length - 1 && <button className="gal-nav next" onClick={() => goTo(i + 1)} aria-label="Sonraki"><Icon n="back" s={18} /></button>}
      </div>
      <ThumbStrip n={slides.length} active={i} onPick={goTo} render={(k) => {
        const x = slides[k];
        if (x.t === 'fs') return <Thumb p={{ ...p, pi: null }} size="sm" />;
        if (x.t === 'vid') return <VideoThumb src={x.u} poster={x.poster} />;
        return <img src={x.th} alt="" loading="lazy" />;
      }} />
      {box}
    </div>
  );
}

// Videonun küçük resmi: verilmiş kapak varsa o; yoksa videonun ~1. saniyesinden bir kare alınır (bellekte saklanır).
// Kare alınamazsa (video sitesi izin vermiyorsa) '' döner; o zaman küçük resimde videonun kendisi duraklatılmış gösterilir.
const frameCache = new Map();
// r2.dev adresleri bazı internet sağlayıcılarında açılmıyor → bekçi (workers.dev) üzerinden aktarılır
export function mediaUrl(u) {
  const m = /^https?:\/\/pub-([0-9a-f]{32})\.r2\.dev\/(.+)$/.exec(String(u || '').trim());
  return m && window.WATCH_URL ? `${window.WATCH_URL}/r2/${m[1]}/${m[2]}` : u;
}
export function useVideoFrame(src0, given) {
  const src = mediaUrl(src0);
  const [u, setU] = useState(() => given || frameCache.get(src) || null);
  useEffect(() => {
    if (given) { setU(given); return; }
    if (!src) { setU(''); return; }
    if (frameCache.has(src)) { setU(frameCache.get(src)); return; }
    let dead = false, v = null, to = 0;
    const done = (x) => { clearTimeout(to); if (x != null) frameCache.set(src, x); if (!dead) setU(x || ''); if (v) { v.removeAttribute('src'); try { v.load(); } catch {} } };
    // Önce video sitesi kare almaya (CORS) izin veriyor mu, ayrı ve zararsız bir istekle sorulur. İzin yoksa videoya
    // "izinli modda" hiç dokunulmaz: başarısız izinli deneme tarayıcının video önbelleğini bozup asıl videoyu açtırmıyordu.
    fetch(src, { mode: 'cors', headers: { Range: 'bytes=0-0' } }).then((r) => {
      if (dead) return;
      if (!r.ok && r.status !== 206) return done('');
      v = document.createElement('video');
      to = setTimeout(() => done(''), 9000);
      v.crossOrigin = 'anonymous'; v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(1.2, (v.duration || 4) * 0.12); }, { once: true });
      v.addEventListener('seeked', () => {
        try {
          const k = Math.min(1, 720 / (v.videoWidth || 720)); const c = document.createElement('canvas');
          c.width = Math.round((v.videoWidth || 720) * k); c.height = Math.round((v.videoHeight || 720) * k);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', 0.82));
        } catch { done(''); }
      }, { once: true });
      v.addEventListener('error', () => done(''), { once: true });
      v.src = src + (src.includes('?') ? '&' : '?') + 'kare=1'; // asıl videodan ayrı önbellek kaydı
    }).catch(() => done(''));
    return () => { dead = true; clearTimeout(to); };
  }, [src, given]);
  return u; // null: hazırlanıyor · '': alınamadı · adres: resim
}
export function VideoThumb({ src: src0, poster }) {
  const src = mediaUrl(src0);
  const f = useVideoFrame(src, poster);
  return <span className="gal-th-vid">{f ? <img src={f} alt="" /> : f === '' ? <video src={src + '#t=1'} muted playsInline preload="metadata" /> : null}<i><Icon n="play" s={14} /></i></span>;
}

// Video: sitenin kendi oynatıcısı gibi (tarayıcı düğmeleri yok). Görünürken sessiz ve döngülü oynar, dokununca
// durur/devam eder, köşede ses ve büyütme düğmesi, altta ilerleme çizgisi. Büyüt → tam ekran izleme (VideoViewer).
// Ürün penceresi (galeri) ve mağaza ana sayfasındaki video bölümü bunu kullanır.
export function PlayVideo({ src: src0, poster, active = true, fit = 'cover', auto = true, className = '' }) {
  const src = mediaUrl(src0);
  const v = useRef(null);
  const [muted, setMuted] = useState(auto); // dokununca oynayanlar sesli başlar
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState(false);
  const [big, setBig] = useState(false); // tam ekranda mı (aynı video öğesi tam ekran katmanına taşınır)
  const frame = useVideoFrame(src, poster);
  const pst = frame || undefined;
  useEffect(() => { const el = v.current; if (!el || big) return; if (active && auto) el.play().catch(() => {}); else el.pause(); }, [active, auto, big]);
  const toggle = () => { const el = v.current; if (!el) return; el.paused ? el.play().catch(() => {}) : el.pause(); };
  const open = () => setBig(true);
  // alttaki süre çubuğu: parmakla / fareyle tutup ileri-geri çekilir (resim şeridini kaydırmaz)
  const bar = useRef(null);
  const [seek, setSeek] = useState(null);
  const at = (e) => { const r = bar.current.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left - 10) / (r.width - 20))); };
  const jump = (x) => { const el = v.current; if (!el || !el.duration) return; el.currentTime = x * el.duration; setProg(x); };
  const fmtT = (x) => { x = Math.max(0, Math.floor(x || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
  if (err) return <div className={'gal-vid-err ' + className}><Icon n="play" s={26} /><span>Video açılamadı</span></div>;
  return (
    <div className={'gal-vid' + (playing ? ' playing' : '') + ' ' + className}>
      <video ref={v} src={src} poster={pst} muted={muted} loop playsInline preload="metadata" disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen"
        style={{ objectFit: fit }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setErr(true)}
        onTimeUpdate={(e) => { const d = e.currentTarget.duration; if (d) setProg(e.currentTarget.currentTime / d); }} onClick={() => !big && toggle()} />
      {!playing && <button className="gal-vid-play" onClick={toggle} aria-label="Oynat"><Icon n="play" s={28} /></button>}
      <button className="gal-vid-snd" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}><Icon n={muted ? 'mute' : 'sound'} s={17} /></button>
      <button className="gal-vid-big" onClick={open} aria-label="Büyüt" title="Büyük izle"><Icon n="full" s={17} /></button>
      <div className={'gal-vid-seek' + (seek != null ? ' on' : '')} ref={bar} role="slider" aria-label="Sar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((seek ?? prog) * 100)}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const x = at(e); setSeek(x); jump(x); }}
        onPointerMove={(e) => { if (seek == null) return; const x = at(e); setSeek(x); jump(x); }}
        onPointerUp={() => setSeek(null)} onPointerCancel={() => setSeek(null)}
        onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <span className="gal-vid-bar"><i style={{ transform: `scaleX(${seek ?? prog})` }} /></span>
        {seek != null && <><b className="gal-vid-knob" style={{ left: `calc(10px + ${seek} * (100% - 20px))` }} /><em className="gal-vid-time num" style={{ left: `clamp(30px, calc(10px + ${seek} * (100% - 20px)), calc(100% - 30px))` }}>{fmtT(seek * (v.current?.duration || 0))}</em></>}
      </div>
      {big && v.current && <VideoViewer el={v.current} onClose={() => setBig(false)} />}
    </div>
  );
}

// Sarma çubuğu: parmakla / fareyle çubuğun herhangi bir yerinden tutup sürüklenir (iPhone'un kendi sürgüsü tutmuyordu)
function Scrub({ t, dur, onSeek }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);
  const at = (e) => { const r = ref.current.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
  const p = drag != null ? drag : dur ? t / dur : 0;
  return (
    <div ref={ref} className={'vv-seek' + (drag != null ? ' on' : '')} role="slider" aria-label="Sar" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const x = at(e); setDrag(x); onSeek(x); }}
      onPointerMove={(e) => { if (drag == null) return; const x = at(e); setDrag(x); onSeek(x); }}
      onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      <span className="vv-seek-t"><i style={{ width: p * 100 + '%' }} /></span>
      <b style={{ left: p * 100 + '%' }} />
    </div>
  );
}

// Tam ekran video izleme: karanlık zemin, video ekrana sığar (kesilmez), sesli başlar. Dokununca düğmeler görünür /
// gizlenir; ortada oynat-durdur, altta ileri-geri sarma çubuğu, süre ve ses. Kapat (×), Esc ya da aşağı kaydırma.
export function VideoViewer({ el, onClose }) {
  const slot = useRef(null);
  const [playing, setPlaying] = useState(!el.paused);
  const [ui, setUi] = useState(true);
  const [t, setT] = useState(el.currentTime || 0);
  const [dur, setDur] = useState(el.duration || 0);
  const [muted, setMuted] = useState(false);
  const [out, setOut] = useState(false);
  const hideT = useRef(0);
  const close = () => { if (out) return; setOut(true); setTimeout(onClose, 180); };
  const poke = () => { setUi(true); clearTimeout(hideT.current); hideT.current = setTimeout(() => { if (!el.paused) setUi(false); }, 2600); };
  const toggle = () => { el.paused ? el.play().catch(() => {}) : el.pause(); poke(); };
  // Küçük oynatıcıdaki video öğesinin kendisi buraya taşınır: yeniden yükleme yok, duraksamadan aynı yerden devam eder.
  // Kapanınca yerine geri konur (ses eski hâline döner).
  useLayoutEffect(() => {
    const home = { parent: el.parentNode, style: el.getAttribute('style'), muted: el.muted };
    slot.current.appendChild(el);
    el.style.objectFit = 'contain'; el.style.pointerEvents = 'none';
    el.muted = false;
    if (el.paused) el.play().catch(() => { el.muted = true; setMuted(true); el.play().catch(() => {}); });
    const on = { play: () => { setPlaying(true); poke(); }, pause: () => { setPlaying(false); setUi(true); }, timeupdate: () => setT(el.currentTime), durationchange: () => setDur(el.duration || 0), loadedmetadata: () => setDur(el.duration || 0), volumechange: () => setMuted(el.muted) };
    for (const k in on) el.addEventListener(k, on[k]);
    const kd = (e) => { if (e.key === 'Escape') close(); if (e.key === ' ') { e.preventDefault(); toggle(); } };
    addEventListener('keydown', kd); poke();
    return () => {
      for (const k in on) el.removeEventListener(k, on[k]);
      removeEventListener('keydown', kd); clearTimeout(hideT.current);
      if (home.parent) home.parent.insertBefore(el, home.parent.firstChild);
      if (home.style == null) el.removeAttribute('style'); else el.setAttribute('style', home.style);
      el.muted = home.muted;
      if (el.paused) el.play().catch(() => {});
    };
  }, []);
  const fmtT = (x) => { x = Math.max(0, Math.floor(x || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
  // telefonda aşağı kaydırınca kapanır
  const sw = useRef(null);
  return createPortal(
    <div className={'vv' + (ui ? ' ui' : '') + (out ? ' out' : '')} role="dialog" aria-modal="true" aria-label="Video"
      onTouchStart={(e) => { e.stopPropagation(); sw.current = e.target.closest('.vv-bar') ? null : { y: e.touches[0].clientY, x: e.touches[0].clientX }; }}
      onTouchMove={(e) => e.stopPropagation()} onTouchCancel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onTouchEnd={(e) => { e.stopPropagation(); const s0 = sw.current; sw.current = null; const p = e.changedTouches[0]; if (s0 && p.clientY - s0.y > 110 && Math.abs(p.clientX - s0.x) < 80) close(); }}>
      <div ref={slot} className="vv-slot" />
      <div className="vv-tap" onClick={() => (ui ? (playing ? setUi(false) : toggle()) : poke())} />
      <button className="vv-x" onClick={close} aria-label="Kapat"><Icon n="x" s={22} /></button>
      <button className="vv-pp" onClick={toggle} aria-label={playing ? 'Durdur' : 'Oynat'}><Icon n={playing ? 'pause' : 'play'} s={30} /></button>
      <div className="vv-bar" onClick={(e) => e.stopPropagation()}>
        <span className="num">{fmtT(t)}</span>
        <Scrub t={t} dur={dur} onSeek={(x) => { if (!dur) return; el.currentTime = x * dur; setT(el.currentTime); poke(); }} />
        <span className="num">{fmtT(dur)}</span>
        <button onClick={() => { el.muted = !el.muted; setMuted(el.muted); poke(); }} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}><Icon n={muted ? 'mute' : 'sound'} s={19} /></button>
      </div>
    </div>,
    document.body
  );
}

// Küçük resim şeridi: taşarsa iki yanda ok çıkar, fare tekerleğiyle yana kayar, seçili resmi hep görünür tutar
export function ThumbStrip({ n, active, onPick, render, dark }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    setEdge({ l: el.scrollLeft > 2, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    const wheel = (e) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault(); el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', wheel); };
  }, [n]);
  useEffect(() => {
    const el = ref.current; const b = el?.children[active]; if (!b) return;
    const l = b.offsetLeft - el.offsetLeft, r = l + b.offsetWidth;
    if (l < el.scrollLeft + 8) el.scrollTo({ left: l - 40, behavior: 'smooth' });
    else if (r > el.scrollLeft + el.clientWidth - 8) el.scrollTo({ left: r - el.clientWidth + 40, behavior: 'smooth' });
  }, [active]);
  const page = (d) => { const el = ref.current; el?.scrollBy({ left: d * el.clientWidth * 0.8, behavior: 'smooth' }); };
  return (
    <div className={'strip' + (dark ? ' dark' : '')}>
      {edge.l && <button className="strip-arrow l" onClick={() => page(-1)} aria-label="Önceki resimler"><Icon n="back" s={16} /></button>}
      <div className="gal-thumbs" ref={ref} onScroll={measure}>
        {Array.from({ length: n }, (_, k) => (
          <button key={k} className={'gal-th' + (k === active ? ' on' : '')} onClick={() => onPick(k)} aria-label={`Resim ${k + 1}`} aria-current={k === active}>
            {render(k)}
          </button>
        ))}
      </div>
      {edge.r && <button className="strip-arrow r" onClick={() => page(1)} aria-label="Sonraki resimler"><Icon n="back" s={16} /></button>}
    </div>
  );
}

// Resim görüntüleyici: resim ekrana sığar (büyütülmez). İstenirse büyüteçle 2 kat yakınlaştırılır.
export function Lightbox({ urls, thumbs, start = 0, title, onClose }) {
  const [i, setI] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const track = useRef(null);
  const imgs = useRef([]);
  const iRef = useRef(start); iRef.current = i;
  const go = useCallback((k) => {
    const n = Math.max(0, Math.min(urls.length - 1, k));
    setZoomed(false); setI(n);
    const el = track.current; if (el) el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  }, [urls.length]);
  useEffect(() => {
    const el = track.current; if (el) el.scrollLeft = start * el.clientWidth;
    const k = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(iRef.current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(iRef.current - 1); }
    };
    addEventListener('keydown', k, true); document.body.classList.add('noscroll');
    return () => { removeEventListener('keydown', k, true); document.body.classList.remove('noscroll'); };
  }, []);
  function toggleZoom(e) {
    const img = imgs.current[i]; if (!img) return;
    if (zoomed) { setZoomed(false); return; }
    const r = img.getBoundingClientRect();
    const fx = e?.clientX != null ? (e.clientX - r.left) / r.width : 0.5, fy = e?.clientY != null ? (e.clientY - r.top) / r.height : 0.5;
    img.style.setProperty('--zw', r.width * 2 + 'px');
    setZoomed(true);
    requestAnimationFrame(() => { const sc = img.parentElement; sc.scrollLeft = fx * img.offsetWidth - sc.clientWidth / 2; sc.scrollTop = fy * img.offsetHeight - sc.clientHeight / 2; });
  }
  const many = urls.length > 1;
  return createPortal(
    <div className={'lb' + (many ? ' many' : '')} role="dialog" aria-modal="true" aria-label={title}>
      <div className={'lb-track' + (zoomed ? ' locked' : '')} ref={track} onScroll={(e) => { if (!zoomed) { const el = e.currentTarget; const n = Math.round(el.scrollLeft / el.clientWidth); if (n !== iRef.current) setI(n); } }}>
        {urls.map((u, k) => (
          <div key={k} className={'lb-slide' + (zoomed && k === i ? ' zoomed' : '')} onClick={(e) => { if (e.target === e.currentTarget && !zoomed) onClose(); }}>
            <img ref={(el) => (imgs.current[k] = el)} src={u} alt={`${title} – resim ${k + 1}`} draggable="false" loading={Math.abs(k - start) > 1 ? 'lazy' : 'eager'}
              onDoubleClick={(e) => k === i && toggleZoom(e)} onClick={(e) => zoomed && k === i && toggleZoom(e)} />
          </div>
        ))}
      </div>
      <div className="lb-top">
        <span className="num">{i + 1} / {urls.length}</span>
        <span className="lb-title">{title}</span>
        <button className={'lb-btn' + (zoomed ? ' on' : '')} onClick={() => toggleZoom()} aria-label={zoomed ? 'Küçült' : 'Yakınlaştır'} title={zoomed ? 'Küçült' : 'Yakınlaştır (çift tıklama)'}><Icon n="zoom" s={20} /></button>
        <button className="lb-btn" onClick={onClose} aria-label="Kapat"><Icon n="x" s={22} /></button>
      </div>
      {i > 0 && <button className="lb-btn lb-nav prev" onClick={() => go(i - 1)} aria-label="Önceki"><Icon n="back" s={24} /></button>}
      {i < urls.length - 1 && <button className="lb-btn lb-nav next" onClick={() => go(i + 1)} aria-label="Sonraki"><Icon n="back" s={24} /></button>}
      {many && <div className="lb-strip"><ThumbStrip dark n={urls.length} active={i} onPick={go} render={(k) => <img src={thumbs?.[k] || urls[k]} alt="" loading="lazy" />} /></div>}
    </div>,
    document.body
  );
}

function Description({ id }) {
  const [html, setHtml] = useState(null);
  const [more, setMore] = useState(false);
  const [zoom, setZoom] = useState(null);
  useEffect(() => { let live = true; api().getDesc(id).then((h) => live && setHtml(h ? cleanHtml(h) : '')).catch(() => live && setHtml('')); return () => { live = false; }; }, [id]);
  if (!html) return null;
  return (
    <section className={'pdesc' + (more ? ' open' : '')}>
      <h4 className="eyebrow">Ürün açıklaması</h4>
      <div className="pdesc-body" dangerouslySetInnerHTML={{ __html: html }} onClick={(e) => {
        if (e.target.tagName !== 'IMG') return;
        const imgs = [...e.currentTarget.querySelectorAll('img')]; setZoom({ urls: imgs.map((x) => x.src), start: imgs.indexOf(e.target) });
      }} />
      {!more && <button className="link" onClick={() => setMore(true)}>Devamını göster</button>}
      {zoom && <Lightbox urls={zoom.urls} start={zoom.start} title="Açıklama resmi" onClose={() => setZoom(null)} />}
    </section>
  );
}

// Ürün hakkında soru talebi aç (ürün detayı ve sağ tık menüsünden)
async function askAbout(p, qty) {
  const { user, settings: S, userPrices } = store.s;
  const pr = priceFor(p, S, user, userPrices);
  const item = { id: p.id, k: p.k, n: p.n, cur: p.cur, qty, list: p.r, asked: pr.mine, offer: pr.mine };
  const t = now();
  const id = await api().createRequest({
    uid: user.uid, userName: user.name || user.username, shop: user.shop || '', type: 'quote', status: 'new', items: [item], note: '', pickup: '',
    createdAt: t, updatedAt: t, unreadAdmin: 1, unreadUser: 0, lastMsg: 'Ürün hakkında soru', lastFrom: 'user',
  }, [{ from: 'system', text: 'Ürün sorusu açıldı · ' + p.n, at: t }]);
  openRequest(id); toast('Soru açıldı, mesajınızı yazın');
}

// Sağ tık menüsünden hızlı değişiklik (aktif/pasif, uyarı kaldır)
async function quickSave(p, patch, msg) {
  const list = store.s.catalog.map(({ _s, _t, ...x }) => {
    if (x.id !== p.id) return x;
    const n = { ...x, ...patch };
    for (const k of Object.keys(patch)) if (patch[k] == null) delete n[k];
    return n;
  });
  try { await api().saveCatalog(list); setCatalog(list); toast(msg); } catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
}
