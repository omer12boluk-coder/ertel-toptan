// Yedek durdurma düğmesi (GitHub › Actions › "Ücretli kullanımı durdur" › Run workflow): projenin fatura hesabı bağlantısını
// keser → ücretsiz plan sınırlarına döner, veri silinmez. Yönetim panelindeki düğme çalışmazsa telefondan GitHub uygulamasıyla.
import { initializeApp, cert } from 'firebase-admin/app';
import crypto from 'node:crypto';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = initializeApp({ credential: cert(sa) });
const tok = (await app.options.credential.getAccessToken()).access_token;
const u = `https://cloudbilling.googleapis.com/v1/projects/${sa.project_id}/billingInfo`;
const cur = await (await fetch(u, { headers: { Authorization: 'Bearer ' + tok } })).json();
if (!cur.billingEnabled) { console.log('::notice title=Zaten durdurulmuş::Projede ücretli plan açık değil.'); process.exit(0); }
const r = await fetch(u, { method: 'PUT', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ billingAccountName: '' }) });
const j = await r.json().catch(() => ({}));
if (!r.ok) { console.log(`::error title=Durdurulamadı::${j.error?.message || r.status} → Firebase › Kullanım ve faturalandırma › planı Spark'a düşürün`); process.exit(1); }
console.log('::notice title=Durduruldu::Ücretli kullanım kapatıldı (fatura hesabı ayrıldı). Geri açmak: Firebase › Kullanım ve faturalandırma › Blaze.');
const key = crypto.createHash('sha256').update('sync:' + process.env.TELEGRAM_TOKEN).digest('hex');
await fetch(process.env.WATCH_URL + '/notify-usage', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Key': key }, body: JSON.stringify({ text: '🛑 Ücretli kullanım GitHub üzerinden durduruldu. Site ücretsiz plan sınırlarına döndü, veriler duruyor.' }) }).catch(() => {});
