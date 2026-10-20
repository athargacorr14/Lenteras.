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

function makeCode(prefix, key) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existing = new Set(Store.get(key, []).map(r => r.code));
  let code;
  do {
    code = prefix + '-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
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
  'siap': 'Siap / diantar', 'selesai': 'Selesai', 'batal': 'Dibatalkan',
  'menunggu': 'Menunggu konfirmasi admin', 'tersedia': 'Tanggal tersedia — dikonfirmasi', 'ditolak': 'Tidak tersedia'
};
