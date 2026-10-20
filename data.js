// LENTERAS — konfigurasi & data menu
// Menu dan harga diambil dari PDF menu resmi Lenteras (QR menu). Ubah di sini bila ada perubahan harga.

const CONFIG = {
  brand: 'Lenteras',
  tagline: 'Coffee & Intimate Wedding',
  address: 'Jl. Kemang Boulevard, Sukaresmi, Cikarang Selatan',
  instagram: 'lenterascoffee_intimatewedding',
  // Nomor WhatsApp kasir/admin, format internasional tanpa +, spasi, atau strip. Contoh: 6281234567890
  whatsapp: '',
  // Gambar QRIS resmi Lenteras (simpan di folder assets/). Jika file belum ada, tampil placeholder.
  qrisImage: 'assets/qris.png',
  qrisName: 'Lenteras Coffee & Intimate Wedding',
  // ---- Login staf: SATU PIN untuk admin & kasir ----
  // Mode server: satu akun Supabase Auth (peran admin); PIN = password akun itu. Isi email akunnya di sini.
  // (Gunakan email yang kamu kendalikan. Email tampil di kode situs, PIN tidak.)
  staffEmail: '',
  // Mode demo SAJA (tanpa server): PIN dicek di browser. WAJIB diganti sebelum dipakai sungguhan.
  demoPin: 'admin123',
  adminIdleMinutes: 240,      // keluar otomatis bila tidak ada aktivitas
  // ---- Sistem pesanan online (opsional). Kosong = mode demo (data hanya di browser). Lihat README / folder supabase/ ----
  supabaseUrl: '',      // contoh: https://abcdxyz.supabase.co
  supabaseKey: '',      // kunci "anon public" dari Project Settings > API
  vapidPublicKey: '',   // kunci publik Web Push (agar notifikasi tetap datang saat halaman/browser ditutup)
  tableCount: 20,
  // Jam acara yang bisa dipilih saat booking venue
  timeSlots: ['09.00 – 13.00', '13.00 – 17.00', '17.00 – 21.00', 'Sepanjang hari (konsultasi)']
};

const CATEGORIES = [
  { id: 'signature', label: 'Signature' },
  { id: 'nocoffee', label: 'Non Coffee' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'mocktail', label: 'Mocktail' },
  { id: 'refresh', label: 'Refreshment' },
  { id: 'smoothie', label: 'Smoothies' },
  { id: 'rice', label: 'Rice Bowl' },
  { id: 'main', label: 'Main Course' },
  { id: 'pasta', label: 'Spaghetti' },
  { id: 'soup', label: 'Soup & Soto' },
  { id: 'snack', label: 'Snack' },
  { id: 'pastry', label: 'Pastry' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'extra', label: 'Additional' }
];

// Kelompok untuk filter cepat: minuman / makanan
const GROUPS = {
  drink: ['signature', 'nocoffee', 'coffee', 'mocktail', 'refresh', 'smoothie'],
  food: ['rice', 'main', 'pasta', 'soup', 'snack', 'pastry', 'dessert', 'extra']
};

