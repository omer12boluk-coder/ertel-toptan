// Akıllı ürün ekle (6.11.2026): yönetici ürün adını yazar → bekçi yapay zekâyla ad / marka / kategori / etiket / açıklama
// hazırlar, markanın sitesinde, AliExpress'te vb. resim arar. Ürün KAYDEDİLMEZ: taslak yöneticinin ekranına döner,
// o kontrol edip fiyat + stok girip onaylar.
//  · ANTHROPIC_KEY gizli ayarı varsa: Claude + web araması (en iyi sonuç; ürün başına birkaç sent)
//  · yoksa: Cloudflare Workers AI (ücretsiz kota; web araması yok, sadece marka sitesinden resim)
// Uç noktalar (hepsi yönetici oturumu ister):
//  POST /ai/draft {name, cats:[[id,yol]], brands:[], ex:[{n,t,d}], shops:{MARKA:alan}} → {ok, draft}
//  POST /ai/pics  {url} → {ok, imgs:[adres]}  (yapıştırılan sayfadan resimler)
//  GET  /ai/pic?u=<resim adresi> → resmin kendisi (tarayıcı CORS'a takılmadan R2'ye yüklemek için)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
// Sadece yönetici 'Hazırla'ya basınca çalışır (zamanlanmış/otomatik sorgu YOK). Para yakmasın diye sınır:
const DAY_LIMIT = 20, MONTH_LIMIT = 60;

// Bilinen marka mağazaları (çoğu Shopify: /search/suggest.json + /products/<ad>.js ile resimler temiz gelir)
// (diğerleri panelden: Ayarlar › Akıllı ürün ekle › Marka siteleri)
const SHOPS = { '2UUL': 'www.2uul.com' }; // 6.11.2026: 2uul.com (www'suz) HİÇ cevap vermiyor, www şart

// Bakiye takibi: Anthropic bakiyeyi dışarı vermiyor → harcamayı kendimiz sayarız (cevaptaki token + arama sayısı × fiyat).
// Yönetici yüklediği tutarı sayfaya yazar (/ai/bal); %80'i harcanınca ve bakiye bitti hatası gelince Telegram + panel bildirimi.
// KV 'aibal' = {budget, spent, w80, w100} — sadece taslak hazırlanınca yazılır (ayda birkaç kez).
const PRICE = { haiku: [0.1, 0.5], sonnet: [2, 10], opus: [4, 20] }; // $ / milyon token (Kasım 2026)
const costOf = (model, u = {}) => { const p = PRICE[Object.keys(PRICE).find((k) => model.includes(k)) || 'sonnet']; return ((u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) * 0.1) * p[0] / 1e6 + (u.output_tokens || 0) * p[1] / 1e6 + (u.server_tool_use?.web_search_requests || 0) * 0.01; };
const getBal = async (env) => JSON.parse((await env.KV.get('aibal')) || '{}');
async function spend(env, usd, notify) {
  const b = await getBal(env); b.spent = +((b.spent || 0) + usd).toFixed(4); b.n = (b.n || 0) + 1;
  let msg = null;
  if (b.budget > 0 && !b.w80 && b.spent >= b.budget * 0.8) { b.w80 = 1; msg = `Yapay zekâ bakiyesi azaldı: yüklenen ${b.budget} $'ın yaklaşık ${b.spent.toFixed(2)} $'ı harcandı. console.anthropic.com › Billing'den yükleyebilirsiniz.`; }
  await env.KV.put('aibal', JSON.stringify(b));
  if (msg) await notify('⚠️ Yapay zekâ bakiyesi azaldı', msg);
}
async function outOfCredit(env, notify) {
  const b = await getBal(env); if (b.w100 && Date.now() - b.w100 < 86400000) return; // günde en çok 1 kez
  b.w100 = Date.now(); await env.KV.put('aibal', JSON.stringify(b));
  await notify('⛔ Yapay zekâ bakiyesi bitti', 'Akıllı ürün ekle çalışmıyor: Anthropic bakiyesi bitti. console.anthropic.com › Billing › Buy credits ile yükleyin, sonra panelde Akıllı ekle › Bakiye’ye yüklediğiniz tutarı yazın.');
}

