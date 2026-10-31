// Ayarlar > Veri ve kota (31.10.2026): yönetim panelinin açılışta ne kadar geçmiş yüklediği + günlük kullanım raporu.
// Ücretsiz Firebase planı günde 50.000 okuma verir; dolarsa site o gün veri çekemez. En büyük yük panelin açılışı.
import { useEffect, useState } from 'react';
import { api, toast } from './store.js';
import { Toggle, Icon, Confirm, Field } from './ui.jsx';

const DAYS = [[7, '7 gün', 'En hafif'], [14, '14 gün', 'Önerilen'], [30, '30 gün', 'Dengeli'], [62, '62 gün', 'Ağır']];
const MDAYS = [[14, '14 gün', 'En hafif'], [30, '30 gün', 'Dengeli'], [62, '62 gün', 'Önerilen'], [120, '120 gün', 'En ağır']];
const fmtN = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR'));
const Bar = ({ l, v, lim }) => {
  const p = v == null ? 0 : Math.min(100, Math.round((v / lim) * 100));
  return (
    <div className="qt-row">
      <span className="qt-l">{l}</span>
      <span className="qt-bar"><i style={{ width: p + '%', background: p >= 90 ? '#b42318' : p >= 70 ? '#c9772b' : 'var(--accent)' }} /></span>
      <span className="qt-v">{fmtN(v)} / {fmtN(lim)} <b>%{p}</b></span>
    </div>
  );
};

function Pick({ value, onChange, opts }) {
  return (
    <div className="qt-pick">
      {opts.map(([v, l, h]) => (
        <button key={v} type="button" className={'qt-opt' + (value === v ? ' on' : '')} onClick={() => onChange(v)}><b>{l}</b><small>{h}</small></button>
      ))}
    </div>
  );
}

