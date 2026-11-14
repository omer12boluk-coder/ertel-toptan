// 14.11.2026 Hareket dili v3 (look.anim.<anahtar> = 'on' → açık; varsayılan kapalı = bugünkü site). Kullanıcı denemesinden
// sonra 4 hareket kaldı: bn (banner kaydırdıkça geri çekilir), raf (Yeni gelenler kartları sağdan kayar), ind (set indirimi
// çizilir), mrk (marka dalgası). CSS style.css sonunda 'Hareket dili v3'. raf/ind/mrk: kartların KENDİSİ %20 görününce data-an alır
// (bölüm başlığına bağlanınca kartlar görünmeden bitiyordu) ve bir kez oynar.
// iPhone Safari: yana kayan sıralarda (mıknatıslı kaydırma, scroll-snap) hareket sürerken mıknatıs kapalı (data-an='go'),
// bitince açılır ('ok') — yoksa kartlar hareket sonunda bir daha 'gidip yerine oturuyordu'. Bu kutulara will-change VERME (titretti). bn: tek rAF kaydırma dinleyicisi, sadece banner'a satır içi transform/opacity yazar
// (layout okumaz → takılmaz). 'Hareketi azalt' açıksa hiçbiri yok. Reddedilenler style.css başlığında.
// DİKKAT: html sınıfları an-<anahtar>; başka öğeye bu adları (an-bn, an-raf…) VERME (an-fly/an-hd çakışıp sayfayı kilitlemişti).
// Önizleme hostunda (adında '--' olan ya da ?hareket) sağ altta 'Hareket' paneli: tek tek aç/kapat (bu cihazda, ls 'anim-try8').
import { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { ls } from './utils.js';

export const ANIMS = [
  ['gfly', 'B1', 'Açılış: logo menüye uçar'],
  ['gscn', 'C1', 'Açılış: sahne kurulur (menüler, banner, Yeni gelenler)'],
  ['gwrd', 'D1', 'Giriş: dönen kelime'],
  ['gnum', 'D2', 'Giriş: canlı sayılar'],
  ['gshn', 'D4', 'Giriş: düğmede ışık'],
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

function readTry() { const v = ls.get('anim-try8', null); return v && typeof v === 'object' ? v : Object.fromEntries(KEYS.map((k) => [k, k !== 'gshn'])); }

export function AnimLayer() {
  const A = useStore((s) => s.settings?.look?.anim) || null;
  const perfMode = useStore((s) => s.settings?.look?.perf) || '';
  const lite = useLite(perfMode);
  const [tryV, setTry] = useState(() => (TRY_HOST ? readTry() : null));
  const on = lite ? [] : KEYS.filter((k) => (tryV ? tryV[k] : A?.[k] === 'on'));
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
    let raf = 0; let heroH = 0; let lastHp = -1; let hero = null; let fade = null;
    const tick = () => {
      raf = 0; if (!hero || !hero.isConnected) { hero = document.querySelector('.shell.public .cd-hero'); heroH = 0; } if (!hero) return;
      if (hero.closest('.kp-off')) return; // ana sayfa gizliyken (başka sayfadayken) DOKUNMA: o sayfanın kaydırması banner'ı bozuyordu, dönünce yanlış çizilip oturuyordu
      if (!heroH) heroH = hero.offsetHeight || 1;
      const hp = Math.round(Math.max(0, Math.min(1, scrollY / heroH)) * 200) / 200; if (hp === lastHp) return; lastHp = hp;
      // 14.11 akşam: banner'ın KENDİSİ küçültülmez/soldurulmaz — Safari resmi katmanda yeniden çizerken 3-4 px 'tık' yapıyordu
      // (ekran kaydıyla ölçüldü), katmansızken de her karede yeniden çizilip takılıyordu. Üstüne sayfa renginde perde (.an-hfade) iner.
      if (!fade || !fade.isConnected) { fade = document.createElement('div'); fade.className = 'an-hfade'; fade.setAttribute('aria-hidden', 'true'); hero.appendChild(fade); }
      fade.style.opacity = (hp * 0.62).toFixed(3);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onResize = () => { heroH = 0; onScroll(); };
    if (has('bn')) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onResize); tick(); }
    return () => {
      on.forEach((k) => c.remove('an-' + k));
      io?.disconnect(); mo?.disconnect(); cancelAnimationFrame(wr); clearInterval(iv); document.querySelectorAll('[data-an]').forEach((x) => x.removeAttribute('data-an'));
      if (has('bn')) { removeEventListener('scroll', onScroll); removeEventListener('resize', onResize); cancelAnimationFrame(raf); fade?.remove(); fade = null; }
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!TRY_HOST) return null;
  const set = (v) => { ls.set('anim-try8', v); setTry(v); };
  return <AnimPanel v={tryV} set={set} lite={lite} />;
}

// ---- 14.11.2026 Zayıf cihazda hafif mod (look.perf: '' otomatik | 'off' hiç | 'on' hep açık) ----
// Kullanıcının 60 Hz Intel MacBook'u: 10 sn'de 34–37 takılma + 1 sn'lik donmalar; 'Akıcılık' panelinde efektler kapanınca düzeldi.
// Otomatik: sayfa açıldıktan 2 sn sonra, SADECE kaydırılırken kare süreleri toplanır; 4 sn kaydırma birikince karar verilir:
// saniyede 0,6'dan fazla 50 ms+ duraklama ya da 2+ donma (>150 ms) → hafif mod (1,7× ölçüsü hızlı makineyi de yakaladı). Karar cihazda 14 gün saklanır
// (ls 'perf-lite'), her açılışta yeniden ölçülmez. Hafif mod = html.pf-lite → buzlu cam, gölgeler, banner animasyonları,
// kayan şerit kapalı, hareket dili (an-*) yok, tanıtım videosu kendiliğinden başlamaz (film.js opts.auto bunu okur).
// 14.11.2026 açılış sahnesi (giriş sayfası → mağaza): herogate.jsx bunu okur. Önizlemede panel seçimi, canlıda look.anim.
// 'Hareketi azalt' ya da bu cihazda hafif mod kararı varsa hepsi kapalı.
export function gateFx(look) {
  if (RM()) return {};
  const lv = ls.get('perf-lite', null); if (look?.perf === 'on' || (look?.perf !== 'off' && lv?.lite && Date.now() - lv.at < 14 * 864e5)) return {};
  const v = TRY_HOST ? readTry() : null; const A = look?.anim || {};
  const on = (k) => (v ? !!v[k] : A[k] === 'on');
  return { fly: on('gfly'), scn: on('gscn'), word: on('gwrd'), num: on('gnum'), shine: on('gshn') };
}
export const TRY = TRY_HOST;
export const isLite = () => typeof document !== 'undefined' && document.documentElement.classList.contains('pf-lite');
const LITE_DAYS = 14;
function useLite(mode) {
  const [auto, setAuto] = useState(() => { const v = ls.get('perf-lite', null); return !!(v && Date.now() - v.at < LITE_DAYS * 864e5 && v.lite); });
  const lite = mode === 'on' ? true : mode === 'off' ? false : auto;
  useEffect(() => { const c = document.documentElement.classList; c.toggle('pf-lite', lite); return () => c.remove('pf-lite'); }, [lite]);
  useEffect(() => {
    if (mode) return undefined;
    const v = ls.get('perf-lite', null); if (v && Date.now() - v.at < LITE_DAYS * 864e5) return undefined; // bu cihaz için karar var
    const t0 = performance.now(); let lastS = 0, raf = 0, last = 0, active = 0, long = 0; const ds = []; let done = false;
    const decide = () => {
      done = true; removeEventListener('scroll', onS);
      const so = [...ds].sort((a, b) => a - b); const med = so[Math.floor(so.length / 2)] || 16.7;
      // göze batan duraklama = 50 ms'den uzun kare (60 Hz'de 3+ kare atlandı); 1,7× ölçüsü hızlı makineyi de 'zayıf' saydı → kullanılmaz
      const j50 = ds.filter((d) => d > 50).length; const rate = j50 / (active / 1000);
      const res = { lite: rate > 0.6 || long >= 2, at: Date.now(), hz: Math.round(1000 / med), rate: Math.round(rate * 10) / 10, long };
      ls.set('perf-lite', res); if (res.lite) setAuto(true);
    };
    const f = (t) => {
      raf = 0; const d = t - last; last = t;
      if (t - lastS < 250 && d < 1500) { active += d; ds.push(d); if (d > 150) long++; }
      if (active >= 4000) return decide();
      if (t - lastS < 250) raf = requestAnimationFrame(f);
    };
    const onS = () => {
      if (done) return; const n = performance.now(); if (n - t0 < 2000) return; if (n - t0 > 90000) { done = true; removeEventListener('scroll', onS); return; }
      lastS = n; if (!raf) { last = n; raf = requestAnimationFrame(f); }
    };
    addEventListener('scroll', onS, { passive: true });
    return () => { removeEventListener('scroll', onS); cancelAnimationFrame(raf); };
  }, [mode]);
  return lite;
}

// Markalar sayfası: dalga sırası = satır + sütun (ızgaranın sütun sayısı ekrana göre değişir → konumdan hesaplanır)
function waveIdx(grid) {
  const tiles = [...grid.children].slice(0, 60); if (!tiles.length) return;
  const x0 = tiles[0].offsetLeft, y0 = tiles[0].offsetTop, w = tiles[0].offsetWidth || 1, h = tiles[0].offsetHeight || 1;
  tiles.forEach((t) => { const c = Math.round((t.offsetLeft - x0) / w), r = Math.round((t.offsetTop - y0) / h); t.style.setProperty('--d', Math.min(12, c + r)); });
}

// 14.11.2026 Akıcılık (sadece önizleme): MacBook'ta (60 Hz) 'kasıyor' şikâyeti için. Kare hızı, ekranın Hz'i, takılma sayacı +
// ağır olabilecek efektleri tek tek kapatma (html.pf-<k>; ls 'perf-try'). Kullanıcı sebebi bulunca kalıcı çözüm: cihaz zorlanırsa o efekt kendiliğinden hafifler.
const PERF = [
  ['glass', 'Buzlu cam efektlerini kapat'],
  ['shadow', 'Gölgeleri kapat'],
  ['bnanim', 'Banner animasyonlarını kapat'],
  ['film', 'Tanıtım videosunu gizle'],
  ['mq', 'Kayan marka şeridini durdur'],
];
function usePerf() {
  const [pf, setPf] = useState(() => { const v = ls.get('perf-try', null); return v && typeof v === 'object' ? v : {}; });
  useEffect(() => { const c = document.documentElement.classList; const on = PERF.map((x) => x[0]).filter((k) => pf[k]); on.forEach((k) => c.add('pf-' + k)); return () => on.forEach((k) => c.remove('pf-' + k)); }, [pf]);
  return [pf, (v) => { ls.set('perf-try', v); setPf(v); }];
}
function useMeter() {
  const [m, setM] = useState({ fps: 0, hz: 0, jank: 0 });
  useEffect(() => {
    let raf = 0, last = performance.now(), frames = [], jank = [], shown = 0;
    const f = (t) => {
      const d = t - last; last = t; frames.push([t, d]); while (frames.length && t - frames[0][0] > 1000) frames.shift();
      const ds = frames.map((x) => x[1]).sort((a, b) => a - b); const med = ds[Math.floor(ds.length / 2)] || 16.7;
      if (d > med * 1.7 && d < 1000) jank.push(t); while (jank.length && t - jank[0] > 10000) jank.shift();
      if (t - shown > 500) { shown = t; const hz = [60, 90, 100, 120, 144, 165, 240].reduce((a, h) => (Math.abs(1000 / med - h) < Math.abs(1000 / med - a) ? h : a), 60); setM({ fps: frames.length, hz, jank: jank.length }); }
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, []);
  return m;
}
const BROWSER = typeof navigator === 'undefined' ? '' : /Edg\//.test(navigator.userAgent) ? 'Edge' : /Chrome\//.test(navigator.userAgent) ? 'Chrome' : /Safari\//.test(navigator.userAgent) ? 'Safari' : /Firefox\//.test(navigator.userAgent) ? 'Firefox' : '';

function AnimPanel({ v, set, lite }) {
  const [open, setOpen] = useState(false);
  const [pf, setPf] = usePerf(); const m = useMeter();
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
          <button type="button" onClick={() => { try { sessionStorage.removeItem('hero-seen'); } catch {} location.href = '/'; }}>Girişi tekrar göster</button>
        </div>
        {RM() && <p className="an-rm">Cihazınızda "hareketi azalt" açık; hareketler gösterilmiyor.</p>}
        <div className="an-ph an-ph2"><b>Akıcılık</b><small>Kaydırırken bakın: kare hızı ekranın Hz'ine yakın, takılma az olmalı</small></div>
        <div className="an-meter"><span><b className="num">{m.fps}</b> fps</span><span>Ekran <b className="num">{m.hz}</b> Hz</span><span>Takılma <b className="num">{m.jank}</b> <small>/10 sn</small></span></div>
        <small className="an-dev">{innerWidth}×{innerHeight} · piksel oranı {devicePixelRatio} · {BROWSER}</small>
        <div className="an-lite"><span>Hafif mod: <b>{lite ? 'AÇIK' : 'kapalı'}</b>{(() => { const v = ls.get('perf-lite', null); return v ? <small> · ölçüm: {v.hz} Hz, sn'de {v.rate} duraklama, {v.long} donma</small> : <small> · henüz ölçülmedi (birkaç saniye kaydırın)</small>; })()}</span>
          <button type="button" onClick={() => { ls.del('perf-lite'); location.reload(); }}>Yeniden ölç</button></div>
        {PERF.map(([k, t]) => (
          <label key={k} className="an-row"><input type="checkbox" checked={!!pf[k]} onChange={(e) => setPf({ ...pf, [k]: e.target.checked })} /><span className="an-l">⨯</span><span>{t}</span></label>
        ))}
      </div>}
      <button type="button" className="an-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Hareket <span>{n}/{KEYS.length} · {m.fps} fps</span></button>
    </div>
  );
}
