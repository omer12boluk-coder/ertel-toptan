// 14.11.2026 Banner çerçeveleri + sayfa seçicileri (kullanıcı sunumdan "hepsini ekle, seçilebilir ve kapatılabilir" dedi;
// sunum: https://claude.ai/artifact/CdCdmKFcwgDrX5RgasXKsc). Bannerın İÇİ (photobn.jsx / Slide) değişmez; sadece etrafı.
// Ayarlar (Tasarım v3 › Banner):
//   shopHome.heroFrame  '' bugünkü | 'story' hikâye çizgileri | 'rail' ürün rafı | 'deck' kart destesi | 'glow' ortam ışığı | 'side' yanında sıradakiler (telefonda bugünkü)
//   shopHome.heroPager  '' bugünkü noktalar | 'seg' | 'smart' | 'ring' | 'thumbs' | 'names' | 'off' (bugünkü ve ortam ışığı çerçevesinde geçerli)
// Süre çubukları CSS animasyonu (.hx-f, 6.5 sn = Hero'nun otomatik geçiş süresi); duraklayınca (.hx-pz) animasyon da durur.
import { useEffect, useState } from 'react';
import { ShopImg } from './shophome.jsx';

export const HERO_FRAMES = [['', 'Bugünkü'], ['story', 'Hikâye çizgileri'], ['rail', 'Ürün rafı'], ['deck', 'Kart destesi'], ['glow', 'Ortam ışığı'], ['side', 'Yanında sıradakiler']];
export const HERO_PAGERS = [['', 'Bugünkü'], ['seg', 'Çizgiler'], ['smart', 'Akıllı noktalar'], ['ring', 'Sayaç + halka'], ['thumbs', 'Ürün resimleri'], ['names', 'Marka adları'], ['off', 'Kapalı']];
export const HERO_STICK = [['', 'Yapışık'], ['off', 'Boşluklu (eski)']];

// eski fotoğraflı bannerların (bannerlar.json'da "img" alanı olmayan) küçük resmi
const PB_IMG = { quick861: 'q861-pc.webp', zm6745: 'zm-front.webp', hands: 'hands.webp', ht316: 'ht316.webp', da07: 'da07.webp', 'mech-pp2': 'mech-prod.webp', sm4ntp: 'sm4.webp' };
const LIGHT_TH = ['ice', 'sand', 'mint'];
// banner için ad / marka / küçük resim
export function slideMeta(s) {
  if (s?.pb) {
    const b = s.pb; const nm = String(b.name || ''); let brand = nm, name = '';
    if (nm.includes(' — ')) [brand, name] = nm.split(' — '); else { const j = nm.indexOf(' '); if (j > 0) { brand = nm.slice(0, j); name = nm.slice(j + 1); } }
    const f = b.img || PB_IMG[b.id];
    return { brand, name, img: f ? '/bn/' + f : null, dark: !!b.dark, photo: b.lay === 'photo' || b.id === 'hands' };
  }
  return { brand: s?.tag || '', name: String(s?.title || '').replace(/\n/g, ' '), v: s?.img || null, dark: !LIGHT_TH.includes(s?.theme) };
}
export const metaLabel = (m) => [m.brand, m.name].filter(Boolean).join(' ') || 'Banner';
export function SlideThumb({ m, className = '' }) {
  if (m.img) return <img className={className + (m.photo ? ' ph' : '')} src={m.img} alt="" loading="lazy" decoding="async" draggable="false" />;
  if (m.v) return <ShopImg v={m.v} className={className} />;
  return <span className={className + ' hx-noimg'} aria-hidden="true" />;
}
export function useMQ(q) {
  const get = () => typeof matchMedia !== 'undefined' && matchMedia(q).matches;
  const [v, setV] = useState(get);
  useEffect(() => { if (typeof matchMedia === 'undefined') return; const m = matchMedia(q); const f = () => setV(m.matches); f(); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f); }, [q]);
  return v;
}

