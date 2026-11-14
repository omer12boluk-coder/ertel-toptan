// 14.11.2026 Hareket dili v3 (look.anim.<anahtar> = 'on' → açık; varsayılan kapalı = bugünkü site). Kullanıcı denemesinden
// sonra 4 hareket kaldı: bn (banner kaydırdıkça geri çekilir), raf (Yeni gelenler kartları sağdan kayar), ind (set indirimi
// çizilir), mrk (marka dalgası). CSS style.css sonunda 'Hareket dili v3'. raf/ind/mrk: kartların KENDİSİ %20 görününce data-an alır
// (bölüm başlığına bağlanınca kartlar görünmeden bitiyordu) ve bir kez oynar.
// iPhone Safari: yana kayan sıralarda (mıknatıslı kaydırma, scroll-snap) hareket sürerken mıknatıs kapalı (data-an='go'),
// bitince açılır ('ok') — yoksa kartlar hareket sonunda bir daha 'gidip yerine oturuyordu'. Bu kutulara will-change VERME (titretti). bn: tek rAF kaydırma dinleyicisi, sadece banner'a satır içi transform/opacity yazar
// (layout okumaz → takılmaz). 'Hareketi azalt' açıksa hiçbiri yok. Reddedilenler style.css başlığında.
// DİKKAT: html sınıfları an-<anahtar>; başka öğeye bu adları (an-bn, an-raf…) VERME (an-fly/an-hd çakışıp sayfayı kilitlemişti).
// Önizleme hostunda (adında '--' olan ya da ?hareket) sağ altta 'Hareket' paneli: tek tek aç/kapat (bu cihazda, ls 'anim-try4').
import { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { ls } from './utils.js';

export const ANIMS = [
  ['bn', 'G', 'Banner geri çekilsin'],
  ['raf', 'B', 'Yeni gelenler kayarak gelsin'],
  ['ind', 'E', 'İndirim çizilsin (ana sayfa setleri)'],
  ['mrk', 'F', 'Marka dalgası (ana sayfa)'],
  ['sind', 'S', 'Set sayfası: indirim çizilsin'],
  ['ok', 'O', 'Sipariş alındı: onay işareti çizilsin'],
  ['sep', 'K', 'Sepet: satır kapanır, toplam akar'],
  ['bpw', 'M', 'Markalar sayfası: logo dalgası'],
];
const KEYS = ANIMS.map((a) => a[0]);
const TRY_HOST = typeof location !== 'undefined' && (location.hostname.includes('--') || /[?&]hareket\b/.test(location.search));
const RM = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function readTry() { const v = ls.get('anim-try4', null); return v && typeof v === 'object' ? v : Object.fromEntries(KEYS.map((k) => [k, true])); }

export function AnimLayer() {
  const A = useStore((s) => s.settings?.look?.anim) || null;
  const [tryV, setTry] = useState(() => (TRY_HOST ? readTry() : null));
  const on = KEYS.filter((k) => (tryV ? tryV[k] : A?.[k] === 'on'));
  const key = on.join(' ');
  useEffect(() => {
    if (RM()) return undefined;
    const c = document.documentElement.classList; on.forEach((k) => c.add('an-' + k));
    const has = (k) => on.includes(k);
    // ---- raf / ind / mrk: bölüm ekrana değdiği an bir kez ----
    const sel = [has('raf') && '.cd-nwsec .cd-rail', has('ind') && '.cd-sets', has('mrk') && '.cd-bwall', has('sind') && '.set-page .set-price, .set-page .set-list', has('ok') && '.done-card', has('bpw') && '.bp-grid'].filter(Boolean).join(', ');
    const seen = new WeakSet();
    const io = sel ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const t = e.target; if (t.classList.contains('bp-grid')) waveIdx(t); t.setAttribute('data-an', 'go'); io.unobserve(t); setTimeout(() => t.isConnected && t.setAttribute('data-an', 'ok'), 1900); } }), { threshold: 0.2 }) : null;
    const watch = () => { if (io) for (const x of document.querySelectorAll(sel)) if (!seen.has(x)) { seen.add(x); io.observe(x); } };
    // yeni sayfa / bölüm açılınca HEMEN fark et (aralıklı kontrol 0,8 sn geç kalıyordu → markalar sayfasında logolar boş bekliyordu)
    let wr = 0; const mo = io ? new MutationObserver(() => { if (!wr) wr = requestAnimationFrame(() => { wr = 0; watch(); }); }) : null;
    mo?.observe(document.body, { childList: true, subtree: true });
    watch(); const iv = io ? setInterval(watch, 1500) : 0;
    // ---- sep: sepette toplam yeni rakama akar (yazı değişince sayılar 0,45 sn'de eskiden yeniye) ----
    const tw = has('sep') ? watchTotals() : null;
    // ---- bn: banner kaydırdıkça geri çekilir ----
    let raf = 0; let heroH = 0; let lastHp = -1; let hero = null;
    const tick = () => {
      raf = 0; if (!hero || !hero.isConnected) { hero = document.querySelector('.shell.public .cd-hero'); heroH = 0; } if (!hero) return;
      if (!heroH) heroH = hero.offsetHeight || 1;
      const hp = Math.round(Math.max(0, Math.min(1, scrollY / heroH)) * 200) / 200; if (hp === lastHp) return; lastHp = hp;
      hero.style.transform = hp ? `scale(${(1 - hp * 0.08).toFixed(3)})` : ''; hero.style.opacity = hp ? (1 - hp * 0.55).toFixed(3) : '';
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onResize = () => { heroH = 0; onScroll(); };
    if (has('bn')) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onResize); tick(); }
    return () => {
      on.forEach((k) => c.remove('an-' + k));
      io?.disconnect(); mo?.disconnect(); cancelAnimationFrame(wr); clearInterval(iv); tw?.(); document.querySelectorAll('[data-an]').forEach((x) => x.removeAttribute('data-an'));
      if (has('bn')) { removeEventListener('scroll', onScroll); removeEventListener('resize', onResize); cancelAnimationFrame(raf); if (hero) { hero.style.transform = ''; hero.style.opacity = ''; } }
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!TRY_HOST) return null;
  const set = (v) => { ls.set('anim-try4', v); setTry(v); };
  return <AnimPanel v={tryV} set={set} />;
}

