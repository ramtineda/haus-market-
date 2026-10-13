// ============================================================
// JAVADI 2.0 – فاکتور PDF
// ============================================================
const PDFDocument = require('pdfkit');

const SITE_NAME = 'JAVADI';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function formatPrice(n) {
  return Number(n).toLocaleString('en-US') + ' T';
}

function streamInvoice(order, items, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="javadi-invoice-${order.id}.pdf"`);

  doc.pipe(res);

  // ==================== هدر ====================
  doc.rect(0, 0, doc.page.width, 100).fill('#1a1d29');

  doc.fillColor('#e5b869').fontSize(28).font('Helvetica-Bold')
     .text('JAVADI', 50, 35, { characterSpacing: 4 });
  doc.fillColor('#a8b0c2').fontSize(9).font('Helvetica')
     .text('LUXURY HOME & KITCHEN APPLIANCES', 50, 70, { characterSpacing: 2 });
  doc.fillColor('#e5b869').fontSize(20).font('Helvetica-Bold')
     .text('INVOICE', 0, 45, { align: 'right', width: doc.page.width - 50 });

  // خط طلایی (گرادیانت شبیه)
  doc.rect(0, 100, doc.page.width, 2).fill('#e5b869');

  // ==================== اطلاعات ====================
  doc.fillColor('#333333');
  const infoY = 140;

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#e5b869');
  doc.text('BILL TO', 50, infoY);
  doc.font('Helvetica').fillColor('#333333');
  doc.text(order.full_name, 50, infoY + 18);
  doc.text(order.email, 50, infoY + 33);
  doc.text(order.phone, 50, infoY + 48);
  doc.text(order.address, 50, infoY + 63, { width: 220 });
  doc.text(`${order.province || ''} - ${order.city || ''}`, 50, infoY + 98);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#e5b869');
  doc.text('ORDER DETAILS', 380, infoY);
  doc.font('Helvetica').fillColor('#333333');
  doc.text(`Invoice #: JV-${String(order.id).padStart(5, '0')}`, 380, infoY + 18);
  doc.text(`Order ID: #${order.id}`, 380, infoY + 33);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString('en-GB')}`, 380, infoY + 48);
  doc.text(`Status: ${order.status.toUpperCase()}`, 380, infoY + 63);
  if (order.payment_ref_id) doc.text(`Ref: ${order.payment_ref_id}`, 380, infoY + 78);

  // ==================== جدول ====================
  const tableTop = 310;
  const col1 = 50, col2 = 310, col3 = 370, col4 = 440;

  doc.rect(50, tableTop, doc.page.width - 100, 28).fill('#1a1d29');
  doc.fillColor('#e5b869').fontSize(10).font('Helvetica-Bold');
  doc.text('PRODUCT', col1 + 8, tableTop + 10, { width: 250 });
  doc.text('QTY', col2, tableTop + 10, { width: 50, align: 'center' });
  doc.text('PRICE', col3 - 20, tableTop + 10, { width: 80, align: 'right' });
  doc.text('SUBTOTAL', col4 - 20, tableTop + 10, { width: 80, align: 'right' });

  let y = tableTop + 38;
  doc.font('Helvetica').fontSize(10).fillColor('#333333');

  for (const item of items) {
    if (y > 700) { doc.addPage(); y = 50; }
    const name = item.product_name.length > 45
      ? item.product_name.slice(0, 42) + '...'
      : item.product_name;

    doc.text(name, col1 + 8, y, { width: 250 });
    doc.text(String(item.quantity), col2, y, { width: 50, align: 'center' });
    doc.text(formatPrice(item.unit_price), col3 - 20, y, { width: 80, align: 'right' });
    doc.text(formatPrice(item.subtotal), col4 - 20, y, { width: 80, align: 'right' });
    y += 24;
    doc.strokeColor('#e0e0e0').lineWidth(0.5).moveTo(50, y - 8).lineTo(doc.page.width - 50, y - 8).stroke();
  }

  // ==================== مجموع ====================
  y += 15;
  const totalsX = 320;
  const totalsValueX = 440;

  if (order.discount_amount > 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#666666');
    doc.text('Subtotal:', totalsX, y);
    doc.text(formatPrice(order.subtotal), totalsValueX - 20, y, { align: 'right', width: 100 });
    y += 20;
    doc.fillColor('#4ade80');
    doc.text(`Discount (${order.coupon_code || 'Coupon'}):`, totalsX, y);
    doc.text('-' + formatPrice(order.discount_amount), totalsValueX - 20, y, { align: 'right', width: 100 });
    y += 20;
  }

  doc.rect(totalsX - 10, y - 2, 240, 36).fill('#1a1d29');
  doc.rect(totalsX - 10, y - 2, 240, 36).stroke('#e5b869');
  doc.fillColor('#e5b869').font('Helvetica-Bold').fontSize(14);
  doc.text('TOTAL:', totalsX + 5, y + 9);
  doc.text(formatPrice(order.total_amount), totalsValueX - 20, y + 9, { align: 'right', width: 100 });

  // ==================== فوتر ====================
  const footerY = doc.page.height - 100;
  doc.strokeColor('#e5b869').lineWidth(1).moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).stroke();
  doc.font('Helvetica').fontSize(9).fillColor('#888888');
  doc.text('Thank you for choosing JAVADI', 50, footerY + 15, { align: 'center', width: doc.page.width - 100 });
  doc.fillColor('#e5b869').text('JAVADI | Luxury Home & Kitchen Appliances', 50, footerY + 32, { align: 'center', width: doc.page.width - 100 });
  doc.fillColor('#888888').text(`${BASE_URL} | info@javadi.ir`, 50, footerY + 49, { align: 'center', width: doc.page.width - 100 });

  doc.end();
}

module.exports = { streamInvoice };