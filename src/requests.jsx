import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, api, store, openRequest, toast, go } from './store.js';
import { Icon, Avatar, StatusPill, Empty, Sheet, Stepper, Confirm, openMenu, copyText } from './ui.jsx';
import { waLink, links } from './route.js';
import { ls } from './utils.js';
import { fmt, totals, fmtTotals, when, now, roundStep } from './utils.js';
import { STATUS, TYPE, OPEN_STATUSES } from './config.js';
import { CustomerSheet } from './admin.jsx';
import { GuestLists, AdminListShare, useRate, toTL, fmtTL, rateLabel } from './listsheet.jsx';

// Talepleri (mesajlarıyla) kalıcı olarak sil
export async function deleteRequests(ids, done) {
  try {
    await api().deleteRequests(ids);
    if (ids.includes(store.s.openReq)) store.set({ openReq: null });
    toast(ids.length > 1 ? `${ids.length} talep silindi` : 'Talep silindi'); done?.();
  } catch (e) { toast('Silinemedi: ' + e.message, 'bad'); }
}

const FILTERS_ADMIN = [
  ['open', 'Açık'], ['new', 'Yeni'], ['offered', 'Teklifte'], ['accepted', 'Hazırlanacak'], ['ready', 'Hazır'], ['closed', 'Kapanan'], ['all', 'Hepsi'],
];
const FILTERS_USER = [['open', 'Açık'], ['closed', 'Geçmiş'], ['all', 'Hepsi']];

export function Requests() {
  const pub = useStore((s) => s.user.role === 'public');
  return pub ? <GuestLists /> : <RequestsInner />;
}

