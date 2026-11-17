// Hareketli banner motoru (17.11.2026, Claude) — Quick 861 Pro Max tanıtım filmi.
// Tek saatle (t, saniye) çizilen sahneler: (A) masa: SVG ekran + el, fare ertelmarket.com'da ürüne tıklar → (B) kamera ekrana
// dalar, ürünün gerçek görüntülerinden montaj + kinetik Türkçe yazılar → (C) kapanış: logolar + tıklanabilir düğmeler.
// Video sahnesinde saat videonun kendisine bağlı (video takılırsa yazılar da bekler). Kapanış karesi banner değişene kadar durur.
// Kullanım: createMotion(kutu, { base:'/bn/', onLink(l), capture }) → { dur, start(), stop(), seek(t) (kayıt için), destroy() }
// Telefon / bilgisayar: kutunun en/boy oranına göre (PhotoBanner ile aynı eşik 1.05) iki ayrı yerleşim.
// iPhone kuralı (safari-viewport): her şey banner kutusunun İÇİNDE position:absolute, boyut kutudan ölçülür; vh / fixed YOK.

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const eOut3 = (p) => 1 - (1 - p) ** 3;
const eOut5 = (p) => 1 - (1 - p) ** 5;
const eIn3 = (p) => p * p * p;
const eIO3 = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const eIO4 = (p) => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2);

// ---- zaman çizelgesi ------------------------------------------------------------------------------------
const VS = 2.4; // montaj videosu bu anda başlar
const VLEN = 13.0; // montaj süresi (bn/mot-q861-*.mp4)
const CUTS = [0, 1.8, 3.8, 5.4, 6.8, 8.4, 10.0, 11.8, 13.0]; // montajdaki kesmeler (video saniyesi)
const T_CLICK = 1.72;
const T_PUSH0 = 2.5; const T_PUSH1 = 3.42;
const T_END = VS + VLEN - 0.35; // kapanışa geçiş
export const MOTION_DUR = T_END + 2.4; // son öğe yerleşince

// montaj yazıları (video saniyesi): satırlar + alt etiket. Her yazı en az ~1,2 sn ekranda.
// 17.11.2026 (2): montaj dosyası kırpmasız (net tam kare + bulanık kenar, tools/motion/kes.py) → bilgisayarda yazılar soldaki bulanık alanda.
const CAPS = [
  { a: 1.06, b: 1.72, l: [], tag: 'Yeni · Quick 861 Pro Max' },
  { a: 1.84, b: 3.7, l: ['Söyle,', 'ısıtsın.'], tag: 'Sesli komut', big: true },
  { a: 3.84, b: 5.3, l: ['Akıllı PID.', 'Sabit ısı.'], tag: 'Sıcaklık kontrolü' },
  { a: 5.44, b: 6.7, num: 1300, unit: 'W', l: ['Fırçasız vorteks fan'], tag: 'Güç' },
  { a: 6.84, b: 8.3, l: ['Standa koy,', 'kendini soğutsun.'], tag: 'Otomatik uyku' },
  { a: 8.44, b: 9.9, l: ['Zor entegre.', 'Kolay söküm.'], tag: 'BGA · çip · çok katmanlı kart' },
  { a: 10.04, b: 11.7, l: ['Tek istasyon.', 'Her iş.'], tag: '50–550 °C' },
];

