import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { store, useStore, setCatalog, loadCart, go, home, toast, openRequest } from './store.js';
import { ROUTE, links } from './route.js';
import { withDefaults, ls, cleanUsername } from './utils.js';
import { LOGO_MARK, LOGO_WIDE } from './config.js';
import { DemoBackend } from './backend-demo.js';
import { FirebaseBackend } from './backend-firebase.js';
import { Icon, Avatar, PhoneInput, PasswordInput, phoneDigits, ContextMenu, openMenu, copyText } from './ui.jsx';
import { Catalog } from './catalog.jsx';
import { Cart } from './cart.jsx';
import { Requests } from './requests.jsx';
import { Customers, Settings, Profile } from './admin.jsx';

// /admin = yönetim paneli, ana adres = bayi girişi, /magaza = herkese açık vitrin (bkz. route.js)
const ADMIN_ROUTE = ROUTE.admin;
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
const SEED_VERSION = 4; // uygulamayla yeni veri gelince arttırılır

async function boot() {
  const cfg = window.FIREBASE_CONFIG;
  const fb = cfg && cfg.apiKey;
  // Yönetici paneli ayrı bir oturum kullanır: aynı tarayıcıda bir sekmede yönetici, diğerinde bayi açık kalabilir
  const area = ADMIN_ROUTE ? 'admin' : 'user';
  const A = fb ? new FirebaseBackend(cfg, area === 'admin' ? 'admin' : undefined) : new DemoBackend(await loadSeed(), loadSeedDesc, area);
  try { await A.init(); } catch (e) { store.set({ boot: 'error', bootError: 'Sunucuya bağlanılamadı: ' + e.message }); return; }
  store.set({ api: A });
  try { const pub = await A.publicInfo(); if (pub) store.set({ settings: migrate(withDefaults({ ...store.s.settings, ...pub })) }); } catch {}
  if (ROUTE.shop) return bootShop(A);
  try { store.set({ needsSetup: await A.needsSetup() }); } catch {}

  A.onAuth(async (u, err) => {
    if (!u) {
      stopWatchers(); currentUid = null;
      store.set({ boot: 'login', user: null, loginError: err || '', requests: [], customers: [], openReq: null });
      return;
    }
    if (currentUid === u.uid) { store.set({ user: u }); return; }
    // Yönetim paneline sadece yönetici, bayi tarafına sadece bayi girer (yönlendirme yok, her sekme kendi halinde)
    if (fb && ADMIN_ROUTE && u.role !== 'admin') {
      await A.logout();
      store.set({ boot: 'login', loginError: 'Bu sayfa sadece yönetici içindir. Bayi girişi için ana sayfayı kullanın.' });
      return;
    }
    if (fb && !ADMIN_ROUTE && u.role === 'admin') {
      await A.logout();
      store.set({ boot: 'login', loginError: 'Yönetici hesabıyla bayi tarafına girilmez. Yönetim paneli: ' + location.origin + '/admin' });
      return;
    }
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
      store.set({ settings: migrate(withDefaults(s)) });
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
        if (admin && fb && cat?.length && !(await A.hasPublicCatalog())) { try { await A.savePublicCatalog(cat); } catch (e) { console.warn(e); } }
      }
      setCatalog(cat || []);
      store.set({ userPrices: admin ? {} : await A.getUserPrices(u.uid) });
      stopWatchers();
      unsubs.push(A.watchRequests(u, (requests) => store.set({ requests })));
      if (admin) unsubs.push(A.watchUsers((customers) => store.set({ customers })));
      loadCart();
      // Her girişte ana sayfadan başla; WhatsApp'tan gelen talep linki varsa onu aç
      store.set({ boot: 'ready', tab: admin ? 'talepler' : 'katalog', openReq: null });
      if (ROUTE.reqId) { openRequest(ROUTE.reqId); history.replaceState(null, '', ADMIN_ROUTE ? '/admin' : '/'); }
    } catch (e) {
      console.error(e);
      store.set({ boot: 'error', bootError: 'Veriler yüklenemedi: ' + e.message });
    }
  });
}

// Eski varsayılanları yenilerine taşı (elle değiştirilmiş değerlere dokunmaz)
function migrate(S) {
  if (S.brand.appName === 'ERTEL Toptan') S.brand.appName = 'ERTEL B2B';
  return S;
}

