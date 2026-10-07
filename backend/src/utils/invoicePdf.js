const PDFDocument = require('pdfkit');
const { invoiceStatus } = require('./status');

// The built-in PDF font has no rupee glyph, so amounts are printed as "Rs.".
const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function streamInvoicePdf(res, invoice, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  const left = 40;
  const right = 555;

  doc.font('Helvetica-Bold').fontSize(20).text(settings.businessName || 'NAVRANG TYRES', left, 40);
  doc.font('Helvetica').fontSize(9).fillColor('#444');
  if (settings.address) doc.text(settings.address, left, 64, { width: 280 });
  const contact = [settings.phone && `Phone: ${settings.phone}`, settings.email && `Email: ${settings.email}`].filter(Boolean).join('  |  ');
  if (contact) doc.text(contact, left, doc.y, { width: 300 });
  if (invoice.isGst && settings.gstin) doc.text(`GSTIN: ${settings.gstin}`, left, doc.y, { width: 300 });

  doc.fillColor('#000').font('Helvetica-Bold').fontSize(14).text(invoice.isGst ? 'TAX INVOICE' : 'INVOICE', 380, 40, { width: right - 380, align: 'right' });
  doc.font('Helvetica').fontSize(9)
    .text(`Invoice No: ${invoice.invoiceNumber}`, 380, 62, { width: right - 380, align: 'right' })
    .text(`Invoice Date: ${dateText(invoice.invoiceDate)}`, 380, 76, { width: right - 380, align: 'right' })
    .text(`Payment Status: ${invoiceStatus(invoice)}`, 380, 90, { width: right - 380, align: 'right' });

  let y = Math.max(doc.y, 110) + 12;
  doc.moveTo(left, y).lineTo(right, y).strokeColor('#bbb').stroke();
  y += 10;

  const c = invoice.customer;
  doc.font('Helvetica-Bold').fontSize(10).text('Bill To', left, y);
  doc.font('Helvetica').fontSize(9).text([c.name, `Mobile: ${c.phone}`, c.email && `Email: ${c.email}`, c.address, c.gstin && `GSTIN: ${c.gstin}`].filter(Boolean).join('\n'), left, y + 14, { width: 260 });
  const afterCustomer = doc.y;
  if (invoice.vehicle) {
    doc.font('Helvetica-Bold').fontSize(10).text('Vehicle', 320, y);
    doc.font('Helvetica').fontSize(9).text([`Number: ${invoice.vehicle.vehicleNumber}`, invoice.vehicle.model && `Model: ${invoice.vehicle.model}`, invoice.vehicle.vehicleType && `Type: ${invoice.vehicle.vehicleType}`].filter(Boolean).join('\n'), 320, y + 14, { width: 230 });
  }
  y = Math.max(afterCustomer, doc.y) + 14;

  const cols = [
    { label: 'S.No', x: 40, w: 28 },
    { label: 'Product', x: 68, w: 150 },
    { label: 'Brand', x: 218, w: 65 },
    { label: 'Model', x: 283, w: 65 },
    { label: 'Tyre Size', x: 348, w: 65 },
    { label: 'Qty', x: 413, w: 30, align: 'right' },
    { label: 'Price', x: 443, w: 55, align: 'right' },
    { label: 'Total', x: 498, w: 57, align: 'right' },
  ];
  const header = () => {
    doc.rect(left, y, right - left, 18).fill('#111827');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5);
    cols.forEach((col) => doc.text(col.label, col.x + 2, y + 5, { width: col.w - 4, align: col.align || 'left' }));
    doc.fillColor('#000');
    y += 22;
  };
  header();

  doc.font('Helvetica').fontSize(8.5);
  invoice.items.forEach((item, idx) => {
    if (y > 740) { doc.addPage(); y = 40; header(); doc.font('Helvetica').fontSize(8.5); }
    const p = item.product || {};
    const cells = [String(idx + 1), p.name || '-', p.brand || '-', p.pattern || '-', p.size || '-', String(item.quantity), money(item.rate), money(item.amount)];
    const rowHeight = Math.max(...cells.map((t, i) => doc.heightOfString(t, { width: cols[i].w - 4 }))) + 6;
    cells.forEach((t, i) => doc.text(t, cols[i].x + 2, y, { width: cols[i].w - 4, align: cols[i].align || 'left' }));
    y += rowHeight;
    doc.moveTo(left, y - 3).lineTo(right, y - 3).strokeColor('#e5e7eb').stroke();
  });

  // Totals, payment info, terms and footer are one block: measure it, and move it to a new page if it cannot fit whole.
  const PAGE_BOTTOM = doc.page.height - 40;
  const rows = [['Subtotal', invoice.subtotal], ['Discount', -invoice.discount], ['Taxable Amount', invoice.taxableAmount]];
  if (invoice.isGst) {
    if (invoice.cgst > 0) rows.push(['CGST', invoice.cgst]);
    if (invoice.sgst > 0) rows.push(['SGST', invoice.sgst]);
    if (invoice.igst > 0) rows.push(['IGST', invoice.igst]);
  }
  rows.push(['Grand Total', invoice.grandTotal], ['Amount Paid', invoice.paidAmount], ['Balance Amount', invoice.dueAmount]);
  const ROW_H = 14;
  const totalsH = rows.length * ROW_H;

  const method = invoice.sale?.paymentMethod || (invoice.payments || [])[0]?.method;
  const leftLines = [`Payment Status: ${invoiceStatus(invoice)}`];
  if (method) leftLines.push(`Payment Method: ${method}`);
  if (invoice.dueDate && invoice.dueAmount > 0) leftLines.push(`Due Date: ${dateText(invoice.dueDate)}`);
  if (invoice.sale?.notes) leftLines.push(`Notes: ${invoice.sale.notes}`);
  const leftText = leftLines.join('\n');
  const termsText = settings.invoiceTerms ? `Terms: ${settings.invoiceTerms}` : '';
  const leftWidth = 290;
  doc.font('Helvetica').fontSize(9);
  const leftH = doc.heightOfString(leftText, { width: leftWidth });
  doc.fontSize(8);
  const termsH = termsText ? doc.heightOfString(termsText, { width: leftWidth }) + 4 : 0;
  const footerText = settings.footerText || '';
  const footerH = 30;
  const blockH = Math.max(totalsH, leftH + termsH) + footerH;

  y += 8;
  if (y + blockH > PAGE_BOTTOM) { doc.addPage(); y = 40; }
  const blockTop = y;

  rows.forEach(([label, value]) => {
    const bold = ['Grand Total', 'Balance Amount'].includes(label);
    if (label === 'Grand Total') doc.moveTo(360, y - 1).lineTo(right, y - 1).strokeColor('#111827').lineWidth(1).stroke();
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9).fillColor('#000');
    doc.text(label, 360, y + 2, { width: 100, lineBreak: false });
    doc.text(value < 0 ? `- ${money(-value)}` : money(value), 460, y + 2, { width: 95, align: 'right', lineBreak: false });
    y += ROW_H;
  });

  doc.font('Helvetica').fontSize(9).fillColor('#000').text(leftText, left, blockTop, { width: leftWidth });
  if (termsText) doc.fontSize(8).fillColor('#666').text(termsText, left, blockTop + leftH + 4, { width: leftWidth });

  const footerY = blockTop + Math.max(totalsH, leftH + termsH) + 10;
  doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor('#bbb').lineWidth(0.5).stroke();
  doc.fillColor('#000').font('Helvetica').fontSize(8);
  doc.text(footerText, left, footerY + 6, { width: 330, lineBreak: false });
  doc.text('Authorized Signature', 400, footerY + 6, { width: right - 400, align: 'right', lineBreak: false });

  doc.end();
}

module.exports = { streamInvoicePdf };
