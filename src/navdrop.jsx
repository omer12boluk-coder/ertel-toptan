// Bilgisayarda üst menü açılır menüleri (31.10.2026): fare başlıkta durunca açılır (ayarlar: aşağıdaki MENU), çıkınca 0,4 sn bekleyip kapanır;
// başlığa tıklamak yine o sayfaya gider, küçük oka tıklamak menüyü açar/kapatır. Telefonda / dokunmatikte hiç çizilmez (alt menü aynı kalır).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, go, store, openAcct, toast, openProduct } from './store.js';
import { Icon, Thumb } from './ui.jsx';
import { ls, priceFor, fmt } from './utils.js';
import { feat } from './extras.jsx';
import { ShopImg } from './shophome.jsx';
import { useTree, useVisibleProducts, HUB_CUT, HUB_IMG } from './catalog.jsx';
import { liveSets, setView, openSet, SetCover } from './sets.jsx';
import { CAT_COVERS } from './cdhome.jsx';
import { loadPhones, mergePhones, searchPhones } from './kalipfind.jsx';
import { useBrandList, BrandTile, openBrand } from './brandsets.jsx';

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
  burada: true, // 4) Şu an açık olan sayfanın menüsü fareyle açılmaz (sayfada aynı seçenekler zaten var); ok ile ve başka menü açıkken yandakine geçişte açılır
};
const DUR = 110;  // niyet: fare bu kadar ms (neredeyse) kıpırdamazsa menü açılır
const TITRE = 6;  // niyet: bu kadar px'ten az kıpırdama "durdu" sayılır
let active = null; // açık olan menü { id, close } (bir menüden diğerine geçince beklemeden geçsin)
// 14.11.2026 v3 'kayan panel': bir menüden yandakine geçerken eski panelin yeri/boyu saklanır, yeni panel oradan kendi yerine kayar
let swapFrom = null; // { r: DOMRect, t: zaman }

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
      // 7.11.2026 geniş menü (look.navMenu 'wide'): üst menü kartının TAM genişliğinde, hemen altından açılır (hepsi aynı)
      if (cls.includes('hd-wide')) {
        const card = wrap.current?.closest('.topbar')?.querySelector('.topbar-in') || wrap.current?.closest('.topbar');
        const c = card?.getBoundingClientRect();
        if (c) { el.style.left = Math.round(c.left) + 'px'; el.style.width = Math.round(c.width) + 'px'; el.style.top = Math.round(c.bottom + 8) + 'px'; return; }
      }
      let x = align === 'right' ? b.right - w : b.left - (cls.includes('hd-mega') ? 40 : 6);
      x = Math.max(16, Math.min(x, vw - w - 16));
      // 5.11.2026 yönetim paneli bilgisayarda solda sabit menü (html.adm-apple): menü düğmenin SAĞINDA açılır
      if (document.documentElement.classList.contains('adm-apple') && innerWidth >= 1100 && wrap.current?.closest('.shell.admin')) {
        el.style.left = Math.round(b.right + 12) + 'px'; el.style.top = Math.max(12, Math.min(Math.round(b.top - 8), innerHeight - el.offsetHeight - 12)) + 'px'; return;
      }
      el.style.left = x + 'px'; el.style.top = Math.round(b.bottom + 10) + 'px';
    };
    place(); addEventListener('resize', place); addEventListener('scroll', place, true);
    // v3: yandaki menüden geçiş → panel kapanıp açılmaz, eski yerinden yeni yerine/boyuna kayar, içerik hafifçe belirir
    const el0 = pane.current, sw = swapFrom; swapFrom = null;
    if (el0 && sw && cls.includes('hd-v3') && performance.now() - sw.t < 260 && el0.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const n = el0.getBoundingClientRect(), o = sw.r;
      el0.classList.add('hd-sw');
      const E = 'cubic-bezier(.22,.7,.2,1)';
      el0.animate([{ left: o.left + 'px', top: o.top + 'px', width: o.width + 'px', height: o.height + 'px' }, { left: n.left + 'px', top: n.top + 'px', width: n.width + 'px', height: n.height + 'px' }], { duration: 260, easing: E });
      el0.firstElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 60, easing: 'ease-out', fill: 'backwards' });
    }
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
  const here = () => MENU.burada && !!wrap.current?.firstElementChild?.classList.contains('on'); // başlık düğmesi 'on' = bu sayfadayız
  const show = () => { clearTimeout(t.current); if (active && active.id !== myId.current) { const r = active.rect?.(); if (r && r.width) swapFrom = { r, t: performance.now() }; active.close(); } active = { id: myId.current, close: () => me.current(), rect: () => pane.current?.getBoundingClientRect() }; setOpen(true); };
  const enter = (e) => {
    clearTimeout(t.current);
    if (open || mute.current) return;
    if (active && active.id !== myId.current) { if (cls.includes('hd-v3')) t.current = setTimeout(show, 90); else show(); return; } // başka menü açıkken yandakine geçiş: beklemeden (v3: 90 ms — panele çapraz inerken yoldaki başlıklar menüyü değiştirmesin)
    if (here()) return;
    if (MENU.niyet && e) { anc.current = { x: e.clientX, y: e.clientY }; t.current = setTimeout(show, DUR); return; }
    t.current = setTimeout(show, DELAY);
  };
  // niyet: fare belirgin kıpırdadıkça sayaç baştan başlar → sadece durunca açılır
  const move = (e) => {
    if (open || !MENU.niyet || mute.current || here()) return;
    const a = anc.current;
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) < TITRE) return;
    anc.current = { x: e.clientX, y: e.clientY }; clearTimeout(t.current); t.current = setTimeout(show, DUR);
  };
  // kapanmadan önce farenin GERÇEKTEN dışarıda olduğunu sor: tarayıcı bazen yanlış 'çıktı' bildirimi veriyor
  // (fare menüde, satırın üstünde durma izi var ama menü kapanıyordu). Hâlâ üstündeyse kapanmaz, fare çıkınca kapanır.
  const inside = () => !!(wrap.current?.matches(':hover') || pane.current?.matches(':hover') || (pane.current?.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT' && document.activeElement.value));
  const later = () => { t.current = setTimeout(() => (inside() ? later() : close()), 400); };
  const leave = () => { clearTimeout(t.current); mute.current = false; if (open) later(); };
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
    <Item close={c} icon="tag" label="Form oluştur" sub="Liste resmi + fiyatlı link" onClick={() => go('siparis')} />
    <Item close={c} icon="cart" label="Sepet linki" sub="Müşteri tek tıkla onaylar" onClick={() => go('sepetlink')} />
    <Item close={c} icon="card" label="Ödeme linki" sub="Tutar + KDV + komisyon → link" onClick={() => go('odemelink')} />
  </>)}>{children}</HoverDrop>;
  if (k === 'katalog') return <HoverDrop panel={(c) => (<>
    <Item close={c} icon="grid" label="Ürünler" sub="Katalog, fiyat, stok" onClick={() => go('katalog')} />
    <Item close={c} icon="sparkle" label="Akıllı ürün ekle" sub="Adı yazın, gerisini yapay zekâ hazırlasın" onClick={() => go('aiekle')} />
    <Item close={c} icon="send" label="Claude’dan gelenler" sub="Sohbetten gelen ürün taslakları" onClick={() => go('gelen')} />
    <Item close={c} icon="box" label="Setler" sub="Ürün paketleri oluşturun" pill={(s.settings.sets || []).length ? String((s.settings.sets || []).length) : ''} onClick={() => go('setler')} />
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
  const v3 = useNavV3();
  const wide = useStore((s) => (s.settings.look?.navMenu || 'wide') !== 'old');
  const [cats, cnt] = useMemo(() => {
    const cnt = new Map();
    for (const p of vis) for (const c of new Set([p.c, p.c2].filter((x) => x != null).flatMap((x) => tree.ancestors(x)))) cnt.set(c, (cnt.get(c) || 0) + 1);
    return [tree.roots.filter((n) => !n.hidden && cnt.get(n.id)).map((n) => ({ n, subs: n.children.filter((x) => !x.hidden && cnt.get(x.id)) })), cnt];
  }, [vis, tree]);
  if (v3) return <HoverDrop cls="hd-v3 hd-wide" panel={(c) => <V3Products cats={cats} cnt={cnt} vis={vis} S={S} close={c} />}>{children}</HoverDrop>;
  if (wide) return <HoverDrop cls="hd-wide" panel={(c) => <WideProducts cats={cats} cnt={cnt} vis={vis} S={S} hasSets={hasSets} close={c} />}>{children}</HoverDrop>;
  return <HoverDrop cls="hd-mega" panel={(c) => (
    <div className="hd-mega-in">
      <div className="hd-side">
        <Item close={c} icon="grid" label="Tüm ürünler" onClick={() => { store.set({ catalogGo: { all: true } }); go('katalog'); }} />
        {hasSets && <Item close={c} icon="box" label="Setler" onClick={() => { store.set({ catalogGo: { sets: true } }); go('katalog'); }} />}
        <Item close={c} icon="heart" label="Favorilerim" onClick={() => { store.set({ catalogGo: { fav: true } }); go('katalog'); }} />
      </div>
      <MegaCats cats={cats} close={c} />
    </div>
  )}>{children}</HoverDrop>;
}

// 5.11.2026 üst menü 'Markalar ▾': ürünü olan markalar (çoktan aza), logo varsa logo; tıklayınca o markanın ürünleri
export function BrandsDrop({ children }) {
  const all = useBrandList();
  const v3 = useNavV3();
  const wide = useStore((s) => (s.settings.look?.navMenu || 'wide') !== 'old');
  if (v3) return <HoverDrop cls="hd-v3 hd-wide" panel={(c) => <V3Brands all={all} close={c} />}>{children}</HoverDrop>;
  if (wide) return <HoverDrop cls="hd-wide" panel={(c) => <WideBrands all={all} close={c} />}>{children}</HoverDrop>;
  const list = all.filter((b) => b.logo).slice(0, 15);
  const rest = all.filter((b) => !list.includes(b)).slice(0, 8);
  return <HoverDrop cls="hd-brands" panel={(c) => (
    <div className="hdb-wrap">
      <div className="hdb-logos">{list.map((b) => <BrandTile key={b.n} b={b} small onClick={() => { c(); openBrand(b.n); }} />)}</div>
      {rest.length > 0 && <div className="hdb-rest">{rest.map((b) => <button key={b.n} type="button" className="hdb-n2" onClick={() => { c(); openBrand(b.n); }}>{b.n}</button>)}</div>}
      <button type="button" className="hdb-more" onClick={() => { c(); go('markalar'); }}>Tüm markalar ({all.length})<Icon n="back" s={14} className="flip" /></button>
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
    if (hov == null) { t.current = setTimeout(go1, 100); return; } // ilk açılış: üstten inerken satırlar yanıp sönmesin
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

// ==== 7.11.2026 Geniş açılır menüler (Apple tarzı; look.navMenu 'wide' varsayılan, 'old' = eski menüler) ====
// Hepsi üst menü kartının tam genişliğinde açılır; sol sütun büyük kalın yazı, sağda küçük sütunlar + göstergeler (sayılar, seçili satır, ok).
const nf = (n) => Number(n || 0).toLocaleString('tr-TR');
const Chev = ({ s = 13 }) => <svg className="ic hdw-chev" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
function useIntent(init) {
  const [v, setV] = useState(init); const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  // fare satırda kısa bir an durunca değişir (sağ sütuna çapraz giderken yoldaki satırlar değiştirmesin)
  const enter = (x) => { clearTimeout(t.current); t.current = setTimeout(() => setV(x), 110); };
  const now = (x) => { clearTimeout(t.current); setV(x); };
  return [v, enter, now, () => clearTimeout(t.current)];
}
function WideCol1({ label, rows, cur, enter, now, onPick, leave }) {
  return <div className="hdw-c1" onMouseLeave={leave}>
    <span className="hdw-lbl">{label}</span>
    <div className="hdw-big">{rows.map((r) => (
      <button key={r.id} type="button" className={'hdw-bi' + (cur === r.id ? ' on' : '')} onMouseEnter={() => enter(r.id)} onFocus={() => now(r.id)} onClick={() => onPick(r)}>
        <span className="hdw-bn">{r.name}</span><span className="hdw-bk"><small>{r.k}</small><Chev s={14} /></span>
      </button>))}</div>
  </div>;
}
function WideFoot({ hint, more, onMore }) {
  return <div className="hdw-foot"><span><kbd>Esc</kbd> kapatır · {hint}</span><button type="button" className="hdw-more" onClick={onMore}>{more}<Chev /></button></div>;
}
function WideProducts({ cats, cnt, vis, S, hasSets, close }) {
  const favN = useStore((s) => s.favs.length);
  const user = useStore((s) => s.user); const up = useStore((s) => s.userPrices); const byId = useStore((s) => s.byId);
  const [hov, enter, now, stop] = useIntent(cats[0]?.n.id);
  const goCat = (id) => { stop(); close(); store.set({ catalogGo: { cat: id } }); go('katalog'); };
  const goAll = (x = { all: true }) => { close(); store.set({ catalogGo: x }); go('katalog'); };
  const cur = cats.find((x) => x.n.id === hov) || cats[0];
  const subs = cur ? [...cur.subs].sort((a, b) => (cnt.get(b.id) || 0) - (cnt.get(a.id) || 0)) : [];
  // 'Bu hafta' kutusu: Haftanın ürünü (Paket 0 seçimi) → öne çıkanlar → yeni gelenlerden resimli ilk ürün
  const pick = useMemo(() => {
    const ok = (p) => p && p.a !== 0 && !p.so && (p.pi || p.im);
    const ids = [...(S.shopHome?.p0?.pick?.ids || []), ...feat(S).pins];
    for (const id of ids) { const p = byId.get(Number(id)); if (ok(p)) return p; }
    return vis.find((p) => p.nw && p.s > 0 && ok(p)) || vis.find((p) => p.s > 0 && ok(p)) || null;
  }, [S, byId, vis]);
  const pr = pick ? priceFor(pick, S, user, up) : null;
  const badge = S.shopHome?.p0?.pick?.badge ?? 'Haftanın ürünü';
  return <div className="hdw">
    <div className="hdw-g hdw-gp">
      <WideCol1 label="Kategoriler" rows={cats.map(({ n }) => ({ id: n.id, name: n.name, k: nf(cnt.get(n.id)) }))} cur={cur?.n.id} enter={enter} now={now} leave={stop} onPick={(r) => goCat(r.id)} />
      <div className="hdw-c2">
        <div className="hdw-h"><span className="hdw-lbl">{cur?.n.name} · {nf(cnt.get(cur?.n.id))} ürün</span>{subs.length > 0 && <span className="hdw-lbl lc">{subs.length} alt kategori</span>}</div>
        {subs.length ? <div className={'hdw-subs' + (subs.length > 7 ? ' two' : '')} key={cur?.n.id}>{subs.map((x) => <button key={x.id} type="button" className="hdw-sub" onClick={() => goCat(x.id)}><span>{x.name}</span><small>{nf(cnt.get(x.id))}</small></button>)}</div>
          : <p className="hdw-none">Bu kategoride alt kategori yok.</p>}
        {cur && <button type="button" className="hdw-link" onClick={() => goCat(cur.n.id)}>{cur.n.name} — tümünü gör<Chev /></button>}
      </div>
      <div className="hdw-c3">
        <span className="hdw-lbl">Hızlı erişim</span>
        <div className="hdw-q">
          <button type="button" onClick={() => goAll()}><span className="hdw-qi"><Icon n="grid" s={17} /></span><span><b>Tüm ürünler</b><small>{nf(vis.length)} ürün</small></span></button>
          <button type="button" onClick={() => goAll({ nw: true })}><span className="hdw-qi ac"><Icon n="star" s={17} /></span><span><b>Yeni gelenler <em>YENİ</em></b><small>Son eklenenler</small></span></button>
          {hasSets && <button type="button" onClick={() => { close(); go('setlist'); }}><span className="hdw-qi"><Icon n="box" s={17} /></span><span><b>Setler</b><small>Birlikte al, daha az öde</small></span></button>}
          <button type="button" onClick={() => goAll({ fav: true })}><span className="hdw-qi rd"><Icon n="heart" s={17} /></span><span><b>Favorilerim</b><small>{favN ? favN + ' ürün' : 'Henüz yok'}</small></span></button>
          <button type="button" onClick={() => { close(); go('kalip'); }}><span className="hdw-qi"><Icon n="mobile" s={17} /></span><span><b>Kalıp bulucu</b><small>Telefon modeline göre</small></span></button>
        </div>
      </div>
      {pick && <div className="hdw-c4">
        <span className="hdw-lbl">{badge || 'Bu hafta'}</span>
        <button type="button" className="hdw-pick" onClick={() => { close(); openProduct(pick.id); }}>
          <span className="hdw-pim"><Thumb p={pick} size="md" /></span>
          <span className="hdw-pt">{pick.b && <small>{pick.b}</small>}<b>{pick.n}</b><span className="hdw-pp"><b className="num">{pr?.mine == null ? 'Fiyat sorun' : fmt(pr.mine, pick.cur)}</b><span className="hdw-go">İncele<Chev s={12} /></span></span></span>
        </button>
      </div>}
    </div>
    <WideFoot hint="başlığa tıklamak sayfaya gider" more={'Tüm ürünler (' + nf(vis.length) + ')'} onMore={() => goAll()} />
  </div>;
}
function WideBrands({ all, close }) {
  const tree = useTree(); const vis = useVisibleProducts(false);
  const groups = useMemo(() => {
    const roots = tree.roots.filter((n) => !n.hidden); const rid = new Set(roots.map((n) => n.id));
    const m = new Map(roots.map((n) => [n.id, new Map()]));
    for (const p of vis) {
      if (!p.b || p.c == null) continue;
      const r = tree.ancestors(p.c).find((id) => rid.has(id)); const g = r != null && m.get(r); if (!g) continue;
      g.set(p.b, (g.get(p.b) || 0) + 1);
    }
    const out = [{ id: 'all', name: 'Tüm markalar', list: all, k: String(all.length) }];
    for (const n of roots) { const g = m.get(n.id); if (g && g.size >= 2) out.push({ id: n.id, name: n.name, list: [...g].sort((a, b) => b[1] - a[1]).map(([b, c]) => ({ n: b, c })), k: String(g.size) }); }
    return out;
  }, [tree, vis, all]);
  const look = useMemo(() => new Map(all.map((b) => [b.n, b])), [all]);
  const [gid, enter, now, stop] = useIntent('all');
  const g = groups.find((x) => x.id === gid) || groups[0];
  const tiles = g.list.slice(0, 16).map((b) => ({ ...(look.get(b.n) || {}), ...b }));
  const top = new Set(all.slice(0, 16).map((b) => b.n));
  const az = all.filter((b) => !top.has(b.n)).sort((a, b) => a.n.localeCompare(b.n, 'tr')).slice(0, 24);
  const pick = (n) => { stop(); close(); openBrand(n); };
  return <div className="hdw">
    <div className="hdw-g hdw-gb">
      <WideCol1 label="Alana göre" rows={groups.map((x) => ({ id: x.id, name: x.name, k: x.k }))} cur={g.id} enter={enter} now={now} leave={stop} onPick={(r) => { if (r.id === 'all') { close(); go('markalar'); } else { stop(); close(); store.set({ catalogGo: { cat: r.id } }); go('katalog'); } }} />
      <div className="hdw-c2">
        <div className="hdw-h"><span className="hdw-lbl">{g.name} · ürün sayısına göre</span><span className="hdw-lbl lc">{g.list.length} marka</span></div>
        <div className="hdw-tiles" key={g.id}>{tiles.map((b) => (
          <button key={b.n} type="button" className="hdw-tile" title={b.n} onClick={() => pick(b.n)} style={b.color ? { '--bc': b.color } : undefined}>
            {b.logo ? <ShopImg v={b.logo} className="logo" alt={b.n} /> : <b>{b.n}</b>}<small>{b.c}</small>
          </button>))}</div>
      </div>
      {az.length > 0 && <div className="hdw-c3">
        <span className="hdw-lbl">Diğer markalar A–Z</span>
        <div className="hdw-az">{az.map((b) => <button key={b.n} type="button" onClick={() => pick(b.n)}><span>{b.n}</span><small>{b.c}</small></button>)}</div>
      </div>}
    </div>
    <WideFoot hint="logoya tıklamak o markanın ürünlerini açar" more={'Tüm markalar (' + all.length + ')'} onMore={() => { close(); go('markalar'); }} />
  </div>;
}

// ==== 14.11.2026 v3 açılır menüler (look.navDrop '' = bu; 'prev' = önceki: look.navMenu '' geniş / 'old' eski küçük menüler) ====
// Sunum: https://claude.ai/artifact/YU8zBrBdaXKFhYMuJJfmAT — üst menünün kendisi DEĞİŞMEDİ, sadece açılırlar.
// Ürünler: Bento kutularıyla aynı kesim resimler (renk yok, altta gri gölge) + en kalabalık 3 alt kategori; Markalar: logo duvarı +
// arama + A–Z; Kalıp bulucu ve Setler için küçük paneller. Menüden menüye geçişte panel kayar (HoverDrop swapFrom). Zıplama YOK.
export const useNavV3 = () => useStore((s) => !s.settings.look?.navDrop); // look.navDrop '' = v3 | 'prev' = önceki (look.navMenu: '' geniş / 'old' eski)
const V3Img = ({ v }) => (v ? <ShopImg v={v} className="v3-im" alt="" /> : <span className="v3-im v3-im0"><Icon n="grid" s={26} /></span>);
function V3Products({ cats, cnt, vis, S, close }) {
  const favN = useStore((s) => s.favs.length);
  const user = useStore((s) => s.user); const up = useStore((s) => s.userPrices); const byId = useStore((s) => s.byId);
  const goCat = (id) => { close(); store.set({ catalogGo: { cat: id } }); go('katalog'); };
  const goAll = (x = { all: true }) => { close(); store.set({ catalogGo: x }); go('katalog'); };
  const list = [...cats].sort((a, b) => (cnt.get(b.n.id) || 0) - (cnt.get(a.n.id) || 0));
  const pick = useMemo(() => {
    const ok = (p) => p && p.a !== 0 && !p.so && (p.pi || p.im);
    const ids = [...(S.shopHome?.p0?.pick?.ids || []), ...feat(S).pins];
    for (const id of ids) { const p = byId.get(Number(id)); if (ok(p)) return p; }
    return vis.find((p) => p.nw && p.s > 0 && ok(p)) || vis.find((p) => p.s > 0 && ok(p)) || null;
  }, [S, byId, vis]);
  const pr = pick ? priceFor(pick, S, user, up) : null;
  const badge = S.shopHome?.p0?.pick?.badge ?? 'Haftanın ürünü';
  const cols = list.length + 1 <= 8 ? 4 : 5;
  const kd = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  return <div className="hdw v3p">
    <div className="v3p-g">
      <div className="v3-tiles" style={{ '--cols': cols }}>
        {list.map(({ n, subs }, i) => {
          const top = [...subs].sort((a, b) => (cnt.get(b.id) || 0) - (cnt.get(a.id) || 0));
          const more = top.length - 3;
          return <div key={n.id} role="button" tabIndex={0} className="v3-tile" style={{ '--i': i }} onClick={() => goCat(n.id)} onKeyDown={kd(() => goCat(n.id))}>
            <span className="v3-imw"><V3Img v={HUB_CUT[n.id] || CAT_COVERS[n.id] || HUB_IMG[n.id]} /></span>
            <span className="v3-h"><b>{n.name}</b><small>{nf(cnt.get(n.id))}</small></span>
            {top.length > 0 && <span className="v3-subs">
              {top.slice(0, 3).map((x) => <button key={x.id} type="button" onClick={(e) => { e.stopPropagation(); goCat(x.id); }}><span>{x.name}</span><small>{nf(cnt.get(x.id))}</small></button>)}
              {more > 0 && <em>+ {more} alt kategori</em>}
            </span>}
          </div>;
        })}
        <button type="button" className="v3-tile v3-all" style={{ '--i': list.length }} onClick={() => goAll()}><Icon n="grid" s={26} /><b>Tüm ürünler</b><small>{nf(vis.length)} ürün</small></button>
      </div>
      <div className="v3-side">
        <span className="hdw-lbl">Hızlı erişim</span>
        <button type="button" className="v3-qa" onClick={() => goAll({ nw: true })}><span className="v3-qi"><Icon n="star" s={17} /></span><span><b>Yeni gelenler</b><small>Son eklenenler</small></span></button>
        <button type="button" className="v3-qa" onClick={() => goAll({ fav: true })}><span className="v3-qi"><Icon n="heart" s={17} /></span><span><b>Favorilerim</b><small>{favN ? favN + ' ürün' : 'Henüz yok'}</small></span></button>
        {pick && <button type="button" className="v3-pick" onClick={() => { close(); openProduct(pick.id); }}>
          <span className="v3-pim"><Thumb p={pick} size="md" /></span>
          <span className="v3-pt"><small>{badge || 'Bu hafta'}</small><b>{pick.n}</b><span className="v3-pp"><b className="num">{pr?.mine == null ? 'Fiyat sorun' : fmt(pr.mine, pick.cur)}</b><span>İncele<Chev s={12} /></span></span></span>
        </button>}
      </div>
    </div>
  </div>;
}
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const first = (n) => { const c = String(n || '').trim().charAt(0).toLocaleUpperCase('tr'); return c === 'İ' ? 'I' : /[0-9]/.test(c) ? '#' : c; };
function V3Brands({ all, close }) {
  const [q, setQ] = useState('');
  const [ltr, enter, now, stop] = useIntent(null);
  const has = useMemo(() => new Set(all.map((b) => first(b.n))), [all]);
  const letters = has.has('#') ? ['#', ...AZ] : AZ;
  const nq = q.trim().toLocaleLowerCase('tr');
  const shown = nq ? all.filter((b) => b.n.toLocaleLowerCase('tr').includes(nq)).slice(0, 16)
    : ltr ? all.filter((b) => first(b.n) === ltr).sort((a, b) => a.n.localeCompare(b.n, 'tr')).slice(0, 16)
      : all.slice(0, 16);
  const pick = (n) => { stop(); close(); openBrand(n); };
  const head = nq ? `“${q.trim()}” · ${shown.length} marka` : ltr ? `${ltr} ile başlayanlar` : 'En çok ürünü olan markalar';
  return <div className="hdw v3b">
    <div className="v3b-in">
      <div className="v3b-hd"><span className="hdw-lbl">{head}</span>
        <label className="v3b-s"><Icon n="search" s={16} /><input value={q} onChange={(e) => { setQ(e.target.value); now(null); }} placeholder="Marka ara..." onKeyDown={(e) => { if (e.key === 'Enter' && shown[0]) pick(shown[0].n); if (e.key === 'Escape') { if (q) { e.stopPropagation(); setQ(''); } } }} />{q && <button type="button" onClick={() => setQ('')} aria-label="Temizle"><Icon n="x" s={14} /></button>}</label>
      </div>
      {shown.length ? <div className="v3-logos" key={nq + '|' + ltr}>{shown.map((b, i) => (
        <button key={b.n} type="button" className="v3-lg" title={b.n} style={{ '--i': i, ...(b.color ? { '--bc': b.color } : null) }} onClick={() => pick(b.n)}>
          {b.logo ? <ShopImg v={b.logo} className="logo" alt={b.n} /> : <b>{b.n}</b>}<small>{b.c} ürün</small>
        </button>))}</div>
        : <p className="hdw-none">Bu adla marka yok.</p>}
      <div className="v3-az" onMouseLeave={stop}>
        {letters.map((l) => <button key={l} type="button" disabled={!has.has(l)} className={ltr === l && !nq ? 'on' : ''} onMouseEnter={() => { if (has.has(l) && !nq) enter(l); }} onClick={() => { setQ(''); now(ltr === l ? null : l); }}>{l}</button>)}
      </div>
    </div>
    <WideFoot hint="harfin üstüne gelince o harfle başlayan markalar" more={'Tüm markalar (' + all.length + ')'} onMore={() => { close(); go('markalar'); }} />
  </div>;
}

// ---- Kalıp bulucu ▾ : menünün içinden model arama ----
const KALIP_PICKS = ['Apple iPhone 15 Pro', 'Apple iPhone 13', 'Samsung Galaxy A54', 'Xiaomi Redmi Note 13', 'Samsung Galaxy S23 Ultra'];
const KALIP_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Oppo'];
export const openKalip = (name) => { store.set({ kalipPick: name || null }); go('kalip'); try { history.replaceState(history.state, '', '/magaza/kalip' + (name ? '?m=' + encodeURIComponent(name) : '')); } catch {} };
function V3Kalip({ close }) {
  const over = useStore((s) => s.settings.kalip?.phones);
  const [base, setBase] = useState(null);
  const [q, setQ] = useState(''); const [hi, setHi] = useState(0);
  const inp = useRef(null);
  useEffect(() => { loadPhones().then(setBase).catch(() => {}); }, []);
  const phones = useMemo(() => base && mergePhones(base, over), [base, over]);
  const sugg = useMemo(() => (phones && q ? searchPhones(phones, q, 6) : []), [phones, q]);
  const picks = useMemo(() => (phones ? KALIP_PICKS.filter((n) => phones.some((p) => p.n === n)) : KALIP_PICKS), [phones]);
  const pick = (n) => { close(); openKalip(n); };
  const short1 = (n) => n.replace(/^(Apple|Samsung|Xiaomi)\s+/, '');
  return <div className="v3k">
    <b className="v3m-t">Telefonun kalıbını bul</b>
    <small className="v3m-s">Modeli yaz, uyumlu kalıplar açılsın</small>
    <label className="v3k-in"><Icon n="search" s={17} /><input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} placeholder="Örn. iPhone 13 Pro, Galaxy A54..."
      onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, sugg.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); } else if (e.key === 'Enter') { if (sugg[hi]) pick(sugg[hi].n); else if (q.trim()) { close(); openKalip(null); } } }} /></label>
    {q.trim().length >= 2 ? <div className="v3k-res">
      {sugg.length ? sugg.map((p, i) => <button key={p.n} type="button" className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onClick={() => pick(p.n)}><span>{p.n}</span><small>{p.c}</small></button>)
        : <p className="hdw-none">{phones ? 'Bu adla telefon bulunamadı.' : 'Liste yükleniyor…'}</p>}
    </div> : <>
      <span className="hdw-lbl v3m-l">Sık bakılanlar</span>
      <div className="v3-chips">{picks.map((n) => <button key={n} type="button" onClick={() => pick(n)}>{short1(n)}</button>)}</div>
      <span className="hdw-lbl v3m-l">Markaya göre</span>
      <div className="v3-chips">{KALIP_BRANDS.map((n) => <button key={n} type="button" onClick={() => { setQ(n + ' '); inp.current?.focus(); }}>{n}</button>)}</div>
    </>}
    <div className="v3m-f"><button type="button" className="v3-btn" onClick={() => { close(); openKalip(null); }}>Kalıp bulucuyu aç<Chev s={12} /></button></div>
  </div>;
}
export function KalipDrop({ children }) {
  const on = useNavV3();
  if (!on) return children;
  return <HoverDrop cls="hd-v3 hd-mini" panel={(c) => <V3Kalip close={c} />}>{children}</HoverDrop>;
}

