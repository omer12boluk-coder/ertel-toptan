// İki bölmeli giriş / üye ol sayfası (16.11.2026, kayit-demo dalı — DEMO)
// 21st.dev "auth-ui" bileşeninden uyarlandı: Tailwind / shadcn / TypeScript yok, sitenin kendi CSS'i (.as-*) ve
// kendi AuthForm'u (gerçek giriş/üyelik mantığı aynen) kullanılır. Sağ bölmede ürün görseli + yazılan söz.
// Ayar: look.authUi 'split' = yeni | '' eski tek kutu. Önizleme hostunda (--) hep yeni.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './store.js';

const PV_HOST = typeof location !== 'undefined' && /--/.test(location.hostname);
export const authSplitOn = (S) => PV_HOST || (S?.orders?.authUi || 'split') === 'split';
export const AUTH_TXT = { login: 'Tekrar hoş geldiniz. Tezgâhınız sizi bekliyor.', signup: 'Usta işi tamir, doğru ekipmanla başlar.' };

// Daktilo yazısı (preetsuthar17/typewriter-text uyarlaması; hareket azaltma açıksa yazı direkt görünür)
export function Typewriter({ text, speed = 55, cursor = '|', className }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) return;
    setN(0);
    let i = 0;
    const t = setInterval(() => { i++; setN(i); if (i >= text.length) clearInterval(t); }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="as-cursor" aria-hidden="true">{cursor}</span>}
    </span>
  );
}

// Sağ bölme: koyu "sahne" (banner tarzı). Görseller koyu zeminde temiz kesimli banner resimleri.
// sahne = tek büyük ürün, kenardan taşar, arkada mavi ışık hüzmeleri + toz | kolaj = üç ürün derinlikli
// 17.11.2026: başka sayfadan bu sayfaya geçerken ilk kareler ağırdı (büyük resimlerin çözülmesi) → site boşta iken
// halka + e resimleri önceden çözülür; sayfa açılırken hazır olur
if (typeof window !== 'undefined') {
  const warm = () => ['/bn/ert-ring.webp', '/bn/ert-e.webp'].forEach((u) => { const i = new Image(); i.decoding = 'async'; i.src = u; i.decode?.().catch(() => {}); (window.__asImgs ||= []).push(i); });
  const later = () => (window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2500));
  if (document.readyState === 'complete') setTimeout(later, 1500); else addEventListener('load', () => setTimeout(later, 1500), { once: true });
}
// 17.11.2026 (sunum): sağ bölme efekti — ring (dönen halka, bugünkü) | devre (devre izlerinden logoya akan akım)
// | mikro (mikroskop vizörü, odak) | osilo (osiloskop sinyali). Önizlemede ls 'as-fx', sonra ayar orders.authFx.
const FX = ['ring', 'devre', 'mikro', 'osilo'];
const asFx = (S) => { let x = S?.orders?.authFx; if (PV_HOST || !x) { try { x = localStorage.getItem('as-fx') || x; } catch {} } return FX.includes(x) ? x : 'ring'; };
// logo merkezi (300, 320), viewBox 600×760 — sağ bölmenin oranı
const TRACES = ['M0 180H90L159 249V269', 'M0 440H100L159 381V371', 'M150 0V110L225 185V190', 'M470 0V100L375 195', 'M600 200H500L441 259V269',
  'M600 470H510L441 401V371', 'M480 760V555L375 450', 'M110 760V560L225 445'];
const ENDS = [[159, 269], [159, 371], [225, 190], [375, 195], [441, 269], [441, 371], [375, 450], [225, 445]];
const DECO = ['M40 300H70L95 325H120', 'M40 560H80L105 585', 'M560 330H530L505 355', 'M560 620H520L495 645', 'M260 0V40L285 65', 'M330 760V700L355 675'];
function Circuit() {
  return <svg className="as-fxsvg as-circ" viewBox="0 0 600 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {DECO.map((d, i) => <path key={'d' + i} d={d} className="cd" />)}
    {TRACES.map((d, i) => <path key={'b' + i} d={d} className="cb" />)}
    {TRACES.map((d, i) => <path key={'g' + i} d={d} pathLength="100" className="cg" style={{ animationDelay: (i * 0.37).toFixed(2) + 's' }} />)}
    {TRACES.map((d, i) => <path key={'p' + i} d={d} pathLength="100" className="cp" style={{ animationDelay: (i * 0.37).toFixed(2) + 's' }} />)}
    {ENDS.map(([x, y], i) => <circle key={'e' + i} cx={x} cy={y} r="4.5" className="ce" style={{ animationDelay: (i * 0.37).toFixed(2) + 's' }} />)}
  </svg>;
}
function Reticle() {
  const ticks = []; for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2, L = i % 10 === 0 ? 16 : i % 5 === 0 ? 10 : 5, r = 214;
    ticks.push(<line key={i} x1={300 + Math.cos(a) * r} y1={320 + Math.sin(a) * r} x2={300 + Math.cos(a) * (r - L)} y2={320 + Math.sin(a) * (r - L)} />); }
  return <>
    <span className="as-lens" />
    <svg className="as-fxsvg as-ret" viewBox="0 0 600 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <circle cx="300" cy="320" r="232" className="rr" />
      <g className="rt">{ticks}</g>
      <g className="ra"><path d="M300 92 A228 228 0 0 1 528 320" /><path d="M300 548 A228 228 0 0 1 72 320" /></g>
      <path d="M300 60V120M300 520V580M40 320H100M500 320H560" className="rx" />
      <text x="300" y="604" className="rl">20×</text>
    </svg>
  </>;
}
// sinyal: düz çizgi + logonun iki yanında kalp atışı gibi dalgalar
const SIG = 'M-20 560H90L104 548L116 560H150L162 600L178 470L194 590L206 560H260L272 552L284 560H330L342 600L358 470L374 590L386 560H440L452 548L464 560H500L512 600L528 470L544 590L556 560H620';
function Scope() {
  return <>
    <span className="as-grid" />
    <svg className="as-fxsvg as-scope" viewBox="0 0 600 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g transform="translate(0 -30)"><path d={SIG} className="sb" />
      <path d={SIG} pathLength="100" className="sg" />
      <path d={SIG} pathLength="100" className="sp" /></g>
    </svg>
  </>;
}
// 17.11.2026: yazı daktilo gibi yazılmasın → kelimeler sırayla bulanıktan netleşerek belirir
function Words({ text }) {
  return String(text).split(/(\s+)/).map((w, i) => /^\s+$/.test(w) ? ' ' : w && <span key={i} className="as-w" style={{ '--d': (0.25 + 0.07 * (i / 2)).toFixed(2) + 's' }}>{w}</span>);
}
const asTry = (S) => { const def = S?.orders?.authSide === 'amblem' ? 'amblem' : 'dev'; if (!PV_HOST) return def; try { return localStorage.getItem('as-try') || def; } catch { return def; } };
// 16.11: düzeltilmiş amblem (halka gerçek daire, e kenarı pürüzsüz); 17.11: halka (bn/ert-ring) ve e (bn/ert-e) ayrı katman — halka döner, e süzülür

