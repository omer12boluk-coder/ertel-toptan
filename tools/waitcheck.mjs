// "Gelince haber ver" (29.10.2026): wait/{ürün} belgelerinde bekleyen üyesi olan ürün stoğa girmişse (aktif ve s > 0)
// bekçiye /push/back ile telefon bildirimi gönderilir, üyenin members.notify listesinden düşürülür, members.notifyHit'e
// (zil için, en çok 20) eklenir ve wait belgesi silinir. Eşitleme (sync-platin.mjs) ve popüler hesabı (stats.mjs) çağırır.

import { createHash } from 'node:crypto';

export async function waitCheck(db, byId, note = console.log) {
  const pub = (await db.doc('settings/public').get()).data() || {};
  if (pub.feat?.notify === false) return 0;
  const ws = await db.collection('wait').get();
  if (ws.empty) return 0;
  const now = Date.now(); const byMem = new Map(); const done = [];
  for (const d of ws.docs) {
    const p = byId.get(Number(d.id));
    const uids = (d.data().uids || []).filter(Boolean);
    if (!uids.length) { done.push(d.ref); continue; }
    if (!p) continue; // ürün katalogda yok: beklemeye devam
    if (!(p.a !== 0 && !p.so && p.s > 0)) continue;
    for (const u of uids) { if (!byMem.has(u)) byMem.set(u, []); byMem.get(u).push({ id: p.id, n: String(p.n || '').slice(0, 120) }); }
    done.push(d.ref);
  }
  if (!byMem.size && !done.length) return 0;
  const W = process.env.WATCH_URL, T = process.env.TELEGRAM_TOKEN;
  if (byMem.size && W && T) {
    const key = createHash('sha256').update('sync:' + T).digest('hex');
    await fetch(W.replace(/\/$/, '') + '/push/back', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Key': key }, body: JSON.stringify({ list: [...byMem].map(([uid, items]) => ({ uid, items: items.slice(0, 10) })) }) })
      .then((r) => r.text()).then((t) => note('Gelince haber ver', `${byMem.size} üye · ${t.slice(0, 160)}`)).catch((e) => note('Gelince haber ver hatası', e));
  }
  for (const [uid, items] of byMem) {
    const ref = db.doc('members/' + uid);
    const m = (await ref.get()).data(); if (!m) continue;
    const ids = new Set(items.map((x) => x.id));
    const hit = [...items.map((x) => ({ ...x, at: now })), ...(m.notifyHit || []).filter((h) => !ids.has(h.id))].slice(0, 20); // aynı ürün tekrar gelirse eskisi silinir
    await ref.update({ notify: (m.notify || []).filter((x) => !ids.has(x)), notifyHit: hit }).catch((e) => note('Üye güncellenemedi', e.message));
  }
  for (const r of done) await r.delete().catch(() => {});
  return byMem.size;
}
