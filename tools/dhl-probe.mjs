// GEÇİCİ: takip no neden gelmiyor? Okuyan (sorgu) DHL metotlarını referansla dener, sonucu ::notice olarak yazar.
const U = process.env.DHL_USER || '', P = process.env.DHL_PASS || '', REF = process.env.REF || 'ERTELP4A88E', GNO = process.env.GNO || '';
const URL0 = 'https://service.mngkargo.com.tr/musterikargosiparis/musterikargosiparis.asmx';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const mask = (t) => (P ? t.split(P).join('***') : t);
const note = (t) => { for (let i = 0; i < t.length; i += 3500) console.log('::notice::' + t.slice(i, i + 3500).replace(/\r?\n/g, ' ')); };
const wsdl = await (await fetch(URL0 + '?WSDL')).text();
const ops = [...new Set([...wsdl.matchAll(/<wsdl:operation name="(\w+)"/g)].map((m) => m[1]))];
note('OPS: ' + ops.join(', '));
const params = (op) => { const m = new RegExp(`<s:element name="${op}">([\\s\\S]*?)</s:element>\\s*<s:element name="${op}Response"`).exec(wsdl); return m ? [...m[1].matchAll(/<s:element[^>]*name="(\w+)"[^>]*type="s:(\w+)"/g)].map((x) => [x[1], x[2]]) : []; };
const today = new Date(); const d = (x) => `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`;
const from = new Date(Date.now() - 3 * 864e5);
const val = (n, t) => { const k = n.toLowerCase();
  if (/musterino|kullanici/.test(k)) return U; if (/sifre|password/.test(k)) return P;
  if (/siparis|referans|barkod/.test(k)) return REF; if (/gonderino/.test(k)) return GNO;
  if (/baslangic|ilk/.test(k) && /tarih/.test(k)) return d(from); if (/bitis|son/.test(k) && /tarih/.test(k)) return d(today); if (/tarih/.test(k)) return d(today);
  if (t === 'int' || t === 'decimal' || t === 'double') return '0'; if (t === 'boolean') return 'false'; return ''; };
const READ = /sorgu|bilgi|takip|durum|rapor|liste|getir|gonderiler/i, NO = /giris|iptal|kayit|ekle|olustur|guncelle|musteribayibilgileri|sil|onay|kaydet/i;
for (const op of ops) {
  if (!READ.test(op) || NO.test(op)) continue;
  const ps = params(op); if (!ps.length) continue;
  const inner = ps.map(([n, t]) => `<${n}>${esc(val(n, t))}</${n}>`).join('');
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${op} xmlns="http://tempuri.org/">${inner}</${op}></soap:Body></soap:Envelope>`;
  try {
    const r = await fetch(URL0, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"http://tempuri.org/${op}"` }, body });
    const t = mask(await r.text()); const inside = (t.match(/<soap:Body>([\s\S]*)<\/soap:Body>/) || [, t])[1].replace(/<xs:schema[\s\S]*?<\/xs:schema>/g, '[şema]');
    note(`${op} (${ps.map((p) => p[0]).join(',')}) → ${r.status}: ${inside.slice(0, 2500)}`);
  } catch (e) { note(op + ' HATA ' + e.message); }
}
