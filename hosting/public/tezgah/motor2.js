// Tezgâh canlı 3B çizici — WebGL2 (ekran kartı). Sahne verisi: scene.json (dünya koordinatlı yüzler, çıkartmalar, kablolar, gölgeler).
// Derinlik tamponu sayesinde parçalar hiçbir açıda birbirinin önüne yanlış geçmez; her ürün ayrı tamponda, iniş animasyonu tek değişkenle.
(function () {
const LIGHT = (() => { const v = [-0.45, 0.85, 0.55], l = Math.hypot(...v); return v.map(x => x / l) })();
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function shade(col, n, spec) {   // tez3d.shade ile aynı ışık
  const c = hex(col), l = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]), f = .54 + .56 * l;
  const warm = [255, 246, 232], cool = [52, 62, 84];
  return c.map((x, i) => { let v = x * f + (spec || 0) * 255 * l ** 8; v = v * (1 - .07 * l) + warm[i] * .07 * l; v = v * (1 - .07 * (1 - l)) + cool[i] * .07 * (1 - l); return Math.max(0, Math.min(255, v)) });
}
const DEFS = '<defs><filter id="glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
  + '<filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>'
  + '<linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity=".04"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>';
const VS = `#version 300 es
in vec3 a_pos; in vec4 a_col; in vec2 a_uv;
uniform vec3 uP, uR, uU, uF; uniform float uFx, uFy, uDy;
out vec4 v_col; out vec2 v_uv;
void main(){ vec3 d = a_pos + vec3(0.0, uDy, 0.0) - uP;
  float cx = dot(d, uR), cy = dot(d, uU), cz = dot(d, uF); const float n = 0.03, f = 30.0;
  gl_Position = vec4(uFx * cx, uFy * cy, (cz * (f + n) - 2.0 * f * n) / (f - n), cz); v_col = a_col; v_uv = a_uv; }`;
const FS = `#version 300 es
precision highp float; in vec4 v_col; in vec2 v_uv; uniform int uMode; uniform float uA; uniform sampler2D uTex; uniform vec4 uId; out vec4 o;
void main(){ if (uMode == 2) { o = uId; return; }
  vec4 c = uMode == 1 ? texture(uTex, v_uv) : v_col; if (c.a * uA < 0.004) discard; o = vec4(c.rgb, c.a * uA); }`;

