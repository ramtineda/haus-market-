// ============================================================
// JAVADI 2.0 – سرور کامل
// ============================================================
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const db = require('./database');
const zarinpal = require('./zarinpal');
const { sendMail, orderConfirmationTemplate, adminNotificationTemplate } = require('./email');
const seo = require('./seo');
const notifications = require('./notifications');
const { streamInvoice } = require('./invoice');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'javadi2025';
const ADMIN_PATH = process.env.ADMIN_PATH || 'javadi-control';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7 },
}));

// ==================== UPLOAD ====================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(12).toString('hex') + ext);
  },
});
const upload = multer({
  storage, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('فقط JPG, PNG, WEBP, GIF مجاز است'), ok);
  },
});

// ==================== SEO ====================
app.get('/robots.txt', (req, res) => res.type('text/plain').send(seo.generateRobots()));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(seo.generateSitemap()));

// ==================== STATIC ====================
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ==================== HELPERS ====================
function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.status(401).json({ error: 'ورود مدیر لازم است' });
}
function requireUser(req, res, next) {
  if (req.session?.userId) return next();
  res.status(401).json({ error: 'لطفاً وارد شوید' });
}
function getSessionId(req) {
  if (!req.session.sid) {
    req.session.sid = crypto.randomBytes(16).toString('hex');
  }
  return req.session.sid;
}

// ==================== PUBLIC: SETTINGS ====================
app.get('/api/settings/public', (req, res) => {
  const keys = [
    'site_name', 'site_tagline', 'site_description',
    'contact_phone', 'contact_email', 'contact_address', 'contact_hours',
    'social_instagram', 'social_telegram', 'social_whatsapp', 'social_youtube',
    'footer_text', 'footer_about',
    'about_title', 'about_content',
    'hero_title', 'hero_subtitle',
    'default_theme',
  ];
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`).all(...keys);
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

// ==================== PUBLIC: CATEGORIES ====================
app.get('/api/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, id').all();
  for (const c of cats) {
    c.product_count = db.prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ? AND is_active = 1').get(c.id).c;
  }
  res.json(cats);
});

app.get('/api/categories/:slug', (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!cat) return res.status(404).json({ error: 'دسته‌بندی یافت نشد' });
  res.json(cat);
});

// ==================== PUBLIC: BRANDS ====================
app.get('/api/brands', (req, res) => {
  const brands = db.prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order, id').all();
  for (const b of brands) {
    b.product_count = db.prepare('SELECT COUNT(*) AS c FROM products WHERE brand_id = ? AND is_active = 1').get(b.id).c;
  }
  res.json(brands);
});

app.get('/api/brands/:slug', (req, res) => {
  const b = db.prepare('SELECT * FROM brands WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!b) return res.status(404).json({ error: 'برند یافت نشد' });
  res.json(b);
});

// ==================== PUBLIC: PRODUCTS ====================
app.get('/api/products', (req, res) => {
  const { search, category, brand, featured, deal, sort, limit = 100 } = req.query;
  let sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1
  `;
  const params = [];

  if (search) {
    sql += ' AND (p.name LIKE ? OR p.short_desc LIKE ? OR p.brand_name LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category) { sql += ' AND c.slug = ?'; params.push(category); }
  if (brand) { sql += ' AND p.brand_name = ?'; params.push(brand); }
  if (featured === 'true') sql += ' AND p.featured = 1';
  if (deal === 'true') sql += ' AND p.is_deal = 1';

  if (sort === 'price-asc') sql += ' ORDER BY p.price ASC';
  else if (sort === 'price-desc') sql += ' ORDER BY p.price DESC';
  else if (sort === 'newest') sql += ' ORDER BY p.created_at DESC';
  else if (sort === 'popular') sql += ' ORDER BY p.views DESC';
  else sql += ' ORDER BY p.created_at DESC';

  sql += ' LIMIT ?';
  params.push(parseInt(limit));

  const products = db.prepare(sql).all(...params);
  res.json(products);
});

app.get('/api/products/:idOrSlug', (req, res) => {
  const { idOrSlug } = req.params;
  const product = /^\d+$/.test(idOrSlug)
    ? db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(idOrSlug)
    : db.prepare('SELECT * FROM products WHERE slug = ? AND is_active = 1').get(idOrSlug);

  if (!product) return res.status(404).json({ error: 'محصول یافت نشد' });

  db.prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(product.id);

  if (product.category_id) {
    const cat = db.prepare('SELECT name, slug FROM categories WHERE id = ?').get(product.category_id);
    product.category_name = cat?.name;
    product.category_slug = cat?.slug;
  }

  product.images = db.prepare('SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(product.id).map(i => i.url);
  product.jsonLd = seo.productJsonLd(product);

  res.json(product);
});

app.get('/api/products/:id/related', (req, res) => {
  const product = db.prepare('SELECT category_id FROM products WHERE id = ?').get(req.params.id);
  if (!product || !product.category_id) return res.json([]);

  const related = db.prepare(`
    SELECT p.* FROM products p
    WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1
    ORDER BY RANDOM() LIMIT 8
  `).all(product.category_id, req.params.id);

  res.json(related);
});

// ==================== PUBLIC: BANNERS ====================
app.get('/api/banners', (req, res) => {
  res.json(db.prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order, id').all());
});

// ==================== PUBLIC: FAQS ====================
app.get('/api/faqs', (req, res) => {
  res.json(db.prepare('SELECT * FROM faqs WHERE is_active = 1 ORDER BY sort_order, id').all());
});

// ==================== PUBLIC: SEARCH LIVE ====================
app.get('/api/search/live', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ products: [], categories: [] });

  const like = `%${q}%`;
  const products = db.prepare(`
    SELECT id, name, slug, price, old_price, image, brand_name
    FROM products
    WHERE is_active = 1 AND (name LIKE ? OR short_desc LIKE ? OR brand_name LIKE ?)
    ORDER BY views DESC LIMIT 6
  `).all(like, like, like);

  const categories = db.prepare(`
    SELECT id, name, slug, icon FROM categories
    WHERE is_active = 1 AND name LIKE ?
    LIMIT 3
  `).all(like);

  res.json({ products, categories });
});

