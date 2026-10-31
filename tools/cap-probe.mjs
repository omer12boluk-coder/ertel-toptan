// Kapasite teşhisi (sadece okur): son 7 günün günlük Firestore okuma/yazma/silme, Cloudflare Worker/KV/R2 kullanımı,
// sipariş/üye/ürün sayıları. Hiçbir şey yazmaz, Telegram göndermez.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore();
const note = (t, m) => console.log(`::notice title=${t}::${typeof m === 'string' ? m : JSON.stringify(m)}`);
const now = new Date(); const day0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 7 * 86400e3);
async function fs(type) {
  const tok = (await app.options.credential.getAccessToken()).access_token;
  const p = new URLSearchParams({ filter: `metric.type="${type}"`, 'interval.startTime': day0.toISOString(), 'interval.endTime': now.toISOString(), 'aggregation.alignmentPeriod': '86400s', 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM' });
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${sa.project_id}/timeSeries?${p}`, { headers: { Authorization: 'Bearer ' + tok } });
  const j = await r.json(); if (!r.ok) return 'HATA ' + (j.error?.message || r.status).slice(0, 120);
  const m = {}; for (const s of j.timeSeries || []) for (const x of s.points || []) { const d = x.interval.endTime.slice(5, 10); m[d] = (m[d] || 0) + Number(x.value.int64Value || 0); }
  return Object.entries(m).sort().map(([d, v]) => d + '=' + v).join(' ');
}
for (const k of ['read_count', 'write_count', 'delete_count']) note('Firestore ' + k, await fs('firestore.googleapis.com/document/' + k));
note('Hosting indirme (Firebase)', await fs('firebasehosting.googleapis.com/network/sent_bytes_count'));
async function cf(query) { const r = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.CF_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }); const j = await r.json(); return j.data?.viewer?.accounts?.[0] || { err: j.errors }; }
const A = process.env.CF_ACCOUNT, S = day0.toISOString(), E = now.toISOString();
const w = await cf(`{viewer{accounts(filter:{accountTag:"${A}"}){workersInvocationsAdaptive(limit:500,filter:{datetime_geq:"${S}",datetime_leq:"${E}"}){sum{requests} dimensions{date scriptName}}}}}`);
const wd = {}; for (const x of w.workersInvocationsAdaptive || []) { const k = x.dimensions.date.slice(5) + ' ' + x.dimensions.scriptName; wd[k] = (wd[k] || 0) + x.sum.requests; }
note('Worker istek/gün', Object.entries(wd).sort().map(([k, v]) => k + '=' + v).join(' | ') || w.err);
const k = await cf(`{viewer{accounts(filter:{accountTag:"${A}"}){kvOperationsAdaptiveGroups(limit:500,filter:{datetime_geq:"${S}",datetime_leq:"${E}"}){sum{requests} dimensions{date actionType}}}}}`);
const kd = {}; for (const x of k.kvOperationsAdaptiveGroups || []) { const kk = x.dimensions.date.slice(5) + ' ' + x.dimensions.actionType; kd[kk] = (kd[kk] || 0) + x.sum.requests; }
note('KV/gün', Object.entries(kd).sort().map(([a, v]) => a + '=' + v).join(' | ') || k.err);
const r2 = await cf(`{viewer{accounts(filter:{accountTag:"${A}"}){r2OperationsAdaptiveGroups(limit:500,filter:{datetime_geq:"${S}",datetime_leq:"${E}"}){sum{requests} dimensions{actionType}}}}}`);
note('R2 7 gün', (r2.r2OperationsAdaptiveGroups || []).map((x) => x.dimensions.actionType + '=' + x.sum.requests).join(' ') || r2.err);
const st = await cf(`{viewer{accounts(filter:{accountTag:"${A}"}){r2StorageAdaptiveGroups(limit:10,filter:{datetime_geq:"${new Date(now - 86400e3).toISOString()}",datetime_leq:"${E}"}){max{payloadSize objectCount} dimensions{bucketName}}}}}`);
note('R2 depolama', (st.r2StorageAdaptiveGroups || []).map((x) => `${x.dimensions.bucketName}: ${(x.max.payloadSize / 1e9).toFixed(2)} GB, ${x.max.objectCount} dosya`).join(' | ') || st.err);
// sayılar
const cnt = async (c, q) => (await (q || db.collection(c)).count().get()).data().count;
const since = Date.now() - 7 * 86400e3;
note('Sayılar', { siparis: await cnt('orders'), siparis7g: await cnt(null, db.collection('orders').where('createdAt', '>=', since)), uye: await cnt('members'), bayi: await cnt('users'), talep: await cnt('requests'), lcart: await cnt('lcarts'), catalogDoc: await cnt('catalog'), pubcatalogDoc: await cnt('pubcatalog'), descDoc: await cnt('desc') });
const cat = await db.collection('pubcatalog').get(); note('Katalog boyutu', cat.docs.map((d) => d.id + ':' + Math.round(JSON.stringify(d.data()).length / 1024) + 'KB').join(' '));
process.exit(0);
