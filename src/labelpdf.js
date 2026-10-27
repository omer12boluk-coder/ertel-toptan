// Telefonda kargo etiketi: iPhone ana ekran uygulamasında (ve bazı Android tarayıcılarda) window.print() hiç çalışmıyor.
// Bu yüzden etiket tuvale (canvas) çizilir → 4×6 inç tek sayfalık PDF yapılır → paylaş menüsü açılır (Yazdır / Kaydet / AirPrint).
// Kütüphane yok: PDF'in içinde sadece bir JPEG resim var (DCTDecode).
import { code128bars } from './barcode.js';

const DPI = 300, W = 4 * DPI, H = 6 * DPI, K = DPI / 96; // CSS px → etiket pikseli

function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines.length ? lines : [''];
}
function barcode(ctx, text, x, y, w, h) {
  const { bars, width } = code128bars(text, 10); const m = w / width;
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#000';
  for (const b of bars) ctx.fillRect(Math.round(x + b.x * m), y, Math.max(1, Math.round(b.w * m)), h);
}

// Etiket bilgisi: dhlLabelHtml ile aynı içerik
export function drawLabel(o, S) {
  const d = o.dhl || {}; const a = o.delivery?.addr || {};
  const up = (x) => String(x || '').toLocaleUpperCase('tr-TR');
  const from = S.footer?.company || S.shop?.name || S.brand?.appName || 'ERTEL GSM';
  const date = new Date(d.at || Date.now()).toLocaleDateString('tr-TR');
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#000'; ctx.textBaseline = 'top';
  const F = (px, b) => (ctx.font = `${b ? '700 ' : ''}${Math.round(px * K)}px Arial, Helvetica, sans-serif`);
  const L = 0.14 * DPI, R = W - L, CW = R - L; let y = 0.16 * DPI;
  // üst yazılar
  F(8.2, 1); ctx.textAlign = 'center'; ctx.fillText('Online Şube Müşteri Portalı Siparişten Gönderi Hazırlama Barkodu', W / 2, y, CW); y += 12 * K;
  F(6.6); for (const l of wrap(ctx, 'Bu barkodu Şube.net → Fatura İşlemleri → Siparişten Gönderi Hazırlama bölümünde "Müşteri Barkod" alanına okutarak gönderi hazırlayınız', CW)) { ctx.fillText(l, W / 2, y, CW); y += 8.6 * K; }
  y += 6 * K;
  // başlık: logo, büyük barkod, tarih
  const hy = y; ctx.fillStyle = '#ffcc00'; ctx.fillRect(L, hy + 0.04 * DPI, 0.5 * DPI, 0.34 * DPI);
  ctx.fillStyle = '#d40511'; ctx.font = `italic 900 ${Math.round(12 * K)}px Arial`; ctx.fillText('DHL', L + 0.25 * DPI, hy + 0.04 * DPI + 0.1 * DPI);
  ctx.fillStyle = '#000'; const bw = 2.1 * DPI, bx = L + 0.66 * DPI; barcode(ctx, d.ref, bx, hy, bw, 0.5 * DPI);
  ctx.font = `700 ${Math.round(9 * K)}px "Courier New", monospace`; ctx.fillText(String(d.ref || ''), bx + bw / 2, hy + 0.52 * DPI);
  ctx.textAlign = 'right'; F(10, 1); ctx.fillText('Gönderi Tarihi', R, hy + 0.08 * DPI); ctx.fillText(date, R, hy + 0.3 * DPI);
  ctx.textAlign = 'left'; y = hy + 0.52 * DPI + 14 * K + 6 * K;
  ctx.lineWidth = 1.2 * K;
  const box = (title, rows, opt = {}) => {
    const top = y; let yy = y;
    if (title != null) { F(9.5, 1); ctx.fillText(title, L + 6 * K, yy + 3 * K); if (opt.right) { ctx.textAlign = 'right'; ctx.fillText(opt.right, R - 6 * K, yy + 3 * K); ctx.textAlign = 'left'; } yy += 16 * K; if (rows.length || opt.body) { ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); } }
    yy += rows.length ? 2 * K : 0;
    for (const r of rows) {
      const fs = r.fs || 7.6; let h = 0;
      F(fs > 9 ? 9 : 7.6, 1); ctx.fillText(r.k, L + 6 * K, yy + 2 * K + (fs > 9 ? 2 * K : 0));
      const vx = L + 6 * K + 0.95 * DPI; F(fs, r.b); const lines = wrap(ctx, r.v, R - 6 * K - vx);
      lines.forEach((l, i) => ctx.fillText(l, vx, yy + 2 * K + i * fs * 1.25 * K)); h = Math.max(fs * 1.25 * K * lines.length, 11 * K) + 4 * K; yy += h;
    }
    if (opt.body) { F(6.6); for (const l of opt.body) for (const ll of wrap(ctx, l, CW - 12 * K)) { ctx.fillText(ll, L + 6 * K, yy + 4 * K); yy += 9 * K; } yy += 6 * K; }
    if (opt.after) yy = opt.after(top, yy);
    ctx.strokeRect(L, top, CW, yy - top); y = yy + 0.06 * DPI;
  };
  box('Gönderici Bilgileri', [{ k: 'Gönderen:', v: up(from) }]);
  box('Gön. Notu: ' + (d.note || ''), []);
  box(null, [
    { k: 'Alıcı:', v: a.name || o.contact?.name, fs: 12, b: 1 },
    { k: 'Telefon:', v: a.phone || o.contact?.phone, fs: 9 },
    { k: 'Adres:', v: [a.hood, a.address].filter(Boolean).join(' '), fs: 9 },
    { k: 'İlçe / İl:', v: `${up(a.district)} / ${up(a.city)}`, fs: 12, b: 1 },
  ]);
  box('Gönderi Bilgileri', [], { right: 'Referans No: ' + (d.ref || ''), after: (top, yy) => {
    const c1 = L + 6 * K, c2 = c1 + 0.95 * DPI, c3 = L + CW * 0.6, c4 = c3 + 0.95 * DPI; yy += 4 * K;
    const row = (k1, v1, k2, v2, hh = 13 * K) => { F(7.6, 1); ctx.fillText(k1, c1, yy); ctx.fillText(k2, c3, yy); F(7.6); if (v1) ctx.fillText(v1, c2, yy, c3 - c2 - 4 * K); ctx.fillText(v2, c4, yy, R - c4 - 4 * K); yy += hh; };
    barcode(ctx, d.ref, c2, yy, Math.min(1.25 * DPI, c3 - c2 - 10 * K), 0.2 * DPI); row('Referans Barkod:', '', 'Parça No:', '1', 0.2 * DPI + 4 * K);
    row('Toplam Adet:', '1', 'Toplam Kg/Desi:', `${d.kg || 1} / ${d.desi || 1}`);
    row('Gönderi İçerik:', [d.pkg, d.icerik].filter(Boolean).join(' · '), 'Sipariş:', '#' + (o.no || ''));
    return yy;
  } });
  // ödeme
  F(10, 1); const pt = d.pay === 'P' ? 'GÖNDERİCİ ÖDEMELİ' : 'ALICI ÖDEMELİ'; const pw = ctx.measureText(pt).width + 12 * K;
  ctx.lineWidth = 1.5 * K; ctx.strokeRect(L, y, pw, 17 * K); ctx.fillText(pt, L + 6 * K, y + 3.5 * K); y += 17 * K + 0.06 * DPI; ctx.lineWidth = 1.2 * K;
  box('Koşullar', [], { body: ['1. Hazırlanan gönderiler teslim tutanağı ile DHL eCommerce yetkilisine teslim edilmelidir.', '2. Kg/Desi ve adet bilgileri şubedeki ölçüm ve tartıma göre şube tarafından düzeltilebilir.', '3. Mevzuat gereği taşınması yasak ürünler taşıyıcıya teslim edilemez.'] });
  return c;
}

// Tuval → 4×6 inç PDF (Blob)
export async function canvasPdf(canvas, paper = 'a6') {
  const jpg = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.95))).arrayBuffer());
  const enc = new TextEncoder(); const parts = []; const offs = []; let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  // A6 = etiketin kendisi (10×15 cm); A4 = normal yazıcı: etiket sayfaya orantılı büyütülüp ortalanır
  const [pw, ph] = paper === 'a4' ? [595, 842] : [288, 432]; const m = paper === 'a4' ? 24 : 0;
  const sc = Math.min((pw - 2 * m) / 288, (ph - 2 * m) / 432); const iw = Math.round(288 * sc), ih = Math.round(432 * sc);
  const content = `q ${iw} 0 0 ${ih} ${Math.round((pw - iw) / 2)} ${Math.round((ph - ih) / 2)} cm /Im0 Do Q`;
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${offs.slice(1).map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

export async function labelPdf(o, S, paper) { return canvasPdf(drawLabel(o, S), paper); }
export const needsPdfPrint = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
