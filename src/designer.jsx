import { queueSave } from './saveq.js';
// Yönetim paneli > Tasarım modu (2. sürüm, 31.10.2026).
// Bilgisayarda tam ekran düzenleyici: solda Katmanlar, ortada gerçek genişlikte önizleme çerçeveleri (Bilgisayar / Telefon / Yan yana),
// sağda hep aynı yerde duran ayar paneli. Hiçbir şey seçili değilken panel "Sayfa" ayarlarını gösterir.
// Değişiklikler Ayarlar'daki aynı kayda (settings.shopHome, settings.look, settings.brandLogos) yazılır.
// Telefonda (dokunmatik) eski yöntem: sayfa doğrudan çizilir, dokunma seçer, alttaki çubuktan işlem yapılır.
import { useContext, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useStore, store, toast, go } from './store.js';
import { Icon, Field, Toggle, Confirm, openMenu } from './ui.jsx';
import { withDefaults, norm, ls } from './utils.js';
import {
  ShopHome, DesignCtx, FxFields, FX_NAMES, layoutOf, blockLabel, dragSort, moveItem, rid, NEW, UspFields, PromoFields, RailFields, BrandFields, BlockFields,
  ScaleField, MQ_STYLES, ShopImg, useShopImg, CtaButton, btnStyleOf, GeoFields, geoOf, withProdFallback, THEMES, SLIDE_LAYOUTS, COVER_LY, ColorPick, LinkPick, LogoPick, ImgPick, ImgLook, Rows,
} from './shophome.jsx';
import { DeviceFrame, useSize, onDrag, winOf } from './dzframe.jsx';
import { BTN_STYLES, ARROWS, SLIDE_TEMPLATES, BG_PRESETS, BG_CATS, BG_BY, PALETTES, PACKS, PACK_BY, PACK_PARTS, FX_KINDS, activePack, contrast, bgTone } from './presets.js';
import { PackDecor, DECOR } from './decor.jsx';

// raflara kalıcı kimlik ver, eski sıra kayıtlarını (rail:0) kimliğe çevir.
// Aynı ayar nesnesi için hep aynı sonuç (kimlikler her çağrıda yeniden üretilip sıra kayıtlarıyla çelişmesin)
const prepCache = new WeakMap();
function prepare(S) {
  if (prepCache.has(S)) return prepCache.get(S);
  const d = prepare0(S); prepCache.set(S, d); return d;
}
function prepare0(S) {
  const d = structuredClone(S);
  const H = (d.shopHome = d.shopHome || {});
  const old = H.sections || [];
  H.sections = old.map((r) => (r.id ? r : { ...r, id: rid() }));
  if (Array.isArray(H.layout)) H.layout = H.layout.map((k) => { const m = /^rail:(\d+)$/.exec(k); return m && old[Number(m[1])] && !old[Number(m[1])].id ? 'rail:' + H.sections[Number(m[1])].id : k; });
  H.layout = layoutOf(H);
  H.blocks = H.blocks || {};
  d.look = d.look || {};
  return d;
}
const setPath = (obj, path, v) => { const n = structuredClone(obj); const ks = path.split('.'); let o = n; ks.slice(0, -1).forEach((k) => (o = o[k] = o[k] ?? {})); o[ks.at(-1)] = v; return n; };
// bir değişikliğin kullanıcıya görünen adı (geri al bildirimi ve "değişiklikler" listesi)
const PATH_NAMES = { slides: 'Büyük reklam', heroH: 'Reklam yüksekliği', usps: 'Avantaj şeridi', brands: 'Marka kutuları', promos: 'Kare kutular', sections: 'Ürün rafları', blocks: 'Eklenen bölümler', layout: 'Bölüm sırası', hidden: 'Gizli bölümler', geo: 'Genişlik ve yer', marquee: 'Kayan şerit', mqSpeed: 'Şerit hızı', mqSpeedM: 'Şerit hızı (telefon)', brandSize: 'Marka kutusu boyu', brandLogoScale: 'Logo boyutu', brandsTitle: 'Markalar başlığı', brandsSub: 'Markalar alt yazısı', promosTitle: 'Kutular başlığı', cta: 'Alt bant', gap: 'Bölüm arası boşluk', brandCta: '“Ürünleri gör” yazısı', enabled: 'Ana sayfa açık/kapalı' };
const nameOf = (path) => { const k = path.split('.'); if (k[0] === 'look') return k[1] === 'pack' || k[1] === 'myPacks' ? 'Tema Stüdyosu' : 'Sayfa renkleri'; if (k[0] === 'brandLogos') return 'Marka logoları'; return PATH_NAMES[k[1]] || 'Tasarım'; };
const VERS_KEY = 'dz-versions';
// telefon çerçevesindeki bir reklamın yazı öğelerinin şu anki yerini kutuya oranla ölç → fxm {el: {ax, ay, s, r, rx, ry}}
const FX_KEY = Object.fromEntries(Object.entries(FX_NAMES).map(([k, v]) => [v, k]));
function phoneAbs(art, s) {
  const R = art.getBoundingClientRect(); const out = { ...(s.fxm || {}) };
  art.querySelectorAll('.sh-slide-t > [data-fx-name]').forEach((n) => {
    const el = FX_KEY[n.dataset.fxName]; if (!el) return;
    const old = out[el] || {};
    // yazılarda kutunun değil yazının kendi genişliği (ortalı başlık da yerinde kalır, tutamaçlar yazının hemen yanında olur)
    const tn = [...n.childNodes].filter((x) => x.nodeType === 3 && x.textContent.trim());
    let tr = null; if (tn.length) { const rg = n.ownerDocument.createRange(); rg.setStartBefore(tn[0]); rg.setEndAfter(tn[tn.length - 1]); tr = rg.getBoundingClientRect(); }
    const sc0 = (s.fxm?.[el] || s.fx?.[el] || {}).s || 1;
    const wpx = tr && tr.width ? tr.width / sc0 + 4 : n.offsetWidth;
    const wf = Math.round((wpx / R.width) * 10000) / 10000;
    // zaten oranlı: sadece genişliği sabitle (yoksa yer değişince satırlar değişiyordu); ortalı eski kayıt sol kenara çevrilir
    if (old.ax != null) {
      if (old.w == null) { const rr = n.getBoundingClientRect(); const lx = tr && tr.width ? (tr.left + tr.width / 2 - R.left) - wpx / 2 : rr.left + rr.width / 2 - R.left - n.offsetWidth / 2; out[el] = { ...old, w: wf, ax: Math.round((lx / R.width) * 10000) / 10000, c: undefined }; }
      return;
    }
    const r = n.getBoundingClientRect(); const cx = r.left + r.width / 2 - R.left, cy = r.top + r.height / 2 - R.top;
    const f = s.fxm?.[el] || s.fx?.[el] || {};
    // ortalı yazılar ortasından, diğerleri sol kenarından tutturulur (genişlik telefonla değişse de hizası bozulmasın)
    const lx = tr && tr.width ? (tr.left + tr.width / 2 - R.left) - wpx / 2 : cx - n.offsetWidth / 2;
    out[el] = { s: f.s, r: f.r, rx: f.rx, ry: f.ry, w: wf, ax: Math.round((lx / R.width) * 10000) / 10000, ay: Math.round(((cy - n.offsetHeight / 2) / R.height) * 10000) / 10000 };
  });
  // boş alanları at (kayıt düşmesin)
  for (const k of Object.keys(out)) if (out[k]) out[k] = Object.fromEntries(Object.entries(out[k]).filter(([, v]) => v !== undefined));
  return out;
}
// Firebase önizleme adresi (erteltoptan--kanal-….web.app): veriler canlıyla ortak olduğu için orada Yayınla kapalı
const PREVIEW = typeof location !== 'undefined' && /--/.test(location.hostname);

