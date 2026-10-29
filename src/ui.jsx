import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, api, store, toast } from './store.js';
import { initials, hue, vatOf, fmtTotals, picUrl, isAbsImg } from './utils.js';
import { STATUS } from './config.js';

const P = {
  chip: 'M7 7h10v10H7zM10 10h4v4h-4zM9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zM17 20.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1z',
  chat: 'M4 5h16v11H9l-5 4z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5M16 3.5a4 4 0 0 1 0 7.5M18 15.8c1.8.8 3.1 2.5 4 5.2',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-2.2 1.3l-.3 2h-4l-.3-2a7.6 7.6 0 0 1-2.2-1.3l-1.9.7-2-3.4 1.6-1.2a7.7 7.7 0 0 1 0-2.6L3 9.7l2-3.4 1.9.7a7.6 7.6 0 0 1 2.2-1.3l.3-2h4l.3 2a7.6 7.6 0 0 1 2.2 1.3l1.9-.7 2 3.4-1.6 1.2a7.7 7.7 0 0 1 0 2.6z',
  box: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  chev: 'M6 9l6 6 6-6',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  mail: 'M3.5 6.5h17v11h-17zM4 7l8 6 8-6',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2.2 2.2 0 0 0 4 0',
  heart: 'M12 20.3S3.5 15.1 3.5 9.2A4.4 4.4 0 0 1 12 6.9a4.4 4.4 0 0 1 8.5 2.3c0 5.9-8.5 11.1-8.5 11.1z',
  share: 'M12 3.5v11M8 7.5l4-4 4 4M6 11H5v9.5h14V11h-1',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  tack: 'M9 3.5h6l-.9 6.2 3.4 3.3H6.5l3.4-3.3L9 3.5zM12 13v8',
  pin: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ig: 'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.2 6.8h.01',
  fb: 'M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H8.8v3h2.6V21',
  play: 'M7.5 5.2v13.6a.6.6 0 0 0 .9.5l10.6-6.8a.6.6 0 0 0 0-1L8.4 4.7a.6.6 0 0 0-.9.5z',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16.5 9.5l5 5M21.5 9.5l-5 5',
  drag: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  brush: 'M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.6 0-.9-.8-1.3-.8-2.1 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4.9-4-8.8-9-8.8zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  vsize: 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  mobile: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  back: 'M15 5l-7 7 7 7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  send: 'M4 12 20 4l-6 16-3-7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  filter: 'M4 5h16l-6 7.5V19l-4 1v-7.5z',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  tag: 'M3 12V4h8l9.5 9.5-8 8zM7.5 8.5a1 1 0 1 0 0-.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  store: 'M4 10v10h16V10M3 10l2-6h14l2 6zM9 20v-5h6v5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  phone: 'M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  sort: 'M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1.5v2M12 20.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1.5 12h2M20.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  zoom: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6M11 8v6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  wa: 'M4 20l1.3-3.9A8.5 8.5 0 1 1 8 19zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9a5 5 0 0 1-2.8-2.8l.9-1-1-2z',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  eyeoff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.6 7.6C3.6 9.4 2 12 2 12s3.6 6 10 6a10 10 0 0 0 4.4-1',
  home: 'M3 11l9-7 9 7v9h-6v-6H9v6H3z',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  ask: 'M4 5h16v11h-8l-5 4v-4H4zM9.6 8.9a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.7-.9 1.3M12 14.4v.01',
};
// Kargo firması işareti (logo yerine sade yazı-işaret; ödeme adımı ve yönetim kargo kartı)
export function CarrierMark({ k, size = 'md' }) {
  if (k === 'dhl') return <span className={'cmark dhl ' + size} aria-label="DHL eCommerce"><b>DHL</b><small>eCommerce</small></span>;
  if (k === 'yurtici') return <span className={'cmark yurtici ' + size} aria-label="Yurtiçi Kargo"><b>Yurtiçi</b><small>Kargo</small></span>;
  return null;
}
export function Icon({ n, s = 20, className = '' }) {
  return (
    <svg className={'ic ' + className} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n]} />
    </svg>
  );
}