const T = {}; window.Tezgah = T;
T.init = function (canvas, scene, opts) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) { opts.onFail && opts.onFail(); return null }
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  const U = {}; ['uP', 'uR', 'uU', 'uF', 'uFx', 'uFy', 'uDy', 'uMode', 'uA', 'uTex', 'uId'].forEach(k => U[k] = gl.getUniformLocation(prog, k));
  const A = { pos: gl.getAttribLocation(prog, 'a_pos'), col: gl.getAttribLocation(prog, 'a_col'), uv: gl.getAttribLocation(prog, 'a_uv') };
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function Mesh() { this.p = []; this.c = []; this.t = [] }
  Mesh.prototype.tri = function (a, b, c, ca, cb, cc, ta, tb, tc) { this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); this.c.push(...ca, ...cb, ...cc); this.t.push(...(ta || [0, 0]), ...(tb || [0, 0]), ...(tc || [0, 0])) };
  function upload(m) {
    if (!m.p.length) return null;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = (data, loc, size, type, norm) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0) };
    buf(new Float32Array(m.p), A.pos, 3, gl.FLOAT, false); buf(new Uint8Array(m.c), A.col, 4, gl.UNSIGNED_BYTE, true); buf(new Float32Array(m.t), A.uv, 2, gl.FLOAT, false);
    gl.bindVertexArray(null); return { vao, n: m.p.length / 3 };
  }
  const C4 = (c, a = 255) => [c[0] | 0, c[1] | 0, c[2] | 0, a];
  function addFaces(m, o) {
    for (const f of o.f) {
      const pts = f[0], n = f[2], ex = f[3] || {}, base = shade(f[1], n, ex.s), grad = ex.g !== 0 && pts.length >= 4;
      const axis = Math.abs(n[1]) > .7 ? 2 : 1; let lo = 1e9, hi = -1e9;
      for (const p of pts) { lo = Math.min(lo, p[axis]); hi = Math.max(hi, p[axis]) }
      const col = p => {
        if (!grad || hi - lo < 1e-6) return C4(base);
        const t = (p[axis] - lo) / (hi - lo);
        if (axis === 1) return C4(base.map(v => Math.min(255, (v * 1.1 + 7) * t + v * .8 * (1 - t))));       // dikey yüz: üst açık, alt koyu
        if (n[1] > 0) return C4(base.map(v => Math.min(255, v * .94 * (1 - t) + (v * 1.06 + 4) * t)));      // üst yüz: arka koyu, ön açık
        return C4(base);
      };
      const cs = pts.map(col);
      for (let i = 1; i < pts.length - 1; i++) m.tri(pts[0], pts[i], pts[i + 1], cs[0], cs[i], cs[i + 1]);
    }
    for (const c of o.c) tube(m, c[0], c[1], Math.max(.0011, c[2] * .00072));
  }
  function tube(m, Q, colHex, r) {   // kablo: 6 köşeli boru
    const N = 6; let prev = null;
    for (let i = 0; i < Q.length; i++) {
      const a = Q[Math.max(0, i - 1)], b = Q[Math.min(Q.length - 1, i + 1)];
      let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const l = Math.hypot(...t) || 1; t = t.map(x => x / l);
      const u = Math.abs(t[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      let e1 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]]; const l1 = Math.hypot(...e1) || 1; e1 = e1.map(x => x / l1);
      const e2 = [t[1] * e1[2] - t[2] * e1[1], t[2] * e1[0] - t[0] * e1[2], t[0] * e1[1] - t[1] * e1[0]];
      const ring = [], cols = [];
      for (let k = 0; k < N; k++) { const g = 2 * Math.PI * k / N, nn = [0, 1, 2].map(j => e1[j] * Math.cos(g) + e2[j] * Math.sin(g));
        ring.push([Q[i][0] + nn[0] * r, Q[i][1] + nn[1] * r, Q[i][2] + nn[2] * r]); cols.push(C4(shade(colHex, nn, .2))) }
      if (prev) for (let k = 0; k < N; k++) { const k2 = (k + 1) % N; m.tri(prev.r[k], prev.r[k2], ring[k2], prev.c[k], prev.c[k2], cols[k2]); m.tri(prev.r[k], ring[k2], ring[k], prev.c[k], cols[k2], cols[k]) }
      prev = { r: ring, c: cols };
    }
  }
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  function texFromCanvas(cv) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return t;
  }
  const texCache = new Map();
  function decalTex(w, h, svg) {
    const key = w + 'x' + h + svg; let e = texCache.get(key); if (e) return e;
    e = { tex: null }; texCache.set(key, e);
    const k = Math.max(2, Math.min(6, 1024 / Math.max(w, h))), im = new Image(), cw = Math.round(w * k), ch = Math.round(h * k);
    im.onload = () => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; cv.getContext('2d').drawImage(im, 0, 0, cw, ch); e.tex = texFromCanvas(cv); T.dirty() };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 ${w} ${h}" font-family="Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${DEFS}${svg}</svg>`);
    return e;
  }
  function blurCanvas(src, px) {   // her tarayıcıda çalışan bulanıklık: küçült-büyüt
    if (px < .8) return src;
    const s = Math.max(1, px / 1.2), w = Math.max(2, Math.round(src.width / s)), h = Math.max(2, Math.round(src.height / s));
    const a = document.createElement('canvas'); a.width = w; a.height = h; const ax = a.getContext('2d'); ax.imageSmoothingQuality = 'high'; ax.drawImage(src, 0, 0, w, h);
    const b = document.createElement('canvas'); b.width = src.width; b.height = src.height; const bx = b.getContext('2d'); bx.imageSmoothingQuality = 'high'; bx.drawImage(a, 0, 0, b.width, b.height);
    return b;
  }
  function quadMesh(p, uv) { const m = new Mesh(), w = [255, 255, 255, 255]; m.tri(p[0], p[1], p[2], w, w, w, uv[0], uv[1], uv[2]); m.tri(p[0], p[2], p[3], w, w, w, uv[0], uv[2], uv[3]); return upload(m) }
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  function shadowMeshes(list) {   // gölge çokgenleri → düzlem başına bulanık doku + yatay dörtgen
    const groups = new Map();
    for (const s of list) { const y = Math.round(s[0][0][1] * 1000) / 1000; if (!groups.has(y)) groups.set(y, []); groups.get(y).push(s) }
    const out = [];
    groups.forEach((L, y) => {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const s of L) for (const p of s[0]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]) }
      x0 -= .06; x1 += .06; z0 -= .06; z1 += .06;
      const res = Math.min(700, Math.max(80, 520 / Math.max(.3, Math.max(x1 - x0, z1 - z0))));
      const Wc = Math.min(1024, Math.ceil((x1 - x0) * res)), Hc = Math.min(1024, Math.ceil((z1 - z0) * res)), sx = Wc / (x1 - x0), sz = Hc / (z1 - z0);
      const fin = document.createElement('canvas'); fin.width = Wc; fin.height = Hc; const fx = fin.getContext('2d');
      for (const b of [2, 9, 22]) {
        const part = L.filter(s => (s[2] <= 3 ? 2 : s[2] <= 9 ? 9 : 22) === b); if (!part.length) continue;
        const cv = document.createElement('canvas'); cv.width = Wc; cv.height = Hc; const x = cv.getContext('2d');
        for (const s of part) { x.globalAlpha = Math.min(1, s[1]); x.fillStyle = '#100c08'; x.beginPath(); s[0].forEach((p, i) => { const X = (p[0] - x0) * sx, Z = (p[2] - z0) * sz; i ? x.lineTo(X, Z) : x.moveTo(X, Z) }); x.closePath(); x.fill() }
        fx.drawImage(blurCanvas(cv, b * .0014 * res), 0, 0);
      }
      const Y = y + .0006;
      out.push({ mesh: quadMesh([[x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1]], UV), tex: texFromCanvas(fin) });
    });
    return out;
  }
  function buildItem(d) {
    const m = new Mesh(); d.o.forEach(o => addFaces(m, o));
    const decals = [];
    d.o.forEach(o => o.d.forEach(dc => { const [tl, tr, bl, w, h, svg, n] = dc, br = [tr[0] + bl[0] - tl[0], tr[1] + bl[1] - tl[1], tr[2] + bl[2] - tl[2]], e = .0003, off = p => [p[0] + n[0] * e, p[1] + n[1] * e, p[2] + n[2] * e];
      decals.push({ mesh: quadMesh([off(tl), off(tr), off(br), off(bl)], UV), t: decalTex(w, h, svg), n, p: tl }) }));
    return { mesh: upload(m), decals, shadows: d.s ? shadowMeshes(d.s) : [] };
  }
  function buildBase() {   // taban yüzleri + düz çizimler (çizgi = ince şerit, delik = sekizgen, çokgen)
    const B = scene.base, m = new Mesh(); B.o.forEach(o => addFaces(m, o));
    const tm = new Mesh();
    for (const it of B.b || []) {
      const t = it[1];
      if (t === 'l') {
        const a = it[2], b = it[3], c = C4(hex(it[4]), Math.round(255 * it[6])), w = it[5] * .0011 / 2;
        const nrm = Math.abs(a[0] + 2.366) < .02 ? [1, 0, 0] : (Math.abs(a[1] - b[1]) > 1e-5 || (a[1] > 1.1 && Math.abs(a[2] + .5) < .05 && Math.abs(a[2] - b[2]) < 1e-6 && a[1] > 1.3)) ? [0, 0, 1] : [0, 1, 0];
        const dv = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...dv) || 1;
        let pv = [dv[1] * nrm[2] - dv[2] * nrm[1], dv[2] * nrm[0] - dv[0] * nrm[2], dv[0] * nrm[1] - dv[1] * nrm[0]].map(x => x / L * w);
        const lift = nrm.map(x => x * .0005);
        const A1 = [a[0] + pv[0] + lift[0], a[1] + pv[1] + lift[1], a[2] + pv[2] + lift[2]], A2 = [a[0] - pv[0] + lift[0], a[1] - pv[1] + lift[1], a[2] - pv[2] + lift[2]];
        const B1 = [b[0] + pv[0] + lift[0], b[1] + pv[1] + lift[1], b[2] + pv[2] + lift[2]], B2 = [b[0] - pv[0] + lift[0], b[1] - pv[1] + lift[1], b[2] - pv[2] + lift[2]];
        tm.tri(A1, B1, B2, c, c, c); tm.tri(A1, B2, A2, c, c, c);
      } else if (t === 'd') { const p = it[2], r = it[3], c = C4(hex(it[4]), Math.round(255 * it[5])), z = p[2] + .0006;
        for (let k = 0; k < 8; k++) { const a1 = k * Math.PI / 4, a2 = (k + 1) * Math.PI / 4; tm.tri([p[0], p[1], z], [p[0] + r * Math.cos(a1), p[1] + r * Math.sin(a1), z], [p[0] + r * Math.cos(a2), p[1] + r * Math.sin(a2), z], c, c, c) }
      } else { const pts = it[2], c = C4(hex(it[3]), Math.round(255 * it[6])); for (let i = 1; i < pts.length - 1; i++) tm.tri(pts[0], pts[i], pts[i + 1], c, c, c) }
    }
    return { mesh: upload(m), top: upload(tm), shadows: B.s ? shadowMeshes(B.s) : [], decals: [] };
  }
  const ghostTex = {};
  function gTex(vert) {
    const k = vert ? 'v' : 'h'; if (ghostTex[k]) return ghostTex[k];
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    x.fillStyle = 'rgba(47,98,214,.14)'; x.fillRect(0, 0, 256, 256); x.setLineDash([22, 16]); x.lineWidth = 10; x.strokeStyle = vert ? '#2f62d6' : 'rgba(255,255,255,.95)'; x.strokeRect(6, 6, 244, 244);
    return ghostTex[k] = texFromCanvas(cv);
  }
  const ghostCache = new Map();
  function ghostMesh(g) { const key = JSON.stringify(g[0]); let e = ghostCache.get(key); if (!e) { const p = g[0].map(q => [q[0], q[1] + (g[1] ? 0 : .0008), q[2] + (g[1] ? .001 : 0)]); e = { mesh: quadMesh(p, UV), tex: gTex(g[1]) }; ghostCache.set(key, e) } return e }

  const BASE = buildBase(), items = new Map();
  const getItem = k => { let e = items.get(k); if (!e && scene.items[k]) { e = buildItem(scene.items[k]); items.set(k, e) } return e };
  T.preload = keys => keys.forEach(getItem);

  // ---- kamera ----
  let W = 2, H = 2, DPR = 1, F = 1;
  const DEF = Object.assign({ yaw: .55, pitch: .27, dist: 2.02, tx: -.04, ty: .98, tz: -.14 }, opts.view || {});
  const cam = Object.assign({}, DEF), goal = Object.assign({}, DEF);
  let P = [0, 0, 0], R = [1, 0, 0], Uv = [0, 1, 0], Fw = [0, 0, -1];
  function setupCam() {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    P = [cam.tx + cam.dist * cp * Math.sin(cam.yaw), cam.ty + cam.dist * sp, cam.tz + cam.dist * cp * Math.cos(cam.yaw)];
    Fw = [cam.tx - P[0], cam.ty - P[1], cam.tz - P[2]]; let l = Math.hypot(...Fw); Fw = Fw.map(x => x / l);
    R = [-Fw[2], 0, Fw[0]]; l = Math.hypot(...R); R = R.map(x => x / l);
    Uv = [R[1] * Fw[2] - R[2] * Fw[1], R[2] * Fw[0] - R[0] * Fw[2], R[0] * Fw[1] - R[1] * Fw[0]];
  }
  T.project = p => { const x = p[0] - P[0], y = p[1] - P[1], z = p[2] - P[2], cx = x * R[0] + y * R[1] + z * R[2], cy = x * Uv[0] + y * Uv[1] + z * Uv[2], cz = x * Fw[0] + y * Fw[1] + z * Fw[2];
    return [(W / 2 + F * cx / cz) / DPR, (H / 2 - F * cy / cz) / DPR, cz] };
  let pickFB = null, pw = 0, ph = 0;
  function resize() {
    const r = canvas.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, Math.round(r.width * DPR)); H = Math.max(2, Math.round(r.height * DPR)); canvas.width = W; canvas.height = H;
    F = Math.min(W, H * 1.5) * (1400 / 1536) * (opts.fov || 1); pickFB = null; T.dirty();
  }
  // ---- etkin öğeler + animasyon ----
  const active = new Map();
  T.set = function (keys, anim) {
    const now = performance.now(), want = new Set(keys);
    active.forEach((v, k) => { if (!want.has(k) && !v.out) v.out = now });
    keys.forEach(k => { if (!scene.items[k]) return; const v = active.get(k); if (!v || v.out) active.set(k, { t0: anim ? now : now - 9999, out: 0 }) });
    T.dirty();
  };
  let ghosts = []; T.ghosts = l => { ghosts = l; T.dirty() };
  const easeBack = t => { const c = 1.5; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t };
  function st(v, now) { if (v.out) { const t = Math.min(1, (now - v.out) / 220); return [.03 * t, 1 - t, 1 - t, t >= 1] }
    const t = Math.max(0, Math.min(1, (now - v.t0) / 560)); return [.14 * (1 - easeBack(t)), Math.min(1, t * 2.2), Math.max(0, (t - .15) / .85), t >= 1] }
  function setU(dy, a, mode) { gl.uniform1f(U.uDy, dy); gl.uniform1f(U.uA, a); gl.uniform1i(U.uMode, mode) }
  function draw(m) { if (!m) return; gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n) }
  function camUniforms(w, h) { gl.uniform3fv(U.uP, P); gl.uniform3fv(U.uR, R); gl.uniform3fv(U.uU, Uv); gl.uniform3fv(U.uF, Fw); gl.uniform1f(U.uFx, 2 * F / W); gl.uniform1f(U.uFy, 2 * F / H) }
  function drawDecals(e, dy, a) {
    for (const d of e.decals) { if (!d.t.tex) continue; const n = d.n; if (n[0] * (P[0] - d.p[0]) + n[1] * (P[1] - d.p[1] - dy) + n[2] * (P[2] - d.p[2]) <= 0) continue;
      gl.bindTexture(gl.TEXTURE_2D, d.t.tex); setU(dy, a, 1); draw(d.mesh) }
  }
  function drawShadows(e, a) { if (a <= 0) return; for (const s of e.shadows) { gl.bindTexture(gl.TEXTURE_2D, s.tex); setU(0, a, 1); draw(s.mesh) } }
  function render(now) {
    gl.viewport(0, 0, W, H); gl.clearColor(.85, .82, .78, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    camUniforms(); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(U.uTex, 0);
    gl.depthMask(true); setU(0, 1, 0); draw(BASE.mesh);
    const list = []; active.forEach((v, k) => { const e = getItem(k); if (e) list.push([e, st(v, now)]) });
    for (const [e, s] of list) if (s[1] >= 1) { setU(s[0], 1, 0); draw(e.mesh) }
    gl.depthMask(false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    setU(0, 1, 0); draw(BASE.top);
    drawShadows(BASE, 1); for (const [e, s] of list) drawShadows(e, s[2]);
    for (const g of ghosts) { const gm = ghostMesh(g); gl.bindTexture(gl.TEXTURE_2D, gm.tex); setU(0, 1, 1); draw(gm.mesh) }
    gl.polygonOffset(-2, -4);
    for (const [e, s] of list) if (s[1] >= 1) drawDecals(e, s[0], 1);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true);
    for (const [e, s] of list) if (s[1] > 0 && s[1] < 1) { setU(s[0], s[1], 0); draw(e.mesh); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4); gl.depthMask(false); drawDecals(e, s[0], s[1]); gl.depthMask(true); gl.disable(gl.POLYGON_OFFSET_FILL) }
  }
  // ---- seçim tamponu ----
  function ensurePick() {
    const w = Math.max(2, Math.round(canvas.clientWidth)), h = Math.max(2, Math.round(canvas.clientHeight));
    if (pickFB && pw === w && ph === h) return; pw = w; ph = h;
    pickFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, pickFB);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null);
  }
  const regionCache = new Map();
  T.pickAt = function (x, y, regions) {
    setupCam(); ensurePick(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null); gl.bindFramebuffer(gl.FRAMEBUFFER, pickFB); gl.viewport(0, 0, pw, ph);
    gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); camUniforms();
    const ids = [], idc = i => [((i + 1) & 255) / 255, (((i + 1) >> 8) & 255) / 255, 7 / 255, 1];
    gl.uniform4fv(U.uId, [0, 0, 0, 0]); setU(0, 1, 2); draw(BASE.mesh);
    active.forEach((v, k) => { if (v.out) return; const e = getItem(k); if (!e) return; ids.push(k); gl.uniform4fv(U.uId, idc(ids.length - 1)); setU(0, 1, 2); draw(e.mesh); for (const d of e.decals) draw(d.mesh) });
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    regions.forEach(r => { const key = JSON.stringify(r.pts); let m = regionCache.get(key); if (!m) { m = quadMesh(r.pts, UV); regionCache.set(key, m) }
      ids.push(r.id); gl.uniform4fv(U.uId, idc(ids.length - 1)); setU(0, 1, 2); draw(m) });
    gl.disable(gl.POLYGON_OFFSET_FILL);
    const R2 = 6, n = 2 * R2 + 1, px = new Uint8Array(n * n * 4), X = Math.max(0, Math.round(x) - R2), Y = Math.max(0, ph - Math.round(y) - 1 - R2);
    gl.readPixels(X, Y, n, n, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (T._dump) { const all = new Uint8Array(pw * ph * 4); gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, all); T._dump = { w: pw, h: ph, d: Array.from(all.filter((_, i) => i % 4 === 0)) } }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.enable(gl.BLEND); T.dirty();
    let best = null, bd = 1e9;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const o = (j * n + i) * 4; if (px[o + 2] !== 7) continue; const id = px[o] + (px[o + 1] << 8) - 1, dd = (i - R2) ** 2 + (j - R2) ** 2; if (dd < bd) { bd = dd; best = ids[id] } }
    return best;
  };
  // ---- kare döngüsü ----
  let need = true, raf = 0, dragging = false, vel = { yaw: 0, pitch: 0 };
  T.dirty = () => { need = true; if (!raf) raf = requestAnimationFrame(frame) };
  const lim = g => { g.yaw = Math.max(-1.2, Math.min(1.2, g.yaw)); g.pitch = Math.max(.06, Math.min(1.05, g.pitch)); g.dist = Math.max(.5, Math.min(3.4, g.dist));
    g.tx = Math.max(-1.1, Math.min(1.1, g.tx)); g.ty = Math.max(.75, Math.min(1.5, g.ty)); g.tz = Math.max(-.45, Math.min(.4, g.tz)) };
  function follow() {
    let busy = false;
    if (!dragging && (Math.abs(vel.yaw) > 1e-4 || Math.abs(vel.pitch) > 1e-4)) { goal.yaw += vel.yaw; goal.pitch += vel.pitch; vel.yaw *= .92; vel.pitch *= .92; lim(goal); busy = true }
    for (const k of ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz']) { const d = goal[k] - cam[k]; if (Math.abs(d) > 1e-4) { cam[k] += d * .25; busy = true } else cam[k] = goal[k] }
    return busy;
  }
  function frame(now) {
    raf = 0; if (!need) return; need = false;
    const moving = follow(); setupCam(); render(now);
    let anim = false; active.forEach((v, k) => { const s = st(v, now); if (v.out && s[3]) active.delete(k); else if (!s[3]) anim = true });
    if (anim || moving) T.dirty();
    opts.onFrame && opts.onFrame(dragging || moving);
  }
  // ---- kontroller ----
  // Fare: sol tuş = kaydır, sağ tuş = döndür, tekerlek = imlece doğru yaklaş. Dokunmatik: tek parmak = döndür, iki parmak = yaklaş + kaydır.
  T.cam = goal;
  T.reset = () => { Object.assign(goal, DEF); vel = { yaw: 0, pitch: 0 }; T.dirty() };
  T.nudge = (k, v) => { goal[k] += v; lim(goal); T.dirty() };
  function panBy(dx, dy) { const k = goal.dist / (F / DPR); goal.tx -= (R[0] * dx - Uv[0] * dy) * k; goal.ty -= (R[1] * dx - Uv[1] * dy) * k * .6; goal.tz -= (R[2] * dx - Uv[2] * dy) * k; lim(goal) }
  function zoomAt(f, sx, sy) { const ox = sx - canvas.clientWidth / 2, oy = sy - canvas.clientHeight / 2, d0 = goal.dist; goal.dist *= f; lim(goal); const g = 1 - goal.dist / d0; panBy(-ox * g, -oy * g); T.dirty() }
  T.zoom = f => zoomAt(f, canvas.clientWidth / 2, canvas.clientHeight / 2);
  const pts = new Map(); let start = null, lastTap = 0, moved = false, pinch0 = null, lastMove = 0, mode = 'rot', blockMenu = 0;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: performance.now(), btn: e.button }; moved = false; vel = { yaw: 0, pitch: 0 }; mode = e.pointerType === 'mouse' ? (e.button === 2 ? 'rot' : 'pan') : 'rot' }
    dragging = true;
  });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (!moved && Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 6) moved = true;
      if (!moved) return;
      if (mode === 'pan') panBy(dx, dy); else { const s = 3.2 / Math.max(300, canvas.clientWidth); goal.yaw -= dx * s; goal.pitch += dy * s * .8; vel = { yaw: -dx * s, pitch: dy * s * .8 }; lim(goal) }
      lastMove = performance.now(); T.dirty();
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r = canvas.getBoundingClientRect();
      if (pinch0) { zoomAt(pinch0.d / d, m[0] - r.left, m[1] - r.top); panBy(m[0] - pinch0.m[0], m[1] - pinch0.m[1]) }
      pinch0 = { d, m }; moved = true; vel = { yaw: 0, pitch: 0 }; T.dirty();
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null;
    if (pts.size) return;
    dragging = false; if (moved || start.btn === 2) blockMenu = performance.now();
    if (performance.now() - lastMove > 80 || mode === 'pan') vel = { yaw: 0, pitch: 0 };
    T.dirty();
    const now = performance.now();
    if (!moved && start && start.btn !== 2 && now - start.t < 450) {
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (now - lastTap < 280) { lastTap = 0; T.reset(); return }
      lastTap = now; setTimeout(() => { if (lastTap === now) opts.onTap && opts.onTap(x, y) }, e.pointerType === 'mouse' ? 0 : 230);
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  window.addEventListener('contextmenu', e => { if (e.target === canvas || dragging || performance.now() - blockMenu < 800) e.preventDefault() }, true);
  canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(Math.exp(e.deltaY * .0013), e.clientX - r.left, e.clientY - r.top) }, { passive: false });
  T.resize = resize; new ResizeObserver(resize).observe(canvas); resize(); setupCam();
  return T;
};
})();
