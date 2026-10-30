// Sepet linki (30.10.2026)
// Müşteri WhatsApp'tan ürün atar → yönetici /admin/sepet-link'te (sipariş formuyla aynı ekran) sepeti hazırlar, fiyatları yazar,
// "Sepet linki oluştur" → lcarts/{id} kaydı + link /magaza/k/<id>. Müşteri linki açar: ürünleri kontrol eder (adet değiştirir /
// çıkarır, ekleyemez, fiyata dokunamaz), adını, telefonunu, teslimat ve ödeme seçimini girip onaylar → kayıt 'sent' olur ve
// yönetimde aynı sayfanın altındaki "Linkle gelen sepetler"e düşer. Her açılış SIFIRDAN başlar (cihazda hiçbir şey saklanmaz).
// Kural (firestore.rules): linki bilen tek belgeyi okur; müşteri sadece açık sepeti bir kez onaylar.
import { useEffect, useMemo, useState } from 'react';
import { useStore, api, toast, store } from './store.js';
import { Icon, Thumb, Empty, Stepper, VatLines, Field, PhoneInput, phoneDigits, Sheet, Confirm, copyText } from './ui.jsx';
import { fmt, totals, fmtTotals, when, ls } from './utils.js';
import { pingWatch } from './push.js';
import { CargoCard } from './orders.jsx';
import { PAY, DELIVERY } from './config.js';
import { waLink } from './route.js';
import { useRate, toTL, fmtTL } from './listsheet.jsx';
import { AddressFields, addrErrors, cleanAddr, Choice, addrLine } from './checkout.jsx';

const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? undefined : v)));
export const lcartLink = (id) => `${location.origin}/magaza/k/${id}`;
const withOffer = (items) => items.map((it) => ({ ...it, offer: it.price }));

