// 19.11.2026 Giriş sayfası zemini (brand.heroBg): logo kum animasyonu AYNEN kalır, arkasına hareketli zemin.
// '' = bugünkü düz zemin (eski hâl). Koyu zeminler (HBG_DARK) giriş sayfasını koyu yazıya çevirir (eh-dark).
// Önizleme hostunda (--) ya da ?zemin ile sol altta seçici çıkar (ls 'hbg-try' canlı ayarı ezer).
// Kurallar: kalıcı katman (will-change) YOK; kanvaslar düşük çözünürlük + 30 fps; sekme gizliyken / hafif modda / hareketi azaltta durur.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store.js';

export const HBG_OPTS = [
  ['', 'Düz (bugünkü)'], ['aurora', 'Akan ışık'], ['atolye', 'Atölye ışığı'], ['akim', 'Akım'],
  ['duman', 'Lehim dumanı'], ['osilo', 'Osiloskop'], ['gece', 'Gece sahnesi'],
];
export const HBG_DARK = { atolye: 1, osilo: 1, gece: 1 };
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

// ---------------- 3 · Akım ----------------
function Akim() {
  const box = useRef(null);
  const [sz, setSz] = useState(null);
  useEffect(() => {
    const el = box.current; if (!el) return undefined;
    const m = () => setSz((o) => { const w = el.clientWidth, h = el.clientHeight; return o && Math.abs(o.w - w) < 40 && Math.abs(o.h - h) < 40 ? o : { w, h }; });
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, []);
  const traces = useMemo(() => {
    if (!sz) return [];
    const { w, h } = sz, r = rnd(11), out = [], G = 22;
    const n = Math.round((w + h) / 90);
    for (let i = 0; i < n; i++) {
      const side = i % 4; let x, y, dx, dy;
      const along = 0.06 + r() * 0.88;
      if (side === 0) { x = along * w; y = -4; dx = 0; dy = 1; } else if (side === 1) { x = w + 4; y = along * h; dx = -1; dy = 0; }
      else if (side === 2) { x = along * w; y = h + 4; dx = 0; dy = -1; } else { x = -4; y = along * h; dx = 1; dy = 0; }
      x = Math.round(x / G) * G; y = Math.round(y / G) * G;
      let d = `M${x} ${y}`; const segs = 2 + (r() * 3 | 0);
      for (let k = 0; k < segs; k++) {
        const len = (2 + (r() * 6 | 0)) * G; x += dx * len; y += dy * len; d += `L${x} ${y}`;
        // 45° kırılma
        const turn = r() < 0.5 ? 1 : -1, bl = (1 + (r() * 2 | 0)) * G;
        const ndx = dx === 0 ? turn : dx, ndy = dy === 0 ? turn : dy; x += ndx * bl; y += ndy * bl; d += `L${x} ${y}`;
      }
      // logonun bulunduğu orta bölgeye girmesin
      const cx = w / 2, cy = h * 0.38;
      if (Math.abs(x - cx) < w * 0.22 && Math.abs(y - cy) < h * 0.2) continue;
      // yazıların üstüne de bitmesin
      if (x > w * 0.04 && x < w * 0.96 && y > h * 0.6 && y < h * 0.86) continue;
      out.push({ d, x, y, dur: 3.2 + r() * 4, del: -(r() * 8) });
    }
    return out;
  }, [sz]);
  useEffect(() => {
    // her yolun uzunluğu → ışık darbesi
    const el = box.current; if (!el) return;
    el.querySelectorAll('path.ehb-pl').forEach((p) => { const L = p.getTotalLength(); p.style.setProperty('--L', L); p.style.strokeDasharray = `${Math.max(26, L * 0.12)} ${L + 60}`; });
  }, [traces]);
  return (
    <div ref={box} className="ehb-fill">
      {sz && <svg width={sz.w} height={sz.h} className="ehb-svg">
        <g className="ehb-tr">{traces.map((t, i) => <path key={i} d={t.d} />)}</g>
        <g className="ehb-pad">{traces.map((t, i) => <circle key={i} cx={t.x} cy={t.y} r="4.5" />)}</g>
        <g className="ehb-pls">{traces.map((t, i) => <path key={i} className="ehb-pl" d={t.d} style={{ animationDuration: t.dur + 's', animationDelay: t.del + 's' }} />)}</g>
      </svg>}
      <i className="ehb-akg" />
    </div>
  );
}

// ---------------- 4 · Lehim dumanı ----------------
function Duman() {
  const ref = useRef(null);
  useLoop(ref, (c, w, h, t, s) => {
    c.clearRect(0, 0, w, h);
    for (const p of s.p) {
      const life = ((t + p.o) % p.T) / p.T; // 0..1
      const y = h * (1.05 - life * 1.25), x = p.x * w + Math.sin(t * 0.25 + p.o) * w * 0.04 + Math.sin(life * 5 + p.o) * w * 0.03 * life;
      const rad = (0.08 + life * 0.32) * Math.max(w, h) * p.s;
      const a = Math.sin(life * Math.PI) * p.a;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${p.c},${a})`); g.addColorStop(1, `rgba(${p.c},0)`);
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, {
    scale: 0.22, fps: 30,
    init: () => { const r = rnd(5); return { p: Array.from({ length: 16 }, (_, i) => ({ x: 0.08 + r() * 0.84, T: 14 + r() * 12, o: i * 1.9 + r() * 4, s: 0.6 + r() * 0.7, a: 0.24 + r() * 0.16, c: r() < 0.3 ? '96,134,190' : '118,122,134' })) }; },
  });
  return <><canvas ref={ref} className="ehb-cv ehb-soft" /><i className="ehb-ember" /></>;
}

// ---------------- 5 · Osiloskop ----------------
function Osilo() {
  const ref = useRef(null);
  useLoop(ref, (c, w, h, t) => {
    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    const L = [
      { y: 0.915, A: 0.035, k: 2.2, sp: 0.9, col: '60,240,200', m: 0.6 },
      { y: 0.945, A: 0.022, k: 5.5, sp: -1.3, col: '80,170,255', m: 0.3 },
      { y: 0.885, A: 0.016, k: 9, sp: 1.8, col: '255,190,90', m: 0.8 },
    ];
    for (const l of L) {
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const u = i / 160, x = u * w;
        const env = 0.55 + 0.45 * Math.sin(u * 3.1 + t * 0.4 * l.m);
        const y = h * l.y + Math.sin(u * l.k * 6.283 + t * l.sp) * h * l.A * env + Math.sin(u * 23 + t * 3) * h * 0.002;
        pts.push(x, y);
      }
      for (const [lw, a] of [[7, 0.06], [3, 0.18], [1.2, 0.85]]) {
        c.strokeStyle = `rgba(${l.col},${a})`; c.lineWidth = lw; c.beginPath();
        for (let i = 0; i < pts.length; i += 2) (i ? c.lineTo : c.moveTo).call(c, pts[i], pts[i + 1]);
        c.stroke();
      }
    }
    // tarayan parlak nokta
    const sx = ((t * 0.18) % 1) * w; c.fillStyle = 'rgba(60,240,200,.9)'; c.beginPath(); c.arc(sx, h * 0.915 + Math.sin((sx / w) * 2.2 * 6.283 + t * 0.9) * h * 0.035 * (0.55 + 0.45 * Math.sin((sx / w) * 3.1 + t * 0.24)), 2.4, 0, 6.283); c.fill();
    c.globalCompositeOperation = 'source-over';
  }, { scale: Math.min(1, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)), fps: 30 });
  return <><i className="ehb-grid" /><canvas ref={ref} className="ehb-cv" /><i className="ehb-vig" /></>;
}

// ---------------- 6 · Gece sahnesi ----------------
function Gece() {
  const stars = useMemo(() => { const r = rnd(3); return Array.from({ length: 46 }, () => ({ x: r() * 100, y: r() * 100, s: 1 + r() * 2, d: 2.5 + r() * 4, o: -(r() * 6), b: r() < 0.3 })); }, []);
  return <>
    <i className="ehb-glow" /><i className="ehb-halo" /><i className="ehb-halo h2" />
    {stars.map((s, i) => <i key={i} className={'ehb-st' + (s.b ? ' b' : '')} style={{ left: s.x + '%', top: s.y + '%', width: s.s, height: s.s, animationDuration: s.d + 's', animationDelay: s.o + 's' }} />)}
  </>;
}

const MAP = { aurora: Aurora, atolye: Atolye, akim: Akim, duman: Duman, osilo: Osilo, gece: Gece };
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
