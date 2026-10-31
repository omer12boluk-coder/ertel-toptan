// Tasarım modu 2 — hazır seçenekler kütüphanesi (banner arka planları, renk paletleri, tema paketleri)
// Hepsi isteğe bağlı: hiçbiri seçilmemişse mağaza eskisiyle birebir aynı görünür.

// ---- Banner arka planları (slides[i].bg = id). ink: 'l' açık zeminde koyu yazı, yoksa beyaz yazı
const grid = (c, s = 28) => `linear-gradient(${c} 1px, transparent 1px) 0 0/${s}px ${s}px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0/${s}px ${s}px`;
const dots = (c, s = 14, r = 1.4) => `radial-gradient(circle, ${c} ${r}px, transparent ${r + 0.4}px) 0 0/${s}px ${s}px`;
export const BG_CATS = { grad: 'Renk geçişi', aura: 'Işık ve aura', tex: 'Desen ve doku', tech: 'Teknik / atölye', light: 'Açık zemin', glass: 'Parlak ve cam' };
export const BG_PRESETS = [
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
};
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
];
export const PACK_BY = Object.fromEntries(PACKS.map((x) => [x.id, x]));
export const PACK_PARTS = [['palette', 'Renkler'], ['hero', 'Banner zemini'], ['band', 'Duyuru şeridi'], ['fx', 'Efekt'], ['badge', 'Ürün rozeti'], ['tint', 'Sayfa tonu']];

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
    tint: on('tint') ? base.tint : '',
  };
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
    s: { layout: 'split', bg: 'g-night', tag: 'Yeni ürün', title: 'Ürün adını yazın', text: 'Tek cümlelik kısa açıklama: ne işe yarar, neden iyi?', cta: 'Ürünü incele', bs: 'light', mfit: '' } },
  { id: 'urun-acik', n: 'Ürün · açık zemin', d: 'Ferah, beyaz-gri zemin', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'split', bg: 'l-mist', tag: 'Stokta', title: 'Ürün adını yazın', text: 'Kısa açıklama', cta: 'İncele', bs: 'dark' } },
  { id: 'premium', n: 'Siyah altın', d: 'Pahalı ürünler için', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'reverse', bg: 'a-gold', tag: 'Profesyonel seri', title: 'Ürün adını yazın', text: 'Kısa açıklama', cta: 'Hemen incele', bs: 'accent', tc: 'g:gold' } },
  { id: 'atolye', n: 'Atölye / teknik', d: 'Devre kartı zemini', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'split', bg: 'k-grid', tag: 'Ustalar için', title: 'Ürün adını yazın', text: 'Teknik özellik ya da kısa açıklama', cta: 'Özellikleri gör', bs: 'glass' } },
  { id: 'kampanya', n: 'Kampanya / indirim', d: 'Ortalı, büyük başlık', img: '', size: 'Resim gerekmez',
    s: { layout: 'center', bg: 'a-lava', tag: '%20 İNDİRİM', title: 'Kampanya başlığı', text: 'Kampanyanın kısa açıklaması ve son tarihi', cta: 'Fırsatları gör', bs: 'light' } },
  { id: 'duyuru', n: 'Duyuru', d: 'Sade, resimsiz', img: '', size: 'Resim gerekmez',
    s: { layout: 'center', bg: 'g-royal', tag: 'Duyuru', title: 'Duyuru başlığı', text: 'Kısa bilgi: çalışma saatleri, kargo, yeni gelenler…', cta: '', bs: 'light' } },
  { id: 'foto', n: 'Tam fotoğraf', d: 'Fotoğraf her yeri kaplar, yazı altta', img: 'wide', size: 'Yatay fotoğraf 1800×780 · telefona ayrı dikey resim önerilir (900×1180)',
    s: { layout: 'cover', title: 'Başlık', text: 'Kısa açıklama', cta: 'İncele', bs: 'light', mfit: 'stack', xc: '#ffffff' } },
  { id: 'foto-kutu', n: 'Fotoğraf + yazı kutusu', d: 'Yazı buzlu cam kutuda', img: 'wide', size: 'Yatay fotoğraf 1800×780 · ürün sağda dursun (yazı solda kalır)',
    s: { layout: 'glass', title: 'Başlık', text: 'Kısa açıklama', cta: 'İncele', bs: 'light', mfit: 'stack', xc: '#ffffff' } },
  { id: 'hazir', n: 'Hazır banner resmi', d: 'Yazısı resmin içinde olan banner', img: 'wide', size: 'Bilgisayar 1800×780 + telefon 900×1180 (iki ayrı resim)',
    s: { layout: 'cover', title: '', text: '', cta: '', tag: '', logo: 'none', mfit: 'whole' } },
  { id: 'sade', n: 'Sade beyaz', d: 'Süssüz, beyaz zemin', img: 'prod', size: 'Saydam arka planlı PNG, kare, en az 1000×1000',
    s: { layout: 'split', bg: 'l-white', tag: '', title: 'Ürün adını yazın', text: 'Kısa açıklama', cta: 'İncele', bs: 'dark' } },
];
