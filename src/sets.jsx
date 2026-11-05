// Setler / ürün paketleri (31.10.2026). Tanımlar ayarlarda: settings.sets = [{ id, name, desc, items: [{ id, qty, pp }], on, stock: 'notify'|'skip', rm, at }]
// pp = ürünün paketteki birim fiyatı (eklenirken liste fiyatı gelir, yönetici değiştirebilir). Set fiyatı = Σ pp × adet.
// Sepette anahtar 's:<setId>' (müşteri "Elimde var" dediyse 's:<setId>~<çıkarılan ürünler . ile>') ve değeri set adedi.
// Siparişte ürünler tek tek yazılır, her kalemde set: { id, n, k } (bekçi fiyatı setin tanımından doğrular).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, go, setQty, toast, api, openProduct } from './store.js';
import { PageHead, SubNav, Icon, Thumb, Stepper, Sheet, Empty, Toggle, Confirm, openMenu } from './ui.jsx';
import { fmt, norm, now } from './utils.js';
import { queueSave } from './saveq.js';
import { ShareBtn } from './extras.jsx';
import { PriceBlock, cardAdd, cardCls, ProductSheet } from './catalog.jsx';
import { LineTL } from './storepay.jsx';

// Yönetim: Ürünler ⇄ Setler (31.10.2026, kullanıcı: Setler Ürünler'in içinde; Siparişler'deki seçicinin aynısı)
export function ProductsSwitch({ on }) {
  const nP = useStore((st) => st.catalog.length);
  const nS = useStore((st) => (st.settings.sets || []).length);
  return <SubNav label="Ürünler" items={[
    { k: 'products', icon: 'grid', label: 'Ürünler', count: nP, on: on === 'products', onClick: () => go('katalog') },
    { k: 'ai', icon: 'sparkle', label: 'Akıllı ekle', on: on === 'ai', onClick: () => go('aiekle') },
    { k: 'sets', icon: 'box', label: 'Setler', count: nS, on: on === 'sets', onClick: () => go('setler') },
  ]} />;
}

const r2 = (n) => Math.round(Number(n) * 100) / 100;
export const setsOf = (S) => (Array.isArray(S?.sets) ? S.sets : []);
export const liveSets = (S) => setsOf(S).filter((x) => x.on && (x.items || []).length);
export const setKey = (id, removed = []) => 's:' + id + (removed.length ? '~' + [...removed].map(Number).sort((a, b) => a - b).join('.') : '');
export const parseSetKey = (k) => { const m = /^s:([\w-]+)(?:~([\d.]+))?$/.exec(String(k)); return m ? { id: m[1], removed: m[2] ? m[2].split('.').map(Number) : [] } : null; };
const sellable = (p) => !!p && !!p.a && !p.so;

// ---- Set görünüm ayarları (1.11.2026): genel (Ayarlar › Ürünler › Setler, settings.setLook) + sete özel (set.look, boş = genel)
// price: kartlarda set fiyatı · rows: set sayfasında ürün satırı fiyatı 'pp' paketteki | 'list' site fiyatı (indirim toplamda) | 'none'
// compare: 'Ayrı ayrı → Set fiyatı' ve kazanç · cardSave: kartta kazanç yazısı · search: aramalarda setler de çıksın
export const SET_LOOK_DEF = { price: true, rows: 'pp', compare: true, cardSave: true, search: true };
export const setLookOf = (S, set) => ({ ...SET_LOOK_DEF, ...(S?.setLook || {}), ...(set?.look || {}) });
// Toplam indirimle fiyat: indirim ürünlerin liste fiyatına orantılı dağıtılır → her ürünün pp'si yazılır
// (bekçi siparişte pp ile doğrular, yani sunucu tarafı değişmez). Kuruş farkı adedi 1 olan en pahalı ürüne eklenir.
export function spreadOff(items, byId, off, unit) {
  const L = items.reduce((a, it) => a + (byId.get(Number(it.id))?.r || 0) * (it.qty || 1), 0);
  if (!(L > 0)) return items;
  const o = Math.max(0, Number(String(off).replace(',', '.')) || 0);
  const T = Math.max(0, unit === 'pct' ? L * (1 - Math.min(100, o) / 100) : L - o); const k = T / L;
  const out = items.map((it) => ({ ...it, pp: r2((byId.get(Number(it.id))?.r || 0) * k) }));
  const diff = r2(T - out.reduce((a, it) => a + it.pp * (it.qty || 1), 0));
  if (diff) { const j = out.map((it, i) => [i, it]).filter(([, it]) => (it.qty || 1) === 1).sort((a, b) => b[1].pp - a[1].pp)[0]?.[0]; if (j != null) out[j] = { ...out[j], pp: Math.max(0, r2(out[j].pp + diff)) }; }
  return out;
}
// aramada set: adı + açıklaması + içindeki ürün adları (hepsinde her kelime aranır; adda geçen öne)
export function searchSets(S, byId, q) {
  const t = norm(q).split(/\s+/).filter(Boolean); if (!t.length) return [];
  const out = [];
  for (const x of liveSets(S)) {
    if (setLookOf(S, x).search === false) continue;
    const head = norm((x.name || '') + ' ' + (x.desc || ''));
    const all = head + ' set paket ' + (x.items || []).map((it) => byId.get(Number(it.id))?._s || norm(byId.get(Number(it.id))?.n || '')).join(' ');
    if (!t.every((w) => all.includes(w))) continue;
    out.push([x, t.filter((w) => head.includes(w)).length]);
  }
  return out.sort((a, b) => b[1] - a[1]).map((y) => y[0]);
}

