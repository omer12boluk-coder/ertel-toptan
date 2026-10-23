// ERTEL B2B — site değişiklik bekçisi (Cloudflare Worker, dakikada bir)
// Sitenin ürün beslemesini okur, bir öncekiyle karşılaştırır. Ürün kalkmış/eklenmiş, ad/resim/marka değişmiş
// ya da bir ürünün fiyatı (kur değişiminden bağımsız olarak) değişmişse GitHub'daki "Siteyle eşitle" işini başlatır.
// Ağır iş (kataloğu güncellemek) GitHub'da yapılır; burada sadece hafif bir karşılaştırma var (ücretsiz planın 10 ms sınırı).

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(check(env)); },
};

function field(s, tag, from) {
  const a = s.indexOf('<g:' + tag + '>', from);
  if (a < 0) return '';
  const b = s.indexOf('</g:' + tag + '>', a);
  return s.slice(a + tag.length + 4, b);
}

export function parseFeed(xml) {
  const items = [];
  let i = xml.indexOf('<entry>');
  while (i >= 0) {
    const j = xml.indexOf('</entry>', i);
    const e = xml.slice(i, j);
    items.push({ id: field(e, 'id', 0), sig: field(e, 'title', 0) + '|' + field(e, 'image_link', 0) + '|' + field(e, 'brand', 0) + '|' + field(e, 'availability', 0), tl: parseFloat(field(e, 'price', 0)) || 0 });
    i = xml.indexOf('<entry>', j);
  }
  return items;
}

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Fiyatlar TL geldiği için kur değişince hepsi aynı oranda değişir; bu "değişiklik" sayılmaz.
export function priceChanged(prev, items) {
  if (!prev) return true;
  const ratios = [];
  for (const it of items) { const p = prev[it.id]; if (p > 0 && it.tl > 0) ratios.push(it.tl / p); }
  if (!ratios.length) return true;
  ratios.sort((a, b) => a - b);
  const k = ratios[Math.floor(ratios.length / 2)];
  for (const it of items) { const p = prev[it.id]; if (p > 0 && Math.abs(it.tl / p - k) > k * 0.003) return true; }
  return false;
}

export async function check(env) {
  const res = await fetch(env.FEED_URL + '?t=' + Date.now(), { headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'ERTEL-B2B-watch/1.0' }, cf: { cacheTtl: 0 } });
  if (!res.ok) return 'feed ' + res.status;
  const items = parseFeed(await res.text());
  if (items.length < 100) return 'too few';
  const sig = await sha(items.map((x) => x.id + '|' + x.sig).join('\n'));
  const prices = {}; for (const x of items) prices[x.id] = x.tl;
  const [lastSig, lastPrices] = await Promise.all([env.KV.get('sig'), env.KV.get('prices', 'json')]);
  const changed = sig !== lastSig || priceChanged(lastPrices, items);
  if (!changed) {
    // sadece kur değiştiyse yeni fiyatları sessizce sakla
    if (lastPrices && items.some((x) => lastPrices[x.id] !== x.tl)) await env.KV.put('prices', JSON.stringify(prices));
    return 'same';
  }
  const last = Number(await env.KV.get('lastDispatch')) || 0;
  if (Date.now() - last < 2 * 60 * 1000) return 'throttled'; // GitHub'ı en fazla 2 dakikada bir tetikle
  const gh = await fetch(`https://api.github.com/repos/${env.REPO}/actions/workflows/sync.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'ertel-b2b-watch', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main' }),
  });
  if (gh.status !== 204) return 'github ' + gh.status;
  await Promise.all([env.KV.put('sig', sig), env.KV.put('prices', JSON.stringify(prices)), env.KV.put('lastDispatch', String(Date.now()))]);
  return 'dispatched';
}
