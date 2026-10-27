// Ürünü düzenle > Resimler ve videolar: tek sıra (ilki kapak resmi), tutup sürükleyerek sıralama (yerini değiştiren
// kutular kısa bir kayma animasyonuyla yerine geçer), + ile bilgisayardan / telefondan resim + video, depodan seçme,
// adres yapıştırma. Öğeler: site dosya adı, 'r2:<anahtar>' (depo), tam adres; video 'v:<adres>'.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, toast } from './store.js';
import { Icon, Sheet, openMenu } from './ui.jsx';
import { picUrl, isVid, imageBlob, fileHash } from './utils.js';
import { mediaUrl } from './catalog.jsx';

const VID_RE = /\.(mp4|webm|mov)(\?|#|$)/i;
const kindOf = (x) => { const r = isVid(x) ? x.slice(2) : x; return r.startsWith('r2:') ? 'Depo' : /^(data|blob):/.test(r) ? 'Cihaz' : /^(https?:)?\/\//.test(r) ? 'Adres' : 'Site'; };
// kapak (ilk sıra) resim olmalı: video öne geldiyse ilk resim öne alınır
function coverFirst(arr) {
  if (!arr.length || !isVid(arr[0])) return arr;
  const i = arr.findIndex((x) => !isVid(x)); if (i < 0) return arr;
  const a = [...arr]; const [m] = a.splice(i, 1); a.unshift(m); return a;
}
const fmtMB = (b) => (b >= 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');

function Tile({ x, i, S, onRemove, onCover, refCb, onDown, dragging }) {
  const vid = isVid(x); const raw = vid ? x.slice(2) : x;
  return (
    <div ref={refCb} className={'md-t' + (i === 0 ? ' cover' : '') + (vid ? ' vid' : '') + (dragging ? ' drag' : '')} onPointerDown={onDown} title={raw}>
      {vid ? <video src={mediaUrl(raw) + '#t=1'} muted playsInline preload="metadata" draggable={false} />
        : <img src={picUrl(raw, S.catalog.imageThumb, false) || ''} alt="" draggable={false} loading="lazy" />}
      {vid && <span className="md-play"><Icon n="play" s={16} /></span>}
      {i === 0 ? <span className="md-cover">Kapak</span> : <span className="md-kind">{vid ? 'Video' : kindOf(x)}</span>}
      <span className="md-tools">
        {i > 0 && !vid && <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onCover} title="Kapak resmi yap">Kapak yap</button>}
        <button type="button" className="md-x" onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} aria-label="Kaldır" title="Kaldır"><Icon n="x" s={13} /></button>
      </span>
    </div>
  );
}

export function MediaEditor({ list, onChange, S, openRef }) {
  const [ups, setUps] = useState([]); // yüklenenler: {id, name, p (0-1|null), v}
  const [depot, setDepot] = useState(false);
  const [url, setUrl] = useState('');
  const fileRef = useRef(null);
  const listRef = useRef(list); listRef.current = list;
  if (openRef) openRef.current = () => fileRef.current?.click();

  // ---- sıra değişince kayma animasyonu (FLIP)
  const els = useRef(new Map());
  const before = useRef(null);
  const snap = () => { const m = new Map(); els.current.forEach((el, k) => el && m.set(k, el.getBoundingClientRect())); before.current = m; };
  const [drag, setDrag] = useState(null); // {k, order}
  const dragRef = useRef(null);
  const items = drag ? drag.order : list;
  useLayoutEffect(() => {
    const m = before.current; before.current = null;
    if (m) els.current.forEach((el, k) => {
      if (!el || k === dragRef.current?.k) return; const a = m.get(k); if (!a) return; const b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    placeDrag();
  });
  const change = (arr) => { snap(); onChange(coverFirst(arr)); };

  // ---- sürükleme (fare: 5px hareketle başlar; dokunmatik: 280 ms basılı tutunca)
  function placeDrag() {
    const d = dragRef.current; if (!d) return; const el = els.current.get(d.k); if (!el) return;
    el.style.transform = 'none'; const r = el.getBoundingClientRect();
    el.style.transform = `translate(${d.px - d.gx - r.left}px, ${d.py - d.gy - r.top}px) scale(1.06)`;
  }
  const onDown = (k) => (e) => {
    if (e.button > 0) return;
    const el = els.current.get(k); if (!el) return;
    const r = el.getBoundingClientRect();
    const st = { k, x0: e.clientX, y0: e.clientY, gx: e.clientX - r.left, gy: e.clientY - r.top, px: e.clientX, py: e.clientY, on: false, id: e.pointerId, touch: e.pointerType !== 'mouse' };
    const begin = () => { st.on = true; st.order = [...listRef.current]; dragRef.current = st; try { el.setPointerCapture(st.id); } catch {} setDrag({ k, order: st.order }); navigator.vibrate?.(8); };
    let timer = st.touch ? setTimeout(begin, 280) : 0;
    const move = (ev) => {
      st.px = ev.clientX; st.py = ev.clientY;
      if (!st.on) {
        const dist = Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0);
        if (st.touch) { if (dist > 8) cleanup(); return; }
        if (dist > 5) begin(); else return;
      }
      // imlecin altındaki kutunun yerine geç
      let over = null;
      // yerleşim konumu (animasyondaki kaymayı saymadan): offsetLeft/Top ızgaraya göre
      const g = el.parentElement.getBoundingClientRect();
      els.current.forEach((t, kk) => { if (kk === k || !t) return; const L = g.left + t.offsetLeft, T = g.top + t.offsetTop; if (ev.clientX >= L && ev.clientX <= L + t.offsetWidth && ev.clientY >= T && ev.clientY <= T + t.offsetHeight) over = kk; });
      if (over != null) {
        const from = st.order.indexOf(k), to = st.order.indexOf(over);
        if (from >= 0 && to >= 0 && from !== to) { snap(); const o = [...st.order]; o.splice(from, 1); o.splice(to, 0, k); st.order = o; setDrag({ k, order: o }); return; }
      }
      placeDrag();
    };
    const tm = (ev) => { if (st.on && ev.cancelable) ev.preventDefault(); };
    const up = () => {
      const was = st.on; cleanup();
      if (!was) return;
      const el2 = els.current.get(k); const b0 = el2?.getBoundingClientRect();
      dragRef.current = null;
      if (el2) { el2.style.transform = ''; const b1 = el2.getBoundingClientRect(); el2.animate([{ transform: `translate(${b0.left - b1.left}px, ${b0.top - b1.top}px) scale(1.06)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' }); }
      const next = coverFirst(st.order); if (next[0] !== st.order[0]) toast('Kapak bir resim olmalı');
      setDrag(null); if (next.join('|') !== listRef.current.join('|')) { snap(); onChange(next); }
    };
    function cleanup() { clearTimeout(timer); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); removeEventListener('touchmove', tm); }
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up); addEventListener('touchmove', tm, { passive: false });
  };

  // ---- yükleme: aynı dosya depoda varsa yeniden yüklenmez (parmak izi)
  async function addFiles(files) {
    files = [...files].filter((f) => /^(image|video)\//.test(f.type));
    if (!files.length) return;
    for (const file of files) {
      const v = file.type.startsWith('video/'); const id = Math.random().toString(36).slice(2);
      if (v && file.size > 95e6) { toast(file.name + ': video 95 MB\'tan büyük olamaz', 'bad'); continue; }
      if (v && !/^video\/(mp4|webm|quicktime)$/.test(file.type)) { toast(file.name + ': sadece MP4, WebM ya da MOV', 'bad'); continue; }
      setUps((u) => [...u, { id, name: file.name, p: v ? 0 : null, v }]);
      try {
        const h = await fileHash(file);
        let ref = await api().findUpload?.(h);
        if (ref) toast('Bu dosya depoda zaten var, oradan eklendi');
        else if (v) ref = await api().uploadVideo(file, (p) => setUps((u) => u.map((x) => (x.id === id ? { ...x, p } : x))), h);
        else { const [big, th] = await Promise.all([imageBlob(file, 1600, 0.85), imageBlob(file, 420, 0.8)]); ref = await api().uploadImage(big, th, h); }
        add([v ? 'v:' + ref : ref]);
      } catch (err) { toast(file.name + ': ' + err.message, 'bad'); }
      setUps((u) => u.filter((x) => x.id !== id));
    }
  }
  const add = (refs) => {
    const cur = listRef.current; const fresh = refs.filter((r) => !cur.includes(r));
    if (fresh.length < refs.length) toast('Zaten listede olanlar eklenmedi');
    if (fresh.length) change([...cur, ...fresh]);
  };
  const addUrl = () => {
    const t = url.trim(); if (!t) return;
    const fileOf = (v) => v.split('?')[0].split('/').pop().replace(/^\d+X-/, '');
    const ref = /platincdn\.com\/3519\/pictures\//.test(t) || !/^(https?:)?\/\//.test(t) ? fileOf(t) : t;
    add([VID_RE.test(t) ? 'v:' + ref : ref]); setUrl('');
  };
  const busy = ups.length > 0;
  const addMenu = (e) => openMenu(e, [
    { label: 'Bilgisayardan / telefondan', icon: 'upload', hint: 'resim, video', onClick: () => fileRef.current?.click() },
    { label: 'Depodan seç', icon: 'box', hint: 'önceden yüklenenler', onClick: () => setDepot(true) },
  ], 'Resim / video ekle');

  return (
    <div className="md-ed" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
      <div className={'md-grid' + (drag ? ' dragging' : '')}>
        {items.map((x, i) => (
          <Tile key={x} x={x} i={i} S={S} dragging={drag?.k === x} refCb={(el) => (el ? els.current.set(x, el) : els.current.delete(x))}
            onDown={onDown(x)} onRemove={() => change(list.filter((y) => y !== x))} onCover={() => change([x, ...list.filter((y) => y !== x)])} />
        ))}
        {ups.map((u) => (
          <div key={u.id} className="md-t up"><span className="qs-spin" /><small>{u.p != null ? '%' + Math.round(u.p * 100) : 'Yükleniyor'}</small>{u.p != null && <i className="md-bar" style={{ width: Math.round(u.p * 100) + '%' }} />}</div>
        ))}
        <button type="button" className="md-t md-add" onClick={addMenu} aria-label="Resim ya da video ekle"><Icon n="plus" s={22} /><small>{list.length ? 'Ekle' : 'Resim / video ekle'}</small></button>
      </div>
      <p className="fine md-help">İlk sıradaki resim <b>kapak</b> resmidir. Kutuları tutup sürükleyerek sırayı değiştirin (telefonda basılı tutup sürükleyin); videolar da sıraya girer. Dosyaları buraya bırakabilirsiniz. {busy && <b>Yükleme sürüyor…</b>}</p>
      <div className="input-btn">
        <input placeholder="Resim / video adresi yapıştırın (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} />
        <button type="button" className="btn sm outline" disabled={!url.trim()} onClick={addUrl}>Ekle</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; addFiles(f); }} />
      {depot && <DepotPick have={list} onClose={() => setDepot(false)} onPick={(refs) => { setDepot(false); add(refs); }} />}
    </div>
  );
}
export const mediaBusy = () => false;

// Depodaki (Cloudflare) yüklenmiş resim ve videolardan seç: aynı resmi tekrar yükleyip depoyu şişirmemek için
function DepotPick({ have, onPick, onClose }) {
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [sel, setSel] = useState([]);
  const [err, setErr] = useState('');
  const [kind, setKind] = useState('all');
  const load = (c) => api().listUploads(c).then((r) => { setItems((x) => [...(c ? x || [] : []), ...r.items]); setCursor(r.cursor); }).catch((e) => setErr(e.message));
  useEffect(() => { load(null); }, []);
  const refOf = (it) => (it.v ? 'v:' + it.ref : it.ref);
  const shown = (items || []).filter((it) => kind === 'all' || (kind === 'v') === !!it.v);
  const tog = (r) => setSel((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  return (
    <Sheet wide title="Depodan seç" sub="Daha önce yüklediğiniz resim ve videolar" onClose={onClose} footer={<>
      <button className="btn ghost" onClick={onClose}>Vazgeç</button>
      <button className="btn primary" disabled={!sel.length} onClick={() => onPick(sel)}><Icon n="check" s={16} />{sel.length ? `${sel.length} öğeyi ekle` : 'Seçin'}</button>
    </>}>
      <div className="chips dp-chips">
        {[['all', 'Hepsi'], ['i', 'Resimler'], ['v', 'Videolar']].map(([k, l]) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {err ? <p className="fine bad">{err}</p> : !items ? <p className="fine">Yükleniyor…</p> : !shown.length ? <p className="fine">Depoda henüz {kind === 'v' ? 'video' : kind === 'i' ? 'resim' : 'dosya'} yok.</p> : (
        <div className="dp-grid">
          {shown.map((it) => {
            const r = refOf(it); const on = sel.includes(r); const had = have.includes(r);
            return (
              <button key={it.ref} type="button" className={'dp-t' + (on ? ' on' : '') + (had ? ' had' : '')} disabled={had} onClick={() => tog(r)} title={had ? 'Bu üründe zaten var' : ''}>
                {it.v ? <video src={mediaUrl(it.ref) + '#t=1'} muted playsInline preload="metadata" /> : <img src={picUrl(it.ref, null, false)} alt="" loading="lazy" />}
                {it.v && <span className="md-play"><Icon n="play" s={14} /></span>}
                <span className="dp-ck">{on ? <Icon n="check" s={13} /> : null}</span>
                <small>{had ? 'Üründe var' : new Date(it.t).toLocaleDateString('tr-TR') + (it.s ? ' · ' + fmtMB(it.s) : '')}</small>
              </button>
            );
          })}
        </div>
      )}
      {cursor && <button className="btn sm outline dp-more" onClick={() => load(cursor)}>Daha fazla göster</button>}
    </Sheet>
  );
}
