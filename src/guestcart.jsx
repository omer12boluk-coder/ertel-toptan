// Vitrin (/magaza) sepeti — olabildiğince basit:
//   ürünleri ekle → Sepet → büyük yeşil "WhatsApp'tan gönder" → WhatsApp dükkan sohbetinde sadece liste linkiyle açılır → müşteri gönder'e basar.
// Liste hiçbir yere kaydedilmez; ürünler ve adetler linkin içindedir (bkz. listcode.js). Pano / paylaş penceresi kullanılmaz.
import { useEffect, useMemo, useState } from 'react';
import { useStore, setQty, freshStart, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty, VatLines, copyText } from './ui.jsx';
import { waLink, links } from './route.js';
import { fmt, totals, fmtTotals } from './utils.js';
import { encodeList, listLink, listItems, listRecord } from './listcode.js';
import { renderListImages, currentRate, ListPaper } from './listsheet.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newNo = () => Array.from({ length: 4 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

const isPhone = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

export function GuestCart() {
  const { cart, byId, settings: S } = useStore();
  const [no] = useState(newNo);
  const [step, setStep] = useState('cart'); // cart → send
  const [sharedImgs, setSharedImgs] = useState(false); // telefonda resimler gönderildi, sıra linkte
  const [files, setFiles] = useState(null); // telefonda paylaşılacak liste resimleri

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  const items = useMemo(() => lines.map(({ p, qty }) => ({ id: p.id, qty })), [JSON.stringify(cart), byId]);
  const tot = totals(lines.map(({ p, qty }) => ({ cur: p.cur, qty, offer: p.r > 0 ? p.r : null })), 'offer');
  const link = useMemo(() => listLink(encodeList({ no, at: Date.now(), items })), [no, items]);
  const wa = S.shop.whatsapp ? waLink(S.shop.whatsapp, link) : null;
  const L = useMemo(() => ({ no, at: Date.now(), rows: items.map((i) => ({ ...i, price: null })), priced: false }), [no, items]);
  const rec = useMemo(() => listRecord(L, listItems(L, byId)), [L, byId]);
  const phone = isPhone() && !!navigator.share;

  // Telefonda resimleri önceden hazırla (paylaş menüsü dokunma anında açılabilsin)
  useEffect(() => {
    setFiles(null);
    if (step !== 'send' || !phone || !items.length) return;
    let live = true;
    renderListImages(rec, { rate: currentRate() }).then((blobs) => {
      if (live) setFiles(blobs.map((b, i) => new File([b], `liste-${no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' })));
    }).catch(() => {});
    return () => { live = false; };
  }, [step, rec]);

  async function send() {
    // Telefon: önce resimler (paylaş menüsü), sonra link ayrı mesaj olarak (aşağıdaki "Linki gönder")
    if (phone && files?.length && navigator.canShare?.({ files })) {
      try { await navigator.share({ files }); setSharedImgs(true); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    if (!wa) return toast('Dükkan WhatsApp numarası girilmemiş', 'bad');
    window.open(wa, '_blank', 'noopener');
  }
  function reset() { freshStart(); setStep('cart'); setSharedImgs(false); go('katalog'); toast('Sepet temizlendi'); }

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

  if (step === 'send') {
    return (
      <div className="page send-step">
        <div className="send-bar">
          <button className="btn sm ghost" onClick={() => { setStep('cart'); setSharedImgs(false); }}><Icon n="back" s={16} />Sepet</button>
          <div className="send-t"><b>Liste #{no}</b><span className="muted">{lines.length} ürün · {fmtTotals(tot)}</span></div>
          <div className="send-btns">
            <button className="btn wa" onClick={send} disabled={(phone && !files) || (!phone && !wa)}><Icon n="wa" s={17} />{phone && !files ? 'Hazırlanıyor…' : 'WhatsApp’tan gönder'}</button>
            <button className="btn outline" onClick={() => copyText(link, 'Link kopyalandı — WhatsApp’ta yapıştırın')}><Icon n="copy" s={16} />Linki kopyala</button>
          </div>
        </div>
        {sharedImgs ? (
          <div className="gsend-done">
            <span><b>Resimler gönderildi.</b> Şimdi listenin linkini de gönderin:</span>
            <a className="btn wa" href={wa} target="_blank" rel="noopener"><Icon n="wa" s={16} />Linki WhatsApp’tan gönder</a>
          </div>
        ) : (
          <p className="fine send-hint">İsterseniz <b>Linki kopyala</b>’ya dokunup WhatsApp’ta yapıştırarak da gönderebilirsiniz.</p>
        )}
        {!S.shop.whatsapp && <p className="err">Dükkan WhatsApp numarası henüz girilmemiş.</p>}
        <ListPaper r={rec} rate={currentRate()} />
        <button className="btn sm ghost danger gclear" onClick={reset}><Icon n="check" s={15} />Gönderdim, sepeti temizle</button>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div className="cart-head">
        <h1 className="page-t">Sepet <span className="muted">· {lines.length} ürün</span></h1>
        <button className="btn sm ghost danger" onClick={reset}><Icon n="trash" s={15} />Sepeti temizle</button>
      </div>
      <div className="cart-grid">
        <ul className="clist gclist">
          <li className="gline gline-h" aria-hidden="true"><span>Ürün</span><span className="gline-ctl"><span className="r">Birim fiyat</span><span className="c">Adet</span><span className="r">Toplam</span><span /></span></li>
          {lines.map(({ p, qty }) => (
            <li key={p.id} className="gline">
              <a className="gline-p" href={links.product(p, S)} target="_blank" rel="noopener" title="Ürünü yeni sekmede incele">
                <Thumb p={p} size="sm" />
                <span className="cline-info">
                  <span className="prow-name">{p.n}</span>
                  <span className="prow-meta"><code>{p.k}</code></span>
                </span>
              </a>
              <div className="gline-ctl">
                <span className="num gline-unit" data-l="Birim">{p.r > 0 ? fmt(p.r, p.cur) : '—'}</span>
                <Stepper small value={qty} onChange={(v) => setQty(p.id, v)} />
                <b className="num gline-sum">{p.r > 0 ? fmt(p.r * qty, p.cur) : '—'}</b>
                <button className="icon-btn sm" onClick={() => setQty(p.id, 0)} aria-label="Sepetten çıkar"><Icon n="trash" s={16} /></button>
              </div>
            </li>
          ))}
        </ul>
        <aside className="cart-sum">
          <div className="sum-rows"><div className="sum-total"><span>Toplam</span><b className="num">{fmtTotals(tot)}</b></div></div>
          <VatLines by={tot} />
          <button className="btn primary big" onClick={() => { setStep('send'); window.scrollTo(0, 0); }}><Icon n="check" />Sepeti onayla</button>
        </aside>
      </div>
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
        <li><b>3</b><span><b>Sepeti onayla</b>, sonra yeşil <b>WhatsApp’tan gönder</b>’e basın <small className="muted">(ya da Linki kopyala’ya dokunup WhatsApp’ta yapıştırın)</small></span></li>
      </ol>
      <button className="icon-btn sm" onClick={() => { setOff(true); try { sessionStorage.setItem('guide-off', '1'); } catch {} }} aria-label="Kapat"><Icon n="x" s={14} /></button>
    </div>
  );
}
