# Keamanan Lenteras — PIN Admin/Kasir & Supabase

Dokumen ini menjelaskan apa yang sudah dikunci, apa yang masih harus kamu atur di dashboard Supabase, dan batasannya.
Tidak ada sistem yang "tidak mungkin dijebol", tetapi konfigurasi ini menutup celah umum dan sudah diuji (lihat bagian *Hasil uji*).

## 1. Login PIN (Admin & Kasir — satu PIN)

Saat ini admin dan kasir memakai **satu PIN yang sama** dan punya akses penuh (pesanan, booking, tanggal penuh, testimoni, QR meja).

* **PIN sementara: `admin123`.** Ini SANGAT LEMAH (kata umum + angka berurutan; muncul di daftar tebakan paling awal penyerang). Pakai hanya untuk uji coba, lalu ganti sebelum situs dipakai pelanggan sungguhan — minimal 12 karakter acak, atau frasa panjang.
* **Mode server (Supabase):** satu akun Supabase Auth dengan peran `admin`; **PIN = password akun itu**, diperiksa **oleh server** (bcrypt + rate limit Supabase Auth). Peran dibaca dari JWT (`app_metadata.role`) yang tidak bisa dipalsukan dari browser, dan **hak akses ditegakkan database (RLS)**. Ganti PIN: Dashboard -> Authentication -> Users -> akun staf.
* **Mode demo (tanpa server):** PIN dicek di browser (`demoPin` di `data.js`); datanya pun hanya di browser itu. Hanya untuk uji coba.
* Perlindungan tambahan: kunci bertahap setelah 5 PIN salah, keluar otomatis bila lama tidak aktif (`adminIdleMinutes`), token diperbarui otomatis & **dicabut di server saat Keluar**, token di `sessionStorage` (hilang saat tab ditutup).
* Ingin membedakan lagi? Database sudah mendukung peran `kasir` (hanya pesanan) — cukup buat akun kedua dengan peran itu.

## 2. Pengaturan WAJIB di Dashboard Supabase

1. **SQL Editor** → jalankan `supabase/schema.sql`, lalu `supabase/staff.sql` (ganti email-nya).
2. **Authentication → Sign In / Providers → Email**: **matikan "Allow new users to sign up"** (supaya tidak ada orang asing membuat akun), set **Minimum password length = 8** (`admin123` tepat 8 karakter), nyalakan *Secure password change*.
3. **Authentication → Rate Limits**: turunkan *Sign-ups and sign-ins* ke sekitar **10–15 per 5 menit per IP** (default 30).
4. **Authentication → Sessions**: *JWT expiry* biarkan 3600 dtk atau lebih pendek; aktifkan *Time-box user sessions* (mis. 12 jam) bila tersedia di planmu.
5. **Authentication → Users**: pastikan hanya ada akun admin & kasir milikmu. Email akun = alamat yang **kamu kendalikan** (bukan domain karangan: pemilik domain itu bisa meminta reset password).
6. **Project Settings → API**: salin hanya **anon public key** ke `data.js`. **JANGAN PERNAH** menaruh `service_role` key di situs/GitHub. Bila pernah terlanjur, *rotate* (Project Settings → API → JWT Settings).
7. **Advisors → Security Advisor**: jalankan dan pastikan tidak ada peringatan "RLS disabled" / "exposed auth.users".
8. **Database → Backups**: aktifkan (plan berbayar) atau ekspor berkala. Opsional: pasang `pg_cron` memanggil `select public.purge_old_data(90);` agar pesanan lama (nomor telepon!) terhapus otomatis.

## 3. Apa yang sudah dikunci di database (`schema.sql`)

