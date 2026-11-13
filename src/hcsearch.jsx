// 14.11.2026 'Ortada logo' üst menüde arama (bilgisayar): kullanıcının beğendiği Konyalı Saat düzeni.
// Arama simgesine basınca logonun sağından sayfanın sağ kenarına kadar arama satırı açılır (sağda ×), menünün altına
// tam genişlik beyaz panel iner: SON ARAMALAR (çipler, × ile silinir) · SİZE ÖZEL (favoriler, yoksa yeni gelenler; 2 sütun)
// · yazınca eşleşen ürünler · TÜM SONUÇLARI GÖR; panelin altı sayfayı karartır (tıklayınca kapanır, Esc da kapatır).
// Eski küçük kutu: look.hcSearch = 'old' (Tasarım › Gelişmiş › Menüler).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, store, go } from './store.js';
import { Icon, Thumb } from './ui.jsx';
import { fmt, norm, priceFor, ls } from './utils.js';
import { ProductSheet } from './catalog.jsx';

const RK = 'hs-recent';
const recentGet = () => { try { const a = ls.get(RK, []); return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 8) : []; } catch { return []; } };
const recentAdd = (q) => { const t = String(q || '').trim(); if (!t) return; try { ls.set(RK, [t, ...recentGet().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8)); } catch {} };
const recentDel = (q) => { try { ls.set(RK, recentGet().filter((x) => x !== q)); } catch {} };
const sellable = (p) => p && p.a !== 0 && !p.so;
const hasImg = (p) => !!(p && (p.pi || p.im || p.img));

