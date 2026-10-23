// Vitrin (/magaza) sepeti — olabildiğince basit:
//   ürünleri ekle → Sepet → büyük yeşil "WhatsApp'tan gönder" → WhatsApp dükkan sohbetinde sadece liste linkiyle açılır → müşteri gönder'e basar.
// Liste hiçbir yere kaydedilmez; ürünler ve adetler linkin içindedir (bkz. listcode.js). Pano / paylaş penceresi kullanılmaz.
import { useEffect, useMemo, useState } from 'react';
import { useStore, setQty, freshStart, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty, copyText } from './ui.jsx';
import { waLink, links } from './route.js';
import { fmt, totals, fmtTotals } from './utils.js';
import { encodeList, listLink, listItems, listRecord } from './listcode.js';
import { renderListImages, currentRate } from './listsheet.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newNo = () => Array.from({ length: 4 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

const isPhone = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

export function GuestCart() {
  const { cart, byId, settings: S } = useStore();
  const [no] = useState(newNo);
  const [opened, setOpened] = useState(false);
  const [files, setFiles] = useState(null); // telefonda paylaşılacak liste resimleri

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  const items = useMemo(() => lines.map(({ p, qty }) => ({ id: p.id, qty })), [JSON.stringify(cart), byId]);
  const tot = totals(lines.map(({ p, qty }) => ({ cur: p.cur, qty, offer: p.r > 0 ? p.r : null })), 'offer');
  const link = useMemo(() => listLink(encodeList({ no, at: Date.now(), items })), [no, items]);
  const wa = S.shop.whatsapp ? waLink(S.shop.whatsapp, link) : null;

  // Telefonda paylaş menüsüyle resim + link birlikte gider; resimleri önceden hazırla (dokunma anında paylaşım açılabilsin)
  useEffect(() => {
    setFiles(null);
    if (!isPhone() || !navigator.share || !items.length) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const L = { no, at: Date.now(), rows: items.map((i) => ({ ...i, price: null })), priced: false };
        const rec = listRecord(L, listItems(L, byId));
        const blobs = await renderListImages(rec, { rate: currentRate() });
        if (live) setFiles(blobs.map((b, i) => new File([b], `liste-${no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' })));
      } catch {}
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [items]);

  async function send() {
    if (isPhone() && navigator.share) {
      try {
        const data = files?.length && navigator.canShare?.({ files, text: link }) ? { files, text: link } : { text: link };
        await navigator.share(data); setOpened(true); return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (!wa) return toast('Dükkan WhatsApp numarası girilmemiş', 'bad');
    window.open(wa, '_blank', 'noopener');
    setOpened(true);
  }
  function reset() { freshStart(); setOpened(false); go('katalog'); toast('Sepet temizlendi'); }

  if (!lines.length) {
    return (
      <div className="page narrow">
        <h1 className="page-t">Sepet</h1>
        <Empty icon="cart" title="Sepetiniz boş">
          <p>Ürünlerin yanındaki <b>Ekle</b> düğmesine basın, sonra buraya gelin.</p>
          <button className="btn primary big" onClick={() => go('katalog')}><Icon n="grid" />Ürünlere git</button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="page gcart">
      <div className="gtop">
        <div className="gtop-t">
          <h1 className="page-t">Sepetiniz</h1>
          <span className="muted">{lines.length} ürün · <b className="num gtop-sum">{fmtTotals(tot)}</b></span>
        </div>
        <div className="gtop-btns">
          <button className="btn wa" onClick={send} disabled={!wa && !isPhone()}><Icon n="wa" s={18} />WhatsApp’tan gönder</button>
          <button className="btn outline" onClick={() => copyText(link, 'Liste linki kopyalandı')}><Icon n="copy" s={16} />Linki kopyala</button>
        </div>
      </div>
      {opened && (
        <div className="gsend-done">
          <span><b>WhatsApp açıldı.</b> Göndermediyseniz WhatsApp’ta <b>gönder</b>’e basın.</span>
          <button className="btn sm outline" onClick={reset}><Icon n="check" s={15} />Gönderdim, sepeti temizle</button>
        </div>
      )}
      {!S.shop.whatsapp && <p className="err">Dükkan WhatsApp numarası henüz girilmemiş.</p>}

      <ul className="clist gclist">
        {lines.map(({ p, qty }) => (
          <li key={p.id} className="gline">
            <a className="gline-p" href={links.product(p, S)} target="_blank" rel="noopener" title="Ürünü yeni sekmede incele">
              <Thumb p={p} size="sm" />
              <span className="cline-info">
                <span className="prow-name">{p.n}</span>
                <span className="prow-meta"><code>{p.k}</code>{p.r > 0 && <span>{fmt(p.r, p.cur)}</span>}</span>
              </span>
            </a>
            <div className="gline-ctl">
              <Stepper small value={qty} onChange={(v) => setQty(p.id, v)} />
              <b className="num gline-sum">{p.r > 0 ? fmt(p.r * qty, p.cur) : '—'}</b>
              <button className="icon-btn sm" onClick={() => setQty(p.id, 0)} aria-label="Sepetten çıkar"><Icon n="trash" s={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      <button className="btn sm ghost danger gclear" onClick={reset}><Icon n="trash" s={15} />Sepeti temizle</button>
    </div>
  );
}

// Vitrinde ürün listesinin altında duran sepet çubuğu (sepette ürün varken)
export function GuestCartBar() {
  const { cart, byId, tab } = useStore();
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  if (tab !== 'katalog' || !lines.length) return null;
  const tot = totals(lines.map(({ p, qty }) => ({ cur: p.cur, qty, offer: p.r > 0 ? p.r : null })), 'offer');
  return (
    <button className="gbar" onClick={() => go('sepet')}>
      <span className="gbar-n"><Icon n="cart" s={20} /><b>{lines.length}</b></span>
      <span className="gbar-t"><b>Sepete git</b><small>{lines.length} ürün · {fmtTotals(tot)}</small></span>
      <span className="gbar-go">Gönder <Icon n="back" s={18} className="flip" /></span>
    </button>
  );
}

// Vitrin ürünler sayfasının üstünde 3 adımlık kısa tarif
export function GuestGuide() {
  const [off, setOff] = useState(() => { try { return sessionStorage.getItem('guide-off') === '1'; } catch { return false; } });
  if (off) return null;
  return (
    <div className="gguide">
      <ol>
        <li><b>1</b><span>İstediğiniz ürünlerde <b>Ekle</b>’ye basın</span></li>
        <li><b>2</b><span>Alttaki <b>Sepete git</b>’e basın</span></li>
        <li><b>3</b><span>Yeşil <b>WhatsApp’tan gönder</b>’e basın</span></li>
      </ol>
      <button className="icon-btn sm" onClick={() => { setOff(true); try { sessionStorage.setItem('guide-off', '1'); } catch {} }} aria-label="Kapat"><Icon n="x" s={14} /></button>
    </div>
  );
}