// Setin o anki hâli (çıkarılan ürünler ve stok kuralıyla)
export function setView(set, byId, removed = []) {
  const rm = new Set(removed.map(Number));
  const lines = (set.items || []).map((it) => {
    const p = byId.get(Number(it.id));
    const pp = Number(it.pp);
    const l = { id: Number(it.id), p, qty: Math.max(1, Math.floor(it.qty) || 1), pp: isFinite(pp) && pp >= 0 ? r2(pp) : r2(p?.r || 0), list: p?.r > 0 ? p.r : null, gone: !sellable(p), oos: sellable(p) && !(p.s > 0), off: rm.has(Number(it.id)) };
    l.auto = (l.gone || l.oos) && set.stock === 'skip'; // stokta olmayan ürün setten kendiliğinden düşer
    return l;
  });
  const active = lines.filter((l) => !l.off && !l.auto);
  const blocked = active.some((l) => l.gone || l.oos);
  const minN = Math.min(3, lines.length);
  const price = r2(active.reduce((a, l) => a + l.pp * l.qty, 0));
  const list = r2(active.reduce((a, l) => a + (l.list ?? l.pp) * l.qty, 0));
  const cur = active.find((l) => l.p)?.p.cur || 'USD';
  return { lines, active, price, list, save: Math.max(0, r2(list - price)), cur, blocked, ok: !blocked && active.length >= Math.max(1, minN), minN };
}

// Sepet kalemleri: set → ürünler tek tek (cart.jsx useCartItems çağırır)
export function setCartItems(cart, S, byId) {
  const out = [];
  const sets = new Map(liveSets(S).map((x) => [x.id, x]));
  for (const [k, q] of Object.entries(cart)) {
    const pk = parseSetKey(k); if (!pk) continue;
    const set = sets.get(pk.id); if (!set) continue;
    const v = setView(set, byId, set.rm === false ? [] : pk.removed); if (!v.ok) continue;
    for (const l of v.active) {
      const p = l.p;
      const it = { id: p.id, k: p.k, n: p.n, cur: p.cur || 'USD', qty: l.qty * q, list: p.r > 0 ? p.r : null, asked: l.pp, offer: l.pp, sk: k, sq: q, set: { id: set.id, n: set.name, k } };
      if (p.pi) it.pi = p.pi; if (p.u) it.u = p.u; if (p.img) it.img = p.img;
      out.push(it);
    }
  }
  return out;
}
// Sepetteki satır sayısı (set tek satır)
export const lineCount = (items) => items.filter((i) => !i.sk).length + new Set(items.filter((i) => i.sk).map((i) => i.sk)).size;

export function openSet(id) {
  try {
    history.replaceState({ ...(history.state || {}), tab: store.s.tab, setId: store.s.setId || null, y: scrollY }, '');
    history.pushState({ tab: 'set', setId: id }, '', '/magaza/set/' + id);
  } catch {}
  store.set({ tab: 'set', setId: id, acct: null, openOrder: null, urunLayer: false });
  window.scrollTo(0, 0);
}
export const setIdFromPath = () => { const m = /^\/(?:magaza\/)?set\/([\w-]+)/.exec(location.pathname); return m ? m[1] : null; };

// Kapak: ilk 4 ürünün resmi
export function SetCover({ v, n, bare }) {
  const ps = v.lines.map((l) => l.p).filter(Boolean).slice(0, 4);
  return (
    <span className={'set-cov n' + Math.min(4, ps.length) + (bare ? ' bare' : '')}>
      {ps.map((p, i) => <span key={p.id} className="set-cov-i">{<Thumb p={p} size={i === 0 ? 'lg' : 'sm'} />}{i === 3 && v.lines.length > 4 && <b className="set-cov-more">+{v.lines.length - 3}</b>}</span>)}
      {!bare && <span className="set-tag"><Icon n="box" s={12} />SET · {n ?? v.active.length} ÜRÜN</span>}
    </span>
  );
}

