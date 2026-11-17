#!/usr/bin/env python3
"""Hareketli banner (motionbn.js) için fare tutan sağ el çizimi — SVG'den bir kez resim üretilir.
Çıktı (alttan üste): bn/mot-el-m.webp (fare + gölge), bn/mot-el-p.webp (işaret parmağı; tıklamada oynar), bn/mot-el.webp (el sırtı, diğer parmaklar, başparmak, kol).
Tuval 600×600 (motionbn.js'te 300×300 olarak yerleşir). Çalıştırma: python3 tools/motion/el.py  (Playwright gerekir)
"""
import asyncio, pathlib, io
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'hosting/public/bn'

DEFS = '''
<linearGradient id="sk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9a283"/><stop offset=".5" stop-color="#c08263"/><stop offset="1" stop-color="#8d573d"/></linearGradient>
<linearGradient id="skF" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#b97b5c"/><stop offset=".55" stop-color="#d29878"/><stop offset="1" stop-color="#e2ae8f"/></linearGradient>
<linearGradient id="skT" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5439"/><stop offset=".45" stop-color="#c58868"/><stop offset="1" stop-color="#dba383"/></linearGradient>
<linearGradient id="nail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dccf"/><stop offset=".6" stop-color="#e2b6a2"/><stop offset="1" stop-color="#c99079"/></linearGradient>
<radialGradient id="ms" cx=".45" cy=".25" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e9ebef"/><stop offset=".85" stop-color="#b9bdc5"/><stop offset="1" stop-color="#8f949d"/></radialGradient>
<linearGradient id="slv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#07090e"/><stop offset=".3" stop-color="#161b26"/><stop offset=".62" stop-color="#232a38"/><stop offset="1" stop-color="#080a10"/></linearGradient>
<pattern id="rib" width="7" height="20" patternUnits="userSpaceOnUse"><rect width="7" height="20" fill="none"/><rect x="0" width="2.4" height="20" fill="#000" opacity=".35"/></pattern>
<filter id="b1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4"/></filter>
<filter id="b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="b8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="b20" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .2  0 0 0 0 .12  0 0 0 .55 0"/></filter>
'''

# el sırtı + bilek (sol kenar başparmak tarafı)
BACK = 'M236 470 C232 440 226 412 214 384 C200 352 192 326 196 302 C200 282 214 272 236 280 C252 266 272 264 284 276 C300 264 318 266 330 280 C346 272 362 278 372 294 C388 290 404 296 406 314 C404 346 392 378 380 404 C372 426 366 448 364 470 Z'
# parmaklar: (kök x, kök y, uç x, uç y, kök genişlik, uç genişlik)
FING = {
    'idx': (238, 300, 226, 172, 52, 42),
    'mid': (284, 296, 283, 156, 52, 43),
    'rng': (328, 300, 336, 170, 48, 39),
    'pnk': (368, 312, 386, 222, 40, 32),
}

