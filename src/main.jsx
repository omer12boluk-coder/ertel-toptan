import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { store, useStore, setCatalog, loadCart, go, toast } from './store.js';
import { withDefaults, ls, cleanUsername } from './utils.js';
import { LOGO_MARK, LOGO_WIDE } from './config.js';
import { DemoBackend } from './backend-demo.js';
import { FirebaseBackend } from './backend-firebase.js';
import { Icon, Avatar } from './ui.jsx';
import { Catalog } from './catalog.jsx';
import { Cart } from './cart.jsx';
import { Requests } from './requests.jsx';
import { Customers, Settings, Profile } from './admin.jsx';

let unsubs = [];
let currentUid = null;
const stopWatchers = () => { unsubs.forEach((f) => { try { f(); } catch {} }); unsubs = []; };

// Uygulamayla gelen başlangıç verisi: Claude demosunda sayfanın içinde, gerçek kurulumda ayrı dosyada
async function loadJSON(elId, file, fallback) {
  const el = document.getElementById(elId);
  if (el) return JSON.parse(el.textContent);
  try { const r = await fetch(file, { cache: 'no-cache' }); return r.ok ? await r.json() : fallback; } catch { return fallback; }
}
let _seed, _seedDesc;
const loadSeed = () => (_seed = _seed || loadJSON('seed', 'seed-products.json', []));
const loadSeedDesc = () => (_seedDesc = _seedDesc || loadJSON('seed-desc', 'seed-desc.json', {}));
const SEED_FIELDS = ['pi', 'im', 't', 'b', 'c2', 'u'];
const SEED_VERSION = 3; // uygulamayla yeni veri gelince arttırılır

async function boot() {
  const cfg = window.FIREBASE_CONFIG;
  const fb = cfg && cfg.apiKey;
  const A = fb ? new FirebaseBackend(cfg) : new DemoBackend(await loadSeed(), loadSeedDesc);
  try { await A.init(); } catch (e) { store.set({ boot: 'error', bootError: 'Sunucuya bağlanılamadı: ' + e.message }); return; }
  store.set({ api: A });
  try { const pub = await A.publicInfo(); if (pub) store.set({ settings: withDefaults({ ...store.s.settings, ...pub }) }); } catch {}
  try { store.set({ needsSetup: await A.needsSetup() }); } catch {}

  A.onAuth(async (u, err) => {
    if (!u) {
      stopWatchers(); currentUid = null;
      store.set({ boot: 'login', user: null, loginError: err || '', requests: [], customers: [], openReq: null });
      return;
    }
    if (currentUid === u.uid) { store.set({ user: u }); return; }
    currentUid = u.uid;
    store.set({ user: u, boot: 'loading' });
    try {
      const admin = u.role === 'admin';
      const s = await A.loadSettings();
      // eski varsayılanları yeni marka renklerine taşı (elle seçilmiş renklere dokunma)
      if (s && (s.seedVersion || 0) < 3 && s.brand) {
        if (s.brand.accent === '#0d6e5f') s.brand.accent = '#2f55b0';
        if (s.brand.priceAccent === '#b45309') s.brand.priceAccent = '#c2410c';
        if (s.brand.theme === 'auto') s.brand.theme = 'light';
      }
      store.set({ settings: withDefaults(s) });
      let cat = await A.loadCatalog();
      if (admin) {
        const seed = await loadSeed();
        if ((!cat || !cat.length) && admin && seed.length) { await A.saveCatalog(seed); cat = seed; const S2 = { ...store.s.settings, seedVersion: SEED_VERSION }; await A.saveSettings(S2); store.set({ settings: S2 }); toast('Ürün listesi ilk kez yüklendi (' + seed.length + ' ürün)'); }
        // Uygulamayla gelen yeni alanları (resimler, etiket, marka…) eski kayıtlara ekle; elle girilenlere dokunma
        else if (cat && cat.length && (store.s.settings.seedVersion || 0) < SEED_VERSION) {
          const byId = new Map(seed.map((p) => [p.id, p]));
          let added = 0;
          cat = cat.map((p) => {
            const sp = byId.get(p.id); if (!sp) return p;
            let n = p;
            for (const f of SEED_FIELDS) if (n[f] == null && sp[f] != null && !(f === 'pi' && n.img)) { n = n === p ? { ...p } : n; n[f] = sp[f]; }
            if (n !== p) added++;
            return n;
          });
          try {
            if (added) await A.saveCatalog(cat);
            const S2 = { ...store.s.settings, seedVersion: SEED_VERSION };
            await A.saveSettings(S2); store.set({ settings: S2 });
            if (added) toast(added + ' ürüne resim, etiket ve marka bilgisi eklendi');
          } catch (e) { console.warn(e); }
        }
        if (admin && fb && !(await A.hasDescs())) { try { await A.saveDescs(await loadSeedDesc()); } catch (e) { console.warn(e); } }
      }
      setCatalog(cat || []);
      store.set({ userPrices: admin ? {} : await A.getUserPrices(u.uid) });
      stopWatchers();
      unsubs.push(A.watchRequests(u, (requests) => store.set({ requests })));
      if (admin) unsubs.push(A.watchUsers((customers) => store.set({ customers })));
      loadCart();
      const tab = ls.get('tab-' + u.uid, null) || (admin ? 'talepler' : 'katalog');
      store.set({ boot: 'ready', tab });
    } catch (e) {
      console.error(e);
      store.set({ boot: 'error', bootError: 'Veriler yüklenemedi: ' + e.message });
    }
  });
}