// Set kartı = ürün kartının aynısı (31.10.2026, kullanıcı: tutarsız görünüyordu): aynı kutu, aynı fiyat bloğu, aynı
// "Sepete ekle" düğmesi ve adet seçiciye aynı geçiş. Resim yerine setteki ürünlerin kolajı, üstte SET rozeti.
export function SetCard({ set, asLi = true }) {
  const byId = useStore((s) => s.byId);
  const S = useStore((s) => s.settings);
  const k = setKey(set.id);
  const qty = useStore((s) => s.cart[k] || 0);
  const v = useMemo(() => setView(set, byId), [set, byId]);
  const prevQ = useRef(qty); const [morph, setMorph] = useState('');
  useEffect(() => { const was = prevQ.current; prevQ.current = qty; if (!was && qty) setMorph('grow'); else if (was && !qty) setMorph('back'); }, [qty]);
  const ordersOn = S.orders?.enabled !== false;
  const pseudo = useMemo(() => ({ id: 's-' + set.id, n: set.name, r: v.price, cur: v.cur, s: v.ok ? 1 : 0, a: 1 }), [set, v]);
  const lk = setLookOf(S, set);
  const Tag = asLi ? 'li' : 'div';
  return (
    <Tag className="prow set-prow">
      <span className="pin-tag set-tag2"><Icon n="box" s={12} />SET · {v.active.length} ÜRÜN</span>
      <button className="prow-main" onClick={() => openSet(set.id)}>
        <span className="cimg set-cimg"><SetCover v={v} bare /></span>
        <div className="prow-info">
          <span className="prow-name">{set.name}</span>
          <span className="prow-meta">
            {v.ok ? <span className="dot tone-ok">Stokta</span> : <span className="dot tone-bad">Stokta değil</span>}
            {lk.price && lk.cardSave && v.save > 0 && <span className="set-save-l"><s>{fmt(v.list, v.cur)}</s> · {fmt(v.save, v.cur)} kazanç</span>}
          </span>
        </div>
      </button>
      <div className="prow-side">
        {lk.price ? <PriceBlock p={pseudo} /> : <button type="button" className="set-noprice" onClick={() => openSet(set.id)}>Seti inceleyin<Icon n="back" s={14} className="flip" /></button>}
        {!lk.price || !v.ok || !ordersOn ? null : qty > 0 ? (
          <span className={'qty-morph' + (morph === 'grow' ? ' grow' : '')}><Stepper small value={qty} onChange={(x) => setQty(k, x)} onRemove={() => setQty(k, 0)} /></span>
        ) : (
          <button className={'btn sm add' + (morph === 'back' ? ' back' : '')} onClick={() => { setQty(k, 1); toast('Set sepete eklendi'); }} aria-label="Seti sepete ekle" title="Seti sepete ekle"><Icon n="plus" s={15} className="add-plus" /><span className="add-cart" aria-hidden="true"><Icon n="cart" s={18} /><i>+</i></span><span className="add-l">Sepete ekle</span></button>
        )}
      </div>
    </Tag>
  );
}
export function SetGrid() {
  const S = useStore((s) => s.settings);
  const sets = liveSets(S);
  if (!sets.length) return <Empty icon="box" title="Şu an set yok"><p>Yakında ürün paketleri burada olacak.</p></Empty>;
  return <ul className={'plist pgrid ' + cardCls(S, 'public')}>{sets.map((x) => <SetCard key={x.id} set={x} />)}</ul>;
}
// Ana sayfa rafındaki kart = raftaki ürün kartının (PCard) aynısı
function SetRailCard({ set, i }) {
  const byId = useStore((s) => s.byId);
  const SS = useStore((s) => s.settings); const lk = setLookOf(SS, set); // seçici yeni nesne döndürmesin (sonsuz döngü)
  const k = setKey(set.id);
  const qty = useStore((s) => s.cart[k] || 0);
  const v = useMemo(() => setView(set, byId), [set, byId]);
  const prevQ = useRef(qty); const [morph, setMorph] = useState('');
  useEffect(() => { const was = prevQ.current; prevQ.current = qty; if (!was && qty) setMorph('grow'); else if (was && !qty) setMorph('back'); }, [qty]);
  const open = () => openSet(set.id);
  return (
    <div className="sh-card set-shcard" style={{ '--i': i }} onClick={(e) => { if (!e.target.closest('button, input, .stepper')) open(); }}>
      <button className="sh-card-img" onClick={open} aria-label={set.name}><SetCover v={v} bare /><span className="sh-new set-new"><Icon n="box" s={11} />SET · {v.active.length}</span></button>
      <div className="sh-card-b">
        <span className="sh-card-brand">{lk.price && lk.cardSave && v.save > 0 ? <><s>{fmt(v.list, v.cur)}</s> · {fmt(v.save, v.cur)} kazanç</> : v.active.length + ' ürün bir arada'}</span>
        <button className="sh-card-n" onClick={open}>{set.name}</button>
        <div className="sh-card-f">
          {lk.price ? <b className="sh-card-p">{fmt(v.price, v.cur)}</b> : <button type="button" className="set-noprice" onClick={open}>Seti inceleyin</button>}
          {!lk.price || !v.ok ? null : qty > 0
            ? <span className={'qty-morph' + (morph === 'grow' ? ' grow' : '')}><Stepper small value={qty} onChange={(x) => setQty(k, x)} onRemove={() => setQty(k, 0)} /></span>
            : <button className={'sh-add' + (morph === 'back' ? ' back' : '')} onClick={() => { setQty(k, 1); toast('Set sepete eklendi'); }} aria-label="Seti sepete ekle" title="Seti sepete ekle"><Icon n="cart" s={17} /><Icon n="plus" s={13} className="sh-add-plus" /></button>}
        </div>
      </div>
    </div>
  );
}
// Ana sayfa rafı (Tasarım modunda 'Setler' bölümü)
export function SetRail({ edit }) {
  const S = useStore((s) => s.settings);
  const sets = liveSets(S);
  if (!sets.length) return edit ? <div className="dz-empty">Setler rafı: yayında set yok (Yönetim › Ürünler › Setler)</div> : null;
  return (
    <section className="sh-sec rv set-rail">
      <div className="sh-head"><div><h2>Setler</h2><p>Birlikte daha uygun, tek tıkla sepette</p></div>
        <button type="button" className="sh-more" onClick={() => { store.set({ catalogGo: { sets: true } }); go('katalog'); }}>Tümü<Icon n="back" s={14} className="flip" /></button></div>
      <div className="sh-rail">{sets.map((x, i) => <SetRailCard key={x.id} set={x} i={i} />)}</div>
    </section>
  );
}
// Ürün penceresi / sayfası: "Bu ürün sette de var"
export function InSets({ p }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const sets = liveSets(S).filter((x) => x.items.some((it) => Number(it.id) === p.id));
  if (!sets.length) return null;
  return (
    <div className="in-sets">
      {sets.slice(0, 3).map((x) => { const v = setView(x, byId); const lk = setLookOf(S, x); return (
        <button key={x.id} type="button" className="in-set" onClick={() => openSet(x.id)}>
          <SetCover v={v} />
          <span className="in-set-t"><small>BU ÜRÜN SETTE DE VAR</small><b>{x.name}</b><em>{v.active.length} ürün{lk.price ? ' · ' + fmt(v.price, v.cur) : ''}{lk.price && lk.cardSave && v.save > 0 ? ' · ' + fmt(v.save, v.cur) + ' kazanç' : ''}</em></span>
          <Icon n="back" s={16} className="flip" />
        </button>
      ); })}
    </div>
  );
}

