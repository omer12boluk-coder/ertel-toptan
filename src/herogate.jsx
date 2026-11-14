// 13.11.2026 Giriş sayfası (HeroGate): mağaza ana sayfası açılmadan önce tam ekran, logo akışkan parçacık efekti
// (liquid.js) + "Alışverişe başla". Basınca logo dağılır, sayfa kayar, mağaza açılır.
// - Sadece mağaza ana adresinde (/), oturumda bir kez (sessionStorage 'hero-seen'); ürün/sepet/sipariş linkleri ve bildirimden açılış etkilenmez.
// - Açıkken arkada mağaza ÇİZİLMEZ (banner/video oynamaz); veriler arkada yüklenir, basınca mağaza hemen gelir.
// - Kapatmak: Ayarlar › Genel › 'Giriş sayfası (logo efekti)' (brand.heroGate). Ayar gelmeden önce son bilinen seçim
//   localStorage 'hero-gate'den okunur (kapalıyken bir an görünmesin).
// - Sınıf öneki 'eh-' (dikkat: '.sh-' önekli kurallar telefonda touchHoverToActive tarafından silinir).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, store } from './store.js';
import { ls } from './utils.js';
import { ROUTE, lpath } from './route.js';
import { LiquidEngine } from './liquid.js';
import { gateFx } from './anim.jsx';
import { useVisibleProducts } from './catalog.jsx';
import { useBrandList } from './brandsets.jsx';
import { LOGO_MARK } from './config.js';

