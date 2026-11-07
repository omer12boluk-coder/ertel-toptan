// Ayarlar › Ekip (8.11.2026): kişiler, yetkiler, bağlı cihazlar, geçmiş. Veri ve kurallar team.js'de.
import { useEffect, useMemo, useState } from 'react';
import { store, useStore, toast } from './store.js';
import { Icon, Sheet, Field, Toggle, SubNav, Confirm, PasswordInput } from './ui.jsx';
import { PERMS, PERM_GROUPS, PERM_LABEL, PERM_TPL, defaultPerm, can, isOwner, dayKey, devText, sessId, audit } from './team.js';

// yetkisi olmayan bölüm
export function NoPerm({ perm, inline }) {
  const body = <div className="tm-noperm"><span className="tm-np-ic"><Icon n="lock" s={22} /></span><b>Bu bölüm için yetkin yok</b><small>{PERM_LABEL[perm] ? '“' + PERM_LABEL[perm] + '” yetkisi gerekiyor. ' : ''}Asıl yönetici Ayarlar › Ekip’ten açabilir.</small></div>;
  return inline ? body : <div className="page">{body}</div>;
}

const MIN = 60e3, H = 3600e3;
export function ago(t) {
  if (!t) return '—';
  const d = Date.now() - t;
  if (d < 2 * MIN) return 'şimdi';
  if (d < H) return Math.round(d / MIN) + ' dk önce';
  const hm = new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (dayKey(t) === dayKey()) return 'bugün ' + hm;
  if (dayKey(t) === dayKey(Date.now() - 864e5)) return 'dün ' + hm;
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' ' + hm;
}
const devIcon = (d) => (d?.kind === 'pc' ? 'monitor' : 'mobile');
const tplName = (perm) => { const t = PERM_TPL.find(([, p]) => PERMS.every(([k]) => !!p[k] === !!perm?.[k])); return t ? t[0] : 'Özel yetki'; };
const tplPerm = (p) => Object.fromEntries(PERMS.map(([k]) => [k, !!p[k]]));
const initial = (u) => (u.name || u.username || '?').trim().charAt(0).toLocaleUpperCase('tr');

export function TeamPage() {
  const A = useStore((s) => s.api);
  const me = useStore((s) => s.user);
  const [tab, setTab] = useState('kisi');
  const [list, setList] = useState(null);
  const [sess, setSess] = useState([]);
  const [open, setOpen] = useState(null); // uid
  const [add, setAdd] = useState(false);
  const [histFor, setHistFor] = useState('');
  const load = () => A.teamList().then(setList).catch((e) => { toast('Ekip okunamadı: ' + e.message, 'bad'); setList([]); });
  useEffect(() => { load(); const un = A.watchTeamSess ? A.watchTeamSess(setSess) : null; return () => un?.(); }, []);
  if (!can('team')) return <NoPerm perm="team" inline />;
  const byUid = (uid) => sess.filter((s) => s.uid === uid).sort((a, b) => (b.last || 0) - (a.last || 0));
  const people = (list || []).slice().sort((a, b) => (b.owner ? 1 : 0) - (a.owner ? 1 : 0) || (a.active === false ? 1 : 0) - (b.active === false ? 1 : 0) || (a.name || '').localeCompare(b.name || '', 'tr'));
  const cur = open && people.find((u) => u.uid === open);
  return (
    <div className="tm">
      <SubNav label="Ekip" items={[
        { k: 'kisi', icon: 'users', label: 'Kişiler', count: list ? list.length : null, on: tab === 'kisi', onClick: () => setTab('kisi') },
        { k: 'gec', icon: 'clock', label: 'Geçmiş', on: tab === 'gec', onClick: () => setTab('gec') },
      ]} />
      {tab === 'kisi' && <>
        <div className="tm-bar">
          <p className="fine">Ekibe eklediğin herkes kendi kullanıcı adıyla <b>/admin</b>’e girer, paneldeki her şeyi görür. Neyi değiştirebileceğini sen seçersin.</p>
          <button type="button" className="btn sm primary" onClick={() => setAdd(true)}><Icon n="plus" s={15} />Kişi ekle</button>
        </div>
        <div className="sd-card tm-list">
          {!list && <p className="sd-none">Yükleniyor…</p>}
          {people.map((u) => {
            const ss = byUid(u.uid); const l = ss[0];
            const sub = l ? 'Son görülme ' + ago(l.last) + ' · ' + (l.dev?.os || 'cihaz') + (l.city ? ' · ' + l.city : '') : 'Henüz giriş yapmadı';
            return (
              <button key={u.uid} type="button" className="sd-row tm-row" onClick={() => setOpen(u.uid)}>
                <span className={'tm-av' + (u.active === false ? ' off' : '')}>{initial(u)}</span>
                <span className="sd-t"><b>{u.name || u.username}{u.uid === me.uid ? ' (sen)' : ''}</b><small>{u.active === false ? 'Engelli · giriş yapamaz' : sub}{ss.length > 1 ? ' · ' + ss.length + ' cihaz' : ''}</small></span>
                <span className={'pill tm-pill' + (u.owner || !u.staff ? ' own' : u.active === false ? ' bad' : '')}>{u.owner || !u.staff ? 'Asıl yönetici' : u.active === false ? 'Engelli' : tplName(u.perm)}</span>
                <Icon n="back" s={16} className="sd-go flip" />
              </button>
            );
          })}
        </div>
        <p className="fine tm-note">Şehir bilgisi internet bağlantısından tahmin edilir; mobil hatta başka şehir görünebilir. Konum izni istenmez.</p>
      </>}
      {tab === 'gec' && <History people={people} who={histFor} setWho={setHistFor} />}
      {cur && <PersonSheet u={cur} sess={byUid(cur.uid)} onClose={() => setOpen(null)} reload={load} onHist={() => { setHistFor(cur.uid); setTab('gec'); setOpen(null); }} />}
      {add && <AddSheet onClose={() => setAdd(false)} done={() => { setAdd(false); load(); }} />}
    </div>
  );
}

