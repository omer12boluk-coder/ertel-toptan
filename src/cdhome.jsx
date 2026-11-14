import { baseCatName } from './cats.js';
// 'Claude düzeni' (7.11.2026): fotoğraflı bannerların diliyle sıfırdan ana sayfa bölümleri (cd:*). Kurallar: docs/banner-kurallari.md
// Sade zemin, marka logosu, kısa model adı, bir satır açıklama, fiyat, tek düğme. Mor yok; düğmeler tema renginde.
// Bölümler sadece kayıtlı sırada (shopHome.layout) varsa çizilir — eski paketler (Paket 0, 1, Eski düzenim) birebir aynı kalır.
// Ayarlar: shopHome.cd = { pick: {ids, auto, names{id: kısa ad}, eye, title, badge}, sets: {ids, n, eye, title}, brands: {n, eye, title},
//   mq: {speed, eye}, rails: {} }; banner genişliği shopHome.heroW (''|narrow|mid|wide|full), yüksekliği shopHome.heroFill (''|screen).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, go } from './store.js';
import { waLink } from './route.js';
import { Icon, Thumb } from './ui.jsx';
import { fmt, norm, priceFor, byArrival } from './utils.js';
import { feat } from './extras.jsx';
import { liveSets, setView, openSet } from './sets.jsx';
import { useBrandList, openBrand } from './brandsets.jsx';
import { useVisibleProducts, useTree } from './catalog.jsx';
import { CardAdd, ShopImg, Hero } from './shophome.jsx';
import { heroList } from './photobn.jsx';
import { useMQ } from './heroframe.jsx';
import { lookFor } from './dzpresets.js';
const PHONE_MQ = '(max-width: 899px)';
import { useCatTiles } from './p0home.jsx';
import KESFET from './icerik/kesfet.json';
import KAPAKLAR from './icerik/kapaklar.json';

export const cdOf = (H) => H?.cd || {};
const sellable = (p) => p && p.a !== 0 && !p.so;
const hasImg = (p) => !!(p && (p.pi || p.im || p.img));

// kısa model adı: marka atılır; baştaki model parçaları (rakamlı/BÜYÜK harfli/Pro·Max·Mini…) alınır.
// İlk kelime sıradan bir kelimeyse (Power, Mini…) parantez/virgüle kadar en çok 4 kelime. Elle ad (cd.pick.names) her zaman önce.
const MODEL_W = new Set(['pro', 'max', 'mini', 'plus', 'ultra', 'se', 'lite', 'air', 'set', 'kit', 'ii', 'iii', 'iv', 'v2', 'v3', 'x']);
// 7.11.2026 (7) kullanıcı: adı ikiye bölüp yarısını silik yazmak her ürün adına uymuyor → kartlarda TAM AD (2 satır), altında
// silik satırda KATEGORİ. Tasarım modunda verilen 'Kısa ad' varsa o. shortOf eski yöntem (sadece panel listesinde).
export function nameOf(p, names) {
  const own = names?.[p.id];
  return { n: own || String(p.n || '').trim(), sub: baseCatName(p.c) || '' };
}
export function shortOf(p, names) {
  const own = names?.[p.id]; if (own) return { n: own, sub: '' };
  let n = String(p.n || '').trim();
  if (p.b && norm(n).startsWith(norm(p.b))) n = n.slice(p.b.length).trim();
  const cut = n.split(/[(,]/)[0].trim(); const w = cut.split(/\s+/).filter(Boolean);
  const isModel = (t) => /\d/.test(t) || (/^[A-ZÇĞİÖŞÜ0-9-]{2,}$/.test(t) && t.length <= 8) || MODEL_W.has(t.toLocaleLowerCase('tr'));
  let k = 0; while (k < w.length && k < 5 && isModel(w[k])) k++;
  if (!k) k = Math.min(4, w.length);
  const name = w.slice(0, k).join(' ');
  let sub = w.slice(k).join(' ').replace(/^[^\p{L}\p{N}]+/u, '');
  const par = /\(([^)]{2,40})\)/.exec(n); if (par && sub.length < 40 && /\d/.test(par[1])) sub = (sub ? sub + ' · ' : '') + par[1];
  return { n: name || p.n, sub: sub.length > 46 ? sub.slice(0, 44).replace(/\s+\S*$/, '') + '…' : sub };
}
function usePrice() {
  const S = useStore((s) => s.settings); const user = useStore((s) => s.user); const up = useStore((s) => s.userPrices);
  return (p) => { const pr = priceFor(p, S, user, up); return pr.mine == null ? null : fmt(pr.mine, p.cur); };
}
function useLogos() {
  const list = useBrandList();
  return useMemo(() => { const m = new Map(); for (const b of list) if (b.logo) m.set(norm(b.n), b.logo); return m; }, [list]);
}
const Logo = ({ p, logos, cls = 'cd-lg' }) => { const l = p?.b && logos.get(norm(p.b)); return l ? <ShopImg v={l} className={cls} alt={p.b} /> : p?.b ? <b className={cls + ' tx'}>{p.b}</b> : null; };
function Head({ eye, title, more }) {
  return <header className="cd-head"><div>{eye && <span className="cd-eye">{eye}</span>}<h2>{title}</h2></div>
    {more && <button type="button" className="cd-more" onClick={more[1]}>{more[0]}<Icon n="back" s={14} className="flip" /></button>}</header>;
}