// [kategori, nama, harga, deskripsi]
const RAW_MENU = [
  ['signature', 'Oregano', 36000], ['signature', 'Aren Latte', 36000], ['signature', 'Matcha Latte', 36000],
  ['signature', 'Pandan Latte', 37000], ['signature', 'Creamy Dream', 38000], ['signature', 'Caramel Macchiato', 41000],
  ['signature', 'Mochaccino', 43000], ['signature', 'Lotus Latte', 46000],

  ['nocoffee', 'Thai Tea', 32000], ['nocoffee', 'Dark Choco', 32000], ['nocoffee', 'Pandan Paradise', 37000],
  ['nocoffee', 'Strawberry Cream Cheese', 38000], ['nocoffee', 'Choco Cream Cheese', 38000], ['nocoffee', 'Milo Cream Cheese', 38000],
  ['nocoffee', 'Choco Mint', 42000], ['nocoffee', 'Matcha', 42000], ['nocoffee', 'Red Velvet', 42000],
  ['nocoffee', 'Chocolate Float', 45000], ['nocoffee', 'Matcha Float', 45000], ['nocoffee', 'Red Velvet Float', 45000], ['nocoffee', 'Oreo Float', 45000],

  ['coffee', 'V60 / Japanese', 31000], ['coffee', 'Berrycano', 35000], ['coffee', 'Peach Americano', 35000],
  ['coffee', 'Orange Americano', 35000], ['coffee', 'Split Shot', 35000], ['coffee', 'Cappucino', 35000],
  ['coffee', 'Kopi Sanger', 28000], ['coffee', 'Dirty Latte', 35000], ['coffee', 'Magic!', 35000],
  ['coffee', 'Café Latte', 35000], ['coffee', 'Vietnam Drip', 28000], ['coffee', 'Americano', 21000],

  ['mocktail', 'Glaciar Kiss', 40000, 'Sirup blue citrus, simple sirup, lime, soda'],
  ['mocktail', 'Tropical Sunset', 40000, 'Sirup mangga, sirup grenadine, lime, soda'],
  ['mocktail', 'Sunny Sip', 37000, 'Sirup mangga, simple sirup, lime, soda'],
  ['mocktail', 'Minty Noon', 34000, 'Sirup kiwi, simple sirup, lime, soda'],

  ['refresh', 'Peach Tea', 30000], ['refresh', 'Mango Tea', 30000], ['refresh', 'Strawberry Tea', 31000], ['refresh', 'Lychee Tea', 35000],
  ['refresh', 'Peach Yakult', 28000], ['refresh', 'Lychee Yakult', 34000], ['refresh', 'Mango Yakult', 35000],
  ['refresh', 'Chamomile Tea', 24000, 'Artisan tea'], ['refresh', 'Peppermint Tea', 24000, 'Artisan tea'],
  ['refresh', 'Lavender Tea', 24000, 'Artisan tea'], ['refresh', 'Earl Grey Tea', 24000, 'Artisan tea'],

  ['smoothie', 'Mix Berries Smoothies', 34000], ['smoothie', 'Avocado Smoothies', 36000], ['smoothie', 'Strawberry Smoothies', 27000],
  ['smoothie', 'Kiwi Smoothies', 34000], ['smoothie', 'Nanas Smoothies', 27000], ['smoothie', 'Manggo Smoothies', 34000],
  ['smoothie', 'Avocado Coffee Float', 45000], ['smoothie', 'Velvet Avosmash', 45000],

  ['rice', 'Ayam Crispy Sambal Matah', 40000], ['rice', 'Ayam Crispy Sambal Geprek', 40000], ['rice', 'Ayam Crispy Sauce Mentai', 40000],
  ['rice', 'Ayam Crispy Sauce Teriyaki', 40000], ['rice', 'Chicken Katsu', 40000], ['rice', 'Chicken Karage', 40000],
  ['rice', 'Beef Sauce Teriyaki', 45000], ['rice', 'Beef Chilli Padi', 45000], ['rice', 'Nasi Tuna Pedas', 45000],

  ['main', 'Nasi Goreng', 45000, 'Kerupuk, telur orek, irisan sosis, acar sayur'],
  ['main', 'Sate Taichan', 45000, 'Nasi putih, sate ayam taichan, kerupuk, sambal'],
  ['main', 'Nasi Goreng Lenteras', 55000, 'Kerupuk, telur orek, ayam katsu, acar sayur'],
  ['main', 'Nasi Goreng Sei Sapi Lenteras', 55000, 'Sei sapi, telur orek, kerupuk, acar sayur'],
  ['main', 'Bebek Goreng Lenteras', 60000, 'Kerupuk, bebek goreng, tempe, sambal ijo, lalap'],
  ['main', 'Sapi Lada Hitam', 55000, 'Nasi putih, sapi lada hitam, capcai sayur'],
  ['main', 'Ayam Goreng Asam Manis', 52000, 'Nasi putih, ayam goreng asam manis, capcai sayur'],
  ['main', 'Ayam Goreng Saus Mentega', 52000, 'Nasi putih, ayam goreng saus mentega, capcai sayur'],

  ['pasta', 'Spaghetti Tuna', 45000], ['pasta', 'Spaghetti Ayam Jamur', 45000], ['pasta', 'Spaghetti Carbonara', 45000],

  ['soup', 'Sop Iga', 65000, 'Nasi putih, sop iga, kerupuk, sambal'],
  ['soup', 'Rawon', 65000, 'Nasi putih, rawon, telur asin, kecambah, kerupuk, sambal'],
  ['soup', 'Soto Daging Betawi', 65000, 'Nasi putih, daging, kentang, kerupuk, sambal'],

  ['snack', 'Mix Platters', 45000, 'Sosis, otak-otak, french fries'],
  ['snack', 'Wing It Combo Platter', 55000, 'Chicken wing, nugget, french fries'],
  ['snack', 'Tahu Walik', 25000], ['snack', 'Tape Goreng', 25000], ['snack', 'Pisang Bakar Coklat Keju', 25000],
  ['snack', 'Pisang Goreng Coklat Keju', 27000], ['snack', 'Lumpia Ayam', 40000], ['snack', 'Tahu Cabe Garam', 30000],
  ['snack', 'Baso Tahu', 30000], ['snack', 'Pancake', 30000], ['snack', 'Piscok', 32000], ['snack', 'Singkong Keju', 35000],
  ['snack', 'Risoles', 36000], ['snack', 'Dimsum', 38000], ['snack', 'Roti Lapis Coklat Keju', 30000],
  ['snack', 'Roti Lapis Ayam / Daging Asap / Tuna Mayo', 35000], ['snack', 'Nachos', 35000], ['snack', 'Shokupan Choco', 30000],

  ['pastry', 'Chicken Curry Puff', 38000], ['pastry', 'Chicken Lemper', 38000], ['pastry', 'Beef Potato', 38000],
  ['pastry', 'Tuna Puff', 38000], ['pastry', 'Cromboloni Coklat', 40000], ['pastry', 'Cromboloni Vanila', 40000],
  ['pastry', 'Cromboloni Strawberry', 40000], ['pastry', 'Danish Vanila', 40000], ['pastry', 'Danish Strawberry', 40000],
  ['pastry', 'Blueberry Cheese Danish', 40000], ['pastry', 'Double Choco Pain Suisse', 40000], ['pastry', 'Beef & Cheese', 40000],
  ['pastry', 'Chocolatine', 40000], ['pastry', 'Butter Croissant', 38000], ['pastry', 'Almond Croissants', 40000],

  ['dessert', 'Ice Cream (2 scoop)', 15000], ['dessert', 'Ice Cream (3 scoop)', 20000], ['dessert', 'Ice Cream (4 scoop)', 25000],

  ['extra', 'Nasi Putih', 8000], ['extra', 'Telur', 8000], ['extra', 'Chilli Oil', 10000], ['extra', 'Mineral Water', 10000],
  ['extra', 'Extra Shot', 10000], ['extra', 'Sambal Matah', 8000], ['extra', 'Sambal Geprek', 8000], ['extra', 'Sambal Ijo', 8000]
];

