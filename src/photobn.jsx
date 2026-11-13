// Fotoğraflı bannerlar (7.11.2026, Claude): gerçek ürün fotoğraflarıyla 5 hazır banner. Ana sayfanın büyük reklam alanında
// (Paket 0 P0Hero ve eski Hero) kullanıcının kendi reklamlarından ÖNCE gösterilir; kullanıcının reklamlarına dokunmaz.
// Kapatmak: shopHome.photoBn === false (Tasarım modu › büyük reklam alanı › 'Claude’un fotoğraflı bannerları').
// Tasarım: docs/banner-oneri/ (gen.py = sunumdaki HTML). Resimler hosting/public/bn/, logolar /brands/.
// Kutu boyu her yerde farklı (P0 büyük kutu ~1.45:1, eski banner ~2.6:1, telefon ~0.75:1) → banner bir "tuval"e çizilir:
// geniş kutuda yükseklik 560 birim (en az 1000 birim genişlik), telefonda genişlik 358 birim; yerleşim tuval boyuna göre hesaplanır.
import { TA, taLen, taStep } from './textanim.jsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { store, setQty, toast, useStore } from './store.js';
import { ensureFonts } from './slidex.jsx';
import { useWin } from './dzframe.jsx';
import BANNERS from './icerik/bannerlar.json';

const ACC = '#2f62d6';
const IMG = (f) => '/bn/' + f;
export const IMG_ANIM = [['', 'Yükselerek'], ['strong', 'Güçlü yükseliş'], ['blur', 'Yazı gibi netleşme'], ['side', 'Yandan kayarak'], ['zoom', 'Büyüyerek'], ['off', 'Kapalı']];
export const photoBnOn = (H) => H?.photoBn !== false;

// Her banner: ad (panelde), zemin, logo, yazılar, iki bağlantı (a1 = dolu düğme, a2 = yazı bağlantısı).
// Bağlantı: 'p:<id>' ürün · 'cart:<id>' sepete ekle · 'cat:<id>' · 'brand:<ad>' (shophome useOpenLink biçimi)
// İÇERİK: src/icerik/bannerlar.json (yeni banner = o dosyaya bir satır; tarif claude/is/banner-ekle.md)
// "off": true = kod tarafında kapalı (mağazada hiç görünmez). "oto": true = kullanıcının reklam listesinde yoksa kendiliğinden eklenir
// (son fotoğraflı bannerın arkasına; "bas": true ise en öne). Kullanıcı Tasarım'da kapatırsa satır 'off' olur, geri gelmez.
export const PHOTO_BANNERS = BANNERS.filter((b) => !b.off);

const Chev = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;

// 7.11.2026 Banner imzası: kendi logomuz (ert mobile, isimli) marka satırının devamında, ince çizgiyle ayrılmış
// (bilgisayar 38, telefon 28 birim). Telefonda sağ alt köşe denendi, kullanıcı beğenmedi → telefon da PC gibi.
// Koyu zeminde logo beyaz %85 (kullanıcı: 'bırak aynı kalsın'). Telefonda yer ayarı shopHome.sigM: '' = marka satırında | 'corner' = sağ alt köşe (Tasarım › Banner).
// lgY (bannerlar.json): marka logosunu dikey kaydırma, logonun yüksekliğinin oranı (ör. Quick: yazılar logonun alt kısmında → yukarı) Kapatma: banner satırında sig: false (Tasarım › Banner ›
// banner › 'Banner imzası'), kod tarafında bannerlar.json "imza": false (mağazanın kendi bannerı gibi).
const SIG_LOGO = '/bn/ertel-logo.png';
const sigOn = (b) => b.sig !== false && b.imza !== false;

