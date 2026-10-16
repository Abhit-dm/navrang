const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { reduceStock } = require('../utils/stock');

const router = express.Router();
router.use(authenticate);

// Invoice Stock is the product's on-hand quantity (its inventory batches). The old `openingStock` key is still accepted.
function readInvoiceStock(body) {
  const raw = body.invoiceStock !== undefined ? body.invoiceStock : body.openingStock;
  if (raw === undefined || raw === null || raw === '') return { provided: false };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return { provided: true, error: 'Invoice Stock must be a whole number of 0 or more.' };
  return { provided: true, value: n };
}

// Moves on-hand stock to `target`, recording the difference as a stock movement so history stays intact.
async function setInvoiceStock(product, target, userId, reference) {
  const current = await getAvailableStock(product.id);
  const diff = target - current;
  if (diff === 0) return;
  if (diff > 0) {
    await prisma.inventory.create({
      data: {
        productId: product.id, batch: `INVOICE-${Date.now()}`, quantity: diff, purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice, mrp: product.mrp, gstPercent: product.gstPercent, purchaseDate: new Date(),
      },
    });
    await prisma.stockMovement.create({ data: { productId: product.id, type: 'ADJUSTMENT_IN', quantity: diff, reference, notes: 'Invoice Stock updated', userId } });
  } else {
    await reduceStock(product.id, -diff, userId, reference, 'ADJUSTMENT_OUT');
  }
}

// Only http(s) or site-relative images are allowed so a stored value can never be a script URL.
function imageError(url) {
  if (url === undefined || url === null || url === '') return null;
  return /^(https?:\/\/|\/)[^\s]+$/i.test(String(url)) ? null : 'Image URL must start with http://, https:// or /.';
}

function stockStatus(qty, min) {
  if (qty <= 0) return 'OUT OF STOCK';
  if (qty <= min) return 'LOW STOCK';
  return 'IN STOCK';
}

async function getAvailableStock(productId) {
  const agg = await prisma.inventory.aggregate({
    where: { productId, disposition: 'AVAILABLE' },
    _sum: { quantity: true },
  });
  return agg._sum.quantity || 0;
}

router.get('/', async (req, res) => {
  const { search, category, status } = req.query;
  const filters = {};
  if (category) filters.category = category;
  if (status) filters.status = status;
  if (search) {
    filters.OR = [
      { name: { contains: search } },
      { brand: { contains: search } },
      { sku: { contains: search } },
      { barcode: { contains: search } },
      { size: { contains: search } },
    ];
  }
  const products = await prisma.product.findMany({ where: filters, orderBy: { createdAt: 'desc' } });
  const withStock = await Promise.all(
    products.map(async (p) => {
      const qty = await getAvailableStock(p.id);
      return { ...p, availableStock: qty, invoiceStock: qty, stockStatus: stockStatus(qty, p.minStockLevel) };
    })
  );
  res.json(withStock);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const product = await prisma.product.findUnique({
    where: { id },
    include: { inventory: true, supplier: true },
  });
  if (!product) return res.status(404).json({ error: 'Not Found', message: 'Product not found' });
  const qty = await getAvailableStock(id);
  res.json({ ...product, availableStock: qty, invoiceStock: qty, stockStatus: stockStatus(qty, product.minStockLevel) });
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const b = req.body;
  if (!b.name || !b.category || !b.sku) {
    return res.status(400).json({ error: 'Bad Request', message: 'Name, category and SKU are required.' });
  }
  const existing = await prisma.product.findUnique({ where: { sku: b.sku } });
  if (existing) return res.status(409).json({ error: 'Conflict', message: 'SKU already exists.' });
  if (imageError(b.imageUrl)) return res.status(400).json({ error: 'Bad Request', message: imageError(b.imageUrl) });
  const stockInput = readInvoiceStock(b);
  if (stockInput.error) return res.status(400).json({ error: 'Bad Request', message: stockInput.error });
  const product = await prisma.product.create({
    data: {
      name: b.name,
      brand: b.brand,
      category: b.category,
      productType: b.productType,
      sku: b.sku,
      barcode: b.barcode,
      size: b.size,
      width: b.width,
      profile: b.profile,
      rimSize: b.rimSize,
      tyreType: b.tyreType,
      vehicleCompatibility: b.vehicleCompatibility,
      speedRating: b.speedRating,
      loadIndex: b.loadIndex,
      tubeType: b.tubeType,
      pattern: b.pattern,
      purchasePrice: Number(b.purchasePrice) || 0,
      sellingPrice: Number(b.sellingPrice) || 0,
      mrp: Number(b.mrp) || 0,
      gstPercent: Number(b.gstPercent) || 18,
      minStockLevel: Number(b.minStockLevel) || 5,
      supplierId: b.supplierId ? Number(b.supplierId) : null,
      warrantyType: b.warrantyType || 'No Warranty',
      warrantyDuration: Number(b.warrantyDuration) || 0,
      imageUrl: b.imageUrl || null,
      description: b.description || null,
      featured: !!b.featured,
      status: 'ACTIVE',
    },
  });
  if (stockInput.value > 0) {
    await prisma.inventory.create({
      data: {
        productId: product.id,
        batch: 'INVOICE-STOCK',
        quantity: stockInput.value,
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        mrp: product.mrp,
        gstPercent: product.gstPercent,
        purchaseDate: new Date(),
      },
    });
    // Movement type keeps its stored name so existing history and the Monthly report stay consistent.
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: 'OPENING_STOCK',
        quantity: stockInput.value,
        reference: 'Invoice Stock',
        userId: req.user.id,
      },
    });
  }
  await logAudit({ userId: req.user.id, action: 'PRODUCT_CREATED', entity: 'Product', entityId: product.id });
  res.status(201).json(product);
});

