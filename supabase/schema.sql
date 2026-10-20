-- =====================================================================
-- LENTERAS — skema Supabase (versi aman / hardened)
-- Jalankan di Supabase Dashboard -> SQL Editor. Aman dijalankan ulang (idempotent).
-- Setelah ini jalankan supabase/staff.sql untuk memberi peran admin/kasir pada akun staf.
--
-- Prinsip keamanan
--  1. Least privilege: pelanggan (anon) HANYA boleh membuat pesanan/booking/testimoni/langganan push.
--     Mereka tidak bisa membaca/mengubah/menghapus data apa pun (kecuali tanggal tutup & testimoni yang disetujui).
--  2. Pelanggan melihat statusnya lewat KODE (fungsi RPC) tanpa data pribadi (nomor HP tidak dikembalikan).
--  3. Staf = pengguna Supabase Auth dengan klaim app_metadata.role = 'admin' | 'kasir'.
--     app_metadata hanya bisa diubah oleh service role (tidak bisa dipalsukan pengguna).
--  4. Semua data masuk dari pelanggan DISANITASI oleh trigger di database (bukan percaya pada browser):
--     format kode, status awal, panjang teks, tanda < >, total dihitung ulang dari item, kunci tak dikenal dibuang.
--  5. Pembatasan laju (rate limit) per IP & global untuk mencegah spam/banjir data.
--  6. RLS aktif di semua tabel; hak akses tabel dicabut lalu diberikan satu per satu.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  code        text primary key,
  status      text not null default 'menunggu-bayar',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.bookings (
  code        text primary key,
  status      text not null default 'menunggu',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.reviews (
  code        text primary key,
  status      text not null default 'pending',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.blocked_dates (
  date        date primary key,
  reason      text
);
create table if not exists public.push_subs (
  id          bigint generated always as identity primary key,
  order_code  text not null,
  sub         jsonb not null,
  created_at  timestamptz not null default now()
);
create table if not exists public.rate_events (
  id          bigint generated always as identity primary key,
  ip          text not null,
  kind        text not null,
  at          timestamptz not null default now()
);
create index if not exists rate_events_idx on public.rate_events (kind, ip, at);
create index if not exists push_subs_code_idx on public.push_subs (order_code);

-- Batasan (constraint) pada kolom
alter table public.orders
  drop constraint if exists orders_code_fmt, drop constraint if exists orders_status_ok, drop constraint if exists orders_data_ok,
  add constraint orders_code_fmt  check (code ~ '^LN-[A-HJ-NP-Z2-9]{6}$') not valid,
  add constraint orders_status_ok check (status in ('menunggu-bayar','menunggu-verifikasi','diproses','siap','selesai','batal')) not valid,
  add constraint orders_data_ok   check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 16000) not valid;
alter table public.bookings
  drop constraint if exists bookings_code_fmt, drop constraint if exists bookings_status_ok, drop constraint if exists bookings_data_ok,
  add constraint bookings_code_fmt  check (code ~ '^BK-[A-HJ-NP-Z2-9]{6}$') not valid,
  add constraint bookings_status_ok check (status in ('menunggu','tersedia','ditolak')) not valid,
  add constraint bookings_data_ok   check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 16000) not valid;
alter table public.reviews
  drop constraint if exists reviews_code_fmt, drop constraint if exists reviews_status_ok, drop constraint if exists reviews_data_ok,
  add constraint reviews_code_fmt  check (code ~ '^RV-[A-HJ-NP-Z2-9]{6}$') not valid,
  add constraint reviews_status_ok check (status in ('pending','approved')) not valid,
  add constraint reviews_data_ok   check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 4000) not valid;
alter table public.blocked_dates
  drop constraint if exists blocked_reason_len, add constraint blocked_reason_len check (reason is null or char_length(reason) <= 200) not valid;

-- ---------------------------------------------------------------------
-- 2. FUNGSI BANTU
-- ---------------------------------------------------------------------
-- Peran staf dari JWT (app_metadata.role). Kosong bila bukan staf.
create or replace function public.staff_role() returns text
language sql stable as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') $$;

-- IP klien (best effort): cf-connecting-ip diset Cloudflare & tidak bisa dipalsukan klien.
create or replace function public.client_ip() returns text
language sql stable as $$
  with h as (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as j)
  select coalesce(
    nullif(h.j ->> 'cf-connecting-ip', ''),
    nullif(h.j ->> 'x-real-ip', ''),
    nullif(trim(reverse(split_part(reverse(coalesce(h.j ->> 'x-forwarded-for', '')), ',', 1))), ''),
    'unknown') from h
$$;

