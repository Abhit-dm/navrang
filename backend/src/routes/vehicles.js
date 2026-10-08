const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { search, customerId } = req.query;
  const where = {};
  if (customerId) where.customerId = Number(customerId);
  if (search) {
    where.OR = [
      { vehicleNumber: { contains: search } },
      { brand: { contains: search } },
      { model: { contains: search } },
    ];
  }
  const vehicles = await prisma.vehicle.findMany({ where, include: { customer: true }, orderBy: { createdAt: 'desc' } });
  res.json(vehicles);
});

router.get('/:id', async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: Number(req.params.id) },
    include: { customer: true, warranties: { include: { product: true } } },
  });
  if (!vehicle) return res.status(404).json({ error: 'Not Found', message: 'Vehicle not found' });
  res.json(vehicle);
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const { customerId, vehicleNumber, vehicleType, brand, model, year, fuelType, odometerReading, notes } = req.body;
  if (!customerId || !vehicleNumber || !vehicleType) {
    return res.status(400).json({ error: 'Bad Request', message: 'Customer, vehicle number and type are required.' });
  }
  const vehicle = await prisma.vehicle.create({
    data: {
      customerId: Number(customerId),
      vehicleNumber: vehicleNumber.toUpperCase().trim(),
      vehicleType,
      brand,
      model,
      year: year ? Number(year) : null,
      fuelType,
      odometerReading: odometerReading ? Number(odometerReading) : null,
      notes,
    },
  });
  await logAudit({ userId: req.user.id, action: 'VEHICLE_CREATED', entity: 'Vehicle', entityId: vehicle.id });
  res.status(201).json(vehicle);
});

router.put('/:id', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { vehicleNumber, vehicleType, brand, model, year, fuelType, odometerReading, notes } = req.body;
  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().trim() : undefined,
      vehicleType,
      brand,
      model,
      year: year ? Number(year) : undefined,
      fuelType,
      odometerReading: odometerReading ? Number(odometerReading) : undefined,
      notes,
    },
  });
  await logAudit({ userId: req.user.id, action: 'VEHICLE_UPDATED', entity: 'Vehicle', entityId: id });
  res.json(vehicle);
});

module.exports = router;
