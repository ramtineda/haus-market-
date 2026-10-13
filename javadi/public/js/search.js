// ============================================================
// JAVADI 2.0 – جستجوی زنده (Live Search)
// ============================================================

(function () {
  let searchBox = null;
  let resultsBox = null;
  let currentQuery = '';

  function ensureStyles() {
    if (document.getElementById('liveSearchStyles')) return;
    const style = document.createElement('style');
    style.id = 'liveSearchStyles';
    style.textContent = `
      .live-search-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(6px);
        z-index: 3000;
        opacity: 0;
        visibility: hidden;
        transition: all 0.25s var(--ease);
        padding: 80px 20px 20px;
        overflow-y: auto;
      }
      .live-search-overlay.active {
        opacity: 1;
        visibility: visible;
      }
      .live-search-box {
        max-width: 640px;
        margin: 0 auto;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        transform: scale(0.96);
        transition: transform 0.3s var(--ease);
      }
      .live-search-overlay.active .live-search-box {
        transform: scale(1);
      }
      .live-search-input-wrap {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        gap: 12px;
      }
      .live-search-input-wrap .search-icon {
        color: var(--accent);
        font-size: 1.15rem;
      }
      .live-search-input-wrap input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--text);
        font-size: 1.05rem;
        outline: none;
        font-family: inherit;
        padding: 4px 0;
      }
      .live-search-input-wrap input::placeholder {
        color: var(--text-muted);
      }
      .live-search-close {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-dim);
        font-size: 1.2rem;
        transition: all var(--t-fast) var(--ease);
        cursor: pointer;
      }
      .live-search-close:hover {
        background: var(--accent-glow);
        color: var(--accent);
      }
      .live-search-results {
        max-height: 60vh;
        overflow-y: auto;
        padding: 8px 0;
      }
      .live-search-section-title {
        padding: 8px 20px;
        font-size: 0.75rem;
        color: var(--text-muted);
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .live-search-item {
        display: flex;
        gap: 14px;
        align-items: center;
        padding: 12px 20px;
        transition: all var(--t-fast) var(--ease);
        cursor: pointer;
        text-decoration: none;
        color: inherit;
      }
      .live-search-item:hover {
        background: var(--accent-glow);
      }
      .live-search-item img {
        width: 56px;
        height: 56px;
        border-radius: var(--radius);
        object-fit: cover;
        background: var(--bg-3);
        flex-shrink: 0;
      }
      .live-search-item-info {
        flex: 1;
        min-width: 0;
      }
      .live-search-item-name {
        color: var(--text);
        font-size: 0.92rem;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }
      .live-search-item-brand {
        color: var(--accent);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .live-search-item-price {
        color: var(--text);
        font-size: 0.9rem;
        font-weight: 700;
        flex-shrink: 0;
      }
      .live-search-item-price .old {
        color: var(--text-muted);
        text-decoration: line-through;
        font-size: 0.75rem;
        display: block;
        font-weight: 400;
      }
      .live-search-empty {
        padding: 40px 20px;
        text-align: center;
        color: var(--text-dim);
        font-size: 0.9rem;
      }
      .live-search-empty .icon {
        font-size: 2.5rem;
        opacity: 0.3;
        margin-bottom: 12px;
      }
      .live-search-hint {
        padding: 24px 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.85rem;
      }
      .live-search-hint .keys {
        display: inline-flex;
        gap: 6px;
        margin-top: 8px;
      }
      .live-search-hint kbd {
        background: var(--bg-3);
        border: 1px solid var(--border-2);
        border-radius: 4px;
        padding: 2px 8px;
        font-family: inherit;
        font-size: 0.75rem;
        color: var(--text-mid);
      }
    `;
    document.head.appendChild(style);
  }

  function open() {
    ensureStyles();
    if (searchBox) {
      searchBox.classList.add('active');
      setTimeout(() => {
        searchBox.querySelector('input')?.focus();
      }, 100);
      document.body.classList.add('no-scroll');
    }
  }

  function close() {
    if (searchBox) {
      searchBox.classList.remove('active');
      document.body.classList.remove('no-scroll');
      const input = searchBox.querySelector('input');
      if (input) input.value = '';
      currentQuery = '';
      renderResults({ products: [], categories: [] });
    }
  }

  function buildOverlay() {
    ensureStyles();
    if (searchBox) return;

    searchBox = document.createElement('div');
    searchBox.className = 'live-search-overlay';
    searchBox.id = 'liveSearchOverlay';
    searchBox.innerHTML = `
      <div class="live-search-box">
        <div class="live-search-input-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="liveSearchInput" placeholder="جستجوی محصول، برند یا دسته..." autocomplete="off">
          <button class="live-search-close" id="liveSearchClose" aria-label="بستن">✕</button>
        </div>
        <div class="live-search-results" id="liveSearchResults"></div>
      </div>
    `;
    document.body.appendChild(searchBox);

    const input = searchBox.querySelector('#liveSearchInput');
    const closeBtn = searchBox.querySelector('#liveSearchClose');

    input.addEventListener('input', debounce(doSearch, 200));
    closeBtn.addEventListener('click', close);

    searchBox.addEventListener('click', (e) => {
      if (e.target === searchBox) close();
    });

    // ESC برای بستن
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();

      // Ctrl+K یا / برای باز کردن
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !isInputFocused())) {
        e.preventDefault();
        open();
      }
    });

    renderResults({ products: [], categories: [] });
  }

  function isInputFocused() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  }

  async function doSearch() {
    const input = searchBox.querySelector('#liveSearchInput');
    const q = input.value.trim();
    currentQuery = q;

    if (q.length < 2) {
      renderResults({ products: [], categories: [] });
      return;
    }

    const results = searchBox.querySelector('#liveSearchResults');
    results.innerHTML = '<div class="live-search-hint"><div class="spinner"></div>در حال جستجو...</div>';

    try {
      const res = await fetch('/api/search/live?q=' + encodeURIComponent(q));
      const data = await res.json();
      if (currentQuery !== q) return; // نتایج قدیمی رو نمایش نده
      renderResults(data);
    } catch {
      results.innerHTML = '<div class="live-search-empty">خطا در جستجو</div>';
    }
  }

  function renderResults(data) {
    if (!searchBox) return;
    const results = searchBox.querySelector('#liveSearchResults');
    const { products = [], categories = [] } = data;

    if (!currentQuery || currentQuery.length < 2) {
      results.innerHTML = `
        <div class="live-search-hint">
          برای جستجو حداقل ۲ حرف وارد کنید
          <div class="keys">
            <kbd>Ctrl</kbd>+<kbd>K</kbd> یا <kbd>/</kbd> برای باز کردن سریع
          </div>
        </div>
      `;
      return;
    }

    if (!products.length && !categories.length) {
      results.innerHTML = `
        <div class="live-search-empty">
          <div class="icon">🔍</div>
          <p>نتیجه‌ای برای «${esc(currentQuery)}» یافت نشد</p>
        </div>
      `;
      return;
    }

    let html = '';

    if (categories.length) {
      html += `<div class="live-search-section-title">دسته‌بندی‌ها</div>`;
      for (const c of categories) {
        html += `
          <a href="/category/${esc(c.slug)}" class="live-search-item">
            <div style="width:56px;height:56px;background:var(--accent-glow);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${esc(c.icon || '📦')}</div>
            <div class="live-search-item-info">
              <div class="live-search-item-name">${esc(c.name)}</div>
              <div class="live-search-item-brand">دسته‌بندی</div>
            </div>
          </a>
        `;
      }
    }

    if (products.length) {
      html += `<div class="live-search-section-title">محصولات</div>`;
      for (const p of products) {
        const img = p.image || 'https://via.placeholder.com/80/cccccc/ffffff?text=NA';
        const hasOld = p.old_price && p.old_price > p.price;
        html += `
          <a href="/product/${esc(p.slug)}" class="live-search-item">
            <img src="${esc(img)}" alt="" onerror="this.src='https://via.placeholder.com/80/cccccc/ffffff?text=NA'">
            <div class="live-search-item-info">
              <div class="live-search-item-name">${esc(p.name)}</div>
              ${p.brand_name ? `<div class="live-search-item-brand">${esc(p.brand_name)}</div>` : ''}
            </div>
            <div class="live-search-item-price">
              ${fmtPrice(p.price)}
              ${hasOld ? `<span class="old">${fmtPrice(p.old_price)}</span>` : ''}
            </div>
          </a>
        `;
      }
    }

    results.innerHTML = html;
  }

  // ==================== Export ====================
  window.LiveSearch = {
    open: () => { buildOverlay(); open(); },
    close,
    init: () => {
      buildOverlay();
    },
  };

  // Auto init
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => buildOverlay(), 200);
  });
})();