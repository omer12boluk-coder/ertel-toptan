// 17.11.2026 Menü logosu kum animasyonu (look.logoAnim 'sand' | 'sandin' | 'sandpuff').
// Giriş sayfasındaki kum motorunun (liquid.js LiquidEngine) AYNISI, menü logosunun etrafında küçük bir kanvasta.
// Ara ara (8 sn'de bir) logo kuma döner ve geri toplanır; aradaki sürede motor DURUR (çizim yok), görünen şey düz <img>.
// Sadece bilgisayar (≥900 px), hareketi azalt açıksa ya da hafif modda (pf-lite) oynamaz.
import { LiquidEngine } from './liquid.js';

const SRC = '/bn/hero-logo-mark.webp';
const EVERY = 8000, FIRST = 2500;

export function startLogoSand(kind) {
  if (typeof window === 'undefined') return () => {};
  let dead = false, eng = null, cv = null, host = null, tgt = null, tmr = 0, raf = 0, busy = false;
  const img = new Image(); img.decoding = 'async'; img.src = SRC;
  const ok = () => innerWidth >= 900 && !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('pf-lite') && !document.hidden;
  const findLogo = () => [...document.querySelectorAll('.shell.public .topbar .gs-brand img.brand-logo, .shell.public .topbar img.brand-logo')].find((x) => x.getBoundingClientRect().width > 0);
  const kill = () => {
    try { eng?.stop(); eng?.gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    eng = null; cv?.remove(); cv = null; if (tgt) tgt.style.visibility = ''; tgt = null; host = null;
  };
  // kanvas logonun etrafında: logonun 4 katı genişlik, 3 katı yükseklik (kum dışarı savrulabilsin); konumu logonun kutusuna göre
  const build = () => {
    const lg = findLogo(); if (!lg || !img.complete || !img.naturalWidth) return false;
    if (eng && tgt === lg && cv?.isConnected) return true;
    kill();
    const z = lg.getBoundingClientRect().width, W = Math.round(z * 5), H = Math.round(z * 4);
    host = lg.parentElement; if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    cv = document.createElement('canvas'); cv.className = 'lga-sand'; cv.setAttribute('aria-hidden', 'true');
    const lx = lg.offsetLeft + z / 2 - W / 2, ly = lg.offsetTop + z / 2 - H / 2;
    Object.assign(cv.style, { position: 'absolute', left: lx + 'px', top: ly + 'px', width: W + 'px', height: H + 'px', pointerEvents: 'none', zIndex: '3', visibility: 'hidden' });
    host.appendChild(cv);
    try {
      eng = new LiquidEngine(cv, { interactive: true, strength: 0.5, radius: 46, density: 1, dotSize: 1, spread: 0.7, turbulence: 0.8, liquid: 1, streaks: true,
        restStyle: 'image', returnSpeed: 0.55, ambient: false, ambientIntensity: 0, speed: 1, intro: false, reducedMotion: false, fullDpr: true, bg: [1, 1, 1] }, () => kill());
      eng.setImage(img, 150); eng.streakMul = 0.35;
      eng.resize(W, H, { x: W / 2 - z / 2, y: H / 2 - z / 2, w: z, h: z });
    } catch { kill(); return false; }
    tgt = lg; return true;
  };
  const finish = () => {
    // motor durana kadar (taneler evine dönünce kendiliğinden durur) bekle, sonra düz resme geri geç
    const t0 = performance.now();
    const wait = () => {
      if (dead) return;
      if (eng && eng.running && performance.now() - t0 < 4000) { raf = requestAnimationFrame(wait); return; }
      eng?.stop(); if (cv) cv.style.visibility = 'hidden'; if (tgt) tgt.style.visibility = ''; busy = false;
    };
    raf = requestAnimationFrame(wait);
  };
  const play = () => {
    if (dead || busy || !ok() || !build()) return;
    const r = eng.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    busy = true; cv.style.visibility = 'visible'; tgt.style.visibility = 'hidden';
    if (kind === 'sandin') {
      // kumdan oluşur: logo bir an kum bulutu olur, taneler girdapla evlerine toplanır (giriş sayfasının ilk hâli)
      eng.opts = { ...eng.opts, intro: true }; eng.introDur = 1500; eng.replay();
      setTimeout(() => { if (eng) eng.opts = { ...eng.opts, intro: false }; finish(); }, 1600);
    } else if (kind === 'sandpuff') {
      // savrulur: ortadan bir 'üfleme', taneler dağılıp geri döner
      eng.pointer('down', cx, cy, true);
      setTimeout(() => { eng?.pointer('up', cx, cy, true); finish(); }, 160);
    } else {
      // rüzgâr: görünmez bir parmak logonun üstünden soldan sağa geçer (giriş sayfasında fareyle yapılanın aynısı)
      const x0 = r.x - r.w * 0.9, x1 = r.x + r.w * 1.9, D = 760, s0 = performance.now();
      const sweep = (now) => {
        if (dead || !eng) return;
        const u = Math.min(1, (now - s0) / D), x = x0 + (x1 - x0) * u, y = cy + Math.sin(u * Math.PI) * r.h * 0.12;
        eng.pointer('move', x, y, false);
        if (u < 1) raf = requestAnimationFrame(sweep); else { eng.pointer('leave', x, y, false); finish(); }
      };
      raf = requestAnimationFrame(sweep);
    }
  };
  const loop = () => { if (dead) return; play(); tmr = setTimeout(loop, EVERY); };
  tmr = setTimeout(loop, FIRST);
  const onRs = () => { if (!busy) kill(); };
  addEventListener('resize', onRs);
  return () => { dead = true; clearTimeout(tmr); cancelAnimationFrame(raf); removeEventListener('resize', onRs); kill(); };
}
