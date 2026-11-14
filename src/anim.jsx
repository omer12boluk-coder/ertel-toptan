// 14.11.2026 Hareket dili v2 — PARMAĞA BAĞLI (look.anim.<anahtar> = 'on' → açık; varsayılan kapalı = bugünkü site).
// Her hareket html'e 'an-<anahtar>' sınıfı ekler; CSS style.css sonunda ('Hareket dili v2'). İçerik hiç gizlenmez:
// tek bir rAF kaydırma dinleyicisi her görünür bölüme (.rv) --p (0→1) yazar, CSS onunla kaydırdıkça hareket ettirir.
// Önce HEPSİ okunur, sonra yazılır (okuma-yazma karışınca iPhone'da takılıyordu). 'Hareketi azalt' açıksa hiçbiri yok.
// v1 (görününce oynayan giriş hareketleri + Haftanın ürünü sahnesi) kullanıcı denemesinde REDDEDİLDİ.
// DİKKAT: html sınıfları an-<anahtar>; başka öğeye bu adları (an-hd, an-fly…) VERME (çakıştı, sayfa kilitlendi).
// Önizleme hostunda (adında '--' olan ya da ?hareket) sağ altta 'Hareket' paneli: tek tek aç/kapat (bu cihazda, ls 'anim-try2').
import { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { ls } from './utils.js';

export const ANIMS = [
  ['rv', '0', 'Bölümler hep yerinde (solarak gelme kapalı)'],
  ['hd', 'A', 'Başlık perdesi'],
  ['raf', 'B', 'Raf akışı'],
  ['ksf', 'C', 'Keşfet derinliği (bilgisayar)'],
  ['ic', 'D', 'İkonlar kendini çizsin'],
  ['ind', 'E', 'İndirim çizilsin'],
  ['mrk', 'F', 'Marka dalgası'],
  ['bn', 'G', 'Banner geri çekilsin'],
  ['fly', 'I', 'Ürün sepete uçsun'],
];
const KEYS = ANIMS.map((a) => a[0]);
const TRY_HOST = typeof location !== 'undefined' && (location.hostname.includes('--') || /[?&]hareket\b/.test(location.search));
const RM = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function readTry() { const v = ls.get('anim-try2', null); return v && typeof v === 'object' ? v : Object.fromEntries(KEYS.map((k) => [k, true])); }

export function AnimLayer() {
  const A = useStore((s) => s.settings?.look?.anim) || null;
  const [tryV, setTry] = useState(() => (TRY_HOST ? readTry() : null));
  const on = KEYS.filter((k) => (tryV ? tryV[k] : A?.[k] === 'on'));
  const key = on.join(' ');
  useEffect(() => {
    if (RM()) return undefined;
    const c = document.documentElement.classList; on.forEach((k) => c.add('an-' + k));
    const has = (k) => on.includes(k);
    // ---- kaydırmaya bağlı hareketler: önce oku, sonra SADECE hareket eden öğelere yaz ----
    const secP = has('hd') || has('raf') || has('ic') || has('ind') || has('mrk');
    const last = new WeakMap(); const touched = new Set(); const tgt = new WeakMap(); let heroH = 0; let raf = 0;
    const put = (el, k, v) => { let o = last.get(el); if (!o) { o = {}; last.set(el, o); } if (o[k] === v) return; o[k] = v; touched.add(el); if (k[0] === '-') el.style.setProperty(k, v); else el.style[k] = v; };
    const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
    // bölüm başına hedef listesi (2 sn önbellek)
    const targets = (sec) => {
      const t = tgt.get(sec); if (t && performance.now() - t.at < 2000) return t;
      const n = {
        at: performance.now(),
        w: has('hd') ? [...sec.querySelectorAll('.anw > span')] : [],
        tl: has('raf') ? [...sec.querySelectorAll(':scope .cd-rail > .cd-tile, :scope .cd-grid > .cd-tile')].slice(0, 8) : [],
        ic: has('ic') ? [...sec.querySelectorAll('.p0-tr > .ic path')] : [],
        s: has('ind') ? [...sec.querySelectorAll('.cd-set-p s')] : [],
        sv: has('ind') ? [...sec.querySelectorAll('.cd-set-sv')] : [],
        bw: has('mrk') ? [...sec.querySelectorAll('.cd-bw')].slice(0, 30).map((b) => [b, Number(b.style.getPropertyValue('--d')) || 0]) : [],
      };
      tgt.set(sec, n); return n;
    };
    // sadece ekrana yakın bölümler ölçülür (IntersectionObserver); ekrandan aşağı çıkan bölüm başa (p=0) döner
    const act = new Set(); const seen = new WeakSet(); const fin = new Map();
    const io = secP ? new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) act.add(e.target); else { act.delete(e.target); fin.set(e.target, e.boundingClientRect.top > 0 ? 0 : 1); } }); onScroll(); }, { rootMargin: '0px 0px 15% 0px' }) : null;
    const watch = () => { if (io) for (const el of document.querySelectorAll('.shell.public .kp:not(.kp-off) .rv')) if (!seen.has(el)) { seen.add(el); io.observe(el); } };
    const tick = () => {
      raf = 0; const H = innerHeight; const R = [];
      // 1) OKU
      for (const [el, p] of fin) if (last.get(el)?.p !== p) R.push([el, p]);
      fin.clear();
      if (secP) for (const el of act) {
        const r = el.getBoundingClientRect(); if (!r.height) continue;
        const p = r.top >= H ? 0 : r.top <= H * 0.65 ? 1 : Math.round(((H - r.top) / (H * 0.35)) * 100) / 100;
        if (last.get(el)?.p === p) continue; R.push([el, p]);
      }
      const C = [];
      if (has('ksf') && innerWidth >= 900) for (const el of document.querySelectorAll('.shell.public .kp:not(.kp-off) .cd-ads')) {
        const r = el.getBoundingClientRect(); if (r.bottom < -40 || r.top > H + 40) continue;
        const v = (Math.round(Math.max(-1, Math.min(1, (r.top + r.height / 2 - H / 2) / H)) * 25) / 25).toFixed(2);
        for (const ad of el.children) { const x = ad.getBoundingClientRect(); if (x.right > -20 && x.left < innerWidth + 20) C.push([ad, v]); }
      }
      let hp = null; const hero = has('bn') ? document.querySelector('.shell.public .cd-hero') : null;
      if (hero) { if (!heroH) heroH = hero.offsetHeight || 1; hp = Math.round(Math.max(0, Math.min(1, scrollY / heroH)) * 200) / 200; }
      // 2) YAZ
      for (const [sec, p] of R) {
        let o = last.get(sec); if (!o) { o = {}; last.set(sec, o); } o.p = p;
        const T = targets(sec);
        T.w.forEach((w, i) => put(w, 'transform', p >= 1 ? '' : `translateY(${((1 - cl(p * 2.4 - i * 0.14)) * 105).toFixed(1)}%)`));
        T.tl.forEach((x, i) => put(x, 'transform', p >= 1 ? '' : `translateX(${((1 - cl(p * 1.8 - Math.min(i, 5) * 0.16)) * 64).toFixed(1)}px)`));
        T.ic.forEach((x, i) => put(x, 'strokeDashoffset', p >= 1 ? '' : ((1 - cl(p * 1.8 - Math.floor(i / 1) * 0.12)) * 200).toFixed(0)));
        T.s.forEach((x) => put(x, '--q', cl(p * 2 - 0.3).toFixed(2)));
        T.sv.forEach((x) => put(x, 'transform', p >= 1 ? '' : `scale(${(0.7 + 0.3 * cl(p * 2 - 0.8)).toFixed(2)})`));
        T.bw.forEach(([x, d]) => put(x, 'transform', p >= 1 ? '' : `translateY(${((1 - cl(p * 2.2 - d * 0.12)) * 22).toFixed(1)}px)`));
      }
      for (const [ad, v] of C) put(ad, '--c', v);
      if (hero && hp != null) { put(hero, 'transform', hp ? `scale(${(1 - hp * 0.08).toFixed(3)})` : ''); put(hero, 'opacity', hp ? (1 - hp * 0.55).toFixed(3) : ''); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onResize = () => { heroH = 0; onScroll(); };
    const scrolly = secP || has('ksf') || has('bn');
    // sekme değişince / yeni bölüm gelince de bir kez hesapla
    const iv = scrolly ? setInterval(() => { watch(); onScroll(); }, 700) : 0;
    watch();
    if (scrolly) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onResize); tick(); }
    // ---- I: ürün sepete uçsun (basma efekti değil: eklendikten sonra gelen onay) ----
    const onClick = (e) => {
      const b = e.target.closest?.('.abx > .btn.add'); if (!b) return;
      const card = b.closest('.cd-tile, .cd-big, .sh-card, .pv2-card, .prow, li, article'); const im = card?.querySelector('.thumb img, .cd-tile-im img, .cd-big-im img') || card?.querySelector('img'); if (!im) return;
      const tg = [...document.querySelectorAll('.botnav-b[data-tab="sepet"], .hcart')].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; });
      if (!tg) return;
      const a = im.getBoundingClientRect(), t = tg.getBoundingClientRect(); const S = 64;
      const f = document.createElement('div'); f.className = 'an-flyer'; f.appendChild(im.cloneNode()); document.body.appendChild(f);
      const x0 = a.left + a.width / 2 - S / 2, y0 = a.top + a.height / 2 - S / 2, x1 = t.left + t.width / 2 - S / 2, y1 = t.top + t.height / 2 - S / 2;
      const anim = f.animate([
        { transform: `translate(${x0}px,${y0}px) scale(1.5)`, opacity: 1 },
        { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 80}px) scale(.9)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x1}px,${y1}px) scale(.22)`, opacity: 0.25 },
      ], { duration: 720, easing: 'cubic-bezier(.5,0,.3,1)' });
      anim.onfinish = () => { f.remove(); tg.classList.remove('an-bump'); void tg.offsetWidth; tg.classList.add('an-bump'); };
    };
    if (has('fly')) document.addEventListener('click', onClick, true);
    return () => {
      on.forEach((k) => c.remove('an-' + k));
      touched.forEach((el) => { el.style.transform = ''; el.style.opacity = ''; el.style.strokeDashoffset = ''; el.style.removeProperty('--q'); el.style.removeProperty('--c'); });
      if (scrolly) { removeEventListener('scroll', onScroll); removeEventListener('resize', onResize); cancelAnimationFrame(raf); clearInterval(iv); io?.disconnect(); }
      document.removeEventListener('click', onClick, true);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!TRY_HOST) return null;
  const set = (v) => { ls.set('anim-try2', v); setTry(v); };
  return <AnimPanel v={tryV} set={set} />;
}

function AnimPanel({ v, set }) {
  const [open, setOpen] = useState(false);
  const all = (b) => set(Object.fromEntries(KEYS.map((k) => [k, b])));
  const n = KEYS.filter((k) => v[k]).length;
  return (
    <div className={'an-panel' + (open ? ' open' : '')}>
      {open && <div className="an-box" role="dialog" aria-label="Hareket denemesi">
        <div className="an-ph"><b>Hareket denemesi</b><small>Sadece bu önizlemede, bu cihazda</small></div>
        {ANIMS.map(([k, L, t]) => (
          <label key={k} className="an-row"><input type="checkbox" checked={!!v[k]} onChange={(e) => set({ ...v, [k]: e.target.checked })} /><span className="an-l">{L}</span><span>{t}</span></label>
        ))}
        <div className="an-ft">
          <button type="button" onClick={() => all(true)}>Hepsini aç</button>
          <button type="button" onClick={() => all(false)}>Hepsini kapat</button>
          <button type="button" className="pri" onClick={() => { scrollTo(0, 0); location.reload(); }}>Baştan oynat</button>
        </div>
        {RM() && <p className="an-rm">Cihazınızda "hareketi azalt" açık; hareketler gösterilmiyor.</p>}
      </div>}
      <button type="button" className="an-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Hareket <span>{n}/{KEYS.length}</span></button>
    </div>
  );
}
