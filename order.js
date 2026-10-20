// LENTERAS — halaman pesan (scan QR meja atau buka dari website)
const params = new URLSearchParams(location.search);
const tableParam = parseInt(params.get('table') || params.get('meja'), 10);
const lockedTable = Number.isInteger(tableParam) && tableParam >= 1 && tableParam <= CONFIG.tableCount ? tableParam : null;

const $ = id => document.getElementById(id);
const cart = Store.get('cart', {});
Object.keys(cart).forEach(id => { if (!byId(id)) delete cart[id]; });

const form = $('orderForm');
const panel = $('cartPanel');
const tableField = $('tableField');
const tableSelect = $('tableNo');

// ----- Meja -----
tableSelect.innerHTML = Array.from({ length: CONFIG.tableCount }, (_, i) => `<option value="${i + 1}">Meja ${i + 1}</option>`).join('');
if (lockedTable) {
  tableSelect.value = lockedTable;
  $('tableBadge').textContent = 'Meja ' + lockedTable;
  $('tableBadge').hidden = false;
  $('orderHint').textContent = `Kamu duduk di Meja ${lockedTable}. Pesanan akan diantar ke meja kamu.`;
}
const orderType = () => form.elements.type.value;
function syncType() {
  const dineIn = orderType() === 'Dine-in';
  tableField.hidden = !dineIn;
  // Jika dari QR meja, nomor meja terkunci agar tidak salah antar.
  tableSelect.disabled = !!lockedTable;
}
document.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener('change', syncType));
syncType();

// ----- Menu & keranjang -----
const browser = createMenuBrowser($('menuBrowser'), cart, onCartChange);
// Dari beranda: order.html?cat=pastry langsung membuka kategori itu.
const startCat = params.get('cat');
if (startCat) document.querySelector(`.mb-chips .chip[data-cat="${startCat}"]`)?.click();

function onCartChange() {
  Store.set('cart', cart);
  const n = Cart.count(cart), t = Cart.total(cart);
  $('cartBar').hidden = n === 0 || panel.classList.contains('open');
  const cnt = $('cartBarCount');
  if (cnt.textContent !== String(n)) { cnt.textContent = n; cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump'); }
  $('cartBarTotal').textContent = rupiah(t);
  $('cartTotal').textContent = rupiah(t);
  $('cartLines').innerHTML = cartLinesHTML(cart);
  $('submitBtn').textContent = form.elements.pay.value === 'QRIS' ? 'Pesan & bayar QRIS' : 'Pesan sekarang';
}
$('cartLines').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  Cart.change(cart, b.closest('.cl').dataset.id, b.dataset.act === 'inc' ? 1 : -1);
  browser.refresh();
  onCartChange();
});
document.querySelectorAll('input[name="pay"]').forEach(r => r.addEventListener('change', onCartChange));

// ----- Panel keranjang (bottom sheet di HP) -----
const openPanel = open => {
  panel.classList.toggle('open', open);
  $('scrim').classList.toggle('show', open);
  document.body.classList.toggle('no-scroll', open);
  onCartChange();
};
$('cartBar').addEventListener('click', () => openPanel(true));
$('panelClose').addEventListener('click', () => openPanel(false));
$('scrim').addEventListener('click', () => openPanel(false));

// ----- Kirim pesanan -----
const err = $('formError');
const showError = msg => { err.textContent = msg; err.hidden = !msg; };

form.addEventListener('submit', e => {
  e.preventDefault();
  showError('');
  Chime.unlock(); Notify.register(); // dari klik pengguna: izin suara & service worker
  if (!Cart.count(cart)) return showError('Pilih minimal satu menu dulu ya.');
  const name = form.elements.name.value.trim();
  if (!name) { form.elements.name.focus(); return showError('Isi nama untuk pesanan kamu.'); }
  const phone = form.elements.phone.value.trim();
  if (phone && !/^[0-9+\-\s]{8,16}$/.test(phone)) return showError('Format nomor WhatsApp belum sesuai.');

  const dineIn = orderType() === 'Dine-in';
  const pay = form.elements.pay.value;
  const order = {
    code: makeCode('LN', 'orders'),
    createdAt: new Date().toISOString(),
    type: orderType(),
    table: dineIn ? Number(tableSelect.value) : null,
    name, phone,
    note: form.elements.note.value.trim(),
    pay,
    items: Cart.lines(cart),
    total: Cart.total(cart),
    status: 'menunggu-bayar',
    source: lockedTable ? 'QR meja' : 'Website'
  };
  Store.upsert('orders', order);
  if (Cloud.on) Cloud.createOrder(order).catch(() => toast('Koneksi ke server bermasalah. Beri tahu kasir kode pesananmu.'));
  Store.set('lastOrder', order.code);
  Object.keys(cart).forEach(k => delete cart[k]);
  Store.set('cart', cart);
  browser.refresh();
  openPanel(false);
  showDone(order.code);
});

