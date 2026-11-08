// Tanıtım videosu müziği (8.11.2026) — telifsiz: tarayıcıda Web Audio ile üretilir, dosya yok.
// 'tok' = 100 vuruş/dk, A minör (Am–F–C–G), kalın ama bozulmayan bas. Sahne geçişleri vuruş ızgarasına oturur
// (filmin sahne t0'ları 0,6 sn'nin katı + 0,4 olmalı: 2.2, 5.2, 8.2, 10.6, 13.0 …). Görüntü saati müziğe bağlı (now()).
// Aynı kod mp4 çıkarırken OfflineAudioContext ile de çalışır (render(ctx, sahneler, süre)).
export const BEAT = 0.6;
const CH = [[110, 130.81, 164.81], [87.31, 110, 130.81], [130.81, 164.81, 196], [98, 123.47, 146.83]];
const SUB = [55, 43.65, 65.41, 49];

function graph(ctx) {
  const master = ctx.createGain(); master.gain.value = 0.8;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  const bus = ctx.createGain(); bus.gain.value = 0.85;
  // sub bölgesindeki çakışmaları toparla: 30 Hz altı kes
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30;
  bus.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(master); master.connect(ctx.destination);
  const verb = ctx.createConvolver(); const L = Math.floor(ctx.sampleRate * 2.2); const ir = ctx.createBuffer(2, L, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let seed = 7 + c; for (let i = 0; i < L; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / L, 3.5); } }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.45; verb.connect(vg); vg.connect(bus);
  return { master, bus, verb };
}