// ---- Küçük ürün kartı (raflar + 'Bu hafta masamızdan'), 7.11.2026 (4): HER kartta aynı yuvalar, aynı yükseklik —
// logo satırı (logo yoksa boş), kare resim kutusu (resim ortada, kutuya sığar), ad 2 satır, açıklama 1 satır, fiyat satırı
// (fiyat yoksa 'Fiyat sorun' AYNI yerde), Sepete ekle en altta → yan yana kartlarda fiyat ve düğme hep aynı hizada (banner-kurallari §6).
function Tile({ p, X, pr, logos, onProduct, isNew, when }) {
  return (
    <div className="cd-tile" role="button" tabIndex={0} onClick={() => onProduct(p)}>
      <span className="cd-t-lg"><Logo p={p} logos={logos} />{when ? <span className="cd-when">{when}</span> : isNew && <span className="cd-new">Yeni</span>}</span>
      <span className="cd-tile-im"><Thumb p={p} size="md" /></span>
      <b className="cd-nm">{X.n}</b>
      <small className="cd-sb">{X.sub || '\u00a0'}</small>
      <span className="cd-t-pr">{pr ? <b className="cd-pr sm num">{pr}</b> : <small>Fiyat sorun</small>}</span>
      <CardAdd p={p} />
    </div>
  );
}