// Foto menu (dipotong dari PDF menu Lenteras). Item tanpa foto memakai tile bawaan.
const MENU_IMAGES = {
 "Oregano": "assets/menu/oregano.jpg",
 "Lotus Latte": "assets/menu/lotus.jpg",
 "Matcha Latte": "assets/menu/matcha-latte.jpg",
 "Milo Cream Cheese": "assets/menu/milo-cc.jpg",
 "Choco Cream Cheese": "assets/menu/choco-cc.jpg",
 "Strawberry Cream Cheese": "assets/menu/strawberry-cc.jpg",
 "V60 / Japanese": "assets/menu/v60.jpg",
 "Berrycano": "assets/menu/berrycano.jpg",
 "Peach Americano": "assets/menu/peach-americano.jpg",
 "Orange Americano": "assets/menu/orange-americano.jpg",
 "Split Shot": "assets/menu/split-shot.jpg",
 "Cappucino": "assets/menu/cappucino.jpg",
 "Café Latte": "assets/menu/latte.jpg",
 "Glaciar Kiss": "assets/menu/glaciar.jpg",
 "Tropical Sunset": "assets/menu/tropical.jpg",
 "Sunny Sip": "assets/menu/sunny.jpg",
 "Minty Noon": "assets/menu/minty.jpg",
 "Lychee Tea": "assets/menu/lychee-tea.jpg",
 "Peach Yakult": "assets/menu/peach-yakult.jpg",
 "Strawberry Tea": "assets/menu/strawberry-tea.jpg",
 "Lychee Yakult": "assets/menu/lychee-yakult.jpg",
 "Mango Tea": "assets/menu/mango-tea.jpg",
 "Mango Yakult": "assets/menu/mango-yakult.jpg",
 "Mix Berries Smoothies": "assets/menu/mixberries.jpg",
 "Avocado Smoothies": "assets/menu/avocado.jpg",
 "Strawberry Smoothies": "assets/menu/strawberry-sm.jpg",
 "Kiwi Smoothies": "assets/menu/kiwi.jpg",
 "Nanas Smoothies": "assets/menu/nanas.jpg",
 "Manggo Smoothies": "assets/menu/manggo.jpg",
 "Avocado Coffee Float": "assets/menu/avo-coffee-float.jpg",
 "Velvet Avosmash": "assets/menu/velvet-avosmash.jpg",
 "Ayam Crispy Sambal Matah": "assets/menu/rice-1.jpg",
 "Ayam Crispy Sambal Geprek": "assets/menu/rice-2.jpg",
 "Chicken Katsu": "assets/menu/rice-5.jpg",
 "Beef Sauce Teriyaki": "assets/menu/rice-7.jpg",
 "Beef Chilli Padi": "assets/menu/rice-8.jpg",
 "Nasi Tuna Pedas": "assets/menu/rice-9.jpg",
 "Nasi Goreng": "assets/menu/nasgor.jpg",
 "Nasi Goreng Lenteras": "assets/menu/nasgor.jpg",
 "Nasi Goreng Sei Sapi Lenteras": "assets/menu/nasgor.jpg",
 "Sate Taichan": "assets/menu/taichan.jpg",
 "Sapi Lada Hitam": "assets/menu/sapi-lada.jpg",
 "Ayam Goreng Asam Manis": "assets/menu/asam-manis.jpg",
 "Ayam Goreng Saus Mentega": "assets/menu/mentega.jpg",
 "Spaghetti Tuna": "assets/menu/spaghetti.jpg",
 "Spaghetti Ayam Jamur": "assets/menu/spaghetti.jpg",
 "Spaghetti Carbonara": "assets/menu/spaghetti.jpg",
 "Sop Iga": "assets/menu/sop-iga.jpg",
 "Rawon": "assets/menu/rawon.jpg",
 "Soto Daging Betawi": "assets/menu/soto.jpg",
 "Ice Cream (2 scoop)": "assets/menu/icecream.jpg",
 "Ice Cream (3 scoop)": "assets/menu/icecream.jpg",
 "Ice Cream (4 scoop)": "assets/menu/icecream.jpg",
 "Shokupan Choco": "assets/menu/shokupan.jpg",
 "Mix Platters": "assets/menu/mix-platter.jpg",
 "Wing It Combo Platter": "assets/menu/wing-combo.jpg",
 "Nachos": "assets/menu/nachos.jpg",
 "Chicken Curry Puff": "assets/menu/pastry-0.jpg",
 "Chicken Lemper": "assets/menu/pastry-1.jpg",
 "Beef Potato": "assets/menu/pastry-2.jpg",
 "Tuna Puff": "assets/menu/pastry-3.jpg",
 "Cromboloni Coklat": "assets/menu/pastry-4.jpg",
 "Cromboloni Vanila": "assets/menu/pastry-5.jpg",
 "Cromboloni Strawberry": "assets/menu/pastry-6.jpg",
 "Danish Vanila": "assets/menu/pastry-7.jpg",
 "Danish Strawberry": "assets/menu/pastry-8.jpg",
 "Blueberry Cheese Danish": "assets/menu/pastry-9.jpg",
 "Double Choco Pain Suisse": "assets/menu/pastry-10.jpg",
 "Beef & Cheese": "assets/menu/pastry-11.jpg",
 "Chocolatine": "assets/menu/pastry-12.jpg",
 "Butter Croissant": "assets/menu/pastry-13.jpg",
 "Almond Croissants": "assets/menu/pastry-14.jpg"
};