// Tema: yöneticinin varsayılanı + her cihazın kendi seçimi (üst menüdeki güneş/ay düğmesi)
function useTheme() {
  const S = useStore((s) => s.settings);
  const dev = useStore((s) => s.deviceTheme);
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent-user', S.brand.accent);
    r.style.setProperty('--price-user', S.brand.priceAccent);
    const t = dev || S.brand.theme;
    if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
    document.title = S.brand.appName;
  }, [S.brand, dev]);
}
store.set({ deviceTheme: ls.get('device-theme', null) });
function ThemeButton() {
  const S = useStore((s) => s.settings);
  const dev = useStore((s) => s.deviceTheme);
  const cur = dev || S.brand.theme;
  const dark = cur === 'dark' || (cur === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const flip = () => { const n = dark ? 'light' : 'dark'; ls.set('device-theme', n); store.set({ deviceTheme: n }); };
  return <button className="icon-btn" onClick={flip} aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'} title={dark ? 'Açık tema' : 'Koyu tema'}><Icon n={dark ? 'sun' : 'moon'} s={19} /></button>;
}

function Brand({ small }) {
  const S = useStore((s) => s.settings);
  return (
    <span className={'brand' + (small ? ' sm' : '')}>
      <img className="brand-logo" src={S.brand.logo || LOGO_MARK} alt="" />
      <span className="brand-t"><b>{S.brand.appName}</b>{!small && <small>{S.brand.tagline}</small>}</span>
    </span>
  );
}

function Login() {
  const { api: A, needsSetup, loginError, settings: S } = useStore();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setup = needsSetup && A?.mode === 'firebase';
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (setup) await A.setupAdmin({ username: cleanUsername(u), password: p, name: name || S.shop.name });
      else await A.login(cleanUsername(u), p);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (
    <div className="login">
      <div className="login-art" aria-hidden="true">
        <div className="tagline-big">Toptan fiyat,<br />tek ekranda.</div>
        <ul className="login-points">
          <li><Icon n="search" s={18} />Binlerce ürünü ara, kategoriden bul</li>
          <li><Icon n="tag" s={18} />Liste fiyatı ve size özel toptan fiyat</li>
          <li><Icon n="chat" s={18} />Sepeti gönder, fiyat sor, onaylanınca gel al</li>
        </ul>
      </div>
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src={S.brand.logoWide || LOGO_WIDE} alt={S.shop.name} />
        <h1>{setup ? 'İlk kurulum: yönetici hesabı' : 'Bayi girişi'}</h1>
        {setup && <p className="fine">Bu hesap tüm müşterileri, fiyatları ve talepleri yönetir. Bir kez yapılır.</p>}
        {setup && <label className="field"><span className="field-l">Dükkan adı</span><input id="l-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ERTEL GSM" /></label>}
        <label className="field"><span className="field-l">Kullanıcı adı</span><input id="l-user" autoComplete="username" autoCapitalize="none" value={u} onChange={(e) => setU(e.target.value)} required /></label>
        <label className="field"><span className="field-l">Şifre</span><input id="l-pw" type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={p} onChange={(e) => setP(e.target.value)} required minLength={setup ? 6 : undefined} /></label>
        {(err || loginError) && <p className="err">{err || loginError}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? 'Bekleyin…' : setup ? 'Yönetici hesabını oluştur' : 'Giriş yap'}</button>
        {A?.mode === 'demo' && (
          <div className="demo-hint">
            <span className="eyebrow">Demo · veriler bu tarayıcıda</span>
            <div className="demo-btns">
              <button type="button" className="btn sm outline" onClick={() => { setU('admin'); setP('admin'); }}>Yönetici: admin / admin</button>
              <button type="button" className="btn sm outline" onClick={() => { setU('ahmet'); setP('1234'); }}>Bayi: ahmet / 1234</button>
            </div>
          </div>
        )}
        {!setup && <p className="fine center">Hesabınız yok mu? {S.shop.name} ile iletişime geçin{S.shop.phone ? ': ' + S.shop.phone : '.'}</p>}
      </form>
    </div>
  );
}

const NAV_USER = [['katalog', 'Katalog', 'grid'], ['sepet', 'Sepet', 'cart'], ['talepler', 'Talepler', 'chat'], ['profil', 'Profil', 'user']];
const NAV_ADMIN = [['talepler', 'Talepler', 'chat'], ['katalog', 'Ürünler', 'box'], ['musteriler', 'Müşteriler', 'users'], ['ayarlar', 'Ayarlar', 'gear']];

function Shell() {
  const { user, tab, cart, requests, api: A } = useStore();
  const admin = user.role === 'admin';
  const nav = admin ? NAV_ADMIN : NAV_USER;
  const unread = requests.reduce((n, r) => n + ((admin ? r.unreadAdmin : r.unreadUser) > 0 ? 1 : 0), 0);
  const cartN = Object.keys(cart).length;
  const prev = useRef(unread);
  const [demoNote, setDemoNote] = useState(() => !ls.get('demo-note-off', false));
  useEffect(() => {
    if (unread > prev.current) { toast(admin ? 'Yeni talep / mesaj geldi' : 'Dükkandan yeni mesaj', 'info'); try { navigator.vibrate?.(120); } catch {} }
    prev.current = unread;
    document.title = (unread ? `(${unread}) ` : '') + store.s.settings.brand.appName;
  }, [unread]);
  useEffect(() => { ls.set('tab-' + user.uid, tab); }, [tab]);
  const badge = (k) => (k === 'sepet' ? cartN : k === 'talepler' ? unread : 0);

  return (
    <div className={'shell tab-' + tab}>
      <header className="topbar">
        <div className="topbar-in">
          <Brand small />
          <nav className="topnav" aria-label="Ana menü">
            {nav.map(([k, l, i]) => (
              <button key={k} className={'topnav-b' + (tab === k ? ' on' : '')} onClick={() => go(k)}>
                <Icon n={i} s={18} />{l}{badge(k) > 0 && <span className="badge">{badge(k)}</span>}
              </button>
            ))}
          </nav>
          <ThemeButton />
          <button className="me" onClick={() => go(admin ? 'ayarlar' : 'profil')} aria-label="Profil">
            <span className="me-t"><b>{user.name || user.username}</b><small>{admin ? 'Yönetici' : user.shop}</small></span>
            <Avatar u={user} size={34} />
          </button>
          {admin && <button className="icon-btn hide-s" onClick={() => A.logout()} aria-label="Çıkış" title="Çıkış"><Icon n="out" s={18} /></button>}
        </div>
      </header>
      {A.mode === 'demo' && admin && demoNote && (
        <div className="demo-strip">
          <span><b>Demo modu.</b> Veriler sadece bu tarayıcıda. Bayi tarafını görmek için çıkış yapıp <code>ahmet / 1234</code> ile girin.</span>
          <button className="icon-btn sm" onClick={() => { setDemoNote(false); ls.set('demo-note-off', true); }} aria-label="Kapat"><Icon n="x" s={14} /></button>
        </div>
      )}
      <main className="main">
        {tab === 'katalog' && <Catalog admin={admin} />}
        {tab === 'sepet' && !admin && <Cart />}
        {tab === 'talepler' && <Requests />}
        {tab === 'profil' && <Profile />}
        {tab === 'musteriler' && admin && <Customers />}
        {tab === 'ayarlar' && admin && <><Settings /><Profile /></>}
      </main>
      <nav className="botnav" aria-label="Alt menü">
        {nav.map(([k, l, i]) => (
          <button key={k} className={'botnav-b' + (tab === k ? ' on' : '')} onClick={() => go(k)}>
            <span className="botnav-i"><Icon n={i} s={22} />{badge(k) > 0 && <span className="badge">{badge(k)}</span>}</span>
            <span>{l}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Toast() {
  const t = useStore((s) => s.toast);
  if (!t) return null;
  return <div className={'toast tone-' + t.tone} role="status">{t.text}</div>;
}

function App() {
  useTheme();
  const { boot: b, bootError } = useStore();
  return (
    <>
      {b === 'loading' && <div className="splash"><Brand /><div className="spinner" aria-label="Yükleniyor" /></div>}
      {b === 'error' && <div className="splash"><Brand /><p className="err">{bootError}</p><button className="btn outline" onClick={() => location.reload()}>Tekrar dene</button></div>}
      {b === 'login' && <Login />}
      {b === 'ready' && <Shell />}
      <Toast />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
boot();
