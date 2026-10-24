import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { store, useStore, setCatalog, loadCart, go, home, toast, openRequest, openOrder, tabFromPath, startHistory } from './store.js';
import { ROUTE, links } from './route.js';
import { withDefaults, ls, cleanUsername } from './utils.js';
import { LOGO_MARK, LOGO_WIDE, DEFAULT_SETTINGS } from './config.js';
import { DemoBackend } from './backend-demo.js';
import { FirebaseBackend } from './backend-firebase.js';
import { Icon, Avatar, PhoneInput, PasswordInput, phoneDigits, ContextMenu, openMenu, copyText } from './ui.jsx';
import { Catalog } from './catalog.jsx';
import { Cart } from './cart.jsx';
import { Requests } from './requests.jsx';
import { Customers, Settings, Profile } from './admin.jsx';
import { Landing, HomePage } from './home.jsx';
import { CodeList, VitrinListEditor, OpenVitrinList } from './listsheet.jsx';
import { CartBar, HeaderCart } from './guestcart.jsx';
import { OrderPage, Account, AuthAction } from './checkout.jsx';
import { ShopHome, HeaderSearch } from './shophome.jsx';
import { ShopDesigner } from './designer.jsx';
import { AdminHome } from './dashboard.jsx';
import { Orders } from './orders.jsx';
import { OrderForm } from './orderform.jsx';
import { startRate, syncNow, startVersionCheck } from './watch.js';
import { idbGet, idbSet } from './idb.js';

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
  // Online mağaza üyeleri de ayrı oturum kullanır (bayi / yönetici girişini etkilemez)
  const area = ADMIN_ROUTE ? 'admin' : ROUTE.shop ? 'shop' : 'user';
  const A = fb ? new FirebaseBackend(cfg, area === 'user' ? undefined : area) : new DemoBackend(await loadSeed(), loadSeedDesc, area);
  try { await A.init(); } catch (e) { store.set({ boot: 'error', bootError: 'Sunucuya bağlanılamadı: ' + e.message }); return; }
  store.set({ api: A });
  startHistory(() => (store.s.user?.role === 'public' ? shopFirst() : 'anasayfa'));
  startRate(A);
  startVersionCheck();
  // Logo / dükkan bilgisi: cihazda kayıtlıysa hemen kullan, sunucudakini arkadan al
  const applyPub = (pub) => pub && store.set({ settings: migrate(withDefaults({ ...store.s.settings, ...pub, v: pub.v || 0 })) });
  const cachedPub = ls.get('pub-info', null);
  applyPub(cachedPub);
  const pubP = A.publicInfo().then((pub) => { if (pub) { ls.set('pub-info', pub); if (!store.s.user || store.s.user.role === 'public') applyPub(pub); } }).catch(() => {});
  if (!cachedPub) await Promise.race([pubP, new Promise((r) => setTimeout(r, 2500))]);
  if (ROUTE.landing) { store.set({ boot: 'landing' }); return; }
  if (ROUTE.shop) return bootShop(A);
  if (ADMIN_ROUTE) A.needsSetup().then((v) => store.set({ needsSetup: v })).catch(() => {});

  // Oturum kontrolü 6 sn içinde cevap vermezse (bazı telefon tarayıcıları) giriş ekranını göster; cevap gelince kendiliğinden devam eder
  setTimeout(() => { if (store.s.boot === 'loading' && !currentUid) store.set({ boot: 'login' }); }, 6000);
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
    const admin = u.role === 'admin';
    store.set({ user: u });
    // Hızlı açılış: bu cihazda son açılıştan kalan ayar + katalog varsa ekranı hemen aç, yenisini arkada getir
    const ck = 'boot-' + u.uid;
    const cache = await idbGet(ck);
    const cat = cache && A.cachedCatalog ? await A.cachedCatalog(false) : null;
    if (cache && cat) {
      store.set({ settings: migrate(withDefaults(cache.settings)), userPrices: cache.prices || {} });
      setCatalog(cat.items);
      startSession(u, A);
      loadAll(u, A, true).catch((e) => console.warn('arka plan yenileme', e));
      return;
    }
    store.set({ boot: 'loading' });
    try { await loadAll(u, A, false); startSession(u, A); }
    catch (e) { console.error(e); currentUid = null; store.set({ boot: 'error', bootError: 'Veriler yüklenemedi: ' + e.message }); }
  });
}

