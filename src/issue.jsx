// Sorun bildirimi (29.10.2026) — MENÜDE YOK, sadece /magaza/sorun adresiyle açılır (kullanıcı inceleyip yerini sonra seçecek).
// Mağaza üyesi sorunlu ürünün fotoğraflarını (en çok 4) ve kısa videosunu (en çok 1, ≤ 40 MB) + açıklama + iletişim bilgisini gönderir;
// yönetici Müşteriler > Sorun bildirimleri'nden durum (İşleme alındı / İnceleniyor / …) + açıklama + isterse fotoğrafla yanıtlar,
// üyenin telefonuna ve zile düşer. Üye de altına mesaj ekleyebilir.
// Kayıt: issues/{id} { uid, no, name, email, phone, order?, prod?, text, files: [{k, t:'i'|'v'}], status, createdAt, updatedAt,
//   seenAdmin, seenUser, replies: [{by:'a'|'c', s?, t?, files?, at}] }
// Dosyalar bekçi üzerinden R2 is/<id>/… (kotalı: üye günde issue.perDay, aynı ağ saatte 6, mağaza günde 150); kayıt silinince hemen,
// değilse issue.days gün sonra saatlik temizlikte silinir.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store, go, toast } from './store.js';
import { Icon, Sheet, Confirm, Empty, Field, Toggle, PhoneInput, openMenu } from './ui.jsx';
import { imageBlob, now, norm } from './utils.js';
import { waLink } from './route.js';
import { Lightbox } from './catalog.jsx';

