// Ekip ve yetkiler (8.11.2026)
// - Asıl yönetici: users/{uid}.role === 'admin' ve staff alanı YOK (meta/owner). Her şeyi yapar, kimse onu kısıtlayamaz.
// - Ekip üyesi: role 'admin' + staff: true + perm {anahtar: true/false}. Panelde her şeyi GÖRÜR; perm sadece değiştirmeyi sınırlar.
// - Yetki kontrolü merkezde: guardApi() veri katmanının yazan işlevlerini sarar (ekranda düğme gizlenmese de yetkisiz yazma olmaz).
// - Geçmiş: audit/{gün} belgesine (TR tarihi) arrayUnion ile tek yazma; sadece Ekip › Geçmiş açılınca okunur.
// - Ürün kaydı ezme düzeltmesi: saveCatalog artık temel aldığı listeyle farkı çıkarır, EN GÜNCEL listenin üstüne sadece kendi
//   değişikliklerini (ürün + alan bazında) uygular → aynı anda çalışan iki kişi birbirinin stok/fiyat değişikliğini geri almaz.
import { store, toast, setCatalog, normProd } from './store.js';
import { ORDER_STATUS, STATUS } from './config.js';
import { ls } from './utils.js';

// [anahtar, ad, açıklama, varsayılan, grup]  g = günlük işler, r = bozulabilecek yerler, k = kritik
export const PERMS = [
  ['orders', 'Siparişleri yönetme', 'Durum, kargo no, not, iptal · bayi talepleri, mesajlar, sepet linkleri', true, 'g'],
  ['products', 'Ürün aç / kapat, stok ve düzenleme', 'Aktif / pasif, stok, ad, resim, açıklama, yeni ürün', true, 'g'],
  ['prices', 'Ürün fiyatları', 'Liste, toptan ve set fiyatları', true, 'g'],
  ['customers', 'Müşteri ve bayi işlemleri', 'Bayi onaylama, kişiye özel fiyat, not, talepler, yorumlar', true, 'g'],
  ['design', 'Mağaza tasarımı', 'Tasarım modu, bannerlar, renkler, markalar, ürün kartları', false, 'r'],
  ['settings', 'Ayarlar', 'Dükkan bilgileri, fiyat kuralları, KDV, kargo, kategoriler, özellikler', false, 'r'],
  ['quota', 'Veri ve kota', 'Panelin kaç günlük kayıt yüklediği, yeni üye penceresi', false, 'k'],
  ['backup', 'Yedekler ve geri yükleme', 'Yedekleri indirme, eski hâline döndürme', false, 'k'],
  ['pay', 'Ödeme ve bildirim bağlantıları', 'Havale / kart seçenekleri, Telegram, e-posta, bildirim metinleri', false, 'k'],
  ['bulk', 'Toplu işlemler', 'Excel’den ürün yükleme, site eşitleme ayarları, toplu silme', false, 'k'],
  ['team', 'Ekip', 'Kişi ekleme, yetki verme, cihazlar, geçmiş · senin hesabına dokunamaz', false, 'k'],
];
export const PERM_GROUPS = [['g', 'Günlük işler'], ['r', 'Bozulabilecek yerler'], ['k', 'Kritik yerler']];
export const PERM_LABEL = Object.fromEntries(PERMS.map((p) => [p[0], p[1]]));
export const defaultPerm = () => Object.fromEntries(PERMS.map((p) => [p[0], p[3]]));
// hazır şablonlar (tek dokunuşla doldurur)
export const PERM_TPL = [
  ['Sipariş hazırlayıcı', { orders: true, products: true, prices: false, customers: true }],
  ['Ürün sorumlusu', { orders: true, products: true, prices: true, customers: true }],
  ['Geniş yetki', Object.fromEntries(PERMS.map((p) => [p[0], p[0] !== 'team']))],
];

