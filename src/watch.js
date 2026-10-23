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

