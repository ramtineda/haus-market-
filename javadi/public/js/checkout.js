// ============================================================
// JAVADI 2.0 – صفحه چک‌اوت
// ============================================================

let appliedCoupon = null;

function renderEmptyCheckout() {
  document.getElementById('checkoutContent').innerHTML = `
    <div class="empty-cart">
      <span class="empty-cart-icon">🛍</span>
      <h2>سبد خرید شما خالی است</h2>
      <p>برای تکمیل خرید ابتدا محصولی به سبد اضافه کنید</p>
      <a href="/products" class="btn btn-warm btn-large">شروع خرید</a>
    </div>
  `;
}

async function renderCheckout() {
  const cart = getCart();
  const wrap = document.getElementById('checkoutContent');

  if (cart.length === 0) return renderEmptyCheckout();

  const user = window.JV.user || {};
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.type === 'percent'
      ? (subtotal * appliedCoupon.value) / 100
      : appliedCoupon.value;
    discount = Math.min(discount, subtotal);
  }

  const total = subtotal - discount;

  wrap.innerHTML = `
    <div class="checkout-layout">
      <!-- فرم -->
      <div class="checkout-form-box">
        <form id="checkoutForm" novalidate>
          <div class="checkout-section-title">
            <span class="step-num">۱</span>
            <span>اطلاعات گیرنده</span>
          </div>

          <div class="checkout-form-grid">
            <div class="form-group full">
              <label class="form-label" for="full_name">نام و نام خانوادگی <span class="required">*</span></label>
              <input type="text" class="form-input" id="full_name" name="full_name"
                     value="${esc(user.full_name || '')}"
                     placeholder="مثلاً علی رضایی" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="email">ایمیل <span class="required">*</span></label>
              <input type="email" class="form-input" id="email" name="email"
                     value="${esc(user.email || '')}"
                     placeholder="example@email.com" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="phone">تلفن همراه <span class="required">*</span></label>
              <input type="tel" class="form-input" id="phone" name="phone"
                     value="${esc(user.phone || '')}"
                     placeholder="۰۹۱۲۳۴۵۶۷۸۹" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="province">استان</label>
              <input type="text" class="form-input" id="province" name="province"
                     value="${esc(user.province || '')}" placeholder="مثلاً تهران">
            </div>

            <div class="form-group">
              <label class="form-label" for="city">شهر</label>
              <input type="text" class="form-input" id="city" name="city"
                     value="${esc(user.city || '')}" placeholder="مثلاً تهران">
            </div>

            <div class="form-group full">
              <label class="form-label" for="address">آدرس کامل <span class="required">*</span></label>
              <textarea class="form-textarea" id="address" name="address" rows="3"
                        placeholder="خیابان، کوچه، پلاک، واحد" required>${esc(user.address || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="postal_code">کد پستی</label>
              <input type="text" class="form-input" id="postal_code" name="postal_code"
                     value="${esc(user.postal_code || '')}" placeholder="۱۰ رقم">
            </div>
          </div>
        </form>
      </div>

      <!-- خلاصه -->
      <aside class="checkout-summary">
        <h3>🧾 خلاصه سفارش</h3>

        <div class="checkout-items">
          ${cart.map(item => {
            const img = item.image || 'https://via.placeholder.com/100/e8e1d5/a5abb7?text=NA';
            return `
              <div class="checkout-item">
                <div class="checkout-item-img">
                  <img src="${esc(img)}" alt=""
                       onerror="this.src='https://via.placeholder.com/100/e8e1d5/a5abb7?text=NA'">
                  <span class="checkout-item-qty">${item.quantity.toLocaleString('fa-IR')}</span>
                </div>
                <div class="checkout-item-info">
                  <div class="name">${esc(item.name)}</div>
                  <div class="unit">${fmtPrice(item.price)}</div>
                </div>
                <div class="checkout-item-price">${fmtPrice(item.price * item.quantity)}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="checkout-totals">
          <div class="checkout-total-row">
            <span>جمع کل</span>
            <span class="value">${fmtPrice(subtotal)}</span>
          </div>

          ${appliedCoupon ? `
            <div class="checkout-total-row discount">
              <span>تخفیف (${esc(appliedCoupon.code)})</span>
              <span class="value">−${fmtPrice(discount)}</span>
            </div>
          ` : ''}

          <div class="checkout-total-row">
            <span>هزینه ارسال</span>
            <span class="value" style="color:var(--text-dim);font-weight:400">پس از تماس</span>
          </div>

          <div class="checkout-total-row grand">
            <span>قابل پرداخت</span>
            <span class="value">${fmtPrice(total)}</span>
          </div>
        </div>

        <button type="button" class="btn btn-warm checkout-submit" id="submitBtn">
          <span>🔒</span>
          انتقال به درگاه پرداخت
        </button>

        <div class="checkout-note">
          <span class="ico">ℹ</span>
          <span>پس از کلیک، به درگاه امن زرین‌پال منتقل می‌شوید و پس از پرداخت موفق، سفارش شما ثبت خواهد شد.</span>
        </div>
      </aside>
    </div>
  `;

  document.getElementById('submitBtn').addEventListener('click', submitOrder);
}

async function submitOrder() {
  const form = document.getElementById('checkoutForm');

  // اعتبارسنجی دستی
  const full_name = document.getElementById('full_name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();

  if (!full_name) { showToast('نام و نام خانوادگی الزامی است', 'error'); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('ایمیل صحیح وارد کنید', 'error'); return; }
  if (!phone) { showToast('شماره تماس الزامی است', 'error'); return; }
  if (!address || address.length < 10) { showToast('آدرس کامل را وارد کنید', 'error'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle"></span> در حال پردازش...';

  const cart = getCart();
  const payload = {
    full_name,
    email,
    phone,
    province: document.getElementById('province').value.trim(),
    city: document.getElementById('city').value.trim(),
    address,
    postal_code: document.getElementById('postal_code').value.trim(),
    coupon_code: appliedCoupon ? appliedCoupon.code : null,
    items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'خطا در ثبت سفارش');

    // پاک کردن سبد
    localStorage.removeItem('javadi_cart');
    sessionStorage.removeItem('javadi_coupon');
    JV.updateCartBadge();

    // ذخیره اطلاعات کاربر برای دفعه بعد
    localStorage.setItem('javadi_last_info', JSON.stringify({
      full_name, email, phone,
      province: payload.province,
      city: payload.city,
      address,
      postal_code: payload.postal_code,
    }));

    btn.innerHTML = '🔒 در حال انتقال به درگاه پرداخت...';
    window.location.href = data.paymentUrl;
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<span>🔒</span> انتقال به درگاه پرداخت';
  }
}

async function initCheckout() {
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

  // اگه کاربر لاگین نیست ولی اطلاعات قبلی داره
  if (!window.JV.user) {
    const lastInfo = localStorage.getItem('javadi_last_info');
    if (lastInfo) {
      try {
        const info = JSON.parse(lastInfo);
        window.JV.user = info;
      } catch {}
    }
  }

  renderCheckout();
}

window.addEventListener('DOMContentLoaded', initCheckout);