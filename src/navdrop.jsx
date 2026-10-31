// Bilgisayarda üst menü açılır menüleri (31.10.2026): fare başlıkta durunca açılır (ayarlar: aşağıdaki MENU), çıkınca 0,4 sn bekleyip kapanır;
// başlığa tıklamak yine o sayfaya gider, küçük oka tıklamak menüyü açar/kapatır. Telefonda / dokunmatikte hiç çizilmez (alt menü aynı kalır).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, go, store, openAcct, toast } from './store.js';
import { Icon } from './ui.jsx';
import { ls } from './utils.js';
import { useTree, useVisibleProducts } from './catalog.jsx';
import { liveSets } from './sets.jsx';

const MQ = '(hover: hover) and (pointer: fine) and (min-width: 900px)';
function useDesk() {
  const [on, setOn] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(MQ).matches);
  useEffect(() => { const m = matchMedia(MQ); const f = () => setOn(m.matches); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f); }, []);
  return on;
}

const DELAY = 380; // fare durunca açılma gecikmesi (ms) — eski davranış (MENU.niyet kapalıyken)

// ★ Açılır menü ayarları (31.10.2026). Bir özelliği KALDIRMAK için o satırı false yap — eski davranışa döner.
export const MENU = {
  niyet: true,  // 1) Fare başlıkta gerçekten DURUNCA açılır (üstünden geçerken açılmaz); durunca eskisinden hızlı açılır
  ok: true,     // 2) Başlıktaki küçük ok (˅) tıklanınca sadece menüyü açar/kapatır; yazıya tıklamak yine sayfaya gider. Dışarı tıklayınca kapanır
  nisan: true,  // 3) Alt kategorilere çapraz giderken yoldaki başlık değişmez; düz gezerken başlık anında değişir
};
const DUR = 170;  // niyet: fare bu kadar ms (neredeyse) kıpırdamazsa menü açılır
const TITRE = 6;  // niyet: bu kadar px'ten az kıpırdama "durdu" sayılır
let active = null; // açık olan menü { id, close } (bir menüden diğerine geçince beklemeden geçsin)

export function HoverDrop({ children, panel, align = 'left', cls = '' }) {
  const desk = useDesk();
  const [open, setOpen] = useState(false);
  const t = useRef(0); const anc = useRef(null); const mute = useRef(false); // ok ile kapatınca fare çıkana kadar kendiliğinden açılmasın
  const me = useRef(null); const myId = useRef({}); // kimlik çizimden çizime değişmez (eski hâlde her yeniden çizimde menü kendini kapatıyordu)
  const tab = useStore((s) => s.tab);
  const acct = useStore((s) => s.acct);
  const wrap = useRef(null), pane = useRef(null);
  const close = () => { clearTimeout(t.current); setOpen(false); if (active?.id === myId.current) active = null; };
  // panel gövdeye (portal) çizilir: yönetim menüsü taşmayı gizlediği için içinde kırpılıyordu; yeri düğmeden ölçülür
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = wrap.current?.getBoundingClientRect(), el = pane.current; if (!b || !el) return;
      const w = el.offsetWidth, vw = document.documentElement.clientWidth;
      let x = align === 'right' ? b.right - w : b.left - (cls.includes('hd-mega') ? 40 : 6);
      x = Math.max(16, Math.min(x, vw - w - 16));
      el.style.left = x + 'px'; el.style.top = Math.round(b.bottom + 10) + 'px';
    };
    place(); addEventListener('resize', place); addEventListener('scroll', place, true);
    return () => { removeEventListener('resize', place); removeEventListener('scroll', place, true); };
  }, [open]);
  me.current = close;
  useEffect(() => { close(); }, [tab, acct]);
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [open]);
  useEffect(() => {
    if (!open || !MENU.ok) return;
    const d = (e) => { if (!wrap.current?.contains(e.target) && !pane.current?.contains(e.target)) close(); };
    addEventListener('pointerdown', d, true); return () => removeEventListener('pointerdown', d, true);
  }, [open]);
  useEffect(() => () => clearTimeout(t.current), []);
  if (!desk) return children;
  const show = () => { clearTimeout(t.current); if (active && active.id !== myId.current) active.close(); active = { id: myId.current, close: () => me.current() }; setOpen(true); };
  const enter = (e) => {
    clearTimeout(t.current);
    if (open || mute.current) return;
    if (active && active.id !== myId.current) { show(); return; } // başka menü açıkken yandakine geçiş: beklemeden
    if (MENU.niyet && e) { anc.current = { x: e.clientX, y: e.clientY }; t.current = setTimeout(show, DUR); return; }
    t.current = setTimeout(show, DELAY);
  };
  // niyet: fare belirgin kıpırdadıkça sayaç baştan başlar → sadece durunca açılır
  const move = (e) => {
    if (open || !MENU.niyet || mute.current) return;
    const a = anc.current;
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) < TITRE) return;
    anc.current = { x: e.clientX, y: e.clientY }; clearTimeout(t.current); t.current = setTimeout(show, DUR);
  };
  const leave = () => { clearTimeout(t.current); mute.current = false; if (open) t.current = setTimeout(close, 400); };
  // ok: oka tıklamak sayfaya gitmez, menüyü açar/kapatır
  const click = (e) => {
    clearTimeout(t.current);
    if (MENU.ok && e.target.closest?.('.topnav-chev')) { e.preventDefault(); e.stopPropagation(); if (open) { mute.current = true; close(); } else { mute.current = false; show(); } }
  };
  return (
    <div ref={wrap} className={'hd' + (open ? ' open' : '') + (MENU.ok ? ' hd-chev' : '') + (cls ? ' ' + cls : '')} onMouseEnter={enter} onMouseMove={move} onMouseLeave={leave} onClickCapture={click}>
      {children}
      {open && createPortal(<div ref={pane} className={'hd-p ' + align + (cls ? ' ' + cls + '-p' : '')} role="menu" onMouseEnter={enter} onMouseLeave={leave}>{panel(close)}</div>, document.body)}
    </div>
  );
}

