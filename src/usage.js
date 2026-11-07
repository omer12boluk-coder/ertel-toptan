// Kullanım sayacı (8.11.2026): Google ücretsiz planda Firestore okuma sayısını dışarı vermiyor → uygulama kendi yaptığı
// okuma / yazmaları koleksiyon bazında sayar, bekçiye (/m) gönderir; bekçi Cloudflare Analytics Engine'e yazar (Firestore'a
// ve KV'ye HİÇ yazmaz). Yönetim › Kullanım sayfası bunları gösterir. Sayılar YAKLAŞIK: Firestore'un kendi ölçümü değil.
// Okuma kuralı: getDoc 1 · getDocs belge sayısı (en az 1) · canlı dinleme ilk sunucu cevabı belge sayısı, sonra değişen belge
// sayısı · sayı sorgusu 1000 belge başına 1. Önbellekten gelen cevaplar sayılmaz.
const C = {};
let area = '', uid = '', name = '', visit = 0, inited = false;
const W = () => String(window.WATCH_URL || '').replace(/\/$/, '');

export function meterAdd(col, r, w) {
  if (!inited) return;
  col = String(col || '?').slice(0, 24);
  const x = C[col] || (C[col] = [0, 0]);
  x[0] += r || 0; x[1] += w || 0;
}
export function meterUser(u) { uid = (u && u.role === 'admin' && u.uid) || ''; name = (u && u.role === 'admin' && (u.name || u.username)) || ''; }

function flush(beacon) {
  const ks = Object.keys(C);
  if (!ks.length && !visit) return;
  const c = {}; for (const k of ks) { c[k] = C[k]; delete C[k]; }
  const body = JSON.stringify({ a: area, u: uid, n: name, v: visit, c });
  visit = 0;
  const url = W() + '/m'; if (!W()) return;
  try {
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' })); return; }
    fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch {}
}

// a: 'panel' | 'magaza' | 'bayi'
export function meterInit(a) {
  if (inited || typeof window === 'undefined') return;
  inited = true; area = a; visit = 1;
  setInterval(() => flush(false), (a === 'panel' ? 5 : 10) * 60e3);
  addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
}

const colOf = (x) => {
  try {
    if (!x) return '?';
    if (x.__col) return x.__col;
    if (x.type === 'collection') return x.id;
    if (x.type === 'document') return String(x.path).split('/').slice(-2)[0];
    const seg = x._query?.path?.segments; if (seg?.length) return seg[seg.length - 1];
  } catch {}
  return '?';
};

// Firestore modülünü sarar (backend-firebase.js init). Davranış AYNI, sadece sayar.
export function meterFs(F) {
  const G = { ...F };
  G.collection = (...a) => { const r = F.collection(...a); try { r.__col = r.id; } catch {} return r; };
  G.query = (ref, ...c) => { const q = F.query(ref, ...c); try { q.__col = colOf(ref); } catch {} return q; };
  const read1 = (fn) => async (ref, ...a) => { const s = await fn(ref, ...a); try { if (!s.metadata?.fromCache) meterAdd(colOf(ref), 1, 0); } catch {} return s; };
  const readN = (fn) => async (q, ...a) => { const s = await fn(q, ...a); try { if (!s.metadata?.fromCache) meterAdd(colOf(q), Math.max(1, s.size || 0), 0); } catch {} return s; };
  G.getDoc = read1(F.getDoc);
  if (F.getDocFromServer) G.getDocFromServer = read1(F.getDocFromServer);
  G.getDocs = readN(F.getDocs);
  if (F.getDocsFromServer) G.getDocsFromServer = readN(F.getDocsFromServer);
  if (F.getCountFromServer) G.getCountFromServer = async (q) => { const r = await F.getCountFromServer(q); try { meterAdd(colOf(q), Math.max(1, Math.ceil((r.data().count || 0) / 1000)), 0); } catch {} return r; };
  G.onSnapshot = (ref, ...rest) => {
    const col = colOf(ref); let first = true;
    const tap = (s) => {
      try {
        if (s.metadata?.fromCache || s.metadata?.hasPendingWrites) return;
        let n;
        if (s.docs) n = first ? Math.max(1, s.size || 0) : s.docChanges().length;
        else n = 1; // tek belge
        first = false;
        if (n) meterAdd(col, n, 0);
      } catch {}
    };
    const i = rest.findIndex((x) => typeof x === 'function');
    if (i >= 0) { const cb = rest[i]; rest[i] = (s) => { tap(s); return cb(s); }; }
    else if (rest[0] && typeof rest[0].next === 'function') { const o = rest[0]; rest[0] = { ...o, next: (s) => { tap(s); return o.next(s); } }; }
    return F.onSnapshot(ref, ...rest);
  };
  const write1 = (fn) => async (ref, ...a) => { const r = await fn(ref, ...a); meterAdd(colOf(ref), 0, 1); return r; };
  G.setDoc = write1(F.setDoc); G.updateDoc = write1(F.updateDoc); G.deleteDoc = write1(F.deleteDoc);
  if (F.addDoc) G.addDoc = write1(F.addDoc);
  G.writeBatch = (db) => {
    const b = F.writeBatch(db); const cnt = {};
    const add = (ref) => { const k = colOf(ref); cnt[k] = (cnt[k] || 0) + 1; };
    for (const m of ['set', 'update', 'delete']) { const f = b[m].bind(b); b[m] = (ref, ...a) => { add(ref); f(ref, ...a); return b; }; }
    const commit = b.commit.bind(b);
    b.commit = async () => { const r = await commit(); for (const k in cnt) meterAdd(k, 0, cnt[k]); return r; };
    return b;
  };
  return G;
}