// t0'dan itibaren bütün sesleri `start` anına göre planlar; düğümleri döndürür (durdurmak için)
export function schedule(ctx, G, cuts, end, t0, start) {
  const nodes = [];
  const at = (x) => start + (x - t0), ok = (x) => x >= t0 - 0.001;
  const out = (wet) => { const g = ctx.createGain(); g.connect(G.bus); if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(G.verb); } return g; };
  const keep = (n, a, b) => { n.start(a); n.stop(b); nodes.push(n); };
  const env = (g, a, att, peak, hold, rel) => { g.gain.setValueAtTime(0.0001, a); g.gain.linearRampToValueAtTime(peak, a + att); g.gain.setValueAtTime(peak, a + att + hold); g.gain.exponentialRampToValueAtTime(0.0001, a + att + hold + rel); };
  let nb = null; const noise = () => { if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); let s = 3; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } } const n = ctx.createBufferSource(); n.buffer = nb; return n; };
  const pad = (a, dur, fr) => { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 560; f.Q.value = 0.5; const g = ctx.createGain(); env(g, a, 1.0, 0.05, Math.max(0, dur - 1.3), 1.5); f.connect(g); g.connect(out(0.35));
    fr.forEach((x) => { [-6, 6].forEach((dt) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = x; o.detune.value = dt; o.connect(f); keep(o, a, a + dur + 1.7); }); }); };
  const sub = (a, dur, fr) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const g = ctx.createGain(); env(g, a, 0.08, 0.13, Math.max(0, dur - 0.35), 0.25); o.connect(g); g.connect(out(0)); keep(o, a, a + dur + 0.4); };
  // tok ama temiz bas davul: distorsiyon yok, kısa tık + pes sinüs; aynı anda çalan sub'u kısa süre bastırır (sidechain hissi)
  const kick = (a, v = 0.55) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, a); o.frequency.exponentialRampToValueAtTime(52, a + 0.07); o.frequency.exponentialRampToValueAtTime(44, a + 0.3);
    const g = ctx.createGain(); env(g, a, 0.003, v, 0.03, 0.3); o.connect(g); g.connect(out(0)); keep(o, a, a + 0.42);
    const n = noise(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; const gn = ctx.createGain(); env(gn, a, 0.001, v * 0.08, 0, 0.02); n.connect(f); f.connect(gn); gn.connect(out(0)); keep(n, a, a + 0.05); };
  const clap = (a) => { const n = noise(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.8; const g = ctx.createGain(); env(g, a, 0.003, 0.08, 0.01, 0.15); n.connect(f); f.connect(g); g.connect(out(0.3)); keep(n, a, a + 0.25); };
  const pluck = (a, fr, v = 0.06) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2000, a); f.frequency.exponentialRampToValueAtTime(320, a + 0.5); const g = ctx.createGain(); env(g, a, 0.004, v, 0, 0.7); o.connect(f); f.connect(g); g.connect(out(0.5)); keep(o, a, a + 0.9); };
  const swell = (a) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(58, a); o.frequency.exponentialRampToValueAtTime(40, a + 0.9); const g = ctx.createGain(); env(g, a, 0.02, 0.12, 0.05, 0.8); o.connect(g); g.connect(out(0.2)); keep(o, a, a + 1.0); };

  const bar = 8 * BEAT, first = cuts[0] ?? 2.2;
  for (let i = 0; 0.4 + i * bar < end; i++) {
    const s = 0.4 + i * bar, e = Math.min(s + bar, end); if (e <= t0) continue; const s2 = Math.max(s, t0);
    pad(at(s2), e - s2, CH[i % 4]);
    const ss = Math.max(s2, first); if (e > ss) sub(at(ss), e - ss, SUB[i % 4]);
  }
  pad(at(Math.max(end, t0)), 3.4, [110, 164.81, 246.94, 329.63]); sub(at(Math.max(end, t0)), 2.4, 55);
  const cutSet = new Set(cuts.map((c) => Math.round(c * 10)));
  for (let x = first, k = 0; x < end - 0.01; x += BEAT, k++) {
    const isCut = cutSet.has(Math.round(x * 10));
    if (ok(x)) kick(at(x), isCut ? 0.68 : k % 4 === 0 ? 0.56 : 0.48);
    if (k % 2 === 1 && x >= (cuts[1] ?? 5.2) && ok(x)) clap(at(x));
    if (ok(x + BEAT / 2) && x + BEAT / 2 >= (cuts[1] ?? 5.2)) { /* sekizlik: sadece hafif tık */ const n = noise(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = ctx.createGain(); env(g, at(x + BEAT / 2), 0.002, 0.025, 0, 0.05); n.connect(f); f.connect(g); g.connect(out(0.1)); keep(n, at(x + BEAT / 2), at(x + BEAT / 2) + 0.08); }
  }
  cuts.forEach((c) => { if (ok(c)) swell(at(c)); });
  if (ok(end)) kick(at(end), 0.72);
  // melodi süsleri (ızgarada)
  [[0.4, 220], [1.0, 329.63], [1.6, 261.63]].forEach(([x, f]) => ok(x) && pluck(at(x), f, 0.06));
  const c1 = cuts[1]; if (c1 != null) { [[c1 + 0.6, 440, 0.06], [c1 + 1.2, 329.63], [c1 + 1.5, 392], [c1 + 1.8, 440], [c1 + 2.1, 523.25]].forEach(([x, f, v]) => ok(x) && pluck(at(x), f, v || 0.045)); }
  [[end + 0.3, 329.63], [end + 0.6, 440], [end + 0.9, 493.88]].forEach(([x, f]) => ok(x) && pluck(at(x), f, 0.045));
  return nodes;
}

// Canlı çalar: tek ses bağlamı, sayfadaki bütün filmler paylaşır
let ctx = null, G = null, nodes = [], S = 0, T0 = 0, on = false;
export const music = {
  start(cuts, end, t0) {
    try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    music.stop(); if (ctx.state === 'suspended') ctx.resume();
    G = graph(ctx); S = ctx.currentTime + 0.08; T0 = t0; on = true;
    nodes = schedule(ctx, G, cuts, end, t0, S);
  },
  running() { return !!(on && ctx && ctx.state === 'running'); },
  now() { if (!on || !ctx) return null; const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0); return Math.max(T0, T0 + (ctx.currentTime - S - lat)); },
  stop() { on = false; nodes.forEach((n) => { try { n.stop(); } catch {} }); nodes = []; if (G) { const m = G.master; try { m.gain.setTargetAtTime(0, ctx.currentTime, 0.03); } catch {} setTimeout(() => { try { m.disconnect(); } catch {} }, 250); G = null; } },
};
// mp4 için: sesi dosyaya çizer (OfflineAudioContext)
export async function renderAudio(cuts, end, total, rate = 48000) {
  const len = Math.ceil((total + 3.5) * rate); const oc = new OfflineAudioContext(2, len, rate);
  const g = graph(oc); schedule(oc, g, cuts, end, 0, 0.0);
  return oc.startRendering();
}
