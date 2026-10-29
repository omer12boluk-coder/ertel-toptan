import { SaveDock } from './savedock.jsx';
import { StoreDecor } from './decor.jsx';
import { RatePrompt } from './reviews.jsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { startAdminWatchers, stopAdminWatchers } from './datawin.js';
import { loadFavs, mergeFavs } from './store.js';
import { linkMember } from './push.js';
import { store, useStore, setCatalog, loadCart, go, home, toast, openRequest, openOrder, tabFromPath, startHistory, acctFromPath, pidFromPath } from './store.js';
import { ROUTE, links } from './route.js';
import { withDefaults, ls, cleanUsername } from './utils.js';
import { LOGO_MARK, LOGO_WIDE, DEFAULT_SETTINGS } from './config.js';
import { DemoBackend } from './backend-demo.js';
import { FirebaseBackend } from './backend-firebase.js';
import { Icon, Avatar, PhoneInput, PasswordInput, phoneDigits, ContextMenu, openMenu, copyText } from './ui.jsx';
import { Catalog, ProductPage } from './catalog.jsx';
import { KalipFinder } from './kalipfind.jsx';
import { PreqPage, PreqAdmin } from './preq.jsx';
import { LegalPage } from './legalui.jsx';
import { IssuePage } from './issue.jsx';
import { Cart } from './cart.jsx';
import { Requests } from './requests.jsx';
import { NotifBell, ShopBell } from './notif.jsx';
import { Customers, Settings, Profile } from './admin.jsx';
import { Landing, HomePage } from './home.jsx';
import { CodeList, VitrinListEditor, OpenVitrinList } from './listsheet.jsx';
import { CartBar, HeaderCart } from './guestcart.jsx';
import { OrderPage, Account, AuthAction } from './checkout.jsx';
import { ShopHome, HeaderSearch, withProdFallback } from './shophome.jsx';
import { ShopDesigner } from './designer.jsx';
import { AdminHome } from './dashboard.jsx';
import { ShopFooter } from './footer.jsx';
import { Orders } from './orders.jsx';
import { OrderForm } from './orderform.jsx';
import { startRate, syncNow, startVersionCheck } from './watch.js';
import { idbGet, idbSet } from './idb.js';

// /admin = yönetim paneli, ana adres = bayi girişi, /magaza = herkese açık vitrin (bkz. route.js)
const ADMIN_ROUTE = ROUTE.admin;
let unsubs = [];
let currentUid = null;
const stopWatchers = () => { unsubs.forEach((f) => { try { f(); } catch {} }); unsubs = []; stopAdminWatchers(); };

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
  // yönetici: siparişler / talepler son 60 gün, üyeler son 62 gün (datawin.js); bayi: kendi talepleri
  if (admin) startAdminWatchers(A, u); else unsubs.push(A.watchRequests(u, (requests) => store.set({ requests })));
  if (A.watchCatalog) unsubs.push(A.watchCatalog((items) => items && setCatalog(items)));
  if (admin) unsubs.push(A.watchUsers((customers) => store.set({ customers })));
  if (admin && A.watchFeed) unsubs.push(A.watchFeed((feed) => store.set({ feed })));
  loadCart();
  if (admin) syncNow(false).catch(() => {});
  // mağaza resimlerindeki ürün bağlantılarına yedek adres yoksa bir kez ekle (ürün kapanınca kutu boş kalmasın)
  if (admin && A.mode === 'firebase') { const S = store.s.settings; const S2 = withProdFallback(S); if (S2 !== S) A.saveSettings(S2).then(() => store.set({ settings: S2 })).catch((e) => console.warn(e)); }
  // Her girişte ana sayfadan başla; WhatsApp'tan gelen talep linki varsa onu aç
  store.set({ boot: 'ready', tab: tabFromPath() || 'anasayfa', openReq: null });
  if (ROUTE.reqId) { openRequest(ROUTE.reqId); history.replaceState(null, '', ADMIN_ROUTE ? '/admin' : '/b2b'); }
  if (admin && ROUTE.preqId) { ls.set('cust-kind', 'talep'); store.set({ tab: 'musteriler', openPreq: ROUTE.preqId }); history.replaceState(null, '', '/admin/musteriler'); }
  if (admin && ROUTE.issueId) { ls.set('cust-kind', 'sorun'); store.set({ tab: 'musteriler', openIssue: ROUTE.issueId }); history.replaceState(null, '', '/admin/musteriler'); }
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
  // v6 (25.10.2026): kademeli sabit USD toptan indirimi; kademeler şimdilik hepsi aynı (ekstra % yok). Sonra panelden ayrı ayarlanabilir.
  if ((S.v || 0) < 6) {
    S.pricing = { ...S.pricing, mode: 'steps' };
    if (Array.isArray(S.tiers)) S.tiers = S.tiers.map((t) => ({ ...t, pct: 0 }));
    S.v = 6;
  }
  return S;
}