const pad = (x) => String(x).padStart(2, '0');
export const IcPrev = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>;
export const IcNext = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
const IcPause = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>;
const IcPlay = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 7 5.5Z" /></svg>;
export const HoldBtn = ({ hold, toggle, className = 'hx-btn' }) => <button type="button" className={className} onClick={toggle} aria-label={hold ? 'Oynat' : 'Duraklat'} title={hold ? 'Oynat' : 'Duraklat'}>{hold ? <IcPlay /> : <IcPause />}</button>;
// süre dolgusu: key = oynayan banner → her geçişte baştan
const Fill = ({ i }) => <i key={'f' + i} className="hx-f" />;

// ---- Sayfa seçici
export function HeroPager({ kind, metas, i, goTo, hold, toggle }) {
  const n = metas.length; if (n < 2 || !kind || kind === 'off') return null;
  const go = (k) => () => goTo(((k % n) + n) % n);
  if (kind === 'seg') return <div className="hx-seg">{metas.map((m, k) => <button key={k} type="button" aria-label={metaLabel(m)} onClick={go(k)}><span>{k === i ? <Fill i={i} /> : <i className={k < i ? 'hx-done' : ''} />}</span></button>)}</div>;
  if (kind === 'smart') {
    const c = Math.max(3, Math.min(n - 4, i));
    return <div className="hx-smart">{metas.map((m, k) => {
      const d = Math.abs(k - c); const inw = n <= 7 || d <= 3; const edge = n > 7 && d === 3 && k !== 0 && k !== n - 1;
      return <button key={k} type="button" aria-label={metaLabel(m)} tabIndex={inw ? 0 : -1} className={(k === i ? 'on' : '') + (inw ? '' : ' out') + (edge ? ' edge' : '')} onClick={go(k)}><span>{k === i && <Fill i={i} />}</span></button>;
    })}</div>;
  }
  if (kind === 'ring') return <div className="hx-ring">
    <button type="button" className="hx-btn" onClick={go(i - 1)} aria-label="Önceki"><IcPrev /></button>
    <button type="button" className="hx-ring-b" onClick={toggle} aria-label={hold ? 'Oynat' : 'Duraklat'}>
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" className="bg" /><circle key={'r' + i} cx="22" cy="22" r="19" className="hx-rc" /></svg>
      {hold ? <IcPlay /> : <IcPause />}
    </button>
    <span className="hx-num num">{pad(i + 1)} <small>/ {n}</small></span>
    <button type="button" className="hx-btn" onClick={go(i + 1)} aria-label="Sonraki"><IcNext /></button>
  </div>;
  if (kind === 'thumbs') {
    const w = Math.min(7, n); const h = Math.floor(w / 2);
    const ks = Array.from({ length: w }, (_, j) => ((i - h + j) % n + n) % n);
    return <div className="hx-thumbs">{ks.map((k, j) => <button key={k} type="button" aria-label={metaLabel(metas[k])} className={(k === i ? 'on' : '') + (Math.abs(j - h) === h && w === 7 ? ' far' : '')} onClick={go(k)}><SlideThumb m={metas[k]} className="hx-ti" /></button>)}</div>;
  }
  if (kind === 'names') {
    const p = metas[(i - 1 + n) % n], c = metas[i], x = metas[(i + 1) % n];
    return <div className="hx-names">
      <button type="button" className="hx-nm-s" onClick={go(i - 1)}>{p.brand || 'Önceki'}</button>
      <span className="hx-nm-c"><b>{c.brand} <span>{c.name}</span></b><span className="hx-line"><Fill i={i} /></span></span>
      <button type="button" className="hx-nm-s" onClick={go(i + 1)}>{x.brand || 'Sonraki'}</button>
    </div>;
  }
  return null;
}

