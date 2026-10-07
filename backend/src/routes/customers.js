const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { generateCustomerCode } = require('../utils/codes');
const { round2 } = require('../utils/money');
const { withStatus } = require('../utils/status');

const router = express.Router();
router.use(authenticate);

const bad = (res, message) => res.status(400).json({ error: 'Bad Request', message });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

function validate(body, { requireAll }) {
  const { name, phone, altPhone, email } = body;
  if (requireAll && (!text(name) || !text(phone))) return 'Customer name and mobile number are required.';
  if (name !== undefined && !text(name)) return 'Customer name cannot be empty.';
  if (phone !== undefined && !/^[0-9]{10}$/.test(String(phone))) return 'Mobile number must be 10 digits.';
  if (text(altPhone) && !/^[0-9]{10}$/.test(String(altPhone))) return 'Alternate number must be 10 digits.';
  if (text(email) && !EMAIL.test(String(email))) return 'Enter a valid email address.';
  return null;
}

// The customer form edits one "primary" vehicle; more vehicles are managed on the Vehicles page.
async function saveVehicle(customerId, body) {
  const vehicleNumber = text(body.vehicleNumber)?.toUpperCase();
  if (!vehicleNumber) return;
  const existing = await prisma.vehicle.findFirst({ where: { customerId, vehicleNumber } });
  const data = { vehicleNumber, model: text(body.vehicleModel), vehicleType: text(body.vehicleType) || existing?.vehicleType || 'Other' };
  if (existing) await prisma.vehicle.update({ where: { id: existing.id }, data });
  else await prisma.vehicle.create({ data: { customerId, ...data } });
}

router.get('/', async (req, res) => {
  const { search } = req.query;
  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
          { altPhone: { contains: search } },
          { customerCode: { contains: search } },
          { vehicles: { some: { vehicleNumber: { contains: search } } } },
        ],
      }
    : {};
  const customers = await prisma.customer.findMany({ where, include: { vehicles: true }, orderBy: { createdAt: 'desc' } });
  res.json(customers);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: true,
      invoices: { include: { items: { include: { product: true } }, payments: true, sale: true, vehicle: true }, orderBy: { createdAt: 'desc' } },
      warranties: { include: { product: true } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
  });
  if (!customer) return res.status(404).json({ error: 'Not Found', message: 'Customer not found' });
  const invoices = customer.invoices.map(withStatus);
  const active = invoices.filter((i) => i.status === 'ACTIVE');
  const stats = {
    totalPurchases: active.length,
    totalSpent: round2(active.reduce((a, i) => a + i.grandTotal, 0)),
    totalPaid: round2(active.reduce((a, i) => a + i.paidAmount, 0)),
    totalOutstanding: round2(active.reduce((a, i) => a + i.dueAmount, 0)),
  };
  res.json({ ...customer, invoices, stats });
});

router.post('/', async (req, res, next) => {
  try {
    const error = validate(req.body, { requireAll: true });
    if (error) return bad(res, error);
    const { name, phone, altPhone, email, address, gstin, city, state, pincode, customerType, notes } = req.body;
    const existing = await prisma.customer.findFirst({ where: { phone } });
    if (existing) return res.status(409).json({ error: 'Conflict', message: 'A customer with this mobile number already exists.' });
    const customer = await prisma.customer.create({
      data: {
        customerCode: await generateCustomerCode(),
        name: name.trim(), phone, altPhone: text(altPhone), email: text(email), address: text(address), gstin: text(gstin),
        city: text(city), state: text(state), pincode: text(pincode), customerType: customerType || 'Individual', notes: text(notes),
      },
    });
    await saveVehicle(customer.id, req.body);
    await logAudit({ userId: req.user.id, action: 'CUSTOMER_CREATED', entity: 'Customer', entityId: customer.id });
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const error = validate(req.body, { requireAll: false });
    if (error) return bad(res, error);
    const { name, phone, altPhone, email, address, gstin, city, state, pincode, customerType, notes } = req.body;
    if (phone) {
      const existing = await prisma.customer.findFirst({ where: { phone, id: { not: id } } });
      if (existing) return res.status(409).json({ error: 'Conflict', message: 'A customer with this mobile number already exists.' });
    }
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name?.trim(), phone, altPhone: altPhone === undefined ? undefined : text(altPhone),
        email: email === undefined ? undefined : text(email), address: address === undefined ? undefined : text(address),
        gstin: gstin === undefined ? undefined : text(gstin), city: city === undefined ? undefined : text(city),
        state: state === undefined ? undefined : text(state), pincode: pincode === undefined ? undefined : text(pincode),
        customerType, notes: notes === undefined ? undefined : text(notes),
      },
    });
    await saveVehicle(id, req.body);
    await logAudit({ userId: req.user.id, action: 'CUSTOMER_UPDATED', entity: 'Customer', entityId: id });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
