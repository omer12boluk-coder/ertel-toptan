# Tezgâh v4: 8 yuva × 2 ürün, gerçek ölçüler (metre), katmanlı gölge, doku yok.
# Kamera biraz yandan/yukarıdan; ışık sol-üst-önden (pencere).
from eng import *
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

TW_X0, TW_X1, TW_Y = -.46, -.18, 1.44
def tw_x(i): return TW_X0 + .035 + i*.07
KX0 = .44; KZ0, KZ1 = .185, .27; KY = Y0 + .006
TWZ = {  # id: (gövde renkleri, uç tipi, uç rengi, bant)
    1790: (('#5e4f6e', '#b9a7cc', '#7d6b8f'), 'duz', None, '2UUL'),
    1791: (('#5e4f6e', '#b9a7cc', '#7d6b8f'), 'egri', None, '2UUL'),
    2978: (('#8d939a', '#f4f6f8', '#7d838a'), 'duz', None, 'JC'),
    2709: (('#8d939a', '#f4f6f8', '#7d838a'), 'ince', None, None),
    3056: (('#1b47b8', '#4f86f0', '#1b3f9e'), 'egri', '#f4f4f0', 'delik'),
    2918: (('#26282c', '#5b5f66', '#202226'), 'yassi', '#3ecf6e', None),
    2953: (('#8d939a', '#f4f6f8', '#7d838a'), 'v', None, None),
    2287: (('#141518', '#4a4d53', '#101113'), 'yassi', None, 'K'),
}
TWZ_IDS = list(TWZ)
def tweezer_one(tid, w=48, h=204):
    (c0, c1, c2), tip, tipc, band = TWZ[tid]; cx = 24
    g = f'<defs><linearGradient id="tw{tid}" x1="0" x2="1"><stop offset="0" stop-color="{c0}"/><stop offset=".4" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>'
    wide = 1.5 if tip == 'yassi' else 1
    leg = lambda sx: f'M{cx+sx*9} 4 L{cx+sx*4.5*wide} 150 L{cx+sx*1.6*wide} 192 L{cx} 194 L{cx+sx*.6} 150 L{cx+sx*3} 4 Z'
    out = [g, f'<g transform="translate(6,5)" fill="#000" opacity=".22" filter="url(#b3)"><path d="{leg(-1)}"/><path d="{leg(1)}"/></g>',
           f'<g fill="url(#tw{tid})" stroke="{c2}" stroke-width=".6"><path d="{leg(-1)}"/><path d="{leg(1)}"/></g>']
    if tip == 'egri': out.append(f'<path d="M{cx-1} 186 q-1 9 9 15" fill="none" stroke="{tipc or c1}" stroke-width="3" stroke-linecap="round"/>')
    elif tipc: out.append(f'<path d="M{cx-4} 176 L{cx+4} 176 L{cx+2} 196 L{cx-2} 196 Z" fill="{tipc}"/>')
    if tip == 'v': out.append(f'<path d="M{cx-3} 190 L{cx} 200 L{cx+3} 190 Z" fill="#c9ced4"/>')
    if band == 'delik': out += [f'<circle cx="{cx}" cy="{y}" r="2.6" fill="#0d1a3a"/>' for y in (70, 84, 98, 112)]
    elif band: out.append(f'<rect x="{cx-10}" y="26" width="20" height="11" rx="2" fill="#1b1c1f" opacity=".85"/><text x="{cx}" y="34.5" text-anchor="middle" fill="#fff" font-size="6.5" font-weight="800">{band}</text>')
    return w, h, ''.join(out)

def stencil_svg():
    """Gerçek kalıp: fırçalanmış çelik, nokta ızgaralı çip desenleri, turuncu marka şeridi."""
    el = ['<defs><linearGradient id="stl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef0f3"/><stop offset=".5" stop-color="#cfd4da"/><stop offset="1" stop-color="#e4e7eb"/></linearGradient></defs>',
          '<rect width="120" height="80" rx="2" fill="url(#stl)"/>', '<text x="6" y="9" fill="#6d737a" font-size="5.5" font-weight="800">A13</text>']
    def bga(x, y, n, step):
        for i in range(n):
            for j in range(n):
                if (i in (0, n-1) or j in (0, n-1) or (i % 2 == 0 and j % 2 == 0)):
                    el.append(f'<circle cx="{x+i*step:.1f}" cy="{y+j*step:.1f}" r="{step*.32:.2f}" fill="#4b5158"/>')
        el.append(f'<rect x="{x-step*.8:.1f}" y="{y-step*.8:.1f}" width="{(n-1)*step+step*1.6:.1f}" height="{(n-1)*step+step*1.6:.1f}" fill="none" stroke="#9aa1a9" stroke-width=".4"/>')
    bga(10, 20, 9, 2.4); bga(42, 20, 7, 2.4); bga(70, 20, 11, 1.9); bga(10, 50, 6, 2.6); bga(36, 52, 5, 2.6)
    for i in range(6): el.append(f'<rect x="{62+i*8}" y="52" width="5" height="3" fill="#4b5158"/><rect x="{62+i*8}" y="62" width="5" height="3" fill="#4b5158"/>')
    el.append('<text x="60" y="76" text-anchor="middle" fill="#7d838a" font-size="4.5" font-weight="700">IP 11/Pro/Max-A13  T:0.12MM</text>')
    return 120, 80, ''.join(el)

