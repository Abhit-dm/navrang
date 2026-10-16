const bcrypt = require('bcryptjs');

async function provisionAdmin(prisma, email, password) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'ADMIN') {
    throw new Error(`Configured admin email belongs to a non-admin account: ${email}`);
  }

  const passwordMatches = existing && await bcrypt.compare(password, existing.passwordHash);
  const data = {};
  if (!passwordMatches) data.passwordHash = await bcrypt.hash(password, 10);
  if (existing?.name === 'Admin (Demo)') data.name = 'Administrator';

  if (!existing) {
    return prisma.user.create({
      data: { name: 'Administrator', email, passwordHash: data.passwordHash, role: 'ADMIN' },
    });
  }

  if (Object.keys(data).length === 0) return existing;
  const user = await prisma.user.update({ where: { id: existing.id }, data });
  if (!passwordMatches) {
    await prisma.tokenBlacklist.deleteMany({ where: { userId: existing.id } });
  }
  return user;
}

module.exports = { provisionAdmin };