// ============================================================
// JAVADI 2.0 – هسته فرانت‌اند
// ============================================================

// ==================== State سراسری ====================
window.JV = {
  settings: {},
  cart: [],
  wishlistIds: [],
  compareIds: [],
  user: null,
  theme: 'light',
};

// ==================== ابزارها ====================
function fmtPrice(n) {
  if (n === null || n === undefined || n === '') return '۰ تومان';
  return Number(n).toLocaleString('fa-IR') + ' تومان';
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function stars(n) {
  const full = Math.round(Number(n) || 0);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'همین الان';
  if (seconds < 3600) return `${Math.floor(seconds / 60).toLocaleString('fa-IR')} دقیقه پیش`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600).toLocaleString('fa-IR')} ساعت پیش`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400).toLocaleString('fa-IR')} روز پیش`;
  return date.toLocaleDateString('fa-IR');
}

// ==================== Toast ====================
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '✓'}</span><span>${esc(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== Theme ====================
function initTheme() {
  const saved = localStorage.getItem('javadi_theme');
  const defaultTheme = window.JV.settings?.default_theme || 'light';
  const theme = saved || defaultTheme;
  setTheme(theme);
}

function setTheme(theme) {
  window.JV.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('javadi_theme', theme);

  const themeLink = document.querySelector('[data-nav="theme"]');
  if (themeLink) {
    const isDark = theme === 'dark';
    themeLink.innerHTML = `
      <span>
        <span class="drawer-nav-icon">${isDark ? '☀️' : '🌙'}</span>
        ${isDark ? 'حالت روز' : 'حالت شب'}
      </span>
      <span class="arrow">←</span>
    `;
  }
}

function toggleTheme() {
  const current = window.JV.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  showToast(next === 'dark' ? '🌙 حالت شب فعال شد' : '☀️ حالت روز فعال شد', 'info');
}

// ==================== Cart ====================
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('javadi_cart') || '[]');
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('javadi_cart', JSON.stringify(cart));
  window.JV.cart = cart;
  updateCartBadge();
}

function updateCartBadge() {
  const cart = getCart();
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    if (count > 0) {
      el.textContent = count.toLocaleString('fa-IR');
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
}

function addToCart(product, quantity = 1) {
  const cart = getCart();
  const existing = cart.find(i => i.product_id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      old_price: product.old_price || null,
      image: product.image,
      slug: product.slug,
      quantity,
    });
  }
  saveCart(cart);
  showToast(`«${product.name}» به سبد خرید اضافه شد`, 'success');
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.classList.add('badge-pulse');
    setTimeout(() => el.classList.remove('badge-pulse'), 1000);
  });
}

function removeFromCart(productId) {
  const cart = getCart().filter(i => i.product_id !== productId);
  saveCart(cart);
}

function getCartTotal() {
  return getCart().reduce((s, i) => s + i.price * i.quantity, 0);
}

// ==================== Wishlist ====================
async function loadWishlistIds() {
  try {
    const res = await fetch('/api/wishlist/ids');
    if (!res.ok) return;
    window.JV.wishlistIds = await res.json();
  } catch {
    window.JV.wishlistIds = [];
  }
}

