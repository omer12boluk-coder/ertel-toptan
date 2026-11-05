// Banner (reklam) serbest öğeleri (1.11.2026): yazı kutuları, şekiller ve kalemle serbest çizim — basit bir görsel düzenleyici.
// Kayıt: slides[i].els = [{ id, k: 'text'|'shape'|'draw', ...görünüm, d: {x, y, w?, fs?, r?}, m?: {aynı alanlar, telefona özel} }]
// x / y = öğenin ORTASI, reklam kutusunun %'si; w = genişlik (kutunun %'si); fs = yazı boyu (1200 px genişlikte px;
// telefonda 390 px genişlikte px, telefona ayrı verilmemişse bilgisayarınkinin %55'i) → her ekran boyunda aynı oran.
// Telefona ayrı yer verilmemişse (m yok) bilgisayardaki yer kullanılır. Hepsi isteğe bağlı: els yoksa reklam eskisiyle birebir aynı.
import { useEffect, useMemo, useState } from 'react';
import { Icon, Field } from './ui.jsx';
import { useWin } from './dzframe.jsx';
import { ColorPick } from './shophome.jsx';

// ---- Yazı tipleri (Google Fonts, Türkçe harfleri olanlar; sadece kullanılanlar yüklenir) ------------------------------------
export const FONTS = [
  { id: '', n: 'Sayfanın yazısı', g: 'Sade', fam: null },
  { id: 'inter', n: 'Inter', g: 'Sade', fam: 'Inter', w: [400, 700, 900] },
  // 5.11.2026 Apple hissine yakın yeni yazı tipleri (hepsi Türkçe harfleri destekler)
  { id: 'intert', n: 'Inter Tight', g: 'Apple gibi', fam: 'Inter Tight', w: [400, 600, 700, 800] },
  { id: 'manrope', n: 'Manrope', g: 'Apple gibi', fam: 'Manrope', w: [400, 600, 700, 800] },
  { id: 'jakarta', n: 'Plus Jakarta Sans', g: 'Apple gibi', fam: 'Plus Jakarta Sans', w: [400, 600, 700, 800] },
  { id: 'geist', n: 'Geist', g: 'Apple gibi', fam: 'Geist', w: [400, 600, 700, 800] },
  { id: 'dmsans', n: 'DM Sans', g: 'Apple gibi', fam: 'DM Sans', w: [400, 600, 700] },
  { id: 'figtree', n: 'Figtree', g: 'Apple gibi', fam: 'Figtree', w: [400, 600, 700, 800] },
  { id: 'outfit', n: 'Outfit', g: 'Apple gibi', fam: 'Outfit', w: [400, 600, 700] },
  { id: 'sora', n: 'Sora', g: 'Apple gibi', fam: 'Sora', w: [400, 600, 700] },
  { id: 'montserrat', n: 'Montserrat', g: 'Sade', fam: 'Montserrat', w: [400, 700, 900] },
  { id: 'poppins', n: 'Poppins', g: 'Sade', fam: 'Poppins', w: [400, 700, 900] },
  { id: 'rubik', n: 'Rubik', g: 'Sade', fam: 'Rubik', w: [400, 700, 900] },
  { id: 'nunito', n: 'Nunito', g: 'Sade', fam: 'Nunito', w: [400, 700, 900] },
  { id: 'fredoka', n: 'Fredoka', g: 'Sade', fam: 'Fredoka', w: [400, 700] },
  { id: 'barlowc', n: 'Barlow Condensed', g: 'Dar ve güçlü', fam: 'Barlow Condensed', w: [400, 700, 900] },
  { id: 'oswald', n: 'Oswald', g: 'Dar ve güçlü', fam: 'Oswald', w: [400, 700] },
  { id: 'bebas', n: 'Bebas Neue', g: 'Dar ve güçlü', fam: 'Bebas Neue', w: [400] },
  { id: 'anton', n: 'Anton', g: 'Dar ve güçlü', fam: 'Anton', w: [400] },
  { id: 'teko', n: 'Teko', g: 'Dar ve güçlü', fam: 'Teko', w: [400, 700] },
  { id: 'archivo', n: 'Archivo Black', g: 'Kalın vitrin', fam: 'Archivo Black', w: [400] },
  { id: 'russo', n: 'Russo One', g: 'Kalın vitrin', fam: 'Russo One', w: [400] },
  { id: 'bungee', n: 'Bungee', g: 'Kalın vitrin', fam: 'Bungee', w: [400] },
  { id: 'righteous', n: 'Righteous', g: 'Kalın vitrin', fam: 'Righteous', w: [400] },
  { id: 'abril', n: 'Abril Fatface', g: 'Zarif', fam: 'Abril Fatface', w: [400] },
  { id: 'playfair', n: 'Playfair Display', g: 'Zarif', fam: 'Playfair Display', w: [400, 700, 900] },
  { id: 'merri', n: 'Merriweather', g: 'Zarif', fam: 'Merriweather', w: [400, 700, 900] },
  { id: 'lobster', n: 'Lobster', g: 'El yazısı', fam: 'Lobster', w: [400] },
  { id: 'pacifico', n: 'Pacifico', g: 'El yazısı', fam: 'Pacifico', w: [400] },
  { id: 'dancing', n: 'Dancing Script', g: 'El yazısı', fam: 'Dancing Script', w: [400, 700] },
  { id: 'greatv', n: 'Great Vibes', g: 'El yazısı', fam: 'Great Vibes', w: [400] },
  { id: 'caveat', n: 'Caveat', g: 'El yazısı', fam: 'Caveat', w: [400, 700] },
  { id: 'kalam', n: 'Kalam', g: 'El yazısı', fam: 'Kalam', w: [400, 700] },
  { id: 'mono', n: 'JetBrains Mono', g: 'Teknik', fam: 'JetBrains Mono', w: [400, 700] },
];
export const FONT_BY = Object.fromEntries(FONTS.map((f) => [f.id, f]));
const famCss = (f) => (f?.fam ? `'${f.fam}', var(--f-body)` : undefined);
export function fontsUrl(ids) {
  const fs = [...new Set(ids)].map((id) => FONT_BY[id]).filter((f) => f?.fam);
  if (!fs.length) return '';
  return 'https://fonts.googleapis.com/css2?' + fs.map((f) => 'family=' + f.fam.replace(/ /g, '+') + (f.w.length > 1 || f.w[0] !== 400 ? ':wght@' + f.w.join(';') : '')).join('&') + '&display=swap';
}
// belgeye (tasarım çerçevesi dahil) gereken yazı tiplerini bir kez ekler
const loaded = new WeakMap();
export function ensureFonts(doc, ids) {
  const url = fontsUrl(ids); if (!url || !doc?.head) return;
  let set = loaded.get(doc); if (!set) { set = new Set(); loaded.set(doc, set); }
  if (set.has(url)) return; set.add(url);
  const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = url; doc.head.appendChild(l);
}
export function useSlideFonts(slides) {
  const W = useWin();
  const key = (slides || []).flatMap((s) => (s.els || []).filter((e) => e.k === 'text' && e.f).map((e) => e.f)).sort().join(',');
  useEffect(() => { if (key) ensureFonts(W.document, key.split(',')); }, [key, W]);
}

