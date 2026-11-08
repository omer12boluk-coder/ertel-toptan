// Ana sayfa bölümü 'cd:film' — Tanıtım videosu (8.11.2026). Motor src/film.js, veri src/icerik/videolar.json.
// Ayar shopHome.cd.film { eye, title, ids: [sıra], off: [id], auto: false = kendiliğinden başlamasın, music: false = ses düğmesi yok, sound: 'off' = ses kapalı başlasın (varsayılan açık: ziyaretçinin ilk dokunuşunda girer) }.
// Birden çok açık video varsa sırayla oynar (biri bitince 4 sn sonra sıradaki). Tarif: claude/is/video-ekle.md
import { useEffect, useRef, useState } from 'react';
import { store, setQty, toast } from './store.js';
import { makeFilm } from './film.js';
import FILMS from './icerik/videolar.json';

export const FILM_LIST = FILMS.filter((f) => !f.off);
export const filmCfg = (H) => H?.cd?.film || {};
export function filmsOf(H) {
  const C = filmCfg(H); const ord = C.ids || [];
  const all = [...FILM_LIST].sort((a, b) => { const i = ord.indexOf(a.id), j = ord.indexOf(b.id); return (i < 0 ? 999 : i) - (j < 0 ? 999 : j); });
  return { all, on: all.filter((f) => !(C.off || []).includes(f.id)) };
}
// 'cd:film' kayıtlı sırada yoksa Claude düzeninde kendiliğinden 'Bu hafta masamızdan'ın altına girer (yeni bölüm herkes görsün diye)
export function withFilm(L) {
  if (!Array.isArray(L) || !L.includes('cd:hero') || L.includes('cd:film') || !FILM_LIST.length) return L;
  const after = ['cd:pick', 'p0:find', 'cd:new', 'cd:hero'].find((k) => L.includes(k)); const i = L.indexOf(after) + 1;
  return [...L.slice(0, i), 'cd:film', ...L.slice(i)];
}

export function CdFilm({ H, open, onProduct, edit }) {
  const C = filmCfg(H); const { on } = filmsOf(H);
  const [ix, setIx] = useState(0);
  const box = useRef(null);
  const F = on[ix % Math.max(1, on.length)];
  useEffect(() => {
    if (!F || !box.current) return;
    let tm = 0;
    const fm = makeFilm(box.current, F, {
      auto: !edit && C.auto !== false, music: C.music !== false, sound: !edit && C.music !== false && C.sound !== 'off',
      open: edit ? null : (a) => {
        const p = store.s.byId?.get(Number(F.p));
        if (a === 'c') { if (p && p.s > 0 && p.a !== 0 && !p.so) { setQty(p.id, (store.s.cart?.[p.id] || 0) + 1); toast?.('Sepete eklendi'); } else if (p) onProduct?.(p); return; }
        if (p) onProduct?.(p); else open?.('p:' + F.p)?.();
      },
      onEnd: on.length > 1 ? () => { tm = setTimeout(() => setIx((x) => x + 1), 4000); } : undefined,
    });
    if (ix > 0) fm.play();
    return () => { clearTimeout(tm); fm.destroy(); };
  }, [F?.id, edit, C.auto, C.music, C.sound]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!F) return null;
  return (
    <section className="cd-sec rv">
      <header className="cd-head"><div>{(C.eye ?? F.name) && <span className="cd-eye">{C.eye ?? F.name}</span>}<h2>{C.title || 'Yakından bak.'}</h2></div></header>
      <div ref={box} key={F.id} className="flm-box" />
    </section>
  );
}
