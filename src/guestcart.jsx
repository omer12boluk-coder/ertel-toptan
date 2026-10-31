// Ürünler sayfasının altındaki "Sepete git" çubuğu (mağaza ve bayi) ve mağazadaki 3 adımlık kısa tarif
import { useState } from 'react';
import { useStore, go } from './store.js';
import { Icon } from './ui.jsx';
import { totals, fmtTotals, soon } from './utils.js';
import { useCartItems } from './cart.jsx';
import { lineCount } from './sets.jsx';

// Ekranın sağ altında küçük sepet düğmesi (ürünler ve ana sayfada, sepette ürün varken)
export function CartBar() {
  const tab = useStore((s) => s.tab);
  const items = useCartItems();
  if (!['katalog', 'anasayfa'].includes(tab) || !items.length) return null;
  const tot = totals(items, 'offer');
  return (
    <button className="cart-fab" onClick={() => go('sepet')} aria-label={`Sepete git: ${lineCount(items)} ürün, ${fmtTotals(tot)}`} title="Sepete git">
      <span className="cart-fab-ic"><Icon n="cart" s={22} /><b key={items.length}>{lineCount(items)}</b></span>
      <span className="cart-fab-t">{fmtTotals(tot)}</span>
    </button>
  );
}

// Üst menüde ayrı, belirgin sepet düğmesi
export function HeaderCart({ on }) {
  const items = useCartItems();
  const tot = totals(items, 'offer');
  return (
    <button className={'hcart' + (on ? ' on' : '') + (items.length ? ' full' : '')} onClick={() => go('sepet')} aria-label="Sepet">
      <span className="hcart-ic"><Icon n="cart" s={20} />{items.length > 0 && <b key={lineCount(items)}>{lineCount(items)}</b>}</span>
      <span className="hcart-t"><b>Sepet</b><small>{items.length ? fmtTotals(tot) : 'Boş'}</small></span>
    </button>
  );
}

export function GuestGuide() {
  const S = useStore((s) => s.settings);
  const orders = S.orders?.enabled !== false && !soon(S, 'checkoutSoon');
  const [off, setOff] = useState(() => { try { return sessionStorage.getItem('guide-off') === '1'; } catch { return false; } });
  if (off) return null;
  return (
    <div className="gguide">
      <ol>
        <li><b>1</b><span>İstediğiniz ürünlerde <b>Sepete ekle</b>’ye basın</span></li>
        <li><b>2</b><span>Alttaki <b>Sepete git</b>’e basın</span></li>
        <li><b>3</b><span>{orders ? <b>Sepeti onayla</b> : null}{orders ? <>, bilgilerinizi girip <b>Siparişi tamamla</b> <small className="muted">(ya da listeyi WhatsApp’tan gönderin)</small></> : <>Sepette yeşil <b>WhatsApp’tan gönder</b>’e basın</>}</span></li>
      </ol>
      <button className="icon-btn sm" onClick={() => { setOff(true); try { sessionStorage.setItem('guide-off', '1'); } catch {} }} aria-label="Kapat"><Icon n="x" s={14} /></button>
    </div>
  );
}
