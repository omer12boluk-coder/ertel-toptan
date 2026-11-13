# Tezgâh illüstrasyonu üretici: tek çizim, üç stil (gerçekçi vektör / teknik çizgi / gece stüdyosu).
import math, sys
W, H = 1600, 900
CX = W / 2           # kaçış noktası (perspektif hissi)

T = {
 'gun':  dict(wall1='#f3efe8', wall2='#e4ddd2', light='#fffaf0', wood1='#cfa577', wood2='#b98a5a', edge='#8f6640', mat='#4f5b5e', mat2='#5c686b', grid='#6b777a', shadow='#000', sh=.32, ui='#ffffff', uiink='#1c1e22', acc='#2f62d6', ghost='#2f62d6'),
 'gece': dict(wall1='#23262c', wall2='#17191d', light='#3a3f49', wood1='#5b4634', wood2='#45352a', edge='#2c221b', mat='#2f3a3d', mat2='#37444a', grid='#45535a', shadow='#000', sh=.55, ui='#2a2d33', uiink='#f1efe9', acc='#6e9bff', ghost='#6e9bff'),
}

def P(pts): return ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)

def box(x, y, w, h, d, front, top, side, rx=6, extra=''):
    """Önden + üstten hafif görünen kutu. x,y = ön yüz sol üst. d = derinlik."""
    cx = x + w / 2
    sy = d * 0.16                       # üst yüz yüksekliği
    sx = (CX - cx) * 0.03 * d / 100    # merkeze doğru kayma
    tl, tr = (x, y), (x + w, y)
    bl2, br2 = (x + sx + d * 0.04, y - sy), (x + w + sx - d * 0.04, y - sy)
    out = [f'<polygon points="{P([tl, tr, br2, bl2])}" fill="{top}"/>']
    if sx < 0:   # sağ yan görünür
        out.append(f'<polygon points="{P([tr, br2, (br2[0], br2[1] + h), (x + w, y + h)])}" fill="{side}"/>')
    elif sx > 0:
        out.append(f'<polygon points="{P([tl, bl2, (bl2[0], bl2[1] + h), (x, y + h)])}" fill="{side}"/>')
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{front}" {extra}/>')
    return '\n'.join(out)

def shadow(cx, cy, rx, ry, t):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#shd)" opacity="{t["sh"] / .32:.2f}"/>'

def seg(x, y, txt, col, size=34):
    return (f'<text x="{x}" y="{y}" fill="{col}" font-size="{size}" font-family="DSEG7, \'Courier New\', monospace" font-weight="700" '
            f'letter-spacing="2" filter="url(#glow)">{txt}</text>')

def knob(cx, cy, r):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#knob)"/><circle cx="{cx}" cy="{cy}" r="{r*.72}" fill="url(#knobTop)"/>'
            f'<line x1="{cx}" y1="{cy-r*.62}" x2="{cx}" y2="{cy-r*.3}" stroke="#d8dbe0" stroke-width="2.5" stroke-linecap="round"/>')

