// Yönetim › Ürünler › Akıllı ekle (6.11.2026). Yönetici ürün adını yazar (ör. "2uul da 88"); bekçi yapay zekâyla
// ad, marka, kategori, gizli etiket, açıklama hazırlar ve resim arar (worker/ai.js). Taslaklar bu cihazda saklanır
// (ls 'ai-drafts'); 'İncele ve onayla' normal Ürünü düzenle penceresini taslakla doldurur → fiyat + stok girilip kaydedilir.
import { useEffect, useState } from 'react';
import { useStore, api, toast, store } from './store.js';
import { PageHead, Icon, Empty, Confirm, openMenu } from './ui.jsx';
import { ProductsSwitch } from './sets.jsx';
import { ProductEdit } from './admin.jsx';
import { buildTree } from './cats.js';
import { norm, ls, catName } from './utils.js';

const KEY = 'ai-drafts';
const loadQ = () => (ls.get(KEY, []) || []).map((x) => (x.st === 'run' ? { ...x, st: 'wait' } : x));

// kategori yolu listesi [[id, 'Ana > Alt']]
function catPaths(catalog, S) {
  const tree = buildTree(S, [...new Set(catalog.flatMap((x) => [x.c, x.c2]).filter((x) => x != null))]);
  const out = []; const walk = (ns, pre) => ns.forEach((n) => { const p = pre ? pre + ' > ' + n.name : n.name; out.push([n.id, p]); walk(n.children, p); });
  walk(tree.roots, ''); return out;
}
// mağazanın tarzını öğrensin diye: addaki kelimelere en çok benzeyen, etiketi dolu 2 ürün (+ açıklamaları)
async function examples(q, catalog) {
  const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
  const score = (p) => { const n = norm(p.n + ' ' + (p.b || '')); return words.reduce((a, w) => a + (n.includes(w) ? (w === norm(p.b || '') ? 3 : 1) : 0), 0) + (p.id > 3000 ? 0.5 : 0); };
  const pool = catalog.filter((p) => p.t && p.t.split(',').length > 20);
  const pick = pool.map((p) => [score(p), p]).sort((a, b) => b[0] - a[0] || b[1].id - a[1].id).slice(0, 2).map((x) => x[1]);
  return Promise.all(pick.map(async (p) => ({ n: p.n, t: p.t, d: String((await api().getDesc(p.id).catch(() => '')) || '').replace(/<(iframe|script)[\s\S]*?<\/\1>/gi, '').replace(/<img[^>]*>/gi, '').replace(/<div[^>]*>\s*<\/div>/gi, '').slice(0, 2500) })));
}