* **Least privilege:** hak tabel untuk `anon`/`authenticated` dicabut lalu diberikan minimum. Pelanggan hanya bisa **membuat** pesanan/booking/testimoni — tidak bisa membaca, mengubah, atau menghapus data siapa pun.
* **RLS di semua tabel**, kebijakan per peran (`admin`/`kasir`), tabel `push_subs` & `rate_events` tertutup untuk semua klien.
* **Data dari pelanggan tidak dipercaya.** Trigger database menyanitasi: format kode (`LN-XXXXXX`, 6 karakter acak kuat), status awal dipaksa, panjang teks dipangkas, tanda `<` `>` dibuang, kunci data tak dikenal dibuang, **total dihitung ulang di server**, `adminNote` palsu dikosongkan, tanggal booking dibatasi 2 tahun ke depan.
* **Anti-spam:** pembatas laju per IP dan global untuk pesanan, booking, testimoni, dan langganan push.
* **Pelacakan lewat kode** (`track_order`) tidak mengembalikan nomor telepon. Kode 6 karakter (~1 miliar kombinasi) sulit ditebak.
* **Push aman:** hanya endpoint layanan push resmi (anti-SSRF), hanya untuk pesanan yang ada, maks 5 per pesanan.
* **Peran tidak bisa dipalsukan:** hanya `app_metadata.role` yang dipakai (bukan `user_metadata`).

## 4. Pengaman di sisi situs (`vercel.json`)

* **Content-Security-Policy ketat:** skrip hanya dari situs sendiri + cdnjs (pustaka QR dengan **SRI hash**), tanpa skrip/gaya inline, koneksi hanya ke `*.supabase.co`, tidak boleh di-iframe (anti-clickjacking).
* HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP. `admin.html` tidak diindeks mesin pencari & tidak di-cache.
* Folder `supabase/`, `*.sql`, `README.txt`, `SECURITY.md` tidak ikut dipublikasikan (`.vercelignore`).
* Semua data dari server di-escape sebelum ditampilkan di dashboard (pertahanan XSS berlapis bersama CSP & sanitasi database). Dashboard memperingatkan bila harga di pesanan **tidak cocok dengan menu resmi**.

## 5. Batasan yang jujur

* **Brute force PIN** dibatasi rate limit Supabase Auth, tetapi tidak ada penguncian per-akun bawaan. Karena itu PIN harus panjang dan acak — `admin123` akan tertebak cepat bila email staf diketahui. Untuk perlindungan ekstra gunakan Cloudflare di depan situs atau Supabase Auth Hooks (plan Pro).
* Email akun staf terlihat di kode situs (`staffEmail`); PIN tidak. Penyerang hanya bisa menebak PIN lewat API yang dibatasi laju, atau memicu email reset ke **kotak masukmu**.
* Pelanggan di Wi-Fi kafe berbagi satu IP, jadi batas laju per IP dibuat longgar (30 pesanan/menit/IP).
* Total & harga item berasal dari browser pelanggan. Server membatasi rentangnya dan menghitung ulang total, tetapi **kasir tetap harus mencocokkan dengan menu** (dashboard memberi peringatan otomatis). Verifikasi pembayaran QRIS tetap manual kecuali memakai payment gateway.
* Notifikasi saat browser ditutup butuh Web Push (lihat `README.txt`).

## 6. Hasil uji (otomatis)

* **Database (Postgres sungguhan, 66 pemeriksaan lolos):** anon tidak bisa baca/ubah/hapus; payload jahat ditolak atau dibersihkan; total dihitung ulang; kasir vs admin vs akun tanpa peran; `user_metadata` tidak dianggap peran; push SSRF ditolak; rate limit memblokir banjir dari satu IP tanpa memblokir IP lain; skema bisa dijalankan ulang.
* **Aplikasi (26 pemeriksaan lolos):** login satu PIN, PIN salah ditolak, akun tanpa peran admin ditolak, token kedaluwarsa diperbarui otomatis, logout mencabut token, XSS di dashboard tidak tereksekusi, alur pesanan → selesai → alarm HP pelanggan.
* **Browser sungguhan (Edge):** halaman utama, pesan, booking, dan admin berjalan di bawah CSP ketat tanpa pelanggaran.
* **Belum diuji:** koneksi ke project Supabase milikmu yang asli (hanya bisa dilakukan setelah kamu mengisi `supabaseUrl`/`supabaseKey`), serta pengiriman Web Push sungguhan.

Setelah menyambungkan Supabase, uji cepat: buka situs dalam jendela penyamaran → coba `…/rest/v1/orders?select=*` dengan anon key → harus mengembalikan **error izin / kosong**, bukan daftar pesanan.
