const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { round2 } = require('../utils/money');
const { reduceStock } = require('../utils/stock');

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

function bad(res, message) {
  return res.status(400).json({ error: 'Bad Request', message });
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
    include: {
      customer: true, vehicle: true, product: true, invoice: true,
      claims: true, replacements: { include: { product: true, inventory: true } },
      returns: { include: { product: true, inventory: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  warranties = warranties.map((w) => {
    const computed = computeStatus(w.warrantyEnd, settings.warrantyExpiryDays);
    return { ...w, computedStatus: computed, status: w.status === 'ACTIVE' && computed === 'EXPIRED' ? 'EXPIRED' : w.status };
  });
  if (status) warranties = warranties.filter((w) => w.status === status || w.computedStatus === status);
  res.json(warranties);
});

router.get('/:id', async (req, res) => {
  const warranty = await prisma.warranty.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: true, vehicle: true, product: true, invoice: true,
      claims: true, replacements: { include: { product: true, inventory: true } },
      returns: { include: { product: true, inventory: true } },
    },
  });
  if (!warranty) return res.status(404).json({ error: 'Not Found', message: 'Warranty not found' });
  const settings = (await prisma.businessSettings.findFirst()) || { warrantyExpiryDays: 30 };
  res.json({ ...warranty, computedStatus: computeStatus(warranty.warrantyEnd, settings.warrantyExpiryDays) });
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const b = req.body;
  if (!b.customerId || !b.productId || !b.purchaseDate || !b.warrantyDuration) {
    return bad(res, 'Customer, product, purchase date and duration are required.');
  }
  if (!Number.isFinite(Number(b.warrantyDuration)) || Number(b.warrantyDuration) <= 0) {
    return bad(res, 'Warranty duration must be greater than zero.');
  }
  const { generateWarrantyCode } = require('../utils/codes');
  const start = new Date(b.purchaseDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(b.warrantyDuration));
  const warranty = await prisma.warranty.create({
    data: {
      warrantyCode: await generateWarrantyCode(), customerId: Number(b.customerId),
      vehicleId: b.vehicleId ? Number(b.vehicleId) : null, productId: Number(b.productId),
      invoiceId: b.invoiceId ? Number(b.invoiceId) : null, saleId: b.saleId ? Number(b.saleId) : null,
      serialNumber: b.serialNumber, purchaseDate: start, warrantyStart: start, warrantyEnd: end,
      warrantyType: b.warrantyType || 'Manufacturer Warranty', warrantyDuration: Number(b.warrantyDuration),
      warrantyTerms: b.warrantyTerms, status: 'ACTIVE',
    },
  });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_CREATED', entity: 'Warranty', entityId: warranty.id });
  res.status(201).json(warranty);
});

router.post('/:id/claims', authorize('ADMIN'), async (req, res) => {
  const warrantyId = Number(req.params.id);
  const reason = String(req.body.reason || '').trim();
  if (!reason) return bad(res, 'A claim reason is required.');
  const warranty = await prisma.warranty.findUnique({ where: { id: warrantyId } });
  if (!warranty) return res.status(404).json({ error: 'Not Found', message: 'Warranty not found' });
  if (warranty.status === 'EXPIRED' || warranty.status === 'RETURNED') return bad(res, 'This warranty is no longer claimable.');
  const claim = await prisma.warrantyClaim.create({
    data: { warrantyId, reason, status: 'OPEN', claimedBy: req.user.id },
  });
  await prisma.warranty.update({ where: { id: warrantyId }, data: { claimStatus: 'OPEN', status: 'CLAIMED' } });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_CLAIM_CREATED', entity: 'Warranty', entityId: warrantyId });
  res.status(201).json(claim);
});

router.patch('/:id/claims/:claimId/approve', authorize('ADMIN'), async (req, res) => {
  const [warrantyId, claimId] = [Number(req.params.id), Number(req.params.claimId)];
  const resolution = String(req.body.resolution || '').trim();
  if (!resolution) return bad(res, 'A resolution is required when approving a claim.');
  const claim = await prisma.warrantyClaim.findUnique({ where: { id: claimId } });
  if (!claim || claim.warrantyId !== warrantyId) return res.status(404).json({ error: 'Not Found', message: 'Claim not found' });
  if (claim.status !== 'OPEN') return bad(res, 'The claim has already been resolved.');
  const updated = await prisma.warrantyClaim.update({
    where: { id: claimId }, data: { status: 'APPROVED', resolution, resolvedAt: new Date(), claimedBy: req.user.id },
  });
  await prisma.warranty.update({ where: { id: warrantyId }, data: { claimStatus: 'APPROVED', status: 'CLAIMED' } });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_CLAIM_APPROVED', entity: 'WarrantyClaim', entityId: claimId });
  res.json(updated);
});

