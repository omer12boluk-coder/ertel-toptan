// DHL eCommerce takip: DHL'e kaydı gönderilmiş ama takip no'su henüz gelmemiş siparişleri sorgular.
// Şube barkodu okutunca DHL kaydına takip no (MNG_GONDERI_NO) düşer → sipariş "Kargoda" + kargo bilgisi yazılır,
// müşteriye bildirim bekçiden gider (/push/status). Sadece OKUYAN DHL metodu kullanılır (KargoBilgileriByReferans).
// Ortam: FIREBASE_SERVICE_ACCOUNT, DHL_USER, DHL_PASS, WATCH_URL. Değerler asla yazdırılmaz.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const U = process.env.DHL_USER || '', P = process.env.DHL_PASS || '';
const W = (process.env.WATCH_URL || '').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');
if (!U || !P) { console.log('::warning::DHL_USER / DHL_PASS yok'); process.exit(0); }

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
async function info(ref) {
  const inner = `<pMusteriNo>${esc(U)}</pMusteriNo><pSifre>${esc(P)}</pSifre><pSiparisNo>${esc(ref)}</pSiparisNo><pGonderiNo></pGonderiNo><pFaturaSeri></pFaturaSeri><pFaturaNo></pFaturaNo><pIrsaliyeNo></pIrsaliyeNo><pEFaturaNo></pEFaturaNo><pRaporType></pRaporType>`;
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><KargoBilgileriByReferans xmlns="http://tempuri.org/">${inner}</KargoBilgileriByReferans></soap:Body></soap:Envelope>`;
  const r = await fetch('https://service.mngkargo.com.tr/musterikargosiparis/musterikargosiparis.asmx', { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://tempuri.org/KargoBilgileriByReferans"' }, body });
  const t = await r.text();
  const row = /<Table1\b[^>]*>([\s\S]*?)<\/Table1>/.exec(t); if (!row) return null;
  const o = {}; for (const m of row[1].matchAll(/<(\w+)[^>]*>([^<]*)<\/\1>/g)) o[m[1]] = m[2].trim();
  return o;
}

const OPEN = ['new', 'confirmed', 'preparing', 'shipped'];
const snap = await db.collection('orders').where('status', 'in', OPEN).get();
const todo = snap.docs.filter((d) => { const o = d.data(); return o.dhl?.ref && !o.dhl.cancelled && !o.cargo?.code; });
console.log(`açık sipariş ${snap.size}, DHL'de takip no bekleyen ${todo.length}`);
let n = 0;
for (const d of todo) {
  const o = d.data(); const ref = o.dhl.ref;
  const x = await info(ref).catch((e) => { console.log(`${ref}: hata ${e.message}`); return null; });
  if (!x) { console.log(`${ref}: DHL'de bulunamadı`); continue; }
  const code = x.MNG_GONDERI_NO || '';
  console.log(`${ref}: ${x.KARGO_STATU_ACIKLAMA || '-'}${code ? ' · takip no geldi' : ''}`);
  const dhl = { ...o.dhl, statu: x.KARGO_STATU || '', text: x.KARGO_STATU_ACIKLAMA || '', checked: Date.now() };
  if (!code) { if (!DRY && dhl.text !== o.dhl.text) await d.ref.update({ dhl }); continue; }
  const t = Date.now();
  const cargo = { company: 'DHL', code, url: x.KARGO_TAKIP_URL || `https://kargotakip.dhlecommerce.com.tr/?takipNo=${code}` };
  const upd = { cargo, dhl, updatedAt: t };
  if (o.status !== 'shipped') { upd.status = 'shipped'; upd.history = [...(o.history || []), { s: 'shipped', at: t, by: 'dhl' }]; }
  if (DRY) { console.log(`  (deneme) yazılmadı`); continue; }
  await d.ref.update(upd); n++;
  if (W) await fetch(W + '/push/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) }).catch(() => {});
  console.log(`::notice::#${o.no} kargoda, takip no ${code}`);
}
console.log(`güncellenen: ${n}`);
process.exit(0);
