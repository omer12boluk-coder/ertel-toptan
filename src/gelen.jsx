// Yönetim › Ürünler › Claude'dan gelenler (7.11.2026). Claude sohbette repo üzerinden ürün taslağı / öneri bırakır:
// `gelen/urun/<id>.json` dosyası `gelen` dalına gönderilir → Actions 'Gelenleri al' (gelen.yml, tools/gelen.mjs)
// taslağı Firestore `gelen/{id}` belgesine yazar (sadece yönetici okur/yazar). Burada liste görünür; ürün taslağında
// 'İncele ve onayla' = Akıllı ekle'deki aynı ProductEdit draft penceresi (fiyat + stok zorunlu, dış resimler R2'ye).
// Onay/ret belgeyi SİLMEZ, st: 'ok' | 'red' yapar (Actions aynı dosyayı tekrar okuyunca geri gelmesin diye).
// Tür 'not' = banner / Keşfet önerisi gibi bilgi kartı (önizleme linki); yayın sohbette "yayınla" ile yapılır.
// Tarif: claude/is/urun-ekle.md
import { useEffect, useState } from 'react';
import { useStore, api, toast } from './store.js';
import { PageHead, Icon, Empty, openMenu } from './ui.jsx';
import { ProductsSwitch } from './sets.jsx';
import { ProductEdit } from './admin.jsx';
import { catName } from './utils.js';

const KIND = { urun: 'Ürün', banner: 'Banner', kesfet: 'Keşfet', not: 'Not' };
const ago = (t) => { if (!t) return ''; const d = Math.floor((Date.now() - t) / 86400000); return d <= 0 ? 'Bugün' : d === 1 ? 'Dün' : d + ' gün önce'; };

export function Gelen() {
  const S = useStore((s) => s.settings);
  const [list, setList] = useState(null);
  const [show, setShow] = useState('new');
  const [edit, setEdit] = useState(null);
  useEffect(() => api().watchGelen ? api().watchGelen(setList) : setList([]), []);
  const mark = (x, st) => api().updateGelen(x.id, { st, done: Date.now() }).then(() => toast(st === 'red' ? 'Reddedildi' : 'Tamamlandı')).catch((e) => toast(e.message, 'bad'));
  const rows = (list || []).filter((x) => (show === 'new' ? (x.st || 'new') === 'new' : (x.st || 'new') !== 'new'));
  const nNew = (list || []).filter((x) => (x.st || 'new') === 'new').length;
  const draftFor = (x) => ({ ...x.d, q: x.q || x.d?.n || '', media: (x.d?.imgs || []).map((i) => (typeof i === 'string' ? i : i.u)).filter(Boolean) });
  return (
    <div className="page ai-add gelen adm-sub">
      <PageHead title="Claude’dan gelenler" extra={nNew ? <span className="muted"> · {nNew}</span> : null} />
      <ProductsSwitch on="gelen" />
      <p className="fine gelen-fine">Claude sohbette “… geldi, ürünü ekle” dediğinizde taslak buraya düşer. Hiçbir şey kendiliğinden yayınlanmaz: fiyat ve stoku girip siz onaylarsınız.</p>
      <div className="seg gelen-seg">
        <button type="button" className={show === 'new' ? 'on' : ''} onClick={() => setShow('new')}>Bekleyen{nNew ? ` (${nNew})` : ''}</button>
        <button type="button" className={show === 'old' ? 'on' : ''} onClick={() => setShow('old')}>Biten</button>
      </div>
      {list === null ? <div className="gelen-load"><span className="ai-spin" /></div> : !rows.length ? (
        <Empty icon="sparkle" title={show === 'new' ? 'Bekleyen taslak yok' : 'Henüz biten yok'}><p>Claude’a sohbette örneğin “2UUL DA88 geldi, ürünü ekle” deyin; taslak birkaç dakika içinde burada görünür.</p></Empty>
      ) : (
        <div className="ai-list">
          {rows.map((x) => {
            const d = x.d || {}; const kind = x.kind || 'urun'; const isP = kind === 'urun';
            const im = d.imgs?.[0]; const cover = (typeof im === 'string' ? im : im?.u) || x.img;
            const open = () => { if (x.st && x.st !== 'new') return; if (isP) setEdit(x); else if (x.link) window.open(x.link, '_blank', 'noopener'); };
            const menu = (e) => openMenu(e, [
              isP && (x.st || 'new') === 'new' && { label: 'İncele ve onayla', icon: 'check', onClick: () => setEdit(x) },
              !isP && x.link && { label: 'Önizlemeyi aç', icon: 'ext', onClick: () => window.open(x.link, '_blank', 'noopener') },
              !isP && (x.st || 'new') === 'new' && { label: 'Tamam (gördüm)', icon: 'check', onClick: () => mark(x, 'ok') },
              (x.st || 'new') === 'new' && { label: 'Reddet', icon: 'x', danger: true, onClick: () => mark(x, 'red') },
              (x.st || 'new') !== 'new' && { label: 'Tekrar bekleyenlere al', icon: 'undo', onClick: () => api().updateGelen(x.id, { st: 'new' }) },
            ].filter(Boolean), isP ? d.n || x.q : x.title);
            return (
              <div key={x.id} className={'ai-row-c gelen-r ' + ((x.st || 'new') === 'new' ? 'st-ok' : 'st-done')} onClick={open}>
                <div className="ai-cov">{cover ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Icon n={isP ? 'box' : 'image'} s={22} />}</div>
                <div className="ai-t">
                  <b>{isP ? d.n || x.q : x.title}<span className={'gelen-k k-' + kind}>{KIND[kind] || kind}</span></b>
                  {isP ? <small>{[d.b || 'marka yok', d.c != null ? catName(S, d.c) : 'kategori yok', `${(d.imgs || []).length} resim`, `${d.t ? String(d.t).split(',').length : 0} etiket`].join(' · ')}</small>
                    : <small>{x.sub || ''}</small>}
                  <small className="muted">{[ago(x.at), x.st === 'ok' ? (isP ? 'Eklendi' : 'Tamam') : x.st === 'red' ? 'Reddedildi' : '', d.note || x.note].filter(Boolean).join(' · ')}</small>
                </div>
                {(x.st || 'new') === 'new' && (isP
                  ? <button type="button" className="btn sm primary" onClick={(e) => { e.stopPropagation(); setEdit(x); }}>İncele ve onayla</button>
                  : x.link ? <button type="button" className="btn sm primary" onClick={(e) => { e.stopPropagation(); window.open(x.link, '_blank', 'noopener'); }}>Önizle</button> : <span />)}
                <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); menu(e); }} aria-label="Menü"><Icon n="more" s={18} /></button>
              </div>
            );
          })}
        </div>
      )}
      {edit && <ProductEdit p={null} draft={draftFor(edit)} onClose={() => setEdit(null)} onSaved={(rec) => api().updateGelen(edit.id, { st: 'ok', done: Date.now(), pid: rec?.id ?? null }).catch(() => {})} />}
    </div>
  );
}
