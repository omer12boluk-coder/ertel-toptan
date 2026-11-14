// 14.11.2026 Hareket dili (look.anim.<anahtar> = 'on' → açık; varsayılan kapalı = bugünkü site).
// Her hareket html'e 'an-<anahtar>' sınıfı ekler; CSS style.css sonunda ('Hareket dili'). Bölüm ilk göründüğünde
// bir kez oynar (useReveal'in koyduğu .rv[data-in]). Kaydırmaya bağlı olanlar (Keşfet, banner, haftanın ürünü)
// tek bir rAF kaydırma dinleyicisiyle çalışır. 'Hareketi azalt' açık olan cihazda hiçbiri çalışmaz (CSS + burada).
// DİKKAT: html sınıfları an-<anahtar>; başka öğeye bu adları (an-hd, an-fly…) VERME (çakıştı, sayfa kilitlendi).
// Önizleme hostunda (adında '--' olan) sağ altta 'Hareket' paneli: tek tek aç/kapat (bu cihazda, ls 'anim-try').
import { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { ls } from './utils.js';

export const ANIMS = [
  ['hd', 'A', 'Başlık perdesi'],
  ['raf', 'B', 'Raf akışı'],
  ['ksf', 'C', 'Keşfet derinliği'],
  ['ic', 'D', 'İkonlar kendini çizsin'],
  ['ind', 'E', 'İndirim çizilsin'],
  ['mrk', 'F', 'Marka dalgası'],
  ['bn', 'G', 'Banner geri çekilsin'],
  ['wk', 'H', 'Haftanın ürünü sahnesi (telefon)'],
  ['fly', 'I', 'Ürün sepete uçsun'],
];
const KEYS = ANIMS.map((a) => a[0]);
const TRY_HOST = typeof location !== 'undefined' && (location.hostname.includes('--') || /[?&]hareket\b/.test(location.search));
const RM = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function readTry() { const v = ls.get('anim-try', null); return v && typeof v === 'object' ? v : Object.fromEntries(KEYS.map((k) => [k, true])); }

export function AnimLayer() {
  const A = useStore((s) => s.settings?.look?.anim) || null;
  const [tryV, setTry] = useState(() => (TRY_HOST ? readTry() : null));
  const on = KEYS.filter((k) => (tryV ? tryV[k] : A?.[k] === 'on'));
  const key = on.join(' ');
  useEffect(() => {
    if (RM()) return undefined;
    const c = document.documentElement.classList; on.forEach((k) => c.add('an-' + k));
    const has = (k) => on.includes(k);
    // ---- kaydırmaya bağlı hareketler ----
    let raf = 0;
    const tick = () => {
      raf = 0; const H = innerHeight;
      if (has('ksf')) document.querySelectorAll('.cd-ad').forEach((el) => {
        const r = el.getBoundingClientRect(); if (r.bottom < -50 || r.top > H + 50) return;
        const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - H / 2) / H));
        el.style.setProperty('--py', (70 + p * 30).toFixed(1) + '%');
      });
      if (has('bn')) { const el = document.querySelector('.shell.public .cd-hero'); if (el) { const h = el.offsetHeight || 1; el.style.setProperty('--hp', Math.max(0, Math.min(1, scrollY / h)).toFixed(3)); } }
      if (has('wk') && innerWidth <= 700) document.querySelectorAll('.cd-big').forEach((el) => {
        const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > H) return;
        const span = Math.max(1, r.height - H * 0.7); const q = Math.max(0, Math.min(1, (80 - r.top) / span));
        el.style.setProperty('--wq', q.toFixed(3)); const st = String(q < 0.3 ? 0 : q < 0.62 ? 1 : 2);
        if (el.dataset.st !== st) el.dataset.st = st;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const scrolly = has('ksf') || has('bn') || has('wk');
    if (scrolly) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); tick(); }
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
      if (scrolly) { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf); }
      document.removeEventListener('click', onClick, true);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!TRY_HOST) return null;
  const set = (v) => { ls.set('anim-try', v); setTry(v); };
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
      <button type="button" className="an-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Hareket <span>{n}/9</span></button>
    </div>
  );
}
