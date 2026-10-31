// Müşteri bildirimi teşhisi (sadece okur): son siparişlerin durumu, takip no, bekçinin "son bildirilen" işareti (pl:)
// ve o siparişe / üyeye kayıtlı cihaz sayısı (ps: / pm:). Kişisel bilgi yazdırılmaz.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const A = process.env.CLOUDFLARE_ACCOUNT_ID, T = process.env.CLOUDFLARE_API_TOKEN;
const api = `https://api.cloudflare.com/client/v4/accounts/${A}/storage/kv/namespaces`;
const H = { Authorization: 'Bearer ' + T };
const ns = (await (await fetch(api + '?per_page=100', { headers: H })).json()).result.find((x) => x.title === 'ertel-b2b-sync').id;
const kv = async (k) => { const r = await fetch(`${api}/${ns}/values/${encodeURIComponent(k)}`, { headers: H }); return r.ok ? r.text() : null; };
const cnt = (t) => { try { return JSON.parse(t || '[]').length; } catch { return '?'; } };
const host = (t) => { try { return [...new Set(JSON.parse(t || '[]').map((s) => new URL(s.endpoint).host))].join(','); } catch { return ''; } };
const snap = await db.collection('orders').orderBy('updatedAt', 'desc').limit(Number(process.env.N || 8)).get();
for (const d of snap.docs) {
  const o = d.data();
  const ps = await kv('ps:' + d.id); const pm = o.uid ? await kv('pm:' + o.uid) : null; const pl = await kv('pl:' + d.id);
  const hist = (o.history || []).slice(-3).map((h) => `${h.s}@${new Date(h.at).toISOString().slice(5, 16)}/${h.by || ''}`).join(' ');
  console.log(`::notice title=#${o.no} ${o.status}::kargo=${o.cargo?.company || '-'} takip=${o.cargo?.code ? 'var' : 'yok'} dhl=${o.dhl?.ref ? 'var' : 'yok'} | son bildirilen(pl)=${pl ? pl.replace(/:.+/, ':<no>') : 'YOK'} | sipariş cihazı(ps)=${cnt(ps)} [${host(ps)}] üye=${o.uid ? 'evet' : 'misafir'} üye cihazı(pm)=${o.uid ? cnt(pm) + ' [' + host(pm) + ']' : '-'} | ${hist}`);
}
const adm = await kv('ps-admin');
console.log(`::notice title=Yönetici cihazları::${cnt(adm)} [${host(adm)}]`);