# ---------------- cihazlar ----------------
def guc(t, x=150, y=402):
    w, h, d = 250, 196, 150
    s = [shadow(x + w / 2 + 6, y + h + 4, w * .62, 18, t),
         box(x, y, w, h, d, 'url(#psBody)', '#a9aeb5', '#7d828a', rx=8),
         f'<rect x="{x+10}" y="{y+10}" width="{w-20}" height="{h-20}" rx="5" fill="#25282d"/>',
         f'<rect x="{x+22}" y="{y+22}" width="138" height="118" rx="4" fill="#0a0b0d"/>',
         seg(x + 32, y + 58, '30.00', '#ff4a3d'), seg(x + 32, y + 95, '5.000', '#ff4a3d'), seg(x + 32, y + 131, '150.0', '#3ce36d'),
         f'<text x="{x+150}" y="{y+56}" fill="#ff4a3d" font-size="11" font-weight="700" text-anchor="end" opacity=".8">V</text>',
         f'<text x="{x+150}" y="{y+93}" fill="#ff4a3d" font-size="11" font-weight="700" text-anchor="end" opacity=".8">A</text>',
         f'<text x="{x+150}" y="{y+129}" fill="#3ce36d" font-size="11" font-weight="700" text-anchor="end" opacity=".8">W</text>',
         knob(x + 202, y + 52, 21), knob(x + 202, y + 112, 21),
         # alt sıra: USB, çıkışlar
         f'<rect x="{x+22}" y="{y+152}" width="18" height="12" rx="2" fill="#3b3f46"/><rect x="{x+46}" y="{y+152}" width="18" height="12" rx="2" fill="#3b3f46"/>',
         f'<circle cx="{x+100}" cy="{y+160}" r="10" fill="url(#redPost)"/><circle cx="{x+100}" cy="{y+160}" r="4" fill="#5a0f0b"/>',
         f'<circle cx="{x+132}" cy="{y+160}" r="10" fill="url(#blkPost)"/><circle cx="{x+132}" cy="{y+160}" r="4" fill="#000"/>',
         f'<rect x="{x+172}" y="{y+150}" width="46" height="20" rx="4" fill="#d3322a"/>',
         f'<text x="{x+22}" y="{y+184}" fill="#c9cdd3" font-size="11" font-weight="800" letter-spacing="1.6">SUGON 3005PM</text>',
         ]
    return '\n'.join(s)

def havya(t, x=470, y=452):
    w, h, d = 176, 148, 150
    s = [shadow(x + w / 2 + 10, y + h + 4, w * .7, 16, t),
         # kablo istasyondan kola
         f'<path d="M{x+244} {y-115} C {x+290} {y-190}, {x+330} {y+20}, {x+w-6} {y+120}" fill="none" stroke="#141518" stroke-width="6" stroke-linecap="round"/>',
         box(x, y, w, h, d, 'url(#blkBody)', '#3b3e44', '#1e2024', rx=10),
         f'<rect x="{x+16}" y="{y+16}" width="96" height="60" rx="5" fill="#0b2a6b"/><rect x="{x+20}" y="{y+20}" width="88" height="52" rx="3" fill="url(#lcdBlue)"/>',
         f'<text x="{x+64}" y="{y+58}" text-anchor="middle" fill="#fff" font-size="27" font-weight="700" font-family="Inter,sans-serif">350°C</text>',
         f'<text x="{x+24}" y="{y+32}" fill="#bcd3ff" font-size="7.5" font-weight="600">Fixed temp</text>',
         ''.join(f'<rect x="{x+18+i*24}" y="{y+90}" width="18" height="12" rx="3" fill="#2a2d33"/>' for i in range(4)),
         f'<text x="{x+16}" y="{y+132}" fill="#e7e8ea" font-size="15" font-weight="900" letter-spacing="3" font-style="italic">JBC</text>',
         # kol yuvası (sağ üst, krom)
         f'<path d="M{x+124} {y+8} h40 v58 a20 20 0 0 1 -40 0 z" fill="url(#chrome)"/><circle cx="{x+144}" cy="{y+60}" r="13" fill="#2b2d31"/><circle cx="{x+144}" cy="{y+60}" r="6" fill="#c9a24a"/>',
         # havya kolu (yuvada, yukarı çapraz)
         f'<g transform="rotate(-58 {x+144} {y+44})"><rect x="{x+144}" y="{y+40}" width="34" height="8" rx="3" fill="url(#chrome)"/>'
         f'<rect x="{x+176}" y="{y+35}" width="64" height="18" rx="9" fill="#1aa37a"/><rect x="{x+236}" y="{y+37}" width="96" height="14" rx="7" fill="#1b1c1f"/></g>',
         # uç tutucular
         f'<rect x="{x+18}" y="{y-40}" width="9" height="26" rx="2" fill="url(#chrome)"/><rect x="{x+32}" y="{y-44}" width="9" height="30" rx="2" fill="url(#chrome)"/>']
    return '\n'.join(s)

