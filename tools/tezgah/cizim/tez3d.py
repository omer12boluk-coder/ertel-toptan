# Tezgâh 3B → SVG: küçük bir perspektif motoru. Her şey gerçek 3B koordinatta (metre) durur,
# kamera biraz yandan ve yukarıdan bakar. Yüzeyler ışığa göre gölgelenir; ekran/yazı gibi
# ayrıntılar cihazın ön yüzüne "çıkartma" olarak yapıştırılır (afin dönüşüm).
import math, os

W, H = 1600, 1000
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
def shade(col, n, amb=.58, k=.48, spec=0):
    c = hexrgb(col); l = max(0, dot(n, LIGHT)); f = amb + k*l
    c = [min(255, int(x*f + spec*255*l**8)) for x in c]
    return '#%02x%02x%02x' % tuple(c)

class Scene:
    def __init__(s, cam): s.cam = cam; s.objs = []; s.base = []; s.pre = []; s.bg = []; s.shadows = []; s.top = []
    def obj(s, depth_pt=None, base=False):
        o = {'faces': [], 'extra': [], 'z': None, 'pt': depth_pt}; (s.base if base else s.objs).append(o); return o
    def P(s, pts): return ' '.join('%.1f,%.1f' % s.cam.pr(p)[:2] for p in pts)
    def poly(s, o, pts, col, n, stroke=None, op=1, spec=0):
        cen = mul([sum(p[i] for p in pts) for i in range(3)], 1/len(pts))
        if dot(n, sub(s.cam.p, cen)) <= 0: return False
        z = s.cam.pr(cen)[2]
        st = f' stroke="{stroke}" stroke-width="1"' if stroke else f' stroke="{shade(col, n)}" stroke-width=".6"'
        o['faces'].append((z, f'<polygon points="{s.P(pts)}" fill="{shade(col, n, spec=spec)}"{st} opacity="{op}"/>'))
        return True
    def box(s, o, x0, x1, y0, y1, z0, z1, col, top=None, side=None, decal=None, decal_top=None, spec=0):
        c = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]
        F = [([4,5,6,7],[0,0,1],col), ([1,0,3,2],[0,0,-1],side or col), ([0,4,7,3],[-1,0,0],side or col),
             ([5,1,2,6],[1,0,0],side or col), ([7,6,2,3],[0,1,0],top or col)]
        vis = {}
        for idx, n, cc in F: vis[tuple(n)] = s.poly(o, [c[i] for i in idx], cc, n, spec=spec)
        if decal and vis[(0,0,1)]: s.decal(o, [x0,y1,z1], [x1,y1,z1], [x0,y0,z1], *decal)
        if decal_top and vis[(0,1,0)]: s.decal(o, [x0,y1,z0], [x1,y1,z0], [x0,y1,z1], *decal_top)
        if o['pt'] is None: o['pt'] = [(x0+x1)/2, (y0+y1)/2, (z0+z1)/2]
    def decal(s, o, tl, tr, bl, w, h, svg):
        P0, P1, P3 = s.cam.pr(tl), s.cam.pr(tr), s.cam.pr(bl)
        a, b = (P1[0]-P0[0])/w, (P1[1]-P0[1])/w; c, d = (P3[0]-P0[0])/h, (P3[1]-P0[1])/h
        o['extra'].append(f'<g transform="matrix({a:.4f},{b:.4f},{c:.4f},{d:.4f},{P0[0]:.1f},{P0[1]:.1f})">{svg}</g>')
    def cyl(s, o, a, b, r, col, n=20, cap=None, spec=.25):
        ax = norm(sub(b, a)); t = [1,0,0] if abs(ax[0]) < .9 else [0,0,1]
        e1 = norm(cross(ax, t)); e2 = cross(ax, e1)
        ring = lambda p: [add(p, add(mul(e1, r*math.cos(2*math.pi*i/n)), mul(e2, r*math.sin(2*math.pi*i/n)))) for i in range(n)]
        A, B = ring(a), ring(b)
        for i in range(n):
            j = (i+1) % n; mid = (2*math.pi*(i+.5)/n)
            nn = add(mul(e1, math.cos(mid)), mul(e2, math.sin(mid)))
            s.poly(o, [A[i], A[j], B[j], B[i]], col, nn, spec=spec)
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
    def shadow(s, x0, x1, z0, z1, y, op=.30, blur=9):
        pad = .012
        s.shadows.append(f'<polygon points="{s.P([[x0-pad,y,z0-pad],[x1+pad,y,z0-pad],[x1+pad,y,z1+pad*2],[x0-pad,y,z1+pad*2]])}" fill="#000" opacity="{op}" filter="url(#b{blur})"/>')
    def ghost(s, x0, x1, y0, y1, z0, z1, label, col='#2f62d6', big=True):
        c = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]
        E = [(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]
        g = [f'<polygon points="{s.P([c[4],c[5],c[6],c[7]])}" fill="{col}" fill-opacity=".07"/>',
             f'<polygon points="{s.P([c[7],c[6],c[2],c[3]])}" fill="{col}" fill-opacity=".05"/>']
        for a, b in E:
            A, B = s.cam.pr(c[a]), s.cam.pr(c[b])
            g.append(f'<line x1="{A[0]:.1f}" y1="{A[1]:.1f}" x2="{B[0]:.1f}" y2="{B[1]:.1f}" stroke="{col}" stroke-width="2" stroke-dasharray="7 6" opacity=".9"/>')
        cx, cy, _ = s.cam.pr([(x0+x1)/2, (y0+y1)/2, z1])
        fs = 17 if big else 14; bw = len(label)*fs*.56 + 34; bh = fs*2.3
        g.append(f'<rect x="{cx-bw/2:.1f}" y="{cy-bh/2:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="{bh/2:.1f}" fill="{col}"/>'
                 f'<text x="{cx:.1f}" y="{cy+fs*.36:.1f}" text-anchor="middle" fill="#fff" font-size="{fs}" font-weight="700">{label}</text>')
        s.top.append('\n'.join(g))
    def label(s, p, txt):
        x, y, _ = s.cam.pr(p); w = len(txt)*8.2 + 26
        s.top.append(f'<g><rect x="{x-w/2:.1f}" y="{y-15:.1f}" width="{w:.1f}" height="30" rx="15" fill="#fff" opacity=".95"/>'
                     f'<text x="{x:.1f}" y="{y+5:.1f}" text-anchor="middle" font-size="14" font-weight="700" fill="#1c1e22">{txt}</text></g>')
    def render(s, defs='', overlay=''):
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Inter,-apple-system,Segoe UI,Roboto,sans-serif">',
               '<defs>' + ''.join(f'<filter id="b{k}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{k}"/></filter>' for k in (3, 6, 9, 14, 22)) +
               '<filter id="glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
               '<radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>' + defs + '</defs>']
        out += s.pre
        for o in s.base: out += [e for _, e in sorted(o['faces'], key=lambda t: -t[0])] + o['extra']
        out += s.bg + s.shadows
        objs = sorted(s.objs, key=lambda o: -s.cam.pr(o['pt'])[2])
        for o in objs:
            out += [e for _, e in sorted(o['faces'], key=lambda t: -t[0])] + o['extra']
        out.append(f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')
        out += s.top; out.append(overlay); out.append('</svg>')
        return '\n'.join(out)