const Item = ({ icon, label, sub, pill, tone, danger, onClick, close }) => (
  <button type="button" role="menuitem" className={'hd-i' + (danger ? ' danger' : '')} onClick={() => { close(); onClick(); }}>
    {icon && <span className="hd-ic"><Icon n={icon} s={17} /></span>}
    <span className="hd-t"><b>{label}</b>{sub && <small>{sub}</small>}</span>
    {pill ? <span className={'hd-pill' + (tone ? ' ' + tone : '')}>{pill}</span> : null}
  </button>
);

// ---- Yönetim ----
const custKind = (k) => { ls.set('cust-kind', k); store.set({ custKind: k }); go('musteriler'); };
export function AdminDrop({ k, children }) {
  const s = useStore();
  if (k === 'siparisler') {
    const n = s.orders.filter((o) => o.unread).length;
    const lc = (s.lcarts || []).filter((c) => c.status === 'sent' && !c.seen).length;
    const bayi = s.requests.filter((r) => r.type === 'order' && r.status === 'new').length;
    return <HoverDrop panel={(c) => (<>
      <Item close={c} icon="box" label="Mağaza siparişleri" sub="Online mağazadan gelenler" pill={n ? n + ' yeni' : ''} tone="red" onClick={() => go('siparisler')} />
      <Item close={c} icon="share" label="Linkle gelen siparişler" sub="Gönderdiğiniz sepet linkleri" pill={lc ? lc + ' onaylandı' : ''} onClick={() => go('sepetler')} />
      <Item close={c} icon="chat" label="Bayi siparişleri" sub="Bayilerin sepet onayları" pill={bayi ? bayi + ' onay bekliyor' : ''} tone="red" onClick={() => go('talepler')} />
    </>)}>{children}</HoverDrop>;
  }
  if (k === 'siparis') return <HoverDrop panel={(c) => (<>
    <Item close={c} icon="tag" label="Sipariş formu" sub="Liste resmi + fiyatlı link" onClick={() => go('siparis')} />
    <Item close={c} icon="cart" label="Sepet linki" sub="Müşteri tek tıkla onaylar" onClick={() => go('sepetlink')} />
    <Item close={c} icon="box" label="Setler" sub="Ürün paketleri oluşturun" onClick={() => go('setler')} />
  </>)}>{children}</HoverDrop>;
  if (k === 'musteriler') {
    const pend = s.customers.filter((u) => u.pending).length;
    const pq = (s.preqs || []).filter((q) => q.seenAdmin === false).length;
    const is = (s.issues || []).filter((q) => q.seenAdmin === false).length;
    const rv = (s.reviews || []).filter((r) => r.status === 'pending').length;
    return <HoverDrop panel={(c) => (<>
      <Item close={c} icon="users" label="Bayiler" sub="Kademe, özel fiyat, başvurular" pill={pend ? pend + ' başvuru' : ''} tone="red" onClick={() => custKind('bayi')} />
      <Item close={c} icon="user" label="Mağaza müşterileri" sub="Üyeler ve siparişleri" onClick={() => custKind('magaza')} />
      <Item close={c} icon="camera" label="Ürün talepleri" sub="Fotoğraflı ürün istekleri" pill={pq ? pq + ' yeni' : ''} tone="red" onClick={() => custKind('talep')} />
      <Item close={c} icon="ask" label="Sorun bildirimleri" sub="Arıza / iade talepleri" pill={is ? is + ' yeni' : ''} tone="red" onClick={() => custKind('sorun')} />
      <Item close={c} icon="star" label="Yorumlar" sub="Onay bekleyen yorumlar" pill={rv ? String(rv) : ''} onClick={() => custKind('yorum')} />
    </>)}>{children}</HoverDrop>;
  }
  return children;
}

