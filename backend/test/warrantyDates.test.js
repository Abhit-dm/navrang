const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDateOnly, addWarrantyDuration, computeWarrantyStatus } = require('../src/utils/warrantyDates');

test('parseDateOnly accepts valid calendar dates and rejects rollover dates', () => {
  assert.equal(parseDateOnly('2024-02-29').toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(parseDateOnly('2025-02-29'), null);
  assert.equal(parseDateOnly('2025-13-01'), null);
  assert.equal(parseDateOnly('2025-2-01'), null);
});

test('year warranty durations clamp leap-year boundaries', () => {
  assert.equal(addWarrantyDuration(parseDateOnly('2025-01-15'), 2).toISOString(), '2027-01-15T00:00:00.000Z');
  assert.equal(addWarrantyDuration(parseDateOnly('2024-02-29'), 1).toISOString(), '2025-02-28T00:00:00.000Z');
  assert.equal(addWarrantyDuration(parseDateOnly('2025-01-31'), 1).toISOString(), '2026-01-31T00:00:00.000Z');
  assert.equal(addWarrantyDuration(parseDateOnly('2025-12-31'), 1).toISOString(), '2026-12-31T00:00:00.000Z');
});

test('warranty status stays valid through the full expiry date', () => {
  const now = new Date('2025-04-30T23:59:59.000Z');
  assert.equal(computeWarrantyStatus(parseDateOnly('2025-04-30'), 0, now), 'EXPIRING SOON');
  assert.equal(computeWarrantyStatus(parseDateOnly('2025-05-01'), 3, now), 'EXPIRING SOON');
  assert.equal(computeWarrantyStatus(parseDateOnly('2025-05-01'), 0, now), 'ACTIVE');
  assert.equal(computeWarrantyStatus(parseDateOnly('2025-04-29'), 30, now), 'EXPIRED');
});