const DAY = 864e5;
const MAX_IMG = 4, MAX_TEXT = 1500, MAX_VID = 40e6, MAX_SEC = 90;
// yönetici yanıt durumları: [anahtar, yönetici etiketi, müşteriye görünen, simge, ton]
export const IS_STATES = [
  ['received', 'İşleme alındı', 'Bildiriminiz işleme alındı', 'check', 'info'],
  ['review', 'İnceleniyor', 'Sorununuz inceleniyor', 'search', 'warn'],
  ['action', 'Müşteriden adım bekleniyor', 'Sizden bir adım bekliyoruz', 'ask', 'warn'],
  ['shipping', 'Ürünü gönderin', 'Ürünü değişim / iade için gönderin', 'box', 'info'],
  ['solved', 'Çözüldü', 'Sorununuz çözüldü', 'check', 'ok'],
  ['closed', 'Kapatıldı', 'Bildiriminiz kapatıldı', 'x', 'muted'],
];
const ST = Object.fromEntries(IS_STATES.map((x) => [x[0], x]));
const stOf = (k) => ST[k] || ['new', 'Yeni', 'Bildiriminiz alındı', 'clock', 'new'];
const dShort = (t) => { const d = new Date(t); const td = new Date(); const hm = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); if (d.toDateString() === td.toDateString()) return 'Bugün ' + hm; return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + (d.getFullYear() !== td.getFullYear() ? ' ' + d.getFullYear() : '') + ' ' + hm; };
const pic = (k) => store.s.api?.issuePic?.(k) || k;
const keepDays = (S) => Math.min(365, Math.max(1, Number(S.issue?.days) || 45));
const vidLen = (file) => new Promise((res) => { const v = document.createElement('video'); v.preload = 'metadata'; const u = URL.createObjectURL(file); v.onloadedmetadata = () => { URL.revokeObjectURL(u); res(v.duration || 0); }; v.onerror = () => { URL.revokeObjectURL(u); res(0); }; v.src = u; });
const mb = (n) => (n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' MB';

// Fotoğraf + video küçük resimleri (fotoğrafa basınca büyük resim, video kendi oynatıcısında)
function Files({ files, size = 'md' }) {
  const [lb, setLb] = useState(null);
  const imgs = (files || []).filter((x) => x.t !== 'v'); const vids = (files || []).filter((x) => x.t === 'v');
  if (!imgs.length && !vids.length) return null;
  return <>
    <div className={'is-files ' + size}>
      {imgs.map((x, i) => <IsImg key={x.k} k={x.k} onClick={() => setLb(i)} />)}
      {vids.map((x) => <IsVid key={x.k} k={x.k} />)}
    </div>
    {lb != null && <Lightbox urls={imgs.map((x) => pic(x.k))} start={lb} title="Fotoğraflar" onClose={() => setLb(null)} />}
  </>;
}
function IsImg({ k, onClick }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span className="pq-img gone" title="Saklama süresi doldu"><Icon n="camera" s={18} /><small>Süresi doldu</small></span>;
  return <button type="button" className="pq-img" onClick={onClick}><img src={pic(k)} alt="" loading="lazy" onError={() => setBad(true)} /></button>;
}
function IsVid({ k }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span className="pq-img is-vid gone"><Icon n="play" s={18} /><small>Süresi doldu</small></span>;
  return <video className="is-vid" src={pic(k)} controls playsInline preload="metadata" onError={() => setBad(true)} />;
}

function Reply({ r, admin }) {
  if (r.by === 'c') return (
    <div className={'is-msg cust' + (admin ? ' left' : '')}>
      <p>{r.t}</p><small>{admin ? 'Müşteri · ' : 'Siz · '}{dShort(r.at)}</small>
    </div>
  );
  const s = r.s ? stOf(r.s) : null;
  return (
    <div className={'is-msg shop tone-' + (s ? s[4] : 'info')}>
      {s && <b className="is-msg-st"><Icon n={s[3]} s={14} />{admin ? s[1] : s[2]}</b>}
      {r.t && <p>{r.t}</p>}
      <Files files={r.files} size="sm" />
      <small>{admin ? 'Siz · ' : ''}{dShort(r.at)}</small>
    </div>
  );
}

// =========================================================================================================
// Mağaza: /magaza/sorun
export function IssuePage() {
  const { member, myIssues = [], settings: S } = useStore();
  useEffect(() => { document.title = 'Sorun bildirimi'; }, []);
  useEffect(() => { if (!member) return; for (const q of myIssues) if (q.seenUser === false) store.s.api.updateIssue(q.id, { seenUser: true }).catch(() => {}); }, [member, myIssues]);
  const off = S.issue?.on === false;
  const wa = S.shop?.whatsapp ? waLink(S.shop.whatsapp, 'Merhaba, aldığım bir ürünle ilgili sorun bildirmek istiyorum.') : null;
  return (
    <div className="pq is-page">
      <section className="kf-hero">
        <div className="kf-head">
          <span className="kf-ic is-ic"><Icon n="ask" s={18} /></span>
          <div className="kf-head-t"><h1>Sorun bildirimi</h1><p>Aldığınız üründe sorun mu var? Fotoğrafını ya da kısa videosunu ekleyip anlatın; inceleyip size dönelim.</p></div>
        </div>
      </section>
      {off ? <div className="kf-empty"><Icon n="ask" s={24} /><div><b>Sorun bildirimi şu an kapalı.</b><p>WhatsApp’tan bize yazabilirsiniz.</p></div>{wa && <a className="btn wa" href={wa} target="_blank" rel="noopener"><Icon n="wa" s={16} />WhatsApp</a>}</div>
        : !member ? <Gate /> : <IssueForm />}
      {member && <MyIssues list={myIssues} />}
    </div>
  );
}
function Gate() {
  return (
    <div className="pq-gate">
      <span className="pq-gate-ic"><Icon n="user" s={26} /></span>
      <div><b>Bildirim göndermek için üye girişi yapın</b><p>Yanıtımız ve sorunun durumu hesabınıza ve telefonunuza bildirim olarak gelir.</p></div>
      <button className="btn primary" onClick={() => go('hesap')}><Icon n="user" s={16} />Giriş yap / Üye ol</button>
    </div>
  );
}
function IssueForm() {
  const { member, api: A, settings: S, myOrders = [] } = useStore();
  const [imgs, setImgs] = useState([]); // [{blob, url}]
  const [vid, setVid] = useState(null); // {file, url, sec}
  const [prep, setPrep] = useState(0);
  const [f, setF] = useState(() => ({ text: '', order: '', prod: '', name: member?.name || '', phone: member?.phone || '' }));
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState({});
  const inpI = useRef(null), inpV = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  useEffect(() => () => { imgs.forEach((x) => URL.revokeObjectURL(x.url)); if (vid) URL.revokeObjectURL(vid.url); }, []);
  const orders = useMemo(() => myOrders.filter((o) => o.status !== 'cancelled').slice(0, 20), [myOrders]);
  const ord = orders.find((o) => String(o.no) === f.order);
  const addImgs = async (list) => {
    const room = MAX_IMG - imgs.length; const pick = [...list].filter((x) => /^image\//.test(x.type) || /\.(heic|heif)$/i.test(x.name)).slice(0, room);
    if ([...list].filter((x) => !/^video\//.test(x.type)).length > room) toast(`En çok ${MAX_IMG} fotoğraf ekleyebilirsiniz`, 'warn');
    const vids = [...list].filter((x) => /^video\//.test(x.type)); if (vids.length) addVid(vids[0]);
    setPrep((n) => n + pick.length);
    for (const x of pick) {
      try {
        let b = await imageBlob(x, 1600, 0.8);
        if (b.size > 740e3) b = await imageBlob(x, 1280, 0.7);
        if (b.size > 790e3) throw new Error('Fotoğraf çok büyük');
        setImgs((a) => (a.length >= MAX_IMG ? a : [...a, { blob: b, url: URL.createObjectURL(b) }]));
      } catch (e) { toast(e.message === 'Resim açılamadı' ? 'Bu fotoğraf açılamadı (farklı biçim olabilir)' : e.message, 'bad'); }
      setPrep((n) => n - 1);
    }
  };
  const addVid = async (file) => {
    if (!file) return;
    if (file.size > MAX_VID) return toast(`Video çok büyük (${mb(file.size)}). En çok 40 MB: 20-30 saniyelik kısa bir video çekin.`, 'bad');
    const sec = await vidLen(file);
    if (sec > MAX_SEC) return toast(`Video ${Math.round(sec)} sn. En çok ${MAX_SEC} sn olabilir; sorunu gösteren kısa bir kısım çekin.`, 'bad');
    if (vid) URL.revokeObjectURL(vid.url);
    setVid({ file, url: URL.createObjectURL(file), sec });
  };
  const dropImg = (i) => setImgs((a) => { URL.revokeObjectURL(a[i].url); return a.filter((_, j) => j !== i); });
  const send = async () => {
    const e = {};
    if (f.text.trim().length < 10) e.text = 'Sorunu biraz daha açık yazın (en az 10 karakter)';
    if (f.name.trim().length < 3) e.name = 'Adınızı yazın';
    if ((f.phone || '').replace(/\D/g, '').length !== 11) e.phone = 'Telefonu 0(5xx) xxx xx xx şeklinde yazın';
    setErr(e); if (Object.keys(e).length) return toast('Eksik bilgileri tamamlayın', 'bad');
    setProg(0);
    try {
      const { id, files } = await A.issueUpload(imgs.map((x) => x.blob), vid?.file || null, (p) => setProg(p));
      const at = now();
      await A.createIssue(id, { uid: member.uid, no: id.slice(-5).toUpperCase(), name: f.name.trim(), email: member.email || '', phone: f.phone, ...(f.order ? { order: f.order } : {}), ...(f.prod.trim() ? { prod: f.prod.trim().slice(0, 160) } : {}), text: f.text.trim().slice(0, MAX_TEXT), files, status: 'new', createdAt: at, updatedAt: at, seenAdmin: false, seenUser: true, replies: [] });
      imgs.forEach((x) => URL.revokeObjectURL(x.url)); if (vid) URL.revokeObjectURL(vid.url);
      setImgs([]); setVid(null); setF((x) => ({ ...x, text: '', order: '', prod: '' }));
      toast('Bildiriminiz gönderildi. Yanıtımız bildirim olarak gelecek.');
      setTimeout(() => document.querySelector('.is-mine')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (x) { toast(x.message, 'bad'); }
    setProg(null);
  };
  const busy = prog != null;
  return (
    <div className="pq-form is-form">
      {orders.length > 0 && (
        <Field label="Hangi sipariş?" opt>
          <select id="is-order" value={f.order} onChange={(e) => setF((x) => ({ ...x, order: e.target.value, prod: '' }))}>
            <option value="">Seçmeyin / dükkândan aldım</option>
            {orders.map((o) => <option key={o.id} value={String(o.no)}>#{o.no} · {new Date(o.createdAt).toLocaleDateString('tr-TR')} · {(o.items || []).length} ürün</option>)}
          </select>
        </Field>
      )}
      <Field label="Hangi ürün?" opt>
        <input id="is-prod" value={f.prod} onChange={set('prod')} maxLength={160} placeholder="Örn. Yihua 853D istasyon" />
      </Field>
      {ord && (ord.items || []).length > 0 && (
        <div className="is-chips">{(ord.items || []).slice(0, 12).map((it) => <button key={it.id} type="button" className={'chip' + (f.prod === it.n ? ' on' : '')} onClick={() => setF((x) => ({ ...x, prod: it.n }))}>{it.n}</button>)}</div>
      )}
      <label className={'pq-text' + (err.text ? ' bad' : '')}>
        <span className="field-l">Sorun ne?</span>
        <textarea id="is-text" rows="4" maxLength={MAX_TEXT} value={f.text} onChange={set('text')} placeholder="Örn. Cihaz açılıyor ama ısıtmıyor, ekranda E1 hatası yazıyor. Dün teslim aldım." />
        <small className="pq-count">{f.text.length}/{MAX_TEXT}</small>
        {err.text && <small className="is-err">{err.text}</small>}
      </label>
      <div className="is-media">
        <span className="field-l">Fotoğraf / video <small className="opt">(sorunu gösterirse çok daha hızlı çözeriz)</small></span>
        <div className="pq-slots is-slots">
          {imgs.map((x, i) => <span key={x.url} className="pq-slot full"><img src={x.url} alt="" /><button type="button" className="pq-slot-x" onClick={() => dropImg(i)} aria-label="Fotoğrafı çıkar"><Icon n="x" s={14} /></button></span>)}
          {Array.from({ length: prep }).map((_, i) => <span key={'p' + i} className="pq-slot busy"><span className="spinner sm" /></span>)}
          {vid && <span className="pq-slot full is-vslot"><video src={vid.url} muted playsInline preload="metadata" /><i className="is-vbadge"><Icon n="play" s={11} />{Math.round(vid.sec)} sn · {mb(vid.file.size)}</i><button type="button" className="pq-slot-x" onClick={() => { URL.revokeObjectURL(vid.url); setVid(null); }} aria-label="Videoyu çıkar"><Icon n="x" s={14} /></button></span>}
          {imgs.length + prep < MAX_IMG && <button type="button" className="pq-slot add" onClick={() => inpI.current?.click()}><Icon n="camera" s={22} /><b>Fotoğraf</b><small>{imgs.length}/{MAX_IMG}</small></button>}
          {!vid && <button type="button" className="pq-slot add" onClick={() => inpV.current?.click()}><Icon n="play" s={22} /><b>Video</b><small>en çok 40 MB</small></button>}
        </div>
        <input ref={inpI} type="file" accept="image/*" multiple hidden onChange={(e) => { addImgs(e.target.files); e.target.value = ''; }} />
        <input ref={inpV} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" hidden onChange={(e) => { addVid(e.target.files[0]); e.target.value = ''; }} />
      </div>
      <div className="row2">
        <Field label="Adınız soyadınız" error={err.name}><input id="is-name" autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="Size ulaşacağımız telefon" error={err.phone}><PhoneInput id="is-phone" value={f.phone} onChange={set('phone')} /></Field>
      </div>
      {busy && <div className="is-prog"><span style={{ width: Math.round((prog || 0) * 100) + '%' }} /><small>{prog < 1 ? `Yükleniyor… %${Math.round((prog || 0) * 100)}` : 'Kaydediliyor…'}</small></div>}
      <div className="pq-send">
        <small className="muted">En çok {MAX_IMG} fotoğraf + 1 video · günde {Math.max(1, Number(S.issue?.perDay) || 3)} bildirim · dosyalar {keepDays(S)} gün saklanır</small>
        <button className="btn primary" disabled={busy || prep > 0} onClick={send}><Icon n="send" s={16} />{busy ? 'Gönderiliyor…' : 'Bildirimi gönder'}</button>
      </div>
    </div>
  );
}
function MyIssues({ list }) {
  const [del, setDel] = useState(null);
  if (!list.length) return null;
  return (
    <section className="pq-mine is-mine">
      <h2 className="pq-h">Bildirimlerim <span className="num">{list.length}</span></h2>
      <ul className="pq-list">
        {list.map((q) => <IssueCard key={q.id} q={q} onDel={() => setDel(q)} />)}
      </ul>
      {del && <Confirm title="Bildirimi sil" text="Bildirim, fotoğrafları ve videosu silinir. Geri alınamaz." okLabel="Sil" tone="danger" onClose={() => setDel(null)}
        onOk={() => store.s.api.deleteIssue(del.id).then(() => toast('Bildirim silindi')).catch((e) => toast(e.message, 'bad'))} />}
    </section>
  );
}
function IssueCard({ q, onDel }) {
  const [t, setT] = useState('');
  const [busy, setBusy] = useState(false);
  const s = stOf(q.status);
  const closed = ['solved', 'closed'].includes(q.status);
  const send = async () => {
    const v = t.trim(); if (!v) return;
    setBusy(true);
    try { await store.s.api.msgIssue(q.id, { replies: [...(q.replies || []), { by: 'c', t: v.slice(0, 600), at: now() }].slice(-80), updatedAt: now(), seenAdmin: false }); setT(''); }
    catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  return (
    <li className="pq-card is-card">
      <div className="pq-card-h">
        <span className={'is-st tone-' + s[4]}>{s[0] === 'new' ? 'Bekliyor' : s[1]}</span>
        <small className="muted">#{q.no} · {dShort(q.createdAt)}{q.order ? ' · sipariş #' + q.order : ''}</small>
        <button className="icon-btn sm" onClick={onDel} aria-label="Bildirimi sil" title="Bildirimi sil"><Icon n="trash" s={15} /></button>
      </div>
      {q.prod && <b className="is-prod">{q.prod}</b>}
      <p className="pq-t">{q.text}</p>
      <Files files={q.files} size="sm" />
      {(q.replies || []).length > 0 && <div className="is-thread">{q.replies.map((r) => <Reply key={r.at} r={r} />)}</div>}
      {!(q.replies || []).some((r) => r.by !== 'c') && <p className="pq-wait"><Icon n="clock" s={14} />Bildiriminizi aldık, en kısa sürede bakıp dönüş yapacağız.</p>}
      {!closed && (
        <div className="is-add">
          <textarea rows="1" maxLength={600} value={t} onChange={(e) => setT(e.target.value)} placeholder="Ek bilgi / mesaj yazın…" />
          <button className="btn sm primary" disabled={busy || !t.trim()} onClick={send}><Icon n="send" s={15} />Gönder</button>
        </div>
      )}
    </li>
  );
}

// zil (mağaza): yönetici yanıtları
export function issueNotifs(list) {
  const out = [];
  for (const q of list || []) for (const r of q.replies || []) {
    if (r.by === 'c') continue;
    const s = r.s ? stOf(r.s) : null;
    out.push({ id: 'is' + q.id + r.at, at: r.at, ic: s ? s[3] : 'chat', tone: s?.[4] === 'ok' ? 'ok' : 'info', t: `Sorun bildirimi #${q.no} · ${s ? s[2] : 'Yanıtınız var'}`, s: r.t || q.prod || '', go: () => { try { history.pushState({ tab: 'sorun' }, '', '/magaza/sorun'); } catch {} store.set({ tab: 'sorun' }); } });
  }
  return out;
}

// =========================================================================================================
// Yönetim: Müşteriler > Sorun bildirimleri
const FILTERS = [['open', 'Açık'], ['new', 'Yanıt bekleyen'], ['done', 'Çözülen / kapanan'], ['all', 'Tümü']];
const isOpen = (x) => !['solved', 'closed'].includes(x.status);
const waiting = (x) => x.status === 'new' || (x.replies || []).slice(-1)[0]?.by === 'c';
export function IssueAdmin() {
  const { issues = [], openIssue } = useStore();
  const [f, setF] = useState('open');
  const [q, setQ] = useState('');
  const [del, setDel] = useState(null);
  const counts = useMemo(() => ({ all: issues.length, open: issues.filter(isOpen).length, new: issues.filter(waiting).length, done: issues.filter((x) => !isOpen(x)).length }), [issues]);
  const list = useMemo(() => issues.filter((x) => (f === 'all' || (f === 'open' ? isOpen(x) : f === 'new' ? waiting(x) : !isOpen(x))) && (!q || norm(`${x.name} ${x.phone} ${x.email} ${x.text} ${x.no} ${x.prod || ''} ${x.order || ''}`).includes(norm(q)))), [issues, f, q]);
  const cur = openIssue && issues.find((x) => x.id === openIssue);
  const menu = (e, x) => openMenu(e, [
    { label: 'Aç ve yanıtla', icon: 'chat', onClick: () => store.set({ openIssue: x.id }) },
    x.phone && { label: "WhatsApp'tan yaz", icon: 'wa', onClick: () => window.open(waLink(x.phone, `Merhaba ${x.name || ''}, #${x.no} numaralı sorun bildiriminiz hakkında yazıyorum.`), '_blank', 'noopener') },
    '-',
    { label: 'Bildirimi sil (dosyalarıyla)', icon: 'trash', danger: true, onClick: () => setDel(x) },
  ], '#' + x.no);
  return (
    <>
      <div className="search"><Icon n="search" s={18} /><input id="is-search" type="search" placeholder="Müşteri, telefon, ürün, açıklama…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips scroll">{FILTERS.map(([k, l]) => <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}{counts[k] ? <b>{counts[k]}</b> : null}</button>)}</div>
      {list.length === 0 ? <Empty icon="ask" title={f === 'open' ? 'Açık sorun bildirimi yok' : 'Bu filtrede bildirim yok'}><p>Müşteriler <b>/magaza/sorun</b> sayfasından fotoğraf / video ve açıklamayla sorun bildirir; burada yanıtlarsınız.</p></Empty> : (
        <ul className="pq-alist">
          {list.map((x) => {
            const s = stOf(x.status); const th = (x.files || []).find((y) => y.t === 'i'); const nv = (x.files || []).filter((y) => y.t === 'v').length; const last = (x.replies || []).slice(-1)[0];
            return (
              <li key={x.id}>
                <button className={'pq-arow' + (x.seenAdmin === false ? ' fresh' : '')} onClick={() => store.set({ openIssue: x.id })} onContextMenu={(e) => menu(e, x)}>
                  <span className="pq-arow-img">{th ? <img src={pic(th.k)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <Icon n={nv ? 'play' : 'ask'} s={22} />}{(x.files || []).length > 1 && <i>{(x.files || []).length}</i>}</span>
                  <span className="pq-arow-b">
                    <span className="pq-arow-t"><b>{x.name || x.email || 'Üye'}</b><small className="muted">#{x.no} · {dShort(x.createdAt)}{x.order ? ' · sipariş #' + x.order : ''}</small></span>
                    <span className="pq-arow-x">{x.prod ? <b>{x.prod} · </b> : null}{x.text}</span>
                    {last?.by === 'c' && <span className="pq-arow-r is-c"><Icon n="chat" s={13} />Müşteri yazdı: {String(last.t || '').slice(0, 60)}</span>}
                    {nv > 0 && <span className="pq-arow-r is-v"><Icon n="play" s={13} />Video var</span>}
                  </span>
                  <span className={'is-st tone-' + s[4]}>{s[1]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {cur && <IssueSheet q={cur} onClose={() => store.set({ openIssue: null })} onDelete={() => setDel(cur)} />}
      {del && <Confirm title="Bildirimi sil" text="Bildirim, müşterinin fotoğrafları / videosu ve sizin eklediğiniz fotoğraflar depodan kalıcı olarak silinir." okLabel="Sil" tone="danger" onClose={() => setDel(null)}
        onOk={() => { const id = del.id; store.set({ openIssue: null }); store.s.api.deleteIssue(id).then(() => toast('Bildirim ve dosyaları silindi')).catch((e) => toast(e.message, 'bad')); }} />}
    </>
  );
}
function IssueSheet({ q, onClose, onDelete }) {
  const { settings: S } = useStore();
  const last = [...(q.replies || [])].reverse().find((r) => r.by !== 'c' && r.s)?.s;
  const [s, setS] = useState(() => (q.status === 'new' ? 'received' : last || q.status));
  const [t, setT] = useState('');
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const inp = useRef(null);
  useEffect(() => { if (q.seenAdmin === false) store.s.api.updateIssue(q.id, { seenAdmin: true }).catch(() => {}); }, [q.id, (q.replies || []).length]);
  const left = Math.ceil(((q.createdAt || 0) + keepDays(S) * DAY - Date.now()) / DAY);
  const add = async (list) => {
    for (const x of [...list].slice(0, 6 - imgs.length)) {
      try { const b = await imageBlob(x, 1600, 0.82); setImgs((a) => [...a, { blob: b, url: URL.createObjectURL(b) }]); } catch (e) { toast(e.message, 'bad'); }
    }
  };
  const send = async () => {
    if (!t.trim() && s === (q.status === 'new' ? '' : q.status) && !imgs.length) return toast('Durum seçin ya da açıklama yazın', 'warn');
    setBusy(true);
    try {
      const up = imgs.length ? (await store.s.api.issueAdminUpload(q.id, imgs.map((x) => x.blob))).files : [];
      const r = { by: 'a', s, at: now(), ...(t.trim() ? { t: t.trim().slice(0, 1500) } : {}), ...(up.length ? { files: up } : {}) };
      await store.s.api.replyIssue(q.id, { replies: [...(q.replies || []), r].slice(-80), status: s, seenUser: false, seenAdmin: true, updatedAt: r.at });
      imgs.forEach((x) => URL.revokeObjectURL(x.url)); setImgs([]); setT('');
      toast('Yanıt gönderildi · müşteriye bildirim gitti');
    } catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  const st = stOf(q.status);
  return (
    <Sheet title={`Sorun bildirimi #${q.no}`} sub={dShort(q.createdAt)} onClose={onClose} wide cls="pq-sheet is-sheet"
      footer={<div className="pq-foot">
        <button className="btn ghost danger" onClick={onDelete}><Icon n="trash" s={16} />Sil</button>
        <span className="top-sp" />
        <button className="btn primary" disabled={busy} onClick={send}><Icon n="send" s={16} />{busy ? 'Gönderiliyor…' : 'Yanıtı gönder'}</button>
      </div>}>
      <div className="pq-who">
        <span className={'is-st tone-' + st[4]}>{st[1]}</span>
        <b>{q.name || 'Üye'}</b>
        {q.phone && <a className="chip" href={'tel:' + q.phone.replace(/[^\d+]/g, '')}><Icon n="phone" s={14} />{q.phone}</a>}
        {q.phone && <a className="chip" href={waLink(q.phone, `Merhaba ${q.name || ''}, #${q.no} numaralı sorun bildiriminiz hakkında yazıyorum.`)} target="_blank" rel="noopener"><Icon n="wa" s={14} />WhatsApp</a>}
        {q.email && <small className="muted">{q.email}</small>}
      </div>
      {(q.order || q.prod) && <p className="is-meta">{q.order && <span><Icon n="box" s={14} />Sipariş #{q.order}</span>}{q.prod && <span><Icon n="tag" s={14} />{q.prod}</span>}</p>}
      <div className="pq-ask">{q.text}</div>
      <Files files={q.files} size="lg" />
      {(q.files || []).length > 0 && <p className="fine">{left > 0 ? `Müşterinin dosyaları ${left} gün sonra depodan otomatik silinir; bildirimi silince hemen silinir.` : 'Dosyaların saklama süresi doldu.'}</p>}
      {(q.replies || []).length > 0 && <div className="pq-hist"><h3>Yazışma</h3><div className="is-thread">{q.replies.map((r) => <Reply key={r.at} r={r} admin />)}</div></div>}
      <div className="pq-rep">
        <h3>Yanıtla</h3>
        <div className="is-states">{IS_STATES.map(([k, l, , ic, tone]) => <button key={k} type="button" className={'tone-' + tone + (s === k ? ' on' : '')} onClick={() => setS(k)}><Icon n={ic} s={15} />{l}</button>)}</div>
        <Field label="Müşteriye açıklama" opt hint="Ne yapması gerektiğini adım adım yazabilirsiniz">
          <textarea id="is-reply" rows="4" maxLength={1500} value={t} onChange={(e) => setT(e.target.value)} placeholder={s === 'action' ? 'Örn. Cihazın arkasındaki sigortayı kontrol edin; fotoğraftaki gibi…' : s === 'shipping' ? 'Örn. Ürünü kutusuyla DHL ile alıcı ödemeli gönderin, adres: …' : 'Müşteriye yazın…'} />
        </Field>
        <div className="is-aimgs">
          {imgs.map((x, i) => <span key={x.url} className="pq-slot full"><img src={x.url} alt="" /><button type="button" className="pq-slot-x" onClick={() => setImgs((a) => { URL.revokeObjectURL(a[i].url); return a.filter((_, j) => j !== i); })} aria-label="Çıkar"><Icon n="x" s={14} /></button></span>)}
          {imgs.length < 6 && <button type="button" className="pq-slot add" onClick={() => inp.current?.click()}><Icon n="camera" s={20} /><b>Fotoğraf ekle</b><small>yol göstermek için</small></button>}
          <input ref={inp} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </div>
        <p className="fine">Müşteriye bildirim: <b>{stOf(s)[2]}</b>{t.trim() ? ' · ' + t.trim().slice(0, 60) : ''}</p>
      </div>
    </Sheet>
  );
}

// Ayarlar > Sorun bildirimi
export function IssueSettings({ d, set }) {
  return <>
    <p className="fine">Mağaza üyeleri <b>/magaza/sorun</b> adresinden sorunlu ürünün fotoğraflarını (en çok {MAX_IMG}) ve kısa videosunu (en çok 40 MB) açıklamayla gönderir. Bildirimler <b>Müşteriler › Sorun bildirimleri</b>’ne düşer; Telegram ve telefon bildirimi gelir. Kötüye kullanıma karşı: sadece e-postasını doğrulamış üyeler, aynı internet bağlantısından saatte en çok 6 gönderim, mağazaya günde en çok 150 bildirim. Sayfa şu an menüde yok.</p>
    <Toggle id="s-is" label="Sorun bildirimi açık" checked={d.issue?.on !== false} onChange={(v) => set('issue.on', v)} />
    <div className="row2">
      <Field label="Bir üye günde en çok kaç bildirim gönderebilir"><input id="s-is-day" type="number" min="1" max="20" value={d.issue?.perDay ?? 3} onChange={(e) => set('issue.perDay', Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></Field>
      <Field label="Dosyalar kaç gün saklansın" hint="Süre dolunca depodan otomatik silinir; bildirimi silince hemen silinir"><input id="s-is-keep" type="number" min="1" max="365" value={d.issue?.days ?? 45} onChange={(e) => set('issue.days', Math.max(1, Math.min(365, Number(e.target.value) || 1)))} /></Field>
    </div>
  </>;
}