// ---- Müşterinin set sayfası (/set/<id>)
// 1.11.2026: başlıkta 'SET · N ÜRÜN', liste başlığında 'Sette N ürün var', fiyatlar tek sütunda hizalı, ürüne basınca
// sayfa değil pencere (ProductSheet) açılır; ürün satırı fiyatı ve 'Ayrı ayrı → Set fiyatı' ayarlardan (setLookOf).
export function SetPage({ id }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const cart = useStore((s) => s.cart);
  const set = liveSets(S).find((x) => x.id === id);
  const [removed, setRemoved] = useState([]);
  const [peek, setPeek] = useState(null);
  if (!set) return <div className="page narrow"><Empty icon="box" title="Set bulunamadı"><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty></div>;
  const v = setView(set, byId, removed);
  const lk = setLookOf(S, set);
  const canRm = set.rm !== false;
  const k = setKey(set.id, removed);
  const inCart = cart[k] || 0;
  const ordersOn = S.orders?.enabled !== false;
  const add = () => { setQty(k, inCart + 1); toast(inCart ? 'Set sepette ' + (inCart + 1) + ' adet' : 'Set sepete eklendi'); };
  const toggle = (l) => setRemoved(l.off ? removed.filter((x) => x !== l.id) : [...removed, l.id]);
  const n = v.active.length; const pcs = v.active.reduce((a, l) => a + l.qty, 0);
  const rowP = (l) => {
    if (lk.rows === 'none') return null;
    if (lk.rows === 'list') return <span className="set-row-p"><b className="num">{fmt((l.list ?? l.pp) * l.qty, v.cur)}</b>{l.qty > 1 && <small className="num">{l.qty} × {fmt(l.list ?? l.pp, v.cur)}</small>}</span>;
    return <span className="set-row-p">{l.list != null && l.list !== l.pp && <s className="num">{fmt(l.list * l.qty, v.cur)}</s>}<b className="num">{fmt(l.pp * l.qty, v.cur)}</b>{l.qty > 1 && <small className="num">{l.qty} × {fmt(l.pp, v.cur)}</small>}</span>;
  };
  return (
    <div className={'page set-page sp-rows-' + lk.rows + (canRm ? ' sp-rm' : '')}>
      <button type="button" className="back-btn" onClick={() => (history.state?.setId ? history.back() : go('katalog'))}><Icon n="back" s={16} />Geri</button>
      <div className="set-top">
        <div className="set-top-cov"><SetCover v={v} /></div>
        <div className="set-top-i">
          <span className="sp-badge"><Icon n="box" s={13} />SET · {n} ÜRÜN{pcs > n ? ' · ' + pcs + ' PARÇA' : ''}</span>
          <div className="set-th"><h1 className="set-t">{set.name}</h1><ShareBtn big url={location.origin + '/set/' + set.id} title={set.name} label="Seti paylaş" /></div>
          {set.desc && <p className="set-d">{set.desc}</p>}
          <div className="set-price">
            {lk.compare && v.save > 0 && <span className="set-pl"><small>Ayrı ayrı</small><s>{fmt(v.list, v.cur)}</s></span>}
            {lk.compare && v.save > 0 && <Icon n="back" s={18} className="flip set-arrow" />}
            <span className="set-pp"><small>Set fiyatı</small><b>{fmt(v.price, v.cur)}</b></span>
            {lk.compare && v.save > 0 && <span className="set-save">Sette {fmt(v.save, v.cur)} kazancınız var</span>}
          </div>
          {v.ok
            ? <button type="button" className="btn primary big set-add" onClick={add} disabled={!ordersOn}><Icon n="cart" s={18} />{inCart ? `Sepette · ${inCart} set · 1 daha ekle` : 'Seti sepete ekle'}</button>
            : <div className="banner warn"><Icon n="box" /><div>{v.blocked ? 'Setteki bazı ürünler şu an stokta değil.' : `Set en az ${v.minN} ürünle alınabilir.`}</div></div>}
          {inCart > 0 && <button type="button" className="link set-go" onClick={() => go('sepet')}>Sepete git →</button>}
        </div>
      </div>
      <div className="set-list">
        <div className="set-list-h"><b>Sette {n} ürün var</b>{canRm && <small>Elinizde olanı çıkarın, o ürünün paketteki fiyatı düşülür · en az {v.minN} ürün</small>}
          {removed.length > 0 && <button type="button" className="link" onClick={() => setRemoved([])}>Hepsini geri al</button>}</div>
        {v.lines.map((l, idx) => {
          const lock = !l.off && canRm && v.active.length <= v.minN;
          return (
            <div key={l.id} className={'set-row sp-row' + (l.off || l.auto ? ' off' : '')}>
              <span className="sp-i num">{idx + 1}</span>
              <button type="button" className="set-row-img" onClick={() => l.p && setPeek(l.p)} disabled={!l.p} aria-label="Ürünü incele">{l.p && <Thumb p={l.p} size="sm" />}</button>
              <button type="button" className="set-row-n" onClick={() => l.p && setPeek(l.p)} disabled={!l.p}>
                <b>{l.qty > 1 ? l.qty + ' × ' : ''}{l.p?.n || 'Ürün kaldırıldı'}</b>
                <small>{l.p?.b ? l.p.b + ' · ' : ''}{l.gone ? 'Satışta değil' : l.oos ? 'Stokta yok' : 'Stokta'}{l.auto ? ' · setten çıkarıldı' : ''}</small>
              </button>
              {rowP(l) || <span />}
              {canRm && (!l.auto ? <button type="button" className={'set-have' + (l.off ? ' on' : '')} onClick={() => toggle(l)} disabled={lock} title={lock ? `En az ${v.minN} ürün kalmalı` : ''}>{l.off ? <><Icon n="plus" s={13} />Sete geri ekle</> : 'Elimde var'}</button> : <span />)}
            </div>
          );
        })}
        {lk.rows !== 'none' && <div className="sp-sum">
          {(lk.rows === 'list' || (lk.compare && v.save > 0)) && <div className="sp-sl"><span>Ayrı ayrı toplam</span><span className="num">{fmt(v.list, v.cur)}</span></div>}
          {v.save > 0 && (lk.rows === 'list' || lk.compare) && <div className="sp-sl sp-off"><span>Set indirimi</span><span className="num">−{fmt(v.save, v.cur)}</span></div>}
          <div className="sp-sl sp-tot"><span>Set fiyatı</span><b className="num">{fmt(v.price, v.cur)}</b></div>
        </div>}
      </div>
      {peek && <ProductSheet p={peek} forceSheet onClose={() => setPeek(null)} />}
    </div>
  );
}

