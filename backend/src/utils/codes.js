const prisma = require('../lib/prisma');

async function nextSequence(entity, prefix, dateField = true) {
  const year = new Date().getFullYear();
  const count = await entity();
  const num = String(count + 1).padStart(6, '0');
  return dateField ? `${prefix}-${year}-${num}` : `${prefix}-${num}`;
}

async function generateCustomerCode() {
  const year = new Date().getFullYear();
  const count = await prisma.customer.count();
  return `CUS-${year}-${String(count + 1).padStart(6, '0')}`;
}

// Next number = highest existing sequence for the year + 1, so cancelled/removed rows never cause reuse.
async function generateInvoiceNumber(prefix = 'INV') {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;
  const existing = await prisma.invoice.findMany({ where: { invoiceNumber: { startsWith: base } }, select: { invoiceNumber: true } });
  const max = existing.reduce((m, i) => Math.max(m, parseInt(i.invoiceNumber.slice(base.length), 10) || 0), 0);
  return `${base}${String(max + 1).padStart(4, '0')}`;
}

// Highest existing number + 1, so a deleted or gap row never causes a repeated code.
async function generateSupplierCode() {
  const rows = await prisma.supplier.findMany({ where: { supplierCode: { startsWith: 'SUP-' } }, select: { supplierCode: true } });
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.supplierCode.slice(4), 10) || 0), 0);
  return `SUP-${String(max + 1).padStart(4, '0')}`;
}

async function generateSaleNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.sale.count();
  return `SALE-${year}-${String(count + 1).padStart(6, '0')}`;
}

async function generatePurchaseNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.purchase.count();
  return `PUR-${year}-${String(count + 1).padStart(6, '0')}`;
}

async function generateWarrantyCode() {
  const year = new Date().getFullYear();
  const count = await prisma.warranty.count();
  return `WAR-${year}-${String(count + 1).padStart(6, '0')}`;
}

module.exports = {
  generateCustomerCode,
  generateSupplierCode,
  generateInvoiceNumber,
  generateSaleNumber,
  generatePurchaseNumber,
  generateWarrantyCode,
};
