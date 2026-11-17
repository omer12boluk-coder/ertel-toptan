# Final sahnesi (101.45–105.6): İngilizce etiketleri sadece harf pikselleriyle sil, sağdaki modelin kırmızı kısımlarını siyaha boya
import cv2, numpy as np, os
os.makedirs('mv/clean_fin', exist_ok=True)
cap = cv2.VideoCapture('src.mp4'); a, b = round(101.40 * 25), round(105.64 * 25)
cap.set(cv2.CAP_PROP_POS_FRAMES, a)
ROIS = [(600, 650, 1010, 830), (1375, 680, 1655, 810)]
for i in range(a, b):
    ok, f = cap.read()
    if not ok: break
    lum = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.int16)
    mx = f.max(2).astype(np.int16); mn = f.min(2).astype(np.int16)
    m = np.zeros(lum.shape, np.uint8)
    for k, (x0, y0, x1, y1) in enumerate(ROIS):
        L = lum[y0:y1, x0:x1]; bg = cv2.medianBlur(L.astype(np.uint8), 41).astype(np.int16)
        sub = (((L > 226) & (mx[y0:y1, x0:x1] - mn[y0:y1, x0:x1] < 45)) | ((k == 1) & (np.abs(L - bg) > 16) & (mx[y0:y1, x0:x1] - mn[y0:y1, x0:x1] < 40) & (L > 90))).astype(np.uint8)
        m[y0:y1, x0:x1] = sub
    m = cv2.dilate(m, np.ones((5, 5), np.uint8)) * 255
    if m.any(): f = cv2.inpaint(f, m, 5, cv2.INPAINT_TELEA)
    # kırmızıyı siyaha (sağ yarı): tonu koru, rengi al, koyulaştır
    h, w = f.shape[:2]; R = f[:, int(w * .44):].astype(np.float32)
    bb, gg, rr = R[..., 0], R[..., 1], R[..., 2]
    red = np.clip(((rr - np.maximum(gg, bb)) - 10) / 22, 0, 1)
    red = cv2.GaussianBlur(red, (5, 5), 0)
    l = (0.3 * rr + 0.59 * gg + 0.11 * bb)
    dark = np.stack([np.minimum(l, 70) * .55 + 8] * 3, -1)
    R = R * (1 - red[..., None]) + dark * red[..., None]
    f[:, int(w * .44):] = np.clip(R, 0, 255).astype(np.uint8)
    cv2.imwrite(f'mv/clean_fin/{i + 1:05d}.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 93])
print('ok')
