import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore, setQty, go, api, toast, store, openRequest } from './store.js';
import { Icon, Thumb, Stepper, Sheet, Empty, useInfinite } from './ui.jsx';
import { norm, fmt, priceFor, catName, now } from './utils.js';
import { ProductEdit } from './admin.jsx';
import { buildTree, productCats, cleanHtml } from './cats.js';

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
  const saving = pr.mine != null && pr.list > 0 ? Math.round((1 - pr.mine / pr.list) * 100) : 0;
  return (
    <div className={'price' + (big ? ' big' : '')}>
      {((S.pricing.showRetail && pr.list > 0 && pr.mine !== pr.list) || (S.pricing.showSaving && saving > 0)) && (
        <span className="price-list">
          {S.pricing.showRetail && pr.list > 0 && pr.mine !== pr.list && <>Liste <b className="num">{fmt(pr.list, p.cur)}</b></>}
          {S.pricing.showSaving && saving > 0 && <span className="price-save">−%{saving}</span>}
        </span>
      )}
      {pr.mine == null
        ? <span className="price-ask">Fiyat sorun</span>
        : <span className="price-mine"><small>{pr.src === 'ozel' ? 'Size özel' : 'Toptan'}</small>{fmt(pr.mine, p.cur)}</span>}
    </div>
  );
}

export function Catalog({ admin }) {
  const { settings: S, cart } = useStore();
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
  const tree = useTree();

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

  const list = useMemo(() => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    const useTags = admin || S.catalog.searchTags;
    let r = all.filter((p) => (cat == null || pcats.get(p.id)?.has(cat)) && (!brand || p.b === brand) && (!stockOnly || p.s > 0)
      && toks.every((t) => p._s.includes(t) || (useTags && p._t.includes(t))));
    if (toks.length) r = [...r].sort((a, b) => toks.filter((t) => b._s.includes(t)).length - toks.filter((t) => a._s.includes(t)).length);
    if (admin && adminFilter === 'inactive') r = r.filter((p) => !p.a);
    if (admin && adminFilter === 'nowholesale') r = r.filter((p) => p.w == null);
    if (admin && adminFilter === 'noimg') r = r.filter((p) => !p.img && !p.pi);
    if (admin && adminFilter === 'notags') r = r.filter((p) => !p.t);
    if (sort === 'asc') r = [...r].sort((a, b) => a.r - b.r);
    if (sort === 'desc') r = [...r].sort((a, b) => b.r - a.r);
    if (sort === 'name') r = [...r].sort((a, b) => a.n.localeCompare(b.n, 'tr'));
    return r;
  }, [all, q, cat, sort, stockOnly, adminFilter, admin, brand, pcats, S.catalog.searchTags]);

  useEffect(() => setLimit(S.catalog.pageSize), [q, cat, sort, stockOnly, adminFilter, brand]);
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
              <input id="cat-search" type="search" placeholder="Ürün adı veya stok kodu… (ör. jcid face id)" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button className="icon-btn sm" onClick={() => setQ('')} aria-label="Temizle"><Icon n="x" s={16} /></button>}
            </div>
            <div className="chips" role="tablist" aria-label="Kategori">
              <button className="chip only-m" onClick={() => setCatSheet(true)}><Icon n="filter" s={15} />{cat == null ? 'Kategoriler' : tree.nodes.get(cat)?.name || catName(S, cat)}</button>
              {cat != null && <button className="chip on only-m" onClick={() => setCat(null)}>Tümü <Icon n="x" s={14} /></button>}
              <button className={'chip' + (stockOnly ? ' on' : '')} onClick={() => setStockOnly(!stockOnly)}>Stoktakiler</button>
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
                  </select>
                </label>
              )}
              {admin && <button className="chip accent" onClick={() => setEdit({})}><Icon n="plus" s={15} />Yeni ürün</button>}
            </div>
          </div>

          <div className="result-line">
            <span>{list.length.toLocaleString('tr-TR')} ürün{cat != null && <> · <b>{tree.nodes.get(cat)?.name || catName(S, cat)}</b></>}{brand && <> · <b>{brand}</b></>}</span>
            {!admin && cartCount > 0 && <button className="link" onClick={() => go('sepet')}>Sepette {cartCount} kalem →</button>}
          </div>

          {shown.length === 0 ? (
            <Empty icon="search" title="Bu aramayla eşleşen ürün yok">Kelimeyi kısaltmayı veya kategoriyi “Tümü” yapmayı deneyin.</Empty>
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
  const { settings: S, cart } = useStore();
  const qty = cart[p.id] || 0;
  const st = stockInfo(p, S);
  return (
    <li className={'prow' + (!p.a ? ' inactive' : '')}>
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
          <button className="btn sm add" onClick={() => setQty(p.id, 1)} disabled={p.s <= 0 && S.catalog.stockMode !== 'hidden' && false}><Icon n="plus" s={15} />Sepete</button>
        )}
      </div>
    </li>
  );
}

