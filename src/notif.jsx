// Yönetim paneli > Bildirim merkezi (üst menüdeki zil): yeni sipariş, müşteri iptali, bayi talebi / mesajı,
// bayi başvurusu, yeni mağaza üyesi ve PlatinMarket eşitlemesinde değişen ürünler (meta/feed) tek listede.
// Okundu bilgisi cihazda (ls 'notif-seen' = son açılış zamanı).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, store, go, openOrder, openRequest, toast, openProduct } from './store.js';
import { Icon, Toggle } from './ui.jsx';
import { pushState, enablePush, disablePush, linkMember } from './push.js';
import { fmt, fmtTotals, when, ls } from './utils.js';
import { TYPE, ORDER_STATUS, ORDER_OPEN } from './config.js';
import { preqNotifs } from './preq.jsx';
import { PushHelp } from './pushhelp.jsx';
import { issueNotifs } from './issue.jsx';
import { seenWait } from './extras.jsx';

const DAY = 864e5;
const KINDS = [['all', 'Tümü'], ['order', 'Siparişler'], ['req', 'Bayi'], ['prod', 'Ürünler'], ['user', 'Üyeler']];
const seenAt = () => ls.get('notif-seen', 0) || Date.now() - DAY;

function useNotifs() {
  const { orders, requests, customers, members, feed, preqs, issues = [], reviews = [], byId } = useStore();
  return useMemo(() => {
    const from = Date.now() - 30 * DAY; const out = [];
    for (const o of orders) {
      const sum = o.total ? fmtTotals(o.total) : '';
      if (o.createdAt > from) out.push({ id: 'o' + o.id, at: o.createdAt, g: 'order', ic: 'cart', tone: 'new', t: `Yeni sipariş #${o.no}`, s: `${o.contact?.name || ''}${sum ? ' · ' + sum : ''}`, go: () => openOrder(o.id) });
      const c = (o.history || []).find((h) => h.s === 'cancelled' && h.by === 'customer');
      if (c && c.at > from) out.push({ id: 'c' + o.id, at: c.at, g: 'order', ic: 'x', tone: 'bad', t: `Müşteri siparişi iptal etti #${o.no}`, s: `${o.contact?.name || ''}${sum ? ' · ' + sum : ''}`, go: () => openOrder(o.id) });
    }
    for (const r of requests) {
      const who = (r.userName || '') + (r.shop ? ` · ${r.shop}` : '');
      if (r.createdAt > from) out.push({ id: 'r' + r.id, at: r.createdAt, g: 'req', ic: 'chat', tone: 'info', t: `${r.type === 'order' ? 'Yeni bayi siparişi' : 'Yeni talep'} #${r.no || ''} · ${who}`, s: [TYPE[r.type], r.items?.length ? r.items.length + ' ürün' : '', r.note].filter(Boolean).join(' · '), go: () => openRequest(r.id) });
      if (r.lastFrom === 'user' && r.updatedAt > from && r.updatedAt - (r.createdAt || 0) > 5000) out.push({ id: 'm' + r.id + r.updatedAt, at: r.updatedAt, g: 'req', ic: 'chat', tone: 'info', t: `Mesaj · ${who}`, s: r.lastMsg || '', go: () => openRequest(r.id) });
    }
    for (const u of customers) if (u.pending && (u.createdAt || 0) > from) out.push({ id: 'u' + u.uid, at: u.createdAt, g: 'user', ic: 'users', tone: 'warn', t: `Bayi başvurusu · ${u.name || u.username || ''}`, s: [u.shop, u.phone].filter(Boolean).join(' · ') + ' · onay bekliyor', go: () => { ls.set('cust-kind', 'bayi'); go('musteriler'); } });
    for (const q of preqs || []) if ((q.createdAt || 0) > from) out.push({ id: 'pq' + q.id, at: q.createdAt, g: 'user', ic: 'camera', tone: 'info', t: `Ürün talebi #${q.no} · ${q.name || 'Üye'}`, s: q.text || `${(q.photos || []).length} fotoğraf`, go: () => { ls.set('cust-kind', 'talep'); go('musteriler'); store.set({ openPreq: q.id }); } });
    for (const q of issues) if ((q.createdAt || 0) > from) out.push({ id: 'is' + q.id, at: q.createdAt, g: 'user', ic: 'ask', tone: 'warn', t: `Sorun bildirimi #${q.no} · ${q.name || 'Üye'}`, s: [q.prod, q.text].filter(Boolean).join(' · '), go: () => { ls.set('cust-kind', 'sorun'); go('musteriler'); store.set({ openIssue: q.id }); } });
    for (const r of reviews) if ((r.createdAt || 0) > from) out.push({ id: 'rv' + r.id, at: r.createdAt, g: 'user', ic: 'star', tone: r.status === 'pending' ? 'warn' : 'muted', t: `Yeni yorum · ${'★'.repeat(r.stars || 0)} · ${r.name || ''}`, s: [byId?.get(r.pid)?.n, r.text].filter(Boolean).join(' · '), go: () => { ls.set('cust-kind', 'yorum'); go('musteriler'); } });
    for (const m of members) if ((m.createdAt || 0) > from) out.push({ id: 'mb' + m.uid, at: m.createdAt, g: 'user', ic: 'user', tone: 'muted', t: `Yeni mağaza üyesi · ${m.name || m.email || ''}`, s: m.email || '', go: () => { ls.set('cust-kind', 'magaza'); go('musteriler'); } });
    for (const [i, x] of (feed || []).entries()) {
      if (x.at <= from) continue;
      const P = { price: x.w != null ? ['tag', 'bad', `Fiyat değişti · elle toptanlı · ${x.k}`, `${x.n} · liste ${fmt(x.from)} → ${fmt(x.to)} · sizin toptan ${fmt(x.w)} korundu, kontrol edin`] : ['tag', 'warn', `Fiyat değişti · ${x.k}`, `${x.n} · ${fmt(x.from)} → ${fmt(x.to)}`], new: ['plus', 'ok', `Sitede yeni ürün · ${x.k}`, `${x.n}${x.to ? ' · ' + fmt(x.to) : ''}`], name: ['edit', 'info', `Ürün adı değişti · ${x.k}`, `${x.from} → ${x.n}`], hidden: ['eye', 'muted', `Sitede pasife alındı · ${x.k}`, `${x.n} · uygulamada da gizlendi`], deleted: ['trash', 'bad', `Siteden silindi · ${x.k}`, `${x.n} · uygulamadan da kaldırıldı`], shown: ['eye', 'ok', `Sitede yeniden satışta · ${x.k}`, x.n] }[x.t];
      if (P) out.push({ id: 'f' + i + x.at + x.id, at: x.at, g: 'prod', ic: P[0], tone: P[1], t: P[2], s: P[3], go: () => { go('katalog'); store.set({ catalogGo: x.k ? { code: x.k } : { q: x.n || String(x.id) } }); /* stok kodu kendi kutusuna (ad aramasına değil) */ } });
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 300);
  }, [orders, requests, customers, members, feed, preqs, issues, reviews, byId]);
}

