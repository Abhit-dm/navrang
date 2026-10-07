const prisma = require('../lib/prisma');

async function logAudit({ userId, action, entity, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entity: entity || null,
        entityId: entityId ? String(entityId) : null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAudit };
