// Tasarım modu 2 — hazır seçenekler kütüphanesi (banner arka planları, renk paletleri, tema paketleri)
// Hepsi isteğe bağlı: hiçbiri seçilmemişse mağaza eskisiyle birebir aynı görünür.

// ---- Banner arka planları (slides[i].bg = id). ink: 'l' açık zeminde koyu yazı, yoksa beyaz yazı
const grid = (c, s = 28) => `linear-gradient(${c} 1px, transparent 1px) 0 0/${s}px ${s}px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0/${s}px ${s}px`;
const dots = (c, s = 14, r = 1.4) => `radial-gradient(circle, ${c} ${r}px, transparent ${r + 0.4}px) 0 0/${s}px ${s}px`;
export const BG_CATS = { calm: 'Sakin (Apple)', grad: 'Renk geçişi', aura: 'Işık ve aura', tex: 'Desen ve doku', tech: 'Teknik / atölye', light: 'Açık zemin', glass: 'Parlak ve cam' };
export const BG_PRESETS = [
  // 5.11.2026 Apple sade paketi: derin, sakin tonlar (beyaz yazı her birinde okunur) + iki açık ton
  { id: 'p-midnight', cat: 'calm', n: 'Gece yarısı', bg: 'radial-gradient(120% 90% at 85% 10%, #31477a 0%, #16213b 52%, #0c1324 100%)' },
  { id: 'p-graphite', cat: 'calm', n: 'Grafit', bg: 'radial-gradient(120% 90% at 85% 10%, #55555f 0%, #26262c 55%, #141417 100%)' },
  { id: 'p-sage', cat: 'calm', n: 'Adaçayı', bg: 'radial-gradient(120% 90% at 85% 10%, #5f7f6c 0%, #2b3d33 55%, #17221c 100%)' },
  { id: 'p-copper', cat: 'calm', n: 'Bakır', bg: 'radial-gradient(120% 90% at 85% 10%, #a2694a 0%, #4e2f1f 55%, #23150e 100%)' },
  { id: 'p-ink', cat: 'calm', n: 'Mürekkep', bg: 'radial-gradient(120% 90% at 80% 15%, #3b4f8f 0%, #1c2547 55%, #0d1226 100%)' },
  { id: 'p-plum', cat: 'calm', n: 'Erik', bg: 'radial-gradient(120% 90% at 85% 10%, #76607f 0%, #3a2d42 55%, #1b1520 100%)' },
  { id: 'p-mist', cat: 'calm', n: 'Sis', ink: 'l', bg: 'radial-gradient(120% 90% at 85% 10%, #ffffff 0%, #eef2f8 50%, #dde4ef 100%)' },
  { id: 'p-sand', cat: 'calm', n: 'Kum', ink: 'l', bg: 'radial-gradient(120% 90% at 85% 10%, #ffffff 0%, #f5f0e8 50%, #e8dfd1 100%)' },
  // renk geçişi
  { id: 'g-night', cat: 'grad', n: 'Gece mavisi', bg: 'linear-gradient(120deg, #0d1b33, #1d5fd8 70%, #38bdf8)' },
  { id: 'g-ember', cat: 'grad', n: 'Kor', bg: 'linear-gradient(125deg, #1a0702, #9a2d07 55%, #ff8a3d)' },
  { id: 'g-emerald', cat: 'grad', n: 'Zümrüt', bg: 'linear-gradient(120deg, #022c22, #047857 60%, #34d399)' },
  { id: 'g-violet', cat: 'grad', n: 'Menekşe', bg: 'linear-gradient(120deg, #1e0b3d, #6d28d9 60%, #c084fc)' },
  { id: 'g-wine', cat: 'grad', n: 'Bordo', bg: 'linear-gradient(120deg, #2a0712, #9f1239 60%, #fb7185)' },
  { id: 'g-ocean', cat: 'grad', n: 'Okyanus', bg: 'linear-gradient(140deg, #03172b, #0369a1 55%, #22d3ee)' },
  { id: 'g-sunset', cat: 'grad', n: 'Gün batımı', bg: 'linear-gradient(120deg, #3b0a45, #b4235a 50%, #f59e0b)' },
  { id: 'g-steel', cat: 'grad', n: 'Çelik', bg: 'linear-gradient(120deg, #111827, #374151 60%, #6b7280)' },
  { id: 'g-forest', cat: 'grad', n: 'Orman', bg: 'linear-gradient(130deg, #0b1d12, #166534 60%, #84cc16)' },
  { id: 'g-royal', cat: 'grad', n: 'Kraliyet', bg: 'linear-gradient(120deg, #0b1036, #3730a3 55%, #a78bfa)' },
  { id: 'g-copper', cat: 'grad', n: 'Bakır', bg: 'linear-gradient(120deg, #1c0f08, #7c3a14 55%, #d97706)' },
  { id: 'g-teal', cat: 'grad', n: 'Petrol', bg: 'linear-gradient(120deg, #021d1f, #0f766e 60%, #5eead4)' },
  { id: 'g-cherry', cat: 'grad', n: 'Kiraz', bg: 'linear-gradient(130deg, #2b0505, #b91c1c 60%, #f97316)' },
  { id: 'g-graphite', cat: 'grad', n: 'Grafit', bg: 'linear-gradient(160deg, #0a0a0a, #262626)' },
  { id: 'g-navy', cat: 'grad', n: 'Lacivert düz', bg: '#0d1b33' },
  { id: 'g-black', cat: 'grad', n: 'Siyah düz', bg: '#09090b' },
  // ışık ve aura
  { id: 'a-gold', cat: 'aura', n: 'Siyah altın', bg: 'radial-gradient(120% 90% at 80% 15%, #4a3510 0%, #0a0a0b 60%)' },
  { id: 'a-fluid', cat: 'aura', n: 'Akışkan mor', bg: 'radial-gradient(circle at 20% 30%, #ff8a5b, transparent 45%), radial-gradient(circle at 80% 70%, #7c3aed, transparent 50%), #1e1b4b' },
  { id: 'a-aurora', cat: 'aura', n: 'Kutup ışığı', bg: 'radial-gradient(60% 80% at 20% 100%, #22d3ee88, transparent), radial-gradient(60% 80% at 80% 0%, #a3e63588, transparent), #04131d' },
  { id: 'a-spot', cat: 'aura', n: 'Sahne ışığı', bg: 'radial-gradient(50% 70% at 72% 40%, #3b82f655, transparent 70%), #05070f' },
  { id: 'a-lava', cat: 'aura', n: 'Lav', bg: 'radial-gradient(circle at 80% 80%, #f97316, transparent 45%), radial-gradient(circle at 15% 10%, #dc2626aa, transparent 40%), #1a0505' },
  { id: 'a-ocean', cat: 'aura', n: 'Okyanus ışığı', bg: 'radial-gradient(80% 60% at 50% 110%, #22d3ee, transparent), #082f49' },
  { id: 'a-rose', cat: 'aura', n: 'Gül ışığı', bg: 'radial-gradient(70% 70% at 85% 20%, #f472b6aa, transparent), radial-gradient(60% 60% at 10% 90%, #fb923c88, transparent), #2a0716' },
  { id: 'a-mint', cat: 'aura', n: 'Nane ışığı', bg: 'radial-gradient(70% 70% at 80% 30%, #34d39988, transparent), #031b14' },
  { id: 'a-eclipse', cat: 'aura', n: 'Tutulma', bg: 'radial-gradient(circle at 75% 45%, #000 18%, #f59e0b 19%, #7c2d12 24%, transparent 40%), #050505' },
  { id: 'a-neon', cat: 'aura', n: 'Neon', bg: 'radial-gradient(60% 60% at 15% 20%, #ec489988, transparent), radial-gradient(60% 60% at 85% 80%, #06b6d488, transparent), #0b0418' },
  // desen ve doku
  { id: 't-dots', cat: 'tex', n: 'Nokta doku', bg: dots('#334155') + ', #0f172a' },
  { id: 't-stripes', cat: 'tex', n: 'Atölye çizgi', bg: 'repeating-linear-gradient(-45deg, #111827 0 14px, #1a2333 14px 28px)' },
  { id: 't-rings', cat: 'tex', n: 'Halka dalga', bg: 'repeating-radial-gradient(circle at 100% 50%, #1e293b 0 7px, #0f172a 7px 16px)' },
  { id: 't-horizon', cat: 'tex', n: 'Ufuk çizgisi', bg: 'linear-gradient(180deg, #0f172a, #1e293b 62%, #f59e0b 62.4%, #f59e0b 64%, #1e293b 64.4%)' },
  { id: 't-diag', cat: 'tex', n: 'Çapraz ışın', bg: 'repeating-linear-gradient(115deg, #1d4ed8 0 2px, transparent 2px 60px), linear-gradient(120deg, #0b1430, #172554)' },
  { id: 't-check', cat: 'tex', n: 'Dama', bg: 'conic-gradient(#1f2937 25%, #111827 0 50%, #1f2937 0 75%, #111827 0) 0 0/36px 36px' },
  { id: 't-split', cat: 'tex', n: 'İkiye bölünmüş', bg: 'linear-gradient(100deg, #0b1430 55%, #1d5fd8 55%)' },
  { id: 't-wave', cat: 'tex', n: 'Dalga', bg: 'radial-gradient(120% 60% at 50% 120%, #1d5fd8 40%, transparent 41%), radial-gradient(120% 60% at 50% 135%, #38bdf8 40%, transparent 41%), #0b1430' },
  { id: 't-hex', cat: 'tex', n: 'Petek', bg: 'radial-gradient(circle at 0 0, transparent 9px, #1e293b 10px, transparent 11px) 0 0/20px 34px, radial-gradient(circle at 10px 17px, transparent 9px, #1e293b 10px, transparent 11px) 0 0/20px 34px, #0f172a' },
  { id: 't-zig', cat: 'tex', n: 'Zikzak', bg: 'linear-gradient(135deg, #172554 25%, transparent 25%) -14px 0/28px 28px, linear-gradient(225deg, #172554 25%, transparent 25%) -14px 0/28px 28px, linear-gradient(315deg, #172554 25%, transparent 25%) 0 0/28px 28px, linear-gradient(45deg, #172554 25%, #0b1430 25%) 0 0/28px 28px' },
  { id: 't-grain', cat: 'tex', n: 'Gece kumu', bg: dots('#ffffff14', 5, 0.6) + ', linear-gradient(140deg, #18181b, #27272a)' },
  { id: 't-paper', cat: 'tex', n: 'Kağıt', ink: 'l', bg: dots('#00000010', 6, 0.7) + ', #f5f1e8' },
  { id: 't-conic', cat: 'tex', n: 'Kor girdap', bg: 'conic-gradient(from 200deg at 70% 40%, #f97316, #ef4444, #7c2d12, #f97316)' },
  { id: 't-bricks', cat: 'tex', n: 'Tuğla duvar', bg: 'linear-gradient(#ffffff10 2px, transparent 2px) 0 0/48px 24px, linear-gradient(90deg, #ffffff10 2px, transparent 2px) 0 0/48px 48px, linear-gradient(90deg, #ffffff10 2px, transparent 2px) 24px 24px/48px 48px, #3f1d14' },
  // teknik / atölye
  { id: 'k-grid', cat: 'tech', n: 'Devre ızgara', bg: grid('#1e3a5f', 22) + ', #0b1220' },
  { id: 'k-blueprint', cat: 'tech', n: 'Mavi çizim', bg: grid('#ffffff22', 40) + ', ' + grid('#ffffff10', 8) + ', #1e40af' },
  { id: 'k-pcb', cat: 'tech', n: 'Yeşil kart (PCB)', bg: dots('#c9a227', 28, 2.5) + ', ' + grid('#0d5c2e', 14) + ', #063d1f' },
  { id: 'k-scope', cat: 'tech', n: 'Mikroskop', bg: 'radial-gradient(circle at 72% 50%, transparent 18%, #0b1220 18.5%, #0b1220 20%, transparent 20.5%, transparent 30%, #1e3a5f66 30.5%, transparent 31%), ' + grid('#1e3a5f55', 30) + ', #050b16' },
  { id: 'k-solder', cat: 'tech', n: 'Lehim ışığı', bg: 'radial-gradient(30% 40% at 75% 50%, #fbbf24aa, transparent), ' + grid('#ffffff0d', 24) + ', #0c0a09' },
  { id: 'k-wave', cat: 'tech', n: 'Osiloskop', bg: 'repeating-linear-gradient(90deg, transparent 0 39px, #22c55e22 39px 40px), repeating-linear-gradient(0deg, transparent 0 39px, #22c55e22 39px 40px), radial-gradient(100% 2px at 50% 50%, #22c55e, transparent), #021208' },
  { id: 'k-carbon', cat: 'tech', n: 'Karbon', bg: 'linear-gradient(27deg, #151515 5px, transparent 5px) 0 5px/10px 10px, linear-gradient(207deg, #151515 5px, transparent 5px) 10px 0/10px 10px, linear-gradient(27deg, #222 5px, transparent 5px) 0 10px/10px 10px, linear-gradient(207deg, #222 5px, transparent 5px) 10px 5px/10px 10px, #1b1b1b' },
  { id: 'k-steel', cat: 'tech', n: 'Fırçalanmış metal', ink: 'l', bg: 'repeating-linear-gradient(90deg, #ffffff00 0 2px, #ffffff40 2px 3px), linear-gradient(180deg, #d4d4d8, #a1a1aa)' },
  // açık zemin
  { id: 'l-ice', cat: 'light', n: 'Buz', ink: 'l', bg: 'linear-gradient(135deg, #ecfeff, #cffafe 50%, #a5f3fc)' },
  { id: 'l-sand', cat: 'light', n: 'Kum', ink: 'l', bg: 'linear-gradient(160deg, #fef3c7, #fde68a 55%, #fbbf24)' },
  { id: 'l-powder', cat: 'light', n: 'Pudra', ink: 'l', bg: 'linear-gradient(120deg, #fdf2f8, #fbcfe8)' },
  { id: 'l-mist', cat: 'light', n: 'Sis', ink: 'l', bg: 'linear-gradient(160deg, #f8fafc, #e2e8f0)' },
  { id: 'l-sky', cat: 'light', n: 'Gökyüzü', ink: 'l', bg: 'linear-gradient(180deg, #dbeafe, #eff6ff 60%, #ffffff)' },
  { id: 'l-mint', cat: 'light', n: 'Nane', ink: 'l', bg: 'linear-gradient(140deg, #ecfdf5, #a7f3d0)' },
  { id: 'l-lilac', cat: 'light', n: 'Leylak', ink: 'l', bg: 'linear-gradient(140deg, #f5f3ff, #ddd6fe)' },
  { id: 'l-peach', cat: 'light', n: 'Şeftali', ink: 'l', bg: 'linear-gradient(140deg, #fff7ed, #fed7aa)' },
  { id: 'l-grid', cat: 'light', n: 'Kareli defter', ink: 'l', bg: grid('#2563eb1f', 24) + ', #ffffff' },
  { id: 'l-white', cat: 'light', n: 'Beyaz düz', ink: 'l', bg: '#ffffff' },
  // parlak ve cam
  { id: 'c-glass', cat: 'glass', n: 'Parlak cam', bg: 'radial-gradient(circle at 30% 30%, #ffffff66, transparent 30%), linear-gradient(120deg, #1d4ed8, #9333ea)' },
  { id: 'c-pearl', cat: 'glass', n: 'İnci', ink: 'l', bg: 'radial-gradient(circle at 25% 20%, #ffffff, transparent 40%), linear-gradient(135deg, #e0e7ff, #fce7f3 50%, #e0f2fe)' },
  { id: 'c-holo', cat: 'glass', n: 'Hologram', bg: 'linear-gradient(115deg, #0ea5e9, #a855f7 35%, #ec4899 55%, #f59e0b 80%)' },
  { id: 'c-chrome', cat: 'glass', n: 'Krom', bg: 'linear-gradient(180deg, #1f2937, #9ca3af 48%, #111827 52%, #374151)' },
  { id: 'c-gold', cat: 'glass', n: 'Altın varak', ink: 'l', bg: 'linear-gradient(120deg, #a16207, #fde68a 35%, #ca8a04 60%, #fef3c7 85%)' },
  { id: 'c-ice', cat: 'glass', n: 'Buzlu cam', bg: 'radial-gradient(circle at 70% 30%, #ffffff40, transparent 40%), linear-gradient(140deg, #0c4a6e, #0284c7)' },
];
export const BG_BY = Object.fromEntries(BG_PRESETS.map((x) => [x.id, x]));

// ---- Renk paletleri (sayfa geneli: mağaza ana rengi, fiyat rengi, sayfa zemini). bg '' = varsayılan zemin
export const PALETTES = [
  { id: 'ertel', n: 'ERTEL mavi', accent: '#2f55b0', price: '#2f55b0', bg: '' },
  { id: 'ocean', n: 'Okyanus', accent: '#0369a1', price: '#0e7490', bg: '#f4f9fc' },
  { id: 'night', n: 'Gece', accent: '#1d4ed8', price: '#1e3a8a', bg: '#f3f5f9' },
  { id: 'ember', n: 'Kor turuncu', accent: '#ea580c', price: '#c2410c', bg: '#fffaf5' },
  { id: 'cherry', n: 'Kiraz', accent: '#dc2626', price: '#b91c1c', bg: '#fff8f8' },
  { id: 'emerald', n: 'Zümrüt', accent: '#047857', price: '#065f46', bg: '#f5fbf8' },
  { id: 'forest', n: 'Orman', accent: '#15803d', price: '#166534', bg: '#f7faf5' },
  { id: 'violet', n: 'Menekşe', accent: '#7c3aed', price: '#6d28d9', bg: '#faf8ff' },
  { id: 'royal', n: 'Kraliyet', accent: '#4338ca', price: '#3730a3', bg: '#f7f7fd' },
  { id: 'wine', n: 'Bordo', accent: '#9f1239', price: '#881337', bg: '#fdf8f9' },
  { id: 'rose', n: 'Gül', accent: '#e11d48', price: '#be123c', bg: '#fff7f9' },
  { id: 'teal', n: 'Petrol', accent: '#0f766e', price: '#115e59', bg: '#f4faf9' },
  { id: 'gold', n: 'Altın', accent: '#b45309', price: '#92400e', bg: '#fffbf3' },
  { id: 'graphite', n: 'Grafit', accent: '#27272a', price: '#18181b', bg: '#f6f6f7' },
  { id: 'steel', n: 'Çelik', accent: '#475569', price: '#1e293b', bg: '#f5f7fa' },
  { id: 'sky', n: 'Gökyüzü', accent: '#0284c7', price: '#0369a1', bg: '#f3f9fe' },
  { id: 'lime', n: 'Volt', accent: '#4d7c0f', price: '#3f6212', bg: '#f9fbf3' },
  { id: 'copper', n: 'Bakır', accent: '#9a3412', price: '#7c2d12', bg: '#fcf8f5' },
  { id: 'magenta', n: 'Fuşya', accent: '#c026d3', price: '#a21caf', bg: '#fdf7fe' },
  { id: 'indigo', n: 'Çivit', accent: '#3b5bdb', price: '#364fc7', bg: '#f6f8ff' },
  { id: 'sand', n: 'Kum', accent: '#a16207', price: '#854d0e', bg: '#faf6ee' },
  { id: 'mint', n: 'Nane', accent: '#059669', price: '#047857', bg: '#f2fbf7' },
  { id: 'blackgold', n: 'Siyah altın', accent: '#111827', price: '#a16207', bg: '#f7f6f2' },
  { id: 'redblack', n: 'Kırmızı siyah', accent: '#b91c1c', price: '#111827', bg: '#f7f7f7' },
];

// ---- Tema Stüdyosu paketleri (settings.look.pack). Parçalar ayrı ayrı açılıp kapanır:
// palette: sayfa renkleri · hero: tüm reklamların arka planı (tam resimli reklamlar hariç) · band: üstte duyuru şeridi
// fx: hafif parça efekti · badge: ürün kartı köşe rozeti · tint: sayfanın üstünde hafif renk
export const FX_KINDS = {
  none: 'Yok', sparkle: 'Işıltı', dust: 'Işık tozu', snow: 'Kar', confetti: 'Konfeti', bubble: 'Kabarcık', rain: 'Yağmur', petal: 'Yaprak',
  hearts: 'Kalpler', flakes: 'Kar tanesi', stars: 'Yıldızlar', leaves: 'Sonbahar yaprağı', balloons: 'Balonlar', gears: 'Dişliler',
};
// ---- Sayfa deseni (1.11.2026, tema parçası 'pat'): sayfanın zemininde çok hafif tekrar eden desen {k, c, o (0-1), z (ölçek)}
export const PATTERNS = { none: 'Yok', dots: 'Noktalar', grid: 'Kareli', diag: 'Çapraz çizgi', checks: 'Dama', plus: 'Artılar', waves: 'Dalgalar', zigzag: 'Zikzak',
  stars: 'Yıldızlar', hearts: 'Kalpler', snow: 'Kar taneleri', circuit: 'Devre kartı', moons: 'Hilal ve yıldız', tools: 'Tamir aletleri' };