// ---- Banner alanı: kullanıcının reklam listesi (fotoğraflı bannerlar dahil), genişlik ve yükseklik sayfadan ayrı ----
export const HERO_W = [['', 'Sayfayla aynı'], ['narrow', 'Dar'], ['mid', 'Orta'], ['wide', 'Geniş'], ['full', 'Kenardan kenara']];
export const HERO_FILL = [['', 'Normal'], ['screen', 'Ekranı doldur'], ['full', 'Tam kapla']];
export function CdHero({ H, open, onProduct, brands, pkHero, gap }) {
  const ref = useRef(null);
  // 14.11.2026 'Ortada logo' üst menüde banner menüye yapışık + kenardan kenara (shopHome.heroStick 'off' = eski, boşluklu)
  const LK0 = useStore((s) => s.settings?.look);
  const phoneH = useMQ(PHONE_MQ);
  const frame = H.heroFrame || '';
  // heroStick: '' = sadece 'Ortada logo' menüsünde | 'all' = her menüde | 'off' = kapalı (boşluklu, eski)
  const hdr = lookFor(LK0, phoneH).header || 'search';
  const stick = !['deck', 'glow', 'side'].includes(frame) && (H.heroStick === 'all' || (H.heroStick !== 'off' && hdr === 'center'));
  const w = stick ? 'full' : H.heroW || ''; // 14.11.2026 yükseklik telefon/bilgisayar ayrı: heroFillM boşsa (hiç seçilmemişse) bilgisayarınkini kullanır (eski davranış)
  const fillV = phoneH && H.heroFillM != null ? H.heroFillM : H.heroFill;
  const fill = fillV === 'screen' || fillV === 'full'; const full = fillV === 'full';
  const slides = useMemo(() => heroList(H), [H.slides, H.photoBn]); // eslint-disable-line react-hooks/exhaustive-deps
  const out = !!w; // sayfanın kenarından taşabilir → sayfa kırpması açılır
  useEffect(() => { if (!out) return; const c = document.documentElement.classList; c.add('hf-on', 'hf-wide'); return () => c.remove('hf-on', 'hf-wide'); }, [out]);
  useLayoutEffect(() => {
    const el = ref.current; if (!el || !fill) return;
    const W = el.ownerDocument.defaultView || window;
    const m = () => {
      const t = el.getBoundingClientRect().top + W.scrollY; el.style.setProperty('--fs-top', Math.max(0, Math.min(260, Math.round(t))) + 'px');
      // 14.11.2026 'Tam kapla': telefonda banner alt menünün (botnav) üst kenarında biter → alt menü bannerı kapatmaz
      if (full) { const bn = el.ownerDocument.querySelector('.botnav'); const r = bn && getComputedStyle(bn).display !== 'none' ? bn.getBoundingClientRect() : null;
        const sp = r && r.height > 10 && r.top < W.innerHeight ? Math.max(0, Math.min(160, Math.round(W.innerHeight - r.top + 8))) : 0; el.style.setProperty('--bn-sp', sp + 'px'); }
    };
    // 14.11.2026: ilk ölçüm (çizim bitmeden) birkaç px eksik çıkıyordu → giriş sayfasından sonra banner kısalıp sonra oturuyordu.
    // Bir sonraki karede de ölçülür; sayfanın üst kısmı (menü yüksekliği vb.) değişirse ResizeObserver ile yeniden.
    m(); const raf = requestAnimationFrame(() => { m(); requestAnimationFrame(m); }); const t = setTimeout(m, 400);
    const ro = 'ResizeObserver' in W ? new W.ResizeObserver(m) : null; const top = el.ownerDocument.querySelector('.topbar'); if (ro && top) ro.observe(top);
    W.addEventListener('resize', m); return () => { cancelAnimationFrame(raf); clearTimeout(t); ro?.disconnect(); W.removeEventListener('resize', m); };
  }, [fill, full]);
  // yapışık: sayfanın ilk bölümüyse sayfa üst boşluğu (main padding) kalkar → html.hst-on
  useLayoutEffect(() => {
    const el = ref.current; const c = document.documentElement.classList;
    const first = !!el && el.parentElement?.firstElementChild === el && !!el.closest('.shell.public');
    c.toggle('hst-on', stick && first);
    // 14.11.2026 her menü türünde sıfır boşluk: kalan aralık (menü yüzen camsa vb.) ölçülüp banner o kadar yukarı çekilir
    let pull = 0; let raf = 0;
    const fix = () => {
      if (!el || !stick || !first || (el.ownerDocument.defaultView || window).scrollY > 4) return;
      const top = el.ownerDocument.querySelector('.shell.public .topbar'); if (!top) return;
      const T = top.getBoundingClientRect(); if (T.height < 10 || T.bottom <= 0) return;
      const g = Math.round(el.getBoundingClientRect().top - T.bottom + pull);
      const np = Math.max(0, Math.min(80, g));
      if (np !== pull) { pull = np; el.style.setProperty('--hst-pull', np + 'px'); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); }
    };
    if (stick && first) { fix(); raf = requestAnimationFrame(() => { fix(); requestAnimationFrame(fix); }); }
    const t = setTimeout(fix, 500);
    addEventListener('resize', fix);
    return () => { c.remove('hst-on'); cancelAnimationFrame(raf); clearTimeout(t); removeEventListener('resize', fix); el?.style.removeProperty('--hst-pull'); };
  }, [stick, slides.length, hdr]);
  if (!slides.length) return null;
  // 7.11.2026 (7) üst menü ile banner arası ek boşluk (look.heroGap px, Tasarım › Görünüm)
  return <div ref={ref} className={'cd-hero' + (w ? ' hw-' + w : '') + (fill ? ' hh-screen' : '') + (full ? ' hh-full' : '') + (stick ? ' hst' : '')} style={Number(gap) && !stick ? { marginTop: Number(gap) + 'px' } : undefined}>
    <Hero slides={slides} open={open} onProduct={onProduct} brands={brands} pkHero={pkHero} nv={{ ...(H.heroNav || {}), full: w === 'full' ? 'all' : '', fs: '' }} heroH={fill ? undefined : H.heroH} />
  </div>;
}