// Yönetici kontrolü Firestore'dan 1 okuma (users/<uid>). Onayda her resim için /ai/pic çağrılır → aynı oturum anahtarını
// bellekte 30 dk hatırla, Firebase okuma kotası (Spark 50 bin/gün) boşuna yenmesin.
const okTok = new Map();
export async function aiRoute(req, env, url, adminOf, json, notify = async () => {}) {
  const tok = (req.headers.get('Authorization') || '').slice(-64);
  if (!(okTok.get(tok) > Date.now())) {
    const err = await adminOf(req); if (err) return json({ ok: false, error: err }, 403);
    if (okTok.size > 50) okTok.clear(); okTok.set(tok, Date.now() + 30 * 60000);
  }
  if (url.pathname === '/ai/pic' && req.method === 'GET') return picProxy(url.searchParams.get('u') || '');
  const b = await req.json().catch(() => ({}));
  if (url.pathname === '/ai/bal') {
    const cur = await getBal(env);
    if (b.budget != null) { const v = Math.max(0, Number(b.budget) || 0); const nb = { budget: v, spent: 0, n: 0, at: Date.now() }; await env.KV.put('aibal', JSON.stringify(nb)); return json({ ok: true, bal: nb }); }
    return json({ ok: true, bal: cur });
  }
  if (url.pathname === '/ai/pics') return json({ ok: true, imgs: await pageImages(String(b.url || '')) });
  if (url.pathname === '/ai/draft') {
    const day = new Date().toISOString().slice(0, 10); const ck = 'aiday:' + day, mk = 'aimon:' + day.slice(0, 7);
    const used = Number((await env.KV.get(ck)) || 0), mon = Number((await env.KV.get(mk)) || 0);
    if (used >= DAY_LIMIT) return json({ ok: false, error: `Bugünkü sınır doldu (${DAY_LIMIT} ürün). Yarın tekrar deneyin.` });
    if (mon >= MONTH_LIMIT) return json({ ok: false, error: `Bu ayın sınırı doldu (${MONTH_LIMIT} ürün).` });
    await env.KV.put(ck, String(used + 1), { expirationTtl: 172800 });
    await env.KV.put(mk, String(mon + 1), { expirationTtl: 40 * 86400 });
    try { const draft = await makeDraft(env, b); if (draft._cost) { await spend(env, draft._cost, notify); draft.cost = +draft._cost.toFixed(4); delete draft._cost; } return json({ ok: true, draft, left: Math.min(DAY_LIMIT - used, MONTH_LIMIT - mon) - 1 }); }
    catch (e) {
      if (e.cost) await spend(env, e.cost, notify).catch(() => {});
      const m = String(e.message || e);
      if (/credit balance|billing|insufficient/i.test(m)) { await outOfCredit(env, notify); return json({ ok: false, error: 'Yapay zekâ bakiyesi bitti. console.anthropic.com › Billing’den yükleyin.' }); }
      return json({ ok: false, error: m.slice(0, 300) });
    }
  }
  return json({ ok: false, error: 'bulunamadı' }, 404);
}

export const aiStatus = (env) => (env.ANTHROPIC_KEY ? 'claude' : env.AI ? 'cf' : '');