// ==================== COMPARE ====================
app.get('/api/compare', (req, res) => {
  const sessionId = getSessionId(req);
  const rows = db.prepare(`
    SELECT c.id AS compare_id, p.*
    FROM comparisons c
    JOIN products p ON p.id = c.product_id
    WHERE c.session_id = ? AND p.is_active = 1
    ORDER BY c.created_at DESC
    LIMIT 4
  `).all(sessionId);
  res.json(rows);
});

app.post('/api/compare/toggle', (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'شناسه محصول الزامی است' });

  const sessionId = getSessionId(req);
  const existing = db.prepare('SELECT id FROM comparisons WHERE session_id = ? AND product_id = ?').get(sessionId, product_id);

  if (existing) {
    db.prepare('DELETE FROM comparisons WHERE id = ?').run(existing.id);
    return res.json({ added: false });
  }

  // حداکثر ۴ محصول
  const count = db.prepare('SELECT COUNT(*) AS c FROM comparisons WHERE session_id = ?').get(sessionId).c;
  if (count >= 4) return res.status(400).json({ error: 'حداکثر ۴ محصول می‌توانید مقایسه کنید' });

  db.prepare('INSERT INTO comparisons (session_id, product_id) VALUES (?, ?)').run(sessionId, product_id);
  res.json({ added: true });
});

app.delete('/api/compare/clear', (req, res) => {
  const sessionId = getSessionId(req);
  db.prepare('DELETE FROM comparisons WHERE session_id = ?').run(sessionId);
  res.json({ success: true });
});

app.get('/api/compare/ids', (req, res) => {
  const sessionId = getSessionId(req);
  const rows = db.prepare('SELECT product_id FROM comparisons WHERE session_id = ?').all(sessionId);
  res.json(rows.map(r => r.product_id));
});

// ==================== COUPONS ====================
app.post('/api/coupons/validate', (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ error: 'کد کوپن را وارد کنید' });

  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code.toUpperCase().trim());
  if (!coupon) return res.status(404).json({ error: 'کوپن یافت نشد یا غیرفعال است' });
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.status(400).json({ error: 'کوپن منقضی شده' });
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'ظرفیت کوپن پر شده' });
  if (subtotal < coupon.min_purchase) return res.status(400).json({ error: `حداقل خرید ${Number(coupon.min_purchase).toLocaleString('fa-IR')} تومان است` });

  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  discount = Math.min(discount, subtotal);

  res.json({ code: coupon.code, type: coupon.type, value: coupon.value, discount: Number(discount.toFixed(0)) });
});

