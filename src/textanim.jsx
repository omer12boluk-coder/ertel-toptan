// 13.11.2026 Banner yazı animasyonu — Magic UI 'text-animate' uyarlaması (motion/framer kütüphanesi YOK → düz CSS, .ta-*).
// Yazı kelime / harf parçalarına bölünür, her parça sırayla (--d gecikmesiyle) gelir. Animasyon SADECE etkin bannerda
// (.sh-slide.on) oynar; etkin olmayanda yazı normal görünür (çıkan banner yazısı kaybolmaz, giren banner her seferinde baştan oynar).
// Ayar: shopHome.txtAnim  '' = blurInUp (varsayılan) | 'blurIn' | 'slideUp' | 'char' (harf harf) | 'scaleUp' | 'off' (eski, animasyonsuz)
export const TA_OPTS = [['', 'Bulanıktan'], ['slideUp', 'Yukarı kayma'], ['char', 'Harf harf'], ['scaleUp', 'Büyüme'], ['blurIn', 'Yerinde netleşme'], ['off', 'Kapalı']];
const STEP = { word: 0.06, char: 0.022 };
// text: yazı (\n satır sonu korunur), by: 'word' | 'char', d: başlangıç gecikmesi (sn); dönen değer: kaç parça (sonraki satırın gecikmesi için)
export function TA({ text, by = 'word', d = 0, mode }) {
  if (!text || mode === 'off') return text || null;
  const step = STEP[by] || STEP.word; let n = 0;
  const lines = String(text).split('\n');
  return lines.map((ln, li) => <span key={li} className="ta-ln">{li > 0 && <br />}{ln.split(/(\s+)/).map((w, wi) => {
    if (!w) return null;
    if (/^\s+$/.test(w)) return ' ';
    if (by === 'char') return <span key={wi} className="ta-wd">{Array.from(w).map((c, ci) => <span key={ci} className="ta-p" style={{ '--d': (d + step * n++).toFixed(3) + 's' }}>{c}</span>)}</span>;
    return <span key={wi} className="ta-p" style={{ '--d': (d + step * n++).toFixed(3) + 's' }}>{w}</span>;
  })}</span>);
}
// kaç kelime / harf var (bir sonraki bloğun gecikmesini hesaplamak için)
export const taLen = (text, by = 'word') => { const t = String(text || '').trim(); if (!t) return 0; const w = t.split(/\s+/); return by === 'char' ? w.join('').length : w.length; };
export const taStep = (by) => STEP[by] || STEP.word;
