// Bekçinin servis hesabıyla Firestore'a yazabildiğini dener (gerçek sipariş YAZMAZ): _srvtest/<rastgele> oluşturup siler.
import { saToken, fsCreate } from '../worker/index.js';
const mem = new Map();
const env = { FIREBASE_SA: process.env.FIREBASE_SA, KV: { get: async (k, t) => { const v = mem.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => { mem.set(k, v); } } };
if (!env.FIREBASE_SA) { console.log('::error title=Anahtar yok::FIREBASE_SERVICE_ACCOUNT yok'); process.exit(1); }
const id = 'chk' + Date.now();
const w = await fsCreate(env, '_srvtest', id, { at: Date.now(), n: 1.5, list: [{ a: 'x' }], m: { b: true, c: null } });
console.log('::notice title=Yazma::' + JSON.stringify(w));
const tok = await saToken(env);
const FS = 'https://firestore.googleapis.com/v1/projects/erteltoptan/databases/(default)/documents/';
const g = await fetch(FS + '_srvtest/' + id, { headers: { Authorization: 'Bearer ' + tok } }); const gj = await g.json();
console.log('::notice title=Okuma::' + g.status + ' ' + JSON.stringify(gj.fields).slice(0, 300));
const d = await fetch(FS + '_srvtest/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
console.log('::notice title=Silme::' + d.status);
if (!w.ok || g.status !== 200) process.exit(1);