export function ShopDesigner() {
  const { settings, designDraft, api: A } = useStore();
  const d = designDraft || prepare(settings);
  const baseObj = useMemo(() => prepare(settings), [settings]);
  const base = useMemo(() => JSON.stringify(baseObj), [baseObj]);
  const dirty = !!designDraft && JSON.stringify(designDraft) !== base;
  const [sel, setSel] = useState(null);   // açık ayar paneli
  const [pick, setPick] = useState(null); // telefonda dokunarak seçilen
  const mobile = useMobile();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [dev, setDevS] = useState(() => ls.get('dz-dev', 'desk'));
  // telefon önizleme genişliği (1.11.2026): kullanıcının telefonuyla birebir görmek için (15/16 Pro Max = 430 px)
  const [pw, setPwS] = useState(() => Number(ls.get('dz-pw', 430)) || 430);
  const setPw = (v) => { setPwS(v); ls.set('dz-pw', v); };
  const setDev = (v) => { setDevS(v); ls.set('dz-dev', v); };
  const [peek, setPeek] = useState(null); // üzerine gelince deneme: {path, v}
  const [guide, setGuide] = useState(null);
  const [cmd, setCmd] = useState(false);
  const [vers, setVers] = useState(false);
  const hist = useRef({ list: [], redo: [], t: 0 });
  const [, bump] = useState(0);
  const heroI = useRef(0); const heroGo = useRef(new Set());
  const wins = useRef({});
  const H = d.shopHome;

  const anchor = useRef(null);
  const selRef = useRef(null); selRef.current = sel;
  const pickRef = useRef(null); pickRef.current = pick;
  const docs = () => (mobile ? [document] : Object.values(wins.current).filter((w) => w && !w.closed && w.document).map((w) => w.document));
  // her değişiklik geri alınabilir (sürükleme gibi art arda gelenler tek adım sayılır)
  const set = (path, v) => {
    const cur = store.s.designDraft || prepare(store.s.settings);
    const now = Date.now();
    if (now - hist.current.t > 600) { hist.current.list.push({ d: cur, n: nameOf(path) }); if (hist.current.list.length > 80) hist.current.list.shift(); hist.current.redo = []; }
    hist.current.t = now;
    // ekran sabit kalsın: düzenlenen bölümün ekrandaki yeri ölçülür, çizim sonrası her önizlemede aynı yere geri getirilir
    const ak = selRef.current?.kind === 'blk' ? selRef.current.k : pickRef.current?.kind === 'blk' ? pickRef.current.k : null;
    anchor.current = docs().map((doc) => { const el = ak ? doc.querySelector(`.dz-blk[data-k="${CSS.escape(ak)}"]`) : null; return { doc, k: el ? ak : null, top: el ? el.getBoundingClientRect().top : 0, docH: doc.documentElement.scrollHeight }; });
    setPeek(null);
    store.set({ designDraft: setPath(cur, path, v) });
  };
  useLayoutEffect(() => {
    const list = anchor.current; anchor.current = null; if (!list) return;
    for (const a of list) {
      const doc = a.doc; const win = doc.defaultView; if (!win) continue;
      const cv = doc.querySelector('.dz-canvas'); const shrink = a.docH - doc.documentElement.scrollHeight;
      if (cv && shrink > 0) cv.style.minHeight = cv.offsetHeight + shrink + 'px';
      if (!a.k) continue;
      const el = doc.querySelector(`.dz-blk[data-k="${CSS.escape(a.k)}"]`); if (!el) continue;
      const dy = el.getBoundingClientRect().top - a.top; if (Math.abs(dy) > 1) win.scrollBy(0, dy);
    }
  }, [designDraft]);
  const undo = () => { const h = hist.current; const prev = h.list.pop(); if (!prev) return; h.redo.push({ d: store.s.designDraft || prepare(store.s.settings), n: prev.n }); store.set({ designDraft: prev.d }); h.t = 0; toast('Geri alındı: ' + prev.n); bump((x) => x + 1); };
  const redo = () => { const h = hist.current; const nx = h.redo.pop(); if (!nx) return; h.list.push({ d: store.s.designDraft || prepare(store.s.settings), n: nx.n }); store.set({ designDraft: nx.d }); h.t = 0; toast('Yeniden yapıldı: ' + nx.n); bump((x) => x + 1); };

  async function save() {
    if (PREVIEW) { toast('Bu bir önizleme adresi: Yayınla kapalı (veriler canlı mağazayla ortak). Beğenirseniz yeni sürüm canlıya alınınca yayınlarsınız.', 'bad'); return; }
    setBusy(true);
    try {
      // yayından önceki hâl sürüm geçmişine (bu bilgisayarda, son 12)
      try { const prev = { at: Date.now(), shopHome: baseObj.shopHome, look: baseObj.look, brandLogos: baseObj.brandLogos }; ls.set(VERS_KEY, [prev, ...ls.get(VERS_KEY, [])].slice(0, 12)); } catch {}
      // boş (undefined) alanlar atılır: Firestore kabul etmiyor
    const clean = withProdFallback(withDefaults(JSON.parse(JSON.stringify(store.s.designDraft)))); store.set({ settings: clean, designDraft: null }); hist.current = { list: [], redo: [], t: 0 }; toast('Mağaza tasarımı yayınlandı'); queueSave('settings', () => A.saveSettings(store.s.settings));
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const discard = () => setConfirm({ title: 'Değişiklikleri at', text: 'Yayınlanmamış tasarım değişiklikleri silinecek, mağazanın şu anki hâline dönülecek.', okLabel: 'At', tone: 'danger', onOk: () => { store.set({ designDraft: null }); hist.current = { list: [], redo: [], t: 0 }; setSel(null); } });

  const L = H.layout;
  const setL = (n) => set('shopHome.layout', n);
  const select = (kind, i) => {
    if (kind === 'promo' && i === -1) { const n = [...(H.promos || []), NEW.promo()]; set('shopHome.promos', n); (mobile ? setPick : setSel)({ kind: 'promo', i: n.length - 1 }); return; }
    if (kind === 'brand' && i === -1) { setSel({ kind: 'brand', i: -1 }); return; }
    const v = kind === 'brand' || kind === 'promo' ? { kind, i } : { kind: 'blk', k: kind };
    if (mobile) setPick(v); else setSel(v);
  };
  const tapBlock = (k) => (mobile ? setPick({ kind: 'blk', k }) : setSel((s) => (s?.kind === 'fx' && k === 'hero' ? s : { kind: 'blk', k })));
  // seçilen bölüme önizlemelerde kaydır ve kısa parlat
  const reveal = (k) => docs().forEach((doc) => { const el = doc.querySelector(`.dz-blk[data-k="${CSS.escape(k)}"]`); if (!el) return; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.remove('dz-flash'); void el.offsetWidth; el.classList.add('dz-flash'); });
  function addBlock(at, type) {
    let key;
    if (type === 'rail') { const r = NEW.rail(); set('shopHome.sections', [...H.sections, r]); key = 'rail:' + r.id; }
    else { const id = rid(); set('shopHome.blocks', { ...H.blocks, [id]: type === 'banner' ? { t: 'banner', img: '', link: '', h: 0 } : type === 'video' ? { t: 'video', vids: [{ src: '' }], ratio: '16:9', wp: 100, pos: 0.5, title: '' } : type === 'rate' ? { t: 'rate', pos: 1, sc: 1, style: 'soft' } : { t: 'head', title: 'Yeni başlık', sub: '', align: 'left', size: 'md' } }); key = 'b:' + id; }
    const n = [...(get('layout') || L)]; n.splice(at, 0, key); setL(n); if (mobile) setPick({ kind: 'blk', k: key }); setSel({ kind: 'blk', k: key });
    setTimeout(() => reveal(key), 150);
  }
  function removeBlock(k) {
    if (k.startsWith('rail:')) set('shopHome.sections', H.sections.filter((r) => 'rail:' + r.id !== k));
    else { const b = { ...H.blocks }; delete b[k.slice(2)]; set('shopHome.blocks', b); }
    setL(get('layout').filter((x) => x !== k)); setSel(null); setPick(null); toast('Bölüm silindi · Ctrl Z ile geri alabilirsiniz');
  }
  // özel bölümü (raf, başlık, bant, video, kur) çoğalt
  function dupBlock(k) {
    let key;
    if (k.startsWith('rail:')) { const r = H.sections.find((x) => 'rail:' + x.id === k); if (!r) return; const n = { ...structuredClone(r), id: rid() }; set('shopHome.sections', [...H.sections, n]); key = 'rail:' + n.id; }
    else if (k.startsWith('b:')) { const b = H.blocks[k.slice(2)]; if (!b) return; const id = rid(); set('shopHome.blocks', { ...H.blocks, [id]: structuredClone(b) }); key = 'b:' + id; }
    else return;
    const lay = get('layout'); const n = [...lay]; n.splice(lay.indexOf(k) + 1, 0, key); setL(n); setSel({ kind: 'blk', k: key }); toast('Bölüm çoğaltıldı');
  }
  const toggleHide = (k) => { const h = new Set(get('hidden') || []); h.has(k) ? h.delete(k) : h.add(k); set('shopHome.hidden', [...h]); };
  const goSlide = (i) => { heroI.current = i; heroGo.current.forEach((f) => f(i)); };
  // reklam kutusunun önizlemelerdeki gerçek ölçüsü (px): ölçü rehberi için
  const measure = (i) => { const out = {}; for (const [k, w] of Object.entries(wins.current)) { try { const el = w?.document?.querySelectorAll('.sh-hero .sh-slide')[i]; if (el) { const r = el.getBoundingClientRect(); if (r.width) out[k] = { w: Math.round(r.width), h: Math.round(r.height) }; } } catch {} } return out; };

  const get = (k) => (store.s.designDraft || prepare(store.s.settings)).shopHome[k];
  // reklam içindeki öğeyi sürükleyerek taşı (ortaya ve ilk yerine mıknatısla yapışır); hiç kımıldamazsa seç
  // Canva gibi hizalama mıknatısı (1.11.2026): sürüklenen öğenin sol / orta / sağ (ve üst / orta / alt) kenarı reklamdaki
  // diğer öğelerin kenarlarına ya da reklamın ortasına 6 px yaklaşınca oraya yapışır, pembe kesik çizgi gösterilir. Alt = serbest.
  const snapSet = (art, node, extraX = [], extraY = []) => {
    const R = art.getBoundingClientRect(); const xs = extraX.map((t) => ({ t, c: 1 })), ys = extraY.map((t) => ({ t, c: 1 }));
    art.querySelectorAll('[data-fx-name]').forEach((n) => {
      if (n === node || n.contains(node) || node.contains(n)) return; const r = n.getBoundingClientRect(); if (!r.width || !r.height) return;
      xs.push({ t: r.left - R.left }, { t: r.left + r.width / 2 - R.left }, { t: r.right - R.left });
      ys.push({ t: r.top - R.top }, { t: r.top + r.height / 2 - R.top }, { t: r.bottom - R.top });
    });
    return { xs, ys };
  };
  // a: sürüklenen öğenin [sol, orta, sağ]; c: 1 olan hedefler (reklam ortası) sadece ortayla eşleşir
  const snapAxis = (a, list, th = 6) => {
    let best = null;
    for (const g of list) for (let i = 0; i < 3; i++) { if (g.c && i !== 1) continue; const d = g.t - a[i]; if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d) - 0.5)) best = { d, t: g.t }; }
    return best;
  };
  const fxDrag = (e, slide, el) => {
    if (e.button > 0) return;
    e.stopPropagation(); e.preventDefault();
    const node = e.currentTarget; const art = node.closest('.sh-slide'); const w = winOf(e);
    if (w.innerWidth <= 700) return fxDragPhone(e, slide, el, node, art, w);
    const fk = parseFloat(w.getComputedStyle(art).getPropertyValue('--fxk')) || 1;
    const R = art.getBoundingClientRect(); const r0 = node.getBoundingClientRect();
    // telefon çerçevesinde sürüklenince telefona özel konum (fxm) yazılır; bilgisayardaki yerinden bağımsız
    const phone = w.innerWidth <= 700; const key = phone ? 'fxm' : 'fx'; const sl0 = get('slides')[slide] || {};
    const fd = sl0.fx?.[el] || {};
    const f0 = phone ? (sl0.fxm?.[el] || { ...fd, x: Math.round((fd.x || 0) * fk), y: Math.round((fd.y || 0) * fk) }) : fd;
    const k = phone ? 1 : fk; const dev = phone ? 'm' : '';
    const x0 = e.clientX, y0 = e.clientY; let moved = false;
    const c0x = r0.left + r0.width / 2 - R.left, c0y = r0.top + r0.height / 2 - R.top;
    const homeX = c0x - (f0.x || 0) * k, homeY = c0y - (f0.y || 0) * k;
    const SN = snapSet(art, node, [R.width / 2, homeX], [R.height / 2, homeY]); const hw = r0.width / 2, hh = r0.height / 2;
    onDrag(e, (ev) => {
      let dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; w.document.body.classList.add('dz-dragging'); setSel({ kind: 'fx', slide, el, dev }); }
      const gv = [], gh = [];
      if (!ev.altKey) {
        const bx = snapAxis([c0x + dx - hw, c0x + dx, c0x + dx + hw], SN.xs); if (bx) { dx += bx.d; gv.push(Math.round(bx.t)); }
        const by = snapAxis([c0y + dy - hh, c0y + dy, c0y + dy + hh], SN.ys); if (by) { dy += by.d; gh.push(Math.round(by.t)); }
      }
      setGuide(gv.length || gh.length ? { k: slide, v: gv, h: gh } : null);
      const sl = get('slides'); if (!sl[slide]) return;
      set('shopHome.slides', sl.map((x, j) => (j === slide ? { ...x, [key]: { ...(x[key] || {}), [el]: { ...f0, x: Math.round((f0.x || 0) + dx / k), y: Math.round((f0.y || 0) + dy / k) } } } : x)));
    }, () => { setGuide(null); if (!moved) setSel({ kind: 'fx', slide, el, dev }); });
  };
  // telefonda: reklamdaki yazı öğelerinin hepsi kutuya oranla (%) yerleştirilir, sürüklenen öğe taşınır → her telefon boyunda aynı düzen
  const fxDragPhone = (e, slide, el, node, art, w) => {
    const R = art.getBoundingClientRect(); const r0 = node.getBoundingClientRect();
    const base = phoneAbs(art, get('slides')[slide] || {});
    const ow = node.offsetWidth, oh = node.offsetHeight;
    const cx = r0.left + r0.width / 2 - R.left, cy = r0.top + r0.height / 2 - R.top;
    const x0 = e.clientX, y0 = e.clientY; let moved = false;
    const SN = snapSet(art, node, [R.width / 2], [R.height / 2]); const hw = r0.width / 2, hh = r0.height / 2;
    onDrag(e, (ev) => {
      let dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; w.document.body.classList.add('dz-dragging'); setSel({ kind: 'fx', slide, el, dev: 'm' }); }
      const gv = [], gh = [];
      if (!ev.altKey) {
        const bx = snapAxis([cx + dx - hw, cx + dx, cx + dx + hw], SN.xs, 5); if (bx) { dx += bx.d; gv.push(Math.round(bx.t)); }
        const by = snapAxis([cy + dy - hh, cy + dy, cy + dy + hh], SN.ys, 5); if (by) { dy += by.d; gh.push(Math.round(by.t)); }
      }
      setGuide(gv.length || gh.length ? { k: slide, v: gv, h: gh } : null);
      const ax = Math.min(0.97, Math.max(-0.3, (cx + dx - ow / 2) / R.width)), ay = Math.min(0.97, Math.max(-0.1, (cy + dy - oh / 2) / R.height));
      const sl = get('slides'); if (!sl[slide]) return;
      set('shopHome.slides', sl.map((x, j) => (j === slide ? { ...x, fxm: { ...base, [el]: { ...(base[el] || {}), ax: Math.round(ax * 10000) / 10000, ay: Math.round(ay * 10000) / 10000 } } } : x)));
    }, () => { setGuide(null); if (!moved) setSel({ kind: 'fx', slide, el, dev: 'm' }); });
  };
  // yazı öğesinin genişliği: kenar tutamacıyla (telefonda kutunun oranı, bilgisayarda px); sol tutamaçta sağ kenar yerinde kalır
  const fxResize = (e, slide, el, side) => {
    if (e.button > 0) return; e.stopPropagation(); e.preventDefault();
    const w = winOf(e); const node = e.currentTarget.parentElement; const art = node.closest('.sh-slide');
    const R = art.getBoundingClientRect(); const x0 = e.clientX; const sl0 = get('slides')[slide] || {};
    if (w.innerWidth <= 700) {
      const base = phoneAbs(art, sl0); const b = base[el]; if (!b) return; const sc = b.s || 1;
      onDrag(e, (ev) => {
        const dx = (ev.clientX - x0) / sc; const nwpx = Math.max(40, b.w * R.width + (side === 'r' ? dx : -dx)); const nw = nwpx / R.width;
        const sl = get('slides');
        set('shopHome.slides', sl.map((x, j) => (j === slide ? { ...x, fxm: { ...base, [el]: { ...b, w: Math.round(nw * 10000) / 10000, ax: side === 'l' ? Math.round((b.ax + b.w - nw) * 10000) / 10000 : b.ax } } } : x)));
      });
    } else {
      const f0 = sl0.fx?.[el] || {}; const w0 = f0.w || node.offsetWidth; const fk = parseFloat(w.getComputedStyle(art).getPropertyValue('--fxk')) || 1; const sc = f0.s || 1;
      onDrag(e, (ev) => {
        const dx = (ev.clientX - x0) / sc; const nw = Math.max(60, Math.round(w0 + (side === 'r' ? dx : -dx)));
        const sl = get('slides');
        set('shopHome.slides', sl.map((x, j) => (j === slide ? { ...x, fx: { ...(x.fx || {}), [el]: { ...f0, w: nw, ...(side === 'l' ? { x: Math.round((f0.x || 0) + (w0 - nw) / fk) } : {}) } } } : x)));
      });
    }
  };
  // tam resim reklamında resmi sürükleyerek odak noktasını kaydır (telefon çerçevesinde telefon ayarı)
  const imDrag = (e, slide) => {
    if (e.button > 0) return; e.preventDefault(); // sürüklerken yazılar seçilmesin
    const box = e.currentTarget; const img = box.querySelector('.sh-bg-main');
    const x0 = e.clientX, y0 = e.clientY; const phone = winOf(e).innerWidth <= 700; const sfx = phone ? 'm' : '';
    const im0 = get('slides')[slide]?.im || {};
    const v0 = (k, dd) => Number((phone ? im0[k + 'm'] ?? im0[k] : im0[k]) ?? dd);
    const z = v0('z', 1), px = v0('x', 50), py = v0('y', 50);
    const r = box.getBoundingClientRect(); const nw = img?.naturalWidth || r.width, nh = img?.naturalHeight || r.height;
    const sc = (im0.f === 'contain' ? Math.min : Math.max)(r.width / nw, r.height / nh);
    const kx = r.width - z * nw * sc, ky = r.height - z * nh * sc;
    let moved = false;
    onDrag(e, (ev, w) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; w.document.body.classList.add('dz-dragging'); setSel({ kind: 'blk', k: 'hero', focus: 'frame' }); }
      const nx = Math.abs(kx) > 8 ? Math.min(100, Math.max(0, px + (dx / kx) * 100)) : px;
      const ny = Math.abs(ky) > 8 ? Math.min(100, Math.max(0, py + (dy / ky) * 100)) : py;
      const sl = get('slides');
      set('shopHome.slides', sl.map((x, j) => (j === slide ? { ...x, im: { ...(x.im || {}), ['x' + sfx]: Math.round(nx), ['y' + sfx]: Math.round(ny), ...(phone && (x.im || {}).zm == null ? { zm: z } : {}) } } : x)));
    }, (ev, w) => { if (moved) w.addEventListener('click', (x) => { x.stopPropagation(); x.preventDefault(); }, { capture: true, once: true }); });
  };
  // bölüme sağ tık: hızlı işlemler (çerçeve içindeki konum ekrana çevrilir)
  const blockMenu = (e, k) => {
    const w = winOf(e); const fr = w.frameElement; let X = e.clientX, Y = e.clientY;
    if (fr) { const r = fr.getBoundingClientRect(); const s = r.width / w.innerWidth; X = r.left + e.clientX * s; Y = r.top + e.clientY * s; }
    const lay = get('layout'); const i = lay.indexOf(k); const custom = k.startsWith('rail:') || k.startsWith('b:'); const hidden = (get('hidden') || []).includes(k);
    openMenu({ type: 'contextmenu', clientX: X, clientY: Y, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation() }, [
      { label: 'Ayarlarını aç', icon: 'gear', onClick: () => setSel({ kind: 'blk', k }) },
      { label: 'Yukarı taşı', icon: 'up', disabled: i <= 0, onClick: () => setL(moveItem(lay, i, i - 1)) },
      { label: 'Aşağı taşı', icon: 'down', disabled: i >= lay.length - 1, onClick: () => setL(moveItem(lay, i, i + 1)) },
      { label: hidden ? 'Göster' : 'Gizle', icon: hidden ? 'eye' : 'eyeoff', onClick: () => toggleHide(k) },
      custom && { label: 'Çoğalt', icon: 'copy', hint: 'Ctrl D', onClick: () => dupBlock(k) },
      custom && '-',
      custom && { label: 'Sil', icon: 'trash', danger: true, hint: 'Del', onClick: () => removeBlock(k) },
    ], blockLabel(k, H));
  };

  // klavye: Ctrl K ara, Ctrl Z / Ctrl Y, Esc, Del sil, Ctrl D çoğalt, oklar ile reklam öğesini kaydır
  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (mobile) return;
    const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey; const k = (e.key || '').toLowerCase();
    if (mod && k === 'k') { e.preventDefault(); setCmd(true); return; }
    if (typing || store.s.ctx) return;
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') { setSel(null); setCmd(false); return; }
    const s = selRef.current; if (!s) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && s.kind === 'blk' && (s.k.startsWith('rail:') || s.k.startsWith('b:'))) { e.preventDefault(); removeBlock(s.k); return; }
    if (mod && k === 'd' && s.kind === 'blk') { e.preventDefault(); dupBlock(s.k); return; }
    if (s.kind === 'fx' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); const st = e.shiftKey ? 10 : 1; const sl = get('slides'); const key = s.dev === 'm' ? 'fxm' : 'fx';
      const am = sl[s.slide]?.fxm?.[s.el];
      if (key === 'fxm' && am?.ax != null) { const ddx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, ddy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0; set('shopHome.slides', sl.map((x, j) => (j === s.slide ? { ...x, fxm: { ...x.fxm, [s.el]: { ...am, ax: Math.round((am.ax + ddx / 358) * 10000) / 10000, ay: Math.round((am.ay + ddy / 470) * 10000) / 10000 } } } : x))); return; }
      const fd = sl[s.slide]?.fx?.[s.el] || {}; const f = key === 'fxm' ? (sl[s.slide]?.fxm?.[s.el] || { ...fd, x: Math.round((fd.x || 0) * 0.5), y: Math.round((fd.y || 0) * 0.5) }) : fd;
      const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
      set('shopHome.slides', sl.map((x, j) => (j === s.slide ? { ...x, [key]: { ...(x[key] || {}), [s.el]: { ...f, x: (f.x || 0) + dx, y: (f.y || 0) + dy } } } : x)));
    }
  };
  useEffect(() => { const k = (e) => keyRef.current(e); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  useEffect(() => { if (!dirty) return; const h = (e) => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', h); return () => removeEventListener('beforeunload', h); }, [dirty]);
  // eski (piksel) telefon yerleşimlerini otomatik orana çevir: telefon çerçevesi hazır olunca ölç ve taslağa yaz
  const migrate = (w) => {
    const sl = get('slides') || []; const need = sl.map((x, i) => (x.fxm && Object.entries(x.fxm).some(([k, v]) => v && v.ax == null && k !== 'art') ? i : -1)).filter((i) => i >= 0);
    if (!need.length) return;
    const arts = w.document.querySelectorAll('.sh-hero .sh-slide'); if (!arts.length) return;
    const n = sl.map((x, i) => (need.includes(i) && arts[i] ? { ...x, fxm: phoneAbs(arts[i], x) } : x));
    set('shopHome.slides', n); toast('Telefondaki yerleşim her telefon boyuna uyacak şekilde çevrildi. Kontrol edip Yayınla deyin.');
  };
  const onFrame = (name) => (w) => { wins.current[name] = w; w.addEventListener('keydown', (e) => keyRef.current(e)); if (name === 'phone') setTimeout(() => migrate(w), 1200); };
  // eski yerleşim varsa telefon görünümü açılsın (çevirme telefonda ölçülerek yapılır)
  useEffect(() => { if (mobile) return; const sl = (store.s.designDraft || prepare(store.s.settings)).shopHome.slides || []; if (dev === 'desk' && sl.some((x) => x.fxm && Object.entries(x.fxm).some(([k, v]) => v && v.ax == null && k !== 'art'))) setDev('both'); }, []);
  useEffect(() => { document.documentElement.classList.toggle('dz2-open', !mobile); return () => document.documentElement.classList.remove('dz2-open'); }, [mobile]);

  // tema stüdyosu tasarımda tarihten bağımsız önizlenir
  const pack = useMemo(() => { const lk = (peek?.path === 'look.pack' ? { ...d.look, pack: peek.v } : d.look) || {}; return lk.pack?.id ? activePack({ ...lk, pack: { ...lk.pack, from: '', to: '' } }) : null; }, [d.look, peek]);
  const E = { H, L, get, fxDrag, fxResize, imDrag, mobile, sel: mobile ? pick : sel, tapBlock, setSel, select, set, setL, toggleHide, removeBlock, addBlock, heroI, heroGo: heroGo.current, guide, pack, blockMenu: mobile ? null : blockMenu, Block: DzBlock, HeroTools: DzHeroTools };
  const view = useMemo(() => withDefaults(peek ? setPath(d, peek.path, peek.v) : d), [d, peek]);
  // değişen bölümler (Yayınla düğmesinin yanında)
  const changes = useMemo(() => {
    if (!dirty) return [];
    const out = new Set();
    for (const k of new Set([...Object.keys(d.shopHome || {}), ...Object.keys(baseObj.shopHome || {})])) if (JSON.stringify(d.shopHome?.[k]) !== JSON.stringify(baseObj.shopHome?.[k])) out.add(PATH_NAMES[k] || 'Tasarım');
    if (JSON.stringify(d.look?.pack) !== JSON.stringify(baseObj.look?.pack) || JSON.stringify(d.look?.myPacks) !== JSON.stringify(baseObj.look?.myPacks)) out.add('Tema Stüdyosu');
    if (['shopAccent', 'shopPrice', 'bg', 'cardR', 'decor'].some((k) => JSON.stringify(d.look?.[k]) !== JSON.stringify(baseObj.look?.[k]))) out.add('Sayfa renkleri');
    if (JSON.stringify(d.brandLogos) !== JSON.stringify(baseObj.brandLogos)) out.add('Marka logoları');
    return [...out];
  }, [d, baseObj, dirty]);

  const P = { measure, get, sel, d, H, set, setSel, heroI, goSlide, removeBlock, dupBlock, setPeek, L, setL, toggleHide, reveal, pack, openVers: () => setVers(true) };

  if (mobile) return (
    <div className={'page dz-page dz-mobile' + (sel ? ' has-panel' : '') + (pick ? ' has-pick' : '')}>
      <div className="dz-top">
        <span className="dz-title"><Icon n="brush" s={18} /><b>Tasarım modu</b><small>Bir bölüme ya da kutuya dokunun, alttaki düğmelerle düzenleyin</small></span>
        <button className="btn sm ghost" onClick={undo} disabled={!hist.current.list.length}><Icon n="undo" s={15} />Geri al</button>
        {dirty && <button className="btn sm ghost" onClick={discard}>Vazgeç</button>}
        <button className="btn sm primary" onClick={save} disabled={busy || !dirty}><Icon n="check" s={15} />{busy ? 'Yayınlanıyor…' : dirty ? 'Yayınla' : 'Yayında'}</button>
      </div>
      <div className="dz-canvas w-full">
        <DesignCtx.Provider value={E}><ShopHome S={view} /></DesignCtx.Provider>
      </div>
      {pick && !sel && <MobileBar pick={pick} setPick={setPick} H={H} d={d} set={set} setSel={setSel} L={L} setL={setL} toggleHide={toggleHide} removeBlock={removeBlock} addBlock={addBlock} />}
      {sel && <aside className="dz-panel dz2-sheet" aria-label="Seçilen öğenin ayarları"><Inspector {...P} close={() => setSel(null)} /></aside>}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );

  return (
    <div className="dz2">
      <div className="dz2-top">
        <button className="dz2-ib" onClick={() => go('ayarlar')} title="Tasarım modundan çık (taslak kaybolmaz)"><Icon n="back" s={18} /></button>
        <span className="dz2-title"><b>Tasarım modu</b><small>{PREVIEW ? 'Önizleme · yayın kapalı' : 'Mağaza ana sayfası' + (dirty ? ' · taslak' : '')}</small></span>
        <span className="dz2-dev" role="group" aria-label="Önizleme">
          {[['desk', 'monitor', 'Bilgisayar'], ['phone', 'mobile', 'Telefon'], ['both', 'grid', 'Yan yana']].map(([k, ic, l]) => <button key={k} className={dev === k ? 'on' : ''} onClick={() => setDev(k)}><Icon n={ic} s={16} /><span>{l}</span></button>)}
        </span>
        {dev !== 'desk' && <select className="dz2-pw" value={pw} onChange={(e) => setPw(Number(e.target.value))} title="Önizlemedeki telefonun genişliği">
          {PHONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>}
        <span className="dz2-sp" />
        <button className="dz2-ib" onClick={undo} disabled={!hist.current.list.length} title={hist.current.list.length ? 'Geri al: ' + hist.current.list.at(-1).n + ' (Ctrl Z)' : 'Geri al (Ctrl Z)'}><Icon n="undo" s={17} /></button>
        <button className="dz2-ib" onClick={redo} disabled={!hist.current.redo.length} title="Yeniden yap (Ctrl Y)"><Icon n="undo" s={17} className="dz2-flipx" /></button>
        <button className="dz2-search" onClick={() => setCmd(true)}><Icon n="search" s={15} /><span>Ayar ara</span><kbd>Ctrl K</kbd></button>
        <button className="dz2-ib" onClick={() => setVers(true)} title="Sürüm geçmişi"><Icon n="clock" s={17} /></button>
        <a className="dz2-ib" href="/" target="_blank" rel="noopener" title="Mağazayı yeni sekmede aç"><Icon n="ext" s={17} /></a>
        {dirty && <span className="dz2-changes" tabIndex={0}><i>{changes.length}</i>değişiklik<span className="dz2-changes-l">{changes.map((c) => <span key={c}>{c}</span>)}</span></span>}
        {dirty && <button className="btn sm ghost" onClick={discard}>Vazgeç</button>}
        <button className={'btn sm primary dz2-pub' + (dirty ? ' live' : '')} onClick={save} disabled={busy || !dirty}><Icon n="check" s={15} />{busy ? 'Yayınlanıyor…' : dirty ? 'Yayınla' : 'Yayında'}</button>
      </div>
      <div className="dz2-body">
        <Layers {...P} addBlock={addBlock} blockMenu={blockMenu} />
        <Stage dev={dev} pw={pw} view={view} E={E} d={d} pack={pack} onFrame={onFrame} />
        <aside className="dz2-insp" aria-label="Ayarlar"><Inspector key={sel ? JSON.stringify([sel.kind, sel.k, sel.i, sel.slide, sel.el]) : 'page'} {...P} close={() => setSel(null)} /></aside>
      </div>
      {cmd && <CommandK close={() => setCmd(false)} P={P} setDev={setDev} addBlock={addBlock} undo={undo} />}
      {vers && <Versions close={() => setVers(false)} />}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function useMobile() {
  const q = '(max-width: 800px), (pointer: coarse)';
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener?.('change', f); return () => mq.removeEventListener?.('change', f); }, []);
  return m;
}

// ---- Orta alan: gerçek genişlikte önizleme çerçeveleri ---------------------------------------------------------------------
const PHONES = [[430, 'iPhone 15/16 Pro Max · 430'], [393, 'iPhone 15/16 Pro · 393'], [390, 'iPhone 13/14 · 390'], [375, 'iPhone SE / mini · 375'], [412, 'Android · 412'], [360, 'Küçük Android · 360']];
function Stage({ dev, pw = 430, view, E, d, pack, onFrame }) {
  const ref = useRef(null); const { w, h } = useSize(ref);
  const L = view.look || {}; const pp = pack?.palette;
  const vars = {
    '--accent-user': pp?.accent || L.shopAccent || view.brand?.accent, '--price-user': pp?.price || L.shopPrice || view.brand?.priceAccent,
    '--bg-user': (pp ? pp.bg || L.bg : L.bg) || '', '--pcard-r': (Number(L.cardR) >= 0 && L.cardR !== '' && L.cardR != null ? Number(L.cardR) : 18) + 'px', '--top-h': '0px',
    '--pk-badge': pack?.badge?.text ? JSON.stringify(pack.badge.text) : '', '--pk-bbg': pack?.badge?.bg || '', '--pk-bfg': pack?.badge?.color || '',
  };
  const inner = (kind) => (
    <div className={'shell public tab-anasayfa dz-fshell' + (pack?.badge?.text ? ' pk-on' : '')}>
      <main className={'main dz-canvas w-' + (kind === 'phone' ? 'phone' : 'full')}>
        <section className="kp"><DesignCtx.Provider value={E}><ShopHome S={view} /></DesignCtx.Provider></section>
      </main>
      <PackDecor pk={pack} />
    </div>
  );
  const both = dev === 'both';
  const H0 = Math.max(320, h - 44);
  const deskAvail = both ? w - pw - 100 : w - 48;
  return (
    <div className={'dz2-stage dev-' + dev} ref={ref}>
      {w > 0 && dev !== 'phone' && <DeviceFrame key="desk" kind="desk" width={1280} availW={deskAvail} height={H0} rootVars={vars} theme={view.brand?.theme} onReady={onFrame('desk')} label={'Bilgisayar · 1280 px' + (deskAvail < 1280 ? ' · %' + Math.round((deskAvail / 1280) * 100) + ' küçültülmüş' : '')}>{inner('desk')}</DeviceFrame>}
      {w > 0 && dev !== 'desk' && <div className="dz2-phone"><DeviceFrame key="phone" kind="phone" width={pw} height={Math.min(H0 - 76, Math.round(pw * 2.0))} rootVars={vars} theme={view.brand?.theme} onReady={onFrame('phone')} label={'Telefon · ' + pw + ' px'}>{inner('phone')}</DeviceFrame></div>}
    </div>
  );
}

// ---- Sol: Katmanlar ------------------------------------------------------------------------------------------------------
const LAYER_IC = { hero: 'image', usps: 'check', marquee: 'star', brands: 'grid', promos: 'grid', fav: 'heart', sets: 'box', cta: 'wa' };
function Layers({ get, H, L, setL, sel, setSel, toggleHide, reveal, addBlock, blockMenu }) {
  const [adding, setAdding] = useState(false);
  const hidden = new Set(H.hidden || []);
  const ic = (k) => LAYER_IC[k] || (k.startsWith('rail:') ? 'list' : H.blocks?.[k.slice(2)]?.t === 'video' ? 'play' : H.blocks?.[k.slice(2)]?.t === 'banner' ? 'image' : H.blocks?.[k.slice(2)]?.t === 'rate' ? 'tag' : 'edit');
  const on = (k) => (sel?.kind === 'blk' && sel.k === k) || (sel?.kind === 'fx' && k === 'hero') || (sel?.kind === 'brand' && k === 'brands') || (sel?.kind === 'promo' && k === 'promos');
  return (
    <aside className="dz2-layers" aria-label="Katmanlar">
      <div className="dz2-lh">Sayfa</div>
      <button className={'dz2-ly page' + (!sel ? ' on' : '')} onClick={() => setSel(null)}><Icon n="palette" s={16} /><span className="dz2-lyn">Renkler ve sayfa</span></button>
      <button className={'dz2-ly page' + (sel?.kind === 'studio' ? ' on' : '')} onClick={() => setSel({ kind: 'studio' })}><Icon n="sparkle" s={16} /><span className="dz2-lyn">Tema Stüdyosu</span></button>
      <div className="dz2-lh">Bölümler <small>tutup sürükleyin</small></div>
      <div className="dz2-lylist">
        {L.map((k, i) => (
          <div key={k} className={'dz2-ly' + (on(k) ? ' on' : '') + (hidden.has(k) ? ' hid' : '')} data-dz="lay" data-i={i} data-k={k} data-dz-name={blockLabel(k, H)} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSel({ kind: 'blk', k }); reveal(k); } }}
            onPointerDown={(e) => { if (e.target.closest('.dz2-lyb')) return; dragSort(e, 'lay', i, (f, t) => setL(moveItem(get('layout'), f, t)), () => { setSel({ kind: 'blk', k }); reveal(k); }); }}
            onContextMenu={(e) => blockMenu(e, k)}>
            <Icon n="drag" s={14} className="dz2-grip" /><Icon n={ic(k)} s={15} /><span className="dz2-lyn">{blockLabel(k, H)}</span>
            <button className="dz2-lyb" onClick={() => toggleHide(k)} title={hidden.has(k) ? 'Göster' : 'Gizle'}><Icon n={hidden.has(k) ? 'eyeoff' : 'eye'} s={14} /></button>
          </div>
        ))}
      </div>
      <div className="dz2-addw">
        <button className="dz2-add" onClick={() => setAdding(!adding)}><Icon n={adding ? 'x' : 'plus'} s={15} />{adding ? 'Kapat' : 'Bölüm ekle'}</button>
        {adding && <AddMenu side onAdd={(t) => { const at = sel?.kind === 'blk' ? L.indexOf(sel.k) + 1 : L.indexOf('cta') >= 0 ? L.indexOf('cta') : L.length; addBlock(at, t); setAdding(false); }} />}
      </div>
      <p className="dz2-tip">Sağ tık: hızlı işlemler<br />Ctrl K: ayar ara · Ctrl Z: geri al</p>
    </aside>
  );
}
const ADD_TYPES = [['head', 'Başlık', 'Büyük başlık + alt yazı'], ['rail', 'Ürün rafı', 'Yeni gelenler, marka, kategori…'], ['banner', 'Görsel bant', 'Tam genişlik resim, tıklanabilir'], ['video', 'Video', 'Yatay, kare ya da dikey'], ['rate', 'Kur kutusu', 'Güncel dolar kuru']];
function AddMenu({ onAdd, side }) {
  return <div className={'dz-add-menu' + (side ? ' dz2-addm' : '')}>{ADD_TYPES.map(([t, l, h]) => <button key={t} onClick={() => onAdd(t)}><b>{l}</b><small>{h}</small></button>)}</div>;
}

// ---- Sağ: ayar paneli (seçilen şeye göre) ---------------------------------------------------------------------------------
function Inspector(P) {
  const { sel, d, H, set, setSel, close } = P;
  const S = (k, v) => set('shopHome.' + k, v);
  let title = '', sub = '', body = null, back = null;
  if (!sel) { title = 'Renkler ve sayfa'; sub = 'Hiçbir şey seçili değilken burası açık'; body = <PagePanel {...P} />; }
  else if (sel.kind === 'studio') { title = 'Tema Stüdyosu'; sub = 'Kampanya ve sezon görünümü'; body = <StudioPanel {...P} />; }
  else if (sel.kind === 'brand') {
    if (sel.i === -1) { title = 'Marka ekle'; back = () => setSel({ kind: 'blk', k: 'brands' }); body = <AddBrand d={d} H={H} onAdd={(name) => { const n = [...(H.brands || []), NEW.brand(name)]; S('brands', n); setSel({ kind: 'brand', i: n.length - 1 }); }} />; }
    else {
      const b = H.brands[sel.i]; if (!b) return null;
      title = 'Marka kutusu'; sub = b.name || ''; back = () => setSel({ kind: 'blk', k: 'brands' });
      body = <>
        <BrandFields b={b} up={(p) => S('brands', H.brands.map((x, j) => (j === sel.i ? { ...x, ...p } : x)))} d={d} set={set} />
        <p className="fine">Kutuları sayfada tutup sürükleyerek sıralayın.</p>
        <div className="dz2-acts"><button className="btn sm ghost danger" onClick={() => { S('brands', H.brands.filter((_, j) => j !== sel.i)); close(); }}><Icon n="trash" s={15} />Kutuyu kaldır</button></div>
      </>;
    }
  } else if (sel.kind === 'fx') {
    const sl = H.slides[sel.slide]; if (!sl) return null;
    title = FX_NAMES[sel.el]; sub = (sel.slide + 1) + '. reklamın içinde'; back = () => setSel({ kind: 'blk', k: 'hero' });
    body = <FxPanel {...P} s={sl} i={sel.slide} el={sel.el} />;
  } else if (sel.kind === 'promo') {
    const x = H.promos[sel.i]; if (!x) return null;
    title = 'Reklam kutusu'; sub = x.title || String(sel.i + 1); back = () => setSel({ kind: 'blk', k: 'promos' });
    body = <>
      <PromoFields x={x} up={(p) => S('promos', H.promos.map((y, j) => (j === sel.i ? { ...y, ...p } : y)))} />
      <div className="dz2-acts">
        <button className="btn sm ghost" onClick={() => { const n = [...H.promos]; n.splice(sel.i + 1, 0, structuredClone(x)); S('promos', n); setSel({ kind: 'promo', i: sel.i + 1 }); }}><Icon n="copy" s={15} />Çoğalt</button>
        <button className="btn sm ghost danger" onClick={() => { S('promos', H.promos.filter((_, j) => j !== sel.i)); close(); }}><Icon n="trash" s={15} />Sil</button>
      </div>
    </>;
  } else {
    const k = sel.k; const lab = blockLabel(k, H).split(' · '); title = lab[0]; sub = lab[1] || '';
    if (k === 'hero') body = <HeroPanel {...P} />;
    else if (k === 'usps') body = <Rows list={H.usps || []} set={(v) => S('usps', v)} max={4} sub="Avantaj ekle" openIdx={0} title={(u, i) => u.title || `${i + 1}. avantaj`} add={() => S('usps', [...(H.usps || []), NEW.usp()])} render={(u, up) => <UspFields u={u} up={up} />} />;
    else if (k === 'marquee') body = <>
      <Field label="Görünüm"><span className="dz2-mqs">{Object.entries(MQ_STYLES).map(([x, l]) => <button key={x} type="button" className={'dz2-mq mq-' + x + ((H.marquee || 'color') === x ? ' on' : '')} onClick={() => S('marquee', x)}><i aria-hidden="true"><b /><b /><b /></i><span>{l}</span></button>)}</span></Field>
      <More>
        <Field label="Hız · bilgisayar" hint="Bir turun süresi; büyük sayı = yavaş"><span className="she-scale"><input type="range" min="15" max="200" step="1" value={Number(H.mqSpeed) || 46} onChange={(e) => S('mqSpeed', Number(e.target.value))} /><code>{Number(H.mqSpeed) || 46} sn</code></span></Field>
        <Field label="Hız · telefon" hint="Telefonda ayrı"><span className="she-scale"><input type="range" min="10" max="150" step="1" value={Number(H.mqSpeedM) || 46} onChange={(e) => S('mqSpeedM', Number(e.target.value))} /><code>{Number(H.mqSpeedM) || 46} sn</code></span></Field>
        <ScaleField v={Number(H.brandLogoScale) || 1} onChange={(v) => S('brandLogoScale', v)} label="Tüm logoların boyutu" />
      </More>
    </>;
    else if (k === 'brands') body = <>
      <Field label="Başlık"><input value={H.brandsTitle || ''} placeholder="Markalar" onChange={(e) => S('brandsTitle', e.target.value)} /></Field>
      <Field label="Kutu büyüklüğü"><span className="seg">{[['sm', 'Küçük'], ['md', 'Orta'], ['lg', 'Büyük']].map(([x, l]) => <button key={x} type="button" className={(H.brandSize || 'md') === x ? 'on' : ''} onClick={() => S('brandSize', x)}>{l}</button>)}</span></Field>
      <button type="button" className="btn sm outline" onClick={() => setSel({ kind: 'brand', i: -1 })}><Icon n="plus" s={15} />Marka ekle</button>
      <p className="fine">Kutuları sayfada tutup sürükleyin. Bir kutuya tıklayınca o markanın logosu, rengi ve logo boyutu açılır.</p>
      <More>
        <Field label="Alt yazı" opt><input value={H.brandsSub ?? 'Dünyanın önde gelen tamir ekipmanı üreticileri'} onChange={(e) => S('brandsSub', e.target.value)} /></Field>
        <Toggle id="dz-bcta" label="“Ürünleri gör →” yazısı" checked={H.brandCta !== false} onChange={(v) => S('brandCta', v)} />
        <ScaleField v={Number(H.brandLogoScale) || 1} onChange={(v) => S('brandLogoScale', v)} label="Tüm logoların boyutu" />
        <GeoMore H={H} k={k} S={S} />
      </More>
    </>;
    else if (k === 'promos') body = <>
      <Field label="Başlık"><input value={H.promosTitle || ''} placeholder="Öne çıkanlar" onChange={(e) => S('promosTitle', e.target.value)} /></Field>
      <p className="fine">Kutuları sayfada tutup sürükleyerek sıralayın; tıklayınca içeriği ve boyutu açılır.</p>
      <More><GeoMore H={H} k={k} S={S} /></More>
    </>;
    else if (k === 'cta') body = <>
      <Field label="Başlık"><input value={H.cta?.title || ''} placeholder="Boşsa bant görünmez" onChange={(e) => S('cta', { ...(H.cta || {}), title: e.target.value })} /></Field>
      <Field label="Yazı" opt><input value={H.cta?.text || ''} onChange={(e) => S('cta', { ...(H.cta || {}), text: e.target.value })} /></Field>
      <More><GeoMore H={H} k={k} S={S} /></More>
    </>;
    else if (k === 'fav' || k === 'sets') body = <p className="fine">Bu raf otomatik dolar. Yerini Katmanlar'dan ya da sayfada sürükleyerek değiştirin, göz simgesiyle gizleyin.</p>;
    else if (k.startsWith('rail:')) { const i = H.sections.findIndex((r) => 'rail:' + r.id === k); const x = H.sections[i]; if (!x) return null; body = <><RailFields x={x} up={(p) => S('sections', H.sections.map((r, j) => (j === i ? { ...r, ...p } : r)))} /><More><GeoMore H={H} k={k} S={S} /></More><BlockActs {...P} k={k} /></>; }
    else if (k.startsWith('b:')) { const id = k.slice(2); const b = H.blocks[id]; if (!b) return null; const geo = ['head', 'banner', undefined].includes(b.t); body = <><BlockFields b={b} up={(p) => S('blocks', { ...H.blocks, [id]: { ...b, ...p } })} />{geo && <More><GeoMore H={H} k={k} S={S} /></More>}<BlockActs {...P} k={k} /></>; }
  }
  return (
    <div className="dz2-insp-in">
      <div className="dz2-ih">
        {back && <button className="dz2-ib sm" onClick={back} title="Bir üste dön"><Icon n="back" s={16} /></button>}
        <span><b>{title}</b>{sub && <small>{sub}</small>}</span>
        {sel && <button className="dz2-ib sm" onClick={close} title="Kapat (Esc)"><Icon n="x" s={16} /></button>}
      </div>
      <div className="dz2-insp-b">{body}</div>
    </div>
  );
}
function BlockActs({ k, dupBlock, removeBlock }) {
  return <div className="dz2-acts">
    <button className="btn sm ghost" onClick={() => dupBlock(k)}><Icon n="copy" s={15} />Çoğalt</button>
    <button className="btn sm ghost danger" onClick={() => removeBlock(k)}><Icon n="trash" s={15} />Bölümü sil</button>
  </div>;
}
function GeoMore({ H, k, S }) {
  return <div className="dz-geo"><h4>Genişlik ve yer</h4><GeoFields {...geoOf(H, k)} up={(p) => S('geo', { ...(H.geo || {}), [k]: p })} note="Seçiliyken bölümün kenarlarındaki tutamaçlarla da çekebilirsiniz. Telefonda hep tam genişlik." /></div>;
}
// "Detay ayarları": her panelin altında; açık/kapalı tercihi hatırlanır
function More({ children, label = 'Detay ayarları' }) {
  const [open, setOpen] = useState(() => ls.get('dz-more', false));
  return <section className={'dz2-more' + (open ? ' open' : '')}>
    <button type="button" className="dz2-more-h" onClick={() => { setOpen(!open); ls.set('dz-more', !open); }} aria-expanded={open}><Icon n="gear" s={15} /><span>{label}</span><Icon n="chev" s={16} className="fold-chev" /></button>
    {open && <div className="dz2-more-b">{children}</div>}
  </section>;
}
// bir alanı aramadan ya da sayfadan açınca o alana kaydır ve parlat
function useFocusField(sel) {
  useEffect(() => {
    if (!sel?.focus) return;
    const t = setTimeout(() => { const el = document.querySelector(`.dz2-insp [data-f="${sel.focus}"], .dz2-sheet [data-f="${sel.focus}"]`); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('dz2-hl'); void el.offsetWidth; el.classList.add('dz2-hl'); }, 90);
    return () => clearTimeout(t);
  }, [sel?.focus]);
}

// ---- Büyük reklam paneli ---------------------------------------------------------------------------------------------------
let styleClip = null; // stil kopyala / yapıştır (oturum boyunca)
const STYLE_KEYS = ['theme', 'bg', 'layout', 'tc', 'xc', 'bs', 'btn', 'ist'];
const THEME_BG = { night: '#070c1d', ember: '#1a0a02', volt: '#031510', violet: '#100828', carbon: '#0b0b0d', ice: '#eef3ff', sand: '#f7f1e6', mint: '#ecfbf4', rose: '#2a0716', ocean: '#031a2e' };
const THEME_SW = { night: ['#070c1d', '#2f6bff', '#ff6a1a'], ember: ['#1a0a02', '#ff5a1f', '#ffb020'], volt: ['#031510', '#10e39a', '#2f6bff'], violet: ['#100828', '#8b5cf6', '#ff3d9a'], carbon: ['#0b0b0d', '#e5e7eb', '#ff6a1a'], ice: ['#eef3ff', '#7aa2ff', '#ffb36b'], sand: ['#f7f1e6', '#c2410c', '#ca8a04'], rose: ['#2a0716', '#fb7185', '#f59e0b'], ocean: ['#031a2e', '#22d3ee', '#3b82f6'], mint: ['#ecfbf4', '#059669', '#0ea5e9'] };
function HeroPanel(P) {
  const { H, set, heroI, goSlide, sel, setPeek, pack } = P;
  const slides = H.slides || [];
  const [i, setI] = useState(() => Math.min(heroI.current || 0, Math.max(0, slides.length - 1)));
  // sayfada başka reklama geçilince panel de o reklamı göstersin
  useEffect(() => { const t = setInterval(() => { const h = heroI.current; if (h !== i && h < (store.s.designDraft?.shopHome?.slides || slides).length) setI(h); }, 250); return () => clearInterval(t); }, [i]);
  useFocusField(sel);
  const s = slides[i];
  const S = (k, v) => set('shopHome.' + k, v);
  const up = (p) => S('slides', slides.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const pick = (j) => { setI(j); goSlide(j); };
  const peekP = (p) => setPeek(p ? { path: 'shopHome.slides', v: slides.map((x, j) => (j === i ? { ...x, ...p } : x)) } : null);
  const [tpl, setTpl] = useState(false);
  if (!s) return <><p className="fine">Henüz reklam yok.</p><button className="btn sm primary" onClick={() => { S('slides', [NEW.slide()]); pick(0); }}><Icon n="plus" s={15} />Reklam ekle</button></>;
  const ly = SLIDE_LAYOUTS[s.layout] ? s.layout : 'split';
  const cover = COVER_LY.includes(ly);
  // okunabilirlik: yazı rengi arka planda zor okunuyorsa uyar
  const bgk = pack?.hero || s.bg;
  const bgHex = cover ? null : BG_BY[bgk] ? bgTone(BG_BY[bgk].bg) : THEME_BG[s.theme || 'night'];
  const bad = bgHex ? [['tc', 'Başlık'], ['xc', 'Açıklama']].filter(([k]) => s[k] && !s[k].startsWith('g:') && (contrast(s[k], bgHex) ?? 9) < 2.6) : [];
  const fixC = contrast('#ffffff', bgHex || '#000') > contrast('#0f172a', bgHex || '#000') ? '#ffffff' : '#0f172a';
  const addFromTpl = (t) => { const n = [...slides, { ...NEW.slide(), ...structuredClone(t.s), img: '' }]; S('slides', n); setTimeout(() => pick(n.length - 1), 60); setTpl(false); toast('“' + t.n + '” şablonuyla yeni reklam eklendi. Yazıları değiştirip resmini seçin.'); };
  const applyTpl = (t) => { const k = ['layout', 'bg', 'theme', 'bs', 'btn', 'tc', 'xc', 'mfit']; up({ ...Object.fromEntries(k.map((x) => [x, t.s[x] ?? ''])), fx: {}, fxm: {} }); setTpl(false); toast('Şablonun görünümü bu reklama uygulandı (yazılar ve resim aynı kaldı)'); };
  return <>
    <button type="button" className={'dz2-tplbtn' + (tpl ? ' on' : '')} onClick={() => setTpl(!tpl)}><Icon n="sparkle" s={16} /><span><b>Hazır şablonlar</b><small>{SLIDE_TEMPLATES.length} şablon · hangi resmin gerektiği yazar</small></span><Icon n="chev" s={16} className="fold-chev" /></button>
    {tpl && <div className="dz2-tpls">{SLIDE_TEMPLATES.map((t) => (
      <div key={t.id} className="dz2-tpl">
        <button type="button" className="dz2-tpl-pv" onClick={() => addFromTpl(t)} onMouseEnter={() => peekP({ ...t.s, title: s.title, text: s.text, cta: s.cta, tag: s.tag, img: s.img })} onMouseLeave={() => peekP(null)} style={{ background: BG_BY[t.s.bg]?.bg || 'linear-gradient(135deg, #64748b, #1e293b)' }} title="Yeni reklam olarak ekle">
          <i className={'tpl-ly ly-' + t.s.layout + (BG_BY[t.s.bg]?.ink === 'l' ? ' dk' : '')} aria-hidden="true"><b /><b /><em /></i>
        </button>
        <span className="dz2-tpl-t"><b>{t.n}</b><small>{t.d}</small><small className="dz2-tpl-sz"><Icon n="image" s={12} />{t.size}</small></span>
        <span className="dz2-tpl-a"><button type="button" className="btn sm primary" onClick={() => addFromTpl(t)}><Icon n="plus" s={14} />Yeni reklam</button><button type="button" className="btn sm ghost" onClick={() => applyTpl(t)}>Bu reklama uygula</button></span>
      </div>
    ))}</div>}
    <div className="dz2-slides" role="group" aria-label="Reklamlar">
      {slides.map((x, j) => <button key={j} className={'dz2-sl' + (j === i ? ' on' : '')} data-dz="slides" data-i={j} data-fk={(x.title || '') + '|' + (x.img || '') + '|' + (x.layout || '')} data-dz-name={(j + 1) + '. ' + (x.title || 'Reklam')} title={(x.title || '') + ' · tutup sürükleyerek sıralayın'}
        onPointerDown={(e) => dragSort(e, 'slides', j, (f, t) => { const cur = store.s.designDraft?.shopHome?.slides || slides; S('slides', moveItem(cur, f, t)); setI((ii) => (ii === f ? t : ii === t ? f : ii)); }, () => pick(j))}><b>{j + 1}</b><span>{x.title || 'Reklam'}</span></button>)}
      {slides.length < 8 && <button className="dz2-sl add" onClick={() => { S('slides', [...slides, NEW.slide()]); setTimeout(() => pick(slides.length), 60); }} title="Reklam ekle"><Icon n="plus" s={15} /></button>}
    </div>
    {bad.length > 0 && <div className="dz2-warn"><Icon n="eye" s={16} /><span><b>{bad.map((x) => x[1]).join(' ve ')} zor okunuyor.</b> Yazı rengi arka plana çok yakın.</span><button className="btn sm" onClick={() => up(Object.fromEntries(bad.map(([k]) => [k, fixC])))}>Düzelt</button></div>}

    <div data-f="layout"><Field label="Düzen"><span className="dz2-lys">{Object.entries(SLIDE_LAYOUTS).map(([k, l]) => <button key={k} type="button" className={'dz2-lyc ly-' + k + (ly === k ? ' on' : '')} onClick={() => up({ layout: k })} onMouseEnter={() => peekP({ layout: k })} onMouseLeave={() => peekP(null)}><i aria-hidden="true"><b /><em /></i><span>{l}</span></button>)}</span></Field></div>
    {!cover && <div data-f="bg"><BgPicker s={s} up={up} peekP={peekP} packOn={!!pack?.hero} /></div>}
    <div data-f="title"><Field label="Başlık"><input value={s.title || ''} onChange={(e) => up({ title: e.target.value })} placeholder="ör. Aixun T3A ile tanışın" /></Field></div>
    <div data-f="tc"><ColorPick v={s.tc || ''} onChange={(tc) => up({ tc })} /></div>
    <div data-f="text"><Field label="Açıklama" opt hint="Başlığın altındaki yazı"><textarea rows={2} value={s.text || ''} onChange={(e) => up({ text: e.target.value })} placeholder="ör. 4K dijital ve stereo mikroskoplar" /></Field></div>
    <div data-f="xc"><ColorPick v={s.xc || ''} onChange={(xc) => up({ xc })} label="Açıklama rengi" grads={false} /></div>
    <div data-f="cta" className="dz2-row2">
      <Field label="Buton yazısı" opt><input value={s.cta || ''} onChange={(e) => up({ cta: e.target.value })} placeholder="ör. Hemen incele" /></Field>
      <LinkPick v={s.link} onChange={(link) => up({ link })} />
    </div>
    {s.cta && <div data-f="bs"><ButtonStudio s={s} up={up} peekP={peekP} pack={pack} /></div>}
    <div data-f="img"><ImgPick v={s.img} onChange={(img) => up({ img })} alpha={!cover} max={cover ? 1800 : 1000} label={cover ? 'Banner resmi' : 'Görsel'} hint={cover ? 'Yatay banner resmi (ör. 1600×640). Sayfada resmi tutup sürükleyerek kaydırabilirsiniz.' : 'Saydam arka planlı ürün resmi en iyisi'} prodOk /></div>
    {cover && <div data-f="mfit"><Field label="Telefonda nasıl görünsün?" hint={{ stack: 'Resim telefonda kesilmeden üstte, yazılar altında. Yatay banner için en temiz sonuç.', whole: 'Resmin tamamı görünür, kenarlar resmin bulanık hâliyle dolar.' }[s.mfit] || 'Resim telefonun dikey kutusunu doldurur; yanları kesilir. Ölçü rehberinde nereden kesildiğini görün.'}>
      <span className="dz2-mfits">{[['', 'Kırp', 'doldurur'], ['whole', 'Resmin tamamı', 'bulanık kenar'], ['stack', 'Resim üstte', 'yazı altta']].map(([k, l, h]) => <button key={k} type="button" className={'dz2-mfit mf-' + (k || 'crop') + ((s.mfit || '') === k ? ' on' : '')} onClick={() => up({ mfit: k })}><i aria-hidden="true"><b /><em /></i><span>{l}</span><small>{h}</small></button>)}</span>
    </Field></div>}
    {cover && s.img && <div data-f="imgM"><ImgPick v={s.imgM || ''} onChange={(imgM) => up({ imgM })} max={1200} label="Telefon için ayrı resim" hint="İsteğe bağlı. Telefonda bu resim görünür; dikey (ör. 900×1180) hazırlayın. Boşsa bilgisayardaki resim kullanılır." /></div>}
    {cover && s.img && <SizeGuide s={s} i={i} measure={P.measure} H={H} />}
    {s.img && cover && <div data-f="frame" className="dz2-frame-box"><h4><Icon n="zoom" s={15} />Resmi çerçevele</h4><ImgLook s={s} up={up} cover phone={false} /></div>}
    <More>
      <Field label="Küçük etiket" opt><input value={s.tag || ''} onChange={(e) => up({ tag: e.target.value })} placeholder="ör. Yeni · Stokta" /></Field>
      <LogoPick s={s} up={up} />
      {s.img && !cover && <ImgLook s={s} up={up} cover={false} phone={false} />}
      <div data-f="heroH"><Field label="Reklam alanı yüksekliği" hint="Alt kenarındaki tutamaçla da çekebilirsiniz. 0 = otomatik"><span className="she-scale"><input type="range" min="0" max="760" step="10" value={Number(H.heroH) || 0} onChange={(e) => S('heroH', Number(e.target.value) < 260 ? 0 : Number(e.target.value))} /><code>{Number(H.heroH) ? H.heroH + ' px' : 'otomatik'}</code></span></Field></div>
      <GeoMore H={H} k="hero" S={S} />
      <div className="dz2-acts">
        <button className="btn sm ghost" disabled={i === 0} onClick={() => { S('slides', moveItem(slides, i, 0)); pick(0); }}><Icon n="up" s={15} />En başa al</button><button className="btn sm ghost" disabled={i === 0} onClick={() => { S('slides', moveItem(slides, i, i - 1)); pick(i - 1); }}><Icon n="back" s={15} />Öne al</button>
        <button className="btn sm ghost" disabled={i >= slides.length - 1} onClick={() => { S('slides', moveItem(slides, i, i + 1)); pick(i + 1); }}><Icon n="back" s={15} className="flip" />Sona al</button>
        <button className="btn sm ghost" disabled={slides.length >= 8} onClick={() => { const n = [...slides]; n.splice(i + 1, 0, structuredClone(s)); S('slides', n); setTimeout(() => pick(i + 1), 60); }}><Icon n="copy" s={15} />Çoğalt</button>
        <button className="btn sm ghost" onClick={() => { styleClip = Object.fromEntries(STYLE_KEYS.map((k) => [k, s[k]])); toast('Stil kopyalandı: düzen, arka plan, renkler, buton'); }}><Icon n="copy" s={15} />Stili kopyala</button>
        <button className="btn sm ghost" disabled={!styleClip} onClick={() => { up(styleClip); toast('Stil yapıştırıldı'); }}><Icon n="brush" s={15} />Stili yapıştır</button>
        {slides.length > 1 && <button className="btn sm ghost danger" onClick={() => { S('slides', slides.filter((_, j) => j !== i)); pick(Math.max(0, i - 1)); }}><Icon n="trash" s={15} />Bu reklamı sil</button>}
      </div>
    </More>
  </>;
}
// ---- Ölçü rehberi: reklam kutusunun bilgisayarda ve telefonda gerçek ölçüsü, önerilen resim boyu,
// yüklenen resmin hangi kısmının görüneceği (mavi: bilgisayar, turuncu: telefon)
function useNatural(v) {
  const src = useShopImg(v); const [n, setN] = useState(null);
  useEffect(() => { if (!src) { setN(null); return; } const im = new Image(); im.onload = () => setN({ w: im.naturalWidth, h: im.naturalHeight, src }); im.onerror = () => setN(null); im.src = src; }, [src]);
  return n;
}
// cover kırpma hesabı: kutu (bw×bh), resim (W×H), z yakınlaştırma, fx/fy odak % → resimde görünen dikdörtgen (oran 0..1)
function visibleRect(W, H, bw, bh, z = 1, fx = 50, fy = 50, contain) {
  if (contain) return { x: 0, y: 0, w: 1, h: 1 };
  const sc = Math.max(bw / W, bh / H) * z;
  const vw = Math.min(1, bw / sc / W), vh = Math.min(1, bh / sc / H);
  return { x: (1 - vw) * fx / 100, y: (1 - vh) * fy / 100, w: vw, h: vh };
}
function SizeGuide({ s, i, measure, H }) {
  const [m, setM] = useState({});
  useEffect(() => { const f = () => setM(measure(i)); f(); const t = setInterval(f, 800); return () => clearInterval(t); }, [i]);
  const desk = m.desk || { w: 1248, h: Number(H.heroH) || 540, est: true };
  const phone = m.phone || { w: 358, h: Math.max(470, Math.round((Number(H.heroH) || 0) * 0.82)), est: true };
  const img = useNatural(s.img); const imgM = useNatural(s.imgM);
  const im = s.im || {}; const g = (k, d, mob) => Number((mob ? im[k + 'm'] ?? im[k] : im[k]) ?? d);
  const rec = (b, cap) => { const w = cap; return w + ' × ' + Math.round((w * b.h) / b.w); };
  const ratio = (b) => (b.w / b.h >= 1.15 ? 'yatay' : b.w / b.h <= 0.87 ? 'dikey' : 'kareye yakın');
  const contain = im.f === 'contain';
  const vd = img && visibleRect(img.w, img.h, desk.w, desk.h, g('z', 1), g('x', 50), g('y', 50), contain);
  const pImg = s.imgM ? imgM : img;
  const vp = pImg && (s.mfit === 'whole' || s.mfit === 'stack' || (s.imgM ? false : contain) ? { x: 0, y: 0, w: 1, h: 1 } : visibleRect(pImg.w, pImg.h, phone.w, phone.h, g('z', 1, 1), g('x', 50, 1), g('y', 50, 1), false));
  const warns = [];
  if (img && img.w < desk.w * 1.3) warns.push('Resim bilgisayardaki kutudan pek büyük değil (' + img.w + ' px); netlik için en az ' + Math.round(desk.w * 1.4) + ' px genişlik önerilir.');
  if (vp && !s.imgM && vp.w * vp.h < 0.5) warns.push('Telefonda resmin sadece %' + Math.round(vp.w * vp.h * 100) + '’i görünüyor. “Resim üstte” ya da “Resmin tamamı” seçin veya telefona ayrı resim koyun.');
  return <div className="dz2-size" data-f="size">
    <h4><Icon n="expand" s={15} />Ölçü rehberi</h4>
    <div className="dz2-size-rows">
      <div><i className="sw-d" /><span><b>Bilgisayar kutusu</b><small>{desk.w} × {desk.h} px · {ratio(desk)}{desk.est ? ' · tahmini' : ''}</small></span><code>Önerilen resim: {rec(desk, 1800)}</code></div>
      <div><i className="sw-p" /><span><b>Telefon kutusu</b><small>{s.mfit === 'stack' ? 'resim kendi oranında, yazı altta' : phone.w + ' × ' + phone.h + ' px · ' + ratio(phone) + (phone.est ? ' · tahmini' : '')}</small></span><code>{s.mfit === 'stack' ? 'Aynı resim kullanılır' : 'Telefon resmi: ' + rec(phone, 900)}</code></div>
    </div>
    {img && <div className="dz2-crop">
      <div className="dz2-crop-img" style={{ aspectRatio: img.w + ' / ' + img.h, width: `min(100%, ${Math.round((240 * img.w) / img.h)}px)` }}>
        <img src={img.src} alt="" />
        {vd && <span className="cr-d" style={{ left: vd.x * 100 + '%', top: vd.y * 100 + '%', width: vd.w * 100 + '%', height: vd.h * 100 + '%' }}><em>Bilgisayar</em></span>}
        {vp && !s.imgM && <span className="cr-p" style={{ left: vp.x * 100 + '%', top: vp.y * 100 + '%', width: vp.w * 100 + '%', height: vp.h * 100 + '%' }}><em>Telefon</em></span>}
      </div>
      <small>Yüklediğiniz resim: {img.w} × {img.h} px. Çerçevelerin dışında kalan kısım kesilir. {s.imgM ? 'Telefonda ayrı resim kullanılıyor.' : ''}</small>
    </div>}
    {warns.map((w) => <p key={w} className="dz2-warn sm"><Icon n="eye" s={14} /><span>{w}</span></p>)}
  </div>;
}
// ---- Buton stüdyosu: hazır stil kartları (gerçek butonla önizleme), ok simgesi, renkler, şekil, boyut
function ButtonStudio({ s, up, peekP, pack }) {
  const B = s.btn || { st: btnStyleOf(s) };
  const set = (p) => up({ btn: { ...B, ...p }, bs: '' });
  const peek = (p) => peekP?.(p ? { btn: { ...B, ...p }, bs: '' } : null);
  const sw = THEME_SW[s.theme || 'night'] || THEME_SW.night;
  const bgk = pack?.hero || s.bg; const bg = BG_BY[bgk]?.bg || `radial-gradient(60% 80% at 15% 10%, ${sw[1]}66, transparent 60%), ${sw[0]}`;
  const tile = { '--g1': sw[1], '--g2': sw[2], '--accent': 'var(--accent-user, #2f55b0)', background: bg };
  const groups = [...new Set(BTN_STYLES.map((x) => x.g))];
  const C = (k, label) => <span className="dz2-bcol"><small>{label}</small><span className="she-color"><input type="color" value={/^#/.test(B[k] || '') ? B[k] : '#ffffff'} onChange={(e) => set({ [k]: e.target.value })} aria-label={label} />{B[k] ? <button type="button" className="linkish" onClick={() => set({ [k]: '' })}>oto</button> : <code>oto</code>}</span></span>;
  return <div className="dz2-bstudio">
    <span className="field-l">Buton stili</span>
    {groups.map((g) => <div key={g} className="dz2-bgrp"><small>{g}</small><div className="dz2-bgrid">
      {BTN_STYLES.filter((x) => x.g === g).map((x) => (
        <button key={x.id} type="button" className={'dz2-bcard' + (B.st === x.id ? ' on' : '')} onClick={() => set({ st: x.id })} onMouseEnter={() => peek({ st: x.id })} onMouseLeave={() => peek(null)} title={x.n}>
          <span className="dz2-bprev" style={tile}><CtaButton s={{ cta: 'İncele', btn: { ...B, st: x.id, bg: '', fg: '', bd: '', sz: 'sm' } }} onClick={() => {}} /></span>
          <small>{x.n}</small>
        </button>
      ))}
    </div></div>)}
    <span className="field-l">Ok simgesi</span>
    <div className="dz2-agrid">
      {ARROWS.map((a) => (
        <button key={a.id} type="button" className={'dz2-acard' + ((B.ar || 'auto') === a.id ? ' on' : '')} onClick={() => set({ ar: a.id })} onMouseEnter={() => peek({ ar: a.id })} onMouseLeave={() => peek(null)} title={a.n}>
          <span className="dz2-bprev" style={tile}><CtaButton s={{ cta: '', btn: { ...B, ar: a.id, sz: 'sm' } }} onClick={() => {}} /></span>
          <small>{a.n}</small>
        </button>
      ))}
    </div>
    <div className="dz2-brow">
      <Field label="Şekil"><span className="seg">{[['pill', 'Hap'], ['round', 'Yuvarlak köşe'], ['square', 'Köşeli']].map(([k, l]) => <button key={k} type="button" className={(B.sh || 'pill') === k ? 'on' : ''} onClick={() => set({ sh: k })}>{l}</button>)}</span></Field>
      <Field label="Boyut"><span className="seg">{[['sm', 'Küçük'], ['md', 'Orta'], ['lg', 'Büyük']].map(([k, l]) => <button key={k} type="button" className={(B.sz || 'md') === k ? 'on' : ''} onClick={() => set({ sz: k })}>{l}</button>)}</span></Field>
    </div>
    <div className="field"><span className="field-l">Renkleri değiştir <small className="opt">(oto = stilin kendi rengi)</small></span>
      <div className="dz2-bcols">{C('bg', 'Zemin')}{C('fg', 'Yazı')}{C('bd', 'Çerçeve')}{C('ac', 'Ok')}{C('ab', 'Ok zemini')}</div>
    </div>
  </div>;
}
// arka plan seçici: ışıklı temalar + hazır arka planlar; üzerine gelince sayfada denenir
function BgPicker({ s, up, peekP, packOn }) {
  const [cat, setCat] = useState(() => (s.bg && BG_BY[s.bg] ? BG_BY[s.bg].cat : 'theme'));
  return <div className="field">
    <span className="field-l">Arka plan</span>
    {packOn && <p className="fine dz2-note">Tema Stüdyosu açık: kampanya süresince banner zemini temadan gelir. Buradaki seçim tema kapanınca görünür.</p>}
    <div className="dz2-bgcats" role="group" aria-label="Arka plan grupları">
      {[['theme', 'Işıklı tema'], ...Object.entries(BG_CATS)].map(([k, l]) => <button key={k} type="button" className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}
    </div>
    <div className="dz2-bgs">
      {cat === 'theme' ? Object.entries(THEMES).map(([k, l]) => (
        <button key={k} type="button" className={'dz2-bg' + (!s.bg && (s.theme || 'night') === k ? ' on' : '') + (['ice', 'sand', 'mint'].includes(k) ? ' lt' : '')} title={l}
          style={{ background: `radial-gradient(60% 80% at 15% 10%, ${THEME_SW[k][1]}aa, transparent 60%), radial-gradient(60% 80% at 90% 100%, ${THEME_SW[k][2]}aa, transparent 60%), ${THEME_SW[k][0]}` }}
          onClick={() => up({ theme: k, bg: '' })} onMouseEnter={() => peekP({ theme: k, bg: '' })} onMouseLeave={() => peekP(null)}><span>{l}</span></button>
      )) : BG_PRESETS.filter((b) => b.cat === cat).map((b) => (
        <button key={b.id} type="button" className={'dz2-bg' + (s.bg === b.id ? ' on' : '') + (b.ink === 'l' ? ' lt' : '')} title={b.n} style={{ background: b.bg }}
          onClick={() => up({ bg: b.id })} onMouseEnter={() => peekP({ bg: b.id })} onMouseLeave={() => peekP(null)}><span>{b.n}</span></button>
      ))}
    </div>
    <small className="field-h">{BG_PRESETS.length + Object.keys(THEMES).length} seçenek · üzerine gelince sayfada denenir, tıklayınca seçilir</small>
  </div>;
}
// reklamın içindeki tek bir öğe seçilince: sadece o öğenin ayarları
function FxPanel({ H, set, s, i, el, setSel, sel }) {
  const slides = H.slides || [];
  const up = (p) => set('shopHome.slides', slides.map((x, j) => (j === i ? { ...x, ...p } : x)));
  // konum ve boyut bilgisayar ve telefon için ayrı (telefonda ayrı ayar yoksa bilgisayardaki küçültülerek kullanılır)
  const [dev, setDev] = useState(sel?.dev === 'm' ? 'm' : '');
  useEffect(() => { setDev(sel?.dev === 'm' ? 'm' : ''); }, [sel?.dev]);
  const key = dev === 'm' ? 'fxm' : 'fx';
  const fd = s.fx?.[el] || {}; const own = dev === 'm' ? s.fxm?.[el] : null;
  const f = dev === 'm' ? (own || { ...fd, x: Math.round((fd.x || 0) * 0.5), y: Math.round((fd.y || 0) * 0.5) }) : fd;
  const upF = (p) => up({ [key]: { ...(s[key] || {}), [el]: { ...f, ...p } } });
  const reset = () => { const o = { ...(s[key] || {}) }; delete o[el]; up({ [key]: o }); };
  const size = <ScaleField v={f.s ?? 1} min={0.3} max={2.5} onChange={(v) => upF({ s: v })} label={dev === 'm' ? 'Boyut · telefon' : 'Boyut · bilgisayar'} />;
  const devSeg = <div className="dz2-fxdev">
    <span className="seg">{[['', 'monitor', 'Bilgisayar'], ['m', 'mobile', 'Telefon']].map(([k, ic, l]) => <button key={k} type="button" className={dev === k ? 'on' : ''} onClick={() => setDev(k)}><Icon n={ic} s={14} />{l}</button>)}</span>
    <small>{dev === 'm' ? (own ? 'Telefonda bu öğenin kendi yeri ve boyutu var; bilgisayarı etkilemez.' : 'Telefonda şu an bilgisayardaki yer küçültülerek kullanılıyor. Telefon görünümünde sürüklerseniz ya da buradan değiştirirseniz telefona özel olur.') : 'Bilgisayardaki yer ve boyut. Telefona ayrı yer verilmemiş öğeler telefonda bunun küçültülmüşüyle görünür.'}</small>
    {dev === 'm' && own && <button type="button" className="linkish" onClick={reset}>Telefondaki ayarı sil (bilgisayardakine uy)</button>}
  </div>;
  return <>
    {devSeg}
    {el === 'title' && <><Field label="Başlık"><input value={s.title || ''} onChange={(e) => up({ title: e.target.value })} /></Field><ColorPick v={s.tc || ''} onChange={(tc) => up({ tc })} />{size}</>}
    {el === 'text' && <><Field label="Açıklama"><textarea rows={3} value={s.text || ''} onChange={(e) => up({ text: e.target.value })} /></Field><ColorPick v={s.xc || ''} onChange={(xc) => up({ xc })} label="Açıklama rengi" grads={false} />{size}</>}
    {el === 'cta' && <><Field label="Buton yazısı"><input value={s.cta || ''} onChange={(e) => up({ cta: e.target.value })} /></Field><LinkPick v={s.link} onChange={(link) => up({ link })} />
      <ButtonStudio s={s} up={up} />{size}</>}
    {el === 'logo' && <><Field label="Küçük etiket" opt><input value={s.tag || ''} onChange={(e) => up({ tag: e.target.value })} /></Field><LogoPick s={s} up={up} />{size}</>}
    {el === 'art' && <><ImgPick v={s.img} onChange={(img) => up({ img })} alpha max={1000} label="Görsel" prodOk />{size}</>}
    <p className="fine">Sayfada öğeyi tutup sürükleyin: ortaya ve ilk yerine kendiliğinden yapışır (Alt tuşu basılıyken serbest). Ok tuşlarıyla 1 px, Shift ile 10 px kayar.</p>
    {dev === 'm' && own?.ax != null ? <More label="Konum ve döndürme · telefon">
      <Field label="Soldan" hint="Reklam kutusunun genişliğine göre; her telefonda aynı oranda"><span className="she-scale"><input type="range" min="-5" max="95" step="0.5" value={Math.round(own.ax * 1000) / 10} onChange={(e) => upF({ ax: Number(e.target.value) / 100 })} /><code>%{Math.round(own.ax * 100)}</code></span></Field>
      <Field label="Üstten" hint="Reklam kutusunun yüksekliğine göre"><span className="she-scale"><input type="range" min="-5" max="95" step="0.5" value={Math.round(own.ay * 1000) / 10} onChange={(e) => upF({ ay: Number(e.target.value) / 100 })} /><code>%{Math.round(own.ay * 100)}</code></span></Field>
      <Field label="Döndür"><span className="she-scale"><input type="range" min="-45" max="45" step="1" value={own.r || 0} onChange={(e) => upF({ r: Number(e.target.value) })} /><code>{own.r || 0}°</code></span></Field>
    </More> : <More label={'Konum, döndürme ve 3B · ' + (dev === 'm' ? 'telefon' : 'bilgisayar')}><FxFields f={f} up={upF} reset={reset} /></More>}
    <div className="dz2-acts"><button className="btn sm outline" onClick={() => setSel({ kind: 'blk', k: 'hero' })}><Icon n="edit" s={15} />Reklamın tüm ayarları</button></div>
  </>;
}

// ---- Sayfa paneli: renk paleti, özel renkler, kart köşeleri, bölüm arası -----------------------------------------------------
function PagePanel({ d, set, setPeek, setSel, pack, openVers }) {
  const L = d.look || {}; const H = d.shopHome;
  const cur = PALETTES.find((p) => p.accent === L.shopAccent && p.price === L.shopPrice && (p.bg || '') === (L.bg || ''));
  const applyP = (p) => set('look', { ...L, shopAccent: p.accent, shopPrice: p.price, bg: p.bg });
  const peekP = (p) => setPeek(p ? { path: 'look', v: { ...L, shopAccent: p.accent, shopPrice: p.price, bg: p.bg } } : null);
  const C = (k, label, def) => <Field label={label}><span className="she-color"><input type="color" value={L[k] || def} onChange={(e) => set('look.' + k, e.target.value)} /><code>{L[k] || 'varsayılan'}</code>{L[k] && <button type="button" className="linkish" onClick={() => set('look.' + k, '')}>sıfırla</button>}</span></Field>;
  return <>
    {pack?.palette && <div className="dz2-warn info"><Icon n="sparkle" s={16} /><span>Tema Stüdyosu açık (<b>{pack.n}</b>): kampanya süresince sayfa renkleri temadan gelir.</span><button className="btn sm" onClick={() => setSel({ kind: 'studio' })}>Aç</button></div>}
    <Field label="Hazır renk paleti" hint="Ana renk, fiyat rengi ve sayfa zemini birlikte değişir. Üzerine gelince sayfada denenir.">
      <span className="dz2-pals">{PALETTES.map((p) => (
        <button key={p.id} type="button" className={'dz2-pal' + (cur?.id === p.id ? ' on' : '')} onClick={() => applyP(p)} onMouseEnter={() => peekP(p)} onMouseLeave={() => peekP(null)} title={p.n}>
          <i style={{ background: p.bg || '#f3f5f9' }}><b style={{ background: p.accent }} /><b style={{ background: p.price }} /></i><span>{p.n}</span>
        </button>
      ))}</span>
    </Field>
    <More label="Özel renkler ve ölçüler">
      {C('shopAccent', 'Ana renk (düğmeler, seçili menü)', '#2f55b0')}
      {C('shopPrice', 'Fiyat rengi', '#2f55b0')}
      {C('bg', 'Sayfa zemini', '#f3f5f9')}
      <Field label="Ürün kartı köşeleri"><span className="she-scale"><input type="range" min="0" max="28" step="1" value={Number(L.cardR ?? 18)} onChange={(e) => set('look.cardR', Number(e.target.value))} /><code>{Number(L.cardR ?? 18)} px</code></span></Field>
      <Field label="Bölümler arası boşluk"><span className="she-scale"><input type="range" min="0" max="80" step="2" value={Number(H.gap) || 0} onChange={(e) => set('shopHome.gap', Number(e.target.value))} /><code>{Number(H.gap) ? H.gap + ' px' : 'varsayılan'}</code></span></Field>
      <Toggle id="dz-home-on" label="Mağaza ana sayfası açık" hint="Kapalıysa mağaza doğrudan ürünler sayfasıyla açılır" checked={H.enabled !== false} onChange={(v) => set('shopHome.enabled', v)} />
    </More>
    <div className="dz2-tiles">
      <button className="dz2-tile" onClick={() => setSel({ kind: 'studio' })}><Icon n="sparkle" s={20} /><span><b>Tema Stüdyosu</b><small>{pack ? 'Açık: ' + pack.n : 'Efsane Cuma, yılbaşı, bayram…'}</small></span></button>
      <button className="dz2-tile" onClick={openVers}><Icon n="clock" s={20} /><span><b>Sürüm geçmişi</b><small>Önceki yayınlara dön</small></span></button>
    </div>
    <p className="fine">Sayfada bir şeye tıklayınca bu panel tam o şeyin ayarlarını açar: banner'daki açıklamaya tıklarsanız açıklamanın rengi, butona tıklarsanız buton.</p>
  </>;
}

// ---- Tema Stüdyosu ---------------------------------------------------------------------------------------------------------
function StudioPanel({ d, set, setPeek }) {
  const L = d.look || {}; const p = L.pack || {}; const my = L.myPacks || [];
  const base = PACK_BY[p.id] || my.find((x) => x.id === p.id);
  const parts = p.parts || {};
  const upP = (patch) => set('look.pack', { ...p, ...patch });
  const choose = (id) => set('look.pack', id ? { id, parts: {}, amt: 'md' } : {});
  const peek = (id) => setPeek(id ? { path: 'look.pack', v: { id, parts: {}, amt: 'md' } } : null);
  const [name, setName] = useState('');
  const pk = base ? activePack({ ...L, pack: { ...p, from: '', to: '' } }) : null;
  const fx = { ...(base?.fx || {}), ...(p.fx || {}) };
  const band = { ...(base?.band || {}), ...(p.band || {}) };
  const badge = { ...(base?.badge || {}), ...(p.badge || {}) };
  const oldDecor = DECOR.find((x) => x.id === L.decor?.id);
  const card = (x, mine) => (
    <button key={x.id} type="button" className={'dz2-pack' + (p.id === x.id ? ' on' : '')} onClick={() => choose(x.id)} onMouseEnter={() => p.id !== x.id && peek(x.id)} onMouseLeave={() => peek(null)}
      style={{ background: BG_BY[x.hero]?.bg || '#111827' }}>
      <span className="dz2-pack-sw">{(x.sw || [x.palette?.accent, x.palette?.price]).filter(Boolean).map((c, j) => <i key={j} style={{ background: c }} />)}</span>
      <b className={BG_BY[x.hero]?.ink === 'l' ? 'dk' : ''}>{x.n}</b><small className={BG_BY[x.hero]?.ink === 'l' ? 'dk' : ''}>{mine ? 'Kendi temanız' : x.d}</small>
    </button>
  );
  const sched = p.from || p.to ? (p.from && Date.now() < Date.parse(p.from) ? 'Henüz başlamadı: ' + new Date(p.from).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' tarihinde açılacak' : p.to && Date.now() > Date.parse(p.to) ? 'Süresi doldu: müşteriler görmüyor' : 'Şu an açık' + (p.to ? ', ' + new Date(p.to).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' tarihinde kapanacak' : '')) : '';
  return <>
    <p className="fine">Tema, mağazanın tamamını giydirir: renkler, banner zemini, üstte duyuru şeridi, hafif efekt ve ürün kartı rozeti. Üzerine gelince sayfada denenir; <b>Yayınla</b> deyince müşteriler görür.</p>
    {oldDecor && <div className="dz2-warn"><Icon n="sparkle" s={16} /><span>Eski süsleme teması açık: <b>{oldDecor.name}</b>. Buradan bir tema seçilince onun yerine geçer.</span><button className="btn sm" onClick={() => set('look.decor', { ...L.decor, id: '' })}>Kapat</button></div>}
    <div className="dz2-packs">
      <button type="button" className={'dz2-pack off' + (!p.id ? ' on' : '')} onClick={() => choose('')}><b>Tema yok</b><small>Mağazanın kendi görünümü</small></button>
      {PACKS.map((x) => card(x))}
      {my.map((x) => card(x, true))}
    </div>
    {base && pk && <>
      <Field label="Nereye uygulansın"><span className="dz2-chips">{PACK_PARTS.map(([k, l]) => <button key={k} type="button" className={parts[k] !== false ? 'on' : ''} onClick={() => upP({ parts: { ...parts, [k]: parts[k] === false } })}><Icon n={parts[k] !== false ? 'check' : 'plus'} s={13} />{l}</button>)}</span></Field>
      {parts.fx !== false && <>
        <Field label="Efekt"><span className="seg seg-wrap">{Object.entries(FX_KINDS).map(([k, l]) => <button key={k} type="button" className={(fx.kind || 'none') === k ? 'on' : ''} onClick={() => upP({ fx: { ...(p.fx || {}), kind: k, c: fx.c } })}>{l}</button>)}</span></Field>
        {fx.kind && fx.kind !== 'none' && <Field label="Yoğunluk"><span className="seg">{[['sm', 'Az'], ['md', 'Orta'], ['lg', 'Çok']].map(([k, l]) => <button key={k} type="button" className={(p.amt || 'md') === k ? 'on' : ''} onClick={() => upP({ amt: k })}>{l}</button>)}</span></Field>}
      </>}
      {parts.band !== false && <Field label="Duyuru şeridi yazısı" hint="Menünün altında kayan ince şerit. Boşsa şerit görünmez."><input value={band.text || ''} onChange={(e) => upP({ band: { ...(p.band || {}), text: e.target.value } })} /></Field>}
      {parts.badge !== false && <Field label="Ürün rozeti" hint="Ürün kartlarının köşesinde. Boşsa rozet yok."><input value={badge.text || ''} maxLength={14} onChange={(e) => upP({ badge: { ...(p.badge || {}), text: e.target.value } })} placeholder="ör. FIRSAT" /></Field>}
      {parts.hero !== false && <Field label="Banner zemini" hint="Tam resimli reklamlar kendi resmini korur"><span className="dz2-bgs sm">{BG_PRESETS.filter((b) => !b.ink).slice(0, 32).map((b) => <button key={b.id} type="button" className={'dz2-bg' + ((p.hero || base.hero) === b.id ? ' on' : '')} title={b.n} style={{ background: b.bg }} onClick={() => upP({ hero: b.id })}><span>{b.n}</span></button>)}</span></Field>}
      {parts.palette !== false && <More label="Tema renkleri">
        {[['accent', 'Ana renk'], ['price', 'Fiyat rengi'], ['bg', 'Sayfa zemini']].map(([k, l]) => <Field key={k} label={l}><span className="she-color"><input type="color" value={pk.palette?.[k] || '#f3f5f9'} onChange={(e) => upP({ palette: { ...(p.palette || {}), [k]: e.target.value } })} /><code>{pk.palette?.[k] || 'varsayılan'}</code></span></Field>)}
      </More>}
      <Field label="Otomatik aç / kapa" hint="Boş bırakırsanız tema siz kapatana kadar açık kalır. Tasarım modunda tarih ne olursa olsun önizlenir.">
        <span className="dz2-dates"><input type="datetime-local" value={p.from || ''} onChange={(e) => upP({ from: e.target.value })} aria-label="Başlangıç" /><span>→</span><input type="datetime-local" value={p.to || ''} onChange={(e) => upP({ to: e.target.value })} aria-label="Bitiş" /></span>
      </Field>
      {sched && <p className="fine dz2-note">{sched}</p>}
      <div className="dz2-save-my">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kendi temam olarak kaydet: ad yazın" maxLength={30} />
        <button className="btn sm outline" disabled={!name.trim()} onClick={() => { const id = 'my-' + rid(); const mine = { id, n: name.trim(), d: 'Kendi temanız', sw: [pk.palette?.accent, pk.palette?.price].filter(Boolean), palette: pk.palette || base.palette, hero: pk.hero || base.hero, band: pk.band, fx: pk.fx, badge: pk.badge, tint: base.tint }; set('look', { ...L, myPacks: [...my, mine], pack: { id, parts: {}, amt: p.amt || 'md', from: p.from, to: p.to } }); setName(''); toast('Temanız kaydedildi'); }}>Kaydet</button>
      </div>
      {p.id?.startsWith('my-') && <div className="dz2-acts"><button className="btn sm ghost danger" onClick={() => set('look', { ...L, myPacks: my.filter((x) => x.id !== p.id), pack: {} })}><Icon n="trash" s={15} />Bu temayı sil</button></div>}
    </>}
  </>;
}

// ---- Ayar arama (Ctrl K) ---------------------------------------------------------------------------------------------------
function CommandK({ close, P, setDev, addBlock, undo }) {
  const { H, L, setSel, reveal, toggleHide } = P;
  const [q, setQ] = useState(''); const [hi, setHi] = useState(0);
  const hero = (focus) => () => { setSel({ kind: 'blk', k: 'hero', focus }); reveal('hero'); };
  const items = useMemo(() => [
    ['Açıklama rengi', 'banner reklam alt yazı yazı rengi', hero('xc')], ['Açıklama yazısı', 'banner reklam alt yazı metin', hero('text')],
    ['Başlık rengi', 'banner reklam başlık', hero('tc')], ['Başlık yazısı', 'banner reklam', hero('title')],
    ['Banner arka planı', 'reklam tema zemin renk degrade desen', hero('bg')], ['Banner düzeni', 'reklam yerleşim tam resim ortalı', hero('layout')],
    ['Buton', 'reklam düğme link renk görünüm', hero('cta')], ['Banner resmi', 'reklam görsel fotoğraf resim', hero('img')],
    ['Resmi yakınlaştır / uzaklaştır', 'banner resim boyut küçült büyüt odak çerçevele', hero('frame')], ['Banner yüksekliği', 'reklam boy uzat kısalt', hero('heroH')],
    ['Sayfa renkleri', 'renk paleti ana renk fiyat rengi zemin', () => setSel(null)], ['Tema Stüdyosu', 'tema yılbaşı efsane cuma bayram kampanya süs', () => setSel({ kind: 'studio' })],
    ['Telefon görünümü', 'mobil önizleme', () => setDev('phone')], ['Yan yana görünüm', 'telefon bilgisayar birlikte', () => setDev('both')], ['Bilgisayar görünümü', 'masaüstü', () => setDev('desk')],
    ['Geri al', 'undo', undo],
    ...ADD_TYPES.map(([t, l]) => ['Bölüm ekle: ' + l, 'yeni ekle', () => addBlock(L.indexOf('cta') >= 0 ? L.indexOf('cta') : L.length, t)]),
    ...L.map((k) => ['Bölüm: ' + blockLabel(k, H), 'git aç seç', () => { setSel({ kind: 'blk', k }); reveal(k); }]),
    ...L.map((k) => [((H.hidden || []).includes(k) ? 'Göster: ' : 'Gizle: ') + blockLabel(k, H), 'gizle göster', () => toggleHide(k)]),
  ], [H, L]);
  const t = norm(q).split(/\s+/).filter(Boolean);
  const res = items.filter(([l, kw]) => t.every((x) => norm(l + ' ' + kw).includes(x))).slice(0, 12);
  const run = (it) => { close(); it?.[2](); };
  return (
    <div className="dz2-cmd-bg" onClick={close}>
      <div className="dz2-cmd" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ayar ara">
        <div className="dz2-cmd-in"><Icon n="search" s={18} /><input autoFocus value={q} placeholder="Ne yapmak istiyorsunuz? ör. açıklama rengi" onChange={(e) => { setQ(e.target.value); setHi(0); }}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % Math.max(1, res.length)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((hi - 1 + res.length) % Math.max(1, res.length)); } else if (e.key === 'Enter') run(res[hi]); else if (e.key === 'Escape') close(); }} /></div>
        <div className="dz2-cmd-l">{res.length ? res.map((it, j) => <button key={it[0]} className={j === hi ? 'on' : ''} onMouseEnter={() => setHi(j)} onClick={() => run(it)}>{it[0]}</button>) : <p className="fine">Bulunamadı.</p>}</div>
      </div>
    </div>
  );
}

// ---- Sürüm geçmişi (bu bilgisayarda, son 12 yayın) ---------------------------------------------------------------------------
function Versions({ close }) {
  const list = ls.get(VERS_KEY, []);
  const back = (v) => { const cur = store.s.designDraft || prepare(store.s.settings); store.set({ designDraft: { ...cur, shopHome: { ...cur.shopHome, ...v.shopHome }, look: v.look || cur.look, brandLogos: v.brandLogos || cur.brandLogos } }); toast('Eski sürüm taslağa yüklendi. Beğenirseniz Yayınla deyin.'); close(); };
  return (
    <div className="dz2-cmd-bg" onClick={close}>
      <div className="dz2-cmd dz2-vers" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Sürüm geçmişi">
        <div className="dz2-ih"><span><b>Sürüm geçmişi</b><small>Her yayından önceki hâl bu bilgisayarda saklanır (son 12)</small></span><button className="dz2-ib sm" onClick={close}><Icon n="x" s={16} /></button></div>
        <div className="dz2-cmd-l">
          {list.length ? list.map((v, j) => <div key={j} className="dz2-ver"><span><b>{new Date(v.at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</b><small>{(v.shopHome?.slides || []).length} reklam · {(v.shopHome?.layout || []).length} bölüm</small></span><button className="btn sm outline" onClick={() => back(v)}>Taslağa yükle</button></div>)
            : <p className="fine">Henüz kayıt yok. İlk “Yayınla”dan sonra, yayından önceki hâl burada görünür.</p>}
        </div>
      </div>
    </div>
  );
}

// ---- Telefonda seçilen öğe için alttaki düğme çubuğu ------------------------------------------------------------------------
const SIZES_CYCLE = ['sq', 'wide', 'tall', 'big'];
const SIZE_NAMES = { sq: 'Kare', wide: 'Geniş', tall: 'Uzun', big: 'Büyük' };
function MobileBar({ pick, setPick, H, d, set, setSel, L, setL, toggleHide, removeBlock, addBlock }) {
  const [adding, setAdding] = useState(false);
  const S = (k, v) => set('shopHome.' + k, v);
  const B = ({ ic, children, on, danger, disabled, rot }) => <button className={'mb-b' + (danger ? ' danger' : '')} disabled={disabled} onClick={on}><Icon n={ic} s={19} className={rot || ''} /><span>{children}</span></button>;
  let title = '', btns = null;
  if (pick.kind === 'blk') {
    const k = pick.k; const i = L.indexOf(k); const hidden = (H.hidden || []).includes(k); const custom = k.startsWith('rail:') || k.startsWith('b:');
    title = blockLabel(k, H);
    btns = <>
      <B ic="back" rot="rot90" on={() => setL(moveItem(L, i, i - 1))} disabled={i <= 0}>Yukarı</B>
      <B ic="back" rot="rot-90" on={() => setL(moveItem(L, i, i + 1))} disabled={i >= L.length - 1}>Aşağı</B>
      {k === 'hero' && <B ic="minus" on={() => S('heroH', Math.max(260, (Number(H.heroH) || 480) - 40))}>Kısalt</B>}
      {k === 'hero' && <B ic="plus" on={() => S('heroH', Math.min(760, (Number(H.heroH) || 480) + 40))}>Uzat</B>}
      {k === 'brands' && <B ic="grid" on={() => S('brandSize', { sm: 'md', md: 'lg', lg: 'sm' }[H.brandSize || 'md'])}>{{ sm: 'Küçük', md: 'Orta', lg: 'Büyük' }[H.brandSize || 'md']}</B>}
      <B ic={hidden ? 'eyeoff' : 'eye'} on={() => toggleHide(k)}>{hidden ? 'Göster' : 'Gizle'}</B>
      <B ic="edit" on={() => setSel({ kind: 'blk', k })}>Düzenle</B>
      <B ic="plus" on={() => setAdding(!adding)}>Altına ekle</B>
      {custom && <B ic="trash" danger on={() => removeBlock(k)}>Sil</B>}
    </>;
  } else if (pick.kind === 'brand') {
    const b = H.brands[pick.i]; if (!b) return null;
    const BL = d.brandLogos || {}; const key = BL[b.name] ? b.name : Object.keys(BL).find((x) => norm(x) === norm(b.name || '')) || b.name; const sc = BL[key]?.scale || 1;
    const upS = (v) => key && set('brandLogos', { ...BL, [key]: { ...(BL[key] || {}), scale: Math.round(Math.min(1.6, Math.max(0.4, v)) * 100) / 100 } });
    const mv = (dd) => { const j = pick.i + dd; if (j < 0 || j >= H.brands.length) return; S('brands', moveItem(H.brands, pick.i, j)); setPick({ kind: 'brand', i: j }); };
    title = 'Marka · ' + (b.name || '') + ' · logo %' + Math.round(sc * 100);
    btns = <>
      <B ic="back" on={() => mv(-1)} disabled={pick.i === 0}>Öne al</B>
      <B ic="back" rot="flip" on={() => mv(1)} disabled={pick.i === H.brands.length - 1}>Sona al</B>
      <B ic="minus" on={() => upS(sc - 0.1)}>Logo küçült</B>
      <B ic="plus" on={() => upS(sc + 0.1)}>Logo büyüt</B>
      <B ic="edit" on={() => setSel({ kind: 'brand', i: pick.i })}>Düzenle</B>
      <B ic="trash" danger on={() => { S('brands', H.brands.filter((_, j) => j !== pick.i)); setPick(null); }}>Kaldır</B>
    </>;
  } else if (pick.kind === 'promo') {
    const x = H.promos[pick.i]; if (!x) return null;
    const mv = (dd) => { const j = pick.i + dd; if (j < 0 || j >= H.promos.length) return; S('promos', moveItem(H.promos, pick.i, j)); setPick({ kind: 'promo', i: j }); };
    const nxt = SIZES_CYCLE[(SIZES_CYCLE.indexOf(x.size || 'sq') + 1) % 4];
    title = 'Kutu · ' + (x.title || pick.i + 1);
    btns = <>
      <B ic="back" on={() => mv(-1)} disabled={pick.i === 0}>Öne al</B>
      <B ic="back" rot="flip" on={() => mv(1)} disabled={pick.i === H.promos.length - 1}>Sona al</B>
      <B ic="expand" on={() => S('promos', H.promos.map((y, j) => (j === pick.i ? { ...y, size: nxt } : y)))}>{SIZE_NAMES[x.size || 'sq']}</B>
      <B ic="edit" on={() => setSel({ kind: 'promo', i: pick.i })}>Düzenle</B>
      <B ic="trash" danger on={() => { S('promos', H.promos.filter((_, j) => j !== pick.i)); setPick(null); }}>Sil</B>
    </>;
  }
  return (
    <div className="dz-mbar" role="toolbar" aria-label="Seçilen öğe">
      <div className="dz-mbar-h"><b>{title}</b><button className="icon-btn sm" onClick={() => setPick(null)} aria-label="Seçimi kaldır"><Icon n="x" s={16} /></button></div>
      {adding && pick.kind === 'blk' && <div className="dz-mbar-add">
        {ADD_TYPES.map(([t, l]) => <button key={t} onClick={() => { addBlock(L.indexOf(pick.k) + 1, t); setAdding(false); }}><Icon n="plus" s={15} />{l}</button>)}
      </div>}
      <div className="dz-mbar-b">{btns}</div>
    </div>
  );
}

// ---- bölüm çerçevesi: üstte araç çubuğu, altta "Bölüm ekle" ------------------------------------------------------------------
function DzBlock({ k, i, hidden, children }) {
  const { H, L, get, sel, setSel, tapBlock, mobile, setL, toggleHide, removeBlock, addBlock, blockMenu } = useContext(DesignCtx);
  const on = sel?.kind === 'blk' && sel.k === k;
  const custom = k.startsWith('rail:') || k.startsWith('b:');
  return (
    <div className={'dz-blk' + (on ? ' dz-on' : '') + (hidden ? ' dz-hid' : '')} data-dz="sec" data-i={i} data-k={k} data-dz-name={blockLabel(k, H)} onClick={() => tapBlock(k)} onContextMenu={blockMenu ? (e) => blockMenu(e, k) : undefined}>
      <div className="dz-bar" onClick={(e) => e.stopPropagation()}>
        <span className="dz-grip" title="Tutup sürükleyin" onPointerDown={(e) => dragSort(e, 'sec', i, (f, t) => setL(moveItem(get('layout'), f, t)))}><Icon n="drag" s={16} /></span>
        <button className="dz-name" onClick={() => setSel({ kind: 'blk', k })}>{blockLabel(k, H)}{hidden && <em>gizli</em>}</button>
        <button className="dz-ib" disabled={i === 0} onClick={() => setL(moveItem(L, i, i - 1))} title="Yukarı"><Icon n="back" s={15} className="rot90" /></button>
        <button className="dz-ib" disabled={i === L.length - 1} onClick={() => setL(moveItem(L, i, i + 1))} title="Aşağı"><Icon n="back" s={15} className="rot-90" /></button>
        <button className="dz-ib" onClick={() => toggleHide(k)} title={hidden ? 'Göster' : 'Gizle'}><Icon n={hidden ? 'eyeoff' : 'eye'} s={15} /></button>
        <button className="dz-ib" onClick={() => setSel({ kind: 'blk', k })} title="Ayarlar"><Icon n="gear" s={15} /></button>
        {custom && <button className="dz-ib danger" onClick={() => removeBlock(k)} title="Bölümü sil"><Icon n="trash" s={15} /></button>}
      </div>
      {children}
      {!mobile && <AddBetween onAdd={(type) => addBlock(i + 1, type)} />}
    </div>
  );
}
// büyük reklam alanının üstündeki araçlar + alt kenardan boyutlandırma
function DzHeroTools({ i, goTo, n }) {
  const { H, set, setSel, heroI } = useContext(DesignCtx);
  heroI.current = i;
  const ref = useRef(null);
  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const hero = ref.current.closest('.sh-hero'); const h0 = hero.getBoundingClientRect().height; const y0 = e.clientY;
    winOf(e).document.body.classList.add('dz-dragging');
    onDrag(e, (ev) => { const h = Math.round(Math.min(760, Math.max(260, h0 + ev.clientY - y0)) / 10) * 10; set('shopHome.heroH', h); });
  };
  const slides = H.slides || [];
  return (
    <div ref={ref} className="dz-hero" onClick={(e) => e.stopPropagation()}>
      <div className="dz-hero-bar">
        <span>{i + 1} / {n}. reklam</span>
        <button onClick={() => setSel({ kind: 'blk', k: 'hero' })}><Icon n="edit" s={14} />Düzenle</button>
        <button onClick={() => { set('shopHome.slides', [...slides, NEW.slide()]); setTimeout(() => goTo(slides.length), 80); setSel({ kind: 'blk', k: 'hero' }); }}><Icon n="plus" s={14} />Reklam ekle</button>
        {n > 1 && <button onClick={() => { set('shopHome.slides', slides.filter((_, j) => j !== i)); goTo(Math.max(0, i - 1)); }}><Icon n="trash" s={14} />Sil</button>}
      </div>
      <button className="dz-resize" onPointerDown={startResize} title="Tutup aşağı-yukarı çekin: yükseklik">
        <Icon n="vsize" s={15} />{H.heroH ? H.heroH + ' px' : 'Yükseklik'}
      </button>
    </div>
  );
}

function AddBetween({ onAdd, top }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'dz-add-between' + (open ? ' open' : '') + (top ? ' top' : '')} onClick={(e) => e.stopPropagation()}>
      <button className="dz-plus" onClick={() => setOpen(!open)} title="Buraya bölüm ekle"><Icon n={open ? 'x' : 'plus'} s={15} />{open ? 'Kapat' : 'Bölüm ekle'}</button>
      {open && <AddMenu onAdd={(t) => { onAdd(t); setOpen(false); }} />}
    </div>
  );
}

