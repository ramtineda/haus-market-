// ============================================================
// JAVADI 2.0 – پنل ادمین کامل
// بخش ۱: Layout, Dashboard, Products, Categories, Brands
// ============================================================

const app = document.getElementById('adminApp');

const adminState = {
  tab: 'dashboard',
  editProductId: null,
  extraImages: [],
  charts: {},
  stats: null,
  chatRoomId: null,
};

// ==================== Utils ====================
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function fp(n) {
  return Number(n || 0).toLocaleString('fa-IR') + ' ت';
}

function toast(msg, type = 'success') {
  let c = document.getElementById('adminToastContainer');
  if (!c) {
    c = document.createElement('div');
    c.id = 'adminToastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || '✓'}</span><span>${esc(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

async function api(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data.error || data || 'خطا در ارتباط');
  return data;
}

const statusLabels = {
  pending: 'در انتظار پرداخت',
  paid: 'پرداخت شده',
  shipped: 'ارسال شده',
  delivered: 'تحویل داده شده',
  cancelled: 'لغو شده',
  failed: 'ناموفق',
};

// ==================== Boot ====================
async function boot() {
  try {
    const check = await api('/api/admin/check');
    if (!check.isAdmin) {
      window.location.href = '/javadi-control/login';
      return;
    }
  } catch {
    window.location.href = '/javadi-control/login';
    return;
  }
  renderLayout();
  window.__notifications?.start();
}

function renderLayout() {
  app.innerHTML = `
    <button class="admin-menu-toggle" id="adminMenuToggle" aria-label="منو">☰</button>

    <div class="admin-layout">
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="admin-sidebar-logo">
          <div class="logo">JAVADI</div>
          <div class="sub">پنل مدیریت</div>
        </div>

        <nav class="admin-nav">
          <button class="admin-nav-item active" data-tab="dashboard">
            <span class="icon">📊</span><span>داشبورد</span>
          </button>
          <button class="admin-nav-item" data-tab="products">
            <span class="icon">📦</span><span>محصولات</span>
            <span class="badge" data-badge="products" style="display:none"></span>
          </button>
          <button class="admin-nav-item" data-tab="categories">
            <span class="icon">🗂</span><span>دسته‌بندی‌ها</span>
          </button>
          <button class="admin-nav-item" data-tab="brands">
            <span class="icon">🏷</span><span>برندها</span>
          </button>
          <button class="admin-nav-item" data-tab="orders">
            <span class="icon">🛒</span><span>سفارشات</span>
            <span class="badge" data-badge="orders" style="display:none"></span>
          </button>
          <button class="admin-nav-item" data-tab="banners">
            <span class="icon">🖼</span><span>بنرها</span>
          </button>
          <button class="admin-nav-item" data-tab="coupons">
            <span class="icon">🎟</span><span>کوپن‌ها</span>
          </button>
          <button class="admin-nav-item" data-tab="messages">
            <span class="icon">✉</span><span>پیام‌ها</span>
            <span class="badge" data-badge="messages" style="display:none"></span>
          </button>
          <button class="admin-nav-item" data-tab="chats">
            <span class="icon">💬</span><span>گفتگوها</span>
            <span class="badge" data-badge="chats" style="display:none"></span>
          </button>
          <button class="admin-nav-item" data-tab="faqs">
            <span class="icon">❓</span><span>سوالات متداول</span>
          </button>
          <button class="admin-nav-item" data-tab="settings">
            <span class="icon">⚙️</span><span>تنظیمات سایت</span>
          </button>
        </nav>

        <div class="admin-sidebar-footer">
          <button class="admin-notif-toggle" id="notifSoundToggle" title="صدای اعلان">
            ${window.__notifications?.isSoundOn?.() ? '🔔' : '🔕'} صدا
          </button>
          <button class="admin-logout" id="adminLogoutBtn">
            <span>⇤</span><span>خروج از حساب</span>
          </button>
        </div>
      </aside>

      <main class="admin-main">
        <div id="adminTabContent"></div>
      </main>
    </div>
  `;

  // Events
  document.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('adminLogoutBtn').addEventListener('click', logout);

  const soundBtn = document.getElementById('notifSoundToggle');
  soundBtn?.addEventListener('click', () => {
    const current = window.__notifications?.isSoundOn?.() ?? true;
    window.__notifications?.setSound(!current);
    soundBtn.innerHTML = (!current ? '🔔' : '🔕') + ' صدا';
    toast(!current ? '🔔 صدای اعلان فعال شد' : '🔕 صدای اعلان غیرفعال شد', 'info');
  });

  // Mobile sidebar
  const toggle = document.getElementById('adminMenuToggle');
  const sidebar = document.getElementById('adminSidebar');
  toggle.addEventListener('click', () => sidebar.classList.toggle('active'));

  document.addEventListener('click', e => {
    if (window.innerWidth <= 992 &&
        !sidebar.contains(e.target) &&
        !toggle.contains(e.target) &&
        sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
    }
  });

  switchTab('dashboard');
}

function switchTab(tab) {
  // Destroy old charts
  Object.values(adminState.charts).forEach(c => { try { c.destroy(); } catch {} });
  adminState.charts = {};

  document.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  adminState.tab = tab;
  document.getElementById('adminSidebar')?.classList.remove('active');

  const renderers = {
    dashboard: renderDashboard,
    products: renderProducts,
    categories: renderCategories,
    brands: renderBrands,
    orders: renderOrders,
    banners: renderBanners,
    coupons: renderCoupons,
    messages: renderMessages,
    chats: renderChats,
    faqs: renderFaqs,
    settings: renderSettings,
  };

  (renderers[tab] || renderDashboard)();
}

async function logout() {
  if (!confirm('از پنل خارج می‌شوید؟')) return;
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/';
}

// ============================================================
// 1. DASHBOARD
// ============================================================
async function renderDashboard() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = '<div class="loading"><div class="spinner"></div>در حال بارگذاری آمار...</div>';

  try {
    const s = await api('/api/admin/stats');
    adminState.stats = s;

    // Update badges
    updateBadge('orders', s.pendingOrders);
    updateBadge('messages', s.unreadMessages);
    updateBadge('chats', s.unreadChats);

    c.innerHTML = `
      <div class="admin-topbar">
        <h1 class="admin-page-title">داشبورد <span class="accent">مدیریت</span></h1>
        <div class="admin-user">🕐 ${new Date().toLocaleString('fa-IR')}</div>
      </div>

      <div class="admin-stats">
        <div class="stat-card success">
          <div class="stat-label">درآمد کل</div>
          <div class="stat-value accent">${fp(s.totalRevenue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">کل سفارشات</div>
          <div class="stat-value">${s.totalOrders.toLocaleString('fa-IR')}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">پرداخت شده</div>
          <div class="stat-value">${s.paidOrders.toLocaleString('fa-IR')}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">در انتظار</div>
          <div class="stat-value">${s.pendingOrders.toLocaleString('fa-IR')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">محصولات</div>
          <div class="stat-value">${s.totalProducts.toLocaleString('fa-IR')}</div>
        </div>
        <div class="stat-card info">
          <div class="stat-label">کاربران</div>
          <div class="stat-value">${s.totalUsers.toLocaleString('fa-IR')}</div>
        </div>
        <div class="stat-card pink">
          <div class="stat-label">دسته‌بندی‌ها</div>
          <div class="stat-value">${s.totalCategories.toLocaleString('fa-IR')}</div>
        </div>
        <div class="stat-card ${s.lowStock > 0 ? 'danger' : ''}">
          <div class="stat-label">موجودی کم</div>
          <div class="stat-value">${s.lowStock.toLocaleString('fa-IR')}</div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3>📈 درآمد ۳۰ روز اخیر</h3>
          <canvas id="chartRevenue"></canvas>
        </div>
        <div class="chart-card">
          <h3>🏆 پرفروش‌ترین محصولات</h3>
          <canvas id="chartTop"></canvas>
        </div>
        <div class="chart-card">
          <h3>🗂 فروش بر اساس دسته</h3>
          <canvas id="chartCategory"></canvas>
        </div>
        <div class="chart-card">
          <h3>📊 وضعیت سفارشات</h3>
          <canvas id="chartStatus"></canvas>
        </div>
      </div>

      <h2 class="section-title" style="text-align:right;font-size:1.35rem;margin-top:40px;">آخرین سفارشات</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>مشتری</th>
              <th>مبلغ</th>
              <th>وضعیت</th>
              <th>تاریخ</th>
            </tr>
          </thead>
          <tbody>
            ${s.recentOrders.length ? s.recentOrders.map(o => `
              <tr>
                <td>#${o.id}</td>
                <td>${esc(o.full_name)}</td>
                <td style="color:var(--accent);font-weight:600">${fp(o.total_amount)}</td>
                <td><span class="order-status status-${o.status}">${statusLabels[o.status] || o.status}</span></td>
                <td>${new Date(o.created_at).toLocaleString('fa-IR')}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-dim)">سفارشی ثبت نشده</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    // Chart.js
    if (!window.Chart) {
      await new Promise(resolve => {
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        sc.onload = resolve;
        document.head.appendChild(sc);
      });
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#a8b0c2' : '#4a5160';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    Chart.defaults.color = textColor;
    Chart.defaults.font.family = 'Vazirmatn, Tahoma, sans-serif';
    Chart.defaults.font.size = 11;

    // Revenue
    adminState.charts.revenue = new Chart(document.getElementById('chartRevenue'), {
      type: 'line',
      data: {
        labels: s.salesByDay.map(d => new Date(d.day).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })),
        datasets: [{
          label: 'درآمد (تومان)',
          data: s.salesByDay.map(d => d.revenue),
          borderColor: '#ff8c42',
          backgroundColor: 'rgba(255, 140, 66, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#ff8c42',
          pointRadius: 0,
          pointHoverRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: gridColor }, ticks: { callback: v => Number(v).toLocaleString('fa-IR') } },
          x: { grid: { display: false } },
        },
      },
    });

    // Top
    adminState.charts.top = new Chart(document.getElementById('chartTop'), {
      type: 'bar',
      data: {
        labels: s.topProducts.map(p => p.product_name.slice(0, 25)),
        datasets: [{
          data: s.topProducts.map(p => p.qty),
          backgroundColor: '#e5b869',
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { color: gridColor }, beginAtZero: true }, y: { grid: { display: false } } },
      },
    });

    // Category
    adminState.charts.cat = new Chart(document.getElementById('chartCategory'), {
      type: 'doughnut',
      data: {
        labels: s.salesByCategory.map(c => c.category || 'سایر'),
        datasets: [{
          data: s.salesByCategory.map(c => c.revenue),
          backgroundColor: ['#e5b869', '#ff8c42', '#4ecdc4', '#7c8cf8', '#ff6b9d', '#4ade80', '#fbbf24'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 10 } } } },
      },
    });

    // Status
    adminState.charts.status = new Chart(document.getElementById('chartStatus'), {
      type: 'polarArea',
      data: {
        labels: s.statusDist.map(x => statusLabels[x.status] || x.status),
        datasets: [{
          data: s.statusDist.map(x => x.count),
          backgroundColor: [
            'rgba(245,158,11,0.7)', 'rgba(34,197,94,0.7)', 'rgba(59,130,246,0.7)',
            'rgba(34,197,94,0.7)', 'rgba(239,68,68,0.7)',
          ],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 10 } } } },
        scales: { r: { grid: { color: gridColor }, ticks: { display: false } } },
      },
    });
  } catch (err) {
    c.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`;
  }
}

function updateBadge(key, count) {
  const el = document.querySelector(`[data-badge="${key}"]`);
  if (!el) return;
  if (count > 0) {
    el.textContent = count.toLocaleString('fa-IR');
    el.style.display = 'inline-flex';
  } else {
    el.style.display = 'none';
  }
}

window.adminRefreshStats = () => {
  if (adminState.tab === 'dashboard') renderDashboard();
};

// ============================================================
// 2. PRODUCTS
// ============================================================
async function renderProducts() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">مدیریت <span class="accent">محصولات</span></h1>
      <button class="btn btn-warm" onclick="openProductForm()">➕ افزودن محصول</button>
    </div>
    <div id="productsListWrap">
      <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
    </div>
  `;
  await loadProductsTable();
}

