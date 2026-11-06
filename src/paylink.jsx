// Ödeme linki (6.11.2026): yönetici tutarı (TL ya da USD) yazar, KDV (kapatılabilir) ve komisyon yüzdesini girer,
// müşteriden çekilecek son TL tutarı anında görür → "Ödeme linki oluştur" → paylinks/{id} + link /o/<id>.
// Müşteri linki açınca sadece ödenecek tutarı ve açıklamayı görür (komisyon kalemi gösterilmez). Kartla ödeme sanal POS
// bağlanana kadar "Yakında" (orders.cardSoon gibi); POS gelince bu sayfaya CardForm + bekçi /pay bağlanacak.
// Hesap: TL = USD × kur (oluşturma anındaki kur linke yazılır, sonradan değişmez) · KDV = TL × %KDV · komisyon = (TL + KDV) × %kom
import { useEffect, useMemo, useState } from 'react';
import { useStore, api, toast, go } from './store.js';
import { PageHead, SubNav, Icon, Toggle, Empty, Confirm, copyText } from './ui.jsx';
import { ls, when } from './utils.js';
import { waLink } from './route.js';
import { useRate } from './listsheet.jsx';
import { CardForm, cardErrors, cardOut, BRAND } from './storepay.jsx';

export const payLink = (id) => `${location.origin}/o/${id}`;
const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
// Türkçe yazımı da anlar: "1.250,50" · "1250,5" · "6.5" · "6,5"
export const parseNum = (s) => {
  let t = String(s ?? '').replace(/[\s₺$%]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t); return isFinite(n) && n > 0 ? n : 0;
};
export const tl2 = (v) => (Number(v) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
const usd2 = (v) => '$' + (Number(v) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => '%' + (Number(v) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

export function plCalc({ amt, cur, rate, vat, com }) {
  const base = r2(cur === 'USD' ? amt * (rate || 0) : amt);
  const vatTL = r2(base * (vat || 0) / 100);
  const comTL = r2((base + vatTL) * (com || 0) / 100);
  return { base, vatTL, comTL, total: r2(base + vatTL + comTL) };
}

const PST = { open: ['Ödeme bekleniyor', 'var(--c-new, #8a919e)'], paid: ['Ödendi', 'var(--c-done, #1f6b47)'], cancel: ['İptal', 'var(--c-cancel, #b3261e)'] };

// ============================================================================================
// Yönetim: /admin/odeme-link
export function PayLinkPage() {
  const live = useRate();
  const lcNew = useStore((st) => (st.lcarts || []).filter((c) => c.status === 'sent' && !c.seen).length);
  const [f, setF] = useState(() => ({ amt: '', cur: ls.get('pl-cur', 'TRY') === 'USD' ? 'USD' : 'TRY', vatOn: ls.get('pl-vaton', true) !== false, vat: String(ls.get('pl-vat', 20)), com: String(ls.get('pl-com', '') || ''), rate: '', title: '', name: '' }));
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v && v.target ? v.target.value : v }));
  const rate = parseNum(f.rate) || live?.usd || 0;
  const amt = parseNum(f.amt), vat = f.vatOn ? parseNum(f.vat) : 0, com = parseNum(f.com);
  const c = plCalc({ amt, cur: f.cur, rate, vat, com });
  const noRate = f.cur === 'USD' && !rate;
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const [list, setList] = useState(null);
  useEffect(() => api().watchPaylinks ? api().watchPaylinks(setList) : setList([]), []);
  const sig = JSON.stringify([amt, f.cur, rate, vat, com, f.title.trim(), f.name.trim()]);
  const stale = made && made.sig !== sig;

  async function make() {
    if (!amt) { toast('Tutar yazın', 'bad'); document.getElementById('pl-amt')?.focus(); return; }
    if (noRate) { toast('Kur yok: kuru elle yazın', 'bad'); return; }
    setBusy(true);
    try {
      ls.set('pl-cur', f.cur); ls.set('pl-vaton', f.vatOn); ls.set('pl-vat', parseNum(f.vat) || 0); ls.set('pl-com', com || '');
      const A = api(); const id = A.newPaylinkId();
      const data = { at: Date.now(), status: 'open', title: f.title.trim().slice(0, 120), name: f.name.trim().slice(0, 80), cur: f.cur, amt, rate: f.cur === 'USD' ? rate : null, vat, com, ...c };
      await A.createPaylink(id, data);
      setMade({ id, link: payLink(id), sig, total: c.total });
      toast('Ödeme linki hazır');
    } catch (e) { toast('Oluşturulamadı: ' + e.message, 'bad'); }
    setBusy(false);
  }
  const reset = () => { setMade(null); setF((x) => ({ ...x, amt: '', title: '', name: '', rate: '' })); setTimeout(() => document.getElementById('pl-amt')?.focus(), 30); };
  const waText = (link, total, title) => `Ödeme linkiniz${title ? ' (' + title + ')' : ''}: ${tl2(total)}\n${link}`;

  return (
    <div className="page oform adm-sub pl-page">
      <PageHead title="Ödeme linki" newLabel={made || f.amt ? 'Yeni ödeme linki' : undefined} onNew={made || f.amt ? reset : undefined} />
      <SubNav label="Form oluştur" items={[
        { k: 'form', icon: 'tag', label: 'Form oluştur', onClick: () => go('siparis') },
        { k: 'link', icon: 'cart', label: 'Sepet linki', badge: lcNew, onClick: () => go('sepetlink') },
        { k: 'pay', icon: 'card', label: 'Ödeme linki', on: true, onClick: () => {} },
      ]} />

      <div className="pl-grid">
        <section className="pl-card pl-form">
          <div className="pl-amt-row">
            <label className="pl-amt" htmlFor="pl-amt">
              <span className="pl-lbl">Tutar</span>
              <span className="pl-amt-in">
                <span className="pl-cur-s" aria-hidden="true">{f.cur === 'USD' ? '$' : '₺'}</span>
                <input id="pl-amt" inputMode="decimal" autoComplete="off" placeholder="0" value={f.amt} onChange={set('amt')} />
              </span>
            </label>
            <span className="seg pl-cur" role="radiogroup" aria-label="Para birimi">
              {[['TRY', '₺ TL'], ['USD', '$ USD']].map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={f.cur === k} className={f.cur === k ? 'on' : ''} onClick={() => set('cur')(k)}>{l}</button>)}
            </span>
          </div>
          {f.cur === 'USD' && (
            <div className="pl-rate">
              <Icon n="refresh" s={14} />
              <span>Kur</span>
              <input inputMode="decimal" aria-label="Kur" placeholder={live?.usd ? live.usd.toLocaleString('tr-TR', { maximumFractionDigits: 4 }) : 'Kuru yazın'} value={f.rate} onChange={set('rate')} />
              <small>{f.rate ? 'elle' : live?.usd ? (live.src === 'manual' ? 'ayarlardaki kur' : 'Harem dolar satış') : 'kur alınamadı'}</small>
            </div>
          )}

          <div className="pl-opt">
            <div className="pl-opt-h">
              <Toggle id="pl-vaton" label="KDV ekle" hint={f.vatOn ? undefined : 'Kapalı: tutara KDV eklenmez (kendiniz hesapladıysanız)'} checked={f.vatOn} onChange={set('vatOn')} />
            </div>
            {f.vatOn && <PctIn id="pl-vat" label="KDV oranı" value={f.vat} onChange={set('vat')} chips={[20, 10, 1]} />}
          </div>
          <div className="pl-opt">
            <PctIn id="pl-com" label="Komisyon" hint="Kart / taksit komisyonu; tutara eklenir" value={f.com} onChange={set('com')} chips={[0, 3, 7, 12.5]} />
          </div>

          <div className="pl-more">
            <label className="field"><span className="field-l">Açıklama <small className="opt">(isteğe bağlı)</small></span><input placeholder="Örn. 2 adet JBC havya ucu" value={f.title} maxLength={120} onChange={set('title')} /></label>
            <label className="field"><span className="field-l">Müşteri adı <small className="opt">(isteğe bağlı)</small></span><input placeholder="Linkte “Sayın …” diye görünür" value={f.name} maxLength={80} onChange={set('name')} /></label>
          </div>
        </section>

        <aside className="pl-card pl-sum" aria-live="polite">
          <h2>Özet</h2>
          <div className="pl-lines">
            <Line l={f.cur === 'USD' ? <>Tutar <small>{usd2(amt)} × {rate ? rate.toLocaleString('tr-TR', { maximumFractionDigits: 4 }) : '—'}</small></> : 'Tutar'} v={tl2(c.base)} />
            <Line l={f.vatOn ? <>KDV <small>{pct(vat)}</small></> : <>KDV <small>kapalı</small></>} v={f.vatOn ? tl2(c.vatTL) : '—'} muted={!f.vatOn} />
            <Line l={<>Komisyon <small>{pct(com)}</small></>} v={tl2(c.comTL)} muted={!com} />
          </div>
          <div className="pl-total">
            <span>Müşteriden çekilecek</span>
            <b className="num">{tl2(c.total)}</b>
            {f.cur === 'USD' && rate > 0 && amt > 0 && <small>≈ {usd2(c.total / rate)}</small>}
          </div>
          {!made || stale ? (
            <>
              {stale && <p className="fine lc-stale">Tutarı değiştirdiniz; önceki link eski tutarla duruyor. Yeni tutar için yeniden oluşturun.</p>}
              <button className="btn primary pl-make" disabled={busy || !amt || noRate} onClick={make}><Icon n="send" s={16} />{busy ? 'Hazırlanıyor…' : 'Ödeme linki oluştur'}</button>
              <p className="fine pl-note"><Icon n="clock" s={14} /> Kartla ödeme sanal POS bağlanınca açılacak; şimdilik müşteri linkte tutarı ve açıklamayı görür.</p>
            </>
          ) : (
            <div className="lc-made">
              <div className="lc-url"><code>{made.link}</code></div>
              <div className="row-btns">
                <a className="btn sm wa" href={waLink('', waText(made.link, made.total, f.title.trim()))} target="_blank" rel="noopener"><Icon n="wa" s={15} />WhatsApp’ta gönder</a>
                <button className="btn sm outline" onClick={() => copyText(made.link, 'Link kopyalandı')}><Icon n="copy" s={15} />Linki kopyala</button>
                <a className="btn sm ghost" href={made.link} target="_blank" rel="noopener"><Icon n="eye" s={15} />Müşteri gibi aç</a>
                <a className="btn sm ghost" href={made.link + '?demo=1'} target="_blank" rel="noopener"><Icon n="card" s={15} />Demo kartla dene</a>
              </div>
            </div>
          )}
        </aside>
      </div>

      <PayLinkList list={list} waText={waText} />
    </div>
  );
}

