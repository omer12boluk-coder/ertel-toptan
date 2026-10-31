// Fatura bekçisi kurulumu (Blaze'e geçtikten SONRA bir kez çalıştırılır; tekrar çalıştırmak zararsızdır).
// 1) fatura API'leri açılır 2) Pub/Sub konusu 'fatura' + bekçiye iten abonelik 3) fatura hesabında aylık bütçe (Google da
// %50/%90/%100'de e-posta atar) → harcama günde birkaç kez bekçiye gelir, bekçi her tam dolarda Telegram/e-posta/push atar.
// Servis hesabına verilmesi gereken roller (README'de): Project Billing Manager, Pub/Sub Admin, Service Usage Admin (proje),
// Billing Account Costs Manager (fatura hesabı). Ortam: FIREBASE_SERVICE_ACCOUNT, TELEGRAM_TOKEN, WATCH_URL, BUDGET.
import { initializeApp, cert } from 'firebase-admin/app';
import crypto from 'node:crypto';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = initializeApp({ credential: cert(sa) });
const P = sa.project_id;
const note = (t, m) => console.log(`::notice title=${t}::${m}`);
const fail = (t, m) => { console.log(`::error title=${t}::${m}`); process.exitCode = 1; };
const tok = (await app.options.credential.getAccessToken()).access_token;
const g = async (method, url, body) => { const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); return { ok: r.ok, st: r.status, j }; };
note('Servis hesabı', sa.client_email);

const proj = await g('GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${P}`);
const num = proj.j.projectNumber; if (!num) { fail('Proje', 'okunamadı: ' + (proj.j.error?.message || proj.st)); process.exit(1); }

// API'ler
const en = await g('POST', `https://serviceusage.googleapis.com/v1/projects/${num}/services:batchEnable`, { serviceIds: ['cloudbilling.googleapis.com', 'billingbudgets.googleapis.com', 'pubsub.googleapis.com'] });
if (!en.ok) fail('API açma', `${en.j.error?.message || en.st} → servis hesabına 'Service Usage Admin' rolü verin (ya da API'leri konsoldan açın)`); else note('API açma', 'tamam (açılması 1-2 dk sürebilir)');
await new Promise((r) => setTimeout(r, 20000));

const bi = await g('GET', `https://cloudbilling.googleapis.com/v1/projects/${P}/billingInfo`);
if (!bi.ok) { fail('Fatura bilgisi', `${bi.j.error?.message || bi.st} → 'Project Billing Manager' rolü gerekli`); process.exit(1); }
if (!bi.j.billingEnabled) { fail('Blaze', 'Proje henüz Blaze planında değil (fatura hesabı bağlı değil). Önce Firebase › Kullanım ve faturalandırma › Blaze.'); process.exit(1); }
const acct = bi.j.billingAccountName; note('Fatura hesabı', acct + ' bağlı');

// Pub/Sub
const topic = `projects/${P}/topics/fatura`;
const t = await g('PUT', `https://pubsub.googleapis.com/v1/${topic}`, {});
if (!t.ok && t.st !== 409) fail('Pub/Sub konusu', `${t.j.error?.message || t.st} → 'Pub/Sub Admin' rolü gerekli`); else note('Pub/Sub konusu', 'hazır');
const key = crypto.createHash('sha256').update('bill:' + process.env.TELEGRAM_TOKEN).digest('hex').slice(0, 40);
const sub = `projects/${P}/subscriptions/fatura-bekci`;
const push = (process.env.WATCH_URL || '').replace(/\/$/, '') + '/billing/pubsub?k=' + key;
let s = await g('PUT', `https://pubsub.googleapis.com/v1/${sub}`, { topic, pushConfig: { pushEndpoint: push }, ackDeadlineSeconds: 30, messageRetentionDuration: '86400s' });
if (s.st === 409) s = await g('POST', `https://pubsub.googleapis.com/v1/${sub}:modifyPushConfig`, { pushConfig: { pushEndpoint: push } });
if (!s.ok) fail('Abonelik', s.j.error?.message || s.st); else note('Abonelik', 'bekçiye bağlandı');

// Bütçe
const B = Math.max(1, Number(process.env.BUDGET) || 100);
const body = { displayName: 'ERTEL aylık harcama', budgetFilter: { projects: [`projects/${num}`] }, amount: { specifiedAmount: { units: String(B) } }, thresholdRules: [{ thresholdPercent: 0.5 }, { thresholdPercent: 0.9 }, { thresholdPercent: 1 }], notificationsRule: { pubsubTopic: topic, schemaVersion: '1.0' } };
const list = await g('GET', `https://billingbudgets.googleapis.com/v1/${acct}/budgets`);
if (!list.ok) { fail('Bütçe', `${list.j.error?.message || list.st} → fatura hesabında servis hesabına 'Billing Account Costs Manager' rolü verin`); process.exit(1); }
const old = (list.j.budgets || []).find((x) => x.displayName === body.displayName);
const r = old ? await g('PATCH', `https://billingbudgets.googleapis.com/v1/${old.name}?updateMask=amount,thresholdRules,notificationsRule,budgetFilter`, body) : await g('POST', `https://billingbudgets.googleapis.com/v1/${acct}/budgets`, body);
if (!r.ok) fail('Bütçe', r.j.error?.message || r.st); else note('Bütçe', `${old ? 'güncellendi' : 'kuruldu'}: aylık ${B} (fatura hesabının para biriminde); Google %50/%90/%100'de e-posta atar, bekçi her tam dolarda bildirir`);
process.exit(process.exitCode || 0);
