const prisma = require('../lib/prisma');
const { logAudit } = require('./audit');

// Cancels a sale and its invoice, and returns the sold quantities to inventory. Financial rows are kept.
async function cancelSale(saleId, userId) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { items: true, invoice: true } });
  if (!sale) {
    const err = new Error('Sale not found');
    err.status = 404;
    throw err;
  }
  if (sale.status === 'CANCELLED') {
    const err = new Error('Sale is already cancelled');
    err.status = 400;
    throw err;
  }

  await prisma.sale.update({ where: { id: sale.id }, data: { status: 'CANCELLED' } });
  if (sale.invoice) {
    await prisma.invoice.update({ where: { id: sale.invoice.id }, data: { status: 'CANCELLED', paymentStatus: 'CANCELLED' } });
  }

  const reference = sale.invoice?.invoiceNumber || sale.saleNumber;
  for (const item of sale.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    await prisma.inventory.create({
      data: {
        productId: item.productId,
        batch: `RETURN-${sale.saleNumber}`,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        mrp: product?.mrp || 0,
        gstPercent: item.gstPercent,
        purchaseDate: new Date(),
      },
    });
    await prisma.stockMovement.create({
      data: { productId: item.productId, type: 'RETURN', quantity: item.quantity, reference, notes: 'Sale cancelled', userId },
    });
  }

  await logAudit({ userId, action: 'SALE_CANCELLED', entity: 'Sale', entityId: sale.id });
  if (sale.invoice) await logAudit({ userId, action: 'INVOICE_CANCELLED', entity: 'Invoice', entityId: sale.invoice.id });
  return sale;
}

module.exports = { cancelSale };
