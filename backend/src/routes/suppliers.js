const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { generateSupplierCode } = require('../utils/codes');
const { round2 } = require('../utils/money');

const router = express.Router();
router.use(authenticate);

const bad = (res, message) => res.status(400).json({ error: 'Bad Request', message });
const text = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const STATUSES = ['ACTIVE', 'INACTIVE'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Returns an error message, or null when the supplied fields are valid. `create` makes name and mobile mandatory.
function validate(b, create) {
  if (create || b.name !== undefined) { if (!text(b.name)) return 'Supplier name is required.'; if (String(b.name).trim().length > 120) return 'Supplier name is too long.'; }
  if (create || b.phone !== undefined) { if (!text(b.phone)) return 'Mobile number is required.'; if (!/^[0-9]{10}$/.test(String(b.phone).trim())) return 'Mobile number must be 10 digits.'; }
  if (text(b.altPhone) && !/^[0-9]{10}$/.test(String(b.altPhone).trim())) return 'Alternate number must be 10 digits.';
  if (text(b.email) && !EMAIL.test(String(b.email).trim())) return 'Enter a valid email address.';
  if (text(b.gstin) && !GSTIN.test(String(b.gstin).trim().toUpperCase())) return 'Enter a valid 15-character GST number.';
  if (text(b.pincode) && !/^[0-9]{6}$/.test(String(b.pincode).trim())) return 'Pincode must be 6 digits.';
  if (b.status !== undefined && !STATUSES.includes(b.status)) return 'Status must be ACTIVE or INACTIVE.';
  return null;
}

async function duplicateError(b, excludeId) {
  const not = excludeId ? { id: { not: excludeId } } : {};
  if (text(b.phone)) {
    const d = await prisma.supplier.findFirst({ where: { phone: String(b.phone).trim(), ...not } });
    if (d) return `A supplier with this mobile number already exists (${d.supplierCode || d.name}).`;
  }
  if (text(b.gstin)) {
    const d = await prisma.supplier.findFirst({ where: { gstin: String(b.gstin).trim().toUpperCase(), ...not } });
    if (d) return `A supplier with this GST number already exists (${d.supplierCode || d.name}).`;
  }
  return null;
}

function fields(b) {
  return {
    name: text(b.name) ?? undefined,
    companyName: b.companyName === undefined ? undefined : text(b.companyName),
    phone: b.phone === undefined ? undefined : text(b.phone),
    altPhone: b.altPhone === undefined ? undefined : text(b.altPhone),
    email: b.email === undefined ? undefined : text(b.email),
    gstin: b.gstin === undefined ? undefined : text(b.gstin)?.toUpperCase() ?? null,
    contactPerson: b.contactPerson === undefined ? undefined : text(b.contactPerson),
    address: b.address === undefined ? undefined : text(b.address),
    city: b.city === undefined ? undefined : text(b.city),
    state: b.state === undefined ? undefined : text(b.state),
    pincode: b.pincode === undefined ? undefined : text(b.pincode),
    notes: b.notes === undefined ? undefined : text(b.notes),
    status: b.status,
  };
}

// Totals use each purchase's recorded paidAmount; cancelled/legacy rows without one count as nothing paid.
function summarise(purchases) {
  const totalAmount = round2(purchases.reduce((a, p) => a + p.total, 0));
  const totalPaid = round2(purchases.reduce((a, p) => a + Math.min(p.paidAmount, p.total), 0));
  return { totalPurchases: purchases.length, totalAmount, totalPaid, totalOutstanding: round2(totalAmount - totalPaid) };
}

const withBalance = (p) => ({ ...p, balance: round2(p.total - Math.min(p.paidAmount, p.total)) });

router.get('/', async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const where = {};
    if (status && STATUSES.includes(String(status).toUpperCase())) where.status = String(status).toUpperCase();
    if (search) {
      const q = String(search).slice(0, 80);
      where.OR = [
        { name: { contains: q } }, { companyName: { contains: q } }, { phone: { contains: q } },
        { altPhone: { contains: q } }, { gstin: { contains: q } }, { supplierCode: { contains: q } },
      ];
    }
    const suppliers = await prisma.supplier.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { purchases: true } } } });
    res.json(suppliers);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: Number(req.params.id) || 0 },
      include: { purchases: { include: { items: { include: { product: true } } }, orderBy: { purchaseDate: 'desc' } } },
    });
    if (!supplier) return res.status(404).json({ error: 'Not Found', message: 'Supplier not found' });
    const purchases = supplier.purchases.map(withBalance);
    const stats = summarise(supplier.purchases);
    res.json({ ...supplier, purchases, stats, outstandingAmount: stats.totalOutstanding });
  } catch (err) { next(err); }
});

router.get('/:id/purchases', async (req, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    const supplier = await prisma.supplier.findUnique({ where: { id }, select: { id: true, supplierCode: true, name: true, companyName: true, status: true } });
    if (!supplier) return res.status(404).json({ error: 'Not Found', message: 'Supplier not found' });
    const purchases = await prisma.purchase.findMany({ where: { supplierId: id }, include: { items: { include: { product: true } } }, orderBy: { purchaseDate: 'desc' } });
    res.json({ supplier, purchases: purchases.map(withBalance), stats: summarise(purchases) });
  } catch (err) { next(err); }
});

router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const error = validate(req.body, true) || (await duplicateError(req.body, null));
    if (error) return error.startsWith('A supplier') ? res.status(409).json({ error: 'Conflict', message: error }) : bad(res, error);
    const data = { ...fields(req.body), status: req.body.status || 'ACTIVE' };
    let supplier;
    // The code is unique; if concurrent requests pick the same next number, take the next free one.
    for (let attempt = 0; attempt < 6 && !supplier; attempt++) {
      try { supplier = await prisma.supplier.create({ data: { ...data, supplierCode: await generateSupplierCode() } }); }
      catch (err) { if (err.code !== 'P2002' || attempt === 5) throw err; }
    }
    await logAudit({ userId: req.user.id, action: 'SUPPLIER_CREATED', entity: 'Supplier', entityId: supplier.id });
    res.status(201).json(supplier);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Supplier not found' });
    const error = validate(req.body, false) || (await duplicateError(req.body, id));
    if (error) return error.startsWith('A supplier') ? res.status(409).json({ error: 'Conflict', message: error }) : bad(res, error);
    // supplierCode and id are never editable, so old purchases keep pointing at the same supplier.
    const supplier = await prisma.supplier.update({ where: { id }, data: fields(req.body) });
    await logAudit({ userId: req.user.id, action: 'SUPPLIER_UPDATED', entity: 'Supplier', entityId: id });
    res.json(supplier);
  } catch (err) { next(err); }
});

// Suppliers are never deleted: purchases reference them, so they are switched Active/Inactive instead.
router.patch('/:id/status', authorize('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    const { status } = req.body;
    if (!STATUSES.includes(status)) return bad(res, 'Status must be ACTIVE or INACTIVE.');
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Supplier not found' });
    const supplier = await prisma.supplier.update({ where: { id }, data: { status } });
    await logAudit({ userId: req.user.id, action: status === 'ACTIVE' ? 'SUPPLIER_ACTIVATED' : 'SUPPLIER_DEACTIVATED', entity: 'Supplier', entityId: id });
    res.json(supplier);
  } catch (err) { next(err); }
});

module.exports = router;
