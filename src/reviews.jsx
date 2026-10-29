// Ürün yorumları (29.10.2026). Sadece o ürünü SATIN ALMIŞ üye yazabilir (kayıt kimliği = <sipariş>_<ürün>; kural siparişin
// üyeye ait ve teslim edilmiş/yolda olduğunu kontrol eder). Ayarlar > Mağaza özellikleri > "onaylayınca yayınlansın" açıksa
// yorum 'pending' gelir, yönetici Müşteriler > Yorumlar'dan yayınlar. Ürün penceresi önce revsum/main'e bakar (oturumda 1 okuma),
// yorumu olan üründe yayındaki yorumları okur. Kayıt: reviews/{id} { pid, oid, order, uid, name, stars, text, status, reply?,
// createdAt, updatedAt, seenAdmin, sum } · revsum/main { s: { <ürün>: [ortalama, adet] } } (yönetici yazar).
import { useEffect, useMemo, useState } from 'react';
import { useStore, store, api, go, toast } from './store.js';
import { Icon, Sheet, Confirm, Empty, openMenu } from './ui.jsx';
import { now, norm } from './utils.js';
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

// Ürün penceresinin altında: özet + yorumlar + "Yorum yaz" (sadece alan üyeye)
export function Reviews({ p }) {
  const { settings: S, member, myOrders = [] } = useStore();
  const F = feat(S);
  const sum = useRevSum(F.rev);
  const mine = useMyReviews(F.rev && member);
  const [list, setList] = useState(null);
  const [write, setWrite] = useState(null);
  const n = sum?.[p.id]?.[1] || 0;
  useEffect(() => { if (!F.rev || !n) { setList([]); return; } let live = true; store.s.api.reviewsOf(p.id).then((l) => live && setList(l)).catch(() => live && setList([])); return () => { live = false; }; }, [p.id, n, F.rev]);
  // yorum yazabileceği sipariş: bu ürünü içeren, teslim edilmiş / yolda / teslime hazır ve henüz yorumlanmamış
  const done = new Set((mine || []).map((r) => r.id));
  const ord = member && myOrders.find((o) => BOUGHT.includes(o.status) && (o.items || []).some((i) => i.id === p.id) && !done.has(o.id + '_' + p.id));
  const own = (mine || []).find((r) => r.pid === p.id);
  if (!F.rev) return null;
  if (!n && !ord && !own) return null;
  const items = list || [];
  const bars = [5, 4, 3, 2, 1].map((s) => ({ s, c: items.filter((r) => r.stars === s).length }));
  return (
    <section className="rev" id={'rev-' + p.id}>
      <div className="rev-h"><b>Yorumlar</b>{ord && <button type="button" className="linkish" onClick={() => setWrite(ord)}>Yorum yaz</button>}</div>
      {own && own.status !== 'pub' && <p className="rev-own"><Icon n="clock" s={14} />Yorumunuz {own.status === 'hidden' ? 'yayınlanmadı' : 'incelendikten sonra yayınlanacak'}: <Stars v={own.stars} s={12} /></p>}
      {n > 0 && (
        <div className="rev-sum">
          <div className="rev-big"><b>{fmtAvg(sum[p.id][0])}</b><Stars v={sum[p.id][0]} s={13} /><small>{n} yorum</small></div>
          <div className="rev-bars">{bars.map((b) => <div key={b.s}><span>{b.s}</span><i><em style={{ width: items.length ? Math.round((b.c / items.length) * 100) + '%' : 0 }} /></i></div>)}</div>
        </div>
      )}
      {list == null && n > 0 && <div className="spinner sm" />}
      {items.map((r) => (
        <article key={r.id} className="rev-item">
          <div className="rev-ih"><b>{r.name}</b><span className="rev-buy"><Icon n="check" s={11} />Satın aldı</span><small>{dRel(r.createdAt)}</small></div>
          <Stars v={r.stars} s={13} />
          {r.text && <p>{r.text}</p>}
          {r.reply && <div className="rev-reply"><b>{S.brand?.appName || 'Mağaza'}:</b> {r.reply}</div>}
        </article>
      ))}
      {!n && ord && <p className="fine">Bu ürünü aldınız. İlk yorumu siz yazın, diğer ustalara yardımcı olur.</p>}
      {write && <WriteReview p={p} order={write} onClose={() => setWrite(null)} />}
    </section>
  );
}

function WriteReview({ p, order, onClose }) {
  const { member, settings: S } = useStore();
  const [stars, setStars] = useState(5);
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
      {list.length === 0 ? <Empty icon="star" title={f === 'pending' ? 'Onay bekleyen yorum yok' : 'Bu filtrede yorum yok'}><p>Ürünü satın alan üyeler ürün penceresinden yıldız ve yorum yazar; burada yayınlar, gizler ya da yanıtlarsınız.</p></Empty> : (
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
      <OlderBtn kind="reviews" what="yorumları" />
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
