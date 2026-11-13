# Tezgâh 3B → SVG: küçük bir perspektif motoru. Her şey gerçek 3B koordinatta (metre) durur,
# kamera biraz yandan ve yukarıdan bakar. Yüzeyler ışığa göre gölgelenir; ekran/yazı gibi
# ayrıntılar cihazın ön yüzüne "çıkartma" olarak yapıştırılır (afin dönüşüm).
import math, os

W, H = 1536, 1024
def v(*a): return list(a)
def add(a, b): return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
def sub(a, b): return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
def mul(a, s): return [a[0]*s, a[1]*s, a[2]*s]
def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def norm(a): l = math.sqrt(dot(a, a)) or 1; return mul(a, 1/l)

class Cam:
    def __init__(s, pos, target, F=1350):
        s.p = pos; f = norm(sub(target, pos)); r = norm(cross(f, [0, 1, 0])); u = cross(r, f)
        s.f, s.r, s.u, s.F = f, r, u, F
    def pr(s, p):
        d = sub(p, s.p); x, y, z = dot(d, s.r), dot(d, s.u), dot(d, s.f)
        return (W/2 + s.F*x/z, H/2 - s.F*y/z, z)

LIGHT = norm([-0.45, 0.85, 0.55])

def hexrgb(h): h = h.lstrip('#'); return [int(h[i:i+2], 16) for i in (0, 2, 4)]
def shade(col, n, amb=.54, k=.56, spec=0):
    """Işık: sol-üst-önden (pencere). Aydınlık yüz hafif sıcak, gölgede kalan hafif soğuk."""
    c = hexrgb(col); l = max(0, dot(n, LIGHT)); f = amb + k*l
    warm, cool = (255, 246, 232), (52, 62, 84)
    out = []
    for i, x in enumerate(c):
        v = x*f + spec*255*l**8
        v = v*(1 - .07*l) + warm[i]*.07*l          # ışık rengi
        v = v*(1 - .07*(1-l)) + cool[i]*.07*(1-l)  # gölgede mavimsi
        out.append(max(0, min(255, int(v))))
    return '#%02x%02x%02x' % tuple(out)


TEX_DEFS = (
 '<filter id="fBrush" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.55" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter>'
 '<filter id="fGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>'
 '<filter id="fWood" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0025 0.045" numOctaves="4" seed="11"/><feColorMatrix type="matrix" values="0.6 0 0 0 0.25  0.45 0 0 0 0.15  0.3 0 0 0 0.05  0 0 0 0 1"/></filter>'
 '<filter id="fPlaster" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" seed="5"/><feColorMatrix type="saturate" values="0"/></filter>'
 '<pattern id="tBrush" width="600" height="600" patternUnits="userSpaceOnUse"><rect width="600" height="600" filter="url(#fBrush)"/></pattern>'
 '<pattern id="tGrain" width="300" height="300" patternUnits="userSpaceOnUse"><rect width="300" height="300" filter="url(#fGrain)"/></pattern>'
 '<pattern id="tWood" width="1536" height="1024" patternUnits="userSpaceOnUse"><rect width="1536" height="1024" filter="url(#fWood)"/></pattern>'
 '<pattern id="tPlaster" width="400" height="400" patternUnits="userSpaceOnUse"><rect width="400" height="400" filter="url(#fPlaster)"/></pattern>'
 '<linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity=".04"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
)
MAT = {'brush': ('tBrush', .32, 'overlay'), 'plastic': ('tGrain', .10, 'overlay'), 'wood': ('tWood', .55, 'multiply'), 'plaster': ('tPlaster', .12, 'overlay'), 'rubber': ('tGrain', .14, 'overlay')}
def auto_mat(col):
    r, g, b = hexrgb(col); mx, mn = max(r, g, b), min(r, g, b); l = (mx + mn) / 2
    if mx - mn < 22 and l > 105: return 'brush'
    if l < 90: return 'plastic'
    return None