// ============================================================================================
// Yönetim: formun altındaki "Sepet linki oluştur" bölümü
export function LinkMake({ no, name, items, total, rate, onDone }) {
  const [made, setMade] = useState(null); // { id, link, sig }
  const [busy, setBusy] = useState(false);
  const sig = JSON.stringify(items.map((it) => [it.id, it.qty, it.offer]));
  const missing = items.filter((it) => it.offer == null || it.offer === '' || !(Number(it.offer) > 0)).length;
  async function make() {
    if (missing) return toast(`${missing} ürünün fiyatı boş`, 'warn');
    setBusy(true);
    try {
      const A = api(); const id = A.newLcartId();
      const data = strip({
        no, name: (name || '').trim(), status: 'open', at: Date.now(), rate: rate?.usd || null, total,
        items: items.map((it) => ({ id: it.id, k: it.k || '', n: it.n, cur: it.cur || 'USD', qty: Number(it.qty) || 1, price: Number(it.offer), list: it.list ?? null, pi: it.pi, img: it.img && it.img !== 'fs' ? it.img : undefined })),
      });
      await A.createLcart(id, data);
      setMade({ id, link: lcartLink(id), sig });
      toast('Sepet linki hazır');
    } catch (e) { toast('Oluşturulamadı: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const stale = made && made.sig !== sig;
  return (
    <section className="oform-out open lc-make">
      <div className="lc-make-h">
        <span className="oot-ic"><Icon n="cart" s={18} /></span>
        <span className="oot-t"><b>Müşteriye sepet linki</b><small>Müşteri linki açıp ürünleri kontrol eder, adresini yazıp onaylar; aşağıdaki listeye düşer.</small></span>
      </div>
      {!made || stale ? (
        <>
          {stale && <p className="fine lc-stale">Sepeti değiştirdiniz. Önceki link eski hâliyle duruyor; yeni hâli için yeniden oluşturun.</p>}
          <button className="btn primary lc-make-btn" disabled={busy || !items.length} onClick={make}><Icon n="send" s={16} />{busy ? 'Hazırlanıyor…' : 'Sepet linki oluştur'}</button>
          {missing > 0 && <p className="fine lc-warn">{missing} ürünün fiyatı boş; önce fiyat yazın.</p>}
        </>
      ) : (
        <div className="lc-made">
          <div className="lc-url"><code>{made.link}</code></div>
          <div className="row-btns">
            <a className="btn sm wa" href={waLink('', `Sepetiniz hazır, buradan kontrol edip onaylayabilirsiniz:\n${made.link}`)} target="_blank" rel="noopener"><Icon n="wa" s={15} />WhatsApp’ta gönder</a>
            <button className="btn sm outline" onClick={() => copyText(made.link, 'Link kopyalandı')}><Icon n="copy" s={15} />Linki kopyala</button>
            <a className="btn sm ghost" href={made.link} target="_blank" rel="noopener"><Icon n="eye" s={15} />Müşteri gibi aç</a>
            <button className="btn sm ghost" onClick={() => { setMade(null); onDone?.(); }}><Icon n="plus" s={15} />Yeni sepet</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================================
// Yönetim: linkle gelen sepetler
const ST = { sent: ['Onaylandı', 'var(--c-confirmed, #c9772b)'], open: ['Müşteri bekleniyor', 'var(--c-new, #8a919e)'], done: ['Tamamlandı', 'var(--c-done, #1f6b47)'] };
const subTime = (c) => (c.subAt?.toMillis ? c.subAt.toMillis() : typeof c.subAt === 'number' ? c.subAt : null);
// müşterinin onayladığı ürünler (adet değiştirmiş / çıkarmış olabilir); fiyat her zaman yöneticinin yazdığı
export function finalItems(c) {
  if (!c.sub?.items) return withOffer(c.items || []);
  const byId = new Map((c.items || []).map((it) => [it.id, it]));
  return c.sub.items.map(({ id, qty }) => byId.get(id) && { ...byId.get(id), qty, offer: byId.get(id).price }).filter(Boolean);
}
export function LinkCarts() {
  const byId = useStore((s) => s.byId);
  const [list, setList] = useState(null);
  const [f, setF] = useState('sent');
  const [open, setOpen] = useState(null);
  useEffect(() => { const A = api(); return A?.watchLcarts ? A.watchLcarts(setList) : setList([]); }, []);
  // zilden gelince o sepet açılır
  const want = useStore((s) => s.openLcart);
  useEffect(() => { if (!want || !list) return; const x = list.find((c) => c.id === want); if (x) { setF(x.status === 'open' ? 'open' : x.status); setOpen(want); } store.set({ openLcart: null }); }, [want, list]);
  const n = (k) => (list || []).filter((c) => c.status === k).length;
  const shown = (list || []).filter((c) => c.status === f);
  const cur = open && (list || []).find((c) => c.id === open);
  return (
    <section className="oform-saved lc-list">
      <h2>Linkle gelen sepetler</h2>
      <div className="chips lc-chips">
        {['sent', 'open', 'done'].map((k) => <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{ST[k][0]}{n(k) > 0 && <span className="num"> {n(k)}</span>}</button>)}
      </div>
      {list == null ? <div className="spinner sm" /> : shown.length === 0 ? (
        <p className="fine">{f === 'sent' ? 'Henüz onaylanan sepet yok. Müşteri linkten onaylayınca burada görünür.' : f === 'open' ? 'Müşteriye gönderilip henüz onaylanmamış sepet yok.' : 'Tamamlanan sepet yok.'}</p>
      ) : (
        <ul className="ofs-list">
          {shown.map((c) => {
            const its = finalItems(c); const adet = its.reduce((t, it) => t + (Number(it.qty) || 0), 0);
            const who = c.sub?.contact?.name || c.name || 'İsimsiz';
            return (
              <li key={c.id} className={c.status === 'sent' && !c.seen ? 'lc-new' : ''}>
                <button type="button" className="ofs-main" onClick={() => { setOpen(c.id); if (c.status === 'sent' && !c.seen) api().updateLcart(c.id, { seen: true }).catch(() => {}); }}>
                  <span className="ofs-th">{its.slice(0, 3).map((it) => <Thumb key={it.id} p={byId.get(it.id) || it} size="sm" />)}</span>
                  <span className="ofs-t">
                    <b>{who} <span className="muted num">#{c.no}</span>{c.status === 'sent' && !c.seen && <span className="lc-dot" aria-label="Yeni" />}</b>
                    <small className="muted">{its.length} ürün · {adet} adet · {fmtTotals(totals(its, 'offer'))} · {when(subTime(c) || c.at)}{c.sub ? ' · ' + (c.sub.delivery?.method === 'pickup' ? 'Dükkândan' : c.cargo?.code ? 'DHL ' + c.cargo.code : c.dhl?.ref && !c.dhl.cancelled ? 'DHL’e aktarıldı' : 'Kargo') : ''}</small>
                  </span>
                </button>
                <span className="lc-st" style={{ '--c': ST[c.status]?.[1] }}>{ST[c.status]?.[0] || c.status}</span>
              </li>
            );
          })}
        </ul>
      )}
      {cur && <LinkCartSheet c={cur} onClose={() => setOpen(null)} />}
    </section>
  );
}

function LinkCartSheet({ c, onClose }) {
  const byId = useStore((s) => s.byId);
  const [del, setDel] = useState(false);
  const its = finalItems(c);
  const tot = totals(its, 'offer');
  const s = c.sub;
  const changed = s && ((c.items || []).length !== s.items.length || s.items.some((x) => (c.items || []).find((it) => it.id === x.id)?.qty !== x.qty));
  const a = s?.delivery?.addr;
  const addrText = a ? [s.contact?.name, s.contact?.phone, addrLine(a)].filter(Boolean).join('\n') : '';
  const link = lcartLink(c.id);
  const setSt = (status) => api().updateLcart(c.id, { status }).then(() => toast(status === 'done' ? 'Tamamlandı olarak işaretlendi' : 'Geri alındı')).catch((e) => toast(e.message, 'bad'));
  return (
    <Sheet wide title={(s?.contact?.name || c.name || 'Sepet') + ' · #' + c.no} sub={(c.name ? c.name + ' · ' : '') + (c.status === 'open' ? 'Müşteri henüz onaylamadı · ' + when(c.at) : 'Onay: ' + when(subTime(c) || c.at))} onClose={onClose} footer={<>
      <button className="btn ghost danger" onClick={() => setDel(true)}><Icon n="trash" s={16} />Sil</button>
      {c.status === 'sent' && <button className="btn primary" onClick={() => setSt('done')}><Icon n="check" s={16} />Tamamlandı</button>}
      {c.status === 'done' && <button className="btn outline" onClick={() => setSt('sent')}>Geri al</button>}
      {c.status === 'open' && <button className="btn outline" onClick={() => copyText(link, 'Link kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>}
    </>}>
      {s ? (
        <div className="lc-info">
          <div className="o-card">
            <h3>Müşteri</h3>
            <p><b>{s.contact?.name}</b><br /><span className="num">{s.contact?.phone}</span></p>
            {s.contact?.phone && <a className="btn sm wa" href={waLink(s.contact.phone, `Merhaba ${s.contact.name || ''}, #${c.no} numaralı sepetiniz bize ulaştı.`)} target="_blank" rel="noopener"><Icon n="wa" s={15} />WhatsApp’tan yaz</a>}
          </div>
          <div className="o-card">
            <h3>Teslimat{a && <button className="oc-copy" onClick={() => copyText(addrText, 'Adres kopyalandı')} aria-label="Adresi kopyala"><Icon n="copy" s={14} /></button>}</h3>
            {s.delivery?.method === 'pickup' ? <p>{DELIVERY.pickup}</p> : <p>{DELIVERY.cargo}<br />{a ? addrLine(a) : '—'}</p>}
            {s.pay && <p className="muted">Ödeme: {PAY[s.pay] || s.pay}</p>}
          </div>
          {s.note && <div className="o-card lc-note"><h3>Not</h3><p>{s.note}</p></div>}
        </div>
      ) : (
        <div className="banner"><Icon n="clock" /><div><b>Müşteri henüz onaylamadı.</b> Link: <code className="lc-code">{link}</code></div></div>
      )}
      {changed && <p className="fine lc-changed">Müşteri adetleri değiştirdi ya da bazı ürünleri çıkardı; aşağıda onayladığı hâli var.</p>}
      <ul className="lc-items">
        {its.map((it) => (
          <li key={it.id}>
            <Thumb p={byId.get(it.id) || it} size="sm" />
            <span className="lc-n"><b>{it.n}</b><code>{it.k}</code></span>
            <span className="lc-q num">{it.qty} × {fmt(it.price, it.cur)}</span>
            <b className="lc-sum num">{fmt(it.price * it.qty, it.cur)}</b>
          </li>
        ))}
      </ul>
      <div className="vle-tot"><span>Toplam</span><b className="num">{fmtTotals(tot)}</b></div>
      {s && s.delivery?.method !== 'pickup' && <CargoCard col="lcarts" o={{ id: c.id, no: c.no, dhl: c.dhl, cargo: c.cargo, status: c.cargo?.delivered ? 'done' : c.cargo?.code ? 'shipped' : 'preparing', delivery: s.delivery, contact: s.contact }} />}
      {del && <Confirm title="Sepet silinsin mi?" text={`#${c.no} kalıcı olarak silinecek${c.status === 'open' ? '; müşteriye gönderdiğiniz link de çalışmaz' : ''}.`} okLabel="Sil" tone="danger" onClose={() => setDel(false)} onOk={() => api().deleteLcart(c.id).then(() => { toast('Silindi'); onClose(); }).catch((e) => toast(e.message, 'bad'))} />}
    </Sheet>
  );
}

// ============================================================================================
// Müşteri: /magaza/k/<id> — her açılışta sıfırdan (hiçbir şey cihazda tutulmaz)
const ME_KEY = 'lcart-me';

export function LinkCartPage({ id }) {
  const S = useStore((s) => s.settings);
  const byId = useStore((s) => s.byId);
  const liveRate = useRate();
  const [c, setC] = useState(undefined); // undefined yükleniyor · null bulunamadı
  const [qty, setQty] = useState({}); // ürün → adet (0 = çıkarıldı)
  // "Bilgilerimi bu cihazda kaydet" (isteğe bağlı): kayıt varsa alanlar dolu ve işaretli gelir
  const [me0] = useState(() => { const m = ls.get(ME_KEY, null); return m && typeof m === 'object' ? m : null; });
  const [f, setF] = useState(() => ({ name: me0?.name || '', phone: me0?.phone || '', method: me0?.method || 'cargo', addr: (me0?.addr && typeof me0.addr === 'object') ? me0.addr : {}, pay: me0?.pay || '', note: '' }));
  const [keep, setKeep] = useState(!!me0);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let on = true;
    api().getLcart(id).then((x) => { if (!on) return; setC(x); if (x) setQty(Object.fromEntries((x.items || []).map((it) => [it.id, it.qty]))); }).catch(() => on && setC(null));
    return () => { on = false; };
  }, [id]);
  const O = S.orders || {};
  const methods = [O.cargo !== false && 'cargo', O.pickup !== false && 'pickup'].filter(Boolean);
  const pays = [O.payHavale !== false && 'havale', O.payCard !== false && 'card', O.payShop !== false && f.method === 'pickup' && 'shop'].filter(Boolean);
  useEffect(() => { if (methods.length && !methods.includes(f.method)) setF((x) => ({ ...x, method: methods[0] })); }, [methods.join()]);
  useEffect(() => { if (f.pay && !pays.includes(f.pay)) setF((x) => ({ ...x, pay: '' })); }, [pays.join()]);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const items = useMemo(() => (c?.items || []).filter((it) => qty[it.id] > 0).map((it) => ({ ...it, qty: qty[it.id], offer: it.price })), [c, qty]);
  const tot = totals(items, 'offer');
  const rate = c?.rate ? { usd: c.rate } : liveRate;
  const tTL = rate ? toTL(tot, rate) : null;

  if (c === undefined) return <div className="page narrow lc-page"><div className="list-wait"><div className="spinner" /></div></div>;
  if (c === null) return <div className="page narrow lc-page"><Empty icon="cart" title="Sepet bulunamadı">Link hatalı ya da sepet kaldırılmış olabilir. Lütfen bize WhatsApp’tan yazın.</Empty></div>;
  if (done || c.status !== 'open') return (
    <div className="page narrow lc-page">
      <div className="lc-ok">
        <span className="lc-ok-ic"><Icon n="check" s={30} /></span>
        <h1>{done ? 'Sepetiniz onaylandı' : 'Bu sepet daha önce onaylandı'}</h1>
        <p className="muted">#{c.no} · Siparişiniz bize ulaştı. En kısa sürede sizinle iletişime geçeceğiz.</p>
        {S.shop?.whatsapp && <a className="btn wa" href={waLink(S.shop.whatsapp, `Merhaba, #${c.no} numaralı sepetimle ilgili yazıyorum.`)} target="_blank" rel="noopener"><Icon n="wa" s={17} />WhatsApp’tan yazın</a>}
      </div>
    </div>
  );

  async function submit() {
    const e = {};
    if (!items.length) { toast('Sepette ürün kalmadı', 'warn'); return; }
    if (f.name.trim().length < 3) e.name = 'Adınızı soyadınızı yazın';
    if (phoneDigits(f.phone).length !== 11) e.phone = 'Telefonunuzu yazın (0 5xx xxx xx xx)';
    if (f.method === 'cargo') Object.assign(e, addrErrors(f.addr, 'addr'));
    if (pays.length && !f.pay) e.pay = 'Ödeme şeklini seçin';
    setErr(e);
    if (Object.keys(e).length) { toast('Eksik bilgileri tamamlayın', 'warn'); setTimeout(() => document.querySelector('.lc-page .field-err, .lc-page .error, .lc-page [aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); return; }
    setBusy(true);
    try {
      const sub = strip({
        items: items.map((it) => ({ id: it.id, qty: it.qty })),
        contact: { name: f.name.trim(), phone: f.phone },
        delivery: f.method === 'cargo' ? { method: 'cargo', addr: cleanAddr(f.addr) } : { method: 'pickup' },
        pay: f.pay || undefined,
        note: f.note.trim().slice(0, 500) || undefined,
      });
      await api().submitLcart(c.id, sub);
      pingWatch('/notify-lcart', { id: c.id }); // yöneticiye Telegram + e-posta + bildirim (bekçi kaydı okuyup bir kez gönderir)
      if (keep) ls.set(ME_KEY, { name: f.name.trim(), phone: f.phone, method: f.method, addr: f.method === 'cargo' ? cleanAddr(f.addr) : (me0?.addr || {}), pay: f.pay, at: Date.now() });
      else ls.del(ME_KEY);
      setDone(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (x) {
      toast(/permission|insufficient/i.test(x.message) ? 'Bu sepet artık açık değil' : 'Gönderilemedi: ' + x.message, 'bad');
    }
    setBusy(false);
  }

  return (
    <div className="page lc-page">
      <div className="lc-head">
        <h1 className="page-t">Sepetiniz hazır <span className="muted num">#{c.no}</span></h1>
        <p className="muted">Ürünleri kontrol edin, bilgilerinizi yazıp onaylayın. Adetleri değiştirebilir, istemediğiniz ürünü çıkarabilirsiniz.</p>
      </div>
      <div className="lc-grid">
        <section className="co-sec lc-cart">
          <h2>Ürünler <span className="muted num">· {items.length}</span></h2>
          {items.length === 0 ? <Empty icon="cart" title="Sepette ürün kalmadı">Ürünleri yanlışlıkla çıkardıysanız sayfayı yenileyin.</Empty> : (
            <ul className="lc-items cust">
              {items.map((it) => (
                <li key={it.id}>
                  <Thumb p={byId.get(it.id) || it} size="sm" />
                  <span className="lc-n"><b>{it.n}</b><span className="muted num">{fmt(it.price, it.cur)} / adet</span></span>
                  <Stepper small min={1} value={it.qty} onChange={(v) => setQty((q) => ({ ...q, [it.id]: v }))} onRemove={() => setQty((q) => ({ ...q, [it.id]: 0 }))} />
                  <b className="lc-sum num">{fmt(it.price * it.qty, it.cur)}</b>
                </li>
              ))}
            </ul>
          )}
          <div className="vle-tot"><span>Toplam</span><b className="num">{fmtTotals(tot)}</b>{tTL != null && <span className="muted num">≈ {fmtTL(tTL)}</span>}</div>
          <VatLines by={tot} rate={rate} className="right" />
        </section>

        <div className="lc-form">
          <section className="co-sec">
            <h2><span className="co-n">1</span>Bilgileriniz</h2>
            <div className="row2">
              <Field label="Adınız soyadınız" error={err.name}><input id="lc-name" value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></Field>
              <Field label="Telefonunuz" error={err.phone}><PhoneInput id="lc-phone" value={f.phone} onChange={(v) => set({ phone: v })} /></Field>
            </div>
          </section>
          <section className="co-sec">
            <h2><span className="co-n">2</span>Teslimat</h2>
            {methods.length > 1 && (
              <div className="seg-cards" role="radiogroup" aria-label="Teslimat şekli">
                <Choice on={f.method === 'cargo'} onClick={() => set({ method: 'cargo' })} icon="box" title={DELIVERY.cargo} sub="Adresinize gönderilir" />
                <Choice on={f.method === 'pickup'} onClick={() => set({ method: 'pickup' })} icon="store" title={DELIVERY.pickup} sub={[S.shop?.address, S.shop?.hours].filter(Boolean).join(' · ')} />
              </div>
            )}
            {f.method === 'cargo' && <AddressFields a={f.addr} set={(a) => set({ addr: a })} err={err} p="addr" />}
          </section>
          {pays.length > 0 && (
            <section className="co-sec">
              <h2><span className="co-n">3</span>Ödeme</h2>
              <div className="seg-cards" role="radiogroup" aria-label="Ödeme şekli">
                {pays.map((k) => <Choice key={k} on={f.pay === k} onClick={() => set({ pay: k })} title={PAY[k]} sub={k === 'havale' ? 'Banka bilgilerini size ileteceğiz' : k === 'card' ? 'Size güvenli ödeme linki göndereceğiz' : 'Teslim alırken nakit ya da kartla'} />)}
              </div>
              {err.pay && <p className="field-err">{err.pay}</p>}
            </section>
          )}
          <section className="co-sec">
            <Field label="Not" opt><textarea id="lc-note" rows="2" value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Eklemek istediğiniz bir şey varsa" /></Field>
            <label className="mini-check lc-keep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />Bilgilerimi bu cihazda kaydet <small className="muted">— bir dahaki sepette hazır gelir</small></label>
            <button className="btn primary big lc-send" disabled={busy || !items.length} onClick={submit}><Icon n="check" s={18} />{busy ? 'Gönderiliyor…' : 'Sepeti onayla'}</button>
            <p className="fine lc-fine">Onayladığınızda sepetiniz bize ulaşır; ödeme ve kargo için sizinle iletişime geçeriz.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
