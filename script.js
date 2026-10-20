// LENTERAS — landing page
const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
menuToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi');
});
mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { mainNav.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); }));
$('year').textContent = new Date().getFullYear();

// ----- Menu pilihan (dengan foto) -----
const catLabel = id => CATEGORIES.find(c => c.id === id)?.label || '';
$('favGrid').innerHTML = FAVOURITES.map(name => MENU.find(m => m.name === name)).filter(Boolean).map(m => `
  <a class="fav-card" href="order.html">
    <span class="fav-img">${m.img ? `<img src="${m.img}" alt="${escapeHTML(m.name)}" loading="lazy">` : ''}<span class="fav-cat">${catLabel(m.cat)}</span></span>
    <div class="fav-body">
      <h3>${escapeHTML(m.name)}</h3>
      <p>${escapeHTML(m.desc || 'Menu andalan Lenteras.')}</p>
      <span class="fav-foot"><b>${rupiah(m.price)}</b><i>Pesan →</i></span>
    </div>
  </a>`).join('');
$('catStrip').innerHTML = CATEGORIES.map(c => `<a href="order.html">${c.label}</a>`).join('');

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
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const approved = Store.get('reviews', []).filter(r => r.status === 'approved');
const testis = [...approved, ...SAMPLE_TESTIMONIALS.slice(0, Math.max(0, 3 - approved.length))];
$('testiTrack').innerHTML = testis.map(t => `
  <figure class="testi-card">
    <div class="stars" aria-label="${t.rating} dari 5 bintang">${stars(t.rating)}</div>
    <blockquote>“${escapeHTML(t.text)}”</blockquote>
    <figcaption><span class="avatar">${escapeHTML(t.name[0].toUpperCase())}</span><div><b>${escapeHTML(t.name)}</b><small>${escapeHTML(t.role || 'Pelanggan')}</small></div></figcaption>
  </figure>`).join('');
$('testiNote').hidden = approved.length >= 3;

const track = $('testiTrack');
const cards = [...track.children];
$('tDots').innerHTML = cards.map((_, i) => `<button type="button" aria-label="Testimoni ${i + 1}"></button>`).join('');
const dots = [...$('tDots').children];
let cur = 0;
const goTo = i => {
  cur = (i + cards.length) % cards.length;
  track.scrollTo({ left: cards[cur].offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
};
track.addEventListener('scroll', () => {
  const idx = cards.reduce((best, c, i) => Math.abs(c.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(cards[best].offsetLeft - track.offsetLeft - track.scrollLeft) ? i : best, 0);
  dots.forEach((d, i) => d.classList.toggle('on', i === idx)); cur = idx;
}, { passive: true });
dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
$('tPrev').addEventListener('click', () => goTo(cur - 1));
$('tNext').addEventListener('click', () => goTo(cur + 1));
dots[0]?.classList.add('on');
let auto;
const startAuto = () => { if (reduceMotion) return; clearInterval(auto); auto = setInterval(() => goTo(cur + 1), 5500); };
$('testi').addEventListener('mouseenter', () => clearInterval(auto));
$('testi').addEventListener('mouseleave', startAuto);
$('testi').addEventListener('touchstart', () => clearInterval(auto), { passive: true });
startAuto();

// Form testimoni (masuk antrean persetujuan admin)
let rating = 5;
$('rvStars').innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${n === 5}" aria-label="${n} bintang" data-n="${n}">★</button>`).join('');
const paintStars = () => $('rvStars').querySelectorAll('button').forEach(b => { b.classList.toggle('on', +b.dataset.n <= rating); b.setAttribute('aria-checked', +b.dataset.n === rating); });
$('rvStars').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { rating = +b.dataset.n; paintStars(); } });
paintStars();
$('reviewForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('rvName').value.trim(), text = $('rvText').value.trim();
  if (!name || !text) return;
  Store.upsert('reviews', { code: makeCode('RV', 'reviews'), name, text, rating, role: 'Pelanggan', status: 'pending', createdAt: new Date().toISOString() });
  e.target.reset(); rating = 5; paintStars();
  toast('Terima kasih! Testimoni kamu akan tampil setelah disetujui admin.');
});

// ----- Animasi -----
// Header menyusut saat scroll + parallax hero
const header = document.querySelector('.site-header');
const heroImg = document.querySelector('.hero-image');
let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    header.classList.toggle('scrolled', scrollY > 30);
    if (!reduceMotion && scrollY < 900) heroImg.style.transform = `translate3d(0, ${scrollY * .18}px, 0) scale(1.08)`;
    ticking = false;
  });
}, { passive: true });

// Muncul halus saat di-scroll (berurutan di dalam grid)
if (!reduceMotion && 'IntersectionObserver' in window) {
  const targets = [
    ['.section-head', 0], ['.steps li', 1], ['.fav-card', 1], ['.cat-strip a', 1], ['.pkg-tile', 1], ['.book-flow', 0],
    ['.book-flow li', 1], ['.gallery-item', 1], ['.testi-card', 0], ['.review-form', 0], ['.contact-card', 0], ['.center-action', 0]
  ];
  targets.forEach(([sel, stagger]) => document.querySelectorAll(sel).forEach((el, i) => {
    el.classList.add('reveal');
    if (stagger) el.style.setProperty('--d', Math.min(i, 5) * 90 + 'ms');
  }));
  const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}