SV_X0, SV_Z0 = -.355, .085
def sv_xz(i, x0=None, z0=None): x0 = SV_X0 if x0 is None else x0; z0 = SV_Z0 if z0 is None else z0; return x0 + .03 + (i % 2)*.055, z0 + .03 + (i // 2)*.055
SIVI = {  # sıvı lehim kavanozları: id: (tür, gövde, kapak, bant)
    2672: ('kavanoz', '#f2f2f2', '#d8342b', '#d8342b'),
    1894: ('kavanoz', '#f4f6f8', '#f4f6f8', '#2f62d6'),
    2917: ('kavanoz', '#f6f0f3', '#e85a9b', '#3a2a6e'),
    1892: ('kavanoz', '#d8342b', '#c42a22', '#1b1c1f'),
    1638: ('kavanoz', '#2f9a8a', '#e9f0f5', '#2f62d6'),
}
FLUX = {
    2203: ('sirinqa', '#e7cf8c', None, '#3ab36a'),
    2620: ('sirinqa', '#f2f4f6', None, '#2f62d6'),
    94: ('sirinqa', '#e3c27a', None, '#f2f2f2'),
    2631: ('kavanoz', '#2f9a55', '#3ab36a', None),
}
SIVI_IDS, FLUX_IDS = list(SIVI), list(FLUX)
FX_X0, FX_Z0 = .585, .185

# ---------- sahne ----------
SEL0 = {'isitici': 2035, 'keski': 2998, 'tornavida': 2702, 'guc': 1996, 'dramel': 2464, 'termal': 2183, 'sicak': 3066, 'duman': 2242, 'mikro': 2913, 'tutucu': 3032, 'havya': 835, 'olcu': 3025}

def build(eksik=(), sel=None, ghosts=True, tutucu_alt=None, twz=(1790, 2978, 0, 0), stack=2, sivi=(2672, 1894, 0, 0), flux=(2203, 0, 0, 0)):
    sel = {**SEL0, **(sel or {})}
    S = Scene()
    WALL, SIDE, FLOOR = '#ebe5db', '#e2dbcf', '#b8aa98'
    # --- oda: zemin, arka/yan duvarlar, pencere ---
    o = S.obj(base=True); S.tiles(o, 'y', 0, -2.4, 2.4, -.52, 2.6, FLOOR, [0, 1, 0], step=.4)
    o = S.obj(base=True); S.tiles(o, 'z', -.52, -2.4, 2.4, 0, 2.7, WALL, [0, 0, 1], step=.4)
    o = S.obj(base=True); o['pt'] = [-2.4, 1.3, 1]
    S.tiles(o, 'x', -2.4, -.52, 2.6, 0, 2.7, SIDE, [1, 0, 0], step=.4)
    o = S.obj(base=True); o['pt'] = [2.4, 1.3, 1]
    S.tiles(o, 'x', 2.4, -.52, 2.6, 0, 2.7, SIDE, [-1, 0, 0], step=.4)
    S.box(o, -2.4, 2.4, 0, .08, -.52, -.505, '#d8d0c3')                    # süpürgelik
    o = S.obj(base=True); o['pt'] = [-2.39, 1.5, .6]                       # pencere (sol duvar)
    S.box(o, -2.4, -2.37, .95, 2.15, -.1, 1.3, '#f4f1ea', side='#e9e4da')
    S.wpoly([[-2.368, 1.0, -.05], [-2.368, 1.0, 1.25], [-2.368, 2.1, 1.25], [-2.368, 2.1, -.05]], '#fdfbf4', '#d9d2c4', 3)
    S.wline([-2.366, 1.0, .6], [-2.366, 2.1, .6], '#d9d2c4', 4); S.wline([-2.366, 1.55, -.05], [-2.366, 1.55, 1.25], '#d9d2c4', 4)
    # --- delikli pano ---
    o = S.obj(base=True)
    S.box(o, -.92, .92, 1.22, 1.86, -.52, -.505, '#ddd6ca')
    for i in range(36):
        for j in range(13): S.wdot([-.88 + i*.05, 1.25 + j*.047, -.504], .0035, '#8a8275', .55)
    # --- masa (ayaklar önce, sonra üst ve ön kenar) ---
    for (lx, lz) in ((-1.54, .42), (1.48, .42), (-1.54, -.46), (1.48, -.46)):
        o = S.obj([lx + .03, .35, lz + .03], base=True); S.box(o, lx, lx + .06, 0, Y0 - .045, lz, lz + .06, '#8b6a47', side='#7a5b3c')
    o = S.obj([0, Y0 - .1, .44], base=True); S.box(o, -1.5, 1.45, Y0 - .12, Y0 - .045, .44, .46, '#9a7651')   # ön kayıt
    o = S.obj(base=True)
    S.tiles(o, 'y', Y0, -1.6, 1.6, -.52, .5, '#d6ae80', [0, 1, 0], step=.2)
    S.tiles(o, 'z', .5, -1.6, 1.6, Y0 - .045, Y0, '#a77b4e', [0, 0, 1], step=.2)
    for k in range(18):
        z = -.5 + k*.055 + (k % 3)*.007
        S.wline([-1.6, Y0 + .0003, z], [1.6, Y0 + .0003, z + .01*((k % 2)*2-1)], '#8a5a2c', .6 + (k % 3)*.3, .10)
    S.wpoly([[-1.6, Y0 + .0004, -.4], [-1.0, Y0 + .0004, -.45], [-.2, Y0 + .0004, .45], [-1.2, Y0 + .0004, .5]], '#fff6e0', None, 0, .16)   # pencere ışığı masada
    # --- raf ---
    o = S.obj(base=True)
    for x0 in (-1.02, .99): S.box(o, x0, x0 + .03, Y0, 1.06, -.5, -.2, '#3b3f46', top='#5a5f68')
    S.box(o, -1.02, 1.02, 1.04, 1.07, -.5, -.2, '#454a52', top='#5e646d', side='#30343a')
    S.shadow(-1.02, 1.02, -.5, -.2, Y0 + .0002, op=.13, h=.0)
    # --- silikon mat ---
    o = S.obj(base=True)
    S.box(o, -.8, .7, Y0, Y0 + .006, -.2, .32, '#3f6e74', top='#4a7d83')
    for i in range(1, 25): x = -.8 + i*.06; S.wline([x, Y0 + .0065, -.2], [x, Y0 + .0065, .32], '#9cc3c6', .7, .3)
    for k in range(1, 9): z = -.2 + k*.058; S.wline([-.8, Y0 + .0065, z], [.7, Y0 + .0065, z], '#9cc3c6', .7, .3)
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

    # ===== 2 CIMBIZ: panoda 4 yuvalı askı (askı hep var), her yuvaya tek cımbız =====
    S.tag = 'base'; cx0, cx1, cy = TW_X0, TW_X1, TW_Y
    o = S.obj(base=True)
    S.box(o, cx0, cx1, cy - .012, cy + .016, -.505, -.466, '#c9ced4', top='#e3e6ea', side='#aeb4bb', spec=.35, mat=None)
    for i in range(4):
        x = tw_x(i); S.wline([x - .012, cy + .0162, -.478], [x + .012, cy + .0162, -.478], '#7d838a', 2.2)
    for x in (cx0 + .012, cx1 - .012): S.cyl(o, [x, cy + .002, -.466], [x, cy + .002, -.462], .004, '#9aa0a7', n=10)
    S.tag = 'cimbiz'
    if ghosts and not any(twz): S.ghost(cx0, cx1, cy - .16, cy - .012, -.50, -.47, '+ Cımbız', big=False)
    for i, tid in enumerate(twz):
        if not tid: continue
        S.tag = f'cimbiz{i}'; x = tw_x(i)
        o = S.obj([x, cy - .08, -.48])
        S.decal(o, [x - .02, cy + .006, -.481], [x + .02, cy + .006, -.481], [x - .02, cy - .164, -.481], *tweezer_one(tid))
    S.tag = 'kalip'
    # ===== 2b KALIP DESTESİ (üst rafta, top kâğıt gibi) =====
    if not stack:
        if ghosts: S.ghost(KX0 - .005, KX0 + .125, KY, KY + .01, KZ0, KZ1, '+ Kalıp', big=False)
    else:
        n = {1: 3, 2: 9, 3: 20, 4: 38}[stack]; t = .0017
        S.shadow(KX0, KX0 + .12, KZ0, KZ1, KY + .0002, op=.32, h=n*t)
        o = S.obj([KX0 + .06, KY + .01, (KZ0 + KZ1)/2])
        import random; rnd = random.Random(7)
        for k in range(n):
            dx, dz = rnd.uniform(-.004, .004), rnd.uniform(-.003, .003)
            y = KY + k*t
            last = k == n - 1
            S.box(o, KX0 + dx, KX0 + .12 + dx, y, y + t*.8, KZ0 + dz, KZ1 + dz, '#b9bfc6', top='#d9dde2', side='#9aa1a9', spec=.6,
                  decal_top=stencil_svg() if last else None)
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
    elif sel['mikro'] == 30:   # AmScope SM-4NTP: ince geniş taban, krom direk, yatay çift krom kol + karşı ağırlık, kafa odak bloğunda
        BK, BK2, CH = '#1b1c1f', '#2a2c31', '#c9ced4'
        bx0, bx1, bz0, bz1 = -.17, .19, -.2, .1
        S.shadow(bx0, bx1, bz0, bz1, Y0 + .0068, op=.45, h=.02)
        o = S.obj([0, Y0 + .015, -.05])
        S.extrude(o, rr(bz0, bz1, Y0 + .006, Y0 + .022, .006), bx0, bx1, BK, spec=.3)
        S.decal(o, [bx0 + .02, Y0 + .019, bz1 + .0005], [bx0 + .2, Y0 + .019, bz1 + .0005], [bx0 + .02, Y0 + .009, bz1 + .0005], 200, 10,
                '<text x="4" y="8" fill="#cfd2d6" font-size="8" font-weight="800" letter-spacing="4">AMSCOPE</text>')
        px, pz, ry = .1, -.13, 1.13
        S.shadow(px - .02, px + .02, pz - .02, pz + .02, Y0 + .0222, op=.25, h=.45, round_=True)
        o = S.obj([px, 1.0, pz])
        S.cyl(o, [px, Y0 + .022, pz], [px, 1.27, pz], .016, CH, cap='#e9ecef', spec=.7)
        S.box(o, px - .03, px + .03, ry - .035, ry + .03, pz - .03, pz + .03, BK, top=BK2, spec=.3)            # direk bloğu
        S.cyl(o, [px, ry - .045, pz + .03], [px, ry - .045, pz + .05], .009, BK2)                            # sıkma düğmesi
        o = S.obj([.0, ry, pz])
        for dz in (-.013, .013):                                                                               # yatay çift krom kol
            S.cyl(o, [.27, ry, pz + dz], [-.1, ry, pz + dz], .0075, CH, spec=.8)
        S.box(o, .23, .29, ry - .03, ry + .03, pz - .035, pz + .035, BK, top=BK2, spec=.3)                   # karşı ağırlık
        S.box(o, -.11, -.05, ry - .03, ry + .03, pz - .035, pz + .035, BK, top=BK2, spec=.3)                 # kafa ucu bloğu
        S.cyl(o, [-.08, ry + .03, pz + .01], [-.07, ry + .07, pz + .01], .004, CH, spec=.8)                   # kilit kolu
        S.cyl(o, [-.08, ry - .03, pz], [-.08, 1.03, pz], .012, CH, spec=.7)                                   # aşağı inen kısa direk
        hx, hz = -.08, pz + .06
        o = S.obj([hx, .98, hz])
        S.box(o, hx - .035, hx + .035, .95, 1.04, pz + .02, pz + .07, BK, top=BK2, spec=.3)                   # odak bloğu
        for sx in (-1, 1): S.cyl(o, [hx + sx*.035, 1.0, pz + .045], [hx + sx*.06, 1.0, pz + .045], .024, '#202226', cap='#34373c')
        cx, cz = hx, pz + .12
        S.extrude(o, rr(cz - .05, cz + .045, .95, 1.06, .02), cx - .06, cx + .06, BK, spec=.3)                 # kafa
        S.box(o, cx - .045, cx + .045, .955, 1.055, cz + .045, cz + .047, BK, decal=(90, 100,
              '<rect width="90" height="100" rx="12" fill="#1b1c1f"/><text x="45" y="30" text-anchor="middle" fill="#e8e9eb" font-size="11" font-weight="800" font-style="italic">AmScope</text>'
              '<text x="45" y="88" text-anchor="middle" fill="#9aa0a6" font-size="7" font-weight="700">SM-4NTP</text>'))
        S.cyl(o, [cx, .95, cz], [cx, .9, cz], .04, BK, spec=.3)                                                # objektif
        S.cyl(o, [cx, .9, cz], [cx, .89, cz], .048, '#e9ecef', cap='#fbfcfd', spec=.6)
        S.cyl(o, [cx + .02, 1.06, cz - .02], [cx + .02, 1.12, cz - .02], .016, '#16171a'); S.cyl(o, [cx + .02, 1.12, cz - .02], [cx + .02, 1.13, cz - .02], .02, '#2a2c31')
        for sx in (-.03, .03):
            a_, b_ = [cx + sx, 1.04, cz + .01], [cx + sx*1.3, 1.11, cz + .08]
            S.cyl(o, a_, b_, .018, BK, spec=.35); S.cyl(o, b_, add(b_, mul(norm(sub(b_, a_)), .02)), .021, '#0c0c0e')
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
        o = S.obj([px, 1.0, pz]); S.cyl(o, [px, MB, pz], [px, 1.32 if not yang else 1.2, pz], .018, '#c9ced4' if not yang else '#1c1d21', cap='#e9ecef' if not yang else '#2a2c31', spec=.6)
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
    S.tag = 'tutucu'; S.off = [-.12, 0, .205]
    ty = Y0 + .006
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

    S.off = None
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

    # ===== 9 DRAMEL (önde, beşikte yatar) =====
    S.tag = 'dramel'; dx0, dx1, dz = .33, .52, .155
    if 'dramel' in eksik:
        if ghosts: S.ghost(dx0, dx1, Y0, Y0 + .04, dz - .03, dz + .03, '+ Dramel', big=False)
    else:
        S.shadow(dx0, dx1, dz - .025, dz + .025, Y0 + .0068, h=.035)
        o = S.obj([(dx0+dx1)/2, Y0 + .03, dz])
        for x in (dx0 + .035, dx1 - .045):   # beşikler
            S.box(o, x - .012, x + .012, Y0 + .006, Y0 + .022, dz - .02, dz + .02, '#1c1d21', top='#2a2c31')
        py = Y0 + .033
        if sel['dramel'] == 2464:   # 2UUL DA85 CVT Grinder Pro: yeşil alüminyum kalem
            S.cyl(o, [dx0 - .03, py, dz], [dx0 + .0, py, dz], .0012, '#d5d9dd', n=8, spec=.8)          # uç
            S.cyl(o, [dx0, py, dz], [dx0 + .025, py, dz], .009, '#c9ced4', spec=.7)                    # burun
            S.cyl(o, [dx0 + .025, py, dz], [dx0 + .07, py, dz], .0125, '#4e8a5c', spec=.35)            # tırtıklı tutma
            for k in range(6): S.cyl(o, [dx0 + .029 + k*.007, py, dz], [dx0 + .032 + k*.007, py, dz], .0129, '#3c6f48', n=24)
            S.cyl(o, [dx0 + .07, py, dz], [dx1, py, dz], .012, '#5b9a69', cap='#3c6f48', spec=.45)      # gövde
            S.decal(o, [dx0 + .12, py + .0122, dz - .006], [dx0 + .15, py + .0122, dz - .006], [dx0 + .12, py + .0122, dz + .006], 60, 24,
                    '<rect width="60" height="24" rx="5" fill="#0d0e10"/><text x="30" y="17" text-anchor="middle" fill="#7fe3a0" font-size="14" font-weight="700">25</text>')
        else:                        # 2UUL DA51 Torque Master: siyah gövde, yeşil koni burun, iğne
            S.cyl(o, [dx0 - .035, py, dz], [dx0 + .0, py, dz], .0011, '#d5d9dd', n=8, spec=.8)
            S.cyl(o, [dx0, py, dz], [dx0 + .022, py, dz], .006, '#5b9a69', spec=.4)
            S.cyl(o, [dx0 + .022, py, dz], [dx0 + .035, py, dz], .011, '#5b9a69', spec=.4)
            S.cyl(o, [dx0 + .035, py, dz], [dx1 - .012, py, dz], .0125, '#1b1c1f', spec=.45)
            S.cyl(o, [dx1 - .012, py, dz], [dx1, py, dz], .012, '#5b9a69', cap='#3c6f48', spec=.4)
            S.cyl(o, [dx0 + .06, py + .012, dz], [dx0 + .06, py + .0135, dz], .0035, '#3db0ff', n=12, spec=.6)

    # ===== 10 BORD ISITICI (ön sol): XZZ L2023 / Aixun iHeater Pro / Sunshine SS-T12B =====
    S.tag = 'isitici'
    H = {2035: (-.63, -.46, .07, .2, .05, '#d32a22', '#b9241d', '#3a3d43', 'XZZ', '190', '#ff3b30'),
         2455: (-.62, -.465, .075, .2, .045, '#a9c4e0', '#8eaecf', '#c9a24a', 'AiXun', '120', '#4fd1ff'),
         1953: (-.6, -.48, .085, .19, .04, '#2f8fd0', '#2478b4', '#b9bfc6', 'SUNSHINE', '120', '#e8f6ff')}
    if 'isitici' in eksik:
        if ghosts: S.ghost(-.62, -.465, Y0, Y0 + .03, .075, .2, '+ Bord ısıtıcı', big=False)
    else:
        ix0, ix1, iz0, iz1, hh, c1, c2, plate, brand, num, numc = H[sel['isitici']]
        S.shadow(ix0, ix1, iz0, iz1, Y0 + .0068, h=hh)
        o = S.obj([(ix0+ix1)/2, Y0 + hh/2, (iz0+iz1)/2])
        S.extrude(o, rr(iz0, iz1, Y0 + .006, Y0 + hh, .008), ix0, ix1, c1, cap=c2, spec=.35)
        w, d = ix1 - ix0, iz1 - iz0
        # üstte modül plakası (gümüş/altın) + anakart
        S.box(o, ix0 + w*.12, ix1 - w*.28, Y0 + hh, Y0 + hh + .006, iz0 + d*.18, iz1 - d*.12, plate, top=plate, spec=.5)
        S.box(o, ix0 + w*.2, ix1 - w*.36, Y0 + hh + .006, Y0 + hh + .008, iz0 + d*.3, iz1 - d*.25, '#1f6b43', top='#2a8a57')
        # ekran (sağ arka köşe) + marka
        S.decal(o, [ix1 - w*.25, Y0 + hh + .0004, iz0 + d*.1], [ix1 - w*.04, Y0 + hh + .0004, iz0 + d*.1], [ix1 - w*.25, Y0 + hh + .0004, iz0 + d*.5], 50, 50,
                f'<rect x="2" y="4" width="46" height="24" rx="4" fill="#0a0c10"/><text x="25" y="22" text-anchor="middle" fill="{numc}" font-size="15" font-weight="700" filter="url(#glow)">{num}</text>'
                f'<circle cx="14" cy="40" r="4" fill="#e8e9eb"/><circle cx="36" cy="40" r="4" fill="#e8e9eb"/>')
        S.decal(o, [ix0 + w*.05, Y0 + hh - .004, iz1 + .0005], [ix0 + w*.6, Y0 + hh - .004, iz1 + .0005], [ix0 + w*.05, Y0 + .01, iz1 + .0005], 110, 30,
                f'<text x="4" y="21" fill="#fff" font-size="15" font-weight="900" letter-spacing="1">{brand}</text>')
        if sel['isitici'] == 2035:   # XZZ: kırmızı çapraz mandallar
            for (x, z, sx) in ((ix0 + w*.18, iz1 - d*.18, 1), (ix1 - w*.32, iz0 + d*.22, -1)):
                S.box(o, x - .006, x + .006, Y0 + hh + .006, Y0 + hh + .011, z - .02, z + .02, '#e0332a', top='#f2493f')
    # ===== 11 TERMAL KAMERA (sağda, kendi tablası) =====
    S.tag = 'termal'; tx0, tx1, tz0, tz1 = .585, .705, -.175, -.06
    if 'termal' in eksik:
        if ghosts: S.ghost(tx0, tx1, Y0, Y0 + .2, tz0, tz1, '+ Termal kamera', big=False)
    else:
        S.shadow(tx0, tx1, tz0, tz1, Y0 + .0068, h=.06)
        o = S.obj([(tx0+tx1)/2, Y0 + .1, (tz0+tz1)/2])
        S.box(o, tx0, tx1, Y0 + .006, Y0 + .014, tz0, tz1, '#1a1b1e', top='#232529', spec=.4)
        S.box(o, tx0 + .025, tx1 - .025, Y0 + .014, Y0 + .0155, tz0 + .03, tz1 - .02, '#1f6b43', top='#2a8a57')   # kart
        if sel['termal'] == 1160:   # Mega-idea Super IR Cam 2S: gümüş kare direk + kutu kafa
            S.box(o, tx1 - .03, tx1 - .012, Y0 + .014, Y0 + .2, tz0 + .008, tz0 + .026, '#c9ced4', top='#e3e6ea', spec=.6)
            S.box(o, tx0 + .02, tx1 - .01, Y0 + .16, Y0 + .2, tz0 + .005, tz0 + .065, '#c3c8ce', top='#dfe3e7', spec=.6,
                  decal=(90, 40, '<rect width="90" height="40" fill="#c3c8ce"/><text x="45" y="24" text-anchor="middle" fill="#4a4f56" font-size="9" font-weight="900">MEGA-IDEA</text>'))
            S.cyl(o, [(tx0+tx1)/2, Y0 + .16, tz0 + .035], [(tx0+tx1)/2, Y0 + .156, tz0 + .035], .009, '#0d0e10', n=20)
        else:                        # Qianli Fire Eye Pro: katlanır gümüş kol + telefon
            S.box(o, tx1 - .028, tx1 - .012, Y0 + .014, Y0 + .17, tz0 + .006, tz0 + .02, '#c9ced4', top='#e3e6ea', spec=.6)
            S.box(o, tx0 + .02, tx1 - .012, Y0 + .155, Y0 + .17, tz0 + .006, tz0 + .02, '#c9ced4', top='#e3e6ea', spec=.6)
            S.box(o, tx0 + .02, tx0 + .045, Y0 + .145, Y0 + .17, tz0 + .02, tz0 + .06, '#2a2c31', top='#3a3d43')        # kamera kafası
            S.cyl(o, [tx0 + .0325, Y0 + .145, tz0 + .045], [tx0 + .0325, Y0 + .141, tz0 + .045], .007, '#0d0e10', n=16)
            S.box(o, tx0 + .015, tx1 - .015, Y0 + .17, Y0 + .245, tz0 + .004, tz0 + .012, '#1b1c1f',
                  decal=(90, 75, '<defs><linearGradient id="th" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1a6e"/><stop offset=".45" stop-color="#c2185b"/><stop offset=".7" stop-color="#ff9800"/><stop offset="1" stop-color="#ffee58"/></linearGradient></defs>'
                         '<rect width="90" height="75" rx="7" fill="#111"/><rect x="5" y="5" width="80" height="65" rx="4" fill="url(#th)"/><circle cx="56" cy="34" r="9" fill="#fffde7" opacity=".8"/>'))
    # ===== 12 TORNAVİDA (panoda, sağda) =====
    S.tag = 'tornavida'
    if 'tornavida' in eksik:
        if ghosts: S.ghost(.3, .52, 1.27, 1.46, -.50, -.47, '+ Tornavida', big=False)
    else:
        o = S.obj([.41, 1.37, -.49])
        if sel['tornavida'] == 2702:   # YCS-3D: 5 siyah tornavida, kırmızı kapak, askıda
            S.box(o, .31, .51, 1.43, 1.452, -.505, -.47, '#2a2c31', top='#3a3d43', spec=.3, mat=None)
            S.decal(o, [.315, 1.43, -.474], [.505, 1.43, -.474], [.315, 1.27, -.474], 190, 160,
                    ''.join(f'<g transform="translate({19+i*38},0)"><g transform="translate(4,4)" opacity=".22" fill="#000" filter="url(#b3)"><rect x="-8" y="0" width="16" height="66" rx="6"/><rect x="-1.8" y="66" width="3.6" height="80"/></g>'
                            f'<rect x="-9" y="-4" width="18" height="10" rx="4" fill="#d8342b"/><rect x="-8" y="4" width="16" height="64" rx="6" fill="#1b1c1f"/><rect x="-8" y="22" width="16" height="22" fill="#2c2e33"/>'
                            f'<rect x="-1.8" y="68" width="3.6" height="78" fill="#cfd3d8"/><rect x="-1" y="68" width="1" height="78" fill="#fff" opacity=".6"/></g>' for i in range(5)))
        else:                          # Mechanic HS-360: sarı uç kutusu + siyah sap
            S.box(o, .32, .44, 1.32, 1.42, -.503, -.475, '#f2c418', top='#f7d548', side='#d9a90c', spec=.3, mat=None,
                  decal=(120, 100, '<rect width="120" height="100" fill="#f2c418"/>' + ''.join(f'<rect x="{8+i*9}" y="14" width="6" height="40" rx="2" fill="#5b6067"/>' for i in range(12))
                         + '<rect x="0" y="62" width="120" height="38" fill="#e2b210"/><text x="60" y="86" text-anchor="middle" fill="#1b1c1f" font-size="13" font-weight="900" letter-spacing="1">HS-360</text>'))
            S.decal(o, [.455, 1.44, -.5], [.495, 1.44, -.5], [.455, 1.28, -.5], 40, 160,
                    '<g transform="translate(4,4)" opacity=".22" filter="url(#b3)"><rect x="12" y="0" width="16" height="80" rx="6"/></g><rect x="12" y="0" width="16" height="80" rx="6" fill="#1b1c1f"/><rect x="12" y="8" width="16" height="30" fill="#f2c418"/><rect x="18" y="80" width="4" height="70" fill="#cfd3d8"/>')

    # ===== 13 YAN KESKİ (panoda asılı) =====
    S.tag = 'keski'
    if 'keski' in eksik:
        if ghosts: S.ghost(.58, .7, 1.27, 1.46, -.50, -.47, '+ Yan keski', big=False)
    else:
        c1, c2 = (('#2f9a55', '#1f7a40') if sel['keski'] == 2998 else ('#f2c418', '#1b1c1f'))
        o = S.obj([.64, 1.37, -.49])
        S.cyl(o, [.64, 1.45, -.503], [.64, 1.45, -.49], .004, '#9aa0a7', n=10)
        handle = lambda sx, c: f'<path d="M{40+sx*6} 52 C{40+sx*10} 80 {40+sx*22} 120 {40+sx*26} 168 L{40+sx*16} 170 C{40+sx*12} 125 {40+sx*3} 85 {40+sx*1} 55 Z" fill="{c}"/>'
        svg = ('<g transform="translate(4,4)" opacity=".22" filter="url(#b3)">' + handle(-1, '#000') + handle(1, '#000') + '<path d="M30 6 L50 6 L46 52 L34 52 Z"/></g>'
               + '<path d="M36 4 L40 0 L44 4 L47 50 L33 50 Z" fill="#c9ced4" stroke="#8d939a" stroke-width=".8"/><line x1="40" y1="2" x2="40" y2="48" stroke="#7d838a" stroke-width="1"/>'
               + '<circle cx="40" cy="52" r="6" fill="#9aa0a6" stroke="#6d737a"/>' + handle(-1, c1) + handle(1, c1 if sel['keski'] == 2998 else c2)
               + (f'<path d="M{40-22} 125 L{40-18} 160 L{40-24} 162 Z" fill="{c2}"/>' if sel['keski'] == 402 else ''))
        S.decal(o, [.6, 1.45, -.5], [.68, 1.45, -.5], [.6, 1.28, -.5], 80, 172, svg)

    # ===== 14-15 SIVI LEHİM ve FLUX: ayrı 2x2 tepsiler (tepsi hep var) =====
    for slot, items, X0, Z0, TBL, lab in (('sivi', sivi, SV_X0, SV_Z0, SIVI, '+ Sıvı lehim'), ('flux', flux, FX_X0, FX_Z0, FLUX, '+ Flux')):
        S.tag = 'base'
        o = S.obj(base=True)
        S.box(o, X0, X0 + .115, Y0 + .006, Y0 + .014, Z0, Z0 + .115, '#d5d9de', top='#e6e9ec', side='#bfc4ca', spec=.3)
        for i in range(4):
            x, z = sv_xz(i, X0, Z0); S.cyl(o, [x, Y0 + .0142, z], [x, Y0 + .0145, z], .02, '#c3c8ce', n=20)
        S.shadow(X0, X0 + .115, Z0, Z0 + .115, Y0 + .0068, op=.25, h=.01)
        S.tag = slot
        if ghosts and not any(items): S.ghost(X0, X0 + .115, Y0 + .015, Y0 + .02, Z0, Z0 + .115, lab, big=False)
        for i, sid in enumerate(items):
            if not sid: continue
            S.tag = f'{slot}{i}'; x, z = sv_xz(i, X0, Z0); y = Y0 + .0145
            kind, body, lid, band = TBL[sid]
            S.shadow(x - .02, x + .02, z - .02, z + .02, y + .0002, op=.35, h=.03 if kind == 'kavanoz' else .09, round_=True)
            o = S.obj([x, y + .02, z])
            if kind == 'kavanoz':
                S.cyl(o, [x, y, z], [x, y + .024, z], .02, body, spec=.35)
                if band: S.cyl(o, [x, y + .008, z], [x, y + .016, z], .0203, band)
                S.cyl(o, [x, y + .024, z], [x, y + .034, z], .021, lid, cap=lid, spec=.45)
            else:
                S.cyl(o, [x, y, z], [x, y + .012, z], .012, '#e8eaed')
                S.cyl(o, [x, y + .012, z], [x, y + .085, z], .0075, body, spec=.45)
                S.cyl(o, [x, y + .04, z], [x, y + .07, z], .0077, band)
                S.cyl(o, [x, y + .085, z], [x, y + .09, z], .011, '#f4f4f4')
                S.cyl(o, [x, y + .09, z], [x, y + .105, z], .0025, '#f4f4f4')
    return S

SLOTS = ['keski', 'tornavida', 'guc', 'sicak', 'duman', 'termal', 'mikro', 'tutucu', 'havya', 'isitici', 'dramel', 'olcu']
OPTS = {'keski': [2998, 402], 'tornavida': [2702, 3053], 'guc': [1996, 1916], 'dramel': [2464, 2303], 'isitici': [2035, 2455, 1953], 'termal': [2183, 1160], 'sicak': [3066, 2671], 'duman': [2242, 3020],
        'mikro': [2913, 3030, 30], 'tutucu': [3032, 2767], 'havya': [835, 2745], 'olcu': [3025, 1514]}

if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    open('out/tam.svg', 'w').write(build().render())
    open('out/b.svg', 'w').write(build(sel={k: v[1] for k, v in OPTS.items()}, twz=TWZ_IDS[:4], stack=4).render())
    open('out/eksik.svg', 'w').write(build(eksik=SLOTS, twz=(0, 0, 0, 0), stack=0).render())
