import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore, setQty, go, api, toast, store, openRequest, setCatalog } from './store.js';
import { Icon, Thumb, Stepper, Sheet, Empty, useInfinite, openMenu, copyText } from './ui.jsx';
import { norm, fmt, priceFor, catName, now } from './utils.js';
import { links } from './route.js';
import { ProductEdit, SyncButton } from './admin.jsx';
import { buildTree, productCats, cleanHtml } from './cats.js';
import { TLHint } from './listsheet.jsx';
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
  return t && t.includes('{pi}') ? files.map((f) => t.replaceAll('{pi}', f)) : [];
}

export function stockInfo(p, S) {
  if (S.catalog.stockMode === 'hidden') return null;
  if (p.s <= 0) return { t: 'Stok yok', tone: 'bad' };
  if (S.catalog.stockMode === 'number') return { t: p.s + ' adet', tone: p.s <= S.catalog.lowStock ? 'warn' : 'ok' };
  return p.s <= S.catalog.lowStock ? { t: 'Az kaldı', tone: 'warn' } : { t: 'Stokta', tone: 'ok' };
}

export function PriceBlock({ p, big }) {
  const { settings: S, user, userPrices } = useStore();
  const pr = priceFor(p, S, user, userPrices);
  if (user?.role === 'public') {
    return (
      <div className={'price' + (big ? ' big' : '')}>
        {pr.mine == null ? <span className="price-ask">Fiyat sorun</span> : <span className="price-mine"><small>Fiyat:</small>{fmt(pr.mine, p.cur)}</span>}
        {S.pricing.showTL && <TLHint v={pr.mine} cur={p.cur} />}
      </div>
    );
  }
  return (
    <div className={'price' + (big ? ' big' : '')}>
      {S.pricing.showRetail && pr.list > 0 && <span className="price-list">Liste: <b className="num">{fmt(pr.list, p.cur)}</b></span>}
      {pr.mine == null
        ? <span className="price-ask">Fiyat sorun</span>
        : <span className="price-mine"><small>{pr.src === 'ozel' ? 'Size özel:' : 'Toptan:'}</small>{fmt(pr.mine, p.cur)}</span>}
      {(user?.role === 'admin' || S.pricing.showTL) && <TLHint v={pr.mine} cur={p.cur} />}
    </div>
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
          <CatTree nodes={tree.roots} counts={counts} cat={cat} open={openPath} onPick={setCat} admin={admin} />
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
          {user?.role === 'public' && <GuestGuide />}
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
            {!admin && cartCount > 0 && <button className="link" onClick={() => go('sepet')}>Sepette {cartCount} kalem →</button>}
          </div>

          {shown.length === 0 ? (
            <Empty icon="search" title="Bu aramayla eşleşen ürün yok"><p>Kelimeyi kısaltmayı ya da filtreleri kaldırmayı deneyin.</p>{actives.length > 0 && <button className="btn primary" onClick={clearAll}><Icon n="x" s={15} />Tüm filtreleri temizle</button>}</Empty>
          ) : (
            <ul className="plist">
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
            <CatTree nodes={tree.roots} counts={counts} cat={cat} all onPick={(c) => { setCat(c); setCatSheet(false); }} admin={admin} />
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
    site && { label: 'Sitede aç', icon: 'ext', onClick: () => window.open(site, '_blank', 'noopener') },
  ], p.n.length > 42 ? p.n.slice(0, 40) + '…' : p.n);
  return (
    <li className={'prow' + (!p.a ? ' inactive' : '') + (p.pc && admin ? ' changed' : '')} onContextMenu={menu}>
      <button className="prow-main" onClick={onOpen}>
        <Thumb p={p} />
        <div className="prow-info">
          <span className="prow-name">{p.n}</span>
          <span className="prow-meta">
            <code>{p.k}</code>
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
          <button className="btn sm add" onClick={() => setQty(p.id, 1)} disabled={p.s <= 0 && S.catalog.stockMode !== 'hidden' && false}><Icon n="plus" s={15} />Sepete ekle</button>
        )}
      </div>
    </li>
  );
}