// ---------------------------------------------------------------- taslak
async function makeDraft(env, b) {
  const name = String(b.name || '').trim().slice(0, 200);
  if (!name) throw new Error('Ürün adı boş');
  const cats = (Array.isArray(b.cats) ? b.cats : []).slice(0, 400);
  const brands = (Array.isArray(b.brands) ? b.brands : []).slice(0, 400);
  const ex = (Array.isArray(b.ex) ? b.ex : []).slice(0, 3);
  const vocab = (Array.isArray(b.vocab) ? b.vocab : []).slice(0, 4).map((x) => String(x).slice(0, 1000));
  const shops = { ...SHOPS, ...(b.shops || {}) };
  const search = !!b.search;
  // ÜCRETSİZ kaynaklar önce: marka mağazası (addaki marka biliniyorsa) + yöneticinin yapıştırdığı ürün linki
  const up = name.toUpperCase();
  const link = /^https?:\/\//.test(b.link || '') ? String(b.link).trim() : '';
  // Verilen link tek ürün sayfası değilse (ör. sadece "2uul.com" ya da bir kategori sayfası) o siteyi MAĞAZA say:
  // sitenin kendi aramasında ürünü bul (Shopify); sayfanın her yerinden resim TOPLAMA (saçma resimler geliyordu).
  // DİKKAT: site adresi olduğu gibi (www dahil) kullanılır — bazı siteler www'suz adrese cevap vermiyor (2uul.com)
  const linkShop = link && !isProductUrl(link) ? new URL(link).hostname : '';
  const shopKey = Object.keys(shops).find((k) => up.includes(k) || (linkShop && host('https://' + shops[k]) === host(link)));
  const shopDom = linkShop || (shopKey && shops[shopKey]) || '';
  const model0 = (shopKey ? up.replace(shopKey, '') : up).trim();
  let [shop, linked] = await Promise.all([
    shopDom ? shopifyProduct(shopDom, model0 || name, name).catch(() => null) : null,
    link && !linkShop ? pageInfo(link).catch(() => null) : null,
  ]);
  // Shopify olmayan site (martview vb.): sitenin kendi arama sayfasında ürünü bul → o ürün sayfasını oku (ücretsiz, yapay zekâ yok)
  let found = '';
  if (linkShop && !shop) { found = await siteSearch(link, model0 || name, name).catch(() => ''); if (found) linked = await pageInfo(found).catch(() => null); }
  const linkSrc = found || link;
  const ctx = [shop && `Markanın resmi sitesindeki ürün (${shopDom}): ${shop.title}\n${shop.text}`, linked && `Ürün sayfası (${host(linkSrc)}): ${linked.title}\n${linked.text}`].filter(Boolean).join('\n\n');
  const prompt = buildPrompt(name, cats, brands, ex, String(b.hint || ''), vocab, ctx, search);
  let out, sources = [], engine, cost = 0;
  if (env.ANTHROPIC_KEY) { engine = b.hq ? 'claude-hq' : 'claude'; ({ out, sources, cost } = await askClaude(env, prompt, search, !!b.hq)); }
  else if (env.AI) { engine = 'cf'; out = await askCf(env, prompt); }
  else throw new Error('Yapay zekâ bağlı değil: GitHub › Settings › Secrets’a ANTHROPIC_KEY ekleyip “Bekçiyi yayınla”yı çalıştırın.');
  let d = parseJson(out);
  if (!d && env.ANTHROPIC_KEY && out) {
    // cevap bozuksa: aramasız, ucuz modelle sadece biçimi düzelttir (ürün başına ~0,01 TL)
    const fix = await askClaude(env, 'Aşağıdaki metni, içindeki bilgileri DEĞİŞTİRMEDEN istenen biçime çevir. Sadece şu iki parçayı yaz:\n<json>{"name":"","brand":"","model":"","cat":0,"cat2":null,"tags":[],"pages":[],"note":""}</json>\n<desc>HTML</desc>\n\nMETİN:\n' + out.slice(-20000), false, false).catch(() => null);
    if (fix) { cost += fix.cost || 0; d = parseJson(fix.out); }
  }
  if (!d) { const e = new Error('Yapay zekâ cevabı okunamadı, tekrar deneyin'); e.cost = cost; throw e; }
  const brand = String(d.brand || '').trim();
  // resimler: 1) marka mağazası 2) yapay zekânın bulduğu ürün sayfaları 3) aramada çıkan sayfalar
  if (found) sources.unshift({ url: found, title: host(found) });
  const pages = [...new Set([...(d.pages || []), ...sources.map((s) => s.url)].filter((u) => /^https?:\/\//.test(u)))].slice(0, 8);
  const imgs = [];
  const add = (arr, from) => arr.forEach((u) => { if (!imgs.some((x) => x.u === u) && imgs.length < 14) imgs.push({ u, from }); });
  if (shop) add(shop.imgs, shopDom);
  if (linked) add(linked.imgs, host(linkSrc));
  const dom = shops[brand.toUpperCase()];
  if (dom && !shop) { const sp = await shopifyProduct(dom, d.model || name, name).catch(() => null); if (sp) add(sp.imgs, dom); }
  // aramada bulunan sayfalar: sadece ürün galerisi (AliExpress listesi, Shopify, JSON-LD Product) — og:image / sayfadaki
  // rastgele resimler ALINMAZ (reklam, rozet, site logosu geliyordu). Yöneticinin linki ve marka sitesi bunun dışında.
  const got = await Promise.all(pages.map((p) => pageImages(p, true).then((l) => [p, l]).catch(() => [p, []])));
  for (const [p, l] of got) add(l.slice(0, 6), host(p));
  // açıklamanın altına markanın / sayfanın uzun tanıtım görselleri (yöneticinin elle yaptığı gibi), sırasıyla
  const descImgs = [...new Set([...(shop?.descImgs || []), ...(linked?.descImgs || [])])].slice(0, 20);
  let desc = cleanDesc(String(d.desc || ''));
  if (descImgs.length) desc += '\n<p>&nbsp;</p>\n' + descImgs.map((u) => `<img loading="lazy" src="${u}" />`).join('\n');
  return {
    q: name, engine: engine + (search ? '+ara' : ''), descImgs: descImgs.length, _cost: cost,
    n: String(d.name || name).trim(), b: brand, model: d.model || '',
    c: Number.isFinite(+d.cat) ? +d.cat : null, c2: Number.isFinite(+d.cat2) && d.cat2 !== null && d.cat2 !== '' ? +d.cat2 : null,
    t: (Array.isArray(d.tags) ? d.tags : String(d.tags || '').split(',')).map((x) => String(x).trim()).filter(Boolean).slice(0, 90).join(','),
    desc, note: String(d.note || '').slice(0, 400),
    imgs, src: [...new Map([...pages.map((u) => [u, { url: u, title: host(u) }]), ...sources.map((s) => [s.url, s])]).values()].slice(0, 10),
  };
}

function buildPrompt(name, cats, brands, ex, hint, vocab = [], ctx = '', search = false) {
  const exTxt = ex.map((e, i) => `ÖRNEK ${i + 1}\nAd: ${e.n}\nEtiketler: ${e.t}\nAçıklama HTML:\n${String(e.d || '').slice(0, 1800)}`).join('\n\n');
  return `Sen ERTEL GSM'in (İstanbul Tahtakale, cep telefonu tamir ekipmanı ve yedek parça toptancısı) ürün giriş asistanısın.
Yönetici şu ürünü eklemek istiyor: "${name}"${hint ? `\nEk bilgi: ${hint}` : ''}

Görevin:
1) ${search ? "Ürünü web'de araştır (önce markanın resmi sitesi, sonra AliExpress, Alibaba, martview, mobilesentrix vb.); en fazla 2 arama yap." : 'Web araması YOK: aşağıdaki kaynak metinlere ve kendi bilgine dayan.'} Doğru modeli bul; emin olmadığın teknik değeri UYDURMA, yazma (not alanında belirt).${ctx ? `\n\nKAYNAK METİNLER (otomatik bulundu; yazılan ürünle AYNI model değilse dikkate alma):\n${ctx}\n` : ''}
2) Mağazanın ad yazım tarzıyla Türkçe ürün adı yaz (Marka büyük harf + Model + Türkçe ne olduğu; gerekirse parantez içinde uyumlu model / paket bilgisi). Örneklerdeki gibi.
3) Marka: listede varsa AYNI yazımla seç, yoksa resmi yazımı büyük harfle.
4) Kategori: aşağıdaki listeden en uygun kategori numarasını (cat) ve varsa ikinci kategoriyi (cat2, yoksa null) seç.
5) Gizli arama etiketleri (tags): örneklerdeki tarzda 35-60 etiket. Her kelimenin ilk harfi büyük. Sırayla: marka ve model yazım çeşitleri (birleşik, boşluklu, tireli: Pw35, Pw 35, Pw-35), Türkçe ürün adları ve eş anlamlıları, Türkçe karaktersiz yazımları (Hoparlör/Hoparlor), İngilizce adları, uyumlu cihaz modelleri, ölçüler, "… Fiyat", sonra 4-6 adet soru şeklinde uzun arama cümlesi (… Nasıl …, … Ne İşe Yarar), en sonda "<Marka> <Model> Türkiye Satıcısı". Etiketlerde virgül olmasın.
   ÇOK ÖNEMLİ — müşteriler aramada ürünü yanlış / halk ağzıyla / argo adıyla yazıyor. Etiketlerin en az üçte biri bunlara ayrılsın:
   · tamirci argosu ve halk ağzı adlar (ör. sıvı lehim → Çamur Lehim, Krem Lehim, Macun Lehim, Lehim Pastası; flux → Flaks, Fluks, Lehim Yağı; lehim teli → Tel Lehim; ısı tabancası → Sıcak Hava, Hava Tabancası, Fön),
   · Türkçe karaktersiz ve yanlış harfli yazımlar (ş→s, ı→i, ö→o, ü→u, ğ→g, ç→c; harf atlama/çiftleme/yer değiştirme: Lehm, Leihm, Mikroskop→Mikroskob/Mikroskp),
   · İngilizcenin kulaktan yazımı (Flux→Flaks, Solder→Soldır, Screen→Sikrin, Booster→Buster), birleşik/ayrık yazım,
   · model kodunun hatalı yazımları (DA88 → Da 88, Da-88, D88, Da8, Daa88).
   Aşağıdaki "mevcut etiket sözlüğü"nde mağazanın zaten kullandığı yanlış yazım ve argo kalıpları varsa bunları da kullan.
6) Açıklama (desc): örneklerdeki HTML yapısıyla, Türkçe, satış dili sade ve teknisyene hitap eden: 2 kısa paragraf (<p dir="ltr">), <p dir="ltr"><strong>Özellikler</strong></p> + <ul dir="ltr"><li>…</li></ul>, <p dir="ltr"><strong>Teknik Özellikler</strong></p> + <table><thead><tr><th scope="col">Özellik</th><th scope="col">Değer</th></tr></thead><tbody>…</tbody></table>, biliniyorsa <p dir="ltr"><strong>Kutu İçeriği</strong></p> + liste. Resim, video, link, iframe KOYMA (tanıtım resimlerini sistem kendisi açıklamanın altına ekler).
7) pages: ${search ? 'ürünün resimlerinin bulunduğu EN İYİ 1-4 tek ürün sayfası adresi (arama/kategori sayfası değil).' : 'boş liste [] bırak.'}

Kategori listesi (numara: yol):
${cats.map(([id, p]) => `${id}: ${p}`).join('\n')}

Mevcut markalar: ${brands.join(', ')}
${vocab.length ? `\nMevcut etiket sözlüğü (benzer ürünlerden; tarz ve yanlış yazım kalıpları için):\n${vocab.map((v, i) => `${i + 1}) ${v}`).join('\n')}\n` : ''}

${exTxt}

Cevabını TAM OLARAK şu iki parça hâlinde ver, başka açıklama yazma:
<json>{"name":"…","brand":"…","model":"…","cat":0,"cat2":null,"tags":["…"],"pages":["https://…"],"note":"emin olmadığın şeyler / yöneticiye kısa not"}</json>
<desc>açıklamanın HTML'i buraya (JSON'un içine KOYMA)</desc>`;
}

// Ucuz mod (varsayılan): Haiku, web araması yok. 'İnternette araştır' seçilirse en çok 2 arama.
// Kaliteli mod (hq): Sonnet — ürün başına ~20 kat pahalı, sadece seçilince
async function askClaude(env, prompt, search, hq) {
  const model = hq ? env.AI_MODEL_HQ || 'claude-sonnet-5-5' : env.AI_MODEL || 'claude-haiku-5-5';
  const tools = search ? [{ type: env.AI_SEARCH_TOOL || 'web_search_20250305', name: 'web_search', max_uses: 2 }] : undefined;
  let messages = [{ role: 'user', content: prompt }];
  const sources = []; let text = '', cost = 0;
  for (let turn = 0; turn < 4; turn++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 10000, ...(tools ? { tools } : {}), messages }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Claude: ' + (j.error?.message || r.status));
    cost += costOf(model, j.usage);
    for (const c of j.content || []) {
      if (c.type === 'text') text += c.text;
      if (c.type === 'web_search_tool_result' && Array.isArray(c.content)) c.content.forEach((x) => x.url && sources.push({ url: x.url, title: x.title || host(x.url) }));
    }
    if (j.stop_reason !== 'pause_turn') break;
    messages = [...messages, { role: 'assistant', content: j.content }];
  }
  return { out: text, sources: sources.slice(0, 20), cost };
}

async function askCf(env, prompt) {
  const r = await env.AI.run(env.CF_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [{ role: 'system', content: 'Web araması yapamıyorsun; ürünü bilgin ve addaki ipuçlarıyla tanımla, bilmediğin teknik değeri yazma. pages alanına bildiğin resmi ürün sayfası adresini yaz, bilmiyorsan boş bırak.' }, { role: 'user', content: prompt }],
    max_tokens: 4000,
  });
  return r.response || '';
}

function parseJson(s) {
  const m = /<json>([\s\S]*?)<\/json>/.exec(s) || /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  let raw = (m ? m[1] : s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)).trim();
  let d = null;
  try { d = JSON.parse(raw); } catch {
    // sık bozulmalar: sondaki virgül, akıllı tırnak, kod bloğu işaretleri
    try { d = JSON.parse(raw.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"').replace(/^```\w*|```$/g, '')); } catch {}
  }
  if (!d) return null;
  const dm = /<desc>([\s\S]*?)(<\/desc>|$)/.exec(s);
  if (dm && dm[1].trim()) d.desc = dm[1].trim();
  return d;
}
const cleanDesc = (h) => h.replace(/<(script|iframe|style)[\s\S]*?<\/\1>/gi, '').replace(/<img[^>]*>/gi, '').replace(/\son\w+="[^"]*"/gi, '').trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// ---------------------------------------------------------------- resim bulma
async function get(u, ms = 25000) {
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(String(r.status));
  return r;
}
const abs = (u, base) => { try { const x = new URL(u.replace(/&amp;/g, '&'), base); return x.protocol.startsWith('http') ? x.href : null; } catch { return null; } };
// küçük resim adresi → büyüğü: AliExpress x.jpg_350x350.jpg → x.jpg · Shopify x_1024x.jpg → x.jpg
const big = (u) => (/(\.(jpe?g|png|webp))_[^/]+$/i.test(u) ? u.replace(/(\.(jpe?g|png|webp))_[^/]+$/i, '$1') : u.replace(/_(\d+x\d*|\d*x\d+|small|medium|thumb|compact)(?=\.(jpe?g|png|webp))/i, ''));
const okImg = (u) => u && /^https?:/.test(u) && !/(logo|icon|sprite|favicon|avatar|placeholder|badge|flag|payment|\.svg|\.gif)/i.test(u);

const strip = (h) => String(h || '').replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|li|tr|h\d|div)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
// Bilinen arama adresleri; bilinmeyen sitede ana sayfadaki arama formundan bulunur, olmazsa yaygın kalıplar denenir
const SEARCH_URL = { 'martview.com': (q) => `https://www.martview.com/products?search=${encodeURIComponent(q)}` };
async function siteSearch(site, q, full) {
  const o = new URL(site); const h = o.hostname.replace(/^www\./, '');
  const tries = [];
  if (SEARCH_URL[h]) tries.push(SEARCH_URL[h](q));
  else {
    try {
      const home = (await (await get(o.origin + '/')).text()).slice(0, 1e6);
      for (const f of home.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi)) {
        const inp = /<input[^>]+name=["'](q|s|search|keyword|keywords|query|k|searchword|search_query|filter_name)["']/i.exec(f[1]); if (!inp) continue;
        const act = /action=["']([^"']*)["']/i.exec(f[0])?.[1] || '/';
        const u = new URL(act.replace(/&amp;/g, '&'), o.origin); u.searchParams.set(inp[1], q); tries.push(u.href); break;
      }
    } catch {}
    tries.push(`${o.origin}/search?q=${encodeURIComponent(q)}`, `${o.origin}/?s=${encodeURIComponent(q)}&post_type=product`, `${o.origin}/products?search=${encodeURIComponent(q)}`, `${o.origin}/catalogsearch/result/?q=${encodeURIComponent(q)}`);
  }
  for (const t of tries.slice(0, 3)) {
    let html; try { html = (await (await get(t)).text()).slice(0, 1.5e6); } catch { continue; }
    // sonuç sayfasındaki aynı siteye ait bağlantılardan, model kodu geçen ilk ürün sayfası
    for (const m of html.matchAll(/<a\b[^>]*?href=["']([^"'#]+)["'][^>]*>/gi)) {
      const u = abs(m[1].replace(/&amp;/g, '&'), t); if (!u || new URL(u).hostname.replace(/^www\./, '') !== h) continue;
      if (/search|[?&](pg|page)=/.test(u) || !isProductUrl(u)) continue;
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 800);
      const label = strip(after.split(/<\/a>/i)[0]) + ' ' + (/title=["']([^"']+)/i.exec(m[0])?.[1] || '') + ' ' + u;
      if (strongMatch(label, q) || strongMatch(label, full)) return u.split('#')[0];
    }
  }
  return '';
}
// Tek ürün sayfası mı? (Shopify /products/, AliExpress /item/, genel /product/ /urun/ ...)
function isProductUrl(u) { try { const p = new URL(u).pathname.toLowerCase(); if (/wholesale|search|arama|categor|kategori|collections?\/?$|\/c\/|\/w\//.test(p)) return false; return /\/(products?|item|items|urun|p)\/[^/]+|[-_/]p-?\d{3,}|\.html?$/.test(p) && p.length > 3; } catch { return false; } }
// Model kodu eşleşiyor mu: "da07" ↔ "DA-07", "DA07 Pro" ...; addaki rakamlı kelimelerin hepsi başlıkta geçmeli
const flat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function sameModel(title, q) {
  const codes = String(q || '').toLowerCase().split(/[\s,/]+/).map(flat).filter((w) => /\d/.test(w) && w.length >= 2);
  if (!codes.length) return true;
  const t = flat(title); return codes.every((c) => t.includes(c));
}
// Site aramasında: model kodu varsa o eşleşmeli; kod yoksa addaki kelimelerin çoğu (≥%70) bağlantı yazısında geçmeli
function strongMatch(label, q) {
  const words = String(q || '').toLowerCase().split(/[\s,/]+/).map(flat).filter((w) => w.length >= 3);
  if (words.some((w) => /\d/.test(w))) return sameModel(label, q);
  if (!words.length) return false;
  const t = flat(label); return words.filter((w) => t.includes(w)).length / words.length >= 0.7;
}
async function shopifyProduct(dom0, q, full) {
  // www'lu / www'suz: hangisi cevap verirse
  let dom = dom0, s;
  for (const d of [dom0, dom0.startsWith('www.') ? dom0.slice(4) : 'www.' + dom0]) {
    try { s = await (await get(`https://${d}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=6`)).json(); dom = d; break; } catch {}
  }
  if (!s) return null;
  let prods = (s?.resources?.results?.products || []).filter((p) => sameModel(p.title, q) || sameModel(p.title, full));
  // "jcid v1se" gibi aramada sitenin kendi marka yazımı farklıysa (JC V1SE): sadece model koduyla bir daha ara
  const codes = String(full || q).split(/[\s,/]+/).filter((w) => /\d/.test(w)).join(' ');
  if (!prods.length && codes && codes.toLowerCase() !== String(q).toLowerCase()) {
    try { const s2 = await (await get(`https://${dom}/search/suggest.json?q=${encodeURIComponent(codes)}&resources[type]=product&resources[limit]=6`)).json(); prods = (s2?.resources?.results?.products || []).filter((p) => sameModel(p.title, codes)); } catch {}
  }
  if (!prods.length) return null; // aramada bu model yok → yanlış ürünün resimlerini alma
  const h = prods[0].handle || (prods[0].url || '').split('/products/')[1]?.split('?')[0];
  const p = await (await get(`https://${dom}/products/${h}.js`)).json();
  return { title: p.title || '', text: strip(p.description).slice(0, 4000), descImgs: imgsIn(p.description, `https://${dom}/`), imgs: (p.images || []).map((u) => abs(u, `https://${dom}/`)).filter(Boolean).map((u) => big(u.split('?')[0])) };
}
// HTML parçasındaki resimler (sırasıyla) — açıklamanın altındaki uzun tanıtım görselleri için
function imgsIn(html, base) {
  const out = [];
  for (const m of String(html || '').matchAll(/<img[^>]+?(?:data-src|src)=["']([^"']+)["']/gi)) { const a = abs(m[1], base); if (a && okImg(a)) { const b2 = big(a.split('?')[0]); if (!out.includes(b2)) out.push(b2); } }
  return out.slice(0, 20);
}
// yapıştırılan ürün sayfası: başlık + sade metin (yapay zekâya kaynak) + galeri resimleri + açıklama resimleri
async function pageInfo(u) {
  const imgs = await pageImages(u, !isProductUrl(u)).catch(() => []);
  let title = '', text = '', descImgs = [];
  try {
    const html = (await (await get(u)).text()).slice(0, 2e6);
    title = strip((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').slice(0, 200);
    const main = /<(main|article)[\s\S]*?<\/\1>/i.exec(html)?.[0] || html.replace(/<(header|footer|nav)[\s\S]*?<\/\1>/gi, ' ');
    text = strip(main).slice(0, 5000);
    // AliExpress: açıklama ayrı bir adreste (descriptionUrl) — tanıtım görselleri orada
    const du = /"(?:descriptionUrl|descUrl)"\s*:\s*"([^"]+)"/.exec(html)?.[1]?.replace(/\\u002F/g, '/').replace(/\\\//g, '/');
    if (du) { const dh = await (await get(abs(du, u))).text(); descImgs = imgsIn(dh, u); if (!text || text.length < 300) text = strip(dh).slice(0, 5000); }
    else { const i = html.search(/(id|class)=["'][^"']*(description|product-desc|tab-desc|rte)/i); if (i > 0) descImgs = imgsIn(html.slice(i, i + 3e5), u).filter((x) => !imgs.includes(x)); }
  } catch {}
  return { title, text, imgs, descImgs };
}
async function shopifyImages(dom, q) {
  const s = await (await get(`https://${dom}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=3`)).json();
  const prods = s?.resources?.results?.products || [];
  if (!prods.length) return [];
  const h = prods[0].handle || (prods[0].url || '').split('/products/')[1]?.split('?')[0];
  const p = await (await get(`https://${dom}/products/${h}.js`)).json();
  return (p.images || []).map((u) => abs(u, `https://${dom}/`)).filter(Boolean).map((u) => big(u.split('?')[0]));
}

export { pageInfo, shopifyProduct, isProductUrl, siteSearch, parseJson };
// Ürün adresinin son parçası (slug) resim dosya adlarında geçiyorsa o resimler bu ürünün galerisidir (martview vb.).
// Boyut ekleri (-small, -medium, -medium-large, -thumb) en büyüğe (-large) çevrilir, aynı numara bir kez alınır.
const sizeless = (x) => x.replace(/-(small|medium-large|medium|large|thumb|tiny|mini)(?=\.(jpe?g|png|webp)$)/i, '').replace(/\.(jpe?g|png|webp)$/i, '');
function slugImages(html, pageUrl) {
  let slug = ''; try { slug = new URL(pageUrl).pathname.split('/').filter(Boolean).pop().replace(/\.html?$/i, '').toLowerCase(); } catch {}
  if (slug.length < 12) return [];
  const key = slug.slice(0, 40), best = new Map();
  // sayfada görülen en büyük boyutu seç (var olmayan adresi uydurma): large > medium-large > medium > (eksiz) > small
  const rank = (x) => (/-large\./i.test(x) && !/-medium-large\./i.test(x) ? 5 : /-medium-large\./i.test(x) ? 4 : /-medium\./i.test(x) ? 3 : /-(small|thumb|tiny|mini)\./i.test(x) ? 1 : 2) + (/\.jpe?g$/i.test(x) ? 0.5 : 0);
  for (const m of html.matchAll(/https?:\/\/[^"'\s()<>\\]+?\.(?:jpe?g|png|webp)/gi)) {
    const x = m[0]; if (!x.toLowerCase().includes(key)) continue;
    const id = sizeless(x); const cur = best.get(id);
    if (!cur || rank(x) > rank(cur)) best.set(id, x);
  }
  // sitede '-large' kalıbı varsa diğer resimlerin de büyüğünü dene (yoksa tarayıcıdaki ayıklama açılamayanı atar,
  // aynı resmin küçüğü yedek olarak kalır; kopyayı görsel parmak izi eler)
  const hasLarge = [...best.values()].some((x) => /-large\./i.test(x) && !/-medium-large\./i.test(x));
  const res = [];
  for (const x of best.values()) {
    if (hasLarge && !(/-large\./i.test(x) && !/-medium-large\./i.test(x))) { const L = x.replace(/-(small|medium-large|medium|thumb|tiny|mini)(\.(?:jpe?g|png|webp))$/i, '-large$2'); if (L !== x) res.push(L); }
    res.push(x);
  }
  return res.slice(0, 16);
}
export async function pageImages(u, strict = false) {
  if (!/^https?:\/\//.test(u)) return [];
  const url = new URL(u);
  // Shopify ürün sayfası → .js
  if (/\/products\/[^/?#]+/.test(url.pathname)) {
    try {
      const p = await (await get(url.origin + url.pathname.replace(/\/$/, '') + '.js')).json();
      if (Array.isArray(p.images) && p.images.length) return p.images.map((x) => abs(x, url.origin + '/')).filter(Boolean).map((x) => big(x.split('?')[0]));
    } catch {}
  }
  const html = (await (await get(u)).text()).slice(0, 3e6);
  const out = [];
  const ids = new Set();
  const push = (x) => { const a = abs(x, u); if (a && okImg(a)) { const b2 = big(a); const id = sizeless(b2); if (!out.includes(b2) && !ids.has(id)) { out.push(b2); ids.add(id); } } };
  // AliExpress
  const ae = /"imagePathList"\s*:\s*\[([^\]]+)\]/.exec(html);
  if (ae) ae[1].match(/"([^"]+)"/g)?.forEach((x) => push(x.slice(1, -1)));
  // JSON-LD Product.image
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (/Product/i.test(o['@type'] || '') && o.image) [].concat(o.image).forEach((i) => push(typeof i === 'string' ? i : i.url || i.contentUrl || '')); if (o['@graph']) walk(o['@graph']); };
      walk(JSON.parse(m[1]));
    } catch {}
  }
  for (const x of slugImages(html, u)) if (!out.includes(x)) { out.push(x); ids.add(sizeless(x)); }
  if (strict) return out.slice(0, 8);
  // og:image
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]*>/gi)) { const c = /content=["']([^"']+)/i.exec(m[0]); if (c) push(c[1]); }
  // ürün galerisi gibi görünen büyük resimler (data-zoom / data-large / srcset'in en büyüğü)
  if (out.length < 3) {
    for (const m of html.matchAll(/(?:data-(?:zoom-image|large_image|large|zoom|src|full)|src)=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) { push(m[1]); if (out.length >= 12) break; }
  }
  return out.slice(0, 12);
}

async function picProxy(u) {
  if (!/^https?:\/\//.test(u)) return new Response('geçersiz', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8', Referer: new URL(u).origin + '/' }, signal: AbortSignal.timeout(20000) });
  const type = (r.headers.get('content-type') || '').split(';')[0];
  const len = Number(r.headers.get('content-length') || 0);
  if (!r.ok || !/^image\//.test(type) || len > 12e6) return new Response('resim alınamadı', { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } });
  return new Response(r.body, { headers: { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
}
