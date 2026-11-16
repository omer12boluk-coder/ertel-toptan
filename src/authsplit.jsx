// İki bölmeli giriş / üye ol sayfası (16.11.2026, kayit-demo dalı — DEMO)
// 21st.dev "auth-ui" bileşeninden uyarlandı: Tailwind / shadcn / TypeScript yok, sitenin kendi CSS'i (.as-*) ve
// kendi AuthForm'u (gerçek giriş/üyelik mantığı aynen) kullanılır. Sağ bölmede ürün görseli + yazılan söz.
// Ayar: look.authUi 'split' = yeni | '' eski tek kutu. Önizleme hostunda (--) hep yeni.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const PV_HOST = typeof location !== 'undefined' && /--/.test(location.hostname);
export const authSplitOn = (S) => PV_HOST || S?.look?.authUi === 'split';

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
const SIDE = {
  login: { q: 'Tekrar hoş geldiniz. Tezgâhınız sizi bekliyor.', a: 'ERTEL GSM · Tahtakale',
    hero: '/bn/film-q861-on.webp', layers: ['/bn/sm4.webp', '/bn/film-q861-on.webp', '/bn/da07.webp'] },
  signup: { q: 'Tamircinin tezgâhına ne lazımsa, hepsi burada.', a: 'ERTEL GSM · Tahtakale',
    hero: '/bn/sm4.webp', layers: ['/bn/sm4.webp', '/bn/sugon.webp', '/bn/v1s.webp'] },
};
const asTry = () => { try { return localStorage.getItem('as-try') || 'dev'; } catch { return 'dev'; } };
const LOGO = '/bn/ert-amblem.webp'; // 16.11: düzeltilmiş amblem (halka gerçek daire, e kenarı pürüzsüz)

// view: AuthForm'un o anki görünümü (login | signup | reset | bayi …)
export function AuthSplit({ view, children }) {
  const k = view === 'signup' ? 'signup' : 'login';
  const c = SIDE[k];
  const [v, setV] = useState(asTry);
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
            {(v === 'amblem' || v === 'dev')
              ? <><span className="as-glow" /><img src={LOGO} alt="" className="as-logo" decoding="async" />{v === 'amblem' && <span className="as-word">ERTEL GSM</span>}</>
              : v === 'kolaj'
              ? c.layers.map((src, i) => <img key={i} src={src} alt="" className={'as-ly l' + i} decoding="async" />)
              : <img src={c.hero} alt="" className="as-hero" decoding="async" />}
          </div>
          {v === 'dev' && <span className="as-word as-word-top">ERTEL GSM</span>}
          <span className="as-fade" />
          <blockquote className="as-q">
            <p>“<Typewriter key={c.q} text={c.q} />”</p>
            <cite>— {c.a}</cite>
          </blockquote>
        </div>
      </aside>
    </div>
    </>
  );
}