// Herkese açık vitrin: giriş yok, sadece liste fiyatı; sepet WhatsApp'la gönderilir
async function bootShop(A) {
  if (store.s.settings.access?.publicShop === false) { store.set({ boot: 'error', bootError: 'Online vitrin şu an kapalı.' }); return; }
  store.set({ user: { uid: 'guest', role: 'public', name: 'Ziyaretçi' }, boot: 'loading' });
  try {
    setCatalog(await A.loadPublicCatalog());
    loadCart();
    store.set({ boot: 'ready', tab: ROUTE.reqId ? 'talepler' : 'katalog', openReq: ROUTE.reqId || null });
  } catch (e) { store.set({ boot: 'error', bootError: 'Vitrin yüklenemedi: ' + e.message }); }
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
  return <button className="icon-btn" data-theme-btn onClick={flip} aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'} title={dark ? 'Açık tema' : 'Koyu tema'}><Icon n={dark ? 'sun' : 'moon'} s={19} /></button>;
}

function Brand({ small, onClick }) {
  const S = useStore((s) => s.settings);
  const inner = <>
    <img className="brand-logo" src={S.brand.logo || LOGO_MARK} alt="" />
    <span className="brand-t"><b>{S.brand.appName}</b>{!small && <small>{S.brand.tagline}</small>}</span>
  </>;
  return onClick
    ? <button className={'brand' + (small ? ' sm' : '') + ' brand-btn'} onClick={onClick} aria-label="Ana sayfa" title="Ana sayfa">{inner}</button>
    : <span className={'brand' + (small ? ' sm' : '')}>{inner}</span>;
}

