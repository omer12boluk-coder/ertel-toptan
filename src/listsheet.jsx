// Vitrin listesi: müşterinin WhatsApp'tan link olarak gönderdiği ürün listesi.
// Aynı liste hem sayfada (okunaklı tablo) hem resim (PNG, gerekirse birkaç sayfa) olarak gösterilir.
// Yönetici fiyatları düzenleyip aynı tabloyu resim olarak müşteriye geri gönderir.
import { useEffect, useMemo, useState } from 'react';
import { useStore, api, store, toast, go } from './store.js';
import { Icon, Empty, Thumb, Sheet, Stepper, copyText } from './ui.jsx';
import { decodeList, encodeList, listItems, listRecord, listLink } from './listcode.js';
import { Lightbox, imageList } from './catalog.jsx';
import { links, waLink } from './route.js';
import { fmt, totals, fmtTotals, when, ls, roundStep } from './utils.js';
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
export function ListPaper({ r, items: itemsIn, rate: rateIn }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const live = useRate();
  const [zoom, setZoom] = useState(null); // ürün resmini büyüt
  const items = itemsIn || r.items || [];
  const rate = rateIn !== undefined ? rateIn : listRate(r, live);
  const tot = totals(items, 'offer');
  const tTL = rate ? toTL(tot, rate) : null; // TL sadece toplamda
  return (
    <article className="paper">
      <header className="paper-h">
        <img src={S.brand.logo || LOGO_MARK} alt="" />
        <div className="paper-shop"><b>{S.shop.name}</b><span>{[S.shop.address, S.shop.phone].filter(Boolean).join(' · ')}</span></div>
        <div className="paper-no"><span>Ürün listesi</span><b className="num">#{r.no}</b><small>{new Date(r.updatedAt || r.createdAt).toLocaleDateString('tr-TR')}</small></div>
      </header>
      {(r.gname || r.userName) && <div className="paper-who">Müşteri: <b>{r.gname || r.userName}</b></div>}
      <div className="paper-scroll">
        <table className="ptable">
          <thead><tr><th className="c">#</th><th>Ürün</th><th className="r">Adet</th><th className="r">{priced(r) ? 'Fiyat' : 'Liste fiyatı'}</th><th className="r">Tutar</th></tr></thead>
          <tbody>
            {items.map((it, k) => {
              const sum = it.offer == null ? null : Number(it.offer) * it.qty;
              const p = { ...(byId.get(it.id) || {}), ...it };
              const big = imageList(p, S, 'lg');
              return (
                <tr key={it.id + '-' + k}>
                  <td className="c muted num">{k + 1}</td>
                  <td className="pt-name">
                    <div className="pt-row">
                      <button className="pt-img" onClick={() => big.length && setZoom({ urls: big, title: it.n })} aria-label="Resmi büyüt" disabled={!big.length}><Thumb p={p} size="sm" /></button>
                      <a className="pt-t" href={links.product(p, S)} target="_blank" rel="noopener" title="Ürün sayfasını yeni sekmede aç"><span>{it.n}</span><code>{it.k}</code></a>
                    </div>
                  </td>
                  <td className="r num pt-qty">{it.qty}</td>
                  <td className="r num pt-unit">{it.offer == null ? 'Sorulacak' : fmt(it.offer, it.cur)}</td>
                  <td className="r num pt-sum">{sum == null ? '—' : fmt(sum, it.cur)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="paper-f">
        <div className="paper-tot"><span>{items.length} kalem · {items.reduce((n, i) => n + (Number(i.qty) || 0), 0)} adet</span><b className="num">{fmtTotals(tot)}</b></div>
        {tTL != null && <div className="paper-tl"><span>TL karşılığı <small>({rateLabel(rate)})</small></span><b className="num">{fmtTL(tTL)}</b></div>}
      </footer>
      {zoom && <Lightbox urls={zoom.urls} title={zoom.title} onClose={() => setZoom(null)} />}
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

export async function renderListImages(r, { items: itemsIn, rate, tl: tlIn } = {}) {
  const S = store.s.settings;
  const items = itemsIn || r.items || [];
  const tl = (tlIn ?? r.tl ?? true) && !!rate;
  try { await Promise.all(['700 40px "Barlow Condensed"', '600 24px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif', '500 18px "JetBrains Mono"', '400 20px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'].map((f) => document.fonts.load(f))); } catch {}
  const logo = await loadImg(S.brand.logo || LOGO_MARK);
  const pics = await Promise.all(items.map((it) => loadImg(thumbSrc(it, S), true)));
  const W = 1080, P = 48, MAXH = 1700;
  const accent = S.brand.accent || '#2f55b0', priceC = S.brand.priceAccent || '#c2410c';
  const cols = [['#', 44, 'c'], ['', 84, 'c'], ['Ürün', 0, 'l'], ['Adet', 96, 'r'], [priced(r) ? 'Fiyat' : 'Liste fiyatı', 150, 'r'], ['Tutar', 160, 'r']];
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
          x.font = ci === 5 || ci === 3 ? '700 24px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif' : ci === 0 ? '500 19px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif' : '500 22px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif';
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
    }
    // alt bilgi
    x.fillStyle = '#9ca3af'; x.font = '400 16px Barlow, \"Segoe UI\", Roboto, Arial, sans-serif'; x.textAlign = 'center';
    x.fillText(`${S.shop.name || ''}${S.shop.whatsapp ? ' · WhatsApp ' + S.shop.whatsapp : ''}${pages.length > 1 ? ` · Sayfa ${pi + 1}/${pages.length}` : ''}`, W / 2, H - 22);
    blobs.push(await new Promise((res) => c.toBlob(res, 'image/png')));
  }
  return blobs;
}

// Pano tek resim tutabildiği için birden fazla sayfa alt alta tek resimde birleştirilir
export async function mergePages(files) {
  if (!files || files.length <= 1) return files?.[0];
  const imgs = await Promise.all(files.map((f) => createImageBitmap(f)));
  const gap = 24, W = Math.max(...imgs.map((i) => i.width)), H = imgs.reduce((n, i) => n + i.height, 0) + gap * (imgs.length - 1);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = '#e2e8f0'; x.fillRect(0, 0, W, H);
  let y = 0; for (const i of imgs) { x.drawImage(i, 0, y); y += i.height + gap; }
  const b = await new Promise((res) => c.toBlob(res, 'image/png'));
  return new File([b], files[0].name.replace(/-1\.png$/, '.png'), { type: 'image/png' });
}

// Panoya hem resim hem link: WhatsApp'ta Ctrl+V yapınca resim eklenir, link de mesaj/başlık olarak gelir
export async function copyImageAndLink(file, link) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('Bu tarayıcı resmi kopyalayamıyor');
  const txt = new Blob([link], { type: 'text/plain' });
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': file, 'text/plain': txt })]); return 'both'; }
  catch { await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]); return 'image'; }
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
      const one = await mergePages(await make());
      const how = shareText ? await copyImageAndLink(one, shareText) : (await navigator.clipboard.write([new ClipboardItem({ 'image/png': one })]), 'image');
      toast('Resim' + (how === 'both' ? ' ve link' : '') + ' kopyalandı — WhatsApp’a yapıştırın');
    } catch { toast('Bu tarayıcı resmi kopyalayamıyor', 'bad'); }
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
        {typeof ClipboardItem !== 'undefined' && <button className="btn primary" disabled={busy} onClick={copy}><Icon n="copy" s={16} />{shareText ? 'Resim + linki kopyala' : 'Resmi kopyala'}</button>}
        {touch && <button className="btn outline" disabled={busy} onClick={share}><Icon n="send" s={16} />Paylaş</button>}
        {!touch && <button className="btn ghost" disabled={busy} onClick={share}><Icon n="upload" s={16} />İndir</button>}
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
      <p className="fine">“Resim + linki kopyala” deyip WhatsApp’ta müşterinin sohbetine yapıştırın (Ctrl+V).</p>
    </div>
  );
}