def finger(k, x0, y0, x1, y1, w0, w1):
    r = w1 / 2
    xl0, xr0, xl1, xr1 = x0 - w0 / 2, x0 + w0 / 2, x1 - w1 / 2, x1 + w1 / 2
    my = (y0 + y1) / 2; mx = (x0 + x1) / 2
    path = (f'M{xl0} {y0 + 10} C{xl0 - 2} {my + 14} {xl1 - 3} {y1 + r * 2.2} {xl1} {y1 + r} '
            f'A{r} {r * 1.1} 0 0 1 {xr1} {y1 + r} C{xr1 + 3} {y1 + r * 2.2} {xr0 + 2} {my + 14} {xr0} {y0 + 10} Z')
    cid = f'c{k}'
    # tırnak (uca yakın, öne eğik → kısa görünür)
    nw = w1 * 0.66; nh = w1 * 0.62; ny = y1 + r * 0.55
    pip = y0 + (y1 - y0) * 0.5; pipx = x0 + (x1 - x0) * 0.5; pw = (w0 + w1) / 2
    dip = y0 + (y1 - y0) * 0.8; dipx = x0 + (x1 - x0) * 0.8
    return f'''<g id="{k}"><clipPath id="{cid}"><path d="{path}"/></clipPath>
  <path d="{path}" fill="url(#skF)"/>
  <g clip-path="url(#{cid})">
    <path d="M{xr0 - 4} {y0 + 20} C{xr0 - 2} {my} {xr1 - 2} {y1 + r * 2} {xr1} {y1}" stroke="#6e3f29" stroke-width="12" fill="none" opacity=".55" filter="url(#b3)"/>
    <path d="M{xl0 + 6} {y0 + 10} C{xl0 + 5} {my} {xl1 + 5} {y1 + r * 2} {xl1 + 6} {y1 + r}" stroke="#f0c3a5" stroke-width="7" fill="none" opacity=".5" filter="url(#b3)"/>
    <ellipse cx="{pipx}" cy="{pip}" rx="{pw * 0.42}" ry="{pw * 0.2}" fill="#e6b295" opacity=".55" filter="url(#b3)"/>
    <path d="M{pipx - pw * 0.25} {pip - 2} q{pw * 0.25} {-5} {pw * 0.5} 0 M{pipx - pw * 0.2} {pip + 4} q{pw * 0.2} {-4} {pw * 0.4} 0" stroke="#7d4a32" stroke-width="1.3" fill="none" opacity=".45" filter="url(#b1)"/>
    <path d="M{dipx - pw * 0.18} {dip + 3} q{pw * 0.18} {-3} {pw * 0.36} 0" stroke="#7d4a32" stroke-width="1.1" fill="none" opacity=".35" filter="url(#b1)"/>
    <path d="M{x1 - nw / 2} {ny + nh * 0.55} C{x1 - nw / 2} {ny - nh * 0.1} {x1 + nw / 2} {ny - nh * 0.1} {x1 + nw / 2} {ny + nh * 0.55} C{x1 + nw * 0.3} {ny + nh * 0.75} {x1 - nw * 0.3} {ny + nh * 0.75} {x1 - nw / 2} {ny + nh * 0.55} Z" fill="url(#nail)"/>
    <path d="M{x1 - nw * 0.4} {ny + nh * 0.3} C{x1 - nw * 0.3} {ny} {x1 + nw * 0.3} {ny} {x1 + nw * 0.4} {ny + nh * 0.3}" stroke="#fff" stroke-width="2.2" fill="none" opacity=".55" filter="url(#b1)"/>
    <path d="M{x1 - nw / 2} {ny + nh * 0.55} C{x1 - nw * 0.3} {ny + nh * 0.78} {x1 + nw * 0.3} {ny + nh * 0.78} {x1 + nw / 2} {ny + nh * 0.55}" stroke="#9c6249" stroke-width="1.6" fill="none" opacity=".5"/>
    <path d="M{xl1 + 2} {y1 + r * 0.5} A{r} {r} 0 0 1 {xr1 - 2} {y1 + r * 0.5}" stroke="#cfe0ff" stroke-width="3" fill="none" opacity=".45" filter="url(#b1)"/>
    <rect x="{min(xl0, xl1) - 10}" y="{y1 - 10}" width="{w0 + 40}" height="{y0 - y1 + 40}" filter="url(#grain)" opacity=".5"/>
  </g>
  <path d="{path}" fill="none" stroke="#5a3322" stroke-width="1" opacity=".35"/>
</g>'''

