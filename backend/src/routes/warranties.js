const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { round2 } = require('../utils/money');
const { reduceStock } = require('../utils/stock');
const { parseDateOnly, addWarrantyDuration, computeWarrantyStatus } = require('../utils/warrantyDates');

const router = express.Router();
router.use(authenticate);

function bad(res, message) {
  return res.status(400).json({ error: 'Bad Request', message });
}

router.get('/', async (req, res) => {
  const { search, customerId, productId, customer, product, invoiceNumber, status, startFrom, startTo, endFrom, endTo } = req.query;
  const where = {};
  if (customerId) {
    const id = Number(customerId);
    if (!Number.isSafeInteger(id) || id <= 0) return bad(res, 'Invalid customer filter.');
    where.customerId = id;
  }
  if (productId) {
    const id = Number(productId);
    if (!Number.isSafeInteger(id) || id <= 0) return bad(res, 'Invalid product filter.');
    where.productId = id;
  }
  const textFilters = [];
  if (customer) {
    const query = String(customer).trim().slice(0, 100);
    textFilters.push({ OR: [{ customer: { name: { contains: query } } }, { customer: { phone: { contains: query } } }] });
  }
  if (product) {
    const query = String(product).trim().slice(0, 100);
    textFilters.push({ OR: [
      { product: { name: { contains: query } } },
      { product: { brand: { contains: query } } },
      { product: { pattern: { contains: query } } },
    ] });
  }
  if (invoiceNumber) textFilters.push({ invoice: { invoiceNumber: { contains: String(invoiceNumber).trim().slice(0, 100) } } });
  const startRange = {};
  const endRange = {};
  for (const [value, range, upper] of [
    [startFrom, startRange, false], [startTo, startRange, true],
    [endFrom, endRange, false], [endTo, endRange, true],
  ]) {
    if (value) {
      const date = parseDateOnly(String(value));
      if (!date) return bad(res, 'Invalid warranty date filter.');
      range[upper ? 'lte' : 'gte'] = upper ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : date;
    }
  }
  if (Object.keys(startRange).length) where.warrantyStart = startRange;
  if (Object.keys(endRange).length) where.warrantyEnd = endRange;
  if (search) {
    const query = String(search).trim().slice(0, 100);
    textFilters.push({ OR: [
      { warrantyCode: { contains: query } },
      { serialNumber: { contains: query } },
      { customer: { name: { contains: query } } },
      { customer: { phone: { contains: query } } },
      { vehicle: { vehicleNumber: { contains: query } } },
      { product: { name: { contains: query } } },
      { product: { brand: { contains: query } } },
      { product: { pattern: { contains: query } } },
      { invoice: { invoiceNumber: { contains: query } } },
      { sale: { saleNumber: { contains: query } } },
    ] });
  }
  if (textFilters.length) where.AND = textFilters;
  const settings = (await prisma.businessSettings.findFirst()) || { warrantyExpiryDays: 30 };
  let warranties = await prisma.warranty.findMany({
    where,
    include: {
      customer: true, vehicle: true, product: true, invoice: true, sale: true,
      claims: true, replacements: { include: { product: true, inventory: true } },
      returns: { include: { product: true, inventory: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  warranties = warranties.map((w) => {
    const computed = w.status === 'NO WARRANTY'
      ? 'NO WARRANTY'
      : computeWarrantyStatus(w.warrantyEnd, settings.warrantyExpiryDays);
    return { ...w, computedStatus: computed };
  });
  if (status) warranties = warranties.filter((w) => (
    ['ACTIVE', 'EXPIRING SOON', 'EXPIRED', 'NO WARRANTY'].includes(status)
      ? w.computedStatus === status
      : w.status === status
  ));
  res.json(warranties);
});

router.get('/:id', async (req, res) => {
  const warranty = await prisma.warranty.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: true, vehicle: true, product: true, invoice: true, sale: true,
      claims: true, replacements: { include: { product: true, inventory: true } },
      returns: { include: { product: true, inventory: true } },
    },
  });
  if (!warranty) return res.status(404).json({ error: 'Not Found', message: 'Warranty not found' });
  const settings = (await prisma.businessSettings.findFirst()) || { warrantyExpiryDays: 30 };
  res.json({
    ...warranty,
    computedStatus: warranty.status === 'NO WARRANTY'
      ? 'NO WARRANTY'
      : computeWarrantyStatus(warranty.warrantyEnd, settings.warrantyExpiryDays),
  });
});

router.put('/:id', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(404).json({ error: 'Not Found', message: 'Warranty not found' });
  const warranty = await prisma.warranty.findUnique({
    where: { id },
    include: { claims: true, returns: true, replacements: true },
  });
  if (!warranty) return res.status(404).json({ error: 'Not Found', message: 'Warranty not found' });

  const b = req.body;
  if (!['APPLICABLE', 'NONE'].includes(b.status)) return bad(res, 'Select Warranty Applicable or No Warranty.');
  const start = parseDateOnly(b.startDate);
  if (!start) return bad(res, 'Enter a valid warranty start date.');
  const years = Number(b.years);
  const months = Number(b.months);
  const days = Number(b.days);
  if (![years, months, days].every((value) => Number.isSafeInteger(value) && value >= 0)
    || years > 100 || months > 1200 || days > 36500) {
    return bad(res, 'Warranty years, months, and days must be valid non-negative whole numbers.');
  }
  if (b.terms !== undefined && (typeof b.terms !== 'string' || b.terms.length > 2000)) {
    return bad(res, 'Warranty notes must be 2000 characters or fewer.');
  }
  const terms = b.terms === undefined ? warranty.warrantyTerms : b.terms.trim();

  if (b.status === 'NONE') {
    if (warranty.claims.length || warranty.returns.length || warranty.replacements.length) {
      return bad(res, 'A warranty with claim or return history cannot be changed to No Warranty.');
    }
    await prisma.warranty.update({
      where: { id },
      data: {
        warrantyStart: start,
        warrantyEnd: start,
        purchaseDate: start,
        warrantyType: 'No Warranty',
        warrantyDuration: 0,
        warrantyYears: 0,
        warrantyMonths: 0,
        warrantyDays: 0,
        warrantyTerms: terms || null,
        status: 'NO WARRANTY',
      },
    });
  } else {
    if (years + months + days === 0) return bad(res, 'Enter a positive warranty duration.');
    const calculatedEnd = addWarrantyDuration(start, years, months, days);
    const end = b.endDate ? parseDateOnly(b.endDate) : calculatedEnd;
    if (!end || end < start) return bad(res, 'Warranty expiry must be a valid date on or after the start date.');
    await prisma.warranty.update({
      where: { id },
      data: {
        warrantyStart: start,
        warrantyEnd: end,
        purchaseDate: start,
        warrantyType: warranty.warrantyType === 'No Warranty' ? 'Manual Warranty' : warranty.warrantyType,
        warrantyDuration: years * 12 + months,
        warrantyYears: years,
        warrantyMonths: months,
        warrantyDays: days,
        warrantyTerms: terms || null,
        status: warranty.status === 'NO WARRANTY' ? 'ACTIVE' : warranty.status,
      },
    });
  }
  await logAudit({ userId: req.user.id, action: 'WARRANTY_UPDATED', entity: 'Warranty', entityId: id });
  const updated = await prisma.warranty.findUnique({
    where: { id },
    include: {
      customer: true, vehicle: true, product: true, invoice: true, sale: true,
      claims: true, replacements: { include: { product: true, inventory: true } },
      returns: { include: { product: true, inventory: true } },
    },
  });
  const settings = (await prisma.businessSettings.findFirst()) || { warrantyExpiryDays: 30 };
  res.json({
    ...updated,
    computedStatus: updated.status === 'NO WARRANTY'
      ? 'NO WARRANTY'
      : computeWarrantyStatus(updated.warrantyEnd, settings.warrantyExpiryDays),
  });
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
  const start = parseDateOnly(String(b.purchaseDate).slice(0, 10));
  if (!start) return bad(res, 'Enter a valid purchase date.');
  const durationMonths = Number(b.warrantyDuration);
  if (!Number.isSafeInteger(durationMonths) || durationMonths <= 0) return bad(res, 'Warranty duration must be a positive whole number of months.');
  const end = addWarrantyDuration(start, Math.floor(durationMonths / 12), durationMonths % 12, 0);
  const warranty = await prisma.warranty.create({
    data: {
      warrantyCode: await generateWarrantyCode(), customerId: Number(b.customerId),
      vehicleId: b.vehicleId ? Number(b.vehicleId) : null, productId: Number(b.productId),
      invoiceId: b.invoiceId ? Number(b.invoiceId) : null, saleId: b.saleId ? Number(b.saleId) : null,
      serialNumber: b.serialNumber, purchaseDate: start, warrantyStart: start, warrantyEnd: end,
      warrantyType: b.warrantyType || 'Manufacturer Warranty',
      warrantyDuration: durationMonths,
      warrantyYears: Math.floor(durationMonths / 12),
      warrantyMonths: durationMonths % 12,
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
  if (warranty.status === 'NO WARRANTY'
    || computeWarrantyStatus(warranty.warrantyEnd, 0) === 'EXPIRED'
    || warranty.status === 'RETURNED') return bad(res, 'This warranty is no longer claimable.');
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
