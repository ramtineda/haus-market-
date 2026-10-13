// ============================================================
// JAVADI 2.0 – صفحه همه محصولات
// ============================================================

let allProducts = [];
let filteredProducts = [];
let displayedCount = 0;
const PAGE_SIZE = 12;

let filters = {
  category: '',
  brand: '',
  priceMin: null,
  priceMax: null,
  deal: false,
  featured: false,
  inStock: false,
  sort: 'newest',
};

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
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

// ==================== Apply Filters ====================
function applyFilters() {
  let result = [...allProducts];

  if (filters.category) result = result.filter(p => p.category_slug === filters.category);
  if (filters.brand) result = result.filter(p => p.brand_name === filters.brand);
  if (filters.priceMin !== null) result = result.filter(p => p.price >= filters.priceMin);
  if (filters.priceMax !== null) result = result.filter(p => p.price <= filters.priceMax);
  if (filters.deal) result = result.filter(p => p.is_deal === 1);
  if (filters.featured) result = result.filter(p => p.featured === 1);
  if (filters.inStock) result = result.filter(p => p.stock > 0);

  switch (filters.sort) {
    case 'price-asc': result.sort((a, b) => a.price - b.price); break;
    case 'price-desc': result.sort((a, b) => b.price - a.price); break;
    case 'popular': result.sort((a, b) => (b.views || 0) - (a.views || 0)); break;
    case 'newest':
    default: result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  filteredProducts = result;
  displayedCount = 0;
  renderProducts(true);
}

function renderProducts(reset = false) {
  const grid = document.getElementById('productsGrid');
  const loadMoreWrap = document.getElementById('loadMoreWrap');

  if (reset) grid.innerHTML = '';

  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-dim)">
        <div style="font-size:3.5rem;margin-bottom:16px;opacity:0.4">🔍</div>
        <p style="font-size:1.05rem;margin-bottom:8px">محصولی با این مشخصات یافت نشد</p>
        <p style="font-size:0.85rem">فیلترها را تغییر دهید یا همه را پاک کنید</p>
        <button class="btn btn-primary" style="margin-top:20px" onclick="clearAllFilters()">
          پاک کردن فیلترها
        </button>
      </div>
    `;
    document.getElementById('resultCount').textContent = '۰ محصول';
    loadMoreWrap.style.display = 'none';
    return;
  }

  const next = filteredProducts.slice(displayedCount, displayedCount + PAGE_SIZE);

  if (reset) grid.innerHTML = next.map(renderProductCard).join('');
  else grid.insertAdjacentHTML('beforeend', next.map(renderProductCard).join(''));

  displayedCount += next.length;

  document.getElementById('resultCount').textContent =
    `${filteredProducts.length.toLocaleString('fa-IR')} محصول یافت شد`;

  loadMoreWrap.style.display = displayedCount < filteredProducts.length ? 'block' : 'none';

  setupReveal();
}

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>';

  try {
    const res = await fetch('/api/products?limit=500');
    allProducts = await res.json();

    const cat = getUrlParam('category');
    const brand = getUrlParam('brand');
    const featured = getUrlParam('featured');
    const deal = getUrlParam('deal');
    const sort = getUrlParam('sort');

    if (cat) filters.category = cat;
    if (brand) filters.brand = brand;
    if (featured === 'true') filters.featured = true;
    if (deal === 'true') filters.deal = true;
    if (sort) {
      filters.sort = sort;
      document.getElementById('sortSelect').value = sort;
    }

    await fillFiltersSidebar();
    applyFilters();
  } catch (err) {
    grid.innerHTML = '<p class="loading">خطا در بارگذاری محصولات.</p>';
  }
}

async function fillFiltersSidebar() {
  try {
    const res = await fetch('/api/categories');
    const cats = await res.json();
    const wrap = document.getElementById('categoryFilters');

    wrap.innerHTML = `
      <label class="filter-option">
        <input type="radio" name="category" value="" ${!filters.category ? 'checked' : ''}>
        <span>همه دسته‌ها</span>
      </label>
      ${cats.map(c => `
        <label class="filter-option">
          <input type="radio" name="category" value="${esc(c.slug)}" ${filters.category === c.slug ? 'checked' : ''}>
          <span>${esc(c.icon || '')} ${esc(c.name)}</span>
          <span class="count">${c.product_count.toLocaleString('fa-IR')}</span>
        </label>
      `).join('')}
    `;

    wrap.querySelectorAll('input[name="category"]').forEach(input => {
      input.addEventListener('change', () => {
        filters.category = input.value;
        applyFilters();
      });
    });
  } catch {}

  try {
    const res = await fetch('/api/brands');
    const brands = await res.json();
    const wrap = document.getElementById('brandFilters');

    wrap.innerHTML = `
      <label class="filter-option">
        <input type="radio" name="brand" value="" ${!filters.brand ? 'checked' : ''}>
        <span>همه برندها</span>
      </label>
      ${brands.map(b => `
        <label class="filter-option">
          <input type="radio" name="brand" value="${esc(b.name)}" ${filters.brand === b.name ? 'checked' : ''}>
          <span>${esc(b.name)}</span>
          <span class="count">${b.product_count.toLocaleString('fa-IR')}</span>
        </label>
      `).join('')}
    `;

    wrap.querySelectorAll('input[name="brand"]').forEach(input => {
      input.addEventListener('change', () => {
        filters.brand = input.value;
        applyFilters();
      });
    });
  } catch {}
}

function setupToolbar() {
  document.getElementById('sortSelect')?.addEventListener('change', e => {
    filters.sort = e.target.value;
    applyFilters();
  });

  document.getElementById('loadMoreBtn')?.addEventListener('click', () => renderProducts(false));

  document.getElementById('filterDeal')?.addEventListener('change', e => {
    filters.deal = e.target.checked;
    applyFilters();
  });
  document.getElementById('filterFeatured')?.addEventListener('change', e => {
    filters.featured = e.target.checked;
    applyFilters();
  });
  document.getElementById('filterStock')?.addEventListener('change', e => {
    filters.inStock = e.target.checked;
    applyFilters();
  });

  document.getElementById('applyPrice')?.addEventListener('click', () => {
    const min = document.getElementById('priceMin').value;
    const max = document.getElementById('priceMax').value;
    filters.priceMin = min ? parseInt(min) : null;
    filters.priceMax = max ? parseInt(max) : null;
    applyFilters();
  });

  document.getElementById('clearFilters')?.addEventListener('click', clearAllFilters);

  const sidebar = document.getElementById('filtersSidebar');
  document.getElementById('filtersToggle')?.addEventListener('click', () => {
    sidebar.classList.add('active');
    document.body.classList.add('no-scroll');
  });

  document.getElementById('filtersClose')?.addEventListener('click', () => {
    sidebar.classList.remove('active');
    document.body.classList.remove('no-scroll');
  });

  sidebar.addEventListener('click', e => {
    if (e.target === sidebar && window.innerWidth <= 992) {
      sidebar.classList.remove('active');
      document.body.classList.remove('no-scroll');
    }
  });
}

function clearAllFilters() {
  filters = {
    category: '',
    brand: '',
    priceMin: null,
    priceMax: null,
    deal: false,
    featured: false,
    inStock: false,
    sort: 'newest',
  };

  document.getElementById('sortSelect').value = 'newest';
  document.getElementById('filterDeal').checked = false;
  document.getElementById('filterFeatured').checked = false;
  document.getElementById('filterStock').checked = false;
  document.getElementById('priceMin').value = '';
  document.getElementById('priceMax').value = '';

  document.querySelectorAll('input[name="category"], input[name="brand"]').forEach(i => {
    i.checked = i.value === '';
  });

  applyFilters();
  window.history.replaceState({}, '', '/products');
}

async function setPageHeading() {
  const catSlug = getUrlParam('category');
  const brandSlug = getUrlParam('brand');
  const featured = getUrlParam('featured');
  const deal = getUrlParam('deal');

  let title = 'همه محصولات';
  let subtitle = 'مجموعه کامل لوازم خانگی و آشپزخانه';
  let breadcrumb = 'همه محصولات';

  if (catSlug) {
    try {
      const res = await fetch('/api/categories/' + catSlug);
      if (res.ok) {
        const cat = await res.json();
        title = cat.name;
        subtitle = `محصولات دسته ${cat.name}`;
        breadcrumb = cat.name;
      }
    } catch {}
  } else if (brandSlug) {
    try {
      const res = await fetch('/api/brands/' + brandSlug);
      if (res.ok) {
        const b = await res.json();
        title = `محصولات ${b.name}`;
        subtitle = `همه محصولات برند ${b.name}`;
        breadcrumb = b.name;
      }
    } catch {}
  } else if (featured === 'true') {
    title = 'محصولات ویژه';
    subtitle = 'منتخب بهترین‌های فروشگاه';
    breadcrumb = 'محصولات ویژه';
  } else if (deal === 'true') {
    title = '🔥 شگفت‌انگیزها';
    subtitle = 'تخفیف‌های ویژه با فرصت محدود';
    breadcrumb = 'شگفت‌انگیز';
  }

  document.title = title + ' – JAVADI';
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = subtitle;
  document.getElementById('breadcrumbCurrent').textContent = breadcrumb;
}

async function init() {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (window.JV.settings && window.JV.settings.site_name) {
        clearInterval(check); resolve();
      }
    }, 50);
  });

  await setPageHeading();
  setupToolbar();
  await loadProducts();
}

window.addEventListener('DOMContentLoaded', init);