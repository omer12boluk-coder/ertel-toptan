// 14.11.2026 Hareket dili v3 (look.anim.<anahtar> = 'on' → açık; varsayılan kapalı = bugünkü site). Kullanıcı denemesinden
// sonra 4 hareket kaldı: bn (banner kaydırdıkça geri çekilir), raf (Yeni gelenler kartları sağdan kayar), ind (set indirimi
// çizilir), mrk (marka dalgası). CSS style.css sonunda 'Hareket dili v3'. raf/ind/mrk: kartların KENDİSİ %20 görününce data-an alır
// (bölüm başlığına bağlanınca kartlar görünmeden bitiyordu) ve bir kez oynar.
// iPhone Safari: yana kayan sıralarda (mıknatıslı kaydırma, scroll-snap) hareket sürerken mıknatıs kapalı (data-an='go'),
// bitince açılır ('ok') — yoksa kartlar hareket sonunda bir daha 'gidip yerine oturuyordu'. Bu kutulara will-change VERME (titretti). bn: tek rAF kaydırma dinleyicisi, sadece banner'a satır içi transform/opacity yazar
// (layout okumaz → takılmaz). 'Hareketi azalt' açıksa hiçbiri yok. Reddedilenler style.css başlığında.
// DİKKAT: html sınıfları an-<anahtar>; başka öğeye bu adları (an-bn, an-raf…) VERME (an-fly/an-hd çakışıp sayfayı kilitlemişti).
// Önizleme hostunda (adında '--' olan ya da ?hareket) sağ altta 'Hareket' paneli: tek tek aç/kapat (bu cihazda, ls 'anim-try7').
import { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { ls } from './utils.js';

export const ANIMS = [
  ['rv', '0', 'Deneme: bölümler solarak gelmesin'],
  ['bn', 'G', 'Banner geri çekilsin'],
  ['raf', 'B', 'Ürün rafları kayarak gelsin (Yeni gelenler + raflar)'],
  ['pk', 'P', 'Bu hafta masamızdan: kartlar yükselsin'],
  ['tz', 'T', 'Tezgâhın için: kutular kayarak gelsin'],
  ['flm', 'V', 'Yakından bak: video açılarak gelsin'],
  ['ic', 'D', 'Güven satırları: ikonlar çizilsin'],
  ['ind', 'E', 'İndirim çizilsin (ana sayfa setleri)'],
  ['mrk', 'F', 'Marka dalgası (ana sayfa)'],
  ['sind', 'S', 'Set sayfası: indirim çizilsin'],
  ['ok', 'O', 'Sipariş alındı: onay işareti çizilsin'],
  ['bpw', 'M', 'Markalar sayfası: logo dalgası'],
];
const KEYS = ANIMS.map((a) => a[0]);
const TRY_HOST = typeof location !== 'undefined' && (location.hostname.includes('--') || /[?&]hareket\b/.test(location.search));
const RM = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function readTry() { const v = ls.get('anim-try7', null); return v && typeof v === 'object' ? v : Object.fromEntries(KEYS.map((k) => [k, true])); }

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
    const sel = [has('raf') && '.cd-sec .cd-rail', has('pk') && '.cd-bento > .cd-big, .cd-bento > .cd-grid', has('tz') && '.cd-ads', has('flm') && '.flm-box', has('ic') && '.p0-trust', has('ind') && '.cd-sets', has('mrk') && '.cd-bwall', has('sind') && '.set-page .set-price, .set-page .set-list', has('ok') && '.done-card', has('bpw') && '.bp-grid'].filter(Boolean).join(', ');
    const seen = new WeakSet();
    const io = sel ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const t = e.target; if (t.classList.contains('bp-grid')) waveIdx(t); t.setAttribute('data-an', 'go'); io.unobserve(t); setTimeout(() => t.isConnected && t.setAttribute('data-an', 'ok'), 1900); } }), { threshold: 0.2 }) : null;
    const watch = () => { if (io) for (const x of document.querySelectorAll(sel)) if (!seen.has(x)) { seen.add(x); io.observe(x); } };
    // yeni sayfa / bölüm açılınca HEMEN fark et (aralıklı kontrol 0,8 sn geç kalıyordu → markalar sayfasında logolar boş bekliyordu)
    let wr = 0; const mo = io ? new MutationObserver(() => { if (!wr) wr = requestAnimationFrame(() => { wr = 0; watch(); }); }) : null;
    mo?.observe(document.body, { childList: true, subtree: true });
    watch(); const iv = io ? setInterval(watch, 1500) : 0;
    // ---- bn: banner kaydırdıkça geri çekilir ----
    let raf = 0; let heroH = 0; let lastHp = -1; let hero = null;
    const tick = () => {
      raf = 0; if (!hero || !hero.isConnected) { hero = document.querySelector('.shell.public .cd-hero'); heroH = 0; } if (!hero) return;
      if (hero.closest('.kp-off')) return; // ana sayfa gizliyken (başka sayfadayken) DOKUNMA: o sayfanın kaydırması banner'ı bozuyordu, dönünce yanlış çizilip oturuyordu
      if (!heroH) heroH = hero.offsetHeight || 1;
      const hp = Math.round(Math.max(0, Math.min(1, scrollY / heroH)) * 200) / 200; if (hp === lastHp) return; lastHp = hp;
      hero.style.transform = hp ? `scale(${(1 - hp * 0.08).toFixed(3)})` : ''; hero.style.opacity = hp ? (1 - hp * 0.55).toFixed(3) : ''; // will-change YOK: kaydırılmış hâlde sayfadan çıkıp dönünce Safari katmanı yeniden kurup titretiyordu ('bazen oluyor')
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onResize = () => { heroH = 0; onScroll(); };
    if (has('bn')) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onResize); tick(); }
    return () => {
      on.forEach((k) => c.remove('an-' + k));
      io?.disconnect(); mo?.disconnect(); cancelAnimationFrame(wr); clearInterval(iv); document.querySelectorAll('[data-an]').forEach((x) => x.removeAttribute('data-an'));
      if (has('bn')) { removeEventListener('scroll', onScroll); removeEventListener('resize', onResize); cancelAnimationFrame(raf); if (hero) { hero.style.transform = ''; hero.style.opacity = ''; } }
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!TRY_HOST) return null;
  const set = (v) => { ls.set('anim-try7', v); setTry(v); };
  return <AnimPanel v={tryV} set={set} />;
}

// Markalar sayfası: dalga sırası = satır + sütun (ızgaranın sütun sayısı ekrana göre değişir → konumdan hesaplanır)
function waveIdx(grid) {
  const tiles = [...grid.children].slice(0, 60); if (!tiles.length) return;
  const x0 = tiles[0].offsetLeft, y0 = tiles[0].offsetTop, w = tiles[0].offsetWidth || 1, h = tiles[0].offsetHeight || 1;
  tiles.forEach((t) => { const c = Math.round((t.offsetLeft - x0) / w), r = Math.round((t.offsetTop - y0) / h); t.style.setProperty('--d', Math.min(12, c + r)); });
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
