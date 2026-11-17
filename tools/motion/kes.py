#!/usr/bin/env python3
"""Hareketli banner montajı (src/motionbn.js): kaynak videodan kesitler → bn/mot-q861-w (bilgisayar) ve -t (telefon), mp4 + webm.
17.11.2026 (2): 'her şey çok yakın, makine belli olmuyor' → kare KIRPILMAZ: tam 16:9 görüntü net, etrafı aynı görüntünün
bulanık + koyu kopyası. Bilgisayar 1680×720 (net kare sağda, solda yazı alanı), telefon 720×1280 (net kare üst-ortada, altta yazı).
Kaynaktaki filigran delogo ile silinir. Gerçek hız, yavaşlatma/zum yok. Geniş (makinenin tamamı görünen) planlar ağırlıkta.
Kullanım: python3 tools/motion/kes.py kaynak.mp4 /tmp/cikti  → w.mp4 w.webm t.mp4 t.webm (bn/mot-q861-*.{mp4,webm} olarak kopyala)
"""
import subprocess as sp, sys, os
S = os.path.abspath(sys.argv[1]); os.chdir(sys.argv[2] if len(sys.argv) > 2 else '.')
# (başlangıç sn, süre) — motionbn.js CUTS ile aynı sırada/sürede
L = [(2.25, 1.8), (24.0, 2.0), (13.5, 1.6), (15.4, 1.4), (21.9, 1.6), (28.0, 1.6), (31.0, 1.8), (34.2, 1.2)]
DELOGO = 'delogo=x=24:y=38:w=300:h=74'
FEAT = 150  # net karenin yumuşak kenarı (px)
W_F = (f'[0:v]{DELOGO},split[a][b];'
       '[a]scale=1680:945,crop=1680:720,gblur=sigma=38,eq=brightness=-0.16:saturation=0.85[bg];'
       f"[b]scale=1280:720,format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt(X,{FEAT}),255*X/{FEAT},255)'[fg];"
       '[bg][fg]overlay=400:0,fps=30,format=yuv420p')
T_F = (f'[0:v]{DELOGO},split[a][b];'
       '[a]scale=2276:1280,crop=720:1280,gblur=sigma=40,eq=brightness=-0.2:saturation=0.85[bg];'
       f"[b]scale=720:405,format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='255*min(1,min(Y,404-Y)/60)'[fg];"
       '[bg][fg]overlay=0:300,fps=30,format=yuv420p')
def r(a): sp.run(['ffmpeg', '-nostdin', '-v', 'error', '-y'] + a, check=True)
for i, (ss, d) in enumerate(L):
    for n, fc in (('w', W_F), ('t', T_F)):
        r(['-ss', str(ss), '-i', S, '-t', str(d), '-an', '-filter_complex', fc, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', f'{n}{i}.mp4'])
for n in 'wt':
    open(f'{n}.txt', 'w').write(''.join(f"file '{n}{i}.mp4'\n" for i in range(len(L))))
    r(['-f', 'concat', '-i', f'{n}.txt', '-c', 'copy', f'{n}cat.mp4'])
    r(['-i', f'{n}cat.mp4', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-g', '30', f'{n}.mp4'])
    r(['-i', f'{n}cat.mp4', '-c:v', 'libvpx-vp9', '-crf', '33', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', '-g', '30', f'{n}.webm'])