// Oturum açıldıktan sonra: canlı dinleyiciler + açılış sekmesi
function startSession(u, A) {
  const admin = u.role === 'admin';
  stopWatchers();
  unsubs.push(A.watchRequests(u, (requests) => store.set({ requests })));
  if (A.watchCatalog) unsubs.push(A.watchCatalog((items) => items && setCatalog(items)));
  if (admin) unsubs.push(A.watchUsers((customers) => store.set({ customers })));
  if (admin && A.watchOrders) { unsubs.push(A.watchOrders((orders) => store.set({ orders }))); unsubs.push(A.watchMembers((members) => store.set({ members }))); }
  loadCart();
  if (admin) syncNow(false).catch(() => {});
  // Her girişte ana sayfadan başla; WhatsApp'tan gelen talep linki varsa onu aç
  store.set({ boot: 'ready', tab: tabFromPath() || 'anasayfa', openReq: null });
  if (ROUTE.reqId) { openRequest(ROUTE.reqId); history.replaceState(null, '', ADMIN_ROUTE ? '/admin' : '/b2b'); }
  if (admin && ROUTE.listCode) { store.set({ vitrinCode: ROUTE.listCode }); history.replaceState(null, '', '/admin'); }
  if (admin && ROUTE.orderId) { openOrder(ROUTE.orderId); history.replaceState(null, '', '/admin'); }
}

// Ayarlar, katalog ve özel fiyatlar aynı anda indirilir (sırayla değil)
async function loadAll(u, A, background) {
  const admin = u.role === 'admin';
  const [s, cat0, prices] = await Promise.all([A.loadSettings(), A.loadCatalog(), admin ? {} : A.getUserPrices(u.uid)]);
  let cat = cat0;
  // eski varsayılanları yeni marka renklerine taşı (elle seçilmiş renklere dokunma)
  if (s && (s.seedVersion || 0) < 3 && s.brand) {
    if (s.brand.accent === '#0d6e5f') s.brand.accent = '#2f55b0';
    if (s.brand.priceAccent === '#b45309') s.brand.priceAccent = '#c2410c';
    if (s.brand.theme === 'auto') s.brand.theme = 'light';
  }
  store.set({ settings: migrate(withDefaults(s)) });
  // yönetici açınca herkese açık ayar kopyasını güncel tut (vitrin ve liste linki KDV/TL ayarlarını buradan okur)
  if (admin && s && A.savePublicSettings) A.savePublicSettings(store.s.settings).catch((e) => console.warn(e));
  if (admin) {
    const fb = A.mode === 'firebase';
    const seed = await loadSeed();
    if ((!cat || !cat.length) && seed.length) { await A.saveCatalog(seed); cat = seed; const S2 = { ...store.s.settings, seedVersion: SEED_VERSION }; await A.saveSettings(S2); store.set({ settings: S2 }); toast('Ürün listesi ilk kez yüklendi (' + seed.length + ' ürün)'); }
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
    if (fb) A.hasDescs().then((h) => !h && loadSeedDesc().then((d) => A.saveDescs(d))).catch((e) => console.warn(e));
    if (fb && cat?.length) A.hasPublicCatalog().then((h) => !h && A.savePublicCatalog(cat)).catch((e) => console.warn(e));
  }
  // arka plan yenilemesinde katalog değişmediyse ekranı yeniden çizme
  if (!background || store.s.catalog.length !== (cat || []).length || JSON.stringify(cat?.[0]) !== JSON.stringify(stripLocal(store.s.catalog[0]))) setCatalog(cat || []);
  store.set({ userPrices: prices || {} });
  idbSet('boot-' + u.uid, { settings: store.s.settings, prices: prices || {} });
}
const stripLocal = (p) => { if (!p) return p; const { _s, _t, ...o } = p; return o; };

