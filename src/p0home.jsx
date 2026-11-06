// Paket 0 (6.11.2026): sıfırdan yeni mağaza ana sayfası bölümleri. Eski bölümlere dokunmaz; Paket 0 seçilince
// shopHome.layout'a bu bölümler girer, eskiler gizlenir (silinmez). Bölüm anahtarları 'p0:' ile başlar ve
// layoutOf() bunları KENDİLİĞİNDEN eklemez (eski düzen ve Paket 1/2 birebir aynı kalır).
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, go, setQty, toast } from './store.js';
import { Icon, Thumb, Stepper, Field, Toggle } from './ui.jsx';
import { fmt, norm, priceFor } from './utils.js';
import { BG_BY } from './presets.js';
import { feat } from './extras.jsx';
import { liveSets, setView, openSet, SetCover } from './sets.jsx';
import { useBrandList, openBrand } from './brandsets.jsx';
import { ShopImg, CtaButton, isProdImg, PCard, DesignCtx, CardAdd } from './shophome.jsx';
import { loadPhones, mergePhones, searchPhones, short, useStencils, matchStencils } from './kalipfind.jsx';
import { useTree, useVisibleProducts } from './catalog.jsx';

export { P0_KEYS } from './p0keys.js';
const LIGHT_TH = ['ice', 'sand', 'mint'];
const hasImg = (p) => !!(p && (p.pi || p.im || (Array.isArray(p.im) && p.im.length)));
const sellable = (p) => p && p.a !== 0 && !p.so;