// telefon: sağ alt köşe imzası (shopHome.sigM === 'corner'), noktaların üstünde, yarı saydam hap içinde
function SigCorner({ b }) {
  return <span className="pb-sig pb-sig-c" style={{ position: 'absolute', right: 14, bottom: 34, zIndex: 2, display: 'inline-flex', alignItems: 'center', padding: '5px 9px 5px 6px', borderRadius: 999, background: b.dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.75)', pointerEvents: 'none' }}>
    <img className="pb-sig-i" src={SIG_LOGO} alt="ERTEL" style={{ height: 26, width: 'auto', display: 'block', opacity: b.dark ? 0.85 : 1, filter: b.dark ? 'brightness(0) invert(1)' : undefined }} />
  </span>;
}

// yazı bloğu (logo · başlık · slogan · açıklama · düğmeler)
function Txt({ b, m, hs = 64, act, center, w, br = 999 }) {
  const sigM = useStore((s) => s.settings?.shopHome?.sigM) || '';
  const ink = b.dark ? '#f5f5f7' : '#1d1d1f';
  const sub = b.dark ? '#a1a1a6' : b.subC || '#6e6e73';
  const eye = m ? b.eyeM || b.eye : b.eye;
  const title = m ? b.titleM || b.title : b.title;
  const s = m ? b.subM || b.sub : b.sub;
  const fs = m ? 15 : 16;
  // 13.11.2026 yazı animasyonu (shopHome.txtAnim; textanim.jsx): başlık → slogan → açıklama → düğmeler sırayla
  const ta = useStore((st) => st.settings?.shopHome?.txtAnim) || '';
  const by = ta === 'char' ? 'char' : 'word';
  const d1 = 0.15 + taLen(title, by) * taStep(by) + 0.05; const d2 = d1 + (b.tag ? taLen(b.tag) * taStep('word') + 0.05 : 0);
  const d3 = d2 + (s ? Math.min(taLen(s), 14) * 0.03 + 0.1 : 0);
  return (
    <div className={'pb-t' + (ta === 'off' ? '' : ' ta ta-' + (ta || 'blurInUp'))} style={{ '--d3': d3.toFixed(2) + 's', width: w, display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left', gap: m ? 8 : 12 }}>
      <span className="pb-eye" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: m ? 2 : 6, color: b.eyeC, font: `600 ${m ? 12.5 : 15}px/1.2 Inter, sans-serif` }}>
        <img src={b.logo} alt="" style={{ height: Math.round(b.lh * (m ? 0.7 : 1)), width: 'auto', display: 'block', filter: b.logoWhite ? 'brightness(0) invert(1)' : undefined, transform: b.lgY ? `translateY(${b.lgY * b.lh * (m ? 0.7 : 1)}px)` : undefined }} />
        {eye && <span style={{ paddingLeft: 12, borderLeft: '1px solid currentColor', opacity: 0.9 }}>{eye}</span>}
        {sigOn(b) && !(m && sigM === 'corner') && <span className="pb-sig" style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: m ? 10 : 12, borderLeft: `1px solid ${b.dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.16)'}` }}><img className="pb-sig-i" src={SIG_LOGO} alt="ERTEL" style={{ height: m ? 28 : 38, width: 'auto', display: 'block', opacity: b.dark ? 0.85 : 1, filter: b.dark ? 'brightness(0) invert(1)' : undefined }} /></span>}
      </span>
      <h2 style={{ margin: 0, font: `600 ${m ? (b.center ? 38 : 34) : hs}px/1.03 'Inter Tight', Inter, sans-serif`, letterSpacing: m ? '-.03em' : '-.035em', color: b.titleC || ink, whiteSpace: 'pre-line' }}>{ta === 'off' ? title : <TA text={title} by={by} d={0.15} />}</h2>
      {b.tag && <p style={{ margin: 0, font: `500 ${m ? 19 : b.center ? 26 : 28}px/1.2 Inter, sans-serif`, letterSpacing: '-.015em', color: ink }}>{ta === 'off' ? b.tag : <TA text={b.tag} d={d1} />}</p>}
      {s && <p style={{ margin: 0, font: `400 ${m ? 15 : 20}px/1.4 Inter, sans-serif`, color: sub, maxWidth: m ? '100%' : 440 }}>{ta === 'off' ? s : <TA text={s} d={d2} by="word" />}</p>}
      <div className="ta-btns" style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 8 }}>
        <button type="button" className="pb-b1 ta-bt" onClick={act(b.a1[1])} style={{ height: m ? 42 : 48, padding: '0 24px', borderRadius: br, background: b.btn, color: '#fff', font: `500 ${fs}px/1 Inter, sans-serif`, border: 0, cursor: 'pointer' }}>{b.a1[0]}</button>
        <button type="button" className="pb-b2 ta-bt" onClick={act(b.a2[1])} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, color: b.lnk, font: `500 ${fs}px/1 Inter, sans-serif`, cursor: 'pointer' }}>{(m && b.a2M) || b.a2[0]} <Chev /></button>
      </div>
    </div>
  );
}

const abs = (o) => ({ position: 'absolute', ...o });
const vmid = { top: 0, bottom: 0, display: 'flex', alignItems: 'center' };

