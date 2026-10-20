// LENTERAS — inti aplikasi: penyimpanan, keranjang, komponen daftar menu.
// Penyimpanan memakai localStorage (mode demo). Lihat README untuk menyambungkan ke database agar
// pesanan dari HP pelanggan masuk ke perangkat kasir/admin.

const Store = {
  get(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem('lenteras:' + key)); return v === null || v === undefined ? fallback : v; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('lenteras:' + key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  // Tambah / ubah satu rekaman berdasarkan field `code` pada daftar `key`.
  upsert(key, record) {
    const list = this.get(key, []);
    const i = list.findIndex(r => r.code === record.code);
    if (i >= 0) list[i] = record; else list.unshift(record);
    this.set(key, list);
    return record;
  },
  find(key, code) { return this.get(key, []).find(r => r.code === String(code).trim().toUpperCase()); }
};

// Indeks acak yang kuat (crypto) — kode pesanan tidak boleh mudah ditebak.
function secureIndex(n) {
  try { const a = new Uint32Array(1); const lim = Math.floor(0x100000000 / n) * n; do { crypto.getRandomValues(a); } while (a[0] >= lim); return a[0] % n; }
  catch { return Math.floor(Math.random() * n); }
}

function makeCode(prefix, key) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existing = new Set(Store.get(key, []).map(r => r.code));
  let code;
  do {
    code = prefix + '-' + Array.from({ length: 6 }, () => chars[secureIndex(chars.length)]).join('');
  } while (existing.has(code));
  return code;
}

function toast(message) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}

function waLink(text) {
  if (!CONFIG.whatsapp) return '';
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
}

// ===== Keranjang: objek { idMenu: jumlah } =====
const Cart = {
  count: cart => Object.values(cart).reduce((a, b) => a + b, 0),
  total: cart => Object.entries(cart).reduce((sum, [id, q]) => sum + (byId(id)?.price || 0) * q, 0),
  lines: cart => Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ id, name: byId(id).name, price: byId(id).price, qty: q })),
  change(cart, id, delta) {
    const next = Math.max(0, (cart[id] || 0) + delta);
    if (next === 0) delete cart[id]; else cart[id] = Math.min(next, 99);
  }
};

