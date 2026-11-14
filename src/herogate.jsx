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
      let rw, maxH; if (w >= 1024) { rw = w * 0.62; maxH = bandH * 0.82; } else if (w >= 640) { rw = w * 0.8; maxH = bandH * 0.85; } else { rw = w * 0.74; maxH = bandH * 0.8; }
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
    const mv = (e) => { if (sw.on) { swMove(e); return; } const t = e.pointerType === 'touch'; if (t && e.buttons === 0 && e.pressure === 0) return; const [x, y] = pos(e); engine?.pointer('move', x, y, t); mark(); };
    // 14.11.2026 telefonda giriş: logonun altındaki alanı (yazılar + alt kısım) SAĞA kaydır → sayfa parmakla sağa kayar,
    // yeterince çekince ya da hızlıca sağa atınca mağaza açılır; az çekip bırakırsan yerine yaylanır. (Yukarı kaydırma denendi, sağa istendi.)
    const sw = { on: false, id: 0, x0: 0, dx: 0, t: 0, lx: 0, v: 0 };
    const inZone = (e) => { const c = contentRef.current; return coarse && c && e.clientY - root.getBoundingClientRect().top >= c.offsetTop - 24; };
    const setDx = (d, anim) => { root.classList.toggle('eh-snap', !!anim); root.style.setProperty('--eh-dx', d + 'px'); root.style.setProperty('--eh-pull', Math.max(0, Math.min(1, d / (root.clientWidth * 0.3)))); };
    const swDown = (e) => { if (goneRef.current) return; sw.on = true; sw.id = e.pointerId; sw.x0 = e.clientX; sw.dx = 0; sw.t = e.timeStamp; sw.lx = e.clientX; sw.v = 0; };
    const swMove = (e) => {
      if (!sw.on || e.pointerId !== sw.id) return;
      const dt = e.timeStamp - sw.t; if (dt > 0) sw.v = 0.6 * sw.v + 0.4 * ((e.clientX - sw.lx) / dt); sw.t = e.timeStamp; sw.lx = e.clientX;
      const raw = e.clientX - sw.x0; sw.dx = raw > 0 ? raw : raw * 0.15; setDx(sw.dx, false);
    };
    const swUp = (e) => {
      if (!sw.on || e.pointerId !== sw.id) return; sw.on = false;
      if (sw.dx > root.clientWidth * 0.3 || (sw.v > 0.45 && sw.dx > 24)) { setDx(root.clientWidth * 0.45, true); try { navigator.vibrate?.(8); } catch {} goRef.current(); }
      else setDx(0, true);
    };
    const dn = (e) => { if (inZone(e)) { swDown(e); return; } if (e.target.closest('button,a')) return; const [x, y] = pos(e); engine?.pointer('down', x, y, e.pointerType === 'touch'); mark(); };
    const up = (e) => { if (sw.on) { swUp(e); return; } const [x, y] = pos(e); engine?.pointer('up', x, y, e.pointerType === 'touch'); };
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
  const go = () => {
    if (leaving || goneRef.current) return; goneRef.current = true;
    engRef.current?.explode(); setLeaving(true);
    setTimeout(() => {
      engRef.current?.stop(); onOpen();
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => { setReveal(true); setTimeout(onDone, 420); }, 80)));
    }, 560);
  };

  const goRef = useRef(go); goRef.current = go;

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
          <h1 className="eh-h1"><span className="eh-line eh-a eh-a2">Tamir tezgâhının</span><span className="eh-line eh-a eh-a3"><span className="eh-accent">her şeyi burada.</span></span></h1>
        </div>
        <div className="eh-aside">
          <p className="eh-body eh-a eh-a4">Tamircinin ihtiyacı olan cihazlar ve binlerce yedek parça tek mağazada.</p>
          <div className="eh-a eh-a5">
            {coarse ? null : (
              <button type="button" className="eh-btn" onClick={go}>Alışverişe başla
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="eh-spacer2">
        {coarse && (
          <button type="button" className="eh-up" aria-label="Alışverişe başla" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}>
            <span>Sağa kaydır</span>
            <svg width="26" height="14" viewBox="0 0 26 14" fill="none" aria-hidden="true"><path d="M2 7h20M17 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>
    </section>
  );
}
