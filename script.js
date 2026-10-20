// LENTERAS — landing page
const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const setNav = open => {
  mainNav.classList.toggle('open', open);
  menuToggle.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi');
  document.body.classList.toggle('nav-open', open);
};
menuToggle.addEventListener('click', () => setNav(!mainNav.classList.contains('open')));
mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setNav(false)));
addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });
addEventListener('resize', () => { if (innerWidth > 760) setNav(false); });
$('year').textContent = new Date().getFullYear();

// ----- Ikon SVG -----
const ICON = {
  star: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.7 5.7 6.2.8-4.6 4.3 1.2 6.2L12 16.7 6.5 19.8l1.2-6.2L3.1 9.3l6.2-.8z"/></svg>',
  quote: '<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><path fill="currentColor" d="M10 30c0-8 4-14 11-17l1.5 2.6C18.6 17.6 17 20 16.7 23H22v13H10zm18 0c0-8 4-14 11-17l1.5 2.6C36.6 17.6 35 20 34.7 23H40v13H28z"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

// ----- Menu pilihan: kartu foto dengan teks di atas gambar -----
const catLabel = id => CATEGORIES.find(c => c.id === id)?.label || '';
$('favGrid').innerHTML = FAVOURITES.map(name => MENU.find(m => m.name === name)).filter(Boolean).map(m => `
  <article class="fav-card" data-id="${m.id}">
    <img src="${m.img}" alt="${escapeHTML(m.name)}" loading="lazy">
    <span class="fav-cat">${catLabel(m.cat)}</span>
    <div class="fav-overlay">
      <h3>${escapeHTML(m.name)}</h3>
      <p>${escapeHTML(m.desc || 'Menu andalan Lenteras.')}</p>
      <span class="fav-price">${rupiah(m.price)}</span>
      <button type="button" class="fav-add" data-add>Pesan sekarang</button>
    </div>
  </article>`).join('');
$('favGrid').addEventListener('click', e => {
  const card = e.target.closest('.fav-card'); if (!card) return;
  const id = card.dataset.id;
  if (e.target.closest('[data-add]')) {
    // Masukkan ke keranjang halaman pesan, lalu buka halaman pesan.
    const cart = Store.get('cart', {});
    cart[id] = Math.min(99, (cart[id] || 0) + 1);
    Store.set('cart', cart);
    location.href = 'order.html';
  }
});
// ----- Carousel menu pilihan -----
(() => {
  const track = $('favGrid'), cards = [...track.children];
  $('favPrev').innerHTML = ICON.left; $('favNext').innerHTML = ICON.right;
  $('favDots').innerHTML = cards.map((_, i) => `<button type="button" aria-label="Menu ${i + 1}"></button>`).join('');
  const dots = [...$('favDots').children];
  const step = () => cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
  const maxScroll = () => track.scrollWidth - track.clientWidth;
  const go = dir => {
    const atEnd = track.scrollLeft >= maxScroll() - 4, atStart = track.scrollLeft <= 4;
    const left = dir > 0 ? (atEnd ? 0 : track.scrollLeft + step()) : (atStart ? maxScroll() : track.scrollLeft - step());
    track.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  // Efek: kartu yang paling dekat tengah membesar, yang di tepi mengecil & meredup
  const paint = () => {
    const box = track.getBoundingClientRect(), mid = box.left + box.width / 2;
    let best = 0, bestD = Infinity;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid), n = Math.min(d / (box.width * .6), 1);
      c.style.scale = (1 - n * .08).toFixed(3);
      c.style.filter = `brightness(${(1 - n * .22).toFixed(3)})`;
      if (d < bestD) { bestD = d; best = i; }
    });
    dots.forEach((d, i) => d.classList.toggle('on', i === best));
  };
  let raf; track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }, { passive: true });
  addEventListener('resize', paint);
  $('favPrev').addEventListener('click', () => go(-1));
  $('favNext').addEventListener('click', () => go(1));
  dots.forEach((d, i) => d.addEventListener('click', () => cards[i].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })));
  track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
  // Putar otomatis (berhenti saat disentuh / dihover / tab tidak terlihat)
  let timer; const car = $('favCarousel');
  const start = () => { if (reduceMotion) return; clearInterval(timer); timer = setInterval(() => { if (!document.hidden) go(1); }, 4200); };
  const stop = () => clearInterval(timer);
  car.addEventListener('mouseenter', stop); car.addEventListener('mouseleave', start);
  car.addEventListener('touchstart', stop, { passive: true }); car.addEventListener('touchend', () => setTimeout(start, 6000), { passive: true });
  paint(); start();
})();
// ----- Kategori menu: chip yang bisa digeser (carousel) -----
$('catStrip').innerHTML = CATEGORIES.map(c => `<a class="cat-chip" href="order.html?cat=${c.id}">${c.label}</a>`).join('');
(() => {
  const strip = $('catStrip'), prev = $('catPrev'), next = $('catNext');
  prev.innerHTML = ICON.left; next.innerHTML = ICON.right;
  const sync = () => {
    const max = strip.scrollWidth - strip.clientWidth;
    prev.hidden = strip.scrollLeft < 8; next.hidden = strip.scrollLeft > max - 8 || max <= 0;
    $('catCarousel').classList.toggle('fade-l', !prev.hidden); $('catCarousel').classList.toggle('fade-r', !next.hidden);
  };
  const by = dir => strip.scrollBy({ left: dir * strip.clientWidth * .7, behavior: reduceMotion ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => by(-1)); next.addEventListener('click', () => by(1));
  strip.addEventListener('scroll', sync, { passive: true }); addEventListener('resize', sync); sync();
  // seret dengan mouse
  let down = false, sx = 0, sl = 0, moved = false;
  strip.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = strip.scrollLeft; });
  addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; strip.classList.add('drag'); } strip.scrollLeft = sl - dx; });
  addEventListener('pointerup', () => { down = false; setTimeout(() => strip.classList.remove('drag'), 0); });
  strip.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);
  // tampilkan sekilas bahwa daftar bisa digeser
  if (!reduceMotion) setTimeout(() => { if (strip.scrollWidth > strip.clientWidth && strip.scrollLeft === 0) { strip.scrollTo({ left: 90, behavior: 'smooth' }); setTimeout(() => strip.scrollTo({ left: 0, behavior: 'smooth' }), 700); } }, 1500);
})();


