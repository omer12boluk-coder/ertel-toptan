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
  // 8.11.2026: liste aşağıda uzayınca (sonsuz liste) çubuk birden küçülüp yukarı zıplamasın → çubuğun hesapladığı sayfa boyu (shD)
  // gerçek boya ~0,35 sn'de yumuşakça yetişir. Kaydırmayla hareket ANINDA kalır (gecikme yok); sayfa kısalınca (sekme değişimi) anında.
  let shD = 0, easeRaf = 0;
  const live = () => root.classList.contains('sb-thin') && matchMedia(MQ).matches;
  const draw = () => {
    const vh = innerHeight; const sh = shD;
    const h = Math.max(48, (vh * vh) / sh); const max = vh - h - 8;
    const f = Math.min(1, Math.max(0, scrollY / Math.max(1, sh - vh)));
    th.style.height = h + 'px'; th.style.transform = `translateY(${4 + f * max}px)`;
  };
  const ease = () => {
    easeRaf = 0; const sh = root.scrollHeight;
    if (drag || Math.abs(sh - shD) < 1) shD = sh; else { shD += (sh - shD) * 0.16; easeRaf = requestAnimationFrame(ease); }
    draw();
  };
  const place = () => {
    raf = 0;
    const vh = innerHeight, sh = root.scrollHeight;
    if (!live() || sh <= vh + 2) { box.classList.remove('on'); box.style.display = 'none'; shD = sh; return false; }
    box.style.display = '';
    if (!shD || sh < shD || drag || !box.classList.contains('on')) shD = sh; // ilk çizim / kısalma / sürükleme / çubuk görünmüyorken: anında
    else if (sh > shD + 1 && !easeRaf) easeRaf = requestAnimationFrame(ease); // uzama: yumuşak
    draw();
    return true;
  };
  const show = (ms = 900) => { if (!place()) return; box.classList.add('on'); clearTimeout(hideT); if (!drag && !near) hideT = setTimeout(() => box.classList.remove('on'), ms); };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => show()); }, { passive: true });
  addEventListener('resize', () => place(), { passive: true });
  addEventListener('mousemove', (e) => {
    if (drag || !live()) return;
    const n = e.clientX >= innerWidth - 28; // 7.11.2026 (2): daha geniş yakalama alanı if (n === near) return; near = n;
    if (n) show(); else show(600);
  }, { passive: true });
  // çubuğun boşluğuna tıklayınca oraya atlar ve sürüklemeye devam eder (7.11.2026 (2): tutması zordu)
  box.addEventListener('pointerdown', (e) => {
    if (e.target !== box || !box.classList.contains('on')) return;
    const vh = innerHeight, sh = root.scrollHeight, h = th.offsetHeight;
    scrollTo(0, ((e.clientY - h / 2 - 4) / Math.max(1, vh - h - 8)) * (sh - vh)); place();
    th.dispatchEvent(new PointerEvent('pointerdown', { clientY: e.clientY, pointerId: e.pointerId, bubbles: false }));
  });
  th.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { th.setPointerCapture?.(e.pointerId); } catch {}
    drag = { y: e.clientY, s: scrollY }; box.classList.add('drag', 'on'); root.classList.add('sb-drag');
    const vh = innerHeight, sh = root.scrollHeight, h = th.offsetHeight, ratio = (sh - vh) / Math.max(1, vh - h - 8);
    const mv = (ev) => scrollTo(0, drag.s + (ev.clientY - drag.y) * ratio);
    const up = () => { th.removeEventListener('pointermove', mv); th.removeEventListener('pointerup', up); th.removeEventListener('pointercancel', up); drag = null; box.classList.remove('drag'); root.classList.remove('sb-drag'); show(700); };
    th.addEventListener('pointermove', mv); th.addEventListener('pointerup', up); th.addEventListener('pointercancel', up);
  });
  // sayfa içeriği değişince (sekme geçişi, liste uzayınca) boyu güncelle
  new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(() => place()); }).observe(document.body);
}
