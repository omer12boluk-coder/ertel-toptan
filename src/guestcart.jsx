// Vitrin (/magaza) sepeti: 1) Sepet → "Sepeti onayla"  2) Gönder adımı: WhatsApp düğmesi + Panoya kopyala.
// Panoya listenin tablo resmi ve linki birlikte kopyalanır; WhatsApp düğmesi ayrıca dükkan sohbetini link yazılı açar.
// İndirme penceresi açılmaz. Liste onaylanınca arka planda kaydedilir (yönetim panelinde Talepler'de görünür).
import { useEffect, useMemo, useState } from 'react';
import { useStore, setQty, clearCart, api, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty } from './ui.jsx';
import { waLink } from './route.js';
import { encodeList, listLink } from './listcode.js';
import { ls, fmt, totals, fmtTotals, now } from './utils.js';
import { renderListImages, currentRate, copyImageAndLink } from './listsheet.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newNo = () => Array.from({ length: 4 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

export function GuestCart() {
  const { cart, byId, settings: S } = useStore();
  const [g, setG] = useState(() => ls.get('guest-info', { name: '' }));
  const [no, setNo] = useState(newNo);
  const [step, setStep] = useState('cart'); // cart → send
  const [files, setFiles] = useState(null);
  const [page, setPage] = useState(0); // kopyalanacak resim (birden fazla sayfa varsa)
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
    setStep('send'); setFiles(null); setPage(0);
    const req = { no, gname: g.name.trim(), items, status: 'new', createdAt: now(), tl: true };
    try {
      const blobs = await renderListImages(req, { rate: currentRate(), tl: true });
      setFiles(blobs.map((b, i) => new File([b], `liste-${no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' })));
    } catch (e) { toast('Resim hazırlanamadı: ' + e.message, 'bad'); }
  }

  async function copy(k = page) {
    if (!files?.[k]) return false;
    try {
      const how = await copyImageAndLink(files[k], link);
      toast(files.length > 1 ? `${k + 1}. resim${how === 'both' ? ' ve link' : ''} kopyalandı` : how === 'both' ? 'Resim ve link kopyalandı' : 'Resim kopyalandı');
      if (k + 1 < files.length) setPage(k + 1);
      return true;
    } catch (e) { toast(e.message, 'bad'); return false; }
  }
  async function whatsapp() {
    // resmi panoya kopyala, WhatsApp'ta dükkan sohbetini link yazılı halde aç → sohbette Ctrl+V
    const ok = await copy(0);
    if (!ok && files?.length && navigator.canShare?.({ files })) { try { await navigator.share({ files, text: link }); return; } catch {} }
    window.open(waLink(S.shop.whatsapp, link), '_blank', 'noopener');
  }

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
      <div className="page narrow send-step">
        <button className="btn sm ghost back-btn" onClick={() => setStep('cart')}><Icon n="back" s={16} />Sepete dön</button>
        <div className="send-card">
          <h1 className="page-t">Listeniz hazır · #{no}</h1>
          <p className="muted">{items.length} kalem · {fmtTotals(tot)}</p>
          <button className="wa-big" onClick={whatsapp} disabled={!files || !S.shop.whatsapp}>
            <Icon n="wa" s={34} />
            <span><b>{files ? 'WhatsApp’tan gönder' : 'Resim hazırlanıyor…'}</b><small>Resim kopyalanır, sohbet açılır → mesaj kutusunda yapıştırın</small></span>
          </button>
          <button className="btn outline big" onClick={() => copy()} disabled={!files}><Icon n="copy" s={18} />{files && files.length > 1 ? `Panoya kopyala (${page + 1}/${files.length}. resim)` : 'Panoya kopyala'}</button>
          <p className="fine">Kopyalayınca resim ve liste linki birlikte gelir: WhatsApp’ta sohbete <kbd>Ctrl</kbd>+<kbd>V</kbd> (telefonda basılı tutup Yapıştır).{files && files.length > 1 && ' Listeniz birden fazla resim oldu; her basışta sıradaki resim kopyalanır.'}</p>
          {!S.shop.whatsapp && <p className="err">Dükkan WhatsApp numarası henüz girilmemiş.</p>}
        </div>
        {urls.length > 0 && <div className="img-prev">{urls.map((u, i) => <img key={i} src={u} alt={`Liste resmi ${i + 1}`} />)}</div>}
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div className="cart-head">
        <h1 className="page-t">Sepet <span className="muted">· {lines.length} kalem</span></h1>
        <button className="link danger" onClick={clearCart}>Sepeti boşalt</button>
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