// sıra modül düzeyinde: sayfadan çıkılsa da hazırlama sürer (yarıda kalıp boşuna yeniden ödenmesin)
let Q = null; const subs = new Set(); let running = false;
const getQ = () => (Q ||= loadQ());
const setQ = (fn) => { Q = typeof fn === 'function' ? fn(getQ()) : fn; ls.set(KEY, Q); subs.forEach((f) => f(Q)); pump(); };
const updQ = (id, p) => setQ((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
function pump() {
  if (running) return;
  const next = getQ().find((x) => x.st === 'wait'); if (!next) return;
  running = true; updQ(next.id, { st: 'run', at: Date.now() });
  (async () => {
    try {
      const { catalog, settings: S } = store.s;
      const brands = [...new Set(catalog.map((x) => x.b).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
      const r = await api().aiDraft({ name: next.q, hint: next.hint || '', cats: catPaths(catalog, S), brands, ex: await examples(next.q, catalog) });
      running = false; updQ(next.id, { st: 'ok', d: r.draft, err: '' });
    } catch (e) { running = false; updQ(next.id, { st: 'err', err: e.message }); }
  })();
}

export function AiAdd() {
  const S = useStore((s) => s.settings);
  const [q, setQ0] = useState('');
  const [hint, setHint] = useState('');
  const [list, setList0] = useState(getQ);
  useEffect(() => { subs.add(setList0); pump(); return () => subs.delete(setList0); }, []);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(false);
  const setList = setQ; const upd = updQ;
  const addNames = () => {
    const names = q.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!names.length) return toast('Ürün adı yazın', 'bad');
    const now = Date.now();
    setList((l) => [...names.map((n, i) => ({ id: now + '-' + i, q: n, hint: hint.trim(), st: 'wait' })), ...l]);
    setQ0(''); setHint('');
  };
  const waiting = list.filter((x) => x.st === 'wait' || x.st === 'run').length;
  const ready = list.filter((x) => x.st === 'ok').length;

  const draftFor = (x) => ({ ...x.d, n: x.d.n, media: (x.d.imgs || []).map((i) => i.u) });
  return (
    <div className="page ai-add adm-sub">
      <PageHead title="Akıllı ürün ekle" extra={ready ? <span className="muted"> · {ready} hazır</span> : null} />
      <ProductsSwitch on="ai" />
      <div className="ai-box">
        <label className="ai-l" htmlFor="ai-q">Ürün adını yazın <small>— her satıra bir ürün</small></label>
        <textarea id="ai-q" rows={3} placeholder={'2uul da 88\njcid v1se face id flex 15 pro'} value={q} onChange={(e) => setQ0(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNames(); }} />
        <div className="ai-row">
          <input id="ai-hint" placeholder="Ek bilgi (isteğe bağlı): ör. 5'li paket, iPhone 16 uyumlu" value={hint} onChange={(e) => setHint(e.target.value)} />
          <button type="button" className="btn primary" onClick={addNames}><Icon n="sparkle" s={16} />Hazırla</button>
        </div>
        <p className="fine">Yapay zekâ ürünü web'de araştırır; adını sizin yazım tarzınızla, markasını, kategorisini, gizli etiketlerini ve açıklamasını hazırlar, marka sitesinde / AliExpress'te resim arar. Hiçbir şey kendiliğinden kaydedilmez: siz kontrol edip fiyat ve stok girip onaylarsınız.</p>
      </div>

      {list.length > 0 && <div className="ai-list-h"><b>Taslaklar</b>{waiting > 0 && <span className="muted"> · {waiting} hazırlanıyor</span>}
        <button type="button" className="link" onClick={() => setDel(true)}>Hepsini temizle</button></div>}
      {!list.length ? <Empty icon="sparkle" title="Henüz taslak yok"><p>Yukarıya ürün adını yazıp Hazırla'ya basın. Bir ürün yaklaşık 30–90 saniyede hazırlanır.</p></Empty> : (
        <div className="ai-list">
          {list.map((x) => {
            const d = x.d; const cover = d?.imgs?.[0]?.u;
            const menu = (e) => openMenu(e, [
              x.st === 'ok' && { label: 'İncele ve onayla', icon: 'check', onClick: () => setEdit(x) },
              { label: 'Yeniden hazırla', icon: 'sparkle', onClick: () => upd(x.id, { st: 'wait', err: '', d: null }) },
              '-',
              { label: 'Taslağı sil', icon: 'trash', danger: true, onClick: () => setList((l) => l.filter((y) => y.id !== x.id)) },
            ], x.q);
            return (
              <div key={x.id} className={'ai-row-c st-' + x.st} onClick={() => x.st === 'ok' && setEdit(x)}>
                <div className="ai-cov">{cover ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Icon n={x.st === 'err' ? 'x' : 'sparkle'} s={22} />}</div>
                <div className="ai-t">
                  {x.st === 'ok' ? <>
                    <b>{d.n}</b>
                    <small>{[d.b || 'marka yok', d.c != null ? catName(S, d.c) : 'kategori yok', `${(d.imgs || []).length} resim`, `${d.t ? d.t.split(',').length : 0} etiket`].join(' · ')}</small>
                    <small className="muted">Yazdığınız: “{x.q}”{d.note ? ' · ' + d.note : ''}</small>
                  </> : <>
                    <b>{x.q}</b>
                    <small className={x.st === 'err' ? 'ai-err' : 'muted'}>{x.st === 'run' ? 'Araştırılıyor… (30–90 sn)' : x.st === 'wait' ? 'Sırada' : 'Hazırlanamadı: ' + x.err}</small>
                  </>}
                </div>
                {x.st === 'ok' && <button type="button" className="btn sm primary" onClick={(e) => { e.stopPropagation(); setEdit(x); }}>İncele ve onayla</button>}
                {x.st === 'err' && <button type="button" className="btn sm ghost" onClick={(e) => { e.stopPropagation(); upd(x.id, { st: 'wait', err: '' }); }}>Tekrar dene</button>}
                {x.st === 'run' && <span className="ai-spin" aria-label="Hazırlanıyor" />}
                <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); menu(e); }} aria-label="Menü"><Icon n="more" s={18} /></button>
              </div>
            );
          })}
        </div>
      )}
      {edit && <ProductEdit p={null} draft={draftFor(edit)} onClose={() => setEdit(null)} onSaved={() => setList((l) => l.filter((y) => y.id !== edit.id))} />}
      {del && <Confirm title="Taslaklar silinsin mi?" text="Kaydedilmemiş tüm taslaklar bu cihazdan silinir. Kaydettiğiniz ürünler etkilenmez." okLabel="Temizle" tone="danger" onOk={() => setList([])} onClose={() => setDel(false)} />}
    </div>
  );
}
