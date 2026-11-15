// 15.11.2026 Tek satır üst menü — SADECE önizlemede (adında '--' olan adres) sol altta 'Üst menü' paneli.
// Seçimler bu cihazda (ls 'hdr-try') saklanır ve canlı ayarın (look.header, look.gs1*) ÜSTÜNE yazılır; canlıya hiçbir şey gitmez.
import { useEffect, useState } from 'react';
import { ls } from './utils.js';
import { GS1_ROWS } from './designer.jsx';

export const HDR_TRY = typeof location !== 'undefined' && (location.hostname.includes('--') || /[?&]ustmenu\b/.test(location.search));
const DEF = { header: 'search1' }; // önizleme ilk açılışta Tek satır ile gelir
const read = () => { const v = ls.get('hdr-try', null); return v && typeof v === 'object' ? v : DEF; };
const subs = new Set();
let cur = HDR_TRY ? read() : null;
const put = (v) => { cur = v; ls.set('hdr-try', v); subs.forEach((f) => f(v)); };

// main.jsx: canlı look'un üstüne önizleme seçimleri
export function useHdrTry() {
  const [v, setV] = useState(cur);
  useEffect(() => { if (!HDR_TRY) return undefined; subs.add(setV); return () => subs.delete(setV); }, []);
  return v;
}

const HDRS = [['search1', 'Tek satır (yeni)'], ['', 'Canlıdaki menü']];
export function HdrPanel() {
  const v = useHdrTry();
  const [open, setOpen] = useState(() => ls.get('hdr-try-open', true));
  const tog = (o) => { ls.set('hdr-try-open', o); setOpen(o); };
  if (!HDR_TRY) return null;
  const set = (k, x) => { const n = { ...v }; if (x) n[k] = x; else delete n[k]; put(n); };
  const one = v.header === 'search1';
  return (
    <div className={'an-panel an-left' + (open ? ' open' : '')}>
      {open && <div className="an-box" role="dialog" aria-label="Üst menü denemesi">
        <div className="an-ph"><b>Üst menü denemesi</b><small>Sadece bu önizlemede, bu cihazda. Ayarlar bilgisayar görünümü içindir; telefonda menü aynı.</small></div>
        <small className="an-dev">Üst menü</small>
        {HDRS.map(([k, t]) => <label key={'h' + k} className="an-row"><input type="radio" name="hdr-h" checked={(v.header || '') === k} onChange={() => set('header', k)} /><span>{t}</span></label>)}
        {one && GS1_ROWS.map(([k, lb, , o]) => (
          <div key={k}>
            <small className="an-dev">{((x) => x[0].toLocaleUpperCase('tr') + x.slice(1))(lb.replace('Tek satır: ', ''))}</small>
            {o.map(([x, t]) => <label key={k + x} className="an-row"><input type="radio" name={'hdr-' + k} checked={(v[k] || '') === x} onChange={() => set(k, x)} /><span>{t}</span></label>)}
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