// ---- Sepette set satırı
export function SetCartLine({ group, onImg, rate }) { // rate: mağazada KDV dahil satış açıkken kur → satırlarda TL (storepay.jsx)
  const [open, setOpen] = useState(false);
  const { sk, sq, set, items } = group;
  const cur = items[0]?.cur || 'USD';
  const unit = r2(items.reduce((a, it) => a + it.offer * (it.qty / sq), 0));
  const list = r2(items.reduce((a, it) => a + (it.list ?? it.offer) * (it.qty / sq), 0));
  return (
    <>
      <div className="gline-p">
        <button type="button" className="gline-img set-gimg" onClick={() => openSet(set.id)} aria-label="Seti aç"><Thumb p={items[0]} size="sm" /><span className="set-gimg-b"><Icon n="box" s={11} /></span></button>
        <div className="cline-info gline-name">
          <button type="button" className="prow-name set-gname" onClick={() => openSet(set.id)}>{set.n}</button>
          <span className="prow-meta"><span className="set-mini">SET · {items.length} ürün</span>{list > unit && <span className="strike">{fmt(list, cur)}</span>}
            <button type="button" className="link set-open" onClick={() => setOpen(!open)}>{open ? 'İçeriği gizle' : 'Setin içini göster'}</button></span>
          {open && <ul className={'set-in' + (rate ? ' has-tl' : '')}>{items.map((it) => <li key={it.id}><span className="set-in-n">{it.qty / sq > 1 && <b className="num">{it.qty / sq} × </b>}{it.n}</span><span className="set-in-p num"><b>{fmt(it.offer * (it.qty / sq), cur)}</b>{rate && <LineTL v={it.offer * (it.qty / sq)} cur={cur} rate={rate} />}</span></li>)}</ul>}
        </div>
      </div>
      <div className="gline-ctl">
        <span className={'num gline-unit' + (rate ? ' has-tl' : '')} data-l="Birim">{fmt(unit, cur)}{rate && <LineTL v={unit} cur={cur} rate={rate} />}</span>
        <Stepper small min={1} value={sq} onChange={(v) => setQty(sk, v)} onRemove={() => setQty(sk, 0)} />
        <b className={'num gline-sum' + (rate ? ' has-tl' : '')}>{fmt(unit * sq, cur)}{rate && <LineTL v={unit * sq} cur={cur} rate={rate} />}</b>
        <button className="icon-btn sm" onClick={() => setQty(sk, 0)} aria-label="Sepetten çıkar"><Icon n="trash" s={16} /></button>
      </div>
    </>
  );
}