const MENU = RAW_MENU.map(([cat, name, price, desc], i) => ({ id: 'm' + (i + 1), cat, name, price, desc: desc || '', img: MENU_IMAGES[name] || '' }));

// Menu pilihan untuk bagian "House Favourites" di landing page
const FAVOURITES = ['Lotus Latte', 'Strawberry Cream Cheese', 'Nasi Goreng Lenteras', 'Avocado Coffee Float', 'Sate Taichan', 'Butter Croissant'];

const VENUE_PACKAGES = [
  {
    id: 'intimate-wedding', name: 'Intimate Wedding', tag: 'Akad & resepsi kecil',
    desc: 'Pernikahan hangat bersama keluarga dan sahabat terdekat di suasana yang personal.',
    points: ['Konsep & dekorasi dikonsultasikan', 'Menu makan & minum bisa dipilih', 'Jadwal dan kapasitas dikonfirmasi admin']
  },
  {
    id: 'private-event', name: 'Acara Privat', tag: 'Lamaran, tunangan, arisan',
    desc: 'Lamaran, tunangan, syukuran, atau pertemuan keluarga dengan area yang lebih tenang.',
    points: ['Cocok untuk keluarga & komunitas kecil', 'Paket menu fleksibel', 'Diskusi kebutuhan bersama tim']
  },
  {
    id: 'celebration', name: 'Special Celebration', tag: 'Ulang tahun & perayaan',
    desc: 'Ulang tahun, bridal shower, reuni, atau perayaan kecil yang ingin dibuat berkesan.',
    points: ['Dekorasi sederhana sesuai tema', 'Pre-order menu untuk seluruh tamu', 'Konfirmasi cepat via admin']
  }
];