router.patch('/:id/claims/:claimId/reject', authorize('ADMIN'), async (req, res) => {
  const [warrantyId, claimId] = [Number(req.params.id), Number(req.params.claimId)];
  const resolution = String(req.body.resolution || '').trim();
  if (!resolution) return bad(res, 'A resolution is required when rejecting a claim.');
  const claim = await prisma.warrantyClaim.findUnique({ where: { id: claimId } });
  if (!claim || claim.warrantyId !== warrantyId) return res.status(404).json({ error: 'Not Found', message: 'Claim not found' });
  if (claim.status !== 'OPEN') return bad(res, 'The claim has already been resolved.');
  const updated = await prisma.warrantyClaim.update({
    where: { id: claimId }, data: { status: 'REJECTED', resolution, resolvedAt: new Date(), claimedBy: req.user.id },
  });
  await prisma.warranty.update({ where: { id: warrantyId }, data: { claimStatus: 'REJECTED', status: 'ACTIVE' } });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_CLAIM_REJECTED', entity: 'WarrantyClaim', entityId: claimId });
  res.json(updated);
});

router.post('/:id/replacements', authorize('ADMIN'), async (req, res) => {
  const warrantyId = Number(req.params.id);
  const warranty = await prisma.warranty.findUnique({ where: { id: warrantyId }, include: { claims: true } });
  if (!warranty) return res.status(404).json({ error: 'Not Found', message: 'Warranty not found' });
  const approved = warranty.claims.some((claim) => claim.id === Number(req.body.claimId) && claim.status === 'APPROVED');
  if (!approved) return bad(res, 'Select an approved claim before processing a replacement.');
  const productId = Number(req.body.productId);
  const replacementProduct = await prisma.product.findUnique({ where: { id: productId } });
  if (!replacementProduct || replacementProduct.status !== 'ACTIVE') return res.status(404).json({ error: 'Not Found', message: 'Replacement product not found' });
  const serialNumber = String(req.body.serialNumber || '').trim();
  if (!serialNumber) return bad(res, 'Replacement serial number is required.');
  const replacementReason = String(req.body.replacementReason || '').trim() || 'Warranty replacement';
  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.create({
      data: {
        productId, batch: `WARRANTY-${warrantyId}-${Date.now()}`, quantity: 1,
        purchasePrice: replacementProduct.purchasePrice, sellingPrice: replacementProduct.sellingPrice,
        mrp: replacementProduct.mrp, gstPercent: replacementProduct.gstPercent,
        disposition: 'AVAILABLE', purchaseDate: new Date(), serialNumber,
      },
    });
    const replacement = await tx.warrantyReplacement.create({
      data: {
        warrantyId, productId, serialNumber, replacementDate: new Date(), replacementReason,
        status: 'ACTIVE', inventoryId: inventory.id,
      },
    });
    await tx.stockMovement.create({ data: { productId, type: 'WARRANTY_REPLACEMENT', quantity: 1, reference: `Warranty ${warranty.warrantyCode}`, notes: replacementReason, userId: req.user.id } });
    await tx.warranty.update({ where: { id: warrantyId }, data: { claimStatus: 'REPLACED', status: 'REPLACED' } });
    await tx.warrantyClaim.update({ where: { id: Number(req.body.claimId) }, data: { status: 'RESOLVED', resolution: replacementReason, resolvedAt: new Date(), claimedBy: req.user.id } });
    return replacement;
  });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_REPLACED', entity: 'WarrantyReplacement', entityId: result.id });
  res.status(201).json(result);
});

