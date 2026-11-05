// Tasarım modu 2: önizleme çerçevesi. Mağaza sayfası gerçek genişlikte bir iframe'in içine (React portal) çizilir:
// telefon kuralları (@media) gerçekten telefon genişliğine göre çalışır, bilgisayar görünümü yan panellerden bağımsız 1280 px'tir.
// Aynı React ağacı olduğu için bağlam, durum ve olaylar ortak; sürüklemeler çerçevenin kendi penceresini dinler (winOf).
import { ensureFonts } from './slidex.jsx';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const WinCtx = createContext(null);
export const useWin = () => useContext(WinCtx) || window;
// olayın geldiği pencere / belge (çerçeve içindeyse çerçeveninki)
export const winOf = (e) => e?.view || e?.target?.ownerDocument?.defaultView || window;
export const docOf = (e) => winOf(e).document;

// pointer sürüklemesi: hareket ve bırakma olaylarını olayın geldiği pencerede dinler
export function onDrag(e, move, end) {
  const w = winOf(e);
  const mv = (ev) => move(ev, w);
  const up = (ev) => { w.removeEventListener('pointermove', mv); w.removeEventListener('pointerup', up); w.removeEventListener('pointercancel', up); w.document.body.classList.remove('dz-dragging'); document.body.classList.remove('dz-dragging'); end?.(ev, w); };
  w.addEventListener('pointermove', mv, { passive: false }); w.addEventListener('pointerup', up); w.addEventListener('pointercancel', up);
  return w;
}

// width: çerçevenin gerçek genişliği (px). Görünen alana sığmazsa küçültülür (scale). height: görünen yükseklik.
export function DeviceFrame({ width, availW, height, kind, rootVars, rootClass, theme, children, onReady, label }) {
  const ref = useRef(null);
  const [body, setBody] = useState(null);
  const scale = Math.min(1, (availW || width) / width);
  useLayoutEffect(() => {
    const f = ref.current; const d = f.contentDocument;
    d.open(); d.write('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'); d.close();
    // mağazanın stilleri (tek <style> + yazı tipleri) çerçeveye kopyalanır
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => d.head.appendChild(n.cloneNode(true)));
    const st = d.createElement('style');
    st.textContent = 'html,body{margin:0;background:var(--bg-user, var(--bg));} body{overflow-x:hidden} .dz-frame-root{padding:18px 0 40vh} .dz-frame-root .dz-canvas{margin:0 auto}';
    d.head.appendChild(st);
    d.documentElement.classList.add('dz-in-frame', 'dz-k-' + kind);
    setBody(d.body);
    onReady?.(f.contentWindow);
  }, []);
  // mağaza renkleri (taslaktaki) çerçevenin kökünde
  useEffect(() => {
    const d = ref.current?.contentDocument; if (!d) return; const r = d.documentElement;
    Object.entries(rootVars || {}).forEach(([k, v]) => (v == null || v === '' ? r.style.removeProperty(k) : r.style.setProperty(k, v)));
    if (theme && theme !== 'auto') r.setAttribute('data-theme', theme); else r.removeAttribute('data-theme');
    // Stil Stüdyosu sınıfları (st-…) + yazı tipleri
    [...r.classList].filter((c) => c.startsWith('st-')).forEach((c) => r.classList.remove(c));
    (r.__dzc || []).forEach((c) => r.classList.remove(c)); // 5.11.2026: site teması / cam / menü sınıfları da (önceki seçimden kalmasın)
    r.__dzc = (rootClass?.cls || []).filter(Boolean);
    r.__dzc.forEach((c) => r.classList.add(c));
    if (rootClass?.fonts?.length) ensureFonts(d, rootClass.fonts);
  }, [body, JSON.stringify(rootVars), JSON.stringify(rootClass || null), theme]);
  return (
    <div className={'dzf dzf-' + kind} style={{ width: width * scale, height }}>
      {label && <span className="dzf-label">{label}</span>}
      <div className="dzf-screen" style={{ width, height: height / scale, transform: `scale(${scale})` }}>
        <iframe ref={ref} title={label || 'Önizleme'} className="dzf-if" />
      </div>
      {body && createPortal(<WinCtx.Provider value={ref.current.contentWindow}>{children}</WinCtx.Provider>, body)}
    </div>
  );
}

// kapsayıcının genişlik/yükseklik ölçümü
export function useSize(ref) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setS({ w: el.clientWidth, h: el.clientHeight }); f();
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  return s;
}
