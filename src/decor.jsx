// Mağaza süsü (tema): sadece müşterinin gördüğü online mağazada (role public) süzülen / yağan süsler, üstte süs şeridi,
// hafif zemin tonu. Ayar: settings.look.decor = { id, amt: 'sm'|'md'|'lg', front }. Yönetim panelinde / bayide çizilmez.
import { useMemo, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './store.js';
import { activePack, patBg, ornBg } from './presets.js';
import { useWin } from './dzframe.jsx';
import { FONT_BY, ensureFonts } from './slidex.jsx';

// p: parçalar (emoji ya da şekil: '.dot' nokta, '.rect' konfeti, '.streak' yağmur, '.bubble' kabarcık, '.star' parıltı)
// m: hareket fall | rise | float | twinkle · c: şekil renkleri · bg: zemin tonu · band: süs şeridi (emoji tekrarı) · bandBg: şerit zemini
export const DECOR = [
  { id: 'yilbasi', name: 'Yılbaşı', ic: '🎄', p: ['❄', '❅', '❆', '❄', '✦'], m: 'fall', c: ['#7fb2ec', '#a9cbf2', '#5f9de0'], bg: 'linear-gradient(180deg, rgb(214 232 255 / .55), transparent 60%)', band: '🎄 🎁 ⭐ 🔔 ', bandBg: 'linear-gradient(90deg, #b91c1c, #15803d, #b91c1c)' },
  { id: 'kar', name: 'Karlı kış', ic: '❄️', p: ['.dot'], m: 'fall', c: ['#ffffff', '#dbe9fb', '#c4daf6'], bg: 'linear-gradient(180deg, rgb(200 220 245 / .55), transparent 70%)', band: '❄ ❅ ❆ ' },
  { id: 'cumhuriyet', name: '29 Ekim', ic: '🇹🇷', p: ['★', '☾', '★'], m: 'float', c: ['#e30a17', '#e30a17', '#ffffff'], bg: 'linear-gradient(180deg, rgb(227 10 23 / .07), transparent 55%)', band: '🇹🇷 ', bandBg: '#e30a17' },
  { id: 'ramazan', name: 'Ramazan', ic: '🌙', p: ['🌙', '⭐', '✨', '🏮'], m: 'float', bg: 'linear-gradient(180deg, rgb(30 41 99 / .08), transparent 60%)', band: '🏮 🌙 ⭐ ', bandBg: 'linear-gradient(90deg, #1e2a63, #3b2f7a, #1e2a63)' },
  { id: 'bayram', name: 'Bayram', ic: '🍬', p: ['🍬', '🍭', '✨', '🌙'], m: 'fall', bg: 'linear-gradient(180deg, rgb(250 204 21 / .1), transparent 60%)', band: '🍬 ✨ 🌙 ' },
  { id: 'sevgililer', name: 'Sevgililer günü', ic: '❤️', p: ['❤', '♥', '💕', '💗'], m: 'rise', c: ['#e11d48', '#f43f5e', '#fb7185'], bg: 'linear-gradient(180deg, rgb(244 63 94 / .08), transparent 60%)', band: '💕 ❤️ 💗 ' },
  { id: 'bahar', name: 'Çiçekli bahar', ic: '🌸', p: ['🌸', '🌼', '🌷', '🌸'], m: 'fall', bg: 'linear-gradient(180deg, rgb(244 114 182 / .09), transparent 60%)', band: '🌸 🌼 🌷 🌿 ' },
  { id: 'anneler', name: 'Anneler günü', ic: '💐', p: ['💐', '🌷', '💖', '🌸'], m: 'rise', bg: 'linear-gradient(180deg, rgb(236 72 153 / .08), transparent 60%)', band: '💐 💖 🌷 ' },
  { id: 'yaz', name: 'Yaz', ic: '☀️', p: ['☀️', '🌴', '🍉', '🕶️'], m: 'float', bg: 'linear-gradient(180deg, rgb(251 191 36 / .14), transparent 60%)', band: '☀️ 🌴 🍉 🏖️ ' },
  { id: 'kumlu', name: 'Kumlu sahil', ic: '🏖️', p: ['.dot', '.dot', '🐚', '.dot'], m: 'fall', c: ['#d6b47a', '#e8cc96', '#c9a063'], bg: 'linear-gradient(180deg, rgb(232 204 150 / .32), rgb(232 204 150 / .1) 70%, rgb(125 211 252 / .08))', band: '🐚 🌊 ⭐ 🏖️ ', bandBg: 'linear-gradient(90deg, #e8cc96, #7dd3fc, #e8cc96)' },
  { id: 'deniz', name: 'Deniz', ic: '🌊', p: ['.bubble'], m: 'rise', c: ['#38bdf8', '#7dd3fc', '#0ea5e9'], bg: 'linear-gradient(180deg, rgb(14 165 233 / .1), transparent 65%)', band: '🌊 🐠 🐚 ' },
  { id: 'sonbahar', name: 'Sonbahar', ic: '🍂', p: ['🍂', '🍁', '🍂'], m: 'fall', bg: 'linear-gradient(180deg, rgb(234 88 12 / .08), transparent 60%)', band: '🍂 🍁 🌰 ' },
  { id: 'yagmur', name: 'Yağmurlu', ic: '🌧️', p: ['.streak'], m: 'rain', c: ['#7aa7d9', '#93b8e0'], bg: 'linear-gradient(180deg, rgb(100 116 139 / .1), transparent 60%)', band: '☔ 🌧️ ' },
  { id: 'kutlama', name: 'Kutlama / konfeti', ic: '🎉', p: ['.rect'], m: 'fall', c: ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'], bg: '', band: '🎉 🎊 🥳 ' },
  { id: 'efsane', name: 'Efsane Cuma', ic: '🖤', p: ['✦', '✧', '%'], m: 'twinkle', c: ['#d4a017', '#f5c542', '#111827'], bg: 'linear-gradient(180deg, rgb(17 24 39 / .08), transparent 60%)', band: '% İNDİRİM ✦ ', bandBg: 'linear-gradient(90deg, #111827, #3f3f46, #111827)', bandColor: '#f5c542' },
  { id: 'yildiz', name: 'Yıldızlı gece', ic: '✨', p: ['.star'], m: 'twinkle', c: ['#fde68a', '#ffffff', '#c7d2fe'], bg: 'linear-gradient(180deg, rgb(49 46 129 / .09), transparent 70%)', band: '✨ ⭐ 🌙 ' },
  { id: 'atolye', name: 'Tamir atölyesi', ic: '🔧', p: ['🔧', '🪛', '📱', '⚙️', '🔌'], m: 'float', bg: 'linear-gradient(180deg, rgb(59 130 246 / .07), transparent 60%)', band: '🔧 📱 ⚙️ 🪛 ' },
  { id: 'okul', name: 'Okula dönüş', ic: '✏️', p: ['✏️', '📚', '📐', '🎒'], m: 'float', bg: 'linear-gradient(180deg, rgb(234 179 8 / .09), transparent 60%)', band: '✏️ 📚 🎒 ' },
];
const AMT = { sm: 10, md: 18, lg: 30 };

// sabit rastgele (her açılışta aynı yerleşim titremesin diye tohumlu)
const rnd = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

function Parts({ t, n }) {
  const list = useMemo(() => {
    const r = rnd(t.id.length * 977 + n);
    return Array.from({ length: n }, (_, i) => {
      const p = t.p[i % t.p.length];
      const size = p.startsWith('.') ? (p === '.streak' ? 1 : p === '.rect' || p === '.petal' ? 7 : p === '.bubble' ? 10 + r() * 14 : 3 + r() * 5) : 12 + r() * 14;
      const dur = t.m === 'rain' ? 0.9 + r() * 0.8 : t.m === 'twinkle' ? 2 + r() * 3 : t.m === 'float' ? 14 + r() * 12 : 9 + r() * 9;
      return { p, i, left: r() * 100, top: r() * 100, size, dur, delay: -r() * dur, sway: 10 + r() * 40, rot: r() * 360, c: t.c ? t.c[i % t.c.length] : null, o: 0.55 + r() * 0.4 };
    });
  }, [t, n]);
  return list.map((x) => {
    const st = { left: x.left + '%', '--top': x.top + '%', '--dur': x.dur + 's', '--del': x.delay + 's', '--sw': x.sway + 'px', '--rot': x.rot + 'deg', '--o': x.o, '--sz': x.size + 'px' };
    if (x.c) st['--c'] = x.c;
    return x.p.startsWith('.')
      ? <i key={x.i} className={'dc-p dc-' + t.m + ' dc-s' + x.p.slice(1)} style={st} />
      : <i key={x.i} className={'dc-p dc-' + t.m + ' dc-e'} style={{ ...st, fontSize: x.size + 'px', color: x.c || undefined }}>{x.p}</i>;
  });
}

// Mağazada çizilen süs katmanı; preview: Ayarlar'daki küçük önizleme kutusu
export function StoreDecor({ cfg, preview }) {
  const S = useStore((s) => s.settings);
  const role = useStore((s) => s.user?.role);
  const tab = useStore((s) => s.tab);
  const pk = !cfg && !preview ? activePack(S.look) : null;
  // 1.11.2026: şerit + süs dizisi varsayılan SADECE ana sayfada (diğer sayfalarda arama kutusunu kapatıyordu). look.pack.topAll = her sayfada
  const top = tab === 'anasayfa' || !!S.look?.pack?.topAll;
  if (pk && role === 'public') return <PackDecor pk={pk} top={top} />;
  const c = cfg || S.look?.decor || {};
  const t = DECOR.find((x) => x.id === c.id);
  if (!t || (!preview && role !== 'public')) return null;
  const phone = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 700px)').matches;
  const n = Math.round((AMT[c.amt] || AMT.md) * (preview ? 0.7 : phone ? 0.6 : 1));
  const band = t.band ? t.band.repeat(preview ? 8 : 40) : '';
  return (
    <div className={'decor' + (preview ? ' pv' : '') + (c.front !== false ? ' front' : '')} aria-hidden="true">
      {t.bg && <div className="dc-bg" style={{ background: t.bg }} />}
      <div className="dc-layer"><Parts t={t} n={n} /></div>
      {band && c.band !== false && (preview || tab === 'anasayfa') && <div className="dc-band" style={{ background: t.bandBg || 'transparent', color: t.bandColor || undefined }}><span>{band}</span></div>}
    </div>
  );
}

// Tema Stüdyosu (look.pack): efekt + duyuru şeridi + sayfa tonu. inFrame: tasarım modunun önizleme çerçevesinde
const FX_SHAPE = { sparkle: ['.star', 'twinkle'], dust: ['.dot', 'float'], snow: ['.dot', 'fall'], confetti: ['.rect', 'fall'], bubble: ['.bubble', 'rise'], rain: ['.streak', 'rain'], petal: ['.petal', 'fall'],
  hearts: ['♥', 'rise'], flakes: ['❄', 'fall'], stars: ['★', 'float'], leaves: ['🍂', 'fall'], balloons: ['🎈', 'rise'], gears: ['⚙', 'float'] };
// Kayan yazı: tek parça ölçülür, ekranı dolduracak kadar kopya iki yarıya konur, yarım genişlik kadar kayar → hiç boşluk kalmaz.
// (Eski yöntem: 14 kopyalık dev tek satır %50 kayıyordu; iPhone çok geniş katmanı parça parça çizip başta/sonda boşluk bırakıyordu.)
export function Ticker({ text, speed = 1, W: W0 }) {
  const W = W0 || window;
  const unit = useRef(null);
  const [m, setM] = useState({ w: 0, n: 2 });
  useLayoutEffect(() => {
    const el = unit.current; if (!el) return;
    const fit = () => { const w = el.getBoundingClientRect().width; if (!w) return; const vw = Math.max(W.innerWidth || 0, el.parentElement?.parentElement?.clientWidth || 0, 320); const n = Math.max(1, Math.ceil(vw / w) + 1); setM((o) => (o.w === w && o.n === n ? o : { w, n })); };
    fit();
    const ro = new (W.ResizeObserver || ResizeObserver)(fit); ro.observe(el);
    W.addEventListener('resize', fit);
    W.document?.fonts?.ready?.then(fit);
    return () => { ro.disconnect(); W.removeEventListener('resize', fit); };
  }, [text, W]);
  const half = m.w * m.n;
  const dur = half ? half / (38 * (speed || 1)) : 60; // ~38 px/sn
  const units = Array.from({ length: m.n * 2 }, (_, i) => <span key={i} ref={i === 0 ? unit : undefined} className="tk-u">{text}</span>);
  return <span className="tk-track" style={half ? { '--tk-x': -half + 'px', animationDuration: dur + 's' } : { animation: 'none' }}>{units}</span>;
}

export function PackDecor({ pk, mini, top = true }) {
  const W = useWin();
  if (!pk) return null;
  const sh = FX_SHAPE[pk.fx?.kind];
  const phone = W.matchMedia('(max-width: 700px)').matches;
  const n = sh ? Math.round((AMT[pk.fx.amt] || AMT.md) * (phone ? 0.6 : 1) * (mini ? 0.6 : 1)) : 0;
  const t = sh ? { id: pk.id + pk.fx.kind, p: [sh[0]], m: sh[1], c: pk.fx.c?.length ? pk.fx.c : ['#ffffff'] } : null;
  const band = top && pk.band?.text ? pk.band.text + '\u00a0\u00a0\u00a0·\u00a0\u00a0\u00a0' : '';
  const round = pk.band?.shape === 'round';
  const pat = pk.pat?.k && pk.pat.k !== 'none' ? patBg(pk.pat.k, pk.pat.c || '#64748b', pk.pat.z || 1) : null;
  const orn = top && pk.orn?.k && pk.orn.k !== 'none' ? ornBg(pk.orn.k, pk.orn.c) : null;
  const fam = FONT_BY[pk.band?.font]?.fam;
  if (fam) ensureFonts(W.document, [pk.band.font]);
  const bf = fam ? { fontFamily: `'${fam}', system-ui, sans-serif` } : null;
  return (
    <div className={'decor pk-decor front' + (mini ? ' pv' : '') + (band ? ' has-band' : '') + (band && round ? ' band-round' : '')} aria-hidden="true">
      {pat && <div className="dc-bg pk-pat" style={{ ...pat, opacity: pk.pat.o ?? 0.07 }} />}
      {pk.tint && <div className="dc-bg" style={{ background: pk.tint }} />}
      {orn && <div className="pk-orn" style={{ backgroundImage: orn.img, backgroundSize: orn.w + 'px ' + orn.h + 'px', height: orn.h }} />}
      {t && <div className="dc-layer"><Parts t={t} n={n} /></div>}
      {band && <div className={'dc-band pk-band' + (round ? ' round' : '')} style={{ background: pk.band.bg || '#111827', color: pk.band.color || '#fff', ...bf }}><Ticker text={band} speed={pk.band.sp || 1} W={W} /></div>}
    </div>
  );
}

// Ayarlar > Mağaza teması
export function DecorSettings({ d, set, Toggle }) {
  const c = d.look?.decor || {};
  const cur = DECOR.find((x) => x.id === c.id);
  return <>
    <p className="fine">Online mağazayı döneme göre süsler (yağan kar, çiçekler, konfeti…). <b>Sadece müşteriler görür</b>; yönetim paneli ve bayi uygulaması değişmez. Süsler hiçbir tıklamayı engellemez.</p>
    <div className="dc-pick">
      <button type="button" className={'dc-card' + (!cur ? ' on' : '')} onClick={() => set('look.decor', { ...c, id: '' })}><span className="dc-ic">⛔</span><b>Kapalı</b></button>
      {DECOR.map((t) => (
        <button key={t.id} type="button" className={'dc-card' + (cur?.id === t.id ? ' on' : '')} onClick={() => set('look.decor', { amt: 'md', ...c, id: t.id })}>
          <span className="dc-ic">{t.ic}</span><b>{t.name}</b>
        </button>
      ))}
    </div>
    {cur && <>
      <div className="dc-preview"><StoreDecor cfg={c} preview /><div className="dc-pv-card"><b>{cur.ic} {cur.name}</b><small>Önizleme</small></div></div>
      <div className="row2">
        <label className="field"><span className="field-l">Süs miktarı</span>
          <span className="seg">{[['sm', 'Az'], ['md', 'Orta'], ['lg', 'Çok']].map(([k, l]) => <button key={k} type="button" className={(c.amt || 'md') === k ? 'on' : ''} onClick={() => set('look.decor', { ...c, amt: k })}>{l}</button>)}</span>
        </label>
        <div className="field">
          <Toggle id="dc-band" label="Üstte süs şeridi" hint="Menünün altında ince süslü şerit" checked={c.band !== false} onChange={(v) => set('look.decor', { ...c, band: v })} />
          <Toggle id="dc-front" label="Süsler ürünlerin önünde de" hint="Kapalıyken sadece boşluklarda görünür (daha sade)" checked={c.front !== false} onChange={(v) => set('look.decor', { ...c, front: v })} />
        </div>
      </div>
    </>}
  </>;
}
