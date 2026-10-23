// Vitrin listesi: müşterinin WhatsApp'tan link olarak gönderdiği ürün listesi.
// Aynı liste hem sayfada (okunaklı tablo) hem resim (PNG, gerekirse birkaç sayfa) olarak gösterilir.
// Yönetici fiyatları düzenleyip aynı tabloyu resim olarak müşteriye geri gönderir.
import { useEffect, useMemo, useState } from 'react';
import { useStore, api, store, toast, go } from './store.js';
import { Icon, Empty, Thumb, copyText } from './ui.jsx';
import { links, waLink } from './route.js';
import { fmt, totals, fmtTotals, when, ls } from './utils.js';
import { LOGO_MARK } from './config.js';

// ---- Kur (1 USD kaç TL) ------------------------------------------------------
// Öncelik: yöneticinin elle girdiği kur > Harem Altın dolar satış (bekçi dakikada bir günceller)
export function currentRate(s = store.s) {
  const manual = Number(s.settings?.pricing?.manualRate);
  if (manual > 0) return { usd: manual, src: 'manual', at: null };
  const r = s.rate;
  return r && r.usd > 0 ? r : null;
}
export const useRate = () => useStore((s) => currentRate(s));
export const rateLabel = (r) => !r ? '' : (r.src === 'manual' ? 'Kur' : 'Harem dolar satış') + ' ' + r.usd.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ₺';
export const fmtTL = (v) => (v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString('tr-TR') + ' ₺');
// Bir tutarın TL karşılığı (USD ve TL kalemler; başka para birimi varsa hesaplanmaz)
export function toTL(by, rate) {
  if (!rate) return null;
  let t = 0;
  for (const [c, v] of Object.entries(by)) { if (c === 'USD') t += v * rate.usd; else if (c === 'TRY') t += v; else return null; }
  return t;
}
export function TLHint({ v, cur = 'USD' }) {
  const rate = useRate();
  if (!rate || v == null || isNaN(v) || cur !== 'USD') return null;
  return <span className="tl-hint num">≈ {fmtTL(v * rate.usd)}</span>;
}

const priced = (r) => r.status !== 'new';
const listRate = (r, live) => (r.rate && r.rate.usd > 0 ? r.rate : live);

