// Yönetim paneli > Tasarım: mağaza ana sayfasını, mağazanın kendisi üzerinde düzenleme.
// Bölümler seçilir, sürüklenip sıralanır, gizlenir; marka / reklam kutuları elle taşınır; büyük reklam alanı
// alt kenarından tutulup boyutlandırılır; araya başlık, ürün rafı ya da görsel bant eklenir.
// Değişiklikler Ayarlar'daki aynı kayda (settings.shopHome + settings.brandLogos) yazılır: iki taraf hep aynı.
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, api, toast, go } from './store.js';
import { Icon, Field, Toggle, Confirm } from './ui.jsx';
import { withDefaults, norm } from './utils.js';
import { ShopHome, DesignCtx, FxFields, FX_NAMES, layoutOf, blockLabel, dragSort, moveItem, rid, NEW, Rows, SlideFields, UspFields, PromoFields, RailFields, BrandFields, BlockFields, ScaleField, MQ_STYLES, ShopImg } from './shophome.jsx';

// raflara kalıcı kimlik ver, eski sıra kayıtlarını (rail:0) kimliğe çevir
function prepare(S) {
  const d = structuredClone(S);
  const H = (d.shopHome = d.shopHome || {});
  const old = H.sections || [];
  H.sections = old.map((r) => (r.id ? r : { ...r, id: rid() }));
  if (Array.isArray(H.layout)) H.layout = H.layout.map((k) => { const m = /^rail:(\d+)$/.exec(k); return m && old[Number(m[1])] && !old[Number(m[1])].id ? 'rail:' + H.sections[Number(m[1])].id : k; });
  H.layout = layoutOf(H);
  H.blocks = H.blocks || {};
  return d;
}
const setPath = (obj, path, v) => { const n = structuredClone(obj); const ks = path.split('.'); let o = n; ks.slice(0, -1).forEach((k) => (o = o[k] = o[k] ?? {})); o[ks.at(-1)] = v; return n; };

