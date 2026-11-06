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
// yarıda kalan (sayfa yenilendi / kapandı) iş KENDİLİĞİNDEN yeniden sorgulanmaz → 'Tekrar dene' ile elle
const loadQ = () => (ls.get(KEY, []) || []).map((x) => (x.st === 'run' || x.st === 'wait' ? { ...x, st: 'err', err: 'Yarıda kaldı (sayfa kapandı). Gerekirse Tekrar dene’ye basın.' } : x));

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
  const ranked = pool.map((p) => [score(p), p]).sort((a, b) => b[0] - a[0] || b[1].id - a[1].id).map((x) => x[1]);
  // 2 en benzer + en son eklenen (güncel tarz) ürün
  const newest = pool.reduce((a, p) => (!a || p.id > a.id ? p : a), null);
  const pick = [...ranked.slice(0, 2), ...(newest && !ranked.slice(0, 2).includes(newest) ? [newest] : [])];
  examples.vocab = ranked.slice(2, 8).map((p) => p.t); // sadece etiketler: tarz + yanlış yazım kalıpları (ucuz)
  return Promise.all(pick.map(async (p) => ({ n: p.n, t: p.t, d: String((await api().getDesc(p.id).catch(() => '')) || '').replace(/<(iframe|script)[\s\S]*?<\/\1>/gi, '').replace(/<img[^>]*>/gi, '').replace(/<a [^>]*report\.aliexpress[\s\S]*?<\/a>/gi, '').replace(/\s(data-[\w-]+|ae_[\w-]+|st_page_id|clk_trigger|slate-data-type)="[^"]*"/gi, '').replace(/<div[^>]*>\s*<\/div>/gi, '').replace(/(<p>&nbsp;<\/p>\s*)+/g, '').slice(0, 1800) })));
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
      const r = await api().aiDraft({ name: next.q, hint: next.hint || '', link: next.link || '', search: !!next.search, hq: !!next.hq, cats: catPaths(catalog, S), brands, ex: await examples(next.q, catalog), vocab: examples.vocab || [] });
      running = false; updQ(next.id, { st: 'ok', d: r.draft, err: '' }); balTick();
    } catch (e) { running = false; updQ(next.id, { st: 'err', err: e.message }); }
  })();
}

// Bakiye kartı: yüklenen tutar + harcanan (bekçi kendi sayar; Anthropic bakiyeyi dışarı vermiyor). Azalınca / bitince Telegram + panel bildirimi.
const balSubs = new Set(); const balTick = () => balSubs.forEach((f) => f());
function BalCard() {
  const [b, setB] = useState(null); const [ed, setEd] = useState(false); const [v, setV] = useState('');
  const load = () => api().aiBal().then(setB).catch(() => setB({ err: 1 }));
  useEffect(() => { load(); balSubs.add(load); return () => balSubs.delete(load); }, []);
  if (!b || b.err) return null;
  const left = b.budget > 0 ? Math.max(0, b.budget - (b.spent || 0)) : null;
  const low = left != null && left <= b.budget * 0.2;
  const save = async () => { const n = Number(String(v).replace(',', '.')); if (!(n > 0)) return toast('Tutarı $ olarak yazın, ör. 5', 'bad'); setB(await api().aiBal(n)); setEd(false); setV(''); toast('Bakiye kaydedildi'); };
  return (
    <div className={'ai-bal' + (low ? ' low' : '')}>
      {ed ? <>
        <span>Yüklediğiniz tutar ($):</span>
        <input inputMode="decimal" autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="5" />
        <button type="button" className="btn sm primary" onClick={save}>Kaydet</button>
        <button type="button" className="btn sm ghost" onClick={() => setEd(false)}>Vazgeç</button>
      </> : <>
        <span>{b.budget > 0 ? <>Yapay zekâ bakiyesi: <b>~{left.toFixed(2)} $</b> kaldı <small>({(b.spent || 0).toFixed(2)} $ / {b.budget} $ · {b.n || 0} ürün)</small></> : <>Bakiye takibi kapalı — yüklediğiniz tutarı yazın, azalınca haber verelim</>}</span>
        <button type="button" className="link" onClick={() => setEd(true)}>{b.budget > 0 ? 'Yeni yükleme yaptım' : 'Tutarı yaz'}</button>
      </>}
    </div>
  );
}

