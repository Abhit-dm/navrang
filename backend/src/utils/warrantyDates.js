const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function addWarrantyDuration(start, years) {
  const monthIndex = start.getUTCFullYear() * 12 + start.getUTCMonth() + years * 12;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const day = Math.min(start.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day));
}

function computeWarrantyStatus(endDate, expiryDays, now = new Date()) {
  const end = new Date(endDate);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiry = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const daysUntilExpiry = Math.floor((expiry - today) / DAY_MS);
  if (daysUntilExpiry < 0) return 'EXPIRED';
  if (daysUntilExpiry <= Math.max(0, Number(expiryDays) || 0)) return 'EXPIRING SOON';
  return 'ACTIVE';
}

module.exports = { parseDateOnly, addWarrantyDuration, computeWarrantyStatus };
