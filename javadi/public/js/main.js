// ============================================================
// JAVADI 2.0 – صفحه اصلی
// ============================================================

// ==================== Hero Slider ====================
async function initHero() {
  const slider = document.getElementById('heroSlider');
  const dotsWrap = document.getElementById('heroDots');
  if (!slider) return;

  let banners = [];
  try {
    const res = await fetch('/api/banners');
    banners = await res.json();
  } catch {}

  if (!banners.length) {
    slider.innerHTML = '';
    return;
  }

  slider.innerHTML = banners.map((b, i) => `
    <div class="hero-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
      <div class="hero-slide-img" style="background-image:url('${esc(b.image)}')"></div>
      <div class="hero-slide-content">
        <span class="hero-eyebrow">مجموعه جدید JAVADI</span>
        ${b.title ? `<h1 class="hero-title">${highlightLastWord(b.title)}</h1>` : ''}
        ${b.subtitle ? `<p class="hero-subtitle">${esc(b.subtitle)}</p>` : ''}
        <div class="hero-cta">
          <a href="${esc(b.link || '/products')}" class="btn btn-warm btn-large">
            ${esc(b.btn_text || 'مشاهده')}
            <span>←</span>
          </a>
          <a href="/about" class="btn btn-outline btn-large" style="border-color:rgba(255,255,255,0.3);color:#fff">
            درباره ما
          </a>
        </div>
      </div>
    </div>
  `).join('');

  if (dotsWrap) {
    dotsWrap.innerHTML = banners.map((_, i) => `
      <button class="hero-dot ${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="اسلاید ${i + 1}"></button>
    `).join('');

    dotsWrap.querySelectorAll('.hero-dot').forEach(dot => {
      dot.addEventListener('click', () => goToSlide(parseInt(dot.dataset.dot)));
    });
  }

  let current = 0;
  let autoTimer;

  function goToSlide(i) {
    current = (i + banners.length) % banners.length;
    slider.querySelectorAll('.hero-slide').forEach((s, idx) => {
      s.classList.toggle('active', idx === current);
    });
    dotsWrap?.querySelectorAll('.hero-dot').forEach((d, idx) => {
      d.classList.toggle('active', idx === current);
    });
    resetAuto();
  }

  function resetAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goToSlide(current + 1), 6500);
  }

  document.getElementById('heroPrev')?.addEventListener('click', () => goToSlide(current - 1));
  document.getElementById('heroNext')?.addEventListener('click', () => goToSlide(current + 1));

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') goToSlide(current - 1);
    if (e.key === 'ArrowLeft') goToSlide(current + 1);
  });

  let touchStartX = 0;
  slider.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  slider.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goToSlide(current + 1);
      else goToSlide(current - 1);
    }
  }, { passive: true });

  resetAuto();
}

function highlightLastWord(text) {
  const words = String(text).trim().split(' ');
  if (words.length === 0) return '';
  const last = words.pop();
  const rest = words.map(esc).join(' ');
  return `${rest} <span class="highlight">${esc(last)}</span>`;
}

// ==================== Deal (شگفت‌انگیز) ====================
let dealInterval = null;

