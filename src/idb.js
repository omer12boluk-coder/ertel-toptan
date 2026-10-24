// Cihazda büyük veri saklama (katalog vb.). localStorage ~5 MB ile sınırlı ve yavaş;
// IndexedDB çok daha büyük veriyi metne çevirmeden saklar. Hata olursa sessizce boş döner.
const DB = 'ertel-b2b', ST = 'kv';
let dbp = null;
function open() {
  if (!dbp) dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
      setTimeout(() => res(null), 3000); // bazı uygulama içi tarayıcılarda IndexedDB hiç cevap vermiyor
    } catch { res(null); }
  });
  return dbp;
}
export async function idbGet(k) {
  const db = await open(); if (!db) return undefined;
  return new Promise((res) => {
    setTimeout(() => res(undefined), 2500); // takılırsa boş say
    try { const q = db.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }
    catch { res(undefined); }
  });
}
export async function idbSet(k, v) {
  const db = await open(); if (!db) return false;
  return new Promise((res) => {
    setTimeout(() => res(false), 4000);
    try { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }
    catch { res(false); }
  });
}
export async function idbDel(k) {
  const db = await open(); if (!db) return;
  try { db.transaction(ST, 'readwrite').objectStore(ST).delete(k); } catch {}
}
