// Paket 0 (6.11.2026): sıfırdan yeni mağaza ana sayfası bölümleri. Eski bölümlere dokunmaz; Paket 0 seçilince
// shopHome.layout'a bu bölümler girer, eskiler gizlenir (silinmez). Bölüm anahtarları 'p0:' ile başlar ve
// layoutOf() bunları KENDİLİĞİNDEN eklemez (eski düzen ve Paket 1/2 birebir aynı kalır).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, go, setQty, toast } from './store.js';
import { Icon, Thumb } from './ui.jsx';
import { fmt, norm, priceFor } from './utils.js';
import { BG_BY } from './presets.js';
import { feat } from './extras.jsx';
import { liveSets, setView, openSet, SetCover } from './sets.jsx';
import { useBrandList, openBrand } from './brandsets.jsx';
import { ShopImg, CtaButton, isProdImg } from './shophome.jsx';
import { useTree, useVisibleProducts } from './catalog.jsx';

export { P0_KEYS } from './p0keys.js';
const LIGHT_TH = ['ice', 'sand', 'mint'];
const hasImg = (p) => !!(p && (p.pi || p.im || (Array.isArray(p.im) && p.im.length)));
const sellable = (p) => p && p.a !== 0 && !p.so;

// ---- 1 · Üçlü vitrin: büyük kutu (sırayla dönen reklamlar) + yanda iki küçük kampanya
function Panel({ s, big, open, on = true }) {
  const bgp = BG_BY[s.bg];
  const lt = bgp ? bgp.ink === 'l' : LIGHT_TH.includes(s.theme);
  const cover = s.img && !isProdImg(s.img) && ['cover', 'full', 'photo'].includes(s.layout);
  return (
    <article className={'p0-pan th-' + (s.theme || 'night') + (big ? ' big' : '') + (lt ? ' lt' : '') + (bgp ? ' bgp' : '') + (cover ? ' cover' : '') + (on ? ' on' : '')} style={bgp ? { '--bgp': bgp.bg } : undefined}
      onClick={s.link ? open(s.link) : undefined} role={s.link ? 'link' : undefined}>
      {cover && <ShopImg v={s.img} className="p0-pan-bg" />}
      <div className="p0-pan-t">
        {s.tag && <span className="p0-eye">{s.tag}</span>}
        {s.title && <h2>{s.title}</h2>}
        {big && s.text && <p>{s.text}</p>}
        {big && s.cta && s.link ? <span className="p0-pan-cta"><CtaButton s={s} onClick={(e) => { e.stopPropagation(); open(s.link)(); }} /></span>
          : s.link && <span className="p0-go">{s.cta || 'Keşfet'}<Icon n="back" s={15} className="flip" /></span>}
      </div>
      {!cover && s.img && <span className={'p0-pan-art' + (isProdImg(s.img) ? ' prod' : '')}><ShopImg v={s.img} /></span>}
    </article>
  );
}
export function P0Hero({ slides, open }) {
  const list = slides.filter((x) => x.title || x.img);
  const side = list.length >= 3 ? [list[1], list[2]] : list.length === 2 ? [list[1]] : [];
  const rot = list.length >= 3 ? [list[0], ...list.slice(3)] : [list[0]];
  const [k, setK] = useState(0);
  useEffect(() => { if (rot.length < 2) return; const t = setInterval(() => setK((x) => (x + 1) % rot.length), 6500); return () => clearInterval(t); }, [rot.length]);
  if (!list.length) return null;
  return (
    <section className={'p0-hero n' + (side.length + 1)} aria-label="Kampanyalar">
      <div className="p0-big">
        {rot.map((s, i) => <Panel key={i} s={s} big open={open} on={i === k} />)}
        {rot.length > 1 && <span className="p0-dots">{rot.map((_, i) => <button key={i} type="button" className={i === k ? 'on' : ''} onClick={() => setK(i)} aria-label={'Reklam ' + (i + 1)} />)}</span>}
      </div>
      {side.map((s, i) => <Panel key={i} s={s} open={open} />)}
    </section>
  );
}

// ---- 2 · Hızlı bulucu: arama + telefon modeli (kalıp bulucu) + sık arananlar
const HOT = ['JCID', 'Face ID', 'Havya', 'Mikroskop', 'Programlayıcı', 'Ekran ayırıcı', 'Batarya'];
export function P0Finder({ S }) {
  const [q, setQ] = useState('');
  const catalog = useStore((s) => s.catalog);
  const chips = useMemo(() => {
    const own = (S.shopHome?.p0hot || []).filter(Boolean);
    if (own.length) return own;
    return HOT.filter((t) => { const n = norm(t); return catalog.some((p) => p._s?.includes(n)); }).slice(0, 5);
  }, [catalog, S.shopHome?.p0hot]);
  const find = (t) => { const v = (t ?? q).trim(); if (!v) return; store.set({ catalogGo: { q: v } }); go('katalog'); };
  return (
    <section className="p0-find rv" aria-label="Ürün bul">
      <form className="p0-find-row" onSubmit={(e) => { e.preventDefault(); find(); }}>
        <label className="p0-find-q"><Icon n="search" s={20} /><input value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="search" placeholder="Ürün, marka ya da stok kodu…" aria-label="Ürün ara" />{q && <button type="submit" className="p0-find-go" aria-label="Ara"><Icon n="back" s={16} className="flip" /></button>}</label>
        {S.kalip?.on !== false && <button type="button" className="p0-find-k" onClick={() => go('kalip')}><Icon n="grid" s={18} /><span><b>Telefon modeline göre bul</b><small>Kalıp bulucu</small></span><Icon n="back" s={15} className="flip" /></button>}
      </form>
      {chips.length > 0 && <div className="p0-hot"><small>Sık arananlar</small>{chips.map((t) => <button key={t} type="button" onClick={() => find(t)}>{t}</button>)}</div>}
    </section>
  );
}