export function ProductSheet({ p, onClose }) {
  const { settings: S, cart, user, userPrices } = useStore();
  const [qty, setQ] = useState(cart[p.id] || 1);
  const st = stockInfo(p, S);
  const pr = priceFor(p, S, user, userPrices);
  const ask = async () => { onClose(); await askAbout(p, qty); };
  return (
    <Sheet wide title="Ürün detayı" onClose={onClose} footer={<>
      {S.requests.allowQuote && user?.role !== 'public' && <button className="btn ghost" onClick={ask}><Icon n="chat" s={16} />Bu ürünü sor</button>}
      <button className="btn primary" onClick={() => { setQty(p.id, qty); toast('Sepete eklendi'); onClose(); }}><Icon n="cart" s={16} />{cart[p.id] ? 'Sepeti güncelle' : 'Sepete ekle'}</button>
    </>}>
      <div className="pdetail">
        <Gallery p={p} />
        <div className="pdetail-info">
          <h3>{p.n}</h3>
          <div className="prow-meta"><code>{p.k}</code>{p.b && <span className="brand-tag">{p.b}</span>}<span>{catName(S, p.c)}</span>{st && <span className={'dot tone-' + st.tone}>{st.t}</span>}</div>
          <PriceBlock p={p} big />
          <div className="qty-line">
            <span>Adet</span>
            <Stepper value={qty} min={1} onChange={setQ} />
            {pr.mine != null && <b className="num">{fmt(pr.mine * qty, p.cur)}</b>}
          </div>
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
  const slides = (p.img ? [null] : []).concat(urls); // null = elle yüklenen resim
  const [i, setI] = useState(0);
  const [bad, setBad] = useState({});
  const [zoom, setZoom] = useState(null);
  const track = useRef(null);
  const off = p.img ? 1 : 0;
  const box = zoom != null && <Lightbox urls={urls} thumbs={thumbs} start={zoom} title={p.n} onClose={() => setZoom(null)} />;
  if (slides.length <= 1) return (
    <>
      <button className="gal-single" onClick={() => urls.length && setZoom(0)} aria-label="Resmi büyüt" disabled={!urls.length}>
        <Thumb p={p} size="lg" />{urls.length > 0 && <span className="gal-zoom"><Icon n="zoom" s={16} /></span>}
      </button>
      {box}
    </>
  );
  const goTo = (k) => { setI(k); const el = track.current; if (el) el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); };
  const onScroll = (e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / el.clientWidth)); };
  return (
    <div className="gallery">
      <div className="gal-stage">
        <div className="gal-track" ref={track} onScroll={onScroll}>
          {slides.map((u, k) => (
            <div className="gal-slide" key={k}>
              {u == null ? <Thumb p={{ ...p, pi: null }} size="lg" /> : bad[k] ? <Thumb p={{ ...p, pi: null, img: null }} size="lg" /> : (
                <button className="gal-open" onClick={() => setZoom(k - off)} aria-label="Resmi büyüt">
                  <img src={u} alt={`${p.n} – resim ${k + 1}`} loading={k ? 'lazy' : 'eager'} onError={() => setBad((b) => ({ ...b, [k]: 1 }))} />
                </button>
              )}
            </div>
          ))}
        </div>
        <span className="gal-count num"><Icon n="zoom" s={13} /> {i + 1} / {slides.length}</span>
        {i > 0 && <button className="gal-nav prev" onClick={() => goTo(i - 1)} aria-label="Önceki resim"><Icon n="back" s={18} /></button>}
        {i < slides.length - 1 && <button className="gal-nav next" onClick={() => goTo(i + 1)} aria-label="Sonraki resim"><Icon n="back" s={18} /></button>}
      </div>
      <ThumbStrip n={slides.length} active={i} onPick={goTo} render={(k) => (slides[k] == null ? <Thumb p={{ ...p, pi: null }} size="sm" /> : <img src={thumbs[k - off] || slides[k]} alt="" loading="lazy" />)} />
      {box}
    </div>
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