def mikro(t, x=660, base_y=636):
    s = [shadow(x + 230, base_y + 30, 260, 22, t)]
    # taban
    s.append(box(x, base_y - 4, 460, 30, 170, '#141519', '#24262b', '#0d0e10', rx=6))
    s.append(f'<text x="{x+230}" y="{base_y+17}" text-anchor="middle" fill="#cfd2d6" font-size="13" font-weight="800" letter-spacing="4">MYSCOPE</text>')
    # anakart tutucu + kart
    s.append(f'<polygon points="{P([(x+150,base_y-14),(x+300,base_y-14),(x+292,base_y-40),(x+158,base_y-40)])}" fill="#2c2f35"/>')
    s.append(f'<polygon points="{P([(x+166,base_y-22),(x+284,base_y-22),(x+278,base_y-38),(x+172,base_y-38)])}" fill="#1f6b43"/>')
    s.append(f'<rect x="{x+200}" y="{base_y-34}" width="16" height="9" fill="#111"/><rect x="{x+226}" y="{base_y-33}" width="22" height="8" fill="#b8b8b8"/>')
    s.append(f'<ellipse cx="{x+225}" cy="{base_y-30}" rx="70" ry="14" fill="#fff" opacity=".10"/>')
    # direk
    px = x + 330
    s.append(f'<rect x="{px}" y="{base_y-440}" width="26" height="436" fill="url(#steel)"/>')
    s.append(f'<ellipse cx="{px+13}" cy="{base_y-440}" rx="13" ry="4" fill="#e9ecef"/>')
    s.append(f'<rect x="{px-8}" y="{base_y-18}" width="42" height="16" rx="3" fill="#1b1c1f"/>')
    # odak bloğu + kol
    s.append(box(px - 74, base_y - 300, 120, 92, 70, 'url(#blkBody)', '#33363c', '#1b1d21', rx=10))
    s.append(f'<circle cx="{px+54}" cy="{base_y-254}" r="30" fill="url(#knob)"/><circle cx="{px+54}" cy="{base_y-254}" r="20" fill="url(#knobTop)"/>')
    s.append(f'<circle cx="{px-86}" cy="{base_y-254}" r="14" fill="url(#knob)"/>')
    # gövde (zoom)
    bx = x + 150
    s.append(f'<rect x="{bx}" y="{base_y-350}" width="130" height="150" rx="22" fill="url(#blkBody)"/>')
    s.append(f'<circle cx="{bx+66}" cy="{base_y-286}" r="30" fill="url(#redRing)"/><circle cx="{bx+66}" cy="{base_y-286}" r="19" fill="#1a0707"/>'
             f'<circle cx="{bx+66}" cy="{base_y-286}" r="9" fill="url(#redRing)"/>')
    s.append(f'<circle cx="{bx-4}" cy="{base_y-262}" r="15" fill="url(#redRing)"/>')
    s.append(f'<text x="{bx+122}" y="{base_y-330}" text-anchor="end" fill="#eceef0" font-size="17" font-weight="800" font-style="italic">MY-7S</text>')
    s.append(f'<text x="{bx+12}" y="{base_y-218}" fill="#9aa0a6" font-size="9" font-weight="700" letter-spacing="1">MYSCOPE  0.7X–5X</text>')
    # alt objektif
    s.append(f'<rect x="{bx+18}" y="{base_y-200}" width="96" height="30" rx="5" fill="#1d1e22"/>')
    s.append(f'<rect x="{bx+20}" y="{base_y-172}" width="92" height="22" rx="4" fill="url(#redRing)"/>')
    s.append(f'<rect x="{bx+30}" y="{base_y-152}" width="72" height="22" rx="4" fill="#111215"/>')
    s.append(f'<ellipse cx="{bx+66}" cy="{base_y-130}" rx="36" ry="6" fill="#2c2f36"/>')
    # trinoküler çıkış
    s.append(f'<rect x="{bx+80}" y="{base_y-404}" width="40" height="60" rx="6" fill="#16171a"/><rect x="{bx+75}" y="{base_y-414}" width="50" height="16" rx="5" fill="url(#redRing)"/>')
    # göz mercekleri
    s.append(f'<g transform="rotate(-30 {bx+40} {base_y-350})">')
    for ox in (0, 50):
        s.append(f'<rect x="{bx-6+ox}" y="{base_y-470}" width="42" height="124" rx="10" fill="url(#blkBody)"/>'
                 f'<rect x="{bx-10+ox}" y="{base_y-470}" width="50" height="30" rx="8" fill="url(#redRing)"/>'
                 f'<rect x="{bx-12+ox}" y="{base_y-494}" width="54" height="28" rx="10" fill="#0c0d0f"/>'
                 f'<ellipse cx="{bx+15+ox}" cy="{base_y-494}" rx="22" ry="6" fill="#26282d"/>')
    s.append('</g>')
    return '\n'.join(s)

