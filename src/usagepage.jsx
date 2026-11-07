// Yönetim › Kullanım (8.11.2026): ücretsiz plan sınırları ne kadar doldu, Blaze'e geçme zamanı geldi mi, kota nerede yendi.
// Veri: bekçi POST /usage (Cloudflare Analytics Engine + Cloudflare istatistikleri). Firebase sayıları uygulamanın kendi sayacı
// (usage.js, tools/meter.mjs, bekçi) → YAKLAŞIK; Cloudflare istek / KV sayıları Cloudflare'in kendi sayacı → kesin.
import { useEffect, useMemo, useState } from 'react';
import { useStore, go, toast } from './store.js';
import { Icon, Sheet, PageHead } from './ui.jsx';
import { ls } from './utils.js';
import { can } from './team.js';
import { NoPerm } from './ekip.jsx';

const LIM = { fsR: 50000, fsW: 20000, cf: 100000, kv: 1000, mail: 100 };
const MET = [
  ['fsR', 'Firebase okuma', 'yaklaşık'],
  ['fsW', 'Firebase yazma', 'yaklaşık'],
  ['cf', 'Cloudflare istekleri (site + bekçi)', 'kesin'],
  ['kv', 'Bekçi kayıt (KV yazma)', 'kesin'],
  ['mail', 'E-posta (günde 100)', 'kesin'],
];
const COL = { orders: 'Siparişler', requests: 'Bayi talepleri', messages: 'Talep mesajları', lcarts: 'Sepet linkleri', members: 'Mağaza üyeleri', users: 'Bayiler ve ekip', catalog: 'Katalog (panel / bayi)', pubcatalog: 'Mağaza kataloğu', settings: 'Ayarlar', desc: 'Ürün açıklamaları', descb: 'Ürün açıklamaları', meta: 'Sistem bilgileri', preq: 'Ürün talepleri', issues: 'Sorun bildirimleri', reviews: 'Yorumlar', revsum: 'Yorum özetleri', stats: 'Popüler ürünler', shopimg: 'Mağaza resimleri', oforms: 'Sipariş formları', paylinks: 'Ödeme linkleri', userPrices: 'Özel fiyatlar', userNotes: 'Bayi notları', usernames: 'Kullanıcı adları', wait: '“Haber ver” listeleri', staffSess: 'Ekip cihazları', audit: 'Ekip geçmişi', gelen: 'Claude’dan gelenler', costs: 'Alış fiyatları', img: 'Ürün resimleri (eski)', '-': 'Ziyaret' };
const CAT = { zamanli: 'Zamanlı işler (dakikalık kontrol, DHL, temizlik)', order: 'Sipariş kaydı', rate: 'Döviz kuru', m: 'Kullanım sayacı', p: 'Resim / video gösterme', up: 'Resim yükleme', upv: 'Video yükleme', notify: 'Sipariş bildirimi', 'notify-test': 'Deneme bildirimi', 'notify-usage': 'Günlük rapor', 'notify-sync': 'Eşitleme bildirimi', push: 'Telefon bildirimleri', pub: 'Müşteri sipariş / sepet linki', check: 'Panel açılış kontrolü', sync: 'Şimdi eşitle', ai: 'Akıllı ürün ekle', dhl: 'DHL', geo: 'Ekip şehir bilgisi', staff: 'Ekip işlemleri', backup: 'Yedekler', billing: 'Fatura bekçisi', usage: 'Kullanım sayfası', kok: 'Ana adres', 'tg-link': 'Telegram bağlama', r2obj: 'Resim taşıma' };
const fmtN = (n) => Math.round(n || 0).toLocaleString('tr-TR');
const pct = (v, lim) => (lim ? Math.round(((v || 0) / lim) * 100) : 0);
const tone = (p) => (p >= 80 ? 'r' : p >= 60 ? 'y' : 'g');
const dayOf = (t) => String(t || '').replace(' ', 'T').slice(0, 10); // UTC gün

