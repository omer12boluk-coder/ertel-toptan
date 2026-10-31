// Sepet linki (30.10.2026)
// Müşteri WhatsApp'tan ürün atar → yönetici /admin/sepet-link'te (sipariş formuyla aynı ekran) sepeti hazırlar, fiyatları yazar,
// "Sepet linki oluştur" → lcarts/{id} kaydı + link /magaza/k/<id>. Müşteri linki açar: ürünleri kontrol eder (adet değiştirir /
// çıkarır, ekleyemez, fiyata dokunamaz), adını, telefonunu, teslimat ve ödeme seçimini girip onaylar → kayıt 'sent' olur ve
// yönetimde aynı sayfanın altındaki "Linkle gelen sepetler"e düşer. Her açılış SIFIRDAN başlar (cihazda hiçbir şey saklanmaz).
// Kural (firestore.rules): linki bilen tek belgeyi okur; müşteri sadece açık sepeti bir kez onaylar.
import { useEffect, useMemo, useState } from 'react';
import { useStore, api, toast, store, go } from './store.js';
import { PageHead, Icon, Thumb, Empty, Stepper, VatLines, Field, PhoneInput, phoneDigits, Sheet, Confirm, copyText } from './ui.jsx';
import { fmt, totals, fmtTotals, when, ls } from './utils.js';
import { pingWatch } from './push.js';
import { CargoCard, OrdersSwitch, OlderBtn, OrderThumbs, ago2, fullDate, useDateRange, RangeSheet, rangeLabel } from './orders.jsx';
import { PAY, DELIVERY } from './config.js';
import { waLink } from './route.js';
import { useRate, toTL, fmtTL } from './listsheet.jsx';
import { AddressFields, addrErrors, cleanAddr, Choice, addrLine } from './checkout.jsx';

const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? undefined : v)));
export const lcartLink = (id) => `${location.origin}/k/${id}`;
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
// Yönetim: /admin/sepetler — linkle gelen sepetler ayrı sayfa (Siparişler sekmesinin üstündeki geçişten)
export function LinkCartsPage() { return <LinkCarts page />; }

