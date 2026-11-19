// 19.11.2026 Giriş sayfası zemini (brand.heroBg): logo kum animasyonu AYNEN kalır, arkasına hareketli zemin.
// '' = bugünkü düz zemin (eski hâl). Koyu zeminler (HBG_DARK) giriş sayfasını koyu yazıya çevirir (eh-dark).
// Önizleme hostunda (--) ya da ?zemin ile sol altta seçici çıkar (ls 'hbg-try' canlı ayarı ezer).
// Kurallar: kalıcı katman (will-change) YOK; kanvaslar düşük çözünürlük + 30 fps; sekme gizliyken / hafif modda / hareketi azaltta durur.
import { useEffect, useRef, useState } from 'react';
import { useStore } from './store.js';

export const HBG_OPTS = [
  ['', 'Düz (bugünkü)'], ['aurora', 'Akan ışık'], ['atolye', 'Atölye ışığı'],
];
export const HBG_DARK = { atolye: 1 };
export const HBG_TRY = typeof location !== 'undefined' && (/--/.test(location.hostname) || /[?&]zemin\b/.test(location.search));
const KEYS = HBG_OPTS.map((o) => o[0]);
const lsGet = () => { try { const v = localStorage.getItem('hbg-try'); return v != null && KEYS.includes(v) ? v : null; } catch { return null; } };

export function useHeroBg() {
  const live = useStore((s) => s.settings?.brand?.heroBg || '');
  const [tr, setTr] = useState(() => (HBG_TRY ? lsGet() : null));
  const pick = (k) => { try { localStorage.setItem('hbg-try', k); } catch {} setTr(k); };
  const kind = tr != null ? tr : (KEYS.includes(live) ? live : '');
  return [kind, pick];
}

const still = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('pf-lite'); } catch { return false; }
};

// basit sabit tohumlu rastgele (her açılışta aynı desen)
const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// Kanvas döngüsü: ebeveyn boyunda, scale ile küçültülmüş, en çok fps kare/sn
function useLoop(ref, draw, { scale = 0.5, fps = 30, init } = {}) {
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const ctx = cv.getContext('2d'); let w = 0, h = 0, raf = 0, last = 0, st = null, dead = false;
    const size = () => {
      const p = cv.parentElement; const W = p.clientWidth, H = p.clientHeight;
      w = Math.max(2, Math.round(W * scale)); h = Math.max(2, Math.round(H * scale));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; st = init ? init(w, h) : {}; }
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(cv.parentElement);
    const t0 = performance.now();
    const tick = (now) => {
      if (dead) return;
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / fps - 2) return; last = now;
      if (still()) return;
      draw(ctx, w, h, (now - t0) / 1000, st);
    };
    draw(ctx, w, h, 4, st);
    raf = requestAnimationFrame(tick);
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------------- 1 · Akan ışık ----------------
function Aurora() {
  return <><i className="ehb-b b1" /><i className="ehb-b b2" /><i className="ehb-b b3" /><i className="ehb-b b4" /><i className="ehb-grain" /></>;
}

// ---------------- 2 · Atölye ışığı ----------------
function Atolye() {
  const ref = useRef(null);
  useLoop(ref, (c, w, h, t, s) => {
    c.clearRect(0, 0, w, h);
    const cx = w * 0.5, top = -h * 0.05, sway = Math.sin(t * 0.35) * w * 0.02;
    for (const p of s.p) {
      p.y -= p.v; p.x += Math.sin(t * p.f + p.o) * 0.18 + 0.04;
      if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
      // hüzmenin içi daha parlak
      const half = (w * 0.08) + (p.y - top) * 0.42, d = Math.abs(p.x - (cx + sway)) / half;
      const lit = d < 1 ? 1 - d * d : 0;
      const a = (0.10 + lit * 0.75) * p.a * (0.6 + 0.4 * Math.sin(t * p.f * 2 + p.o));
      if (a < 0.02) continue;
      c.fillStyle = `rgba(255,${200 + lit * 30 | 0},${150 + lit * 40 | 0},${a})`;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill();
    }
  }, {
    scale: 0.75, fps: 30,
    init: (w, h) => { const r = rnd(7); return { p: Array.from({ length: Math.round(w * h / 9000) + 40 }, () => ({ x: r() * w, y: r() * h, r: 0.6 + r() * 1.6, v: 0.08 + r() * 0.3, f: 0.3 + r() * 0.8, o: r() * 6, a: 0.4 + r() * 0.6 })) }; },
  });
  return <><i className="ehb-beam" /><i className="ehb-pool" /><canvas ref={ref} className="ehb-cv" /><i className="ehb-vig" /></>;
}

const MAP = { aurora: Aurora, atolye: Atolye };
export function HeroBg({ kind }) {
  const C = MAP[kind]; if (!C) return null;
  return <div className={'ehb ehb-' + kind} aria-hidden="true"><C /></div>;
}

export function HeroBgPick({ kind, pick }) {
  if (!HBG_TRY) return null;
  return (
    <div className="ehb-pick" onPointerDown={(e) => e.stopPropagation()}>
      <b>Zemin</b>
      {HBG_OPTS.map(([k, t]) => <button type="button" key={k || 'duz'} className={kind === k ? 'on' : ''} onClick={() => pick(k)}>{t}</button>)}
    </div>
  );
}