// rapor → sayılar
function crunch(R) {
  const fs = R?.fs || [], bk = R?.bk || [], cf = R?.cf || [], kv = R?.kv || [];
  const since = Date.parse(R?.d1 || 0) || Date.now() - 864e5;
  const recent = (t) => Date.parse(String(t).replace(' ', 'T') + (String(t).includes('Z') ? '' : 'Z')) >= since;
  const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
  const isKvW = (a) => /write|delete/i.test(a || '');
  const now = {
    fsR: sum(fs, (x) => x.r) + sum(bk, (x) => x.d2),
    fsW: sum(fs, (x) => x.w) + sum(bk, (x) => x.d3),
    cf: R?.cf ? sum(cf.filter((x) => recent(x.t)), (x) => x.n) : sum(bk, (x) => x.d1),
    kv: R?.kv ? sum(kv.filter((x) => recent(x.t) && isKvW(x.a)), (x) => x.n) : sum(bk, (x) => x.d4),
    mail: sum(bk, (x) => x.d5),
  };
  // 7 gün (UTC günleri)
  const D = {};
  const dget = (d) => D[d] || (D[d] = { fsR: 0, fsW: 0, cf: 0, kv: 0, mail: 0 });
  for (const x of R?.days || []) { const d = dget(dayOf(x.t)); if (x.s === 'fs') { d.fsR += x.d1; d.fsW += x.d2; } else if (x.s === 'bk') { d.fsR += x.d2; d.fsW += x.d3; if (!R?.kv) d.kv += x.d4; d.mail += x.d5; if (!R?.cf) d.cf += x.d1; } }
  for (const x of cf) dget(dayOf(x.t)).cf += x.n;
  for (const x of kv) if (isKvW(x.a)) dget(dayOf(x.t)).kv += x.n;
  const days = Object.keys(D).sort().slice(-7).map((d) => ({ d, ...D[d], max: Math.max(...MET.map(([k]) => pct(D[d][k], LIM[k]))) }));
  // saat saat (son 24 saat)
  const H = {};
  const hget = (t) => { const k = String(t).replace(' ', 'T').slice(0, 13); return H[k] || (H[k] = { fsR: 0, fsW: 0, cf: 0, kv: 0, mail: 0 }); };
  for (const x of R?.hours || []) { const h = hget(x.t); if (x.s === 'fs') { h.fsR += x.d1; h.fsW += x.d2; } else if (x.s === 'bk') { h.fsR += x.d2; h.fsW += x.d3; if (!R?.kv) h.kv += x.d4; h.mail += x.d5; if (!R?.cf) h.cf += x.d1; } }
  for (const x of cf) if (recent(x.t)) hget(x.t).cf += x.n;
  for (const x of kv) if (recent(x.t) && isKvW(x.a)) hget(x.t).kv += x.n;
  const hours = Object.keys(H).sort().slice(-24).map((k) => ({ k, ...H[k] }));
  // karar
  const nowMax = Math.max(...MET.map(([k]) => pct(now[k], LIM[k])));
  const top = MET.map(([k, l]) => [k, l, pct(now[k], LIM[k])]).sort((a, b) => b[2] - a[2])[0];
  const peak = Math.max(nowMax, ...days.map((d) => d.max));
  let two = false; for (let i = 1; i < days.length; i++) if (days[i].max >= 70 && days[i - 1].max >= 70) two = true;
  const level = peak >= 80 || two ? 'r' : peak >= 60 ? 'y' : 'g';
  return { now, days, hours, level, peak, top, fs, bk, cf, kv, since, recent };
}