// ---- Yönetim: Setler (/admin/setler)
const rid = () => Math.random().toString(36).slice(2, 10);
function saveSets(sets) {
  const S = store.s.settings;
  store.set({ settings: { ...S, sets } });
  queueSave('settings', () => api().saveSettings(store.s.settings));
}
export function SetsAdmin() {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const sets = setsOf(S);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const menu = (e, x) => openMenu(e, [
    { label: 'Düzenle', icon: 'edit', onClick: () => setEdit(x) },
    { label: x.on ? 'Yayından kaldır' : 'Yayınla', icon: x.on ? 'eyeoff' : 'eye', onClick: () => saveSets(sets.map((y) => (y.id === x.id ? { ...y, on: !x.on } : y))) },
    { label: 'Kopyasını oluştur', icon: 'copy', onClick: () => setEdit({ ...x, id: null, name: x.name + ' (kopya)', on: false }) },
    x.on && { label: 'Mağazada aç', icon: 'ext', onClick: () => window.open('/set/' + x.id, '_blank', 'noopener') },
    '-',
    { label: 'Sil', icon: 'trash', danger: true, onClick: () => setDel(x) },
  ], x.name);
  return (
    <div className="page sets-admin adm-sub">
      <PageHead title="Setler" extra={<span className="muted"> · {sets.length}</span>} newLabel="Yeni set" onNew={() => setEdit({})} />
      <ProductsSwitch on="sets" />
      <p className="muted sa-hint">Birkaç ürünü tek pakette satın. Her ürüne pakete özel fiyat yazabilirsiniz; set fiyatı bu fiyatların toplamıdır. Yayındaki setler mağazada Ürünler › Setler'de, ana sayfadaki Setler rafında ve ürün sayfasında görünür.</p>
      {!sets.length ? <Empty icon="box" title="Henüz set yok"><button className="btn primary" onClick={() => setEdit({})}><Icon n="plus" s={16} />İlk seti oluştur</button></Empty> : (
        <div className="sa-list">
          {sets.map((x) => { const v = setView(x, byId); return (
            <div key={x.id} className="sa-row" onClick={() => setEdit(x)} onContextMenu={(e) => menu(e, x)}>
              <SetCover v={v} n={(x.items || []).length} />
              <div className="sa-t"><b>{x.name || 'Adsız set'}</b><small>{(x.items || []).length} ürün · liste {fmt(v.list, v.cur)} → <b>{fmt(v.price, v.cur)}</b>{!v.ok && <span className="sa-warn"> · {v.blocked ? 'stokta olmayan ürün var' : 'eksik ürün'}</span>}</small>
                {v.lines.some((l) => l.list != null && l.list < l.pp) && <small className="sa-warn">Bir ürünün liste fiyatı paketteki fiyatının altına düştü, kontrol edin</small>}</div>
              <span className={'sa-st' + (x.on ? ' on' : '')}>{x.on ? 'Yayında' : 'Taslak'}</span>
              <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); menu(e, x); }} aria-label="Menü"><Icon n="more" s={18} /></button>
            </div>
          ); })}
        </div>
      )}
      {edit && <SetEdit set={edit} onClose={() => setEdit(null)} onSave={(x) => { const has = sets.some((y) => y.id === x.id); saveSets(has ? sets.map((y) => (y.id === x.id ? x : y)) : [x, ...sets]); setEdit(null); toast(x.on ? 'Set kaydedildi · yayında' : 'Set taslak olarak kaydedildi'); }} />}
      {del && <Confirm title="Set silinsin mi?" text={`“${del.name}” silinecek. Sepetinde bu set olan müşterilerin sepetinden de düşer.`} okLabel="Sil" tone="danger" onOk={() => { saveSets(sets.filter((y) => y.id !== del.id)); toast('Set silindi'); }} onClose={() => setDel(null)} />}
    </div>
  );
}