async function toggleWishlist(productId, btn) {
  const me = await fetch('/api/auth/me').then(r => r.json());
  if (!me.loggedIn) {
    showToast('برای افزودن به علاقه‌مندی‌ها وارد شوید', 'error');
    setTimeout(() => window.location.href = '/login', 1200);
    return;
  }
  try {
    const res = await fetch('/api/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    });
    const data = await res.json();
    if (data.added) {
      showToast('❤️ به علاقه‌مندی‌ها اضافه شد', 'success');
      if (btn) btn.classList.add('active');
    } else {
      showToast('از علاقه‌مندی‌ها حذف شد', 'info');
      if (btn) btn.classList.remove('active');
    }
    await loadWishlistIds();
  } catch {
    showToast('خطا در برقراری ارتباط', 'error');
  }
}

// ==================== Compare ====================
async function loadCompareIds() {
  try {
    const res = await fetch('/api/compare/ids');
    if (!res.ok) return;
    window.JV.compareIds = await res.json();
  } catch {
    window.JV.compareIds = [];
  }
}

async function toggleCompare(productId, btn) {
  try {
    const res = await fetch('/api/compare/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا');
    if (data.added) {
      showToast('⚖️ به لیست مقایسه اضافه شد', 'success');
      if (btn) btn.classList.add('active');
    } else {
      showToast('از لیست مقایسه حذف شد', 'info');
      if (btn) btn.classList.remove('active');
    }
    await loadCompareIds();
    updateCompareBadge();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateCompareBadge() {
  const count = window.JV.compareIds.length;
  document.querySelectorAll('[data-compare-count]').forEach(el => {
    if (count > 0) {
      el.textContent = count.toLocaleString('fa-IR');
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
}

// ==================== Settings ====================
async function loadSettings() {
  try {
    const res = await fetch('/api/settings/public');
    window.JV.settings = await res.json();
  } catch {
    window.JV.settings = {};
  }
}

async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    window.JV.user = data.loggedIn ? data.user : null;
  } catch {
    window.JV.user = null;
  }
}

// ==================== Header ====================
function buildHeader() {
  const slot = document.getElementById('headerSlot');
  if (!slot) return;

  const settings = window.JV.settings || {};
  const siteName = (settings.site_name || 'JAVADI').toUpperCase();
  const user = window.JV.user;

  const cart = getCart();
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const wishCount = window.JV.wishlistIds.length;
  const compareCount = window.JV.compareIds.length;
  const currentPath = window.location.pathname;

  const isActive = (paths) => {
    if (Array.isArray(paths)) return paths.some(p => currentPath.startsWith(p));
    return currentPath === paths;
  };

  slot.innerHTML = `
    <header class="header" id="mainHeader">
      <div class="container">
        <div class="header-inner">
          <a href="/" class="logo">${esc(siteName)}</a>

          <nav class="nav-desktop">
            <a href="/" class="${isActive('/') && currentPath === '/' ? 'active' : ''}">صفحه اصلی</a>
            <a href="/products" class="${isActive('/products') || isActive('/category/') || isActive('/brand/') ? 'active' : ''}">محصولات</a>
            <a href="/deal" class="${isActive('/deal') ? 'active' : ''}">شگفت‌انگیز</a>
            <a href="/about" class="${isActive('/about') ? 'active' : ''}">درباره ما</a>
            <a href="/contact" class="${isActive('/contact') ? 'active' : ''}">تماس</a>
            <a href="/faq" class="${isActive('/faq') ? 'active' : ''}">سوالات</a>
          </nav>

          <div class="header-tools">
            <a href="/compare" class="icon-btn icon-btn-desktop-only" title="مقایسه">
              <span class="icon-btn-icon">⚖</span>
              <span class="icon-btn-badge" data-compare-count style="${compareCount > 0 ? '' : 'display:none'}">${compareCount.toLocaleString('fa-IR')}</span>
            </a>

            <a href="/wishlist" class="icon-btn icon-btn-desktop-only" title="علاقه‌مندی‌ها">
              <span class="icon-btn-icon">❤</span>
              ${wishCount > 0 ? `<span class="icon-btn-badge">${wishCount.toLocaleString('fa-IR')}</span>` : ''}
            </a>

            <a href="/cart" class="icon-btn icon-btn-cart icon-btn-desktop-only" title="سبد خرید">
              <span class="icon-btn-icon">🛒</span>
              <span class="icon-btn-badge" data-cart-count style="${cartCount > 0 ? '' : 'display:none'}">${cartCount.toLocaleString('fa-IR')}</span>
            </a>

            <a href="${user ? '/my-orders' : '/login'}" class="icon-btn icon-btn-user icon-btn-desktop-only" title="${user ? 'حساب من' : 'ورود'}">
              <span class="icon-btn-icon">${user ? '👤' : '🔑'}</span>
              <span class="icon-btn-label">${user ? 'حساب من' : 'ورود'}</span>
            </a>

            <button class="theme-toggle-btn icon-btn-desktop-only" onclick="toggleTheme()" title="تغییر تم" aria-label="تغییر تم">
              <span class="icon-sun">☀</span>
              <span class="icon-moon">🌙</span>
            </button>

            <button class="menu-toggle" id="menuToggle" aria-label="منو">
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="drawer-overlay" id="drawerOverlay"></div>
    <aside class="drawer" id="drawer">
      <div class="drawer-header">
        <div class="drawer-logo">${esc(siteName)}</div>
        <button class="drawer-close" id="drawerClose" aria-label="بستن">✕</button>
      </div>

      <nav class="drawer-nav">
        <a href="/cart" data-nav="cart" class="drawer-nav-cart">
          <span>
            <span class="drawer-nav-icon">🛒</span>
            سبد خرید
            ${cartCount > 0 ? `<span class="drawer-badge">${cartCount.toLocaleString('fa-IR')}</span>` : ''}
          </span>
          <span class="arrow">←</span>
        </a>

        <a href="/compare" data-nav="compare">
          <span>
            <span class="drawer-nav-icon">⚖</span>
            مقایسه محصولات
            ${compareCount > 0 ? `<span class="drawer-badge">${compareCount.toLocaleString('fa-IR')}</span>` : ''}
          </span>
          <span class="arrow">←</span>
        </a>

        <a href="/wishlist" data-nav="wishlist">
          <span>
            <span class="drawer-nav-icon">❤</span>
            علاقه‌مندی‌ها
            ${wishCount > 0 ? `<span class="drawer-badge">${wishCount.toLocaleString('fa-IR')}</span>` : ''}
          </span>
          <span class="arrow">←</span>
        </a>

        ${user ? `
          <a href="/my-orders" data-nav="orders">
            <span><span class="drawer-nav-icon">📦</span> سفارش‌های من</span>
            <span class="arrow">←</span>
          </a>
          <a href="#" onclick="event.preventDefault();fetch('/api/auth/logout',{method:'POST'}).then(()=>location.reload());" data-nav="logout">
            <span><span class="drawer-nav-icon">🚪</span> خروج از حساب</span>
            <span class="arrow">←</span>
          </a>
        ` : `
          <a href="/login" data-nav="login">
            <span><span class="drawer-nav-icon">🔑</span> ورود / ثبت‌نام</span>
            <span class="arrow">←</span>
          </a>
        `}

        <a href="/" data-nav="home">
          <span><span class="drawer-nav-icon">🏠</span> صفحه اصلی</span>
          <span class="arrow">←</span>
        </a>
        <a href="/products" data-nav="products">
          <span><span class="drawer-nav-icon">📦</span> همه محصولات</span>
          <span class="arrow">←</span>
        </a>
        <a href="/deal" data-nav="deal">
          <span><span class="drawer-nav-icon">🔥</span> شگفت‌انگیز</span>
          <span class="arrow">←</span>
        </a>
        <a href="/about" data-nav="about">
          <span><span class="drawer-nav-icon">ℹ</span> درباره ما</span>
          <span class="arrow">←</span>
        </a>
        <a href="/contact" data-nav="contact">
          <span><span class="drawer-nav-icon">📞</span> تماس با ما</span>
          <span class="arrow">←</span>
        </a>
        <a href="/faq" data-nav="faq">
          <span><span class="drawer-nav-icon">❓</span> سوالات متداول</span>
          <span class="arrow">←</span>
        </a>
        <a href="/chat" data-nav="chat">
          <span><span class="drawer-nav-icon">💬</span> گفتگو با پشتیبانی</span>
          <span class="arrow">←</span>
        </a>

        <a href="#" onclick="event.preventDefault();toggleTheme();" data-nav="theme">
          <span>
            <span class="drawer-nav-icon">${window.JV.theme === 'dark' ? '☀️' : '🌙'}</span>
            ${window.JV.theme === 'dark' ? 'حالت روز' : 'حالت شب'}
          </span>
          <span class="arrow">←</span>
        </a>
      </nav>

      <div class="drawer-footer">
        <div class="socials">
          ${settings.social_instagram ? `<a href="${esc(settings.social_instagram)}" target="_blank" title="اینستاگرام">📷</a>` : ''}
          ${settings.social_telegram ? `<a href="${esc(settings.social_telegram)}" target="_blank" title="تلگرام">✈</a>` : ''}
          ${settings.social_whatsapp ? `<a href="${esc(settings.social_whatsapp)}" target="_blank" title="واتساپ">💬</a>` : ''}
        </div>
        <div class="contact-info">
          ${settings.contact_phone ? `<div><strong>تلفن:</strong> ${esc(settings.contact_phone)}</div>` : ''}
          ${settings.contact_address ? `<div><strong>آدرس:</strong> ${esc(settings.contact_address)}</div>` : ''}
        </div>
      </div>
    </aside>
  `;

  setupHeaderEvents();
}

function setupHeaderEvents() {
  const header = document.getElementById('mainHeader');
  const toggle = document.getElementById('menuToggle');
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const close = document.getElementById('drawerClose');

  const onScroll = () => {
    if (window.scrollY > 30) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const openDrawer = () => {
    toggle.classList.add('active');
    drawer.classList.add('active');
    overlay.classList.add('active');
    document.body.classList.add('no-scroll');
  };

  const closeDrawer = () => {
    toggle.classList.remove('active');
    drawer.classList.remove('active');
    overlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
  };

  toggle?.addEventListener('click', () => {
    if (drawer.classList.contains('active')) closeDrawer();
    else openDrawer();
  });

  close?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('active')) closeDrawer();
  });
}

// ==================== Bottom Navigation ====================
function buildBottomNav() {
  const path = window.location.pathname;
  const cartCount = getCart().reduce((s, i) => s + i.quantity, 0);

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = `
    <div class="bottom-nav-inner">
      <a href="/" class="bottom-nav-item ${path === '/' ? 'active' : ''}">
        <span class="bn-icon">🏠</span>
        <span>خانه</span>
      </a>
      <a href="/products" class="bottom-nav-item ${path.startsWith('/products') || path.startsWith('/category') ? 'active' : ''}">
        <span class="bn-icon">📦</span>
        <span>محصولات</span>
      </a>
      <a href="#" class="bottom-nav-item" id="bottomCategoriesBtn">
        <span class="bn-icon">🗂</span>
        <span>دسته‌بندی</span>
      </a>
      <a href="/cart" class="bottom-nav-item ${path === '/cart' ? 'active' : ''}">
        <span class="bn-icon">🛒</span>
        <span>سبد</span>
        ${cartCount > 0 ? `<span class="bottom-nav-badge" data-cart-count>${cartCount.toLocaleString('fa-IR')}</span>` : `<span class="bottom-nav-badge" data-cart-count style="display:none">0</span>`}
      </a>
      <a href="${window.JV.user ? '/my-orders' : '/login'}" class="bottom-nav-item ${path === '/my-orders' || path === '/login' ? 'active' : ''}">
        <span class="bn-icon">${window.JV.user ? '👤' : '🔑'}</span>
        <span>${window.JV.user ? 'حساب' : 'ورود'}</span>
      </a>
    </div>
  `;
  document.body.appendChild(nav);

  document.getElementById('bottomCategoriesBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (path === '/') {
      document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = '/#categories';
      setTimeout(() => {
        document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  });
}

// ==================== Footer ====================
function buildFooter() {
  const slot = document.getElementById('footerSlot');
  if (!slot) return;

  const s = window.JV.settings || {};
  const year = new Date().toLocaleDateString('fa-IR', { year: 'numeric' }).split('/')[0];
  const siteName = s.site_name || 'JAVADI';

  slot.innerHTML = `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <!-- ==================== برند + شبکه‌های اجتماعی ==================== -->
          <div class="footer-brand">
            <a href="/" class="logo">${esc(siteName.toUpperCase())}</a>
            <p class="footer-about">${esc(s.footer_about || s.site_description || '')}</p>
            <div class="footer-socials">
              ${s.social_instagram ? `<a href="${esc(s.social_instagram)}" target="_blank" title="اینستاگرام">📷</a>` : ''}
              ${s.social_telegram ? `<a href="${esc(s.social_telegram)}" target="_blank" title="تلگرام">✈</a>` : ''}
              ${s.social_whatsapp ? `<a href="${esc(s.social_whatsapp)}" target="_blank" title="واتساپ">💬</a>` : ''}
              ${s.social_youtube ? `<a href="${esc(s.social_youtube)}" target="_blank" title="یوتیوب">▶</a>` : ''}
            </div>
          </div>

          <!-- ==================== تماس با ما ==================== -->
          <div class="footer-col footer-contact-col">
            <h4>تماس با ما</h4>
            <div class="footer-contact">
              ${s.contact_address ? `
                <div class="footer-contact-item">
                  <span class="ico">📍</span>
                  <span>${esc(s.contact_address)}</span>
                </div>
              ` : ''}
              ${s.contact_phone ? `
                <div class="footer-contact-item">
                  <span class="ico">📞</span>
                  <a href="tel:${esc(s.contact_phone)}">${esc(s.contact_phone)}</a>
                </div>
              ` : ''}
              ${s.contact_email ? `
                <div class="footer-contact-item">
                  <span class="ico">✉</span>
                  <a href="mailto:${esc(s.contact_email)}">${esc(s.contact_email)}</a>
                </div>
              ` : ''}
              ${s.contact_hours ? `
                <div class="footer-contact-item">
                  <span class="ico">🕐</span>
                  <span>${esc(s.contact_hours)}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <div>© ${year} ${esc(siteName)} – ${esc(s.footer_text || 'تمامی حقوق محفوظ است.')}</div>
        </div>

        <div class="footer-developer">
          <span>made by </span>
          <strong class="dev-name">RamTin</strong>
          <span class="dev-sep">|</span>
          <span>تماس:</span>
          <a href="tel:09302314754" class="dev-phone" dir="ltr">09302314754</a>
        </div>
      </div>
    </footer>
  `;
}

// ==================== Reveal on scroll ====================
function setupReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible), .reveal-fade:not(.visible), .reveal-left:not(.visible), .reveal-right:not(.visible), .reveal-zoom:not(.visible)');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
  els.forEach(el => io.observe(el));
}

// ==================== Preloader ====================
function hidePreloader() {
  const pl = document.getElementById('preloader');
  if (pl) setTimeout(() => pl.classList.add('hidden'), 300);
}

// ==================== Confetti ====================
function celebrate() {
  const colors = ['#e5b869', '#ff8c42', '#ff6b9d', '#7c8cf8', '#3eb5a8'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    if (Math.random() > 0.5) piece.style.borderRadius = '50%';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

// ==================== Init ====================
async function JVInit() {
  await Promise.all([
    loadSettings(),
    loadCurrentUser(),
    loadWishlistIds(),
    loadCompareIds(),
  ]);
  initTheme();
  buildHeader();
  buildFooter();
  buildBottomNav();
  updateCartBadge();
  updateCompareBadge();
  setupReveal();
  hidePreloader();
}

// ==================== Export ====================
window.JV.fmtPrice = fmtPrice;
window.JV.esc = esc;
window.JV.stars = stars;
window.JV.debounce = debounce;
window.JV.timeAgo = timeAgo;
window.JV.showToast = showToast;
window.JV.toggleTheme = toggleTheme;
window.JV.getCart = getCart;
window.JV.saveCart = saveCart;
window.JV.addToCart = addToCart;
window.JV.removeFromCart = removeFromCart;
window.JV.getCartTotal = getCartTotal;
window.JV.toggleWishlist = toggleWishlist;
window.JV.toggleCompare = toggleCompare;
window.JV.loadWishlistIds = loadWishlistIds;
window.JV.loadCompareIds = loadCompareIds;
window.JV.setupReveal = setupReveal;
window.JV.celebrate = celebrate;
window.JV.updateCartBadge = updateCartBadge;

window.addEventListener('DOMContentLoaded', JVInit);