let openSheets = 0;
// Telefon: pencere açıkken arkadaki sayfa kaymasın. Sayfaya dokunmadan (sabitlemek iPhone'da arka planın bir an boş
// görünmesine yol açıyordu) dokunma hareketi süzülür: sadece pencerenin kaydırılabilir içi, kayabildiği yöne kayar.
if (typeof window !== 'undefined' && matchMedia('(hover: none) and (pointer: coarse)').matches) {
  let sx = 0, sy = 0, ly = 0;
  addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) { sx = t.clientX; sy = ly = t.clientY; } }, { passive: true, capture: true });
  addEventListener('touchmove', (e) => {
    if (!openSheets || !e.cancelable || e.touches.length !== 1) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t || !t.closest('.sheet-bg')) return; // pencere dışı (ör. büyük resim) kendi işine baksın
    const p = e.touches[0]; const dx = p.clientX - sx, dy0 = p.clientY - sy; const dy = p.clientY - ly; ly = p.clientY;
    // yana kaydırma: yana kayabilen bir kutunun içindeyse serbest (resim şeridi, küçük resimler)
    if (Math.abs(dx) > Math.abs(dy0)) {
      for (let el = t; el && !el.classList.contains('sheet-bg'); el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return;
      }
      e.preventDefault(); return;
    }
    // dikey: içinde dikey kayabilen bir kutu varsa ve o yöne kayabiliyorsa serbest
    for (let el = t; el && !el.classList.contains('sheet-bg'); el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        const atTop = el.scrollTop <= 0, atBot = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if ((dy > 0 && atTop) || (dy < 0 && atBot)) break; // kenarda: arkaya geçmesin
        return;
      }
    }
    e.preventDefault();
  }, { passive: false, capture: true });
}
// sticky: boş yere basınca / aşağı çekince / Esc ile KAPANMAZ (düzenleme pencereleri: emek kaybolmasın), sadece × ve düğmeler
export function Sheet({ title, onClose, children, footer, wide, sub, sticky, cls }) {
  const ref = useRef(null);
  // iPhone: menüden seçince parmak kalkarken aynı noktaya "hayalet" tıklama gelir; yeni açılan pencere bunu
  // arka plana tıklama sanıp kendini kapatıyordu → açıldıktan sonraki 500 ms arka plan tıklaması yok sayılır
  const born = useRef(Date.now());
  const bg = useRef(null);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !sticky && onClose();
    window.addEventListener('keydown', k);
    openSheets++; document.body.classList.add('noscroll');
    // aşağı çekerken içerik/sayfa da kaymasın (React'in dokunma dinleyicisi bunu engelleyemiyor)
    const el = ref.current;
    const tm = (e) => { if (drag.current?.on && e.cancelable) e.preventDefault(); };
    el?.addEventListener('touchmove', tm, { passive: false });
    // arka plana (karartılmış alan) dokunup kaydırmak hiçbir şeyi kaydırmasın
    const bgEl = bg.current;
    const bm = (e) => { if (e.target === bgEl && e.cancelable) e.preventDefault(); };
    bgEl?.addEventListener('touchmove', bm, { passive: false });
    return () => {
      window.removeEventListener('keydown', k); el?.removeEventListener('touchmove', tm); bgEl?.removeEventListener('touchmove', bm);
      if (--openSheets <= 0) {
        openSheets = 0; document.body.classList.remove('noscroll');
      }
    };
  }, []);
  // Telefonda: pencereyi tutup aşağı çekince kapanır (üst kısımdan ya da içerik en üstteyken her yerden)
  const drag = useRef(null);
  const onTouchStart = (e) => {
    if (!matchMedia('(max-width: 700px)').matches || e.touches.length !== 1) return;
    const body = ref.current.querySelector('.sheet-b');
    const fromTop = e.target.closest('.sheet-h, .sheet-grab');
    if (!fromTop && e.target.closest('.md-t, .md-grid')) return; // resim sıralarken pencere kaymasın
    if (!fromTop && (!body || body.scrollTop > 0 || e.target.closest('input, textarea, select, .gal-track, .gal-thumbs'))) return;
    drag.current = { y0: e.touches[0].clientY, t0: Date.now(), dy: 0, on: false };
  };
  const onTouchMove = (e) => {
    const d = drag.current; if (!d) return;
    const dy = e.touches[0].clientY - d.y0;
    if (!d.on) { if (dy < 6) { if (dy < -6) drag.current = null; return; } d.on = true; ref.current.style.transition = 'none'; }
    d.dy = Math.max(0, dy);
    ref.current.style.transform = `translateY(${d.dy}px)`;
    if (bg.current) bg.current.style.background = `rgb(8 16 13 / ${Math.max(0, 0.45 * (1 - d.dy / 500)).toFixed(3)})`;
  };
  const onTouchEnd = () => {
    const d = drag.current; drag.current = null; if (!d || !d.on) return;
    const el = ref.current; const fast = d.dy / Math.max(1, Date.now() - d.t0) > 0.6;
    el.style.transition = 'transform .22s ease';
    if (d.dy > 110 || (fast && d.dy > 40)) {
      el.style.transform = 'translateY(100%)'; if (bg.current) { bg.current.style.transition = 'background .22s'; bg.current.style.background = 'transparent'; }
      // sticky (düzenleme): kapanış onaya bağlı olabilir → kapanmadıysa pencere geri gelir
      setTimeout(() => { onClose(); if (sticky) setTimeout(() => { if (ref.current) { ref.current.style.transform = ''; if (bg.current) bg.current.style.background = ''; } }, 60); }, 200);
    }
    else { el.style.transform = ''; if (bg.current) bg.current.style.background = ''; }
  };
  // pencere sayfanın en üstüne (body) çizilir: içinde bulunduğu kutu ne olursa olsun ekrana göre konumlanır
  return createPortal(
    <div ref={bg} className="sheet-bg" onMouseDown={(e) => !sticky && e.target === e.currentTarget && Date.now() - born.current > 500 && onClose()}>
      <div ref={ref} className={'sheet' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '')} role="dialog" aria-modal="true" aria-label={title} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <span className="sheet-grab" aria-hidden="true" />
        <header className="sheet-h">
          <div className="sheet-title"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat"><Icon n="x" /></button>
        </header>
        <div className="sheet-b">{children}</div>
        {footer && <footer className="sheet-f">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function Thumb({ p, size = 'md' }) {
  const S = useStore((s) => s.settings);
  const [src, setSrc] = useState(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setBad(false);
    if (!p) return setSrc(null);
    if (p.img === 'fs') { let live = true; setSrc(null); api().getImage(p.id).then((d) => live && setSrc(d)); return () => { live = false; }; }
    if (p.img) return setSrc(p.img);
    const t = size === 'lg' ? S.catalog.imageLarge || S.catalog.imageThumb : S.catalog.imageThumb;
    if (p.pi && (p.pi.startsWith('r2:') || isAbsImg(p.pi))) return setSrc(picUrl(p.pi, t, size === 'lg')); // depoya yüklenen / tam adres
    if (!t || (t.includes('{pi}') && !p.pi)) return setSrc(null);
    setSrc(t.replaceAll('{pi}', p.pi || '').replaceAll('{kod}', p.k).replaceAll('{id}', p.id));
  }, [p?.id, p?.img, p?.pi, S.catalog.imageThumb, S.catalog.imageLarge, size]);
  const brand = (p?.n || '?').split(/\s+/)[0].replace(/[^\p{L}\p{N}]/gu, '').slice(0, 6);
  return (
    <div className={'thumb thumb-' + size} style={{ '--h': hue(brand) }}>
      {src && !bad ? <img src={src} alt="" loading="lazy" onError={() => setBad(true)} /> : <span className="thumb-ph">{brand || '—'}</span>}
    </div>
  );
}