// Misafirin bu cihazdan verdiği son siparişler (ls 'my-orders', en çok 8) canlı izlenir: bildirim merkezi + rozet
let guestUn = [];
function stopGuestOrders() { guestUn.forEach((f) => { try { f(); } catch {} }); guestUn = []; store.set({ guestOrders: [] }); }
function watchGuestOrders(A) {
  stopGuestOrders(); if (!A.watchOrder) return;
  let mine = []; try { mine = JSON.parse(localStorage.getItem('my-orders') || '[]'); } catch {}
  const got = new Map();
  for (const x of mine.filter((x) => x?.id && Date.now() - (x.at || 0) < 120 * 864e5).slice(0, 8)) {
    guestUn.push(A.watchOrder(x.id, (o) => { if (o) got.set(x.id, o); else got.delete(x.id); store.set({ guestOrders: [...got.values()].sort((a, b) => b.createdAt - a.createdAt) }); }));
  }
}

// Herkese açık vitrin: giriş yok, sadece liste fiyatı; sepet WhatsApp'la gönderilir
async function bootShop(A) {
  if (store.s.settings.access?.publicShop === false) { store.set({ boot: 'error', bootError: 'Online vitrin şu an kapalı.' }); return; }
  store.set({ user: { uid: 'guest', role: 'public', name: 'Ziyaretçi' }, boot: 'loading' });
  // Mağaza üyeliği: giriş yaptıysa bilgileri ve siparişleri
  let unOrders = null, unPreqs = null, unIssues = null, unWait = null;
  A.onMember?.((m) => {
    unOrders?.(); unOrders = null; unPreqs?.(); unPreqs = null; unIssues?.(); unIssues = null; unWait?.(); unWait = null;
    if (m && A.watchMemberWait) unWait = A.watchMemberWait(m.uid, (w) => store.s.member?.uid === m.uid && store.set({ member: { ...store.s.member, ...w } }));
    store.set({ member: m, myOrders: [], myPreqs: [], myIssues: [] });
    if (m && A.watchMyPreqs) unPreqs = A.watchMyPreqs(m.uid, (myPreqs) => store.set({ myPreqs }));
    if (m && A.watchMyIssues) unIssues = A.watchMyIssues(m.uid, (myIssues) => store.set({ myIssues }));
    if (m) { unOrders = A.watchMyOrders(m.uid, (myOrders) => store.set({ myOrders })); mergeFavs(m); stopGuestOrders(); setTimeout(() => A.idToken?.().then((t) => linkMember(t, false)), 3000); } // bildirim açık cihaz üyeye bağlansın (favori fiyat düşüşü)
    else { loadFavs(); watchGuestOrders(A); }
  });
  // Sipariş takip linki (/magaza/s/<no>) katalog beklemeden açılır
  if (ROUTE.orderId) { loadCart(); store.set({ boot: 'ready' }); openOrder(ROUTE.orderId); }
  if (ROUTE.authAction) { loadCart(); store.set({ boot: 'ready', tab: 'islem' }); }
  // Liste linki (WhatsApp'tan gelen) katalog yüklenmesini beklemeden hemen açılır
  if (ROUTE.reqId && !ROUTE.orderId) { loadCart(); store.set({ boot: 'ready', tab: 'talepler', openReq: ROUTE.reqId }); }
  const cached = A.cachedCatalog ? await A.cachedCatalog(true) : null;
  const firstTab = ROUTE.listCode ? 'liste' : tabFromPath() || shopFirst();
  if (firstTab === 'hesap') store.set({ acct: acctFromPath() });
  if (firstTab === 'urun') store.set({ pid: pidFromPath() });
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
  const pub = useStore((s) => s.user?.role === 'public');
  const L = S.look || {};
  useEffect(() => {
    const r = document.documentElement;
    // mağaza ve bayi renkleri ayrı (Ayarlar > Renkler ve görünüm)
    r.style.setProperty('--accent-user', (pub && L.shopAccent) || S.brand.accent);
    r.style.setProperty('--price-user', (pub && L.shopPrice) || S.brand.priceAccent);
    if (pub && L.bg) r.style.setProperty('--bg-user', L.bg); else r.style.removeProperty('--bg-user');
    r.style.setProperty('--pcard-r', (Number(L.cardR) >= 0 && L.cardR !== '' ? Number(L.cardR) : 18) + 'px');
    const t = dev || S.brand.theme;
    if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
    document.title = S.brand.appName;
  }, [S.brand, dev, pub, L.shopAccent, L.shopPrice, L.bg, L.cardR]);
  // Telefonda yazı seçme / basılı tutma davranışı (Ayarlar > Online mağaza > Mobil dokunma seçenekleri)
  const T = S.shop?.touch || {};
  useEffect(() => {
    const c = document.documentElement.classList;
    c.remove('tsel-none', 'tsel-smart', 'tsel-all');
    c.add('tsel-' + (['none', 'all'].includes(T.select) ? T.select : 'smart'));
    c.toggle('timg', !!T.imgMenu);
  }, [T.select, T.imgMenu]);
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
const NAV_USER = [['anasayfa', 'Ana sayfa', 'home'], ['katalog', 'Tüm ürünler', 'grid', 'Ürünler'], ['sepet', 'Sepet', 'cart'], ['talepler', 'Siparişlerim', 'box', 'Siparişler'], ['profil', 'Hesabım', 'user']];
const NAV_ADMIN = [['anasayfa', 'Ana sayfa', 'home', 'Özet'], ['talepler', 'Bayi siparişleri', 'chat', 'Bayi'], ['siparisler', 'Siparişler', 'box'], ['siparis', 'Sipariş formu', 'tag', 'Form'], ['katalog', 'Ürünler', 'grid'], ['musteriler', 'Müşteriler', 'users'], ['tasarim', 'Tasarım', 'brush'], ['ayarlar', 'Ayarlar', 'gear']];
const NAV_PUBLIC = [['anasayfa', 'Ana sayfa', 'store'], ['katalog', 'Tüm ürünler', 'grid', 'Ürünler'], ['kalip', 'Kalıp bulucu', 'chip', 'Kalıp'], ['sepet', 'Sepet', 'cart'], ['hesap', 'Hesabım', 'user']];
const shopFirst = () => (store.s.settings.shopHome?.enabled === false ? 'katalog' : 'anasayfa');

// Boş bir yere sağ tıklayınca çıkan genel menü (ürün, müşteri, talep üstündekiler kendi menülerini açar)
function pageMenu(e, role) {
  const t = e.target;
  if (e.nativeEvent?.lp && role === 'public') return; // mağaza müşterisi boş yere uzun basınca menü çıkmasın
  if (t.closest('input, textarea, select, a, [contenteditable="true"], .ctx, .sheet, .lb') || getSelection()?.toString()) return; // tarayıcının kendi menüsü kalsın
  const admin = role === 'admin', pub = role === 'public';
  const findProduct = () => { go('katalog'); setTimeout(() => document.getElementById('cat-search')?.focus(), 50); };
  openMenu(e, [
    { label: 'Ana sayfa', icon: 'home', onClick: home },
    { label: admin ? 'Ürün ara' : 'Ürün ara', icon: 'search', onClick: findProduct },
    !admin && { label: 'Sepete git', icon: 'cart', onClick: () => go('sepet') },
    pub && { label: 'Hesabım', icon: 'user', onClick: () => go('hesap') },
    admin && { label: 'Mağaza siparişleri', icon: 'box', onClick: () => go('siparisler') },
    !pub && { label: admin ? 'Bayi siparişleri' : 'Siparişlerim', icon: 'chat', onClick: () => go('talepler') },
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
  const { user, tab, cart, requests, api: A, vitrinCode, vitrinOpen, openOrder: openOrderId, settings: S0, pid } = useStore();
  const admin = user.role === 'admin';
  const pub = user.role === 'public';
  const nav = admin ? NAV_ADMIN : pub ? NAV_PUBLIC.filter(([k]) => (k !== 'anasayfa' || S0.shopHome?.enabled !== false) && (k !== 'kalip' || S0.kalip?.on !== false)) : NAV_USER;
  const unread = requests.reduce((n, r) => n + ((admin ? r.unreadAdmin : r.unreadUser) > 0 ? 1 : 0), 0);
  const cartN = Object.keys(cart).length;
  const prev = useRef(unread);
  const [demoNote, setDemoNote] = useState(() => !ls.get('demo-note-off', false));
  useEffect(() => {
    if (unread > prev.current) { toast(admin ? 'Yeni bayi siparişi / mesaj geldi' : 'Dükkandan yeni mesaj', 'info'); try { navigator.vibrate?.(120); } catch {} }
    prev.current = unread;
    document.title = (unread ? `(${unread}) ` : '') + store.s.settings.brand.appName;
  }, [unread]);
  const pendingN = useStore((s) => s.customers.filter((c) => c.pending).length + (admin ? s.preqs.filter((q) => q.seenAdmin === false).length + (s.issues || []).filter((q) => q.seenAdmin === false).length + (s.reviews || []).filter((r) => r.status === 'pending').length : 0));
  const priceN = useStore((s) => (admin ? s.catalog.filter((p) => p.pc && p.w != null).length : 0));
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
          {pub && <span className="pub-id"><b className="pub-name" style={S0.brand.nameColor ? { color: S0.brand.nameColor } : undefined}>{S0.brand.appName}</b></span>}
          <nav className="topnav" aria-label="Ana menü">
            {nav.filter(([k]) => !(pub && k === 'hesap') && (admin || k !== 'sepet') && k !== 'tasarim').map(([k, l, i]) => (
              <button key={k} className={'topnav-b' + (tab === k ? ' on' : '')} onClick={() => go(k)} title={l}>
                <Icon n={i} s={18} /><span className="topnav-l">{l}</span>{badge(k) > 0 && <span key={badge(k)} className="badge">{badge(k)}</span>}
              </button>
            ))}
          </nav>
          <span className="top-sp" />
          {pub && <HeaderSearch />}
          {pub && <ShopBell />}
          {!admin && <HeaderCart on={tab === 'sepet'} />}
          {!admin && <a className="icon-btn to-landing" href="/" title="Giriş sayfasına dön (Mağaza / Bayi girişi)" aria-label="Giriş sayfasına dön"><Icon n="home" s={19} /></a>}
          {admin && <NotifBell />}
          <ThemeButton />
          {pub && (member
            ? <button className={'me' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Hesabım"><span className="me-t"><b>{member.name || member.email}</b><small>Hesabım</small></span><Avatar u={member} size={34} /></button>
            : <button className={'btn sm outline me-login' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Giriş yap"><Icon n="user" s={16} /><span className="me-login-l">Giriş yap</span><span className="me-login-s">Giriş yap</span></button>)}
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
        {tab === 'urun' && pub && <ProductPage id={pid} />}
        {tab === 'kalip' && pub && <KalipFinder />}
        {tab === 'talep' && pub && <PreqPage />}
        {tab === 'yasal' && pub && <LegalPage />}
        {tab === 'sorun' && pub && <IssuePage />}
        {tab === 'islem' && pub && <AuthAction />}
        {tab === 'ayarlar' && admin && <Settings />}
        {tab === 'tasarim' && admin && <ShopDesigner />}
      </main>
      {pub && !['katalog', 'sepet', 'hesap'].includes(tab) && <ShopFooter compact={tab !== 'anasayfa'} />}
      {!admin && <CartBar />}
      {admin && vitrinCode && <VitrinListEditor code={vitrinCode} onClose={() => store.set({ vitrinCode: null })} />}
      {admin && vitrinOpen && <OpenVitrinList onClose={() => store.set({ vitrinOpen: false })} />}
      <BotNav items={nav.filter(([k]) => k !== 'tasarim' && !(admin && k === 'siparis'))} tab={tab} badge={badge} />
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

// Açılış ekranı: dükkân fotoğrafı, uygulama açılırken kısa süre (oturumda bir kez; dokununca geçer).
// Kaldırmak: Ayarlar > Genel > "Açılış ekranı" kapalı (brand.splashOn).
function IntroSplash() {
  const S = useStore((s) => s.settings);
  const ready = useStore((s) => s.boot !== 'loading');
  const want = S.brand.splashOn !== false && !!S.brand.splash && !ADMIN_ROUTE && (() => { try { return !sessionStorage.getItem('intro-seen'); } catch { return true; } })();
  const [phase, setPhase] = useState(want ? 'in' : 'off');
  const [minDone, setMinDone] = useState(false);
  useEffect(() => { if (!want) return; try { sessionStorage.setItem('intro-seen', '1'); } catch {} const sec = Math.min(8, Math.max(0.5, Number(S.brand.splashSec) || 1.4)); const t = setTimeout(() => setMinDone(true), sec * 1000); const max = setTimeout(() => setPhase('out'), Math.max(sec + 3, 4.5) * 1000); return () => { clearTimeout(t); clearTimeout(max); }; }, []);
  useEffect(() => { if (phase === 'in' && minDone && ready) setPhase('out'); }, [minDone, ready, phase]);
  useEffect(() => { if (phase === 'out') { const t = setTimeout(() => setPhase('off'), 500); return () => clearTimeout(t); } }, [phase]);
  if (phase === 'off') return null;
  return (
    <div className={'intro' + (phase === 'out' ? ' out' : '')} onClick={() => setPhase('out')} role="presentation">
      <img className="intro-bg" src={S.brand.splash} alt="" aria-hidden="true" />
      <img className="intro-img" src={S.brand.splash} alt="" />
      <div className="intro-f">
        <img className="intro-logo" src={S.brand.logo || LOGO_MARK} alt="" />
        <span><b>{S.brand.appName}</b><small>{ROUTE.shop ? "Online mağaza" : S.brand.tagline}</small></span>
        <span className="intro-bar"><i /></span>
      </div>
    </div>
  );
}

function App() {
  useTheme();
  const { boot: b, bootError } = useStore();
  const pub = useStore((s) => s.user?.role === 'public');
  return (
    <>
      {b === 'loading' && <Splash />}
      {b === 'landing' && <Landing />}
      {b === 'error' && <div className="splash"><Brand /><p className="err">{bootError}</p><button className="btn outline" onClick={() => location.reload()}>Tekrar dene</button></div>}
      {b === 'login' && <Login />}
      {b === 'ready' && <Shell />}
      {b === 'ready' && <StoreDecor />}
      {b === 'ready' && pub && <RatePrompt />}
      {b === 'ready' && <SaveDock />}
      <IntroSplash />
      <Toast />
      <ContextMenu />
    </>
  );
}

// Telefonda iki parmakla sayfayı büyütme kapalı (uygulama gibi); iOS Safari bazı durumlarda CSS'i dinlemediği için ayrıca engellenir
if (matchMedia('(hover: none) and (pointer: coarse)').matches) {
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => { if (!e.target.closest?.('.lb')) e.preventDefault(); }, { passive: false });
  setupLongPress();
  // setupPress(); — 29.10.2026: telefonda basma animasyonları KALDIRILDI (App Store sonrasına)
  setupTapHover();
  setupPull();
}

// Telefonda dokunma hissi: kart/düğmeye basınca yumuşakça içe göçer, çok kısa dokunuşta bile en az ~120 ms basılı görünür,
// bırakınca hafif yaylanarak geri gelir (CSS :active iPhone'da bir an yanıp sönüyordu, "çiğ" duruyordu).
// Telefonda çekip yenile (29.10.2026, 3. sürüm): telefonun KENDİ yaylanması açık (html overscroll-behavior serbest;
// kullanıcı kendi yaptığımız yaylanmayı az ve takılgan buldu). Android'de tarayıcının kendi "çekip yenile"si çalışır → bizimki yok.
// iPhone'da (ana ekran uygulamasında tarayıcı yenilemesi yok): en üstte aşağı esnetince açılan boşlukta (üst menünün de üstünde)
// simge belirir, esneme miktarını (−scrollY) birebir izler; yeterince esnetip bırakınca sürüm denenir — yeni sürüm varsa sayfa
// yenilenir, yoksa yenilenmez (veriler canlı), simge sayfa yerine dönerken onunla birlikte kaybolur.
function setupPull() {
  if (!matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!IOS) return;
  const TH = 64;
  let box = null, finger = false, ready = false, busy = false, raf = 0;
  const ui = () => {
    if (box) return box;
    box = document.createElement('div'); box.className = 'ptr'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<span class="ptr-c"><i class="ptr-r"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4"/></svg></i></span><span class="ptr-t"></span>';
    document.body.appendChild(box); return box;
  };
  const paint = () => {
    raf = 0; const px = Math.max(0, -scrollY); if (!px && !box) return;
    const b = ui(); b.style.setProperty('--ptr', px + 'px'); b.style.setProperty('--ptr-k', Math.min(1, px / TH));
    if (finger && !busy) ready = px >= TH;
    b.className = 'ptr native' + (busy ? ' spin' : ready ? ' ready' : '');
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(paint); };
  addEventListener('scroll', req, { passive: true });
  addEventListener('touchstart', () => { finger = true; ready = false; }, { passive: true });
  addEventListener('touchmove', req, { passive: true });
  const toast2 = (t) => { const b = ui(); b.querySelector('.ptr-t').textContent = t; b.classList.add('err', 'show'); setTimeout(() => { b.querySelector('.ptr-t').textContent = ''; b.classList.remove('err', 'show'); }, 2200); };
  addEventListener('touchend', async () => {
    finger = false; if (!ready || busy || document.querySelector('.sheet-bg, .lb, .vv')) { ready = false; return; }
    ready = false; busy = true; req();
    try {
      if (navigator.onLine === false) throw new Error('İnternet bağlantısı yok');
      const c = new AbortController(); const tm = setTimeout(() => c.abort(), 7000);
      const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store', signal: c.signal }); clearTimeout(tm);
      if (!r.ok) throw new Error('Bağlantı kurulamadı');
      const j = await r.json().catch(() => ({}));
      if (j.v && window.__BUILD && j.v !== window.__BUILD) { location.reload(); return; }
    } catch (e) { toast2(e.name === 'AbortError' || !e.message ? 'Bağlantı kurulamadı' : e.message); }
    busy = false; req();
  }, { passive: true });
}

// Telefonda (29.10.2026): basma animasyonu yerine bilgisayardaki "üstüne gelince" görünümü (marka kutusunda renk + ok,
// reklam kutusunda eğik resmin düzelmesi, kartın kalkması) SADECE gerçek dokunuşta kısa süre gösterilir (.th).
// Parmak kayarsa / sayfa kayarsa hiç başlamaz ya da hemen geri döner. Kartın içindeki düğmeye (+ vb.) basınca kart oynamaz.
function setupTapHover() {
  if (!matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const SEL = '.sh-brand, .sh-box, .sh-card, .mini-card, .plist.pgrid > li.prow, .sh-cta-btn, .sh-more';
  let cand = null, on = null, tm = 0, sx = 0, sy = 0, sY = 0, off = 0;
  const clear = (e) => { if (e) e.classList.remove('th'); };
  const cancel = () => { clearTimeout(tm); cand = null; if (on) { clear(on); on = null; } };
  const show = (e) => { clearTimeout(off); if (on && on !== e) clear(on); e.classList.add('th'); on = e; };
  addEventListener('touchstart', (ev) => {
    cancel(); if (ev.touches.length !== 1) return;
    const t = ev.target; const e = t instanceof Element && t.closest(SEL); if (!e || e.closest('.dz')) return;
    const inner = t.closest('button, a, input, select, textarea, [role="button"]'); if (inner && inner !== e && e.contains(inner)) return;
    cand = e; sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; sY = scrollY;
    tm = setTimeout(() => { if (cand === e && Math.abs(scrollY - sY) < 2) show(e); }, 130);
  }, { passive: true });
  addEventListener('touchmove', (ev) => { const p = ev.touches[0]; if ((cand || on) && p && Math.hypot(p.clientX - sx, p.clientY - sy) > 8) cancel(); }, { passive: true });
  addEventListener('scroll', () => { if ((cand || on) && Math.abs(scrollY - sY) > 2) cancel(); }, { passive: true, capture: true });
  addEventListener('touchend', () => {
    clearTimeout(tm); const e = cand; cand = null; if (!e) return;
    show(e); off = setTimeout(() => { clear(e); if (on === e) on = null; }, 380);
  }, { passive: true });
  addEventListener('touchcancel', cancel, { passive: true });
}

function setupPress() {
  // 29.10.2026: basma hissi SADECE gerçek basışta. Parmak değer değmez değil, 70 ms kıpırdamadan durursa içe göçer;
  // kaydırmaya başlarsa hiç başlamaz (sayfa kayarken kartlar oynamasın). Hızlı dokunuşta kısa bir "tık" gösterilir.
  // Basıp parmağı kaydırarak vazgeçince yumuşakça eski hâline döner.
  const SEL = '.ocard, .rcard, .ucard, .seg-card, .addr-card:not(.static), .tile, .dash-kpi, .dash-q, .door, .cat-link, .pcard, .btn, .chip, .icon-btn, .stepper button, .sh-brand, .sh-box, .sh-card, .mini-card, .sh-cta-btn, .sh-more';
  let el = null, cand = null, tm = 0, t0 = 0, sx = 0, sy = 0;
  const up = (e, fast) => { e.classList.remove('tp'); e.classList.add('tp-rel'); setTimeout(() => e.classList.remove('tp-rel'), 520); };
  const press = (e) => { e.classList.remove('tp-rel'); e.classList.add('tp'); el = e; t0 = Date.now(); };
  const cancel = () => { clearTimeout(tm); cand = null; if (el) { const e = el; el = null; up(e); } };
  addEventListener('touchstart', (ev) => {
    cancel();
    if (ev.touches.length !== 1) return;
    const t = ev.target; const e = t instanceof Element && t.closest(SEL);
    if (!e || e.disabled || e.closest('.botnav, .ctx-sheet-bg, .dz')) return;
    cand = e; sx = ev.touches[0].clientX; sy = ev.touches[0].clientY;
    tm = setTimeout(() => { if (cand === e) press(e); }, 70);
  }, { passive: true });
  addEventListener('touchmove', (ev) => { const p = ev.touches[0]; if ((cand || el) && p && Math.hypot(p.clientX - sx, p.clientY - sy) > 6) cancel(); }, { passive: true });
  addEventListener('touchend', () => {
    clearTimeout(tm);
    if (cand && !el) { const e = cand; cand = null; press(e); setTimeout(() => { if (el === e) { el = null; up(e); } }, 90); return; } // hızlı dokunuş: kısa tık
    cand = null; const e = el; if (!e) return;
    setTimeout(() => { if (el === e) { el = null; up(e); } }, Math.max(0, 90 - (Date.now() - t0)));
  }, { passive: true });
  addEventListener('touchcancel', cancel, { passive: true });
  addEventListener('scroll', () => { if (el || cand) cancel(); }, true);
}

// Telefonda uzun basınca, masaüstündeki sağ tık menüsü açılır (iPhone Safari'de sağ tık olayı hiç gelmez, Android'de
// kendi menüsüyle karışmasın diye tarayıcınınki engellenir). Basılı tutulan kart hafifçe içe göçer, menü alttan açılır.
function setupLongPress() {
  let tm = null, sx = 0, sy = 0, el = null, fired = 0;
  const NO = 'input, textarea, select, [contenteditable="true"], .ctx, .ctx-sheet-bg, .lb, .botnav, .dz, .sheet-grab, .vv, .gal-vid';
  const clear = () => { clearTimeout(tm); tm = null; el?.classList.remove('lp-press'); el = null; };
  addEventListener('touchstart', (e) => {
    clear();
    const T = store.s.settings?.shop?.touch || {};
    if (e.touches.length !== 1 || T.longPress === false || T.select === 'all') return;
    const t = e.target; if (!(t instanceof Element) || t.closest(NO)) return;
    const p = e.touches[0]; sx = p.clientX; sy = p.clientY;
    el = t.closest('li, .ucard, .rcard, .ocard, .gline, .prow, .pcard');
    tm = setTimeout(() => {
      tm = null;
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: sx, clientY: sy });
      ev.lp = true;
      t.dispatchEvent(ev);
      if (store.s.ctx) { fired = Date.now(); try { navigator.vibrate?.(10); } catch {} }
      el?.classList.remove('lp-press'); el = null;
    }, 460);
    if (el) setTimeout(() => tm && el?.classList.add('lp-press'), 260);
  }, { passive: true });
  addEventListener('touchmove', (e) => { if (!tm) return; const p = e.touches[0]; if (!p || Math.hypot(p.clientX - sx, p.clientY - sy) > 14) clear(); }, { passive: true });
  addEventListener('touchend', (e) => { clear(); if (fired && Date.now() - fired < 2000) { e.preventDefault(); fired = 0; } }, { passive: false });
  addEventListener('touchcancel', clear);
  addEventListener('scroll', clear, true);
  // Android'in kendi uzun basma menüsü: yazı kutuları dışında kapalı (bizimki açılıyor)
  addEventListener('contextmenu', (e) => { if (!e.isTrusted) return; const t = e.target; if (t instanceof Element && t.closest('input, textarea, [contenteditable="true"]')) return; e.preventDefault(); e.stopPropagation(); }, true);
}
createRoot(document.getElementById('root')).render(<App />);
boot();

// Telefon alt menüsü: seçili sekmenin küçük hapı iOS gibi parmağı izler. Basılı tutup kaydırınca hap hafifçe büyüyerek
// parmakla birebir kayar (DOM'a doğrudan yazılır, gecikme yok), bırakılan sekmeye yumuşakça oturup eski boyuna döner.
// iPhone alt kenar hareketi dokunuşu elinden alırsa (touchcancel) yine son gösterilen sekmeye geçer.
function BotNav({ items, tab, badge }) {
  const ref = useRef(null);
  const pill = useRef(null);
  const [hov, setHov] = useState(-1);
  const [geo, setGeo] = useState(null); // { cs: [sekme ortaları], top }
  const st = useRef(null);
  const live = useRef({});
  const keys = items.map((x) => x[0]).join(',');
  const measure = () => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const bs = [...el.querySelectorAll('.botnav-b')];
    const ic = el.querySelector('.botnav-i');
    if (!bs.length || !ic) return;
    setGeo({ cs: bs.map((b) => { const q = b.getBoundingClientRect(); return q.left - r.left + q.width / 2; }), top: ic.getBoundingClientRect().top - r.top });
  };
  useLayoutEffect(() => { measure(); const f = () => measure(); addEventListener('resize', f); return () => removeEventListener('resize', f); }, [keys]);
  live.current = { geo, items };
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const place = (x) => { if (pill.current) pill.current.style.transform = `translateX(${x - 32}px)`; };
    const track = (cx) => {
      const { geo: g } = live.current; if (!g) return;
      const r = el.getBoundingClientRect(); const lx = cx - r.left;
      const x = Math.min(g.cs[g.cs.length - 1], Math.max(g.cs[0], lx));
      let i = 0, best = 1e9; g.cs.forEach((c, n) => { const d = Math.abs(c - lx); if (d < best) { best = d; i = n; } });
      const s = st.current; if (!s) return;
      if (s.i !== i) { if (s.i != null) { s.moved = true; try { navigator.vibrate?.(6); } catch {} } s.i = i; setHov(i); }
      place(x);
    };
    const finish = (go_) => {
      const s = st.current; st.current = null;
      el.classList.remove('dragging', 'pressing'); setHov(-1);
      if (pill.current) pill.current.style.transform = `translateX(${pill.current.dataset.x - 32}px)`; // aktif sekmeye yumuşakça döner
      if (s && s.i != null && go_) go(live.current.items[s.i][0]);
    };
    const start = (e) => { const t = e.touches[0]; if (!t || e.touches.length > 1) return; st.current = { i: null }; el.classList.add('pressing'); track(t.clientX); };
    const move = (e) => { if (!st.current) return; e.preventDefault(); el.classList.add('dragging'); const t = e.touches[0]; if (t) track(t.clientX); };
    const end = (e) => {
      if (!st.current) return;
      const t = e.changedTouches?.[0];
      const away = t && t.clientY < el.getBoundingClientRect().top - 40; // menüden yukarı çekip bıraktıysa vazgeç
      e.preventDefault(); // tıklama tekrar tetiklenmesin
      finish(!away);
    };
    const cancel = () => finish(true); // sistem hareketi dokunuşu aldı: son gösterilen sekmeye geç
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', cancel);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', cancel); };
  }, []);
  const ai = items.findIndex((x) => x[0] === tab);
  const px = geo && ai >= 0 ? geo.cs[ai] : null;
  return (
    <nav ref={ref} className="botnav" aria-label="Alt menü">
      {geo && px != null && <span ref={pill} className="botnav-pill" data-x={px} style={{ top: geo.top, transform: `translateX(${px - 32}px)` }} aria-hidden="true"><i /></span>}
      {items.map(([k, l, i, sh], n) => (
        <button key={k} className={'botnav-b' + (tab === k ? ' on' : '') + (hov === n ? ' hov' : '')} onClick={() => go(k)}>
          <span className="botnav-i"><Icon n={i} s={22} />{badge(k) > 0 && <span key={badge(k)} className="badge">{badge(k)}</span>}</span>
          <span>{sh || l}</span>
        </button>
      ))}
    </nav>
  );
}
