// 8.11.2026 Gece modunda marka logoları: /brands/x.png yerine önceden hazırlanmış /brands/dk/x.png gösterilir
// (tools/brand-dark.py: siyah yazı beyaza döner, renkler AYNEN kalır). Dosyası olmayan (yüklenmiş) logolarda
// CSS yedeği --logo-dark çalışır. look.logoDark 'mono' = eski düz beyaz (bu takas kapalı).
const RX = /^(?:https?:\/\/[^/]+)?\/brands\/(?!dk\/)([^/?#]+\.png)(?:[?#].*)?$/i;
const SKIP = 'sh-mq-logo'; // renkli kayan şerit: logolar orada hep düz beyaz kalır
let on = false, obs = null, mq = null;

const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : !!(mq && mq.matches);
};
function fix(img) {
  if (!(img instanceof HTMLImageElement) || img.classList.contains(SKIP)) return;
  const want = on && isDark();
  if (want) {
    const src = img.getAttribute('src') || ''; const m = RX.exec(src);
    if (!m) return;
    img.dataset.lsrc = src; img.classList.add('lgdk'); img.setAttribute('src', '/brands/dk/' + m[1]);
  } else if (img.dataset.lsrc) {
    const o = img.dataset.lsrc; delete img.dataset.lsrc; img.classList.remove('lgdk'); img.setAttribute('src', o);
  }
}
const all = () => document.querySelectorAll('img').forEach(fix);

export function setDarkLogos(enable) {
  on = !!enable;
  if (!mq) { try { mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener?.('change', all); } catch {} }
  if (!obs) {
    obs = new MutationObserver((list) => {
      for (const r of list) {
        if (r.type === 'attributes') {
          const t = r.target;
          if (t === document.documentElement) { all(); continue; }
          if (t.tagName !== 'IMG') continue;
          const src = t.getAttribute('src') || '';
          if (/\/brands\/dk\//.test(src)) continue; // kendi takasımız
          if (t.dataset.lsrc) { delete t.dataset.lsrc; t.classList.remove('lgdk'); } // React yeni adres verdi
          fix(t);
        }
        else for (const n of r.addedNodes) { if (n.nodeType !== 1) continue; if (n.tagName === 'IMG') fix(n); else n.querySelectorAll?.('img').forEach(fix); }
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }
  all();
}
