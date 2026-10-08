const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

function stockStatus(qty, min) {
  if (qty <= 0) return 'OUT OF STOCK';
  if (qty <= min) return 'LOW STOCK';
  return 'IN STOCK';
}

router.get('/', async (req, res) => {
  const inventory = await prisma.inventory.findMany({
    include: { product: true, supplier: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(inventory);
});

router.get('/summary', async (req, res) => {
  const products = await prisma.product.findMany({ where: { status: 'ACTIVE' }, include: { inventory: true } });
  let totalUnits = 0;
  let totalStockValue = 0;
  const lowStock = [];
  const outOfStock = [];
  for (const p of products) {
    const availableInventory = p.inventory.filter((i) => i.disposition === 'AVAILABLE' || i.disposition === null);
    const qty = availableInventory.reduce((s, i) => s + i.quantity, 0);
    totalUnits += qty;
    totalStockValue += qty * p.purchasePrice;
    const status = stockStatus(qty, p.minStockLevel);
    if (status === 'LOW STOCK') lowStock.push({ product: p.name, sku: p.sku, currentStock: qty, minStock: p.minStockLevel, status });
    if (status === 'OUT OF STOCK') outOfStock.push({ product: p.name, sku: p.sku, status });
  }
  res.json({
    totalProducts: products.length,
    totalUnits,
    totalStockValue,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStock,
    outOfStock,
  });
});

// Stock movement history
router.get('/movements', async (req, res) => {
  const { productId } = req.query;
  const where = productId ? { productId: Number(productId) } : {};
  const movements = await prisma.stockMovement.findMany({
    where,
    include: { product: true, user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json(movements);
});

// Add stock (manual, admin) — creates inventory batch + movement
router.post('/add-stock', authorize('ADMIN'), async (req, res) => {
  const b = req.body;
  if (!b.productId || !b.quantity) {
    return res.status(400).json({ error: 'Bad Request', message: 'Product and quantity are required.' });
  }
  const product = await prisma.product.findUnique({ where: { id: Number(b.productId) } });
  if (!product) return res.status(404).json({ error: 'Not Found', message: 'Product not found' });

  const inventory = await prisma.inventory.create({
    data: {
      productId: product.id,
      batch: b.batch || `BATCH-${Date.now()}`,
      quantity: Number(b.quantity),
      purchasePrice: Number(b.purchasePrice) || product.purchasePrice,
      sellingPrice: Number(b.sellingPrice) || product.sellingPrice,
      mrp: Number(b.mrp) || product.mrp,
      gstPercent: Number(b.gstPercent) || product.gstPercent,
      supplierId: b.supplierId ? Number(b.supplierId) : null,
      purchaseDate: new Date(),
      dotNumber: b.dotNumber,
      serialNumber: b.serialNumber,
    },
  });
  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      type: 'ADJUSTMENT_IN',
      quantity: Number(b.quantity),
      reference: b.reference || 'Manual stock addition',
      userId: req.user.id,
    },
  });
  await logAudit({ userId: req.user.id, action: 'STOCK_ADDED', entity: 'Product', entityId: product.id, details: { quantity: b.quantity } });
  res.status(201).json(inventory);
});

// Stock adjustment (in/out/damage) — admin only
router.post('/adjust', authorize('ADMIN'), async (req, res) => {
  const { productId, quantity, type, reason } = req.body;
  if (!productId || !quantity || !['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE'].includes(type)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Product, quantity and valid type are required.' });
  }
  const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
  if (!product) return res.status(404).json({ error: 'Not Found', message: 'Product not found' });

  const settings = await prisma.businessSettings.findFirst();
  const allowNegative = settings?.allowNegativeStock || false;

  if (type !== 'ADJUSTMENT_IN') {
    const agg = await prisma.inventory.aggregate({
      where: { productId: product.id, disposition: { in: ['AVAILABLE', null] } },
      _sum: { quantity: true },
    });
    const current = agg._sum.quantity || 0;
    if (!allowNegative && current - Number(quantity) < 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Insufficient stock for this adjustment.' });
    }
    // reduce from the most recent batch(es)
    let remaining = Number(quantity);
    const batches = await prisma.inventory.findMany({
      where: { productId: product.id, quantity: { gt: 0 }, disposition: { in: ['AVAILABLE', null] } },
      orderBy: { createdAt: 'asc' },
    });
    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(batch.quantity, remaining);
      await prisma.inventory.update({ where: { id: batch.id }, data: { quantity: batch.quantity - deduct } });
      remaining -= deduct;
    }
  } else {
    await prisma.inventory.create({
      data: {
        productId: product.id,
        batch: `ADJ-${Date.now()}`,
        quantity: Number(quantity),
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        mrp: product.mrp,
        gstPercent: product.gstPercent,
        purchaseDate: new Date(),
      },
    });
  }

  await prisma.stockMovement.create({
    data: { productId: product.id, type, quantity: Number(quantity), reference: reason || 'Manual adjustment', userId: req.user.id },
  });
  await logAudit({ userId: req.user.id, action: 'STOCK_ADJUSTED', entity: 'Product', entityId: product.id, details: { type, quantity } });
  res.json({ message: 'Stock adjusted successfully' });
});

module.exports = router;