// ---- Setler ▾ : ilk 3 set ----
function V3Sets({ close }) {
  const S = useStore((s) => s.settings); const byId = useStore((s) => s.byId);
  const live = liveSets(S);
  const ids = S.shopHome?.p0?.sets?.ids || [];
  const sets = (ids.length ? [...ids.map((id) => live.find((x) => x.id === id)).filter(Boolean), ...live.filter((x) => !ids.includes(x.id))] : live).slice(0, 3);
  return <div className="v3s">
    <b className="v3m-t">Setler</b>
    <small className="v3m-s">Birlikte al, daha az öde</small>
    <div className={'v3s-g n' + sets.length}>{sets.map((x, i) => { const v = setView(x, byId); return (
      <button key={x.id} type="button" className="v3s-c" style={{ '--i': i }} onClick={() => { close(); openSet(x.id); }}>
        <span className="v3s-im"><SetCover v={v} bare /></span>
        <span className="v3s-n">{x.name}</span>
        <span className="v3s-p"><b className="num">{fmt(v.price, v.cur)}</b>{v.save > 0 && <small>{fmt(v.save, v.cur)} kazanç</small>}</span>
      </button>); })}</div>
    <div className="v3m-f"><button type="button" className="v3-btn" onClick={() => { close(); go('setlist'); }}>Tüm setler ({live.length})<Chev s={12} /></button></div>
  </div>;
}
export function SetsDrop({ children }) {
  const on = useNavV3();
  const has = useStore((s) => liveSets(s.settings).length > 0);
  if (!on || !has) return children;
  return <HoverDrop cls="hd-v3 hd-mini" panel={(c) => <V3Sets close={c} />}>{children}</HoverDrop>;
}
