// Online mağaza (/magaza) sipariş akışı:
//   Checkout   sepetten sonra: iletişim, teslimat, fatura, ödeme → "Siparişi tamamla" → Yönetim paneli > Siparişler
//   OrderPage  sipariş alındı / takip sayfası (/magaza/s/<no>)
//   Account    Hesabım: giriş, üye ol, şifre sıfırlama, siparişlerim, adreslerim, bilgilerim
// Misafir de sipariş verebilir (bilgileri her seferinde yazar); üye olunca bilgileri otomatik dolar (ekranda görür, değiştirebilir).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, api, toast, go, clearCart, openOrder, openAcct, orderSeen, unseenOrders } from './store.js';
import { Icon, Thumb, Empty, PhoneInput, phoneDigits, PasswordInput, VatLines, StatusPill, Confirm, Sheet, Field, Avatar, copyText } from './ui.jsx';
import { fmt, totals, fmtTotals, when, ls, rid, now, cleanUsername, soon, resizeImage } from './utils.js';
import { ORDER_STATUS, ORDER_OPEN, PAY, DELIVERY, ILLER } from './config.js';
import { links, waLink } from './route.js';
import { ListPaper, useRate, toTL, fmtTL } from './listsheet.jsx';
import { pushState, enablePush, autoPush, disablePush, isIOS, pingWatch } from './push.js';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const orderNo = () => Array.from({ length: 6 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
const digits = (v) => String(v || '').replace(/\D/g, '');
const unameOk = (u) => /^[a-z0-9._-]{3,20}$/.test(u);
const suggestUser = (email) => cleanUsername(String(email || '').split('@')[0]).slice(0, 20);
const blankAddr = () => ({ id: rid(), title: '', city: '', district: '', address: '' });
export const addrLine = (a) => (!a ? '' : [a.address, [a.district, a.city].filter(Boolean).join(' / ')].filter(Boolean).join(', '));
// Firestore "undefined" kabul etmez: boş alanları temizle
const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? undefined : v)));
const myLocalOrders = () => ls.get('my-orders', []);
export const orderItems = (o) => (o.items || []).map((i) => ({ ...i, offer: i.price }));

