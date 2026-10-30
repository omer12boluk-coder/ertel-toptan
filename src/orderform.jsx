// Yönetim paneli > Sipariş formu: yönetici müşteri için sepet hazırlar, fiyatları kendisi yazar,
// listenin resmini (ekran görüntüsü gibi) panoya kopyalayıp WhatsApp'a yapıştırır. Liste uzunsa birkaç resme bölünür;
// her resmin kendi "Kopyala" düğmesi vardır. Fiyatlı link de gönderilebilir.
// Açık form (taslak) bu cihazda 12 saat tutulur (yanlışlıkla çıkınca kaybolmaz; günler sonra temiz başlar).
// "Kaydet" ile form oforms/{id}'e yazılır (yönetici, tüm cihazlarda), alttaki "Kaydedilen formlar"dan açılır / silinir.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, toast, api, store, go } from './store.js';
import { Icon, Thumb, Stepper, VatLines, Empty, copyText, Sheet, Confirm } from './ui.jsx';
import { links, waLink } from './route.js';
import { fmt, totals, fmtTotals, norm, roundStep, ls, priceFor } from './utils.js';
import { renderListImages, useRate, toTL, fmtTL, rateLabel } from './listsheet.jsx';
import { encodeList, listLink } from './listcode.js';
import { printHtml } from './orders.jsx';
import { LinkMake, LinkCarts } from './lcart.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newNo = () => Array.from({ length: 4 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');
const KEY = 'order-draft';
const TTL = 12 * 3600e3; // açık form 12 saat sonra kendiliğinden temizlenir
// imza: formun kaydedilmiş/açılmış hâliyle karşılaştırmak için (değişiklik yoksa Kaydet düğmesi görünmez)
const sig = (x) => JSON.stringify([(x.name || '').trim(), (x.items || []).map((it) => [it.id, Number(it.qty) || 0, it.price == null || it.price === '' ? null : Number(it.price)])]);
const blank = () => { const b = { no: newNo(), name: '', items: [] }; b.base = sig(b); return b; };
const loadDraft = (key = KEY) => { const x = ls.get(key, null); if (!(x && x.items && x.at && Date.now() - x.at < TTL)) return blank(); if (x.base == null) x.base = x.sid ? sig(x) : sig({}); return x; };
// arama sıralaması için kullanım: bu cihazda forma ekleme sayısı + siparişlerde geçme sayısı
const USE = 'of-use';
const bump = (id) => { const u = ls.get(USE, {}); u[id] = (u[id] || 0) + 1; ls.set(USE, u); };
const wordRe = (t) => new RegExp('(^|[^0-9a-z])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^0-9a-z])');
const when = (t) => { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'az önce'; if (m < 60) return m + ' dk önce'; const h = Math.round(m / 60); if (h < 24) return h + ' sa önce'; const d = Math.round(h / 24); return d < 7 ? d + ' gün önce' : new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); };