// ---- Sayfadaki tablo --------------------------------------------------------
export function ListPaper({ r, items: itemsIn, rate: rateIn, tl: tlIn }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const live = useRate();
  const items = itemsIn || r.items || [];
  const rate = rateIn !== undefined ? rateIn : listRate(r, live);
  const tl = (tlIn ?? r.tl ?? true) && !!rate;
  const tot = totals(items, 'offer');
  const tTL = tl ? toTL(tot, rate) : null;
  return (
    <article className="paper">
      <header className="paper-h">
        <img src={S.brand.logo || LOGO_MARK} alt="" />
        <div className="paper-shop"><b>{S.shop.name}</b><span>{[S.shop.address, S.shop.phone].filter(Boolean).join(' · ')}</span></div>
        <div className="paper-no"><span>Ürün listesi</span><b className="num">#{r.no}</b><small>{new Date(r.updatedAt || r.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</small></div>
      </header>
      {(r.gname || r.userName) && <div className="paper-who">Müşteri: <b>{r.gname || r.userName}</b></div>}
      <div className="paper-scroll">
        <table className="ptable">
          <thead><tr><th className="c">#</th><th>Ürün</th><th className="r">Adet</th><th className="r">{priced(r) ? 'Fiyat' : 'Liste fiyatı'}</th><th className="r">Tutar</th>{tl && <th className="r">TL</th>}</tr></thead>
          <tbody>
            {items.map((it, k) => {
              const sum = it.offer == null ? null : Number(it.offer) * it.qty;
              return (
                <tr key={it.id + '-' + k}>
                  <td className="c muted num">{k + 1}</td>
                  <td className="pt-name">{(() => { const p = { ...(byId.get(it.id) || {}), ...it }; return (
                    <a href={links.product(p, S)} target="_blank" rel="noopener" title="Ürün sayfasını yeni sekmede aç">
                      <Thumb p={p} size="sm" />
                      <span className="pt-t"><span>{it.n}</span><code>{it.k}</code></span>
                      <Icon n="ext" s={14} className="pt-ext" />
                    </a>); })()}</td>
                  <td className="r num"><b>{it.qty}</b></td>
                  <td className="r num">{it.offer == null ? 'Sorulacak' : fmt(it.offer, it.cur)}</td>
                  <td className="r num"><b>{sum == null ? '—' : fmt(sum, it.cur)}</b></td>
                  {tl && <td className="r num muted">{sum == null || it.cur !== 'USD' ? '—' : fmtTL(sum * rate.usd)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="paper-f">
        <div className="paper-tot"><span>{items.length} kalem · {items.reduce((n, i) => n + (Number(i.qty) || 0), 0)} adet</span><b className="num">{fmtTotals(tot)}</b></div>
        {tTL != null && <div className="paper-tl"><span>{rateLabel(rate)}</span><b className="num">{fmtTL(tTL)}</b></div>}
        <p className="paper-note">{priced(r) ? 'Fiyatlar size özeldir.' : 'Liste fiyatlarıdır; fiyatlandırıp size dönüş yapacağız.'}</p>
      </footer>
    </article>
  );
}

// ---- Resim (PNG) çizimi -------------------------------------------------------
function loadImg(src, cors) { return new Promise((res) => { if (!src) return res(null); const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; const t = setTimeout(() => res(null), 5000); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); res(null); }; i.src = src; }); }
// Ürün küçük resmi (site CDN'i izin verirse resme çizilir, vermezse boş kutu kalır)
function thumbSrc(it, S) { const p = { ...(store.s.byId.get(it.id) || {}), ...it }; if (p.img && p.img !== 'fs') return p.img; return p.pi && S.catalog.imageThumb?.includes('{pi}') ? S.catalog.imageThumb.replaceAll('{pi}', p.pi) : null; }
function wrap(ctx, text, w, maxLines) {
  const words = String(text).split(' '); const out = []; let cur = '';
  for (const wd of words) {
    const t = cur ? cur + ' ' + wd : wd;
    if (ctx.measureText(t).width <= w || !cur) cur = t; else { out.push(cur); cur = wd; }
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) { const keep = out.slice(0, maxLines); let last = keep[maxLines - 1]; while (last && ctx.measureText(last + '…').width > w) last = last.slice(0, -1); keep[maxLines - 1] = last + '…'; return keep; }
  return out;
}

export async function renderListImages(r, { items: itemsIn, rate, tl: tlIn } = {}) {
  const S = store.s.settings;
  const items = itemsIn || r.items || [];
  const tl = (tlIn ?? r.tl ?? true) && !!rate;
  try { await Promise.all(['700 40px "Barlow Condensed"', '600 24px Barlow', '500 18px "JetBrains Mono"', '400 20px Barlow'].map((f) => document.fonts.load(f))); } catch {}
  const logo = await loadImg(S.brand.logo || LOGO_MARK);
  const pics = await Promise.all(items.map((it) => loadImg(thumbSrc(it, S), true)));
  const W = tl ? 1240 : 1080, P = 48, MAXH = 1700;
  const accent = S.brand.accent || '#2f55b0', priceC = S.brand.priceAccent || '#c2410c';
  const cols = [['#', 44, 'c'], ['', 84, 'c'], ['Ürün', 0, 'l'], ['Adet', 96, 'r'], [priced(r) ? 'Fiyat' : 'Liste fiyatı', 150, 'r'], ['Tutar', 160, 'r']];
  if (tl) cols.push(['TL', 170, 'r']);
  const fixed = cols.reduce((n, c) => n + c[1], 0);
  cols[2][1] = W - 2 * P - fixed;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = '600 23px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif';
  const rows = items.map((it, k) => { const lines = wrap(meas, it.n, cols[2][1] - 20, 3); return { it, k, lines, h: Math.max(96, 26 + lines.length * 29 + 26) }; });
  const HEAD = 250, THEAD = 52, FOOT = tl ? 210 : 160, PFOOT = 56;
  // sayfalara böl
  const pages = []; let cur = [], h = HEAD + THEAD + PFOOT;
  rows.forEach((row, i) => {
    const isLast = i === rows.length - 1;
    const need = row.h + (isLast ? FOOT : 0);
    if (cur.length && h + need > MAXH) { pages.push(cur); cur = []; h = HEAD + THEAD + PFOOT; }
    cur.push(row); h += row.h;
  });
  if (cur.length || !pages.length) pages.push(cur);
  const tot = totals(items, 'offer');
  const tTL = tl ? toTL(tot, rate) : null;
  const blobs = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const last = pi === pages.length - 1;
    const H = HEAD + THEAD + pages[pi].reduce((n, x) => n + x.h, 0) + (last ? FOOT : 0) + PFOOT;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.fillStyle = accent; x.fillRect(0, 0, W, 10);
    // başlık
    if (logo) { x.save(); x.beginPath(); x.arc(P + 44, 96, 44, 0, Math.PI * 2); x.clip(); x.drawImage(logo, P, 52, 88, 88); x.restore(); }
    x.fillStyle = '#111827'; x.font = '700 44px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillText(S.shop.name || '', P + 108, 96);
    x.fillStyle = '#6b7280'; x.font = '400 20px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif';
    x.fillText([S.shop.address, S.shop.phone].filter(Boolean).join(' · '), P + 108, 126);
    x.textAlign = 'right';
    x.fillStyle = '#6b7280'; x.font = '600 16px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'; x.fillText('ÜRÜN LİSTESİ', W - P, 70);
    x.fillStyle = '#111827'; x.font = '700 40px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; x.fillText('#' + r.no, W - P, 110);
    x.fillStyle = '#6b7280'; x.font = '400 18px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'; x.fillText(new Date(r.updatedAt || r.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }), W - P, 136);
    x.textAlign = 'left';
    const who = r.gname || r.userName;
    x.fillStyle = '#374151'; x.font = '400 21px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif';
    if (who) { x.fillText('Müşteri: ', P, 196); const ww = x.measureText('Müşteri: ').width; x.font = '700 21px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'; x.fillText(who, P + ww, 196); }
    if (pages.length > 1) { x.textAlign = 'right'; x.font = '600 19px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'; x.fillStyle = accent; x.fillText(`Sayfa ${pi + 1} / ${pages.length}`, W - P, 196); x.textAlign = 'left'; }
    // tablo başlığı
    let y = HEAD - 30;
    x.fillStyle = '#eef2fb'; x.fillRect(P, y, W - 2 * P, THEAD);
    x.fillStyle = '#374151'; x.font = '700 17px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif';
    let cx = P;
    for (const [t, w, al] of cols) {
      x.textAlign = al === 'r' ? 'right' : al === 'c' ? 'center' : 'left';
      x.fillText(t.toLocaleUpperCase('tr'), al === 'r' ? cx + w - 10 : al === 'c' ? cx + w / 2 : cx + 10, y + 33);
      cx += w;
    }
    y += THEAD;
    // satırlar
    for (const row of pages[pi]) {
      const { it, k, lines } = row;
      if (k % 2) { x.fillStyle = '#f8f9fb'; x.fillRect(P, y, W - 2 * P, row.h); }
      x.strokeStyle = '#e5e7eb'; x.lineWidth = 1; x.beginPath(); x.moveTo(P, y + row.h - .5); x.lineTo(W - P, y + row.h - .5); x.stroke();
      const mid = y + row.h / 2 + 8;
      const sum = it.offer == null ? null : Number(it.offer) * it.qty;
      cx = P;
      const cells = [String(k + 1), null, null, String(it.qty), it.offer == null ? 'Sorulacak' : fmt(it.offer, it.cur), sum == null ? '—' : fmt(sum, it.cur)];
      if (tl) cells.push(sum == null || it.cur !== 'USD' ? '—' : fmtTL(sum * rate.usd));
      cols.forEach(([, w, al], ci) => {
        if (ci === 1) {
          const sz = 68, ix = cx + (w - sz) / 2, iy = y + (row.h - sz) / 2;
          x.fillStyle = '#fff'; x.fillRect(ix, iy, sz, sz); x.strokeStyle = '#e5e7eb'; x.strokeRect(ix + .5, iy + .5, sz - 1, sz - 1);
          const im = pics[k];
          if (im) { const sc = Math.min((sz - 6) / im.width, (sz - 6) / im.height); const dw = im.width * sc, dh = im.height * sc; try { x.drawImage(im, ix + (sz - dw) / 2, iy + (sz - dh) / 2, dw, dh); } catch {} }
        } else if (ci === 2) {
          x.textAlign = 'left'; x.fillStyle = '#111827'; x.font = '600 23px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif';
          lines.forEach((ln, li) => x.fillText(ln, cx + 10, y + 26 + 22 + li * 29));
          x.fillStyle = '#6b7280'; x.font = '500 17px "JetBrains Mono", Consolas, monospace'; x.fillText(it.k || '', cx + 10, y + 26 + 22 + lines.length * 29 - 2);
        } else {
          x.textAlign = al === 'r' ? 'right' : 'center';
          x.fillStyle = ci === 0 ? '#9ca3af' : ci === 6 ? '#6b7280' : ci === 5 ? '#111827' : '#1f2937';
          x.font = ci === 5 || ci === 3 ? '700 24px Barlow' : ci === 0 ? '500 19px Barlow' : '500 22px Barlow';
          x.fillText(cells[ci], al === 'r' ? cx + w - 10 : cx + w / 2, mid);
        }
        cx += w;
      });
      y += row.h;
    }
    // toplam
    if (last) {
      y += 30;
      x.textAlign = 'left'; x.fillStyle = '#6b7280'; x.font = '500 21px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif';
      x.fillText(`${items.length} kalem · ${items.reduce((n, i) => n + (Number(i.qty) || 0), 0)} adet`, P, y + 30);
      x.textAlign = 'right'; x.fillStyle = '#374151'; x.font = '600 20px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'; x.fillText('TOPLAM', W - P - 230, y + 30);
      x.fillStyle = priceC; x.font = '700 46px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; x.fillText(fmtTotals(tot), W - P, y + 36);
      y += 56;
      if (tTL != null) {
        x.fillStyle = '#6b7280'; x.font = '400 19px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'; x.fillText(rateLabel(rate), W - P - 230, y + 30);
        x.fillStyle = '#111827'; x.font = '700 34px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; x.fillText(fmtTL(tTL), W - P, y + 34);
        y += 50;
      }
      x.textAlign = 'left'; x.fillStyle = '#6b7280'; x.font = '400 19px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif';
      x.fillText(priced(r) ? 'Fiyatlar size özeldir.' : 'Liste fiyatlarıdır; fiyatlandırıp size dönüş yapacağız.', P, y + 30);
    }
    // alt bilgi
    x.fillStyle = '#9ca3af'; x.font = '400 16px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'; x.textAlign = 'center';
    x.fillText(`${S.shop.name || ''}${S.shop.whatsapp ? ' · WhatsApp ' + S.shop.whatsapp : ''}${pages.length > 1 ? ` · Sayfa ${pi + 1}/${pages.length}` : ''}`, W / 2, H - 22);
    blobs.push(await new Promise((res) => c.toBlob(res, 'image/png')));
  }
  return blobs;
}

// Resmi paylaş (telefonda WhatsApp'a gönderilebilir) / indir / panoya kopyala
export function ExportBar({ r, items, rate, tl, extra }) {
  const [busy, setBusy] = useState(false);
  const [imgs, setImgs] = useState(null);
  useEffect(() => () => imgs?.forEach((u) => URL.revokeObjectURL(u.url)), [imgs]);
  async function make() {
    const blobs = await renderListImages(r, { items, rate, tl });
    return blobs.map((b, i) => new File([b], `liste-${r.no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }));
  }
  async function share() {
    setBusy(true);
    try {
      const files = await make();
      if (navigator.canShare?.({ files })) { try { await navigator.share({ files, title: 'Ürün listesi #' + r.no }); } catch (e) { if (e.name !== 'AbortError') throw e; } }
      else download(files);
    } catch (e) { toast('Resim oluşturulamadı: ' + e.message, 'bad'); }
    setBusy(false);
  }
  function download(files) {
    files.forEach((f, i) => setTimeout(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, i * 400));
    toast(files.length > 1 ? `${files.length} sayfa indirildi` : 'Resim indirildi');
  }
  async function copy() {
    setBusy(true);
    try {
      const files = await make();
      if (files.length > 1) { download(files); toast(`Liste ${files.length} sayfa oldu, resimler indirildi`, 'info'); }
      else { await navigator.clipboard.write([new ClipboardItem({ 'image/png': files[0] })]); toast('Resim kopyalandı — WhatsApp’a yapıştırın'); }
    } catch { toast('Bu tarayıcı resmi kopyalayamıyor, indirmeyi deneyin', 'bad'); }
    setBusy(false);
  }
  async function preview() {
    setBusy(true);
    try { const files = await make(); setImgs(files.map((f) => ({ url: URL.createObjectURL(f), name: f.name }))); } catch (e) { toast('Resim oluşturulamadı: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const touch = matchMedia('(hover: none)').matches;
  return (
    <>
      <div className="export-bar">
        <button className="btn primary" disabled={busy} onClick={share}><Icon n={touch ? 'send' : 'upload'} s={16} />{touch ? 'Resim olarak paylaş' : 'Resmi indir'}</button>
        {!touch && typeof ClipboardItem !== 'undefined' && <button className="btn outline" disabled={busy} onClick={copy}><Icon n="copy" s={16} />Resmi kopyala</button>}
        <button className="btn ghost" disabled={busy} onClick={preview}><Icon n="eye" s={16} />Resmi gör</button>
        {extra}
      </div>
      {imgs && (
        <div className="img-prev">
          <div className="img-prev-h"><b>{imgs.length > 1 ? `${imgs.length} sayfa` : 'Resim'}</b><button className="icon-btn sm" onClick={() => setImgs(null)} aria-label="Kapat"><Icon n="x" s={16} /></button></div>
          {imgs.map((m) => <a key={m.url} href={m.url} download={m.name}><img src={m.url} alt={m.name} /></a>)}
        </div>
      )}
    </>
  );
}

// ---- Vitrin müşterisinin listeleri (/magaza/t/<no>) -----------------------------
export function GuestLists() {
  const openReq = useStore((s) => s.openReq);
  const [list, setList] = useState([]);
  useEffect(() => {
    const ids = [...new Set([openReq, ...ls.get('guest-reqs', [])].filter(Boolean))];
    if (openReq && !ls.get('guest-reqs', []).includes(openReq)) ls.set('guest-reqs', [openReq, ...ls.get('guest-reqs', [])].slice(0, 30));
    const map = new Map();
    const unsubs = ids.map((id) => api().watchRequest(id, (r) => { if (r) map.set(id, r); else map.delete(id); setList([...map.values()].sort((a, b) => b.updatedAt - a.updatedAt)); }));
    return () => unsubs.forEach((u) => u && u());
  }, [openReq]);
  const cur = list.find((r) => r.id === openReq);
  if (openReq && cur) return <GuestList r={cur} back={list.length > 1 ? () => store.set({ openReq: null }) : null} />;
  if (openReq && !list.length) return <div className="page narrow"><div className="spinner" aria-label="Yükleniyor" /></div>;
  return (
    <div className="page narrow">
      <h1 className="page-t">Listelerim</h1>
      {list.length === 0 ? (
        <Empty icon="cart" title="Henüz liste göndermediniz"><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty>
      ) : (
        <ul className="glist">
          {list.map((r) => (
            <li key={r.id}><button className="gl-card" onClick={() => store.set({ openReq: r.id })}>
              <b>#{r.no}</b><span className="muted">{when(r.updatedAt)} · {(r.items || []).length} kalem</span>
              <span className={'pill tone-' + (priced(r) ? 'ok' : 'info')}>{priced(r) ? 'Fiyatlandı' : 'Gönderildi'}</span>
              <b className="num">{fmtTotals(totals(r.items, 'offer'))}</b>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GuestList({ r, back }) {
  const S = useStore((s) => s.settings);
  const link = links.guestRequest(r.id);
  return (
    <div className="page list-page">
      <div className="list-top">
        {back && <button className="btn sm ghost" onClick={back}><Icon n="back" s={16} />Listelerim</button>}
        <span className={'pill tone-' + (priced(r) ? 'ok' : 'info')}>{priced(r) ? 'Fiyatlandırıldı' : 'Dükkana gönderildi'}</span>
      </div>
      <ListPaper r={r} />
      <ExportBar r={r} rate={listRate(r, currentRate())} extra={<>
        <button className="btn ghost" onClick={() => copyText(link, 'Link kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>
        {S.shop.whatsapp && <a className="btn wa" href={waLink(S.shop.whatsapp, `Merhaba, #${r.no} numaralı listem hakkında yazıyorum:\n${link}`)} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp’tan yaz</a>}
      </>} />
      <p className="fine center admin-hint">Dükkan sahibi misiniz? <a href={links.adminRequest(r.id)}>Yönetim panelinde aç</a></p>
    </div>
  );
}

// ---- Yönetici: fiyatları kaydet + tablo resmini hazırla --------------------------
export function AdminListShare({ r, items, onClose }) {
  const live = useRate();
  const [tl, setTl] = useState(r.tl ?? true);
  const rate = live || r.rate || null;
  const link = links.guestRequest(r.id);
  const shown = useMemo(() => ({ ...r, items, status: r.status === 'new' ? 'offered' : r.status, updatedAt: Date.now() }), [r, items]);
  const phone = r.gphone;
  const waText = `Merhaba${r.gname ? ' ' + r.gname : ''}, #${r.no} numaralı listenizin fiyatlı hali:\n${link}`;
  useEffect(() => { // TL tercihi ve o anki kur listeye kaydedilir; müşteri linkte aynısını görür
    const patch = { tl }; if (rate) patch.rate = { usd: rate.usd, src: rate.src, at: rate.at || Date.now() };
    api().updateRequest(r.id, patch).catch(() => {});
  }, [tl]);
  return (
    <div className="share-sheet">
      <label className="mini-check tl-toggle"><input type="checkbox" checked={tl} disabled={!rate} onChange={(e) => setTl(e.target.checked)} />TL karşılığını ekle {rate ? <span className="muted">({rateLabel(rate)})</span> : <span className="muted">(kur alınamadı — Ayarlar &gt; Fiyat’tan elle girebilirsiniz)</span>}</label>
      <ListPaper r={shown} rate={rate} tl={tl} />
      <ExportBar r={shown} rate={rate} tl={tl} extra={<>
        <button className="btn ghost" onClick={() => copyText(link, 'Liste linki kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>
        <a className="btn wa" href={waLink(phone || '', waText)} target="_blank" rel="noopener"><Icon n="wa" s={16} />Linki WhatsApp’ta gönder</a>
      </>} />
      <p className="fine">Telefonda “Resim olarak paylaş” deyip WhatsApp’ı seçin; bilgisayarda “Resmi kopyala” deyip WhatsApp Web’e yapıştırın. Liste uzunsa birkaç sayfa resim olur.</p>
    </div>
  );
}