export function AiAdd() {
  const S = useStore((s) => s.settings);
  const [q, setQ0] = useState('');
  const [hint, setHint] = useState('');
  const [link, setLink] = useState('');
  const [search, setSearch] = useState(() => ls.get('ai-search', false));
  const [hq, setHq] = useState(() => ls.get('ai-hq', false));
  const [list, setList0] = useState(getQ);
  useEffect(() => { subs.add(setList0); pump(); return () => subs.delete(setList0); }, []);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(false);
  const setList = setQ; const upd = updQ;
  const addNames = () => {
    // satırda link varsa o ürünün kaynağı olur: "2uul da 88 https://…"
    const rows = q.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => { const u = (/https?:\/\/\S+/.exec(x) || [''])[0]; return { n: x.replace(u, '').trim(), u }; }).filter((x) => x.n);
    if (!rows.length) return toast('Ürün adı yazın', 'bad');
    const now = Date.now(); const l0 = link.trim();
    setList((l) => [...rows.map((r, i) => ({ id: now + '-' + i, q: r.n, link: r.u || (rows.length === 1 ? l0 : ''), hint: hint.trim(), search, hq, st: 'wait' })), ...l]);
    setQ0(''); setHint(''); setLink('');
  };
  const waiting = list.filter((x) => x.st === 'wait' || x.st === 'run').length;
  const ready = list.filter((x) => x.st === 'ok').length;

  const draftFor = (x) => ({ ...x.d, n: x.d.n, media: (x.d.imgs || []).map((i) => i.u) });
  return (
    <div className="page ai-add adm-sub">
      <PageHead title="Akıllı ürün ekle" extra={ready ? <span className="muted"> · {ready} hazır</span> : null} />
      <ProductsSwitch on="ai" />
      <BalCard />
      <div className="ai-box">
        <label className="ai-l" htmlFor="ai-q">Ürün adını yazın <small>— her satıra bir ürün</small></label>
        <textarea id="ai-q" rows={3} placeholder={'2uul da 88\njcid v1se face id flex 15 pro'} value={q} onChange={(e) => setQ0(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNames(); }} />
        <input id="ai-link" className="ai-link" placeholder="Ürün linki (isteğe bağlı, önerilir): AliExpress / marka sitesi sayfası — yazıları ve resimleri buradan alır" value={link} onChange={(e) => setLink(e.target.value)} />
        <div className="ai-row">
          <input id="ai-hint" placeholder="Ek bilgi (isteğe bağlı): ör. 5'li paket, iPhone 16 uyumlu" value={hint} onChange={(e) => setHint(e.target.value)} />
          <button type="button" className="btn primary" onClick={addNames}><Icon n="sparkle" s={16} />Hazırla</button>
        </div>
        <label className="ai-chk"><input type="checkbox" checked={search} onChange={(e) => { setSearch(e.target.checked); ls.set('ai-search', e.target.checked); }} /> İnternette de araştırsın <small>— link vermediğiniz ve tanınmayan ürünler için; ürün başına ~1 TL</small></label>
        <label className="ai-chk"><input type="checkbox" checked={hq} onChange={(e) => { setHq(e.target.checked); ls.set('ai-hq', e.target.checked); }} /> Kaliteli mod <small>— daha güçlü yapay zekâ, açıklama daha özenli; ürün başına ~2 TL (normal ~0,1 TL)</small></label>
        <p className="fine">Yapay zekâ ürünü tanır (link verirseniz o sayfayı, 2UUL gibi markalarda markanın sitesini okur); adını sizin yazım tarzınızla, markasını, kategorisini, gizli etiketlerini ve açıklamasını hazırlar, marka sitesinde / AliExpress'te resim arar. Hiçbir şey kendiliğinden kaydedilmez: siz kontrol edip fiyat ve stok girip onaylarsınız.</p>
      </div>

      {list.length > 0 && <div className="ai-list-h"><b>Taslaklar</b>{waiting > 0 && <span className="muted"> · {waiting} hazırlanıyor</span>}
        <button type="button" className="link" onClick={() => setDel(true)}>Hepsini temizle</button></div>}
      {!list.length ? <Empty icon="sparkle" title="Henüz taslak yok"><p>Yukarıya ürün adını yazıp Hazırla'ya basın. Bir ürün yaklaşık 10–60 saniyede hazırlanır.</p></Empty> : (
        <div className="ai-list">
          {list.map((x) => {
            const d = x.d; const cover = d?.imgs?.[0]?.u;
            const menu = (e) => openMenu(e, [
              x.st === 'ok' && { label: 'İncele ve onayla', icon: 'check', onClick: () => setEdit(x) },
              { label: 'Yeniden hazırla', icon: 'sparkle', onClick: () => upd(x.id, { st: 'wait', err: '', d: null, hq: false }) },
              { label: 'Kaliteli modla yeniden hazırla', icon: 'sparkle', hint: '~2 TL', onClick: () => upd(x.id, { st: 'wait', err: '', d: null, hq: true }) },
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
                    <small className="muted">{x.hq ? 'Kaliteli mod · ' : ''}Yazdığınız: “{x.q}”{d.note ? ' · ' + d.note : ''}</small>
                  </> : <>
                    <b>{x.q}</b>
                    <small className={x.st === 'err' ? 'ai-err' : 'muted'}>{x.st === 'run' ? 'Hazırlanıyor…' : x.st === 'wait' ? 'Sırada' : 'Hazırlanamadı: ' + x.err}</small>
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
