// ============================================================
// JAVADI 2.0 – ارسال ایمیل
// ============================================================
const nodemailer = require('nodemailer');

const ENABLED = process.env.EMAIL_ENABLED === 'true';
let transporter = null;

if (ENABLED) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  transporter.verify()
    .then(() => console.log('✅ اتصال SMTP تایید شد'))
    .catch(err => console.error('❌ خطای SMTP:', err.message));
} else {
  console.log('⚠️  ایمیل غیرفعال – ایمیل‌ها فقط در کنسول لاگ می‌شوند');
}

async function sendMail({ to, subject, html }) {
  if (!ENABLED) {
    console.log('\n📧 [ایمیل – حالت آزمایشی]');
    console.log('   به:      ' + to);
    console.log('   موضوع:   ' + subject);
    console.log('   متن:     ' + html.replace(/<[^>]+>/g, '').slice(0, 200) + '...\n');
    return { demo: true };
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@javadi.ir',
      to, subject, html,
    });
    console.log('📧 ایمیل ارسال شد:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ خطای ارسال ایمیل:', err.message);
    return { error: err.message };
  }
}

function formatPrice(n) {
  return Number(n).toLocaleString('fa-IR') + ' تومان';
}

function orderConfirmationTemplate(order, items) {
  const itemsHtml = items.map(it => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #2a2f3d;color:#f0f2f5;">${it.product_name}</td>
      <td style="padding:12px;border-bottom:1px solid #2a2f3d;text-align:center;color:#f0f2f5;">${it.quantity}</td>
      <td style="padding:12px;border-bottom:1px solid #2a2f3d;text-align:left;color:#e5b869;">${formatPrice(it.subtotal)}</td>
    </tr>
  `).join('');

  return `
    <div dir="rtl" style="font-family:'Vazirmatn',Tahoma,sans-serif;max-width:620px;margin:0 auto;background:#1a1d29;padding:40px;border-radius:12px;color:#f0f2f5;">
      <div style="text-align:center;margin-bottom:30px;">
        <h1 style="font-size:2.5rem;background:linear-gradient(135deg,#e5b869,#ff8c42);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:#e5b869;letter-spacing:6px;margin:0;font-weight:300;">JAVADI</h1>
        <p style="color:#a8b0c2;margin-top:8px;">تایید سفارش شما</p>
      </div>

      <div style="border-top:1px solid #2a2f3d;border-bottom:1px solid #2a2f3d;padding:20px 0;margin:20px 0;">
        <h2 style="color:#f0f2f5;font-weight:400;">${order.full_name} عزیز، متشکریم!</h2>
        <p style="color:#a8b0c2;line-height:1.8;">سفارش شما با شماره <strong style="color:#e5b869;">#${order.id}</strong> با موفقیت پرداخت و تایید شد.</p>
      </div>

      <div style="background:#242938;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #2a2f3d;">
        <p style="margin:8px 0;color:#a8b0c2;"><strong style="color:#e5b869;">شماره سفارش:</strong> #${order.id}</p>
        <p style="margin:8px 0;color:#a8b0c2;"><strong style="color:#e5b869;">پیگیری پرداخت:</strong> ${order.payment_ref_id || 'ثبت نشده'}</p>
        <p style="margin:8px 0;color:#a8b0c2;"><strong style="color:#e5b869;">تاریخ:</strong> ${new Date(order.paid_at || Date.now()).toLocaleString('fa-IR')}</p>
      </div>

      <h3 style="color:#e5b869;font-weight:400;margin-top:30px;">اقلام سفارش</h3>
      <table style="width:100%;border-collapse:collapse;margin-top:15px;">
        <thead>
          <tr style="background:#242938;">
            <th style="padding:12px;text-align:right;color:#e5b869;font-weight:500;">محصول</th>
            <th style="padding:12px;text-align:center;color:#e5b869;font-weight:500;">تعداد</th>
            <th style="padding:12px;text-align:left;color:#e5b869;font-weight:500;">قیمت</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      ${order.discount_amount > 0 ? `
        <p style="text-align:left;color:#4ade80;margin-top:15px;">
          تخفیف (${order.coupon_code}): −${formatPrice(order.discount_amount)}
        </p>
      ` : ''}

      <p style="text-align:left;font-size:1.4rem;color:#e5b869;font-weight:500;margin-top:20px;letter-spacing:1px;">
        مبلغ کل: ${formatPrice(order.total_amount)}
      </p>

      <h3 style="color:#e5b869;font-weight:400;margin-top:35px;">آدرس تحویل</h3>
      <p style="color:#a8b0c2;line-height:2;">
        ${order.full_name}<br>
        ${order.province || ''} – ${order.city || ''}<br>
        ${order.address}<br>
        کد پستی: ${order.postal_code || '-'}<br>
        تلفن: ${order.phone}
      </p>

      <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #2a2f3d;color:#6c7384;font-size:0.85rem;">
        © JAVADI – فروشگاه لوازم خانگی لوکس
      </div>
    </div>
  `;
}

function adminNotificationTemplate(order, items) {
  return `
    <div dir="rtl" style="font-family:'Vazirmatn',Tahoma,sans-serif;max-width:620px;margin:0 auto;background:#1a1d29;padding:40px;border-radius:12px;color:#f0f2f5;">
      <h2 style="color:#e5b869;">🛒 سفارش جدید #${order.id}</h2>
      <p style="color:#a8b0c2;"><strong>مشتری:</strong> ${order.full_name} (${order.email})</p>
      <p style="color:#a8b0c2;"><strong>تلفن:</strong> ${order.phone}</p>
      <p style="color:#a8b0c2;"><strong>آدرس:</strong> ${order.province || ''} – ${order.city || ''}، ${order.address}</p>
      <p style="color:#e5b869;font-size:1.2rem;"><strong>مبلغ کل:</strong> ${formatPrice(order.total_amount)}</p>
      <h3 style="color:#e5b869;margin-top:25px;">اقلام:</h3>
      <ul style="color:#a8b0c2;line-height:1.8;">
        ${items.map(it => `<li>${it.product_name} × ${it.quantity} = ${formatPrice(it.subtotal)}</li>`).join('')}
      </ul>
      <p style="margin-top:25px;">
        <a href="${process.env.BASE_URL}/${process.env.ADMIN_PATH || 'admin'}" style="background:#e5b869;color:#1a1d29;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">ورود به پنل مدیریت</a>
      </p>
    </div>
  `;
}

module.exports = { sendMail, orderConfirmationTemplate, adminNotificationTemplate };