const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['NEW', 'CONTACTED', 'CLOSED'];

router.get('/', async (req, res) => {
  const { status, search, archived } = req.query;
  const where = { archived: archived === 'true' };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search } }, { phone: { contains: search } }, { email: { contains: search } },
      { subject: { contains: search } }, { message: { contains: search } },
    ];
  }
  res.json(await prisma.contactEnquiry.findMany({ where, orderBy: { createdAt: 'desc' } }));
});

router.get('/:id', async (req, res) => {
  const enquiry = await prisma.contactEnquiry.findUnique({ where: { id: Number(req.params.id) } });
  if (!enquiry) return res.status(404).json({ error: 'Not Found', message: 'Enquiry not found' });
  res.json(enquiry);
});

router.put('/:id', async (req, res) => {
  const { status, notes } = req.body;
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Status must be NEW, CONTACTED or CLOSED.' });
  }
  const id = Number(req.params.id);
  const existing = await prisma.contactEnquiry.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Enquiry not found' });
  const enquiry = await prisma.contactEnquiry.update({
    where: { id },
    data: { status, notes: notes === undefined ? undefined : String(notes).slice(0, 2000) || null },
  });
  await logAudit({ userId: req.user.id, action: 'ENQUIRY_UPDATED', entity: 'ContactEnquiry', entityId: id });
  res.json(enquiry);
});

// Enquiries are archived, not erased.
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.contactEnquiry.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Enquiry not found' });
  await prisma.contactEnquiry.update({ where: { id }, data: { archived: true } });
  await logAudit({ userId: req.user.id, action: 'ENQUIRY_ARCHIVED', entity: 'ContactEnquiry', entityId: id });
  res.json({ message: 'Enquiry archived.' });
});

module.exports = router;
