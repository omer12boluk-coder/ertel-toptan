// Tasarım modu v3 (7.11.2026): sade tasarım ekranı — solda Sayfa (bölümler: sırala, aç/kapa) | Görünüm (bütün sayfa için 5 ayar),
// ortada sayfanın kendisi (eski moddaki önizleme çerçevesi), sağda sadece seçilen bölümün birkaç ayarı.
// Eski tasarım modu silinmedi: üstteki "Gelişmiş" (cihazda ls 'dz-v' = 'old'); eski modda "Yeni tasarım modu" ile geri dönülür.
// Kayıt eski modla AYNI taslak (store.designDraft) ve aynı Yayınla akışı.
import { TA_OPTS } from './textanim.jsx';
import { HERO_FRAMES, HERO_PAGERS, HERO_STICK } from './heroframe.jsx';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, toast, go } from './store.js';
import { STYLE_PRESETS } from './stylekit.js';
import { PACKS } from './presets.js';
import { Icon, Confirm } from './ui.jsx';
import { withDefaults, norm, ls } from './utils.js';
import { ShopHome, DesignCtx, blockLabel, moveItem, withProdFallback, RailFields } from './shophome.jsx';
import { prepare, Stage, ShopDesigner } from './designer.jsx';
import { queueSave } from './saveq.js';
import { applyPreset, sameAs, CD, P0, APPLE, CORNERS, WIDTHS } from './dzpresets.js';
import { PB_BY, PB_TEXT, PHOTO_BANNERS, withNew2 } from './photobn.jsx';
import { HERO_W, HERO_FILL, cdOf, shortOf, CD_ADS, usePickList, useNewList } from './cdhome.jsx';
import { useBrandList } from './brandsets.jsx';
import { CD_KEYS } from './p0keys.js';
import { withFilm, filmsOf, filmCfg } from './filmblock.jsx';
import { liveSets } from './sets.jsx';
import { useHubRoots, HUB_IMG } from './catalog.jsx';
import { ImgPick } from './shophome.jsx';

const PREVIEW = typeof location !== 'undefined' && /--/.test(location.hostname);
const setPath = (obj, path, v) => { const n = structuredClone(obj); const ks = path.split('.'); let o = n; ks.slice(0, -1).forEach((k) => (o = o[k] = o[k] ?? {})); o[ks.at(-1)] = v; return n; };
export const useV3 = () => ls.get('dz-v', 'v3') !== 'old';
// Yönetim › Tasarım: v3 ya da eski mod (cihazda seçilir; değişince store.v3tick ile yeniden çizilir)
export function DesignEntry() { useStore((s) => s.v3tick); return useV3() ? <DesignV3 /> : <ShopDesigner />; }
export const toV3 = () => { ls.set('dz-v', 'v3'); store.set({ v3tick: Date.now() }); };
// önizlemedeki bölüm: tıklayınca seçilir (içindeki linkler/düğmeler çalışmaz). Modül düzeyinde (her çizimde yeniden kurulmasın)
const V3Sel = createContext(null);
function Block({ k, hidden: hd, children }) {
  const c = useContext(V3Sel);
  return <div className={'v3-blk' + (c?.sel === k ? ' on' : '') + (hd ? ' off' : '')} data-k={k} data-name={c ? blockLabel(k, c.H) : ''} onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); c?.select(k); }}>{hd ? <div className="v3-hid">{c ? blockLabel(k, c.H) : k} · gizli</div> : children}</div>;
}
const IC = { 'cd:hero': 'image', hero: 'image', 'p0:hero': 'image', 'cd:pick': 'star', 'cd:new': 'sparkle', 'cd:sets': 'box', 'cd:brands': 'tag', 'cd:mq': 'tag', 'cd:film': 'play', 'p0:find': 'search', 'p0:cats': 'grid', 'p0:trust': 'check', cta: 'wa' };
const NOTE = { 'p0:find': 'Telefon modelini yazınca uyan kalıp ve parçaları gösterir. Ayarı yok.', 'p0:trust': 'Avantaj yazılarınız (Orijinal ürün, Hızlı kargo…). Yazılar Gelişmiş’te.', 'p0:cats': 'Kategoriler ürün sayısına göre otomatik dizilir.', cta: 'WhatsApp alt bandı. Yazısı Gelişmiş’te.' };

function useMobile() {
  const q = '(max-width: 800px), (pointer: coarse)';
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener?.('change', f); return () => mq.removeEventListener?.('change', f); }, []);
  return m;
}
const Seg = ({ v, opts, on }) => <span className="v3-seg">{opts.map(([k, l]) => <button key={k} type="button" className={(v ?? '') === k ? 'on' : ''} onClick={() => on(k)}>{l}</button>)}</span>;
// 7.11.2026 (gece) yeni Ürünler sayfasının açılış sayfası: aç/kapat, kutu resimleri, gizlenecek kategoriler (shopHome.p0.hub)
function HubRows({ d, set }) {
  const L = d.look || {}; const P = d.shopHome?.p0 || {}; const C = P.hub || {};
  const up = (patch) => set('shopHome.p0', { ...P, hub: { ...C, ...patch } });
  const tiles = useHubRoots();
  const hid = new Set((C.hide2 || []).map(String));
  const tog = (id) => { const h = new Set(hid); h.has(String(id)) ? h.delete(String(id)) : h.add(String(id)); up({ hide2: [...h] }); };
  return <>
    <Row label="Ürünler açılış sayfası" hint="Açık: üst menüden Ürünler'e basınca önce kategori dizini gelir"><Seg v={L.prodHub ? 'on' : ''} opts={[['on', 'Açık'], ['', 'Kapalı']]} on={(k) => set('look.prodHub', k === 'on')} /></Row>
    {L.prodHub && <>
      <Row label="Tüm ürünler kutusu"><Seg v={C.allTone || 'acc'} opts={[['acc', 'Tema rengi'], ['dark', 'Siyah'], ['tint', 'Açık ton'], ['ring', 'Beyaz']]} on={(k) => up({ allTone: k === 'acc' ? undefined : k })} /></Row>
      <Row label="Setler kutusu"><Seg v={C.setTone || 'ring'} opts={[['acc', 'Tema rengi'], ['dark', 'Siyah'], ['tint', 'Açık ton'], ['ring', 'Beyaz']]} on={(k) => up({ setTone: k === 'ring' ? undefined : k })} /></Row>
      <Row label="Kutularda ürün resmi"><Seg v={C.imgMode || 'thumb'} opts={[['thumb', 'Küçük resim'], ['bg', 'Silik arka plan'], ['none', 'Yok']]} on={(k) => up({ imgMode: k === 'thumb' ? undefined : k })} /></Row>
      <Row label="Kategori dizilişi (bilgisayar)" hint="Liste: telefondaki gibi alt alta satırlar. Telefon görünümü değişmez"><Seg v={C.lay || ''} opts={[['', 'Kutular'], ['list', 'Liste'], ['list2', 'Liste (2 sütun)']]} on={(k) => up({ lay: k || undefined })} /></Row>
      <Row label="Alt kategori vurgusu" hint="Bilgisayarda alt kategorinin üstüne gelince yazının rengi"><Seg v={C.subHover || 'ink'} opts={[['ink', 'Siyah'], ['acc', 'Tema rengi']]} on={(k) => up({ subHover: k === 'ink' ? undefined : k })} /></Row>
      <Row label="Görünen kategoriler" hint="Kapattığın kategori açılış sayfasında görünmez (ürünleri yerinde kalır)"><span className="v3-seg wrap">{tiles.map((c) => <button key={c.id} type="button" className={hid.has(String(c.id)) ? '' : 'on'} onClick={() => tog(c.id)}>{c.name}</button>)}</span></Row>
      {(C.imgMode || 'thumb') !== 'none' && <><span className="v3-cap">Kategori resimleri</span>
        {tiles.filter((c) => !hid.has(String(c.id))).map((c) => <ImgPick key={c.id} v={(C.img2 || {})[c.id] || HUB_IMG[c.id] || ''} onChange={(v) => { const m = { ...(C.img2 || {}) }; if (v) m[c.id] = v; else delete m[c.id]; up({ img2: m }); }} label={c.name} hint="Ürün resmi seçebilir ya da yükleyebilirsin" prodOk />)}</>}
    </>}
  </>;
}
const Row = ({ label, hint, children }) => <label className="v3-f"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
const TF = ({ v, ph, on, area }) => (area ? <textarea rows={2} value={v || ''} placeholder={ph} onChange={(e) => on(e.target.value)} /> : <input value={v || ''} placeholder={ph} onChange={(e) => on(e.target.value)} />);