export function ShopDesigner() {
  const { settings, designDraft, api: A } = useStore();
  const d = designDraft || prepare(settings);
  const base = useMemo(() => JSON.stringify(prepare(settings)), [settings]);
  const dirty = !!designDraft && JSON.stringify(designDraft) !== base;
  const [sel, setSel] = useState(null);   // açık ayar paneli
  const [pick, setPick] = useState(null); // telefonda dokunarak seçilen (sadece seçer, panel açmaz)
  const mobile = useMobile();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [width, setWidth] = useState('full');
  const hist = useRef({ list: [], t: 0 });
  const heroI = useRef(0);
  const H = d.shopHome;

  // her değişiklik geri alınabilir (sürükleme gibi art arda gelenler tek adım sayılır)
  const set = (path, v) => {
    const cur = store.s.designDraft || prepare(store.s.settings);
    const now = Date.now();
    if (now - hist.current.t > 600) { hist.current.list.push(cur); if (hist.current.list.length > 60) hist.current.list.shift(); }
    hist.current.t = now;
    store.set({ designDraft: setPath(cur, path, v) });
  };
  const undo = () => { const prev = hist.current.list.pop(); if (prev) { store.set({ designDraft: prev }); hist.current.t = 0; } };
  useEffect(() => {
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input, textarea, [contenteditable="true"]')) { e.preventDefault(); undo(); } if (e.key === 'Escape') setSel(null); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  useEffect(() => { if (!dirty) return; const h = (e) => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', h); return () => removeEventListener('beforeunload', h); }, [dirty]);

  async function save() {
    setBusy(true);
    try { const clean = withDefaults(store.s.designDraft); await A.saveSettings(clean); store.set({ settings: clean, designDraft: null }); hist.current.list = []; toast('Mağaza tasarımı kaydedildi'); }
    catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const discard = () => setConfirm({ title: 'Değişiklikleri at', text: 'Kaydedilmemiş tasarım değişiklikleri silinecek.', okLabel: 'At', tone: 'danger', onOk: () => { store.set({ designDraft: null }); hist.current.list = []; setSel(null); } });

  const L = H.layout;
  const setL = (n) => set('shopHome.layout', n);
  const select = (kind, i) => {
    if (kind === 'promo' && i === -1) { const n = [...(H.promos || []), NEW.promo()]; set('shopHome.promos', n); (mobile ? setPick : setSel)({ kind: 'promo', i: n.length - 1 }); return; }
    if (kind === 'brand' && i === -1) { setSel({ kind: 'brand', i: -1 }); return; }
    const v = kind === 'brand' || kind === 'promo' ? { kind, i } : { kind: 'blk', k: kind };
    if (mobile) setPick(v); else setSel(v);
  };
  const tapBlock = (k) => (mobile ? setPick({ kind: 'blk', k }) : setSel({ kind: 'blk', k }));
  function addBlock(at, type) {
    let key;
    if (type === 'rail') { const r = NEW.rail(); set('shopHome.sections', [...H.sections, r]); key = 'rail:' + r.id; }
    else { const id = rid(); set('shopHome.blocks', { ...H.blocks, [id]: type === 'banner' ? { t: 'banner', img: '', link: '', h: 0 } : { t: 'head', title: 'Yeni başlık', sub: '', align: 'left', size: 'md' } }); key = 'b:' + id; }
    const n = [...L]; n.splice(at, 0, key); setL(n); if (mobile) setPick({ kind: 'blk', k: key }); setSel({ kind: 'blk', k: key });
  }
  function removeBlock(k) {
    if (k.startsWith('rail:')) set('shopHome.sections', H.sections.filter((r) => 'rail:' + r.id !== k));
    else { const b = { ...H.blocks }; delete b[k.slice(2)]; set('shopHome.blocks', b); }
    setL(L.filter((x) => x !== k)); setSel(null); setPick(null);
  }
  const toggleHide = (k) => { const h = new Set(H.hidden || []); h.has(k) ? h.delete(k) : h.add(k); set('shopHome.hidden', [...h]); };

  const get = (k) => (store.s.designDraft || prepare(store.s.settings)).shopHome[k];
  // reklam içindeki öğeyi sürükleyerek taşı; hiç kımıldamazsa seç
  const fxDrag = (e, slide, el) => {
    if (e.button > 0) return;
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY; const f0 = get('slides')[slide]?.fx?.[el] || {}; let moved = false;
    const mv = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; document.body.classList.add('dz-dragging'); setSel({ kind: 'fx', slide, el }); }
      const sl = get('slides'); const cur = sl[slide]; if (!cur) return;
      set('shopHome.slides', sl.map((x, j) => (j === slide ? { ...x, fx: { ...(x.fx || {}), [el]: { ...f0, x: Math.round((f0.x || 0) + dx), y: Math.round((f0.y || 0) + dy) } } } : x)));
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.classList.remove('dz-dragging'); if (!moved) setSel({ kind: 'fx', slide, el }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  const E = { H, L, get, fxDrag, mobile, sel: mobile ? pick : sel, tapBlock, setSel, select, set, setL, toggleHide, removeBlock, addBlock, heroI, Block: DzBlock, HeroTools: DzHeroTools };
  const view = useMemo(() => withDefaults(d), [d]);

  return (
    <div className={'page dz-page' + (sel ? ' has-panel' : '') + (mobile ? ' dz-mobile' : '') + (mobile && pick ? ' has-pick' : '')}>
      <div className="dz-top">
        <span className="dz-title"><Icon n="brush" s={18} /><b>Tasarım modu</b><small>{mobile ? 'Bir bölüme ya da kutuya dokunun, alttaki düğmelerle düzenleyin' : 'Mağaza ana sayfası · bölüme tıklayın, tutup sürükleyin'}</small></span>
        {!mobile && <span className="dz-dev" role="group" aria-label="Önizleme genişliği">
          <button className={width === 'full' ? 'on' : ''} onClick={() => setWidth('full')} title="Bilgisayar"><Icon n="monitor" s={16} /></button>
          <button className={width === 'phone' ? 'on' : ''} onClick={() => setWidth('phone')} title="Telefon genişliği (yaklaşık)"><Icon n="mobile" s={16} /></button>
        </span>}
        <button className="btn sm ghost" onClick={undo} disabled={!hist.current.list.length} title="Geri al (Ctrl+Z)"><Icon n="undo" s={15} />Geri al</button>
        <a className="btn sm ghost" href="/magaza" target="_blank" rel="noopener"><Icon n="ext" s={15} />Mağazayı aç</a>
        {dirty && <button className="btn sm ghost" onClick={discard}>Vazgeç</button>}
        <button className="btn sm primary" onClick={save} disabled={busy || !dirty}><Icon n="check" s={15} />{busy ? 'Kaydediliyor…' : dirty ? 'Kaydet' : 'Kaydedildi'}</button>
      </div>
      {!(H.layout || []).length && <p className="fine">Bölüm yok.</p>}
      <div className={'dz-canvas w-' + width}>
        <DesignCtx.Provider value={E}>
          {!mobile && <AddBetween onAdd={(type) => addBlock(0, type)} top />}
          <ShopHome S={view} />
        </DesignCtx.Provider>
      </div>
      {mobile && pick && !sel && <MobileBar pick={pick} setPick={setPick} H={H} d={d} set={set} setSel={setSel} L={L} setL={setL} toggleHide={toggleHide} removeBlock={removeBlock} addBlock={addBlock} />}
      {sel && <Panel sel={sel} d={d} H={H} set={set} close={() => setSel(null)} heroI={heroI.current} removeBlock={removeBlock} setSel={setSel} />}
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
const SIZES_CYCLE = ['sq', 'wide', 'tall', 'big'];
const SIZE_NAMES = { sq: 'Kare', wide: 'Geniş', tall: 'Uzun', big: 'Büyük' };
// telefonda seçilen öğe için alttaki düğme çubuğu: dokunma sadece seçer, değişiklik buradaki net düğmelerle yapılır
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
        {[['head', 'Başlık'], ['rail', 'Ürün rafı'], ['banner', 'Görsel bant']].map(([t, l]) => <button key={t} onClick={() => { addBlock(L.indexOf(pick.k) + 1, t); setAdding(false); }}><Icon n="plus" s={15} />{l}</button>)}
      </div>}
      <div className="dz-mbar-b">{btns}</div>
    </div>
  );
}

