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
const asTry = (S) => { const def = S?.orders?.authSide === 'amblem' ? 'amblem' : 'dev'; if (!PV_HOST) return def; try { return localStorage.getItem('as-try') || def; } catch { return def; } };
const LOGO = '/bn/ert-amblem.webp'; // 16.11: düzeltilmiş amblem (halka gerçek daire, e kenarı pürüzsüz)

// view: AuthForm'un o anki görünümü (login | signup | reset | bayi …)
export function AuthSplit({ view, children }) {
  const k = view === 'signup' ? 'signup' : 'login';
  const S = useStore((st) => st.settings);
  const q = (k === 'signup' ? S?.orders?.authSignup : S?.orders?.authLogin)?.trim() || AUTH_TXT[k];
  const [v, setV] = useState(() => asTry(S));
  const pick = (x) => { try { localStorage.setItem('as-try', x); } catch {} setV(x); };
  // tam sayfa: bölme üst menünün altından ekranın dibine kadar; üst konum ölçülür, sadece genişlik değişince yeniden
  // (Safari adres çubuğu açılıp kapanınca yükseklik oynamasın)
  const wrapRef = useRef(null);
  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    let lastW = 0;
    const fit = () => { if (innerWidth === lastW) return; lastW = innerWidth; el.style.setProperty('--as-top', Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY)) + 'px'); };
    fit(); const t = setTimeout(() => { lastW = 0; fit(); }, 600);
    addEventListener('resize', fit);
    return () => { clearTimeout(t); removeEventListener('resize', fit); };
  }, []);
  return (
    <>
    {PV_HOST && <div className="as-try" role="group" aria-label="Görünüm denemesi">
      <span>Deneme:</span>
      {[['dev', 'B · Dev amblem'], ['amblem', 'A · Amblem ortada']].map(([k2, l]) => <button key={k2} type="button" className={v === k2 ? 'on' : ''} onClick={() => pick(k2)}>{l}</button>)}
    </div>}
    <div ref={wrapRef} className={'as-wrap as-v-' + v}>
      <div className={'as-form' + (k === 'signup' ? ' sg' : '')}>
        <div className="as-form-in">{children}</div>
      </div>
      <aside className="as-side" aria-hidden="true">
        <div className="as-stick">
          <span className="as-beam b1" /><span className="as-beam b2" /><span className="as-dust" />
          <div key={k} className={'as-art as-' + k}>
            <span className="as-glow" />
            <div className="as-float"><img src={LOGO} alt="" className="as-logo" decoding="async" /></div>
          </div>
          <span className="as-fade" />
          <blockquote className="as-q">
            <p>“<Typewriter key={q} text={q} />”</p>
            <cite>ERTEL GSM</cite>
          </blockquote>
        </div>
      </aside>
    </div>
    </>
  );
}
