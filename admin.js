// LENTERAS — admin & kasir
// Mode server (Supabase): PIN = password akun staf; peran (admin/kasir) ditentukan SERVER lewat JWT dan ditegakkan RLS.
// Mode demo: PIN dicek di browser (hanya untuk uji coba; data juga hanya di browser).
const $ = id => document.getElementById(id);
const esc = escapeHTML;
const num = n => (Number.isFinite(Number(n)) ? Number(n) : 0);
const CODE_RE = /^(LN|BK|RV)-[A-Z0-9]{4,8}$/;
const safeCode = c => (CODE_RE.test(String(c)) ? String(c) : '');
const fmtDate = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtTime = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };
const statusLabel = s => esc(STATUS_LABEL[s] || s || '');

// =====================================================================
// LOGIN (PIN) — peran, penguncian bertahap, batas waktu tidak aktif
// =====================================================================
let ROLE = '';
let lastActive = Date.now();
const ROLE_NAME = { admin: 'Admin & kasir', kasir: 'Kasir' };
const LOCK_KEY = 'lenteras:lock';
function lockState() { try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || { fails: 0, until: 0 }; } catch { return { fails: 0, until: 0 }; } }
function saveLock(s) { try { localStorage.setItem(LOCK_KEY, JSON.stringify(s)); } catch { /* abaikan */ } }
// Penguncian di sisi browser hanya penghalang tambahan; pembatasan sungguhan ada di server (Supabase Auth rate limit).
function failedAttempt() {
  const s = lockState(); s.fails += 1;
  if (s.fails >= 5) s.until = Date.now() + Math.min(15 * 60, 30 * 2 ** (s.fails - 5)) * 1000;
  saveLock(s);
}
let lockTimer;
function paintLock() {
  const s = lockState(), left = Math.ceil((s.until - Date.now()) / 1000), btn = $('gateBtn');
  clearInterval(lockTimer);
  if (left > 0) {
    btn.disabled = true; $('pin').disabled = true;
    const tick = () => { const l = Math.ceil((lockState().until - Date.now()) / 1000); if (l <= 0) { clearInterval(lockTimer); btn.disabled = false; $('pin').disabled = false; btn.textContent = 'Masuk'; showGateError(''); return; } btn.textContent = `Terkunci ${l} dtk`; };
    tick(); lockTimer = setInterval(tick, 500);
    showGateError('Terlalu banyak percobaan salah. Coba lagi sebentar lagi.');
  }
}
function showGateError(msg) { $('pinError').textContent = msg; $('pinError').hidden = !msg; }

$('gateInfo').textContent = Cloud.on ? '' : 'Mode demo: PIN dicek di browser ini saja.';
document.querySelector('.demo-banner').hidden = Cloud.on;
paintLock();

function setRole(role) {
  ROLE = role;
  $('roleBadge').textContent = ROLE_NAME[role] || '';
  // Kasir hanya mengurus pesanan (+ QR meja). Admin: semuanya. (Server juga menegakkan ini lewat RLS.)
  document.querySelectorAll('[data-tab]').forEach(b => { b.hidden = role === 'kasir' && ['bookings', 'dates', 'reviews'].includes(b.dataset.tab); });
}
function unlock(role) {
  $('gate').hidden = true; $('adminApp').hidden = false;
  setRole(role);
  try { sessionStorage.setItem('lenteras:admin', role); } catch { /* abaikan */ }
  lastActive = Date.now();
  pullAll().then(renderAll);
}

$('gateForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (lockState().until > Date.now()) return paintLock();
  const pin = $('pin').value;
  showGateError('');
  if (pin.length < 4) return showGateError('PIN terlalu pendek.');
  $('gateBtn').disabled = true; $('gateBtn').textContent = 'Memeriksa…';
  try {
    if (Cloud.on) {
      if (!CONFIG.staffEmail) throw new Error('email staf belum diatur di data.js');
      const got = await Cloud.login(CONFIG.staffEmail, pin);   // server memverifikasi PIN & mengembalikan peran dari JWT
      if (got !== 'admin') { await Cloud.logout(); throw new Error('akun ini bukan admin'); }
    } else if (pin !== String(CONFIG.demoPin || '')) throw new Error('PIN salah');
    saveLock({ fails: 0, until: 0 });
    $('pin').value = '';
    unlock('admin');
  } catch (err) {
    failedAttempt();
    showGateError(/email staf|bukan admin/.test(err.message) ? err.message : 'PIN salah.');
    paintLock();
  }
  if (lockState().until <= Date.now()) { $('gateBtn').disabled = false; $('gateBtn').textContent = 'Masuk'; }
});

