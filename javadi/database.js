// ============================================================
// JAVADI 2.0 – دیتابیس کامل
// بدون reviews (نظرات) و بدون posts (مقالات)
// با جداول جدید: chat_rooms, chat_messages, comparisons
// ============================================================
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'database.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ==================== ساخت جداول ====================
db.exec(`
  /* ---------- دسته‌بندی‌ها (پویا) ---------- */
  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    slug       TEXT    UNIQUE NOT NULL,
    icon       TEXT,
    image      TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ---------- برندها ---------- */
  CREATE TABLE IF NOT EXISTS brands (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    slug       TEXT    UNIQUE NOT NULL,
    logo       TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ---------- محصولات ---------- */
  CREATE TABLE IF NOT EXISTS products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    slug         TEXT    UNIQUE NOT NULL,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    brand_id     INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    brand_name   TEXT,
    short_desc   TEXT,
    long_desc    TEXT,
    specs        TEXT,
    price        REAL    NOT NULL,
    old_price    REAL,
    image        TEXT,
    stock        INTEGER DEFAULT 0,
    featured     INTEGER DEFAULT 0,
    is_new       INTEGER DEFAULT 0,
    is_deal      INTEGER DEFAULT 0,
    deal_ends_at DATETIME,
    is_active    INTEGER DEFAULT 1,
    views        INTEGER DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  /* ---------- کاربران ---------- */
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    phone         TEXT,
    address       TEXT,
    province      TEXT,
    city          TEXT,
    postal_code   TEXT,
    password_hash TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ---------- کوپن ---------- */
  CREATE TABLE IF NOT EXISTS coupons (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    code         TEXT UNIQUE NOT NULL,
    type         TEXT NOT NULL CHECK(type IN ('percent','fixed')),
    value        REAL NOT NULL,
    min_purchase REAL DEFAULT 0,
    max_uses     INTEGER DEFAULT 0,
    used_count   INTEGER DEFAULT 0,
    expires_at   DATETIME,
    active       INTEGER DEFAULT 1,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ---------- سفارشات ---------- */
  CREATE TABLE IF NOT EXISTS orders (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name         TEXT NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT NOT NULL,
    address           TEXT NOT NULL,
    province          TEXT,
    city              TEXT,
    postal_code       TEXT,
    subtotal          REAL NOT NULL DEFAULT 0,
    discount_amount   REAL DEFAULT 0,
    coupon_code       TEXT,
    total_amount      REAL NOT NULL,
    status            TEXT DEFAULT 'pending',
    payment_authority TEXT,
    payment_ref_id    TEXT,
    payment_method    TEXT DEFAULT 'zarinpal',
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at           DATETIME
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name  TEXT NOT NULL,
    product_image TEXT,
    unit_price    REAL NOT NULL,
    quantity      INTEGER NOT NULL,
    subtotal      REAL NOT NULL
  );

  /* ---------- علاقه‌مندی‌ها ---------- */
  CREATE TABLE IF NOT EXISTS wishlist (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
  );

  /* ---------- مقایسه محصولات ---------- */
  CREATE TABLE IF NOT EXISTS comparisons (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ---------- بنر اسلایدر ---------- */
  CREATE TABLE IF NOT EXISTS banners (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT,
    subtitle   TEXT,
    image      TEXT NOT NULL,
    link       TEXT,
    btn_text   TEXT DEFAULT 'مشاهده',
    sort_order INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ---------- تنظیمات سایت ---------- */
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  /* ---------- سوالات متداول ---------- */
  CREATE TABLE IF NOT EXISTS faqs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1
  );

  /* ---------- پیام‌های تماس ---------- */
  CREATE TABLE IF NOT EXISTS contact_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT,
    phone      TEXT,
    subject    TEXT,
    message    TEXT NOT NULL,
    is_read    INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ---------- چت زنده ---------- */
  CREATE TABLE IF NOT EXISTS chat_rooms (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    guest_name    TEXT,
    guest_email   TEXT,
    session_id    TEXT NOT NULL,
    status        TEXT DEFAULT 'open',
    unread_admin  INTEGER DEFAULT 0,
    unread_user   INTEGER DEFAULT 0,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id    INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender     TEXT NOT NULL CHECK(sender IN ('user','admin')),
    message    TEXT NOT NULL,
    is_read    INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ---------- ایندکس‌ها ---------- */
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
  CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
  CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
  CREATE INDEX IF NOT EXISTS idx_products_deal ON products(is_deal);
  CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
  CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
  CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
  CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_rooms_session ON chat_rooms(session_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
  CREATE INDEX IF NOT EXISTS idx_comparisons_session ON comparisons(session_id);
`);