def sicak(t, x=1196, y=402):
    w, h, d = 236, 196, 170
    s = [shadow(x + w / 2 - 20, y + h + 4, w * .8, 18, t),
         # hortum
         f'<path d="M{x-67} {y-40} C {x-70} {y-170}, {x+60} {y-190}, {x+70} {y-90} C {x+78} {y-20}, {x+20} {y+200}, {x+70} {y+196}" fill="none" stroke="#141517" stroke-width="13" stroke-linecap="round"/>',
         box(x, y, w, h, d, 'url(#psBody)', '#8e939a', '#666b72', rx=12),
         f'<rect x="{x}" y="{y}" width="{w}" height="26" rx="12" fill="#5d6268"/>',
         ''.join(f'<rect x="{x+18+i*12}" y="{y+6}" width="6" height="14" rx="2" fill="#4a4e54"/>' for i in range(17)),
         f'<rect x="{x+44}" y="{y+40}" width="148" height="112" rx="10" fill="#24272c"/>',
         f'<rect x="{x+62}" y="{y+52}" width="112" height="70" rx="5" fill="#07090b"/>',
         f'<text x="{x+118}" y="{y+96}" text-anchor="middle" fill="#7fd3ff" font-size="28" font-weight="700" font-family="Inter,sans-serif" filter="url(#glow)">380°</text>',
         f'<text x="{x+118}" y="{y+114}" text-anchor="middle" fill="#79b8d8" font-size="10" font-weight="600">AIR 60%</text>',
         f'<text x="{x+118}" y="{y+142}" text-anchor="middle" fill="#bfe6ff" font-size="11" font-weight="900" letter-spacing="2">QUICK</text>',
         f'<circle cx="{x+194}" cy="{y+176}" r="10" fill="url(#knob)"/>',
         f'<rect x="{x-12}" y="{y+52}" width="16" height="86" rx="6" fill="#2b2e33"/><rect x="{x+w-4}" y="{y+52}" width="16" height="86" rx="6" fill="#2b2e33"/>',
         f'<text x="{x+20}" y="{y+182}" fill="#d0d3d8" font-size="10" font-weight="800" letter-spacing="1.4">861 PRO MAX</text>',
         # kol tutucu + kol
         f'<rect x="{x-82}" y="{y-40}" width="30" height="168" rx="12" fill="url(#blkBody)"/>',
         f'<rect x="{x-82}" y="{y+30}" width="30" height="10" fill="#2b8f8f"/>',
         f'<rect x="{x-76}" y="{y+126}" width="18" height="16" rx="3" fill="url(#brass)"/>',
         box(x - 104, y + 136, 74, 60, 80, '#5a5f66', '#7a7f86', '#45494f', rx=6)]
    return '\n'.join(s)

