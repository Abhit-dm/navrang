const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

function computeStatus(endDate, expiryDays) {
  const now = new Date();
  const end = new Date(endDate);
  const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= expiryDays) return 'EXPIRING SOON';
  return 'ACTIVE';
}

router.get('/', async (req, res) => {
  const { search, customerId, status } = req.query;
  const where = {};
  if (customerId) where.customerId = Number(customerId);
  if (search) {
    where.OR = [
      { warrantyCode: { contains: search } },
      { serialNumber: { contains: search } },
      { customer: { name: { contains: search } } },
      { customer: { phone: { contains: search } } },
      { vehicle: { vehicleNumber: { contains: search } } },
      { product: { name: { contains: search } } },
    ];
  }
  const settings = (await prisma.businessSettings.findFirst()) || { warrantyExpiryDays: 30 };
  let warranties = await prisma.warranty.findMany({
    where,
    include: { customer: true, vehicle: true, product: true, invoice: true },
    orderBy: { createdAt: 'desc' },
  });
  warranties = warranties.map((w) => {
    if (w.status !== 'CLAIMED' && w.status !== 'REPLACED') {
      const computed = computeStatus(w.warrantyEnd, settings.warrantyExpiryDays);
      return { ...w, status: computed };
    }
    return w;
  });
  if (status) warranties = warranties.filter((w) => w.status === status);
  res.json(warranties);
});

router.get('/:id', async (req, res) => {
  const warranty = await prisma.warranty.findUnique({
    where: { id: Number(req.params.id) },
    include: { customer: true, vehicle: true, product: true, invoice: true, claims: true },
  });
  if (!warranty) return res.status(404).json({ error: 'Not Found', message: 'Warranty not found' });
  res.json(warranty);
});

router.post('/', async (req, res) => {
  const b = req.body;
  if (!b.customerId || !b.productId || !b.purchaseDate || !b.warrantyDuration) {
    return res.status(400).json({ error: 'Bad Request', message: 'Customer, product, purchase date and duration are required.' });
  }
  const { generateWarrantyCode } = require('../utils/codes');
  const warrantyCode = await generateWarrantyCode();
  const start = new Date(b.purchaseDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(b.warrantyDuration));

  const warranty = await prisma.warranty.create({
    data: {
      warrantyCode,
      customerId: Number(b.customerId),
      vehicleId: b.vehicleId ? Number(b.vehicleId) : null,
      productId: Number(b.productId),
      invoiceId: b.invoiceId ? Number(b.invoiceId) : null,
      saleId: b.saleId ? Number(b.saleId) : null,
      serialNumber: b.serialNumber,
      purchaseDate: start,
      warrantyStart: start,
      warrantyEnd: end,
      warrantyType: b.warrantyType || 'Manufacturer Warranty',
      warrantyDuration: Number(b.warrantyDuration),
      warrantyTerms: b.warrantyTerms,
      status: 'ACTIVE',
    },
  });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_CREATED', entity: 'Warranty', entityId: warranty.id });
  res.status(201).json(warranty);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { status, claimStatus, serialNumber, warrantyTerms } = req.body;
  const warranty = await prisma.warranty.update({
    where: { id },
    data: { status, claimStatus, serialNumber, warrantyTerms },
  });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_UPDATED', entity: 'Warranty', entityId: id });
  res.json(warranty);
});

router.post('/:id/claims', authorize('ADMIN'), async (req, res) => {
  const warrantyId = Number(req.params.id);
  const { reason, resolution, status } = req.body;
  const claim = await prisma.warrantyClaim.create({
    data: { warrantyId, reason, resolution, status: status || 'OPEN' },
  });
  await prisma.warranty.update({ where: { id: warrantyId }, data: { claimStatus: status || 'OPEN', status: status === 'RESOLVED' ? 'REPLACED' : 'CLAIMED' } });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_CLAIM_CREATED', entity: 'Warranty', entityId: warrantyId });
  res.status(201).json(claim);
});

module.exports = router;