// ----- Galeri + lightbox -----
$('galleryGrid').innerHTML = GALLERY.map(g => `
  <button type="button" class="gallery-item${g.tall ? ' gallery-tall' : ''}" data-g="${g.id}" aria-label="Lihat foto ${escapeHTML(g.title)}">
    <img src="${g.photos[0].src.replace('w=1400', 'w=900')}" alt="${escapeHTML(g.photos[0].cap)}" loading="lazy">
    <span class="g-title">${escapeHTML(g.title)}</span>
    <span class="g-count">${g.photos.length} foto</span>
  </button>`).join('');
(() => {
  const lb = $('lightbox'); let g = null, i = 0, opener = null;
  const show = n => {
    i = (n + g.photos.length) % g.photos.length;
    const p = g.photos[i];
    $('lbImg').classList.remove('in'); $('lbImg').src = p.src; $('lbImg').alt = p.cap;
    $('lbImg').onload = () => $('lbImg').classList.add('in');
    $('lbCap').textContent = p.cap; $('lbCount').textContent = `${i + 1} / ${g.photos.length}`;
    [...$('lbThumbs').children].forEach((t, k) => t.classList.toggle('on', k === i));
    $('lbThumbs').children[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    // pra-muat foto berikutnya
    const nx = new Image(); nx.src = g.photos[(i + 1) % g.photos.length].src;
  };
  const open = (id, from) => {
    g = GALLERY.find(x => x.id === id); if (!g) return; opener = from;
    $('lbTag').textContent = g.tag; $('lbTitle').textContent = g.title; $('lbDesc').textContent = g.desc;
    $('lbCta').textContent = g.cta.label; $('lbCta').href = g.cta.href;
    $('lbThumbs').innerHTML = g.photos.map((p, k) => `<button type="button" data-k="${k}" aria-label="Foto ${k + 1}"><img src="${p.src.replace('w=1400', 'w=200')}" alt="" loading="lazy"></button>`).join('');
    $('lbThumbs').hidden = g.photos.length < 2; $('lbPrev').hidden = $('lbNext').hidden = g.photos.length < 2; $('lbCount').hidden = g.photos.length < 2;
    lb.hidden = false; document.body.classList.add('no-scroll');
    requestAnimationFrame(() => lb.classList.add('open'));
    show(0); lb.querySelector('.lb-close').focus();
  };
  const close = () => { lb.classList.remove('open'); document.body.classList.remove('no-scroll'); setTimeout(() => { lb.hidden = true; $('lbImg').removeAttribute('src'); }, 250); opener?.focus(); };
  $('galleryGrid').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) open(b.dataset.g, b); });
  lb.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); const t = e.target.closest('[data-k]'); if (t) show(+t.dataset.k); });
  $('lbPrev').innerHTML = ICON.left; $('lbNext').innerHTML = ICON.right;
  $('lbPrev').addEventListener('click', () => show(i - 1)); $('lbNext').addEventListener('click', () => show(i + 1));
  addEventListener('keydown', e => { if (lb.hidden) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); });
  // geser jari
  let tx = null;
  $('lbImg').addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  $('lbImg').addEventListener('touchend', e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); tx = null; });
})();

