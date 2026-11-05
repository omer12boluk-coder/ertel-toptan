// Ses efektleri (5.11.2026): kısa, yumuşak, Apple tarzı sesler — dosya indirilmez, tarayıcıda üretilir (Web Audio).
// iPhone: ses oturumu 'ambient' → yan tuşla sessize alınca site de susar (iOS 17+). Android: medya sesine bağlı.
// Kapatma: yönetim (Tasarım › Cam ve hareket › Ses efektleri = look.sound false) ya da cihazda (ls 'sfx-off', SoundButton / Hesabım).
let ctx = null;
let globalOn = true;
const LS = 'sfx-off';
const devOff = () => { try { return localStorage.getItem(LS) === '1'; } catch { return false; } };
export function setSfxGlobal(on) { globalOn = on !== false; }
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
function tone(c, { f, f2, t0 = 0, d = 0.08, type = 'sine', g = 0.05, a = 0.004 }) {
  const t = c.currentTime + t0;
  const o = c.createOscillator(); const v = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(v).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
}
const SOUNDS = {
  tap: (c) => tone(c, { f: 1900, f2: 1500, d: 0.028, type: 'triangle', g: 0.018 }),
  add: (c) => { tone(c, { f: 880, f2: 1320, d: 0.07, g: 0.045 }); tone(c, { f: 1320, f2: 1760, t0: 0.05, d: 0.1, g: 0.035 }); },
  remove: (c) => tone(c, { f: 760, f2: 320, d: 0.13, g: 0.035 }),
  done: (c) => { tone(c, { f: 1046.5, d: 0.28, g: 0.045 }); tone(c, { f: 1568, t0: 0.12, d: 0.42, g: 0.04 }); },
  ding: (c) => { tone(c, { f: 1975.5, d: 0.45, g: 0.03 }); tone(c, { f: 2637, d: 0.3, g: 0.012 }); },
  error: (c) => { tone(c, { f: 260, d: 0.09, type: 'triangle', g: 0.05 }); tone(c, { f: 196, t0: 0.11, d: 0.12, type: 'triangle', g: 0.05 }); },
};
let last = 0;
export function sfx(name) {
  if (!sfxEnabled()) return;
  const now = performance.now(); if (name === 'tap' && now - last < 60) return; last = now;
  const c = ac(); if (!c) return;
  try { SOUNDS[name]?.(c); } catch {}
}
