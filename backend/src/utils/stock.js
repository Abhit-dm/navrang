const prisma = require('../lib/prisma');

// Reduce stock FIFO across inventory batches for a product. Throws if insufficient (unless allowNegative).
async function reduceStock(productId, quantity, userId, reference, movementType = 'SALE', db = prisma) {
  const settings = await db.businessSettings.findFirst();
  const allowNegative = settings?.allowNegativeStock || false;

  const agg = await db.inventory.aggregate({
    where: { productId, disposition: 'AVAILABLE' },
    _sum: { quantity: true },
  });
  const current = agg._sum.quantity || 0;
  if (!allowNegative && current < quantity) {
    const err = new Error('Insufficient stock');
    err.status = 400;
    throw err;
  }

  let remaining = quantity;
  let cogsTotal = 0;
  const batches = await db.inventory.findMany({
    where: { productId, quantity: { gt: 0 }, disposition: 'AVAILABLE' },
    orderBy: { createdAt: 'asc' },
  });
  for (const batch of batches) {
    if (remaining <= 0) break;
    const deduct = Math.min(batch.quantity, remaining);
    await db.inventory.update({ where: { id: batch.id }, data: { quantity: batch.quantity - deduct } });
    cogsTotal += deduct * batch.purchasePrice;
    remaining -= deduct;
  }
  if (remaining > 0) {
    // allowNegative case, no batch left — use product's purchase price as fallback
    const product = await db.product.findUnique({ where: { id: productId } });
    cogsTotal += remaining * (product?.purchasePrice || 0);
  }

  await db.stockMovement.create({
    data: { productId, type: movementType, quantity, reference, userId },
  });

  const avgCost = quantity > 0 ? cogsTotal / quantity : 0;
  return avgCost;
}

module.exports = { reduceStock };
