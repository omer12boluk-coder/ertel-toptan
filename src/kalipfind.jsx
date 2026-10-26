// Mağaza > Kalıp bulucu: telefon modeli yazılır → işlemcisi gösterilir → katalogdan uyan kalıplar önerilir.
// Telefon → işlemci verisi /kalip/phones.json (GSMArena'dan toplanır, tools/kalip-build.mjs).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, api } from './store.js';
import { Icon } from './ui.jsx';
import { norm } from './utils.js';
import { waLink } from './route.js';
import { ProductSheet } from './catalog.jsx';
import { PCard } from './shophome.jsx';
import { chipCodes, phoneCodes, vendorOf } from './kalip.js';

let phonesP = null;
function loadPhones() {
  phonesP = phonesP || fetch('/kalip/phones.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => d.p.map(([n, c, k]) => { const s = norm(n); return { n, c, k: k ? k.split(' ') : [], s, z: s.replace(/[\s-]+/g, '') }; }))
    .catch((e) => { phonesP = null; throw e; });
  return phonesP;
}
const BRAND_W = { samsung: 9, xiaomi: 9, apple: 9, huawei: 7, oppo: 6, realme: 6, honor: 6, vivo: 5, oneplus: 5, tecno: 5, infinix: 5, motorola: 4, google: 4, nokia: 3, poco: 6, redmi: 6 };
const VENDOR = { qualcomm: 'Qualcomm', mediatek: 'MediaTek', exynos: 'Samsung Exynos', kirin: 'HiSilicon Kirin', apple: 'Apple', tensor: 'Google Tensor', unisoc: 'Unisoc' };
const VENDOR_RX = { qualcomm: /qualcomm|snapdragon|\bmsm|\bsdm|\bsm\d/, mediatek: /mediatek|\bmtk\b|\bmt\d/, exynos: /exynos|samsung islemci|\bsam\b/, kirin: /kirin|hisilicon|huawei/, apple: /iphone|apple|\ba\d{1,2}\b/ };

// "redmi note 10 pro 5g" gibi aramayı telefon adlarında arar; boşluksuz yazılanı da bulur (note10)
function searchPhones(list, q) {
  const nq = norm(q).trim(); if (nq.length < 2) return [];
  const toks = nq.split(/\s+/).filter(Boolean); const zq = nq.replace(/[\s-]+/g, '');
  const res = [];
  for (const p of list) {
    if (!(toks.every((t) => p.s.includes(t)) || p.z.includes(zq))) continue;
    const brand = p.s.split(' ')[0];
    let sc = (BRAND_W[brand] || 0) - p.n.length * 0.35;
    if (p.s.endsWith(nq) || p.z.endsWith(zq)) sc += 14;
    if (new RegExp('(^| )' + toks[toks.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$').test(p.s)) sc += 6;
    res.push([sc, p]);
  }
  return res.sort((a, b) => b[0] - a[0]).slice(0, 8).map((x) => x[1]);
}
const short = (c) => String(c || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^(Qualcomm|Mediatek|MediaTek|Apple|Samsung|HiSilicon|Google|Unisoc)\s+/i, '').replace(/\b(SM|SDM|MSM|MT)\d{3,4}[A-Z0-9-]*\s*/g, '').trim();

export function KalipFinder() {
  const { catalog, settings: S } = useStore();
  const [phones, setPhones] = useState(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [sel, setSel] = useState(null); // {n, c, k} ya da {code}
  const [descs, setDescs] = useState(null);
  const [prod, setProd] = useState(null);
  const inp = useRef(null);
  useEffect(() => { document.title = 'Kalıp bulucu'; loadPhones().then(setPhones).catch(() => setErr(true)); }, []);
  useEffect(() => { let live = true; const A = api(); (A.loadDescMap ? A.loadDescMap() : Promise.resolve({})).then((d) => live && setDescs(d || {})).catch(() => live && setDescs({})); return () => { live = false; }; }, []);

  // kalıp ürünleri ve içerdikleri işlemci kodları
  const stencils = useMemo(() => catalog.filter((p) => p.a !== 0 && !p.so && /kalip/.test(norm(p.n))).map((p) => {
    const txt = p.n + ' ' + (descs?.[p.id] || '');
    return { p, k: chipCodes(txt), t: norm(txt) };
  }), [catalog, descs]);

  const sugg = useMemo(() => (phones && q && open ? searchPhones(phones, q) : []), [phones, q, open]);
  const qCodes = useMemo(() => [...chipCodes(q)], [q]);

  const pick = (ph) => { setSel(ph); setQ(ph.n); setOpen(false); inp.current?.blur(); try { history.replaceState(history.state, '', '/magaza/kalip?m=' + encodeURIComponent(ph.n)); } catch {} };
  const pickCode = () => { if (!qCodes.length) return; setSel({ n: null, c: q.trim().toUpperCase(), k: qCodes }); setOpen(false); inp.current?.blur(); };
  // adresteki ?m= ile gelince seçili aç
  useEffect(() => { if (!phones) return; const m = new URLSearchParams(location.search).get('m'); if (m) { const p = phones.find((x) => x.n === m); if (p) { setSel(p); setQ(p.n); } } }, [phones]);

  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, sugg.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (sugg[hi]) pick(sugg[hi]); else pickCode(); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const result = useMemo(() => {
    if (!sel) return null;
    const codes = new Set(sel.k);
    const exact = stencils.filter((s) => [...s.k].some((c) => codes.has(c)))
      .sort((a, b) => a.k.size - b.k.size);
    const single = exact.filter((s) => s.k.size <= 2 && !/set/i.test(s.p.n));
    const sets = exact.filter((s) => !single.includes(s));
    const v = vendorOf(sel.c); const brand = sel.n ? norm(sel.n).split(' ')[0] : '';
    const ids = new Set(exact.map((s) => s.p.id));
    const more = stencils.filter((s) => !ids.has(s.p.id) && /set/i.test(s.p.n) && s.k.size === 0 && (
      (v && VENDOR_RX[v]?.test(s.t) && !/emmc|birlestirme|airpods|mac|face/.test(s.t)) ||
      (brand && brand !== 'apple' && new RegExp('\\b' + brand + '\\b').test(s.t) && /entegre/.test(s.t))
    ));
    return { single, sets, more, v };
  }, [sel, stencils]);

  const wa = S.shop?.whatsapp ? waLink(S.shop.whatsapp, `Merhaba, ${sel?.n || ''} (${sel?.c || ''}) için uygun kalıp var mı?`) : null;
  const total = result ? result.single.length + result.sets.length : 0;

  return (
    <div className="kf">
      <section className="kf-hero">
        <span className="kf-badge"><Icon n="chip" s={15} />Kalıp bulucu</span>
        <h1>Telefonunuza uygun <em>kalıbı</em> bulun</h1>
        <p>Modeli yazın; işlemcisini gösterelim, o işlemciye uyan kalıpları önerelim.</p>
        <div className={'kf-search' + (open && sugg.length ? ' open' : '')}>
          <Icon n="search" s={20} />
          <input ref={inp} type="search" value={q} placeholder="Örn. Redmi Note 10 Pro 5G, iPhone 13, Galaxy A52…" aria-label="Telefon modeli"
            onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)} onKeyDown={key} autoComplete="off" />
          {q && <button type="button" className="kf-x" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(''); setSel(null); inp.current?.focus(); }} aria-label="Temizle"><Icon n="x" s={14} /></button>}
          {open && q.trim().length >= 2 && (
            <div className="kf-sugg" role="listbox">
              {!phones && !err && <p className="kf-none">Telefon listesi yükleniyor…</p>}
              {err && <p className="kf-none">Telefon listesi açılamadı. Sayfayı yenileyin.</p>}
              {sugg.map((p, i) => (
                <button type="button" key={p.n} role="option" aria-selected={i === hi} className={'kf-it' + (i === hi ? ' on' : '')} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                  <Icon n="mobile" s={17} /><span><b>{p.n}</b><small>{short(p.c) || p.c}</small></span>
                </button>
              ))}
              {phones && !sugg.length && (qCodes.length
                ? <button type="button" className="kf-it on" onMouseDown={(e) => e.preventDefault()} onClick={pickCode}><Icon n="chip" s={17} /><span><b>{qCodes.join(' · ')}</b><small>Bu işlemci koduna uyan kalıpları göster</small></span></button>
                : <p className="kf-none">“{q}” bulunamadı. Modeli farklı yazmayı ya da işlemci kodunu (ör. SM7150, MT6769) deneyin.</p>)}
            </div>
          )}
        </div>
        {!sel && <div className="kf-try">Denemek için: {['Redmi Note 10 Pro 5G', 'iPhone 13', 'Galaxy A52', 'Redmi Note 8'].map((x) => <button type="button" key={x} onClick={() => { setQ(x); setOpen(true); setHi(0); inp.current?.focus(); }}>{x}</button>)}</div>}
      </section>

      {sel && result && (
        <>
          <section className="kf-phone">
            <span className={'kf-chipic v-' + (result.v || 'x')}><Icon n="chip" s={30} /></span>
            <div className="kf-ph-t">
              {sel.n && <small>{sel.n}</small>}
              <h2>{sel.n ? short(sel.c) || sel.c : sel.c}</h2>
              <div className="kf-codes">
                {result.v && <span className="kf-vendor">{VENDOR[result.v]}</span>}
                {sel.k.map((c) => <span key={c} className="kf-code">{c.replace(/^A(\d+)P$/, 'A$1 Pro').replace(/^EX(\d+)/, 'Exynos $1')}</span>)}
              </div>
            </div>
            <div className="kf-count"><b className="num">{total}</b><span>uygun kalıp</span></div>
          </section>

          {total === 0 && (
            <div className="kf-empty">
              <Icon n="box" s={26} />
              <div><b>Bu işlemciye özel kalıp şu an katalogda yok.</b><p>Aşağıdaki genel setler işinizi görebilir ya da bize sorun, hemen bakalım.</p></div>
              {wa && <a className="btn wa" href={wa} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp’tan sor</a>}
            </div>
          )}
          {result.single.length > 0 && <KfGroup title="Bu işlemcinin kalıbı" sub="Doğrudan bu işlemci için" list={result.single} onOpen={setProd} />}
          {result.sets.length > 0 && <KfGroup title="Bu işlemciyi içeren kalıp setleri" sub="Setin içinde bu işlemcinin kalıbı da var" list={result.sets} onOpen={setProd} />}
          {result.more.length > 0 && <KfGroup title="Bunlara da bakın" sub="Genel setler · içeriğini ürün açıklamasından kontrol edin" list={result.more} onOpen={setProd} muted />}
          {total > 0 && wa && <p className="kf-ask">Emin olamadınız mı? <a href={wa} target="_blank" rel="noopener">WhatsApp’tan sorun</a>, uygun kalıbı birlikte seçelim.</p>}
        </>
      )}
      {prod && <ProductSheet p={prod} onClose={() => setProd(null)} />}
    </div>
  );
}

function KfGroup({ title, sub, list, onOpen, muted }) {
  return (
    <section className={'kf-group' + (muted ? ' muted' : '')}>
      <div className="kf-gh"><h3>{title}<span className="num">{list.length}</span></h3><small>{sub}</small></div>
      <div className="kf-grid">{list.map((s, i) => <PCard key={s.p.id} p={s.p} i={i} onOpen={() => onOpen(s.p)} />)}</div>
    </section>
  );
}