// ==================== AUTH ====================
app.post('/api/auth/register', (req, res) => {
  const { full_name, email, phone, address, province, city, postal_code, password } = req.body;
  if (!full_name || !email || !password) return res.status(400).json({ error: 'نام، ایمیل و رمز عبور الزامی است' });
  if (password.length < 6) return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(400).json({ error: 'این ایمیل قبلاً ثبت شده' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`INSERT INTO users
    (full_name, email, phone, address, province, city, postal_code, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(full_name, email.toLowerCase(), phone || '', address || '', province || '', city || '', postal_code || '', hash);

  req.session.userId = result.lastInsertRowid;
  req.session.userName = full_name;
  res.status(201).json({ id: result.lastInsertRowid, full_name, email: email.toLowerCase() });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'ایمیل و رمز عبور الزامی است' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است' });
  }
  req.session.userId = user.id;
  req.session.userName = user.full_name;
  res.json({ id: user.id, full_name: user.full_name, email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.userId = null; req.session.userName = null;
  res.json({ success: true });
});
// ==================== بازیابی رمز عبور ====================

// مرحله ۱: بررسی وجود کاربر
app.post('/api/auth/check-user', (req, res) => {
  const { identifier } = req.body;
  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ error: 'ایمیل یا شماره موبایل را وارد کنید' });
  }

  const id = identifier.trim().toLowerCase();

  // جستجو با ایمیل یا شماره موبایل
  const user = db.prepare(`
    SELECT id, full_name, email, phone
    FROM users
    WHERE email = ? OR phone = ?
  `).get(id, identifier.trim());

  if (!user) {
    return res.status(404).json({
      error: 'کاربری با این ایمیل یا شماره موبایل یافت نشد'
    });
  }

  res.json({
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
    },
  });
});

// مرحله ۲: تغییر رمز عبور
app.post('/api/auth/reset-password', (req, res) => {
  const { identifier, newPassword } = req.body;

  if (!identifier || !newPassword) {
    return res.status(400).json({ error: 'اطلاعات ناقص است' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' });
  }

  const id = identifier.trim().toLowerCase();

  const user = db.prepare(`
    SELECT id FROM users WHERE email = ? OR phone = ?
  `).get(id, identifier.trim());

  if (!user) {
    return res.status(404).json({ error: 'کاربر یافت نشد' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, user.id);

  console.log(`🔑 رمز عبور کاربر #${user.id} تغییر کرد`);

  res.json({ success: true });
});
app.get('/api/auth/me', (req, res) => {
  if (!req.session?.userId) return res.json({ loggedIn: false });
  const user = db.prepare('SELECT id, full_name, email, phone, address, province, city, postal_code FROM users WHERE id = ?').get(req.session.userId);
  res.json({ loggedIn: true, user });
});

// ==================== WISHLIST ====================
app.get('/api/wishlist', requireUser, (req, res) => {
  const rows = db.prepare(`
    SELECT w.id, w.product_id, p.name, p.slug, p.price, p.old_price, p.image, p.stock, p.brand_name
    FROM wishlist w
    JOIN products p ON p.id = w.product_id
    WHERE w.user_id = ? AND p.is_active = 1
    ORDER BY w.created_at DESC
  `).all(req.session.userId);
  res.json(rows);
});

app.post('/api/wishlist/toggle', requireUser, (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'شناسه محصول الزامی است' });

  const existing = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(req.session.userId, product_id);
  if (existing) {
    db.prepare('DELETE FROM wishlist WHERE id = ?').run(existing.id);
    return res.json({ added: false });
  }
  db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(req.session.userId, product_id);
  res.json({ added: true });
});

app.get('/api/wishlist/ids', requireUser, (req, res) => {
  const rows = db.prepare('SELECT product_id FROM wishlist WHERE user_id = ?').all(req.session.userId);
  res.json(rows.map(r => r.product_id));
});

// ==================== CONTACT ====================
app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'نام و متن پیام الزامی است' });

  const result = db.prepare(`INSERT INTO contact_messages (name, email, phone, subject, message)
    VALUES (?, ?, ?, ?, ?)`).run(name, email || '', phone || '', subject || '', message);

  notifications.broadcast('new-message', {
    id: result.lastInsertRowid, name, email, subject, ts: Date.now(),
  });

  res.status(201).json({ success: true });
});