export function Avatar({ u, size = 40 }) {
  const name = u?.name || u?.userName || u?.username || '?';
  return (
    <span className="avatar" style={{ width: size, height: size, '--h': hue(name), fontSize: size * 0.38 }}>
      {u?.photo ? <img src={u.photo} alt="" /> : initials(name)}
    </span>
  );
}

// onRemove: adet en alttayken − yerine çöp kovası çıkar (aynı renkte), basınca ürün kaldırılır (sepet, ürün penceresi);
// çöp ⇄ − geçişi ve sayının artıp azalması hafif animasyonlu
export function Stepper({ value, onChange, min = 0, small, onRemove }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const prev = useRef(value); const [dir, setDir] = useState('');
  useEffect(() => { if (value !== prev.current) setDir(value > prev.current ? 'up' : 'down'); prev.current = value; }, [value]);
  const del = !!onRemove && value <= Math.max(min, 1);
  return (
    <div className={'stepper' + (small ? ' sm' : '')}>
      <button type="button" className={'st-minus' + (del ? ' is-del' : '')} onClick={() => (del ? onRemove() : onChange(Math.max(min, value - 1)))} aria-label={del ? 'Sepetten çıkar' : 'Azalt'} title={del ? 'Sepetten çıkar' : undefined}>
        {onRemove ? <span className="st-ic" aria-hidden="true"><Icon n="minus" s={16} className="st-i-m" /><Icon n="trash" s={15} className="st-i-t" /></span> : <Icon n="minus" s={16} />}
      </button>
      <input key={value} className={dir ? 'st-' + dir : undefined} inputMode="numeric" value={txt} aria-label="Adet"
        onChange={(e) => setTxt(e.target.value.replace(/\D/g, ''))}
        onBlur={() => onChange(Math.max(min, Number(txt) || 0))}
        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Arttır"><Icon n="plus" s={16} /></button>
    </div>
  );
}

