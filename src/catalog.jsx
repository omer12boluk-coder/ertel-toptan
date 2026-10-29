import { useMemo, useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { queueSave } from './saveq.js';
import { useStore, setQty, go, api, toast, store, openRequest, setCatalog, openProduct, toggleFav } from './store.js';
import { Icon, Thumb, Stepper, Sheet, Empty, useInfinite, openMenu, copyText, Confirm } from './ui.jsx';
import { norm, fmt, priceFor, catName, now, ls, soon, needsCheck, nextCode, picUrl, imgFiles, mediaOf, isVid } from './utils.js';
import { links } from './route.js';
import { ProductEdit, SyncButton, removeProduct, delText } from './admin.jsx';
import { buildTree, productCats, cleanHtml } from './cats.js';
import { TLHint, useRate, fmtTL } from './listsheet.jsx';
import { GuestGuide } from './guestcart.jsx';
import { ShareBtn, NotifyBtn, NotifyBox, PairRail, CatTop, outOfStock, feat, shareMenu, togglePin, isPinned, seenWait } from './extras.jsx';
import { RatingLine, Reviews } from './reviews.jsx';

export function useTree() {
  const { catalog, settings: S } = useStore();
  return useMemo(() => buildTree(S, [...new Set(catalog.flatMap((p) => [p.c, p.c2]).filter((x) => x != null))]), [catalog, S.categories]);
}

export function useVisibleProducts(admin) {
  const { catalog, settings: S } = useStore();
  const tree = useTree();
  return useMemo(() => catalog.filter((p) => {
    if (admin) return true;
    if (!p.a && !S.catalog.showInactive) return false;
    if (S.catalog.hideOutOfStock && p.s <= 0) return false;
    if (tree.isHidden(p.c)) return false;
    return true;
  }), [catalog, S, admin, tree]);
}

// Resim adresleri: elle yüklenen > siteden gelen (1. resim + ekler)
export function imageList(p, S, size) {
  const t = size === 'lg' ? S.catalog.imageLarge || S.catalog.imageThumb : S.catalog.imageThumb;
  const files = imgFiles(p);
  return files.map((f) => picUrl(f, t, size === 'lg')).filter(Boolean); // r2: depo, tam adres, ya da site dosya adı
}

export function stockInfo(p, S) {
  if (S.catalog.stockMode === 'hidden') return null;
  if (p.s <= 0) return { t: 'Stok yok', tone: 'bad' };
  if (S.catalog.stockMode === 'number') return { t: p.s + ' adet', tone: p.s <= S.catalog.lowStock ? 'warn' : 'ok' };
  return p.s <= S.catalog.lowStock ? { t: 'Az kaldı', tone: 'warn' } : { t: 'Stokta', tone: 'ok' };
}

// Fiyatın altındaki ek satırlar (Ayarlar > Fiyatlandırma > Ürün fiyatının gösterimi): TL karşılığı, soluk KDV dahil tutar
// Mağaza (public) ve bayi için ayrı seçilir: showTL/showVatInc/plusVat (mağaza), b2bTL/b2bVatInc/b2bPlusVat (bayi)
export function priceShow(S, role) {
  const P = S.pricing || {};
  return role === 'public' ? { tl: !!P.showTL, inc: !!P.showVatInc, plus: !!P.plusVat } : { tl: role === 'admin' || !!P.b2bTL, inc: !!P.b2bVatInc, plus: !!P.b2bPlusVat };
}
// "Sepete ekle" düğmesinin görünümü (Ayarlar > Ürün kartları): auto | text | icon | plus
export const cardAdd = (S, role) => (role === 'public' || !role ? S.cards?.add : S.cards?.addB2b) || (role === 'public' || !role ? 'auto' : 'text');
function PriceExtras({ v, cur, S: So, role: ro }) {
  const S0 = useStore((s) => s.settings);
  const r0 = useStore((s) => s.user?.role);
  const rate = useRate();
  const S = So || S0, role = ro || r0;
  if (v == null || isNaN(v)) return null;
  const sh = priceShow(S, role);
  const vat = Number(S.pricing.vatPct) || 0;
  const tl = (x) => (rate && cur === 'USD' ? fmtTL(x * rate.usd) : cur === 'TRY' ? fmtTL(x) : null);
  const inc = sh.inc && vat > 0 ? v * (1 + vat / 100) : null;
  return <>
    {sh.tl && (rate && cur === 'USD' ? <span className="tl-hint num">≈ {fmtTL(v * rate.usd)}</span> : <TLHint v={v} cur={cur} />)}
    {inc != null && <span className="vat-inc num">KDV dahil {fmt(inc, cur)}{tl(inc) && cur !== 'TRY' ? ' · ' + tl(inc) : ''}</span>}
  </>;
}
function PlusVat({ S: So, role: ro }) { const S0 = useStore((s) => s.settings); const r0 = useStore((s) => s.user?.role); const S = So || S0; return priceShow(S, ro || r0).plus && Number(S.pricing.vatPct) > 0 ? <em className="plusvat">+KDV</em> : null; }

// S / role verilirse (Ayarlar önizlemesi) o ayarlar ve o müşteri tipiyle çizilir
// Yönetici ürün listesi fiyatı: satış (liste) fiyatı büyük, altında küçük toptan ve alış; TL yok
const upd = (t) => { const d = new Date(t); const today = d.toDateString() === new Date().toDateString(); return (today ? 'Bugün ' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ') + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); };
// son işlem: ürünün kendi güncellemesi (ut) ile son siparişi (mağaza + bayi, panelde yüklü olanlar) hangisi yeniyse
let lastOrdCache = { o: null, r: null, m: new Map() };
function lastOrderMap() {
  const { orders, requests } = store.s;
  if (lastOrdCache.o === orders && lastOrdCache.r === requests) return lastOrdCache.m;
  const m = new Map();
  for (const o of orders || []) for (const it of o.items || []) if ((m.get(it.id) || 0) < o.createdAt) m.set(it.id, o.createdAt);
  for (const r of requests || []) for (const it of r.items || []) if ((m.get(it.id) || 0) < (r.createdAt || 0)) m.set(it.id, r.createdAt);
  lastOrdCache = { o: orders, r: requests, m }; return m;
}
// ===== Yönetici ürün tablosu (27.10.2026 3) =====
// Sütunlar: Stok kodu · Ürün · Stok · Satış · Toptan · Durum · Son işlem · ✎. Stok kodu / stok / satış / toptan hücreye
// basınca yerinde düzenlenir (✓ ya da Enter kaydeder, Esc vazgeçer). Başlığa basınca sıralanır (3. basış kapatır).
const UR = { price: 'fiyat · site', name: 'ad · site', hidden: 'pasif · site', shown: 'aktif · site', new: 'yeni · site', deleted: 'site', edit: 'düzenleme', a: 'durum', s: 'stok', r: 'satış fiyatı', w: 'toptan', k: 'stok kodu', excel: 'Excel', order: 'sipariş' };
// Son işlem: 24 saat içindeyse sadece saat, sonra dün / N gün önce / N hafta önce / N ay önce / N yıl önce (tam tarih üstüne gelince)
const shortDT = (t) => {
  const d = new Date(t), ms = Date.now() - t, H = 3600e3, D = 24 * H;
  const full = d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let txt;
  if (ms < D) txt = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  else if (ms < 2 * D) txt = 'Dün';
  else if (ms < 7 * D) txt = Math.floor(ms / D) + ' gün önce';
  else if (ms < 30 * D) txt = Math.floor(ms / (7 * D)) + ' hafta önce';
  else if (ms < 365 * D) txt = Math.floor(ms / (30 * D)) + ' ay önce';
  else txt = Math.floor(ms / (365 * D)) + ' yıl önce';
  return { txt, full };
};
const PHONE = () => matchMedia('(max-width: 700px)').matches;
function EditCell({ value, show, onSave, kind = 'num', label, className = '' }) {
  const [ed, setEd] = useState(false);
  const [v, setV] = useState('');
  // telefonda tablodan yerinde düzenleme yok (klavye açılıp kalabalık oluyordu): dokunuş satıra geçer, ürün açılır
  const start = (e) => { if (PHONE()) return; e.stopPropagation(); setV(value ?? ''); setEd(true); };
  const done = useRef(false);
  useEffect(() => { if (ed) done.current = false; }, [ed]);
  const save = async () => {
    if (done.current) return; done.current = true;
    let out = String(v).trim();
    if (kind === 'num' || kind === 'opt') { if (out === '' && kind === 'opt') out = null; else { const n = Number(out.replace(',', '.')); if (!isFinite(n) || n < 0) { done.current = false; setEd(false); return toast('Geçerli bir sayı yazın', 'bad'); } out = n; } }
    else if (!out) { done.current = false; setEd(false); return toast(label + ' boş olamaz', 'bad'); }
    setEd(false); if (out !== value) await onSave(out);
  };
  if (!ed) return <button type="button" className={'ec ' + className} onClick={start} title={label + ' — değiştirmek için tıklayın'}>{show}</button>;
  return (
    // hücrenin tamamını kaplayan sade yazı kutusu (dar sütunda da taşmaz); Enter ya da dışarı tıklamak kaydeder, Esc vazgeçer
    <span className={'ec2 ' + className} onClick={(e) => e.stopPropagation()}>
      <input autoFocus onFocus={(e) => e.target.select()} inputMode={kind === 'text' ? 'text' : 'decimal'} value={v} placeholder={kind === 'opt' ? 'oto' : ''} aria-label={label}
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { done.current = true; setEd(false); } }} onBlur={save} />
      <button type="button" className="ec2-ok" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={save} aria-label="Kaydet"><Icon n="check" s={12} /></button>
    </span>
  );
}
// Sütun genişlikleri sürüklenerek değişir (Excel gibi), cihazda hatırlanır; ürün sütunu kalan yeri alır
const COLS = [['code', 'STOK KODU', 106], ['name', 'ÜRÜN', 0], ['s', 'STOK', 70, 'r'], ['r', 'SATIŞ', 116, 'r'], ['w', 'TOPTAN', 100, 'r'], ['a', 'DURUM', 112, 'c'], ['ut', 'SON İŞLEM', 112]];
const COLW_MIN = 56, COLW_MAX = 420, NAME_MIN = 200, NAME_MAX = 900;
// Excel gibi: her sütun sabit genişlikte; bir sütunu genişletince sağındakiler kayar, artan yer en sondaki ⋮ sütununa kalır
// (sığmazsa tablo yana kayar). Ürün sütununun varsayılanı kalan genişlik.
const cwOf = (w, k, d, nameW) => k === 'name' ? Math.max(NAME_MIN, Math.min(NAME_MAX, w.name || nameW || 360)) : Math.max(COLW_MIN, Math.min(COLW_MAX, w[k] || d));
function colTpl(w, nameW, hide = []) { return COLS.filter(([k]) => !hide.includes(k)).map(([k, , d]) => cwOf(w, k, d, nameW) + 'px').join(' ') + ' minmax(44px, 1fr)'; }
const colSum = (w, nameW, hide = []) => COLS.filter(([k]) => !hide.includes(k)).reduce((t, [k, , d]) => t + cwOf(w, k, d, nameW), 0) + 44;
const COL_NAMES = { code: 'Stok kodu', s: 'Stok', r: 'Satış', w: 'Toptan', a: 'Durum', ut: 'Son işlem' };
function AdminTable({ list, asort, sortBy, onEdit, onCopy }) {
  const [cw, setCw0] = useState(() => ls.get('atw', {}));
  const [nameW, setNameW] = useState(0); // ürün sütununun varsayılanı: tablonun kalan genişliği
  const [del, setDel] = useState(null);
  const [hide, setHide0] = useState(() => ls.get('atc-hide', [])); // gizlenen sütunlar (ürün sütunu gizlenemez)
  const setHide = (h) => { setHide0(h); ls.set('atc-hide', h); };
  const colMenu = (e) => openMenu(e, Object.entries(COL_NAMES).map(([k, l]) => ({ label: l, icon: hide.includes(k) ? 'eyeoff' : 'eye', hint: hide.includes(k) ? 'gizli' : '✓', onClick: () => setHide(hide.includes(k) ? hide.filter((x) => x !== k) : [...hide, k]) })), 'Sütunları göster / gizle');
  const [rh, setRh0] = useState(() => ls.get('atrh', 0)); // satır yüksekliği (0 = içeriğe göre), Excel gibi satır alt kenarından
  const headRef = useRef(null);
  useLayoutEffect(() => { const ul = headRef.current?.parentElement; if (!ul) return; ul.classList.toggle('fixh', rh > 0); ul.classList.toggle('h1', rh > 0 && rh < 58); rh > 0 ? ul.style.setProperty('--atrh', rh + 'px') : ul.style.removeProperty('--atrh'); }, [rh]);
  const rowGrip = (e) => {
    e.preventDefault(); e.stopPropagation();
    const li = e.currentTarget.closest('li'), y0 = e.clientY, h0 = li.offsetHeight, el = e.currentTarget; el.setPointerCapture?.(e.pointerId); el.classList.add('on');
    document.documentElement.classList.add('row-resizing');
    let last = rh;
    const mv = (ev) => { last = Math.max(38, Math.min(160, Math.round(h0 + ev.clientY - y0))); setRh0(last); };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('on'); document.documentElement.classList.remove('row-resizing'); ls.set('atrh', last); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  const rowReset = () => { setRh0(0); ls.set('atrh', 0); };
  useLayoutEffect(() => {
    const ul = headRef.current?.parentElement; if (!ul) return;
    // varsayılan sütun genişliklerine göre (sürüklenen genişlikler ürün sütununu daraltmasın: kenar imleçle gitsin)
    const fit = () => { const others = COLS.reduce((t, [k, , d]) => t + (k === 'name' || hide.includes(k) ? 0 : d), 0) + 44; setNameW(Math.max(NAME_MIN, ul.clientWidth - others - 2)); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(ul); return () => ro.disconnect();
  }, [hide.join()]);
  useLayoutEffect(() => { const ul = headRef.current?.parentElement; if (!ul) return; ul.classList.add('at-ul'); for (const k of Object.keys(COL_NAMES)) ul.classList.toggle('hide-' + k, hide.includes(k)); ul.style.setProperty('--atc', colTpl(cw, nameW, hide)); ul.style.setProperty('--atw', colSum(cw, nameW, hide) + 'px'); }, [cw, nameW, hide.join()]);
  useEffect(() => () => { const ul = headRef.current?.parentElement; if (ul) { ul.classList.remove('at-ul'); ul.style.removeProperty('--atc'); ul.style.removeProperty('--atw'); } }, []);
  // sütunun SAĞ kenarı tutulur: kenar imleçle birlikte gider, soldaki sütunlar yerinden oynamaz
  const grip = (k, d) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = cwOf(cw, k, d, nameW), el = e.currentTarget; el.setPointerCapture?.(e.pointerId); el.classList.add('on');
    document.documentElement.classList.add('col-resizing');
    let last = cw;
    const mv = (ev) => { const v = Math.round(w0 + ev.clientX - x0); last = { ...cw, [k]: k === 'name' ? Math.max(NAME_MIN, Math.min(NAME_MAX, v)) : Math.max(COLW_MIN, Math.min(COLW_MAX, v)) }; setCw0(last); };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('on'); document.documentElement.classList.remove('col-resizing'); ls.set('atw', last); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  const reset = (k) => { const n = { ...cw }; delete n[k]; setCw0(n); ls.set('atw', n); };
  // başlığa basınca sıralanır; basıştan sonra fare çekilene kadar "üstüne gelince" oku gösterilmez (3. basışta ok asılı kalmasın)
  const [noHov, setNoHov] = useState(null);
  const click = (k) => () => { setNoHov(k); sortBy(k); };
  return <>
    <li className="atr ath-row" ref={headRef} onContextMenu={colMenu}>
      {COLS.map(([k, l, d, al]) => (
        <div key={k} className={'tc tc-' + k + (al ? ' ' + al : '')}>
          <button type="button" className={'ath' + (asort.k === k ? ' on ' + asort.d : '') + (noHov === k ? ' nohov' : '')} onClick={click(k)} onMouseLeave={() => noHov === k && setNoHov(null)} title={l.charAt(0) + l.slice(1).toLocaleLowerCase('tr') + ' — sırala'}>
            <span>{l}</span><svg className="ath-ar" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8 1.5 3.5h7z" /></svg>
          </button>
          <span className="col-grip" role="separator" aria-orientation="vertical" title="Sürükleyerek genişlet / daralt · çift tık: varsayılan" onPointerDown={grip(k, d)} onDoubleClick={() => reset(k)} />
        </div>
      ))}
      <div className="tc tc-ed"><button type="button" className="icon-btn sm at-cols" onClick={colMenu} aria-label="Sütunlar" title="Sütunları göster / gizle"><Icon n="eye" s={16} /></button></div>
    </li>
    {list.map((p) => <AdminRow key={p.id} p={p} onEdit={() => onEdit(p)} onCopy={() => onCopy(p)} onDel={() => setDel(p)} grip={rowGrip} gripReset={rowReset} />)}
    {del && <Confirm title="Ürün silinsin mi?" text={delText(del)} okLabel="Sil" tone="danger" onOk={() => removeProduct(del)} onClose={() => setDel(null)} />}
  </>;
}
// Aktif / Pasif seçici (sipariş durum seçicisi gibi: renkli nokta + yazı + ok, altta renkli çizgi)
const stMenu = (p) => (e) => openMenu(e, [
  { label: 'Aktif', color: '#1f9d5b', on: !!p.a, hint: p.a ? '✓' : undefined, onClick: () => !p.a && quickSave(p, { a: 1, so: null, sg: null, ur: 'a' }, 'Ürün aktif yapıldı') },
  { label: 'Pasif', color: '#8a919e', on: !p.a, hint: !p.a ? '✓' : undefined, onClick: () => p.a && quickSave(p, { a: 0, ur: 'a' }, 'Ürün pasif yapıldı') },
], 'Durum');
function StatusPick({ p }) {
  return <button type="button" className={'pst2 ' + (p.a ? 'on' : 'off')} onClick={stMenu(p)} title="Durumu değiştir"><i /><span>{p.a ? 'Aktif' : 'Pasif'}</span><Icon n="chev" s={13} /></button>;
}
function AdminRow({ p, onEdit, onCopy, onDel, grip, gripReset }) {
  const { settings: S, user } = useStore();
  const pr = priceFor(p, S, user, null);
  const lo = lastOrderMap().get(p.id) || 0; const t = Math.max(p.ut || 0, lo);
  const why = lo && lo >= (p.ut || 0) ? 'sipariş' : UR[p.ur] || (p.ut ? 'güncelleme' : '');
  const dt = t ? shortDT(t) : null;
  const saveCode = async (k) => { if (store.s.catalog.some((x) => x.id !== p.id && String(x.k).toLowerCase() === k.toLowerCase())) return toast('Bu stok kodu başka üründe var', 'bad'); await quickSave(p, { k, ur: 'k' }, 'Stok kodu kaydedildi'); };
  const menu = (e) => openMenu(e, [
    { label: 'Düzenle', icon: 'edit', onClick: onEdit },
    { label: 'Kopyasını oluştur', icon: 'copy', hint: nextCode(store.s.catalog), onClick: onCopy },
    p.pc && { label: 'Fiyat uyarısını kaldır', icon: 'check', onClick: () => quickSave(p, { pc: null }, 'Uyarı kaldırıldı') },
    '-',
    { label: 'Stok kodunu kopyala', icon: 'copy', hint: p.k, onClick: () => copyText(p.k) },
    { label: 'Ürün adını kopyala', icon: 'copy', onClick: () => copyText(p.n) },
    links.product(p, S) && { label: 'Sitede aç', icon: 'ext', onClick: () => window.open(links.product(p, S), '_blank', 'noopener') },
    { label: isPinned(S, p.id) ? 'Öne çıkarmayı kaldır' : 'Kategoride öne çıkar', icon: 'tack', onClick: () => togglePin(p) },
    '-',
    { label: 'Ürünü sil', icon: 'trash', danger: true, onClick: onDel },
  ], p.n.length > 42 ? p.n.slice(0, 40) + '…' : p.n);
  return (
    // satırın boş bir yerine basınca ürün açılır (düğme, yazı kutusu, durum seçici, tutamaçlar hariç)
    <li className={'atr' + (p.a ? '' : ' off') + (needsCheck(p) ? ' changed' : '')} onContextMenu={menu}
      onClick={(e) => { if (PHONE()) { if (!e.target.closest('.pst2, .at-ed, .at-prod')) onEdit(); return; } if (e.target.closest('button, input, a, select, textarea, label, .row-grip, .col-grip, .ec2') || getSelection()?.toString()) return; const ec = e.target.closest('.tc')?.querySelector(':scope > .ec'); if (ec) return ec.click(); onEdit(); }}>
      <div className="tc tc-code"><EditCell className="ac-code" value={p.k} show={<code>{p.k || '—'}</code>} kind="text" label="Stok kodu" onSave={saveCode} />{grip && <span className="row-grip" role="separator" aria-orientation="horizontal" title="Sürükleyerek satırları incelt / kalınlaştır · çift tık: otomatik" onPointerDown={grip} onDoubleClick={gripReset} />}</div>
      <div className="tc tc-name">
        <button type="button" className="at-prod" onClick={onEdit} title="Ürünü düzenle">
          <Thumb p={p} size="sm" />
          <span className="at-n"><b>{p.n}</b><small>{[p.b, p.so ? 'sitede satışta değil' : '', needsCheck(p) ? `liste ${fmt(p.pc.r0, p.cur)} → ${fmt(p.r, p.cur)}, elle toptanı kontrol edin` : ''].filter(Boolean).join(' · ')}</small></span>
        </button>
      </div>
      <div className="tc tc-s r"><EditCell className="r ac-s" value={p.s ?? 0} show={<b className={'num' + (p.s > 0 ? '' : ' zero')}>{p.s ?? 0}</b>} label="Stok" onSave={(v) => quickSave(p, { s: Math.round(v), ur: 's' }, 'Stok kaydedildi')} /></div>
      <div className="tc tc-r r"><EditCell className="r ac-r" value={p.r} show={<b className="num">{p.r > 0 ? fmt(p.r, p.cur) : '—'}</b>} label="Satış fiyatı" onSave={(v) => quickSave(p, { r: v, pc: null, ur: 'r' }, 'Satış fiyatı kaydedildi')} /></div>
      <div className="tc tc-w r"><EditCell className="r ac-w" value={p.w ?? ''} kind="opt" show={<><b className="num">{pr.mine != null ? fmt(pr.mine, p.cur) : '—'}</b>{p.w == null && <i className="oto">oto</i>}</>} label="Toptan fiyat (boş = otomatik)" onSave={(v) => quickSave(p, { w: v, pc: null, ur: 'w' }, v == null ? 'Toptan otomatik' : 'Toptan kaydedildi')} /></div>
      <div className="tc tc-a c"><StatusPick p={p} /></div>
      <div className={'tc tc-ut' + (dt ? '' : ' none')}><span className="ac-ut" title={dt ? dt.full : undefined}>{dt ? <><b>{dt.txt}</b>{why && <small>{why}</small>}</> : <small>—</small>}</span></div>
      <div className="tc tc-ed"><button type="button" className="icon-btn sm at-ed" onClick={menu} aria-label="İşlemler" title="Düzenle, kopyala, sil"><Icon n="more" s={18} /></button></div>
    </li>
  );
}
// Kopyalanacak ürünü seç (Yeni ürün > Bir ürünü kopyala)
function CopyPick({ onPick, onClose }) {
  const all = useStore((s) => s.catalog);
  const [q, setQ] = useState('');
  const list = useMemo(() => { const t = norm(q).split(/\s+/).filter(Boolean); return (t.length ? all.filter((p) => t.every((x) => p._s.includes(x))) : all).slice(0, 40); }, [q, all]);
  return (
    <Sheet title="Hangi ürünü kopyalayalım?" sub={'Kategori, marka, etiket, fiyat ve açıklama gelir; yeni stok kodu ' + nextCode(all)} onClose={onClose}>
      <div className="search cp-search"><Icon n="search" s={18} /><input autoFocus type="search" placeholder="Ürün adı ya da stok kodu…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <ul className="cp-list">
        {list.map((p) => <li key={p.id}><button type="button" onClick={() => onPick(p)}><Thumb p={p} size="sm" /><span><b>{p.n}</b><small>{[p.k, p.b].filter(Boolean).join(' · ')}</small></span><Icon n="copy" s={15} /></button></li>)}
      </ul>
    </Sheet>
  );
}

// Yönetici ürün satırı (kutu görünümü): Stok · Satış (büyük) · Toptan sütunları + Aktif/Pasif seçici; TL yok
function AdminCols({ p }) {
  const { settings: S, user } = useStore();
  const pr = priceFor(p, S, user, null);
  return <>
    <span className="ac ac-s" data-l="Stok"><b className={'num' + (p.s <= 0 ? ' zero' : '')}>{p.s ?? 0}</b></span>
    <span className="ac ac-r" data-l="Satış"><b className="num">{p.r > 0 ? fmt(p.r, p.cur) : '—'}</b></span>
    <span className="ac ac-w" data-l="Toptan" title={p.w != null ? 'Elle girilen toptan' : 'Kurala göre otomatik toptan'}><b className="num">{pr.mine != null ? fmt(pr.mine, p.cur) : '—'}</b>{p.w == null && <i className="oto">oto</i>}</span>
    <span className="ac ac-st"><StatusPick p={p} /></span>
  </>;
}
export function PriceBlock({ p, big, S: So, role: ro }) {
  const st = useStore();
  const S = So || st.settings; const role = ro || st.user?.role;
  const user = ro ? { role: ro, tier: S.tiers?.[0]?.id } : st.user;
  const pr = priceFor(p, S, user, ro ? null : st.userPrices);
  const ex = { S, role };
  if (role === 'public') {
    return (
      <div className={'price' + (big ? ' big' : '')}>
        {pr.mine == null ? <>
          {/* kutu kartta "Fiyat sorun" fiyatlı kartın fiyat satırıyla aynı yerde dursun: görünmez fiyat iskeleti aynı yüksekliği tutar */}
          {!big && <span className="price-ghost" aria-hidden="true"><span className="price-mine"><small>Fiyat:</small>{fmt(1, p.cur)}<PlusVat {...ex} /></span><PriceExtras v={1} cur={p.cur} {...ex} /></span>}
          <span className="price-ask">Fiyat sorun</span>
        </> : <span className="price-mine"><small>Fiyat:</small>{fmt(pr.mine, p.cur)}<PlusVat {...ex} /></span>}
        {pr.mine != null && <PriceExtras v={pr.mine} cur={p.cur} {...ex} />}
      </div>
    );
  }
  if (!big && S.pricing.showRetail && pr.list > 0 && pr.mine != null) return (
    <div className="price dual">
      <span className="pv"><small>Liste</small><b className="num">{fmt(pr.list, p.cur)}</b></span>
      <span className="pv mine"><small>{pr.src === 'ozel' ? 'Size özel' : 'Toptan'}</small><b className="num">{fmt(pr.mine, p.cur)}<PlusVat {...ex} /></b></span>
      <PriceExtras v={pr.mine} cur={p.cur} {...ex} />
    </div>
  );
  return (
    <div className={'price' + (big ? ' big' : '')}>
      {S.pricing.showRetail && pr.list > 0 && <span className="price-list">Liste: <b className="num">{fmt(pr.list, p.cur)}</b></span>}
      {pr.mine == null
        ? <span className="price-ask">Fiyat sorun</span>
        : <span className="price-mine"><small>{pr.src === 'ozel' ? 'Size özel:' : 'Toptan:'}</small>{fmt(pr.mine, p.cur)}<PlusVat {...ex} /></span>}
      <PriceExtras v={pr.mine} cur={p.cur} {...ex} />
    </div>
  );
}
// Ayarlar > Ürün kartları önizlemesi: gerçek kart düzeniyle (mağaza ya da bayi)
export function CardPreview({ p, S, role }) {
  const st = stockInfo(p, S);
  return (
    <ul className={'plist pgrid pv-cards add-' + cardAdd(S, role)}>
      <li className="prow">
        <span className="prow-main">
          <span className="cimg"><Thumb p={p} /></span>
          <div className="prow-info">
            <span className="prow-name">{p.n}</span>
            <span className="prow-meta">{S.catalog.showBrand && p.b && <span className="brand-tag">{p.b}</span>}{st && <span className={'dot tone-' + st.tone}>{st.t}</span>}</span>
          </div>
        </span>
        <div className="prow-side">
          <PriceBlock p={p} S={S} role={role} />
          <button className="btn sm add" type="button" aria-label="Sepete ekle"><Icon n="plus" s={15} className="add-plus" /><span className="add-cart" aria-hidden="true"><Icon n="cart" s={18} /><i>+</i></span><span className="add-l">Sepete ekle</span></button>
        </div>
      </li>
    </ul>
  );
}

export function Catalog({ admin }) {
  const { settings: S, cart, user } = useStore();
  const all = useVisibleProducts(admin);
  const [q, setQ] = useState('');
  const [qk, setQk] = useState(''); // yönetici: stok koduna göre arama (ayrı küçük kutu)
  const [copyPick, setCopyPick] = useState(false);
  const [cat, setCat] = useState(null);
  const [sort, setSort] = useState('default');
  const [stockOnly, setStockOnly] = useState(false);
  const [limit, setLimit] = useState(S.catalog.pageSize);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [catSheet, setCatSheet] = useState(false);
  const [adminFilter, setAdminFilter] = useState('all');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState(''); // '' | 'u10' | '10-50' | '50-200' | '200+'
  const [newOnly, setNewOnly] = useState(false);
  const [imgOnly, setImgOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [asort, setAsort] = useState({ k: null, d: null }); // yönetici tablosu başlık sıralaması
  const sortBy = (k) => setAsort((s) => (s.k !== k ? { k, d: k === 'code' || k === 'name' ? 'asc' : 'desc' } : s.d === (k === 'code' || k === 'name' ? 'asc' : 'desc') ? { k, d: k === 'code' || k === 'name' ? 'desc' : 'asc' } : { k: null, d: null }));
  const favs = useStore((s) => s.favs);
  const favSet = useMemo(() => new Set(favs), [favs]);
  // görünüm: kutu kutu (varsayılan) ya da sıra sıra; cihazda hatırlanır
  const [view, setView0] = useState(() => (admin ? 'list' : ls.get('cat-view', 'grid')));
  const setView = (v) => { setView0(v); if (!admin) ls.set('cat-view', v); };
  const tree = useTree();
  // yönetici: kategori paneli sürükleyerek daraltılır / genişletilir (tabloya yer), cihazda hatırlanır; çift tık = varsayılan
  const [catW, setCatW0] = useState(() => ls.get('cat-w', 240));
  const setCatW = (w) => { setCatW0(w); ls.set('cat-w', w); };
  const gripDown = (e) => {
    e.preventDefault(); const x0 = e.clientX, w0 = catW; const el = e.currentTarget; el.setPointerCapture?.(e.pointerId); el.classList.add('on');
    const mv = (ev) => setCatW0(Math.max(130, Math.min(380, Math.round(w0 + ev.clientX - x0))));
    const up = (ev) => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.classList.remove('on'); setCatW(Math.max(130, Math.min(380, Math.round(w0 + ev.clientX - x0)))); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  };
  const intent = useStore((s) => s.intent);
  useEffect(() => { if (admin && intent === 'newProduct') { store.set({ intent: null }); setEdit({}); } }, [intent]);
  // başka ekrandan (mağaza ana sayfası) gelen filtre: marka / kategori / arama
  const browse = useStore((s) => s.catalogGo);
  // diğer filtreler sıfırlanır: önceki ekrandan kalan stok / fiyat / yönetici filtresi aranan ürünü (ör. bildirimden gelinen pasif ürün) gizlemesin
  useEffect(() => { if (!browse) return; setQ(browse.q || ''); setQk(browse.code || ''); setCat(browse.cat ?? null); setBrand(browse.brand || ''); setStockOnly(false); setPrice(''); setNewOnly(false); setImgOnly(false); setAdminFilter('all'); setSort('default'); setLimit(S.catalog.pageSize); setOpen(null); setFavOnly(!!browse.fav); window.scrollTo(0, 0); store.set({ catalogGo: null }); }, [browse]);
  const changedN = useMemo(() => (admin ? all.filter(needsCheck).length : 0), [all, admin]);

  const pcats = useMemo(() => new Map(all.map((p) => [p.id, productCats(p, tree)])), [all, tree]);
  const counts = useMemo(() => {
    const m = new Map();
    for (const s of pcats.values()) for (const c of s) m.set(c, (m.get(c) || 0) + 1);
    return m;
  }, [pcats]);
  const brands = useMemo(() => {
    const m = new Map(); for (const p of all) if (p.b) m.set(p.b, (m.get(p.b) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'));
  }, [all]);
  const openPath = useMemo(() => new Set(cat == null ? [] : tree.ancestors(cat)), [cat, tree]);

  const PR = { u10: [0, 10], '10-50': [10, 50], '50-200': [50, 200], '200+': [200, Infinity] };
  const newest = useMemo(() => { const ids = all.filter((p) => p.nw).map((p) => p.id); return new Set(ids.length >= 20 ? ids : [...all].sort((a, b) => b.id - a.id).slice(0, 120).map((p) => p.id)); }, [all]);
  // scoped: kategori + marka da uygulanır; false: sadece arama ve diğer filtreler (kategoride bulunamazsa tüm ürünlerden göstermek için)
  const filterList = (scoped) => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    const kq = admin ? norm(qk).replace(/\s+/g, '') : '';
    const useTags = admin || S.catalog.searchTags;
    // yönetici: ad kutusu stok koduna bakmaz (stok kodu ayrı kutuda); mağaza/bayi tek kutuda ikisini de arar
    const hay = admin ? nameHay : (p) => p._s;
    const [lo, hi] = PR[price] || [0, Infinity];
    let r = all.filter((p) => (!scoped || cat == null || pcats.get(p.id)?.has(cat)) && (!scoped || !brand || p.b === brand) && (!stockOnly || p.s > 0)
      && (!price || (p.r >= lo && p.r < hi)) && (!newOnly || newest.has(p.id)) && (!imgOnly || p.pi || p.img) && (!favOnly || favSet.has(p.id))
      && (!kq || norm(p.k || '').replace(/\s+/g, '').includes(kq)) && toks.every((t) => hay(p).includes(t) || (useTags && p._t.includes(t))));
    if (toks.length) r = [...r].sort((a, b) => toks.filter((t) => hay(b).includes(t)).length - toks.filter((t) => hay(a).includes(t)).length);
    if (admin && adminFilter === 'inactive') r = r.filter((p) => !p.a);
    if (admin && adminFilter === 'active') r = r.filter((p) => p.a);
    if (admin && adminFilter === 'instock') r = r.filter((p) => p.s > 0);
    if (admin && adminFilter === 'nostock') r = r.filter((p) => !(p.s > 0));
    if (admin && adminFilter === 'nowholesale') r = r.filter((p) => p.w == null);
    if (admin && adminFilter === 'noimg') r = r.filter((p) => !p.img && !p.pi);
    if (admin && adminFilter === 'notags') r = r.filter((p) => !p.t);
    if (admin && adminFilter === 'pricechanged') r = r.filter(needsCheck);
    if (admin && adminFilter === 'new') r = r.filter((p) => p.nw);
    if (admin && adminFilter === 'siteoff') r = r.filter((p) => p.so);
    if (sort === 'asc') r = [...r].sort((a, b) => a.r - b.r);
    if (sort === 'desc') r = [...r].sort((a, b) => b.r - a.r);
    if (sort === 'name') r = [...r].sort((a, b) => a.n.localeCompare(b.n, 'tr'));
    if (sort === 'stock') r = [...r].sort((a, b) => (b.s > 0) - (a.s > 0));
    // kategoride öne çıkanlar (mağaza ve bayi; varsayılan sıralama, arama yokken) en başta, yöneticinin verdiği sırayla
    const pins = feat(S).pins;
    if (scoped && !admin && cat != null && sort === 'default' && !toks.length && pins.length) {
      const pos = new Map(pins.map((id, i) => [id, i]));
      const top = r.filter((p) => pos.has(p.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
      if (top.length) r = [...top, ...r.filter((p) => !pos.has(p.id))];
    }
    // yönetici tablosu başlığına basarak sıralama (1. çoktan aza / aktifler önce, 2. tersi, 3. kapalı)
    if (admin && asort.k) {
      const key = { code: (p) => String(p.k || ''), name: (p) => p.n, s: (p) => Number(p.s) || 0, r: (p) => Number(p.r) || 0, w: (p) => priceFor(p, S, user, null).mine ?? -1, a: (p) => (p.a ? 1 : 0), ut: (p) => Math.max(p.ut || 0, lastOrderMap().get(p.id) || 0) }[asort.k];
      const str = asort.k === 'code' || asort.k === 'name';
      const nil = (p) => (asort.k === 'r' && !(Number(p.r) > 0)) || (asort.k === 'w' && !(priceFor(p, S, user, null).mine > 0));
      r = [...r].sort((a, b) => { const na = nil(a), nb = nil(b); if (na !== nb) return na ? 1 : -1; const x = key(a), y = key(b); const c = str ? String(x).localeCompare(String(y), 'tr') : x - y; return asort.d === 'desc' ? -c : c; });
    }
    return r;
  };
  const deps = [all, q, qk, cat, sort, stockOnly, adminFilter, admin, brand, pcats, S.catalog.searchTags, price, newOnly, imgOnly, newest, favOnly, favSet, asort, S.feat];
  const pinShow = !admin && cat != null && sort === 'default' && !q.trim() ? new Set(feat(S).pins) : null;
  const scopedList = useMemo(() => filterList(true), deps);
  const scoped = cat != null || !!brand;
  const globalList = useMemo(() => (q.trim() && scoped ? filterList(false) : null), deps);
  // kategori / marka seçiliyken aranan şey orada yoksa: tüm ürünlerde ara (müşteri "neden çıkmıyor" demesin)
  const widened = !!globalList && scopedList.length === 0 && globalList.length > 0;
  const list = widened ? globalList : scopedList;
  const moreOutside = globalList && !widened ? globalList.length - scopedList.length : 0;
  const catIds = useMemo(() => (cat == null ? [] : all.filter((p) => pcats.get(p.id)?.has(cat)).map((p) => p.id)), [all, pcats, cat]);
  const scopeName = [cat != null ? tree.nodes.get(cat)?.name || catName(S, cat) : null, brand || null].filter(Boolean).join(' · ');
  const clearAll = () => { setQ(''); setQk(''); setCat(null); setBrand(''); setStockOnly(false); setPrice(''); setNewOnly(false); setImgOnly(false); setFavOnly(false); };
  const actives = [
    q.trim() && ['“' + q.trim() + '”', () => setQ('')],
    qk.trim() && ['Stok kodu: ' + qk.trim(), () => setQk('')],
    cat != null && [tree.nodes.get(cat)?.name || catName(S, cat), () => setCat(null)],
    brand && [brand, () => setBrand('')],
    stockOnly && ['Stoktakiler', () => setStockOnly(false)],
    price && [{ u10: '$10 altı', '10-50': '$10–50', '50-200': '$50–200', '200+': '$200 üstü' }[price], () => setPrice('')],
    newOnly && ['Yeni gelenler', () => setNewOnly(false)],
    imgOnly && ['Resimli', () => setImgOnly(false)],
    favOnly && ['Favorilerim', () => setFavOnly(false)],
  ].filter(Boolean);

  useEffect(() => setLimit(S.catalog.pageSize), [q, qk, cat, sort, stockOnly, adminFilter, brand, price, newOnly, imgOnly, favOnly]);
  const more = useCallback(() => setLimit((l) => l + S.catalog.pageSize), [S.catalog.pageSize]);
  const sentinel = useInfinite(more);
  const shown = list.slice(0, limit);
  const cartCount = Object.keys(cart).length;

  return (
    <div className="catalog">
      <div className={'cat-layout' + (admin ? ' resizable' : '')} style={admin ? { '--catw': catW + 'px' } : undefined}>
        <aside className="cat-side" aria-label="Kategoriler">
          <h3 className="eyebrow">Kategoriler</h3>
          <button className={'cat-link' + (cat == null ? ' on' : '')} onClick={() => setCat(null)}><span>Tümü</span><b>{all.length}</b></button>
          <CatTree nodes={tree.roots} counts={counts} cat={cat} open={openPath} onPick={setCat} />
        </aside>

        {admin && <span className="cat-grip" role="separator" aria-orientation="vertical" aria-label="Kategoriler panelinin genişliği" title="Sürükleyerek daralt / genişlet" onPointerDown={gripDown} onDoubleClick={() => setCatW(240)} />}
        <section className="cat-main">
          <div className="toolbar">
            <div className={admin ? 'tb-top' : undefined}>
              {admin && <div className="search code-search">
                <Icon n="tag" s={15} />
                <input id="cat-code" type="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="search" placeholder="Stok kodu" value={qk} onChange={(e) => setQk(e.target.value)} aria-label="Stok koduna göre ara" />
                {qk && <button className="icon-btn sm" onClick={() => setQk('')} aria-label="Temizle"><Icon n="x" s={14} /></button>}
              </div>}
              <div className="search">
                <Icon n="search" s={18} />
                <input id="cat-search" type="search" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" placeholder={scopeName ? `${scopeName} içinde ara… (tüm ürünlerde de bakarız)` : admin ? 'Ürün adına göre ara… (ör. jcid face id)' : 'Ürün adı veya stok kodu… (ör. jcid face id)'} value={q} onChange={(e) => setQ(e.target.value)} />
                {q && <button className="icon-btn sm" onClick={() => setQ('')} aria-label="Temizle"><Icon n="x" s={16} /></button>}
              </div>
              {admin && <button className="btn primary new-prod" onClick={(e) => openMenu(e, [
                { label: 'Boş ürün', icon: 'plus', hint: nextCode(store.s.catalog), onClick: () => setEdit({}) },
                { label: 'Bir ürünü kopyala…', icon: 'copy', onClick: () => setCopyPick(true) },
              ], 'Yeni ürün')}><Icon n="plus" s={17} /><span>Yeni ürün</span><Icon n="chev" s={14} /></button>}
            </div>
            <div className="chips" role="tablist" aria-label="Kategori">
              <button className="chip only-m" onClick={() => setCatSheet(true)}><Icon n="filter" s={15} />{cat == null ? 'Kategoriler' : tree.nodes.get(cat)?.name || catName(S, cat)}</button>
              {cat != null && <button className="chip on only-m" onClick={() => setCat(null)}>Tümü <Icon n="x" s={14} /></button>}
              {user?.role === 'public' && (favs.length > 0 || favOnly) && <button className={'chip fav-chip' + (favOnly ? ' on' : '')} onClick={() => setFavOnly(!favOnly)}><Icon n="heart" s={14} />Favorilerim <b>{favs.length}</b></button>}
              {!admin && <button className={'chip' + (stockOnly ? ' on' : '')} onClick={() => setStockOnly(!stockOnly)}>Stoktakiler</button>}
              {!admin && <button className={'chip' + (newOnly ? ' on' : '')} onClick={() => setNewOnly(!newOnly)}><Icon n="star" s={14} />Yeni gelenler</button>}
              <label className={'chip select' + (price ? ' on' : '')}>
                <Icon n="tag" s={14} />
                <select id="cat-price" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Fiyat aralığı">
                  <option value="">Tüm fiyatlar</option><option value="u10">$10 altı</option><option value="10-50">$10 – $50</option><option value="50-200">$50 – $200</option><option value="200+">$200 üstü</option>
                </select>
              </label>
              {!admin && <button className={'chip' + (imgOnly ? ' on' : '')} onClick={() => setImgOnly(!imgOnly)}><Icon n="camera" s={14} />Resimli</button>}
              {brands.length > 1 && (
                <label className={'chip select' + (brand ? ' on' : '')}>
                  <select id="cat-brand" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Marka">
                    <option value="">Tüm markalar</option>
                    {brands.map(([b, n]) => <option key={b} value={b}>{b} ({n})</option>)}
                  </select>
                </label>
              )}
              <label className="chip select">
                <Icon n="sort" s={15} />
                <select id="cat-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sıralama">
                  <option value="default">Yeni eklenen</option>
                  <option value="asc">Fiyat artan</option>
                  <option value="desc">Fiyat azalan</option>
                  <option value="name">İsim A–Z</option>
                  <option value="stock">Stoktakiler önce</option>
                </select>
              </label>
              {admin && (
                <label className="chip select">
                  <select id="adm-filter" value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} aria-label="Filtre">
                    <option value="all">Tüm ürünler</option>
                    <option value="active">Aktif olanlar</option>
                    <option value="inactive">Pasif olanlar</option>
                    <option value="instock">Stoktakiler</option>
                    <option value="nostock">Stoğu bitenler</option>
                    <option value="nowholesale">Toptan fiyatı girilmemiş</option>
                    <option value="noimg">Resmi olmayanlar</option>
                    <option value="notags">Etiketi olmayanlar</option>
                    <option value="pricechanged">Toptanı kontrol edilecekler</option>
                    <option value="new">Siteden yeni gelenler</option>
                    <option value="siteoff">Sitede satışta olmayanlar</option>
                  </select>
                </label>
              )}

            </div>
          </div>

          {admin && adminFilter === 'pricechanged' && (
            <div className="banner info price-alert"><Icon n="tag" /><div>{changedN ? <>Bu ürünlerin liste fiyatı değişti; elle girdiğiniz toptan fiyat korunuyor. Uygunsa dokunmayın, değilse <b>Düzenle</b>'den yeni toptan fiyatı yazın. Hepsine baktıysanız uyarıyı kaldırın.</> : 'Kontrol edilecek ürün kalmadı.'}</div>
              {changedN > 0 && <button className="btn sm outline" onClick={() => clearChecks()}><Icon n="check" s={15} />Hepsine baktım, uyarıyı kaldır</button>}</div>
          )}
          {admin && changedN > 0 && adminFilter !== 'pricechanged' && (
            <div className="banner warn price-alert"><Icon n="tag" /><div><b>{changedN} ürünün liste fiyatı değişti ve elle girdiğiniz toptan fiyatı var.</b> Toptan fiyatı yeni liste fiyatına göre hâlâ uygun mu bakın (otomatik toptanlılar kendiliğinden güncellenir).</div><button className="btn sm outline" onClick={() => setAdminFilter('pricechanged')}>Göster</button></div>
          )}
          
          {actives.length > 0 && (
            <div className="af-row" aria-label="Seçili filtreler">
              {actives.map(([l, off], i) => <button key={i} className="af-chip" onClick={off} title="Filtreyi kaldır">{l}<Icon n="x" s={13} /></button>)}
              {actives.length > 1 && <button className="link af-clear" onClick={clearAll}>Tümünü temizle</button>}
            </div>
          )}
          {widened && <div className="banner info widen"><Icon n="search" /><div><b>“{q.trim()}” {scopeName} içinde yok.</b> Tüm ürünlerde bulunan {list.length} sonucu gösteriyoruz.</div><button className="btn sm outline" onClick={() => { setCat(null); setBrand(''); }}>Filtreyi kaldır</button></div>}
          {moreOutside > 0 && <div className="banner info widen"><Icon n="search" /><div>{scopeName} dışında da <b>{moreOutside} sonuç</b> var.</div><button className="btn sm outline" onClick={() => { setCat(null); setBrand(''); }}>Tüm ürünlerde ara</button></div>}
          <div className="result-line">
            <span>{list.length.toLocaleString('tr-TR')} ürün{!widened && scopeName && <> · <b>{scopeName}</b></>}</span>
            {admin && <SyncButton icon />}
            <span className="view-sw" role="group" aria-label="Görünüm">
              <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Kutu kutu" title="Kutu kutu"><Icon n="grid" s={17} /></button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="Sıra sıra" title="Sıra sıra"><Icon n="list" s={17} /></button>
            </span>
            {!admin && cartCount > 0 && <button className="link" onClick={() => go('sepet')}>Sepette {cartCount} kalem →</button>}
          </div>

          {!admin && user?.role === 'public' && cat != null && !q.trim() && <CatTop ids={catIds} onOpen={setOpen} />}
          {shown.length === 0 && favOnly && actives.length === 1 ? (
            <Empty icon="heart" title="Henüz favoriniz yok"><p>Ürünlerdeki kalp simgesine dokunarak beğendiklerinizi buraya ekleyin.</p></Empty>
          ) : shown.length === 0 ? (
            <Empty icon="search" title="Bu aramayla eşleşen ürün yok"><p>Kelimeyi kısaltmayı ya da filtreleri kaldırmayı deneyin.</p>{actives.length > 0 && <button className="btn primary" onClick={clearAll}><Icon n="x" s={15} />Tüm filtreleri temizle</button>}</Empty>
          ) : (
            <ul className={'plist' + (view === 'grid' ? ' pgrid' : '') + ' add-' + cardAdd(S, user?.role)}>
              {admin && view !== 'grid' ? <AdminTable list={shown} asort={asort} sortBy={sortBy} onEdit={setEdit} onCopy={(p) => setEdit({ copy: p })} />
                : shown.map((p) => <ProductRow key={p.id} p={p} admin={admin} pinned={!!pinShow?.has(p.id)} onOpen={() => (admin ? setEdit(p) : setOpen(p))} />)}
            </ul>
          )}
          {limit < list.length && <div ref={sentinel} className="more"><button className="btn ghost" onClick={more}>Daha fazla göster ({list.length - limit})</button></div>}
        </section>
      </div>

      {catSheet && (
        <Sheet title="Kategoriler" onClose={() => setCatSheet(false)}>
          <div className="cat-grid">
            <button className={'cat-link' + (cat == null ? ' on' : '')} onClick={() => { setCat(null); setCatSheet(false); }}><span>Tümü</span><b>{all.length}</b></button>
            <CatTree nodes={tree.roots} counts={counts} cat={cat} all onPick={(c) => { setCat(c); setCatSheet(false); }} />
          </div>
        </Sheet>
      )}
      {open && <ProductSheet p={open} onClose={() => setOpen(null)} />}
      {edit && <ProductEdit p={edit.id ? edit : null} copy={edit.copy} onClose={() => setEdit(null)} />}
      {copyPick && <CopyPick onClose={() => setCopyPick(false)} onPick={(p) => { setCopyPick(false); setEdit({ copy: p }); }} />}
    </div>
  );
}

function CatTree({ nodes, counts, cat, open, onPick, all: expandAll, admin, depth = 0 }) {
  return nodes.filter((n) => (counts.get(n.id) || 0) > 0 && (admin || !n.hidden)).map((n) => {
    const kids = n.children.filter((k) => (counts.get(k.id) || 0) > 0);
    const expanded = expandAll || open?.has(n.id);
    return (
      <div key={n.id} className="cat-node">
        <button className={'cat-link' + (cat === n.id ? ' on' : '') + (depth ? ' sub' : '')} style={{ '--d': depth }} onClick={() => onPick(n.id)}>
          <span>{n.name}{kids.length > 0 && !expandAll && <i className="cat-caret" aria-hidden="true">{expanded ? '▾' : '▸'}</i>}</span><b>{counts.get(n.id)}</b>
        </button>
        {expanded && kids.length > 0 && <CatTree nodes={kids} counts={counts} cat={cat} open={open} onPick={onPick} all={expandAll} admin={admin} depth={depth + 1} />}
      </div>
    );
  });
}

// Bayi kartı (+ / sepet simgesi düğmesi): tek düğme. Sepette değilken küçük "+"; eklenince aynı yerde − adet + olarak
// yaylanarak genişler. Fiyatlar (telefonda toptan büyük, liste altında küçük) solda kalır; hiçbir şeyin üstüne binmez.
function InlineQty({ qty, onChange, icon }) {
  const on = qty > 0;
  const st = (d) => (e) => { e.stopPropagation(); onChange(Math.max(0, qty + d)); };
  return (
    <span className={'iq' + (on ? ' on' : '')}>
      <button type="button" className="iq-b iq-m" onClick={st(-1)} tabIndex={on ? 0 : -1} aria-label={qty > 1 ? 'Azalt' : 'Sepetten çıkar'}><Icon n={qty > 1 ? 'minus' : 'trash'} s={15} /></button>
      <b className="iq-n num" aria-live="polite">{on ? qty : ''}</b>
      <button type="button" className="iq-b iq-p" onClick={st(1)} aria-label={on ? 'Arttır' : 'Sepete ekle'}>{!on && icon ? <span className="add-cart" aria-hidden="true"><Icon n="cart" s={18} /><i>+</i></span> : <Icon n="plus" s={on ? 15 : 19} />}</button>
    </span>
  );
}

function ProductRow({ p, admin, onOpen, pinned }) {
  const { settings: S, cart, user } = useStore();
  const qty = cart[p.id] || 0;
  const [hov, setHov] = useState(false); // bilgisayar: üstüne gelince (birden çok resim varsa) yazılar aşağı kayar, küçük resimler çıkar
  const [ix, setIx] = useState(0);
  const multi = FINE && S.cards?.hoverImgs !== false && imgFiles(p).length > 1;
  const st = stockInfo(p, S);
  const site = links.product(p, S);
  const menu = (e) => openMenu(e, admin ? [
    { label: 'Düzenle', icon: 'edit', onClick: onOpen },
    { label: p.a ? 'Pasif yap (bayilerden gizle)' : 'Aktif yap', icon: p.a ? 'eyeoff' : 'eye', onClick: () => quickSave(p, { a: p.a ? 0 : 1 }, p.a ? 'Ürün pasif yapıldı' : 'Ürün aktif yapıldı') },
    p.pc && { label: 'Fiyat uyarısını kaldır', icon: 'check', onClick: () => quickSave(p, { pc: null }, 'Uyarı kaldırıldı') },
    '-',
    { label: 'Stok kodunu kopyala', icon: 'copy', hint: p.k, onClick: () => copyText(p.k) },
    { label: 'Ürün adını kopyala', icon: 'copy', onClick: () => copyText(p.n) },
    site && { label: 'Sitede aç', icon: 'ext', onClick: () => window.open(site, '_blank', 'noopener') },
    '-',
    { label: isPinned(S, p.id) ? 'Öne çıkarmayı kaldır' : 'Kategoride öne çıkar', icon: 'tack', onClick: () => togglePin(p) },
  ] : [
    { label: 'Ürünü aç', icon: 'zoom', onClick: onOpen },
    { label: qty ? `Sepete 1 tane daha ekle (${qty})` : 'Sepete ekle', icon: 'plus', onClick: () => { setQty(p.id, qty + 1); toast('Sepete eklendi'); } },
    qty > 0 && { label: 'Sepetten çıkar', icon: 'trash', danger: true, onClick: () => setQty(p.id, 0) },
    user?.role === 'public' && { label: store.s.favs.includes(p.id) ? 'Favorilerden çıkar' : 'Favorilere ekle', icon: 'heart', onClick: () => toast(toggleFav(p.id) ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı') },
    user?.role !== 'public' && S.requests.allowQuote && { label: 'Bu ürünü sor', icon: 'chat', onClick: () => askAbout(p, Math.max(1, qty)) },
    '-',
    user?.role === 'public' && feat(S).share && { label: 'Ürünü paylaş', icon: 'share', onClick: () => setTimeout(() => shareMenu(e, p, S), 0) },
    { label: 'Ürün adını kopyala', icon: 'copy', onClick: () => copyText(p.n, 'Ürün adı kopyalandı') },
    { label: 'Stok kodunu kopyala', icon: 'copy', hint: p.k, onClick: () => copyText(p.k) },
    site && user?.role !== 'public' && { label: 'Sitede aç', icon: 'ext', onClick: () => window.open(site, '_blank', 'noopener') },
  ], p.n.length > 42 ? p.n.slice(0, 40) + '…' : p.n);
  return (
    <li className={'prow' + (admin ? ' adm' : '') + (!p.a ? ' inactive' : '') + (needsCheck(p) && admin ? ' changed' : '') + (hov && multi ? ' hov' : '')} onContextMenu={menu}
      onMouseEnter={multi ? () => setHov(true) : undefined} onMouseLeave={multi ? () => { setHov(false); setIx(0); } : undefined}>
      {user?.role === 'public' && <FavBtn id={p.id} />}
      {pinned && <span className="pin-tag"><Icon n="tack" s={12} />Öne çıkan</span>}
      <button className="prow-main" onClick={onOpen}>
        <CardImg p={p} hov={hov && multi} ix={ix} setIx={setIx} />
        <div className="prow-info">
          <span className="prow-name">{p.n}</span>
          <span className="prow-meta">
            {admin && <code>{p.k}</code>}
            {S.catalog.showBrand && p.b && <span className="brand-tag">{p.b}</span>}
            {st && <span className={'dot tone-' + st.tone}>{st.t}</span>}
            {admin && !p.t && <span className="dot tone-muted">Etiketsiz</span>}
            {admin && p.nw && <span className="dot tone-info">Siteden yeni</span>}
            {admin && p.so && <span className="dot tone-muted">Sitede satışta değil</span>}
            {admin && needsCheck(p) && <span className="dot tone-bad">Liste {fmt(p.pc.r0, p.cur)} → {fmt(p.r, p.cur)} · elle toptan</span>}
            {admin && (() => { const lo = lastOrderMap().get(p.id) || 0; const t = Math.max(p.ut || 0, lo); return t ? <span className="prow-ut" title={lo >= (p.ut || 0) ? 'Son işlem: sipariş' : 'Son işlem: fiyat / ad / aktif-pasif / düzenleme'}>{upd(t)}{lo >= (p.ut || 0) ? ' · sipariş' : ''}</span> : null; })()}
          </span>
        </div>
      </button>
      {/* stokta olmayan ürün (mağaza): "Gelince haber ver" fiyat satırında değil, kendi satırında → fiyat her kartta aynı
          yerde kalır, düğmeye basınca (yazı → çan) hiçbir şey kaymaz. Satır görünümünde düğme eskisi gibi fiyatın yanında. */}
      {user?.role === 'public' && outOfStock(p) && feat(S).notify && !qty && <div className="prow-nb"><NotifyBtn p={p} /></div>}
      <div className="prow-side">
        {admin ? <AdminCols p={p} /> : <PriceBlock p={p} />}
        {admin ? (
          <button className="btn sm ghost" onClick={onOpen}><Icon n="edit" s={15} />Düzenle</button>
        ) : user?.role !== 'public' && ['icon', 'plus'].includes(cardAdd(S, user?.role)) ? (
          <InlineQty qty={qty} onChange={(v) => setQty(p.id, v)} icon={cardAdd(S, user?.role) === 'icon'} />
        ) : user?.role === 'public' && outOfStock(p) && feat(S).notify && !qty ? (
          <NotifyBtn p={p} />
        ) : qty > 0 ? (
          <Stepper small value={qty} onChange={(v) => setQty(p.id, v)} />
        ) : (
          <button className="btn sm add" onClick={() => setQty(p.id, 1)} aria-label="Sepete ekle" title="Sepete ekle"><Icon n="plus" s={15} className="add-plus" /><span className="add-cart" aria-hidden="true"><Icon n="cart" s={18} /><i>+</i></span><span className="add-l">Sepete ekle</span></button>
        )}
      </div>
    </li>
  );
}

// Hesabım > Favorilerim: favori ürünler kutu görünümünde (kart, ürün penceresi, sepete ekle aynı)
export function FavGrid() {
  const { favs, byId, settings: S, user } = useStore();
  const [open, setOpen] = useState(null);
  const list = favs.map((id) => byId.get(id)).filter((p) => p && p.a !== 0 && !p.so);
  if (!list.length) return <Empty icon="heart" title={favs.length ? 'Favorilerinizdeki ürünler şu an satışta değil' : 'Henüz favoriniz yok'}><p>Ürünlerdeki kalp simgesine dokunarak beğendiklerinizi buraya ekleyin.</p><button className="btn primary" onClick={() => go('katalog')}>Ürünlere göz at</button></Empty>;
  return <>
    <ul className={'plist pgrid fav-grid add-' + cardAdd(S, user?.role)}>
      {list.map((p) => <ProductRow key={p.id} p={p} onOpen={() => setOpen(p)} />)}
    </ul>
    {open && <ProductSheet p={open} onClose={() => setOpen(null)} />}
  </>;
}

// Hesabım > Haber bekleyenler: favoriler gibi ürün kartları (stokta yoksa kartta "Haber vereceğiz" çanı; dokununca kapanır)
export function WaitGrid() {
  const { member, byId, settings: S, user } = useStore();
  const [open, setOpen] = useState(null);
  // sayfa açılınca stoğa girmiş beklenen ürünler listeden çıkar (üye gördü sayılır)
  const [gone, setGone] = useState([]);
  useEffect(() => { seenWait([...new Set(member?.notify || [])]).then((d) => d.length && setGone(d)); }, []);
  const ids = [...new Set(member?.notify || [])]; // aynı ürün iki kez kayıtlıysa bir kez gösterilir
  const list = ids.map((id) => byId.get(id)).filter((p) => p && p.a !== 0 && !p.so);
  const came = gone.map((id) => byId.get(id)).filter(Boolean);
  const cameLine = came.length > 0 && <p className="wait-came"><Icon n="check" s={15} /><span>Stoğa girdi, listeden çıkarıldı: {came.map((p, i) => <span key={p.id}>{i > 0 && ', '}<button type="button" className="linkish" onClick={() => setOpen(p)}>{p.n.length > 48 ? p.n.slice(0, 46) + '…' : p.n}</button></span>)}</span></p>;
  if (!list.length) return <>{cameLine}<Empty icon="bell" title="Haber beklediğiniz ürün yok"><p>Stokta olmayan ürünlerde <b>Gelince haber ver</b>’e dokunun; ürün gelince telefonunuza bildirim gönderelim.</p><button className="btn primary" onClick={() => go('katalog')}>Ürünlere göz at</button></Empty>{open && <ProductSheet p={open} onClose={() => setOpen(null)} />}</>;
  return <>
    {cameLine}
    <ul className={'plist pgrid fav-grid add-' + cardAdd(S, user?.role)}>{list.map((p) => <ProductRow key={p.id} p={p} onOpen={() => setOpen(p)} />)}</ul>
    <p className="fine wait-note">Ürün stoğa girince telefonunuza bildirim gelir. Bildirime dokunduğunuzda ya da bu sayfayı açtığınızda ürün listeden çıkar; o zamana kadar her stoğa girişinde yeniden haber veririz. Çana dokunarak takibi kapatabilirsiniz.</p>
    {open && <ProductSheet p={open} onClose={() => setOpen(null)} />}
  </>;
}

// Favori kalbi (mağaza): kartın resim köşesinde ve ürün penceresinde; dolu = favoride
export function FavBtn({ id, big }) {
  const on = useStore((s) => s.favs.includes(id));
  const [pop, setPop] = useState(0);
  return (
    <button type="button" className={'fav-btn' + (on ? ' on' : '') + (big ? ' big' : '')} aria-pressed={on} aria-label={on ? 'Favorilerden çıkar' : 'Favorilere ekle'} title={on ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      onClick={(e) => { e.stopPropagation(); const v = toggleFav(id); setPop((x) => x + 1); toast(v ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı'); }}>
      <Icon key={pop} n="heart" s={big ? 20 : 18} className={pop ? 'fav-pop' : ''} />
    </button>
  );
}

// Kart resmi: bilgisayarda üstüne gelince (birden fazla resim varsa) altta küçük resimler kayarak çıkar; küçük resmin
// üstünde gezinince büyük resim değişir, fare çıkınca ilk resme döner (sadece kutu görünümünde; satır görünümünde gizli)
const FINE = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
function CardImg({ p, hov, ix, setIx }) {
  const S = useStore((s) => s.settings);
  const [seen, setSeen] = useState(false); // küçük resimler bir kez yüklenince kapanırken de görünür kalsın (animasyon)
  useEffect(() => { if (hov) setSeen(true); }, [hov]);
  const n = imgFiles(p).length;
  // telefon: birden çok resim varsa kartı açmadan parmakla kaydırılır, altta hangi resimde olduğunu gösteren çizgiler
  if (!FINE && n > 1 && S.cards?.swipeImgs !== false) return <SwipeImgs p={p} />;
  const urls = seen ? imageList(p, S, 'lg') : [];
  const ths = seen ? imageList(p, S, 'sm') : [];
  return (
    <span className={'cimg' + (hov ? ' on' : '')}>
      <Thumb p={p} />
      {seen && urls.length > 1 && <>
        <img className={'cimg-alt' + (hov && ix > 0 ? ' on' : '')} src={urls[ix] || urls[0]} alt="" />
        <span className="cimg-bar" aria-hidden="true">{urls.slice(0, 6).map((_, i) => <i key={i} className={i === ix ? 'on' : ''} />)}</span>
        <span className="cimg-strip" aria-hidden={!hov}>{ths.slice(0, 4).map((u, i) => <span key={i} className={'cimg-th' + (i === ix ? ' on' : '')} style={{ '--k': i }} onMouseEnter={() => setIx(i)}><img src={u} alt="" loading="lazy" /></span>)}{ths.length > 4 && <span className={'cimg-th more' + (ix >= 4 ? ' on' : '')} style={{ '--k': 4 }} onMouseEnter={() => setIx(4)}>+{ths.length - 4}</span>}</span>
      </>}
    </span>
  );
}
// Telefonda kart resmi: yana kaydırılan resimler (kaydırma kartı açmaz), altta konum çizgileri
function SwipeImgs({ p }) {
  const S = useStore((s) => s.settings);
  const urls = imageList(p, S, 'sm');
  const [k, setK] = useState(0);
  const ref = useRef(null);
  const onScroll = () => { const el = ref.current; if (!el) return; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== k) setK(i); };
  if (urls.length < 2) return <span className="cimg"><Thumb p={p} /></span>;
  return (
    <span className="cimg sw">
      <span className="cimg-sw" ref={ref} onScroll={onScroll}>
        <span className="cimg-sw-i"><Thumb p={p} /></span>
        {urls.slice(1, 8).map((u, i) => <span key={i} className="cimg-sw-i"><img src={u} alt="" loading="lazy" draggable="false" /></span>)}
      </span>
      <span className="cimg-dots" aria-hidden="true">{urls.slice(0, 8).map((_, i) => <i key={i} className={i === k ? 'on' : ''} />)}</span>
    </span>
  );
}

// Ürün içeriği (pencere ve sayfa ortak): resimler, bilgiler, fiyat, adet + Sepete ekle / Hemen satın al, açıklama
function ProductBody({ p, viewOnly, onDone, onPick }) {
  const { settings: S, cart, user, userPrices } = useStore();
  const [qty, setQ] = useState(cart[p.id] || 1);
  const st = stockInfo(p, S);
  const pr = priceFor(p, S, user, userPrices);
  const pub = user?.role === 'public';
  const canBuy = pub && S.orders?.enabled !== false && !soon(S, 'checkoutSoon') && pr.mine != null;
  const add = () => { setQty(p.id, qty); toast(cart[p.id] ? 'Sepet güncellendi' : 'Sepete eklendi'); onDone?.(); };
  const buy = () => { onDone?.(); store.set({ buyNow: { id: p.id, qty } }); go('sepet'); };
  const ask = async () => { onDone?.(); await askAbout(p, qty); };
  return <>
    <div className="pdetail">
      <Gallery p={p} />
      <div className="pdetail-info">
        <div className="pd-h">
          <h3>{p.n}</h3>
          {pub && <ShareBtn p={p} big />}
          {pub && <FavBtn id={p.id} big />}
        </div>
        {pub && <RatingLine p={p} />}
        <div className="prow-meta"><code>{p.k}</code>{p.b && <span className="brand-tag">{p.b}</span>}<span>{catName(S, p.c)}</span>{st && <span className={'dot tone-' + st.tone}>{st.t}</span>}</div>
        <PriceBlock p={p} big />
        {!viewOnly && pub && outOfStock(p) && feat(S).notify ? <NotifyBox p={p} /> : !viewOnly && <div className="pbuy">
          <div className="qty-line">
            <span>Adet</span>
            <Stepper value={qty} min={1} onChange={setQ} />
            {pr.mine != null && <span className="pbuy-tot"><small>Toplam</small><b className="num">{fmt(pr.mine * qty, p.cur)}</b></span>}
          </div>
          <div className="pbuy-btns">
            {cart[p.id] && cart[p.id] === qty
              ? <button className="btn pbuy-in" onClick={() => { onDone?.(); go('sepet'); }} title="Sepete git"><span className="pbuy-ok"><Icon n="check" s={13} /></span>Sepette<small>{qty} adet</small></button>
              : <button className="btn primary" onClick={add}><Icon n="cart" s={18} />{cart[p.id] ? 'Sepeti güncelle' : 'Sepete ekle'}</button>}
            {canBuy && <button className="btn pbuy-now" onClick={buy}><Icon n="back" s={16} className="flip" />Hemen satın al</button>}
            {S.requests.allowQuote && !pub && <button className="btn ghost" onClick={ask}><Icon n="chat" s={17} />Bu ürünü sor</button>}
          </div>
        </div>}
      </div>
    </div>
    {S.catalog.showDescription && <Description id={p.id} />}
    {pub && !viewOnly && <PairRail p={p} onPick={onPick} />}
    {pub && <Reviews p={p} />}
    <div className="pd-end" aria-hidden="true" />
  </>;
}
// Ürün açılışı (Ayarlar > Ürün kartları): bilgisayar ve telefon ayrı seçilir (productView / productViewM; telefon boşsa bilgisayarınki)
export const isPhoneUI = () => matchMedia('(max-width: 899px), (hover: none) and (pointer: coarse)').matches;
export const productViewFor = (S) => { const C = S.cards || {}; return (isPhoneUI() ? C.productViewM || C.productView : C.productView) || 'sheet'; };
export function ProductSheet({ p, onClose, viewOnly = false, forceSheet = false }) {
  const S = useStore((s) => s.settings);
  const pub = useStore((s) => s.user?.role === 'public');
  // Ayarlar > Ürün kartları > "Ürün açılışı: sayfa" → pencere yerine ürün sayfası
  const asPage = pub && !viewOnly && !forceSheet && productViewFor(S) === 'page';
  const [cur, setCur] = useState(p);
  useEffect(() => setCur(p), [p?.id]);
  useEffect(() => { if (asPage) { onClose(); openProduct(p.id); } }, [asPage]);
  if (asPage) return null;
  const pick = (x) => { setCur(x); requestAnimationFrame(() => document.querySelector('.sheet-b, .sheet-body')?.scrollTo?.({ top: 0, behavior: 'smooth' })); };
  return (
    <Sheet wide title="Ürün detayı" onClose={onClose}>
      <ProductBody key={cur.id} p={cur} viewOnly={viewOnly} onDone={onClose} onPick={pick} />
    </Sheet>
  );
}
// Ürün sayfası (/magaza/urun/<no>)
export function ProductPage({ id }) {
  const byId = useStore((s) => s.byId);
  const p = byId.get(Number(id));
  // "Beklediğiniz ürün geldi" bildiriminden gelindiyse (?hb=1) ürün haber bekleme listesinden çıkar
  const hasMember = useStore((s) => !!s.member);
  useEffect(() => { if (!p || !hasMember || !/[?&]hb=1/.test(location.search)) return; seenWait([p.id]); try { history.replaceState(history.state, '', location.pathname); } catch {} }, [p?.id, hasMember]);
  if (!p) return <div className="page narrow"><Empty icon="search" title="Ürün bulunamadı"><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty></div>;
  return (
    <div className="page pdetail-page">
      <button className="btn sm ghost pp-back" onClick={() => (history.state?.pid ? history.back() : go('katalog'))}><Icon n="back" s={16} />Geri</button>
      <div className="pp-card"><ProductBody key={p.id} p={p} onPick={(x) => openProduct(x.id)} /></div>
    </div>
  );
}

export function Gallery({ p }) {
  const S = useStore((s) => s.settings);
  const urls = imageList(p, S, 'lg');
  const thumbs = imageList(p, S, 'sm');
  // kaydırma sayfaları: elle yüklenen resim (fs), siteden resimler; video varsa ikinci sırada
  // sıra: panelde dizildiği gibi (resimler + videolar 'v:'); eski tek video alanı vd 2. sırada
  let z = 0;
  const slides = (p.img ? [{ t: 'fs' }] : []).concat(mediaOf(p).map((f) => isVid(f)
    ? { t: 'vid', u: f.slice(2), poster: f.slice(2) === p.vd && p.vdp ? picUrl(p.vdp, null, true) : '' }
    : urls[z] ? { t: 'img', u: urls[z], z: z, th: thumbs[z++] || urls[z - 1] } : null).filter(Boolean));
  const [i, setI] = useState(0);
  const [bad, setBad] = useState({});
  const [zoom, setZoom] = useState(null);
  const track = useRef(null);
  const box = zoom != null && <Lightbox urls={urls} thumbs={thumbs} start={zoom} title={p.n} onClose={() => setZoom(null)} />;
  if (slides.length <= 1) return (
    <>
      <button className="gal-single" onClick={() => urls.length && setZoom(0)} aria-label="Resmi büyüt" disabled={!urls.length}>
        <Thumb p={p} size="lg" />{urls.length > 0 && <span className="gal-zoom"><Icon n="zoom" s={16} /></span>}
      </button>
      {box}
    </>
  );
  // Küçük resme basınca kayma bitene kadar ara resimler "seçili" sayılmasın (çerçeve bir ona bir buna atlıyordu)
  const aim = useRef(null);
  const goTo = (k) => { setI(k); const el = track.current; if (!el) return; aim.current = { k, t: Date.now() }; el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); };
  const onScroll = (e) => {
    const el = e.currentTarget; const w = el.clientWidth || 1;
    const a = aim.current;
    if (a) { if (Math.abs(el.scrollLeft - a.k * w) < 2 || Date.now() - a.t > 900) aim.current = null; else return; }
    setI(Math.round(el.scrollLeft / w));
  };
  const grab = () => { aim.current = null; }; // parmakla kaydırmaya başlayınca normal takibe dön
  const onVid = slides[i]?.t === 'vid';
  return (
    <div className="gallery">
      <div className="gal-stage">
        <div className="gal-track" ref={track} onScroll={onScroll} onTouchStart={grab} onWheel={grab}>
          {slides.map((x, k) => (
            <div className="gal-slide" key={k}>
              {x.t === 'fs' ? <Thumb p={{ ...p, pi: null }} size="lg" />
                : x.t === 'vid' ? <PlayVideo src={x.u} poster={x.poster} active={i === k} />
                : bad[k] ? <Thumb p={{ ...p, pi: null, img: null }} size="lg" /> : (
                <button className="gal-open" onClick={() => setZoom(x.z)} aria-label="Resmi büyüt">
                  <img src={x.u} alt={`${p.n} – resim ${k + 1}`} loading={k ? 'lazy' : 'eager'} onError={() => setBad((b) => ({ ...b, [k]: 1 }))} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!onVid && <span className="gal-count num"><Icon n="zoom" s={13} /> {i + 1} / {slides.length}</span>}
        {i > 0 && <button className="gal-nav prev" onClick={() => goTo(i - 1)} aria-label="Önceki"><Icon n="back" s={18} /></button>}
        {i < slides.length - 1 && <button className="gal-nav next" onClick={() => goTo(i + 1)} aria-label="Sonraki"><Icon n="back" s={18} /></button>}
      </div>
      <ThumbStrip n={slides.length} active={i} onPick={goTo} render={(k) => {
        const x = slides[k];
        if (x.t === 'fs') return <Thumb p={{ ...p, pi: null }} size="sm" />;
        if (x.t === 'vid') return <VideoThumb src={x.u} poster={x.poster} />;
        return <img src={x.th} alt="" loading="lazy" />;
      }} />
      {box}
    </div>
  );
}

// Videonun küçük resmi: verilmiş kapak varsa o; yoksa videonun ~1. saniyesinden bir kare alınır (bellekte saklanır).
// Kare alınamazsa (video sitesi izin vermiyorsa) '' döner; o zaman küçük resimde videonun kendisi duraklatılmış gösterilir.
const frameCache = new Map();
// r2.dev adresleri bazı internet sağlayıcılarında açılmıyor → bekçi (workers.dev) üzerinden aktarılır
export function mediaUrl(u) {
  if (String(u || '').startsWith('r2:')) return picUrl(u, null, true); // depoya yüklenen video / resim
  const m = /^https?:\/\/pub-([0-9a-f]{32})\.r2\.dev\/(.+)$/.exec(String(u || '').trim());
  return m && window.WATCH_URL ? `${window.WATCH_URL}/r2/${m[1]}/${m[2]}` : u;
}
export function useVideoFrame(src0, given) {
  const src = mediaUrl(src0);
  const [u, setU] = useState(() => given || frameCache.get(src) || null);
  useEffect(() => {
    if (given) { setU(given); return; }
    if (!src) { setU(''); return; }
    if (frameCache.has(src)) { setU(frameCache.get(src)); return; }
    let dead = false, v = null, to = 0;
    const done = (x) => { clearTimeout(to); if (x != null) frameCache.set(src, x); if (!dead) setU(x || ''); if (v) { v.removeAttribute('src'); try { v.load(); } catch {} } };
    // Önce video sitesi kare almaya (CORS) izin veriyor mu, ayrı ve zararsız bir istekle sorulur. İzin yoksa videoya
    // "izinli modda" hiç dokunulmaz: başarısız izinli deneme tarayıcının video önbelleğini bozup asıl videoyu açtırmıyordu.
    fetch(src, { mode: 'cors', headers: { Range: 'bytes=0-0' } }).then((r) => {
      if (dead) return;
      if (!r.ok && r.status !== 206) return done('');
      v = document.createElement('video');
      to = setTimeout(() => done(''), 9000);
      v.crossOrigin = 'anonymous'; v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(1.2, (v.duration || 4) * 0.12); }, { once: true });
      v.addEventListener('seeked', () => {
        try {
          const k = Math.min(1, 720 / (v.videoWidth || 720)); const c = document.createElement('canvas');
          c.width = Math.round((v.videoWidth || 720) * k); c.height = Math.round((v.videoHeight || 720) * k);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', 0.82));
        } catch { done(''); }
      }, { once: true });
      v.addEventListener('error', () => done(''), { once: true });
      v.src = src + (src.includes('?') ? '&' : '?') + 'kare=1'; // asıl videodan ayrı önbellek kaydı
    }).catch(() => done(''));
    return () => { dead = true; clearTimeout(to); };
  }, [src, given]);
  return u; // null: hazırlanıyor · '': alınamadı · adres: resim
}
export function VideoThumb({ src: src0, poster }) {
  const src = mediaUrl(src0);
  const f = useVideoFrame(src, poster);
  return <span className="gal-th-vid">{f ? <img src={f} alt="" /> : f === '' ? <video src={src + '#t=1'} muted playsInline preload="metadata" /> : null}<i><Icon n="play" s={14} /></i></span>;
}

// Video: sitenin kendi oynatıcısı gibi (tarayıcı düğmeleri yok). Görünürken sessiz ve döngülü oynar, dokununca
// durur/devam eder, köşede ses ve büyütme düğmesi, altta ilerleme çizgisi. Büyüt → tam ekran izleme (VideoViewer).
// Ürün penceresi (galeri) ve mağaza ana sayfasındaki video bölümü bunu kullanır.
export function PlayVideo({ src: src0, poster, active = true, fit = 'cover', auto = true, className = '' }) {
  const src = mediaUrl(src0);
  const v = useRef(null);
  const [muted, setMuted] = useState(auto); // dokununca oynayanlar sesli başlar
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState(false);
  const [big, setBig] = useState(false); // tam ekranda mı (aynı video öğesi tam ekran katmanına taşınır)
  const frame = useVideoFrame(src, poster);
  const pst = frame || undefined;
  useEffect(() => { const el = v.current; if (!el || big) return; if (active && auto) el.play().catch(() => {}); else el.pause(); }, [active, auto, big]);
  const toggle = () => { const el = v.current; if (!el) return; el.paused ? el.play().catch(() => {}) : el.pause(); };
  const open = () => setBig(true);
  // alttaki süre çubuğu: parmakla / fareyle tutup ileri-geri çekilir (resim şeridini kaydırmaz)
  const bar = useRef(null);
  const [seek, setSeek] = useState(null);
  const at = (e) => { const r = bar.current.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left - 10) / (r.width - 20))); };
  const jump = (x) => { const el = v.current; if (!el || !el.duration) return; el.currentTime = x * el.duration; setProg(x); };
  const fmtT = (x) => { x = Math.max(0, Math.floor(x || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
  if (err) return <div className={'gal-vid-err ' + className}><Icon n="play" s={26} /><span>Video açılamadı</span></div>;
  return (
    <div className={'gal-vid' + (playing ? ' playing' : '') + ' ' + className}>
      <video ref={v} src={src} poster={pst} muted={muted} loop playsInline preload="metadata" disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen"
        style={{ objectFit: fit }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setErr(true)}
        onTimeUpdate={(e) => { const d = e.currentTarget.duration; if (d) setProg(e.currentTarget.currentTime / d); }} onClick={() => !big && toggle()} />
      {!playing && <button className="gal-vid-play" onClick={toggle} aria-label="Oynat"><Icon n="play" s={28} /></button>}
      <button className="gal-vid-snd" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}><Icon n={muted ? 'mute' : 'sound'} s={17} /></button>
      <button className="gal-vid-big" onClick={open} aria-label="Büyüt" title="Büyük izle"><Icon n="full" s={17} /></button>
      <div className={'gal-vid-seek' + (seek != null ? ' on' : '')} ref={bar} role="slider" aria-label="Sar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((seek ?? prog) * 100)}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const x = at(e); setSeek(x); jump(x); }}
        onPointerMove={(e) => { if (seek == null) return; const x = at(e); setSeek(x); jump(x); }}
        onPointerUp={() => setSeek(null)} onPointerCancel={() => setSeek(null)}
        onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <span className="gal-vid-bar"><i style={{ transform: `scaleX(${seek ?? prog})` }} /></span>
        {seek != null && <><b className="gal-vid-knob" style={{ left: `calc(10px + ${seek} * (100% - 20px))` }} /><em className="gal-vid-time num" style={{ left: `clamp(30px, calc(10px + ${seek} * (100% - 20px)), calc(100% - 30px))` }}>{fmtT(seek * (v.current?.duration || 0))}</em></>}
      </div>
      {big && v.current && <VideoViewer el={v.current} onClose={() => setBig(false)} />}
    </div>
  );
}

// Sarma çubuğu: parmakla / fareyle çubuğun herhangi bir yerinden tutup sürüklenir (iPhone'un kendi sürgüsü tutmuyordu)
function Scrub({ t, dur, onSeek }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);
  const at = (e) => { const r = ref.current.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
  const p = drag != null ? drag : dur ? t / dur : 0;
  return (
    <div ref={ref} className={'vv-seek' + (drag != null ? ' on' : '')} role="slider" aria-label="Sar" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const x = at(e); setDrag(x); onSeek(x); }}
      onPointerMove={(e) => { if (drag == null) return; const x = at(e); setDrag(x); onSeek(x); }}
      onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      <span className="vv-seek-t"><i style={{ width: p * 100 + '%' }} /></span>
      <b style={{ left: p * 100 + '%' }} />
    </div>
  );
}

// Tam ekran video izleme: karanlık zemin, video ekrana sığar (kesilmez), sesli başlar. Dokununca düğmeler görünür /
// gizlenir; ortada oynat-durdur, altta ileri-geri sarma çubuğu, süre ve ses. Kapat (×), Esc ya da aşağı kaydırma.
export function VideoViewer({ el, onClose }) {
  const slot = useRef(null);
  const [playing, setPlaying] = useState(!el.paused);
  const [ui, setUi] = useState(true);
  const [t, setT] = useState(el.currentTime || 0);
  const [dur, setDur] = useState(el.duration || 0);
  const [muted, setMuted] = useState(false);
  const [out, setOut] = useState(false);
  const hideT = useRef(0);
  const close = () => { if (out) return; setOut(true); setTimeout(onClose, 180); };
  const poke = () => { setUi(true); clearTimeout(hideT.current); hideT.current = setTimeout(() => { if (!el.paused) setUi(false); }, 2600); };
  const toggle = () => { el.paused ? el.play().catch(() => {}) : el.pause(); poke(); };
  // Küçük oynatıcıdaki video öğesinin kendisi buraya taşınır: yeniden yükleme yok, duraksamadan aynı yerden devam eder.
  // Kapanınca yerine geri konur (ses eski hâline döner).
  useLayoutEffect(() => {
    const home = { parent: el.parentNode, style: el.getAttribute('style'), muted: el.muted };
    slot.current.appendChild(el);
    el.style.objectFit = 'contain'; el.style.pointerEvents = 'none';
    el.muted = false;
    if (el.paused) el.play().catch(() => { el.muted = true; setMuted(true); el.play().catch(() => {}); });
    const on = { play: () => { setPlaying(true); poke(); }, pause: () => { setPlaying(false); setUi(true); }, timeupdate: () => setT(el.currentTime), durationchange: () => setDur(el.duration || 0), loadedmetadata: () => setDur(el.duration || 0), volumechange: () => setMuted(el.muted) };
    for (const k in on) el.addEventListener(k, on[k]);
    const kd = (e) => { if (e.key === 'Escape') close(); if (e.key === ' ') { e.preventDefault(); toggle(); } };
    addEventListener('keydown', kd); poke();
    return () => {
      for (const k in on) el.removeEventListener(k, on[k]);
      removeEventListener('keydown', kd); clearTimeout(hideT.current);
      if (home.parent) home.parent.insertBefore(el, home.parent.firstChild);
      if (home.style == null) el.removeAttribute('style'); else el.setAttribute('style', home.style);
      el.muted = home.muted;
      if (el.paused) el.play().catch(() => {});
    };
  }, []);
  const fmtT = (x) => { x = Math.max(0, Math.floor(x || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
  // telefonda aşağı kaydırınca kapanır
  const sw = useRef(null);
  return createPortal(
    <div className={'vv' + (ui ? ' ui' : '') + (out ? ' out' : '')} role="dialog" aria-modal="true" aria-label="Video"
      onTouchStart={(e) => { e.stopPropagation(); sw.current = e.target.closest('.vv-bar') ? null : { y: e.touches[0].clientY, x: e.touches[0].clientX }; }}
      onTouchMove={(e) => e.stopPropagation()} onTouchCancel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onTouchEnd={(e) => { e.stopPropagation(); const s0 = sw.current; sw.current = null; const p = e.changedTouches[0]; if (s0 && p.clientY - s0.y > 110 && Math.abs(p.clientX - s0.x) < 80) close(); }}>
      <div ref={slot} className="vv-slot" />
      <div className="vv-tap" onClick={() => (ui ? (playing ? setUi(false) : toggle()) : poke())} />
      <button className="vv-x" onClick={close} aria-label="Kapat"><Icon n="x" s={22} /></button>
      <button className="vv-pp" onClick={toggle} aria-label={playing ? 'Durdur' : 'Oynat'}><Icon n={playing ? 'pause' : 'play'} s={30} /></button>
      <div className="vv-bar" onClick={(e) => e.stopPropagation()}>
        <span className="num">{fmtT(t)}</span>
        <Scrub t={t} dur={dur} onSeek={(x) => { if (!dur) return; el.currentTime = x * dur; setT(el.currentTime); poke(); }} />
        <span className="num">{fmtT(dur)}</span>
        <button onClick={() => { el.muted = !el.muted; setMuted(el.muted); poke(); }} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}><Icon n={muted ? 'mute' : 'sound'} s={19} /></button>
      </div>
    </div>,
    document.body
  );
}

// Küçük resim şeridi: taşarsa iki yanda ok çıkar, fare tekerleğiyle yana kayar, seçili resmi hep görünür tutar
export function ThumbStrip({ n, active, onPick, render, dark }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    setEdge({ l: el.scrollLeft > 2, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    const wheel = (e) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault(); el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', wheel); };
  }, [n]);
  useEffect(() => {
    const el = ref.current; const b = el?.children[active]; if (!b) return;
    const l = b.offsetLeft - el.offsetLeft, r = l + b.offsetWidth;
    if (l < el.scrollLeft + 8) el.scrollTo({ left: l - 40, behavior: 'smooth' });
    else if (r > el.scrollLeft + el.clientWidth - 8) el.scrollTo({ left: r - el.clientWidth + 40, behavior: 'smooth' });
  }, [active]);
  return (
    <div className={'strip' + (dark ? ' dark' : '')}>
      {/* oklar şeridi kaydırmaz, bir önceki / sonraki resme geçer (şerit seçili resmi kendiliğinden gösterir) */}
      {(edge.l || edge.r) && active > 0 && <button className="strip-arrow l" onClick={() => onPick(active - 1)} aria-label="Önceki resim"><Icon n="back" s={16} /></button>}
      <div className="gal-thumbs" ref={ref} onScroll={measure}>
        {Array.from({ length: n }, (_, k) => (
          <button key={k} className={'gal-th' + (k === active ? ' on' : '')} onClick={() => onPick(k)} aria-label={`Resim ${k + 1}`} aria-current={k === active}>
            {render(k)}
          </button>
        ))}
      </div>
      {(edge.l || edge.r) && active < n - 1 && <button className="strip-arrow r" onClick={() => onPick(active + 1)} aria-label="Sonraki resim"><Icon n="back" s={16} /></button>}
    </div>
  );
}

// Resim görüntüleyici: resim ekrana sığar (büyütülmez). İstenirse büyüteçle 2 kat yakınlaştırılır.
export function Lightbox({ urls, thumbs, start = 0, title, onClose }) {
  const [i, setI] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const track = useRef(null);
  const imgs = useRef([]);
  const iRef = useRef(start); iRef.current = i;
  const go = useCallback((k) => {
    const n = Math.max(0, Math.min(urls.length - 1, k));
    setZoomed(false); setI(n);
    const el = track.current; if (el) el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  }, [urls.length]);
  useEffect(() => {
    const el = track.current; if (el) el.scrollLeft = start * el.clientWidth;
    const k = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(iRef.current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(iRef.current - 1); }
    };
    addEventListener('keydown', k, true); document.body.classList.add('noscroll');
    return () => { removeEventListener('keydown', k, true); document.body.classList.remove('noscroll'); };
  }, []);
  function toggleZoom(e) {
    const img = imgs.current[i]; if (!img) return;
    if (zoomed) { setZoomed(false); return; }
    const r = img.getBoundingClientRect();
    const fx = e?.clientX != null ? (e.clientX - r.left) / r.width : 0.5, fy = e?.clientY != null ? (e.clientY - r.top) / r.height : 0.5;
    img.style.setProperty('--zw', r.width * 2 + 'px');
    setZoomed(true);
    requestAnimationFrame(() => { const sc = img.parentElement; sc.scrollLeft = fx * img.offsetWidth - sc.clientWidth / 2; sc.scrollTop = fy * img.offsetHeight - sc.clientHeight / 2; });
  }
  const many = urls.length > 1;
  return createPortal(
    <div className={'lb' + (many ? ' many' : '')} role="dialog" aria-modal="true" aria-label={title}>
      <div className={'lb-track' + (zoomed ? ' locked' : '')} ref={track} onScroll={(e) => { if (!zoomed) { const el = e.currentTarget; const n = Math.round(el.scrollLeft / el.clientWidth); if (n !== iRef.current) setI(n); } }}>
        {urls.map((u, k) => (
          <div key={k} className={'lb-slide' + (zoomed && k === i ? ' zoomed' : '')}>
            <img ref={(el) => (imgs.current[k] = el)} src={u} alt={`${title} – resim ${k + 1}`} draggable="false" loading={Math.abs(k - start) > 1 ? 'lazy' : 'eager'}
              onDoubleClick={(e) => k === i && toggleZoom(e)} onClick={(e) => zoomed && k === i && toggleZoom(e)} />
          </div>
        ))}
      </div>
      <div className="lb-top">
        <span className="num">{i + 1} / {urls.length}</span>
        <span className="lb-title">{title}</span>
        <button className={'lb-btn' + (zoomed ? ' on' : '')} onClick={() => toggleZoom()} aria-label={zoomed ? 'Küçült' : 'Yakınlaştır'} title={zoomed ? 'Küçült' : 'Yakınlaştır (çift tıklama)'}><Icon n="zoom" s={20} /></button>
        <button className="lb-btn" onClick={onClose} aria-label="Kapat"><Icon n="x" s={22} /></button>
      </div>
      {i > 0 && <button className="lb-btn lb-nav prev" onClick={() => go(i - 1)} aria-label="Önceki"><Icon n="back" s={24} /></button>}
      {i < urls.length - 1 && <button className="lb-btn lb-nav next" onClick={() => go(i + 1)} aria-label="Sonraki"><Icon n="back" s={24} /></button>}
      {many && <div className="lb-strip"><ThumbStrip dark n={urls.length} active={i} onPick={go} render={(k) => <img src={thumbs?.[k] || urls[k]} alt="" loading="lazy" />} /></div>}
    </div>,
    document.body
  );
}

function Description({ id }) {
  const [html, setHtml] = useState(null);
  const [more, setMore] = useState(false);
  const [zoom, setZoom] = useState(null);
  useEffect(() => { let live = true; api().getDesc(id).then((h) => live && setHtml(h ? cleanHtml(h) : '')).catch(() => live && setHtml('')); return () => { live = false; }; }, [id]);
  if (!html) return null;
  return (
    <section className={'pdesc' + (more ? ' open' : '')}>
      <h4 className="eyebrow">Ürün açıklaması</h4>
      <div className="pdesc-body" dangerouslySetInnerHTML={{ __html: html }} onClick={(e) => {
        if (e.target.tagName !== 'IMG') return;
        const imgs = [...e.currentTarget.querySelectorAll('img')]; setZoom({ urls: imgs.map((x) => x.src), start: imgs.indexOf(e.target) });
      }} />
      {!more && <button className="link" onClick={() => setMore(true)}>Devamını göster</button>}
      {zoom && <Lightbox urls={zoom.urls} start={zoom.start} title="Açıklama resmi" onClose={() => setZoom(null)} />}
    </section>
  );
}

// Ürün hakkında soru talebi aç (ürün detayı ve sağ tık menüsünden)
async function askAbout(p, qty) {
  const { user, settings: S, userPrices } = store.s;
  const pr = priceFor(p, S, user, userPrices);
  const item = { id: p.id, k: p.k, n: p.n, cur: p.cur, qty, list: p.r, asked: pr.mine, offer: pr.mine };
  const t = now();
  const id = await api().createRequest({
    uid: user.uid, userName: user.name || user.username, shop: user.shop || '', type: 'quote', status: 'new', items: [item], note: '', pickup: '',
    createdAt: t, updatedAt: t, unreadAdmin: 1, unreadUser: 0, lastMsg: 'Ürün hakkında soru', lastFrom: 'user',
  }, [{ from: 'system', text: 'Ürün sorusu açıldı · ' + p.n, at: t }]);
  openRequest(id); toast('Soru açıldı, mesajınızı yazın');
}

// Sağ tık menüsünden hızlı değişiklik (aktif/pasif, uyarı kaldır)
// "Toptanı kontrol edilecekler": tüm liste fiyatı uyarılarını kaldır (otomatik toptanlılardaki eski uyarılar da temizlenir)
async function clearChecks() {
  const list = store.s.catalog.map(({ _s, _t, ...x }) => { if (!x.pc) return x; const { pc, ...y } = x; return y; });
  setCatalog(list); toast('Fiyat uyarıları kaldırıldı'); saveCatalogLater();
}
const NH = new WeakMap(); // ürün → aranacak ad + marka (stok kodu hariç)
function nameHay(p) { let v = NH.get(p); if (v == null) NH.set(p, (v = norm(p.n + ' ' + (p.b || '')))); return v; }
// Hızlı kayıt: ekran HEMEN değişir, kayıt arka plan kuyruğunda (saveq.js; durum SaveDock'ta)
function quickSave(p, patch, msg) {
  const list = store.s.catalog.map(({ _s, _t, ...x }) => {
    if (x.id !== p.id) return x;
    const n = { ...x, ur: 'edit', ...patch, ut: Date.now() }; // ut/ur: son işlem tarihi ve nedeni (tabloda)
    for (const k of Object.keys(patch)) if (patch[k] == null) delete n[k];
    return n;
  });
  setCatalog(list);
  if (msg) toast(msg);
  saveCatalogLater();
  return Promise.resolve();
}
export const saveCatalogLater = () => queueSave('catalog', () => api().saveCatalog(store.s.catalog.map(({ _s, _t, ...x }) => x)));