// ==================== CHAT ====================
app.post('/api/chat/start', (req, res) => {
  const sessionId = getSessionId(req);
  let room = db.prepare('SELECT * FROM chat_rooms WHERE session_id = ? AND status = "open"').get(sessionId);

  if (!room) {
    const { guest_name, guest_email } = req.body || {};
    const result = db.prepare(`
      INSERT INTO chat_rooms (user_id, guest_name, guest_email, session_id)
      VALUES (?, ?, ?, ?)
    `).run(req.session?.userId || null, guest_name || '', guest_email || '', sessionId);
    room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(result.lastInsertRowid);
  }

  res.json(room);
});

app.get('/api/chat/room', (req, res) => {
  const sessionId = getSessionId(req);
  const room = db.prepare('SELECT * FROM chat_rooms WHERE session_id = ? ORDER BY id DESC LIMIT 1').get(sessionId);
  if (!room) return res.json(null);

  const messages = db.prepare('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at ASC').all(room.id);

  // علامت‌گذاری پیام‌های ادمین به عنوان خوانده شده
  db.prepare('UPDATE chat_messages SET is_read = 1 WHERE room_id = ? AND sender = "admin"').run(room.id);
  db.prepare('UPDATE chat_rooms SET unread_user = 0 WHERE id = ?').run(room.id);

  res.json({ room, messages });
});

app.post('/api/chat/send', (req, res) => {
  const sessionId = getSessionId(req);
  const { message, guest_name, guest_email } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'پیام خالی است' });

  let room = db.prepare('SELECT * FROM chat_rooms WHERE session_id = ? AND status = "open"').get(sessionId);
  if (!room) {
    const result = db.prepare(`
      INSERT INTO chat_rooms (user_id, guest_name, guest_email, session_id, unread_admin)
      VALUES (?, ?, ?, ?, 1)
    `).run(req.session?.userId || null, guest_name || '', guest_email || '', sessionId);
    room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(result.lastInsertRowid);
  } else {
    db.prepare('UPDATE chat_rooms SET unread_admin = unread_admin + 1, last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(room.id);
  }

  const result = db.prepare(`INSERT INTO chat_messages (room_id, sender, message) VALUES (?, 'user', ?)`)
    .run(room.id, message.trim());

  // اطلاع به ادمین‌ها
  notifications.broadcast('new-chat', {
    roomId: room.id,
    userName: req.session?.userName || guest_name || 'مهمان',
    message: message.trim(),
    ts: Date.now(),
  });

  res.json({ id: result.lastInsertRowid });
});

// ==================== ORDERS ====================
app.post('/api/orders', (req, res) => {
  const { full_name, email, phone, address, province, city, postal_code, items, coupon_code } = req.body;
  if (!full_name || !email || !phone || !address) return res.status(400).json({ error: 'نام، ایمیل، تلفن و آدرس الزامی است' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'سبد خرید خالی است' });

  let subtotal = 0;
  const resolvedItems = [];
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
    if (!product) return res.status(400).json({ error: `محصول یافت نشد` });
    if (product.stock < item.quantity) return res.status(400).json({ error: `موجودی "${product.name}" کافی نیست` });
    const sub = product.price * item.quantity;
    subtotal += sub;
    resolvedItems.push({
      product_id: product.id, product_name: product.name, product_image: product.image,
      unit_price: product.price, quantity: item.quantity, subtotal: sub,
    });
  }

  let discount = 0;
  let appliedCoupon = null;
  if (coupon_code) {
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(coupon_code.toUpperCase().trim());
    if (coupon && (!coupon.expires_at || new Date(coupon.expires_at) >= new Date())
      && (coupon.max_uses === 0 || coupon.used_count < coupon.max_uses)
      && subtotal >= coupon.min_purchase) {
      discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
      discount = Math.min(discount, subtotal);
      appliedCoupon = coupon;
    }
  }

  const total = subtotal - discount;

  const createOrder = db.transaction(() => {
    const result = db.prepare(`INSERT INTO orders
      (user_id, full_name, email, phone, address, province, city, postal_code,
       subtotal, discount_amount, coupon_code, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`)
      .run(req.session?.userId || null, full_name, email, phone, address,
        province || '', city || '', postal_code || '', subtotal, discount,
        appliedCoupon ? appliedCoupon.code : null, total);

    const orderId = result.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO order_items
      (order_id, product_id, product_name, product_image, unit_price, quantity, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const it of resolvedItems) {
      insertItem.run(orderId, it.product_id, it.product_name, it.product_image, it.unit_price, it.quantity, it.subtotal);
    }
    if (appliedCoupon) {
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(appliedCoupon.id);
    }
    return orderId;
  });

  const orderId = createOrder();

  notifications.broadcast('new-order', {
    id: orderId, customer: full_name, email, total, itemCount: resolvedItems.length, ts: Date.now(),
  });

  const amountInRial = Math.max(Math.round(total * 10), 10000);
  const callbackUrl = `${BASE_URL}/api/payment/callback?orderId=${orderId}`;

  zarinpal.requestPayment(amountInRial, `سفارش #${orderId} – JAVADI`, callbackUrl)
    .then(({ authority, paymentUrl }) => {
      db.prepare('UPDATE orders SET payment_authority = ? WHERE id = ?').run(authority, orderId);
      res.json({ orderId, paymentUrl });
    })
    .catch(err => {
      console.error('خطای پرداخت:', err);
      res.status(500).json({ error: 'خطای درگاه پرداخت: ' + err.message });
    });
});