function SetEdit({ set, onClose, onSave }) {
  const byId = useStore((s) => s.byId);
  const catalog = useStore((s) => s.catalog);
  const init = () => ({ id: set.id || null, name: set.name || '', desc: set.desc || '', on: !!set.on, stock: set.stock || 'notify', rm: set.rm !== false, mode: set.mode || 'items', off: String(set.off ?? ''), offU: set.offU || 'pct', look: set.look || null, items: (set.items || []).map((it) => ({ id: Number(it.id), qty: it.qty || 1, pp: String(it.pp ?? '') })) });
  const [f, setF] = useState(init);
  const [q, setQ] = useState('');
  const [ask, setAsk] = useState(false);
  const up = (p) => setF((x) => ({ ...x, ...p }));
  const upIt = (i, p) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...p } : it)) }));
  const res = useMemo(() => {
    const t = norm(q.trim()); if (t.length < 2) return [];
    const have = new Set(f.items.map((x) => x.id));
    return catalog.filter((p) => !have.has(p.id) && p.a && !p.so && (p._s || '').includes(t)).slice(0, 8);
  }, [q, catalog, f.items]);
  const num = (v) => { const n = Number(String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? n : 0; };
  const sum = r2(f.items.reduce((a, it) => a + (byId.get(it.id)?.r || 0) * it.qty, 0));
  // 'Toplam indirim' modunda paketteki fiyatlar indirimden hesaplanır (liste fiyatlarına orantılı)
  const tot = f.mode === 'total';
  const price = r2((tot ? spreadOff(f.items, byId, f.off, f.offU) : f.items).reduce((a, it) => a + num(it.pp) * it.qty, 0));
  const cur = byId.get(f.items[0]?.id)?.cur || 'USD';
  const dirty = JSON.stringify(f) !== JSON.stringify(init());
  const shown = tot ? spreadOff(f.items.map((it) => ({ ...it })), byId, f.off, f.offU).map((it) => ({ ...it, pp: String(it.pp) })) : f.items;
  const close = () => (dirty ? setAsk(true) : onClose());
  const ok = f.name.trim() && f.items.length >= 2 && (tot ? num(f.off) >= 0 : f.items.every((it) => String(it.pp).trim() !== '' && num(it.pp) >= 0));
  const save = (on) => {
    if (!f.name.trim()) return toast('Set adı yazın', 'bad');
    if (f.items.length < 2) return toast('Sete en az 2 ürün ekleyin', 'bad');
    const its = (tot ? spreadOff(f.items, byId, f.off, f.offU) : f.items).map((it) => ({ id: it.id, qty: Math.max(1, it.qty), pp: r2(num(it.pp)) }));
    const x = { id: f.id || rid(), name: f.name.trim(), desc: f.desc.trim(), on, stock: f.stock, rm: f.rm, at: now(), items: its, mode: f.mode };
    if (tot) { x.off = num(f.off); x.offU = f.offU; }
    if (f.look && Object.keys(f.look).length) x.look = f.look;
    onSave(x);
  };
  return (
    <Sheet wide sticky cls="set-edit" title={set.id ? 'Seti düzenle' : 'Yeni set'} onClose={close}
      footer={<div className="se-foot"><span className="se-sum">Liste {fmt(sum, cur)} → <b>Set {fmt(price, cur)}</b>{sum > price && <em> · müşteri {fmt(r2(sum - price), cur)} kazanır</em>}</span>
        <button type="button" className="btn outline" onClick={() => save(false)} disabled={!ok}>Taslak kaydet</button>
        <button type="button" className="btn primary" onClick={() => save(true)} disabled={!ok}><Icon n="check" s={16} />{f.on ? 'Kaydet' : 'Yayınla'}</button></div>}>
      <div className="se">
        <label className="field"><span className="field-l">Set adı</span><input value={f.name} onChange={(e) => up({ name: e.target.value })} placeholder="ör. Yeni Başlayan Tamir Seti" /></label>
        <label className="field"><span className="field-l">Kısa açıklama <small className="opt">(müşteri görür, isteğe bağlı)</small></span><textarea rows={2} value={f.desc} onChange={(e) => up({ desc: e.target.value })} placeholder="ör. Dükkân açan ustalar için başlangıç seti" /></label>
        <div className="se-mode">
          <span className="field-l">Set fiyatı nasıl belirlensin?</span>
          <span className="seg">{[['items', 'Ürün ürün fiyat yazarak'], ['total', 'Toplam indirim seçerek']].map(([x, l]) => <button key={x} type="button" className={f.mode === x ? 'on' : ''} onClick={() => up({ mode: x })}>{l}</button>)}</span>
          {tot && <div className="se-off">
            <label className="se-pp"><input inputMode="decimal" value={f.off} placeholder="0" onChange={(e) => up({ off: e.target.value })} aria-label="Toplam indirim" /></label>
            <span className="seg">{[['pct', '%'], ['amt', '$']].map(([x, l]) => <button key={x} type="button" className={f.offU === x ? 'on' : ''} onClick={() => up({ offU: x })}>{l}</button>)}</span>
            {f.offU === 'pct' && [5, 10, 15, 20].map((n) => <button key={n} type="button" className={'chip' + (num(f.off) === n ? ' on' : '')} onClick={() => up({ off: String(n) })}>%{n}</button>)}
            <small className="muted">İndirim ürünlerin liste fiyatına orantılı dağıtılır · liste {fmt(sum, cur)} → set {fmt(price, cur)}</small>
          </div>}
        </div>
        <div className="se-h"><b>Setteki ürünler</b><small>{f.items.length} ürün · {tot ? 'paketteki fiyatlar indirimden kendiliğinden hesaplanır' : 'eklenince liste fiyatıyla gelir, “Pakette” kutusuna pakete özel fiyat yazabilirsiniz'}</small>
          {!tot && f.items.some((it) => num(it.pp) !== (byId.get(it.id)?.r || 0)) && <button type="button" className="link" onClick={() => up({ items: f.items.map((it) => ({ ...it, pp: String(byId.get(it.id)?.r ?? it.pp) })) })}>Liste fiyatlarına dön</button>}</div>
        <div className="se-search">
          <div className="search"><Icon n="search" s={17} /><input autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Ürün adı veya stok kodu ile ekle…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {res.length > 0 && <div className="se-res">{res.map((p) => (
            <button key={p.id} type="button" className="se-r" onClick={() => { up({ items: [...f.items, { id: p.id, qty: 1, pp: String(p.r || 0) }] }); setQ(''); }}>
              <Thumb p={p} size="sm" /><span><b>{p.n}</b><small>{p.k}{!p.a ? ' · pasif' : !(p.s > 0) ? ' · stokta yok' : ''}</small></span><em>{fmt(p.r || 0, p.cur)}</em><span className="se-add">+ Ekle</span>
            </button>))}</div>}
        </div>
        {f.items.length > 0 && <div className="se-items">
          <div className="se-it se-ith"><span /><span>Ürün</span><span>Adet</span><span>Liste</span><span>Pakette (adet)</span><span /></div>
          {f.items.map((it0, i) => { const it = shown[i] || it0; const p = byId.get(it.id); const ch = p && num(it.pp) !== (p.r || 0); return (
            <div key={it.id} className="se-it">
              {p ? <Thumb p={p} size="sm" /> : <span />}
              <span className="se-n"><b>{p?.n || 'Ürün bulunamadı (#' + it.id + ')'}</b><small className={p && (!p.a || p.so || !(p.s > 0)) ? 'bad' : ''}>{p ? p.k + (!p.a || p.so ? ' · satışta değil' : !(p.s > 0) ? ' · stokta yok' : ' · stok ' + p.s) : ''}</small></span>
              <Stepper small min={1} value={it.qty} onChange={(v) => upIt(i, { qty: v })} />
              <span className={'se-l num' + (ch ? ' ch' : '')}>{p ? fmt(p.r || 0, p.cur) : '—'}</span>
              <label className={'se-pp' + (ch ? ' ch' : '') + (tot ? ' ro' : '')}><span>$</span><input inputMode="decimal" value={it.pp} readOnly={tot} onChange={(e) => upIt(i, { pp: e.target.value })} aria-label="Paketteki fiyat" /></label>
              <button type="button" className="icon-btn sm" onClick={() => up({ items: f.items.filter((_, j) => j !== i) })} aria-label="Çıkar"><Icon n="x" s={15} /></button>
            </div>
          ); })}
        </div>}
        <div className="se-opts">
          <div className="se-opt-h"><b>Setteki ürün stokta yoksa</b></div>
          <label className={'se-radio' + (f.stock === 'notify' ? ' on' : '')}><input type="radio" checked={f.stock === 'notify'} onChange={() => up({ stock: 'notify' })} /><span><b>Set satılmaz</b><small>“Setteki bazı ürünler şu an stokta değil” yazar</small></span></label>
          <label className={'se-radio' + (f.stock === 'skip' ? ' on' : '')}><input type="radio" checked={f.stock === 'skip'} onChange={() => up({ stock: 'skip' })} /><span><b>O ürün olmadan satılır</b><small>Fiyattan o ürünün paketteki fiyatı düşülür</small></span></label>
          <Toggle checked={f.rm} onChange={(v) => up({ rm: v })} label="Müşteri “Elimde var” diyebilsin" hint="Sahip olduğu ürünü setten çıkarır, en az 3 ürün kalır" />
        </div>
        <div className="se-opts">
          <div className="se-opt-h"><b>Bu setin görünümü</b></div>
          <Toggle checked={!f.look} onChange={(v) => up({ look: v ? null : { ...setLookOf(store.s.settings, null) } })} label="Genel set ayarlarını kullan" hint="Ayarlar › Ürünler › Setler" />
          {f.look && <SetLookFields L={f.look} up={(p) => up({ look: { ...f.look, ...p } })} />}
        </div>
      </div>
      {ask && <Confirm title="Değişiklikler kaydedilmedi" text="Kaydetmeden çıkılsın mı?" okLabel="Kaydetmeden çık" tone="danger" onOk={onClose} onClose={() => setAsk(false)} />}
    </Sheet>
  );
}

