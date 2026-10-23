// FIREBASE veri katmanı (ücretsiz Spark planı ile çalışacak şekilde tasarlandı)
//  - Auth: kullanıcı adı + şifre (arka planda kullaniciadi@EMAIL_DOMAIN e-postasına çevrilir)
//  - Firestore: katalog 1500'lük parçalar halinde birkaç dokümanda tutulur → her açılışta ~2-3 okuma
//  - Resimler: küçültülüp Firestore'da (img/{id}) saklanır; Storage (ücretli plan) gerekmez
import { EMAIL_DOMAIN } from './config.js';
import { now, ls } from './utils.js';
import { chunkBySize } from './cats.js';

const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}/`;
const toEmail = (u) => `${u.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

export class FirebaseBackend {
  mode = 'firebase';
  constructor(config) { this.config = config; this.imgCache = new Map(); }

  async init() {
    const [A, U, F] = await Promise.all([
      import(/* @vite-ignore */ CDN + 'firebase-app.js'),
      import(/* @vite-ignore */ CDN + 'firebase-auth.js'),
      import(/* @vite-ignore */ CDN + 'firebase-firestore.js'),
    ]);
    this.A = A; this.U = U; this.F = F;
    this.app = A.initializeApp(this.config);
    this.auth = U.getAuth(this.app);
    await U.setPersistence(this.auth, U.browserLocalPersistence);
    this.db = F.getFirestore(this.app);
  }
  d(...p) { return this.F.doc(this.db, ...p); }
  c(...p) { return this.F.collection(this.db, ...p); }

  async publicInfo() { const s = await this.F.getDoc(this.d('settings', 'public')); return s.exists() ? s.data() : null; }
  async needsSetup() { const s = await this.F.getDoc(this.d('meta', 'owner')); return !s.exists(); }
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
    try {
      const s = await this.F.getDoc(this.d('users', u.uid));
      if (!s.exists()) return this.authCb?.(null, 'Hesap kaydı bulunamadı.');
      const data = { uid: u.uid, ...s.data() };
      if (data.active === false) { await this.U.signOut(this.auth); return this.authCb?.(null, data.pending ? 'Üyelik başvurunuz onay bekliyor. Onaylanınca giriş yapabilirsiniz.' : 'Hesabınız pasif. Lütfen dükkanla iletişime geçin.'); }
      this.user = data; this.authCb?.(data);
    } catch (e) { this.authCb?.(null, e.message); }
  }
  async login(username, pw) {
    try { await this.U.signInWithEmailAndPassword(this.auth, toEmail(username), pw); }
    catch (e) { throw new Error(/invalid|wrong|not-found|credential/i.test(e.code || e.message) ? 'Kullanıcı adı veya şifre hatalı' : e.message); }
  }
  async logout() { await this.U.signOut(this.auth); }
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

  async loadSettings() { const s = await this.F.getDoc(this.d('settings', 'app')); return s.exists() ? s.data() : null; }
  async saveSettings(S) {
    await this.F.setDoc(this.d('settings', 'app'), S);
    await this.F.setDoc(this.d('settings', 'public'), { brand: S.brand, shop: S.shop, access: S.access });
  }

  // ---- Katalog: önce sürümü kontrol et, değişmediyse cihazdaki kopyayı kullan
  async loadCatalog() {
    const meta = await this.F.getDoc(this.d('catalog', '_meta'));
    if (!meta.exists()) return null;
    const { version, chunks } = meta.data();
    const cached = ls.get('cat-cache', null);
    if (cached && cached.version === version) return cached.items;
    const parts = await Promise.all(Array.from({ length: chunks }, (_, i) => this.F.getDoc(this.d('catalog', 'c' + i))));
    const items = parts.flatMap((p) => (p.exists() ? p.data().items : []));
    ls.set('cat-cache', { version, items });
    return items;
  }
  async saveCatalog(items) {
    const b = this.F.writeBatch(this.db);
    const parts = chunkBySize(items.map(clean));
    const chunks = Math.max(1, parts.length);
    parts.forEach((part, i) => b.set(this.d('catalog', 'c' + i), { items: part }));
    const version = now();
    b.set(this.d('catalog', '_meta'), { version, chunks, count: items.length });
    await b.commit();
    ls.set('cat-cache', { version, items });
  }
  // ---- Ürün açıklamaları: katalog gibi birkaç büyük dokümanda, ilk ürün detayında bir kez yüklenir
  async loadDescMap() {
    if (this._descs) return this._descs;
    this._descsP = this._descsP || (async () => {
      const meta = await this.F.getDoc(this.d('desc', '_meta'));
      if (!meta.exists()) return {};
      const parts = await Promise.all(Array.from({ length: meta.data().chunks }, (_, i) => this.F.getDoc(this.d('desc', 'c' + i))));
      return Object.assign({}, ...parts.map((x) => (x.exists() ? x.data().d : {})));
    })();
    this._descs = await this._descsP; return this._descs;
  }
  async hasDescs() { return (await this.F.getDoc(this.d('desc', '_meta'))).exists(); }
  async getDesc(id) { return (await this.loadDescMap())[id] || ''; }
  async saveDescs(map) {
    const parts = chunkBySize(Object.entries(map));
    const b = this.F.writeBatch(this.db);
    parts.forEach((part, i) => b.set(this.d('desc', 'c' + i), { d: Object.fromEntries(part) }));
    b.set(this.d('desc', '_meta'), { version: now(), chunks: parts.length, count: Object.keys(map).length });
    await b.commit();
    this._descs = map;
  }
  async setDesc(id, html) {
    const m = { ...(await this.loadDescMap()) };
    if (html) m[id] = html; else delete m[id];
    await this.saveDescs(m);
  }

  async getImage(id) {
    if (this.imgCache.has(id)) return this.imgCache.get(id);
    const p = this.F.getDoc(this.d('img', String(id))).then((s) => (s.exists() ? s.data().d : null)).catch(() => null);
    this.imgCache.set(id, p); return p;
  }
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
  async getNote(uid) { const s = await this.F.getDoc(this.d('userNotes', uid)); return s.exists() ? s.data().t : ''; }
  async setNote(uid, t) { await this.F.setDoc(this.d('userNotes', uid), { t }); }
  async getUserPrices(uid) { const s = await this.F.getDoc(this.d('userPrices', uid)); return s.exists() ? s.data().p || {} : {}; }
  async setUserPrices(uid, map) { await this.F.setDoc(this.d('userPrices', uid), { p: map }); }

  // ---- Talepler & mesajlar
  watchRequests(user, cb) {
    const q = user.role === 'admin'
      ? this.F.query(this.c('requests'), this.F.orderBy('updatedAt', 'desc'), this.F.limit(300))
      : this.F.query(this.c('requests'), this.F.where('uid', '==', user.uid));
    return this.F.onSnapshot(q, (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => b.updatedAt - a.updatedAt)), (e) => console.error(e));
  }
  async createRequest(req, msgs) {
    const ref = this.F.doc(this.c('requests'));
    const b = this.F.writeBatch(this.db);
    b.set(ref, { ...req, no: ref.id.slice(0, 4).toUpperCase() });
    for (const m of msgs) b.set(this.F.doc(this.c('requests', ref.id, 'messages')), m);
    await b.commit();
    return ref.id;
  }
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
  }
}

function clean(p) { const o = {}; for (const k in p) if (p[k] !== undefined && !k.startsWith('_')) o[k] = p[k]; return o; }
