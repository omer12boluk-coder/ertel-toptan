import asyncio, sys, os, http.server, threading, functools, subprocess, base64
ROOT='/home/claude/w2/mv'
mode=sys.argv[1]  # prev | full
W,H=map(int,sys.argv[2].split('x')); OUT=sys.argv[3]
os.makedirs(OUT,exist_ok=True)
H_=functools.partial(http.server.SimpleHTTPRequestHandler,directory=ROOT)
class Q(H_.func):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=ROOT));threading.Thread(target=srv.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{srv.server_address[1]}/v4.html?w={W}&h={H}'
async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':W,'height':H})
        await pg.goto(URL); await pg.evaluate('window.ready')
        if mode=='prev':
            ts=[float(x) for x in sys.argv[4].split(',')]
            for t in ts:
                await pg.evaluate(f'render({t})'); await pg.screenshot(path=f'{OUT}/{t:05.2f}.jpg',type='jpeg',quality=85)
        else:
            tot=await pg.evaluate('TOTAL'); n=int(round(tot*25))
            rng=[tuple(map(float,r.split('-'))) for r in os.environ.get('ONLY','').split(',') if r]
            for i in range(n):
                if rng and not any(a<=i/25<=b for a,b in rng): continue
                await pg.evaluate(f'render({i/25})'); await pg.screenshot(path=f'{OUT}/{i:05d}.jpg',type='jpeg',quality=92)
            if len(sys.argv)>4:
                wav=await pg.evaluate("""async()=>{const buf=await music();const n=buf.length,ch=2,out=new DataView(new ArrayBuffer(44+n*ch*2));
                const W=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i))};
                W(0,'RIFF');out.setUint32(4,36+n*ch*2,true);W(8,'WAVE');W(12,'fmt ');out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,ch,true);
                out.setUint32(24,48000,true);out.setUint32(28,48000*ch*2,true);out.setUint16(32,ch*2,true);out.setUint16(34,16,true);W(36,'data');out.setUint32(40,n*ch*2,true);
                const L=buf.getChannelData(0),R=buf.getChannelData(1);const fade=Math.round(48000*.5);
                for(let i=0;i<n;i++){const g=i>n-fade?(n-i)/fade:1;out.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]*g))*32767,true);out.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]*g))*32767,true)}
                let s='';const u=new Uint8Array(out.buffer);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}""")
                open(sys.argv[4],'wb').write(base64.b64decode(wav))
        await b.close()
asyncio.run(main())
