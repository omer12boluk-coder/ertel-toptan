// Mağaza özellikleri (29.10.2026): ürün paylaşma, gelince haber ver, popüler ürünler (herkesin favorisi rafı,
// birlikte iyi gider, ustaların tercihi). Her biri Ayarlar > Mağaza özellikleri'nden tek anahtarla kapanır (settings.feat).
// Popüler verisi: stats/public (tools/stats.mjs, Actions "Popüler ürünleri hesapla", haftada iki kez) — müşteri oturumda 1 kez okur.
import { useEffect, useMemo, useState } from 'react';
import { useStore, store, api, go, toast, openProduct, setQty } from './store.js';
import { Icon, Empty, Toggle, openMenu, copyText } from './ui.jsx';
import { fmt, priceFor, picUrl, mediaFallback, fbSkip } from './utils.js';
import { waLink } from './route.js';
import { pushState } from './push.js';
import { queueSave } from './saveq.js';

// ---- anahtarlar
export function feat(S) {
  const F = S?.feat || {}; const P = F.pop || {}; const R = F.rev || {};
  const pop = P.on !== false; const rev = R.on !== false;
  return { share: F.share !== false, notify: F.notify !== false, pop, popFav: pop && P.fav !== false, popPair: pop && P.pair !== false, popCat: pop && P.cat !== false, rev, revMod: R.moderate !== false,
    pin: F.pinOn !== false, pins: F.pinOn !== false && Array.isArray(F.pins) ? F.pins : [] };
}
// ---- Kategoride öne çıkarma (29.10.2026): yönetici ürünü sabitler (settings.feat.pins, sıralı); mağazada o ürünün
// kategorileri seçiliyken (varsayılan sıralama, arama yokken) en başta "Öne çıkan" etiketiyle görünür.
export function togglePin(p) {
  const S = store.s.settings; const cur = Array.isArray(S.feat?.pins) ? S.feat.pins : [];
  const on = !cur.includes(p.id);
  const pins = on ? [...cur, p.id].slice(-200) : cur.filter((x) => x !== p.id);
  store.set({ settings: { ...S, feat: { ...(S.feat || {}), pins } } });
  queueSave('settings', () => api().saveSettings(store.s.settings));
  toast(on ? (S.feat?.pinOn === false ? 'Öne çıkarıldı · özellik Ayarlar’da kapalı' : 'Kategorisinde öne çıkarıldı') : 'Öne çıkarma kaldırıldı');
}
export const isPinned = (S, id) => Array.isArray(S?.feat?.pins) && S.feat.pins.includes(id);
export const useFeat = () => feat(useStore((s) => s.settings));

// ---- Popüler verisi (oturumda bir kez)
let statsP = null;
export function useStats(on = true) {
  const st = useStore((s) => s.popStats);
  useEffect(() => {
    if (!on || st || statsP) return;
    const A = api(); if (!A?.getStats) return;
    statsP = A.getStats().then((d) => store.set({ popStats: d || {} })).catch(() => store.set({ popStats: {} }));
  }, [on]);
  return st || null;
}
const act = (p) => p && p.a !== 0 && !p.so;

// =====================================================================================================
// Paylaş (31.10.2026, kullanıcı): menü YOK, doğrudan telefonun / bilgisayarın paylaş penceresi; sadece başlık + link
// (fiyat yazılmaz). WhatsApp vb. resimli önizlemeyi linkten kendisi çeker (site/worker.js OG etiketleri).
export async function shareUrl(url, title) {
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title, url }); return; } catch (x) { if (x?.name === 'AbortError') return; }
  }
  copyText(url, 'Link kopyalandı');
}
export function shareMenu(e, p) { e?.stopPropagation?.(); shareUrl(location.origin + '/urun/' + p.id, p.n); }
export function ShareBtn({ p, big, url, title, label = 'Ürünü paylaş' }) {
  const S = useStore((s) => s.settings);
  if (!feat(S).share || !(p || url)) return null;
  const go = (e) => { e.stopPropagation(); shareUrl(url || location.origin + '/urun/' + p.id, title || p.n); };
  return (
    <button type="button" className={'share-btn' + (big ? ' big' : '')} onClick={go} aria-label={label} title="Paylaş">
      <Icon n="share" s={big ? 19 : 17} />
    </button>
  );
}

