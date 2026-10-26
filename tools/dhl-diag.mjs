// GEÇİCİ teşhis: verilen siparişin bilgileriyle SiparisGirisiDetayliV3 varyasyonları dener, başarılı kaydı HEMEN iptal eder.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore(); const U = process.env.DHL_USER, P = process.env.DHL_PASS;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const kv = (o) => Object.entries(o).map(([k, v]) => `<${k}>${esc(v)}</${k}>`).join('');
async function soap(op, inner) {
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${op} xmlns="http://tempuri.org/">${inner}</${op}></soap:Body></soap:Envelope>`;
  const t = await (await fetch('https://service.mngkargo.com.tr/musterikargosiparis/musterikargosiparis.asmx', { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"http://tempuri.org/${op}"` }, body })).text();
  return t.split(P).join('***');
}
const all = await db.collection('orders').orderBy('createdAt', 'desc').limit(40).get();
const want = String(process.env.NO).replace('#', '').toUpperCase();
const o = all.docs.map((d) => d.data()).find((x) => String(x.no).toUpperCase() === want);
if (!o) console.log('::notice::son siparişler: ' + all.docs.map((d) => d.data().no).join(',')); if (!o) { console.log('::notice::sipariş yok'); process.exit(0); }
const a = o.delivery?.addr || {};
console.log('::notice::adres alanları: ' + JSON.stringify(Object.keys(a)) + ' il=' + a.city + ' ilçe=' + a.district + ' adres uzunluk=' + String(a.address || '').length + ' ad var=' + !!a.name + ' email var=' + !!o.contact?.email);
const phone = String(a.phone || o.contact?.phone || '').replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '');
const base = (ref) => ({ pChIrsaliyeNo: '', pPrKiymet: '', pChBarkod: ref, pChIcerik: 'Elektronik malzeme', pKargoParcaList: '1:1:1:Elektronik malzeme:1:;', pAliciMusteriMngNo: '', pAliciMusteriBayiNo: '', pAliciMusteriAdi: String(a.name || o.contact?.name || ''), pChSiparisNo: ref, pLuOdemeSekli: 'U', pFlAdresFarkli: '1', pChIl: String(a.city || '').toLocaleUpperCase('tr-TR'), pChIlce: String(a.district || '').toLocaleUpperCase('tr-TR'), pChAdres: String(a.address || ''), pChSemt: '', pChMahalle: '', pChMeydanBulvar: '', pChCadde: '', pChSokak: '', pChTelEv: '', pChTelCep: phone, pChTelIs: '', pChFax: '', pChEmail: String(o.contact?.email || ''), pChVergiDairesi: '', pChVergiNumarasi: '', pFlKapidaOdeme: 0, pMalBedeliOdemeSekli: '', pPlatformKisaAdi: '', pPlatformSatisKodu: '', pKullaniciAdi: U, pSifre: P });
const vars = {
  aynen: {},
  ilce_kucuk: { pChIlce: String(a.district || '') },
  il_kucuk: { pChIl: String(a.city || ''), pChIlce: String(a.district || '') },
  ascii: { pChIl: 'ISTANBUL', pChIlce: 'KADIKOY' },
  adres_temiz: { pChAdres: 'Fenerbahce Mah. Bagdat Cad. No 72/3' },
  mahalle: { pChMahalle: 'FENERBAHÇE' },
  eski_test_adresi: { pChIl: 'İSTANBUL', pChIlce: 'ÜMRANİYE', pChAdres: 'Finanskent mh. Parlayan sk NO2' },
};
let i = 0;
for (const [k, v] of Object.entries(vars)) {
  const ref = 'ERTELDG' + (++i) + Date.now().toString(36).slice(-3).toUpperCase();
  const t = await soap('SiparisGirisiDetayliV3', kv({ ...base(ref), ...v }));
  const res = (/<SiparisGirisiDetayliV3Result>([\s\S]*?)</.exec(t) || [])[1]; const f = (/<faultstring>([\s\S]*?)<\/faultstring>/.exec(t) || [])[1];
  console.log(`::notice::${k}: ${res != null ? 'sonuç ' + res : 'HATA ' + (f || t.slice(0, 200)).slice(0, 160)}`);
  if (res != null && /^0*1$/.test(res.trim())) {
    const d = new Date(); const tarih = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    const c = await soap('MusteriSiparisIptal', kv({ pKullaniciAdi: U, pSifre: P, pMusteriSiparisNo: ref, pSiparisTarihi: tarih }));
    console.log(`::notice::  ${ref} iptal: ${(/<MusteriSiparisIptalResult>([\s\S]*?)</.exec(c) || [])[1] ?? c.slice(0, 120)}`);
  }
}