// ---- 1 · Üçlü vitrin: büyük kutu (sırayla dönen reklamlar) + yanda iki küçük kampanya
function Panel({ s, big, open, on = true }) {
  const bgp = BG_BY[s.bg];
  const lt = bgp ? bgp.ink === 'l' : LIGHT_TH.includes(s.theme);
  const cover = s.img && !isProdImg(s.img) && ['cover', 'glass'].includes(s.layout);
  return (
    <article className={'p0-pan th-' + (s.theme || 'night') + (big ? ' big' : '') + (lt ? ' lt' : '') + (bgp ? ' bgp' : '') + (cover ? ' cover' : '') + (on ? ' on' : '')} style={bgp ? { '--bgp': bgp.bg } : undefined}
      // 6.11.2026: düğmesi olan büyük reklamda sadece düğme tıklanır (her yer tıklanınca düğme boşa çıkıyordu); düğmesiz küçük kutunun tamamı link
      onClick={s.link && !(big && s.cta) ? open(s.link) : undefined} role={s.link && !(big && s.cta) ? 'link' : undefined}>
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
// Her reklamın vitrindeki yeri (Tasarım › Üçlü vitrin'de seçilir, slides[i].p0): 'big' büyük kutu (birden çoksa sırayla döner),
// 'top' sağ üst, 'bot' sağ alt, 'off' gösterme. Seçilmemişse: 1. reklam büyük, 2. sağ üst, 3. sağ alt, 4. ve sonrası büyük.
export const P0_ROLES = [['big', 'Büyük kutu'], ['top', 'Sağ üst'], ['bot', 'Sağ alt'], ['off', 'Gösterme']];
export const p0Role = (s, i) => (s && ['big', 'top', 'bot', 'off'].includes(s.p0) ? s.p0 : i === 1 ? 'top' : i === 2 ? 'bot' : 'big');
export function P0Hero({ slides: all, open, edit }) {
  const items = (all || []).map((s, i) => ({ s, i, r: p0Role(s, i) })).filter((x) => edit || x.s.title || x.s.img);
  const rotI = items.filter((x) => x.r === 'big'); const rot = rotI.map((x) => x.s);
  const side = ['top', 'bot'].map((r) => items.find((x) => x.r === r)?.s).filter(Boolean);
  const [k, setK] = useState(0);
  const E = useContext(DesignCtx);
  // tasarım modunda dönmez; düzenlenen reklam büyük kutudaysa o görünür
  useEffect(() => { if (!E?.heroI) return; const t = setInterval(() => { const j = rotI.findIndex((x) => x.i === E.heroI.current); if (j >= 0) setK((c) => (c === j ? c : j)); }, 300); return () => clearInterval(t); }, [E, rotI.map((x) => x.i).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (k >= rot.length) setK(0); if (E || rot.length < 2) return; const t = setInterval(() => setK((x) => (x + 1) % rot.length), 6500); return () => clearInterval(t); }, [rot.length, k, E]);
  if (!rot.length && !side.length) return null;
  const big = rot.length ? rot : [side.shift()];
  return (
    <section className={'p0-hero n' + (side.length + 1)} aria-label="Kampanyalar">
      <div className="p0-big">
        {big.map((s, i) => <Panel key={i} s={s} big open={open} on={i === (k % big.length)} />)}
        {big.length > 1 && <span className="p0-dots">{big.map((_, i) => <button key={i} type="button" className={i === k ? 'on' : ''} onClick={() => setK(i)} aria-label={'Reklam ' + (i + 1)} />)}</span>}
      </div>
      {side.map((s, i) => <Panel key={i} s={s} open={open} />)}
    </section>
  );
}
// Tasarım modu: vitrin yerleşimi — hangi reklam nerede (küçük şema + her reklam için yer seçimi)
export function P0HeroPanel({ H, S: set, onPick }) {
  const sl = H.slides || [];
  const rows = sl.map((s, i) => ({ s, i, r: p0Role(s, i) }));
  const name = (x) => x.s.title || x.s.tag || (x.i + 1) + '. reklam';
  const setR = (i, r) => set('slides', sl.map((x, j) => (j === i ? { ...x, p0: r } : x)));
  const inR = (r) => rows.filter((x) => x.r === r);
  return <div className="p0-hp">
    <div className="p0-hp-map" aria-hidden="true">
      <div className="p0-hp-z big"><small>Büyük kutu{inR('big').length > 1 ? ' · sırayla döner' : ''}</small>{inR('big').map((x) => <b key={x.i}>{x.i + 1}. {name(x)}</b>)}{!inR('big').length && <em>boş</em>}</div>
      <div className="p0-hp-z"><small>Sağ üst</small>{inR('top').slice(0, 1).map((x) => <b key={x.i}>{x.i + 1}. {name(x)}</b>)}{!inR('top').length && <em>boş</em>}</div>
      <div className="p0-hp-z"><small>Sağ alt</small>{inR('bot').slice(0, 1).map((x) => <b key={x.i}>{x.i + 1}. {name(x)}</b>)}{!inR('bot').length && <em>boş</em>}</div>
    </div>
    <p className="fine">Her reklamın yerini seçin. Büyük kutuya birden çok reklam koyarsanız sırayla döner; sağdaki iki kutu sabittir (her birine bir reklam).</p>
    {rows.map((x) => <div key={x.i} className="p0-hp-row">
      <button type="button" className="p0-hp-n" onClick={() => onPick?.(x.i)} title="Bu reklamı düzenle"><b>{x.i + 1}</b><span>{name(x)}</span><Icon n="edit" s={14} /></button>
      <span className="seg sw">{P0_ROLES.map(([r, l]) => <button key={r} type="button" className={x.r === r ? 'on' : ''} onClick={() => setR(x.i, r)}>{l}</button>)}</span>
    </div>)}
  </div>;
}

// ---- 2 · Hızlı bulucu (6.11.2026 (2)): telefon modelini yaz → o modele uyan kalıplar ve parçalar hemen burada çıkar;
// altında en çok ürünü olan kategori ve markalara hızlı geçiş. Ürün araması üst menüde (burada ikinci arama kutusu yok).
function useNameHits(sel) {
  const vis = useVisibleProducts(false);
  return useMemo(() => {
    if (!sel?.n) return [];
    const w = norm(sel.n).split(/\s+/).filter(Boolean); const tail = w.slice(1).join(' '); // "apple iphone 15 pro" → "iphone 15 pro"
    const keys = [w.join(' '), tail].filter((x) => x.length >= 5);
    // ad tam tutmalı (iphone 15 ≠ iphone 15 pro): ardından harf/rakam gelmesin
    const rx = keys.map((k) => new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])'));
    return vis.filter((p) => sellable(p) && rx.some((r) => r.test(norm(p.n)))).sort((a, b) => (b.s > 0) - (a.s > 0)).slice(0, 12);
  }, [sel, vis]);
}
function PhoneResults({ sel, onProduct, onClear }) {
  const stencils = useStencils();
  const st = useMemo(() => matchStencils(stencils, sel), [stencils, sel]);
  const parts = useNameHits(sel);
  const kal = [...st.single, ...st.sets].map((x) => x.p);
  const ids = new Set(kal.map((p) => p.id));
  const list = [...kal, ...parts.filter((p) => !ids.has(p.id))].slice(0, 12);
  const toKalip = () => { try { history.replaceState(history.state, '', '/magaza/kalip?m=' + encodeURIComponent(sel.n)); } catch {} go('kalip'); };
  return (
    <div className="p0-pr" key={sel.n}>
      <div className="p0-pr-h">
        <span className="p0-pr-ic"><Icon n="mobile" s={20} /></span>
        <span className="p0-pr-t"><b>{sel.n}</b><small>{short(sel.c) || sel.c}{kal.length ? ' · ' + kal.length + ' uygun kalıp' : ''}{parts.length ? ' · ' + parts.length + ' parça' : ''}</small></span>
        <button type="button" className="p0-more" onClick={toKalip}>Kalıp bulucuda aç<Icon n="back" s={14} className="flip" /></button>
        <button type="button" className="icon-btn sm" onClick={onClear} aria-label="Kapat"><Icon n="x" s={16} /></button>
      </div>
      {list.length ? <div className="p0-pr-rail">{list.map((p, i) => <PCard key={p.id} p={p} i={i} isNew={p.nw} onOpen={() => onProduct(p)} />)}</div>
        : <p className="p0-pr-none">Bu modele özel ürün şu an katalogda yok. {store.s.settings.shop?.whatsapp ? 'WhatsApp’tan sorun, hemen bakalım.' : ''}</p>}
    </div>
  );
}
export function P0Finder({ S, onProduct }) {
  const C = p0of(S.shopHome).find || {};
  const [base, setBase] = useState(null);
  const phones = useMemo(() => base && mergePhones(base, S.kalip?.phones), [base, S.kalip?.phones]);
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [hi, setHi] = useState(0); const [sel, setSel] = useState(null);
  const inp = useRef(null);
  const load = () => { if (!base) loadPhones().then(setBase).catch(() => {}); };
  const sugg = useMemo(() => (phones && open && q.trim().length >= 2 ? searchPhones(phones, q, 7) : []), [phones, q, open]);
  const pick = (ph) => { setSel(ph); setQ(ph.n); setOpen(false); inp.current?.blur(); };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, sugg.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (sugg[hi]) pick(sugg[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  };
  const tiles = useCatTiles(); const brands = useBrandList();
  const quick = C.quick === false ? [] : [...tiles.slice(0, C.qc ?? 4).map((c) => ({ k: 'c' + c.id, t: c.name, go: () => openCat(c.id) })), ...brands.slice(0, C.qb ?? 4).map((b) => ({ k: 'b' + b.n, t: b.n, logo: b.logo, go: () => openBrand(b.n) }))];
  const ex = (C.ex ?? 'iPhone 13, Galaxy A52, Redmi Note 10 Pro').split(',').map((x) => x.trim()).filter(Boolean);
  return (
    <section className={'p0-find rv' + (sel ? ' has-sel' : '')} aria-label="Telefon modeline göre bul">
      <div className="p0-find-top">
        <div className="p0-find-l">{(C.eye ?? 'Hızlı bulucu') && <span className="p0-eye">{C.eye ?? 'Hızlı bulucu'}</span>}<b>{C.title || 'Telefon modelini yaz, uyan kalıp ve parçaları gösterelim'}</b></div>
        <div className={'p0-find-q' + (sugg.length ? ' open' : '')}>
          <Icon n="mobile" s={20} />
          <input ref={inp} value={q} type="search" enterKeyHint="search" autoComplete="off" placeholder={C.ph || 'Örn. iPhone 15 Pro, Galaxy A52…'} aria-label="Telefon modeli"
            onFocus={() => { load(); setOpen(true); }} onChange={(e) => { load(); setQ(e.target.value); setOpen(true); setHi(0); if (sel) setSel(null); }} onBlur={() => setTimeout(() => setOpen(false), 160)} onKeyDown={key} />
          {q && <button type="button" className="p0-find-x" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(''); setSel(null); inp.current?.focus(); }} aria-label="Temizle"><Icon n="x" s={14} /></button>}
          {sugg.length > 0 && <div className="p0-sugg" role="listbox">{sugg.map((p, i) => (
            <button type="button" key={p.n} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
              <Icon n="mobile" s={16} /><span><b>{p.n}</b><small>{short(p.c) || p.c}</small></span></button>))}</div>}
        </div>
      </div>
      {!sel && (ex.length > 0 || quick.length > 0) && <div className="p0-hot">
        {!q && ex.length > 0 && <><small>Örnek</small>{ex.map((x) => <button key={x} type="button" className="ex" onMouseDown={(e) => e.preventDefault()} onClick={() => { load(); setQ(x); setOpen(true); setHi(0); inp.current?.focus(); }}>{x}</button>)}{quick.length > 0 && <i className="p0-hot-sep" aria-hidden="true" />}</>}
        {quick.length > 0 && <><small>Hızlı geçiş</small>{quick.map((x) => <button key={x.k} type="button" onClick={x.go}>{x.logo ? <ShopImg v={x.logo} className="logo" alt={x.t} /> : x.t}</button>)}</>}
      </div>}
      {sel && <PhoneResults sel={sel} onProduct={onProduct} onClear={() => { setSel(null); setQ(''); }} />}
    </section>
  );
}