// bölüm çerçevesi: üstte araç çubuğu (sürükle, sıra, gizle, ayar, sil), altta "Bölüm ekle"
function DzBlock({ k, i, hidden, children }) {
  const { H, L, get, sel, setSel, tapBlock, mobile, setL, toggleHide, removeBlock, addBlock } = useContext(DesignCtx);
  const on = sel?.kind === 'blk' && sel.k === k;
  const custom = k.startsWith('rail:') || k.startsWith('b:');
  return (
    <div className={'dz-blk' + (on ? ' dz-on' : '') + (hidden ? ' dz-hid' : '')} data-dz="sec" data-i={i} onClick={() => tapBlock(k)}>
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
    document.body.classList.add('dz-dragging');
    const mv = (ev) => { const h = Math.round(Math.min(760, Math.max(260, h0 + ev.clientY - y0)) / 10) * 10; set('shopHome.heroH', h); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.classList.remove('dz-dragging'); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
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
      {open && <div className="dz-add-menu">
        <button onClick={() => { onAdd('head'); setOpen(false); }}><b>Başlık</b><small>Büyük başlık + alt yazı</small></button>
        <button onClick={() => { onAdd('rail'); setOpen(false); }}><b>Ürün rafı</b><small>Yeni gelenler, marka, kategori…</small></button>
        <button onClick={() => { onAdd('banner'); setOpen(false); }}><b>Görsel bant</b><small>Tam genişlik resim, tıklanabilir</small></button>
      </div>}
    </div>
  );
}

// sağdaki ayar paneli: seçilen bölümün / kutunun alanları
function Panel({ sel, d, H, set, close, heroI, removeBlock, setSel }) {
  const S = (k, v) => set('shopHome.' + k, v);
  let title = '', body = null;
  if (sel.kind === 'brand') {
    if (sel.i === -1) { title = 'Marka ekle'; body = <AddBrand d={d} H={H} onAdd={(name) => { const n = [...(H.brands || []), NEW.brand(name)]; S('brands', n); setSel({ kind: 'brand', i: n.length - 1 }); }} />; }
    else {
      const b = H.brands[sel.i]; if (!b) return null;
      title = 'Marka kutusu · ' + (b.name || '');
      body = <>
        <p className="fine">Kutuyu tutup sürükleyerek yerini değiştirin.</p>
        <BrandFields b={b} up={(p) => S('brands', H.brands.map((x, j) => (j === sel.i ? { ...x, ...p } : x)))} d={d} set={set} />
        <button className="btn sm ghost danger" onClick={() => { S('brands', H.brands.filter((_, j) => j !== sel.i)); close(); }}><Icon n="trash" s={15} />Kutuyu kaldır</button>
      </>;
    }
  } else if (sel.kind === 'fx') {
    const sl = H.slides[sel.slide]; if (!sl) return null;
    const f = sl.fx?.[sel.el] || {};
    const upF = (p) => S('slides', H.slides.map((x, j) => (j === sel.slide ? { ...x, fx: { ...(x.fx || {}), [sel.el]: { ...f, ...p } } } : x)));
    const reset = () => S('slides', H.slides.map((x, j) => { if (j !== sel.slide) return x; const fx = { ...(x.fx || {}) }; delete fx[sel.el]; return { ...x, fx }; }));
    title = (sel.slide + 1) + '. reklam · ' + FX_NAMES[sel.el];
    body = <>
      <FxFields f={f} up={upF} reset={reset} />
      <button type="button" className="btn sm outline" onClick={() => setSel({ kind: 'blk', k: 'hero' })}><Icon n="edit" s={15} />Reklamın yazı ve görselleri</button>
    </>;
  } else if (sel.kind === 'promo') {
    const x = H.promos[sel.i]; if (!x) return null;
    title = 'Reklam kutusu · ' + (x.title || sel.i + 1);
    body = <>
      <p className="fine">Kutuyu tutup sürükleyerek yerini değiştirin; boyutu aşağıdan seçin.</p>
      <PromoFields x={x} up={(p) => S('promos', H.promos.map((y, j) => (j === sel.i ? { ...y, ...p } : y)))} />
      <button className="btn sm ghost danger" onClick={() => { S('promos', H.promos.filter((_, j) => j !== sel.i)); close(); }}><Icon n="trash" s={15} />Kutuyu sil</button>
    </>;
  } else {
    const k = sel.k;
    title = blockLabel(k, H);
    if (k === 'hero') body = <>
      <Field label="Yükseklik" hint="Reklam alanının alt kenarındaki tutamaçla da çekebilirsiniz. 0 = otomatik"><span className="she-scale"><input type="range" min="0" max="760" step="10" value={Number(H.heroH) || 0} onChange={(e) => S('heroH', Number(e.target.value) < 260 ? 0 : Number(e.target.value))} /><code>{Number(H.heroH) ? H.heroH + ' px' : 'otomatik'}</code></span></Field>
      <Rows list={H.slides || []} set={(v) => S('slides', v)} max={8} sub="Reklam ekle" openIdx={heroI} title={(s, i) => `${i + 1}. ${s.title || 'Reklam'}`} add={() => S('slides', [...(H.slides || []), NEW.slide()])} render={(s, up) => <SlideFields s={s} up={up} />} />
    </>;
    else if (k === 'usps') body = <Rows list={H.usps || []} set={(v) => S('usps', v)} max={4} sub="Avantaj ekle" openIdx={0} title={(u, i) => u.title || `${i + 1}. avantaj`} add={() => S('usps', [...(H.usps || []), NEW.usp()])} render={(u, up) => <UspFields u={u} up={up} />} />;
    else if (k === 'marquee') body = <>
      <Field label="Görünüm"><select value={H.marquee || 'color'} onChange={(e) => S('marquee', e.target.value)}>{Object.entries(MQ_STYLES).map(([x, l]) => <option key={x} value={x}>{l}</option>)}</select></Field>
      <Field label="Hız" hint="Bir turun süresi; küçük = hızlı"><span className="she-scale"><input type="range" min="15" max="120" step="1" value={Number(H.mqSpeed) || 46} onChange={(e) => S('mqSpeed', Number(e.target.value))} /><code>{Number(H.mqSpeed) || 46} sn</code></span></Field>
      <ScaleField v={Number(H.brandLogoScale) || 1} onChange={(v) => S('brandLogoScale', v)} label="Tüm logoların boyutu" />
      <p className="fine">Şeritte marka kutularındaki markalar döner; tek tek logo boyutu için bir marka kutusuna tıklayın.</p>
    </>;
    else if (k === 'brands') body = <>
      <Field label="Başlık"><input value={H.brandsTitle || ''} placeholder="Markalar" onChange={(e) => S('brandsTitle', e.target.value)} /></Field>
      <Field label="Alt yazı" opt><input value={H.brandsSub ?? 'Dünyanın önde gelen tamir ekipmanı üreticileri'} onChange={(e) => S('brandsSub', e.target.value)} /></Field>
      <Field label="Kutu büyüklüğü"><span className="seg">{[['sm', 'Küçük'], ['md', 'Orta'], ['lg', 'Büyük']].map(([x, l]) => <button key={x} type="button" className={(H.brandSize || 'md') === x ? 'on' : ''} onClick={() => S('brandSize', x)}>{l}</button>)}</span></Field>
      <ScaleField v={Number(H.brandLogoScale) || 1} onChange={(v) => S('brandLogoScale', v)} label="Tüm logoların boyutu" />
      <p className="fine">Kutuları tutup sürükleyerek sıralayın. Bir kutuya tıklayınca o markanın logosu, rengi ve logo boyutu açılır (Ayarlar &gt; Markalar ile aynı kayıt).</p>
    </>;
    else if (k === 'promos') body = <>
      <Field label="Başlık"><input value={H.promosTitle || ''} placeholder="Öne çıkanlar" onChange={(e) => S('promosTitle', e.target.value)} /></Field>
      <p className="fine">Kutuları tutup sürükleyerek sıralayın, tıklayınca içeriği ve boyutu açılır.</p>
    </>;
    else if (k === 'cta') body = <>
      <Field label="Başlık"><input value={H.cta?.title || ''} placeholder="Boşsa bant görünmez" onChange={(e) => S('cta', { ...(H.cta || {}), title: e.target.value })} /></Field>
      <Field label="Yazı" opt><input value={H.cta?.text || ''} onChange={(e) => S('cta', { ...(H.cta || {}), text: e.target.value })} /></Field>
    </>;
    else if (k.startsWith('rail:')) { const i = H.sections.findIndex((r) => 'rail:' + r.id === k); const x = H.sections[i]; if (!x) return null; body = <><RailFields x={x} up={(p) => S('sections', H.sections.map((r, j) => (j === i ? { ...r, ...p } : r)))} /><button className="btn sm ghost danger" onClick={() => removeBlock(k)}><Icon n="trash" s={15} />Rafı sil</button></>; }
    else if (k.startsWith('b:')) { const id = k.slice(2); const b = H.blocks[id]; if (!b) return null; body = <><BlockFields b={b} up={(p) => S('blocks', { ...H.blocks, [id]: { ...b, ...p } })} /><button className="btn sm ghost danger" onClick={() => removeBlock(k)}><Icon n="trash" s={15} />Bölümü sil</button></>; }
  }
  return (
    <aside className="dz-panel" aria-label="Seçilen öğenin ayarları">
      <div className="dz-panel-h"><b>{title}</b><button className="icon-btn sm" onClick={close} aria-label="Kapat"><Icon n="x" s={16} /></button></div>
      <div className="dz-panel-b">{body}</div>
    </aside>
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
