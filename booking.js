// LENTERAS — booking venue
const $ = id => document.getElementById(id);
const form = $('bookingForm');
const cart = {};
const urlPkg = new URLSearchParams(location.search).get('paket');

// ----- Form dasar -----
$('bDate').min = todayISO();
$('bSlot').innerHTML = CONFIG.timeSlots.map(s => `<option>${s}</option>`).join('');
$('pkgList').innerHTML = VENUE_PACKAGES.map((p, i) => `
  <label class="pkg">
    <input type="radio" name="pkg" value="${p.id}" ${(urlPkg ? urlPkg === p.id : i === 0) ? 'checked' : ''}>
    <span class="pkg-card">
      <small>${p.tag}</small><b>${p.name}</b><em>${p.desc}</em>
      <ul>${p.points.map(x => `<li>${x}</li>`).join('')}</ul>
    </span>
  </label>`).join('');

const guests = $('bGuests');
const clampGuests = () => { guests.value = Math.min(500, Math.max(1, parseInt(guests.value, 10) || 1)); update(); };
$('gMinus').addEventListener('click', () => { guests.value = (parseInt(guests.value, 10) || 1) - 1; clampGuests(); });
$('gPlus').addEventListener('click', () => { guests.value = (parseInt(guests.value, 10) || 0) + 1; clampGuests(); });
guests.addEventListener('change', clampGuests);

// ----- Ketersediaan awal (berdasar data admin; tetap perlu konfirmasi) -----
function availability(date, slot) {
  if (!date) return { state: 'idle', text: 'Pilih tanggal untuk melihat info ketersediaan awal.' };
  const blocked = Store.get('blockedDates', []).find(b => b.date === date);
  if (blocked) return { state: 'no', text: 'Tanggal ini tidak tersedia. Silakan pilih tanggal lain.' };
  const clash = b => b.date === date && (b.slot === slot || b.slot === CONFIG.timeSlots[3] || slot === CONFIG.timeSlots[3]);
  const taken = Store.get('bookings', []).some(b => b.status === 'tersedia' && clash(b)) || Store.get('bookedSlots', []).some(clash);
  if (taken) return { state: 'no', text: 'Waktu ini sudah terisi booking lain. Coba waktu atau tanggal lain.' };
  return { state: 'ok', text: 'Belum ada booking terkonfirmasi di waktu ini. Ketersediaan final dikonfirmasi admin.' };
}

// ----- Pre-order menu -----
const fbBox = $('fbBox');
const browser = createMenuBrowser($('menuBrowser'), cart, update);
$('fbToggle').addEventListener('change', e => {
  fbBox.hidden = !e.target.checked;
  if (!e.target.checked) { Object.keys(cart).forEach(k => delete cart[k]); browser.refresh(); }
  update();
});

// ----- Ringkasan -----
const pkgName = () => VENUE_PACKAGES.find(p => p.id === form.elements.pkg.value)?.name || '';
const fmtDate = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';

function summaryHTML(d) {
  return `<div><dt>Tanggal</dt><dd>${fmtDate(d.date)}</dd></div><div><dt>Waktu</dt><dd>${escapeHTML(d.slot)}</dd></div>
    <div><dt>Tamu</dt><dd>${d.guests} orang</dd></div><div><dt>Paket</dt><dd>${escapeHTML(d.pkg)}</dd></div>`;
}

function update() {
  const av = availability($('bDate').value, $('bSlot').value);
  const note = $('availNote');
  note.textContent = av.text; note.dataset.state = av.state;
  $('barInfo').textContent = $('bDate').value ? new Date($('bDate').value + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' · ' + guests.value + ' tamu' : 'Pilih tanggal';
  $('sumList').innerHTML = summaryHTML({ date: $('bDate').value, slot: $('bSlot').value, guests: guests.value, pkg: pkgName() });
  const lines = Cart.lines(cart);
  $('sumFood').innerHTML = lines.length
    ? `<h3>Pre-order menu</h3>` + cartLinesHTML(cart) : '';
  $('sumTotalRow').hidden = !lines.length;
  $('sumTotal').textContent = rupiah(Cart.total(cart));
}
$('sumFood').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  Cart.change(cart, b.closest('.cl').dataset.id, b.dataset.act === 'inc' ? 1 : -1);
  browser.refresh(); update();
});
form.addEventListener('input', update);
form.addEventListener('change', update);

