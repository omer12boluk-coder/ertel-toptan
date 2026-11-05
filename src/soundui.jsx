// Ses efektleri aç/kapat (5.11.2026): bilgisayarda üst menüde hoparlör düğmesi, telefonda Hesabım'da anahtar
import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import { sfx, sfxEnabled, sfxAvailable, setSfxDevice, onSfxChange } from './sfx.js';
import { useStore } from './store.js';

function useSfx() {
  const [, bump] = useState(0);
  useStore((s) => s.settings?.look?.sound);
  useEffect(() => onSfxChange(() => bump((x) => x + 1)), []);
  return sfxEnabled();
}
export function SoundButton() {
  const on = useSfx();
  if (!sfxAvailable()) return null;
  return <button className="icon-btn sfx-btn" onClick={() => { setSfxDevice(!on); if (!on) setTimeout(() => sfx('add'), 30); }} aria-label={on ? 'Sesleri kapat' : 'Sesleri aç'} title={on ? 'Ses efektleri açık' : 'Ses efektleri kapalı'}>
    <Icon n="sound" s={19} />{!on && <i className="sfx-x" aria-hidden="true" />}
  </button>;
}
export function SoundToggle() {
  const on = useSfx();
  if (!sfxAvailable()) return null;
  return <button type="button" className={'sfx-row' + (on ? ' on' : '')} onClick={() => { setSfxDevice(!on); if (!on) setTimeout(() => sfx('add'), 30); }} role="switch" aria-checked={on}>
    <span className="hub-ic"><Icon n="sound" s={18} /></span><span className="hub-t"><b>Ses efektleri</b><small>{on ? 'Açık · iPhone sessizdeyken çalmaz' : 'Kapalı'}</small></span><i className="sfx-sw" aria-hidden="true" />
  </button>;
}