export function QuotaSettings({ d, set }) {
  const Q = d.quota || {};
  const days = [7, 14, 30, 62, 120].includes(Number(Q.win)) ? Number(Q.win) : 14;
  const mem = [14, 30, 62, 120].includes(Number(Q.members)) ? Number(Q.members) : 62;
  const [u, setU] = useState(undefined);
  useEffect(() => { api().getUsage?.().then((x) => setU(x || null)).catch(() => setU(null)); }, []);
  return <>
    <p className="fine">Site ücretsiz Firebase planında: veritabanından <b>günde 50.000 okuma</b> ve 20.000 yazma hakkı var. Dolarsa site o günün sonuna kadar ürün gösteremez, sipariş alamaz. Müşteriler çok az okuma yapar; en büyük yük <b>bu yönetim paneli</b>: panel açılınca aşağıda seçtiğiniz kadar günün siparişlerini ve taleplerini yükler (yarım saatten uzun kapalı kaldıysa baştan okur).</p>

    <BillCard />

    <h4 className="qt-h">Son 24 saat</h4>
    {u === undefined ? <p className="fine">Yükleniyor…</p> : !u ? <p className="fine">Henüz rapor yok. Her gece 23:47'de hazırlanır.</p> : <div className="qt-box">
      {u.read != null ? <><Bar l="Veritabanı okuma" v={u.read} lim={50000} /><Bar l="Veritabanı yazma" v={u.write} lim={20000} /></>
        : <p className="fine qt-fs">Veritabanı okuma/yazma sayısını Google ücretsiz planda dışarıya vermiyor; <a href="https://console.firebase.google.com/project/erteltoptan/firestore/databases/-default-/usage" target="_blank" rel="noopener">Firebase › Firestore › Usage</a> sayfasından günlük grafiği görebilirsiniz.</p>}
      <Bar l="Bekçi istekleri" v={u.cfReq} lim={100000} />
      <Bar l="Bekçi kayıt (KV)" v={u.kvWrite} lim={1000} />
      <small className="fine">Rapor: {new Date(u.at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</small>
    </div>}

    <h4 className="qt-h">Siparişler ve talepler kaç günlük açılsın</h4>
    <p className="fine">Mağaza siparişleri, bayi siparişleri/talepleri, ürün talepleri, sorun bildirimleri ve yorumlar. <b>Bekleyen / hazırlanan / kargodaki</b> kayıtlar tarihine bakmadan HER ZAMAN yüklenir; daha eskiler listenin son sayfasının altındaki <b>“30 gün daha eskisini yükle”</b> düğmesiyle ya da Siparişler'deki <b>Tarih</b> düğmesiyle gelir. Sipariş numarasını aramaya yazarsanız sipariş ne kadar eski olursa olsun bulunur. Müşteri penceresinde müşterinin bütün siparişleri her zaman tam görünür. Not: Genel bakış'taki “bu ay” sayıları da yüklenen günlerden hesaplanır; 14 gün seçiliyken “bu ay” ve önceki dönemle karşılaştırma eksik çıkabilir.</p>
    <Pick value={days} onChange={(v) => set('quota.win', v)} opts={DAYS} />
    <p className="fine qt-est">Günde 100 siparişte panelin her açılışı yaklaşık <b>{fmtN(days * 100 + 300)}</b> okuma (şu an sipariş az, gerçek sayı çok daha düşük).</p>

    <h4 className="qt-h">Mağaza üyeleri kaç günlük açılsın</h4>
    <p className="fine">Genel bakış'taki “yeni üye” sayısı ve bildirimler için. <b>Müşteriler › Mağaza müşterileri</b> açılınca bütün üyeler yine yüklenir.</p>
    <Pick value={mem} onChange={(v) => set('quota.members', v)} opts={MDAYS} />

    <h4 className="qt-h">Günlük rapor</h4>
    <Toggle id="s-q-rep" label="Her gece kullanım raporu Telegram'a gelsin" hint="Sınırın %70'ini geçen satırda ⚠️ olur" checked={Q.report !== false} onChange={(v) => set('quota.report', v)} />
    <p className="fine">Değişiklikler panel bir sonraki açılışında uygulanır.</p>
  </>;
}

// ---- Fatura ve harcama (31.10.2026, Blaze hazırlığı): durum, otomatik durdurma sınırı, acil durdurma düğmesi ----
const W = () => (window.WATCH_URL || '').replace(/\/$/, '');
async function bill(act, body = {}) {
  const tok = await api().idToken?.(); if (!tok) throw new Error('Oturum bulunamadı');
  const r = await fetch(W() + '/billing/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.error || 'Bekçi cevap vermedi'); return j;
}
const usd = (n) => '$' + (Math.round((n || 0) * 100) / 100).toFixed(2);
const when = (t) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
function BillCard() {
  const [s, setS] = useState(undefined);
  const [cap, setCap] = useState('');
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState('');
  const [ask, setAsk] = useState(false);
  const load = () => bill('state').then((x) => { setS(x); setCap(x.cfg?.cap ? String(x.cfg.cap) : ''); setAuto(x.cfg?.auto !== false); }).catch((e) => setS({ err: e.message }));
  useEffect(() => { if (api().mode === 'firebase') load(); else setS({ err: 'Deneme sitesinde çalışmaz' }); }, []);
  const run = async (k, f, ok) => { setBusy(k); try { await f(); if (ok) toast(ok); await load(); } catch (e) { toast(e.message, 'bad'); } setBusy(''); };
  const on = s?.info?.enabled; const st = s?.st || {};
  const plan = s === undefined ? 'Yükleniyor…' : s.err ? s.err : s.info?.error ? 'Fatura durumu okunamadı' : on ? 'Ücretli plan (Blaze) açık' : st.stopped ? 'Ücretli kullanım DURDURULDU' : 'Ücretsiz plan (Spark)';
  return (
    <div className={'qt-box bill' + (on ? ' on' : st.stopped ? ' stop' : '')}>
      <div className="bill-h"><Icon n="shield" s={18} /><b>Fatura ve harcama</b><span className="bill-plan">{plan}</span></div>
      {s?.info?.error && <p className="fine">{s.info.error.includes('permission') || s.info.error.includes('PERMISSION') ? 'Servis hesabının fatura yetkisi yok — Blaze kurulum adımlarındaki rolleri verin.' : s.info.error}</p>}
      {on && <p className="bill-cost"><span>Bu ay</span><b className="num">{st.at ? usd(st.usd) : '—'}</b>{st.cur && st.cur !== 'USD' && <small className="num">{st.cur === 'TRY' ? '₺' : st.cur + ' '}{(st.cost || 0).toFixed(2)}</small>}<small>{st.at ? 'Google verisi: ' + when(st.at) + ' (birkaç saat gecikmeli)' : 'Henüz harcama verisi gelmedi (bütçe kurulunca günde birkaç kez gelir)'}</small></p>}
      <p className="fine">Ücretsiz hak bitince ve <b>her tam dolarda</b> Telegram, e-posta ve yönetici bildirimiyle haber gelir.</p>
      <div className="bill-row">
        <Field label="Otomatik durdurma sınırı ($/ay)" opt hint="Bu ayın harcaması bu tutara gelince ücretli kullanım kendiliğinden kapanır. Boş = kapatma yok."><input inputMode="numeric" value={cap} placeholder="ör. 10" onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} /></Field>
        <button className="btn sm outline" disabled={!!busy || !s || s.err} onClick={() => run('cfg', () => bill('cfg', { cap: Number(cap) || 0, auto }), 'Kaydedildi')}>{busy === 'cfg' ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </div>
      <div className="row-btns">
        <button className="btn sm ghost" disabled={!!busy || !s || s.err} onClick={() => run('test', () => bill('test'), 'Deneme bildirimi gönderildi')}><Icon n="bell" s={15} />Bildirim denemesi</button>
        {on && <button className="btn sm danger" disabled={!!busy} onClick={() => setAsk(true)}><Icon n="x" s={15} />{busy === 'stop' ? 'Durduruluyor…' : 'Ücretli kullanımı şimdi durdur'}</button>}
      </div>
      {s?.log?.length > 0 && <ul className="bill-log">{s.log.slice(0, 5).map((x, i) => <li key={i}><span>{when(x.at)}</span>{x.title}</li>)}</ul>}
      {!on && st.stopped && <p className="fine">Geri açmak için: Firebase › Kullanım ve faturalandırma › <b>Blaze planına geç</b> (aynı kartı seçin). Açınca bu kart yeniden harcamayı göstermeye başlar.</p>}
      {ask && <Confirm title="Ücretli kullanım durdurulsun mu?" text="Projenin kartla bağlantısı kesilir, site ücretsiz plan sınırlarına döner. Veriler SİLİNMEZ; sadece günlük ücretsiz hak dolarsa o gün sipariş/ürün okunamaz. Sonra Firebase'den tekrar Blaze'e geçerek açabilirsiniz." okLabel="Evet, durdur" tone="danger" onClose={() => setAsk(false)} onOk={() => run('stop', () => bill('stop'), 'Ücretli kullanım durduruldu')} />}
    </div>
  );
}

