# Tezgâh v4: 8 yuva × 2 ürün, gerçek ölçüler (metre), katmanlı gölge, doku yok.
# Kamera biraz yandan/yukarıdan; ışık sol-üst-önden (pencere).
from tez3d import *
from onyuz import havya_front, quick_front, micro_front, yang_front, aixun_ps_front, sugon_front, rr, feet

Y0 = .75          # masa üstü
MB = Y0 + .034    # mikroskop tabanının üstü

# ---------- ön yüzler ----------
def sugon_ps_front():  # SUGON 3005PM: dikey (130x165)
    return 130, 165, ('<rect width="130" height="165" rx="5" fill="#7d8188"/><rect x="7" y="8" width="80" height="102" rx="3" fill="#07080a"/>'
        '<rect x="9" y="11" width="22" height="6" rx="1" fill="#2bb3a3"/><text x="34" y="17" fill="#e8eaec" font-size="6" font-weight="800">3005PM</text>'
        '<text x="12" y="44" fill="#ff4a3d" font-size="23" font-family="Courier New,monospace" font-weight="700" filter="url(#glow)">30.00</text>'
        '<text x="12" y="72" fill="#ff4a3d" font-size="23" font-family="Courier New,monospace" font-weight="700" filter="url(#glow)">5.000</text>'
        '<text x="12" y="100" fill="#3ce36d" font-size="23" font-family="Courier New,monospace" font-weight="700" filter="url(#glow)">150.0</text>'
        '<circle cx="109" cy="30" r="14" fill="#2a2c30"/><circle cx="109" cy="30" r="9" fill="#55595f"/><circle cx="109" cy="68" r="14" fill="#2a2c30"/><circle cx="109" cy="68" r="9" fill="#55595f"/>'
        + ''.join(f'<rect x="{8+i*13}" y="116" width="10" height="7" rx="1.5" fill="{c}"/>' for i, c in enumerate(['#2a6fd1', '#2a6fd1', '#2a6fd1', '#2a6fd1', '#d8342b', '#d8342b']))
        + '<rect x="108" y="98" width="14" height="10" rx="2" fill="#d32a22"/>'
        '<circle cx="14" cy="147" r="7" fill="#e9ebee"/><circle cx="36" cy="147" r="7" fill="#d32a22"/><circle cx="56" cy="147" r="7" fill="#151515"/>'
        '<rect x="74" y="141" width="9" height="11" rx="2" fill="#e8a33b"/><rect x="88" y="141" width="9" height="11" rx="2" fill="#e8a33b"/>')

def t420_front2():  # Aixun T420D ana gövde (112x125)
    return 112, 125, ('<rect width="112" height="125" rx="9" fill="#cfd4da"/><rect x="8" y="8" width="96" height="52" rx="6" fill="#1d2633"/>'
        '<rect x="11" y="11" width="90" height="46" rx="4" fill="#dfe9f5"/><text x="31" y="44" text-anchor="middle" fill="#1d4f9a" font-size="20" font-weight="800">280</text>'
        '<text x="81" y="44" text-anchor="middle" fill="#1d4f9a" font-size="20" font-weight="800">280</text><line x1="56" y1="14" x2="56" y2="54" stroke="#9fb4cc"/>'
        '<text x="56" y="22" text-anchor="middle" fill="#5f7896" font-size="5.5" font-weight="700">T245 · T210</text>'
        '<circle cx="56" cy="88" r="19" fill="#bfc5cc"/><circle cx="56" cy="88" r="17" fill="#d8dce1"/><circle cx="56" cy="88" r="7" fill="#eef0f2" stroke="#b3b9c0"/>'
        '<path d="M56 73 l4 5 h-8z M56 103 l4 -5 h-8z M41 88 l5 4 v-8z M71 88 l-5 4 v-8z" fill="#8d949c"/>'
        '<rect x="12" y="74" width="16" height="7" rx="2" fill="#aab0b7"/><rect x="84" y="74" width="16" height="7" rx="2" fill="#aab0b7"/>'
        '<text x="56" y="120" text-anchor="middle" fill="#5a6068" font-size="7" font-weight="800" letter-spacing="1.2">AiXun</text>')

def sugon8650_front():  # 230x135
    return 230, 135, ('<rect width="230" height="135" rx="7" fill="#c3c7cc"/><rect x="8" y="8" width="214" height="50" rx="4" fill="#0a0c10"/>'
        '<text x="30" y="44" fill="#7fe3ff" font-size="27" font-weight="700" filter="url(#glow)">345</text><text x="98" y="44" fill="#7fe3ff" font-size="11" font-weight="700">°C</text>'
        '<text x="160" y="44" fill="#ffffff" font-size="24" font-weight="700">30</text><text x="196" y="44" fill="#9ab" font-size="9">AIR</text>'
        + ''.join(f'<rect x="{18+i*50}" y="68" width="42" height="11" rx="3" fill="#36c2c2"/>' for i in range(4))
        + '<rect x="12" y="88" width="34" height="38" rx="5" fill="#5b6067"/><rect x="184" y="88" width="34" height="38" rx="5" fill="#5b6067"/>'
        '<rect x="62" y="92" width="106" height="30" rx="4" fill="#d5d8dc"/><text x="115" y="111" text-anchor="middle" fill="#2a2d33" font-size="9.5" font-weight="900" letter-spacing="1.6">SUGON 8650 PRO</text>')