function Login() {
  const { api: A, needsSetup, loginError, settings: S } = useStore();
  const fb = A?.mode === 'firebase';
  const adminPage = fb && ADMIN_ROUTE;
  const setup = adminPage && needsSetup;
  const [view, setView] = useState('login'); // login | signup | sent
  const [f, setF] = useState({ u: '', p: '', p2: '', name: '', shop: '', phone: '' });
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const username = cleanUsername(f.u);
      if (view === 'signup') {
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Kullanıcı adı en az 3 karakter olmalı; harf, rakam, nokta ve tire kullanın.');
        if (f.p.length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
        if (f.p !== f.p2) throw new Error('Şifreler aynı değil.');
        if (!f.name.trim()) throw new Error('Adınızı yazın.');
        if (phoneDigits(f.phone).length !== 11) throw new Error('Telefonu 0(5xx) xxx xx xx şeklinde eksiksiz yazın.');
        await A.signup({ username, password: f.p, name: f.name.trim(), shop: f.shop.trim(), phone: f.phone.trim() });
        setView('sent');
      } else if (setup) await A.setupAdmin({ username, password: f.p, name: f.name || S.shop.name });
      else await A.login(username, f.p, remember);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  const title = setup ? 'İlk kurulum: yönetici hesabı' : adminPage ? 'Yönetim paneli' : view === 'signup' ? 'Bayi üyeliği' : 'Bayi girişi';
  return (
    <div className="login">
      <div className="login-art" aria-hidden="true">
        <div className="tagline-big">{adminPage ? <>Yönetim<br />paneli.</> : <>Toptan fiyat,<br />tek ekranda.</>}</div>
        <ul className="login-points">
          <li><Icon n="search" s={18} />Binlerce ürünü ara, kategoriden bul</li>
          <li><Icon n="tag" s={18} />Liste fiyatı ve size özel toptan fiyat</li>
          <li><Icon n="chat" s={18} />Sepeti gönder, fiyat sor, onaylanınca gel al</li>
        </ul>
      </div>
      {view === 'sent' ? (
        <div className="login-card">
          <img className="login-logo" src={S.brand.logoWide || LOGO_WIDE} alt={S.shop.name} />
          <h1>Başvurunuz alındı</h1>
          <p>{S.shop.name} hesabınızı onayladığında <b>{cleanUsername(f.u)}</b> kullanıcı adı ve belirlediğiniz şifreyle giriş yapabilirsiniz.</p>
          <button className="btn outline" onClick={() => { setView('login'); setF((x) => ({ ...x, p: '', p2: '' })); }}>Girişe dön</button>
        </div>
      ) : (
        <form className={'login-card' + (adminPage ? ' admin' : '')} onSubmit={submit}>
          {adminPage && <span className="admin-flag"><Icon n="shield" s={15} />Yönetici girişi</span>}
          <img className="login-logo" src={S.brand.logoWide || LOGO_WIDE} alt={S.shop.name} />
          <h1>{title}</h1>
          {setup && <p className="fine">Bu hesap tüm müşterileri, fiyatları ve talepleri yönetir. Bir kez yapılır.</p>}
          {view === 'signup' && <p className="fine">Bilgilerinizi gönderin; {S.shop.name} onayladıktan sonra toptan fiyatları görebilirsiniz.</p>}
          {(setup || view === 'signup') && (
            <label className="field"><span className="field-l">{setup ? 'Dükkan adı' : 'Ad soyad'}</span><input id="l-name" value={f.name} onChange={set('name')} placeholder={setup ? 'ERTEL GSM' : ''} /></label>
          )}
          {view === 'signup' && <>
            <label className="field"><span className="field-l">Dükkan adı <small className="opt">(isteğe bağlı)</small></span><input id="l-shop" value={f.shop} onChange={set('shop')} /></label>
            <label className="field"><span className="field-l">Cep telefonu</span><PhoneInput id="l-phone" value={f.phone} onChange={(v) => setF((x) => ({ ...x, phone: v }))} required /></label>
          </>}
          <label className="field"><span className="field-l">Kullanıcı adı</span><input id="l-user" autoComplete="username" autoCapitalize="none" value={f.u} onChange={set('u')} required /></label>
          <label className="field"><span className="field-l">Şifre{(setup || view === 'signup') && <small className="opt"> (en az 6 karakter)</small>}</span><PasswordInput id="l-pw" autoComplete={setup || view === 'signup' ? 'new-password' : 'current-password'} value={f.p} onChange={set('p')} required /></label>
          {view === 'signup' && <label className="field"><span className="field-l">Şifre (tekrar)</span><PasswordInput id="l-pw2" autoComplete="new-password" value={f.p2} onChange={set('p2')} required /></label>}
          {fb && !adminPage && view === 'login' && (
            <label className="remember"><input id="l-remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Beni hatırla <small>(kapatırsanız sadece bu sekmede açık kalır)</small></span></label>
          )}
          {(err || (view === 'login' && loginError)) && <p className="err">{err || loginError}</p>}
          <button className="btn primary big" disabled={busy}>{busy ? 'Bekleyin…' : setup ? 'Yönetici hesabını oluştur' : view === 'signup' ? 'Başvuruyu gönder' : 'Giriş yap'}</button>
          {A?.mode === 'demo' && view === 'login' && (
            <div className="demo-hint">
              <span className="eyebrow">Demo · veriler bu tarayıcıda</span>
              <div className="demo-btns">
                <button type="button" className="btn sm outline" onClick={() => setF((x) => ({ ...x, u: 'admin', p: 'admin' }))}>Yönetici: admin / admin</button>
                <button type="button" className="btn sm outline" onClick={() => setF((x) => ({ ...x, u: 'ahmet', p: '1234' }))}>Bayi: ahmet / 1234</button>
              </div>
            </div>
          )}
          {!adminPage && view === 'login' && (S.access?.allowSignup
            ? <p className="fine center">Hesabınız yok mu? <button type="button" className="link" onClick={() => { setErr(''); setView('signup'); }}>Bayi olarak üye olun</button></p>
            : <p className="fine center">Hesabınız yok mu? {S.shop.name} ile iletişime geçin{S.shop.phone ? ': ' + S.shop.phone : '.'}</p>)}
          {view === 'signup' && <p className="fine center"><button type="button" className="link" onClick={() => { setErr(''); setView('login'); }}>Zaten hesabım var, giriş yap</button></p>}
        </form>
      )}
    </div>
  );
}

const NAV_USER = [['katalog', 'Katalog', 'grid'], ['sepet', 'Sepet', 'cart'], ['talepler', 'Talepler', 'chat'], ['profil', 'Profil', 'user']];
const NAV_ADMIN = [['talepler', 'Talepler', 'chat'], ['katalog', 'Ürünler', 'box'], ['musteriler', 'Müşteriler', 'users'], ['ayarlar', 'Ayarlar', 'gear']];
const NAV_PUBLIC = [['katalog', 'Ürünler', 'grid'], ['sepet', 'Sepet', 'cart'], ['talepler', 'Taleplerim', 'chat']];

// Boş bir yere sağ tıklayınca çıkan genel menü (ürün, müşteri, talep üstündekiler kendi menülerini açar)
function pageMenu(e, role) {
  const t = e.target;
  if (t.closest('input, textarea, select, a, [contenteditable="true"], .ctx, .sheet, .lb') || getSelection()?.toString()) return; // tarayıcının kendi menüsü kalsın
  const admin = role === 'admin', pub = role === 'public';
  const findProduct = () => { go('katalog'); setTimeout(() => document.getElementById('cat-search')?.focus(), 50); };
  openMenu(e, [
    { label: 'Ana sayfa', icon: 'home', onClick: home },
    { label: admin ? 'Ürün ara' : 'Ürün ara', icon: 'search', onClick: findProduct },
    !admin && { label: 'Sepete git', icon: 'cart', onClick: () => go('sepet') },
    !pub && { label: admin ? 'Gelen talepler' : 'Taleplerim', icon: 'chat', onClick: () => go('talepler') },
    admin && '-',
    admin && { label: 'Yeni ürün ekle', icon: 'plus', onClick: () => { go('katalog'); store.set({ intent: 'newProduct' }); } },
    admin && { label: 'Yeni müşteri ekle', icon: 'users', onClick: () => { go('musteriler'); store.set({ intent: 'newCustomer' }); } },
    admin && { label: 'Vitrin linkini kopyala', icon: 'copy', hint: '/magaza', onClick: () => copyText(links.shop(), 'Vitrin linki kopyalandı') },
    '-',
    { label: 'Temayı değiştir', icon: 'moon', onClick: () => document.querySelector('[data-theme-btn]')?.click() },
    { label: 'Yenile', icon: 'refresh', onClick: () => location.reload() },
  ]);
}

function Shell() {
  const { user, tab, cart, requests, api: A } = useStore();
  const admin = user.role === 'admin';
  const pub = user.role === 'public';
  const nav = admin ? NAV_ADMIN : pub ? NAV_PUBLIC : NAV_USER;
  const unread = requests.reduce((n, r) => n + ((admin ? r.unreadAdmin : r.unreadUser) > 0 ? 1 : 0), 0);
  const cartN = Object.keys(cart).length;
  const prev = useRef(unread);
  const [demoNote, setDemoNote] = useState(() => !ls.get('demo-note-off', false));
  useEffect(() => {
    if (unread > prev.current) { toast(admin ? 'Yeni talep / mesaj geldi' : 'Dükkandan yeni mesaj', 'info'); try { navigator.vibrate?.(120); } catch {} }
    prev.current = unread;
    document.title = (unread ? `(${unread}) ` : '') + store.s.settings.brand.appName;
  }, [unread]);
  const pendingN = useStore((s) => s.customers.filter((c) => c.pending).length);
  const priceN = useStore((s) => (admin ? s.catalog.filter((p) => p.pc).length : 0));
  const badge = (k) => (k === 'sepet' ? cartN : k === 'talepler' ? unread : k === 'musteriler' ? pendingN : k === 'katalog' ? priceN : 0);

  return (
    <div className={'shell tab-' + tab + (admin ? ' admin' : '') + (pub ? ' public' : '')} onContextMenu={(e) => pageMenu(e, user.role)}>
      <header className="topbar">
        <div className="topbar-in">
          <Brand small onClick={home} />
          {admin && <span className="admin-badge"><Icon n="shield" s={14} />Yönetim paneli</span>}
          {pub && <span className="pub-badge">Online vitrin</span>}
          <nav className="topnav" aria-label="Ana menü">
            {nav.map(([k, l, i]) => (
              <button key={k} className={'topnav-b' + (tab === k ? ' on' : '')} onClick={() => go(k)}>
                <Icon n={i} s={18} />{l}{badge(k) > 0 && <span className="badge">{badge(k)}</span>}
              </button>
            ))}
          </nav>
          <ThemeButton />
          {!pub && (
            <button className="me" onClick={() => go(admin ? 'ayarlar' : 'profil')} aria-label="Profil">
              <span className="me-t"><b>{user.name || user.username}</b><small>{admin ? 'Yönetici' : user.shop}</small></span>
              <Avatar u={user} size={34} />
            </button>
          )}
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
        {tab === 'profil' && !pub && <Profile />}
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
      <ContextMenu />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
boot();