// ---- stil (bir kez) -------------------------------------------------------------------------------------
const CSS = `
.mq{position:absolute;inset:0;overflow:hidden;background:#05070b;font-family:Inter,system-ui,-apple-system,sans-serif;color:#fff;-webkit-user-select:none;user-select:none;contain:layout paint}
.mq *{box-sizing:border-box}
.mq-L{position:absolute;left:0;top:0;transform-origin:0 0}
.mq-cam{position:absolute;left:0;top:0;transform-origin:0 0}
.mq-vid{position:absolute;overflow:hidden;background:#000}
.mq-vid video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.mq-scr{position:absolute;overflow:hidden;background:#f5f5f7;transform-origin:0 0;color:#1d1d1f}
.mq-sui{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0}
.mq-hdr{position:absolute;left:40px;top:18px;width:1200px;height:66px;border-radius:22px;background:rgba(255,255,255,.86);box-shadow:0 6px 24px rgba(20,30,60,.08),inset 0 0 0 1px rgba(0,0,0,.05);display:flex;align-items:center;padding:0 18px;gap:14px}
.mq-hdr img{height:42px;width:42px;object-fit:contain}
.mq-hdr b{font-size:21px;font-weight:800;letter-spacing:.02em}
.mq-nav{display:flex;gap:4px;margin-left:34px;font-size:15px;font-weight:600;color:#3a3a3f}
.mq-nav span{padding:9px 15px;border-radius:999px}
.mq-nav span.on{background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.08);color:#2f62d6}
.mq-srch{margin-left:auto;width:250px;height:40px;border-radius:999px;background:rgba(0,0,0,.05);display:flex;align-items:center;padding:0 16px;color:#86868b;font-size:15px;gap:9px}
.mq-ic{width:40px;height:40px;border-radius:999px;background:rgba(0,0,0,.05);display:grid;place-items:center}
.mq-hero{position:absolute;left:40px;top:102px;width:1200px;height:240px;border-radius:24px;background:radial-gradient(70% 90% at 75% 60%,#fff 0%,#eef0f4 75%);overflow:hidden}
.mq-hero .t{position:absolute;left:60px;top:58px}
.mq-hero small{display:block;font-size:14px;font-weight:700;color:#bf4800;letter-spacing:.02em}
.mq-hero h3{margin:6px 0 0;font-size:46px;font-weight:800;letter-spacing:-.02em;line-height:1}
.mq-hero p{margin:10px 0 0;font-size:19px;color:#515154}
.mq-hero i{display:inline-block;margin-top:22px;padding:10px 22px;border-radius:999px;background:#2f62d6;color:#fff;font-style:normal;font-weight:600;font-size:15px}
.mq-hero img{position:absolute;right:120px;top:14px;height:300px}
.mq-sec{position:absolute;left:40px;top:362px;width:1200px;display:flex;align-items:baseline;justify-content:space-between}
.mq-sec h4{margin:0;font-size:25px;font-weight:800;letter-spacing:-.01em}
.mq-sec span{font-size:15px;color:#2f62d6;font-weight:600}
.mq-card{position:absolute;top:408px;width:285px;height:296px;border-radius:20px;background:#fff;box-shadow:0 2px 10px rgba(20,30,60,.05);transform-origin:50% 50%}
.mq-card .im{position:absolute;left:14px;top:14px;right:14px;height:170px;border-radius:14px;background:#f5f5f7;display:grid;place-items:center;overflow:hidden}
.mq-card .im img{max-width:82%;max-height:84%;object-fit:contain}
.mq-card .nm{position:absolute;left:18px;right:18px;top:196px;font-size:15px;font-weight:600;line-height:1.3;color:#1d1d1f}
.mq-card .bt{position:absolute;left:14px;right:14px;bottom:14px;height:38px;border-radius:999px;background:#eaf0fd;color:#2f62d6;font-size:15px;font-weight:600;display:grid;place-items:center}
.mq-card .nw{position:absolute;left:24px;top:24px;font-size:12px;font-weight:700;color:#fff;background:#2f62d6;border-radius:999px;padding:4px 10px}
.mq-sheet{position:absolute;overflow:hidden;background:#fff;display:grid;place-items:center}
.mq-sheet img{width:60%;height:70%;object-fit:contain}
.mq-dim{position:absolute;inset:0;background:#000;opacity:0}
.mq-glare{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 38%,rgba(255,255,255,0) 70%,rgba(255,255,255,.05) 100%);pointer-events:none}
.mq-cur{position:absolute;left:0;top:0;width:30px;height:44px;transform-origin:3px 3px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
.mq-rip{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:3px solid rgba(47,98,214,.8);opacity:0}
.mq-ov{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}
.mq-cap{position:absolute;left:0;top:0;opacity:0}
.mq-ln{display:block;overflow:hidden;overflow:clip;padding:.04em 0 .1em;margin-bottom:-.08em}
.mq-w{display:inline-block;will-change:auto;white-space:pre}
.mq-tg{display:inline-flex;align-items:center;gap:.6em;font-weight:600;letter-spacing:.16em;text-transform:uppercase;opacity:.92}
.mq-tg::before{content:'';width:1.9em;height:2px;background:#5b9cff;border-radius:2px}
.mq-h{font-weight:800;letter-spacing:-.035em;line-height:.98;text-shadow:0 2px 30px rgba(0,0,0,.35)}
.mq-num{font-weight:800;letter-spacing:-.05em;line-height:.9;font-variant-numeric:tabular-nums}
.mq-num u{text-decoration:none;color:#5b9cff}
.mq-shade{position:absolute;inset:0;pointer-events:none;opacity:0}
.mq-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;mix-blend-mode:screen}
.mq-endbg{position:absolute;inset:0;opacity:0;background:radial-gradient(60% 75% at 72% 52%,#0e2350 0%,#060b18 52%,#000 100%)}
.mq-endbg.ph{background:radial-gradient(90% 50% at 50% 30%,#0e2350 0%,#060b18 55%,#000 100%)}
.mq-end{position:absolute;left:0;top:0;transform-origin:0 0}
.mq-end .e{position:absolute;opacity:0}
.mq-btn{pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;gap:10px;border-radius:999px;font-weight:600;cursor:pointer;border:0;font-family:inherit;-webkit-tap-highlight-color:transparent}
.mq-btn.p{background:#fff;color:#000}
.mq-btn.s{background:rgba(255,255,255,.12);color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35)}
@media (hover:hover){.mq-btn.p:hover{background:#e8eefc}.mq-btn.s:hover{background:rgba(255,255,255,.2)}}
.mq-btn:active{transform:scale(.97)}
.mq-rep{pointer-events:auto;position:absolute;width:38px;height:38px;border-radius:999px;border:0;background:rgba(255,255,255,.1);display:grid;place-items:center;cursor:pointer;opacity:0;-webkit-tap-highlight-color:transparent}
.mq-sweep{position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
`;
function css(doc) { if (doc.getElementById('mq-css')) return; const s = doc.createElement('style'); s.id = 'mq-css'; s.textContent = CSS; doc.head.appendChild(s); }

