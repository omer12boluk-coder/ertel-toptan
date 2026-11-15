#!/usr/bin/env python3
# 16.11.2026 Yazı kesilme denetimi: Ü/Ş/Ğ/Ç noktası-kuyruğu bir kutunun (overflow ≠ visible ya da clip-path) altında eziliyor mu?
# Kullanım: deneme sunucusu (port 8765, CLAUDE.md §5) açıkken
#   python3 tools/yazi-kesik.py '/urunler?ustmenu' '{"header":"search1","gs1Lbl":"toggle"}' [css-seçici] [genişlik]
# Çıktı boşsa sorun yok. Satır kırpması (line-clamp) gibi bilerek kesilen alt satırlar sayılmaz; gizli sayfalar (.kp-off) atlanır.
import json, sys
from playwright.sync_api import sync_playwright
JS = r"""(SEL) => {
  const root = document.querySelector(SEL) || document.body; const out = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while ((n = tw.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let op = 1; for (let a = el; a && a !== document.documentElement; a = a.parentElement) op *= +getComputedStyle(a).opacity; if (op < 0.3) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const t = rg.getBoundingClientRect(); if (!t.width || !t.height) continue;
    for (let a = el; a; a = a.parentElement) {
      const c = getComputedStyle(a); const r = a.getBoundingClientRect();
      let top = null, bot = null, why = '';
      if (c.overflowY !== 'visible' || (c.overflowX !== 'visible' && c.overflowX !== 'clip' && c.overflowY === 'visible' && false)) { top = r.top + parseFloat(c.borderTopWidth); bot = r.bottom - parseFloat(c.borderBottomWidth); why = 'overflow-y:' + c.overflowY; }
      const m = /inset\(([^)]*)\)/.exec(c.clipPath || '');
      if (m) { const v = m[1].split(/\s+/).map(parseFloat); const [a1, b1 = a1, c1 = a1] = v; const ct = r.top + a1, cb = r.bottom - c1; if (top === null || ct > top) { top = ct; why = 'clip-path ' + c.clipPath; } if (bot === null || cb < bot) { bot = cb; why = 'clip-path ' + c.clipPath; } }
      if (top !== null && r.width > 1 && (t.top < top - 0.5 || t.bottom > bot + 0.5)) {
        out.push({ text: n.textContent.trim().slice(0, 20), by: (a.className && a.className.baseVal === undefined ? a.className : a.tagName).toString().slice(0, 40), why, over: [+(top - t.top).toFixed(1), +(t.bottom - bot).toFixed(1)] }); break; }
      if (a === root) break;
    }
  }
  return out;
}"""
path = sys.argv[1] if len(sys.argv) > 1 else '/urunler?ustmenu'
cfg = sys.argv[2] if len(sys.argv) > 2 else '{"header":"search1"}'
sel = sys.argv[3] if len(sys.argv) > 3 else 'body'
w = int(sys.argv[4]) if len(sys.argv) > 4 else 1440
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': w, 'height': 900}, is_mobile=w < 700, has_touch=w < 700)
    pg.add_init_script("localStorage.setItem('hdr-try', %s); localStorage.setItem('hdr-try-open','false');" % json.dumps(cfg))
    pg.goto('http://127.0.0.1:8765' + path); pg.wait_for_timeout(3500)
    bad = [r for r in pg.evaluate(JS, sel) if 'kp-off' not in r['by'] and (r['over'][0] > 0.3 or 0.3 < r['over'][1] < 6)]
    for r in bad: print(r)
    print('KESİK YOK' if not bad else f'{len(bad)} kesik yazı')
    b.close()
