// LENTERAS — Supabase Edge Function: kirim Web Push saat pesanan menjadi "selesai".
//
// Alur:  admin menekan "Selesai" -> baris orders di-UPDATE -> Database Webhook memanggil fungsi ini
//        -> fungsi mengirim Web Push ke HP pelanggan yang mengaktifkan notifikasi (tabel push_subs)
//        -> service worker (sw.js) di HP menampilkan notifikasi + bunyi/getar, walau halaman ditutup.
//
// Deploy:   supabase functions deploy notify-order --no-verify-jwt
// Secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:admin@domainmu.com WEBHOOK_SECRET=isi-acak
// Webhook:  Dashboard -> Database -> Webhooks -> tabel "orders", event UPDATE -> HTTP request ke URL fungsi ini,
//           tambahkan header  x-webhook-secret: <WEBHOOK_SECRET>
// Kunci VAPID: npx web-push generate-vapid-keys   (kunci publik juga ditaruh di data.js -> vapidPublicKey)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

// Hanya layanan push resmi (defense in depth; database juga memvalidasi saat langganan disimpan) -> cegah SSRF.
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

// Perbandingan rahasia dengan waktu konstan
function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length || x.length === 0) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!safeEqual(req.headers.get("x-webhook-secret") ?? "", Deno.env.get("WEBHOOK_SECRET") ?? "")) return new Response("forbidden", { status: 403 });

  const payload = await req.json();                      // { type, table, record, old_record }
  const rec = payload.record, old = payload.old_record;
  if (!rec || (old && old.status === rec.status)) return new Response("no change");
  if (rec.status !== "selesai" && rec.status !== "batal") return new Response("ignored");

  const d = rec.data ?? {};
  const where = d.table ? `Meja ${d.table}` : (d.type ?? "");
  const message = rec.status === "selesai"
    ? { title: "Pesananmu sudah siap! 🎉", body: `Kode ${rec.code} · ${where}. Silakan ambil pesananmu.` }
    : { title: "Pesanan dibatalkan", body: `Pesanan ${rec.code} dibatalkan oleh kasir.` };

  const { data: subs } = await supabase.from("push_subs").select("id, sub").eq("order_code", rec.code);
  let sent = 0;
  for (const row of subs ?? []) {
    if (!PUSH_HOSTS.test(String(row.sub?.endpoint ?? ""))) { await supabase.from("push_subs").delete().eq("id", row.id); continue; }
    try {
      await webpush.sendNotification(row.sub, JSON.stringify({ ...message, tag: "order-" + rec.code, url: "order.html" }), { TTL: 60 * 60 * 6, urgency: "high" });
      sent++;
    } catch (e) {
      // 404/410 = langganan sudah tidak berlaku -> hapus
      if (e.statusCode === 404 || e.statusCode === 410) await supabase.from("push_subs").delete().eq("id", row.id);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
