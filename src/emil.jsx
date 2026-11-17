// 17.11.2026 Emil Kowalski kurallarıyla tasarım düzeltmeleri — SADECE önizlemede (adında '--' olan adres ya da Claude demosu).
// Sağ altta 'Düzeltmeler' paneli: her düzeltme tek tek aç/kapat (bu cihazda, ls 'em-try'), kapatınca canlıdaki eski hâl görünür.
// Her düzeltme html sınıfı em-<anahtar> ile çalışır (CSS style.css sonunda 'Emil düzeltmeleri'); canlı adreste hiçbir sınıf eklenmez
// → canlı site BİREBİR aynı. Beğenilenler sonra kalıcı ayara bağlanır.
import { useEffect, useState } from 'react';
import { ls } from './utils.js';

export const EM_HOST = typeof location !== 'undefined' && (location.hostname.includes('--') || /[?&]emil\b/.test(location.search) || !/ertelmarket\.com|web\.app|firebaseapp\.com/.test(location.hostname));

// [anahtar, no, başlık, ne değişti]
export const EMS = [
  ['nav', '1', 'Menü yazıları okunur', 'Üst menüde Ürünler / Kalıp bulucu… %46 silik griydi (okunurluk 3:1). Şimdi %68 (5:1), üstüne gelince yine tam koyu.'],
  ['dots', '4', 'Banner seçici: akıcı geçiş', 'Seçili çubuk banner kayarken aynı anda yumuşakça uzar, eskisi kısalır; basma alanı büyük (32 px). Sayaç yok.'],
  ['hubm', '6', 'Ürünler açılışı (telefon)', 'Kutu yazısı resmin üstüne binmiyor; Tamir Ekipmanları alt kategorileri kesilmeden yana kayan tek satır.'],
  ['hubd', '7', 'Ürünler açılışı (bilgisayar)', 'Tamir Ekipmanları alt kategorileri dağınık haplar yerine düzgün liste (ok işaretli satırlar).'],
  ['tot', '11', 'Ürün sayfası: tekrar eden Toplam', 'Adet 1 iken "Toplam" aynı fiyatı ikinci kez yazıyordu; adet artınca çıkar (yeri korunur, sayfa kaymaz).'],
  ['gal', '12', 'Ürün sayfası: büyük resim (bilgisayar)', 'Ürün resmi 300 px idi; sayfanın %42\'si kadar büyüdü. Ürünü görmek sayfanın asıl işi.'],
  ['buy', '13', 'Ürün sayfası: alttaki satın al çubuğu (telefon)', 'Telefonda "Sepete ekle" ilk ekranda görünmüyordu. Düğme ekrandan çıkınca altta fiyat + Sepete ekle çubuğu belirir (sepet sayfasındakinin aynısı).'],
  ['tbl', '14', 'Ürün açıklaması: teknik tablo', 'Kalın çerçeveli ham tablo yerine ince çizgili, sade tablo; başlıklar arası boşluk düzgün.'],
  ['qty', '15', 'Sepet: 4 haneli adet ve büyük tutar', '1000+ adet kutuya sığmıyordu, büyük toplam sil düğmesinin üstüne biniyordu (telefon + bilgisayar).'],
  ['brand', '16', 'Marka sayfası başlığı', 'Marka sayfasında başlık "Tüm ürünler." yazıyordu; artık markanın adı (ör. "JCID.").'],
  ['set', '17', 'Set sayfası hizası', 'Set sayfası sola yaslı, sağda 200 px boşluk vardı; sayfa ortalandı, stok uyarısı fiyat kutusuyla aynı hizada.'],
  ['kf', '18', 'Kalıp bulucu başlığı', 'Başlık diğer sayfalar gibi büyük ("Kalıp bulucu."); müşteriye görünen "Telefon listesi sürüm 1.0.0" yazısı gizli.'],
  ['hubfast', '19', 'Ürünler açılışı: daha hızlı giriş', 'Kutuların yerine oturması ~1,75 sn sürüyordu; aynı hareket ~0,7 sn. Sık açılan sayfada içerik beklemesin.'],
  ['bndk', '20', 'Gece modunda banner parlaklığı', 'Gece modunda bembeyaz banner göz alıyordu; hafifçe kısıldı (resim ve yazılar aynı).'],
  ['anim', '10', 'Animasyon kuralları', 'Kapanışlar hızlı başlar (ease-in → ease-out), çekip yenile göstergesi sıfırdan değil 0,9\'dan küçülür, "transition: all" yok.'],
];
const KEYS = EMS.map((x) => x[0]);
const read = () => { const v = ls.get('em-try', null); return v && typeof v === 'object' ? { ...Object.fromEntries(KEYS.map((k) => [k, true])), ...v } : Object.fromEntries(KEYS.map((k) => [k, true])); };
let cur = EM_HOST ? read() : {};
const subs = new Set();
const put = (v) => { cur = v; ls.set('em-try', v); subs.forEach((f) => f(v)); };
export const emOn = (k) => !!cur[k];
// ilk çizimden önce sınıflar (panel açılmadan da düzeltmeler görünsün)
if (EM_HOST && typeof document !== 'undefined') KEYS.forEach((k) => { if (cur[k]) document.documentElement.classList.add('em-' + k); });
// JSX'te metin değişen düzeltmeler için (ör. arama kutusu yazısı)
export function useEm(k) {
  const [v, setV] = useState(cur);
  useEffect(() => { if (!EM_HOST) return undefined; subs.add(setV); return () => subs.delete(setV); }, []);
  return !!v[k];
}

