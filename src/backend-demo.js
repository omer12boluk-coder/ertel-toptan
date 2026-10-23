// DEMO veri katmanı: her şey bu tarayıcıda (localStorage) tutulur.
// Firebase ayarı girilmediğinde otomatik kullanılır. Gerçek kullanımda backend-firebase.js devreye girer.
import { now, rid, ls } from './utils.js';

const KEY = 'ertel-toptan-demo-v1';

function freshDb(seed) {
  const t = now();
  const H = 3600e3;
  const pick = (id) => seed.find((p) => p.id === id) || seed[0];
  const a = pick(3109), b = pick(3002) , c = pick(2875);
  const users = {
    u_admin: { uid: 'u_admin', username: 'admin', pw: 'admin', role: 'admin', name: 'Ertel GSM', shop: 'ERTEL GSM', phone: '', active: true, createdAt: t },
    u_ahmet: { uid: 'u_ahmet', username: 'ahmet', pw: '1234', role: 'customer', name: 'Ahmet Usta (örnek)', shop: 'Kadıköy Teknik (örnek)', phone: '0532 000 00 00', tier: 'gumus', extraPct: 0, active: true, createdAt: t - 40 * 24 * H, stats: { done: 6, noshow: 0 } },
    u_mert: { uid: 'u_mert', username: 'mert', pw: '1234', role: 'customer', name: 'Mert (örnek)', shop: 'Bağcılar GSM (örnek)', phone: '', tier: 'standart', extraPct: 0, active: true, createdAt: t - 12 * 24 * H, stats: { done: 1, noshow: 2 } },
  };
  const item = (p, qty) => ({ id: p.id, k: p.k, n: p.n, cur: p.cur, qty, list: p.r, asked: p.w ?? Math.round(p.r * 0.9 * 2) / 2, offer: p.w ?? Math.round(p.r * 0.9 * 2) / 2 });
  const r1 = { id: 'r_demo1', no: 'A1F3', uid: 'u_ahmet', userName: users.u_ahmet.name, shop: users.u_ahmet.shop, type: 'quote', status: 'new', items: [item(a, 2), item(b, 1)], note: 'İkisini birlikte alırsam son ne olur?', pickup: 'Bugün 16:00 gibi', createdAt: t - 0.6 * H, updatedAt: t - 0.5 * H, unreadAdmin: 1, unreadUser: 0, lastMsg: 'İkisini birlikte alırsam son ne olur?', lastFrom: 'user' };
  const r2items = [item(c, 3)]; r2items[0].offer = r2items[0].asked - 1;
  const r2 = { id: 'r_demo2', no: 'B7K2', uid: 'u_mert', userName: users.u_mert.name, shop: users.u_mert.shop, type: 'reserve', status: 'ready', items: r2items, note: '', pickup: 'Yarın sabah', createdAt: t - 26 * H, updatedAt: t - 20 * H, unreadAdmin: 0, unreadUser: 0, lastMsg: 'Hazır, gelip alabilirsiniz.', lastFrom: 'admin' };
  return {
    users,
    settings: null,
    catalog: seed,
    catalogVersion: t,
    images: {},
    userPrices: { u_ahmet: { [a.id]: Math.max(1, (a.w ?? a.r) - 1) } },
    notes: { u_mert: '2 kez hazırlatıp gelmedi. Önce teyit al.' },
    requests: { r_demo1: r1, r_demo2: r2 },
    messages: {
      r_demo1: [
        { id: 'm1', from: 'system', text: 'Fiyat sorusu gönderildi · 2 kalem', at: t - 0.6 * H },
        { id: 'm2', from: 'user', text: 'İkisini birlikte alırsam son ne olur?', at: t - 0.5 * H },
      ],
      r_demo2: [
        { id: 'm3', from: 'system', text: 'Hazırlama talebi gönderildi · 1 kalem', at: t - 26 * H },
        { id: 'm4', from: 'admin', text: 'Tanesini 1 dolar düştüm, hazırlıyorum.', at: t - 25 * H },
        { id: 'm5', from: 'system', text: 'Durum: Hazır', at: t - 20 * H },
        { id: 'm6', from: 'admin', text: 'Hazır, gelip alabilirsiniz.', at: t - 20 * H },
      ],
    },
    session: null,
  };
}

