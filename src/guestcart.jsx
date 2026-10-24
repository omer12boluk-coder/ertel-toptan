// Ürünler sayfasının altındaki "Sepete git" çubuğu (mağaza ve bayi) ve mağazadaki 3 adımlık kısa tarif
import { useState } from 'react';
import { useStore, go } from './store.js';
import { Icon } from './ui.jsx';
import { totals, fmtTotals } from './utils.js';
import { useCartItems } from './cart.jsx';

export function CartBar() {
  const tab = useStore((s) => s.tab);
  const items = useCartItems();
  if (tab !== 'katalog' || !items.length) return null;
  const tot = totals(items, 'offer');
  return (
    <button className="gbar" onClick={() => go('sepet')}>
      <span className="gbar-n"><Icon n="cart" s={20} /><b>{items.length}</b></span>
      <span className="gbar-t"><b>Sepete git</b><small>{items.length} ürün · {fmtTotals(tot)}</small></span>
      <span className="gbar-go">Sepeti onayla <Icon n="back" s={18} className="flip" /></span>
    </button>
  );
}

export function GuestGuide() {
  const orders = useStore((s) => s.settings.orders?.enabled !== false);
  const [off, setOff] = useState(() => { try { return sessionStorage.getItem('guide-off') === '1'; } catch { return false; } });
  if (off) return null;
  return (
    <div className="gguide">
      <ol>
        <li><b>1</b><span>İstediğiniz ürünlerde <b>Ekle</b>’ye basın</span></li>
        <li><b>2</b><span>Alttaki <b>Sepete git</b>’e basın</span></li>
        <li><b>3</b><span><b>Sepeti onayla</b>{orders ? <>, bilgilerinizi girip <b>Siparişi tamamla</b> <small className="muted">(ya da listeyi WhatsApp’tan gönderin)</small></> : <>, sonra yeşil <b>WhatsApp’tan gönder</b></>}</span></li>
      </ol>
      <button className="icon-btn sm" onClick={() => { setOff(true); try { sessionStorage.setItem('guide-off', '1'); } catch {} }} aria-label="Kapat"><Icon n="x" s={14} /></button>
    </div>
  );
}
