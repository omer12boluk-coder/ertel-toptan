// Ürün yorumları (29.10.2026). Sadece o ürünü SATIN ALMIŞ üye, teslim edilen siparişinin sayfasından yazar (kayıt kimliği = <sipariş>_<ürün>; kural siparişin
// üyeye ait ve teslim edilmiş/yolda olduğunu kontrol eder). Ayarlar > Mağaza özellikleri > "onaylayınca yayınlansın" açıksa
// yorum 'pending' gelir, yönetici Müşteriler > Yorumlar'dan yayınlar. Ürün penceresi önce revsum/main'e bakar (oturumda 1 okuma),
// yorumu olan üründe yayındaki yorumları okur. Kayıt: reviews/{id} { pid, oid, order, uid, name, stars, text, status, reply?,
// createdAt, updatedAt, seenAdmin, sum } · revsum/main { s: { <ürün>: [ortalama, adet] } } (yönetici yazar).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, api, go, toast, openOrder } from './store.js';
import { Icon, Sheet, Confirm, Empty, openMenu, Thumb } from './ui.jsx';
import { now, norm, ls } from './utils.js';
import { feat } from './extras.jsx';
import { OlderBtn } from './orders.jsx';

const BOUGHT = ['ready', 'shipped', 'done'];
export const shortName = (n) => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return 'Müşteri'; return w.length === 1 ? w[0] : w[0] + ' ' + w[w.length - 1][0].toLocaleUpperCase('tr-TR') + '.'; };
const dRel = (t) => { const d = Math.floor((Date.now() - t) / 864e5); return d < 1 ? 'bugün' : d < 2 ? 'dün' : d < 7 ? d + ' gün önce' : d < 30 ? Math.floor(d / 7) + ' hafta önce' : new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); };
const fmtAvg = (v) => Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function Stars({ v, s = 14 }) {
  const full = Math.round(v * 2) / 2;
  return <span className="stars" style={{ '--s': s + 'px' }} aria-label={`5 üzerinden ${fmtAvg(v)} yıldız`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={full >= i ? 'on' : full >= i - 0.5 ? 'half' : ''}>★</i>)}</span>;
}

// yorum özeti (oturumda bir kez)
let sumP = null;
export function useRevSum(on) {
  const s = useStore((st) => st.revSum);
  useEffect(() => { if (!on || s || sumP) return; const A = api(); if (!A?.getRevSum) return; sumP = A.getRevSum().then((d) => store.set({ revSum: d || {} })).catch(() => store.set({ revSum: {} })); }, [on]);
  return s;
}
// üyenin yazdığı yorumlar (oturumda bir kez; yeni yazınca listeye eklenir)
let myP = null;
function useMyReviews(member) {
  const mine = useStore((st) => st.myReviews);
  useEffect(() => { if (!member || mine || myP) return; myP = store.s.api.myReviews(member.uid).then((l) => store.set({ myReviews: l })).catch(() => store.set({ myReviews: [] })); }, [member?.uid]);
  return mine;
}

