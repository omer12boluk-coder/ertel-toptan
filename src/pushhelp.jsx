// Müşteri: "Telefon bildirimleri nasıl açılır?" — görselli adım adım küçük pencere (29.10.2026)
// iPhone (ana ekrana ekle şart) / Android sekmeleri; çizimler basit SVG telefon ekranları, renkler temadan.
import { useState } from 'react';
import { Icon, Sheet } from './ui.jsx';
import { isIOS } from './push.js';
import { useStore } from './store.js';

const Phone = ({ children, h = 150 }) => (
  <svg className="ph-svg" viewBox={`0 0 120 ${h}`} aria-hidden="true">
    <rect x="1" y="1" width="118" height={h - 2} rx="16" className="ph-body" />
    <rect x="8" y="8" width="104" height={h - 16} rx="10" className="ph-screen" />
    {children}
  </svg>
);
const Hi = ({ x, y, w, h, r = 6 }) => <rect x={x} y={y} width={w} height={h} rx={r} className="ph-hi" />;
const Finger = ({ x, y }) => <g className="ph-tap" transform={`translate(${x} ${y})`}><circle r="9" /><circle r="4" className="ph-tap-c" /></g>;
const Lines = ({ y, n = 3 }) => <g className="ph-txt">{Array.from({ length: n }, (_, i) => <rect key={i} x="18" y={y + i * 9} width={i === n - 1 ? 50 : 84} height="4" rx="2" />)}</g>;

// iPhone adımları
const I1 = () => (
  <Phone>
    <Lines y={30} n={4} />
    <rect x="8" y="112" width="104" height="30" className="ph-bar" />
    <path d="M20 127h8M24 123l-4 4 4 4" className="ph-ico" />
    <rect x="38" y="120" width="44" height="12" rx="6" className="ph-url" />
    <g transform="translate(95 127)" className="ph-ico"><path d="M0 -6v8M-3 -3l3 -3 3 3" /><path d="M-5 -1h-1v7h12v-7h-1" /></g>
    <Hi x={86} y={116} w={20} h={22} />
    <Finger x={104} y={138} />
  </Phone>
);
const I2 = () => (
  <Phone>
    <rect x="8" y="52" width="104" height="90" rx="10" className="ph-sheet" />
    <g className="ph-txt"><rect x="18" y="64" width="40" height="4" rx="2" /></g>
    {[0, 1, 2].map((i) => <rect key={i} x="16" y={76 + i * 20} width="88" height="16" rx="5" className="ph-row" />)}
    <g transform="translate(16 116)"><rect width="88" height="16" rx="5" className="ph-row on" /><rect x="7" y="4" width="8" height="8" rx="2" className="ph-plus" /><path d="M11 6v4M9 8h4" className="ph-plus-i" /><rect x="22" y="6" width="44" height="4" rx="2" className="ph-row-t" /></g>
    <Hi x={13} y={113} w={94} h={22} />
    <Finger x={74} y={128} />
  </Phone>
);
const I3 = ({ logo }) => (
  <Phone>
    {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (r === 1 && c === 2 ? null : <rect key={r + '' + c} x={18 + c * 23} y={22 + r * 28} width="16" height="16" rx="4" className="ph-app" />)))}
    <g transform="translate(64 50)">
      {logo ? <image href={logo} width="16" height="16" clipPath="inset(0 round 4px)" /> : <rect width="16" height="16" rx="4" className="ph-app on" />}
    </g>
    <Hi x={60} y={46} w={24} h={30} />
    <Finger x={78} y={62} />
  </Phone>
);
const I4 = () => (
  <Phone>
    <Lines y={24} n={2} />
    <rect x="16" y="50" width="88" height="22" rx="6" className="ph-row" />
    <rect x="22" y="57" width="40" height="4" rx="2" className="ph-row-t" />
    <rect x="80" y="55" width="18" height="11" rx="5.5" className="ph-tg" /><circle cx="92.5" cy="60.5" r="4" className="ph-tg-k" />
    <rect x="22" y="86" width="76" height="46" rx="9" className="ph-dlg" />
    <rect x="30" y="94" width="58" height="4" rx="2" className="ph-row-t" />
    <rect x="30" y="102" width="40" height="4" rx="2" className="ph-row-t" />
    <rect x="30" y="114" width="26" height="11" rx="4" className="ph-btn" /><rect x="60" y="114" width="30" height="11" rx="4" className="ph-btn on" />
    <Hi x={57} y={111} w={36} h={17} r={5} />
    <Finger x={80} y={126} />
  </Phone>
);
// Android
const A1 = () => (
  <Phone>
    <rect x="8" y="8" width="104" height="22" className="ph-bar" />
    <rect x="16" y="13" width="72" height="12" rx="6" className="ph-url" />
    <g className="ph-dots"><circle cx="102" cy="15" r="1.6" /><circle cx="102" cy="19" r="1.6" /><circle cx="102" cy="23" r="1.6" /></g>
    <Hi x={95} y={10} w={14} h={18} />
    <rect x="50" y="30" width="60" height="70" rx="6" className="ph-sheet" />
    {[0, 1, 2, 3].map((i) => <rect key={i} x="56" y={38 + i * 15} width="48" height="10" rx="3" className={'ph-row' + (i === 2 ? ' on' : '')} />)}
    <Finger x={82} y={74} />
    <Lines y={110} n={3} />
  </Phone>
);

