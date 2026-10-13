// ============================================================
// JAVADI 2.0 – صفحه سبد خرید
// ============================================================

let appliedCoupon = null;

// ==================== Render ====================
function renderEmptyCart() {
  const wrap = document.getElementById('cartContent');
  wrap.innerHTML = `
    <div class="empty-cart">
      <span class="empty-cart-icon">🛍</span>
      <h2>سبد خرید شما خالی است</h2>
      <p>هنوز محصولی به سبد خرید اضافه نکرده‌اید</p>
      <a href="/products" class="btn btn-warm btn-large">شروع خرید</a>
    </div>
  `;
}

function renderCart() {
  const cart = getCart();
  const wrap = document.getElementById('cartContent');

  if (cart.length === 0) return renderEmptyCart();

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.type === 'percent'
      ? (subtotal * appliedCoupon.value) / 100
      : appliedCoupon.value;
    discount = Math.min(discount, subtotal);
  }

  const total = subtotal - discount;
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  wrap.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items">
        ${cart.map(item => {
          const img = item.image || 'https://via.placeholder.com/200/e8e1d5/a5abb7?text=JAVADI';
          return `
            <div class="cart-item" data-id="${item.product_id}">
              <a href="/product/${esc(item.slug)}" class="cart-item-img">
                <img src="${esc(img)}" alt="${esc(item.name)}"
                     onerror="this.src='https://via.placeholder.com/200/e8e1d5/a5abb7?text=JAVADI'">
              </a>

              <div class="cart-item-info">
                <a href="/product/${esc(item.slug)}">
                  <h3>${esc(item.name)}</h3>
                </a>
                <div class="unit-price">
                  قیمت واحد: <strong>${fmtPrice(item.price)}</strong>
                </div>
              </div>

              <div class="cart-item-qty">
                <button type="button" onclick="changeQty(${item.product_id}, -1)">−</button>
                <input type="number" value="${item.quantity}" readonly>
                <button type="button" onclick="changeQty(${item.product_id}, 1)">+</button>
              </div>

              <div class="cart-item-subtotal">
                <div class="label">جمع</div>
                <div class="value">${fmtPrice(item.price * item.quantity)}</div>
              </div>

              <button class="cart-item-remove" onclick="removeItem(${item.product_id})" title="حذف">✕</button>
            </div>
          `;
        }).join('')}
      </div>

      <aside class="cart-sidebar">
        <h3>🧾 خلاصه سفارش</h3>

        <div class="cart-summary-row">
          <span>تعداد اقلام</span>
          <span class="value">${itemCount.toLocaleString('fa-IR')} عدد</span>
        </div>

        <div class="cart-summary-row">
          <span>جمع کل</span>
          <span class="value">${fmtPrice(subtotal)}</span>
        </div>

        ${appliedCoupon ? `
          <div class="cart-summary-row discount">
            <span>تخفیف (${esc(appliedCoupon.code)})</span>
            <span class="value">−${fmtPrice(discount)}</span>
          </div>
        ` : ''}

        <div class="cart-summary-row total">
          <span>قابل پرداخت</span>
          <span class="value">${fmtPrice(total)}</span>
        </div>

        <div class="coupon-section">
          <label>🎟 کد تخفیف دارید؟</label>
          <div class="coupon-box">
            <input type="text" id="couponInput" placeholder="مثلاً WELCOME10"
                   value="${appliedCoupon ? appliedCoupon.code : ''}">
            <button type="button" id="applyCouponBtn">
              ${appliedCoupon ? 'حذف' : 'اعمال'}
            </button>
          </div>
          <div class="coupon-msg ${appliedCoupon ? 'success' : ''}" id="couponMsg">
            ${appliedCoupon ? `✓ کد ${esc(appliedCoupon.code)} اعمال شد` : ''}
          </div>
        </div>

        <a href="/checkout" class="btn btn-warm">
          ادامه فرآیند خرید
          <span>←</span>
        </a>

        <a href="/products" class="btn btn-outline">
          ادامه خرید
        </a>
      </aside>
    </div>
  `;

  // رویدادها
  const applyBtn = document.getElementById('applyCouponBtn');
  applyBtn?.addEventListener('click', appliedCoupon ? removeCoupon : applyCoupon);

  const input = document.getElementById('couponInput');
  input?.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      appliedCoupon ? removeCoupon() : applyCoupon();
    }
  });
}

// ==================== Actions ====================
function changeQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;

  item.quantity = Math.max(1, item.quantity + delta);
  saveCart(cart);
  renderCart();
}

function removeItem(productId) {
  if (!confirm('این محصول از سبد خرید حذف شود؟')) return;
  removeFromCart(productId);
  showToast('محصول از سبد خرید حذف شد', 'info');
  renderCart();
}

// ==================== Coupon ====================
async function applyCoupon() {
  const input = document.getElementById('couponInput');
  const code = input.value.trim();
  const msg = document.getElementById('couponMsg');

  msg.className = 'coupon-msg';
  msg.textContent = '';

  if (!code) {
    msg.className = 'coupon-msg error';
    msg.textContent = 'کد تخفیف را وارد کنید';
    return;
  }

  const cart = getCart();
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await res.json();

    if (res.ok) {
      appliedCoupon = data;
      sessionStorage.setItem('javadi_coupon', JSON.stringify(data));
      renderCart();
      showToast(`🎉 کد تخفیف اعمال شد – ${fmtPrice(data.discount)} تخفیف`, 'success');
      celebrate();
    } else {
      appliedCoupon = null;
      sessionStorage.removeItem('javadi_coupon');
      msg.className = 'coupon-msg error';
      msg.textContent = '❌ ' + (data.error || 'کد تخفیف نامعتبر است');
    }
  } catch {
    msg.className = 'coupon-msg error';
    msg.textContent = 'خطا در برقراری ارتباط';
  }
}

function removeCoupon() {
  appliedCoupon = null;
  sessionStorage.removeItem('javadi_coupon');
  renderCart();
  showToast('کد تخفیف حذف شد', 'info');
}

// ==================== Init ====================
async function initCart() {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (window.JV.settings && window.JV.settings.site_name) {
        clearInterval(check); resolve();
      }
    }, 50);
  });

  // بازیابی کوپن
  const saved = sessionStorage.getItem('javadi_coupon');
  if (saved) {
    try { appliedCoupon = JSON.parse(saved); } catch {}
  }

  renderCart();

  // به‌روزرسانی بین تب‌ها
  window.addEventListener('storage', e => {
    if (e.key === 'javadi_cart') renderCart();
  });
}

window.addEventListener('DOMContentLoaded', initCart);