async function logout() {
  try { sessionStorage.removeItem('lenteras:admin'); } catch { /* abaikan */ }
  if (Cloud.on) await Cloud.logout();
  location.reload();
}
$('logout').addEventListener('click', logout);


// Keluar otomatis bila lama tidak ada aktivitas
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
setInterval(() => { if (!$('adminApp').hidden && Date.now() - lastActive > (CONFIG.adminIdleMinutes || 240) * 60000) logout(); }, 30000);

// =====================================================================
// TAB
// =====================================================================
document.querySelector('.admin-tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b || b.hidden) return;
  document.querySelectorAll('.admin-tabs .chip').forEach(c => c.classList.toggle('active', c === b));
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== 'tab-' + b.dataset.tab);
});

// =====================================================================
// PESANAN
// =====================================================================
let orderFilter = 'aktif', bookingFilter = 'menunggu';
const orderFilters = [['aktif', 'Aktif'], ['selesai', 'Selesai'], ['batal', 'Dibatalkan'], ['semua', 'Semua']];
const bookingFilters = [['menunggu', 'Menunggu'], ['tersedia', 'Dikonfirmasi'], ['ditolak', 'Ditolak'], ['semua', 'Semua']];
const filterBar = (el, list, cur) => el.innerHTML = list.map(([v, l]) => `<button class="chip${v === cur ? ' active' : ''}" data-f="${v}">${l}</button>`).join('');

const orderActions = o => {
  const code = esc(safeCode(o.code));
  const A = (to, label, cls = 'btn-gold') => `<button class="btn ${cls} btn-sm" data-code="${code}" data-to="${to}">${label}</button>`;
  switch (o.status) {
    case 'menunggu-bayar': return A('diproses', o.pay === 'Kasir' ? 'Pembayaran diterima' : 'Tandai sudah bayar') + A('batal', 'Batalkan', 'btn-outline');
    case 'menunggu-verifikasi': return A('diproses', 'Verifikasi bayar ✓') + A('batal', 'Tolak / batal', 'btn-outline');
    case 'diproses': return A('selesai', 'Selesai — pesanan siap 🔔') + A('batal', 'Batalkan', 'btn-outline');
    case 'siap': return A('selesai', 'Selesai — pesanan siap 🔔');
    default: return '';
  }
};

// Harga di data pelanggan tidak dipercaya: bandingkan dengan menu resmi.
const priceMismatch = items => (items || []).some(i => { const m = byId(i.id); return !m || m.price !== num(i.price); });
const trueTotal = items => (items || []).reduce((s, i) => s + (byId(i.id)?.price ?? num(i.price)) * num(i.qty), 0);

function renderOrders() {
  const all = (Store.get('orders', []) || []).filter(o => safeCode(o.code));
  const active = s => !['selesai', 'batal'].includes(s);
  const list = all.filter(o => orderFilter === 'semua' || (orderFilter === 'aktif' ? active(o.status) : o.status === orderFilter));
  $('cOrders').textContent = all.filter(o => active(o.status)).length;
  filterBar($('orderFilter'), orderFilters, orderFilter);
  $('orderList').innerHTML = list.length ? list.map(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    const bad = priceMismatch(items);
    return `
    <article class="a-card">
      <header><div><b class="a-code">${esc(o.code)}</b><small>${esc(fmtTime(o.createdAt))} · ${esc(o.source || '')}</small></div><span class="status-pill" data-status="${esc(o.status)}">${statusLabel(o.status)}</span></header>
      <p class="a-meta"><strong>${esc(o.type || '')}${o.table ? ' · Meja ' + num(o.table) : ''}</strong> — ${esc(o.name || '')}${o.phone ? ' · ' + esc(o.phone) : ''}</p>
      <ul class="a-items">${items.map(i => `<li><span>${num(i.qty)}× ${esc(i.name || '')}</span><span>${rupiah(num(i.price) * num(i.qty))}</span></li>`).join('')}</ul>
      ${bad ? `<p class="a-warn">⚠ Harga/item tidak cocok dengan menu resmi. Total yang benar: <b>${rupiah(trueTotal(items))}</b>. Periksa sebelum menerima pembayaran.</p>` : ''}
      ${o.note ? `<p class="a-note">Catatan: ${esc(o.note)}</p>` : ''}
      <footer><div><small>${o.pay === 'QRIS' ? 'QRIS' : 'Bayar di kasir'}</small><b>${rupiah(bad ? trueTotal(items) : num(o.total))}</b></div><div class="btn-row">${orderActions(o)}</div></footer>
    </article>`;
  }).join('') : '<p class="mb-empty">Belum ada pesanan di filter ini.</p>';
}