-- Pembatas laju: p_ip_max per IP dan p_global_max total dalam jendela p_window.
create or replace function public.check_rate(p_kind text, p_ip_max int, p_window interval, p_global_max int) returns void
language plpgsql security definer set search_path = public as $$
declare v_ip text := public.client_ip(); n int; g int;
begin
  delete from public.rate_events where at < now() - interval '2 hours';
  select count(*) into n from public.rate_events where kind = p_kind and ip = v_ip and at > now() - p_window;
  select count(*) into g from public.rate_events where kind = p_kind and at > now() - p_window;
  if n >= p_ip_max or g >= p_global_max then
    raise exception 'terlalu banyak permintaan, coba lagi nanti' using errcode = 'P0001';
  end if;
  insert into public.rate_events (ip, kind) values (v_ip, p_kind);
end $$;

-- Teks bebas: pangkas, buang kontrol & tanda < > (pertahanan berlapis terhadap XSS), batasi panjang.
create or replace function public.clean_text(p text, p_max int) returns text
language sql immutable as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[<>]', '', 'g'), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max)
$$;

-- Sanitasi daftar item (dipakai pesanan & booking). Mengembalikan [items, total].
create or replace function public.clean_items(p_items jsonb, p_min int) returns jsonb
language plpgsql immutable as $$
declare it jsonb; items jsonb := '[]'::jsonb; q int; p bigint; total bigint := 0; n int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    if p_min > 0 then raise exception 'item tidak valid'; end if;
    return jsonb_build_object('items', items, 'total', 0);
  end if;
  n := jsonb_array_length(p_items);
  if n < p_min or n > 60 then raise exception 'jumlah item tidak valid'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int; p := (it ->> 'price')::bigint;
    if q is null or q < 1 or q > 99 or p is null or p < 0 or p > 5000000 then raise exception 'item tidak valid'; end if;
    items := items || jsonb_build_array(jsonb_build_object(
      'id', public.clean_text(it ->> 'id', 12), 'name', public.clean_text(it ->> 'name', 80), 'price', p, 'qty', q));
    total := total + p * q;
  end loop;
  if total > 50000000 then raise exception 'total terlalu besar'; end if;
  return jsonb_build_object('items', items, 'total', total);
end $$;

-- ---------------------------------------------------------------------
-- 3. TRIGGER PENJAGA (sanitasi + rate limit) — hanya saat INSERT dari pelanggan
-- ---------------------------------------------------------------------
create or replace function public.orders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; ci jsonb; v_table int; v_phone text; v_name text;
begin
  perform public.check_rate('order', 30, interval '1 minute', 150);
  if new.status <> 'menunggu-bayar' then raise exception 'status awal tidak valid'; end if;
  ci := public.clean_items(d -> 'items', 1);
  if coalesce(d ->> 'type', '') not in ('Dine-in', 'Take away') or coalesce(d ->> 'pay', '') not in ('QRIS', 'Kasir') then raise exception 'jenis pesanan tidak valid'; end if;
  v_name := public.clean_text(d ->> 'name', 60);
  if char_length(v_name) < 1 then raise exception 'nama wajib diisi'; end if;
  v_phone := public.clean_text(d ->> 'phone', 16);
  if v_phone <> '' and v_phone !~ '^[0-9+() -]{8,16}$' then raise exception 'nomor telepon tidak valid'; end if;
  v_table := nullif(d ->> 'table', '')::int;
  if v_table is not null and (v_table < 1 or v_table > 200) then raise exception 'nomor meja tidak valid'; end if;
  new.data := jsonb_build_object(
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'type', d ->> 'type', 'table', v_table, 'name', v_name, 'phone', v_phone,
    'note', public.clean_text(d ->> 'note', 300), 'pay', d ->> 'pay',
    'items', ci -> 'items', 'total', (ci ->> 'total')::bigint,               -- total dihitung ulang di server
    'source', case when d ->> 'source' = 'QR meja' then 'QR meja' else 'Website' end);
  new.created_at := now(); new.updated_at := now();
  return new;
end $$;

create or replace function public.bookings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; ci jsonb; v_date date; v_guests int; v_name text; v_phone text;
begin
  perform public.check_rate('booking', 10, interval '1 hour', 80);
  if new.status <> 'menunggu' then raise exception 'status awal tidak valid'; end if;
  v_date := (d ->> 'date')::date;
  if v_date is null or v_date < current_date or v_date > current_date + 730 then raise exception 'tanggal tidak valid'; end if;
  v_guests := (d ->> 'guests')::int;
  if v_guests is null or v_guests < 1 or v_guests > 500 then raise exception 'jumlah tamu tidak valid'; end if;
  v_name := public.clean_text(d ->> 'name', 60);
  v_phone := public.clean_text(d ->> 'phone', 16);
  if char_length(v_name) < 1 or v_phone !~ '^[0-9+() -]{9,16}$' then raise exception 'kontak tidak valid'; end if;
  ci := public.clean_items(d -> 'items', 0);
  new.data := jsonb_build_object(
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'date', to_char(v_date, 'YYYY-MM-DD'), 'slot', public.clean_text(d ->> 'slot', 40), 'guests', v_guests,
    'pkg', public.clean_text(d ->> 'pkg', 60), 'name', v_name, 'phone', v_phone,
    'note', public.clean_text(d ->> 'note', 500), 'items', ci -> 'items', 'foodTotal', (ci ->> 'total')::bigint, 'adminNote', '');
  new.created_at := now(); new.updated_at := now();
  return new;
