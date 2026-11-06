// Fotoğraflı bannerlar (7.11.2026, Claude): gerçek ürün fotoğraflarıyla 5 hazır banner. Ana sayfanın büyük reklam alanında
// (Paket 0 P0Hero ve eski Hero) kullanıcının kendi reklamlarından ÖNCE gösterilir; kullanıcının reklamlarına dokunmaz.
// Kapatmak: shopHome.photoBn === false (Tasarım modu › büyük reklam alanı › 'Claude’un fotoğraflı bannerları').
// Tasarım: docs/banner-oneri/ (gen.py = sunumdaki HTML). Resimler hosting/public/bn/, logolar /brands/.
// Kutu boyu her yerde farklı (P0 büyük kutu ~1.45:1, eski banner ~2.6:1, telefon ~0.75:1) → banner bir "tuval"e çizilir:
// geniş kutuda yükseklik 560 birim (en az 1000 birim genişlik), telefonda genişlik 358 birim; yerleşim tuval boyuna göre hesaplanır.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { store, setQty, toast } from './store.js';
import { ensureFonts } from './slidex.jsx';
import { useWin } from './dzframe.jsx';

const ACC = '#2f62d6';
const IMG = (f) => '/bn/' + f;
export const photoBnOn = (H) => H?.photoBn !== false;

// Her banner: ad (panelde), zemin, logo, yazılar, iki bağlantı (a1 = dolu düğme, a2 = yazı bağlantısı).
// Bağlantı: 'p:<id>' ürün · 'cart:<id>' sepete ekle · 'cat:<id>' · 'brand:<ad>' (shophome useOpenLink biçimi)
export const PHOTO_BANNERS = [
  { id: 'quick861', name: 'Quick 861 Pro Max', bg: '#000', dark: true, logo: '/brands/quick.png', logoWhite: true, lh: 34, eye: 'Yeni', eyeC: '#f5a54a',
    title: '861 Pro Max', tag: 'Söyle, ısıtsın.', sub: 'Sesli komutla çalışan 1300W sıcak hava istasyonu.', subM: 'Sesli komutlu 1300W sıcak hava.',
    a1: ['İncele', 'p:3066'], a2: ['Sepete ekle', 'cart:3066'], btn: ACC, lnk: '#5b9cff' },
  { id: 'zm6745', name: 'AmScope ZM6745T', bg: '#fbfbfd', logo: '/brands/amscope.png', lh: 30, center: true,
    title: 'ZM6745T', tag: 'Netlik. Her açıdan.', a1: ['İncele', 'p:3064'], a2: ['Mikroskoplar', 'cat:14'], btn: ACC, lnk: ACC },
  { id: 'hands', name: 'AmScope — Tamircinin gözü', bg: '#fff', logo: '/brands/amscope.png', lh: 30, eye: 'Mikroskoplar', eyeC: '#bf4800',
    title: 'Tamircinin\ngözü.', titleM: 'Tamircinin gözü.', sub: 'Stereo kafalar, objektifler, halka ışıklar ve aksesuarlar. Hepsi tek yerde.', subM: 'Stereo kafalar, objektifler ve aksesuarlar.',
    a1: ['Mikroskoplara bak', 'cat:14'], a2: ['Aksesuarlar', 'cat:73'], btn: ACC, lnk: ACC },
  { id: 'ht316', name: 'Aixun HT316', bg: 'radial-gradient(60% 80% at 30% 60%, #ffffff 0%, #f0f0f3 70%)', bgM: 'radial-gradient(80% 60% at 50% 75%, #ffffff 0%, #f0f0f3 75%)', logo: '/brands/aixun-dark.png', lh: 32, eye: 'HT316', eyeC: '#1d1d1f',
    title: 'İki iş.\nTek istasyon.', sub: '1400W sıcak hava ve havya aynı gövdede. Masada yer açar, işi hızlandırır.', subM: '1400W sıcak hava ve havya tek gövdede.',
    a1: ['İncele', 'p:2759'], a2: ['Havya istasyonları', 'cat:5'], a2M: 'İstasyonlar', btn: ACC, lnk: ACC },
  { id: 'da07', name: '2UUL DA07', bg: 'linear-gradient(120deg, #f2fbf7 0%, #d3efe2 100%)', bgM: 'linear-gradient(170deg, #f2fbf7 0%, #d3efe2 100%)', logo: '/brands/2uul.png', lh: 40, eye: 'DA07 · iPhone 17 serisine uygun', eyeM: 'DA07', eyeC: '#0b7a52',
    title: 'Arka kapak,\ntek presle.', titleC: '#0f241b', subC: '#4a5f55', sub: 'Mini ısıtmalı pres istasyonu. Kasa ve arka kapak yapıştırmada eşit baskı, eşit ısı.', subM: 'iPhone 17 serisine uygun mini ısıtmalı pres.',
    a1: ['İncele', 'p:2756'], a2: ['2UUL ürünleri', 'brand:2UUL'], btn: '#0b7a52', lnk: '#0b7a52' },
];

