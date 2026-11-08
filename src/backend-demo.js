// DEMO veri katmanı: her şey bu tarayıcıda (localStorage) tutulur.
import { stencilKeys } from './kalip.js';
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
  async publicInfo() { const st = this.db.settings; if (st && !st.look?.site) st.look = { ...(st.look || {}), site: 'apple' }; return st || { pricing: { showTL: true, showVatInc: true, plusVat: true }, look: { site: 'apple' } }; }
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

  // demo: kartlarda TL ve KDV dahil satırları canlıdaki gibi açık gelsin (kaydedilmiş demo ayarı yoksa)
  async loadSettings() { const st = this.db.settings; if (st && !st.look?.site) st.look = { ...(st.look || {}), site: 'apple' }; return st || { pricing: { showTL: true, showVatInc: true, plusVat: true }, look: { site: 'apple' } }; }
  async saveSettings(s) { this.db.settings = s; this.persist(); }

  async loadCatalog() { return this.db.catalog; }
  async markDeleted() {}
  // demo: yüklemeler bu oturumda bellekte (resim data URL, video blob URL)
  async uploadVideo(file, onProg, h) { onProg?.(1); const ref = URL.createObjectURL(file); (this._ups = this._ups || []).unshift({ ref, v: true, t: Date.now(), s: file.size, h }); return ref; }
  async uploadImage(big, th, h) { const ref = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(big); }); (this._ups = this._ups || []).unshift({ ref, v: false, t: Date.now(), s: big.size, h }); return ref; }
  async findUpload(h) { return (this._ups || []).find((x) => x.h && x.h === h)?.ref || null; }
  async listUploads() { return { items: this._ups || [], cursor: null }; }
  // demo: Akıllı ürün ekle — gerçek yapay zekâ yok, örnek taslak (canlıda bekçi /ai/draft)
  async aiDraft({ name }) {
    await new Promise((r) => setTimeout(r, 1800));
    const q = String(name || '').trim(); const up = q.toUpperCase();
    const brand = /2UUL/.test(up) ? '2UUL' : (q.split(/\s+/)[0] || '').toUpperCase();
    const model = (up.replace(brand, '').replace(/\s+/g, '').match(/[A-Z]+\d+[A-Z]*/) || [''])[0];
    const png = (t, c, w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; const g = x.createLinearGradient(0, 0, /2/.test(t) ? w : 0, /3/.test(t) ? 0 : h); g.addColorStop(0, c); g.addColorStop(1, /3/.test(t) ? '#000' : '#fff'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = Math.round(h / 10) + 'px Arial'; x.fillText(t, w * 0.5, h * 0.8); return cv.toDataURL('image/png'); };
    const pic = (t, c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="${c}"/><text x="400" y="420" font-family="Arial" font-size="64" text-anchor="middle" fill="#fff">${t}</text></svg>`);
    return { ok: true, left: 79, draft: {
      q, engine: 'demo', n: `${brand} ${model} Ürün Adı (demo taslak)`, b: brand, model, c: 42, c2: null,
      t: [brand, `${brand} ${model}`, model, model.replace(/(\D)(\d)/, '$1 $2'), model.replace(/(\D)(\d)/, '$1-$2'), 'Telefon Tamir', `${brand} ${model} Fiyat`, `${brand} ${model} Ne İşe Yarar`, `${brand} ${model} Türkiye Satıcısı`].join(','),
      desc: `<p dir="ltr">${brand} ${model}, cep telefonu tamirinde kullanılan … (demo: canlıda yapay zekâ ürünü araştırıp gerçek açıklamayı yazar).</p><p dir="ltr"><strong>Özellikler</strong></p><ul dir="ltr"><li>Örnek özellik</li></ul><p dir="ltr"><strong>Teknik Özellikler</strong></p><table><thead><tr><th scope="col">Özellik</th><th scope="col">Değer</th></tr></thead><tbody><tr><td>Marka / Model</td><td>${brand} ${model}</td></tr></tbody></table>\n<p>&nbsp;</p>\n<img loading="lazy" src="${pic('Tanıtım 1', '#555')}" />\n<img loading="lazy" src="${pic('Tanıtım 2', '#777')}" />`,
      note: 'Demo taslak: canlı sitede ürün web’de araştırılır.',
      // demo: ayıklamayı göstermek için 1 kopya (farklı boyut) + 1 küçük + 1 afiş şeridi de gelir → ekranda 3 resim kalır
      imgs: [png(model || 'Resim 1', '#3b6ea8', 800, 800), png('Resim 2', '#6a8f3b', 900, 900), png(model || 'Resim 1', '#3b6ea8', 1000, 1000), png('küçük', '#999', 200, 200), png('reklam', '#c33', 1600, 300), png('Resim 3', '#a8653b', 800, 800)].map((u) => ({ u, from: brand.toLowerCase() + '.com' })),
      src: [{ url: 'https://' + brand.toLowerCase() + '.com/', title: brand.toLowerCase() + '.com' }],
    } };
  }
  async aiPics() { return []; }
  async aiBal(budget) { if (budget != null) ls.set('demo-aibal', { budget: +budget, spent: 0, n: 0 }); return ls.get('demo-aibal', { budget: 5, spent: 0.31, n: 12 }); }
  async aiPicBlob(u) { return (await fetch(u)).blob(); }
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
  async loadCosts() { return this.db.costs || {}; }
  async saveCosts(map) { this.db.costs = map; this.persist(); }
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
  // ---- Ekip (demo: bu tarayıcıda) — canlıda backend-firebase.js aynı işlevler
  _teamSeed() {
    if (this.db.teamSeeded) return; this.db.teamSeeded = 1;
    const t = now(), H = 3600e3, M = 60e3;
    this.db.users.u_kerem = { uid: 'u_kerem', username: 'kerem', pw: '1234', role: 'admin', staff: true, name: 'Kerem (örnek eleman)', shop: 'Kerem', active: true, createdAt: t - 5 * 24 * H, perm: { orders: true, products: true, prices: false, customers: true } };
    this.db.staffSess = {
      s_demo1: { uid: 'u_kerem', name: 'Kerem (örnek eleman)', dev: { os: 'iPhone', br: 'Safari', pwa: true, kind: 'phone' }, city: 'İstanbul', since: t - 4 * 24 * H, last: t - 12 * M },
      s_demo2: { uid: 'u_kerem', name: 'Kerem (örnek eleman)', dev: { os: 'Windows', br: 'Chrome', pwa: false, kind: 'pc' }, city: 'İstanbul', since: t - 3 * 24 * H, last: t - 20 * H },
      s_demo3: { uid: 'u_admin', name: 'Ertel GSM', dev: { os: 'Mac', br: 'Safari', pwa: false, kind: 'pc' }, city: 'İstanbul', since: t - 9 * 24 * H, last: t - 2 * 24 * H },
    };
    const day = new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    const e = (m, x, k, c, u = 'u_kerem', n = 'Kerem (örnek eleman)', d = 'iPhone · Safari') => ({ t: t - m * M, u, n, d, k, x, c, r: rid().slice(0, 4) });
    this.db.audit = { [day]: [
      e(240, 'Giriş yaptı · İstanbul', 'oturum'),
      e(200, 'Stok: örnek ürün', 'urun', [['Örnek ürün · Stok', '2', '5']]),
      e(150, '3 ürünü açtı / kapattı', 'urun'),
      e(95, 'Fiyat değiştirdi: örnek ürün', 'urun', [['Örnek ürün · Liste fiyatı', '118 $', '124 $']], 'u_admin', 'Ertel GSM', 'Mac · Safari'),
      e(40, 'Bayi talebi B7K2 · Bağcılar GSM (örnek) → Hazır', 'siparis'),
    ].map((x) => { if (!x.c) delete x.c; return x; }) };
    this.persist();
  }
  async teamList() { this._teamSeed(); return Object.values(this.db.users).filter((u) => u.role === 'admin').map((u) => ({ ...this.pub(u), owner: u.uid === 'u_admin' })); }
  async teamCreate({ username, password, name, perm }) {
    const un = String(username || '').trim().toLowerCase();
    if (Object.values(this.db.users).some((u) => u.username === un)) throw new Error('Bu kullanıcı adı zaten var');
    if (String(password || '').length < 6) throw new Error('Şifre en az 6 karakter olmalı');
    const uid = 'u_' + rid();
    this.db.users[uid] = { uid, username: un, pw: password, name, shop: name, role: 'admin', staff: true, perm, active: true, createdAt: now() };
    this.persist(); return uid;
  }
  async teamUpdate(uid, patch) { Object.assign(this.db.users[uid], patch); this.persist(); }
  async teamHello(sid, info) { this._teamSeed(); const S = (this.db.staffSess = this.db.staffSess || {}); S[sid] = { ...(S[sid] || {}), ...info }; this.persist(); }
  async teamDropSess(sid) { if (this.db.staffSess?.[sid]) { delete this.db.staffSess[sid]; this.persist(); } }
  watchSess(sid, cb) { return this.sub(() => cb(this.db.staffSess?.[sid] || null)); }
  watchMe(uid, cb) { return this.sub(() => cb(this.db.users[uid] ? this.pub(this.db.users[uid]) : null)); }
  watchTeamSess(cb) { this._teamSeed(); return this.sub(() => cb(Object.entries(this.db.staffSess || {}).map(([id, x]) => ({ id, ...x })))); }
  async kickSess(sid) { if (this.db.staffSess?.[sid]) { this.db.staffSess[sid].kick = true; this.persist(); } }
  async auditAdd(day, e) { const a = (this.db.audit = this.db.audit || {}); (a[day] = a[day] || []).push(e); const ks = Object.keys(a).sort(); while (ks.length > 30) delete a[ks.shift()]; this.persist(); }
  async auditDay(day) { this._teamSeed(); return (this.db.audit || {})[day] || []; }
  async staffPw(uid, password) { if (String(password || '').length < 6) throw new Error('Şifre en az 6 karakter olmalı'); this.db.users[uid].pw = password; this.persist(); return { ok: true }; }
  async staffRevoke(uid) { Object.keys(this.db.staffSess || {}).forEach((k) => { if (this.db.staffSess[k].uid === uid) this.db.staffSess[k].kick = true; }); this.persist(); return { ok: true }; }
  async geo() { return { c: 'İstanbul' }; }
  async findPending(col, kind) {
    const src = col === 'lcarts' ? Object.entries(this.lc_()).map(([id, x]) => ({ id, ...x })) : col === 'requests' ? Object.values(this.db.requests || {}) : Object.values(this.ord());
    const ok = col === 'orders' ? (x) => (kind === 'unread' ? x.unread : x.status === 'new') : col === 'lcarts' ? (x) => x.status === 'sent' && (kind !== 'unread' || !x.seen) : (x) => (kind === 'unread' ? x.unreadAdmin > 0 : x.status === 'new');
    return src.filter(ok).map((x) => JSON.parse(JSON.stringify(x)));
  }
  async archiveFind(col, q) {
    const t = String(q || '').trim().toLocaleLowerCase('tr'); if (!t) return [];
    const d = t.replace(/\D/g, '');
    const src = col === 'lcarts' ? Object.entries(this.lc_()).map(([id, x]) => ({ id, ...x })) : col === 'requests' ? Object.values(this.db.requests || {}) : Object.values(this.ord());
    const vals = (x) => col === 'orders' ? [x.no, x.contact?.name, x.contact?.phone, x.contact?.email] : col === 'lcarts' ? [x.no, x.name, x.sub?.contact?.name, x.sub?.contact?.phone] : [x.no, x.userName, x.shop];
    return src.filter((x) => vals(x).some((v) => v && (String(v).toLocaleLowerCase('tr') === t || (d.length >= 10 && String(v).replace(/\D/g, '').endsWith(d.slice(-10)))))).map((x) => ({ ...x }));
  }
  // demo: Kullanım sayfası için örnek rapor (canlıda bekçi /usage)
  async usageLive() {
    const H = 3600e3, now = Date.now(), iso = (t) => new Date(t).toISOString().slice(0, 13) + ':00:00Z', sq = (t) => new Date(t).toISOString().slice(0, 13).replace('T', ' ') + ':00:00';
    const shape = (h) => [2, 1, 1, 1, 1, 2, 4, 8, 14, 20, 24, 22, 18, 20, 26, 22, 17, 14, 10, 8, 6, 5, 4, 3][new Date(h).getUTCHours()] / 24;
    const hours = [], cf = [], kv = [], days = [];
    for (let i = 23; i >= 0; i--) { const t = now - i * H, f = shape(t); hours.push({ t: sq(t), s: 'fs', d1: Math.round(1500 * f * 24 / 10), d2: Math.round(60 * f * 2), d3: 0, d4: 0, d5: 0 }, { t: sq(t), s: 'bk', d1: Math.round(400 * f * 2), d2: Math.round(40 * f * 2), d3: Math.round(8 * f), d4: Math.round(25 * f), d5: f > 0.5 ? 1 : 0 }); cf.push({ s: 'ertel-site', t: iso(t), n: Math.round(250 * f * 2) }, { s: 'ertel-b2b-watch', t: iso(t), n: Math.round(400 * f * 2) }); kv.push({ a: 'write', t: iso(t), n: Math.round(25 * f) }); }
    for (let i = 7; i >= 1; i--) { const t = now - i * 24 * H, k = [0.6, 0.7, 0.9, 1.1, 0.8, 1.3, 1][i - 1]; const day = new Date(t).toISOString().slice(0, 10) + ' 00:00:00'; days.push({ t: day, s: 'fs', d1: Math.round(19000 * k), d2: Math.round(1100 * k), d3: 0, d4: 0, d5: 0 }, { t: day, s: 'bk', d1: 0, d2: Math.round(900 * k), d3: Math.round(150 * k), d4: 0, d5: Math.round(9 * k) }); for (let h = 0; h < 24; h += 6) { cf.push({ s: 'ertel-b2b-watch', t: new Date(t + h * H).toISOString().slice(0, 13) + ':00:00Z', n: Math.round(1900 * k) }); kv.push({ a: 'write', t: new Date(t + h * H).toISOString().slice(0, 13) + ':00:00Z', n: Math.round(120 * k) }); } }
    const fs = [
      { a: 'magaza', col: 'pubcatalog', n: '', r: 6100, w: 0, v: 412 }, { a: 'magaza', col: 'settings', n: '', r: 2300, w: 0, v: 0 }, { a: 'magaza', col: 'descb', n: '', r: 900, w: 0, v: 0 }, { a: 'magaza', col: 'members', n: '', r: 300, w: 120, v: 0 },
      { a: 'panel', col: 'orders', n: 'Ertel GSM', r: 2600, w: 40, v: 0 }, { a: 'panel', col: 'members', n: 'Ertel GSM', r: 1100, w: 0, v: 0 }, { a: 'panel', col: 'requests', n: 'Ertel GSM', r: 400, w: 12, v: 0 },
      { a: 'panel', col: 'orders', n: 'Kerem (örnek eleman)', r: 1900, w: 55, v: 0 }, { a: 'panel', col: 'users', n: 'Kerem (örnek eleman)', r: 600, w: 0, v: 0 }, { a: 'panel', col: 'catalog', n: 'Kerem (örnek eleman)', r: 30, w: 14, v: 0 },
      { a: 'bayi', col: 'catalog', n: '', r: 700, w: 0, v: 0 }, { a: 'bayi', col: 'requests', n: '', r: 400, w: 30, v: 0 },
      { a: 'oto', col: 'orders', n: 'Gece yedeği', r: 900, w: 0, v: 1 }, { a: 'oto', col: 'catalog', n: 'Siteyle eşitleme', r: 40, w: 30, v: 1 }, { a: 'oto', col: 'orders', n: 'DHL takip', r: 300, w: 20, v: 1 },
    ];
    const bk = [
      { cat: 'zamanli', d1: 1440, d2: 120, d3: 30, d4: 260, d5: 0 }, { cat: 'order', d1: 60, d2: 300, d3: 60, d4: 120, d5: 9 }, { cat: 'p', d1: 2900, d2: 0, d3: 0, d4: 0, d5: 0 }, { cat: 'rate', d1: 1500, d2: 0, d3: 0, d4: 24, d5: 0 },
      { cat: 'm', d1: 520, d2: 0, d3: 0, d4: 0, d5: 0 }, { cat: 'pub', d1: 300, d2: 280, d3: 0, d4: 30, d5: 0 }, { cat: 'push', d1: 200, d2: 60, d3: 0, d4: 90, d5: 0 }, { cat: 'check', d1: 90, d2: 0, d3: 0, d4: 70, d5: 0 },
    ];
    return { ok: true, at: now, err: [], d1: new Date(now - 24 * H).toISOString(), fs, bk, hours, days, cf, kv };
  }
  async bumpStat(uid, key, d) { const u = this.db.users[uid]; if (!u) return; u.stats = u.stats || {}; u.stats[key] = (u.stats[key] || 0) + d; this.persist(); }
  async getNote(uid) { return this.db.notes[uid] || ''; }
  async setNote(uid, t) { this.db.notes[uid] = t; this.persist(); }
  async getUserPrices(uid) { return this.db.userPrices[uid] || {}; }
  async setUserPrices(uid, map) { this.db.userPrices[uid] = map; this.persist(); }

  watchRequests(user, cb, since = 0) {
    return this.sub(() => {
      let list = Object.values(this.db.requests);
      if (user.role !== 'admin') list = list.filter((r) => r.uid === user.uid);
      else if (since) list = list.filter((r) => (r.updatedAt || 0) >= since);
      cb(list.sort((a, b) => b.updatedAt - a.updatedAt).map((r) => ({ ...r })));
    });
  }
  newRequestId() { return 'r_' + rid(); }
  async createRequest(req, msgs, givenId) {
    const id = givenId || 'r_' + rid();
    this.db.requests[id] = { ...req, id, no: req.no || id.slice(2, 6).toUpperCase() };
    this.db.messages[id] = msgs.map((m) => ({ id: rid(), ...m }));
    this.persist(); return id;
  }
  async saveShopImage(d) { const id = 'si' + rid(); (this.db.shopimg = this.db.shopimg || {})[id] = d; this.persist(); return id; }
  async getShopImage(id) { return this.db.shopimg?.[id] || null; }
  async deleteShopImage(id) { delete this.db.shopimg?.[id]; this.persist(); }
  // ---- Online mağaza üyeleri + siparişleri (demo)
  mem() { return (this.db.members = this.db.members || {}); }
  ord() {
    const o = (this.db.orders = this.db.orders || {});
    // demo: Geçmiş siparişler sayfası boş görünmesin diye bir kez örnek eski siparişler (son 75 gün)
    if (!this.db.ordSeeded) {
      this.db.ordSeeded = 1;
      const names = ['Murat Kaya', 'Elif Demir', 'Ahmet Yılmaz', 'Zeynep Arslan', 'Hasan Çelik', 'Ayşe Şahin', 'Mehmet Öztürk', 'Fatma Aydın', 'Can Polat', 'Emre Koç', 'Seda Kurt', 'Burak Aksoy'];
      const st = ['done', 'done', 'done', 'cancelled', 'done', 'shipped', 'done'];
      const seed = this.seed || [];
      names.forEach((n, i) => {
        const id = 'o_demo' + i, at = now() - (6 + i * 6) * 864e5 - i * 3600e3, p = seed[(i * 37) % Math.max(1, seed.length)] || { id: 1, n: 'Örnek ürün', r: 20, cur: 'USD' };
        const q = 1 + (i % 3);
        o[id] = { id, no: 'D' + (4101 + i), status: st[i % st.length], createdAt: at, updatedAt: at, contact: { name: n + ' (örnek)', phone: '0(532) 400 00 ' + String(10 + i).padStart(2, '0') }, items: [{ id: p.id, n: p.n, k: p.k, qty: q, price: p.r, cur: 'USD' }], total: { USD: Math.round(p.r * q * 100) / 100 }, delivery: { method: 'cargo', addr: { city: 'İstanbul' } } };
      });
      ls.set(KEY, this.db);
    }
    return o;
  }
  onMember(cb) { this.memberCb = cb; const m = this.mem()[this.db.shopSession]; cb(m ? this.pub(m) : null); return () => {}; }
  async usernameFree(n) { return !Object.values(this.mem()).some((m) => m.username === n); }
  async memberSignup({ email, password, name, phone, username, addresses = [], invoice = { type: 'person' } }, keep) {
    if (Object.values(this.mem()).some((m) => m.email === email)) throw new Error('Bu e-posta ile zaten üyelik var. Giriş yapın ya da şifrenizi sıfırlayın.');
    if (username && !(await this.usernameFree(username))) throw new Error('Bu kullanıcı adı alınmış, başka bir tane deneyin.');
    const uid = 'm_' + rid();
    const m = { uid, email, pw: password, name, phone, username, createdAt: now(), addresses, invoice, verified: true }; // demoda e-posta doğrulaması atlanır
    this.mem()[uid] = m; this.persist();
    if (keep) this.db.shopSession = uid;
    return { ...this.pub(m), verifySent: true };
  }
  async adminCreateMember({ email, password, name, phone, username }) {
    if (Object.values(this.mem()).some((m) => m.email === email)) throw new Error('Bu e-posta ile zaten üyelik var.');
    const uid = 'm_' + rid(); const m = { uid, email, pw: password, name, phone, username, createdAt: now(), addresses: [], invoice: { type: 'person' }, byAdmin: true };
    this.mem()[uid] = m; this.persist(); return this.pub(m);
  }
  async memberDone() { this.db.shopSession = null; this.persist(); }
  async memberSocial(kind) { throw new Error((kind === 'facebook' ? 'Facebook' : 'Google') + ' ile giriş sadece canlı sitede çalışır.'); }
  async memberLogin(id, pw) {
    id = String(id).trim().toLowerCase();
    const m = Object.values(this.mem()).find((x) => x.email === id || x.username === id);
    if (!m || m.pw !== pw) throw new Error('E-posta / kullanıcı adı veya şifre hatalı.');
    this.db.shopSession = m.uid; this.persist(); this.memberCb?.(this.pub(m));
  }
  async memberResendVerify(id) { return id; }
  async memberLogout() { this.db.shopSession = null; this.persist(); this.memberCb?.(null); }
  async memberReset(id) { const m = Object.values(this.mem()).find((x) => x.email === id || x.username === id); return m?.email || id; }
  async authCheckReset() { return 'demo@ornek.com'; }
  async authConfirmReset() {}
  async authVerifyEmail() {}
  async saveMember(m) { const o = this.mem()[m.uid]; Object.assign(o, m); this.persist(); this.memberCb?.(this.pub(o)); }
  watchMembers(cb, since = 0) { return this.sub(() => cb(Object.values(this.mem()).filter((m) => !since || (m.createdAt || 0) >= since).map((m) => this.pub(m)))); }
  watchByStatus(col, statuses, cb) { return this.sub(() => cb(Object.entries(col === 'lcarts' ? this.lc_() : {}).map(([id, x]) => ({ id, ...x })).concat(Object.values(col === 'lcarts' ? {} : col === 'orders' ? this.ord() : col === 'preq' ? this.pq() : col === 'issues' ? this.is_() : col === 'reviews' ? this.rv() : this.db.requests)).filter((x) => statuses.includes(x.status)).map((x) => ({ ...x })))); }
  watchUserRequests(uid, cb) { return this.sub(() => cb(Object.values(this.db.requests).filter((r) => r.uid === uid).sort((a, b) => b.updatedAt - a.updatedAt).map((r) => ({ ...r })))); }
  async deleteMember(uid) { delete this.mem()[uid]; this.persist(); }
  newOrderId() { return 'o' + rid() + rid(); }
  async placeOrder(o, id) { id = id || this.newOrderId(); this.ord()[id] = { ...o, id }; this.persist(); return id; }
  watchOrder(id, cb) { return this.sub(() => cb(this.ord()[id] ? { ...this.ord()[id] } : null)); }
  watchMyOrders(uid, cb) { return this.sub(() => cb(Object.values(this.ord()).filter((o) => o.uid === uid).sort((a, b) => b.createdAt - a.createdAt).map((o) => ({ ...o })))); }
  watchFeed(cb) { return this.sub(() => cb(this.db.feed || [])); }
  async findOrderByNo(no) { return Object.values(this.ord()).filter((o) => String(o.no).toUpperCase() === String(no).toUpperCase()).map((o) => ({ ...o })); }
  async findOrdersRange(from, to) { return Object.values(this.ord()).filter((o) => (o.createdAt || 0) >= from && (o.createdAt || 0) < to).sort((a, b) => b.createdAt - a.createdAt).map((o) => ({ ...o })); }
  _rng(col, from, to) { const k = col === 'lcarts' ? 'at' : 'createdAt'; const src = col === 'lcarts' ? Object.entries(this.lc_()).map(([id, x]) => ({ id, ...x })) : Object.values(this.ord()); return src.filter((o) => (o[k] || 0) >= from && (o[k] || 0) < to).sort((a, b) => b[k] - a[k]).map((o) => JSON.parse(JSON.stringify(o))); }
  async findRange(col, from, to) { return this._rng(col, from, to); }
  async countRange(col, from, to) { return this._rng(col, from, to).length; }
  async countOrdersRange(from, to) { return Object.values(this.ord()).filter((o) => (o.createdAt || 0) >= from && (o.createdAt || 0) < to).length; }
  async getUsage() { return { at: Date.now(), read: 1234, write: 210, cfReq: 8000, kvWrite: 120 }; }
  watchOrders(cb, since = 0) { return this.sub(() => cb(Object.values(this.ord()).filter((o) => !since || (o.createdAt || 0) >= since).sort((a, b) => b.createdAt - a.createdAt).map((o) => ({ ...o })))); }
  async updateOrder(id, patch) { Object.assign(this.ord()[id], patch); this.persist(); }
  async deleteOrders(ids) { for (const id of ids) delete this.ord()[id]; this.persist(); }

  // ---- Ürün talebi (demo: fotoğraflar data URL olarak cihazda)
  pq() { return (this.db.preq = this.db.preq || {}); }
  async preqUpload(blobs) {
    const keys = await Promise.all(blobs.map((b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); })));
    return { id: 'q' + rid() + rid(), keys };
  }
  async createPreq(id, doc) { this.pq()[id] = { ...doc, id }; this.persist(); }
  watchMyPreqs(uid, cb) { return this.sub(() => cb(Object.values(this.pq()).filter((x) => x.uid === uid).sort((a, b) => b.createdAt - a.createdAt).map((x) => ({ ...x })))); }
  watchPreqs(cb) { return this.sub(() => cb(Object.values(this.pq()).sort((a, b) => b.createdAt - a.createdAt).map((x) => ({ ...x })))); }
  async updatePreq(id, patch) { Object.assign(this.pq()[id], patch); this.persist(); }
  async replyPreq(id, patch) { return this.updatePreq(id, patch); }
  async deletePreq(id) { delete this.pq()[id]; this.persist(); }
  preqPic(key) { return key; }
  // ---- Sorun bildirimi (demo: dosyalar data URL olarak cihazda)
  is_() { return (this.db.issues = this.db.issues || {}); }
  async issueUpload(imgs, video, onProg) {
    const rd = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
    const files = [...(await Promise.all(imgs.map(rd))).map((k) => ({ k, t: 'i' })), ...(video ? [{ k: await rd(video), t: 'v' }] : [])];
    onProg?.(1); return { id: 'i' + rid() + rid(), files };
  }
  async issueAdminUpload(id, blobs) { const rd = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }); return { files: (await Promise.all(blobs.map(rd))).map((k) => ({ k, t: 'i' })) }; }
  async createIssue(id, doc) { this.is_()[id] = { ...doc, id }; this.persist(); }
  watchMyIssues(uid, cb) { return this.sub(() => cb(Object.values(this.is_()).filter((x) => x.uid === uid).sort((a, b) => b.createdAt - a.createdAt).map((x) => ({ ...x })))); }
  watchIssues(cb) { return this.sub(() => cb(Object.values(this.is_()).sort((a, b) => b.createdAt - a.createdAt).map((x) => ({ ...x })))); }
  async updateIssue(id, patch) { Object.assign(this.is_()[id], patch); this.persist(); }
  async replyIssue(id, patch) { return this.updateIssue(id, patch); }
  async msgIssue(id, patch) { return this.updateIssue(id, patch); }
  async deleteIssue(id) { delete this.is_()[id]; this.persist(); }
  issuePic(key) { return key; }
  // ---- Mağaza özellikleri (demo): popüler verisi katalogdan uydurulur (görünüm denemesi için)
  async getStats() {
    const act = this.db.catalog.filter((p) => p.a && !p.so); const ids = act.map((p) => p.id);
    const pair = {}; ids.slice(0, 200).forEach((id, i) => { pair[id] = [ids[(i + 1) % ids.length], ids[(i + 7) % ids.length], ids[(i + 13) % ids.length], ids[(i + 21) % ids.length]]; });
    const cnt = {}; ids.forEach((id, i) => { if (i % 3 === 0) cnt[id] = 1 + ((i * 7) % 11); });
    return { at: Date.now(), fav: ids.slice(0, 10).map((id, i) => ({ id, n: 48 - i * 4 })), pair, cnt };
  }
  async setWait(uid, pid, on, notify) { const m = this.mem()[uid]; if (m) { m.notify = notify; this.persist(); } }
  rv() { return (this.db.reviews = this.db.reviews || {}); }
  async getRevSum() { const s = {}; for (const r of Object.values(this.rv())) if (r.status === 'pub') { const x = (s[r.pid] = s[r.pid] || [0, 0]); x[0] += r.stars; x[1]++; } for (const k in s) s[k] = [Math.round((s[k][0] / s[k][1]) * 10) / 10, s[k][1]]; return s; }
  async myReviews(uid) { return Object.values(this.rv()).filter((r) => r.uid === uid).map((r) => ({ ...r })); }
  async reviewsOf(pid) { return Object.values(this.rv()).filter((r) => r.pid === pid && r.status === 'pub').sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r })); }
  async createReview(id, doc) { this.rv()[id] = { ...doc, id }; this.persist(); }
  watchReviews(cb) { return this.sub(() => cb(Object.values(this.rv()).sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r })))); }
  async updateReview(id, patch) { Object.assign(this.rv()[id], patch); this.persist(); }
  async deleteReview(id) { delete this.rv()[id]; this.persist(); }
  of_() { return (this.db.oforms = this.db.oforms || {}); }
  watchForms(cb) { return this.sub(() => cb(Object.entries(this.of_()).map(([id, x]) => ({ id, ...x })).sort((a, b) => b.at - a.at))); }
  newFormId() { return 'f' + rid() + rid(); }
  async saveForm(id, data) { this.of_()[id] = data; this.persist(); }
  async deleteForm(id) { delete this.of_()[id]; this.persist(); }
  lc_() { return (this.db.lcarts = this.db.lcarts || {}); }
  newLcartId() { return 'k' + rid() + rid() + rid(); }
  async createLcart(id, data) { this.lc_()[id] = data; this.persist(); }
  watchLcarts(cb, since = 0) { return this.sub(() => cb(Object.entries(this.lc_()).map(([id, x]) => ({ id, ...JSON.parse(JSON.stringify(x)) })).filter((x) => !since || (x.at || 0) >= since).sort((a, b) => b.at - a.at))); }
  async getLcart(id) { const x = this.lc_()[id]; return x && !(x.status === 'open' && x.exp && now() >= x.exp) ? { id, ...JSON.parse(JSON.stringify(x)) } : null; }
  async submitLcart(id, sub) { const x = this.lc_()[id]; if (!x || x.status !== 'open' || (x.exp && now() >= x.exp)) throw new Error('permission: Bu sepet artık açık değil'); Object.assign(x, { status: 'sent', sub, subAt: now() }); this.persist(); }
  async updateLcart(id, patch) { Object.assign(this.lc_()[id], patch); this.persist(); }
  async deleteLcart(id) { delete this.lc_()[id]; this.persist(); }
  pl_() { return (this.db.paylinks = this.db.paylinks || {}); }
  newPaylinkId() { return 'p' + rid() + rid() + rid(); }
  async createPaylink(id, data) { this.pl_()[id] = data; this.persist(); }
  watchPaylinks(cb) { return this.sub(() => cb(Object.entries(this.pl_()).map(([id, x]) => ({ id, ...JSON.parse(JSON.stringify(x)) })).sort((a, b) => b.at - a.at))); }
  async getPaylink(id) { const x = this.pl_()[id]; return x ? { id, ...JSON.parse(JSON.stringify(x)) } : null; }
  async updatePaylink(id, patch) { Object.assign(this.pl_()[id], patch); this.persist(); }
  async deletePaylink(id) { delete this.pl_()[id]; this.persist(); }
  gl_() { return (this.db.gelen = this.db.gelen || { 'demo-da88': { kind: 'urun', st: 'new', at: now() - 3600e3, q: '2uul da88', d: { n: '2UUL DA88 Mini Isıtmalı Pres İstasyonu', b: '2UUL', c: 42, t: 'pres,arka kapak presi,ısıtmalı pres', desc: '<p>Demo taslak: Claude sohbetten bıraktı.</p>', imgs: [], note: 'Demo örneği' } }, 'demo-bnr': { kind: 'banner', st: 'new', at: now() - 7200e3, title: 'Banner önerisi · DA88', sub: 'Yerleşim: right · önizleme hazır', link: 'https://erteltoptan--gelen.web.app' } }); }
  watchGelen(cb) { return this.sub(() => cb(Object.entries(this.gl_()).map(([id, x]) => ({ id, ...JSON.parse(JSON.stringify(x)) })).sort((a, b) => b.at - a.at))); }
  async updateGelen(id, patch) { Object.assign(this.gl_()[id], patch); this.persist(); }
  async deleteLcarts(ids) { for (const id of ids) delete this.lc_()[id]; this.persist(); }
  async syncRevSum() {}
  watchRate(cb) { cb({ usd: 41.95, src: 'harem', at: now() }); return () => {}; }
  async loadPublicCatalog() { return this.db.catalog.filter((p) => p.a).map(({ w, t, ...p }) => { const kc = stencilKeys({ ...p, t }); return kc ? { ...p, kc } : p; }); }
  async hasPublicCatalog() { return true; }
  async savePublicCatalog() {}
  async getRequest(id) { return this.db.requests[id] ? { ...this.db.requests[id] } : null; }
  watchRequest(id, cb) { return this.sub(() => cb(this.db.requests[id] ? { ...this.db.requests[id] } : null)); }
  async deleteRequests(ids) { for (const id of ids) { delete this.db.requests[id]; delete this.db.messages[id]; } this.persist(); }
  async deleteUser(uid, withRequests) {
    if (withRequests) for (const [id, r] of Object.entries(this.db.requests)) if (r.uid === uid) { delete this.db.requests[id]; delete this.db.messages[id]; }
    delete this.db.users[uid]; delete this.db.userPrices[uid]; delete this.db.notes[uid]; this.persist();
  }
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
