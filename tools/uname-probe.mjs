// Kullanıcı adıyla giriş denetimi (sadece okur + bir YANLIŞ şifre denemesi): özetle verilen hesabın kullanıcı adıyla bekçiye sorar.
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const note = (t, m) => console.log(`::notice title=${t}::${m}`);
const W = (readFileSync('hosting/public/config.js', 'utf8').match(/WATCH_URL\s*=\s*"([^"]+)"/) || [])[1];
const want = String(process.env.HASH || '').toLowerCase();
let user = null, next;
do { const r = await getAuth().listUsers(1000, next); user = r.users.find((u) => createHash('sha256').update(String(u.email || '').toLowerCase()).digest('hex') === want) || user; next = user ? undefined : r.pageToken; } while (next);
if (!user) { note('hata', 'hesap bulunamadı'); process.exit(0); }
const m = (await getFirestore().doc('members/' + user.uid).get()).data() || {};
const un = m.username; if (!un) { note('hata', 'kullanıcı adı yok'); process.exit(0); }
const post = (p, b) => fetch(W + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ertelmarket.com' }, body: JSON.stringify(b) }).then((r) => r.json());
note('yanlış şifre', JSON.stringify(await post('/member/login-id', { id: un, pw: 'yanlis-sifre-deneme-' + Date.now() })));
note('olmayan ad', JSON.stringify(await post('/member/login-id', { id: 'yokboyle' + Date.now() % 1e6, pw: 'x' })));
note('boş ad kontrolü', JSON.stringify(await post('/member/uname-free', { names: [un, 'ertelgsm', 'zzdeneme' + Date.now() % 1e6] })).replace(un, '<ad>'));
const u = await getFirestore().collection('usernames').limit(400).get();
note('kayıtlar', `${u.size} kullanıcı adı, ${u.docs.filter((d) => d.data().email).length} tanesinde e-posta var`);
