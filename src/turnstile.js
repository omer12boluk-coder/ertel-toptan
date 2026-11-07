// Robot koruması (Cloudflare Turnstile, 7.11.2026). Sadece ertelmarket.com'da çalışır (demo / önizleme / web.app'te jetonsuz).
// Görünmez: Cloudflare şüphelenmezse ekranda hiçbir şey çıkmaz. Şüphelenirse alt ortada küçük bir 'Güvenlik kontrolü' kutusu açılır.
// Jeton tek kullanımlık; her sipariş gönderiminde yenisi alınır, bekçi (/order) Cloudflare'e doğrulatır.
const SITE_KEY = '0x4AAAAAAF3qqfRTCcf1Q-iX';
let loadP = null;
const load = () => loadP || (loadP = new Promise((ok, bad) => {
  if (window.turnstile) return ok(window.turnstile);
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
  s.onload = () => (window.turnstile ? ok(window.turnstile) : bad(new Error('ts')));
  s.onerror = () => { loadP = null; bad(new Error('ts')); };
  document.head.appendChild(s);
}));
export const tsOn = () => /(^|\.)ertelmarket\.com$/.test(location.hostname);
// jeton | null (servis yüklenemedi / süre doldu → bekçi geçiş süresinde kabul eder)
export async function tsToken(ms = 90000) {
  if (!tsOn()) return null;
  let T; try { T = await Promise.race([load(), new Promise((_, r) => setTimeout(() => r(new Error('ts')), 10000))]); } catch { return null; }
  let box = document.getElementById('ts-box');
  if (!box) {
    box = document.createElement('div'); box.id = 'ts-box'; box.className = 'ts-box';
    box.innerHTML = '<b>Güvenlik kontrolü</b><span>Siparişinizi tamamlamak için kutuyu işaretleyin.</span><div class="ts-w"></div>';
    document.body.appendChild(box);
  }
  const w = box.querySelector('.ts-w');
  return new Promise((ok) => {
    let done = false, wid = null;
    const fin = (v) => { if (done) return; done = true; clearTimeout(t); box.classList.remove('on'); try { if (wid != null) T.remove(wid); } catch {} ok(v); };
    const t = setTimeout(() => fin(null), ms);
    try {
      wid = T.render(w, { sitekey: SITE_KEY, appearance: 'interaction-only', language: 'tr', action: 'order',
        callback: (tok) => fin(tok), 'error-callback': () => { fin(null); return true; }, 'expired-callback': () => fin(null),
        'before-interactive-callback': () => box.classList.add('on') });
    } catch { fin(null); }
  });
}
