// Yasal metinlerin görünümü (29.10.2026): pencere (LegalSheet), ayrı sayfa /magaza/yasal/<slug> (LegalPage),
// siparişteki onay kutusu (LegalConsent) ve sipariş → sözleşme alanları (legalFromOrder).
import { useEffect, useState } from 'react';
import { useStore, store } from './store.js';
import { Icon, Sheet } from './ui.jsx';
import { RichText } from './footer.jsx';
import { LEGAL_DOCS, legalDoc, legalText, fillLegal } from './legal.js';
import { fmt, fmtTotals } from './utils.js';
import { PAY, DELIVERY, CARRIERS } from './config.js';

const addrLine = (a) => (!a ? '' : [[a.hood, a.address].filter(Boolean).join(' '), [a.district, a.city].filter(Boolean).join(' / ')].filter(Boolean).join(', '));

// Sipariş (kayıtlı ya da ödeme adımındaki taslak) → sözleşmedeki alıcı / ürün alanları
export function legalFromOrder(o, S, tl) {
  if (!o) return null;
  const inv = o.invoice || {};
  const pickup = o.delivery?.method === 'pickup';
  const items = (o.items || []).map((x) => ({ n: x.n, qty: x.qty, line: x.price != null ? fmt(x.price * x.qty, x.cur) : '' }));
  const d = new Date(o.createdAt || Date.now());
  return {
    name: inv.type === 'company' && inv.company ? `${o.contact?.name || ''} (${inv.company})`.trim() : o.contact?.name || '',
    addr: pickup ? `Dükkândan teslim — ${S.shop?.address || ''}` : addrLine(o.delivery?.addr),
    phone: o.contact?.phone || '', email: o.contact?.email || '',
    invoice: inv.type === 'company' ? [inv.company, inv.taxOffice && 'VD ' + inv.taxOffice, inv.taxNo && 'VKN ' + inv.taxNo].filter(Boolean).join(' · ') : 'Bireysel' + (inv.tc ? ' · TCKN ' + inv.tc : ''),
    items,
    total: (() => { // fiyatlar KDV hariç: KDV'li toplam ayrıca yazılır (Ayarlar > Fiyatlandırma > KDV)
      const pct = Number(S.pricing?.vatPct ?? 20); const vat = S.pricing?.showVat !== false && pct > 0;
      const parts = Object.entries(o.total || {}).filter(([, v]) => v).map(([c, v]) => (vat ? `${fmt(v, c)} + %${pct} KDV = ${fmt(v * (1 + pct / 100), c)} (KDV dahil)` : fmt(v, c)));
      return (parts.join(' + ') || fmtTotals(o.total || {})) + (tl ? ' · ≈ ' + tl + ' + KDV' : '');
    })(),
    pay: PAY[o.pay] || '',
    deliv: (DELIVERY[o.delivery?.method] || '') + (!pickup && CARRIERS[o.delivery?.carrier] ? ' · ' + CARRIERS[o.delivery.carrier].name : ''),
    ship: pickup ? 'Yok (dükkândan teslim)' : undefined,
    date: d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function LegalBody({ k, order, S: S0 }) {
  const S1 = useStore((s) => s.settings); const S = S0 || S1; // S0: Ayarlar'daki kaydedilmemiş taslak (önizleme)
  return <RichText text={fillLegal(legalText(S, k), S, order)} />;
}

// Tek metin penceresi; birden çok metin verilirse üstte sekmeler
export function LegalSheet({ k, keys, order, onClose, S }) {
  const list = keys || [k];
  const [cur, setCur] = useState(k || list[0]);
  const doc = legalDoc(cur);
  return (
    <Sheet title={doc?.title || 'Yasal metin'} onClose={onClose} cls="legal-sheet" wide>
      {list.length > 1 && <div className="seg legal-tabs">{list.map((x) => <button key={x} className={x === cur ? 'on' : ''} onClick={() => setCur(x)}>{legalDoc(x)?.title}</button>)}</div>}
      <div className="legal-doc"><LegalBody k={cur} order={order} S={S} /></div>
    </Sheet>
  );
}

// /magaza/yasal/<slug>: solda metin listesi, sağda metin (telefonda üstte açılır seçim)
export function LegalPage() {
  const slug = (/^\/magaza\/yasal\/([\w-]+)/.exec(location.pathname) || [])[1];
  const key = useStore((s) => s.legalKey);
  const [cur, setCur] = useState(legalDoc(slug)?.k || key || 'kvkk');
  useEffect(() => { if (key) setCur(key); }, [key]);
  const pick = (k) => { setCur(k); try { history.replaceState(history.state, '', '/magaza/yasal/' + legalDoc(k).slug); } catch {} window.scrollTo(0, 0); };
  const doc = legalDoc(cur);
  return (
    <div className="page legal-page">
      <aside className="legal-nav">
        <h2>Yasal metinler</h2>
        {LEGAL_DOCS.map((d) => <button key={d.k} className={d.k === cur ? 'on' : ''} onClick={() => pick(d.k)}>{d.title}<Icon n="chev" s={15} /></button>)}
        <select className="legal-sel" value={cur} onChange={(e) => pick(e.target.value)} aria-label="Metin seçin">{LEGAL_DOCS.map((d) => <option key={d.k} value={d.k}>{d.title}</option>)}</select>
      </aside>
      <article className="legal-main">
        <h1>{doc.title}</h1>
        <LegalBody k={cur} />
      </article>
    </div>
  );
}

// Ödeme adımı: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini okudum, onaylıyorum" (zorunlu) + aydınlatma notu
export function LegalConsent({ checked, onChange, error, order }) {
  const [open, setOpen] = useState(null);
  const a = (k, t) => <button type="button" className="linkish" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(k); }}>{t}</button>;
  return (
    <div className={'legal-ok' + (error ? ' bad' : '')}>
      <label className="mini-check">
        <input id="co-legal" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{a('onbilgi', 'Ön bilgilendirme formunu')} ve {a('mesafeli', 'mesafeli satış sözleşmesini')} okudum, onaylıyorum.</span>
      </label>
      {error && <small className="legal-err">{error}</small>}
      <p className="fine legal-note">Kişisel verileriniz {a('kvkk', 'Aydınlatma Metni')} kapsamında işlenir.</p>
      {open && <LegalSheet k={open} keys={open === 'kvkk' ? ['kvkk', 'gizlilik'] : ['onbilgi', 'mesafeli']} order={order} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Üyelik formları: "Üyelik sözleşmesini okudum, kabul ediyorum" (zorunlu)
export function SignupConsent({ checked, onChange, error }) {
  const [open, setOpen] = useState(null);
  const a = (k, t) => <button type="button" className="linkish" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(k); }}>{t}</button>;
  return (
    <div className={'legal-ok' + (error ? ' bad' : '')}>
      <label className="mini-check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{a('uyelik', 'Üyelik sözleşmesini')} okudum, kabul ediyorum. Kişisel verilerimin {a('kvkk', 'Aydınlatma Metni')} kapsamında işlendiğini biliyorum.</span>
      </label>
      {error && <small className="legal-err">{error}</small>}
      {open && <LegalSheet k={open} keys={['uyelik', 'kvkk', 'gizlilik']} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Sipariş sayfası: "Sözleşmeler" bağlantısı (siparişin bilgileriyle doldurulmuş ön bilgilendirme + mesafeli satış)
export function OrderLegalLink({ o, tl }) {
  const S = useStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="linkish o-legal" onClick={() => setOpen(true)}><Icon n="list" s={14} />Sipariş sözleşmeleri</button>
      {open && <LegalSheet k="mesafeli" keys={['mesafeli', 'onbilgi']} order={legalFromOrder(o, S, tl)} onClose={() => setOpen(false)} />}
    </>
  );
}

// Yasal metin sayfasına git (/magaza/yasal/<slug>)
export function openLegal(k = 'kvkk') {
  const d = legalDoc(k) || LEGAL_DOCS[0];
  try { history.replaceState({ ...(history.state || {}), tab: store.s.tab, y: scrollY }, ''); history.pushState({ tab: 'yasal' }, '', '/magaza/yasal/' + d.slug); } catch {}
  store.set({ tab: 'yasal', acct: null, openOrder: null, legalKey: d.k }); window.scrollTo(0, 0);
}
