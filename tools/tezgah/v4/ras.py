# SVG → PNG (Playwright), şeffaf zemin
import sys, asyncio
from playwright.async_api import async_playwright
async def main(pairs, scale):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1536, 'height': 1024}, device_scale_factor=scale)
        for src, dst in pairs:
            svg = open(src).read()
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            await pg.screenshot(path=dst, omit_background=True, clip={'x': 0, 'y': 0, 'width': 1536, 'height': 1024})
        await b.close()
def run(pairs, scale=1): asyncio.run(main(pairs, scale))
if __name__ == '__main__':
    a = sys.argv[1:]; run(list(zip(a[::2], a[1::2])))
