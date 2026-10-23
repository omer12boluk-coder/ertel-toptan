// Vitrin (/magaza) sepeti: müşteri ürünleri seçer, "WhatsApp'tan gönder"e basar.
// Telefonda paylaş menüsü açılır: WhatsApp'a listenin tablo resim(ler)i + altında sadece link gider.
// Bilgisayarda resim panoya kopyalanır, WhatsApp sohbeti linkle açılır; resmi yapıştırmak yeterli.
// Sayfa yerinde kalır; liste arka planda kaydedilir (yönetim panelinde Talepler'de görünür).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, setQty, clearCart, api, toast, go } from './store.js';
import { Icon, Thumb, Stepper, Empty } from './ui.jsx';
import { waLink, links } from './route.js';
import { ls, fmt, totals, fmtTotals, now } from './utils.js';
import { renderListImages, currentRate } from './listsheet.jsx';

const CODE = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newNo = () => Array.from({ length: 4 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');
const canShareFiles = () => { try { return !!navigator.canShare?.({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] }); } catch { return false; } };

export function GuestCart() {
  const { cart, byId, settings: S } = useStore();
  const [g, setG] = useState(() => ls.get('guest-info', { name: '' }));
  const [draft, setDraft] = useState(() => ls.get('guest-draft', null) || { id: api().newRequestId?.() || 'r_' + Date.now(), no: newNo() });
  const [files, setFiles] = useState(null); // hazır resimler
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const rendering = useRef(0);

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l) => l.p);
  const items = useMemo(() => lines.map(({ p, qty }) => {
    const it = { id: p.id, k: p.k, n: p.n, cur: p.cur, qty, list: p.r, asked: p.r > 0 ? p.r : null, offer: p.r > 0 ? p.r : null };
    if (p.pi) it.pi = p.pi; if (p.u) it.u = p.u;
    return it;
  }), [JSON.stringify(cart), byId]);
  const tot = totals(items, 'offer');
  const req = useMemo(() => ({ no: draft.no, gname: g.name.trim(), items, status: 'new', createdAt: now(), tl: true }), [draft.no, g.name, items]);

  useEffect(() => { ls.set('guest-draft', draft); }, [draft]);
  // Resimleri önceden hazırla: butona basınca beklemeden paylaşılsın (telefonlar paylaşımı ancak dokunma anında açar)
  useEffect(() => {
    setFiles(null);
    if (!items.length) return;
    const my = ++rendering.current;
    const t = setTimeout(async () => {
      try {
        const blobs = await renderListImages(req, { rate: currentRate(), tl: true });
        if (my !== rendering.current) return;
        setFiles(blobs.map((b, i) => new File([b], `liste-${draft.no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' })));
      } catch (e) { console.warn(e); }
    }, 450);
    return () => clearTimeout(t);
  }, [req]);

  function save() {
    ls.set('guest-info', g);
    const t = now();
    const doc = { type: 'quote', status: 'new', items, note: '', pickup: '', no: draft.no, createdAt: t, updatedAt: t + 1, unreadAdmin: 1, unreadUser: 0, lastMsg: 'Vitrin listesi', lastFrom: 'user',
      guest: true, uid: null, gname: g.name.trim().slice(0, 80), gphone: '', userName: g.name.trim() || 'Vitrin müşterisi', shop: 'Vitrin müşterisi', tl: true };
    const r = currentRate(); if (r) doc.rate = { usd: r.usd, src: r.src, at: r.at || t };
    return api().createRequest(doc, [{ from: 'system', text: `Vitrin listesi · ${items.length} kalem · ${fmtTotals(tot)}`, at: t }], draft.id);
  }

  async function send() {
    if (!items.length || busy) return;
    if (!S.shop.whatsapp) return toast('Dükkan WhatsApp numarası girilmemiş', 'bad');
    setBusy(true);
    const link = links.guestRequest(draft.id);
    const saving = save().then(() => true, (e) => { toast('Liste kaydedilemedi: ' + e.message, 'bad'); return false; });
    let fs = files;
    if (!fs) { // resimler daha hazır değilse şimdi hazırla
      try { const blobs = await renderListImages(req, { rate: currentRate(), tl: true }); fs = blobs.map((b, i) => new File([b], `liste-${draft.no}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' })); } catch { fs = []; }
    }
    let how = 'wa';
    if (fs.length && canShareFiles()) {
      try { await navigator.share({ files: fs, text: link }); how = 'share'; }
      catch (e) { if (e.name === 'AbortError') { setBusy(false); return; } how = 'wa'; }
    }
    if (how === 'wa') {
      // bilgisayar: resmi panoya kopyala, WhatsApp sohbetini sadece linkle aç
      let copied = false;
      if (fs.length === 1 && typeof ClipboardItem !== 'undefined') { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': fs[0] })]); copied = true; } catch {} }
      if (!copied) fs.forEach((f, i) => setTimeout(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); }, i * 300));
      window.open(waLink(S.shop.whatsapp, link), '_blank', 'noopener');
      how = copied ? 'copied' : 'downloaded';
    }
    await saving;
    const ids = ls.get('guest-reqs', []); ls.set('guest-reqs', [draft.id, ...ids.filter((x) => x !== draft.id)].slice(0, 30));
    setSent({ ...draft, how, link, files: fs, count: items.length, total: fmtTotals(tot) });
    clearCart();
    setDraft({ id: api().newRequestId?.() || 'r_' + Date.now(), no: newNo() });
    setBusy(false);
  }

  if (sent) return <Sent s={sent} onNew={() => { setSent(null); go('katalog'); }} />;

  if (!lines.length) {
    return (
      <div className="page narrow">
        <h1 className="page-t">Listem</h1>
        <Empty icon="cart" title="Listeniz boş">
          <p>Ürünleri listeye ekleyin, sonra tek tuşla WhatsApp’tan bize gönderin.</p>
          <button className="btn primary" onClick={() => go('katalog')}>Ürünlere git</button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div className="cart-head">
        <h1 className="page-t">Listem <span className="muted">· {lines.length} kalem</span></h1>
        <button className="link danger" onClick={clearCart}>Listeyi boşalt</button>
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
          <button className="btn wa big" disabled={busy || !S.shop.whatsapp} onClick={send}>
            <Icon n="wa" />
            <span><b>{busy ? 'Hazırlanıyor…' : 'WhatsApp’tan gönder'}</b><small>Liste resim olarak + link gider</small></span>
          </button>
          {!S.shop.whatsapp && <p className="err">Dükkan WhatsApp numarası henüz girilmemiş.</p>}
          <p className="fine">Liste fiyatlarıdır. Listenizi fiyatlandırıp aynı tabloyla WhatsApp’tan size döneriz.</p>
        </aside>
      </div>
    </div>
  );
}

function Sent({ s, onNew }) {
  const S = useStore((x) => x.settings);
  const urls = useMemo(() => (s.files || []).map((f) => ({ url: URL.createObjectURL(f), name: f.name })), [s]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u.url)), [urls]);
  return (
    <div className="page narrow sent-page">
      <div className="sent-card">
        <span className="sent-ic"><Icon n="check" s={30} /></span>
        <h1 className="page-t">Listeniz hazır · #{s.no}</h1>
        <p className="muted">{s.count} kalem · {s.total}</p>
        {s.how === 'share' && <p>WhatsApp’ta {S.shop.name} sohbetini seçip gönderin. Resim{urls.length > 1 ? 'ler' : ''} ve liste linki birlikte gider.</p>}
        {s.how === 'copied' && <p><b>Resim kopyalandı.</b> Açılan WhatsApp sohbetinde mesaj kutusuna <kbd>Ctrl</kbd>+<kbd>V</kbd> ile yapıştırıp linkle birlikte gönderin.</p>}
        {s.how === 'downloaded' && <p><b>{urls.length} resim indirildi.</b> Açılan WhatsApp sohbetine bu resimleri ekleyip linkle birlikte gönderin.</p>}
        <div className="export-bar center">
          <a className="btn wa" href={waLink(S.shop.whatsapp, s.link)} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp’ı tekrar aç</a>
          <a className="btn outline" href={s.link} target="_blank" rel="noopener"><Icon n="ext" s={16} />Listeyi aç</a>
          <button className="btn ghost" onClick={onNew}><Icon n="plus" s={16} />Yeni liste</button>
        </div>
      </div>
      {urls.length > 0 && (
        <div className="img-prev">
          <div className="img-prev-h"><b>Gönderilen resim{urls.length > 1 ? `ler (${urls.length})` : ''}</b><span className="fine">Dokunup kaydedebilirsiniz</span></div>
          {urls.map((m) => <a key={m.url} href={m.url} download={m.name}><img src={m.url} alt={m.name} /></a>)}
        </div>
      )}
    </div>
  );
}
