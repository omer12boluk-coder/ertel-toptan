# Gerçek bir tamirci tezgâhı: arka raf (güç kaynağı rafta), delikli pano (cımbızlar asılı),
# ortada mikroskop + anakart tutucu, sağ elde havya + uç temizleyici, sol elde sıcak hava,
# önde cımbız standı, sıvı lehim/flux şırıngaları, tornavida standı, vida bölmeli silikon mat.
import sys
from tez3d import *

Y0 = .75  # masa üstü

def ps_front(theme):  # güç kaynağı ön yüz (250x130)
    return 250, 130, ('<rect width="250" height="130" rx="6" fill="#25282d"/><rect x="10" y="10" width="140" height="92" rx="4" fill="#07080a"/>'
        '<text x="18" y="40" fill="#ff4a3d" font-size="27" font-family="Courier New,monospace" font-weight="700" filter="url(#glow)">30.00</text>'
        '<text x="18" y="68" fill="#ff4a3d" font-size="27" font-family="Courier New,monospace" font-weight="700" filter="url(#glow)">5.000</text>'
        '<text x="18" y="96" fill="#3ce36d" font-size="27" font-family="Courier New,monospace" font-weight="700" filter="url(#glow)">150.0</text>'
        '<circle cx="180" cy="36" r="16" fill="#111"/><circle cx="180" cy="36" r="10" fill="#3a3d43"/><circle cx="222" cy="36" r="16" fill="#111"/><circle cx="222" cy="36" r="10" fill="#3a3d43"/>'
        '<circle cx="176" cy="84" r="9" fill="#d32a22"/><circle cx="204" cy="84" r="9" fill="#0b0b0b" stroke="#555"/><rect x="220" y="76" width="20" height="16" rx="3" fill="#d32a22"/>'
        '<text x="12" y="122" fill="#cfd3d8" font-size="10" font-weight="800" letter-spacing="1.5">SUGON 3005PM</text>')

def havya_front():  # JBC CD-2 ön yüz (170x120)
    return 170, 120, ('<rect width="170" height="120" rx="8" fill="#1b1c1f"/><rect x="12" y="12" width="96" height="58" rx="5" fill="#123d9a"/>'
        '<rect x="15" y="15" width="90" height="52" rx="3" fill="#2b66e0"/><text x="60" y="52" text-anchor="middle" fill="#fff" font-size="25" font-weight="700">350°C</text>'
        '<rect x="14" y="80" width="18" height="11" rx="3" fill="#2d3036"/><rect x="38" y="80" width="18" height="11" rx="3" fill="#2d3036"/><rect x="62" y="80" width="18" height="11" rx="3" fill="#2d3036"/>'
        '<text x="14" y="110" fill="#e8e9eb" font-size="15" font-weight="900" font-style="italic" letter-spacing="3">JBC</text>'
        '<rect x="120" y="14" width="38" height="92" rx="10" fill="#2a2c31"/><circle cx="139" cy="78" r="12" fill="#c9a24a"/>')

def quick_front():  # Quick 861 ön yüz (200x150)
    return 200, 150, ('<rect width="200" height="150" rx="10" fill="#6c7178"/><rect x="34" y="18" width="132" height="98" rx="8" fill="#23262b"/>'
        '<rect x="48" y="28" width="104" height="60" rx="4" fill="#06080a"/><text x="100" y="66" text-anchor="middle" fill="#7fd3ff" font-size="26" font-weight="700" filter="url(#glow)">380°</text>'
        '<text x="100" y="82" text-anchor="middle" fill="#79b8d8" font-size="9" font-weight="600">AIR 60%</text>'
        '<text x="100" y="106" text-anchor="middle" fill="#bfe6ff" font-size="10" font-weight="900" letter-spacing="2">QUICK</text>'
        '<text x="14" y="138" fill="#e2e4e8" font-size="9" font-weight="800" letter-spacing="1.2">861 PRO MAX</text><circle cx="180" cy="134" r="8" fill="#1a1b1e"/>')

def yang_front():
    return 130, 140, ('<rect width="130" height="140" rx="16" fill="#18191c"/><circle cx="66" cy="62" r="26" fill="#2c2e33"/><circle cx="66" cy="62" r="16" fill="#0d0e10"/><circle cx="66" cy="62" r="6" fill="#55585e"/>'
        '<text x="120" y="22" text-anchor="end" fill="#e8e9eb" font-size="13" font-weight="800">MR.YANG 85</text>'
        '<text x="12" y="128" fill="#9aa0a6" font-size="9" font-weight="700" letter-spacing="1">ULTRA  0.7X–4.5X</text>')