export class DemoBackend {
  mode = 'demo';
  constructor(seed, loadDescs, area = 'user') {
    this.sk = area === 'admin' ? 'adminSession' : 'session';
    this.seed = seed;
    this.loadDescs = loadDescs || (async () => ({}));
    this.db = ls.get(KEY, null) || freshDb(seed);
    this.subs = new Set();
    this.authCb = null;
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) { this.db = ls.get(KEY, this.db); this.emit(); }
    });
  }
  persist() { ls.set(KEY, this.db); this.emit(); }
  emit() { queueMicrotask(() => this.subs.forEach((f) => f())); }
  sub(f) { this.subs.add(f); f(); return () => this.subs.delete(f); }
  pub(u) { if (!u) return null; const { pw, ...rest } = u; return rest; }

  async init() {}
  async publicInfo() { return this.db.settings || null; }
  async needsSetup() { return false; }
  onAuth(cb) {
    this.authCb = cb;
    const u = this.db.users[this.db[this.sk]];
    cb(u && u.active !== false ? this.pub(u) : null);
    return () => {};
  }
  async login(username, pw) {
    const u = Object.values(this.db.users).find((x) => x.username === username.trim().toLowerCase());
    if (!u || u.pw !== pw) throw new Error('Kullanıcı adı veya şifre hatalı');
    if (u.active === false) throw new Error(u.pending ? 'Üyelik başvurunuz onay bekliyor. Onaylanınca giriş yapabilirsiniz.' : 'Hesabınız pasif. Lütfen dükkanla iletişime geçin.');
    this.db[this.sk] = u.uid; this.persist();
    this.authCb?.(this.pub(u));
  }
  async signup({ username, password, name, shop, phone }) {
    if (Object.values(this.db.users).some((u) => u.username === username)) throw new Error('Bu kullanıcı adı alınmış, başka bir tane deneyin.');
    const uid = 'u_' + rid();
    this.db.users[uid] = { uid, username, pw: password, name, shop, phone, role: 'customer', active: false, pending: true, tier: '', createdAt: now(), stats: { done: 0, noshow: 0 } };
    this.persist();
  }
  async logout() { this.db[this.sk] = null; this.persist(); this.authCb?.(null); }
  async reset() { this.db = freshDb(this.seed); this.persist(); location.reload(); }

  async loadSettings() { return this.db.settings; }
  async saveSettings(s) { this.db.settings = s; this.persist(); }

  async loadCatalog() { return this.db.catalog; }
  async saveCatalog(items) { this.db.catalog = items.map((p) => { const o = {}; for (const k in p) if (!k.startsWith('_')) o[k] = p[k]; return o; }); this.db.catalogVersion = now(); if (!ls.set(KEY, this.db)) console.warn('localStorage dolu'); this.emit(); }
  async getDesc(id) {
    const e = this.db.descEdits || {};
    if (e[id] != null) return e[id];
    this._d = this._d || (await this.loadDescs());
    return this._d[id] || '';
  }
  async hasDescs() { return true; }
  async saveDescs(map) { this._d = { ...(this._d || (await this.loadDescs())), ...map }; this.db.descEdits = {}; this.persist(); }
  async setDesc(id, html) { (this.db.descEdits = this.db.descEdits || {})[id] = html || ''; this.persist(); }
  async getImage(id) { return this.db.images[id] || null; }
  async setImage(id, data) { if (data) this.db.images[id] = data; else delete this.db.images[id]; this.persist(); }

  async me() { return this.pub(this.db.users[this.db[this.sk]]); }
  async updateMe(patch) { const u = this.db.users[this.db[this.sk]]; Object.assign(u, patch); this.persist(); this.authCb?.(this.pub(u)); }
  watchUsers(cb) { return this.sub(() => cb(Object.values(this.db.users).filter((u) => u.role !== 'admin').map((u) => this.pub(u)))); }
  async createUser({ username, password, ...rest }) {
    if (Object.values(this.db.users).some((u) => u.username === username)) throw new Error('Bu kullanıcı adı zaten var');
    const uid = 'u_' + rid();
    this.db.users[uid] = { uid, username, pw: password, role: 'customer', active: true, createdAt: now(), stats: { done: 0, noshow: 0 }, ...rest };
    this.persist(); return uid;
  }
  async updateUser(uid, patch) {
    const { password, ...rest } = patch;
    Object.assign(this.db.users[uid], rest);
    if (password) this.db.users[uid].pw = password;
    this.persist();
  }
  async bumpStat(uid, key, d) { const u = this.db.users[uid]; if (!u) return; u.stats = u.stats || {}; u.stats[key] = (u.stats[key] || 0) + d; this.persist(); }
  async getNote(uid) { return this.db.notes[uid] || ''; }
  async setNote(uid, t) { this.db.notes[uid] = t; this.persist(); }
  async getUserPrices(uid) { return this.db.userPrices[uid] || {}; }
  async setUserPrices(uid, map) { this.db.userPrices[uid] = map; this.persist(); }

  watchRequests(user, cb) {
    return this.sub(() => {
      let list = Object.values(this.db.requests);
      if (user.role !== 'admin') list = list.filter((r) => r.uid === user.uid);
      cb(list.sort((a, b) => b.updatedAt - a.updatedAt).map((r) => ({ ...r })));
    });
  }
  async createRequest(req, msgs) {
    const id = 'r_' + rid();
    this.db.requests[id] = { ...req, id, no: id.slice(2, 6).toUpperCase() };
    this.db.messages[id] = msgs.map((m) => ({ id: rid(), ...m }));
    this.persist(); return id;
  }
  async loadPublicCatalog() { return this.db.catalog.filter((p) => p.a).map(({ w, t, ...p }) => p); }
  async hasPublicCatalog() { return true; }
  async savePublicCatalog() {}
  async getRequest(id) { return this.db.requests[id] ? { ...this.db.requests[id] } : null; }
  watchRequest(id, cb) { return this.sub(() => cb(this.db.requests[id] ? { ...this.db.requests[id] } : null)); }
  async updateRequest(id, patch) { Object.assign(this.db.requests[id], patch); this.persist(); }
  watchMessages(id, cb) { return this.sub(() => cb([...(this.db.messages[id] || [])])); }
  async sendMessage(id, msg, patch = {}, notify) {
    (this.db.messages[id] = this.db.messages[id] || []).push({ id: rid(), ...msg });
    const r = this.db.requests[id];
    const to = notify || (msg.from === 'user' ? 'admin' : msg.from === 'admin' ? 'user' : null);
    const unread = to === 'admin' ? { unreadAdmin: (r.unreadAdmin || 0) + 1 } : to === 'user' ? { unreadUser: (r.unreadUser || 0) + 1 } : {};
    Object.assign(r, { updatedAt: msg.at, ...(msg.from !== 'system' ? { lastMsg: msg.text, lastFrom: msg.from } : {}), ...unread, ...patch });
    this.persist();
  }
}