// ---- Bu hafta masamızdan: bir büyük (haftanın ürünü) + dört küçük ----
// 'Bu hafta masamızdan' listesi (5 ürün): önce seçilenler, boş yerler öne çıkanlar → yeni gelenler → stoklular. Tasarım paneli de
// bunu kullanır (otomatik dolan yerleri 'Otomatik' diye gösterir).
export function usePickList(C, S) {
  const byId = useStore((s) => s.byId); const vis = useVisibleProducts(false);
  const ik = (C.ids || []).join(',');
  return useMemo(() => {
    const out = []; const seen = new Set(); const add = (p) => { if (p && sellable(p) && !seen.has(p.id) && out.length < 5) { seen.add(p.id); out.push(p); } };
    (C.ids || []).forEach((id) => add(byId.get(Number(id))));
    if (C.auto !== false) {
      feat(S).pins.forEach((id) => add(byId.get(Number(id))));
      vis.filter((p) => p.nw && p.s > 0 && hasImg(p)).forEach(add);
      vis.filter((p) => p.s > 0 && hasImg(p)).forEach(add);
    }
    return out;
  }, [S, byId, vis, ik, C.auto]); // eslint-disable-line react-hooks/exhaustive-deps
}
export function CdPick({ H, S, onProduct }) {
  const C = cdOf(H).pick || {};
  const list = usePickList(C, S);
  const price = usePrice(); const logos = useLogos();
  if (list.length < 3) return null;
  const [a, ...rest] = list; const A = nameOf(a, C.names);
  return (
    <section className="cd-sec rv">
      <Head eye={C.eye ?? 'Tamircinin seçimi'} title={C.title || 'Bu hafta masamızdan.'} />
      <div className="cd-bento">
        <div className="cd-big" role="button" tabIndex={0} onClick={() => onProduct(a)}>
          <div className="cd-big-t">
            <Logo p={a} logos={logos} />
            {(C.badge ?? 'Haftanın ürünü') && <span className="cd-eye g">{C.badge ?? 'Haftanın ürünü'}</span>}
            <h3>{A.n}</h3>{A.sub && <p>{A.sub}</p>}
            {price(a) && <b className="cd-pr num">{price(a)}</b>}
            <span className="cd-big-add"><CardAdd p={a} /><span className="cd-lnk">İncele<Icon n="back" s={13} className="flip" /></span></span>
          </div>
          <span className="cd-big-im"><Thumb p={a} size="lg" /></span>
        </div>
        <div className="cd-grid">{rest.map((p) => <Tile key={p.id} p={p} X={nameOf(p, C.names)} pr={price(p)} logos={logos} onProduct={onProduct} />)}</div>
      </div>
    </section>
  );
}

// ---- Atölyeni kur: her set kendi açık renkli kartında, ürün fotoğrafları üst üste ----
const SET_BG = ['var(--surface)']; // 7.11.2026 (3): renkli zeminde beyaz zeminli ürün resimleri kutu gibi duruyordu → hepsi beyaz
export function CdSets({ H, S }) {
  const C = cdOf(H).sets || {};
  const byId = useStore((s) => s.byId); const logos = useLogos();
  const live = liveSets(S);
  const sets = (C.ids?.length ? C.ids.map((id) => live.find((x) => x.id === id)).filter(Boolean) : live).slice(0, Number(C.n) || 3);
  if (!sets.length) return null;
  return (
    <section className="cd-sec rv">
      <Head eye={C.eye ?? 'Atölyeni kur'} title={C.title || 'Birlikte al, daha az öde.'} more={['Tüm setler', () => go('setlist')]} />
      <div className={'cd-sets n' + sets.length}>
        {sets.map((x, i) => { const v = setView(x, byId); const ps = v.active.map((l) => l.p).filter(Boolean); const brands = [...new Set(ps.map((p) => p.b).filter(Boolean))];
          return (
            <button key={x.id} type="button" className="cd-set" style={{ '--sbg': SET_BG[i % SET_BG.length] }} onClick={() => openSet(x.id)}>
              <span className={'cd-set-art k' + Math.min(3, ps.length)}>{ps.slice(0, 3).map((p) => <span key={p.id} className="cd-si"><Thumb p={p} size="md" /></span>)}</span>
              <span className="cd-set-t">
                <span className="cd-eye">Set · {v.active.length} ürün</span>
                <b className="cd-set-n">{x.name}</b>
                {brands.length > 0 && <span className={'cd-set-lg' + (brands.length > 3 ? ' lg4' : '')}>{brands.slice(0, 4).map((b) => (logos.get(norm(b)) ? <ShopImg key={b} v={logos.get(norm(b))} alt={b} /> : <small key={b}>{b}</small>))}</span>}
                <span className="cd-set-p"><b className="num">{fmt(v.price, v.cur)}</b>{v.save > 0 && <s className="num">{fmt(v.list, v.cur)}</s>}{v.save > 0 && <small>ayrı ayrı</small>}{v.save > 0 && <em className="cd-set-sv num">{fmt(v.save, v.cur)} kazanç</em>}</span>
                <span className="cd-set-go"><span className="cd-pill">Seti incele</span></span>
              </span>
            </button>); })}
      </div>
    </section>
  );
}

