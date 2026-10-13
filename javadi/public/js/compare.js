// ============================================================
// JAVADI 2.0 – صفحه مقایسه
// ============================================================

let compareProducts = [];

function renderProductCard(p) {
  const img = p.image || 'https://via.placeholder.com/400x400/e8e1d5/a5abb7?text=JAVADI';
  const hasDiscount = p.old_price && p.old_price > p.price;
  const outOfStock = p.stock === 0;
  const inWishlist = window.JV.wishlistIds.includes(p.id);
  const inCompare = window.JV.compareIds.includes(p.id);

  return `
    <div class="product-card reveal">
      <div class="product-image-wrap">
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

async function loadCompare() {
  const wrap = document.getElementById('compareContent');

  try {
    const res = await fetch('/api/compare');
    compareProducts = await res.json();

    if (!compareProducts.length) {
      wrap.innerHTML = `
        <div class="compare-empty">
          <div class="compare-empty-icon">⚖</div>
          <h2>لیست مقایسه شما خالی است</h2>
          <p>محصولات مورد نظر خود را انتخاب کنید و کنار هم مقایسه کنید</p>
          <a href="/products" class="btn btn-warm btn-large">شروع خرید</a>
        </div>
      `;
      return;
    }

    renderCompareTable();
  } catch {
    wrap.innerHTML = '<p class="loading">خطا در بارگذاری.</p>';
  }
}

function renderCompareTable() {
  const wrap = document.getElementById('compareContent');

  const allSpecsKeys = new Set();
  compareProducts.forEach(p => {
    try {
      const specs = JSON.parse(p.specs || '{}');
      Object.keys(specs).forEach(k => allSpecsKeys.add(k));
    } catch {}
  });

  const specsKeys = Array.from(allSpecsKeys);
  const canAddMore = compareProducts.length < 4;

  wrap.innerHTML = `
    <div class="compare-actions">
      <div class="compare-count">
        <strong>${compareProducts.length.toLocaleString('fa-IR')}</strong> محصول در حال مقایسه
      </div>
      <button class="btn btn-outline btn-small" onclick="clearCompare()">
        🗑 پاک کردن همه
      </button>
    </div>

    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead>
          <tr>
            <th>مشخصه</th>
            ${compareProducts.map(p => `
              <th class="compare-product-header">
                <button class="remove-btn" onclick="removeFromCompare(${p.id})" title="حذف">✕</button>
                <img src="${esc(p.image || 'https://via.placeholder.com/200/e8e1d5/a5abb7?text=JAVADI')}"
                     alt="${esc(p.name)}" onerror="this.src='https://via.placeholder.com/200/e8e1d5/a5abb7?text=JAVADI'">
                <a href="/product/${esc(p.slug)}">${esc(p.name)}</a>
                <div class="compare-product-price">${fmtPrice(p.price)}</div>
                ${p.old_price && p.old_price > p.price
                  ? `<div class="compare-product-old-price">${fmtPrice(p.old_price)}</div>`
                  : ''}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>برند</th>
            ${compareProducts.map(p => `<td>${esc(p.brand_name || '—')}</td>`).join('')}
          </tr>

          <tr>
            <th>دسته‌بندی</th>
            ${compareProducts.map(p => `<td>${esc(p.category_name || '—')}</td>`).join('')}
          </tr>

          <tr>
            <th>موجودی</th>
            ${compareProducts.map(p => `
              <td>
                <span class="compare-cell-stock ${p.stock > 0 ? 'in' : 'out'}">
                  ${p.stock > 0 ? `✓ ${p.stock.toLocaleString('fa-IR')} عدد` : '✕ ناموجود'}
                </span>
              </td>
            `).join('')}
          </tr>

          <tr>
            <th>برچسب‌ها</th>
            ${compareProducts.map(p => `
              <td>
                ${p.is_new ? '<span class="compare-cell-badge badge-new">✨ جدید</span>' : ''}
                ${p.is_deal ? '<span class="compare-cell-badge badge-deal">⏰ شگفت‌انگیز</span>' : ''}
                ${p.old_price && p.old_price > p.price ? '<span class="compare-cell-badge badge-sale">💰 تخفیف‌دار</span>' : ''}
                ${!p.is_new && !p.is_deal && (!p.old_price || p.old_price <= p.price) ? '—' : ''}
              </td>
            `).join('')}
          </tr>

          <tr>
            <th>قیمت</th>
            ${compareProducts.map(p => `
              <td style="font-size:1.05rem;color:var(--accent);font-weight:700">
                ${fmtPrice(p.price)}
              </td>
            `).join('')}
          </tr>

          ${specsKeys.map(key => `
            <tr>
              <th>${esc(key)}</th>
              ${compareProducts.map(p => {
                let specs = {};
                try { specs = JSON.parse(p.specs || '{}'); } catch {}
                return `<td>${specs[key] ? esc(specs[key]) : '—'}</td>`;
              }).join('')}
            </tr>
          `).join('')}

          <tr>
            <th>عملیات</th>
            ${compareProducts.map(p => `
              <td>
                <div style="display:flex;flex-direction:column;gap:8px">
                  <a href="/product/${esc(p.slug)}" class="btn btn-outline btn-small" style="text-align:center">👁 مشاهده</a>
                  ${p.stock > 0 ? `
                    <button class="btn btn-warm btn-small" onclick='JV.addToCart(${JSON.stringify({
                      id: p.id, name: p.name, price: p.price, old_price: p.old_price,
                      image: p.image, slug: p.slug
                    }).replace(/'/g, "&#39;")})'>🛍 افزودن</button>
                  ` : ''}
                </div>
              </td>
            `).join('')}
          </tr>
        </tbody>
      </table>
    </div>

    ${canAddMore ? `
      <div class="compare-add-more">
        <div class="icon">➕</div>
        <p>می‌توانید حداکثر <strong>${(4 - compareProducts.length).toLocaleString('fa-IR')}</strong> محصول دیگر به لیست مقایسه اضافه کنید</p>
        <a href="/products" class="btn btn-primary">افزودن محصول جدید</a>
      </div>
    ` : `
      <div class="compare-add-more">
        <div class="icon">✅</div>
        <p>لیست مقایسه شما پر است (حداکثر ۴ محصول)</p>
      </div>
    `}
  `;
}

async function removeFromCompare(productId) {
  if (!confirm('این محصول از لیست مقایسه حذف شود؟')) return;

  try {
    await fetch('/api/compare/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    });
    await JV.loadCompareIds();
    loadCompare();
    showToast('محصول از مقایسه حذف شد', 'info');
  } catch {
    showToast('خطا در برقراری ارتباط', 'error');
  }
}

async function clearCompare() {
  if (!confirm('همه محصولات از لیست مقایسه حذف شوند؟')) return;

  try {
    await fetch('/api/compare/clear', { method: 'DELETE' });
    await JV.loadCompareIds();
    loadCompare();
    showToast('لیست مقایسه پاک شد', 'info');
  } catch {
    showToast('خطا در برقراری ارتباط', 'error');
  }
}

async function init() {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (window.JV.settings && window.JV.settings.site_name) {
        clearInterval(check); resolve();
      }
    }, 50);
  });

  await loadCompare();
}

window.addEventListener('DOMContentLoaded', init);