export function StatusPill({ status, map = STATUS, label }) {
  const st = map[status] || { label: status, tone: 'muted' };
  // durum rengi (st.c) varsa yönetimdeki sipariş renkleriyle aynı: renkli nokta + yazı
  if (st.c) return <span className={'pill st-pill st-' + status} style={{ '--t': st.c }}><i className="st-pill-d" />{label || st.label}</span>;
  return <span className={'pill tone-' + st.tone}>{label || st.label}</span>;
}

export function Field({ label, hint, children, row, error, opt, className = '' }) {
  return (
    <label className={'field' + (row ? ' row' : '') + (error ? ' bad' : '') + (className ? ' ' + className : '')}>
      <span className="field-l">{label}{opt && <small className="opt"> (isteğe bağlı)</small>}</span>
      {children}
      {error ? <span className="field-e">{error}</span> : hint && <span className="field-h">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint, id }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span className="toggle-t"><span>{label}</span>{hint && <small>{hint}</small>}</span>
      <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-s" aria-hidden="true" />
    </label>
  );
}

// Açılır-kapanır grup: başlığa basınca açılır, varsayılan kapalı
export function Fold({ title, hint, badge, children, open: init = false, className = '' }) {
  const [open, setOpen] = useState(init);
  return (
    <section className={'fold' + (open ? ' open' : '') + (className ? ' ' + className : '')}>
      <button type="button" className="fold-h" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="fold-t"><b>{title}</b>{hint && <small>{hint}</small>}</span>
        {badge != null && badge !== '' && <span className="fold-badge">{badge}</span>}
        <Icon n="chev" s={18} className="fold-chev" />
      </button>
      {open && <div className="fold-b">{children}</div>}
    </section>
  );
}

export function Empty({ icon = 'box', title, children }) {
  return (
    <div className="empty">
      <Icon n={icon} s={34} />
      <strong>{title}</strong>
      {children && <div className="empty-b">{children}</div>}
    </div>
  );
}

export function useInfinite(cb) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && cb(), { rootMargin: '600px' });
    io.observe(el); return () => io.disconnect();
  }, [cb]);
  return ref;
}

export function Confirm({ title, text, okLabel = 'Evet', tone = 'primary', onOk, onClose }) {
  const born = useRef(Date.now()); const ok = () => Date.now() - born.current > 450; // hayalet tıklama düğmelere de düşmesin
  return (
    <Sheet title={title} onClose={onClose} footer={<>
      <button className="btn ghost" onClick={() => ok() && onClose()}>Vazgeç</button>
      <button className={'btn ' + tone} onClick={() => { if (!ok()) return; onOk(); onClose(); }}>{okLabel}</button>
    </>}>
      <p className="muted">{text}</p>
    </Sheet>
  );
}

