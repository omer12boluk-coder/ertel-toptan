// 15.11.2026 Tek satır üst menü — SADECE önizlemede (adında '--' olan adres) sol altta 'Üst menü' paneli.
// Seçimler bu cihazda (ls 'hdr-try') saklanır ve canlı ayarın (look.header, look.gs1*) ÜSTÜNE yazılır; canlıya hiçbir şey gitmez.
import { useEffect, useState } from 'react';
import { ls } from './utils.js';
import { useStore } from './store.js';
import { GS1_ROWS } from './designer.jsx';

// 16.11.2026: Claude'daki demo sayfasında da (canlı adres değilse) panel açık
export const HDR_TRY = typeof location !== 'undefined' && (location.hostname.includes('--') || /[?&]ustmenu\b/.test(location.search) || !/ertelmarket\.com|web\.app|firebaseapp\.com/.test(location.hostname));
const DEF = { header: 'search1' }; // önizleme ilk açılışta Tek satır ile gelir
// logo-spot dalı: bu önizlemede SADECE bu tasarım (panel yok, cihazdaki eski denemeler yok sayılır)
const ONLY = { header: 'search1', gs1Lbl: 'spot', gs1Name: 'off', gs1Home: 'off' };
const read = () => ONLY;
const subs = new Set();
let cur = HDR_TRY ? read() : null;
const put = (v) => { cur = v; ls.set('hdr-try', v); subs.forEach((f) => f(v)); };

// main.jsx: canlı look'un üstüne önizleme seçimleri
export function useHdrTry() {
  const [v, setV] = useState(cur);
  useEffect(() => { if (!HDR_TRY) return undefined; subs.add(setV); return () => subs.delete(setV); }, []);
  return v;
}

const HDRS = [['search1', 'Yüzen cam (tek satır)'], ['', 'Canlıdaki menü']];
export function HdrPanel() {
  const v = useHdrTry();
  const live = useStore((s) => s.settings?.look) || {};
  // seçili görünen = önizlemede seçilen, yoksa CANLIDAKİ değer (eskiden canlıda 'Simge' varken 'Kutu' seçili görünüp basılamıyordu)
  const eff = (k) => String((k in v ? v[k] : live[k]) ?? '');
  const [open, setOpen] = useState(() => ls.get('hdr-try-open', true));
  const tog = (o) => { ls.set('hdr-try-open', o); setOpen(o); };
  if (!HDR_TRY || ONLY) return null;
  // 16.11.2026: '' de yazılır (silinince canlıdaki değer geri geliyordu → 'Kutu' gibi varsayılan seçenekler seçilemiyordu)
  const set = (k, x) => { const n = { ...v }; n[k] = x; put(n); };
  const one = v.header === 'search1';
  return (
    <div className={'an-panel an-left' + (open ? ' open' : '')}>
      {open && <div className="an-box" role="dialog" aria-label="Üst menü denemesi">
        <div className="an-ph"><b>Üst menü denemesi</b><small>Sadece bu önizlemede, bu cihazda. Ayarlar bilgisayar görünümü içindir; telefonda menü aynı.</small></div>
        <small className="an-dev">Üst menü</small>
        {HDRS.map(([k, t]) => <label key={'h' + k} className="an-row"><input type="radio" name="hdr-h" checked={(v.header || '') === k} onChange={() => set('header', k)} /><span>{t}</span></label>)}
        {one && GS1_ROWS.map(([k, lb, , o]) => (
          <div key={k}>
            <small className="an-dev">{((x) => x[0].toLocaleUpperCase('tr') + x.slice(1))(lb.replace('Yüzen cam: ', ''))}</small>
            {o.map(([x, t]) => <label key={k + x} className="an-row"><input type="radio" name={'hdr-' + k} checked={eff(k) === x} onChange={() => set(k, x)} /><span>{t}</span></label>)}
          </div>
        ))}
        {one && <div>
          <small className="an-dev">Aşağı kaydırınca</small>
          {[['', 'Canlıdaki gibi'], ['island', 'Ada (logo · arama · sepet · hesap)'], ['hide', 'Gizlensin'], ['open', 'Hep açık']].map(([x, t]) => <label key={'s' + x} className="an-row"><input type="radio" name="hdr-scr" checked={(v.scr || '') === x} onChange={() => { const n = { ...v }; delete n.hdrScroll; delete n.hideTop; delete n.scr; if (x) { n.scr = x; if (x === 'island') n.hdrScroll = 'island'; else { n.hdrScroll = ''; n.hideTop = x === 'open' ? false : 'top'; } } put(n); }} /><span>{t}</span></label>)}
        </div>}
        <div className="an-ft">
          <button type="button" onClick={() => put(DEF)}>Varsayılana dön</button>
          <button type="button" className="pri" onClick={() => tog(false)}>Kapat</button>
        </div>
      </div>}
      <button type="button" className="an-fab" onClick={() => tog(!open)} aria-expanded={open}>Üst menü <span>{one ? 'tek satır' : 'canlı'}</span></button>
    </div>
  );
}
