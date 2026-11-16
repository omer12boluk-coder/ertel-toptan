// İki bölmeli giriş / üye ol sayfası (16.11.2026, kayit-demo dalı — DEMO)
// 21st.dev "auth-ui" bileşeninden uyarlandı: Tailwind / shadcn / TypeScript yok, sitenin kendi CSS'i (.as-*) ve
// kendi AuthForm'u (gerçek giriş/üyelik mantığı aynen) kullanılır. Sağ bölmede ürün görseli + yazılan söz.
// Ayar: look.authUi 'split' = yeni | '' eski tek kutu. Önizleme hostunda (--) hep yeni.
import { useEffect, useState } from 'react';

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
      <span className="as-cursor" aria-hidden="true">{cursor}</span>
    </span>
  );
}

const SIDE = {
  login: { img: '/bn/sugon.webp', mul: false, q: 'Tekrar hoş geldiniz. Tezgâhınız sizi bekliyor.', a: 'ERTEL GSM · Tahtakale' },
  signup: { img: '/bn/tezgah.webp', mul: false, q: 'Üye olun; adresiniz, faturanız ve siparişleriniz hep elinizin altında.', a: 'ERTEL GSM · Tahtakale' },
};

// view: AuthForm'un o anki görünümü (login | signup | reset | bayi …)
export function AuthSplit({ view, children }) {
  const k = view === 'signup' ? 'signup' : 'login';
  const c = SIDE[k];
  return (
    <div className={'as-wrap as-v-' + ((typeof localStorage !== 'undefined' && localStorage.getItem('as-try')) || 'gri')}>
      <div className="as-form">
        <div className="as-form-in">{children}</div>
      </div>
      <aside className="as-side" aria-hidden="true">
        <div className="as-stick">
        <div key={k} className="as-art">
          <img src={c.img} alt="" className={'as-img' + (c.mul ? ' mul' : '')} decoding="async" />
          <span className="as-shd" />
        </div>
        <blockquote className="as-q">
          <p>“<Typewriter key={c.q} text={c.q} />”</p>
          <cite>— {c.a}</cite>
        </blockquote>
        </div>
      </aside>
    </div>
  );
}
