// Tezgâh canlı 3B çizici: dünya koordinatlı sahne verisini (scene.json) her karede kamera ile çizer.
// Kamera: hedef nokta etrafında yörünge (yaw/pitch/uzaklık) + kaydırma. Tıklama: renk kodlu seçim tamponu.
(function () {
const LIGHT = (() => { const v = [-0.45, 0.85, 0.55], l = Math.hypot(...v); return v.map(x => x / l) })();
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shadeCache = new Map();
function shade(col, n, spec) {   // tez3d.shade ile aynı
  const key = col + n[0].toFixed(2) + n[1].toFixed(2) + n[2].toFixed(2) + (spec || 0);
  let r = shadeCache.get(key); if (r) return r;
  const c = hex(col), l = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]), f = .54 + .56 * l;
  const warm = [255, 246, 232], cool = [52, 62, 84];
  r = c.map((x, i) => { let v = x * f + (spec || 0) * 255 * l ** 8; v = v * (1 - .07 * l) + warm[i] * .07 * l; v = v * (1 - .07 * (1 - l)) + cool[i] * .07 * (1 - l); return Math.max(0, Math.min(255, v | 0)) });
  shadeCache.set(key, r); return r;
}
const rgb = (c, k = 1, a = 0) => `rgb(${Math.min(255, c[0] * k + a) | 0},${Math.min(255, c[1] * k + a) | 0},${Math.min(255, c[2] * k + a) | 0})`;
const DEFS = '<defs><filter id="glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
  + '<filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>'
  + '<linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity=".04"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>';
