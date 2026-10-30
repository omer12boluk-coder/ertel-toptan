// ertelmarket.com/__/auth/* ve /__/firebase/* → erteltoptan.firebaseapp.com (Firebase'in önerdiği "giriş geçidi").
// Google ile giriş penceresi / yönlendirmesi sitenin kendi adresinden geçer: Safari bunu üçüncü taraf saymaz
// (telefonda açılır pencere engeli ve yönlendirme sonrası oturumun kaybolması böyle çözülür). 31.10.2026
const FB = 'https://erteltoptan.firebaseapp.com';
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/__/auth/') || url.pathname.startsWith('/__/firebase/')) {
      const r = await fetch(FB + url.pathname + url.search, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body, redirect: 'manual' });
      return new Response(r.body, r);
    }
    return env.ASSETS.fetch(req);
  },
};