// ----- Paket venue -----
$('pkgGrid').innerHTML = VENUE_PACKAGES.map(p => `
  <article class="pkg-tile">
    <small>${p.tag}</small>
    <h3>${p.name}</h3>
    <p>${p.desc}</p>
    <ul>${p.points.map(x => `<li>${x}</li>`).join('')}</ul>
    <a href="booking.html?paket=${p.id}">Pilih paket ini →</a>
  </article>`).join('');

// ----- Marquee -----
const words = ['Coffee', 'Signature', 'Intimate Wedding', 'Rice Bowl', 'Pastry', 'Private Gathering', 'Mocktail', 'Scan & Pay QRIS'];
const run = words.map(w => `<span>${w}</span><i>✦</i>`).join('');
$('marqueeTrack').innerHTML = run + run + run + run;

// ----- Testimoni -----
const stars = n => Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'on' : ''}">${ICON.star}</span>`).join('');
let auto;
function initTestimonials(approved) {
  const testis = [...approved, ...SAMPLE_TESTIMONIALS.slice(0, Math.max(0, 3 - approved.length))];
  $('testiTrack').innerHTML = testis.map(t => `
    <figure class="testi-card">
      <span class="testi-quote">${ICON.quote}</span>
      <div class="stars" role="img" aria-label="${t.rating} dari 5 bintang">${stars(t.rating)}</div>
      <blockquote>${escapeHTML(t.text)}</blockquote>
      <figcaption><span class="avatar">${escapeHTML(t.name[0].toUpperCase())}</span><div><b>${escapeHTML(t.name)}</b><small>${escapeHTML(t.role || 'Pelanggan')}</small></div></figcaption>
    </figure>`).join('');
  $('testiNote').hidden = approved.length >= 3;
  $('tPrev').innerHTML = ICON.left; $('tNext').innerHTML = ICON.right;

  const track = $('testiTrack'), cards = [...track.children];
  $('tDots').innerHTML = cards.map((_, i) => `<button type="button" aria-label="Testimoni ${i + 1}"></button>`).join('');
  const dots = [...$('tDots').children];
  let cur = 0;
  const goTo = i => {
    cur = (i + cards.length) % cards.length;
    track.scrollTo({ left: cards[cur].offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  track.onscroll = () => {
    const pos = c => Math.abs(c.offsetLeft - track.offsetLeft - track.scrollLeft);
    const idx = cards.reduce((best, c, i) => pos(c) < pos(cards[best]) ? i : best, 0);
    dots.forEach((d, i) => d.classList.toggle('on', i === idx)); cur = idx;
  };
  dots.forEach((d, i) => { d.onclick = () => goTo(i); });
  $('tPrev').onclick = () => goTo(cur - 1);
  $('tNext').onclick = () => goTo(cur + 1);
  dots[0]?.classList.add('on');
  const startAuto = () => { if (reduceMotion) return; clearInterval(auto); auto = setInterval(() => goTo(cur + 1), 5500); };
  $('testi').onmouseenter = () => clearInterval(auto);
  $('testi').onmouseleave = startAuto;
  $('testi').ontouchstart = () => clearInterval(auto);
  startAuto();
}
initTestimonials(Store.get('reviews', []).filter(r => r.status === 'approved'));
// Bila tersambung ke server: ambil ulasan yang sudah disetujui admin dari semua pelanggan.
if (Cloud.on) Cloud.approvedReviews().then(list => { if (list.length) initTestimonials(list); }).catch(() => {});

// Form testimoni (masuk antrean persetujuan admin)
let rating = 5;
$('rvStars').innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${n === 5}" aria-label="${n} bintang" data-n="${n}">${ICON.star}</button>`).join('');
const paintStars = () => $('rvStars').querySelectorAll('button').forEach(b => { b.classList.toggle('on', +b.dataset.n <= rating); b.setAttribute('aria-checked', +b.dataset.n === rating); });
$('rvStars').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { rating = +b.dataset.n; paintStars(); } });
paintStars();
$('reviewForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('rvName').value.trim(), text = $('rvText').value.trim();
  if (!name || !text) return;
  const review = { code: makeCode('RV', 'reviews'), name, text, rating, role: 'Pelanggan', status: 'pending', createdAt: new Date().toISOString() };
  Store.upsert('reviews', review);
  if (Cloud.on) Cloud.createReview(review).catch(() => {});
  e.target.reset(); rating = 5; paintStars();
  toast('Terima kasih! Testimoni kamu akan tampil setelah disetujui admin.');
});

