// Yönetim paneli > Siparişler: online mağazadan (/magaza) gelen siparişler ve mağaza üyeleri.
// Sipariş: durum adımları (Onayla → Kargoya ver / Teslime hazır → Tamamlandı), müşteriye WhatsApp, kargo takip no, iç not.
import { useEffect, useMemo, useState } from 'react';
import { useStore, api, store, toast, openOrder, go } from './store.js';
import { Icon, Avatar, StatusPill, Empty, Sheet, Confirm, Field, PhoneInput, openMenu, copyText } from './ui.jsx';
import { fmt, totals, fmtTotals, when, now, norm } from './utils.js';
import { ORDER_STATUS, ORDER_OPEN, PAY, DELIVERY } from './config.js';
import { links, waLink } from './route.js';
import { ListPaper } from './listsheet.jsx';
import { pushStatus } from './push.js';
import { code128svg } from './barcode.js';
import { InvoiceText, addrLine, orderItems } from './checkout.jsx';

// Durum filtreleri: üstte renkli sayaç kutuları (bir bakışta ne kadar iş bekliyor), yanında Tümü / Tamamlanan / İptal
const FILTERS = [['open', 'Açık'], ['all', 'Tümü'], ['done', 'Tamamlanan'], ['cancelled', 'İptal']];
const WORK = [['new', 'Onay bekliyor', 'bell'], ['confirmed', 'Hazırlanacak', 'check'], ['preparing', 'Hazırlanıyor', 'box'], ['shipped', 'Kargoda', 'send'], ['ready', 'Teslime hazır', 'store']];
// yönetici listesindeki açıklama (müşteri metninden farklı)
export const ADMIN_ST = { new: 'Onay bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', shipped: 'Kargoda', ready: 'Teslime hazır', done: 'Tamamlandı', cancelled: 'İptal' };
const ago = (ts) => { const h = (Date.now() - ts) / 36e5; return h < 1 ? Math.max(1, Math.round(h * 60)) + ' dk' : h < 48 ? Math.round(h) + ' sa' : Math.round(h / 24) + ' gün'; };
const isPhone = () => matchMedia('(max-width: 700px)').matches;
const orderTotal = (o) => fmtTotals(o.total || totals(orderItems(o), 'offer'));
const custMsg = (o, S) => {
  const st = ORDER_STATUS[o.status]?.cust || '';
  const cargo = o.status === 'shipped' && o.cargo?.code ? `\nKargo: ${o.cargo.company || ''} ${o.cargo.code}` : '';
  return `Merhaba ${o.contact?.name || ''}, ${S.shop.name} · #${o.no} numaralı siparişiniz: ${st}.${cargo}\n${links.order(o.id)}`;
};