// ===== Komponen daftar menu (dipakai di halaman pesan & booking) =====
function createMenuBrowser(root, cart, onChange) {
  root.classList.add('mb');
  root.innerHTML = `
    <div class="mb-search-wrap">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input type="search" class="mb-search" placeholder="Cari menu, mis. latte, nasi goreng…" aria-label="Cari menu">
    </div>
    <div class="mb-chips" role="tablist" aria-label="Kategori menu"></div>
    <div class="mb-list"></div>`;
  const search = root.querySelector('.mb-search');
  const chipsEl = root.querySelector('.mb-chips');
  const list = root.querySelector('.mb-list');
  let cat = 'all';

  const chips = [{ id: 'all', label: 'Semua' }, { id: 'drink', label: 'Minuman' }, { id: 'food', label: 'Makanan' }, ...CATEGORIES];
  chipsEl.innerHTML = chips.map(c => `<button type="button" class="chip${c.id === 'all' ? ' active' : ''}" data-cat="${c.id}" role="tab" aria-selected="${c.id === 'all'}">${c.label}</button>`).join('');

  const ctl = id => {
    const q = cart[id] || 0;
    return q
      ? `<div class="stepper"><button type="button" data-act="dec" aria-label="Kurangi">−</button><b>${q}</b><button type="button" data-act="inc" aria-label="Tambah">+</button></div>`
      : `<button type="button" class="add-btn" data-act="inc">Tambah</button>`;
  };
  const thumb = m => m.img
    ? `<img class="mi-img" src="${m.img}" alt="${escapeHTML(m.name)}" loading="lazy" width="84" height="84">`
    : `<span class="mi-img mi-ph" aria-hidden="true">L.</span>`;
  const row = m => `<div class="mi" data-id="${m.id}">${thumb(m)}<div class="mi-info"><h4>${escapeHTML(m.name)}</h4>${m.desc ? `<p>${escapeHTML(m.desc)}</p>` : ''}<span class="mi-price">${rupiah(m.price)}</span></div><div class="mi-ctl">${ctl(m.id)}</div></div>`;

  function render() {
    const q = search.value.trim().toLowerCase();
    const allowed = c => cat === 'all' || cat === c || (GROUPS[cat] && GROUPS[cat].includes(c));
    const items = MENU.filter(m => allowed(m.cat) && (!q || (m.name + ' ' + m.desc).toLowerCase().includes(q)));
    if (!items.length) { list.innerHTML = '<p class="mb-empty">Menu tidak ditemukan. Coba kata kunci lain.</p>'; return; }
    list.innerHTML = CATEGORIES.map(c => {
      const rows = items.filter(m => m.cat === c.id);
      return rows.length ? `<section class="mb-group"><h3>${c.label}</h3>${rows.map(row).join('')}</section>` : '';
    }).join('');
  }

  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    cat = b.dataset.cat;
    chipsEl.querySelectorAll('.chip').forEach(c => { const on = c === b; c.classList.toggle('active', on); c.setAttribute('aria-selected', on); });
    render();
  });
  search.addEventListener('input', render);
  search.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.mi').dataset.id;
    Cart.change(cart, id, b.dataset.act === 'inc' ? 1 : -1);
    const mi = b.closest('.mi');
    mi.querySelector('.mi-ctl').innerHTML = ctl(id);
    mi.classList.remove('pulse'); void mi.offsetWidth; mi.classList.add('pulse');
    onChange();
  });
  render();
  return { refresh: render };
}

// Tabel ringkasan keranjang (HTML) dengan tombol +/−
function cartLinesHTML(cart) {
  const lines = Cart.lines(cart);
  if (!lines.length) return '<p class="mb-empty">Belum ada menu dipilih.</p>';
  return lines.map(l => `<div class="cl" data-id="${l.id}"><div><b>${escapeHTML(l.name)}</b><small>${rupiah(l.price)}</small></div><div class="stepper"><button type="button" data-act="dec" aria-label="Kurangi">−</button><b>${l.qty}</b><button type="button" data-act="inc" aria-label="Tambah">+</button></div><span class="cl-sub">${rupiah(l.price * l.qty)}</span></div>`).join('');
}

function linesText(cart) {
  return Cart.lines(cart).map(l => `• ${l.qty}x ${l.name} — ${rupiah(l.price * l.qty)}`).join('\n');
}

const STATUS_LABEL = {
  'menunggu-bayar': 'Menunggu pembayaran', 'menunggu-verifikasi': 'Menunggu verifikasi kasir', 'diproses': 'Sedang disiapkan',
  'siap': 'Siap / diantar', 'selesai': 'Selesai — pesanan siap', 'batal': 'Dibatalkan',
  'menunggu': 'Menunggu konfirmasi admin', 'tersedia': 'Tanggal tersedia — dikonfirmasi', 'ditolak': 'Tidak tersedia'
};

// =====================================================================
// BUNYI & NOTIFIKASI — dipakai halaman pesan saat status pesanan berubah
// =====================================================================
const Chime = {
  ctx: null, timer: null, stopTimer: null,
  // Browser hanya mengizinkan suara setelah ada sentuhan/klik. Panggil unlock() dari event pengguna.
  unlock() {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* tanpa audio */ }
  },
  _note(freq, start, dur, vol = .28) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + .02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(c.destination); o.start(start); o.stop(start + dur + .05);
  },
  once() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + .02;
    [659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => this._note(f, t + i * .17, .45));
  },
  // Bunyi berulang sampai dimatikan (atau maksimal `ms`).
  ring(ms = 60000) {
    this.stop();
    this.once();
    this.timer = setInterval(() => this.once(), 2400);
    this.stopTimer = setTimeout(() => this.stop(), ms);
    try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 600]); } catch { /* abaikan */ }
  },
  stop() {
    clearInterval(this.timer); clearTimeout(this.stopTimer); this.timer = this.stopTimer = null;
    try { navigator.vibrate && navigator.vibrate(0); } catch { /* abaikan */ }
  },
  get ringing() { return !!this.timer; }
};

