// Kullanım sayacı (8.11.2026, Yönetim › Kullanım): bu otomatik işin Firestore okuma/yazmalarını sayar, iş bitince bekçiye
// bildirir (a: 'oto'). Kullanım: betiğin en başına `import './meter.mjs';`. WATCH_URL + TELEGRAM_TOKEN yoksa sessizce geçer.
// Davranışı DEĞİŞTİRMEZ, sadece sayar. Sayılar yaklaşık (listDocuments, stream, toplu yazıcı sayılmaz).
import { Query, DocumentReference, WriteBatch, Firestore } from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import path from 'node:path';

const C = {};
const add = (col, r, w) => { col = String(col || '?').slice(0, 24); const x = C[col] || (C[col] = [0, 0]); x[0] += r || 0; x[1] += w || 0; };
const colQ = (q) => { try { return q.id || q._queryOptions?.collectionId || '?'; } catch { return '?'; } };
const colD = (d) => { try { return d.parent?.id || '?'; } catch { return '?'; } };
const NAMES = { backup: 'Gece yedeği', 'sync-platin': 'Siteyle eşitleme', stats: 'Popüler ürünler', 'usage-report': 'Kullanım raporu', 'dhl-track': 'DHL takip' };
const base = path.basename(process.argv[1] || '', '.mjs');
const name = NAMES[base] || base;

try {
  const qg = Query.prototype.get; Query.prototype.get = async function (...a) { const s = await qg.apply(this, a); add(colQ(this), Math.max(1, s.size || 0), 0); return s; };
  const dg = DocumentReference.prototype.get; DocumentReference.prototype.get = async function (...a) { const s = await dg.apply(this, a); add(colD(this), 1, 0); return s; };
  if (Firestore.prototype.getAll) { const ga = Firestore.prototype.getAll; Firestore.prototype.getAll = async function (...a) { const r = await ga.apply(this, a); for (const d of a) if (d instanceof DocumentReference) add(colD(d), 1, 0); return r; }; }
  for (const m of ['set', 'update', 'delete', 'create']) {
    const f = DocumentReference.prototype[m]; if (f) DocumentReference.prototype[m] = async function (...a) { const r = await f.apply(this, a); add(colD(this), 0, 1); return r; };
    const g = WriteBatch.prototype[m]; if (g) WriteBatch.prototype[m] = function (ref, ...a) { (this.__cnt = this.__cnt || []).push(colD(ref)); return g.call(this, ref, ...a); };
  }
  const cm = WriteBatch.prototype.commit; WriteBatch.prototype.commit = async function (...a) { const r = await cm.apply(this, a); for (const c of this.__cnt || []) add(c, 0, 1); this.__cnt = []; return r; };
} catch (e) { console.log('sayaç kurulamadı', e.message); }

let sent = false;
async function send() {
  if (sent) return; sent = true;
  const url = process.env.WATCH_URL, tok = process.env.TELEGRAM_TOKEN;
  if (!url || !tok || !Object.keys(C).length) return;
  const ks = Object.keys(C).sort((a, b) => C[b][0] + C[b][1] - C[a][0] - C[a][1]);
  const c = {}; ks.slice(0, 11).forEach((k) => (c[k] = C[k]));
  if (ks.length > 11) c.diger = ks.slice(11).reduce((s, k) => [s[0] + C[k][0], s[1] + C[k][1]], [0, 0]);
  const key = crypto.createHash('sha256').update('sync:' + tok).digest('hex');
  try { await fetch(url.replace(/\/$/, '') + '/m', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Key': key }, body: JSON.stringify({ a: 'oto', u: '', n: name, v: 1, c }), signal: AbortSignal.timeout(8000) }); } catch {}
  const tot = ks.reduce((s, k) => [s[0] + C[k][0], s[1] + C[k][1]], [0, 0]);
  console.log(`::notice title=Kullanım (${name})::okuma ${tot[0]}, yazma ${tot[1]}`);
}
const exit0 = process.exit.bind(process);
process.exit = (code) => { send().finally(() => exit0(code)); };
process.on('beforeExit', () => { if (!sent) send(); });