def p3208_front():  # 200x115
    return 200, 115, ('<rect width="200" height="115" rx="7" fill="#f2f3f5"/><rect x="8" y="8" width="118" height="74" rx="5" fill="#0d1a2e"/>'
        '<circle cx="34" cy="45" r="18" fill="none" stroke="#ff6a3d" stroke-width="4"/><text x="34" y="49" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">5.0V</text>'
        '<circle cx="67" cy="45" r="18" fill="none" stroke="#3db0ff" stroke-width="4"/><text x="67" y="49" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">8.0A</text>'
        '<circle cx="100" cy="45" r="18" fill="none" stroke="#ffc23d" stroke-width="4"/><text x="100" y="49" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">40W</text>'
        '<circle cx="160" cy="34" r="17" fill="#d9dbdf" stroke="#b5b8bd"/><circle cx="160" cy="34" r="9" fill="#c4c7cc"/>'
        + ''.join(f'<rect x="{10+i*18}" y="90" width="13" height="9" rx="2" fill="#3a6fd6"/>' for i in range(4))
        + '<rect x="84" y="90" width="12" height="9" rx="2" fill="#e8a33b"/><circle cx="150" cy="96" r="8" fill="#d32a22"/><circle cx="176" cy="96" r="8" fill="#151515"/>'
        '<text x="10" y="110" fill="#666" font-size="7" font-weight="800" letter-spacing="1.2">AIXUN P3208</text>')

def meter_face(kind):  # multimetre ön yüzü (100x200), kılıf rengi kenarda
    if kind == 3025:
        hol, face, lcd, brand, mdl = '#3f9a5a', '#2b2e33', '#c9d6b8', '2UUL', 'MT30'
    else:
        hol, face, lcd, brand, mdl = '#d8322a', '#1d1e21', '#c3cdb4', 'UNI-T', 'UT33D+'
    return 100, 200, (f'<rect width="100" height="200" rx="14" fill="{hol}"/><rect x="8" y="10" width="84" height="182" rx="9" fill="{face}"/>'
        f'<text x="14" y="24" fill="#fff" font-size="8" font-weight="900">{brand}</text><text x="86" y="24" text-anchor="end" fill="#cfd3d8" font-size="7" font-weight="700">{mdl}</text>'
        f'<rect x="14" y="30" width="72" height="40" rx="3" fill="{lcd}"/><text x="50" y="62" text-anchor="middle" fill="#1d2218" font-size="25" font-family="Courier New,monospace" font-weight="700">1.999</text>'
        '<rect x="14" y="76" width="20" height="8" rx="2" fill="#4a4e55"/><rect x="40" y="76" width="20" height="8" rx="2" fill="#4a4e55"/><rect x="66" y="76" width="20" height="8" rx="2" fill="#4a4e55"/>'
        '<circle cx="50" cy="126" r="30" fill="#3a3d43"/><circle cx="50" cy="126" r="24" fill="#16171a"/><rect x="47" y="98" width="6" height="30" rx="3" fill="#cfd3d8"/>'
        + ''.join(f'<circle cx="{50+33*math.cos(a)}" cy="{126+33*math.sin(a)}" r="1.4" fill="#e7e9ec"/>' for a in [i*math.pi/7 + math.pi for i in range(8)])
        + '<circle cx="24" cy="176" r="7" fill="#d32a22"/><circle cx="50" cy="176" r="7" fill="#111"/><circle cx="76" cy="176" r="7" fill="#d32a22"/>')

def tweezer_svg(kind, w=240, h=210):
    """Askıdaki 3 cımbız (önden). kind 2981 JC: düz/eğri/ince + siyah logo bandı; 2710 Luban 3D: gri tutma yeri."""
    g = (f'<defs><linearGradient id="tm{kind}" x1="0" x2="1"><stop offset="0" stop-color="#8d939a"/><stop offset=".35" stop-color="#f4f6f8"/>'
         f'<stop offset=".6" stop-color="#c3c8ce"/><stop offset="1" stop-color="#7d838a"/></linearGradient></defs>')
    out = [g]
    for i, cx in enumerate((60, 120, 180)):
        tip = ['M0 0', 'C2 8 8 12 14 14', 'M0 0'][i]
        leg = lambda sx: (f'<path d="M{cx+sx*9} 8 L{cx+sx*4} 150 L{cx+sx*1.2} 192 L{cx} 194 L{cx+sx*0.4} 150 L{cx+sx*3} 8 Z"/>')
        sh = f'<g transform="translate(5,4)" fill="#000" opacity=".22" filter="url(#b3)">{leg(-1)}{leg(1)}</g>'
        body = f'<g fill="url(#tm{kind})" stroke="#6d737a" stroke-width=".6">{leg(-1)}{leg(1)}</g>'
        if i == 1:  # eğri uç
            body += f'<path d="M{cx-1} 188 q-2 8 8 14" fill="none" stroke="#a9aeb4" stroke-width="2.2" stroke-linecap="round"/>'
        if kind == 2981: band = f'<rect x="{cx-11}" y="30" width="22" height="12" rx="2" fill="#1b1c1f"/><text x="{cx}" y="39" text-anchor="middle" fill="#fff" font-size="7" font-weight="800">JC</text>'
        else: band = f'<rect x="{cx-9}" y="60" width="18" height="46" rx="3" fill="#6e7379" opacity=".75"/>'
        out += [sh, body, band]
    return w, h, ''.join(out)