// ---- 14.11.2026 Açılış sahnesi (look.anim gfly / gscn / gwrd / gnum / gshn; anim.jsx gateFx) ----
// Kullanıcı: B (logo menüye uçar) + C (sahne kurulur) + D1 (dönen kelime) + D2 (canlı sayılar); D4 (düğmede ışık) denemede kapalı.
// Kurallar: SADECE 'Alışverişe başla'dan sonra bir kez; kalıcı katman (will-change) YOK; Yeni gelenler kendi kayma hareketiyle
// ÇAKIŞMASIN (rail data-an='ok' yapılır, sahne kendisi oynatır); kaydırmalı sırada hareket sürerken mıknatıs (scroll-snap) kapalı.
const EZ = 'cubic-bezier(.16,1,.3,1)';
// Uçan logo TEK PARÇA (14.11 akşam): iki evreli sürüm yolda duruyordu (mağaza arkada çizilirken bekliyordu) = 'takılma'.
// Artık parçacıklar dağılırken görünmez; mağaza hazır olunca (reveal) ortadan durmadan menüdeki yerine uçar (0,65 sn).
// Menü bu sırada KAYMAZ (sceneIn fly=true → sadece belirir): menü kayarken inince 'yerine tekrar oturma' görünüyordu.
function flyStart(img, root, src) {
  const r = img?.getBoundingClientRect(); if (!r || !r.width) return null;
  const mob = root.clientWidth < 640; const z = mob ? Math.min(r.width, r.height) : r.height;
  return { x: mob ? r.left + (r.width - z) / 2 : r.left, y: r.top + (r.height - z) / 2, z, src };
}
// küçük logo: büyük logo dağılırken ORTADA kumdan oluşur (hafif 2B kanvas, ~2-3 bin tane; büyük WebGL motoru yeniden KURULMAZ —
// o donduruyordu). Taneler merkez çevresinden (büyük logonun dağıldığı alan) akıp küçük 'e'nin piksellerine oturur, sonra düz
// resim yerini alır. Resim yüklenmemişse buğudan netleşme (yedek).
let markImg = null;
const preloadMark = () => { if (!markImg) { markImg = new Image(); markImg.decoding = 'async'; markImg.src = MOBILE_SRC; } };
// 14.11.2026 (gece, mobil ölçümü): kum son karede NET logoyu aynı kanvasa çizer ve menüye bu kanvas uçar (eskiden sonda ayrı
// <img> konuyordu → telefonda resim o an hazır olmadığından bir kare boş = 'yanıp sönme'). Mağaza kum BİTTİKTEN sonra çizilir
// (çizim telefonda ~0,9 sn donduruyor; kumun son kareleri o donmaya denk gelince takılıyordu), uçuş da telefon rahatlayınca başlar.
function sandForm(x, y, z, root) {
  const im = markImg; if (!im?.complete || !im.naturalWidth) return null;
  const mob = root.clientWidth < 640;
  const dpr = Math.min(2, devicePixelRatio || 1), S = Math.round(z * (mob ? 1.8 : 2.3)), W = z + 2 * S;
  const n = Math.max(40, Math.round(z * dpr * (mob ? 0.6 : 0.8))), o = document.createElement('canvas'); o.width = o.height = n;
  let d; try { const g = o.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, n, n); d = g.getImageData(0, 0, n, n).data; } catch { return null; }
  const c = document.createElement('canvas'); c.className = 'eh-sand'; c.width = c.height = Math.round(W * dpr);
  Object.assign(c.style, { left: x - S + 'px', top: y - S + 'px', width: W + 'px', height: W + 'px' });
  const P = [], cx = W * dpr / 2, cy = cx, sz = (z * dpr / n) * 1.05;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 4, a = d[k + 3]; if (a < 80) continue;
    const tx = (S + (i + 0.5) / n * z) * dpr, ty = (S + (j + 0.5) / n * z) * dpr;
    const an = Math.random() * 6.2832, r = (0.25 + Math.random() * 0.75) * S * dpr;
    P.push([cx + Math.cos(an) * r, cy + Math.sin(an) * r * 0.62, tx, ty, Math.random() * 0.32, `rgba(${d[k]},${d[k + 1]},${d[k + 2]},${a / 255})`]);
  }
  document.body.appendChild(c);
  const ctx = c.getContext('2d'), D = 520, t0 = performance.now() + 40; let res; const done = new Promise((r) => { res = r; });
  const st = { x, y, z, el: c, off: S, done, raf: 0, dpr };
  const step = (now) => {
    const T = Math.max(0, (now - t0) / D); ctx.clearRect(0, 0, c.width, c.height);
    if (T >= 1) { ctx.globalAlpha = 1; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, S * dpr, S * dpr, z * dpr, z * dpr); res(); return; } // son kare: net logo, aynı kanvas
    for (const p of P) {
      const k = Math.min(1, Math.max(0, (T - p[4]) / (1 - 0.32))), e = 1 - Math.pow(1 - k, 3);
      ctx.globalAlpha = Math.min(1, T * 4); ctx.fillStyle = p[5];
      ctx.fillRect(p[0] + (p[2] - p[0]) * e - sz / 2, p[1] + (p[3] - p[1]) * e - sz / 2, sz, sz);
    }
    st.raf = requestAnimationFrame(step);
  };
  st.raf = requestAnimationFrame(step);
  return st;
}
function flySmall(img, root) {
  const r = img?.getBoundingClientRect(); if (!r || !r.width) return null;
  const z = Math.round(Math.min(root.clientWidth < 640 ? 60 : 80, r.height * 0.9));
  const x = r.left + r.width / 2 - z / 2, y = r.top + r.height / 2 - z / 2;
  const sd = sandForm(x, y, z, root); if (sd) return sd;
  const f = document.createElement('img'); f.src = MOBILE_SRC; f.alt = ''; f.className = 'eh-fly';
  Object.assign(f.style, { left: x + 'px', top: y + 'px', width: z + 'px', height: z + 'px', opacity: '0' });
  document.body.appendChild(f);
  f.animate([{ opacity: 0, filter: 'blur(10px)', transform: 'scale(1.5)' }, { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' }],
    { duration: 380, delay: 140, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  return { x, y, z, el: f, off: 0, done: new Promise((r) => setTimeout(r, 520)) };
}
// uçan logo (kum kanvası ya da yedek resim) menüdeki logonun içine kayar; son %22'de menü logosuyla yumuşakça yer değiştirir
// (gündüz menü logosunun beyaz yuvarlağı birden belirip 'oturma' gibi görünüyordu)
function flyLand(st) {
  if (!st) return;
  const tg = [...document.querySelectorAll('.shell.public .topbar img.brand-logo')].find((e) => e.getBoundingClientRect().width > 0);
  const f = st.el;
  if (!tg) { cancelAnimationFrame(st.raf); f?.remove(); return; }
  // hedef = logonun ÇİZİLDİĞİ alan (iç boşluk hariç): 34 px kutuya iniyordu, gerçek logo 32 px → geçişte 2 px 'tık'
  const r0 = tg.getBoundingClientRect(), cs = getComputedStyle(tg), pl = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0), pt = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0);
  const t = { left: r0.left + pl, top: r0.top + pt, width: r0.width - 2 * pl };
  f.getAnimations().forEach((a) => { a.commitStyles?.(); a.cancel(); }); f.style.opacity = '1'; f.style.filter = ''; f.style.transform = '';
  // 15.11 (kullanıcı: 'oturuken silikleşiyor, framegen gibi'): uçan kanvas menü logosunun BİREBİR kopyası olarak yeniden çizilir —
  // aynı resim dosyası (giriş logosu farklı dosyaydı), aynı zemin yuvarlağı ve halka → varışta karıştırma yok, aynı karede değişir
  if (f.getContext && tg.complete && tg.naturalWidth) {
    cancelAnimationFrame(st.raf);
    const g = f.getContext('2d'), d = st.dpr || 1, k0 = r0.width / t.width, cx = (st.off + st.z / 2) * d, R = (st.z / 2) * k0 * d;
    g.clearRect(0, 0, f.width, f.height); g.globalAlpha = 1;
    const bg = cs.backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { g.fillStyle = bg; g.beginPath(); g.arc(cx, cx, R, 0, 6.2832); g.fill(); }
    const sh = /(rgba?\([^)]*\)) 0px 0px 0px 1px|0px 0px 0px 1px (rgba?\([^)]*\))/.exec(cs.boxShadow || ''); if (sh) { g.strokeStyle = sh[1] || sh[2]; g.lineWidth = d * k0; g.beginPath(); g.arc(cx, cx, R + (d * k0) / 2, 0, 6.2832); g.stroke(); }
    g.save(); g.beginPath(); g.arc(cx, cx, R, 0, 6.2832); g.clip(); g.imageSmoothingQuality = 'high'; g.drawImage(tg, st.off * d, st.off * d, st.z * d, st.z * d); g.restore();
    st.same = true;
  }
  tg.style.opacity = '0';
  const k = t.width / st.z, ex = st.x - st.off, ey = st.y - st.off;
  const tx = t.left - ex - st.off * k, ty = t.top - ey - st.off * k, D = innerWidth < 640 ? 600 : 650;
  f.style.transformOrigin = '0 0';
  f.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${tx}px,${ty}px) scale(${k})` }], { duration: D, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
  // uçan logo SÖNMEZ (ikisi yarı saydamken logo bir an siliniyordu): menü logosu altında belirir (gündüz beyaz yuvarlağı yumuşak gelir),
  // tam görününce uçan logo kaldırılır
  if (st.same) { // birebir kopya: varış karesinde tek hamlede değişir (karıştırma/sönme yok)
    setTimeout(() => { tg.style.opacity = ''; f.remove(); }, D + 16);
  } else {
    setTimeout(() => { tg.style.transition = 'opacity .16s ease'; tg.style.opacity = ''; }, D * 0.78);
    setTimeout(() => { cancelAnimationFrame(st.raf); f.remove(); setTimeout(() => { tg.style.transition = ''; }, 40); }, Math.max(D, D * 0.78 + 180));
  }
}
// telefon mağazayı çizmeyi bitirip rahatlayınca (art arda 2 kare < 34 ms) devam et; en geç 1,4 sn
function whenCalm(fn) {
  const t0 = performance.now(); let last = t0, ok = 0;
  const f = (now) => { const dt = now - last; last = now; ok = dt < 34 ? ok + 1 : 0; if (ok >= 2 || now - t0 > 1400) fn(); else requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function sceneIn(fly) {
  const sh = document.querySelector('.shell.public'); if (!sh) return;
  const A = (el, kf, o) => el?.animate(kf, { easing: EZ, fill: 'backwards', ...o });
  A(sh.querySelector('.topbar'), fly ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'translateY(-90px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: fly ? 450 : 700, delay: 40 });
  // logo uçarken SAYFA SABİT (kullanıcı: 'banner ve alt menü de kayınca bütün sayfa kayıyor gibi, logoyu görmüyorum'): menüler sadece belirir, banner kıpırdamaz
  if (innerWidth < 900) A(sh.querySelector('.botnav'), fly ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'translateY(100px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: fly ? 450 : 700, delay: fly ? 40 : 90 });
  if (fly) return;
  const pg = sh.querySelector('.kp:not(.kp-off)') || sh;
  A(pg.querySelector('.cd-hero .sh-hero') || pg.querySelector('.cd-hero'), [{ transform: 'scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 850, delay: 120 });
  const rail = pg.querySelector('.cd-nwsec .cd-rail');
  if (rail && rail.getBoundingClientRect().top < innerHeight) {
    rail.setAttribute('data-an', 'ok'); rail.style.scrollSnapType = 'none';
    [...rail.children].slice(0, 5).forEach((t, i) => A(t, [{ transform: 'translateX(64px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 750, delay: 420 + i * 80 }));
    setTimeout(() => { rail.style.scrollSnapType = ''; }, 1800);
  }
}
const WORDS = ['havyası', 'mikroskobu', 'kalıbı', 'entegresi', 'her şeyi'];
// 14.11.2026 (kullanıcı: 'mikroskobu çıkmıyor'): eskiden satıra SIĞMAYAN kelime döngüden atılıyordu. Artık hiçbiri atılmaz:
// başlığın yazı boyu EN UZUN kelimeye ('mikroskobu burada.') göre bir kez ayarlanır → her kelime sığar, satır taşmaz, kelime
// değişirken yazı boyu oynamaz. Ölçüm yazı tipi yüklendikten sonra ve sadece genişlik değişince tekrarlanır.
// kelime değişirken genişlik 0,4 sn'de yumuşakça değişir, 'burada.' zıplamaz kayar. Satır nowrap (CSS .eh-accent.roll).
function WordRoll() {
  const ref = useRef(null); const cur = useRef(WORDS[0]);
  const [list, setList] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current; const line = el?.closest('.eh-accent'); const box = el?.closest('.eh-h1'); if (!el || !line || !box) return undefined;
    let lastW = -1;
    const fit = () => {
      // ölçüm transform'dan ETKİLENMEZ (offsetWidth): yazılar açılış animasyonundayken getBoundingClientRect yanlış genişlik veriyordu
      const blk = line.parentElement; const d0 = blk.style.display; blk.style.display = 'inline-block';
      box.style.fontSize = ''; lastW = innerWidth;
      const max = (box.parentElement || box).clientWidth; // başlığın sığabileceği alan (başlık kendisi içeriğine göre daralıyor)
      let wMax = 0; for (const w of WORDS) { el.textContent = w; wMax = Math.max(wMax, blk.offsetWidth); }
      if (wMax > max + 1) { const fs = parseFloat(getComputedStyle(box).fontSize) || 0; if (fs) box.style.fontSize = Math.floor(fs * (max - 2) / wMax * 10) / 10 + 'px'; }
      blk.style.display = d0; el.textContent = cur.current;
    };
    fit(); setList(WORDS);
    const onRs = () => { if (innerWidth !== lastW) fit(); };
    addEventListener('resize', onRs); document.fonts?.ready?.then(() => { if (ref.current) fit(); });
    return () => removeEventListener('resize', onRs);
  }, []);
  useEffect(() => {
    if (!list || list.length < 2) return undefined;
    // SIRAYLA: bir değişim bitmeden sonraki başlamaz (logo efekti işlemciyi yorunca setInterval üst üste biniyor, kelime atlıyor / boş kalıyordu)
    // 14.11.2026 gece (mobil): genişlik animasyonu her karede düzen hesaplatıyordu → telefonda kesik. Artık kelime yerini anında alır,
    // 'burada.' eski yerinden yenisine TRANSFORM ile kayar (FLIP; ekran kartı yapar). Başlık tam göründükten sonra başlar (2,6 sn),
    // 'her şeyi'de biraz bekleyip BAŞTAN döner (tek tur bitince 'mikroskobu' telefonda kaçırılıyordu).
    let i = 0, t = 0, dead = false; const el = ref.current; const after = el.nextElementSibling;
    const step = () => {
      if (dead) return; i = (i + 1) % list.length; const w = list[i];
      el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-.35em)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
        // 'burada.' kayması yumuşak başla-bitir 560 ms (EZ ilk karelerde fırlatıyordu: 'sert')
        if (dead) return; const x0 = after ? after.getBoundingClientRect().left : 0; el.textContent = w; cur.current = w;
        if (after) { const dx = x0 - after.getBoundingClientRect().left; if (Math.abs(dx) > 0.5) after.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.45,.05,.25,1)' }); }
        el.animate([{ opacity: 0, transform: 'translateY(.35em)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EZ, fill: 'forwards' }).onfinish = () => { if (!dead) t = setTimeout(step, i === list.length - 1 ? 2200 : 1100); };
      };
    };
    t = setTimeout(step, 2600);
    return () => { dead = true; clearTimeout(t); };
  }, [list]);
  return <span ref={ref} className="eh-word" />; // içerik SADECE buradan yazılır (React de yazınca kelime atlanıyor / kayboluyordu)
}
function Count({ n, delay = 0 }) {
  const vr = useRef(null);
  // satırın kendi belirişi (.eh-a4) 1,7 sn gecikmeli → sayma o ana denk gelsin. 14.11 gece: her karede React çizimi yerine
  // sayı doğrudan yazılır (telefonda logo efektiyle aynı anda ana işi yoruyordu); sadece değer değişince yazılır
  useEffect(() => { if (!n) return undefined; let raf = 0, last = -1; const t0 = performance.now() + delay; const f = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / 1300)); const v = Math.round(n * (1 - Math.pow(1 - k, 3))); if (v !== last && vr.current) { last = v; vr.current.textContent = v.toLocaleString('tr-TR'); } if (k < 1) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [n]);
  // 14.11.2026: yer baştan SON değerin genişliğinde ayrılır (görünmez kopya), sayı onun içinde sayar → 'marka' ve 'aynı gün kargo' itilmez
  return <b className="num eh-cnt"><span className="eh-cnt-g" aria-hidden="true">{n.toLocaleString('tr-TR')}</span><span className="eh-cnt-v" ref={vr}>0</span></b>;
}
let gateT0 = 0; // giriş sayfasının açıldığı an (HeroGate ilk çizimde yazar)
function GateNums() {
  const n = useVisibleProducts(false).length; const b = useBrandList().length;
  const [d] = useState(() => Math.max(0, 1850 - (performance.now() - gateT0))); // satır belirdiği anda başla (veri geç gelirse hemen)
  if (!n) return null;
  return <p className="eh-nums"><span><Count n={n} delay={d} /> ürün</span><span><Count n={b} delay={d + 120} /> marka</span><span><b>aynı gün</b> kargo</span></p>;
}

const SRC = '/bn/hero-logo-wide.webp', MOBILE_SRC = '/bn/hero-logo-mark.webp';
const BG = { light: [245 / 255, 245 / 255, 247 / 255], dark: [10 / 255, 11 / 255, 15 / 255] };

const cachedOn = () => { try { return localStorage.getItem('hero-gate') !== '0'; } catch { return true; } };
// Açılışta bir kez karar verilir
export const HERO_WANTED = (() => {
  try {
    if (!ROUTE.shop || ROUTE.notFound || lpath() !== '/magaza' || location.hash) return false;
    if (/[?&]n=1\b/.test(location.search)) return false;
    if (sessionStorage.getItem('hero-seen')) return false;
    return cachedOn();
  } catch { return false; }
})();

export function HeroGate({ onOpen, onDone }) {
  const on = useStore((s) => s.settings.brand?.heroGate !== false);
  const boot = useStore((s) => s.boot);
  const rootRef = useRef(null), stageRef = useRef(null), imgRef = useRef(null), navRef = useRef(null), contentRef = useRef(null), bdRef = useRef(null);
  const engRef = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const [reveal, setReveal] = useState(false);
  // 13.11.2026 (C düzeni): hep AYDINLIK açılır; karanlık sadece cihazda seçilmişse (mağazanın tema düğmesiyle aynı ayar: device-theme)
  const dark = useStore((s) => s.deviceTheme === 'dark');
  const darkRef = useRef(dark); darkRef.current = dark;
  const flip = () => { const n = dark ? 'light' : 'dark'; ls.set('device-theme', n); document.documentElement.setAttribute('data-theme', n); store.set({ deviceTheme: n }); };
  useEffect(() => { engRef.current?.setOptions({ bg: dark ? BG.dark : BG.light }); }, [dark]);
  const coarse = typeof matchMedia === 'function' && matchMedia('(hover: none), (pointer: coarse)').matches;
  const look = useStore((s) => s.settings?.look); const logoSrc = useStore((s) => s.settings?.brand?.logo) || LOGO_MARK;
  const fx = gateFx(look);
  useState(() => { gateT0 = performance.now(); });
  useEffect(() => { preloadMark(); }, []);

  // ayar kapalı gelirse hemen kapan (ve bir sonraki açılış için hatırla)
  useEffect(() => { if (boot === 'ready' || boot === 'login') { try { localStorage.setItem('hero-gate', on ? '1' : '0'); } catch {} if (!on) { onOpen(); onDone(); } } }, [on, boot]);
  useEffect(() => { try { sessionStorage.setItem('hero-seen', '1'); } catch {} document.body.classList.add('eh-lock'); return () => document.body.classList.remove('eh-lock'); }, []);
  // index.html başındaki düz renkli örtü (pre-intro) kalksın
  useLayoutEffect(() => { const h = document.documentElement; [...h.classList].filter((c) => c.startsWith('pre-')).forEach((c) => h.classList.remove(c)); }, []);

  // useLayoutEffect: ilk çizimden ÖNCE yerleşim (yoksa arkadaki 'ertel' yazısı bir an küçük ve yanlış yerde görünüyordu)
  useLayoutEffect(() => {
    const root = rootRef.current, stage = stageRef.current; if (!root || !stage) return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const opts = () => ({ interactive: true, strength: 1.1, radius: 200, density: 1, dotSize: 1, spread: 1, turbulence: 1, liquid: 1, streaks: true, restStyle: 'image',
      returnSpeed: 1, ambient: true, ambientIntensity: 0.35, speed: 1, intro: true, reducedMotion: mq.matches, bg: darkRef.current ? BG.dark : BG.light });
    const canvas = document.createElement('canvas'); canvas.className = 'eh-canvas'; stage.appendChild(canvas);
    let engine = null; const fail = () => { root.dataset.gl = 'off'; };
    try { engine = new LiquidEngine(canvas, opts(), fail); engRef.current = engine; } catch { fail(); }
    let aspect = 2.33, mob = null, dead = false;
    const relayout = () => {
      const w = root.clientWidth, h = root.clientHeight, nav = navRef.current, content = contentRef.current;
      const band = { top: nav ? nav.offsetTop + nav.offsetHeight + 8 : 16, bottom: content ? content.offsetTop - 8 : h };
      const bandH = Math.max(80, band.bottom - band.top);
      let rw, maxH; if (w >= 1024) { rw = w * 0.62; maxH = bandH * 0.96; } // 15.11: altta pay eklenince basık ekranlarda logo küçülmesin (0,82 → 0,96) else if (w >= 640) { rw = w * 0.8; maxH = bandH * 0.85; } else { rw = w * 0.74; maxH = bandH * 0.8; }
      if (rw / aspect > maxH) rw = maxH * aspect; const rh = rw / aspect;
      const rect = { x: w / 2 - rw / 2, y: (band.top + band.bottom) / 2 - rh / 2, w: rw, h: rh };
      const bd = bdRef.current; if (bd) { bd.style.fontSize = Math.min(bandH * 0.95, (w * 0.92) / (5 * 0.56)) + 'px'; bd.style.top = (band.top + band.bottom) / 2 + 'px'; }
      const img = imgRef.current; if (img) Object.assign(img.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
      engine?.resize(w, h, rect);
    };
    const load = () => {
      const m = root.clientWidth < 640; relayout(); if (m === mob) return; mob = m;
      const src = m ? MOBILE_SRC : SRC; const im = new Image(); im.decoding = 'async';
      im.onload = () => {
        if (dead) return; aspect = im.naturalWidth / im.naturalHeight || aspect; if (imgRef.current) imgRef.current.src = src; relayout();
        if (engine && root.dataset.gl !== 'off') { try { engine.onFirstFrame = () => { if (!dead) root.dataset.gl = 'on'; }; engine.setImage(im); relayout(); } catch { fail(); } }
      };
      im.src = src;
    };
    load();
    const ro = new ResizeObserver(load); ro.observe(root);
    const onVis = () => engine?.setVisible(!document.hidden); document.addEventListener('visibilitychange', onVis);
    const pos = (e) => { const b = root.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    const mark = () => { root.dataset.touched = '1'; };
    const mv = (e) => { const t = e.pointerType === 'touch'; if (t && e.buttons === 0 && e.pressure === 0) return; const [x, y] = pos(e); engine?.pointer('move', x, y, t); mark(); };
    const dn = (e) => { if (e.target.closest('button,a')) return; const [x, y] = pos(e); engine?.pointer('down', x, y, e.pointerType === 'touch'); mark(); };
    const up = (e) => { const [x, y] = pos(e); engine?.pointer('up', x, y, e.pointerType === 'touch'); };
    const lv = (e) => { const [x, y] = pos(e); engine?.pointer('leave', x, y, e.pointerType === 'touch'); };
    root.addEventListener('pointermove', mv, { passive: true }); root.addEventListener('pointerdown', dn, { passive: true });
    root.addEventListener('pointerup', up, { passive: true }); root.addEventListener('pointercancel', up, { passive: true }); root.addEventListener('pointerleave', lv, { passive: true });
    return () => {
      dead = true; ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
      root.removeEventListener('pointermove', mv); root.removeEventListener('pointerdown', dn); root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up); root.removeEventListener('pointerleave', lv);
      try { engine?.stop(); engine?.gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
      canvas.remove(); engRef.current = null;
    };
  }, []);

  // Çıkış: önce logo dağılıp söner (düz zemin kalır) → mağaza düz zeminin ARKASINDA çizilir (takılma görünmez) → zemin solar.
  // Eskiden mağaza animasyonun ortasında çiziliyordu, dağılma efekti 1 sn takılıyordu.
  const goneRef = useRef(false);
  // 14.11.2026 (4) Açılış geçişi: büyük logo eskisi gibi hızla dağılır; dağılırken ORTADA küçük 'e' buğudan netleşerek belirir
  // (düz resim, CSS) → mağaza arkada çizilir → küçük logo menüdeki yerine kayar. Kumla yeniden kurma (liquid.js gather) DONDURUYOR
  // ve yavaştı (kullanıcı) → kullanılmıyor; kumun menüye akması / menüde toplanması da reddedildi.
  const go = () => {
    if (leaving || goneRef.current) return; goneRef.current = true;
    const fl = fx.fly ? flySmall(imgRef.current, rootRef.current) : null;
    engRef.current?.explode(); setLeaving(true);
    const t0 = performance.now();
    const open = () => {
      engRef.current?.stop(); onOpen();
      whenCalm(() => {
        flyLand(fl); // önce hedef ölçülür (menü yerindeyken), sonra sahne başlar
        if (fx.scn) sceneIn(!!fl);
        // giriş sayfası uçuş BİTTİKTEN sonra kaldırılır (kaldırma uçuşun ortasında ~0,35 sn takılma yapıyordu); görünmez zaten (reveal)
        setReveal(true); setTimeout(onDone, fl ? 820 : 420);
      });
    };
    // mağaza ancak dağılma (560 ms) VE kum bittikten sonra çizilir; kumun son karesi boyansın diye bir kare daha beklenir
    const wait = Math.max(0, 560 - (performance.now() - t0));
    Promise.all([fl?.done, new Promise((r) => setTimeout(r, wait))]).then(() => requestAnimationFrame(() => requestAnimationFrame(open)));
  };

  return (
    <section ref={rootRef} className={'eh-root' + (dark ? ' eh-dark' : '') + (leaving ? ' leaving' : '') + (reveal ? ' reveal' : '')} aria-label="Giriş">
      <div ref={bdRef} className="eh-backdrop" aria-hidden="true">ertel</div>
      <div ref={stageRef} className="eh-stage" aria-hidden="true"><img ref={imgRef} className="eh-fallback" alt="" draggable="false" /></div>
      <nav ref={navRef} className="eh-nav eh-a" aria-label="Üst">
        <span />
        <button type="button" className="eh-theme" role="switch" aria-checked={dark} aria-label="Karanlık görünüm" onClick={flip}>
          <span className={dark ? '' : 'on'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg></span>
          <span className={dark ? 'on' : ''}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg></span>
        </button>
      </nav>
      <div className="eh-spacer" />
      <div ref={contentRef} className="eh-content">
        <div>
          <p className="eh-eyebrow eh-a eh-a1">Ertel Telekomünikasyon</p>
          <h1 className="eh-h1"><span className="eh-line eh-a eh-a2">Tamir tezgâhının</span><span className="eh-line eh-a eh-a3"><span className={'eh-accent' + (fx.word ? ' roll' : '')}>{fx.word ? <><WordRoll /><span className="eh-after"> burada.</span></> : 'her şeyi burada.'}</span></span></h1>
        </div>
        <div className="eh-aside">
          <p className="eh-body eh-a eh-a4">Tamircinin ihtiyacı olan cihazlar ve binlerce yedek parça tek mağazada.</p>
          {fx.num && <div className="eh-a eh-a4 eh-numw"><GateNums /></div>}
          <div className="eh-a eh-a5">
            <button type="button" className={'eh-btn' + (fx.shine ? ' eh-shine' : '')} onClick={go}>Alışverişe başla
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      </div>
      <div className="eh-spacer2" />
    </section>
  );
}