async function loadProductsTable() {
  const wrap = document.getElementById('productsListWrap');
  try {
    const products = await api('/api/admin/products');

    if (!products.length) {
      wrap.innerHTML = '<p class="loading">محصولی ثبت نشده.</p>';
      return;
    }

    wrap.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>تصویر</th>
              <th>نام</th>
              <th>دسته</th>
              <th>قیمت</th>
              <th>موجودی</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td>
                  <img src="${esc(p.image || 'https://via.placeholder.com/60/e8e1d5/a5abb7?text=NA')}"
                       onerror="this.src='https://via.placeholder.com/60/e8e1d5/a5abb7?text=NA'">
                </td>
                <td>
                  <strong style="color:var(--text)">${esc(p.name)}</strong>
                  <div style="font-size:0.75rem;color:var(--text-dim);margin-top:2px;">${esc(p.brand_name || '—')}</div>
                </td>
                <td>${esc(p.category_name || '—')}</td>
                <td style="color:var(--accent);font-weight:600">${fp(p.price)}</td>
                <td>
                  <span style="color:${p.stock > 5 ? 'var(--success)' : p.stock > 0 ? 'var(--warning)' : 'var(--danger)'};font-weight:600">
                    ${p.stock.toLocaleString('fa-IR')}
                  </span>
                </td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${p.is_active ? '<span class="badge-active">✓ فعال</span>' : '<span class="badge-inactive">غیرفعال</span>'}
                    ${p.featured ? '<span class="badge-featured">⭐ ویژه</span>' : ''}
                    ${p.is_deal ? '<span class="badge-deal">⏰ شگفت‌انگیز</span>' : ''}
                  </div>
                </td>
                <td>
                  <div class="admin-table-actions">
                    <button class="action-btn" onclick="editProduct(${p.id})" title="ویرایش">✏</button>
                    <button class="action-btn danger" onclick="deleteProduct(${p.id})" title="حذف">🗑</button>
                    <a href="/product/${esc(p.slug)}" target="_blank" class="action-btn" title="مشاهده">👁</a>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`;
  }
}

async function openProductForm() {
  adminState.editProductId = null;
  adminState.extraImages = [];
  await showProductModal();
}

async function editProduct(id) {
  try {
    const p = await api('/api/admin/products/' + id);
    adminState.editProductId = id;
    adminState.extraImages = p.images || [];
    await showProductModal(p);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function showProductModal(product = null) {
  const [categories, brands] = await Promise.all([
    api('/api/admin/categories').catch(() => []),
    api('/api/admin/brands').catch(() => []),
  ]);

  const p = product || {};
  let specs = {};
  try { specs = JSON.parse(p.specs || '{}'); } catch {}
  const specsList = Object.entries(specs);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'productModal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:860px">
      <div class="modal-header">
        <h3>${adminState.editProductId ? '✏ ویرایش محصول' : '➕ افزودن محصول'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <form id="productForm">
          <div class="form-row form-grid-2">
            <div class="form-group">
              <label class="form-label">نام محصول *</label>
              <input type="text" class="form-input" name="name" value="${esc(p.name || '')}" required>
            </div>
            <div class="form-group">
              <label class="form-label">دسته‌بندی</label>
              <select class="form-select" name="category_id">
                <option value="">بدون دسته</option>
                ${categories.map(cat => `
                  <option value="${cat.id}" ${p.category_id === cat.id ? 'selected' : ''}>${esc(cat.name)}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-row form-grid-2">
            <div class="form-group">
              <label class="form-label">برند</label>
              <select class="form-select" name="brand_id">
                <option value="">— انتخاب کنید —</option>
                ${brands.map(b => `
                  <option value="${b.id}" ${p.brand_id === b.id ? 'selected' : ''}>${esc(b.name)}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">نام برند (دستی)</label>
              <input type="text" class="form-input" name="brand_name" value="${esc(p.brand_name || '')}">
            </div>
          </div>

          <div class="form-row form-grid-2">
            <div class="form-group">
              <label class="form-label">موجودی</label>
              <input type="number" class="form-input" name="stock" value="${p.stock || 0}" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">قیمت (تومان) *</label>
              <input type="number" class="form-input" name="price" value="${p.price || ''}" required min="0" step="1000">
            </div>
          </div>

          <div class="form-row form-grid-2">
            <div class="form-group">
              <label class="form-label">قیمت قبل از تخفیف</label>
              <input type="number" class="form-input" name="old_price" value="${p.old_price || ''}" min="0" step="1000">
            </div>
            <div class="form-group">
              <label class="form-label">تاریخ پایان شگفت‌انگیز</label>
              <input type="datetime-local" class="form-input" name="deal_ends_at" value="${p.deal_ends_at ? p.deal_ends_at.replace(' ', 'T').slice(0, 16) : ''}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">توضیح کوتاه</label>
            <input type="text" class="form-input" name="short_desc" value="${esc(p.short_desc || '')}">
          </div>

          <div class="form-group">
            <label class="form-label">توضیحات کامل</label>
            <textarea class="form-textarea" name="long_desc" rows="4">${esc(p.long_desc || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">مشخصات فنی (هر خط: کلید|مقدار)</label>
            <textarea class="form-textarea" name="specs_raw" rows="4" placeholder="ظرفیت|۸ کیلوگرم&#10;سرعت|۱۴۰۰ دور">${specsList.map(([k, v]) => `${k}|${v}`).join('\n')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">تصویر اصلی</label>
            <div class="image-upload-row">
              <input type="file" accept="image/*" id="mainImageFile">
              <span class="or">— یا —</span>
              <input type="url" class="form-input" id="mainImageUrl" value="${esc(p.image || '')}" placeholder="آدرس تصویر">
            </div>
            <div class="image-preview" id="mainImagePreview">
              ${p.image ? `<img src="${esc(p.image)}">` : 'تصویری انتخاب نشده'}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">تصاویر اضافی (حداکثر ۸)</label>
            <input type="file" accept="image/*" multiple id="extraImagesFile">
            <div class="preview-grid" id="extraImagesPreview"></div>
          </div>

          <div class="form-row form-grid-3" style="margin-top:16px">
            <label class="checkbox-row">
              <input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}>
              <span>⭐ نمایش در محصولات ویژه</span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="is_new" ${p.is_new ? 'checked' : ''}>
              <span>✨ برچسب جدید</span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="is_deal" ${p.is_deal ? 'checked' : ''}>
              <span>⏰ شگفت‌انگیز</span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="is_active" ${p.is_active !== 0 ? 'checked' : ''}>
              <span>✓ فعال</span>
            </label>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">انصراف</button>
        <button class="btn btn-warm" onclick="saveProduct()">💾 ذخیره محصول</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 10);

  // Events
  const fileInput = document.getElementById('mainImageFile');
  const urlInput = document.getElementById('mainImageUrl');
  const preview = document.getElementById('mainImagePreview');
  const extraInput = document.getElementById('extraImagesFile');
  const extraPreview = document.getElementById('extraImagesPreview');

  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    preview.innerHTML = url
      ? `<img src="${esc(url)}" onerror="this.parentElement.textContent='آدرس نامعتبر'">`
      : 'تصویری انتخاب نشده';
  });

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = e => preview.innerHTML = `<img src="${e.target.result}">`;
    r.readAsDataURL(f);
  });

  extraInput.addEventListener('change', () => {
    Array.from(extraInput.files).forEach(f => {
      const r = new FileReader();
      r.onload = e => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `<img src="${e.target.result}"><button class="remove" type="button">×</button>`;
        div.querySelector('.remove').addEventListener('click', () => div.remove());
        extraPreview.appendChild(div);
      };
      r.readAsDataURL(f);
    });
  });

  // نمایش تصاویر موجود
  adminState.extraImages.forEach((url, i) => {
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.innerHTML = `<img src="${esc(url)}"><button class="remove" type="button" onclick="removeExtraImage(${i}, this)">×</button>`;
    extraPreview.appendChild(div);
  });
}

function removeExtraImage(index, btn) {
  adminState.extraImages.splice(index, 1);
  btn.closest('.preview-item').remove();
}

function closeModal() {
  const m = document.querySelector('.modal-overlay.active');
  if (!m) return;
  m.classList.remove('active');
  setTimeout(() => m.remove(), 300);
}

async function saveProduct() {
  const form = document.getElementById('productForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const fd = new FormData(form);

  // Main image
  let imageUrl = document.getElementById('mainImageUrl').value.trim();
  const mainFile = document.getElementById('mainImageFile').files[0];
  if (mainFile) {
    const upd = new FormData();
    upd.append('image', mainFile);
    try {
      const r = await api('/api/admin/upload', { method: 'POST', body: upd });
      imageUrl = r.url;
    } catch (err) { return toast('خطا در آپلود تصویر اصلی', 'error'); }
  }

  // Extra images
  let extraUrls = [...adminState.extraImages];
  const extraFiles = document.getElementById('extraImagesFile').files;
  if (extraFiles.length) {
    const upd = new FormData();
    for (const f of extraFiles) upd.append('images', f);
    try {
      const r = await api('/api/admin/upload-multi', { method: 'POST', body: upd });
      extraUrls = extraUrls.concat(r.urls);
    } catch (err) { return toast('خطا در آپلود تصاویر', 'error'); }
  }

  // Specs
  const specsObj = {};
  (fd.get('specs_raw') || '').split('\n').forEach(line => {
    const idx = line.indexOf('|');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && v) specsObj[k] = v;
    }
  });

  // Brand name from select
  let brandName = fd.get('brand_name') || '';
  if (!brandName && fd.get('brand_id')) {
    const sel = form.querySelector('[name="brand_id"]');
    brandName = sel.options[sel.selectedIndex]?.text || '';
  }

  const payload = {
    name: fd.get('name'),
    category_id: fd.get('category_id') ? parseInt(fd.get('category_id')) : null,
    brand_id: fd.get('brand_id') ? parseInt(fd.get('brand_id')) : null,
    brand_name: brandName,
    stock: fd.get('stock'),
    price: fd.get('price'),
    old_price: fd.get('old_price'),
    deal_ends_at: fd.get('deal_ends_at') || null,
    short_desc: fd.get('short_desc'),
    long_desc: fd.get('long_desc'),
    specs: JSON.stringify(specsObj),
    image: imageUrl,
    extra_images: extraUrls,
    featured: fd.get('featured') === 'on',
    is_new: fd.get('is_new') === 'on',
    is_deal: fd.get('is_deal') === 'on',
    is_active: fd.get('is_active') === 'on',
  };

  try {
    if (adminState.editProductId) {
      await api('/api/admin/products/' + adminState.editProductId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    toast('✓ محصول ذخیره شد');
    closeModal();
    loadProductsTable();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('این محصول حذف شود؟')) return;
  try {
    await api('/api/admin/products/' + id, { method: 'DELETE' });
    toast('✓ محصول حذف شد');
    loadProductsTable();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// 3. CATEGORIES
// ============================================================
async function renderCategories() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">مدیریت <span class="accent">دسته‌بندی‌ها</span></h1>
      <button class="btn btn-warm" onclick="openCategoryForm()">➕ دسته جدید</button>
    </div>
    <div id="categoriesListWrap">
      <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
    </div>
  `;
  await loadCategoriesList();
}

async function loadCategoriesList() {
  const wrap = document.getElementById('categoriesListWrap');
  try {
    const cats = await api('/api/admin/categories');
    if (!cats.length) { wrap.innerHTML = '<p class="loading">دسته‌ای ثبت نشده.</p>'; return; }

    wrap.innerHTML = `
      <div class="admin-list">
        ${cats.map(cat => `
          <div class="admin-item">
            <div class="admin-item-info">
              <div style="width:56px;height:56px;background:var(--accent-glow);color:var(--accent);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.75rem;flex-shrink:0">
                ${esc(cat.icon || '📦')}
              </div>
              <div>
                <h4>${esc(cat.name)} ${cat.is_active ? '' : '<span style="color:var(--text-dim);font-size:0.75rem">(غیرفعال)</span>'}</h4>
                <small>${cat.product_count.toLocaleString('fa-IR')} محصول • ترتیب: ${cat.sort_order.toLocaleString('fa-IR')}</small>
              </div>
            </div>
            <div class="admin-table-actions">
              <button class="action-btn" onclick='openCategoryForm(${JSON.stringify(cat).replace(/'/g, "&#39;")})'>✏</button>
              <button class="action-btn danger" onclick="deleteCategory(${cat.id})">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) { wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`; }
}

async function openCategoryForm(cat = null) {
  const isEdit = !!cat;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3>${isEdit ? '✏ ویرایش دسته' : '➕ دسته جدید'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">نام دسته *</label>
          <input type="text" class="form-input" id="catName" value="${esc(cat?.name || '')}" required>
        </div>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">آیکون (ایموجی)</label>
            <input type="text" class="form-input" id="catIcon" value="${esc(cat?.icon || '📦')}" maxlength="4">
          </div>
          <div class="form-group">
            <label class="form-label">ترتیب</label>
            <input type="number" class="form-input" id="catSort" value="${cat?.sort_order || 0}">
          </div>
        </div>
        <label class="checkbox-row" style="margin-top:8px">
          <input type="checkbox" id="catActive" ${cat?.is_active !== 0 ? 'checked' : ''}>
          <span>فعال</span>
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">انصراف</button>
        <button class="btn btn-warm" onclick="saveCategory(${cat?.id || 'null'})">💾 ذخیره</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 10);
}

async function saveCategory(id) {
  const payload = {
    name: document.getElementById('catName').value.trim(),
    icon: document.getElementById('catIcon').value.trim(),
    sort_order: document.getElementById('catSort').value,
    is_active: document.getElementById('catActive').checked,
  };
  if (!payload.name) return toast('نام دسته الزامی است', 'error');

  try {
    if (id) {
      await api('/api/admin/categories/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    toast('✓ ذخیره شد');
    closeModal();
    loadCategoriesList();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteCategory(id) {
  if (!confirm('این دسته حذف شود؟ محصولات بدون دسته خواهند شد.')) return;
  try {
    await api('/api/admin/categories/' + id, { method: 'DELETE' });
    toast('✓ حذف شد');
    loadCategoriesList();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// 4. BRANDS
// ============================================================
async function renderBrands() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">مدیریت <span class="accent">برندها</span></h1>
      <button class="btn btn-warm" onclick="openBrandForm()">➕ برند جدید</button>
    </div>
    <div id="brandsListWrap">
      <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
    </div>
  `;
  await loadBrandsList();
}

async function loadBrandsList() {
  const wrap = document.getElementById('brandsListWrap');
  try {
    const brands = await api('/api/admin/brands');
    if (!brands.length) { wrap.innerHTML = '<p class="loading">برندی ثبت نشده.</p>'; return; }

    wrap.innerHTML = `
      <div class="admin-list">
        ${brands.map(b => `
          <div class="admin-item">
            <div class="admin-item-info">
              <div style="width:56px;height:56px;background:var(--bg-3);color:var(--accent);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;flex-shrink:0;letter-spacing:1px">
                ${esc((b.name || '?').slice(0, 3).toUpperCase())}
              </div>
              <div>
                <h4>${esc(b.name)} ${b.is_active ? '' : '<span style="color:var(--text-dim);font-size:0.75rem">(غیرفعال)</span>'}</h4>
                <small>${b.product_count ? b.product_count.toLocaleString('fa-IR') + ' محصول' : 'بدون محصول'} • ترتیب: ${b.sort_order.toLocaleString('fa-IR')}</small>
              </div>
            </div>
            <div class="admin-table-actions">
              <button class="action-btn" onclick='openBrandForm(${JSON.stringify(b).replace(/'/g, "&#39;")})'>✏</button>
              <button class="action-btn danger" onclick="deleteBrand(${b.id})">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) { wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`; }
}

async function openBrandForm(brand = null) {
  const isEdit = !!brand;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3>${isEdit ? '✏ ویرایش برند' : '➕ برند جدید'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">نام برند *</label>
          <input type="text" class="form-input" id="brandName" value="${esc(brand?.name || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">توضیحات (اختیاری)</label>
          <textarea class="form-textarea" id="brandDesc" rows="2">${esc(brand?.description || '')}</textarea>
        </div>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">ترتیب</label>
            <input type="number" class="form-input" id="brandSort" value="${brand?.sort_order || 0}">
          </div>
          <label class="checkbox-row" style="margin-top:28px">
            <input type="checkbox" id="brandActive" ${brand?.is_active !== 0 ? 'checked' : ''}>
            <span>فعال</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">انصراف</button>
        <button class="btn btn-warm" onclick="saveBrand(${brand?.id || 'null'})">💾 ذخیره</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 10);
}

async function saveBrand(id) {
  const payload = {
    name: document.getElementById('brandName').value.trim(),
    description: document.getElementById('brandDesc').value.trim(),
    sort_order: document.getElementById('brandSort').value,
    is_active: document.getElementById('brandActive').checked,
  };
  if (!payload.name) return toast('نام برند الزامی است', 'error');

  try {
    if (id) {
      await api('/api/admin/brands/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    toast('✓ ذخیره شد');
    closeModal();
    loadBrandsList();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteBrand(id) {
  if (!confirm('این برند حذف شود؟')) return;
  try {
    await api('/api/admin/brands/' + id, { method: 'DELETE' });
    toast('✓ حذف شد');
    loadBrandsList();
  } catch (err) { toast(err.message, 'error'); }
}
// ============================================================
// 5. ORDERS
// ============================================================
async function renderOrders() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">مدیریت <span class="accent">سفارشات</span></h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" onclick="exportOrdersCSV()">📥 خروجی CSV</button>
      </div>
    </div>
    <div id="ordersListWrap">
      <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
    </div>
  `;
  await loadOrdersList();
}

