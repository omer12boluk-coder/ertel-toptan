// Ses efektleri (5.11.2026): kısa, yumuşak, Apple tarzı sesler — dosya indirilmez, tarayıcıda üretilir (Web Audio).
// iPhone: ses oturumu 'ambient' → yan tuşla sessize alınca site de susar (iOS 17+). Android: medya sesine bağlı.
// Kapatma: yönetim (Tasarım › Cam ve hareket › Ses efektleri = look.sound false) ya da cihazda (ls 'sfx-off', SoundButton / Hesabım).
let ctx = null;
let globalOn = true;
const LS = 'sfx-off';
const devOff = () => { try { return localStorage.getItem(LS) === '1'; } catch { return false; } };
export function setSfxGlobal(on) { globalOn = on !== false; }
// 6.11.2026 (5): ses düzeyi (look.soundVol, Tasarım › Cam ve hareket; 0.3–3, varsayılan 1.8 — eskisi 1 çok kısık bulundu)
export const SFX_VOL_DEF = 1.8;
let vol = SFX_VOL_DEF, volNode = null;
// cihaz düzeyi (6.11.2026 (6)): ses düğmesinin üstüne gelince açılan kaydırıcı; bu tarayıcıya özel çarpan (ls 'sfx-dv', 0–1.5)
let dv = (() => { try { const x = Number(localStorage.getItem('sfx-dv')); return x >= 0 && x <= 1.5 && localStorage.getItem('sfx-dv') !== null ? x : 1; } catch { return 1; } })();
const applyVol = () => { if (volNode) volNode.gain.value = vol * dv; };
export function setSfxVol(v) { const n = Number(v); vol = n > 0 ? Math.min(3, Math.max(0.3, n)) : SFX_VOL_DEF; applyVol(); }
export const sfxDevVol = () => dv;
export function setSfxDevVol(x) { dv = Math.min(1.5, Math.max(0, Number(x) || 0)); try { localStorage.setItem('sfx-dv', String(dv)); } catch {} applyVol(); }
export const sfxEnabled = () => globalOn && !devOff();
export const sfxAvailable = () => globalOn;
export function setSfxDevice(on) { try { if (on) localStorage.removeItem(LS); else localStorage.setItem(LS, '1'); } catch {} subs.forEach((f) => f()); }
const subs = new Set();
export const onSfxChange = (f) => { subs.add(f); return () => subs.delete(f); };

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}
    try { ctx = new C({ latencyHint: 'interactive' }); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
// 6.11.2026 (4): ilk sepete ekle/kaldırda takılma: ses motoru ilk seste kuruluyordu (o karede ~onlarca ms) → kullanıcının
// İLK dokunuşunda/kaydırmasında önceden kurulur (sessiz); sepete eklerken hazırdır.
if (typeof window !== 'undefined') {
  const warm = () => { if (!sfxEnabled()) return; const c = ac(); if (!c) return; try { out(c); } catch {} if (c.state === 'running') ['pointerdown', 'touchend', 'keydown'].forEach((e) => removeEventListener(e, warm, true)); };
  ['pointerdown', 'touchend', 'keydown'].forEach((e) => addEventListener(e, warm, { capture: true, passive: true }));
}
// 6.11.2026: sesler baştan — tiz/cızırtılı bulundu. Hepsi yumuşak sinüs, ana çıkışta alçak geçiren süzgeç (tizleri keser) + sıkıştırıcı;
// perdeler düşük-orta (marimba / ahşap tık gibi), saldırı 4–8 ms (tık sesi çıkmaz), kısık.
let bus = null;
function out(c) {
  if (bus && bus.context === c) return bus;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.4;
  const cp = c.createDynamicsCompressor(); cp.threshold.value = -24; cp.ratio.value = 4;
  volNode = c.createGain(); volNode.gain.value = vol * dv; lp.connect(cp).connect(volNode).connect(c.destination); bus = lp; return lp;
}
function tone(c, { f, f2, t0 = 0, d = 0.12, g = 0.05, a = 0.006, h = 0 }) {
  const t = c.currentTime + t0; const o = out(c);
  const v = c.createGain(); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(0.0001, t + d); v.connect(o);
  const osc = (fr, k) => { const x = c.createOscillator(); x.type = 'sine'; x.frequency.setValueAtTime(fr, t); if (f2) x.frequency.exponentialRampToValueAtTime(f2 * (fr / f), t + d);
    if (k !== 1) { const w = c.createGain(); w.gain.value = k; x.connect(w).connect(v); } else x.connect(v); x.start(t); x.stop(t + d + 0.03); };
  osc(f, 1); if (h) osc(f * 4, h); // marimba tınısı: temel + hafif 4. üst ses
}
const SOUNDS = {
  tap: (c) => tone(c, { f: 420, f2: 300, d: 0.05, g: 0.035, a: 0.003 }), // ahşap tık: sekme, çip, düğme
  toggle: (c) => tone(c, { f: 560, f2: 470, d: 0.06, g: 0.03, a: 0.003 }),
  add: (c) => { tone(c, { f: 210, f2: 140, d: 0.13, g: 0.08, a: 0.004, h: 0.12 }); tone(c, { f: 620, f2: 480, d: 0.035, g: 0.016, a: 0.002 }); }, // 6.11.2026 (3): tok, alçak 'tak' (telefon hoparlöründe de duyulsun diye hafif üst ses)
  remove: (c) => tone(c, { f: 170, f2: 115, d: 0.12, g: 0.075, a: 0.004, h: 0.06 }), // 6.11.2026 (5): 'ekle' gibi tok, biraz daha pes ve kısa (tiz 'tıng' kötü bulundu)
  like: (c) => tone(c, { f: 698, f2: 784, d: 0.14, g: 0.04, h: 0.1 }),
  open: (c) => tone(c, { f: 330, f2: 392, d: 0.09, g: 0.025 }),
  done: (c) => { tone(c, { f: 523, d: 0.3, g: 0.045, h: 0.1 }); tone(c, { f: 659, t0: 0.1, d: 0.32, g: 0.042, h: 0.1 }); tone(c, { f: 784, t0: 0.2, d: 0.5, g: 0.04, h: 0.08 }); },
  ding: (c) => { tone(c, { f: 784, d: 0.35, g: 0.035, h: 0.08 }); tone(c, { f: 1047, t0: 0.09, d: 0.45, g: 0.03, h: 0.06 }); },
  error: (c) => { tone(c, { f: 247, d: 0.11, g: 0.05 }); tone(c, { f: 196, t0: 0.12, d: 0.16, g: 0.05 }); },
};
let last = 0;
export function sfx(name) {
  if (!sfxEnabled()) return;
  const now = performance.now(); if ((name === 'tap' || name === 'toggle') && now - last < 70) return; last = now;
  const c = ac(); if (!c) return;
  try { SOUNDS[name]?.(c); } catch {}
}

// 6.11.2026 mağazada dokunma sesleri (kullanıcı: çoğu şeyde ses yok): sekmeler, çipler, seçim çubukları, anahtarlar, favori, geri, arama
const TAP = '.subnav > button, .ph-new, .ph-sec, .orow, .tnav-sub button, .topnav-b, .botnav-b, .seg > button, .chip, .mo-tabs > button, .view-sw > button, .of-seg > button, .back-btn, .hsearch-btn, .cat-link, .hd-i, .hd-ct, .hd-cs, .bp-tile, .icon-btn, .sh-dot, .qty button, .iq-b';
export function setupSfxTaps() {
  addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null; if (!t || !t.closest('.shell, .hd-p')) return; // 6.11.2026 (6): yönetim + bayi panelinde de
    if (t.closest('.fav-btn')) { if (!t.closest('.fav-btn').classList.contains('on')) sfx('like'); return; }
    if (t.closest('.toggle, [role=switch]')) { sfx('toggle'); return; }
    if (t.closest('.btn.add, .iq-p, .iq-m, .pbuy-btns')) return; // sepet sesleri setQty'den gelir
    const b = t.closest(TAP); if (b && !b.disabled) sfx('tap');
  }, { capture: true, passive: true });
}