// ----- Kirim -----
const err = $('bError');
const showError = (msg, el) => { err.textContent = msg; err.hidden = !msg; if (el) el.focus(); };

form.addEventListener('submit', e => {
  e.preventDefault();
  showError('');
  const date = $('bDate').value, slot = $('bSlot').value;
  if (!date) return showError('Pilih tanggal acara terlebih dahulu.', $('bDate'));
  if (date < todayISO()) return showError('Tanggal acara tidak boleh di masa lalu.', $('bDate'));
  if (availability(date, slot).state === 'no') return showError('Tanggal / waktu tersebut tidak tersedia. Pilih yang lain.', $('bDate'));
  const name = $('bName').value.trim();
  if (!name) return showError('Isi nama lengkap.', $('bName'));
  const phone = $('bPhone').value.trim();
  if (!/^[0-9+\-\s]{9,16}$/.test(phone)) return showError('Isi nomor WhatsApp yang valid agar admin bisa menghubungi kamu.', $('bPhone'));

  const booking = {
    code: makeCode('BK', 'bookings'),
    createdAt: new Date().toISOString(),
    date, slot, guests: Number(guests.value), pkg: pkgName(),
    name, phone, note: $('bNote').value.trim(),
    items: Cart.lines(cart), foodTotal: Cart.total(cart),
    status: 'menunggu', adminNote: ''
  };
  Store.upsert('bookings', booking);
  if (Cloud.on) Cloud.createBooking(booking).catch(() => toast('Koneksi ke server bermasalah. Hubungi admin lewat WhatsApp dengan kode booking.'));
  showDone(booking);
});

function showDone(b) {
  $('bDone').hidden = false;
  document.body.classList.add('no-scroll');
  $('dName').textContent = b.name.split(' ')[0];
  $('dCode').textContent = b.code;
  $('dStatus').textContent = STATUS_LABEL[b.status]; $('dStatus').dataset.status = b.status;
  $('dSummary').innerHTML = summaryHTML(b) + (b.items.length ? `<div><dt>Menu</dt><dd>${b.items.map(i => `${i.qty}× ${escapeHTML(i.name)}`).join(', ')}</dd></div>` : '');
  const text = [`Halo Lenteras, saya ingin booking venue.`, `Kode: ${b.code}`, `Nama: ${b.name}`, `Paket: ${b.pkg}`, `Tanggal: ${fmtDate(b.date)} (${b.slot})`, `Jumlah tamu: ${b.guests}`,
    b.items.length ? `\nPre-order menu:\n${linesText(Object.fromEntries(b.items.map(i => [i.id, i.qty])))}\nEstimasi: ${rupiah(b.foodTotal)}` : '', b.note ? `\nCatatan: ${b.note}` : ''].filter(Boolean).join('\n');
  const link = waLink(text);
  $('dWa').hidden = !link; if (link) $('dWa').href = link;
}
$('dClose').addEventListener('click', () => { $('bDone').hidden = true; document.body.classList.remove('no-scroll'); form.reset(); Object.keys(cart).forEach(k => delete cart[k]); browser.refresh(); fbBox.hidden = true; update(); window.scrollTo({ top: 0 }); });

// ----- Cek status -----
$('trackForm').addEventListener('submit', async e => {
  e.preventDefault();
  const out = $('trackResult');
  let b = Store.find('bookings', $('trackCode').value);
  if (Cloud.on) { try { b = (await Cloud.trackBooking($('trackCode').value.trim().toUpperCase())) || b; } catch { /* pakai data lokal */ } }
  out.hidden = false;
  if (!b) { out.textContent = 'Kode tidak ditemukan di perangkat ini. Pastikan kode benar, atau hubungi admin.'; return; }
  out.innerHTML = `<b>${STATUS_LABEL[b.status]}</b><br>${fmtDate(b.date)} · ${escapeHTML(b.slot)}${b.adminNote ? `<br><em>Catatan admin: ${escapeHTML(b.adminNote)}</em>` : ''}`;
});

// Bila tersambung ke server: ambil tanggal yang ditutup & slot yang sudah terkonfirmasi.
if (Cloud.on) {
  Promise.all([Cloud.blockedDates(), Cloud.bookedSlots()]).then(([blocked, booked]) => {
    Store.set('blockedDates', blocked || []); Store.set('bookedSlots', booked || []); update();
  }).catch(() => {});
}

update();
