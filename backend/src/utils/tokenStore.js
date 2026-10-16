const prisma = require('../lib/prisma');

async function registerToken(jti, userId, expiresAt) {
  if (!jti || !Number.isInteger(userId) || !Number.isFinite(expiresAt)) return false;
  await prisma.tokenBlacklist.upsert({
    where: { jti },
    update: { userId, expiresAt: new Date(expiresAt) },
    create: { jti, userId, expiresAt: new Date(expiresAt) },
  });
  return true;
}

async function revokeToken(jti, userId) {
  if (!jti) return false;
  const result = await prisma.tokenBlacklist.deleteMany({
    where: { jti, userId },
  });
  return result.count > 0;
}

async function revokeUserTokens(userId) {
  if (!Number.isInteger(userId)) return 0;
  const result = await prisma.tokenBlacklist.deleteMany({
    where: { userId },
  });
  return result.count;
}

async function isTokenRevoked(jti, client = prisma) {
  if (!jti) return false;
  const active = await client.tokenBlacklist.findUnique({ where: { jti } });
  return !active || active.expiresAt <= new Date();
}

async function pruneExpiredTokens() {
  await prisma.tokenBlacklist.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
}

module.exports = { registerToken, revokeToken, revokeUserTokens, isTokenRevoked, pruneExpiredTokens };