async function initDeal() {
  const section = document.getElementById('dealSection');
  const wrap = document.getElementById('dealProducts');
  if (!section) return;

  try {
    const res = await fetch('/api/products?deal=true&limit=8');
    const products = await res.json();

    if (!products.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    wrap.innerHTML = products.map(renderProductCard).join('');

    const dealEnd = products
      .map(p => p.deal_ends_at ? new Date(p.deal_ends_at) : null)
      .filter(d => d && d > new Date())
      .sort((a, b) => a - b)[0];

    if (dealEnd) startCountdown(dealEnd);
    else document.getElementById('dealTimer').style.display = 'none';

    setupReveal();
  } catch {
    section.style.display = 'none';
  }
}

function startCountdown(endDate) {
  const $days = document.getElementById('timerDays');
  const $hours = document.getElementById('timerHours');
  const $mins = document.getElementById('timerMinutes');
  const $secs = document.getElementById('timerSeconds');

  function tick() {
    const diff = endDate - new Date();
    if (diff <= 0) {
      clearInterval(dealInterval);
      [$days, $hours, $mins, $secs].forEach(el => el && (el.textContent = '۰'));
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    const toFa = (n, pad = false) => {
      let str = n.toString();
      if (pad) str = str.padStart(2, '0');
      return str.replace(/\d/g, x => '۰۱۲۳۴۵۶۷۸۹'[x]);
    };

    if ($days) $days.textContent = d.toLocaleString('fa-IR');
    if ($hours) $hours.textContent = toFa(h, true);
    if ($mins) $mins.textContent = toFa(m, true);
    if ($secs) $secs.textContent = toFa(s, true);
  }

  tick();
  dealInterval = setInterval(tick, 1000);
}

// ==================== Categories ====================
async function loadCategories() {
  const wrap = document.getElementById('categoriesScroll');
  if (!wrap) return;

  try {
    const res = await fetch('/api/categories');
    const cats = await res.json();

    if (!cats.length) {
      wrap.innerHTML = '<p class="loading">دسته‌ای موجود نیست.</p>';
      return;
    }

    wrap.innerHTML = cats.map(c => `
      <a href="/category/${esc(c.slug)}" class="category-card reveal">
        <div class="category-icon">${esc(c.icon || '📦')}</div>
        <div class="category-name">${esc(c.name)}</div>
        <div class="category-count">${c.product_count.toLocaleString('fa-IR')} محصول</div>
      </a>
    `).join('');

    setupReveal();
  } catch {
    wrap.innerHTML = '<p class="loading">خطا در بارگذاری.</p>';
  }
}

// ==================== Product Card ====================
function renderProductCard(p) {
  const img = p.image || 'https://via.placeholder.com/400x400/e8e1d5/a5abb7?text=JAVADI';
  const hasDiscount = p.old_price && p.old_price > p.price;
  const discountPercent = hasDiscount
    ? Math.round(((p.old_price - p.price) / p.old_price) * 100)
    : 0;
  const outOfStock = p.stock === 0;
  const inWishlist = window.JV.wishlistIds.includes(p.id);
  const inCompare = window.JV.compareIds.includes(p.id);

  let badges = '';
  if (p.is_deal && !outOfStock) {
    badges += `<span class="product-badge deal">⏰ شگفت‌انگیز</span>`;
  } else if (p.is_new && !outOfStock) {
    badges += `<span class="product-badge new">✨ جدید</span>`;
  }
  if (hasDiscount && !outOfStock && !p.is_deal) {
    badges += `<span class="product-badge sale">٪${discountPercent.toLocaleString('fa-IR')}</span>`;
  }
  if (outOfStock) {
    badges += `<span class="product-badge out">ناموجود</span>`;
  }

  return `
    <div class="product-card reveal">
      <div class="product-image-wrap">
        ${badges}
        <a href="/product/${esc(p.slug)}">
          <img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy"
               onerror="this.src='https://via.placeholder.com/400x400/e8e1d5/a5abb7?text=JAVADI'">
        </a>
        <div class="product-actions">
          <button class="product-action-btn ${inWishlist ? 'active' : ''}"
                  onclick="event.preventDefault();JV.toggleWishlist(${p.id}, this)"
                  title="علاقه‌مندی">♥</button>
          <button class="product-action-btn ${inCompare ? 'active' : ''}"
                  onclick="event.preventDefault();JV.toggleCompare(${p.id}, this)"
                  title="مقایسه">⚖</button>
        </div>
      </div>
      <div class="product-info">
        ${p.brand_name ? `<div class="product-brand">${esc(p.brand_name)}</div>` : ''}
        <a href="/product/${esc(p.slug)}">
          <h3 class="product-title">${esc(p.name)}</h3>
        </a>
        <div class="product-price-row">
          <div class="product-price-wrap">
            <span class="product-price">${fmtPrice(p.price)}</span>
            ${hasDiscount ? `<span class="product-old-price">${fmtPrice(p.old_price)}</span>` : ''}
          </div>
          ${!outOfStock ? `
            <button class="product-add-btn"
                    onclick='event.preventDefault();JV.addToCart(${JSON.stringify({
                      id: p.id, name: p.name, price: p.price, old_price: p.old_price,
                      image: p.image, slug: p.slug
                    }).replace(/'/g, "&#39;")})'
                    title="افزودن به سبد">
              <span class="icon">🛍</span>
              <span class="text">افزودن</span>
            </button>
          ` : `
            <button class="product-add-btn disabled" disabled>
              <span class="text">ناموجود</span>
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

// ==================== Load Sections ====================
async function loadNewest() {
  const wrap = document.getElementById('newGrid');
  if (!wrap) return;
  try {
    const res = await fetch('/api/products?sort=newest&limit=4');
    const products = await res.json();
    if (!products.length) {
      wrap.innerHTML = '<p class="loading">محصول جدیدی نیست.</p>';
      return;
    }
    wrap.innerHTML = products.map(renderProductCard).join('');
    setupReveal();
  } catch {
    wrap.innerHTML = '<p class="loading">خطا در بارگذاری.</p>';
  }
}

async function loadPopular() {
  const wrap = document.getElementById('popularGrid');
  if (!wrap) return;
  try {
    const res = await fetch('/api/products?sort=popular&limit=4');
    const products = await res.json();
    if (!products.length) {
      wrap.innerHTML = '<p class="loading">محصولی موجود نیست.</p>';
      return;
    }
    wrap.innerHTML = products.map(renderProductCard).join('');
    setupReveal();
  } catch {
    wrap.innerHTML = '<p class="loading">خطا در بارگذاری.</p>';
  }
}

// ==================== Brands ====================
async function loadBrands() {
  const wrap = document.getElementById('brandsScroll');
  if (!wrap) return;
  try {
    const res = await fetch('/api/brands');
    const brands = await res.json();
    if (!brands.length) {
      wrap.parentElement.parentElement.style.display = 'none';
      return;
    }
    wrap.innerHTML = brands.map(b => `
      <a href="/brand/${esc(b.slug)}" class="brand-item reveal">
        ${esc(b.name)}
      </a>
    `).join('');
    setupReveal();
  } catch {
    wrap.parentElement.parentElement.style.display = 'none';
  }
}

// ==================== Init ====================
async function initMain() {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (window.JV.settings && window.JV.settings.site_name) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });

  await Promise.all([
    initHero(),
    loadCategories(),
    initDeal(),
    loadNewest(),
    loadPopular(),
    loadBrands(),
  ]);
}

window.addEventListener('DOMContentLoaded', initMain);