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
  return (
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
  );
}