// ----- Animasi scroll -----
const header = document.querySelector('.site-header');
const heroImg = document.querySelector('.hero-image');
const progress = $('scrollProgress');
let ticking = false;
const onScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  header.classList.toggle('scrolled', scrollY > 30);
  if (!reduceMotion && scrollY < 900) heroImg.style.transform = `translate3d(0, ${scrollY * .16}px, 0)`;
  ticking = false;
};
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

// Muncul saat di-scroll: variasi arah & urutan bertahap
if (!reduceMotion && 'IntersectionObserver' in window) {
  const targets = [
    ['.section-head', 'up', 0], ['.flow-item', 'up', 1], ['.fav-carousel', 'up', 0], ['.cat-strip', 'up', 0],
    ['.pkg-tile', 'up', 1], ['.book-flow', 'up', 0], ['.book-flow li', 'left', 1], ['.gallery-item', 'zoom', 1],
    ['.testi', 'up', 0], ['.review-form', 'up', 0], ['.contact-card > div:first-child', 'left', 0], ['.contact-cta', 'right', 0],
    ['.center-action', 'up', 0], ['.footer-top > *', 'up', 1], ['.how .btn-dark', 'up', 0]
  ];
  targets.forEach(([sel, kind, stagger]) => document.querySelectorAll(sel).forEach((el, i) => {
    el.classList.add('reveal', 'r-' + kind);
    if (stagger) el.style.setProperty('--d', Math.min(i, 5) * 90 + 'ms');
  }));
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: .08, rootMargin: '0px 0px -4% 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  // Jaga-jaga: bila ada yang belum terlihat setelah 4 detik (mis. tab di background), tampilkan.
  setTimeout(() => document.querySelectorAll('.reveal:not(.in)').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight) el.classList.add('in'); }), 4000);
}
