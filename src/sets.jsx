// Setler / ürün paketleri (31.10.2026). Tanımlar ayarlarda: settings.sets = [{ id, name, desc, items: [{ id, qty, pp }], on, stock: 'notify'|'skip', rm, at }]
// pp = ürünün paketteki birim fiyatı (eklenirken liste fiyatı gelir, yönetici değiştirebilir). Set fiyatı = Σ pp × adet.
// Sepette anahtar 's:<setId>' (müşteri "Elimde var" dediyse 's:<setId>~<çıkarılan ürünler . ile>') ve değeri set adedi.
// Siparişte ürünler tek tek yazılır, her kalemde set: { id, n, k } (bekçi fiyatı setin tanımından doğrular).
import { useMemo, useState } from 'react';
import { useStore, store, go, setQty, toast, api, openProduct } from './store.js';
import { Icon, Thumb, Stepper, Sheet, Empty, Toggle, Confirm, openMenu } from './ui.jsx';
import { fmt, norm, now } from './utils.js';
import { queueSave } from './saveq.js';

const r2 = (n) => Math.round(Number(n) * 100) / 100;
export const setsOf = (S) => (Array.isArray(S?.sets) ? S.sets : []);
export const liveSets = (S) => setsOf(S).filter((x) => x.on && (x.items || []).length);
export const setKey = (id, removed = []) => 's:' + id + (removed.length ? '~' + [...removed].map(Number).sort((a, b) => a - b).join('.') : '');
export const parseSetKey = (k) => { const m = /^s:([\w-]+)(?:~([\d.]+))?$/.exec(String(k)); return m ? { id: m[1], removed: m[2] ? m[2].split('.').map(Number) : [] } : null; };
const sellable = (p) => !!p && !!p.a && !p.so;

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
export function SetCover({ v, n }) {
  const ps = v.lines.map((l) => l.p).filter(Boolean).slice(0, 4);
  return (
    <span className={'set-cov n' + Math.min(4, ps.length)}>
      {ps.map((p, i) => <span key={p.id} className="set-cov-i">{<Thumb p={p} size={i === 0 ? 'lg' : 'sm'} />}{i === 3 && v.lines.length > 4 && <b className="set-cov-more">+{v.lines.length - 3}</b>}</span>)}
      <span className="set-tag"><Icon n="box" s={12} />SET · {n ?? v.active.length} ÜRÜN</span>
    </span>
  );
}

export function SetCard({ set }) {
  const byId = useStore((s) => s.byId);
  const v = useMemo(() => setView(set, byId), [set, byId]);
  return (
    <button type="button" className="set-card" onClick={() => openSet(set.id)}>
      <SetCover v={v} />
      <span className="set-card-b">
        <b className="set-card-n">{set.name}</b>
        <span className="set-card-p">
          {v.save > 0 && <s>{fmt(v.list, v.cur)}</s>}
          <b>{fmt(v.price, v.cur)}</b>
          {v.save > 0 && <em>{fmt(v.save, v.cur)} kazanç</em>}
        </span>
        {!v.ok && <small className="set-card-x">Şu an stokta değil</small>}
      </span>
    </button>
  );
}
export function SetGrid() {
  const S = useStore((s) => s.settings);
  const sets = liveSets(S);
  if (!sets.length) return <Empty icon="box" title="Şu an set yok"><p>Yakında ürün paketleri burada olacak.</p></Empty>;
  return <div className="set-grid">{sets.map((x) => <SetCard key={x.id} set={x} />)}</div>;
}
// Ana sayfa rafı (Tasarım modunda 'Setler' bölümü)
export function SetRail({ edit }) {
  const S = useStore((s) => s.settings);
  const sets = liveSets(S);
  if (!sets.length) return edit ? <div className="dz-empty">Setler rafı: yayında set yok (Yönetim › Sipariş formu › Setler)</div> : null;
  return (
    <section className="sh-sec rv set-rail">
      <div className="sh-head"><div><h2>Setler</h2><p>Birlikte daha uygun, tek tıkla sepette</p></div>
        <button type="button" className="sh-more" onClick={() => { store.set({ catalogGo: { sets: true } }); go('katalog'); }}>Tümü<Icon n="back" s={14} className="flip" /></button></div>
      <div className="sh-rail">{sets.map((x) => <SetCard key={x.id} set={x} />)}</div>
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
      {sets.slice(0, 3).map((x) => { const v = setView(x, byId); return (
        <button key={x.id} type="button" className="in-set" onClick={() => openSet(x.id)}>
          <SetCover v={v} />
          <span className="in-set-t"><small>BU ÜRÜN SETTE DE VAR</small><b>{x.name}</b><em>{v.active.length} ürün · {fmt(v.price, v.cur)}{v.save > 0 ? ' · ' + fmt(v.save, v.cur) + ' kazanç' : ''}</em></span>
          <Icon n="back" s={16} className="flip" />
        </button>
      ); })}
    </div>
  );
}