end $$;

create or replace function public.reviews_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; v_rating int; v_name text; v_text text;
begin
  perform public.check_rate('review', 5, interval '1 hour', 60);
  if new.status <> 'pending' then raise exception 'status awal tidak valid'; end if;
  v_rating := (d ->> 'rating')::int;
  v_name := public.clean_text(d ->> 'name', 40); v_text := public.clean_text(d ->> 'text', 300);
  if v_rating is null or v_rating < 1 or v_rating > 5 or char_length(v_name) < 1 or char_length(v_text) < 1 then raise exception 'ulasan tidak valid'; end if;
  new.data := jsonb_build_object('name', v_name, 'text', v_text, 'rating', v_rating, 'role', 'Pelanggan',
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  new.created_at := now(); new.updated_at := now();
  return new;
end $$;

-- Langganan Web Push: hanya endpoint layanan push resmi (cegah SSRF), hanya untuk pesanan yang ada, maks 5/pesanan.
create or replace function public.push_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ep text := new.sub ->> 'endpoint';
begin
  perform public.check_rate('push', 20, interval '1 hour', 300);
  if new.order_code !~ '^LN-[A-HJ-NP-Z2-9]{6}$' or not exists (select 1 from public.orders where code = new.order_code) then raise exception 'pesanan tidak ditemukan'; end if;
  if v_ep is null or char_length(v_ep) > 600
     or v_ep !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'endpoint push tidak diizinkan';
  end if;
  if coalesce(new.sub -> 'keys' ->> 'p256dh', '') = '' or coalesce(new.sub -> 'keys' ->> 'auth', '') = '' then raise exception 'kunci langganan tidak valid'; end if;
  if (select count(*) from public.push_subs where order_code = new.order_code) >= 5 then raise exception 'terlalu banyak langganan'; end if;
  new.sub := jsonb_build_object('endpoint', v_ep, 'keys', jsonb_build_object('p256dh', new.sub -> 'keys' ->> 'p256dh', 'auth', new.sub -> 'keys' ->> 'auth'));
  new.created_at := now();
  return new;
end $$;

-- Perubahan oleh staf: kode & waktu dibuat tidak boleh diubah; updated_at otomatis.
create or replace function public.touch_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  new.code := old.code; new.created_at := old.created_at; new.updated_at := now();
  return new;
end $$;

drop trigger if exists orders_guard_ins   on public.orders;
drop trigger if exists bookings_guard_ins on public.bookings;
drop trigger if exists reviews_guard_ins  on public.reviews;
drop trigger if exists push_guard_ins     on public.push_subs;
create trigger orders_guard_ins   before insert on public.orders    for each row execute function public.orders_guard();
create trigger bookings_guard_ins before insert on public.bookings  for each row execute function public.bookings_guard();
create trigger reviews_guard_ins  before insert on public.reviews   for each row execute function public.reviews_guard();
create trigger push_guard_ins     before insert on public.push_subs  for each row execute function public.push_guard();
drop trigger if exists orders_touch   on public.orders;
drop trigger if exists bookings_touch on public.bookings;
drop trigger if exists reviews_touch  on public.reviews;
create trigger orders_touch   before update on public.orders   for each row execute function public.touch_guard();
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_guard();
create trigger reviews_touch  before update on public.reviews  for each row execute function public.touch_guard();

-- ---------------------------------------------------------------------
-- 4. HAK AKSES TABEL (cabut semua, beri minimum)
-- ---------------------------------------------------------------------
revoke all on public.orders, public.bookings, public.reviews, public.blocked_dates, public.push_subs, public.rate_events from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
grant usage on schema public to anon, authenticated;

grant insert on public.orders, public.bookings, public.reviews, public.push_subs to anon;   -- pelanggan: hanya membuat
grant select (code, status, data) on public.reviews to anon;                                -- (RLS: hanya yang disetujui)
grant select on public.blocked_dates to anon;                                               -- tanggal tutup

grant select, update, delete on public.orders, public.bookings, public.reviews to authenticated;  -- dibatasi lagi oleh RLS per peran
grant select, insert, update, delete on public.blocked_dates to authenticated;
-- push_subs & rate_events: tanpa akses untuk klien manapun (hanya service role / fungsi server)

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.orders        enable row level security;
alter table public.bookings      enable row level security;
alter table public.reviews       enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.push_subs     enable row level security;
alter table public.rate_events   enable row level security;

do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
    and tablename in ('orders','bookings','reviews','blocked_dates','push_subs','rate_events') loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Pelanggan (anon)
create policy anon_insert_orders   on public.orders        for insert to anon with check (status = 'menunggu-bayar');
create policy anon_insert_bookings on public.bookings      for insert to anon with check (status = 'menunggu');
create policy anon_insert_reviews  on public.reviews       for insert to anon with check (status = 'pending');
create policy anon_read_reviews    on public.reviews       for select to anon using (status = 'approved');
create policy anon_read_blocked    on public.blocked_dates for select to anon using (true);
create policy anon_insert_push     on public.push_subs     for insert to anon with check (true);   -- divalidasi trigger push_guard

-- Staf: kasir = pesanan (lihat & ubah status) + lihat booking. Admin = semuanya.
create policy staff_read_orders     on public.orders   for select to authenticated using (public.staff_role() in ('admin','kasir'));
create policy staff_update_orders   on public.orders   for update to authenticated using (public.staff_role() in ('admin','kasir')) with check (public.staff_role() in ('admin','kasir'));
create policy admin_delete_orders   on public.orders   for delete to authenticated using (public.staff_role() = 'admin');
create policy staff_read_bookings   on public.bookings for select to authenticated using (public.staff_role() in ('admin','kasir'));
create policy admin_update_bookings on public.bookings for update to authenticated using (public.staff_role() = 'admin') with check (public.staff_role() = 'admin');
create policy admin_delete_bookings on public.bookings for delete to authenticated using (public.staff_role() = 'admin');
create policy admin_read_reviews    on public.reviews  for select to authenticated using (public.staff_role() = 'admin');
create policy admin_update_reviews  on public.reviews  for update to authenticated using (public.staff_role() = 'admin') with check (public.staff_role() = 'admin');
create policy admin_delete_reviews  on public.reviews  for delete to authenticated using (public.staff_role() = 'admin');
create policy admin_blocked_all     on public.blocked_dates for all to authenticated using (public.staff_role() = 'admin') with check (public.staff_role() = 'admin');
-- (push_subs & rate_events tanpa policy untuk klien = tertutup; service role mem-bypass RLS)

-- ---------------------------------------------------------------------
-- 6. FUNGSI UNTUK PELANGGAN (baca satu pesanan lewat kodenya, tanpa data pribadi)
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_code text) returns json
language sql security definer set search_path = public as $$
  select json_build_object('code', code, 'status', status, 'data', data - 'phone')
  from public.orders where code = upper(btrim(p_code));