def svg(show):
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs>{DEFS}</defs>']
    if 'mouse' in show:
        o.append('<ellipse cx="300" cy="352" rx="190" ry="42" fill="#000" opacity=".75" filter="url(#b20)"/>')
        o.append('<path d="M168 250 C164 166 222 112 300 110 C378 112 436 166 432 250 C430 314 380 350 300 350 C220 350 170 314 168 250 Z" fill="url(#ms)"/>')
        o.append('<path d="M176 262 C186 320 236 344 300 344 C364 344 414 320 424 262" stroke="#6f747d" stroke-width="3" fill="none" opacity=".5" filter="url(#b1)"/>')
        o.append('<path d="M206 170 C226 132 262 118 300 116 C338 118 374 132 394 170" stroke="#fff" stroke-width="5" fill="none" opacity=".9" filter="url(#b3)"/>')
    if 'idx' in show:
        o.append(finger('idx', *FING['idx']))
    if 'base' in show:
        # serçe → yüzük → orta (eklemlerin altından çıkar; el sırtı köklerini örter)
        for k in ('pnk', 'rng', 'mid'):
            o.append(finger(k, *FING[k]))
        for a, b in (('mid', 'rng'), ('rng', 'pnk')):
            xa = (FING[a][0] + FING[a][4] / 2 + FING[b][0] - FING[b][4] / 2) / 2
            o.append(f'<path d="M{xa} {FING[a][1]} C{xa} {FING[a][1] - 40} {xa + 3} {FING[a][3] + 70} {xa + 5} {FING[a][3] + 46}" stroke="#4a2716" stroke-width="2.6" fill="none" opacity=".5" filter="url(#b1)"/>')
        # başparmak (fare sol yanında, öne doğru) — kökü el sırtının altında
        th = 'M232 410 C206 394 186 370 176 344 C168 322 162 300 164 284 C166 270 178 264 188 272 C198 282 206 304 214 324 C222 346 238 362 252 372 Z'
        o.append(f'<clipPath id="ct"><path d="{th}"/></clipPath><path d="{th}" fill="url(#skT)"/>')
        o.append('<g clip-path="url(#ct)"><path d="M190 270 C200 300 214 340 240 384" stroke="#f0c3a5" stroke-width="8" fill="none" opacity=".45" filter="url(#b3)"/>')
        o.append('<path d="M166 288 C168 276 178 270 186 275 C191 282 187 293 178 298 C171 299 166 295 166 288 Z" fill="url(#nail)" opacity=".9"/>')
        o.append('<path d="M168 284 C164 296 168 320 176 342" stroke="#cfe0ff" stroke-width="3" fill="none" opacity=".35" filter="url(#b1)"/>')
        o.append('<rect x="150" y="260" width="110" height="160" filter="url(#grain)" opacity=".45"/></g>')
        o.append(f'<path d="{th}" fill="none" stroke="#5a3322" stroke-width="1" opacity=".35"/>')
        # kol (kazak)
        o.append('<path d="M206 600 C210 548 220 506 232 470 L370 470 C384 506 394 548 398 600 Z" fill="url(#slv)"/>')
        o.append('<path d="M206 600 C210 548 220 506 232 470 L370 470 C384 506 394 548 398 600 Z" fill="url(#rib)"/>')
        # el sırtı
        o.append(f'<clipPath id="cb"><path d="{BACK}"/></clipPath><path d="{BACK}" fill="url(#sk)"/>')
        o.append('<g clip-path="url(#cb)">')
        o.append('<path d="M392 290 C408 330 394 400 372 460" stroke="#5e331f" stroke-width="30" fill="none" opacity=".55" filter="url(#b8)"/>')
        o.append('<path d="M206 300 C214 340 230 380 240 440" stroke="#f0c0a0" stroke-width="22" fill="none" opacity=".35" filter="url(#b8)"/>')
        o.append('<ellipse cx="300" cy="476" rx="80" ry="34" fill="#3a1d10" opacity=".4" filter="url(#b20)"/>')
        for x0, x1 in ((238, 268), (284, 290), (328, 314), (368, 336)):
            o.append(f'<path d="M{x0} 290 C{x0} 340 {x1} 390 {(x1 + 300) / 2} 452" stroke="#eab899" stroke-width="7" fill="none" opacity=".33" filter="url(#b3)"/>')
            o.append(f'<path d="M{x0 + 9} 292 C{x0 + 9} 342 {x1 + 9} 392 {(x1 + 309) / 2} 452" stroke="#86503a" stroke-width="5" fill="none" opacity=".2" filter="url(#b3)"/>')
        o.append('<path d="M300 452 C304 410 326 372 330 330 C332 312 340 300 352 292" stroke="#7c5a6a" stroke-width="5" fill="none" opacity=".2" filter="url(#b3)"/>')
        for x, y in ((238, 280), (284, 274), (328, 280), (370, 296)):
            o.append(f'<ellipse cx="{x}" cy="{y + 6}" rx="21" ry="12" fill="#f2c6a8" opacity=".6" filter="url(#b3)"/>')
        o.append('<path d="M200 300 C214 276 236 280 252 272 C270 262 300 262 330 276 C350 270 366 280 380 292" stroke="#d9e6ff" stroke-width="3" fill="none" opacity=".28" filter="url(#b1)"/>')
        o.append('<rect x="180" y="260" width="240" height="220" filter="url(#grain)" opacity=".45"/>')
        o.append('</g>')
        o.append('<path d="M226 478 C262 466 338 466 376 478 L372 458 C338 448 262 448 230 458 Z" fill="#1d2330"/>')
        o.append('<path d="M230 458 C262 448 338 448 372 458" stroke="#3b4458" stroke-width="2.5" fill="none" opacity=".8"/>')
    o.append('</svg>')
    return ''.join(o)

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 600, 'height': 600}, device_scale_factor=2)
        for name, show in (('mot-el-m', ('mouse',)), ('mot-el', ('base',)), ('mot-el-p', ('idx',)), ('_el-all', ('mouse', 'idx', 'base'))):
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg(show)}</body></html>')
            png = await pg.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': 600, 'height': 600})
            im = Image.open(io.BytesIO(png)).convert('RGBA')
            if name.startswith('_'):
                bg = Image.new('RGBA', im.size, (20, 22, 28, 255)); bg.alpha_composite(im); bg.convert('RGB').save('/tmp/el-onizleme.png'); continue
            im.save(OUT / f'{name}.webp', 'WEBP', quality=90, method=6)
        await b.close()

if __name__ == '__main__':
    asyncio.run(main())