// ==================== داده‌های اولیه ====================
function seedIfEmpty() {
  // ---------- تنظیمات پیش‌فرض ----------
  const defaultSettings = {
    site_name: 'JAVADI',
    site_tagline: 'لوازم خانگی لوکس',
    site_description: 'فروشگاه تخصصی لوازم خانگی و آشپزخانه با بهترین برندهای جهان',
    contact_phone: '۰۲۱-۸۸۷۷۶۶۵۵',
    contact_email: 'info@javadi.ir',
    contact_address: 'تهران، خیابان ولیعصر، برج لوکس، طبقه ۱۲',
    contact_hours: 'شنبه تا پنجشنبه ۹ صبح تا ۹ شب',
    social_instagram: 'https://instagram.com/javadi',
    social_telegram: 'https://t.me/javadi',
    social_whatsapp: 'https://wa.me/989120000000',
    social_youtube: '',
    footer_text: 'تمامی حقوق مادی و معنوی این سایت متعلق به فروشگاه JAVADI می‌باشد.',
    footer_about: 'ما با بیش از ۱۵ سال تجربه در زمینه فروش لوازم خانگی، افتخار خدمت‌رسانی به شما عزیزان را داریم.',
    about_title: 'درباره JAVADI',
    about_content: 'فروشگاه JAVADI از سال ۱۳۸۸ فعالیت خود را در زمینه عرضه لوازم خانگی و آشپزخانه آغاز کرده است. ما با همکاری مستقیم با برندهای معتبر جهانی، محصولات اصل و با کیفیت را با قیمت مناسب به مشتریان عزیز ارائه می‌دهیم.',
    hero_title: 'لوازم خانگی لوکس',
    hero_subtitle: 'تجربه‌ای متفاوت از خرید لوازم خانگی با کیفیت جهانی',
    default_theme: 'light',
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaultSettings)) insertSetting.run(k, v);

  // ---------- دسته‌بندی‌ها ----------
  const catCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (catCount === 0) {
    const insertCat = db.prepare(`
      INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)
    `);
    const cats = [
      ['ماشین لباسشویی', 'washing-machines', '🧺', 1],
      ['یخچال و فریزر', 'refrigerators', '❄️', 2],
      ['ماشین ظرفشویی', 'dishwashers', '🍽️', 3],
      ['فر و اجاق گاز', 'ovens-stoves', '🔥', 4],
      ['لوازم برقی کوچک', 'small-appliances', '☕', 5],
      ['جاروبرقی', 'vacuum-cleaners', '🧹', 6],
      ['مایکروویو', 'microwaves', '📻', 7],
      ['پنکه و کولر', 'cooling', '🌬️', 8],
    ];
    const tx = db.transaction(() => {
      for (const c of cats) insertCat.run(...c);
    });
    tx();
    console.log('✅ دسته‌بندی‌های پیش‌فرض اضافه شد.');
  }

  // ---------- برندها ----------
  const brandCount = db.prepare('SELECT COUNT(*) AS c FROM brands').get().c;
  if (brandCount === 0) {
    const insertBrand = db.prepare(`
      INSERT INTO brands (name, slug, sort_order) VALUES (?, ?, ?)
    `);
    const brands = [
      ['Bosch', 'bosch', 1],
      ['Samsung', 'samsung', 2],
      ['Siemens', 'siemens', 3],
      ['LG', 'lg', 4],
      ['Neff', 'neff', 5],
      ['iRobot', 'irobot', 6],
      ['De\'Longhi', 'delonghi', 7],
      ['Philips', 'philips', 8],
    ];
    const tx = db.transaction(() => {
      for (const b of brands) insertBrand.run(...b);
    });
    tx();
    console.log('✅ برندهای پیش‌فرض اضافه شد.');
  }

  // ---------- محصولات ----------
  const prodCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (prodCount === 0) {
    const catIds = {};
    for (const c of db.prepare('SELECT id, slug FROM categories').all()) catIds[c.slug] = c.id;
    const brandIds = {};
    for (const b of db.prepare('SELECT id, name FROM brands').all()) brandIds[b.name] = b.id;

    const insertProd = db.prepare(`
      INSERT INTO products (name, slug, category_id, brand_id, brand_name, short_desc, long_desc, specs, price, old_price, image, stock, featured, is_new, is_deal)
      VALUES (@name, @slug, @category_id, @brand_id, @brand_name, @short_desc, @long_desc, @specs, @price, @old_price, @image, @stock, @featured, @is_new, @is_deal)
    `);

    const dealEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const products = [
      {
        name: 'ماشین لباسشویی پرمیوم X1', slug: 'washing-machine-premium-x1',
        category_id: catIds['washing-machines'], brand_id: brandIds['Bosch'], brand_name: 'Bosch',
        short_desc: 'ظرفیت ۸ کیلوگرم، ۱۴۰۰ دور در دقیقه، A+++',
        long_desc: 'ماشین لباسشویی پرمیوم X1 با موتور اینورتر دیجیتال، ۱۵ برنامه شستشو و ۱۰ سال گارانتی موتور. طراحی مدرن و کم‌صدا برای هر خانه‌ای ایده‌آل است.',
        specs: JSON.stringify({ 'ظرفیت': '۸ کیلوگرم', 'سرعت چرخش': '۱۴۰۰ دور', 'رتبه انرژی': 'A+++', 'تعداد برنامه': '۱۵', 'گارانتی': '۱۰ سال موتور' }),
        price: 24500000, old_price: 29900000,
        image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800',
        stock: 15, featured: 1, is_new: 1, is_deal: 1,
      },
      {
        name: 'یخچال ساید بای ساید XXL', slug: 'side-by-side-refrigerator-xxl',
        category_id: catIds['refrigerators'], brand_id: brandIds['Samsung'], brand_name: 'Samsung',
        short_desc: 'ظرفیت ۵۰۰ لیتر، آبسردکن، بدون برفک',
        long_desc: 'یخچال ساید بای ساید XXL با ظرفیت ۵۰۰ لیتر، آبسردکن، تکنولوژی NoFrost و روشنایی LED. سیستم خنک‌کننده دوگانه Twin Cooling Plus.',
        specs: JSON.stringify({ 'ظرفیت': '۵۰۰ لیتر', 'نوع': 'ساید بای ساید', 'آبسردکن': 'دارد', 'بدون برفک': 'دارد', 'رتبه انرژی': 'A+' }),
        price: 45900000, old_price: 55900000,
        image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800',
        stock: 8, featured: 1, is_new: 0, is_deal: 1,
      },
      {
        name: 'ماشین ظرفشویی سایلنس پرو', slug: 'silence-pro-dishwasher',
        category_id: catIds['dishwashers'], brand_id: brandIds['Siemens'], brand_name: 'Siemens',
        short_desc: '۱۴ نفره، ۴۴ دسیبل، A++',
        long_desc: 'ماشین ظرفشویی سایلنس پرو با صدای کم ۴۴ دسیبل، ظرفیت ۱۴ نفره و ۶ برنامه شستشو.',
        specs: JSON.stringify({ 'ظرفیت': '۱۴ نفره', 'صدا': '۴۴ دسیبل', 'رتبه انرژی': 'A++', 'تعداد برنامه': '۶' }),
        price: 22900000, old_price: 27500000,
        image: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
        stock: 22, featured: 1, is_new: 0, is_deal: 0,
      },
      {
        name: 'اسپرسوساز حرفه‌ای دلولوکس', slug: 'deluxe-coffee-machine',
        category_id: catIds['small-appliances'], brand_id: brandIds["De'Longhi"], brand_name: "De'Longhi",
        short_desc: 'شیر بخار، فشار ۱۵ بار',
        long_desc: 'اسپرسوساز دلولوکس با شیر بخار، فشار ۱۵ بار و طراحی استیل ضدزنگ.',
        specs: JSON.stringify({ 'فشار': '۱۵ بار', 'شیر بخار': 'دارد', 'جنس': 'استیل', 'ظرفیت مخزن': '۲ لیتر' }),
        price: 17900000, old_price: 21900000,
        image: 'https://images.unsplash.com/photo-1585659722970-8d5e0c21e7f5?w=800',
        stock: 30, featured: 1, is_new: 1, is_deal: 1,
      },
      {
        name: 'ست فر و اجاق گاز توکار', slug: 'built-in-oven-cooktop-set',
        category_id: catIds['ovens-stoves'], brand_id: brandIds['Neff'], brand_name: 'Neff',
        short_desc: 'تمیزکاری پیرولیز، A+',
        long_desc: 'فر توکار با سیستم تمیزکاری خودکار پیرولیز، حجم ۷۱ لیتر، ۱۰ برنامه پخت.',
        specs: JSON.stringify({ 'حجم': '۷۱ لیتر', 'تمیزکاری': 'پیرولیز', 'رتبه': 'A+' }),
        price: 39900000, old_price: 48900000,
        image: 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=800',
        stock: 5, featured: 0, is_new: 0, is_deal: 1,
      },
      {
        name: 'جاروبرقی رباتیک اسمارت‌کلین', slug: 'smartclean-robot-vacuum',
        category_id: catIds['vacuum-cleaners'], brand_id: brandIds['iRobot'], brand_name: 'iRobot',
        short_desc: 'وای‌فای، کنترل اپلیکیشن، ۹۰ دقیقه',
        long_desc: 'جاروبرقی رباتیک با وای‌فای، کنترل از اپلیکیشن، ۹۰ دقیقه کارکرد و تشخیص هوشمند موانع.',
        specs: JSON.stringify({ 'کارکرد': '۹۰ دقیقه', 'وای‌فای': 'دارد', 'فیلتر': 'HEPA' }),
        price: 14900000, old_price: 18900000,
        image: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=800',
        stock: 12, featured: 0, is_new: 1, is_deal: 1,
      },
      {
        name: 'مایکروویو ۳۰ لیتری دیجیتال', slug: 'microwave-30l-digital',
        category_id: catIds['microwaves'], brand_id: brandIds['LG'], brand_name: 'LG',
        short_desc: 'ظرفیت ۳۰ لیتر، گریل',
        long_desc: 'مایکروویو ۳۰ لیتری با گریل، ۱۰ برنامه پخت خودکار و نمایشگر دیجیتال.',
        specs: JSON.stringify({ 'ظرفیت': '۳۰ لیتر', 'گریل': 'دارد', 'برنامه': '۱۰', 'توان': '۹۰۰ وات' }),
        price: 8900000, old_price: 11500000,
        image: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
        stock: 18, featured: 1, is_new: 1, is_deal: 0,
      },
      {
        name: 'پنکه برجی هوشمند', slug: 'smart-tower-fan',
        category_id: catIds['cooling'], brand_id: null, brand_name: 'پارس‌خزر',
        short_desc: 'ریموت، ۳ سرعته، چرخش ۹۰ درجه',
        long_desc: 'پنکه برجی هوشمند با ریموت کنترل، ۳ سرعت، چرخش ۹۰ درجه و تایمر خودکار.',
        specs: JSON.stringify({ 'ریموت': 'دارد', 'سرعت': '۳', 'چرخش': '۹۰ درجه', 'تایمر': 'دارد' }),
        price: 4500000, old_price: 5900000,
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
        stock: 25, featured: 0, is_new: 1, is_deal: 1,
      },
    ];

    // اضافه کردن deal_ends_at به محصولات deal
    const insertProdWithDeal = db.prepare(`
      INSERT INTO products (name, slug, category_id, brand_id, brand_name, short_desc, long_desc, specs, price, old_price, image, stock, featured, is_new, is_deal, deal_ends_at)
      VALUES (@name, @slug, @category_id, @brand_id, @brand_name, @short_desc, @long_desc, @specs, @price, @old_price, @image, @stock, @featured, @is_new, @is_deal, @deal_ends_at)
    `);

    const tx = db.transaction(() => {
      for (const p of products) {
        if (p.is_deal) {
          insertProdWithDeal.run({ ...p, deal_ends_at: dealEnd });
        } else {
          insertProd.run({ ...p });
        }
      }
    });
    tx();
    console.log(`✅ ${products.length} محصول نمونه اضافه شد.`);
  }

  // ---------- بنرها ----------
  const bannerCount = db.prepare('SELECT COUNT(*) AS c FROM banners').get().c;
  if (bannerCount === 0) {
    const insertBanner = db.prepare(`
      INSERT INTO banners (title, subtitle, image, link, btn_text, sort_order) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const banners = [
      ['لوازم خانگی لوکس', 'تجربه‌ای متفاوت از خرید با بهترین برندهای جهان', 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=1920', '/products', 'کشف کنید', 1],
      ['تخفیف ویژه فصل', 'تا ۴۰٪ تخفیف روی محصولات منتخب', 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=1920', '/deal', 'مشاهده شگفت‌انگیزها', 2],
      ['ارسال رایگان', 'برای خریدهای بالای ۵ میلیون تومان در سراسر کشور', 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=1920', '/products', 'شروع خرید', 3],
    ];
    const tx = db.transaction(() => {
      for (const b of banners) insertBanner.run(...b);
    });
    tx();
    console.log('✅ بنرهای پیش‌فرض اضافه شد.');
  }

  // ---------- کاربر نمونه ----------
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('demo1234', 10);
    db.prepare(`INSERT INTO users (full_name, email, phone, address, province, city, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('کاربر نمونه', 'demo@example.com', '09120000000', 'خیابان نمونه، پلاک ۱۲۳', 'تهران', 'تهران', hash);
    console.log('✅ کاربر نمونه: demo@example.com / demo1234');
  }

  // ---------- کوپن‌ها ----------
  const couponCount = db.prepare('SELECT COUNT(*) AS c FROM coupons').get().c;
  if (couponCount === 0) {
    db.prepare(`INSERT INTO coupons (code, type, value, min_purchase, max_uses) VALUES (?, ?, ?, ?, ?)`)
      .run('WELCOME10', 'percent', 10, 1000000, 100);
    db.prepare(`INSERT INTO coupons (code, type, value, min_purchase, max_uses) VALUES (?, ?, ?, ?, ?)`)
      .run('SAVE500', 'fixed', 500000, 5000000, 50);
    db.prepare(`INSERT INTO coupons (code, type, value, min_purchase, max_uses) VALUES (?, ?, ?, ?, ?)`)
      .run('JAVADI20', 'percent', 20, 3000000, 30);
    console.log('✅ کوپن‌ها: WELCOME10، SAVE500، JAVADI20');
  }

  // ---------- FAQ ----------
  const faqCount = db.prepare('SELECT COUNT(*) AS c FROM faqs').get().c;
  if (faqCount === 0) {
    const insertFaq = db.prepare('INSERT INTO faqs (question, answer, sort_order) VALUES (?, ?, ?)');
    insertFaq.run('چطور می‌توانم سفارش خود را پیگیری کنم؟', 'پس از ثبت سفارش، شماره پیگیری برای شما ارسال می‌شود. می‌توانید از طریق بخش «سفارش‌های من» وضعیت سفارش را ببینید.', 1);
    insertFaq.run('ارسال چقدر طول می‌کشد؟', 'ارسال در تهران ۱ تا ۲ روز کاری و در سایر شهرها ۲ تا ۴ روز کاری زمان می‌برد.', 2);
    insertFaq.run('آیا امکان مرجوعی وجود دارد؟', 'بله، تا ۷ روز پس از دریافت کالا در صورت سالم بودن بسته‌بندی، امکان مرجوعی وجود دارد.', 3);
    insertFaq.run('روش‌های پرداخت چیست؟', 'پرداخت آنلاین از طریق درگاه زرین‌پال و پرداخت در محل (برای تهران) امکان‌پذیر است.', 4);
    insertFaq.run('آیا محصولات گارانتی دارند؟', 'بله، تمام محصولات دارای گارانتی معتبر شرکتی هستند.', 5);
    insertFaq.run('هزینه ارسال چقدر است؟', 'برای خریدهای بالای ۵ میلیون تومان ارسال رایگان است. برای سایر سفارشات هزینه ارسال بر اساس منطقه محاسبه می‌شود.', 6);
    console.log('✅ سوالات متداول اضافه شد.');
  }
}

seedIfEmpty();

module.exports = db;