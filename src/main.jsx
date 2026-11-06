import { LinkCartPage, LinkCartsPage } from './lcart.jsx';
import { PayLinkPage, PayLinkView } from './paylink.jsx';
import { SaveDock } from './savedock.jsx';
import { StoreDecor } from './decor.jsx';
import { activePack, lookColors, logoFilter, ensureLogoSvg } from './presets.js';
import { applyStyle } from './stylekit.js';
import { applyLayout, lookFor } from './dzpresets.js';
import { sfx, setSfxGlobal, setupSfxTaps } from './sfx.js';
import { SoundButton } from './soundui.jsx';
import { RatePrompt } from './reviews.jsx';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ProductsDrop, AdminDrop, ProfileDrop, BrandsDrop } from './navdrop.jsx';
import { SetPage, SetsAdmin, setIdFromPath } from './sets.jsx';
import { BrandsPage, SetsPage } from './brandsets.jsx';
import { startAdminWatchers, stopAdminWatchers } from './datawin.js';
import { loadFavs, mergeFavs } from './store.js';
import { linkMember } from './push.js';
import { store, useStore, setCatalog, loadCart, go, home, toast, openRequest, openOrder, tabFromPath, startHistory, acctFromPath, pidFromPath, storeListen } from './store.js';
import { ROUTE, links, lpath } from './route.js';
import { seoRoute } from './seo.js';
import { withDefaults, ls, cleanUsername, mediaFallback } from './utils.js';
import { LOGO_MARK, LOGO_WIDE, DEFAULT_SETTINGS, SPLASH_STYLES } from './config.js';
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
import { AiAdd } from './aiadd.jsx';
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
  // 6.11.2026 önizleme adresinde (adında '--'): Tasarım modunda 'Yayınla' canlıya değil bu tarayıcıya kaydedilir (ls 'pv-design');
  // mağaza tarafı açılınca o tasarım üstüne yazılır → yöneticisiz mağaza görünümünde denenir, canlı mağaza değişmez
  const pvd = PV_HOST ? ls.get('pv-design', null) : null;
  const applyPub = (pub) => pub && store.set({ settings: migrate(withDefaults({ ...store.s.settings, ...pub, ...(pvd || {}), v: pub.v || 0 })) });
  const cachedPub = ls.get('pub-info', null);
  applyPub(cachedPub);
  const pubP = A.publicInfo().then((pub) => { if (pub) { ls.set('pub-info', pub); if (!store.s.user || store.s.user.role === 'public') applyPub(pub); } }).catch(() => {});
  // 1.11.2026 (kullanıcı: ana ekran uygulamasında çekince banner değişikliği gelmiyordu): mağaza ayarları açılışta BİR KEZ
  // okunuyordu. Çekip yenileyince (soft-refresh, setupPull bekler) ve uygulama arka plandan dönünce (≥45 sn) yeniden okunur.
  let pubAt = Date.now();
  const refreshPub = () => { pubAt = Date.now(); return A.publicInfo().then((pub) => { if (pub) { ls.set('pub-info', pub); if (!store.s.user || store.s.user.role === 'public') applyPub(pub); } }); };
  window.__refreshPub = refreshPub;
  if (A.mode !== 'firebase') window.__store = store; // sadece demo: otomatik denemeler için
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - pubAt > 45000 && (!store.s.user || store.s.user.role === 'public')) refreshPub().catch(() => {}); });
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
  if (admin && ROUTE.orderId) { history.replaceState(null, '', '/admin/siparisler'); openOrder(ROUTE.orderId); }
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
    if (fb && A.hasDescBuckets) A.hasDescBuckets().then((h) => !h && A.loadDescMap().then((d) => A.saveDescs(d))).catch((e) => console.warn(e)); // açıklama kovaları (tek ürün açılınca az veri)
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
  A.onSocialDone = (e) => toast(e ? 'Google ile giriş tamamlanamadı, tekrar deneyin' : 'Giriş yapıldı', e ? 'bad' : undefined);
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
  if (ROUTE.lcartId) { loadCart(); store.set({ boot: 'ready', tab: 'lsepet' }); }
  if (ROUTE.payId) { loadCart(); store.set({ boot: 'ready', tab: 'odeme' }); } // ödeme linki // sepet linki katalog beklemeden açılır
  // Liste linki (WhatsApp'tan gelen) katalog yüklenmesini beklemeden hemen açılır
  if (ROUTE.reqId && !ROUTE.orderId) { loadCart(); store.set({ boot: 'ready', tab: 'talepler', openReq: ROUTE.reqId }); }
  const cached = A.cachedCatalog ? await A.cachedCatalog(true) : null;
  // Google'dan gelen marka / kategori sayfası (/marka/jbc, /kategori/havya-istasyonu): Ürünler o süzgeçle açılır (çözümü Catalog yapar)
  if (ROUTE.notFound) {
    try { const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m); } catch {}
  }
  const seo = ROUTE.listCode ? null : seoRoute(lpath());
  if (seo) store.set({ seoGo: seo });
  const firstTab = ROUTE.listCode ? 'liste' : ROUTE.notFound ? 'yok' : seo ? 'katalog' : tabFromPath() || shopFirst();
  if (firstTab === 'hesap') store.set({ acct: acctFromPath() });
  if (firstTab === 'urun') store.set({ pid: pidFromPath() });
  if (firstTab === 'set') store.set({ setId: setIdFromPath() });
  if (ROUTE.listCode) { loadCart(); store.set({ boot: 'ready', tab: 'liste', openReq: null }); } // linkli liste katalogu beklemeden açılır (yüklenene kadar kendi bekleme ekranı var)
  if (cached) setCatalog(cached.items);
  const direct = ROUTE.reqId || ROUTE.listCode || ROUTE.orderId || ROUTE.authAction || ROUTE.lcartId || ROUTE.payId;
  if (cached && !direct) { loadCart(); store.set({ boot: 'ready', tab: firstTab, openReq: null }); }
  try {
    setCatalog(await A.loadPublicCatalog());
    A.watchCatalog?.((items) => items && setCatalog(items), true);
    if (!direct && !cached) { loadCart(); store.set({ boot: 'ready', tab: firstTab, openReq: null }); }
  } catch (e) { if (!direct && !cached) store.set({ boot: 'error', bootError: 'Vitrin yüklenemedi: ' + e.message }); }
}