def micro_front():  # mikroskop gövde ön yüz (130x140)
    return 130, 140, ('<rect width="130" height="140" rx="16" fill="#1a1b1e"/><circle cx="66" cy="62" r="26" fill="#d42c25"/><circle cx="66" cy="62" r="16" fill="#1c0808"/><circle cx="66" cy="62" r="7" fill="#e5352d"/>'
        '<text x="120" y="22" text-anchor="end" fill="#eceef0" font-size="15" font-weight="800" font-style="italic">MY-7S</text>'
        '<text x="12" y="128" fill="#9aa0a6" font-size="9" font-weight="700" letter-spacing="1">MYSCOPE 0.7X–5X</text>')


def rr(z0, z1, y0, y1, r, k=4):
    """Yuvarlatılmış dikdörtgen yan kesit (z,y)."""
    P = []
    for cz, cy, a0 in ((z1-r, y1-r, 0), (z0+r, y1-r, 90), (z0+r, y0+r, 180), (z1-r, y0+r, 270)):
        for i in range(k+1):
            a = math.radians(a0 + 90*i/k); P.append((cz + r*math.cos(a), cy + r*math.sin(a)))
    return P

def feet(S, o, x0, x1, z0, z1, y):
    for x in (x0+.02, x1-.02):
        for z in (z0+.02, z1-.02): S.cyl(o, [x, y, z], [x, y+.006, z], .008, '#111214', n=10)

def aixun_ps_front():
    return 260, 150, ('<rect width="260" height="150" rx="8" fill="#f2f3f5"/><rect x="10" y="10" width="150" height="96" rx="6" fill="#0d1a2e"/>'
        '<circle cx="42" cy="58" r="24" fill="none" stroke="#ff6a3d" stroke-width="5"/><text x="42" y="64" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">5.0V</text>'
        '<circle cx="85" cy="58" r="24" fill="none" stroke="#3db0ff" stroke-width="5"/><text x="85" y="64" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">8.0A</text>'
        '<circle cx="128" cy="58" r="24" fill="none" stroke="#ffc23d" stroke-width="5"/><text x="128" y="64" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">40W</text>'
        '<circle cx="205" cy="45" r="22" fill="#d9dbdf" stroke="#b5b8bd"/><circle cx="205" cy="45" r="12" fill="#c4c7cc"/>'
        '<rect x="12" y="116" width="16" height="10" rx="2" fill="#3a6fd6"/><rect x="34" y="116" width="16" height="10" rx="2" fill="#3a6fd6"/><rect x="56" y="116" width="16" height="10" rx="2" fill="#3a6fd6"/>'
        '<circle cx="190" cy="122" r="9" fill="#d32a22"/><circle cx="220" cy="122" r="9" fill="#151515"/><text x="12" y="144" fill="#555" font-size="9" font-weight="800" letter-spacing="1.5">AIXUN P3208</text>')

def t420_front():
    return 120, 110, ('<rect width="120" height="110" rx="10" fill="#c3c8ce"/><rect x="12" y="10" width="96" height="46" rx="5" fill="#1d2633"/>'
        '<rect x="15" y="13" width="90" height="40" rx="3" fill="#dfe9f5"/><text x="36" y="41" text-anchor="middle" fill="#1d4f9a" font-size="17" font-weight="800">280</text>'
        '<text x="84" y="41" text-anchor="middle" fill="#1d4f9a" font-size="17" font-weight="800">280</text><line x1="60" y1="16" x2="60" y2="50" stroke="#9fb4cc"/>'
        '<circle cx="60" cy="80" r="16" fill="#aeb3b9"/><circle cx="60" cy="80" r="7" fill="#e7eaee"/><text x="10" y="104" fill="#4b5058" font-size="8" font-weight="800" letter-spacing="1">AIXUN T420D</text>')

