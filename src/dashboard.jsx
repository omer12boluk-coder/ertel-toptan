// Yönetim paneli > Ana sayfa (Genel bakış): hoş geldiniz, dönem özeti (sipariş, ciro, ortalama sepet, yeni üye…),
// son 14 günün grafiği, çok satanlar, kısayollar ve son hareketler (mağaza siparişleri + bayi talepleri).
import { useEffect, useMemo, useState } from 'react';
import { can } from './team.js';
import { NoPerm } from './ekip.jsx';
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

// 8.11.2026: Ana sayfa HAFİF — sadece zaten yüklü olan bekleyen işler + akış (ek okuma yok). Ciro, grafik, çok satanlar
// Raporlar sayfasına taşındı (açılınca bir kez okur; sadece asıl yönetici / 'Raporlar ve geçmiş kayıtlar' yetkisi).
export function AdminHome() {
  const { user, orders = [], requests = [], customers = [], catalog } = useStore();
  const st = useMemo(() => ({
    open: orders.filter((o) => o.status === 'new').length,
    ship: orders.filter((o) => o.status === 'confirmed' || o.status === 'preparing').length,
    unread: requests.filter((r) => r.unreadAdmin > 0).length,
    reqOpen: requests.filter((r) => ['new', 'offered', 'accepted', 'ready'].includes(r.status)).length,
    pending: customers.filter((c) => c.pending).length,
    priceChanged: catalog.filter((p) => p.pc && p.w != null).length,
  }), [orders, requests, customers, catalog]);
  const feed = useMemo(() => [
    ...orders.slice(0, 12).map((o) => ({ t: o.createdAt || 0, kind: 'o', o })),
    ...requests.slice(0, 12).map((r) => ({ t: r.updatedAt || r.createdAt || 0, kind: 'r', r })),
  ].sort((a, b) => b.t - a.t).slice(0, 10), [orders, requests]);
  const h = new Date().getHours();
  const hello = h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  return (
    <div className="page dash">
      <section className="dash-hero">
        <div className="dash-hello">
          <span className="dash-date">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>{hello}, {(user.name || '').split(' ')[0] || 'hoş geldiniz'} 👋</h1>
          <p>{st.open > 0 ? <>Onay bekleyen <b>{st.open} sipariş</b> var.</> : 'Bekleyen yeni sipariş yok.'}{st.unread > 0 && <> Okunmamış <b>{st.unread} talep</b> var.</>}{st.pending > 0 && <> <b>{st.pending}</b> bayi başvurusu onay bekliyor.</>}</p>
        </div>
      </section>
      <AdminPush compact />

      <section className="dash-kpis">
        <Kpi ic="cart" tone="blue" label="Onay bekleyen" value={st.open} sub="mağaza siparişi" onClick={() => go('siparisler')} />
        <Kpi ic="box" tone="green" label="Hazırlanacak" value={st.ship} sub="onaylı / hazırlanıyor" onClick={() => go('siparisler')} />
        <Kpi ic="chat" tone="orange" label="Bayi talepleri" value={st.reqOpen} sub={st.unread ? `${st.unread} okunmamış` : 'açık'} onClick={() => go('talepler')} />
        <Kpi ic="users" tone="teal" label="Bayi başvurusu" value={st.pending} sub="onay bekliyor" onClick={() => go('musteriler')} />
      </section>

      <section className="dash-quick">
        {[
          can('heavy') && ['chart', 'Raporlar', () => go('raporlar')],
          ['tag', 'Form oluştur', () => go('siparis')],
          ['box', 'Siparişler', () => go('siparisler'), st.open],
          ['grid', 'Ürünler', () => go('katalog'), st.priceChanged],
          ['users', 'Müşteriler', () => go('musteriler'), st.pending],
          can('design') && ['brush', 'Mağaza tasarımı', () => go('tasarim')],
          ['gear', 'Ayarlar', () => go('ayarlar')],
          ['copy', 'Mağaza linki', () => copyText(links.shop(), 'Mağaza linki kopyalandı')],
        ].filter(Boolean).map(([ic, l, on, n]) => <button key={l} className="dash-q" onClick={on}><Icon n={ic} s={18} />{l}{n > 0 && <span className="badge">{n}</span>}</button>)}
        <a className="dash-q" href="/" target="_blank" rel="noopener"><Icon n="ext" s={18} />Mağazayı aç</a>
      </section>

      <Feed feed={feed} />
    </div>
  );
}

function Feed({ feed }) {
  return (
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
  );
}