// view: AuthForm'un o anki görünümü (login | signup | reset | bayi …)
export function AuthSplit({ view, children }) {
  const k = view === 'signup' ? 'signup' : 'login';
  const S = useStore((st) => st.settings);
  const q = (k === 'signup' ? S?.orders?.authSignup : S?.orders?.authLogin)?.trim() || AUTH_TXT[k];
  const [v, setV] = useState(() => asTry(S));
  const [fx, setFx] = useState(() => asFx(S));
  const pickFx = (x) => { try { localStorage.setItem('as-fx', x); } catch {} setFx(x); };
  const pick = (x) => { try { localStorage.setItem('as-try', x); } catch {} setV(x); };
  // tam sayfa: bölme üst menünün altından ekranın dibine kadar; üst konum ölçülür, sadece genişlik değişince yeniden
  // (Safari adres çubuğu açılıp kapanınca yükseklik oynamasın)
  const wrapRef = useRef(null);
  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    let lastW = 0;
    // 17.11.2026: alttaki boşluk = üst menü ile kart arasındaki boşluk (--as-gb)
    const fit = () => {
      if (innerWidth === lastW) return; lastW = innerWidth;
      const top = el.getBoundingClientRect().top;
      const hb = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0;
      el.style.setProperty('--as-top', Math.max(0, Math.round(top + scrollY)) + 'px');
      el.style.setProperty('--as-gb', Math.round(Math.min(40, Math.max(10, top - hb))) + 'px');
    };
    fit(); const t = setTimeout(() => { lastW = 0; fit(); }, 600);
    addEventListener('resize', fit);
    return () => { clearTimeout(t); removeEventListener('resize', fit); };
  }, []);
  return (
    <>
    {PV_HOST && <div className="as-try" role="group" aria-label="Görünüm denemesi">
      <span>Efekt:</span>
      {[['ring', 'Dönen halka'], ['devre', 'Devre'], ['mikro', 'Mikroskop'], ['osilo', 'Osiloskop']].map(([k2, l]) => <button key={k2} type="button" className={fx === k2 ? 'on' : ''} onClick={() => pickFx(k2)}>{l}</button>)}
      {fx === 'ring' && [['dev', 'Dev'], ['amblem', 'Ortada']].map(([k2, l]) => <button key={k2} type="button" className={v === k2 ? 'on' : ''} onClick={() => pick(k2)}>{l}</button>)}
    </div>}
    <div ref={wrapRef} className={'as-wrap as-v-' + v}>
      <div className={'as-form' + (k === 'signup' ? ' sg' : '')}>
        <div className="as-form-in">{children}</div>
      </div>
      <aside className="as-side" aria-hidden="true">
        <div className={'as-stick sfx-' + fx}>
          <span className="as-beam b1" /><span className="as-beam b2" />
          <div key={k} className={'as-art as-' + k + ' fx-' + fx}>
            <span className="as-glow" />
            {fx === 'devre' && <Circuit />}
            {fx === 'mikro' && <Reticle />}
            {fx === 'osilo' && <Scope />}
            <div className="as-mark">
              <img src="/bn/ert-ring.webp" alt="" className="as-ring" decoding="async" />
              <div className="as-float"><img src="/bn/ert-e.webp" alt="" className="as-e" decoding="async" /></div>
            </div>
          </div>
          <span className="as-fade" />
          <blockquote className="as-q">
            <p key={q}><Words text={'“' + q + '”'} /></p>
            <cite>ERTEL GSM</cite>
          </blockquote>
        </div>
      </aside>
    </div>
    </>
  );
}