// Eski varsayılanları yenilerine taşı (elle değiştirilmiş değerlere dokunmaz)
function migrate(S) {
  if (['ERTEL Toptan', 'ERTEL B2B'].includes(S.brand.appName)) S.brand.appName = 'ERTEL GSM';
  // 24.10.2026: yeni logo (kalın çizgili) ve tek tip marka kutuları, üyelik + sipariş açıldı (bir kez uygulanır; sonra panelden değiştirilebilir)
  if ((S.v || 0) < 3 && S.shopHome?.brands && !S.shopHome.brands.some((b) => /amscope/i.test(b.name || ''))) S.shopHome = { ...S.shopHome, brands: [...S.shopHome.brands, { name: 'AmScope', color: '#1f3a8a', logo: '/brands/amscope.png', link: 'brand:AmScope' }] };
  if (S.v === 2) S.v = 3;
  if (S.v === 3) S.v = 4;
  if ((S.v || 0) < 2) {
    S.v = 4; S.brand.logo = ''; S.brand.logoWide = '';
    S.orders = { ...S.orders, checkoutSoon: false, accountsSoon: false };
    if (S.shopHome?.brands) { const def = DEFAULT_SETTINGS.shopHome.brands; S.shopHome = { ...S.shopHome, brands: S.shopHome.brands.map((b) => { const d = def.find((x) => x.name.toLowerCase() === (b.name || '').toLowerCase()); return d && (!b.logo || b.logo.startsWith('/brands/')) ? { ...b, color: d.color, logo: d.logo } : b; }) }; }
  }
  // v5: logosu bulunan yeni markalar ana sayfa kutularına (bir kez; sonra panelden çıkarılabilir)
  if ((S.v || 0) < 5) {
    if (S.shopHome?.brands) { const have = new Set(S.shopHome.brands.map((b) => (b.name || '').toLowerCase())); const add = DEFAULT_SETTINGS.shopHome.brands.filter((b) => ['quick', 'rf4', 'yihua', 'uni-t'].includes(b.name.toLowerCase()) && !have.has(b.name.toLowerCase())); if (add.length) S.shopHome = { ...S.shopHome, brands: [...S.shopHome.brands, ...add] }; }
    S.v = 5;
  }
  return S;
}

