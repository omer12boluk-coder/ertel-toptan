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
import hashlib
BUILD = hashlib.sha1((appjs + (SRC / 'style.css').read_text()).encode()).hexdigest()[:10]
css = (SRC / 'style.css').read_text()
def js(o): return json.dumps(o, ensure_ascii=False, separators=(',', ':'))
products = json.load(open(SRC / 'products.json'))
descs = json.load(open(SRC / 'descs.json'))
seed = js(products).replace('</', '<\\/')
seed_desc = js(descs).replace('</', '<\\/')
import re
FBV = re.search(r"const V = '([\d.]+)'", (SRC / 'backend-firebase.js').read_text()).group(1)
# Firebase dosyalarını sayfa açılır açılmaz paralel indir (uygulama kodunu beklemeden)
# Firebase kendi sitemizden (/fb/) — telefon tarayıcılarının izleyici koruması gstatic'i geciktirebiliyor
PRELOAD = ''.join(f'<link rel="modulepreload" href="/fb/{m}.js">' for m in ['firebase-app', 'firebase-auth', 'firebase-firestore']) + '<link rel="preconnect" href="https://firestore.googleapis.com" crossorigin>'
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" media="print" onload="this.media=\'all\'">'
body = f'<div id="root"></div>\n<script type="application/json" id="seed">{seed}</script>\n<script type="application/json" id="seed-desc">{seed_desc}</script>\n<script type="module">{appjs}</script>'
body_hosted = f'<div id="root"></div>\n<script type="module">{appjs}</script>'

art = f'''<title>ERTEL GSM</title>
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
<title>ERTEL GSM</title>
<meta name="theme-color" content="#2f55b0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<script>(function(){{var p=location.pathname,a=/^[/](admin|siparisformu)([/]|$)/.test(p)?'admin':/^[/]magaza([/]|$)/.test(p)?'magaza':'b2b';document.querySelector('link[rel=manifest]').href='manifest-'+a+'.webmanifest';if(a==='admin'){{document.querySelector('link[rel=icon]').href='icon-admin-192.png';document.querySelector('link[rel=apple-touch-icon]').href='icon-admin-180.png';document.querySelector('meta[name=theme-color]').content='#16213f';}}var m=document.createElement('meta');m.name='apple-mobile-web-app-title';m.content=a==='admin'?'ERTEL Yönetim':'ERTEL GSM';document.head.appendChild(m);}})();</script>
{PRELOAD}
{FONTS}
<style>{css}</style>
<script src="config.js"></script>
<script>window.__BUILD = '{BUILD}';</script>
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
(PUB / 'version.json').write_text(json.dumps({'v': BUILD}))
(PUB / 'seed-desc.json').write_text(js(descs))
print('artifact', len(art) // 1024, 'KB · hosted', len(hosted) // 1024, 'KB')