def sugon_front():
    return 220, 150, ('<rect width="220" height="150" rx="8" fill="#b9bdc3"/><rect x="10" y="10" width="200" height="56" rx="5" fill="#0a0c10"/>'
        '<text x="40" y="50" fill="#7fe3ff" font-size="28" font-weight="700" filter="url(#glow)">345</text><text x="150" y="50" fill="#ffffff" font-size="24" font-weight="700">30</text>'
        '<rect x="14" y="80" width="40" height="12" rx="3" fill="#36c2c2"/><rect x="62" y="80" width="40" height="12" rx="3" fill="#36c2c2"/><rect x="110" y="80" width="40" height="12" rx="3" fill="#36c2c2"/><rect x="158" y="80" width="40" height="12" rx="3" fill="#36c2c2"/>'
        '<rect x="14" y="102" width="30" height="34" rx="4" fill="#5b6067"/><rect x="176" y="102" width="30" height="34" rx="4" fill="#5b6067"/>'
        '<text x="110" y="128" text-anchor="middle" fill="#2a2d33" font-size="10" font-weight="900" letter-spacing="2">SUGON 8650 PRO</text>')

def build(eksik=(), cam=None, theme='gun', labels=False, ghosts=True, sel=None):
    sel = {'guc': 1996, 'havya': 835, 'mikro': 2913, 'sicak': 3066, **(sel or {})}
    cam = cam or Cam([.98, 1.56, 1.5], [-.04, 1.02, -.16], F=1400)
    S = Scene(cam)
    WALL = '#ece6dc' if theme == 'gun' else '#2a2d33'
    # --- duvar + delikli pano ---
    S.pre.append(f'<rect width="1600" height="1000" fill="{WALL}"/>')
    o = S.obj(base=True)
    S.tiles(o, 'z', -.52, -2.2, 2.2, Y0 - .02, 2.6, WALL, [0, 0, 1], step=.4)
    o = S.obj(base=True)
    S.box(o, -.92, .92, 1.22, 1.86, -.52, -.505, '#d9d2c6' if theme == 'gun' else '#3a3e45')
    for i in range(36):
        for j in range(13):
            x, y = -.88 + i*.05, 1.25 + j*.047
            px, py, _ = cam.pr([x, y, -.504]); S.bg.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="1.6" fill="#8a8275" opacity=".7"/>')
    # --- masa ---
    o = S.obj(base=True)
    S.tiles(o, 'y', Y0, -1.6, 1.6, -.52, .5, '#d7ad7d', [0, 1, 0], step=.2)
    S.tiles(o, 'z', .5, -1.6, 1.6, Y0 - .045, Y0, '#a87c4f', [0, 0, 1], step=.2)
    # arka raf (yükseltici): yan ayaklar + tabla
    o = S.obj(base=True)
    for x0 in (-1.02, .99):
        S.box(o, x0, x0 + .03, Y0, 1.06, -.5, -.2, '#3b3f46', top='#5a5f68')
    S.box(o, -1.02, 1.02, 1.04, 1.07, -.5, -.2, '#454a52', top='#5e646d', side='#30343a')
    S.bg.append('')
    # silikon tamir matı (ızgara + vida bölmeleri)
    o = S.obj(base=True)
    S.box(o, -.8, .7, Y0, Y0 + .006, -.2, .32, '#3f6e74', top='#4a7d83')
    for i in range(1, 25):
        x = -.8 + i*.06; a, b = cam.pr([x, Y0 + .0065, -.2]), cam.pr([x, Y0 + .0065, .32])
        S.bg.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#9cc3c6" stroke-width=".7" opacity=".35"/>')
    for k in range(1, 9):
        z = -.2 + k*.058; a, b = cam.pr([-.8, Y0 + .0065, z]), cam.pr([.7, Y0 + .0065, z])
        S.bg.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#9cc3c6" stroke-width=".7" opacity=".35"/>')
    for i in range(4):  # vida bölmeleri (sağ ön köşe)
        x0 = .40 + i*.06
        S.bg.append(f'<polygon points="{S.P([[x0,Y0+.007,.2],[x0+.045,Y0+.007,.2],[x0+.045,Y0+.007,.29],[x0,Y0+.007,.29]])}" fill="#2f585d" stroke="#7fb0b4" stroke-width=".8"/>')

    # --- RAFTA: güç kaynağı ---
    S.tag = 'guc'
    if 'guc' in eksik: S.ghost(-.86, -.56, 1.07, 1.22, -.46, -.24, '+ Güç kaynağı')
    else:
        S.shadow(-.86, -.56, -.46, -.24, 1.0701, op=.35)
        o = S.obj([-.71, 1.15, -.35])
        feet(S, o, -.86, -.56, -.46, -.24, 1.07)
        if sel['guc'] == 1916:
            S.extrude(o, rr(-.46, -.245, 1.076, 1.235, .02), -.86, -.56, '#c9ccd1', cap='#b8bbc0', spec=.25)
            S.box(o, -.85, -.57, 1.084, 1.227, -.245, -.241, '#f2f3f5', decal=aixun_ps_front())
        else:
            S.extrude(o, rr(-.46, -.245, 1.076, 1.22, .012), -.86, -.56, '#8a8f96', cap='#7a7f86', spec=.15)
            S.box(o, -.85, -.57, 1.082, 1.212, -.245, -.241, '#2a2d32', decal=ps_front(theme))
        # kırmızı/siyah uçlar raftan aşağı, anakart tutucuya
        o2 = S.obj([-.6, .95, -.1])
        S.curve(o2, [[-.66, 1.10, -.235], [-.62, 1.0, -.15], [-.45, .80, -.05], [-.2, .77, -.02], [-.06, .80, -.01]], '#c8261f', 3.2)
        S.curve(o2, [[-.64, 1.10, -.235], [-.6, .99, -.16], [-.44, .79, -.07], [-.2, .765, -.04], [-.06, .80, -.03]], '#1a1a1a', 3.2)
    # rafta sağ: ön ısıtıcı yuvası (boş = genişleme örneği)
    if ghosts: S.ghost(.55, .85, 1.07, 1.16, -.46, -.26, '+ Ön ısıtıcı', big=False)

    # --- ORTA: mikroskop ---
    S.tag = 'mikro'
    if 'mikro' in eksik: S.ghost(-.17, .17, Y0, 1.22, -.18, .1, '+ Mikroskop')
    else:
        RED = '#d42c25' if sel['mikro'] != 3030 else '#2b2d32'
        S.shadow(-.17, .17, -.18, .10, Y0 + .0068, op=.42)
        o = S.obj([0, .8, -.04])
        S.extrude(o, rr(-.18, .10, Y0 + .006, Y0 + .034, .01), -.17, .17, '#17181b', spec=.2)
        S.decal(o, [-.17, Y0 + .028, .1005], [.17, Y0 + .028, .1005], [-.17, Y0 + .012, .1005], 340, 16, ('<text x="170" y="13" text-anchor="middle" fill="#cfd2d6" font-size="11" font-weight="800" letter-spacing="5">' + ('MYSCOPE' if sel['mikro'] != 3030 else 'MR.YANG') + '</text>'))
        S.box(o, -.075, .075, Y0 + .036, Y0 + .052, -.06, .045, '#2c2f35', top='#3a3e45')  # anakart tutucu
        S.box(o, -.055, .055, Y0 + .052, Y0 + .056, -.045, .03, '#1f6b43', top='#2a8a57')  # anakart
        o = S.obj([.1, 1.0, -.14]); S.cyl(o, [.1, Y0 + .036, -.14], [.1, 1.30, -.14], .017, '#c9ced4', cap='#e9ecef', spec=.5)
        o = S.obj([.02, 1.05, -.11])
        S.box(o, -.01, .14, 1.02, 1.095, -.16, -.07, '#1c1d21', top='#2c2e33')                     # kol bloğu
        S.cyl(o, [.14, 1.057, -.115], [.18, 1.057, -.115], .032, '#202226', cap='#34373c')           # odak düğmesi
        S.extrude(o, rr(-.085, .016, .935, 1.085, .022), -.07, .07, '#1a1b1e', spec=.25)
        S.box(o, -.058, .058, .945, 1.075, .016, .018, '#1a1b1e', decal=micro_front() if sel['mikro'] != 3030 else yang_front())
        S.cyl(o, [0, .935, -.03], [0, .915, -.03], .047, '#1d1e22')
        S.cyl(o, [0, .915, -.03], [0, .893, -.03], .046, RED, spec=.4)
        S.cyl(o, [0, .893, -.03], [0, .872, -.03], .042, '#141518')
        S.cyl(o, [0, .872, -.03], [0, .862, -.03], .055, '#e9ecef', cap='#fbfcfd', spec=.6)     # LED halka ışık
        S.cyl(o, [-.083, 1.0, -.03], [-.07, 1.0, -.03], .016, RED)                              # yan kırmızı düğme
        S.cyl(o, [.01, 1.085, -.06], [.01, 1.15, -.06], .02, '#16171a'); S.cyl(o, [.01, 1.15, -.06], [.01, 1.165, -.06], .024, RED)
        for sx in (-.032, .032):
            a, b = [sx, 1.075, -.0], [sx*1.3, 1.16, .075]
            m = add(a, mul(sub(b, a), .28))
            S.cyl(o, a, m, .019, '#1b1c20'); S.cyl(o, m, add(m, mul(norm(sub(b, a)), .03)), .021, RED, spec=.4)
            S.cyl(o, add(m, mul(norm(sub(b, a)), .03)), b, .018, '#1b1c20'); S.cyl(o, b, add(b, mul(norm(sub(b, a)), .02)), .021, '#0c0c0e')

    # --- SAĞ EL: havya + tutucu + uç temizleyici ---
    S.tag = 'havya'
    if 'havya' in eksik: S.ghost(.27, .62, Y0, .9, -.14, .1, '+ Havya')
    else:
      if sel['havya'] == 2745:
        S.shadow(.33, .45, -.12, .05, Y0 + .0068)
        o = S.obj([.39, .8, -.04])
        feet(S, o, .33, .45, -.12, .05, Y0 + .006)
        S.extrude(o, [(.02, Y0 + .11), (.05, Y0 + .012), (.042, Y0 + .006), (-.12, Y0 + .006), (-.12, Y0 + .115), (.0, Y0 + .118)], .33, .45, '#b4b9bf', decals={0: t420_front()}, spec=.35)
        for hx, lean in ((.29, -1), (.49, 1)):   # iki yanda kol yuvası + kol
            S.shadow(hx - .03, hx + .03, -.06, .02, Y0 + .0068, op=.3, blur=6)
            o = S.obj([hx, .8, -.02])
            S.cyl(o, [hx, Y0 + .006, -.02], [hx, Y0 + .05, -.02], .03, '#aab0b6', cap='#c7ccd2', spec=.4)
            S.cyl(o, [hx, Y0 + .05, -.02], [hx, Y0 + .08, -.025], .014, '#d7dbdf', spec=.7)
            S.cyl(o, [hx, Y0 + .08, -.025], [hx + .004*lean, Y0 + .14, -.035], .010, '#2f5fd0')
            S.cyl(o, [hx + .004*lean, Y0 + .14, -.035], [hx + .008*lean, Y0 + .22, -.05], .009, '#1b1c1f')
            S.curve(o, [[hx + .008*lean, Y0 + .22, -.05], [hx + .02*lean, Y0 + .25, -.08], [.39 + .03*lean, Y0 + .16, -.12], [.39 + .02*lean, Y0 + .07, -.12]], '#141518', 2.6)
      else:
          S.shadow(.29, .45, -.14, .05, Y0 + .0068)
          o = S.obj([.37, .8, -.04])
          feet(S, o, .29, .45, -.13, .05, Y0 + .006)
          S.extrude(o, [(.012, Y0 + .118), (.05, Y0 + .012), (.042, Y0 + .006), (-.13, Y0 + .006), (-.13, Y0 + .122), (-.12, Y0 + .128), (.0, Y0 + .128)], .29, .45, '#1d1e22',
                    decals={0: havya_front()}, spec=.2)
          for i, x in enumerate((.31, .325)):  # yedek uç tutucular
              S.cyl(o, [x, Y0 + .128, -.08], [x, Y0 + .16, -.08], .005, '#c9ced4', n=8, spec=.6)
          # sağdaki tutucu modülü (kol yuvası + pirinç temizleyici)
          S.shadow(.455, .56, -.1, .08, Y0 + .0068, op=.3, blur=6)
          o = S.obj([.51, .8, -.01])
          S.extrude(o, rr(-.1, .08, Y0 + .006, Y0 + .05, .01), .455, .56, '#25272c', spec=.2)
          S.cyl(o, [.51, Y0 + .05, .045], [.51, Y0 + .06, .045], .03, '#c9a24a', cap='#6d5c45', spec=.5)
          S.cyl(o, [.507, Y0 + .05, -.04], [.5, Y0 + .1, -.06], .017, '#bfc4ca', spec=.7)               # krom yuva (eğik)
          S.cyl(o, [.5, Y0 + .1, -.06], [.496, Y0 + .115, -.066], .0075, '#d5d9dd', spec=.6)
          S.cyl(o, [.496, Y0 + .115, -.066], [.488, Y0 + .17, -.085], .011, '#19a37a')
          S.cyl(o, [.488, Y0 + .17, -.085], [.48, Y0 + .23, -.105], .0095, '#1b1c1f')
          S.curve(o, [[.48, Y0 + .23, -.105], [.47, Y0 + .25, -.13], [.44, Y0 + .2, -.15], [.42, Y0 + .1, -.14]], '#141518', 3)
      if labels: S.label([.37, .93, .0], 'Havya')

    # --- SOL EL: sıcak hava ---
    S.tag = 'sicak'
    if 'sicak' in eksik: S.ghost(-.78, -.46, Y0, .92, -.16, .08, '+ Sıcak hava')
    else:
        S.shadow(-.69, -.47, -.16, .06, Y0 + .0068, op=.38)
        o = S.obj([-.58, .83, -.05])
        feet(S, o, -.69, -.47, -.16, .06, Y0 + .006)
        if sel['sicak'] == 2671:
            S.extrude(o, rr(-.16, .056, Y0 + .012, Y0 + .15, .012), -.7, -.46, '#2a2d32', spec=.25)
            S.box(o, -.695, -.465, Y0 + .018, Y0 + .145, .056, .058, '#b9bdc3', decal=sugon_front())
        else:
            S.extrude(o, rr(-.16, .056, Y0 + .012, Y0 + .165, .02), -.69, -.47, '#6f747b', spec=.2)
            S.box(o, -.68, -.48, Y0 + .02, Y0 + .157, .056, .058, '#6c7178', decal=quick_front())
            for x in (-.695, -.465):  # yan tutamaklar
                S.box(o, x - .006, x + .006, Y0 + .05, Y0 + .13, .0, .05, '#2a2c30')
        S.shadow(-.78, -.71, -.04, .06, Y0 + .0068, op=.3, blur=6)
        o = S.obj([-.75, .85, .01])
        S.extrude(o, rr(-.04, .06, Y0 + .006, Y0 + .075, .01), -.785, -.715, '#55595f', spec=.2)
        S.cyl(o, [-.75, Y0 + .06, .02], [-.75, Y0 + .075, .02], .022, '#3a3d42')
        S.cyl(o, [-.75, Y0 + .045, .02], [-.75, Y0 + .07, .02], .009, '#c9a24a')             # nozul
        S.cyl(o, [-.75, Y0 + .075, .02], [-.75, Y0 + .25, .02], .019, '#1b1c1f', spec=.3)     # kol
        S.cyl(o, [-.75, Y0 + .15, .02], [-.75, Y0 + .162, .02], .0195, '#2b8f8f')
        S.curve(o, [[-.75, Y0 + .25, .02], [-.76, 1.08, -.0], [-.71, 1.08, -.08], [-.64, .96, -.15]], '#141517', 6)

    # --- ÖN: cımbız standı ---
    S.tag = 'decor'
    if 'cimbiz' in eksik: S.ghost(-.46, -.3, Y0, .9, .2, .28, '+ Cımbız seti', big=False)
    else:
        S.shadow(-.46, -.3, .2, .28, Y0 + .0068, op=.3, blur=6)
        o = S.obj([-.38, .8, .24]); S.box(o, -.46, -.3, Y0 + .006, Y0 + .05, .2, .28, '#b7bcc2', top='#d1d5da', side='#9aa0a7', spec=.3)
        for i in range(6):
            x = -.445 + i*.027; tilt = (i - 2.5)*.008
            S.cyl(o, [x, Y0 + .05, .24], [x + tilt, Y0 + .17, .235], .0035, '#d9dde1', n=6, spec=.7)
        if labels: S.label([-.38, .96, .24], 'Cımbız standı')
    # --- ÖN SAĞ: sıvı lehim + flux şırıngaları ---
    if 'sivi' in eksik: S.ghost(-.2, -.08, Y0, .9, .21, .28, '+ Sıvı lehim', big=False)
    else:
        S.shadow(-.2, -.08, .21, .27, Y0 + .0068, op=.3, blur=6)
        o = S.obj([-.14, .8, .24]); S.box(o, -.2, -.08, Y0 + .006, Y0 + .035, .21, .27, '#2c2f35', top='#3a3e45')
        for i, col in enumerate(['#c98a2b', '#e0b54a', '#9aa0a7']):
            x = -.175 + i*.035
            S.cyl(o, [x, Y0 + .035, .24], [x, Y0 + .14, .24], .009, col, spec=.3)
            S.cyl(o, [x, Y0 + .14, .24], [x, Y0 + .165, .24], .004, '#f2f2f2')
    # --- tornavida standı ---
    if 'tornavida' not in eksik:
        S.shadow(.16, .24, .2, .27, Y0 + .0068, op=.3, blur=6)
        o = S.obj([.2, .8, .235]); S.cyl(o, [.2, Y0 + .006, .235], [.2, Y0 + .04, .235], .035, '#33363c', cap='#44484f')
        for i, col in enumerate(['#d1452c', '#2f62d6', '#e2b23a', '#1f9a6a']):
            a = i*1.57; x, z = .2 + .016*math.cos(a), .235 + .016*math.sin(a)
            S.cyl(o, [x, Y0 + .04, z], [x, Y0 + .095, z], .0065, col, n=8); S.cyl(o, [x, Y0 + .095, z], [x, Y0 + .11, z], .002, '#cfd3d8', n=6)
    # pano üzerinde asılı penseler (gerçekçilik)
    o = S.obj(base=True)
    PLIER = '<path d="M28 0 C22 30 20 60 24 90 L30 150 L38 150 L36 90 C36 60 40 30 34 0 Z" fill="{c}"/><path d="M52 0 C58 30 60 60 56 90 L50 150 L42 150 L44 90 C44 60 40 30 46 0 Z" fill="{c}"/><circle cx="40" cy="152" r="7" fill="#9aa0a6"/><path d="M34 158 L37 200 L43 200 L46 158 Z" fill="#8d939a"/>'
    TWZ = '<path d="M36 0 L44 0 L42 200 L40 210 L38 200 Z" fill="#c9ced4"/><path d="M40 0 L48 2 L41 205 Z" fill="#9aa0a7"/>'
    SD = '<rect x="30" y="0" width="20" height="80" rx="8" fill="{c}"/><rect x="38" y="80" width="5" height="110" fill="#c9ced4"/>'
    tools = [(-.78, PLIER.format(c='#c8261f')), (-.66, PLIER.format(c='#2f62d6')), (-.52, TWZ), (-.46, TWZ), (-.40, TWZ),
             (.36, SD.format(c='#e2b23a')), (.44, SD.format(c='#1f9a6a')), (.52, SD.format(c='#d1452c')), (.64, PLIER.format(c='#1c1e22'))]
    for x, svg in tools:
        S.decal(o, [x - .035, 1.66, -.503], [x + .035, 1.66, -.503], [x - .035, 1.48, -.503], 80, 210, svg)
    return S