// Türkiye telefon numarası: 0(5xx) xxx xx xx — sıfırı kendisi ekler, yazdıkça biçimler
export function fmtPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('90') && d.length > 11) d = d.slice(2);
  if (d[0] !== '0') d = '0' + d;
  d = d.slice(0, 11);
  const a = d.slice(1, 4), b = d.slice(4, 7), c = d.slice(7, 9), e = d.slice(9, 11);
  let s = '0';
  if (a) s += '(' + a;
  if (a.length === 3) s += ')';
  if (b) s += ' ' + b;
  if (c) s += ' ' + c;
  if (e) s += ' ' + e;
  return s;
}
export const phoneDigits = (v) => String(v || '').replace(/\D/g, '');
// Cep telefonu: dokununca "0" hazır gelir (542… diye yazmaya başlanır), her rakamdan sonra imleç sona alınır
// (iPhone'da biçim eklenince imleç ortaya kaçıp rakamlar yanlış yere giriyordu); boş bırakılırsa "0" temizlenir.
export function PhoneInput({ id, value, onChange, required }) {
  const ref = useRef(null);
  const atEnd = useRef(true);
  const v = fmtPhone(value);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && atEnd.current && document.activeElement === el) { const n = el.value.length; try { el.setSelectionRange(n, n); } catch {} }
  }, [v]);
  return (
    <input ref={ref} id={id} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="0(5__) ___ __ __" value={v} required={required}
      onFocus={() => { if (!phoneDigits(value)) { atEnd.current = true; onChange('0'); } }}
      onBlur={() => { if (phoneDigits(value) === '0') onChange(''); }}
      onChange={(e) => { const el = e.target; atEnd.current = (el.selectionStart ?? el.value.length) >= el.value.length - 1; onChange(fmtPhone(el.value)); }}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        if (e.key === 'Backspace' && el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
          e.preventDefault(); atEnd.current = true; onChange(fmtPhone(phoneDigits(el.value).slice(0, -1)));
        }
      }} />
  );
}

// Şifre alanı: göz simgesine basılı tutulduğu sürece şifre görünür
export function PasswordInput({ id, value, onChange, autoComplete, required }) {
  const [show, setShow] = useState(false);
  const on = (e) => { e.preventDefault(); setShow(true); };
  const off = () => setShow(false);
  return (
    <div className="pw-in">
      <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} required={required} />
      <button type="button" className={'pw-eye' + (show ? ' on' : '')} aria-label="Basılı tutunca şifreyi göster" title="Basılı tutunca şifreyi göster"
        onPointerDown={on} onPointerUp={off} onPointerLeave={off} onPointerCancel={off} onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setShow(true)} onKeyUp={off} onBlur={off}>
        <Icon n="eye" s={18} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sağ tık (ve telefonda basılı tutma) menüsü
