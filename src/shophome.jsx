// Online mağaza ana sayfası (/magaza → Ana sayfa): büyük reklam alanı, avantajlar, marka kutuları,
// kare reklam kutuları (bento), ürün rafları ve alt WhatsApp bandı. İçerik: Ayarlar > Mağaza ana sayfası (settings.shopHome).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, setQty, go, api, toast } from './store.js';
import { Icon, Thumb, Stepper, Field, Toggle } from './ui.jsx';
import { fmt, norm, priceFor, resizeForWeb } from './utils.js';
import { waLink } from './route.js';
import { ProductSheet, useTree } from './catalog.jsx';

export const THEMES = { night: 'Gece mavisi', ember: 'Kor turuncu', volt: 'Elektrik yeşili', violet: 'Mor', carbon: 'Karbon siyah', ice: 'Buz beyazı' };

// ---- resim: 'si…' = mağaza resmi (Firestore), http/data = doğrudan
const imgCache = new Map();
export function useShopImg(v) {
  const direct = !v ? null : /^(https?:|data:)/.test(v) ? v : null;
  const [src, setSrc] = useState(direct || imgCache.get(v) || null);
  useEffect(() => {
    if (!v || direct) { setSrc(direct); return; }
    if (imgCache.has(v)) { setSrc(imgCache.get(v)); return; }
    let live = true;
    api()?.getShopImage?.(v).then((d) => { if (d) imgCache.set(v, d); if (live) setSrc(d); }).catch(() => {});
    return () => { live = false; };
  }, [v]);
  return src;
}
export function ShopImg({ v, className, alt = '' }) {
  const src = useShopImg(v);
  return src ? <img className={className} src={src} alt={alt} loading="lazy" decoding="async" /> : null;
}

// ---- link: marka / kategori / arama / ürün / dış adres
export function useOpenLink() {
  const catalog = useStore((s) => s.catalog);
  return (link, setProduct) => {
    if (!link) return;
    if (/^https?:/.test(link)) { window.open(link, '_blank', 'noopener'); return; }
    const [k, ...rest] = link.split(':'); const v = rest.join(':');
    if (k === 'p') { const p = store.s.byId.get(Number(v)); if (p) setProduct(p); return; }
    let browse = {};
    if (k === 'brand') { const real = catalog.find((p) => p.b && norm(p.b) === norm(v))?.b || v; browse = { brand: real }; }
    else if (k === 'cat') browse = { cat: Number(v) };
    else if (k === 'q') browse = { q: v };
    store.set({ catalogGo: browse }); go('katalog');
  };
}

