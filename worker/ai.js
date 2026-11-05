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
const DAY_LIMIT = 80; // günde en çok taslak (yanlışlıkla döngüye girip para yakmasın)

// Bilinen marka mağazaları (çoğu Shopify: /search/suggest.json + /products/<ad>.js ile resimler temiz gelir)
// (diğerleri panelden: Ayarlar › Akıllı ürün ekle › Marka siteleri)
const SHOPS = { '2UUL': '2uul.com' };

export async function aiRoute(req, env, url, adminOf, json) {
  const err = await adminOf(req); if (err) return json({ ok: false, error: err }, 403);
  if (url.pathname === '/ai/pic' && req.method === 'GET') return picProxy(url.searchParams.get('u') || '');
  const b = await req.json().catch(() => ({}));
  if (url.pathname === '/ai/pics') return json({ ok: true, imgs: await pageImages(String(b.url || '')) });
  if (url.pathname === '/ai/draft') {
    const day = new Date().toISOString().slice(0, 10); const ck = 'aiday:' + day;
    const used = Number((await env.KV.get(ck)) || 0);
    if (used >= DAY_LIMIT) return json({ ok: false, error: `Bugünkü sınır doldu (${DAY_LIMIT} ürün). Yarın tekrar deneyin.` });
    await env.KV.put(ck, String(used + 1), { expirationTtl: 172800 });
    try { return json({ ok: true, draft: await makeDraft(env, b), left: DAY_LIMIT - used - 1 }); }
    catch (e) { return json({ ok: false, error: String(e.message || e).slice(0, 300) }); }
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
  const prompt = buildPrompt(name, cats, brands, ex, String(b.hint || ''));
  let out, sources = [], engine;
  if (env.ANTHROPIC_KEY) { engine = 'claude'; ({ out, sources } = await askClaude(env, prompt)); }
  else if (env.AI) { engine = 'cf'; out = await askCf(env, prompt); }
  else throw new Error('Yapay zekâ bağlı değil: GitHub › Settings › Secrets’a ANTHROPIC_KEY ekleyip “Bekçiyi yayınla”yı çalıştırın.');
  const d = parseJson(out);
  if (!d) throw new Error('Yapay zekâ cevabı okunamadı, tekrar deneyin');
  const brand = String(d.brand || '').trim();
  // resimler: 1) marka mağazası 2) yapay zekânın bulduğu ürün sayfaları 3) aramada çıkan sayfalar
  const shops = { ...SHOPS, ...(b.shops || {}) };
  const pages = [...new Set([...(d.pages || []), ...sources.map((s) => s.url)].filter((u) => /^https?:\/\//.test(u)))].slice(0, 8);
  const imgs = [];
  const add = (arr, from) => arr.forEach((u) => { if (!imgs.some((x) => x.u === u) && imgs.length < 16) imgs.push({ u, from }); });
  const dom = shops[brand.toUpperCase()];
  if (dom) add(await shopifyImages(dom, d.model || d.name || name).catch(() => []), dom);
  const got = await Promise.all(pages.map((p) => pageImages(p).then((l) => [p, l]).catch(() => [p, []])));
  for (const [p, l] of got) add(l.slice(0, 8), host(p));
  return {
    q: name, engine,
    n: String(d.name || name).trim(), b: brand, model: d.model || '',
    c: Number.isFinite(+d.cat) ? +d.cat : null, c2: Number.isFinite(+d.cat2) && d.cat2 !== null && d.cat2 !== '' ? +d.cat2 : null,
    t: (Array.isArray(d.tags) ? d.tags : String(d.tags || '').split(',')).map((x) => String(x).trim()).filter(Boolean).slice(0, 90).join(','),
    desc: cleanDesc(String(d.desc || '')), note: String(d.note || '').slice(0, 400),
    imgs, src: [...new Map([...pages.map((u) => [u, { url: u, title: host(u) }]), ...sources.map((s) => [s.url, s])]).values()].slice(0, 10),
  };
}

function buildPrompt(name, cats, brands, ex, hint) {
  const exTxt = ex.map((e, i) => `ÖRNEK ${i + 1}\nAd: ${e.n}\nEtiketler: ${e.t}\nAçıklama HTML:\n${String(e.d || '').slice(0, 2500)}`).join('\n\n');
  return `Sen ERTEL GSM'in (İstanbul Tahtakale, cep telefonu tamir ekipmanı ve yedek parça toptancısı) ürün giriş asistanısın.
Yönetici şu ürünü eklemek istiyor: "${name}"${hint ? `\nEk bilgi: ${hint}` : ''}

Görevin:
1) Ürünü web'de araştır (önce markanın resmi sitesi, sonra AliExpress, Alibaba, martview, mobilesentrix, ifixit vb.). Doğru modeli bul; emin olmadığın teknik değeri UYDURMA, yazma.
2) Mağazanın ad yazım tarzıyla Türkçe ürün adı yaz (Marka büyük harf + Model + Türkçe ne olduğu; gerekirse parantez içinde uyumlu model / paket bilgisi). Örneklerdeki gibi.
3) Marka: listede varsa AYNI yazımla seç, yoksa resmi yazımı büyük harfle.
4) Kategori: aşağıdaki listeden en uygun kategori numarasını (cat) ve varsa ikinci kategoriyi (cat2, yoksa null) seç.
5) Gizli arama etiketleri (tags): örneklerdeki tarzda 35-60 etiket. Her kelimenin ilk harfi büyük. Sırayla: marka ve model yazım çeşitleri (birleşik, boşluklu, tireli: Pw35, Pw 35, Pw-35), Türkçe ürün adları ve eş anlamlıları, Türkçe karaktersiz yazımları (Hoparlör/Hoparlor), İngilizce adları, uyumlu cihaz modelleri, ölçüler, "… Fiyat", sonra 4-6 adet soru şeklinde uzun arama cümlesi (… Nasıl …, … Ne İşe Yarar), en sonda "<Marka> <Model> Türkiye Satıcısı". Etiketlerde virgül olmasın.
6) Açıklama (desc): örneklerdeki HTML yapısıyla, Türkçe, satış dili sade ve teknisyene hitap eden: 2 kısa paragraf (<p dir="ltr">), <p dir="ltr"><strong>Özellikler</strong></p> + <ul dir="ltr"><li>…</li></ul>, <p dir="ltr"><strong>Teknik Özellikler</strong></p> + <table><thead><tr><th scope="col">Özellik</th><th scope="col">Değer</th></tr></thead><tbody>…</tbody></table>, biliniyorsa <p dir="ltr"><strong>Kutu İçeriği</strong></p> + liste. Resim, video, link, iframe KOYMA.
7) pages: ürünün resimlerinin bulunduğu EN İYİ 1-5 ürün sayfası adresi (resmi site ürün sayfası, AliExpress ürün sayfası…). Arama sonucu / kategori sayfası değil, tek ürün sayfası.

Kategori listesi (numara: yol):
${cats.map(([id, p]) => `${id}: ${p}`).join('\n')}

Mevcut markalar: ${brands.join(', ')}

${exTxt}

Cevabın SADECE şu JSON olsun, <json> ve </json> arasında:
<json>{"name":"…","brand":"…","model":"…","cat":0,"cat2":null,"tags":["…"],"desc":"<p dir=\\"ltr\\">…</p>","pages":["https://…"],"note":"emin olmadığın şeyler / yöneticiye kısa not"}</json>`;
}

async function askClaude(env, prompt) {
  const model = env.AI_MODEL || 'claude-sonnet-5-5';
  const tools = [{ type: env.AI_SEARCH_TOOL || 'web_search_20250305', name: 'web_search', max_uses: 6 }];
  let messages = [{ role: 'user', content: prompt }];
  const sources = []; let text = '';
  for (let turn = 0; turn < 4; turn++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 8000, tools, messages }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Claude: ' + (j.error?.message || r.status));
    for (const c of j.content || []) {
      if (c.type === 'text') text += c.text;
      if (c.type === 'web_search_tool_result' && Array.isArray(c.content)) c.content.forEach((x) => x.url && sources.push({ url: x.url, title: x.title || host(x.url) }));
    }
    if (j.stop_reason !== 'pause_turn') break;
    messages = [...messages, { role: 'assistant', content: j.content }];
  }
  return { out: text, sources: sources.slice(0, 20) };
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
  const raw = m ? m[1] : s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1);
  try { return JSON.parse(raw); } catch { return null; }
}
const cleanDesc = (h) => h.replace(/<(script|iframe|style)[\s\S]*?<\/\1>/gi, '').replace(/<img[^>]*>/gi, '').replace(/\son\w+="[^"]*"/gi, '').trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// ---------------------------------------------------------------- resim bulma
async function get(u, ms = 12000) {
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(String(r.status));
  return r;
}
const abs = (u, base) => { try { const x = new URL(u.replace(/&amp;/g, '&'), base); return x.protocol.startsWith('http') ? x.href : null; } catch { return null; } };
// küçük resim adresi → büyüğü: AliExpress x.jpg_350x350.jpg → x.jpg · Shopify x_1024x.jpg → x.jpg
const big = (u) => (/(\.(jpe?g|png|webp))_[^/]+$/i.test(u) ? u.replace(/(\.(jpe?g|png|webp))_[^/]+$/i, '$1') : u.replace(/_(\d+x\d*|\d*x\d+|small|medium|thumb|compact)(?=\.(jpe?g|png|webp))/i, ''));
const okImg = (u) => u && /^https?:/.test(u) && !/(logo|icon|sprite|favicon|avatar|placeholder|badge|flag|payment|\.svg|\.gif)/i.test(u);

async function shopifyImages(dom, q) {
  const s = await (await get(`https://${dom}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=3`)).json();
  const prods = s?.resources?.results?.products || [];
  if (!prods.length) return [];
  const h = prods[0].handle || (prods[0].url || '').split('/products/')[1]?.split('?')[0];
  const p = await (await get(`https://${dom}/products/${h}.js`)).json();
  return (p.images || []).map((u) => abs(u, `https://${dom}/`)).filter(Boolean).map((u) => big(u.split('?')[0]));
}

export async function pageImages(u) {
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
  const push = (x) => { const a = abs(x, u); if (a && okImg(a)) { const b2 = big(a); if (!out.includes(b2)) out.push(b2); } };
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
