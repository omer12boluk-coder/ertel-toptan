// Mağazanın alt bilgisi: kısa tanıtım, iletişim (adres, saat, telefon + isim, e-posta, WhatsApp), sosyal medya,
// bilgi sayfaları (Kargo ve teslimat, İade ve değişim… — Ayarlar > Alt bilgi ve sayfalar'dan yazılır) ve şirket unvanı.
// Sayfalar pencere olarak açılır. Metin biçimi: boş satır = yeni paragraf, "- " ile başlayan satır = madde, **kalın**.
import { useState } from 'react';
import { useStore, go } from './store.js';
import { Icon, Sheet } from './ui.jsx';
import { waLink } from './route.js';
import { LOGO_MARK } from './config.js';
import { LEGAL_DOCS } from './legal.js';
import { openLegal } from './legalui.jsx';

// Kabul edilen kart logoları (8.11.2026, sanal POS başvurusu): küçük, düz çizim — dışarıdan resim yüklenmez
const CardMarks = () => (
  <span className="sfoot-cards" aria-label="Kabul edilen kartlar: Visa, Mastercard, Troy">
    <svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="5" fill="#fff" stroke="#e3e5e8" /><text x="24" y="20" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="13" fill="#1a1f71">VISA</text></svg>
    <svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="5" fill="#fff" stroke="#e3e5e8" /><circle cx="19.5" cy="15" r="8" fill="#eb001b" /><circle cx="28.5" cy="15" r="8" fill="#f79e1b" fillOpacity=".9" /></svg>
    <svg viewBox="0 0 48 30" aria-hidden="true"><rect width="48" height="30" rx="5" fill="#fff" stroke="#e3e5e8" /><text x="24" y="19.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="11.5" letterSpacing=".5" fill="#00a6a0">TROY</text></svg>
    <span className="sfoot-sec"><Icon n="shield" s={13} />256-bit SSL · 3D Secure</span>
  </span>
);

// 14.11.2026 başlık + bağlantı listesi. Telefonda html.ux-foot açıkken başlığa dokununca açılır/kapanır (CSS);
// bilgisayarda ve 'old' ayarında başlık düz yazı gibi görünür, liste hep açık.
function Fold({ title, h2, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'sfoot-fold' + (open ? ' open' : '')}>
      <h4 className={h2 ? 'sfoot-h2' : ''}><button type="button" className="sfoot-tg" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{title}<Icon n="chev" s={16} /></button></h4>
      {children}
    </div>
  );
}

// Ürün talebi / sorun bildir sayfaları (menüde yok; alt bilgiden açılır, adres /magaza/talep · /magaza/sorun)
const goTab = (t) => (e) => { e.preventDefault(); go(t); };
export function ShopFooter({ compact = false }) {
  const S = useStore((s) => s.settings);
  const [page, setPage] = useState(null);
  const F = S.footer || {};
  if (F.on === false) return null;
  const pages = (F.pages || []).filter((p) => p.title && p.body);
  const phones = (F.phones || []).filter((p) => p.phone);
  const tel = (x) => 'tel:' + String(x).replace(/[^\d+]/g, '');
  const wa = S.shop.whatsapp;
  const social = [
    F.instagram && ['ig', 'Instagram', F.instagram],
    F.facebook && ['fb', 'Facebook', F.facebook],
    wa && ['wa', 'WhatsApp', waLink(wa, '')],
  ].filter(Boolean);
  // kısa alt bilgi (ana sayfa dışındaki sayfalar): kullanıcı isteği (30.10.2026) — tıklanabilir hiçbir şey yok, sadece unvan
  if (compact) return (
    <footer className="sfoot compact">
      <div className="sfoot-mini"><span>© {new Date().getFullYear()} {F.company || S.brand.appName}</span></div>
    </footer>
  );

  return (
    <footer className="sfoot">
      <div className="sfoot-in">
        <div className="sfoot-brand">
          <div className="sfoot-logo"><img src={S.brand.logo || LOGO_MARK} alt="" /><b>{S.brand.appName}</b></div>
          {F.about && <p>{F.about}</p>}
          {social.length > 0 && <div className="sfoot-social">{social.map(([ic, l, u]) => (
            <a key={ic} href={u} target="_blank" rel="noopener" aria-label={l} title={l}><Icon n={ic} s={19} /></a>
          ))}</div>}
        </div>
        <div className="sfoot-col">
          <h4>İletişim</h4>
          <ul className="sfoot-list">
            {(F.address || S.shop.address) && <li><Icon n="pin" s={17} /><span>{F.address || S.shop.address}</span></li>}
            {S.shop.hours && <li><Icon n="clock" s={17} /><span>{S.shop.hours}</span></li>}
            {phones.map((p, i) => <li key={i}><Icon n="phone" s={17} /><span><a href={tel(p.phone)}>{p.phone}</a>{p.name && <small> · {p.name}</small>}</span></li>)}
            {F.email && <li><Icon n="mail" s={17} /><span><a href={'mailto:' + F.email}>{F.email}</a></span></li>}
          </ul>
        </div>
        {/* Bilgi + Yardım aynı sütunda (Yardım, Bilgi'nin altında yeni başlık) — sütun sayısı artmasın */}
        <div className="sfoot-col sfoot-fc">
          {pages.length > 0 && <Fold title="Bilgi">
            <ul className="sfoot-links">{pages.map((p, i) => <li key={i}><button onClick={() => (/[İi]ade/i.test(p.title) ? openLegal('iade') : setPage(p))}>{p.title}<Icon n="chev" s={15} /></button></li>)}</ul>
          </Fold>}
          <Fold title="Yardım" h2={pages.length > 0}>
            <ul className="sfoot-links">
              <li><a href="/talep" onClick={goTab('talep')}>Ürün talebi<Icon n="chev" s={15} /></a></li>
              <li><a href="/sorun" onClick={goTab('sorun')}>Sorun bildir<Icon n="chev" s={15} /></a></li>
            </ul>
          </Fold>
        </div>
        <div className="sfoot-col sfoot-fc">
          <Fold title="Yasal">
            <ul className="sfoot-links">{LEGAL_DOCS.map((d) => <li key={d.k}><button onClick={() => openLegal(d.k)}>{d.title}<Icon n="chev" s={15} /></button></li>)}</ul>
          </Fold>
        </div>
      </div>
      <div className="sfoot-bot">
        <span>© {new Date().getFullYear()} {F.company || S.brand.appName}</span>
        {/* vergi / MERSİS: Ayarlar › Alt bilgi ve sayfalar › Yasal metinler'de girilince görünür */}
        {(() => { const L = S.legal || {}; const v = [L.taxOffice && 'Vergi D.: ' + L.taxOffice, L.taxNo && 'Vergi No: ' + L.taxNo, L.mersis && 'MERSİS: ' + L.mersis].filter(Boolean); return v.length ? <span className="sfoot-tax">{v.join(' · ')}</span> : null; })()}
        <CardMarks />
      </div>
      {page && <Sheet title={page.title} onClose={() => setPage(null)}><RichText text={page.body} /></Sheet>}
    </footer>
  );
}

// Basit biçimli metin: paragraflar, "- " maddeler, **kalın**. HTML kabul etmez (güvenli).
export function RichText({ text }) {
  const inline = (s) => String(s).split(/(\*\*[^*]+\*\*)/g).map((x, i) => (x.startsWith('**') && x.endsWith('**') ? <b key={i}>{x.slice(2, -2)}</b> : x));
  const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/);
  return (
    <div className="rtext">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ''))}</li>)}</ul>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l)}</span>)}</p>;
      })}
    </div>
  );
}