def ui(pct, eksik_n, theme='gun'):
    return (f'<g><rect x="36" y="32" width="380" height="66" rx="33" fill="#fff" opacity=".96"/>'
            f'<text x="68" y="71" fill="#1c1e22" font-size="21" font-weight="700">Tezgâhın %{pct} hazır</text>'
            f'<text x="388" y="71" text-anchor="end" fill="#2f62d6" font-size="18" font-weight="700">{eksik_n} eksik</text>'
            f'<rect x="68" y="81" width="320" height="4" rx="2" fill="#e3e3e8"/><rect x="68" y="81" width="{320*pct/100:.0f}" height="4" rx="2" fill="#2f62d6"/></g>')

def poz(slot, pick=None):
    S = build(ghosts=False)
    S.base = []; S.bg = []; S.shadows = []; S.top = []
    S.pre = ['<rect width="1536" height="1024" fill="#ff00ff"/>']
    S.objs = [o for o in S.objs if o['tag'] == slot]
    return S.render().replace('<rect width="1536" height="1024" fill="url(#vig)"/>', '')

def bos():
    S = build(eksik=('guc', 'havya', 'mikro', 'sicak'), ghosts=False)
    S.top = []
    return S.render()

if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    open('out/tam.svg', 'w').write(build().render())
    open('out/eksik.svg', 'w').write(build(eksik=('havya', 'cimbiz')).render(overlay=ui(70, 3)))
    open('out/yakin.svg', 'w').write(build(cam=Cam([.55, 1.25, .72], [.08, .95, -.08], F=1400), labels=True).render())
    open('out/sol.svg', 'w').write(build(cam=Cam([-1.1, 1.5, 1.6], [.02, .93, -.14], F=1420)).render())