// görünür olunca beliren bölümler
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    el.querySelectorAll('.rv').forEach((x) => io.observe(x));
    if (el.classList.contains('rv')) io.observe(el);
    return () => io.disconnect();
  });
  return ref;
}
// imleci takip eden ışık (kutuların üstünde)
const spot = (e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`); };

// =================================================================================================
export function ShopHome() {
  const { settings: S, catalog } = useStore();
  const H = S.shopHome || {};
  const [product, setProduct] = useState(null);
  const open = useOpenLink();
  const ref = useReveal();
  const link = (l) => () => open(l, setProduct);
  const counts = useMemo(() => { const m = new Map(); for (const p of catalog) if (p.b && p.a !== 0) m.set(norm(p.b), (m.get(norm(p.b)) || 0) + 1); return m; }, [catalog]);
  const brands = (H.brands || []).filter((b) => b.name || b.logo);
  const promos = (H.promos || []).filter((x) => x.title || x.img);
  const slides = (H.slides || []).filter((x) => x.title || x.img);
  return (
    <div className="sh" ref={ref}>
      {slides.length > 0 && <Hero slides={slides} open={link} />}

      {(H.usps || []).some((u) => u.title) && (
        <section className="sh-usps rv" aria-label="Avantajlar">
          {(H.usps || []).filter((u) => u.title).map((u, i) => (
            <div key={i} className="sh-usp" style={{ '--i': i }}><span className="sh-usp-ic"><Icon n={u.icon || 'check'} s={20} /></span><span><b>{u.title}</b>{u.text && <small>{u.text}</small>}</span></div>
          ))}
        </section>
      )}

      {brands.length > 0 && <>
        <Marquee words={brands.map((b) => b.name).filter(Boolean)} />
        <section className="sh-sec rv">
          <SecHead title={H.brandsTitle || 'Markalar'} sub="Dünyanın önde gelen tamir ekipmanı üreticileri" />
          <div className="sh-brands">
            {brands.map((b, i) => (
              <button key={i} className="sh-brand" style={{ '--c': b.color || '#111827', '--i': i, '--len': Math.max(4, (b.name || '').length) }} onClick={link(b.link || 'brand:' + b.name)} onMouseMove={spot}>
                <span className="sh-brand-glow" aria-hidden="true" />
                {b.logo ? <ShopImg v={b.logo} className="sh-brand-logo" alt={b.name} /> : <b className="sh-brand-word">{b.name}</b>}
                <span className="sh-brand-f"><span>{b.logo ? b.name : counts.get(norm(b.name)) > 0 ? counts.get(norm(b.name)) + ' ürün' : 'Ürünler'}</span></span>
                <span className="sh-brand-arrow"><Icon n="back" s={16} className="flip" /></span>
              </button>
            ))}
          </div>
        </section>
      </>}

      {promos.length > 0 && (
        <section className="sh-sec rv">
          <SecHead title={H.promosTitle || 'Öne çıkanlar'} />
          <div className="sh-bento">
            {promos.map((x, i) => (
              <button key={i} className={'sh-box sz-' + (x.size || 'sq') + (x.img ? ' has-img' : '')} style={{ '--c': x.color || '#0f172a', '--i': i }} onClick={link(x.link)} onMouseMove={spot}>
                {x.img && <ShopImg v={x.img} className="sh-box-img" />}
                <span className="sh-box-shade" aria-hidden="true" />
                <span className="sh-box-t">
                  {x.tag && <span className="sh-tag">{x.tag}</span>}
                  {x.title && <b>{x.title}</b>}
                  {x.text && <small>{x.text}</small>}
                </span>
                {x.link && <span className="sh-box-go"><Icon n="back" s={18} className="flip" /></span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {(H.sections || []).map((sec, i) => <Rail key={i} sec={sec} open={link} onProduct={setProduct} />)}

      {H.cta?.title && (
        <section className="sh-cta rv">
          <div><b>{H.cta.title}</b>{H.cta.text && <p>{H.cta.text}</p>}</div>
          <div className="sh-cta-btns">
            {S.shop.whatsapp && <a className="btn wa big-ish" href={waLink(S.shop.whatsapp, 'Merhaba, bir ürün soracaktım:')} target="_blank" rel="noopener"><Icon n="wa" s={18} />WhatsApp’tan yazın</a>}
            <button className="btn sh-cta-ghost" onClick={() => go('katalog')}><Icon n="grid" s={16} />Tüm ürünler</button>
          </div>
        </section>
      )}
      {product && <ProductSheet p={product} onClose={() => setProduct(null)} />}
    </div>
  );
}

function SecHead({ title, sub, more, rail }) {
  const [edge, setEdge] = useState([true, false]);
  useEffect(() => {
    const el = rail?.current; if (!el) return;
    const f = () => setEdge([el.scrollLeft < 4, el.scrollLeft + el.clientWidth > el.scrollWidth - 4]);
    f(); el.addEventListener('scroll', f, { passive: true }); addEventListener('resize', f);
    return () => { el.removeEventListener('scroll', f); removeEventListener('resize', f); };
  }, [rail]);
  const by = (d) => { const el = rail.current; el.scrollBy({ left: d * el.clientWidth * 0.9 }); };
  return (
    <div className="sh-head">
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      <div className="sh-head-r">
        {more && <button className="sh-more" onClick={more}>Tümünü gör <Icon n="back" s={15} className="flip" /></button>}
        {rail && !(edge[0] && edge[1]) && <span className="sh-arrows"><button className="sh-arrow" disabled={edge[0]} onClick={() => by(-1)} aria-label="Geri"><Icon n="back" s={17} /></button><button className="sh-arrow" disabled={edge[1]} onClick={() => by(1)} aria-label="İleri"><Icon n="back" s={17} className="flip" /></button></span>}
      </div>
    </div>
  );
}

function Marquee({ words }) {
  if (!words.length) return null;
  const row = [...words, ...words, ...words];
  return (
    <div className="sh-marquee" aria-hidden="true">
      <div className="sh-marquee-in">{[...row, ...row].map((w, i) => <span key={i}>{w}<i>✦</i></span>)}</div>
    </div>
  );
}

// ---- büyük reklam alanı (kaydırmalı) -----------------------------------------------------------
function Hero({ slides, open }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const track = useRef(null);
  const n = slides.length;
  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setTimeout(() => goTo((i + 1) % n), 6500);
    return () => clearTimeout(t);
  }, [i, paused, n]);
  function goTo(k) { const el = track.current; if (!el) return; el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); setI(k); }
  const onScroll = (e) => { const el = e.currentTarget; const k = Math.round(el.scrollLeft / el.clientWidth); if (k !== i) setI(k); };
  return (
    <section className="sh-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
      <div className="sh-hero-track" ref={track} onScroll={onScroll} onTouchStart={() => setPaused(true)}>
        {slides.map((s, k) => <Slide key={k} s={s} on={k === i} open={open} />)}
      </div>
      {n > 1 && <>
        <div className="sh-dots">{slides.map((_, k) => <button key={k} className={'sh-dot' + (k === i ? ' on' : '') + (paused ? ' paused' : '')} onClick={() => goTo(k)} aria-label={`${k + 1}. reklam`}><i /></button>)}</div>
        <button className="sh-hero-nav prev" onClick={() => goTo((i - 1 + n) % n)} aria-label="Önceki"><Icon n="back" s={20} /></button>
        <button className="sh-hero-nav next" onClick={() => goTo((i + 1) % n)} aria-label="Sonraki"><Icon n="back" s={20} className="flip" /></button>
      </>}
    </section>
  );
}
function Slide({ s, on, open }) {
  const cover = s.layout === 'cover' && s.img;
  return (
    <article className={'sh-slide th-' + (s.theme || 'night') + (cover ? ' cover' : '') + (on ? ' on' : '')} onClick={cover && s.link && !s.cta ? open(s.link) : undefined}>
      {cover ? <ShopImg v={s.img} className="sh-slide-bg" /> : <>
        <span className="sh-orb a" aria-hidden="true" /><span className="sh-orb b" aria-hidden="true" /><span className="sh-grid" aria-hidden="true" />
      </>}
      <div className="sh-slide-t">
        {s.tag && <span className="sh-tag glow">{s.tag}</span>}
        {s.title && <h1>{s.title}</h1>}
        {s.text && <p>{s.text}</p>}
        {s.cta && s.link && <button className="sh-cta-btn" onClick={(e) => { e.stopPropagation(); open(s.link)(); }}>{s.cta}<span><Icon n="back" s={18} className="flip" /></span></button>}
      </div>
      {!cover && s.img && <div className="sh-slide-art"><span className="sh-halo" aria-hidden="true" /><ShopImg v={s.img} className="sh-float" /></div>}
      {!cover && !s.img && <div className="sh-slide-art word" aria-hidden="true"><b>{(s.tag || s.title || '').split(' ')[0]}</b></div>}
    </article>
  );
}

// ---- ürün rafı -------------------------------------------------------------------------------------
function Rail({ sec, open, onProduct }) {
  const { catalog, byId } = useStore();
  const tree = useTree();
  const railRef = useRef(null);
  const limit = Number(sec.limit) || 10;
  const list = useMemo(() => {
    const act = (p) => p && p.a !== 0 && !p.so;
    if (sec.mode === 'manual') return (sec.ids || []).map((id) => byId.get(id)).filter(act);
    let r = catalog.filter(act);
    if (sec.mode === 'brand') r = r.filter((p) => p.b && norm(p.b) === norm(sec.brand || ''));
    if (sec.mode === 'cat') { const c = Number(sec.cat); r = r.filter((p) => tree.ancestors(p.c).includes(c) || (p.c2 != null && tree.ancestors(p.c2).includes(c))); }
    if (sec.mode === 'new') { const flagged = r.filter((p) => p.nw); r = (flagged.length >= limit ? flagged : r); }
    return [...r].sort((a, b) => b.id - a.id).slice(0, limit);
  }, [catalog, byId, sec, tree]);
  if (!list.length) return null;
  const more = sec.mode === 'brand' ? () => open('brand:' + sec.brand)() : sec.mode === 'cat' ? () => open('cat:' + sec.cat)() : () => go('katalog');
  return (
    <section className="sh-sec rv">
      <SecHead title={sec.title || 'Ürünler'} more={more} rail={railRef} />
      <div className="sh-rail" ref={railRef}>{list.map((p, i) => <PCard key={p.id} p={p} i={i} isNew={sec.mode === 'new' || p.nw} onOpen={() => onProduct(p)} />)}</div>
    </section>
  );
}
function PCard({ p, i, isNew, onOpen }) {
  const { settings: S, user, userPrices, cart } = useStore();
  const qty = cart[p.id] || 0;
  const pr = priceFor(p, S, user, userPrices);
  return (
    <div className="sh-card" style={{ '--i': i }} onMouseMove={spot}>
      <button className="sh-card-img" onClick={onOpen} aria-label={p.n}>
        <Thumb p={p} size="lg" />
        {isNew && <span className="sh-new">YENİ</span>}
      </button>
      <div className="sh-card-b">
        {p.b && <span className="sh-card-brand">{p.b}</span>}
        <button className="sh-card-n" onClick={onOpen}>{p.n}</button>
        <div className="sh-card-f">
          <b className="sh-card-p">{pr.mine == null ? 'Fiyat sorun' : fmt(pr.mine, p.cur)}</b>
          {qty > 0
            ? <Stepper small value={qty} onChange={(v) => setQty(p.id, v)} />
            : <button className="sh-add" onClick={() => { setQty(p.id, 1); toast('Sepete eklendi'); }} aria-label="Sepete ekle" title="Sepete ekle"><Icon n="cart" s={17} /><Icon n="plus" s={13} className="sh-add-plus" /></button>}
        </div>
      </div>
    </div>
  );
}

// =================================================================================================
// Yönetim paneli > Ayarlar > Mağaza ana sayfası

const ICONS = [['shield', 'Kalkan'], ['box', 'Kutu / kargo'], ['chat', 'Mesaj'], ['tag', 'Etiket'], ['check', 'Onay'], ['clock', 'Saat'], ['phone', 'Telefon'], ['store', 'Dükkan'], ['star', 'Yıldız']];
const SIZES = { sq: 'Kare (1×1)', wide: 'Geniş (2×1)', tall: 'Uzun (1×2)', big: 'Büyük kare (2×2)' };
const MODES = { new: 'Yeni gelenler (otomatik)', brand: 'Bir markanın ürünleri', cat: 'Bir kategorinin ürünleri', manual: 'Elle seçtiğim ürünler' };

function ImgPick({ v, onChange, alpha, max = 1600, label = 'Görsel', hint }) {
  const src = useShopImg(v);
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true);
    try { const d = await resizeForWeb(f, max, 0.82, alpha); const id = await api().saveShopImage(d); imgCache.set(id, d); onChange(id); }
    catch (x) { toast('Resim yüklenemedi: ' + x.message, 'bad'); }
    setBusy(false);
  }
  return (
    <div className="field">
      <span className="field-l">{label} <small className="opt">(isteğe bağlı)</small></span>
      <div className="she-img">
        <label className={'she-img-box' + (alpha ? ' alpha' : '')}>{busy ? <span className="spinner" /> : src ? <img src={src} alt="" /> : <span><Icon n="upload" s={18} />Resim seç</span>}<input type="file" accept="image/*" hidden onChange={pick} /></label>
        <div className="she-img-r">
          <input aria-label={label + ' linki'} placeholder="ya da resim linki yapıştırın (https://…)" value={/^https?:/.test(v || '') ? v : ''} onChange={(e) => onChange(e.target.value.trim())} />
          {v && <button type="button" className="btn sm ghost danger" onClick={() => onChange('')}>Görseli kaldır</button>}
          {hint && <span className="field-h">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

function ProductSearch({ onPick, placeholder = 'Ürün ara (ad ya da stok kodu)…' }) {
  const catalog = useStore((s) => s.catalog);
  const [q, setQ] = useState('');
  const res = useMemo(() => { const t = norm(q).split(/\s+/).filter(Boolean); if (!t.length) return []; return catalog.filter((p) => t.every((x) => p._s?.includes(x))).slice(0, 8); }, [q, catalog]);
  return (
    <div className="she-ps">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      {res.length > 0 && <ul className="she-ps-res">{res.map((p) => <li key={p.id}><button type="button" onClick={() => { onPick(p); setQ(''); }}><Thumb p={p} size="sm" /><span>{p.n}<small>{p.k}</small></span></button></li>)}</ul>}
    </div>
  );
}

function LinkPick({ v = '', onChange, label = 'Tıklanınca' }) {
  const catalog = useStore((s) => s.catalog);
  const byId = useStore((s) => s.byId);
  const tree = useTree();
  const brands = useMemo(() => [...new Set(catalog.map((p) => p.b).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [catalog]);
  const cats = useMemo(() => { const out = []; const walk = (ns, d) => ns.forEach((n) => { out.push([n.id, '— '.repeat(d) + n.name]); walk(n.children, d + 1); }); walk(tree.roots, 0); return out; }, [tree]);
  const type = !v ? '' : /^https?:/.test(v) ? 'url' : v.split(':')[0];
  const val = type === 'url' ? v : v.split(':').slice(1).join(':');
  const setT = (t) => onChange(t === '' ? '' : t === 'url' ? 'https://' : t + ':');
  return (
    <div className="field">
      <span className="field-l">{label}</span>
      <div className="she-link">
        <select value={type} onChange={(e) => setT(e.target.value)} aria-label="Link türü">
          <option value="">Hiçbir yere gitmesin</option><option value="brand">Marka ürünleri</option><option value="cat">Kategori</option><option value="q">Arama sonucu</option><option value="p">Bir ürün</option><option value="url">Web adresi</option>
        </select>
        {type === 'brand' && <select value={val} onChange={(e) => onChange('brand:' + e.target.value)}><option value="">Marka seçin</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>}
        {type === 'cat' && <select value={val} onChange={(e) => onChange('cat:' + e.target.value)}><option value="">Kategori seçin</option>{cats.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>}
        {type === 'q' && <input value={val} onChange={(e) => onChange('q:' + e.target.value)} placeholder="Aranacak kelime (ör. havya ucu)" />}
        {type === 'url' && <input value={val} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />}
        {type === 'p' && (byId.get(Number(val))
          ? <span className="she-chip"><Thumb p={byId.get(Number(val))} size="sm" />{byId.get(Number(val)).n}<button type="button" onClick={() => onChange('p:')} aria-label="Kaldır"><Icon n="x" s={14} /></button></span>
          : <ProductSearch onPick={(p) => onChange('p:' + p.id)} />)}
      </div>
    </div>
  );
}

function Rows({ list, set, title, add, render, max = 20, sub }) {
  const mv = (i, d) => { const n = [...list]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); set(n); };
  return (
    <div className="she-rows">
      {list.map((it, i) => (
        <div key={i} className="she-row">
          <div className="she-row-h">
            <b>{title(it, i)}</b>
            <span className="row-btns">
              <button type="button" className="icon-btn sm" disabled={i === 0} onClick={() => mv(i, -1)} aria-label="Yukarı" title="Yukarı taşı"><Icon n="back" s={15} className="rot90" /></button>
              <button type="button" className="icon-btn sm" disabled={i === list.length - 1} onClick={() => mv(i, 1)} aria-label="Aşağı" title="Aşağı taşı"><Icon n="back" s={15} className="rot-90" /></button>
              <button type="button" className="icon-btn sm" onClick={() => set(list.filter((_, j) => j !== i))} aria-label="Sil" title="Sil"><Icon n="trash" s={15} /></button>
            </span>
          </div>
          {render(it, (patch) => set(list.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}
        </div>
      ))}
      {list.length < max && <button type="button" className="btn sm outline she-add" onClick={add}><Icon n="plus" s={15} />{sub}</button>}
    </div>
  );
}

export function ShopHomeEditor({ d, set }) {
  const H = d.shopHome || {};
  const catalog = useStore((s) => s.catalog);
  const byId = useStore((s) => s.byId);
  const tree = useTree();
  const brands = useMemo(() => [...new Set(catalog.map((p) => p.b).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [catalog]);
  const cats = useMemo(() => { const out = []; const walk = (ns, dd) => ns.forEach((n) => { out.push([n.id, '— '.repeat(dd) + n.name]); walk(n.children, dd + 1); }); walk(tree.roots, 0); return out; }, [tree]);
  const S = (k, v) => set('shopHome.' + k, v);
  return <>
    <p className="fine">Online mağazaya girenlerin ilk gördüğü sayfa. Değişiklikleri yapıp <b>Kaydet</b>’e basın, sonra <a href="/magaza" target="_blank" rel="noopener">mağazayı yeni sekmede açıp</a> bakın. Resimler otomatik küçültülür.</p>
    <Toggle id="sh-on" label="Mağaza ana sayfası açık" hint="Kapalıysa mağaza doğrudan ürünler sayfasıyla açılır" checked={H.enabled !== false} onChange={(v) => S('enabled', v)} />

    <h3>1 · Büyük reklam alanı</h3>
    <p className="fine">Sırayla kayan büyük kartlar. “Ürün görselli”de arka planı saydam ürün resmi (PNG) çok iyi durur; “Tam resim”de hazır banner (ör. 1600×640) kullanın.</p>
    <Rows list={H.slides || []} set={(v) => S('slides', v)} max={6} sub="Reklam ekle" title={(s, i) => `${i + 1}. ${s.title || 'Reklam'}`}
      add={() => S('slides', [...(H.slides || []), { layout: 'split', theme: 'night', tag: '', title: '', text: '', cta: 'İncele', link: '', img: '' }])}
      render={(s, up) => <>
        <div className="row3">
          <Field label="Görünüm"><select value={s.layout || 'split'} onChange={(e) => up({ layout: e.target.value })}><option value="split">Yazı + ürün görseli</option><option value="cover">Tam resim (banner)</option></select></Field>
          <Field label="Renk teması"><select value={s.theme || 'night'} onChange={(e) => up({ theme: e.target.value })}>{Object.entries(THEMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Küçük etiket" opt><input value={s.tag || ''} onChange={(e) => up({ tag: e.target.value })} placeholder="ör. Yeni · Stokta" /></Field>
        </div>
        <Field label="Başlık"><input value={s.title || ''} onChange={(e) => up({ title: e.target.value })} placeholder="ör. Aixun T3A ile tanışın" /></Field>
        <Field label="Açıklama" opt><input value={s.text || ''} onChange={(e) => up({ text: e.target.value })} /></Field>
        <div className="row2">
          <Field label="Buton yazısı" opt><input value={s.cta || ''} onChange={(e) => up({ cta: e.target.value })} placeholder="ör. Hemen incele" /></Field>
          <LinkPick v={s.link} onChange={(link) => up({ link })} />
        </div>
        <ImgPick v={s.img} onChange={(img) => up({ img })} alpha={s.layout !== 'cover'} max={s.layout === 'cover' ? 1800 : 1000} hint={s.layout === 'cover' ? 'Yatay banner (ör. 1600×640)' : 'Saydam arka planlı ürün resmi en iyisi'} />
      </>} />

    <h3>2 · Avantaj şeridi</h3>
    <Rows list={H.usps || []} set={(v) => S('usps', v)} max={4} sub="Avantaj ekle" title={(u, i) => u.title || `${i + 1}. avantaj`}
      add={() => S('usps', [...(H.usps || []), { icon: 'check', title: '', text: '' }])}
      render={(u, up) => <div className="row3">
        <Field label="Simge"><select value={u.icon || 'check'} onChange={(e) => up({ icon: e.target.value })}>{ICONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Başlık"><input value={u.title || ''} onChange={(e) => up({ title: e.target.value })} /></Field>
        <Field label="Alt yazı" opt><input value={u.text || ''} onChange={(e) => up({ text: e.target.value })} /></Field>
      </div>} />

    <h3>3 · Marka kutuları</h3>
    <Field label="Bölüm başlığı"><input value={H.brandsTitle || ''} onChange={(e) => S('brandsTitle', e.target.value)} placeholder="Markalar" /></Field>
    <p className="fine">Kare kutular; adlar ayrıca kayan şeritte de döner. Logo yüklemezseniz marka adı büyük yazıyla görünür. Logo için saydam PNG (beyaz ya da açık renkli) en iyisi.</p>
    <Rows list={H.brands || []} set={(v) => S('brands', v)} max={24} sub="Marka ekle" title={(b, i) => b.name || `${i + 1}. marka`}
      add={() => S('brands', [...(H.brands || []), { name: '', color: '#1f2937', link: '' }])}
      render={(b, up) => <>
        <div className="row3">
          <Field label="Marka adı"><input list="sh-brands" value={b.name || ''} onChange={(e) => up({ name: e.target.value, link: !b.link || b.link === 'brand:' + b.name ? 'brand:' + e.target.value : b.link })} /></Field>
          <Field label="Kutu rengi"><span className="she-color"><input type="color" value={b.color || '#1f2937'} onChange={(e) => up({ color: e.target.value })} /><code>{b.color}</code></span></Field>
          <LinkPick v={b.link} onChange={(link) => up({ link })} />
        </div>
        <ImgPick v={b.logo} onChange={(logo) => up({ logo })} alpha max={500} label="Logo" />
      </>} />
    <datalist id="sh-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>

    <h3>4 · Kare reklam kutuları</h3>
    <Field label="Bölüm başlığı"><input value={H.promosTitle || ''} onChange={(e) => S('promosTitle', e.target.value)} placeholder="Öne çıkanlar" /></Field>
    <p className="fine">Dörtlü ızgara: kare, geniş, uzun ve büyük kare kutuları karıştırarak dergi gibi bir düzen kurun. Resimli kutularda yazı resmin üstünde durur.</p>
    <Rows list={H.promos || []} set={(v) => S('promos', v)} max={16} sub="Kutu ekle" title={(x, i) => x.title || `${i + 1}. kutu`}
      add={() => S('promos', [...(H.promos || []), { size: 'sq', color: '#0f172a', tag: '', title: '', text: '', link: '', img: '' }])}
      render={(x, up) => <>
        <div className="row3">
          <Field label="Boyut"><select value={x.size || 'sq'} onChange={(e) => up({ size: e.target.value })}>{Object.entries(SIZES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Renk"><span className="she-color"><input type="color" value={x.color || '#0f172a'} onChange={(e) => up({ color: e.target.value })} /><code>{x.color}</code></span></Field>
          <Field label="Küçük etiket" opt><input value={x.tag || ''} onChange={(e) => up({ tag: e.target.value })} placeholder="ör. %20 indirim" /></Field>
        </div>
        <div className="row2">
          <Field label="Başlık"><input value={x.title || ''} onChange={(e) => up({ title: e.target.value })} /></Field>
          <Field label="Alt yazı" opt><input value={x.text || ''} onChange={(e) => up({ text: e.target.value })} /></Field>
        </div>
        <LinkPick v={x.link} onChange={(link) => up({ link })} />
        <ImgPick v={x.img} onChange={(img) => up({ img })} max={x.size === 'big' || x.size === 'wide' ? 1400 : 900} hint="Kare kutuya kare, geniş kutuya yatay resim" />
      </>} />

    <h3>5 · Ürün rafları</h3>
    <Rows list={H.sections || []} set={(v) => S('sections', v)} max={8} sub="Raf ekle" title={(x, i) => x.title || `${i + 1}. raf`}
      add={() => S('sections', [...(H.sections || []), { title: '', mode: 'new', limit: 10 }])}
      render={(x, up) => <>
        <div className="row3">
          <Field label="Başlık"><input value={x.title || ''} onChange={(e) => up({ title: e.target.value })} placeholder="ör. Haftanın fırsatları" /></Field>
          <Field label="Hangi ürünler"><select value={x.mode || 'new'} onChange={(e) => up({ mode: e.target.value })}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="En fazla"><select value={x.limit || 10} onChange={(e) => up({ limit: Number(e.target.value) })}>{[4, 5, 6, 8, 10, 12, 16, 20].map((n) => <option key={n} value={n}>{n} ürün</option>)}</select></Field>
        </div>
        {x.mode === 'brand' && <Field label="Marka"><select value={x.brand || ''} onChange={(e) => up({ brand: e.target.value })}><option value="">Seçin</option>{brands.map((b) => <option key={b}>{b}</option>)}</select></Field>}
        {x.mode === 'cat' && <Field label="Kategori"><select value={x.cat ?? ''} onChange={(e) => up({ cat: e.target.value })}><option value="">Seçin</option>{cats.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></Field>}
        {x.mode === 'manual' && <div className="field">
          <span className="field-l">Ürünler ({(x.ids || []).length})</span>
          <div className="she-chips">{(x.ids || []).map((id) => byId.get(id) && <span key={id} className="she-chip"><Thumb p={byId.get(id)} size="sm" />{byId.get(id).n}<button type="button" onClick={() => up({ ids: x.ids.filter((y) => y !== id) })} aria-label="Kaldır"><Icon n="x" s={14} /></button></span>)}</div>
          <ProductSearch onPick={(p) => !(x.ids || []).includes(p.id) && up({ ids: [...(x.ids || []), p.id] })} placeholder="Rafa ürün ekle: ad ya da stok kodu yazın…" />
        </div>}
      </>} />

    <h3>6 · Alt bant</h3>
    <div className="row2">
      <Field label="Başlık" opt><input value={H.cta?.title || ''} onChange={(e) => S('cta', { ...(H.cta || {}), title: e.target.value })} placeholder="Boşsa bant görünmez" /></Field>
      <Field label="Yazı" opt><input value={H.cta?.text || ''} onChange={(e) => S('cta', { ...(H.cta || {}), text: e.target.value })} /></Field>
    </div>
  </>;
}
