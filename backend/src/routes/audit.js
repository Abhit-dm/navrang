const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/', async (req, res) => {
  const { userId, action, entity, dateFrom, dateTo } = req.query;
  const where = {};
  if (userId) where.userId = Number(userId);
  if (action) where.action = { contains: action };
  if (entity) where.entity = entity;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  res.json(logs);
});

module.exports = router;
