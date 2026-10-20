-- LENTERAS — beri peran admin pada akun staf (jalankan SETELAH supabase/schema.sql)
--
-- Hanya SATU akun untuk admin & kasir.
-- 1. Dashboard -> Authentication -> Users -> "Add user" -> "Create new user"
--      * Email = alamat yang kamu kendalikan (mis. namakafe+staf@gmail.com).
--      * Password = PIN login (admin.html). Minimal 8 karakter. SEKARANG: admin123 (LEMAH, segera ganti).
--      * Centang "Auto Confirm User".
-- 2. Ganti email di bawah dengan email akun tadi, lalu jalankan.
-- 3. Isi emailnya juga di data.js -> staffEmail.
--
-- Peran disimpan di app_metadata (hanya bisa diubah lewat SQL ini / service role, tidak bisa dipalsukan pengguna).
-- Peran masuk ke token saat login berikutnya. Ganti PIN kapan saja lewat Authentication -> Users.

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 where email = 'GANTI-dengan-email-staf@contoh.com';

-- Periksa hasilnya: harus muncul 1 baris dengan peran admin
select email, raw_app_meta_data ->> 'role' as role from auth.users where raw_app_meta_data ->> 'role' is not null;
