// Sepet — online mağaza (/magaza) ve bayi (/b2b) aynı ekranı kullanır; sadece fiyat ve son adım farklıdır.
//   Mağaza: Sepet → "Sepeti onayla" → sipariş bilgileri (checkout.jsx) → Yönetim paneli > Siparişler
//           ya da "WhatsApp'tan liste gönder" → sadece liste linki gider (hiçbir yere kaydedilmez)
//   Bayi:   Sepet → "Sepeti onayla" → talep türü / not → talep kaydedilir (sohbet Talepler'de devam eder)
import { useEffect, useMemo, useState } from 'react';
import { useStore, setQty, clearCart, freshStart, api, openRequest, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty, VatLines, copyText, openMenu } from './ui.jsx';
import { waLink, links } from './route.js';
import { fmt, priceFor, totals, fmtTotals, now } from './utils.js';
import { TYPE } from './config.js';
import { encodeList, listLink, listItems, listRecord } from './listcode.js';
import { renderListImages, currentRate, ListPaper, useRate, toTL, fmtTL } from './listsheet.jsx';
import { Checkout } from './checkout.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
export const newNo = (n = 4) => Array.from({ length: n }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');
const isPhone = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

// Sepetteki ürünler, kullanıcının göreceği fiyatla (mağazada liste, bayide toptan / özel fiyat)
export function useCartItems() {
  const { cart, byId, settings: S, user, userPrices } = useStore();
  return useMemo(() => Object.entries(cart).map(([id, qty]) => byId.get(Number(id)) && { p: byId.get(Number(id)), qty }).filter(Boolean).map(({ p, qty }) => {
    const pr = priceFor(p, S, user, userPrices);
    const it = { id: p.id, k: p.k, n: p.n, cur: p.cur || 'USD', qty, list: p.r > 0 ? p.r : null, asked: pr.mine, offer: pr.mine };
    if (p.pi) it.pi = p.pi; if (p.u) it.u = p.u; if (p.img) it.img = p.img;
    return it;
  }), [cart, byId, S.pricing, user, userPrices]);
}

export function Cart() {
  const pub = useStore((s) => s.user?.role === 'public');
  const S = useStore((s) => s.settings);
  const items = useCartItems();
  const [step, setStep] = useState('cart'); // cart | checkout | wa | send
  const to = (s) => { setStep(s); window.scrollTo(0, 0); };
  useEffect(() => { if (!items.length && step !== 'cart') setStep('cart'); }, [items.length]);
  if (!items.length) return <EmptyCart />;
  if (step === 'checkout') return <Checkout items={items} onBack={() => to('cart')} />;
  if (step === 'send') return <BayiSend items={items} onBack={() => to('cart')} />;
  const orders = pub && S.orders?.enabled !== false;
  return <CartStep items={items} pub={pub} orders={orders} onConfirm={() => (pub && !orders ? null : to(pub ? 'checkout' : 'send'))} />;
}

function EmptyCart() {
  return (
    <div className="page narrow">
      <h1 className="page-t">Sepet</h1>
      <Empty icon="cart" title="Sepetiniz boş">
        <p>Ürünlerin yanındaki <b>Ekle</b> düğmesine basın, sonra buraya gelin.</p>
        <button className="btn primary" onClick={() => go('katalog')}><Icon n="grid" s={16} />Ürünlere git</button>
      </Empty>
    </div>
  );
}

// ---- 1. adım: sepet (iki tarafta da aynı) ------------------------------------------------
function CartStep({ items, pub, orders, onConfirm }) {
  const S = useStore((s) => s.settings);
  const rate = useRate();
  const tot = totals(items, 'offer');
  const tList = totals(items, 'list');
  const saving = Object.entries(tList).map(([c, v]) => [c, v - (tot[c] || 0)]).filter(([, v]) => v > 0.001);
  const tTL = S.pricing.showTL && rate ? toTL(tot, rate) : null;
  const reset = () => { pub ? freshStart() : clearCart(); go('katalog'); toast('Sepet temizlendi'); };
  const menu = (e, it) => openMenu(e, [
    { label: '1 tane daha', icon: 'plus', onClick: () => setQty(it.id, it.qty + 1) },
    it.qty > 1 && { label: '1 tane azalt', icon: 'minus', onClick: () => setQty(it.id, it.qty - 1) },
    { label: 'Sepetten çıkar', icon: 'trash', danger: true, onClick: () => setQty(it.id, 0) },
    '-',
    { label: 'Stok kodunu kopyala', icon: 'copy', hint: it.k, onClick: () => copyText(it.k) },
  ], it.n.slice(0, 40));
  return (
    <div className="page cart-page">
      <div className="cart-head">
        <h1 className="page-t">Sepet <span className="muted">· {items.length} ürün</span></h1>
        <button className="btn sm ghost danger" onClick={reset}><Icon n="trash" s={15} />Sepeti temizle</button>
      </div>
      <div className="cart-grid">
        <ul className="clist gclist">
          <li className="gline gline-h" aria-hidden="true"><span>Ürün</span><span className="gline-ctl"><span className="r">Birim fiyat</span><span className="c">Adet</span><span className="r">Toplam</span><span /></span></li>
          {items.map((it) => (
            <li key={it.id} className="gline" onContextMenu={(e) => menu(e, it)}>
              <a className="gline-p" href={links.product(it, S)} target="_blank" rel="noopener" title="Ürünü yeni sekmede incele">
                <Thumb p={it} size="sm" />
                <span className="cline-info">
                  <span className="prow-name">{it.n}</span>
                  <span className="prow-meta"><code>{it.k}</code>{!pub && S.pricing.showRetail && it.list > 0 && it.list !== it.offer && <span className="strike">Liste {fmt(it.list, it.cur)}</span>}</span>
                </span>
              </a>
              <div className="gline-ctl">
                <span className="num gline-unit" data-l="Birim">{it.offer == null ? 'Sorulacak' : fmt(it.offer, it.cur)}</span>
                <Stepper small value={it.qty} onChange={(v) => setQty(it.id, v)} />
                <b className="num gline-sum">{it.offer == null ? '—' : fmt(it.offer * it.qty, it.cur)}</b>
                <button className="icon-btn sm" onClick={() => setQty(it.id, 0)} aria-label="Sepetten çıkar"><Icon n="trash" s={16} /></button>
              </div>
            </li>
          ))}
        </ul>
        <aside className="cart-sum">
          <div className="sum-rows">
            {!pub && S.pricing.showRetail && saving.length > 0 && <div><span>Liste toplamı</span><span className="num strike">{fmtTotals(tList)}</span></div>}
            {!pub && S.pricing.showSaving && saving.length > 0 && <div className="sum-save"><span>Avantajınız</span><span className="num">{saving.map(([c, v]) => fmt(v, c)).join(' + ')}</span></div>}
            <div className="sum-total"><span>{pub ? 'Toplam' : 'Toptan toplam'}</span><b className="num">{fmtTotals(tot)}</b></div>
            {tTL != null && <div className="sum-tl"><span /><span className="num">≈ {fmtTL(tTL)}</span></div>}
          </div>
          <VatLines by={tot} />
          {(!pub || orders) && (
            <button className="btn primary big" onClick={onConfirm}>
              <Icon n="check" />
              <span><b>Sepeti onayla</b><small>{pub ? 'Teslimat ve fatura bilgileri' : 'Hazırlatın ya da fiyat sorun'}</small></span>
            </button>
          )}
          {pub && <ShopWhatsApp items={items} />}
          <p className="fine">{pub ? S.orders?.cargoNote || '' : S.shop.pickupNote}</p>
        </aside>
      </div>
    </div>
  );
}

// ---- Mağaza: sepeti WhatsApp'tan liste linki olarak gönder (hiçbir yere kaydedilmez; ara sayfa yok)
function ShopWhatsApp({ items }) {
  const S = useStore((s) => s.settings);
  const [no] = useState(newNo);
  const key = items.map((i) => i.id + ':' + i.qty).join(',');
  const link = useMemo(() => listLink(encodeList({ no, at: Date.now(), items: items.map(({ id, qty }) => ({ id, qty })) })), [no, key]);
  const wa = S.shop.whatsapp ? waLink(S.shop.whatsapp, link) : null;
  return (
    <div className="wa-row">
      {wa
        ? <a className="btn wa-soft wa-main" href={wa} target="_blank" rel="noopener"><Icon n="wa" s={19} />WhatsApp’tan gönder</a>
        : <span className="btn wa-soft wa-main" aria-disabled="true"><Icon n="wa" s={19} />WhatsApp’tan gönder</span>}
      <button className="btn outline icon wa-copy" onClick={() => copyText(link, 'Liste linki kopyalandı, WhatsApp’ta yapıştırın')} aria-label="Liste linkini kopyala" title="Liste linkini kopyala"><Icon n="copy" s={18} /></button>
    </div>
  );
}

// ---- Bayi: talep gönder (hazırlayın / fiyat sor) ----------------------------------------------
function BayiSend({ items, onBack }) {
  const { settings: S, user } = useStore();
  const [no] = useState(newNo);
  const [type, setType] = useState(S.requests.allowReserve ? 'reserve' : 'quote');
  const [pickup, setPickup] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const tot = totals(items, 'offer');
  const at = useMemo(() => now(), []);
  const rec = { no, userName: user.shop || user.name, items, status: 'offered', createdAt: at, updatedAt: at };
  const types = [['reserve', 'Hazırlayın, geliyorum', 'Bu fiyatlarla ayırın', S.requests.allowReserve], ['quote', 'Fiyat sor', 'Son ne olur? Teklif isteyin', S.requests.allowQuote]].filter((t) => t[3]);
  async function send(viaWA) {
    if (busy) return;
    const win = viaWA ? window.open('about:blank', '_blank') : null; // tarayıcı engellemesin diye pencere tıklamada açılır
    setBusy(true);
    try {
      const t = now();
      const msgs = [{ from: 'system', text: `${TYPE[type]} · ${items.length} kalem · ${fmtTotals(tot)}`, at: t }];
      if (note.trim()) msgs.push({ from: 'user', text: note.trim(), at: t + 1 });
      const id = await api().createRequest({ no, type, status: 'new', items, note: note.trim(), pickup: type === 'reserve' ? pickup.trim() : '', createdAt: t, updatedAt: t + 1, unreadAdmin: 1, unreadUser: 0, lastMsg: note.trim() || TYPE[type], lastFrom: 'user', uid: user.uid, userName: user.name || user.username, shop: user.shop || '' }, msgs);
      clearCart();
      if (viaWA) { const url = waLink(S.shop.whatsapp, `Merhaba, #${no} numaralı talebim:\n${links.adminRequest(id)}`); if (win) win.location.href = url; else location.href = url; }
      toast(type === 'reserve' ? 'Talebiniz iletildi, hazırlanınca haber vereceğiz' : 'Fiyat sorunuz iletildi');
      openRequest(id);
    } catch (e) { win?.close(); toast('Gönderilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  return (
    <div className="page send-step">
      <div className="send-bar">
        <button className="btn sm ghost" onClick={onBack}><Icon n="back" s={16} />Sepet</button>
        <div className="send-t"><b>Talep #{no}</b><span className="muted">{items.length} ürün · {fmtTotals(tot)}</span></div>
        <div className="send-btns">
          <button className="btn primary" disabled={busy} onClick={() => send(false)}><Icon n="send" s={16} />Gönder</button>
          {S.shop.whatsapp && <button className="btn wa" disabled={busy} onClick={() => send(true)}><Icon n="wa" s={17} />WhatsApp’tan gönder</button>}
        </div>
      </div>
      <div className="send-opts">
        {types.length > 1 && (
          <div className="seg-cards" role="radiogroup" aria-label="Talep türü">
            {types.map(([k, l, sub]) => (
              <button key={k} role="radio" aria-checked={type === k} className={'seg-card' + (type === k ? ' on' : '')} onClick={() => setType(k)}>
                <span className="radio" aria-hidden="true" /><span><b>{l}</b><small>{sub}</small></span>
              </button>
            ))}
          </div>
        )}
        <div className="row2">
          {type === 'reserve' && S.requests.askPickupTime && <label className="field"><span className="field-l">Ne zaman gelirsiniz? <small className="opt">(isteğe bağlı)</small></span><input id="cart-pickup" placeholder="ör. Bugün 17:00, yarın sabah" value={pickup} onChange={(e) => setPickup(e.target.value)} /></label>}
          <label className="field"><span className="field-l">Not <small className="opt">(isteğe bağlı)</small></span><input id="cart-note" placeholder={type === 'quote' ? 'ör. Hepsini alırsam son ne olur?' : 'ör. Kutusuyla birlikte'} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <p className="fine">Gönderince talebiniz <b>Talepler</b>’e düşer; dükkanla oradan yazışabilirsiniz. WhatsApp’tan gönderirseniz mesajda sadece talebin linki gider.</p>
      </div>
      <ListPaper r={rec} label="Talep" who={!!rec.userName} />
    </div>
  );
}