const imgCache = new Map();
function decalImg(w, h, svg) {
  const key = w + 'x' + h + svg; let im = imgCache.get(key); if (im) return im;
  const k = Math.max(2, Math.min(5, 900 / Math.max(w, h)));
  im = new Image(); im.decoding = 'async';
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}" height="${h * k}" viewBox="0 0 ${w} ${h}" font-family="Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${DEFS}${svg}</svg>`);
  im.onload = () => T.dirty();
  imgCache.set(key, im); return im;
}

const T = {};
window.Tezgah = T;
T.init = function (canvas, scene, opts) {
  const ctx = canvas.getContext('2d');
  const sh = [2, 4, 8].map(() => document.createElement('canvas'));   // gölge katmanları (küçük çözünürlük = bulanıklık)
  const pick = document.createElement('canvas'), pctx = pick.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, DPR = 1, F = 1;
  // kamera
  const DEF = Object.assign({ yaw: .55, pitch: .27, dist: 2.02, tx: -.04, ty: .98, tz: -.14 }, opts.view || {});
  const cam = Object.assign({}, DEF);
  let P, R, U, Fw;   // kamera konumu, sağ, yukarı, ileri
  function setupCam() {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    P = [cam.tx + cam.dist * cp * Math.sin(cam.yaw), cam.ty + cam.dist * sp, cam.tz + cam.dist * cp * Math.cos(cam.yaw)];
    Fw = [cam.tx - P[0], cam.ty - P[1], cam.tz - P[2]]; let l = Math.hypot(...Fw); Fw = Fw.map(x => x / l);
    R = [-Fw[2], 0, Fw[0]]; l = Math.hypot(...R); R = R.map(x => x / l);       // cross(f, up)
    U = [R[1] * Fw[2] - R[2] * Fw[1], R[2] * Fw[0] - R[0] * Fw[2], R[0] * Fw[1] - R[1] * Fw[0]];
  }
  function pr(p, dy) {
    const x = p[0] - P[0], y = p[1] + (dy || 0) - P[1], z = p[2] - P[2];
    const cx = x * R[0] + y * R[1] + z * R[2], cy = x * U[0] + y * U[1] + z * U[2], cz = x * Fw[0] + y * Fw[1] + z * Fw[2];
    return [W / 2 + F * cx / cz, H / 2 - F * cy / cz, cz];
  }
  T.project = p => { const q = pr(p); return [q[0] / DPR, q[1] / DPR, q[2]] };
  function resize() {
    const r = canvas.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, Math.round(r.width * DPR)); H = Math.max(2, Math.round(r.height * DPR));
    canvas.width = W; canvas.height = H;
    sh.forEach((c, i) => { c.width = Math.ceil(W / [2, 4, 8][i]); c.height = Math.ceil(H / [2, 4, 8][i]) });
    pick.width = Math.ceil(r.width); pick.height = Math.ceil(r.height);
    F = Math.min(W, H * 1.5) * (1400 / 1536) * (opts.fov || 1);
    T.dirty();
  }
  // etkin öğeler: key -> {d: veri, t0, out}
  const active = new Map();
  T.set = function (keys, anim) {
    const now = performance.now(), want = new Set(keys);
    active.forEach((v, k) => { if (!want.has(k) && !v.out) { v.out = now; } });
    keys.forEach((k, i) => {
      const d = scene.items[k]; if (!d) return;
      const v = active.get(k);
      if (!v || v.out) active.set(k, { d, t0: anim ? now + (typeof anim === 'number' ? anim : 0) : now - 9999, out: 0 });
    });
    T.dirty();
  };
  let ghosts = [];
  T.ghosts = list => { ghosts = list; T.dirty() };

  const easeBack = t => { const c = 1.5; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t };
  function animState(v, now) {   // [dy, alfa, gölge alfa, bitti?]
    if (v.out) { const t = Math.min(1, (now - v.out) / 220); return [.03 * t, 1 - t, 1 - t, t >= 1] }
    const t = Math.max(0, Math.min(1, (now - v.t0) / 560));
    if (t <= 0) return [0, 0, 0, false];
    return [.14 * (1 - easeBack(t)), Math.min(1, t * 2.2), Math.max(0, (t - .15) / .85), false];
  }

  function drawPoly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath() }
  function faceList(o, dy, list, alpha, id) {
    for (const f of o.f) {
      const pts = f[0], n = f[2];
      let cx = 0, cy = 0, cz = 0; for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2] } cx /= pts.length; cy = cy / pts.length + dy; cz /= pts.length;
      if (n[0] * (P[0] - cx) + n[1] * (P[1] - cy) + n[2] * (P[2] - cz) <= 0) continue;
      const q = pts.map(p => pr(p, dy)); let mz = 1e9; for (const p of q) if (p[2] < mz) mz = p[2];
      if (mz < .05) continue;
      list.push({ k: 0, z: pr([cx, cy - dy, cz], dy)[2], q, f, alpha, id });
    }
    for (const c of o.c) { const q = c[0].map(p => pr(p, dy)); if (q.some(p => p[2] < .05)) continue; list.push({ k: 1, z: q[q.length >> 1][2] - .05, q, c, alpha, id }) }
  }
  function paintFace(c, it) {
    const f = it.f, base = shade(f[1], f[2], f[3] && f[3].s), q = it.q;
    drawPoly(c, q);
    const grad = !fast && !(f[3] && f[3].g === 0) && q.length >= 4;
    if (grad) {
      let y0 = 1e9, y1 = -1e9; for (const p of q) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] }
      const g = c.createLinearGradient(0, y0, 0, y1 + .01), top = f[2][1] > .7;
      g.addColorStop(0, top ? rgb(base, .94) : rgb(base, 1.1, 7)); g.addColorStop(1, top ? rgb(base, 1.06, 4) : rgb(base, .8));
      c.fillStyle = g;
    } else c.fillStyle = rgb(base);
    c.fill();
    if (f[3] && f[3].k) { c.strokeStyle = f[3].k; c.lineWidth = DPR } else if (f[2][1] > .7) { c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.2 * DPR }
    else { c.strokeStyle = rgb(base); c.lineWidth = .7 * DPR }
    c.lineJoin = 'round'; c.stroke();
  }
  function paintCurve(c, it) {
    const q = it.q; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]);
    c.strokeStyle = it.c[1]; c.lineWidth = it.c[2] * F / 1400 * (2.02 / Math.max(.3, q[q.length >> 1][2])); c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  function paintDecals(c, o, dy) {
    for (const d of o.d) {
      const [tl, tr, bl, w, h, svg, n] = d;
      if (n[0] * (P[0] - tl[0]) + n[1] * (P[1] - tl[1] - dy) + n[2] * (P[2] - tl[2]) <= 0) continue;
      const a = pr(tl, dy), b = pr(tr, dy), e = pr(bl, dy); if (a[2] < .05 || b[2] < .05 || e[2] < .05) continue;
      const im = decalImg(w, h, svg); if (!im.complete || !im.naturalWidth) continue;
      c.save(); c.setTransform((b[0] - a[0]) / w, (b[1] - a[1]) / w, (e[0] - a[0]) / h, (e[1] - a[1]) / h, a[0], a[1]);
      c.drawImage(im, 0, 0, w, h); c.restore();
    }
  }
  function paintBg(item) {   // düz çizimler
    const t = item[1];
    if (t === 'l') { const a = pr(item[2]), b = pr(item[3]); if (a[2] < .05 || b[2] < .05) return; ctx.globalAlpha = item[6]; ctx.strokeStyle = item[4]; ctx.lineWidth = item[5] * DPR * F / 1400 * 2 / Math.max(.4, (a[2] + b[2]) / 2) ; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke() }
    else if (t === 'd') { const a = pr(item[2]); if (a[2] < .05) return; ctx.globalAlpha = item[5]; ctx.fillStyle = item[4]; ctx.beginPath(); ctx.arc(a[0], a[1], Math.max(.5, item[3] * F / a[2]), 0, 7); ctx.fill() }
    else { const q = item[2].map(p => pr(p)); if (q.some(p => p[2] < .05)) return; ctx.globalAlpha = item[6]; drawPoly(ctx, q); ctx.fillStyle = item[3]; ctx.fill(); if (item[4]) { ctx.strokeStyle = item[4]; ctx.lineWidth = item[5] * DPR; ctx.stroke() } }
    ctx.globalAlpha = 1;
  }
  let need = true, raf = 0, interacting = false, fast = false;
  T.dirty = () => { need = true; if (!raf) raf = requestAnimationFrame(frame) };
  function frame(now) {
    raf = 0; if (!need) return; need = false;
    fast = interacting; setupCam(); render(now);
    let animating = false; active.forEach(v => { const s = animState(v, now); if (!s[3] && (v.out || now - v.t0 < 600)) animating = true; if (v.out && s[3]) active.delete(v.key) });
    active.forEach((v, k) => { if (v.out && now - v.out > 230) active.delete(k) });
    if (animating) T.dirty();
    opts.onFrame && opts.onFrame(interacting || animating);
  }
  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#d9d2c6'; ctx.fillRect(0, 0, W, H);
    // 1) taban (oda, masa, raf, mat) — kayıt sırasıyla, düz çizimler kendi sırasında
    const B = scene.base, bg = B.b || []; let bi = 0;
    B.o.forEach((o, idx) => {
      while (bi < bg.length && bg[bi][0] <= idx) paintBg(bg[bi++]);
      const L = []; faceList(o, 0, L, 1); L.sort((a, b) => b.z - a.z);
      for (const it of L) it.k ? paintCurve(ctx, it) : paintFace(ctx, it);
      paintDecals(ctx, o, 0);
    });
    while (bi < bg.length) paintBg(bg[bi++]);
    // 2) gölgeler (küçük tuvallerde çizip büyüterek yumuşat)
    const sc = sh.map(c => { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); return x });
    const shadowSet = [];
    (B.s || []).forEach(s => shadowSet.push([s, 1, 0]));
    active.forEach(v => { const st = animState(v, now); (v.d.s || []).forEach(s => shadowSet.push([s, st[2], 0])) });
    for (const [s, a] of shadowSet) {
      if (a <= 0) continue;
      const lvl = s[2] <= 3 ? 0 : s[2] <= 9 ? 1 : 2, k = [2, 4, 8][lvl], x = sc[lvl];
      const q = s[0].map(p => pr(p)); if (q.some(p => p[2] < .05)) continue;
      x.globalAlpha = Math.min(1, s[1] * a); x.fillStyle = '#100c08'; x.beginPath(); x.moveTo(q[0][0] / k, q[0][1] / k); for (let i = 1; i < q.length; i++) x.lineTo(q[i][0] / k, q[i][1] / k); x.closePath(); x.fill();
    }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    sh.forEach(c => ctx.drawImage(c, 0, 0, W, H));
    // 3) boş yuva izleri
    for (const g of ghosts) {
      const q = g[0].map(p => pr(p)); if (q.some(p => p[2] < .05)) continue;
      drawPoly(ctx, q); ctx.fillStyle = 'rgba(47,98,214,.12)'; ctx.fill();
      ctx.setLineDash([9 * DPR, 7 * DPR]); ctx.lineWidth = 2.2 * DPR; ctx.strokeStyle = g[1] ? '#2f62d6' : 'rgba(255,255,255,.95)'; ctx.stroke(); ctx.setLineDash([]);
    }
    // 4) nesneler: uzaktan yakına
    const objs = [];
    active.forEach(v => { const st = animState(v, now); if (st[1] <= 0) return; v.d.o.forEach(o => objs.push([o, st[0], st[1], pr(o.pt, st[0])[2]])) });
    objs.sort((a, b) => b[3] - a[3]);
    for (const [o, dy, al] of objs) {
      const L = []; faceList(o, dy, L, al); L.sort((a, b) => b.z - a.z);
      ctx.globalAlpha = al;
      for (const it of L) it.k ? paintCurve(ctx, it) : paintFace(ctx, it);
      paintDecals(ctx, o, dy); ctx.globalAlpha = 1;
    }
  }
  // seçim tamponu: her öğe kendi renginde
  T.pickAt = function (cx, cy, regions) {   // regions: [{id, pts}] (boş yuva alanları)
    setupCam();
    const s = 1 / DPR; pctx.setTransform(s, 0, 0, s, 0, 0); pctx.imageSmoothingEnabled = false;
    pctx.fillStyle = '#000'; pctx.fillRect(0, 0, W, H);
    const ids = [];
    const col = i => `rgb(${(i + 1) & 255},${((i + 1) >> 8) & 255},7)`;
    regions.forEach(r => { ids.push(r.id); const q = r.pts.map(p => pr(p)); if (q.some(p => p[2] < .05)) return; drawPoly(pctx, q); pctx.fillStyle = col(ids.length - 1); pctx.fill(); pctx.lineWidth = 14; pctx.strokeStyle = col(ids.length - 1); pctx.stroke() });
    const objs = [];
    active.forEach((v, key) => { if (v.out) return; v.d.o.forEach(o => objs.push([o, key, pr(o.pt)[2]])) });
    objs.sort((a, b) => b[2] - a[2]);
    for (const [o, key] of objs) {
      ids.push(key); const c = col(ids.length - 1);
      const L = []; faceList(o, 0, L, 1); L.sort((a, b) => b.z - a.z);
      for (const d of o.d) { const [tl, tr, bl] = d, br = [tr[0] + bl[0] - tl[0], tr[1] + bl[1] - tl[1], tr[2] + bl[2] - tl[2]]; const q = [tl, tr, br, bl].map(p => pr(p)); if (q.some(p => p[2] < .05)) continue; drawPoly(pctx, q); pctx.fillStyle = c; pctx.fill() }
      for (const it of L) { if (it.k) { const q = it.q; pctx.beginPath(); pctx.moveTo(q[0][0], q[0][1]); q.forEach(p => pctx.lineTo(p[0], p[1])); pctx.strokeStyle = c; pctx.lineWidth = Math.max(10, it.c[2] * 4); pctx.stroke() } else { drawPoly(pctx, it.q); pctx.fillStyle = c; pctx.fill(); pctx.lineWidth = 6; pctx.strokeStyle = c; pctx.stroke() } }
    }
    // dokunulan yerin çevresinde en yakın dolu piksel
    const r = 10, d = pctx.getImageData(Math.max(0, cx - r), Math.max(0, cy - r), 2 * r + 1, 2 * r + 1).data;
    let best = null, bd = 1e9;
    for (let y = 0; y <= 2 * r; y++) for (let x = 0; x <= 2 * r; x++) {
      const i = (y * (2 * r + 1) + x) * 4; if (d[i + 2] !== 7) continue;
      const id = d[i] + (d[i + 1] << 8) - 1, dd = (x - r) ** 2 + (y - r) ** 2;
      if (dd < bd) { bd = dd; best = ids[id] }
    }
    return best;
  };
  // kamera kontrolleri
  T.cam = cam;
  T.reset = function (dur = 450) {
    const s = Object.assign({}, cam), t0 = performance.now();
    (function step() { const t = Math.min(1, (performance.now() - t0) / dur), e = 1 - (1 - t) ** 3; for (const k in DEF) cam[k] = s[k] + (DEF[k] - s[k]) * e; T.dirty(); if (t < 1) requestAnimationFrame(step) })();
  };
  T.setDefault = v => { Object.assign(DEF, v); };
  const clamp = () => {
    cam.yaw = Math.max(-1.15, Math.min(1.15, cam.yaw)); cam.pitch = Math.max(.08, Math.min(1.0, cam.pitch));
    cam.dist = Math.max(.55, Math.min(3.4, cam.dist));
    cam.tx = Math.max(-1.0, Math.min(1.0, cam.tx)); cam.ty = Math.max(.75, Math.min(1.45, cam.ty)); cam.tz = Math.max(-.45, Math.min(.35, cam.tz));
  };
  const pts = new Map(); let start = null, lastTap = 0, moved = false;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: performance.now(), pan: e.button === 2 || e.shiftKey }; moved = false }
    interacting = true;
  });
  let pinch0 = null;
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 6) moved = true;
      if (!moved) return;
      if (start.pan) panBy(dx, dy); else { cam.yaw -= dx * .006; cam.pitch += dy * .005 }
      clamp(); T.dirty();
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (pinch0) { cam.dist *= pinch0.d / d; panBy(m[0] - pinch0.m[0], m[1] - pinch0.m[1]); clamp(); T.dirty() }
      pinch0 = { d, m }; moved = true;
    }
  });
  function panBy(dx, dy) { const k = cam.dist / (F / DPR); cam.tx -= (R[0] * dx - U[0] * dy) * k; cam.ty -= (R[1] * dx - U[1] * dy) * k * .6; cam.tz -= (R[2] * dx - U[2] * dy) * k }
  const up = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null;
    if (pts.size === 0) {
      interacting = false; T.dirty();
      const now = performance.now();
      if (!moved && start && now - start.t < 450) {
        const r = canvas.getBoundingClientRect();
        if (now - lastTap < 300) { T.reset(); lastTap = 0; return }
        lastTap = now; opts.onTap && opts.onTap(e.clientX - r.left, e.clientY - r.top);
      }
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist *= Math.exp(e.deltaY * .0012); clamp(); interacting = true; T.dirty(); clearTimeout(T._w); T._w = setTimeout(() => { interacting = false; T.dirty() }, 200) }, { passive: false });
  T.resize = resize;
  new ResizeObserver(resize).observe(canvas);
  resize(); setupCam();
  return T;
};
})();
