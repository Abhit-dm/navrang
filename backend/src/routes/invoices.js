const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { round2 } = require('../utils/money');
const { invoiceStatus, withStatus, parseDate } = require('../utils/status');
const { cancelSale } = require('../utils/saleCancel');
const { streamInvoicePdf } = require('../utils/invoicePdf');

const router = express.Router();
router.use(authenticate);

const DETAIL_INCLUDE = {
  customer: true,
  vehicle: true,
  employee: { select: { id: true, name: true, email: true, role: true } },
  items: { include: { product: true } },
  payments: true,
  warranties: { include: { product: true } },
  sale: true,
};

router.get('/', async (req, res) => {
  const { invoiceNumber, search, customerId, phone, dateFrom, dateTo, paymentStatus, isGst, paymentMethod } = req.query;
  const where = {};
  if (invoiceNumber) where.invoiceNumber = { contains: invoiceNumber };
  if (customerId) where.customerId = Number(customerId);
  if (isGst !== undefined && isGst !== '') where.isGst = isGst === 'true';
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (from === undefined || to === undefined) return res.status(400).json({ error: 'Bad Request', message: 'Invalid date filter.' });
  if (from || to) {
    where.invoiceDate = {};
    if (from) where.invoiceDate.gte = from;
    if (to) where.invoiceDate.lte = new Date(to.getTime() + 24 * 3600 * 1000 - 1);
  }
  if (phone) where.customer = { phone: { contains: phone } };
  if (paymentMethod) where.sale = { paymentMethod };
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search } },
      { customer: { name: { contains: search } } },
      { customer: { phone: { contains: search } } },
      { vehicle: { vehicleNumber: { contains: search } } },
    ];
  }
  const invoices = await prisma.invoice.findMany({
    where,
    include: { customer: true, vehicle: true, sale: true, payments: true },
    orderBy: { createdAt: 'desc' },
  });
  let result = invoices.map(withStatus);
  if (paymentStatus) result = result.filter((i) => i.displayStatus === paymentStatus);
  res.json(result);
});

router.get('/summary', async (req, res) => {
  const all = await prisma.invoice.findMany({ where: { status: 'ACTIVE' } });
  const s = {
    totalInvoices: all.length,
    totalAmount: 0, paid: 0, pending: 0, partiallyPaid: 0, overdue: 0, received: 0, outstanding: 0,
  };
  for (const inv of all) {
    s.totalAmount += inv.grandTotal;
    s.received += inv.paidAmount;
    s.outstanding += inv.dueAmount;
    const st = invoiceStatus(inv);
    if (st === 'PAID') s.paid += 1;
    else if (st === 'PARTIALLY PAID') s.partiallyPaid += 1;
    else if (st === 'OVERDUE') s.overdue += 1;
    else s.pending += 1;
  }
  s.totalAmount = round2(s.totalAmount);
  s.received = round2(s.received);
  s.outstanding = round2(s.outstanding);
  res.json(s);
});

router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) }, include: DETAIL_INCLUDE });
  if (!invoice) return res.status(404).json({ error: 'Not Found', message: 'Invoice not found' });
  res.json(withStatus(invoice));
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) }, include: DETAIL_INCLUDE });
    if (!invoice) return res.status(404).json({ error: 'Not Found', message: 'Invoice not found' });
    const settings = (await prisma.businessSettings.findFirst()) || {};
    streamInvoicePdf(res, invoice, settings);
  } catch (err) {
    next(err);
  }
});

// Cancel invoice (admin only) — cancels the linked sale too and restores stock; never hard deleted.
router.post('/:id/cancel', authorize('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: 'Not Found', message: 'Invoice not found' });
    if (invoice.status === 'CANCELLED') return res.status(400).json({ error: 'Bad Request', message: 'Invoice is already cancelled.' });
    await cancelSale(invoice.saleId, req.user.id);
    res.json(await prisma.invoice.findUnique({ where: { id } }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
