// ============================================================
// JAVADI 2.0 – چت با پشتیبانی
// ============================================================

let chatRoom = null;
let chatMessages = [];
let lastMessageId = 0;
let pollInterval = null;
let isSending = false;

const SUGGESTIONS = [
  'سلام، می‌خواهم مشاوره بگیرم',
  'سفارشم را چطور پیگیری کنم؟',
  'هزینه ارسال چقدر است؟',
  'گارانتی محصولات چطور است؟',
];

// ==================== Render Welcome ====================
function renderWelcome() {
  const wrap = document.getElementById('chatMessages');
  wrap.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">👋</div>
      <h4>سلام! خوش آمدید به JAVADI</h4>
      <p>چطور می‌توانیم به شما کمک کنیم؟<br>پیام خود را بنویسید یا از سوالات پیشنهادی استفاده کنید.</p>
      <div class="chat-suggestions">
        ${SUGGESTIONS.map(s => `
          <button class="chat-suggestion" onclick="sendSuggestion('${s.replace(/'/g, "&#39;")}')">
            ${esc(s)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// ==================== Render Messages ====================
function renderMessages() {
  const wrap = document.getElementById('chatMessages');

  if (!chatMessages.length) return renderWelcome();

  wrap.innerHTML = chatMessages.map(m => `
    <div class="chat-msg ${m.sender}">
      ${esc(m.message)}
      <span class="time">${formatTime(m.created_at)}</span>
    </div>
  `).join('');

  scrollToBottom();
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60) return 'همین الان';
  if (diff < 3600) return `${Math.floor(diff / 60).toLocaleString('fa-IR')} دقیقه پیش`;

  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  const wrap = document.getElementById('chatMessages');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

// ==================== Load Messages ====================
async function loadMessages(silent = false) {
  try {
    const res = await fetch('/api/chat/room');
    const data = await res.json();

    if (data && data.room && data.messages) {
      chatRoom = data.room;
      chatMessages = data.messages;

      // فقط اگه پیام جدید اومده، رندر کن
      const newLastId = chatMessages.length ? chatMessages[chatMessages.length - 1].id : 0;
      if (newLastId !== lastMessageId || !silent) {
        lastMessageId = newLastId;
        renderMessages();
      }
    } else {
      renderWelcome();
    }
  } catch (err) {
    console.error('خطا در بارگذاری پیام‌ها:', err);
  }
}

// ==================== Send Message ====================
async function sendMessage(text) {
  if (!text || !text.trim() || isSending) return;

  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');

  isSending = true;
  btn.disabled = true;

  const user = window.JV.user;
  const payload = {
    message: text.trim(),
    guest_name: user?.full_name || 'مهمان',
    guest_email: user?.email || '',
  };

  // نمایش فوری پیام کاربر (optimistic)
  const tempMsg = {
    id: 'temp-' + Date.now(),
    sender: 'user',
    message: text.trim(),
    created_at: new Date().toISOString(),
  };
  chatMessages.push(tempMsg);
  renderMessages();

  try {
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('خطا در ارسال پیام');

    input.value = '';
    // بعد از ارسال، لیست رو دوباره لود کن
    setTimeout(() => loadMessages(false), 300);
  } catch (err) {
    showToast('خطا در ارسال پیام', 'error');
    chatMessages.pop(); // حذف پیام موقت
    renderMessages();
  } finally {
    isSending = false;
    btn.disabled = false;
    input.focus();
  }
}

function sendSuggestion(text) {
  const input = document.getElementById('chatInput');
  input.value = text;
  sendMessage(text);
}

// ==================== Clear History ====================
async function clearChatHistory() {
  if (!confirm('تاریخچه گفتگو پاک شود؟')) return;
  // فقط پیام‌های نمایش را پاک می‌کنیم (سرور تاریخی نگه می‌دارد)
  chatMessages = [];
  renderWelcome();
  showToast('صفحه گفتگو پاک شد', 'info');
}

// ==================== Init ====================
async function initChat() {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (window.JV.settings && window.JV.settings.site_name) {
        clearInterval(check); resolve();
      }
    }, 50);
  });

  // نمایش شماره تماس
  const phone = window.JV.settings?.contact_phone;
  if (phone) {
    const el = document.getElementById('chatPhone');
    if (el) el.textContent = phone;
  }

  // بارگذاری اولیه
  await loadMessages();

  // Polling هر ۵ ثانیه
  pollInterval = setInterval(() => loadMessages(true), 5000);

  // ارسال پیام
  document.getElementById('chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    sendMessage(input.value);
  });

  // Enter برای ارسال
  document.getElementById('chatInput').addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('chatForm').requestSubmit();
    }
  });

  // پاک کردن interval در زمان خروج
  window.addEventListener('beforeunload', () => {
    if (pollInterval) clearInterval(pollInterval);
  });
}

// Cleanup
window.addEventListener('pagehide', () => {
  if (pollInterval) clearInterval(pollInterval);
});

window.addEventListener('DOMContentLoaded', initChat);