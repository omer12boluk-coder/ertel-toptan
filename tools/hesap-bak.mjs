// Hesap teşhisi (sadece okur): e-postaların SHA-256 özetleri verilir (repo herkese açık, günlükte e-posta görünmesin); Firebase giriş hesabı + üye kaydı. Repo herkese açık → e-posta / kimlik maskelenir.
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const auth = getAuth(); const db = getFirestore();
const note = (t, m) => console.log(`::notice title=${t}::${m}`);
const mask = (e) => String(e || '').replace(/^(.)[^@]*(.)@/, '$1***$2@');
const P = { password: 'şifre', 'google.com': 'Google', 'facebook.com': 'Facebook' };
const d = (t) => (t ? new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '—');
import { createHash } from 'node:crypto';
const want = new Set(String(process.env.HASHES || '').split(/[\s,]+/).filter(Boolean).map((x) => x.toLowerCase()));
const found = new Map(); let next;
do { const r = await auth.listUsers(1000, next); for (const u of r.users) { const h = createHash('sha256').update(String(u.email || '').toLowerCase()).digest('hex'); if (want.has(h)) found.set(h, u); } next = r.pageToken; } while (next);
for (const h of want) if (!found.has(h)) note('özet ' + h.slice(0, 6), 'Giriş hesabı YOK');
for (const u of found.values()) {
  const e = String(u.email).toLowerCase(); const t = mask(e);
  const m = await db.doc('members/' + u.uid).get();
  const staff = (await db.doc('users/' + u.uid).get()).exists;
  const same = await db.collection('members').where('email', '==', e).get();
  const orders = await db.collection('orders').where('uid', '==', u.uid).limit(50).get();
  note(t, [
    'giriş: ' + (u.providerData.map((p) => P[p.providerId] || p.providerId).join(' + ') || '—'),
    'onaylı: ' + (u.emailVerified ? 'evet' : 'HAYIR'),
    'açılış: ' + d(u.metadata.creationTime), 'son giriş: ' + d(u.metadata.lastSignInTime),
    'üye kaydı: ' + (m.exists ? 'var' + (m.data().username ? ' (kullanıcı adı var)' : '') + (m.data().byAdmin ? ' (panelden)' : '') : 'YOK'),
    staff ? 'bayi/ekip hesabı da' : '',
    'bu e-postalı üye kaydı sayısı: ' + same.size,
    'siparişi: ' + orders.size,
  ].filter(Boolean).join(' · '));
}
