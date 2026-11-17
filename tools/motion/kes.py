#!/usr/bin/env python3
"""Hareketli banner montajı (src/motionbn.js): kaynak videodan 7 kesit → bn/mot-q861-w (16:9, bilgisayar) ve -t (2:3, telefon), mp4 + webm.
Satır: (başlangıç sn, süre, telefon kesiminin yatay merkezi). Kırpma kaynaktaki filigranı dışarıda bırakır. Gerçek hız, yavaşlatma yok.
Kullanım: python3 tools/motion/kes.py kaynak.mp4 /tmp/cikti  → w.mp4 w.webm t.mp4 t.webm (bn/mot-q861-*.{mp4,webm} olarak kopyala)
"""
import subprocess as sp
import sys, os
S = os.path.abspath(sys.argv[1])  # kaynak video (1920×1080)
os.chdir(sys.argv[2] if len(sys.argv) > 2 else ".")
L=[(2.25,2.0,1000),(5.0,1.6,920),(7.6,1.4,1000),(15.4,1.6,780),(19.0,1.8,1040),(28.0,1.6,1150),(33.4,1.6,600)]
def r(a): sp.run(['ffmpeg','-nostdin','-v','error','-y']+a,check=True)
for i,(ss,d,cx) in enumerate(L):
  x0=max(0,min(1920-638,int(cx-319)))
  for n,vf in (('w','crop=1700:956:220:124,scale=1600:900:flags=lanczos'),('t',f'crop=638:956:{x0}:124,scale=720:1080:flags=lanczos')):
    r(['-ss',str(ss),'-i',S,'-t',str(d),'-an','-vf',vf+',fps=30,format=yuv420p','-c:v','libx264','-crf','16','-preset','medium',f'{n}{i}.mp4'])
for n in 'wt':
  open(f'{n}.txt','w').write(''.join(f"file '{n}{i}.mp4'\n" for i in range(len(L))))
  r(['-f','concat','-i',f'{n}.txt','-c','copy',f'{n}cat.mp4'])
  r(['-i',f'{n}cat.mp4','-c:v','libx264','-crf','24','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart','-g','30',f'{n}.mp4'])
  r(['-i',f'{n}cat.mp4','-c:v','libvpx-vp9','-crf','33','-b:v','0','-row-mt','1','-deadline','good','-cpu-used','3','-g','30',f'{n}.webm'])
