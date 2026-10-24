// Online mağaza (/magaza) sipariş akışı:
//   Checkout   sepetten sonra: iletişim, teslimat, fatura, ödeme → "Siparişi tamamla" → Yönetim paneli > Siparişler
//   OrderPage  sipariş alındı / takip sayfası (/magaza/s/<no>)
//   Account    Hesabım: giriş, üye ol, şifre sıfırlama, siparişlerim, adreslerim, bilgilerim
// Misafir de sipariş verebilir (bilgileri her seferinde yazar); üye olunca bilgileri otomatik dolar (ekranda görür, değiştirebilir).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, api, toast, go, clearCart, openOrder } from './store.js';
import { Icon, Thumb, Empty, PhoneInput, phoneDigits, PasswordInput, VatLines, StatusPill, Confirm, Sheet, Field, Avatar, copyText } from './ui.jsx';
import { fmt, totals, fmtTotals, when, ls, rid, now } from './utils.js';
import { ORDER_STATUS, PAY, DELIVERY, ILLER } from './config.js';
import { links, waLink } from './route.js';
import { ListPaper, useRate, toTL, fmtTL } from './listsheet.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const orderNo = () => Array.from({ length: 6 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
const digits = (v) => String(v || '').replace(/\D/g, '');
const blankAddr = () => ({ id: rid(), title: '', city: '', district: '', address: '' });
export const addrLine = (a) => (!a ? '' : [a.address, [a.district, a.city].filter(Boolean).join(' / ')].filter(Boolean).join(', '));
// Firestore "undefined" kabul etmez: boş alanları temizle
const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? undefined : v)));
const myLocalOrders = () => ls.get('my-orders', []);
export const orderItems = (o) => (o.items || []).map((i) => ({ ...i, offer: i.price }));

// ---- Adres alanları -------------------------------------------------------------------------
function AddressFields({ a, set, err = {}, p = 'addr', title }) {
  const up = (k) => (e) => set({ ...a, [k]: e.target.value });
  return (
    <div className="form-col addr-fields">
      {title && <Field label="Adres adı" opt><input id={p + '-title'} placeholder="ör. Ev, İş, Dükkan" value={a.title || ''} onChange={up('title')} /></Field>}
      <div className="row2">
        <Field label="İl" error={err[p + '.city']}>
          <select id={p + '-city'} value={a.city} onChange={up('city')}><option value="">Seçin</option>{ILLER.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="İlçe" error={err[p + '.district']}><input id={p + '-district'} value={a.district} onChange={up('district')} autoComplete="address-level2" /></Field>
      </div>
      <Field label="Açık adres" error={err[p + '.address']}><textarea id={p + '-address'} rows="2" placeholder="Mahalle, cadde / sokak, bina no, daire" value={a.address} onChange={up('address')} autoComplete="street-address" /></Field>
    </div>
  );
}
function addrErrors(a, p) {
  const e = {};
  if (!a?.city) e[p + '.city'] = 'İl seçin';
  if (!String(a?.district || '').trim()) e[p + '.district'] = 'İlçeyi yazın';
  if (String(a?.address || '').trim().length < 8) e[p + '.address'] = 'Açık adresi yazın';
  return e;
}

// Seçenek kartı (radyo)
function Choice({ on, onClick, title, sub, icon }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={'seg-card' + (on ? ' on' : '')} onClick={onClick}>
      <span className="radio" aria-hidden="true" />{icon && <Icon n={icon} s={20} />}<span><b>{title}</b>{sub && <small>{sub}</small>}</span>
    </button>
  );
}

