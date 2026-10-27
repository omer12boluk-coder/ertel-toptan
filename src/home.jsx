// Giriş sayfası (/) ve bayi ana sayfası (/b2b → Ana sayfa)
import { useState } from 'react';
import { useStore, go } from './store.js';
import { Icon } from './ui.jsx';
import { links } from './route.js';
import { LOGO_WIDE, LOGO_MARK } from './config.js';
import { NewMessage } from './requests.jsx';

// ---- Kök adres: iki kapı ---------------------------------------------------------
export function Landing() {
  const S = useStore((s) => s.settings);
  return (
    <div className="landing">
      <header className="landing-h">
        <img src={S.brand.logoWide || LOGO_WIDE} alt={S.shop.name} />
      </header>
      <main className="landing-doors">
        <a className="door door-shop" href="/magaza">
          <span className="door-ic"><Icon n="store" s={34} /></span>
          <span className="door-t">
            <b>Online mağaza</b>
            <span>Ürünleri inceleyin, listenizi hazırlayın ve tek tuşla WhatsApp’tan bize gönderin.</span>
          </span>
          <span className="door-go">Mağazaya gir <Icon n="back" s={18} className="flip" /></span>
        </a>
        <a className="door door-b2b" href="/b2b">
          <span className="door-ic"><Icon n="shield" s={26} /></span>
          <span className="door-t">
            <b>Bayi girişi</b>
            <span>Kullanıcı adı ve şifrenizle toptan fiyatlara ulaşın.</span>
          </span>
          <span className="door-go">Giriş yap <Icon n="back" s={18} className="flip" /></span>
        </a>
      </main>
      <footer className="landing-f">
        <b>{S.shop.name}</b>
        <span>{[S.shop.address, S.shop.hours, S.shop.phone].filter(Boolean).join(' · ')}</span>
      </footer>
    </div>
  );
}

// ---- Bayi ana sayfası ---------------------------------------------------------------
// İçerik (başlık, duyurular, bannerlar) Yönetim paneli > Ayarlar > Ana sayfa'dan yönetilir.
export function goAnimated(tab) {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(() => go(tab));
  else go(tab);
}

export function HomePage() {
  const { settings: S, user, cart, requests } = useStore();
  const [msg, setMsg] = useState(false);
  const H = S.home || {};
  const cartN = Object.keys(cart).length;
  const unread = requests.filter((r) => r.unreadUser > 0).length;
  const open = requests.filter((r) => ['new', 'offered', 'accepted', 'ready'].includes(r.status)).length;
  const anns = (H.announcements || []).filter((a) => a.text?.trim());
  const banners = (H.banners || []).filter((b) => b.img || b.title);
  const tiles = [
    ['katalog', 'Katalog', 'grid', 'Tüm ürünler ve toptan fiyatlar', null],
    ['sepet', 'Sepet', 'cart', cartN ? `${cartN} kalem sepette` : 'Sepetiniz boş', cartN],
    ['talepler', 'Siparişlerim', 'box', unread ? `${unread} yeni mesaj` : open ? `${open} açık sipariş` : 'Siparişleriniz ve fiyat sorularınız', unread],
    ['mesaj', 'Mesaj yaz', 'send', 'Ürün sormadan doğrudan yazın', null],
    ['profil', 'Profil', 'user', user.shop || 'Bilgileriniz', null],
  ];
  return (
    <div className="home">
      <section className="home-hero">
        <img className="home-mark" src={S.brand.logo || LOGO_MARK} alt="" />
        <div>
          <p className="eyebrow">{S.shop.name}</p>
          <h1>{H.title || `Hoş geldiniz${user.name ? ', ' + user.name.split(' ')[0] : ''}`}</h1>
          {H.subtitle && <p className="home-sub">{H.subtitle}</p>}
        </div>
      </section>

      {anns.length > 0 && (
        <section className="home-anns" aria-label="Duyurular">
          {anns.map((a, i) => <div key={i} className={'ann tone-' + (a.tone || 'info')}><Icon n="tag" s={18} /><p>{a.text}</p></div>)}
        </section>
      )}

      <nav className="home-tiles" aria-label="Menü">
        {tiles.map(([k, l, ic, sub, badge]) => (
          <button key={k} className={'tile tile-' + k} onClick={() => (k === 'mesaj' ? setMsg(true) : goAnimated(k))} style={{ viewTransitionName: 'nav-' + k }}>
            <span className="tile-ic"><Icon n={ic} s={26} />{badge > 0 && <span className="badge">{badge}</span>}</span>
            <b>{l}</b>
            <small>{sub}</small>
          </button>
        ))}
      </nav>

      {banners.length > 0 ? (
        <section className="home-banners">
          {banners.map((b, i) => {
            const inner = <>{b.img && <img src={b.img} alt="" />}{(b.title || b.text) && <span className="bn-t">{b.title && <b>{b.title}</b>}{b.text && <span>{b.text}</span>}</span>}</>;
            return b.link ? <a key={i} className="bn" href={b.link} target={b.link.startsWith('http') ? '_blank' : undefined} rel="noopener">{inner}</a> : <div key={i} className="bn">{inner}</div>;
          })}
        </section>
      ) : (
        <section className="home-banners">
          <div className="bn bn-empty"><span className="bn-t"><b>Kampanyalar burada görünecek</b><span>Yeni gelen ürünler, fırsatlar ve duyurular için bu alanı takip edin.</span></span></div>
        </section>
      )}
      {msg && <NewMessage onClose={() => setMsg(false)} />}
    </div>
  );
}
