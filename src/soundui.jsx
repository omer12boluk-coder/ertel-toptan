// Ses efektleri aç/kapat (5.11.2026): bilgisayarda üst menüde hoparlör düğmesi, telefonda Hesabım'da anahtar
import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import { sfx, sfxEnabled, sfxAvailable, setSfxDevice, onSfxChange, sfxDevVol, setSfxDevVol } from './sfx.js';
import { useStore } from './store.js';

function useSfx() {
  const [, bump] = useState(0);
  useStore((s) => s.settings?.look?.sound);
  useEffect(() => onSfxChange(() => bump((x) => x + 1)), []);
  return sfxEnabled();
}
export function SoundButton() {
  const on = useSfx();
  const [v, setV] = useState(sfxDevVol);
  if (!sfxAvailable()) return null;
  // 6.11.2026 (6): üstüne gelince ses düzeyi kaydırıcısı açılır (bu tarayıcıya özel); tıklamak aç/kapat
  return <span className="sfx-wrap">
    <button className="icon-btn sfx-btn" onClick={() => { setSfxDevice(!on); if (!on) setTimeout(() => sfx('tap'), 30); }} aria-label={on ? 'Sesleri kapat' : 'Sesleri aç'} title={on ? 'Ses efektleri açık' : 'Ses efektleri kapalı'}>
      <Icon n="sound" s={19} />{!on && <i className="sfx-x" aria-hidden="true" />}
    </button>
    <span className="sfx-pop" role="group" aria-label="Ses düzeyi">
      <input type="range" min="0" max="1.5" step="0.05" value={v} aria-label="Ses düzeyi" onChange={(e) => { const x = Number(e.target.value); setV(x); setSfxDevVol(x); if (x > 0 && !on) setSfxDevice(true); clearTimeout(window.__sfxT); window.__sfxT = setTimeout(() => sfx('tap'), 90); }} style={{ '--p': (v / 1.5 * 100) + '%' }} />
      <b className="num">%{Math.round(v * 100)}</b>
    </span>
  </span>;
}
export function SoundToggle() {
  const on = useSfx();
  if (!sfxAvailable()) return null;
  return <button type="button" className={'sfx-row' + (on ? ' on' : '')} onClick={() => { setSfxDevice(!on); if (!on) setTimeout(() => sfx('tap'), 30); }} role="switch" aria-checked={on}>
    <span className="hub-ic"><Icon n="sound" s={18} /></span><span className="hub-t"><b>Ses efektleri</b><small>{on ? 'Açık · iPhone sessizdeyken çalmaz' : 'Kapalı'}</small></span><i className="sfx-sw" aria-hidden="true" />
  </button>;
}