function breakdown(k, C) {
  const who = {}, what = {};
  const put = (m, key, v) => { if (v > 0) m[key] = (m[key] || 0) + v; };
  if (k === 'fsR' || k === 'fsW') {
    const f = k === 'fsR' ? 'r' : 'w', bf = k === 'fsR' ? 'd2' : 'd3';
    const visits = C.fs.filter((x) => x.a === 'magaza').reduce((s, x) => s + (x.v || 0), 0);
    for (const x of C.fs) {
      const w = x.a === 'panel' ? 'Yönetim paneli · ' + (x.n || 'yönetici') : x.a === 'magaza' ? `Mağaza ziyaretçileri (${fmtN(visits)} ziyaret)` : x.a === 'bayi' ? 'Bayi uygulaması' : 'Otomatik iş · ' + (x.n || '?');
      put(who, w, x[f]); put(what, COL[x.col] || x.col, x[f]);
    }
    for (const x of C.bk) { put(who, 'Bekçi (sipariş kontrolü, bildirim…)', x[bf]); put(what, 'Bekçi · ' + (CAT[x.cat] || x.cat), x[bf]); }
  } else if (k === 'cf') {
    for (const x of C.cf) if (C.recent(x.t)) put(who, /watch/.test(x.s) ? 'Bekçi' : /site/.test(x.s) ? 'Mağaza sitesi (sayfa, Google, önizleme)' : x.s || 'diğer', x.n);
    for (const x of C.bk) put(what, 'Bekçi · ' + (CAT[x.cat] || x.cat), x.d1);
  } else if (k === 'kv') { for (const x of C.bk) put(what, CAT[x.cat] || x.cat, x.d4); }
  else if (k === 'mail') { for (const x of C.bk) put(what, CAT[x.cat] || x.cat, x.d5); }
  const list = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]);
  return { who: list(who), what: list(what) };
}

const CK = 'usage-rep';
export async function loadUsage(A, force) {
  const c = ls.get(CK, null);
  if (!force && c && Date.now() - c.at < 10 * 60e3) return c.r;
  const r = await A.usageLive();
  if (r && r.ok !== false) ls.set(CK, { at: Date.now(), r });
  return r;
}

export function UsageBadge() {
  const A = useStore((s) => s.api);
  const [C, setC] = useState(null);
  useEffect(() => { if (!can('quota') || !A.usageLive) return; loadUsage(A).then((r) => r && r.ok !== false && setC(crunch(r))).catch(() => {}); }, []);
  if (!C) return null;
  const t = { g: ['Kota rahat', 'g'], y: ['Kota yaklaşıyor', 'y'], r: ['Blaze zamanı', 'r'] }[C.level];
  return <button type="button" className={'us-badge us-' + t[1]} onClick={() => go('kullanim')}><i />{t[0]} · %{C.peak}</button>;
}