function AddBrand({ d, H, onAdd }) {
  const catalog = useStore((s) => s.catalog);
  const [q, setQ] = useState('');
  const BL = d.brandLogos || {};
  const have = new Set((H.brands || []).map((b) => norm(b.name || '')));
  const list = useMemo(() => {
    const m = new Map(); for (const p of catalog) if (p.b) m.set(p.b, (m.get(p.b) || 0) + 1);
    const logo = (n) => BL[n]?.logo || BL[Object.keys(BL).find((k) => norm(k) === norm(n))]?.logo;
    return [...m.entries()].filter(([n]) => !have.has(norm(n))).map(([n, c]) => [n, c, logo(n)]).sort((a, b) => (!!b[2] - !!a[2]) || b[1] - a[1]);
  }, [catalog, H.brands]);
  const t = norm(q);
  return <>
    <div className="search"><Icon n="search" s={18} /><input type="search" placeholder="Marka ara…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
    <div className="dz-brand-pick">
      {list.filter(([n]) => !t || norm(n).includes(t)).map(([n, c, logo]) => (
        <button key={n} onClick={() => onAdd(n)}>
          <span className="bl-thumb">{logo ? <ShopImg v={logo} alt="" /> : <b>{n.slice(0, 2)}</b>}</span>
          <span><b>{n}</b><small>{c} ürün{logo ? '' : ' · logo yok'}</small></span>
        </button>
      ))}
    </div>
  </>;
}