const svgUrl = (w, h, body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;
export function patBg(k, c = '#64748b', z = 1) {
  const S = Math.round(28 * (z || 1));
  switch (k) {
    case 'dots': return { backgroundImage: `radial-gradient(${c} 1.4px, transparent 1.6px)`, backgroundSize: `${S}px ${S}px` };
    case 'grid': return { backgroundImage: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`, backgroundSize: `${S}px ${S}px` };
    case 'diag': return { backgroundImage: `repeating-linear-gradient(45deg, ${c} 0 1.2px, transparent 1.2px ${Math.round(S / 2.2)}px)` };
    case 'checks': return { backgroundImage: `conic-gradient(${c} 25%, transparent 0 50%, ${c} 0 75%, transparent 0)`, backgroundSize: `${S}px ${S}px` };
    case 'plus': return { backgroundImage: svgUrl(30, 30, `<path d='M15 9v12M9 15h12' stroke='${c}' stroke-width='1.6' stroke-linecap='round'/>`), backgroundSize: `${S + 4}px ${S + 4}px` };
    case 'waves': return { backgroundImage: svgUrl(60, 20, `<path d='M0 10 Q15 0 30 10 T60 10' fill='none' stroke='${c}' stroke-width='1.4'/>`), backgroundSize: `${S * 2}px ${Math.round(S * 0.7)}px` };
    case 'zigzag': return { backgroundImage: svgUrl(40, 16, `<path d='M0 12 L10 4 L20 12 L30 4 L40 12' fill='none' stroke='${c}' stroke-width='1.4' stroke-linejoin='round'/>`), backgroundSize: `${Math.round(S * 1.4)}px ${Math.round(S * 0.6)}px` };
    case 'stars': return { backgroundImage: svgUrl(60, 60, `<path d='M15 8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z' fill='${c}'/><path d='M45 38l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z' fill='${c}'/>`), backgroundSize: `${S * 2}px ${S * 2}px` };
    case 'hearts': return { backgroundImage: svgUrl(60, 60, `<path d='M16 24c-6-4-9-7-9-10.5C7 10.5 9 9 11.2 9c2 0 3.4 1.2 4.8 3 1.4-1.8 2.8-3 4.8-3C23 9 25 10.5 25 13.5 25 17 22 20 16 24z' fill='${c}'/><path d='M44 50c-4-2.7-6-4.7-6-7 0-2 1.3-3 2.8-3 1.4 0 2.3.8 3.2 2 .9-1.2 1.8-2 3.2-2 1.5 0 2.8 1 2.8 3 0 2.3-2 4.3-6 7z' fill='${c}'/>`), backgroundSize: `${S * 2}px ${S * 2}px` };
    case 'snow': return { backgroundImage: svgUrl(60, 60, `<g stroke='${c}' stroke-width='1.3' stroke-linecap='round'><path d='M16 8v16M9 12l14 8M9 20l14-8'/><path d='M45 38v10M40.7 40.5l8.6 5M40.7 45.5l8.6-5'/></g>`), backgroundSize: `${S * 2}px ${S * 2}px` };
    case 'circuit': return { backgroundImage: svgUrl(80, 80, `<g fill='none' stroke='${c}' stroke-width='1.2'><path d='M0 20h22l8 8h20M50 28v24l8 8h22M20 80V58l-8-8V30'/><circle cx='50' cy='28' r='2.5' fill='${c}'/><circle cx='12' cy='30' r='2.5' fill='${c}'/><circle cx='58' cy='60' r='2.5' fill='${c}'/></g>`), backgroundSize: `${Math.round(S * 2.6)}px ${Math.round(S * 2.6)}px` };
    case 'moons': return { backgroundImage: svgUrl(70, 70, `<path d='M22 10a10 10 0 1 0 8 16 8 8 0 1 1-8-16z' fill='${c}'/><path d='M52 44l1.4 3 3.2.4-2.4 2.2.6 3.2-2.8-1.6-2.8 1.6.6-3.2-2.4-2.2 3.2-.4z' fill='${c}'/>`), backgroundSize: `${Math.round(S * 2.4)}px ${Math.round(S * 2.4)}px` };
    case 'tools': return { backgroundImage: svgUrl(80, 80, `<g fill='none' stroke='${c}' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><path d='M14 30l12-12m-2-4a5 5 0 0 0 6 6l-3 3-3-3z'/><rect x='48' y='44' width='14' height='24' rx='3'/><path d='M53 64h4'/></g>`), backgroundSize: `${Math.round(S * 2.8)}px ${Math.round(S * 2.8)}px` };
    default: return null;
  }
}
// ---- Süs dizisi (tema parçası 'orn'): menünün altında sarkan ince süs
export const ORNS = { none: 'Yok', bunting: 'Flama dizisi', lights: 'Renkli ampuller', garland: 'Yapraklı çelenk', stars: 'Sarkan yıldızlar', hearts: 'Kalp dizisi', moons: 'Fener ve hilal' };
export function ornBg(k, cs = []) {
  const [a = '#ef4444', b = '#facc15', c = '#22c55e', d = '#3b82f6'] = cs;
  switch (k) {
    case 'bunting': return { h: 26, img: svgUrl(120, 26, `<path d='M0 3 Q60 9 120 3' fill='none' stroke='#6b7280' stroke-width='1'/><path d='M4 3.4l10 18 10-17z' fill='${a}'/><path d='M34 5l10 18 10-17.8z' fill='${b}'/><path d='M64 5.8l10 18 10-17.6z' fill='${c}'/><path d='M94 4.8l10 18 10-17z' fill='${d}'/>`), w: 120 };
    case 'lights': return { h: 26, img: svgUrl(120, 26, `<path d='M0 2 Q30 12 60 2 T120 2' fill='none' stroke='#374151' stroke-width='1.2'/><g><ellipse cx='15' cy='14' rx='4' ry='6' fill='${a}'/><ellipse cx='45' cy='14' rx='4' ry='6' fill='${b}'/><ellipse cx='75' cy='14' rx='4' ry='6' fill='${c}'/><ellipse cx='105' cy='14' rx='4' ry='6' fill='${d}'/></g>`), w: 120 };
    case 'garland': return { h: 24, img: svgUrl(80, 24, `<path d='M0 4 Q40 18 80 4' fill='none' stroke='${c || '#15803d'}' stroke-width='2.4'/><g fill='${c || '#15803d'}'><ellipse cx='14' cy='9' rx='5' ry='2.6' transform='rotate(-25 14 9)'/><ellipse cx='30' cy='13' rx='5' ry='2.6' transform='rotate(20 30 13)'/><ellipse cx='50' cy='13' rx='5' ry='2.6' transform='rotate(-20 50 13)'/><ellipse cx='66' cy='9' rx='5' ry='2.6' transform='rotate(25 66 9)'/></g><circle cx='40' cy='12' r='3.2' fill='${a}'/>`), w: 80 };
    case 'stars': return { h: 34, img: svgUrl(90, 34, `<g stroke='#9ca3af' stroke-width='.8'><path d='M15 0v14M45 0v22M75 0v10'/></g><g fill='${b}'><path d='M15 14l2 4 4.4.6-3.2 3 .8 4.4-4-2.1-4 2.1.8-4.4-3.2-3 4.4-.6z'/><path d='M45 22l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z'/><path d='M75 10l2 4 4.4.6-3.2 3 .8 4.4-4-2.1-4 2.1.8-4.4-3.2-3 4.4-.6z'/></g>`), w: 90 };
    case 'hearts': return { h: 24, img: svgUrl(80, 24, `<path d='M0 3 Q40 10 80 3' fill='none' stroke='#9ca3af' stroke-width='.8'/><g fill='${a}'><path d='M20 20c-4-2.6-6-4.6-6-7 0-1.8 1.3-3 2.8-3 1.4 0 2.3.8 3.2 2 .9-1.2 1.8-2 3.2-2 1.5 0 2.8 1.2 2.8 3 0 2.4-2 4.4-6 7z'/><path d='M60 20c-4-2.6-6-4.6-6-7 0-1.8 1.3-3 2.8-3 1.4 0 2.3.8 3.2 2 .9-1.2 1.8-2 3.2-2 1.5 0 2.8 1.2 2.8 3 0 2.4-2 4.4-6 7z' fill='${b}'/></g>`), w: 80 };
    case 'moons': return { h: 36, img: svgUrl(100, 36, `<g stroke='#9ca3af' stroke-width='.8'><path d='M20 0v12M70 0v18'/></g><rect x='15' y='12' width='10' height='14' rx='3' fill='${a}'/><rect x='17' y='26' width='6' height='2' fill='${b}'/><path d='M74 18a8 8 0 1 0 5 13 6.4 6.4 0 1 1-5-13z' fill='${b}'/>`), w: 100 };
    default: return null;
  }
}
export const PACKS = [
  { id: 'efsane', n: 'Efsane Cuma', d: 'Siyah-altın, ışıltı, indirim rozeti', sw: ['#0a0a0b', '#f5c542', '#3a2f12'],
    palette: { accent: '#111827', price: '#a16207', bg: '#f7f6f2' }, hero: 'a-gold', band: { text: 'EFSANE CUMA · SEÇİLİ ÜRÜNLERDE BÜYÜK İNDİRİM', bg: 'linear-gradient(90deg, #0a0a0b, #3a2f12, #0a0a0b)', color: '#f5c542' },
    fx: { kind: 'sparkle', c: ['#f5c542', '#fde68a', '#ffffff'] }, badge: { text: 'FIRSAT', bg: '#f5c542', color: '#111' }, tint: 'linear-gradient(180deg, rgb(17 24 39 / .07), transparent 55%)' },
  { id: 'yilbasi', n: 'Yılbaşı · zarif', d: 'Gece mavisi, ince ışık tozu', sw: ['#0b2545', '#8da9c4', '#f8fafc'],
    palette: { accent: '#1e3a8a', price: '#b91c1c', bg: '#f5f8fc' }, hero: 'g-royal', band: { text: 'MUTLU YILLAR · YILBAŞI SİPARİŞLERİ AYNI GÜN KARGODA', bg: 'linear-gradient(90deg, #0b2545, #13315c, #0b2545)', color: '#e2e8f0' },
    fx: { kind: 'dust', c: ['#ffffff', '#dbeafe', '#fde68a'] }, badge: { text: 'YILBAŞI', bg: '#b91c1c', color: '#fff' }, tint: 'linear-gradient(180deg, rgb(30 58 138 / .07), transparent 60%)' },
  { id: 'kis', n: 'Karlı kış', d: 'Soğuk mavi, yumuşak kar', sw: ['#e0f2fe', '#7dd3fc', '#0c4a6e'],
    palette: { accent: '#0369a1', price: '#0c4a6e', bg: '#f4f9fd' }, hero: 'c-ice', band: { text: 'KIŞ KAMPANYASI', bg: '#0c4a6e', color: '#e0f2fe' },
    fx: { kind: 'snow', c: ['#ffffff', '#e0f2fe', '#bae6fd'] }, badge: null, tint: 'linear-gradient(180deg, rgb(186 230 253 / .35), transparent 60%)' },
  { id: 'ramazan', n: 'Ramazan', d: 'Gece moru, sıcak altın ışık', sw: ['#1a1033', '#3b1f5e', '#fbbf24'],
    palette: { accent: '#5b21b6', price: '#92400e', bg: '#faf8fd' }, hero: 'a-rose', band: { text: 'HAYIRLI RAMAZANLAR', bg: 'linear-gradient(90deg, #1a1033, #3b1f5e, #1a1033)', color: '#fbbf24' },
    fx: { kind: 'sparkle', c: ['#fbbf24', '#fde68a'] }, badge: null, tint: 'linear-gradient(180deg, rgb(59 31 94 / .07), transparent 60%)' },
  { id: 'bayram', n: 'Bayram', d: 'Şeker renkleri, konfeti', sw: ['#fdf2f8', '#f472b6', '#22c55e'],
    palette: { accent: '#be185d', price: '#9d174d', bg: '#fffafc' }, hero: 'g-sunset', band: { text: 'İYİ BAYRAMLAR · BAYRAMA ÖZEL FİYATLAR', bg: 'linear-gradient(90deg, #be185d, #7c3aed, #be185d)', color: '#fff' },
    fx: { kind: 'confetti', c: ['#f472b6', '#facc15', '#22c55e', '#60a5fa'] }, badge: { text: 'BAYRAM', bg: '#be185d', color: '#fff' }, tint: '' },
  { id: 'cumhuriyet', n: '29 Ekim · 30 Ağustos', d: 'Kırmızı-beyaz, sade şerit', sw: ['#b91c1c', '#ffffff', '#7f1d1d'],
    palette: { accent: '#b91c1c', price: '#991b1b', bg: '#fffafa' }, hero: 'g-cherry', band: { text: 'CUMHURİYET BAYRAMIMIZ KUTLU OLSUN', bg: '#c8102e', color: '#fff' },
    fx: { kind: 'none' }, badge: null, tint: 'linear-gradient(180deg, rgb(200 16 46 / .05), transparent 50%)' },
  { id: 'atolye', n: 'Tamir atölyesi', d: 'Devre kartı, lehim ışığı', sw: ['#0b1220', '#1e3a5f', '#fbbf24'],
    palette: { accent: '#1d4ed8', price: '#b45309', bg: '#f3f5f9' }, hero: 'k-grid', band: { text: 'USTALAR İÇİN · ORİJİNAL EKİPMAN · AYNI GÜN KARGO', bg: '#0b1220', color: '#fbbf24' },
    fx: { kind: 'none' }, badge: null, tint: '' },
  { id: 'okul', n: 'Okula dönüş', d: 'Kareli defter, sarı vurgu', sw: ['#fef9c3', '#eab308', '#1e3a8a'],
    palette: { accent: '#1e3a8a', price: '#a16207', bg: '#fdfcf6' }, hero: 'l-grid', band: { text: 'YENİ DÖNEM · ÖĞRENCİ VE KURSLARA ÖZEL', bg: '#eab308', color: '#111' },
    fx: { kind: 'none' }, badge: null, tint: '' },
  { id: 'bahar', n: 'Bahar', d: 'Ferah yeşil, uçuşan yapraklar', sw: ['#ecfdf5', '#34d399', '#065f46'],
    palette: { accent: '#047857', price: '#065f46', bg: '#f6fbf8' }, hero: 'l-mint', band: { text: 'BAHAR GELDİ · YENİ ÜRÜNLER RAFTA', bg: '#065f46', color: '#ecfdf5' },
    fx: { kind: 'petal', c: ['#86efac', '#fbcfe8', '#fde68a'] }, badge: null, tint: 'linear-gradient(180deg, rgb(52 211 153 / .09), transparent 60%)' },
  { id: 'yaz', n: 'Yaz', d: 'Kum ve deniz, kabarcık', sw: ['#fef3c7', '#22d3ee', '#0369a1'],
    palette: { accent: '#0369a1', price: '#c2410c', bg: '#fffcf5' }, hero: 'a-ocean', band: { text: 'YAZ FIRSATLARI', bg: 'linear-gradient(90deg, #0369a1, #22d3ee, #0369a1)', color: '#fff' },
    fx: { kind: 'bubble', c: ['#7dd3fc', '#38bdf8'] }, badge: null, tint: 'linear-gradient(180deg, rgb(253 230 138 / .2), transparent 60%)' },
  { id: 'sevgili', n: 'Sevgililer günü', d: 'Gül ışığı, ince ışıltı', sw: ['#2a0716', '#fb7185', '#fda4af'],
    palette: { accent: '#e11d48', price: '#be123c', bg: '#fff7f9' }, hero: 'a-rose', band: { text: '14 ŞUBAT', bg: '#be123c', color: '#fff' },
    fx: { kind: 'sparkle', c: ['#fda4af', '#fb7185', '#ffffff'] }, badge: null, tint: 'linear-gradient(180deg, rgb(244 63 94 / .06), transparent 60%)' },
  { id: 'gece', n: 'Yıldızlı gece', d: 'Koyu lacivert, yıldız ışıltısı', sw: ['#0b1036', '#3730a3', '#fde68a'],
    palette: { accent: '#3730a3', price: '#312e81', bg: '#f6f6fc' }, hero: 'a-spot', band: null,
    fx: { kind: 'sparkle', c: ['#fde68a', '#ffffff', '#c7d2fe'] }, badge: null, tint: 'linear-gradient(180deg, rgb(49 46 129 / .08), transparent 60%)' },
  // 1.11.2026 yeni temalar (desen ve süs dizisi ile)
  { id: 'yilbasi2', n: 'Yılbaşı · neşeli', d: 'Kırmızı-yeşil, ampul dizisi, kar', sw: ['#b91c1c', '#15803d', '#fde68a'],
    palette: { accent: '#b91c1c', price: '#15803d', bg: '#fffaf7' }, hero: 'g-cherry', band: { text: 'YENİ YILA ÖZEL FİYATLAR · HEDİYE PAKETİ ÜCRETSİZ', bg: 'linear-gradient(90deg, #14532d, #b91c1c, #14532d)', color: '#fff' },
    fx: { kind: 'flakes', c: ['#93c5fd', '#e0f2fe', '#ffffff'] }, badge: { text: 'YILBAŞI', bg: '#15803d', color: '#fff' }, tint: '', pat: { k: 'snow', c: '#b91c1c', o: 0.07 }, orn: 'lights', ornC: ['#ef4444', '#facc15', '#22c55e', '#3b82f6'] },
  { id: 'anneler', n: 'Anneler günü', d: 'Pudra pembe, kalpler, çiçek', sw: ['#fdf2f8', '#ec4899', '#9d174d'],
    palette: { accent: '#be185d', price: '#9d174d', bg: '#fffafc' }, hero: 'a-rose', band: { text: 'ANNELER GÜNÜNÜZ KUTLU OLSUN', bg: '#be185d', color: '#fff' },
    fx: { kind: 'hearts', c: ['#f472b6', '#fb7185', '#f9a8d4'] }, badge: { text: 'HEDİYE', bg: '#ec4899', color: '#fff' }, tint: 'linear-gradient(180deg, rgb(236 72 153 / .07), transparent 60%)', pat: { k: 'hearts', c: '#ec4899', o: 0.06 }, orn: 'hearts', ornC: ['#ec4899', '#f9a8d4'] },
  { id: 'babalar', n: 'Babalar günü', d: 'Çelik mavi, sade ve güçlü', sw: ['#0f172a', '#475569', '#f59e0b'],
    palette: { accent: '#1e293b', price: '#b45309', bg: '#f5f6f8' }, hero: 'g-steel', band: { text: 'BABALAR GÜNÜ · USTAYA YAKIŞIR HEDİYELER', bg: '#0f172a', color: '#fbbf24' },
    fx: { kind: 'gears', c: ['#94a3b8', '#cbd5e1'] }, badge: { text: 'HEDİYE', bg: '#f59e0b', color: '#111' }, tint: '', pat: { k: 'diag', c: '#334155', o: 0.05 } },
  { id: 'cocuk', n: '23 Nisan', d: 'Rengârenk flama, balonlar', sw: ['#ef4444', '#facc15', '#3b82f6'],
    palette: { accent: '#dc2626', price: '#1d4ed8', bg: '#fffdf7' }, hero: 'g-sunset', band: { text: '23 NİSAN ULUSAL EGEMENLİK VE ÇOCUK BAYRAMI KUTLU OLSUN', bg: '#c8102e', color: '#fff' },
    fx: { kind: 'balloons' }, badge: null, tint: '', pat: { k: 'dots', c: '#f59e0b', o: 0.08 }, orn: 'bunting', ornC: ['#ef4444', '#facc15', '#22c55e', '#3b82f6'] },
  { id: 'genclik', n: '19 Mayıs', d: 'Kırmızı-beyaz flama', sw: ['#c8102e', '#ffffff', '#7f1d1d'],
    palette: { accent: '#c8102e', price: '#991b1b', bg: '#fffafa' }, hero: 'g-cherry', band: { text: '19 MAYIS ATATÜRK\'Ü ANMA, GENÇLİK VE SPOR BAYRAMI KUTLU OLSUN', bg: '#c8102e', color: '#fff' },
    fx: { kind: 'none' }, badge: null, tint: 'linear-gradient(180deg, rgb(200 16 46 / .05), transparent 50%)', orn: 'bunting', ornC: ['#c8102e', '#ffffff', '#c8102e', '#ffffff'] },
  { id: 'kurban', n: 'Kurban bayramı', d: 'Zümrüt yeşil, altın ışık, fener', sw: ['#064e3b', '#10b981', '#fbbf24'],
    palette: { accent: '#047857', price: '#92400e', bg: '#f6fbf8' }, hero: 'g-emerald', band: { text: 'KURBAN BAYRAMINIZ MÜBAREK OLSUN', bg: 'linear-gradient(90deg, #064e3b, #047857, #064e3b)', color: '#fde68a' },
    fx: { kind: 'stars', c: ['#fbbf24', '#fde68a'] }, badge: null, tint: 'linear-gradient(180deg, rgb(16 185 129 / .06), transparent 60%)', pat: { k: 'moons', c: '#047857', o: 0.06 }, orn: 'moons', ornC: ['#b45309', '#fbbf24'] },
  { id: 'kadinlar', n: '8 Mart', d: 'Mor tonlar, uçuşan yaprak', sw: ['#2e1065', '#a855f7', '#f0abfc'],
    palette: { accent: '#7e22ce', price: '#6b21a8', bg: '#fcfaff' }, hero: 'g-violet', band: { text: '8 MART DÜNYA KADINLAR GÜNÜ', bg: '#6b21a8', color: '#fff' },
    fx: { kind: 'petal', c: ['#e9d5ff', '#f0abfc', '#c4b5fd'] }, badge: null, tint: 'linear-gradient(180deg, rgb(168 85 247 / .06), transparent 60%)' },
  { id: 'sonbahar2', n: 'Sonbahar', d: 'Bakır, düşen yapraklar', sw: ['#431407', '#ea580c', '#fde68a'],
    palette: { accent: '#c2410c', price: '#9a3412', bg: '#fffaf5' }, hero: 'g-copper', band: { text: 'SONBAHAR İNDİRİMİ', bg: '#9a3412', color: '#fff7ed' },
    fx: { kind: 'leaves' }, badge: null, tint: 'linear-gradient(180deg, rgb(234 88 12 / .07), transparent 60%)', orn: 'garland', ornC: ['#dc2626', '#facc15', '#b45309'] },
  { id: 'siber', n: 'Siber Pazartesi', d: 'Neon, kareli zemin', sw: ['#0a0a1a', '#22d3ee', '#e879f9'],
    palette: { accent: '#7c3aed', price: '#0891b2', bg: '#f7f7fc' }, hero: 'a-neon', band: { text: 'SİBER PAZARTESİ · SADECE ONLINE', bg: 'linear-gradient(90deg, #0a0a1a, #312e81, #0a0a1a)', color: '#67e8f9' },
    fx: { kind: 'sparkle', c: ['#22d3ee', '#e879f9', '#a5b4fc'] }, badge: { text: 'ONLINE', bg: '#22d3ee', color: '#0a0a1a' }, tint: '', pat: { k: 'grid', c: '#7c3aed', o: 0.05 } },
  { id: 'indirim', n: 'Büyük indirim', d: 'Kırmızı-sarı, konfeti, rozet', sw: ['#dc2626', '#facc15', '#111827'],
    palette: { accent: '#dc2626', price: '#dc2626', bg: '#fffbf5' }, hero: 'g-ember', band: { text: 'BÜYÜK İNDİRİM · STOKLARLA SINIRLI', bg: '#dc2626', color: '#fff' },
    fx: { kind: 'confetti', c: ['#dc2626', '#facc15', '#111827'] }, badge: { text: 'İNDİRİM', bg: '#facc15', color: '#111' }, tint: '', pat: { k: 'zigzag', c: '#dc2626', o: 0.05 } },
  { id: 'yildonumu', n: 'Mağaza yıldönümü', d: 'Altın, balon, kutlama', sw: ['#1c1917', '#d4a017', '#fde68a'],
    palette: { accent: '#a16207', price: '#854d0e', bg: '#fdfbf6' }, hero: 'c-gold', band: { text: 'NİCE YILLARA · YILDÖNÜMÜNE ÖZEL FİYATLAR', bg: 'linear-gradient(90deg, #1c1917, #713f12, #1c1917)', color: '#fde68a' },
    fx: { kind: 'balloons' }, badge: { text: 'KUTLAMA', bg: '#d4a017', color: '#111' }, tint: '', orn: 'stars', ornC: ['#d4a017', '#facc15'] },
  { id: 'fuar', n: 'Teknoloji haftası', d: 'Devre kartı deseni, mavi ışık', sw: ['#0b1220', '#2563eb', '#22d3ee'],
    palette: { accent: '#2563eb', price: '#0e7490', bg: '#f4f7fb' }, hero: 'k-pcb', band: { text: 'YENİ CİHAZLAR · YENİ EKİPMANLAR · TEKNOLOJİ HAFTASI', bg: '#0b1220', color: '#67e8f9' },
    fx: { kind: 'dust', c: ['#60a5fa', '#22d3ee'] }, badge: { text: 'YENİ', bg: '#2563eb', color: '#fff' }, tint: '', pat: { k: 'circuit', c: '#2563eb', o: 0.06 } },
  { id: 'ogretmen', n: 'Öğretmenler günü', d: 'Yeşil tahta, sarı tebeşir', sw: ['#14532d', '#16a34a', '#fde047'],
    palette: { accent: '#15803d', price: '#a16207', bg: '#fbfdf8' }, hero: 'g-forest', band: { text: '24 KASIM ÖĞRETMENLER GÜNÜ KUTLU OLSUN', bg: '#14532d', color: '#fef08a' },
    fx: { kind: 'none' }, badge: null, tint: '', pat: { k: 'plus', c: '#15803d', o: 0.06 } },
];
export const PACK_BY = Object.fromEntries(PACKS.map((x) => [x.id, x]));
export const PACK_PARTS = [['palette', 'Renkler'], ['hero', 'Banner zemini'], ['band', 'Duyuru şeridi'], ['fx', 'Efekt'], ['badge', 'Ürün rozeti'], ['tint', 'Sayfa tonu'], ['pat', 'Sayfa deseni'], ['orn', 'Süs dizisi']];

// Etkin tema: kayıttaki pack + (varsa) kullanıcının kendi ayarları; tarih aralığı dışındaysa null
export function activePack(look, now = Date.now()) {
  const p = look?.pack; if (!p?.id) return null;
  const base = PACK_BY[p.id] || (look.myPacks || []).find((x) => x.id === p.id); if (!base) return null;
  if (p.from && now < Date.parse(p.from)) return null;
  if (p.to && now > Date.parse(p.to)) return null;
  const parts = p.parts || {};
  const on = (k) => parts[k] !== false;
  return {
    ...base,
    palette: on('palette') ? { ...base.palette, ...(p.palette || {}) } : null,
    hero: on('hero') ? (p.hero || base.hero) : null,
    band: on('band') && (base.band || p.band) ? { ...(base.band || {}), ...(p.band || {}) } : null,
    fx: on('fx') ? { ...(base.fx || {}), ...(p.fx || {}), amt: p.amt || 'md' } : null,
    badge: on('badge') && (base.badge || p.badge) ? { ...(base.badge || {}), ...(p.badge || {}) } : null,
    tint: on('tint') ? (p.tintC ? `linear-gradient(180deg, ${hexA(p.tintC, p.tintO ?? 0.1)}, transparent 62%)` : base.tint) : '',
    pat: on('pat') ? { ...(base.pat || {}), ...(p.pat || {}) } : null,
    orn: on('orn') ? { k: p.orn ?? base.orn ?? 'none', c: p.ornC || base.ornC || [] } : null,
  };
}
const hexA = (h, a) => { const m = /^#([\da-f]{6})$/i.exec(h || ''); if (!m) return h; const n = parseInt(m[1], 16); return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${a})`; };
// Sayfa renkleri: tema açıksa temanın renkleri; ama kullanıcının 'temada da kullan' dediği (look.keep) renkleri her zaman üstte
export function lookColors(L = {}, pk) {
  const pp = pk?.palette; const keep = L.keep || {};
  const pick = (k, lk) => (pp && !(keep[k] && L[lk]) ? pp[k] || (k === 'bg' ? L.bg : '') : L[lk]);
  return { accent: pick('accent', 'shopAccent'), price: pick('price', 'shopPrice'), bg: pick('bg', 'bg') };
}

// ---- Okunabilirlik: iki renk arası kontrast (WCAG). Bilinmeyen renk → null
const hexRgb = (h) => { const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(h || ''); if (!m) return null; let s = m[1]; if (s.length === 3) s = s.split('').map((c) => c + c).join(''); const n = parseInt(s, 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
export function contrast(a, b) { const x = hexRgb(a), y = hexRgb(b); if (!x || !y) return null; const l1 = lum(x), l2 = lum(y); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
// bir CSS arka plan yazısının "ortalama" rengi: içindeki hex renklerin ortalaması (kaba ama işe yarar)
export function bgTone(css) {
  const hs = (css || '').match(/#[\da-f]{6}\b|#[\da-f]{3}\b/gi) || []; const rs = hs.map(hexRgb).filter(Boolean); if (!rs.length) return null;
  const a = rs.reduce((s, r) => [s[0] + r[0], s[1] + r[1], s[2] + r[2]], [0, 0, 0]).map((v) => Math.round(v / rs.length));
  return '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---- Hazır reklam şablonları: düzen + arka plan + renkler + telefonda görünüm + örnek yazılar + resim ölçüsü önerisi
// img: hangi resim gerekli ('prod' saydam ürün resmi · 'wide' yatay banner fotoğrafı · '' resimsiz)
export const SLIDE_TEMPLATES = [
  { id: 'urun', n: 'Ürün vitrini', d: 'Solda yazı, sağda ürün', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'split', bg: 'g-night', tag: 'Yeni ürün', title: 'Ürün adını yazın', text: 'Tek cümlelik kısa açıklama: ne işe yarar, neden iyi?', cta: 'Ürünü incele', btn: { st: 'white' }, mfit: '' } },
  { id: 'urun-acik', n: 'Ürün · açık zemin', d: 'Ferah, beyaz-gri zemin', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'split', bg: 'l-mist', tag: 'Stokta', title: 'Ürün adını yazın', text: 'Kısa açıklama', cta: 'İncele', btn: { st: 'dark' } } },
  { id: 'premium', n: 'Siyah altın', d: 'Pahalı ürünler için', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'reverse', bg: 'a-gold', tag: 'Profesyonel seri', title: 'Ürün adını yazın', text: 'Kısa açıklama', cta: 'Hemen incele', btn: { st: 'accent' }, tc: 'g:gold' } },
  { id: 'atolye', n: 'Atölye / teknik', d: 'Devre kartı zemini', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'split', bg: 'k-grid', tag: 'Ustalar için', title: 'Ürün adını yazın', text: 'Teknik özellik ya da kısa açıklama', cta: 'Özellikleri gör', btn: { st: 'glass' } } },
  { id: 'kampanya', n: 'Kampanya / indirim', d: 'Ortalı, büyük başlık', img: '', size: 'Resim gerekmez',
    s: { layout: 'center', bg: 'a-lava', tag: '%20 İNDİRİM', title: 'Kampanya başlığı', text: 'Kampanyanın kısa açıklaması ve son tarihi', cta: 'Fırsatları gör', btn: { st: 'white' } } },
  { id: 'duyuru', n: 'Duyuru', d: 'Sade, resimsiz', img: '', size: 'Resim gerekmez',
    s: { layout: 'center', bg: 'g-royal', tag: 'Duyuru', title: 'Duyuru başlığı', text: 'Kısa bilgi: çalışma saatleri, kargo, yeni gelenler…', cta: '', btn: { st: 'white' } } },
  { id: 'foto', n: 'Tam fotoğraf', d: 'Fotoğraf her yeri kaplar, yazı altta', img: 'wide', size: 'Yatay fotoğraf 1800×780 · telefona ayrı dikey resim önerilir (900×1180)',
    s: { layout: 'cover', title: 'Başlık', text: 'Kısa açıklama', cta: 'İncele', btn: { st: 'white' }, mfit: 'stack', xc: '#ffffff' } },
  { id: 'foto-kutu', n: 'Fotoğraf + yazı kutusu', d: 'Yazı buzlu cam kutuda', img: 'wide', size: 'Yatay fotoğraf 1800×780 · ürün sağda dursun (yazı solda kalır)',
    s: { layout: 'glass', title: 'Başlık', text: 'Kısa açıklama', cta: 'İncele', btn: { st: 'white' }, mfit: 'stack', xc: '#ffffff' } },
  { id: 'hazir', n: 'Hazır banner resmi', d: 'Yazısı resmin içinde olan banner', img: 'wide', size: 'Bilgisayar 1800×780 + telefon 900×1180 (iki ayrı resim)',
    s: { layout: 'cover', title: '', text: '', cta: '', tag: '', logo: 'none', mfit: 'whole' } },
  { id: 'sade', n: 'Sade beyaz', d: 'Süssüz, beyaz zemin', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'split', bg: 'l-white', tag: '', title: 'Ürün adını yazın', text: 'Kısa açıklama', cta: 'İncele', btn: { st: 'dark' } } },
];

// ---- Reklam butonu (slides[i].btn = {st, ar, sz, sh, bg, fg, bd, ac, ab}). st: stil, ar: ok simgesi, sz: boyut, sh: şekil;
// bg/fg/bd/ac/ab: elle seçilen zemin / yazı / çerçeve / ok / ok zemini renkleri (boşsa stilinki).
// v: CSS değişkenleri (--b-*): bg zemin, fg yazı, bd çerçeve rengi, bw çerçeve kalınlığı, sh gölge, blur cam, ab ok zemini, af ok rengi
const GG = 'linear-gradient(135deg, var(--g1), var(--g2))';
const GOLD = 'linear-gradient(135deg, #a16207, #fde68a 45%, #ca8a04 70%, #fef3c7)';
export const BTN_STYLES = [
  { id: 'white', n: 'Beyaz', g: 'Sade', v: { bg: '#ffffff', fg: '#0b1430', ab: GG, af: '#ffffff', sh: '0 10px 30px -10px rgb(0 0 0 / .45)' } },
  { id: 'dark', n: 'Lacivert', g: 'Sade', v: { bg: '#0b1430', fg: '#ffffff', ab: '#ffffff', af: '#0b1430', sh: '0 10px 30px -12px rgb(0 0 0 / .6)' } },
  { id: 'black', n: 'Siyah', g: 'Sade', v: { bg: '#000000', fg: '#ffffff', bd: 'rgb(255 255 255 / .22)', bw: '1px', ab: '#ffffff', af: '#000000' } },
  { id: 'brand', n: 'Mağaza rengi', g: 'Sade', v: { bg: 'var(--accent)', fg: '#ffffff', ab: 'rgb(255 255 255 / .22)', af: '#ffffff', sh: '0 10px 26px -12px var(--accent)' } },
  { id: 'soft', n: 'Yumuşak', g: 'Sade', v: { bg: 'rgb(255 255 255 / .16)', fg: '#ffffff', ab: 'rgb(255 255 255 / .24)', af: '#ffffff' } },
  { id: 'outline', n: 'Beyaz çerçeve', g: 'Çerçeveli', v: { bg: 'transparent', fg: '#ffffff', bd: '#ffffff', bw: '2px', ab: '#ffffff', af: '#0b1430' } },
  { id: 'outline-dark', n: 'Koyu çerçeve', g: 'Çerçeveli', v: { bg: 'transparent', fg: '#0b1430', bd: '#0b1430', bw: '2px', ab: '#0b1430', af: '#ffffff' } },
  { id: 'glass', n: 'Buzlu cam', g: 'Çerçeveli', v: { bg: 'rgb(255 255 255 / .14)', fg: '#ffffff', bd: 'rgb(255 255 255 / .4)', bw: '1px', blur: 'blur(12px) saturate(1.3)', ab: 'rgb(255 255 255 / .92)', af: '#0b1430' } },
  { id: 'neon', n: 'Neon', g: 'Çerçeveli', v: { bg: '#05060f', fg: '#e0f2fe', bd: '#22d3ee', bw: '1.5px', sh: '0 0 18px rgb(34 211 238 / .55)', ab: 'transparent', af: '#22d3ee' } },
  { id: 'accent', n: 'Tema renkli', g: 'Renkli', v: { bg: GG, fg: '#ffffff', ab: 'rgb(255 255 255 / .22)', af: '#ffffff', sh: '0 10px 30px -10px var(--g1)' } },
  { id: 'sunset', n: 'Gün batımı', g: 'Renkli', v: { bg: 'linear-gradient(135deg, #7c3aed, #ec4899 55%, #f59e0b)', fg: '#ffffff', ab: 'rgb(255 255 255 / .25)', af: '#ffffff', sh: '0 10px 30px -10px #ec4899' } },
  { id: 'ocean', n: 'Okyanus', g: 'Renkli', v: { bg: 'linear-gradient(135deg, #0ea5e9, #2563eb)', fg: '#ffffff', ab: 'rgb(255 255 255 / .25)', af: '#ffffff', sh: '0 10px 30px -10px #2563eb' } },
  { id: 'sale', n: 'Kampanya kırmızı', g: 'Renkli', v: { bg: 'linear-gradient(135deg, #dc2626, #f97316)', fg: '#ffffff', ab: '#ffffff', af: '#dc2626', sh: '0 10px 30px -10px #dc2626' } },
  { id: 'green', n: 'Yeşil', g: 'Renkli', v: { bg: '#16a34a', fg: '#ffffff', ab: '#ffffff', af: '#16a34a', sh: '0 10px 26px -12px #16a34a' } },
  { id: 'gold', n: 'Altın', g: 'Lüks', v: { bg: GOLD, fg: '#3b2a05', ab: '#1c1407', af: '#fcd34d', sh: '0 10px 30px -10px rgb(202 138 4 / .7)' } },
  { id: 'black-gold', n: 'Siyah altın', g: 'Lüks', v: { bg: '#0a0a0b', fg: '#f5c542', bd: '#f5c542', bw: '1.5px', ab: GOLD, af: '#0a0a0b' } },
  { id: 'chrome', n: 'Krom', g: 'Lüks', v: { bg: 'linear-gradient(180deg, #f8fafc, #cbd5e1 48%, #94a3b8 52%, #e2e8f0)', fg: '#0f172a', ab: '#0f172a', af: '#ffffff', sh: '0 8px 22px -10px rgb(0 0 0 / .5)' } },
  { id: 'rose-gold', n: 'Rose gold', g: 'Lüks', v: { bg: 'linear-gradient(135deg, #b76e79, #f4c2c2 50%, #b76e79)', fg: '#3b1219', ab: '#3b1219', af: '#f4c2c2' } },
  { id: 'link', n: 'Sadece yazı', g: 'Sade', v: { bg: 'transparent', fg: '#ffffff', ab: 'transparent', af: 'currentColor', sh: 'none' } },
];
export const BTN_BY = Object.fromEntries(BTN_STYLES.map((x) => [x.id, x]));
// eski buton seçimi (s.bs) → yeni stil
export const BS_TO_BTN = { light: 'white', dark: 'dark', accent: 'accent', outline: 'outline', glass: 'glass' };
// Ok simgesi: ic (simge), v (--a-*: bg zemin, fg renk, r köşe, bw/bd halka, sh gölge). 'auto' stilin kendi ok renkleri
export const ARROWS = [
  { id: 'auto', n: 'Stile uygun', ic: 'arrow', v: {} },
  { id: 'grad', n: 'Renkli daire', ic: 'arrow', v: { bg: GG, fg: '#ffffff' } },
  { id: 'white', n: 'Beyaz daire', ic: 'arrow', v: { bg: '#ffffff', fg: '#0b1430' } },
  { id: 'dark', n: 'Koyu daire', ic: 'arrow', v: { bg: '#0b1430', fg: '#ffffff' } },
  { id: 'brand', n: 'Mağaza rengi', ic: 'arrow', v: { bg: 'var(--accent)', fg: '#ffffff' } },
  { id: 'gold', n: 'Altın', ic: 'arrow', v: { bg: GOLD, fg: '#3b2a05', sh: '0 4px 12px -4px rgb(202 138 4 / .8)' } },
  { id: 'ring', n: 'Halka', ic: 'arrow', v: { bg: 'transparent', fg: 'currentColor', bw: '1.5px', bd: 'currentColor' } },
  { id: 'glass', n: 'Cam', ic: 'arrow', v: { bg: 'rgb(255 255 255 / .22)', fg: '#ffffff', bw: '1px', bd: 'rgb(255 255 255 / .45)' } },
  { id: 'square', n: 'Kare', ic: 'arrow', v: { r: '10px' } },
  { id: 'ne', n: 'Çapraz ok ↗', ic: 'ne', v: {} },
  { id: 'long', n: 'Uzun ok', ic: 'long', v: { bg: 'transparent', fg: 'currentColor', w: '34px' } },
  { id: 'plain', n: 'Sade ok', ic: 'arrow', v: { bg: 'transparent', fg: 'currentColor' } },
  { id: 'chev', n: 'İnce ok ›', ic: 'chev', v: { bg: 'transparent', fg: 'currentColor' } },
  { id: 'dbl', n: 'Çift ok »', ic: 'dbl', v: { bg: 'transparent', fg: 'currentColor' } },
  { id: 'cart', n: 'Sepet', ic: 'cart', v: {} },
  { id: 'play', n: 'Oynat', ic: 'play', v: {} },
  { id: 'wa', n: 'WhatsApp', ic: 'wa', v: { bg: '#25d366', fg: '#ffffff' } },
  { id: 'neon', n: 'Neon', ic: 'arrow', v: { bg: 'transparent', fg: '#22d3ee', bw: '1.5px', bd: '#22d3ee', sh: '0 0 12px rgb(34 211 238 / .7)' } },
  { id: 'none', n: 'Oksuz', ic: '', v: {} },
];
export const ARROW_BY = Object.fromEntries(ARROWS.map((x) => [x.id, x]));

// ---- Logo rengi (look.logoTone): 'orig' (varsayılan) · 'tint' temanın ana rengine kaydır · 'gray' siyah-beyaz · 'white' beyaz
// ERT logosu mavi-camgöbeği (ortalama ton ~197°, açıklık ~%42): tint = renk tonunu ana renge çevirir, doygunluk / açıklık yaklaştırılır.
const toHsl = (hex) => { const r0 = hexRgb(hex); if (!r0) return null; const [r, g, b] = r0.map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h, s, l }; };
// 3.11.2026 kullanıcı: 'temaya uyar' filtre gibi çirkin duruyordu → rengi kendisi seçer. 'color' = logonun gölgeleri korunur, seçilen
// renk tonlarına boyanır (koyu kısım = seçilen renk, açık kısım = rengin açığı); 'flat' = tek düz renk. SVG filtresi belgeye bir kez eklenir.
export function ensureLogoSvg(doc, color) {
  if (!doc?.body) return;
  const c = hexRgb(/^#[0-9a-f]{6}$/i.test(color || '') ? color : '#1f6feb') || [31, 111, 235];
  const d = c.map((v) => (v / 255) * 0.72), l = c.map((v) => (v / 255) * 0.45 + 0.55); // koyu uç / açık uç
  let el = doc.getElementById('logo-svg-f');
  if (!el) { el = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.id = 'logo-svg-f'; el.setAttribute('aria-hidden', 'true'); el.setAttribute('width', '0'); el.setAttribute('height', '0'); el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; doc.body.appendChild(el); }
  const tv = (i) => `${d[i].toFixed(3)} ${(c[i] / 255).toFixed(3)} ${l[i].toFixed(3)}`;
  el.innerHTML = `<filter id="logo-tone" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="${tv(0)}"/><feFuncG type="table" tableValues="${tv(1)}"/><feFuncB type="table" tableValues="${tv(2)}"/></feComponentTransfer></filter>`
    + `<filter id="logo-flat" color-interpolation-filters="sRGB"><feFlood flood-color="rgb(${c.join(',')})"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
}
export function logoFilter(mode, accent) {
  if (mode === 'color') return 'url(#logo-tone)';
  if (mode === 'flat') return 'url(#logo-flat)';
  if (mode === 'gray') return 'grayscale(1) contrast(1.1)';
  if (mode === 'white') return 'brightness(0) invert(1)';
  if (mode !== 'tint') return '';
  const c = toHsl(accent); if (!c) return '';
  const br = Math.min(1.5, Math.max(0.45, c.l / 0.42)).toFixed(2);
  if (c.s < 0.14) return `grayscale(1) brightness(${br})`;
  const sat = Math.min(1.6, Math.max(0.35, c.s / 0.85)).toFixed(2);
  return `hue-rotate(${Math.round(c.h - 197)}deg) saturate(${sat}) brightness(${br})`;
}