export const isStaff = (u = store.s.user) => !!u && u.role === 'admin' && u.staff === true;
export const isOwner = (u = store.s.user) => !!u && u.role === 'admin' && u.staff !== true;
export function can(k, u = store.s.user) {
  if (!u || u.role !== 'admin') return false;
  if (u.staff !== true) return true;
  return !!(u.perm || {})[k];
}
export const NOPERM = 'Bu işlem için yetkin yok';
export function needPerm(k, what) {
  if (can(k)) return true;
  toast((what ? what + ': ' : '') + NOPERM.toLowerCase() + ' (' + PERM_LABEL[k] + ')', 'bad');
  return false;
}

// Ayarlar bölümü → gereken yetki ('hesap' herkes; listede olmayan = 'settings')
const SEC_PERM = { magazaana: 'design', markalar: 'design', gorunum: 'design', kart: 'design', tema: 'design', odeme: 'pay', bildirim: 'pay', kota: ['quota', 'backup'], veri: 'bulk', ekip: 'team', hesap: null };
export function secPerm(k) { return k in SEC_PERM ? SEC_PERM[k] : 'settings'; }
export function secOK(k, u) { const p = secPerm(k); if (p == null) return true; return Array.isArray(p) ? p.some((x) => can(x, u)) : can(p, u); }

// ---- cihaz bilgisi
export function devInfo() {
  const ua = navigator.userAgent || '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Cihaz';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /OPR\//.test(ua) ? 'Opera' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  let pwa = false; try { pwa = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch {}
  const kind = /iPhone|Android.*Mobile/.test(ua) ? 'phone' : /iPad|Android/.test(ua) ? 'tablet' : 'pc';
  return { os, br, pwa, kind };
}
export const devText = (d) => (d ? [d.os, d.br].filter(Boolean).join(' · ') + (d.pwa ? ' (ana ekran uygulaması)' : '') : '');
export function sessId() { let s = ls.get('team-sid', ''); if (!s) { s = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); ls.set('team-sid', s); } return s; }

// ---- geçmiş
export const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }); // 2026-11-08
let A0 = null; // sarılmamış veri katmanı
export function audit(k, x, c) {
  const u = store.s.user; if (!u || u.role !== 'admin' || !A0?.auditAdd) return;
  const d = devInfo();
  const e = { t: Date.now(), u: u.uid, n: u.name || u.username || '', d: d.os + (d.br ? ' · ' + d.br : ''), k, x: String(x).slice(0, 300), r: Math.random().toString(36).slice(2, 6) };
  if (c && c.length) e.c = c.slice(0, 25).map((r) => r.map((v) => (v == null ? '' : String(v).slice(0, 80))));
  A0.auditAdd(dayKey(e.t), e).catch((er) => console.warn('geçmiş', er));
}