$$;

create or replace function public.track_booking(p_code text) returns json
language sql security definer set search_path = public as $$
  select json_build_object('code', code, 'status', status, 'data', data - 'phone')
  from public.bookings where code = upper(btrim(p_code));
$$;

-- "Saya sudah bayar": hanya dari menunggu-bayar -> menunggu-verifikasi.
create or replace function public.claim_paid(p_code text) returns void
language sql security definer set search_path = public as $$
  update public.orders set status = 'menunggu-verifikasi'
  where code = upper(btrim(p_code)) and status = 'menunggu-bayar';
$$;

-- Slot yang sudah dikonfirmasi (tanpa data pribadi) untuk kalender booking.
create or replace function public.booked_slots() returns table (date text, slot text)
language sql security definer set search_path = public as $$
  select data ->> 'date', data ->> 'slot' from public.bookings where status = 'tersedia';
$$;

-- Hanya fungsi yang memang untuk klien yang boleh dieksekusi
revoke all on function public.track_order(text), public.track_booking(text), public.claim_paid(text), public.booked_slots(),
  public.check_rate(text, int, interval, int), public.client_ip(), public.clean_text(text, int), public.clean_items(jsonb, int),
  public.orders_guard(), public.bookings_guard(), public.reviews_guard(), public.push_guard(), public.touch_guard(), public.staff_role()
  from public, anon, authenticated;
grant execute on function public.track_order(text), public.track_booking(text), public.claim_paid(text), public.booked_slots() to anon, authenticated;
grant execute on function public.staff_role() to authenticated;

-- ---------------------------------------------------------------------
-- 7. (Opsional) bersihkan data pesanan lama demi privasi — jalankan berkala / pasang pg_cron
-- ---------------------------------------------------------------------
create or replace function public.purge_old_data(p_days int default 90) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subs where created_at < now() - make_interval(days => p_days);
  delete from public.orders    where created_at < now() - make_interval(days => p_days) and status in ('selesai','batal');
$$;
revoke all on function public.purge_old_data(int) from public, anon, authenticated;