# ---------- sahne ----------
SEL0 = {'guc': 1996, 'cimbiz': 2981, 'sicak': 3066, 'duman': 2242, 'mikro': 2913, 'tutucu': 3032, 'havya': 835, 'olcu': 3025}

def build(eksik=(), sel=None, ghosts=True, tutucu_alt=None):
    sel = {**SEL0, **(sel or {})}
    cam = Cam([.98, 1.56, 1.5], [-.04, 1.02, -.16], F=1400)
    S = Scene(cam)
    WALL = '#ebe5db'
    # duvar: pencereden gelen ışık (sol üst daha aydınlık)
    S.pre.append(f'<rect width="1600" height="1100" fill="{WALL}"/>')
    S.pre.append('<defs><radialGradient id="win" cx=".05" cy=".0" r="1.05"><stop offset="0" stop-color="#fffaf0" stop-opacity=".75"/><stop offset=".55" stop-color="#fffaf0" stop-opacity="0"/><stop offset="1" stop-color="#5a4a3a" stop-opacity=".18"/></radialGradient>'
                 '<linearGradient id="desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#3a2410" stop-opacity=".16"/></linearGradient></defs>')
    o = S.obj(base=True); o['dof'] = True
    S.tiles(o, 'z', -.52, -2.2, 2.2, Y0 - .02, 2.6, WALL, [0, 0, 1], step=.4)
    o = S.obj(base=True); o['dof'] = True
    S.box(o, -.92, .92, 1.22, 1.86, -.52, -.505, '#ddd6ca', mat=None)
    for i in range(36):
        for j in range(13):
            x, y = -.88 + i*.05, 1.25 + j*.047
            px, py, _ = cam.pr([x, y, -.504]); S.bg.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="1.6" fill="#8a8275" opacity=".55"/>')
    # masa
    o = S.obj(base=True)
    S.tiles(o, 'y', Y0, -1.6, 1.6, -.52, .5, '#d6ae80', [0, 1, 0], step=.2)
    S.tiles(o, 'z', .5, -1.6, 1.6, Y0 - .045, Y0, '#a77b4e', [0, 0, 1], step=.2)
    for k in range(18):  # çok hafif ağaç damarı (uzun ince çizgiler)
        z = -.5 + k*.055 + (k % 3)*.007
        a, b = cam.pr([-1.6, Y0 + .0003, z]), cam.pr([1.6, Y0 + .0003, z + .01*((k % 2)*2-1)])
        S.bg.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#8a5a2c" stroke-width="{.6 + (k % 3)*.3}" opacity=".10"/>')
    # raf
    o = S.obj(base=True)
    for x0 in (-1.02, .99):
        S.box(o, x0, x0 + .03, Y0, 1.06, -.5, -.2, '#3b3f46', top='#5a5f68')
    S.box(o, -1.02, 1.02, 1.04, 1.07, -.5, -.2, '#454a52', top='#5e646d', side='#30343a')
    S.shadow(-1.02, 1.02, -.5, -.2, Y0 + .0002, op=.13, h=.0)
    S.shadows[-3:] = [('base', e) for _, e in S.shadows[-3:]]
    # silikon mat
    o = S.obj(base=True)
    S.box(o, -.8, .7, Y0, Y0 + .006, -.2, .32, '#3f6e74', top='#4a7d83', mat=None)
    for i in range(1, 25):
        x = -.8 + i*.06; a, b = cam.pr([x, Y0 + .0065, -.2]), cam.pr([x, Y0 + .0065, .32])
        S.bg.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#9cc3c6" stroke-width=".7" opacity=".3"/>')
    for k in range(1, 9):
        z = -.2 + k*.058; a, b = cam.pr([-.8, Y0 + .0065, z]), cam.pr([.7, Y0 + .0065, z])
        S.bg.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#9cc3c6" stroke-width=".7" opacity=".3"/>')
    for i in range(4):
        x0 = .40 + i*.06
        S.bg.append(f'<polygon points="{S.P([[x0,Y0+.007,.2],[x0+.045,Y0+.007,.2],[x0+.045,Y0+.007,.29],[x0,Y0+.007,.29]])}" fill="#2f585d" stroke="#7fb0b4" stroke-width=".8"/>')
    # panoda dekor aletler (pense, tornavida) — cımbız artık ayrı yuva
    o = S.obj(base=True)
    PLIER = '<path d="M28 0 C22 30 20 60 24 90 L30 150 L38 150 L36 90 C36 60 40 30 34 0 Z" fill="{c}"/><path d="M52 0 C58 30 60 60 56 90 L50 150 L42 150 L44 90 C44 60 40 30 46 0 Z" fill="{c}"/><circle cx="40" cy="152" r="7" fill="#9aa0a6"/><path d="M34 158 L37 200 L43 200 L46 158 Z" fill="#8d939a"/>'
    SD = '<rect x="30" y="0" width="20" height="80" rx="8" fill="{c}"/><rect x="38" y="80" width="5" height="110" fill="#c9ced4"/>'
    for x, svg in [(.30, SD.format(c='#e2b23a')), (.38, SD.format(c='#1f9a6a')), (.46, SD.format(c='#d1452c')), (.60, PLIER.format(c='#1c1e22')), (.72, PLIER.format(c='#c8261f'))]:
        S.decal(o, [x - .035, 1.46, -.503], [x + .035, 1.46, -.503], [x - .035, 1.28, -.503], 80, 210, svg)

    # ===== 1 GÜÇ KAYNAĞI (rafta) =====
    S.tag = 'guc'; RY = 1.07
    if 'guc' in eksik:
        if ghosts: S.ghost(-.84, -.66, RY, RY + .16, -.47, -.25, '+ Güç kaynağı')
    elif sel['guc'] == 1916:   # Aixun P3208: yatay, 200x115x220
        x0, x1 = -.87, -.67
        S.shadow(x0, x1, -.46, -.24, RY + .0002, h=.12)
        o = S.obj([(x0+x1)/2, RY + .06, -.35]); feet(S, o, x0, x1, -.46, -.24, RY)
        S.extrude(o, rr(-.46, -.245, RY + .006, RY + .121, .016), x0, x1, '#9fb0c2', cap='#8fa1b4', spec=.3)
        S.box(o, x0 + .006, x1 - .006, RY + .012, RY + .115, -.245, -.241, '#f2f3f5', decal=p3208_front())
        o2 = S.obj([x1 - .03, RY - .02, -.22])  # kablolar: rafın kenarından sarkan düzgün halka
        S.curve(o2, [[x1 - .05, RY + .03, -.24], [x1 - .05, RY + .0, -.2], [x1 - .06, RY - .07, -.19], [x1 - .02, RY - .09, -.19], [x1 - .005, RY - .02, -.2]], '#c8261f', 2.6)
        S.curve(o2, [[x1 - .025, RY + .03, -.24], [x1 - .03, RY + .0, -.2], [x1 - .035, RY - .06, -.19], [x1 + .0, RY - .075, -.19], [x1 + .01, RY - .015, -.2]], '#1a1a1a', 2.6)
    else:                       # SUGON 3005PM: dikey, 130x165x240
        x0, x1 = -.82, -.69
        S.shadow(x0, x1, -.47, -.23, RY + .0002, h=.17)
        o = S.obj([(x0+x1)/2, RY + .08, -.35]); feet(S, o, x0, x1, -.47, -.23, RY)
        S.extrude(o, rr(-.47, -.235, RY + .006, RY + .171, .01), x0, x1, '#8a8f96', cap='#7c8188', spec=.15)
        S.box(o, x0 + .004, x1 - .004, RY + .01, RY + .167, -.235, -.231, '#7d8188', decal=sugon_ps_front())
        o2 = S.obj([x1 - .02, RY - .02, -.22])
        S.curve(o2, [[x0 + .045, RY + .023, -.229], [x0 + .05, RY + .0, -.205], [x0 + .07, RY - .07, -.19], [x0 + .11, RY - .08, -.19], [x0 + .125, RY - .01, -.2]], '#c8261f', 2.6)
        S.curve(o2, [[x0 + .06, RY + .023, -.229], [x0 + .065, RY + .0, -.205], [x0 + .085, RY - .06, -.19], [x0 + .115, RY - .065, -.19], [x0 + .13, RY - .005, -.2]], '#1a1a1a', 2.6)

    # ===== 2 CIMBIZ (panoda askı) =====
    S.tag = 'cimbiz'; cx0, cx1, cy = -.44, -.2, 1.44
    if 'cimbiz' in eksik:
        if ghosts: S.ghost(cx0, cx1, 1.25, 1.465, -.50, -.47, '+ Cımbız seti', big=False)
    else:
        o = S.obj([(cx0+cx1)/2, cy, -.48])
        S.decal(o, [cx0 + .01, cy - .004, -.488], [cx1 - .01, cy - .004, -.488], [cx0 + .01, cy - .19, -.488], *tweezer_svg(sel['cimbiz']))
        col = '#2a2c31' if sel['cimbiz'] == 2981 else '#c9ced4'
        S.box(o, cx0, cx1, cy - .012, cy + .02, -.505, -.462, col, top='#3a3d43' if sel['cimbiz'] == 2981 else '#dde1e5', spec=.3,
              decal=(240, 32, f'<text x="120" y="22" text-anchor="middle" fill="{"#f2f3f5" if sel["cimbiz"] == 2981 else "#3a3e45"}" font-size="17" font-weight="900" letter-spacing="3">{"JCID" if sel["cimbiz"] == 2981 else "LUBAN"}</text>'))
        for x in (cx0 + .02, cx1 - .02): S.cyl(o, [x, cy + .004, -.505], [x, cy + .004, -.51], .006, '#9aa0a7', n=10)

    # ===== 3 SICAK HAVA (sol) =====
    S.tag = 'sicak'
    if 'sicak' in eksik:
        if ghosts: S.ghost(-.79, -.46, Y0, .91, -.17, .07, '+ Sıcak hava')
    else:
        if sel['sicak'] == 2671:  # SUGON 8650 PRO 230x135x250
            x0, x1, z0, z1, hh = -.70, -.47, -.19, .06, .135
            S.shadow(x0, x1, z0, z1, Y0 + .0068, h=hh)
            o = S.obj([(x0+x1)/2, Y0 + .07, (z0+z1)/2]); feet(S, o, x0, x1, z0, z1, Y0 + .006)
            S.extrude(o, rr(z0, z1 - .004, Y0 + .012, Y0 + hh + .012, .012), x0, x1, '#3a3d43', spec=.25)
            S.box(o, x0 + .004, x1 - .004, Y0 + .016, Y0 + hh + .008, z1 - .004, z1, '#c3c7cc', decal=sugon8650_front())
        else:                     # Quick 861 Pro 214x159x235
            x0, x1, z0, z1, hh = -.69, -.476, -.18, .055, .159
            S.shadow(x0, x1, z0, z1, Y0 + .0068, h=hh)
            o = S.obj([(x0+x1)/2, Y0 + .08, (z0+z1)/2]); feet(S, o, x0, x1, z0, z1, Y0 + .006)
            S.extrude(o, rr(z0, z1 - .002, Y0 + .012, Y0 + hh + .006, .02), x0, x1, '#5f646b', spec=.2)
            S.box(o, x0 + .012, x1 - .012, Y0 + .02, Y0 + hh - .002, z1 - .002, z1, '#6c7178', decal=quick_front())
            for x in (x0 - .006, x1 + .006):
                S.box(o, x - .006, x + .006, Y0 + .05, Y0 + .135, -.0, .045, '#2a2c30')
        # tabanca tutucu + tabanca
        S.shadow(-.79, -.72, -.05, .06, Y0 + .0068, op=.3, h=.07)
        o = S.obj([-.755, .85, .005])
        S.extrude(o, rr(-.05, .06, Y0 + .006, Y0 + .075, .01), -.79, -.72, '#2f3237', spec=.2)
        S.cyl(o, [-.755, Y0 + .062, .01], [-.755, Y0 + .078, .01], .023, '#3a3d42')
        S.cyl(o, [-.755, Y0 + .046, .01], [-.755, Y0 + .072, .01], .009, '#c9a24a')
        S.cyl(o, [-.755, Y0 + .078, .01], [-.755, Y0 + .25, .01], .02, '#1b1c1f', spec=.3)
        S.cyl(o, [-.755, Y0 + .15, .01], [-.755, Y0 + .163, .01], .0205, '#2b8f8f' if sel['sicak'] == 3066 else '#36c2c2')
        S.curve(o, [[-.755, Y0 + .25, .01], [-.765, 1.08, -.01], [-.72, 1.08, -.09], [-.66, .97, -.16]], '#141517', 6)

    # ===== 4 DUMAN EMİCİ (mikroskobun solu, kart yönüne bakar) =====
    S.tag = 'duman'
    if 'duman' in eksik:
        if ghosts: S.ghost(-.37, -.24, Y0, Y0 + .17, -.17, -.03, '+ Duman emici', big=False)
    elif sel['duman'] == 3020:  # RF4 RF-SF4: yuvarlak, turkuaz arka, siyah ön
        cy, cz, r = Y0 + .085, -.1, .062
        S.shadow(-.36, -.24, -.16, -.04, Y0 + .0068, h=.15, round_=True)
        o = S.obj([-.3, cy, cz])
        for zz in (cz - .035, cz + .035):  # bacaklar
            S.cyl(o, [-.33, Y0 + .006, zz], [-.31, cy - .02, zz], .005, '#16171a', n=8)
            S.cyl(o, [-.27, Y0 + .006, zz], [-.29, cy - .02, zz], .005, '#16171a', n=8)
        S.cyl(o, [-.355, cy, cz], [-.3, cy, cz], r, '#2fb7b0', cap='#29a39d', spec=.3, n=40)
        S.cyl(o, [-.3, cy, cz], [-.25, cy, cz], r + .002, '#1a1b1e', cap='#111214', spec=.3, n=40)
        d = 2*r
        S.decal(o, [-.249, cy + r, cz + r], [-.249, cy + r, cz - r], [-.249, cy - r, cz + r], 100, 100,
                '<circle cx="50" cy="50" r="46" fill="#0d0e10"/>' + ''.join(f'<circle cx="50" cy="50" r="{rr_}" fill="none" stroke="#3a3d43" stroke-width="3"/>' for rr_ in (40, 32, 24, 16))
                + '<circle cx="50" cy="50" r="9" fill="#2a2c30"/><text x="50" y="53" text-anchor="middle" fill="#e8e9eb" font-size="7" font-weight="900">RF4</text>')
    else:                       # 2UUL Aiolos DA98: kare beyaz çerçeve, karbon filtre, yeşil gövde, siyah yay ayak
        cy, z0, z1 = Y0 + .095, -.165, -.035
        S.shadow(-.36, -.25, -.16, -.04, Y0 + .0068, h=.16)
        o = S.obj([-.3, cy, -.1])
        S.box(o, -.335, -.265, Y0 + .006, Y0 + .014, -.13, -.07, '#1a1b1e')                       # ayak tabanı
        S.curve(o, [[-.3, Y0 + .012, -.1], [-.3, Y0 + .02, -.165], [-.3, cy, -.175], [-.3, cy, -.168]], '#16171a', 4)
        S.curve(o, [[-.3, Y0 + .012, -.1], [-.3, Y0 + .02, -.035], [-.3, cy, -.025], [-.3, cy, -.032]], '#16171a', 4)
        S.box(o, -.345, -.3, cy - .05, cy + .05, z0 + .02, z1 - .02, '#2f8a55', spec=.2)             # yeşil gövde
        S.box(o, -.3, -.268, cy - .066, cy + .066, z0, z1, '#eceef0', side='#e2e5e8', spec=.35,
              decal=None)
        S.decal(o, [-.2675, cy + .056, z1 - .01], [-.2675, cy + .056, z0 + .01], [-.2675, cy - .056, z1 - .01], 100, 100,
                '<rect width="100" height="100" rx="10" fill="#141518"/>' + ''.join(f'<circle cx="{8+i*9.4}" cy="{8+j*9.4}" r="2.6" fill="#24262a"/>' for i in range(10) for j in range(10))
                + '<rect x="3" y="3" width="94" height="94" rx="9" fill="none" stroke="#fff" stroke-opacity=".08"/>')

    # ===== 5 MİKROSKOP =====
    S.tag = 'mikro'
    if 'mikro' in eksik:
        if ghosts: S.ghost(-.17, .17, Y0, 1.22, -.18, .1, '+ Mikroskop')
    else:
        yang = sel['mikro'] == 3030
        RED = '#d42c25' if not yang else '#3a3d43'
        S.shadow(-.17, .17, -.18, .10, Y0 + .0068, op=.42, h=.03)
        o = S.obj([0, .8, -.04])
        S.extrude(o, rr(-.18, .10, Y0 + .006, MB, .01), -.17, .17, '#17181b', spec=.2)
        S.decal(o, [-.17, MB - .006, .1005], [.17, MB - .006, .1005], [-.17, Y0 + .012, .1005], 340, 16,
                '<text x="170" y="13" text-anchor="middle" fill="#cfd2d6" font-size="11" font-weight="800" letter-spacing="5">' + ('MR.YANG' if yang else 'MYSCOPE') + '</text>')
        px, pz = (.1, -.14) if not yang else (.0, -.155)
        S.shadow(px - .02, px + .02, pz - .02, pz + .02, MB + .0002, op=.2, h=.5, round_=True)
        o = S.obj([px, 1.0, pz]); S.cyl(o, [px, MB, pz], [px, 1.32, pz], .018, '#c9ced4' if not yang else '#1c1d21', cap='#e9ecef' if not yang else '#2a2c31', spec=.6)
        S.cyl(o, [px, MB, pz], [px, MB + .02, pz], .03, '#1c1d21')
        o = S.obj([.0, 1.05, -.11])
        if not yang:
            S.box(o, -.01, .14, 1.02, 1.095, -.16, -.07, '#1c1d21', top='#2c2e33')
            S.cyl(o, [.14, 1.057, -.115], [.18, 1.057, -.115], .032, '#202226', cap='#34373c')
        else:
            S.box(o, -.04, .04, 1.03, 1.10, -.18, -.08, '#1c1d21', top='#2c2e33')
            S.cyl(o, [.04, 1.065, -.13], [.075, 1.065, -.13], .03, '#202226', cap='#34373c')
            S.cyl(o, [-.04, 1.065, -.13], [-.075, 1.065, -.13], .03, '#202226', cap='#34373c')
        S.extrude(o, rr(-.085, .016, .935, 1.085, .022), -.07, .07, '#1a1b1e' if not yang else '#232428', spec=.3)
        S.box(o, -.058, .058, .945, 1.075, .016, .018, '#1a1b1e', decal=micro_front() if not yang else yang_front())
        S.cyl(o, [0, .935, -.03], [0, .915, -.03], .047, '#1d1e22')
        S.cyl(o, [0, .915, -.03], [0, .893, -.03], .046, RED, spec=.4)
        S.cyl(o, [0, .893, -.03], [0, .872, -.03], .042, '#141518')
        S.cyl(o, [0, .872, -.03], [0, .862, -.03], .055, '#e9ecef', cap='#fbfcfd', spec=.6)
        if not yang: S.cyl(o, [-.083, 1.0, -.03], [-.07, 1.0, -.03], .016, RED)
        S.cyl(o, [.01, 1.085, -.06], [.01, 1.15, -.06], .02, '#16171a'); S.cyl(o, [.01, 1.15, -.06], [.01, 1.165, -.06], .024, RED)
        for sx in (-.032, .032):
            a, b = [sx, 1.075, -.0], [sx*1.3, 1.16, .075]
            m = add(a, mul(sub(b, a), .28))
            S.cyl(o, a, m, .019, '#1b1c20'); S.cyl(o, m, add(m, mul(norm(sub(b, a)), .03)), .021, RED, spec=.4)
            S.cyl(o, add(m, mul(norm(sub(b, a)), .03)), b, .018, '#1b1c20'); S.cyl(o, b, add(b, mul(norm(sub(b, a)), .02)), .021, '#0c0c0e')

    # ===== 6 BORD TUTUCU (mikroskop tabanında; mikroskop yoksa matta) =====
    S.tag = 'tutucu'
    ty = (Y0 + .006) if (tutucu_alt if tutucu_alt is not None else 'mikro' in eksik) else MB
    if 'tutucu' in eksik:
        if ghosts: S.ghost(-.09, .09, ty, ty + .03, -.07, .05, '+ Bord tutucu', big=False)
    elif sel['tutucu'] == 2767:  # Mechanic MK2: yuvarlak döner tutucu
        cx, cz, r = 0, -.01, .072
        S.shadow(cx - r, cx + r, cz - r, cz + r, ty + .0003, op=.38, h=.03, round_=True)
        o = S.obj([cx, ty + .02, cz])
        S.cyl(o, [cx, ty, cz], [cx, ty + .012, cz], r, '#1a1b1e', cap='#202226', n=48, spec=.3)
        S.cyl(o, [cx, ty + .012, cz], [cx, ty + .026, cz], r - .006, '#3a2a8a', cap='#3b2c90', n=48, spec=.4)
        S.decal(o, [cx - r + .006, ty + .0262, cz - r + .006], [cx + r - .006, ty + .0262, cz - r + .006], [cx - r + .006, ty + .0262, cz + r - .006], 100, 100,
                '<circle cx="50" cy="50" r="50" fill="#3a2c8e"/><circle cx="50" cy="50" r="44" fill="none" stroke="#f2c418" stroke-width="5"/>'
                '<rect x="18" y="34" width="64" height="32" rx="3" fill="#1f6b43"/><rect x="24" y="40" width="20" height="14" fill="#2b2e33"/><rect x="50" y="42" width="10" height="10" fill="#c9ced4"/>'
                '<text x="50" y="84" text-anchor="middle" fill="#f2c418" font-size="11" font-weight="900" font-style="italic">MK2</text>')
        for sx in (-1, 1):
            S.cyl(o, [cx + sx*r, ty + .016, cz], [cx + sx*(r + .022), ty + .016, cz], .011, '#16171a', n=16, cap='#26282c')
    else:                        # Relife TF6: siyah taban, mavi çeneler
        x0, x1, z0, z1 = -.09, .09, -.075, .055
        S.shadow(x0, x1, z0, z1, ty + .0003, op=.38, h=.03)
        o = S.obj([0, ty + .015, -.01])
        S.box(o, x0, x1, ty, ty + .012, z0, z1, '#1c1d21', top='#25272c', spec=.3)
        S.box(o, -.055, .055, ty + .012, ty + .015, -.04, .025, '#1f6b43', top='#2a8a57')  # kart
        S.decal(o, [-.05, ty + .0152, -.035], [.05, ty + .0152, -.035], [-.05, ty + .0152, .02], 100, 55,
                '<rect x="10" y="10" width="26" height="22" fill="#2b2e33"/><rect x="44" y="12" width="14" height="14" fill="#c9ced4"/><rect x="66" y="8" width="24" height="10" fill="#2b2e33"/>'
                '<rect x="64" y="30" width="28" height="16" fill="#2b2e33"/><rect x="14" y="38" width="38" height="6" fill="#c9a24a" opacity=".7"/>')
        for xa, xb in ((x0 + .005, -.05), (.05, x1 - .005)):
            S.box(o, xa, xb, ty + .012, ty + .03, -.05, .03, '#1f6fd6', top='#3a8af0', spec=.4)
            S.cyl(o, [(xa+xb)/2, ty + .02, .03], [(xa+xb)/2, ty + .02, .045], .006, '#c9ced4', n=10, spec=.6)
        S.decal(o, [x0 + .005, ty + .0122, .045], [x0 + .06, ty + .0122, .045], [x0 + .005, ty + .0122, .054], 60, 10,
                '<text x="2" y="8" fill="#e8e9eb" font-size="7.5" font-weight="900">RELIFE TF6</text>')

    # ===== 7 HAVYA (sağ) =====
    S.tag = 'havya'
    if 'havya' in eksik:
        if ghosts: S.ghost(.27, .57, Y0, .9, -.14, .1, '+ Havya')
    elif sel['havya'] == 2745:   # Aixun T420D: ana gövde 112x125x178 + iki kol tutucu 65x77x154
        x0, x1, z0, z1 = .365, .477, -.13, .048
        S.shadow(x0, x1, z0, z1, Y0 + .0068, h=.125)
        o = S.obj([(x0+x1)/2, Y0 + .06, -.04]); feet(S, o, x0, x1, z0, z1, Y0 + .006)
        S.extrude(o, rr(z0, z1 - .003, Y0 + .008, Y0 + .133, .014), x0, x1, '#b8bec5', spec=.35)
        S.box(o, x0 + .002, x1 - .002, Y0 + .01, Y0 + .131, z1 - .003, z1, '#cfd4da', decal=t420_front2())
        for hx, lean in ((.325, -1), (.517, 1)):
            hx0, hx1, hz0, hz1 = hx - .0325, hx + .0325, -.11, .044
            S.shadow(hx0, hx1, hz0, hz1, Y0 + .0068, op=.32, h=.08)
            o = S.obj([hx, Y0 + .05, -.03])
            S.extrude(o, [(hz1, Y0 + .05), (hz1, Y0 + .008), (hz0, Y0 + .008), (hz0, Y0 + .077), (hz0 + .03, Y0 + .077)], hx0, hx1, '#c3c8ce', spec=.4)
            S.cyl(o, [hx, Y0 + .05, .016], [hx, Y0 + .056, .016], .022, '#9aa0a7', cap='#c9a24a', spec=.3)   # sünger/pirinç yuvası
            S.cyl(o, [hx, Y0 + .07, -.04], [hx, Y0 + .085, -.06], .016, '#dfe3e7', spec=.7)              # kol yuvası
            S.cyl(o, [hx, Y0 + .085, -.06], [hx + .003*lean, Y0 + .1, -.068], .006, '#e6e8eb', spec=.6)
            S.cyl(o, [hx + .003*lean, Y0 + .1, -.068], [hx + .008*lean, Y0 + .17, -.09], .011, '#2f5fd0', spec=.3)
            S.cyl(o, [hx + .008*lean, Y0 + .17, -.09], [hx + .012*lean, Y0 + .25, -.115], .0095, '#1b1c1f', spec=.3)
            S.cyl(o, [hx, Y0 + .077, -.105], [hx, Y0 + .33, -.105], .0022, '#c9ced4', n=8, spec=.7)        # kablo askısı
            S.curve(o, [[hx, Y0 + .33, -.105], [hx + .006*lean, Y0 + .345, -.105], [hx + .012*lean, Y0 + .33, -.105]], '#c9ced4', 1.6)
            S.curve(o, [[hx + .012*lean, Y0 + .25, -.115], [hx + .01*lean, Y0 + .33, -.11], [hx + .02*lean, Y0 + .25, -.13], [.42 + .02*lean, Y0 + .1, -.135]], '#141518', 2.4)
    else:                        # JBC CD-2
        S.shadow(.29, .45, -.14, .05, Y0 + .0068, h=.128)
        o = S.obj([.37, .8, -.04]); feet(S, o, .29, .45, -.13, .05, Y0 + .006)
        S.extrude(o, [(.012, Y0 + .118), (.05, Y0 + .012), (.042, Y0 + .006), (-.13, Y0 + .006), (-.13, Y0 + .122), (-.12, Y0 + .128), (.0, Y0 + .128)], .29, .45, '#1d1e22',
                  decals={0: havya_front()}, spec=.2)
        for x in (.31, .325): S.cyl(o, [x, Y0 + .128, -.08], [x, Y0 + .16, -.08], .005, '#c9ced4', n=8, spec=.6)
        S.shadow(.455, .56, -.1, .08, Y0 + .0068, op=.3, h=.06)
        o = S.obj([.51, .8, -.01])
        S.extrude(o, rr(-.1, .08, Y0 + .006, Y0 + .05, .01), .455, .56, '#25272c', spec=.2)
        S.cyl(o, [.51, Y0 + .05, .045], [.51, Y0 + .06, .045], .03, '#c9a24a', cap='#6d5c45', spec=.5)
        S.cyl(o, [.507, Y0 + .05, -.04], [.5, Y0 + .1, -.06], .017, '#bfc4ca', spec=.7)
        S.cyl(o, [.5, Y0 + .1, -.06], [.496, Y0 + .115, -.066], .0075, '#d5d9dd', spec=.6)
        S.cyl(o, [.496, Y0 + .115, -.066], [.488, Y0 + .17, -.085], .011, '#19a37a')
        S.cyl(o, [.488, Y0 + .17, -.085], [.48, Y0 + .23, -.105], .0095, '#1b1c1f')
        S.curve(o, [[.48, Y0 + .23, -.105], [.47, Y0 + .25, -.13], [.44, Y0 + .2, -.15], [.42, Y0 + .1, -.14]], '#141518', 3)

    # ===== 8 MULTİMETRE (ön sağ, ayağına yaslı) =====
    S.tag = 'olcu'; mx0, mx1 = .17, .245
    if 'olcu' in eksik:
        if ghosts: S.ghost(mx0, mx1, Y0, Y0 + .05, .1, .25, '+ Multimetre', big=False)
    else:
        S.shadow(mx0, mx1, .1, .25, Y0 + .0068, h=.05)
        o = S.obj([(mx0+mx1)/2, Y0 + .03, .17])
        hol = '#3f9a5a' if sel['olcu'] == 3025 else '#d8322a'
        S.extrude(o, [(.10, Y0 + .078), (.245, Y0 + .022), (.25, Y0 + .007), (.235, Y0 + .006), (.09, Y0 + .052)], mx0, mx1, hol, decals={0: meter_face(sel['olcu'])}, spec=.3)
        o2 = S.obj([.26, Y0 + .01, .2])   # problar
        S.curve(o2, [[mx0 + .015, Y0 + .03, .235], [.2, Y0 + .008, .29], [.3, Y0 + .008, .3], [.36, Y0 + .008, .26]], '#c8261f', 2.4)
        S.curve(o2, [[mx0 + .04, Y0 + .03, .235], [.23, Y0 + .008, .28], [.32, Y0 + .008, .28], [.37, Y0 + .008, .24]], '#1a1a1a', 2.4)

    # ===== ön dekor: flux şırıngaları (ileride sarf yuvası) =====
    S.tag = 'decor'
    S.shadow(-.2, -.08, .21, .27, Y0 + .0068, op=.3, h=.04)
    o = S.obj([-.14, .8, .24]); S.box(o, -.2, -.08, Y0 + .006, Y0 + .035, .21, .27, '#2c2f35', top='#3a3e45')
    for i, col in enumerate(['#c98a2b', '#e0b54a', '#9aa0a7']):
        x = -.175 + i*.035
        S.cyl(o, [x, Y0 + .035, .24], [x, Y0 + .14, .24], .009, col, spec=.3)
        S.cyl(o, [x, Y0 + .14, .24], [x, Y0 + .165, .24], .004, '#f2f2f2')
    return S

SLOTS = ['guc', 'cimbiz', 'sicak', 'duman', 'mikro', 'tutucu', 'havya', 'olcu']
OPTS = {'guc': [1996, 1916], 'cimbiz': [2981, 2710], 'sicak': [3066, 2671], 'duman': [2242, 3020],
        'mikro': [2913, 3030], 'tutucu': [3032, 2767], 'havya': [835, 2745], 'olcu': [3025, 1514]}

if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    open('out/tam.svg', 'w').write(build().render())
    open('out/b.svg', 'w').write(build(sel={k: v[1] for k, v in OPTS.items()}).render())
    open('out/eksik.svg', 'w').write(build(eksik=SLOTS).render())
