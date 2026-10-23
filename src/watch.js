// Cloudflare site bekçisiyle konuşan küçük yardımcılar (adres: hosting/public/config.js → window.WATCH_URL)
import { store } from './store.js';

// Dolar kuru (Harem Altın satış): bekçi adresinden dakikada bir alınır
export function startRate(A) {
  const W = window.WATCH_URL;
  if (!W) { try { A.watchRate?.((rate) => store.set({ rate })); } catch {} return; }
  const get = async () => {
    if (document.hidden) return;
    try { const r = await fetch(W.replace(/\/$/, '') + '/rate', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j.usd > 0) store.set({ rate: j }); } } catch {}
  };
  get(); setInterval(get, 60000); document.addEventListener('visibilitychange', get);
}
// Site eşitleme: yönetim paneli açılınca sitede değişiklik var mı bakılır; "Şimdi eşitle" hemen başlatır
export async function syncNow(force) {
  const W = window.WATCH_URL;
  if (!W) throw new Error('Bekçi adresi ayarlı değil');
  const r = await fetch(W.replace(/\/$/, '') + (force ? '/sync' : '/check'), { method: 'POST' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j.result;
}


// Yeni sürüm yayınlanınca eski sayfa açık kalmasın: sekmeye geri dönüldüğünde (ya da 10 dakikada bir) kontrol edip yenile
export function startVersionCheck() {
  const cur = window.__BUILD; if (!cur) return;
  let newer = false;
  const check = async () => {
    try { const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' }); const j = await r.json(); if (j.v && j.v !== cur) newer = true; } catch {}
    if (newer && document.visibilityState === 'visible' && !document.querySelector('.set-head.dirty, .sheet')) location.reload();
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  setInterval(check, 10 * 60 * 1000);
}