app.get('/api/orders/my', requireUser, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  for (const o of orders) o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  res.json(orders);
});

app.get('/api/orders/:id/invoice', requireUser, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  streamInvoice(order, items, res);
});

// ==================== PAYMENT CALLBACK ====================
app.get('/api/payment/callback', async (req, res) => {
  const { Authority, Status, orderId } = req.query;
  if (!orderId) return res.redirect('/payment-result.html?status=error&msg=شماره+سفارش+نامعتبر');

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.redirect('/payment-result.html?status=error&msg=سفارش+یافت+نشد');

  if (Status !== 'OK' && Status !== 'ok') {
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(orderId);
    return res.redirect(`/payment-result.html?status=cancelled&orderId=${orderId}`);
  }

  try {
    const amountInRial = Math.max(Math.round(order.total_amount * 10), 10000);
    const { refId } = await zarinpal.verifyPayment(amountInRial, Authority);

    const finalize = db.transaction(() => {
      db.prepare(`UPDATE orders SET status = 'paid', payment_ref_id = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?`).run(refId, orderId);
      const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
      const updateStock = db.prepare('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?');
      for (const it of items) if (it.product_id) updateStock.run(it.quantity, it.product_id);
    });
    finalize();

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    sendMail({
      to: order.email,
      subject: `تایید سفارش #${orderId} – JAVADI`,
      html: orderConfirmationTemplate({ ...order, payment_ref_id: refId }, items),
    });
    if (process.env.ADMIN_EMAIL) {
      sendMail({
        to: process.env.ADMIN_EMAIL,
        subject: `🛒 سفارش جدید #${orderId}`,
        html: adminNotificationTemplate(order, items),
      });
    }

    notifications.broadcast('order-paid', {
      id: orderId, customer: order.full_name, total: order.total_amount, refId, ts: Date.now(),
    });

    res.redirect(`/payment-result.html?status=success&orderId=${orderId}&refId=${refId}`);
  } catch (err) {
    console.error('خطای تایید:', err);
    db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(orderId);
    res.redirect(`/payment-result.html?status=failed&orderId=${orderId}`);
  }
});

// ==================== ADMIN: AUTH ====================
app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'رمز عبور اشتباه است' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!req.session?.isAdmin });
});

// ==================== ADMIN: NOTIFICATIONS ====================
app.get('/api/notifications/stream', requireAdmin, (req, res) => {
  notifications.setupSSE(req, res);
  notifications.addClient(res);
});

// ==================== ADMIN: UPLOAD ====================
app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایلی ارسال نشد' });
  res.json({ url: '/uploads/' + req.file.filename });
});

app.post('/api/admin/upload-multi', requireAdmin, upload.array('images', 8), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'فایلی ارسال نشد' });
  res.json({ urls: req.files.map(f => '/uploads/' + f.filename) });
});

