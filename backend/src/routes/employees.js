const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

// List employees (admin only)
router.get('/', authorize('ADMIN'), async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
  });
  res.json(users);
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Name, email and password are required.' });
  }
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return res.status(409).json({ error: 'Conflict', message: 'Email already in use.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
      phone,
    },
  });
  await logAudit({ userId: req.user.id, action: 'EMPLOYEE_CREATED', entity: 'User', entityId: user.id });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.put('/:id', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { name, phone, role, isActive } = req.body;
  const user = await prisma.user.update({
    where: { id },
    data: { name, phone, role: role === 'ADMIN' ? 'ADMIN' : role === 'EMPLOYEE' ? 'EMPLOYEE' : undefined, isActive },
  });
  await logAudit({ userId: req.user.id, action: 'EMPLOYEE_UPDATED', entity: 'User', entityId: id });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
});

router.post('/:id/disable', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.update({ where: { id }, data: { isActive: false } });
  await logAudit({ userId: req.user.id, action: 'EMPLOYEE_DISABLED', entity: 'User', entityId: id });
  res.json({ id: user.id, isActive: user.isActive });
});

router.post('/:id/enable', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.update({ where: { id }, data: { isActive: true } });
  await logAudit({ userId: req.user.id, action: 'EMPLOYEE_ENABLED', entity: 'User', entityId: id });
  res.json({ id: user.id, isActive: user.isActive });
});

router.post('/:id/reset-password', authorize('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 6 characters.' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  await logAudit({ userId: req.user.id, action: 'EMPLOYEE_PASSWORD_RESET', entity: 'User', entityId: id });
  res.json({ message: 'Password reset successfully' });
});

module.exports = router;
