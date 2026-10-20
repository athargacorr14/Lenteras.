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
2. adminPin     -> ganti PIN admin
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
