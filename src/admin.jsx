import { ShopHomeEditor, BrandLogosEditor } from './shophome.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, api, store, setCatalog, toast, openRequest } from './store.js';
import { Icon, Sheet, Thumb, Avatar, Field, Toggle, Empty, StatusPill, Confirm, PhoneInput, openMenu, copyText } from './ui.jsx';
import { waLink, links } from './route.js';
import { fmt, priceFor, catName, norm, resizeImage, withDefaults, cleanUsername, usernameOk, when, totals, fmtTotals } from './utils.js';
import { CATEGORY_NAMES, TYPE, LOGO_MARK } from './config.js';
import { readSheet, rowsToProducts, mergeCatalog } from './xlsx.js';
import { buildTree, cleanHtml } from './cats.js';
import { imageList } from './catalog.jsx';
import { rateLabel } from './listsheet.jsx';
import { syncNow } from './watch.js';

const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));

// =========================================================================
// Ürün düzenleme
export function ProductEdit({ p, onClose }) {
  const { catalog, settings: S } = useStore();
  const isNew = !p;
  const [f, setF] = useState(() => p ? { ...p } : { id: Math.max(0, ...catalog.map((x) => x.id)) + 1, k: '', c: 0, r: 0, w: null, n: '', cur: 'USD', s: 0, a: 1 });
  const [busy, setBusy] = useState(false);
  const [imgUrl, setImgUrl] = useState(p?.img && p.img !== 'fs' ? p.img : '');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const auto = priceFor({ ...f, w: null }, S, null, null).mine;
  const catOpts = useMemo(() => {
    const tree = buildTree(S, [...new Set(catalog.flatMap((x) => [x.c, x.c2]).filter((x) => x != null))]);
    const out = []; const walk = (ns, d) => ns.forEach((n) => { out.push([n.id, '\u2003'.repeat(d) + n.name]); walk(n.children, d + 1); });
    walk(tree.roots, 0); return out;
  }, [catalog, S]);
  const brands = useMemo(() => [...new Set(catalog.map((x) => x.b).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [catalog]);
  const [desc, setDesc] = useState(null);
  const [desc0, setDesc0] = useState('');
  const [preview, setPreview] = useState(false);
  const [newImg, setNewImg] = useState('');
  const [pcOk, setPcOk] = useState(false);
  useEffect(() => { if (!isNew) api().getDesc(f.id).then((h) => { setDesc(h || ''); setDesc0(h || ''); }); else setDesc(''); }, []);
  const siteFiles = [f.pi, ...(f.im || [])].filter(Boolean);
  const setFiles = (arr) => setF((x) => ({ ...x, pi: arr[0] || '', im: arr.slice(1) }));
  const fileOf = (v) => v.trim().split('?')[0].split('/').pop().replace(/^\d+X-/, '');

  async function save() {
    if (!f.n.trim()) return toast('Ürün adı boş olamaz', 'bad');
    setBusy(true);
    try {
      const rec = { ...f, n: f.n.trim(), r: num(f.r) || 0, w: num(f.w), s: Number(f.s) || 0, c: Number(f.c) || 0 };
      if (imgUrl.trim() && rec.img !== 'fs') rec.img = imgUrl.trim();
      if (!imgUrl.trim() && rec.img && rec.img !== 'fs') delete rec.img;
      delete rec._s; delete rec._t;
      // Toptan fiyat elle değiştirildiyse ya da "kontrol ettim" denildiyse fiyat uyarısı kalkar
      if (rec.pc && (pcOk || String(rec.w ?? '') !== String(p?.w ?? ''))) delete rec.pc;
      delete rec.nw; // yönetici gördü
      if (rec.so && rec.a) delete rec.so; // elle açıldıysa eşitleme artık karışmaz
      rec.t = (rec.t || '').split(',').map((x) => x.trim()).filter(Boolean).join(',');
      rec.b = (rec.b || '').trim();
      if (rec.c2 === '' || rec.c2 === rec.c) delete rec.c2; else if (rec.c2 != null) rec.c2 = Number(rec.c2);
      const list = isNew ? [rec, ...catalog] : catalog.map((x) => (x.id === rec.id ? rec : x));
      await api().saveCatalog(list.map(({ _s, _t, ...x }) => x));
      if (desc != null && desc !== desc0) await api().setDesc(rec.id, desc);
      setCatalog(list); toast('Ürün kaydedildi'); onClose();
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  async function upload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try {
      const data = await resizeImage(file, 640, 0.75);
      await api().setImage(f.id, data);
      const rec = { ...f, img: 'fs' };
      setF(rec); setImgUrl('');
      if (!isNew) { const list = catalog.map((x) => (x.id === rec.id ? { ...x, img: 'fs' } : x)); await api().saveCatalog(list.map(({ _s, _t, ...x }) => x)); setCatalog(list); }
      toast('Resim yüklendi');
    } catch (err) { toast('Resim yüklenemedi: ' + err.message, 'bad'); }
    setBusy(false);
  }
  async function removeImg() {
    if (f.img === 'fs') await api().setImage(f.id, null);
    setF((x) => { const { img, ...r } = x; return r; }); setImgUrl('');
  }

  return (
    <Sheet wide title={isNew ? 'Yeni ürün' : 'Ürünü düzenle'} sub={isNew ? '' : `#${f.id} · ${f.k}`} onClose={onClose} footer={<>
      <button className="btn ghost" onClick={onClose}>Vazgeç</button>
      <button className="btn primary" onClick={save} disabled={busy}><Icon n="check" s={16} />Kaydet</button>
    </>}>
      {f.pc && (
        <div className="banner warn">
          <Icon n="tag" />
          <div><b>Liste fiyatı değişti: {fmt(f.pc.r0, f.cur)} → {fmt(f.r, f.cur)}</b> ({when(f.pc.at)}). Toptan fiyatı kontrol edin; değiştirirseniz ya da onaylarsanız uyarı kalkar.</div>
          <label className="mini-check"><input type="checkbox" checked={pcOk} onChange={(e) => setPcOk(e.target.checked)} />Kontrol ettim, toptan fiyat doğru</label>
        </div>
      )}
      <div className="form-grid">
        <div className="img-edit">
          <Thumb p={{ ...f, img: f.img === 'fs' ? 'fs' : imgUrl || undefined }} size="lg" />
          <div className="img-btns">
            <label className="btn sm outline"><Icon n="upload" s={15} />Resim yükle<input type="file" accept="image/*" hidden onChange={upload} /></label>
            {(f.img || imgUrl) && <button className="btn sm ghost danger" onClick={removeImg}>Kaldır</button>}
          </div>
          <Field label="veya resim adresi (URL)"><input id="pe-img" placeholder="https://…" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} disabled={f.img === 'fs'} /></Field>
        </div>
        <div className="form-col">
          <Field label="Ürün adı"><textarea id="pe-name" rows="2" value={f.n} onChange={(e) => set('n', e.target.value)} /></Field>
          <div className="row2">
            <Field label="Stok kodu"><input id="pe-code" value={f.k} onChange={(e) => set('k', e.target.value)} /></Field>
            <Field label="Marka">
              <input id="pe-brand" list="pe-brands" value={f.b || ''} onChange={(e) => set('b', e.target.value)} />
              <datalist id="pe-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
            </Field>
          </div>
          <div className="row2">
            <Field label="Kategori">
              <select id="pe-cat" value={f.c} onChange={(e) => set('c', Number(e.target.value))}>
                {catOpts.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </Field>
            <Field label="2. kategori">
              <select id="pe-cat2" value={f.c2 ?? ''} onChange={(e) => set('c2', e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">—</option>
                {catOpts.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </Field>
          </div>
          <div className="row3">
            <Field label="Liste fiyatı"><input id="pe-r" inputMode="decimal" value={f.r ?? ''} onChange={(e) => set('r', e.target.value)} /></Field>
            <Field label="Toptan fiyat" hint={f.w == null || f.w === '' ? `Boş → otomatik ${fmt(auto, f.cur)}` : ''}><input id="pe-w" inputMode="decimal" placeholder="otomatik" value={f.w ?? ''} onChange={(e) => set('w', e.target.value === '' ? null : e.target.value)} /></Field>
            <Field label="Para birimi">
              <select id="pe-cur" value={f.cur} onChange={(e) => set('cur', e.target.value)}><option>USD</option><option>EUR</option><option value="TRY">TL</option></select>
            </Field>
          </div>
          <div className="row2">
            <Field label="Stok adedi"><input id="pe-s" inputMode="numeric" value={f.s} onChange={(e) => set('s', e.target.value)} /></Field>
            <Toggle id="pe-a" label="Aktif" hint="Pasif ürünler bayilere görünmez" checked={!!f.a} onChange={(v) => set('a', v ? 1 : 0)} />
          </div>
          <Field label="Gizli etiketler" hint="Sadece aramada kullanılır, bayiler görmez. Enter veya virgülle ekleyin.">
            <TagInput id="pe-tags" value={f.t || ''} onChange={(v) => set('t', v)} />
          </Field>
        </div>
      </div>

      <section className="pe-sec">
        <div className="pe-sec-h">
          <h3>Siteden gelen resimler <span className="muted">· {siteFiles.length}</span></h3>
          {f.u && <a className="link" href={S.catalog.siteUrl + f.u} target="_blank" rel="noopener">Sitede aç ↗</a>}
        </div>
        {siteFiles.length === 0 ? <p className="fine">Bu ürün için siteden resim yok.</p> : (
          <div className="img-strip">
            {imageList({ ...f, img: null }, S, 'sm').map((u, k) => (
              <div key={siteFiles[k] + k} className={'img-cell' + (k === 0 ? ' main' : '')}>
                <img src={u} alt="" loading="lazy" />
                <span className="img-cell-tools">
                  {k > 0 && <button type="button" onClick={() => { const a = [...siteFiles]; a.unshift(...a.splice(k, 1)); setFiles(a); }}>Ana resim</button>}
                  <button type="button" aria-label="Resmi kaldır" onClick={() => setFiles(siteFiles.filter((_, j) => j !== k))}><Icon n="x" s={13} /></button>
                </span>
                {k === 0 && <span className="img-main-badge">Ana</span>}
              </div>
            ))}
          </div>
        )}
        <div className="input-btn">
          <input id="pe-newimg" placeholder="Sitedeki resim adresi veya dosya adı (…_jbc2se.jpg)" value={newImg} onChange={(e) => setNewImg(e.target.value)} />
          <button type="button" className="btn sm outline" disabled={!newImg.trim()} onClick={() => { setFiles([...siteFiles, fileOf(newImg)]); setNewImg(''); }}>Ekle</button>
        </div>
      </section>

      <section className="pe-sec">
        <div className="pe-sec-h">
          <h3>Ürün açıklaması</h3>
          <button type="button" className="link" onClick={() => setPreview(!preview)}>{preview ? 'Normal görünüm' : 'HTML kodu'}</button>
        </div>
        {desc == null ? <p className="fine">Yükleniyor…</p> : preview
          ? <textarea id="pe-desc" rows="8" className="mono-in" value={desc} onChange={(e) => setDesc(e.target.value)} />
          : <RichText value={desc} onChange={setDesc} />}
      </section>
    </Sheet>
  );
}

// =========================================================================
// Müşteriler
export function Customers() {
  const { customers, settings: S, requests } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [add, setAdd] = useState(false);
  const [del, setDel] = useState(null);
  const intent = useStore((s) => s.intent);
  useEffect(() => { if (intent === 'newCustomer') { store.set({ intent: null }); setAdd(true); } }, [intent]);
  const pending = customers.filter((c) => c.pending);
  const custMenu = (e, c) => openMenu(e, [
    { label: 'Müşteriyi aç', icon: 'user', onClick: () => setOpen({ ...c, _tab: 'info' }) },
    { label: 'Özel fiyatlar', icon: 'tag', onClick: () => setOpen({ ...c, _tab: 'prices' }) },
    { label: 'Geçmiş talepler', icon: 'chat', onClick: () => setOpen({ ...c, _tab: 'hist' }) },
    '-',
    c.phone && { label: "WhatsApp'tan yaz", icon: 'wa', onClick: () => window.open(waLink(c.phone, `Merhaba ${c.name || ''},`), '_blank', 'noopener') },
    c.phone && { label: 'Telefonu kopyala', icon: 'copy', hint: c.phone, onClick: () => copyText(c.phone) },
    { label: 'Kullanıcı adını kopyala', icon: 'copy', hint: '@' + c.username, onClick: () => copyText(c.username) },
    '-',
    c.active === false
      ? { label: 'Hesabı aktif yap', icon: 'check', onClick: () => store.s.api.updateUser(c.uid, { active: true }).then(() => toast('Hesap aktif')) }
      : { label: 'Hesabı pasif yap', icon: 'eyeoff', danger: true, onClick: () => store.s.api.updateUser(c.uid, { active: false }).then(() => toast('Hesap pasif; artık giriş yapamaz')) },
    { label: 'Müşteriyi tamamen sil', icon: 'trash', danger: true, onClick: () => setDel(c) },
  ], c.name || c.username);
  const list = customers.filter((c) => !c.pending && (!q || norm(`${c.name} ${c.shop} ${c.username} ${c.phone}`).includes(norm(q))))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
  const openCount = (uid) => requests.filter((r) => r.uid === uid && ['new', 'offered', 'accepted', 'ready'].includes(r.status)).length;
  return (
    <div className="page">
      <div className="page-h">
        <h1 className="page-t">Müşteriler <span className="muted">· {customers.length - pending.length}</span></h1>
        <button className="btn primary" onClick={() => setAdd(true)}><Icon n="plus" s={16} />Yeni müşteri</button>
      </div>
      {pending.length > 0 && <PendingList list={pending} />}
      <div className="search"><Icon n="search" s={18} /><input id="cust-search" type="search" placeholder="İsim, dükkan, telefon…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.length === 0 ? <Empty icon="users" title="Henüz müşteri yok">“Yeni müşteri” ile toptancılarınıza kullanıcı adı ve şifre oluşturun.</Empty> : (
        <ul className="ulist">
          {list.map((c) => {
            const tier = S.tiers.find((t) => t.id === c.tier);
            const oc = openCount(c.uid);
            return (
              <li key={c.uid}>
                <button className={'ucard' + (c.active === false ? ' inactive' : '')} onClick={() => setOpen(c)} onContextMenu={(e) => custMenu(e, c)}>
                  <Avatar u={c} size={46} />
                  <span className="ucard-b">
                    <strong>{c.name || c.username}</strong>
                    <span className="muted">{c.shop}{c.phone ? ' · ' + c.phone : ''}</span>
                    <span className="ucard-tags">
                      <span className="tag">@{c.username}</span>
                      {tier && <span className="tag">{tier.name}{tier.pct ? ` −%${tier.pct}` : ''}</span>}
                      {Number(c.extraPct) ? <span className="tag">ek −%{c.extraPct}</span> : null}
                      {c.active === false && <span className="tag bad">Pasif</span>}
                      {(c.stats?.noshow || 0) >= S.requests.noShowWarn && <span className="tag warn">{c.stats.noshow} kez gelmedi</span>}
                    </span>
                  </span>
                  <span className="ucard-n">{oc > 0 && <b className="badge soft">{oc} açık</b>}<span className="muted num">{c.stats?.done || 0} alım</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && <CustomerSheet c={open} onClose={() => setOpen(null)} />}
      {add && <NewCustomer onClose={() => setAdd(false)} />}
      {del && <DeleteCustomer c={del} onClose={() => setDel(null)} onDone={() => { setDel(null); setOpen(null); }} />}
    </div>
  );
}

function NewCustomer({ onClose }) {
  const { settings: S, api: A } = useStore();
  const [f, setF] = useState({ username: '', password: '', name: '', shop: '', phone: '', tier: S.tiers[0]?.id || '', extraPct: 0 });
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function create() {
    setErr('');
    const username = cleanUsername(f.username);
    if (!usernameOk(username)) return setErr('Kullanıcı adı 3–30 karakter olmalı; harf, rakam, nokta, tire kullanın (Türkçe karakter otomatik düzeltilir).');
    if (f.password.length < 6) return setErr('Şifre en az 6 karakter olmalı.');
    try {
      await A.createUser({ ...f, username, extraPct: Number(f.extraPct) || 0 });
      setDone({ username, password: f.password });
    } catch (e) { setErr(e.message); }
  }
  const share = done && `${S.brand.appName} giriş bilgileriniz\nKullanıcı adı: ${done.username}\nŞifre: ${done.password}\nAdres: ${location.origin + location.pathname}`;
  const genPw = () => set('password', Math.random().toString(36).slice(2, 8));
  if (done) return (
    <Sheet title="Müşteri oluşturuldu" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Tamam</button>}>
      <p>Bu bilgileri müşterinize WhatsApp'tan gönderebilirsiniz:</p>
      <pre className="share-box" id="share-box">{share}</pre>
      <button className="btn outline" onClick={() => navigator.clipboard?.writeText(share).then(() => toast('Kopyalandı'), () => { const r = document.createRange(); r.selectNode(document.getElementById('share-box')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Metni seçtim, kopyalayın'); })}>Kopyala</button>
    </Sheet>
  );
  return (
    <Sheet title="Yeni müşteri" sub="Toptancınız bu bilgilerle giriş yapar" onClose={onClose} footer={<>
      <button className="btn ghost" onClick={onClose}>Vazgeç</button>
      <button className="btn primary" onClick={create}><Icon n="check" s={16} />Oluştur</button>
    </>}>
      <div className="form-col">
        <div className="row2">
          <Field label="Ad soyad"><input id="nc-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Dükkan adı"><input id="nc-shop" value={f.shop} onChange={(e) => set('shop', e.target.value)} /></Field>
        </div>
        <div className="row2">
          <Field label="Kullanıcı adı" hint={f.username && cleanUsername(f.username) !== f.username ? 'Kaydedilecek: ' + cleanUsername(f.username) : ''}><input id="nc-user" autoCapitalize="none" value={f.username} onChange={(e) => set('username', e.target.value)} /></Field>
          <Field label="Şifre"><div className="input-btn"><input id="nc-pw" value={f.password} onChange={(e) => set('password', e.target.value)} /><button type="button" className="btn sm ghost" onClick={genPw}>Üret</button></div></Field>
        </div>
        <div className="row3">
          <Field label="Telefon"><PhoneInput id="nc-phone" value={f.phone} onChange={(v) => set('phone', v)} /></Field>
          <Field label="Kademe"><select id="nc-tier" value={f.tier} onChange={(e) => set('tier', e.target.value)}>{S.tiers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.pct ? ` (−%${t.pct})` : ''}</option>)}</select></Field>
          <Field label="Ek indirim %"><input id="nc-extra" inputMode="decimal" value={f.extraPct} onChange={(e) => set('extraPct', e.target.value)} /></Field>
        </div>
        {err && <p className="err">{err}</p>}
      </div>
    </Sheet>
  );
}

export function CustomerSheet({ c, onClose }) {
  const [delC, setDelC] = useState(false);
  const { settings: S, requests, api: A, catalog, customers } = useStore();
  const live = customers.find((x) => x.uid === c.uid) || c;
  const [tab, setTab] = useState(c._tab || 'info');
  const [f, setF] = useState({ name: live.name || '', shop: live.shop || '', phone: live.phone || '', tier: live.tier || '', extraPct: live.extraPct || 0, active: live.active !== false, password: '' });
  const [note, setNote] = useState('');
  const [prices, setPrices] = useState(null);
  const [pq, setPq] = useState('');
  useEffect(() => { A.getNote(c.uid).then(setNote); A.getUserPrices(c.uid).then(setPrices); }, [c.uid]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const hist = requests.filter((r) => r.uid === c.uid);
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const matches = pq.length >= 2 ? catalog.filter((p) => norm(pq).split(/\s+/).every((t) => p._s.includes(t))).slice(0, 8) : [];

  async function saveInfo() {
    const patch = { name: f.name, shop: f.shop, phone: f.phone, tier: f.tier, extraPct: Number(f.extraPct) || 0, active: f.active };
    if (f.password && A.mode === 'demo') patch.password = f.password;
    await A.updateUser(c.uid, patch); await A.setNote(c.uid, note); toast('Müşteri kaydedildi');
  }
  async function savePrices() {
    const clean = {}; for (const [k, v] of Object.entries(prices)) if (v !== '' && v != null && !isNaN(Number(v))) clean[k] = Number(v);
    await A.setUserPrices(c.uid, clean); setPrices(clean); toast('Özel fiyatlar kaydedildi');
  }
  const userCtx = { ...live, ...f };

  return (
    <Sheet wide title={live.name || live.username} sub={`@${live.username} · ${live.shop || ''}`} onClose={onClose}
      footer={tab === 'info' ? <><button className="btn ghost danger" onClick={() => setDelC(true)}><Icon n="trash" s={16} />Müşteriyi sil</button><button className="btn primary" onClick={saveInfo}><Icon n="check" s={16} />Kaydet</button></> : tab === 'prices' ? <button className="btn primary" onClick={savePrices} disabled={!prices}><Icon n="check" s={16} />Fiyatları kaydet</button> : null}>
      <div className="cust-head">
        <div className="avatar-edit sm">
          <Avatar u={live} size={64} />
          {live.photo && <button className="avatar-del" onClick={() => api().updateUser(live.uid, { photo: '' }).then(() => toast('Müşterinin fotoğrafı kaldırıldı'))} aria-label="Fotoğrafı kaldır" title="Fotoğrafı kaldır"><Icon n="trash" s={14} /></button>}
        </div>
        <div className="cust-kpis">
          <div><b className="num">{live.stats?.done || 0}</b><span>teslim aldı</span></div>
          <div className={(live.stats?.noshow || 0) >= S.requests.noShowWarn ? 'warn' : ''}><b className="num">{live.stats?.noshow || 0}</b><span>gelmedi</span></div>
          <div><b className="num">{hist.filter((r) => ['new', 'offered', 'accepted', 'ready'].includes(r.status)).length}</b><span>açık talep</span></div>
        </div>
      </div>
      <div className="tabs">
        {[['info', 'Bilgiler'], ['prices', 'Özel fiyatlar'], ['hist', `Geçmiş (${hist.length})`]].map(([k, l]) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'info' && (
        <div className="form-col">
          <div className="row2">
            <Field label="Ad soyad"><input id="cs-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Dükkan"><input id="cs-shop" value={f.shop} onChange={(e) => set('shop', e.target.value)} /></Field>
          </div>
          <div className="row3">
            <Field label="Telefon"><PhoneInput id="cs-phone" value={f.phone} onChange={(v) => set('phone', v)} /></Field>
            <Field label="Kademe"><select id="cs-tier" value={f.tier} onChange={(e) => set('tier', e.target.value)}><option value="">—</option>{S.tiers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.pct ? ` (−%${t.pct})` : ''}</option>)}</select></Field>
            <Field label="Ek indirim %"><input id="cs-extra" inputMode="decimal" value={f.extraPct} onChange={(e) => set('extraPct', e.target.value)} /></Field>
          </div>
          <Toggle id="cs-active" label="Hesap aktif" hint="Kapatırsanız müşteri giriş yapamaz" checked={f.active} onChange={(v) => set('active', v)} />
          {A.mode === 'demo'
            ? <Field label="Yeni şifre" hint="Boş bırakırsanız değişmez"><input id="cs-pw" value={f.password} onChange={(e) => set('password', e.target.value)} /></Field>
            : <p className="fine">Şifre sıfırlama: Firebase konsolu → Authentication → kullanıcı → “Şifreyi sıfırla” yerine en pratiği hesabı pasif yapıp yeni kullanıcı açmaktır.</p>}
          <Field label="Özel not (sadece siz görürsünüz)"><textarea id="cs-note" rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Peşin çalışır, Cuma günleri gelir" /></Field>
        </div>
      )}
      {tab === 'prices' && (
        !prices ? <p className="muted">Yükleniyor…</p> : (
          <div className="form-col">
            <p className="fine">Buraya eklediğiniz ürünlerde bu müşteri, kademe ve indirimlerden bağımsız olarak yazdığınız fiyatı görür.</p>
            <div className="search sm"><Icon n="search" s={16} /><input id="cs-psearch" placeholder="Ürün ekle: ad veya kod…" value={pq} onChange={(e) => setPq(e.target.value)} /></div>
            {matches.length > 0 && (
              <ul className="mini-list">
                {matches.map((p) => <li key={p.id}><button onClick={() => { setPrices({ ...prices, [p.id]: priceFor(p, S, userCtx, null).mine ?? p.r }); setPq(''); }}><span>{p.n}</span><code>{p.k}</code><Icon n="plus" s={15} /></button></li>)}
              </ul>
            )}
            {Object.keys(prices).length === 0 ? <Empty icon="tag" title="Özel fiyat yok" /> : (
              <table className="itable">
                <thead><tr><th>Ürün</th><th className="r hide-s">Liste</th><th className="r">Normal</th><th className="r">Özel</th><th /></tr></thead>
                <tbody>
                  {Object.entries(prices).map(([id, v]) => {
                    const p = byId.get(Number(id)); if (!p) return null;
                    return (
                      <tr key={id}>
                        <td className="it-name"><span>{p.n}</span><code>{p.k}</code></td>
                        <td className="r num muted hide-s">{fmt(p.r, p.cur)}</td>
                        <td className="r num muted">{fmt(priceFor(p, S, userCtx, null).mine, p.cur)}</td>
                        <td className="r"><input className="num-in" inputMode="decimal" value={v} onChange={(e) => setPrices({ ...prices, [id]: e.target.value.replace(',', '.') })} aria-label="Özel fiyat" /></td>
                        <td><button className="icon-btn sm" onClick={() => { const n = { ...prices }; delete n[id]; setPrices(n); }} aria-label="Kaldır"><Icon n="trash" s={15} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      )}
      {tab === 'hist' && (
        hist.length === 0 ? <Empty icon="chat" title="Henüz talep yok" /> : (
          <ul className="hist">
            {hist.map((r) => (
              <li key={r.id}><button onClick={() => { onClose(); openRequest(r.id); }}>
                <span><b>{TYPE[r.type]}</b> <span className="muted">#{r.no} · {when(r.createdAt)}</span></span>
                <span className="hist-r"><span className="num">{fmtTotals(totals(r.items, 'offer'))}</span><StatusPill status={r.status} /></span>
              </button></li>
            ))}
          </ul>
        )
      )}
      {delC && <DeleteCustomer c={c} onClose={() => setDelC(false)} onDone={() => { setDelC(false); onClose(); }} />}
    </Sheet>
  );
}

// =========================================================================
// Ayarlar
const SECTIONS = [['genel', 'Genel'], ['anasayfa', 'Bayi ana sayfası'], ['magazaana', 'Mağaza ana sayfası'], ['markalar', 'Markalar'], ['fiyat', 'Fiyatlandırma'], ['kademe', 'Kademeler'], ['katalog', 'Katalog'], ['talep', 'Talepler'], ['dukkan', 'Dükkan'], ['magaza', 'Online mağaza'], ['kategori', 'Kategoriler'], ['veri', 'Veri'], ['hesap', 'Hesabım']];
// hangi ayar hangi bölümde (kaydedilmemiş değişiklik noktası için)
const SEC_KEYS = { genel: ['brand', 'features'], anasayfa: ['home'], magazaana: ['shopHome'], markalar: ['brandLogos'], fiyat: ['pricing'], kademe: ['tiers'], katalog: ['catalog'], talep: ['requests'], dukkan: ['shop', 'access'], magaza: ['orders', 'access', 'shop'], kategori: ['categories'] };

export function Settings() {
  const { settings, api: A, catalog, user } = useStore();
  const [d, setD] = useState(() => structuredClone(settings));
  const [sec, setSec] = useState('genel');
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(settings);
  const set = (path, v) => setD((x) => { const n = structuredClone(x); const ks = path.split('.'); let o = n; ks.slice(0, -1).forEach((k) => (o = o[k] = o[k] ?? {})); o[ks.at(-1)] = v; return n; });
  const sample = catalog.find((p) => p.w == null && p.r >= 20) || catalog[0];
  const secDirty = (k) => (SEC_KEYS[k] || []).some((key) => JSON.stringify(d[key]) !== JSON.stringify(settings[key]));
  // kaydetmeden sayfadan çıkılırsa uyar
  useEffect(() => { if (!dirty) return; const h = (e) => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', h); return () => removeEventListener('beforeunload', h); }, [dirty]);

  async function save() {
    setBusy(true);
    try { const clean = withDefaults(d); await A.saveSettings(clean); store.set({ settings: clean }); toast('Ayarlar kaydedildi'); }
    catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  async function pickFile(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    try {
      const rows = await readSheet(file);
      const { items: incoming, descs } = rowsToProducts(rows);
      if (!incoming.length) throw new Error('Dosyada ürün satırı bulunamadı (urun_id veya “Ürün ID” sütunu gerekli)');
      const res = mergeCatalog(catalog.map(({ _s, _t, ...p }) => p), incoming);
      for (const [from, to] of Object.entries(res.idMap)) if (descs[from] != null) { descs[to] = descs[from]; delete descs[from]; }
      // "Kategoriler" sayfası varsa yeni kategori adlarını da al
      let catNames = {};
      try { for (const r of await readSheet(file, 'Kategoriler')) { const id = Number(r['Id']); const nm = String(r['Kategori Adı'] ?? '').replace(/^_+/, '').trim(); if (id && nm) catNames[id] = nm; } } catch {}
      setImp({ ...res, descs, catNames, file: file.name, rows: incoming.length, fields: Object.keys(Object.assign({}, ...incoming.slice(0, 50))) });
    } catch (err) { toast(err.message, 'bad'); }
  }
  async function applyImport() {
    setBusy(true);
    try {
      await A.saveCatalog(imp.list); setCatalog(imp.list);
      // bilinmeyen kategori numaralarına dosyadaki adı ver (elle verilmiş adlara dokunma)
      const used = new Set(imp.list.flatMap((p) => [p.c, p.c2]).filter(Boolean));
      const add = {}; for (const [id, nm] of Object.entries(imp.catNames || {})) if (used.has(Number(id)) && !settings.categories?.[id]?.name && !CATEGORY_NAMES[id]) add[id] = { ...(settings.categories?.[id] || {}), name: nm };
      if (Object.keys(add).length) { const S2 = { ...settings, categories: { ...settings.categories, ...add } }; await A.saveSettings(S2); store.set({ settings: S2 }); }
      if (Object.keys(imp.descs).length) await A.saveDescs({ ...(await Promise.resolve(A.loadDescMap ? A.loadDescMap() : {})), ...imp.descs });
      toast(`Katalog güncellendi: ${imp.added} yeni, ${imp.updated} değişen`); setImp(null);
    }
    catch (e) { toast('Kaydedilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  async function logo(e) {
    const file = e.target.files?.[0]; if (!file) return;
    set('brand.logo', await resizeImage(file, 160, 0.85, true));
  }

  const catRows = useMemo(() => {
    const tree = buildTree(withDefaults({ ...settings, categories: {} }), [...new Set(catalog.flatMap((x) => [x.c, x.c2]).filter((x) => x != null))]);
    const cnt = new Map(); for (const p of catalog) for (const c of new Set([...tree.ancestors(p.c), ...(p.c2 != null ? tree.ancestors(p.c2) : [])])) cnt.set(c, (cnt.get(c) || 0) + 1);
    const out = []; const walk = (ns, dd) => ns.forEach((n) => { out.push([n.id, n.name, dd, cnt.get(n.id) || 0]); walk(n.children, dd + 1); });
    walk(tree.roots, 0); return out;
  }, [catalog]);

  return (
    <div className="page settings">
      <div className="page-h">
        <h1 className="page-t">Ayarlar</h1>
        <span className="muted">{A.mode === 'demo' ? 'Demo modu · veriler bu tarayıcıda' : 'Firebase’e bağlı'}</span>
      </div>
      <div className="chips scroll sec-nav">{SECTIONS.map(([k, l]) => <button key={k} className={'chip' + (sec === k ? ' on' : '') + (secDirty(k) ? ' dirty' : '')} onClick={() => setSec(k)}>{l}{secDirty(k) && <i className="dirty-dot" aria-label="kaydedilmedi" />}</button>)}</div>

      {sec === 'hesap' ? <Profile embedded /> : <div className="set-card">
        <div className={'set-head' + (dirty ? ' dirty' : '')}>
          <h2>{SECTIONS.find((x) => x[0] === sec)?.[1]}</h2>
          {dirty && <span className="unsaved"><i className="dirty-dot" />Kaydedilmedi{!secDirty(sec) && ' (başka bölümde)'}</span>}
          {sec !== 'veri' && <>
            {dirty && <button className="btn sm ghost" onClick={() => setD(structuredClone(settings))}>Geri al</button>}
            <button className="btn sm primary" onClick={save} disabled={busy || !dirty}><Icon n="check" s={15} />{busy ? 'Kaydediliyor…' : dirty ? 'Kaydet' : 'Kaydedildi'}</button>
          </>}
        </div>
        {sec === 'genel' && <>
          <div className="row2">
            <Field label="Uygulama adı"><input id="s-name" value={d.brand.appName} onChange={(e) => set('brand.appName', e.target.value)} /></Field>
            <Field label="Alt başlık"><input id="s-tag" value={d.brand.tagline} onChange={(e) => set('brand.tagline', e.target.value)} /></Field>
          </div>
          <div className="row3">
            <Field label="Ana renk"><div className="color-in"><input id="s-accent" type="color" value={d.brand.accent} onChange={(e) => set('brand.accent', e.target.value)} /><code>{d.brand.accent}</code></div></Field>
            <Field label="Toptan fiyat rengi"><div className="color-in"><input id="s-price" type="color" value={d.brand.priceAccent} onChange={(e) => set('brand.priceAccent', e.target.value)} /><code>{d.brand.priceAccent}</code></div></Field>
            <Field label="Tema"><select id="s-theme" value={d.brand.theme} onChange={(e) => set('brand.theme', e.target.value)}><option value="auto">Cihaza göre</option><option value="light">Açık</option><option value="dark">Koyu</option></select></Field>
          </div>
          <Field label="Logo">
            <div className="logo-in">
              <img src={d.brand.logo || LOGO_MARK} alt="" />
              <label className="btn sm outline"><Icon n="upload" s={15} />Yükle<input type="file" accept="image/*" hidden onChange={logo} /></label>
              {d.brand.logo && <button className="btn sm ghost" onClick={() => set('brand.logo', '')}>ERT Mobile logosuna dön</button>}
            </div>
          </Field>
          <h3>Özellikler</h3>
          <Toggle id="s-signup" label="Bayiler kendileri üye olabilsin" hint="Giriş ekranında “Bayi olarak üye olun” çıkar; siz onaylayana kadar giriş yapamazlar" checked={d.access.allowSignup} onChange={(v) => set('access.allowSignup', v)} />
          <Toggle id="s-photo" label="Profil fotoğrafı" hint="Müşteriler kendi fotoğrafını ekleyebilir" checked={d.features.profilePhoto} onChange={(v) => set('features.profilePhoto', v)} />
          <Toggle id="s-hist" label="Müşteri geçmiş istatistikleri" hint="Profilde alım / gelmedi sayıları görünür" checked={d.features.history} onChange={(v) => set('features.history', v)} />
        </>}

        {sec === 'fiyat' && <>
          <p className="fine">Ürünün kendi toptan fiyatı varsa o kullanılır. Yoksa aşağıdaki kurala göre hesaplanır. Sonra müşterinin kademe ve ek indirimi uygulanır. Müşteriye özel fiyat her şeyin önündedir.</p>
          <div className="row3">
            <Field label="Toptan fiyatı olmayan ürünler"><select id="s-nw" value={d.pricing.noWholesale} onChange={(e) => set('pricing.noWholesale', e.target.value)}><option value="discount">Listeden % indirimle hesapla</option><option value="ask">“Fiyat sorun” göster</option></select></Field>
            <Field label="Varsayılan indirim %"><input id="s-disc" inputMode="decimal" value={d.pricing.discountPct} onChange={(e) => set('pricing.discountPct', num(e.target.value) ?? 0)} disabled={d.pricing.noWholesale === 'ask'} /></Field>
            <Field label="Yuvarlama"><select id="s-round" value={d.pricing.roundStep} onChange={(e) => set('pricing.roundStep', Number(e.target.value))}><option value="0.01">Kuruşlu (0,01)</option><option value="0.5">0,50’ye</option><option value="1">Tam sayıya</option></select></Field>
          </div>
          <div className="row3">
            <Field label="Teklifte −/+ adımı (USD)"><select id="s-step" value={d.pricing.adjustStep} onChange={(e) => set('pricing.adjustStep', Number(e.target.value))}><option value="0.5">0,5</option><option value="1">1</option><option value="5">5</option><option value="10">10</option></select></Field>
          </div>
          <Toggle id="s-retail" label="Liste fiyatını göster" hint="Üstü çizili perakende fiyat" checked={d.pricing.showRetail} onChange={(v) => set('pricing.showRetail', v)} />
          <Toggle id="s-save" label="Sepette avantaj tutarını göster" checked={d.pricing.showSaving} onChange={(v) => set('pricing.showSaving', v)} />
          <Toggle id="s-showvat" label="Toplamın altında KDV bilgisini göster" hint="Sepet, liste linki, liste resmi ve tekliflerde toplamın altında küçük bir satır: KDV ve KDV dahil toplam" checked={d.pricing.showVat !== false} onChange={(v) => set('pricing.showVat', v)} />
          <Field label="KDV oranı (%)" hint="Ürün fiyatlarına eklenmez; sadece toplamın altında “KDV” ve “KDV dahil toplam” olarak bilgi verilir. 0 yazarsanız gösterilmez."><input id="s-vat" inputMode="decimal" value={d.pricing.vatPct ?? 20} onChange={(e) => set('pricing.vatPct', e.target.value === '' ? 0 : Number(e.target.value.replace(',', '.')) || 0)} /></Field>
          <h3>TL karşılığı</h3>
          <RateInfo />
          <Field label="Elle kur (isteğe bağlı)" hint="Boş bırakın: Harem Altın dolar satış kuru kullanılır. Doldurursanız onun yerine bu kur kullanılır."><input id="s-rate" inputMode="decimal" placeholder="ör. 41,95" value={d.pricing.manualRate ?? ''} onChange={(e) => set('pricing.manualRate', e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} /></Field>
          <Toggle id="s-tl" label="TL karşılığını bayilere ve vitrine de göster" hint="Kapalıyken sadece siz görürsünüz. Liste resmine eklemek her listede ayrıca seçilir." checked={d.pricing.showTL} onChange={(v) => set('pricing.showTL', v)} />
          {sample && <div className="preview-box"><span className="eyebrow">Örnek</span><span>{sample.n}</span><span className="num">Liste {fmt(sample.r, sample.cur)} → Toptan <b>{fmt(priceFor(sample, withDefaults(d), null, null).mine, sample.cur)}</b></span></div>}
        </>}

        {sec === 'kademe' && <>
          <p className="fine">Her müşteriye bir kademe atanır. Kademe indirimi, toptan fiyatın üzerine uygulanır.</p>
          <div className="tier-list">
            {d.tiers.map((t, i) => (
              <div key={t.id} className="tier-row">
                <input id={'tier-n-' + i} aria-label="Kademe adı" value={t.name} onChange={(e) => set('tiers', d.tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <div className="pct-in"><span>−%</span><input id={'tier-p-' + i} aria-label="İndirim yüzdesi" inputMode="decimal" value={t.pct} onChange={(e) => set('tiers', d.tiers.map((x, j) => (j === i ? { ...x, pct: num(e.target.value) ?? 0 } : x)))} /></div>
                <button className="icon-btn sm" disabled={d.tiers.length <= 1} onClick={() => set('tiers', d.tiers.filter((_, j) => j !== i))} aria-label="Sil"><Icon n="trash" s={15} /></button>
              </div>
            ))}
          </div>
          <button className="btn sm outline" onClick={() => set('tiers', [...d.tiers, { id: 'k' + Date.now().toString(36), name: 'Yeni kademe', pct: 0 }])}><Icon n="plus" s={15} />Kademe ekle</button>
        </>}

        {sec === 'katalog' && <>
          <div className="row3">
            <Field label="Stok gösterimi"><select id="s-stock" value={d.catalog.stockMode} onChange={(e) => set('catalog.stockMode', e.target.value)}><option value="badge">Stokta / Az kaldı / Yok</option><option value="number">Adet olarak</option><option value="hidden">Gizle</option></select></Field>
            <Field label="“Az kaldı” sınırı"><input id="s-low" inputMode="numeric" value={d.catalog.lowStock} onChange={(e) => set('catalog.lowStock', Number(e.target.value) || 0)} /></Field>
            <Field label="Sayfa başına ürün"><select id="s-page" value={d.catalog.pageSize} onChange={(e) => set('catalog.pageSize', Number(e.target.value))}><option>30</option><option>60</option><option>120</option></select></Field>
          </div>
          <Toggle id="s-inactive" label="Pasif ürünleri de göster" checked={d.catalog.showInactive} onChange={(v) => set('catalog.showInactive', v)} />
          <Toggle id="s-oos" label="Stokta olmayanları gizle" checked={d.catalog.hideOutOfStock} onChange={(v) => set('catalog.hideOutOfStock', v)} />
          <Toggle id="s-tags" label="Gizli etiketleri aramada kullan" hint="Bayiler etiketleri görmez ama “jbc uç” gibi aramalarda ürün bulunur" checked={d.catalog.searchTags} onChange={(v) => set('catalog.searchTags', v)} />
          <Toggle id="s-brand" label="Markayı göster" checked={d.catalog.showBrand} onChange={(v) => set('catalog.showBrand', v)} />
          <Toggle id="s-desc" label="Ürün açıklamasını göster" hint="Siteden gelen açıklama ürün detayında görünür" checked={d.catalog.showDescription} onChange={(v) => set('catalog.showDescription', v)} />
          <h3>Ürün resimleri</h3>
          <p className="fine">Resimler sitenizden (PlatinMarket) gösterilir, Firebase’de yer kaplamaz. Yeni eklenen ürünlerin resimlerini Ayarlar → Veri → “Resimleri siteden eşle” ile çekebilirsiniz. Elle yüklediğiniz resim her zaman önceliklidir.</p>
          <div className="row2">
            <Field label="Liste resmi adresi" hint="{pi} = siteden eşlenen dosya adı"><input id="s-imgt" value={d.catalog.imageThumb} onChange={(e) => set('catalog.imageThumb', e.target.value)} /></Field>
            <Field label="Büyük resim adresi"><input id="s-imgl" value={d.catalog.imageLarge} onChange={(e) => set('catalog.imageLarge', e.target.value)} /></Field>
          </div>
        </>}

        {sec === 'talep' && <>
          <Toggle id="s-res" label="“Hazırlayın, geliyorum” butonu" checked={d.requests.allowReserve} onChange={(v) => set('requests.allowReserve', v)} />
          <Toggle id="s-quote" label="“Fiyat sor” butonu" checked={d.requests.allowQuote} onChange={(v) => set('requests.allowQuote', v)} />
          <Toggle id="s-msg" label="Sepetsiz genel mesaj" checked={d.requests.allowMessage} onChange={(v) => set('requests.allowMessage', v)} />
          <Toggle id="s-pick" label="“Ne zaman gelirsiniz?” sorusu" checked={d.requests.askPickupTime} onChange={(v) => set('requests.askPickupTime', v)} />
          <Field label="Gelmedi uyarı sınırı" hint="Bu sayıya ulaşan müşteri kartında uyarı çıkar"><input id="s-ns" inputMode="numeric" value={d.requests.noShowWarn} onChange={(e) => set('requests.noShowWarn', Number(e.target.value) || 1)} /></Field>
          <div className="row2">
            <Field label="Hazır cevaplar (yönetici)" hint="Her satır bir buton"><textarea id="s-aq" rows="5" value={d.requests.adminQuick.join('\n')} onChange={(e) => set('requests.adminQuick', e.target.value.split('\n'))} onBlur={(e) => set('requests.adminQuick', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></Field>
            <Field label="Hazır cevaplar (müşteri)" hint="Her satır bir buton"><textarea id="s-uq" rows="5" value={d.requests.userQuick.join('\n')} onChange={(e) => set('requests.userQuick', e.target.value.split('\n'))} onBlur={(e) => set('requests.userQuick', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></Field>
          </div>
        </>}

        {sec === 'dukkan' && <>
          <div className="row2">
            <Field label="Dükkan adı"><input id="s-shop" value={d.shop.name} onChange={(e) => set('shop.name', e.target.value)} /></Field>
            <Field label="Çalışma saatleri"><input id="s-hours" value={d.shop.hours} onChange={(e) => set('shop.hours', e.target.value)} /></Field>
          </div>
          <Field label="Adres"><input id="s-addr" value={d.shop.address} onChange={(e) => set('shop.address', e.target.value)} /></Field>
          <div className="row2">
            <Field label="Telefon"><PhoneInput id="s-tel" value={d.shop.phone} onChange={(v) => set('shop.phone', v)} /></Field>
            <Field label="WhatsApp (905xx…)"><input id="s-wa" inputMode="tel" value={d.shop.whatsapp} onChange={(e) => set('shop.whatsapp', e.target.value)} /></Field>
          </div>
          <Field label="Teslim notu" hint="Sepet ekranının altında görünür"><textarea id="s-pn" rows="2" value={d.shop.pickupNote} onChange={(e) => set('shop.pickupNote', e.target.value)} /></Field>
        </>}

        {sec === 'magaza' && <>
          <p className="fine">Herkese açık mağaza: <b>{location.host}/magaza</b>. Müşteri ürünleri sepete ekler, <b>Sepeti onayla</b> ile teslimat, fatura ve ödeme bilgilerini girip siparişi tamamlar; sipariş <b>Siparişler</b>’e düşer. İsterse üye olur (bilgileri bir dahakine hazır gelir), isterse misafir devam eder. Ayrıca sepeti sadece link olarak WhatsApp’tan da gönderebilir (o liste hiçbir yere kaydedilmez).</p>
          <Toggle id="s-pub" label="Online mağaza açık" checked={d.access.publicShop} onChange={(v) => set('access.publicShop', v)} />
          <div className="input-btn"><input id="s-publink" readOnly value={links.shop()} /><button type="button" className="btn sm outline" onClick={() => copyText(links.shop(), 'Mağaza linki kopyalandı')}>Kopyala</button></div>
          <ShopInvite />
          <h3>Sipariş</h3>
          <Toggle id="s-ord" label="Mağazadan sipariş alınsın" hint="Kapalıysa müşteri sepeti sadece WhatsApp’tan liste linki olarak gönderir" checked={d.orders.enabled !== false} onChange={(v) => set('orders.enabled', v)} />
          <div className="soon-admin">
            <Toggle id="s-csoon" label="Online sipariş: “Çok yakında” göster" hint="Açıkken müşteri sepette “Sepeti onayla”yı pasif görür, sadece WhatsApp’tan gönderir. Sistemi açmak için kapatın." checked={d.orders.checkoutSoon !== false} onChange={(v) => set('orders.checkoutSoon', v)} />
            <Toggle id="s-asoon" label="Üyelik / Hesabım: “Çok yakında” göster" hint="Açıkken Hesabım sayfasında “Çok yakında hizmetinizde” yazar." checked={d.orders.accountsSoon !== false} onChange={(v) => set('orders.accountsSoon', v)} />
            <p className="fine">Kendiniz denemek için: <a href="/magaza?onizleme=1" target="_blank" rel="noopener">/magaza?onizleme=1</a> (bu cihazda “yakında” kalkar; geri almak için <code>?onizleme=0</code>).</p>
          </div>
          <Toggle id="s-osign" label="Müşteriler mağazaya üye olabilsin" hint="Adres ve fatura bilgileri kayıtlı kalır, siparişlerini takip ederler" checked={d.orders.signup !== false} onChange={(v) => set('orders.signup', v)} />
          <h3>Teslimat</h3>
          <Toggle id="s-ocargo" label="Kargo ile gönderim" checked={d.orders.cargo !== false} onChange={(v) => set('orders.cargo', v)} />
          <Toggle id="s-opick" label="Dükkandan teslim al" checked={d.orders.pickup !== false} onChange={(v) => set('orders.pickup', v)} />
          <Field label="Kargo notu" hint="Sepet ve sipariş ekranında görünür"><input id="s-onote" value={d.orders.cargoNote || ''} onChange={(e) => set('orders.cargoNote', e.target.value)} /></Field>
          <Field label="Kargo firmaları" hint="Her satıra bir firma. Siparişi “Kargoda” yaparken bunlardan seçersiniz."><textarea id="s-cargos" rows="4" value={(d.orders.cargoCompanies || []).join('\n')} onChange={(e) => set('orders.cargoCompanies', e.target.value.split('\n'))} onBlur={(e) => set('orders.cargoCompanies', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></Field>
          <h3>Ödeme seçenekleri</h3>
          <Toggle id="s-ohav" label="Havale / EFT" checked={d.orders.payHavale !== false} onChange={(v) => set('orders.payHavale', v)} />
          <Toggle id="s-ocard" label="Kredi kartı (ödeme linki gönderilir)" hint="Siparişi onaylayınca müşteriye ödeme linkini siz gönderirsiniz" checked={d.orders.payCard !== false} onChange={(v) => set('orders.payCard', v)} />
          <Toggle id="s-oshop" label="Dükkanda ödeme" hint="Sadece dükkandan teslim alırken" checked={d.orders.payShop !== false} onChange={(v) => set('orders.payShop', v)} />
          <Field label="Havale / EFT bilgisi" hint="Sipariş verilince müşterinin sipariş sayfasında görünür. IBAN, alıcı adı vb."><textarea id="s-iban" rows="3" value={d.shop.payInfo} onChange={(e) => set('shop.payInfo', e.target.value)} placeholder={'ERTEL TELEKOMÜNİKASYON LTD. ŞTİ.\nTR00 0000 0000 0000 0000 0000 00'} /></Field>
          <NotifyCard />
          <Field label="Sipariş alındı mesajı" hint="Sipariş verilince teşekkür kutusunda görünür"><textarea id="s-odone" rows="2" value={d.orders.doneNote || ''} onChange={(e) => set('orders.doneNote', e.target.value)} /></Field>
        </>}

        {sec === 'kategori' && <>
          <p className="fine">Ağaç sitenizdeki kategori yapısıyla aynı. İsmi değiştirebilir, gizleyebilir (alt kategorileriyle birlikte gizlenir), aynı seviyedekileri sıralayabilirsiniz (küçük sayı üstte).</p>
          <div className="cat-edit">
            {catRows.map(([code, base, depth, n]) => {
              const cc = d.categories?.[code] || {};
              const setC = (patch) => set('categories', { ...d.categories, [code]: { ...cc, ...patch } });
              return (
                <div key={code} className="cat-row" style={{ '--d': depth }}>
                  <code>#{code}</code>
                  <input id={'cat-' + code} aria-label={'Kategori ' + code} value={cc.name ?? base} placeholder={base} onChange={(e) => setC({ name: e.target.value })} />
                  <input id={'cat-o-' + code} aria-label="Sıra" className="ord" inputMode="numeric" placeholder="sıra" value={cc.order ?? ''} onChange={(e) => setC({ order: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <span className="muted num">{n}</span>
                  <label className="mini-check"><input type="checkbox" checked={!!cc.hidden} onChange={(e) => setC({ hidden: e.target.checked })} />Gizle</label>
                </div>
              );
            })}
          </div>
        </>}

        {sec === 'veri' && <>
          <div className="data-box">
            <div>
              <b>Excel’den ürün ekle / güncelle</b>
              <p className="fine">PlatinMarket’ten aldığınız dışa aktarımı seçin: “Ürünler” (stoklu) veya “Ürünler Varyasyonlu” (resimler, etiketler, marka, açıklama). İkisini sırayla yükleyebilirsiniz. Aynı ürün no’lu ürünler güncellenir, yeniler eklenir; elle yüklediğiniz resimler ve elle girdiğiniz toptan fiyatlar korunur.</p>
            </div>
            <label className="btn outline"><Icon n="upload" s={16} />Dosya seç<input type="file" accept=".xlsx,.csv" hidden onChange={pickFile} /></label>
          </div>
          <SyncInfo />
          <ImageSync />
          <div className="data-box">
            <div><b>Katalog</b><p className="fine">{catalog.length.toLocaleString('tr-TR')} ürün · {catalog.filter((p) => p.a).length.toLocaleString('tr-TR')} aktif · {catalog.filter((p) => p.w != null).length} üründe özel toptan fiyat · {catalog.filter((p) => p.img || p.pi).length} resimli</p></div>
          </div>
          <div className="data-box">
            <div><b>Ayarları kopyala</b><p className="fine">Tüm ayarları metin olarak panoya kopyalar; bana gönderip “şunu değiştir” diyebilirsiniz.</p></div>
            <button className="btn outline" onClick={() => navigator.clipboard?.writeText(JSON.stringify(settings, null, 2)).then(() => toast('Ayarlar kopyalandı'), () => toast('Kopyalanamadı', 'bad'))}>Kopyala</button>
          </div>
          {A.mode === 'demo' && (
            <div className="data-box">
              <div><b>Demoyu sıfırla</b><p className="fine">Örnek müşteriler ve talepler baştan kurulur, yaptığınız değişiklikler silinir.</p></div>
              <button className="btn ghost danger" onClick={() => setConfirm({ title: 'Demoyu sıfırla', text: 'Bu tarayıcıdaki tüm demo verisi silinecek.', okLabel: 'Sıfırla', tone: 'danger', onOk: () => A.reset() })}>Sıfırla</button>
            </div>
          )}
        </>}

        {sec === 'anasayfa' && <HomeEditor d={d} set={set} />}
        {sec === 'magazaana' && <ShopHomeEditor d={d} set={set} />}
        {sec === 'markalar' && <BrandLogosEditor d={d} set={set} />}
      </div>}

      {imp && (
        <Sheet title="Excel içe aktarma" sub={imp.file} onClose={() => setImp(null)} footer={<><button className="btn ghost" onClick={() => setImp(null)}>Vazgeç</button><button className="btn primary" onClick={applyImport} disabled={busy}>Uygula</button></>}>
          <div className="cust-kpis">
            <div><b className="num">{imp.rows}</b><span>satır okundu</span></div>
            <div><b className="num">{imp.added}</b><span>yeni ürün</span></div>
            <div><b className="num">{imp.updated}</b><span>değişen</span></div>
            <div><b className="num">{imp.missing}</b><span>dosyada yok</span></div>
          </div>
          {imp.priceChanged > 0 && <p className="banner warn" style={{ margin: 0 }}><b>{imp.priceChanged} ürünün liste fiyatı değişiyor.</b>&nbsp;Uygulayınca bunlar Ürünler'de “Liste fiyatı değişenler” olarak işaretlenir; toptan fiyatlarını kontrol edersiniz.</p>}
          {(imp.matchedByCode > 0 || imp.dupSkipped > 0) && <p className="fine">{imp.matchedByCode > 0 && <><b>{imp.matchedByCode}</b> ürün, ürün numarası farklı olduğu halde stok kodu tuttuğu için mevcut ürünün üzerine güncellendi (kopya oluşmadı). </>}{imp.dupSkipped > 0 && <><b>{imp.dupSkipped}</b> satır dosyada aynı stok koduyla ikinci kez geçtiği için atlandı.</>}</p>}
          <p className="fine">Aynı stok kodlu ürün asla ikinci kez eklenmez. Dosyada olmayan ürünler silinmez, olduğu gibi kalır. Okunan bilgiler: {[imp.fields.includes('pi') && 'resimler', imp.fields.includes('t') && 'etiketler', imp.fields.includes('b') && 'marka', imp.fields.includes('s') && 'stok', imp.fields.includes('r') && 'fiyat', Object.keys(imp.descs).length && `${Object.keys(imp.descs).length} açıklama`].filter(Boolean).join(', ')}.</p>
        </Sheet>
      )}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// =========================================================================
// Profil (müşteri ve yönetici)
export function Profile({ embedded }) {
  const { user, settings: S, requests, api: A } = useStore();
  const admin = user.role === 'admin';
  const [f, setF] = useState({ name: user.name || '', shop: user.shop || '', phone: user.phone || '' });
  const [inst, setInst] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInst(e); };
    window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const mine = requests.filter((r) => r.uid === user.uid);
  const dirty = f.name !== (user.name || '') || f.shop !== (user.shop || '') || f.phone !== (user.phone || '');
  async function photo(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const d = await resizeImage(file, 256, 0.8, true);
    await A.updateMe({ photo: d }); toast('Fotoğraf güncellendi');
  }
  const tier = S.tiers.find((t) => t.id === user.tier);
  return (
    <div className={embedded ? 'profile-embed' : 'page narrow'}>
      <div className="profile-card">
        <div className="avatar-edit">
          <Avatar u={user} size={88} />
          {(admin || S.features.profilePhoto) && <label className="avatar-btn" aria-label="Fotoğraf değiştir" title="Fotoğraf değiştir"><Icon n="camera" s={16} /><input type="file" accept="image/*" hidden onChange={photo} /></label>}
          {user.photo && <button className="avatar-del" onClick={() => A.updateMe({ photo: '' }).then(() => toast('Fotoğraf kaldırıldı'))} aria-label="Fotoğrafı kaldır" title="Fotoğrafı kaldır"><Icon n="trash" s={14} /></button>}
        </div>
        <div>
          <h1 className="page-t">{user.name || user.username}</h1>
          <p className="muted">@{user.username}{user.shop ? ' · ' + user.shop : ''}</p>
          {!admin && tier && <span className="tag">{tier.name} bayi{tier.pct ? ` · ek −%${tier.pct}` : ''}</span>}
        </div>
      </div>

      {!admin && S.features.history && (
        <div className="cust-kpis">
          <div><b className="num">{user.stats?.done ?? mine.filter((r) => r.status === 'done').length}</b><span>teslim alınan</span></div>
          <div><b className="num">{mine.filter((r) => ['new', 'offered', 'accepted', 'ready'].includes(r.status)).length}</b><span>açık talep</span></div>
          <div><b className="num">{mine.length}</b><span>toplam talep</span></div>
        </div>
      )}

      <div className="set-card">
        <h2>Bilgilerim</h2>
        <div className="form-col">
          <Field label="Ad soyad"><input id="p-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Dükkan adı"><input id="p-shop" value={f.shop} onChange={(e) => set('shop', e.target.value)} /></Field>
          <Field label="Telefon"><PhoneInput id="p-phone" value={f.phone} onChange={(v) => set('phone', v)} /></Field>
          <button className="btn primary" disabled={!dirty} onClick={() => A.updateMe(f).then(() => toast('Kaydedildi'))}>Kaydet</button>
        </div>
      </div>

      {!admin && (
        <div className="set-card shop-card">
          <h2>{S.shop.name}</h2>
          <p><Icon n="store" s={16} />{S.shop.address}</p>
          <p><Icon n="clock" s={16} />{S.shop.hours}</p>
          {S.shop.phone && <p><Icon n="phone" s={16} /><a href={'tel:' + S.shop.phone}>{S.shop.phone}</a></p>}
          {S.shop.whatsapp && <p><Icon n="chat" s={16} /><a href={'https://wa.me/' + S.shop.whatsapp.replace(/\D/g, '')} target="_blank" rel="noopener">WhatsApp: {S.shop.whatsapp}</a></p>}
        </div>
      )}

      <div className="set-card">
        <h2>Uygulama</h2>
        {inst ? <button className="btn outline" onClick={() => inst.prompt()}>Ana ekrana ekle</button>
          : <p className="fine">Telefonda uygulama gibi kullanmak için: iPhone’da Safari → Paylaş → “Ana Ekrana Ekle”. Android’de Chrome menüsü → “Uygulamayı yükle”.</p>}
        <button className="btn ghost danger" onClick={() => A.logout()}><Icon n="out" s={16} />Çıkış yap</button>
      </div>
    </div>
  );
}

// =========================================================================
// Siteden resim eşleme: ertelgsm.com'da tarayıcı konsolunda çalışan küçük bir kod üretir.
// (Uygulama, başka bir siteyi doğrudan okuyamaz; bu yüzden kod sitenizin kendi sayfasında çalışır.)
function ImageSync() {
  const { catalog, settings: S, api: A } = useStore();
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const [all, setAll] = useState(false);
  const missing = catalog.filter((p) => !p.pi && !p.img && (all || p.a)).map((p) => p.id);
  const ids = all ? catalog.map((p) => p.id) : missing;
  const code = `(async()=>{const ids=${JSON.stringify(ids)};const out={};let k=0,d=0,stop=0;async function w(){while(k<ids.length&&!stop){const id=ids[k++];try{const r=await fetch('/x-pmu'+id);if(r.status===403||r.status===429){stop=1;console.warn('Site yavaşlamamızı istedi, durduruldu. Birkaç saat sonra tekrar çalıştırın; kalanlar taranır.');break}await new Promise(z=>setTimeout(z,900));if(r.ok){const t=await r.text();const m=t.match(/property="og:image"\\s+content="([^"]+)"/)||t.match(/content="([^"]+)"\\s+property="og:image"/);if(m)out[id]=m[1].split('/pictures/').pop().replace(/^thumb\\/\\d+X-/,'')}}catch(e){}if(++d%100==0)console.log(d+'/'+ids.length)}}await Promise.all([1,2].map(w));const s=JSON.stringify(out);console.log('Bitti: '+Object.keys(out).length+' resim. Panoya kopyalandı.');copy(s);})()`;
  async function apply() {
    let map;
    try { map = JSON.parse(txt.trim()); } catch { return toast('Yapıştırılan metin okunamadı', 'bad'); }
    let n = 0;
    const list = catalog.map(({ _s, ...p }) => { if (map[p.id]) { n++; return { ...p, pi: map[p.id] }; } return p; });
    await A.saveCatalog(list); setCatalog(list); toast(n + ' ürüne resim eşlendi'); setOpen(false); setTxt('');
  }
  return (
    <div className="data-box">
      <div>
        <b>Resimleri siteden eşle (yedek yöntem)</b>
        <p className="fine">{catalog.filter((p) => p.pi || p.img).length.toLocaleString('tr-TR')} ürün resimli · {missing.length.toLocaleString('tr-TR')} aktif ürünün resmi yok. Asıl yöntem: “Ürünler Varyasyonlu” Excel’ini yukarıdan yüklemek; resimler oradan gelir.</p>
      </div>
      <button className="btn outline" onClick={() => setOpen(true)}>Eşle</button>
      {open && (
        <Sheet wide title="Resimleri siteden eşle" sub={S.catalog.siteUrl} onClose={() => setOpen(false)} footer={<><button className="btn ghost" onClick={() => setOpen(false)}>Vazgeç</button><button className="btn primary" onClick={apply} disabled={!txt.trim()}>Uygula</button></>}>
          <ol className="steps">
            <li>Bilgisayarda <b>{S.catalog.siteUrl}</b> adresini açın.</li>
            <li><kbd>F12</kbd> → <b>Console</b> (Konsol) sekmesi. Chrome ilk seferde “allow pasting” yazmanızı isteyebilir.</li>
            <li>Aşağıdaki kodu kopyalayıp konsola yapıştırın, Enter. {ids.length} ürün yavaşça taranır (yaklaşık {Math.max(1, Math.round(ids.length / 120))} dk), sitenizi yormamak için.</li>
            <li>“Bitti” yazınca sonuç panoya kopyalanır. Buraya yapıştırıp <b>Uygula</b> deyin.</li>
          </ol>
          <Toggle id="is-all" label="Tüm ürünleri yeniden tara" hint="Sitede resmi değişen ürünler için" checked={all} onChange={setAll} />
          <div className="code-row">
            <pre className="share-box code" id="sync-code">{code.length > 400 ? code.slice(0, 400) + '…' : code}</pre>
            <button className="btn outline" onClick={() => navigator.clipboard?.writeText(code).then(() => toast('Kod kopyalandı'), () => toast('Kopyalanamadı', 'bad'))}>Kodu kopyala</button>
          </div>
          <Field label="Sonucu buraya yapıştırın"><textarea id="sync-res" rows="4" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder='{"3113":"…jpeg", …}' /></Field>
        </Sheet>
      )}
    </div>
  );
}

function TagInput({ id, value, onChange }) {
  const tags = value ? value.split(',').map((x) => x.trim()).filter(Boolean) : [];
  const [txt, setTxt] = useState('');
  const add = (t) => { const n = t.split(',').map((x) => x.trim()).filter(Boolean).filter((x) => !tags.some((y) => y.toLocaleLowerCase('tr') === x.toLocaleLowerCase('tr'))); if (n.length) onChange([...tags, ...n].join(',')); setTxt(''); };
  return (
    <div className="tag-in" onClick={() => document.getElementById(id)?.focus()}>
      {tags.map((t, i) => (
        <span key={t + i} className="tag-chip">{t}<button type="button" aria-label={t + ' etiketini sil'} onClick={() => onChange(tags.filter((_, j) => j !== i).join(','))}><Icon n="x" s={12} /></button></span>
      ))}
      <input id={id} value={txt} placeholder={tags.length ? '' : 'ör. jbc uç, c210'} onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setTxt(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(txt); } if (e.key === 'Backspace' && !txt && tags.length) onChange(tags.slice(0, -1).join(',')); }}
        onBlur={() => txt.trim() && add(txt)} />
    </div>
  );
}

// Basit yazı düzenleyici: açıklama sitedeki gibi görünür, doğrudan üzerinde düzenlenir
function RichText({ value, onChange }) {
  const ref = useRef(null);
  const init = useRef(false);
  useEffect(() => { if (ref.current && !init.current) { ref.current.innerHTML = cleanHtml(value) || ''; init.current = true; } }, [value]);
  const cmd = (c, v) => { ref.current.focus(); document.execCommand(c, false, v); onChange(ref.current.innerHTML); };
  return (
    <div className="rte">
      <div className="rte-bar" role="toolbar" aria-label="Biçim">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('bold'); }} aria-label="Kalın"><b>K</b></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('italic'); }} aria-label="İtalik"><i>İ</i></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('insertUnorderedList'); }} aria-label="Madde işaretli liste">• Liste</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('formatBlock', 'h3'); }} aria-label="Başlık">Başlık</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('formatBlock', 'p'); }} aria-label="Normal yazı">Normal</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('removeFormat'); }} aria-label="Biçimi temizle">Temizle</button>
      </div>
      <div ref={ref} className="rte-body pdesc-body open" contentEditable suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)} data-ph="Ürün açıklaması yazın…" />
    </div>
  );
}

// Bayilerin kendi üyelik başvuruları: onaylanana kadar giriş yapamazlar
function PendingList({ list }) {
  const { settings: S, api: A } = useStore();
  const [tier, setTier] = useState({});
  const [confirm, setConfirm] = useState(null);
  const approve = async (c) => { await A.updateUser(c.uid, { active: true, pending: false, tier: tier[c.uid] || S.tiers[0]?.id || '', stats: c.stats || { done: 0, noshow: 0 } }); toast(`${c.name || c.username} onaylandı, artık giriş yapabilir`); };
  const reject = async (c) => { await A.updateUser(c.uid, { active: false, pending: false, rejected: true }); toast('Başvuru reddedildi'); };
  return (
    <section className="pending">
      <h2 className="pending-h"><span className="badge">{list.length}</span> Onay bekleyen üyelik başvurusu</h2>
      <ul className="pending-list">
        {list.map((c) => (
          <li key={c.uid} className="pending-row">
            <Avatar u={c} size={42} />
            <span className="ucard-b">
              <strong>{c.name}</strong>
              <span className="muted">{c.shop}{c.phone ? ' · ' + c.phone : ''}</span>
              <span className="muted">@{c.username} · {when(c.createdAt)}</span>
            </span>
            <select id={'pt-' + c.uid} aria-label="Kademe" value={tier[c.uid] || S.tiers[0]?.id || ''} onChange={(e) => setTier({ ...tier, [c.uid]: e.target.value })}>
              {S.tiers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.pct ? ` (−%${t.pct})` : ''}</option>)}
            </select>
            <span className="pending-btns">
              <button className="btn sm ghost danger" onClick={() => setConfirm({ title: 'Başvuruyu reddet', text: `${c.name || c.username} giriş yapamayacak.`, okLabel: 'Reddet', tone: 'danger', onOk: () => reject(c) })}>Reddet</button>
              <button className="btn sm primary" onClick={() => approve(c)}><Icon n="check" s={15} />Onayla</button>
            </span>
          </li>
        ))}
      </ul>
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </section>
  );
}

// Sitenin ürün beslemesiyle saatlik otomatik eşitlemenin son durumu
function SyncInfo() {
  const { api: A } = useStore();
  const [info, setInfo] = useState(undefined);
  useEffect(() => { A.getSyncInfo ? A.getSyncInfo().then(setInfo).catch(() => setInfo(null)) : setInfo(null); }, []);
  return (
    <div className="data-box">
      <div>
        <b>Siteyle otomatik eşitleme</b>
        <p className="fine">Bekçi dakikada bir ertelgsm.com'u kontrol eder; değişiklik görünce liste fiyatı (dolara çevrilerek), stok durumu, ana resim ve ad güncellenir. Fiyatı değişenler “Liste fiyatı değişenler” olarak işaretlenir, toptan fiyata dokunulmaz. Beklemek istemezseniz “Şimdi eşitle”ye basın.</p>
        {info === undefined ? <p className="fine">Yükleniyor…</p> : info
          ? <p className="fine"><b>Son çalışma: {when(info.at)}</b> · {info.summary}</p>
          : <p className="fine">Henüz çalışmadı.</p>}
      </div>
      <SyncButton />
    </div>
  );
}

// "Şimdi eşitle": siteyi hemen kontrol ettirir; değişiklikler ~1 dakikada uygulamaya düşer
export function SyncButton({ small }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await syncNow(true);
      toast(r === 'dispatched' ? 'Eşitleme başladı — değişiklikler 1 dakika içinde gelir' : r === 'throttled' ? 'Az önce eşitleme başlatıldı, biraz sonra tekrar deneyin' : 'Site kontrol edildi: ' + r, r === 'dispatched' ? 'ok' : 'info');
    } catch (e) { toast('Eşitleme başlatılamadı: ' + e.message, 'bad'); }
    setTimeout(() => setBusy(false), 4000);
  }
  return <button className={'btn ' + (small ? 'chip' : 'outline')} onClick={go} disabled={busy} title="Sitedeki değişiklikleri hemen al"><Icon n="refresh" s={15} className={busy ? 'spin' : ''} />{busy ? 'Eşitleniyor…' : 'Şimdi eşitle'}</button>;
}

function RateInfo() {
  const rate = useStore((s) => s.rate);
  if (!rate) return <p className="fine">Harem Altın kuru henüz gelmedi. Bekçi dakikada bir günceller; gelmezse aşağıya elle kur yazabilirsiniz.</p>;
  return <p className="fine">Şu an: <b>{rateLabel(rate)}</b>{rate.at ? ' · ' + when(rate.at) + ' güncellendi' : ''}</p>;
}

// Bayi ana sayfası içeriği: başlık, duyurular, bannerlar
function HomeEditor({ d, set }) {
  const H = d.home || {};
  const anns = H.announcements || [];
  const banners = H.banners || [];
  const setAnn = (i, patch) => set('home.announcements', anns.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const setBn = (i, patch) => set('home.banners', banners.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  async function bnImg(i, e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setBn(i, { img: await resizeImage(file, 1200, 0.78) });
  }
  return <>
    <p className="fine">Bayiler giriş yapınca önce bu sayfayı görür. Buradan büyük menü kartlarıyla Katalog, Sepet, Talepler ve Mesaj’a geçerler.</p>
    <div className="row2">
      <Field label="Başlık" hint="Boşsa “Hoş geldiniz, Ad” yazar"><input id="h-title" value={H.title || ''} onChange={(e) => set('home.title', e.target.value)} /></Field>
      <Field label="Alt yazı"><input id="h-sub" value={H.subtitle || ''} onChange={(e) => set('home.subtitle', e.target.value)} placeholder="ör. Yeni gelen ürünler kataloğa eklendi" /></Field>
    </div>
    <h3>Duyurular</h3>
    {anns.map((a, i) => (
      <div key={i} className="ann-row">
        <select aria-label="Renk" value={a.tone || 'info'} onChange={(e) => setAnn(i, { tone: e.target.value })}><option value="info">Mavi</option><option value="ok">Yeşil</option><option value="warn">Turuncu</option><option value="bad">Kırmızı</option></select>
        <input aria-label="Duyuru" value={a.text || ''} onChange={(e) => setAnn(i, { text: e.target.value })} placeholder="ör. Cumartesi 14:00'e kadar açığız" />
        <button className="icon-btn sm" onClick={() => set('home.announcements', anns.filter((_, j) => j !== i))} aria-label="Duyuruyu sil"><Icon n="trash" s={15} /></button>
      </div>
    ))}
    <button className="btn sm outline" onClick={() => set('home.announcements', [...anns, { text: '', tone: 'info' }])}><Icon n="plus" s={15} />Duyuru ekle</button>
    <h3>Bannerlar</h3>
    <p className="fine">Kampanya, yeni ürün vb. Resim yatay olursa iyi durur (ör. 1200×500). Link verirseniz tıklanınca o adres açılır.</p>
    {banners.map((b, i) => (
      <div key={i} className="bn-edit">
        <label className="bn-img">{b.img ? <img src={b.img} alt="" /> : <span><Icon n="upload" s={18} />Resim seç</span>}<input type="file" accept="image/*" hidden onChange={(e) => bnImg(i, e)} /></label>
        <div className="form-col">
          <input aria-label="Banner başlığı" value={b.title || ''} onChange={(e) => setBn(i, { title: e.target.value })} placeholder="Başlık" />
          <input aria-label="Banner yazısı" value={b.text || ''} onChange={(e) => setBn(i, { text: e.target.value })} placeholder="Kısa açıklama" />
          <input aria-label="Banner linki" value={b.link || ''} onChange={(e) => setBn(i, { link: e.target.value })} placeholder="Link (isteğe bağlı) ör. https://www.ertelgsm.com/..." />
          <div className="row-btns">
            {b.img && <button className="btn sm ghost" onClick={() => setBn(i, { img: '' })}>Resmi kaldır</button>}
            <button className="btn sm ghost danger" onClick={() => set('home.banners', banners.filter((_, j) => j !== i))}><Icon n="trash" s={15} />Banner’ı sil</button>
          </div>
        </div>
      </div>
    ))}
    {banners.length < 4 && <button className="btn sm outline" onClick={() => set('home.banners', [...banners, { img: '', title: '', text: '', link: '' }])}><Icon n="plus" s={15} />Banner ekle</button>}
  </>;
}

// Müşteriyi tamamen sil (kayıt, özel fiyatlar, notlar; istenirse talepleri de)
export function DeleteCustomer({ c, onClose, onDone }) {
  const n = useStore((s) => s.requests.filter((r) => r.uid === c.uid).length);
  const [withReq, setWithReq] = useState(true);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { await api().deleteUser(c.uid, withReq); toast((c.name || c.username) + ' silindi'); onDone?.(); }
    catch (e) { toast('Silinemedi: ' + e.message, 'bad'); setBusy(false); }
  }
  return (
    <Sheet title="Müşteriyi tamamen sil" sub={`${c.name || c.username} · @${c.username}`} onClose={onClose} footer={<>
      <button className="btn ghost" onClick={onClose}>Vazgeç</button>
      <button className="btn danger" onClick={go} disabled={busy}><Icon n="trash" s={16} />{busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}</button>
    </>}>
      <p>Müşterinin kaydı, özel fiyatları ve notları kalıcı olarak silinir; bir daha giriş yapamaz. Bu işlem geri alınamaz.</p>
      {n > 0 && <label className="mini-check"><input type="checkbox" checked={withReq} onChange={(e) => setWithReq(e.target.checked)} />{n} talebini ve mesajlarını da sil</label>}
      <p className="fine">Not: “@{c.username}” kullanıcı adı tekrar kullanılamaz; aynı kişiyi yeniden eklerseniz farklı bir kullanıcı adı verin.</p>
    </Sheet>
  );
}

// Müşteriye gönderilecek hazır mesaj (vitrin linkiyle)
function ShopInvite() {
  const t = `Merhaba, siparişinizi buradan kolayca verebilirsiniz 👇\n${links.shop()}\n\n1) İstediğiniz ürünlerde “Sepete ekle”ye basın\n2) Üstteki “Sepet”e basın\n3) “Sepeti onayla” ile siparişinizi tamamlayın (ya da “WhatsApp’tan gönder” ile listeyi bize iletin)\n\nSiparişiniz bize ulaşır, hemen dönüş yaparız.`;
  return (
    <div className="invite">
      <b>Müşteriye göndereceğiniz hazır mesaj</b>
      <pre className="share-box">{t}</pre>
      <div className="row-btns">
        <button className="btn sm primary" onClick={() => copyText(t, 'Mesaj kopyalandı')}><Icon n="copy" s={15} />Mesajı kopyala</button>
        <a className="btn sm wa" href={waLink('', t)} target="_blank" rel="noopener"><Icon n="wa" s={15} />WhatsApp’ta gönder</a>
      </div>
    </div>
  );
}

// Yeni sipariş bildirimi (bekçi üzerinden e-posta + WhatsApp)
function NotifyCard() {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const W = (window.WATCH_URL || '').replace(/\/$/, '');
  useEffect(() => { if (W) fetch(W + '/').then((r) => r.json()).then((j) => setSt(j.notify || null)).catch(() => {}); }, []);
  async function test() {
    setBusy(true);
    try { const r = await fetch(W + '/notify-test', { method: 'POST' }); const j = await r.json(); toast(j.ok ? 'Deneme bildirimi gönderildi; e-postanıza ve WhatsApp’ınıza bakın' : j.error || 'Gönderilemedi', j.ok ? 'ok' : 'bad'); }
    catch (e) { toast('Gönderilemedi: ' + e.message, 'bad'); }
    setBusy(false);
  }
  return (
    <div className="invite notify-card">
      <b>Yeni sipariş bildirimi</b>
      <p className="fine">Mağazadan sipariş gelince size e-posta ve WhatsApp mesajı gelir (sipariş özeti + panelde açma linki).</p>
      <p className="fine">E-posta: {st ? (st.email ? <b className="tone-ok-t">açık</b> : 'kapalı') : '…'} · WhatsApp: {st ? (st.whatsapp ? <b className="tone-ok-t">açık</b> : <b>kurulum bekliyor</b>) : '…'}</p>
      <ul className="fine notify-steps">
        <li><b>E-posta</b> ilk bildirimde FormSubmit’ten “Activate Form” e-postası gelir; bir kez tıklayın, sonraki siparişler doğrudan gelir.</li>
        <li><b>WhatsApp</b> için CallMeBot’tan ücretsiz anahtar alınır (callmebot.com → WhatsApp). Gelen anahtarı GitHub’da depo ayarlarına <code>CALLMEBOT_KEY</code> adıyla ekleyip “Bekçiyi yayınla”yı çalıştırın.</li>
      </ul>
      {W && <button className="btn sm outline" disabled={busy} onClick={test}><Icon n="send" s={15} />{busy ? 'Gönderiliyor…' : 'Deneme bildirimi gönder'}</button>}
    </div>
  );
}
