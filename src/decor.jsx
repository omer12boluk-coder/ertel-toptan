// Mağaza süsü (tema): sadece müşterinin gördüğü online mağazada (role public) süzülen / yağan süsler, üstte süs şeridi,
// hafif zemin tonu. Ayar: settings.look.decor = { id, amt: 'sm'|'md'|'lg', front }. Yönetim panelinde / bayide çizilmez.
import { useMemo } from 'react';
import { useStore } from './store.js';

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
      const size = p.startsWith('.') ? (p === '.streak' ? 1 : p === '.rect' ? 7 : p === '.bubble' ? 10 + r() * 14 : 3 + r() * 5) : 12 + r() * 14;
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
      {band && c.band !== false && <div className="dc-band" style={{ background: t.bandBg || 'transparent', color: t.bandColor || undefined }}><span>{band}</span></div>}
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
