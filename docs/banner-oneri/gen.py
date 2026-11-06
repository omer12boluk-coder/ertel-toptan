import json, sys
CH='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>'
def cta(fg, lc, label, link, bg, big=True):
    h, fs = ('48px','16px') if big else ('42px','15px')
    return f'''<div style="display: flex; align-items: center; gap: 20px; margin-top: 8px"><a href="#" style="display: inline-flex; align-items: center; height: {h}; padding: 0 24px; border-radius: 999px; background: {bg}; color: {fg}; font: 500 {fs}/1 Inter, sans-serif; text-decoration: none">{label}</a><a href="#" style="display: inline-flex; align-items: center; gap: 5px; color: {lc}; font: 500 {fs}/1 Inter, sans-serif; text-decoration: none">{link} {CH}</a></div>'''
def txt(eye, eyec, h, hc, sub, subc, align='left', big=True, tag=None, tagc=None):
    hs = "font: 600 64px/1.03 'Inter Tight', Inter, sans-serif; letter-spacing: -.035em" if big else "font: 600 34px/1.06 'Inter Tight', Inter, sans-serif; letter-spacing: -.03em"
    ss = 'font: 400 20px/1.4 Inter, sans-serif' if big else 'font: 400 15px/1.4 Inter, sans-serif'
    es = 'font: 600 15px/1.2 Inter, sans-serif' if big else 'font: 600 12.5px/1.2 Inter, sans-serif'
    t = f'<span style="{es}; color: {eyec}">{eye}</span><h2 style="margin: 0; {hs}; color: {hc}; white-space: pre-line">{h}</h2>'
    if tag: t += f'<p style="margin: 0; font: 500 {28 if big else 19}px/1.2 Inter, sans-serif; letter-spacing: -.015em; color: {tagc}">{tag}</p>'
    t += f'<p style="margin: 0; {ss}; color: {subc}; max-width: {"440px" if big else "100%"}">{sub}</p>'
    return t
