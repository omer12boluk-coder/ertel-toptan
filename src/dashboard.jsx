// Yönetim paneli > Ana sayfa (Genel bakış): hoş geldiniz, dönem özeti (sipariş, ciro, ortalama sepet, yeni üye…),
// son 14 günün grafiği, çok satanlar, kısayollar ve son hareketler (mağaza siparişleri + bayi talepleri).
import { useMemo, useState } from 'react';
import { useStore, go, openOrder, openRequest, store } from './store.js';
import { Icon, Thumb, StatusPill, copyText } from './ui.jsx';
import { fmt } from './utils.js';
import { AdminPush } from './admin.jsx';
import { ORDER_STATUS } from './config.js';
import { links } from './route.js';

const DAY = 864e5;
const startOf = (p) => { const d = new Date(); d.setHours(0, 0, 0, 0); if (p === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); if (p === 'month') d.setDate(1); return d.getTime(); };
const PERIODS = [['today', 'Bugün'], ['week', 'Bu hafta'], ['month', 'Bu ay']];
const usd = (o) => Object.entries(o.total || {}).reduce((s, [c, v]) => s + (c === 'USD' ? Number(v) || 0 : 0), 0);
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); if (m < 1) return 'şimdi'; if (m < 60) return m + ' dk önce'; const h = Math.round(m / 60); if (h < 24) return h + ' sa önce'; const d = Math.round(h / 24); return d === 1 ? 'dün' : d + ' gün önce'; };

