import { useState } from 'react';
import { useStore, setQty, clearCart, api, openRequest, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty, PhoneInput, phoneDigits, openMenu, copyText } from './ui.jsx';
import { waLink, links } from './route.js';
import { ls } from './utils.js';
import { fmt, priceFor, totals, fmtTotals, now } from './utils.js';
import { TYPE } from './config.js';

export function Cart() {
  const { cart, byId, settings: S, user, userPrices } = useStore();
  const [note, setNote] = useState('');
  const [pickup, setPickup] = useState('');
  const [busy, setBusy] = useState(false);
  const guest = user.role === 'public';
  const [g, setG] = useState(() => ls.get('guest-info', { name: '', phone: '' }));

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  const items = lines.map(({ p, qty }) => {
    const pr = priceFor(p, S, user, userPrices);
    return { id: p.id, k: p.k, n: p.n, cur: p.cur, qty, list: p.r, asked: pr.mine, offer: pr.mine };
  });
  const tList = totals(items, 'list');
  const tMine = totals(items, 'asked');
  const saving = Object.entries(tList).map(([c, v]) => [c, v - (tMine[c] || 0)]).filter(([, v]) => v > 0.001);

  // viaWA: talep kaydedilir + WhatsApp, dükkana hazır mesajla açılır (mesajdaki link talebi yönetim panelinde açar)
  async function send(type, viaWA) {
    if (!items.length) return;
    if (guest) {
      if (!g.name.trim()) return toast('Adınızı yazın', 'bad');
      if (phoneDigits(g.phone).length !== 11) return toast('Telefonunuzu 0(5xx) xxx xx xx şeklinde yazın', 'bad');
      ls.set('guest-info', g);
    }
    const win = viaWA ? window.open('about:blank', '_blank') : null; // tarayıcı engellemesin diye pencere tıklamada açılır
    setBusy(true);
    try {
      const t = now();
      const who = guest ? g.name.trim() : user.name || user.username;
      const msgs = [{ from: 'system', text: `${guest ? 'Vitrin sepeti' : TYPE[type]} · ${items.length} kalem · ${fmtTotals(tMine)}`, at: t }];
      if (note.trim()) msgs.push({ from: 'user', text: note.trim(), at: t + 1 });
      const base = { type, status: 'new', items, note: note.trim(), pickup: pickup.trim(), createdAt: t, updatedAt: t + 1, unreadAdmin: 1, unreadUser: 0, lastMsg: note.trim() || (guest ? 'Vitrin sepeti' : TYPE[type]), lastFrom: 'user' };
      const id = await api().createRequest(guest
        ? { ...base, guest: true, uid: null, gname: g.name.trim(), gphone: g.phone, userName: g.name.trim(), shop: 'Vitrin müşterisi' }
        : { ...base, uid: user.uid, userName: who, shop: user.shop || '' }, msgs);
      if (guest) ls.set('guest-reqs', [id, ...ls.get('guest-reqs', [])].slice(0, 30));
      clearCart(); setNote(''); setPickup('');
      if (viaWA) {
        const lines = items.map((i, k) => `${k + 1}) ${i.n} (${i.k}) × ${i.qty}${i.asked != null ? ' — ' + fmt(i.asked * i.qty, i.cur) : ''}`).join('\n');
        const text = `Merhaba, ${guest ? 'sitenizden sepet hazırladım' : (TYPE[type] + ' talebim')}:\n${lines}\nToplam: ${fmtTotals(tMine)}${note.trim() ? '\nNot: ' + note.trim() : ''}\n${who}${guest ? ' · ' + g.phone : user.shop ? ' · ' + user.shop : ''}\n\nTalebi aç: ${links.adminRequest(id)}`;
        const url = waLink(S.shop.whatsapp, text);
        if (win) win.location.href = url; else location.href = url;
      }
      toast(viaWA ? 'Talep kaydedildi, WhatsApp açılıyor' : type === 'reserve' ? 'Talebiniz iletildi, onay gelince haber vereceğiz' : 'Fiyat sorunuz iletildi');
      openRequest(id);
    } catch (e) { win?.close(); toast('Gönderilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const lineMenu = (e, p, qty) => openMenu(e, [
    { label: '1 tane daha', icon: 'plus', onClick: () => setQty(p.id, qty + 1) },
    qty > 1 && { label: '1 tane azalt', icon: 'minus', onClick: () => setQty(p.id, qty - 1) },
    { label: 'Sepetten çıkar', icon: 'trash', danger: true, onClick: () => setQty(p.id, 0) },
    '-',
    { label: 'Stok kodunu kopyala', icon: 'copy', hint: p.k, onClick: () => copyText(p.k) },
  ], p.n.slice(0, 40));

  if (!lines.length) {
    return (
      <div className="page narrow">
        <h1 className="page-t">Sepet</h1>
        <Empty icon="cart" title="Sepetiniz boş">
          <p>{guest ? 'Ürünleri sepete ekleyin, sonra tek tuşla WhatsApp’tan bize gönderin.' : 'Katalogdan ürün ekleyin; sonra ister “Hazırlayın, geliyorum” deyin, ister fiyat sorun.'}</p>
          <button className="btn primary" onClick={() => go('katalog')}>Kataloğa git</button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div className="cart-head">
        <h1 className="page-t">Sepet <span className="muted">· {lines.length} kalem</span></h1>
        <button className="link danger" onClick={clearCart}>Sepeti boşalt</button>
      </div>
      <div className="cart-grid">
        <ul className="clist">
          {lines.map(({ p, qty }, i) => {
            const it = items[i];
            return (
              <li key={p.id} className="cline" onContextMenu={(e) => lineMenu(e, p, qty)}>
                <Thumb p={p} size="sm" />
                <div className="cline-info">
                  <span className="prow-name">{p.n}</span>
                  <span className="prow-meta"><code>{p.k}</code>{S.pricing.showRetail && <span>Liste {fmt(p.r, p.cur)}</span>}</span>
                </div>
                <div className="cline-ctl">
                  <Stepper small value={qty} onChange={(v) => setQty(p.id, v)} />
                  <div className="cline-sum">
                    <span className="muted num">{it.asked == null ? 'Fiyat sorulacak' : `${qty} × ${fmt(it.asked, p.cur)}`}</span>
                    <b className="num">{it.asked == null ? '—' : fmt(it.asked * qty, p.cur)}</b>
                  </div>
                  <button className="icon-btn sm" onClick={() => setQty(p.id, 0)} aria-label="Kaldır"><Icon n="trash" s={16} /></button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="cart-sum">
          <div className="sum-rows">
            {S.pricing.showRetail && !guest && <div><span>Liste toplamı</span><span className="num">{fmtTotals(tList)}</span></div>}
            <div className="sum-total"><span>{guest ? 'Toplam' : 'Size toptan'}</span><b className="num">{fmtTotals(tMine)}</b></div>
            {S.pricing.showSaving && saving.length > 0 && <div className="sum-save"><span>Avantajınız</span><span className="num">{saving.map(([c, v]) => fmt(v, c)).join(' + ')}</span></div>}
          </div>
          {S.requests.askPickupTime && (
            <label className="field">
              <span className="field-l">Ne zaman gelirsiniz?</span>
              <input id="cart-pickup" placeholder="ör. Bugün 17:00, yarın sabah" value={pickup} onChange={(e) => setPickup(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span className="field-l">Not / mesaj</span>
            <textarea id="cart-note" rows="3" placeholder="ör. Hepsini alırsam son ne olur?" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {guest && (
            <div className="guest-fields">
              <label className="field"><span className="field-l">Adınız</span><input id="g-name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} autoComplete="name" /></label>
              <label className="field"><span className="field-l">Cep telefonunuz</span><PhoneInput id="g-phone" value={g.phone} onChange={(v) => setG({ ...g, phone: v })} /></label>
            </div>
          )}
          <div className="cart-actions">
            {(guest || S.shop.whatsapp) && (
              <button className="btn wa big" disabled={busy || (guest && !S.shop.whatsapp)} onClick={() => send('quote', true)}>
                <Icon n="wa" />
                <span><b>WhatsApp’tan gönder</b><small>{guest ? 'Sepetinizi bize iletin, fiyatı onaylayalım' : 'Talep kaydedilir, WhatsApp’tan da haber verilir'}</small></span>
              </button>
            )}
            {!guest && S.requests.allowReserve && (
              <button className="btn primary big" disabled={busy} onClick={() => send('reserve')}>
                <Icon n="check" />
                <span><b>Hazırlayın, geliyorum</b><small>Bu fiyatlarla ayırın</small></span>
              </button>
            )}
            {!guest && S.requests.allowQuote && (
              <button className="btn outline big" disabled={busy} onClick={() => send('quote')}>
                <Icon n="chat" />
                <span><b>Fiyat sor</b><small>Son ne olur? Teklif isteyin</small></span>
              </button>
            )}
          </div>
          {guest && !S.shop.whatsapp && <p className="err">Dükkan WhatsApp numarası henüz girilmemiş.</p>}
          <p className="fine">{guest ? 'Fiyatlar liste fiyatıdır. Size özel teklif WhatsApp’tan link olarak gelir; onaylayınca havale bilgisi görünür.' : S.shop.pickupNote}</p>
        </aside>
      </div>
    </div>
  );
}
