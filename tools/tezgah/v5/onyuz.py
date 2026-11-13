import math
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