// ---- 3 · Kategori karoları: ana kategoriler, her birinin resmi o kategorideki (öne çıkan / yeni / stoktaki) bir üründen
export function useCatTiles() {
  const tree = useTree(); const vis = useVisibleProducts(false);
  return useMemo(() => {
    const roots = tree.roots.filter((n) => !n.hidden);
    const rootOf = (id) => { const a = tree.ancestors(id); return a[a.length - 1]; };
    const cnt = new Map(), pic = new Map();
    for (const p of vis) {
      if (!sellable(p)) continue;
      const r = rootOf(p.c); if (r == null) continue;
      cnt.set(r, (cnt.get(r) || 0) + 1);
      const cur = pic.get(r); const score = (hasImg(p) ? 4 : 0) + (p.s > 0 ? 2 : 0) + (p.nw ? 1 : 0);
      if (!cur || score > cur.score) pic.set(r, { p, score });
    }
    return roots.map((n) => ({ id: n.id, name: n.name, n: cnt.get(n.id) || 0, p: pic.get(n.id)?.p })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  }, [tree, vis]);
}
const openCat = (id) => { store.set({ catalogGo: { cat: id } }); go('katalog'); };
export function CatTile({ c, i = 0 }) {
  return <button type="button" className="p0-cat" style={{ '--i': i }} onClick={() => openCat(c.id)}>
    <span className="p0-cat-im">{c.p && <Thumb p={c.p} size="md" />}</span>
    <span className="p0-cat-t"><b>{c.name}</b><small>{c.n} ürün</small></span>
  </button>;
}
export function P0Cats() {
  const tiles = useCatTiles();
  if (!tiles.length) return null;
  const show = tiles.slice(0, 7);
  return (
    <section className="p0-sec rv">
      <P0Head eye="Kategoriler" title="Ne arıyorsun?" more={['Tüm ürünler', () => { store.set({ catalogGo: { all: true } }); go('katalog'); }]} />
      <div className="p0-cats">{show.map((c, i) => <CatTile key={c.id} c={c} i={i} />)}
        <button type="button" className="p0-cat all" onClick={() => { store.set({ catalogGo: { all: true } }); go('katalog'); }}><span className="p0-cat-t"><b>Tüm kategoriler</b><small>{tiles.reduce((a, c) => a + c.n, 0)} ürün</small></span><Icon n="back" s={18} className="flip" /></button>
      </div>
    </section>
  );
}
function P0Head({ eye, title, more }) {
  return <header className="p0-head"><div>{eye && <span className="p0-eye">{eye}</span>}<h2>{title}</h2></div>{more && <button type="button" className="p0-more" onClick={more[1]}>{more[0]}<Icon n="back" s={14} className="flip" /></button>}</header>;
}

// ---- 5 · Tamircinin seçimi: bir büyük + dört küçük (öne çıkanlar → yeni gelenler → stoktakiler)
function usePrice() { const S = useStore((s) => s.settings); const user = useStore((s) => s.user); const up = useStore((s) => s.userPrices); return (p) => { const pr = priceFor(p, S, user, up); return pr.mine == null ? 'Fiyat sorun' : fmt(pr.mine, p.cur); }; }
function Add({ p }) { const q = useStore((s) => s.cart[p.id] || 0); return <button type="button" className={'p0-add' + (q ? ' in' : '')} onClick={(e) => { e.stopPropagation(); if (q) { go('sepet'); return; } setQty(p.id, 1); toast('Sepete eklendi'); }}>{q ? <><Icon n="check" s={15} />Sepette</> : <><Icon n="plus" s={15} />Sepete ekle</>}</button>; }
export function P0Pick({ S, onProduct }) {
  const byId = useStore((s) => s.byId); const vis = useVisibleProducts(false);
  const price = usePrice();
  const list = useMemo(() => {
    const out = []; const seen = new Set(); const add = (p) => { if (p && sellable(p) && !seen.has(p.id) && out.length < 5) { seen.add(p.id); out.push(p); } };
    feat(S).pins.forEach((id) => add(byId.get(Number(id))));
    vis.filter((p) => p.nw && p.s > 0 && hasImg(p)).forEach(add);
    vis.filter((p) => p.s > 0 && hasImg(p)).forEach(add);
    vis.forEach(add);
    return out;
  }, [S, byId, vis]);
  if (list.length < 3) return null;
  const [a, ...rest] = list;
  return (
    <section className="p0-sec rv">
      <P0Head eye="Tamircinin seçimi" title="Bu hafta masamızdan" />
      <div className="p0-bento">
        <div className="p0-b-big" role="button" tabIndex={0} onClick={() => onProduct(a)}>
          <span className="p0-eye">Haftanın ürünü</span>
          <span className="p0-b-im"><Thumb p={a} size="lg" /></span>
          <span className="p0-b-f"><span><small>{a.b}</small><b>{a.n}</b></span><span className="p0-b-p"><b className="num">{price(a)}</b><Add p={a} /></span></span>
        </div>
        {rest.map((p, i) => (
          <div key={p.id} className="p0-b-sm" style={{ '--i': i }} role="button" tabIndex={0} onClick={() => onProduct(p)}>
            <span className="p0-b-im"><Thumb p={p} size="md" /></span>
            <span className="p0-b-n"><small>{p.b}</small><b>{p.n}</b></span>
            <span className="p0-b-p"><b className="num">{price(p)}</b><Add p={p} /></span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- 6 · Atölyeni kur: setler tek bantta
export function P0Sets({ S }) {
  const byId = useStore((s) => s.byId);
  const sets = liveSets(S).slice(0, 3);
  if (!sets.length) return null;
  return (
    <section className="p0-sec p0-setband rv">
      <P0Head eye="Atölyeni kur" title="Birlikte al, daha az öde" more={['Tüm setler', () => go('setlist')]} />
      <div className="p0-sets">
        {sets.map((x) => { const v = setView(x, byId); return (
          <button key={x.id} type="button" className="p0-set" onClick={() => openSet(x.id)}>
            <SetCover v={v} bare />
            <span className="p0-set-t"><span className="p0-eye">Set · {v.active.length} ürün</span><b>{x.name}</b>
              <span className="p0-set-p"><b className="num">{fmt(v.price, v.cur)}</b>{v.save > 0 && <small>{fmt(v.save, v.cur)} kazanç</small>}</span></span>
          </button>); })}
      </div>
    </section>
  );
}

// ---- 7 · Akan marka bandı: gri logolar yavaşça akar; üstüne gelince durur ve renklenir
export function P0Brands() {
  const list = useBrandList().filter((b) => b.logo).slice(0, 18);
  if (list.length < 4) return null;
  const row = (dup) => list.map((b) => <button key={(dup ? 'd' : '') + b.n} type="button" className="p0-logo" onClick={() => openBrand(b.n)} tabIndex={dup ? -1 : 0} aria-hidden={dup || undefined} title={b.n}><ShopImg v={b.logo} className="logo" alt={b.n} /></button>);
  return (
    <section className="p0-brands rv" aria-label="Markalar">
      <div className="p0-brands-in" style={{ '--n': list.length }}>{row(false)}{row(true)}</div>
      <button type="button" className="p0-more p0-brands-all" onClick={() => go('markalar')}>Tüm markalar<Icon n="back" s={14} className="flip" /></button>
    </section>
  );
}

// ---- 8 · Güven şeridi: avantajlar (Ayarlar'daki avantaj şeridinin yazıları), sade
export function P0Trust({ H }) {
  const u = (H.usps || []).filter((x) => x.title);
  if (!u.length) return null;
  return <section className="p0-trust rv" aria-label="Avantajlar">{u.map((x, i) => <div key={i} className="p0-tr"><Icon n={x.icon || 'check'} s={22} /><span><b>{x.title}</b>{x.text && <small>{x.text}</small>}</span></div>)}</section>;
}

// ---- Ürünler açılış sayfası (look.prodHub): önce kategoriler + markalar, 'Tüm ürünler' hep sağ üstte
export function ProdHub({ onAll, total }) {
  const tiles = useCatTiles(); const brands = useBrandList();
  return (
    <div className="p0-hub">
      <header className="p0-hub-h"><div><span className="p0-eye">Ürünler</span><h1>Ne arıyorsun?</h1></div>
        <button type="button" className="p0-hub-all" onClick={onAll}>Tüm ürünler · {total}<Icon n="back" s={16} className="flip" /></button></header>
      <div className="p0-cats hub">{tiles.map((c, i) => <CatTile key={c.id} c={c} i={i} />)}</div>
      {brands.length > 0 && <>
        <h2 className="p0-hub-h2">Markalar</h2>
        <div className="p0-hub-brands">{brands.slice(0, 14).map((b) => <button key={b.n} type="button" onClick={() => openBrand(b.n)}>{b.logo ? <ShopImg v={b.logo} className="logo" alt={b.n} /> : <b>{b.n}</b>}</button>)}
          <button type="button" className="more" onClick={() => go('markalar')}>Tüm markalar<Icon n="back" s={14} className="flip" /></button></div>
      </>}
    </div>
  );
}
