// DHL'e aktar teşhisi (sadece OKUR; DHL'e kayıt açmaz, siparişe yazmaz).
// Yönetici adına oturum anahtarı alınır, bekçinin /dhl/track yolu canlı denenir, DHL SOAP doğrudan denenir,
// ertelmarket.com'daki sürüm ve simge dosyaları kontrol edilir. Ortam: FIREBASE_SERVICE_ACCOUNT, DHL_USER, DHL_PASS, ORDER_NO.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const W = 'https://ertel-b2b-watch.omer-12boluk.workers.dev';
const KEY = 'AIzaSyAb8Q747XVc1e9f_ffp6Y1uWCc8QXDSXKk';
const NO = (process.env.ORDER_NO || '').trim();
const P = process.env.DHL_PASS || '';
const clean = (s) => (P ? String(s).split(P).join('***') : String(s));
const LOG = []; const note = (t, m) => LOG.push(`${t} | ${clean(m).replace(/\n/g, ' ').slice(0, 300)}`);
const flush = () => { for (let i = 0; i < LOG.length; i += 8) console.log(`::notice title=Tarama ${i / 8 + 1}::${LOG.slice(i, i + 8).join(' ¦¦ ').replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, ' ')}`); };
async function timed(label, fn) {
  const t = Date.now();
  try { const r = await fn(); note(label, `${Date.now() - t} ms · ${r}`); }
  catch (e) { note(label, `${Date.now() - t} ms · HATA ${e.name}: ${e.message}`); }
}

// 1) site dosyaları
const M = 'https://ertelmarket.com';
const urls = ['/version.json', '/admin', '/magaza/urun/3114', '/config.js', '/sw.js', '/manifest-admin.webmanifest', '/icon-admin-180.png', '/icon-192.png', '/splash/dukkan.jpg', '/fb/firebase-app.js', '/tr/34.json', '/kalip/phones.json', '/brands/2uul.png'].map((x) => M + x)
  .concat(['https://www.ertelmarket.com/', 'https://erteltoptan.web.app/version.json', 'https://resim.ertelmarket.com/platin/_free.json', W + '/rate', W + '/push/key', W + '/']);
for (const u of urls)
  await timed('Site ' + u.replace('https://', ''), async () => { const r = await fetch(u, { signal: AbortSignal.timeout(15000) }); const ct = r.headers.get('content-type'); const b = ct?.includes('json') || ct?.includes('javascript') ? (await r.text()).slice(0, 80) : ''; const len = r.headers.get('content-length') || ''; return `${r.status} ${ct} ${len} ${r.redirected ? '→ ' + r.url : ''} ${b}`; });

// 2) sipariş
let id = '', o = null;
if (NO) {
  const s = await db.collection('orders').where('no', '==', NO).limit(1).get();
  if (!s.empty) { id = s.docs[0].id; o = s.docs[0].data(); }
}
note('Sipariş', o ? `#${NO} durum=${o.status} dhl=${JSON.stringify(o.dhl || null)} cargo=${JSON.stringify(o.cargo || null)} adres il/ilçe/adres=${!!o.delivery?.addr?.city}/${!!o.delivery?.addr?.district}/${!!o.delivery?.addr?.address} teslimat=${o.delivery?.type || o.delivery?.method || ''}` : 'bulunamadı ' + NO);

// 3) yönetici oturum anahtarı
const adm = await db.collection('users').where('role', '==', 'admin').limit(1).get();
const uid = adm.docs[0]?.id;
const ct = await getAuth().createCustomToken(uid);
const ex = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) })).json();
const token = ex.idToken; note('Oturum', token ? 'yönetici anahtarı alındı' : 'alınamadı ' + JSON.stringify(ex.error || ex));

// 4) bekçi: ön kontrol (CORS) + track
await timed('Bekçi CORS ön kontrolü', async () => { const r = await fetch(W + '/dhl/create', { method: 'OPTIONS', headers: { Origin: 'https://ertelmarket.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }, signal: AbortSignal.timeout(20000) }); return `${r.status} allow-origin=${r.headers.get('access-control-allow-origin')} allow-headers=${r.headers.get('access-control-allow-headers')} allow-methods=${r.headers.get('access-control-allow-methods')}`; });
await timed('Bekçi /dhl/create sahte anahtar', async () => { const r = await fetch(W + '/dhl/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ertelmarket.com' }, body: JSON.stringify({ token: 'x', id: 'xxxxxxxxxxxx' }), signal: AbortSignal.timeout(60000) }); return `${r.status} ${await r.text()}`; });
if (token && id) await timed('Bekçi /dhl/track (gerçek)', async () => { const r = await fetch(W + '/dhl/track', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ertelmarket.com' }, body: JSON.stringify({ token, id, col: 'orders' }), signal: AbortSignal.timeout(70000) }); return `${r.status} ${(await r.text()).slice(0, 600)}`; });

// 5) DHL doğrudan (GitHub'dan)
const ref = o?.dhl?.ref || (NO ? 'ERTEL' + NO : 'ERTELTEST');
await timed('DHL doğrudan ' + ref, async () => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const inner = `<pMusteriNo>${esc(process.env.DHL_USER)}</pMusteriNo><pSifre>${esc(P)}</pSifre><pSiparisNo>${esc(ref)}</pSiparisNo><pGonderiNo></pGonderiNo><pFaturaSeri></pFaturaSeri><pFaturaNo></pFaturaNo><pIrsaliyeNo></pIrsaliyeNo><pEFaturaNo></pEFaturaNo><pRaporType></pRaporType>`;
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><KargoBilgileriByReferans xmlns="http://tempuri.org/">${inner}</KargoBilgileriByReferans></soap:Body></soap:Envelope>`;
  const r = await fetch('https://service.mngkargo.com.tr/musterikargosiparis/musterikargosiparis.asmx', { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://tempuri.org/KargoBilgileriByReferans"' }, body, signal: AbortSignal.timeout(40000) });
  const t = await r.text(); const row = /<Table1\b[^>]*>([\s\S]*?)<\/Table1>/.exec(t);
  return `${r.status} ${row ? 'KAYIT VAR: ' + row[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300) : 'kayıt yok · ' + t.replace(/<xs:schema[\s\S]*?<\/xs:schema>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200)}`;
});
flush(); process.exit(0);