// Markalar sayfası: dalga sırası = satır + sütun (ızgaranın sütun sayısı ekrana göre değişir → konumdan hesaplanır)
function waveIdx(grid) {
  const tiles = [...grid.children].slice(0, 60); if (!tiles.length) return;
  const x0 = tiles[0].offsetLeft, y0 = tiles[0].offsetTop, w = tiles[0].offsetWidth || 1, h = tiles[0].offsetHeight || 1;
  tiles.forEach((t) => { const c = Math.round((t.offsetLeft - x0) / w), r = Math.round((t.offsetTop - y0) / h); t.style.setProperty('--d', Math.min(12, c + r)); });
}

// Sepet: satır silinince önce sola kayıp solar, sonra yüksekliği kapanır; ardından gerçekten silinir (fn).
// Kapalıyken / 'hareketi azalt'ta doğrudan siler.
export function delRow(id, fn) {
  const li = document.documentElement.classList.contains('an-sep') && !RM() ? document.querySelector(`.gl-sw[data-cl="${CSS.escape(String(id))}"]`) : null;
  if (!li || li.dataset.rm) return fn();
  li.dataset.rm = '1'; const h = li.offsetHeight; li.style.overflow = 'hidden';
  const a = li.animate([
    { height: h + 'px', opacity: 1, transform: 'translateX(0)' },
    { height: h + 'px', opacity: 0, transform: 'translateX(-18px)', offset: 0.45 },
    { height: '0px', opacity: 0, transform: 'translateX(-18px)', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', borderWidth: '0px' },
  ], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  a.onfinish = fn; a.oncancel = fn;
}

// Sepet toplamları: yazı değişince içindeki sayılar eskiden yeniye akar (biçim aynen korunur: $, ₺, binlik nokta, virgül)
const NUM = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
const toN = (t) => Number(t.replace(/\./g, '').replace(',', '.'));
const toT = (n, d) => n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
function watchTotals() {
  const last = new WeakMap(); const mine = new WeakMap(); const seen = new WeakSet(); const obs = [];
  const SEL = '.cart-sum b.num, .cart-bar-t b.num, .cart-subtot b.num';
  const run = (el, from, to) => {
    const a = from.match(NUM) || [], b = to.match(NUM) || []; const tn = el.firstChild;
    if (!a.length || a.length !== b.length || !tn || el.childNodes.length !== 1 || tn.nodeType !== 3) return;
    const parts = to.split(NUM); const dec = b.map((x) => (x.split(',')[1] || '').length); const A = a.map(toN), B = b.map(toN);
    const t0 = performance.now(); el.__tw = (el.__tw || 0) + 1; const my = el.__tw;
    const step = (t) => {
      if (el.__tw !== my || !el.isConnected) return; const k = Math.min(1, (t - t0) / 450); const e = 1 - Math.pow(1 - k, 3);
      let out = parts[0]; B.forEach((v, i) => { out += toT(A[i] + (v - A[i]) * e, dec[i]) + parts[i + 1]; });
      if (k >= 1) out = to; mine.set(el, out); tn.nodeValue = out; el.__run = k < 1; if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const attach = () => {
    for (const pg of document.querySelectorAll('.cart-page')) {
      if (seen.has(pg)) continue; seen.add(pg);
      pg.querySelectorAll(SEL).forEach((el) => last.set(el, el.textContent));
      const mo = new MutationObserver(() => {
        pg.querySelectorAll(SEL).forEach((el) => {
          const now = el.textContent; const was = last.get(el);
          if (was === undefined) { last.set(el, now); return; }
          if (now === was || now === mine.get(el)) return;
          last.set(el, now); run(el, el.__run ? mine.get(el) || was : was, now);
        });
      });
      mo.observe(pg, { subtree: true, characterData: true, childList: true }); obs.push(mo);
    }
  };
  attach(); const iv = setInterval(attach, 800);
  return () => { clearInterval(iv); obs.forEach((m) => m.disconnect()); };
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