$('orderFilter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { orderFilter = b.dataset.f; renderOrders(); } });
$('orderList').addEventListener('click', e => {
  const b = e.target.closest('[data-to]'); if (!b) return;
  const o = Store.find('orders', b.dataset.code); if (!o) return;
  if (!['diproses', 'selesai', 'batal'].includes(b.dataset.to)) return;
  if (b.dataset.to === 'batal' && !confirm(`Batalkan pesanan ${o.code}?`)) return;
  o.status = b.dataset.to; o.updatedAt = new Date().toISOString();
  Store.upsert('orders', o); renderAll(); cloudDo(() => Cloud.patch('orders', o));
});

// =====================================================================
// BOOKING (admin)
// =====================================================================
function renderBookings() {
  const all = (Store.get('bookings', []) || []).filter(b => safeCode(b.code));
  $('cBookings').textContent = all.filter(b => b.status === 'menunggu').length;
  filterBar($('bookingFilter'), bookingFilters, bookingFilter);
  const list = all.filter(b => bookingFilter === 'semua' || b.status === bookingFilter).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const canEdit = ROLE === 'admin';
  $('bookingList').innerHTML = list.length ? list.map(b => {
    const items = Array.isArray(b.items) ? b.items : [];
    const wa = String(b.phone || '').replace(/\D/g, '').replace(/^0/, '62');
    const code = esc(b.code);
    return `
    <article class="a-card">
      <header><div><b class="a-code">${code}</b><small>Diajukan ${esc(new Date(b.createdAt).toLocaleDateString('id-ID'))}</small></div><span class="status-pill" data-status="${esc(b.status)}">${statusLabel(b.status)}</span></header>
      <p class="a-meta"><strong>${esc(fmtDate(b.date))}</strong> · ${esc(b.slot || '')} · ${num(b.guests)} tamu</p>
      <p class="a-meta">${esc(b.pkg || '')} — ${esc(b.name || '')} · ${wa ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener noreferrer">${esc(b.phone)}</a>` : esc(b.phone || '')}</p>
      ${items.length ? `<ul class="a-items">${items.map(i => `<li><span>${num(i.qty)}× ${esc(i.name || '')}</span><span>${rupiah(num(i.price) * num(i.qty))}</span></li>`).join('')}<li class="di-total"><span>Estimasi menu</span><span>${rupiah(trueTotal(items))}</span></li></ul>` : ''}
      ${b.note ? `<p class="a-note">Catatan tamu: ${esc(b.note)}</p>` : ''}
      ${b.adminNote ? `<p class="a-note">Catatan admin: ${esc(b.adminNote)}</p>` : ''}
      ${canEdit ? `<footer><div></div><div class="btn-row">
        ${b.status !== 'tersedia' ? `<button class="btn btn-gold btn-sm" data-bcode="${code}" data-to="tersedia">Konfirmasi tersedia</button>` : ''}
        ${b.status !== 'ditolak' ? `<button class="btn btn-outline btn-sm" data-bcode="${code}" data-to="ditolak">Tidak tersedia</button>` : ''}
      </div></footer>` : ''}
    </article>`;
  }).join('') : '<p class="mb-empty">Belum ada booking di filter ini.</p>';
}
$('bookingFilter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { bookingFilter = b.dataset.f; renderBookings(); } });
$('bookingList').addEventListener('click', e => {
  if (ROLE !== 'admin') return;
  const btn = e.target.closest('[data-bcode]'); if (!btn) return;
  const b = Store.find('bookings', btn.dataset.bcode); if (!b) return;
  if (!['tersedia', 'ditolak'].includes(btn.dataset.to)) return;
  const note = prompt(btn.dataset.to === 'tersedia' ? 'Catatan untuk tamu (opsional), mis. info DP / jadwal survei:' : 'Alasan / alternatif tanggal (opsional):', b.adminNote || '');
  if (note === null) return;
  b.status = btn.dataset.to; b.adminNote = note.trim().slice(0, 300); b.updatedAt = new Date().toISOString();
  Store.upsert('bookings', b); renderAll(); cloudDo(() => Cloud.patch('bookings', b));
});

// =====================================================================
// TANGGAL PENUH (admin)
// =====================================================================
function renderDates() {
  const list = (Store.get('blockedDates', []) || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date)).sort((a, b) => a.date.localeCompare(b.date));
  $('blockList').innerHTML = list.length ? list.map(d => `<div class="a-card a-row"><div><b>${esc(fmtDate(d.date))}</b><small>${esc(d.reason || '—')}</small></div><button class="btn btn-outline btn-sm" data-unblock="${esc(d.date)}">Buka</button></div>`).join('') : '<p class="mb-empty">Belum ada tanggal yang ditutup.</p>';
}
$('blockDate').min = todayISO();
$('blockForm').addEventListener('submit', e => {
  e.preventDefault();
  if (ROLE !== 'admin') return;
  const entry = { date: $('blockDate').value, reason: $('blockReason').value.trim().slice(0, 200) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return;
  const list = Store.get('blockedDates', []);
  if (!list.some(d => d.date === entry.date)) list.push(entry);
  Store.set('blockedDates', list); cloudDo(() => Cloud.addBlocked(entry)); $('blockForm').reset(); renderDates();
});
$('blockList').addEventListener('click', e => {
  if (ROLE !== 'admin') return;
  const b = e.target.closest('[data-unblock]'); if (!b) return;
  Store.set('blockedDates', Store.get('blockedDates', []).filter(d => d.date !== b.dataset.unblock)); cloudDo(() => Cloud.removeBlocked(b.dataset.unblock)); renderDates();
});

// =====================================================================
// QR MEJA
// =====================================================================
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

// =====================================================================
// TESTIMONI (admin)
// =====================================================================
function renderReviews() {
  const list = (Store.get('reviews', []) || []).filter(r => safeCode(r.code));
  $('cReviews').textContent = list.filter(r => r.status === 'pending').length;
  $('reviewList').innerHTML = list.length ? list.map(r => `
    <article class="a-card">
      <header><div><b>${esc(r.name || '')}</b><small>${'★'.repeat(Math.max(0, Math.min(5, num(r.rating))))} · ${esc(new Date(r.createdAt).toLocaleDateString('id-ID'))}</small></div><span class="status-pill" data-status="${r.status === 'approved' ? 'siap' : 'menunggu'}">${r.status === 'approved' ? 'Tampil' : 'Menunggu'}</span></header>
      <p class="a-note">${esc(r.text || '')}</p>
      <footer><div></div><div class="btn-row">
        ${r.status !== 'approved' ? `<button class="btn btn-gold btn-sm" data-rcode="${esc(r.code)}" data-act="approve">Tampilkan</button>` : `<button class="btn btn-outline btn-sm" data-rcode="${esc(r.code)}" data-act="hide">Sembunyikan</button>`}
        <button class="btn btn-outline btn-sm" data-rcode="${esc(r.code)}" data-act="del">Hapus</button>
      </div></footer>
    </article>`).join('') : '<p class="mb-empty">Belum ada testimoni masuk.</p>';
}
$('reviewList').addEventListener('click', e => {
  if (ROLE !== 'admin') return;
  const b = e.target.closest('[data-rcode]'); if (!b) return;
  let list = Store.get('reviews', []);
  const code = b.dataset.rcode;
  if (b.dataset.act === 'del') { list = list.filter(r => r.code !== code); cloudDo(() => Cloud.remove('reviews', code)); }
  else { list = list.map(r => r.code === code ? { ...r, status: b.dataset.act === 'approve' ? 'approved' : 'pending' } : r); const r = list.find(x => x.code === code); cloudDo(() => Cloud.patch('reviews', r)); }
  Store.set('reviews', list); renderReviews();
});

// =====================================================================
// SINKRON DENGAN SERVER
// =====================================================================
let cloudErrShown = false;
function cloudDo(fn) {
  if (!Cloud.on) return;
  fn().catch(err => {
    if (/unauthorized/.test(err.message)) return logout();          // sesi habis -> login ulang
    if (!cloudErrShown) { cloudErrShown = true; toast('Gagal menyimpan ke server. Cek koneksi / hak akses.'); setTimeout(() => cloudErrShown = false, 8000); }
  });
}
let pulling = false;
async function pullAll() {
  if (!Cloud.on || pulling || !ROLE) return;
  pulling = true;
  try {
    const admin = ROLE === 'admin';
    const [orders, bookings, reviews, blocked] = await Promise.all([
      Cloud.list('orders'), Cloud.list('bookings'),
      admin ? Cloud.list('reviews') : Promise.resolve(null), admin ? Cloud.listBlocked() : Promise.resolve(null)
    ]);
    Store.set('orders', orders); Store.set('bookings', bookings);
    if (reviews) Store.set('reviews', reviews);
    if (blocked) Store.set('blockedDates', blocked);
  } catch (err) { if (/unauthorized/.test(err.message)) logout(); }
  pulling = false;
}

function renderAll() { renderOrders(); renderBookings(); renderDates(); renderReviews(); }
window.addEventListener('storage', () => { if (!$('adminApp').hidden) renderAll(); });
setInterval(async () => { if (!$('adminApp').hidden && !document.hidden) { await pullAll(); renderOrders(); renderBookings(); renderReviews(); } }, 4000);

// Pulihkan sesi (hanya bila token server masih ada)
try {
  const saved = sessionStorage.getItem('lenteras:admin');
  if (saved && (!Cloud.on || (Cloud.jwt() && Cloud.role() === saved))) unlock(saved);
} catch { /* abaikan */ }
