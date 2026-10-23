import { useState } from 'react';
import { useStore, setQty, clearCart, api, openRequest, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty } from './ui.jsx';
import { fmt, priceFor, totals, fmtTotals, now } from './utils.js';
import { TYPE } from './config.js';

export function Cart() {
  const { cart, byId, settings: S, user, userPrices } = useStore();
  const [note, setNote] = useState('');
  const [pickup, setPickup] = useState('');
  const [busy, setBusy] = useState(false);

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  const items = lines.map(({ p, qty }) => {
    const pr = priceFor(p, S, user, userPrices);
    return { id: p.id, k: p.k, n: p.n, cur: p.cur, qty, list: p.r, asked: pr.mine, offer: pr.mine };
  });
  const tList = totals(items, 'list');
  const tMine = totals(items, 'asked');
  const saving = Object.entries(tList).map(([c, v]) => [c, v - (tMine[c] || 0)]).filter(([, v]) => v > 0.001);

  async function send(type) {
    if (!items.length) return;
    setBusy(true);
    try {
      const t = now();
      const msgs = [{ from: 'system', text: `${TYPE[type]} · ${items.length} kalem · ${fmtTotals(tMine)}`, at: t }];
      if (note.trim()) msgs.push({ from: 'user', text: note.trim(), at: t + 1 });
      const id = await api().createRequest({
        uid: user.uid, userName: user.name || user.username, shop: user.shop || '', type, status: 'new', items, note: note.trim(), pickup: pickup.trim(),
        createdAt: t, updatedAt: t + 1, unreadAdmin: 1, unreadUser: 0, lastMsg: note.trim() || TYPE[type], lastFrom: 'user',
      }, msgs);
      clearCart(); setNote(''); setPickup('');
      toast(type === 'reserve' ? 'Talebiniz iletildi, onay gelince haber vereceğiz' : 'Fiyat sorunuz iletildi');
      openRequest(id);
    } catch (e) { toast('Gönderilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }

  if (!lines.length) {
    return (
      <div className="page narrow">
        <h1 className="page-t">Sepet</h1>
        <Empty icon="cart" title="Sepetiniz boş">
          <p>Katalogdan ürün ekleyin; sonra ister “Hazırlayın, geliyorum” deyin, ister fiyat sorun.</p>
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
              <li key={p.id} className="cline">
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
            {S.pricing.showRetail && <div><span>Liste toplamı</span><span className="num">{fmtTotals(tList)}</span></div>}
            <div className="sum-total"><span>Size toptan</span><b className="num">{fmtTotals(tMine)}</b></div>
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
          <div className="cart-actions">
            {S.requests.allowReserve && (
              <button className="btn primary big" disabled={busy} onClick={() => send('reserve')}>
                <Icon n="check" />
                <span><b>Hazırlayın, geliyorum</b><small>Bu fiyatlarla ayırın</small></span>
              </button>
            )}
            {S.requests.allowQuote && (
              <button className="btn outline big" disabled={busy} onClick={() => send('quote')}>
                <Icon n="chat" />
                <span><b>Fiyat sor</b><small>Son ne olur? Teklif isteyin</small></span>
              </button>
            )}
          </div>
          <p className="fine">{S.shop.pickupNote}</p>
        </aside>
      </div>
    </div>
  );
}
