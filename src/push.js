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
// Bildirim daha önce açıldıysa yeni siparişi sessizce bağlar
export async function autoPush(id) {
  try { if (pushState() !== 'on') return; const sub = await subscription(false); if (sub) await send(id, sub, false); } catch {}
}
export function disablePush() { ls.set('push-on', false); subscription(false).then((s) => s?.unsubscribe()).catch(() => {}); }
// yönetici durum değiştirince
export function pushStatus(id) {
  if (!W()) return;
  fetch(W() + '/push/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
}
