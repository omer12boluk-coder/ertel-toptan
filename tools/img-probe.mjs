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