async function loadOrdersList() {
  const wrap = document.getElementById('ordersListWrap');
  try {
    const orders = await api('/api/admin/orders');
    if (!orders.length) { wrap.innerHTML = '<p class="loading">سفارشی ثبت نشده.</p>'; return; }

    wrap.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-id">سفارش #${o.id}</div>
            <div class="order-date">${new Date(o.created_at).toLocaleString('fa-IR')}</div>
            <div class="order-customer">
              <strong>${esc(o.full_name)}</strong> • ${esc(o.email)} • ${esc(o.phone)}<br>
              <span style="color:var(--text-dim);font-size:0.85rem">${esc(o.province || '')} – ${esc(o.city || '')}، ${esc(o.address)}</span>
            </div>
          </div>
          <div style="text-align:left">
            <span class="order-status status-${o.status}">${statusLabels[o.status] || o.status}</span>
            <div style="font-size:1.2rem;font-weight:700;color:var(--accent);margin-top:8px">
              ${fp(o.total_amount)}
            </div>
            ${o.coupon_code ? `<div style="font-size:0.78rem;color:var(--success)">🎟 کوپن: ${esc(o.coupon_code)}</div>` : ''}
            ${o.payment_ref_id ? `<div style="font-size:0.78rem;color:var(--text-dim)">پیگیری: ${esc(o.payment_ref_id)}</div>` : ''}
          </div>
        </div>
        <div class="order-items-list">
          ${o.items.map(it => `
            <div class="order-item">
              <img src="${esc(it.product_image || 'https://via.placeholder.com/50/e8e1d5/a5abb7?text=NA')}"
                   onerror="this.src='https://via.placeholder.com/50/e8e1d5/a5abb7?text=NA'">
              <div class="order-item-info">
                <strong>${esc(it.product_name)}</strong>
                <small>${fp(it.unit_price)} × ${it.quantity.toLocaleString('fa-IR')}</small>
              </div>
              <span class="order-item-price">${fp(it.subtotal)}</span>
            </div>
          `).join('')}
        </div>
        <div class="order-footer">
          <div class="order-total">
            <strong>${fp(o.total_amount)}</strong>
          </div>
          <div class="order-actions">
            <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
              <option value="">تغییر وضعیت...</option>
              ${Object.entries(statusLabels).map(([k, v]) =>
                `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
            <a href="/api/admin/orders/${o.id}/invoice" target="_blank" class="btn btn-outline btn-small">🖨 فاکتور</a>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) { wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`; }
}

async function updateOrderStatus(id, status) {
  if (!status) return;
  try {
    await api('/api/admin/orders/' + id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    toast('✓ وضعیت بروزرسانی شد');
    loadOrdersList();
  } catch (err) { toast(err.message, 'error'); }
}

async function exportOrdersCSV() {
  try {
    const orders = await api('/api/admin/orders');
    const rows = [
      ['شماره', 'مشتری', 'ایمیل', 'تلفن', 'استان', 'شهر', 'آدرس', 'مبلغ', 'وضعیت', 'تاریخ'],
    ];
    orders.forEach(o => {
      rows.push([
        o.id,
        o.full_name,
        o.email,
        o.phone,
        o.province || '',
        o.city || '',
        o.address,
        o.total_amount,
        statusLabels[o.status] || o.status,
        new Date(o.created_at).toLocaleString('fa-IR'),
      ]);
    });
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `javadi-orders-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✓ خروجی CSV دانلود شد');
  } catch (err) { toast(err.message, 'error'); }
}

window.adminRefreshOrders = () => {
  if (adminState.tab === 'orders') loadOrdersList();
};

// ============================================================
// 6. BANNERS
// ============================================================
async function renderBanners() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">مدیریت <span class="accent">بنرها</span></h1>
      <button class="btn btn-warm" onclick="openBannerForm()">➕ بنر جدید</button>
    </div>
    <div id="bannersListWrap">
      <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
    </div>
  `;
  await loadBannersList();
}

async function loadBannersList() {
  const wrap = document.getElementById('bannersListWrap');
  try {
    const banners = await api('/api/admin/banners');
    if (!banners.length) { wrap.innerHTML = '<p class="loading">بنری ثبت نشده.</p>'; return; }

    wrap.innerHTML = `<div class="admin-list">
      ${banners.map(b => `
        <div class="admin-item">
          <div class="admin-item-info">
            <img src="${esc(b.image)}" onerror="this.style.display='none'"
                 style="width:140px;height:70px;object-fit:cover;border-radius:8px;flex-shrink:0">
            <div>
              <h4>${esc(b.title || '(بدون عنوان)')}</h4>
              <small>${esc(b.subtitle || '')}</small>
              <small style="display:block;margin-top:4px">
                ${b.is_active ? '<span style="color:var(--success)">● فعال</span>' : '<span style="color:var(--danger)">● غیرفعال</span>'}
                • ترتیب: ${b.sort_order}
              </small>
            </div>
          </div>
          <div class="admin-table-actions">
            <button class="action-btn" onclick='openBannerForm(${JSON.stringify(b).replace(/'/g, "&#39;")})'>✏</button>
            <button class="action-btn danger" onclick="deleteBanner(${b.id})">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  } catch (err) { wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`; }
}

function openBannerForm(banner = null) {
  const isEdit = !!banner;
  const b = banner || {};
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="modal-header">
        <h3>${isEdit ? '✏ ویرایش بنر' : '➕ بنر جدید'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">عنوان</label>
          <input type="text" class="form-input" id="bTitle" value="${esc(b.title || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">زیرعنوان</label>
          <input type="text" class="form-input" id="bSubtitle" value="${esc(b.subtitle || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">تصویر بنر *</label>
          <div class="image-upload-row">
            <input type="file" accept="image/*" id="bannerFile">
            <span class="or">— یا —</span>
            <input type="url" class="form-input" id="bannerUrl" value="${esc(b.image || '')}" placeholder="آدرس تصویر">
          </div>
          <div class="image-preview" id="bannerPreview" style="height:180px">
            ${b.image ? `<img src="${esc(b.image)}">` : 'تصویری انتخاب نشده'}
          </div>
        </div>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">لینک</label>
            <input type="text" class="form-input" id="bLink" value="${esc(b.link || '/products')}">
          </div>
          <div class="form-group">
            <label class="form-label">متن دکمه</label>
            <input type="text" class="form-input" id="bBtn" value="${esc(b.btn_text || 'مشاهده')}">
          </div>
        </div>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">ترتیب</label>
            <input type="number" class="form-input" id="bSort" value="${b.sort_order || 0}">
          </div>
          <label class="checkbox-row" style="margin-top:28px">
            <input type="checkbox" id="bActive" ${b.is_active !== 0 ? 'checked' : ''}>
            <span>فعال</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">انصراف</button>
        <button class="btn btn-warm" onclick="saveBanner(${b.id || 'null'})">💾 ذخیره</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 10);

  const fileInput = document.getElementById('bannerFile');
  const urlInput = document.getElementById('bannerUrl');
  const preview = document.getElementById('bannerPreview');

  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    preview.innerHTML = url
      ? `<img src="${esc(url)}" onerror="this.parentElement.textContent='آدرس نامعتبر'">`
      : 'تصویری انتخاب نشده';
  });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = e => preview.innerHTML = `<img src="${e.target.result}">`;
    r.readAsDataURL(f);
  });
}

async function saveBanner(id) {
  let imageUrl = document.getElementById('bannerUrl').value.trim();
  const file = document.getElementById('bannerFile').files[0];
  if (file) {
    const upd = new FormData();
    upd.append('image', file);
    try {
      const r = await api('/api/admin/upload', { method: 'POST', body: upd });
      imageUrl = r.url;
    } catch { return toast('خطا در آپلود', 'error'); }
  }
  if (!imageUrl) return toast('تصویر بنر الزامی است', 'error');

  const payload = {
    title: document.getElementById('bTitle').value,
    subtitle: document.getElementById('bSubtitle').value,
    image: imageUrl,
    link: document.getElementById('bLink').value,
    btn_text: document.getElementById('bBtn').value,
    sort_order: document.getElementById('bSort').value,
    is_active: document.getElementById('bActive').checked,
  };

  try {
    if (id) {
      await api('/api/admin/banners/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/admin/banners', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    toast('✓ ذخیره شد');
    closeModal();
    loadBannersList();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteBanner(id) {
  if (!confirm('این بنر حذف شود؟')) return;
  try {
    await api('/api/admin/banners/' + id, { method: 'DELETE' });
    toast('✓ حذف شد');
    loadBannersList();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// 7. COUPONS
// ============================================================
async function renderCoupons() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">مدیریت <span class="accent">کوپن‌ها</span></h1>
      <button class="btn btn-warm" onclick="openCouponForm()">➕ کوپن جدید</button>
    </div>
    <div id="couponsListWrap">
      <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
    </div>
  `;
  await loadCouponsList();
}

async function loadCouponsList() {
  const wrap = document.getElementById('couponsListWrap');
  try {
    const coupons = await api('/api/admin/coupons');
    if (!coupons.length) { wrap.innerHTML = '<p class="loading">کوپنی ثبت نشده.</p>'; return; }

    wrap.innerHTML = `<div class="admin-list">
      ${coupons.map(cp => `
        <div class="admin-item">
          <div class="admin-item-info">
            <div style="width:60px;height:60px;background:var(--accent-glow);color:var(--accent);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.75rem;flex-shrink:0">🎟</div>
            <div>
              <h4>${esc(cp.code)} <span class="coupon-tag" style="background:${cp.active ? 'var(--success)' : 'var(--text-dim)'}">${cp.active ? 'فعال' : 'غیرفعال'}</span></h4>
              <small>
                ${cp.type === 'percent' ? `${cp.value}٪ تخفیف` : `${fp(cp.value)} تخفیف`}
                • حداقل: ${fp(cp.min_purchase)}
                • استفاده: ${cp.used_count}${cp.max_uses ? '/' + cp.max_uses : ''}
                ${cp.expires_at ? ' • انقضا: ' + new Date(cp.expires_at).toLocaleDateString('fa-IR') : ''}
              </small>
            </div>
          </div>
          <div class="admin-table-actions">
            <button class="action-btn" onclick="toggleCoupon(${cp.id}, ${cp.active ? 0 : 1})">${cp.active ? '🚫' : '✓'}</button>
            <button class="action-btn danger" onclick="deleteCoupon(${cp.id})">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  } catch (err) { wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`; }
}

function openCouponForm() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <h3>➕ کوپن جدید</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">کد کوپن *</label>
            <input type="text" class="form-input" id="cCode" placeholder="WELCOME20" style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label class="form-label">نوع *</label>
            <select class="form-select" id="cType">
              <option value="percent">درصدی (٪)</option>
              <option value="fixed">مبلغ ثابت (تومان)</option>
            </select>
          </div>
        </div>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">مقدار *</label>
            <input type="number" class="form-input" id="cValue" min="1" step="1">
          </div>
          <div class="form-group">
            <label class="form-label">حداقل خرید (تومان)</label>
            <input type="number" class="form-input" id="cMin" value="0" step="1000">
          </div>
        </div>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">حداکثر استفاده (۰=نامحدود)</label>
            <input type="number" class="form-input" id="cMax" value="0">
          </div>
          <div class="form-group">
            <label class="form-label">تاریخ انقضا</label>
            <input type="datetime-local" class="form-input" id="cExp">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">انصراف</button>
        <button class="btn btn-warm" onclick="saveCoupon()">💾 ذخیره</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 10);
}

async function saveCoupon() {
  const code = document.getElementById('cCode').value.trim();
  const type = document.getElementById('cType').value;
  const value = document.getElementById('cValue').value;
  if (!code || !value) return toast('کد و مقدار الزامی است', 'error');

  const payload = {
    code, type, value,
    min_purchase: document.getElementById('cMin').value,
    max_uses: document.getElementById('cMax').value,
    expires_at: document.getElementById('cExp').value || null,
  };

  try {
    await api('/api/admin/coupons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    toast('✓ کوپن ایجاد شد');
    closeModal();
    loadCouponsList();
  } catch (err) { toast(err.message, 'error'); }
}

async function toggleCoupon(id, active) {
  try {
    await api('/api/admin/coupons/' + id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    toast('✓ بروزرسانی شد');
    loadCouponsList();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteCoupon(id) {
  if (!confirm('این کوپن حذف شود؟')) return;
  try {
    await api('/api/admin/coupons/' + id, { method: 'DELETE' });
    toast('✓ حذف شد');
    loadCouponsList();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// 8. MESSAGES
// ============================================================
async function renderMessages() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">پیام‌های <span class="accent">تماس</span></h1>
    </div>
    <div id="messagesListWrap">
      <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
    </div>
  `;
  await loadMessagesList();
}

async function loadMessagesList() {
  const wrap = document.getElementById('messagesListWrap');
  try {
    const messages = await api('/api/admin/messages');
    if (!messages.length) { wrap.innerHTML = '<p class="loading">پیامی ثبت نشده.</p>'; return; }

    wrap.innerHTML = `<div class="admin-list">
      ${messages.map(m => `
        <div class="admin-item" style="align-items:flex-start;${m.is_read ? '' : 'border-right:4px solid var(--accent)'}">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px">
              <div>
                <strong style="color:var(--accent);font-size:1rem">${esc(m.name)}</strong>
                ${!m.is_read ? '<span class="coupon-tag" style="background:var(--warning);margin-right:6px">جدید</span>' : ''}
              </div>
              <small style="color:var(--text-dim)">${new Date(m.created_at).toLocaleString('fa-IR')}</small>
            </div>
            <div style="color:var(--text-dim);font-size:0.85rem;margin-bottom:10px">
              ${m.email ? `✉ ${esc(m.email)}` : ''}
              ${m.phone ? ` • 📞 ${esc(m.phone)}` : ''}
              ${m.subject ? ` • موضوع: ${esc(m.subject)}` : ''}
            </div>
            <p style="color:var(--text-mid);line-height:1.9;font-size:0.92rem">${esc(m.message)}</p>
          </div>
          <div class="admin-table-actions" style="flex-direction:column">
            ${!m.is_read ? `<button class="action-btn" onclick="markMessageRead(${m.id})" title="علامت خوانده‌شده">✓</button>` : ''}
            <button class="action-btn danger" onclick="deleteMessage(${m.id})" title="حذف">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  } catch (err) { wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`; }
}

async function markMessageRead(id) {
  try {
    await api('/api/admin/messages/' + id + '/read', { method: 'PUT' });
    loadMessagesList();
    updateBadge('messages', 0);
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteMessage(id) {
  if (!confirm('این پیام حذف شود؟')) return;
  try {
    await api('/api/admin/messages/' + id, { method: 'DELETE' });
    toast('✓ حذف شد');
    loadMessagesList();
  } catch (err) { toast(err.message, 'error'); }
}

window.adminRefreshMessages = () => {
  if (adminState.tab === 'messages') loadMessagesList();
};

// ============================================================
// 9. CHATS
// ============================================================
async function renderChats() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">پشتیبانی <span class="accent">چت</span></h1>
    </div>
    <div class="chat-admin-layout">
      <div class="chat-rooms-list" id="chatRoomsList">
        <div class="loading" style="padding:30px"><div class="spinner"></div></div>
      </div>
      <div class="chat-admin-window" id="chatAdminWindow">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-dim);padding:40px;text-align:center;flex-direction:column;gap:12px">
          <div style="font-size:3rem;opacity:0.3">💬</div>
          <p>یک گفتگو را از لیست انتخاب کنید</p>
        </div>
      </div>
    </div>
  `;
  await loadChatRooms();
}

async function loadChatRooms() {
  const wrap = document.getElementById('chatRoomsList');
  try {
    const rooms = await api('/api/admin/chat/rooms');
    if (!rooms.length) {
      wrap.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-dim)">هیچ گفتگویی وجود ندارد</div>';
      return;
    }

    wrap.innerHTML = rooms.map(r => `
      <div class="chat-room-item ${adminState.chatRoomId === r.id ? 'active' : ''}" onclick="openChatRoom(${r.id})">
        ${r.unread_admin > 0 ? '<span class="unread-dot"></span>' : ''}
        <div class="name">${esc(r.user_name || r.guest_name || 'مهمان')}</div>
        <div class="last-msg">${esc((r.last_message || '').slice(0, 40))}${(r.last_message || '').length > 40 ? '...' : ''}</div>
        <div class="time">${new Date(r.last_message_at).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `).join('');
  } catch (err) {
    wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`;
  }
}

async function openChatRoom(id) {
  adminState.chatRoomId = id;
  document.querySelectorAll('.chat-room-item').forEach(el => el.classList.remove('active'));

  const win = document.getElementById('chatAdminWindow');
  win.innerHTML = '<div class="loading" style="padding:40px"><div class="spinner"></div></div>';

  try {
    const data = await api('/api/admin/chat/rooms/' + id);
    const { room, messages } = data;

    win.innerHTML = `
      <div class="chat-admin-header">
        <div>
          <strong style="color:var(--text)">${esc(room.user_name || room.guest_name || 'مهمان')}</strong>
          <small style="color:var(--text-dim);display:block;margin-top:2px;font-size:0.78rem">
            شروع: ${new Date(room.created_at).toLocaleString('fa-IR')}
          </small>
        </div>
        <button class="action-btn danger" onclick="deleteChatRoom(${room.id})" title="حذف گفتگو">🗑</button>
      </div>
      <div class="chat-messages" id="adminChatMessages">
        ${messages.length ? messages.map(m => `
          <div class="chat-msg ${m.sender}">
            ${esc(m.message)}
            <span class="time">${new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        `).join('') : '<div style="text-align:center;color:var(--text-dim);padding:30px">هنوز پیامی رد و بدل نشده</div>'}
      </div>
      <div class="chat-admin-input">
        <input type="text" id="adminChatInput" placeholder="پاسخ خود را بنویسید..." autocomplete="off">
        <button onclick="sendAdminReply(${room.id})">ارسال</button>
      </div>
    `;

    // اسکرول به پایین
    setTimeout(() => {
      const msgs = document.getElementById('adminChatMessages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 100);

    // Enter برای ارسال
    const input = document.getElementById('adminChatInput');
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendAdminReply(room.id);
      }
    });
    input.focus();
  } catch (err) {
    win.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`;
  }
}

async function sendAdminReply(roomId) {
  const input = document.getElementById('adminChatInput');
  const text = input.value.trim();
  if (!text) return;

  input.disabled = true;

  try {
    await api(`/api/admin/chat/rooms/${roomId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    input.value = '';
    await openChatRoom(roomId);
    await loadChatRooms();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

async function deleteChatRoom(id) {
  if (!confirm('این گفتگو حذف شود؟')) return;
  try {
    await api('/api/admin/chat/rooms/' + id, { method: 'DELETE' });
    adminState.chatRoomId = null;
    toast('✓ حذف شد');
    loadChatRooms();
    document.getElementById('chatAdminWindow').innerHTML = `
      <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-dim);padding:40px;text-align:center;flex-direction:column;gap:12px">
        <div style="font-size:3rem;opacity:0.3">💬</div>
        <p>یک گفتگو را از لیست انتخاب کنید</p>
      </div>
    `;
  } catch (err) { toast(err.message, 'error'); }
}

window.adminRefreshChats = () => {
  if (adminState.tab === 'chats') loadChatRooms();
};

// ============================================================
// 10. FAQS
// ============================================================
async function renderFaqs() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = `
    <div class="admin-topbar">
      <h1 class="admin-page-title">سوالات <span class="accent">متداول</span></h1>
      <button class="btn btn-warm" onclick="openFaqForm()">➕ سوال جدید</button>
    </div>
    <div id="faqsListWrap">
      <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
    </div>
  `;
  await loadFaqsList();
}

async function loadFaqsList() {
  const wrap = document.getElementById('faqsListWrap');
  try {
    const faqs = await api('/api/admin/faqs');
    if (!faqs.length) { wrap.innerHTML = '<p class="loading">سوالی ثبت نشده.</p>'; return; }

    wrap.innerHTML = `<div class="admin-list">
      ${faqs.map(f => `
        <div class="admin-item" style="align-items:flex-start">
          <div style="flex:1">
            <h4 style="margin-bottom:10px;color:var(--text);font-size:0.95rem">❓ ${esc(f.question)}</h4>
            <p style="color:var(--text-dim);font-size:0.88rem;line-height:1.9">${esc(f.answer)}</p>
            <small style="color:var(--text-muted);display:block;margin-top:8px;font-size:0.75rem">
              ترتیب: ${f.sort_order} • ${f.is_active ? '<span style="color:var(--success)">فعال</span>' : '<span style="color:var(--danger)">غیرفعال</span>'}
            </small>
          </div>
          <div class="admin-table-actions" style="flex-direction:column">
            <button class="action-btn" onclick='openFaqForm(${JSON.stringify(f).replace(/'/g, "&#39;")})'>✏</button>
            <button class="action-btn danger" onclick="deleteFaq(${f.id})">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  } catch (err) { wrap.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`; }
}

function openFaqForm(faq = null) {
  const isEdit = !!faq;
  const f = faq || {};
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="modal-header">
        <h3>${isEdit ? '✏ ویرایش سوال' : '➕ سوال جدید'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">سوال *</label>
          <input type="text" class="form-input" id="fQuestion" value="${esc(f.question || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">پاسخ *</label>
          <textarea class="form-textarea" id="fAnswer" rows="4">${esc(f.answer || '')}</textarea>
        </div>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">ترتیب</label>
            <input type="number" class="form-input" id="fSort" value="${f.sort_order || 0}">
          </div>
          <label class="checkbox-row" style="margin-top:28px">
            <input type="checkbox" id="fActive" ${f.is_active !== 0 ? 'checked' : ''}>
            <span>فعال</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">انصراف</button>
        <button class="btn btn-warm" onclick="saveFaq(${f.id || 'null'})">💾 ذخیره</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 10);
}

async function saveFaq(id) {
  const question = document.getElementById('fQuestion').value.trim();
  const answer = document.getElementById('fAnswer').value.trim();
  if (!question || !answer) return toast('سوال و پاسخ الزامی است', 'error');

  const payload = {
    question, answer,
    sort_order: document.getElementById('fSort').value,
    is_active: document.getElementById('fActive').checked,
  };

  try {
    if (id) {
      await api('/api/admin/faqs/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/admin/faqs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    toast('✓ ذخیره شد');
    closeModal();
    loadFaqsList();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteFaq(id) {
  if (!confirm('این سوال حذف شود؟')) return;
  try {
    await api('/api/admin/faqs/' + id, { method: 'DELETE' });
    toast('✓ حذف شد');
    loadFaqsList();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// 11. SETTINGS
// ============================================================
async function renderSettings() {
  const c = document.getElementById('adminTabContent');
  c.innerHTML = '<div class="loading"><div class="spinner"></div>در حال بارگذاری تنظیمات...</div>';

  try {
    const s = await api('/api/admin/settings');

    c.innerHTML = `
      <div class="admin-topbar">
        <h1 class="admin-page-title">تنظیمات <span class="accent">سایت</span></h1>
        <button class="btn btn-warm" onclick="saveSettings()">💾 ذخیره تغییرات</button>
      </div>

      <div class="admin-form-wrap" style="max-width:100%">
        <h3>🏪 اطلاعات فروشگاه</h3>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">نام سایت</label>
            <input type="text" class="form-input" data-setting="site_name" value="${esc(s.site_name || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">شعار سایت</label>
            <input type="text" class="form-input" data-setting="site_tagline" value="${esc(s.site_tagline || '')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">توضیحات سایت</label>
          <textarea class="form-textarea" data-setting="site_description" rows="2">${esc(s.site_description || '')}</textarea>
        </div>

        <h3 style="margin-top:32px">🏠 بخش هیرو (صفحه اصلی)</h3>
        <div class="form-group">
          <label class="form-label">عنوان اصلی</label>
          <input type="text" class="form-input" data-setting="hero_title" value="${esc(s.hero_title || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">زیرعنوان</label>
          <input type="text" class="form-input" data-setting="hero_subtitle" value="${esc(s.hero_subtitle || '')}">
        </div>

        <h3 style="margin-top:32px">📞 اطلاعات تماس</h3>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">تلفن</label>
            <input type="text" class="form-input" data-setting="contact_phone" value="${esc(s.contact_phone || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">ایمیل</label>
            <input type="email" class="form-input" data-setting="contact_email" value="${esc(s.contact_email || '')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">آدرس</label>
          <input type="text" class="form-input" data-setting="contact_address" value="${esc(s.contact_address || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">ساعت کاری</label>
          <input type="text" class="form-input" data-setting="contact_hours" value="${esc(s.contact_hours || '')}">
        </div>

        <h3 style="margin-top:32px">🌐 شبکه‌های اجتماعی</h3>
        <div class="form-row form-grid-2">
          <div class="form-group">
            <label class="form-label">اینستاگرام</label>
            <input type="url" class="form-input" data-setting="social_instagram" value="${esc(s.social_instagram || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">تلگرام</label>
            <input type="url" class="form-input" data-setting="social_telegram" value="${esc(s.social_telegram || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">واتساپ</label>
            <input type="url" class="form-input" data-setting="social_whatsapp" value="${esc(s.social_whatsapp || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">یوتیوب</label>
            <input type="url" class="form-input" data-setting="social_youtube" value="${esc(s.social_youtube || '')}">
          </div>
        </div>

        <h3 style="margin-top:32px">📄 درباره ما</h3>
        <div class="form-group">
          <label class="form-label">عنوان صفحه</label>
          <input type="text" class="form-input" data-setting="about_title" value="${esc(s.about_title || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">متن درباره ما</label>
          <textarea class="form-textarea" data-setting="about_content" rows="5">${esc(s.about_content || '')}</textarea>
        </div>

        <h3 style="margin-top:32px">🦶 فوتر</h3>
        <div class="form-group">
          <label class="form-label">متن پایین فوتر</label>
          <input type="text" class="form-input" data-setting="footer_text" value="${esc(s.footer_text || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">درباره کوتاه (زیر لوگو در فوتر)</label>
          <textarea class="form-textarea" data-setting="footer_about" rows="2">${esc(s.footer_about || '')}</textarea>
        </div>

        <h3 style="margin-top:32px">🎨 تم پیش‌فرض</h3>
        <div class="form-group">
          <label class="form-label">حالت پیش‌فرض سایت</label>
          <select class="form-select" data-setting="default_theme">
            <option value="light" ${s.default_theme === 'light' ? 'selected' : ''}>☀️ روز</option>
            <option value="dark" ${s.default_theme === 'dark' ? 'selected' : ''}>🌙 شب</option>
          </select>
        </div>
      </div>
    `;
  } catch (err) {
    c.innerHTML = `<div class="loading">❌ ${esc(err.message)}</div>`;
  }
}

async function saveSettings() {
  const updates = {};
  document.querySelectorAll('[data-setting]').forEach(el => {
    updates[el.dataset.setting] = el.value;
  });

  try {
    await api('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    toast('✓ تنظیمات ذخیره شد. برای مشاهده، صفحه سایت را رفرش کنید.');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ==================== BOOT ====================
window.addEventListener('DOMContentLoaded', boot);