// Tek seferlik teşhis: son 6 siparişin durumu + bekçideki bildirim aboneliği (push/status yanıtı)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore(); const W = 'https://ertel-b2b-watch.omer-12boluk.workers.dev';
const qs = await db.collection('orders').orderBy('updatedAt', 'desc').limit(6).get();
for (const d of qs.docs) {
  const o = d.data();
  const r = await fetch(W + '/push/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) }).then((x) => x.text()).catch((e) => 'HATA ' + e);
  console.log(`#${o.no} ${d.id} durum=${o.status} uid=${o.uid ? 'üye' : 'misafir'} güncellendi=${new Date(o.updatedAt).toISOString()} kargo=${JSON.stringify(o.cargo || null)} → ${r}`);
}
const pub = (await db.doc('settings/public').get()).data()?.orders || {};
console.log('orders.push =', pub.push);
