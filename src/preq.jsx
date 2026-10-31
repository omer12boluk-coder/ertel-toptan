// Ürün talebi (28.10.2026): mağaza üyesi aradığı ürünün fotoğrafını (en çok 3) ve açıklamasını gönderir,
// yönetici "Getireceğiz (tarih) / Mağazada var (ürün) / Temin edemiyoruz / Mesaj" diye yanıtlar → üyenin zili + telefon bildirimi.
// Kayıt: preq/{id} { uid, no, name, email, phone, text, photos: ['pr/<id>/0.webp'…], status new|answered|closed,
//   createdAt, updatedAt, seenAdmin, seenUser, replies: [{k, d, t, p, at}] }
// Fotoğraflar bekçi üzerinden R2'ye (kotalı: üye günde preq.perDay talep, dosya ≤700 KB); talep silinince hemen,
// değilse preq.days gün sonra bekçinin saatlik temizliğinde silinir.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, go, toast } from './store.js';
import { Icon, Sheet, Confirm, Empty, Field, Toggle, Thumb, openMenu } from './ui.jsx';
import { imageBlob, now, norm, fmt, fbSkip } from './utils.js';
import { waLink } from './route.js';
import { Lightbox, ProductSheet } from './catalog.jsx';
import { OlderBtn } from './orders.jsx';

