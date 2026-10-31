// Deneme siparişleri (31.10.2026, kullanıcı: eski siparişlerin yüklenmesini görmek için). Bekçiden geçmez → bildirim gitmez.
// Hepsi İPTAL durumunda (satışa / popüler ürünlere sayılmaz), adı "DENEME · silinecek", numarası TEST<gün>.
// node tools/test-orders.mjs ekle | sil
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const mode = process.argv[2] || 'ekle';
const AGES = [20, 45, 90, 150];
if (mode === 'sil') {
  const s = await db.collection('orders').where('test', '==', true).get();
  for (const d of s.docs) await d.ref.delete();
  console.log(`::notice title=Silindi::${s.size} deneme siparişi silindi`);
} else {
  for (const g of AGES) {
    const t = Date.now() - g * 86400000;
    await db.doc('orders/test' + g + 'gunonce000001').set({
      no: 'TEST' + g, test: true, status: 'cancelled', createdAt: t, updatedAt: t, member: false, unread: 0,
      history: [{ s: 'new', at: t }, { s: 'cancelled', at: t + 60000, by: 'admin' }],
      items: [{ id: 9000001, k: 'DENEME-01', n: 'Deneme ürünü (' + g + ' gün önce)', cur: 'USD', qty: 1, price: 1 }],
      total: { USD: 1 }, contact: { name: 'DENEME · ' + g + ' gün önce · silinecek', phone: '05000000000' },
      delivery: { method: 'pickup' }, invoice: { type: 'person', same: true }, pay: 'shop', note: 'Deneme siparişi, silinecek',
    });
  }
  console.log(`::notice title=Eklendi::${AGES.map((g) => 'TEST' + g).join(', ')}`);
}
process.exit(0);