// ---- Mağaza: Ürünler ▾ ----
export function ProductsDrop({ children }) {
  const tree = useTree();
  const vis = useVisibleProducts(false);
  const S = useStore((s) => s.settings);
  const hasSets = useStore((s) => liveSets(s.settings).length > 0);
  const cats = useMemo(() => {
    const cnt = new Map();
    for (const p of vis) for (const c of new Set([p.c, p.c2].filter((x) => x != null).flatMap((x) => tree.ancestors(x)))) cnt.set(c, (cnt.get(c) || 0) + 1);
    return tree.roots.filter((n) => !n.hidden && cnt.get(n.id)).map((n) => ({ n, subs: n.children.filter((x) => !x.hidden && cnt.get(x.id)) }));
  }, [vis, tree]);
  return <HoverDrop cls="hd-mega" panel={(c) => (
    <div className="hd-mega-in">
      <div className="hd-side">
        <Item close={c} icon="grid" label="Tüm ürünler" onClick={() => { store.set({ catalogGo: {} }); go('katalog'); }} />
        {hasSets && <Item close={c} icon="box" label="Setler" pill="Yeni" tone="green" onClick={() => { store.set({ catalogGo: { sets: true } }); go('katalog'); }} />}
        <Item close={c} icon="heart" label="Favorilerim" onClick={() => { store.set({ catalogGo: { fav: true } }); go('katalog'); }} />
      </div>
      <MegaCats cats={cats} close={c} />
    </div>
  )}>{children}</HoverDrop>;
}