// ----- Layar status / pembayaran -----
let pollTimer;
function showDone(code) {
  const order = Store.find('orders', code);
  if (!order) return;
  $('doneView').hidden = false;
  document.body.classList.add('no-scroll');
  $('doneCode').textContent = order.code;
  $('doneMeta').textContent = `${order.type}${order.table ? ' · Meja ' + order.table : ''} · atas nama ${order.name}`;
  $('doneItems').innerHTML = Cart.lines(Object.fromEntries(order.items.map(i => [i.id, i.qty]))).map(l => `<div class="di"><span>${l.qty}× ${escapeHTML(l.name)}</span><span>${rupiah(l.price * l.qty)}</span></div>`).join('')
    + `<div class="di di-total"><span>Total</span><span>${rupiah(order.total)}</span></div>`
    + (order.note ? `<p class="fine">Catatan: ${escapeHTML(order.note)}</p>` : '');
  renderDone(order);
  clearInterval(pollTimer);
  pollTimer = setInterval(() => refresh(code), 3000);
  refresh(code);
}

// Ambil status terbaru: dari server (bila tersambung) atau penyimpanan lokal (mode demo).
let refreshing = false;
async function refresh(code) {
  let o = Store.find('orders', code);
  if (Cloud.on && !refreshing) {
    refreshing = true;
    try { const r = await Cloud.trackOrder(code); if (r) o = Store.upsert('orders', { ...(o || {}), ...r }); } catch { /* offline: pakai data lokal */ }
    refreshing = false;
  }
  if (o) renderDone(o);
}

// ----- Pesanan selesai: bunyi + notifikasi + layar peringatan -----
const seenStatus = () => Store.get('seenStatus', {});
let titleBlink;
function announceReady(order) {
  const where = order.table ? `Meja ${order.table}` : order.type;
  $('raText').textContent = `Kode ${order.code} · ${where} · atas nama ${order.name}. Silakan ambil / nikmati pesananmu.`;
  $('readyAlert').hidden = false;
  Chime.ring();
  Notify.show('Pesananmu sudah siap! 🎉', `Kode ${order.code} · ${where}. Silakan ambil pesananmu.`, 'order-' + order.code);
  clearInterval(titleBlink);
  const base = document.title; let on = false;
  titleBlink = setInterval(() => { document.title = (on = !on) ? '🔔 Pesanan siap!' : base; }, 900);
  $('readyAlert').dataset.base = base;
}
function stopAnnounce() {
  Chime.stop(); clearInterval(titleBlink);
  if ($('readyAlert').dataset.base) document.title = $('readyAlert').dataset.base;
  $('readyAlert').hidden = true;
}
$('raClose').addEventListener('click', stopAnnounce);
function onStatus(order) {
  const seen = seenStatus();
  if (order.status === 'selesai' && seen[order.code] !== 'selesai') announceReady(order);
  else if (order.status === 'batal' && seen[order.code] !== 'batal') Notify.show('Pesanan dibatalkan', `Pesanan ${order.code} dibatalkan oleh kasir.`, 'order-' + order.code);
  if (seen[order.code] !== order.status) { seen[order.code] = order.status; Store.set('seenStatus', seen); }
}

