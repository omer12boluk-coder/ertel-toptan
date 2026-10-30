// =====================================================================
//  FIREBASE BAĞLANTISI (herkese açık web yapılandırması – gizli değildir)
//  Boş bırakılırsa uygulama DEMO modunda çalışır.
// =====================================================================
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAb8Q747XVc1e9f_ffp6Y1uWCc8QXDSXKk",
  authDomain: "erteltoptan.firebaseapp.com",
  projectId: "erteltoptan",
  storageBucket: "erteltoptan.firebasestorage.app",
  messagingSenderId: "1053773699238",
  appId: "1:1053773699238:web:72cdb3d5513cad8c29bc67"
};
// Site bekçisinin (Cloudflare) adresi: dolar kuru ve "Şimdi eşitle" butonu bunu kullanır
window.WATCH_URL = "https://ertel-b2b-watch.omer-12boluk.workers.dev";
// Resim/video adresi (Cloudflare R2 özel alan adı; bekçiden geçmez). Boşsa eski yol: yüklenenler bekçi /p/, ürün resimleri PlatinMarket.
// Doldurunca ör. "https://resim.ornek.com/" (sonunda / olmalı). IMG_PLATIN: PlatinMarket ürün resimleri de bu adresten (platin/…).
// Yeni adreste bulunamayan dosya kendiliğinden eski adresten denenir (main.jsx setupMediaFallback).
window.IMG_BASE = "";
window.IMG_PLATIN = false;