// ---- Çerçevelerin bannerın altına / yanına gelen parçaları
export function StoryBar({ metas, i, goTo, hold, toggle, phone }) {
  const n = metas.length; const m = metas[i] || {};
  return <div className="hx-story-b">
    <div className="hx-info">
      <span className="hx-who"><span className="hx-num num">{pad(i + 1)} <small>/ {n}</small></span><i className="hx-sep" aria-hidden="true" /><b>{m.brand}</b> <span>{m.name}</span></span>
      <span className="hx-ctl">{!phone && <button type="button" className="hx-btn" onClick={() => goTo((i - 1 + n) % n)} aria-label="Önceki"><IcPrev /></button>}<HoldBtn hold={hold} toggle={toggle} />{!phone && <button type="button" className="hx-btn" onClick={() => goTo((i + 1) % n)} aria-label="Sonraki"><IcNext /></button>}</span>
    </div>
    {!phone && <HeroPager kind="seg" metas={metas} i={i} goTo={goTo} />}
  </div>;
}
export function RailBar({ metas, i, goTo, phone, vis }) {
  const [el, setEl] = useState(null);
  useEffect(() => { // telefonda oynayan resim ortaya kayar
    if (!el || !vis) return; const c = el.children[i]; if (!c || el.scrollWidth <= el.clientWidth + 2) return;
    el.scrollTo({ left: Math.max(0, c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2), behavior: 'smooth' });
  }, [el, i, vis]);
  return <div ref={setEl} className={'hx-railbar' + (phone ? ' m' : '')}>{metas.map((m, k) => <button key={k} type="button" className={k === i ? 'on' : ''} aria-label={metaLabel(m)} aria-current={k === i ? 'true' : undefined} onClick={() => goTo(k)}>
    <span className="hx-rt"><SlideThumb m={m} className="hx-ti" /></span>
    {!phone && <small>{m.brand}</small>}
    <b>{phone ? m.brand : m.name || m.brand}</b>
    {!phone && <span className="hx-line">{k === i && <Fill i={i} />}</span>}
  </button>)}</div>;
}
export function DeckBar({ metas, i, goTo }) {
  const n = metas.length; const m = metas[i] || {};
  return <div className="hx-deck-b">
    <span className="hx-who"><span className="hx-big num">{pad(i + 1)}<small> / {n}</small></span><span className="hx-dn"><small>{m.brand}</small><b>{m.name || m.brand}</b></span></span>
    <span className="hx-ctl"><span className="hx-line w"><Fill i={i} /></span>
      <button type="button" className="hx-btn dk" onClick={() => goTo((i - 1 + n) % n)} aria-label="Önceki"><IcPrev /></button>
      <button type="button" className="hx-btn dk" onClick={() => goTo((i + 1) % n)} aria-label="Sonraki"><IcNext /></button></span>
  </div>;
}
export function SideList({ metas, i, goTo, hold, toggle }) {
  const n = metas.length; const ks = Array.from({ length: Math.min(4, n) }, (_, o) => (i + o) % n);
  return <aside className="hx-side-l" aria-label="Vitrindeki bannerlar">
    <div className="hx-side-h"><b>Vitrinde</b><span><span className="num">{pad(i + 1)} / {n}</span><HoldBtn hold={hold} toggle={toggle} /></span></div>
    {ks.map((k, o) => <button key={k} type="button" className={o === 0 ? 'on' : ''} onClick={() => goTo(k)}>
      <span className="hx-st"><SlideThumb m={metas[k]} className="hx-ti" /></span>
      <span className="hx-sn"><small>{o === 0 ? 'ŞİMDİ' : o === 1 ? 'SIRADAKİ' : 'SONRA'}</small><b>{metas[k].brand} <span>{metas[k].name}</span></b></span>
      {o === 0 && <span className="hx-line"><Fill i={i} /></span>}
    </button>)}
  </aside>;
}
export function GlowBg({ metas, i }) {
  return <div className="hx-glow-bg" aria-hidden="true">{metas.map((m, k) => <SlideThumb key={k} m={m} className={'hx-gi' + (k === i ? ' on' : '')} />)}</div>;
}