router.put('/:id', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  if (imageError(b.imageUrl)) return res.status(400).json({ error: 'Bad Request', message: imageError(b.imageUrl) });
  const stockInput = readInvoiceStock(b);
  if (stockInput.error) return res.status(400).json({ error: 'Bad Request', message: stockInput.error });
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: b.name,
      brand: b.brand,
      category: b.category,
      productType: b.productType,
      barcode: b.barcode,
      size: b.size,
      width: b.width,
      profile: b.profile,
      rimSize: b.rimSize,
      tyreType: b.tyreType,
      vehicleCompatibility: b.vehicleCompatibility,
      speedRating: b.speedRating,
      loadIndex: b.loadIndex,
      tubeType: b.tubeType,
      pattern: b.pattern,
      purchasePrice: b.purchasePrice !== undefined ? Number(b.purchasePrice) : undefined,
      sellingPrice: b.sellingPrice !== undefined ? Number(b.sellingPrice) : undefined,
      mrp: b.mrp !== undefined ? Number(b.mrp) : undefined,
      gstPercent: b.gstPercent !== undefined ? Number(b.gstPercent) : undefined,
      minStockLevel: b.minStockLevel !== undefined ? Number(b.minStockLevel) : undefined,
      supplierId: b.supplierId ? Number(b.supplierId) : undefined,
      warrantyType: b.warrantyType,
      warrantyDuration: b.warrantyDuration !== undefined ? Number(b.warrantyDuration) : undefined,
      imageUrl: b.imageUrl === undefined ? undefined : b.imageUrl || null,
      description: b.description === undefined ? undefined : b.description || null,
      featured: b.featured === undefined ? undefined : !!b.featured,
    },
  });
  if (stockInput.provided) await setInvoiceStock(product, stockInput.value, req.user.id, 'Invoice Stock edit');
  await logAudit({ userId: req.user.id, action: 'PRODUCT_UPDATED', entity: 'Product', entityId: id });
  res.json({ ...product, invoiceStock: await getAvailableStock(id) });
});

// Deactivate instead of hard delete (financial integrity)
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const product = await prisma.product.update({ where: { id }, data: { status: 'INACTIVE' } });
  await logAudit({ userId: req.user.id, action: 'PRODUCT_DEACTIVATED', entity: 'Product', entityId: id });
  res.json(product);
});

module.exports = router;