const Chev = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;

// yazı bloğu (logo · başlık · slogan · açıklama · düğmeler)
function Txt({ b, m, hs = 64, act, center, w }) {
  const ink = b.dark ? '#f5f5f7' : '#1d1d1f';
  const sub = b.dark ? '#a1a1a6' : b.subC || '#6e6e73';
  const eye = m ? b.eyeM || b.eye : b.eye;
  const title = m ? b.titleM || b.title : b.title;
  const s = m ? b.subM || b.sub : b.sub;
  const fs = m ? 15 : 16;
  return (
    <div className="pb-t" style={{ width: w, display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left', gap: m ? 8 : 12 }}>
      <span className="pb-eye" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: m ? 2 : 6, color: b.eyeC, font: `600 ${m ? 12.5 : 15}px/1.2 Inter, sans-serif` }}>
        <img src={b.logo} alt="" style={{ height: Math.round(b.lh * (m ? 0.7 : 1)), width: 'auto', display: 'block', filter: b.logoWhite ? 'brightness(0) invert(1)' : undefined }} />
        {eye && <span style={{ paddingLeft: 12, borderLeft: '1px solid currentColor', opacity: 0.9 }}>{eye}</span>}
      </span>
      <h2 style={{ margin: 0, font: `600 ${m ? (b.center ? 38 : 34) : hs}px/1.03 'Inter Tight', Inter, sans-serif`, letterSpacing: m ? '-.03em' : '-.035em', color: b.titleC || ink, whiteSpace: 'pre-line' }}>{title}</h2>
      {b.tag && <p style={{ margin: 0, font: `500 ${m ? 19 : b.center ? 26 : 28}px/1.2 Inter, sans-serif`, letterSpacing: '-.015em', color: ink }}>{b.tag}</p>}
      {s && <p style={{ margin: 0, font: `400 ${m ? 15 : 20}px/1.4 Inter, sans-serif`, color: sub, maxWidth: m ? '100%' : 440 }}>{s}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 8 }}>
        <button type="button" className="pb-b1" onClick={act(b.a1[1])} style={{ height: m ? 42 : 48, padding: '0 24px', borderRadius: 999, background: b.btn, color: '#fff', font: `500 ${fs}px/1 Inter, sans-serif`, border: 0, cursor: 'pointer' }}>{b.a1[0]}</button>
        <button type="button" className="pb-b2" onClick={act(b.a2[1])} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, color: b.lnk, font: `500 ${fs}px/1 Inter, sans-serif`, cursor: 'pointer' }}>{(m && b.a2M) || b.a2[0]} <Chev /></button>
      </div>
    </div>
  );
}

const abs = (o) => ({ position: 'absolute', ...o });
const vmid = { top: 0, bottom: 0, display: 'flex', alignItems: 'center' };

