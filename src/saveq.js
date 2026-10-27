// Arka planda kayıt kuyruğu (28.10.2026): "Kaydet"e basınca ekran HEMEN güncellenir ve kapanır, kayıt arkada sırayla yapılır.
// - aynı anahtarlı bekleyen kayıt birleşir (ör. 'catalog': çalışma anında en güncel katalog yazılır)
// - hata olursa 3, 6, 9 sn sonra yeniden dener; olmazsa "Kaydedilemedi · Tekrar dene" kalır, veri ekranda durur
// - kayıt bitmeden sayfa kapatılmak istenirse tarayıcı uyarır
// Durum store.qs: 'saving' | 'saved' | 'error' (SaveDock gösterir)
import { store, toast } from './store.js';

const jobs = [];
let running = false, fails = 0;
export function queueSave(key, run) {
  const i = jobs.findIndex((j) => j.key === key && !j.started);
  if (i >= 0) jobs.splice(i, 1);
  jobs.push({ key, run });
  store.set({ qs: 'saving' });
  pump();
}
async function pump() {
  if (running) return; running = true;
  while (jobs.length) {
    const j = jobs[0]; j.started = true; store.set({ qs: 'saving' });
    try { await j.run(); jobs.shift(); fails = 0; }
    catch (e) {
      j.started = false; fails++; running = false;
      store.set({ qs: 'error', qsErr: e?.message || String(e) });
      if (fails <= 3) setTimeout(pump, 3000 * fails); else toast('Kaydedilemedi: ' + (e?.message || e), 'bad');
      return;
    }
  }
  running = false;
  store.set({ qs: 'saved' });
  setTimeout(() => { if (store.s.qs === 'saved' && !jobs.length) store.set({ qs: null }); }, 2200);
}
export const retrySave = () => { fails = 0; pump(); };
export const savesPending = () => jobs.length > 0;
if (typeof window !== 'undefined') addEventListener('beforeunload', (e) => { if (jobs.length) { e.preventDefault(); e.returnValue = ''; } });
