// ============================================================
// JAVADI 2.0 – صفحه شگفت‌انگیزها
// ============================================================

let heroTimerInterval = null;

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
  }
  if (hasDiscount && !outOfStock) {
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

function startHeroTimer(dealEnd) {
  const $d = document.getElementById('heroTimerDays');
  const $h = document.getElementById('heroTimerHours');
  const $m = document.getElementById('heroTimerMinutes');
  const $s = document.getElementById('heroTimerSeconds');

  if (!$d) return;

  let lastSec = -1;

  function tick() {
    const diff = dealEnd - new Date();
    if (diff <= 0) {
      clearInterval(heroTimerInterval);
      if ($d) $d.textContent = '۰';
      if ($h) $h.textContent = '۰۰';
      if ($m) $m.textContent = '۰۰';
      if ($s) $s.textContent = '۰۰';
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    const toFa = (n) => n.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });

    $d.textContent = d.toLocaleString('fa-IR');
    $h.textContent = toFa(h);
    $m.textContent = toFa(m);

    if (s !== lastSec) {
      $s.textContent = toFa(s);
      $s.classList.add('timer-bump');
      setTimeout(() => $s.classList.remove('timer-bump'), 500);
      lastSec = s;
    }
  }

  tick();
  heroTimerInterval = setInterval(tick, 1000);
}

async function loadDealProducts() {
  const grid = document.getElementById('dealGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/products?deal=true&limit=20');
    const products = await res.json();

    if (!products.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-dim)">
          <div style="font-size:3.5rem;opacity:0.4;margin-bottom:16px">⏰</div>
          <p style="font-size:1.05rem;margin-bottom:8px">در حال حاضر پیشنهاد شگفت‌انگیزی فعال نیست</p>
          <p style="font-size:0.9rem">به زودی پیشنهادهای جدید اضافه خواهد شد</p>
          <a href="/products" class="btn btn-primary" style="margin-top:20px">مشاهده همه محصولات</a>
        </div>
      `;
      document.getElementById('heroTimer').parentElement.style.display = 'none';
      return;
    }

    grid.innerHTML = products.map(renderProductCard).join('');
    setupReveal();

    const dealEnd = products
      .map(p => p.deal_ends_at ? new Date(p.deal_ends_at) : null)
      .filter(d => d && d > new Date())
      .sort((a, b) => a - b)[0];

    if (dealEnd) startHeroTimer(dealEnd);
    else document.getElementById('heroTimer').parentElement.style.display = 'none';
  } catch {
    grid.innerHTML = '<p class="loading">خطا در بارگذاری.</p>';
  }
}

async function initDeal() {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (window.JV.settings && window.JV.settings.site_name) {
        clearInterval(check); resolve();
      }
    }, 50);
  });

  await loadDealProducts();
}

window.addEventListener('DOMContentLoaded', initDeal);