// ---- Raporlar (8.11.2026): eski ana sayfadaki ciro / grafik / çok satanlar. Sadece bu sayfa açılınca BİR KEZ okunur
// (dönemdeki + kıyas dönemindeki siparişler; yeni üye ve bayi siparişi SAYI sorgusu = birkaç okuma). Aynı dönem 30 dk bellekte.
const REP_CACHE = new Map();
const prevOf = (per, from) => from - (per === 'today' ? DAY : per === 'week' ? 7 * DAY : 30 * DAY);
export function Reports() {
  const { byId, rate, api: A } = useStore();
  const [per, setPer] = useState(() => { try { return localStorage.getItem('dash-per') || 'today'; } catch { return 'today'; } });
  const setP = (p) => { setPer(p); try { localStorage.setItem('dash-per', p); } catch {} };
  const [data, setData] = useState(null); // {orders, members, reqs}
  const [err, setErr] = useState('');
  const from = startOf(per);
  const q0 = Math.min(prevOf(per, from), startOf('today') - 13 * DAY);
  useEffect(() => {
    if (!can('heavy')) return;
    const key = per + ':' + q0; const hit = REP_CACHE.get(key);
    if (hit && Date.now() - hit.at < 30 * 60e3) { setData(hit.d); return; }
    setData(null); setErr('');
    const now = Date.now() + 60e3;
    Promise.all([
      A.findRange('orders', q0, now),
      A.countRange ? A.countRange('members', from, now).catch(() => null) : null,
      A.countRange ? A.countRange('requests', from, now).catch(() => null) : null,
    ]).then(([orders, members, reqs]) => { const d = { orders: orders || [], members, reqs }; REP_CACHE.set(key, { at: Date.now(), d }); setData(d); }, (e) => setErr(e.message));
  }, [per, q0]);
  const live = (o) => o.status !== 'cancelled';
  const orders = data?.orders || [];
  const st = useMemo(() => {
    const po = orders.filter((o) => (o.createdAt || 0) >= from);
    const sold = po.filter(live);
    const rev = sold.reduce((s, o) => s + usd(o), 0);
    const pf = prevOf(per, from);
    const prevRev = orders.filter((o) => live(o) && o.createdAt >= pf && o.createdAt < from).reduce((s, o) => s + usd(o), 0);
    const top = new Map();
    for (const o of sold) for (const it of o.items || []) { const k = it.id ?? it.k; const x = top.get(k) || { id: it.id, n: it.n, k: it.k, qty: 0, sum: 0 }; x.qty += Number(it.qty) || 0; x.sum += (Number(it.price) || 0) * (Number(it.qty) || 0); top.set(k, x); }
    return { count: po.length, sold: sold.length, rev, avg: sold.length ? rev / sold.length : 0, prevRev, top: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5) };
  }, [orders, from, per]);
  const days = useMemo(() => {
    const t0 = startOf('today') - 13 * DAY;
    const arr = Array.from({ length: 14 }, (_, i) => ({ t: t0 + i * DAY, v: 0, n: 0 }));
    for (const o of orders) { if (!live(o) || (o.createdAt || 0) < t0) continue; const i = Math.floor((o.createdAt - t0) / DAY); if (arr[i]) { arr[i].v += usd(o); arr[i].n++; } }
    return arr;
  }, [orders]);
  if (!can('heavy')) return <NoPerm perm="heavy" />;
  const max = Math.max(1, ...days.map((d) => d.v));
  const tl = (v) => (rate?.usd ? '≈ ' + Math.round(v * rate.usd).toLocaleString('tr-TR') + ' ₺' : '');
  const diff = st.prevRev > 0 ? Math.round(((st.rev - st.prevRev) / st.prevRev) * 100) : null;
  const perName = PERIODS.find((x) => x[0] === per)[1].toLocaleLowerCase('tr');
  const wait = !data && !err;
  const v = (x) => (wait ? '…' : x);
  return (
    <div className="page dash">
      <section className="dash-hero">
        <div className="dash-hello">
          <span className="dash-date">Raporlar</span>
          <h1>Satış özeti</h1>
          <p>{err ? 'Yüklenemedi: ' + err : wait ? 'Yükleniyor… (bu sayfa sadece açılınca okunur)' : `${perName} · ${orders.length} sipariş okundu`}</p>
        </div>
        <div className="seg dash-seg" role="group" aria-label="Dönem">{PERIODS.map(([k, l]) => <button key={k} className={per === k ? 'on' : ''} onClick={() => setP(k)}>{l}</button>)}</div>
      </section>

      <section className="dash-kpis">
        <Kpi ic="cart" tone="blue" label="Mağaza siparişi" value={v(st.count)} sub={st.count !== st.sold ? `${st.count - st.sold} iptal` : perName} />
        <Kpi ic="tag" tone="green" label="Satış tutarı" value={v(fmt(st.rev, 'USD'))} sub={<>{tl(st.rev)}{diff != null && <span className={'dash-diff ' + (diff >= 0 ? 'up' : 'down')}>{diff >= 0 ? '▲' : '▼'} %{Math.abs(diff)}</span>}</>} />
        <Kpi ic="box" tone="violet" label="Ortalama sepet" value={v(fmt(st.avg, 'USD'))} sub={tl(st.avg)} />
        <Kpi ic="users" tone="teal" label="Yeni üye" value={v(data?.members ?? '—')} sub={perName} />
        <Kpi ic="chat" tone="orange" label="Bayi siparişi / talep" value={v(data?.reqs ?? '—')} sub={perName} />
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
          {st.top.length === 0 ? <p className="fine dash-empty">{wait ? 'Yükleniyor…' : 'Bu dönemde satış yok.'}</p> : (
            <ol className="dash-top">
              {st.top.map((x, i) => { const p = byId.get(x.id); return (
                <li key={i}><span className="dash-rank">{i + 1}</span>{p ? <Thumb p={p} size="sm" /> : <span className="thumb sm" />}<span className="dash-top-n"><b>{x.n}</b><small>{x.k}</small></span><span className="dash-top-v"><b>{x.qty} adet</b><small>{fmt(x.sum, 'USD')}</small></span></li>
              ); })}
            </ol>
          )}
        </section>
      </div>
      <p className="fine">Bu sayfa açılınca seçili dönemin ve bir önceki dönemin siparişleri bir kez okunur (her sipariş 1 okuma); aynı döneme yarım saat içinde tekrar bakmak bedava. Ana sayfa artık hiç ek okuma yapmaz.</p>
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