const IOS_STEPS = [
  [I1, 'Paylaş düğmesine dokunun', 'Safari’nin alt çubuğundaki kare-ok simgesi. Görünmüyorsa önce ••• düğmesine dokunun.'],
  [I2, '“Ana Ekrana Ekle”yi seçin', 'Listeyi biraz aşağı kaydırmanız gerekebilir. Sonra sağ üstteki “Ekle”ye dokunun.'],
  [I3, 'Ana ekrandaki simgeden açın', 'Artık mağaza bir uygulama gibi açılır. Bildirimler sadece bu simgeden açılınca çalışır.'],
  [I4, 'Bildirimleri açıp izin verin', 'Hesabım > Bildirimler’deki anahtarı açın, çıkan pencerede “İzin Ver”e dokunun.'],
];
const AND_STEPS = [
  [I4, 'Anahtarı açıp izin verin', 'Hesabım > Bildirimler’deki anahtarı açın, çıkan pencerede “İzin ver”e dokunun. Bu kadar.'],
  [A1, 'İsterseniz ana ekrana ekleyin', 'Chrome’da sağ üstteki ⋮ menüsü → “Ana ekrana ekle”. Mağaza uygulama gibi açılır (şart değil).'],
];

export function PushHelp({ onClose, state }) {
  const S = useStore((s) => s.settings);
  const [os, setOs] = useState(isIOS() ? 'ios' : 'and');
  const steps = os === 'ios' ? IOS_STEPS : AND_STEPS;
  return (
    <Sheet title="Bildirimler nasıl açılır?" onClose={onClose} cls="ph-sheet-w" footer={<button className="btn primary" onClick={onClose}><Icon n="check" s={16} />Anladım</button>}>
      <p className="ph-lead">Siparişiniz onaylanınca, kargoya verilince ve favorinizin fiyatı düşünce telefonunuza bildirim gelir — ekran kilitliyken bile.</p>
      <div className="seg ph-os" role="tablist">
        <button role="tab" className={os === 'ios' ? 'on' : ''} onClick={() => setOs('ios')}>iPhone</button>
        <button role="tab" className={os === 'and' ? 'on' : ''} onClick={() => setOs('and')}>Android</button>
      </div>
      {state === 'denied' && (
        <p className="banner warn ph-denied"><Icon n="bell" s={16} /><span>Bu cihazda bildirim izni daha önce reddedilmiş. {os === 'ios' ? 'iPhone Ayarlar > Bildirimler > ' + (S.brand?.appName || 'ERTEL GSM') + ' → “Bildirimlere İzin Ver”i açın.' : 'Chrome’da adres çubuğundaki ayar simgesi → İzinler → Bildirimler → İzin ver.'}</span></p>
      )}
      <ol className="ph-steps">
        {steps.map(([Pic, t, d], i) => (
          <li key={os + i}>
            <div className="ph-pic"><Pic logo={S.brand?.logo} /></div>
            <div className="ph-t"><span className="ph-n">{i + 1}</span><b>{t}</b><small>{d}</small></div>
          </li>
        ))}
      </ol>
      <p className="fine ph-note"><Icon n="check" s={14} />Bildirimi istediğiniz zaman aynı anahtardan kapatabilirsiniz.</p>
    </Sheet>
  );
}
