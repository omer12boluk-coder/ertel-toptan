# Canlı 3B için kayıt motoru: tez3d ile aynı arayüz, ama SVG yerine dünya koordinatlı ham veri tutar.
# Tarayıcıdaki çizici (canvas) kamerayı, ışığı, gölgeyi ve sıralamayı her karede kendisi yapar.
import math, re

def add(a, b): return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
def sub(a, b): return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
def mul(a, s): return [a[0]*s, a[1]*s, a[2]*s]
def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def norm(a): l = math.sqrt(dot(a, a)) or 1; return mul(a, 1/l)
LIGHT = norm([-0.45, 0.85, 0.55])
R = lambda v: round(v, 4)
def rp(p): return [R(p[0]), R(p[1]), R(p[2])]

class Cam:  # sadece uyumluluk için (etiket noktası hesapları)
    def __init__(s, pos, target, F=1400): s.p, s.t, s.F = pos, target, F

GLASS = re.compile(r'(<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)" fill="(#07080a|#06080a|#2b66e0|#0d1a2e|#dfe9f5|#0a0c10|#07090b)"/>)')

class Scene:
    def __init__(s, cam=None):
        s.cam = cam; s.objs = []; s.base = []; s.shadows = []; s.ghosts = []; s.bgw = []; s.tag = 'base'; s.anchors = {}; s.off = None
    def T(s, p): return p if not s.off else [p[0]+s.off[0], p[1]+s.off[1], p[2]+s.off[2]]
    def obj(s, depth_pt=None, base=False):
        o = {'f': [], 'd': [], 'c': [], 'pt': s.T(depth_pt) if depth_pt else None, 'tag': s.tag}
        (s.base if base else s.objs).append(o); return o
    def poly(s, o, pts, col, n, stroke=None, op=1, spec=0, grad=True, mat=None):
        f = [[rp(s.T(p)) for p in pts], col, [R(n[0]), R(n[1]), R(n[2])]]
        ex = {}
        if spec: ex['s'] = spec
        if not grad: ex['g'] = 0
        if stroke: ex['k'] = stroke
        if ex: f.append(ex)
        o['f'].append(f); return True
    def tiles(s, o, axis, fixed, a0, a1, b0, b1, col, n, step=.25, tmat=None):
        """Büyük düz yüzey: tek çokgen (tarayıcı yakın düzlemde kırpar, karo çizgisi olmaz)."""
        A, A2, B, B2 = a0, a1, b0, b1
        if axis == 'z': pts = [[A, B, fixed], [A2, B, fixed], [A2, B2, fixed], [A, B2, fixed]]
        elif axis == 'x': pts = [[fixed, B, A], [fixed, B, A2], [fixed, B2, A2], [fixed, B2, A]]
        else: pts = [[A, fixed, B], [A2, fixed, B], [A2, fixed, B2], [A, fixed, B2]]
        s.poly(o, pts, col, n, grad=False)
        if o['pt'] is None: o['pt'] = s.T([(a0+a1)/2, fixed, (b0+b1)/2])
    def extrude(s, o, prof, x0, x1, col, cap=None, decals=None, spec=0):
        cz = sum(p[0] for p in prof)/len(prof); cy = sum(p[1] for p in prof)/len(prof); cen = [(x0+x1)/2, cy, cz]
        for i in range(len(prof)):
            a, b = prof[i], prof[(i+1) % len(prof)]
            A, B, C, D = [x0, a[1], a[0]], [x1, a[1], a[0]], [x1, b[1], b[0]], [x0, b[1], b[0]]
            n = norm(cross(sub(B, A), sub(D, A)))
            if dot(n, sub(mul(add(A, C), .5), cen)) < 0: n = mul(n, -1)
            s.poly(o, [A, B, C, D], col, n, spec=spec)
            if decals and i in decals: s.decal(o, A, B, D, *decals[i])
        s.poly(o, [[x1, p[1], p[0]] for p in prof], cap or col, [1, 0, 0], spec=spec)
        s.poly(o, [[x0, p[1], p[0]] for p in prof][::-1], cap or col, [-1, 0, 0], spec=spec)
        if o['pt'] is None: o['pt'] = s.T(cen)
    def box(s, o, x0, x1, y0, y1, z0, z1, col, top=None, side=None, decal=None, decal_top=None, spec=0, mat=None):
        c = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]
        F = [([4,5,6,7],[0,0,1],col), ([1,0,3,2],[0,0,-1],side or col), ([0,4,7,3],[-1,0,0],side or col),
             ([5,1,2,6],[1,0,0],side or col), ([7,6,2,3],[0,1,0],top or col), ([0,1,5,4],[0,-1,0],side or col)]
        for idx, n, cc in F: s.poly(o, [c[i] for i in idx], cc, n, spec=spec)
        if decal: s.decal(o, [x0,y1,z1], [x1,y1,z1], [x0,y0,z1], *decal)
        if decal_top: s.decal(o, [x0,y1,z0], [x1,y1,z0], [x0,y1,z1], *decal_top)
        if o['pt'] is None: o['pt'] = s.T([(x0+x1)/2, (y0+y1)/2, (z0+z1)/2])
    def decal(s, o, tl, tr, bl, w, h, svg):
        n = norm(mul(cross(sub(tr, tl), sub(bl, tl)), -1))
        svg = GLASS.sub(lambda m: m.group(1) + f'<rect x="{m.group(2)}" y="{m.group(3)}" width="{m.group(4)}" height="{m.group(5)}" rx="{m.group(6)}" fill="url(#gGlass)"/>', svg)
        o['d'].append([rp(s.T(tl)), rp(s.T(tr)), rp(s.T(bl)), w, h, svg, [R(n[0]), R(n[1]), R(n[2])]])
    def cyl(s, o, a, b, r, col, n=32, cap=None, spec=.25):
        n = max(8, min(n, 24 if r > .015 else 14))
        ax = norm(sub(b, a)); t = [1,0,0] if abs(ax[0]) < .9 else [0,0,1]
        e1 = norm(cross(ax, t)); e2 = cross(ax, e1)
        ring = lambda p: [add(p, add(mul(e1, r*math.cos(2*math.pi*i/n)), mul(e2, r*math.sin(2*math.pi*i/n)))) for i in range(n)]
        A, B = ring(a), ring(b)
        for i in range(n):
            j = (i+1) % n; mid = (2*math.pi*(i+.5)/n)
            nn = add(mul(e1, math.cos(mid)), mul(e2, math.sin(mid)))
            s.poly(o, [A[i], A[j], B[j], B[i]], col, nn, spec=spec, grad=False)
        s.poly(o, B, cap or col, ax, spec=spec); s.poly(o, A[::-1], cap or col, mul(ax, -1))
        if o['pt'] is None: o['pt'] = s.T(mul(add(a, b), .5))
    def curve(s, o, pts, col, wpx, layer='obj'):
        Q = []
        for i in range(len(pts)-1):
            p0 = pts[max(i-1, 0)]; p1 = pts[i]; p2 = pts[i+1]; p3 = pts[min(i+2, len(pts)-1)]
            for k in range(8):
                t = k/8; t2, t3 = t*t, t*t*t
                Q.append([.5*((2*p1[j]) + (-p0[j]+p2[j])*t + (2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2 + (-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3) for j in range(3)])
        Q.append(pts[-1])
        o['c'].append([[rp(s.T(q)) for q in Q], col, wpx])
    def shadow(s, x0, x1, z0, z1, y, op=.30, blur=9, h=.08, round_=False):
        tag = s.tag; k = op/.30; dx, dz = h*.62, -h*.22
        def poly(pts, o, b): s.shadows.append([tag, [rp(s.T(p)) for p in pts], round(min(.9, o), 3), b])
        if round_:
            cx, cz, rx, rz = (x0+x1)/2, (z0+z1)/2, (x1-x0)/2, (z1-z0)/2
            ring = lambda e, ox=0, oz=0: [[cx+ox+(rx+e)*math.cos(t*math.pi/10), y, cz+oz+(rz+e)*math.sin(t*math.pi/10)] for t in range(20)]
            poly(ring(.03), .2*k, 22); poly(ring(.004, dx*.5, dz*.5), .34*k, 9); poly(ring(-.002), .6*k, 3); return
        e = .03; poly([[x0-e,y,z0-e],[x1+e,y,z0-e],[x1+e,y,z1+e],[x0-e,y,z1+e]], .24*k, 22)
        F = [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]]; G = [[p[0]+dx, y, p[2]+dz] for p in F]
        poly([F[3], F[0], G[0], G[1], G[2], F[2]], .42*k, 9)
        poly([[x0+.003,y,z0+.003],[x1-.003,y,z0+.003],[x1-.003,y,z1-.003],[x0+.003,y,z1-.003]], .62*k, 2)
    def ghost(s, x0, x1, y0, y1, z0, z1, label, col='#2f62d6', big=True):
        if z1 - z0 < .05: pts = [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]]; c = [(x0+x1)/2, (y0+y1)/2, z1]
        else: pts = [[x0, y0 + .001, z0], [x1, y0 + .001, z0], [x1, y0 + .001, z1], [x0, y0 + .001, z1]]; c = [(x0+x1)/2, y0, (z0+z1)/2]
        s.ghosts.append([s.tag, [rp(s.T(p)) for p in pts], 1 if z1 - z0 < .05 else 0])
        s.anchors[s.tag] = [rp(s.T(c)), label]
    # dünya koordinatlı düz çizimler (zemin çizgileri, delikler, bölmeler)
    def wline(s, a, b, col, w, op=1): s.bgw.append([len(s.base), 'l', rp(a), rp(b), col, w, op])
    def wdot(s, p, r, col, op=1): s.bgw.append([len(s.base), 'd', rp(p), r, col, op])
    def wpoly(s, pts, fill, stroke=None, sw=1, op=1): s.bgw.append([len(s.base), 'p', [rp(p) for p in pts], fill, stroke, sw, op])
    def label(s, *a): pass

def export(S, only=None, base=False):
    """only: etiket kümesi. Sonuç: {o: nesneler, s: gölgeler, g: hayalet izler, b: düz çizimler}"""
    sel = lambda t: only is None or t in only
    objs = [o for o in (S.base if base else S.objs) if sel(o['tag'])]
    out = {'o': [{'pt': rp(o['pt'] or [0, 0, 0]), 'f': o['f'], 'd': o['d'], 'c': o['c']} for o in objs]}
    sh = [x[1:] for x in S.shadows if sel(x[0])]
    if sh: out['s'] = sh
    gh = [x[1:] for x in S.ghosts if sel(x[0])]
    if gh: out['g'] = gh
    if base: out['b'] = S.bgw
    return out