// linkMode: /admin/sepet-link — aynı ürün seçme / fiyat yazma ekranı; sonunda liste resmi yerine müşteriye SEPET LİNKİ
// oluşturulur (lcart.jsx), altta kayıtlı formlar yerine linkle gelen sepetler listelenir. Taslağı ayrı tutulur.
export function OrderForm({ linkMode = false }) {
  const DKEY = linkMode ? 'lcart-draft' : KEY;
  const { catalog, byId, settings: S, orders = [], requests = [] } = useStore();
  const rate = useRate();
  const lcNew = useStore((st) => (st.lcarts || []).filter((c) => c.status === 'sent' && !c.seen).length);
  const [d, setD] = useState(() => (linkMode ? blank() : loadDraft(DKEY))); // sepet linki: her açılışta boş // items: [{ id, qty, price }], sid: kaydedilmiş formdan açıldıysa kimliği
  const [forms, setForms] = useState(null);
  const [ask, setAsk] = useState(null); // açık form doluyken kayıtlı form açma sorusu
  const [del, setDel] = useState(null);
  const [wipe, setWipe] = useState(false); // "Formu temizle" onayı
  const [askNew, setAskNew] = useState(false); // kaydedilmemiş değişiklik varken "Yeni form"
  useEffect(() => { if (linkMode) return; const A = api(); return A?.watchForms ? A.watchForms(setForms) : setForms([]); }, []);
  const [q, setQ] = useState('');
  const [imgs, setImgs] = useState(null); // [{ file, url }]
  const [busy, setBusy] = useState(false);
  const [outOpen, setOutOpen] = useState(false); // "Müşteriye gönder" bölümü: kapalı başlar, başlığa basınca açılır
  const [paper, setPaper] = useState(() => ls.get('of-paper', 'a4')); // yazdırma kâğıdı: a4 | a6
  const step = Number(S.pricing.adjustStep) || 1;
  useEffect(() => { if (!linkMode) ls.set(DKEY, { ...d, at: Date.now() }); }, [d]);

  // siparişlerde geçme sayısı (mağaza + bayi siparişleri, panelde yüklü olanlar)
  const sold = useMemo(() => { const m = new Map(); for (const o of [...orders, ...requests.filter((r) => r.type === 'order')]) for (const it of o.items || []) m.set(it.id, (m.get(it.id) || 0) + 1); return m; }, [orders, requests]);
  // Sıralama: 1) adında yazılanla birebir eşleşenler (tam ifade > kelime kelime > parça), 2) sadece etiketten gelenler;
  // her grubun içinde sık eklenen / sık satılanlar önde
  const results = useMemo(() => {
    const nq = norm(q).trim(); const toks = nq.split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    const use = ls.get(USE, {});
    const out = [];
    for (const p of catalog) {
      if (!p.a || !toks.every((t) => p._s.includes(t) || p._t.includes(t))) continue;
      const nm = norm(p.n || ''); const code = norm(p.k || '');
      let sc = 0;
      if (code === nq) sc += 100;
      if (nm.includes(nq)) sc += 40; if (nm.startsWith(nq)) sc += 8;
      for (const t of toks) { if (wordRe(t).test(nm)) sc += 6; else if (nm.includes(t)) sc += 3; else if (code.includes(t)) sc += 2; }
      const inName = toks.every((t) => nm.includes(t) || code.includes(t));
      out.push({ p, g: inName ? 0 : 1, sc, u: (use[p.id] || 0) * 2 + (sold.get(p.id) || 0) });
    }
    out.sort((a, b) => a.g - b.g || b.sc - a.sc || b.u - a.u || a.p.n.length - b.p.n.length);
    return out.slice(0, 40).map((x) => x.p);
  }, [q, catalog, sold]);

  const rows = d.items.map((it) => ({ ...it, p: byId.get(it.id) })).filter((x) => x.p);
  const items = rows.map(({ p, qty, price }) => {
    const o = { id: p.id, k: p.k, n: p.n, cur: p.cur || 'USD', qty, list: p.r, asked: p.r, offer: price };
    if (p.pi) o.pi = p.pi; if (p.img) o.img = p.img; if (p.u) o.u = p.u;
    return o;
  });
  const tot = totals(items, 'offer');
  const tTL = rate ? toTL(tot, rate) : null;
  const rec = useMemo(() => ({ no: d.no, gname: d.name.trim(), items, status: 'offered', createdAt: Date.now(), updatedAt: Date.now(), tl: true }), [JSON.stringify(items), d.no, d.name]);
  const link = listLink(encodeList({ no: d.no, at: Date.now(), priced: true, rate: rate?.usd, items }));

  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const upd = (id, patch) => setD((x) => ({ ...x, items: x.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  function add(p) {
    setD((x) => x.items.some((it) => it.id === p.id)
      ? { ...x, items: x.items.map((it) => (it.id === p.id ? { ...it, qty: it.qty + 1 } : it)) }
      : { ...x, items: [...x.items, { id: p.id, qty: 1, price: p.r > 0 ? p.r : null }] });
    bump(p.id);
    toast('Eklendi: ' + (p.n.length > 40 ? p.n.slice(0, 38) + '…' : p.n));
  }
  const dirty = sig(d) !== d.base; // açıldığı / kaydedildiği hâlden farklı mı
  // Formu temizle: içindeki ürünler ve müşteri adı silinir; kayıtlı formdan açıldıysa kayıt (kaydetmedikçe) eski hâliyle kalır
  function wipeForm() { setD((x) => ({ ...x, name: '', items: [] })); setImgs(null); setQ(''); toast('Form temizlendi'); }
  // Yeni form: kaydedilmeyen değişiklikler bırakılır; kayıtlı form listede eski hâliyle durur
  function newForm() { setD(blank()); setImgs(null); setQ(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  const tryNew = () => (dirty && (d.items.length || d.sid) ? setAskNew(true) : newForm());
  // ---- kaydedilen formlar
  const saveForm = async (then) => {
    if (!d.items.length) return toast('Form boş', 'warn');
    const A = api(); const id = d.sid || A.newFormId();
    const data = { no: d.no, name: d.name.trim(), items: d.items.map(({ id: pid, qty, price }) => ({ id: pid, qty, price: price == null ? null : Number(price) })), at: Date.now(), total: tot };
    const base = sig(d);
    try { await A.saveForm(id, data); setD((x) => ({ ...x, sid: id, base })); toast(d.sid ? 'Değişiklikler kaydedildi' : 'Form kaydedildi'); then?.(); } catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
  };
  const load = (f) => { const x = { no: f.no || newNo(), name: f.name || '', items: (f.items || []).filter((it) => byId.get(it.id)), sid: f.id }; x.base = sig(x); setD(x); setImgs(null); setQ(''); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('Form açıldı'); };
  const openForm = (f) => { if (d.sid === f.id && !dirty) return; if (dirty && d.items.length) setAsk(f); else load(f); };

  // Liste değişince resimleri yeniden hazırla
  const gen = useRef(0);
  useEffect(() => {
    setImgs(null);
    if (!items.length || !outOpen) return;
    const my = ++gen.current;
    const t = setTimeout(async () => {
      try {
        const blobs = await renderListImages(rec, { rate, tl: true });
        if (my !== gen.current) return;
        setImgs(blobs.map((b, i) => ({ file: new File([b], `siparis-${d.no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }), url: URL.createObjectURL(b) })));
      } catch (e) { console.warn(e); }
    }, 500);
    return () => clearTimeout(t);
  }, [rec, rate?.usd, outOpen]);
  useEffect(() => () => imgs?.forEach((m) => URL.revokeObjectURL(m.url)), [imgs]);

  // Telefonda: bütün tablo resimlerini (link olmadan) paylaş menüsüyle WhatsApp'a gönder
  const canShareImgs = typeof navigator !== 'undefined' && !!navigator.canShare && matchMedia('(hover: none) and (pointer: coarse)').matches;
  async function shareImgs() {
    if (!imgs?.length) return;
    const files = imgs.map((m) => m.file);
    if (!navigator.canShare({ files })) return toast('Bu telefon resim paylaşmayı desteklemiyor; resimleri tek tek kopyalayın', 'bad');
    try { await navigator.share({ files }); } catch (e) { if (e.name !== 'AbortError') toast('Paylaşılamadı: ' + e.message, 'bad'); }
  }
  // Yazdır: bütün resimler (liste birkaç resme bölündüyse hepsi) sırayla, her biri ayrı sayfada, seçilen kâğıda (A4 / A6) sığdırılarak.
  // Telefonda tarayıcı yazdırması (özellikle ana ekran uygulamasında) çalışmadığı için paylaş menüsü açılır (oradan Yazdır).
  async function printAll() {
    if (!imgs?.length) return;
    if (canShareImgs) { const files = imgs.map((m) => m.file); try { if (navigator.canShare({ files })) await navigator.share({ files }); } catch (e) { if (e.name !== 'AbortError') toast('Yazdırılamadı: ' + e.message, 'bad'); } return; }
    const sz = paper === 'a6' ? { page: 'A6', m: '5mm', h: '138mm' } : { page: 'A4', m: '10mm', h: '277mm' };
    const pages = imgs.map((m) => `<div class="pg"><img src="${m.url}" alt=""></div>`).join('');
    printHtml(`<!doctype html><html><head><style>@page{size:${sz.page};margin:${sz.m}} body{margin:0} .pg{height:${sz.h};display:flex;align-items:flex-start;justify-content:center;break-after:page;page-break-after:always} .pg:last-child{break-after:auto;page-break-after:auto} img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>${pages}</body></html>`);
  }
  const setPaperK = (k) => { setPaper(k); ls.set('of-paper', k); };
  async function copyImg(i) {
    setBusy(true);
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': imgs[i].file })]); toast(imgs.length > 1 ? `${i + 1}. resim kopyalandı — WhatsApp’ta Ctrl+V` : 'Resim kopyalandı — WhatsApp’ta Ctrl+V'); }
    catch { toast('Bu tarayıcı resmi kopyalayamadı', 'bad'); }
    setBusy(false);
  }

  return (
    <div className="page oform">
      <div className="page-h">
        <div className="of-mode">
          <div className="seg of-seg" role="tablist" aria-label="Sayfa">
            <button type="button" role="tab" aria-selected={!linkMode} className={!linkMode ? 'on' : ''} onClick={() => linkMode && go('siparis')}><Icon n="tag" s={15} />Sipariş formu</button>
            <button type="button" role="tab" aria-selected={linkMode} className={linkMode ? 'on' : ''} onClick={() => !linkMode && go('sepetlink')}><Icon n="cart" s={15} />Sepet linki{lcNew > 0 && <span className="badge">{lcNew}</span>}</button>
          </div>
          <h1 className="page-t">{linkMode ? 'Sepet linki' : 'Sipariş formu'} <span className="muted">#{d.no}</span></h1>
        </div>
        <span className="row-btns">
          {!linkMode && rows.length > 0 && <button className="btn sm wa" onClick={() => { setOutOpen(true); setTimeout(() => document.getElementById('of-out')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}><Icon n="wa" s={15} />Müşteriye gönder</button>}
          {!linkMode && dirty && rows.length > 0 && <button className="btn sm primary" onClick={() => saveForm()}><Icon n="check" s={15} />{d.sid ? 'Değişiklikleri kaydet' : 'Kaydet'}</button>}
          {(d.items.length > 0 || d.name) && <button className="btn sm ghost danger" onClick={() => setWipe(true)}><Icon n="trash" s={15} />Formu temizle</button>}
        </span>
      </div>

      <div className="oform-grid">
        <section className="oform-pick">
          <div className="search"><Icon n="search" s={18} /><input id="of-search" type="search" placeholder="Ürün adı veya stok kodu ile ara…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={!matchMedia('(hover: none) and (pointer: coarse)').matches} /></div>
          {q && results.length === 0 && <p className="fine">Eşleşen ürün yok.</p>}
          {!q && <p className="fine oform-hint">Ürün adı ya da stok kodu yazın; sonuçlar burada, kendi kutusunda listelenir.</p>}
          {q && results.length > 0 && <span className="oform-count">{results.length} sonuç</span>}
          <ul className="oform-res">
            {results.map((p) => {
              const inCart = d.items.find((it) => it.id === p.id);
              return (
                <li key={p.id}>
                  <Thumb p={p} size="sm" />
                  <span className="cline-info"><span className="prow-name">{p.n}</span><span className="prow-meta"><code>{p.k}</code><span>Liste {fmt(p.r, p.cur)}</span>{(() => { const t = priceFor(p, S, null).mine; return t != null && <span>Toptan {fmt(t, p.cur)}</span>; })()}</span></span>
                  <button className={'btn sm ' + (inCart ? 'outline' : 'add')} onClick={() => add(p)}><Icon n="plus" s={15} />{inCart ? `Ekli (${inCart.qty})` : 'Ekle'}</button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="oform-right">
        <section className="oform-cart">
          {(d.sid || d.items.length > 0 || d.name) && <div className="of-title">
            <button type="button" className="btn sm of-new" onClick={tryNew}><Icon n="plus" s={15} />Yeni form</button>
            {d.sid && <span className={'of-state' + (dirty ? ' dirty' : '')}>{dirty ? 'Kaydedilmemiş değişiklik' : 'Kayıtlı form'}</span>}
          </div>}
          <label className="field"><span className="field-l">Müşteri <small className="opt">({linkMode ? 'sadece sizin listenizde görünür' : 'resimde görünür'}, isteğe bağlı)</small></span><input id="of-name" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="ör. Kadıköy GSM – Ahmet" /></label>
          {rows.length === 0 ? <Empty icon="cart" title="Form boş">Soldan ürün arayıp ekleyin.</Empty> : (
            <>
              <table className="itable vle oform-t">
                <thead><tr><th>Ürün</th><th className="r">Adet</th><th className="r">Liste</th><th className="r">Fiyat</th><th className="r">Tutar</th><th /></tr></thead>
                <tbody>
                  {rows.map(({ id, qty, price, p }, i) => (
                    <tr key={id}>
                      <td className="it-name"><div className="of-prod"><span className="of-no num">{i + 1}</span><Thumb p={p} size="sm" /><span><a href={links.product(p, S)} target="_blank" rel="noopener"><span>{p.n}</span></a><code>{p.k}</code></span></div></td>
                      <td className="r it-qty" data-l="Adet"><Stepper small min={1} value={qty} onChange={(v) => upd(id, { qty: v })} /></td>
                      <td className="r num muted it-list">{fmt(p.r, p.cur)}</td>
                      <td className="r it-offer" data-l="Fiyat">
                        <div className="adj">
                          <button onClick={() => upd(id, { price: roundStep((Number(price) || 0) - step, 0.01) })} aria-label="Düşür">−</button>
                          <input inputMode="decimal" value={price ?? ''} aria-label="Fiyat" onChange={(e) => { const v = e.target.value.replace(',', '.'); upd(id, { price: v === '' ? null : isNaN(Number(v)) ? price : v.endsWith('.') ? v : Number(v) }); }} onBlur={() => upd(id, { price: price == null ? null : Number(price) })} />
                          <button onClick={() => upd(id, { price: roundStep((Number(price) || 0) + step, 0.01) })} aria-label="Arttır">+</button>
                        </div>
                      </td>
                      <td className="r num it-sum" data-l="Tutar"><b>{price == null ? '—' : fmt(Number(price) * qty, p.cur)}</b></td>
                      <td className="it-del"><button className="icon-btn sm" onClick={() => setD((x) => ({ ...x, items: x.items.filter((it) => it.id !== id) }))} aria-label="Çıkar"><Icon n="trash" s={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="vle-tot"><span>Toplam</span><b className="num">{fmtTotals(tot)}</b>{tTL != null && <span className="muted num">≈ {fmtTL(tTL)}</span>}</div>
              <VatLines by={tot} rate={rate} className="right" />
            </>
          )}
        </section>
        {linkMode && rows.length > 0 && <LinkMake no={d.no} name={d.name} items={items} total={tot} rate={rate} onDone={() => setD(blank())} />}
        {!linkMode && rows.length > 0 && (
          <section className={'oform-out' + (outOpen ? ' open' : '')} id="of-out">
            <button type="button" className="oform-out-tg" onClick={() => setOutOpen((v) => !v)} aria-expanded={outOpen}>
              <span className="oot-ic"><Icon n="wa" s={18} /></span>
              <span className="oot-t"><b>Müşteriye gönder</b><small>{outOpen ? 'Liste resmi, link ve yazdırma' : 'Liste resmi, link ve yazdırma · açmak için tıklayın'}</small></span>
              <Icon n="down" s={18} className="oot-chev" />
            </button>
            {outOpen && <>
            <div className="oform-out-h">
              <div className="row-btns oform-acts">
                {canShareImgs && <button className="btn sm wa" disabled={!imgs || busy} onClick={shareImgs}><Icon n="wa" s={15} />{imgs && imgs.length > 1 ? `Tabloyu gönder (${imgs.length})` : 'Tabloyu gönder'}</button>}
                <a className="of-ib wa" href={waLink('', 'Siparişiniz:\n' + link)} target="_blank" rel="noopener" aria-label="Linki WhatsApp’ta gönder" title="Linki WhatsApp’ta gönder"><Icon n="wa" s={17} /></a>
                <button className="of-ib" onClick={() => copyText(link, 'Link kopyalandı')} aria-label="Linki kopyala" title="Linki kopyala"><Icon n="copy" s={16} /></button>
                <span className="of-print">
                  <button className="btn sm outline" disabled={!imgs} onClick={printAll}><Icon n="print" s={15} />Yazdır{imgs && imgs.length > 1 ? ` (${imgs.length} sayfa)` : ''}</button>
                  {!canShareImgs && <span className="seg-mini" role="group" aria-label="Kâğıt">{['a4', 'a6'].map((k) => <button key={k} type="button" className={paper === k ? 'on' : ''} onClick={() => setPaperK(k)}>{k.toUpperCase()}</button>)}</span>}
                </span>
                {dirty && <button className="btn sm outline" onClick={() => saveForm()}><Icon n="check" s={15} />{d.sid ? 'Değişiklikleri kaydet' : 'Formu kaydet'}</button>}
              </div>
            </div>
            {!imgs ? <div className="list-wait"><div className="spinner" /></div> : (
              <>
                {imgs.length > 1 && (
                  <div className="banner warn oform-multi"><Icon n="copy" /><div><b>Liste {imgs.length} resim oldu.</b> WhatsApp’a hepsini sırayla gönderin: her resmin üstündeki <b>Kopyala</b> ile kopyalayıp yapıştırın.</div></div>
                )}
                <div className={'oform-imgs' + (imgs.length > 1 ? ' many' : '')}>
                  {imgs.map((m, i) => (
                    <figure key={m.url}>
                      <figcaption>
                        <b>{imgs.length > 1 ? `Resim ${i + 1} / ${imgs.length}` : 'Liste resmi'}</b>
                        <button className="btn sm primary" disabled={busy} onClick={() => copyImg(i)}><Icon n="copy" s={15} />{imgs.length > 1 ? `${i + 1}. resmi kopyala` : 'Resmi kopyala'}</button>
                      </figcaption>
                      <img src={m.url} alt={`Sipariş resmi ${i + 1}`} />
                    </figure>
                  ))}
                </div>
              </>
            )}
            </>}
          </section>
        )}
        </div>
      </div>

      {linkMode ? <LinkCarts /> : <section className="oform-saved">
        <h2>Kaydedilen formlar {forms?.length > 0 && <span className="muted num">{forms.length}</span>}</h2>
        {forms == null ? <div className="spinner sm" /> : forms.length === 0 ? <p className="fine">Henüz kaydedilen form yok. Formu hazırlayıp <b>Kaydet</b>’e basın; burada saklanır, istediğiniz zaman açarsınız.</p> : (
          <ul className="ofs-list">
            {forms.map((f) => { const n = (f.items || []).reduce((t, it) => t + (Number(it.qty) || 0), 0); const ths = (f.items || []).slice(0, 3).map((it) => byId.get(it.id)).filter(Boolean); return (
              <li key={f.id} className={d.sid === f.id ? 'on' : ''}>
                <button type="button" className="ofs-main" onClick={() => openForm(f)}>
                  <span className="ofs-th">{ths.map((p) => <Thumb key={p.id} p={p} size="sm" />)}</span>
                  <span className="ofs-t"><b>{f.name || 'İsimsiz form'} <span className="muted num">#{f.no}</span></b><small className="muted">{(f.items || []).length} ürün · {n} adet{f.total ? ' · ' + fmtTotals(f.total) : ''} · {when(f.at)}</small></span>
                </button>
                {d.sid === f.id ? <span className="ofs-open">Açık</span> : <button type="button" className="btn sm outline" onClick={() => openForm(f)}>Aç</button>}
                <button type="button" className="icon-btn sm" onClick={() => setDel(f)} aria-label="Sil"><Icon n="trash" s={15} /></button>
              </li>
            ); })}
          </ul>
        )}
      </section>}

      {ask && (
        <Sheet title="Kayıtlı formu aç" onClose={() => setAsk(null)} footer={<>
          <button className="btn ghost" onClick={() => setAsk(null)}>Vazgeç</button>
          <button className="btn outline" onClick={() => { const f = ask; setAsk(null); saveForm(() => load(f)); }}>Önce kaydet, sonra aç</button>
          <button className="btn primary" onClick={() => { const f = ask; setAsk(null); load(f); }}>Kaydetmeden aç</button>
        </>}>
          <p>Açık formda <b>kaydedilmemiş değişiklikler</b> var. “{ask.name || 'İsimsiz form'} #{ask.no}” formunu açarsanız bu değişiklikler bırakılır.</p>
          <p className="fine">{d.sid ? 'Kayıtlı form, Kaydedilen formlar’da son kaydettiğiniz hâliyle durmaya devam eder.' : 'Bu form hiç kaydedilmedi; kaydetmezseniz kaybolur.'}</p>
        </Sheet>
      )}
      {askNew && (
        <Sheet title="Yeni form" onClose={() => setAskNew(false)} footer={<>
          <button className="btn ghost" onClick={() => setAskNew(false)}>Vazgeç</button>
          <button className="btn outline" onClick={() => { setAskNew(false); saveForm(newForm); }}>Kaydet, sonra yeni form</button>
          <button className="btn primary" onClick={() => { setAskNew(false); newForm(); }}>Kaydetmeden yeni form</button>
        </>}>
          <p>Açık formda <b>kaydedilmemiş değişiklikler</b> var.</p>
          <p className="fine">{d.sid ? 'Kaydetmeden geçerseniz bu değişiklikler bırakılır; form Kaydedilen formlar’da açmadan önceki hâliyle durur.' : 'Bu form hiç kaydedilmedi; kaydetmeden geçerseniz kaybolur.'}</p>
        </Sheet>
      )}
      {wipe && <Confirm title="Formu temizle" text={d.sid ? 'Formdaki tüm ürünler ve müşteri adı silinecek. Kaydetmezseniz kayıtlı form eski hâliyle kalır.' : 'Formdaki tüm ürünler ve müşteri adı silinecek.'} okLabel="Temizle" tone="danger" onClose={() => setWipe(false)} onOk={wipeForm} />}
      {del && <Confirm title="Formu sil" text={`“${del.name || 'İsimsiz form'} #${del.no}” kalıcı olarak silinecek.`} okLabel="Sil" tone="danger" onClose={() => setDel(null)} onOk={async () => { try { await api().deleteForm(del.id); if (d.sid === del.id) setD((x) => ({ ...x, sid: undefined, base: sig({}) })); toast('Form silindi'); } catch (e) { toast(e.message, 'bad'); } }} />}
    </div>
  );
}