function renderDone(order) {
  onStatus(order);
  const waiting = order.status === 'menunggu-bayar';
  const showQR = order.pay === 'QRIS' && waiting;
  $('doneTitle').textContent = order.status === 'selesai' ? 'Pesananmu sudah siap!' : order.status === 'batal' ? 'Pesanan dibatalkan' : 'Terima kasih!';
  $('doneStatus').textContent = (order.pay === 'Kasir' && waiting) ? 'Silakan bayar di kasir' : STATUS_LABEL[order.status];
  $('doneStatus').dataset.status = order.status;
  $('payBox').hidden = !showQR;
  if (showQR) {
    $('payAmount').textContent = rupiah(order.total);
    $('qrisName').textContent = 'a.n. ' + CONFIG.qrisName;
    const frame = $('qrisFrame');
    if (!frame.dataset.ready) {
      frame.dataset.ready = '1';
      const img = new Image();
      img.alt = 'QRIS Lenteras'; img.onload = () => { frame.innerHTML = ''; frame.appendChild(img); };
      img.onerror = () => { frame.innerHTML = '<div class="qris-missing"><b>QRIS</b><span>Pasang gambar QRIS resmi di <code>assets/qris.png</code></span></div>'; };
      frame.innerHTML = '<div class="qris-missing"><b>QRIS</b></div>';
      img.src = CONFIG.qrisImage;
    }
  }
  $('doneNote').textContent = order.pay === 'Kasir' && waiting
    ? 'Sebutkan kode pesanan ke kasir. Pesanan disiapkan setelah pembayaran diterima.'
    : waiting ? 'Setelah membayar, tekan "Saya sudah bayar". Kasir akan memverifikasi pembayaranmu.'
    : order.status === 'menunggu-verifikasi' ? 'Terima kasih! Kasir sedang memverifikasi pembayaranmu.' : 'Simpan kode pesanan ini untuk ditunjukkan ke kasir bila diperlukan.';
  const text = `Halo Lenteras, saya sudah memesan.\nKode: ${order.code}\n${order.type}${order.table ? ' · Meja ' + order.table : ''}\nNama: ${order.name}\n\n${order.items.map(i => `• ${i.qty}x ${i.name}`).join('\n')}\n\nTotal: ${rupiah(order.total)} (${order.pay})${order.note ? '\nCatatan: ' + order.note : ''}`;
  const link = waLink(text);
  $('waBtn').hidden = !link;
  if (link) $('waBtn').href = link;
}

$('paidBtn').addEventListener('click', () => {
  const o = Store.find('orders', Store.get('lastOrder', ''));
  if (!o) return;
  o.status = 'menunggu-verifikasi';
  o.paidClaimedAt = new Date().toISOString();
  Store.upsert('orders', o);
  if (Cloud.on) Cloud.claimPaid(o.code).catch(() => toast('Koneksi bermasalah. Tunjukkan bukti bayar ke kasir.'));
  renderDone(o);
});
$('newOrderBtn').addEventListener('click', () => {
  clearInterval(pollTimer);
  Store.set('lastOrder', '');
  $('doneView').hidden = true;
  document.body.classList.remove('no-scroll');
  form.reset(); syncType();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Pulihkan layar status bila halaman di-refresh saat pesanan masih berjalan.
const last = Store.find('orders', Store.get('lastOrder', ''));
if (last && !['selesai', 'batal'].includes(last.status) && Date.now() - new Date(last.createdAt) < 6 * 3600e3) showDone(last.code);
onCartChange();

// ----- Aktifkan notifikasi (juga Web Push bila server tersambung) -----
function paintNotif() {
  const p = Notify.permission(), box = $('notifBox');
  box.hidden = !Notify.supported();
  box.dataset.state = p;
  if (p === 'granted') {
    $('notifBtn').hidden = true;
    $('notifHelp').textContent = CONFIG.vapidPublicKey && Cloud.on
      ? 'Aktif. HP akan berbunyi saat pesananmu selesai, walau halaman ditutup.'
      : 'Aktif. HP berbunyi saat pesananmu selesai selama halaman ini masih terbuka di browser.';
  } else if (p === 'denied') {
    $('notifBtn').hidden = true;
    $('notifHelp').textContent = 'Notifikasi diblokir di browser. Izinkan lewat pengaturan situs, atau biarkan halaman ini tetap terbuka.';
  }
}
$('notifBtn').addEventListener('click', async () => {
  Chime.unlock();
  await Notify.register();
  const p = await Notify.ask();
  if (p === 'granted') {
    Chime.once(); // contoh bunyi
    try { await Notify.subscribePush(Store.get('lastOrder', '')); } catch { /* push belum dikonfigurasi */ }
  }
  paintNotif();
});
paintNotif();
Notify.register();

// Buka kunci suara pada sentuhan pertama di halaman (kebijakan autoplay browser).
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => Chime.unlock(), { once: true, passive: true }));
// Mode demo: admin di tab lain mengubah status -> langsung terdeteksi.
addEventListener('storage', e => { if (e.key === 'lenteras:orders') { const code = Store.get('lastOrder', ''); const o = code && Store.find('orders', code); if (o) renderDone(o); } });
// Kembali ke tab: segarkan segera.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { const code = Store.get('lastOrder', ''); if (code) refresh(code); } });