// ---- oturum: cihazı kaydet, "Çıkar"/"Engelle"yi dinle, yetki değişikliğini anında uygula
let sessUn = [];
export function startTeamSession(u, A) {
  stopTeamSession();
  if (!u || u.role !== 'admin' || !A0?.teamHello) return;
  const sid = sessId();
  let city = ls.get('team-city', null);
  const hello = () => {
    const info = { uid: u.uid, name: u.name || u.username || '', dev: devInfo(), city: city?.c || '', last: Date.now(), kick: false };
    const sk = 'team-since-' + u.uid; if (!ls.get(sk, 0)) { info.since = info.last; ls.set(sk, info.last); }
    return A0.teamHello(sid, info).catch((e) => console.warn('oturum', e));
  };
  const geo = A0.geo ? A0.geo().then((g) => { if (g?.c) { city = { c: g.c, at: Date.now() }; ls.set('team-city', city); } }).catch(() => {}) : Promise.resolve();
  // şehir en çok 2,5 sn beklenir (sonra şehirsiz yazılır, bir sonraki açılışta gelir)
  Promise.race([geo, new Promise((r) => setTimeout(r, 2500))]).then(() => { hello(); let j = false; try { j = sessionStorage.getItem('team-justin') === '1'; sessionStorage.removeItem('team-justin'); } catch {} if (j && store.s.user?.uid === u.uid) audit('oturum', 'Giriş yaptı' + (city?.c ? ' · ' + city.c : '')); });
  let lastHello = Date.now();
  const vis = () => { if (document.visibilityState === 'visible' && Date.now() - lastHello > 3600e3) { lastHello = Date.now(); hello(); } };
  document.addEventListener('visibilitychange', vis);
  sessUn.push(() => document.removeEventListener('visibilitychange', vis));
  if (A0.watchSess) sessUn.push(A0.watchSess(sid, (s) => { if (s && s.kick) out('Bu cihazdan çıkış yapıldı (asıl yönetici).', true); }));
  if (A0.watchMe) sessUn.push(A0.watchMe(u.uid, (m) => {
    if (!m) return;
    if (m.active === false) { out('Hesabın engellendi. Asıl yöneticiyle görüş.', false); return; }
    const cur = store.s.user; if (!cur) return;
    if (JSON.stringify(cur.perm || null) !== JSON.stringify(m.perm || null) || cur.name !== m.name) {
      store.set({ user: { ...cur, perm: m.perm, name: m.name } });
      if (cur.perm && isStaff(cur)) toast('Yetkilerin güncellendi');
    }
  }));
  async function out(msg, dropSess) {
    stopTeamSession();
    if (dropSess) await A0.teamDropSess?.(sid).catch(() => {});
    try { ls.set('team-out', msg); } catch {}
    await A.logout().catch(() => {});
  }
}
export function stopTeamSession() { sessUn.forEach((f) => { try { f(); } catch {} }); sessUn = []; }
// çıkışta bu cihazın oturum kaydı silinir (Ekip › cihazlar listesinde kalmasın)
export async function teamLogoutCleanup() { stopTeamSession(); try { await A0?.teamDropSess?.(sessId()); } catch {} }

// ---- veri katmanını sar: yetki kontrolü + geçmiş + ezme düzeltmesi
const strip = (p) => { const o = {}; for (const k in p) if (k[0] !== '_') o[k] = p[k]; return o; };
const J = (v) => (v === undefined ? '' : JSON.stringify(v));
const PRICE_K = new Set(['r', 'w']);
const FIELD_L = { r: 'Liste fiyatı', w: 'Toptan fiyat', s: 'Stok', a: 'Aktif', n: 'Ad', b: 'Marka', c: 'Kategori', c2: 'Alt kategori', pi: 'Resim', im: 'Resimler', t: 'Etiket', k: 'Stok kodu', so: 'Sitede yok', pc: 'Fiyat uyarısı', nw: 'Yeni', cur: 'Para birimi' };
const fv = (k, v) => (v == null || v === '' ? '—' : k === 'a' ? (v ? 'açık' : 'kapalı') : k === 'r' || k === 'w' ? v + ' $' : Array.isArray(v) ? v.length + ' adet' : typeof v === 'object' ? '…' : v);

let base = null; // Map(id → ürün) — en son sunucudan okunan / bizim yazdığımız liste
const setBase = (items) => { if (Array.isArray(items)) base = new Map(items.map((p) => [p.id, strip(normProd(p))])); };
let sBase = null; // ayarlar (son okunan / yazılan)