function PermEditor({ perm, set }) {
  return <div className="tm-perm">
    <div className="tm-tpl"><span className="fine">Hazır:</span>{PERM_TPL.map(([n, p]) => { const on = tplName(perm) === n; return <button key={n} type="button" className={'chip' + (on ? ' on' : '')} onClick={() => set(tplPerm(p))}>{on && <Icon n="check" s={14} />}{n}</button>; })}</div>
    {PERM_GROUPS.map(([g, gl]) => <section key={g} className="tm-pg">
      <span className="sd-cap">{gl}{g === 'r' || g === 'k' ? ' · varsayılan kapalı' : ''}</span>
      <div className="tm-pg-b">{PERMS.filter((p) => p[4] === g).map(([k, l, h]) => <Toggle key={k} id={'pm-' + k} label={l} hint={h} checked={!!perm[k]} onChange={(v) => set({ ...perm, [k]: v })} />)}</div>
    </section>)}
  </div>;
}

function AddSheet({ onClose, done }) {
  const A = useStore((s) => s.api);
  const [f, setF] = useState({ name: '', username: '', password: '' });
  const [perm, setPerm] = useState(defaultPerm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const un = f.username.trim().toLowerCase().replace(/\s+/g, '');
  async function save() {
    setErr('');
    if (!f.name.trim()) return setErr('Ad yazın');
    if (!/^[a-z0-9._-]{3,30}$/.test(un)) return setErr('Kullanıcı adı en az 3 harf: sadece küçük harf, rakam, nokta, tire');
    if (f.password.length < 6) return setErr('Şifre en az 6 karakter olmalı');
    setBusy(true);
    try { await A.teamCreate({ name: f.name.trim(), username: un, password: f.password, perm }); audit('ekip', 'Kişi ekledi: ' + f.name.trim() + ' (' + tplName(perm) + ')'); toast(f.name.trim() + ' eklendi · /admin’den ' + un + ' ile girebilir'); done(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return <Sheet title="Kişi ekle" sub="Ekip üyesi kendi hesabıyla girer" onClose={onClose} sticky footer={<><button className="btn ghost" onClick={onClose}>Vazgeç</button><button className="btn primary" onClick={save} disabled={busy}><Icon n="check" s={15} />{busy ? 'Ekleniyor…' : 'Ekle'}</button></>}>
    <div className="tm-form">
      <Field label="Ad"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ör. Kerem" autoComplete="off" /></Field>
      <Field label="Kullanıcı adı" hint={un ? 'Giriş: ' + un : 'Girişte bunu yazacak'}><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="ör. kerem" autoCapitalize="none" autoComplete="off" spellCheck={false} /></Field>
      <Field label="Şifre" hint="En az 6 karakter · kendisine sen söylersin, sonra Ekip’ten değiştirebilirsin"><PasswordInput id="tm-pw" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
    </div>
    <h3 className="tm-h3">Yetkiler</h3>
    <PermEditor perm={perm} set={setPerm} />
    {err && <p className="tm-err">{err}</p>}
  </Sheet>;
}

function PersonSheet({ u, sess, onClose, reload, onHist }) {
  const A = useStore((s) => s.api);
  const me = useStore((s) => s.user);
  const owner = u.owner || !u.staff;
  const [perm, setPerm] = useState(() => ({ ...defaultPerm(), ...(u.perm || {}) }));
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState(null);
  const [conf, setConf] = useState(null);
  const dirty = !owner && JSON.stringify(perm) !== JSON.stringify({ ...defaultPerm(), ...(u.perm || {}) });
  const nm = u.name || u.username;
  const run = async (fn, ok) => { setBusy(true); try { await fn(); if (ok) toast(ok); await reload(); } catch (e) { toast('Olmadı: ' + e.message, 'bad'); } setBusy(false); };
  const savePerm = () => run(async () => { await A.teamUpdate(u.uid, { perm }); const on = PERMS.filter(([k]) => perm[k] && !u.perm?.[k]).map((p) => p[1]); const off = PERMS.filter(([k]) => !perm[k] && u.perm?.[k]).map((p) => p[1]); audit('ekip', 'Yetkileri değiştirdi: ' + nm, [...on.map((x) => [x, 'kapalı', 'açık']), ...off.map((x) => [x, 'açık', 'kapalı'])]); }, 'Yetkiler kaydedildi · ' + nm + ' için hemen geçerli');
  const kick = (s) => run(async () => { await A.kickSess(s.id); audit('ekip', 'Cihazdan çıkardı: ' + nm + ' · ' + devText(s.dev)); }, 'Cihazdan çıkarıldı');
  const block = (on) => run(async () => {
    await A.teamUpdate(u.uid, { active: !on });
    if (on) sess.forEach((s) => A.kickSess(s.id).catch(() => {}));
    if (A.staffRevoke) await A.staffRevoke(u.uid, on).catch((e) => console.warn('hesap kilidi', e));
    audit('ekip', (on ? 'Engelledi: ' : 'Engeli kaldırdı: ') + nm);
  }, on ? nm + ' engellendi · hiçbir cihazdan giremez' : nm + ' tekrar girebilir');
  return <Sheet title={nm + (u.uid === me.uid ? ' (sen)' : '')} sub={'@' + u.username + ' · ' + (owner ? 'Asıl yönetici' : u.active === false ? 'Engelli' : tplName(u.perm))} onClose={onClose}
    footer={dirty ? <><button className="btn ghost" onClick={() => setPerm({ ...defaultPerm(), ...(u.perm || {}) })}>Geri al</button><button className="btn primary" onClick={savePerm} disabled={busy}><Icon n="check" s={15} />Yetkileri kaydet</button></> : null}>
    <h3 className="tm-h3">Bağlı cihazlar</h3>
    <div className="sd-card tm-devs">
      {!sess.length && <p className="sd-none">Bağlı cihaz yok.</p>}
      {sess.map((s) => {
        const mine = s.id === sessId();
        return <div key={s.id} className="tm-dev">
          <span className="tm-dev-ic"><Icon n={devIcon(s.dev)} s={19} /></span>
          <span className="sd-t"><b>{devText(s.dev) || 'Cihaz'}{mine ? ' · bu cihaz' : ''}</b><small>Son görülme {ago(s.last)}{s.city ? ' · ' + s.city : ''}{s.since ? ' · ilk giriş ' + new Date(s.since).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : ''}{s.kick ? ' · çıkarılıyor…' : ''}</small></span>
          {!mine && !s.kick && <button type="button" className="btn sm ghost" disabled={busy} onClick={() => setConf({ title: 'Cihazdan çıkar', text: nm + ' bu cihazda (' + devText(s.dev) + ') giriş ekranına düşecek. Açıksa hemen, kapalıysa ilk açılışta. Tekrar girmek için şifre gerekir.', okLabel: 'Çıkar', tone: 'danger', onOk: () => kick(s) })}>Çıkar</button>}
        </div>;
      })}
    </div>
    {owner ? <p className="fine tm-note">Asıl yönetici hesabı kısıtlanamaz, engellenemez ve şifresi başkası tarafından değiştirilemez. Kendi şifren: Ayarlar › Hesabım.</p> : <>
      <h3 className="tm-h3">Yetkiler</h3>
      <PermEditor perm={perm} set={setPerm} />
      <div className="tm-acts">
        <button type="button" className="btn sm ghost" onClick={onHist}><Icon n="clock" s={15} />Geçmişini gör</button>
        <button type="button" className="btn sm ghost" onClick={() => setPw('')}><Icon n="lock" s={15} />Yeni şifre ver</button>
        {u.active === false
          ? <button type="button" className="btn sm ghost" disabled={busy} onClick={() => block(false)}><Icon n="check" s={15} />Engeli kaldır</button>
          : <button type="button" className="btn sm ghost tm-danger" disabled={busy} onClick={() => setConf({ title: nm + ' engellensin mi?', text: 'Hiçbir cihazdan veri okuyamaz ve değiştiremez; açık ekranları hemen kapanır. İstediğin zaman geri açabilirsin.', okLabel: 'Engelle', tone: 'danger', onOk: () => block(true) })}><Icon n="eyeoff" s={15} />Engelle</button>}
      </div>
    </>}
    {pw != null && <Sheet title={'Yeni şifre · ' + nm} onClose={() => setPw(null)} footer={<><button className="btn ghost" onClick={() => setPw(null)}>Vazgeç</button><button className="btn primary" disabled={busy || pw.length < 6} onClick={() => run(async () => { await A.staffPw(u.uid, pw); audit('ekip', 'Yeni şifre verdi: ' + nm); setPw(null); }, 'Şifre değişti · ' + nm + ' yeni şifreyle girecek')}>Kaydet</button></>}>
      <Field label="Yeni şifre" hint="En az 6 karakter. Açık olan cihazları kapanmaz; istersen yukarıdan çıkar."><PasswordInput id="tm-npw" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
    </Sheet>}
    {conf && <Confirm {...conf} onClose={() => setConf(null)} />}
  </Sheet>;
}

const KIND = { siparis: ['Sipariş', 'box'], urun: ['Ürün', 'list'], ayar: ['Ayar', 'gear'], musteri: ['Müşteri', 'user'], ekip: ['Ekip', 'users'], oturum: ['Giriş', 'shield'] };
function History({ people, who, setWho }) {
  const A = useStore((s) => s.api);
  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => dayKey(Date.now() - i * 864e5)), []);
  const [day, setDay] = useState(days[0]);
  const [list, setList] = useState(null);
  const [kind, setKind] = useState('');
  useEffect(() => { setList(null); A.auditDay(day).then((l) => setList(l.slice().sort((a, b) => b.t - a.t))).catch((e) => { toast('Geçmiş okunamadı: ' + e.message, 'bad'); setList([]); }); }, [day]);
  const dl = (k, i) => (i === 0 ? 'Bugün' : i === 1 ? 'Dün' : new Date(k + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' }));
  const shown = (list || []).filter((e) => (!who || e.u === who) && (!kind || e.k === kind));
  return <div className="tm-hist">
    <div className="tm-hf">
      <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Gün">{days.map((k, i) => <option key={k} value={k}>{dl(k, i)}</option>)}</select>
      <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Kişi"><option value="">Herkes</option>{people.map((u) => <option key={u.uid} value={u.uid}>{u.name || u.username}</option>)}</select>
      <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tür"><option value="">Tüm işlemler</option>{Object.entries(KIND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
    </div>
    <div className="sd-card tm-log">
      {!list && <p className="sd-none">Yükleniyor…</p>}
      {list && !shown.length && <p className="sd-none">{dl(day, days.indexOf(day))} için kayıt yok.</p>}
      {shown.map((e) => <div key={e.t + e.r} className="tm-e">
        <span className="tm-e-ic"><Icon n={(KIND[e.k] || KIND.ayar)[1]} s={15} /></span>
        <span className="tm-e-t">
          <b>{e.n} · {e.x}</b>
          <small>{new Date(e.t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}{e.d ? ' · ' + e.d : ''}</small>
          {e.c && <span className="tm-chg">{e.c.map((r, i) => <span key={i}>{r[0]}{r.length > 1 && <>: <s>{r[1]}</s> → <em>{r[2]}</em></>}</span>)}</span>}
        </span>
      </div>)}
    </div>
    <p className="fine tm-note">Son 30 gün tutulur. Bir günü açmak tek okuma yapar; panel açılırken geçmiş hiç okunmaz.</p>
  </div>;
}
