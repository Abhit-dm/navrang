const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required.' });
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  await logAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
  });
});

router.post('/logout', authenticate, async (req, res) => {
  await logAudit({ userId: req.user.id, action: 'LOGOUT', entity: 'User', entityId: req.user.id });
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone });
});

module.exports = router;
