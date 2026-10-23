#!/usr/bin/env python3
"""Uygulamayı derler:
  dist/artifact.html      -> Claude'da yayınlanan demo sayfası (tek dosya)
  hosting/public/*        -> Firebase Hosting'e yüklenecek gerçek uygulama (PWA)
"""
import json, subprocess, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, DIST, PUB = ROOT / 'src', ROOT / 'dist', ROOT / 'hosting' / 'public'
DIST.mkdir(exist_ok=True); PUB.mkdir(parents=True, exist_ok=True)

subprocess.run([str(ROOT / 'node_modules/.bin/esbuild'), str(SRC / 'main.jsx'), '--bundle', '--format=esm', '--minify',
                '--jsx=automatic', '--define:process.env.NODE_ENV="production"', '--target=es2020',
                '--loader:.png=dataurl', '--outfile=' + str(DIST / 'app.js'), '--log-level=warning'], check=True, cwd=ROOT)

appjs = (DIST / 'app.js').read_text()
css = (SRC / 'style.css').read_text()
def js(o): return json.dumps(o, ensure_ascii=False, separators=(',', ':'))
products = json.load(open(SRC / 'products.json'))
descs = json.load(open(SRC / 'descs.json'))
seed = js(products).replace('</', '<\\/')
seed_desc = js(descs).replace('</', '<\\/')
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">'
body = f'<div id="root"></div>\n<script type="application/json" id="seed">{seed}</script>\n<script type="application/json" id="seed-desc">{seed_desc}</script>\n<script type="module">{appjs}</script>'
body_hosted = f'<div id="root"></div>\n<script type="module">{appjs}</script>'

art = f'''<title>ERTEL Toptan</title>
<meta name="claude:viewport-fit-sides" content="cover">
{FONTS}
<style>{css}</style>
{body}
'''
(DIST / 'artifact.html').write_text(art)

hosted = f'''<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<base href="/">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ERTEL Toptan</title>
<meta name="theme-color" content="#2f55b0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
{FONTS}
<style>{css}</style>
<script src="config.js"></script>
</head>
<body>
{body_hosted}
<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js'));</script>
</body>
</html>
'''
(PUB / 'index.html').write_text(hosted)
(ROOT / 'DEMO.html').write_text('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + art + '</body></html>')
(PUB / 'seed-products.json').write_text(js(products))
(PUB / 'seed-desc.json').write_text(js(descs))
print('artifact', len(art) // 1024, 'KB · hosted', len(hosted) // 1024, 'KB')