export function LinkCarts({ page = false }) {
  const list = useStore((s) => s.lcarts ?? null); // datawin: son N gün + bekleyenler (Ayarlar > Veri ve kota)
  const live = useRate();
  const [f, setF] = useState('sent');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [sel, setSel] = useState(null); // çoklu seçim (Set) ya da kapalı
  const { range, setRange, rangeOpen, setRangeOpen, runRange } = useDateRange({ col: 'lcarts', unit: 'sipariş', setConfirm, onStart: () => setF('all') });
  // zilden gelince o sepet açılır
  const want = useStore((s) => s.openLcart);
  useEffect(() => { if (!want || !list) return; const x = list.find((c) => c.id === want); if (x) { setF(x.status === 'open' ? 'open' : x.status); show(want); } store.set({ openLcart: null }); }, [want, list]);
  // sipariş tam sayfa açılır (mağaza siparişi gibi); telefonda geri kaydırma / Geri listeye döner
  const show = (id) => { try { history.pushState({ ...(history.state || {}), lcOpen: id, y: scrollY }, ''); } catch {} setOpen(id); window.scrollTo(0, 0); };
  useEffect(() => { const h = (e) => { if (!e.state?.lcOpen) setCalm(true); setOpen(e.state?.lcOpen || null); }; addEventListener('popstate', h); return () => removeEventListener('popstate', h); }, []);
  // detaydan dönünce liste animasyonsuz, olduğu yerde görünür (31.10.2026: kutular gecikmeli oturuyordu)
  const [calm, setCalm] = useState(false);
  useEffect(() => { if (!calm) return; const t = setTimeout(() => setCalm(false), 500); return () => clearTimeout(t); }, [calm]);
  const hide = () => { setCalm(true); if (history.state?.lcOpen) history.back(); else setOpen(null); };
  // tarih aralığı seçiliyse liste o aralığın kayıtları (canlı listedeki güncel hâl önce)
  const base = useMemo(() => {
    if (!range) return list;
    const lv = new Map((list || []).map((c) => [c.id, c]));
    const got = (range.items || []).map((c) => lv.get(c.id) || c);
    return got.concat((list || []).filter((c) => (c.at || 0) >= range.from && (c.at || 0) < range.to && !got.some((x) => x.id === c.id)));
  }, [list, range]);
  const n = (k) => (base || []).filter((c) => c.status === k).length;
  const t = q.trim().toLocaleLowerCase('tr');
  const shown = (base || []).filter((c) => (f === 'all' || c.status === f) && (!t || [c.no, c.name, c.sub?.contact?.name, c.sub?.contact?.phone].join(' ').toLocaleLowerCase('tr').includes(t)));
  const cur = open && (list || []).find((c) => c.id === open);
  const toggle = (id) => setSel((x) => { const m = new Set(x || []); m.has(id) ? m.delete(id) : m.add(id); return m; });
  const allOn = shown.length > 0 && !!sel && shown.every((c) => sel.has(c.id));
  const setAll = (on) => setSel(on ? new Set(shown.map((c) => c.id)) : new Set());
  const delMany = () => {
    const ids = [...sel]; const openN = (list || []).filter((c) => sel.has(c.id) && c.status === 'open').length;
    setConfirm({ title: `${ids.length} siparişi sil`, text: 'Seçilen siparişler tamamen silinecek. Geri alınamaz.' + (openN ? ` ${openN} tanesi müşteri bekliyor; onların linki de çalışmaz.` : ''), okLabel: 'Sil', tone: 'danger',
      onOk: () => api().deleteLcarts(ids).then(() => { toast(ids.length + ' sipariş silindi'); setSel(null); }, (e) => toast('Silinemedi: ' + e.message, 'bad')) });
  };
  const pick = (c) => { show(c.id); if (c.status === 'sent' && !c.seen) api().updateLcart(c.id, { seen: true }).catch(() => {}); };
  if (cur && page) return <LinkCartAdmin c={cur} onBack={hide} />;
  const sec = (
    <section className={'lc-list' + (page ? ' lc-list-page' : ' oform-saved')}>
      {!page && <h2>Linkle gelen siparişler</h2>}
      <div className="toolbar lc-tool">
        {page && <div className="o-sr"><div className="search"><Icon n="search" s={18} /><input type="search" placeholder="Sipariş no, ad, telefon…" value={q} onChange={(e) => setQ(e.target.value)} /></div><button type="button" className={'o-date' + (range ? ' on' : '')} onClick={() => setRangeOpen(true)} title="Tarih aralığı" aria-label="Tarih aralığı"><Icon n="clock" s={18} /><span>Tarih</span></button></div>}
        <div className="chips lc-chips">
          {[['sent', 'Onaylandı'], ['open', 'Bekleyen'], ['done', 'Tamamlanan'], ...(range || f === 'all' ? [['all', 'Tümü']] : [])].map(([k, l]) => <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}{n(k) > 0 && (k === 'sent' || k === 'open') && <span className="num"> ({n(k)})</span>}</button>)}
          {page && (list || []).length > 0 && <button className={'chip chip-sel' + (sel ? ' on' : '')} onClick={() => setSel(sel ? null : new Set())}><Icon n={sel ? 'x' : 'check'} s={14} /><span className="chip-sel-t">{sel ? 'Seçimi kapat' : 'Seç'}</span></button>}
        </div>
        {sel && (
          <div className="sel-bar">
            <label className="mini-check"><input type="checkbox" checked={allOn} onChange={(e) => setAll(e.target.checked)} />Tümü ({shown.length})</label>
            <span className="muted">{sel.size} seçili</span>
            <button className="btn sm danger" disabled={!sel.size} onClick={delMany}><Icon n="trash" s={15} />Seçilenleri sil</button>
          </div>
        )}
      </div>
      {range && (
        <div className="range-bar">
          <Icon n="clock" s={15} /><span><b>{rangeLabel(range)}</b> · {range.items ? shown.length + ' sipariş' : 'yükleniyor…'}</span>
          <button className="btn sm ghost" onClick={() => setRangeOpen(true)}>Değiştir</button>
          <button className="icon-btn" aria-label="Tarih aralığını kapat" onClick={() => setRange(null)}><Icon n="x" s={16} /></button>
        </div>
      )}
      {rangeOpen && <RangeSheet unit="sipariş" cur={range} onPick={runRange} onClose={() => setRangeOpen(false)} />}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
      {list == null ? <div className="spinner sm" /> : shown.length === 0 ? (
        <Empty icon="cart" title={t ? 'Aramaya uyan sipariş yok' : range ? 'Bu tarihlerde sipariş yok' : f === 'sent' ? 'Onaylanan sipariş yok' : f === 'open' ? 'Bekleyen sipariş yok' : f === 'all' ? 'Sipariş yok' : 'Tamamlanan sipariş yok'}>
          {!t && !range && f !== 'all' && <p>{f === 'sent' ? 'Müşteri linkten onaylayınca burada görünür.' : f === 'open' ? 'Müşteriye link olarak gönderilip henüz onaylanmamış siparişler burada durur.' : 'Tamamlandı olarak işaretlediğiniz siparişler.'}</p>}
        </Empty>
      ) : (
        <div className={'otable lc-table' + (sel ? ' selecting' : '')}>
          <div className="otable-h">
            {sel && <label className="oc-box" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="Tümünü seç" checked={allOn} onChange={(e) => setAll(e.target.checked)} /></label>}
            <span>Sipariş no</span><span>Müşteri</span><span className="oh-th">Ürünler</span><span>Teslimat / ödeme</span><span className="oh-sum">Tutar</span><span>Tarih</span><span />
          </div>
          <ul className="olist orows">
            {shown.map((c) => {
              const its = finalItems(c);
              const tot = totals(its, 'offer');
              const tl = toTL(tot, c.rate ? { usd: c.rate } : live);
              const ts = subTime(c) || c.at;
              const who = c.sub?.contact?.name || c.name || 'İsimsiz';
              const isNew = c.status === 'sent' && !c.seen;
              const stK = c.status === 'sent' ? 'confirmed' : c.status === 'open' ? 'new' : 'done';
              const o = { items: its };
              const deliv = !c.sub ? null : c.sub.delivery?.method === 'pickup' ? <span className="cbadge shop">Dükkândan</span> : <span className={'cbadge ' + (c.cargo?.code || c.dhl?.ref ? 'dhl' : 'none')}>{c.cargo?.code || (c.dhl?.ref && !c.dhl.cancelled) ? 'DHL' : 'Kargo'}</span>;
              return (
                <li key={c.id}>
                  <div role="button" tabIndex={0} className={'orow st-' + stK + (isNew ? ' unread' : '') + (sel?.has(c.id) ? ' picked' : '')} onClick={() => (sel ? toggle(c.id) : pick(c))} onKeyDown={(e) => e.key === 'Enter' && (sel ? toggle(c.id) : pick(c))}>
                    {sel && <label className="oc-box" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={'#' + c.no + ' seç'} checked={sel.has(c.id)} onChange={() => toggle(c.id)} /></label>}
                    <span className="or-no">{isNew ? <span className="dot-new" aria-label="Yeni" /> : null}<b className="num">#{c.no}</b></span>
                    <span className="or-who"><b>{who}</b><small>{c.sub?.contact?.phone || (c.name && c.sub ? c.name : '')}</small></span>
                    <span className="or-thd"><OrderThumbs o={o} /></span>
                    <span className="or-tags">{c.sub?.pay && <span className="or-pay">{PAY_SHORT[c.sub.pay] || PAY[c.sub.pay] || c.sub.pay}</span>}{deliv}{!c.sub && <span className="muted">Müşteri bekleniyor</span>}</span>
                    <span className="or-sum">{tl != null ? <><b className="num">{fmtTL(tl)}</b><small className="num">{fmtTotals(tot)} · {its.length} ürün</small></> : <><b className="num">{fmtTotals(tot)}</b><small>{its.length} ürün</small></>}</span>
                    <span className="or-date"><span>{fullDate(ts)}</span><small className="or-ago">{ago2(ts)}</small></span>
                    <span className="or-mob"><OrderThumbs o={o} /><span className="or-mob-t"><b className="or-mob-n">{who}</b><span className="num or-mob-s">{tl != null ? fmtTL(tl) : fmtTotals(tot)} <small>· {ago2(ts)}</small></span></span></span>
                    <span className="or-act" />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {page && !range && (f === 'done' || f === 'all') && <OlderBtn kind="lcarts" what="siparişleri" unit="sipariş" />}
      {cur && !page && <LinkCartAdmin c={cur} onBack={hide} />}
    </section>
  );
  if (!page) return sec;
  return (
    <div className={'page lc-page-adm adm-sub' + (calm ? ' no-anim' : '')}>
      <PageHead cls="ord-head" title="Siparişler" newLabel="Yeni sepet linki" onNew={() => go('sepetlink')} />
      <OrdersSwitch on="lcarts" />
      {sec}
    </div>
  );
}
const PAY_SHORT = { havale: 'Havale/EFT', card: 'Kart (link)', shop: 'Dükkânda' };

// Yönetim: linkle gelen siparişin sayfası (31.10.2026: alttan pencere yerine mağaza siparişi gibi tam sayfa)
function LinkCartAdmin({ c, onBack }) {
  const byId = useStore((st) => st.byId);
  const [del, setDel] = useState(false);
  const its = finalItems(c);
  const tot = totals(its, 'offer');
  const s = c.sub;
  const changed = s && ((c.items || []).length !== s.items.length || s.items.some((x) => (c.items || []).find((it) => it.id === x.id)?.qty !== x.qty));
  const a = s?.delivery?.addr;
  const addrText = a ? [s.contact?.name, s.contact?.phone, addrLine(a)].filter(Boolean).join('\n') : '';
  const link = lcartLink(c.id);
  const who = s?.contact?.name || c.name || 'Sipariş';
  const stl = ST[c.status] || ST.open;
  const setSt = (status) => api().updateLcart(c.id, { status }).then(() => toast(status === 'done' ? 'Tamamlandı olarak işaretlendi' : 'Geri alındı')).catch((e) => toast(e.message, 'bad'));
  return (
    <div className="page order-page admin-order lc-adm">
      <div className="send-bar">
        <button className="btn sm ghost oa-back" onClick={onBack} aria-label="Linkle gelen siparişler"><Icon n="back" s={16} /><span>Siparişler</span></button>
        <div className="send-t"><b>Sipariş #{c.no}</b><span className="muted">{c.status === 'open' ? 'Müşteri henüz onaylamadı · ' + when(c.at) : 'Onay: ' + when(subTime(c) || c.at)} · {its.length} ürün · {fmtTotals(tot)}</span>
          <span className="oa-who"><span className="oa-who-g">{who}{c.name && s?.contact?.name && c.name !== s.contact.name ? ' · ' + c.name : ''}</span></span></div>
        <span className="lc-st-pill" style={{ '--t': stl[1] }}>{stl[0]}</span>
        <button className="icon-btn oa-del" onClick={() => setDel(true)} aria-label="Siparişi sil" title="Siparişi sil"><Icon n="trash" s={17} /></button>
      </div>

      {s ? (
        <div className="o-info">
          <div className="o-card">
            <h3>Müşteri</h3>
            <p><b>{s.contact?.name}</b><br /><span className="num">{s.contact?.phone}</span></p>
            {s.contact?.phone && <a className="btn sm wa" href={waLink(s.contact.phone, `Merhaba ${s.contact.name || ''}, #${c.no} numaralı siparişiniz bize ulaştı.`)} target="_blank" rel="noopener"><Icon n="wa" s={15} />WhatsApp’tan yaz</a>}
          </div>
          <div className="o-card">
            <h3>Teslimat{a && <button className="oc-copy" onClick={() => copyText(addrText, 'Adres kopyalandı')} aria-label="Adresi kopyala"><Icon n="copy" s={14} /></button>}</h3>
            {s.delivery?.method === 'pickup' ? <p>{DELIVERY.pickup}</p> : <p>{DELIVERY.cargo}<br />{a ? addrLine(a) : '—'}</p>}
            {s.pay && <p className="muted">Ödeme: {PAY[s.pay] || s.pay}</p>}
          </div>
          {s.note && <div className="o-card lc-note"><h3>Not</h3><p>{s.note}</p></div>}
        </div>
      ) : (
        <div className="banner"><Icon n="clock" /><div><b>Müşteri henüz onaylamadı.</b> Linki gönderdiyseniz onaylayınca burada adres ve iletişim bilgisi görünür.</div></div>
      )}

      {s && s.delivery?.method !== 'pickup' && <CargoCard col="lcarts" o={{ id: c.id, no: c.no, dhl: c.dhl, cargo: c.cargo, status: c.cargo?.delivered ? 'done' : c.cargo?.code ? 'shipped' : 'preparing', delivery: s.delivery, contact: s.contact }} />}

      <div className="lc-linkrow"><Icon n="share" s={15} /><code className="lc-code">{link}</code>
        <button className="icon-btn sm" onClick={() => copyText(link, 'Link kopyalandı')} aria-label="Linki kopyala"><Icon n="copy" s={15} /></button>
        <a className="icon-btn sm" href={link} target="_blank" rel="noopener" aria-label="Linki aç"><Icon n="ext" s={15} /></a></div>

      <div className="lc-st-box lc-adm-items">
        <h3>Ürünler</h3>
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
      </div>

      <div className="row-btns lc-adm-act">
        {c.status === 'sent' && <button className="btn primary" onClick={() => setSt('done')}><Icon n="check" s={16} />Tamamlandı</button>}
        {c.status === 'done' && <button className="btn outline" onClick={() => setSt('sent')}>Tamamlandı’yı geri al</button>}
        {c.status === 'open' && <button className="btn outline" onClick={() => copyText(link, 'Link kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>}
      </div>
      {del && <Confirm title="Sipariş silinsin mi?" text={`#${c.no} kalıcı olarak silinecek${c.status === 'open' ? '; müşteriye gönderdiğiniz link de çalışmaz' : ''}.`} okLabel="Sil" tone="danger" onClose={() => setDel(false)} onOk={() => api().deleteLcart(c.id).then(() => { toast('Silindi'); onBack(); }).catch((e) => toast(e.message, 'bad'))} />}
    </div>
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
  if (done || c.status !== 'open') return <LinkCartStatus c={c} justDone={done} S={S} byId={byId} />;

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
      api().getLcart(c.id).then((x) => x && setC(x)).catch(() => {});
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

// Müşteri: onaylanmış sepet linki = sipariş takip sayfası (durum, onaylanan ürünler, teslimat, kargo takibi)
function LinkCartStatus({ c, justDone, S, byId }) {
  const its = finalItems(c);
  const tot = totals(its, 'offer');
  const sub = c.sub || {};
  const pickup = sub.delivery?.method === 'pickup';
  const cg = c.cargo || {};
  const delivered = c.status === 'done' || !!cg.delivered;
  const shipped = delivered || !!cg.code;
  const steps = [['Onaylandı', true], [pickup ? 'Hazırlanıyor' : 'Kargoya verildi', shipped || (pickup && delivered)], [pickup ? 'Teslim edildi' : 'Teslim edildi', delivered]];
  const head = delivered ? 'Siparişiniz tamamlandı' : shipped ? 'Siparişiniz kargoda' : justDone ? 'Sepetiniz onaylandı' : 'Siparişiniz hazırlanıyor';
  const a = sub.delivery?.addr;
  return (
    <div className="page narrow lc-page">
      <div className="lc-ok lc-st">
        <span className="lc-ok-ic"><Icon n={shipped && !delivered ? 'box' : 'check'} s={30} /></span>
        <h1>{head}</h1>
        <p className="muted">#{c.no}{c.subAt || c.at ? ' · ' + when(subTime(c) || c.at) : ''}</p>
        <ol className="lc-steps">{steps.map(([t, on], i) => <li key={i} className={on ? 'on' : ''}><i />{t}</li>)}</ol>
        {!pickup && cg.code && (
          <div className="lc-track">
            <span>{cg.company || 'Kargo'} takip no</span>
            <b className="num">{cg.code}</b>
            <span className="lc-track-btns">
              <button className="icon-btn sm" onClick={() => copyText(cg.code, 'Takip no kopyalandı')} aria-label="Takip no kopyala"><Icon n="copy" s={15} /></button>
              {cg.url && <a className="btn sm primary" href={cg.url} target="_blank" rel="noopener">Kargom nerede?</a>}
            </span>
          </div>
        )}
        {!pickup && !cg.code && !delivered && <p className="fine">Kargoya verilince takip numarası bu sayfada görünecek.</p>}
      </div>
      <div className="lc-st-box">
        <h3>Ürünler</h3>
        <ul className="lc-items">
          {its.map((it) => (
            <li key={it.id}>
              <Thumb p={byId.get(it.id) || it} size="sm" />
              <span className="lc-n"><b>{it.n}</b></span>
              <span className="lc-q num">{it.qty} × {fmt(it.price, it.cur)}</span>
              <b className="lc-sum num">{fmt(it.price * it.qty, it.cur)}</b>
            </li>
          ))}
        </ul>
        <div className="vle-tot"><span>Toplam</span><b className="num">{fmtTotals(tot)}</b></div>
      </div>
      {c.sub && <div className="lc-st-box">
        <h3>Teslimat</h3>
        <p>{pickup ? DELIVERY.pickup : <>{DELIVERY.cargo}<br />{a ? addrLine(a) : ''}</>}</p>
        {sub.pay && <p className="muted">Ödeme: {PAY[sub.pay] || sub.pay}</p>}
      </div>}
      {S.shop?.whatsapp && <a className="btn wa lc-st-wa" href={waLink(S.shop.whatsapp, `Merhaba, #${c.no} numaralı siparişimle ilgili yazıyorum.`)} target="_blank" rel="noopener"><Icon n="wa" s={17} />WhatsApp’tan yazın</a>}
    </div>
  );
}