function Line({ l, v, muted }) { return <div className={'pl-line' + (muted ? ' mut' : '')}><span>{l}</span><b className="num">{v}</b></div>; }

function PctIn({ id, label, hint, value, onChange, chips }) {
  const n = parseNum(value);
  return (
    <div className="pl-pct">
      <label className="pl-pct-l" htmlFor={id}><span>{label}</span>{hint && <small>{hint}</small>}</label>
      <span className="pl-pct-row">
        <span className="pl-chips">{chips.map((x) => <button key={x} type="button" className={'chip' + (n === x ? ' on' : '')} onClick={() => onChange(String(x).replace('.', ','))}>{pct(x)}</button>)}</span>
        <span className="pl-pct-in"><span aria-hidden="true">%</span><input id={id} inputMode="decimal" placeholder="0" value={value} onChange={onChange} /></span>
      </span>
    </div>
  );
}

function PayLinkList({ list, waText }) {
  const [del, setDel] = useState(null);
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('tr-TR');
    return (list || []).filter((x) => !t || [x.title, x.name, x.id].join(' ').toLocaleLowerCase('tr-TR').includes(t));
  }, [list, q]);
  const upd = (x, patch, msg) => api().updatePaylink(x.id, patch).then(() => msg && toast(msg)).catch((e) => toast('Kaydedilemedi: ' + e.message, 'bad'));
  return (
    <section className="pl-list-w">
      <div className="pl-list-h">
        <h2>Gönderilen ödeme linkleri {list?.length ? <span className="muted">· {list.length}</span> : null}</h2>
        {(list?.length || 0) > 6 && <div className="search sm"><Icon n="search" s={16} /><input type="search" placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
      </div>
      {list == null ? <p className="fine">Yükleniyor…</p> : !rows.length ? (q ? <p className="fine">Eşleşen link yok.</p> : <Empty icon="card" title="Henüz ödeme linki yok">Yukarıdan tutarı yazıp ilk linki oluşturun.</Empty>) : (
        <ul className="pl-list">
          {rows.map((x) => {
            const st = PST[x.status] || PST.open; const link = payLink(x.id);
            return (
              <li key={x.id} className={'pl-row st-' + x.status}>
                <span className="pl-row-m">
                  <b>{x.title || x.name || 'Ödeme linki'}</b>
                  <small>{[x.title && x.name, when(x.at), x.cur === 'USD' ? usd2(x.amt) : null, x.vat ? 'KDV ' + pct(x.vat) : 'KDV yok', x.com ? 'kom. ' + pct(x.com) : null].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="pl-row-r">
                  <b className="num">{tl2(x.total)}</b>
                  <span className="pill st-pill" style={{ '--t': st[1] }}><i className="st-pill-d" />{st[0]}</span>
                </span>
                <span className="pl-row-a">
                  <button className="btn xs ghost" onClick={() => copyText(link, 'Link kopyalandı')} aria-label="Linki kopyala" title="Linki kopyala"><Icon n="copy" s={15} /></button>
                  <a className="btn xs ghost" href={waLink('', waText(link, x.total, x.title))} target="_blank" rel="noopener" aria-label="WhatsApp’ta gönder" title="WhatsApp’ta gönder"><Icon n="wa" s={15} /></a>
                  {x.status === 'open' && <button className="btn xs ghost" onClick={() => upd(x, { status: 'paid', paidAt: Date.now() }, 'Ödendi olarak işaretlendi')}><Icon n="check" s={15} /><span>Ödendi</span></button>}
                  {x.status !== 'open' && <button className="btn xs ghost" onClick={() => upd(x, { status: 'open' }, 'Yeniden açıldı')}><Icon n="undo" s={15} /><span>Geri al</span></button>}
                  {x.status === 'open' && <button className="btn xs ghost" onClick={() => upd(x, { status: 'cancel' }, 'İptal edildi')}><Icon n="x" s={15} /><span>İptal</span></button>}
                  <button className="btn xs ghost danger" onClick={() => setDel(x)} aria-label="Sil" title="Sil"><Icon n="trash" s={15} /></button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {del && <Confirm title="Ödeme linki silinsin mi?" text="Link açılmaz olur. Bu işlem geri alınamaz." okLabel="Sil" tone="danger" onClose={() => setDel(null)} onOk={() => { api().deletePaylink(del.id).then(() => toast('Silindi')).catch((e) => toast('Silinemedi: ' + e.message, 'bad')); setDel(null); }} />}
    </section>
  );
}

// ============================================================================================
// Müşteri: /o/<id>
export function PayLinkView({ id }) {
  const S = useStore((s) => s.settings);
  const [p, setP] = useState(undefined);
  useEffect(() => {
    let on = true;
    api().getPaylink(id).then((x) => on && setP(x)).catch(() => on && setP(null));
    return () => { on = false; };
  }, [id]);
  const shop = S.brand?.appName || 'ERTEL GSM';
  const wa = S.shop?.whatsapp;
  if (p === undefined) return <div className="page pl-view"><div className="pl-vcard pl-load"><span className="spin" /><p className="fine">Ödeme bilgisi yükleniyor…</p></div></div>;
  if (!p) return <div className="page pl-view"><div className="pl-vcard"><Empty icon="card" title="Ödeme linki bulunamadı">Link hatalı ya da silinmiş olabilir. {wa ? 'Bize WhatsApp’tan yazabilirsiniz.' : ''}</Empty>{wa && <a className="btn wa" href={waLink(wa, 'Merhaba, ödeme linkim açılmıyor.')} target="_blank" rel="noopener"><Icon n="wa" s={17} />WhatsApp’tan yazın</a>}</div></div>;
  const paid = p.status === 'paid', cancel = p.status === 'cancel';
  if (DEMO_PAY && !paid && !cancel) return <div className="page pl-view"><DemoPay p={p} shop={shop} /></div>;
  return (
    <div className="page pl-view">
      <div className={'pl-vcard' + (paid ? ' paid' : cancel ? ' cancel' : '')}>
        <span className="pl-v-ic"><Icon n={paid ? 'check' : cancel ? 'x' : 'card'} s={22} /></span>
        <p className="pl-v-k">{shop} · Ödeme talebi</p>
        {p.name && <p className="pl-v-name">Sayın {p.name}</p>}
        {p.title && <h1 className="pl-v-t">{p.title}</h1>}
        <div className="pl-v-amt">
          <span>{paid ? 'Ödenen tutar' : cancel ? 'Tutar' : 'Ödenecek tutar'}</span>
          <b className="num">{tl2(p.total)}</b>
          <small>{p.vat ? 'KDV dahil' : 'Türk lirası'}</small>
        </div>
        {paid ? <p className="pl-v-st ok"><Icon n="check" s={16} />Bu ödeme alındı, teşekkür ederiz.</p>
          : cancel ? <p className="pl-v-st bad"><Icon n="x" s={16} />Bu ödeme linki iptal edildi.</p>
          : <>
            <button className="btn primary pl-v-pay" disabled><Icon n="card" s={17} />Kartla öde<span className="pl-soon">Yakında</span></button>
            <p className="fine pl-v-note">Kart ile ödeme çok yakında bu sayfada açılacak. Şimdilik ödeme için bize ulaşabilirsiniz.</p>
            {wa && <a className="btn outline pl-v-wa" href={waLink(wa, `Merhaba, ${tl2(p.total)} tutarındaki ödeme linkim${p.title ? ' (' + p.title + ')' : ''} için yazıyorum.`)} target="_blank" rel="noopener"><Icon n="wa" s={17} />WhatsApp’tan yazın</a>}
          </>}
        <p className="pl-v-f"><Icon n="shield" s={14} />{when(p.at)} tarihinde oluşturuldu · Ref. {String(p.id || id).slice(0, 6).toUpperCase()}</p>
      </div>
    </div>
  );
}

// ============================================================================================
// Demo kartla ödeme (sadece ?demo=1 ile açılan linkte; müşteriye giden linkte YOK): kart formu → 3D doğrulama → sonuç.
// Hiçbir şey kaydedilmez, kart bilgisi hiçbir yere gönderilmez. Sanal POS bağlanınca aynı akış bekçi + banka sayfasıyla çalışacak.
const DEMO_PAY = (() => { try { return new URLSearchParams(location.search).has('demo'); } catch { return false; } })();
function DemoPay({ p, shop }) {
  const [step, setStep] = useState('sum'); // sum → card → 3d → done
  const [card, setCard] = useState({ num: '', name: '', exp: '', cvv: '', n: 1 });
  const [err, setErr] = useState({});
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const out = cardOut(card);
  const go3d = () => {
    const e = cardErrors(card); setErr(e);
    if (Object.keys(e).length) { document.getElementById(Object.keys(e)[0].replace(/^c/, 'co-c'))?.focus(); return; }
    setBusy(true); setTimeout(() => { setBusy(false); setStep('3d'); }, 700);
  };
  const confirm3d = () => { if (code.length < 6) return; setBusy(true); setTimeout(() => { setBusy(false); setStep('done'); }, 900); };
  return (
    <div className="pl-vcard pl-demo">
      <span className="pl-demo-tag"><Icon n="shield" s={13} />Demo · gerçek çekim yapılmaz, hiçbir şey kaydedilmez</span>
      {step === 'done' ? <>
        <span className="pl-v-ic ok"><Icon n="check" s={24} /></span>
        <p className="pl-v-k">{shop} · Ödeme</p>
        <h1 className="pl-v-t">Ödemeniz alındı</h1>
        <div className="pl-v-amt"><span>Çekilen tutar</span><b className="num">{tl2(p.total)}</b><small>{BRAND[out.brand] || 'Kart'} •••• {out.last4} · Tek çekim</small></div>
        <p className="fine">Gerçekte bu adımda bankadan onay gelir, link "Ödendi" olur ve size Telegram + panel bildirimi düşer. Demoda bunların hiçbiri yapılmadı.</p>
        <button className="btn outline pl-v-wa" onClick={() => { setStep('sum'); setCode(''); }}><Icon n="undo" s={16} />Baştan dene</button>
      </> : step === '3d' ? <>
        <div className="pl-3d">
          <div className="pl-3d-h"><b>Demo Bank</b><span>3D Secure</span></div>
          <p>Ödeme tutarı <b className="num">{tl2(p.total)}</b><br /><small>{shop} · {BRAND[out.brand] || 'Kart'} •••• {out.last4}</small></p>
          <p className="fine">Telefonunuza gelen 6 haneli doğrulama kodunu girin. <b>Demo:</b> herhangi 6 rakam yazın.</p>
          <input className="pl-3d-in" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
          <button className="btn primary pl-v-pay" disabled={busy || code.length < 6} onClick={confirm3d}>{busy ? 'Doğrulanıyor…' : 'Onayla'}</button>
          <button className="btn ghost sm" onClick={() => setStep('card')}>Vazgeç</button>
        </div>
        <p className="fine pl-3d-n">Bu ekran gerçekte bankanın kendi sayfasıdır; kart bilgisi bize değil bankaya gider.</p>
      </> : <>
        <p className="pl-v-k">{shop} · Ödeme talebi</p>
        {p.name && <p className="pl-v-name">Sayın {p.name}</p>}
        {p.title && <h1 className="pl-v-t">{p.title}</h1>}
        <div className="pl-v-amt"><span>Ödenecek tutar</span><b className="num">{tl2(p.total)}</b><small>{p.vat ? 'KDV dahil' : 'Türk lirası'}</small></div>
        {step === 'sum'
          ? <button className="btn primary pl-v-pay" onClick={() => setStep('card')}><Icon n="card" s={17} />Kartla öde</button>
          : <div className="pl-cardw">
            <CardForm card={card} setCard={setCard} inc={p.total} list={[]} err={err} />
            <button className="btn primary pl-v-pay" disabled={busy} onClick={go3d}><Icon n="shield" s={17} />{busy ? 'Bankaya bağlanılıyor…' : 'Öde · ' + tl2(p.total)}</button>
            <p className="fine pl-v-note">Deneme kartı: 4111 1111 1111 1111 · ileri bir tarih · herhangi 3 rakam</p>
          </div>}
      </>}
    </div>
  );
}
