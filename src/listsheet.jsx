// Vitrin listesi: müşterinin WhatsApp'tan link olarak gönderdiği ürün listesi.
// Aynı liste hem sayfada (okunaklı tablo) hem resim (PNG, gerekirse birkaç sayfa) olarak gösterilir.
// Yönetici fiyatları düzenleyip aynı tabloyu resim olarak müşteriye geri gönderir.
import { useEffect, useMemo, useState } from 'react';
import { useStore, api, store, toast, go } from './store.js';
import { Icon, Empty, Thumb, Sheet, Stepper, VatLines, copyText } from './ui.jsx';
import { decodeList, encodeList, listItems, listRecord, listLink } from './listcode.js';
import { Lightbox, imageList, ProductSheet } from './catalog.jsx';
import { links, waLink } from './route.js';
import { fmt, totals, fmtTotals, when, ls, roundStep, vatOf, picUrl, isAbsImg } from './utils.js';
import { LOGO_MARK } from './config.js';

// ---- Kur (1 USD kaç TL) ------------------------------------------------------
// Öncelik: yöneticinin elle girdiği kur > Harem Altın dolar satış (bekçi dakikada bir günceller)
let manualRate = {};
export function currentRate(s = store.s) {
  const manual = Number(s.settings?.pricing?.manualRate);
  // aynı nesne dönmeli: her seferinde yeni nesne → useStore sonsuz yeniden çizim (elle kur girilince sayfa çöküyordu)
  if (manual > 0) return manualRate.usd === manual ? manualRate : (manualRate = { usd: manual, src: 'manual', at: null });
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
export function ListPaper({ r, items: itemsIn, rate: rateIn, label, who = true, viewOnly = false, b2b = false }) { // b2b: bayiye KDV yok, liste toplamı ve kârı gösterilir // viewOnly: tamamlanmış sipariş — ürün penceresinde Sepete ekle yok
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const live = useRate();
  const [zoom, setZoom] = useState(null); // ürün resmini büyüt
  const [sheet, setSheet] = useState(null); // ürün adına basınca uygulamadaki ürün penceresi
  const items = itemsIn || r.items || [];
  const rate = rateIn !== undefined ? rateIn : listRate(r, live);
  const tot = totals(items, 'offer');
  const tTL = rate ? toTL(tot, rate) : null; // TL sadece toplamda
  return (
    <article className="paper">
      <header className="paper-h">
        <img src={S.brand.logo || LOGO_MARK} alt="" />
        <div className="paper-shop"><b>{S.shop.name}</b><span>{[S.shop.address, S.shop.phone].filter(Boolean).join(' · ')}</span></div>
        <div className="paper-no"><span>{label || 'Ürün listesi'}</span><b className="num">#{r.no}</b><small>{new Date(r.updatedAt || r.createdAt).toLocaleDateString('tr-TR')}</small></div>
      </header>
      {who && (r.gname || r.userName) && <div className="paper-who">Müşteri: <b>{r.gname || r.userName}</b></div>}
      <div className="paper-scroll">
        <table className="ptable">
          <thead><tr><th className="c">#</th><th>Ürün</th><th className="r">Adet</th><th className="r">{b2b ? 'Toptan' : priced(r) ? 'Fiyat' : 'Liste fiyatı'}</th><th className="r">Tutar</th></tr></thead>
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
                      {byId.get(it.id) ? <button type="button" className="pt-t" onClick={() => setSheet(byId.get(it.id))} title="Ürünü aç"><span>{it.n}</span><code>{it.k}</code></button> : <span className="pt-t"><span>{it.n}</span><code>{it.k}</code></span>}
                      <span className="pt-mob num"><b>{it.qty} adet</b> × {it.offer == null ? 'Sorulacak' : fmt(it.offer, it.cur)}</span>
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
        <div className="paper-tot">
          <span className="paper-cnt">{items.length} kalem · {items.reduce((n, i) => n + (Number(i.qty) || 0), 0)} adet</span>
          <div className="paper-sum">
            <span className="paper-lbl">Toplam</span>
            <b className="num">{fmtTotals(tot)}</b>
            {tTL != null && <span className="paper-tl num">≈ {fmtTL(tTL)} <small>({rateLabel(rate)})</small></span>}
          </div>
        </div>
        {b2b ? <B2bGain items={items} /> : <VatLines by={tot} rate={rate} />}
      </footer>
      {zoom && <Lightbox urls={zoom.urls} title={zoom.title} onClose={() => setZoom(null)} />}
      {sheet && <ProductSheet p={sheet} viewOnly={viewOnly} onClose={() => setSheet(null)} />}
    </article>
  );
}

// Bayi: liste (perakende) toplamı ile ödediği toptan toplam arasındaki fark = kârı
function B2bGain({ items }) {
  const withList = items.filter((i) => i.offer != null && Number(i.list) > 0);
  const list = totals(withList, 'list'); const paid = totals(withList, 'offer');
  const gain = Object.entries(list).map(([c, v]) => [c, v - (paid[c] || 0)]).filter(([, v]) => v > 0.004);
  if (!gain.length) return null;
  return (
    <div className="paper-gain">
      <span>Liste (perakende) toplamı <b className="num">{fmtTotals(list)}</b></span>
      <span className="gain">Kârınız <b className="num">{gain.map(([c, v]) => fmt(v, c)).join(' + ')}</b></span>
    </div>
  );
}

// ---- Resim (PNG) çizimi -------------------------------------------------------
function loadImg(src, cors) { return new Promise((res) => { if (!src) return res(null); const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; const t = setTimeout(() => res(null), 5000); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); res(null); }; i.src = src; }); }
// Ürün küçük resmi (site CDN'i izin verirse resme çizilir, vermezse boş kutu kalır)
function thumbSrc(it, S) {
  const p = { ...(store.s.byId.get(it.id) || {}), ...it };
  if (p.img && p.img !== 'fs') return p.img;
  if (p.pi && (p.pi.startsWith('r2:') || isAbsImg(p.pi))) return picUrl(p.pi, null, false); // depo CORS'a izin verir
  const u = p.pi ? picUrl(p.pi, S.catalog.imageThumb, false) : null;
  if (u && window.IMG_BASE && u.startsWith(window.IMG_BASE)) return u; // kendi depomuz CORS'a izin verir
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

// Liste resmi: bir resimde en fazla 12 ürün (fazlası sonraki resimlere eşit dağılır); yazılar hiç küçülmez.
// Tablo kenarları yuvarlatılmış bir kutunun içinde; resim, kullanılan alan kadar kırpılır (altta boşluk kalmaz).
const PER_PAGE = 12;
function rrect(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
export async function renderListImages(r, { items: itemsIn, rate, tl: tlIn } = {}) {
  const S = store.s.settings;
  const FB = 'Barlow, "Segoe UI", Roboto, Arial, sans-serif', FD = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif', FM = '"JetBrains Mono", Consolas, monospace';
  const items = itemsIn || r.items || [];
  const tl = (tlIn ?? r.tl ?? true) && !!rate;
  try { await Promise.all(['700 40px "Barlow Condensed"', '600 24px Barlow', '500 18px "JetBrains Mono"', '400 20px Barlow'].map((f) => document.fonts.load(f))); } catch {}
  const logo = await loadImg(S.brand.logo || LOGO_MARK);
  const pics = await Promise.all(items.map((it) => loadImg(thumbSrc(it, S), true)));
  const W = 1080, P = 40, TW = W - 2 * P, PAD = 18; // tablo kutusu iç boşluğu
  const priceC = S.brand.priceAccent || '#c2410c', ink = '#111827', mute = '#6b7280', soft = '#9ca3af', line = '#e5e7eb';
  // sütunlar (tablo kutusunun içinde)
  const cols = [['#', 40, 'c'], ['', 84, 'c'], ['Ürün', 0, 'l'], ['Adet', 86, 'c'], [priced(r) ? 'Fiyat' : 'Liste fiyatı', 140, 'r'], ['Tutar', 140, 'r']];
  cols[2][1] = TW - 2 * PAD - cols.reduce((n, c) => n + c[1], 0);
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = '600 23px ' + FB;
  const rows0 = items.map((it, k) => { const lines = wrap(meas, it.n, cols[2][1] - 16, 3); return { it, k, lines, h: Math.max(92, 24 + lines.length * 29 + 30) }; });
  // birden fazla resim varsa bütün satırlar aynı yükseklikte olsun (resimler aynı ölçüde çıksın)
  const rowH = Math.max(...rows0.map((r0) => r0.h), 92);
  const rows = rows0.length > PER_PAGE ? rows0.map((r0) => ({ ...r0, h: rowH })) : rows0;
  // sayfalar: en fazla 12 ürün, eşit dağıt
  const nPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const per = Math.ceil(rows.length / nPages) || 1;
  const pages = Array.from({ length: nPages }, (_, i) => rows.slice(i * per, (i + 1) * per));
  const vat0 = vatOf(totals(items, 'offer'), S.pricing.vatPct ?? 20);
  const vat = S.pricing.showVat === false ? { pct: 0 } : vat0;
  const tot = totals(items, 'offer');
  const tTL = tl ? toTL(tot, rate) : null;
  const who = r.gname || r.userName;
  const canvases = [];
  const fhOf = () => 126 + (tTL != null ? 72 : 0) + (vat.pct ? 64 : 0);
  for (let pi = 0; pi < pages.length; pi++) {
    const last = pi === pages.length - 1;
    const c = document.createElement('canvas'); c.width = W; c.height = 4000;
    const x = c.getContext('2d'); x.textBaseline = 'alphabetic';
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, c.height);
    // --- başlık
    if (logo) { x.save(); x.beginPath(); x.arc(P + 40, 76, 40, 0, Math.PI * 2); x.clip(); x.drawImage(logo, P, 36, 80, 80); x.restore(); }
    x.textAlign = 'left'; x.fillStyle = ink; x.font = '700 44px ' + FD; x.fillText(S.shop.name || '', P + 100, 76);
    x.fillStyle = mute; x.font = '400 20px ' + FB; x.fillText([S.shop.address, S.shop.phone].filter(Boolean).join(' · '), P + 100, 106);
    x.textAlign = 'right'; x.fillStyle = mute; x.font = '600 15px ' + FB; x.fillText('ÜRÜN LİSTESİ', W - P, 52);
    x.fillStyle = ink; x.font = '700 40px ' + FD; x.fillText('#' + r.no, W - P, 90);
    x.fillStyle = mute; x.font = '400 18px ' + FB; x.fillText(new Date(r.updatedAt || r.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }), W - P, 116);
    let y = 140;
    if (who || pages.length > 1) {
      x.textAlign = 'left'; x.fillStyle = '#374151'; x.font = '400 21px ' + FB;
      if (who) { x.fillText('Müşteri: ', P, y + 24); const ww = x.measureText('Müşteri: ').width; x.font = '700 21px ' + FB; x.fillText(who, P + ww, y + 24); }
      if (pages.length > 1) { x.textAlign = 'right'; x.font = '700 19px ' + FB; x.fillStyle = S.brand.accent || '#2f55b0'; x.fillText(`Sayfa ${pi + 1} / ${pages.length}`, W - P, y + 24); }
      y += 40;
    }
    y += 6;
    // --- tablo kutusu (yuvarlak köşeli)
    const THEAD = 50, bodyH = pages[pi].reduce((n, row) => n + row.h, 0), boxH = THEAD + bodyH + 8;
    const top = y;
    x.save(); rrect(x, P, top, TW, boxH, 18); x.clip();
    x.fillStyle = '#fff'; x.fillRect(P, top, TW, boxH);
    x.fillStyle = '#f1f5f9'; x.fillRect(P, top, TW, THEAD);
    x.fillStyle = '#475569'; x.font = '700 15px ' + FB;
    let cx = P + PAD;
    for (const [t, w, al] of cols) {
      x.textAlign = al === 'r' ? 'right' : al === 'c' ? 'center' : 'left';
      x.fillText(t.toLocaleUpperCase('tr'), al === 'r' ? cx + w - 8 : al === 'c' ? cx + w / 2 : cx + 8, top + 32);
      cx += w;
    }
    y = top + THEAD;
    pages[pi].forEach((row, ri) => {
      const { it, k, lines } = row;
      if (ri) { x.fillStyle = '#eef2f7'; x.fillRect(P + PAD, y, TW - 2 * PAD, 1); }
      const mid = y + row.h / 2 + 8;
      const sum = it.offer == null ? null : Number(it.offer) * it.qty;
      const cells = [String(k + 1), null, null, String(it.qty), it.offer == null ? 'Sorulacak' : fmt(it.offer, it.cur), sum == null ? '—' : fmt(sum, it.cur)];
      cx = P + PAD;
      cols.forEach(([, w, al], ci) => {
        if (ci === 1) {
          const sz = 64, ix = cx + (w - sz) / 2, iy = y + (row.h - sz) / 2;
          rrect(x, ix, iy, sz, sz, 10); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = line; x.lineWidth = 1.5; x.stroke();
          const im = pics[k];
          if (im) { x.save(); rrect(x, ix + 2, iy + 2, sz - 4, sz - 4, 8); x.clip(); const sc = Math.min((sz - 8) / im.width, (sz - 8) / im.height); const dw = im.width * sc, dh = im.height * sc; try { x.drawImage(im, ix + (sz - dw) / 2, iy + (sz - dh) / 2, dw, dh); } catch {} x.restore(); }
        } else if (ci === 2) {
          const t0 = y + row.h / 2 - (lines.length * 29 + 20) / 2 + 22;
          x.textAlign = 'left'; x.fillStyle = ink; x.font = '600 23px ' + FB;
          lines.forEach((ln, li) => x.fillText(ln, cx + 8, t0 + li * 29));
          x.fillStyle = soft; x.font = '500 16px ' + FM; x.fillText(it.k || '', cx + 8, t0 + lines.length * 29);
        } else {
          x.textAlign = al === 'r' ? 'right' : 'center';
          x.fillStyle = ci === 0 ? soft : ci === 5 ? priceC : ink;
          x.font = ci === 5 ? '700 26px ' + FD : ci === 3 ? '700 24px ' + FB : ci === 4 ? '500 23px ' + FB : '500 18px ' + FB;
          x.fillText(cells[ci], al === 'r' ? cx + w - 8 : cx + w / 2, mid);
        }
        cx += w;
      });
      y += row.h;
    });
    x.restore();
    rrect(x, P + .75, top + .75, TW - 1.5, boxH - 1.5, 18); x.strokeStyle = line; x.lineWidth = 1.5; x.stroke();
    y = top + boxH + 20;
    // --- toplam kutusu (son resimde)
    if (last) {
      // toplam kutusu: öğeler arasında rahat boşluk (etiket → tutar → TL → kur → çizgi → KDV)
      const fh = fhOf();
      rrect(x, P, y, TW, fh, 18); x.fillStyle = '#f8fafc'; x.fill();
      const R = W - P - 32;
      x.textAlign = 'left'; x.fillStyle = mute; x.font = '500 21px ' + FB;
      x.fillText(`${items.length} kalem · ${items.reduce((n, i) => n + (Number(i.qty) || 0), 0)} adet`, P + 32, y + 50);
      x.textAlign = 'right'; x.fillStyle = mute; x.font = '700 15px ' + FB; x.fillText('TOPLAM', R, y + 40);
      x.fillStyle = priceC; x.font = '700 52px ' + FD; x.fillText(fmtTotals(tot), R, y + 98);
      let fy = y + 98;
      if (tTL != null) {
        x.fillStyle = ink; x.font = '700 30px ' + FD; x.fillText('≈ ' + fmtTL(tTL), R, fy + 46);
        x.fillStyle = soft; x.font = '400 15px ' + FB; x.fillText(rateLabel(rate), R, fy + 72);
        fy += 72;
      }
      if (vat.pct) {
        x.fillStyle = line; x.fillRect(R - 560, fy + 24, 560, 1);
        const inc = fmtTotals(vat.inc) + (tTL != null ? ' (≈ ' + fmtTL(tTL * (1 + vat.pct / 100)) + ')' : '');
        x.fillStyle = mute; x.font = '400 17px ' + FB; x.fillText(`KDV %${vat.pct}  ${fmtTotals(vat.vat)}     ·     KDV dahil  ${inc}`, R, fy + 58);
      }
      y += fh + 16;
    } else {
      // devam ediyor işareti: toplam kutusuyla aynı yerde, aynı ölçüde; sayfa noktaları + ok
      const fh = fhOf();
      rrect(x, P + 1, y + 1, TW - 2, fh - 2, 16); x.setLineDash([8, 7]); x.strokeStyle = '#cbd5e1'; x.lineWidth = 2; x.stroke(); x.setLineDash([]);
      const cy = y + fh / 2, n = pages.length, gap = 26, x0 = W / 2 - ((n - 1) * gap) / 2 - 24;
      for (let d = 0; d < n; d++) { x.beginPath(); x.arc(x0 + d * gap, cy, d === pi ? 8 : 6, 0, Math.PI * 2); x.fillStyle = d === pi ? (S.brand.accent || '#2f55b0') : '#cbd5e1'; x.fill(); }
      const ax = x0 + (n - 1) * gap + 34; x.strokeStyle = S.brand.accent || '#2f55b0'; x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(ax, cy); x.lineTo(ax + 34, cy); x.moveTo(ax + 22, cy - 11); x.lineTo(ax + 34, cy); x.lineTo(ax + 22, cy + 11); x.stroke();
      y += fh + 16;
    }
    // --- alt bilgi
    x.fillStyle = soft; x.font = '400 16px ' + FB; x.textAlign = 'center';
    x.fillText(`${S.shop.name || ''}${S.shop.whatsapp ? ' · WhatsApp ' + S.shop.whatsapp : ''}${pages.length > 1 ? ` · Sayfa ${pi + 1}/${pages.length}` : ''}`, W / 2, y + 22);
    canvases.push({ c, used: Math.ceil(y + 40), footY: y });
  }
  // bütün resimler aynı yükseklikte: kısa kalanın tablosunun altı boş bırakılır, alt bilgi en alta taşınır
  const H = Math.max(...canvases.map((v) => v.used));
  const blobs = [];
  for (const v of canvases) {
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const o = out.getContext('2d'); o.fillStyle = '#fff'; o.fillRect(0, 0, W, H);
    const body = v.footY; // alt bilgi satırından önceki kısım
    o.drawImage(v.c, 0, 0, W, body, 0, 0, W, body);
    o.drawImage(v.c, 0, body, W, v.used - body, 0, H - (v.used - body), W, v.used - body);
    blobs.push(await new Promise((res) => out.toBlob(res, 'image/png')));
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
        <button className="back-btn" onClick={() => go('katalog')}><Icon n="back" s={16} />Ürünler</button>
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
        <button className="back-btn" onClick={() => go('katalog')}><Icon n="back" s={16} />Ürünler</button>
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
        <VatLines by={totals(items, 'offer')} rate={rate} className="right" />
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
      <input autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="https://ertelmarket.com/l/…" />
      {t && !c && <p className="err">Bu bir vitrin listesi linki gibi görünmüyor.</p>}
    </Sheet>
  );
}
