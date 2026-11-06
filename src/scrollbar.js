// 7.11.2026 İnce sayfa kaydırma çubuğu (bilgisayar, fareli): Windows'taki kalın gri çubuk gizlenir (html.sb-thin, CSS),
// yerine sayfanın üstünde süzülen ince çubuk çizilir: sadece kaydırırken ya da fare sağ kenara gelince belirir, sürüklenebilir.
// Eski hâle dönüş: Tasarım › Cam ve hareket › Kaydırma çubuğu 'Tarayıcının' (look.scrollbar = 'native').
const MQ = '(hover: hover) and (pointer: fine)';
export function setupScrollbar() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const box = document.createElement('div'); box.className = 'sbx'; box.setAttribute('aria-hidden', 'true');
  const th = document.createElement('i'); box.appendChild(th);
  document.body.appendChild(box);
  let hideT = 0, raf = 0, drag = null, near = false;
  const live = () => root.classList.contains('sb-thin') && matchMedia(MQ).matches;
  const place = () => {
    raf = 0;
    const vh = innerHeight, sh = root.scrollHeight;
    if (!live() || sh <= vh + 2) { box.classList.remove('on'); box.style.display = 'none'; return false; }
    box.style.display = '';
    const h = Math.max(36, (vh * vh) / sh); const max = vh - h - 8;
    th.style.height = h + 'px'; th.style.transform = `translateY(${4 + (scrollY / (sh - vh)) * max}px)`;
    return true;
  };
  const show = (ms = 900) => { if (!place()) return; box.classList.add('on'); clearTimeout(hideT); if (!drag && !near) hideT = setTimeout(() => box.classList.remove('on'), ms); };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => show()); }, { passive: true });
  addEventListener('resize', () => place(), { passive: true });
  addEventListener('mousemove', (e) => {
    if (drag || !live()) return;
    const n = e.clientX >= innerWidth - 16; if (n === near) return; near = n;
    if (n) show(); else show(600);
  }, { passive: true });
  th.addEventListener('pointerdown', (e) => {
    e.preventDefault(); th.setPointerCapture?.(e.pointerId);
    drag = { y: e.clientY, s: scrollY }; box.classList.add('drag', 'on'); root.classList.add('sb-drag');
    const vh = innerHeight, sh = root.scrollHeight, h = th.offsetHeight, ratio = (sh - vh) / Math.max(1, vh - h - 8);
    const mv = (ev) => scrollTo(0, drag.s + (ev.clientY - drag.y) * ratio);
    const up = () => { th.removeEventListener('pointermove', mv); th.removeEventListener('pointerup', up); th.removeEventListener('pointercancel', up); drag = null; box.classList.remove('drag'); root.classList.remove('sb-drag'); show(700); };
    th.addEventListener('pointermove', mv); th.addEventListener('pointerup', up); th.addEventListener('pointercancel', up);
  });
  // sayfa içeriği değişince (sekme geçişi, liste uzayınca) boyu güncelle
  new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(() => place()); }).observe(document.body);
}
