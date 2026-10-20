// LENTERAS — admin & kasir (mode demo, data di localStorage)
const $ = id => document.getElementById(id);
const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = iso => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

// ----- PIN (demo, bukan keamanan sungguhan) -----
function unlock() { $('gate').hidden = true; $('adminApp').hidden = false; try { sessionStorage.setItem('lenteras:admin', '1'); } catch {} renderAll(); }
try { if (sessionStorage.getItem('lenteras:admin') === '1') unlock(); } catch {}
$('gateForm').addEventListener('submit', e => {
  e.preventDefault();
  if ($('pin').value === CONFIG.adminPin) unlock(); else $('pinError').hidden = false;
});
$('logout').addEventListener('click', () => { try { sessionStorage.removeItem('lenteras:admin'); } catch {} location.reload(); });

// ----- Tab -----
document.querySelector('.admin-tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  document.querySelectorAll('.admin-tabs .chip').forEach(c => c.classList.toggle('active', c === b));
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== 'tab-' + b.dataset.tab);
});

// ----- Pesanan -----
let orderFilter = 'aktif', bookingFilter = 'menunggu';
const orderFilters = [['aktif', 'Aktif'], ['selesai', 'Selesai'], ['batal', 'Dibatalkan'], ['semua', 'Semua']];
const bookingFilters = [['menunggu', 'Menunggu'], ['tersedia', 'Dikonfirmasi'], ['ditolak', 'Ditolak'], ['semua', 'Semua']];
const filterBar = (el, list, cur) => el.innerHTML = list.map(([v, l]) => `<button class="chip${v === cur ? ' active' : ''}" data-f="${v}">${l}</button>`).join('');

const orderActions = o => {
  const A = (to, label, cls = 'btn-gold') => `<button class="btn ${cls} btn-sm" data-code="${o.code}" data-to="${to}">${label}</button>`;
  switch (o.status) {
    case 'menunggu-bayar': return A('diproses', o.pay === 'Kasir' ? 'Pembayaran diterima' : 'Tandai sudah bayar') + A('batal', 'Batalkan', 'btn-outline');
    case 'menunggu-verifikasi': return A('diproses', 'Verifikasi bayar ✓') + A('batal', 'Tolak / batal', 'btn-outline');
    case 'diproses': return A('siap', 'Siap diantar') + A('batal', 'Batalkan', 'btn-outline');
    case 'siap': return A('selesai', 'Selesai');
    default: return '';
  }
};

function renderOrders() {
  const all = Store.get('orders', []);
  const active = s => !['selesai', 'batal'].includes(s);
  const list = all.filter(o => orderFilter === 'semua' || (orderFilter === 'aktif' ? active(o.status) : o.status === orderFilter));
  $('cOrders').textContent = all.filter(o => active(o.status)).length;
  filterBar($('orderFilter'), orderFilters, orderFilter);
  $('orderList').innerHTML = list.length ? list.map(o => `
    <article class="a-card">
      <header><div><b class="a-code">${o.code}</b><small>${fmtTime(o.createdAt)} · ${o.source || ''}</small></div><span class="status-pill" data-status="${o.status}">${STATUS_LABEL[o.status]}</span></header>
      <p class="a-meta"><strong>${o.type}${o.table ? ' · Meja ' + o.table : ''}</strong> — ${escapeHTML(o.name)}${o.phone ? ' · ' + escapeHTML(o.phone) : ''}</p>
      <ul class="a-items">${o.items.map(i => `<li><span>${i.qty}× ${escapeHTML(i.name)}</span><span>${rupiah(i.price * i.qty)}</span></li>`).join('')}</ul>
      ${o.note ? `<p class="a-note">Catatan: ${escapeHTML(o.note)}</p>` : ''}
      <footer><div><small>${o.pay === 'QRIS' ? 'QRIS' : 'Bayar di kasir'}</small><b>${rupiah(o.total)}</b></div><div class="btn-row">${orderActions(o)}</div></footer>
    </article>`).join('') : '<p class="mb-empty">Belum ada pesanan di filter ini.</p>';
}