// Ürün penceresi: başlık altındaki yıldız satırı
export function RatingLine({ p }) {
  const S = useStore((s) => s.settings);
  const on = feat(S).rev;
  const sum = useRevSum(on);
  const r = sum?.[p.id];
  if (!on || !r || !r[1]) return null;
  return <button type="button" className="rate-line" onClick={() => document.getElementById('rev-' + p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Stars v={r[0]} /><b>{fmtAvg(r[0])}</b><span>{r[1]} yorum</span></button>;
}

// Ürün penceresinin altında: SADECE yayındaki yorumlar (yorum yazma siparişin içinden — 29.10.2026, kullanıcı isteği).
// Yayında yorum yoksa bölüm hiç çizilmez.
export function Reviews({ p }) {
  const { settings: S } = useStore();
  const F = feat(S);
  const sum = useRevSum(F.rev);
  const [list, setList] = useState(null);
  const n = sum?.[p.id]?.[1] || 0;
  useEffect(() => { if (!F.rev || !n) { setList([]); return; } let live = true; store.s.api.reviewsOf(p.id).then((l) => live && setList(l)).catch(() => live && setList([])); return () => { live = false; }; }, [p.id, n, F.rev]);
  if (!F.rev || !n) return null;
  const items = list || [];
  const bars = [5, 4, 3, 2, 1].map((s) => ({ s, c: items.filter((r) => r.stars === s).length }));
  return (
    <section className="rev" id={'rev-' + p.id}>
      <div className="rev-h"><b>Yorumlar</b></div>
      <div className="rev-sum">
        <div className="rev-big"><b>{fmtAvg(sum[p.id][0])}</b><Stars v={sum[p.id][0]} s={13} /><small>{n} yorum</small></div>
        <div className="rev-bars">{bars.map((b) => <div key={b.s}><span>{b.s}</span><i><em style={{ width: items.length ? Math.round((b.c / items.length) * 100) + '%' : 0 }} /></i></div>)}</div>
      </div>
      {list == null && <div className="spinner sm" />}
      {items.map((r) => (
        <article key={r.id} className="rev-item">
          <div className="rev-ih"><b>{r.name}</b><span className="rev-buy"><Icon n="check" s={11} />Satın aldı</span><small>{dRel(r.createdAt)}</small></div>
          <Stars v={r.stars} s={13} />
          {r.text && <p>{r.text}</p>}
          {r.reply && <div className="rev-reply"><b>{S.brand?.appName || 'Mağaza'}:</b> {r.reply}</div>}
        </article>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Siparişten değerlendirme: teslim edilen siparişin sayfasının altında "Ürünleri değerlendirin" kartı.
const uniqItems = (o) => { const seen = new Set(); return (o.items || []).filter((i) => i.id && !seen.has(i.id) && seen.add(i.id)); };
const doneAt = (o) => { const h = [...(o.history || [])].reverse().find((x) => x.s === 'done'); return h?.at || o.updatedAt || o.createdAt || 0; };
export const canRate = (o, mine) => o?.status === 'done' && uniqItems(o).some((i) => !(mine || []).some((r) => r.id === o.id + '_' + i.id));
export function useRateable() {
  const { settings: S, member } = useStore();
  const on = feat(S).rev && !!member;
  const mine = useMyReviews(on && member);
  return on && mine ? (o) => canRate(o, mine) : () => false;
}

export function OrderRate({ o }) {
  const { settings: S, member, byId } = useStore();
  const rateFocus = useStore((s) => s.rateFocus);
  const on = feat(S).rev && member && o.uid === member.uid && o.status === 'done';
  const mine = useMyReviews(on && member);
  const [w, setW] = useState(null);
  const ref = useRef(null);
  useEffect(() => { if (on && mine && rateFocus === o.id) { store.set({ rateFocus: null }); setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350); } }, [on, !!mine, rateFocus]);
  if (!on || !mine) return null;
  const its = uniqItems(o);
  if (!its.length) return null;
  const rev = (i) => mine.find((r) => r.id === o.id + '_' + i.id);
  const left = its.filter((i) => !rev(i)).length;
  return (
    <section className="o-rate" id="o-rate" ref={ref}>
      <div className="o-rate-h">
        <span className="o-rate-ic"><Icon n="star" s={18} /></span>
        <span><b>{left ? 'Ürünleri değerlendirin' : 'Değerlendirmeniz için teşekkürler'}</b><small className="muted">{left ? 'Yıldıza dokunun; puanınız diğer ustalara yol gösterir.' : 'Yorumlarınız ürün sayfalarında görünür.'}</small></span>
      </div>
      <ul className="o-rate-l">
        {its.map((i) => { const p = byId.get(i.id) || { ...i, id: i.id }; const r = rev(i); return (
          <li key={i.id}>
            <Thumb p={p} size="sm" />
            <span className="o-rate-n">{p.n || i.n}{r && <small className="muted">{r.status === 'pub' ? 'Yayında' : r.status === 'hidden' ? 'Yayınlanmadı' : 'İnceleniyor'}{r.text ? ' · “' + r.text.slice(0, 40) + (r.text.length > 40 ? '…' : '') + '”' : ''}</small>}</span>
            {r ? <span className="o-rate-done"><Stars v={r.stars} s={14} /></span> : (
              <span className="o-rate-s" role="group" aria-label={'Puan ver: ' + (p.n || '')}>
                {[1, 2, 3, 4, 5].map((k) => <button key={k} type="button" aria-label={k + ' yıldız'} onClick={() => setW({ p, stars: k })}>★</button>)}
              </span>
            )}
          </li>
        ); })}
      </ul>
      {w && <WriteReview p={w.p} order={o} initial={w.stars} onClose={() => setW(null)} />}
    </section>
  );
}

// Tek seferlik, nazik hatırlatma: teslim edilen (son 30 gün) ve değerlendirilmemiş ürünü olan sipariş için mağazaya bir
// sonraki girişte küçük kart. Her sipariş için EN ÇOK BİR KEZ, iki hatırlatma arası en az 4 gün; sipariş sayfası /
// sepet / ödeme açıkken gösterilmez. Kayıt cihazda (ls rate-ask {sipariş: zaman}, rate-ask-at son gösterim).
const ASK_GAP = 4 * 864e5, ASK_WIN = 30 * 864e5;
export function RatePrompt() {
  const { settings: S, member, myOrders = [], tab, openOrder: oo, byId } = useStore();
  const on = feat(S).rev && !!member;
  const mine = useMyReviews(on && member);
  const [o, setO] = useState(null);
  useEffect(() => {
    if (!on || !mine || o) return;
    const asked = ls.get('rate-ask', {}); const last = ls.get('rate-ask-at', 0);
    if (Date.now() - last < ASK_GAP) return;
    const hidden = new Set(member.hiddenOrders || []);
    const c = myOrders.filter((x) => !hidden.has(x.id) && !asked[x.id] && canRate(x, mine) && Date.now() - doneAt(x) < ASK_WIN).sort((a, b) => doneAt(b) - doneAt(a))[0];
    if (!c) return;
    const t = setTimeout(() => {
      const s = store.s; if (s.openOrder || ['sepet', 'siparis'].includes(s.tab)) return;
      // eskiler (bu özellikten önce teslim edilenler) bir daha sorulmasın diye hepsi işaretlenir
      const a2 = { ...asked }; for (const x of myOrders) if (x.status === 'done') a2[x.id] = Date.now();
      ls.set('rate-ask', a2); ls.set('rate-ask-at', Date.now()); setO(c);
    }, 2500);
    return () => clearTimeout(t);
  }, [on, !!mine, myOrders.length, tab, oo]);
  if (!o) return null;
  const its = uniqItems(o).filter((i) => !(mine || []).some((r) => r.id === o.id + '_' + i.id));
  const close = () => setO(null);
  return (
    <div className="rate-ask" role="dialog" aria-label="Ürünleri değerlendirin">
      <button className="rate-ask-x" aria-label="Kapat" onClick={close}><Icon n="x" s={16} /></button>
      <div className="rate-ask-th">{its.slice(0, 3).map((i) => <Thumb key={i.id} p={byId.get(i.id) || i} size="sm" />)}</div>
      <div className="rate-ask-t"><b>Siparişiniz teslim edildi</b><span>#{o.no} · Aldığınız {its.length > 1 ? its.length + ' ürünü' : 'ürünü'} değerlendirmek ister misiniz?</span></div>
      <div className="rate-ask-b">
        <button className="btn ghost sm" onClick={close}>Daha sonra</button>
        <button className="btn primary sm" onClick={() => { close(); store.set({ rateFocus: o.id }); openOrder(o.id); }}><Icon n="star" s={15} />Değerlendir</button>
      </div>
    </div>
  );
}

function WriteReview({ p, order, onClose, initial = 5 }) {
  const { member, settings: S } = useStore();
  const [stars, setStars] = useState(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const mod = feat(S).revMod;
  const send = async () => {
    if (text.trim().length > 0 && text.trim().length < 5) return toast('Yorumu biraz daha açık yazın', 'warn');
    setBusy(true);
    try {
      const t = now(); const id = order.id + '_' + p.id;
      const doc = { pid: p.id, oid: order.id, order: String(order.no || ''), uid: member.uid, name: shortName(member.name), stars, text: text.trim().slice(0, 800), status: mod ? 'pending' : 'pub', createdAt: t, updatedAt: t, seenAdmin: false, sum: false };
      await store.s.api.createReview(id, doc);
      store.set({ myReviews: [...(store.s.myReviews || []), { id, ...doc }] });
      toast(mod ? 'Teşekkürler! Yorumunuz incelendikten sonra yayınlanacak.' : 'Teşekkürler! Yorumunuz yayınlandı.');
      onClose();
    } catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  return (
    <Sheet title="Yorum yaz" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Vazgeç</button><button className="btn primary" disabled={busy} onClick={send}><Icon n="send" s={16} />{busy ? 'Gönderiliyor…' : 'Yorumu gönder'}</button></>}>
      <div className="wr-head"><b>{p.n}</b><small className="muted">Sipariş #{order.no}</small></div>
      <div className="wr-stars" role="radiogroup" aria-label="Puan">
        {[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" role="radio" aria-checked={stars === i} aria-label={i + ' yıldız'} className={i <= stars ? 'on' : ''} onClick={() => setStars(i)}>★</button>)}
      </div>
      <label className="pq-text">
        <span className="field-l">Yorumunuz <small className="opt">(isteğe bağlı)</small></span>
        <textarea id="wr-text" rows="4" maxLength={800} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ürünü nasıl buldunuz? Diğer ustalara yardımcı olur." />
        <small className="pq-count">{text.length}/800</small>
      </label>
      <p className="fine">Yorumunuz adınızın baş harfiyle görünür: <b>{shortName(member?.name)}</b>{mod ? ' · incelendikten sonra yayınlanır' : ''}.</p>
    </Sheet>
  );
}

// =========================================================================================================
// Yönetim: Müşteriler > Yorumlar
const FILTERS = [['pending', 'Onay bekleyen'], ['pub', 'Yayında'], ['hidden', 'Gizli'], ['all', 'Tümü']];
const ST = { pending: ['Onay bekliyor', 'warn'], pub: ['Yayında', 'ok'], hidden: ['Gizli', 'muted'] };
export async function syncSum(pid) { try { await store.s.api.syncRevSum(pid); store.set({ revSum: null }); sumP = null; } catch (e) { console.warn('yorum özeti', e); } }
export function ReviewAdmin() {
  const { reviews = [], byId } = useStore();
  const [f, setF] = useState(() => (reviews.some((r) => r.status === 'pending') ? 'pending' : 'all'));
  const [q, setQ] = useState('');
  const [del, setDel] = useState(null);
  const [rep, setRep] = useState(null);
  useEffect(() => { for (const r of reviews) if (r.seenAdmin === false) store.s.api.updateReview(r.id, { seenAdmin: true }).catch(() => {}); }, [reviews.length]);
  const counts = useMemo(() => { const c = { all: reviews.length }; for (const r of reviews) c[r.status] = (c[r.status] || 0) + 1; return c; }, [reviews]);
  const list = useMemo(() => reviews.filter((r) => (f === 'all' || r.status === f) && (!q || norm(`${r.name} ${r.text} ${byId.get(r.pid)?.n || ''} ${r.order}`).includes(norm(q)))), [reviews, f, q, byId]);
  const setSt = async (r, status) => { try { await store.s.api.updateReview(r.id, { status, updatedAt: now(), seenAdmin: true }); await syncSum(r.pid); toast(status === 'pub' ? 'Yorum yayınlandı' : 'Yorum gizlendi'); } catch (e) { toast(e.message, 'bad'); } };
  return (
    <>
      <div className="search"><Icon n="search" s={18} /><input id="rv-search" type="search" placeholder="Müşteri, ürün, yorum…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips scroll">{FILTERS.map(([k, l]) => <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}{counts[k] ? <b>{counts[k]}</b> : null}</button>)}</div>
      {list.length === 0 ? <Empty icon="star" title={f === 'pending' ? 'Onay bekleyen yorum yok' : 'Bu filtrede yorum yok'}><p>Ürünü satın alan üyeler teslim edilen siparişlerinin sayfasından yıldız ve yorum yazar; burada yayınlar, gizler ya da yanıtlarsınız.</p></Empty> : (
        <ul className="rv-list">
          {list.map((r) => { const p = byId.get(r.pid); const st = ST[r.status] || ST.pending; return (
            <li key={r.id} className={'rv-card' + (r.status === 'pending' ? ' pend' : '')}>
              <div className="rv-top">
                <span className="rv-p"><b>{p?.n || 'Ürün #' + r.pid}</b><small className="muted">{r.name} · sipariş #{r.order} · {dRel(r.createdAt)}</small></span>
                <span className={'pq-st tone-' + st[1]}>{st[0]}</span>
              </div>
              <Stars v={r.stars} s={14} />
              {r.text ? <p className="rv-t">{r.text}</p> : <p className="rv-t muted">(sadece yıldız verdi)</p>}
              {r.reply && <div className="rev-reply"><b>Yanıtınız:</b> {r.reply}</div>}
              <div className="rv-acts">
                {r.status !== 'pub' && <button className="btn sm primary" onClick={() => setSt(r, 'pub')}><Icon n="check" s={15} />Yayınla</button>}
                <button className="btn sm outline" onClick={() => setRep({ r, t: r.reply || '' })}><Icon n="chat" s={15} />{r.reply ? 'Yanıtı düzenle' : 'Yanıtla'}</button>
                {r.status !== 'hidden' && <button className="btn sm ghost" onClick={() => setSt(r, 'hidden')}><Icon n="eyeoff" s={15} />Gizle</button>}
                <button className="btn sm ghost danger" onClick={() => setDel(r)} aria-label="Sil"><Icon n="trash" s={15} /></button>
              </div>
            </li>
          ); })}
        </ul>
      )}
      <OlderBtn kind="reviews" what="yorumları" unit="yorum" />
      {rep && (
        <Sheet title="Yoruma yanıt" onClose={() => setRep(null)} footer={<><button className="btn ghost" onClick={() => setRep(null)}>Vazgeç</button><button className="btn primary" onClick={async () => { try { await store.s.api.updateReview(rep.r.id, { reply: rep.t.trim().slice(0, 600), updatedAt: now() }); toast('Yanıt kaydedildi'); setRep(null); } catch (e) { toast(e.message, 'bad'); } }}><Icon n="check" s={16} />Kaydet</button></>}>
          <p className="rv-t">“{rep.r.text || 'Sadece yıldız'}” — {rep.r.name}</p>
          <textarea rows="4" maxLength={600} value={rep.t} onChange={(e) => setRep({ ...rep, t: e.target.value })} placeholder="Yorumun altında mağaza yanıtı olarak görünür" />
        </Sheet>
      )}
      {del && <Confirm title="Yorumu sil" text="Yorum kalıcı olarak silinir." okLabel="Sil" tone="danger" onClose={() => setDel(null)} onOk={async () => { try { await store.s.api.deleteReview(del.id); await syncSum(del.pid); toast('Yorum silindi'); } catch (e) { toast(e.message, 'bad'); } }} />}
    </>
  );
}
// yönetici: onaysız yayınlanan (onay kapalıyken gelen) yorumların özeti kendiliğinden güncellenir
export function autoSum(list) {
  for (const r of list || []) if (r.sum === false && r.status === 'pub') { store.s.api.updateReview(r.id, { sum: true }).catch(() => {}); syncSum(r.pid); }
}