// 13 · Telefonda ürün sayfası: asıl 'Sepete ekle' ekrandan çıkınca altta çubuk (sepet sayfasındaki .cart-bar görünümü).
// Düğme asıl düğmeye tıklar → sepet mantığı aynı, ayrı kod yok.
function BuyBar() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const on = document.documentElement.classList.contains('em-buy') && innerWidth < 900;
      const btn = on && document.querySelector('.pdetail-page .pbuy-btns button');
      const pg = btn && btn.closest('.pdetail-page');
      if (!btn || !pg || pg.closest('.kp-off')) { setSt((o) => (o ? null : o)); return; }
      const r = btn.getBoundingClientRect(); const bot = innerHeight - 90;
      const show = r.top > bot || r.bottom < 70;
      const pr = (pg.querySelector('.price.big .price-mine')?.textContent || '').replace(/^Fiyat:\s*/i, '').replace('+KDV', '').trim();
      const lb = btn.textContent.trim();
      setSt((o) => (show ? (o && o.pr === pr && o.lb === lb ? o : { pr, lb }) : (o ? null : o)));
    };
    const q = () => { if (!raf) raf = requestAnimationFrame(check); };
    addEventListener('scroll', q, { passive: true }); addEventListener('resize', q);
    const t = setInterval(q, 400);
    return () => { removeEventListener('scroll', q); removeEventListener('resize', q); clearInterval(t); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('em-buy-on', !!st); }, [st]);
  if (!st) return null;
  const click = () => document.querySelector('.pdetail-page .pbuy-btns button')?.click();
  return (
    <div className="cart-bar em-buybar">
      <div className="cart-bar-t"><small>Fiyat</small><b className="num">{st.pr}</b></div>
      <button type="button" className="btn primary" onClick={click}>{st.lb}</button>
    </div>
  );
}

export function EmilPanel() {
  const [v, setV] = useState(cur);
  const [open, setOpen] = useState(() => ls.get('em-try-open', true));
  useEffect(() => { if (!EM_HOST) return undefined; subs.add(setV); return () => subs.delete(setV); }, []);
  useEffect(() => {
    if (!EM_HOST) return undefined;
    const c = document.documentElement.classList; const on = KEYS.filter((k) => v[k]);
    KEYS.forEach((k) => c.toggle('em-' + k, on.includes(k)));
    return undefined;
  }, [v]);
  if (!EM_HOST) return null;
  const tog = (o) => { ls.set('em-try-open', o); setOpen(o); };
  const all = (b) => put(Object.fromEntries(KEYS.map((k) => [k, b])));
  const n = KEYS.filter((k) => v[k]).length;
  return (<>
    {v.buy && <BuyBar />}
    <div className={'an-panel em-panel' + (open ? ' open' : '')}>
      {open && <div className="an-box" role="dialog" aria-label="Tasarım düzeltmeleri">
        <div className="an-ph"><b>Tasarım düzeltmeleri</b><small>Emil Kowalski kurallarıyla. Kapatınca canlıdaki eski hâl görünür. Sadece bu önizlemede, bu cihazda.</small></div>
        {EMS.map(([k, no, t, d]) => (
          <label key={k} className="an-row em-row"><input type="checkbox" checked={!!v[k]} onChange={(e) => put({ ...v, [k]: e.target.checked })} /><span className="an-l">{no}</span><span className="em-tx"><b>{t}</b><small>{d}</small></span></label>
        ))}
        <div className="an-ft">
          <button type="button" onClick={() => all(true)}>Hepsi yeni</button>
          <button type="button" onClick={() => all(false)}>Hepsi eski</button>
          <button type="button" className="pri" onClick={() => tog(false)}>Kapat</button>
        </div>
      </div>}
      <button type="button" className="an-fab" onClick={() => tog(!open)} aria-expanded={open}>Düzeltmeler <span>{n}/{KEYS.length} yeni</span></button>
    </div>
  </>);
}