// Tema: yöneticinin varsayılanı + her cihazın kendi seçimi (üst menüdeki güneş/ay düğmesi)
// zayıf bilgisayar mı: dokunmatik olmayan cihazda ≤4 çekirdek / ≤4 GB bellek ya da açılışta kareler yavaşsa (telefona bakılmaz)
const LOW_END = { v: false };
const FINE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;
if (FINE && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4)) LOW_END.v = true;
function useLowEndProbe() {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!FINE || LOW_END.v) return;
    let n = 0, slow = 0, prev = 0, raf = 0;
    const tick = (ts) => { if (prev) { n++; if (ts - prev > 34) slow++; } prev = ts; if (n < 90) raf = requestAnimationFrame(tick); else if (slow > 30) { LOW_END.v = true; setT(1); } };
    const st = setTimeout(() => { raf = requestAnimationFrame(tick); }, 2500); // açılış yüklemesi bittikten sonra ~1,5 sn ölçülür
    return () => { clearTimeout(st); cancelAnimationFrame(raf); };
  }, []);
  return t;
}
const hexLight = (h) => { const x = h.replace('#', ''); const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x; const n = parseInt(f.slice(0, 6), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 160; };
const PV_HOST = typeof location !== 'undefined' && /--/.test(location.hostname);
// önizleme adresinde, bu tarayıcıya kaydedilmiş deneme tasarımı açıkken mağazada küçük bir uyarı + kaldır düğmesi
function PvBadge() {
  if (!PV_HOST || !ls.get('pv-design', null) || store.s.user?.role !== 'public') return null;
  return <div className="pv-badge"><b>Önizleme tasarımı</b><small>Sadece bu tarayıcıda</small><button type="button" onClick={() => { ls.set('pv-design', null); location.reload(); }}>Kaldır</button></div>;
}
// 6.11.2026: üst/alt menüden Ürünler'e basınca 'Ürünler açılış sayfası' açıksa her seferinde o sayfa gelir (Tüm ürünler'e bir kez basınca kaybolmasın)
const navGo = (k) => { if (k === 'katalog' && store.s.user?.role === 'public' && store.s.settings?.look?.prodHub) store.set({ catalogGo: { hub: true } }); go(k); };
function useTheme() {
  const liteTick = useLowEndProbe();
  const isAdm = useStore((s) => s.user?.role === 'admin');
  const S = useStore((s) => s.settings);
  const dev = useStore((s) => s.deviceTheme);
  const pub = useStore((s) => s.user?.role === 'public');
  const L = S.look || {};
  const pk = pub ? activePack(L) : null; const pp = pk?.palette;
  useEffect(() => {
    const r = document.documentElement;
    // mağaza ve bayi renkleri ayrı (Ayarlar > Renkler ve görünüm); Tema Stüdyosu açıksa onun renkleri
    // 1.11.2026: 'temada da kullan' kilitli renkler (look.keep) temanın üstüne yazar (lookColors)
    const lc = lookColors(L, pk);
    r.style.setProperty('--accent-user', (pub && lc.accent) || S.brand.accent);
    r.style.setProperty('--price-user', (pub && lc.price) || S.brand.priceAccent);
    const bg = pub && lc.bg;
    if (bg) r.style.setProperty('--bg-user', bg); else r.style.removeProperty('--bg-user');
    const bd = pk?.badge;
    r.classList.toggle('pk-on', !!bd); if (bd) { r.style.setProperty('--pk-badge', JSON.stringify(bd.text || '')); r.style.setProperty('--pk-bbg', bd.bg || '#111'); r.style.setProperty('--pk-bfg', bd.color || '#fff'); }
    r.style.setProperty('--pcard-r', (Number(L.cardR) >= 0 && L.cardR !== '' ? Number(L.cardR) : 18) + 'px');
    // logo rengi temaya uysun mu (Tasarım › Renkler ve sayfa › Logo rengi; varsayılan orijinal)
    const lf = pub ? logoFilter(L.logoTone, lc.accent || S.brand.accent) : '';
    if (pub && (L.logoTone === 'color' || L.logoTone === 'flat')) ensureLogoSvg(document, L.logoColor || lc.accent || S.brand.accent);
    if (lf) r.style.setProperty('--logo-f', lf); else r.style.removeProperty('--logo-f');
    applyStyle(r, pub ? L.style : null);
    setSfxGlobal(L.sound !== false);
    // 5.11.2026 yönetim paneli teması (Ayarlar › Bayi ve panel renkleri › Yönetim paneli görünümü, look.admin: apple | classic)
    r.classList.toggle('adm-on', isAdm); r.classList.toggle('adm-mini', isAdm && ls.get('adm-mini', false) === true); /* 6.11.2026 daraltılmış yan menü (cihazda) */ r.classList.toggle('adm-apple', isAdm && L.admin !== 'classic'); r.classList.toggle('adm-mark', isAdm && L.adminMark !== false); /* 6.11.2026 telefonda panel belirgin: koyu alt menü + Yönetim rozeti (kapatılabilir) */
    // 5.11.2026 hafif mod (look.lite: auto | on | off): eski bilgisayarda bulanık camlar kapanır → kaydırma akıcı
    r.classList.toggle('lite', L.lite === 'on' || (L.lite !== 'off' && LOW_END.v));
    applyLayout(r, pub ? L : {});
    r.classList.remove('fr-1', 'fr-2');
    r.classList.toggle('pill-dark', !!pub && L.pillTone === 'dark');
    { const ph = pub ? L.pillHov : ''; if (ph === 'ink') r.style.setProperty('--pill-hov', 'var(--fg)'); else if (ph === 'none') r.style.setProperty('--pill-hov', 'currentColor'); else if (/^#/.test(ph || '')) r.style.setProperty('--pill-hov', ph); else r.style.removeProperty('--pill-hov'); } // üstüne gelince simge rengi
    r.classList.toggle('porc', !!pub && L.porc === true); // 6.11.2026 Paket 0 porselen kutular (bulanıklıksız parlak beyaz) // 6.11.2026 siyah hap (Tasarım › Cam ve hareket) // 6.11.2026 buzlu cam kaldırıldı (kullanıcının kastettiği bu değildi)
    // 6.11.2026 'Sepete ekle' rengi temadan bağımsız (Tasarım › Ürün kartları › Sepete ekle rengi): gray (varsayılan) | accent (eski) | dark | #hex
    const ac = pub ? (L.addColor || 'gray') : 'accent';
    ['gray', 'dark', 'hex'].forEach((k) => r.classList.toggle('addc-' + k, ac === k || (k === 'hex' && /^#/.test(ac))));
    if (/^#/.test(ac)) { r.style.setProperty('--add-hex', ac); r.style.setProperty('--add-hfg', hexLight(ac) ? '#111' : '#fff'); } // 5.11.2026 sayfa genişliği, kenar boşluğu, kutu deseni, zemin ışığı (Tasarım › Sayfa)
    // 3.11.2026 telefon alt menüsü görünümü (Tasarım › Renkler ve sayfa › Telefon alt menüsü); sadece mağazada
    const bn = pub ? (['glass', 'dark', 'bar', 'classic'].includes(L.botnav) ? L.botnav : 'glass') : 'classic';
    ['glass', 'dark', 'bar'].forEach((k) => r.classList.toggle('bn-' + k, bn === k));
    // 5.11.2026 site teması 'dash' (CRM paneli gibi bakır gece): her zaman koyu → mağazada gece modu zorlanır
    const forced = !!pub && L.site === 'dash';
    // 5.11.2026 kullanıcı: mağaza varsayılan AYDINLIK açılsın (telefon gece modunda olsa da); gece modu sadece düğmeyle
    const t = forced ? 'dark' : (dev || (pub && S.brand.theme === 'auto' ? 'light' : S.brand.theme));
    if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
    // 5.11.2026 site teması (look.site): 'apple' = gündüz Apple açık, GECE Bakır gece (aynı şekiller, koyu renkler); 'dash' = hep Bakır gece
    const effDark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const dash = forced || (!!pub && (L.site || 'apple') === 'apple' && effDark);
    r.classList.toggle('th-dash', dash); r.classList.toggle('th-dash-force', forced);
    r.classList.toggle('th-apple', !!pub && (L.site || 'apple') === 'apple' && !effDark); // varsayılan Apple açık (5.11.2026, kullanıcı onayı)
    document.title = seoTitle() || S.brand.appName;
  }, [S.brand, dev, pub, L.shopAccent, L.shopPrice, L.bg, L.cardR, L.logoTone, L.logoColor, L.botnav, L.site, L.width, L.edge, L.boxPat, L.bgFx, L.sound, L.lite, liteTick, isAdm, L.admin, JSON.stringify(L.style || null), JSON.stringify(L.keep || null), JSON.stringify(pk)]);
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
  const pubT = useStore((s) => s.user?.role === 'public');
  const cur = dev || (pubT && S.brand.theme === 'auto' ? 'light' : S.brand.theme);
  const dark = cur === 'dark' || (cur === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  // 5.11.2026: gece/gündüz geçişi (Tasarım › Cam ve hareket › Gece/gündüz geçişi, look.darkFx): circle daireden yayılma (varsayılan) ·
  // fade yumuşak solma · curtain perde (yukarıdan) · none anında. Akıcı olsun diye geçiş süresince bulanık camlar kapatılır (html.vt-lite):
  // yeni sayfanın anlık görüntüsü ucuz çıkar, animasyon sadece ekran kartında oynar.
  const fx = S.look?.darkFx || 'circle';
  const flip = (e) => {
    const n = dark ? 'light' : 'dark';
    const R0 = document.documentElement;
    const apply = () => { ls.set('device-theme', n); R0.setAttribute('data-theme', n); flushSync(() => store.set({ deviceTheme: n })); };
    if (fx === 'none' || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
    const r = e.currentTarget.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    R0.classList.add('vt-lite', 'vt-' + fx);
    const t = document.startViewTransition(apply);
    const kf = fx === 'fade' ? [{ opacity: 0 }, { opacity: 1 }]
      : fx === 'curtain' ? [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }]
      : [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)` }];
    t.ready.then(() => R0.animate(kf, { duration: fx === 'fade' ? 420 : 560, easing: 'cubic-bezier(.33, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
    t.finished.finally(() => R0.classList.remove('vt-lite', 'vt-' + fx));
    sfx('tap');
  };
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
          {!adminPage && <p className="fine center"><a className="link" href="/">← Mağazaya dön</a></p>}
        </form>
      )}
    </div>
  );
}

// [sekme, ad, ikon, telefondaki kısa ad]
const NAV_USER = [['anasayfa', 'Ana sayfa', 'home'], ['katalog', 'Tüm ürünler', 'grid', 'Ürünler'], ['sepet', 'Sepet', 'cart'], ['talepler', 'Siparişlerim', 'box', 'Siparişler'], ['profil', 'Hesabım', 'user']];
const NAV_ADMIN = [['anasayfa', 'Ana sayfa', 'home', 'Özet'], ['talepler', 'Bayi siparişleri', 'chat', 'Bayi'], ['siparisler', 'Siparişler', 'box'], ['siparis', 'Form oluştur', 'tag', 'Form'], ['katalog', 'Ürünler', 'grid'], ['musteriler', 'Müşteriler', 'users'], ['tasarim', 'Tasarım', 'brush'], ['ayarlar', 'Ayarlar', 'gear']];
const NAV_PUBLIC = [['anasayfa', 'Ana sayfa', 'store'], ['katalog', 'Ürünler', 'grid', 'Ürünler'], ['kalip', 'Kalıp bulucu', 'chip', 'Kalıp'], ['sepet', 'Sepet', 'cart'], ['hesap', 'Hesabım', 'user']];
// Sayfa bulunamadı (tanınmayan mağaza adresi; Google'a noindex boot'ta eklenir)
function NotFound() {
  return (
    <div className="page nf-page">
      <div className="nf-ic"><Icon n="search" s={34} /></div>
      <div className="nf-code">404</div>
      <h1>Aradığınız sayfa bulunamadı</h1>
      <p>Bu adres değişmiş ya da hiç var olmamış olabilir. Ana sayfadan devam edebilir ya da tüm ürünlere göz atabilirsiniz.</p>
      <div className="nf-act">
        <button className="btn primary" onClick={() => go('anasayfa')}><Icon n="home" s={18} /> Ana sayfaya dön</button>
        <button className="btn" onClick={() => go('katalog')}>Tüm ürünler</button>
      </div>
    </div>
  );
}
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
    admin && { label: 'Vitrin linkini kopyala', icon: 'copy', hint: location.host, onClick: () => copyText(links.shop(), 'Vitrin linki kopyalandı') },
    '-',
    { label: 'Temayı değiştir', icon: 'moon', onClick: () => document.querySelector('[data-theme-btn]')?.click() },
    { label: 'Yenile', icon: 'refresh', onClick: () => location.reload() },
  ]);
}

// /siparisformu: menüsüz, tek sayfa sipariş formu (yönetim panelinin oturumunu kullanır)
function FormOnlyShell() {
  const { user, api: A } = useStore();
  useEffect(() => { document.title = 'Form oluştur'; const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m); }, []);
  return (
    <div className="shell admin form-only tab-siparis">
      <header className="topbar">
        <div className="topbar-in">
          <Brand small />
          <span className="admin-badge"><Icon n="tag" s={14} />Form oluştur</span>
          <span className="top-sp" />
          <ThemeButton />
          <button className="icon-btn logout-btn" onClick={() => A.logout()} aria-label="Çıkış yap" title="Çıkış yap"><Icon n="out" s={18} /></button>
        </div>
      </header>
      <main className="main"><OrderForm /></main>
    </div>
  );
}

// Site bekçisinin Google için yazdığı sayfa başlığı (ör. "JBC Ürünleri ve Fiyatları | ERTEL GSM") o adreste kalsın;
// başka sayfaya geçince uygulama adı (site/worker.js x-seo-path etiketi)
const SEO0 = (() => { try { return { path: document.querySelector('meta[name="x-seo-path"]')?.content || '', title: document.title }; } catch { return {}; } })();
const seoTitle = () => (SEO0.path && location.pathname === SEO0.path ? SEO0.title : '');
function Shell() {
  if (ROUTE.formOnly) return <FormOnlyShell />;
  return <ShellFull />;
}
// Telefonda ana sayfadan açılan ürün sayfası: ana sayfanın üstünde, kendi kaydırması olan katman (store.urunLayer)
function PPLayer({ pid }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [pid]); // üründen ürüne geçince başa
  return <div className="pp-layer" ref={ref}><ProductPage id={pid} /></div>;
}
// 3.11.2026: arkada açık tutulan ana sayfa ve Ürünler, kabuk (sekme değişimi) yeniden çizilince BAŞTAN çizilmesin — kendi store
// abonelikleriyle zaten güncellenirler. Ölçüm: Ürünler'e geçişte dokunuş işleyicisi ~45 ms → çok daha az.
const HomeM = memo(ShopHome);
const CatalogM = memo(Catalog);
// 5.11.2026 sadece demo: mağaza ⇄ yönetim paneli geçişi (Claude'daki demo sayfasında adres çubuğundan /admin yazılamıyor)
function DemoSwitch({ admin }) {
  const sw = () => { try { location.hash = admin ? '' : 'admin'; } catch {} location.reload(); };
  return <button type="button" className="demo-sw" onClick={sw} title={admin ? 'Mağazaya dön' : 'Yönetim paneli · giriş: admin / admin'}>
    <Icon n={admin ? 'store' : 'shield'} s={15} /><span>{admin ? 'Mağazaya dön' : 'Yönetim paneli'}</span>{!admin && <small>admin / admin</small>}
  </button>;
}
function ShellFull() {
  const { user, tab, cart, requests, api: A, vitrinCode, vitrinOpen, openOrder: openOrderId, settings: S0, pid, urunFrom, urunLayer, setId } = useStore();
  const admin = user.role === 'admin';
  const pub = user.role === 'public';
  // telefonda: ana sayfa ve Tüm ürünler bir kez açılınca arkada gizli açık kalır → geri dönünce anında, filtreler ve kaydırma yerinde
  const kept = useRef(new Set()); if ((pub && (tab === 'anasayfa' || tab === 'katalog')) || (admin && tab === 'katalog')) kept.current.add(tab); // yönetici: Ürünler de arkada açık kalır
  // 3.11.2026: telefonda Ürünler'e İLK geçiş takılıyordu (yüzlerce kart ilk kez çiziliyordu, ölçüm: tek kare ~0,15 sn) → mağaza açıldıktan
  // birkaç saniye sonra, telefon boşta ve sayfa kaydırılmıyorken Ürünler arkada gizli hazırlanır; ilk geçiş de anında olur.
  const [, warm] = useState(0);
  useEffect(() => {
    if (!pub || kept.current.has('katalog')) return;
    let t = 0, idle = 0, lastScroll = 0; const onS = () => { lastScroll = Date.now(); };
    addEventListener('scroll', onS, { passive: true });
    const tryWarm = () => {
      if (kept.current.has('katalog')) return;
      if (Date.now() - lastScroll < 900 || document.body.classList.contains('noscroll')) { t = setTimeout(tryWarm, 1200); return; }
      const go2 = () => { kept.current.add('katalog'); warm((x) => x + 1); };
      idle = window.requestIdleCallback ? requestIdleCallback(go2, { timeout: 2500 }) : setTimeout(go2, 50);
    };
    t = setTimeout(tryWarm, 1200); // 5.11.2026: 3,5 sn → 1,2 sn (ilk geçişler 'F5 gibi' takılıyordu)
    return () => { clearTimeout(t); window.cancelIdleCallback?.(idle); removeEventListener('scroll', onS); };
  }, [pub]);
  const nav = admin ? NAV_ADMIN : pub ? NAV_PUBLIC.filter(([k]) => (k !== 'anasayfa' || S0.shopHome?.enabled !== false) && (k !== 'kalip' || S0.kalip?.on !== false)) : NAV_USER;
  const unread = requests.reduce((n, r) => n + ((admin ? r.unreadAdmin : r.unreadUser) > 0 ? 1 : 0), 0);
  const cartN = Object.keys(cart).length;
  const prev = useRef(unread);
  const [demoNote, setDemoNote] = useState(() => !ls.get('demo-note-off', false));
  useEffect(() => {
    if (unread > prev.current) { toast(admin ? 'Yeni bayi siparişi / mesaj geldi' : 'Dükkandan yeni mesaj', 'info'); try { navigator.vibrate?.(120); } catch {} }
    prev.current = unread;
    document.title = (unread ? `(${unread}) ` : '') + (seoTitle() || store.s.settings.brand.appName);
  }, [unread, tab, pid]);
  const pendingN = useStore((s) => s.customers.filter((c) => c.pending).length + (admin ? s.preqs.filter((q) => q.seenAdmin === false).length + (s.issues || []).filter((q) => q.seenAdmin === false).length + (s.reviews || []).filter((r) => r.status === 'pending').length : 0));
  const priceN = useStore((s) => (admin ? s.catalog.filter((p) => p.pc && p.w != null).length : 0));
  const newOrders = useStore((s) => (admin ? s.orders.filter((o) => o.unread).length : 0));
  const member = useStore((s) => s.member);
  const prevOrders = useRef(newOrders);
  useEffect(() => { if (admin && newOrders > prevOrders.current) toast('Mağazadan yeni sipariş geldi', 'info'); prevOrders.current = newOrders; }, [newOrders]);
  const lcNew = useStore((st) => (admin ? (st.lcarts || []).filter((c) => c.status === 'sent' && !c.seen).length : 0));
  const badge = (k) => (k === 'sepet' ? cartN : k === 'talepler' ? unread : k === 'musteriler' ? pendingN : k === 'katalog' ? priceN : k === 'siparisler' ? newOrders + lcNew : 0);
  // 3.11.2026 mağaza üst menüsü: 'classic' (eski) · 'center' (logo ortada, menü altında — Tasarım › Renkler ve sayfa › Üst menü)
  // 5.11.2026: her görünüm ayarı telefonda ayrı olabilir (look.headerM, hideTopM, glassM — Tasarım › 'Telefonda farklı')
  const phoneUI = usePhoneMQ();
  const LK = lookFor(S0.look, phoneUI);
  const hc = pub && LK.header === 'center';
  const hs = pub && (LK.header || 'search') === 'search';
  // üst menü türü ve cam tema html sınıfı (CSS :root:has(...) yerine — :has sayfa genelinde stil hesabını ağırlaştırıyordu)
  const lgOn = pub && LK.glass !== false;
  useEffect(() => { const c = document.documentElement.classList; c.toggle('hdr-gs-on', hs); c.toggle('hdr-c-on', hc); c.toggle('lg-on', lgOn); return () => c.remove('hdr-gs-on', 'hdr-c-on', 'lg-on'); }, [hs, hc, lgOn]);
  // cam + arama üst menü: sol (logo) ve sağ (simgeler) sütunu eşit genişlikte tutulur → arama kutusu tam ortada kalır, dar ekranda kısalır
  const gsRef = useRef(null);
  useLayoutEffect(() => {
    const h = gsRef.current; if (!h || !('ResizeObserver' in window)) return;
    const r1 = h.querySelector('.gs-r1'), a = h.querySelector('.gs-brand'), b = h.querySelector('.gs-icons'); if (!r1 || !a || !b) return;
    const f = () => r1.style.setProperty('--gs-side', Math.ceil(Math.max(a.scrollWidth, b.scrollWidth)) + 'px');
    f(); const ro = new ResizeObserver(f); ro.observe(a); ro.observe(b); return () => ro.disconnect();
  }, [hs]);
  const hasSets = pub && Array.isArray(S0.sets) && S0.sets.some((x) => x.on && (x.items || []).length); // 5.11.2026 'Cam + arama' (B+C karışımı): yüzen cam, ortada hep açık arama kutusu, altta kategori kısayolları
  useHideTop(pub && LK.hideTop !== false, LK.hideTop === 'up', tab, urunLayer);
  const navTab = tab === 'sepetler' ? 'siparisler' : tab === 'sepetlink' || tab === 'odemelink' ? 'siparis' : tab === 'setler' || tab === 'aiekle' ? 'katalog' : tab; // alt sayfalar menüde ana sekmesini yakar (Setler = Ürünler'in alt sayfası)

  return (
    <div className={'shell tab-' + tab + (admin ? ' admin' : '') + (pub ? ' public' : '')} onContextMenu={(e) => pageMenu(e, user.role)}>
      {hs ? <header className="topbar hdr-g hdr-gs" ref={gsRef}>
        <div className="topbar-in">
          <div className="gs-r1">
            <button className="gs-brand" onClick={home} aria-label="Ana sayfa" title="Ana sayfa"><img className="brand-logo" src={S0.brand.logo || LOGO_MARK} alt="" /><b style={S0.brand.nameColor ? { color: S0.brand.nameColor } : undefined}>{S0.brand.appName}</b></button>
            <span className="gs-srch"><HeaderSearch /></span>
            <span className="gs-icons">
              <ShopBell />
              <HeaderCart on={tab === 'sepet'} />
              <SoundButton />
              <ThemeButton />
              {member
                ? <ProfileDrop><button className={'me' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Hesabım"><span className="me-t"><b>{member.name || member.email}</b><small>Hesabım</small></span><Avatar u={member} size={34} /></button></ProfileDrop>
                : <button className={'btn sm outline me-login' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Giriş yap"><Icon n="user" s={16} /><span className="me-login-l">Giriş yap</span><span className="me-login-s">Giriş yap</span></button>}
            </span>
          </div>
          <nav className="topnav gs-nav" aria-label="Ana menü">
            {nav.filter(([k]) => k !== 'hesap' && k !== 'sepet' && k !== 'tasarim').map(([k, l, i]) => {
              const b = <button key={k} className={'topnav-b' + (navTab === k ? ' on' : '')} onClick={() => navGo(k)}><Icon n={i} s={16} /><span className="topnav-l">{l}</span>{k === 'katalog' && <span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span>}</button>;
              return k === 'katalog' ? <ProductsDrop key={k}>{b}</ProductsDrop> : b;
            })}
            <BrandsDrop><button className={'topnav-b' + (tab === 'markalar' ? ' on' : '')} onClick={() => go('markalar')}><Icon n="tag" s={16} /><span className="topnav-l">Markalar</span><span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span></button></BrandsDrop>
            {hasSets && <button className={'topnav-b' + (tab === 'setlist' ? ' on' : '')} onClick={() => go('setlist')}><Icon n="box" s={16} /><span className="topnav-l">Setler</span></button>}
          </nav>
        </div>
      </header> : hc ? <header className="topbar hdr-c">
        <div className="topbar-in">
          {/* 6.11.2026: bilgisayarda solda ses + gece düğmesi, sağda arama (logoya doğru uzar, diğerlerinin üstüne binmez) + bildirim; telefonda eskisi gibi */}
          <span className="hc-l">{phoneUI ? <><HeaderSearch /><ShopBell /></> : <><SoundButton /><ThemeButton /></>}</span>
          <button className="hc-mid" onClick={home} aria-label="Ana sayfa" title="Ana sayfa">
            <img className="brand-logo" src={S0.brand.logo || LOGO_MARK} alt="" />
            <b className="hc-name" style={S0.brand.nameColor ? { color: S0.brand.nameColor } : undefined}>{S0.brand.appName}</b>
          </button>
          <span className="hc-r">
            {!phoneUI && <><HeaderSearch /><ShopBell /></>}
            <HeaderCart on={tab === 'sepet'} />
            {phoneUI && <><SoundButton /><ThemeButton /></>}
            {member
              ? <ProfileDrop><button className={'me' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Hesabım"><span className="me-t"><b>{member.name || member.email}</b><small>Hesabım</small></span><Avatar u={member} size={34} /></button></ProfileDrop>
              : <button className={'btn sm outline me-login' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Giriş yap"><Icon n="user" s={16} /><span className="me-login-l">Giriş yap</span><span className="me-login-s">Giriş yap</span></button>}
          </span>
          <nav className="topnav hc-nav" aria-label="Ana menü">
            {nav.filter(([k]) => k !== 'hesap' && k !== 'sepet' && k !== 'tasarim').map(([k, l, i]) => {
              const b = <button key={k} className={'topnav-b' + (navTab === k ? ' on' : '')} onClick={() => navGo(k)}><span className="topnav-l">{l}</span>{k === 'katalog' && <span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span>}</button>;
              return k === 'katalog' ? <ProductsDrop key={k}>{b}</ProductsDrop> : b;
            })}
            <BrandsDrop><button className={'topnav-b' + (tab === 'markalar' ? ' on' : '')} onClick={() => go('markalar')}><span className="topnav-l">Markalar</span><span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span></button></BrandsDrop>
            {hasSets && <button className={'topnav-b' + (tab === 'setlist' ? ' on' : '')} onClick={() => go('setlist')}><span className="topnav-l">Setler</span></button>}
          </nav>
        </div>
      </header> : <header className={'topbar' + (pub && LK.header === 'glass' ? ' hdr-g' : '')}>
        <div className="topbar-in">
          <Brand small onClick={home} />
          {admin && <button type="button" className="adm-fold" onClick={() => { const on = !document.documentElement.classList.contains('adm-mini'); document.documentElement.classList.toggle('adm-mini', on); ls.set('adm-mini', on); }} aria-label="Menüyü daralt / genişlet" title="Menüyü daralt / genişlet"><Icon n="back" s={14} /></button>}
          {admin && <span className="admin-badge" title="Yönetim paneli"><Icon n="shield" s={14} /><span className="badge-t">Yönetim paneli</span></span>}
          {pub && <span className="pub-id"><b className="pub-name" style={S0.brand.nameColor ? { color: S0.brand.nameColor } : undefined}>{S0.brand.appName}</b></span>}
          <nav className="topnav" aria-label="Ana menü">
            {nav.filter(([k]) => !(pub && k === 'hesap') && (admin || k !== 'sepet') && k !== 'tasarim').map(([k, l, i]) => {
              const drop = (pub && k === 'katalog') || (admin && ['siparisler', 'siparis', 'katalog', 'musteriler'].includes(k));
              const b = (
                <button key={k} className={'topnav-b' + (navTab === k ? ' on' : '')} onClick={() => navGo(k)} title={l}>
                  <Icon n={i} s={18} /><span className="topnav-l">{l}</span>{badge(k) > 0 && <span key={badge(k)} className="badge">{badge(k)}</span>}{drop && <span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span>}
                </button>
              );
              return !drop ? b : pub ? <ProductsDrop key={k}>{b}</ProductsDrop> : <AdminDrop key={k} k={k}>{b}</AdminDrop>;
            })}
          </nav>
          <span className="top-sp" />
          {pub && <HeaderSearch />}
          {pub && <ShopBell />}
          {!admin && <HeaderCart on={tab === 'sepet'} />}
          {!admin && !pub && <a className="icon-btn to-landing" href="/" title="Mağazaya git" aria-label="Mağazaya git"><Icon n="store" s={19} /></a>}
          {admin && <NotifBell />}
          <ThemeButton />
          {pub && (member
            ? <ProfileDrop><button className={'me' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Hesabım"><span className="me-t"><b>{member.name || member.email}</b><small>Hesabım</small></span><Avatar u={member} size={34} /></button></ProfileDrop>
            : <button className={'btn sm outline me-login' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Giriş yap"><Icon n="user" s={16} /><span className="me-login-l">Giriş yap</span><span className="me-login-s">Giriş yap</span></button>)}
          {!pub && (
            <button className="me" onClick={() => go(admin ? 'ayarlar' : 'profil')} aria-label="Profil">
              <span className="me-t"><b>{user.name || user.username}</b><small>{admin ? 'Yönetici' : user.shop}</small></span>
              <Avatar u={user} size={34} />
            </button>
          )}
          {!pub && <button className="icon-btn logout-btn" onClick={() => A.logout()} aria-label="Çıkış yap" title="Çıkış yap"><Icon n="out" s={18} /></button>}
        </div>
      </header>}
      {A.mode === 'demo' && <DemoSwitch admin={admin} />}
      {pub && <PvBadge />}
      {A.mode === 'demo' && admin && demoNote && (
        <div className="demo-strip">
          <span><b>Demo modu.</b> Veriler sadece bu tarayıcıda. Bayi tarafını görmek için çıkış yapıp <code>ahmet / 1234</code> ile girin.</span>
          <button className="icon-btn sm" onClick={() => { setDemoNote(false); ls.set('demo-note-off', true); }} aria-label="Kapat"><Icon n="x" s={14} /></button>
        </div>
      )}
      <main className="main">
        {tab === 'anasayfa' && !admin && !pub && <HomePage />}
        {tab === 'anasayfa' && admin && <AdminHome />}
        {pub && (tab === 'anasayfa' || kept.current.has('anasayfa')) && <section className={'kp' + (tab === 'anasayfa' || (tab === 'urun' && urunLayer) ? '' : ' kp-off')}><HomeM /></section>}
        {tab === 'liste' && pub && <CodeList code={ROUTE.listCode} />}
        {tab === 'lsepet' && pub && <LinkCartPage id={ROUTE.lcartId} />}
        {tab === 'odeme' && pub && <PayLinkView id={ROUTE.payId} />}
        {tab === 'sepetlink' && admin && <OrderForm linkMode />}
        {tab === 'sepetler' && admin && <LinkCartsPage />}
        {tab === 'odemelink' && admin && <PayLinkPage />}
        {(tab === 'katalog' || ((pub || admin) && kept.current.has('katalog'))) && <section className={'kp' + (tab === 'katalog' ? '' : ' kp-off')}><CatalogM admin={admin} /></section>}
        {tab === 'sepet' && !admin && <Cart />}
        {tab === 'talepler' && <Requests />}
        {tab === 'profil' && !pub && <Profile />}
        {tab === 'musteriler' && admin && <Customers />}
        {tab === 'siparis' && admin && <OrderForm />}
        {tab === 'siparisler' && admin && <Orders />}
        {tab === 'siparis' && pub && <OrderPage id={openOrderId} />}
        {tab === 'hesap' && pub && <Account />}
        {tab === 'urun' && pub && (urunLayer ? <PPLayer pid={pid} /> : <ProductPage id={pid} />)}
        {tab === 'kalip' && pub && <KalipFinder />}
        {tab === 'set' && pub && <SetPage id={setId} />}
        {tab === 'markalar' && pub && <BrandsPage />}
        {tab === 'setlist' && pub && <SetsPage />}
        {tab === 'setler' && admin && <SetsAdmin />}
        {tab === 'aiekle' && admin && <AiAdd />}
        {tab === 'talep' && pub && <PreqPage />}
        {tab === 'yasal' && pub && <LegalPage />}
        {tab === 'yok' && pub && <NotFound />}
        {tab === 'sorun' && pub && <IssuePage />}
        {tab === 'islem' && pub && <AuthAction />}
        {tab === 'ayarlar' && admin && <Settings />}
        {tab === 'tasarim' && admin && <ShopDesigner />}
      </main>
      {pub && !['katalog', 'sepet', 'hesap', 'kalip'].includes(tab) && <ShopFooter compact={tab !== 'anasayfa'} />}
      {!admin && tab !== 'lsepet' && tab !== 'odeme' && <CartBar />}
      {admin && vitrinCode && <VitrinListEditor code={vitrinCode} onClose={() => store.set({ vitrinCode: null })} />}
      {admin && vitrinOpen && <OpenVitrinList onClose={() => store.set({ vitrinOpen: false })} />}
      <BotNav items={nav.filter(([k]) => k !== 'tasarim' && !(admin && k === 'siparis'))} tab={navTab} badge={badge} />
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
  const want = S.brand.splashOn !== false && !ADMIN_ROUTE && (() => { try { return !sessionStorage.getItem('intro-seen'); } catch { return true; } })();
  const [phase, setPhase] = useState(want ? 'in' : 'off');
  const [minDone, setMinDone] = useState(false);
  useEffect(() => { if (!want) return; try { sessionStorage.setItem('intro-seen', '1'); } catch {} const sec = Math.min(8, Math.max(0.5, Number(S.brand.splashSec) || 1.4)); const t = setTimeout(() => setMinDone(true), sec * 1000); const max = setTimeout(() => setPhase('out'), Math.max(sec + 3, 4.5) * 1000); return () => { clearTimeout(t); clearTimeout(max); }; }, []);
  useEffect(() => { if (phase === 'in' && minDone && ready) setPhase('out'); }, [minDone, ready, phase]);
  useEffect(() => { if (phase === 'out') { const t = setTimeout(() => setPhase('off'), 500); return () => clearTimeout(t); } }, [phase]);
  // arka plan seçeneği (Ayarlar > Genel > Açılış ekranı): navy | light | white | grad
  const sty = SPLASH_STYLES[S.brand.splashStyle] ? S.brand.splashStyle : 'navy';
  // index.html başındaki düz renkli örtü (pre-intro): JS yüklenene kadar arkada bir şey çizilmesin; açılış ekranı çizilince kalkar
  useLayoutEffect(() => { const h = document.documentElement; [...h.classList].filter((c) => c.startsWith('pre-')).forEach((c) => h.classList.remove(c)); }, []);
  useEffect(() => { try { localStorage.setItem('intro-sty', S.brand.splashOn === false ? 'off' : sty); } catch {} }, [sty, S.brand.splashOn]);
  if (phase === 'off') return null;
  return (
    <div className={'intro intro2 sp-' + sty + (phase === 'out' ? ' out' : '')} onClick={() => setPhase('out')} role="presentation">
      {/* fotoğrafsız açılış (31.10.2026): marka renginde ışıklar + devre kartı deseni, her ekranda tam kaplar, çözünürlükten bağımsız */}
      <i className="i2-glow a" aria-hidden="true" /><i className="i2-glow b" aria-hidden="true" /><i className="i2-glow c" aria-hidden="true" />
      <i className="i2-grid" aria-hidden="true" /><i className="i2-scan" aria-hidden="true" />
      <div className="i2-c">
        <span className="i2-mark"><i className="i2-ring" aria-hidden="true" /><i className="i2-ring r2" aria-hidden="true" /><img className="intro-logo" src={S.brand.logo || LOGO_MARK} alt="" /></span>
        <b className="i2-name">{S.brand.appName}</b>
        <small className="i2-sub">{ROUTE.shop ? 'Telefon tamir ekipmanları' : S.brand.tagline}</small>
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
      {b === 'login' && store.s.api?.mode === 'demo' && <DemoSwitch admin />}
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
  setupMediaFallback();
  // setupPress(); — 29.10.2026: telefonda basma animasyonları KALDIRILDI (App Store sonrasına)
  touchHoverToActive();
  setupTapHover(); // 30.10.2026: SADECE öne çıkan ürün kutularında eğik resmin düzelmesi (kaydırırken çıkmaz)
  setupPull();
  setupNavAnim();
  setupCrispBack();
  setupResumeFix();
}
setupFlowPills(); // akan hap: bilgisayarda da
setupSfxTaps(); // 6.11.2026 mağazada dokunma sesleri

// Telefonda dokunma hissi: kart/düğmeye basınca yumuşakça içe göçer, çok kısa dokunuşta bile en az ~120 ms basılı görünür,
// bırakınca hafif yaylanarak geri gelir (CSS :active iPhone'da bir an yanıp sönüyordu, "çiğ" duruyordu).
// Telefonda çekip yenile (29.10.2026, 3. sürüm): telefonun KENDİ yaylanması açık (html overscroll-behavior serbest;
// kullanıcı kendi yaptığımız yaylanmayı az ve takılgan buldu). Android'de tarayıcının kendi "çekip yenile"si çalışır → bizimki yok.
// iPhone'da (ana ekran uygulamasında tarayıcı yenilemesi yok): en üstte aşağı esnetince açılan boşlukta (üst menünün de üstünde)
// simge belirir, esneme miktarını (−scrollY) birebir izler; yeterince esnetip bırakınca sürüm denenir — yeni sürüm varsa sayfa
// yenilenir, yoksa yenilenmez (veriler canlı), simge sayfa yerine dönerken onunla birlikte kaybolur.
// Dokunmatikte (30.10.2026): CSS'teki ":hover" vurguları parmak kalktıktan sonra yanık kalıyordu (alt bilgi linkleri,
// Hesabım satırları, geri düğmeleri…). Bilgisayara özel (@media (hover: hover)) olmayan tüm :hover kuralları burada
// ":active"e çevrilir → vurgu SADECE parmak basılıyken görünür, kalkınca / kaydırınca hemen gider (iOS uygulamaları gibi).
function touchHoverToActive() {
  if (!matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const walk = (list) => {
    for (let i = list.cssRules.length - 1; i >= 0; i--) {
      const r = list.cssRules[i];
      if (r.cssRules && r.type !== 1) { const c = r.conditionText || r.media?.mediaText || ''; if (!/hover\s*:\s*hover/.test(c)) walk(r); continue; }
      if (r.type !== 1 || !r.selectorText || !r.selectorText.includes(':hover')) continue;
      // ana sayfa öğelerinde (.sh-*) telefonda hiçbir dokunma efekti olmasın (kullanıcı, 30.10.2026) → kural tamamen kalkar
      if (r.selectorText.includes('.sh-')) { try { list.deleteRule(i); } catch {} continue; }
      const sel = r.selectorText.replace(/:hover/g, ':active'), body = r.style.cssText;
      try { list.deleteRule(i); list.insertRule(sel + '{' + body + '}', i); } catch {}
    }
  };
  for (const sh of document.styleSheets) { try { walk(sh); } catch {} }
}

// iPhone'da titreşim: Safari titreşim API'si vermiyor; iOS 18+ "switch" onay kutusuna tıklamak kısa bir titreşim verir
export function haptic() {
  // iPhone: Safari titreşim API'si vermiyor; iOS 18+'da "switch" onay kutusunun etiketine tıklamak kısa bir titreşim verir.
  // Öğe sayfada kalıcı ve görünmez (display:none olunca iOS titretmiyor); sadece dokunuş bırakılırken (touchend) çalışır.
  try {
    if (navigator.vibrate) { navigator.vibrate(12); return; }
    let l = document.getElementById('hap-l');
    if (!l) {
      l = document.createElement('label'); l.id = 'hap-l'; l.setAttribute('aria-hidden', 'true');
      l.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; l.appendChild(i); document.body.appendChild(l);
    }
    l.click();
  } catch {}
}
// Telefonda sayfa geçişleri (30.10.2026): Hesabım menüsündeki his her yerde. İleri gidince yeni sayfa sağdan 14px kayarak
// belirir (Hesabım alt sayfaları gibi), geri gidince (Geri düğmesi / kaydırarak geri) TERS yönden, soldan gelir; alttaki menüyle
// sekme değişince sadece kısa bir soluş. Sadece transform + opacity (akıcı); içinde sabit öğe olan kutuya (sepet çubuğu vb.)
// transform verilmez (sabit öğe yerinden oynardı), onun çocuklarına inilir.
// Geri düğmelerinde keskin basma hissi (30.10.2026): sepet / ödeme gibi ağır sayfalara dönerken yeni sayfanın çizimi
// basılı görünümü ekrana hiç çıkarmıyordu. Telefonda geri düğmesine dokununca düğme önce en az ~70 ms basılı görünür (.tap),
// ancak o kare ekrana çıktıktan sonra asıl tıklama işlenir → Hesabım'daki gibi net bir 'tık'.
// Yeni resim adresinden (IMG_BASE) açılamayan resim/video bir kez eski adresten denenir (dosya henüz kopyalanmadıysa ya da
// alan adı geçici sorunluysa site resimsiz kalmasın). Yakalama aşamasında tek dinleyici: React'in çizdiği her <img>/<video>.
function setupMediaFallback() {
  if (!window.IMG_BASE) return;
  document.addEventListener('error', (e) => {
    const el = e.target; if (!el || !/^(IMG|VIDEO|SOURCE)$/.test(el.tagName) || el.dataset.fb) return;
    const alt = mediaFallback(el.currentSrc || el.src); if (!alt) return;
    el.dataset.fb = '1'; e._fb = 1; el.src = alt; if (el.tagName === 'SOURCE') el.parentElement?.load?.();
  }, true);
}
function setupCrispBack() {
  let pass = false, downAt = 0;
  // basılı görünüm parmak değdiği anda .tap ile açılır ve tıklama işlenene kadar KESİNTİSİZ kalır. (Önceden :active parmak
  // kalkınca sönüyor, tıklamada .tap ile yeniden yanıyordu → arka plan 'yan-sön-yan' tekliyordu.) Kaydırıp vazgeçince söner.
  let held = null, sx = 0, sy = 0;
  const release = () => { const b = held; held = null; if (b) setTimeout(() => { if (!b._going) b.classList.remove('tap'); }, 60); };
  addEventListener('pointerdown', (e) => {
    const b = e.target instanceof Element && e.target.closest('.back-btn'); if (!b || !matchMedia('(max-width: 899px)').matches) return;
    downAt = Date.now(); held = b; sx = e.clientX; sy = e.clientY; b._going = false; b.classList.add('tap');
    b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); // ok bir kez kayıp döner
    clearTimeout(b._nt); b._nt = setTimeout(() => b.classList.remove('nudge'), 320);
  }, { capture: true, passive: true });
  addEventListener('pointermove', (e) => { if (held && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) release(); }, { capture: true, passive: true });
  addEventListener('pointercancel', release, { capture: true, passive: true });
  addEventListener('pointerup', () => { const b = held; held = null; if (b) setTimeout(() => { if (!b._going) b.classList.remove('tap'); }, 400); }, { capture: true, passive: true });
  addEventListener('scroll', () => { if (held) release(); }, { passive: true });
  addEventListener('click', (e) => {
    if (pass) return;
    const b = e.target instanceof Element && e.target.closest('.back-btn');
    if (!b || b.disabled || !matchMedia('(max-width: 899px)').matches) return;
    // basılı görünüm parmak değdiği anda başladığı (.tap) için tıklama artık BEKLETİLMEZ (bekletmek dönüşü ~0,1 sn geciktiriyordu)
    b._going = true; b.classList.add('tap');
    // kapanacak sayfadaki videolar hemen durur → geri dönüş karesi video çözümüyle yarışmaz
    document.querySelectorAll('.main video').forEach((x) => { try { x.pause(); } catch {} });
    setTimeout(() => { if (b.isConnected) b.classList.remove('tap'); }, 160);
  }, true);
}

// 3.11.2026 üst menü kaydırınca gizlenir (mağaza, telefon + bilgisayar): ~90px aşağı inince yukarı kayarak kaybolur, sayfanın en üstüne
// dönünce (ya da 'up' seçiliyse yukarı kaydırmaya başlayınca) geri gelir. Pencere / arama / menü açıkken, sabit yan kutulu sayfalarda
// (sepet, ödeme, hesap, ürün katmanı) hiç gizlenmez → oralardaki sabit konumlar bozulmaz.
const HIDE_TABS = new Set(['anasayfa', 'katalog', 'kalip', 'set', 'urun', 'yasal', 'liste', 'markalar', 'setlist']);
// telefon ekranı mı (≤899px) — değişince yeniden çizilir
const PHONE_MQ = '(max-width: 899px)';
function usePhoneMQ() {
  const [v, setV] = useState(() => matchMedia(PHONE_MQ).matches);
  useEffect(() => { const m = matchMedia(PHONE_MQ); const f = () => setV(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return v;
}
function useHideTop(on, upShow, tab, layer) {
  useEffect(() => {
    const r = document.documentElement; const ok = on && HIDE_TABS.has(tab) && !(tab === 'urun' && layer);
    if (!ok) { r.classList.remove('top-hide'); return; }
    // 5.11.2026 (3) headroom yöntemi: menü SADECE kullanıcının kaydırmasına tepki verir (tekerlek, parmak, klavye, kaydırma çubuğu).
    // Sayfa geçişinde site kaldığın yere kendisi kaydırınca (geri dönüş) menü gizlenmez; her sayfa geçişinde menü görünür gelir.
    r.classList.remove('top-hide');
    let last = scrollY, acc = 0, raf = 0, userAt = 0; const born = Date.now();
    const user = () => { userAt = Date.now(); };
    const busy = () => document.body.classList.contains('noscroll') || document.querySelector('.hsearch.mob-open, .hd-p, .ctx-catch, .nc-panel, .sheet-bg') || r.classList.contains('dz-in-frame');
    const f = () => {
      raf = 0; const y = scrollY; const d = y - last; last = y;
      if (y < 70) { acc = 0; r.classList.remove('top-hide'); return; }
      if (Date.now() - born < 450 || Date.now() - userAt > 700) { acc = 0; return; } // kodla yapılan kaydırma (sayfa geçişi, yer geri yükleme)
      if (busy()) { r.classList.remove('top-hide'); return; }
      acc = (d > 0) === (acc > 0) ? acc + d : d;
      if (acc > 24) r.classList.add('top-hide');
      else if (upShow && acc < -14) r.classList.remove('top-hide');
    };
    const q = () => { if (!raf) raf = requestAnimationFrame(f); };
    const EV = ['wheel', 'touchmove', 'keydown', 'pointerdown'];
    EV.forEach((e) => addEventListener(e, user, { passive: true, capture: true }));
    addEventListener('scroll', q, { passive: true });
    return () => { EV.forEach((e) => removeEventListener(e, user, { capture: true })); removeEventListener('scroll', q); cancelAnimationFrame(raf); r.classList.remove('top-hide'); };
  }, [on, upShow, tab, layer]);
}
// 5.11.2026 'akan hap' (kullanıcı: bir şeye tıklayınca seçili hap eskisinden yenisine akıyormuş gibi gitsin): tek seçimli düğme
// gruplarında (üst menü sekmeleri, seçim çubukları, alt sayfa çubukları, Siparişlerim sekmeleri, görünüm seçici) seçim değişince
// eski seçilinin yerinden yenisine, yolun ortasında uzayarak kayan bir hap çizilir; yeni düğmenin kendi zemini o sırada gizlenir.
// Hap grubun İÇİNE (yazıların altına) konur. Sadece transform/opacity değil ama tek küçük kutu → telefonda da hafif.
// hap hareketi (look.pill / pillM telefonda): 'flow' akan (varsayılan) · 'mercury' cıva · 'none' yok
const pillMode = () => { const L = store.s.settings?.look || {}; return lookFor(L, matchMedia('(max-width: 899px)').matches).pill || 'flow'; };
function setupFlowPills() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('animate' in Element.prototype)) return;
  const SEL = '.topnav .topnav-b, .seg > button, .mo-tabs > button, .view-sw > button, .of-seg > button';
  const groupOf = (b) => b.closest('.topnav') || b.parentElement;
  addEventListener('pointerdown', (e) => {
    const t = e.target instanceof Element ? e.target : null; const btn = t?.closest(SEL);
    if (!btn || btn.classList.contains('on') || btn.disabled || pillMode() === 'none') return;
    const g = groupOf(btn); const old = [...g.querySelectorAll('.on')].find((x) => x.matches(SEL) && groupOf(x) === g);
    if (!old) return;
    const gr = g.getBoundingClientRect(); const a = old.getBoundingClientRect();
    const A = { x: a.left - gr.left + g.scrollLeft, y: a.top - gr.top + g.scrollTop, w: a.width, h: a.height };
    let n = 0;
    const wait = () => {
      if (++n > 40) return;
      if (!btn.isConnected || !btn.classList.contains('on')) { requestAnimationFrame(wait); return; }
      // 6.11.2026: düğmenin zemini geçişle (transition) geliyorsa ilk karede saydam okunuyordu → hap hiç kaymıyordu (siyah hapta belirgindi).
      // Geçiş bir anlığına kapatılıp son renk okunur.
      const tr0 = btn.style.transition; btn.style.transition = 'none';
      const cs0 = getComputedStyle(btn); const cs = { backgroundImage: cs0.backgroundImage, backgroundColor: cs0.backgroundColor, borderRadius: cs0.borderRadius, boxShadow: cs0.boxShadow };
      btn.style.transition = tr0;
      const bg = cs.backgroundImage !== 'none' ? cs.backgroundImage : cs.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return; // seçili hâlinde zemini olmayan (alt çizgili) grup
      const gr2 = g.getBoundingClientRect(); const b = btn.getBoundingClientRect();
      const B = { x: b.left - gr2.left + g.scrollLeft, y: b.top - gr2.top + g.scrollTop, w: b.width, h: b.height };
      if (getComputedStyle(g).position === 'static') g.style.position = 'relative';
      const gh = document.createElement('span'); gh.className = 'flow-ghost'; gh.setAttribute('aria-hidden', 'true');
      gh.style.cssText = `left:0;top:0;width:${B.w}px;height:${B.h}px;border-radius:${cs.borderRadius};background:${cs.backgroundImage !== 'none' ? cs.backgroundImage + ',' : ''}${cs.backgroundColor};box-shadow:${cs.boxShadow}`;
      g.insertBefore(gh, g.firstChild); g.classList.add('flow-g'); btn.classList.add('flow-on');
      const dx = Math.abs(B.x - A.x); const mx = Math.min(A.x, B.x) + dx * 0.25; const mw = (A.w + B.w) / 2 + dx * 0.5;
      // 6.11.2026 dikey grup (yönetim yan menüsü): hap yukarı/aşağı uzayarak gider, kısa sürede (yavaş ve takılır gibiydi)
      const dy = Math.abs(B.y - A.y); const vert = dy > dx;
      const my = Math.min(A.y, B.y) + dy * 0.25; const mh = (A.h + B.h) / 2 + Math.min(dy * 0.5, 60);
      const vdur = Math.round(Math.min(320, 200 + dy * 0.25));
      const f = (x, y, w, h) => ({ transform: `translate(${x}px, ${y}px)`, width: w + 'px', height: h + 'px' });
      // 5.11.2026 'cıva' (look.pill 'mercury'): önce ön ucu yeni sekmeye uzanıp incelir, sonra arkası çekilip toparlanır (hafif taşar)
      const an = vert
        ? gh.animate([f(A.x, A.y, A.w, A.h), { ...f(Math.min(A.x, B.x), my, (A.w + B.w) / 2, mh), offset: 0.45 }, f(B.x, B.y, B.w, B.h)], { duration: vdur, easing: 'cubic-bezier(.3, .7, .25, 1)' })
        : pillMode() === 'mercury'
        ? gh.animate([
          { ...f(A.x, A.y, A.w, A.h), easing: 'cubic-bezier(.55, 0, .35, 1)' },
          { ...f(Math.min(A.x, B.x), (A.y + B.y) / 2 + A.h * 0.07, Math.max(A.x + A.w, B.x + B.w) - Math.min(A.x, B.x), (A.h + B.h) / 2 * 0.86), offset: 0.5, easing: 'cubic-bezier(.25, .1, .25, 1)' },
          f(B.x, B.y, B.w, B.h)], { duration: 560, fill: 'none' })
        : gh.animate([f(A.x, A.y, A.w, A.h), { ...f(mx, (A.y + B.y) / 2 + 1, mw, (A.h + B.h) / 2 - 2), offset: 0.45 }, f(B.x, B.y, B.w, B.h)], { duration: 440, easing: 'cubic-bezier(.3, .7, .25, 1)' });
      const done = () => { const t1 = btn.style.transition; btn.style.transition = 'none'; gh.remove(); g.classList.remove('flow-g'); btn.classList.remove('flow-on'); void btn.offsetWidth; requestAnimationFrame(() => { btn.style.transition = t1; }); }; // hap yerine oturunca asıl hap anında görünür (solarak gelip titremesin)
      an.onfinish = done; an.oncancel = done;
    };
    requestAnimationFrame(wait);
  }, { capture: true, passive: true });
}
// 6.11.2026 iPhone: uygulamadan çıkıp dönünce (özellikle klavye açıkken çıkıldıysa) ekran yüksekliği kısa kalıyordu →
// alt menü ve ürün katmanı (fixed, bottom:0) ekranın ortasında, altında arkadaki sayfa görünüyordu. Çıkarken açık yazı alanı
// kapatılır; dönünce takılı kalmış sayfa geçişi animasyonları bitirilir ve tarayıcı ekranı yeniden ölçmeye zorlanır.
function setupResumeFix() {
  const fix = () => {
    try { document.getAnimations?.().forEach((a) => { if (a.playState === 'paused' || a.playState === 'running') { const t = a.effect?.target; if (t?.classList?.contains('nav-cover') || a.id === 'nav') a.finish(); } }); } catch {}
    const y = scrollY;
    requestAnimationFrame(() => {
      const h = document.documentElement; h.style.minHeight = '100.1%';
      requestAnimationFrame(() => { h.style.minHeight = ''; scrollTo(scrollX, y + 1); scrollTo(scrollX, y); });
    });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { const a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) a.blur(); }
    else fix();
  });
  addEventListener('pageshow', (e) => { if (e.persisted) fix(); });
  // 6.11.2026 (2): aynı bozulma klavye kapanınca da oluyordu (sepette yazı alanından çıkınca alt menü ortada, sayfa boş) →
  // yazı alanından çıkınca ve klavye kapanınca (görünür alan birden uzayınca) ekran yeniden ölçülür
  const isField = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  document.addEventListener('focusout', (e) => { if (!isField(e.target)) return; setTimeout(() => { if (!isField(document.activeElement)) fix(); }, 120); });
  const vv = window.visualViewport;
  if (vv) { let h0 = vv.height; vv.addEventListener('resize', () => { const h = vv.height; if (h - h0 > 120 && !isField(document.activeElement)) setTimeout(fix, 60); h0 = h; }); }
  // 6.11.2026 (3): iPhone bazen (birkaç sayfa geçişi / uygulamadan çıkıp dönme sonrası) alt menüyü ekrana sabit tutmayı bırakıyor:
  // menü sayfayla birlikte kayıyor ya da ortada kalıyor. Kaydırırken menünün gerçek yeri ölçülür; görünen ekranın altında
  // değilse aradaki fark kadar itilir (--vvd) ve ekran yeniden ölçtürülür. Yazı alanı açıkken (klavye) dokunulmaz.
  if (vv && matchMedia('(pointer: coarse)').matches) {
    const r = document.documentElement; let cur = 0, q = 0, lastFix = 0;
    const upd = () => {
      q = 0; const nav = document.querySelector('.botnav'); if (!nav || isField(document.activeElement)) { if (cur) { cur = 0; r.style.removeProperty('--vvd'); } return; }
      const cs = getComputedStyle(nav); if (cs.position !== 'fixed' || cs.display === 'none') return;
      const want = vv.height + vv.offsetTop - (parseFloat(cs.bottom) || 0); // menünün altı burada olmalı
      const rb = nav.getBoundingClientRect().bottom - cur; // itme olmadan menünün altı
      let d = Math.round(want - rb); if (Math.abs(d) < 2) d = 0;
      if (d !== cur) { cur = d; d ? r.style.setProperty('--vvd', d + 'px') : r.style.removeProperty('--vvd'); }
      if (d && Date.now() - lastFix > 1500) { lastFix = Date.now(); fix(); }
    };
    const req = () => { if (!q) q = requestAnimationFrame(upd); };
    vv.addEventListener('resize', req); vv.addEventListener('scroll', req); addEventListener('resize', req); addEventListener('scroll', req, { passive: true }); addEventListener('pageshow', req);
    document.addEventListener('focusout', () => setTimeout(req, 150)); document.addEventListener('visibilitychange', () => setTimeout(req, 300));
    setInterval(() => { if (document.visibilityState === 'visible') req(); }, 600); addEventListener('touchstart', req, { passive: true });
  }
}

function setupNavAnim() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('animate' in Element.prototype)) return;
  const FIX = '.cart-bar, .cs-fixed, .co-fixed, .gbar, .cart-fab, .save-bar, .dz-mbar';
  const EASE = 'cubic-bezier(.2,.7,.2,1)';
  const key = (s) => [s.tab, s.acct || '', s.pid || '', s.openOrder || '', s.openReq || '', s.lcOpen || ''].join('|');
  let last = key(store.s), hint = '', hintAt = 0, click = null, mo = null, watched = null;
  const mark = (h) => { hint = h; hintAt = Date.now(); };
  const navIdx = () => { const bs = [...document.querySelectorAll(matchMedia('(max-width: 899px)').matches ? '.botnav .botnav-b' : '.topbar .topnav .topnav-b')]; return bs.findIndex((b) => b.classList.contains('on')); };
  let lastIdx = -1;
  const mob = () => matchMedia('(max-width: 899px)').matches;
  // 5.11.2026 bilgisayarda da sayfa geçişi (look.motionD): 'soft' kısa kayma + solma (varsayılan) · 'fade' sadece solma · 'none' yok
  const deskOn = () => (store.s.settings?.look?.motionD || 'soft') !== 'none';
  const on = () => mob() || deskOn();
  addEventListener('popstate', () => mark('back'), true);
  addEventListener('pointerdown', (e) => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('.back-btn, .oa-back')) mark('back'); else if (t.closest('.botnav, .topbar .topnav')) { mark('tab'); lastIdx = navIdx(); }
  }, { capture: true, passive: true });
  // sayfa içi geçişler (sepet → ödeme, sipariş detayı, adımlar…): adres değişmese de tıklanan düğme kaybolup yerine büyük bir bölüm gelirse
  addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null; if (!t || !t.closest('.shell > .main')) return;
    const btn = t.closest('button, a, [role="button"]') || t;
    click = { el: btn, at: Date.now(), back: !!t.closest('.back-btn, .oa-back') }; // .oa-back: sipariş / linkle gelen sipariş geri düğmesi (31.10.2026: dönüş sağdan geliyordu)
  }, { capture: true, passive: true });
  // Solma içeriğin kendisine DEĞİL, üstüne serilen sayfa renginde tek bir örtüye (.nav-cover) uygulanır: koca bir sayfayı
  // (ana sayfa: bulanık ışıklar, buzlu cam reklam…) saydamlıkla çizmek iPhone'da çok ağır, 'flaş' yapıyordu; örtüyü soldurmak
  // bedava. Sayfanın kendisi sadece kayar (transform). Örtü üst menü / alt menü / sepet çubuğunun ALTINDA (z 18).
  // Animasyon ilk karede başlangıç hâlinde DURAKLATILIR, o (bazen ağır) kare ekrana çıktıktan sonraki karede oynatılır.
  let cover = null;
  const getCover = () => { if (!cover || !cover.isConnected) { cover = document.createElement('div'); cover.className = 'nav-cover'; cover.setAttribute('aria-hidden', 'true'); document.body.appendChild(cover); } return cover; };
  // 3.11.2026 hareket ayarı (Tasarım › Renkler ve sayfa › Sayfa geçişleri, look.motion): 'soft' eski hafif kayma · 'clear' belirgin
  // (daha uzun kayma, hafif büyüme, yaylı yavaşlama; varsayılan) · 'glass' cam (sayfa buzlu camın arkasından netleşerek gelir) · 'slow' deneme için yavaş.
  // 5.11.2026 (kullanıcı: 'belirgin' takılıyordu, yandan kaymalı pürüzsüz istedi): ölçek (scale) KALDIRILDI — büyük katmanı her karede
  // yeniden çizdiriyordu; sadece yatay kayma (ekran kartında) + örtü solması. 'clear' = iOS gibi yandan kayma (ekranın ~%24'ü, iOS eğrisi).
  const MOT = {
    soft: { dx: 14, ms: 1, ease: EASE },
    clear: { dx: () => Math.round(innerWidth * 0.24), ms: 1.15, ease: 'cubic-bezier(.32,.72,0,1)', cv: 0.75 },
    glass: { dx: 26, ms: 1.4, ease: 'cubic-bezier(.32,.72,0,1)', glass: true },
    slow: { dx: () => Math.round(innerWidth * 0.24), ms: 3, ease: 'cubic-bezier(.32,.72,0,1)', cv: 0.75 },
    desk: { dx: () => Math.round(Math.min(200, innerWidth * 0.13)), ms: 1.15, ease: 'cubic-bezier(.32,.72,0,1)', cv: 0.75 }, // bilgisayar: telefondaki gibi yönlü yandan kayma (ekranın ~%13'ü)
    dfade: { dx: 0, ms: 0.7, ease: EASE },
  };
  const play = (els, kind, ms0, dk = 1) => {
    const as = []; const LK0 = store.s.settings?.look || {};
    const M = mob() ? (MOT[LK0.motion] || MOT.clear) : LK0.motionD === 'fade' ? MOT.dfade : MOT.desk; const ms = Math.round(ms0 * M.ms);
    const dx = Math.round((typeof M.dx === 'function' ? M.dx() : M.dx) * dk);
    if (kind !== 'tab') { const kf = [{ transform: `translate3d(${kind === 'back' ? -dx : dx}px,0,0)` }, { transform: 'translate3d(0,0,0)' }]; for (const el of els) as.push(el.animate(kf, { duration: ms, easing: M.ease, id: 'nav' })); }
    const cv = getCover(); cv.classList.toggle('glass', !!M.glass);
    const k0 = kind === 'tab' ? 0.65 : 1;
    as.push(cv.animate(M.glass ? [{ opacity: kind === 'tab' ? 0.8 : 1 }, { opacity: 0.6, offset: 0.35 }, { opacity: 0 }]
      : M.cv && kind !== 'tab' ? [{ opacity: k0 }, { opacity: 0, offset: M.cv }, { opacity: 0 }] : [{ opacity: k0 }, { opacity: 0 }], { duration: kind === 'tab' ? Math.min(ms, 220) : ms, easing: M.glass ? 'ease-out' : kind === 'tab' ? EASE : 'cubic-bezier(.2,.6,.3,1)' }));
    as.forEach((a) => a.pause());
    requestAnimationFrame(() => as.forEach((a) => { try { a.play(); } catch {} }));
  };
  const pageTargets = (main) => {
    const layer = main.querySelector?.(':scope > .pp-layer'); if (layer) return [layer]; // ürün katmanı açılırken sadece o kayar
    const out = [];
    const walk = (el, d) => {
      for (const c of el.children) {
        if (c.classList.contains('kp-off')) continue;
        // sayfa kabuğuna (.page) ve sabit öğe taşıyabilen kutulara transform VERİLMEZ (sepet çubuğu vb. sonradan gelse bile yerinde kalsın) → çocuklarına inilir
        if (c.matches(FIX)) continue;
        // (getComputedStyle KULLANILMAZ: ağır sayfa açılırken stil hesabını erkenden zorlayıp iki kez yaptırıyordu)
        if (d < 6 && (c.classList.contains('page') || c.querySelector(FIX))) walk(c, d + 1); else out.push(c);
      }
    };
    walk(main, 0); return out;
  };
  // MutationObserver: React yeni sayfayı DOM'a yazdığı anda (boyamadan önce) çalışır → ilk kare zaten animasyonlu, yanıp sönme yok
  // Adres değişen geçişler: store değişince, React yeni sayfayı yazdıktan SONRA ama ekrana çizmeden ÖNCE (rAF) oynatılır.
  // (MutationObserver'da yapınca arkadaki gizli sayfadaki ufak bir değişiklik React'ten önce tetikleyip eski sayfayı
  // oynatabiliyordu → bazen geri dönüş animasyonsuz geliyordu.) Kabuk henüz yeni sekmeyi göstermiyorsa bir kare daha beklenir.
  let pend = 0;
  const runKey = (tries) => {
    pend = 0; const k = key(store.s); if (k === last) return;
    const shell = document.querySelector('.shell');
    if (tries < 3 && shell && !shell.classList.contains('tab-' + store.s.tab)) { pend = requestAnimationFrame(() => runKey(tries + 1)); return; }
    const prev = last; last = k; click = null;
    if (!on() || !watched?.isConnected) return;
    const h = Date.now() - hintAt < 800 ? hint : ''; hint = '';
    // 5.11.2026 alt menüyle sekme değişimi de yandan kayar: sağdaki sekmeye geçince sağdan, soldakine geçince soldan (iOS sekme hissi)
    const ti = navIdx();
    if (h === 'tab' && prev.split('|')[0] !== k.split('|')[0]) { const d = ti >= 0 && lastIdx >= 0 ? Math.sign(ti - lastIdx) : 0; lastIdx = ti; if (d) play(pageTargets(watched), d < 0 ? 'back' : 'fwd', 365, 0.6); else play([], 'tab', 180); return; }
    lastIdx = ti;
    // 6.11.2026: bilgisayarda Hesabım içinde bölüm değişince (sol menü sabit) bütün sayfa kayıp örtü solmasın — ekran 'sekiyordu';
    // sadece sağdaki içerik kısa ve hafif kayarak belirir, sol menü yerinden oynamaz
    const pa = prev.split('|'), ka = k.split('|');
    if (!mob() && pa[0] === 'hesap' && ka[0] === 'hesap' && pa[1] !== ka[1] && pa.slice(2).join() === ka.slice(2).join()) {
      const m = watched.querySelector('.acct-main'); if (m) m.animate([{ opacity: 0, transform: `translate3d(${h === 'back' ? -14 : 14}px,0,0)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
      return;
    }
    play(pageTargets(watched), h === 'back' ? 'back' : 'fwd', 300);
  };
  storeListen(() => {
    if (!pend && key(store.s) !== last) pend = requestAnimationFrame(() => runKey(0));
  });
  // sayfa içi geçişler (adres değişmeden): MutationObserver, tıklanan düğme kaybolup yerine büyük bölüm gelince
  const onMut = (muts) => {
    if (pend || key(store.s) !== last) return;
    const c = click; if (!c || Date.now() - c.at > 450 || c.el.isConnected || !on()) return;
    if (Date.now() - hintAt < 600 && hint === 'back') c.back = true; // geri hareketiyle (popstate) gelen sayfa içi dönüş de soldan gelir
    const min = innerHeight * 0.45, added = [];
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && !n.closest('.sheet, .sheet-bg, .ctx-sheet-bg') && n.offsetHeight > min && !n.matches(FIX)) added.push(n);
    const top = added.filter((n) => !added.some((o) => o !== n && o.contains(n)));
    if (!top.length || top.some((n) => n.classList.contains('no-anim') || n.querySelector('.no-anim'))) return; // animasyonsuz dönüş isteyen sayfa
    click = null;
    const els = []; for (const n of top) { if (n.classList.contains('page') || n.querySelector(FIX)) els.push(...pageTargets({ children: [n] })); else els.push(n); }
    play(els, c.back ? 'back' : 'fwd', 300);
  };
  const attach = () => {
    const main = document.querySelector('.shell > .main');
    if (main === watched) return; mo?.disconnect(); watched = main; last = key(store.s);
    if (main) { mo = new MutationObserver(onMut); mo.observe(main, { childList: true, subtree: true }); }
  };
  storeListen(() => { if (!watched?.isConnected) requestAnimationFrame(attach); });
  attach();
}

function setupPull() {
  if (!matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const STANDALONE = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!STANDALONE) return; // tarayıcıda (Safari/Chrome) kendi çekip yenilesi var; bu sadece ana ekran uygulamasında
  // 31.10.2026: Android ana ekran uygulamasında Chrome'un çekip yenilesi YOK ve sayfa eksiye esnemez → çekiş parmaktan
  // ölçülür (iPhone'da da esneme gelmezse aynı yedek devreye girer). Gösterge üst menünün altından parmakla iner.
  // 30.10.2026 (10): gösterge üst menünün İÇİNE (alt kenarının hemen altına, taşanı kırpılan bir kutuya) konur →
  // menüyle birlikte telefonun kendi esnemesiyle (120/144 Hz) hareket eder; JS her karede konum hesaplamaz.
  // JS sadece çekiş oranını (--k) yazar; kısa bir geçiş (70 ms) aradaki kareleri ekran kartında doldurur → takılma yok.
  // Bırakınca: kısa dönüş → yeşil ✓ → yerinde küçülüp solar. Sayfa YENİLENMEZ (veriler canlı); sadece yeni sürümde reload.
  const TH = 72, SPIN_MIN = 450, OK_MS = 520;
  let box = null, finger = false, armed = false, ready = false, phase = '', wasOk = false, raf = 0, lastCn = '', lastK = -1;
  let sx = 0, sy = 0, dy = 0;
  const atTop = () => scrollY <= 1 && (document.scrollingElement?.scrollTop || 0) <= 1;
  const rub = (d) => (d > 0 ? 170 * (1 - Math.exp(-d / 230)) : 0); // parmak ~150px → eşik
  const ui = () => {
    const host = document.querySelector('.topbar') || document.body;
    if (box && box.parentNode === host) return box;
    if (!box) {
      box = document.createElement('div'); box.setAttribute('aria-hidden', 'true');
      box.innerHTML = '<span class="ptr10-i"><span class="ptr10-c"><i class="ptr10-r"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4"/></svg></i>'
        + '<svg class="ptr10-ok" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></span>';
    }
    box.className = 'ptr10' + (host === document.body ? ' loose' : ''); lastCn = '';
    host.appendChild(box); return box;
  };
  const paint = () => {
    raf = 0;
    const px = (armed && !phase) ? Math.max(0, -scrollY, rub(dy)) : 0;
    if (!px && !phase) { if (box && lastCn !== 'ptr10') { box.className = lastCn = 'ptr10' + (box.parentNode === document.body ? ' loose' : ''); } return; }
    const b = ui(); const k = phase ? 1 : Math.min(1, px / TH);
    if (finger && armed && !phase) ready = px >= TH;
    const kr = Math.round(k * 100) / 100; if (kr !== lastK) { lastK = kr; b.style.setProperty('--k', kr); }
    const cn = 'ptr10 show' + (b.parentNode === document.body ? ' loose' : '') + (ready && !phase ? ' ready' : '') + (phase ? ' ' + phase : '') + (wasOk ? ' was-ok' : '');
    if (cn !== lastCn) { b.className = lastCn = cn; }
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(paint); };
  const finish = (ok) => {
    phase = ok ? 'ok' : 'hide'; wasOk = ok; req();
    setTimeout(() => { phase = 'hide'; req(); setTimeout(() => { phase = ''; wasOk = false; armed = false; lastK = -1; req(); }, 240); }, ok ? OK_MS : 0);
  };
  addEventListener('scroll', req, { passive: true });
  addEventListener('touchmove', (ev) => {
    if (armed && !phase && ev.touches.length === 1) {
      const p = ev.touches[0]; const ddy = p.clientY - sy, ddx = p.clientX - sx;
      if (dy === 0 && (ddy < -3 || Math.abs(ddx) > Math.abs(ddy) + 4)) { armed = false; } // yukarı kaydırma / yana kaydırma → çekiş değil
      else if (!atTop() && scrollY > 1) { armed = false; dy = 0; }
      else dy = Math.max(0, ddy);
    }
    req();
  }, { passive: true });
  addEventListener('touchstart', (ev) => {
    finger = true; ready = false; dy = 0;
    const p = ev.touches[0]; sx = p ? p.clientX : 0; sy = p ? p.clientY : 0;
    const t = ev.target; const inScroller = t instanceof Element && t.closest('.sheet-b, .ctx-sheet-list, .nc-list, .kf-sugg, input, textarea, select');
    armed = !phase && ev.touches.length === 1 && atTop() && !inScroller && !document.querySelector('.sheet-bg, .lb, .vv');
  }, { passive: true });
  addEventListener('touchcancel', () => { finger = false; ready = false; armed = false; dy = 0; req(); }, { passive: true });
  addEventListener('touchend', async () => {
    finger = false; const go = armed && ready; ready = false; dy = 0;
    if (!go || phase || document.querySelector('.sheet-bg, .lb, .vv')) { armed = false; req(); return; }
    haptic();
    if (navigator.onLine === false) { finish(false); toast('İnternet bağlantısı yok', 'bad'); return; }
    phase = 'spin'; req();
    const t0 = Date.now(); let newer = false;
    dispatchEvent(new Event('soft-refresh')); // kur vb. arka planda tazelenir (sayfa yeniden çizilmez)
    // mağaza ayarları (banner, raflar, tema…) sunucudan yeniden okunur → değişiklik hemen ekrana gelir
    const pubJob = window.__refreshPub ? Promise.race([window.__refreshPub().catch(() => null), new Promise((r) => setTimeout(r, 6000))]) : null;
    try {
      const cur = window.__BUILD;
      if (cur) {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal }); clearTimeout(tm);
        const j = await r.json(); newer = !!(j.v && j.v !== cur);
      }
    } catch {}
    if (pubJob) await pubJob;
    await new Promise((r) => setTimeout(r, Math.max(0, SPIN_MIN - (Date.now() - t0))));
    if (newer) { location.reload(); return; } // yeni sürüm yayınlandıysa gerçek yenileme
    finish(true);
  }, { passive: true });
}

// Telefonda (29.10.2026): basma animasyonu yerine bilgisayardaki "üstüne gelince" görünümü (marka kutusunda renk + ok,
// reklam kutusunda eğik resmin düzelmesi, kartın kalkması) SADECE gerçek dokunuşta kısa süre gösterilir (.th).
// Parmak kayarsa / sayfa kayarsa hiç başlamaz ya da hemen geri döner. Kartın içindeki düğmeye (+ vb.) basınca kart oynamaz.
function setupTapHover() {
  if (!matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const SEL = '.sh-box.prod'; // kullanıcı: telefonda başka hiçbir yerde dokunma efekti yok
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
    el.style.setProperty('--tw', bs[0].getBoundingClientRect().width + 'px'); // sekme genişliği: cam menüde hap sekmeyi (yazısıyla) tam sarar
    const bl = el.clientLeft || 0; // yüzen menünün kenarlığı: hap kenarlığın içinden konumlanır
    setGeo({ cs: bs.map((b) => { const q = b.getBoundingClientRect(); return q.left - r.left - bl + q.width / 2; }), top: ic.getBoundingClientRect().top - r.top });
  };
  // 5.11.2026: menünün boyu/genişliği değişince de (cam görünüm sonradan uygulanınca menü daralıyor) yeniden ölçülür — hap kaymasın
  useLayoutEffect(() => { measure(); const f = () => measure(); addEventListener('resize', f); const ro = 'ResizeObserver' in window && ref.current ? new ResizeObserver(f) : null; ro?.observe(ref.current); return () => { removeEventListener('resize', f); ro?.disconnect(); }; }, [keys]);
  live.current = { geo, items };
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const place = (x) => { if (pill.current) pill.current.style.transform = `translateX(${x}px) translateX(-50%)`; };
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
      if (pill.current) pill.current.style.transform = `translateX(${pill.current.dataset.x}px) translateX(-50%)`; // aktif sekmeye yumuşakça döner
      if (s && s.i != null && go_) go(live.current.items[s.i][0]);
    };
    // iPhone'da ekranın altındaki çizgiden yukarı kaydırma (uygulamadan çıkma / uygulama değiştirici) menünün alt boşluğundan başlar:
    // oradan başlayan dokunuş sekme değiştirmez (31.10.2026: uygulama arka plana giderken Kalıp/Sepet sekmesine geçiyordu)
    const start = (e) => { const t = e.touches[0]; if (!t || e.touches.length > 1) return; const b = el.querySelector('.botnav-b')?.getBoundingClientRect(); if (b && t.clientY > b.bottom - 2) return; st.current = { i: null }; el.classList.add('pressing'); track(t.clientX); };
    const move = (e) => { if (!st.current) return; e.preventDefault(); el.classList.add('dragging'); const t = e.touches[0]; if (t) track(t.clientX); };
    const end = (e) => {
      if (!st.current) return;
      const t = e.changedTouches?.[0];
      // 6.11.2026 kullanıcı: parmak menünün üstüne (sayfaya) çıkmış olsa da bırakılan yerdeki sekmeye geçsin (eskiden 40 px yukarıda vazgeçiyordu)
      if (t) track(t.clientX);
      e.preventDefault(); // tıklama tekrar tetiklenmesin
      finish(true);
    };
    const cancel = () => finish(!!st.current?.moved); // sistem dokunuşu aldı: sadece parmakla sekmeler üstünde gezinmişse geç, yoksa hiçbir şey yapma
    // 6.11.2026: bırakınca sekmeye geçmeyip hap ortada takılı kalıyordu (parmak kalkışı menüye ulaşmadı) → bırakma pencere
    // seviyesinde de yakalanır; menü dışında yeni dokunuş, sayfadan çıkma ya da 4 sn sessizlik takılı hâli temizler
    const winEnd = (e) => { if (st.current && !el.contains(e.target)) end(e); };
    const winStart = (e) => { if (st.current && !el.contains(e.target)) finish(false); };
    const hide = () => { if (document.visibilityState === 'hidden' && st.current) finish(false); };
    let dog = 0; const kick = () => { clearTimeout(dog); dog = setTimeout(() => { if (st.current) finish(!!st.current.moved); }, 4000); };
    const start2 = (e) => { if (st.current) finish(false); start(e); if (st.current) kick(); };
    const move2 = (e) => { move(e); if (st.current) kick(); };
    el.addEventListener('touchstart', start2, { passive: true });
    el.addEventListener('touchmove', move2, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', cancel);
    addEventListener('touchend', winEnd, { capture: true, passive: false });
    addEventListener('touchcancel', winEnd, { capture: true });
    addEventListener('touchstart', winStart, { capture: true, passive: true });
    document.addEventListener('visibilitychange', hide);
    return () => { clearTimeout(dog); el.removeEventListener('touchstart', start2); el.removeEventListener('touchmove', move2); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', cancel);
      removeEventListener('touchend', winEnd, { capture: true }); removeEventListener('touchcancel', winEnd, { capture: true }); removeEventListener('touchstart', winStart, { capture: true }); document.removeEventListener('visibilitychange', hide); };
  }, []);
  const ai = items.findIndex((x) => x[0] === tab);
  const px = geo && ai >= 0 ? geo.cs[ai] : null;
  // sekme değişince takılı kalmış sürükleme izi temizlenir, hap yeni sekmeye oturur
  useLayoutEffect(() => { const el = ref.current; if (!el || st.current) return; el.classList.remove('dragging', 'pressing'); setHov(-1); if (pill.current && px != null) pill.current.style.transform = `translateX(${px}px) translateX(-50%)`; }, [tab, px]);
  // 5.11.2026 sıvı geçiş: hap yeni sekmeye kayarken yolun ortasında uzayıp hafif basıklaşır, varınca toplanır (iOS cam sekme çubuğu hissi)
  const prevPx = useRef(px);
  useEffect(() => {
    const a = prevPx.current; prevPx.current = px;
    if (a == null || px == null || Math.abs(a - px) < 2) return;
    const i = pill.current?.firstElementChild; if (!i?.animate || ref.current?.classList.contains('dragging') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pm = pillMode();
    if (pm === 'none') return;
    if (pm === 'mercury') {
      const o = pill.current; const w = o.offsetWidth || 64; const D = px - a; const sg = Math.sign(D);
      const tx = (c) => `translateX(${c}px) translateX(-50%)`;
      o.style.transition = 'none';
      o.animate([{ transform: tx(a), easing: 'cubic-bezier(.55, 0, .35, 1)' }, { transform: tx((a + px) / 2), offset: 0.5, easing: 'cubic-bezier(.25, .1, .25, 1)' }, { transform: tx(px) }], { duration: 560 })
        .finished.finally(() => { o.style.transition = ''; });
      i.animate([{ transform: 'scale(1, 1)', easing: 'cubic-bezier(.55, 0, .35, 1)' }, { transform: `scale(${((Math.abs(D) + w) / w).toFixed(3)}, .86)`, offset: 0.5, easing: 'cubic-bezier(.25, .1, .25, 1)' }, { transform: 'scale(1, 1)' }], { duration: 560 });
      return;
    }
    const sx = 1 + Math.min(0.6, Math.abs(px - a) / 240);
    i.animate([{ transform: 'scale(1, 1)' }, { transform: `scale(${sx.toFixed(3)}, ${(1 - (sx - 1) * 0.22).toFixed(3)})`, offset: 0.4 }, { transform: 'scale(1, 1)' }], { duration: 460, easing: 'cubic-bezier(.3, .7, .3, 1)' });
  }, [px]);
  return (
    <nav ref={ref} className="botnav" aria-label="Alt menü">
      {geo && px != null && <span ref={pill} className="botnav-pill" data-x={px} style={{ top: geo.top, transform: `translateX(${px}px) translateX(-50%)` }} aria-hidden="true"><i /></span>}
      {items.map(([k, l, i, sh], n) => (
        <button key={k} className={'botnav-b' + (tab === k ? ' on' : '') + (hov === n ? ' hov' : '')} onClick={() => { if (tab !== k) sfx('tap'); navGo(k); }}>
          <span className="botnav-i"><Icon n={i} s={22} />{badge(k) > 0 && <span key={badge(k)} className="badge">{badge(k)}</span>}</span>
          <span>{sh || l}</span>
        </button>
      ))}
    </nav>
  );
}
