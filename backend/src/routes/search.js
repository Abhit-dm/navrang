const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ customers: [], products: [], invoices: [], vehicles: [], warranties: [] });

  const [customers, products, invoices, vehicles, warranties] = await Promise.all([
    prisma.customer.findMany({
      where: { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { customerCode: { contains: q } }] },
      take: 10,
    }),
    prisma.product.findMany({
      where: { OR: [{ name: { contains: q } }, { sku: { contains: q } }, { barcode: { contains: q } }] },
      take: 10,
    }),
    prisma.invoice.findMany({ where: { invoiceNumber: { contains: q } }, include: { customer: true }, take: 10 }),
    prisma.vehicle.findMany({ where: { vehicleNumber: { contains: q } }, include: { customer: true }, take: 10 }),
    prisma.warranty.findMany({ where: { warrantyCode: { contains: q } }, include: { customer: true }, take: 10 }),
  ]);

  res.json({ customers, products, invoices, vehicles, warranties });
});

module.exports = router;