// Galeri "Suasana Lenteras": klik untuk melihat foto detail. Foto masih referensi (Unsplash); ganti dengan foto asli Lenteras.
const UNS = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=80`;
const GALLERY = [
  { id: 'wedding', tall: true, title: 'Intimate Wedding', tag: 'Acara & dekorasi', cta: { label: 'Ajukan Booking Venue', href: 'booking.html?paket=intimate-wedding' },
    desc: 'Detail suasana untuk pernikahan intimate: lorong akad, tata meja, bunga, dan momen-momen kecil yang membuat hari istimewamu terasa personal. Konsep dan dekorasi dikonsultasikan bersama tim Lenteras.',
    photos: [
      { src: UNS('1469371670807-013ccf25f16a'), cap: 'Lorong & area akad' },
      { src: UNS('1519225421980-715cb0215aed'), cap: 'Tata meja panjang untuk keluarga' },
      { src: UNS('1511795409834-ef04bbd61622'), cap: 'Detail meja & rangkaian bunga' },
      { src: UNS('1465495976277-4387d4b0b4c6'), cap: 'Cincin & buket pengantin' },
      { src: UNS('1519741497674-611481863552'), cap: 'Buket & suasana hangat' },
      { src: UNS('1507504031003-b417219a0fde'), cap: 'Detail dekorasi: Mr & Mrs' },
      { src: UNS('1519167758481-83f550bb49b3'), cap: 'Ruang resepsi' }
    ] },
  { id: 'detail', title: 'Detail kecil', tag: 'Interior', cta: { label: 'Pesan Menu', href: 'order.html' },
    desc: 'Sudut-sudut kecil yang bikin betah berlama-lama.',
    photos: [{ src: UNS('1493857671505-72967e2e2760'), cap: 'Sudut interior' }, { src: UNS('1445116572660-236099ec97a0'), cap: 'Ruang duduk yang hangat' }] },
  { id: 'coffee', title: 'Dibuat dengan hati', tag: 'Kopi', cta: { label: 'Pesan Menu', href: 'order.html' },
    desc: 'Setiap cangkir disiapkan dengan teliti oleh barista kami.',
    photos: [{ src: UNS('1495474472287-4d71bcdd2085'), cap: 'Latte art' }, { src: UNS('1461023058943-07fcbe16d735'), cap: 'Iced latte' }, { src: UNS('1517701604599-bb29b565090c'), cap: 'Cappuccino hangat' }] },
  { id: 'company', title: 'Good company', tag: 'Suasana', cta: { label: 'Pesan Menu', href: 'order.html' },
    desc: 'Tempat bertemu, bercerita, dan menghabiskan waktu bersama orang terdekat.',
    photos: [{ src: UNS('1501339847302-ac426a4a7cbb'), cap: 'Suasana kafe' }, { src: UNS('1442512595331-e89e73853f31'), cap: 'Di balik meja bar' }] },
  { id: 'oven', title: 'Fresh from the oven', tag: 'Pastry', cta: { label: 'Pesan Menu', href: 'order.html' },
    desc: 'Pastry dan croissant hangat setiap hari.',
    photos: [{ src: UNS('1555507036-ab1f4038808a'), cap: 'Croissant segar' }, { src: UNS('1525351484163-7529414344d8'), cap: 'Brunch toast' }] }
];

// Testimoni CONTOH (tampil sampai ada ulasan asli yang disetujui admin). Ganti/hapus dengan ulasan nyata pelanggan.
const SAMPLE_TESTIMONIALS = [
  { name: 'Rina A.', role: 'Pelanggan', rating: 5, text: 'Tempatnya tenang dan hangat, cocok buat ngopi sambil ngobrol lama. Pesan dari meja lewat QR juga praktis.' },
  { name: 'Dimas & Laras', role: 'Acara privat', rating: 5, text: 'Timnya ramah dan membantu dari awal konsultasi. Acara keluarga kecil kami jadi terasa personal.' },
  { name: 'Putri S.', role: 'Pelanggan', rating: 5, text: 'Menunya banyak pilihan, dari kopi sampai nasi goreng. Pastry-nya favorit aku.' }
];

// ===== Util bersama =====
const rupiah = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; };
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = id => MENU.find(m => m.id === id);