export function HcSearch() {
  const [open, setOpen] = useState(false);
  const [shut, setShut] = useState(false); // kapanış animasyonu
  const [q, setQ] = useState('');
  const [prod, setProd] = useState(null);
  const [rc, setRc] = useState(recentGet);
  const [box, setBox] = useState(null);
  const inp = useRef(null); const t = useRef(0);
  const { catalog, settings: S, user, userPrices, favs } = useStore();
  const measure = () => {
    const top = document.querySelector('.topbar.hdr-c'); const mid = top?.querySelector('.hc-mid'); const tin = top?.querySelector('.topbar-in');
    if (!top || !mid || !tin) return;
    const T = top.getBoundingClientRect(), M = mid.getBoundingClientRect(), I = tin.getBoundingClientRect();
    setBox({ top: Math.max(0, T.top), rowH: Math.round(M.bottom - T.top + (M.top - T.top)), left: Math.round(M.right + 36), right: Math.round(innerWidth - I.right), bottom: Math.round(T.bottom) });
  };
  const show = () => { measure(); clearTimeout(t.current); setShut(false); setRc(recentGet()); setOpen(true); setTimeout(() => inp.current?.focus(), 30); };
  const hide = () => { setShut(true); clearTimeout(t.current); t.current = setTimeout(() => { setOpen(false); setShut(false); setQ(''); }, 200); };
  useLayoutEffect(() => { if (!open) return; const f = () => measure(); addEventListener('resize', f); return () => removeEventListener('resize', f); }, [open]);
  useEffect(() => { if (!open) return; const k = (e) => { if (e.key === 'Escape') hide(); }; addEventListener('keydown', k); document.documentElement.classList.add('hcs-open'); return () => { removeEventListener('keydown', k); document.documentElement.classList.remove('hcs-open'); }; }, [open]);
  useEffect(() => () => clearTimeout(t.current), []);

  const res = useMemo(() => {
    const w = norm(q).split(/\s+/).filter(Boolean); if (!w.length) return null;
    const tags = S?.catalog?.searchTags !== false;
    const all = catalog.filter((p) => sellable(p) && w.every((x) => p._s?.includes(x) || (tags && p._t?.includes(x))));
    all.sort((a, b) => w.filter((x) => b._s?.includes(x)).length - w.filter((x) => a._s?.includes(x)).length);
    return { list: all.slice(0, 6), n: all.length };
  }, [q, catalog, S]);
  const mine = useMemo(() => {
    if (!open) return [];
    const by = store.s.byId; const out = []; const seen = new Set();
    const add = (p) => { if (out.length < 4 && sellable(p) && hasImg(p) && !seen.has(p.id)) { seen.add(p.id); out.push(p); } };
    (favs || []).slice().reverse().forEach((id) => add(by?.get?.(id)));
    catalog.filter((p) => p.nw && p.s > 0).forEach(add);
    catalog.filter((p) => p.s > 0).forEach(add);
    return out;
  }, [open, favs, catalog]);
  const goAll = (txt = q) => { const v = String(txt || '').trim(); if (!v) return; recentAdd(v); store.set({ catalogGo: { q: v } }); go('katalog'); hide(); };
  const pick = (p) => { if (q.trim()) recentAdd(q); setProd(p); hide(); };
  const Item = ({ p }) => { const pr = priceFor(p, S, user, userPrices); return (
    <button type="button" className="hcs-it" onClick={() => pick(p)}>
      <span className="hcs-im"><Thumb p={p} size="sm" /></span>
      <span className="hcs-tx">{p.b && <small>{p.b}</small>}<span className="hcs-n">{p.n}</span><b className="num">{pr.mine == null ? 'Fiyat sorun' : fmt(pr.mine, p.cur)}</b></span>
    </button>); };
  const cta = S?.shopHome?.cta?.title;

  return <>
    <button type="button" className="icon-btn hcs-btn" onClick={show} aria-label="Ürün ara" aria-expanded={open}><Icon n="search" s={19} /></button>
    {open && box && createPortal(<div className={'hcs' + (shut ? ' out' : '')}>
      <div className="hcs-ov" style={{ top: box.bottom }} onClick={hide} aria-hidden="true" />
      <form className="hcs-bar" style={{ top: box.top, height: box.rowH, left: box.left, right: box.right }} role="search" onSubmit={(e) => { e.preventDefault(); goAll(); }}>
        <Icon n="search" s={20} />
        <input ref={inp} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ne arıyorsunuz?" aria-label="Ürün ara" autoComplete="off" />
        <button type="button" className="hcs-x" onClick={hide} aria-label="Aramayı kapat"><Icon n="x" s={22} /></button>
      </form>
      <div className="hcs-panel" style={{ top: box.bottom }}>
        <div className="hcs-in">
          {!res ? <>
            {rc.length > 0 && <section><h3>Son aramalar</h3><div className="hcs-chips">{rc.map((x) => <span key={x} className="hcs-chip"><button type="button" onClick={() => { setQ(x); inp.current?.focus(); }}>{x}</button><button type="button" className="hcs-cx" onClick={() => { recentDel(x); setRc(recentGet()); }} aria-label={x + ' aramasını sil'}><Icon n="x" s={12} /></button></span>)}</div></section>}
            {mine.length > 0 && <section><h3>Size özel</h3><div className="hcs-grid">{mine.map((p) => <Item key={p.id} p={p} />)}</div></section>}
            <button type="button" className="hcs-all" onClick={() => { go('katalog'); hide(); }}>Tüm ürünleri gör</button>
          </> : res.n === 0 ? <p className="hcs-none">“{q}” ile eşleşen ürün yok. Başka bir kelime deneyin.</p> : <>
            <section><h3>Ürünler <span>({res.n})</span></h3><div className="hcs-grid">{res.list.map((p) => <Item key={p.id} p={p} />)}</div></section>
            <button type="button" className="hcs-all" onClick={() => goAll()}>Tüm sonuçları gör ({res.n})</button>
          </>}
        </div>
        {cta && <div className="hcs-foot">{cta}{S?.shopHome?.cta?.text ? <> — <b>{S.shopHome.cta.text}</b></> : null}</div>}
      </div>
    </div>, document.body)}
    {prod && <ProductSheet p={prod} onClose={() => setProd(null)} />}
  </>;
}