function RequestsInner() {
  const { requests, user, openReq, settings: S } = useStore();
  const admin = user.role === 'admin';
  const pub = false;
  const [f, setF] = useState('open');
  const [q, setQ] = useState('');
  const [newMsg, setNewMsg] = useState(false);
  const [sel, setSel] = useState(null); // çoklu seçim: null = kapalı, Set = seçili talepler
  const [confirm, setConfirm] = useState(null);
  const askDelete = (ids) => setConfirm({ title: ids.length > 1 ? `${ids.length} talebi sil` : 'Talebi sil', text: 'Talep ve tüm mesajları kalıcı olarak silinir. Geri alınamaz.', okLabel: 'Sil', tone: 'danger', onOk: () => deleteRequests(ids, () => setSel(null)) });
  const toggle = (id) => setSel((s0) => { const s = new Set(s0 || []); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const list = useMemo(() => requests.filter((r) => {
    if (f === 'open' && !OPEN_STATUSES.includes(r.status)) return false;
    if (f === 'closed' && OPEN_STATUSES.includes(r.status)) return false;
    if (!['open', 'closed', 'all'].includes(f) && r.status !== f) return false;
    if (q) { const s = (r.userName + ' ' + r.shop + ' ' + r.no + ' ' + (r.items || []).map((i) => i.n).join(' ')).toLocaleLowerCase('tr'); if (!s.includes(q.toLocaleLowerCase('tr'))) return false; }
    return true;
  }), [requests, f, q]);
  const counts = useMemo(() => {
    const c = { open: 0, closed: 0, all: requests.length };
    for (const r of requests) { c[r.status] = (c[r.status] || 0) + 1; OPEN_STATUSES.includes(r.status) ? c.open++ : c.closed++; }
    return c;
  }, [requests]);

  return (
    <div className={'page req-page' + (openReq ? ' has-detail' : '')}>
      <section className="req-list">
        <div className="req-list-h">
          <h1 className="page-t">{admin ? 'Gelen talepler' : 'Taleplerim'}</h1>
          {!admin && !pub && S.requests.allowMessage && <button className="btn sm outline" onClick={() => setNewMsg(true)}><Icon n="chat" s={16} />Mesaj yaz</button>}
          {admin && <div className="req-h-btns">
            <button className="btn sm ghost" onClick={() => store.set({ vitrinOpen: true })} title="Müşterinin WhatsApp’tan gönderdiği vitrin linkini açıp fiyatlayın"><Icon n="store" s={15} />Vitrin listesi</button>
            <button className={'btn sm ' + (sel ? 'primary' : 'outline')} onClick={() => setSel(sel ? null : new Set())}><Icon n="check" s={15} />{sel ? 'Seçimi kapat' : 'Seç'}</button>
          </div>}
        </div>
        {admin && sel && (
          <div className="sel-bar">
            <label className="mini-check"><input type="checkbox" checked={list.length > 0 && list.every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(list.map((r) => r.id)) : new Set())} />Tümü</label>
            <span className="muted">{sel.size} seçili</span>
            <button className="btn sm danger" disabled={!sel.size} onClick={() => askDelete([...sel])}><Icon n="trash" s={15} />Sil</button>
          </div>
        )}
        {admin && (
          <div className="search sm"><Icon n="search" s={16} /><input id="req-search" type="search" placeholder="Müşteri, dükkan, ürün…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        )}
        <div className="chips scroll">
          {(admin ? FILTERS_ADMIN : FILTERS_USER).map(([k, l]) => (
            <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}{counts[k] ? <b>{counts[k]}</b> : null}</button>
          ))}
        </div>
        {list.length === 0 ? (
          <Empty icon="chat" title={f === 'open' ? 'Açık talep yok' : 'Bu filtrede talep yok'}>
            {!admin && <p>Sepetinizi gönderdiğinizde ya da mesaj yazdığınızda burada görünür.</p>}
          </Empty>
        ) : (
          <ul className="rlist">
            {list.map((r) => <ReqCard key={r.id} r={r} admin={admin} on={openReq === r.id} sel={sel} onToggle={toggle} onDelete={(id) => askDelete([id])} onSelect={(id) => setSel(new Set([id]))} />)}
          </ul>
        )}
      </section>
      <section className="req-detail">
        {openReq ? <RequestDetail key={openReq} id={openReq} /> : <div className="req-placeholder"><Empty icon="chat" title="Bir talep seçin">Soldaki listeden bir talebe dokunun.</Empty></div>}
      </section>
      {newMsg && <NewMessage onClose={() => setNewMsg(false)} />}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function ReqCard({ r, admin, on, sel, onToggle, onDelete, onSelect }) {
  const unread = admin ? r.unreadAdmin : r.unreadUser;
  const n = (r.items || []).length;
  const phone = r.guest ? r.gphone : store.s.customers.find((c) => c.uid === r.uid)?.phone;
  const menu = (e) => openMenu(e, admin ? [
    { label: 'Talebi aç', icon: 'chat', onClick: () => openRequest(r.id) },
    unread ? { label: 'Okundu işaretle', icon: 'check', onClick: () => api().updateRequest(r.id, { unreadAdmin: 0 }) } : { label: 'Okunmadı işaretle', icon: 'eye', onClick: () => api().updateRequest(r.id, { unreadAdmin: 1 }) },
    r.status === 'accepted' && { label: 'Hazır olarak işaretle', icon: 'store', onClick: () => quickStatus(r, 'ready', 'Hazır, dükkandan teslim alabilirsiniz') },
    r.status === 'ready' && { label: 'Teslim edildi', icon: 'check', onClick: () => quickStatus(r, 'done') },
    '-',
    phone && { label: "WhatsApp'tan yaz", icon: 'wa', onClick: () => window.open(waLink(phone, `Merhaba ${r.userName || ''}, #${r.no} numaralı talebiniz: ${r.guest ? links.guestRequest(r.id) : links.userRequest(r.id)}`), '_blank', 'noopener') },
    { label: 'Talep linkini kopyala', icon: 'copy', onClick: () => copyText(links.adminRequest(r.id)) },
    '-',
    { label: 'Seç (çoklu silme)', icon: 'check', onClick: () => onSelect?.(r.id) },
    { label: 'Talebi sil', icon: 'trash', danger: true, onClick: () => onDelete?.(r.id) },
  ] : [
    { label: 'Talebi aç', icon: 'chat', onClick: () => openRequest(r.id) },
    { label: 'Talep linkini kopyala', icon: 'copy', onClick: () => copyText(r.guest ? links.guestRequest(r.id) : links.userRequest(r.id)) },
  ], `#${r.no} · ${r.userName || ''}`);
  return (
    <li>
      <button className={'rcard' + (on ? ' on' : '') + (unread ? ' unread' : '') + (sel?.has(r.id) ? ' picked' : '')} onClick={() => (sel ? onToggle(r.id) : openRequest(r.id))} onContextMenu={menu}>
        {sel && <span className={'pick' + (sel.has(r.id) ? ' on' : '')} aria-hidden="true">{sel.has(r.id) && <Icon n="check" s={14} />}</span>}
        {admin && <Avatar u={{ name: r.userName, photo: store.s.customers.find((c) => c.uid === r.uid)?.photo }} size={38} />}
        <div className="rcard-b">
          <div className="rcard-top">
            <strong>{admin ? r.userName : TYPE[r.type]}{admin && r.guest && <span className="tag guest-tag">Vitrin</span>}</strong>
            <span className="muted num">{when(r.updatedAt)}</span>
          </div>
          <div className="rcard-mid">
            <StatusPill status={r.status} />
            <span className="muted">#{r.no}{n ? ` · ${n} kalem · ` : ''}{n ? <b className="num">{fmtTotals(totals(r.items, 'offer'))}</b> : null}</span>
          </div>
          <p className="rcard-last">{r.lastFrom === 'admin' && !admin ? 'Siz: ' : ''}{r.lastFrom === 'admin' && admin ? 'Siz: ' : ''}{r.lastMsg}</p>
        </div>
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
    </li>
  );
}

export function NewMessage({ onClose }) {
  const { user } = useStore();
  const [t, setT] = useState('');
  const send = async () => {
    if (!t.trim()) return;
    const at = now();
    const id = await api().createRequest({
      uid: user.uid, userName: user.name || user.username, shop: user.shop || '', type: 'message', status: 'new', items: [], note: t.trim(), pickup: '',
      createdAt: at, updatedAt: at, unreadAdmin: 1, unreadUser: 0, lastMsg: t.trim(), lastFrom: 'user',
    }, [{ from: 'user', text: t.trim(), at }]);
    onClose(); openRequest(id);
  };
  return (
    <Sheet title="Yeni mesaj" sub="Sepetsiz soru, stok sorgusu vb." onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Vazgeç</button><button className="btn primary" onClick={send} disabled={!t.trim()}><Icon n="send" s={16} />Gönder</button></>}>
      <textarea id="newmsg" rows="5" autoFocus placeholder="ör. JCID V1SE ne zaman gelir?" value={t} onChange={(e) => setT(e.target.value)} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
export function RequestDetail({ id }) {
  const { requests, user, settings: S, customers, byId } = useStore();
  const admin = user.role === 'admin';
  const listR = requests.find((x) => x.id === id);
  const [single, setSingle] = useState(null);
  useEffect(() => { if (!listR && api().watchRequest) return api().watchRequest(id, setSingle); }, [id, !!listR]);
  const r = listR || single;
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState(null);
  const [text, setText] = useState('');
  const [cust, setCust] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [share, setShare] = useState(false);
  const rate = useRate();
  const endRef = useRef(null);

  useEffect(() => api().watchMessages(id, setMsgs), [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  useEffect(() => {
    if (!r) return;
    if (admin && r.unreadAdmin) api().updateRequest(id, { unreadAdmin: 0 });
    if (!admin && r.unreadUser) api().updateRequest(id, { unreadUser: 0 });
  }, [r?.unreadAdmin, r?.unreadUser, msgs.length]);
  const itemsKey = JSON.stringify(r?.items || []);
  useEffect(() => { setDraft(r ? structuredClone(r.items || []) : null); }, [itemsKey]);

  if (!r) return <div className="req-placeholder"><Empty title="Talep bulunamadı" /></div>;
  const c = customers.find((x) => x.uid === r.uid);
  const editable = admin && ['new', 'offered', 'accepted'].includes(r.status);
  const items = editable && draft ? draft : r.items || [];
  const dirty = editable && JSON.stringify(draft) !== itemsKey;
  const closed = !OPEN_STATUSES.includes(r.status);
  const step = Number(S.pricing.adjustStep) || 1;

  const upd = (i, patch) => setDraft((d) => d.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  function diffText(next) {
    const prev = new Map((r.items || []).map((x) => [x.id, x]));
    const out = [];
    for (const it of next) {
      const o = prev.get(it.id); const nm = it.n.length > 34 ? it.n.slice(0, 32) + '…' : it.n;
      if (!o) continue;
      if (o.offer !== it.offer) out.push(`${nm}: ${fmt(o.offer, it.cur)} → ${fmt(it.offer, it.cur)}`);
      if (o.qty !== it.qty) out.push(`${nm}: adet ${o.qty} → ${it.qty}`);
      prev.delete(it.id);
    }
    for (const o of prev.values()) out.push(`${o.n.slice(0, 32)}: çıkarıldı`);
    return out;
  }

  async function setStatus(status, extra = {}, note) {
    const at = now();
    const label = STATUS[status].label;
    await api().sendMessage(id, { from: 'system', text: note || `Durum: ${label}`, at }, { status, ...extra }, admin ? 'user' : 'admin');
  }
  async function sendOffer() {
    const changes = diffText(draft);
    await setStatus('offered', { items: draft }, 'Teklif gönderildi' + (changes.length ? ' · ' + changes.join(' · ') : '') + ` · Toplam ${fmtTotals(totals(draft, 'offer'))}`);
    toast('Teklif müşteriye gönderildi');
  }
  async function approve() {
    const changes = diffText(draft);
    await setStatus('accepted', { items: draft }, 'Onaylandı, hazırlanıyor' + (changes.length ? ' · ' + changes.join(' · ') : '') + ` · Toplam ${fmtTotals(totals(draft, 'offer'))}`);
    toast('Onaylandı');
  }
  // Vitrin listesi: fiyatları kaydet (gerekirse) ve tablo resmini / linkini hazırla
  async function prepareList() {
    if (dirty || r.status === 'new') {
      const changes = diffText(draft);
      await setStatus(r.status === 'new' ? 'offered' : r.status, { items: draft }, 'Fiyatlandırıldı' + (changes.length ? ' · ' + changes.join(' · ') : '') + ` · Toplam ${fmtTotals(totals(draft, 'offer'))}`);
    }
    setShare(true);
  }
  async function finish(status) {
    await setStatus(status);
    if (r.uid && status === 'done') await api().bumpStat(r.uid, 'done', 1);
    if (r.uid && status === 'noshow') await api().bumpStat(r.uid, 'noshow', 1);
  }
  async function send(t = text) {
    const msg = t.trim(); if (!msg) return;
    setText('');
    await api().sendMessage(id, { from: admin ? 'admin' : 'user', text: msg, at: now() });
  }

  // WhatsApp: yönetici müşteriye teklif linki yollar; müşteri dükkana talep linki yollar
  const custPhone = r.guest ? r.gphone : c?.phone;
  const offerLine = items.length ? `Toplam: ${fmtTotals(totals(items, 'offer'))}` : '';
  const waTo = admin
    ? (custPhone ? waLink(custPhone, `Merhaba ${r.guest ? r.gname : r.userName}, #${r.no} numaralı talebiniz için ${STATUS[r.status]?.label === 'Teklif geldi' ? 'teklifimiz hazır' : 'güncelleme var'}. ${offerLine}\nGörmek ve onaylamak için: ${r.guest ? links.guestRequest(r.id) : links.userRequest(r.id)}`) : null)
    : (S.shop.whatsapp ? waLink(S.shop.whatsapp, `Merhaba, #${r.no} numaralı talebim hakkında yazıyorum. ${offerLine}\nTalep: ${links.adminRequest(r.id)}`) : null);
  const tAsked = totals(items, 'asked');
  const tOffer = totals(items, 'offer');
  const tList = totals(items, 'list');
  const quick = admin ? S.requests.adminQuick : S.requests.userQuick;

  return (
    <div className="rd">
      <header className="rd-h">
        <button className="icon-btn only-m" onClick={() => store.set({ openReq: null })} aria-label="Geri"><Icon n="back" /></button>
        <div className="rd-title">
          <h2>{TYPE[r.type]} <span className="muted">#{r.no}</span></h2>
          <span className="muted">{when(r.createdAt)}{r.pickup ? ' · Gelme: ' + r.pickup : ''}</span>
        </div>
        <StatusPill status={r.status} />
      </header>

      {admin && r.guest && (
        <div className="cust-strip">
          <Avatar u={{ name: r.gname }} size={42} />
          <span className="cust-strip-b">
            <strong>{r.gname} <span className="tag guest-tag">Vitrin müşterisi</span></strong>
            <span className="muted">{r.gphone} · giriş yapmadan sepet gönderdi</span>
          </span>
        </div>
      )}
      {admin && !r.guest && (
        <button className="cust-strip" onClick={() => c && setCust(c)}>
          <Avatar u={{ ...c, name: r.userName }} size={42} />
          <span className="cust-strip-b">
            <strong>{r.userName}</strong>
            <span className="muted">{r.shop}{c?.phone ? ' · ' + c.phone : ''}</span>
          </span>
          <span className="cust-stats">
            <span title="Teslim aldığı"><b>{c?.stats?.done || 0}</b> alım</span>
            <span className={(c?.stats?.noshow || 0) >= S.requests.noShowWarn ? 'warn' : ''} title="Hazırlatıp gelmediği"><b>{c?.stats?.noshow || 0}</b> gelmedi</span>
          </span>
        </button>
      )}

      {!admin && r.status === 'ready' && (
        <div className="banner ok"><Icon n="store" /><div><b>Siparişiniz hazır.</b> {S.shop.name} · {S.shop.address} · {S.shop.hours}</div></div>
      )}
      {!admin && r.guest && ['accepted', 'ready', 'done'].includes(r.status) && S.shop.payInfo && (
        <div className="banner ok pay-info"><Icon n="tag" /><div><b>Ödeme bilgileri</b><pre>{S.shop.payInfo}</pre><span className="fine">Açıklamaya talep numarasını yazın: #{r.no}</span></div></div>
      )}
      {!admin && r.status === 'offered' && (
        <div className="banner warn"><Icon n="tag" /><div><b>Size teklif geldi.</b> Fiyatları kontrol edip onaylayın; onaydan sonra hazırlanır.</div></div>
      )}

      {items.length > 0 && (
        <div className="rd-items">
          <table className="itable">
            <thead>
              <tr><th>Ürün</th><th className="r">Adet</th>{S.pricing.showRetail && <th className="r hide-s">Liste</th>}<th className="r">{admin ? 'İstenen' : 'Sepet'}</th><th className="r">Teklif</th><th className="r">Tutar</th>{editable && <th />}</tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const changed = it.offer !== it.asked;
                const p = byId.get(it.id);
                return (
                  <tr key={it.id} className={changed ? 'changed' : ''}>
                    <td className="it-name"><span>{it.n}</span><code>{it.k}</code>{admin && p && <small className="muted"> · stok {p.s}</small>}</td>
                    <td className="r it-qty" data-l="Adet">{editable ? <Stepper small min={1} value={it.qty} onChange={(v) => upd(i, { qty: v })} /> : <span className="num">{it.qty}</span>}</td>
                    {S.pricing.showRetail && <td className="r num muted hide-s it-list">{fmt(it.list, it.cur)}</td>}
                    <td className="r num muted it-asked" data-l={admin ? 'İstenen' : 'Sepet'}>{fmt(it.asked, it.cur)}</td>
                    <td className="r it-offer" data-l="Teklif">
                      {editable ? (
                        <div className="adj">
                          <button onClick={() => upd(i, { offer: roundStep((it.offer || 0) - step, 0.01) })} aria-label={`Fiyatı ${step} düşür`} title={`−${step}`}>−</button>
                          <input inputMode="decimal" value={it.offer ?? ''} aria-label="Teklif fiyatı"
                            onChange={(e) => { const v = e.target.value.replace(',', '.'); upd(i, { offer: v === '' ? null : isNaN(Number(v)) ? it.offer : v.endsWith('.') ? v : Number(v) }); }}
                            onBlur={() => upd(i, { offer: it.offer == null ? null : Number(it.offer) })} />
                          <button onClick={() => upd(i, { offer: roundStep((Number(it.offer) || 0) + step, 0.01) })} aria-label={`Fiyatı ${step} arttır`} title={`+${step}`}>+</button>
                        </div>
                      ) : <b className={'num' + (changed ? ' hl' : '')}>{fmt(it.offer, it.cur)}</b>}
                    </td>
                    <td className="r num it-sum" data-l="Tutar"><b>{it.offer == null ? '—' : fmt(Number(it.offer) * it.qty, it.cur)}</b></td>
                    {editable && <td className="it-del"><button className="icon-btn sm" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} aria-label="Kalemi çıkar"><Icon n="trash" s={15} /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="rd-totals">
            {S.pricing.showRetail && <span className="muted">Liste <span className="num">{fmtTotals(tList)}</span></span>}
            <span className="muted">{admin ? 'İstenen' : 'Sepet'} <span className="num">{fmtTotals(tAsked)}</span></span>
            <span className="rd-total">Teklif <b className="num">{fmtTotals(tOffer)}</b></span>
            {admin && rate && toTL(tOffer, rate) != null && <span className="muted rd-tl" title={rateLabel(rate)}>≈ <b className="num">{fmtTL(toTL(tOffer, rate))}</b></span>}
          </div>
        </div>
      )}

      <div className="rd-actions">
        {admin && r.guest && items.length > 0 && <button className="btn primary" onClick={prepareList}><Icon n="send" s={16} />{dirty || r.status === 'new' ? 'Fiyatları kaydet, resmi hazırla' : 'Tablo resmi / link'}</button>}
        {admin && editable && !r.guest && (
          <>
            <button className="btn outline" onClick={sendOffer}><Icon n="send" s={16} />Teklif gönder<small className="hide-s">müşteri onaylasın</small></button>
            <button className="btn primary" onClick={approve}><Icon n="check" s={16} />{r.status === 'accepted' && !dirty ? 'Onaylı' : 'Onayla, hazırlıyorum'}</button>
            {r.status === 'accepted' && !dirty && <button className="btn primary" onClick={() => setStatus('ready', {}, 'Hazır, dükkandan teslim alabilirsiniz')}><Icon n="store" s={16} />Hazır</button>}
            <button className="btn ghost danger" onClick={() => setConfirm({ title: 'Talebi reddet', text: 'Müşteriye “Reddedildi” olarak bildirilecek.', okLabel: 'Reddet', tone: 'danger', onOk: () => setStatus('rejected') })}>Reddet</button>
          </>
        )}
        {admin && r.status === 'ready' && (
          <>
            <button className="btn primary" onClick={() => finish('done')}><Icon n="check" s={16} />Teslim edildi</button>
            <button className="btn ghost danger" onClick={() => setConfirm({ title: 'Gelmedi olarak işaretle', text: 'Müşterinin profiline “gelmedi” sayısı eklenir.', okLabel: 'Gelmedi', tone: 'danger', onOk: () => finish('noshow') })}>Gelmedi</button>
          </>
        )}
        {admin && closed && <button className="btn ghost" onClick={() => setStatus('new', {}, 'Talep yeniden açıldı')}>Yeniden aç</button>}
        {admin && <button className="btn ghost danger" onClick={() => setConfirm({ title: 'Talebi sil', text: 'Talep ve tüm mesajları kalıcı olarak silinir. Geri alınamaz.', okLabel: 'Sil', tone: 'danger', onOk: () => deleteRequests([r.id]) })}><Icon n="trash" s={15} />Sil</button>}
        {!admin && r.status === 'offered' && (
          <>
            <button className="btn primary" onClick={() => setStatus('accepted', {}, 'Müşteri teklifi kabul etti')}><Icon n="check" s={16} />Teklifi kabul et</button>
            <button className="btn ghost danger" onClick={() => setStatus('rejected', {}, 'Müşteri teklifi reddetti')}>Reddet</button>
          </>
        )}
        {!admin && ['new', 'offered'].includes(r.status) && <button className="btn ghost" onClick={() => setConfirm({ title: 'Talebi iptal et', text: 'Bu talep kapatılacak.', okLabel: 'İptal et', tone: 'danger', onOk: () => setStatus('cancelled', {}, 'Müşteri talebi iptal etti') })}>İptal et</button>}
        {waTo && <a className="btn wa" href={waTo} target="_blank" rel="noopener"><Icon n="wa" s={16} />{admin ? 'WhatsApp’tan gönder' : 'WhatsApp’tan haber ver'}</a>}
        {dirty && <span className="dirty-note">Değişiklikler kaydedilmedi — teklif gönderin veya onaylayın.</span>}
      </div>

      <div className="chat" aria-live="polite">
        {msgs.map((m) => (
          m.from === 'system'
            ? <div key={m.id} className="msg sys"><span>{m.text}</span><time>{when(m.at)}</time></div>
            : <div key={m.id} className={'msg ' + (m.from === (admin ? 'admin' : 'user') ? 'me' : 'them')}><p>{m.text}</p><time>{when(m.at)}</time></div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {quick?.length > 0 && <div className="chips scroll quick">{quick.map((t) => <button key={t} className="chip" onClick={() => send(t)}>{t}</button>)}</div>}
        <div className="composer-row">
          <textarea id={'msg-' + id} rows="1" placeholder="Mesaj yazın…" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn primary icon" onClick={() => send()} disabled={!text.trim()} aria-label="Gönder"><Icon n="send" s={18} /></button>
        </div>
      </div>
      {share && <Sheet wide title={`Liste #${r.no}`} sub="Müşteriye resim ya da link olarak gönderin" onClose={() => setShare(false)}><AdminListShare r={r} items={items} /></Sheet>}
      {cust && <CustomerSheet c={cust} onClose={() => setCust(null)} />}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// Sağ tık menüsünden hızlı durum değişikliği
async function quickStatus(r, status, note) {
  await api().sendMessage(r.id, { from: 'system', text: note || 'Durum: ' + STATUS[status].label, at: now() }, { status }, 'user');
  if (r.uid && status === 'done') await api().bumpStat(r.uid, 'done', 1);
  toast(STATUS[status].label);
}