function diffCat(b, items) {
  const ch = []; const seen = new Set();
  for (const p0 of items) {
    const p = strip(p0); seen.add(p.id); const o = b.get(p.id);
    if (!o) { ch.push({ id: p.id, add: p }); continue; }
    const f = {};
    for (const k of new Set([...Object.keys(o), ...Object.keys(p)])) if (J(o[k]) !== J(p[k])) f[k] = [o[k], p[k]];
    if (Object.keys(f).length) ch.push({ id: p.id, f });
  }
  for (const [id, o] of b) if (!seen.has(id)) ch.push({ id, del: o });
  return ch;
}
function applyCat(latest, ch) {
  const m = new Map(latest.map((p) => [p.id, { ...strip(p) }]));
  for (const c of ch) {
    if (c.del) { m.delete(c.id); continue; }
    if (c.add) { if (!m.has(c.id)) m.set(c.id, c.add); continue; }
    const p = m.get(c.id); if (!p) continue; // biz düzenlerken başkası sildi → silinmiş kalsın
    for (const k in c.f) { const v = c.f[k][1]; if (v === undefined) delete p[k]; else p[k] = v; }
  }
  return [...m.values()];
}
function catAudit(ch) {
  if (!ch.length) return;
  const nm = (c) => (c.add || c.del || base?.get(c.id) || {}).n || '#' + c.id;
  const adds = ch.filter((c) => c.add), dels = ch.filter((c) => c.del), eds = ch.filter((c) => c.f);
  if (adds.length) audit('urun', adds.length === 1 ? 'Ürün ekledi: ' + nm(adds[0]) : adds.length + ' ürün ekledi', adds.slice(0, 10).map((c) => [nm(c)]));
  if (dels.length) audit('urun', dels.length === 1 ? 'Ürün sildi: ' + nm(dels[0]) : dels.length + ' ürün sildi', dels.slice(0, 10).map((c) => [nm(c)]));
  if (!eds.length) return;
  const keys = (c) => Object.keys(c.f).filter((k) => !['ut', 'ur', '_v'].includes(k));
  const only = (set) => eds.every((c) => keys(c).every((k) => set.includes(k)));
  const rows = (lim) => eds.slice(0, lim).flatMap((c) => keys(c).slice(0, 4).map((k) => [nm(c) + ' · ' + (FIELD_L[k] || k), fv(k, c.f[k][0]), fv(k, c.f[k][1])]));
  let x;
  if (eds.length === 1) { const ks = keys(eds[0]); x = (ks.some((k) => PRICE_K.has(k)) ? 'Fiyat değiştirdi: ' : ks.length === 1 && ks[0] === 's' ? 'Stok: ' : ks.length === 1 && ks[0] === 'a' ? (eds[0].f.a[1] ? 'Ürünü açtı: ' : 'Ürünü kapattı: ') : 'Ürünü düzenledi: ') + nm(eds[0]); }
  else x = only(['a']) ? eds.length + ' ürünü açtı / kapattı' : only(['s']) ? eds.length + ' ürünün stoğunu değiştirdi' : only(['r', 'w', 'pc']) ? eds.length + ' ürünün fiyatını değiştirdi' : eds.length + ' ürünü düzenledi';
  audit('urun', x, rows(12));
}

// ayar yolu → yetki
const PAY_PATHS = new Set(['orders.payHavale', 'orders.storeCard', 'orders.inst', 'orders.payCard', 'orders.cardSoon', 'orders.payShop', 'shop.payInfo', 'shop.ibans', 'orders.push', 'orders.pushTexts', 'orders.doneNote']);
const DESIGN_K = new Set(['look', 'shopHome', 'brandLogos', 'cards', 'home']);
const PROD_K = new Set(['sets', 'setLook', 'categories', 'kalip', 'seoText', 'feat']);
const SET_L = { look: 'Görünüm', shopHome: 'Mağaza ana sayfası', brandLogos: 'Markalar', cards: 'Ürün kartları', home: 'Bayi ana sayfası', brand: 'Logo ve renkler', pricing: 'Fiyat ve KDV', orders: 'Sipariş ayarları', shop: 'Dükkan bilgileri', quota: 'Veri ve kota', catalog: 'Katalog', categories: 'Kategoriler', sets: 'Setler', kalip: 'Kalıp bulucu', footer: 'Alt bilgi', legal: 'Yasal metinler', feat: 'Mağaza özellikleri', tiers: 'Kademeler', requests: 'Talepler', access: 'Üyelik / erişim', seoText: 'Google yazıları', preq: 'Ürün talebi', issue: 'Sorun bildirimi', features: 'Bayi özellikleri' };
function setPaths(a, b) {
  const out = []; a = a || {}; b = b || {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (J(a[k]) === J(b[k])) continue;
    if ((k === 'orders' || k === 'shop') && a[k] && b[k] && typeof a[k] === 'object') { for (const k2 of new Set([...Object.keys(a[k]), ...Object.keys(b[k])])) if (J(a[k][k2]) !== J(b[k][k2])) out.push(k + '.' + k2); }
    else out.push(k);
  }
  return out;
}
const stripPP = (sets) => J((sets || []).map((s) => ({ ...s, items: (s.items || []).map(({ pp, ...i }) => i) })));
function pathPerm(p, a, b) {
  if (PAY_PATHS.has(p)) return ['pay'];
  if (p === 'orders.packages' || p === 'orders.carriers') return ['orders', 'settings'];
  if (p === 'quota') return ['quota'];
  if (DESIGN_K.has(p)) return ['design'];
  if (p === 'sets') return stripPP(a?.sets) === stripPP(b?.sets) ? ['prices'] : ['products', 'settings'];
  if (PROD_K.has(p)) return ['products', 'settings'];
  if (p === 'brand') return ['design', 'settings'];
  return ['settings'];
}
const IGNORE_SET = new Set(['v', 'seedVersion', 'updatedAt']);

