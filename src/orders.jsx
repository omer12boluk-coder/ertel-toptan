// Yönetim paneli > Siparişler: online mağazadan (/magaza) gelen siparişler ve mağaza üyeleri.
// Sipariş: durum adımları (Onayla → Kargoya ver / Teslime hazır → Tamamlandı), müşteriye WhatsApp, kargo takip no, iç not.
import { useEffect, useMemo, useState } from 'react';
import { useStore, api, store, toast, openOrder, go } from './store.js';
import { Icon, Avatar, StatusPill, Empty, Sheet, Confirm, Field, PhoneInput, openMenu, copyText } from './ui.jsx';
import { fmt, totals, fmtTotals, when, now, norm } from './utils.js';
import { ORDER_STATUS, ORDER_OPEN, PAY, DELIVERY } from './config.js';
import { links, waLink } from './route.js';
import { ListPaper } from './listsheet.jsx';
import { InvoiceText, addrLine, orderItems } from './checkout.jsx';

const FILTERS = [['open', 'Açık'], ['new', 'Yeni'], ['all', 'Tümü'], ['done', 'Tamamlanan'], ['cancelled', 'İptal']];
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
  const newN = orders.filter((o) => o.status === 'new').length;
  const list = useMemo(() => {
    let r = orders;
    if (filter === 'open') r = r.filter((o) => ORDER_OPEN.includes(o.status));
    else if (filter !== 'all') r = r.filter((o) => o.status === filter);
    const t = norm(q.trim());
    if (t) r = r.filter((o) => norm([o.no, o.contact?.name, o.contact?.phone, o.contact?.email, o.invoice?.company].join(' ')).includes(t) || String(o.contact?.phone || '').replace(/\D/g, '').includes(t.replace(/\D/g, '') || '#'));
    return r;
  }, [orders, filter, q]);

  if (openId) return <OrderDetail id={openId} />;
  const del = (o) => setConfirm({ title: 'Siparişi sil', text: `#${o.no} numaralı sipariş tamamen silinecek. Geri alınamaz.`, okLabel: 'Sil', tone: 'danger', onOk: () => api().deleteOrders([o.id]).then(() => toast('Sipariş silindi'), (e) => toast('Silinemedi: ' + e.message, 'bad')) });
  const menu = (e, o) => openMenu(e, [
    { label: 'Aç', icon: 'eye', onClick: () => openOrder(o.id) },
    o.contact?.phone && { label: 'Müşteriye WhatsApp’tan yaz', icon: 'wa', onClick: () => window.open(waLink(o.contact.phone, custMsg(o, S)), '_blank', 'noopener') },
    { label: 'Müşterinin takip linkini kopyala', icon: 'copy', onClick: () => copyText(links.order(o.id), 'Takip linki kopyalandı') },
    '-',
    { label: 'Siparişi sil', icon: 'trash', danger: true, onClick: () => del(o) },
  ], '#' + o.no);

  return (
    <div className="page orders-page">
      <div className="page-h">
        <h1 className="page-t">Mağaza siparişleri{newN > 0 && <span className="muted"> · {newN} yeni</span>}</h1>
        <button className="btn sm outline" onClick={() => copyText(links.shop(), 'Mağaza linki kopyalandı')}><Icon n="copy" s={15} />Mağaza linki</button>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={view === 'orders'} className={'tab' + (view === 'orders' ? ' on' : '')} onClick={() => setView('orders')}>Siparişler ({orders.length})</button>
        <button role="tab" aria-selected={view === 'members'} className={'tab' + (view === 'members' ? ' on' : '')} onClick={() => setView('members')}>Mağaza üyeleri ({members.length})</button>
      </div>
      {view === 'members' ? <Members /> : <>
        <div className="toolbar">
          <div className="search"><Icon n="search" s={18} /><input id="ord-search" type="search" placeholder="Sipariş no, ad, telefon…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="chips">
            {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}{k === 'new' && newN > 0 ? ` (${newN})` : ''}</button>)}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty icon="box" title={orders.length ? 'Bu filtrede sipariş yok' : 'Henüz mağaza siparişi yok'}>
            {!orders.length && <p>Müşteriler <b>/magaza</b>’da sepeti onaylayıp siparişi tamamlayınca burada görünür.</p>}
          </Empty>
        ) : (
          <ul className="olist">
            {list.map((o) => (
              <li key={o.id} onContextMenu={(e) => menu(e, o)}>
                <button className={'ocard' + (o.unread ? ' unread' : '')} onClick={() => openOrder(o.id)}>
                  <span className="ocard-b">
                    <span className="ocard-top">{o.unread ? <span className="dot-new" aria-label="Yeni" /> : null}<b className="num">#{o.no}</b><StatusPill status={o.status} map={ORDER_STATUS} />{o.member && <span className="tag">Üye</span>}</span>
                    <span className="ocard-who"><b>{o.contact?.name}</b>{o.invoice?.type === 'company' && o.invoice.company ? ` · ${o.invoice.company}` : ''}</span>
                    <span className="muted">{when(o.createdAt)} · {(o.items || []).length} ürün · {DELIVERY[o.delivery?.method] || ''}{o.delivery?.addr?.city ? ` (${o.delivery.addr.city})` : ''} · {PAY[o.pay] || ''}</span>
                  </span>
                  <b className="num ocard-sum">{orderTotal(o)}</b>
                  <Icon n="back" s={16} className="flip" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </>}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ---- Sipariş detayı ---------------------------------------------------------------------------
function OrderDetail({ id }) {
  const { orders, settings: S } = useStore();
  const fromList = orders.find((o) => o.id === id);
  const [one, setOne] = useState(undefined);
  const o = fromList || one;
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [ship, setShip] = useState(null); // kargo bilgisi penceresi
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
  const nextMap = { new: ['confirmed', 'Siparişi onayla', 'check'], confirmed: pickup ? ['ready', 'Teslime hazır', 'store'] : ['shipped', 'Kargoya verildi', 'box'], shipped: ['done', 'Teslim edildi', 'check'], ready: ['done', 'Teslim edildi', 'check'] };
  const next = nextMap[o.status];
  const wa = o.contact?.phone ? waLink(o.contact.phone, custMsg(o, S)) : null;
  async function setStatus(s, extra = {}) {
    setBusy(true);
    try {
      const t = now();
      await api().updateOrder(o.id, { status: s, updatedAt: t, history: [...(o.history || []), { s, at: t, by: 'admin' }], ...extra });
      toast('Durum: ' + ORDER_STATUS[s].label);
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const goNext = () => (next[0] === 'shipped' ? setShip({ company: o.cargo?.company || S.orders?.cargoCompany || '', code: o.cargo?.code || '' }) : setStatus(next[0]));
  const cancel = () => setConfirm({ title: 'Siparişi iptal et', text: `#${o.no} iptal edilecek. Müşteri takip sayfasında “İptal edildi” görür.`, okLabel: 'İptal et', tone: 'danger', onOk: () => setStatus('cancelled') });
  const del = () => setConfirm({ title: 'Siparişi sil', text: `#${o.no} tamamen silinecek. Geri alınamaz.`, okLabel: 'Sil', tone: 'danger', onOk: () => api().deleteOrders([o.id]).then(() => { toast('Sipariş silindi'); back(); }) });
  const saveNote = () => api().updateOrder(o.id, { adminNote: note.trim() }).then(() => toast('Not kaydedildi'), (e) => toast('Kaydedilemedi: ' + e.message, 'bad'));

  return (
    <div className="page order-page admin-order">
      <div className="send-bar">
        <button className="btn sm ghost" onClick={back}><Icon n="back" s={16} />Siparişler</button>
        <div className="send-t"><b>Sipariş #{o.no}</b><span className="muted">{when(o.createdAt)} · {items.length} ürün · {orderTotal(o)}</span></div>
        <StatusPill status={o.status} map={ORDER_STATUS} />
      </div>

      <div className="oa-status" role="radiogroup" aria-label="Sipariş durumu">
        <span className="oa-status-l">Durum:</span>
        {['new', 'confirmed', 'shipped', 'ready', 'done', 'cancelled'].map((k) => (
          <button key={k} role="radio" aria-checked={o.status === k} disabled={busy} className={'oa-st tone-' + ORDER_STATUS[k].tone + (o.status === k ? ' on' : '')}
            onClick={() => { if (o.status === k) return; if (k === 'shipped') setShip({ company: o.cargo?.company || '', code: o.cargo?.code || '' }); else if (k === 'cancelled') cancel(); else setStatus(k); }}>
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
        {['new', 'confirmed', pickup ? 'ready' : 'shipped', 'done'].map((k, i, arr) => {
          const cur = arr.indexOf(o.status);
          const h = (o.history || []).filter((x) => x.s === k).pop();
          return <li key={k} className={o.status === 'cancelled' ? '' : i < cur ? 'done' : i === cur ? 'on' : ''}><span className="track-dot">{i < cur && o.status !== 'cancelled' ? <Icon n="check" s={14} /> : i + 1}</span><span>{ORDER_STATUS[k].label}{h && <small>{when(h.at)}</small>}</span></li>;
        })}
      </ol>
      {o.status === 'shipped' && o.cargo?.code && <div className="banner ok"><Icon n="box" /><div><b>Kargo:</b> {o.cargo.company} · <span className="num">{o.cargo.code}</span> <button className="link" onClick={() => setShip({ ...o.cargo })}>Değiştir</button></div></div>}

      <div className="o-info">
        <div className="o-card">
          <h3>Müşteri {o.member && <span className="tag">Üye</span>}</h3>
          <p><b>{o.contact?.name}</b></p>
          {o.contact?.phone && <p><a className="num" href={'tel:' + o.contact.phone.replace(/\D/g, '')}>{o.contact.phone}</a> <button className="link" onClick={() => copyText(o.contact.phone)}>Kopyala</button></p>}
          {o.contact?.email && <p><a href={'mailto:' + o.contact.email}>{o.contact.email}</a></p>}
        </div>
        <div className="o-card">
          <h3>Teslimat</h3>
          <p><b>{DELIVERY[o.delivery?.method] || ''}</b></p>
          {o.delivery?.addr && <><p>{addrLine(o.delivery.addr)}</p><button className="link" onClick={() => copyText(`${o.contact?.name}\n${o.contact?.phone}\n${addrLine(o.delivery.addr)}`, 'Adres kopyalandı')}>Adresi kopyala (kargo için)</button></>}
        </div>
        <div className="o-card"><h3>Fatura</h3><InvoiceText inv={o.invoice} name={o.contact?.name} deliv={o.delivery?.addr} /></div>
        <div className="o-card"><h3>Ödeme</h3><p><b>{PAY[o.pay] || '—'}</b></p>{o.pay === 'card' && <p className="muted">Onaylayınca müşteriye ödeme linki gönderin.</p>}</div>
      </div>
      {o.note && <p className="o-note"><b>Müşterinin notu:</b> {o.note}</p>}

      <ListPaper r={{ no: o.no, gname: o.contact?.name, items, status: 'priced', createdAt: o.createdAt, updatedAt: o.createdAt, rate: o.rate ? { usd: o.rate, src: 'harem' } : null }} label="Sipariş" />

      <div className="set-card">
        <Field label="İç not" hint="Sadece siz görürsünüz"><textarea id="oa-note" rows="2" value={note ?? ''} onChange={(e) => setNote(e.target.value)} placeholder="ör. Kargo ücreti 150 TL, ödeme bekleniyor" /></Field>
        {(note ?? '') !== (o.adminNote || '') && <button className="btn sm primary" onClick={saveNote}><Icon n="check" s={15} />Notu kaydet</button>}
      </div>

      {ship && (
        <Sheet title="Kargoya verildi" sub="Takip numarası müşterinin sipariş sayfasında görünür" onClose={() => setShip(null)}
          footer={<><button className="btn ghost" onClick={() => setShip(null)}>Vazgeç</button><button className="btn primary" disabled={busy} onClick={() => { const c = { company: ship.company.trim(), code: ship.code.trim() }; setShip(null); o.status === 'shipped' ? api().updateOrder(o.id, { cargo: c }).then(() => toast('Kargo bilgisi kaydedildi')) : setStatus('shipped', { cargo: c }); }}><Icon n="check" s={16} />Kaydet</button></>}>
          <div className="form-col">
            <div className="field"><span className="field-l">Kargo firması</span>
              <div className="cargo-pick">{(S.orders?.cargoCompanies || []).map((c) => <button key={c} type="button" className={'chip' + (ship.company === c ? ' on' : '')} onClick={() => setShip({ ...ship, company: c })}>{c}</button>)}</div>
              <input id="ship-co" value={ship.company} onChange={(e) => setShip({ ...ship, company: e.target.value })} placeholder="Listede yoksa yazın" />
              <span className="field-h">Listeyi Ayarlar &gt; Online mağaza &gt; Kargo firmaları’ndan düzenleyebilirsiniz.</span>
            </div>
            <Field label="Takip numarası" opt><input id="ship-code" value={ship.code} onChange={(e) => setShip({ ...ship, code: e.target.value })} /></Field>
          </div>
        </Sheet>
      )}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ---- Mağaza üyeleri -----------------------------------------------------------------------------
function Members() {
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
