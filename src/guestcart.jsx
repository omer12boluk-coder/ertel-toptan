// Vitrin (/magaza) sepeti — olabildiğince basit:
//   ürünleri ekle → Sepet → büyük yeşil "WhatsApp'tan gönder" → WhatsApp dükkan sohbetinde sadece liste linkiyle açılır → müşteri gönder'e basar.
// Liste hiçbir yere kaydedilmez; ürünler ve adetler linkin içindedir (bkz. listcode.js). Pano / paylaş penceresi kullanılmaz.
import { useMemo, useState } from 'react';
import { useStore, setQty, freshStart, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty } from './ui.jsx';
import { waLink } from './route.js';
import { fmt, totals, fmtTotals } from './utils.js';
import { encodeList, listLink } from './listcode.js';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newNo = () => Array.from({ length: 4 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

export function GuestCart() {
  const { cart, byId, settings: S } = useStore();
  const [no] = useState(newNo);
  const [opened, setOpened] = useState(false);

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  const items = useMemo(() => lines.map(({ p, qty }) => ({ id: p.id, qty })), [JSON.stringify(cart), byId]);
  const tot = totals(lines.map(({ p, qty }) => ({ cur: p.cur, qty, offer: p.r > 0 ? p.r : null })), 'offer');
  const link = useMemo(() => listLink(encodeList({ no, at: Date.now(), items })), [no, items]);
  const wa = S.shop.whatsapp ? waLink(S.shop.whatsapp, link) : null;

  function send() {
    if (!wa) return toast('Dükkan WhatsApp numarası girilmemiş', 'bad');
    window.open(wa, '_blank', 'noopener');
    setOpened(true);
  }
  function reset() { freshStart(); setOpened(false); go('katalog'); toast('Sepet temizlendi'); }

  if (!lines.length) {
    return (
      <div className="page narrow">
        <h1 className="page-t">Sepet</h1>
        <Empty icon="cart" title="Sepetiniz boş">
          <p>Ürünlerin yanındaki <b>Ekle</b> düğmesine basın, sonra buraya gelin.</p>
          <button className="btn primary big" onClick={() => go('katalog')}><Icon n="grid" />Ürünlere git</button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="page gcart">
      <div className="gcart-head">
        <h1 className="page-t">Sepetiniz <span className="muted">· {lines.length} ürün</span></h1>
        <button className="btn sm ghost danger" onClick={reset}><Icon n="trash" s={15} />Sepeti temizle</button>
      </div>

      <ul className="clist">
        {lines.map(({ p, qty }) => (
          <li key={p.id} className="cline">
            <Thumb p={p} size="sm" />
            <div className="cline-info">
              <span className="prow-name">{p.n}</span>
              <span className="prow-meta"><code>{p.k}</code>{p.r > 0 && <span>{fmt(p.r, p.cur)}</span>}</span>
            </div>
            <div className="cline-ctl">
              <Stepper small value={qty} onChange={(v) => setQty(p.id, v)} />
              <b className="num cline-tot">{p.r > 0 ? fmt(p.r * qty, p.cur) : '—'}</b>
              <button className="icon-btn sm" onClick={() => setQty(p.id, 0)} aria-label="Sepetten çıkar"><Icon n="trash" s={16} /></button>
            </div>
          </li>
        ))}
      </ul>

      <div className="gsend">
        <div className="gsend-tot"><span>Toplam</span><b className="num">{fmtTotals(tot)}</b></div>
        {!opened ? (
          <>
            <button className="wa-go" onClick={send} disabled={!wa}>
              <Icon n="wa" s={30} />
              <span><b>WhatsApp’tan gönder</b><small>Sepetiniz bize gelir</small></span>
            </button>
            <p className="gsend-hint">Basınca WhatsApp açılır. Açılınca <b>sadece gönder tuşuna basın</b>, başka bir şey yazmanıza gerek yok.</p>
          </>
        ) : (
          <div className="gsend-done">
            <p><b>WhatsApp açıldı.</b> Mesajı gönderdiniz mi? Göndermediyseniz WhatsApp’ta <b>gönder</b> tuşuna basın.</p>
            <div className="gsend-btns">
              <a className="btn wa" href={wa} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp’ı tekrar aç</a>
              <button className="btn outline" onClick={reset}><Icon n="check" s={16} />Gönderdim, sepeti temizle</button>
            </div>
          </div>
        )}
        {!S.shop.whatsapp && <p className="err">Dükkan WhatsApp numarası henüz girilmemiş.</p>}
        <p className="fine">Fiyatlar liste fiyatıdır. Size özel fiyatı WhatsApp’tan yazarız.</p>
      </div>
    </div>
  );
}

// Vitrinde ürün listesinin altında duran sepet çubuğu (sepette ürün varken)
export function GuestCartBar() {
  const { cart, byId, tab } = useStore();
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  if (tab !== 'katalog' || !lines.length) return null;
  const tot = totals(lines.map(({ p, qty }) => ({ cur: p.cur, qty, offer: p.r > 0 ? p.r : null })), 'offer');
  return (
    <button className="gbar" onClick={() => go('sepet')}>
      <span className="gbar-n"><Icon n="cart" s={20} /><b>{lines.length}</b></span>
      <span className="gbar-t"><b>Sepete git</b><small>{lines.length} ürün · {fmtTotals(tot)}</small></span>
      <span className="gbar-go">Gönder <Icon n="back" s={18} className="flip" /></span>
    </button>
  );
}

// Vitrin ürünler sayfasının üstünde 3 adımlık kısa tarif
export function GuestGuide() {
  const [off, setOff] = useState(() => { try { return sessionStorage.getItem('guide-off') === '1'; } catch { return false; } });
  if (off) return null;
  return (
    <div className="gguide">
      <ol>
        <li><b>1</b><span>İstediğiniz ürünlerde <b>Ekle</b>’ye basın</span></li>
        <li><b>2</b><span>Alttaki <b>Sepete git</b>’e basın</span></li>
        <li><b>3</b><span>Yeşil <b>WhatsApp’tan gönder</b>’e basın</span></li>
      </ol>
      <button className="icon-btn sm" onClick={() => { setOff(true); try { sessionStorage.setItem('guide-off', '1'); } catch {} }} aria-label="Kapat"><Icon n="x" s={14} /></button>
    </div>
  );
}