export function UsagePage() {
  const A = useStore((s) => s.api);
  const [R, setR] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const load = (force) => { setBusy(true); setErr(''); loadUsage(A, force).then((r) => { if (r?.ok === false) setErr(r.error || 'Okunamadı'); else setR(r); }, (e) => setErr(e.message)).finally(() => setBusy(false)); };
  useEffect(() => { if (can('quota')) load(false); }, []);
  const C = useMemo(() => (R ? crunch(R) : null), [R]);
  if (!can('quota')) return <NoPerm perm="quota" />;
  const V = C && {
    g: ['Rahat', 'Ücretsiz plan yetiyor. En yoğun gün sınırların %' + C.peak + '’i.'],
    y: ['Yaklaşıyor — Blaze’i hazırla', `Son 7 günde bir sınır %60’ı geçti (en yüksek %${C.peak}). En çok dolan: ${C.top[1]}.`],
    r: ['Blaze zamanı', `Bir sınır %80’i geçti ya da 2 gün üst üste %70’in üstünde (en yüksek %${C.peak}). Dolarsa site o gün durur.`],
  }[C.level];
  const dl = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return (
    <div className="page us-page">
      <PageHead title="Kullanım"><button type="button" className="btn sm ghost ph-sec" onClick={() => load(true)} disabled={busy}><Icon n="refresh" s={15} /><span>{busy ? 'Yükleniyor…' : 'Yenile'}</span></button></PageHead>
      {err && <div className="us-err"><b>Rapor okunamadı.</b> {err}{/anahtar/.test(err) ? ' Bekçi yeniden yayınlanınca düzelir.' : ''}</div>}
      {!C && !err && <p className="fine">Yükleniyor…</p>}
      {C && <>
        <div className={'us-verdict us-' + C.level}><span className="us-dot" /><div><b>{V[0]}</b><span>{V[1]}</span></div></div>
        <section className="us-card">
          <div className="us-h"><h2>Son 24 saat</h2><span className="muted">günlük ücretsiz sınıra göre · dokun: ayrıntı</span></div>
          {MET.map(([k, l, how]) => { const p = pct(C.now[k], LIM[k]); return (
            <button key={k} type="button" className="us-row" onClick={() => setOpen(k)}>
              <span className="us-l"><b>{l}<em className={'us-tag ' + (how === 'kesin' ? 'ok' : 'est')}>{how}</em></b><span>{fmtN(C.now[k])} / {fmtN(LIM[k])} · %{p}</span></span>
              <span className="us-bar"><i className={'us-' + tone(p)} style={{ width: Math.min(100, Math.max(p, C.now[k] ? 1.5 : 0)) + '%' }} /></span>
              <Icon n="back" s={15} className="flip us-go" />
            </button>
          ); })}
        </section>
        <section className="us-card">
          <div className="us-h"><h2>Son 7 gün</h2><span className="muted">her gün en çok dolan sınır</span></div>
          {C.days.length === 0 ? <p className="fine">Sayaç yeni başladı; günler doldukça burada görünecek.</p> : (
            <div className="us-days">{C.days.map((d) => <div key={d.d} className="us-day" title={dl(d.d) + ': %' + d.max}><span className={'us-' + tone(d.max)} style={{ height: Math.max(3, Math.min(100, d.max)) + '%' }} /><small>%{d.max}</small><em>{dl(d.d)}</em></div>)}</div>
          )}
        </section>
        <p className="fine us-note">
          <b>Yaklaşık</b> sayılar uygulamanın kendi sayacıdır (Google ücretsiz planda okuma sayısını vermiyor); uygulama dışından gelen okumalar görünmez — kesin sayı: <a href="https://console.firebase.google.com/project/erteltoptan/firestore/usage" target="_blank" rel="noopener">Firebase › Firestore › Kullanım</a>. <b>Kesin</b> sayılar Cloudflare’in kendi sayacıdır. Firebase sınırları Türkiye saatiyle ~10:00–11:00’de, Cloudflare sınırları 03:00’te sıfırlanır; burada son 24 saat gösterilir. Rapor 10 dakikada bir yenilenir{R?.at ? ' · ' + new Date(R.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}.
          {R?.err?.length ? <><br />Eksik kalan: {R.err.join(' · ')}</> : null}
        </p>
      </>}
      {open && C && <Detail k={open} C={C} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Detail({ k, C, onClose }) {
  const m = MET.find((x) => x[0] === k);
  const B = breakdown(k, C);
  const tot = C.now[k] || 0;
  const hours = C.hours;
  const hmax = Math.max(1, ...hours.map((h) => h[k] || 0));
  const rows = (list) => { const mx = Math.max(1, ...list.map((x) => x[1])); return list.slice(0, 14).map(([n, v]) => <div key={n} className="us-brk"><span className="us-bn">{n}</span><span className="us-mini"><i style={{ width: (v / mx) * 100 + '%' }} /></span><b>{fmtN(v)}</b></div>); };
  return (
    <Sheet title={m[1]} sub={`Son 24 saat · ${fmtN(tot)} / ${fmtN(LIM[k])} · ${m[2]}`} onClose={onClose}>
      {B.who.length > 0 && <><h3 className="us-h3">Kim harcadı</h3><div className="us-list">{rows(B.who)}</div></>}
      {B.what.length > 0 && <><h3 className="us-h3">Hangi işte</h3><div className="us-list">{rows(B.what)}</div></>}
      {!B.who.length && !B.what.length && <p className="fine">Bu sınır için henüz ayrıntı yok.</p>}
      <h3 className="us-h3">Saat saat</h3>
      {hours.length ? <>
        <div className="us-hours">{hours.map((h) => <i key={h.k} title={new Date(h.k + ':00:00Z').toLocaleTimeString('tr-TR', { hour: '2-digit' }) + ': ' + fmtN(h[k])} style={{ height: Math.max(2, ((h[k] || 0) / hmax) * 100) + '%' }} />)}</div>
        <div className="us-hl"><span>{new Date(hours[0].k + ':00:00Z').toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span><span>şimdi</span></div>
      </> : <p className="fine">Henüz saatlik veri yok.</p>}
    </Sheet>
  );
}
