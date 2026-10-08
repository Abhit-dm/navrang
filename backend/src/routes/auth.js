const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { authenticate, createAccessToken, cookieOptions } = require('../middleware/auth');
const { loginLimiter, loginSlowDown } = require('../middleware/rateLimit');
const { logAudit } = require('../utils/audit');
const { registerToken, revokeToken } = require('../utils/tokenStore');
const { validateEmail, isStrongPassword } = require('../utils/validation');

const router = express.Router();

router.post('/login', loginLimiter, loginSlowDown, async (req, res) => {
  const { email, password } = req.body;
  if (!validateEmail(email) || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'A valid email and password are required.' });
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
  }
  const token = createAccessToken(user);
  const decoded = jwt.decode(token);
  await registerToken(decoded.jti, user.id, decoded.exp * 1000);
  await logAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id });
  res.cookie('accessToken', token, cookieOptions());
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
  });
});

router.post('/logout', authenticate, async (req, res) => {
  await revokeToken(req.token.jti, req.user.id);
  await logAudit({ userId: req.user.id, action: 'LOGOUT', entity: 'User', entityId: req.user.id });
  res.clearCookie('accessToken', { path: '/' });
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone });
});

module.exports = router;