// ==================== ADMIN: PRODUCTS ====================
app.get('/api/admin/products', requireAdmin, (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.created_at DESC
  `).all();
  res.json(products);
});

app.get('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'محصول یافت نشد' });
  p.images = db.prepare('SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(p.id).map(i => i.url);
  res.json(p);
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, category_id, brand_id, brand_name, short_desc, long_desc, specs, price, old_price, image, stock, featured, is_new, is_deal, deal_ends_at, is_active, extra_images } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'نام و قیمت الزامی است' });

  let slug = slugify(name) + '-' + Date.now().toString().slice(-5);

  const tx = db.transaction(() => {
    const result = db.prepare(`INSERT INTO products
      (name, slug, category_id, brand_id, brand_name, short_desc, long_desc, specs, price, old_price, image, stock, featured, is_new, is_deal, deal_ends_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(name, slug, category_id || null, brand_id || null, brand_name || '', short_desc || '', long_desc || '',
        specs || '{}', parseFloat(price), old_price ? parseFloat(old_price) : null,
        image || '', parseInt(stock) || 0, featured ? 1 : 0, is_new ? 1 : 0, is_deal ? 1 : 0,
        deal_ends_at || null, is_active !== false ? 1 : 0);

    const pid = result.lastInsertRowid;
    if (Array.isArray(extra_images)) {
      const ins = db.prepare('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)');
      extra_images.forEach((url, i) => ins.run(pid, url, i));
    }
    return pid;
  });

  res.status(201).json({ id: tx(), slug });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'محصول یافت نشد' });

  const { name, category_id, brand_id, brand_name, short_desc, long_desc, specs, price, old_price, image, stock, featured, is_new, is_deal, deal_ends_at, is_active, extra_images } = req.body;

  const tx = db.transaction(() => {
    db.prepare(`UPDATE products SET
      name=?, category_id=?, brand_id=?, brand_name=?, short_desc=?, long_desc=?, specs=?,
      price=?, old_price=?, image=?, stock=?, featured=?, is_new=?, is_deal=?, deal_ends_at=?, is_active=?,
      updated_at=CURRENT_TIMESTAMP
      WHERE id=?`)
      .run(
        name ?? existing.name,
        category_id !== undefined ? category_id : existing.category_id,
        brand_id !== undefined ? brand_id : existing.brand_id,
        brand_name ?? existing.brand_name,
        short_desc ?? existing.short_desc,
        long_desc ?? existing.long_desc,
        specs ?? existing.specs,
        price !== undefined ? parseFloat(price) : existing.price,
        old_price !== undefined ? (old_price ? parseFloat(old_price) : null) : existing.old_price,
        image ?? existing.image,
        stock !== undefined ? parseInt(stock) : existing.stock,
        featured !== undefined ? (featured ? 1 : 0) : existing.featured,
        is_new !== undefined ? (is_new ? 1 : 0) : existing.is_new,
        is_deal !== undefined ? (is_deal ? 1 : 0) : existing.is_deal,
        deal_ends_at !== undefined ? deal_ends_at : existing.deal_ends_at,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        req.params.id
      );

    if (Array.isArray(extra_images)) {
      db.prepare('DELETE FROM product_images WHERE product_id = ?').run(req.params.id);
      const ins = db.prepare('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)');
      extra_images.forEach((url, i) => ins.run(req.params.id, url, i));
    }
  });
  tx();
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT image FROM products WHERE id = ?').get(req.params.id);
  const extras = db.prepare('SELECT url FROM product_images WHERE product_id = ?').all(req.params.id);
  const all = [p?.image, ...extras.map(i => i.url)].filter(Boolean);
  for (const url of all) {
    if (url.startsWith('/uploads/')) {
      const f = path.join(__dirname, url);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ADMIN: CATEGORIES ====================
app.get('/api/admin/categories', requireAdmin, (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  for (const c of cats) {
    c.product_count = db.prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ?').get(c.id).c;
  }
  res.json(cats);
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, icon, image, sort_order, is_active } = req.body;
  if (!name) return res.status(400).json({ error: 'نام دسته الزامی است' });

  const slug = slugify(name) + '-' + Date.now().toString().slice(-4);

  try {
    const result = db.prepare(`INSERT INTO categories (name, slug, icon, image, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(name, slug, icon || '📦', image || '', parseInt(sort_order) || 0, is_active !== false ? 1 : 0);
    res.status(201).json({ id: result.lastInsertRowid, slug });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'دسته یافت نشد' });

  const { name, icon, image, sort_order, is_active } = req.body;
  db.prepare(`UPDATE categories SET name=?, icon=?, image=?, sort_order=?, is_active=? WHERE id=?`)
    .run(name ?? existing.name, icon ?? existing.icon, image ?? existing.image,
      sort_order !== undefined ? parseInt(sort_order) : existing.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ADMIN: BRANDS ====================
app.get('/api/admin/brands', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM brands ORDER BY sort_order, id').all());
});

app.post('/api/admin/brands', requireAdmin, (req, res) => {
  const { name, logo, description, sort_order, is_active } = req.body;
  if (!name) return res.status(400).json({ error: 'نام برند الزامی است' });

  const slug = slugify(name) + '-' + Date.now().toString().slice(-4);
  try {
    const result = db.prepare(`INSERT INTO brands (name, slug, logo, description, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(name, slug, logo || '', description || '', parseInt(sort_order) || 0, is_active !== false ? 1 : 0);
    res.status(201).json({ id: result.lastInsertRowid, slug });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/brands/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'برند یافت نشد' });

  const { name, logo, description, sort_order, is_active } = req.body;
  db.prepare(`UPDATE brands SET name=?, logo=?, description=?, sort_order=?, is_active=? WHERE id=?`)
    .run(name ?? existing.name, logo ?? existing.logo, description ?? existing.description,
      sort_order !== undefined ? parseInt(sort_order) : existing.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/brands/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ADMIN: BANNERS ====================
app.get('/api/admin/banners', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM banners ORDER BY sort_order, id').all());
});

app.post('/api/admin/banners', requireAdmin, (req, res) => {
  const { title, subtitle, image, link, btn_text, sort_order, is_active } = req.body;
  if (!image) return res.status(400).json({ error: 'تصویر بنر الزامی است' });
  const result = db.prepare(`INSERT INTO banners (title, subtitle, image, link, btn_text, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(title || '', subtitle || '', image, link || '', btn_text || 'مشاهده', parseInt(sort_order) || 0, is_active !== false ? 1 : 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/banners/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'بنر یافت نشد' });
  const { title, subtitle, image, link, btn_text, sort_order, is_active } = req.body;
  db.prepare(`UPDATE banners SET title=?, subtitle=?, image=?, link=?, btn_text=?, sort_order=?, is_active=? WHERE id=?`)
    .run(title ?? existing.title, subtitle ?? existing.subtitle, image ?? existing.image,
      link ?? existing.link, btn_text ?? existing.btn_text,
      sort_order !== undefined ? parseInt(sort_order) : existing.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/banners/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ADMIN: COUPONS ====================
app.get('/api/admin/coupons', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all());
});

app.post('/api/admin/coupons', requireAdmin, (req, res) => {
  const { code, type, value, min_purchase, max_uses, expires_at } = req.body;
  if (!code || !type || !value) return res.status(400).json({ error: 'کد، نوع و مقدار الزامی است' });
  try {
    const result = db.prepare(`INSERT INTO coupons (code, type, value, min_purchase, max_uses, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(code.toUpperCase().trim(), type, parseFloat(value),
        parseFloat(min_purchase) || 0, parseInt(max_uses) || 0, expires_at || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'این کد قبلاً وجود دارد' });
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/coupons/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/coupons/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ADMIN: ORDERS ====================
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  for (const o of orders) o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  res.json(orders);
});

app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const valid = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'failed'];
  if (!valid.includes(req.body.status)) return res.status(400).json({ error: 'وضعیت نامعتبر' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/orders/:id/invoice', requireAdmin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  streamInvoice(order, items, res);
});

// ==================== ADMIN: MESSAGES ====================
app.get('/api/admin/messages', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all());
});

app.put('/api/admin/messages/:id/read', requireAdmin, (req, res) => {
  db.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/messages/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contact_messages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ADMIN: FAQS ====================
app.get('/api/admin/faqs', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM faqs ORDER BY sort_order, id').all());
});

app.post('/api/admin/faqs', requireAdmin, (req, res) => {
  const { question, answer, sort_order, is_active } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'سوال و پاسخ الزامی است' });
  const result = db.prepare(`INSERT INTO faqs (question, answer, sort_order, is_active) VALUES (?, ?, ?, ?)`)
    .run(question, answer, parseInt(sort_order) || 0, is_active !== false ? 1 : 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/faqs/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM faqs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'یافت نشد' });
  const { question, answer, sort_order, is_active } = req.body;
  db.prepare(`UPDATE faqs SET question=?, answer=?, sort_order=?, is_active=? WHERE id=?`)
    .run(question ?? existing.question, answer ?? existing.answer,
      sort_order !== undefined ? parseInt(sort_order) : existing.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/faqs/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM faqs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ADMIN: CHAT ====================
app.get('/api/admin/chat/rooms', requireAdmin, (req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, u.full_name AS user_name,
      (SELECT message FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message
    FROM chat_rooms r
    LEFT JOIN users u ON u.id = r.user_id
    ORDER BY r.last_message_at DESC
  `).all();
  res.json(rooms);
});

app.get('/api/admin/chat/rooms/:id', requireAdmin, (req, res) => {
  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'اتاق یافت نشد' });

  const messages = db.prepare('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at ASC').all(room.id);
  db.prepare('UPDATE chat_messages SET is_read = 1 WHERE room_id = ? AND sender = "user"').run(room.id);
  db.prepare('UPDATE chat_rooms SET unread_admin = 0 WHERE id = ?').run(room.id);

  res.json({ room, messages });
});

app.post('/api/admin/chat/rooms/:id/reply', requireAdmin, (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'پیام خالی است' });

  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'اتاق یافت نشد' });

  const result = db.prepare(`INSERT INTO chat_messages (room_id, sender, message) VALUES (?, 'admin', ?)`)
    .run(room.id, message.trim());
  db.prepare('UPDATE chat_rooms SET unread_user = unread_user + 1, last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(room.id);

  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/admin/chat/rooms/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM chat_rooms WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ADMIN: SETTINGS ====================
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const updates = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(updates)) {
      stmt.run(k, String(v ?? ''));
    }
  });
  tx();
  res.json({ success: true });
});

// ==================== ADMIN: STATS ====================
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const totalRevenue = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE status = 'paid'`).get().s;
  const totalOrders = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const paidOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = 'paid'`).get().c;
  const pendingOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'`).get().c;
  const totalProducts = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const totalCategories = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  const lowStock = db.prepare('SELECT COUNT(*) AS c FROM products WHERE stock < 5 AND is_active = 1').get().c;
  const unreadMessages = db.prepare('SELECT COUNT(*) AS c FROM contact_messages WHERE is_read = 0').get().c;
  const unreadChats = db.prepare('SELECT COALESCE(SUM(unread_admin), 0) AS c FROM chat_rooms').get().c;

  const salesByDay = db.prepare(`
    SELECT DATE(paid_at) AS day, SUM(total_amount) AS revenue, COUNT(*) AS orders
    FROM orders WHERE status = 'paid' AND paid_at >= DATE('now', '-30 days')
    GROUP BY DATE(paid_at) ORDER BY day
  `).all();

  const topProducts = db.prepare(`
    SELECT oi.product_name, SUM(oi.quantity) AS qty, SUM(oi.subtotal) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'paid'
    GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5
  `).all();

  const salesByCategory = db.prepare(`
    SELECT c.name AS category, SUM(oi.subtotal) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE o.status = 'paid'
    GROUP BY c.name
  `).all();

  const statusDist = db.prepare(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`).all();
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all();

  res.json({
    totalRevenue, totalOrders, paidOrders, pendingOrders,
    totalProducts, totalUsers, totalCategories, lowStock,
    unreadMessages, unreadChats,
    salesByDay, topProducts, salesByCategory, statusDist, recentOrders,
  });
});

// ==================== PAGE ROUTES ====================
const publicPages = {
  '/products': 'products.html',
  '/product/:idOrSlug': 'product.html',
  '/category/:slug': 'category.html',
  '/brand/:slug': 'brand.html',
  '/compare': 'compare.html',
  '/deal': 'deal.html',
  '/cart': 'cart.html',
  '/checkout': 'checkout.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/my-orders': 'my-orders.html',
  '/wishlist': 'wishlist.html',
  '/chat': 'chat.html',
  '/about': 'about.html',
  '/contact': 'contact.html',
  '/faq': 'faq.html',
  '/forgot-password': 'forgot-password.html',
};

Object.entries(publicPages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
});

// Admin routes
app.get(`/${ADMIN_PATH}`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get(`/${ADMIN_PATH}/login`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: err.message || 'خطای سرور' });
});

// ==================== START ====================
app.listen(PORT, () => {
  console.log('');
  console.log('  ✨  JAVADI 2.0 – Luxury Home & Kitchen');
  console.log('  ─────────────────────────────────────');
  console.log(`  🌐  سایت:         ${BASE_URL}`);
  console.log(`  🔐  پنل ادمین:    ${BASE_URL}/${ADMIN_PATH}`);
  console.log(`  🔑  رمز ادمین:    ${ADMIN_PASSWORD}`);
  console.log(`  💳  زرین‌پال:      ${process.env.ZARINPAL_SANDBOX === 'true' ? 'آزمایشی' : 'واقعی'}`);
  console.log(`  📧  ایمیل:        ${process.env.EMAIL_ENABLED === 'true' ? 'فعال' : 'غیرفعال'}`);
  console.log(`  👤  کاربر نمونه:  demo@example.com / demo1234`);
  console.log(`  🎟️   کوپن‌ها:       WELCOME10، SAVE500، JAVADI20`);
  console.log('');
});