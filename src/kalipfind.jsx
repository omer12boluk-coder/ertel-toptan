// Mağaza > Kalıp bulucu: telefon modeli yazılır → işlemcisi gösterilir → katalogdan uyan kalıplar önerilir.
// Telefon → işlemci verisi /kalip/phones.json (GSMArena'dan toplanır, tools/kalip-build.mjs).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, api } from './store.js';
import { Icon, Toggle } from './ui.jsx';
import { norm } from './utils.js';
import { waLink } from './route.js';
import { ProductSheet } from './catalog.jsx';
import { PCard } from './shophome.jsx';
import { chipCodes, phoneCodes, vendorOf, isStencil, stencilKeys } from './kalip.js';

let phonesP = null;
const mk = (n, c, k) => { const s = norm(n); return { n, c, k, s, z: s.replace(/[\s-]+/g, '') }; };
// GSMArena listesi + yöneticinin eklediği / düzelttiği modeller (settings.kalip.phones {ad: işlemci}; boş işlemci = gizle)
export function mergePhones(base, over) {
  if (!over || !Object.keys(over).length) return base;
  const m = new Map(base.map((p) => [p.n.toLowerCase(), p]));
  for (const [n, c] of Object.entries(over)) { const key = n.toLowerCase(); if (!c) { m.delete(key); continue; } if (c === '?') continue; /* '?' = işlemci henüz seçilmedi */ m.set(key, { ...mk(n, c, [...phoneCodes(c)]), own: 1 }); }
  return [...m.values()];
}
export function loadPhones() {
  phonesP = phonesP || fetch('/kalip/phones.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => d.p.map(([n, c, k]) => mk(n, c, k ? k.split(' ') : [])))
    .catch((e) => { phonesP = null; throw e; });
  return phonesP;
}
const BRAND_W = { samsung: 9, xiaomi: 9, apple: 9, huawei: 7, oppo: 6, realme: 6, honor: 6, vivo: 5, oneplus: 5, tecno: 5, infinix: 5, motorola: 4, google: 4, nokia: 3, poco: 6, redmi: 6 };
const VENDOR = { qualcomm: 'Qualcomm', mediatek: 'MediaTek', exynos: 'Samsung Exynos', kirin: 'HiSilicon Kirin', apple: 'Apple', tensor: 'Google Tensor', unisoc: 'Unisoc' };
const VENDOR_RX = { qualcomm: /qualcomm|snapdragon|\bmsm|\bsdm|\bsm\d/, mediatek: /mediatek|\bmtk\b|\bmt\d/, exynos: /exynos|samsung islemci|\bsam\b/, kirin: /kirin|hisilicon|huawei/, apple: /iphone|apple|\ba\d{1,2}\b/ };

// "redmi note 10 pro 5g" gibi aramayı telefon adlarında arar; boşluksuz yazılanı da bulur (note10)
export function searchPhones(list, q, max = 8) {
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
  return res.sort((a, b) => b[0] - a[0]).slice(0, max).map((x) => x[1]);
}
export const short = (c) => String(c || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^(Qualcomm|Mediatek|MediaTek|Apple|Samsung|HiSilicon|Google|Unisoc)\s+/i, '').replace(/\b(SM|SDM|MSM|MT)\d{3,4}[A-Z0-9-]*\s*/g, '').trim();

// kalıp ürünleri ve içerdikleri işlemci kodları
export function useStencils() {
  const { catalog } = useStore();
  const [descs, setDescs] = useState(null);
  useEffect(() => { let live = true; const A = api(); (A.loadDescMap ? A.loadDescMap() : Promise.resolve({})).then((d) => live && setDescs(d || {})).catch(() => live && setDescs({})); return () => { live = false; }; }, []);
  return useMemo(() => catalog.filter((p) => p.a !== 0 && !p.so && (p.kc || isStencil(p))).map((p) => {
    const keys = (p.kc || stencilKeys(p) || '').split(' ');
    const txt = p.n + ' ' + (descs?.[p.id] || '');
    const k = chipCodes(txt); keys.forEach((x) => x && x !== '-' && !x.startsWith('m:') && k.add(x));
    return { p, k, t: norm(txt), m: keys.filter((x) => x.startsWith('m:')).map((x) => x.slice(2)) };
  }), [catalog, descs]);
}
const isSetName = (n) => /\bset/i.test(n) || /\d+\s*adet\s*kal[ıi]p/i.test(n);
export function matchStencils(stencils, sel) {
  const codes = new Set(sel.k);
  // etiketteki model adı tam tutmalı: "redminote10" / "xiaomiredminote10" (sadece "note10" Samsung Note 10 ile karışır)
  const w = sel.n ? norm(sel.n).split(/\s+/) : []; const zs = new Set([w.join(''), w.slice(1).join('')].filter((x) => x.length >= 6));
  // işlemci kodu tutan ya da etiketinde bu telefon modeli yazan (ör. "Note10pro")
  const exact = stencils.filter((s) => [...s.k].some((c) => codes.has(c)) || s.m.some((t) => zs.has(t))).sort((a, b) => a.k.size - b.k.size);
  // set mi tek kalıp mı ürün adına göre: "Kalıp Seti", "(19 Adet Kalıp)", "10lu Set"; birçok işlemciyi taşıyan tek plaka (U-QSU4 Kalıp) yine tek kalıptır
  const single = exact.filter((s) => !isSetName(s.p.n));
  const sets = exact.filter((s) => !single.includes(s));
  const v = vendorOf(sel.c); const brand = sel.n ? norm(sel.n).split(' ')[0] : '';
  const ids = new Set(exact.map((s) => s.p.id));
  const more = stencils.filter((s) => !ids.has(s.p.id) && isSetName(s.p.n) && s.k.size === 0 && (
    (v && VENDOR_RX[v]?.test(s.t) && !/emmc|birlestirme|airpods|mac|face/.test(s.t)) ||
    (brand && brand !== 'apple' && new RegExp('\\b' + brand + '\\b').test(s.t) && /entegre/.test(s.t))
  ));
  return { single, sets, more, v };
}

export function KalipFinder() {
  const { settings: S } = useStore();
  const [base, setPhones] = useState(null);
  const phones = useMemo(() => base && mergePhones(base, S.kalip?.phones), [base, S.kalip?.phones]);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [sel, setSel] = useState(null); // {n, c, k} ya da {code}
  const [prod, setProd] = useState(null);
  const inp = useRef(null);
  useEffect(() => { document.title = 'Kalıp bulucu'; loadPhones().then(setPhones).catch(() => setErr(true)); }, []);
  const stencils = useStencils();

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

  const result = useMemo(() => (sel ? matchStencils(stencils, sel) : null), [sel, stencils]);

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

// Yönetim > Ayarlar > Kalıp bulucu: model ekle / işlemci ata, uyan kalıpları anında gör
export function KalipSettings({ d, set }) {
  const [base, setBase] = useState(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const stencils = useStencils();
  useEffect(() => { loadPhones().then(setBase).catch(() => setBase([])); }, []);
  const over = d.kalip?.phones || {};
  const all = useMemo(() => base && mergePhones(base, over), [base, over]);
  const chipList = useMemo(() => [...new Set((base || []).map((p) => p.c).flatMap((c) => c.split(' / ')))].sort(), [base]);
  const setChip = (n, c) => set('kalip.phones', { ...over, [n]: c });
  const unset = (n) => { const o = { ...over }; delete o[n]; set('kalip.phones', o); };
  const rows = useMemo(() => {
    if (!all) return [];
    if (!q.trim()) return Object.keys(over).reverse().map((n) => all.find((p) => p.n === n) || { n, c: over[n], k: [...phoneCodes(over[n] || '')], hidden: !over[n] });
    return searchPhones(all, q, 25);
  }, [all, q, over]);
  const exists = all && q.trim() && all.some((p) => p.n.toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="kfs">
      <Toggle id="s-kalip" label="Mağazada Kalıp bulucu görünsün" checked={d.kalip?.on !== false} onChange={(v) => set('kalip.on', v)} />
      <p className="fine">Listede {base ? <b>{base.length.toLocaleString('tr-TR')}</b> : '…'} telefon modeli var. Model arayın ya da yeni model yazın; işlemcisini seçin (ör. <i>Snapdragon 732G</i>, <i>Helio G85</i>, <i>Apple A15</i> ya da kod: <i>SM7150</i>, <i>MT6769</i>). Uyan kalıplar hemen altta görünür. Kaydet’e basınca mağazada geçerli olur.</p>
      <div className="kfs-q"><Icon n="search" s={17} /><input id="s-kalip-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Model ara ya da yeni model yaz…" />{q && <button type="button" className="kf-x" onClick={() => setQ('')} aria-label="Temizle"><Icon n="x" s={13} /></button>}</div>
      {q.trim().length >= 2 && all && !exists && (
        <button type="button" className="btn sm outline kfs-add" onClick={() => { setChip(q.trim(), over[q.trim()] || '?'); setOpen(q.trim()); setQ(''); }}><Icon n="plus" s={15} />“{q.trim()}” modelini ekle</button>
      )}
      {!q.trim() && <h4 className="kfs-h">Eklediğim / düzelttiğim modeller {Object.keys(over).length ? `(${Object.keys(over).length})` : ''}</h4>}
      {!q.trim() && !Object.keys(over).length && <p className="fine">Henüz yok. Yukarıdan bir model arayın.</p>}
      <datalist id="kf-chips">{chipList.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="kfs-list">
        {rows.map((p) => {
          const c = over[p.n] ?? p.c; const chip = c === '?' ? '' : c;
          const codes = [...phoneCodes(chip)];
          const m = chip ? matchStencils(stencils, { n: p.n, c: chip, k: codes }) : null;
          const n = m ? m.single.length + m.sets.length : 0;
          const isOpen = open === p.n;
          return (
            <div key={p.n} className={'kfs-row' + (p.n in over ? ' own' : '') + (isOpen ? ' open' : '')}>
              <div className="kfs-top">
                <button type="button" className="kfs-n" onClick={() => setOpen(isOpen ? null : p.n)}><b>{p.n}</b>{p.n in over && <small>{base?.some((x) => x.n === p.n) ? 'düzeltildi' : 'elle eklendi'}</small>}</button>
                <input list="kf-chips" value={chip} placeholder="İşlemci seçin / yazın" onChange={(e) => setChip(p.n, e.target.value || '?')} aria-label={p.n + ' işlemcisi'} />
                <button type="button" className={'kfs-cnt' + (n ? ' ok' : '')} onClick={() => setOpen(isOpen ? null : p.n)} title="Uyan kalıplar">{chip ? n + ' kalıp' : '—'}</button>
                {p.n in over ? <button type="button" className="icon-btn" title="Değişikliği geri al" aria-label="Geri al" onClick={() => unset(p.n)}><Icon n="undo" s={15} /></button> : <span />}
              </div>
              {chip && <div className="kf-codes">{codes.length ? codes.map((x) => <span key={x} className="kf-code">{x}</span>) : <span className="kfs-warn">Bu işlemcinin kodu tanınmadı — kodu yazın (ör. SM7150)</span>}</div>}
              {isOpen && m && (
                <ul className="kfs-st">
                  {[...m.single, ...m.sets].map((s) => <li key={s.p.id}><Icon n="check" s={13} />{s.p.n}</li>)}
                  {m.more.map((s) => <li key={s.p.id} className="more"><Icon n="box" s={13} />{s.p.n} <small>(genel set)</small></li>)}
                  {!n && !m.more.length && <li className="none">Uyan kalıp yok</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