// geniş kutu yerleşimi (W ≥ 1000, H ≥ 560 tuval birimi)
function Wide({ b, W, H, act }) {
  const T = (p) => <Txt b={b} act={act} {...p} />;
  if (b.id === 'quick861') {
    const iw = Math.min((H + 80) * 1.4, W - 380), ih = iw / 1.4;
    return <>
      <img src={IMG('q861-pc.webp')} alt="Quick 861 Pro Max" style={abs({ right: -40, top: (H - ih) / 2, width: iw, height: ih })} />
      <div style={abs({ left: 0, top: 0, bottom: 0, width: 560, background: 'linear-gradient(90deg, #000 62%, rgba(0,0,0,0))' })} />
      <div style={abs({ left: 88, ...vmid })}>{T({ w: 470 })}</div>
    </>;
  }
  if (b.id === 'zm6745') {
    const k = Math.min(H / 560, 1.25); let h1 = 330 * k, h2 = 400 * k;
    const sum = (2 * h1 * 0.63) + h2 * 0.585; const gap = Math.max(20, Math.min(90, (W - sum) / 4));
    // ortadaki mikroskobun tepesi düğmelerin altında kalsın (yazı bloğu ~250 birim)
    const tt = 46 + (H - 560) * 0.25; const push = Math.max(0, tt + 262 - (H - (h2 - 96 * k)));
    return <>
      <div style={abs({ left: 0, right: 0, top: tt, display: 'flex', justifyContent: 'center' })}>{T({ center: true, hs: 60 })}</div>
      <div style={abs({ left: 0, right: 0, bottom: -96 * k - push, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap })}>
        <img src={IMG('zm-left.webp')} alt="" style={{ height: h1, width: 'auto' }} />
        <img src={IMG('zm-front.webp')} alt="AmScope ZM6745T" style={{ height: h2, width: 'auto' }} />
        <img src={IMG('zm-right.webp')} alt="" style={{ height: h1, width: 'auto' }} />
      </div>
    </>;
  }
  if (b.id === 'hands') {
    const iw = Math.min(760, W * 0.52); const tw = W - iw - 88 - 40;
    return <>
      <img src={IMG('hands.webp')} alt="Mikroskop kafasını ayarlayan eller" style={abs({ right: 0, top: 0, width: iw, height: H, objectFit: 'cover', objectPosition: '50% 30%' })} />
      <div style={abs({ left: 88, ...vmid })}>{T({ w: Math.min(520, tw), hs: tw < 420 ? 56 : 64 })}</div>
    </>;
  }
  if (b.id === 'ht316') {
    const iw = Math.min(640, W * 0.46), il = W * 0.05; const tl = Math.max(il + iw + 60, W * 0.56); const tw = Math.min(520, W - tl - 50);
    const bot = 70 + (H - 560) * 0.4;
    return <>
      <div style={abs({ left: il + 20, bottom: bot - 10, width: iw * 0.94, height: 30, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.18), rgba(0,0,0,0))' })} />
      <img src={IMG('ht316.webp')} alt="Aixun HT316" style={abs({ left: il, bottom: bot, width: iw, height: 'auto' })} />
      <div style={abs({ left: tl, ...vmid })}>{T({ w: tw, hs: tw < 440 ? 56 : 64 })}</div>
    </>;
  }
  // da07
  const ih = Math.min(460, H * 0.82), iw = ih * 0.885; const ir = Math.min(170, W * 0.1); const tw = Math.min(520, W - ir - iw - 88 - 30);
  return <>
    <div style={abs({ right: ir - 16, bottom: 36, width: iw + 32, height: 40, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(10,60,40,.22), rgba(0,0,0,0))' })} />
    <img src={IMG('da07.webp')} alt="2UUL DA07" style={abs({ right: ir, bottom: 52, height: ih, width: 'auto' })} />
    <div style={abs({ left: 88, ...vmid })}>{T({ w: tw, hs: tw < 440 ? 56 : 64 })}</div>
  </>;
}

// telefon yerleşimi (W = 358 tuval birimi; H kutuya göre ~450–600)
function Phone({ b, H, act }) {
  const top = <div style={abs({ left: 0, right: 0, top: 30, padding: '0 24px', display: 'flex', justifyContent: 'center' })}><Txt b={b} m center act={act} w="100%" /></div>;
  const free = H - 225; // yazı bloğunun altında kalan yükseklik
  if (b.id === 'quick861') { const s = Math.min(358, free + 64); return <><img src={IMG('q861-m.webp')} alt="Quick 861 Pro Max" style={abs({ left: (358 - s) / 2, bottom: -64 * (s / 358), width: s, height: s })} />{top}</>; }
  if (b.id === 'zm6745') { const h = Math.min(340, free + 70); return <>{top}<img src={IMG('zm-front.webp')} alt="AmScope ZM6745T" style={abs({ left: '50%', bottom: -70 * (h / 340), height: h, width: 'auto', transform: 'translateX(-50%)' })} /></>; }
  if (b.id === 'hands') { const h = Math.min(300, free - 10); return <><img src={IMG('hands.webp')} alt="Mikroskop kafasını ayarlayan eller" style={abs({ left: 0, right: 0, bottom: 0, width: 358, height: h, objectFit: 'cover', objectPosition: '50% 35%' })} />{top}</>; }
  if (b.id === 'ht316') { const w = Math.min(330, (free - 34) * 1.425); return <>{top}<img src={IMG('ht316.webp')} alt="Aixun HT316" style={abs({ left: (358 - w) / 2, bottom: 34, width: w, height: 'auto' })} /></>; }
  const h = Math.min(260, free - 22);
  return <>{top}<img src={IMG('da07.webp')} alt="2UUL DA07" style={abs({ left: '50%', bottom: 22, height: h, width: 'auto', transform: 'translateX(-50%)' })} /></>;
}

// Kutuyu tamamen dolduran banner (konumlu bir ebeveynin içine konur)
export function PhotoBanner({ b, open, onProduct, edit }) {
  const ref = useRef(null); const [sz, setSz] = useState(null);
  const win = useWin();
  useEffect(() => { ensureFonts(win.document, ['inter', 'intert']); }, [win]);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width && r.height) setSz((o) => (o && Math.abs(o.w - r.width) < 0.5 && Math.abs(o.h - r.height) < 0.5 ? o : { w: r.width, h: r.height })); };
    read(); if (!('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(read); ro.observe(el); return () => ro.disconnect();
  }, []);
  const act = (l) => (e) => {
    e.stopPropagation(); if (edit || !l) return;
    if (l.startsWith('cart:')) {
      const id = Number(l.slice(5)); const p = store.s.byId?.get(id);
      if (p && p.s > 0 && p.a !== 0 && !p.so) { setQty(id, (store.s.cart?.[id] || 0) + 1); toast?.('Sepete eklendi'); } else if (p) onProduct?.(p);
      return;
    }
    open(l)();
  };
  let cv = null; let bg = b.bg;
  if (sz) {
    const phone = sz.w / sz.h < 1.05;
    let s, W, H;
    if (phone) { s = sz.w / 358; W = 358; H = sz.h / s; }
    else { s = sz.h / 560; W = sz.w / s; H = 560; if (W < 1000) { s = sz.w / 1000; W = 1000; H = sz.h / s; } }
    cv = <div className="pb-cv" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${s})`, transformOrigin: '0 0', fontFamily: 'Inter, sans-serif' }}>
      {phone ? <Phone b={b} H={H} act={act} /> : <Wide b={b} W={W} H={H} act={act} />}
    </div>;
    if (phone && b.bgM) bg = b.bgM;
  }
  return <div ref={ref} className={'pb-box' + (b.dark ? ' pb-dark' : ' pb-light')} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bg }}>{cv}</div>;
}
