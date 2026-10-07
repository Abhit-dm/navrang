const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { round2 } = require('../utils/money');
const { isValidPaymentMethod, parseDate } = require('../utils/status');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { method, customerId, invoiceId } = req.query;
  const where = {};
  if (method) where.method = method;
  if (customerId) where.customerId = Number(customerId);
  if (invoiceId) where.invoiceId = Number(invoiceId);
  const payments = await prisma.payment.findMany({
    where,
    include: { customer: true, invoice: true },
    orderBy: { paidAt: 'desc' },
  });
  res.json(payments);
});

// Record additional payment against an existing invoice (for due amounts)
router.post('/', async (req, res) => {
  const { invoiceId, amount, method, referenceNumber, paymentDate } = req.body;
  const bad = (message) => res.status(400).json({ error: 'Bad Request', message });
  if (!invoiceId || !method) return bad('Invoice and payment method are required.');
  if (!isValidPaymentMethod(method)) return bad('Select a valid payment method.');
  const amt = round2(amount);
  if (!Number.isFinite(amt) || amt <= 0) return bad('Payment amount must be greater than zero.');
  const paidAt = parseDate(paymentDate);
  if (paidAt === undefined) return bad('Payment date is invalid.');

  const invoice = await prisma.invoice.findUnique({ where: { id: Number(invoiceId) } });
  if (!invoice) return res.status(404).json({ error: 'Not Found', message: 'Invoice not found' });
  if (invoice.status === 'CANCELLED') return bad('Payments cannot be added to a cancelled invoice.');
  if (amt > invoice.dueAmount) return bad('Payment amount exceeds due amount.');

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      amount: amt,
      method,
      referenceNumber,
      status: 'PAID',
      paidAt: paidAt || new Date(),
    },
  });

  const newPaid = round2(invoice.paidAmount + amt);
  const newDue = round2(invoice.grandTotal - newPaid);
  let paymentStatus = 'PENDING';
  if (newDue <= 0) paymentStatus = 'PAID';
  else if (newPaid > 0) paymentStatus = 'PARTIALLY PAID';

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paidAmount: newPaid, dueAmount: newDue, paymentStatus },
  });

  await logAudit({ userId: req.user.id, action: 'PAYMENT_RECORDED', entity: 'Invoice', entityId: invoice.id, details: { amount: amt } });
  res.status(201).json(payment);
});

module.exports = router;