router.post('/:id/returns', authorize('ADMIN'), async (req, res) => {
  const warrantyId = Number(req.params.id);
  const warranty = await prisma.warranty.findUnique({
    where: { id: warrantyId },
    include: { invoice: { include: { items: true, payments: true } }, claims: true, product: true },
  });
  if (!warranty) return res.status(404).json({ error: 'Not Found', message: 'Warranty not found' });
  const approved = warranty.claims.some((claim) => claim.id === Number(req.body.claimId) && claim.status === 'APPROVED');
  if (!approved) return bad(res, 'Select an approved claim before processing a return.');
  const returnDate = new Date(req.body.returnDate || Date.now());
  const reason = String(req.body.reason || '').trim();
  if (!reason) return bad(res, 'A return reason is required.');
  const invoiceItem = warranty.invoice?.items?.find((item) => item.productId === warranty.productId);
  const refundAmount = round2(invoiceItem?.amount || 0);
  if (refundAmount <= 0) return bad(res, 'The original invoice has no refundable value for this product.');
  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.create({
      data: {
        productId: warranty.productId, batch: `RETURN-${warrantyId}-${Date.now()}`, quantity: 1,
        purchasePrice: warranty.product.purchasePrice, sellingPrice: warranty.product.sellingPrice,
        mrp: warranty.product.mrp, gstPercent: warranty.product.gstPercent,
        disposition: 'RETURN', purchaseDate: returnDate, serialNumber: warranty.serialNumber,
      },
    });
    const returned = await tx.warrantyReturn.create({
      data: {
        warrantyId, productId: warranty.productId, inventoryId: inventory.id, returnDate,
        reason, refundAmount, paymentMethod: req.body.paymentMethod || 'Original Payment',
        paymentReference: req.body.paymentReference || null, status: 'RECEIVED', notes: req.body.notes || null,
      },
    });
    await tx.stockMovement.create({ data: { productId: warranty.productId, type: 'RETURN', quantity: 1, reference: `Warranty ${warranty.warrantyCode}`, notes: reason, userId: req.user.id } });
    const invoice = await tx.invoice.findUnique({ where: { id: warranty.invoiceId }, include: { payments: true } });
    const payment = invoice?.payments.find((p) => p.status === 'PAID');
    if (payment) {
      const existingRefund = round2(invoice.paidAmount - refundAmount);
      await tx.payment.create({ data: { invoiceId: invoice.id, customerId: invoice.customerId, amount: refundAmount, method: payment.method, referenceNumber: `REFUND-${payment.id}-${Date.now()}`, status: 'REFUNDED', paidAt: returnDate } });
      await tx.invoice.update({ where: { id: invoice.id }, data: { paidAmount: existingRefund, dueAmount: round2(invoice.grandTotal - existingRefund), paymentStatus: existingRefund <= 0 ? 'REFUNDED' : 'PARTIALLY PAID' } });
    }
    await tx.warranty.update({ where: { id: warrantyId }, data: { claimStatus: 'RETURNED', status: 'RETURNED' } });
    await tx.warrantyClaim.update({ where: { id: Number(req.body.claimId) }, data: { status: 'RESOLVED', resolution: reason, resolvedAt: returnDate, claimedBy: req.user.id } });
    return returned;
  });
  await logAudit({ userId: req.user.id, action: 'WARRANTY_RETURNED', entity: 'WarrantyReturn', entityId: result.id });
  res.status(201).json(result);
});

router.patch('/:id/returns/:returnId', authorize('ADMIN'), async (req, res) => {
  const [warrantyId, returnId] = [Number(req.params.id), Number(req.params.returnId)];
  const returned = await prisma.warrantyReturn.findUnique({ where: { id: returnId } });
  if (!returned || returned.warrantyId !== warrantyId) return res.status(404).json({ error: 'Not Found', message: 'Return not found' });
  const allowed = ['RECEIVED', 'INSPECTED', 'RESTOCKED', 'DISPOSED'];
  const status = req.body.status;
  if (!allowed.includes(status)) return bad(res, 'Choose a valid return status.');
  const updated = await prisma.warrantyReturn.update({ where: { id: returnId }, data: { status, notes: req.body.notes || returned.notes } });
  if (status === 'RESTOCKED') {
    await prisma.inventory.update({ where: { id: returned.inventoryId }, data: { disposition: 'AVAILABLE', updatedAt: new Date() } });
  }
  await logAudit({ userId: req.user.id, action: 'WARRANTY_RETURN_UPDATED', entity: 'WarrantyReturn', entityId: returnId });
  res.json(updated);
});

module.exports = router;
