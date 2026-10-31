// FIREBASE veri katmanı (ücretsiz Spark planı ile çalışacak şekilde tasarlandı)
//  - Auth: kullanıcı adı + şifre (arka planda kullaniciadi@EMAIL_DOMAIN e-postasına çevrilir)
//  - Firestore: katalog 1500'lük parçalar halinde birkaç dokümanda tutulur → her açılışta ~2-3 okuma
//  - Resimler: küçültülüp Firestore'da (img/{id}) saklanır; Storage (ücretli plan) gerekmez
import { pingWatch } from './push.js';
import { EMAIL_DOMAIN } from './config.js';
import { now, ls, r2Base } from './utils.js';
import { chunkBySize } from './cats.js';
import { idbGet, idbSet } from './idb.js';
import { stencilKeys, packTags, DESC_BK, descBucket, descBuckets } from './kalip.js';
// eski localStorage önbelleklerini temizle (artık IndexedDB'de)
try { localStorage.removeItem('cat-cache'); localStorage.removeItem('pubcat-cache'); } catch {}

const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}/`;
// Bağlantı takılırsa sonsuza kadar beklemesin: belirli sürede cevap gelmezse hata verir (ekranda "Tekrar dene" çıkar)
// Firestore REST (düz HTTPS) yedeği: iPhone Safari'de Firestore'un canlı bağlantısı (WebChannel) bazen hiç cevap vermiyor →
// herkese açık belgeler (sipariş takip, mağaza ayarları, mağaza katalogu…) birkaç saniye sonra REST ile de istenir, hangisi önce gelirse.
function restVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, restVal(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(restVal);
  return null;
}
// sahte DocumentSnapshot: exists() / data() / id (getDoc ile aynı kullanım)
const fakeSnap = (id, data) => ({ id, exists: () => data != null, data: () => data || undefined });
const timeout = (p, ms = 20000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Sunucu cevap vermedi, bağlantınızı kontrol edip tekrar deneyin')), ms))]);
const toEmail = (u) => `${u.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

export class FirebaseBackend {
  mode = 'firebase';
  constructor(config, appName) { this.config = config; this.appName = appName; this.imgCache = new Map(); }

  async init() {
    // Firebase dosyaları önce kendi sitemizden (/fb/): telefon tarayıcılarının izleyici koruması gstatic.com'u geciktirebiliyor
    const load = (base) => Promise.all(['app', 'auth', 'firestore'].map((m) => import(/* @vite-ignore */ base + 'firebase-' + m + '.js')));
    let A, U, F;
    try { [A, U, F] = await timeout(load(location.origin + '/fb/'), 12000); } catch { [A, U, F] = await timeout(load(CDN), 20000); }
    this.A = A; this.U = U; this.F = F;
    // Yönetici paneli ayrı bir Firebase örneği kullanır: aynı tarayıcıda yönetici ve bayi oturumları birbirini etkilemez
    this.app = this.appName ? A.initializeApp(this.config, this.appName) : A.initializeApp(this.config);
    // Oturum: yönetici paneli ve "beni hatırlama" seçilen girişler sadece o sekmede yaşar (sekmeler birbirini etkilemez)
    this.tabOnly = this.appName !== 'shop' && sessionStorage.getItem('auth-tab') === '1'; // mağaza üyesi oturumu her zaman cihazda kalır
    // Oturum sadece localStorage'da: Firebase listedeki her saklama yerini açılışta yokluyor; Telegram / WhatsApp / Instagram içi
    // tarayıcılarda IndexedDB hiç cevap vermeyince giriş sonsuza kadar dönüyordu. localStorage yoksa (gizli mod vb.) sadece bu sekme.
    let lsOk = true; try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); } catch { lsOk = false; }
    this.auth = U.initializeAuth(this.app, { persistence: this.tabOnly ? U.browserSessionPersistence : lsOk ? U.browserLocalPersistence : U.inMemoryPersistence });
    // WhatsApp / Instagram içi tarayıcılarda canlı bağlantı takılabiliyor; gerekirse otomatik olarak uzun yoklamaya geçer
    this.auth.languageCode = 'tr'; // doğrulama / şifre e-postaları Türkçe
    // Uygulama içi tarayıcılarda canlı bağlantı (WebChannel) takılabiliyor: orada baştan uzun yoklama kullan
    const inApp = /Telegram|FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|MicroMessenger|; wv\)|GSA\//i.test(navigator.userAgent) || typeof window.TelegramWebviewProxy !== 'undefined';
    // Yönetim paneli verileri cihazda saklar (27.10.2026): açılışta sadece değişen kayıtlar okunur (Firestore okuma kotası).
    // Sadece yönetici örneğinde ve normal tarayıcıda; çıkışta silinir (logout).
    this.persist = this.appName === 'admin' && !inApp && !!F.persistentLocalCache;
    const net = inApp ? { experimentalForceLongPolling: true } : { experimentalAutoDetectLongPolling: true };
    try { this.db = F.initializeFirestore(this.app, this.persist ? { ...net, localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) } : net); }
    catch (e) { console.warn('firestore önbellek', e); this.persist = false; try { this.db = F.initializeFirestore(this.app, net); } catch { this.db = F.getFirestore(this.app); } }
  }
  d(...p) { return this.F.doc(this.db, ...p); }
  c(...p) { return this.F.collection(this.db, ...p); }

  async publicInfo() { const s = await timeout(this.getSafe('settings', 'public')); return s.exists() ? s.data() : null; }
  async needsSetup() { const s = await timeout(this.F.getDoc(this.d('meta', 'owner'))); return !s.exists(); }
  async setupAdmin({ username, password, name }) {
    this.settingUp = true;
    const cred = await this.U.createUserWithEmailAndPassword(this.auth, toEmail(username), password);
    const uid = cred.user.uid;
    await this.F.setDoc(this.d('meta', 'owner'), { uid, at: now() });
    await this.F.setDoc(this.d('users', uid), { uid, username, name, shop: name, role: 'admin', active: true, createdAt: now() });
    this.settingUp = false;
    this._emitAuth(cred.user);
  }

  onAuth(cb) {
    this.authCb = cb;
    return this.U.onAuthStateChanged(this.auth, (u) => this._emitAuth(u));
  }
  async _emitAuth(u) {
    if (this.settingUp) return;
    if (!u) return this.authCb?.(null);
    // Hızlı açılış: bu cihazda kayıtlı kullanıcı bilgisiyle hemen devam et, sunucudakini arkadan kontrol et
    const ck = 'me-' + u.uid;
    const cached = ls.get(ck, null);
    if (cached && cached.active !== false && !this._fastDone) {
      this._fastDone = true; this.user = cached; this.authCb?.(cached);
    }
    try {
      const s = await timeout(this.F.getDoc(this.d('users', u.uid)));
      if (!s.exists()) { ls.del(ck); return this.authCb?.(null, 'Hesap kaydı bulunamadı.'); }
      const data = { uid: u.uid, ...s.data() };
      const { photo, ...small } = data; ls.set(ck, small); // fotoğraf büyük olabilir, saklama
      if (data.active === false) { await this.U.signOut(this.auth); return this.authCb?.(null, data.pending ? 'Üyelik başvurunuz onay bekliyor. Onaylanınca giriş yapabilirsiniz.' : 'Hesabınız pasif. Lütfen dükkanla iletişime geçin.'); }
      this.user = data; this.authCb?.(data);
    } catch (e) { if (!cached) this.authCb?.(null, e.message); }
  }
  async login(username, pw, remember = true) {
    // "Beni hatırla" kapalıysa oturum sadece bu sekmede kalır: aynı tarayıcıda farklı sekmelerde farklı bayilerle girilebilir
    if (!remember && !this.tabOnly) { await this.U.setPersistence(this.auth, this.U.browserSessionPersistence); sessionStorage.setItem('auth-tab', '1'); this.tabOnly = true; }
    try { await this.U.signInWithEmailAndPassword(this.auth, toEmail(username), pw); }
    catch (e) { throw new Error(/invalid|wrong|not-found|credential/i.test(e.code || e.message) ? 'Kullanıcı adı veya şifre hatalı' : e.message); }
  }
  async logout() {
    const wipe = this.persist && this.user?.role === 'admin';
    if (this.user) ls.del('me-' + this.user.uid); this._fastDone = false; await this.U.signOut(this.auth); sessionStorage.removeItem('auth-tab');
    // yöneticinin cihazda sakladığı müşteri/sipariş verisini sil (sayfa yeniden açılır)
    if (wipe) { try { await this.F.terminate(this.db); await this.F.clearIndexedDbPersistence(this.db); } catch (e) { console.warn(e); } location.reload(); }
  }
  // Bayinin kendi başvurusu: hesap açılır ama yönetici onaylayana kadar giriş yapamaz
  async signup({ username, password, name, shop, phone }) {
    this.settingUp = true;
    try {
      let cred;
      try { cred = await this.U.createUserWithEmailAndPassword(this.auth, toEmail(username), password); }
      catch (e) { throw new Error(e.code === 'auth/email-already-in-use' ? 'Bu kullanıcı adı alınmış, başka bir tane deneyin.' : e.code === 'auth/weak-password' ? 'Şifre en az 6 karakter olmalı.' : e.message); }
      const uid = cred.user.uid;
      await this.F.setDoc(this.d('users', uid), { uid, username, name, shop, phone, role: 'customer', active: false, pending: true, tier: '', createdAt: now() });
      await this.U.signOut(this.auth);
    } finally { this.settingUp = false; }
  }

  async loadSettings() { const s = await timeout(this.F.getDoc(this.d('settings', 'app'))); return s.exists() ? s.data() : null; }
  async saveSettings(S) {
    await this.F.setDoc(this.d('settings', 'app'), S);
    await this.savePublicSettings(S);
  }
  // Giriş yapmayanların (vitrin, liste linki) göreceği ayarlar. Fiyatlandırmadan sadece gösterimle ilgili alanlar (KDV, TL, kur) gider.
  async savePublicSettings(S) {
    const p = S.pricing || {};
    await this.F.setDoc(this.d('settings', 'public'), { brand: S.brand, shop: S.shop, access: S.access, catalog: S.catalog, categories: S.categories || {},
      pricing: { vatPct: p.vatPct ?? 20, showVat: p.showVat !== false, showTL: !!p.showTL, showVatInc: !!p.showVatInc, plusVat: !!p.plusVat, manualRate: p.manualRate ?? '' }, orders: S.orders || {}, shopHome: S.shopHome || null, brandLogos: S.brandLogos || {}, footer: S.footer || null, cards: S.cards || null, look: S.look || null, kalip: S.kalip || null, preq: S.preq || null, legal: S.legal || null, issue: S.issue || null, feat: S.feat || null, sets: (S.sets || []).filter((x) => x.on), v: S.v || 0 });
  }

  // ---- Katalog: önce sürümü kontrol et, değişmediyse cihazdaki kopyayı kullan
  // Katalog değişince (eşitleme veya yönetici kaydı) açık ekranlara haber verir
  watchCatalog(cb, pub) {
    let first = true;
    return this.F.onSnapshot(this.d(pub ? 'pubcatalog' : 'catalog', '_meta'), async (snap) => {
      if (first) { first = false; return; }
      // kendi kaydımız: ekran zaten güncel (eski kopyayı okuyup geri çevirmesin — aktif/pasif bir an geri dönüyordu)
      if (snap.metadata?.hasPendingWrites || this._saving || (this._ownV && snap.data()?.version === this._ownV)) return;
      try { cb(pub ? await this.loadPublicCatalog() : await this.loadCatalog()); } catch (e) { console.warn(e); }
    }, () => {});
  }
  // Cihazdaki son katalog (ekranı beklemeden açmak için)
  async cachedCatalog(pub) { const c = await idbGet(pub ? 'pubcat' : 'cat'); return c?.items?.length ? c : null; }
  async loadCatalog() {
    const meta = await timeout(this.F.getDoc(this.d('catalog', '_meta')));
    if (!meta.exists()) return null;
    const { version, chunks } = meta.data();
    const cached = await idbGet('cat');
    if (cached && cached.version === version) return cached.items;
    const parts = await timeout(Promise.all(Array.from({ length: chunks }, (_, i) => this.F.getDoc(this.d('catalog', 'c' + i)))), 45000);
    const items = parts.flatMap((p) => (p.exists() ? p.data().items : []));
    idbSet('cat', { version, items });
    return items;
  }
  // elle silinen ürünler: eşitleme siteden yeniden eklemesin (meta/deleted, sadece yönetici)
  async markDeleted(ids) {
    const r = this.d('meta', 'deleted'); const s = await this.F.getDoc(r);
    const cur = s.exists() ? s.data().ids || [] : [];
    await this.F.setDoc(r, { ids: [...new Set([...cur, ...ids])].slice(-3000), at: now() });
  }
  // Hız: sadece DEĞİŞEN parçalar yazılır (tek ürün düzenlenince ~1 MB yerine birkaç yüz KB). Güvenlik: sunucudaki sürüm
  // en son BİZİM yazdığımız değilse (eşitleme vb. yazdıysa) parça düzeni farklı olabilir → hepsi yazılır.
  async _writeChunks(col, parts, meta) {
    const sig = (part) => { const t = JSON.stringify(part); let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return t.length + ':' + (h >>> 0); };
    const sigs = parts.map(sig);
    this._sig = this._sig || {};
    const prev = this._sig[col];
    let same = false;
    if (prev && prev.v) { try { const m = await timeout(this.F.getDoc(this.d(col, '_meta')), 8000); same = m.exists() && m.data().version === prev.v; } catch { same = false; } }
    const b = this.F.writeBatch(this.db);
    let n = 0;
    parts.forEach((part, i) => { if (same && prev.s[i] === sigs[i]) return; b.set(this.d(col, 'c' + i), { items: part }); n++; });
    b.set(this.d(col, '_meta'), meta);
    await b.commit();
    this._sig[col] = { v: meta.version, s: sigs };
    return n;
  }
  async saveCatalog(items) {
    const cl = items.map(clean);
    // "Gelince haber ver": panelden stoğu açılan (ya da tekrar aktif edilen) ürünün bekleyenlerine hemen bildirim
    const avail = (p) => p && p.a !== 0 && !p.so && Number(p.s) > 0;
    const prev = this._lastCat || (await idbGet('cat').catch(() => null))?.items;
    if (prev?.length) { const was = new Map(prev.map((p) => [p.id, p])); const back = cl.filter((p) => avail(p) && was.has(p.id) && !avail(was.get(p.id))); if (back.length) this.backInStock(back).catch((e) => console.warn('haber ver', e)); }
    this._lastCat = cl;
    const parts = chunkBySize(cl);
    const version = now(); this._ownV = version;
    this._saving = (this._saving || 0) + 1;
    try {
      idbSet('cat', { version, items: cl });
      await this._writeChunks('catalog', parts, { version, chunks: Math.max(1, parts.length), count: items.length });
      await this.savePublicCatalog(items);
    } finally { this._saving--; }
  }
  // Ziyaretçi mağazası için herkese açık katalog: toptan fiyat, etiket ve pasif ürünler yok
  async savePublicCatalog(items) {
    const pub = items.filter((p) => p.a).map(publicItem);
    const parts = chunkBySize(pub);
    await this._writeChunks('pubcatalog', parts, { version: now(), chunks: parts.length, count: pub.length, kc: 4 });
  }
  async hasPublicCatalog() { const m = await timeout(this.getSafe('pubcatalog', '_meta')); return m.exists() && m.data().kc >= 4; } // kc: 3 kalıp anahtarları, 4 gizli etiketler (arama) eklenmiş sürüm
  async loadPublicCatalog() {
    const meta = await timeout(this.getSafe('pubcatalog', '_meta'));
    if (!meta.exists()) return [];
    const { version, chunks } = meta.data();
    const cached = await idbGet('pubcat');
    if (cached && cached.version === version) return cached.items;
    const parts = await timeout(Promise.all(Array.from({ length: chunks }, (_, i) => this.getSafe('pubcatalog', 'c' + i))), 45000);
    const items = parts.flatMap((p) => (p.exists() ? p.data().items : []));
    idbSet('pubcat', { version, items });
    return items;
  }
  // ---- Ürün açıklamaları: katalog gibi birkaç büyük dokümanda, ilk ürün detayında bir kez yüklenir
  async loadDescMap() {
    if (this._descs) return this._descs;
    this._descsP = this._descsP || (async () => {
      // açıklamalar ~1,5 MB: sürüm değişmediyse cihazdaki kopya (her ziyarette 1 okuma, veri inmez)
      const meta = await timeout(this.getSafe('desc', '_meta'));
      if (!meta.exists()) return {};
      const { version, chunks } = meta.data();
      const cached = await idbGet('desc').catch(() => null);
      if (cached && cached.version === version && cached.d) return cached.d;
      const parts = await Promise.all(Array.from({ length: chunks }, (_, i) => this.getSafe('desc', 'c' + i)));
      const d = Object.assign({}, ...parts.map((x) => (x.exists() ? x.data().d : {})));
      idbSet('desc', { version, d });
      return d;
    })();
    try { this._descs = await this._descsP; } catch (e) { this._descsP = null; throw e; } // hata olursa bir dahakine yeniden dener
    return this._descs;
  }
  async hasDescs() { return (await timeout(this.F.getDoc(this.d('desc', '_meta')))).exists(); }
  // Tek ürünün açıklaması: bütün açıklamalar zaten yüklüyse / cihazda güncel kopyası varsa oradan; yoksa sadece ürünün
  // kovası (descb/b<n>, ~25 KB) okunur. Kova eski ya da yoksa eski yol (bütün açıklamalar) — görünen sonuç aynı.
  _descMeta() {
    this._dmP = this._dmP || timeout(this.getSafe('desc', '_meta')).then((s) => (s.exists() ? s.data() : null)).catch((e) => { this._dmP = null; throw e; });
    return this._dmP;
  }
  async getDesc(id) {
    if (this._descs) return this._descs[id] || '';
    try {
      const meta = await this._descMeta();
      if (!meta) return '';
      const cached = await idbGet('desc').catch(() => null);
      if (cached && cached.version === meta.version && cached.d) { this._descs = cached.d; return cached.d[id] || ''; }
      const bk = meta.bk, n = bk ? descBucket(id, bk) : -1;
      if (bk && meta.bv?.[n] != null) {
        this._dbk = this._dbk || {};
        this._dbk[n] = this._dbk[n] || this.getSafe('descb', 'b' + n).then((s) => (s.exists() && s.data().v === meta.bv[n] ? s.data().d || {} : null)).catch(() => null);
        const d = await this._dbk[n];
        if (d) return d[id] || '';
        delete this._dbk[n];
      }
    } catch (e) { console.warn(e); }
    return (await this.loadDescMap())[id] || '';
  }
  // only: sadece bu ürünlerin kovaları yeniden yazılır (tek ürün düzenlemede 64 yerine 1 yazma)
  async saveDescs(map, only) {
    const parts = chunkBySize(Object.entries(map));
    const version = now();
    let bv = {};
    if (only) { try { const m = (await timeout(this.getSafe('desc', '_meta'))).data() || {}; if (m.bk === DESC_BK && m.bv) bv = { ...m.bv }; else only = null; } catch { only = null; } }
    const bks = descBuckets(map);
    const want = only ? new Set(only.map((id) => descBucket(id))) : null;
    const b = this.F.writeBatch(this.db);
    parts.forEach((part, i) => b.set(this.d('desc', 'c' + i), { d: Object.fromEntries(part) }));
    bks.forEach((d, i) => { if (!want || want.has(i)) { b.set(this.d('descb', 'b' + i), { v: version, d }); bv[i] = version; } });
    b.set(this.d('desc', '_meta'), { version, chunks: parts.length, count: Object.keys(map).length, bk: DESC_BK, bv });
    await b.commit();
    this._descs = map; this._dmP = null; this._dbk = null; idbSet('desc', null);
  }
  async hasDescBuckets() { const m = await this._descMeta().catch(() => null); return !m || m.bk === DESC_BK; }
  async setDesc(id, html) {
    const m = { ...(await this.loadDescMap()) };
    if (html) m[id] = html; else delete m[id];
    await this.saveDescs(m, [id]);
  }

  async getSyncInfo() { const s = await timeout(this.F.getDoc(this.d('meta', 'sync'))); return s.exists() ? s.data() : null; }
  async getImage(id) {
    if (this.imgCache.has(id)) return this.imgCache.get(id);
    const p = this.F.getDoc(this.d('img', String(id))).then((s) => (s.exists() ? s.data().d : null)).catch(() => null);
    this.imgCache.set(id, p); return p;
  }
  // alış fiyatları {ürün no: fiyat} — sadece yönetici okur/yazar (katalog bayiye açık olduğu için ayrı belge)
  async loadCosts() { try { const s = await timeout(this.F.getDoc(this.d('costs', 'main'))); return s.exists() ? s.data().p || {} : {}; } catch { return {}; } }
  async saveCosts(map) { await this.F.setDoc(this.d('costs', 'main'), { p: map }); }
  async setImage(id, data) {
    this.imgCache.delete(id);
    if (data) await this.F.setDoc(this.d('img', String(id)), { d: data });
    else await this.F.deleteDoc(this.d('img', String(id)));
  }

  // ---- Kullanıcılar
  async updateMe(patch) {
    await this.F.updateDoc(this.d('users', this.user.uid), patch);
    this.user = { ...this.user, ...patch }; this.authCb?.(this.user);
  }
  watchUsers(cb) {
    return this.F.onSnapshot(this.F.query(this.c('users'), this.F.where('role', '==', 'customer')), (s) => cb(s.docs.map((x) => ({ uid: x.id, ...x.data() }))));
  }
  async createUser({ username, password, ...rest }) {
    // Yönetici oturumu kapanmasın diye ikinci bir Firebase örneğiyle oluşturulur
    const sec = this.A.getApps().find((a) => a.name === 'sec') || this.A.initializeApp(this.config, 'sec');
    const sa = this.U.getAuth(sec);
    let cred;
    try { cred = await this.U.createUserWithEmailAndPassword(sa, toEmail(username), password); }
    catch (e) { throw new Error(e.code === 'auth/email-already-in-use' ? 'Bu kullanıcı adı zaten var' : e.code === 'auth/weak-password' ? 'Şifre en az 6 karakter olmalı' : e.message); }
    const uid = cred.user.uid;
    await this.U.signOut(sa);
    await this.F.setDoc(this.d('users', uid), { uid, username, role: 'customer', active: true, createdAt: now(), stats: { done: 0, noshow: 0 }, ...rest });
    return uid;
  }
  async updateUser(uid, patch) { const { password, ...rest } = patch; await this.F.updateDoc(this.d('users', uid), rest); }
  async bumpStat(uid, key, d) { await this.F.updateDoc(this.d('users', uid), { ['stats.' + key]: this.F.increment(d) }); }
  async getNote(uid) { const s = await timeout(this.F.getDoc(this.d('userNotes', uid))); return s.exists() ? s.data().t : ''; }
  async setNote(uid, t) { await this.F.setDoc(this.d('userNotes', uid), { t }); }
  async getUserPrices(uid) { const s = await timeout(this.F.getDoc(this.d('userPrices', uid))); return s.exists() ? s.data().p || {} : {}; }
  async setUserPrices(uid, map) { await this.F.setDoc(this.d('userPrices', uid), { p: map }); }

  // ---- Talepler & mesajlar
  // since: yönetici için sadece bu tarihten sonra güncellenen talepler (varsayılan son 60 gün; "Daha eski" ile geriye açılır)
  watchRequests(user, cb, since = 0) {
    const q = user.role === 'admin'
      ? this.F.query(this.c('requests'), ...(since ? [this.F.where('updatedAt', '>=', since)] : []), this.F.orderBy('updatedAt', 'desc'), this.F.limit(since ? 2000 : 300))
      : this.F.query(this.c('requests'), this.F.where('uid', '==', user.uid));
    return this.F.onSnapshot(q, (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => b.updatedAt - a.updatedAt)), (e) => console.error(e));
  }
  newRequestId() { return this.F.doc(this.c('requests')).id; }
  async createRequest(req, msgs, id) {
    const ref = id ? this.F.doc(this.c('requests'), id) : this.F.doc(this.c('requests'));
    const b = this.F.writeBatch(this.db);
    b.set(ref, { ...req, no: req.no || ref.id.slice(0, 4).toUpperCase() });
    for (const m of msgs) b.set(this.F.doc(this.c('requests', ref.id, 'messages')), m);
    await b.commit();
    this._pingReq(ref.id, false);
    return ref.id;
  }
  // oturum anahtarı (bekçi bununla kim olduğunu doğrular)
  // Ürün resmini Cloudflare deposuna yükle (bekçi /up, yönetici oturumuyla) → 'r2:<anahtar>'
  // Aynı dosya depoda var mı (parmak izi) → 'r2:<anahtar>' ya da null
  async findUpload(h) {
    try { const j = await timeout(fetch(String(window.WATCH_URL || '').replace(/\/$/, '') + '/up/has?h=' + h).then((r) => r.json()), 15000); return j.key ? 'r2:' + j.key : null; } catch { return null; }
  }
  // Depodaki yüklemeler (Ürünü düzenle > Depodan seç): [{ref, v, t, s}], cursor
  async listUploads(cursor) {
    const tok = await this.idToken(); if (!tok) throw new Error('Oturum bulunamadı');
    const r = await timeout(fetch(String(window.WATCH_URL || '').replace(/\/$/, '') + '/up/list' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + tok } }), 30000);
    const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.error || 'Depo okunamadı');
    return { items: j.items.map((x) => ({ ref: 'r2:' + x.k, v: x.v, t: x.t, s: x.s })), cursor: j.cursor };
  }
  async uploadImage(big, th, h) {
    const tok = await this.idToken(); if (!tok) throw new Error('Oturum bulunamadı, yeniden giriş yapın');
    const fd = new FormData(); fd.append('big', big, 'b'); if (th) fd.append('th', th, 't'); if (h) fd.append('h', h);
    const r = await timeout(fetch(String(window.WATCH_URL || '').replace(/\/$/, '') + '/up', { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: fd }), 60000);
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || 'Yükleme başarısız (' + r.status + ')');
    return 'r2:' + j.key;
  }
  // Video: dosyanın kendisi gönderilir (ilerleme yüzdesiyle) → 'r2:<anahtar>'
  async uploadVideo(file, onProg, h) {
    const tok = await this.idToken(); if (!tok) throw new Error('Oturum bulunamadı, yeniden giriş yapın');
    const j = await new Promise((res, rej) => {
      const x = new XMLHttpRequest(); x.open('POST', String(window.WATCH_URL || '').replace(/\/$/, '') + '/upv');
      x.setRequestHeader('Authorization', 'Bearer ' + tok); x.setRequestHeader('Content-Type', file.type); if (h) x.setRequestHeader('X-Hash', h);
      x.upload.onprogress = (e) => e.lengthComputable && onProg?.(e.loaded / e.total);
      x.onload = () => { try { res(JSON.parse(x.responseText)); } catch { rej(new Error('Yükleme başarısız (' + x.status + ')')); } };
      x.onerror = () => rej(new Error('Bağlantı hatası')); x.send(file);
    });
    if (!j.ok) throw new Error(j.error || 'Yükleme başarısız');
    return 'r2:' + j.key;
  }
  async idToken() { try { return await this.auth.currentUser?.getIdToken(); } catch { return null; } }
  // ---- Ürün talebi (mağaza üyesi: fotoğraf + açıklama; yönetici yanıtlar). Fotoğraflar bekçi üzerinden R2'ye (kotalı), kayıt preq/{id}
  async _watchPost(path, body, isForm) {
    const tok = await this.idToken(); if (!tok) throw new Error('Oturum bulunamadı, yeniden giriş yapın');
    const r = await timeout(fetch(String(window.WATCH_URL || '').replace(/\/$/, '') + path, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, ...(isForm ? {} : { 'Content-Type': 'application/json' }) }, body: isForm ? body : JSON.stringify(body) }), 60000);
    const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.error || 'İşlem başarısız (' + r.status + ')'); return j;
  }
  // blobs: küçültülmüş fotoğraflar → { id, keys }
  async preqUpload(blobs) { const fd = new FormData(); blobs.forEach((b, i) => fd.append('f' + i, b, 'f' + i)); return this._watchPost('/preq/up', fd, true); }
  async createPreq(id, doc) {
    await timeout(this.F.setDoc(this.d('preq', id), doc));
    this._watchPost('/preq/new', { id }).catch((e) => console.warn('talep bildirimi', e));
  }
  watchMyPreqs(uid, cb) { return this.F.onSnapshot(this.F.query(this.c('preq'), this.F.where('uid', '==', uid)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => b.createdAt - a.createdAt)), (e) => { console.warn(e); cb([]); }); }
  watchPreqs(cb, since = 0) { return this.F.onSnapshot(this.F.query(this.c('preq'), ...(since ? [this.F.where('createdAt', '>=', since)] : []), this.F.orderBy('createdAt', 'desc'), this.F.limit(since ? 2000 : 400)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), (e) => console.error(e)); }
  async updatePreq(id, patch) { await timeout(this.F.updateDoc(this.d('preq', id), patch)); }
  // yönetici yanıtı: kayda eklenir, bekçi üyenin telefonuna bildirir
  async replyPreq(id, patch) { await this.updatePreq(id, patch); this._watchPost('/preq/reply', { id }).catch((e) => console.warn('yanıt bildirimi', e)); }
  // talep + fotoğrafları birlikte silinir (bekçi; yönetici ya da sahibi)
  async deletePreq(id) { await this._watchPost('/preq/del', { id }); }
  // ---- Sorun bildirimi (issue.jsx): dosyalar bekçi üzerinden R2'ye (kotalı, video ilerlemeli), kayıt issues/{id}
  async issueUpload(imgs, video, onProg) {
    const tok = await this.idToken(); if (!tok) throw new Error('Oturum bulunamadı, yeniden giriş yapın');
    const fd = new FormData(); imgs.forEach((b, i) => fd.append('f' + i, b, 'f' + i)); if (video) fd.append('v', video, 'v');
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest(); x.open('POST', String(window.WATCH_URL || '').replace(/\/$/, '') + '/issue/up');
      x.setRequestHeader('Authorization', 'Bearer ' + tok); x.timeout = 10 * 60e3;
      x.upload.onprogress = (e) => e.lengthComputable && onProg?.(e.loaded / e.total);
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} j.ok ? res(j) : rej(new Error(j.error || 'Yükleme başarısız (' + x.status + ')')); };
      x.onerror = () => rej(new Error('Bağlantı koptu, tekrar deneyin')); x.ontimeout = () => rej(new Error('Yükleme çok uzun sürdü, daha kısa video deneyin'));
      x.send(fd);
    });
  }
  async issueAdminUpload(id, blobs) { const fd = new FormData(); blobs.forEach((b, i) => fd.append('f' + i, b, 'f' + i)); return this._watchPost('/issue/aup?id=' + encodeURIComponent(id), fd, true); }
  async createIssue(id, doc) { await timeout(this.F.setDoc(this.d('issues', id), doc)); this._watchPost('/issue/new', { id }).catch((e) => console.warn('sorun bildirimi', e)); }
  watchMyIssues(uid, cb) { return this.F.onSnapshot(this.F.query(this.c('issues'), this.F.where('uid', '==', uid)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => b.createdAt - a.createdAt)), (e) => { console.warn(e); cb([]); }); }
  watchIssues(cb, since = 0) { return this.F.onSnapshot(this.F.query(this.c('issues'), ...(since ? [this.F.where('createdAt', '>=', since)] : []), this.F.orderBy('createdAt', 'desc'), this.F.limit(since ? 2000 : 400)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), (e) => console.error(e)); }
  async updateIssue(id, patch) { await timeout(this.F.updateDoc(this.d('issues', id), patch)); }
  async replyIssue(id, patch) { await this.updateIssue(id, patch); this._watchPost('/issue/reply', { id }).catch((e) => console.warn('yanıt bildirimi', e)); }
  async msgIssue(id, patch) { await this.updateIssue(id, patch); this._watchPost('/issue/msg', { id }).catch((e) => console.warn('mesaj bildirimi', e)); }
  async deleteIssue(id) { await this._watchPost('/issue/del', { id }); }
  issuePic(key) { return this.preqPic(key); }
  // ---- Mağaza özellikleri (extras.jsx / reviews.jsx)
  async getStats() { const s = await timeout(this.getSafe('stats', 'public')); return s.exists() ? s.data() : {}; }
  // stoğa giren ürünleri bekleyen üyeler (29.10.2026 2): zil kaydı (notifyHit, aynı ürün tekrar gelirse tarihi yenilenir) +
  // bekçi /push/back-admin ile telefon bildirimi. Ürün listeden ÇIKARILMAZ: üye bildirime dokununca, Haber beklenenler'i
  // açınca (ürün stoktayken) ya da kendisi kaldırınca çıkar → o zamana kadar ürün her stoğa girişinde yeniden bildirilir.
  async backInStock(prods) {
    const byMem = new Map(); const at = now();
    for (const p of prods.slice(0, 50)) {
      const w = await timeout(this.F.getDoc(this.d('wait', String(p.id)))).catch(() => null);
      if (!w?.exists()) continue;
      for (const u of w.data().uids || []) { if (!byMem.has(u)) byMem.set(u, []); byMem.get(u).push({ id: p.id, n: String(p.n || '').slice(0, 120) }); }
    }
    if (!byMem.size) return 0;
    for (const [uid, its] of byMem) {
      const mref = this.d('members', uid);
      const m = await timeout(this.F.getDoc(mref)).catch(() => null); if (!m?.exists()) continue;
      const d = m.data(); const ids = new Set(its.map((x) => x.id));
      await timeout(this.F.updateDoc(mref, { notifyHit: [...its.map((x) => ({ ...x, at })), ...(d.notifyHit || []).filter((h) => !ids.has(h.id))].slice(0, 20) })).catch(() => {});
    }
    const tok = await this.idToken();
    if (tok && window.WATCH_URL) await fetch(String(window.WATCH_URL).replace(/\/$/, '') + '/push/back-admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ list: [...byMem].map(([uid, items]) => ({ uid, items: items.slice(0, 10) })) }) }).catch(() => {});
    return byMem.size;
  }
  // üyenin kendi kaydındaki haber bekleme listesi canlı (yönetici stok açınca zil + açılır kart hemen gelsin)
  watchMemberWait(uid, cb) { return this.F.onSnapshot(this.d('members', uid), (s) => { if (s.exists() && !s.metadata.hasPendingWrites) { const d = s.data(); cb({ notify: d.notify || [], notifyHit: d.notifyHit || [] }); } }, () => {}); }
  async setWait(uid, pid, on, notify) {
    await timeout(this.F.updateDoc(this.d('members', uid), { notify }));
    const ref = this.d('wait', String(pid));
    if (on) await timeout(this.F.setDoc(ref, { uids: this.F.arrayUnion(uid), at: now() }, { merge: true }));
    else await timeout(this.F.updateDoc(ref, { uids: this.F.arrayRemove(uid), at: now() })).catch(() => {});
  }
  async getRevSum() { const s = await timeout(this.getSafe('revsum', 'main')); return s.exists() ? s.data().s || {} : {}; }
  async myReviews(uid) { const s = await timeout(this.F.getDocs(this.F.query(this.c('reviews'), this.F.where('uid', '==', uid)))); return s.docs.map((x) => ({ id: x.id, ...x.data() })); }
  async reviewsOf(pid) { const s = await timeout(this.F.getDocs(this.F.query(this.c('reviews'), this.F.where('pid', '==', pid), this.F.where('status', '==', 'pub'), this.F.limit(60)))); return s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => b.createdAt - a.createdAt); }
  async createReview(id, doc) { await timeout(this.F.setDoc(this.d('reviews', id), doc)); this._watchPost('/rev/new', { id }).catch((e) => console.warn('yorum bildirimi', e)); }
  watchReviews(cb, since = 0) { return this.F.onSnapshot(this.F.query(this.c('reviews'), ...(since ? [this.F.where('createdAt', '>=', since)] : []), this.F.orderBy('createdAt', 'desc'), this.F.limit(since ? 2000 : 400)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), (e) => console.error(e)); }
  async updateReview(id, patch) { await timeout(this.F.updateDoc(this.d('reviews', id), patch)); }
  async deleteReview(id) { await timeout(this.F.deleteDoc(this.d('reviews', id))); }
  // Yönetim > Sipariş formu: kaydedilen formlar (oforms/{id}, sadece yönetici; en yeni 60)
  watchForms(cb) { return this.F.onSnapshot(this.F.query(this.c('oforms'), this.F.orderBy('at', 'desc'), this.F.limit(60)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), (e) => { console.warn(e); cb([]); }); }
  newFormId() { return this.F.doc(this.c('oforms')).id; }
  async saveForm(id, data) { await timeout(this.F.setDoc(this.d('oforms', id), data)); }
  async deleteForm(id) { await timeout(this.F.deleteDoc(this.d('oforms', id))); }
  // Sepet linki (lcarts/{id}): yönetici hazırlar, müşteri linkten açıp bir kez onaylar
  newLcartId() { return this.F.doc(this.c('lcarts')).id; }
  async createLcart(id, data) { await timeout(this.F.setDoc(this.d('lcarts', id), data)); }
  watchLcarts(cb, since = 0) { return this.F.onSnapshot(this.F.query(this.c('lcarts'), ...(since ? [this.F.where('at', '>=', since)] : []), this.F.orderBy('at', 'desc'), this.F.limit(since ? 1500 : 150)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), (e) => { console.warn(e); cb([]); }); }
  async getLcart(id) { const s = await timeout(this.getSafe('lcarts', id)); return s.exists() ? { id, ...s.data() } : null; }
  async submitLcart(id, sub) { await timeout(this.F.updateDoc(this.d('lcarts', id), { status: 'sent', sub, subAt: this.F.serverTimestamp() })); }
  async updateLcart(id, patch) { await timeout(this.F.updateDoc(this.d('lcarts', id), patch)); }
  async deleteLcart(id) { await timeout(this.F.deleteDoc(this.d('lcarts', id))); }
  async syncRevSum(pid) {
    const l = await this.reviewsOf(pid); const n = l.length; const avg = n ? Math.round((l.reduce((a, r) => a + (r.stars || 0), 0) / n) * 10) / 10 : 0;
    await timeout(this.F.setDoc(this.d('revsum', 'main'), { s: { [String(pid)]: n ? [avg, n] : this.F.deleteField() } }, { merge: true }));
  }
  preqPic(key) { return /^(data:|blob:|https?:)/.test(key) ? key : r2Base() + key; } // IMG_BASE varsa doğrudan depo adresi, yoksa bekçi /p/
  async _pingReq(id, msg) { const token = await this.idToken(); if (token) pingWatch('/notify-req', { id, token, msg }); }
  watchRequest(id, cb) {
    return this.F.onSnapshot(this.d('requests', id), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), () => cb(null));
  }
  async getRequest(id) { const s = await timeout(this.F.getDoc(this.d('requests', id))); return s.exists() ? { id, ...s.data() } : null; }
  // Talebi mesajlarıyla birlikte tamamen sil (sadece yönetici)
  async deleteRequests(ids) {
    for (const id of ids) {
      const ms = await timeout(this.F.getDocs(this.c('requests', id, 'messages')));
      const docs = [...ms.docs.map((d) => d.ref), this.d('requests', id)];
      for (let i = 0; i < docs.length; i += 450) { const b = this.F.writeBatch(this.db); docs.slice(i, i + 450).forEach((r) => b.delete(r)); await b.commit(); }
    }
  }
  // Müşteriyi tamamen sil: kayıt, özel fiyatlar, notlar (+ istenirse talepleri). Giriş hesabı silinmiş kayıt yüzünden artık açılmaz.
  async deleteUser(uid, withRequests) {
    if (withRequests) {
      const rs = await timeout(this.F.getDocs(this.F.query(this.c('requests'), this.F.where('uid', '==', uid))));
      await this.deleteRequests(rs.docs.map((d) => d.id));
    }
    const b = this.F.writeBatch(this.db);
    b.delete(this.d('users', uid)); b.delete(this.d('userPrices', uid)); b.delete(this.d('userNotes', uid));
    await b.commit();
  }
  // ---- Online mağaza üyeleri (e-posta + şifre, isteğe bağlı kullanıcı adı). Bayi / yönetici oturumundan tamamen ayrı (ayrı Firebase örneği: 'shop')
  // Üye olunca doğrulama e-postası gider; e-postasını doğrulamayan giriş yapamaz.
  onMember(cb) {
    this.memberCb = cb;
    this._emitMember = async (u) => {
      if (!u) return cb(null);
      // Google / Facebook ile girenler e-posta doğrulaması beklemez (sağlayıcı doğruladı)
      const ok = u.emailVerified || u.providerData.some((p) => p.providerId === 'google.com' || p.providerId === 'facebook.com');
      try {
        const s = await timeout(this.F.getDoc(this.d('members', u.uid)));
        const data = s.exists() ? s.data() : {};
        // yönetici panelden açtığı hesaplar e-posta doğrulaması beklemez
        if (!ok && !data.byAdmin) return cb(null);
        cb({ uid: u.uid, email: u.email, ...data });
      } catch { cb(ok ? { uid: u.uid, email: u.email } : null); }
    };
    // telefonda Google'a yönlendirilip geri dönüldüyse sonucu al (üye kaydı ilk girişte açılır)
    let pend = null; try { pend = sessionStorage.getItem('social-pending'); } catch {}
    if (pend) this._finishSocial(pend);
    return this.U.onAuthStateChanged(this.auth, (u) => { if (!this.signingUp) this._emitMember(u); });
  }
  async _ensureMember(u, legal) {
    try {
      const ref = this.d('members', u.uid); const s = await timeout(this.F.getDoc(ref));
      if (!s.exists()) await timeout(this.F.setDoc(ref, { uid: u.uid, email: String(u.email || '').toLowerCase(), name: u.displayName || '', phone: '', createdAt: now(), addresses: [], invoice: { type: 'person' }, ...(legal ? { legal } : {}) }));
    } catch (e) { console.warn(e); }
  }
  async _finishSocial(pend) {
    try { sessionStorage.removeItem('social-pending'); } catch {}
    let p = {}; try { p = JSON.parse(pend) || {}; } catch {}
    try {
      const cred = await this.U.getRedirectResult(this.auth, this.U.browserPopupRedirectResolver);
      if (!cred?.user) return;
      await this._ensureMember(cred.user, p.legal);
      await this._emitMember?.(this.auth.currentUser);
      this.onSocialDone?.();
    } catch (e) { console.warn('google dönüşü', e); this.socialError = e.code || e.message; this.onSocialDone?.(e); }
  }
  // Google / Facebook ile giriş (31.10.2026). İlk girişte üye kaydı (members) açılır. Firebase > Authentication > Sign-in method'da
  // sağlayıcı açık olmalı; kapalıysa anlaşılır hata döner.
  // Google penceresi hazırlığı: giriş kutusu açılınca çağrılır. Firebase'in pencere bağlantısı (gizli iframe) önceden kurulur;
  // yoksa düğmeye basınca önce bu kurulur, pencere geç açılır ve Safari "açılır pencere" diye ENGELLER (31.10.2026).
  prepSocial() {
    if (!this._socialPrep) this._socialPrep = this.U.getRedirectResult(this.auth, this.U.browserPopupRedirectResolver).catch(() => null);
    return this._socialPrep;
  }
  async memberSocial(kind, legal) {
    const P = kind === 'facebook' ? new this.U.FacebookAuthProvider() : new this.U.GoogleAuthProvider();
    if (kind === 'facebook') P.addScope('email'); else P.setCustomParameters({ prompt: 'select_account' });
    // telefon / ana ekran uygulaması: açılır pencere yerine Google'a yönlendir (Safari pencereyi engelliyor); dönüşte _finishSocial
    const phone = matchMedia('(pointer: coarse)').matches || navigator.standalone === true;
    if (phone) {
      try { sessionStorage.setItem('social-pending', JSON.stringify({ kind, legal })); } catch {}
      await this.U.signInWithRedirect(this.auth, P, this.U.browserPopupRedirectResolver);
      return new Promise(() => {}); // sayfa Google'a gidiyor
    }
    this.signingUp = true;
    let cred;
    try { cred = await this.U.signInWithPopup(this.auth, P, this.U.browserPopupRedirectResolver); } // initializeAuth ile kurulduğu için pencere çözücüsü elle verilir (yoksa auth/argument-error)
    catch (e) {
      this.signingUp = false;
      const c = e.code || '';
      if (/popup-closed|cancelled-popup/.test(c)) { const x = new Error(''); x.code = 'cancel'; throw x; }
      throw new Error(/operation-not-allowed/.test(c) ? (kind === 'facebook' ? 'Facebook ile giriş henüz açılmadı.' : 'Google ile giriş henüz açılmadı.')
        : /account-exists-with-different-credential/.test(c) ? 'Bu e-posta ile zaten üyeliğiniz var. E-posta (ya da diğer hesabınız) ile giriş yapın.'
        : /popup-blocked/.test(c) ? 'Tarayıcı giriş penceresini engelledi. Açılır pencerelere izin verip tekrar deneyin.'
        : authMsg(e));
    }
    await this._ensureMember(cred.user, legal);
    this.signingUp = false;
    await this._emitMember?.(this.auth.currentUser);
  }
  actionUrl() { return { url: location.origin + '/' }; }
  async usernameFree(name) { const s = await timeout(this.F.getDoc(this.d('usernames', name))); return !s.exists(); }
  // keep: true → sipariş adımında üye olunca sipariş yazılana kadar oturum açık kalır; sonra memberDone() çağrılır
  async memberSignup({ email, password, name, phone, username, addresses = [], invoice = { type: 'person' }, legal }, keep) {
    if (username && !(await this.usernameFree(username))) throw new Error('Bu kullanıcı adı alınmış, başka bir tane deneyin.');
    this.signingUp = true;
    let cred;
    try { cred = await this.U.createUserWithEmailAndPassword(this.auth, email, password); }
    catch (e) { this.signingUp = false; throw new Error(authMsg(e)); }
    try {
      const m = { uid: cred.user.uid, email, name, phone, createdAt: now(), addresses, invoice, ...(username ? { username } : {}), ...(legal ? { legal } : {}) };
      await timeout(this.F.setDoc(this.d('members', m.uid), m));
      if (username) await timeout(this.F.setDoc(this.d('usernames', username), { uid: m.uid, email })).catch((e) => console.warn(e));
      await this.U.sendEmailVerification(cred.user, this.actionUrl()).catch((e) => console.warn(e));
      if (!keep) await this.memberDone();
      return { ...m, verifySent: true };
    } catch (e) { await this.memberDone(); throw e; }
  }
  async memberDone() { this.signingUp = false; await this.U.signOut(this.auth); }
  async emailOf(id) {
    id = String(id || '').trim().toLowerCase();
    if (id.includes('@')) return id;
    const s = await timeout(this.F.getDoc(this.d('usernames', id)));
    if (!s.exists()) throw new Error('Bu kullanıcı adıyla üyelik bulunamadı.');
    return s.data().email;
  }
  async memberLogin(id, pw) {
    const email = await this.emailOf(id);
    let cred;
    try { cred = await this.U.signInWithEmailAndPassword(this.auth, email, pw); } catch (e) { throw new Error(authMsg(e)); }
    const byAdmin = !cred.user.emailVerified && (await timeout(this.F.getDoc(this.d('members', cred.user.uid))).then((x) => x.exists() && x.data().byAdmin, () => false));
    if (!cred.user.emailVerified && !byAdmin) { await this.U.signOut(this.auth); const e = new Error('E-posta adresiniz henüz doğrulanmadı. Size gönderdiğimiz e-postadaki bağlantıya tıklayın.'); e.code = 'unverified'; throw e; }
  }
  async memberResendVerify(id, pw) {
    const email = await this.emailOf(id);
    this.signingUp = true;
    try { const c = await this.U.signInWithEmailAndPassword(this.auth, email, pw); await this.U.sendEmailVerification(c.user, this.actionUrl()); }
    catch (e) { throw new Error(authMsg(e)); }
    finally { await this.memberDone(); }
    return email;
  }
  async memberLogout() { await this.U.signOut(this.auth); }
  async memberReset(id) { const email = await this.emailOf(id); try { await this.U.sendPasswordResetEmail(this.auth, email, this.actionUrl()); } catch (e) { throw new Error(authMsg(e)); } return email; }
  // E-postadaki bağlantılar (Firebase > Authentication > Templates > işlem adresi: /magaza/islem)
  async authCheckReset(code) { try { return await this.U.verifyPasswordResetCode(this.auth, code); } catch (e) { throw new Error(authMsg(e)); } }
  async authConfirmReset(code, pw) { try { await this.U.confirmPasswordReset(this.auth, code, pw); } catch (e) { throw new Error(authMsg(e)); } }
  async authVerifyEmail(code) { try { await this.U.applyActionCode(this.auth, code); } catch (e) { throw new Error(authMsg(e)); } }
  async saveMember(m) {
    const { uid, ...rest } = m;
    await timeout(this.F.setDoc(this.d('members', uid), { uid, ...rest }, { merge: true }));
    this.memberCb?.(m);
  }
  // Yönetici panelden yeni mağaza üyesi açar: hesap ayrı, geçici bir Firebase örneğinde oluşturulur (yönetici oturumu etkilenmez)
  async adminCreateMember({ email, password, name, phone, username }) {
    if (username && !(await this.usernameFree(username))) throw new Error('Bu kullanıcı adı alınmış.');
    const tmp = this.A.initializeApp(this.config, 'mk' + Date.now());
    try {
      const auth = this.U.initializeAuth(tmp, { persistence: this.U.inMemoryPersistence });
      let cred; try { cred = await this.U.createUserWithEmailAndPassword(auth, email, password); } catch (e) { throw new Error(authMsg(e)); }
      const uid = cred.user.uid;
      await this.U.signOut(auth);
      const m = { uid, email, name, phone, createdAt: now(), addresses: [], invoice: { type: 'person' }, byAdmin: true, ...(username ? { username } : {}) };
      await timeout(this.F.setDoc(this.d('members', uid), m));
      if (username) await timeout(this.F.setDoc(this.d('usernames', username), { uid, email }));
      return m;
    } finally { this.A.deleteApp(tmp).catch(() => {}); }
  }
  // since: sadece bu tarihten sonra üye olanlar (panel açılışı); 0 = hepsi (Müşteriler > Mağaza müşterileri açılınca)
  watchMembers(cb, since = 0) { const q = since ? this.F.query(this.c('members'), this.F.where('createdAt', '>=', since)) : this.c('members'); return this.F.onSnapshot(q, (s) => cb(s.docs.map((x) => ({ uid: x.id, ...x.data() }))), (e) => console.warn(e)); }
  // tarihine bakmadan açık durumdaki kayıtlar (60 günden eski ama hâlâ bekleyen sipariş/talep listeden düşmesin)
  watchByStatus(col, statuses, cb) { return this.F.onSnapshot(this.F.query(this.c(col), this.F.where('status', 'in', statuses), this.F.limit(1000)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), (e) => { console.warn(e); cb([]); }); }
  // bir bayinin tüm talepleri (müşteri penceresindeki geçmiş; ana liste son 60 günle sınırlı)
  watchUserRequests(uid, cb) { return this.F.onSnapshot(this.F.query(this.c('requests'), this.F.where('uid', '==', uid)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => b.updatedAt - a.updatedAt)), () => cb([])); }
  async deleteMember(uid) {
    const s = await this.F.getDoc(this.d('members', uid)); const un = s.exists() && s.data().username;
    const b = this.F.writeBatch(this.db); b.delete(this.d('members', uid)); if (un) b.delete(this.d('usernames', un)); await b.commit();
  }

  // ---- Mağaza ana sayfası resimleri (Storage yok: küçültülmüş resim Firestore'da, cihazda önbellekte)
  async saveShopImage(data) { const ref = this.F.doc(this.c('shopimg')); await timeout(this.F.setDoc(ref, { d: data, at: now() })); idbSet('si-' + ref.id, data); return ref.id; }
  async getShopImage(id) {
    const c = await idbGet('si-' + id); if (c) return c;
    const s = await timeout(this.F.getDoc(this.d('shopimg', id)));
    const d = s.exists() ? s.data().d : null; if (d) idbSet('si-' + id, d); return d;
  }
  async deleteShopImage(id) { await this.F.deleteDoc(this.d('shopimg', id)).catch(() => {}); }

  // ---- Online mağaza siparişleri
  newOrderId() { return this.F.doc(this.c('orders')).id; }
  // Mağaza siparişi bekçiden (fiyatlar sunucuda katalogdan yeniden hesaplanır; Firestore kuralı müşterinin doğrudan yazmasına izin vermez)
  // → { ok, id, no, items, total } | { ok:false, code:'price', items:[{id, price, gone}] } | { ok:false, error }
  async placeOrderSrv(o, id, check) {
    const tok = o.uid && !check ? await this.idToken() : null;
    const r = await timeout(fetch(String(window.WATCH_URL || '').replace(/\/$/, '') + '/order', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify({ id, order: o, ...(check ? { check: true } : {}) }) }), 30000);
    return await r.json().catch(() => ({ ok: false, error: 'Sunucu cevap vermedi (' + r.status + ')' }));
  }
  async placeOrder(o, id) { const ref = this.F.doc(this.c('orders'), id || this.newOrderId()); await timeout(this.F.setDoc(ref, o)); return ref.id; }
  // REST ile tek belge (giriş varsa oturum anahtarıyla)
  async restGet(path) {
    const pid = this.config.projectId; const tok = await this.idToken?.().catch(() => null);
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`, { headers: tok ? { Authorization: 'Bearer ' + tok } : {}, cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('REST ' + r.status);
    const j = await r.json(); return restVal({ mapValue: { fields: j.fields || {} } });
  }
  // getDoc + 3,5 sn sonra REST yedeği: hangisi önce sonuç verirse
  getSafe(col, id) {
    return new Promise((res, rej) => {
      let done = false, errs = 0;
      const ok = (x) => { if (!done) { done = true; clearTimeout(t); res(x); } };
      const bad = (e) => { if (++errs >= 2 && !done) { done = true; rej(e); } };
      this.F.getDoc(this.d(col, id)).then(ok, bad);
      const t = setTimeout(() => this.restGet(col + '/' + id).then((d) => ok(fakeSnap(id, d)), bad), 3500);
    });
  }
  // sipariş takip: canlı dinleyici; 3,5 sn içinde cevap gelmezse REST ile getirilir ve dinleyici sessiz kaldıkça 20 sn'de bir yenilenir
  watchOrder(id, cb) {
    let live = false, stop = false, poll = null;
    const un = this.F.onSnapshot(this.d('orders', id), (s) => { live = true; clearInterval(poll); cb(s.exists() ? { id: s.id, ...s.data() } : null); }, () => { if (!live) rest(); });
    const rest = () => this.restGet('orders/' + id).then((d) => { if (!live && !stop) cb(d ? { id, ...d } : null); }).catch(() => {});
    const t = setTimeout(() => { if (live || stop) return; rest(); poll = setInterval(() => (live || stop ? clearInterval(poll) : rest()), 20000); }, 3500);
    return () => { stop = true; clearTimeout(t); clearInterval(poll); un(); };
  }
  watchMyOrders(uid, cb) { return this.F.onSnapshot(this.F.query(this.c('orders'), this.F.where('uid', '==', uid)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => b.createdAt - a.createdAt)), (e) => { console.warn(e); cb([]); }); }
  watchFeed(cb) { return this.F.onSnapshot(this.d('meta', 'feed'), (s) => cb(s.exists() ? s.data().items || [] : []), () => cb([])); }
  // sipariş numarasıyla (yüklü pencerede olmayan eski sipariş): tek okuma
  async findOrderByNo(no) { const s = await this.F.getDocs(this.F.query(this.c('orders'), this.F.where('no', '==', String(no).toUpperCase()), this.F.limit(3))); return s.docs.map((x) => ({ id: x.id, ...x.data() })); }
  // tarih aralığı araması (Siparişler > Tarih): aralıktaki sipariş sayısı kadar okuma, tek seferlik (canlı dinlemez)
  async findOrdersRange(from, to) { const s = await this.F.getDocs(this.F.query(this.c('orders'), this.F.where('createdAt', '>=', from), this.F.where('createdAt', '<', to), this.F.orderBy('createdAt', 'desc'), this.F.limit(1500))); return s.docs.map((x) => ({ id: x.id, ...x.data() })); }
  async findRange(col, from, to) { const k = col === 'lcarts' ? 'at' : 'createdAt'; const s = await this.F.getDocs(this.F.query(this.c(col), this.F.where(k, '>=', from), this.F.where(k, '<', to), this.F.orderBy(k, 'desc'), this.F.limit(1500))); return s.docs.map((x) => ({ id: x.id, ...x.data() })); }
  async countRange(col, from, to) { const k = col === 'lcarts' ? 'at' : 'createdAt'; const r = await this.F.getCountFromServer(this.F.query(this.c(col), this.F.where(k, '>=', from), this.F.where(k, '<', to))); return r.data().count; }
  async countOrdersRange(from, to) { const r = await this.F.getCountFromServer(this.F.query(this.c('orders'), this.F.where('createdAt', '>=', from), this.F.where('createdAt', '<', to))); return r.data().count; }
  async getUsage() { const s = await this.F.getDoc(this.d('meta', 'usage')); return s.exists() ? s.data() : null; }
  watchOrders(cb, since = 0) { return this.F.onSnapshot(this.F.query(this.c('orders'), ...(since ? [this.F.where('createdAt', '>=', since)] : []), this.F.orderBy('createdAt', 'desc'), this.F.limit(since ? 3000 : 300)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), (e) => console.error(e)); }
  async updateOrder(id, patch) { await timeout(this.F.updateDoc(this.d('orders', id), patch)); }
  async deleteOrders(ids) { const b = this.F.writeBatch(this.db); ids.forEach((id) => b.delete(this.d('orders', id))); await b.commit(); }

  async updateRequest(id, patch) { await this.F.updateDoc(this.d('requests', id), patch); }
  watchMessages(id, cb) {
    return this.F.onSnapshot(this.F.query(this.c('requests', id, 'messages'), this.F.orderBy('at')), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))));
  }
  async sendMessage(id, msg, patch = {}, notify) {
    const b = this.F.writeBatch(this.db);
    b.set(this.F.doc(this.c('requests', id, 'messages')), msg);
    const to = notify || (msg.from === 'user' ? 'admin' : msg.from === 'admin' ? 'user' : null);
    const unread = to === 'admin' ? { unreadAdmin: this.F.increment(1) } : to === 'user' ? { unreadUser: this.F.increment(1) } : {};
    b.update(this.d('requests', id), { updatedAt: msg.at, ...(msg.from !== 'system' ? { lastMsg: msg.text, lastFrom: msg.from } : {}), ...unread, ...patch });
    await b.commit();
    if (msg.from === 'user') this._pingReq(id, true);
  }
}

function authMsg(e) {
  const c = e.code || '';
  if (/email-already-in-use/.test(c)) return 'Bu e-posta ile zaten üyelik var. Giriş yapın ya da şifrenizi sıfırlayın.';
  if (/invalid-email/.test(c)) return 'E-posta adresi geçersiz görünüyor.';
  if (/weak-password/.test(c)) return 'Şifre en az 6 karakter olmalı.';
  if (/user-not-found|wrong-password|invalid-credential|invalid-login/.test(c)) return 'E-posta veya şifre hatalı.';
  if (/expired-action-code|invalid-action-code/.test(c)) return 'Bu bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeniden isteyin.';
  if (/user-disabled/.test(c)) return 'Bu hesap kapatılmış.';
  if (/too-many-requests/.test(c)) return 'Çok fazla deneme yapıldı, biraz sonra tekrar deneyin.';
  if (/network/.test(c)) return 'Bağlantı hatası, internetinizi kontrol edin.';
  return e.message;
}

const PUB_FIELDS = ['id', 'k', 'c', 'c2', 'r', 'n', 'cur', 's', 'a', 'pi', 'im', 'b', 'u', 'img', 'vd', 'vdp', 'man', 't'];
export function publicItem(p) { const o = {}; for (const k of PUB_FIELDS) if (p[k] !== undefined && p[k] !== null) o[k] = p[k]; const kc = stencilKeys(p); if (kc) o.kc = kc; if (o.t) { const t = packTags(p); if (t) o.t = t; else delete o.t; } return o; }

function clean(p) { const o = {}; for (const k in p) if (p[k] !== undefined && !k.startsWith('_')) o[k] = p[k]; return o; }
