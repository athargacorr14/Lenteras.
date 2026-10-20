LENTERAS WEBSITE
================

Halaman:
- index.html    Landing page (cara pesan, menu pilihan, paket venue, lokasi)
- order.html    Pesan menu. Dari QR meja: order.html?table=7 (nomor meja terkunci)
- booking.html  Booking venue: tanggal, tamu, paket, pre-order menu, konfirmasi admin
- admin.html    Kasir/admin: pesanan, booking, tanggal penuh, generator QR meja (PIN demo: 2468)
- data.js       Konfigurasi + seluruh menu & harga (dari PDF menu Lenteras). Edit di sini.

Preview: buka index.html (atau Live Server). Deploy: static (Vercel) tanpa build.

Yang WAJIB diisi di data.js sebelum online:
1. whatsapp     -> nomor WA kasir (6281234567890)
2. demoPin / staffEmail -> lihat SECURITY.md (PIN admin & kasir: satu PIN, sementara admin123)
3. tableCount   -> jumlah meja
4. Taruh gambar QRIS resmi di assets/qris.png

Cetak QR meja: admin.html -> tab "QR Meja". Ganti alamat dengan domain online lebih dulu.

CATATAN PENTING (mode demo)
- Pesanan & booking disimpan di localStorage browser, jadi pesanan dari HP pelanggan BELUM
  otomatis muncul di perangkat kasir. Sementara, pesanan dikirim juga lewat tombol WhatsApp.
  Untuk sistem sungguhan, sambungkan database (mis. Supabase/Firebase): ganti Store di core.js.
- Pembayaran QRIS belum terverifikasi otomatis: pelanggan menekan "Saya sudah bayar", kasir
  mencocokkan mutasi lalu klik verifikasi. Verifikasi otomatis butuh payment gateway (Midtrans/Xendit).
- PIN admin di sisi browser bukan pengamanan sungguhan; butuh login server untuk produksi.

Perlu dicek dengan pemilik:
- Alamat di PDF menu: Jl. Kemang Boulevard, Sukaresmi, Cikarang Selatan (situs lama menulis Metland Cibitung).
- Rokok tidak dimasukkan ke menu online. Paket venue belum berisi harga/kapasitas.
- Harga "Lumpia Ayam" (Rp 40.000) dan sambal (Rp 8.000 per pilihan) dibaca dari tata letak PDF.
- Foto masih referensi Unsplash; ganti dengan foto asli.

UPDATE: FOTO MENU, TESTIMONI, ANIMASI
- Foto menu dipotong dari PDF menu Lenteras (folder assets/menu, peta nama->foto di data.js: MENU_IMAGES).
  Menu tanpa foto di PDF memakai tile "L." sampai foto aslinya ditambahkan.
- Testimoni di landing masih CONTOH (ditandai di halaman). Pelanggan bisa kirim testimoni lewat form;
  admin menyetujui di admin.html -> tab Testimoni. Hapus SAMPLE_TESTIMONIALS di data.js bila sudah punya ulasan asli.
  (Mode demo: ulasan tersimpan di browser yang sama, sama seperti pesanan.)
- Animasi mati otomatis untuk pengguna dengan pengaturan "reduce motion".

UPDATE REVISI
- Logo: assets/logo.png (dari logo resmi). Header sekarang terang agar logo terbaca.
- Kartu menu di beranda: foto penuh + tombol "Pesan sekarang" (menambah ke keranjang lalu membuka halaman pesan);
  ikon hati menandai favorit (tersimpan di browser). Daftar menu beranda diatur di data.js (FAVOURITES).
- Kategori menu dipindah ke atas kartu; footer baru; ikon testimoni diganti SVG.
- Animasi scroll: muncul dari berbagai arah, bar progres di atas, bar CTA "Pesan Menu / Booking Venue" di HP.

=====================================================================
SISTEM PESANAN ONLINE + NOTIFIKASI "PESANAN SIAP"
=====================================================================
Cara kerja
1. Pelanggan membuat pesanan -> disimpan dengan kode unik (LN-XXXX). Setelah dibayar/diverifikasi statusnya "diproses".
2. Admin membuka admin.html, saat pesanan siap menekan "Selesai - pesanan siap".
3. Halaman pesanan di HP pelanggan memeriksa status tiap 3 detik. Begitu "selesai": bunyi lonceng berulang,
   getar, layar "Pesananmu sudah siap!", judul tab berkedip, dan notifikasi sistem.

Dua mode
- MODE DEMO (default, supabaseUrl kosong): data hanya di browser. Cukup untuk uji coba di satu perangkat.
- MODE SERVER (Supabase): pesanan dari HP pelanggan masuk ke dashboard admin di perangkat lain, dan status
  "Selesai" sampai ke HP pelanggan. Langkah:
  a. Buat project Supabase -> SQL Editor -> jalankan supabase/schema.sql.
  b. Buat 1 akun staf di Authentication -> Users (password = PIN, sekarang admin123 — GANTI nanti), lalu jalankan
     supabase/staff.sql. Matikan "Allow new users to sign up".
  c. Isi data.js: supabaseUrl, supabaseKey (kunci "anon public"), dan staffEmail.
     Login di admin.html: cukup PIN (satu PIN untuk admin & kasir). BACA SECURITY.md (daftar pengaturan wajib).
  d. (Opsional) Notifikasi saat halaman/browser DITUTUP -> Web Push:
       - npx web-push generate-vapid-keys; kunci publik -> data.js (vapidPublicKey).
       - Deploy supabase/functions/notify-order (petunjuk lengkap di komentar index.ts) dan pasang Database Webhook
         pada tabel orders (UPDATE).
  Hasil uji otomatis alur penuh (pelanggan -> server -> admin -> alarm pelanggan) lolos memakai server tiruan;
  koneksi ke project Supabase asli belum diuji dari sini.

Batasan yang perlu diketahui (soal "suara tetap jalan saat halaman/browser ditutup")
- Halaman web TIDAK bisa memutar suara sendiri setelah ditutup. Yang bisa: Web Push -> notifikasi sistem HP
  (bunyi & getar bawaan HP) lewat service worker sw.js. Itu butuh langkah (d) di atas dan pelanggan menekan
  "Aktifkan" notifikasi. Android Chrome: tetap diterima saat aplikasi ditutup. iPhone: situs harus ditambahkan
  ke Layar Utama (iOS 16.4+). Browser desktop yang tertutup penuh tidak menerima push.
- Tanpa Web Push, bunyi hanya jalan selama halaman masih terbuka (boleh di background / layar mati sebentar,
  tetapi HP dapat menjeda halaman yang lama tidak dipakai).
- Browser baru mengizinkan suara setelah pelanggan menyentuh layar (menekan "Pesan" sudah cukup).

Perubahan lain (revisi 5)
- Navbar semi-transparan krem; kategori menu beranda = chip yang bisa digeser (panah/seret/geser jari) dan membuka
  order.html?cat=...; galeri "Suasana" dapat diklik (lightbox foto detail, mis. Intimate Wedding 7 foto);
  rating testimoni dipindah di bawah kolom pengalaman. Data galeri: GALLERY di data.js (foto masih referensi).