// Paket 0 bölüm ayarları: shopHome.p0 = { find, cats, pick, sets, mq, hub } (Tasarım modunda bölüme tıklayınca)
export const p0of = (H) => H?.p0 || {};

// ---- 3 · Kategori karoları: ana kategoriler, her birinin resmi o kategorideki (öne çıkan / yeni / stoktaki) bir üründen
export function useCatTiles(imgs, hide) {
  const tree = useTree(); const vis = useVisibleProducts(false);
  const hk = (hide || []).join(',');
  return useMemo(() => {
    const hs = new Set((hide || []).map(String));
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
    return roots.map((n) => ({ id: n.id, name: n.name, n: cnt.get(n.id) || 0, p: pic.get(n.id)?.p, img: imgs?.[n.id] || '', off: hs.has(String(n.id)) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  }, [tree, vis, imgs, hk]); // eslint-disable-line react-hooks/exhaustive-deps
}
const openCat = (id) => { store.set({ catalogGo: { cat: id } }); go('katalog'); };
const openAll = () => { store.set({ catalogGo: { all: true } }); go('katalog'); };
export function CatTile({ c, i = 0 }) {
  return <button type="button" className="p0-cat" style={{ '--i': i }} onClick={() => openCat(c.id)}>
    <span className={'p0-cat-im' + (c.img ? ' own' : '')}>{c.img ? <ShopImg v={c.img} className="p0-cat-cov" alt={c.name} /> : c.p && <Thumb p={c.p} size="md" />}</span>
    <span className="p0-cat-t"><b>{c.name}</b><small>{c.n} ürün</small></span>
  </button>;
}
export function P0Cats({ H }) {
  const C = p0of(H).cats || {};
  const all = useCatTiles(H?.p0catImg, C.hide);
  const tiles = all.filter((c) => !c.off);
  if (!tiles.length) return null;
  const show = tiles.slice(0, Number(C.n) || 7);
  return (
    <section className="p0-sec rv">
      <P0Head eye={C.eye ?? 'Kategoriler'} title={C.title || 'Ne arıyorsun?'} more={['Tüm ürünler', openAll]} />
      <div className="p0-cats">{show.map((c, i) => <CatTile key={c.id} c={c} i={i} />)}
        <button type="button" className="p0-cat all" onClick={openAll}><span className="p0-cat-t"><b>Tüm ürünler</b><small>{all.reduce((a, c) => a + c.n, 0)} ürün</small></span><Icon n="back" s={18} className="flip" /></button>
      </div>
    </section>
  );
}
function P0Head({ eye, title, more }) {
  return <header className="p0-head"><div>{eye && <span className="p0-eye">{eye}</span>}<h2>{title}</h2></div>{more && <button type="button" className="p0-more" onClick={more[1]}>{more[0]}<Icon n="back" s={14} className="flip" /></button>}</header>;
}

// ---- 5 · Tamircinin seçimi: bir büyük + dört küçük. Ürünleri yönetici seçer (pick.ids); boşsa öne çıkanlar → yeni gelenler
function usePrice() { const S = useStore((s) => s.settings); const user = useStore((s) => s.user); const up = useStore((s) => s.userPrices); return (p) => { const pr = priceFor(p, S, user, up); return pr.mine == null ? 'Fiyat sorun' : fmt(pr.mine, p.cur); }; }
// sepete ekleyince − 1 + adet seçici (kartlardaki gibi)
const Add = ({ p, big }) => <span className={'p0-addw' + (big ? ' big' : '')}><CardAdd p={p} /></span>;
export function P0Pick({ S, onProduct }) {
  const C = p0of(S.shopHome).pick || {};
  const byId = useStore((s) => s.byId); const vis = useVisibleProducts(false);
  const price = usePrice();
  const ik = (C.ids || []).join(',');
  const list = useMemo(() => {
    const out = []; const seen = new Set(); const add = (p) => { if (p && sellable(p) && !seen.has(p.id) && out.length < 5) { seen.add(p.id); out.push(p); } };
    (C.ids || []).forEach((id) => add(byId.get(Number(id))));
    if (C.auto !== false) {
      feat(S).pins.forEach((id) => add(byId.get(Number(id))));
      vis.filter((p) => p.nw && p.s > 0 && hasImg(p)).forEach(add);
      vis.filter((p) => p.s > 0 && hasImg(p)).forEach(add);
    }
    return out;
  }, [S, byId, vis, ik, C.auto]); // eslint-disable-line react-hooks/exhaustive-deps
  if (list.length < 3) return null;
  const [a, ...rest] = list;
  return (
    <section className="p0-sec rv">
      <P0Head eye={C.eye ?? 'Tamircinin seçimi'} title={C.title || 'Bu hafta masamızdan'} />
      <div className="p0-bento">
        <div className="p0-b-big" role="button" tabIndex={0} onClick={() => onProduct(a)}>
          {(C.badge ?? 'Haftanın ürünü') && <span className="p0-eye">{C.badge ?? 'Haftanın ürünü'}</span>}
          <span className="p0-b-im"><Thumb p={a} size="lg" /></span>
          <span className="p0-b-f"><span><small>{a.b}</small><b>{a.n}</b></span><span className="p0-b-p"><b className="num">{price(a)}</b><Add p={a} big /></span></span>
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

const sbLight = (hex) => { const m = /^#?([\da-f]{6})$/i.exec(hex || ''); if (!m) return false; const n = parseInt(m[1], 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.6; };
export const SB_PATS = [['none', 'Düz'], ['dots', 'Noktalar'], ['grid', 'Izgara'], ['lines', 'Çizgiler'], ['circuit', 'Devre'], ['glow', 'Işık'], ['wave', 'Dalga']];
export const SB_COLORS = ['#16181d', '#1b2a52', '#24324f', '#3f5a4b', '#4e2f1f', '#3a3a42', '#f3efe7', '#e9edf6'];
// ---- 6 · Atölyeni kur: setler tek bantta (sets.ids seçilirse onlar, sırasıyla)
export function P0Sets({ S }) {
  const C = p0of(S.shopHome).sets || {};
  const byId = useStore((s) => s.byId);
  const live = liveSets(S);
  const sets = (C.ids?.length ? C.ids.map((id) => live.find((x) => x.id === id)).filter(Boolean) : live).slice(0, Number(C.n) || 3);
  if (!sets.length) return null;
  return (
    <section className={'p0-sec p0-setband rv sb-pat-' + (C.pat || 'dots') + (sbLight(C.bg) ? ' lt' : '')} style={C.bg ? { '--sb-bg': C.bg, ...(C.pc ? { '--sb-pc': C.pc } : null) } : C.pc ? { '--sb-pc': C.pc } : undefined}>
      <P0Head eye={C.eye ?? 'Atölyeni kur'} title={C.title || 'Birlikte al, daha az öde'} more={['Tüm setler', () => go('setlist')]} />
      <div className={'p0-sets n' + sets.length}>
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

// ---- 7 · Akan marka bandı: renk (renkli · gri · üstüne gelince renkli), hız, üstüne gelince durma, logo boyu (mq)
export function P0Brands({ H }) {
  const C = p0of(H).mq || {};
  const list = useBrandList().filter((b) => b.logo).slice(0, Number(C.max) || 18);
  if (list.length < 4) return null;
  const row = (dup) => list.map((b) => <button key={(dup ? 'd' : '') + b.n} type="button" className="p0-logo" onClick={() => openBrand(b.n)} tabIndex={dup ? -1 : 0} aria-hidden={dup || undefined} title={b.n}><ShopImg v={b.logo} className="logo" alt={b.n} /></button>);
  const col = C.color || 'color';
  return (
    <section className={'p0-brands rv mc-' + col + (C.pause ? ' mq-pause' : '')} aria-label="Markalar" style={{ '--mqd': (Number(C.speed) || 50) + 's', '--mqh': (Number(C.h) || 46) + 'px' }}>
      <div className="p0-brands-in">{row(false)}{row(true)}</div>
      {C.all !== false && <button type="button" className="p0-more p0-brands-all" onClick={() => go('markalar')}>Tüm markalar<Icon n="back" s={14} className="flip" /></button>}
    </section>
  );
}

// ---- 8 · Güven şeridi: avantajlar (Avantaj şeridinin yazıları), sade
export function P0Trust({ H }) {
  const u = (H.usps || []).filter((x) => x.title);
  if (!u.length) return null;
  return <section className="p0-trust rv" aria-label="Avantajlar">{u.map((x, i) => <div key={i} className="p0-tr"><Icon n={x.icon || 'check'} s={22} /><span><b>{x.title}</b>{x.text && <small>{x.text}</small>}</span></div>)}</section>;
}

// ---- Ürünler açılış sayfası (look.prodHub): önce büyük 'Tüm ürünler' kutusu + kategoriler + markalar
export function ProdHub({ onAll, total }) {
  const H = useStore((s) => s.settings.shopHome) || {}; const C = p0of(H).hub || {};
  const tiles = useCatTiles(H.p0catImg, p0of(H).cats?.hide).filter((c) => !c.off); const brands = useBrandList();
  return (
    <div className="p0-hub">
      <header className="p0-hub-h"><div>{(C.eye ?? 'Ürünler') && <span className="p0-eye">{C.eye ?? 'Ürünler'}</span>}<h1>{C.title || 'Ne arıyorsun?'}</h1></div></header>
      <button type="button" className="p0-hub-big" onClick={onAll}>
        <span><small>{C.allEye ?? 'Hepsi bir arada'}</small><b>Tüm ürünler</b><em>{total} ürün · ara, süz, sırala</em></span>
        <span className="p0-hub-go"><Icon n="back" s={22} className="flip" /></span>
      </button>
      <div className="p0-cats hub">{tiles.map((c, i) => <CatTile key={c.id} c={c} i={i} />)}</div>
      {brands.length > 0 && C.brands !== false && <>
        <h2 className="p0-hub-h2">Markalar</h2>
        <div className="p0-hub-brands">{brands.slice(0, 14).map((b) => <button key={b.n} type="button" onClick={() => openBrand(b.n)}>{b.logo ? <ShopImg v={b.logo} className="logo" alt={b.n} /> : <b>{b.n}</b>}</button>)}
          <button type="button" className="more" onClick={() => go('markalar')}>Tüm markalar<Icon n="back" s={14} className="flip" /></button></div>
      </>}
    </div>
  );
}

// =================================================================================================
// Tasarım modu panelleri (designer.jsx Inspector'dan; S = shopHome içine yazar: S('p0', …), S('p0catImg', …))
const TF = ({ label, v, on, ph }) => <Field label={label}><input value={v ?? ''} placeholder={ph} onChange={(e) => on(e.target.value)} /></Field>;
function useP0Set(H, set, part) { const P = p0of(H); const C = P[part] || {}; return [C, (patch) => set('p0', { ...P, [part]: { ...C, ...patch } })]; }
export function P0CatsPanel({ H, S: set, ImgPick }) {
  const [C, up] = useP0Set(H, set, 'cats');
  const tiles = useCatTiles(H.p0catImg, C.hide);
  const upImg = (id, v) => { const m = { ...(H.p0catImg || {}) }; if (v) m[id] = v; else delete m[id]; set('p0catImg', m); };
  const tog = (id) => { const h = new Set((C.hide || []).map(String)); h.has(String(id)) ? h.delete(String(id)) : h.add(String(id)); up({ hide: [...h] }); };
  return <>
    <div className="row2"><TF label="Üst yazı" v={C.eye ?? 'Kategoriler'} on={(v) => up({ eye: v })} /><TF label="Başlık" v={C.title} ph="Ne arıyorsun?" on={(v) => up({ title: v })} /></div>
    <Field label="Ana sayfada en fazla"><select value={C.n || 7} onChange={(e) => up({ n: Number(e.target.value) })}>{[3, 4, 5, 6, 7, 8, 11].map((n) => <option key={n} value={n}>{n} kategori + Tüm ürünler</option>)}</select></Field>
    <p className="fine">Kapak resimleri ve gizlenen kategoriler Ürünler açılış sayfasında da aynıdır. Boş bırakılan kategoride o kategorideki bir ürünün resmi kullanılır.</p>
    {tiles.map((c) => <div key={c.id} className={'p0-pn-cat' + (c.off ? ' off' : '')}>
      <Toggle id={'p0c' + c.id} label={c.name + ' · ' + c.n + ' ürün'} checked={!c.off} onChange={() => tog(c.id)} />
      {!c.off && <ImgPick v={c.img} onChange={(v) => upImg(c.id, v)} label="Kapak resmi" hint="Kare ya da yatay resim; ürün resmi de seçilebilir" prodOk />}
    </div>)}
  </>;
}
export function P0PickPanel({ H, S: set, ProductSearch }) {
  const [C, up] = useP0Set(H, set, 'pick'); const byId = useStore((s) => s.byId);
  const ids = C.ids || [];
  const mv = (i, d) => { const n = [...ids]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; up({ ids: n }); };
  return <>
    <div className="row2"><TF label="Üst yazı" v={C.eye ?? 'Tamircinin seçimi'} on={(v) => up({ eye: v })} /><TF label="Başlık" v={C.title} ph="Bu hafta masamızdan" on={(v) => up({ title: v })} /></div>
    <TF label="Büyük kutudaki etiket" v={C.badge ?? 'Haftanın ürünü'} on={(v) => up({ badge: v })} />
    <div className="field"><span className="field-l">Ürünler ({ids.length}/5) · ilki büyük kutuda</span>
      <div className="she-chips">{ids.map((id, i) => byId.get(Number(id)) && <span key={id} className="she-chip"><Thumb p={byId.get(Number(id))} size="sm" />{byId.get(Number(id)).n}
        <button type="button" onClick={() => mv(i, -1)} aria-label="Yukarı" disabled={!i}><Icon n="up" s={13} /></button>
        <button type="button" onClick={() => up({ ids: ids.filter((y) => y !== id) })} aria-label="Kaldır"><Icon n="x" s={14} /></button></span>)}</div>
      {ids.length < 5 && <ProductSearch onPick={(p) => !ids.includes(p.id) && up({ ids: [...ids, p.id] })} placeholder="Ürün ekle: ad ya da stok kodu yazın…" />}
    </div>
    <Toggle id="p0pa" label="Eksik kalırsa kendiliğinden doldur" hint="5'ten az ürün seçtiyseniz kalan kutular öne çıkanlar ve yeni gelenlerden dolar. Kapalıysa sadece seçtikleriniz (en az 3)." checked={C.auto !== false} onChange={(v) => up({ auto: v })} />
  </>;
}
export function P0SetsPanel({ H, S: set, sets }) {
  const [C, up] = useP0Set(H, set, 'sets');
  const ids = C.ids || [];
  return <>
    <div className="row2"><TF label="Üst yazı" v={C.eye ?? 'Atölyeni kur'} on={(v) => up({ eye: v })} /><TF label="Başlık" v={C.title} ph="Birlikte al, daha az öde" on={(v) => up({ title: v })} /></div>
    <Field label="En fazla"><select value={C.n || 3} onChange={(e) => up({ n: Number(e.target.value) })}>{[1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n} set</option>)}</select></Field>
    <Field label="Arka plan rengi"><span className="sxp-row p0-sw">{SB_COLORS.map((c) => <button key={c} type="button" className={(C.bg || '#16181d') === c ? 'on' : ''} style={{ background: c }} onClick={() => up({ bg: c })} aria-label={c} />)}
      <span className="she-color"><input type="color" value={C.bg || '#16181d'} onChange={(e) => up({ bg: e.target.value })} /></span></span></Field>
    <Field label="Desen"><span className="seg sw">{SB_PATS.map(([k, l]) => <button key={k} type="button" className={(C.pat || 'dots') === k ? 'on' : ''} onClick={() => up({ pat: k })}>{l}</button>)}</span></Field>
    {(C.pat || 'dots') !== 'none' && <Field label="Desen rengi" hint="Boşsa zemine göre açık ya da koyu"><span className="sxp-row"><span className="she-color"><input type="color" value={C.pc || (sbLight(C.bg) ? '#16181d' : '#ffffff')} onChange={(e) => up({ pc: e.target.value })} /></span>{C.pc && <button type="button" className="btn sm ghost" onClick={() => up({ pc: '' })}>Otomatik</button>}</span></Field>}
    <p className="fine">Hiçbirini seçmezseniz açık setlerin ilkleri görünür. Seçtiğiniz sırayla gösterilir.</p>
    {(sets || []).map((x) => <Toggle key={x.id} id={'p0s' + x.id} label={x.name + (x.on ? '' : ' · kapalı')} checked={ids.includes(x.id)} onChange={(v) => up({ ids: v ? [...ids, x.id] : ids.filter((y) => y !== x.id) })} />)}
    {!sets?.length && <p className="fine">Henüz set yok (Yönetim › Ürünler › Setler).</p>}
  </>;
}
export function P0FindPanel({ H, S: set }) {
  const [C, up] = useP0Set(H, set, 'find');
  return <>
    <div className="row2"><TF label="Üst yazı" v={C.eye ?? 'Hızlı bulucu'} on={(v) => up({ eye: v })} /><TF label="Başlık" v={C.title} ph="Telefon modelini yaz, uyan kalıp ve parçaları gösterelim" on={(v) => up({ title: v })} /></div>
    <TF label="Kutudaki örnek yazı" v={C.ph} ph="Örn. iPhone 15 Pro, Galaxy A52…" on={(v) => up({ ph: v })} />
    <TF label="Örnek modeller (virgülle)" v={C.ex ?? 'iPhone 13, Galaxy A52, Redmi Note 10 Pro'} on={(v) => up({ ex: v })} />
    <Toggle id="p0fq" label="Hızlı geçiş (kategori ve marka düğmeleri)" checked={C.quick !== false} onChange={(v) => up({ quick: v })} />
    {C.quick !== false && <div className="row2">
      <Field label="Kategori"><select value={C.qc ?? 4} onChange={(e) => up({ qc: Number(e.target.value) })}>{[0, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
      <Field label="Marka"><select value={C.qb ?? 4} onChange={(e) => up({ qb: Number(e.target.value) })}>{[0, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field></div>}
  </>;
}
export function P0BrandsPanel({ H, S: set }) {
  const [C, up] = useP0Set(H, set, 'mq');
  return <>
    <Field label="Logo rengi"><span className="seg sw">{[['color', 'Hep renkli'], ['hover', 'Üstüne gelince renkli'], ['gray', 'Hep gri']].map(([k, l]) => <button key={k} type="button" className={(C.color || 'color') === k ? 'on' : ''} onClick={() => up({ color: k })}>{l}</button>)}</span></Field>
    <Field label="Hız" hint="Bir turun süresi; büyük sayı = yavaş"><span className="she-scale"><input type="range" min="15" max="150" step="1" value={Number(C.speed) || 50} onChange={(e) => up({ speed: Number(e.target.value) })} /><code>{Number(C.speed) || 50} sn</code></span></Field>
    <Field label="Logo boyu"><span className="she-scale"><input type="range" min="28" max="80" step="2" value={Number(C.h) || 46} onChange={(e) => up({ h: Number(e.target.value) })} /><code>{Number(C.h) || 46} px</code></span></Field>
    <Toggle id="p0mp" label="Üstüne gelince dursun" checked={!!C.pause} onChange={(v) => up({ pause: v })} />
    <Toggle id="p0ma" label="Altında “Tüm markalar” bağlantısı" checked={C.all !== false} onChange={(v) => up({ all: v })} />
    <p className="fine">Logolar Ayarlar › Markalar’dan gelir; logosu olmayan marka bantta görünmez.</p>
  </>;
}
export function P0HubPanel({ H, S: set, ImgPick, L, setLook }) {
  const [C, up] = useP0Set(H, set, 'hub');
  return <>
    <Toggle id="p0hub" label="Ürünler’e basınca önce bu sayfa" hint="Kapalı = üst menüden Ürünler doğrudan ürün listesini açar." checked={L.prodHub === true} onChange={(v) => setLook('look.prodHub', v)} />
    <div className="row2"><TF label="Üst yazı" v={C.eye ?? 'Ürünler'} on={(v) => up({ eye: v })} /><TF label="Başlık" v={C.title} ph="Ne arıyorsun?" on={(v) => up({ title: v })} /></div>
    <TF label="Tüm ürünler kutusundaki küçük yazı" v={C.allEye ?? 'Hepsi bir arada'} on={(v) => up({ allEye: v })} />
    <Toggle id="p0hb" label="Altta markalar" checked={C.brands !== false} onChange={(v) => up({ brands: v })} />
    <h4 className="dz2-sub">Kategoriler ve kapak resimleri</h4>
    <P0CatsPanel H={H} S={set} ImgPick={ImgPick} />
  </>;
}
export const P0_NOTES = {
  'p0:trust': 'Avantaj şeridinin yazıları burada sade bir şerit olarak görünür.',
};
