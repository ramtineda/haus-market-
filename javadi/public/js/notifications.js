// ============================================================
// JAVADI 2.0 – اعلان‌های Real-time پنل ادمین (SSE)
// ============================================================
(function () {
  let eventSource = null;
  let reconnectDelay = 2000;
  let soundEnabled = localStorage.getItem('javadi_notif_sound') !== 'off';

  // ==================== Sound (بدون فایل) ====================
  function playDing() {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;

      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.1 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
      });
      setTimeout(() => ctx.close(), 900);
    } catch {}
  }

  // ==================== UI ====================
  function showNotification(type, title, message) {
    let container = document.getElementById('adminToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.id = 'adminToastContainer';
      document.body.appendChild(container);
    }

    const icons = {
      'new-order': '🛒',
      'order-paid': '💰',
      'new-message': '✉',
      'new-chat': '💬',
      'test': '🔔',
    };

    const colors = {
      'new-order': 'var(--orange)',
      'order-paid': 'var(--success)',
      'new-message': 'var(--info)',
      'new-chat': 'var(--accent)',
      'test': 'var(--purple)',
    };

    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.style.borderRightColor = colors[type] || 'var(--accent)';
    toast.style.borderRightWidth = '5px';
    toast.style.padding = '16px 20px';
    toast.style.minWidth = '320px';

    toast.innerHTML = `
      <span class="toast-icon" style="font-size:1.5rem">${icons[type] || '🔔'}</span>
      <div style="flex:1">
        <div style="font-weight:700;margin-bottom:6px;font-size:0.95rem">${title}</div>
        <div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5">${message}</div>
      </div>
    `;
    container.appendChild(toast);

    // Auto remove after 8 seconds
    const timer = setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 8000);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    });

    playDing();
  }

  // ==================== SSE Connection ====================
  function connect() {
    if (eventSource) eventSource.close();

    eventSource = new EventSource('/api/notifications/stream');

    eventSource.addEventListener('connected', () => {
      console.log('🔔 اعلان‌های Real-time متصل شد');
      reconnectDelay = 2000;
    });

    eventSource.addEventListener('new-order', e => {
      const d = JSON.parse(e.data);
      showNotification(
        'new-order',
        '🛒 سفارش جدید!',
        `#${d.id} از ${d.customer} – ${Number(d.total).toLocaleString('fa-IR')} تومان (${d.itemCount} قلم)`
      );
      // رفرش لیست سفارشات اگر بازه
      if (window.adminRefreshOrders) window.adminRefreshOrders();
      if (window.adminRefreshStats) window.adminRefreshStats();
    });

    eventSource.addEventListener('order-paid', e => {
      const d = JSON.parse(e.data);
      showNotification(
        'order-paid',
        '💰 پرداخت موفق',
        `سفارش #${d.id} پرداخت شد. کد پیگیری: ${d.refId}`
      );
      if (window.adminRefreshOrders) window.adminRefreshOrders();
      if (window.adminRefreshStats) window.adminRefreshStats();
    });

    eventSource.addEventListener('new-message', e => {
      const d = JSON.parse(e.data);
      showNotification(
        'new-message',
        '✉ پیام جدید',
        `از طرف ${d.name}${d.subject ? ' – ' + d.subject : ''}`
      );
      if (window.adminRefreshMessages) window.adminRefreshMessages();
      if (window.adminRefreshStats) window.adminRefreshStats();
    });

    eventSource.addEventListener('new-chat', e => {
      const d = JSON.parse(e.data);
      showNotification(
        'new-chat',
        '💬 پیام چت جدید',
        `${d.userName}: ${d.message.slice(0, 60)}${d.message.length > 60 ? '...' : ''}`
      );
      if (window.adminRefreshChats) window.adminRefreshChats();
      if (window.adminRefreshStats) window.adminRefreshStats();
    });

    eventSource.onerror = () => {
      console.warn('🔔 اتصال SSE قطع شد، تلاش مجدد...');
      eventSource.close();
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };
  }

  // ==================== Public API ====================
  window.__notifications = {
    start: connect,
    stop: () => eventSource && eventSource.close(),
    setSound: (on) => {
      soundEnabled = on;
      localStorage.setItem('javadi_notif_sound', on ? 'on' : 'off');
    },
    isSoundOn: () => soundEnabled,
  };
})();