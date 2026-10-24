// Yönetim paneli > Sipariş formu: yönetici müşteri için sepet hazırlar, fiyatları kendisi yazar,
// listenin resmini (ekran görüntüsü gibi) panoya kopyalayıp WhatsApp'a yapıştırır. Liste uzunsa birkaç resme bölünür;
// her resmin kendi "Kopyala" düğmesi vardır. Fiyatlı link de gönderilebilir. Hiçbir şey veritabanına kaydedilmez
// (taslak sadece bu cihazda tutulur).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, toast } from './store.js';
import { Icon, Thumb, Stepper, VatLines, Empty, copyText } from './ui.jsx';
import { links, waLink } from './route.js';
import { fmt, totals, fmtTotals, norm, roundStep, ls } from './utils.js';
import { renderListImages, useRate, toTL, fmtTL, rateLabel } from './listsheet.jsx';
import { encodeList, listLink } from './listcode.js';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newNo = () => Array.from({ length: 4 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');
const KEY = 'order-draft';


export function OrderForm() {
  const { catalog, byId, settings: S } = useStore();
  const rate = useRate();
  const [d, setD] = useState(() => ls.get(KEY, null) || { no: newNo(), name: '', items: [] }); // items: [{ id, qty, price }]
  const [q, setQ] = useState('');
  const [imgs, setImgs] = useState(null); // [{ file, url }]
  const [busy, setBusy] = useState(false);
  const step = Number(S.pricing.adjustStep) || 1;
  useEffect(() => { ls.set(KEY, d); }, [d]);

  const results = useMemo(() => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    return catalog.filter((p) => p.a && toks.every((t) => p._s.includes(t) || p._t.includes(t))).slice(0, 40);
  }, [q, catalog]);

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
      : { ...x, items: [...x.items, { id: p.id, qty: 1, price: p.w ?? (p.r > 0 ? p.r : null) }] });
    toast('Eklendi: ' + (p.n.length > 40 ? p.n.slice(0, 38) + '…' : p.n));
  }
  function clear() { setD({ no: newNo(), name: '', items: [] }); setImgs(null); setQ(''); }

  // Liste değişince resimleri yeniden hazırla
  const gen = useRef(0);
  useEffect(() => {
    setImgs(null);
    if (!items.length) return;
    const my = ++gen.current;
    const t = setTimeout(async () => {
      try {
        const blobs = await renderListImages(rec, { rate, tl: true });
        if (my !== gen.current) return;
        setImgs(blobs.map((b, i) => ({ file: new File([b], `siparis-${d.no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }), url: URL.createObjectURL(b) })));
      } catch (e) { console.warn(e); }
    }, 500);
    return () => clearTimeout(t);
  }, [rec, rate?.usd]);
  useEffect(() => () => imgs?.forEach((m) => URL.revokeObjectURL(m.url)), [imgs]);

  // Telefonda: bütün tablo resimlerini (link olmadan) paylaş menüsüyle WhatsApp'a gönder
  const canShareImgs = typeof navigator !== 'undefined' && !!navigator.canShare && matchMedia('(hover: none) and (pointer: coarse)').matches;
  async function shareImgs() {
    if (!imgs?.length) return;
    const files = imgs.map((m) => m.file);
    if (!navigator.canShare({ files })) return toast('Bu telefon resim paylaşmayı desteklemiyor; resimleri tek tek kopyalayın', 'bad');
    try { await navigator.share({ files }); } catch (e) { if (e.name !== 'AbortError') toast('Paylaşılamadı: ' + e.message, 'bad'); }
  }
  async function copyImg(i) {
    setBusy(true);
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': imgs[i].file })]); toast(imgs.length > 1 ? `${i + 1}. resim kopyalandı — WhatsApp’ta Ctrl+V` : 'Resim kopyalandı — WhatsApp’ta Ctrl+V'); }
    catch { toast('Bu tarayıcı resmi kopyalayamadı', 'bad'); }
    setBusy(false);
  }

  return (
    <div className="page oform">
      <div className="page-h">
        <h1 className="page-t">Sipariş formu <span className="muted">#{d.no}</span></h1>
        {d.items.length > 0 && <button className="btn sm ghost danger" onClick={clear}><Icon n="trash" s={15} />Yeni form</button>}
      </div>

      <div className="oform-grid">
        <section className="oform-pick">
          <div className="search"><Icon n="search" s={18} /><input id="of-search" type="search" placeholder="Ürün adı veya stok kodu ile ara…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
          {q && results.length === 0 && <p className="fine">Eşleşen ürün yok.</p>}
          <ul className="oform-res">
            {results.map((p) => {
              const inCart = d.items.find((it) => it.id === p.id);
              return (
                <li key={p.id}>
                  <Thumb p={p} size="sm" />
                  <span className="cline-info"><span className="prow-name">{p.n}</span><span className="prow-meta"><code>{p.k}</code><span>Liste {fmt(p.r, p.cur)}</span>{p.w != null && <span>Toptan {fmt(p.w, p.cur)}</span>}</span></span>
                  <button className={'btn sm ' + (inCart ? 'outline' : 'add')} onClick={() => add(p)}><Icon n="plus" s={15} />{inCart ? `Ekli (${inCart.qty})` : 'Ekle'}</button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="oform-cart">
          <label className="field"><span className="field-l">Müşteri <small className="opt">(resimde görünür, isteğe bağlı)</small></span><input id="of-name" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="ör. Kadıköy GSM – Ahmet" /></label>
          {rows.length === 0 ? <Empty icon="cart" title="Form boş">Soldan ürün arayıp ekleyin.</Empty> : (
            <>
              <table className="itable vle oform-t">
                <thead><tr><th>Ürün</th><th className="r">Adet</th><th className="r">Liste</th><th className="r">Fiyat</th><th className="r">Tutar</th><th /></tr></thead>
                <tbody>
                  {rows.map(({ id, qty, price, p }) => (
                    <tr key={id}>
                      <td className="it-name"><div className="of-prod"><Thumb p={p} size="sm" /><span><a href={links.product(p, S)} target="_blank" rel="noopener"><span>{p.n}</span></a><code>{p.k}</code></span></div></td>
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
      </div>

      {rows.length > 0 && (
        <section className="oform-out">
          <div className="oform-out-h">
            <h2>Müşteriye gönder</h2>
            <div className="row-btns">
              {canShareImgs && <button className="btn wa" disabled={!imgs || busy} onClick={shareImgs}><Icon n="wa" s={16} />{imgs && imgs.length > 1 ? `Tabloyu gönder (${imgs.length} resim)` : 'Tabloyu WhatsApp’ta gönder'}</button>}
              <a className={'btn ' + (canShareImgs ? 'outline' : 'wa')} href={waLink('', 'Siparişiniz:\n' + link)} target="_blank" rel="noopener"><Icon n="wa" s={16} />Linki WhatsApp’ta gönder</a>
              <button className="btn outline" onClick={() => copyText(link, 'Link kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>
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
        </section>
      )}
    </div>
  );
}