// ---- Set görünümü alanları (Ayarlar › Setler ve sete özel)
export function SetLookFields({ L, up }) {
  const v = { ...SET_LOOK_DEF, ...(L || {}) };
  return <div className="setlook">
    <Toggle checked={v.price} onChange={(x) => up({ price: x })} label="Kartlarda set fiyatını göster" hint="Kapalıysa kartta 'Seti inceleyin' yazar; fiyat set sayfasında görünür" />
    <label className="field"><span className="field-l">Set sayfasında ürün satırlarındaki fiyat</span>
      <span className="seg seg-wrap">{[['pp', 'Paketteki fiyat'], ['list', 'Site fiyatı · indirim toplamda'], ['none', 'Fiyat gösterme']].map(([x, l]) => <button key={x} type="button" className={v.rows === x ? 'on' : ''} onClick={() => up({ rows: x })}>{l}</button>)}</span>
      <small className="field-h">{v.rows === 'list' ? 'Her ürün sitedeki normal fiyatıyla görünür; altta “Ayrı ayrı toplam − Set indirimi = Set fiyatı” yazar.' : v.rows === 'pp' ? 'Her ürünün yanında pakete özel fiyatı (varsa üstü çizili liste fiyatıyla).' : 'Ürünler fiyatsız listelenir; sadece set fiyatı görünür.'}</small></label>
    <Toggle checked={v.compare} onChange={(x) => up({ compare: x })} label="“Ayrı ayrı → Set fiyatı” ve kazancı göster" />
    <Toggle checked={v.cardSave} onChange={(x) => up({ cardSave: x })} label="Kartlarda kazanç yazısı" hint="ör. “$412 · $40 kazanç”" />
    <Toggle checked={v.search} onChange={(x) => up({ search: x })} label="Aramalarda da çıksın" hint="Üstteki arama ve Ürünler araması, Setler filtresi seçilmese de seti gösterir" />
  </div>;
}
export function SetSettings({ d, set }) {
  const byId = useStore((s) => s.byId);
  const sets = setsOf(d);
  return <>
    <p className="fine">Bu ayarlar bütün setler için geçerlidir. Bir sete özel görünüm vermek için seti düzenleyip “Genel set ayarlarını kullan”ı kapatın.</p>
    <SetLookFields L={d.setLook} up={(p) => set('setLook', { ...(d.setLook || {}), ...p })} />
    <div className="setset-list">
      <div className="se-opt-h"><b>Setler</b><button type="button" className="link" onClick={() => go('setler')}>Setleri düzenle →</button></div>
      {!sets.length ? <p className="fine">Henüz set yok.</p> : sets.map((x, i) => { const v = setView(x, byId); return (
        <div key={x.id} className="setset-row">
          <span className="setset-t"><b>{x.name || 'Adsız set'}</b><small>{(x.items || []).length} ürün · {fmt(v.price, v.cur)} · {x.mode === 'total' ? 'toplam indirim ' + (x.offU === 'amt' ? fmt(x.off || 0, v.cur) : '%' + (x.off || 0)) : 'ürün ürün fiyat'}{x.look ? ' · kendi görünümü' : ''}</small></span>
          <Toggle checked={!!x.on} onChange={(on) => set('sets', sets.map((y, j) => (j === i ? { ...y, on } : y)))} label={x.on ? 'Yayında' : 'Taslak'} />
        </div>
      ); })}
    </div>
  </>;
}