// ---- Linkli vitrin listesi (/magaza/l/<kod>): hiçbir yere kaydedilmez ----------------------
export function CodeList({ code }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const L = useMemo(() => decodeList(code), [code]);
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(t); }, []);
  if (!L) return (
    <div className="page narrow"><Empty icon="search" title="Liste açılamadı"><p>Link eksik kopyalanmış olabilir.</p><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty></div>
  );
  if (!byId.size) return (
    <div className="page narrow list-wait"><div className="spinner" aria-label="Yükleniyor" />
      {slow && <><p>Bağlantı yavaş görünüyor.</p><button className="btn primary" onClick={() => location.reload()}><Icon n="refresh" s={16} />Tekrar dene</button></>}
    </div>
  );
  const items = listItems(L, byId);
  const r = listRecord(L, items);
  const link = location.href.split('?')[0];
  const rate = r.rate || currentRate();
  return (
    <div className="page list-page">
      <div className="list-top">
        <button className="btn sm ghost" onClick={() => go('katalog')}><Icon n="back" s={16} />Ürünler</button>
        <span className={'pill tone-' + (L.priced ? 'ok' : 'info')}>{L.priced ? 'Fiyatlandırıldı' : 'Liste fiyatları'}</span>
      </div>
      <ListPaper r={r} rate={rate} />
      <div className="export-bar">
        {!L.priced && S.shop.whatsapp && <a className="btn wa" href={waLink(S.shop.whatsapp, link)} target="_blank" rel="noopener"><Icon n="wa" s={16} />Bu listeyi WhatsApp’tan gönder</a>}
        {L.priced && S.shop.whatsapp && <a className="btn wa" href={waLink(S.shop.whatsapp, 'Bu fiyatlarla onaylıyorum:\n' + link)} target="_blank" rel="noopener"><Icon n="wa" s={16} />Onaylıyorum, WhatsApp’tan yaz</a>}
        <button className="btn ghost" onClick={() => copyText(link, 'Link kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>
      </div>
      <p className="fine center admin-hint">Dükkan sahibi misiniz? <a href={listLink(code, true)}>Yönetim panelinde fiyatla</a></p>
    </div>
  );
}

// ---- Yönetici: linkli listeyi fiyatla, yeni link + resim üret -----------------------------------
export function VitrinListEditor({ code, onClose }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const live = useRate();
  const L0 = useMemo(() => decodeList(code), [code]);
  const [items, setItems] = useState(() => (L0 ? listItems(L0, byId) : []));
  const step = Number(S.pricing.adjustStep) || 1;
  if (!L0) return <Sheet title="Vitrin listesi" onClose={onClose}><p className="err">Bu link okunamadı. Linkin tamamını yapıştırdığınızdan emin olun.</p></Sheet>;
  const upd = (i, patch) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const L = { no: L0.no, at: Date.now(), priced: true, rate: live?.usd || L0.rate, items };
  const newLink = listLink(encodeList(L));
  const rate = live || (L0.rate ? { usd: L0.rate, src: 'harem' } : null);
  return (
    <Sheet wide title={`Vitrin listesi #${L0.no}`} sub="Fiyatları ayarlayın, fiyatlı yeni linki müşteriye gönderin. Hiçbir yere kaydedilmez." onClose={onClose}>
      <div className="share-sheet">
        <table className="itable vle">
          <thead><tr><th>Ürün</th><th className="r">Adet</th><th className="r">Liste</th><th className="r">Fiyat</th><th className="r">Tutar</th><th /></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id + '-' + i} className={it.offer !== it.list ? 'changed' : ''}>
                <td className="it-name"><span>{it.n}</span><code>{it.k}</code></td>
                <td className="r it-qty" data-l="Adet"><Stepper small min={1} value={it.qty} onChange={(v) => upd(i, { qty: v })} /></td>
                <td className="r num muted it-list">{fmt(it.list, it.cur)}</td>
                <td className="r it-offer" data-l="Fiyat">
                  <div className="adj">
                    <button onClick={() => upd(i, { offer: roundStep((Number(it.offer) || 0) - step, 0.01) })} aria-label="Düşür">−</button>
                    <input inputMode="decimal" value={it.offer ?? ''} aria-label="Fiyat" onChange={(e) => { const v = e.target.value.replace(',', '.'); upd(i, { offer: v === '' ? null : isNaN(Number(v)) ? it.offer : v.endsWith('.') ? v : Number(v) }); }} onBlur={() => upd(i, { offer: it.offer == null ? null : Number(it.offer) })} />
                    <button onClick={() => upd(i, { offer: roundStep((Number(it.offer) || 0) + step, 0.01) })} aria-label="Arttır">+</button>
                  </div>
                </td>
                <td className="r num it-sum" data-l="Tutar"><b>{it.offer == null ? '—' : fmt(Number(it.offer) * it.qty, it.cur)}</b></td>
                <td className="it-del"><button className="icon-btn sm" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label="Kalemi çıkar"><Icon n="trash" s={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="vle-tot"><span>Toplam</span><b className="num">{fmtTotals(totals(items, 'offer'))}</b>{rate && toTL(totals(items, 'offer'), rate) != null && <span className="muted num">≈ {fmtTL(toTL(totals(items, 'offer'), rate))}</span>}</div>
        <div className="export-bar">
          <a className="btn wa" href={waLink('', 'Fiyatlı listeniz:\n' + newLink)} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp’ta müşteriye gönder</a>
          <button className="btn outline" onClick={() => copyText(newLink, 'Fiyatlı liste linki kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>
          <a className="btn ghost" href={newLink} target="_blank" rel="noopener"><Icon n="ext" s={16} />Müşterinin göreceği hali aç</a>
        </div>

      </div>
    </Sheet>
  );
}

// Yönetici: müşteriden gelen vitrin linkini yapıştırıp açma
export function OpenVitrinList({ onClose }) {
  const [t, setT] = useState('');
  const [code, setCode] = useState(null);
  const m = t.trim().match(/\/l\/([\w-]+)/);
  const c = m ? m[1] : /^[\w-]{20,}$/.test(t.trim()) ? t.trim() : null;
  if (code) return <VitrinListEditor code={code} onClose={onClose} />;
  return (
    <Sheet title="Vitrin listesi aç" sub="Müşterinin WhatsApp’tan gönderdiği linki yapıştırın" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Vazgeç</button><button className="btn primary" disabled={!c} onClick={() => setCode(c)}>Aç</button></>}>
      <input autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="https://erteltoptan.web.app/magaza/l/…" />
      {t && !c && <p className="err">Bu bir vitrin listesi linki gibi görünmüyor.</p>}
    </Sheet>
  );
}