def hayalet(t, x, y, w, h, label, small=False):
    c = t['ghost']
    s = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{12 if small else 18}" fill="{c}" fill-opacity=".06" stroke="{c}" stroke-width="2" stroke-dasharray="8 7"/>']
    if small:
        s[0] = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#fff" fill-opacity=".92" stroke="{c}" stroke-width="2" stroke-dasharray="8 7"/>'
        s.append(f'<text x="{x+w/2}" y="{y+h/2+6}" text-anchor="middle" fill="{c}" font-size="16" font-weight="700">{label}</text>')
    else:
        bw = len(label) * 10.5 + 44
        s.append(f'<rect x="{x+w/2-bw/2}" y="{y+h/2-22}" width="{bw}" height="44" rx="22" fill="{c}"/>'
                 f'<text x="{x+w/2}" y="{y+h/2+6}" text-anchor="middle" fill="#fff" font-size="17" font-weight="700">{label}</text>')
    return '\n'.join(s)

def defs(t):
    return f'''<defs>
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{t['wall1']}"/><stop offset="1" stop-color="{t['wall2']}"/></linearGradient>
<radialGradient id="spot" cx=".25" cy=".1" r=".7"><stop offset="0" stop-color="{t['light']}" stop-opacity=".9"/><stop offset="1" stop-color="{t['light']}" stop-opacity="0"/></radialGradient>
<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{t['wood1']}"/><stop offset="1" stop-color="{t['wood2']}"/></linearGradient>
<linearGradient id="mat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{t['mat']}"/><stop offset="1" stop-color="{t['mat2']}"/></linearGradient>
<radialGradient id="shd"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".6" stop-color="#000" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="psBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b9097"/><stop offset="1" stop-color="#6c7178"/></linearGradient>
<linearGradient id="blkBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#17181b"/><stop offset=".45" stop-color="#34373d"/><stop offset="1" stop-color="#141518"/></linearGradient>
<linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d838a"/><stop offset=".4" stop-color="#f4f6f8"/><stop offset=".7" stop-color="#b9bec4"/><stop offset="1" stop-color="#6e747b"/></linearGradient>
<linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2f4f6"/><stop offset=".5" stop-color="#9da3aa"/><stop offset="1" stop-color="#dfe3e7"/></linearGradient>
<linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6a2a"/><stop offset=".5" stop-color="#e2c27a"/><stop offset="1" stop-color="#8a6a2a"/></linearGradient>
<linearGradient id="redRing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7e1010"/><stop offset=".45" stop-color="#e5352d"/><stop offset="1" stop-color="#7e1010"/></linearGradient>
<linearGradient id="lcdBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6be6"/><stop offset="1" stop-color="#1747b5"/></linearGradient>
<radialGradient id="knob" cx=".4" cy=".35"><stop offset="0" stop-color="#4a4d53"/><stop offset="1" stop-color="#111214"/></radialGradient>
<radialGradient id="knobTop" cx=".35" cy=".3"><stop offset="0" stop-color="#5c6067"/><stop offset="1" stop-color="#1e2024"/></radialGradient>
<radialGradient id="redPost" cx=".35" cy=".3"><stop offset="0" stop-color="#ff6a5c"/><stop offset="1" stop-color="#a4160e"/></radialGradient>
<radialGradient id="blkPost" cx=".35" cy=".3"><stop offset="0" stop-color="#55585e"/><stop offset="1" stop-color="#0c0d0f"/></radialGradient>
<pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="{t['grid']}" stroke-width="1" opacity=".35"/></pattern>
<filter id="glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>'''