// openMenu(e, items, title)  items: [{ label, icon, onClick, danger, disabled, hint }] veya '-' (ayraç)
export function openMenu(e, items, title) {
  e.preventDefault(); e.stopPropagation();
  const list = items.filter(Boolean);
  if (!list.length) return;
  // düğmeden açılan menü düğmeye hizalanır (sağ kenarı düğmenin sağıyla, hemen altında); sağ tık imlecin yerinde
  const t = e.type === 'click' && e.currentTarget?.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : null;
  const rect = t && t.width ? { l: t.left, r: t.right, t: t.top, b: t.bottom } : null;
  store.set({ ctx: { x: e.clientX, y: e.clientY, rect, items: list, title, touch: !!(e.nativeEvent || e).lp } });
}
export const closeMenu = () => store.s.ctx && store.set({ ctx: null });
export async function copyText(t, label = 'Kopyalandı') {
  try { await navigator.clipboard.writeText(String(t)); toast(label); } catch { toast('Kopyalanamadı', 'bad'); }
}
export function ContextMenu() {
  const ctx = useStore((s) => s.ctx);
  return ctx?.touch ? <SheetMenu ctx={ctx} /> : <DeskMenu ctx={ctx} />;
}
// Telefonda uzun basınca: iOS tarzı alttan açılan işlem listesi + ayrı "Vazgeç" düğmesi; kapanırken aşağı kayar
function SheetMenu({ ctx }) {
  const [out, setOut] = useState(false);
  // Menüyü açan parmak kalkınca iPhone bir "tıklama" daha üretiyor; menü açıldıktan sonra yeni bir dokunuş gelmeden
  // (ya da fareyle) hiçbir tıklama kabul edilmez, yoksa menü bırakır bırakmaz kapanıyordu.
  const armed = useRef(false);
  // iPhone bu tıklamayı "fare" diye işaretleyebiliyor ve parmak ne kadar uzun tutulursa tutulsun gönderiyor; bu yüzden
  // tek ölçü: menünün üstünde YENİ bir dokunuş başlamış olmalı.
  const ok = () => armed.current;
  const close = (fn) => { if (out) return; setOut(true); setTimeout(() => { closeMenu(); fn?.(); }, 190); };
  useEffect(() => { const k = (e) => e.key === 'Escape' && close(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); });
  return (
    <div className={'ctx-sheet-bg' + (out ? ' out' : '')} onTouchStart={() => { armed.current = true; }} onClick={(e) => ok(e.nativeEvent) && close()} onContextMenu={(e) => e.preventDefault()}>
      <div className="ctx-sheet" role="menu" onClick={(e) => e.stopPropagation()}>
        <div className="ctx-sheet-list">
          {ctx.title && <div className="ctx-sheet-t">{ctx.title}</div>}
          {ctx.items.filter((it, i, a) => it !== '-' || (i > 0 && i < a.length - 1 && a[i - 1] !== '-')).map((it, i) => it === '-' ? <div key={i} className="ctx-sheet-sep" /> : (
            <button key={i} role="menuitem" className={'ctx-sheet-item' + (it.danger ? ' danger' : '') + (it.on ? ' on' : '')} style={it.color ? { '--mc': it.color } : undefined} disabled={it.disabled} onClick={(e) => ok(e.nativeEvent) && close(it.onClick)}>
              {it.color && <i className="ctx-dot" />}<span className="ctx-l">{it.label}</span>
              {it.hint && <span className="ctx-hint">{it.hint}</span>}
              {it.icon && <Icon n={it.icon} s={19} />}
            </button>
          ))}
        </div>
        <button className="ctx-sheet-cancel" onClick={(e) => ok(e.nativeEvent) && close()}>Vazgeç</button>
      </div>
    </div>
  );
}
function DeskMenu({ ctx }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!ctx) return;
    const el = ref.current; const w = el?.offsetWidth || 220, h = el?.offsetHeight || 200;
    const W = document.documentElement.clientWidth || innerWidth, H = document.documentElement.clientHeight || innerHeight, R = ctx.rect;
    let x = ctx.x, y = ctx.y;
    if (R) { x = R.r - w; if (x < 8) x = R.l; y = R.b + 6; if (y + h > H - 8 && R.t - h - 6 > 8) y = R.t - h - 6; }
    setPos({ left: Math.max(8, Math.min(x, W - w - 12)), top: Math.max(8, Math.min(y, H - h - 8)) });
    const close = (ev) => { if (ev.type === 'keydown' && ev.key !== 'Escape') return; if (ev.type === 'mousedown' && (ref.current?.contains(ev.target) || ev.target?.classList?.contains('ctx-catch'))) return; closeMenu(); };
    addEventListener('mousedown', close, true); addEventListener('keydown', close, true); addEventListener('resize', close); addEventListener('scroll', close, true);
    setTimeout(() => ref.current?.querySelector('button:not(:disabled)')?.focus(), 0);
    return () => { removeEventListener('mousedown', close, true); removeEventListener('keydown', close, true); removeEventListener('resize', close); removeEventListener('scroll', close, true); };
  }, [ctx]);
  if (!ctx) return null;
  const move = (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return; e.preventDefault();
    const bs = [...ref.current.querySelectorAll('button:not(:disabled)')]; const i = bs.indexOf(document.activeElement);
    bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus();
  };
  // menü açıkken dışarıya dokunmak SADECE menüyü kapatır (alttaki ürün / düğme açılmaz): görünmez yakalayıcı katman
  return (<>
    <div className="ctx-catch" onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); }} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
    <div ref={ref} className="ctx" role="menu" style={pos || { left: ctx.x, top: ctx.y, visibility: 'hidden' }} onKeyDown={move} onContextMenu={(e) => e.preventDefault()}>
      {ctx.title && <div className="ctx-title">{ctx.title}</div>}
      {ctx.items.map((it, i) => it === '-' ? <div key={i} className="ctx-sep" role="separator" /> : (
        <button key={i} role="menuitem" className={'ctx-item' + (it.danger ? ' danger' : '') + (it.on ? ' on' : '')} style={it.color ? { '--mc': it.color } : undefined} disabled={it.disabled}
          onClick={() => { closeMenu(); it.onClick?.(); }}>
          <span className="ctx-ic">{it.color ? <i className="ctx-dot" /> : it.icon && <Icon n={it.icon} s={16} />}</span>
          <span className="ctx-l">{it.label}</span>
          {it.hint && <span className="ctx-hint">{it.hint}</span>}
        </button>
      ))}
    </div>
  </>);
}