// ---- Şekiller ---------------------------------------------------------------------------------------------------------
export const SHAPES = [
  { id: 'rect', n: 'Dikdörtgen', ar: 1.6 }, { id: 'round', n: 'Yuvarlak köşe', ar: 1.6 }, { id: 'pill', n: 'Hap', ar: 3 }, { id: 'circle', n: 'Daire', ar: 1 },
  { id: 'line', n: 'Çizgi', ar: 12 }, { id: 'arrow', n: 'Ok', ar: 3.2 }, { id: 'curve', n: 'Kıvrık ok', ar: 2 }, { id: 'tri', n: 'Üçgen', ar: 1.15 },
  { id: 'star', n: 'Yıldız', ar: 1 }, { id: 'burst', n: 'Rozet', ar: 1 }, { id: 'heart', n: 'Kalp', ar: 1.1 }, { id: 'bubble', n: 'Konuşma balonu', ar: 1.4 },
  { id: 'check', n: 'Onay', ar: 1.25 }, { id: 'diamond', n: 'Baklava', ar: 1 }, { id: 'hex', n: 'Altıgen', ar: 1.15 }, { id: 'wave', n: 'Dalga', ar: 5 },
];
const SHAPE_BY = Object.fromEntries(SHAPES.map((s) => [s.id, s]));
const poly = (n, r1, r2, rot = -90) => Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? r2 : r1; const a = ((rot + (i * 180) / n) * Math.PI) / 180; return (50 + r * Math.cos(a)).toFixed(2) + ',' + (50 + r * Math.sin(a)).toFixed(2); }).join(' ');
const BURST_POLY = poly(14, 50, 40);
const STAR_POLY = poly(5, 50, 20);
const BURST_CLIP = 'polygon(' + BURST_POLY.split(' ').map((p) => p.split(',').map((v) => v + '%').join(' ')).join(', ') + ')';
function ShapeSvg({ sh, fill, stroke, sw }) {
  const f = fill || 'none'; const s = stroke || 'none'; const w = stroke ? sw || 3 : 0;
  const P = { fill: f, stroke: s, strokeWidth: w, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round', strokeLinecap: 'round' };
  const L = { fill: 'none', stroke: stroke || fill || '#fff', strokeWidth: sw || 4, vectorEffect: 'non-scaling-stroke', strokeLinecap: 'round', strokeLinejoin: 'round' };
  let body;
  switch (sh) {
    case 'line': body = <line x1="1" y1="50" x2="99" y2="50" {...L} />; break;
    case 'arrow': body = <><line x1="1" y1="50" x2="92" y2="50" {...L} /><path d="M74 14 L99 50 L74 86" {...L} /></>; break;
    case 'curve': body = <><path d="M4 86 C 18 10, 70 4, 92 40" {...L} /><path d="M70 36 L93 42 L94 18" {...L} /></>; break;
    case 'wave': body = <path d="M1 50 Q 13 10 25 50 T 50 50 T 75 50 T 99 50" {...L} />; break;
    case 'check': body = <path d="M6 54 L36 84 L94 14" {...L} />; break;
    case 'tri': body = <polygon points="50,3 97,97 3,97" {...P} />; break;
    case 'star': body = <polygon points={STAR_POLY} {...P} />; break;
    case 'burst': body = <polygon points={BURST_POLY} {...P} />; break;
    case 'diamond': body = <polygon points="50,2 98,50 50,98 2,50" {...P} />; break;
    case 'hex': body = <polygon points="25,4 75,4 98,50 75,96 25,96 2,50" {...P} />; break;
    case 'heart': body = <path d="M50 92 C 12 66, 2 44, 6 26 C 10 8, 36 4, 50 24 C 64 4, 90 8, 94 26 C 98 44, 88 66, 50 92 Z" {...P} />; break;
    case 'bubble': body = <path d="M10 4 H90 Q97 4 97 11 V62 Q97 69 90 69 H40 L22 94 L26 69 H10 Q3 69 3 62 V11 Q3 4 10 4 Z" {...P} />; break;
    default: body = null;
  }
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{body}</svg>;
}

// renk + saydamlık → rgba
export function alpha(hex, a = 1) {
  if (!hex || a >= 1 || !/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${Math.max(0, a).toFixed(2)})`;
}
const SHADOWS = { soft: '0 .06em .28em rgb(0 0 0 / .5)', hard: '.07em .07em 0 rgb(0 0 0 / .6)', glow: '0 0 .35em var(--sxc), 0 0 .9em var(--sxc)', long: '.04em .04em 0 rgb(0 0 0 / .35), .08em .08em 0 rgb(0 0 0 / .3), .12em .12em 0 rgb(0 0 0 / .25)' };
export const TEXT_BG = [['none', 'Yok'], ['box', 'Kutu'], ['pill', 'Hap'], ['circle', 'Daire'], ['tag', 'Etiket'], ['burst', 'Rozet'], ['mark', 'Fosforlu'], ['line', 'Alt çizgi']];

// ---- Mağazada / tasarımda çizim ------------------------------------------------------------------------------------------
function geomVars(el) {
  const g = el.d || {}; const m = el.m || {};
  const v = { '--x': (g.x ?? 50) + '%', '--y': (g.y ?? 50) + '%', '--r': (g.r || 0) + 'deg', '--xm': (m.x ?? g.x ?? 50) + '%', '--ym': (m.y ?? g.y ?? 50) + '%', '--rm': (m.r ?? g.r ?? 0) + 'deg' };
  if (g.w) v['--w'] = g.w + '%';
  if (m.w ?? g.w) v['--wm'] = (m.w ?? g.w) + '%';
  if (el.k === 'text') { v['--fs'] = g.fs || 36; v['--fsm'] = m.fs ?? Math.max(12, Math.round((g.fs || 36) * 0.55 * 10) / 10); }
  if (el.op != null && el.op < 1) v['--op'] = el.op;
  return v;
}
export function SlideEls({ s, k, E }) {
  const els = s.els || [];
  if (!els.length && !(E && E.tool === 'pen')) return null;
  const edit = E && !E.mobile;
  return (
    <div className={'sh-slide-x' + (edit ? ' dz-xl' : '')} aria-hidden={edit ? undefined : 'true'}>
      {els.map((el) => <XEl key={el.id} el={el} k={k} E={edit ? E : null} />)}
      {edit && E.tool === 'pen' && <div className="sx-pen" onPointerDown={(e) => E.penDown(e, k)} title="Çizmek için basılı tutup sürükleyin" />}
    </div>
  );
}
function XEl({ el, k, E }) {
  const on = E && E.sel?.kind === 'xel' && E.sel.slide === k && E.sel.id === el.id;
  const name = el.k === 'text' ? 'Yazı' : el.k === 'draw' ? 'Çizim' : SHAPE_BY[el.sh]?.n || 'Şekil';
  const dz = E ? { 'data-fx-name': name, onPointerDown: (e) => E.xDrag(e, k, el.id), onClick: (e) => e.stopPropagation(), onDoubleClick: (e) => { e.stopPropagation(); E.setSel({ kind: 'xel', slide: k, id: el.id, focus: 'xt' }); } } : {};
  const cls = 'sx sx-' + el.k + (E ? ' dz-x' + (on ? ' on' : '') : '');
  const handle = on && <i className="sx-h" title="Tutup çekin: boyut" onPointerDown={(e) => E.xScale(e, k, el.id)} onClick={(e) => e.stopPropagation()} />;
  const style = geomVars(el);
  if (el.k === 'text') {
    const f = FONT_BY[el.f || '']; const bg = el.bs && el.bs !== 'none' ? el.bs : null;
    const st = {
      ...style, '--sxc': el.c || '#ffffff', color: 'var(--sxc)', fontFamily: famCss(f), fontWeight: el.fw || 700, fontStyle: el.it ? 'italic' : undefined,
      textTransform: el.up ? 'uppercase' : undefined, letterSpacing: el.ls ? el.ls + 'em' : undefined, textAlign: el.al || 'center', lineHeight: el.lh || undefined,
      textShadow: SHADOWS[el.sh] || undefined,
      ...(el.sw ? { WebkitTextStroke: (el.sw / 40) + 'em ' + (el.st || '#000'), paintOrder: 'stroke fill' } : {}),
      ...(bg ? { '--sxb': alpha(el.bg || '#ff3b30', el.bo ?? 1), '--pad': el.pad ?? 0.35 } : {}),
      ...(bg === 'burst' ? { clipPath: BURST_CLIP } : {}),
      ...(el.bx ? { boxShadow: '0 .3em .9em -.3em rgb(0 0 0 / .55)' } : {}),
    };
    return <div className={cls + (bg ? ' sb-' + bg : '')} style={st} {...dz}>{el.t || 'Yazı'}{handle}</div>;
  }
  if (el.k === 'draw') {
    return <div className={cls} style={{ ...style, '--ar': el.ar || 1 }} {...dz}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={el.pts} fill="none" stroke={el.sc || '#ffffff'} strokeWidth={el.sw || 4} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>{handle}
    </div>;
  }
  // şekil: dikdörtgen / yuvarlak / hap / daire CSS kutusu; diğerleri SVG
  const box = ['rect', 'round', 'pill', 'circle'].includes(el.sh);
  const bst = box ? { background: el.fill || 'transparent', border: el.sc ? (el.sw || 3) + 'px solid ' + el.sc : undefined, borderRadius: el.sh === 'round' ? '14%/22%' : el.sh === 'pill' || el.sh === 'circle' ? '999px' : 0 } : {};
  return <div className={cls} style={{ ...style, '--ar': el.ar || SHAPE_BY[el.sh]?.ar || 1, ...bst }} {...dz}>
    {!box && <ShapeSvg sh={el.sh} fill={el.fill} stroke={el.sc} sw={el.sw} />}{handle}
  </div>;
}

// ---- Tasarım modu: ekleme çubuğu ve ayar paneli ----------------------------------------------------------------------------
const xid = () => Math.random().toString(36).slice(2, 8);
export const NEW_EL = {
  text: () => ({ id: xid(), k: 'text', t: 'Yeni yazı', c: '#ffffff', fw: 700, d: { x: 50, y: 50, fs: 40 } }),
  desc: () => ({ id: xid(), k: 'text', t: 'İkinci açıklama', c: '#ffffff', fw: 500, op: 0.9, al: 'left', d: { x: 30, y: 78, fs: 20 } }),
  label: () => ({ id: xid(), k: 'text', t: '%20 İNDİRİM', c: '#ffffff', fw: 900, bs: 'pill', bg: '#ef4444', pad: 0.4, ls: 0.04, d: { x: 72, y: 22, fs: 26, r: -6 } }),
  badge: () => ({ id: xid(), k: 'text', t: 'YENİ', c: '#1a1205', fw: 900, bs: 'burst', bg: '#facc15', pad: 0.9, f: 'archivo', d: { x: 82, y: 24, fs: 24, r: 12 } }),
  shape: (sh) => ({ id: xid(), k: 'shape', sh, fill: ['line', 'arrow', 'curve', 'wave', 'check'].includes(sh) ? '' : '#ffffff', sc: ['line', 'arrow', 'curve', 'wave', 'check'].includes(sh) ? '#ffffff' : '', sw: 4, op: ['rect', 'round', 'pill', 'circle'].includes(sh) ? 0.9 : 1, ar: SHAPE_BY[sh]?.ar || 1, d: { x: 50, y: 50, w: ['line', 'arrow', 'wave'].includes(sh) ? 26 : 12 } }),
};
const ShapeIc = ({ sh }) => <span className={'sx-ic sxi-' + sh} aria-hidden="true">{['rect', 'round', 'pill', 'circle'].includes(sh) ? <i /> : <ShapeSvg sh={sh} fill={['line', 'arrow', 'curve', 'wave', 'check'].includes(sh) ? '' : 'currentColor'} stroke={['line', 'arrow', 'curve', 'wave', 'check'].includes(sh) ? 'currentColor' : ''} sw={2} />}</span>;

export function XelBar({ s, add, pen, setPen, select, selId }) {
  const [open, setOpen] = useState(false);
  const els = s.els || [];
  return <div className="sxbar" data-f="els">
    <span className="field-l">Yazı ve çizim <small className="opt">(Paint gibi: serbest yazı, şekil, kalem)</small></span>
    <div className="sxbar-row">
      <button type="button" className="sxb" onClick={() => add(NEW_EL.text())}><b className="sxb-aa">Aa</b><small>Yazı</small></button>
      <button type="button" className="sxb" onClick={() => add(NEW_EL.desc())}><b className="sxb-aa sm">≡</b><small>2. açıklama</small></button>
      <button type="button" className="sxb" onClick={() => add(NEW_EL.label())}><b className="sxb-tag">%20</b><small>Etiket</small></button>
      <button type="button" className="sxb" onClick={() => add(NEW_EL.badge())}><b className="sxb-burst">YENİ</b><small>Rozet</small></button>
      <button type="button" className={'sxb' + (open ? ' on' : '')} onClick={() => setOpen(!open)} aria-expanded={open}><ShapeIc sh="star" /><small>Şekiller</small></button>
      <button type="button" className={'sxb' + (pen.on ? ' on' : '')} onClick={() => setPen({ ...pen, on: !pen.on })} title="Kalem: reklamın üstünde basılı tutup çizin (Esc ile bırakın)"><Icon n="brush" s={18} /><small>Kalem</small></button>
    </div>
    {open && <div className="sxshapes">{SHAPES.map((x) => <button key={x.id} type="button" className="sxs" title={x.n} onClick={() => { add(NEW_EL.shape(x.id)); }}><ShapeIc sh={x.id} /><small>{x.n}</small></button>)}</div>}
    {pen.on && <div className="sxpen">
      <span>Kalem açık: reklamın üstünde basılı tutup çizin.</span>
      <label className="she-color"><input type="color" value={pen.c} onChange={(e) => setPen({ ...pen, c: e.target.value })} aria-label="Kalem rengi" /></label>
      <span className="seg seg-mini">{[[2, 'İnce'], [5, 'Orta'], [10, 'Kalın']].map(([w, l]) => <button key={w} type="button" className={pen.w === w ? 'on' : ''} onClick={() => setPen({ ...pen, w })}>{l}</button>)}</span>
      <button type="button" className="btn sm" onClick={() => setPen({ ...pen, on: false })}>Bitti</button>
    </div>}
    {els.length > 0 && <div className="sxlist">{els.map((e, i) => <button key={e.id} type="button" className={'sxli' + (selId === e.id ? ' on' : '')} onClick={() => select(e.id)}>
      {e.k === 'text' ? <b className="sxli-t" style={{ fontFamily: famCss(FONT_BY[e.f || '']) }}>{(e.t || 'Yazı').slice(0, 24)}</b> : e.k === 'draw' ? <><Icon n="brush" s={14} /><span>Çizim</span></> : <><ShapeIc sh={e.sh} /><span>{SHAPE_BY[e.sh]?.n}</span></>}
      <small>{i + 1}</small></button>)}</div>}
  </div>;
}

// açılır kapanır küçük bölüm (seçili değer başlıkta görünür)
export function Disclose({ label, value, children, defOpen = false }) {
  const [o, setO] = useState(defOpen);
  return <div className={'disc' + (o ? ' open' : '')}>
    <button type="button" className="disc-h" onClick={() => setO(!o)} aria-expanded={o}><span className="field-l">{label}</span>{value != null && <span className="disc-v">{value}</span>}<Icon n="chev" s={16} className="fold-chev" /></button>
    {o && <div className="disc-b">{children}</div>}
  </div>;
}

export function FontPick({ v, onChange }) {
  useEffect(() => { ensureFonts(document, FONTS.map((f) => f.id)); }, []);
  const groups = [...new Set(FONTS.map((f) => f.g))];
  const cur = FONT_BY[v || ''] || FONTS[0];
  return <Disclose label="Yazı tipi" value={<b style={{ fontFamily: famCss(cur) }}>{cur.n}</b>}>
    {groups.map((g) => <div key={g} className="fpk-g"><small>{g}</small><div className="fpk">{FONTS.filter((f) => f.g === g).map((f) => (
      <button key={f.id} type="button" className={'fpk-it' + ((v || '') === f.id ? ' on' : '')} style={{ fontFamily: famCss(f) }} onClick={() => onChange(f.id)}>{f.id ? 'Çağrı Şükrü İğne' : 'Varsayılan'}<small>{f.n}</small></button>
    ))}</div></div>)}
  </Disclose>;
}

const Range = ({ label, v, min, max, step = 1, onChange, unit = '', fmt }) => <Field label={label}><span className="she-scale"><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} /><code>{fmt ? fmt(v) : v + unit}</code></span></Field>;
const Col = ({ label, v, onChange, clear }) => <span className="dz2-bcol"><small>{label}</small><span className="she-color"><input type="color" value={/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#ffffff'} onChange={(e) => onChange(e.target.value)} aria-label={label} />{clear && (v ? <button type="button" className="linkish" onClick={() => onChange('')}>yok</button> : <code>yok</code>)}</span></span>;

// seçili serbest öğenin paneli. dev: '' bilgisayar · 'm' telefon (telefonda ayrı yer/boyut)
export function XelPanel({ el, upd, remove, dup, order, dev, setDev }) {
  const g = el.d || {}; const m = el.m || {};
  const G = dev === 'm' ? { x: m.x ?? g.x, y: m.y ?? g.y, w: m.w ?? g.w, r: m.r ?? g.r ?? 0, fs: m.fs ?? Math.max(12, Math.round((g.fs || 36) * 0.55)) } : g;
  const upG = (p) => upd(dev === 'm' ? { m: { ...m, ...p } } : { d: { ...g, ...p } });
  const isLine = ['line', 'arrow', 'curve', 'wave', 'check'].includes(el.sh) || el.k === 'draw';
  return <div className="sxp">
    <div className="dz2-fxdev">
      <span className="seg">{[['', 'monitor', 'Bilgisayar'], ['m', 'mobile', 'Telefon']].map(([k, ic, l]) => <button key={k} type="button" className={dev === k ? 'on' : ''} onClick={() => setDev(k)}><Icon n={ic} s={14} />{l}</button>)}</span>
      <small>{dev === 'm' ? (el.m ? 'Telefonda kendi yeri ve boyutu var.' : 'Telefonda bilgisayardaki yer kullanılıyor; telefon görünümünde sürüklerseniz telefona özel olur.') : 'Bilgisayardaki yer ve boyut.'}</small>
      {dev === 'm' && el.m && <button type="button" className="linkish" onClick={() => upd({ m: undefined })}>Telefondaki ayarı sil</button>}
    </div>
    {el.k === 'text' && <>
      <div data-f="xt"><Field label="Yazı"><textarea rows={2} value={el.t || ''} onChange={(e) => upd({ t: e.target.value })} autoFocus /></Field></div>
      <FontPick v={el.f} onChange={(f) => upd({ f })} />
      <Range label="Yazı boyu" v={G.fs || 36} min={8} max={dev === 'm' ? 90 : 160} onChange={(fs) => upG({ fs })} unit=" px" />
      <Field label="Kalınlık ve biçim"><span className="sxp-fmt">
        <span className="seg seg-mini">{[[400, 'Normal'], [700, 'Kalın'], [900, 'Çok kalın']].map(([w, l]) => <button key={w} type="button" className={(el.fw || 700) === w ? 'on' : ''} onClick={() => upd({ fw: w })}>{l}</button>)}</span>
        <button type="button" className={'sxp-tg' + (el.it ? ' on' : '')} onClick={() => upd({ it: !el.it })} title="Eğik"><i>E</i></button>
        <button type="button" className={'sxp-tg' + (el.up ? ' on' : '')} onClick={() => upd({ up: !el.up })} title="BÜYÜK HARF">AA</button>
        <span className="seg seg-mini">{[['left', 'Sol'], ['center', 'Orta'], ['right', 'Sağ']].map(([a, l]) => <button key={a} type="button" className={(el.al || 'center') === a ? 'on' : ''} onClick={() => upd({ al: a })}>{l}</button>)}</span>
      </span></Field>
      <ColorPick v={el.c || '#ffffff'} onChange={(c) => upd({ c: c || '#ffffff' })} label="Yazı rengi" grads={false} />
      <Field label="Arka plan"><span className="sxp-bgs">{TEXT_BG.map(([k, l]) => <button key={k} type="button" className={'sxp-bg sbp-' + k + ((el.bs || 'none') === k ? ' on' : '')} onClick={() => upd({ bs: k, bg: el.bg || '#ef4444' })}><i aria-hidden="true">Aa</i><small>{l}</small></button>)}</span></Field>
      {el.bs && el.bs !== 'none' && <div className="sxp-row">
        <Col label="Arka plan rengi" v={el.bg} onChange={(bg) => upd({ bg })} />
        <Range label="Saydamlık" v={Math.round((el.bo ?? 1) * 100)} min={10} max={100} onChange={(x) => upd({ bo: x / 100 })} unit="%" />
        <Range label="İç boşluk" v={Math.round((el.pad ?? 0.35) * 100)} min={0} max={150} onChange={(x) => upd({ pad: x / 100 })} fmt={(x) => x / 100 + ' em'} />
      </div>}
      <Disclose label="Gölge, kontur, aralık">
        <Field label="Gölge"><span className="seg seg-mini seg-wrap">{[['', 'Yok'], ['soft', 'Yumuşak'], ['hard', 'Sert'], ['long', 'Uzun'], ['glow', 'Parlama']].map(([k, l]) => <button key={k} type="button" className={(el.sh || '') === k ? 'on' : ''} onClick={() => upd({ sh: k })}>{l}</button>)}</span></Field>
        <div className="sxp-row"><Col label="Kontur rengi" v={el.st} onChange={(st) => upd({ st, sw: el.sw || 2 })} /><Range label="Kontur kalınlığı" v={el.sw || 0} min={0} max={8} onChange={(sw) => upd({ sw })} /></div>
        <Range label="Harf aralığı" v={Math.round((el.ls || 0) * 100)} min={-5} max={40} onChange={(x) => upd({ ls: x / 100 })} fmt={(x) => x / 100 + ' em'} />
        <Range label="Satır aralığı" v={Math.round((el.lh || 1.15) * 100)} min={80} max={200} onChange={(x) => upd({ lh: x / 100 })} fmt={(x) => x / 100} />
        <Toggle2 label="Kutuya gölge" v={!!el.bx} onChange={(bx) => upd({ bx })} />
      </Disclose>
    </>}
    {el.k === 'shape' && <>
      <Disclose label="Şekil" value={SHAPE_BY[el.sh]?.n}><div className="sxshapes in">{SHAPES.map((x) => <button key={x.id} type="button" className={'sxs' + (el.sh === x.id ? ' on' : '')} onClick={() => upd({ sh: x.id, ar: x.ar })}><ShapeIc sh={x.id} /><small>{x.n}</small></button>)}</div></Disclose>
      <div className="sxp-row">{!isLine && <Col label="Dolgu" v={el.fill} onChange={(fill) => upd({ fill })} clear />}<Col label={isLine ? 'Renk' : 'Çerçeve'} v={el.sc} onChange={(sc) => upd({ sc })} clear={!isLine} /></div>
      {(isLine || el.sc) && <Range label={isLine ? 'Kalınlık' : 'Çerçeve kalınlığı'} v={el.sw || 3} min={1} max={24} onChange={(sw) => upd({ sw })} unit=" px" />}
      <Range label="En / boy oranı" v={Math.round((el.ar || 1) * 100) / 100} min={0.2} max={14} step={0.05} onChange={(ar) => upd({ ar })} fmt={(x) => x.toFixed(2)} />
    </>}
    {el.k === 'draw' && <div className="sxp-row"><Col label="Renk" v={el.sc} onChange={(sc) => upd({ sc })} /><Range label="Kalınlık" v={el.sw || 4} min={1} max={24} onChange={(sw) => upd({ sw })} unit=" px" /></div>}
    {el.k !== 'text' && <Range label={'Genişlik' + (dev === 'm' ? ' · telefon' : '')} v={Math.round((G.w || 12) * 10) / 10} min={1} max={120} step={0.5} onChange={(w) => upG({ w })} fmt={(x) => '%' + x} />}
    {el.k === 'text' && <Range label={'Yazı alanı genişliği' + (dev === 'm' ? ' · telefon' : '')} v={G.w || 0} min={0} max={100} onChange={(w) => upG({ w: w || undefined })} fmt={(x) => (x ? '%' + x : 'otomatik')} />}
    <Range label="Saydamlık" v={Math.round((el.op ?? 1) * 100)} min={5} max={100} onChange={(x) => upd({ op: x / 100 })} unit="%" />
    <Disclose label={'Konum ve döndürme · ' + (dev === 'm' ? 'telefon' : 'bilgisayar')}>
      <Range label="Soldan" v={Math.round((G.x ?? 50) * 10) / 10} min={-10} max={110} step={0.5} onChange={(x) => upG({ x })} fmt={(x) => '%' + x} />
      <Range label="Üstten" v={Math.round((G.y ?? 50) * 10) / 10} min={-10} max={110} step={0.5} onChange={(y) => upG({ y })} fmt={(x) => '%' + x} />
      <Range label="Döndür" v={G.r || 0} min={-180} max={180} onChange={(r) => upG({ r })} unit="°" />
    </Disclose>
    <p className="fine">Sayfada tutup sürükleyin: diğer öğelerin kenarlarına ve ortaya yapışır (Alt = serbest). Köşedeki tutamaçla büyütün. Del siler, Ctrl D çoğaltır.</p>
    <div className="dz2-acts">
      <button className="btn sm ghost" onClick={() => order(1)}><Icon n="up" s={15} />Öne getir</button>
      <button className="btn sm ghost" onClick={() => order(-1)}><Icon n="down" s={15} />Arkaya gönder</button>
      <button className="btn sm ghost" onClick={dup}><Icon n="copy" s={15} />Çoğalt</button>
      <button className="btn sm ghost danger" onClick={remove}><Icon n="trash" s={15} />Sil</button>
    </div>
  </div>;
}
const Toggle2 = ({ label, v, onChange }) => <label className="sxp-ck"><input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;

// kalem çizimi: noktalar (reklam kutusuna göre px) → kendi kutusuna göre 0-100 + yer / genişlik / oran
export function drawToEl(pts, R, color, width) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const bw = Math.max(4, x1 - x0), bh = Math.max(4, y1 - y0);
  const norm = pts.map(([x, y]) => (((x - x0) / bw) * 100).toFixed(1) + ',' + (((y - y0) / bh) * 100).toFixed(1)).join(' ');
  return { id: xid(), k: 'draw', pts: norm, sc: color, sw: width, ar: Math.round((bw / bh) * 1000) / 1000,
    d: { x: Math.round(((x0 + bw / 2) / R.width) * 10000) / 100, y: Math.round(((y0 + bh / 2) / R.height) * 10000) / 100, w: Math.round((bw / R.width) * 10000) / 100 } };
}
export const useElsMemo = (s) => useMemo(() => s.els || [], [s.els]);