const ORD_FREE = new Set(['unread', 'dhl']); // otomatik (okundu, DHL takip) → yetki/geçmiş yok
const W = {
  orders: ['deleteOrders', 'updateRequest', 'sendMessage', 'deleteRequests', 'createLcart', 'updateLcart', 'deleteLcart', 'deleteLcarts', 'createPaylink', 'updatePaylink', 'deletePaylink', 'saveForm', 'deleteForm'],
  products: ['saveDescs', 'setDesc', 'setImage', 'markDeleted', 'updateGelen', 'uploadImage', 'uploadVideo', 'saveCosts'],
  customers: ['createUser', 'updateUser', 'deleteUser', 'setUserPrices', 'setNote', 'adminCreateMember', 'deleteMember', 'updatePreq', 'replyPreq', 'deletePreq', 'updateIssue', 'replyIssue', 'msgIssue', 'deleteIssue', 'updateReview', 'deleteReview'],
  design: ['saveShopImage', 'deleteShopImage'],
};
const ordNo = (id) => { const o = (store.s.orders || []).find((x) => x.id === id); return o ? '#' + (o.no || id.slice(-5)) : '#' + String(id).slice(-5); };
const reqNo = (id) => { const r = (store.s.requests || []).find((x) => x.id === id); return r ? (r.no || id.slice(-4)) + (r.shop ? ' · ' + r.shop : '') : String(id).slice(-4); };
const custName = (uid) => { const c = (store.s.customers || []).find((x) => x.uid === uid); return c ? c.name || c.username : uid; };

