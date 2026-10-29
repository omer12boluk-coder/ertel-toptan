// Sepet — online mağaza (/magaza) ve bayi (/b2b) aynı ekranı kullanır; sadece fiyat ve son adım farklıdır.
//   Mağaza: Sepet → "Sepeti onayla" → sipariş bilgileri (checkout.jsx) → Yönetim paneli > Siparişler
//           ya da "WhatsApp'tan liste gönder" → sadece liste linki gider (hiçbir yere kaydedilmez)
//   Bayi:   Sepet → "Sepeti onayla" → teslimat / ödeme → bayi siparişi (talepler koleksiyonu, type 'order'; sohbet Siparişlerim'de)
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, setQty, clearCart, freshStart, api, openRequest, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty, VatLines, Confirm, copyText, openMenu } from './ui.jsx';
import { waLink, links } from './route.js';
import { fmt, priceFor, totals, fmtTotals, now, soon, ls } from './utils.js';
import { TYPE, B2B_DELIV, B2B_PAY, B2B_PAY_PICK } from './config.js';
import { encodeList, listLink, listItems, listRecord } from './listcode.js';
import { ProductSheet, Lightbox, imageList } from './catalog.jsx';
import { renderListImages, currentRate, ListPaper, useRate, toTL, fmtTL } from './listsheet.jsx';
import { Checkout } from './checkout.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
export const newNo = (n = 4) => Array.from({ length: n }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');
const isPhone = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

// Sepetteki ürünler, kullanıcının göreceği fiyatla (mağazada liste, bayide toptan / özel fiyat)
export function useCartItems(override) {
  const { cart: cart0, byId, settings: S, user, userPrices } = useStore();
  const cart = override || cart0;
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
  const buyNow = useStore((s) => s.buyNow); // ürün penceresinde "Hemen satın al": sadece o ürünle sipariş, sepet bozulmaz
  const single = useMemo(() => (buyNow ? { [buyNow.id]: buyNow.qty } : null), [buyNow]);
  const items = useCartItems();
  const bnItems = useCartItems(single || {});
  useEffect(() => () => { if (store.s.buyNow) store.set({ buyNow: null }); }, []);
  const [step, setStep] = useState('cart'); // cart | checkout | wa | send
  const to = (s) => { setStep(s); window.scrollTo(0, 0); };
  useEffect(() => { if (!items.length && step !== 'cart') setStep('cart'); }, [items.length]);
  if (buyNow && pub && bnItems.length) return <Checkout single items={bnItems} onBack={() => { store.set({ buyNow: null }); history.length > 1 ? history.back() : go('katalog'); }} />;
  if (!items.length) return <EmptyCart />;
  if (step === 'checkout') return <Checkout items={items} onBack={() => to('cart')} />;
  if (step === 'send') return <BayiSend items={items} onBack={() => to('cart')} />;
  const orders = pub && S.orders?.enabled !== false && !soon(S, 'checkoutSoon');
  const coming = pub && S.orders?.enabled !== false && soon(S, 'checkoutSoon');
  return <CartStep items={items} pub={pub} orders={orders} coming={coming} onConfirm={() => (pub && !orders ? null : to(pub ? 'checkout' : 'send'))} />;
}

function EmptyCart() {
  return (
    <div className="page narrow">
      <h1 className="page-t">Sepet</h1>
      <Empty icon="cart" title="Sepetiniz boş">
        <p>Ürünlerin yanındaki <b>Sepete ekle</b> düğmesine basın, sonra buraya gelin.</p>
        <button className="btn primary" onClick={() => go('katalog')}><Icon n="grid" s={16} />Ürünlere git</button>
      </Empty>
    </div>
  );
}

// Telefonda satırı sola çekince arkadan kırmızı "Sil" çıkar; sonuna kadar çekilirse hemen silinir.
const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(hover: none) and (pointer: coarse)').matches;
export function SwipeLine({ id, open, setOpen, onDelete, children, onContextMenu, inner = 'gline', delLabel = 'Sepetten çıkar', className = '' }) {
  const row = useRef(null);
  const st = useRef(null);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [gone, setGone] = useState(false);
  const W = 92;
  useEffect(() => { if (open !== id && !drag) setDx(0); }, [open]);
  useEffect(() => {
    const el = row.current; if (!el || !COARSE) return;
    const start = (e) => { const t = e.touches[0]; st.current = { x: t.clientX, y: t.clientY, base: open === id ? -W : 0, mode: null }; };
    const move = (e) => {
      const s0 = st.current; if (!s0) return; const t = e.touches[0];
      const ddx = t.clientX - s0.x, ddy = t.clientY - s0.y;
      if (!s0.mode) { if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return; s0.mode = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v'; if (s0.mode === 'h') setDrag(true); }
      if (s0.mode !== 'h') return;
      e.preventDefault();
      let x = s0.base + ddx; if (x > 0) x = x / 4; if (x < -W) x = -W + (x + W) * 0.55;
      s0.x1 = x; setDx(x);
    };
    const end = () => {
      const s0 = st.current; st.current = null; if (!s0 || s0.mode !== 'h') return;
      setDrag(false);
      const x = s0.x1 ?? 0; const w = el.getBoundingClientRect().width;
      if (x < -w * 0.55) { setGone(true); setDx(-w); setTimeout(onDelete, 220); return; }
      if (x < -W / 2) { setDx(-W); setOpen(id); } else { setDx(0); if (open === id) setOpen(null); }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, [open, id]);
  return (
    <li className={'gl-sw' + (gone ? ' gone' : '') + (className ? ' ' + className : '')} ref={row} onContextMenu={onContextMenu}>
      {COARSE && <button type="button" className="gl-del" style={{ opacity: dx < -4 ? 1 : 0 }} onClick={() => { setGone(true); setTimeout(onDelete, 200); }} aria-label={delLabel}><Icon n="trash" s={20} /><span>Sil</span></button>}
      <div className={inner + (drag ? ' dragging' : '')} style={dx ? { transform: `translate3d(${dx}px,0,0)` } : undefined}
        onClickCapture={(e) => { if (open === id) { e.stopPropagation(); e.preventDefault(); setOpen(null); } }}>{children}</div>
    </li>
  );
}

// Sepet özeti (bilgisayar): sayfa ne kadar uzarsa uzasın yerinde SABİT (ödeme adımındaki özetle aynı yol).
// Yer sayfa düzeninden (offsetLeft/Top) ölçülür, ilk boyamadan önce (useLayoutEffect) → açılışta kayıp yerine oturmaz.
function useFixedCartSum(sideRef, boxRef) {
  useLayoutEffect(() => {
    const side = sideRef.current, box = boxRef.current; if (!side || !box) return;
    let retry = 0;
    const reset = () => { box.classList.remove('cs-fixed'); box.style.top = box.style.left = box.style.width = ''; };
    const place = () => {
      if (!matchMedia('(min-width: 900px)').matches) return reset();
      let x = 0, y = 0; for (let e = side; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
      if (y + box.offsetHeight + 16 > innerHeight) return reset(); // ekrana sığmıyorsa eski yapışkan düzen
      for (let e = side.parentElement; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.transform !== 'none' || e.getAnimations?.().some((a) => a.playState === 'running' && a.effect?.getKeyframes?.().some((k) => k.transform))) { reset(); clearTimeout(retry); retry = setTimeout(place, 60); return; } }
      box.classList.add('cs-fixed');
      Object.assign(box.style, { top: Math.round(y) + 'px', left: Math.round(x - scrollX) + 'px', width: side.offsetWidth + 'px' });
    };
    place(); const t = [setTimeout(place, 60), setTimeout(place, 400)];
    const ro = new ResizeObserver(place); ro.observe(document.body);
    addEventListener('resize', place);
    return () => { t.forEach(clearTimeout); clearTimeout(retry); ro.disconnect(); removeEventListener('resize', place); reset(); };
  }, []);
}

// ---- 1. adım: sepet (iki tarafta da aynı) ------------------------------------------------
function CartStep({ items, pub, orders, coming, onConfirm }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const [sheetP, setSheetP] = useState(null);
  const [lb, setLb] = useState(null);
  const [swOpen, setSwOpen] = useState(null); // telefonda sola çekilip "Sil" açılan satır
  const rate = useRate();
  const tot = totals(items, 'offer');
  const tList = totals(items, 'list');
  const saving = Object.entries(tList).map(([c, v]) => [c, v - (tot[c] || 0)]).filter(([, v]) => v > 0.001);
  const tTL = S.pricing.showTL && rate ? toTL(tot, rate) : null;
  const reset = () => { pub ? freshStart() : clearCart(); go('katalog'); toast('Sepet temizlendi'); };
  const [ask, setAsk] = useState(false);
  const nQty = items.reduce((a, it) => a + (it.qty || 0), 0);
  const sideRef = useRef(null), boxRef = useRef(null);
  useFixedCartSum(sideRef, boxRef);
  const menu = (e, it) => openMenu(e, [
    { label: '1 tane daha', icon: 'plus', onClick: () => setQty(it.id, it.qty + 1) },
    it.qty > 1 && { label: '1 tane azalt', icon: 'minus', onClick: () => setQty(it.id, it.qty - 1) },
    { label: 'Sepetten çıkar', icon: 'trash', danger: true, onClick: () => setQty(it.id, 0) },
    '-',
    { label: 'Stok kodunu kopyala', icon: 'copy', hint: it.k, onClick: () => copyText(it.k) },
  ], it.n.slice(0, 40));
  const prodOf = (it) => byId.get(it.id) || it;
  const openSheet = (it) => setSheetP(prodOf(it));
  const openImg = (it) => { const p = prodOf(it); const u = imageList(p, S, 'lg'); if (u.length) setLb({ urls: u, thumbs: imageList(p, S, 'sm'), title: p.n }); else openSheet(it); };
  return (
    <div className="page cart-page">
      <button type="button" className="cart-back" onClick={() => go('katalog')}><Icon n="back" s={15} />Alışverişe devam et</button>
      <div className="cart-head">
        <h1 className="page-t">Sepet <span className="muted">· {items.length} ürün</span></h1>
        <button type="button" className="cart-clear cc-m" onClick={() => setAsk(true)}><Icon n="trash" s={14} />Sepeti temizle</button>
      </div>
      <div className="cart-grid">
        <ul className="clist gclist">
          <li className="gline gline-h" aria-hidden="true"><span>Ürün</span><span className="gline-ctl"><span className="r">Birim fiyat</span><span className="c">Adet</span><span className="r">Toplam</span><span /></span></li>
          {items.map((it) => (
            <SwipeLine key={it.id} id={it.id} open={swOpen} setOpen={setSwOpen} onDelete={() => setQty(it.id, 0)} onContextMenu={(e) => menu(e, it)}>
              <div className="gline-p">
                <button type="button" className="gline-img" onClick={() => openImg(it)} aria-label="Resmi büyüt"><Thumb p={it} size="sm" /></button>
                <button type="button" className="cline-info gline-name" onClick={() => openSheet(it)} title="Ürünü aç">
                  <span className="prow-name">{it.n}</span>
                  <span className="prow-meta"><code>{it.k}</code>{!pub && S.pricing.showRetail && it.list > 0 && it.list !== it.offer && <span className="strike">Liste {fmt(it.list, it.cur)}</span>}</span>
                </button>
              </div>
              <div className="gline-ctl">
                <span className="num gline-unit" data-l="Birim">{it.offer == null ? 'Sorulacak' : fmt(it.offer, it.cur)}</span>
                <Stepper small min={1} value={it.qty} onChange={(v) => setQty(it.id, v)} onRemove={() => setQty(it.id, 0)} />
                <b className="num gline-sum">{it.offer == null ? '—' : fmt(it.offer * it.qty, it.cur)}</b>
                <button className="icon-btn sm" onClick={() => setQty(it.id, 0)} aria-label="Sepetten çıkar"><Icon n="trash" s={16} /></button>
              </div>
            </SwipeLine>
          ))}
        </ul>
        <div className="cart-side" ref={sideRef}><aside className="cart-sum" ref={boxRef}>
          <div className="cs-head">
            <div className="cs-head-t"><b>Sepetiniz</b><small>{items.length} ürün · {nQty} adet</small></div>
            <button type="button" className="cart-clear" onClick={() => setAsk(true)} title="Sepetteki tüm ürünleri çıkar"><Icon n="trash" s={14} />Temizle</button>
          </div>
          <div className="sum-rows">
            {!pub && S.pricing.showRetail && saving.length > 0 && <div><span>Liste toplamı</span><span className="num strike">{fmtTotals(tList)}</span></div>}
            {!pub && S.pricing.showSaving && saving.length > 0 && <div className="sum-save"><span>Avantajınız</span><span className="num">{saving.map(([c, v]) => fmt(v, c)).join(' + ')}</span></div>}
            <div className="sum-total"><span>{pub ? 'Toplam' : 'Toptan toplam'}</span><b className="num">{fmtTotals(tot)}</b></div>
            {tTL != null && <div className="sum-tl"><span /><span className="num">≈ {fmtTL(tTL)}</span></div>}
          </div>
          {pub && <VatLines by={tot} />}
          {(!pub || orders) && (
            <button className="btn primary big" onClick={onConfirm}>
              <Icon n="check" />
              <span><b>Sepeti onayla</b><small>{pub ? 'Teslimat ve fatura bilgileri' : 'Teslimat ve ödeme seçin'}</small></span>
            </button>
          )}
          {coming && ( // çok yakında: sistem hazır, müşteriye henüz açık değil (Ayarlar > Online mağaza)
            <div className="btn primary big soon-btn" aria-disabled="true">
              <Icon n="check" />
              <span><b>Sepeti onayla</b><small>Online sipariş çok yakında hizmetinizde</small></span>
              <span className="soon-tag">Yakında</span>
            </div>
          )}
          {pub && <ShopWhatsApp items={items} strong={!orders} />}
          <p className="fine cs-note">{coming ? 'Şimdilik siparişinizi WhatsApp’tan gönderin, hemen dönüş yapalım.' : pub ? S.orders?.cargoNote || '' : S.shop.pickupNote}</p>
        </aside></div>
      </div>
      {ask && <Confirm title="Sepet temizlensin mi?" text={`Sepetteki ${items.length} ürün çıkarılacak.`} okLabel="Temizle" tone="danger" onOk={reset} onClose={() => setAsk(false)} />}
      {(orders || !pub) && <div className="cart-bar" aria-hidden="false">
        <span className="cart-bar-t"><small>{pub ? 'Toplam' : 'Toptan toplam'}</small><b className="num">{fmtTotals(tot)}</b></span>
        <button className="btn primary" onClick={onConfirm}><Icon n="check" s={18} />Sepeti onayla</button>
      </div>}
      {sheetP && <ProductSheet p={sheetP} viewOnly onClose={() => setSheetP(null)} />}
      {lb && <Lightbox urls={lb.urls} thumbs={lb.thumbs} title={lb.title} onClose={() => setLb(null)} />}
    </div>
  );
}

// ---- Mağaza: sepeti WhatsApp'tan liste linki olarak gönder (hiçbir yere kaydedilmez; ara sayfa yok)
function ShopWhatsApp({ items, strong }) {
  const S = useStore((s) => s.settings);
  const [no] = useState(newNo);
  const key = items.map((i) => i.id + ':' + i.qty).join(',');
  const link = useMemo(() => listLink(encodeList({ no, at: Date.now(), items: items.map(({ id, qty }) => ({ id, qty })) })), [no, key]);
  const wa = S.shop.whatsapp ? waLink(S.shop.whatsapp, link) : null;
  return (
    <div className="wa-row">
      {wa
        ? <a className={'btn wa-main ' + (strong ? 'wa' : 'wa-soft')} href={wa} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp’tan gönder</a>
        : <span className="btn wa-soft wa-main" aria-disabled="true"><Icon n="wa" s={16} />WhatsApp’tan gönder</span>}
      <button className="btn outline icon wa-copy" onClick={() => copyText(link, 'Liste linki kopyalandı, WhatsApp’ta yapıştırın')} aria-label="Liste linkini kopyala" title="Liste linkini kopyala"><Icon n="copy" s={15} /></button>
    </div>
  );
}

// ---- Bayi: sipariş ver (toptan fiyatlarla) — talepler koleksiyonuna type 'order' olarak yazılır;
// mağaza siparişlerine karışmaz, yönetimde "Bayi siparişleri"nde görünür. Fiyatı olmayan ürünlerin fiyatı sorulur.
// "Sadece fiyat sor" eski fiyat sorma talebidir (type 'quote').
function BayiSend({ items, onBack }) {
  const { settings: S, user } = useStore();
  const [no] = useState(newNo);
  const [deliv, setDeliv] = useState(() => ls.get('b2b-deliv', 'pickup'));
  const [pay, setPay] = useState(() => ls.get('b2b-pay', 'cash')); // eski 'transfer' seçimi düşer
  useEffect(() => { if (!B2B_PAY_PICK.includes(pay)) setPay('cash'); }, [pay]);
  const [pickup, setPickup] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const tot = totals(items, 'offer');
  const ask = items.filter((i) => i.offer == null).length;
  const at = useMemo(() => now(), []);
  const rec = { no, userName: user.shop || user.name, items, status: 'offered', createdAt: at, updatedAt: at };
  async function send(type, viaWA) {
    if (busy) return;
    const win = viaWA ? window.open('about:blank', '_blank') : null; // tarayıcı engellemesin diye pencere tıklamada açılır
    setBusy(true);
    try {
      const t = now(); const order = type === 'order';
      const head = order ? `Sipariş · ${B2B_DELIV[deliv]} · ${B2B_PAY[pay]}` : TYPE[type];
      const msgs = [{ from: 'system', text: `${head} · ${items.length} kalem · ${fmtTotals(tot)}${order && ask ? ` · ${ask} ürünün fiyatı sorulacak` : ''}`, at: t }];
      if (note.trim()) msgs.push({ from: 'user', text: note.trim(), at: t + 1 });
      const id = await api().createRequest({ no, type, status: 'new', items, note: note.trim(), pickup: order && deliv === 'pickup' ? pickup.trim() : '', ...(order ? { deliv, pay } : {}), createdAt: t, updatedAt: t + 1, unreadAdmin: 1, unreadUser: 0, lastMsg: note.trim() || head, lastFrom: 'user', uid: user.uid, userName: user.name || user.username, shop: user.shop || '' }, msgs);
      if (order) { ls.set('b2b-deliv', deliv); ls.set('b2b-pay', pay); }
      clearCart();
      if (viaWA) { const url = waLink(S.shop.whatsapp, `Merhaba, #${no} numaralı ${order ? 'siparişim' : 'fiyat sorum'}:\n${links.adminRequest(id)}`); if (win) win.location.href = url; else location.href = url; }
      toast(order ? 'Siparişiniz alındı, onaylanınca haber vereceğiz' : 'Fiyat sorunuz iletildi');
      openRequest(id);
    } catch (e) { win?.close(); toast('Gönderilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const Seg = ({ v, set, opts, label }) => (
    <div className="b2b-seg" role="radiogroup" aria-label={label}>
      {Object.entries(opts).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={v === k} className={v === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}
    </div>
  );
  return (
    <div className="page send-step b2b-send">
      <div className="send-bar">
        <button className="btn sm ghost" onClick={onBack}><Icon n="back" s={16} />Sepet</button>
        <div className="send-t"><b>Sipariş #{no}</b><span className="muted">{items.length} ürün · {fmtTotals(tot)}</span></div>
        <div className="send-btns">
          <button className="btn primary" disabled={busy} onClick={() => send('order')}><Icon n="check" s={16} />Siparişi gönder</button>
        </div>
      </div>
      <div className="send-opts">
        <div className="b2b-opt"><span className="field-l">Teslimat</span><Seg v={deliv} set={setDeliv} opts={B2B_DELIV} label="Teslimat" /></div>
        <div className="b2b-opt"><span className="field-l">Ödeme</span><Seg v={pay} set={setPay} opts={Object.fromEntries(B2B_PAY_PICK.map((k) => [k, B2B_PAY[k]]))} label="Ödeme" /></div>
        <div className="row2">
          {deliv === 'pickup' && S.requests.askPickupTime && <label className="field"><span className="field-l">Ne zaman gelirsiniz? <small className="opt">(isteğe bağlı)</small></span><input id="cart-pickup" placeholder="ör. Bugün 17:00, yarın sabah" value={pickup} onChange={(e) => setPickup(e.target.value)} /></label>}
          <label className="field"><span className="field-l">Not <small className="opt">(isteğe bağlı)</small></span><input id="cart-note" placeholder={deliv === 'cargo' ? 'ör. Kargo adresi değişti, …' : 'ör. Kutusuyla birlikte'} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        {ask > 0 && <div className="banner warn"><Icon n="tag" /><div><b>{ask} ürünün fiyatı sorulacak.</b> Fiyatları yazıp size bildireceğiz, onayınızdan sonra hazırlanır.</div></div>}
        <div className="b2b-send-btns">
          <button className="btn primary big" disabled={busy} onClick={() => send('order')}><Icon n="check" /><span><b>Siparişi gönder</b><small>{ask ? 'Fiyatı belli olanlar toptan fiyatla' : 'Toptan fiyatlarla'}</small></span></button>
          {S.requests.allowQuote && <button className="btn outline" disabled={busy} onClick={() => send('quote')}><Icon n="tag" s={16} />Sipariş vermeden fiyat sor</button>}
          {S.shop.whatsapp && <button className="btn ghost wa-txt" disabled={busy} onClick={() => send('order', true)}><Icon n="wa" s={17} />Gönder ve WhatsApp’tan haber ver</button>}
        </div>
        <p className="fine">Siparişiniz <b>Siparişlerim</b>’de görünür; durumunu ve mesajları oradan takip edebilirsiniz.</p>
      </div>
      <ListPaper r={rec} label="Sipariş" who={!!rec.userName} b2b />
    </div>
  );
}
