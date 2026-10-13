// ============================================================
// JAVADI 2.0 – صفحه جزئیات محصول
// ============================================================

let currentProduct = null;

function getSlugFromUrl() {
  const parts = window.location.pathname.split('/');
  return decodeURIComponent(parts[parts.length - 1]);
}

function renderProduct(p) {
  const main = document.getElementById('productMain');
  const imgs = [p.image, ...(p.images || [])].filter(Boolean);
  const hasDiscount = p.old_price && p.old_price > p.price;
  const discountPercent = hasDiscount
    ? Math.round(((p.old_price - p.price) / p.old_price) * 100)
    : 0;
  const outOfStock = p.stock === 0;
  const inWishlist = window.JV.wishlistIds.includes(p.id);
  const inCompare = window.JV.compareIds.includes(p.id);

  let specs = {};
  try { specs = JSON.parse(p.specs || '{}'); } catch {}

  main.innerHTML = `
    <div class="container">
      <div class="breadcrumb" style="padding-top:120px">
        <a href="/">صفحه اصلی</a>
        <span class="breadcrumb-sep">/</span>
        <a href="/products">محصولات</a>
        ${p.category_name ? `
          <span class="breadcrumb-sep">/</span>
          <a href="/category/${esc(p.category_slug)}">${esc(p.category_name)}</a>
        ` : ''}
        <span class="breadcrumb-sep">/</span>
        <span class="current">${esc(p.name)}</span>
      </div>

      <div class="product-detail">
        <div class="product-detail-grid">
          <div class="gallery">
            <div class="gallery-main" id="galleryMain">
              <img src="${esc(imgs[0] || 'https://via.placeholder.com/600x600/e8e1d5/a5abb7?text=JAVADI')}"
                   alt="${esc(p.name)}"
                   onerror="this.src='https://via.placeholder.com/600x600/e8e1d5/a5abb7?text=JAVADI'">
              <span class="zoom-hint">🔍 برای بزرگنمایی کلیک کنید</span>
            </div>
            ${imgs.length > 1 ? `
              <div class="gallery-thumbs" id="galleryThumbs">
                ${imgs.map((url, i) => `
                  <div class="gallery-thumb ${i === 0 ? 'active' : ''}" data-url="${esc(url)}">
                    <img src="${esc(url)}" alt="">
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div class="product-detail-info">
            ${p.brand_name ? `<div class="product-detail-brand">${esc(p.brand_name)}</div>` : ''}
            <h1 class="product-detail-title">${esc(p.name)}</h1>

            <div class="product-detail-price">
              <span class="price-current">${fmtPrice(p.price)}</span>
              ${hasDiscount ? `
                <span class="price-old">${fmtPrice(p.old_price)}</span>
                <span class="price-discount">٪${discountPercent.toLocaleString('fa-IR')} تخفیف</span>
              ` : ''}
            </div>

            <div class="product-stock ${outOfStock ? 'out' : 'in'}">
              ${outOfStock
                ? '✕ فعلاً ناموجود'
                : `✓ موجود در انبار (${p.stock.toLocaleString('fa-IR')} عدد)`}
            </div>

            <p class="product-detail-desc">${esc(p.short_desc || '')}</p>

            ${!outOfStock ? `
              <div class="product-actions-row">
                <div class="quantity-selector">
                  <button type="button" onclick="changeQty(-1)">−</button>
                  <input type="number" id="qtyInput" value="1" min="1" max="${p.stock}" readonly>
                  <button type="button" onclick="changeQty(1)">+</button>
                </div>
                <button class="btn btn-warm" onclick="addCurrentToCart()">
                  🛍 افزودن به سبد خرید
                </button>
                <button class="wishlist-btn ${inWishlist ? 'active' : ''}"
                        onclick="JV.toggleWishlist(${p.id}, this)" title="علاقه‌مندی">♥</button>
              </div>
            ` : `
              <div class="product-actions-row">
                <button class="btn btn-outline" disabled style="flex:1;height:48px">محصول ناموجود است</button>
                <button class="wishlist-btn ${inWishlist ? 'active' : ''}"
                        onclick="JV.toggleWishlist(${p.id}, this)" title="علاقه‌مندی">♥</button>
              </div>
            `}

            <div style="display:flex;gap:12px;margin-top:12px;">
              <button class="btn btn-outline" onclick="JV.toggleCompare(${p.id}, this)"
                      style="flex:1;height:44px;font-size:0.88rem">
                ⚖ ${inCompare ? 'حذف از مقایسه' : 'افزودن به مقایسه'}
              </button>
            </div>

            <div class="product-meta">
              ${p.brand_name ? `
                <div class="product-meta-item">
                  <div class="label">برند</div>
                  <div class="value">${esc(p.brand_name)}</div>
                </div>
              ` : ''}
              ${p.category_name ? `
                <div class="product-meta-item">
                  <div class="label">دسته‌بندی</div>
                  <div class="value">${esc(p.category_name)}</div>
                </div>
              ` : ''}
              <div class="product-meta-item">
                <div class="label">کد محصول</div>
                <div class="value">JV-${String(p.id).padStart(4, '0')}</div>
              </div>
              <div class="product-meta-item">
                <div class="label">موجودی</div>
                <div class="value">${p.stock.toLocaleString('fa-IR')} عدد</div>
              </div>
            </div>
          </div>
        </div>

        <div class="product-tabs">
          <div class="tabs-nav">
            <button class="tab-btn active" data-tab="desc">توضیحات محصول</button>
            <button class="tab-btn" data-tab="specs">مشخصات فنی</button>
            <button class="tab-btn" data-tab="shipping">ارسال و تحویل</button>
          </div>

          <div class="tab-content">
            <div class="tab-panel active" data-panel="desc">
              <p style="white-space:pre-line;line-height:2.1">${esc(p.long_desc || p.short_desc || 'توضیحی ثبت نشده است.')}</p>
            </div>

            <div class="tab-panel" data-panel="specs">
              ${Object.keys(specs).length ? `
                <table class="specs-table">
                  ${Object.entries(specs).map(([k, v]) => `
                    <tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>
                  `).join('')}
                </table>
              ` : '<p style="color:var(--text-dim)">مشخصات فنی ثبت نشده است.</p>'}
            </div>

            <div class="tab-panel" data-panel="shipping">
              <ul style="line-height:2.2;color:var(--text-mid)">
                <li>✓ ارسال به سراسر کشور</li>
                <li>✓ ارسال رایگان برای خریدهای بالای ۵ میلیون تومان</li>
                <li>✓ زمان تحویل: ۱ تا ۴ روز کاری</li>
                <li>✓ بسته‌بندی ایمن و بیمه‌شده</li>
                <li>✓ گارانتی اصالت کالا</li>
              </ul>
            </div>
          </div>
        </div>

        <div style="margin-top:60px">
          <h2 class="related-title">محصولات مرتبط</h2>
          <div class="products-grid" id="relatedGrid">
            <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupGallery();
  setupTabs();
  loadRelated(p.id);
}

function setupGallery() {
  const main = document.getElementById('galleryMain');
  const thumbs = document.getElementById('galleryThumbs');
  if (!main) return;

  main.addEventListener('click', () => {
    main.classList.toggle('zoomed');
  });

  main.addEventListener('mousemove', e => {
    if (!main.classList.contains('zoomed')) return;
    const rect = main.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const img = main.querySelector('img');
    img.style.transformOrigin = `${x}% ${y}%`;
  });

  if (!thumbs) return;

  thumbs.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const url = thumb.dataset.url;
      main.querySelector('img').src = url;
      thumbs.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      main.classList.remove('zoomed');
    });
  });
}

function setupTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      btns.forEach(b => b.classList.toggle('active', b === btn));
      panels.forEach(p => p.classList.toggle('active', p.dataset.panel === target));
    });
  });
}

function changeQty(delta) {
  if (!currentProduct) return;
  const input = document.getElementById('qtyInput');
  if (!input) return;
  let v = parseInt(input.value) + delta;
  v = Math.max(1, Math.min(v, currentProduct.stock));
  input.value = v;
}

function addCurrentToCart() {
  if (!currentProduct) return;
  const qty = parseInt(document.getElementById('qtyInput')?.value) || 1;
  JV.addToCart({
    id: currentProduct.id,
    name: currentProduct.name,
    price: currentProduct.price,
    old_price: currentProduct.old_price,
    image: currentProduct.image,
    slug: currentProduct.slug,
  }, qty);
}

// ==================== Related Products ====================
async function loadRelated(productId) {
  const grid = document.getElementById('relatedGrid');
  if (!grid) return;
  try {
    const res = await fetch(`/api/products/${productId}/related`);
    const products = await res.json();

    if (!products.length) {
      grid.parentElement.style.display = 'none';
      return;
    }

    grid.innerHTML = products.slice(0, 4).map(renderRelatedCard).join('');
    setupReveal();
  } catch {
    grid.parentElement.style.display = 'none';
  }
}

function renderRelatedCard(p) {
  const img = p.image || 'https://via.placeholder.com/400x400/e8e1d5/a5abb7?text=JAVADI';
  const hasDiscount = p.old_price && p.old_price > p.price;
  const outOfStock = p.stock === 0;
  const inWishlist = window.JV.wishlistIds.includes(p.id);
  const inCompare = window.JV.compareIds.includes(p.id);

  return `
    <div class="product-card reveal">
      <div class="product-image-wrap">
        ${p.is_new && !outOfStock ? `<span class="product-badge new">✨ جدید</span>` : ''}
        ${hasDiscount && !outOfStock ? `<span class="product-badge sale">تخفیف</span>` : ''}
        ${outOfStock ? `<span class="product-badge out">ناموجود</span>` : ''}
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

async function initProduct() {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (window.JV.settings && window.JV.settings.site_name) {
        clearInterval(check); resolve();
      }
    }, 50);
  });

  const slug = getSlugFromUrl();
  if (!slug || slug === 'product.html') {
    document.getElementById('productMain').innerHTML = `
      <div class="container" style="padding:150px 20px;text-align:center;color:var(--text-dim)">
        <div style="font-size:3rem;opacity:0.4;margin-bottom:16px">🔍</div>
        <p>محصول مورد نظر یافت نشد.</p>
        <a href="/products" class="btn btn-primary" style="margin-top:20px">مشاهده محصولات</a>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch('/api/products/' + encodeURIComponent(slug));
    if (!res.ok) throw new Error();
    currentProduct = await res.json();

    document.title = currentProduct.name + ' – JAVADI';
    setMeta('description', currentProduct.short_desc || '');

    if (currentProduct.jsonLd) {
      let script = document.getElementById('product-jsonld');
      if (!script) {
        script = document.createElement('script');
        script.id = 'product-jsonld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(currentProduct.jsonLd);
    }

    renderProduct(currentProduct);
  } catch {
    document.getElementById('productMain').innerHTML = `
      <div class="container" style="padding:150px 20px;text-align:center;color:var(--text-dim)">
        <div style="font-size:3rem;opacity:0.4;margin-bottom:16px">🔍</div>
        <p>محصول یافت نشد یا حذف شده است.</p>
        <a href="/products" class="btn btn-primary" style="margin-top:20px">مشاهده محصولات</a>
      </div>
    `;
  }
}

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content || '';
}

window.addEventListener('DOMContentLoaded', initProduct);