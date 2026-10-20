// LENTERAS — service worker
// Menampilkan notifikasi (dengan bunyi & getar bawaan perangkat) saat pesanan selesai.
// Notifikasi Web Push bisa diterima walau halaman/browser sudah ditutup, selama server push tersambung (lihat README).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Pesananmu sudah siap! 🎉', {
    body: d.body || 'Silakan ambil pesananmu di Lenteras.',
    tag: d.tag || 'lenteras-order',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 600],
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    data: { url: d.url || 'order.html' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || 'order.html';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { if ('navigate' in c) c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