// =============================================================================================
export function Checkout({ items, onBack }) {
  const { settings: S, member, api: A } = useStore();
  const O = S.orders || {};
  const rate = useRate();
  const methods = [O.cargo !== false && 'cargo', O.pickup !== false && 'pickup'].filter(Boolean);
  const [f, setF] = useState(() => initForm(member, methods, ls.get('guest-checkout', null)));
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [auth, setAuth] = useState(false);
  const formRef = useRef(null);
  const prevMember = useRef(member?.uid);
  // giriş yapılınca bilgileri doldur
  useEffect(() => { if (member?.uid && member.uid !== prevMember.current) setF((x) => ({ ...initForm(member, methods, null), pay: x.pay, note: x.note, method: x.method })); prevMember.current = member?.uid; }, [member?.uid]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const setC = (k) => (e) => set({ contact: { ...f.contact, [k]: e?.target ? e.target.value : e } });
  const setI = (k) => (e) => set({ inv: { ...f.inv, [k]: e.target.value } });
  const saved = member?.addresses || [];
  const pays = [O.payHavale !== false && 'havale', O.payCard !== false && 'card', O.payShop !== false && f.method === 'pickup' && 'shop'].filter(Boolean);
  useEffect(() => { if (!pays.includes(f.pay)) set({ pay: pays[0] || 'havale' }); }, [f.method]);
  const tot = totals(items, 'offer');
  const tried = useRef(false);
  useEffect(() => { if (tried.current) setErr(validate()); }, [f]);
  const tTL = S.pricing.showTL && rate ? toTL(tot, rate) : null;
  const delivAddr = f.method !== 'cargo' ? null : f.addrId !== 'new' && saved.find((a) => a.id === f.addrId) || f.addr;

  function validate() {
    const e = {};
    if (f.contact.name.trim().length < 3) e.name = 'Adınızı ve soyadınızı yazın';
    if (digits(f.contact.phone).length !== 11) e.phone = 'Telefonu 0(5xx) xxx xx xx şeklinde yazın';
    if (f.contact.email.trim() && !emailOk(f.contact.email)) e.email = 'E-posta adresi geçersiz';
    if (!member && f.signup) { if (!emailOk(f.contact.email)) e.email = 'Üyelik için e-posta gerekli'; if (f.pw.length < 6) e.pw = 'Şifre en az 6 karakter olmalı'; }
    if (f.method === 'cargo') Object.assign(e, addrErrors(delivAddr, 'addr'));
    if (f.inv.type === 'company') {
      if (f.inv.company.trim().length < 2) e['inv.company'] = 'Firma ünvanını yazın';
      if (f.inv.taxOffice.trim().length < 2) e['inv.taxOffice'] = 'Vergi dairesini yazın';
      if (![10, 11].includes(digits(f.inv.taxNo).length)) e['inv.taxNo'] = 'Vergi no 10 haneli olmalı';
    } else if (f.inv.tc && digits(f.inv.tc).length !== 11) e['inv.tc'] = 'TC kimlik no 11 haneli olmalı';
    if (f.method === 'cargo' && !f.billSame) Object.assign(e, addrErrors(f.bill, 'bill'));
    return e;
  }
  async function submit() {
    tried.current = true;
    const e = validate(); setErr(e);
    if (Object.keys(e).length) {
      toast('Eksik bilgileri tamamlayın', 'bad');
      setTimeout(() => formRef.current?.querySelector('.field.bad input, .field.bad select, .field.bad textarea')?.focus(), 30);
      return;
    }
    setBusy(true);
    try {
      let uid = member?.uid || null;
      const email = f.contact.email.trim().toLowerCase();
      if (!member && f.signup) { const m = await A.memberSignup({ email, password: f.pw, name: f.contact.name.trim(), phone: f.contact.phone }); uid = m.uid; }
      const t = now(), no = orderNo(), id = A.newOrderId();
      const cleanA = (a) => a && { city: a.city, district: a.district.trim(), address: a.address.trim(), ...(a.title ? { title: a.title } : {}) };
      const inv = f.inv.type === 'company'
        ? { type: 'company', company: f.inv.company.trim(), taxOffice: f.inv.taxOffice.trim(), taxNo: digits(f.inv.taxNo) }
        : { type: 'person', ...(f.inv.tc ? { tc: digits(f.inv.tc) } : {}) };
      const order = strip({
        no, uid, member: !!uid, status: 'new', createdAt: t, updatedAt: t, unread: 1, history: [{ s: 'new', at: t }],
        items: items.map(({ id: pid, k, n, cur, qty, offer, pi, u }) => ({ id: pid, k, n, cur, qty, price: offer, pi, u })),
        total: tot, rate: rate?.usd || null,
        contact: { name: f.contact.name.trim(), phone: f.contact.phone, email },
        delivery: { method: f.method, addr: f.method === 'cargo' ? cleanA(delivAddr) : null },
        invoice: { ...inv, same: f.method !== 'cargo' || f.billSame, addr: f.method === 'cargo' && !f.billSame ? cleanA(f.bill) : null },
        pay: f.pay, note: f.note.trim(),
      });
      await A.placeOrder(order, id);
      // üye: yeni adresi ve fatura bilgisini hesaba kaydet
      if (uid) {
        const m = store.s.member || { uid };
        const patch = { uid, name: m.name || order.contact.name, phone: m.phone || order.contact.phone, invoice: inv };
        let addrs = m.addresses || [];
        if (f.method === 'cargo' && (f.addrId === 'new' || !saved.length) && (f.saveAddr || f.signup)) addrs = [...addrs, { ...cleanA(delivAddr), id: rid(), title: delivAddr.title || (addrs.length ? 'Adres ' + (addrs.length + 1) : 'Adresim') }];
        patch.addresses = addrs;
        try { await A.saveMember({ ...m, ...patch }); } catch (x) { console.warn(x); }
      } else {
        ls.set('my-orders', [{ id, no, at: t }, ...myLocalOrders()].slice(0, 20));
        ls.set('guest-checkout', { contact: order.contact, addr: f.method === 'cargo' ? { ...cleanA(delivAddr), id: 'g' } : null, inv: f.inv }); // bu cihazda bir dahakine hazır gelsin
      }
      clearCart();
      openOrder(id, true);
    } catch (x) { toast('Sipariş gönderilemedi: ' + x.message, 'bad'); }
    setBusy(false);
  }

  return (
    <div className="page checkout" ref={formRef}>
      <div className="send-bar">
        <button className="btn sm ghost" onClick={onBack}><Icon n="back" s={16} />Sepet</button>
        <div className="send-t"><b>Siparişi tamamla</b><span className="muted">{items.length} ürün · {fmtTotals(tot)}</span></div>
      </div>
      <div className="co-grid">
        <div className="co-main">
          {!member ? (
            <div className="co-who">
              <Icon n="user" s={20} />
              <span className="co-who-t"><b>Misafir olarak devam ediyorsunuz.</b> Üyeyseniz giriş yapın, bilgileriniz otomatik dolsun.</span>
              <button className="btn sm outline" onClick={() => setAuth(true)}>Giriş yap</button>
            </div>
          ) : (
            <div className="co-who on">
              <Avatar u={member} size={34} />
              <span className="co-who-t"><b>{member.name || member.email}</b> olarak sipariş veriyorsunuz. Kayıtlı bilgileriniz aşağıda; isterseniz değiştirin.</span>
            </div>
          )}

          <section className="co-sec">
            <h2><span className="co-n">1</span>İletişim bilgileri</h2>
            <div className="row2">
              <Field label="Ad soyad" error={err.name}><input id="co-name" autoComplete="name" value={f.contact.name} onChange={setC('name')} /></Field>
              <Field label="Cep telefonu" error={err.phone}><PhoneInput id="co-phone" value={f.contact.phone} onChange={setC('phone')} /></Field>
            </div>
            <Field label="E-posta" opt={!f.signup && !member} error={err.email} hint="Sipariş bilgisi için"><input id="co-email" type="email" autoComplete="email" value={f.contact.email} readOnly={!!member} onChange={setC('email')} /></Field>
          </section>

          <section className="co-sec">
            <h2><span className="co-n">2</span>Teslimat</h2>
            {methods.length > 1 && (
              <div className="seg-cards" role="radiogroup" aria-label="Teslimat şekli">
                <Choice on={f.method === 'cargo'} onClick={() => set({ method: 'cargo' })} icon="box" title={DELIVERY.cargo} sub="Adresinize gönderilir" />
                <Choice on={f.method === 'pickup'} onClick={() => set({ method: 'pickup' })} icon="store" title={DELIVERY.pickup} sub={[S.shop.address, S.shop.hours].filter(Boolean).join(' · ')} />
              </div>
            )}
            {f.method === 'cargo' && <>
              {saved.length > 0 && (
                <div className="addr-cards" role="radiogroup" aria-label="Teslimat adresi">
                  {saved.map((a) => (
                    <button key={a.id} type="button" role="radio" aria-checked={f.addrId === a.id} className={'addr-card' + (f.addrId === a.id ? ' on' : '')} onClick={() => set({ addrId: a.id })}>
                      <span className="radio" aria-hidden="true" /><span><b>{a.title || 'Adres'}</b><small>{addrLine(a)}</small></span>
                    </button>
                  ))}
                  <button type="button" role="radio" aria-checked={f.addrId === 'new'} className={'addr-card add' + (f.addrId === 'new' ? ' on' : '')} onClick={() => set({ addrId: 'new' })}>
                    <span className="radio" aria-hidden="true" /><span><b>Yeni adres</b><small>Başka bir adrese gönder</small></span>
                  </button>
                </div>
              )}
              {(f.addrId === 'new' || !saved.length) && <>
                <AddressFields a={f.addr} set={(addr) => set({ addr })} err={err} p="addr" title={!!member} />
                {member && <label className="mini-check"><input type="checkbox" checked={f.saveAddr} onChange={(e) => set({ saveAddr: e.target.checked })} />Bu adresi hesabıma kaydet</label>}
              </>}
            </>}
            {f.method === 'pickup' && <p className="fine co-pick"><Icon n="store" s={16} />{S.shop.name} · {[S.shop.address, S.shop.hours].filter(Boolean).join(' · ')}. Siparişiniz hazır olunca haber veririz.</p>}
          </section>

          <section className="co-sec">
            <h2><span className="co-n">3</span>Fatura</h2>
            <div className="seg-cards two" role="radiogroup" aria-label="Fatura tipi">
              <Choice on={f.inv.type === 'person'} onClick={() => set({ inv: { ...f.inv, type: 'person' } })} title="Bireysel" sub="Adınıza fatura" />
              <Choice on={f.inv.type === 'company'} onClick={() => set({ inv: { ...f.inv, type: 'company' } })} title="Kurumsal" sub="Firma adına fatura" />
            </div>
            {f.inv.type === 'person'
              ? <Field label="TC kimlik no" opt error={err['inv.tc']} hint="Fatura için; boş bırakabilirsiniz"><input id="co-tc" inputMode="numeric" maxLength={11} value={f.inv.tc} onChange={(e) => set({ inv: { ...f.inv, tc: digits(e.target.value).slice(0, 11) } })} /></Field>
              : <>
                <Field label="Firma ünvanı" error={err['inv.company']}><input id="co-company" autoComplete="organization" value={f.inv.company} onChange={setI('company')} /></Field>
                <div className="row2">
                  <Field label="Vergi dairesi" error={err['inv.taxOffice']}><input id="co-taxoffice" value={f.inv.taxOffice} onChange={setI('taxOffice')} /></Field>
                  <Field label="Vergi no" error={err['inv.taxNo']}><input id="co-taxno" inputMode="numeric" maxLength={11} value={f.inv.taxNo} onChange={(e) => set({ inv: { ...f.inv, taxNo: digits(e.target.value).slice(0, 11) } })} /></Field>
                </div>
              </>}
            {f.method === 'cargo' && <>
              <label className="mini-check"><input type="checkbox" checked={f.billSame} onChange={(e) => set({ billSame: e.target.checked })} />Fatura adresi teslimat adresiyle aynı</label>
              {!f.billSame && <AddressFields a={f.bill} set={(bill) => set({ bill })} err={err} p="bill" />}
            </>}
          </section>

          <section className="co-sec">
            <h2><span className="co-n">4</span>Ödeme</h2>
            <div className="seg-cards col" role="radiogroup" aria-label="Ödeme şekli">
              {pays.includes('havale') && <Choice on={f.pay === 'havale'} onClick={() => set({ pay: 'havale' })} title={PAY.havale} sub="Banka bilgileri sipariş sonrası gösterilir" />}
              {pays.includes('card') && <Choice on={f.pay === 'card'} onClick={() => set({ pay: 'card' })} title={PAY.card} sub="Sipariş onaylanınca güvenli ödeme linki gönderilir" />}
              {pays.includes('shop') && <Choice on={f.pay === 'shop'} onClick={() => set({ pay: 'shop' })} title={PAY.shop} sub="Teslim alırken nakit ya da kartla" />}
            </div>
            <Field label="Sipariş notu" opt><textarea id="co-note" rows="2" placeholder="ör. Faturayı ürünle birlikte gönderin" value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
          </section>

          {!member && O.signup !== false && (
            <section className="co-sec co-signup">
              <label className="mini-check big"><input type="checkbox" checked={f.signup} onChange={(e) => set({ signup: e.target.checked })} /><span><b>Bu bilgilerle üye ol</b> <small className="muted">— bir dahaki siparişte her şey hazır gelir, siparişlerinizi takip edersiniz</small></span></label>
              {f.signup && <Field label="Şifre belirleyin" error={err.pw} hint="En az 6 karakter"><PasswordInput id="co-pw" autoComplete="new-password" value={f.pw} onChange={(e) => set({ pw: e.target.value })} /></Field>}
            </section>
          )}
        </div>

        <aside className="co-side">
          <div className="cart-sum">
            <h2 className="co-side-t">Sipariş özeti</h2>
            <ul className="co-items">
              {items.map((it) => (
                <li key={it.id}><Thumb p={it} size="sm" /><span className="co-it-n">{it.n}<small className="num">{it.qty} × {fmt(it.offer, it.cur)}</small></span><b className="num">{fmt(it.offer * it.qty, it.cur)}</b></li>
              ))}
            </ul>
            <div className="sum-rows">
              <div><span>Ürünler</span><span className="num">{fmtTotals(tot)}</span></div>
              <div><span>{f.method === 'pickup' ? 'Teslimat' : 'Kargo'}</span><span>{f.method === 'pickup' ? 'Dükkandan' : 'Onayda bildirilir'}</span></div>
              <div className="sum-total"><span>Toplam</span><b className="num">{fmtTotals(tot)}</b></div>
              {tTL != null && <div className="sum-tl"><span /><span className="num">≈ {fmtTL(tTL)}</span></div>}
            </div>
            <VatLines by={tot} />
            <button className="btn primary big co-go" disabled={busy} onClick={submit}><Icon n="check" /><span><b>{busy ? 'Gönderiliyor…' : 'Siparişi tamamla'}</b><small>Ödeme şimdi alınmaz</small></span></button>
            {f.method === 'cargo' && O.cargoNote && <p className="fine">{O.cargoNote}</p>}
          </div>
        </aside>
      </div>
      {auth && <AuthSheet onClose={() => setAuth(false)} />}
    </div>
  );
}

function initForm(m, methods, guest) {
  const g = guest || {};
  const addrs = m?.addresses || [];
  const inv0 = m?.invoice || g.inv || {};
  return {
    contact: { name: m?.name || g.contact?.name || '', phone: m?.phone || g.contact?.phone || '', email: m?.email || g.contact?.email || '' },
    method: methods[0] || 'cargo',
    addrId: addrs[0]?.id || 'new',
    addr: !m && g.addr ? { ...blankAddr(), ...g.addr } : blankAddr(),
    saveAddr: true,
    inv: { type: inv0.type || 'person', tc: inv0.tc || '', company: inv0.company || '', taxOffice: inv0.taxOffice || '', taxNo: inv0.taxNo || '' },
    billSame: true, bill: blankAddr(), pay: 'havale', note: '', signup: false, pw: '',
  };
}

// =============================================================================================
// Sipariş sayfası: az önce verildiyse teşekkür kutusu; her zaman durum, ödeme, teslimat ve ürünler
export function OrderPage({ id }) {
  const { settings: S, orderJust, member } = useStore();
  const [o, setO] = useState(undefined);
  const [slow, setSlow] = useState(false);
  const [confirm, setConfirm] = useState(null);
  useEffect(() => { setO(undefined); const t = setTimeout(() => setSlow(true), 12000); const un = api().watchOrder(id, setO); return () => { clearTimeout(t); un && un(); }; }, [id]);
  if (o === null) return <div className="page narrow"><Empty icon="search" title="Sipariş bulunamadı"><p>Link eksik kopyalanmış olabilir.</p><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty></div>;
  if (!o) return <div className="page narrow list-wait"><div className="spinner" aria-label="Yükleniyor" />{slow && <><p>Bağlantı yavaş görünüyor.</p><button className="btn primary" onClick={() => location.reload()}><Icon n="refresh" s={16} />Tekrar dene</button></>}</div>;
  const link = links.order(o.id);
  const items = orderItems(o);
  const st = ORDER_STATUS[o.status] || ORDER_STATUS.new;
  const mine = member && o.uid === member.uid;
  const steps = ['new', 'confirmed', o.delivery?.method === 'pickup' ? 'ready' : 'shipped', 'done'];
  const cur = steps.indexOf(o.status);
  const wa = S.shop.whatsapp ? waLink(S.shop.whatsapp, `Merhaba, #${o.no} numaralı siparişim:\n${link}`) : null;
  const cancel = () => setConfirm({ title: 'Siparişi iptal et', text: 'Siparişiniz iptal edilecek. Emin misiniz?', okLabel: 'İptal et', tone: 'danger', onOk: () => api().updateOrder(o.id, { status: 'cancelled', updatedAt: now(), history: [...(o.history || []), { s: 'cancelled', at: now(), by: 'customer' }] }).then(() => toast('Sipariş iptal edildi'), (e) => toast('İptal edilemedi: ' + e.message, 'bad')) });
  return (
    <div className="page order-page">
      <div className="list-top">
        <button className="btn sm ghost" onClick={() => go(member ? 'hesap' : 'katalog')}><Icon n="back" s={16} />{member ? 'Siparişlerim' : 'Ürünler'}</button>
        <StatusPill status={o.status} map={ORDER_STATUS} />
      </div>
      {orderJust && (
        <div className="done-card">
          <span className="sent-ic"><Icon n="check" s={30} /></span>
          <h1 className="page-t">Siparişiniz alındı</h1>
          <p className="done-no">Sipariş no <b className="num">#{o.no}</b></p>
          <p className="muted">{S.orders?.doneNote}</p>
          <div className="export-bar center">
            {wa && <a className="btn wa" href={wa} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp’tan haber ver</a>}
            <button className="btn outline" onClick={() => copyText(link, 'Sipariş linki kopyalandı')}><Icon n="copy" s={16} />Takip linkini kopyala</button>
            <button className="btn ghost" onClick={() => go('katalog')}>Alışverişe devam et</button>
          </div>
          {!o.uid && <p className="fine">Bu sayfanın linkini saklayın; siparişinizin durumunu buradan takip edebilirsiniz.</p>}
        </div>
      )}

      {o.status === 'cancelled' ? <div className="banner bad"><Icon n="x" /><div><b>Bu sipariş iptal edildi.</b></div></div> : (
        <ol className="track" aria-label="Sipariş durumu">
          {steps.map((k, i) => (
            <li key={k} className={i < cur ? 'done' : i === cur ? 'on' : ''}><span className="track-dot">{i < cur ? <Icon n="check" s={14} /> : i + 1}</span><span>{ORDER_STATUS[k].cust}</span></li>
          ))}
        </ol>
      )}
      {o.status === 'shipped' && o.cargo?.code && <div className="banner ok"><Icon n="box" /><div><b>Kargo takip:</b> {o.cargo.company} · <span className="num">{o.cargo.code}</span> <button className="link" onClick={() => copyText(o.cargo.code, 'Takip no kopyalandı')}>Kopyala</button></div></div>}

      {o.status !== 'cancelled' && <PayInfo o={o} />}

      <div className="o-info">
        <div className="o-card"><h3>İletişim</h3><p><b>{o.contact?.name}</b></p><p className="num">{o.contact?.phone}</p>{o.contact?.email && <p>{o.contact.email}</p>}</div>
        <div className="o-card"><h3>Teslimat</h3><p><b>{DELIVERY[o.delivery?.method] || ''}</b></p>{o.delivery?.addr ? <p>{addrLine(o.delivery.addr)}</p> : <p>{[S.shop.address, S.shop.hours].filter(Boolean).join(' · ')}</p>}</div>
        <div className="o-card"><h3>Fatura</h3><InvoiceText inv={o.invoice} name={o.contact?.name} deliv={o.delivery?.addr} /></div>
      </div>
      {o.note && <p className="o-note"><b>Notunuz:</b> {o.note}</p>}

      <ListPaper r={{ no: o.no, gname: o.contact?.name, items, status: 'priced', createdAt: o.createdAt, updatedAt: o.createdAt, rate: o.rate ? { usd: o.rate, src: 'harem' } : null }} label="Sipariş" />
      {o.status === 'new' && (mine
        ? <button className="btn ghost danger gclear" onClick={cancel}><Icon n="x" s={15} />Siparişi iptal et</button>
        : !o.uid && <p className="fine center">Siparişte değişiklik ya da iptal için {wa ? <a className="link" href={wa} target="_blank" rel="noopener">WhatsApp’tan yazın</a> : 'bizi arayın'}.</p>)}
      <p className="fine center admin-hint">Dükkan sahibi misiniz? <a href={links.adminOrder(o.id)}>Yönetim panelinde aç</a></p>
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

export function InvoiceText({ inv, name, deliv }) {
  if (!inv) return null;
  const addr = inv.same === false ? inv.addr : deliv;
  return <>
    {inv.type === 'company'
      ? <><p><b>{inv.company}</b></p><p>{inv.taxOffice} VD · <span className="num">{inv.taxNo}</span></p></>
      : <><p><b>Bireysel</b> · {name}</p>{inv.tc && <p className="num">TC {inv.tc}</p>}</>}
    {addr && <p className="muted">{inv.same === false ? addrLine(addr) : 'Teslimat adresi ile aynı'}</p>}
  </>;
}

function PayInfo({ o }) {
  const S = useStore((s) => s.settings);
  if (o.pay === 'havale') return (
    <div className="banner ok pay-info"><Icon n="tag" /><div>
      <b>Havale / EFT</b>
      {S.shop.payInfo ? <><pre>{S.shop.payInfo}</pre><span className="fine">Açıklamaya sipariş numarasını yazın: <b>#{o.no}</b>. Siparişiniz onaylanınca ödeme yapmanız yeterli.</span></> : <p>Banka bilgilerini sipariş onayıyla birlikte göndereceğiz.</p>}
    </div></div>
  );
  if (o.pay === 'card') return <div className="banner info"><Icon n="tag" /><div><b>Kredi kartı</b><p>Siparişiniz onaylanınca güvenli ödeme linkini telefonunuza / e-postanıza göndereceğiz.</p></div></div>;
  return <div className="banner info"><Icon n="store" /><div><b>Dükkanda ödeme</b><p>Teslim alırken ödeyebilirsiniz.</p></div></div>;
}

// =============================================================================================
// Giriş / üye ol (Hesabım sayfasında ve sipariş adımında pencere olarak)
function AuthForm({ onDone, compact }) {
  const { api: A, settings: S } = useStore();
  const [view, setView] = useState('login'); // login | signup | reset | resetSent
  const [f, setF] = useState({ email: '', pw: '', pw2: '', name: '', phone: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const canSignup = S.orders?.signup !== false;
  async function submit(e) {
    e.preventDefault(); setErr('');
    const email = f.email.trim().toLowerCase();
    if (!emailOk(email)) return setErr('E-posta adresini kontrol edin.');
    setBusy(true);
    try {
      if (view === 'login') { await A.memberLogin(email, f.pw); toast('Giriş yapıldı'); onDone?.(); }
      else if (view === 'signup') {
        if (f.name.trim().length < 3) throw new Error('Adınızı ve soyadınızı yazın.');
        if (phoneDigits(f.phone).length !== 11) throw new Error('Telefonu 0(5xx) xxx xx xx şeklinde yazın.');
        if (f.pw.length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
        if (f.pw !== f.pw2) throw new Error('Şifreler aynı değil.');
        await A.memberSignup({ email, password: f.pw, name: f.name.trim(), phone: f.phone });
        toast('Üyeliğiniz oluşturuldu'); onDone?.();
      } else { await A.memberReset(email); setView('resetSent'); }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  if (view === 'resetSent') return (
    <div className="auth-form">
      <p>Şifre sıfırlama bağlantısını <b>{f.email}</b> adresine gönderdik. E-postanızı (gerekirse gereksiz klasörünü) kontrol edin.</p>
      <button className="btn outline" onClick={() => setView('login')}>Girişe dön</button>
    </div>
  );
  return (
    <form className="auth-form" onSubmit={submit}>
      {view !== 'reset' && canSignup && (
        <div className="tabs auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'login'} className={'tab' + (view === 'login' ? ' on' : '')} onClick={() => { setErr(''); setView('login'); }}>Giriş yap</button>
          <button type="button" role="tab" aria-selected={view === 'signup'} className={'tab' + (view === 'signup' ? ' on' : '')} onClick={() => { setErr(''); setView('signup'); }}>Üye ol</button>
        </div>
      )}
      {view === 'reset' && <p className="fine">E-posta adresinizi yazın, şifre sıfırlama bağlantısı gönderelim.</p>}
      {view === 'signup' && <>
        <Field label="Ad soyad"><input id="m-name" autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="Cep telefonu"><PhoneInput id="m-phone" value={f.phone} onChange={set('phone')} /></Field>
      </>}
      <Field label="E-posta"><input id="m-email" type="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={set('email')} required /></Field>
      {view !== 'reset' && <Field label="Şifre" hint={view === 'signup' ? 'En az 6 karakter' : ''}><PasswordInput id="m-pw" autoComplete={view === 'signup' ? 'new-password' : 'current-password'} value={f.pw} onChange={set('pw')} required /></Field>}
      {view === 'signup' && <Field label="Şifre (tekrar)"><PasswordInput id="m-pw2" autoComplete="new-password" value={f.pw2} onChange={set('pw2')} required /></Field>}
      {err && <p className="err">{err}</p>}
      <button className="btn primary big center-btn" disabled={busy}>{busy ? 'Bekleyin…' : view === 'login' ? 'Giriş yap' : view === 'signup' ? 'Üye ol' : 'Bağlantı gönder'}</button>
      {view === 'login' && <button type="button" className="link center" onClick={() => { setErr(''); setView('reset'); }}>Şifremi unuttum</button>}
      {view === 'reset' && <button type="button" className="link center" onClick={() => setView('login')}>← Girişe dön</button>}
      {!compact && <p className="fine center">Üye olmadan da sipariş verebilirsiniz: sepeti onaylayıp bilgilerinizi yazmanız yeterli.</p>}
    </form>
  );
}
function AuthSheet({ onClose }) {
  return <Sheet title="Giriş yap" sub="Kayıtlı bilgileriniz siparişe otomatik dolar" onClose={onClose}><AuthForm compact onDone={onClose} /></Sheet>;
}

// =============================================================================================
// Hesabım
export function Account() {
  const member = useStore((s) => s.member);
  const S = useStore((s) => s.settings);
  if (!member) return (
    <div className="page narrow acct">
      <div className="acct-hero">
        <h1 className="page-t">Hesabım</h1>
        <p className="muted">Üye olun; adres ve fatura bilgileriniz her siparişte hazır gelsin, siparişlerinizi buradan takip edin.</p>
      </div>
      <div className="set-card"><AuthForm /></div>
      <LocalOrders />
      <ShopCard S={S} />
    </div>
  );
  return <MemberHome />;
}

function LocalOrders() {
  const list = myLocalOrders();
  if (!list.length) return null;
  return (
    <div className="set-card">
      <h2>Bu cihazdan verilen siparişler</h2>
      <ul className="olist">{list.map((x) => <li key={x.id}><button className="ocard" onClick={() => openOrder(x.id)}><b className="num">#{x.no}</b><span className="muted">{when(x.at)}</span><Icon n="back" s={16} className="flip" /></button></li>)}</ul>
    </div>
  );
}

function ShopCard({ S }) {
  return (
    <div className="set-card shop-card">
      <h2>{S.shop.name}</h2>
      {S.shop.address && <p><Icon n="store" s={16} />{S.shop.address}</p>}
      {S.shop.hours && <p><Icon n="clock" s={16} />{S.shop.hours}</p>}
      {S.shop.phone && <p><Icon n="phone" s={16} /><a href={'tel:' + S.shop.phone}>{S.shop.phone}</a></p>}
      {S.shop.whatsapp && <p><Icon n="wa" s={16} /><a href={waLink(S.shop.whatsapp, 'Merhaba,')} target="_blank" rel="noopener">WhatsApp: {S.shop.whatsapp}</a></p>}
    </div>
  );
}

function MemberHome() {
  const { member: m, myOrders, api: A, settings: S } = useStore();
  const [tab, setTab] = useState('orders');
  return (
    <div className="page acct">
      <div className="profile-card">
        <Avatar u={m} size={64} />
        <div className="acct-id">
          <h1 className="page-t">{m.name || 'Hesabım'}</h1>
          <p className="muted">{m.email}</p>{m.phone && <p className="muted num">{m.phone}</p>}
        </div>
        <button className="btn sm ghost danger" onClick={() => A.memberLogout().then(() => toast('Çıkış yapıldı'))}><Icon n="out" s={16} />Çıkış</button>
      </div>
      <div className="tabs" role="tablist">
        {[['orders', `Siparişlerim${myOrders.length ? ' (' + myOrders.length + ')' : ''}`], ['addr', 'Adreslerim'], ['info', 'Bilgilerim']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'orders' && (myOrders.length ? (
        <ul className="olist">
          {myOrders.map((o) => (
            <li key={o.id}>
              <button className="ocard" onClick={() => openOrder(o.id)}>
                <span className="ocard-b">
                  <span className="ocard-top"><b className="num">#{o.no}</b><StatusPill status={o.status} map={ORDER_STATUS} /></span>
                  <span className="muted">{when(o.createdAt)} · {(o.items || []).length} ürün · {DELIVERY[o.delivery?.method]}</span>
                </span>
                <b className="num ocard-sum">{fmtTotals(o.total || totals(orderItems(o), 'offer'))}</b>
                <Icon n="back" s={16} className="flip" />
              </button>
            </li>
          ))}
        </ul>
      ) : <Empty icon="cart" title="Henüz siparişiniz yok"><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty>)}
      {tab === 'addr' && <Addresses />}
      {tab === 'info' && <MyInfo />}
      <ShopCard S={S} />
    </div>
  );
}

function Addresses() {
  const { member: m, api: A } = useStore();
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState({});
  const list = m.addresses || [];
  async function save() {
    const e = addrErrors(edit, 'addr'); setErr(e); if (Object.keys(e).length) return;
    const a = { ...edit, district: edit.district.trim(), address: edit.address.trim() };
    const addresses = list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a];
    try { await A.saveMember({ ...m, addresses }); toast('Adres kaydedildi'); setEdit(null); } catch (x) { toast('Kaydedilemedi: ' + x.message, 'bad'); }
  }
  const del = (a) => A.saveMember({ ...m, addresses: list.filter((x) => x.id !== a.id) }).then(() => toast('Adres silindi'));
  const first = (a) => A.saveMember({ ...m, addresses: [a, ...list.filter((x) => x.id !== a.id)] }).then(() => toast('Varsayılan adres değişti'));
  return (
    <div className="addr-list">
      {list.map((a, i) => (
        <div key={a.id} className="addr-card static">
          <span><b>{a.title || 'Adres'}{i === 0 && <span className="tag">Varsayılan</span>}</b><small>{addrLine(a)}</small></span>
          <span className="row-btns">
            {i > 0 && <button className="btn sm ghost" onClick={() => first(a)}>Varsayılan yap</button>}
            <button className="btn sm ghost" onClick={() => { setErr({}); setEdit({ ...a }); }}><Icon n="edit" s={15} />Düzenle</button>
            <button className="icon-btn sm" onClick={() => del(a)} aria-label="Sil"><Icon n="trash" s={15} /></button>
          </span>
        </div>
      ))}
      <button className="btn outline" onClick={() => { setErr({}); setEdit(blankAddr()); }}><Icon n="plus" s={16} />Yeni adres ekle</button>
      {edit && (
        <Sheet title={list.some((x) => x.id === edit.id) ? 'Adresi düzenle' : 'Yeni adres'} onClose={() => setEdit(null)} footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Vazgeç</button><button className="btn primary" onClick={save}><Icon n="check" s={16} />Kaydet</button></>}>
          <AddressFields a={edit} set={setEdit} err={err} p="addr" title />
        </Sheet>
      )}
    </div>
  );
}

function MyInfo() {
  const { member: m, api: A } = useStore();
  const [f, setF] = useState(() => ({ name: m.name || '', phone: m.phone || '', inv: { type: 'person', tc: '', company: '', taxOffice: '', taxNo: '', ...(m.invoice || {}) } }));
  const [busy, setBusy] = useState(false);
  const setI = (k, v) => setF((x) => ({ ...x, inv: { ...x.inv, [k]: v } }));
  async function save() {
    if (f.name.trim().length < 3) return toast('Adınızı yazın', 'bad');
    setBusy(true);
    try {
      const inv = f.inv.type === 'company' ? { type: 'company', company: f.inv.company.trim(), taxOffice: f.inv.taxOffice.trim(), taxNo: digits(f.inv.taxNo) } : { type: 'person', ...(f.inv.tc ? { tc: digits(f.inv.tc) } : {}) };
      await A.saveMember({ ...m, name: f.name.trim(), phone: f.phone, invoice: inv }); toast('Bilgileriniz kaydedildi');
    } catch (x) { toast('Kaydedilemedi: ' + x.message, 'bad'); }
    setBusy(false);
  }
  return (
    <div className="set-card">
      <div className="row2">
        <Field label="Ad soyad"><input id="mi-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Cep telefonu"><PhoneInput id="mi-phone" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></Field>
      </div>
      <Field label="E-posta" hint="Giriş için kullanılır, değiştirilemez"><input id="mi-email" value={m.email || ''} readOnly /></Field>
      <h3>Fatura bilgileri</h3>
      <div className="seg-cards two" role="radiogroup">
        <Choice on={f.inv.type === 'person'} onClick={() => setI('type', 'person')} title="Bireysel" />
        <Choice on={f.inv.type === 'company'} onClick={() => setI('type', 'company')} title="Kurumsal" />
      </div>
      {f.inv.type === 'person'
        ? <Field label="TC kimlik no" opt><input id="mi-tc" inputMode="numeric" maxLength={11} value={f.inv.tc || ''} onChange={(e) => setI('tc', digits(e.target.value).slice(0, 11))} /></Field>
        : <>
          <Field label="Firma ünvanı"><input id="mi-company" value={f.inv.company || ''} onChange={(e) => setI('company', e.target.value)} /></Field>
          <div className="row2">
            <Field label="Vergi dairesi"><input id="mi-taxoffice" value={f.inv.taxOffice || ''} onChange={(e) => setI('taxOffice', e.target.value)} /></Field>
            <Field label="Vergi no"><input id="mi-taxno" inputMode="numeric" maxLength={11} value={f.inv.taxNo || ''} onChange={(e) => setI('taxNo', digits(e.target.value).slice(0, 11))} /></Field>
          </div>
        </>}
      <button className="btn primary" disabled={busy} onClick={save}><Icon n="check" s={16} />Kaydet</button>
    </div>
  );
}
