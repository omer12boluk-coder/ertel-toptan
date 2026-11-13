# Tezgâh otomatik denetim: tıklama doğruluğu, kare süresi, sağ tık menüsü, açılardan görüntüler
import asyncio, json, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8791/index.html'
PTS = {  # slot -> dünya noktası (ürünün gövdesi)
 'guc': [-.755, 1.15, -.3], 'sicak': [-.58, .83, -.02], 'mikro': [0, 1.0, -.03], 'havya': [.37, .82, 0], 'termal': [.645, .95, -.15],
 'duman': [-.3, .85, -.1], 'isitici': [-.54, .78, .14], 'dramel': [.41, .78, .155], 'olcu': [.21, .79, .17], 'tutucu': [-.12, .77, .2],
 'kalip': [.5, .77, .23], 'tornavida': [.41, 1.37, -.48], 'keski': [.64, 1.37, -.49], 'cimbiz': [-.36, 1.36, -.48], 'sivi': [-.3, .78, .14], 'flux': [.64, .78, .24]}
async def tap(pg, slot):
    box = await pg.locator('#cv').bounding_box(); q = await pg.evaluate(f"Tezgah.project({json.dumps(PTS[slot])})")
    await pg.mouse.click(box['x'] + q[0], box['y'] + q[1]); await pg.wait_for_timeout(450)
    t = await pg.evaluate("(()=>{const h=document.querySelector('.sheet.on h2');return h?h.textContent:null})()")
    await pg.evaluate("closeSheet()"); await pg.wait_for_timeout(250); return t
async def run(pg, name, rep):
    await pg.goto(URL); await pg.wait_for_timeout(3000)
    names = await pg.evaluate("Object.fromEntries(SLOTS.map(s=>[s.k,s.ad]))")
    bad = []
    for k in PTS:
        t = await tap(pg, k)
        if t != names[k]: bad.append(f'{k} -> {t}')
    rep.append(f'[{name}] ilk tıklama yanlış: {bad or "yok"}')
    # değiştir sonra başka ürüne tıkla
    bad2 = []
    for k in ['havya', 'mikro', 'sicak', 'guc']:
        await pg.evaluate(f"(()=>{{const s=S('{k}');setPick('{k}',s.opts[1].id)}})()"); await pg.wait_for_timeout(700)
        for k2 in ['olcu', 'duman', 'havya', 'mikro']:
            t = await tap(pg, k2)
            if t != names[k2]: bad2.append(f'{k} değişince {k2} -> {t}')
    rep.append(f'[{name}] değiştirdikten sonra tıklama yanlış: {bad2 or "yok"}')
    # kare süresi (döndürürken)
    ms = await pg.evaluate("new Promise(r=>{let n=0,t0=performance.now(),last=t0,worst=0;function f(t){worst=Math.max(worst,t-last);last=t;Tezgah.cam.yaw+=.02;Tezgah.dirty();if(++n<60)requestAnimationFrame(f);else r([(performance.now()-t0)/60,worst])}requestAnimationFrame(f)})")
    rep.append(f'[{name}] döndürürken ortalama kare {ms[0]:.1f} ms, en kötü {ms[1]:.0f} ms')
    # sağ tık menüsü
    await pg.evaluate("window.__ctx=0;document.addEventListener('contextmenu',e=>{if(!e.defaultPrevented)window.__ctx++})")
    box = await pg.locator('#cv').bounding_box(); cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2
    await pg.mouse.move(cx, cy); await pg.mouse.down(button='right'); await pg.mouse.move(cx + 300, cy + 40, steps=8); await pg.mouse.up(button='right')
    await pg.wait_for_timeout(200)
    rep.append(f'[{name}] sağ sürükle sonrası tarayıcı menüsü: {await pg.evaluate("window.__ctx")}')
    # açılar
    for i, yaw in enumerate([-1.1, -.6, 0, .6, 1.1]):
        await pg.evaluate(f"Tezgah.cam.yaw={yaw};Tezgah.cam.pitch=.3;Tezgah.dirty()"); await pg.wait_for_timeout(900)
        await pg.locator('#stage').screenshot(path=f'/tmp/den-{name}-{i}.png')
async def main():
    rep = []
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        d = await b.new_page(viewport={'width': 1440, 'height': 900}); d.on('pageerror', lambda e: errs.append(str(e)))
        await run(d, 'masaüstü', rep)
        m = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); m.on('pageerror', lambda e: errs.append(str(e)))
        await run(m, 'telefon', rep)
        rep.append(f'JS hataları: {errs or "yok"}')
        await b.close()
    print('\n'.join(rep))
asyncio.run(main())