export function guardApi(A) {
  if (A.__team) return A; A.__team = true; A0 = Object.create(A); // A0: sarılmamış işlevler
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(A))) if (typeof A[k] === 'function' && k !== 'constructor') A0[k] = A[k].bind(A);
  const deny = (perm) => { const e = new Error(NOPERM + ' (' + PERM_LABEL[perm] + ')'); e.noperm = true; toast(e.message, 'bad'); return Promise.reject(e); };
  const wrap = (name, perm, log) => {
    if (typeof A[name] !== 'function') return;
    const f = A0[name];
    A[name] = async (...a) => { if (!can(perm)) return deny(perm); const r = await f(...a); try { log?.(...a); } catch {} return r; };
  };
  for (const [perm, names] of Object.entries(W)) for (const n of names) wrap(n, perm, LOG[n]);
  if (A.logout) A.logout = async (...a) => { try { await Promise.race([teamLogoutCleanup(), new Promise((r) => setTimeout(r, 2500))]); } catch {} return A0.logout(...a); };
  if (A.login) A.login = async (...a) => { try { sessionStorage.setItem('team-justin', '1'); } catch {} return A0.login(...a); };

  // sipariş: okundu / DHL takip güncellemesi serbest
  if (A.updateOrder) A.updateOrder = async (id, patch) => {
    const ks = Object.keys(patch || {}); const free = ks.every((k) => ORD_FREE.has(k));
    if (!free && !can('orders')) return deny('orders');
    const r = await A0.updateOrder(id, patch);
    if (!free) try { ordLog(id, patch); } catch {}
    return r;
  };
  // katalog: fark → yetki → en güncel listenin üstüne uygula
  if (A.loadCatalog) A.loadCatalog = async (...a) => { const r = await A0.loadCatalog(...a); setBase(r); return r; };
  if (A.cachedCatalog) A.cachedCatalog = async (pub) => { const r = await A0.cachedCatalog(pub); if (!pub && r?.items && !base) setBase(r.items); return r; };
  if (A.watchCatalog) A.watchCatalog = (cb, pub) => A0.watchCatalog((items) => { if (!pub) setBase(items); cb(items); }, pub);
  if (A.saveCatalog) A.saveCatalog = async (items) => {
    if (!base || !store.s.user) { const r = await A0.saveCatalog(items); setBase(items); return r; }
    const all = diffCat(base, items);
    if (!all.length) return;
    let ch = all, denied = '';
    // yetkisiz kısımlar kaydedilmez ve ekranda geri alınır
    if (!can('products')) { ch = ch.filter((c) => c.f && Object.keys(c.f).every((k) => PRICE_K.has(k))); if (ch.length !== all.length) denied = 'products'; }
    if (!can('prices')) {
      if (ch.some((c) => c.f && Object.keys(c.f).some((k) => PRICE_K.has(k)))) denied = denied || 'prices';
      ch = ch.map((c) => { if (!c.f) return c; const f = {}; for (const k in c.f) if (!PRICE_K.has(k)) f[k] = c.f[k]; return Object.keys(f).length ? { ...c, f } : null; }).filter(Boolean);
    }
    if (!can('bulk') && ch.filter((c) => c.del).length > 1) { ch = ch.filter((c) => !c.del); denied = denied || 'bulk'; }
    if (denied) toast((denied === 'prices' ? 'Fiyat değişikliği' : denied === 'bulk' ? 'Toplu silme' : 'Ürün değişikliği') + ' kaydedilmedi, geri alındı: ' + NOPERM.toLowerCase() + ' (' + PERM_LABEL[denied] + ')' + (ch.length ? ' · diğer değişiklikler kaydedildi' : ''), 'bad');
    let latest = null;
    if (ch.length) { try { latest = await A0.loadCatalog(); } catch (e) { console.warn('güncel katalog okunamadı', e); } }
    const merged = applyCat(latest && latest.length ? latest : [...base.values()], ch);
    if (ch.length) await A0.saveCatalog(merged);
    setBase(merged);
    // ekran: başkasının arada yaptığı değişiklikler + bizim kaydedilen değişikliklerimiz
    const shown = new Map((store.s.catalog || []).map((p) => [p.id, p]));
    const same = merged.length === shown.size && merged.every((p) => { const x = shown.get(p.id); return x && Object.keys(p).every((k) => J(p[k]) === J(x[k])); });
    if (!same) setCatalog(merged);
    try { catAudit(ch); } catch {}
  };
  // ayarlar: değişen bölümlerin yetkisi
  if (A.loadSettings) A.loadSettings = async (...a) => { const r = await A0.loadSettings(...a); sBase = r ? structuredClone(r) : sBase; return r; };
  if (A.saveSettings) A.saveSettings = async (S) => {
    const ps = setPaths(sBase, S).filter((p) => !IGNORE_SET.has(p));
    if (sBase && !ps.length) return;
    const bad = sBase ? ps.filter((p) => !pathPerm(p, sBase, S).some((x) => can(x))) : (isStaff() ? ['?'] : []);
    if (bad.length) {
      const need = sBase ? PERM_LABEL[pathPerm(bad[0], sBase, S)[0]] : 'Ayarlar';
      toast('Ayar kaydedilmedi: ' + NOPERM.toLowerCase() + ' (' + need + ')', 'bad');
      if (sBase) { const back = structuredClone(S); for (const p of bad) { const [k, k2] = p.split('.'); if (k2) { back[k] = back[k] || {}; if (sBase[k]?.[k2] === undefined) delete back[k][k2]; else back[k][k2] = structuredClone(sBase[k][k2]); } else if (sBase[k] === undefined) delete back[k]; else back[k] = structuredClone(sBase[k]); } store.set({ settings: back }); if (!ps.some((p) => !bad.includes(p))) return; S = back; }
      else return;
    }
    const r = await A0.saveSettings(S);
    const prev = sBase; sBase = structuredClone(S);
    if (prev) try { const names = [...new Set(ps.filter((p) => !bad.includes(p)).map((p) => SET_L[p.split('.')[0]] || p.split('.')[0]))]; if (names.length) audit('ayar', 'Ayar değiştirdi: ' + names.slice(0, 6).join(', ') + (names.length > 6 ? ' …' : '')); } catch {}
    return r;
  };
  return A;
}
function ordLog(id, patch) {
  if (patch.status) return audit('siparis', 'Sipariş ' + ordNo(id) + ' → ' + (ORDER_STATUS[patch.status]?.label || patch.status));
  if (patch.cargo) return audit('siparis', 'Sipariş ' + ordNo(id) + ' · kargo bilgisi' + (patch.cargo.code ? ': ' + (patch.cargo.firm || patch.cargo.carrier || '') + ' ' + patch.cargo.code : ''));
  if ('adminNote' in patch) return audit('siparis', 'Sipariş ' + ordNo(id) + ' · not: ' + (patch.adminNote || '(silindi)'));
  audit('siparis', 'Sipariş ' + ordNo(id) + ' güncellendi');
}
const LOG = {
  deleteOrders: (ids) => audit('siparis', ids.length === 1 ? 'Sipariş sildi: ' + ordNo(ids[0]) : ids.length + ' sipariş sildi'),
  updateRequest: (id, p) => p?.status && audit('siparis', 'Bayi talebi ' + reqNo(id) + ' → ' + (STATUS[p.status]?.label || p.status)),
  sendMessage: (id, msg) => msg?.from === 'admin' && audit('siparis', 'Bayi talebine mesaj: ' + reqNo(id), [[String(msg.text || '').slice(0, 80)]]),
  deleteRequests: (ids) => audit('siparis', ids.length + ' bayi talebi sildi'),
  createLcart: () => audit('siparis', 'Sepet linki oluşturdu'),
  deleteLcarts: (ids) => audit('siparis', (ids?.length || 1) + ' sepet linki sildi'),
  createUser: (u) => audit('musteri', 'Bayi ekledi: ' + (u?.name || u?.username || '')),
  updateUser: (uid, p) => { if (!p) return; const ks = Object.keys(p).filter((k) => k !== 'updatedAt'); if (!ks.length || (ks.length === 1 && ks[0] === 'stats')) return; audit('musteri', ('active' in p ? (p.active ? 'Bayi hesabını açtı: ' : 'Bayi hesabını kapattı: ') : 'Bayiyi düzenledi: ') + custName(uid)); },
  deleteUser: (uid) => audit('musteri', 'Bayi sildi: ' + custName(uid)),
  setUserPrices: (uid) => audit('musteri', 'Kişiye özel fiyat: ' + custName(uid)),
  deleteMember: () => audit('musteri', 'Mağaza üyesi sildi'),
  saveDescs: () => audit('urun', 'Ürün açıklamalarını güncelledi'),
  setDesc: (id) => audit('urun', 'Ürün açıklaması: ' + (base?.get(id)?.n || '#' + id)),
  saveShopImage: () => audit('ayar', 'Mağaza resmi yükledi'),
};
