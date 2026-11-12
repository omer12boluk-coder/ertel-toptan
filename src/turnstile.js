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
// 12.11.2026: 'Siparişi tamamla'ya basınca servis SIFIRDAN yükleniyor + kontrol çalışıyordu → bekleme ekranı birkaç saniye takılı
// kalıyordu. Artık ödeme sayfası açılınca (tsPrefetch) arka planda hazırlanır; basınca hazır jeton kullanılır (jeton ~5 dk geçerli,
// 4 dk'dan eskiyse yenisi alınır). Önceden hazırlarken Cloudflare soru sormak isterse (kutu) vazgeçilir; basınca eskisi gibi kutu çıkar.
let pre = null;
export function tsPrefetch() {
  if (!tsOn() || (pre && Date.now() - pre.at < 240000)) return;
  const p = getTok(90000, true); pre = { at: Date.now(), p };
  p.then((v) => { if (!v && pre?.p === p) pre = null; });
}
export async function tsToken(ms = 90000) {
  if (!tsOn()) return null;
  if (pre && Date.now() - pre.at < 240000) { const p = pre.p; pre = null; const v = await p; if (v) return v; }
  pre = null;
  return getTok(ms, false);
}
async function getTok(ms, quiet) {
  let T; try { T = await Promise.race([load(), new Promise((_, r) => setTimeout(() => r(new Error('ts')), 10000))]); } catch { return null; }
  let box = document.getElementById('ts-box');
  if (!box) {
    box = document.createElement('div'); box.id = 'ts-box'; box.className = 'ts-box';
    box.innerHTML = '<b>Güvenlik kontrolü</b><span>Siparişinizi tamamlamak için kutuyu işaretleyin.</span><div class="ts-w"></div>';
    document.body.appendChild(box);
  }
  // sessiz hazırlık kendi gizli kutusunda (ekranda hiçbir şey çıkmaz)
  let w = box.querySelector('.ts-w');
  if (quiet) { w = document.createElement('div'); w.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden'; document.body.appendChild(w); }
  return new Promise((ok) => {
    let done = false, wid = null;
    const fin = (v) => { if (done) return; done = true; clearTimeout(t); if (!quiet) box.classList.remove('on'); try { if (wid != null) T.remove(wid); } catch {} if (quiet) w.remove(); ok(v); };
    const t = setTimeout(() => fin(null), ms);
    try {
      wid = T.render(w, { sitekey: SITE_KEY, appearance: 'interaction-only', language: 'tr', action: 'order',
        callback: (tok) => fin(tok), 'error-callback': () => { fin(null); return true; }, 'expired-callback': () => fin(null),
        'before-interactive-callback': () => (quiet ? fin(null) : box.classList.add('on')) });
    } catch { fin(null); }
  });
}