def sahne(theme='gun', eksik=('havya',), ui=True, line=False):
    t = T[theme]
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Inter,-apple-system,Segoe UI,Roboto,sans-serif">', defs(t)]
    if line:
        s.append('<style>*{fill:none!important;stroke:#23262b;stroke-width:1.3px;stroke-linejoin:round}text{fill:#23262b!important;stroke:none!important}'
                 '.bg{fill:#f7f5f0!important;stroke:none!important}.acc,.acc *{stroke:#2f62d6!important}ellipse[fill="url(#shd)"]{display:none}.acct{fill:#2f62d6!important}</style>')
    # duvar + ışık
    s.append(f'<rect class="bg" width="{W}" height="{H}" fill="url(#wall)"/>')
    if not line: s.append(f'<rect width="{W}" height="560" fill="url(#spot)"/>')
    # masa: üst yüzey (perspektif) + ön kenar
    top = [(0, 560), (W, 560), (W, 800), (0, 800)]
    s.append(f'<polygon points="{P(top)}" fill="url(#wood)"/>')
    if not line:
        s.append(''.join(f'<path d="M0 {580+i*44} C 400 {574+i*44}, 1200 {590+i*44}, {W} {582+i*44}" stroke="{t["edge"]}" stroke-width="1" fill="none" opacity=".12"/>' for i in range(5)))
    s.append(f'<rect y="800" width="{W}" height="22" fill="{t["edge"]}"/><rect y="822" width="{W}" height="78" fill="{t["wall2"]}" opacity=".9"/>')
    s.append(f'<rect y="800" width="{W}" height="3" fill="#fff" opacity=".18"/>')
    # ESD mat (perspektif yamuk)
    mat = [(110, 588), (W - 110, 588), (W - 70, 782), (70, 782)]
    s.append(f'<polygon points="{P(mat)}" fill="url(#mat)"/>')
    if not line: s.append(f'<polygon points="{P(mat)}" fill="url(#grid)"/>')
    s.append(f'<polygon points="{P(mat)}" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="2"/>')
    s.append(f'<circle cx="{W-112}" cy="770" r="6" fill="#c9a24a"/>')  # topraklama çıtçıtı
    # cihazlar
    s.append(guc(t) if 'guc' not in eksik else hayalet(t, 150, 402, 250, 196, '+ Güç kaynağı ekle'))
    s.append(havya(t) if 'havya' not in eksik else '<g class="acc">' + hayalet(t, 450, 420, 210, 180, '+ Havya ekle') + '</g>')
    s.append(mikro(t) if 'mikro' not in eksik else hayalet(t, 680, 230, 420, 410, '+ Mikroskop ekle'))
    s.append(sicak(t) if 'sicak' not in eksik else hayalet(t, 1090, 402, 340, 196, '+ Sıcak hava ekle'))
    # ön şerit: küçük malzemeler (eksik)
    s.append('<g class="acc">' + hayalet(t, 360, 712, 170, 52, '+ Cımbız', True) + hayalet(t, 548, 712, 190, 52, '+ Sıvı lehim', True) + hayalet(t, 756, 712, 150, 52, '+ Flux', True) + '</g>')
    if ui:
        s.append(f'<rect x="40" y="36" width="360" height="64" rx="32" fill="{t["ui"]}" opacity=".96"/>'
                 f'<text x="72" y="74" fill="{t["uiink"]}" font-size="21" font-weight="700">Tezgâhın %60 hazır</text>'
                 f'<text x="372" y="74" text-anchor="end" fill="{t["acc"]}" font-size="18" font-weight="700" class="acct">4 eksik</text>'
                 f'<rect x="72" y="84" width="300" height="4" rx="2" fill="#8888" /><rect x="72" y="84" width="180" height="4" rx="2" fill="{t["acc"]}" class="acct"/>')
    s.append('</svg>')
    return '\n'.join(s)

if __name__ == '__main__':
    import os
    os.makedirs('out', exist_ok=True)
    open('out/a-gun.svg', 'w').write(sahne('gun'))
    open('out/b-cizgi.svg', 'w').write(sahne('gun', line=True))
    open('out/c-gece.svg', 'w').write(sahne('gece'))
    open('out/a-tam.svg', 'w').write(sahne('gun', eksik=(), ui=False))