export function Orders() {
  const { orders, members, openOrder: openId, settings: S } = useStore();
  const [view, setView] = useState('orders');
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [sel, setSel] = useState(null); // çoklu seçim (Set) ya da kapalı
  const newN = orders.filter((o) => o.status === 'new').length;
  const cnt = useMemo(() => { const c = { open: 0 }; for (const o of orders) { c[o.status] = (c[o.status] || 0) + 1; if (ORDER_OPEN.includes(o.status)) c.open++; } return c; }, [orders]);
  const flow = useStatusFlow(S);
  useDhlSync(orders); // şube okuttuysa takip no'yu çek
  // listeden hızlı durum değiştirme
  const quick = (e, o) => openMenu({ preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation(), clientX: e.clientX, clientY: e.clientY, lp: isPhone() },
    [...['new', 'confirmed', 'preparing', o.delivery?.method === 'pickup' ? 'ready' : 'shipped', 'done'].map((k) => ({ label: (o.status === k ? '✓ ' : '') + ADMIN_ST[k] + (k === 'shipped' && o.status === 'shipped' ? ' · takip no düzenle' : ''), icon: { new: 'bell', confirmed: 'check', preparing: 'box', shipped: 'send', ready: 'store', done: 'check' }[k], onClick: () => flow.ask(o, k) })),
      '-', { label: 'İptal et', icon: 'x', danger: true, onClick: () => flow.ask(o, 'cancelled') }], '#' + o.no + ' · durum');
  const list = useMemo(() => {
    let r = orders;
    if (filter === 'open') r = r.filter((o) => ORDER_OPEN.includes(o.status));
    else if (filter !== 'all') r = r.filter((o) => o.status === filter);
    const t = norm(q.trim());
    if (t) r = r.filter((o) => norm([o.no, o.contact?.name, o.contact?.phone, o.contact?.email, o.invoice?.company].join(' ')).includes(t) || String(o.contact?.phone || '').replace(/\D/g, '').includes(t.replace(/\D/g, '') || '#'));
    return r;
  }, [orders, filter, q]);

  if (openId) return <OrderDetail id={openId} />;
  const toggle = (id) => setSel((x) => { const n = new Set(x); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const delMany = () => { const ids = [...sel]; setConfirm({ title: `${ids.length} siparişi sil`, text: 'Seçilen siparişler tamamen silinecek. Geri alınamaz.', okLabel: 'Sil', tone: 'danger', onOk: () => api().deleteOrders(ids).then(() => { toast(ids.length + ' sipariş silindi'); setSel(null); }, (e) => toast('Silinemedi: ' + e.message, 'bad')) }); };
  const del = (o) => setConfirm({ title: 'Siparişi sil', text: `#${o.no} numaralı sipariş tamamen silinecek. Geri alınamaz.`, okLabel: 'Sil', tone: 'danger', onOk: () => api().deleteOrders([o.id]).then(() => toast('Sipariş silindi'), (e) => toast('Silinemedi: ' + e.message, 'bad')) });
  const menu = (e, o) => openMenu(e, [
    { label: 'Aç', icon: 'eye', onClick: () => openOrder(o.id) },
    o.contact?.phone && { label: 'Müşteriye WhatsApp’tan yaz', icon: 'wa', onClick: () => window.open(waLink(o.contact.phone, custMsg(o, S)), '_blank', 'noopener') },
    { label: 'Müşterinin takip linkini kopyala', icon: 'copy', onClick: () => copyText(links.order(o.id), 'Takip linki kopyalandı') },
    '-',
    { label: 'Seç', icon: 'check', onClick: () => setSel(new Set([o.id])) },
    { label: 'Siparişi sil', icon: 'trash', danger: true, onClick: () => del(o) },
  ], '#' + o.no);

  return (
    <div className="page orders-page">
      <div className="page-h">
        <h1 className="page-t">Mağaza siparişleri{newN > 0 && <span className="muted"> · {newN} yeni</span>}</h1>
        <span className="row-btns">
          {view === 'orders' && orders.length > 0 && <button className={'btn sm ' + (sel ? 'primary' : 'outline')} onClick={() => setSel(sel ? null : new Set())}><Icon n="check" s={15} />{sel ? 'Seçimi kapat' : 'Seç'}</button>}
          <button className="btn sm outline" onClick={() => copyText(links.shop(), 'Mağaza linki kopyalandı')}><Icon n="copy" s={15} />Mağaza linki</button>
        </span>
      </div>
      {view === 'members' ? <Members /> : <>
        <div className="toolbar">
          <div className="search"><Icon n="search" s={18} /><input id="ord-search" type="search" placeholder="Sipariş no, ad, telefon…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="chips">
            {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}{k === 'open' ? ` (${cnt.open})` : ''}</button>)}
          </div>
        </div>
        <div className="osum" role="tablist" aria-label="Duruma göre">
          {WORK.filter(([k]) => k !== 'ready' || cnt.ready > 0).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={'osum-i ost-' + k + (filter === k ? ' on' : '') + (cnt[k] ? '' : ' zero')} onClick={() => setFilter(filter === k ? 'open' : k)}>
              <b className="num">{cnt[k] || 0}</b><span><i className="sdot" />{l}</span>
            </button>
          ))}
        </div>
        {sel && (
          <div className="sel-bar">
            <label className="mini-check"><input type="checkbox" checked={list.length > 0 && list.every((o) => sel.has(o.id))} onChange={(e) => setSel(e.target.checked ? new Set(list.map((o) => o.id)) : new Set())} />Tümü ({list.length})</label>
            <span className="muted">{sel.size} seçili</span>
            <button className="btn sm danger" disabled={!sel.size} onClick={delMany}><Icon n="trash" s={15} />Seçilenleri sil</button>
          </div>
        )}
        {list.length === 0 ? (
          <Empty icon="box" title={orders.length ? 'Bu filtrede sipariş yok' : 'Henüz mağaza siparişi yok'}>
            {!orders.length && <p>Müşteriler <b>/magaza</b>’da sepeti onaylayıp siparişi tamamlayınca burada görünür.</p>}
          </Empty>
        ) : (
          <div className="otable">
            <div className="otable-h" aria-hidden="true"><span>Sipariş</span><span>Müşteri</span><span>Ödeme / teslimat</span><span>Tutar</span><span>Tarih</span><span>Durum</span><span /></div>
            {groups(list, filter).map(([g, rows]) => (
              <section key={g || 'x'} className="ogroup">
                {g && <h3 className={'ogroup-h ost-' + g}><i className="sdot" />{GROUP_T[g]}<span className="num">{rows.length}</span></h3>}
                <ul className="olist orows">
                  {rows.map((o) => {
                    const noCode = o.status === 'shipped' && o.delivery?.method !== 'pickup' && !o.cargo?.code;
                    const late = o.status === 'new' && Date.now() - o.createdAt > 2 * 36e5;
                    const act = nextAct(o, noCode);
                    return (
                      <li key={o.id} onContextMenu={(e) => menu(e, o)}>
                        <div role="button" tabIndex={0} className={'orow st-' + o.status + (flow.flash === o.id ? ' flash' : '') + (o.unread ? ' unread' : '') + (sel?.has(o.id) ? ' picked' : '')} onClick={() => (sel ? toggle(o.id) : openOrder(o.id))} onKeyDown={(e) => e.key === 'Enter' && (sel ? toggle(o.id) : openOrder(o.id))}>
                          {sel && <span className={'ocheck' + (sel.has(o.id) ? ' on' : '')} aria-hidden="true"><Icon n="check" s={14} /></span>}
                          <span className="or-no">{o.unread ? <span className="dot-new" aria-label="Yeni" /> : null}<b className="num">#{o.no}</b></span>
                          <span className="or-who"><b>{o.contact?.name}</b><small>{o.invoice?.type === 'company' && o.invoice.company ? o.invoice.company : o.contact?.phone || ''}</small></span>
                          <span className="or-tags">
                            <span className="otag">{PAY_SHORT[o.pay] || PAY[o.pay] || '—'}</span>
                            <span className="otag">{o.delivery?.method === 'pickup' ? 'Dükkândan' : (o.cargo?.company || 'Kargo') + (o.delivery?.addr?.city ? ' · ' + o.delivery.addr.city : '')}</span>
                            {o.member && <span className="otag">Üye</span>}{needsInvoice(o.invoice) && <span className="otag inv"><Icon n="check" s={11} />Fatura</span>}
                          </span>
                          <span className="or-sum"><b className="num">{orderTotal(o)}</b><small>{(o.items || []).length} ürün</small></span>
                          <span className="or-date"><span>{when(o.createdAt)}</span>{late && <small className="late">{ago(o.createdAt)} bekliyor</small>}</span>
                          <span className="or-st">
                            <button type="button" className={'ost ost-' + o.status} onClick={(e) => { e.stopPropagation(); if (!sel) quick(e, o); }} title="Durumu değiştir"><i className="sdot" />{ADMIN_ST[o.status] || o.status}<Icon n="chev" s={13} /></button>
                            {noCode && <small className="warn-t">Takip no yok</small>}
                          </span>
                          <span className="or-act">{act && !sel && <button type="button" className={'btn sm ' + act[3]} onClick={(e) => { e.stopPropagation(); flow.ask(o, act[0]); }}><Icon n={act[2]} s={14} />{act[1]}</button>}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </>}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
      {flow.sheets}
    </div>
  );
}
const PAY_SHORT = { havale: 'Havale/EFT', card: 'Kart (link)', shop: 'Dükkânda' };
// satırdaki tek tıkla sıradaki adım (en çok iş gerektiren belirgin: Onayla)
const nextAct = (o, noCode) => ({
  new: ['confirmed', 'Onayla', 'check', 'primary'],
  confirmed: ['preparing', 'Hazırlamaya başla', 'box', 'outline'],
  preparing: o.delivery?.method === 'pickup' ? ['ready', 'Teslime hazır', 'store', 'outline'] : ['shipped', 'Kargoya ver', 'send', 'outline'],
  shipped: noCode ? ['shipped', 'Takip no ekle', 'box', 'outline warn'] : ['done', 'Teslim edildi', 'check', 'ghost'],
  ready: ['done', 'Teslim edildi', 'check', 'ghost'],
}[o.status] || null);
// Açık / Tümü görünümünde duruma göre gruplar (iş sırası); tek durum seçiliyse grup başlığı yok
const GROUP_T = { new: 'Onay bekleyen', confirmed: 'Hazırlanacak', preparing: 'Hazırlanıyor', ready: 'Teslime hazır', shipped: 'Kargoda', done: 'Tamamlanan', cancelled: 'İptal' };
const groups = (list, filter) => (filter === 'open' || filter === 'all')
  ? ['new', 'confirmed', 'preparing', 'ready', 'shipped', 'done', 'cancelled'].map((g) => [g, list.filter((o) => o.status === g)]).filter(([, r]) => r.length)
  : [[null, list]];

// ---- Durum değiştirme (liste ve detay ortak): onay penceresi, kargo bilgisi penceresi ----
// Kargoda iken takip no sonradan eklenebilir/düzeltilebilir: durum değişmez, müşteriye sadece takip no ile tek bildirim gider.
function useStatusFlow(S) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [ship, setShip] = useState(null); // { o, company, code }
  const [flash, setFlash] = useState(null); // durumu az önce değişen sipariş (listede kısa süre parlar)
  async function setStatus(o, s, extra = {}) {
    setBusy(true);
    try {
      const t = now();
      await api().updateOrder(o.id, { status: s, updatedAt: t, history: [...(o.history || []), { s, at: t, by: 'admin' }], ...extra });
      toast(`#${o.no} → ${ADMIN_ST[s] || ORDER_STATUS[s].label}`); setFlash(o.id); setTimeout(() => setFlash(null), 1600);
      if (api().mode === 'firebase') pushStatus(o.id); // müşteriye bildirim (açtıysa)
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const openShip = (o) => setShip({ o, company: o.cargo?.company || S.orders?.cargoCompany || (S.orders?.cargoCompanies || [])[0] || '', code: o.cargo?.code || '' });
  function ask(o, k) {
    if (k === 'shipped') return openShip(o);
    if (o.status === k) return;
    if (k === 'cancelled') return setConfirm({ title: 'Siparişi iptal et', text: `#${o.no} iptal edilecek. Müşteri takip sayfasında “İptal edildi” görür.`, okLabel: 'İptal et', tone: 'danger', onOk: () => setStatus(o, 'cancelled') });
    setConfirm({ title: ADMIN_ST[k], text: `#${o.no} “${ORDER_STATUS[k].label}” olarak işaretlensin mi? Müşteri takip sayfasında görür${S.orders?.push !== false && k !== 'new' ? ', bildirimleri açtıysa telefonuna bildirim gider' : ''}.`, okLabel: 'Evet, değiştir', onOk: () => setStatus(o, k) });
  }
  async function saveShip() {
    const { o } = ship; const c = { company: ship.company.trim(), code: ship.code.trim() };
    setShip(null);
    if (o.status !== 'shipped') return setStatus(o, 'shipped', { cargo: c });
    if (c.company === (o.cargo?.company || '') && c.code === (o.cargo?.code || '')) return;
    try {
      await api().updateOrder(o.id, { cargo: c, updatedAt: now() });
      toast('Kargo bilgisi kaydedildi');
      if (c.code && api().mode === 'firebase') pushStatus(o.id); // takip no eklendi/değişti: tek bildirim
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
  }
  const sheets = <>
    {ship && (
      <Sheet title={ship.o.status === 'shipped' ? 'Kargo bilgisi' : 'Kargoya verildi'} sub={ship.o.status === 'shipped' ? `#${ship.o.no} · durum değişmez, sadece kargo bilgisi güncellenir` : 'Takip numarası müşterinin sipariş sayfasında görünür'} onClose={() => setShip(null)}
        footer={<><button className="btn ghost" onClick={() => setShip(null)}>Vazgeç</button><button className="btn primary" disabled={busy} onClick={saveShip}><Icon n="check" s={16} />{ship.o.status === 'shipped' ? 'Kaydet' : 'Kargoya verildi'}</button></>}>
        <div className="form-col">
          <div className="field"><span className="field-l">Kargo firması</span>
            <div className="cargo-pick">{(S.orders?.cargoCompanies || []).map((c) => <button key={c} type="button" className={'chip' + (ship.company === c ? ' on' : '')} onClick={() => setShip({ ...ship, company: c })}>{c}</button>)}</div>
            <input id="ship-co" value={ship.company} onChange={(e) => setShip({ ...ship, company: e.target.value })} placeholder="Listede yoksa yazın" />
            <span className="field-h">Listeyi Ayarlar &gt; Online mağaza &gt; Kargo firmaları’ndan düzenleyebilirsiniz.</span>
          </div>
          <Field label="Takip numarası" opt hint={ship.code.trim() ? undefined : 'Şimdi bilmiyorsanız boş bırakın; sonra listede “Takip no yok” yazar, oradan ekleyebilirsiniz.'}><input id="ship-code" inputMode="text" value={ship.code} onChange={(e) => setShip({ ...ship, code: e.target.value })} /></Field>
        </div>
      </Sheet>
    )}
    {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
  </>;
  return { busy, ask, setStatus, openShip, sheets, flash };
}

// Geçerli vergi no (10 hane, VKN algoritması) ya da TC kimlik no (11 hane, algoritma) girilmişse fatura kesilmesi gerekir
export function vknOk(v) {
  const d = String(v || '').replace(/\D/g, ''); if (d.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) { const t = (Number(d[i]) + 9 - i) % 10; let x = (t * 2 ** (9 - i)) % 9; if (t !== 0 && x === 0) x = 9; sum += x; }
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}
export function tcOk(v) {
  const d = String(v || '').replace(/\D/g, ''); if (d.length !== 11 || d[0] === '0') return false;
  const n = d.split('').map(Number);
  const c10 = ((n[0] + n[2] + n[4] + n[6] + n[8]) * 7 - (n[1] + n[3] + n[5] + n[7])) % 10;
  return ((c10 + 10) % 10) === n[9] && n.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === n[10];
}
export const needsInvoice = (inv) => !!inv && (inv.type === 'company' ? vknOk(inv.taxNo) || tcOk(inv.taxNo) : tcOk(inv.tc));
// eksiksiz fatura: geçerli vergi / TC no + (kurumsalda unvan ve vergi dairesi) + adres → yeşil çerçeveli kart
export const fullInvoice = (inv, deliv) => needsInvoice(inv) && (inv.type !== 'company' || (inv.company && inv.taxOffice)) && !!(inv.addr?.address || (inv.same !== false && deliv?.address));

const invoiceCopy = (o) => { const i = o.invoice || {}; const a = i.addr || o.delivery?.addr || {}; return [i.type === 'company' ? [i.company, i.taxOffice, i.taxNo].filter(Boolean).join(' / ') : [o.contact?.name, i.tc && 'TC ' + i.tc].filter(Boolean).join(' / '), a.address, ['Türkiye', a.city, a.district].filter(Boolean).join(' / '), o.contact?.phone].filter(Boolean).join('\n'); };
// ---- Sipariş detayı ---------------------------------------------------------------------------
function OrderDetail({ id }) {
  const { orders, settings: S } = useStore();
  const fromList = orders.find((o) => o.id === id);
  const [one, setOne] = useState(undefined);
  const o = fromList || one;
  const flow = useStatusFlow(S);
  const busy = flow.busy;
  const [confirm, setConfirm] = useState(null);
  const [note, setNote] = useState(null);
  // listede yoksa (eski sipariş / linkten gelindi) tek başına getir
  useEffect(() => { if (fromList) return; const un = api().watchOrder(id, setOne); return () => un && un(); }, [id, !!fromList]);
  useEffect(() => { if (o?.unread) api().updateOrder(o.id, { unread: 0 }).catch(() => {}); }, [o?.id, o?.unread]);
  useEffect(() => { if (o && note == null) setNote(o.adminNote || ''); }, [o?.id]);
  const back = () => store.set({ openOrder: null });
  if (o === null) return <div className="page narrow"><Empty icon="search" title="Sipariş bulunamadı"><button className="btn primary" onClick={back}>Siparişlere dön</button></Empty></div>;
  if (!o) return <div className="page narrow list-wait"><div className="spinner" aria-label="Yükleniyor" /></div>;

  const items = orderItems(o);
  const pickup = o.delivery?.method === 'pickup';
  const nextMap = { new: ['confirmed', 'Siparişi onayla', 'check'], confirmed: ['preparing', 'Hazırlamaya başla', 'box'], preparing: pickup ? ['ready', 'Teslime hazır', 'store'] : ['shipped', 'Kargoya verildi', 'box'], shipped: ['done', 'Teslim edildi', 'check'], ready: ['done', 'Teslim edildi', 'check'] };
  const next = nextMap[o.status];
  const wa = o.contact?.phone ? waLink(o.contact.phone, custMsg(o, S)) : null;
  const goNext = () => flow.ask(o, next[0]);
  const del = () => setConfirm({ title: 'Siparişi sil', text: `#${o.no} tamamen silinecek. Geri alınamaz.`, okLabel: 'Sil', tone: 'danger', onOk: () => api().deleteOrders([o.id]).then(() => { toast('Sipariş silindi'); back(); }) });
  const saveNote = () => api().updateOrder(o.id, { adminNote: note.trim() }).then(() => toast('Not kaydedildi'), (e) => toast('Kaydedilemedi: ' + e.message, 'bad'));

  return (
    <div className="page order-page admin-order">
      <div className="send-bar">
        <button className="btn sm ghost" onClick={back}><Icon n="back" s={16} />Siparişler</button>
        <div className="send-t"><b>Sipariş #{o.no}</b><span className="muted">{when(o.createdAt)} · {items.length} ürün · {orderTotal(o)}</span></div>
        <span className="pay-chip" title={o.pay === 'card' ? 'Onaylayınca müşteriye ödeme linki gönderin' : 'Ödeme yöntemi'}><Icon n={o.pay === 'shop' ? 'store' : 'tag'} s={13} />{PAY[o.pay] || '—'}</span>
        <StatusPill status={o.status} map={ORDER_STATUS} />
      </div>

      <div className="oa-status" role="radiogroup" aria-label="Sipariş durumu">
        <span className="oa-status-l">Durum:</span>
        {['new', 'confirmed', 'preparing', 'shipped', 'ready', 'done', 'cancelled'].map((k) => (
          <button key={k} role="radio" aria-checked={o.status === k} disabled={busy} className={'oa-st tone-' + ORDER_STATUS[k].tone + (o.status === k ? ' on' : '')}
            onClick={() => flow.ask(o, k)}>
            {o.status === k && <Icon n="check" s={14} />}{ORDER_STATUS[k].label}
          </button>
        ))}
      </div>
      <div className="oa-actions">
        {wa && <a className="btn wa" href={wa} target="_blank" rel="noopener"><Icon n="wa" s={16} />Müşteriye yaz</a>}
        <button className="btn outline" onClick={() => copyText(links.order(o.id), 'Müşterinin takip linki kopyalandı')}><Icon n="copy" s={15} />Takip linki</button>
        <span className="oa-sp" />
        <button className="icon-btn" onClick={del} aria-label="Siparişi sil" title="Siparişi sil"><Icon n="trash" s={17} /></button>
      </div>

      <ol className="track admin" aria-label="Sipariş durumu">
        {['new', 'confirmed', 'preparing', pickup ? 'ready' : 'shipped', 'done'].map((k, i, arr) => {
          const cur = arr.indexOf(o.status);
          const h = (o.history || []).filter((x) => x.s === k).pop();
          return <li key={k} className={o.status === 'cancelled' ? '' : i < cur ? 'done' : i === cur ? 'on' : ''}><span className="track-dot">{i < cur && o.status !== 'cancelled' ? <Icon n="check" s={14} /> : i + 1}</span><span>{ORDER_STATUS[k].label}{h && <small>{when(h.at)}</small>}</span></li>;
        })}
      </ol>
      {o.status === 'shipped' && (o.cargo?.code
        ? <div className="banner ok"><Icon n="box" /><div><b>Kargo:</b> {o.cargo.company} · <span className="num">{o.cargo.code}</span> <button className="link" onClick={() => flow.openShip(o)}>Değiştir</button></div></div>
        : <div className="banner warn"><Icon n="box" /><div><b>Takip numarası girilmedi.</b> {o.cargo?.company || ''} <button className="btn sm primary" onClick={() => flow.openShip(o)}>Takip no ekle</button></div></div>)}

      <div className="o-info">
        <div className="o-card">
          <h3>Müşteri {o.member && <span className="tag">Üye</span>}<button className="oc-copy" onClick={() => copyText([o.contact?.name, o.contact?.phone, o.contact?.email].filter(Boolean).join('\n'), 'Müşteri bilgisi kopyalandı')} title="Müşteri bilgisini kopyala" aria-label="Müşteri bilgisini kopyala"><Icon n="copy" s={15} /></button></h3>
          <p><b>{o.contact?.name}</b></p>
          {o.contact?.phone && <p><a className="num" href={'tel:' + o.contact.phone.replace(/\D/g, '')}>{o.contact.phone}</a></p>}
          {o.contact?.email && <p><a href={'mailto:' + o.contact.email}>{o.contact.email}</a></p>}
        </div>
        <div className="o-card">
          <h3>Teslimat{o.delivery?.addr && <button className="oc-copy" onClick={() => copyText(`${o.delivery.addr.name || o.contact?.name}\n${o.delivery.addr.phone || o.contact?.phone}\n${addrLine(o.delivery.addr)}`, 'Kargo için adres kopyalandı')} title="Adresi kopyala (kargo için)" aria-label="Adresi kopyala"><Icon n="copy" s={15} /></button>}</h3>
          <p><b>{DELIVERY[o.delivery?.method] || ''}</b></p>
          {o.delivery?.addr && <>{(o.delivery.addr.name || o.delivery.addr.phone) && <p><b>{o.delivery.addr.name}</b>{o.delivery.addr.phone && <> · <span className="num">{o.delivery.addr.phone}</span></>}</p>}<p>{addrLine(o.delivery.addr)}</p></>}
        </div>
        {fullInvoice(o.invoice, o.delivery?.addr)
          ? <div className="o-card inv-full"><h3>Fatura bilgileri<span className="inv-ok" title="Fatura kesilecek"><Icon n="check" s={13} /></span><button className="oc-copy" onClick={() => copyText(invoiceCopy(o), 'Fatura bilgileri kopyalandı')} title="Kopyala" aria-label="Fatura bilgilerini kopyala"><Icon n="copy" s={15} /></button></h3><InvoiceText inv={o.invoice} name={o.contact?.name} deliv={o.delivery?.addr} phone={o.contact?.phone} /></div>
          : <div className={'o-card' + (needsInvoice(o.invoice) ? ' inv-yes' : '')}><h3>Fatura{needsInvoice(o.invoice) && <span className="tag ok">Vergi no geçerli · adres eksik</span>}</h3><InvoiceText inv={o.invoice} name={o.contact?.name} deliv={o.delivery?.addr} phone={o.contact?.phone} /></div>}
      </div>
      {o.note && <p className="o-note"><b>Müşterinin notu:</b> {o.note}</p>}
      {o.delivery?.method !== 'pickup' && o.status !== 'cancelled' && <DhlCard o={o} />}

      <ListPaper r={{ no: o.no, gname: o.contact?.name, items, status: 'priced', createdAt: o.createdAt, updatedAt: o.createdAt, rate: o.rate ? { usd: o.rate, src: 'harem' } : null }} label="Sipariş" viewOnly />

      <div className="set-card">
        <Field label="İç not" hint="Sadece siz görürsünüz"><textarea id="oa-note" rows="2" value={note ?? ''} onChange={(e) => setNote(e.target.value)} placeholder="ör. Kargo ücreti 150 TL, ödeme bekleniyor" /></Field>
        {(note ?? '') !== (o.adminNote || '') && <button className="btn sm primary" onClick={saveNote}><Icon n="check" s={15} />Notu kaydet</button>}
      </div>

      {flow.sheets}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ---- Mağaza üyeleri -----------------------------------------------------------------------------
export function Members() {
  const { members, orders } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const count = useMemo(() => { const m = {}; for (const o of orders) if (o.uid) m[o.uid] = (m[o.uid] || 0) + 1; return m; }, [orders]);
  const t = norm(q.trim());
  const list = [...members].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).filter((m) => !t || norm([m.name, m.email, m.phone, m.invoice?.company].join(' ')).includes(t));
  const del = (m) => setConfirm({ title: 'Üyeyi sil', text: `${m.name || m.email} üyeliği silinecek (siparişleri kalır). Aynı e-postayla yeniden üye olamaz; gerekirse Firebase’den hesabı da silin.`, okLabel: 'Sil', tone: 'danger', onOk: () => api().deleteMember(m.uid).then(() => { toast('Üye silindi'); setOpen(null); }) });
  return (
    <>
      <div className="mem-bar">
        <div className="search"><Icon n="search" s={18} /><input id="mem-search" type="search" placeholder="Ad, e-posta, telefon…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="btn primary" onClick={() => setNewOpen(true)}><Icon n="plus" s={16} />Yeni üye</button>
      </div>
      {list.length === 0 ? <Empty icon="users" title={members.length ? 'Eşleşen üye yok' : 'Henüz mağaza üyesi yok'}>{!members.length && <p>Müşteriler mağazada <b>Hesabım</b>’dan ya da sipariş verirken üye olabilir.</p>}</Empty> : (
        <ul className="olist">
          {list.map((m) => (
            <li key={m.uid}>
              <button className="ocard" onClick={() => setOpen(m)}>
                <Avatar u={m} size={38} />
                <span className="ocard-b">
                  <span className="ocard-who"><b>{m.name || '—'}</b>{m.invoice?.company ? ` · ${m.invoice.company}` : ''}</span>
                  <span className="muted">{[m.email, m.phone].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="muted ocard-sum">{count[m.uid] || 0} sipariş</span>
                <Icon n="back" s={16} className="flip" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <Sheet title={open.name || open.email} sub={`Üye · ${when(open.createdAt)}`} onClose={() => setOpen(null)} footer={<><button className="btn ghost danger" onClick={() => del(open)}><Icon n="trash" s={15} />Üyeyi sil</button>{open.phone && <a className="btn wa" href={waLink(open.phone, `Merhaba ${open.name || ''},`)} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp</a>}</>}>
          <div className="o-info one">
            <div className="o-card"><h3>İletişim</h3>{open.username && <p>Kullanıcı adı: <b>{open.username}</b></p>}<p>{open.email}</p>{open.phone && <p className="num">{open.phone}</p>}</div>
            <div className="o-card"><h3>Fatura</h3><InvoiceText inv={open.invoice} name={open.name} /></div>
            <div className="o-card"><h3>Adresler</h3>{(open.addresses || []).length ? open.addresses.map((a) => <p key={a.id}><b>{a.title || 'Adres'}:</b> {addrLine(a)}</p>) : <p className="muted">Kayıtlı adres yok</p>}</div>
          </div>
          <h3 className="sheet-h3">Siparişleri</h3>
          <ul className="olist">
            {orders.filter((o) => o.uid === open.uid).map((o) => (
              <li key={o.id}><button className="ocard" onClick={() => { setOpen(null); openOrder(o.id); }}><span className="ocard-b"><span className="ocard-top"><b className="num">#{o.no}</b><StatusPill status={o.status} map={ORDER_STATUS} /></span><span className="muted">{when(o.createdAt)}</span></span><b className="num ocard-sum">{orderTotal(o)}</b></button></li>
            ))}
            {!count[open.uid] && <li className="muted">Henüz sipariş yok</li>}
          </ul>
        </Sheet>
      )}
      {newOpen && <NewMember onClose={() => setNewOpen(false)} />}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </>
  );
}

// Panelden yeni mağaza üyesi: e-posta doğrulaması beklemeden giriş yapabilir
function NewMember({ onClose }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', username: '', pw: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  async function save() {
    setErr('');
    const email = f.email.trim().toLowerCase();
    const username = norm(f.username).replace(/[^a-z0-9._-]/g, '').slice(0, 20);
    if (f.name.trim().length < 2) return setErr('Adı yazın.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setErr('E-posta adresi geçersiz.');
    if (username && username.length < 3) return setErr('Kullanıcı adı en az 3 karakter olmalı.');
    if (f.pw.length < 6) return setErr('Şifre en az 6 karakter olmalı.');
    setBusy(true);
    try { await api().adminCreateMember({ email, password: f.pw, name: f.name.trim(), phone: f.phone, username: username || undefined }); toast('Üye hesabı açıldı'); onClose(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (
    <Sheet title="Yeni mağaza üyesi" sub="Hesap hemen açılır; e-posta doğrulaması gerekmez" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Vazgeç</button><button className="btn primary" disabled={busy} onClick={save}><Icon n="check" s={16} />{busy ? 'Açılıyor…' : 'Hesabı aç'}</button></>}>
      <div className="form-col">
        <Field label="Ad soyad"><input id="nm-name" value={f.name} onChange={set('name')} /></Field>
        <div className="row2">
          <Field label="E-posta"><input id="nm-email" type="email" autoCapitalize="none" value={f.email} onChange={set('email')} /></Field>
          <Field label="Cep telefonu" opt><PhoneInput id="nm-phone" value={f.phone} onChange={set('phone')} /></Field>
        </div>
        <div className="row2">
          <Field label="Kullanıcı adı" opt hint="E-posta yerine bununla da girer"><input id="nm-user" autoCapitalize="none" value={f.username} onChange={set('username')} /></Field>
          <Field label="Şifre" hint="En az 6 karakter; müşteriye siz iletirsiniz"><input id="nm-pw" value={f.pw} onChange={set('pw')} /></Field>
        </div>
        {err && <p className="err">{err}</p>}
      </div>
    </Sheet>
  );
}

// ---- DHL eCommerce kartı: "A6 barkod bas" → sipariş DHL'e kaydedilir (online şube > Toplu Gönderi Listesi'ne düşer) ve
// DHL'in "Siparişten Gönderi Hazırlama Barkodu" kâğıdının aynısı basılır. Büyük barkod = referans (ERTEL<no>); şube okutunca
// gönderi oluşur, takip no (DHL takip görevi / bu kart açılınca) kendiliğinden siparişe yazılır → "Kargoda" + müşteriye bildirim.
const dhlW = () => (window.WATCH_URL || '').replace(/\/$/, '');
async function dhlCall(act, body) {
  const token = await api().idToken?.();
  const r = await fetch(dhlW() + '/dhl/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...body }) });
  return r.json();
}
// takip no geldiyse siparişe yaz (durum Kargoda) ve müşteriye bildir
async function dhlApply(o, x) {
  if (!x?.found) return false;
  const dhl = { ...o.dhl, statu: x.statu, text: x.text, checked: now() };
  if (!x.code) { if (x.text !== o.dhl?.text) await api().updateOrder(o.id, { dhl }).catch(() => {}); return false; }
  const t = now(); const cargo = { company: 'DHL', code: x.code, url: x.url || `https://kargotakip.dhlecommerce.com.tr/?takipNo=${x.code}` };
  const upd = { cargo, dhl, updatedAt: t };
  if (o.status !== 'shipped' && o.status !== 'done') { upd.status = 'shipped'; upd.history = [...(o.history || []), { s: 'shipped', at: t, by: 'dhl' }]; }
  await api().updateOrder(o.id, upd);
  if (api().mode === 'firebase') pushStatus(o.id);
  return true;
}
// yönetim paneli açılınca: takip no bekleyen DHL siparişlerini topluca sor (cihazda 5 dakikada bir)
export function useDhlSync(orders) {
  useEffect(() => {
    if (!dhlW() || api().mode !== 'firebase') return;
    const wait = (orders || []).filter((o) => o.dhl?.ref && !o.dhl.cancelled && !o.cargo?.code && ORDER_OPEN.includes(o.status));
    if (!wait.length) return;
    try { if (Date.now() - Number(sessionStorage.getItem('dhl-sync') || 0) < 5 * 60e3) return; sessionStorage.setItem('dhl-sync', String(Date.now())); } catch {}
    dhlCall('sync', { refs: wait.map((o) => o.dhl.ref) }).then(async (j) => {
      let n = 0; for (const o of wait) if (await dhlApply(o, j?.items?.[o.dhl.ref]).catch(() => false)) n++;
      if (n) toast(`DHL: ${n} siparişin takip numarası geldi, “Kargoda” yapıldı`);
    }).catch(() => {});
  }, [orders?.length]);
}
// Etiket: DHL'in kendi çıktısıyla aynı düzen, 4×6 inç (A6). Barkod içeriği = referans.
export function dhlLabelHtml(o, S) {
  const d = o.dhl || {}; const a = o.delivery?.addr || {};
  const e = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const up = (x) => String(x || '').toLocaleUpperCase('tr-TR');
  const from = S.footer?.company || S.shop?.name || S.brand?.appName || 'ERTEL GSM';
  const date = new Date(d.at || Date.now()).toLocaleDateString('tr-TR');
  const big = code128svg(d.ref, { h: 80, mod: 2, quiet: 8 }); const small = code128svg(d.ref, { h: 34, mod: 1, quiet: 4 });
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>DHL ${e(d.ref)}</title><style>
  @page{size:4in 6in;margin:0} *{box-sizing:border-box} body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000}
  .lb{width:4in;height:6in;padding:.16in .14in;display:flex;flex-direction:column;gap:.06in;overflow:hidden}
  .t1{text-align:center;font-weight:700;font-size:8.2px} .t2{text-align:center;font-size:6.6px;line-height:1.3;margin-top:-2px}
  .hd{display:grid;grid-template-columns:.62in 1fr .9in;align-items:center;gap:4px}
  .logo{background:#ffcc00;width:.5in;height:.34in;display:grid;place-items:center;color:#d40511;font:900 italic 12px/1 Arial;letter-spacing:-.02em}
  .bc{display:flex;flex-direction:column;align-items:center} .bc svg{width:2.1in;height:.5in} .bc code{font:700 9px/1.2 'Courier New',monospace;letter-spacing:.06em}
  .dt{text-align:right;font-size:9px;font-weight:700;display:flex;flex-direction:column;gap:10px} .dt b{font-size:10px}
  .bx{border:1.2px solid #000} .bx h4{margin:0;padding:3px 6px;font-size:9.5px;border-bottom:1.2px solid #000;display:flex;justify-content:space-between}
  table{width:100%;border-collapse:collapse;font-size:7.6px} td{padding:2px 6px;vertical-align:top} td.k{font-weight:700;white-space:nowrap;width:.95in}
  .rcv td{font-size:9px} .rcv .nm{font-size:12px;font-weight:700} .rcv .cty{font-size:12px;font-weight:700}
  .rb svg{width:1.25in;height:.2in;display:block} .note{font-size:6.6px;line-height:1.35;padding:4px 6px}
  .pay{font-size:10px;font-weight:700;border:1.5px solid #000;padding:2px 6px;align-self:flex-start}
  @media screen{body{background:#777;padding:14px} .lb{background:#fff;margin:0 auto}}
  </style></head><body><section class="lb">
  <div class="t1">Online Şube Müşteri Portalı Siparişten Gönderi Hazırlama Barkodu</div>
  <div class="t2">Bu barkodu Şube.net → Fatura İşlemleri → Siparişten Gönderi Hazırlama bölümünde <b>"Müşteri Barkod"</b> alanına okutarak gönderi hazırlayınız</div>
  <div class="hd"><div class="logo">DHL</div><div class="bc">${big}<code>${e(d.ref)}</code></div><div class="dt"><b>Gönderi Tarihi</b><b>${e(date)}</b></div></div>
  <div class="bx"><h4>Gönderici Bilgileri</h4><table><tr><td class="k">Gönderen:</td><td>${e(up(from))}</td></tr></table></div>
  <div class="bx"><h4>Gön. Notu: ${e(d.note || '')}</h4></div>
  <div class="bx rcv"><table>
    <tr><td class="k">Alıcı:</td><td class="nm">${e(a.name || o.contact?.name)}</td></tr>
    <tr><td class="k">Telefon:</td><td>${e(a.phone || o.contact?.phone)}</td></tr>
    <tr><td class="k">Adres:</td><td>${e(a.address)}</td></tr>
    <tr><td class="k">İlçe / İl:</td><td class="cty">${e(up(a.district))} / ${e(up(a.city))}</td></tr></table></div>
  <div class="bx"><h4><span>Gönderi Bilgileri</span><span>Referans No: ${e(d.ref)}</span></h4><table>
    <tr><td class="k">Referans Barkod:</td><td class="rb">${small}</td><td class="k">Parça No:</td><td>1</td></tr>
    <tr><td class="k">Toplam Adet:</td><td>1</td><td class="k">Toplam Kg/Desi:</td><td>${e(d.kg || 1)} / ${e(d.desi || 1)}</td></tr>
    <tr><td class="k">Gönderi İçerik:</td><td>${e(d.icerik || '')}</td><td class="k">Sipariş:</td><td>#${e(o.no)}</td></tr></table></div>
  <div class="pay">${d.pay === 'P' ? 'GÖNDERİCİ ÖDEMELİ' : 'ALICI ÖDEMELİ'}</div>
  <div class="bx"><h4>Koşullar</h4><div class="note">1. Hazırlanan gönderiler teslim tutanağı ile DHL eCommerce yetkilisine teslim edilmelidir.<br>2. Kg/Desi ve adet bilgileri şubedeki ölçüm ve tartıma göre şube tarafından düzeltilebilir.<br>3. Mevzuat gereği taşınması yasak ürünler taşıyıcıya teslim edilemez.</div></div>
  </section><script>setTimeout(()=>print(),450)</script></body></html>`;
}
function DhlCard({ o }) {
  const S = store.s.settings;
  const [kg, setKg] = useState(o.dhl?.kg || 1);
  const [desi, setDesi] = useState(o.dhl?.desi || 1);
  const [icerik, setIcerik] = useState(o.dhl?.icerik || 'Elektronik malzeme');
  const [pay, setPay] = useState(o.dhl?.pay || 'U');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const live = !!(o.dhl?.ref && !o.dhl.cancelled);
  const demo = !dhlW() || api().mode !== 'firebase';
  // kart açılınca takip no gelmiş mi bak (sipariş başına 3 dakikada bir)
  useEffect(() => {
    if (demo || !live || o.cargo?.code) return;
    const k = 'dhl-chk-' + o.id;
    try { if (Date.now() - Number(sessionStorage.getItem(k) || 0) < 3 * 60e3) return; sessionStorage.setItem(k, String(Date.now())); } catch {}
    dhlCall('track', { id: o.id }).then((x) => dhlApply(o, x).then((ok) => ok && toast('DHL takip no geldi: ' + x.code))).catch(() => {});
  }, [o.id, live]);
  function printLabel(ord, w) {
    w = w || window.open('', '_blank'); if (!w) { toast('Açılır pencere engellendi; tarayıcıda bu siteye izin verin', 'bad'); return; }
    w.document.open(); w.document.write(dhlLabelHtml(ord, S)); w.document.close();
  }
  async function make() {
    if (demo) { toast('DHL sadece canlı sitede çalışır', 'bad'); return; }
    if (live) { printLabel(o); return; }
    const a = o.delivery?.addr || {};
    if (!a.city || !a.district || !a.address) { setErr('Teslimat adresinde il, ilçe ya da açık adres eksik.'); return; }
    const w = window.open('', '_blank'); // açılır pencere engeline takılmasın diye hemen aç, sonra doldur
    if (w) w.document.write('<p style="font:16px Arial;padding:24px">DHL’e kaydediliyor…</p>');
    setBusy('make'); setErr('');
    try {
      const j = await dhlCall('create', { id: o.id, kg, desi, icerik, pay });
      if (!j?.ok) { w?.close(); setErr('DHL kabul etmedi: ' + (j?.error || 'bilinmeyen cevap')); return; }
      const dhl = { ref: j.ref, at: now(), kg: j.kg, desi: j.desi, icerik: j.icerik, pay };
      await api().updateOrder(o.id, { dhl });
      printLabel({ ...o, dhl }, w);
      toast('DHL’e kaydedildi: ' + j.ref);
    } catch (e) { w?.close(); setErr('Bağlantı hatası: ' + e.message); } finally { setBusy(''); }
  }
  async function check() {
    setBusy('check');
    try { const x = await dhlCall('track', { id: o.id }); if (await dhlApply(o, x)) toast('Takip no geldi: ' + x.code); else toast(x?.found ? (x.text || 'Henüz şubede okutulmadı') : 'DHL’de kayıt bulunamadı', x?.found ? undefined : 'bad'); }
    catch (e) { toast('Bakılamadı: ' + e.message, 'bad'); } finally { setBusy(''); }
  }
  const cancel = () => setConfirm({ title: 'DHL kaydını iptal et', text: `DHL’deki ${o.dhl?.ref} kaydı silinecek (online şubede Toplu Gönderi Listesi’nden kalkar). Basılmış etiket geçersiz olur.`, okLabel: 'İptal et', tone: 'danger',
    onOk: async () => { setBusy('cancel'); try { const j = await dhlCall('cancel', { id: o.id }); if (j?.ok) { await api().updateOrder(o.id, { dhl: { ...o.dhl, cancelled: now() } }); toast('DHL kaydı iptal edildi'); } else toast('İptal edilemedi: ' + (j?.fault || j?.error || ''), 'bad'); } finally { setBusy(''); } } });
  const st = o.cargo?.code ? 'Şubede okutuldu · ' + (o.dhl?.text || 'yolda') : o.dhl?.text && o.dhl.statu !== '0' ? o.dhl.text : 'Şubede okutulmayı bekliyor';
  return (
    <div className="set-card dhl-card">
      <h3 className="dhl-h"><span className="dhl-logo">DHL</span>eCommerce</h3>
      {live ? <>
        <p className="dhl-st"><span className={'dot' + (o.cargo?.code ? ' ok' : '')} />{st}</p>
        <p className="fine">Referans <b className="num">{o.dhl.ref}</b> · {when(o.dhl.at)} · {o.dhl.kg || 1} kg / {o.dhl.desi || 1} desi · {o.dhl.pay === 'P' ? 'gönderici ödemeli' : 'alıcı ödemeli'}
          {o.cargo?.code && <> · takip no {o.cargo.url ? <a className="num" href={o.cargo.url} target="_blank" rel="noopener">{o.cargo.code}</a> : <b className="num">{o.cargo.code}</b>}</>}</p>
      </> : <>
        <p className="fine">Barkodu basınca sipariş DHL’e kaydedilir. Şube okutunca takip numarası siparişe kendiliğinden gelir, müşteriye bildirilir.</p>
        <div className="dhl-row">
          <Field label="Kg"><input inputMode="numeric" value={kg} onChange={(e) => setKg(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Desi"><input inputMode="numeric" value={desi} onChange={(e) => setDesi(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <Field label="İçerik"><input value={icerik} onChange={(e) => setIcerik(e.target.value)} /></Field>
        <div className="seg dhl-pay" role="radiogroup" aria-label="Kargo ücreti">
          <button type="button" role="radio" aria-checked={pay === 'U'} className={pay === 'U' ? 'on' : ''} onClick={() => setPay('U')}>Alıcı ödemeli</button>
          <button type="button" role="radio" aria-checked={pay === 'P'} className={pay === 'P' ? 'on' : ''} onClick={() => setPay('P')}>Gönderici ödemeli</button>
        </div>
      </>}
      {err && <p className="err">{err}</p>}
      <div className="row-btns">
        <button className="btn primary" disabled={!!busy} onClick={make}><Icon n="box" s={16} />{busy === 'make' ? 'DHL’e kaydediliyor…' : live ? 'Barkodu tekrar bas (A6)' : 'A6 barkod bas'}</button>
        {live && !o.cargo?.code && <button className="btn outline" disabled={!!busy} onClick={check}>{busy === 'check' ? 'Bakılıyor…' : 'Takip no geldi mi?'}</button>}
        {live && !o.cargo?.code && <button className="btn ghost danger" disabled={!!busy} onClick={cancel}>DHL kaydını iptal et</button>}
      </div>
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