$('orderFilter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { orderFilter = b.dataset.f; renderOrders(); } });
$('orderList').addEventListener('click', e => {
  const b = e.target.closest('[data-to]'); if (!b) return;
  const o = Store.find('orders', b.dataset.code); if (!o) return;
  if (b.dataset.to === 'batal' && !confirm(`Batalkan pesanan ${o.code}?`)) return;
  o.status = b.dataset.to; o.updatedAt = new Date().toISOString();
  Store.upsert('orders', o); renderAll();
});

// ----- Booking -----
function renderBookings() {
  const all = Store.get('bookings', []);
  $('cBookings').textContent = all.filter(b => b.status === 'menunggu').length;
  filterBar($('bookingFilter'), bookingFilters, bookingFilter);
  const list = all.filter(b => bookingFilter === 'semua' || b.status === bookingFilter).sort((a, b) => a.date.localeCompare(b.date));
  $('bookingList').innerHTML = list.length ? list.map(b => `
    <article class="a-card">
      <header><div><b class="a-code">${b.code}</b><small>Diajukan ${new Date(b.createdAt).toLocaleDateString('id-ID')}</small></div><span class="status-pill" data-status="${b.status}">${STATUS_LABEL[b.status]}</span></header>
      <p class="a-meta"><strong>${fmtDate(b.date)}</strong> · ${escapeHTML(b.slot)} · ${b.guests} tamu</p>
      <p class="a-meta">${escapeHTML(b.pkg)} — ${escapeHTML(b.name)} · <a href="https://wa.me/${b.phone.replace(/\D/g, '').replace(/^0/, '62')}" target="_blank" rel="noopener">${escapeHTML(b.phone)}</a></p>
      ${b.items.length ? `<ul class="a-items">${b.items.map(i => `<li><span>${i.qty}× ${escapeHTML(i.name)}</span><span>${rupiah(i.price * i.qty)}</span></li>`).join('')}<li class="di-total"><span>Estimasi menu</span><span>${rupiah(b.foodTotal)}</span></li></ul>` : ''}
      ${b.note ? `<p class="a-note">Catatan tamu: ${escapeHTML(b.note)}</p>` : ''}
      ${b.adminNote ? `<p class="a-note">Catatan admin: ${escapeHTML(b.adminNote)}</p>` : ''}
      <footer><div></div><div class="btn-row">
        ${b.status !== 'tersedia' ? `<button class="btn btn-gold btn-sm" data-bcode="${b.code}" data-to="tersedia">Konfirmasi tersedia</button>` : ''}
        ${b.status !== 'ditolak' ? `<button class="btn btn-outline btn-sm" data-bcode="${b.code}" data-to="ditolak">Tidak tersedia</button>` : ''}
      </div></footer>
    </article>`).join('') : '<p class="mb-empty">Belum ada booking di filter ini.</p>';
}
$('bookingFilter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { bookingFilter = b.dataset.f; renderBookings(); } });
$('bookingList').addEventListener('click', e => {
  const btn = e.target.closest('[data-bcode]'); if (!btn) return;
  const b = Store.find('bookings', btn.dataset.bcode); if (!b) return;
  const note = prompt(btn.dataset.to === 'tersedia' ? 'Catatan untuk tamu (opsional), mis. info DP / jadwal survei:' : 'Alasan / alternatif tanggal (opsional):', b.adminNote || '');
  if (note === null) return;
  b.status = btn.dataset.to; b.adminNote = note.trim(); b.updatedAt = new Date().toISOString();
  Store.upsert('bookings', b); renderAll();
});

// ----- Tanggal penuh -----
function renderDates() {
  const list = Store.get('blockedDates', []).sort((a, b) => a.date.localeCompare(b.date));
  $('blockList').innerHTML = list.length ? list.map(d => `<div class="a-card a-row"><div><b>${fmtDate(d.date)}</b><small>${escapeHTML(d.reason || '—')}</small></div><button class="btn btn-outline btn-sm" data-unblock="${d.date}">Buka</button></div>`).join('') : '<p class="mb-empty">Belum ada tanggal yang ditutup.</p>';
}
$('blockDate').min = todayISO();
$('blockForm').addEventListener('submit', e => {
  e.preventDefault();
  const list = Store.get('blockedDates', []);
  if (!list.some(d => d.date === $('blockDate').value)) list.push({ date: $('blockDate').value, reason: $('blockReason').value.trim() });
  Store.set('blockedDates', list); $('blockForm').reset(); renderDates();
});
$('blockList').addEventListener('click', e => {
  const b = e.target.closest('[data-unblock]'); if (!b) return;
  Store.set('blockedDates', Store.get('blockedDates', []).filter(d => d.date !== b.dataset.unblock)); renderDates();
});

// ----- QR meja -----
const baseInput = $('baseUrl');
baseInput.value = new URL('order.html', location.href).href;
$('qrTo').value = CONFIG.tableCount;
$('baseWarn').textContent = /^(file:|http:\/\/(localhost|127\.))/.test(location.href)
  ? 'Kamu sedang membuka dari komputer lokal. Ganti alamat di atas dengan domain website yang sudah online (mis. https://lenteras.vercel.app/order.html) sebelum mencetak.' : '';
function makeQR() {
  const grid = $('qrGrid'); grid.innerHTML = '';
  const from = Math.max(1, parseInt($('qrFrom').value, 10) || 1), to = Math.min(200, parseInt($('qrTo').value, 10) || from);
  for (let n = from; n <= to; n++) {
    const card = document.createElement('div'); card.className = 'qr-card';
    card.innerHTML = '<b>LENTERAS</b><div class="qr-box"></div><strong>Meja ' + n + '</strong><small>Scan untuk pesan &amp; bayar</small>';
    grid.appendChild(card);
    const url = baseInput.value.replace(/[?#].*$/, '') + '?table=' + n;
    if (window.QRCode) new QRCode(card.querySelector('.qr-box'), { text: url, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
    else card.querySelector('.qr-box').textContent = 'Library QR gagal dimuat (perlu internet).';
  }
}
$('qrMake').addEventListener('click', makeQR);
$('qrPrint').addEventListener('click', () => { if (!$('qrGrid').children.length) makeQR(); window.print(); });

// ----- Testimoni -----
function renderReviews() {
  const list = Store.get('reviews', []);
  $('cReviews').textContent = list.filter(r => r.status === 'pending').length;
  $('reviewList').innerHTML = list.length ? list.map(r => `
    <article class="a-card">
      <header><div><b>${escapeHTML(r.name)}</b><small>${'★'.repeat(r.rating)} · ${new Date(r.createdAt).toLocaleDateString('id-ID')}</small></div><span class="status-pill" data-status="${r.status === 'approved' ? 'siap' : 'menunggu'}">${r.status === 'approved' ? 'Tampil' : 'Menunggu'}</span></header>
      <p class="a-note">${escapeHTML(r.text)}</p>
      <footer><div></div><div class="btn-row">
        ${r.status !== 'approved' ? `<button class="btn btn-gold btn-sm" data-rcode="${r.code}" data-act="approve">Tampilkan</button>` : `<button class="btn btn-outline btn-sm" data-rcode="${r.code}" data-act="hide">Sembunyikan</button>`}
        <button class="btn btn-outline btn-sm" data-rcode="${r.code}" data-act="del">Hapus</button>
      </div></footer>
    </article>`).join('') : '<p class="mb-empty">Belum ada testimoni masuk.</p>';
}
$('reviewList').addEventListener('click', e => {
  const b = e.target.closest('[data-rcode]'); if (!b) return;
  let list = Store.get('reviews', []);
  if (b.dataset.act === 'del') list = list.filter(r => r.code !== b.dataset.rcode);
  else list = list.map(r => r.code === b.dataset.rcode ? { ...r, status: b.dataset.act === 'approve' ? 'approved' : 'pending' } : r);
  Store.set('reviews', list); renderReviews();
});

function renderAll() { renderOrders(); renderBookings(); renderDates(); renderReviews(); }
window.addEventListener('storage', () => { if (!$('adminApp').hidden) renderAll(); });
setInterval(() => { if (!$('adminApp').hidden && !document.hidden) { renderOrders(); renderBookings(); } }, 4000);
