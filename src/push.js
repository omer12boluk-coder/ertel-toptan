// Müşteriye sipariş durumu bildirimi (web push). Abonelik bekçiye (Cloudflare Worker) sipariş kimliğiyle kaydedilir;
// yönetici durumu değiştirince bekçi bildirimi gönderir. iPhone'da (iOS 16.4+) sadece ana ekrana eklenmiş uygulamada çalışır.
import { ls } from './utils.js';

const W = () => (window.WATCH_URL || '').replace(/\/$/, '');
export const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// 'on' | 'off' | 'denied' | 'ios-home' (iPhone: önce ana ekrana eklenmeli) | 'unsupported'
export function pushState() {
  if (!W()) return 'unsupported';
  if (isIOS() && !isStandalone()) return 'ios-home';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && ls.get('push-on', false) ? 'on' : 'off';
}
const toKey = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function subscription(create) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && create) {
    let key = ls.get('push-key', '');
    if (!key) { const r = await fetch(W() + '/push/key'); key = (await r.json()).key; ls.set('push-key', key); }
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
  }
  return sub;
}
const send = (id, sub, hello) => fetch(W() + '/push/sub', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, sub: sub.toJSON(), hello }) }).then((r) => r.json());

// İzin ister ve verilen siparişlere bağlar (ilkine "bildirimler açık" deneme bildirimi gelir)
export async function enablePush(ids) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Bildirim izni verilmedi' : 'İzin verilmedi');
  const sub = await subscription(true);
  ls.set('push-on', true);
  const list = [...new Set(ids.filter(Boolean))];
  await Promise.all(list.map((id, i) => send(id, sub, i === 0)));
}
// Deneme: aboneliği (yoksa yeniden) kurar, siparişlere bağlar ve hemen bir deneme bildirimi gönderir; sonucu döner
export async function testPush(ids) {
  if (Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') throw new Error('Bildirim izni verilmedi'); }
  const sub = await subscription(true); ls.set('push-on', true);
  const list = [...new Set(ids.filter(Boolean))]; if (!list.length) throw new Error('Bağlanacak sipariş yok');
  const r = await send(list[0], sub, true); await Promise.all(list.slice(1).map((id) => send(id, sub, false)));
  return r;
}
// iPhone aboneliği zamanla düşürebiliyor: "açık" görünüyorsa gerçekten abonelik var mı bak, yoksa sessizce yeniden kur ve bağla
export async function ensurePush(ids) {
  try { if (pushState() !== 'on') return; const had = await subscription(false); const sub = had || (await subscription(true)); if (!had) await Promise.all([...new Set(ids.filter(Boolean))].map((id) => send(id, sub, false))); } catch {}
}
// Bildirim daha önce açıldıysa yeni siparişi sessizce bağlar
// (30.10.2026) aynı sipariş + aynı cihaz 7 günde bir defadan fazla bekçiye gönderilmez (her açılışta yazmak KV kotasını dolduruyordu)
const sentRecently = (key, ep) => { try { const m = JSON.parse(localStorage.getItem('push-sent') || '{}'); const v = m[key]; return v && v.e === ep && Date.now() - v.t < 7 * 864e5; } catch { return false; } };
const markSent = (key, ep) => { try { const m = JSON.parse(localStorage.getItem('push-sent') || '{}'); m[key] = { e: ep, t: Date.now() }; const ks = Object.keys(m); if (ks.length > 200) ks.sort((a, b) => m[a].t - m[b].t).slice(0, ks.length - 200).forEach((k) => delete m[k]); localStorage.setItem('push-sent', JSON.stringify(m)); } catch {} };
export async function autoPush(id) {
  try { if (pushState() !== 'on') return; const sub = await subscription(false); if (!sub || sentRecently('o:' + id, sub.endpoint)) return; await send(id, sub, false); markSent('o:' + id, sub.endpoint); } catch {}
}
// Üye: cihazı hesaba bağla (siparişi olmasa da favori fiyat düşüşü bildirimi gelsin)
export async function linkMember(token, ask) {
  try {
    if (!token) return;
    if (ask) { const perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error('Bildirim izni verilmedi'); ls.set('push-on', true); }
    else if (pushState() !== 'on') return;
    const sub = await subscription(true);
    if (!ask && sentRecently('m', sub.endpoint)) return;
    markSent('m', sub.endpoint);
    await fetch(W() + '/push/member', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, sub: sub.toJSON() }) });
  } catch (e) { if (ask) throw e; }
}
export function disablePush() { ls.set('push-on', false); subscription(false).then((s) => s?.unsubscribe()).catch(() => {}); }
// yönetici durum değiştirince
export function pushStatus(id) {
  if (!W()) return;
  fetch(W() + '/push/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
}

// ---- Yönetici bildirimleri (yeni sipariş, müşteri iptali, bayi talebi) — bu cihaz için ----
export function adminPushState() {
  const st = pushState(); if (st === 'on' || st === 'off') return Notification.permission === 'granted' && ls.get('apush-on', false) ? 'on' : 'off';
  return st;
}
const adminSend = async (body) => { const r = await fetch(W() + '/push/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.error || 'Açılamadı'); return j; };
export async function enableAdminPush(token) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Bildirim izni verilmedi (tarayıcı ayarlarından açın)' : 'İzin verilmedi');
  const sub = await subscription(true);
  await adminSend({ token, sub: sub.toJSON(), hello: true });
  ls.set('apush-on', true);
}
export async function disableAdminPush(token) {
  ls.set('apush-on', false);
  const sub = await subscription(false).catch(() => null);
  if (sub) await adminSend({ token, sub: { endpoint: sub.endpoint }, off: true }).catch(() => {});
}
// bayi yeni talep açınca / mesaj yazınca, müşteri siparişi iptal edince yöneticiye haber
export function pingWatch(path, body) {
  if (!W()) return;
  fetch(W() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}
