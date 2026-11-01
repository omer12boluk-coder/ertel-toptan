// Mağaza siparişi: KDV dahil TL tutar, kart (demo) ve taksit görünümleri (1.11.2026).
// SADECE mağaza sepeti (cart.jsx, pub), "Siparişi tamamla" (checkout.jsx), müşterinin sipariş sayfası ve yönetimdeki
// mağaza siparişi kullanır. Sipariş formu, sepet linki ve bayi tarafı eski parçaları (VatLines, ListPaper toplamı) kullanmaya devam eder.
// Hesap: paycalc.js (bekçi de aynı dosyayı kullanır).
import { useMemo, useState } from 'react';
import { useStore } from './store.js';
import { Icon, copyText } from './ui.jsx';
import { useRate } from './listsheet.jsx';
import { storeSum, instList, storeVatOn, storeCardOn, cardBrand, luhnOk, digitsOf, invoiceSplit, r2 } from './paycalc.js';

export const tl2 = (v) => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺');
export const usd2 = (v) => '$' + Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rateTxt = (k) => Number(k).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ₺';
export const PREVIEW = typeof location !== 'undefined' && /--/.test(location.hostname); // Firebase önizleme kanalı: siparişler kaydedilmez
export const BRAND = { visa: 'VISA', mastercard: 'Mastercard', troy: 'TROY', amex: 'AMEX' };

// Mağazada KDV dahil satış açık mı (Ayarlar > Fiyat, KDV ve kur > Mağazada KDV dahil satış)
export function useStoreVat() {
  const P = useStore((s) => s.settings.pricing);
  return { on: storeVatOn(P), pct: Number(P.vatPct ?? 20) };
}
export function useStoreCard() {
  const O = useStore((s) => s.settings.orders);
  return { on: storeCardOn(O), list: useMemo(() => instList(O), [O?.inst]) };
}
// Sepet / ödeme ekranındaki tutar (items: sepet kalemleri {offer, cur, qty})
export function useStoreSum(items, pay = 'havale', n = 1, on = true) {
  const rate = useRate();
  const S = useStore((s) => s.settings);
  const list = useMemo(() => instList(S.orders), [S.orders?.inst]);
  return useMemo(() => {
    if (!on) return null;
    return storeSum(items.map((it) => ({ price: it.offer, cur: it.cur, qty: it.qty })), { rate: rate?.usd, vatPct: S.pricing.vatPct ?? 20, vat: storeVatOn(S.pricing), pay, n, inst: list });
  }, [items, rate?.usd, S.pricing.vatPct, S.pricing.storeVatInc, pay, n, list, on]);
}

// Satır altı küçük TL ("799,04 ₺ +KDV")
export function LineTL({ v, cur = 'USD', rate, vat = true }) {
  if (v == null || isNaN(v) || cur !== 'USD' || !(rate > 0)) return null;
  return <small className="ln-tl num">{tl2(r2(v * rate))}{vat && <em>+KDV</em>}</small>;
}

const instName = (ins) => (!ins ? '' : ins.n > 1 ? ins.n + ' taksit' : 'Tek çekim');

// Ödenecek tutar kutusu (büyük KDV dahil TL)
export function PayableBox({ sum, label = 'Ödenecek tutar', compact, usd = true }) {
  if (!sum) return null;
  return (
    <div className={'ssum-pay' + (compact ? ' compact' : '')}>
      <span className="ssum-pay-l"><span>{label}</span>{sum.vatPct > 0 && <span>KDV dahil</span>}</span>
      <b className="ssum-pay-v num">{tl2(sum.pay)}</b>
      {usd && sum.allUsd && <span className="ssum-pay-usd num">{usd2(sum.vatPct > 0 ? sum.usdInc : sum.usd)}{sum.vatPct > 0 && <small>KDV dahil</small>}</span>}
      {sum.inst && <span className="ssum-pay-i num">{sum.inst.n > 1 ? `${sum.inst.n} taksit · ${sum.inst.n} × ${tl2(sum.inst.per)}` : 'Kartla tek çekim'}</span>}
      <span className="ssum-pay-s num">Kur {rateTxt(sum.rate)}</span>
    </div>
  );
}