const Notify = {
  supported: () => 'Notification' in window,
  permission: () => ('Notification' in window ? Notification.permission : 'denied'),
  async register() {
    if (!('serviceWorker' in navigator)) return null;
    try { return await navigator.serviceWorker.register('sw.js'); } catch { return null; }
  },
  async ask() {
    if (!this.supported()) return 'denied';
    if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* abaikan */ } }
    return Notification.permission;
  },
  // Notifikasi sistem (muncul juga saat tab di background / layar HP terkunci).
  async show(title, body, tag = 'lenteras-order') {
    if (this.permission() !== 'granted') return false;
    const opts = { body, tag, renotify: true, requireInteraction: true, vibrate: [300, 150, 300, 150, 600], icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: location.pathname + location.search } };
    try {
      const reg = ('serviceWorker' in navigator) ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) { await reg.showNotification(title, opts); return true; }
      new Notification(title, opts); return true;
    } catch { return false; }
  },
  // Web Push: agar notifikasi tetap datang walau halaman/browser ditutup (butuh server push, lihat README).
  async subscribePush(code) {
    if (!CONFIG.vapidPublicKey || !('PushManager' in window)) return false;
    const reg = (await navigator.serviceWorker.getRegistration()) || (await this.register());
    if (!reg) return false;
    const key = Uint8Array.from(atob(CONFIG.vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    if (Cloud.on) await Cloud.savePush(code, sub.toJSON());
    return true;
  }
};

// =====================================================================
// CLOUD (opsional) — Supabase lewat REST. Kosongkan CONFIG.supabaseUrl/supabaseKey untuk mode demo lokal.
// Pelanggan memakai kunci anon; admin login (email+password) dan memakai token JWT miliknya.
// =====================================================================
const Cloud = {
  get on() { return !!(CONFIG.supabaseUrl && CONFIG.supabaseKey); },
  jwt() { try { return sessionStorage.getItem('lenteras:jwt'); } catch { return null; } },
  // ---- sesi staf (sessionStorage: hilang saat tab ditutup) ----
  setTokens(j) { try { sessionStorage.setItem('lenteras:jwt', j.access_token); if (j.refresh_token) sessionStorage.setItem('lenteras:rt', j.refresh_token); } catch { /* abaikan */ } },
  clearTokens() { try { sessionStorage.removeItem('lenteras:jwt'); sessionStorage.removeItem('lenteras:rt'); } catch { /* abaikan */ } },
  role() {
    try { const p = JSON.parse(atob(this.jwt().split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return (p.app_metadata && p.app_metadata.role) || ''; } catch { return ''; }
  },
  async refresh() {
    let rt = null; try { rt = sessionStorage.getItem('lenteras:rt'); } catch { /* abaikan */ }
    if (!rt) throw new Error('unauthorized');
    const res = await fetch(CONFIG.supabaseUrl.replace(/\/$/, '') + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt })
    });
    if (!res.ok) throw new Error('unauthorized');
    this.setTokens(await res.json());
  },
  async req(path, { method = 'GET', body, prefer, admin = false, retried = false } = {}) {
    const res = await fetch(CONFIG.supabaseUrl.replace(/\/$/, '') + path, {
      method,
      headers: { apikey: CONFIG.supabaseKey, Authorization: 'Bearer ' + ((admin && this.jwt()) || CONFIG.supabaseKey), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (res.status === 401 && admin && !retried) {                 // token kedaluwarsa -> perbarui sekali lalu ulangi
      try { await this.refresh(); } catch { this.clearTokens(); throw new Error('unauthorized'); }
      return this.req(path, { method, body, prefer, admin, retried: true });
    }
    if (res.status === 401 && admin) { this.clearTokens(); throw new Error('unauthorized'); }
    if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} → ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },
  rpc(name, args, admin) { return this.req('/rest/v1/rpc/' + name, { method: 'POST', body: args, admin }); },
  toRecord(row) { return row ? { ...row.data, code: row.code, status: row.status } : null; },
  fromRecord(rec) { const { code, status, ...data } = rec; return { code, status, data }; },

  // ----- pelanggan -----
  createOrder(o) { return this.req('/rest/v1/orders', { method: 'POST', body: this.fromRecord(o), prefer: 'return=minimal' }); },
  createBooking(b) { return this.req('/rest/v1/bookings', { method: 'POST', body: this.fromRecord(b), prefer: 'return=minimal' }); },
  createReview(r) { return this.req('/rest/v1/reviews', { method: 'POST', body: this.fromRecord(r), prefer: 'return=minimal' }); },
  async trackOrder(code) { return this.toRecord(await this.rpc('track_order', { p_code: code })); },
  async trackBooking(code) { return this.toRecord(await this.rpc('track_booking', { p_code: code })); },
  claimPaid(code) { return this.rpc('claim_paid', { p_code: code }); },
  bookedSlots() { return this.rpc('booked_slots', {}); },
  blockedDates() { return this.req('/rest/v1/blocked_dates?select=date,reason'); },
  async approvedReviews() { return ((await this.req('/rest/v1/reviews?status=eq.approved&select=code,status,data&order=created_at.desc&limit=12')) || []).map(r => this.toRecord(r)); },
  savePush(code, sub) { return this.req('/rest/v1/push_subs', { method: 'POST', body: { order_code: code, sub }, prefer: 'return=minimal' }); },

  // ----- admin -----
  // Mengembalikan peran dari JWT yang diterbitkan server ('admin' | 'kasir'); selain itu ditolak.
  async login(email, pin) {
    const res = await fetch(CONFIG.supabaseUrl.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pin })
    });
    if (!res.ok) throw new Error('login gagal');
    this.setTokens(await res.json());
    const role = this.role();
    if (role !== 'admin' && role !== 'kasir') { await this.logout(); throw new Error('akun ini bukan staf'); }
    return role;
  },
  async logout() {
    const jwt = this.jwt();
    this.clearTokens();
    if (jwt) { try { await fetch(CONFIG.supabaseUrl.replace(/\/$/, '') + '/auth/v1/logout', { method: 'POST', headers: { apikey: CONFIG.supabaseKey, Authorization: 'Bearer ' + jwt } }); } catch { /* abaikan */ } }
  },
  async list(table) { return ((await this.req(`/rest/v1/${table}?select=*&order=created_at.desc&limit=300`, { admin: true })) || []).map(r => this.toRecord(r)); },
  patch(table, rec) { const { code, status, data } = this.fromRecord(rec); return this.req(`/rest/v1/${table}?code=eq.${encodeURIComponent(code)}`, { method: 'PATCH', body: { status, data, updated_at: new Date().toISOString() }, prefer: 'return=minimal', admin: true }); },
  remove(table, code) { return this.req(`/rest/v1/${table}?code=eq.${encodeURIComponent(code)}`, { method: 'DELETE', admin: true }); },
  async listBlocked() { return (await this.req('/rest/v1/blocked_dates?select=date,reason&order=date.asc', { admin: true })) || []; },
  addBlocked(d) { return this.req('/rest/v1/blocked_dates', { method: 'POST', body: d, prefer: 'resolution=merge-duplicates,return=minimal', admin: true }); },
  removeBlocked(date) { return this.req(`/rest/v1/blocked_dates?date=eq.${encodeURIComponent(date)}`, { method: 'DELETE', admin: true }); }
};
