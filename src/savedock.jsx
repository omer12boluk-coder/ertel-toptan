// Arka plan kaydının durumu (yönetim paneli, sağ alt): Kaydediliyor… → ✓ Kaydedildi · hata: Tekrar dene
import { useStore } from './store.js';
import { Icon } from './ui.jsx';
import { retrySave } from './saveq.js';

export function SaveDock() {
  const qs = useStore((s) => s.qs);
  const admin = useStore((s) => s.user?.role === 'admin');
  if (!qs || !admin) return null;
  return (
    <div className={'save-dock ' + qs} role="status" aria-live="polite">
      {qs === 'saving' ? <><i className="qs-spin" />Kaydediliyor…</>
        : qs === 'saved' ? <><Icon n="check" s={14} />Kaydedildi</>
          : <><Icon n="x" s={14} />Kaydedilemedi<button type="button" onClick={retrySave}>Tekrar dene</button></>}
    </div>
  );
}
