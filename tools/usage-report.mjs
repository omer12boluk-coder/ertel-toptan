// Günlük kullanım raporu (31.10.2026): son 24 saatte Firestore okuma/yazma (Google Cloud Monitoring), Cloudflare Worker
// istekleri ve KV yazmaları → meta/usage (Ayarlar > Veri ve kota'da görünür) + Telegram (Ayarlar'dan kapatılabilir).
// Ortam: FIREBASE_SERVICE_ACCOUNT, CF_TOKEN, CF_ACCOUNT, TELEGRAM_TOKEN, WATCH_URL. Sadece okur (meta/usage hariç).
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'node:crypto';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore();
const now = new Date(), from = new Date(now - 24 * 3600e3);
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, ' ')}`);

async function fsMetric(type) {
  const tok = (await app.options.credential.getAccessToken()).access_token;
  const p = new URLSearchParams({ filter: `metric.type="${type}"`, 'interval.startTime': from.toISOString(), 'interval.endTime': now.toISOString(), 'aggregation.alignmentPeriod': '86400s', 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM' });
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${sa.project_id}/timeSeries?${p}`, { headers: { Authorization: 'Bearer ' + tok } });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status);
  return (j.timeSeries || []).reduce((a, s) => a + (s.points || []).reduce((b, x) => b + Number(x.value.int64Value || x.value.doubleValue || 0), 0), 0);
}
async function cf(query) {
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.CF_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  return (await r.json()).data?.viewer?.accounts?.[0] || {};
}
const out = { at: Date.now() };
for (const [k, t] of [['read', 'firestore.googleapis.com/document/read_count'], ['write', 'firestore.googleapis.com/document/write_count'], ['del', 'firestore.googleapis.com/document/delete_count']]) {
  try { out[k] = await fsMetric(t); } catch (e) { note('Firestore ' + k, 'okunamadı: ' + e.message); }
}
try {
  const A = process.env.CF_ACCOUNT, S = from.toISOString(), E = now.toISOString();
  const w = await cf(`{viewer{accounts(filter:{accountTag:"${A}"}){workersInvocationsAdaptive(limit:50,filter:{datetime_geq:"${S}",datetime_leq:"${E}"}){sum{requests}}}}}`);
  out.cfReq = (w.workersInvocationsAdaptive || []).reduce((a, x) => a + (x.sum?.requests || 0), 0);
  const k = await cf(`{viewer{accounts(filter:{accountTag:"${A}"}){kvOperationsAdaptiveGroups(limit:50,filter:{datetime_geq:"${S}",datetime_leq:"${E}"}){sum{requests} dimensions{actionType}}}}}`);
  out.kvWrite = (k.kvOperationsAdaptiveGroups || []).filter((x) => /write|delete/.test(x.dimensions?.actionType)).reduce((a, x) => a + (x.sum?.requests || 0), 0);
} catch (e) { note('Cloudflare', 'okunamadı: ' + e.message); }
note('Kullanım', JSON.stringify(out));
await db.doc('meta/usage').set(out);

// Telegram (Ayarlar > Veri ve kota > Günlük rapor)
const S = (await db.doc('settings/main').get()).data() || {};
if (S.quota?.report !== false && process.env.TELEGRAM_TOKEN) {
  const pct = (v, lim) => (v == null ? '—' : `${v.toLocaleString('tr-TR')} / ${lim.toLocaleString('tr-TR')} (%${Math.round((v / lim) * 100)})`);
  const warn = (v, lim) => (v != null && v / lim >= 0.7 ? ' ⚠️' : '');
  const text = `📊 Günlük kullanım (son 24 saat)\n\n` +
    `Veritabanı okuma: ${pct(out.read, 50000)}${warn(out.read, 50000)}\n` +
    `Veritabanı yazma: ${pct(out.write, 20000)}${warn(out.write, 20000)}\n` +
    `Bekçi istekleri: ${pct(out.cfReq, 100000)}${warn(out.cfReq, 100000)}\n` +
    `Bekçi kayıt (KV): ${pct(out.kvWrite, 1000)}${warn(out.kvWrite, 1000)}\n\n` +
    `%70'i geçen satırda ⚠️ var. Ayar: Yönetim › Ayarlar › Veri ve kota`;
  const key = crypto.createHash('sha256').update('sync:' + process.env.TELEGRAM_TOKEN).digest('hex');
  const r = await fetch(process.env.WATCH_URL + '/notify-usage', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Key': key }, body: JSON.stringify({ text }) });
  note('Telegram', r.status + ' ' + (await r.text()).slice(0, 100));
}
process.exit(0);