// ---- Markalar: TÜM markalar logo duvarı (beyaz kutular, logo ortada, ürün sayısı altında) — 7.11.2026 (3) ----
export function BrandWall({ max, logosOnly, rows, ids, only, scroll }) {
  const all = useBrandList();
  const base = logosOnly ? all.filter((b) => b.logo) : all;
  // 7.11.2026 (7) elle seçilen markalar önde (seçilen sırayla); 'only' ise sadece onlar
  let list = base;
  if (ids?.length) { const by = new Map(all.map((b) => [b.n, b])); const pick = ids.map((n) => by.get(n)).filter(Boolean); list = only === false ? [...pick, ...base.filter((b) => !ids.includes(b.n))] : pick; }
  // kaç sıra: sütun sayısı ekrana göre (CSS ile aynı: telefon 3, ≥900 4-8) → tam sıra
  const cols = useBwCols();
  // 7.11.2026 (12) telefonda (ana sayfa bölümü): en çok 2 sıra, kalan markalar yana kaydırılır (kesilmez)
  const sc = scroll && cols === 3;
  if (sc) { if (max && !rows) list = list.slice(0, max); }
  else if (rows) list = list.slice(0, rows * cols); else if (max) list = list.slice(0, max);
  const nr = sc ? Math.min(2, rows || 2, Math.ceil(list.length / 3)) : 0;
  return <div className={'cd-bwall' + (sc ? ' bw-scroll' : '')} style={{ '--bw-cols': cols, '--bw-rows': nr || undefined }}>{list.map((b, i) => (
    <button key={b.n} type="button" className="cd-bw" style={{ ...(b.color ? { '--bc': b.color } : null), '--d': Math.min(12, sc ? (i % (nr || 1)) + Math.floor(i / (nr || 1)) : (i % cols) + Math.floor(i / cols)) }} onClick={() => openBrand(b.n)} title={b.n}>
      <span className="cd-bw-lg">{b.logo ? <ShopImg v={b.logo} alt={b.n} /> : <b>{b.n}</b>}</span>
      <small>{b.c} ürün</small>
    </button>))}</div>;
}
function bwCols() { if (typeof window === 'undefined') return 8; const w = window.innerWidth; return w < 900 ? 3 : w < 1100 ? 5 : w < 1400 ? 6 : 8; }
function useBwCols() {
  const [c, setC] = useState(bwCols);
  useEffect(() => { const f = () => setC(bwCols()); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  return c;
}
export function CdBrands({ H }) {
  const C = cdOf(H).brands || {};
  const n = useBrandList().length;
  if (n < 3) return null;
  return (
    <section className="cd-sec rv">
      <Head eye={C.eye ?? 'Markalar'} title={C.title || 'Tüm markalar.'} more={['Markalar sayfası', () => go('markalar')]} />
      <BrandWall max={Number(C.n) || 0} rows={Number(C.rows) || 0} ids={C.ids} only={C.only} logosOnly={!!C.logosOnly} scroll />
    </section>
  );
}

// ---- Akan şerit: logolar kendi renginde, kenarlarda yumuşak geçiş, üstüne gelince durur ----
export function CdMarquee({ H }) {
  const C = cdOf(H).mq || {};
  const list = useBrandList().filter((b) => b.logo).slice(0, 18);
  if (list.length < 4) return null;
  const row = (dup) => list.map((b) => <button key={(dup ? 'd' : '') + b.n} type="button" className="cd-mq-i" onClick={() => openBrand(b.n)} tabIndex={dup ? -1 : 0} aria-hidden={dup || undefined} title={b.n}><ShopImg v={b.logo} alt={b.n} /></button>);
  const sp = Number(C.speed) || 40;
  return (
    <section className="cd-mq rv" aria-label="Markalar">
      {C.eye !== '' && <span className="cd-eye">{C.eye ?? 'Orijinal ürün, distribütör güvencesi'}</span>}
      <div className="cd-mq-in"><div className="cd-mq-tr" style={{ '--mq-t': Math.max(14, Math.round(list.length * (80 / sp) * 2.2)) + 's' }}>{row(false)}{row(true)}</div></div>
    </section>
  );
}

// ---- Ürün rafı: kayıtlı raf ayarları (mod/marka/kategori/elle seçim) + yeni kart dili ----
// ---- 7.11.2026 (8) Yeni gelenler (banner'ın altı): solda banner gibi kapak kartı, sağda elle kaydırılan raf. Sıra kendiliğinden:
// geliş anı (ft) yeniden eskiye, yoksa ürün numarası (byArrival). shopHome.cd.nw {eye,title,n,ids (öne sabit), hide}.
// Kapak rafın İLK kartı (aynı boy) → kartların fiyat/Sepete ekle hizası bozulmaz.
export function useNewList(C) {
  const catalog = useStore((s) => s.catalog); const byId = useStore((s) => s.byId);
  const ik = (C.ids || []).join(','); const hk = (C.hide || []).join(',');
  return useMemo(() => {
    const hide = new Set((C.hide || []).map(Number)); const n = Number(C.n) || 12;
    const pins = (C.ids || []).map((id) => byId.get(Number(id))).filter((p) => p && sellable(p) && !hide.has(p.id));
    const ps = new Set(pins.map((p) => p.id));
    const rest = catalog.filter((p) => sellable(p) && p.s > 0 && hasImg(p) && !hide.has(p.id) && !ps.has(p.id)).sort(byArrival);
    return [...pins, ...rest].slice(0, n);
  }, [catalog, byId, ik, hk, C.n]); // eslint-disable-line react-hooks/exhaustive-deps
}
const DAY = 864e5;
function whenOf(ft) {
  if (!ft) return '';
  const d = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(ft).setHours(0, 0, 0, 0)) / DAY);
  return d <= 0 ? 'Bugün' : d === 1 ? 'Dün' : d < 7 ? d + ' gün önce' : d < 14 ? 'Geçen hafta' : d < 31 ? Math.floor(d / 7) + ' hafta önce' : '';
}
export function CdNew({ H, onProduct, edit }) {
  const C = cdOf(H).nw || {};
  const list = useNewList(C);
  const price = usePrice(); const logos = useLogos();
  const railRef = useRef(null);
  const [edge, setEdge] = useState([true, false]); // [başta, sonda]
  const upd = () => { const el = railRef.current; if (!el) return; const a = el.scrollLeft < 8, b = el.scrollLeft + el.clientWidth > el.scrollWidth - 8; setEdge((e) => (e[0] === a && e[1] === b ? e : [a, b])); };
  if (list.length < 3) return edit ? <div className="dz-empty">Yeni gelenler: gösterilecek ürün yok</div> : null;
  const week = list.filter((p) => p.ft && Date.now() - p.ft < 7 * DAY).length;
  const title = C.title || (week >= 2 ? `Bu hafta\n${week} yeni ürün.` : 'Yeni gelenler.');
  const all = () => { if (edit) return; store.set({ catalogGo: { sort: 'new', all: true } }); go('katalog'); };
  const by = (d) => { const el = railRef.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: 'smooth' }); };
  return (
    <section className="cd-sec cd-nwsec rv">
      {/* 7.11.2026: oklar kapak kartının içindeydi → kayınca kayboluyordu; artık rafın iki yanında sabit */}
      {!edge[0] && <button type="button" className="cd-arr cd-nw-nav prev" onClick={() => by(-1)} aria-label="Geri"><Icon n="back" s={18} /></button>}
      {!edge[1] && <button type="button" className="cd-arr cd-nw-nav next" onClick={() => by(1)} aria-label="İleri"><Icon n="back" s={18} className="flip" /></button>}
      {/* 14.11.2026 telefonda (html.ux-nw) kapak kutusu yerine bu başlık görünür; bilgisayarda gizli */}
      <header className="cd-head cd-nw-head"><div><span className="cd-eye">{C.eye ?? 'Yeni gelenler'}</span><h2>{title}</h2></div>
        <button type="button" className="cd-more" onClick={all}>Hepsini gör<Icon n="back" s={14} className="flip" /></button></header>
      <div className="cd-rail" ref={railRef} onScroll={upd}>
        <div className="cd-tile cd-newcov">
          <span className="cd-eye">{C.eye ?? 'Yeni gelenler'}</span>
          <h2>{title}</h2>
          <span className="cd-newcov-a">
            <button type="button" className="cd-newcov-b" onClick={all}>Hepsini gör<Icon n="back" s={13} className="flip" /></button>
          </span>
        </div>
        {list.map((p) => <Tile key={p.id} p={p} X={nameOf(p)} pr={price(p)} logos={logos} onProduct={onProduct} when={whenOf(p.ft)} />)}
      </div>
    </section>
  );
}
export function CdRail({ sec, open, onProduct, edit }) {
  const catalog = useStore((s) => s.catalog); const byId = useStore((s) => s.byId);
  const tree = useTree(); const price = usePrice(); const logos = useLogos();
  const railRef = useRef(null);
  const limit = Number(sec.limit) || 10;
  const list = useMemo(() => {
    if (sec.mode === 'manual') return (sec.ids || []).map((id) => byId.get(id)).filter(sellable);
    let r = catalog.filter(sellable);
    if (sec.mode === 'brand') r = r.filter((p) => p.b && norm(p.b) === norm(sec.brand || ''));
    if (sec.mode === 'cat') { const c = Number(sec.cat); r = r.filter((p) => tree.ancestors(p.c).includes(c) || (p.c2 != null && tree.ancestors(p.c2).includes(c))); }
    if (sec.mode === 'new') { const flagged = r.filter((p) => p.nw); r = (flagged.length >= limit ? flagged : r); }
    return [...r].sort((a, b) => b.id - a.id).slice(0, limit);
  }, [catalog, byId, sec, tree, limit]);
  if (!list.length) return edit ? <div className="dz-empty">{'Ürün rafı “' + (sec.title || '') + '”: ürün bulunamadı'}</div> : null;
  const more = sec.mode === 'brand' ? () => open('brand:' + sec.brand)() : sec.mode === 'cat' ? () => open('cat:' + sec.cat)() : () => go('katalog');
  const by = (d) => { const el = railRef.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: 'smooth' }); };
  return (
    <section className="cd-sec rv">
      <header className="cd-head"><div>{sec.sub && <span className="cd-eye">{sec.sub}</span>}<h2>{sec.title || 'Ürünler'}</h2></div>
        <span className="cd-head-r">{!edit && <button type="button" className="cd-more" onClick={more}>Tümü<Icon n="back" s={14} className="flip" /></button>}
          <button type="button" className="cd-arr" onClick={() => by(-1)} aria-label="Geri"><Icon n="back" s={16} /></button><button type="button" className="cd-arr" onClick={() => by(1)} aria-label="İleri"><Icon n="back" s={16} className="flip" /></button></span></header>
      <div className="cd-rail" ref={railRef}>{list.map((p) => <Tile key={p.id} p={p} X={nameOf(p)} pr={price(p)} logos={logos} onProduct={onProduct} isNew={sec.mode === 'new' || p.nw} />)}</div>
    </section>
  );
}

