# Kaynak videodaki İngilizce yazıları siler (yazı piksellerini bulup çevreden doldurur).
# Kullanım: python3 -I clean.py src.mp4 outdir [t1,t2,...]  (zaman listesi verilirse sadece o kareler)
import sys, os, cv2, numpy as np

# (başla, bitir, [(x0,y0,x1,y1,tür)...])  tür: w = beyaz yazı, r = kırmızı yazı, wr = ikisi
SPECS = [
    (4.90, 9.50, [(150, 460, 860, 670, 'wr')]),
    (11.85, 15.40, [(30, 440, 730, 700, 'wr', 55)]),
    (15.55, 19.95, [(1070, 820, 1830, 1078, 'wr', 55)]),
    (29.55, 34.10, [(60, 450, 790, 650, 'wr')]),
    (40.90, 44.70, [(50, 430, 730, 670, 'wr'), (50, 995, 900, 1065, 'wr', 75)]),
    (55.15, 58.90, [(70, 660, 850, 845, 'w'), (1220, 905, 1750, 1030, 'w')]),
    (68.00, 71.05, [(0, 690, 710, 860, 'w', 110), (1210, 910, 1800, 1050, 'w')]),
    (101.40, 105.70, [(600, 760, 880, 840, 'w'), (1360, 712, 1580, 795, 'w'), (0, 955, 1920, 1080, 'wr', 85)]),
]

def mask_for(roi, kind, lt=150):
    b, g, r = [roi[..., i].astype(np.int16) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    lum = (0.299 * r + 0.587 * g + 0.114 * b)
    m = np.zeros(roi.shape[:2], np.uint8)
    if 'w' in kind: m |= ((lum > lt) & (mx - mn < 70)).astype(np.uint8)
    if 'r' in kind: m |= ((r > 95) & (r > g * 1.45) & (r > b * 1.25)).astype(np.uint8)
    # tek tük parlak noktaları at, yazı gövdesini topla
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    m = cv2.dilate(m, np.ones((9, 9), np.uint8))
    return m * 255

def clean(frame, t):
    for t0, t1, boxes in SPECS:
        if not (t0 <= t <= t1): continue
        for bx in boxes:
            x0, y0, x1, y1, kind = bx[:5]; lt = bx[5] if len(bx) > 5 else 150
            pad = 12; X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(1920, x1 + pad), min(1080, y1 + pad)
            roi = frame[Y0:Y1, X0:X1].copy()
            m = np.zeros(roi.shape[:2], np.uint8)
            m[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = mask_for(frame[y0:y1, x0:x1], kind, lt)
            if m.any(): frame[Y0:Y1, X0:X1] = cv2.inpaint(roi, m, 7, cv2.INPAINT_TELEA)
    return frame

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
    only = [float(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
    cap = cv2.VideoCapture(src); i = 0; END = 105.64
    while True:
        ok, f = cap.read()
        if not ok: break
        t = i / 25
        if t > END: break
        if only is None or any(abs(t - o) < 0.02 for o in only):
            f = clean(f, t)
            cv2.imwrite(f'{out}/{i + 1:05d}.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 93])
        i += 1
