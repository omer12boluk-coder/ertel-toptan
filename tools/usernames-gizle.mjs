// 23.11.2026 usernames/<ad> belgelerinden e-posta alanını kaldırır (artık sadece { uid }). Tekrar çalıştırmak zararsız.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const snap = await db.collection('usernames').get();
let n = 0; let b = db.batch(); let k = 0;
for (const d of snap.docs) if (d.data().email !== undefined) { b.update(d.ref, { email: FieldValue.delete() }); n++; if (++k === 400) { await b.commit(); b = db.batch(); k = 0; } }
if (k) await b.commit();
console.log(`::notice title=Kullanıcı adları::${snap.size} kayıt, ${n} tanesinden e-posta kaldırıldı`);
