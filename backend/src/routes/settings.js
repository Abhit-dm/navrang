const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  let settings = await prisma.businessSettings.findFirst();
  if (!settings) {
    settings = await prisma.businessSettings.create({ data: {} });
  }
  res.json(settings);
});

router.put('/', authorize('ADMIN'), async (req, res) => {
  let settings = await prisma.businessSettings.findFirst();
  const data = req.body;
  if (!settings) {
    settings = await prisma.businessSettings.create({ data });
  } else {
    settings = await prisma.businessSettings.update({ where: { id: settings.id }, data });
  }
  await logAudit({ userId: req.user.id, action: 'SETTINGS_CHANGED', entity: 'BusinessSettings', entityId: settings.id });
  res.json(settings);
});

module.exports = router;
