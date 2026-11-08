# Tanıtım videosunu mp4'e çevirir (8.11.2026). Kullanım: python3 tools/film-mp4.py <video id> [çıktı klasörü]
# Çıktı: <id>-16x9.mp4 (1920×1080) ve <id>-4x5.mp4 (1080×1350). Kareler Playwright ile film.js'in kendisinden çekilir
# (sitedeki ile birebir), ses filmses.js renderAudio (OfflineAudioContext) → WAV, ffmpeg ile birleştirilir.
import base64, http.server, json, os, subprocess, sys, tempfile, threading, asyncio
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FID = sys.argv[1] if len(sys.argv) > 1 else 'q861'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/film-mp4'  # repoya mp4 koyma
FPS, HOLD = 30, 1.6
os.makedirs(OUT, exist_ok=True)
tmp = tempfile.mkdtemp()
# film.js + filmses.js → tek dosya
subprocess.run([os.path.join(R, 'node_modules/.bin/esbuild'), os.path.join(R, 'src/film.js'), '--bundle', '--format=iife', '--global-name=FILM', '--outfile=' + tmp + '/film.js'], check=True)
films = json.load(open(os.path.join(R, 'src/icerik/videolar.json')))
F = next(f for f in films if f['id'] == FID)
css = open(os.path.join(R, 'src/style.css')).read(); css = css[css.index('/* ---- 8.11.2026 Tanıtım videosu'):]
open(tmp + '/r.html', 'w').write(f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{{margin:0;background:#000}}{css}
.flm .flm-ui{{display:none}} #b{{position:absolute;left:0;top:0;border-radius:0!important;max-width:none!important;aspect-ratio:auto!important}}</style></head>
<body><div id="b" class="flm-box"></div><script src="/__film.js"></script><script>
const F={json.dumps(F)};
window.go=(w,h)=>{{const b=document.getElementById('b');b.style.width=w+'px';b.style.height=h+'px';window.fm=FILM.makeFilm(b,F,{{auto:false,music:false}});}};
</script></body></html>""")

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = self.path.split('?')[0]
        f = tmp + '/r.html' if p == '/' else tmp + '/film.js' if p == '/__film.js' else os.path.join(R, 'hosting/public', p.lstrip('/'))
        b = open(f, 'rb').read()
        self.send_response(200); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/'

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ses (bir kez)
        pg = await b.new_page(); await pg.goto(URL)
        cuts = [s['t0'] for s in F['scenes'][1:]]; end = F['scenes'][-1]['t0']; total = F['total'] + HOLD
        wav = await pg.evaluate("""async ([c,e,t])=>{
          const buf=await FILM.renderAudioFor(c,e,t);
          const n=Math.min(buf.length,Math.round(t*48000)),ch=2,out=new DataView(new ArrayBuffer(44+n*ch*2));
          const W=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i))};
          W(0,'RIFF');out.setUint32(4,36+n*ch*2,true);W(8,'WAVE');W(12,'fmt ');out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,ch,true);
          out.setUint32(24,48000,true);out.setUint32(28,48000*ch*2,true);out.setUint16(32,ch*2,true);out.setUint16(34,16,true);W(36,'data');out.setUint32(40,n*ch*2,true);
          const L=buf.getChannelData(0),Rr=buf.getChannelData(1);const fade=Math.round(48000*0.6);
          for(let i=0;i<n;i++){const g=i>n-fade?(n-i)/fade:1;out.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]*g))*32767,true);out.setInt16(46+i*4,Math.max(-1,Math.min(1,Rr[i]*g))*32767,true)}
          let s='';const u=new Uint8Array(out.buffer);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}""", [cuts, end, total])
        open(tmp + '/a.wav', 'wb').write(base64.b64decode(wav)); await pg.close()
        for name, (w, h) in {'16x9': (1920, 1080), '4x5': (1080, 1350)}.items():
            pg = await b.new_page(viewport={'width': w, 'height': h}); await pg.goto(URL)
            await pg.evaluate(f'go({w},{h})'); await pg.wait_for_timeout(800)
            fdir = f'{tmp}/{name}'; os.makedirs(fdir, exist_ok=True)
            n = int(round(total * FPS))
            for i in range(n):
                await pg.evaluate(f'fm.seek({min(i / FPS, F["total"])})')
                await pg.screenshot(path=f'{fdir}/{i:05d}.png', clip={'x': 0, 'y': 0, 'width': w, 'height': h})
            out = os.path.join(OUT, f'{FID}-{name}.mp4')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{fdir}/%05d.png', '-i', tmp + '/a.wav',
                            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], check=True)
            print(out); await pg.close()
        await b.close()
asyncio.run(main())
