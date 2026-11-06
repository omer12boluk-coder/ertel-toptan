// SADECE OKUMA: dün geceki yedekteki ürün resimleri ile şu anki katalog resimlerini karşılaştırır (Excel aktarımı teşhisi).
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const DIR = process.env.DIR;
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, ' ').slice(0, 3800)}`);
const info = JSON.parse(fs.readFileSync(`${DIR}/_bilgi.json`));
const f = fs.readdirSync(DIR).find((x) => x === 'catalog.json');
const old = Object.entries(JSON.parse(fs.readFileSync(`${DIR}/${f}`))).filter(([id]) => id !== '_meta').flatMap(([, d]) => d.items || []);
const snap = await db.collection('catalog').get();
const cur = snap.docs.filter((d) => d.id !== '_meta').flatMap((d) => d.data().items || []);
const O = new Map(old.map((p) => [String(p.id), p]));
const sh = (v) => String(v || '∅').replace(/^https?:\/\/[^/]+\/\d+\/pictures\//, '').slice(0, 60);
let same = 0, piChg = 0, piEmpty = 0, imChg = 0, imEmpty = 0, nw = 0, r2lost = 0, swapped = 0;
const ex = [], exE = [], exR = [], exS = [];
const oldByPi = new Map(old.filter((p) => p.pi).map((p) => [p.pi, p]));
for (const p of cur) {
  const o = O.get(String(p.id)); if (!o) { nw++; continue; }
  const a = o.pi || '', b = p.pi || '';
  const ai = JSON.stringify(o.im || []), bi = JSON.stringify(p.im || []);
  if (a === b && ai === bi) { same++; continue; }
  if (a !== b) {
    piChg++;
    if (!b) { piEmpty++; if (exE.length < 8) exE.push(`${p.k || p.id} ${String(p.n).slice(0, 30)}: ${sh(a)} → boş`); }
    else if (a.startsWith('r2:') && !b.startsWith('r2:')) { r2lost++; if (exR.length < 8) exR.push(`${p.k || p.id} ${String(p.n).slice(0, 30)}: ${sh(a)} → ${sh(b)}`); }
    else if (oldByPi.has(b) && String(oldByPi.get(b).id) !== String(p.id)) { swapped++; if (exS.length < 8) exS.push(`${p.k || p.id} ${String(p.n).slice(0, 25)} şimdi '${String(oldByPi.get(b).n).slice(0, 25)}' resmini taşıyor`); }
    else if (ex.length < 10) ex.push(`${p.k || p.id} ${String(p.n).slice(0, 30)}: ${sh(a)} → ${sh(b)}`);
  }
  if (ai !== bi) { imChg++; if ((o.im || []).length && !(p.im || []).length) imEmpty++; }
}
note('Yedek', `${info.at} · yedekte ${old.length} ürün, şimdi ${cur.length} (yeni ${nw})`);
note('Özet', `aynı ${same} · kapak resmi değişen ${piChg} (boşalan ${piEmpty}, yüklenmiş r2 resmi platin adıyla değişen ${r2lost}, başka ürünün eski resmini alan ${swapped}) · ek resimleri değişen ${imChg} (boşalan ${imEmpty})`);
if (exE.length) note('Boşalan örnek', exE.join(' | '));
if (exR.length) note('R2 kaybı örnek', exR.join(' | '));
if (exS.length) note('Kayma örnek', exS.join(' | '));
if (ex.length) note('Diğer değişen örnek', ex.join(' | '));
const fmt = (p) => `${p.k || p.id} pi=${sh(p.pi)} im=${(p.im || []).length} ie=${p.ie ? 1 : 0}`;
note('Şimdiki 5 örnek', cur.slice(0, 5).map(fmt).join(' | '));

// 2) mağaza katalogu ve açıklamalar
const pubOld = Object.entries(JSON.parse(fs.readFileSync(`${DIR}/pubcatalog.json`))).filter(([id]) => id !== '_meta').flatMap(([, d]) => d.items || []);
const pubCur = (await db.collection('pubcatalog').get()).docs.filter((d) => d.id !== '_meta').flatMap((d) => d.data().items || []);
const C = new Map(cur.map((p) => [String(p.id), p]));
let pm = 0, pe = 0; const pex = [];
for (const q of pubCur) { const p = C.get(String(q.id)); if (!p) continue; if ((q.pi || '') !== (p.pi || '')) { pm++; if (!q.pi) pe++; if (pex.length < 6) pex.push(`${p.k} kat=${sh(p.pi)} mağaza=${sh(q.pi)}`); } }
note('Mağaza katalogu', `yedekte ${pubOld.length}, şimdi ${pubCur.length} · katalogla kapak resmi farklı ${pm} (boş ${pe}) · alanlar: ${Object.keys(pubCur[0] || {}).join(',')}`);
if (pex.length) note('Mağaza fark örnek', pex.join(' | '));
const cnt = (s) => ({ img: (s.match(/<img/gi) || []).length, pl: (s.match(/platincdn|ertelgsm\.com/gi) || []).length, r2: (s.match(/resim\.ertelmarket\.com/gi) || []).length, len: s.length });
const sum = (docs) => { const t = { img: 0, pl: 0, r2: 0, len: 0, n: 0 }; for (const d of docs) { const c = cnt(JSON.stringify(d)); for (const k in c) t[k] += c[k]; t.n++; } return t; };
for (const col of ['desc', 'descb']) {
  const o = Object.values(JSON.parse(fs.readFileSync(`${DIR}/${col}.json`)));
  const c = (await db.collection(col).get()).docs.map((d) => d.data());
  const a = sum(o), b = sum(c);
  note('Açıklama ' + col, `yedek: ${a.n} belge, ${a.img} resim, platin ${a.pl}, r2 ${a.r2}, ${(a.len / 1e6).toFixed(1)} MB → şimdi: ${b.n} belge, ${b.img} resim, platin ${b.pl}, r2 ${b.r2}, ${(b.len / 1e6).toFixed(1)} MB`);
}
