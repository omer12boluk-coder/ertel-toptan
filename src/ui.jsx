import { useEffect, useState, useRef } from 'react';
import { useStore, api } from './store.js';
import { initials, hue } from './utils.js';
import { STATUS } from './config.js';

const P = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
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
};
export function Icon({ n, s = 20, className = '' }) {
  return (
    <svg className={'ic ' + className} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n]} />
    </svg>
  );
}

let openSheets = 0;
export function Sheet({ title, onClose, children, footer, wide, sub }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    openSheets++; document.body.classList.add('noscroll');
    return () => { window.removeEventListener('keydown', k); if (--openSheets <= 0) { openSheets = 0; document.body.classList.remove('noscroll'); } };
  }, []);
  return (
    <div className="sheet-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-h">
          <div className="sheet-title"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat"><Icon n="x" /></button>
        </header>
        <div className="sheet-b">{children}</div>
        {footer && <footer className="sheet-f">{footer}</footer>}
      </div>
    </div>
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

export function Stepper({ value, onChange, min = 0, small }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  return (
    <div className={'stepper' + (small ? ' sm' : '')}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Azalt"><Icon n="minus" s={16} /></button>
      <input inputMode="numeric" value={txt} aria-label="Adet"
        onChange={(e) => setTxt(e.target.value.replace(/\D/g, ''))}
        onBlur={() => onChange(Math.max(min, Number(txt) || 0))}
        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Arttır"><Icon n="plus" s={16} /></button>
    </div>
  );
}

export function StatusPill({ status }) {
  const st = STATUS[status] || { label: status, tone: 'muted' };
  return <span className={'pill tone-' + st.tone}>{st.label}</span>;
}

export function Field({ label, hint, children, row }) {
  return (
    <label className={'field' + (row ? ' row' : '')}>
      <span className="field-l">{label}</span>
      {children}
      {hint && <span className="field-h">{hint}</span>}
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
  return (
    <Sheet title={title} onClose={onClose} footer={<>
      <button className="btn ghost" onClick={onClose}>Vazgeç</button>
      <button className={'btn ' + tone} onClick={() => { onOk(); onClose(); }}>{okLabel}</button>
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
export function PhoneInput({ id, value, onChange, required }) {
  return (
    <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="0(5__) ___ __ __" value={fmtPhone(value)} required={required}
      onChange={(e) => onChange(fmtPhone(e.target.value))}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        if (e.key === 'Backspace' && el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
          e.preventDefault(); onChange(fmtPhone(phoneDigits(el.value).slice(0, -1)));
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
