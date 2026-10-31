// Ayarlar > Veri ve kota (31.10.2026): yönetim panelinin açılışta ne kadar geçmiş yüklediği + günlük kullanım raporu.
// Ücretsiz Firebase planı günde 50.000 okuma verir; dolarsa site o gün veri çekemez. En büyük yük panelin açılışı.
import { useEffect, useState } from 'react';
import { api } from './store.js';
import { Toggle } from './ui.jsx';

const DAYS = [[14, '14 gün', 'En hafif'], [30, '30 gün', 'Dengeli'], [62, '62 gün', 'Şu anki'], [120, '120 gün', 'En ağır']];
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
  const days = [14, 30, 62, 120].includes(Number(Q.days)) ? Number(Q.days) : 62;
  const mem = [14, 30, 62, 120].includes(Number(Q.members)) ? Number(Q.members) : 62;
  const [u, setU] = useState(undefined);
  useEffect(() => { api().getUsage?.().then((x) => setU(x || null)).catch(() => setU(null)); }, []);
  return <>
    <p className="fine">Site ücretsiz Firebase planında: veritabanından <b>günde 50.000 okuma</b> ve 20.000 yazma hakkı var. Dolarsa site o günün sonuna kadar ürün gösteremez, sipariş alamaz. Müşteriler çok az okuma yapar; en büyük yük <b>bu yönetim paneli</b>: panel açılınca aşağıda seçtiğiniz kadar günün siparişlerini ve taleplerini yükler (yarım saatten uzun kapalı kaldıysa baştan okur).</p>

    <h4 className="qt-h">Son 24 saat</h4>
    {u === undefined ? <p className="fine">Yükleniyor…</p> : !u ? <p className="fine">Henüz rapor yok. Her gece 23:47'de hazırlanır.</p> : <div className="qt-box">
      {u.read != null ? <><Bar l="Veritabanı okuma" v={u.read} lim={50000} /><Bar l="Veritabanı yazma" v={u.write} lim={20000} /></>
        : <p className="fine qt-fs">Veritabanı okuma/yazma sayısını Google ücretsiz planda dışarıya vermiyor; <a href="https://console.firebase.google.com/project/erteltoptan/firestore/databases/-default-/usage" target="_blank" rel="noopener">Firebase › Firestore › Usage</a> sayfasından günlük grafiği görebilirsiniz.</p>}
      <Bar l="Bekçi istekleri" v={u.cfReq} lim={100000} />
      <Bar l="Bekçi kayıt (KV)" v={u.kvWrite} lim={1000} />
      <small className="fine">Rapor: {new Date(u.at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</small>
    </div>}

    <h4 className="qt-h">Siparişler ve talepler kaç günlük açılsın</h4>
    <p className="fine">Mağaza siparişleri, bayi siparişleri/talepleri, ürün talepleri, sorun bildirimleri ve yorumlar. <b>Bekleyen / hazırlanan / kargodaki</b> kayıtlar tarihine bakmadan HER ZAMAN yüklenir; daha eskiler listenin altındaki <b>“Daha eski … göster”</b> ile gelir. Sipariş numarasını aramaya yazarsanız sipariş ne kadar eski olursa olsun bulunur. Müşteri penceresinde müşterinin bütün siparişleri her zaman tam görünür. Genel bakış'taki “bu ay / önceki ay” karşılaştırması 62 günden kısa seçilirse eksik hesaplanır.</p>
    <Pick value={days} onChange={(v) => set('quota.days', v)} opts={DAYS} />
    <p className="fine qt-est">Günde 100 siparişte panelin her açılışı yaklaşık <b>{fmtN(days * 100 + 300)}</b> okuma (şu an sipariş az, gerçek sayı çok daha düşük).</p>

    <h4 className="qt-h">Mağaza üyeleri kaç günlük açılsın</h4>
    <p className="fine">Genel bakış'taki “yeni üye” sayısı ve bildirimler için. <b>Müşteriler › Mağaza müşterileri</b> açılınca bütün üyeler yine yüklenir.</p>
    <Pick value={mem} onChange={(v) => set('quota.members', v)} opts={DAYS} />

    <h4 className="qt-h">Günlük rapor</h4>
    <Toggle id="s-q-rep" label="Her gece kullanım raporu Telegram'a gelsin" hint="Sınırın %70'ini geçen satırda ⚠️ olur" checked={Q.report !== false} onChange={(v) => set('quota.report', v)} />
    <p className="fine">Değişiklikler panel bir sonraki açılışında uygulanır.</p>
  </>;
}
