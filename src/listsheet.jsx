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
function thumbSrc(it, S) {
  const p = { ...(store.s.byId.get(it.id) || {}), ...it };
  if (p.img && p.img !== 'fs') return p.img;
  const u = p.pi && S.catalog.imageThumb?.includes('{pi}') ? S.catalog.imageThumb.replaceAll('{pi}', p.pi) : null;
  // site CDN'i başka siteye resim çizdirmiyor; bekçi üzerinden alınır
  return u && window.WATCH_URL ? window.WATCH_URL.replace(/\/$/, '') + '/img?u=' + encodeURIComponent(u) : u;
}
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

const F = { d: '"Barlow Condensed", "Arial Narrow", Arial, sans-serif', b: 'Barlow, "Segoe UI", Roboto, Arial, sans-serif', m: '"JetBrains Mono", Consolas, monospace' };
function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }

// Liste resmi: 1080 px genişlik, yazılar hiç küçülmez; sığmayan satırlar bir sonraki resme geçer.
export async function renderListImages(r, { items: itemsIn, rate, tl: tlIn } = {}) {
  const S = store.s.settings;
  const items = itemsIn || r.items || [];
  const tl = (tlIn ?? r.tl ?? true) && !!rate;
  try { await Promise.all(['700 40px "Barlow Condensed"', '600 24px Barlow', '700 24px Barlow', '500 18px "JetBrains Mono"', '400 20px Barlow'].map((f) => document.fonts.load(f))); } catch {}
  const [logo, ...pics] = await Promise.all([loadImg(S.brand.logo || LOGO_MARK), ...items.map((it) => loadImg(thumbSrc(it, S), true))]);
  const W = 1080, P = 56, MAXH = 1680;
  const accent = S.brand.accent || '#2f55b0', priceC = S.brand.priceAccent || '#c2410c';
  const ink = '#0f172a', mute = '#64748b', soft = '#94a3b8', line = '#e2e8f0';
  // sütunlar: #, resim, ürün, adet, birim fiyat, toplam
  const C = { n: 48, img: 92, qty: 92, unit: 150, sum: 160 };
  const TX = P + 24, TW = W - 2 * P - 48;
  C.name = TW - C.n - C.img - C.qty - C.unit - C.sum;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = '600 26px ' + F.b;
  const rows = items.map((it, k) => { const lines = wrap(meas, it.n, C.name - 16, 2); return { it, k, lines, h: Math.max(112, 30 + lines.length * 32 + 30) }; });
  const HEAD = 372, THEAD = 64, FOOT = tl ? 300 : 230, PFOOT = 70;
  const pages = []; let cur = [], h = HEAD + THEAD + PFOOT + 30;
  rows.forEach((row, i) => {
    const need = row.h + (i === rows.length - 1 ? FOOT : 0);
    if (cur.length && h + need > MAXH) { pages.push(cur); cur = []; h = HEAD + THEAD + PFOOT + 30; }
    cur.push(row); h += row.h;
  });
  if (cur.length || !pages.length) pages.push(cur);
  const tot = totals(items, 'offer');
  const tTL = tl ? toTL(tot, rate) : null;
  const date = new Date(r.updatedAt || r.createdAt || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const who = r.gname || r.userName || '';
  const blobs = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const last = pi === pages.length - 1, many = pages.length > 1;
    const bodyH = pages[pi].reduce((n, x) => n + x.h, 0);
    const H = HEAD + THEAD + bodyH + 30 + (last ? FOOT : 50) + PFOOT;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.textBaseline = 'alphabetic';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    // --- başlık
    rr(x, P, 56, 96, 96, 22); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = line; x.lineWidth = 2; x.stroke();
    if (logo) { const sc = Math.min(72 / logo.width, 72 / logo.height); x.drawImage(logo, P + 48 - logo.width * sc / 2, 104 - logo.height * sc / 2, logo.width * sc, logo.height * sc); }
    x.textAlign = 'left'; x.fillStyle = ink; x.font = '700 46px ' + F.d; x.fillText((S.shop.name || '').toLocaleUpperCase('tr'), P + 124, 104);
    x.fillStyle = accent; x.font = '700 19px ' + F.b; x.fillText(('ÜRÜN LİSTESİ  ·  #' + (r.no || '')) + (many ? `  ·  SAYFA ${pi + 1}/${pages.length}` : ''), P + 126, 136);
    x.fillStyle = line; x.fillRect(P, 184, W - 2 * P, 2);
    // --- müşteri / tarih kartları
    const cw = (W - 2 * P - 24) / 2;
    for (const [i, lab, val] of [[0, 'MÜŞTERİ', who || '—'], [1, 'TARİH', date]]) {
      const cx0 = P + i * (cw + 24);
      rr(x, cx0, 212, cw, 116, 22); x.fillStyle = '#f8fafc'; x.fill(); x.strokeStyle = line; x.lineWidth = 2; x.stroke();
      x.fillStyle = soft; x.font = '700 17px ' + F.b; x.fillText(lab, cx0 + 28, 256);
      x.fillStyle = ink; x.font = '700 30px ' + F.b; x.fillText(wrap(x, val, cw - 56, 1)[0], cx0 + 28, 298);
    }
    // --- tablo
    let y = HEAD;
    const tH = THEAD + bodyH;
    rr(x, P, y, W - 2 * P, tH, 28); x.save(); x.clip();
    x.fillStyle = '#f1f5f9'; x.fillRect(P, y, W - 2 * P, THEAD);
    x.fillStyle = mute; x.font = '700 16px ' + F.b;
    let cx = TX;
    const head = (t, w, al) => { x.textAlign = al; x.fillText(t, al === 'right' ? cx + w : al === 'center' ? cx + w / 2 : cx, y + 40); cx += w; };
    head('#', C.n, 'left'); head('', C.img, 'left'); head('ÜRÜN', C.name, 'left'); head('ADET', C.qty, 'center'); head(priced(r) ? 'BİRİM FİYAT' : 'LİSTE FİYATI', C.unit, 'right'); head('TOPLAM', C.sum, 'right');
    y += THEAD;
    for (const row of pages[pi]) {
      const { it, k, lines } = row;
      const mid = y + row.h / 2;
      if (row !== pages[pi][0]) { x.fillStyle = '#eef2f7'; x.fillRect(P + 20, y, W - 2 * P - 40, 2); }
      cx = TX;
      x.textAlign = 'left'; x.fillStyle = soft; x.font = '600 20px ' + F.b; x.fillText(String(k + 1), cx, mid + 7); cx += C.n;
      const sz = 76, iy = mid - sz / 2;
      rr(x, cx, iy, sz, sz, 14); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = line; x.lineWidth = 2; x.stroke();
      const im = pics[k];
      if (im) { x.save(); rr(x, cx + 2, iy + 2, sz - 4, sz - 4, 12); x.clip(); const sc = Math.min((sz - 10) / im.width, (sz - 10) / im.height); try { x.drawImage(im, cx + sz / 2 - im.width * sc / 2, mid - im.height * sc / 2, im.width * sc, im.height * sc); } catch {} x.restore(); }
      cx += C.img;
      const top = mid - (lines.length * 32 + 22) / 2 + 24;
      x.fillStyle = ink; x.font = '600 26px ' + F.b; lines.forEach((ln, li) => x.fillText(ln, cx, top + li * 32));
      x.fillStyle = soft; x.font = '500 17px ' + F.m; x.fillText(it.k || '', cx, top + lines.length * 32 + 2);
      cx += C.name;
      x.textAlign = 'center'; x.fillStyle = ink; x.font = '700 30px ' + F.b; x.fillText(String(it.qty), cx + C.qty / 2, mid + 10); cx += C.qty;
      const sum = it.offer == null ? null : Number(it.offer) * it.qty;
      x.textAlign = 'right'; x.fillStyle = '#334155'; x.font = '500 26px ' + F.b; x.fillText(it.offer == null ? 'Sorulacak' : fmt(it.offer, it.cur), cx + C.unit, mid + 9); cx += C.unit;
      x.fillStyle = priceC; x.font = '700 30px ' + F.b; x.fillText(sum == null ? '—' : fmt(sum, it.cur), cx + C.sum, mid + 10);
      y += row.h;
    }
    x.restore();
    rr(x, P, HEAD, W - 2 * P, tH, 28); x.strokeStyle = line; x.lineWidth = 2; x.stroke();
    y = HEAD + tH + 30;
    if (!last) {
      x.textAlign = 'right'; x.fillStyle = accent; x.font = '700 22px ' + F.b; x.fillText(`Devamı ${pi + 2}. resimde  →`, W - P, y + 24);
      y += 50;
    } else {
      // --- toplam kutusu
      const bw = 470, bx = W - P - bw, bh = tTL != null ? 240 : 150;
      rr(x, bx, y, bw, bh, 28); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = line; x.lineWidth = 2; x.stroke();
      x.textAlign = 'left'; x.fillStyle = priceC; x.font = '700 19px ' + F.b; x.fillText('GENEL TOPLAM', bx + 32, y + 62);
      x.textAlign = 'right'; x.font = '700 60px ' + F.d; x.fillText(fmtTotals(tot), bx + bw - 32, y + 82);
      if (tTL != null) {
        x.textAlign = 'left'; x.fillStyle = soft; x.font = '700 17px ' + F.b; x.fillText('TL KARŞILIĞI', bx + 32, y + 150);
        x.textAlign = 'right'; x.fillStyle = '#d97706'; x.font = '700 40px ' + F.d; x.fillText(fmtTL(tTL), bx + bw - 32, y + 158);
        x.fillStyle = soft; x.font = '600 16px ' + F.b; x.fillText('1 USD = ' + rate.usd.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺ · ' + (rate.src === 'manual' ? 'elle girilen kur' : 'Harem satış'), bx + bw - 32, y + 204);
      }
      x.textAlign = 'left'; x.fillStyle = mute; x.font = '600 22px ' + F.b;
      x.fillText(`${items.length} kalem · ${items.reduce((n, i) => n + (Number(i.qty) || 0), 0)} adet`, P + 4, y + 62);
      x.fillStyle = soft; x.font = '400 19px ' + F.b;
      wrap(x, priced(r) ? 'Fiyatlar size özeldir.' : 'Liste fiyatlarıdır; fiyatlandırıp size dönüş yapacağız.', W - 2 * P - bw - 30, 3).forEach((ln, i) => x.fillText(ln, P + 4, y + 100 + i * 26));
      y += FOOT;
    }
    // --- alt bilgi
    x.textAlign = 'center'; x.fillStyle = soft; x.font = '400 17px ' + F.b;
    x.fillText([S.shop.name, S.shop.address, S.shop.whatsapp ? 'WhatsApp ' + S.shop.whatsapp : S.shop.phone].filter(Boolean).join('  ·  '), W / 2, H - 32);
    blobs.push(await new Promise((res) => c.toBlob(res, 'image/png')));
  }
  return blobs;
}

// Resmi paylaş (telefonda WhatsApp'a gönderilebilir) / indir / panoya kopyala
export function ExportBar({ r, items, rate, tl, extra, shareText }) {
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
      if (navigator.canShare?.({ files })) { try { await navigator.share(shareText ? { files, text: shareText } : { files, title: 'Ürün listesi #' + r.no }); } catch (e) { if (e.name !== 'AbortError') throw e; } }
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
// Liste linki (/magaza/t/<no>): sadece o listeyi açar. Bulunamazsa ya da bağlantı takılırsa sonsuza kadar dönmez.
export function GuestLists() {
  const openReq = useStore((s) => s.openReq);
  const [st, setSt] = useState({ r: undefined, slow: false, tries: 0 });
  useEffect(() => {
    if (!openReq) { go('katalog'); return; }
    let done = false;
    const got = (r) => { done = true; setSt((x) => ({ ...x, r, slow: false })); };
    const un = api().watchRequest(openReq, (r) => got(r || null));
    // canlı bağlantı gecikirse tek seferlik okuma dene
    const t1 = setTimeout(() => { if (!done) api().getRequest?.(openReq).then((r) => !done && got(r || null)).catch(() => {}); }, 4000);
    const t2 = setTimeout(() => { if (!done) setSt((x) => ({ ...x, slow: true })); }, 12000);
    return () => { done = true; un && un(); clearTimeout(t1); clearTimeout(t2); };
  }, [openReq, st.tries]);
  if (st.r) return <GuestList r={st.r} />;
  if (st.r === null) return (
    <div className="page narrow"><Empty icon="search" title="Liste bulunamadı">
      <p>Link eksik kopyalanmış ya da liste silinmiş olabilir.</p>
      <button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button>
    </Empty></div>
  );
  return (
    <div className="page narrow list-wait">
      <div className="spinner" aria-label="Yükleniyor" />
      {st.slow && <>
        <p>Liste yüklenemedi, bağlantı yavaş görünüyor.</p>
        <div className="slow-btns">
          <button className="btn primary" onClick={() => setSt((x) => ({ ...x, slow: false, tries: x.tries + 1 }))}><Icon n="refresh" s={16} />Tekrar dene</button>
          <button className="btn outline" onClick={() => location.reload()}>Sayfayı yenile</button>
        </div>
      </>}
    </div>
  );
}

function GuestList({ r }) {
  const S = useStore((s) => s.settings);
  const link = links.guestRequest(r.id);
  return (
    <div className="page list-page">
      <div className="list-top">
        <button className="btn sm ghost" onClick={() => go('katalog')}><Icon n="back" s={16} />Ürünler</button>
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
      <ExportBar r={shown} rate={rate} tl={tl} shareText={link} extra={<>
        <button className="btn ghost" onClick={() => copyText(link, 'Liste linki kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>
        <a className="btn wa" href={waLink(phone || '', waText)} target="_blank" rel="noopener"><Icon n="wa" s={16} />Linki WhatsApp’ta gönder</a>
      </>} />
      <p className="fine">Telefonda “Resim olarak paylaş” deyip WhatsApp’ı seçin (resimle birlikte liste linki de gider); bilgisayarda “Resmi kopyala” deyip WhatsApp Web’e yapıştırın. Liste uzunsa birkaç sayfa resim olur.</p>
    </div>
  );
}