// ---- Adres alanları -------------------------------------------------------------------------
function AddressFields({ a, set, err = {}, p = 'addr', title, recip }) {
  const up = (k) => (e) => set({ ...a, [k]: e.target.value });
  return (
    <div className="form-col addr-fields">
      {title && <Field label="Adres adı" opt><input id={p + '-title'} placeholder="ör. Ev, İş, Dükkan" value={a.title || ''} onChange={up('title')} /></Field>}
      {recip && <div className="row2">
        <Field label="Alıcının adı soyadı" error={err[p + '.name']}><input id={p + '-name' } value={a.name || ''} onChange={up('name')} autoComplete="name" /></Field>
        <Field label="Alıcının telefonu" error={err[p + '.phone']}><PhoneInput id={p + '-phone'} value={a.phone || ''} onChange={(v) => set({ ...a, phone: v })} /></Field>
      </div>}
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
function addrErrors(a, p, recip) {
  const e = {};
  if (recip) {
    if (String(a?.name || '').trim().length < 3) e[p + '.name'] = 'Alıcının adını soyadını yazın';
    if (phoneDigits(a?.phone).length !== 11) e[p + '.phone'] = 'Telefonu yazın (0 5xx xxx xx xx)';
  }
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
export function Checkout({ items, onBack, single }) { // single: "Hemen satın al" — sadece o ürün; sepete dokunulmaz
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
  // iletişim adı/telefonu yazılırken alıcı kutuları boşsa ya da aynıysa onlar da dolar (alıcı farklıysa değiştirilir)
  const setC = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    const patch = { contact: { ...f.contact, [k]: v } };
    if ((k === 'name' || k === 'phone') && (!f.addr[k] || f.addr[k] === '0' || f.addr[k] === f.contact[k])) patch.addr = { ...f.addr, [k]: v };
    set(patch);
  };
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
    if (!member && f.signup) { if (!emailOk(f.contact.email)) e.email = 'Üyelik için e-posta gerekli'; if (f.pw.length < 6) e.pw = 'Şifre en az 6 karakter olmalı'; if (f.uname && !unameOk(f.uname)) e.uname = '3-20 karakter: harf, rakam, nokta, tire'; }
    if (f.method === 'cargo') Object.assign(e, addrErrors(delivAddr, 'addr', f.addrId === 'new' || !saved.length));
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
      const cleanA = (a, who) => a && { city: a.city, district: a.district.trim(), address: a.address.trim(), ...(a.title ? { title: a.title } : {}), ...(who !== false ? { name: String(a.name || f.contact.name).trim(), phone: a.phone || f.contact.phone } : {}) };
      const inv = f.inv.type === 'company'
        ? { type: 'company', company: f.inv.company.trim(), taxOffice: f.inv.taxOffice.trim(), taxNo: digits(f.inv.taxNo) }
        : { type: 'person', ...(f.inv.tc ? { tc: digits(f.inv.tc) } : {}) };
      // sipariş verirken üye ol: hesap + bilgiler kaydedilir, doğrulama e-postası gider; sipariş yazılınca oturum kapanır (doğrulayınca giriş yapar)
      let signedUp = false;
      if (!member && f.signup) {
        const addr = f.method === 'cargo' ? [{ ...cleanA(delivAddr), id: rid(), title: 'Adresim' }] : [];
        const m = await A.memberSignup({ email, password: f.pw, name: f.contact.name.trim(), phone: f.contact.phone, username: f.uname || undefined, addresses: addr, invoice: inv }, true);
        uid = m.uid; signedUp = true;
      }
      const t = now(), no = orderNo(), id = A.newOrderId();
      const order = strip({
        no, uid, member: !!uid, status: 'new', createdAt: t, updatedAt: t, unread: 1, history: [{ s: 'new', at: t }],
        items: items.map(({ id: pid, k, n, cur, qty, offer, pi, u }) => ({ id: pid, k, n, cur, qty, price: offer, pi, u })),
        total: tot, rate: rate?.usd || null,
        contact: { name: f.contact.name.trim(), phone: f.contact.phone, email },
        delivery: { method: f.method, addr: f.method === 'cargo' ? cleanA(delivAddr) : null },
        // teslimat adresiyle aynıysa adres faturaya da yazılır (fatura kendi başına eksiksiz okunsun)
        invoice: { ...inv, same: f.method !== 'cargo' || f.billSame, addr: f.method === 'cargo' ? (f.billSame ? cleanA(delivAddr) : cleanA(f.bill, false)) : f.bill?.address ? cleanA(f.bill, false) : null },
        pay: f.pay, note: f.note.trim(),
      });
      try { await A.placeOrder(order, id); } finally { if (signedUp) await A.memberDone(); }
      // dükkan sahibine bildirim (e-posta + WhatsApp, bekçi üzerinden); sipariş zaten kaydedildi, hata olursa önemli değil
      if (A.mode === 'firebase') autoPush(id);
      if (window.WATCH_URL && A.mode === 'firebase') fetch(window.WATCH_URL.replace(/\/$/, '') + '/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
      // üye: yeni adresi ve fatura bilgisini hesaba kaydet
      if (uid && !signedUp) {
        const m = store.s.member || { uid };
        // fatura adresi: siparişte ayrı adres yazıldıysa hesaba o kaydedilir, yoksa kayıtlı olan korunur
        const iaddr = f.method === 'cargo' && !f.billSame ? cleanA(f.bill, false) : m.invoice?.addr;
        const patch = { uid, name: m.name || order.contact.name, phone: m.phone || order.contact.phone, invoice: { ...inv, ...(iaddr?.address ? { addr: { city: iaddr.city, district: iaddr.district, address: iaddr.address } } : {}) } };
        let addrs = m.addresses || [];
        if (f.method === 'cargo' && (f.addrId === 'new' || !saved.length) && (f.saveAddr || f.signup)) addrs = [...addrs, { ...cleanA(delivAddr), id: rid(), title: delivAddr.title || (addrs.length ? 'Adres ' + (addrs.length + 1) : 'Adresim') }];
        patch.addresses = addrs;
        try { await A.saveMember({ ...m, ...patch }); } catch (x) { console.warn(x); }
      }
      if (!member) {
        ls.set('my-orders', [{ id, no, at: t }, ...myLocalOrders()].slice(0, 20));
        ls.set('guest-checkout', { contact: order.contact, addr: f.method === 'cargo' ? { ...cleanA(delivAddr), id: 'g' } : null, inv: f.inv }); // bu cihazda bir dahakine hazır gelsin
      }
      if (single) store.set({ buyNow: null }); else clearCart();
      openOrder(id, signedUp ? 'verify' : true);
    } catch (x) { toast('Sipariş gönderilemedi: ' + x.message, 'bad'); }
    setBusy(false);
  }

  return (
    <div className="page checkout" ref={formRef}>
      <div className="send-bar">
        <button className="btn co-back-btn" onClick={onBack}><Icon n="back" s={17} />{single ? 'Vazgeç' : <><Icon n="cart" s={17} />Sepete dön</>}</button>
        <div className="send-t"><b>Siparişi tamamla</b><span className="muted">{items.length} ürün · {fmtTotals(tot)}</span></div>
      </div>
      <div className="co-grid">
        <div className="co-main">
          {!member ? (
            <div className="co-who">
              <Icon n="user" s={20} />
              <span className="co-who-t"><b>Misafir olarak devam ediyorsunuz.</b> Üyeyseniz giriş yapın, bilgileriniz otomatik dolsun.</span>
              {!soon(S, 'accountsSoon') && <button className="btn sm outline" onClick={() => setAuth(true)}>Giriş yap</button>}
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
                      <span className="radio" aria-hidden="true" /><span><b>{a.title || 'Adres'}</b><small>{[a.name, addrLine(a)].filter(Boolean).join(' · ')}</small></span>
                    </button>
                  ))}
                  <button type="button" role="radio" aria-checked={f.addrId === 'new'} className={'addr-card add' + (f.addrId === 'new' ? ' on' : '')} onClick={() => set({ addrId: 'new' })}>
                    <span className="radio" aria-hidden="true" /><span><b>Yeni adres</b><small>Başka bir adrese gönder</small></span>
                  </button>
                </div>
              )}
              {(f.addrId === 'new' || !saved.length) && <>
                <AddressFields a={f.addr} set={(addr) => set({ addr })} err={err} p="addr" title={!!member} recip />
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

          {!member && O.signup !== false && !soon(S, 'accountsSoon') && (
            <section className="co-sec co-signup">
              <label className="mini-check big"><input type="checkbox" checked={f.signup} onChange={(e) => set({ signup: e.target.checked, uname: f.uname || suggestUser(f.contact.email) })} /><span><b>Bu bilgilerle üye ol</b> <small className="muted">— bir dahaki siparişte her şey hazır gelir, siparişlerinizi takip edersiniz</small></span></label>
              {f.signup && <div className="row2">
                <Field label="Kullanıcı adı" opt error={err.uname} hint="E-posta yerine bununla da giriş yapabilirsiniz"><input id="co-uname" autoCapitalize="none" value={f.uname} placeholder={suggestUser(f.contact.email)} onChange={(e) => set({ uname: cleanUsername(e.target.value).slice(0, 20) })} /></Field>
                <Field label="Şifre belirleyin" error={err.pw} hint="En az 6 karakter"><PasswordInput id="co-pw" autoComplete="new-password" value={f.pw} onChange={(e) => set({ pw: e.target.value })} /></Field>
              </div>}
              {f.signup && <p className="fine">Siparişten sonra e-postanıza bir doğrulama bağlantısı gelir; ona tıklayınca üyeliğiniz açılır.</p>}
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
            <button className="btn primary big co-go" disabled={busy} onClick={submit}><Icon n="check" /><span><b>{busy ? 'Gönderiliyor…' : 'Siparişi tamamla'}</b></span></button>
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
    addr: { ...blankAddr(), name: m?.name || g.contact?.name || '', phone: m?.phone || g.contact?.phone || '', ...(!m && g.addr ? g.addr : {}) },
    saveAddr: true,
    inv: { type: inv0.type || 'person', tc: inv0.tc || '', company: inv0.company || '', taxOffice: inv0.taxOffice || '', taxNo: inv0.taxNo || '' },
    // hesapta kayıtlı fatura adresi varsa siparişte o gelir; "teslimat adresiyle aynı" sadece siparişte seçilir
    billSame: false, bill: inv0.addr?.address ? { ...blankAddr(), ...inv0.addr } : blankAddr(), pay: 'havale', note: '', signup: false, pw: '', uname: '',
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
  useEffect(() => { if (o) orderSeen(o); }, [o?.id, o?.updatedAt]); // açılan sipariş artık "yeni güncelleme" sayılmaz
  if (o === null) return <div className="page narrow"><Empty icon="search" title="Sipariş bulunamadı"><p>Link eksik kopyalanmış olabilir.</p><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty></div>;
  if (!o) return <div className="page narrow list-wait"><div className="spinner" aria-label="Yükleniyor" />{slow && <><p>Bağlantı yavaş görünüyor.</p><button className="btn primary" onClick={() => location.reload()}><Icon n="refresh" s={16} />Tekrar dene</button></>}</div>;
  const link = links.order(o.id);
  const items = orderItems(o);
  const st = ORDER_STATUS[o.status] || ORDER_STATUS.new;
  const mine = member && o.uid === member.uid;
  const steps = ['new', 'confirmed', o.delivery?.method === 'pickup' ? 'ready' : 'shipped', 'done'];
  const cur = steps.indexOf(o.status);
  const wa = S.shop.whatsapp ? waLink(S.shop.whatsapp, `Merhaba, #${o.no} numaralı siparişim:\n${link}`) : null;
  const cancel = () => setConfirm({ title: 'Siparişi iptal et', text: 'Siparişiniz iptal edilecek. Emin misiniz?', okLabel: 'İptal et', tone: 'danger', onOk: () => api().updateOrder(o.id, { status: 'cancelled', updatedAt: now(), history: [...(o.history || []), { s: 'cancelled', at: now(), by: 'customer' }] }).then(() => { toast('Sipariş iptal edildi'); if (api().mode === 'firebase') pingWatch('/notify-cancel', { id: o.id }); }, (e) => toast('İptal edilemedi: ' + e.message, 'bad')) });
  return (
    <div className="page order-page">
      <div className="list-top">
        <button className="btn sm ghost" onClick={() => (member ? openAcct('orders') : go('katalog'))}><Icon n="back" s={16} />{member ? 'Siparişlerim' : 'Ürünler'}</button>
        <span className="list-top-r"><PayChip o={o} /><StatusPill status={o.status} map={ORDER_STATUS} /></span>
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
          {orderJust === 'verify' && <div className="banner info verify-note"><Icon n="check" /><div><b>Üyeliğinizi tamamlayın:</b> <span>{o.contact?.email}</span> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayınca giriş yapabilir, siparişlerinizi Hesabım’dan takip edebilirsiniz. Gelmediyse gereksiz (spam) klasörüne bakın.</div></div>}
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

      {o.status !== 'cancelled' && o.status !== 'done' && <PushCard ids={[o.id]} hideOn />}

      <div className="o-info">
        <div className="o-card"><h3>İletişim</h3><p><b>{o.contact?.name}</b></p><p className="num">{o.contact?.phone}</p>{o.contact?.email && <p>{o.contact.email}</p>}</div>
        <div className="o-card"><h3>Teslimat</h3><p><b>{DELIVERY[o.delivery?.method] || ''}</b></p>{o.delivery?.addr ? <>{o.delivery.addr.name && <p>{o.delivery.addr.name}{o.delivery.addr.phone && <> · <span className="num">{o.delivery.addr.phone}</span></>}</p>}<p>{addrLine(o.delivery.addr)}</p></> : <p>{[S.shop.address, S.shop.hours].filter(Boolean).join(' · ')}</p>}</div>
        <div className="o-card"><h3>Fatura</h3><InvoiceText inv={o.invoice} name={o.contact?.name} deliv={o.delivery?.addr} phone={o.contact?.phone} /></div>
      </div>
      {o.note && <p className="o-note"><b>Notunuz:</b> {o.note}</p>}

      <ListPaper r={{ no: o.no, gname: o.contact?.name, items, status: 'priced', createdAt: o.createdAt, updatedAt: o.createdAt, rate: o.rate ? { usd: o.rate, src: 'harem' } : null }} label="Sipariş" viewOnly />
      {o.status === 'new' && (mine
        ? <button className="btn ghost danger gclear" onClick={cancel}><Icon n="x" s={15} />Siparişi iptal et</button>
        : !o.uid && <p className="fine center">Siparişte değişiklik ya da iptal için {wa ? <a className="link" href={wa} target="_blank" rel="noopener">WhatsApp’tan yazın</a> : 'bizi arayın'}.</p>)}
      <p className="fine center admin-hint">Dükkan sahibi misiniz? <a href={links.adminOrder(o.id)}>Yönetim panelinde aç</a></p>
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// Sipariş durumu bildirimi (web push): telefona "onaylandı / kargoda…" bildirimi
export function PushCard({ ids, compact, hideOn }) {
  const S = useStore((st) => st.settings);
  const [st, setSt] = useState(() => pushState());
  const [busy, setBusy] = useState(false);
  if (S.orders?.push === false || st === 'unsupported' || !ids.length) return null;
  const on = async () => { setBusy(true); try { await enablePush(ids); setSt('on'); toast('Bildirimler açıldı'); } catch (e) { setSt(pushState()); toast(e.message, 'bad'); } setBusy(false); };
  if (st === 'on' && hideOn) return null;
  if (st === 'on') return (
    <div className={'push-card on' + (compact ? ' compact' : '')}>
      <span className="push-ic"><Icon n="bell" s={20} /></span>
      <div><b>Bildirimler açık</b><small>Siparişiniz onaylanınca, kargoya verilince telefonunuza haber vereceğiz.</small></div>
      {compact && <button className="btn sm ghost" onClick={() => { disablePush(); setSt('off'); }}>Kapat</button>}
    </div>
  );
  if (st === 'ios-home') return (
    <div className={'push-card ios' + (compact ? ' compact' : '')}>
      <span className="push-ic"><Icon n="bell" s={20} /></span>
      <div><b>Sipariş durumunu bildirimle alın</b>
        <small>iPhone’da bildirim için sayfayı ana ekrana ekleyin: alttaki <b>Paylaş</b> <Icon n="share" s={13} /> düğmesi → <b>Ana Ekrana Ekle</b>. Sonra ana ekrandaki simgeden açıp buradan bildirimleri açın.</small></div>
    </div>
  );
  if (st === 'denied') return (
    <div className={'push-card off' + (compact ? ' compact' : '')}>
      <span className="push-ic"><Icon n="bell" s={20} /></span>
      <div><b>Bildirimler engellenmiş</b><small>{isIOS() ? 'Ayarlar > Bildirimler’den ERTEL GSM’e izin verin.' : 'Tarayıcının adres çubuğundaki kilit simgesinden bildirimlere izin verin.'}</small></div>
    </div>
  );
  return (
    <div className={'push-card' + (compact ? ' compact' : '')}>
      <span className="push-ic"><Icon n="bell" s={20} /></span>
      <div><b>Sipariş durumunu bildirimle alın</b><small>Onaylandı, kargoya verildi… her adımda telefonunuza haber verelim.</small></div>
      <button className="btn sm primary" disabled={busy} onClick={on}>{busy ? 'Bekleyin…' : 'Bildirimleri aç'}</button>
    </div>
  );
}

export function InvoiceText({ inv, name, deliv, phone }) {
  if (!inv) return null;
  const addr = inv.addr || (inv.same !== false ? deliv : null); // eski siparişlerde "aynı" ise teslimat adresi
  const where = addr ? ['Türkiye', addr.city, addr.district].filter(Boolean).join(' / ') : '';
  const tels = [phone, addr?.phone].filter((x, i, a) => x && a.indexOf(x) === i);
  return <div className="inv-text">
    {inv.type === 'company'
      ? <p><b>{inv.company}</b>{inv.taxOffice && <> / {inv.taxOffice}</>}{inv.taxNo && <> / <span className="num">{inv.taxNo}</span></>}</p>
      : <p><b>{name}</b>{inv.tc ? <> / TC <span className="num">{inv.tc}</span></> : <span className="muted"> · Bireysel</span>}</p>}
    {addr?.address && <p>{addr.address}</p>}
    {where && <p>{where}</p>}
    {tels.length > 0 && <p className="num">{tels.join('    ')}</p>}
  </div>;
}

// Ödeme yöntemi: küçük çip; havalede banka bilgisi varsa dokununca açılır
function PayChip({ o }) {
  const S = useStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  if (!o.pay) return null;
  const bank = o.pay === 'havale' && S.shop.payInfo;
  return <>
    <button type="button" className={'pay-chip' + (bank ? ' link' : '')} onClick={bank ? () => setOpen(true) : undefined} disabled={!bank}><Icon n={o.pay === 'shop' ? 'store' : 'tag'} s={13} />{PAY[o.pay]}{bank && <Icon n="chev" s={12} />}</button>
    {open && <Sheet title="Havale / EFT bilgileri" onClose={() => setOpen(false)}><div className="pay-info sel-ok"><pre>{S.shop.payInfo}</pre><p className="fine">Açıklamaya sipariş numarasını yazın: <b>#{o.no}</b></p></div></Sheet>}
  </>;
}

// =============================================================================================
// Giriş / üye ol (Hesabım sayfasında ve sipariş adımında pencere olarak)
function AuthForm({ onDone, compact }) {
  const { api: A, settings: S } = useStore();
  const [view, setView] = useState('login'); // login | signup | reset | resetSent | verifySent | unverified
  const [f, setF] = useState({ id: '', email: '', uname: '', pw: '', pw2: '', name: '', phone: '' });
  const [err, setErr] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const canSignup = S.orders?.signup !== false;
  const go2 = (v) => { setErr(''); setView(v); };
  async function submit(e) {
    e.preventDefault(); setErr('');
    setBusy(true);
    try {
      if (view === 'login') {
        if (!f.id.trim()) throw new Error('E-posta ya da kullanıcı adınızı yazın.');
        await A.memberLogin(f.id, f.pw); toast('Giriş yapıldı'); onDone?.();
      } else if (view === 'signup') {
        const email = f.email.trim().toLowerCase();
        if (f.name.trim().length < 3) throw new Error('Adınızı ve soyadınızı yazın.');
        if (!emailOk(email)) throw new Error('E-posta adresini kontrol edin.');
        if (f.uname && !unameOk(f.uname)) throw new Error('Kullanıcı adı 3-20 karakter olmalı (harf, rakam, nokta, tire).');
        if (phoneDigits(f.phone).length !== 11) throw new Error('Telefonu 0(5xx) xxx xx xx şeklinde yazın.');
        if (f.pw.length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
        if (f.pw !== f.pw2) throw new Error('Şifreler aynı değil.');
        await A.memberSignup({ email, password: f.pw, name: f.name.trim(), phone: f.phone, username: f.uname || undefined });
        setSentTo(email); setF((x) => ({ ...x, id: f.uname || email, pw: '' })); setView(A.mode === 'demo' ? 'login' : 'verifySent');
        if (A.mode === 'demo') toast('Üyeliğiniz oluşturuldu, giriş yapın');
      } else if (view === 'reset') {
        if (!f.id.trim()) throw new Error('E-posta ya da kullanıcı adınızı yazın.');
        setSentTo(await A.memberReset(f.id)); setView('resetSent');
      }
    } catch (x) { if (x.code === 'unverified') setView('unverified'); setErr(x.message); }
    setBusy(false);
  }
  async function resend() {
    setBusy(true); setErr('');
    try { setSentTo(await A.memberResendVerify(f.id, f.pw)); setView('verifySent'); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  if (view === 'resetSent' || view === 'verifySent') return (
    <div className="auth-form auth-sent">
      <span className="sent-ic"><Icon n="send" s={26} /></span>
      {view === 'resetSent'
        ? <p>Bu bilgilerle bir üyelik varsa <b>{sentTo}</b> adresine şifre yenileme bağlantısı gönderdik. Bağlantıya tıklayıp yeni şifrenizi belirleyin.</p>
        : <p><b>{sentTo}</b> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayınca üyeliğiniz açılır ve giriş yapabilirsiniz.</p>}
      <p className="fine">E-posta birkaç dakika içinde gelir. Gelmediyse <b>gereksiz (spam)</b> klasörüne bakın.</p>
      <button className="btn outline" onClick={() => go2('login')}>Girişe dön</button>
    </div>
  );
  return (
    <form className="auth-form" onSubmit={submit}>
      {['login', 'signup'].includes(view) && canSignup && (
        <div className="tabs auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'login'} className={'tab' + (view === 'login' ? ' on' : '')} onClick={() => go2('login')}>Giriş yap</button>
          <button type="button" role="tab" aria-selected={view === 'signup'} className={'tab' + (view === 'signup' ? ' on' : '')} onClick={() => go2('signup')}>Üye ol</button>
        </div>
      )}
      {view === 'reset' && <p className="fine">E-posta adresinizi ya da kullanıcı adınızı yazın; şifre yenileme bağlantısı gönderelim.</p>}
      {view === 'signup' && <>
        <Field label="Ad soyad"><input id="m-name" autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="E-posta" hint="Doğrulama bağlantısı buraya gelir"><input id="m-email" type="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, email: v, uname: x.unameTouched ? x.uname : suggestUser(v) })); }} /></Field>
        <div className="row2">
          <Field label="Kullanıcı adı" opt hint="E-posta yerine bununla da girebilirsiniz"><input id="m-uname" autoCapitalize="none" autoComplete="username" value={f.uname} onChange={(e) => setF((x) => ({ ...x, uname: cleanUsername(e.target.value).slice(0, 20), unameTouched: true }))} /></Field>
          <Field label="Cep telefonu"><PhoneInput id="m-phone" value={f.phone} onChange={set('phone')} /></Field>
        </div>
      </>}
      {view !== 'signup' && <Field label="E-posta ya da kullanıcı adı"><input id="m-id" autoComplete="username" autoCapitalize="none" value={f.id} onChange={set('id')} required /></Field>}
      {view !== 'reset' && <Field label="Şifre" hint={view === 'signup' ? 'En az 6 karakter' : ''}><PasswordInput id="m-pw" autoComplete={view === 'signup' ? 'new-password' : 'current-password'} value={f.pw} onChange={set('pw')} required /></Field>}
      {view === 'signup' && <Field label="Şifre (tekrar)"><PasswordInput id="m-pw2" autoComplete="new-password" value={f.pw2} onChange={set('pw2')} required /></Field>}
      {err && <p className="err">{err}</p>}
      {view === 'unverified'
        ? <button type="button" className="btn primary big center-btn" disabled={busy} onClick={resend}>{busy ? 'Bekleyin…' : 'Doğrulama e-postasını tekrar gönder'}</button>
        : <button className="btn primary big center-btn" disabled={busy}>{busy ? 'Bekleyin…' : view === 'signup' ? 'Üye ol' : view === 'reset' ? 'Bağlantı gönder' : 'Giriş yap'}</button>}
      {view === 'login' && <button type="button" className="link center" onClick={() => go2('reset')}>Şifremi unuttum</button>}
      {['reset', 'unverified'].includes(view) && <button type="button" className="link center" onClick={() => go2('login')}>← Girişe dön</button>}
      {view === 'signup' && <p className="fine center">Üye olunca e-postanıza bir doğrulama bağlantısı gelir; ona tıklayınca üyeliğiniz açılır.</p>}
      {!compact && view === 'login' && <p className="fine center">Üye olmadan da sipariş verebilirsiniz: sepeti onaylayıp bilgilerinizi yazmanız yeterli.</p>}
    </form>
  );
}

// E-postadaki bağlantı: şifre yenileme ya da e-posta doğrulama (/magaza/islem?mode=…&oobCode=…)
export function AuthAction() {
  const A = useStore((s) => s.api);
  const q = new URLSearchParams(location.search);
  const mode = q.get('mode'), code = q.get('oobCode');
  const [st, setSt] = useState('wait'); // wait | form | done | err
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!code) { setErr('Bağlantı eksik görünüyor.'); setSt('err'); return; }
    if (mode === 'resetPassword') A.authCheckReset(code).then((e) => { setEmail(e); setSt('form'); }, (e) => { setErr(e.message); setSt('err'); });
    else if (mode === 'verifyEmail') A.authVerifyEmail(code).then(() => setSt('done'), (e) => { setErr(e.message); setSt('err'); });
    else { setErr('Bu bağlantı tanınmadı.'); setSt('err'); }
  }, []);
  async function save(e) {
    e.preventDefault(); setErr('');
    if (pw.length < 6) return setErr('Şifre en az 6 karakter olmalı.');
    if (pw !== pw2) return setErr('Şifreler aynı değil.');
    setBusy(true);
    try { await A.authConfirmReset(code, pw); setSt('done'); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  const toAccount = () => { history.replaceState(null, '', '/magaza'); go('hesap'); };
  return (
    <div className="page narrow acct">
      <div className="set-card auth-action">
        {st === 'wait' && <div className="list-wait"><div className="spinner" aria-label="Yükleniyor" /></div>}
        {st === 'err' && <><h1 className="page-t">Bağlantı geçersiz</h1><p className="err">{err}</p><button className="btn outline" onClick={toAccount}>Hesabım’a git</button></>}
        {st === 'form' && (
          <form className="auth-form" onSubmit={save}>
            <h1 className="page-t">Yeni şifre belirleyin</h1>
            <p className="muted">{email}</p>
            <Field label="Yeni şifre" hint="En az 6 karakter"><PasswordInput id="ra-pw" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
            <Field label="Yeni şifre (tekrar)"><PasswordInput id="ra-pw2" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></Field>
            {err && <p className="err">{err}</p>}
            <button className="btn primary big center-btn" disabled={busy}>{busy ? 'Bekleyin…' : 'Şifreyi kaydet'}</button>
          </form>
        )}
        {st === 'done' && <div className="auth-form auth-sent">
          <span className="sent-ic"><Icon n="check" s={28} /></span>
          <h1 className="page-t">{mode === 'verifyEmail' ? 'E-postanız doğrulandı' : 'Şifreniz değişti'}</h1>
          <p className="muted">{mode === 'verifyEmail' ? 'Üyeliğiniz açıldı. Şimdi giriş yapabilirsiniz.' : 'Yeni şifrenizle giriş yapabilirsiniz.'}</p>
          <button className="btn primary" onClick={toAccount}>Giriş yap</button>
        </div>}
      </div>
    </div>
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
  // çok yakında: üyelik hazır ama müşteriye henüz açık değil (Ayarlar > Online mağaza)
  if (!member && soon(S, 'accountsSoon')) return (
    <div className="page narrow acct">
      <div className="set-card soon-card">
        <span className="soon-ic"><Icon n="user" s={30} /></span>
        <span className="soon-tag">Çok yakında</span>
        <h1 className="page-t">Hesabım çok yakında hizmetinizde</h1>
        <p className="muted">Üye olup adres ve fatura bilgilerinizi kaydedebilecek, siparişlerinizi buradan takip edebileceksiniz. Şimdilik ürünleri sepete ekleyip WhatsApp’tan gönderebilirsiniz.</p>
        <button className="btn primary" onClick={() => go('katalog')}><Icon n="grid" s={16} />Ürünlere göz at</button>
      </div>
    </div>
  );
  if (!member) return (
    <div className="page narrow acct">
      <div className="acct-hero">
        <h1 className="page-t">Hesabım</h1>
        <p className="muted">Üye olun; adres ve fatura bilgileriniz her siparişte hazır gelsin, siparişlerinizi buradan takip edin.</p>
      </div>
      <div className="set-card"><AuthForm /></div>
      <LocalOrders />
    </div>
  );
  return <MemberHome />;
}

// Bu cihazdan (misafir olarak) verilen siparişler: açılır-kapanır; seçip listeden kaldırılabilir (sipariş silinmez)
function LocalOrders({ inSheet }) {
  const [list, setList] = useState(myLocalOrders);
  const [open, setOpen] = useState(!!inSheet);
  const [sel, setSel] = useState(null);
  if (!list.length) return inSheet ? <Empty icon="cart" title="Bu cihazda kayıtlı sipariş yok" /> : null;
  const save = (l) => { ls.set('my-orders', l); setList(l); };
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const body = <>
    <div className="lo-bar">
      {sel ? <>
        <button className="btn sm ghost" onClick={() => setSel(sel.size === list.length ? new Set() : new Set(list.map((x) => x.id)))}>{sel.size === list.length ? 'Seçimi kaldır' : 'Tümünü seç'}</button>
        <button className="btn sm ghost danger" disabled={!sel.size} onClick={() => { save(list.filter((x) => !sel.has(x.id))); setSel(null); toast('Listeden kaldırıldı'); }}><Icon n="trash" s={15} />Kaldır{sel.size ? ` (${sel.size})` : ''}</button>
        <button className="btn sm ghost" onClick={() => setSel(null)}>Vazgeç</button>
      </> : <button className="btn sm ghost" onClick={() => setSel(new Set())}><Icon n="check" s={15} />Seç</button>}
    </div>
    <ul className="olist">{list.map((x) => (
      <li key={x.id}><button className={'ocard' + (sel?.has(x.id) ? ' picked' : '')} onClick={() => (sel ? toggle(x.id) : openOrder(x.id))}>
        {sel && <span className={'ocheck' + (sel.has(x.id) ? ' on' : '')} aria-hidden="true"><Icon n="check" s={14} /></span>}
        <span className="ocard-b"><b className="num">#{x.no}</b><span className="muted">{when(x.at)}</span></span>
        {!sel && <Icon n="back" s={16} className="flip" />}
      </button></li>
    ))}</ul>
    <p className="fine">Listeden kaldırmak siparişi iptal etmez; sadece bu cihazdaki kısayolu siler.</p>
  </>;
  if (inSheet) return body;
  return (
    <div className="set-card lo-card">
      <button className="lo-h" onClick={() => setOpen(!open)} aria-expanded={open}><b>Bu cihazdan verilen siparişler</b><span className="tag">{list.length}</span><Icon n="chev" s={18} className={open ? 'rot180' : ''} /></button>
      {open && body}
    </div>
  );
}

// Üye hesabı: profil başlığı + seçilerek açılan satırlar (her biri kendi penceresinde)
// Hesabım: bilgisayarda solda profil + menü, sağda seçilen bölüm (sayfa); telefonda menü listesi → bölüm ayrı sayfa (geri: Hesabım)
const ACCT_T = { orders: 'Siparişlerim', addr: 'Adreslerim', info: 'Profil bilgilerim', inv: 'Fatura bilgilerim', notif: 'Bildirimler', pay: 'Ödeme bilgilerim' };
function MemberHome() {
  const { member: m, myOrders, api: A, settings: S, acct } = useStore();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  async function pickPhoto(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setBusy(true);
    try { const photo = await resizeImage(file, 160, 0.8, true); await A.saveMember({ ...m, photo }); toast('Profil fotoğrafı güncellendi'); }
    catch (x) { toast('Fotoğraf kaydedilemedi: ' + x.message, 'bad'); }
    setBusy(false);
  }
  const removePhoto = () => A.saveMember({ ...m, photo: null }).then(() => toast('Fotoğraf kaldırıldı'));
  const active = myOrders.filter((o) => ORDER_OPEN.includes(o.status)).length;
  useStore((st) => st.seenTick);
  const unseen = unseenOrders(myOrders).length;
  const pushOk = S.orders?.push !== false && pushState() !== 'unsupported';
  const rows = [
    ['orders', 'box', 'Siparişlerim', myOrders.length ? `${myOrders.length} sipariş${active ? ` · ${active} devam ediyor` : ''}` : 'Henüz sipariş yok'],
    ['addr', 'pin', 'Adreslerim', (m.addresses || []).length ? `${m.addresses.length} kayıtlı adres` : 'Adres ekleyin'],
    ['info', 'user', 'Profil bilgilerim', [m.name, m.phone].filter(Boolean).join(' · ') || 'Ad soyad, telefon'],
    ['inv', 'tag', 'Fatura bilgilerim', m.invoice?.type === 'company' ? m.invoice.company || 'Kurumsal' : 'Bireysel'],
    pushOk && ['notif', 'bell', 'Bildirimler', pushState() === 'on' ? 'Açık · sipariş durumu' : 'Sipariş durumunu haber verelim'],
    ['pay', 'cart', 'Ödeme bilgilerim', 'Kayıtlı kartlar', true],
  ].filter(Boolean);
  const view = acct && ACCT_T[acct] ? acct : null;
  const body = {
    orders: () => <MyOrders />,
    addr: () => <Addresses />,
    info: () => <MyInfo part="info" />,
    inv: () => <MyInfo part="inv" />,
    notif: () => <>
      <PushCard ids={myOrders.filter((o) => ORDER_OPEN.includes(o.status)).map((o) => o.id)} />
      {!myOrders.some((o) => ORDER_OPEN.includes(o.status)) && <p className="fine">Açık siparişiniz olunca bildirimleri buradan açabilirsiniz. Bir kez açarsanız sonraki siparişleriniz kendiliğinden bağlanır.</p>}
    </>,
    pay: () => <div className="soon-card acct-soon"><span className="soon-ic"><Icon n="cart" s={28} /></span><span className="soon-tag">Çok yakında</span><h3>Kayıtlı kartlar</h3><p className="muted">Kartlarınızı güvenle kaydedip tek dokunuşla ödeyebileceksiniz. Şimdilik siparişte havale, kart linki ya da dükkânda ödeme seçebilirsiniz.</p></div>,
  };
  return (
    <div className={'page acct2' + (view ? ' has-view' : '')}>
      <aside className="acct-side">
        <div className="acct-prof">
          <button className={'hub-av' + (busy ? ' busy' : '')} onClick={() => fileRef.current?.click()} aria-label="Profil fotoğrafını değiştir" title="Fotoğrafı değiştir">
            <Avatar u={m} size={72} /><span className="hub-cam"><Icon n="camera" s={14} /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          <div className="hub-id"><h1>{m.name || 'Hesabım'}</h1><p className="muted">{m.email}</p>{m.photo && <button className="linkish" onClick={removePhoto}>Fotoğrafı kaldır</button>}</div>
        </div>
        <nav className="acct-nav" aria-label="Hesabım">
          <button className={'acct-nav-i ov' + (!view ? ' on' : '')} onClick={() => openAcct(null)}><span className="hub-ic"><Icon n="home" s={18} /></span><span className="hub-t"><b>Hesap özeti</b></span></button>
          {rows.map(([k, ic, t, sub, isSoon]) => (
            <button key={k} className={'acct-nav-i' + (view === k ? ' on' : '')} onClick={() => openAcct(k)}>
              <span className="hub-ic"><Icon n={ic} s={18} /></span>
              <span className="hub-t"><b>{t}{isSoon && <span className="soon-tag sm">Yakında</span>}</b><small>{sub}</small></span>
              {k === 'orders' && unseen > 0 && <span className="badge" title="Yeni güncelleme">{unseen}</span>}
              <Icon n="back" s={16} className="flip hub-chev" />
            </button>
          ))}
        </nav>
        <button className="hub-out" onClick={() => A.memberLogout().then(() => { openAcct(null); toast('Çıkış yapıldı'); })}><Icon n="out" s={17} />Çıkış yap</button>
      </aside>
      <section className="acct-main">
        {view ? <>
          <div className="acct-main-h">
            <button className="acct-back" onClick={() => history.state?.acct ? history.back() : openAcct(null)}><Icon n="back" s={18} /><span>Hesabım</span></button>
            <h2>{ACCT_T[view]}</h2>
          </div>
          <div className="acct-body" key={view}>{body[view]()}</div>
        </> : <AcctOverview m={m} myOrders={myOrders} active={active} />}
      </section>
    </div>
  );
}
// Hesap özeti (bilgisayarda sağ taraf): selam, kısa sayılar, son siparişler
function AcctOverview({ m, myOrders, active }) {
  const first = (m.name || '').split(' ')[0];
  const stats = [['box', active, 'Devam eden sipariş', 'orders'], ['check', myOrders.length, 'Toplam sipariş', 'orders'], ['pin', (m.addresses || []).length, 'Kayıtlı adres', 'addr']];
  return (
    <div className="acct-ov">
      <div className="acct-hello"><h2>Merhaba{first ? ', ' + first : ''} 👋</h2><p className="muted">Siparişlerinizi takip edin, adres ve fatura bilgilerinizi buradan düzenleyin.</p></div>
      <div className="acct-stats">{stats.map(([ic, n, l, k]) => <button key={l} className="acct-stat" onClick={() => openAcct(k)}><span className="hub-ic"><Icon n={ic} s={18} /></span><b className="num">{n}</b><small>{l}</small></button>)}</div>
      <div className="acct-sec-h"><h3>Son siparişler</h3>{myOrders.length > 3 && <button className="linkish" onClick={() => openAcct('orders')}>Tümünü gör</button>}</div>
      <MyOrders limit={3} />
    </div>
  );
}
// sipariş kartı: içindeki ürünlerin küçük resimleri (en çok 5, fazlası "+3")
function MyOrders({ limit }) {
  const myOrders = useStore((s) => s.myOrders);
  useStore((s) => s.seenTick);
  const fresh = new Set(unseenOrders(myOrders).map((o) => o.id));
  if (!myOrders.length) return <Empty icon="cart" title="Henüz siparişiniz yok"><button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button></Empty>;
  const list = limit ? myOrders.slice(0, limit) : myOrders;
  return (
    <ul className="mo-list">
      {list.map((o) => {
        const its = o.items || []; const qty = its.reduce((t, i) => t + (Number(i.qty) || 0), 0);
        const show = its.slice(0, 5); const more = its.length - show.length;
        return (
          <li key={o.id}>
            <button className={'mo-card' + (fresh.has(o.id) ? ' fresh' : '')} onClick={() => openOrder(o.id)}>
              <span className="mo-top">{fresh.has(o.id) && <span className="dot-new" title="Yeni güncelleme" />}<b className="num">#{o.no}</b><StatusPill status={o.status} map={ORDER_STATUS} /><span className="muted mo-date">{when(o.createdAt)}</span><b className="num mo-sum">{fmtTotals(o.total || totals(orderItems(o), 'offer'))}</b></span>
              <span className="mo-thumbs">
                {show.map((it, i) => <span key={i} className="mo-th" title={it.n}><Thumb p={it} size="sm" />{it.qty > 1 && <i className="num">×{it.qty}</i>}</span>)}
                {more > 0 && <span className="mo-more num">+{more}</span>}
              </span>
              <span className="mo-foot muted">{its.length === 1 ? its[0].n : `${show[0]?.n || ''}${its.length > 1 ? ` ve ${its.length - 1} ürün daha` : ''}`} · {qty} adet · {DELIVERY[o.delivery?.method] || ''}<Icon n="back" s={15} className="flip" /></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Addresses() {
  const { member: m, api: A } = useStore();
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState({});
  const list = m.addresses || [];
  async function save() {
    const e = addrErrors(edit, 'addr', true); setErr(e); if (Object.keys(e).length) return;
    const a = { ...edit, name: (edit.name || '').trim(), district: edit.district.trim(), address: edit.address.trim() };
    const addresses = list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a];
    try { await A.saveMember({ ...m, addresses }); toast('Adres kaydedildi'); setEdit(null); } catch (x) { toast('Kaydedilemedi: ' + x.message, 'bad'); }
  }
  const del = (a) => A.saveMember({ ...m, addresses: list.filter((x) => x.id !== a.id) }).then(() => toast('Adres silindi'));
  const first = (a) => A.saveMember({ ...m, addresses: [a, ...list.filter((x) => x.id !== a.id)] }).then(() => toast('Varsayılan adres değişti'));
  return (
    <div className="addr-list">
      {list.map((a, i) => (
        <div key={a.id} className="addr-card static">
          <span><b>{a.title || 'Adres'}{i === 0 && <span className="tag">Varsayılan</span>}</b><small>{[a.name, a.phone].filter(Boolean).join(' · ')}</small><small>{addrLine(a)}</small></span>
          <span className="row-btns">
            {i > 0 && <button className="btn sm ghost" onClick={() => first(a)}>Varsayılan yap</button>}
            <button className="btn sm ghost" onClick={() => { setErr({}); setEdit({ ...a }); }}><Icon n="edit" s={15} />Düzenle</button>
            <button className="icon-btn sm" onClick={() => del(a)} aria-label="Sil"><Icon n="trash" s={15} /></button>
          </span>
        </div>
      ))}
      <button className="btn outline" onClick={() => { setErr({}); setEdit({ ...blankAddr(), name: m.name || '', phone: m.phone || '' }); }}><Icon n="plus" s={16} />Yeni adres ekle</button>
      {edit && (
        <Sheet title={list.some((x) => x.id === edit.id) ? 'Adresi düzenle' : 'Yeni adres'} onClose={() => setEdit(null)} footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Vazgeç</button><button className="btn primary" onClick={save}><Icon n="check" s={16} />Kaydet</button></>}>
          <AddressFields a={edit} set={setEdit} err={err} p="addr" title recip />
        </Sheet>
      )}
    </div>
  );
}

function MyInfo({ part = 'all' }) {
  const { member: m, api: A } = useStore();
  const [f, setF] = useState(() => ({ name: m.name || '', phone: m.phone || '', inv: { type: 'person', tc: '', company: '', taxOffice: '', taxNo: '', ...(m.invoice || {}) }, iaddr: { ...blankAddr(), ...(m.invoice?.addr || {}) } }));
  const [aerr, setAerr] = useState({});
  const [busy, setBusy] = useState(false);
  const setI = (k, v) => setF((x) => ({ ...x, inv: { ...x.inv, [k]: v } }));
  async function save() {
    if (f.name.trim().length < 3) return toast('Adınızı yazın', 'bad');
    setBusy(true);
    try {
      const inv = f.inv.type === 'company' ? { type: 'company', company: f.inv.company.trim(), taxOffice: f.inv.taxOffice.trim(), taxNo: digits(f.inv.taxNo) } : { type: 'person', ...(f.inv.tc ? { tc: digits(f.inv.tc) } : {}) };
      // fatura adresi (isteğe bağlı): yazılmaya başlandıysa eksiksiz olmalı
      const ia = f.iaddr || {}; const anyA = ia.city || String(ia.district || '').trim() || String(ia.address || '').trim();
      if (part !== 'info' && anyA) { const e = addrErrors(ia, 'iaddr'); setAerr(e); if (Object.keys(e).length) { setBusy(false); return; } inv.addr = { city: ia.city, district: ia.district.trim(), address: ia.address.trim() }; }
      else if (part === 'info' && m.invoice?.addr) inv.addr = m.invoice.addr;
      await A.saveMember({ ...m, name: f.name.trim(), phone: f.phone, invoice: inv }); toast('Bilgileriniz kaydedildi');
    } catch (x) { toast('Kaydedilemedi: ' + x.message, 'bad'); }
    setBusy(false);
  }
  return (
    <div className="form-col mi">
      {part !== 'inv' && <><div className="row2">
        <Field label="Ad soyad"><input id="mi-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Cep telefonu"><PhoneInput id="mi-phone" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></Field>
      </div>
      <Field label="E-posta" hint="Giriş için kullanılır, değiştirilemez"><input id="mi-email" value={m.email || ''} readOnly /></Field></>}
      {part !== 'info' && <>{part === 'all' && <h3>Fatura bilgileri</h3>}
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
      <h4 className="mi-sub">Fatura adresi <small className="muted">(isteğe bağlı)</small></h4>
      <p className="fine">Siparişte fatura adresi olarak bu gelir. Teslimat adresiyle aynıysa siparişte “teslimat adresiyle aynı”yı seçmeniz yeterli.</p>
      <AddressFields a={f.iaddr} set={(iaddr) => setF((x) => ({ ...x, iaddr }))} err={aerr} p="iaddr" />
      {f.iaddr?.address && <button type="button" className="linkish mi-clear" onClick={() => setF((x) => ({ ...x, iaddr: blankAddr() }))}>Fatura adresini temizle</button>}</>}
      <button className="btn primary" disabled={busy} onClick={save}><Icon n="check" s={16} />Kaydet</button>
    </div>
  );
}