// Ara toplam / KDV / ödeme komisyonu satırları (+ ek satırlar: kargo vb.)
export function SumRows({ sum, children, incRow, usd = true }) {
  if (!sum) return null;
  return (
    <div className="ssum-rows num">
      <div><span>Ara toplam <small>(KDV hariç)</small></span><span className="v">{tl2(sum.tl)}{usd && sum.allUsd && <small className="ssum-usd">{usd2(sum.usd)}</small>}</span></div>
      {sum.vatPct > 0 && <div><span>KDV %{sum.vatPct.toLocaleString('tr-TR')}</span><span className="v">{tl2(sum.vat)}</span></div>}
      {(incRow || (sum.inst && sum.inst.fee > 0)) && sum.vatPct > 0 && <div className="ssum-inc"><span>KDV dahil</span><span className="v">{tl2(sum.inc)}</span></div>}
      {sum.inst && sum.inst.fee > 0 && <div><span>Ödeme komisyonu{sum.inst.n > 1 && <small> ({instName(sum.inst)} · %{sum.inst.pct.toLocaleString('tr-TR')})</small>}</span><span className="v">+{tl2(sum.inst.fee)}</span></div>}
      {children}
    </div>
  );
}

// ---- Kart formu (demo) + taksit seçenekleri --------------------------------------------------------------
export const emptyCard = () => ({ num: '', name: '', exp: '', cvv: '', n: 1 });
// kart numarası: 16 hane (AMEX 15) — fazlası yazılamaz
const fmtNum = (v) => { let d = digitsOf(v); const amex = /^3[47]/.test(d); d = d.slice(0, amex ? 15 : 16); return amex ? [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ') : d.replace(/(\d{4})(?=\d)/g, '$1 '); };
// son kullanma: AA/YY. "8" → "08", "0829", "08/2029", "082029" hepsi kabul (4 haneli yıl 2 haneye iner)
const fmtExp = (v, prev = '') => {
  const raw = String(v || ''); let d = digitsOf(raw);
  if (raw.length < String(prev).length && /\/$/.test(prev)) d = d.slice(0, 1); // silerken "/" takılmasın
  if (d.length === 1 && Number(d) > 1) d = '0' + d;
  if (d.length >= 5 && d.slice(2, 4) === '20') { // yıl 4 haneli yazılıyor: 08/2029 → 08/29
    d = d.slice(0, 6); if (d.length < 6) return d.slice(0, 2) + '/' + d.slice(2);
    d = d.slice(0, 2) + d.slice(4);
  }
  d = d.slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d.length === 2 && raw.length > String(prev).length ? d + '/' : d;
};
export function cardErrors(c) {
  const e = {}; const d = digitsOf(c.num);
  if (!luhnOk(d) || (/^3[47]/.test(d) ? d.length !== 15 : d.length < 16)) e.cnum = 'Kart numarasını kontrol edin';
  if (String(c.name || '').trim().length < 4) e.cname = 'Kart üzerindeki adı yazın';
  const m = /^(\d{2})\/(\d{2})$/.exec(c.exp || ''); const now = new Date(); const yy = now.getFullYear() % 100, mm = now.getMonth() + 1;
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || Number(m[2]) < yy || (Number(m[2]) === yy && Number(m[1]) < mm) || Number(m[2]) > yy + 20) e.cexp = 'Son kullanma tarihini ay/yıl yazın (ör. 08/29)';
  if (!/^\d{3}$/.test(c.cvv || '')) e.ccvv = 'Kartın arkasındaki 3 haneli kod';
  return e;
}
export const cardOut = (c) => { const d = digitsOf(c.num); return { brand: cardBrand(d) || 'kart', last4: d.slice(-4), bank: 'Demo Bank', demo: true }; };

export function CardForm({ card, setCard, inc, list, err = {} }) {
  const d = digitsOf(card.num);
  const brand = cardBrand(d);
  const known = d.length >= 6;
  const set = (k) => (e) => setCard({ ...card, [k]: k === 'num' ? fmtNum(e.target.value) : k === 'exp' ? fmtExp(e.target.value, card.exp) : k === 'cvv' ? digitsOf(e.target.value).slice(0, 3) : e.target.value.toLocaleUpperCase('tr-TR') });
  const opts = list.length ? list : [{ n: 1, pct: 0 }];
  return (
    <div className="cardf">
      <span className="cardf-demo"><Icon n="shield" s={13} />Demo kart: gerçek çekim yapılmaz, kart bilgisi hiçbir yere gönderilmez</span>
      <label className={'field cardf-num' + (err.cnum ? ' bad' : '')}><span className="field-l">Kart numarası</span>
        <span className="cardf-in"><input id="co-cnum" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" maxLength={19} value={card.num} onChange={set('num')} />{brand && <span className={'cbrand ' + brand}>{BRAND[brand]}</span>}</span>
        {err.cnum && <span className="field-e">{err.cnum}</span>}</label>
      <label className={'field' + (err.cname ? ' bad' : '')}><span className="field-l">Kart üzerindeki ad soyad</span><input id="co-cname" autoComplete="cc-name" value={card.name} onChange={set('name')} />{err.cname && <span className="field-e">{err.cname}</span>}</label>
      <div className="row2 cardf-row">
        <label className={'field' + (err.cexp ? ' bad' : '')}><span className="field-l">Son kullanma</span><input id="co-cexp" inputMode="numeric" autoComplete="cc-exp" placeholder="AA/YY" value={card.exp} onChange={set('exp')} />{err.cexp && <span className="field-e">{err.cexp}</span>}</label>
        <label className={'field' + (err.ccvv ? ' bad' : '')}><span className="field-l">Güvenlik kodu (CVV)</span><input id="co-ccvv" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={3} value={card.cvv} onChange={set('cvv')} />{err.ccvv && <span className="field-e">{err.ccvv}</span>}</label>
      </div>
      {!known
        ? <p className="cardf-wait">Kart numarasının ilk 6 hanesini yazınca taksit seçenekleri burada çıkar.</p>
        : <>
          <div className="cardf-id"><Icon n="check" s={14} /><span>{brand ? BRAND[brand] + ' · ' : ''}Demo Bank kartı tanındı</span></div>
          <div className="insts" role="radiogroup" aria-label="Taksit seçenekleri">
            {opts.map((x) => {
              const tot = r2(inc + r2(inc * x.pct / 100)); const on = Number(card.n) === x.n || (!opts.some((y) => y.n === Number(card.n)) && x === opts[0]);
              return (
                <button key={x.n} type="button" role="radio" aria-checked={on} className={'inst-o' + (on ? ' on' : '')} onClick={() => setCard({ ...card, n: x.n })}>
                  <span className="radio" aria-hidden="true" />
                  <span className="inst-t"><b>{x.n > 1 ? x.n + ' taksit' : 'Tek çekim'}</b>{x.pct > 0 && x.n > 1 && <small>komisyon %{x.pct.toLocaleString('tr-TR')}</small>}</span>
                  <span className="inst-a num"><b>{tl2(tot)}</b>{x.n > 1 && <small>{x.n} × {tl2(r2(tot / x.n))}</small>}</span>
                </button>
              );
            })}
          </div>
        </>}
    </div>
  );
}

// ---- Kayıtlı sipariş (o.sum: bekçinin hesapladığı) ----------------------------------------------------------
export const payLabel = (o, PAY) => (o?.sum && o.pay === 'card' ? 'Kart · ' + (o.sum.inst?.n > 1 ? o.sum.inst.n + ' taksit' : 'tek çekim') : PAY?.[o?.pay] || '');
export const cardLine = (c) => (!c ? '' : [BRAND[c.brand] || c.brand, c.bank, c.last4 && '•••• ' + c.last4].filter(Boolean).join(' · '));

// Sipariş kâğıdının (ListPaper) altına: satırlar + ödenen tutar — açılır kapanır, son hâli cihazda hatırlanır (ls 'osum-open')
const osumGet = () => { try { return localStorage.getItem('osum-open') !== '0'; } catch { return true; } };
export function OrderSumFoot({ o }) {
  const [open, setOpen] = useState(osumGet);
  const sum = o?.sum; if (!sum) return null;
  const tog = () => { const v = !open; setOpen(v); try { localStorage.setItem('osum-open', v ? '1' : '0'); } catch {} };
  const label = o.pay === 'card' ? 'Kartla ödenen' : 'Ödenecek tutar';
  return (
    <div className={'ssum foot' + (open ? ' open' : ' shut')}>
      <button type="button" className="osum-tg" onClick={tog} aria-expanded={open}>
        <span>Ödeme özeti</span>
        {!open && <span className="osum-mini num">{label} · <b>{tl2(sum.pay)}</b>{sum.vatPct > 0 && <small> KDV dahil</small>}</span>}
        <Icon n="chev" s={16} className="osum-chev" />
      </button>
      {open && <div className="osum-body"><SumRows sum={sum} usd={false} /><PayableBox sum={sum} label={label} usd={false} /></div>}
    </div>
  );
}

// Yönetim > sipariş detayı: Ödeme kartı — nasıl ödendi + KDV hariç / KDV dahil (faturaya yazılacak) tutar
export function AdminPayCard({ o }) {
  const sum = o?.sum; if (!sum) return null;
  const how = o.pay === 'card' ? 'Kredi kartı · ' + (sum.inst?.n > 1 ? sum.inst.n + ' taksit' : 'tek çekim') : o.pay === 'havale' ? 'Havale / EFT' : 'Dükkanda ödeme';
  return (
    <div className="o-card pay-card">
      <h3>Ödeme{o.card?.demo && <span className="tag warn">Demo</span>}</h3>
      <p><b>{how}</b></p>
      {o.card && <p className="muted num">{cardLine(o.card)}</p>}
      <p className="pc-amt num">{tl2(sum.pay)}</p>
      {o.pay === 'havale' && sum.vatPct > 0 && <p className="pc-ex num">KDV hariç {tl2(invoiceSplit(sum.pay, sum.vatPct).base)}</p>}
      {o.paid?.at && <p className="pc-paid"><Icon n="check" s={14} />Müşteri ödemeyi yaptığını bildirdi · {new Date(o.paid.at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>}
    </div>
  );
}

// Müşterinin sipariş sayfası: havale siparişinde "Ödemeyi yaptım" bildirimi (bekçi /order-paid; önizleme siparişinde bu cihazda)
export function PaidNotice({ o, payInfo, onSend }) {
  if (!o || o.pay !== 'havale' || o.status === 'cancelled') return null;
  if (o.paid?.at) return <div className="banner ok paid-ok"><Icon n="check" /><div><b>Ödeme bildiriminiz alındı.</b> {new Date(o.paid.at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · Hesabımızı kontrol edip siparişinizi onaylayacağız.</div></div>;
  if (['confirmed', 'preparing', 'ready', 'shipped', 'done'].includes(o.status)) return null; // zaten onaylandı
  return (
    <div className="paid-card">
      <div className="paid-t"><b>Havale / EFT ile ödeme</b><span>{o.sum ? <>Tutarı (<b className="num">{tl2(o.sum.pay)}</b>) gönderdikten sonra aşağıdaki düğmeyle bize bildirin.</> : 'Ödemeyi gönderdikten sonra aşağıdaki düğmeyle bize bildirin.'} Açıklamaya sipariş numarasını yazın: <b>#{o.no}</b></span></div>
      {payInfo && <pre className="paid-iban sel-ok">{payInfo}</pre>}
      <button type="button" className="btn primary" onClick={onSend}><Icon n="check" s={16} />Ödemeyi yaptım, bildir</button>
    </div>
  );
}