ACC='#2f62d6'
def banners(I):
    B=[]
    # 1 Quick 861 Pro Max — siyah, tam ekran ürün
    B.append(('Quick', 'Quick 861 Pro Max',
f'''<div style="width: 1408px; height: 560px; position: relative; overflow: hidden; border-radius: 32px; background: #000; font-family: Inter, sans-serif">
<img src="{I['q861_pc.jpg']}" alt="Quick 861 Pro Max" style="position: absolute; right: -40px; top: -40px; height: 640px; width: auto">
<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 520px; background: linear-gradient(90deg, #000 62%, rgba(0,0,0,0))"></div>
<div style="position: absolute; left: 88px; top: 0; bottom: 0; width: 470px; display: flex; flex-direction: column; justify-content: center; gap: 12px">{txt('Yeni · Quick', '#f5a54a', '861 Pro Max', '#f5f5f7', 'Sesli komutla çalışan 1300W sıcak hava istasyonu.', '#a1a1a6', tag='Söyle, ısıtsın.', tagc='#f5f5f7')}{cta('#fff', '#5b9cff', 'İncele', 'Sepete ekle', ACC)}</div>
</div>''',
f'''<div style="width: 358px; height: 540px; position: relative; overflow: hidden; border-radius: 26px; background: #000; font-family: Inter, sans-serif">
<img src="{I['q861_m.jpg']}" alt="Quick 861 Pro Max" style="position: absolute; left: -10px; right: -10px; bottom: -14px; width: 378px; height: auto">
<div style="position: absolute; left: 0; right: 0; top: 0; padding: 30px 24px 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px">{txt('Yeni · Quick', '#f5a54a', '861 Pro Max', '#f5f5f7', 'Sesli komutlu 1300W sıcak hava.', '#a1a1a6', big=False, tag='Söyle, ısıtsın.', tagc='#f5f5f7')}{cta('#fff', '#5b9cff', 'İncele', 'Sepete ekle', ACC, big=False)}</div>
</div>'''))
    # 2 AmScope ZM6745T — beyaz, üç açı
    B.append(('ZM6745T', 'AmScope ZM6745T',
f'''<div style="width: 1408px; height: 560px; position: relative; overflow: hidden; border-radius: 32px; background: #fbfbfd; font-family: Inter, sans-serif">
<div style="position: absolute; left: 0; right: 0; top: 46px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px">
<span style="font: 600 15px/1.2 Inter, sans-serif; color: #bf4800">AmScope</span>
<h2 style="margin: 0; font: 600 60px/1 'Inter Tight', Inter, sans-serif; letter-spacing: -.035em; color: #1d1d1f">ZM6745T</h2>
<p style="margin: 0; font: 500 26px/1.2 Inter, sans-serif; letter-spacing: -.015em; color: #1d1d1f">Netlik. Her açıdan.</p>
{cta('#fff', ACC, 'İncele', 'Mikroskoplar', ACC)}</div>
<div style="position: absolute; left: 0; right: 0; bottom: -96px; display: flex; justify-content: center; align-items: flex-end; gap: 90px">
<img src="{I['zm_left.png']}" alt="" style="height: 330px; width: auto">
<img src="{I['zm_front.png']}" alt="AmScope ZM6745T" style="height: 400px; width: auto">
<img src="{I['zm_right.png']}" alt="" style="height: 330px; width: auto"></div>
</div>''',
f'''<div style="width: 358px; height: 540px; position: relative; overflow: hidden; border-radius: 26px; background: #fbfbfd; font-family: Inter, sans-serif">
<div style="position: absolute; left: 0; right: 0; top: 30px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px">
<span style="font: 600 12.5px/1.2 Inter, sans-serif; color: #bf4800">AmScope</span>
<h2 style="margin: 0; font: 600 38px/1 'Inter Tight', Inter, sans-serif; letter-spacing: -.03em; color: #1d1d1f">ZM6745T</h2>
<p style="margin: 0; font: 500 19px/1.2 Inter, sans-serif; color: #1d1d1f">Netlik. Her açıdan.</p>
{cta('#fff', ACC, 'İncele', 'Mikroskoplar', ACC, big=False)}</div>
<img src="{I['zm_front.png']}" alt="AmScope ZM6745T" style="position: absolute; left: 50%; bottom: -70px; height: 340px; width: auto; transform: translateX(-50%)">
</div>'''))
    # 3 Eller — beyaz, yaşam tarzı fotoğraf
    B.append(('Eller', 'Mikroskoplar — tam fotoğraf',
f'''<div style="width: 1408px; height: 560px; position: relative; overflow: hidden; border-radius: 32px; background: #fff; font-family: Inter, sans-serif">
<img src="{I['hands.jpg']}" alt="Mikroskop kafasını ayarlayan eller" style="position: absolute; right: 0; top: 0; width: 760px; height: 560px; object-fit: cover; object-position: 50% 30%">
<div style="position: absolute; left: 88px; top: 0; bottom: 0; width: 520px; display: flex; flex-direction: column; justify-content: center; gap: 12px">{txt('AmScope mikroskoplar', '#bf4800', 'Tamircinin\ngözü.', '#1d1d1f', 'Stereo kafalar, objektifler, halka ışıklar ve aksamlar. Hepsi tek yerde.', '#6e6e73')}{cta('#fff', ACC, 'Mikroskoplara bak', 'Aksamlar', ACC)}</div>
</div>''',
f'''<div style="width: 358px; height: 540px; position: relative; overflow: hidden; border-radius: 26px; background: #fff; font-family: Inter, sans-serif">
<img src="{I['hands.jpg']}" alt="Mikroskop kafasını ayarlayan eller" style="position: absolute; left: 0; right: 0; bottom: 0; width: 358px; height: 300px; object-fit: cover; object-position: 50% 35%">
<div style="position: absolute; left: 0; right: 0; top: 30px; padding: 0 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px">{txt('AmScope mikroskoplar', '#bf4800', 'Tamircinin gözü.', '#1d1d1f', 'Stereo kafalar, objektifler ve aksamlar.', '#6e6e73', big=False)}{cta('#fff', ACC, 'Mikroskoplara bak', 'Aksamlar', ACC, big=False)}</div>
</div>'''))
    # 4 Aixun HT316 — açık gri
    B.append(('HT316', 'Aixun HT316',
f'''<div style="width: 1408px; height: 560px; position: relative; overflow: hidden; border-radius: 32px; background: radial-gradient(60% 80% at 30% 60%, #ffffff 0%, #f0f0f3 70%); font-family: Inter, sans-serif">
<div style="position: absolute; left: 90px; bottom: 60px; width: 600px; height: 30px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.18), rgba(0,0,0,0))"></div>
<img src="{I['ht316.png']}" alt="Aixun HT316" style="position: absolute; left: 70px; bottom: 70px; width: 640px; height: auto">
<div style="position: absolute; left: 790px; top: 0; bottom: 0; width: 520px; display: flex; flex-direction: column; justify-content: center; gap: 12px">{txt('Aixun HT316', '#bf4800', 'İki iş.\nTek istasyon.', '#1d1d1f', '1400W sıcak hava ve havya aynı gövdede. Masada yer açar, işi hızlandırır.', '#6e6e73')}{cta('#fff', ACC, 'İncele', 'Havya istasyonları', ACC)}</div>
</div>''',
f'''<div style="width: 358px; height: 540px; position: relative; overflow: hidden; border-radius: 26px; background: radial-gradient(80% 60% at 50% 75%, #ffffff 0%, #f0f0f3 75%); font-family: Inter, sans-serif">
<div style="position: absolute; left: 0; right: 0; top: 30px; padding: 0 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px">{txt('Aixun HT316', '#bf4800', 'İki iş.\nTek istasyon.', '#1d1d1f', '1400W sıcak hava ve havya tek gövdede.', '#6e6e73', big=False)}{cta('#fff', ACC, 'İncele', 'İstasyonlar', ACC, big=False)}</div>
<img src="{I['ht316.png']}" alt="Aixun HT316" style="position: absolute; left: 14px; bottom: 34px; width: 330px; height: auto">
</div>'''))
    # 5 2UUL DA07 — nane yeşili
    B.append(('DA07', '2UUL DA07',
f'''<div style="width: 1408px; height: 560px; position: relative; overflow: hidden; border-radius: 32px; background: linear-gradient(120deg, #f2fbf7 0%, #d3efe2 100%); font-family: Inter, sans-serif">
<div style="position: absolute; right: 160px; bottom: 36px; width: 440px; height: 40px; border-radius: 50%; background: radial-gradient(closest-side, rgba(10,60,40,.22), rgba(0,0,0,0))"></div>
<img src="{I['da07.png']}" alt="2UUL DA07" style="position: absolute; right: 170px; bottom: 52px; height: 460px; width: auto">
<div style="position: absolute; left: 88px; top: 0; bottom: 0; width: 520px; display: flex; flex-direction: column; justify-content: center; gap: 12px">{txt('2UUL DA07 · iPhone 17 serisine uygun', '#0b7a52', 'Arka kapak,\ntek presle.', '#0f241b', 'Mini ısıtmalı pres istasyonu. Kasa ve arka kapak yapıştırmada eşit baskı, eşit ısı.', '#4a5f55')}{cta('#fff', '#0b7a52', 'İncele', '2UUL ürünleri', '#0b7a52')}</div>
</div>''',
f'''<div style="width: 358px; height: 540px; position: relative; overflow: hidden; border-radius: 26px; background: linear-gradient(170deg, #f2fbf7 0%, #d3efe2 100%); font-family: Inter, sans-serif">
<div style="position: absolute; left: 0; right: 0; top: 30px; padding: 0 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px">{txt('2UUL DA07', '#0b7a52', 'Arka kapak,\ntek presle.', '#0f241b', 'iPhone 17 serisine uygun mini ısıtmalı pres.', '#4a5f55', big=False)}{cta('#fff', '#0b7a52', 'İncele', '2UUL ürünleri', '#0b7a52', big=False)}</div>
<img src="{I['da07.png']}" alt="2UUL DA07" style="position: absolute; left: 50%; bottom: 22px; height: 260px; width: auto; transform: translateX(-50%)">
</div>'''))
    return B