// Gezinirken yeni bildirim gelince küçük açılır kart (29.10.2026): sadece sayfa açıldıktan SONRA gelenler;
// 6 sn sonra kendiliğinden kaybolur, basınca bildirimin gittiği yere gider. Zil paneli açıksa çıkmaz.
export function NotifPop({ list, onPick, off }) {
  const t0 = useRef(Date.now()); const known = useRef(null);
  const [cur, setCur] = useState(null); const tm = useRef(0);
  useEffect(() => {
    if (!known.current) { known.current = new Set(list.map((x) => x.id)); return; }
    const fresh = list.filter((x) => !known.current.has(x.id) && x.at > t0.current - 3000);
    list.forEach((x) => known.current.add(x.id));
    if (!fresh.length || off) return;
    const x = fresh.sort((a, b) => b.at - a.at)[0];
    setCur({ ...x, more: fresh.length - 1, k: Date.now() });
    clearTimeout(tm.current); tm.current = setTimeout(() => setCur(null), 6500);
  }, [list]);
  useEffect(() => () => clearTimeout(tm.current), []);
  if (!cur) return null;
  return createPortal(
    <div className={'npop tone-' + cur.tone} key={cur.k} role="status">
      <button type="button" className="npop-b" onClick={() => { setCur(null); onPick(cur); }}>
        <span className="nc-ic"><Icon n={cur.ic} s={17} /></span>
        <span className="npop-t"><b>{cur.t}</b>{cur.s && <small>{cur.s}</small>}{cur.more > 0 && <small className="npop-more">+{cur.more} bildirim daha</small>}</span>
      </button>
      <button type="button" className="npop-x" onClick={() => setCur(null)} aria-label="Kapat"><Icon n="x" s={15} /></button>
    </div>, document.body);
}