const DAY = 864e5;
const MAX_PHOTOS = 3, MAX_TEXT = 600;
export const PQ_KINDS = [
  ['eta', 'Getireceğiz', 'clock', 'ok'],
  ['have', 'Mağazada var', 'store', 'ok'],
  ['no', 'Temin edemiyoruz', 'x', 'bad'],
  ['note', 'Sadece mesaj', 'chat', 'info'],
];
const KIND = Object.fromEntries(PQ_KINDS.map((k) => [k[0], k]));
const dLong = (d) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
const dShort = (t) => { const d = new Date(t); const td = new Date(); if (d.toDateString() === td.toDateString()) return 'Bugün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + (d.getFullYear() !== td.getFullYear() ? ' ' + d.getFullYear() : ''); };
const pic = (k) => store.s.api?.preqPic?.(k) || k;
const lastReply = (q) => (q.replies || []).slice(-1)[0] || null;
// müşteriye gösterilen yanıt başlığı
export function replyHead(r) {
  if (!r) return '';
  if (r.k === 'eta') return r.d ? `Ürününüz ${dLong(r.d)} civarında gelecek` : 'Ürününüzü getireceğiz';
  if (r.k === 'have') return 'Aradığınız ürün mağazamızda';
  if (r.k === 'no') return 'Maalesef bu ürünü temin edemiyoruz';
  return 'Mesajınız var';
}
const STATUS = { new: ['Bekliyor', 'warn'], answered: ['Yanıtlandı', 'ok'], closed: ['Kapandı', 'muted'] };
const daysLeft = (q, days) => Math.ceil(((q.createdAt || 0) + days * DAY - Date.now()) / DAY);
const keepDays = (S) => Math.min(365, Math.max(1, Number(S.preq?.days) || 30));

// küçük resim: süresi dolmuş / silinmiş fotoğrafta yer tutucu
function PqImg({ k, onClick, cls = '' }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span className={'pq-img gone ' + cls} title="Fotoğrafın saklama süresi doldu"><Icon n="camera" s={18} /><small>Süresi doldu</small></span>;
  return <button type="button" className={'pq-img ' + cls} onClick={onClick}><img src={pic(k)} alt="" loading="lazy" onError={(e) => { if (!fbSkip(e)) setBad(true); }} /></button>;
}
function Photos({ q, size = 'md' }) {
  const [lb, setLb] = useState(null);
  const ph = q.photos || [];
  if (!ph.length) return null;
  return <>
    <div className={'pq-photos ' + size}>{ph.map((k, i) => <PqImg key={k} k={k} onClick={() => setLb(i)} />)}</div>
    {lb != null && <Lightbox urls={ph.map(pic)} start={lb} title="Talep fotoğrafları" onClose={() => setLb(null)} />}
  </>;
}
function ReplyBox({ r, admin }) {
  const { byId } = useStore();
  const [prod, setProd] = useState(null);
  const K = KIND[r.k] || KIND.note;
  const p = r.k === 'have' && r.p ? byId.get(Number(r.p)) : null;
  return (
    <div className={'pq-reply tone-' + K[3]}>
      <span className="pq-reply-ic"><Icon n={K[2]} s={17} /></span>
      <div className="pq-reply-b">
        <b>{admin ? K[1] + (r.k === 'eta' && r.d ? ' · ' + dLong(r.d) : '') : replyHead(r)}</b>
        {r.t && <p>{r.t}</p>}
        {p && <button type="button" className="pq-prod" onClick={() => setProd(p)}><Thumb p={p} size="sm" /><span><b>{p.n}</b><small>{p.r != null ? fmt(p.r, p.cur) : ''}{p.k ? ' · ' + p.k : ''}</small></span><Icon n="chev" s={15} /></button>}
        <small className="pq-reply-at">{dShort(r.at)}</small>
      </div>
      {prod && <ProductSheet p={prod} onClose={() => setProd(null)} />}
    </div>
  );
}

// =========================================================================================================
// Mağaza: /magaza/talep
export function PreqPage() {
  const { member, myPreqs, settings: S } = useStore();
  useEffect(() => { document.title = 'Ürün talebi'; }, []);
  // ekrana gelen yanıtlar görüldü sayılır (zildeki / menüdeki sayı düşer)
  useEffect(() => { if (!member) return; for (const q of myPreqs) if (q.seenUser === false) store.s.api.updatePreq(q.id, { seenUser: true }).catch(() => {}); }, [member, myPreqs]);
  const off = S.preq?.on === false;
  return (
    <div className="pq">
      <section className="kf-hero pq-hero">
        <span className="kf-badge"><Icon n="ask" s={15} />Ürün talebi</span>
        <h1>Aradığınız ürünü <em>bulamadınız mı?</em></h1>
        <p>Fotoğrafını ekleyin, kısaca yazın. Temin edebiliyorsak ne zaman geleceğini size bildirelim.</p>
      </section>
      {off ? <div className="kf-empty"><Icon n="ask" s={24} /><div><b>Ürün talebi şu an kapalı.</b><p>WhatsApp’tan bize yazabilirsiniz.</p></div></div>
        : !member ? <MemberGate /> : <PreqForm />}
      {member && <MyPreqs list={myPreqs} />}
    </div>
  );
}
function MemberGate() {
  return (
    <div className="pq-gate">
      <span className="pq-gate-ic"><Icon n="user" s={26} /></span>
      <div><b>Talep göndermek için üye girişi yapın</b><p>Talebinize verdiğimiz yanıt hesabınıza ve telefonunuza bildirim olarak gelir.</p></div>
      <button className="btn primary" onClick={() => go('hesap')}><Icon n="user" s={16} />Giriş yap / Üye ol</button>
    </div>
  );
}
function PreqForm() {
  const { member, api: A, settings: S } = useStore();
  const [files, setFiles] = useState([]); // [{blob, url}]
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState(0);
  const inp = useRef(null);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []);
  const add = async (list) => {
    const room = MAX_PHOTOS - files.length; const pick = [...list].filter((f) => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name)).slice(0, room);
    if (list.length > room) toast(`En çok ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz`, 'warn');
    setPrep((n) => n + pick.length);
    for (const f of pick) {
      try {
        let b = await imageBlob(f, 1280, 0.8);
        if (b.size > 600e3) b = await imageBlob(f, 1024, 0.68);
        if (b.size > 650e3) throw new Error('Fotoğraf çok büyük');
        setFiles((x) => (x.length >= MAX_PHOTOS ? x : [...x, { blob: b, url: URL.createObjectURL(b) }]));
      } catch (e) { toast(e.message === 'Resim açılamadı' ? 'Bu fotoğraf açılamadı (farklı biçim olabilir)' : e.message, 'bad'); }
      setPrep((n) => n - 1);
    }
  };
  const drop = (i) => setFiles((x) => { URL.revokeObjectURL(x[i].url); return x.filter((_, j) => j !== i); });
  const send = async () => {
    const t = text.trim();
    if (!files.length && t.length < 3) return toast('Bir fotoğraf ekleyin ya da ürünü kısaca yazın', 'warn');
    setBusy(true);
    try {
      const { id, keys } = await A.preqUpload(files.map((f) => f.blob));
      const at = now();
      await A.createPreq(id, { uid: member.uid, no: id.slice(-5).toUpperCase(), name: member.name || '', email: member.email || '', phone: member.phone || '', text: t.slice(0, MAX_TEXT), photos: keys, status: 'new', createdAt: at, updatedAt: at, seenAdmin: false, seenUser: true });
      files.forEach((f) => URL.revokeObjectURL(f.url)); setFiles([]); setText('');
      toast('Talebiniz gönderildi. Yanıtımız bildirim olarak gelecek.');
    } catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  return (
    <div className="pq-form">
      <div className="pq-slots">
        {files.map((f, i) => (
          <span key={f.url} className="pq-slot full"><img src={f.url} alt="" /><button type="button" className="pq-slot-x" onClick={() => drop(i)} aria-label="Fotoğrafı çıkar"><Icon n="x" s={14} /></button></span>
        ))}
        {Array.from({ length: prep }).map((_, i) => <span key={'p' + i} className="pq-slot busy"><span className="spinner sm" /></span>)}
        {files.length + prep < MAX_PHOTOS && (
          <button type="button" className="pq-slot add" onClick={() => inp.current?.click()}>
            <Icon n="camera" s={24} /><b>{files.length ? 'Fotoğraf ekle' : 'Fotoğraf çek / seç'}</b><small>{files.length}/{MAX_PHOTOS}</small>
          </button>
        )}
        <input ref={inp} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      <label className="pq-text">
        <span className="field-l">Ne arıyorsunuz?</span>
        <textarea id="pq-text" rows="3" maxLength={MAX_TEXT} value={text} onChange={(e) => setText(e.target.value)} placeholder="Örn. iPhone 13 Pro Max ekran çerçevesi, siyah · 2 adet lazım" />
        <small className="pq-count">{text.length}/{MAX_TEXT}</small>
      </label>
      <div className="pq-send">
        <small className="muted">En çok {MAX_PHOTOS} fotoğraf · günde {Math.max(1, Number(S.preq?.perDay) || 5)} talep · fotoğraflar {keepDays(S)} gün saklanır</small>
        <button className="btn primary" disabled={busy || prep > 0} onClick={send}><Icon n="send" s={16} />{busy ? 'Gönderiliyor…' : 'Talebi gönder'}</button>
      </div>
    </div>
  );
}
function MyPreqs({ list }) {
  const [del, setDel] = useState(null);
  if (!list.length) return null;
  return (
    <section className="pq-mine">
      <h2 className="pq-h">Taleplerim <span className="num">{list.length}</span></h2>
      <ul className="pq-list">
        {list.map((q) => {
          const st = STATUS[q.status] || STATUS.new;
          return (
            <li key={q.id} className="pq-card">
              <div className="pq-card-h">
                <span className={'pq-st tone-' + st[1]}>{st[0]}</span>
                <small className="muted">#{q.no} · {dShort(q.createdAt)}</small>
                <button className="icon-btn sm" onClick={() => setDel(q)} aria-label="Talebi sil" title="Talebi sil"><Icon n="trash" s={15} /></button>
              </div>
              <Photos q={q} size="sm" />
              {q.text && <p className="pq-t">{q.text}</p>}
              {(q.replies || []).map((r) => <ReplyBox key={r.at} r={r} />)}
              {!(q.replies || []).length && <p className="pq-wait"><Icon n="clock" s={14} />Talebinize bakıyoruz, yanıtımız bildirim olarak gelecek.</p>}
            </li>
          );
        })}
      </ul>
      {del && <Confirm title="Talebi sil" text="Talep ve fotoğrafları silinir. Geri alınamaz." okLabel="Sil" tone="danger" onClose={() => setDel(null)}
        onOk={() => store.s.api.deletePreq(del.id).then(() => toast('Talep silindi')).catch((e) => toast(e.message, 'bad'))} />}
    </section>
  );
}