class Scene:
    def __init__(s, cam): s.cam = cam; s.textures = False; s.objs = []; s.base = []; s.pre = []; s.bg = []; s.grads = []; s.shadows = []; s.top = []
    def obj(s, depth_pt=None, base=False):
        o = {'faces': [], 'extra': [], 'z': None, 'pt': depth_pt, 'tag': getattr(s, 'tag', 'decor')}; (s.base if base else s.objs).append(o); return o
    def P(s, pts): return ' '.join('%.1f,%.1f' % s.cam.pr(p)[:2] for p in pts)
    def poly(s, o, pts, col, n, stroke=None, op=1, spec=0, grad=True, mat='auto'):
        cen = mul([sum(p[i] for p in pts) for i in range(3)], 1/len(pts))
        if dot(n, sub(s.cam.p, cen)) <= 0: return False
        if min(s.cam.pr(p)[2] for p in pts) < .05: return False      # kameranın arkası
        z = s.cam.pr(cen)[2]
        base = shade(col, n, spec=spec)
        if grad and len(pts) >= 4:
            gid = f'g{len(s.grads)}'; c = hexrgb(base)
            hi = '#%02x%02x%02x' % tuple(min(255, int(v*1.10 + 7)) for v in c); lo = '#%02x%02x%02x' % tuple(int(v*.80) for v in c)
            if n[1] > .7: hi, lo = '#%02x%02x%02x' % tuple(int(v*.94) for v in c), '#%02x%02x%02x' % tuple(min(255, int(v*1.06 + 4)) for v in c)
            s.grads.append(f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{hi}"/><stop offset="1" stop-color="{lo}"/></linearGradient>')
            fill = f'url(#{gid})'
        else: fill = base
        if stroke: st = f' stroke="{stroke}" stroke-width="1"'
        elif n[1] > .7: st = ' stroke="#ffffff" stroke-opacity=".28" stroke-width="1.2" stroke-linejoin="round"'
        else: st = f' stroke="{base}" stroke-width=".7" stroke-linejoin="round"'
        el = f'<polygon points="{s.P(pts)}" fill="{fill}"{st} opacity="{op}"/>'
        m = auto_mat(col) if mat == 'auto' else mat
        if m and getattr(s, 'textures', True):
            pid, a, bl = MAT[m]
            el += f'<polygon points="{s.P(pts)}" fill="url(#{pid})" opacity="{a}" style="mix-blend-mode:{bl}"/>'
        o['faces'].append((z, el))
        return True
    def tiles(s, o, axis, fixed, a0, a1, b0, b1, col, n, step=.25, tmat=None):
        """Büyük düz yüzeyi karolara böl (yakın kamerada bozulmasın). axis: 'z' (duvar/ön yüz) ya da 'y' (masa üstü)."""
        full = [[a0, b0, fixed], [a1, b0, fixed], [a1, b1, fixed], [a0, b1, fixed]] if axis == 'z' else [[a0, fixed, b0], [a1, fixed, b0], [a1, fixed, b1], [a0, fixed, b1]]
        if min(s.cam.pr(p)[2] for p in full) > .05:
            s.poly(o, full, col, n, grad=False, stroke=shade(col, n), mat=tmat); return
        A = a0
        while A < a1 - 1e-9:
            A2 = min(A + step, a1); B = b0
            while B < b1 - 1e-9:
                B2 = min(B + step, b1)
                if axis == 'z': pts = [[A, B, fixed], [A2, B, fixed], [A2, B2, fixed], [A, B2, fixed]]
                else: pts = [[A, fixed, B], [A2, fixed, B], [A2, fixed, B2], [A, fixed, B2]]
                s.poly(o, pts, col, n, grad=False, stroke=shade(col, n), mat=tmat)
                B = B2
            A = A2
    def extrude(s, o, prof, x0, x1, col, cap=None, decals=None, spec=0):
        """prof: [(z,y)...] yan kesit (x yönünde uzatılır). decals: {kenar_no: (w,h,svg)} — kenar i: prof[i]→prof[i+1] (i üst, i+1 alt olmalı)."""
        cz = sum(p[0] for p in prof)/len(prof); cy = sum(p[1] for p in prof)/len(prof); cen = [(x0+x1)/2, cy, cz]
        vis = {}
        for i in range(len(prof)):
            a, b = prof[i], prof[(i+1) % len(prof)]
            A, B, C, D = [x0, a[1], a[0]], [x1, a[1], a[0]], [x1, b[1], b[0]], [x0, b[1], b[0]]
            n = norm(cross(sub(B, A), sub(D, A)))
            mid = mul(add(A, C), .5)
            if dot(n, sub(mid, cen)) < 0: n = mul(n, -1)
            vis[i] = s.poly(o, [A, B, C, D], col, n, spec=spec)
            if decals and i in decals and vis[i]: s.decal(o, A, B, D, *decals[i])
        s.poly(o, [[x1, p[1], p[0]] for p in prof], cap or col, [1, 0, 0], spec=spec)
        s.poly(o, [[x0, p[1], p[0]] for p in prof][::-1], cap or col, [-1, 0, 0], spec=spec)
        if o['pt'] is None: o['pt'] = cen
    def box(s, o, x0, x1, y0, y1, z0, z1, col, top=None, side=None, decal=None, decal_top=None, spec=0, mat='auto'):
        c = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]
        F = [([4,5,6,7],[0,0,1],col), ([1,0,3,2],[0,0,-1],side or col), ([0,4,7,3],[-1,0,0],side or col),
             ([5,1,2,6],[1,0,0],side or col), ([7,6,2,3],[0,1,0],top or col)]
        vis = {}
        for idx, n, cc in F: vis[tuple(n)] = s.poly(o, [c[i] for i in idx], cc, n, spec=spec, mat=mat)
        if decal and vis[(0,0,1)]: s.decal(o, [x0,y1,z1], [x1,y1,z1], [x0,y0,z1], *decal)
        if decal_top and vis[(0,1,0)]: s.decal(o, [x0,y1,z0], [x1,y1,z0], [x0,y1,z1], *decal_top)
        if o['pt'] is None: o['pt'] = [(x0+x1)/2, (y0+y1)/2, (z0+z1)/2]
    def decal(s, o, tl, tr, bl, w, h, svg):
        P0, P1, P3 = s.cam.pr(tl), s.cam.pr(tr), s.cam.pr(bl)
        a, b = (P1[0]-P0[0])/w, (P1[1]-P0[1])/w; c, d = (P3[0]-P0[0])/h, (P3[1]-P0[1])/h
        import re as _re
        svg = _re.sub(r'(<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)" fill="(#07080a|#06080a|#2b66e0|#0d1a2e|#dfe9f5|#0a0c10|#07090b)"/>)',
                      lambda m: m.group(1) + f'<rect x="{m.group(2)}" y="{m.group(3)}" width="{m.group(4)}" height="{m.group(5)}" rx="{m.group(6)}" fill="url(#gGlass)"/>', svg)
        o['extra'].append(f'<g transform="matrix({a:.4f},{b:.4f},{c:.4f},{d:.4f},{P0[0]:.1f},{P0[1]:.1f})">{svg}</g>')
    def cyl(s, o, a, b, r, col, n=32, cap=None, spec=.25):
        ax = norm(sub(b, a)); t = [1,0,0] if abs(ax[0]) < .9 else [0,0,1]
        e1 = norm(cross(ax, t)); e2 = cross(ax, e1)
        ring = lambda p: [add(p, add(mul(e1, r*math.cos(2*math.pi*i/n)), mul(e2, r*math.sin(2*math.pi*i/n)))) for i in range(n)]
        A, B = ring(a), ring(b)
        for i in range(n):
            j = (i+1) % n; mid = (2*math.pi*(i+.5)/n)
            nn = add(mul(e1, math.cos(mid)), mul(e2, math.sin(mid)))
            s.poly(o, [A[i], A[j], B[j], B[i]], col, nn, spec=spec, grad=False)
        s.poly(o, B, cap or col, ax, spec=spec); s.poly(o, A[::-1], cap or col, mul(ax, -1))
        if o['pt'] is None: o['pt'] = mul(add(a, b), .5)
    def curve(s, o, pts, col, wpx, layer='obj'):
        # Catmull-Rom → noktalar → yol
        Q = []
        for i in range(len(pts)-1):
            p0 = pts[max(i-1, 0)]; p1 = pts[i]; p2 = pts[i+1]; p3 = pts[min(i+2, len(pts)-1)]
            for k in range(12):
                t = k/12; t2, t3 = t*t, t*t*t
                Q.append([.5*((2*p1[j]) + (-p0[j]+p2[j])*t + (2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2 + (-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3) for j in range(3)])
        Q.append(pts[-1])
        d = 'M' + ' L'.join('%.1f %.1f' % s.cam.pr(p)[:2] for p in Q)
        el = f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{wpx}" stroke-linecap="round" stroke-linejoin="round"/>'
        if layer == 'obj': o['faces'].append((s.cam.pr(Q[len(Q)//2])[2] - .05, el))
        else: s.bg.append(el)
    def shadow(s, x0, x1, z0, z1, y, op=.30, blur=9, h=.08, round_=False):
        """Üç katlı gölge: temas (keskin, koyu), düşen (ışığın tersine uzar), ortam (geniş, yumuşak)."""
        tag = getattr(s, 'tag', 'decor'); k = op/.30
        dx, dz = h*.62, -h*.22   # ışık soldan: gölge sağa (ekranda görünür)
        def poly(pts, o, b, col='#100c08'):
            s.shadows.append((tag, f'<polygon points="{s.P(pts)}" fill="{col}" opacity="{min(.9, o):.2f}" filter="url(#b{b})"/>'))
        if round_:
            cx, cz, rx, rz = (x0+x1)/2, (z0+z1)/2, (x1-x0)/2, (z1-z0)/2
            ring = lambda e, ox=0, oz=0: [[cx+ox+(rx+e)*math.cos(t*math.pi/16), y, cz+oz+(rz+e)*math.sin(t*math.pi/16)] for t in range(32)]
            poly(ring(.03), .2*k, 22); poly(ring(.004, dx*.5, dz*.5) + [], .34*k, 9); poly(ring(-.002), .6*k, 3)
            return
        e = .03; poly([[x0-e,y,z0-e],[x1+e,y,z0-e],[x1+e,y,z1+e],[x0-e,y,z1+e]], .24*k, 22)
        F = [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]]; G = [[p[0]+dx, y, p[2]+dz] for p in F]
        poly([F[3], F[0], G[0], G[1], G[2], F[2]] if dz < 0 else [F[0], F[1], G[1], G[2], G[3], F[3]], .42*k, 9)
        poly([[x0+.003,y,z0+.003],[x1-.003,y,z0+.003],[x1-.003,y,z1-.003],[x0+.003,y,z1-.003]], .62*k, 2)
    def ghost(s, x0, x1, y0, y1, z0, z1, label, col='#2f62d6', big=True):
        """Boş yuva: yerde kesik çizgili iz (panoda dikey çerçeve). Yazı/düğme arayüzde (s.anchors)."""
        if z1 - z0 < .05: pts = [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]]
        else: pts = [[x0, y0 + .001, z0], [x1, y0 + .001, z0], [x1, y0 + .001, z1], [x0, y0 + .001, z1]]
        d = s.P(pts); sc = col if z1 - z0 < .05 else '#ffffff'
        s.top.append(f'<polygon points="{d}" fill="{col}" fill-opacity=".12" stroke="{sc}" stroke-width="2.4" stroke-dasharray="9 7" stroke-linejoin="round" opacity=".95"/>')
        cx, cy, _ = s.cam.pr([(x0+x1)/2, (y0+y1)/2 if z1 - z0 < .05 else y0, (z0+z1)/2 if z1 - z0 >= .05 else z1])
        if not hasattr(s, 'anchors'): s.anchors = {}
        s.anchors[getattr(s, 'tag', 'x')] = (round(cx/W*100, 2), round(cy/H*100, 2), label)
    def label(s, p, txt):
        x, y, _ = s.cam.pr(p); w = len(txt)*8.2 + 26
        s.top.append(f'<g><rect x="{x-w/2:.1f}" y="{y-15:.1f}" width="{w:.1f}" height="30" rx="15" fill="#fff" opacity=".95"/>'
                     f'<text x="{x:.1f}" y="{y+5:.1f}" text-anchor="middle" font-size="14" font-weight="700" fill="#1c1e22">{txt}</text></g>')
    def render(s, defs='', overlay='', only=None, part='all', base=True, vig=True, tops=None):
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Inter,-apple-system,Segoe UI,Roboto,sans-serif">',
               '<defs>' + ''.join(f'<filter id="b{k}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{k}"/></filter>' for k in (2, 3, 6, 9, 14, 22)) +
               '<filter id="glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
               ''.join(s.grads) + TEX_DEFS + '<filter id="dof"><feGaussianBlur stdDeviation="1.1"/></filter><radialGradient id="sun" cx=".18" cy=".05" r=".9"><stop offset="0" stop-color="#fff3dc" stop-opacity=".9"/><stop offset="1" stop-color="#3a2c20" stop-opacity=".25"/></radialGradient><radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>' + defs + '</defs>']
        if base: out += s.pre
        for i, o in enumerate(s.base if base else []):
            g = [e for _, e in sorted(o['faces'], key=lambda t: -t[0])] + o['extra']
            out += (['<g filter="url(#dof)">'] + g + ['</g>']) if o.get('dof') else g
        if base: out += s.bg
        if part in ('all', 'shadow'): out += [e for t, e in s.shadows if only is None or t in only]
        objs = sorted([o for o in s.objs if (only is None or o['tag'] in only) and part in ('all', 'obj')], key=lambda o: -s.cam.pr(o['pt'])[2])
        for o in objs:
            out += [e for _, e in sorted(o['faces'], key=lambda t: -t[0])] + o['extra']
        if vig: out.append(f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')
        if getattr(s, 'textures', True):
            out.append(f'<rect width="{W}" height="{H}" fill="url(#sun)" style="mix-blend-mode:soft-light"/>')
            out.append(f'<rect width="{W}" height="{H}" fill="url(#tGrain)" opacity=".05" style="mix-blend-mode:overlay"/>')
        if tops or (tops is None and (base or only is None)): out += s.top
        out.append(overlay); out.append('</svg>')
        return '\n'.join(out)