// ---- Müşterinin set sayfası (/set/<id>)
export function SetPage({ id }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const cart = useStore((s) => s.cart);
  const set = liveSets(S).find((x) => x.id === id);
  const [removed, setRemoved] = useState([]);
  if (!set) return <div className="page narrow"><Empty icon="box" title="Set bulunamadı"><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty></div>;
  const v = setView(set, byId, removed);
  const canRm = set.rm !== false;
  const k = setKey(set.id, removed);
  const inCart = cart[k] || 0;
  const ordersOn = S.orders?.enabled !== false;
  const add = () => { setQty(k, inCart + 1); toast(inCart ? 'Set sepette ' + (inCart + 1) + ' adet' : 'Set sepete eklendi'); };
  const toggle = (l) => setRemoved(l.off ? removed.filter((x) => x !== l.id) : [...removed, l.id]);
  return (
    <div className="page set-page">
      <button type="button" className="back-btn" onClick={() => (history.state?.setId ? history.back() : go('katalog'))}><Icon n="back" s={16} />Geri</button>
      <div className="set-top">
        <div className="set-top-cov"><SetCover v={v} /></div>
        <div className="set-top-i">
          <h1 className="set-t">{set.name}</h1>
          {set.desc && <p className="set-d">{set.desc}</p>}
          <div className="set-price">
            {v.save > 0 && <span className="set-pl"><small>Ayrı ayrı</small><s>{fmt(v.list, v.cur)}</s></span>}
            {v.save > 0 && <Icon n="back" s={18} className="flip set-arrow" />}
            <span className="set-pp"><small>Set fiyatı</small><b>{fmt(v.price, v.cur)}</b></span>
            {v.save > 0 && <span className="set-save">Sette {fmt(v.save, v.cur)} kazancınız var</span>}
          </div>
          {v.ok
            ? <button type="button" className="btn primary big set-add" onClick={add} disabled={!ordersOn}><Icon n="cart" s={18} />{inCart ? `Sepette · ${inCart} set · 1 daha ekle` : 'Seti sepete ekle'}</button>
            : <div className="banner warn"><Icon n="box" /><div>{v.blocked ? 'Setteki bazı ürünler şu an stokta değil.' : `Set en az ${v.minN} ürünle alınabilir.`}</div></div>}
          {inCart > 0 && <button type="button" className="link set-go" onClick={() => go('sepet')}>Sepete git →</button>}
        </div>
      </div>
      <div className="set-list">
        <div className="set-list-h"><b>Sette neler var</b>{canRm && <small>Elinizde olanı çıkarın, o ürünün paketteki fiyatı düşülür · en az {v.minN} ürün</small>}
          {removed.length > 0 && <button type="button" className="link" onClick={() => setRemoved([])}>Hepsini geri al</button>}</div>
        {v.lines.map((l) => {
          const lock = !l.off && canRm && v.active.length <= v.minN;
          return (
            <div key={l.id} className={'set-row' + (l.off || l.auto ? ' off' : '')}>
              <button type="button" className="set-row-img" onClick={() => l.p && openProduct(l.p.id)} disabled={!l.p}>{l.p && <Thumb p={l.p} size="sm" />}</button>
              <button type="button" className="set-row-n" onClick={() => l.p && openProduct(l.p.id)} disabled={!l.p}>
                <b>{l.qty > 1 ? l.qty + ' × ' : ''}{l.p?.n || 'Ürün kaldırıldı'}</b>
                <small>{l.p?.b ? l.p.b + ' · ' : ''}{l.gone ? 'Satışta değil' : l.oos ? 'Stokta yok' : 'Stokta'}{l.auto ? ' · setten çıkarıldı' : ''}</small>
              </button>
              <span className="set-row-p">{l.list != null && l.list !== l.pp && <s>{fmt(l.list, v.cur)}</s>}<b>{fmt(l.pp, v.cur)}</b></span>
              {canRm && !l.auto && <button type="button" className={'set-have' + (l.off ? ' on' : '')} onClick={() => toggle(l)} disabled={lock} title={lock ? `En az ${v.minN} ürün kalmalı` : ''}>{l.off ? <><Icon n="plus" s={13} />Sete geri ekle</> : 'Elimde var'}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Sepette set satırı
export function SetCartLine({ group, onImg }) {
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
          {open && <ul className="set-in">{items.map((it) => <li key={it.id}><span>{it.qty / sq > 1 ? it.qty / sq + ' × ' : ''}{it.n}</span><b className="num">{fmt(it.offer * (it.qty / sq), cur)}</b></li>)}</ul>}
        </div>
      </div>
      <div className="gline-ctl">
        <span className="num gline-unit" data-l="Birim">{fmt(unit, cur)}</span>
        <Stepper small min={1} value={sq} onChange={(v) => setQty(sk, v)} onRemove={() => setQty(sk, 0)} />
        <b className="num gline-sum">{fmt(unit * sq, cur)}</b>
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
    <div className="page sets-admin">
      <div className="page-h"><div className="of-mode">
        <div className="seg of-seg" role="tablist" aria-label="Sayfa">
          <button type="button" role="tab" aria-selected={false} onClick={() => go('siparis')}><Icon n="tag" s={15} />Sipariş formu</button>
          <button type="button" role="tab" aria-selected={false} onClick={() => go('sepetlink')}><Icon n="cart" s={15} />Sepet linki</button>
          <button type="button" role="tab" aria-selected className="on"><Icon n="box" s={15} />Setler</button>
        </div>
        <h1 className="page-t">Setler <span className="muted">· {sets.length}</span></h1></div>
        <button type="button" className="btn primary" onClick={() => setEdit({})}><Icon n="plus" s={17} />Yeni set</button></div>
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
  const [f, setF] = useState(() => ({ id: set.id || null, name: set.name || '', desc: set.desc || '', on: !!set.on, stock: set.stock || 'notify', rm: set.rm !== false, items: (set.items || []).map((it) => ({ id: Number(it.id), qty: it.qty || 1, pp: String(it.pp ?? '') })) }));
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
  const price = r2(f.items.reduce((a, it) => a + num(it.pp) * it.qty, 0));
  const cur = byId.get(f.items[0]?.id)?.cur || 'USD';
  const dirty = JSON.stringify(f) !== JSON.stringify({ id: set.id || null, name: set.name || '', desc: set.desc || '', on: !!set.on, stock: set.stock || 'notify', rm: set.rm !== false, items: (set.items || []).map((it) => ({ id: Number(it.id), qty: it.qty || 1, pp: String(it.pp ?? '') })) });
  const close = () => (dirty ? setAsk(true) : onClose());
  const ok = f.name.trim() && f.items.length >= 2 && f.items.every((it) => String(it.pp).trim() !== '' && num(it.pp) >= 0);
  const save = (on) => {
    if (!f.name.trim()) return toast('Set adı yazın', 'bad');
    if (f.items.length < 2) return toast('Sete en az 2 ürün ekleyin', 'bad');
    onSave({ id: f.id || rid(), name: f.name.trim(), desc: f.desc.trim(), on, stock: f.stock, rm: f.rm, at: now(), items: f.items.map((it) => ({ id: it.id, qty: Math.max(1, it.qty), pp: r2(num(it.pp)) })) });
  };
  return (
    <Sheet wide sticky cls="set-edit" title={set.id ? 'Seti düzenle' : 'Yeni set'} onClose={close}
      footer={<div className="se-foot"><span className="se-sum">Liste {fmt(sum, cur)} → <b>Set {fmt(price, cur)}</b>{sum > price && <em> · müşteri {fmt(r2(sum - price), cur)} kazanır</em>}</span>
        <button type="button" className="btn outline" onClick={() => save(false)} disabled={!ok}>Taslak kaydet</button>
        <button type="button" className="btn primary" onClick={() => save(true)} disabled={!ok}><Icon n="check" s={16} />{f.on ? 'Kaydet' : 'Yayınla'}</button></div>}>
      <div className="se">
        <label className="field"><span className="field-l">Set adı</span><input value={f.name} onChange={(e) => up({ name: e.target.value })} placeholder="ör. Yeni Başlayan Tamir Seti" /></label>
        <label className="field"><span className="field-l">Kısa açıklama <small className="opt">(müşteri görür, isteğe bağlı)</small></span><textarea rows={2} value={f.desc} onChange={(e) => up({ desc: e.target.value })} placeholder="ör. Dükkân açan ustalar için başlangıç seti" /></label>
        <div className="se-h"><b>Setteki ürünler</b><small>{f.items.length} ürün · eklenince liste fiyatıyla gelir, “Pakette” kutusuna pakete özel fiyat yazabilirsiniz</small>
          {f.items.some((it) => num(it.pp) !== (byId.get(it.id)?.r || 0)) && <button type="button" className="link" onClick={() => up({ items: f.items.map((it) => ({ ...it, pp: String(byId.get(it.id)?.r ?? it.pp) })) })}>Liste fiyatlarına dön</button>}</div>
        <div className="se-search">
          <div className="search"><Icon n="search" s={17} /><input autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Ürün adı veya stok kodu ile ekle…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {res.length > 0 && <div className="se-res">{res.map((p) => (
            <button key={p.id} type="button" className="se-r" onClick={() => { up({ items: [...f.items, { id: p.id, qty: 1, pp: String(p.r || 0) }] }); setQ(''); }}>
              <Thumb p={p} size="sm" /><span><b>{p.n}</b><small>{p.k}{!p.a ? ' · pasif' : !(p.s > 0) ? ' · stokta yok' : ''}</small></span><em>{fmt(p.r || 0, p.cur)}</em><span className="se-add">+ Ekle</span>
            </button>))}</div>}
        </div>
        {f.items.length > 0 && <div className="se-items">
          <div className="se-it se-ith"><span /><span>Ürün</span><span>Adet</span><span>Liste</span><span>Pakette (adet)</span><span /></div>
          {f.items.map((it, i) => { const p = byId.get(it.id); const ch = p && num(it.pp) !== (p.r || 0); return (
            <div key={it.id} className="se-it">
              {p ? <Thumb p={p} size="sm" /> : <span />}
              <span className="se-n"><b>{p?.n || 'Ürün bulunamadı (#' + it.id + ')'}</b><small className={p && (!p.a || p.so || !(p.s > 0)) ? 'bad' : ''}>{p ? p.k + (!p.a || p.so ? ' · satışta değil' : !(p.s > 0) ? ' · stokta yok' : ' · stok ' + p.s) : ''}</small></span>
              <Stepper small min={1} value={it.qty} onChange={(v) => upIt(i, { qty: v })} />
              <span className={'se-l num' + (ch ? ' ch' : '')}>{p ? fmt(p.r || 0, p.cur) : '—'}</span>
              <label className={'se-pp' + (ch ? ' ch' : '')}><span>$</span><input inputMode="decimal" value={it.pp} onChange={(e) => upIt(i, { pp: e.target.value })} aria-label="Paketteki fiyat" /></label>
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
      </div>
      {ask && <Confirm title="Değişiklikler kaydedilmedi" text="Kaydetmeden çıkılsın mı?" okLabel="Kaydetmeden çık" tone="danger" onOk={onClose} onClose={() => setAsk(false)} />}
    </Sheet>
  );
}
