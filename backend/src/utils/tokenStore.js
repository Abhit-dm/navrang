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
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await prisma.tokenBlacklist.upsert({
    where: { jti },
    update: { userId, expiresAt },
    create: { jti, userId, expiresAt },
  });
  return true;
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
  const revoked = await client.tokenBlacklist.findUnique({ where: { jti } });
  return Boolean(revoked && revoked.expiresAt > new Date());
}

async function pruneExpiredTokens() {
  await prisma.tokenBlacklist.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
}

module.exports = { registerToken, revokeToken, revokeUserTokens, isTokenRevoked, pruneExpiredTokens };