// ---- SVG çizimler ---------------------------------------------------------------------------------------
// Monitör (gövde, cam kenar, ayak) — ekran alanı ayrı div (.mq-scr) olarak üstüne konur.
function monitorSvg(x, y, w, h, deskY) {
  const b = Math.max(6, w * 0.016); // çerçeve
  const X = x - b; const Y = y - b; const W = w + 2 * b; const H = h + 2 * b;
  const cx = x + w / 2; const nw = w * 0.15; const nTop = Y + H - 2; const fw = w * 0.42;
  return `
  <defs>
    <linearGradient id="mqAl" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9dce2"/><stop offset=".55" stop-color="#9a9fa8"/><stop offset="1" stop-color="#5d626b"/></linearGradient>
    <linearGradient id="mqAlS" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#4c5059"/><stop offset=".18" stop-color="#b4b8c0"/><stop offset=".5" stop-color="#e3e5ea"/><stop offset=".82" stop-color="#a9adb5"/><stop offset="1" stop-color="#474b53"/></linearGradient>
    <linearGradient id="mqRim" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8d929b"/><stop offset=".5" stop-color="#3b3e44"/><stop offset="1" stop-color="#1b1c20"/></linearGradient>
    <radialGradient id="mqSpill" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#9fb7ff" stop-opacity=".16"/><stop offset="1" stop-color="#9fb7ff" stop-opacity="0"/></radialGradient>
    <filter id="mqSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(w * 0.012).toFixed(1)}"/></filter>
    <filter id="mqSoft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(w * 0.03).toFixed(1)}"/></filter>
  </defs>
  <ellipse cx="${cx}" cy="${deskY + w * 0.02}" rx="${fw * 0.62}" ry="${w * 0.018}" fill="#000" opacity=".55" filter="url(#mqSoft)"/>
  <rect x="${cx - fw / 2}" y="${deskY - w * 0.012}" width="${fw}" height="${w * 0.016}" rx="${w * 0.006}" fill="url(#mqAlS)"/>
  <path d="M${cx - nw / 2} ${nTop} L${cx + nw / 2} ${nTop} L${cx + nw * 0.62} ${deskY - w * 0.011} L${cx - nw * 0.62} ${deskY - w * 0.011} Z" fill="url(#mqAlS)"/>
  <path d="M${cx - nw / 2} ${nTop} L${cx + nw / 2} ${nTop} L${cx + nw * 0.52} ${nTop + w * 0.03} L${cx - nw * 0.52} ${nTop + w * 0.03} Z" fill="#000" opacity=".35"/>
  <rect x="${X - 1.5}" y="${Y - 1.5}" width="${W + 3}" height="${H + 3}" rx="${b * 1.35}" fill="url(#mqRim)"/>
  <rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="${b * 1.2}" fill="#0b0c0e"/>
  <rect x="${X + 0.8}" y="${Y + 0.8}" width="${W - 1.6}" height="${H - 1.6}" rx="${b * 1.15}" fill="none" stroke="#2a2c31" stroke-width="1"/>`;
}
function deskSvg(W0, H0, deskY, phone) {
  return `
  <defs>
    <linearGradient id="mqDesk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1b1e25"/><stop offset=".25" stop-color="#121419"/><stop offset="1" stop-color="#07080a"/></linearGradient>
    <radialGradient id="mqWall" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#18233b"/><stop offset=".55" stop-color="#0b0f19"/><stop offset="1" stop-color="#05070b"/></radialGradient>
    <radialGradient id="mqPool" cx=".5" cy="0" r=".7"><stop offset="0" stop-color="#7f9cff" stop-opacity=".22"/><stop offset=".5" stop-color="#7f9cff" stop-opacity=".05"/><stop offset="1" stop-color="#7f9cff" stop-opacity="0"/></radialGradient>
    <linearGradient id="mqEdge" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#cfd8ff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="-2000" y="-2000" width="${W0 + 4000}" height="${deskY + 2000}" fill="url(#mqWall)"/>
  <rect x="-2000" y="${deskY}" width="${W0 + 4000}" height="${H0 - deskY + 2000}" fill="url(#mqDesk)"/>
  <rect x="-2000" y="${deskY}" width="${W0 + 4000}" height="1.4" fill="url(#mqEdge)"/>
  <rect x="${W0 * (phone ? -0.3 : 0.1)}" y="${deskY}" width="${W0 * (phone ? 1.6 : 0.8)}" height="${H0 - deskY}" fill="url(#mqPool)"/>`;
}
// Klavye (perspektifli, koyu) — sadece silüet + tuş izleri
function keyboardSvg(x, y, w, d) {
  const sk = w * 0.06; let keys = '';
  const rows = 5; const cols = 15;
  for (let r = 0; r < rows; r++) {
    const ty = y + d * (0.14 + r * 0.16); const th = d * 0.12; const k = (r + 0.5) / rows; const inset = sk * (1 - k);
    const x0 = x + inset + w * 0.03; const x1 = x + w - inset - w * 0.03; const cw = (x1 - x0) / cols;
    for (let c = 0; c < cols; c++) keys += `<rect x="${(x0 + c * cw + cw * 0.08).toFixed(1)}" y="${ty.toFixed(1)}" width="${(cw * 0.84).toFixed(1)}" height="${th.toFixed(1)}" rx="${(th * 0.22).toFixed(1)}" fill="#1c1e23"/>`;
  }
  return `<path d="M${x + sk} ${y} L${x + w - sk} ${y} L${x + w} ${y + d} L${x} ${y + d} Z" fill="#2a2d33"/>
  <path d="M${x + sk} ${y} L${x + w - sk} ${y} L${x + w} ${y + d} L${x} ${y + d} Z" fill="none" stroke="#5a5e66" stroke-width="1" opacity=".6"/>
  ${keys}<path d="M${x} ${y + d} L${x + w} ${y + d} L${x + w} ${y + d + 3} L${x} ${y + d + 3} Z" fill="#0d0e10"/>`;
}

// Fare + sağ el: tools/motion/el.py ile bir kez çizilen resimler (alttan üste: fare, işaret parmağı, el). Yerel alan 300×300.

