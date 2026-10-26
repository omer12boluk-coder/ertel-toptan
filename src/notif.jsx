// Yönetim paneli > Bildirim merkezi (üst menüdeki zil): yeni sipariş, müşteri iptali, bayi talebi / mesajı,
// bayi başvurusu, yeni mağaza üyesi ve PlatinMarket eşitlemesinde değişen ürünler (meta/feed) tek listede.
// Okundu bilgisi cihazda (ls 'notif-seen' = son açılış zamanı).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, go, openOrder, openRequest } from './store.js';
import { Icon } from './ui.jsx';
import { fmt, fmtTotals, when, ls } from './utils.js';
import { TYPE } from './config.js';

const DAY = 864e5;
const KINDS = [['all', 'Tümü'], ['order', 'Siparişler'], ['req', 'Talepler'], ['prod', 'Ürünler'], ['user', 'Üyeler']];
const seenAt = () => ls.get('notif-seen', 0) || Date.now() - DAY;

function useNotifs() {
  const { orders, requests, customers, members, feed } = useStore();
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
      if (r.createdAt > from) out.push({ id: 'r' + r.id, at: r.createdAt, g: 'req', ic: 'chat', tone: 'info', t: `Yeni talep #${r.no || ''} · ${who}`, s: [TYPE[r.type], r.items?.length ? r.items.length + ' ürün' : '', r.note].filter(Boolean).join(' · '), go: () => openRequest(r.id) });
      if (r.lastFrom === 'user' && r.updatedAt > from && r.updatedAt - (r.createdAt || 0) > 5000) out.push({ id: 'm' + r.id + r.updatedAt, at: r.updatedAt, g: 'req', ic: 'chat', tone: 'info', t: `Mesaj · ${who}`, s: r.lastMsg || '', go: () => openRequest(r.id) });
    }
    for (const u of customers) if (u.pending && (u.createdAt || 0) > from) out.push({ id: 'u' + u.uid, at: u.createdAt, g: 'user', ic: 'users', tone: 'warn', t: `Bayi başvurusu · ${u.name || u.username || ''}`, s: [u.shop, u.phone].filter(Boolean).join(' · ') + ' · onay bekliyor', go: () => { ls.set('cust-kind', 'bayi'); go('musteriler'); } });
    for (const m of members) if ((m.createdAt || 0) > from) out.push({ id: 'mb' + m.uid, at: m.createdAt, g: 'user', ic: 'user', tone: 'muted', t: `Yeni mağaza üyesi · ${m.name || m.email || ''}`, s: m.email || '', go: () => { ls.set('cust-kind', 'magaza'); go('musteriler'); } });
    for (const [i, x] of (feed || []).entries()) {
      if (x.at <= from) continue;
      const P = { price: x.w != null ? ['tag', 'bad', `Fiyat değişti · elle toptanlı · ${x.k}`, `${x.n} · liste ${fmt(x.from)} → ${fmt(x.to)} · sizin toptan ${fmt(x.w)} korundu, kontrol edin`] : ['tag', 'warn', `Fiyat değişti · ${x.k}`, `${x.n} · ${fmt(x.from)} → ${fmt(x.to)}`], new: ['plus', 'ok', `Sitede yeni ürün · ${x.k}`, `${x.n}${x.to ? ' · ' + fmt(x.to) : ''}`], name: ['edit', 'info', `Ürün adı değişti · ${x.k}`, `${x.from} → ${x.n}`], hidden: ['eye', 'muted', `Sitede pasife alındı · ${x.k}`, `${x.n} · uygulamada da gizlendi`], deleted: ['trash', 'bad', `Siteden silindi · ${x.k}`, `${x.n} · uygulamadan da kaldırıldı`], shown: ['eye', 'ok', `Sitede yeniden satışta · ${x.k}`, x.n] }[x.t];
      if (P) out.push({ id: 'f' + i + x.at + x.id, at: x.at, g: 'prod', ic: P[0], tone: P[1], t: P[2], s: P[3], go: () => { go('katalog'); store.set({ catalogGo: { q: x.k || String(x.id) } }); } });
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 300);
  }, [orders, requests, customers, members, feed]);
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