// ---- Ürünler açılış sayfası (look.cd + look.prodHub): kapaklı kategori kartları + Tüm ürünler + marka duvarı (7.11.2026 (3)) ----
// Kapaklar: Claude'un hazırladığı fotoğraflar hosting/public/bn/cat-<id>.webp ÖNCE (7.11.2026 (4) kullanıcı: kendi resimlerim çirkin); kapağı olmayan kategoride kullanıcının seçtiği (shopHome.p0catImg).
// 'Tüm ürünler' artık ayrı büyük kart değil, ızgaranın ilk kartı (ilk 4 kapaktan kolaj) → 7 kategori + 1 = boşluksuz 4'lü/2'li ızgara.
// İÇERİK: src/icerik/kapaklar.json (kategori no → resim; tarif claude/is/kapak.md)
export const CAT_COVERS = KAPAKLAR;
export function CdHub({ onAll, total }) {
  const H = useStore((s) => s.settings.shopHome) || {}; const C = H.p0?.hub || {};
  const tiles = useCatTiles(H.p0catImg, H.p0?.cats?.hide).filter((c) => !c.off);
  const open = (id) => { store.set({ catalogGo: { cat: id } }); go('katalog'); };
  return (
    <div className="cd-hub">
      <header className="cd-head"><div><span className="cd-eye">{C.eye ?? 'Ürünler'}</span><h2 className="cd-hub-t">{C.title || 'Ne arıyorsun?'}</h2></div></header>
      <div className="cd-cats">
        <button type="button" className="cd-cat all" onClick={onAll}>
          <span className="cd-cat-im all">{tiles.slice(0, 4).map((c) => { const cov = CAT_COVERS[c.id] || c.img; return <span key={c.id}>{cov ? <ShopImg v={cov} alt="" /> : c.p && <Thumb p={c.p} size="md" />}</span>; })}</span>
          <span className="cd-cat-t"><b>Tüm ürünler</b><small>{total} ürün</small></span>
        </button>
        {tiles.map((c) => { const cov = CAT_COVERS[c.id] || c.img; return (
        <button key={c.id} type="button" className="cd-cat" onClick={() => open(c.id)}>
          <span className={'cd-cat-im' + (cov ? ' cov' : '')}>{cov ? <ShopImg v={cov} alt={c.name} /> : c.p && <Thumb p={c.p} size="md" />}</span>
          <span className="cd-cat-t"><b>{c.name}</b><small>{c.n} ürün</small></span>
        </button>); })}</div>
      {C.brands !== false && <section className="cd-sec"><Head eye="Markalar" title="Tüm markalar." more={['Markalar sayfası', () => go('markalar')]} /><BrandWall /></section>}
    </div>
  );
}