export function NotifBell() {
  const list = useNotifs();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(seenAt);
  const [kind, setKind] = useState('all');
  const box = useRef(null);
  const unread = list.filter((x) => x.at > seen).length;
  const close = () => { setOpen(false); const t = Date.now(); ls.set('notif-seen', t); setSeen(t); };
  useEffect(() => {
    if (!open) return;
    const out = (e) => { if (box.current && !box.current.contains(e.target)) close(); };
    const esc = (e) => e.key === 'Escape' && close();
    const t = setTimeout(() => { addEventListener('pointerdown', out); addEventListener('keydown', esc); });
    return () => { clearTimeout(t); removeEventListener('pointerdown', out); removeEventListener('keydown', esc); };
  }, [open]);
  const shown = kind === 'all' ? list : list.filter((x) => x.g === kind);
  const cnt = (g) => list.filter((x) => x.at > seen && (g === 'all' || x.g === g)).length;
  const pick = (x) => { close(); x.go(); };
  // gün başlıkları
  let lastDay = '';
  return (
    <span className="nc" ref={box}>
      <NotifPop list={list} off={open} onPick={pick} />
      <button className={'icon-btn nc-bell' + (open ? ' on' : '')} onClick={() => (open ? close() : setOpen(true))} aria-label={`Bildirimler${unread ? ` (${unread} yeni)` : ''}`} title="Bildirimler">
        <Icon n="bell" s={19} />{unread > 0 && <span key={unread} className="badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="nc-panel" role="dialog" aria-label="Bildirimler">
          <div className="nc-h">
            <b>Bildirimler</b>
            {unread > 0 && <button className="linkish" onClick={() => { const t = Date.now(); ls.set('notif-seen', t); setSeen(t); }}>Tümünü okundu say</button>}
            <button className="icon-btn sm" onClick={close} aria-label="Kapat"><Icon n="x" s={16} /></button>
          </div>
          <div className="nc-tabs">{KINDS.map(([k, l]) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}{cnt(k) > 0 && <i>{cnt(k)}</i>}</button>)}</div>
          <ul className="nc-list">
            {shown.length === 0 && <li className="nc-empty"><Icon n="bell" s={26} /><span>Son 30 günde bildirim yok</span></li>}
            {shown.map((x) => {
              const d = new Date(x.at).toDateString(); const head = d !== lastDay ? (lastDay = d, true) : false;
              const today = d === new Date().toDateString(); const yest = d === new Date(Date.now() - DAY).toDateString();
              return [
                head && <li key={'d' + d} className="nc-day">{today ? 'Bugün' : yest ? 'Dün' : new Date(x.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</li>,
                <li key={x.id}>
                  <button className={'nc-i tone-' + x.tone + (x.at > seen ? ' fresh' : '')} onClick={() => pick(x)}>
                    <span className="nc-ic"><Icon n={x.ic} s={16} /></span>
                    <span className="nc-b"><b>{x.t}</b>{x.s && <small>{x.s}</small>}</span>
                    <span className="nc-at">{new Date(x.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                </li>,
              ];
            })}
          </ul>
        </div>
      )}
    </span>
  );
}

// =========================================================================================================
// Mağaza müşterisi > Bildirim merkezi (27.10.2026): siparişlerinin durum geçmişinden (history) oluşur — sunucu yok.
// Üye: myOrders; misafir: bu cihazdan verdiği siparişler (guestOrders). Okundu bilgisi cihazda (ls 'cnotif-seen').
// Altta "Telefon bildirimleri" anahtarı (web push aç / kapat).
const ST_IC = { confirmed: ['check', 'ok'], preparing: ['box', 'info'], shipped: ['box', 'info'], ready: ['store', 'ok'], done: ['check', 'ok'], cancelled: ['x', 'bad'] };
const cSeenAt = () => ls.get('cnotif-seen', 0);
// Favori fiyat takibi (cihazda): ls 'fav-px' {id: son görülen liste fiyatı}; fiyat en az %1 DÜŞÜNCE ls 'fav-drops'a olay yazılır
// (zilde "Favorinizdeki ürünün fiyatı düştü"). Yükselişte sadece kayıtlı fiyat güncellenir, bildirim yok.
export function useFavWatch() {
  const { favs, byId, catalog } = useStore();
  useEffect(() => {
    if (!favs.length || !catalog.length) return;
    const px = ls.get('fav-px', {}); const drops = ls.get('fav-drops', []); let ch = false, nd = false;
    for (const id of favs) {
      const p = byId.get(id); if (!p || !(p.r > 0)) continue;
      const old = px[id];
      if (old == null) { px[id] = p.r; ch = true; }
      else if (p.r < old * 0.99) { drops.unshift({ id, n: p.n, from: old, to: p.r, cur: p.cur, at: Date.now() }); px[id] = p.r; ch = nd = true; }
      else if (p.r !== old) { px[id] = p.r; ch = true; }
    }
    for (const k of Object.keys(px)) if (!favs.includes(Number(k))) { delete px[k]; ch = true; }
    if (ch) ls.set('fav-px', px);
    if (nd) { ls.set('fav-drops', drops.filter((d) => Date.now() - d.at < 30 * DAY).slice(0, 50)); store.set({ favTick: Date.now() }); }
  }, [favs, catalog]);
}
export function useShopNotifs() {
  const { member, myOrders, guestOrders, favTick, myPreqs, myIssues = [] } = useStore();
  const orders = member ? myOrders : guestOrders;
  return useMemo(() => {
    const from = Date.now() - 90 * DAY; const out = [];
    for (const d of ls.get('fav-drops', [])) if (d.at > Date.now() - 30 * DAY) out.push({ id: 'fd' + d.id + d.at, at: d.at, ic: 'heart', tone: 'new', t: 'Favorinizdeki ürünün fiyatı düştü', s: `${d.n} · ${fmt(d.from, d.cur)} → ${fmt(d.to, d.cur)}`, go: () => { go('katalog'); store.set({ catalogGo: { fav: true } }); } });
    for (const o of orders || []) {
      const its = o.items || []; const sub = its.length ? `${its[0].n}${its.length > 1 ? ` +${its.length - 1} ürün` : ''}` : '';
      for (const h of o.history || []) {
        if (!h || h.s === 'new' || !(h.at > from) || !ORDER_STATUS[h.s]) continue;
        const [ic, tone] = ST_IC[h.s] || ['bell', 'info'];
        const ship = h.s === 'shipped' && o.cargo?.code ? ` · ${o.cargo.company || 'Kargo'} ${o.cargo.code}` : '';
        out.push({ id: o.id + h.s + h.at, at: h.at, ic, tone, t: `Sipariş #${o.no} · ${ORDER_STATUS[h.s].cust}${ship}`, s: sub, go: () => openOrder(o.id) });
      }
    }
    if (member) out.push(...preqNotifs(myPreqs).filter((x) => x.at > from));
    if (member) out.push(...issueNotifs(myIssues).filter((x) => x.at > from));
    if (member) for (const h of member.notifyHit || []) if (h && h.at > from) out.push({ id: 'nh' + h.id + h.at, at: h.at, ic: 'bell', tone: 'ok', t: 'Beklediğiniz ürün geldi', s: h.n || '', go: () => { openProduct(h.id); seenWait([h.id]); } });
    return out.sort((a, b) => b.at - a.at).slice(0, 100);
  }, [orders, favTick, myPreqs, myIssues, member]);
}
// telefon bildirimlerini aç / kapat (bekçi: kapatınca abonelik silinir, bildirim gitmez)
export function PushToggle({ orders }) {
  const S = useStore((s) => s.settings);
  const [st, setSt] = useState(() => pushState());
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  if (S.orders?.push === false || st === 'unsupported') return null;
  const ids = (() => { const a = (orders || []).filter((o) => ORDER_OPEN.includes(o.status)).map((o) => o.id); return a.length ? a : (orders || []).slice(0, 1).map((o) => o.id); })();
  const member = useStore((s) => s.member);
  const set = async (v) => {
    if (!v) { disablePush(); setSt('off'); toast('Telefon bildirimleri kapatıldı'); return; }
    if (!ids.length && !member) { toast('İlk siparişinizi verince bildirimleri açabilirsiniz'); return; }
    setBusy(true);
    try {
      if (ids.length) await enablePush(ids);
      if (member) await linkMember(await store.s.api?.idToken?.(), !ids.length); // üye: favori fiyat düşüşleri için cihaz hesaba bağlanır
      setSt('on'); toast('Telefon bildirimleri açıldı');
    } catch (e) { setSt(pushState()); toast(e.message, 'bad'); }
    setBusy(false);
  };
  const hint = st === 'ios-home' ? 'iPhone’da önce sayfayı ana ekrana ekleyin (Paylaş → Ana Ekrana Ekle), sonra oradan açın.'
    : st === 'denied' ? 'Bu cihazda bildirim izni kapalı; tarayıcı / telefon ayarlarından izin verin.'
    : 'Sipariş durumunu ve favorilerinizin fiyatı düşünce telefonunuza haber verelim.';
  return (
    <div className={'push-tg' + (busy ? ' busy' : '')}>
      {st === 'ios-home' || st === 'denied'
        ? <div className="push-tg-t"><b>Telefon bildirimleri</b><small>{hint}</small></div>
        : <Toggle id="push-tg" checked={st === 'on'} onChange={set} label="Telefon bildirimleri" hint={hint} />}
      {st !== 'on' && <button type="button" className={'push-help-b' + (st === 'ios-home' || st === 'denied' ? ' strong' : '')} onClick={() => setHelp(true)}><Icon n="ask" s={15} />Nasıl açılır? <small>Resimli anlatım</small></button>}
      {help && <PushHelp state={st} onClose={() => setHelp(false)} />}
    </div>
  );
}
export function ShopNotifList({ list, seen, onPick, empty = 'Henüz bildirim yok. Sipariş verdiğinizde durum güncellemeleri burada görünür.' }) {
  let lastDay = '';
  return (
    <ul className="nc-list">
      {list.length === 0 && <li className="nc-empty"><Icon n="bell" s={26} /><span>{empty}</span></li>}
      {list.map((x) => {
        const d = new Date(x.at).toDateString(); const head = d !== lastDay ? (lastDay = d, true) : false;
        const today = d === new Date().toDateString(); const yest = d === new Date(Date.now() - DAY).toDateString();
        return [
          head && <li key={'d' + d} className="nc-day">{today ? 'Bugün' : yest ? 'Dün' : new Date(x.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</li>,
          <li key={x.id}>
            <button className={'nc-i tone-' + x.tone + (x.at > seen ? ' fresh' : '')} onClick={() => onPick(x)}>
              <span className="nc-ic"><Icon n={x.ic} s={16} /></span>
              <span className="nc-b"><b>{x.t}</b>{x.s && <small>{x.s}</small>}</span>
              <span className="nc-at">{new Date(x.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          </li>,
        ];
      })}
    </ul>
  );
}
// üst menüdeki zil (mağaza): sadece üyeyse ya da bu cihazdan sipariş verildiyse görünür
export function ShopBell() {
  useFavWatch();
  const { member, myOrders, guestOrders } = useStore();
  const orders = member ? myOrders : guestOrders;
  const list = useShopNotifs();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(cSeenAt);
  const box = useRef(null);
  const unread = list.filter((x) => x.at > seen).length;
  const close = () => { setOpen(false); const t = Date.now(); ls.set('cnotif-seen', t); setSeen(t); };
  useEffect(() => {
    if (!open) return;
    const out = (e) => { if (box.current && !box.current.contains(e.target)) close(); };
    const esc = (e) => e.key === 'Escape' && close();
    const t = setTimeout(() => { addEventListener('pointerdown', out); addEventListener('keydown', esc); });
    return () => { clearTimeout(t); removeEventListener('pointerdown', out); removeEventListener('keydown', esc); };
  }, [open]);
  if (!member && !(guestOrders || []).length && !list.length) return null;
  return (
    <span className="nc shop-nc" ref={box}>
      <NotifPop list={list} off={open} onPick={(x) => { close(); x.go(); }} />
      <button className={'icon-btn nc-bell' + (open ? ' on' : '')} onClick={() => (open ? close() : setOpen(true))} aria-label={`Bildirimler${unread ? ` (${unread} yeni)` : ''}`} title="Bildirimler">
        <Icon n="bell" s={19} />{unread > 0 && <span key={unread} className="badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="nc-panel" role="dialog" aria-label="Bildirimler">
          <div className="nc-h">
            <b>Bildirimler</b>
            <button className="icon-btn sm" onClick={close} aria-label="Kapat"><Icon n="x" s={16} /></button>
          </div>
          <ShopNotifList list={list} seen={seen} onPick={(x) => { close(); x.go(); }} />
          {pushState() !== 'unsupported' && store.s.settings.orders?.push !== false && <div className="nc-foot"><PushToggle orders={orders} /></div>}
        </div>
      )}
    </span>
  );
}