// büyük başlıklar tek sütun (kaydırma yok); üstüne gelince alt başlıklar yanda açılır
function MegaCats({ cats, close }) {
  const [hov, setHov] = useState(null); const [top, setTop] = useState(0);
  const t = useRef(0); const fly = useRef(null);
  const pts = useRef([]); const held = useRef(null); // nişan: farenin son konumları
  useEffect(() => () => clearTimeout(t.current), []);
  // nişan (Amazon menüsündeki yöntem): fare açık alt listeye doğru gidiyorsa (son konumdan alt listenin sol üst ve sol alt
  // köşesine çizilen üçgenin içindeyse) yoldaki başlıklar değişmez; fare durursa ya da başka yöne giderse hemen değişir
  const aim = () => {
    const el = fly.current, p = pts.current; if (!el || p.length < 2) return 0;
    const cur = p[p.length - 1], prev = p[0];
    if (held.current && held.current.x === cur.x && held.current.y === cur.y) return 0; // fare durdu
    const r = el.getBoundingClientRect(); if (cur.x >= r.left) return 0;
    const up = { x: r.left, y: r.top - 60 }, dn = { x: r.left, y: r.bottom + 80 };
    const sl = (a, b) => (b.y - a.y) / (b.x - a.x || 0.001);
    if (sl(cur, up) < sl(prev, up) && sl(cur, dn) > sl(prev, dn)) { held.current = cur; return 160; }
    return 0;
  };
  const enter = (n, el) => {
    clearTimeout(t.current); const y = el.offsetTop; const go1 = () => { setHov(n.id); setTop(y); };
    if (!MENU.nisan) { t.current = setTimeout(go1, hov == null ? DELAY : 220); return; } // eski: sabit gecikme
    if (hov == null) { t.current = setTimeout(go1, 140); return; } // ilk açılış: üstten inerken satırlar yanıp sönmesin
    const tryGo = () => { const d = aim(); if (d) t.current = setTimeout(tryGo, d); else go1(); };
    tryGo();
  };
  const track = (e) => { if (!MENU.nisan) return; const p = pts.current; p.push({ x: e.clientX, y: e.clientY }); if (p.length > 3) p.shift(); };
  const pick = (id) => { clearTimeout(t.current); close(); store.set({ catalogGo: { cat: id } }); go('katalog'); };
  const cur = cats.find((x) => x.n.id === hov);
  // ekrandan taşmasın: alt kenar ekranın altını geçiyorsa yukarı kaydır
  useLayoutEffect(() => {
    const el = fly.current; if (!el) return;
    el.style.top = Math.max(0, top - 9) + 'px';
    const r = el.getBoundingClientRect(); const over = r.bottom - (innerHeight - 12);
    if (over > 0) el.style.top = Math.max(-(r.top - 12 - Math.max(0, top - 9)), Math.max(0, top - 9) - over) + 'px';
  }, [hov, top]);
  return (
    <div className="hd-cats" onMouseMove={track} onMouseLeave={() => clearTimeout(t.current)}>
      {cats.map(({ n, subs }) => (
        <button key={n.id} type="button" className={'hd-ct' + (hov === n.id ? ' on' : '')} onMouseEnter={(e) => enter(n, e.currentTarget)} onMouseLeave={() => clearTimeout(t.current)} onFocus={(e) => { setHov(n.id); setTop(e.currentTarget.offsetTop); }} onClick={() => pick(n.id)}>
          <span>{n.name}</span>{subs.length > 0 && <Icon n="back" s={14} className="flip" />}
        </button>
      ))}
      {cur && cur.subs.length > 0 && (
        <div ref={fly} key={cur.n.id} className={'hd-fly' + (cur.subs.length > 9 ? ' two' : '')} onMouseEnter={() => clearTimeout(t.current)}>
          <div className="hd-fly-l">{cur.subs.map((x) => <button key={x.id} type="button" className="hd-cs" onClick={() => pick(x.id)}>{x.name}</button>)}</div>
        </div>
      )}
    </div>
  );
}

// ---- Mağaza: profil (üye) ----
export function ProfileDrop({ children }) {
  const { member, api: A } = useStore();
  const myOrders = useStore((s) => s.myOrders || []);
  const waitN = (member?.notify || []).length;
  const open = myOrders.filter((o) => !['done', 'cancelled'].includes(o.status)).length;
  if (!member) return children;
  const a = (v) => () => openAcct(v);
  return <HoverDrop align="right" cls="hd-prof" panel={(c) => (<>
    <div className="hd-who"><b>{member.name || 'Hesabım'}</b><small>{member.email}</small></div>
    <Item close={c} icon="box" label="Siparişlerim" pill={open ? open + ' devam eden' : ''} onClick={a('orders')} />
    <Item close={c} icon="pin" label="Adreslerim" onClick={a('addr')} />
    <Item close={c} icon="heart" label="Favorilerim" onClick={a('favs')} />
    <Item close={c} icon="bell" label="Haber beklenenler" pill={waitN ? String(waitN) : ''} onClick={a('wait')} />
    <Item close={c} icon="tag" label="Fatura bilgilerim" onClick={a('inv')} />
    <Item close={c} icon="user" label="Profil ve şifre" onClick={a('info')} />
    <i className="hd-sep" />
    <Item close={c} icon="out" label="Çıkış yap" danger onClick={() => A.memberLogout().then(() => { openAcct(null); toast('Çıkış yapıldı'); })} />
  </>)}>{children}</HoverDrop>;
}