// Toplamın altında küçük KDV bilgisi (ürün fiyatlarına dokunmaz). Oran ve göster/gizle: Ayarlar > Fiyatlandırma
export function VatLines({ by, rate, className = '' }) {
  const P = useStore((s) => s.settings.pricing);
  const v = vatOf(by, P.vatPct ?? 20);
  if (P.showVat === false || !v.pct || !Object.keys(by || {}).length) return null;
  const tl = rate?.usd && Object.keys(v.inc).every((c) => c === 'USD' || c === 'TRY') ? Object.entries(v.inc).reduce((n, [c, x]) => n + (c === 'USD' ? x * rate.usd : x), 0) : null;
  return (
    <div className={'vat ' + className}>
      <span>KDV %{v.pct.toLocaleString('tr-TR')} <b className="num">{fmtTotals(v.vat)}</b></span>
      <span className="vat-sep">·</span>
      <span>KDV dahil <b className="num">{fmtTotals(v.inc)}</b>{tl != null && <> <span className="num">(≈ {Math.round(tl).toLocaleString('tr-TR')} ₺)</span></>}</span>
    </div>
  );
}

// İki yönlü yapışkan kenar menüsü (27.10.2026): menü ekrandan kısaysa normal yapışkan; uzunsa sayfayla birlikte kayar ama
// yön değişince hemen o yöne gelir (aşağı inerken alt ucu, yukarı çıkarken üst ucu görünür) — "önce sağ taraf en üste gelsin" yok.
// Kullanım: const ref = useStickySide(); <aside ref={ref}> (CSS: position: sticky; align-self: start)
export function useStickySide(gap = 20) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const desk = () => matchMedia('(min-width: 900px)').matches;
    const topH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 64;
    let lastY = scrollY, off = null;
    const apply = () => {
      if (!desk()) { el.style.top = ''; off = null; return; }
      const t = topH() + gap, h = el.offsetHeight, vh = innerHeight;
      if (h <= vh - t - 16) { off = t; el.style.top = t + 'px'; return; } // sığıyor: düz yapışkan
      const min = vh - h - 16; // alt ucu ekranın altında
      if (off == null) off = t;
      off = Math.max(min, Math.min(t, off - (scrollY - lastY)));
      el.style.top = Math.round(off) + 'px';
    };
    const onScroll = () => { apply(); lastY = scrollY; };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { apply(); }) : null; ro?.observe(el);
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); apply();
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); ro?.disconnect(); };
  }, []);
  return ref;
}

// Telefonda arama kutusu açıkken (klavye açık) başka bir yere dokunmak SADECE klavyeyi kapatır; alttaki ürün açılmaz
if (typeof window !== 'undefined' && 'ontouchstart' in window) {
  let sw = 0;
  document.addEventListener('touchstart', (e) => {
    const a = document.activeElement;
    if (a && a.matches?.('input[type=search], .search input') && !e.target.closest?.('input, textarea, select, .search, .hsearch, .kf-search, .oform-res')) { a.blur(); sw = Date.now(); }
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', () => { sw = 0; }, { capture: true, passive: true });
  document.addEventListener('click', (e) => { if (sw && Date.now() - sw < 700) { sw = 0; e.preventDefault(); e.stopPropagation(); } }, true);
}