// mağaza ekranı (1280×720 tasarım) — ertelmarket.com'un sade bir çizimi; gerçek logo ve ürün kesimleri
const CARDS = [
  { img: 'ht316.webp', n: 'Aixun HT316 Sıcak Hava ve Havya İstasyonu' },
  { img: 'film-q861-on.webp', n: 'Quick 861 Pro Max Sesli Komutlu Sıcak Hava İstasyonu', hit: true, nw: true },
  { img: 'da07.webp', n: '2UUL DA07 Mini Isıtmalı Pres İstasyonu' },
  { img: 'sugon.webp', n: 'Sugon 8650 Akıllı Sıcak Hava İstasyonu' },
];
const cardX = (i) => 40 + i * 305;
const HIT = { x: cardX(1) + 14, y: 408 + 14, w: 257, h: 170 }; // Quick kartının resim alanı (ekran içi)
function screenHtml(B) {
  return `<div class="mq-sui">
    <div class="mq-hdr"><img src="${B}hero-logo-mark.webp" alt=""><b>ERTEL GSM</b>
      <div class="mq-nav"><span class="on">Ana sayfa</span><span>Ürünler</span><span>Kalıp bulucu</span><span>Markalar</span><span>Setler</span></div>
      <div class="mq-srch"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Ürün ara</div>
      <div class="mq-ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" stroke-width="2"><path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg></div>
    </div>
    <div class="mq-hero"><div class="t"><small>Mikroskoplar</small><h3>ZM6745T</h3><p>Netlik. Her açıdan.</p><i>İncele</i></div><img src="${B}zm-front.webp" alt=""></div>
    <div class="mq-sec"><h4>Yeni gelenler</h4><span>Tümü ›</span></div>
    ${CARDS.map((c, i) => `<div class="mq-card" data-k="${i}" style="left:${cardX(i)}px"><div class="im"><img src="${B}${c.img}" alt=""></div>${c.nw ? '<span class="nw">Yeni</span>' : ''}<div class="nm">${c.n}</div><div class="bt">Sepete ekle</div></div>`).join('')}
    <div class="mq-sheet"><img src="${B}film-q861-on.webp" alt=""></div>
    <div class="mq-dim"></div>
  </div><div class="mq-glare"></div>`;
}
const CURSOR = `<svg viewBox="0 0 30 44" width="30" height="44"><path d="M3 2 L3 34 L11 26.5 L16.5 39 L22 36.6 L16.6 24.3 L27 24.3 Z" fill="#000" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

// ---- yerleşimler ----------------------------------------------------------------------------------------
// Sahne A tasarım alanı (kutuyu kaplar = cover) + yazı/kapanış tasarım alanı (kutuya sığar = contain)
function layout(phone) {
  if (phone) {
    const W0 = 400; const H0 = 720; const sw = 352; const sx = (W0 - sw) / 2; const sy = 112;
    return { phone, W0, H0, scr: { x: sx, y: sy, w: sw, h: sw * 9 / 16 }, deskY: 372, hand: { x: 196, y: 372, s: 0.8 }, kb: { x: 8, y: 452, w: 200, d: 56 } };
  }
  const W0 = 1600; const H0 = 800; const sw = 736; const sx = (W0 - sw) / 2; const sy = 86;
  return { phone, W0, H0, scr: { x: sx, y: sy, w: sw, h: sw * 9 / 16 }, deskY: 584, hand: { x: 1000, y: 436, s: 1.3 }, kb: { x: 420, y: 612, w: 430, d: 86 } };
}

const h = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const words = (s) => s.split(/(\s+)/).filter((x) => x.trim()).map((w) => `<span class="mq-w">${w}</span>`).join(' ');

export function createMotion(root, opt = {}) {
  const doc = root.ownerDocument; const win = doc.defaultView; css(doc);
  const B = opt.base || '/bn/';
  const el = h(doc, 'div', 'mq'); root.appendChild(el);
  let L = null; let box = { w: 0, h: 0 }; let fitC = 1; let ox = 0; let oy = 0; let fitO = 1; let oxO = 0; let oyO = 0;
  let R = {}; // DOM referansları
  let t = 0; let running = false; let raf = 0; let t0 = 0; let vidOn = false; let fallback = false; let holdSince = 0;

  function build() {
    const ph = box.w / box.h < 1.05;
    if (L && L.phone === ph && R.el) { place(); return; }
    el.innerHTML = ''; L = layout(ph); R = { el: true };
    const { W0, H0, scr, deskY, hand, kb } = L; const k = scr.w / 1280;
    // sahne A
    const stage = h(doc, 'div', 'mq-L'); stage.style.width = W0 + 'px'; stage.style.height = H0 + 'px';
    const back = h(doc, 'div', 'mq-cam'); back.style.width = W0 + 'px'; back.style.height = H0 + 'px';
    back.innerHTML = `<svg width="${W0}" height="${H0}" viewBox="0 0 ${W0} ${H0}" style="position:absolute;left:0;top:0;overflow:visible">${deskSvg(W0, H0, deskY, ph)}${monitorSvg(scr.x, scr.y, scr.w, scr.h, deskY)}${keyboardSvg(kb.x, kb.y, kb.w, kb.d)}</svg>`;
    const sc = h(doc, 'div', 'mq-scr', screenHtml(B)); Object.assign(sc.style, { left: scr.x + 'px', top: scr.y + 'px', width: scr.w + 'px', height: scr.h + 'px', borderRadius: (ph ? 2 : 3) + 'px' });
    sc.firstChild.style.transform = `scale(${k})`; back.appendChild(sc);
    const vb = h(doc, 'div', 'mq-vid'); const v = doc.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto'; v.disablePictureInPicture = true; v.setAttribute('aria-hidden', 'true');
    const nm = ph ? 'mot-q861-t' : 'mot-q861-w';
    v.innerHTML = `<source src="${B}${nm}.mp4" type="video/mp4"><source src="${B}${nm}.webm" type="video/webm">`;
    vb.appendChild(v);
    const front = h(doc, 'div', 'mq-cam'); front.style.width = W0 + 'px'; front.style.height = H0 + 'px';
    const im = (f) => `<img src="${B}${f}" alt="" style="position:absolute;left:0;top:0;width:300px;height:300px">`;
    front.innerHTML = `<div style="position:absolute;left:${hand.x}px;top:${hand.y}px;width:300px;height:300px;transform:scale(${hand.s});transform-origin:0 0">${im('mot-el-m.webp')}<div class="mq-idx" style="position:absolute;inset:0;transform-origin:50% 48%">${im('mot-el-p.webp')}</div>${im('mot-el.webp')}</div>`;
    const cur = h(doc, 'div', 'mq-cur', CURSOR); const rip = h(doc, 'div', 'mq-rip');
    back.appendChild(rip); back.appendChild(cur);
    stage.append(back, vb, front);
    // yazılar + kapanış (contain)
    const shade = h(doc, 'div', 'mq-shade'); shade.style.background = ph ? 'linear-gradient(0deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.25) 42%,rgba(0,0,0,0) 62%)' : 'linear-gradient(90deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,.22) 40%,rgba(0,0,0,0) 62%),linear-gradient(0deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 45%)';
    const flash = h(doc, 'div', 'mq-flash');
    const endbg = h(doc, 'div', 'mq-endbg' + (ph ? ' ph' : ''));
    const ov = h(doc, 'div', 'mq-ov'); ov.style.width = W0 + 'px'; ov.style.height = H0 + 'px';
    const caps = CAPS.map((c) => {
      const d = h(doc, 'div', 'mq-cap'); const fs = ph ? (c.big ? 50 : 40) : c.big ? 112 : 86;
      let inner = `<div class="mq-tg" style="font-size:${ph ? 11 : 15}px;margin-bottom:${ph ? 12 : 20}px">${c.tag}</div>`;
      if (c.num) inner += `<span class="mq-ln"><span class="mq-num mq-w" style="font-size:${ph ? 92 : 190}px"><span class="nv">0</span><u>${c.unit}</u></span></span><span class="mq-ln" style="margin-top:${ph ? 6 : 10}px"><span class="mq-h" style="font-size:${ph ? 20 : 34}px;font-weight:600;letter-spacing:-.01em">${words(c.l[0])}</span></span>`;
      else inner += c.l.map((s, i) => `<span class="mq-ln"><span class="mq-h" style="font-size:${fs}px;${i ? 'color:#bcd3ff' : ''}">${words(s)}</span></span>`).join('');
      d.innerHTML = inner;
      if (ph) Object.assign(d.style, { left: '26px', top: 'auto', bottom: '64px', width: '350px' }); else Object.assign(d.style, { left: '80px', bottom: '96px', top: 'auto', width: '900px' });
      ov.appendChild(d);
      return { c, d, ws: [...d.querySelectorAll('.mq-w')], tg: d.querySelector('.mq-tg'), nv: d.querySelector('.nv') };
    });
    // kapanış
    const end = h(doc, 'div', 'mq-end'); end.style.width = W0 + 'px'; end.style.height = H0 + 'px';
    const E = {}; const add = (k2, html, st) => { const e = h(doc, 'div', 'e', html); Object.assign(e.style, st); end.appendChild(e); E[k2] = e; return e; };
    if (ph) {
      add('prod', `<img src="${B}film-q861-on.webp" alt="Quick 861 Pro Max" style="width:100%;height:100%;object-fit:contain">`, { left: '70px', top: '40px', width: '260px', height: '281px' });
      add('glow', '', { left: '40px', top: '250px', width: '320px', height: '60px', background: 'radial-gradient(50% 50% at 50% 50%,rgba(91,156,255,.35),rgba(91,156,255,0))', filter: 'blur(6px)' });
      add('ql', `<img src="/brands/quick.png" alt="Quick" style="height:100%;filter:invert(1) brightness(1.4)">`, { left: '0', width: '400px', top: '346px', height: '24px', textAlign: 'center' });
      add('ti', `<span class="mq-ln"><span class="mq-h" style="font-size:46px">${words('861 Pro Max')}</span></span>`, { left: '0', width: '400px', top: '384px', textAlign: 'center' });
      add('tg', `<span class="mq-ln"><span class="mq-h" style="font-size:24px;font-weight:700;color:#bcd3ff;letter-spacing:-.02em">${words('Söyle, ısıtsın.')}</span></span>`, { left: '0', width: '400px', top: '442px', textAlign: 'center' });
      add('sb', 'Sesli komutlu 1300W sıcak hava istasyonu.', { left: '30px', width: '340px', top: '480px', textAlign: 'center', fontSize: '14px', color: 'rgba(255,255,255,.66)' });
      add('b1', `<button class="mq-btn p" style="height:46px;padding:0 26px;font-size:16px" data-l="p:3066">Ürüne git<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`, { left: '30px', top: '530px', width: '166px' });
      add('b2', `<button class="mq-btn s" style="height:46px;padding:0 22px;font-size:16px" data-l="cart:3066">Sepete ekle</button>`, { left: '206px', top: '530px', width: '164px' });
      add('ert', `<img src="${B}hero-logo-wide.webp" alt="ert mobile" style="height:100%;filter:brightness(0) invert(1);opacity:.9">`, { left: '0', width: '400px', top: '618px', height: '46px', textAlign: 'center' });
    } else {
      add('glow', '', { left: '840px', top: '600px', width: '640px', height: '90px', background: 'radial-gradient(50% 50% at 50% 50%,rgba(91,156,255,.35),rgba(91,156,255,0))', filter: 'blur(10px)' });
      add('prod', `<img src="${B}film-q861-on.webp" alt="Quick 861 Pro Max" style="width:100%;height:100%;object-fit:contain">`, { left: '900px', top: '70px', width: '560px', height: '605px' });
      add('ql', `<img src="/brands/quick.png" alt="Quick" style="height:100%;filter:invert(1) brightness(1.4)">`, { left: '120px', top: '200px', height: '38px' });
      add('ti', `<span class="mq-ln"><span class="mq-h" style="font-size:104px">${words('861 Pro Max')}</span></span>`, { left: '114px', top: '254px', width: '780px' });
      add('tg', `<span class="mq-ln"><span class="mq-h" style="font-size:44px;font-weight:700;color:#bcd3ff;letter-spacing:-.025em">${words('Söyle, ısıtsın.')}</span></span>`, { left: '118px', top: '372px', width: '780px' });
      add('sb', 'Sesli komutlu 1300W sıcak hava istasyonu.', { left: '120px', top: '438px', fontSize: '21px', color: 'rgba(255,255,255,.66)' });
      add('b1', `<button class="mq-btn p" style="height:54px;padding:0 30px;font-size:18px" data-l="p:3066">Ürüne git<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`, { left: '120px', top: '498px' });
      add('b2', `<button class="mq-btn s" style="height:54px;padding:0 28px;font-size:18px" data-l="cart:3066">Sepete ekle</button>`, { left: '300px', top: '498px' });
      add('ert', `<img src="${B}hero-logo-wide.webp" alt="ert mobile" style="height:100%;filter:brightness(0) invert(1);opacity:.9">`, { left: '120px', top: '628px', height: '58px' });
    }
    const rep = h(doc, 'button', 'mq-rep', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>');
    rep.setAttribute('aria-label', 'Tekrar oynat'); Object.assign(rep.style, ph ? { right: '14px', top: '14px' } : { right: '22px', top: '22px' });
    end.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); if (t < T_END + 0.6) return; opt.onLink?.(b.dataset.l, e); }));
    rep.addEventListener('click', (e) => { e.stopPropagation(); start(); });
    // tıklanmazken kapanış düğmeleri basılmaz
    el.append(stage, shade, endbg, ov, end, flash);
    if (!opt.capture) el.appendChild(rep);
    R = { el: true, stage, back, front, sc, sui: sc.firstChild, vb, v, cur, rip, ov, caps, end, E, endbg, shade, flash, rep, cards: [...sc.querySelectorAll('.mq-card')], sheet: sc.querySelector('.mq-sheet'), sheetImg: sc.querySelector('.mq-sheet img'), dim: sc.querySelector('.mq-dim'), idx: front.querySelector('.mq-idx'), hand: front.firstChild };
    R.endTitle = E.ti;
    place();
  }
  function place() {
    const { W0, H0 } = L;
    fitC = Math.max(box.w / W0, box.h / H0); ox = (box.w - W0 * fitC) / 2; oy = (box.h - H0 * fitC) / 2;
    fitO = Math.min(box.w / W0, box.h / H0); oxO = (box.w - W0 * fitO) / 2; oyO = (box.h - H0 * fitO) / 2;
    // telefonda yazı alanı alta yaslı (kutu daha uzunsa yazılar ekranın altında kalsın)
    if (L.phone) oyO = box.h - H0 * fitO;
    R.stage.style.transform = `translate(${ox}px,${oy}px) scale(${fitC})`;
    R.ov.style.transform = R.end.style.transform = `translate(${oxO}px,${oyO}px) scale(${fitO})`;
    draw(t);
  }

  // ---- kare çizimi ----
  const S = (e, p) => { if (!e) return; for (const k in p) if (e.style[k] !== p[k]) e.style[k] = p[k]; };
  function camAt(tt) {
    // A: yavaş dolly (ekran merkezine), sonra ekrana dalış: sonunda ekran görünen kutuyu tam kaplar, merkezi kutunun ortasında
    const { scr } = L; const fx = scr.x + scr.w / 2; const fy = scr.y + scr.h / 2;
    const a = eOut3(seg(tt, 0, T_PUSH0));
    const d = 1 + 0.06 * a; const drift = (1 - a) * (L.phone ? 6 : 14);
    const pp = eIO4(seg(tt, T_PUSH0, T_PUSH1));
    const vw = box.w / fitC; const vh = box.h / fitC; const vx = -ox / fitC; const vy = -oy / fitC;
    const cover = Math.max(vw / scr.w, vh / scr.h) * 1.002;
    const s = d * Math.exp(Math.log(cover / d) * pp);
    const ax = lerp(fx, vx + vw / 2, pp) + drift * (1 - pp); const ay = lerp(fy, vy + vh / 2, pp);
    return { s, fx, fy, tx: ax - fx * s, ty: ay - fy * s, pp };
  }
  function draw(tt) {
    if (!L) return;
    const { scr, phone } = L; const k = scr.w / 1280;
    const cam = camAt(tt);
    const camT = `translate(${cam.tx}px,${cam.ty}px) scale(${cam.s})`;
    S(R.back, { transform: camT, opacity: String(1 - seg(tt, T_PUSH1 - 0.2, T_PUSH1)) });
    // ön plan (el) daha yakın: aynı odakla biraz daha hızlı büyür + aşağı kayar (derinlik)
    const fp = cam.pp; const fs = cam.s * (1 + fp * 0.9);
    S(R.front, { transform: `translate(${cam.tx + cam.fx * cam.s - cam.fx * fs}px,${cam.ty + cam.fy * cam.s - cam.fy * fs + fp * 260}px) scale(${fs})`, opacity: String(1 - seg(tt, T_PUSH0 + 0.35, T_PUSH1 - 0.1)) });
    // imleç yolu (ekran içi koordinat 1280×720) + el
    const cx0 = 1040; const cy0 = 250; const tx1 = HIT.x + HIT.w * 0.56; const ty1 = HIT.y + HIT.h * 0.52;
    const mp = eIO3(seg(tt, 0.35, 1.5));
    const bx = lerp(cx0, tx1, mp) + Math.sin(mp * Math.PI) * -40; const by = lerp(cy0, ty1, mp) + Math.sin(mp * Math.PI) * -70;
    const click = seg(tt, T_CLICK, T_CLICK + 0.09) - seg(tt, T_CLICK + 0.12, T_CLICK + 0.26);
    S(R.cur, { transform: `translate(${scr.x + bx * k}px,${scr.y + by * k}px) scale(${(phone ? 0.42 : 0.62) * (1 - click * 0.16)})`, opacity: String(1 - seg(tt, 1.95, 2.2)) });
    const rp = seg(tt, T_CLICK + 0.05, T_CLICK + 0.6);
    S(R.rip, { transform: `translate(${scr.x + bx * k}px,${scr.y + by * k}px) scale(${(0.15 + eOut3(rp) * 0.85) * k * 1.4})`, opacity: String(rp > 0 && rp < 1 ? (1 - rp) * 0.9 : 0) });
    // el fareyle birlikte kayar (ekran yolunun küçük bir yansıması)
    const hdx = (bx - cx0) * (phone ? 0.05 : 0.09); const hdy = (by - cy0) * (phone ? 0.03 : 0.05);
    S(R.hand, { transform: `translate(${hdx}px,${hdy}px) scale(${L.hand.s})` });
    S(R.idx, { transform: `translate(0px,${(click * 2.6).toFixed(2)}px) scale(1,${(1 - click * 0.035).toFixed(4)})` });
    // kartlar: Quick kartı imleç yaklaşınca yükselir, tıklayınca bastırılır
    const hov = eOut3(seg(tt, 1.15, 1.5));
    R.cards.forEach((c, i) => {
      const me = i === 1;
      const ty = me ? -8 * hov + click * 3 : 0; const sc2 = me ? 1 + 0.015 * hov - click * 0.02 : 1;
      S(c, { transform: `translate(0px,${ty}px) scale(${sc2})`, boxShadow: me ? `0 ${2 + 18 * hov}px ${10 + 34 * hov}px rgba(20,30,60,${0.05 + 0.13 * hov})` : '' });
    });
    // sayfa: tıklamadan sonra kart resmi tüm ekrana açılır (ürün sayfası → video)
    const xp = eIO3(seg(tt, 1.92, 2.5));
    const sr = { x: lerp(HIT.x, 0, xp), y: lerp(HIT.y - 8 * hov, 0, xp), w: lerp(HIT.w, 1280, xp), h: lerp(HIT.h, 720, xp) };
    const sheetOn = tt >= 1.92;
    S(R.sheet, { display: sheetOn ? '' : 'none', left: sr.x + 'px', top: sr.y + 'px', width: sr.w + 'px', height: sr.h + 'px', borderRadius: lerp(14, 0, xp) + 'px', background: `rgb(${Math.round(lerp(245, 0, eIO3(seg(tt, 2.05, 2.5))))},${Math.round(lerp(245, 0, eIO3(seg(tt, 2.05, 2.5))))},${Math.round(lerp(247, 0, eIO3(seg(tt, 2.05, 2.5))))})` });
    S(R.sheetImg, { transform: `scale(${1 + xp * 0.3})`, opacity: String(1 - seg(tt, 2.25, 2.55)) });
    S(R.dim, { opacity: String(0.35 * eOut3(seg(tt, 1.92, 2.3))) });
    // video kutusu: ekran içi sr → ekran (kamera ile) → kutunun tamamı
    const vOn = tt >= VS - 0.25;
    const mapX = (x) => cam.tx + cam.s * (scr.x + x * k); const mapY = (y) => cam.ty + cam.s * (scr.y + y * k);
    const r0 = { x: mapX(sr.x), y: mapY(sr.y), w: cam.s * sr.w * k, h: cam.s * sr.h * k };
    const full = { x: -ox / fitC, y: -oy / fitC, w: box.w / fitC, h: box.h / fitC };
    // ekran dikdörtgeni ile görünen kutunun kesişimi: video hep ekranın içinde kalır, dalış bitince kutuyu tam doldurur (telefonda dikey kesim)
    const ix0 = Math.max(r0.x, full.x); const iy0 = Math.max(r0.y, full.y); const ix1 = Math.min(r0.x + r0.w, full.x + full.w); const iy1 = Math.min(r0.y + r0.h, full.y + full.h);
    let vr = { x: ix0, y: iy0, w: Math.max(0, ix1 - ix0), h: Math.max(0, iy1 - iy0) }; const pp = cam.pp;
    // kapanışa geçiş: video hafifçe geri çekilip söner
    const ep = eIO3(seg(tt, T_END, T_END + 0.55));
    if (ep > 0) { const s2 = 1 - 0.08 * ep; vr = { x: full.x + full.w * (1 - s2) / 2, y: full.y + full.h * (1 - s2) / 2, w: full.w * s2, h: full.h * s2 }; }
    S(R.vb, { display: vOn ? '' : 'none', left: vr.x + 'px', top: vr.y + 'px', width: vr.w + 'px', height: vr.h + 'px', opacity: String(seg(tt, VS - 0.25, VS + 0.05) * (1 - ep)), borderRadius: (pp < 1 ? (1 - pp) * 6 : ep * 22 / fitC) + 'px' });
    // montaj: kesmede minik 'punch' (kısa büyüme → 1) + beyaz flaş
    const m = tt - VS; let ci = 0; for (let i = 0; i < CUTS.length - 1; i++) if (m >= CUTS[i]) ci = i;
    const since = m - CUTS[ci];
    const punch = 1; // zum yok (kullanıcı: 'her şey çok yakın')
    S(R.v, { transform: `scale(${punch})` });
    const fl = ci > 0 && m < VLEN ? Math.max(0, 1 - since / 0.14) * 0.28 : 0;
    S(R.flash, { opacity: String(fl) });
    S(R.shade, { opacity: String(seg(tt, T_PUSH1 - 0.1, T_PUSH1 + 0.4) * (1 - seg(tt, T_END - 0.2, T_END + 0.2))) });
    // yazılar
    for (const C of R.caps) {
      const a = VS + C.c.a; const b = VS + C.c.b; const on = tt > a - 0.01 && tt < b + 0.01;
      S(C.d, { opacity: on ? '1' : '0' });
      if (!on) continue;
      const out = eIn3(seg(tt, b - 0.26, b));
      C.ws.forEach((w, i) => {
        const p = eOut5(seg(tt, a + i * 0.075, a + i * 0.075 + 0.5));
        S(w, { transform: `translate(0,${((1 - p) * 105 - out * 40).toFixed(1)}%) skewY(${((1 - p) * 4).toFixed(2)}deg)`, opacity: String(clamp(p * 1.4) * (1 - out)) });
      });
      const tp = eOut3(seg(tt, a - 0.05, a + 0.35));
      S(C.tg, { transform: `translate(${(-14 * (1 - tp)).toFixed(1)}px,0)`, opacity: String(tp * (1 - out)) });
      if (C.nv) C.nv.textContent = String(Math.round(C.c.num * eOut3(seg(tt, a + 0.05, a + 0.75))));
    }
    // kapanış
    const E = R.E; const T = T_END;
    S(R.endbg, { opacity: String(eIO3(seg(tt, T - 0.05, T + 0.5))) });
    const up = (e, a2, dist = 30, dur = 0.7) => { const p = eOut5(seg(tt, a2, a2 + dur)); S(e, { opacity: String(p), transform: `translate(0,${((1 - p) * dist).toFixed(1)}px)` }); return p; };
    const pp2 = eOut5(seg(tt, T + 0.15, T + 1.05));
    S(E.prod, { opacity: String(clamp(pp2 * 1.3)), transform: `translate(0,${((1 - pp2) * (phone ? 26 : 50)).toFixed(1)}px) scale(${(0.94 + 0.06 * pp2).toFixed(4)})` });
    S(E.glow, { opacity: String(eOut3(seg(tt, T + 0.4, T + 1.3))) });
    up(E.ql, T + 0.35, 18);
    const tw = (e, a2) => { const ws = e.querySelectorAll('.mq-w'); S(e, { opacity: tt > a2 ? '1' : '0' }); ws.forEach((w, i) => { const p = eOut5(seg(tt, a2 + i * 0.08, a2 + i * 0.08 + 0.6)); S(w, { transform: `translate(0,${((1 - p) * 105).toFixed(1)}%)`, opacity: String(clamp(p * 1.5)) }); }); };
    tw(E.ti, T + 0.48); tw(E.tg, T + 0.78);
    up(E.sb, T + 0.98, 14, 0.6); up(E.b1, T + 1.12, 16, 0.6); up(E.b2, T + 1.2, 16, 0.6); up(E.ert, T + 1.45, 10, 0.8);
    const live = tt >= T + 0.6;
    S(R.end, { pointerEvents: live ? 'auto' : 'none' });
    S(R.rep, { opacity: String(0.9 * seg(tt, T + 2, T + 2.4)), pointerEvents: tt > T + 2 ? 'auto' : 'none' });
  }

  // ---- saat ----
  function vidSync() {
    const v = R.v; if (!v) return;
    if (t >= VS - 0.3 && t < VS + VLEN - 0.05 && !fallback) {
      if (!vidOn) {
        vidOn = true; holdSince = 0;
        try { v.currentTime = Math.max(0, t - VS); } catch (e) { /* */ }
        const pr = v.play(); if (pr && pr.catch) pr.catch(() => { fallback = true; });
      }
    }
  }
  function frame(now) {
    raf = 0; if (!running) return;
    let nt = (now - t0) / 1000;
    const v = R.v;
    if (!fallback && v && nt >= VS && nt < VS + VLEN) {
      // video sahnesi: saat videoya bağlı. Video henüz akmıyorsa bekle (en çok 5 sn, sonra kapanışa atla)
      if (vidOn && !v.paused && v.readyState >= 2 && v.currentTime > 0.01) { nt = VS + v.currentTime; t0 = now - nt * 1000; holdSince = 0; }
      else { if (!holdSince) holdSince = now; if (now - holdSince > 5000) { fallback = true; } else { nt = Math.max(t, VS); t0 = now - nt * 1000; } }
    }
    if (fallback && nt > VS - 0.3 && nt < T_END) { nt = T_END; t0 = now - nt * 1000; try { R.v.pause(); } catch (e) { /* */ } }
    t = nt; vidSync();
    if (v && t >= VS + VLEN - 0.02 && !v.paused) { try { v.pause(); } catch (e) { /* */ } }
    draw(t);
    if (t < MOTION_DUR) raf = win.requestAnimationFrame(frame); else running = false;
  }
  function start() {
    stop(); t = 0; fallback = false; vidOn = false; holdSince = 0;
    if (R.v) { try { R.v.pause(); R.v.currentTime = 0; } catch (e) { /* */ } }
    running = true; t0 = win.performance.now(); draw(0); raf = win.requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) win.cancelAnimationFrame(raf); raf = 0; try { R.v?.pause(); } catch (e) { /* */ } }
  function reset() { stop(); t = 0; vidOn = false; if (R.v) { try { R.v.currentTime = 0; } catch (e) { /* */ } } draw(0); }

  // kayıt (Playwright): t anını çiz, video karesi gerçekten gelene kadar bekle
  async function seek(tt) {
    stop(); t = tt; draw(tt);
    const v = R.v; const m = tt - VS;
    if (v && m > -0.3 && m < VLEN) {
      const want = clamp(m, 0, VLEN - 0.02);
      if (Math.abs(v.currentTime - want) > 0.001) {
        await new Promise((res) => { const f = () => { v.removeEventListener('seeked', f); res(); }; v.addEventListener('seeked', f); v.currentTime = want; setTimeout(f, 3000); });
      }
      if (v.requestVideoFrameCallback) await new Promise((res) => { let d = false; v.requestVideoFrameCallback(() => { d = true; res(); }); setTimeout(() => { if (!d) res(); }, 120); });
    }
  }

  const measure = () => { const r = root.getBoundingClientRect(); const w = r.width; const hh = r.height; if (!w || !hh) return; if (Math.abs(w - box.w) < 0.5 && Math.abs(hh - box.h) < 0.5) return; box = { w, h: hh }; build(); };
  measure();
  const ro = 'ResizeObserver' in win ? new win.ResizeObserver(measure) : null; ro?.observe(root);
  return {
    dur: MOTION_DUR, start, stop, reset, seek, get t() { return t; }, get phone() { return L?.phone; },
    destroy() { stop(); ro?.disconnect(); el.remove(); },
  };
}