// zil (mağaza): yanıtlar
export function preqNotifs(list) {
  const out = [];
  for (const q of list || []) for (const r of q.replies || []) {
    const K = KIND[r.k] || KIND.note;
    out.push({ id: 'pq' + q.id + r.at, at: r.at, ic: K[2], tone: K[3] === 'bad' ? 'bad' : 'ok', t: `Ürün talebi #${q.no} · ${replyHead(r)}`, s: r.t || q.text || '', go: () => go('talep') });
  }
  return out;
}

// =========================================================================================================
// Yönetim: Müşteriler > Ürün talepleri
const FILTERS = [['new', 'Bekleyen'], ['answered', 'Yanıtlanan'], ['closed', 'Kapanan'], ['all', 'Tümü']];
export function PreqAdmin() {
  const { preqs, openPreq } = useStore();
  const [f, setF] = useState('new');
  const [q, setQ] = useState('');
  const [del, setDel] = useState(null);
  const counts = useMemo(() => { const c = { all: preqs.length }; for (const x of preqs) c[x.status] = (c[x.status] || 0) + 1; return c; }, [preqs]);
  const list = useMemo(() => preqs.filter((x) => (f === 'all' || x.status === f) && (!q || norm(`${x.name} ${x.phone} ${x.email} ${x.text} ${x.no}`).includes(norm(q)))), [preqs, f, q]);
  const cur = openPreq && preqs.find((x) => x.id === openPreq);
  const menu = (e, x) => openMenu(e, [
    { label: 'Aç ve yanıtla', icon: 'chat', onClick: () => store.set({ openPreq: x.id }) },
    x.phone && { label: "WhatsApp'tan yaz", icon: 'wa', onClick: () => window.open(waLink(x.phone, `Merhaba ${x.name || ''}, ürün talebiniz hakkında yazıyorum.`), '_blank', 'noopener') },
    x.status !== 'closed' ? { label: 'Kapat', icon: 'check', onClick: () => store.s.api.updatePreq(x.id, { status: 'closed', seenAdmin: true, updatedAt: now() }) } : { label: 'Yeniden aç', icon: 'undo', onClick: () => store.s.api.updatePreq(x.id, { status: (x.replies || []).length ? 'answered' : 'new', updatedAt: now() }) },
    '-',
    { label: 'Talebi sil (fotoğraflarıyla)', icon: 'trash', danger: true, onClick: () => setDel(x) },
  ], '#' + x.no);
  return (
    <>
      <div className="search"><Icon n="search" s={18} /><input id="pq-search" type="search" placeholder="Müşteri, telefon, açıklama…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips scroll">{FILTERS.map(([k, l]) => <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}{counts[k] ? <b>{counts[k]}</b> : null}</button>)}</div>
      {list.length === 0 ? <Empty icon="ask" title={f === 'new' ? 'Bekleyen ürün talebi yok' : 'Bu filtrede talep yok'}><p>Müşteriler mağazadaki <b>Ürün talebi</b> sayfasından fotoğraf ve açıklamayla istek gönderir; burada yanıtlarsınız.</p></Empty> : (
        <ul className="pq-alist">
          {list.map((x) => {
            const st = STATUS[x.status] || STATUS.new; const r = lastReply(x);
            return (
              <li key={x.id}>
                <button className={'pq-arow' + (x.seenAdmin === false ? ' fresh' : '')} onClick={() => store.set({ openPreq: x.id })} onContextMenu={(e) => menu(e, x)}>
                  <span className="pq-arow-img">{x.photos?.[0] ? <img src={pic(x.photos[0])} alt="" loading="lazy" onError={(e) => { if (!fbSkip(e)) e.currentTarget.style.visibility = 'hidden'; }} /> : <Icon n="ask" s={22} />}{(x.photos || []).length > 1 && <i>{x.photos.length}</i>}</span>
                  <span className="pq-arow-b">
                    <span className="pq-arow-t"><b>{x.name || x.email || 'Üye'}</b><small className="muted">#{x.no} · {dShort(x.createdAt)}</small></span>
                    <span className="pq-arow-x">{x.text || <i className="muted">Açıklama yok · {(x.photos || []).length} fotoğraf</i>}</span>
                    {r && <span className="pq-arow-r"><Icon n={(KIND[r.k] || KIND.note)[2]} s={13} />{(KIND[r.k] || KIND.note)[1]}{r.k === 'eta' && r.d ? ' · ' + dLong(r.d) : ''}</span>}
                  </span>
                  <span className={'pq-st tone-' + st[1]}>{st[0]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <OlderBtn kind="preqs" what="talepleri" unit="talep" />
      {cur && <PreqSheet q={cur} onClose={() => store.set({ openPreq: null })} onDelete={() => setDel(cur)} />}
      {del && <Confirm title="Talebi sil" text="Talep ve fotoğrafları depodan kalıcı olarak silinir. Müşterinin listesinden de kalkar." okLabel="Sil" tone="danger" onClose={() => setDel(null)}
        onOk={() => { const id = del.id; store.set({ openPreq: null }); store.s.api.deletePreq(id).then(() => toast('Talep ve fotoğrafları silindi')).catch((e) => toast(e.message, 'bad')); }} />}
    </>
  );
}
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function PreqSheet({ q, onClose, onDelete }) {
  const { settings: S, catalog } = useStore();
  const [k, setK] = useState('eta');
  const [d, setD] = useState(addDays(7));
  const [t, setT] = useState('');
  const [p, setP] = useState(null);
  const [pq, setPq] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.seenAdmin === false) store.s.api.updatePreq(q.id, { seenAdmin: true }).catch(() => {}); }, [q.id]);
  const hits = useMemo(() => { const tk = norm(pq).split(/\s+/).filter(Boolean); if (!tk.length) return []; return catalog.filter((x) => tk.every((w) => norm(`${x.n} ${x.k || ''} ${x.b || ''}`).includes(w))).slice(0, 6); }, [pq, catalog]);
  const left = daysLeft(q, keepDays(S));
  const send = async () => {
    if (k === 'note' && !t.trim()) return toast('Mesajı yazın', 'warn');
    if (k === 'eta' && !d) return toast('Tahmini geliş tarihini seçin', 'warn');
    setBusy(true);
    const r = { k, at: now(), ...(t.trim() ? { t: t.trim().slice(0, 500) } : {}), ...(k === 'eta' ? { d } : {}), ...(k === 'have' && p ? { p: p.id } : {}) };
    try {
      await store.s.api.replyPreq(q.id, { replies: [...(q.replies || []), r], status: 'answered', seenUser: false, seenAdmin: true, updatedAt: r.at });
      toast('Yanıt gönderildi · müşteriye bildirim gitti'); setT(''); setP(null); setPq('');
    } catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  const st = STATUS[q.status] || STATUS.new;
  return (
    <Sheet title={`Ürün talebi #${q.no}`} sub={dShort(q.createdAt)} onClose={onClose} wide cls="pq-sheet"
      footer={<div className="pq-foot">
        <button className="btn ghost danger" onClick={onDelete}><Icon n="trash" s={16} />Sil</button>
        <span className="top-sp" />
        {q.status !== 'closed'
          ? <button className="btn outline" onClick={() => store.s.api.updatePreq(q.id, { status: 'closed', updatedAt: now() }).then(onClose)}><Icon n="check" s={16} />Kapat</button>
          : <button className="btn outline" onClick={() => store.s.api.updatePreq(q.id, { status: (q.replies || []).length ? 'answered' : 'new', updatedAt: now() })}><Icon n="undo" s={16} />Yeniden aç</button>}
        <button className="btn primary" disabled={busy} onClick={send}><Icon n="send" s={16} />{busy ? 'Gönderiliyor…' : 'Yanıtı gönder'}</button>
      </div>}>
      <div className="pq-who">
        <span className={'pq-st tone-' + st[1]}>{st[0]}</span>
        <b>{q.name || 'Üye'}</b>
        {q.phone && <a className="chip" href={'tel:' + q.phone.replace(/\s/g, '')}><Icon n="phone" s={14} />{q.phone}</a>}
        {q.phone && <a className="chip" href={waLink(q.phone, `Merhaba ${q.name || ''}, ürün talebiniz hakkında yazıyorum.`)} target="_blank" rel="noopener"><Icon n="wa" s={14} />WhatsApp</a>}
        {q.email && <small className="muted">{q.email}</small>}
      </div>
      <Photos q={q} size="lg" />
      {(q.photos || []).length > 0 && <p className="fine">{left > 0 ? `Fotoğraflar ${left} gün sonra depodan otomatik silinir.` : 'Fotoğrafların saklama süresi doldu.'}</p>}
      <div className="pq-ask">{q.text || <i className="muted">Müşteri açıklama yazmadı.</i>}</div>
      {(q.replies || []).length > 0 && <div className="pq-hist"><h3>Gönderilen yanıtlar</h3>{q.replies.map((r) => <ReplyBox key={r.at} r={r} admin />)}</div>}
      <div className="pq-rep">
        <h3>{(q.replies || []).length ? 'Yeni yanıt' : 'Yanıtla'}</h3>
        <div className="b2b-seg pq-kinds">{PQ_KINDS.map(([kk, l, ic]) => <button key={kk} type="button" className={k === kk ? 'on' : ''} onClick={() => setK(kk)}><Icon n={ic} s={16} />{l}</button>)}</div>
        {k === 'eta' && (
          <Field label="Tahmini geliş">
            <div className="pq-eta">
              {[[3, '3 gün'], [7, '1 hafta'], [14, '2 hafta'], [30, '1 ay']].map(([n, l]) => <button key={n} type="button" className={'chip' + (d === addDays(n) ? ' on' : '')} onClick={() => setD(addDays(n))}>{l}</button>)}
              <input id="pq-date" type="date" value={d} min={addDays(0)} onChange={(e) => setD(e.target.value)} />
            </div>
          </Field>
        )}
        {k === 'have' && (
          <Field label="Ürün (isteğe bağlı)" hint="Seçerseniz müşteri bildirime dokununca doğrudan ürün sayfası açılır">
            {p ? <div className="pq-prod on"><Thumb p={p} size="sm" /><span><b>{p.n}</b><small>{p.k} · {fmt(p.r, p.cur)}</small></span><button type="button" className="icon-btn sm" onClick={() => setP(null)} aria-label="Kaldır"><Icon n="x" s={14} /></button></div>
              : <div className="pq-pick">
                <input id="pq-prod" type="search" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Ürün adı ya da stok kodu…" autoComplete="off" />
                {hits.length > 0 && <div className="pq-hits">{hits.map((x) => <button key={x.id} type="button" className="pq-prod" onClick={() => { setP(x); setPq(''); }}><Thumb p={x} size="sm" /><span><b>{x.n}</b><small>{x.k} · {fmt(x.r, x.cur)}{x.a === 0 ? ' · pasif' : ''}</small></span></button>)}</div>}
              </div>}
          </Field>
        )}
        <Field label={k === 'note' ? 'Mesaj' : 'Not (isteğe bağlı)'}>
          <textarea id="pq-reply" rows="3" maxLength={500} value={t} onChange={(e) => setT(e.target.value)} placeholder={k === 'eta' ? 'Örn. Siyah rengi gelecek, fiyatı yaklaşık 12$' : k === 'no' ? 'Örn. Bu model artık üretilmiyor' : k === 'have' ? 'Örn. Dükkânda 3 adet var' : 'Müşteriye yazın…'} />
        </Field>
        <p className="fine">Yanıt müşterinin hesabındaki bildirimlere ve (açtıysa) telefonuna gider: <b>{replyHead({ k, d, at: 0 })}</b>{t.trim() ? ' · ' + t.trim().slice(0, 60) : ''}</p>
      </div>
    </Sheet>
  );
}

// Ayarlar > Ürün talebi
export function PreqSettings({ d, set }) {
  return <>
    <p className="fine">Mağaza üyeleri <b>Ürün talebi</b> sayfasından aradıkları ürünün fotoğrafını (en çok {MAX_PHOTOS}) ve açıklamasını gönderir. Talepler <b>Müşteriler › Ürün talepleri</b>’ne düşer; Telegram ve telefon bildirimi gelir. Sadece e-postasını doğrulamış üyeler gönderebilir; fotoğraflar küçültülerek yüklenir (en çok 700 KB).</p>
    <Toggle id="s-pq" label="Mağazada Ürün talebi görünsün" checked={d.preq?.on !== false} onChange={(v) => set('preq.on', v)} />
    <div className="row2">
      <Field label="Bir üye günde en çok kaç talep gönderebilir"><input id="s-pq-day" type="number" min="1" max="50" value={d.preq?.perDay ?? 5} onChange={(e) => set('preq.perDay', Math.max(1, Math.min(50, Number(e.target.value) || 1)))} /></Field>
      <Field label="Fotoğraflar kaç gün saklansın" hint="Süre dolunca depodan otomatik silinir; talebi silince hemen silinir"><input id="s-pq-keep" type="number" min="1" max="365" value={d.preq?.days ?? 30} onChange={(e) => set('preq.days', Math.max(1, Math.min(365, Number(e.target.value) || 1)))} /></Field>
    </div>
  </>;
}