// Herkese açık vitrin: giriş yok, sadece liste fiyatı; sepet WhatsApp'la gönderilir
async function bootShop(A) {
  if (store.s.settings.access?.publicShop === false) { store.set({ boot: 'error', bootError: 'Online vitrin şu an kapalı.' }); return; }
  store.set({ user: { uid: 'guest', role: 'public', name: 'Ziyaretçi' }, boot: 'loading' });
  // Mağaza üyeliği: giriş yaptıysa bilgileri ve siparişleri
  let unOrders = null;
  A.onMember?.((m) => {
    unOrders?.(); unOrders = null;
    store.set({ member: m, myOrders: [] });
    if (m) unOrders = A.watchMyOrders(m.uid, (myOrders) => store.set({ myOrders }));
  });
  // Sipariş takip linki (/magaza/s/<no>) katalog beklemeden açılır
  if (ROUTE.orderId) { loadCart(); store.set({ boot: 'ready' }); openOrder(ROUTE.orderId); }
  if (ROUTE.authAction) { loadCart(); store.set({ boot: 'ready', tab: 'islem' }); }
  // Liste linki (WhatsApp'tan gelen) katalog yüklenmesini beklemeden hemen açılır
  if (ROUTE.reqId && !ROUTE.orderId) { loadCart(); store.set({ boot: 'ready', tab: 'talepler', openReq: ROUTE.reqId }); }
  const cached = A.cachedCatalog ? await A.cachedCatalog(true) : null;
  const firstTab = ROUTE.listCode ? 'liste' : tabFromPath() || shopFirst();
  if (ROUTE.listCode) { loadCart(); store.set({ boot: 'ready', tab: 'liste', openReq: null }); } // linkli liste katalogu beklemeden açılır (yüklenene kadar kendi bekleme ekranı var)
  if (cached) setCatalog(cached.items);
  const direct = ROUTE.reqId || ROUTE.listCode || ROUTE.orderId || ROUTE.authAction;
  if (cached && !direct) { loadCart(); store.set({ boot: 'ready', tab: firstTab, openReq: null }); }
  try {
    setCatalog(await A.loadPublicCatalog());
    A.watchCatalog?.((items) => items && setCatalog(items), true);
    if (!direct && !cached) { loadCart(); store.set({ boot: 'ready', tab: firstTab, openReq: null }); }
  } catch (e) { if (!direct && !cached) store.set({ boot: 'error', bootError: 'Vitrin yüklenemedi: ' + e.message }); }
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
          {!adminPage && <p className="fine center"><a className="link" href="/">← Giriş sayfasına dön</a></p>}
        </form>
      )}
    </div>
  );
}

// [sekme, ad, ikon, telefondaki kısa ad]
const NAV_USER = [['anasayfa', 'Ana sayfa', 'home'], ['katalog', 'Tüm ürünler', 'grid', 'Ürünler'], ['sepet', 'Sepet', 'cart'], ['talepler', 'Talepler', 'chat'], ['profil', 'Hesabım', 'user']];
const NAV_ADMIN = [['anasayfa', 'Ana sayfa', 'home', 'Özet'], ['talepler', 'Talepler', 'chat'], ['siparisler', 'Siparişler', 'box'], ['siparis', 'Sipariş formu', 'tag', 'Form'], ['katalog', 'Ürünler', 'grid'], ['musteriler', 'Müşteriler', 'users'], ['tasarim', 'Tasarım', 'brush'], ['ayarlar', 'Ayarlar', 'gear']];
const NAV_PUBLIC = [['anasayfa', 'Ana sayfa', 'store'], ['katalog', 'Tüm ürünler', 'grid', 'Ürünler'], ['sepet', 'Sepet', 'cart'], ['hesap', 'Hesabım', 'user']];
const shopFirst = () => (store.s.settings.shopHome?.enabled === false ? 'katalog' : 'anasayfa');

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
    pub && { label: 'Hesabım', icon: 'user', onClick: () => go('hesap') },
    admin && { label: 'Mağaza siparişleri', icon: 'box', onClick: () => go('siparisler') },
    !pub && { label: admin ? 'Gelen talepler' : 'Taleplerim', icon: 'chat', onClick: () => go('talepler') },
    admin && '-',
    admin && { label: 'Yeni ürün ekle', icon: 'plus', onClick: () => { go('katalog'); store.set({ intent: 'newProduct' }); } },
    admin && { label: 'Yeni müşteri ekle', icon: 'users', onClick: () => { go('musteriler'); store.set({ intent: 'newCustomer' }); } },
    admin && { label: 'Mağaza tasarımı', icon: 'brush', onClick: () => go('tasarim') },
    admin && { label: 'Vitrin linkini kopyala', icon: 'copy', hint: '/magaza', onClick: () => copyText(links.shop(), 'Vitrin linki kopyalandı') },
    '-',
    { label: 'Temayı değiştir', icon: 'moon', onClick: () => document.querySelector('[data-theme-btn]')?.click() },
    { label: 'Yenile', icon: 'refresh', onClick: () => location.reload() },
  ]);
}