export function DesignV3() {
  const { settings, designDraft, api: A } = useStore();
  const d = designDraft || prepare(settings);
  const baseObj = useMemo(() => prepare(settings), [settings]);
  const dirty = !!designDraft && JSON.stringify(designDraft) !== JSON.stringify(baseObj);
  const mobile = useMobile();
  const [tab, setTab] = useState('page');
  const [sel, setSel] = useState(null);
  const [dev, setDevS] = useState(() => ls.get('dz3-dev', 'desk'));
  const setDev = (v) => { setDevS(v); ls.set('dz3-dev', v); };
  const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(null);
  const [sheet, setSheet] = useState(false); // 7.11.2026 (10) telefonda panel kapalı başlar (önizleme görünsün); parmakla çekilir
  const sheetRef = useRef(null); const drag = useRef(null);
  const hist = useRef({ list: [], redo: [], t: 0 }); const [, bump] = useState(0);
  const H = d.shopHome; const L = withFilm(H.layout || []); const hidden = new Set(H.hidden || []);
  const cdOn = !!d.look?.cd && L.includes('cd:hero');

  const set = (path, v) => {
    const cur = store.s.designDraft || prepare(store.s.settings); const now = Date.now();
    if (now - hist.current.t > 600) { hist.current.list.push(cur); if (hist.current.list.length > 80) hist.current.list.shift(); hist.current.redo = []; }
    hist.current.t = now; store.set({ designDraft: setPath(cur, path, v) });
  };
  const S = (k, v) => set('shopHome.' + k, v);
  const setAll = (next) => { const cur = store.s.designDraft || prepare(store.s.settings); hist.current.list.push(cur); hist.current.redo = []; hist.current.t = 0; store.set({ designDraft: next }); };
  const undo = () => { const h = hist.current; const p = h.list.pop(); if (!p) return; h.redo.push(store.s.designDraft || prepare(store.s.settings)); store.set({ designDraft: p }); h.t = 0; bump((x) => x + 1); };
  const redo = () => { const h = hist.current; const n = h.redo.pop(); if (!n) return; h.list.push(store.s.designDraft || prepare(store.s.settings)); store.set({ designDraft: n }); h.t = 0; bump((x) => x + 1); };
  useEffect(() => { const k = (e) => { if (e.target.closest?.('input, textarea, select')) return; const m = e.ctrlKey || e.metaKey; const c = (e.key || '').toLowerCase(); if (m && c === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if (m && (c === 'y' || (c === 'z' && e.shiftKey))) { e.preventDefault(); redo(); } else if (e.key === 'Escape') setSel(null); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); });
  useEffect(() => { if (!dirty) return; const h = (e) => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', h); return () => removeEventListener('beforeunload', h); }, [dirty]);
  useEffect(() => { document.documentElement.classList.toggle('dz2-open', !mobile); return () => document.documentElement.classList.remove('dz2-open'); }, [mobile]);

  async function save() {
    if (PREVIEW) {
      const x = JSON.parse(JSON.stringify(store.s.designDraft || prepare(store.s.settings)));
      ls.set('pv-design', { look: x.look, shopHome: x.shopHome, brand: x.brand, cards: x.cards, brandLogos: x.brandLogos });
      toast('Önizleme tasarımı bu tarayıcıya kaydedildi (canlı mağaza değişmedi). Mağaza yeni sekmede açılıyor.'); setTimeout(() => window.open('/', '_blank'), 400); return;
    }
    setBusy(true);
    try {
      try { const prev = { at: Date.now(), shopHome: baseObj.shopHome, look: baseObj.look, brandLogos: baseObj.brandLogos }; ls.set('dz-versions', [prev, ...ls.get('dz-versions', [])].slice(0, 12)); } catch {}
      const clean = withProdFallback(withDefaults(JSON.parse(JSON.stringify(store.s.designDraft))));
      store.set({ settings: clean, designDraft: null }); hist.current = { list: [], redo: [], t: 0 }; toast('Mağaza tasarımı yayınlandı');
      queueSave('settings', () => A.saveSettings(store.s.settings));
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const discard = () => setConfirm({ title: 'Değişiklikleri at', text: 'Yayınlanmamış değişiklikler silinecek.', okLabel: 'At', tone: 'danger', onOk: () => { store.set({ designDraft: null }); hist.current = { list: [], redo: [], t: 0 }; bump((x) => x + 1); } });
  const toOld = () => { ls.set('dz-v', 'old'); store.set({ v3tick: Date.now() }); };

  const toggleHide = (k) => S('hidden', hidden.has(k) ? [...hidden].filter((x) => x !== k) : [...hidden, k]);
  const move = (k, dir) => { const i = L.indexOf(k); const j = i + dir; if (i < 0 || j < 0 || j >= L.length) return; S('layout', moveItem(L, i, j)); };
  const select = (k) => { setSel(k); setTab('page'); setSheet(true); };

  const noop = () => {};
  const E = useMemo(() => ({ H, L, get: (k) => H[k], mobile, sel: null, select: noop, tapBlock: noop, setSel: noop, set, setL: (v) => S('layout', v), toggleHide, removeBlock: noop, addBlock: noop, heroI: { current: 0 }, heroGo: new Set(), guide: null, pack: null, blockMenu: null, Block, HeroTools: () => null, fxDrag: noop, fxResize: null, imDrag: null, xDrag: noop, xScale: noop, penDown: noop, tool: null, v3: true }), [d, mobile]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctx = { sel, select, H };
  const view = useMemo(() => withDefaults(d), [d]);

  const pagePanel = <PagePanel L={L} H={H} hidden={hidden} sel={sel} select={select} move={move} toggleHide={toggleHide} cdOn={cdOn} add={(k) => { const h = k === 'cd:new' ? L.findIndex((x) => x === 'cd:hero' || x === 'hero' || x === 'p0:hero') : -1; const i = h >= 0 ? h + 1 : L.indexOf('cta'); S('layout', i >= 0 ? [...L.slice(0, i), k, ...L.slice(i)] : [...L, k]); select(k); }} toCd={() => { setAll(applyPreset(d, CD.data)); toast('Claude düzeni yüklendi. Beğenirseniz Yayınla, vazgeçmek için Geri al.'); }} />;
  const lookPanel = <LookPanel d={d} set={set} setAll={setAll} A={A} />;
  const insp = sel ? <Inspector k={sel} d={d} H={H} S={S} close={() => setSel(null)} hidden={hidden.has(sel)} toggleHide={() => toggleHide(sel)} /> : null;

  const top = (
    <div className="v3-top">
      <button className="dz2-ib" onClick={() => go('ayarlar')} title="Çık (taslak kaybolmaz)"><Icon n="back" s={18} /></button>
      <span className="v3-title"><b>Tasarım</b><small>{PREVIEW ? 'Önizleme · Yayınla = sadece bu tarayıcı' : dirty ? 'Yayınlanmamış değişiklik var' : 'Mağaza ana sayfası'}</small></span>
      {!mobile && <Seg v={dev} opts={[['desk', 'Bilgisayar'], ['phone', 'Telefon'], ['both', 'Yan yana']]} on={setDev} />}
      <span className="v3-sp" />
      <button className="dz2-ib" onClick={undo} disabled={!hist.current.list.length} title="Geri al (Ctrl Z)"><Icon n="undo" s={17} /></button>
      <button className="dz2-ib" onClick={redo} disabled={!hist.current.redo.length} title="Yeniden yap"><Icon n="undo" s={17} className="dz2-flipx" /></button>
      {!mobile && <a className="dz2-ib" href="/" target="_blank" rel="noopener" title="Mağazayı yeni sekmede aç"><Icon n="ext" s={17} /></a>}
      <button className="btn sm ghost v3-adv" onClick={toOld} title="Eski tasarım modu: bütün ince ayarlar">Gelişmiş</button>
      {dirty && <button className="btn sm ghost" onClick={discard}>Vazgeç</button>}
      <button className={'btn sm primary' + (dirty ? ' live' : '')} onClick={save} disabled={busy || !dirty}><Icon n="check" s={15} />{busy ? 'Yayınlanıyor…' : dirty ? 'Yayınla' : 'Yayında'}</button>
    </div>
  );
  const tabs = <div className="v3-tabs"><button type="button" className={tab === 'page' ? 'on' : ''} onClick={() => setTab('page')}>Sayfa</button><button type="button" className={tab === 'look' ? 'on' : ''} onClick={() => { setTab('look'); setSel(null); }}>Görünüm</button></div>;

  if (mobile) return (
    <div className={'v3 v3-m' + (sheet ? ' sheet-up' : '')}>
      {top}
      <div className="v3-m-canvas"><V3Sel.Provider value={ctx}><DesignCtx.Provider value={E}><ShopHome S={view} /></DesignCtx.Provider></V3Sel.Provider></div>
      <div className="v3-m-sheet" ref={sheetRef}>
        <div className="v3-m-hd"
          onTouchStart={(e) => { drag.current = { y: e.touches[0].clientY, dy: 0 }; const el = sheetRef.current; if (el) el.style.transition = 'none'; }}
          onTouchMove={(e) => { const d = drag.current; if (!d) return; d.dy = e.touches[0].clientY - d.y; const el = sheetRef.current; if (!el) return; const base = sheet ? 0 : el.offsetHeight - 64; el.style.transform = `translateY(${Math.max(0, Math.min(el.offsetHeight - 64, base + d.dy))}px)`; }}
          onTouchEnd={() => { const d = drag.current; drag.current = null; const el = sheetRef.current; if (el) { el.style.transition = ''; el.style.transform = ''; } if (!d) return; if (Math.abs(d.dy) < 8) setSheet((x) => !x); else if (d.dy > 40) setSheet(false); else if (d.dy < -40) setSheet(true); }}
          onClick={(e) => { if (e.detail && !('ontouchstart' in window)) setSheet((x) => !x); }}>
          <i className="v3-m-grip" />
          <span className="v3-m-lbl">{sel ? 'Bölüm ayarları' : 'Bölümler ve görünüm'}<small>{sheet ? 'Aşağı çekin: sayfayı görün' : 'Yukarı çekin ya da dokunun'}</small></span>
        </div>
        {sel ? insp : <>{tabs}{tab === 'page' ? pagePanel : lookPanel}</>}
      </div>
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
  return (
    <div className="v3">
      {top}
      <div className="v3-body">
        <aside className="v3-left">{tabs}{tab === 'page' ? pagePanel : lookPanel}</aside>
        <V3Sel.Provider value={ctx}><Stage dev={dev} pw={390} view={view} E={E} d={d} pack={null} onFrame={() => () => {}} /></V3Sel.Provider>
        <aside className="v3-right">{insp || <div className="v3-empty"><Icon n="brush" s={22} /><b>Bir bölüm seçin</b><p>Soldaki listeden ya da sayfada bölümün üstüne tıklayın. Seçtiğiniz bölümün ayarları burada açılır.</p>
          {!cdOn && <p className="fine">Bu sade ekran en iyi <b>Claude düzeni</b> ile çalışır. Soldaki listenin üstünden geçebilirsiniz; eski düzeninize Geri al ya da Görünüm › Paket ile dönersiniz.</p>}</div>}</aside>
      </div>
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ---- Sol: Sayfa — bölümler (açık olanlar üstte sırayla, gizliler altta) ----
function PagePanel({ L, H, hidden, sel, select, move, toggleHide, cdOn, toCd, add }) {
  const [showOff, setShowOff] = useState(false);
  const on = L.filter((k) => !hidden.has(k)); const off = L.filter((k) => hidden.has(k));
  const row = (k, i, list) => (
    <div key={k} className={'v3-row' + (sel === k ? ' on' : '') + (hidden.has(k) ? ' off' : '')}>
      <button type="button" className="v3-row-n" onClick={() => select(k)}><Icon n={IC[k] || (k.startsWith('rail:') ? 'grid' : 'box')} s={15} /><span>{blockLabel(k, H)}</span></button>
      {!hidden.has(k) && <span className="v3-row-mv"><button type="button" disabled={i === 0} onClick={() => move(k, -(L.indexOf(k) - L.indexOf(list[i - 1])))} aria-label="Yukarı"><Icon n="up" s={14} /></button><button type="button" disabled={i === list.length - 1} onClick={() => move(k, L.indexOf(list[i + 1]) - L.indexOf(k))} aria-label="Aşağı"><Icon n="down" s={14} /></button></span>}
      <button type="button" className={'v3-tg' + (hidden.has(k) ? '' : ' on')} onClick={() => toggleHide(k)} aria-label={hidden.has(k) ? 'Göster' : 'Gizle'} title={hidden.has(k) ? 'Göster' : 'Gizle'} />
    </div>
  );
  return <div className="v3-page">
    {!cdOn && <div className="v3-cta"><b>Claude düzenine geç</b><p>Fotoğraflı bannerlar ve yeni bölümlerle sade ana sayfa. Hiçbir şey silinmez, eski reklamlarınız gizlenir.</p><button type="button" className="btn sm primary" onClick={toCd}>Geç</button></div>}
    <span className="v3-cap">Sayfadaki bölümler</span>
    {on.map((k, i) => row(k, i, on))}
    {off.length > 0 && <button type="button" className="v3-more" onClick={() => setShowOff((x) => !x)}><Icon n={showOff ? 'down' : 'back'} s={13} className={showOff ? '' : 'flip'} />Gizli bölümler ({off.length})</button>}
    {showOff && off.map((k, i) => row(k, i, off))}
    {cdOn && Object.keys(CD_KEYS).some((k) => !L.includes(k)) && <><span className="v3-cap">Eklenebilecek bölümler</span>
      {Object.entries(CD_KEYS).filter(([k]) => !L.includes(k)).map(([k, l]) => <button key={k} type="button" className="v3-more" onClick={() => add(k)}><Icon n="plus" s={13} />{l}</button>)}</>}
  </div>;
}

// ---- Sol: Görünüm — bütün sayfa için birkaç ayar ----
const ACCENTS = ['#2f62d6', '#1d1d1f', '#0b7a52', '#c2410c', '#b4232a', '#0e7490'];
// piksel kaydırıcısı (telefonda parmakla rahat): değer + 'sıfırla'
function Px({ label, v, def, min = 0, max, show, on }) {
  const val = v ?? def;
  return <div className="v3-px"><span><b>{label}</b><code>{show ? show(val) : val + ' px'}</code>{v != null && <button type="button" className="v3-px-r" onClick={() => on(undefined)}>sıfırla</button>}</span>
    <input type="range" min={min} max={max} step="1" value={val} onChange={(e) => on(Number(e.target.value))} /></div>;
}
function LookPanel({ d, set, setAll, A }) {
  const Lk = d.look || {}; const st = Lk.style || {};
  const acc = Lk.shopAccent || d.brand?.accent || '#2f62d6';
  const corner = CORNERS.find(([, , v]) => v.rHero === st.rHero)?.[0] || (st.rHero == null ? 'soft' : '');
  const font = st.head === 'intert' || (!st.head && Lk.cd) ? 'apple' : st.head ? 'other' : 'classic';
  const saved = useStore((s) => s.settings.dzPresets) || [];
  const packs = [CD, P0, APPLE, ...saved];
  const upSt = (patch) => { const n = { ...st, ...patch }; Object.keys(n).forEach((k) => (n[k] == null || n[k] === '') && delete n[k]); set('look.style', n); };
  return <div className="v3-look">
    <Row label="Ana renk" hint="Düğmeler, bağlantılar, seçili menü"><span className="v3-sw">{ACCENTS.map((c) => <button key={c} type="button" className={acc.toLowerCase() === c ? 'on' : ''} style={{ background: c }} onClick={() => set('look.shopAccent', c)} aria-label={c} />)}<input type="color" value={acc} onChange={(e) => set('look.shopAccent', e.target.value)} title="Başka renk" /></span></Row>
    <Row label="Köşeler" hint="Banner, kartlar ve düğmeler birlikte değişir"><Seg v={corner} opts={CORNERS.map(([k, l]) => [k, l])} on={(k) => set('look.style', { ...st, ...CORNERS.find((x) => x[0] === k)[2] })} /></Row>
    <Row label="Sayfa genişliği" hint="Banner hariç bütün bölümler (banner genişliği bannerın kendi ayarında)"><Seg v={Lk.width || ''} opts={WIDTHS.map(([k, l]) => [k, l])} on={(k) => set('look.width', k)} /></Row>
    <Row label="Yazı tipi"><Seg v={font} opts={[['apple', 'Apple sade'], ['classic', 'Klasik']]} on={(k) => set('look.style', k === 'apple' ? { ...st, head: 'intert', body: 'inter', price: 'intert' } : { ...st, head: '', body: '', price: '' })} /></Row>
    {Lk.header === 'center' && <Row label="Ortada logo menüsünde arama" hint="Bilgisayarda. Tam genişlik: logonun yanından açılan arama + son aramalar + size özel ürünler"><Seg v={Lk.hcSearch || ''} opts={[['', 'Tam genişlik'], ['old', 'Küçük kutu (eski)']]} on={(k) => set('look.hcSearch', k || undefined)} /></Row>}
    <Row label="Üst menü – banner arası" hint="Ana sayfada bannerın üstüne ek boşluk"><Seg v={String(Number(Lk.heroGap) || 0)} opts={[['0', 'Yok'], ['8', '+8'], ['16', '+16'], ['24', '+24'], ['36', '+36']]} on={(k) => set('look.heroGap', Number(k))} /></Row>
    <Row label="Ürünler sayfası" hint="Yeni: üstte yazılı kategoriler, Filtrele paneli, sade kart. Eski: sol kategori menüsü"><Seg v={Lk.prodV2 === false ? 'old' : ''} opts={[['', 'Yeni'], ['old', 'Eski']]} on={(k) => set('look.prodV2', k === 'old' ? false : undefined)} /></Row>
    {Lk.prodV2 !== false && <HubRows d={d} set={set} />}
    <Row label="Üstüne gelince" hint="Bilgisayarda kartların üstüne gelince"><Seg v={Lk.hoverFx || ''} opts={[['', 'Yeni'], ['old', 'Eski (kalkar)']]} on={(k) => set('look.hoverFx', k)} /></Row>
    <Row label="Gece modu" hint="Otomatik: ziyaretçinin telefonu gece modundaysa mağaza da koyu"><Seg v={d.brand?.theme === 'auto' ? 'auto' : 'light'} opts={[['auto', 'Otomatik'], ['light', 'Hep gündüz']]} on={(k) => set('brand.theme', k)} /></Row>
    {/* 7.11.2026 (11) telefonda da kullanılabilen basit ayarlar: hazır stiller, temalar, köşe pikselleri, gölge/çerçeve, boşluklar */}
    <span className="v3-cap">Hazır stiller</span>
    <div className="v3-sty">
      <button type="button" className={!st.preset ? 'on' : ''} onClick={() => set('look.style', {})}><i style={{ background: '#fff' }}><em /></i><b>Standart</b></button>
      {STYLE_PRESETS.map((p) => <button key={p.id} type="button" className={st.preset === p.id ? 'on' : ''} onClick={() => setAll({ ...d, look: { ...Lk, style: { ...p.s, preset: p.id }, ...(p.pal ? { shopAccent: p.pal.accent } : {}) } })}>
        <i style={{ background: p.pv[0] }}><em style={{ borderRadius: Math.min(10, p.s.rCard), background: p.pv[2], boxShadow: p.s.shadow === 'none' ? 'none' : '0 3px 8px -3px rgb(0 0 0 / .25)' }}><u style={{ background: p.pv[1] }} /></em></i><b>{p.n}</b></button>)}
    </div>
    <span className="v3-cap">Tema (zemin ve renk paketi)</span>
    <div className="v3-sty">
      <button type="button" className={!Lk.pack?.id ? 'on' : ''} onClick={() => set('look.pack', {})}><i style={{ background: '#f5f5f7' }} /><b>Yok</b></button>
      {PACKS.map((p) => <button key={p.id} type="button" className={Lk.pack?.id === p.id ? 'on' : ''} onClick={() => set('look.pack', { id: p.id, parts: {}, amt: 'md' })}><i style={{ background: `linear-gradient(135deg, ${(p.sw || []).join(', ')})` }} /><b>{p.n}</b></button>)}
    </div>
    <span className="v3-cap">Köşeler (piksel)</span>
    <Px label="Banner" v={st.rHero} def={30} max={48} on={(v) => upSt({ rHero: v })} />
    <Px label="Kutular" v={st.rBox} def={24} max={40} on={(v) => upSt({ rBox: v })} />
    <Px label="Ürün kartları" v={st.rCard} def={18} max={36} on={(v) => upSt({ rCard: v })} />
    <Px label="Düğmeler" v={st.rBtn === 999 ? 30 : st.rBtn} def={30} max={30} show={(v) => (v >= 30 ? 'Yuvarlak' : v + ' px')} on={(v) => upSt({ rBtn: v >= 30 ? 999 : v })} />
    <Row label="Gölge"><Seg v={st.shadow || ''} opts={[['', 'Standart'], ['none', 'Yok'], ['soft', 'Hafif'], ['strong', 'Belirgin']]} on={(k) => upSt({ shadow: k })} /></Row>
    <Row label="Çerçeve"><Seg v={st.border || ''} opts={[['', 'Standart'], ['none', 'Yok'], ['thin', 'İnce'], ['bold', 'Kalın']]} on={(k) => upSt({ border: k })} /></Row>
    <span className="v3-cap">Boşluklar (piksel)</span>
    <Px label="Bölümler arası" v={st.gap} def={44} min={16} max={96} on={(v) => upSt({ gap: v })} />
    <Px label="Sayfa kenarı (bilgisayar)" v={Lk.edge} def={16} max={80} on={(v) => set('look.edge', v)} />
    <span className="v3-cap">Paketler</span>
    <div className="v3-packs">{packs.map((p) => { const on = sameAs(d, p.data); return <button key={p.id} type="button" className={'v3-pack' + (on ? ' on' : '')} onClick={() => { setAll(applyPreset(d, p.data)); toast(p.name + ' yüklendi. Beğenirseniz Yayınla.'); }}><i>{(p.sw || []).slice(0, 4).map((c, j) => <b key={j} style={{ background: c }} />)}</i><span>{p.name}{on && <small>şu an bu</small>}</span></button>; })}</div>
    <p className="fine">Yazı tipi seçimi, menüler, cam ve geçişler gibi ince ayarlar üstteki <b>Gelişmiş</b> düğmesinde (bilgisayarda).</p>
  </div>;
}

// ---- Sağ: seçilen bölümün ayarları ----
function Inspector({ k, d, H, S, close, hidden, toggleHide }) {
  const body = k === 'cd:hero' || k === 'hero' || k === 'p0:hero' ? <HeroPanel H={H} S={S} k={k} />
    : k === 'cd:pick' ? <PickPanel H={H} S={S} d={d} />
    : k === 'cd:new' ? <NewPanel H={H} S={S} />
    : k === 'cd:sets' ? <SetsPanel H={H} S={S} d={d} />
    : k === 'cd:brands' ? <BrandsPanel H={H} S={S} />
    : k === 'cd:mq' ? <MqPanel H={H} S={S} />
    : k === 'cd:ads' ? <AdsPanel H={H} S={S} />
    : k === 'cd:film' ? <FilmPanel H={H} S={S} />
    : k.startsWith('rail:') ? <RailPanel H={H} S={S} k={k} />
    : <p className="fine">{NOTE[k] || 'Bu eski bir bölüm; ayrıntılı ayarları Gelişmiş tasarım modunda.'}</p>;
  return <div className="v3-insp">
    <div className="v3-insp-h"><button type="button" className="dz2-ib" onClick={close} aria-label="Kapat"><Icon n="back" s={17} /></button><b>{blockLabel(k, H)}</b>
      <button type="button" className={'v3-tg' + (hidden ? '' : ' on')} onClick={toggleHide} title={hidden ? 'Göster' : 'Gizle'} aria-label={hidden ? 'Göster' : 'Gizle'} /></div>
    {body}
  </div>;
}

// Banner: reklam listesi (aç/kapa, sıra, yazılar) + genişlik ve yükseklik
function HeroPanel({ H, S, k }) {
  const sl0 = H.slides || []; const sl = sl0.some((x) => x?.pb) ? withNew2(sl0) : sl0;
  const [open, setOpen] = useState(null);
  const up = (i, p) => S('slides', sl.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const mv = (i, dir) => { const j = i + dir; if (j < 0 || j >= sl.length) return; S('slides', moveItem(sl, i, j)); if (open === i) setOpen(j); };
  const name = (s, i) => (s.pb ? PB_BY[s.pb]?.name || s.pb : s.title || s.tag || (i + 1) + '. reklam');
  const missing = PHOTO_BANNERS.filter((b) => !sl.some((s) => s.pb === b.id));
  const pbIn = sl.some((s) => s.pb);
  return <>
    {!pbIn && <div className="v3-cta"><b>Fotoğraflı bannerlar listede değil</b><p>Şu an koddan ekleniyorlar. Listeye alırsanız her birinin yazısını, sırasını ve görünürlüğünü buradan yönetirsiniz.</p><button type="button" className="btn sm primary" onClick={() => S('slides', [...PHOTO_BANNERS.map((b) => ({ pb: b.id })), ...sl])}>Listeye al</button></div>}
    <Row label="Banner yazı animasyonu" hint="Banner her geldiğinde yazılar sırayla belirir"><Seg v={H.txtAnim || ''} opts={TA_OPTS} on={(v) => S('txtAnim', v || undefined)} /></Row>
    <Row label="Banner çerçevesi" hint="Bannerın etrafı: alttaki çizgiler, ürün rafı, kart destesi… İçindeki tasarım aynı kalır. Bugünkü = eski hâl"><Seg v={H.heroFrame || ''} opts={HERO_FRAMES} on={(v) => S('heroFrame', v || undefined)} /></Row>
    <Row label="Sayfa seçici" hint="Bugünkü ve Ortam ışığı çerçevesinde geçerli. Kapalı = hiç gösterme"><Seg v={H.heroPager || ''} opts={HERO_PAGERS} on={(v) => S('heroPager', v || undefined)} /></Row>
    <Row label="Ortada logo menüsünde" hint="Üst menü 'Ortada logo' iken banner menüye yapışık, kenardan kenara"><Seg v={H.heroStick || ''} opts={HERO_STICK} on={(v) => S('heroStick', v || undefined)} /></Row>
    <Row label="Banner imzası (telefon)" hint="Logomuzun telefondaki yeri. Bilgisayarda hep marka satırında"><Seg v={H.sigM || ''} opts={[['', 'Marka satırında'], ['corner', 'Sağ alt köşe']]} on={(v) => S('sigM', v || undefined)} /></Row>
    <Row label="Banner içi düğme köşesi" hint="Banner köşesinden bağımsız"><Seg v={String(H.chipR ?? '')} opts={[['', 'Banner gibi'], ['999', 'Yuvarlak'], ['12', 'Yumuşak'], ['6', 'Az'], ['0', 'Düz']]} on={(v) => S('chipR', v === '' ? undefined : Number(v))} /></Row>
    <span className="v3-cap">Bannerlar · {sl.filter((s) => !s.off).length} açık</span>
    <p className="fine">Kapalı olan sitede görünmez, silinmez. Fotoğraf ve yerleşim hazır şablondan gelir; yazıları değiştirebilirsiniz.</p>
    <div className="v3-bns">{sl.map((s, i) => (
      <div key={i} className={'v3-bn' + (s.off ? ' off' : '') + (open === i ? ' open' : '')}>
        <div className="v3-bn-h">
          <button type="button" className="v3-bn-n" onClick={() => setOpen(open === i ? null : i)}><span className={'v3-bn-k' + (s.pb ? ' pb' : '')}>{s.pb ? 'Foto' : 'Reklam'}</span><span>{name(s, i)}</span></button>
          <span className="v3-row-mv"><button type="button" disabled={i === 0} onClick={() => mv(i, -1)} aria-label="Yukarı"><Icon n="up" s={14} /></button><button type="button" disabled={i === sl.length - 1} onClick={() => mv(i, 1)} aria-label="Aşağı"><Icon n="down" s={14} /></button></span>
          <button type="button" className={'v3-tg' + (s.off ? '' : ' on')} onClick={() => up(i, { off: !s.off, offBy: undefined })} aria-label={s.off ? 'Aç' : 'Kapat'} />
        </div>
        {open === i && <div className="v3-bn-b">{s.pb ? PB_TEXT.map(([f, l]) => {
          const T = PB_BY[s.pb] || {}; const ph = f === 'c1' ? T.a1?.[0] : f === 'c2' ? T.a2?.[0] : T[f];
          return <Row key={f} label={l}><TF v={s[f]} ph={ph} area={f === 'title' || f === 'sub'} on={(v) => up(i, { [f]: v || undefined })} /></Row>;
        }) : <>
          <Row label="Üst yazı"><TF v={s.tag} on={(v) => up(i, { tag: v })} /></Row>
          <Row label="Başlık"><TF v={s.title} area on={(v) => up(i, { title: v })} /></Row>
          <Row label="Açıklama"><TF v={s.text} area on={(v) => up(i, { text: v })} /></Row>
          <Row label="Düğme"><TF v={s.cta} on={(v) => up(i, { cta: v })} /></Row>
          <p className="fine">Resim, renk ve yerleşim Gelişmiş’te.</p>
        </>}
        {s.pb && PB_BY[s.pb]?.imza !== false && <Row label="Banner imzası" hint="Logomuz marka logosunun yanında (telefonda sağ üstte)"><button type="button" className={'v3-tg' + (s.sig === false ? '' : ' on')} onClick={() => up(i, { sig: s.sig === false ? undefined : false })} aria-label={s.sig === false ? 'İmzayı aç' : 'İmzayı kapat'} /></Row>}
        {s.pb && <p className="fine">Boş bıraktığınız alan hazır yazıyı kullanır. Satır atlamak için Enter.</p>}</div>}
      </div>))}</div>
    {missing.length > 0 && pbIn && <div className="v3-addpb"><span className="v3-cap">Listede olmayan hazır bannerlar</span>{missing.map((b) => <button key={b.id} type="button" className="v3-more" onClick={() => S('slides', [{ pb: b.id }, ...sl])}><Icon n="plus" s={13} />{b.name}</button>)}</div>}
    <p className="v3-tip">Yeni banner mı istiyorsunuz? Sohbette Claude’a ürünü söyleyin, fotoğraflı banner hazırlasın.</p>
    {k === 'cd:hero' ? <>
      <span className="v3-cap">Banner yerleşimi</span>
      <Row label="Genişlik" hint="Sayfa genişliğinden ayrı. Kenardan kenara: ekranın iki ucuna kadar, köşesiz"><Seg v={H.heroW || ''} opts={HERO_W} on={(v) => S('heroW', v)} /></Row>
      <Row label="Yükseklik" hint="Ekranı doldur: banner, başladığı yerden ekranın altına kadar uzar"><Seg v={H.heroFill || ''} opts={HERO_FILL} on={(v) => S('heroFill', v)} /></Row>
    </> : <p className="fine">Genişlik ve yükseklik ayarı Claude düzenindeki banner bölümünde.</p>}
  </>;
}

// Bu hafta masamızdan: başlıklar + ürünler (seç, sırala, kısa ad)
function PickPanel({ H, S, d }) {
  const S0 = d;
  const C = cdOf(H).pick || {};
  const byId = useStore((s) => s.byId); const catalog = useStore((s) => s.catalog);
  const up = (p) => S('cd', { ...cdOf(H), pick: { ...C, ...p } });
  const ids = (C.ids || []).map(Number);
  const [q, setQ] = useState('');
  const hits = useMemo(() => { const t = norm(q).split(/\s+/).filter(Boolean); if (!t.length) return []; return catalog.filter((p) => p.a !== 0 && !p.so && !ids.includes(p.id) && t.every((w) => norm(p.n + ' ' + (p.b || '') + ' ' + (p.k || '')).includes(w))).slice(0, 8); }, [q, catalog, ids.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const names = C.names || {};
  const live = usePickList(C, S0);
  return <>
    <Row label="Üst yazı"><TF v={C.eye} ph="Tamircinin seçimi" on={(v) => up({ eye: v })} /></Row>
    <Row label="Başlık"><TF v={C.title} ph="Bu hafta masamızdan." on={(v) => up({ title: v })} /></Row>
    <Row label="Büyük kutudaki etiket"><TF v={C.badge} ph="Haftanın ürünü" on={(v) => up({ badge: v })} /></Row>
    <span className="v3-cap">5 ürün · ilki büyük kutuda</span>
    {ids.map((id, i) => { const p = byId.get(id); if (!p) return null; return <div key={id} className="v3-prod">
      <div className="v3-prod-h"><span className="v3-prod-n"><b>{p.n}</b><small>{i === 0 ? 'Büyük kutu · ' : ''}{p.b} · {p.k}</small></span>
        <span className="v3-row-mv"><button type="button" disabled={i === 0} onClick={() => up({ ids: moveItem(ids, i, i - 1) })} aria-label="Yukarı"><Icon n="up" s={14} /></button><button type="button" disabled={i === ids.length - 1} onClick={() => up({ ids: moveItem(ids, i, i + 1) })} aria-label="Aşağı"><Icon n="down" s={14} /></button></span>
        <button type="button" className="dz2-ib" onClick={() => up({ ids: ids.filter((x) => x !== id) })} aria-label="Çıkar"><Icon n="x" s={15} /></button></div>
      <input className="v3-short" value={names[id] || ''} placeholder="Kartta görünen ad (boşsa ürünün tam adı)" onChange={(e) => up({ names: { ...names, [id]: e.target.value || undefined } })} />
    </div>; })}
    {/* 7.11.2026 (7) boş yerler: kendiliğinden gelen ürün 'Otomatik' diye görünür, 'Sabitle' ile seçilenlere eklenir */}
    {live.filter((p) => !ids.includes(p.id)).map((p) => <div key={p.id} className="v3-prod auto">
      <div className="v3-prod-h"><span className="v3-prod-n"><b>{p.n}</b><small>Otomatik · {p.b} · {p.k}</small></span>
        <button type="button" className="v3-pin" onClick={() => up({ ids: [...ids, p.id] })}>Sabitle</button></div>
    </div>)}
    {ids.length < 5 && <div className="v3-search"><Icon n="search" s={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ids.length ? 'Ürün ekle (otomatik olanın yerine geçer)' : 'Ürün ekle: ad, marka ya da stok kodu'} />
      {hits.length > 0 && <div className="v3-hits">{hits.map((p) => <button key={p.id} type="button" onClick={() => { up({ ids: [...ids, p.id] }); setQ(''); }}><b>{shortOf(p).n}</b><small>{p.b} · {p.k}</small></button>)}</div>}</div>}
    <label className="v3-chk"><input type="checkbox" checked={C.auto !== false} onChange={(e) => up({ auto: e.target.checked })} /><span>Boş kalan yerleri öne çıkanlar ve yeni gelenlerle doldur</span></label>
  </>;
}
function SetsPanel({ H, S, d }) {
  const C = cdOf(H).sets || {};
  const live = liveSets(d);
  const up = (p) => S('cd', { ...cdOf(H), sets: { ...C, ...p } });
  const ids = C.ids || [];
  return <>
    <Row label="Üst yazı"><TF v={C.eye} ph="Atölyeni kur" on={(v) => up({ eye: v })} /></Row>
    <Row label="Başlık"><TF v={C.title} ph="Birlikte al, daha az öde." on={(v) => up({ title: v })} /></Row>
    <Row label="Kaç set"><Seg v={String(Number(C.n) || 3)} opts={[['1', '1'], ['2', '2'], ['3', '3']]} on={(v) => up({ n: Number(v) })} /></Row>
    <span className="v3-cap">Gösterilecek setler {ids.length ? '(seçtikleriniz, bu sırayla)' : '(seçmezseniz yayındaki setler sırayla)'}</span>
    {live.length ? live.map((x) => <label key={x.id} className="v3-chk"><input type="checkbox" checked={ids.includes(x.id)} onChange={(e) => up({ ids: e.target.checked ? [...ids, x.id] : ids.filter((y) => y !== x.id) })} /><span>{x.name}</span></label>)
      : <p className="fine">Yayında set yok. Setleri Yönetim › Setler’den hazırlayın.</p>}
    <p className="fine">Setin ürünleri ve fiyatı Yönetim › Setler’de düzenlenir.</p>
  </>;
}
// 7.11.2026 (8) Yeni gelenler: sıra kendiliğinden (geliş anı); istenirse ürün öne sabitlenir ya da gizlenir
function NewPanel({ H, S }) {
  const C = cdOf(H).nw || {};
  const up = (p) => S('cd', { ...cdOf(H), nw: { ...C, ...p } });
  const byId = useStore((s) => s.byId); const catalog = useStore((s) => s.catalog);
  const pins = (C.ids || []).map(Number); const hide = (C.hide || []).map(Number);
  const [q, setQ] = useState('');
  const hits = useMemo(() => { const t = norm(q).split(/\s+/).filter(Boolean); if (!t.length) return []; return catalog.filter((p) => p.a !== 0 && !p.so && !pins.includes(p.id) && t.every((w) => norm(p.n + ' ' + (p.b || '') + ' ' + (p.k || '')).includes(w))).slice(0, 8); }, [q, catalog, pins.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const auto = useNewList({ ...C, ids: [] }).slice(0, 14);
  return <>
    <Row label="Kapak yazısı (üst)"><TF v={C.eye} ph="Yeni gelenler" on={(v) => up({ eye: v })} /></Row>
    <Row label="Kapak başlığı" hint="Boşsa: 'Bu hafta N yeni ürün.'"><TF v={C.title} ph="Bu hafta 12 yeni ürün." on={(v) => up({ title: v })} /></Row>
    <Row label="Kaç ürün"><Seg v={String(Number(C.n) || 12)} opts={[['8', '8'], ['12', '12'], ['16', '16'], ['24', '24']]} on={(v) => up({ n: Number(v) })} /></Row>
    <span className="v3-cap">Öne sabitlenenler</span>
    {pins.map((id, i) => { const p = byId.get(id); if (!p) return null; return <div key={id} className="v3-row"><span className="v3-row-n"><span>{p.n}</span></span>
      <span className="v3-row-mv"><button type="button" disabled={i === 0} onClick={() => up({ ids: moveItem(pins, i, i - 1) })} aria-label="Yukarı"><Icon n="up" s={14} /></button><button type="button" disabled={i === pins.length - 1} onClick={() => up({ ids: moveItem(pins, i, i + 1) })} aria-label="Aşağı"><Icon n="down" s={14} /></button></span>
      <button type="button" className="dz2-ib" onClick={() => up({ ids: pins.filter((x) => x !== id) })} aria-label="Çıkar"><Icon n="x" s={15} /></button></div>; })}
    <div className="v3-search"><Icon n="search" s={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün sabitle: ad, marka ya da stok kodu" />
      {hits.length > 0 && <div className="v3-hits">{hits.map((p) => <button key={p.id} type="button" onClick={() => { up({ ids: [...pins, p.id] }); setQ(''); }}><b>{p.n}</b><small>{p.b} · {p.k}</small></button>)}</div>}</div>
    <span className="v3-cap">Kendiliğinden gelenler (en yeni önde)</span>
    {auto.map((p) => <div key={p.id} className="v3-row"><span className="v3-row-n"><span>{p.n}</span></span>
      <button type="button" className="v3-pin" onClick={() => up({ hide: [...hide, p.id] })}>Gizle</button></div>)}
    {hide.length > 0 && <><span className="v3-cap">Gizlenenler</span>{hide.map((id) => { const p = byId.get(id); return <div key={id} className="v3-row off"><span className="v3-row-n"><span>{p?.n || id}</span></span><button type="button" className="v3-pin" onClick={() => up({ hide: hide.filter((x) => x !== id) })}>Geri al</button></div>; })}</>}
    <p className="fine">Stokta olmayan ve resmi olmayan ürünler gösterilmez. Kapaktaki düğme Tüm ürünler’i ‘Yeni gelenler’ sıralamasıyla açar.</p>
  </>;
}
// 7.11.2026 (7) Markalar: kaç SIRA (ekran genişliğine göre tam sıra dolar, yarım sıra kalmaz) + istenen markalar elle, istenen sırayla
function BrandsPanel({ H, S }) {
  const C = cdOf(H).brands || {};
  const up = (p) => S('cd', { ...cdOf(H), brands: { ...C, ...p } });
  const all = useBrandList();
  const ids = C.ids || [];
  const [q, setQ] = useState('');
  const rest = all.filter((b) => !ids.includes(b.n) && (!q || norm(b.n).includes(norm(q))));
  return <>
    <Row label="Üst yazı"><TF v={C.eye} ph="Markalar" on={(v) => up({ eye: v })} /></Row>
    <Row label="Başlık"><TF v={C.title} ph="Tüm markalar." on={(v) => up({ title: v })} /></Row>
    <Row label="Kaç sıra" hint="Sıra tam dolar; ekran daralınca sıradaki marka sayısı azalır"><Seg v={String(Number(C.rows) || 0)} opts={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['0', 'Hepsi']]} on={(v) => up({ rows: Number(v), n: 0 })} /></Row>
    <label className="v3-chk"><input type="checkbox" checked={!!C.logosOnly} onChange={(e) => up({ logosOnly: e.target.checked })} /><span>Sadece logosu olan markalar</span></label>
    <span className="v3-cap">{ids.length ? 'Seçtiğiniz markalar (bu sırayla önde)' : 'Marka seçmezseniz en çok ürünü olan önde'}</span>
    {ids.map((n, i) => <div key={n} className="v3-row"><span className="v3-row-n"><span>{n}</span></span>
      <span className="v3-row-mv"><button type="button" disabled={i === 0} onClick={() => up({ ids: moveItem(ids, i, i - 1) })} aria-label="Yukarı"><Icon n="up" s={14} /></button><button type="button" disabled={i === ids.length - 1} onClick={() => up({ ids: moveItem(ids, i, i + 1) })} aria-label="Aşağı"><Icon n="down" s={14} /></button></span>
      <button type="button" className="dz2-ib" onClick={() => up({ ids: ids.filter((x) => x !== n) })} aria-label="Çıkar"><Icon n="x" s={15} /></button></div>)}
    {ids.length > 0 && <label className="v3-chk"><input type="checkbox" checked={C.only !== false} onChange={(e) => up({ only: e.target.checked })} /><span>Sadece seçtiklerim (kapalıysa kalan yerleri diğer markalar doldurur)</span></label>}
    <div className="v3-search"><Icon n="search" s={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marka ekle" /></div>
    <div className="v3-bpick">{rest.slice(0, q ? 30 : 40).map((b) => <button key={b.n} type="button" onClick={() => { up({ ids: [...ids, b.n] }); setQ(''); }}>{b.n}<small>{b.c}</small></button>)}</div>
  </>;
}
function TextPanel({ H, S, part, eye, title, n }) {
  const C = cdOf(H)[part] || {};
  const up = (p) => S('cd', { ...cdOf(H), [part]: { ...C, ...p } });
  return <>
    <Row label="Üst yazı"><TF v={C.eye} ph={eye} on={(v) => up({ eye: v })} /></Row>
    <Row label="Başlık"><TF v={C.title} ph={title} on={(v) => up({ title: v })} /></Row>
    {n && <Row label="Kaç marka"><Seg v={String(Number(C.n) || n[0][0])} opts={n.map(([a, b]) => [String(a), b])} on={(v) => up({ n: Number(v) })} /></Row>}
    <p className="fine">Marka logoları Yönetim › Ayarlar › Markalar’dan gelir; en çok ürünü olan marka önde.</p>
  </>;
}
function AdsPanel({ H, S }) {
  const C = cdOf(H).ads || {}; const off = new Set(C.off || []);
  const up = (p) => S('cd', { ...cdOf(H), ads: { ...C, ...p } });
  return <>
    <Row label="Üst yazı"><TF v={C.eye} ph="Keşfet" on={(v) => up({ eye: v })} /></Row>
    <Row label="Başlık"><TF v={C.title} ph="Atölyen için." on={(v) => up({ title: v })} /></Row>
    <span className="v3-cap">Reklamlar · kendiliğinden kaymaz, elle kaydırılır</span>
    {CD_ADS.map((a) => <div key={a.id} className={'v3-row' + (off.has(a.id) ? ' off' : '')}><span className="v3-row-n"><span>{a.title.replace(/\n/g, ' ')}</span></span>
      <button type="button" className={'v3-tg' + (off.has(a.id) ? '' : ' on')} onClick={() => up({ off: off.has(a.id) ? [...off].filter((x) => x !== a.id) : [...off, a.id] })} aria-label="Aç / kapat" /></div>)}
    <p className="v3-tip">Yeni reklam kutusu mu istiyorsunuz? Sohbette Claude’a ürünü söyleyin, fotoğraflı hazırlasın.</p>
  </>;
}
// 8.11.2026 Tanıtım videosu: başlık, kendiliğinden başlama, ses düğmesi, video sırası + aç/kapa (shopHome.cd.film)
function FilmPanel({ H, S }) {
  const C = filmCfg(H); const { all } = filmsOf(H); const off = new Set(C.off || []);
  const up = (p) => S('cd', { ...cdOf(H), film: { ...C, ...p } });
  const mv = (i, dir) => { const ids = all.map((f) => f.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; up({ ids }); };
  return <>
    <Row label="Üst yazı" hint="Boşsa videonun ürün adı"><TF v={C.eye} ph={all[0]?.name || ''} on={(v) => up({ eye: v })} /></Row>
    <Row label="Başlık"><TF v={C.title} ph="Yakından bak." on={(v) => up({ title: v })} /></Row>
    <Row label="Kendiliğinden başlasın" hint="Ekrana gelince bir kez oynar, son karede durur"><Seg v={C.auto === false ? 'no' : ''} opts={[['', 'Açık'], ['no', 'Kapalı']]} on={(v) => up({ auto: v === 'no' ? false : undefined })} /></Row>
    <Row label="Müzik düğmesi" hint="Gizlerseniz video hep sessiz oynar"><Seg v={C.music === false ? 'no' : ''} opts={[['', 'Göster'], ['no', 'Gizle']]} on={(v) => up({ music: v === 'no' ? false : undefined })} /></Row>
    {C.music !== false && <Row label="Ses" hint="Tarayıcılar sesi ziyaretçi sayfaya dokunana kadar açtırmaz; 'Açık başlasın' seçilince ilk dokunuşta / tıklamada müzik kendiliğinden girer"><Seg v={C.sound === 'on' ? 'on' : ''} opts={[['', 'Kapalı başlasın'], ['on', 'Açık başlasın']]} on={(v) => up({ sound: v === 'on' ? 'on' : undefined })} /></Row>}
    <span className="v3-cap">Videolar · açık olanlar sırayla oynar</span>
    {all.map((f, i) => <div key={f.id} className={'v3-row' + (off.has(f.id) ? ' off' : '')}><span className="v3-row-n"><span>{f.name}</span></span>
      <span className="v3-row-mv"><button type="button" disabled={i === 0} onClick={() => mv(i, -1)} aria-label="Yukarı"><Icon n="up" s={14} /></button><button type="button" disabled={i === all.length - 1} onClick={() => mv(i, 1)} aria-label="Aşağı"><Icon n="down" s={14} /></button></span>
      <button type="button" className={'v3-tg' + (off.has(f.id) ? '' : ' on')} onClick={() => up({ off: off.has(f.id) ? [...off].filter((x) => x !== f.id) : [...off, f.id] })} aria-label="Aç / kapat" /></div>)}
    <p className="v3-tip">Yeni video mu istiyorsunuz? Sohbette Claude’a “… geldi, tanıtım videosu hazırla” deyin.</p>
  </>;
}
function MqPanel({ H, S }) {
  const C = cdOf(H).mq || {};
  const up = (p) => S('cd', { ...cdOf(H), mq: { ...C, ...p } });
  return <>
    <Row label="Üstteki yazı" hint="Boş bırakırsanız yazı görünmez"><TF v={C.eye ?? 'Orijinal ürün, distribütör güvencesi'} on={(v) => up({ eye: v })} /></Row>
    <Row label="Hız"><Seg v={String(Number(C.speed) || 40)} opts={[['24', 'Yavaş'], ['40', 'Normal'], ['64', 'Hızlı']]} on={(v) => up({ speed: Number(v) })} /></Row>
  </>;
}
function RailPanel({ H, S, k }) {
  const i = (H.sections || []).findIndex((r, j) => 'rail:' + (r.id || j) === k); const sec = H.sections?.[i];
  if (!sec) return <p className="fine">Raf bulunamadı.</p>;
  const up = (p) => S('sections', H.sections.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return <>
    <Row label="Üst yazı" hint="İsteğe bağlı (başlığın üstündeki küçük yazı)"><TF v={sec.sub} on={(v) => up({ sub: v })} /></Row>
    <RailFields x={sec} up={up} />
  </>;
}
