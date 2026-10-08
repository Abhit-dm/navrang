const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { isTokenRevoked, registerToken } = require('../utils/tokenStore');

function isAllowedSecret(secret) {
  return typeof secret === 'string' && secret.length >= 32;
}

function createAccessToken(user, secret = process.env.JWT_SECRET, expiresIn = process.env.JWT_EXPIRES_IN || '8h') {
  if (!isAllowedSecret(secret)) throw new Error('JWT_SECRET must be at least 32 characters long.');
  if (!Number.isFinite(Number(expiresIn)) && !/^[0-9]+(s|m|h|d)$/.test(String(expiresIn))) {
    throw new Error('JWT_EXPIRES_IN must be a valid duration.');
  }
  const jti = crypto.randomUUID();
  return jwt.sign({ id: user.id, role: user.role, jti }, secret, { expiresIn });
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Number(process.env.JWT_EXPIRES_IN_MINUTES || 480) * 60 * 1000,
    path: '/',
  };
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const cookieToken = req.cookies?.accessToken;
    const token = cookieToken || (header.startsWith('Bearer ') ? header.slice(7).trim() : null);
    if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id || !decoded.jti || await isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or revoked token' });
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive || user.role !== decoded.role) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or disabled account' });
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    req.token = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, createAccessToken, cookieOptions };