// /siparisformu: menüsüz, tek sayfa sipariş formu (yönetim panelinin oturumunu kullanır)
function FormOnlyShell() {
  const { user, api: A } = useStore();
  useEffect(() => { document.title = 'Sipariş formu'; const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m); }, []);
  return (
    <div className="shell admin form-only tab-siparis">
      <header className="topbar">
        <div className="topbar-in">
          <Brand small />
          <span className="admin-badge"><Icon n="tag" s={14} />Sipariş formu</span>
          <span className="top-sp" />
          <ThemeButton />
          <button className="icon-btn logout-btn" onClick={() => A.logout()} aria-label="Çıkış yap" title="Çıkış yap"><Icon n="out" s={18} /></button>
        </div>
      </header>
      <main className="main"><OrderForm /></main>
    </div>
  );
}

function Shell() {
  if (ROUTE.formOnly) return <FormOnlyShell />;
  return <ShellFull />;
}
function ShellFull() {
  const { user, tab, cart, requests, api: A, vitrinCode, vitrinOpen, openOrder: openOrderId, settings: S0 } = useStore();
  const admin = user.role === 'admin';
  const pub = user.role === 'public';
  const nav = admin ? NAV_ADMIN : pub ? NAV_PUBLIC.filter(([k]) => k !== 'anasayfa' || S0.shopHome?.enabled !== false) : NAV_USER;
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
  const newOrders = useStore((s) => (admin ? s.orders.filter((o) => o.unread).length : 0));
  const member = useStore((s) => s.member);
  const prevOrders = useRef(newOrders);
  useEffect(() => { if (admin && newOrders > prevOrders.current) toast('Mağazadan yeni sipariş geldi', 'info'); prevOrders.current = newOrders; }, [newOrders]);
  const badge = (k) => (k === 'sepet' ? cartN : k === 'talepler' ? unread : k === 'musteriler' ? pendingN : k === 'katalog' ? priceN : k === 'siparisler' ? newOrders : 0);

  return (
    <div className={'shell tab-' + tab + (admin ? ' admin' : '') + (pub ? ' public' : '')} onContextMenu={(e) => pageMenu(e, user.role)}>
      <header className="topbar">
        <div className="topbar-in">
          <Brand small onClick={home} />
          {admin && <span className="admin-badge" title="Yönetim paneli"><Icon n="shield" s={14} /><span className="badge-t">Yönetim paneli</span></span>}
          {pub && <span className="pub-badge">Online mağaza</span>}
          <nav className="topnav" aria-label="Ana menü">
            {nav.filter(([k]) => !(pub && k === 'hesap') && (admin || k !== 'sepet') && k !== 'tasarim').map(([k, l, i]) => (
              <button key={k} className={'topnav-b' + (tab === k ? ' on' : '')} onClick={() => go(k)} title={l}>
                <Icon n={i} s={18} /><span className="topnav-l">{l}</span>{badge(k) > 0 && <span key={badge(k)} className="badge">{badge(k)}</span>}
              </button>
            ))}
          </nav>
          <span className="top-sp" />
          {pub && <HeaderSearch />}
          {!admin && <HeaderCart on={tab === 'sepet'} />}
          {!admin && <a className="icon-btn to-landing" href="/" title="Giriş sayfasına dön (Mağaza / Bayi girişi)" aria-label="Giriş sayfasına dön"><Icon n="home" s={19} /></a>}
          <ThemeButton />
          {pub && (member
            ? <button className={'me' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Hesabım"><span className="me-t"><b>{member.name || member.email}</b><small>Hesabım</small></span><Avatar u={member} size={34} /></button>
            : <button className={'btn sm outline me-login' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')}><Icon n="user" s={16} />Giriş yap</button>)}
          {!pub && (
            <button className="me" onClick={() => go(admin ? 'ayarlar' : 'profil')} aria-label="Profil">
              <span className="me-t"><b>{user.name || user.username}</b><small>{admin ? 'Yönetici' : user.shop}</small></span>
              <Avatar u={user} size={34} />
            </button>
          )}
          {!pub && <button className="icon-btn logout-btn" onClick={() => A.logout()} aria-label="Çıkış yap" title="Çıkış yap"><Icon n="out" s={18} /></button>}
        </div>
      </header>
      {A.mode === 'demo' && admin && demoNote && (
        <div className="demo-strip">
          <span><b>Demo modu.</b> Veriler sadece bu tarayıcıda. Bayi tarafını görmek için çıkış yapıp <code>ahmet / 1234</code> ile girin.</span>
          <button className="icon-btn sm" onClick={() => { setDemoNote(false); ls.set('demo-note-off', true); }} aria-label="Kapat"><Icon n="x" s={14} /></button>
        </div>
      )}
      <main className="main">
        {tab === 'anasayfa' && !admin && !pub && <HomePage />}
        {tab === 'anasayfa' && admin && <AdminHome />}
        {tab === 'anasayfa' && pub && <ShopHome />}
        {tab === 'liste' && pub && <CodeList code={ROUTE.listCode} />}
        {tab === 'katalog' && <Catalog admin={admin} />}
        {tab === 'sepet' && !admin && <Cart />}
        {tab === 'talepler' && <Requests />}
        {tab === 'profil' && !pub && <Profile />}
        {tab === 'musteriler' && admin && <Customers />}
        {tab === 'siparis' && admin && <OrderForm />}
        {tab === 'siparisler' && admin && <Orders />}
        {tab === 'siparis' && pub && <OrderPage id={openOrderId} />}
        {tab === 'hesap' && pub && <Account />}
        {tab === 'islem' && pub && <AuthAction />}
        {tab === 'ayarlar' && admin && <Settings />}
        {tab === 'tasarim' && admin && <ShopDesigner />}
      </main>
      {!admin && <CartBar />}
      {admin && vitrinCode && <VitrinListEditor code={vitrinCode} onClose={() => store.set({ vitrinCode: null })} />}
      {admin && vitrinOpen && <OpenVitrinList onClose={() => store.set({ vitrinOpen: false })} />}
      <nav className="botnav" aria-label="Alt menü">
        {nav.filter(([k]) => k !== 'tasarim' && !(admin && k === 'musteriler')).map(([k, l, i, sh]) => (
          <button key={k} className={'botnav-b' + (tab === k ? ' on' : '')} onClick={() => go(k)}>
            <span className="botnav-i"><Icon n={i} s={22} />{badge(k) > 0 && <span key={badge(k)} className="badge">{badge(k)}</span>}</span>
            <span>{sh || l}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// Açılış ekranı: uzun sürerse (zayıf bağlantı, WhatsApp içi tarayıcı) yeniden deneme ve tarayıcıda açma seçeneği çıkar
function Splash() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 7000); return () => clearTimeout(t); }, []);
  return (
    <div className="splash">
      <Brand />
      <div className="spinner" aria-label="Yükleniyor" />
      {slow && (
        <div className="slow">
          <p>Bağlantı yavaş görünüyor…</p>
          <div className="slow-btns">
            <button className="btn primary" onClick={() => location.reload()}><Icon n="refresh" s={16} />Tekrar dene</button>
            <button className="btn outline" onClick={() => copyText(location.href, 'Link kopyalandı — tarayıcınıza yapıştırın')}><Icon n="copy" s={16} />Linki kopyala</button>
          </div>
          <p className="fine">Telegram, WhatsApp ya da Instagram içinden açtıysanız menüden (⋯ / ⋮) <b>“Safari’de aç”</b> ya da <b>“Tarayıcıda aç”</b>ı seçin.</p>
        </div>
      )}
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
      {b === 'loading' && <Splash />}
      {b === 'landing' && <Landing />}
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