// geniş kutu yerleşimi (W ≥ 1000, H ≥ 560 tuval birimi)
function Wide({ b, W, H, act, br }) {
  const T = (p) => <Txt b={b} act={act} br={br} {...p} />;
  if (b.lay) return <WideGen b={b} W={W} H={H} T={T} />;
  if (b.id === 'quick861') {
    const iw = Math.min((H + 80) * 1.4, W - 380), ih = iw / 1.4;
    return <>
      <img className="pb-im" src={IMG('q861-pc.webp')} alt="Quick 861 Pro Max" style={abs({ right: -40, top: (H - ih) / 2, width: iw, height: ih })} />
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
        <img className="pb-im" src={IMG('zm-left.webp')} alt="" style={{ '--pi': 1, height: h1, width: 'auto' }} />
        <img className="pb-im" src={IMG('zm-front.webp')} alt="AmScope ZM6745T" style={{ height: h2, width: 'auto' }} />
        <img className="pb-im" src={IMG('zm-right.webp')} alt="" style={{ '--pi': 2, height: h1, width: 'auto' }} />
      </div>
    </>;
  }
  if (b.id === 'hands') {
    const iw = Math.min(760, W * 0.52); const tw = W - iw - 88 - 40;
    return <>
      <img className="pb-im pb-ph" src={IMG('hands.webp')} alt="Mikroskop kafasını ayarlayan eller" style={abs({ right: 0, top: 0, width: iw, height: H, objectFit: 'cover', objectPosition: '50% 30%' })} />
      <div style={abs({ left: 88, ...vmid })}>{T({ w: Math.min(520, tw), hs: tw < 420 ? 56 : 64 })}</div>
    </>;
  }
  if (b.id === 'ht316') {
    const iw = Math.min(640, W * 0.46), il = W * 0.05; const tl = Math.max(il + iw + 60, W * 0.56); const tw = Math.min(520, W - tl - 50);
    const bot = 70 + (H - 560) * 0.4;
    return <>
      <div className="pb-shd" style={abs({ left: il + 20, bottom: bot - 10, width: iw * 0.94, height: 30, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.18), rgba(0,0,0,0))' })} />
      <img className="pb-im" src={IMG('ht316.webp')} alt="Aixun HT316" style={abs({ left: il, bottom: bot, width: iw, height: 'auto' })} />
      <div style={abs({ left: tl, ...vmid })}>{T({ w: tw, hs: tw < 440 ? 56 : 64 })}</div>
    </>;
  }
  if (b.id === 'mech-pp2') {
    // bilgisayarda kablolu ürün kesimi (elli fotoğrafta kol havada bitiyordu); telefonda elli fotoğraf kenardan girer
    const ih = Math.min(500, H * 0.86), iw = ih * 0.761; const ir = Math.max(60, W * 0.14 - 20); const tw = W - iw - ir - 88 - 40;
    return <>
      <div className="pb-shd" style={abs({ right: ir - 20, bottom: 30, width: iw + 40, height: 40, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.16), rgba(0,0,0,0))' })} />
      <img className="pb-im" src={IMG('mech-prod.webp')} alt="Mechanic Power Pro Max 2.0" style={abs({ right: ir, bottom: 44, width: iw, height: ih })} />
      <div style={abs({ left: 88, ...vmid })}>{T({ w: Math.min(520, tw), hs: tw < 420 ? 56 : 64 })}</div>
    </>;
  }
  if (b.id === 'sm4ntp') {
    const iw = Math.min(720, W * 0.5), ih = iw * 0.765; const ir = Math.min(90, W * 0.05); const tw = Math.min(520, W - ir - iw - 88 - 20);
    return <>
      <div className="pb-shd" style={abs({ right: ir + iw * 0.06, bottom: 40, width: iw * 0.84, height: 44, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.2), rgba(0,0,0,0))' })} />
      <img className="pb-im" src={IMG('sm4.webp')} alt="AmScope SM-4NTP" style={abs({ right: ir, bottom: 56, width: iw, height: ih })} />
      <div style={abs({ left: 88, ...vmid })}>{T({ w: tw, hs: tw < 440 ? 56 : 64 })}</div>
    </>;
  }
  // da07
  const ih = Math.min(460, H * 0.82), iw = ih * 0.885; const ir = Math.min(170, W * 0.1); const tw = Math.min(520, W - ir - iw - 88 - 30);
  return <>
    <div className="pb-shd" style={abs({ right: ir - 16, bottom: 36, width: iw + 32, height: 40, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(10,60,40,.22), rgba(0,0,0,0))' })} />
    <img className="pb-im" src={IMG('da07.webp')} alt="2UUL DA07" style={abs({ right: ir, bottom: 52, height: ih, width: 'auto' })} />
    <div style={abs({ left: 88, ...vmid })}>{T({ w: tw, hs: tw < 440 ? 56 : 64 })}</div>
  </>;
}

// 7.11.2026 (9) genel yerleşimler (yeni bannerlar)
const Shadow = ({ l, r, bot, w }) => <div className="pb-shd" style={abs({ left: l, right: r, bottom: bot, width: w, height: 40, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.17), rgba(0,0,0,0))' })} />;
function WideGen({ b, W, H, T }) {
  if (b.lay === 'photo') {
    const iw = Math.min(760, W * 0.52); const tw = W - iw - 88 - 40;
    return <>
      <img className="pb-im pb-ph" src={IMG(b.img)} alt={b.name} style={abs({ right: 0, top: 0, width: iw, height: H, objectFit: 'cover', objectPosition: b.pos || '50% 50%' })} />
      <div style={abs({ left: 88, ...vmid })}>{T({ w: Math.min(520, tw), hs: tw < 420 ? 56 : 64 })}</div>
    </>;
  }
  if (b.lay === 'center') {
    const tt = 46 + (H - 560) * 0.25; const ih = Math.max(200, H - tt - 270); let iw = ih * b.ar; if (iw > W * 0.6) iw = W * 0.6;
    return <>
      <div style={abs({ left: 0, right: 0, top: tt, display: 'flex', justifyContent: 'center' })}>{T({ center: true, hs: 60 })}</div>
      <Shadow l={(W - iw * 0.9) / 2} bot={18} w={iw * 0.9} />
      <img className="pb-im" src={IMG(b.img)} alt={b.name} style={abs({ left: (W - iw) / 2, bottom: 30, width: iw, height: iw / b.ar })} />
    </>;
  }
  let ih = Math.min(470, H * (b.lay === 'left' ? 0.7 : 0.82)), iw = ih * b.ar; if (iw > W * 0.44) { iw = W * 0.44; ih = iw / b.ar; }
  const bot = Math.max(40, (H - ih) / 2 - 10);
  if (b.lay === 'left') {
    const il = Math.max(60, W * 0.07); const tl = Math.max(il + iw + 70, W * 0.52); const tw = Math.min(520, W - tl - 50);
    return <>
      <Shadow l={il + iw * 0.05} bot={bot - 16} w={iw * 0.9} />
      <img className="pb-im" src={IMG(b.img)} alt={b.name} style={abs({ left: il, bottom: bot, width: iw, height: ih })} />
      <div style={abs({ left: tl, ...vmid })}>{T({ w: tw, hs: tw < 440 ? 56 : 64 })}</div>
    </>;
  }
  const ir = Math.max(70, W * 0.09); const tw = Math.min(520, W - ir - iw - 88 - 30);
  return <>
    <Shadow r={ir + iw * 0.05} bot={bot - 16} w={iw * 0.9} />
    <img className="pb-im" src={IMG(b.img)} alt={b.name} style={abs({ right: ir, bottom: bot, width: iw, height: ih })} />
    <div style={abs({ left: 88, ...vmid })}>{T({ w: tw, hs: tw < 440 ? 56 : 64 })}</div>
  </>;
}
function PhoneGen({ b, H, top }) {
  const free = H - 225;
  if (b.lay === 'photo') { const h = Math.min(300, free - 10); return <><img className="pb-im pb-ph" src={IMG(b.img)} alt={b.name} style={abs({ left: 0, right: 0, bottom: 0, width: 358, height: h, objectFit: 'cover', objectPosition: b.posM || b.pos || '50% 50%' })} />{top}</>; }
  let h = Math.max(120, Math.min(300, free - 30)), w = h * b.ar; if (w > 310) { w = 310; h = w / b.ar; }
  return <>{top}<Shadow l={(358 - w * 0.9) / 2} bot={14} w={w * 0.9} /><img className="pb-im" src={IMG(b.img)} alt={b.name} style={abs({ left: (358 - w) / 2, bottom: 26, width: w, height: h })} /></>;
}

// telefon yerleşimi (W = 358 tuval birimi; H kutuya göre ~450–600)
function Phone({ b, H, act, br }) {
  const top = <div style={abs({ left: 0, right: 0, top: 30, padding: '0 24px', display: 'flex', justifyContent: 'center' })}><Txt b={b} m center act={act} br={br} w="100%" /></div>;
  if (b.lay) return <PhoneGen b={b} H={H} top={top} />;
  const free = H - 225; // yazı bloğunun altında kalan yükseklik
  // 7.11.2026 (4): resim kutunun altından TAŞMAZ (eskiden eksi 'bottom' ile taşıyordu → iPhone'da yuvarlak köşeli kırpma kayarken titriyordu);
  // alttaki parça object-fit ile resmin kendisinden kırpılır, görünüm aynı.
  if (b.id === 'quick861') { const s = Math.min(358, free + 64); const v = s * (1 - 64 / 358); return <><img className="pb-im" src={IMG('q861-m.webp')} alt="Quick 861 Pro Max" style={abs({ left: (358 - s) / 2, bottom: 0, width: s, height: v, objectFit: 'cover', objectPosition: '50% 0' })} />{top}</>; }
  if (b.id === 'zm6745') { const h = Math.min(340, free + 70); const w = h * 760 / 1300; const v = h * (1 - 70 / 340); return <>{top}<img className="pb-im" src={IMG('zm-front.webp')} alt="AmScope ZM6745T" style={abs({ left: (358 - w) / 2, bottom: 0, height: v, width: w, objectFit: 'cover', objectPosition: '50% 0' })} /></>; }
  if (b.id === 'hands') { const h = Math.min(300, free - 10); return <><img className="pb-im pb-ph" src={IMG('hands.webp')} alt="Mikroskop kafasını ayarlayan eller" style={abs({ left: 0, right: 0, bottom: 0, width: 358, height: h, objectFit: 'cover', objectPosition: '50% 35%' })} />{top}</>; }
  if (b.id === 'ht316') { const w = Math.min(330, (free - 34) * 1.425); return <>{top}<img className="pb-im" src={IMG('ht316.webp')} alt="Aixun HT316" style={abs({ left: (358 - w) / 2, bottom: 34, width: w, height: 'auto' })} /></>; }
  if (b.id === 'mech-pp2') { const h = Math.min(300, free - 10); return <><img className="pb-im pb-ph" src={IMG('mech-hand.webp')} alt="Mechanic Power Pro Max 2.0" style={abs({ left: 0, right: 0, bottom: 0, width: 358, height: h, objectFit: 'cover', objectPosition: '62% 26%' })} />{top}</>; }
  if (b.id === 'sm4ntp') { const w = Math.min(330, (free - 30) / 0.765); return <>{top}<img className="pb-im" src={IMG('sm4.webp')} alt="AmScope SM-4NTP" style={abs({ left: (358 - w) / 2, bottom: 30, width: w, height: w * 0.765 })} /></>; }
  const h = Math.min(260, free - 22);
  return <>{top}<img className="pb-im" src={IMG('da07.webp')} alt="2UUL DA07" style={abs({ left: '50%', bottom: 22, height: h, width: 'auto', transform: 'translateX(-50%)' })} /></>;
}

// Kutuyu tamamen dolduran banner (konumlu bir ebeveynin içine konur)
export function PhotoBanner({ b, open, onProduct, edit }) {
  const ref = useRef(null); const [sz, setSz] = useState(null);
  const win = useWin();
  // köşeler: Stil Stüdyosu'nda büyük reklam köşesi (look.style.rHero) küçültülünce düğmeler de aynı oranda sivrileşir (Apple yuvarlağı = hap)
  const rh = useStore((s) => s.settings?.look?.style?.rHero);
  // 7.11.2026 (7) kendi ayarı: shopHome.chipR (boş = eski davranış, banner köşesine bağlı)
  const cr = useStore((s) => s.settings?.shopHome?.chipR);
  const sigM = useStore((s) => s.settings?.shopHome?.sigM) || '';
  // 14.11.2026 ürün resmi animasyonu (shopHome.imgAnim; IMG_ANIM): '' yükselerek (ilk hâl) | strong | blur | side | zoom | off
  const ia = useStore((s) => s.settings?.shopHome?.imgAnim) || '';
  const br = cr != null && cr !== '' ? Number(cr) : rh == null || rh === '' || Number(rh) >= 16 ? 999 : Math.round(Number(rh) * 0.5);
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
    // tam ekran gibi çok yüksek kutuda yazılar devleşmesin: büyütme en çok 1.3 (tuval o kadar uzar)
    else { s = Math.min(sz.h / 560, 1.3); W = sz.w / s; H = sz.h / s; if (W < 1000) { s = sz.w / 1000; W = 1000; H = sz.h / s; } }
    cv = <div className="pb-cv" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${s})`, transformOrigin: '0 0', fontFamily: 'Inter, sans-serif' }}>
      {phone ? <Phone b={b} H={H} act={act} br={br} /> : <Wide b={b} W={W} H={H} act={act} br={br} />}
      {phone && sigM === 'corner' && sigOn(b) && <SigCorner b={b} />}
    </div>;
    if (phone && b.bgM) bg = b.bgM; else if (!phone && b.bgW) bg = b.bgW;
  }
  return <div ref={ref} className={'pb-box' + (b.dark ? ' pb-dark' : ' pb-light') + (ia ? ' pia-' + ia : '')} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bg }}>{cv}</div>;
}

// ---- 7.11.2026 (2): fotoğraflı bannerlar artık kullanıcının reklam listesinde (shopHome.slides) normal satır: { pb: '<şablon id>', … }
// Şablonun fotoğrafı/yerleşimi koddan gelir; yazıları satırdan değiştirilebilir (title · tag = slogan · sub · eye · c1/c2 = düğme yazıları).
// s.off = reklam gizli (silinmez). Listede hiç pb satırı yoksa eski davranış: photoBn açıksa 5+2 banner baştan eklenir.
export const PB_BY = Object.fromEntries(PHOTO_BANNERS.map((b) => [b.id, b]));
export const PB_TEXT = [['eye', 'Üst yazı (logonun yanı)'], ['title', 'Başlık'], ['tag', 'Slogan'], ['sub', 'Açıklama'], ['c1', 'Düğme'], ['c2', 'İkinci bağlantı']];
export function pbOf(s) {
  const T = typeof s?.pb === 'string' ? PB_BY[s.pb] : s?.pb; if (!T) return null;
  const o = { ...T };
  const has = (k) => s[k] != null && s[k] !== '';
  if (has('title')) { o.title = s.title; o.titleM = s.title.replace(/\n/g, ' '); }
  if (has('tag')) o.tag = s.tag;
  if (has('sub')) { o.sub = s.sub; o.subM = s.sub; }
  if (has('eye')) { o.eye = s.eye; o.eyeM = s.eye; }
  if (has('c1')) o.a1 = [s.c1, T.a1[1]];
  if (has('c2')) { o.a2 = [s.c2, T.a2[1]]; o.a2M = null; }
  if (s.sig === false) o.sig = false;
  return o;
}
// mağazada gösterilecek reklamlar (pb satırları çözülmüş, gizliler çıkarılmış)
// 7.11.2026: eskiden sabit NEW2 listesiydi; artık bannerlar.json'da "oto": true olanlar (yeni banner = oto + istenirse bas)
export function withNew2(sl) {
  const miss = PHOTO_BANNERS.filter((b) => b.oto && !sl.some((s) => s?.pb === b.id));
  if (!miss.length) return sl;
  const front = miss.filter((b) => b.bas).map((b) => ({ pb: b.id }));
  const back = miss.filter((b) => !b.bas).map((b) => ({ pb: b.id }));
  let k = -1; sl.forEach((s, i) => { if (s?.pb) k = i; });
  return [...front, ...sl.slice(0, k + 1), ...back, ...sl.slice(k + 1)];
}
export function heroList(H, edit) {
  const sl = H?.slides || [];
  const has = sl.some((s) => s?.pb);
  const pre = !has && photoBnOn(H) && !edit ? PHOTO_BANNERS.map((b) => ({ pb: b })) : [];
  // 7.11.2026 (9) ikinci tur bannerlar listede yoksa kendiliğinden eklenir (son fotoğraflı bannerın arkasına). Kapatmak için
  // Tasarım › Banner'da anahtarı kapat (satır 'off' olur, silinmez → geri gelmez).
  const all = has ? withNew2(sl) : sl;
  const own = all.filter((s) => s && (edit || !s.off)).map((s) => (s.pb ? (pbOf(s) ? { ...s, pb: pbOf(s) } : null) : s)).filter(Boolean);
  return [...pre, ...own];
}
// 'Claude düzeni' paketine geçerken: bannerlar listenin başına, kullanıcının eski reklamları gizli (silinmez)
export function withPbSlides(slides) {
  const sl = slides || [];
  if (sl.some((s) => s?.pb)) return sl;
  return [...PHOTO_BANNERS.map((b) => ({ pb: b.id })), ...sl.map((s) => (s.off ? s : { ...s, off: true, offBy: 'cd' }))];
}