function ProductSheet({ p, onClose }) {
  const { settings: S, cart, user, userPrices } = useStore();
  const [qty, setQ] = useState(cart[p.id] || 1);
  const st = stockInfo(p, S);
  const pr = priceFor(p, S, user, userPrices);
  const ask = async () => {
    const item = { id: p.id, k: p.k, n: p.n, cur: p.cur, qty, list: p.r, asked: pr.mine, offer: pr.mine };
    const t = now();
    const id = await api().createRequest({
      uid: user.uid, userName: user.name || user.username, shop: user.shop || '', type: 'quote', status: 'new', items: [item], note: '', pickup: '',
      createdAt: t, updatedAt: t, unreadAdmin: 1, unreadUser: 0, lastMsg: 'Ürün hakkında soru', lastFrom: 'user',
    }, [{ from: 'system', text: 'Ürün sorusu açıldı · ' + p.n, at: t }]);
    onClose(); openRequest(id); toast('Soru açıldı, mesajınızı yazın');
  };
  return (
    <Sheet title="Ürün detayı" onClose={onClose} footer={<>
      {S.requests.allowQuote && <button className="btn ghost" onClick={ask}><Icon n="chat" s={16} />Bu ürünü sor</button>}
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
  const box = zoom != null && <Lightbox urls={urls} start={zoom} title={p.n} onClose={() => setZoom(null)} />;
  if (slides.length <= 1) return (
    <>
      <button className="gal-single" onClick={() => urls.length && setZoom(0)} aria-label="Resmi büyüt" disabled={!urls.length}>
        <Thumb p={p} size="lg" />{urls.length > 0 && <span className="gal-zoom"><Icon n="zoom" s={16} /></span>}
      </button>
      {box}
    </>
  );
  const goTo = (k) => { setI(k); track.current?.children[k]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }); };
  const onScroll = (e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / el.clientWidth)); };
  return (
    <div className="gallery">
      <div className="gal-track" ref={track} onScroll={onScroll}>
        {slides.map((u, k) => (
          <div className="gal-slide" key={k}>
            {u == null ? <Thumb p={{ ...p, pi: null }} size="lg" /> : bad[k] ? <Thumb p={{ ...p, pi: null, img: null }} size="lg" /> : (
              <button className="gal-open" onClick={() => setZoom(k - (p.img ? 1 : 0))} aria-label="Resmi büyüt">
                <img src={u} alt={`${p.n} – resim ${k + 1}`} loading={k ? 'lazy' : 'eager'} onError={() => setBad((b) => ({ ...b, [k]: 1 }))} />
              </button>
            )}
          </div>
        ))}
      </div>
      <span className="gal-count num"><Icon n="zoom" s={13} /> {i + 1} / {slides.length}</span>
      {i > 0 && <button className="gal-nav prev" onClick={() => goTo(i - 1)} aria-label="Önceki resim"><Icon n="back" s={18} /></button>}
      {i < slides.length - 1 && <button className="gal-nav next" onClick={() => goTo(i + 1)} aria-label="Sonraki resim"><Icon n="back" s={18} /></button>}
      <div className="gal-thumbs">
        {slides.map((u, k) => (
          <button key={k} className={'gal-th' + (k === i ? ' on' : '')} onClick={() => goTo(k)} aria-label={`Resim ${k + 1}`}>
            {u == null ? <Thumb p={{ ...p, pi: null }} size="sm" /> : <img src={thumbs[k - (p.img ? 1 : 0)] || u} alt="" loading="lazy" />}
          </button>
        ))}
      </div>
      {box}
    </div>
  );
}

// Tam ekran resim görüntüleyici: kaydır, oklar, dokununca / tıklayınca 2,5x yakınlaştır
export function Lightbox({ urls, start = 0, title, onClose }) {
  const [i, setI] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const track = useRef(null);
  useEffect(() => {
    track.current?.children[start]?.scrollIntoView({ block: 'nearest', inline: 'start' });
    const k = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    addEventListener('keydown', k, true); document.body.classList.add('noscroll');
    return () => { removeEventListener('keydown', k, true); document.body.classList.remove('noscroll'); };
  }, []);
  function go(d) {
    setZoomed(false);
    setI((cur) => { const n = Math.max(0, Math.min(urls.length - 1, cur + d)); track.current?.children[n]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }); return n; });
  }
  function toggleZoom(e, k) {
    const sc = e.currentTarget;
    if (zoomed) { setZoomed(false); return; }
    const r = sc.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    setZoomed(true);
    requestAnimationFrame(() => { sc.scrollLeft = fx * sc.scrollWidth - r.width / 2; sc.scrollTop = fy * sc.scrollHeight - r.height / 2; });
  }
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={title}>
      <div className={'lb-track' + (zoomed ? ' locked' : '')} ref={track} onScroll={(e) => { if (!zoomed) setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth)); }}>
        {urls.map((u, k) => (
          <div key={k} className={'lb-slide' + (zoomed && k === i ? ' zoomed' : '')} onClick={(e) => k === i && toggleZoom(e, k)}>
            <img src={u} alt={`${title} – resim ${k + 1}`} draggable="false" />
          </div>
        ))}
      </div>
      <div className="lb-top">
        <span className="num">{i + 1} / {urls.length}</span>
        <span className="lb-hint">{zoomed ? 'Küçültmek için dokunun' : 'Yakınlaştırmak için dokunun'}</span>
        <button className="lb-btn" onClick={onClose} aria-label="Kapat"><Icon n="x" s={22} /></button>
      </div>
      {i > 0 && <button className="lb-btn lb-nav prev" onClick={() => go(-1)} aria-label="Önceki"><Icon n="back" s={24} /></button>}
      {i < urls.length - 1 && <button className="lb-btn lb-nav next" onClick={() => go(1)} aria-label="Sonraki"><Icon n="back" s={24} /></button>}
    </div>
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
