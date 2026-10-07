const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { generatePurchaseNumber } = require('../utils/codes');
const { round2, percentOf } = require('../utils/money');

const router = express.Router();
router.use(authenticate);

// Express 4 does not catch rejected promises; this sends them to the error handler instead of crashing the process.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', async (req, res) => {
  const where = req.query.supplierId ? { supplierId: Number(req.query.supplierId) || 0 } : {};
  const purchases = await prisma.purchase.findMany({
    where,
    include: { supplier: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(purchases.map((p) => ({ ...p, balance: round2(p.total - Math.min(p.paidAmount, p.total)) })));
});

router.get('/:id', async (req, res) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id: Number(req.params.id) },
    include: { supplier: true, items: { include: { product: true } } },
  });
  if (!purchase) return res.status(404).json({ error: 'Not Found', message: 'Purchase not found' });
  res.json(purchase);
});

// Create purchase: increases inventory automatically
router.post('/', authorize('ADMIN'), wrap(async (req, res) => {
  const { supplierId, items, discount, paymentStatus, paymentMethod, paidAmount } = req.body;
  if (!supplierId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Supplier and at least one item are required.' });
  }
  const supplier = await prisma.supplier.findUnique({ where: { id: Number(supplierId) || 0 } });
  if (!supplier) return res.status(404).json({ error: 'Not Found', message: 'Supplier not found' });
  if (supplier.status !== 'ACTIVE') return res.status(400).json({ error: 'Bad Request', message: 'This supplier is inactive. Activate it or choose another supplier.' });
  for (const item of items) {
    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) return res.status(400).json({ error: 'Bad Request', message: 'Each quantity must be a whole number greater than zero.' });
    if (!Number.isFinite(Number(item.purchasePrice)) || Number(item.purchasePrice) < 0) return res.status(400).json({ error: 'Bad Request', message: 'Each purchase price must be a valid amount.' });
  }

  let subtotal = 0;
  let gstAmount = 0;
  const preparedItems = [];
  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: Number(item.productId) || 0 } });
    if (!product) return res.status(404).json({ error: 'Not Found', message: `Product ${item.productId} not found` });
    const lineTotal = round2(item.purchasePrice * item.quantity);
    const lineDiscount = round2(item.discount || 0);
    const taxable = round2(lineTotal - lineDiscount);
    const gst = percentOf(taxable, item.gstPercent || product.gstPercent);
    subtotal = round2(subtotal + lineTotal);
    gstAmount = round2(gstAmount + gst);
    preparedItems.push({
      productId: product.id,
      quantity: Number(item.quantity),
      purchasePrice: Number(item.purchasePrice),
      gstPercent: Number(item.gstPercent || product.gstPercent),
      discount: lineDiscount,
      total: round2(taxable + gst),
    });
  }
  const totalDiscount = round2(discount || 0);
  const total = round2(subtotal - totalDiscount + gstAmount);
  if (totalDiscount < 0 || totalDiscount > subtotal) return res.status(400).json({ error: 'Bad Request', message: 'Discount must be between zero and the subtotal.' });

  // With an explicit paidAmount the status follows it; otherwise the old behaviour (status only) is kept.
  let paid = 0;
  let status = paymentStatus || 'PENDING';
  if (paidAmount !== undefined && paidAmount !== '' && paidAmount !== null) {
    paid = round2(paidAmount);
    if (!Number.isFinite(paid) || paid < 0 || paid > total) return res.status(400).json({ error: 'Bad Request', message: 'Amount paid must be between zero and the purchase total.' });
    status = paid >= total && total > 0 ? 'PAID' : paid > 0 ? 'PARTIALLY PAID' : 'PENDING';
  } else if (status === 'PAID') {
    paid = total;
  }
  const purchaseNumber = await generatePurchaseNumber();

  const purchase = await prisma.purchase.create({
    data: {
      purchaseNumber,
      supplierId: Number(supplierId),
      subtotal,
      discount: totalDiscount,
      gstAmount,
      total,
      paidAmount: paid,
      paymentStatus: status,
      paymentMethod,
      items: { create: preparedItems },
    },
    include: { items: true, supplier: true },
  });

  // Increase inventory for each product
  for (const item of preparedItems) {
    await prisma.inventory.create({
      data: {
        productId: item.productId,
        batch: `${purchaseNumber}`,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        sellingPrice: (await prisma.product.findUnique({ where: { id: item.productId } })).sellingPrice,
        mrp: (await prisma.product.findUnique({ where: { id: item.productId } })).mrp,
        gstPercent: item.gstPercent,
        supplierId: Number(supplierId),
        purchaseDate: new Date(),
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: item.productId,
        type: 'PURCHASE',
        quantity: item.quantity,
        reference: purchaseNumber,
        userId: req.user.id,
      },
    });
  }

  await logAudit({ userId: req.user.id, action: 'PURCHASE_CREATED', entity: 'Purchase', entityId: purchase.id });
  res.status(201).json(purchase);
}));

module.exports = router;