// ---- Reklam kutuları (cd:ads, 7.11.2026 (3)): banner kurallarıyla küçük reklamlar, yan yana; KENDİLİĞİNDEN KAYMAZ (parmak / oklar) ----
// Fotoğraflar hosting/public/bn/ad-<id>.webp (üst kısım yazı için boş). Ayar: shopHome.cd.ads { off: [id], eye, title }.
// İÇERİK: src/icerik/kesfet.json (yeni kutu = bir satır; tarif claude/is/kesfet-ekle.md)
export const CD_ADS = KESFET.filter((a) => !a.off); // "off": true = kod tarafında kapalı
export function CdAds({ H, open }) {
  const C = cdOf(H).ads || {};
  const off = new Set(C.off || []);
  const list = CD_ADS.filter((a) => !off.has(a.id));
  const rail = useRef(null);
  if (!list.length) return null;
  const by = (d) => { const el = rail.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: 'smooth' }); };
  return (
    <section className="cd-sec rv">
      <header className="cd-head"><div>{(C.eye ?? 'Keşfet') && <span className="cd-eye">{C.eye ?? 'Keşfet'}</span>}<h2>{C.title || 'Atölyen için.'}</h2></div>
        <span className="cd-head-r"><button type="button" className="cd-arr" onClick={() => by(-1)} aria-label="Geri"><Icon n="back" s={16} /></button><button type="button" className="cd-arr" onClick={() => by(1)} aria-label="İleri"><Icon n="back" s={16} className="flip" /></button></span></header>
      <div className="cd-ads" ref={rail}>{list.map((a) => (
        <button key={a.id} type="button" className="cd-ad" onClick={open(a.link)} style={{ backgroundImage: `url(/bn/ad-${a.id}.webp${a.v ? '?v=' + a.v : ''})` }}>
          <span className="cd-ad-t">
            <span className="cd-ad-eye">{a.logo && <img src={a.logo} alt="" />}{a.eye && <span>{a.eye}</span>}</span>
            <b>{a.title}</b>
            <small>{a.sub}</small>
            <span className="cd-lnk">{a.cta}<Icon n="back" s={13} className="flip" /></span>
          </span>
        </button>))}</div>
    </section>
  );
}