export function AdminHome() {
  const { user, orders = [], requests = [], members = [], customers = [], catalog, byId, rate, settings: S } = useStore();
  const [per, setPer] = useState(() => { try { return localStorage.getItem('dash-per') || 'today'; } catch { return 'today'; } });
  const setP = (p) => { setPer(p); try { localStorage.setItem('dash-per', p); } catch {} };
  const from = startOf(per);
  const live = (o) => o.status !== 'cancelled';
  const st = useMemo(() => {
    const po = orders.filter((o) => (o.createdAt || 0) >= from);
    const sold = po.filter(live);
    const rev = sold.reduce((s, o) => s + usd(o), 0);
    const prevFrom = from - (per === 'today' ? DAY : per === 'week' ? 7 * DAY : (from - startOf('month') || 30 * DAY));
    const prevRev = orders.filter((o) => live(o) && o.createdAt >= prevFrom && o.createdAt < from).reduce((s, o) => s + usd(o), 0);
    const top = new Map();
    for (const o of sold) for (const it of o.items || []) { const k = it.id ?? it.k; const x = top.get(k) || { id: it.id, n: it.n, k: it.k, qty: 0, sum: 0 }; x.qty += Number(it.qty) || 0; x.sum += (Number(it.price) || 0) * (Number(it.qty) || 0); top.set(k, x); }
    return {
      count: po.length, sold: sold.length, rev, avg: sold.length ? rev / sold.length : 0, prevRev,
      open: orders.filter((o) => o.status === 'new').length,
      ship: orders.filter((o) => o.status === 'confirmed' || o.status === 'preparing').length,
      newMembers: members.filter((m) => (m.createdAt || 0) >= from).length,
      reqs: requests.filter((r) => (r.createdAt || 0) >= from).length,
      unread: requests.filter((r) => r.unreadAdmin > 0).length,
      pending: customers.filter((c) => c.pending).length,
      priceChanged: catalog.filter((p) => p.pc).length,
      top: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    };
  }, [orders, requests, members, customers, catalog, from, per]);
  // son 14 gün: günlük ciro
  const days = useMemo(() => {
    const t0 = startOf('today') - 13 * DAY;
    const arr = Array.from({ length: 14 }, (_, i) => ({ t: t0 + i * DAY, v: 0, n: 0 }));
    for (const o of orders) { if (!live(o) || (o.createdAt || 0) < t0) continue; const i = Math.floor((o.createdAt - t0) / DAY); if (arr[i]) { arr[i].v += usd(o); arr[i].n++; } }
    return arr;
  }, [orders]);
  const max = Math.max(1, ...days.map((d) => d.v));
  const feed = useMemo(() => [
    ...orders.slice(0, 12).map((o) => ({ t: o.createdAt || 0, kind: 'o', o })),
    ...requests.slice(0, 12).map((r) => ({ t: r.updatedAt || r.createdAt || 0, kind: 'r', r })),
  ].sort((a, b) => b.t - a.t).slice(0, 10), [orders, requests]);

  const h = new Date().getHours();
  const hello = h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  const tl = (v) => (rate?.usd ? '≈ ' + Math.round(v * rate.usd).toLocaleString('tr-TR') + ' ₺' : '');
  const diff = st.prevRev > 0 ? Math.round(((st.rev - st.prevRev) / st.prevRev) * 100) : null;
  const perName = PERIODS.find((x) => x[0] === per)[1].toLocaleLowerCase('tr');

  return (
    <div className="page dash">
      <section className="dash-hero">
        <div className="dash-hello">
          <span className="dash-date">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>{hello}, {(user.name || '').split(' ')[0] || 'hoş geldiniz'} 👋</h1>
          <p>{st.open > 0 ? <>Onay bekleyen <b>{st.open} sipariş</b> var.</> : 'Bekleyen yeni sipariş yok.'}{st.unread > 0 && <> Okunmamış <b>{st.unread} talep</b> var.</>}{st.pending > 0 && <> <b>{st.pending}</b> bayi başvurusu onay bekliyor.</>}</p>
        </div>
        <div className="seg dash-seg" role="group" aria-label="Dönem">{PERIODS.map(([k, l]) => <button key={k} className={per === k ? 'on' : ''} onClick={() => setP(k)}>{l}</button>)}</div>
      </section>
      <AdminPush compact />

      <section className="dash-kpis">
        <Kpi ic="cart" tone="blue" label="Mağaza siparişi" value={st.count} sub={st.count !== st.sold ? `${st.count - st.sold} iptal` : perName} onClick={() => go('siparisler')} />
        <Kpi ic="tag" tone="green" label="Satış tutarı" value={fmt(st.rev, 'USD')} sub={<>{tl(st.rev)}{diff != null && <span className={'dash-diff ' + (diff >= 0 ? 'up' : 'down')}>{diff >= 0 ? '▲' : '▼'} %{Math.abs(diff)}</span>}</>} />
        <Kpi ic="box" tone="violet" label="Ortalama sepet" value={fmt(st.avg, 'USD')} sub={tl(st.avg)} />
        <Kpi ic="users" tone="teal" label="Yeni üye" value={st.newMembers} sub={perName} onClick={() => go('siparisler')} />
        <Kpi ic="chat" tone="orange" label="Bayi siparişi" value={st.reqs} sub={st.unread ? `${st.unread} okunmamış` : perName} onClick={() => go('talepler')} />
      </section>

      <section className="dash-quick">
        {[
          ['tag', 'Sipariş formu', () => go('siparis')],
          ['box', 'Siparişler', () => go('siparisler'), st.open],
          ['grid', 'Ürünler', () => go('katalog'), st.priceChanged],
          ['users', 'Müşteriler', () => go('musteriler'), st.pending],
          ['brush', 'Mağaza tasarımı', () => go('tasarim')],
          ['gear', 'Ayarlar', () => go('ayarlar')],
          ['copy', 'Mağaza linki', () => copyText(links.shop(), 'Mağaza linki kopyalandı')],
        ].map(([ic, l, on, n]) => <button key={l} className="dash-q" onClick={on}><Icon n={ic} s={18} />{l}{n > 0 && <span className="badge">{n}</span>}</button>)}
        <a className="dash-q" href="/magaza" target="_blank" rel="noopener"><Icon n="ext" s={18} />Mağazayı aç</a>
      </section>

      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-h"><h2>Son 14 gün</h2><span className="muted">günlük satış (iptaller hariç)</span></div>
          <div className="dash-chart" role="img" aria-label="Son 14 günün günlük satışı">
            {days.map((d, i) => (
              <div key={i} className={'dash-bar' + (i === 13 ? ' today' : '')} title={`${new Date(d.t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}: ${fmt(d.v, 'USD')} · ${d.n} sipariş`}>
                <span style={{ height: Math.max(d.v ? 6 : 2, (d.v / max) * 100) + '%' }} />
                <small>{new Date(d.t).getDate()}</small>
              </div>
            ))}
          </div>
          <div className="dash-chart-f"><span>Toplam <b>{fmt(days.reduce((s, d) => s + d.v, 0), 'USD')}</b></span><span>{days.reduce((s, d) => s + d.n, 0)} sipariş</span></div>
        </section>

        <section className="dash-card">
          <div className="dash-card-h"><h2>Çok satanlar</h2><span className="muted">{perName}</span></div>
          {st.top.length === 0 ? <p className="fine dash-empty">Bu dönemde satış yok.</p> : (
            <ol className="dash-top">
              {st.top.map((x, i) => { const p = byId.get(x.id); return (
                <li key={i}><span className="dash-rank">{i + 1}</span>{p ? <Thumb p={p} size="sm" /> : <span className="thumb sm" />}<span className="dash-top-n"><b>{x.n}</b><small>{x.k}</small></span><span className="dash-top-v"><b>{x.qty} adet</b><small>{fmt(x.sum, 'USD')}</small></span></li>
              ); })}
            </ol>
          )}
        </section>
      </div>

      <section className="dash-card">
        <div className="dash-card-h"><h2>Akış</h2><span className="muted">son siparişler ve talepler</span></div>
        {feed.length === 0 ? <p className="fine dash-empty">Henüz hareket yok.</p> : (
          <ul className="dash-feed">
            {feed.map((f) => f.kind === 'o' ? (
              <li key={'o' + f.o.id}><button onClick={() => openOrder(f.o.id)}>
                <span className="dash-fi blue"><Icon n="cart" s={18} /></span>
                <span className="dash-ft"><b>Sipariş #{f.o.no} · {f.o.contact?.name || 'Müşteri'}</b><small>{(f.o.items || []).length} ürün · {ago(f.t)}{f.o.delivery?.addr?.city ? ' · ' + f.o.delivery.addr.city : ''}</small></span>
                <StatusPill status={f.o.status} map={ORDER_STATUS} />
                <b className="dash-fv">{fmt(usd(f.o), 'USD')}</b>
              </button></li>
            ) : (
              <li key={'r' + f.r.id}><button onClick={() => openRequest(f.r.id)}>
                <span className="dash-fi orange"><Icon n="chat" s={18} /></span>
                <span className="dash-ft"><b>{f.r.type === 'order' ? 'Bayi siparişi' : 'Talep'} #{f.r.no} · {f.r.shop || f.r.userName || ''}</b><small>{f.r.lastMsg ? f.r.lastMsg.slice(0, 70) : (f.r.items || []).length + ' ürün'} · {ago(f.t)}</small></span>
                {f.r.unreadAdmin > 0 && <span className="badge">{f.r.unreadAdmin}</span>}
              </button></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ ic, tone, label, value, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={'dash-kpi t-' + tone} onClick={onClick}>
      <span className="dash-kpi-ic"><Icon n={ic} s={20} /></span>
      <span className="dash-kpi-t"><small>{label}</small><b className="num">{value}</b>{sub && <em>{sub}</em>}</span>
    </Tag>
  );
}
