// Online mağaza ana sayfası (/magaza → Ana sayfa): büyük reklam alanı, avantajlar, marka kutuları,
// kare reklam kutuları (bento), ürün rafları ve alt WhatsApp bandı. İçerik: Ayarlar > Mağaza ana sayfası (settings.shopHome).
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, setQty, go, api, toast } from './store.js';
import { Icon, Thumb, Stepper, Field, Toggle, Fold } from './ui.jsx';
import { fmt, norm, priceFor, resizeForWeb } from './utils.js';
import { waLink } from './route.js';
import { ProductSheet, useTree } from './catalog.jsx';

export const THEMES = { night: 'Gece mavisi', ember: 'Kor turuncu', volt: 'Elektrik yeşili', violet: 'Mor', carbon: 'Karbon siyah', ice: 'Buz beyazı' };

// ---- resim: 'si…' = mağaza resmi (Firestore), 'prod:<no>' = ürünün kendi resmi, http/data = doğrudan
const imgCache = new Map();
export const isProdImg = (v) => typeof v === 'string' && v.startsWith('prod:');
function prodImg(v) {
  const p = store.s.byId.get(Number(v.slice(5))); const S = store.s.settings;
  if (!p) return null; if (p.img && p.img !== 'fs') return p.img;
  return p.pi ? (S.catalog.imageLarge || S.catalog.imageThumb).replaceAll('{pi}', p.pi).replaceAll('{kod}', p.k).replaceAll('{id}', p.id) : null;
}
export function useShopImg(v) {
  const byId = useStore((s) => s.byId);
  const direct = !v ? null : /^(https?:|data:|\/)/.test(v) ? v : isProdImg(v) ? prodImg(v) : null;
  const [src, setSrc] = useState(direct || imgCache.get(v) || null);
  useEffect(() => {
    if (!v || direct || isProdImg(v)) { setSrc(direct); return; }
    if (imgCache.has(v)) { setSrc(imgCache.get(v)); return; }
    let live = true;
    api()?.getShopImage?.(v).then((d) => { if (d) imgCache.set(v, d); if (live) setSrc(d); }).catch(() => {});
    return () => { live = false; };
  }, [v, direct]);
  return isProdImg(v) || direct ? direct : src;
}
const inkCache = new Map();
function isInk(img) {
  const key = img.currentSrc || img.src; if (inkCache.has(key)) return inkCache.get(key);
  let ink = false;
  try {
    const w = 64, h = Math.max(1, Math.round((64 * img.naturalHeight) / img.naturalWidth)); const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data;
    let n = 0, dark = 0;
    for (let k = 0; k < d.length; k += 4) { if (d[k + 3] < 140) continue; n++; const l = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255; const sat = Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]); if ((l < 0.2 && sat < 130) || (l < 0.28 && sat < 70)) dark++; }
    ink = n > 0 && dark / n > 0.18;
  } catch {}
  inkCache.set(key, ink); return ink;
}
export function ShopImg({ v, className, alt = '' }) {
  const src = useShopImg(v);
  // kare logolar (ör. yuvarlak amblem) yatay logolardan daha büyük gösterilir
  const onLoad = (e) => {
    const i = e.currentTarget; if (i.naturalWidth && i.naturalWidth / i.naturalHeight < 1.7) i.classList.add('sq');
    // koyu yazılı logo mu? (gece modunda yalnız koyu kısımları açılır; renkler korunur)
    if (/logo/.test(className || '') && isInk(i)) i.classList.add('ink');
  };
  return src ? <img className={className} src={src} alt={alt} loading="lazy" decoding="async" onLoad={onLoad} /> : null;
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
    // yedek: bazı tarayıcılarda (arka plandaki sekme, uygulama içi tarayıcı) gözlemci geç kalabiliyor
    const check = () => el.querySelectorAll('.rv:not(.in)').forEach((x) => { if (x.getBoundingClientRect().top < innerHeight * 0.95) x.classList.add('in'); });
    const t = setTimeout(check, 600);
    addEventListener('scroll', check, { passive: true });
    return () => { io.disconnect(); clearTimeout(t); removeEventListener('scroll', check); };
  });
  return ref;
}
const isLight = (hex) => { const m = /^#?([\da-f]{6})$/i.exec(hex || ''); if (!m) return false; const n = parseInt(m[1], 16); const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62; };
// imleci takip eden ışık (kutuların üstünde)
const spot = (e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`); };

// =================================================================================================
// Tasarım modu: ShopHome bu bağlamla sarılınca bölümler seçilebilir / sürüklenebilir olur (designer.jsx)
export const DesignCtx = createContext(null);
export const rid = () => Math.random().toString(36).slice(2, 8);
export const FIXED = { hero: 'Büyük reklam alanı', usps: 'Avantaj şeridi', marquee: 'Kayan marka şeridi', brands: 'Marka kutuları', promos: 'Kare reklam kutuları', cta: 'Alt bant' };
const railKey = (r, i) => 'rail:' + (r.id || i);
// Bölüm sırası: kayıtlı sıra + sonradan eklenenler; silinmiş olanlara ait kayıtlar atılır
export function layoutOf(H) {
  const rails = H.sections || [];
  const valid = ['hero', 'usps', 'marquee', 'brands', 'promos', ...rails.map(railKey), ...Object.keys(H.blocks || {}).map((id) => 'b:' + id), 'cta'];
  const L = (Array.isArray(H.layout) ? H.layout : []).filter((k) => valid.includes(k));
  for (const k of valid) if (!L.includes(k)) { if (k !== 'cta' && L.includes('cta')) L.splice(L.indexOf('cta'), 0, k); else L.push(k); }
  return L;
}
export const blockLabel = (k, H) => FIXED[k] || (k.startsWith('rail:') ? 'Ürün rafı · ' + ((H.sections || []).find((r, i) => railKey(r, i) === k)?.title || '') : (H.blocks?.[k.slice(2)]?.t === 'banner' ? 'Görsel bant' : 'Başlık · ' + (H.blocks?.[k.slice(2)]?.title || '')));
// sürükleyerek sıralama: aynı gruptaki [data-dz][data-i] öğelerinin üstüne gelince yer değiştirir; hiç sürüklenmezse tıklama sayılır
export function dragSort(e, group, idx, onMove, onClick) {
  if (e.button > 0) return;
  const x0 = e.clientX, y0 = e.clientY; let cur = idx, moved = false;
  const mv = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 7) return;
    if (!moved) { moved = true; document.body.classList.add('dz-dragging'); }
    ev.preventDefault();
    const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(`[data-dz="${group}"]`);
    if (t) { const j = Number(t.dataset.i); if (j !== cur && !Number.isNaN(j)) { onMove(cur, j); cur = j; } }
    if (ev.clientY < 70) scrollBy(0, -18); else if (ev.clientY > innerHeight - 70) scrollBy(0, 18);
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); document.body.classList.remove('dz-dragging'); if (!moved) onClick?.(); };
  addEventListener('pointermove', mv, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
export const moveItem = (list, from, to) => { const n = [...list]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; };

export function ShopHome({ S: Sover }) {
  const E = useContext(DesignCtx);
  const store_ = useStore();
  const S = Sover || store_.settings; const catalog = store_.catalog;
  const H = S.shopHome || {};
  const [product, setProduct] = useState(null);
  const open = useOpenLink();
  const ref = useReveal();
  const link = (l) => () => (E ? null : open(l, setProduct));
  const counts = useMemo(() => { const m = new Map(); for (const p of catalog) if (p.b && p.a !== 0) m.set(norm(p.b), (m.get(norm(p.b)) || 0) + 1); return m; }, [catalog]);
  // logo, renk ve logo boyutu: kutuda ayrıca verilmediyse Ayarlar > Markalar'dan
  const BL = S.brandLogos || {};
  const blKey = (n) => (BL[n] ? n : Object.keys(BL).find((k) => norm(k) === norm(n || '')) || n);
  const bl = (n) => BL[blKey(n)] || {};
  const brands = (H.brands || []).map((b, idx) => ({ ...b, idx, logo: b.logo || bl(b.name).logo || '', color: bl(b.name).color || b.color, scale: bl(b.name).scale || 1 })).filter((b) => b.name || b.logo);
  const promos = (H.promos || []).map((x, idx) => ({ ...x, idx })).filter((x) => x.title || x.img || E);
  const slides = (H.slides || []).filter((x) => x.title || x.img || E);
  const hidden = new Set(H.hidden || []);
  const L = layoutOf(H);
  const sel = E?.sel;
  const pick = (kind, i) => (e) => { e?.stopPropagation?.(); E.select(kind, i); };
  const ls = Number(H.brandLogoScale) || 1;

  const render = (k) => {
    if (k === 'hero') return slides.length > 0 ? <Hero slides={slides} open={link} heroH={H.heroH} brands={[...brands, ...Object.entries(BL).map(([name, v]) => ({ name, ...v }))]} /> : E && <Empty label="Reklam yok" />;
    if (k === 'usps') return (H.usps || []).some((u) => u.title) ? (
      <section className="sh-usps rv" aria-label="Avantajlar">
        {(H.usps || []).filter((u) => u.title).map((u, i) => (
          <div key={i} className="sh-usp" style={{ '--i': i }}><span className="sh-usp-ic"><Icon n={u.icon || 'check'} s={20} /></span><span><b>{u.title}</b>{u.text && <small>{u.text}</small>}</span></div>
        ))}
      </section>
    ) : E && <Empty label="Avantaj yok" />;
    if (k === 'marquee') return brands.length > 0 && H.marquee !== 'off' ? <Marquee items={brands} style={H.marquee || 'color'} speed={H.mqSpeed} ls={ls} /> : E && <Empty label={H.marquee === 'off' ? 'Kayan şerit kapalı (ayarından açın)' : 'Marka yok'} />;
    if (k === 'brands') return (brands.length > 0 || E) && (
      <section className="sh-sec rv">
        <SecHead title={H.brandsTitle || 'Markalar'} sub={H.brandsSub ?? 'Dünyanın önde gelen tamir ekipmanı üreticileri'} onTitle={E && !E.mobile && ((t) => E.set('shopHome.brandsTitle', t))} />
        <div className={'sh-brands bs-' + (H.brandSize || 'md')}>
          {brands.map((b, i) => (
            <button key={(b.name || '') + b.idx} data-dz="brand" data-i={b.idx}
              className={'sh-brand' + (b.logo ? ' has-logo' : isLight(b.color) ? ' light' : '') + (sel?.kind === 'brand' && sel.i === b.idx ? ' dz-sel' : '')}
              style={{ '--c': b.color || '#111827', '--i': i, '--len': Math.max(4, (b.name || '').length), '--ls': b.scale * ls }}
              onClick={E ? (E.mobile ? (e) => { stop(e); E.select('brand', b.idx); } : stop) : link(b.link || 'brand:' + b.name)} onMouseMove={spot}
              onPointerDown={E && !E.mobile ? (e) => dragSort(e, 'brand', b.idx, (f, t) => E.set('shopHome.brands', moveItem(E.get('brands'), f, t)), () => E.select('brand', b.idx)) : undefined}>
              <span className="sh-brand-glow" aria-hidden="true" />
              {b.logo ? <ShopImg v={b.logo} className="sh-brand-logo" alt={b.name} /> : <b className="sh-brand-word">{b.name}</b>}
              <span className="sh-brand-f"><span>{counts.get(norm(b.name)) > 0 ? counts.get(norm(b.name)) + ' ürün' : b.name}</span></span>
              <span className="sh-brand-arrow"><Icon n="back" s={16} className="flip" /></span>
            </button>
          ))}
          {E && <button className="sh-brand dz-add" onClick={pick('brand', -1)}><Icon n="plus" s={26} /><small>Marka ekle</small></button>}
        </div>
      </section>
    );
    if (k === 'promos') return (promos.length > 0 || E) && (
      <section className="sh-sec rv">
        <SecHead title={H.promosTitle || 'Öne çıkanlar'} onTitle={E && !E.mobile && ((t) => E.set('shopHome.promosTitle', t))} />
        <div className="sh-bento">
          {promos.map((x, i) => (
            <button key={x.idx} data-dz="promo" data-i={x.idx} className={'sh-box sz-' + (x.size || 'sq') + (x.img ? (isProdImg(x.img) ? ' prod' : ' has-img') : '') + (!x.title && !x.text && !x.tag ? ' notext' : '') + (sel?.kind === 'promo' && sel.i === x.idx ? ' dz-sel' : '')} style={{ '--c': x.color || '#0f172a', '--i': i }}
              onClick={E ? (E.mobile ? (e) => { stop(e); E.select('promo', x.idx); } : stop) : link(x.link)} onMouseMove={spot}
              onPointerDown={E && !E.mobile ? (e) => dragSort(e, 'promo', x.idx, (f, t) => E.set('shopHome.promos', moveItem(E.get('promos'), f, t)), () => E.select('promo', x.idx)) : undefined}>
              {x.img && (isProdImg(x.img) ? <span className="sh-box-prod"><ShopImg v={x.img} /></span> : <ShopImg v={x.img} className="sh-box-img" />)}
              <span className="sh-box-shade" aria-hidden="true" />
              <span className="sh-box-t">
                {x.tag && <span className="sh-tag">{x.tag}</span>}
                {x.title && <b>{x.title}</b>}
                {x.text && <small>{x.text}</small>}
              </span>
              {x.link && <span className="sh-box-go"><Icon n="back" s={18} className="flip" /></span>}
            </button>
          ))}
          {E && <button className="sh-box sz-sq dz-add" onClick={pick('promo', -1)}><Icon n="plus" s={26} /><small>Kutu ekle</small></button>}
        </div>
      </section>
    );
    if (k.startsWith('rail:')) { const i = (H.sections || []).findIndex((r, j) => railKey(r, j) === k); const sec = H.sections[i]; return <Rail sec={sec} open={link} onProduct={E ? () => E.select(k) : setProduct} onTitle={E && !E.mobile && ((t) => E.set('shopHome.sections', H.sections.map((r, j) => (j === i ? { ...r, title: t } : r))))} edit={!!E} />; }
    if (k.startsWith('b:')) { const b = H.blocks[k.slice(2)]; return b.t === 'banner' ? <BannerBlock b={b} open={link} edit={!!E} /> : <HeadBlock b={b} onTitle={E && !E.mobile && ((t) => E.set('shopHome.blocks', { ...H.blocks, [k.slice(2)]: { ...b, title: t } }))} />; }
    if (k === 'cta') return H.cta?.title ? (
      <section className="sh-cta rv">
        <div><b>{H.cta.title}</b>{H.cta.text && <p>{H.cta.text}</p>}</div>
        <div className="sh-cta-btns">
          {S.shop.whatsapp && <a className="btn wa big-ish" href={E ? undefined : waLink(S.shop.whatsapp, 'Merhaba, bir ürün soracaktım:')} target="_blank" rel="noopener"><Icon n="wa" s={18} />WhatsApp’tan yazın</a>}
          <button className="btn sh-cta-ghost" onClick={E ? undefined : () => go('katalog')}><Icon n="grid" s={16} />Tüm ürünler</button>
        </div>
      </section>
    ) : E && <Empty label="Alt bant boş (başlık yazın)" />;
    return null;
  };

  return (
    <div className={'sh' + (E ? ' dz' : '')} ref={ref} style={H.gap ? { gap: H.gap + 'px' } : undefined}>
      {L.map((k, i) => {
        if (!E) return hidden.has(k) ? null : <Frag key={k}>{render(k)}</Frag>;
        return <E.Block key={k} k={k} i={i} L={L} hidden={hidden.has(k)}>{render(k)}</E.Block>;
      })}
      {product && <ProductSheet p={product} onClose={() => setProduct(null)} />}
    </div>
  );
}
const Frag = ({ children }) => children || null;
const stop = (e) => e.stopPropagation();
const Empty = ({ label }) => <div className="dz-empty">{label}</div>;

// ---- üst menüde küçük arama: yazdıkça ilk 6 ürün; ürüne basınca ürün penceresi, Enter → ürünler sayfası aramayla
export function HeaderSearch() {
  const { catalog, settings: S, user, userPrices } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [mob, setMob] = useState(false); // telefonda simgeye basınca açılan kutu
  const [hi, setHi] = useState(0);
  const [prod, setProd] = useState(null);
  const inp = useRef(null);
  const wrap = useRef(null);
  useEffect(() => {
    if (!mob) return;
    const f = (e) => { if (!wrap.current?.contains(e.target) && !inp.current?.value) close(); };
    document.addEventListener('pointerdown', f, true); return () => document.removeEventListener('pointerdown', f, true);
  }, [mob]);
  const res = useMemo(() => {
    const t = norm(q).split(/\s+/).filter(Boolean); if (!t.length) return { list: [], n: 0 };
    const all = catalog.filter((p) => p.a !== 0 && !p.so && t.every((x) => p._s?.includes(x)));
    return { list: all.slice(0, 6), n: all.length };
  }, [q, catalog]);
  const close = () => { setOpen(false); setMob(false); };
  const hideList = () => setOpen(false); // sadece sonuç listesi kapanır; kutu ve yazı yerinde kalır
  const goAll = () => { if (!q.trim()) return; store.set({ catalogGo: { q: q.trim() } }); go('katalog'); hideList(); inp.current?.blur(); };
  const pick = (p) => { setQ(''); close(); inp.current?.blur(); setProd(p); }; // ürüne bakınca arama temizlenir
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, res.list.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hi < res.list.length && res.list[hi]) pick(res.list[hi]); else goAll(); }
    else if (e.key === 'Escape') { if (q) hideList(); else close(); inp.current?.blur(); }
  };
  return (
    <div ref={wrap} className={'hsearch' + (mob ? ' mob-open' : '')}>
      <button type="button" className="icon-btn hsearch-btn" onClick={() => { setMob(true); setTimeout(() => inp.current?.focus(), 30); }} aria-label="Ürün ara"><Icon n="search" s={19} /></button>
      <div className="hsearch-box">
        <Icon n="search" s={17} />
        <input ref={inp} type="search" value={q} placeholder="Ürün ara…" aria-label="Ürün ara"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => { setOpen(false); if (!q) setMob(false); }, 180)} onKeyDown={key} />
        {(q || mob) && <button type="button" className="hsearch-x" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (q) setQ(''); else close(); }} aria-label="Temizle"><Icon n="x" s={14} /></button>}
        {open && q.trim() && (
          <div className="hsearch-res" role="listbox">
            {res.list.length === 0 ? <p className="hsearch-none">“{q}” ile eşleşen ürün yok.</p> : res.list.map((p, i) => {
              const pr = priceFor(p, S, user, userPrices);
              return (
                <button type="button" key={p.id} role="option" aria-selected={i === hi} className={'hsearch-it' + (i === hi ? ' on' : '')} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                  <Thumb p={p} size="sm" />
                  <span className="hsearch-n"><b>{p.n}</b><small>{[p.b, p.k].filter(Boolean).join(' · ')}</small></span>
                  <b className="hsearch-p num">{pr.mine == null ? 'Fiyat sorun' : fmt(pr.mine, p.cur)}</b>
                </button>
              );
            })}
            {res.n > 0 && <button type="button" className={'hsearch-all' + (hi === res.list.length ? ' on' : '')} onMouseDown={(e) => e.preventDefault()} onClick={goAll}>Tüm sonuçlar ({res.n}) <Icon n="back" s={14} className="flip" /></button>}
          </div>
        )}
      </div>
      {prod && <ProductSheet p={prod} onClose={() => setProd(null)} />}
    </div>
  );
}

// yeni bölüm türleri: başlık ve tek görsel bant
function HeadBlock({ b, onTitle }) {
  return (
    <section className={'sh-headblk rv al-' + (b.align || 'left') + ' hs-' + (b.size || 'md')}>
      {b.tag && <span className="sh-tag">{b.tag}</span>}
      <h2 {...editable(onTitle)}>{b.title || (onTitle ? 'Başlık yazın' : '')}</h2>
      {b.sub && <p>{b.sub}</p>}
    </section>
  );
}
function BannerBlock({ b, open, edit }) {
  if (!b.img) return edit ? <Empty label="Görsel bant: resim seçin" /> : null;
  return (
    <section className="sh-banner rv" style={{ '--bh': (Number(b.h) || 0) > 0 ? b.h + 'px' : undefined }}>
      <button className="sh-banner-in" onClick={b.link ? open(b.link) : undefined} disabled={!b.link && !edit}>
        <ShopImg v={b.img} className="sh-banner-img" alt={b.alt || ''} />
      </button>
    </section>
  );
}
// tasarım modunda başlıklar yerinde yazılır
function editable(onTitle) {
  if (!onTitle) return {};
  return { contentEditable: true, suppressContentEditableWarning: true, spellCheck: false, className: 'dz-text', onPointerDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(),
    onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } },
    onBlur: (e) => { const t = e.currentTarget.textContent.trim(); if (t) onTitle(t); } };
}

function SecHead({ title, sub, more, rail, onTitle }) {
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
      <div><h2 {...editable(onTitle)}>{title}</h2>{sub && <p>{sub}</p>}</div>
      <div className="sh-head-r">
        {more && <button className="sh-more" onClick={more}>Tümünü gör <Icon n="back" s={15} className="flip" /></button>}
        {rail && !(edge[0] && edge[1]) && <span className="sh-arrows"><button className="sh-arrow" disabled={edge[0]} onClick={() => by(-1)} aria-label="Geri"><Icon n="back" s={17} /></button><button className="sh-arrow" disabled={edge[1]} onClick={() => by(1)} aria-label="İleri"><Icon n="back" s={17} className="flip" /></button></span>}
      </div>
    </div>
  );
}

// kayan marka şeridi: dev bir kayan katman yerine kendi içinde kayan kutu (iPhone'da kaybolma / titreme olmasın).
// Telefonda parmakla da kaydırılabilir; bırakınca kendiliğinden devam eder. Ekranda değilken durur.
function Marquee({ items, style, speed, ls = 1 }) {
  const ref = useRef(null);
  const phone = matchMedia('(max-width: 700px)').matches; // masaüstünde eskisi gibi CSS ile kayar
  const row = phone && items.length >= 8 ? items : [...items, ...items, ...items];
  useEffect(() => {
    const el = ref.current; if (!el || !phone || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0, last = performance.now(), pos = el.scrollLeft, held = false, visible = true, t = 0;
    const dur = Number(speed) || 46;
    const tick = (now) => {
      const dt = Math.min(64, now - last); last = now;
      if (!held && visible) { const half = el.scrollWidth / 2; if (half > 0) { pos += (half / dur) * dt / 1000; if (pos >= half) pos -= half; el.scrollLeft = pos; } }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const hold = () => { held = true; clearTimeout(t); };
    const release = () => { clearTimeout(t); t = setTimeout(() => { const half = el.scrollWidth / 2; pos = el.scrollLeft % half; held = false; last = performance.now(); }, 1500); };
    el.addEventListener('touchstart', hold, { passive: true }); el.addEventListener('touchend', release, { passive: true });
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }) : null; io?.observe(el);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); io?.disconnect(); el.removeEventListener('touchstart', hold); el.removeEventListener('touchend', release); };
  }, [items.length, speed, phone]);
  if (!items.length) return null;
  return (
    <div ref={ref} className={'sh-mq mq-' + style} aria-hidden="true" style={{ '--mq-dur': (Number(speed) || 46) + 's' }}>
      <div className="sh-mq-in">{[...row, ...row].map((b, i) => (
        <span key={i} className="sh-mq-it" style={{ '--c': b.color || '#64748b', '--ls': (b.scale || 1) * ls }}>
          {b.logo ? <ShopImg v={b.logo} className="sh-mq-logo" alt={b.name} /> : <b>{b.name}</b>}
        </span>
      ))}</div>
    </div>
  );
}

// ---- büyük reklam alanı (kaydırmalı) -----------------------------------------------------------
function Hero({ slides, open, brands, heroH }) {
  const E = useContext(DesignCtx);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeT = useRef(0);
  const track = useRef(null);
  const n = slides.length;
  // otomatik geçiş: fare üstüne gelince durur, çekilince KALDIĞI YERDEN devam eder (süre sıfırlanmaz)
  const left = useRef(6500); const since = useRef(0);
  useEffect(() => { left.current = 6500; }, [i]);
  useEffect(() => {
    if (n < 2 || paused || E) return;
    since.current = Date.now();
    const t = setTimeout(() => goTo((i + 1) % n), Math.max(300, left.current));
    return () => { clearTimeout(t); left.current -= Date.now() - since.current; };
  }, [i, paused, n]);
  function goTo(k) { const el = track.current; if (!el) return; el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); setI(k); }
  const onScroll = (e) => { const el = e.currentTarget; const k = Math.round(el.scrollLeft / el.clientWidth); if (k !== i) setI(k); };
  return (
    <section className="sh-hero" style={heroH ? { '--hero-h': heroH + 'px' } : undefined} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
      <div className="sh-hero-track" ref={track} onScroll={onScroll} onTouchStart={() => { clearTimeout(resumeT.current); setPaused(true); }} onTouchEnd={() => { clearTimeout(resumeT.current); resumeT.current = setTimeout(() => setPaused(false), 4000); }}>
        {slides.map((s, k) => <Slide key={k} k={k} s={s} on={k === i} open={open} logo={slideLogo(s, brands)} />)}
      </div>
      {E && <E.HeroTools i={i} goTo={goTo} n={n} />}
      {n > 1 && <>
        <div className="sh-dots">{slides.map((_, k) => <button key={k} className={'sh-dot' + (k === i ? ' on' : '') + (paused ? ' paused' : '')} onClick={() => goTo(k)} aria-label={`${k + 1}. reklam`}><i /></button>)}</div>
        <button className="sh-hero-nav prev" onClick={() => goTo((i - 1 + n) % n)} aria-label="Önceki"><Icon n="back" s={20} /></button>
        <button className="sh-hero-nav next" onClick={() => goTo((i + 1) % n)} aria-label="Sonraki"><Icon n="back" s={20} className="flip" /></button>
      </>}
    </section>
  );
}
// reklam bir markaya gidiyorsa (ya da etiketinde marka adı varsa) o markanın logosu reklamda görünür
function slideLogo(s, brands) {
  if (s.logo === 'none') return null;
  if (s.logo) return s.logo;
  const name = (s.link || '').startsWith('brand:') ? s.link.slice(6) : s.tag;
  return brands.find((b) => b.logo && norm(b.name) === norm(name || ''))?.logo || null;
}
// reklamın içindeki öğeler (logo, başlık, yazı, buton, görsel) tasarım modunda tutulup taşınır, döndürülür, 3B eğilir
export const FX_NAMES = { logo: 'Logo / etiket', title: 'Başlık', text: 'Açıklama', cta: 'Buton', art: 'Görsel' };
// konum telefonda orantılı küçülür (--fxk)
export const fxTransform = (f) => f ? `translate(calc(${f.x || 0}px * var(--fxk, 1)), calc(${f.y || 0}px * var(--fxk, 1))) perspective(900px) rotateX(${f.rx || 0}deg) rotateY(${f.ry || 0}deg) rotate(${f.r || 0}deg) scale(${f.s || 1})` : undefined;
function Slide({ s, on, open, logo, k }) {
  const E = useContext(DesignCtx);
  const cover = s.layout === 'cover' && s.img;
  const fx = (el, cls = '') => {
    const f = s.fx?.[el]; const style = f ? { transform: fxTransform(f), transformOrigin: 'center' } : undefined;
    if (!E || E.mobile) return { className: cls || undefined, style };
    const selOn = E.sel?.kind === 'fx' && E.sel.slide === k && E.sel.el === el;
    return { className: (cls ? cls + ' ' : '') + 'dz-fx' + (selOn ? ' on' : ''), style, 'data-fx-name': FX_NAMES[el], onClick: (e) => e.stopPropagation(), onPointerDown: (e) => E.fxDrag(e, k, el) };
  };
  return (
    <article className={'sh-slide th-' + (s.theme || 'night') + (cover ? ' cover' : '') + (on ? ' on' : '')} onClick={cover && s.link && !s.cta ? open(s.link) : undefined}>
      {cover ? <ShopImg v={s.img} className="sh-slide-bg" /> : <>
        <span className="sh-orb a" aria-hidden="true" /><span className="sh-orb b" aria-hidden="true" /><span className="sh-grid" aria-hidden="true" />
      </>}
      <div className="sh-slide-t">
        {logo ? <span {...fx('logo', 'sh-slide-logo')}><ShopImg v={logo} alt={s.tag || ''} /></span> : s.tag && <span {...fx('logo', 'sh-tag glow')}>{s.tag}</span>}
        {s.title && <h1 {...fx('title')}>{s.title}</h1>}
        {s.text && <p {...fx('text')}>{s.text}</p>}
        {s.cta && s.link && <span {...fx('cta', 'sh-cta-wrap')}><button className="sh-cta-btn" onClick={(e) => { e.stopPropagation(); open(s.link)(); }}>{s.cta}<span><Icon n="back" s={18} className="flip" /></span></button></span>}
      </div>
      {!cover && s.img && <div {...fx('art', 'sh-slide-art')}><span className="sh-halo" aria-hidden="true" />{isProdImg(s.img) ? <div className="sh-pcard"><ShopImg v={s.img} /></div> : <ShopImg v={s.img} className="sh-float" />}</div>}
      {!cover && !s.img && <div className="sh-slide-art word" aria-hidden="true"><b>{(s.tag || s.title || '').split(' ')[0]}</b></div>}
    </article>
  );
}

// ---- ürün rafı -------------------------------------------------------------------------------------
function Rail({ sec, open, onProduct, onTitle, edit }) {
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
  if (!list.length) return edit ? <Empty label={'Ürün rafı “' + (sec.title || '') + '”: ürün bulunamadı'} /> : null;
  const more = sec.mode === 'brand' ? () => open('brand:' + sec.brand)() : sec.mode === 'cat' ? () => open('cat:' + sec.cat)() : () => go('katalog');
  return (
    <section className="sh-sec rv">
      <SecHead title={sec.title || 'Ürünler'} more={edit ? undefined : more} rail={railRef} onTitle={onTitle} />
      <div className="sh-rail" ref={railRef}>{list.map((p, i) => <PCard key={p.id} p={p} i={i} isNew={sec.mode === 'new' || p.nw} onOpen={() => onProduct(p)} />)}</div>
    </section>
  );
}
function PCard({ p, i, isNew, onOpen }) {
  const { settings: S, user, userPrices, cart } = useStore();
  const E = useContext(DesignCtx);
  const qty = cart[p.id] || 0;
  const pr = E ? priceFor(p, S, { role: 'public' }, null) : priceFor(p, S, user, userPrices); // tasarımda müşterinin gördüğü fiyat
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
            : <button className="sh-add" onClick={() => { if (E) return; setQty(p.id, 1); toast('Sepete eklendi'); }} aria-label="Sepete ekle" title="Sepete ekle"><Icon n="cart" s={17} /><Icon n="plus" s={13} className="sh-add-plus" /></button>}
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

export function ImgPick({ v, onChange, alpha, max = 1600, label = 'Görsel', hint, prodOk }) {
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
          {isProdImg(v) ? <span className="she-chip">Ürün resmi: {store.s.byId.get(Number(v.slice(5)))?.n || 'ürün'}</span>
            : <input aria-label={label + ' linki'} placeholder="ya da resim linki yapıştırın (https://…)" value={/^(https?:|\/)/.test(v || '') ? v : ''} onChange={(e) => onChange(e.target.value.trim())} />}
          {!alpha || prodOk ? <ProductSearch onPick={(p) => onChange('prod:' + p.id)} placeholder="ya da bir ürünün kendi resmini kullanın: ürün arayın…" /> : null}
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

// Liste düzenleyici: her satır başlığına basınca açılır (varsayılan kapalı), ok ya da sürükle ile sıralanır
export function Rows({ list, set, title, add, render, max = 20, sub, openIdx = -1, group }) {
  const [open, setOpen] = useState(openIdx);
  useEffect(() => { if (openIdx >= 0) setOpen(openIdx); }, [openIdx]);
  const g = useMemo(() => group || 'rows-' + rid(), [group]);
  const lref = useRef(list); lref.current = list; // sürüklerken hep en güncel liste
  const mv = (i, d) => { set(moveItem(list, i, i + d)); setOpen(open === i ? i + d : open === i + d ? i : open); };
  return (
    <div className="she-rows">
      {list.map((it, i) => (
        <div key={i} className={'she-row' + (open === i ? ' open' : '')} data-dz={g} data-i={i}>
          <div className="she-row-h">
            <span className="she-grip" title="Sürükleyip sıralayın" onPointerDown={(e) => dragSort(e, g, i, (f, t) => { const n = moveItem(lref.current, f, t); lref.current = n; set(n); })}><Icon n="drag" s={16} /></span>
            <button type="button" className="she-row-t" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><b>{title(it, i)}</b><Icon n="chev" s={16} className="fold-chev" /></button>
            <span className="row-btns">
              <button type="button" className="icon-btn sm" disabled={i === 0} onClick={() => mv(i, -1)} aria-label="Yukarı" title="Yukarı taşı"><Icon n="back" s={15} className="rot90" /></button>
              <button type="button" className="icon-btn sm" disabled={i === list.length - 1} onClick={() => mv(i, 1)} aria-label="Aşağı" title="Aşağı taşı"><Icon n="back" s={15} className="rot-90" /></button>
              <button type="button" className="icon-btn sm" onClick={() => { set(list.filter((_, j) => j !== i)); setOpen(-1); }} aria-label="Sil" title="Sil"><Icon n="trash" s={15} /></button>
            </span>
          </div>
          {open === i && <div className="she-row-b">{render(it, (patch) => set(list.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}</div>}
        </div>
      ))}
      {list.length < max && <button type="button" className="btn sm outline she-add" onClick={() => { add(); setOpen(list.length); }}><Icon n="plus" s={15} />{sub}</button>}
    </div>
  );
}

// ---- tek tek öğe alanları (Ayarlar ve Tasarım modu aynı alanları kullanır) -------------------------
export const NEW = {
  slide: () => ({ layout: 'split', theme: 'night', tag: '', title: 'Yeni reklam', text: '', cta: 'İncele', link: '', img: '' }),
  usp: () => ({ icon: 'check', title: 'Yeni avantaj', text: '' }),
  promo: () => ({ size: 'sq', color: '#0f172a', tag: '', title: 'Yeni kutu', text: '', link: '', img: '' }),
  rail: () => ({ id: rid(), title: 'Yeni raf', mode: 'new', limit: 10 }),
  brand: (name = '') => ({ name, color: '#1f2937', link: name ? 'brand:' + name : '' }),
};
export function SlideFields({ s, up }) {
  return <>
    <div className="row3">
      <Field label="Görünüm"><select value={s.layout || 'split'} onChange={(e) => up({ layout: e.target.value })}><option value="split">Yazı + ürün görseli</option><option value="cover">Tam resim (banner)</option></select></Field>
      <Field label="Renk teması"><select value={s.theme || 'night'} onChange={(e) => up({ theme: e.target.value })}>{Object.entries(THEMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Küçük etiket" opt><input value={s.tag || ''} onChange={(e) => up({ tag: e.target.value })} placeholder="ör. Yeni · Stokta" /></Field>
    </div>
    <Field label="Başlık"><input value={s.title || ''} onChange={(e) => up({ title: e.target.value })} placeholder="ör. Aixun T3A ile tanışın" /></Field>
    <Field label="Açıklama" opt><input value={s.text || ''} onChange={(e) => up({ text: e.target.value })} /></Field>
    <Field label="Marka logosu" hint="Otomatik: reklam bir markaya gidiyorsa ya da etiket marka adıysa o markanın logosu görünür"><select value={s.logo === 'none' ? 'none' : ''} onChange={(e) => up({ logo: e.target.value === 'none' ? 'none' : '' })}><option value="">Otomatik</option><option value="none">Logo gösterme</option></select></Field>
    <div className="row2">
      <Field label="Buton yazısı" opt><input value={s.cta || ''} onChange={(e) => up({ cta: e.target.value })} placeholder="ör. Hemen incele" /></Field>
      <LinkPick v={s.link} onChange={(link) => up({ link })} />
    </div>
    <ImgPick v={s.img} onChange={(img) => up({ img })} alpha={s.layout !== 'cover'} max={s.layout === 'cover' ? 1800 : 1000} hint={s.layout === 'cover' ? 'Yatay banner (ör. 1600×640)' : 'Saydam arka planlı ürün resmi en iyisi; ürünün kendi resmi beyaz kart içinde görünür'} prodOk />
  </>;
}
export function UspFields({ u, up }) {
  return <div className="row3">
    <Field label="Simge"><select value={u.icon || 'check'} onChange={(e) => up({ icon: e.target.value })}>{ICONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
    <Field label="Başlık"><input value={u.title || ''} onChange={(e) => up({ title: e.target.value })} /></Field>
    <Field label="Alt yazı" opt><input value={u.text || ''} onChange={(e) => up({ text: e.target.value })} /></Field>
  </div>;
}
export function PromoFields({ x, up }) {
  return <>
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
    <ImgPick v={x.img} onChange={(img) => up({ img })} max={x.size === 'big' || x.size === 'wide' ? 1400 : 900} hint="Kare kutuya kare, geniş kutuya yatay resim. Yazısı olan hazır banner için başlığı boş bırakın." prodOk />
  </>;
}
export function RailFields({ x, up }) {
  const catalog = useStore((s) => s.catalog);
  const byId = useStore((s) => s.byId);
  const tree = useTree();
  const brands = useMemo(() => [...new Set(catalog.map((p) => p.b).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [catalog]);
  const cats = useMemo(() => { const out = []; const walk = (ns, dd) => ns.forEach((n) => { out.push([n.id, '— '.repeat(dd) + n.name]); walk(n.children, dd + 1); }); walk(tree.roots, 0); return out; }, [tree]);
  return <>
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
  </>;
}
// Marka kutusu: logo, renk ve logo boyutu Markalar kaydına yazılır (her yerde aynı görünsün)
export function BrandFields({ b, up, d, set }) {
  const catalog = useStore((s) => s.catalog);
  const brands = useMemo(() => [...new Set(catalog.map((p) => p.b).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [catalog]);
  const BL = d.brandLogos || {};
  const key = BL[b.name] ? b.name : Object.keys(BL).find((k) => norm(k) === norm(b.name || '')) || b.name;
  const e = BL[key] || {};
  const upBL = (patch) => key && set('brandLogos', { ...BL, [key]: { ...e, ...patch } });
  return <>
    <div className="row2">
      <Field label="Marka adı"><input list="sh-brands" value={b.name || ''} onChange={(ev) => up({ name: ev.target.value, link: !b.link || b.link === 'brand:' + b.name ? 'brand:' + ev.target.value : b.link })} /></Field>
      <LinkPick v={b.link} onChange={(link) => up({ link })} />
    </div>
    <datalist id="sh-brands">{brands.map((x) => <option key={x} value={x} />)}</datalist>
    {key && <>
      <div className="row2">
        <Field label="Marka rengi" hint="Üstüne gelince ışık ve logo yoksa yazı rengi"><span className="she-color"><input type="color" value={e.color || b.color || '#1f2937'} onChange={(ev) => upBL({ color: ev.target.value })} /><code>{e.color || b.color}</code></span></Field>
        <ScaleField v={e.scale || 1} onChange={(scale) => upBL({ scale })} label="Logo boyutu" />
      </div>
      <ImgPick v={b.logo || e.logo || ''} onChange={(logo) => { upBL({ logo }); if (b.logo) up({ logo: '' }); }} alpha max={600} label="Logo" hint="Markalar ayarına kaydedilir; kayan şeritte ve reklamlarda da bu logo kullanılır" />
    </>}
  </>;
}
export function ScaleField({ v, onChange, label = 'Boyut', min = 0.4, max = 1.6 }) {
  return <Field label={label}><span className="she-scale"><input type="range" min={min} max={max} step="0.05" value={v} onChange={(e) => onChange(Number(e.target.value))} /><code>%{Math.round(v * 100)}</code>{v !== 1 && <button type="button" className="linkish" onClick={() => onChange(1)}>sıfırla</button>}</span></Field>;
}
export function BlockFields({ b, up }) {
  if (b.t === 'banner') return <>
    <ImgPick v={b.img} onChange={(img) => up({ img })} max={1800} label="Görsel" hint="Tam genişlik yatay görsel (ör. 1600×400)" />
    <LinkPick v={b.link} onChange={(link) => up({ link })} />
    <Field label="Yükseklik" hint="0 = görselin kendi oranı"><span className="she-scale"><input type="range" min="0" max="600" step="10" value={Number(b.h) || 0} onChange={(e) => up({ h: Number(e.target.value) })} /><code>{Number(b.h) ? b.h + ' px' : 'otomatik'}</code></span></Field>
  </>;
  return <>
    <Field label="Başlık"><input value={b.title || ''} onChange={(e) => up({ title: e.target.value })} /></Field>
    <Field label="Alt yazı" opt><input value={b.sub || ''} onChange={(e) => up({ sub: e.target.value })} /></Field>
    <div className="row3">
      <Field label="Küçük etiket" opt><input value={b.tag || ''} onChange={(e) => up({ tag: e.target.value })} /></Field>
      <Field label="Hizalama"><select value={b.align || 'left'} onChange={(e) => up({ align: e.target.value })}><option value="left">Sola</option><option value="center">Ortaya</option></select></Field>
      <Field label="Büyüklük"><select value={b.size || 'md'} onChange={(e) => up({ size: e.target.value })}><option value="sm">Küçük</option><option value="md">Orta</option><option value="lg">Büyük</option></select></Field>
    </div>
  </>;
}
export function FxFields({ f = {}, up, reset }) {
  const R = (label, key, min, max, step, unit, def = 0) => (
    <Field label={label}><span className="she-scale"><input type="range" min={min} max={max} step={step} value={f[key] ?? def} onChange={(e) => up({ [key]: Number(e.target.value) })} /><code>{key === 's' ? '%' + Math.round((f.s ?? 1) * 100) : (f[key] ?? def) + unit}</code></span></Field>
  );
  return <>
    <p className="fine">Öğeyi reklamın üstünde tutup sürükleyerek yerini değiştirin. Aşağıdan boyut, döndürme ve 3B eğim verin.</p>
    {R('Boyut', 's', 0.3, 2.5, 0.05, '', 1)}
    {R('Döndür', 'r', -45, 45, 1, '°')}
    {R('3B eğim: sağa-sola', 'ry', -60, 60, 1, '°')}
    {R('3B eğim: öne-arkaya', 'rx', -60, 60, 1, '°')}
    <div className="row2">
      {R('Yatay konum', 'x', -600, 600, 1, ' px')}
      {R('Dikey konum', 'y', -400, 400, 1, ' px')}
    </div>
    <button type="button" className="btn sm ghost" onClick={reset}><Icon n="refresh" s={15} />Bu öğeyi sıfırla</button>
  </>;
}
export const MQ_STYLES = { color: 'Açık zemin, renkli logolar', dark: 'Koyu zemin, logolar beyaz kartlarda', mono: 'Sade gri, üstüne gelince renkli', off: 'Gösterme' };

export function ShopHomeEditor({ d, set }) {
  const H = d.shopHome || {};
  const S = (k, v) => set('shopHome.' + k, v);
  return <>
    <div className="dz-cta">
      <span><b>Tasarım modu</b><small>Mağaza sayfasının üstünde sürükle-bırak ile düzenleyin: sıralama, boyut, yeni başlık ve bölümler.</small></span>
      <button type="button" className="btn primary sm" onClick={() => go('tasarim')}><Icon n="brush" s={16} />Tasarım modunu aç</button>
    </div>
    <Toggle id="sh-on" label="Mağaza ana sayfası açık" hint="Kapalıysa mağaza doğrudan ürünler sayfasıyla açılır" checked={H.enabled !== false} onChange={(v) => S('enabled', v)} />

    <Fold title="Büyük reklam alanı" hint="Sırayla kayan büyük kartlar" badge={(H.slides || []).length}>
      <p className="fine">“Ürün görselli”de arka planı saydam ürün resmi (PNG) çok iyi durur; “Tam resim”de hazır banner (ör. 1600×640) kullanın.</p>
      <Field label="Yükseklik" hint="0 = otomatik"><span className="she-scale"><input type="range" min="0" max="720" step="10" value={Number(H.heroH) || 0} onChange={(e) => S('heroH', Number(e.target.value) < 260 ? 0 : Number(e.target.value))} /><code>{Number(H.heroH) ? H.heroH + ' px' : 'otomatik'}</code></span></Field>
      <Rows list={H.slides || []} set={(v) => S('slides', v)} max={8} sub="Reklam ekle" title={(s, i) => `${i + 1}. ${s.title || 'Reklam'}`} add={() => S('slides', [...(H.slides || []), NEW.slide()])} render={(s, up) => <SlideFields s={s} up={up} />} />
    </Fold>

    <Fold title="Avantaj şeridi" hint="Orijinal ürün, hızlı kargo…" badge={(H.usps || []).length}>
      <Rows list={H.usps || []} set={(v) => S('usps', v)} max={4} sub="Avantaj ekle" title={(u, i) => u.title || `${i + 1}. avantaj`} add={() => S('usps', [...(H.usps || []), NEW.usp()])} render={(u, up) => <UspFields u={u} up={up} />} />
    </Fold>

    <Fold title="Marka kutuları ve kayan şerit" hint="Logolar Markalar ayarından gelir" badge={(H.brands || []).length}>
      <div className="row3">
        <Field label="Bölüm başlığı"><input value={H.brandsTitle || ''} onChange={(e) => S('brandsTitle', e.target.value)} placeholder="Markalar" /></Field>
        <Field label="Kutu büyüklüğü"><select value={H.brandSize || 'md'} onChange={(e) => S('brandSize', e.target.value)}><option value="sm">Küçük (satırda 8)</option><option value="md">Orta (satırda 5)</option><option value="lg">Büyük (satırda 4)</option></select></Field>
        <Field label="Kayan şerit"><select value={H.marquee || 'color'} onChange={(e) => S('marquee', e.target.value)}>{Object.entries(MQ_STYLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
      <ScaleField v={Number(H.brandLogoScale) || 1} onChange={(v) => S('brandLogoScale', v)} label="Tüm logoların boyutu" />
      <Rows list={H.brands || []} set={(v) => S('brands', v)} max={30} sub="Marka ekle" title={(b, i) => b.name || `${i + 1}. marka`} add={() => S('brands', [...(H.brands || []), NEW.brand()])} render={(b, up) => <BrandFields b={b} up={up} d={d} set={set} />} />
    </Fold>

    <Fold title="Kare reklam kutuları" hint="Dergi gibi karışık boyutlu kutular" badge={(H.promos || []).length}>
      <Field label="Bölüm başlığı"><input value={H.promosTitle || ''} onChange={(e) => S('promosTitle', e.target.value)} placeholder="Öne çıkanlar" /></Field>
      <Rows list={H.promos || []} set={(v) => S('promos', v)} max={16} sub="Kutu ekle" title={(x, i) => x.title || `${i + 1}. kutu`} add={() => S('promos', [...(H.promos || []), NEW.promo()])} render={(x, up) => <PromoFields x={x} up={up} />} />
    </Fold>

    <Fold title="Ürün rafları" hint="Yeni gelenler, marka, kategori ya da elle seçilen ürünler" badge={(H.sections || []).length}>
      <Rows list={H.sections || []} set={(v) => S('sections', v)} max={10} sub="Raf ekle" title={(x, i) => x.title || `${i + 1}. raf`} add={() => S('sections', [...(H.sections || []), NEW.rail()])} render={(x, up) => <RailFields x={x} up={up} />} />
    </Fold>

    <Fold title="Alt bant" hint="WhatsApp ve Tüm ürünler düğmeli kapanış bandı">
      <div className="row2">
        <Field label="Başlık" opt><input value={H.cta?.title || ''} onChange={(e) => S('cta', { ...(H.cta || {}), title: e.target.value })} placeholder="Boşsa bant görünmez" /></Field>
        <Field label="Yazı" opt><input value={H.cta?.text || ''} onChange={(e) => S('cta', { ...(H.cta || {}), text: e.target.value })} /></Field>
      </div>
    </Fold>
  </>;
}

// Ayarlar > Markalar: katalogdaki her markaya logo, renk ve logo boyutu (satıra basınca açılır)
export function BrandLogosEditor({ d, set }) {
  const catalog = useStore((s) => s.catalog);
  const BL = d.brandLogos || {};
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const keyOf = (n) => (BL[n] ? n : Object.keys(BL).find((k) => norm(k) === norm(n)) || n);
  const list = useMemo(() => {
    const m = new Map(); for (const p of catalog) if (p.b) { const k = keyOf(p.b); m.set(k, (m.get(k) || 0) + 1); }
    for (const k of Object.keys(BL)) if (!m.has(k)) m.set(k, 0);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [catalog, d.brandLogos]);
  const up = (name, patch) => set('brandLogos', { ...BL, [name]: { ...(BL[name] || {}), ...patch } });
  const t = norm(q);
  const missing = list.filter(([n]) => !BL[n]?.logo).length;
  return <>
    <p className="fine">Ana sayfadaki marka kutuları, kayan şerit ve o markaya giden reklamlar buradaki logoyu, rengi ve boyutu kullanır. Bir markaya basınca ayarları açılır. Logo için <b>saydam arka planlı PNG</b> en iyisi. {missing > 0 && <>Logosu olmayan <b>{missing}</b> marka var.</>}</p>
    <div className="search"><Icon n="search" s={18} /><input type="search" placeholder="Marka ara…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="bl-list">
      {list.filter(([n]) => !t || norm(n).includes(t)).map(([n, c]) => (
        <div key={n} className={'bl-row' + (BL[n]?.logo ? '' : ' no-logo') + (open === n ? ' open' : '')}>
          <button type="button" className="bl-h" onClick={() => setOpen(open === n ? null : n)} aria-expanded={open === n}>
            <span className="bl-thumb" style={{ '--c': BL[n]?.color || '#64748b' }}>{BL[n]?.logo ? <ShopImg v={BL[n].logo} alt="" /> : <b>{n.slice(0, 2)}</b>}</span>
            <span className="bl-n"><b>{n}</b><small className="muted">{c} ürün{BL[n]?.logo ? '' : ' · logo yok'}</small></span>
            <i className="bl-dot" style={{ background: BL[n]?.color || '#cbd5e1' }} />
            <Icon n="chev" s={16} className="fold-chev" />
          </button>
          {open === n && <div className="bl-b">
            <div className="row2">
              <Field label="Marka rengi"><span className="she-color"><input type="color" aria-label={n + ' rengi'} value={BL[n]?.color || '#64748b'} onChange={(e) => up(n, { color: e.target.value })} /><code>{BL[n]?.color || '—'}</code></span></Field>
              <ScaleField v={BL[n]?.scale || 1} onChange={(scale) => up(n, { scale })} label="Logo boyutu" />
            </div>
            <ImgPick v={BL[n]?.logo || ''} onChange={(logo) => up(n, { logo })} alpha max={600} label="Logo" />
          </div>}
        </div>
      ))}
    </div>
  </>;
}
