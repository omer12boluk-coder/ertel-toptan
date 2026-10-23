import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, api, store, setCatalog, toast, openRequest } from './store.js';
import { Icon, Sheet, Thumb, Avatar, Field, Toggle, Empty, StatusPill, Confirm, PhoneInput } from './ui.jsx';
import { fmt, priceFor, catName, norm, resizeImage, withDefaults, cleanUsername, usernameOk, when, totals, fmtTotals } from './utils.js';
import { CATEGORY_NAMES, TYPE, LOGO_MARK } from './config.js';
import { readSheet, rowsToProducts, mergeCatalog } from './xlsx.js';
import { buildTree, cleanHtml } from './cats.js';
import { imageList } from './catalog.jsx';

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
  const pending = customers.filter((c) => c.pending);
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
                <button className={'ucard' + (c.active === false ? ' inactive' : '')} onClick={() => setOpen(c)}>
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
  const { settings: S, requests, api: A, catalog, customers } = useStore();
  const live = customers.find((x) => x.uid === c.uid) || c;
  const [tab, setTab] = useState('info');
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
      footer={tab === 'info' ? <button className="btn primary" onClick={saveInfo}><Icon n="check" s={16} />Kaydet</button> : tab === 'prices' ? <button className="btn primary" onClick={savePrices} disabled={!prices}><Icon n="check" s={16} />Fiyatları kaydet</button> : null}>
      <div className="cust-head">
        <Avatar u={live} size={64} />
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
    </Sheet>
  );
}

// =========================================================================
// Ayarlar
const SECTIONS = [['genel', 'Genel'], ['fiyat', 'Fiyatlandırma'], ['kademe', 'Kademeler'], ['katalog', 'Katalog'], ['talep', 'Talepler'], ['dukkan', 'Dükkan'], ['kategori', 'Kategoriler'], ['veri', 'Veri']];

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
      setImp({ ...res, descs, file: file.name, rows: incoming.length, fields: Object.keys(Object.assign({}, ...incoming.slice(0, 50))) });
    } catch (err) { toast(err.message, 'bad'); }
  }
  async function applyImport() {
    setBusy(true);
    try {
      await A.saveCatalog(imp.list); setCatalog(imp.list);
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
      <div className="chips scroll sec-nav">{SECTIONS.map(([k, l]) => <button key={k} className={'chip' + (sec === k ? ' on' : '')} onClick={() => setSec(k)}>{l}</button>)}</div>

      <div className="set-card">
        {sec === 'genel' && <>
          <h2>Genel görünüm</h2>
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
          <h2>Fiyatlandırma</h2>
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
          <Toggle id="s-save" label="Avantaj yüzdesini göster" checked={d.pricing.showSaving} onChange={(v) => set('pricing.showSaving', v)} />
          {sample && <div className="preview-box"><span className="eyebrow">Örnek</span><span>{sample.n}</span><span className="num">Liste {fmt(sample.r, sample.cur)} → Toptan <b>{fmt(priceFor(sample, withDefaults(d), null, null).mine, sample.cur)}</b></span></div>}
        </>}

        {sec === 'kademe' && <>
          <h2>Kademeler</h2>
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
          <h2>Katalog</h2>
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
          <h2>Talepler ve mesajlar</h2>
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
          <h2>Dükkan bilgileri</h2>
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

        {sec === 'kategori' && <>
          <h2>Kategoriler</h2>
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
          <h2>Veri</h2>
          <div className="data-box">
            <div>
              <b>Excel’den ürün güncelle</b>
              <p className="fine">PlatinMarket’ten aldığınız dışa aktarımı seçin: “Ürünler” (stoklu) veya “Ürünler Varyasyonlu” (resimler, etiketler, marka, açıklama). İkisini sırayla yükleyebilirsiniz. Aynı ürün no’lu ürünler güncellenir, yeniler eklenir; elle yüklediğiniz resimler ve elle girdiğiniz toptan fiyatlar korunur.</p>
            </div>
            <label className="btn outline"><Icon n="upload" s={16} />Dosya seç<input type="file" accept=".xlsx,.csv" hidden onChange={pickFile} /></label>
          </div>
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
      </div>

      <div className={'savebar' + (dirty ? ' show' : '')}>
        <span>Kaydedilmemiş değişiklikler var</span>
        <button className="btn ghost" onClick={() => setD(structuredClone(settings))}>Geri al</button>
        <button className="btn primary" onClick={save} disabled={busy}><Icon n="check" s={16} />Kaydet</button>
      </div>

      {imp && (
        <Sheet title="Excel içe aktarma" sub={imp.file} onClose={() => setImp(null)} footer={<><button className="btn ghost" onClick={() => setImp(null)}>Vazgeç</button><button className="btn primary" onClick={applyImport} disabled={busy}>Uygula</button></>}>
          <div className="cust-kpis">
            <div><b className="num">{imp.rows}</b><span>satır okundu</span></div>
            <div><b className="num">{imp.added}</b><span>yeni ürün</span></div>
            <div><b className="num">{imp.updated}</b><span>değişen</span></div>
            <div><b className="num">{imp.missing}</b><span>dosyada yok</span></div>
          </div>
          <p className="fine">Dosyada olmayan ürünler silinmez, olduğu gibi kalır. Okunan bilgiler: {[imp.fields.includes('pi') && 'resimler', imp.fields.includes('t') && 'etiketler', imp.fields.includes('b') && 'marka', imp.fields.includes('s') && 'stok', imp.fields.includes('r') && 'fiyat', Object.keys(imp.descs).length && `${Object.keys(imp.descs).length} açıklama`].filter(Boolean).join(', ')}.</p>
        </Sheet>
      )}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// =========================================================================
// Profil (müşteri ve yönetici)
export function Profile() {
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
    <div className="page narrow">
      <div className="profile-card">
        <div className="avatar-edit">
          <Avatar u={user} size={88} />
          {S.features.profilePhoto && <label className="avatar-btn" aria-label="Fotoğraf değiştir"><Icon n="camera" s={16} /><input type="file" accept="image/*" hidden onChange={photo} /></label>}
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
