// Yönetim › Geçmiş siparişler (8.11.2026). Normal sayfalar son 14 günü gösterir; eski kayıtlar burada.
// Kural: sayfa açılınca HİÇBİR ŞEY okunmaz. 'Görüntüle'ye basınca seçili aralık (varsayılan son 1 ay) BİR KEZ okunur
// (canlı dinlenmez, 30 dk bellekte; 300'den fazla kayıtta önce onay). Tam yazılan sipariş no / ad / telefon / e-posta
// aralığa bakmadan bulunur (backend archiveFind, sadece eşleşen kadar okuma). Yetki: asıl yönetici + 'reports'.
import { useMemo, useState } from 'react';
import { useStore, store, go, openOrder, openLcart, openRequest, toast } from './store.js';
import { Icon, PageHead, StatusPill, Confirm } from './ui.jsx';
import { fmt } from './utils.js';
import { ORDER_STATUS, STATUS } from './config.js';
import { RangeSheet, rangeLabel, OrdersSwitch } from './orders.jsx';
import { can } from './team.js';
import { NoPerm } from './ekip.jsx';

const DAY = 864e5;
const TABS = [['orders', 'Mağaza siparişleri', 'box'], ['lcarts', 'Linkle gelenler', 'cart'], ['requests', 'Bayi siparişleri', 'chat']];
const MEM = { tab: 'orders', range: null, data: {}, found: {} }; // sayfadan çıkıp siparişe girince geri dönüşte kaybolmasın
const CACHE = new Map();
const usd = (o) => Object.entries(o.total || {}).reduce((s, [c, v]) => s + (c === 'USD' ? Number(v) || 0 : 0), 0);
const lastMonth = () => { const t0 = new Date(); t0.setHours(0, 0, 0, 0); return { from: t0.getTime() - 29 * DAY, to: t0.getTime() + DAY }; };
const when = (t) => new Date(t || 0).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date(t || 0).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export function Archive() {
  const A = useStore((s) => s.api);
  const [tab, setTabS] = useState(MEM.tab);
  const [range, setRangeS] = useState(MEM.range || lastMonth());
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [q, setQ] = useState('');
  const [conf, setConf] = useState(null);
  const setTab = (t) => { MEM.tab = t; setTabS(t); };
  const setRange = (r) => { MEM.range = r; setRangeS(r); };
  const key = tab + ':' + range.from + '-' + range.to;
  const data = MEM.data[key];
  const found = MEM.found[tab];
  const t = q.trim().toLocaleLowerCase('tr');
  const rows = useMemo(() => {
    const m = new Map();
    for (const x of found?.items || []) m.set(x.id, x);
    for (const x of data || []) m.set(x.id, x);
    let l = [...m.values()];
    if (t && data) l = l.filter((x) => (found?.items || []).some((f) => f.id === x.id) || [x.no, x.contact?.name, x.contact?.phone, x.contact?.email, x.name, x.sub?.contact?.name, x.sub?.contact?.phone, x.userName, x.shop].join(' ').toLocaleLowerCase('tr').includes(t));
    const k = tab === 'lcarts' ? 'at' : tab === 'requests' ? 'updatedAt' : 'createdAt';
    return l.sort((a, b) => (b[k] || b.createdAt || 0) - (a[k] || a.createdAt || 0));
  }, [data, found, t, tab]);
  if (!can('reports')) return <NoPerm perm="reports" />;

  const load = async (sure) => {
    const hit = CACHE.get(key);
    if (hit && Date.now() - hit.at < 30 * 60e3) { MEM.data[key] = hit.items; force((x) => x + 1); return; }
    setBusy(true);
    try {
      if (!sure && A.countRange) {
        let n = null; try { n = await A.countRange(tab, range.from, range.to); } catch {}
        if (n === 0) { MEM.data[key] = []; CACHE.set(key, { at: Date.now(), items: [] }); setBusy(false); force((x) => x + 1); return; }
        if (n != null && n > 300) { setBusy(false); setConf({ title: `${n.toLocaleString('tr-TR')} kayıt yüklenecek`, text: `${rangeLabel(range)} arasında ${n.toLocaleString('tr-TR')} kayıt var. Yüklemek yaklaşık ${n.toLocaleString('tr-TR')} okuma harcar (günlük ücretsiz sınır 50.000). Daha kısa bir aralık seçebilirsiniz.`, okLabel: 'Yine de yükle', onOk: () => load(true) }); return; }
      }
      const items = (await A.findRange(tab, range.from, range.to)) || [];
      CACHE.set(key, { at: Date.now(), items }); MEM.data[key] = items;
    } catch (e) { toast('Yüklenemedi: ' + e.message, 'bad'); }
    setBusy(false); force((x) => x + 1);
  };
  const search = async () => {
    const s = q.trim(); if (!s) return;
    setBusy(true);
    try { const items = A.archiveFind ? await A.archiveFind(tab, s) : []; MEM.found[tab] = { q: s, items }; if (!items.length && !data) toast('Bulunamadı · tam sipariş numarası, ad soyad ya da telefon yazın'); }
    catch (e) { toast('Aranamadı: ' + e.message, 'bad'); }
    setBusy(false); force((x) => x + 1);
  };
  const open = (x) => {
    if (tab === 'orders') openOrder(x.id);
    else if (tab === 'lcarts') { store.set({ lcExtra: [x, ...(store.s.lcExtra || []).filter((y) => y.id !== x.id)].slice(0, 50) }); go('sepetler'); openLcart(x.id); }
    else openRequest(x.id);
  };
  const pick = (from, to) => { setRangeOpen(false); setRange({ from, to }); };

  return (
    <div className="page orders-page adm-sub arc">
      <PageHead title="Siparişler" />
      <OrdersSwitch on="gecmis" />
      <div className="chips arc-kinds">{TABS.map(([k, l]) => <button key={k} type="button" className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="arc-bar">
        <button type="button" className="o-date on" onClick={() => setRangeOpen(true)}><Icon n="clock" s={17} /><span>{rangeLabel(range)}</span></button>
        <div className="search arc-q"><Icon n="search" s={18} /><input type="search" placeholder="Sipariş no, ad soyad, telefon (tam yazın)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} /></div>
        <button type="button" className="btn sm" disabled={busy || !q.trim()} onClick={search}><Icon n="search" s={15} />Bul</button>
      </div>
      {found && <p className="fine arc-found">“{found.q}”: {found.items.length ? found.items.length + ' sonuç' : 'bulunamadı'} · <button type="button" className="linkish" onClick={() => { delete MEM.found[tab]; force((x) => x + 1); }}>temizle</button></p>}
      {!data && (
        <div className="arc-gate">
          <span className="arc-gate-ic"><Icon n="clock" s={26} /></span>
          <h2>{rangeLabel(range)}</h2>
          <div className="arc-acts">
            <button type="button" className="btn ghost" onClick={() => setRangeOpen(true)}><Icon n="clock" s={16} />Tarihi değiştir</button>
            <button type="button" className="btn primary arc-go" disabled={busy} onClick={() => load(false)}>{busy ? <><span className="spin" aria-hidden="true" />Yükleniyor…</> : <><Icon n="eye" s={16} />Görüntüle</>}</button>
          </div>
        </div>
      )}
      {data && <p className="fine arc-info">{data.length} kayıt</p>}
      {(data || found?.items?.length) ? (rows.length ? (
        <ul className="arc-list">
          {rows.map((x) => {
            const st = tab === 'lcarts' ? (x.status === 'sent' ? 'confirmed' : x.status === 'open' ? 'new' : 'done') : x.status;
            const nm = tab === 'orders' ? x.contact?.name : tab === 'lcarts' ? (x.sub?.contact?.name || x.name) : (x.shop || x.userName);
            const tt = tab === 'orders' ? fmt(usd(x), 'USD') : tab === 'lcarts' ? (x.total?.USD != null ? fmt(x.total.USD, 'USD') : '') : (x.items || []).length + ' ürün';
            const at = tab === 'lcarts' ? x.at : x.createdAt;
            return (
              <li key={x.id}><button type="button" onClick={() => open(x)}>
                <span className="arc-no">#{x.no || String(x.id).slice(-5)}</span>
                <span className="arc-t"><b>{nm || '—'}</b><small>{when(at)}{tab === 'requests' ? ' · ' + (x.type === 'order' ? 'Bayi siparişi' : 'Talep') : ''}</small></span>
                <StatusPill status={st} map={tab === 'requests' ? STATUS : ORDER_STATUS} />
                <b className="arc-v">{tt}</b>
              </button></li>
            );
          })}
        </ul>
      ) : <p className="fine arc-none">Bu aralıkta eşleşen kayıt yok.</p>) : null}
      {rangeOpen && <RangeSheet unit="sipariş" cur={range} onPick={pick} onClose={() => setRangeOpen(false)} />}
      {conf && <Confirm {...conf} onClose={() => setConf(null)} />}
    </div>
  );
}