// =====================================================================================================
// Gelince haber ver: üyenin members.notify listesi + wait/{ürün} (yönetici stoğu açınca bildirim gider; ürün üye görene kadar listede kalır)
export async function toggleNotify(id) {
  const m = store.s.member;
  if (!m) { toast('Haber alabilmek için üye girişi yapın'); go('hesap'); return null; }
  const list = Array.isArray(m.notify) ? m.notify : [];
  const on = !list.includes(id);
  const notify = on ? [id, ...list].slice(0, 200) : list.filter((x) => x !== id);
  store.set({ member: { ...m, notify } });
  try {
    await store.s.api.setWait?.(m.uid, id, on, notify);
    if (on) toast(pushState() === 'on' ? 'Stoğa girince haber vereceğiz' : 'Stoğa girince haber vereceğiz · telefon bildirimini Hesabım › Bildirimler’den açın');
    else toast('Haber verme kapatıldı');
  } catch (e) { store.set({ member: m }); toast('Kaydedilemedi: ' + e.message, 'bad'); }
  return on;
}
export const outOfStock = (p) => p && !(p.s > 0);
// Üye stoğa giren beklediği ürünü "gördü" (bildirime dokundu ya da Haber beklenenler'i açtı): o ürün listeden çıkar.
// Görmediği sürece ürün listede kalır ve her stoğa girişinde yeniden bildirilir.
export async function seenWait(ids) {
  const m = store.s.member; if (!m || !Array.isArray(m.notify)) return [];
  const byId = store.s.byId;
  const done = ids.filter((id) => m.notify.includes(id) && byId.get(id) && !outOfStock(byId.get(id)));
  if (!done.length) return [];
  const notify = m.notify.filter((x) => !done.includes(x));
  store.set({ member: { ...m, notify } });
  for (const id of done) await store.s.api.setWait?.(m.uid, id, false, notify).catch(() => {});
  return done;
}
export function NotifyBtn({ p, big }) {
  const S = useStore((s) => s.settings);
  const on = useStore((s) => (s.member?.notify || []).includes(p.id));
  const [pop, setPop] = useState(0);
  if (!feat(S).notify) return null;
  const click = (e) => { e.stopPropagation(); toggleNotify(p.id).then((v) => v != null && setPop((x) => x + 1)); };
  return (
    <button type="button" className={'notify-btn' + (on ? ' on' : '') + (big ? ' big' : '')} aria-pressed={on} onClick={click} title={on ? 'Haber verme açık · kapatmak için dokunun' : 'Stoğa girince haber ver'}>
      <Icon key={pop} n="bell" s={big ? 18 : 15} className={pop ? 'fav-pop' : ''} />
      {/* kartta: takibe alınınca yazı yumuşakça kapanır, sadece çan kalır (pencerede yazı hep görünür) */}
      <span>{big ? (on ? 'Haber vereceğiz' : 'Gelince haber ver') : 'Haber ver'}</span>
    </button>
  );
}
// ürün penceresinde stok yok kutusu
export function NotifyBox({ p }) {
  const S = useStore((s) => s.settings);
  if (!feat(S).notify) return null;
  return (
    <div className="notify-box">
      <span className="notify-box-t"><Icon n="clock" s={16} />Şu an stokta yok</span>
      <NotifyBtn p={p} big />
      <small className="muted">Stoğa girince telefonunuza bildirim gönderelim. Hesabım › Haber beklenenler’den kapatabilirsiniz.</small>
    </div>
  );
}
// Hesabım > Haber beklenenler
export function WaitList() {
  const { member, byId } = useStore();
  const ids = member?.notify || [];
  const hits = (member?.notifyHit || []).filter((x) => x && x.at > Date.now() - 30 * 864e5);
  const list = ids.map((id) => byId.get(id)).filter(Boolean);
  if (!list.length && !hits.length) return <Empty icon="bell" title="Haber beklediğiniz ürün yok"><p>Stokta olmayan ürünlerde <b>Gelince haber ver</b>’e dokunun; ürün gelince telefonunuza bildirim gönderelim.</p><button className="btn primary" onClick={() => go('katalog')}>Ürünlere göz at</button></Empty>;
  return (
    <div className="wait-list">
      {list.map((p) => (
        <div key={p.id} className="wait-row">
          <button className="wait-main" onClick={() => openProduct(p.id)}>
            <WaitThumb p={p} />
            <span className="wait-t"><b>{p.n}</b><small className={p.s > 0 ? 'ok' : 'warn'}>{p.s > 0 ? 'Stokta · hemen alabilirsiniz' : 'Bekleniyor'}</small></span>
          </button>
          <button className="wait-x" onClick={() => toggleNotify(p.id)} aria-label="Haber vermeyi kapat" title="Haber vermeyi kapat"><Icon n="bell" s={16} /></button>
        </div>
      ))}
      {hits.length > 0 && <>
        <h4 className="wait-h">Gelen ürünler</h4>
        {hits.map((h) => { const p = byId.get(h.id); return (
          <button key={h.id + '-' + h.at} className="wait-row hit" onClick={() => p && openProduct(p.id)}>
            {p ? <WaitThumb p={p} /> : <span className="wait-th" />}
            <span className="wait-t"><b>{p?.n || h.n}</b><small className="ok">Geldi · {new Date(h.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</small></span>
          </button>
        ); })}
      </>}
      <p className="fine">Ürün gelince bildirim bir kez gider ve ürün bu listeden kendiliğinden düşer.</p>
    </div>
  );
}
function WaitThumb({ p }) {
  const S = useStore((s) => s.settings);
  const f = p.pi || (p.im || [])[0]; const u = f ? picUrl(f, S.catalog.imageThumb, false) : null;
  return <span className="wait-th">{u && <img src={u} alt="" loading="lazy" onError={(e) => { if (!fbSkip(e)) e.currentTarget.style.visibility = 'hidden'; }} />}</span>;
}

// =====================================================================================================
// Popüler: "Birlikte iyi gider" (ürün penceresi) ve "Ustaların tercihi" (kategori)
export function PairRail({ p, onPick }) {
  const { byId, settings: S } = useStore();
  const F = feat(S);
  const st = useStats(F.popPair);
  if (!F.popPair || !st?.pair) return null;
  const list = (st.pair[p.id] || []).map((id) => byId.get(id)).filter(act).slice(0, 8);
  if (!list.length) return null;
  return (
    <section className="pair-rail">
      <div className="pair-h"><b>Birlikte iyi gider</b><small>Bu ürünü alanlar bunları da aldı</small></div>
      <div className="pair-list">{list.map((x) => <MiniCard key={x.id} p={x} onOpen={() => onPick?.(x)} />)}</div>
    </section>
  );
}
function MiniCard({ p, onOpen }) {
  const { settings: S, user, userPrices, cart } = useStore();
  const pr = priceFor(p, S, user, userPrices);
  const f = p.pi || (p.im || [])[0]; const u = f ? picUrl(f, S.catalog.imageThumb, false) : null;
  const qty = cart[p.id] || 0;
  return (
    <div className="mini-card">
      <button className="mini-img" onClick={onOpen} aria-label={p.n}>{u && <img src={u} alt="" loading="lazy" onError={(e) => { if (!fbSkip(e)) e.currentTarget.style.visibility = 'hidden'; }} />}</button>
      <button className="mini-n" onClick={onOpen}>{p.n}</button>
      <div className="mini-f">
        <b>{pr.mine == null ? 'Fiyat sorun' : fmt(pr.mine, p.cur)}</b>
        {p.s > 0 && <button className="mini-add" onClick={() => { setQty(p.id, qty + 1); toast(qty ? 'Sepete 1 tane daha eklendi' : 'Sepete eklendi'); }} aria-label="Sepete ekle" title="Sepete ekle"><Icon n="plus" s={15} />{qty > 0 && <i>{qty}</i>}</button>}
      </div>
    </div>
  );
}

// ids: seçili kategorideki ürünler (alt kategoriler dahil). Paylar o kategoride son 120 günde ürünlerin geçtiği sipariş sayısından;
// toplam 5 siparişten azsa ya da 2'den az ürün satıldıysa kutu görünmez.
export function CatTop({ ids, onOpen }) {
  const { byId, settings: S } = useStore();
  const F = feat(S);
  const st = useStats(F.popCat);
  const rows0 = useMemo(() => (st?.cnt ? (ids || []).map((id) => ({ p: byId.get(id), c: st.cnt[id] || 0 })).filter((x) => x.c > 0 && act(x.p)) : []), [st, ids, byId]);
  if (!F.popCat || !st?.cnt) return null;
  const total = rows0.reduce((a, x) => a + x.c, 0);
  const rows = [...rows0].sort((a, b) => b.c - a.c).slice(0, 4).map((x) => ({ ...x, pc: Math.max(1, Math.round((x.c / total) * 100)) }));
  if (total < 5 || rows.length < 2) return null;
  const max = Math.max(...rows.map((x) => x.pc));
  return (
    <section className="cat-top">
      <div className="cat-top-h"><b><Icon n="star" s={16} />Ustaların tercihi</b><small>Son 90 günde bu kategoride en çok alınanlar</small></div>
      <ol>
        {rows.map(({ p, pc }, i) => (
          <li key={p.id}>
            <button onClick={() => onOpen(p)}>
              <span className={'cat-top-n' + (i === 0 ? ' first' : '')}>{i + 1}</span>
              <span className="cat-top-b">
                <span className="cat-top-l"><b>{p.n}</b><em>{fmt(priceFor(p, S, store.s.user, store.s.userPrices).mine ?? p.r, p.cur)}</em></span>
                <span className="cat-top-bar"><i style={{ width: Math.max(6, Math.round((pc / max) * 100)) + '%' }} /></span>
                <small>Alanların %{pc}’i bunu seçti</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

// =====================================================================================================
// Ayarlar > Mağaza özellikleri: basit anahtarlar
function PinList({ ids, onChange }) {
  const byId = useStore((s) => s.byId);
  if (!ids.length) return <p className="fine pin-empty">Henüz öne çıkarılan ürün yok.</p>;
  const mv = (i, d) => { const a = [...ids]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <ul className="pin-list">
      {ids.map((id, i) => { const p = byId.get(id); return (
        <li key={id}>
          <span className="pin-n"><b>{p?.n || 'Ürün #' + id}</b>{p && <small className="muted">{p.k}{p.a === 0 || p.so ? ' · mağazada kapalı' : ''}</small>}</span>
          <button type="button" className="icon-btn sm" disabled={i === 0} onClick={() => mv(i, -1)} aria-label="Yukarı"><Icon n="up" s={15} /></button>
          <button type="button" className="icon-btn sm" disabled={i === ids.length - 1} onClick={() => mv(i, 1)} aria-label="Aşağı"><Icon n="down" s={15} /></button>
          <button type="button" className="icon-btn sm" onClick={() => onChange(ids.filter((x) => x !== id))} aria-label="Kaldır"><Icon n="x" s={15} /></button>
        </li>
      ); })}
    </ul>
  );
}
export function FeatSettings({ d, set }) {
  const F = d.feat || {}; const P = F.pop || {}; const R = F.rev || {};
  const pop = P.on !== false; const rev = R.on !== false;
  return <>
    <p className="fine">Her özelliği tek dokunuşla açıp kapatabilirsiniz. Kapatınca müşteriler hiçbir yerde görmez; kayıtlı veriler silinmez, açınca geri gelir.</p>
    <div className="feat-grid">
      <div className="feat-card">
        <Toggle id="ft-share" label="Ürün paylaşma" hint="Ürün penceresinde paylaş düğmesi: WhatsApp, link, resimle paylaşma" checked={F.share !== false} onChange={(v) => set('feat.share', v)} />
      </div>
      <div className="feat-card">
        <Toggle id="ft-notify" label="Gelince haber ver" hint="Stokta olmayan üründe çan düğmesi; ürün gelince üyeye telefon bildirimi" checked={F.notify !== false} onChange={(v) => set('feat.notify', v)} />
      </div>
      <div className={'feat-card' + (pop ? '' : ' off')}>
        <Toggle id="ft-pop" label="Popüler ürünler (tümü)" hint="Kapatınca aşağıdaki üçü birden kapanır" checked={pop} onChange={(v) => set('feat.pop.on', v)} />
        <div className="feat-sub">
          <Toggle id="ft-pop-fav" label="Ana sayfada “Herkesin favorisi” rafı" hint="En çok kalplenen ürünler · yerini Tasarım modundan değiştirebilirsiniz" checked={P.fav !== false} onChange={(v) => set('feat.pop.fav', v)} />
          <Toggle id="ft-pop-pair" label="Ürün penceresinde “Birlikte iyi gider”" hint="Aynı siparişte sık alınan ürünler" checked={P.pair !== false} onChange={(v) => set('feat.pop.pair', v)} />
          <Toggle id="ft-pop-cat" label="Kategoride “Ustaların tercihi”" hint="Kategoride en çok alınanlar sıralı · az satılan kategoride kendiliğinden gizli" checked={P.cat !== false} onChange={(v) => set('feat.pop.cat', v)} />
        </div>
      </div>
      <div className={'feat-card' + (F.pinOn !== false ? '' : ' off')}>
        <Toggle id="ft-pin" label="Kategoride öne çıkanlar" hint="Seçtiğiniz ürünler kendi kategorilerinde en başta “Öne çıkan” etiketiyle görünür · ürünün ⋮ / sağ tık menüsünden “Kategoride öne çıkar”" checked={F.pinOn !== false} onChange={(v) => set('feat.pinOn', v)} />
        <PinList ids={Array.isArray(F.pins) ? F.pins : []} onChange={(v) => set('feat.pins', v)} />
      </div>
      <div className={'feat-card' + (rev ? '' : ' off')}>
        <Toggle id="ft-rev" label="Ürün yorumları" hint="Sadece ürünü satın almış üyeler yıldız + yorum yazabilir" checked={rev} onChange={(v) => set('feat.rev.on', v)} />
        <div className="feat-sub">
          <Toggle id="ft-rev-mod" label="Yorumlar ben onaylayınca yayınlansın" hint="Kapalıysa yorum hemen görünür; yine de Müşteriler › Yorumlar’dan gizleyebilirsiniz" checked={R.moderate !== false} onChange={(v) => set('feat.rev.moderate', v)} />
        </div>
      </div>
    </div>
    <p className="fine">Popüler ürün verisi haftada iki kez siparişlerden ve favorilerden hesaplanır (GitHub › Actions › “Popüler ürünleri hesapla” ile elle de çalıştırılabilir).</p>
  </>;
}
