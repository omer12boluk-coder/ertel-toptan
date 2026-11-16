import { savesPending } from './saveq.js';
import { HcSearch } from './hcsearch.jsx';
import { LinkCartPage, LinkCartsPage } from './lcart.jsx';
import { PayLinkPage, PayLinkView } from './paylink.jsx';
import { SaveDock } from './savedock.jsx';
import { StoreDecor } from './decor.jsx';
import { activePack, lookColors, logoFilter, ensureLogoSvg } from './presets.js';
import { applyStyle } from './stylekit.js';
import { applyLayout, lookFor } from './dzpresets.js';
import { setupScrollbar } from './scrollbar.js';
import { sfx, setSfxGlobal, setSfxVol, setupSfxTaps } from './sfx.js';
import { SoundButton } from './soundui.jsx';
import { RatePrompt } from './reviews.jsx';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ProductsDrop, AdminDrop, ProfileDrop, BrandsDrop, KalipDrop, SetsDrop, useNavV3 } from './navdrop.jsx';
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
import { guardApi, startTeamSession, stopTeamSession, can } from './team.js';
import { meterInit, meterUser } from './usage.js';
import { NoPerm } from './ekip.jsx';
import { FirebaseBackend } from './backend-firebase.js';
import { Icon, Avatar, PhoneInput, PasswordInput, phoneDigits, ContextMenu, openMenu, copyText } from './ui.jsx';
import { Catalog, ProductPage, hubSwap } from './catalog.jsx';
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
import { HeroGate, HERO_WANTED } from './herogate.jsx'; // 13.11.2026 giriş sayfası (logo efekti)
import { DesignEntry } from './designv3.jsx'; // 7.11.2026: tasarım modu v3 (eski mod 'Gelişmiş')
import { AdminHome, Reports } from './dashboard.jsx';
import { Archive } from './archive.jsx';
import { UsagePage } from './usagepage.jsx';
import { AnimLayer } from './anim.jsx';
import { HdrPanel, useHdrTry } from './hdrtry.jsx';
import { ShopFooter } from './footer.jsx';
import { Orders } from './orders.jsx';
import { OrderForm } from './orderform.jsx';
import { AiAdd } from './aiadd.jsx';
import { Gelen } from './gelen.jsx';
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
  meterInit(area === 'admin' ? 'panel' : area === 'shop' ? 'magaza' : 'bayi'); // kullanım sayacı (usage.js)
  if (area === 'admin') guardApi(A); // 8.11.2026 ekip yetkileri + geçmiş + katalog ezme düzeltmesi (team.js)
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
      stopWatchers(); stopTeamSession(); currentUid = null;
      const tOut = ls.get('team-out', ''); if (tOut) ls.del('team-out');
      store.set({ boot: 'login', user: null, loginError: err || tOut || '', requests: [], customers: [], openReq: null });
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
    currentUid = u.uid; meterUser(u);
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
  if (admin) { startAdminWatchers(A, u); startTeamSession(u, A); } else unsubs.push(A.watchRequests(u, (requests) => store.set({ requests })));
  if (A.watchCatalog) unsubs.push(A.watchCatalog((items) => items && setCatalog(items)));
  if (admin) unsubs.push(A.watchUsers((customers) => store.set({ customers })));
  if (admin && A.watchFeed) unsubs.push(A.watchFeed((feed) => store.set({ feed })));
  loadCart();
  if (admin) syncNow(false).catch(() => {});
  // mağaza resimlerindeki ürün bağlantılarına yedek adres yoksa bir kez ekle (ürün kapanınca kutu boş kalmasın)
  if (admin && A.mode === 'firebase' && can('design')) { const S = store.s.settings; const S2 = withProdFallback(S); if (S2 !== S) A.saveSettings(S2).then(() => store.set({ settings: S2 })).catch((e) => console.warn(e)); }
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
// 7.11.2026 (gece 2): menüden Ürünler'e dönünce kategori/filtre/yüklenen ürünler ve kaydırma yeri KORUNUR (kullanıcı: 'açtığımız her şey kayboluyor');
// hafiflik ekran dışı kartların çizilmemesinden (content-visibility). Açılış sayfası açıksa eskisi gibi önce o.
// açılış sayfası: ilk girişte zaten o gelir; başka sayfadan dönünce listede kalınır, sadece Ürünler'deyken tekrar Ürünler'e basınca açılış sayfasına dönülür
// iPhone alışkanlığı: Ürünler'deyken 1. dokunuş listenin en üstüne kaydırır, en üstteyken 2. dokunuş açılış sayfasına döner
const navGo = (k) => { if (k === 'katalog' && store.s.tab === 'katalog' && store.s.user?.role === 'public' && store.s.settings?.look?.prodHub && scrollY < 12) { hubSwap(() => store.set({ catalogGo: { hub: true } }), 'l'); return; } go(k); };
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
    setSfxGlobal(L.sound !== false); setSfxVol(L.soundVol);
    // 5.11.2026 yönetim paneli teması (Ayarlar › Bayi ve panel renkleri › Yönetim paneli görünümü, look.admin: apple | classic)
    r.classList.toggle('adm-on', isAdm); r.classList.toggle('adm-mini', isAdm && ls.get('adm-mini', false) === true); /* 6.11.2026 daraltılmış yan menü (cihazda) */ r.classList.toggle('adm-apple', isAdm && L.admin !== 'classic'); r.classList.toggle('adm-mark', isAdm && L.adminNav === 'old' && L.adminMark !== false); /* 6.11.2026 telefonda panel belirgin: koyu alt menü + Yönetim rozeti (kapatılabilir) */
    // 5.11.2026 hafif mod (look.lite: auto | on | off): eski bilgisayarda bulanık camlar kapanır → kaydırma akıcı
    r.classList.toggle('lite', L.lite === 'on' || (L.lite !== 'off' && LOW_END.v));
    r.classList.toggle('sb-thin', L.scrollbar !== 'native'); // 7.11.2026 ince süzülen kaydırma çubuğu (bilgisayar); 'native' = tarayıcının çubuğu
    applyLayout(r, pub ? L : {});
    r.classList.remove('fr-1', 'fr-2');
    r.classList.toggle('pill-dark', !!pub && L.pillTone === 'dark');
    { const ph = pub ? L.pillHov : ''; if (ph === 'ink') r.style.setProperty('--pill-hov', 'var(--fg)'); else if (ph === 'none') r.style.setProperty('--pill-hov', 'currentColor'); else if (/^#/.test(ph || '')) r.style.setProperty('--pill-hov', ph); else r.style.removeProperty('--pill-hov'); } // üstüne gelince simge rengi
    r.classList.toggle('cd-on', !!pub && L.cd === true); // 7.11.2026 Claude düzeni (cdhome.jsx)
    r.classList.toggle('hv-cd', !!pub && L.hoverFx !== 'old'); // 7.11.2026 (4) yeni üstüne gelme efekti (banner dili); 'old' = eski
    r.classList.toggle('porc', !!pub && L.porc === true); // 6.11.2026 Paket 0 porselen kutular (bulanıklıksız parlak beyaz) // 6.11.2026 siyah hap (Tasarım › Cam ve hareket) // 6.11.2026 buzlu cam kaldırıldı (kullanıcının kastettiği bu değildi)
    // 6.11.2026 'Sepete ekle' rengi temadan bağımsız (Tasarım › Ürün kartları › Sepete ekle rengi): gray (varsayılan) | accent (eski) | dark | #hex
    const ac = pub ? (L.addColor || 'gray') : 'accent';
    ['gray', 'dark', 'hex'].forEach((k) => r.classList.toggle('addc-' + k, ac === k || (k === 'hex' && /^#/.test(ac))));
    if (/^#/.test(ac)) { r.style.setProperty('--add-hex', ac); r.style.setProperty('--add-hfg', hexLight(ac) ? '#111' : '#fff'); } // 5.11.2026 sayfa genişliği, kenar boşluğu, kutu deseni, zemin ışığı (Tasarım › Sayfa)
    // 3.11.2026 telefon alt menüsü görünümü (Tasarım › Renkler ve sayfa › Telefon alt menüsü); sadece mağazada
    const bn = (pub || (isAdm && L.adminNav !== 'old')) ? (['glass', 'dark', 'bar', 'classic'].includes(L.botnav) ? L.botnav : 'glass') : 'classic';
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
    // 6.11.2026 gece renkleri (look.night): 'graphite' (VARSAYILAN, yönetim panelinin koyu grafit renkleri) | 'copper' (eski Bakır gece)
    r.classList.toggle('nt-gr', dash && L.night !== 'copper');
    r.classList.toggle('th-apple', !!pub && (L.site || 'apple') === 'apple' && !effDark); // varsayılan Apple açık (5.11.2026, kullanıcı onayı)
    document.title = seoTitle() || S.brand.appName;
  }, [S.brand, dev, pub, L.shopAccent, L.shopPrice, L.bg, L.cardR, L.logoTone, L.logoColor, L.botnav, L.site, L.night, L.width, L.edge, L.boxPat, L.bgFx, L.sound, L.lite, liteTick, isAdm, L.admin, JSON.stringify(L.style || null), JSON.stringify(L.keep || null), JSON.stringify(pk)]);
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
const NAV_ADMIN = [['anasayfa', 'Ana sayfa', 'home', 'Özet'], ['raporlar', 'Raporlar', 'chart'], ['talepler', 'Bayi siparişleri', 'chat', 'Bayi'], ['siparisler', 'Siparişler', 'box'], ['siparis', 'Form oluştur', 'tag', 'Form'], ['katalog', 'Ürünler', 'grid'], ['musteriler', 'Müşteriler', 'users'], ['tasarim', 'Tasarım', 'brush'], ['kullanim', 'Kullanım', 'db'], ['ayarlar', 'Ayarlar', 'gear']];
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
    admin && can('quota') && { label: 'Kullanım ve kota', icon: 'db', onClick: () => go('kullanim') },
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
  const nav = admin ? NAV_ADMIN.filter(([k]) => (k !== 'kullanim' || can('quota')) && (k !== 'raporlar' || can('reports'))) : pub ? NAV_PUBLIC.filter(([k]) => (k !== 'anasayfa' || S0.shopHome?.enabled !== false) && (k !== 'kalip' || S0.kalip?.on !== false)) : NAV_USER;
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
  const hdrTry = useHdrTry(); // 15.11.2026 önizlemede 'Üst menü' paneli canlı ayarın üstüne yazar
  const LK0 = lookFor(S0.look, phoneUI);
  const LK = hdrTry && !phoneUI ? { ...LK0, ...hdrTry, header: hdrTry.header || LK0.header } : LK0;
  const hc = pub && LK.header === 'center';
  const hs = pub && ['search', 'search2', 'search3', 'search1'].includes(LK.header || 'search'); // 15.11.2026 'search2' = Arama + cam 2 (aynı menü, buz mavisi gerçek cam)
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
  // 15.11.2026 'Arama + cam 2' (look.header 'search2'): Cam + arama ile aynı menü, buz mavisi gerçek cam (html gs-ice).
  // look.hdrScroll 'island' = Ada (bilgisayarda kaydırınca daralır; isteğe bağlı, varsayılan kapalı)
  const gsIce = hs && LK.header === 'search2';
  // 15.11.2026 Ada artık TÜM üst menülerde (bilgisayar): cam + arama ailesi kendi Ada'sı (gs-isl), diğerleri ortak Ada (html isl-any). look.islOpen 'top' = sadece sayfanın en başında açılır
  const islOn = pub && !phoneUI && LK.hdrScroll === 'island';
  const gsIsl = hs && islOn;
  const islAny = islOn && !hs;
  useEffect(() => { const c = document.documentElement.classList; c.toggle('gs-ice', gsIce); c.toggle('gs-isl', gsIsl); c.toggle('isl-any', islAny); return () => c.remove('gs-ice', 'gs-isl', 'isl-any'); }, [gsIce, gsIsl, islAny]);
  // 15.11.2026 menü logosunun arkasındaki beyaz yuvarlak + gri halka kalktı (her renkte menüye uyar); look.logoBg 'disc' = eski
  // 15.11.2026 'Arama + cam 3' (look.header 'search3'): aynı menü/işlev, daha uzun + kristal cam (html gs-x3); look.gs3Tone 'ice' = buz mavisi tonu (html gs-x3i). Kalıp bulucu simgesi 'stencil'.
  const gsX3 = hs && LK.header === 'search3';
  const gsX3i = gsX3 && LK.gs3Tone === 'ice';
  useEffect(() => { const c = document.documentElement.classList; c.toggle('gs-x3', gsX3); c.toggle('gs-x3i', gsX3i); return () => c.remove('gs-x3', 'gs-x3i'); }, [gsX3, gsX3i]);
  // 15.11.2026 Kristal cam bilgisayar görünümü (sadece ≥900px CSS'te): look.gs3Pc '' = 'web' şerit + en üstte şeffaf (kaydırınca cam) | 'strip' şerit | 'ada2' sade yüzen ada | 'ada' eski kapsül
  const gs3Pc = gsX3 ? (LK.gs3Pc || 'web') : '';
  useEffect(() => {
    const c = document.documentElement.classList;
    c.toggle('gs-x3-strip', gs3Pc === 'web' || gs3Pc === 'strip'); c.toggle('gs-x3-web', gs3Pc === 'web'); c.toggle('gs-x3-ada2', gs3Pc === 'ada2');
    if (gs3Pc !== 'web') { c.remove('gs-x3-at0'); return () => c.remove('gs-x3-strip', 'gs-x3-web', 'gs-x3-ada2'); }
    let raf = 0, was = null;
    const f = () => { raf = 0; const t = scrollY < 6; if (t !== was) { was = t; c.toggle('gs-x3-at0', t); } };
    const on = () => { if (!raf) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    addEventListener('scroll', on, { passive: true });
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf); c.remove('gs-x3-strip', 'gs-x3-web', 'gs-x3-ada2', 'gs-x3-at0'); };
  }, [gs3Pc]);
  // 15.11.2026 'Tek satır' (look.header 'search1'): Cam + arama'nın bilgisayarda TEK SATIR hâli (telefon aynı), genişliği bannerla aynı.
  // look.gs1Tone '' beyaz | ice | smoke | tint | ink · gs1Top '' düz | glass (banner menünün arkasından başlar) | clear (en üstte şeffaf)
  // gs1Drop '' fareyle | click (tıklayınca açılır) · gs1Srch '' kutu | icon (simge, basınca açılır) · gs1Hov '' bugünkü | slide (kayan kutu) | dock (büyüme)
  const gs1 = hs && LK.header === 'search1';
  const gs1Cls = gs1 ? ['gs-one', 'gs1-t-' + (LK.gs1Tone || 'white'), (LK.gs1Drop === 'click' || LK.gs1Drop === 'split') && 'gs1-click', LK.gs1Drop === 'split' && 'gs1-split', LK.gs1Srch === 'icon' && 'gs1-sicon', LK.gs1Hov === 'slide' && 'gs1-slide', LK.gs1Hov === 'dock' && 'gs1-dock', LK.gs1Top === 'glass' && 'gs1-under', LK.gs1Top === 'clear' && 'gs1-clear', ['text', 'roll', 'mercury', 'island', 'ink', 'line', 'spot', 'stack', 'pill', 'side', 'expand', 'toggle', 'stack2', 'dock'].includes(LK.gs1Lbl) && 'gs1-lb-' + LK.gs1Lbl, LK.gs1Lbl === 'pick' && 'gs1-lb-expand gs1-lb-pick', LK.gs1Lbl === 'dock' && LK.gs1Dock && 'gs1-dk-' + LK.gs1Dock, LK.gs1SsIc === 'off' && 'gs1-noss', LK.gs1Chev === 'show' && 'gs1-chev'].filter(Boolean).join(' ') : '';
  const heroW = S0.shopHome?.heroW || '';
  // useLayoutEffect + son genişlik cihazda saklı (ls gs1-x): menü ilk karede doğru ölçüde çizilir → giriş sayfasından uçan logo
  // menü logosunun GERÇEK yerine iner (ayarlar geç gelince menü 100 px kayıyordu, logo boşluğa iniyordu)
  useLayoutEffect(() => {
    const c = document.documentElement.classList; const on = gs1Cls ? gs1Cls.split(' ') : [];
    on.forEach((k) => c.add(k));
    const gx = { narrow: '1280px', mid: '1440px', wide: '1640px', full: '100vw' }[heroW] || (S0.shopHome ? '1440px' : ls.get('gs1-x', '1440px'));
    document.documentElement.style.setProperty('--gs1-x', gx); if (S0.shopHome) ls.set('gs1-x', gx);
    return () => { on.forEach((k) => c.remove(k)); document.documentElement.style.removeProperty('--gs1-x'); };
  }, [gs1Cls, heroW]);
  useGs1Top(gs1 && !phoneUI && LK.gs1Top === 'clear', tab);
  useGs1Search(gs1 && !phoneUI);
  useGs1Toggle(gs1 && !phoneUI && LK.gs1Lbl === 'toggle');
  useGs1IslIc(gs1 && gsIsl && !phoneUI);
  useGs1IconPill(gs1 && !phoneUI && LK.gs1Lbl === 'stack2');
  useGs1Tip(gs1 && !phoneUI && LK.gs1Lbl === 'dock' && LK.gs1Dock !== 'center' ? LK.gs1Dock || 'below' : '');
  // 16.11.2026 'Sadece seçilinin adı' (gs1Lbl 'pick'): Uzayan menünün aynısı ama fareyle uzamaz; adı kapalı simgelerin üstünde ipucu (title)
  const gs1Pick = gs1 && !phoneUI && LK.gs1Lbl === 'pick';
  useEffect(() => {
    if (!gs1Pick) return undefined;
    const bs = [...document.querySelectorAll('.topbar.hdr-gs .gs-nav .topnav-b')];
    bs.forEach((b) => { if (!b.title) { b.title = b.querySelector('.topnav-l')?.textContent || ''; b.dataset.gs1t = '1'; } });
    const ms = () => bs.forEach((b) => { const l = b.querySelector('.topnav-l'); if (l) b.style.setProperty('--lw', Math.ceil(l.scrollWidth + 1) + 'px'); });
    ms(); document.fonts?.ready?.then(ms);
    return () => bs.forEach((b) => { if (b.dataset.gs1t) { b.removeAttribute('title'); delete b.dataset.gs1t; } });
  }, [gs1Pick]);
  useGs1Lbl(gs1 && !phoneUI && ['roll', 'mercury', 'island', 'line', 'spot', 'pill', 'side', 'expand'].includes(LK.gs1Lbl) ? LK.gs1Lbl : '');
  useGs1Hover(gs1 && !phoneUI && (LK.gs1Hov === 'slide' || LK.gs1Hov === 'dock') ? LK.gs1Hov : '');
  const lgDisc = LK.logoBg === 'disc';
  useEffect(() => { document.documentElement.classList.toggle('lg-disc', lgDisc); }, [lgDisc]);
  useIsland(islOn, tab, LK.islOpen === 'top');
  useHideTop(pub && LK.hideTop !== false && !islOn, LK.hideTop === 'up', tab, urunLayer);
  // 14.11.2026 ortada logo menüsünün görünümü (look.hcStyle): '' bugünkü | 'glass2' cam iki satır | 'glass1' cam tek satır (menü logonun iki yanında) | 'clear' üstte şeffaf, kayınca cam.
  // Banner her durumda menünün BİTTİĞİ yerden başlar (menü bannerın üstüne binmez).
  const hcSt = hc ? (LK.hcStyle || '') : '';
  const hcOne = hcSt === 'glass1' && !phoneUI;
  useEffect(() => { const c = document.documentElement.classList; c.toggle('hc-one', hcOne); return () => c.remove('hc-one'); }, [hcOne]);
  // 14.11.2026 UI/UX incelemesi: ana sayfa düzeltmeleri look.ux.{wa,foot,nw,tr} — 'old' = eski hâl (html ux-* sınıfları)
  const uxOn = ['wa', 'foot', 'nw', 'tr'].filter((k) => (LK.ux || {})[k] !== 'old').join(' ');
  useEffect(() => { const c = document.documentElement.classList; const on = uxOn ? uxOn.split(' ') : []; on.forEach((k) => c.add('ux-' + k)); return () => on.forEach((k) => c.remove('ux-' + k)); }, [uxOn]);
  useEffect(() => { if (hcSt !== 'clear') return; const c = document.documentElement.classList; const f = () => c.toggle('hc-scr', scrollY > 4); f(); addEventListener('scroll', f, { passive: true }); return () => { removeEventListener('scroll', f); c.remove('hc-scr'); }; }, [hcSt]);
  const navTab = tab === 'sepetler' || tab === 'gecmis' ? 'siparisler' : tab === 'sepetlink' || tab === 'odemelink' ? 'siparis' : tab === 'setler' || tab === 'aiekle' || tab === 'gelen' ? 'katalog' : tab; // alt sayfalar menüde ana sekmesini yakar (Setler = Ürünler'in alt sayfası)

  const v3 = useNavV3(); // 14.11.2026 v3 açılırlar: Kalıp bulucu ▾ ve Setler ▾ da açılır (look.navDrop '')
  const hcNav = hc ? [
    ...nav.filter(([k]) => k !== 'hesap' && k !== 'sepet' && k !== 'tasarim').map(([k, l]) => {
      const b = <button key={k} className={'topnav-b' + (navTab === k ? ' on' : '')} onClick={() => navGo(k)}><span className="topnav-l">{l}</span>{(k === 'katalog' || (v3 && k === 'kalip')) && <span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span>}</button>;
      return k === 'katalog' ? <ProductsDrop key={k}>{b}</ProductsDrop> : k === 'kalip' ? <KalipDrop key={k}>{b}</KalipDrop> : b;
    }),
    <BrandsDrop key="markalar"><button className={'topnav-b' + (tab === 'markalar' ? ' on' : '')} onClick={() => go('markalar')}><span className="topnav-l">Markalar</span><span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span></button></BrandsDrop>,
    hasSets && <SetsDrop key="setlist"><button className={'topnav-b' + (tab === 'setlist' ? ' on' : '')} onClick={() => go('setlist')}><span className="topnav-l">Setler</span>{v3 && <span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span>}</button></SetsDrop>,
  ].filter(Boolean) : null;
  return (
    <div className={'shell tab-' + tab + (admin ? ' admin' + (S0.look?.adminNav !== 'old' ? ' adm-bn' + (S0.look?.adminNavTone === 'accent' ? '' : ' bn-ink') : '') : '') + (pub ? ' public' : '')} onContextMenu={(e) => pageMenu(e, user.role)}>
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
              const b = <button key={k} className={'topnav-b' + (navTab === k ? ' on' : '')} onClick={() => navGo(k)}><Icon n={gsX3 && k === 'kalip' ? 'stencil' : i} s={16} /><span className="topnav-l">{l}</span>{(k === 'katalog' || (v3 && k === 'kalip')) && <span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span>}</button>;
              return k === 'katalog' ? <ProductsDrop key={k}>{b}</ProductsDrop> : k === 'kalip' ? <KalipDrop key={k}>{b}</KalipDrop> : b;
            })}
            <BrandsDrop><button className={'topnav-b' + (tab === 'markalar' ? ' on' : '')} onClick={() => go('markalar')}><Icon n="tag" s={16} /><span className="topnav-l">Markalar</span><span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span></button></BrandsDrop>
            {hasSets && <SetsDrop><button className={'topnav-b' + (tab === 'setlist' ? ' on' : '')} onClick={() => go('setlist')}><Icon n="box" s={16} /><span className="topnav-l">Setler</span>{v3 && <span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span>}</button></SetsDrop>}
          </nav>
        </div>
      </header> : hc ? <header className={'topbar hdr-c' + (hcSt ? ' hcs-' + hcSt : '')}>
        <div className="topbar-in">
          {/* 6.11.2026: bilgisayarda solda ses + gece düğmesi, sağda arama (logoya doğru uzar, diğerlerinin üstüne binmez) + bildirim; telefonda eskisi gibi */}
          <span className="hc-l">{phoneUI ? <><HeaderSearch /><ShopBell /></> : <><SoundButton /><ThemeButton />{hcOne && <nav className="topnav hc-nav1" aria-label="Ana menü">{hcNav.slice(0, 3)}</nav>}</>}</span>
          <button className="hc-mid" onClick={home} aria-label="Ana sayfa" title="Ana sayfa">
            <img className="brand-logo" src={S0.brand.logo || LOGO_MARK} alt="" />
            <b className="hc-name" style={S0.brand.nameColor ? { color: S0.brand.nameColor } : undefined}>{S0.brand.appName}</b>
          </button>
          <span className="hc-r">
            {hcOne && <nav className="topnav hc-nav1" aria-label="Ana menü (devam)">{hcNav.slice(3)}</nav>}
            {!phoneUI && <>{LK.hcSearch === 'old' ? <HeaderSearch /> : <HcSearch />}<ShopBell /></>}
            <HeaderCart on={tab === 'sepet'} />
            {phoneUI && <><SoundButton /><ThemeButton /></>}
            {member
              ? <ProfileDrop><button className={'me' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Hesabım"><span className="me-t"><b>{member.name || member.email}</b><small>Hesabım</small></span><Avatar u={member} size={34} /></button></ProfileDrop>
              : <button className={'btn sm outline me-login' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Giriş yap"><Icon n="user" s={16} /><span className="me-login-l">Giriş yap</span><span className="me-login-s">Giriş yap</span></button>}
          </span>
          {!hcOne && <nav className="topnav hc-nav" aria-label="Ana menü">{hcNav}</nav>}
        </div>
      </header> : <header className={'topbar' + (pub && LK.header === 'glass' ? ' hdr-g' : '')}>
        <div className="topbar-in">
          <Brand small onClick={home} />
          {admin && <button type="button" className="adm-fold" onClick={() => { const on = !document.documentElement.classList.contains('adm-mini'); document.documentElement.classList.toggle('adm-mini', on); ls.set('adm-mini', on); }} aria-label="Menüyü daralt / genişlet" title="Menüyü daralt / genişlet"><Icon n="back" s={14} /></button>}
          {admin && <span className="admin-badge" title="Yönetim paneli"><Icon n="shield" s={14} /><span className="badge-t">Yönetim paneli</span></span>}
          {pub && <span className="pub-id"><b className="pub-name" style={S0.brand.nameColor ? { color: S0.brand.nameColor } : undefined}>{S0.brand.appName}</b></span>}
          <nav className="topnav" aria-label="Ana menü">
            {nav.filter(([k]) => !(pub && k === 'hesap') && (admin || k !== 'sepet') && k !== 'tasarim').map(([k, l, i]) => {
              const drop = (pub && (k === 'katalog' || (v3 && k === 'kalip'))) || (admin && ['siparisler', 'siparis', 'katalog', 'musteriler'].includes(k));
              const b = (
                <button key={k} className={'topnav-b' + (navTab === k ? ' on' : '')} onClick={() => navGo(k)} title={l}>
                  <Icon n={i} s={18} /><span className="topnav-l">{l}</span>{badge(k) > 0 && <span key={badge(k)} className="badge">{badge(k)}</span>}{drop && <span className="topnav-chev" aria-hidden="true"><Icon n="down" s={13} /></span>}
                </button>
              );
              return !drop ? b : pub ? (k === 'kalip' ? <KalipDrop key={k}>{b}</KalipDrop> : <ProductsDrop key={k}>{b}</ProductsDrop>) : <AdminDrop key={k} k={k}>{b}</AdminDrop>;
            })}
          </nav>
          <span className="top-sp" />
          {pub && <HeaderSearch />}
          {pub && <ShopBell />}
          {!admin && <HeaderCart on={tab === 'sepet'} />}
          {!admin && !pub && <a className="icon-btn to-landing" href="/" title="Mağazaya git" aria-label="Mağazaya git"><Icon n="store" s={19} /></a>}
          {admin && <NotifBell />}
          {admin && <SoundButton />}{/* 6.11.2026 (7): yönetimde de ses aç/kapat (yan menü altında zil ile ay arasında) */}
          <ThemeButton />
          {pub && (member
            ? <ProfileDrop><button className={'me' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Hesabım"><span className="me-t"><b>{member.name || member.email}</b><small>Hesabım</small></span><Avatar u={member} size={34} /></button></ProfileDrop>
            : <button className={'btn sm outline me-login' + (tab === 'hesap' ? ' on' : '')} onClick={() => go('hesap')} aria-label="Giriş yap"><Icon n="user" s={16} /><span className="me-login-l">Giriş yap</span><span className="me-login-s">Giriş yap</span></button>)}
          {!pub && (
            <button className="me" onClick={() => go(admin ? 'ayarlar' : 'profil')} aria-label="Profil">
              <span className="me-t"><b>{user.name || user.username}</b><small>{admin ? (user.staff ? 'Ekip üyesi' : 'Yönetici') : user.shop}</small></span>
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
        {tab === 'kullanim' && admin && <UsagePage />}
        {tab === 'raporlar' && admin && <Reports />}
        {tab === 'gecmis' && admin && <Archive />}
        {pub && (tab === 'anasayfa' || kept.current.has('anasayfa')) && <section data-kp="anasayfa" className={'kp' + (tab === 'anasayfa' || (tab === 'urun' && urunLayer) ? '' : ' kp-off')}><HomeM /></section>}
        {tab === 'liste' && pub && <CodeList code={ROUTE.listCode} />}
        {tab === 'lsepet' && pub && <LinkCartPage id={ROUTE.lcartId} />}
        {tab === 'odeme' && pub && <PayLinkView id={ROUTE.payId} />}
        {tab === 'sepetlink' && admin && <OrderForm linkMode />}
        {tab === 'sepetler' && admin && <LinkCartsPage />}
        {tab === 'odemelink' && admin && <PayLinkPage />}
        {(tab === 'katalog' || ((pub || admin) && kept.current.has('katalog'))) && <section data-kp="katalog" className={'kp' + (tab === 'katalog' ? '' : ' kp-off')}><CatalogM admin={admin} /></section>}
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
        {tab === 'gelen' && admin && <Gelen />}
        {tab === 'talep' && pub && <PreqPage />}
        {tab === 'yasal' && pub && <LegalPage />}
        {tab === 'yok' && pub && <NotFound />}
        {tab === 'sorun' && pub && <IssuePage />}
        {tab === 'islem' && pub && <AuthAction />}
        {tab === 'ayarlar' && admin && <Settings />}
        {tab === 'tasarim' && admin && (can('design') ? <DesignEntry /> : <NoPerm perm="design" />)}
      </main>
      {pub && !['katalog', 'sepet', 'hesap', 'kalip'].includes(tab) && <ShopFooter compact={tab !== 'anasayfa'} />}
      {pub && <AnimLayer />}
      {pub && <HdrPanel />}
      {!admin && tab !== 'lsepet' && tab !== 'odeme' && <CartBar />}
      {admin && vitrinCode && <VitrinListEditor code={vitrinCode} onClose={() => store.set({ vitrinCode: null })} />}
      {admin && vitrinOpen && <OpenVitrinList onClose={() => store.set({ vitrinOpen: false })} />}
      <BotNav items={nav.filter(([k]) => k !== 'tasarim' && k !== 'kullanim' && k !== 'raporlar' && !(admin && k === 'siparis'))} tab={navTab} badge={badge} />
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
  const want = S.brand.splashOn !== false && !ADMIN_ROUTE && !HERO_WANTED && (() => { try { return !sessionStorage.getItem('intro-seen'); } catch { return true; } })();
  const [phase, setPhase] = useState(want ? 'in' : 'off');
  const [minDone, setMinDone] = useState(false);
  useEffect(() => { if (!want) return; try { sessionStorage.setItem('intro-seen', '1'); } catch {} const sec = Math.min(8, Math.max(0.5, Number(S.brand.splashSec) || 1.4)); const t = setTimeout(() => setMinDone(true), sec * 1000); const max = setTimeout(() => setPhase('out'), Math.max(sec + 3, 4.5) * 1000); return () => { clearTimeout(t); clearTimeout(max); }; }, []);
  useEffect(() => { if (phase === 'in' && minDone && ready) setPhase('out'); }, [minDone, ready, phase]);
  useEffect(() => { if (phase === 'out') { const t = setTimeout(() => setPhase('off'), 500); return () => clearTimeout(t); } }, [phase]);
  // arka plan seçeneği (Ayarlar > Genel > Açılış ekranı): navy | light | white (varsayılan) | grad | apple
  // Ayarlar henüz gelmediyse (ilk çizim varsayılan ayarlarla olur → lacivert görünüp 0.1 sn sonra seçili renge geçiyordu)
  // son bilinen seçimi (localStorage 'intro-sty') kullan; ayar gelince o geçerli olur.
  const [cachedSty] = useState(() => { try { return localStorage.getItem('intro-sty') || ''; } catch { return ''; } });
  const rawSty = S.brand.splashStyle || cachedSty;
  const sty = SPLASH_STYLES[rawSty] ? rawSty : 'white'; // varsayılan düz beyaz (7.11.2026)
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
  // giriş sayfası açıkken mağaza çizilmez (banner/video oynamaz); 'Alışverişe başla'ya basınca çizilir
  const [gate, setGate] = useState(HERO_WANTED ? 'on' : 'off');
  const shell = gate !== 'on';
  return (
    <>
      {b === 'loading' && <Splash />}
      {b === 'landing' && <Landing />}
      {b === 'error' && <div className="splash"><Brand /><p className="err">{bootError}</p><button className="btn outline" onClick={() => location.reload()}>Tekrar dene</button></div>}
      {b === 'login' && <Login />}
      {b === 'login' && store.s.api?.mode === 'demo' && <DemoSwitch admin />}
      {b === 'ready' && shell && <Shell />}
      {b === 'ready' && shell && <StoreDecor />}
      {b === 'ready' && pub && <RatePrompt />}
      {b === 'ready' && <SaveDock />}
      <IntroSplash />
      {gate !== 'off' && <HeroGate onOpen={() => setGate((g) => (g === 'on' ? 'opening' : g))} onDone={() => { window.__gateDone?.(); setGate('off'); }} />}
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
  setupCrispBack();
  setupResumeFix();
}
// 6.11.2026 (6): arama kutularında tarayıcının eski aramalar listesi (siyah öneri kutusu) çıkmasın — odaklanınca autocomplete=off
document.addEventListener('focusin', (e) => {
  const t = e.target; if (!(t instanceof HTMLInputElement) || t.hasAttribute('autocomplete')) return;
  if (t.type === 'search' || /\bara\b|ara…|ara\.\.\.|^Ara/i.test(t.placeholder || '') || t.closest('[class*="search"], [class*="srch"]')) t.setAttribute('autocomplete', 'off');
}, true);
// 6.11.2026 (6): arama kutularında tarayıcının 'eski aramalar' siyah öneri listesi çıkmasın (ad/telefon/adres alanlarının
// otomatik doldurması korunur: sadece type=search ya da 'ara' yazan / arama kutusu içindeki alanlar)
addEventListener('focusin', (e) => {
  const t = e.target; if (!(t instanceof HTMLInputElement) || t.hasAttribute('autocomplete')) return;
  if (t.type === 'search' || /\bara\b|ara…|ara\.\.\.|Ara…/i.test(t.placeholder || '') || t.closest('.search, .hsearch, .hsearch-box, [class*="srch"]')) t.setAttribute('autocomplete', 'off');
}, true);
setupNavAnim(); // 6.11.2026: bilgisayarda da (eskiden sadece telefonda çağrılıyordu → bilgisayarda sadece CSS 'alttan yükselme' vardı, look.motionD hiç çalışmıyordu)
setupFlowPills(); // akan hap: bilgisayarda da
setupSfxTaps(); // 6.11.2026 mağazada dokunma sesleri
setupScrollbar(); // 7.11.2026 ince kaydırma çubuğu (scrollbar.js)

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
// 15.11.2026 'Ada' üst menü: aşağı kaydırınca html.isl → cam daralır, menü satırı kaybolur (CSS). Titreme olmasın diye
// 90px'te daralır, 40px'in altında ya da 70px+ yukarı kaydırınca açılır. Sayfa yüksekliği değişmez (topbar dış kutusu sabit).
// 15.11.2026: topOnly (look.islOpen 'top') = yukarı kaydırınca AÇILMAZ, sadece sayfanın en başında. Ortak Ada'da (isl-any) dış kutu boyu --isl-h ile sabitlenir.
// 15.11.2026 Tek satır üst menü: 'Şeffaf' ayarında en üstteyken html gs1-at0
function useGs1Top(on, tab) {
  useEffect(() => {
    const c = document.documentElement.classList;
    if (!on) { c.remove('gs1-at0'); return; }
    let raf = 0, was = null;
    const f = () => { raf = 0; const t = scrollY < 6; if (t !== was) { was = t; c.toggle('gs1-at0', t); } };
    const on2 = () => { if (!raf) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    addEventListener('scroll', on2, { passive: true });
    return () => { removeEventListener('scroll', on2); cancelAnimationFrame(raf); c.remove('gs1-at0'); };
  }, [on, tab]);
}
// 15.11.2026 (2) Tek satır arama: tıklayınca kutu sadece menü ile arasındaki BOŞ yere kadar büyür (hiçbir şeyin üstüne binmez; menü ortada kalmak için yana kayar)
// tek satır menünün adlar TAM açıkken kaplayacağı genişlik (uzayan menü: hepsi; yanında ad: en uzun tek ad). Arama bu payı bırakarak büyür,
// menü de ancak sığarsa uzar → ikisi asla üst üste binmez, kimse kimseyi itmez
function gs1NavNeed(nav) {
  const bs = [...nav.querySelectorAll('.topnav-b')]; if (!bs.length) return 0;
  // 16.11.2026: menünün TÜM görünür parçaları sayılır ('Uzat / kısalt' düğmesi sayılmıyordu → arama büyüyünce menü logonun altına giriyordu)
  const ks = [...nav.children].filter((k) => k.offsetWidth && getComputedStyle(k).position !== 'absolute');
  const used = ks[ks.length - 1].getBoundingClientRect().right - ks[0].getBoundingClientRect().left;
  const H = document.documentElement.classList; const all = H.contains('gs1-lb-expand') && !H.contains('gs1-lb-pick'), side = H.contains('gs1-lb-side') || H.contains('gs1-lb-pick');
  if (!all && !side) return used;
  let now = 0, sum = 0; const fs = [];
  bs.forEach((b) => { const l = b.querySelector('.topnav-l'); if (!l) return; const c = b.querySelector('.topnav-chev');
    now += l.getBoundingClientRect().width + (c ? c.getBoundingClientRect().width : 0);
    const full = l.scrollWidth + 8 + (c ? 22 : 0) + 4; sum += full; fs.push(full); });
  // 16.11.2026: tek ad açılan biçimlerde aynı anda İKİ ad açık olabilir (seçili sayfa + açılır menüsü açık olan) → en uzun iki ad kadar yer
  fs.sort((x, y) => y - x);
  return used - now + (all ? sum : (fs[0] || 0) + (fs[1] || 0));
}
function useGs1Search(on) {
  useEffect(() => {
    if (!on) return undefined;
    const h = document.querySelector('.topbar.hdr-gs'); if (!h) return undefined;
    let t = 0, nT = 0, cT = 0;
    const open = (e) => {
      const sr = e.target.closest?.('.gs-srch'); if (!sr) return; clearTimeout(t);
      const nav = h.querySelector('.gs-nav'); const bs = nav ? [...nav.querySelectorAll('.topnav-b')] : [];
      if (!bs.length) return;
      // 16.11.2026: 'Simge + yazı' (ve Uzat/kısalt'ın uzun hâli) açıkken arama açılınca menü yazıları kapanır, sadece simgeler kalır
      // (html gs1-ss) → aramaya daha çok yer; kapanınca yazılar geri gelir. Kısa hâlin genişliği bir anlığına geçişsiz ölçülür.
      const H = document.documentElement.classList; const lb = [...H].find((c) => c.startsWith('gs1-lb-'));
      const ss = !H.contains('gs1-noss') && (!lb || (lb === 'gs1-lb-toggle' && !H.contains('gs1-tg-s')));
      let need, off = 0; const fix = ss || lb === 'gs1-lb-dock' || ((!lb || lb === 'gs1-lb-toggle') && H.contains('gs1-noss')); // Dock: yazı yok ama simgeler yine yerinde kalsın
      // 16.11.2026: menü öğeleri YERİNDE kalır — arama büyürken ortalı menü sola kayıyordu ('ufak tık'). Menünün o anki sol payı sabitlenir
      // (sola yaslı + aynı pay), arama sadece sağdaki boşluğa büyür; yazılar kapanırken simgeler soldan yerinde durur. Kapanınca ortalamaya döner.
      if (fix) {
        clearTimeout(nT); const ks = [...nav.children].filter((k) => k.offsetWidth && getComputedStyle(k).position !== 'absolute');
        if (ks.length && !nav.style.paddingLeft) { const nr = nav.getBoundingClientRect(); off = ks[0].getBoundingClientRect().left - nr.left; nav.style.justifyContent = 'flex-start'; nav.style.paddingLeft = off.toFixed(2) + 'px'; }
        else off = parseFloat(nav.style.paddingLeft) || 0;
      }
      if (ss && !H.contains('gs1-ss')) {
        bs.forEach((b) => { const l = b.querySelector('.topnav-l'); if (l && !b.style.getPropertyValue('--lw')) b.style.setProperty('--lw', Math.ceil(l.scrollWidth + 1) + 'px'); });
        H.add('gs1-meas2', 'gs1-ss'); need = gs1NavNeed(nav); H.remove('gs1-ss'); void nav.offsetWidth; H.remove('gs1-meas2'); void nav.offsetWidth; H.add('gs1-ss');
      } else need = gs1NavNeed(nav);
      // menünün sol payı dolu sayılır; sağ pay ('Sadece seçilinin adı') arama açılınca kalkar (html gs1-so) → simgeler itilir
      if (!off) off = parseFloat(getComputedStyle(nav).paddingLeft) || 0;
      H.add('gs1-so');
      const room = nav.clientWidth - off - need - 12; const w = sr.getBoundingClientRect().width;
      sr.style.setProperty('--gs1-sw', Math.round(Math.max(w, Math.min(ss ? 660 : 560, w + room))) + 'px');
      clearTimeout(cT); sr.removeAttribute('data-cl'); sr.setAttribute('data-open', '');
    };
    const close = (e) => { const sr = e.target.closest?.('.gs-srch'); if (!sr) return; t = setTimeout(() => { if (!sr.contains(document.activeElement)) { sr.style.removeProperty('--gs1-sw'); if (sr.hasAttribute('data-open')) { sr.setAttribute('data-cl', ''); clearTimeout(cT); cT = setTimeout(() => sr.removeAttribute('data-cl'), 430); } sr.removeAttribute('data-open'); document.documentElement.classList.remove('gs1-ss', 'gs1-so');
      const nav = h.querySelector('.gs-nav'); clearTimeout(nT); nT = setTimeout(() => { if (nav && !sr.contains(document.activeElement)) { nav.style.justifyContent = ''; nav.style.paddingLeft = ''; } }, 480); } }, 200); };
    // 16.11.2026: arama açıkken menüdeki bir sayfaya basınca arama KAPANMAZ (odak kutuda kalır, yeni sayfada açık devam eder)
    const keep = (e) => { if (e.button === 0 && e.target.closest?.('.gs-nav .topnav-b') && h.querySelector('.gs-srch')?.contains(document.activeElement)) e.preventDefault(); };
    h.addEventListener('mousedown', keep, true);
    h.addEventListener('focusin', open); h.addEventListener('focusout', close);
    return () => { h.removeEventListener('mousedown', keep, true); h.removeEventListener('focusin', open); h.removeEventListener('focusout', close); clearTimeout(t); h.querySelector('.gs-srch')?.style.removeProperty('--gs1-sw'); document.documentElement.classList.remove('gs1-ss', 'gs1-so'); clearTimeout(nT); clearTimeout(cT); const nv = h.querySelector('.gs-nav'); if (nv) { nv.style.justifyContent = ''; nv.style.paddingLeft = ''; } };
  }, [on]);
}
// 15.11.2026 (4) Tek satır 'Menü yazıları' hareketleri: fare bir başlıkta kısa durunca .xo (dönen yazı / cıva); cıva = sıvı damla
// eski yerinden yenisine önce iki başlığı kapsayacak kadar uzayıp sonra yeni yerine toplanarak akar (WAAPI, yaylanma yok);
// ada = menünün üstüne gelince .xo-all → kapsül tek parça açılır (her düğme kendi adının genişliğine, --w ölçülür)
// 15.11.2026 'Uzat / kısalt': Simge + yazı'nın aynısı + menünün sonunda küçük düğme; kısalt = hep simge, uzat = hep simge + ad (seçim cihazda: ls gs1-tg)
function useGs1Toggle(on) {
  useEffect(() => {
    const H = document.documentElement.classList;
    if (!on) { H.remove('gs1-tg-s'); return undefined; }
    const nav = document.querySelector('.topbar.hdr-gs .gs-nav'); if (!nav) return undefined;
    const measure = () => nav.querySelectorAll('.topnav-b').forEach((b) => { const l = b.querySelector('.topnav-l'); if (l) b.style.setProperty('--lw', Math.ceil(l.scrollWidth + 1) + 'px'); });
    measure(); document.fonts?.ready?.then(measure);
    let short = false; try { short = localStorage.getItem('gs1-tg') === 's'; } catch { /* yok */ }
    const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'gs1-tgb';
    const ico = (s) => s ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7l5 5-5 5M6 7l5 5-5 5"/></svg>'
      : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 7l-5 5 5 5M18 7l-5 5 5 5"/></svg>';
    // 16.11.2026: uzun hâl menüye SIĞMIYORSA (dar ekran) kendiliğinden kısa olur ve uzat düğmesi gizlenir (menü logonun altına giriyordu);
    // yer açılınca kullanıcının seçimine döner. Uzun hâlin genişliği sadece uzunken ölçülür (need).
    let auto = false, need = 0, rT = 0;
    const paint = () => { H.toggle('gs1-tg-s', short || auto); bt.style.display = auto ? 'none' : ''; bt.innerHTML = ico(short); bt.title = short ? 'Menüyü uzat' : 'Menüyü kısalt'; bt.setAttribute('aria-label', bt.title); };
    paint(); nav.append(bt);
    // 16.11.2026: Ada'dayken / Ada geçişinde ve arama açıkken / kapanırken (menü hareket hâlinde) ÖLÇÜLMEZ — yarı yoldaki ölçü 'sığmıyor' sanıp kendi kendine kısaltıyordu
    const busy = () => H.contains('isl') || H.contains('isl-mv') || H.contains('gs1-ss') || H.contains('gs1-so') || !!nav.style.paddingLeft || !!document.querySelector('.gs-srch[data-open], .gs-srch[data-cl], .gs-srch:focus-within');
    const fit = () => { if (busy()) { clearTimeout(rT); rT = setTimeout(fit, 300); return; } if (!H.contains('gs1-tg-s')) need = gs1NavNeed(nav);
      const a = !short && need > nav.clientWidth - 2; if (a !== auto) { auto = a; paint(); } };
    const ro = new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(fit, 60); }); ro.observe(nav);
    fit(); setTimeout(fit, 80); document.fonts?.ready?.then(() => setTimeout(fit, 80));
    const click = (e) => { e.preventDefault(); e.stopPropagation(); measure(); short = !short; try { localStorage.setItem('gs1-tg', short ? 's' : ''); } catch { /* yok */ } paint(); if (!short) setTimeout(fit, 520); };
    bt.addEventListener('click', click);
    return () => { ro.disconnect(); clearTimeout(rT); bt.removeEventListener('click', click); bt.remove(); H.remove('gs1-tg-s'); };
  }, [on]);
}
// 16.11.2026 Ada'da logodan sonra 'Başa dön' düğmesi (.gs1-islic > .gs1-ic): sayfanın en üstüne yumuşakça çıkar (üstte menü kendiliğinden açılır).
// Önceki sayfa simgeleri kaldırıldı (kullanıcı istedi). Menüden bağımsız; menü yazısı biçimlerine dokunmaz.
function useGs1IslIc(on) {
  useEffect(() => {
    if (!on) return undefined;
    const inr = document.querySelector('.topbar.hdr-gs .topbar-in'); if (!inr) return undefined;
    const box = document.createElement('span'); box.className = 'gs1-islic';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'gs1-ic gs1-top'; x.tabIndex = -1; x.title = 'Başa dön'; x.setAttribute('aria-label', 'Sayfanın başına dön');
    x.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    const go = () => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    x.addEventListener('click', go); box.append(x); inr.append(box);
    document.documentElement.style.setProperty('--gs1-icw', '40px');
    return () => { x.removeEventListener('click', go); box.remove(); document.documentElement.style.removeProperty('--gs1-icw'); };
  }, [on]);
}
// 16.11.2026 'Simge üstte, yazı altta (hap)': tek beyaz hap seçili sayfanın SİMGESİNİN etrafında, sayfa değişince CSS geçişiyle kayar
// 16.11.2026 Dock (gs1Lbl 'dock'): menüde sadece simgeler (seçili = orijinal kayan hap), ok yok; ad sadece üstüne gelince
// simgenin altında küçük etikette. Tek etiket: simgeden simgeye geçerken kayarak yer + yazı değiştirir (yeniden belirmez).
// Açılır menü açılınca etiket söner (panelin üstüne binmesin).
function useGs1Tip(on) {
  // on: 'below' simgenin altında etiket | 'brand' menünün sağında düz yazı | 'right' altta koyu küçük etiket
  useEffect(() => {
    if (!on) return undefined;
    const inl = on === 'brand';
    const nav = document.querySelector('.topbar.hdr-gs .gs-nav'); if (!nav) return undefined;
    const tip = document.createElement('div'); tip.className = 'gs1-tip' + (inl ? ' gs1-tip-in' : on === 'right' ? ' gs1-tip-dk' : ''); tip.setAttribute('aria-hidden', 'true');
    const tx = document.createElement('span'); tip.append(tx); (inl ? nav : document.body).append(tip);
    const tray = document.createElement('span'); tray.className = 'gs1-tray'; tray.setAttribute('aria-hidden', 'true'); nav.prepend(tray);
    const fit = () => { const bs = [...nav.querySelectorAll('.topnav-b')].filter((b) => b.offsetWidth); if (!bs.length) { tray.style.width = '0'; return; }
      const n = nav.getBoundingClientRect(), a = bs[0].getBoundingClientRect(), z = bs.at(-1).getBoundingClientRect();
      Object.assign(tray.style, { width: (z.right - a.left + 6) + 'px', height: (a.height + 6) + 'px', transform: `translate(${a.left - n.left - 3}px, ${a.top - n.top - 3}px)` }); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(nav); nav.querySelectorAll('.topnav-b').forEach((b) => ro.observe(b));
    let cur = null, tIn = 0, tOut = 0, vis = false;
    const nameOf = (b) => (b.querySelector('.topnav-l')?.textContent || '').trim();
    nav.querySelectorAll('.topnav-b').forEach((b) => { const n = nameOf(b); if (n) b.setAttribute('aria-label', n); });
    const place = (b, glide) => {
      const r = b.getBoundingClientRect(); tx.textContent = nameOf(b);
      tip.style.transition = glide ? '' : 'none';
      if (inl) { const bs = [...nav.querySelectorAll('.topnav-b')].filter((q) => q.offsetWidth); const n = nav.getBoundingClientRect(), z = bs.at(-1).getBoundingClientRect();
        tip.style.transform = `translate(${Math.round(z.right - n.left + 14)}px, ${Math.round(n.height / 2 - tip.offsetHeight / 2)}px)`; }
      else { const w = tip.offsetWidth; const x = Math.round(r.left + r.width / 2 - w / 2), y = Math.round(r.bottom + (on === 'right' ? 7 : 9));
        tip.style.transform = `translate(${x}px, ${y}px)`; }
      if (!glide) { void tip.offsetWidth; tip.style.transition = ''; }
    };
    const dropOpen = () => !!nav.querySelector('.hd.open');
    const show = (b) => { if (dropOpen()) return; place(b, vis); vis = true; tip.classList.add('on'); };
    const hide = () => { vis = false; tip.classList.remove('on'); };
    const over = (e) => { const b = e.target.closest?.('.topnav-b'); if (!b || !nav.contains(b) || b === cur) return;
      cur = b; clearTimeout(tOut); clearTimeout(tIn);
      if (vis) show(b); else tIn = setTimeout(() => show(b), 140); };
    const out = (e) => { const to = e.relatedTarget; if (to && to.closest?.('.topnav-b') && nav.contains(to)) return;
      cur = null; clearTimeout(tIn); clearTimeout(tOut); tOut = setTimeout(hide, 90); };
    const down = () => { clearTimeout(tIn); hide(); };
    nav.addEventListener('mouseover', over); nav.addEventListener('mouseout', out); nav.addEventListener('pointerdown', down);
    const mo = new MutationObserver(() => { if (vis && dropOpen()) hide(); });
    mo.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    const sc = () => { clearTimeout(tIn); hide(); }; addEventListener('scroll', sc, { passive: true });
    return () => { nav.removeEventListener('mouseover', over); nav.removeEventListener('mouseout', out); nav.removeEventListener('pointerdown', down);
      mo.disconnect(); ro.disconnect(); removeEventListener('scroll', sc); clearTimeout(tIn); clearTimeout(tOut); tip.remove(); tray.remove(); };
  }, [on]);
}
function useGs1IconPill(on) {
  useEffect(() => {
    if (!on) return undefined;
    const nav = document.querySelector('.topbar.hdr-gs .gs-nav'); if (!nav) return undefined;
    const bl = document.createElement('span'); bl.className = 'gs1-iblob'; bl.setAttribute('aria-hidden', 'true'); nav.prepend(bl);
    let raf = 0, first = true;
    const put = () => { raf = 0; const b = nav.querySelector('.topnav-b.on'); if (!b) { bl.style.opacity = '0'; return; }
      const n = nav.getBoundingClientRect(), r = b.getBoundingClientRect();
      const x = r.left - n.left + r.width / 2 - 23, y = r.top - n.top + 4;
      if (first) { bl.style.transition = 'none'; first = false; requestAnimationFrame(() => { bl.style.transition = ''; }); }
      bl.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`; bl.style.opacity = '1'; };
    const go = () => { if (!raf) raf = requestAnimationFrame(put); };
    go(); const mo = new MutationObserver((ms) => { if (ms.some((m) => m.target !== bl)) go(); });
    mo.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    const ro = new ResizeObserver(() => { first = true; go(); }); ro.observe(nav);
    return () => { mo.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); bl.remove(); };
  }, [on]);
}
function useGs1Lbl(mode) {
  useEffect(() => {
    if (!mode) return undefined;
    const nav = document.querySelector('.topbar.hdr-gs .gs-nav'); if (!nav) return undefined;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0, out = 0, cur = null;
    // tık koruması: adlar açılırken düğmeler yer değiştirir → açılmadan hemen önce farenin altındaki düğme hatırlanır;
    // açılmadan sonraki 700 ms içinde başka düğmeye tıklanırsa tık o hatırlanan düğmeye gider (yanındakine atlamasın)
    let gx = -1, gy = -1, gB = null, gT = 0, gSkip = false;
    const pm = (e) => { gx = e.clientX; gy = e.clientY; };
    let gAx = -1, gAy = -1;
    // 16.11.2026: tık yönlendirme SADECE fare kıpırdamadıysa (Yanında ad: Setler açılırken vazgeçip Markalar'a basınca Setler'e gidiyordu)
    const guardArm = () => { gAx = gx; gAy = gy; const el = gx < 0 ? null : document.elementFromPoint(gx, gy); gB = el?.closest?.('.topnav-b') || null; if (gB && !nav.contains(gB)) gB = null; gT = performance.now(); };
    const gClick = (e) => { if (gSkip || !gB || performance.now() - gT > 700 || Math.hypot(e.clientX - gAx, e.clientY - gAy) > 4) return; const b = e.target.closest?.('.topnav-b'); if (!b || b === gB || !nav.contains(b)) return;
      e.preventDefault(); e.stopPropagation(); const a = gB; gB = null; gSkip = true; try { a.click(); } finally { gSkip = false; } };
    nav.addEventListener('pointermove', pm, { passive: true }); nav.addEventListener('click', gClick, true);
    const guardOff = () => { nav.removeEventListener('pointermove', pm); nav.removeEventListener('click', gClick, true); };
    if (mode === 'island' || mode === 'expand') {
      const measure = () => nav.querySelectorAll('.topnav-b').forEach((b) => { const l = b.querySelector('.topnav-l'); if (l) { b.style.setProperty('--w', Math.ceil(Math.max(42, l.scrollWidth + 20)) + 'px'); b.style.setProperty('--lw', Math.ceil(l.scrollWidth + 1) + 'px'); } });
      measure(); document.fonts?.ready?.then(measure);
      let hold = false;
      // 16.11.2026 (2) uzayan menü HEP ortadan, iki yana eşit açılır (fare altını sabitleyen kaydırma 'hangi düğmeye göre açıldığına göre
      // taraf değişiyor' diye REDDEDİLDİ). Yanlış tık koruması: açılırken farenin altındaki düğme 'tutulur' (.xo-k, üstündeymiş gibi görünür,
      // düğmeler fareyi görmez .gs1-keep); fare 4 px oynayana kadar tık O düğmeye gider → altına kayan Kalıp bulucu'ya yanlışlıkla basılmaz.
      let kB = null, kx = 0, ky = 0;
      const keepOff = () => { if (!kB) return; kB.classList.remove('xo-k'); kB = null; nav.classList.remove('gs1-keep'); };
      const kMove = (e) => { if (kB && Math.hypot(e.clientX - kx, e.clientY - ky) > 4) keepOff(); };
      const kClick = (e) => { if (!kB) return; e.preventDefault(); e.stopPropagation(); const b = kB; keepOff(); b.click(); };
      nav.addEventListener('pointermove', kMove, { passive: true }); nav.addEventListener('click', kClick, true);
      const openAll = () => {
        if (mode !== 'expand') { nav.classList.add('xo-all'); guardArm(); return; }
        const el = gx < 0 ? null : document.elementFromPoint(gx, gy); const b = el?.closest?.('.topnav-b');
        if (b && nav.contains(b)) { kB = b; kx = gx; ky = gy; b.classList.add('xo-k'); nav.classList.add('gs1-keep'); }
        nav.classList.add('xo-all');
      };
      const closeAll = () => { keepOff(); nav.classList.remove('xo-all'); };
      const arm = () => { clearTimeout(t); if (hold) return; t = setTimeout(() => { if (!fits()) return; openAll(); }, mode === 'expand' ? 420 : 60); };
      // sığmıyorsa adlar açılmaz (dar ekranda soldaki 'Ana sayfa' logonun altına kayıyordu): gereken = şimdiki + kapalı adların genişliği
      const fits = () => gs1NavNeed(nav) <= nav.clientWidth - 2;
      const en = () => { clearTimeout(out); arm(); };
      // fare durmadan uzamaz (simgeye giderken yolda açılıp yerinden kaydırmasın); basınca bekleyen uzama iptal
      const mv = () => { if (!nav.classList.contains('xo-all')) arm(); };
      // kapalıyken bir düğmeye basınca: uzama iptal + fare menüden çıkana kadar bir daha uzamaz; seçili ad değişimi ANINDA olur
      // (eski seçilinin adı kapanırken yenisi açılıp menüyü iki yöne oynatıyordu)
      const pd = (e) => { clearTimeout(t); if (nav.classList.contains('xo-all') || !e.target.closest?.('.topnav-b')) return; hold = true; };
      const pl = () => { hold = false; };
      nav.addEventListener('pointerleave', pl);
      nav.addEventListener('pointermove', mv); nav.addEventListener('pointerdown', pd);
      // uzayan menü fare çıkınca hemen kapanmaz: ~1 sn açık kalır (geri gelirse hiç kapanmaz)
      const lv = () => { clearTimeout(t); out = setTimeout(() => { if (!document.querySelector('.hd-p')) { closeAll(); } else out = setTimeout(lv, 300); }, mode === 'expand' ? 1000 : 260); };
      nav.addEventListener('pointerenter', en); nav.addEventListener('pointerleave', lv);
      return () => { nav.removeEventListener('pointerenter', en); nav.removeEventListener('pointerleave', lv); nav.removeEventListener('pointermove', mv); nav.removeEventListener('pointerdown', pd); nav.removeEventListener('pointerleave', pl); guardOff(); clearTimeout(t); clearTimeout(out); keepOff(); nav.removeEventListener('pointermove', kMove); nav.removeEventListener('click', kClick, true); nav.classList.remove('xo-all'); };
    }
    if (mode === 'line' || mode === 'spot') {
      // line: altta ince çizgi fareyi izler, menüden çıkınca seçili sayfanın altına döner · spot: üzerindeki yazı dışında hepsi silikleşir
      const ln = mode === 'line' ? Object.assign(document.createElement('span'), { className: 'gs1-line' }) : null;
      if (ln) { ln.setAttribute('aria-hidden', 'true'); nav.prepend(ln); }
      // 16.11.2026 tırtıl kayması: önce gidilen yöndeki ucu uzanır (iki sayfayı birden kapsar), sonra arka uç yetişir — net, kaygan değil.
      let cur = null, anim = null;
      const put = (b, inst) => { if (!ln) return; if (!b) { ln.style.opacity = '0'; cur = null; return; } const n = nav.getBoundingClientRect(), r = b.getBoundingClientRect();
        const to = { x: r.left - n.left + 14, w: Math.max(0, r.width - 28) }; ln.style.opacity = '1';
        const set = (q) => { ln.style.transform = `translateX(${q.x}px)`; ln.style.width = q.w + 'px'; };
        const from = cur; cur = to; anim?.cancel(); anim = null;
        if (inst || !from || (Math.abs(from.x - to.x) < 1 && Math.abs(from.w - to.w) < 1) || !ln.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { set(to); return; }
        const L = Math.min(from.x, to.x), R = Math.max(from.x + from.w, to.x + to.w);
        set(to);
        anim = ln.animate([{ transform: `translateX(${from.x}px)`, width: from.w + 'px' }, { transform: `translateX(${L}px)`, width: (R - L) + 'px', offset: .5 }, { transform: `translateX(${to.x}px)`, width: to.w + 'px' }],
          { duration: 420, easing: 'cubic-bezier(.45,0,.2,1)' }); };
      const home = (inst) => put(nav.querySelector('.topnav-b.on'), inst);
      const t0 = setTimeout(() => home(true), 120); const ro = new ResizeObserver(() => home(true)); ro.observe(nav);
      // 16.11.2026: çizgi fareyi KOVALAMAZ ('sabun gibi kaygan') → mavi çizgi sadece seçili sayfanın altında; üstüne gelinen yazının altında yerinde silik gri çizgi belirir (CSS ::after). Tıklayınca mavi çizgi kısa ve net kayar.
      const ov = (e) => { const b = e.target.closest?.('.topnav-b'); if (!b || !nav.contains(b)) return; clearTimeout(out); if (mode === 'spot') { nav.classList.add('xo-any'); nav.querySelectorAll('.topnav-b.xo').forEach((x) => x !== b && x.classList.remove('xo')); b.classList.add('xo'); } };
      const lv = () => { clearTimeout(out); out = setTimeout(() => { if (document.querySelector('.hd-p')) { out = setTimeout(lv, 300); return; } nav.classList.remove('xo-any'); nav.querySelectorAll('.topnav-b.xo').forEach((x) => x.classList.remove('xo')); home(); }, 160); };
      const mo = new MutationObserver(() => { if (!nav.classList.contains('xo-any')) home(); }); mo.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
      nav.addEventListener('pointerover', ov); nav.addEventListener('pointerleave', lv);
      return () => { clearTimeout(t0); clearTimeout(out); ro.disconnect(); mo.disconnect(); nav.removeEventListener('pointerover', ov); nav.removeEventListener('pointerleave', lv); ln?.remove(); guardOff(); nav.classList.remove('xo-any'); nav.querySelectorAll('.topnav-b.xo').forEach((x) => x.classList.remove('xo')); };
    }
    let blob = null, at = null;
    const rectOf = (b) => { const n = nav.getBoundingClientRect(), r = b.getBoundingClientRect(); return { x: r.left - n.left, y: r.top - n.top, w: r.width, h: r.height }; };
    const place = (b, anim) => {
      if (!blob) return; if (!b) { if (blob.classList.contains('on')) blob.classList.remove('on'); at = null; return; }
      const R = rectOf(b); const to = { transform: `translate(${R.x}px, ${R.y}px)`, width: R.w + 'px', height: R.h + 'px' };
      if (anim && at && !still && blob.animate) {
        const A = at; const L = Math.min(A.x, R.x), W = Math.max(A.x + A.w, R.x + R.w) - L;
        blob.animate([{ transform: `translate(${A.x}px, ${A.y}px)`, width: A.w + 'px', height: A.h + 'px' },
          { transform: `translate(${L + (R.x < A.x ? 0 : W * 0.18)}px, ${R.y + 3}px)`, width: W * 0.82 + 'px', height: R.h - 6 + 'px', offset: 0.45 }, to], { duration: 460, easing: 'cubic-bezier(.45, 0, .2, 1)' });
      }
      Object.assign(blob.style, to); if (!blob.classList.contains('on')) blob.classList.add('on'); at = R;
    };
    const pill = mode === 'pill';
    // yanında ad: her adın gerçek genişliği ölçülür (açılış hızı her yazıda aynı)
    let roS = null;
    // yanında ad: tek bir cam hap (orijinal seçili hap görünümünde) fareyi izleyerek simgeden simgeye KAYAR; düğmeler açılırken genişlik
    // değiştiği için hap her karede hedefin o anki yerine yumuşakça yaklaşır (rAF) → atlama yok, düzgün süzülür
    let sb = null, sraf = 0, sx = null, sw = 0, calm = 0, mo2 = null;
    const sTarget = () => cur || nav.querySelector('.topnav-b.on');
    const sTick = () => { sraf = 0; const b = sTarget(); if (!b || !sb) return; const n = nav.getBoundingClientRect(), r = b.getBoundingClientRect();
      const tx = r.left - n.left, tw = r.width; if (sx == null) { sx = tx; sw = tw; } else { sx += (tx - sx) * 0.24; sw += (tw - sw) * 0.24; }
      sb.style.transform = `translate(${sx.toFixed(2)}px, ${(r.top - n.top).toFixed(1)}px)`; sb.style.width = sw.toFixed(2) + 'px'; sb.style.height = r.height + 'px';
      if (Math.abs(tx - sx) < 0.3 && Math.abs(tw - sw) < 0.3) { if (++calm > 40) { calm = 0; return; } } else calm = 0;
      sraf = requestAnimationFrame(sTick); };
    const sGo = () => { calm = 0; if (!sraf) sraf = requestAnimationFrame(sTick); };
    if (mode === 'side') { const ms = () => { nav.querySelectorAll('.topnav-b').forEach((b) => { const l = b.querySelector('.topnav-l'); if (l) b.style.setProperty('--lw', Math.ceil(l.scrollWidth + 1) + 'px'); }); sGo(); }; ms(); roS = new ResizeObserver(ms); roS.observe(nav); document.fonts?.ready?.then(ms);
      sb = document.createElement('span'); sb.className = 'gs1-sblob'; sb.setAttribute('aria-hidden', 'true'); nav.prepend(sb); setTimeout(sGo, 60);
      // hap yarıda kalmasın: menü içindeki her genişlik/sınıf değişiminde (ad açılıp kapanırken, sayfa değişince) izleme yeniden başlar
      nav.addEventListener('transitionrun', sGo); nav.addEventListener('transitionend', sGo);
      mo2 = new MutationObserver((ms) => { if (ms.some((m) => m.target !== sb)) sGo(); }); mo2.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] }); }
    if (mode === 'mercury' || pill) { blob = document.createElement('span'); blob.className = 'gs1-blob'; blob.setAttribute('aria-hidden', 'true'); nav.prepend(blob); }
    // dönen hap: fare yokken hap seçili sayfada durur (adı görünür); boyu ad değişince/ekran değişince yeniden ölçülür
    const homeB = () => nav.querySelector('.topnav-b.on');
    const set = (b) => { if (cur === b) return; cur?.classList.remove('xo'); const had = !!cur; cur = b; b?.classList.add('xo'); nav.classList.toggle('xo-any', !!b); if (sb) sGo();
      if (!blob) return; if (pill) place(b || homeB(), true); else place(b, had && !!b); };
    let ro = null;
    if (pill) { const h0 = () => { if (!cur) place(homeB(), false); }; setTimeout(h0, 120); ro = new ResizeObserver(h0); ro.observe(nav);
      // NOT: classList.add aynı sınıf olsa da özelliği yeniden yazar → gözlemci kendi değişikliğini görüp sonsuz döngüye giriyordu; damlanın kendi değişiklikleri yok sayılır
      mo2 = new MutationObserver((ms) => { if (!cur && ms.some((m) => m.target !== blob)) place(homeB(), true); }); mo2.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] }); }
    let pend = null;
    const fire = (b) => { pend = null; guardArm(); set(b); };
    const over = (e) => { const b = e.target.closest?.('.topnav-b'); if (!b || !nav.contains(b)) return; clearTimeout(out); clearTimeout(t); if (b === cur) { pend = null; return; } pend = b; t = setTimeout(() => fire(b), mode === 'side' ? 240 : cur ? 40 : 90); };
    // yanında ad: ilk açılış fare durunca (simgeye giderken yolda büyümesin); basınca bekleyen açılış iptal
    const smv = () => { if (mode !== 'side' || !pend || pend === cur) return; // biri açıkken yandakine de aynı bekleme (fare kayınca hemen açılmasın)
      const b = pend; clearTimeout(t); t = setTimeout(() => fire(b), 240); };
    const spd = () => { if (pend) { clearTimeout(t); pend = null; } };
    nav.addEventListener('pointermove', smv); nav.addEventListener('pointerdown', spd);
    const leave = () => { clearTimeout(t); pend = null; out = setTimeout(() => { if (!document.querySelector('.hd-p')) set(null); else out = setTimeout(leave, 300); }, 220); };
    nav.addEventListener('pointerover', over); nav.addEventListener('pointerleave', leave);
    return () => { nav.removeEventListener('pointerover', over); nav.removeEventListener('pointerleave', leave); nav.removeEventListener('pointermove', smv); nav.removeEventListener('pointerdown', spd); guardOff(); clearTimeout(t); clearTimeout(out); ro?.disconnect(); mo2?.disconnect(); roS?.disconnect(); cancelAnimationFrame(sraf); nav.removeEventListener('transitionrun', sGo); nav.removeEventListener('transitionend', sGo); sb?.remove(); cur?.classList.remove('xo'); cur = null; nav.classList.remove('xo-any'); blob?.remove(); };
  }, [mode]);
}
// 15.11.2026 Tek satır üst menü fare efektleri: 'slide' = menü yazılarının arkasında fareyi izleyen yumuşak kutu; 'dock' = fareye yakın hap hafifçe büyür
function useGs1Hover(mode) {
  useEffect(() => {
    if (!mode || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nav = document.querySelector('.topbar.hdr-gs .gs-nav'); if (!nav) return;
    if (mode === 'slide') {
      const box = document.createElement('span'); box.className = 'gs1-hbox'; box.setAttribute('aria-hidden', 'true'); nav.prepend(box);
      let shown = false;
      const over = (e) => { const b = e.target.closest?.('.topnav-b'); if (!b || !nav.contains(b)) return; const n = nav.getBoundingClientRect(), r = b.getBoundingClientRect();
        if (!shown) { box.style.transition = 'none'; requestAnimationFrame(() => { box.style.transition = ''; }); }
        box.style.transform = `translate(${r.left - n.left}px, ${r.top - n.top}px)`; box.style.width = r.width + 'px'; box.style.height = r.height + 'px'; box.classList.add('on'); shown = true; };
      const out = () => { box.classList.remove('on'); shown = false; };
      nav.addEventListener('pointerover', over); nav.addEventListener('pointerleave', out);
      return () => { nav.removeEventListener('pointerover', over); nav.removeEventListener('pointerleave', out); box.remove(); };
    }
    // dock: macOS dock gibi ama sakin — hap en çok %10 büyür, yay yok (sadece yumuşak takip)
    const bs = () => [...nav.querySelectorAll('.topnav-b')];
    let mx = null, raf = 0; const cur = new Map();
    const tick = () => { raf = 0; let more = false;
      bs().forEach((b) => { const r = b.getBoundingClientRect(); const d = mx == null ? 999 : Math.abs(mx - (r.left + r.width / 2));
        const want = 1 + 0.1 * Math.max(0, 1 - d / 160); const v = cur.get(b) ?? 1; const nv = v + (want - v) * 0.22;
        if (Math.abs(nv - want) > 0.002) more = true; cur.set(b, nv); b.style.transform = nv > 1.001 ? `scale(${nv.toFixed(3)})` : ''; });
      if (more) raf = requestAnimationFrame(tick); };
    const mv = (e) => { mx = e.clientX; if (!raf) raf = requestAnimationFrame(tick); };
    const lv = () => { mx = null; if (!raf) raf = requestAnimationFrame(tick); };
    nav.addEventListener('pointermove', mv); nav.addEventListener('pointerleave', lv);
    return () => { nav.removeEventListener('pointermove', mv); nav.removeEventListener('pointerleave', lv); cancelAnimationFrame(raf); bs().forEach((b) => { b.style.transform = ''; }); };
  }, [mode]);
}
// 16.11.2026 Tek satır Ada titremesi: kaybolan parçalar (marka adı, ses/gece düğmesi, sepet/giriş yazısı) 'max-width 220/60/140 → 0' ile
// küçülüyordu; gerçek genişlikleri daha küçük olduğu için yarı yolda birden başlıyor, farklı hızdaki parçalarla birlikte arama/sepet
// 5-10 px ileri-geri oynuyordu (ölçüldü). Artık her parçanın GERÇEK genişliği ölçülüp (--gs1-mw) oradan 0'a, hepsi aynı hız/eğriyle iner.
const GS1_FIT = '.gs-brand b, .gs-icons > :is(.sfx-wrap, [data-theme-btn], .nc), .gs-icons :is(.hcart-t, .me-t, .me-login-l)';
const gs1Fit = new WeakMap();
function gs1IslFit(goingIn) {
  const r = document.documentElement; if (!r.classList.contains('gs-one')) return;
  const h = document.querySelector('.topbar.hdr-gs'); if (!h) return;
  // 16.11.2026: sağdaki parçaların (sepet + hesap/avatar) adadaki genişliği bir anlığına geçişsiz ölçülür → ada genişliği ona göre
  // (üye girişinde avatar sabit 104 px'e sığmıyor, adanın dışına taşıyordu). Ölçüm aynı karede geri alınır, ekrana çizilmez.
  if (goingIn) {
    const ic = h.querySelector('.gs-icons');
    if (ic) { r.classList.add('gs1-meas', 'isl'); const w = ic.getBoundingClientRect().width; r.classList.remove('isl'); void r.offsetWidth; r.classList.remove('gs1-meas'); void r.offsetWidth;
      if (w > 0) r.style.setProperty('--gs1-iw', Math.ceil(w) + 'px'); }
  }
  h.querySelectorAll(GS1_FIT).forEach((e) => {
    let w = e.getBoundingClientRect().width;
    if (goingIn) gs1Fit.set(e, w); else w = Math.max(gs1Fit.get(e) || 0, e.scrollWidth);
    if (w > 0) e.style.setProperty('--gs1-mw', Math.ceil(w) + 'px');
  });
}
function useIsland(on, tab, topOnly) {
  useEffect(() => {
    const r = document.documentElement; r.classList.remove('isl');
    if (!on) return;
    let last = 0, up = 0, dn = 0, raf = 0, mvT = 0; const vs = [];
    // ada geçişi sırasında html.isl-mv: arama kutusu SADECE bu sırada adanın hızıyla (0,7 sn) değişir; odakta büyümesi kendi hızında (0,42 sn)
    const mv = () => { gs1IslFit(!r.classList.contains('isl')); r.classList.add('isl-mv'); void r.offsetWidth; clearTimeout(mvT); mvT = setTimeout(() => r.classList.remove('isl-mv'), 650); };
    const r0 = requestAnimationFrame(() => { last = scrollY; });
    const busy = () => document.querySelector('.hd-p, .ctx-catch, .nc-panel, .sheet-bg') || r.classList.contains('dz-in-frame');
    const f = () => {
      raf = 0; const y = scrollY; const d = y - last; last = y;
      const isl = r.classList.contains('isl');
      if (y < 40) { up = 0; if (isl) { mv(); r.classList.remove('isl'); } return; }
      if (busy() || r.querySelector('.gs-srch .hsearch-box:focus-within')) return; // açık menü / aramaya yazarken şekil değişmez
      if (d < 0) { up += d; dn = 0; } else if (d > 0) { up = 0; dn += d; }
      // 16.11.2026: tek satırda Ada SADECE HIZLI ve UZUN aşağı kaydırmada: son 0,4 sn içinde aralıksız en az 700 px aşağı (≈ 7+ tekerlek
      // tıkı arka arkaya ya da sert trackpad savurması) ve 300 px'ten aşağıda. Tek tekerlek tıkı kısa bir anda çok hızlı kaydığı için
      // anlık hız ölçüsü (1,8 px/ms) 'çok çok kolay' bulundu; mesafe eşikleri de (260/420/700 px) öyle.
      const one = r.classList.contains('gs-one');
      const now = performance.now(); if (d < 0) vs.length = 0; vs.push([now, y]); while (vs.length > 2 && now - vs[0][0] > 400) vs.shift();
      const fast = vs.length > 1 && y - vs[0][1] > 700;
      if (!isl && y > (one ? 300 : 90) && d > 0 && (!one || fast)) { const tb = document.querySelector('.shell.public .topbar'); if (tb && r.classList.contains('isl-any')) r.style.setProperty('--isl-h', tb.offsetHeight + 'px'); mv(); r.classList.add('isl'); }
      else if (isl && !topOnly && up < -70) { mv(); r.classList.remove('isl'); up = 0; }
    };
    const q = () => { if (!raf) raf = requestAnimationFrame(f); };
    addEventListener('scroll', q, { passive: true });
    return () => { removeEventListener('scroll', q); cancelAnimationFrame(raf); cancelAnimationFrame(r0); clearTimeout(mvT); r.classList.remove('isl', 'isl-mv'); };
  }, [on, tab, topOnly]);
}
function useHideTop(on, upShow, tab, layer) {
  useEffect(() => {
    const r = document.documentElement; const ok = on && HIDE_TABS.has(tab) && !(tab === 'urun' && layer);
    if (!ok) { r.classList.remove('top-hide'); return; }
    // 5.11.2026 (3) headroom yöntemi: menü SADECE kullanıcının kaydırmasına tepki verir (tekerlek, parmak, klavye, kaydırma çubuğu).
    // Sayfa geçişinde site kaldığın yere kendisi kaydırınca (geri dönüş) menü gizlenmez; her sayfa geçişinde menü görünür gelir.
    r.classList.remove('top-hide');
    // 6.11.2026 (7): scrollY burada OKUNMAZ — sekme değişince bu etki hemen çalışıyor ve scrollY yeni sayfanın tüm yerleşimini
    // zorla hesaplatıyordu (telefonda geçişin başında ~40-50 ms takılma, ekran kaydıyla bulundu). İlk değer bir sonraki karede alınır.
    let last = 0, acc = 0, raf = 0, userAt = 0; const born = Date.now(); const r0 = requestAnimationFrame(() => { last = scrollY; });
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
    return () => { EV.forEach((e) => removeEventListener(e, user, { capture: true })); removeEventListener('scroll', q); cancelAnimationFrame(raf); cancelAnimationFrame(r0); r.classList.remove('top-hide'); };
  }, [on, upShow, tab, layer]);
}
// 5.11.2026 'akan hap' (kullanıcı: bir şeye tıklayınca seçili hap eskisinden yenisine akıyormuş gibi gitsin): tek seçimli düğme
// gruplarında (üst menü sekmeleri, seçim çubukları, alt sayfa çubukları, Siparişlerim sekmeleri, görünüm seçici) seçim değişince
// eski seçilinin yerinden yenisine, yolun ortasında uzayarak kayan bir hap çizilir; yeni düğmenin kendi zemini o sırada gizlenir.
// Hap grubun İÇİNE (yazıların altına) konur. Sadece transform/opacity değil ama tek küçük kutu → telefonda da hafif.
// hap hareketi (look.pill / pillM telefonda): 'flow' akan (varsayılan) · 'mercury' cıva · 'none' yok
const pillMode = () => { const L = store.s.settings?.look || {}; return lookFor(L, matchMedia('(max-width: 899px)').matches).pill || 'flow'; };
// CSS cubic-bezier eğrisi (JS ile canlı izlenen hap için, WAAPI'deki eğrinin aynısı)
function cubicBz(x1, y1, x2, y2) {
  const f = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  return (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (f(t, x1, x2) < x) lo = t; else hi = t; } return f(t, y1, y2); };
}
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
      // 16.11.2026 tek satır menü: seçilen düğmenin adı geçiş sırasında açılıyor → hap SABİT bir hedefe değil, düğmenin o anki yerine/boyuna
      // zamanla yaklaşır (eskiden simge boyunda küçük hapla gidip sonra 'yerine oturuyordu'). Tek hareket, sonunda düğmenin tam üstünde.
      // Sadece 'Uzayan menü' / 'Sadece seçilinin adı'nda ve arama açıkken (gs1-ss: simgeye basınca yazılar geri açılıyor); süre ve eğri diğer menülerdeki hapın AYNISI (440 ms, cubic-bezier(.3,.7,.25,1)).
      if (g.classList.contains('gs-nav') && (document.documentElement.classList.contains('gs1-lb-expand') || document.documentElement.classList.contains('gs1-ss'))) {
        const done2 = () => { gh.remove(); g.classList.remove('flow-g'); btn.classList.remove('flow-on'); };
        const t0 = performance.now(), D = 440; const bz = cubicBz(0.3, 0.7, 0.25, 1);
        const step = () => {
          if (!gh.isConnected) return; const k = Math.min(1, (performance.now() - t0) / D); const e = bz(k);
          const q = g.getBoundingClientRect(), r = btn.getBoundingClientRect();
          const X = r.left - q.left + g.scrollLeft, Y = r.top - q.top + g.scrollTop;
          gh.style.transform = `translate(${(A.x + (X - A.x) * e).toFixed(2)}px, ${(A.y + (Y - A.y) * e).toFixed(2)}px)`;
          gh.style.width = (A.w + (r.width - A.w) * e).toFixed(2) + 'px'; gh.style.height = (A.h + (r.height - A.h) * e).toFixed(2) + 'px';
          if (k < 1) requestAnimationFrame(step); else done2();
        };
        step(); return;
      }
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
  // 6.11.2026 (5): uzun süre arka planda kalınca iPhone ekran ölçülerini bozuk getirebiliyor (alt/üst menü kayık) →
  // 2 dakikadan uzun ayrı kalındıysa dönüşte sayfa sessizce yenilenir (aynı adres; giriş, sepet ve açılış ekranı korunur).
  // Yenilenmez: açık pencere varken, kaydedilmeyi bekleyen iş varken, yazılmış bir alan duruyorken ya da tasarım modunda.
  const AWAY_MS = 2 * 60 * 1000; let hiddenAt = 0;
  const typed = new Set();
  document.addEventListener('input', (e) => { const t = e.target; if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !/^(search|checkbox|radio|range|button|submit|file|color)$/i.test(t.type)))) typed.add(t); }, true);
  const safeReload = () => {
    if (!matchMedia('(pointer: coarse)').matches) return false;
    if (savesPending()) return false;
    if (store.s.tab === 'tasarim') return false;
    if (document.querySelector('[aria-modal="true"], .sheet-bg')) return false;
    for (const el of typed) { if (!el.isConnected) { typed.delete(el); continue; } if (String(el.value ?? el.textContent ?? '').trim()) return false; }
    return true;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); const a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) a.blur(); }
    else {
      if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && safeReload()) { hiddenAt = 0; location.reload(); return; }
      hiddenAt = 0; fix();
    }
  });
  addEventListener('pageshow', (e) => { if (e.persisted) fix(); });
  // 6.11.2026 (2): aynı bozulma klavye kapanınca da oluyordu (sepette yazı alanından çıkınca alt menü ortada, sayfa boş) →
  // yazı alanından çıkınca ve klavye kapanınca (görünür alan birden uzayınca) ekran yeniden ölçülür
  const isField = (el) => !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/i.test(el.type))); // sadece klavye açan alanlar (onay kutusu / anahtar odakta kalınca düzeltme duruyordu)
  document.addEventListener('focusout', (e) => { if (!isField(e.target)) return; setTimeout(() => { if (!isField(document.activeElement)) fix(); }, 120); });
  const vv = window.visualViewport;
  if (vv) { let h0 = vv.height; vv.addEventListener('resize', () => { const h = vv.height; if (h - h0 > 120 && !isField(document.activeElement)) setTimeout(fix, 60); h0 = h; }); }
  // 6.11.2026 (3): iPhone bazen (birkaç sayfa geçişi / uygulamadan çıkıp dönme sonrası) alt menüyü ekrana sabit tutmayı bırakıyor:
  // menü sayfayla birlikte kayıyor ya da ortada kalıyor. Kaydırırken menünün gerçek yeri ölçülür; görünen ekranın altında
  // değilse aradaki fark kadar itilir (--vvd) ve ekran yeniden ölçtürülür. Yazı alanı açıkken (klavye) dokunulmaz.
  if (vv && matchMedia('(pointer: coarse)').matches) {
    const r = document.documentElement; let cur = 0, q = 0, lastFix = 0;
    // 6.11.2026 (7): 'en büyük sağlıklı yükseklik' hatırlama yöntemi KALDIRILDI — iPhone bir an durum çubuğu dahil uzun ölçü
    // bildirince o değer kalıcı kaydoluyor, menü ekranın altından taşıyordu. Artık: menü sadece AŞAĞI itilir (görünen alan kısa
    // bildirildiğinde yukarı, ekranın ortasına itilmez); uzun aradan dönüşte sayfa zaten yenilenir (yukarıda).
    try { localStorage.removeItem('vv-good'); } catch {}
    // 12.11.2026: bozulunca iPhone görünen alanı da (vv.height) kısa bildiriyor (klavye açıkmış gibi; ekranın ~%57'si) → ölçecek doğru
    // değer kalmıyor, menü ortada kalıyordu. Açılışta (uygulama yeni açılınca ölçü hep doğru) birkaç kez ölçülüp EN KÜÇÜĞÜ 'sağlıklı
    // yükseklik' sayılır: sadece bellekte (kalıcı kayıt yok → 6.11'deki 'uzun ölçü kaydoldu' hatası olmaz), ekran dönünce yeniden
    // ölçülür, ekran boyuna göre mantıksızsa kullanılmaz. Yazı alanı açık değilken görünen alan bundan kısaysa bu değer esas alınır.
    const port = () => (screen.orientation?.type ? !/landscape/.test(screen.orientation.type) : Math.abs(window.orientation || 0) !== 90);
    let good = 0, goodPort = port(), samp = [];
    const learn = () => {
      good = 0; samp = []; goodPort = port();
      const take = (last) => {
        if (document.visibilityState === 'visible' && !isField(document.activeElement) && port() === goodPort) samp.push(vv.height);
        if (!last || samp.length < 2) return;
        const m = Math.min(...samp); const full = goodPort ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width);
        if (m <= full + 1 && m >= full * 0.7) good = m;
      };
      setTimeout(take, 500); setTimeout(take, 1400); setTimeout(() => take(true), 2600);
    };
    learn(); addEventListener('orientationchange', learn); screen.orientation?.addEventListener?.('change', learn);
    const visBottom = () => (good && port() === goodPort ? Math.max(vv.height, good) : vv.height);
    const upd = () => {
      q = 0; const nav = document.querySelector('.botnav'); if (!nav || isField(document.activeElement)) { if (cur) { cur = 0; r.style.removeProperty('--vvd'); } return; }
      const cs = getComputedStyle(nav); if (cs.position !== 'fixed' || cs.display === 'none') return;
      // sayfanın başında / sonunda esneme (lastik) sırasında ölçülmez: menüyü sayfanın altına itiyordu (6.11.2026)
      const maxY = (document.scrollingElement || r).scrollHeight - innerHeight;
      if (scrollY < 0 || scrollY > maxY + 1) return;
      const want = visBottom() - (parseFloat(cs.bottom) || 0); // menünün altı burada olmalı
      const rb = nav.getBoundingClientRect().bottom - cur; // itme olmadan menünün altı
      let d = Math.round(want - rb); if (d < 24) d = 0; // sadece aşağı (yukarı itmek menüyü ortaya taşıyordu) // küçük farklar (esneme, adres çubuğu) yok sayılır
      if (d !== cur) { cur = d; d ? r.style.setProperty('--vvd', d + 'px') : r.style.removeProperty('--vvd'); }
      // 12.11.2026: ekranı yeniden ölçtürme (fix: kaydırma konumunu oynatır) kullanıcı KAYDIRIRKEN yapılmaz — kaydırmayı bozup takılma yapıyordu;
      // kaydırma durunca yapılır. İtme (--vvd) beklemeden uygulanır.
      if (d && Date.now() - lastFix > 1500) { if (Date.now() - lastScr < 600) { clearTimeout(fixT); fixT = setTimeout(req, 650); } else { lastFix = Date.now(); fix(); } }
    };
    let lastScr = 0, fixT = 0; addEventListener('scroll', () => { lastScr = Date.now(); }, { passive: true });
    const req = () => { if (!q) q = requestAnimationFrame(upd); };
    vv.addEventListener('resize', req); vv.addEventListener('scroll', req); addEventListener('resize', req); addEventListener('scroll', req, { passive: true }); addEventListener('pageshow', req);
    document.addEventListener('focusout', () => setTimeout(req, 150)); document.addEventListener('visibilitychange', () => setTimeout(req, 300));
    setInterval(() => { if (document.visibilityState === 'visible') req(); }, 600); addEventListener('touchstart', req, { passive: true });
  }
}

function setupNavAnim() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('animate' in Element.prototype)) return;
  // 6.11.2026: sayfa geçişini SADECE bu yapar → eski CSS 'rise' (aşağıdan yükselme, satır satır gecikmeli) her yerde kapalı
  // (html.nav-anim). Önceden telefonda mağazada kapalıydı ama bilgisayarda ve yönetimde ikisi birden oynuyordu: yandan kayma +
  // alttan yükselme → 'anlaşılmayan / alttan çıkan' geçiş.
  document.documentElement.classList.add('nav-anim');
  const FIX = '.cart-bar, .cs-fixed, .co-fixed, .gbar, .cart-fab, .save-bar, .dz-mbar, .acct-ph';
  const SELF = '.acct-side'; // kendisi kayar, üst kutusu kaymaz (pageTargets); yer tutucusu .acct-ph hiç kaymaz (FIX) — menünün yeri ondan ölçülür
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
    // 12.11.2026 (iPhone ~70 ms takılma): gizli Ana sayfa / Ürünler gösterilince iPhone'un stil + yerleşimi baştan hesaplaması geçişin
    // başında donma yapıyordu. Alt menü düğmesine parmak DEĞDİĞİ an (bırakmadan ~100 ms önce) hedef sayfa gizliyken hesaplatılır
    // (content-visibility açılır, sayfa hâlâ 0 yükseklikte ve görünmez) → bırakınca sayfa hazır, kayma ilk kareden akıcı.
    const bt = t.closest('.botnav-b[data-tab]'); const tk = bt?.dataset.tab;
    if (tk) { const sec = document.querySelector(`.shell > .main > section[data-kp="${tk}"].kp-off`); if (sec) { sec.setAttribute('data-warm', ''); clearTimeout(sec.__warmT); sec.__warmT = setTimeout(() => sec.removeAttribute('data-warm'), 1500); } }
  }, { capture: true, passive: true });
  // sayfa içi geçişler (sepet → ödeme, sipariş detayı, adımlar…): adres değişmese de tıklanan düğme kaybolup yerine büyük bir bölüm gelirse
  addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null; if (!t || !t.closest('.shell > .main')) return;
    const btn = t.closest('button, a, [role="button"]') || t;
    click = { el: btn, at: Date.now(), back: !!t.closest('.back-btn, .oa-back') }; // .oa-back: sipariş / linkle gelen sipariş geri düğmesi (31.10.2026: dönüş sağdan geliyordu)
  }, { capture: true, passive: true });
  // 7.11.2026: sayfa içi 'geri' (Ürünler listesi → açılış sayfası; alt menüden de) — sıradaki sayfa içi geçiş soldan kayar
  window.__navBackNext = () => { click = { el: document.createElement('i'), at: Date.now(), back: true }; };
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
    desk: { dx: () => Math.round(Math.min(120, innerWidth * 0.08)), ms: 1, // 6.11.2026: bilgisayarda daha kısa kayma (geniş ekranda 200px fazla savruluyordu)
      ease: 'cubic-bezier(.32,.72,0,1)', cv: 0.75 }, // bilgisayar: telefondaki gibi yönlü yandan kayma (ekranın ~%13'ü)
    dfade: { dx: 0, ms: 0.7, ease: EASE },
  };
  // 12.11.2026: art arda hızlı geçişte (alt menüye peş peşe basma) önceki geçiş bitmeden yenisi başlıyordu: eski kaymalar sürüyor,
  // örtü yarım kaldığı yerden TAM opaklığa sıçrıyordu → ekran bir kare eski sayfa, bir kare bembeyaz 'yanıp sönüyordu'.
  // Artık yarım kalan geçiş durdurulur, örtü o anki saydamlığından devam eder (yukarı sıçramaz).
  let live = [], coverA = null, coverKf = null;
  const coverNow = () => { // çalışan örtü animasyonunun şu anki saydamlığı (getComputedStyle yok: ağır sayfada stil hesabını zorlamasın)
    if (!coverA || !coverKf || coverA.playState === 'finished' || coverA.playState === 'idle') return null;
    const p = coverA.effect?.getComputedTiming?.().progress; if (p == null) return null;
    const n = coverKf.length - 1; let a = coverKf[0], b = coverKf[n];
    for (let i = 0; i < n; i++) { const o0 = coverKf[i].offset ?? i / n, o1 = coverKf[i + 1].offset ?? (i + 1) / n; if (p <= o1) { a = { ...coverKf[i], offset: o0 }; b = { ...coverKf[i + 1], offset: o1 }; break; } }
    const f = b.offset > a.offset ? (p - a.offset) / (b.offset - a.offset) : 1; return a.opacity + (b.opacity - a.opacity) * Math.min(1, Math.max(0, f));
  };
  // 12.11.2026 (kullanıcı videosu, 60 kare/sn): geçiş bitince sayfa ayrı katmandan normal çizime dönerken farklı piksel yuvarlamasıyla
  // ~1 px yukarı 'oturuyordu'. Bitince katman korunur (will-change), kullanıcının bir sonraki dokunuşu / kaydırması / geçişinde
  // bırakılır → o milimlik fark hareketin içinde kalır, durağan ekranda görünmez.
  let lingering = [], lingerOff = null;
  const unlinger = () => { for (const el of lingering) { try { el.style.willChange = ''; } catch {} } lingering = []; if (lingerOff) { removeEventListener('scroll', lingerOff, true); lingerOff = null; } };
  const linger = (el) => {
    if (!el.isConnected || el.querySelector('.pv2-top')) return; // ekrana sabitli öğe içeren bölüm: katman onu yerinden oynatır
    el.style.willChange = 'transform'; lingering.push(el);
    // 12.11.2026 (gece): DOKUNUŞTA bırakmak, alt menüye basınca sayfanın (setler, markalar) bir an milim oynamasına yol açtı →
    // sadece sayfa GERÇEKTEN kaydırılınca bırakılır (fark hareketin içinde kalır); başka sayfaya geçişte play() bırakır (sayfa zaten gizlenir)
    if (lingering.length === 1 && !lingerOff) { let y0 = scrollY; lingerOff = () => { if (live.some((x) => x.playState === 'running' || x.playState === 'paused')) { y0 = scrollY; return; } /* geçiş sürerken (kaldığı yere geri kaydırma) sayılmaz */ if (Math.abs(scrollY - y0) >= 3) unlinger(); }; addEventListener('scroll', lingerOff, { capture: true, passive: true }); }
  };
  // 16.11.2026 (4 ekran kaydı, 60 kare/sn): alt menüden Ürünler'e (liste + açılış) geçişte iPhone, uzun ve resimli sayfayı TEK PARÇA
  // yana kaydırmaya başladığı an 2-3 kare ekranı güncelleyemiyor → sayfa yarı yolda donup 20-30 px sıçrıyordu ('tık'). Bekletme /
  // gecikmeli başlatma işe yaramadı (geri alındı); kaymasız belirme sorunu çözdü ama animasyon gitti. Şimdi: sayfa yine kayar ama
  // sadece EKRANDA GÖRÜNEN küçük parçalar (başlık, filtreler, ekrandaki kartlar) ayrı ayrı kayar; ekran dışındaki binlerce px'lik
  // liste kaydırılmaz (görünmüyor zaten) → telefonun hazırlaması gereken alan küçük. look.navSlideP: '' = bu | 'fade' = kaymasız | 'on' = eski.
  const noSlide = () => { if (!mob() || store.s.tab !== 'katalog') return ''; const v = store.s.settings?.look?.navSlideP || ''; return v === 'on' ? '' : v === 'fade' ? 'fade' : 'light'; };
  const lightTargets = (main) => {
    const H = innerHeight, out = [];
    // dönüşte kaydırma yeri (store.js go → __navY) bir kare SONRA verilir → ölçüm o yere göre yapılır
    const ny = window.__navY; const off = ny && Date.now() - ny.t < 400 ? ny.y - scrollY : 0;
    const dig = (el, d) => {
      const b = el.getBoundingClientRect(); const r = { top: b.top - off, bottom: b.bottom - off, height: b.height };
      if (r.bottom <= 0 || r.top >= H || !r.height) return; // ekran dışı: kaymaz
      if (d < 9 && r.height > H * 1.2 && el.children.length && !el.matches(SELF)) { for (const c of el.children) if (!c.matches(FIX) && !c.classList.contains('win-gap')) dig(c, d + 1); return; }
      out.push(el);
    };
    for (const t of pageTargets(main)) dig(t, 0);
    return out;
  };
  const play = (els, kind, ms0, dk = 1, c0 = 1) => { // c0: örtünün başlangıç saydamlığı (1 = tam)
    unlinger();
    const busy = live.some((a) => a.playState === 'running' || a.playState === 'paused');
    const cur = busy ? coverNow() : null;
    for (const a of live) { try { a.cancel(); } catch {} } live = [];
    const as = []; const LK0 = store.s.settings?.look || {};
    const M = mob() ? (MOT[LK0.motion] || MOT.clear) : LK0.motionD === 'fade' ? MOT.dfade : MOT.desk; const ms = Math.round(ms0 * M.ms);
    const dx = Math.round((typeof M.dx === 'function' ? M.dx() : M.dx) * dk);
    if (kind !== 'tab') { const kf = [{ transform: `translate3d(${kind === 'back' ? -dx : dx}px,0,0)` }, { transform: 'translate3d(0,0,0)' }]; for (const el of els) { linger(el); const an = el.animate(kf, { duration: ms, easing: M.ease, id: 'nav' }); as.push(an); } } // katman animasyon BAŞLARKEN alınır: bitiş anında (bitti haberi bir kare geç gelebiliyor) katman değişmez → 1 px oturma olmaz
    const cv = getCover(); cv.classList.toggle('glass', !!M.glass);
    const top = (v) => (cur == null ? v : Math.min(v, cur)); // yarım kalan geçişten devam: örtü yukarı sıçramaz
    const k0 = top(kind === 'tab' ? 0.65 : c0);
    coverKf = M.glass ? [{ opacity: top(kind === 'tab' ? 0.8 : c0) }, { opacity: top(0.6), offset: 0.35 }, { opacity: 0 }]
      : M.cv && kind !== 'tab' ? [{ opacity: k0 }, { opacity: 0, offset: M.cv }, { opacity: 0 }] : [{ opacity: k0 }, { opacity: 0 }];
    as.push(coverA = cv.animate(coverKf, { duration: kind === 'tab' ? Math.min(ms, 220) : ms, easing: M.glass ? 'ease-out' : kind === 'tab' ? EASE : 'cubic-bezier(.2,.6,.3,1)' }));
    live = as;
    // 6.11.2026 (7): iPhone'da kayan sayfanın üstündeki cam menü, altındaki ürün resmini bulanık değil 'büyütülmüş' gösteriyordu
    // (WebKit: hareket eden katman üstünde backdrop-filter). Geçiş süresince menüler neredeyse opak (html.nav-mv), bitince eski cam.
    const R = document.documentElement; R.classList.add('nav-mv'); clearTimeout(R.__nmv); R.__nmv = setTimeout(() => R.classList.remove('nav-mv'), (kind === 'tab' ? Math.min(ms, 220) : ms) + 80);
    as.forEach((a) => a.pause());
    requestAnimationFrame(() => { as.forEach((a) => { try { a.play(); } catch {} }); hold(as); });
  };
  // 12.11.2026 (kullanıcı videosu, 60 kare/sn): Ana sayfaya geçerken telefon ağır banner'ları basarken 2 kare donuyor, animasyonun saati
  // işlemeye devam ettiği için sayfa sonra birden ileri SIÇRIYORDU ('takıla takıla geçiyor'). Geçişin ilk ~0,45 sn'sinde bir kare geç
  // gelirse (>28 ms) animasyonlar o kadar geri alınır: donma anında sıçrama olmaz, kaldığı yerden yumuşak devam eder.
  const hold = (as) => {
    let last = performance.now(); const t0 = last;
    const tick = () => {
      const now = performance.now(); const d = now - last; last = now;
      if (d > 28) { const back = d - 16.7; for (const a of as) { try { if (a.playState === 'running') a.currentTime = Math.max(0, (a.currentTime || 0) - back); } catch {} } }
      if (now - t0 < 450 && as.some((a) => a.playState === 'running')) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const pageTargets = (main) => {
    const layer = main.querySelector?.(':scope > .pp-layer'); if (layer) return [layer]; // ürün katmanı açılırken sadece o kayar
    const out = [];
    const walk = (el, d) => {
      for (const c of el.children) {
        if (c.classList.contains('kp-off')) continue;
        // sayfa kabuğuna (.page) ve sabit öğe taşıyabilen kutulara transform VERİLMEZ (sepet çubuğu vb. sonradan gelse bile yerinde kalsın) → çocuklarına inilir
        if (c.matches(FIX)) continue;
        // 7.11.2026 kendi başına sabit (fixed) olan ama sayfayla kayması gereken öğe (Hesabım sol menüsü): üst kutusuna transform
        // verilirse sabit menü o kutuya göre konumlanıp kayma bitince yerine SIÇRIYORDU → transform menünün kendisine verilir
        if (c.matches(SELF)) { out.push(c); continue; }
        // (getComputedStyle KULLANILMAZ: ağır sayfa açılırken stil hesabını erkenden zorlayıp iki kez yaptırıyordu)
        if (d < 6 && (c.classList.contains('page') || c.querySelector(FIX) || c.querySelector(SELF))) walk(c, d + 1); else out.push(c);
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
    if (!watched?.isConnected) { attach(); last = k; } // 12.11.2026: siteye doğrudan bir sayfa adresiyle girilince ilk geçiş animasyonsuz kalıyordu
    if (!on() || !watched?.isConnected) return;
    const h = Date.now() - hintAt < 800 ? hint : ''; hint = '';
    // 5.11.2026 alt menüyle sekme değişimi de yandan kayar: sağdaki sekmeye geçince sağdan, soldakine geçince soldan (iOS sekme hissi)
    const ti = navIdx();
    if (h === 'tab' && prev.split('|')[0] !== k.split('|')[0]) { const d = ti >= 0 && lastIdx >= 0 ? Math.sign(ti - lastIdx) : ti >= 0 ? (ti === 0 ? -1 : 1) : 0; /* 12.11.2026: alt menüde olmayan sayfadan (Markalar…) dönüşte de kayar: Ana sayfa soldan, diğerleri sağdan (eskiden animasyonsuzdu) */ lastIdx = ti; const ns = noSlide(); if (d && ns !== 'fade') play(ns ? lightTargets(watched) : pageTargets(watched), d < 0 ? 'back' : 'fwd', 365, 0.6); else play([], 'tab', 180); return; } // (12.11.2026 örtüyü %45'ten başlatma denendi, GERİ ALINDI: yeni sayfa ilk 1–5 karede henüz çizilmemiş (boş) geliyor, tam örtü bunu saklıyordu; yarı saydamda her geçiş pürüzlü göründü)
    lastIdx = ti;
    // 6.11.2026: bilgisayarda Hesabım içinde bölüm değişince (sol menü sabit) bütün sayfa kayıp örtü solmasın — ekran 'sekiyordu';
    // sadece sağdaki içerik kısa ve hafif kayarak belirir, sol menü yerinden oynamaz
    const pa = prev.split('|'), ka = k.split('|');
    if (!mob() && pa[0] === 'hesap' && ka[0] === 'hesap' && pa[1] !== ka[1] && pa.slice(2).join() === ka.slice(2).join()) {
      const m = watched.querySelector('.acct-main'); if (m) m.animate([{ opacity: 0, transform: `translate3d(${h === 'back' ? -14 : 14}px,0,0)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
      return;
    }
    // 6.11.2026 (6): bilgisayarda yönetim panelinde iç sekmeler (alt başlıklar, sayfa içi geçişler) yandan kaymasın — yorucu
    // bulundu; kısa, sakin bir belirme. Ana menü (yan menü) geçişi ve geri dönüş eskisi gibi kayar.
    if (!mob() && h !== 'back' && document.documentElement.classList.contains('adm-on')) {
      // başlık + alt sekmeler (SubNav) sabit kalır, sadece altındaki içerik belirir (kullanıcı: Ödeme linkine geçince alt başlıklar oynuyordu)
      for (const x of pageTargets(watched)) if (!x.matches('.page-h, .subnav, .prod-top')) x.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 170, easing: 'ease-out', id: 'nav' });
      return;
    }
    // 16.11.2026: ürün sayfasından (ve başka sayfalardan) Ürünler'e dönüşte de uzun liste tek parça kaymaz, sadece ekrandaki parçalar (alt menüdekiyle aynı çözüm)
    play(noSlide() === 'light' && !watched.querySelector(':scope > .pp-layer') ? lightTargets(watched) : pageTargets(watched), h === 'back' ? 'back' : 'fwd', 300);
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
    const els = []; for (const n of top) { if (n.classList.contains('page') || n.querySelector(FIX) || n.querySelector(SELF)) els.push(...pageTargets({ children: [n] })); else els.push(n); }
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
  const dragX = useRef(null); // sürükleyip bırakınca hapın parmaktaki yeri: geçiş oradan başlar (dokunuşta null → eski sekmeden başlar)
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
    // 6.11.2026: basit dokunuşta hap parmağa kaymaz (önce parmağa, sonra eski sekmeye, sonra yeni sekmeye gidiyordu → titreme); sadece sürüklerken parmağı izler
    const track = (cx, noPlace) => {
      const { geo: g } = live.current; if (!g) return;
      const r = el.getBoundingClientRect(); const lx = cx - r.left;
      const x = Math.min(g.cs[g.cs.length - 1], Math.max(g.cs[0], lx));
      let i = 0, best = 1e9; g.cs.forEach((c, n) => { const d = Math.abs(c - lx); if (d < best) { best = d; i = n; } });
      const s = st.current; if (!s) return;
      if (s.i !== i) { if (s.i != null) { s.moved = true; try { navigator.vibrate?.(6); } catch {} } s.i = i; setHov(i); }
      if (!noPlace) { s.dragged = true; s.x = x; place(x); }
    };
    const finish = (go_) => {
      const s = st.current; st.current = null;
      el.classList.remove('dragging', 'pressing'); setHov(-1);
      const to = s && s.i != null && go_ ? live.current.items[s.i][0] : null;
      if (to && to !== store.s.tab) { dragX.current = s.dragged ? s.x : null; navGo(to); return; } // hap bulunduğu yerden yeni sekmeye kayar
      dragX.current = null;
      if (to && to === store.s.tab && !s.moved) navGo(to); // aynı sekmeye dokunuş (telefonda tıklama gelmiyor): en üste / Ürünler'de açılış sayfasına
      if (pill.current) pill.current.style.transform = `translateX(${pill.current.dataset.x}px) translateX(-50%)`; // aynı sekme / vazgeçti: yerine döner
    };
    // iPhone'da ekranın altındaki çizgiden yukarı kaydırma (uygulamadan çıkma / uygulama değiştirici) menünün alt boşluğundan başlar:
    // oradan başlayan dokunuş sekme değiştirmez (31.10.2026: uygulama arka plana giderken Kalıp/Sepet sekmesine geçiyordu)
    const start = (e) => { const t = e.touches[0]; if (!t || e.touches.length > 1) return; const b = el.querySelector('.botnav-b')?.getBoundingClientRect(); if (b && t.clientY > b.bottom - 2) return; st.current = { i: null }; el.classList.add('pressing'); track(t.clientX, true); };
    const move = (e) => { if (!st.current) return; e.preventDefault(); el.classList.add('dragging'); const t = e.touches[0]; if (t) track(t.clientX); };
    const end = (e) => {
      if (!st.current) return;
      const t = e.changedTouches?.[0];
      // 6.11.2026 kullanıcı: parmak menünün üstüne (sayfaya) çıkmış olsa da bırakılan yerdeki sekmeye geçsin (eskiden 40 px yukarıda vazgeçiyordu)
      if (t) track(t.clientX, !st.current?.dragged);
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
    const a0 = prevPx.current; prevPx.current = px;
    const a = dragX.current != null ? dragX.current : a0; dragX.current = null;
    if (a0 == null || px == null || Math.abs(a - px) < 2) return;
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
        <button key={k} data-tab={k} className={'botnav-b' + (tab === k ? ' on' : '') + (hov === n ? ' hov' : '')} onClick={() => { if (tab !== k) sfx('tap'); navGo(k); }}>
          <span className="botnav-i"><Icon n={i} s={22} />{badge(k) > 0 && <span key={badge(k)} className="badge">{badge(k)}</span>}</span>
          <span>{sh || l}</span>
        </button>
      ))}
    </nav>
  );
}

// 12.11.2026: telefonda TARAYICIDA (Safari / Chrome; ana ekran uygulaması DEĞİL) alt menü adres çubuğuna yapışık dursun → html.in-brw
try { if (!(navigator.standalone === true || matchMedia('(display-mode: standalone)').matches) && matchMedia('(hover: none) and (pointer: coarse)').matches) document.documentElement.classList.add('in-brw'); } catch {}
