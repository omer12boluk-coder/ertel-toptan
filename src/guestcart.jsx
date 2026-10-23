// Vitrin (/magaza) sepeti: 1) Sepet → "Sepeti onayla"  2) Gönder adımı: WhatsApp düğmesi + Panoya kopyala.
// Panoya listenin tablo resmi ve linki birlikte kopyalanır; WhatsApp düğmesi ayrıca dükkan sohbetini link yazılı açar.
// İndirme penceresi açılmaz. Liste onaylanınca arka planda kaydedilir (yönetim panelinde Talepler'de görünür).
import { useEffect, useMemo, useState } from 'react';
import { useStore, setQty, clearCart, freshStart, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty } from './ui.jsx';
import { waLink } from './route.js';
import { encodeList, listLink } from './listcode.js';
import { ls, fmt, totals, fmtTotals, now } from './utils.js';
import { renderListImages, currentRate, copyImageAndLink, mergePages } from './listsheet.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newNo = () => Array.from({ length: 4 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

export function GuestCart() {
  const { cart, byId, settings: S } = useStore();
  const [g, setG] = useState(() => ls.get('guest-info', { name: '' }));
  const [no, setNo] = useState(newNo);
  const [step, setStep] = useState('cart'); // cart → send
  const [files, setFiles] = useState(null);
  const urls = useMemo(() => (files ? files.map((f) => URL.createObjectURL(f)) : []), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  const items = useMemo(() => lines.map(({ p, qty }) => {
    const it = { id: p.id, k: p.k, n: p.n, cur: p.cur, qty, list: p.r, asked: p.r > 0 ? p.r : null, offer: p.r > 0 ? p.r : null };
    if (p.pi) it.pi = p.pi; if (p.u) it.u = p.u;
    return it;
  }), [JSON.stringify(cart), byId]);
  const tot = totals(items, 'offer');
  // liste hiçbir yere kaydedilmez: ürünler ve adetler linkin içinde (bkz. listcode.js)
  const link = useMemo(() => listLink(encodeList({ no, name: g.name.trim(), at: Date.now(), items })), [no, g.name, items]);


  async function confirm() {
    if (!items.length) return;
    ls.set('guest-info', g);
    setStep('send'); setFiles(null);
    const req = { no, gname: g.name.trim(), items, status: 'new', createdAt: now(), tl: true };
    try {
      const blobs = await renderListImages(req, { rate: currentRate(), tl: true });
      setFiles(blobs.map((b, i) => new File([b], `liste-${no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' })));
    } catch (e) { toast('Resim hazırlanamadı: ' + e.message, 'bad'); }
  }

  // Panoya: tüm sayfalar tek resimde + link
  async function copy() {
    if (!files?.length) return false;
    try {
      const how = await copyImageAndLink(await mergePages(files), link);
      toast(how === 'both' ? 'Resim ve link kopyalandı — WhatsApp’ta Ctrl+V' : 'Resim kopyalandı — WhatsApp’ta Ctrl+V');
      return true;
    } catch (e) { toast(e.message, 'bad'); return false; }
  }
  const shareOk = () => { try { return !!files?.length && !!navigator.canShare?.({ files, text: link }); } catch { return false; } };
  async function whatsapp() {
    // 1) Paylaş menüsü varsa (telefon, Windows'ta Chrome/Edge): resim + link TEK SEFERDE gider (link resmin altına yazı olarak)
    if (shareOk()) {
      try { await navigator.share({ files, text: link }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    // 2) Yoksa: resmi panoya kopyala, WhatsApp sohbetini link yazılı aç → sohbette Ctrl+V ile resmi ekleyin
    let ok = false;
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': await mergePages(files) })]); ok = true; } catch {}
    window.open(waLink(S.shop.whatsapp, link), '_blank', 'noopener');
    toast(ok ? 'Resim kopyalandı. WhatsApp’ta mesaj kutusuna Ctrl+V yapın; link hazır yazılı.' : 'WhatsApp açıldı. Resmi “Panoya kopyala” ile ayrıca ekleyin.', ok ? 'ok' : 'info');
  }
  function reset() { freshStart(); setG({ name: '' }); setStep('cart'); setFiles(null); go('katalog'); toast('Sepet sıfırlandı'); }

  if (!lines.length) {
    return (
      <div className="page narrow">
        <h1 className="page-t">Sepet</h1>
        <Empty icon="cart" title="Sepetiniz boş">
          <p>Ürünleri sepete ekleyin, sonra WhatsApp’tan bize gönderin.</p>
          <button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button>
        </Empty>
      </div>
    );
  }

  if (step === 'send') {
    return (
      <div className="page send-step">
        <div className="send-bar">
          <button className="btn sm ghost" onClick={() => setStep('cart')}><Icon n="back" s={16} />Sepet</button>
          <div className="send-t"><b>Liste #{no}</b><span className="muted">{items.length} kalem · {fmtTotals(tot)}</span></div>
          <div className="send-btns">
            <button className="btn wa" onClick={whatsapp} disabled={!files || !S.shop.whatsapp}><Icon n="wa" s={17} />{files ? 'WhatsApp’tan gönder' : 'Hazırlanıyor…'}</button>
            <button className="btn outline" onClick={() => copy()} disabled={!files}><Icon n="copy" s={16} />Panoya kopyala</button>
          </div>
        </div>
        <p className="fine send-hint">{shareOk() ? 'WhatsApp’tan gönder: açılan paylaş penceresinde WhatsApp’ı ve dükkan sohbetini seçin — resim ve link birlikte gider.' : 'WhatsApp’tan gönder: resim kopyalanır, sohbet link yazılı açılır; mesaj kutusunda Ctrl+V yapıp gönderin.'}</p>
        {!S.shop.whatsapp && <p className="err">Dükkan WhatsApp numarası henüz girilmemiş.</p>}
        {urls.length > 0 ? <div className="send-imgs">{urls.map((u, i) => <img key={i} src={u} alt={`Liste resmi ${i + 1}`} />)}</div> : <div className="list-wait"><div className="spinner" /></div>}
        <button className="btn ghost danger fresh-btn" onClick={reset}><Icon n="refresh" s={16} />Bitti, sepeti sıfırla</button>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div className="cart-head">
        <h1 className="page-t">Sepet <span className="muted">· {lines.length} kalem</span></h1>
        <button className="btn sm ghost danger" onClick={reset}><Icon n="refresh" s={15} />Sepeti sıfırla</button>
      </div>
      <div className="cart-grid">
        <ul className="clist">
          {lines.map(({ p, qty }) => (
            <li key={p.id} className="cline">
              <Thumb p={p} size="sm" />
              <div className="cline-info">
                <span className="prow-name">{p.n}</span>
                <span className="prow-meta"><code>{p.k}</code></span>
              </div>
              <div className="cline-ctl">
                <Stepper small value={qty} onChange={(v) => setQty(p.id, v)} />
                <div className="cline-sum">
                  <span className="muted num">{p.r > 0 ? `${qty} × ${fmt(p.r, p.cur)}` : 'Fiyat sorulacak'}</span>
                  <b className="num">{p.r > 0 ? fmt(p.r * qty, p.cur) : '—'}</b>
                </div>
                <button className="icon-btn sm" onClick={() => setQty(p.id, 0)} aria-label="Kaldır"><Icon n="trash" s={16} /></button>
              </div>
            </li>
          ))}
        </ul>
        <aside className="cart-sum">
          <div className="sum-rows"><div className="sum-total"><span>Toplam</span><b className="num">{fmtTotals(tot)}</b></div></div>
          <label className="field"><span className="field-l">Adınız / dükkanınız <small className="opt">(isteğe bağlı)</small></span><input id="g-name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} autoComplete="name" placeholder="ör. Ahmet – Kadıköy GSM" /></label>
          <button className="btn primary big" onClick={confirm}><Icon n="check" /><span><b>Sepeti onayla</b><small>Sonraki adımda WhatsApp’tan gönderin</small></span></button>
          <p className="fine">Liste fiyatlarıdır. Listenizi fiyatlandırıp aynı tabloyla WhatsApp’tan size döneriz.</p>
        </aside>
      </div>
    </div>
  );
}
