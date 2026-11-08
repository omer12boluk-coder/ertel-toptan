// Tanıtım videosu motoru (8.11.2026) — mp4 DEĞİL: sayfa içinde çizilen sahneler (yazılar net, dosya küçük).
// Veri src/icerik/videolar.json (tarif claude/is/video-ekle.md). Bilgisayar sahnesi 1600×900 birim (w), telefon 800×1000 (t);
// kutu en/boy ≥ 1.05 ise w. Sahne geçişleri: cut | blur | wipeUp | wipeRight | circle | push | fade.
// Öğe türleri (k): tx (s: xl|l|s, acc: turuncu), eye (logo | etiket), img (src/srcM → /bn/), say, wave, num, card, btns, blobs.
// Müzik filmses.js (telifsiz, üretilen); ses açıkken görüntü saati müziğe bağlı.
import { music } from './filmses.js';
export { renderAudio as renderAudioFor } from './filmses.js'; // mp4 aracı (tools/film-mp4.py)

export const TR = 0.7;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = (t) => 1 - Math.pow(1 - t, 3);
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const IMGP = (f) => (/^(\/|https?:|data:)/.test(f) ? f : '/bn/' + f);
const SVG = {
  mic: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5"/><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2"/></svg>',
  play: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>',
  re: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5v2.4h2.4"/></svg>',
  fs: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>',
  on: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.7a6 6 0 0 1 0 8.6"/></svg>',
  off: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" fill="currentColor"/><path d="M11 6l4 4M15 6l-4 4"/></svg>',
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const cutsOf = (F) => F.scenes.slice(1).map((s) => s.t0);
export const endOf = (F) => F.scenes[F.scenes.length - 1].t0;

function elHtml(F, E, P) {
  const acc = F.acc || '#f5a54a';
  if (E.k === 'eye') { const h = P.h || 40; const acc = E.col || F.acc || '#f5a54a'; return `<div class="flm-eye" style="height:${h}px;${P.c ? 'justify-content:center;' : ''}"><img src="${IMGP(F.logo)}" alt="" style="height:${h}px;${F.logoWhite ? 'filter:brightness(0) invert(1);' : ''}transform:translateY(${(F.logoY || 0) * h}px)"><i style="height:${h * 0.6}px;background:${acc};margin:0 ${h * 0.36}px"></i><span style="color:${acc};font-size:${h * 0.6}px">${esc(E.txt)}</span></div>`; }
  if (E.k === 'img') return `<img class="flm-ph" alt="" src="${IMGP(P.src || (P === E.t && E.srcM) || E.src)}"${E.op ? ` style="opacity:${E.op}"` : ''}>`;
  if (E.k === 'say') return `<span class="flm-say">${SVG.mic} ${esc(E.txt)}</span>`;
  if (E.k === 'wave') return '<div class="flm-wave">' + '<i></i>'.repeat(28) + '</div>';
  if (E.k === 'num') return `<span class="flm-num"><b>${E.from}</b><small style="color:${acc}">${esc(E.unit || '')}</small></span>`;
  if (E.k === 'card') return `<div class="flm-card"><b>${esc(E.v)}</b><span>${esc(E.l)}</span></div>`;
  if (E.k === 'btns') { const fs = P.fs || 24; return `<div class="flm-btns" style="${P.c ? 'justify-content:center;' : ''}"><button type="button" class="flm-btn" data-act="p" style="height:${fs * 2.4}px;padding:0 ${fs * 1.4}px;font-size:${fs}px">İncele</button><button type="button" class="flm-lnk" data-act="c" style="font-size:${fs}px">Sepete ekle ›</button></div>`; }
  if (E.k === 'blobs') return '';
  return `<span style="${E.acc ? 'color:' + acc + ';font-weight:600' : ''}">${esc(E.txt)}</span>`;
}

// root: boş kutu (en/boy oranını dışarıdan alır). opts: { open(act), music: bool, auto: bool, onEnd() }
export function makeFilm(root, F, opts = {}) {
  const TOTAL = F.total || endOf(F) + 1.8;
  const cuts = cutsOf(F), END = endOf(F);
  let snd = opts.sound === true, poke = 0, mode = '', t = 0, playing = false, last = 0, started = false, raf = 0, scs = [], W = 1600, H = 900, dead = false;
  root.classList.add('flm');
  root.innerHTML = `<div class="flm-stage"></div><div class="flm-ui"><div class="flm-toast"></div><button type="button" class="flm-go">Ürüne git ›</button><i class="flm-thin"></i>
    <div class="flm-bar"><button type="button" class="flm-ib flm-pp" aria-label="Oynat / durdur"></button><div class="flm-prog"><i><b></b></i></div>${opts.music === false ? '' : '<button type="button" class="flm-ib flm-snd" aria-label="Ses"></button>'}<button type="button" class="flm-ib flm-fs" aria-label="Tam ekran">${SVG.fs}</button></div></div>`;
  const q = (s) => root.querySelector(s);
  const stage = q('.flm-stage'), thin = q('.flm-thin'), pp = q('.flm-pp'), bar = q('.flm-prog b'), sb = q('.flm-snd');
  function build() {
    stage.innerHTML = ''; stage.style.width = W + 'px'; stage.style.height = H + 'px';
    scs = F.scenes.map((S, si) => {
      const d = document.createElement('div'); d.className = 'flm-scn'; d.style.background = S.bg || '#000'; d.style.zIndex = si;
      const els = S.els.map((E) => {
        const P = E[mode === 'wide' ? 'w' : 't'] || E.w; const e = document.createElement('div');
        e.className = 'flm-el' + (E.k === 'tx' ? ' flm-' + (E.s || 's') : '') + (P.c ? ' c' : '');
        e.innerHTML = elHtml(F, E, P);
        if (E.col) e.style.color = E.col; if (P.fs) e.style.fontSize = P.fs + 'px'; e.style.top = P.y + 'px';
        if (P.c) { const wd = P.wd || W; e.style.left = P.x - wd / 2 + 'px'; e.style.width = wd + 'px'; } else { e.style.left = P.x + 'px'; if (P.wd) e.style.width = P.wd + 'px'; }
        if (P.ht) e.style.height = P.ht + 'px';
        d.appendChild(e);
        return { E, e, bars: [...e.querySelectorAll('.flm-wave i')], num: e.querySelector('.flm-num b') };
      });
      stage.appendChild(d); return { S, d, els };
    });
  }
  function layout() {
    if (dead) return; const r = root.getBoundingClientRect(); if (!r.width || !r.height) return;
    const m = r.width / r.height >= 1.05 ? 'wide' : 'tall';
    if (m !== mode) { mode = m; [W, H] = m === 'wide' ? [1600, 900] : [800, 1000]; build(); }
    const s = Math.min(r.width / W, r.height / H);
    stage.style.transform = `translate(${(r.width - W * s) / 2}px,${(r.height - H * s) / 2}px) scale(${s})`; draw();
  }
  function inFx(d, type, k) {
    const e = ease(k); d.style.clipPath = ''; d.style.transform = ''; d.style.filter = ''; d.style.opacity = 1; if (k >= 1) return;
    if (type === 'blur') { d.style.opacity = e; d.style.filter = `blur(${(1 - e) * 24}px)`; d.style.transform = `scale(${1.06 - 0.06 * e})`; }
    else if (type === 'wipeUp') d.style.clipPath = `inset(${(1 - e) * 100}% 0 0 0)`;
    else if (type === 'wipeRight') d.style.clipPath = `inset(0 ${(1 - e) * 100}% 0 0)`;
    else if (type === 'circle') d.style.clipPath = `circle(${e * 75}% at 50% 55%)`;
    else if (type === 'push') d.style.transform = `translateX(${(1 - e) * 100}%)`;
    else if (type === 'fade') d.style.opacity = e;
  }
  function draw() {
    let cur = 0; scs.forEach((o, i) => { if (t >= o.S.t0) cur = i; });
    const C = F.scenes[cur];
    scs.forEach((o, i) => {
      const S = o.S, d = o.d;
      const vis = i === cur || (i === cur - 1 && C.in !== 'cut' && t < C.t0 + TR);
      d.style.visibility = vis ? 'visible' : 'hidden'; if (!vis) return;
      if (i === cur) inFx(d, S.in, S.in === 'cut' ? 1 : cl((t - S.t0) / TR));
      else { const k = ease(cl((t - C.t0) / TR)); d.style.clipPath = ''; d.style.filter = ''; d.style.transform = C.in === 'push' ? `translateX(${-30 * k}%)` : `scale(${1 - 0.05 * k})`; d.style.opacity = C.in === 'blur' ? 1 - k : 1 - 0.5 * k; }
      const lt = t - S.t0;
      o.els.forEach(({ E, e, bars, num }) => {
        const k = cl((lt - (E.d || 0)) / 0.75), qq = eo(k); let tr = '', op = qq, clip = '';
        if (E.a === 'rise') tr = `translateY(${(1 - qq) * 34}px)`;
        else if (E.a === 'up') tr = `translateY(${(1 - qq) * 90}px)`;
        else if (E.a === 'left') tr = `translateX(${(1 - qq) * 160}px)`;
        else if (E.a === 'right') tr = `translateX(${(1 - qq) * -140}px)`;
        else if (E.a === 'pop') tr = `scale(${0.9 + 0.1 * qq})`;
        else if (E.a === 'mask') { clip = `inset(0 0 ${(1 - qq) * 100}% 0)`; tr = `translateY(${(1 - qq) * 60}px)`; op = k > 0 ? 1 : 0; }
        if (E.drift && !S.end) tr += ` translateX(${-lt * 8}px)`;
        if (E.k === 'blobs') { const p = (a, b, c) => a + b * Math.sin(t * c); const P4 = E.pal || ['rgba(255,138,40,.95)', 'rgba(255,64,40,.8)', 'rgba(255,196,90,.75)', 'rgba(28,140,150,.75)', '#2a0e04'];
          e.style.background = `radial-gradient(42% 60% at ${p(22, 8, 0.9)}% ${p(30, 10, 0.7)}%,${P4[0]},transparent 70%),radial-gradient(40% 55% at ${p(80, 7, 0.8)}% ${p(70, 9, 1.1)}%,${P4[1]},transparent 70%),radial-gradient(35% 50% at ${p(62, 10, 0.6)}% ${p(18, 8, 0.9)}%,${P4[2]},transparent 70%),radial-gradient(38% 55% at ${p(15, 6, 1)}% ${p(85, 8, 0.8)}%,${P4[3]},transparent 70%),${P4[4]}`; }
        if (bars.length) { const [a, b] = E.on || [0.6, 2.1]; const on = lt > a && lt < b + 0.4; const amp = on ? Math.min(1, (lt - a) / 0.2) * (lt > b ? Math.max(0, (b + 0.4 - lt) / 0.4) : 1) : 0;
          if (lt > b + 0.4) op *= Math.max(0, 1 - (lt - b - 0.4) / 0.35);
          bars.forEach((x, j) => { const v = 0.16 + amp * (0.45 + 0.4 * Math.sin(lt * 11 + j * 1.7) * Math.sin(lt * 5.3 + j * 0.6)); x.style.height = Math.max(0.08, v) * 100 + '%'; }); }
        if (num) { const [a, b] = E.at || [1.2, 2.2]; num.textContent = Math.round(E.from + (E.to - E.from) * eo(cl((lt - a) / (b - a)))); }
        e.style.opacity = op; e.style.transform = tr; e.style.clipPath = clip; e.style.pointerEvents = op > 0.9 ? 'auto' : 'none';
      });
    });
    root.classList.toggle('lt', !!C.light); root.style.background = C.bg || '#000';
    root.classList.toggle('fin', t >= TOTAL - 0.01);
    bar.style.width = thin.style.width = (t / TOTAL) * 100 + '%';
    root.classList.toggle('idle', playing && performance.now() - poke > 2200);
    if (sb) sb.innerHTML = snd ? SVG.on : SVG.off;
    pp.innerHTML = t >= TOTAL - 0.01 ? SVG.re : playing ? SVG.pause : SVG.play;
  }
  function loop(now) {
    if (!playing || dead) return;
    const at = snd && music.running() ? music.now() : null; if (at !== null) t = Math.max(t, at); else t += Math.min(0.1, (now - last) / 1000); last = now;
    if (t >= TOTAL) { t = TOTAL; playing = false; draw(); opts.onEnd?.(); return; }
    draw(); raf = requestAnimationFrame(loop);
  }
  // Ses açık başlasın: tarayıcı, ziyaretçi sayfaya ilk dokunana / tıklayana kadar sesi bekletir → ilk dokunuşta o anki yerden başlar
  let armed = false;
  const unlock = () => { armed = false; ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => document.removeEventListener(ev, unlock, true)); if (snd && playing && !dead) music.start(cuts, END, t); };
  const arm = () => { if (armed || music.running()) return; armed = true; ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, true)); };
  function play() { if (t >= TOTAL - 0.01) t = 0; playing = true; started = true; if (snd) { music.start(cuts, END, t); setTimeout(() => { if (snd && playing && !music.running()) arm(); }, 150); } last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); draw(); }
  function pause() { playing = false; if (snd) music.stop(); draw(); }
  root._mute = () => { if (snd) { snd = false; draw(); } };
  root.addEventListener('pointermove', () => { poke = performance.now(); root.classList.remove('idle'); });
  root.addEventListener('pointerdown', () => { poke = performance.now(); root.classList.remove('idle'); });
  pp.onclick = () => (playing ? pause() : play());
  if (sb) sb.onclick = () => { snd = !snd; document.querySelectorAll('.flm').forEach((f) => f !== root && f._mute?.()); if (snd && playing) music.start(cuts, END, t); else if (!snd) music.stop(); if (snd && !playing) play(); draw(); };
  q('.flm-prog').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); t = cl((e.clientX - r.left) / r.width) * TOTAL; draw(); if (playing && snd) music.start(cuts, END, t); if (!playing && t < TOTAL) play(); };
  const toast = q('.flm-toast');
  const act = (a) => { if (opts.open) opts.open(a); else { toast.textContent = a === 'c' ? 'Sepete eklenir' : 'Ürün sayfası açılır'; toast.classList.add('on'); setTimeout(() => toast.classList.remove('on'), 1500); } };
  q('.flm-go').onclick = () => act('p');
  root.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act); });
  const exitPfs = () => { root.classList.remove('flm-pfs'); document.documentElement.classList.remove('flm-lock'); layout(); };
  q('.flm-fs').onclick = async () => {
    if (document.fullscreenElement === root) { await document.exitFullscreen().catch(() => {}); return; }
    if (root.classList.contains('flm-pfs')) { exitPfs(); return; }
    try { if (root.requestFullscreen) { await root.requestFullscreen(); return; } } catch {}
    root.classList.add('flm-pfs'); document.documentElement.classList.add('flm-lock'); layout();
  };
  const onFs = () => setTimeout(layout, 50); document.addEventListener('fullscreenchange', onFs);
  const ro = new ResizeObserver(layout); ro.observe(root);
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.55 && !started && opts.auto !== false) play(); else if (!e.isIntersecting && playing) pause(); }), { threshold: [0, 0.55] });
  io.observe(root);
  layout();
  return {
    seek(x) { t = x; playing = false; draw(); }, play, pause,
    destroy() { dead = true; if (armed) unlock(); cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('fullscreenchange', onFs); if (snd) music.stop(); if (root.classList.contains('flm-pfs')) exitPfs(); },
  };
}
