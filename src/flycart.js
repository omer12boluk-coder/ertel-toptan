// 5.11.2026: sepete atınca tıklanan yerden üst menüdeki (ya da sağ alttaki) sepete küçük bir nokta kavis çizerek uçar, sepet zıplar
let px = 0, py = 0, pAt = 0;
if (typeof window !== 'undefined') addEventListener('pointerdown', (e) => { px = e.clientX; py = e.clientY; pAt = Date.now(); }, { capture: true, passive: true });
const vis = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight ? r : null; };
export function flyToCart(n = 1) {
  if (Date.now() - pAt > 900 || !('animate' in Element.prototype) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const tgt = ['.topbar .hcart', '.cart-fab', '.botnav .botnav-b .ic-cart'].map((s) => document.querySelector(s)).find((el) => vis(el));
  const r = vis(tgt); if (!r) return;
  const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  const d = document.createElement('span'); d.className = 'fly-dot'; d.textContent = '+' + n; document.body.appendChild(d);
  const mx = px + (tx - px) * 0.45, my = Math.min(py, ty) - 90;
  const a = d.animate([
    { transform: `translate(${px}px, ${py}px) scale(.6)`, opacity: 0 },
    { transform: `translate(${px}px, ${py - 18}px) scale(1.05)`, opacity: 1, offset: 0.12 },
    { transform: `translate(${mx}px, ${my}px) scale(.95)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${tx}px, ${ty}px) scale(.35)`, opacity: 0.4 },
  ], { duration: 620, easing: 'cubic-bezier(.5, 0, .3, 1)' });
  a.onfinish = () => { d.remove(); tgt.classList.remove('cart-bump'); void tgt.offsetWidth; tgt.classList.add('cart-bump'); setTimeout(() => tgt.classList.remove('cart-bump'), 520); };
}