// ---- 7.11.2026 (7) Alt bant 'Aradığını bulamadın mı?' — banner dilinde: sade açık kart, büyük başlık, dolu düğme + yazı bağlantısı,
// (konuşma balonları kullanıcı istemedi, kaldırıldı). Yazılar shopHome.cta'dan (başlık/metin), boşsa varsayılan.
export function CdCta({ H, S, edit }) {
  const C = H.cta || {}; const wa = S.shop?.whatsapp;
  const title = C.title || 'Aradığını bulamadın mı?';
  return (
    <section className="cd-cta rv">
      <div className="cd-cta-t">
        <span className="cd-eye">Bize yazın</span>
        <h2>{title}</h2>
        <p>{C.text || 'Model kodunu ya da fotoğrafını WhatsApp’tan gönder; stokta yoksa senin için getirelim.'}</p>
        <div className="cd-cta-a">
          {wa && <a className="cd-cta-wa" href={edit ? undefined : waLink(wa, 'Merhaba, bir ürün soracaktım:')} target="_blank" rel="noopener"><Icon n="wa" s={18} />WhatsApp’tan yaz</a>}
          <button type="button" className="cd-lnk" onClick={edit ? undefined : () => go('katalog')}>Tüm ürünler<Icon n="back" s={13} className="flip" /></button>
        </div>
      </div>
    </section>
  );
}
