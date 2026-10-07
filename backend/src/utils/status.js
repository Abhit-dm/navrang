const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];
// Methods recorded before the simplified list was introduced stay valid for old data.
const LEGACY_PAYMENT_METHODS = ['PhonePe', 'Google Pay', 'Debit Card', 'Credit Card', 'Net Banking', 'Wallet', 'Cash on Delivery'];

function isValidPaymentMethod(method) {
  return PAYMENT_METHODS.includes(method) || LEGACY_PAYMENT_METHODS.includes(method);
}

// Overdue is derived from the due date so it never needs a background job.
function invoiceStatus(invoice, now = new Date()) {
  if (invoice.status === 'CANCELLED') return 'CANCELLED';
  if (['PAID', 'REFUNDED'].includes(invoice.paymentStatus)) return invoice.paymentStatus;
  if (invoice.dueDate && invoice.dueAmount > 0 && new Date(invoice.dueDate) < now) return 'OVERDUE';
  return invoice.paymentStatus;
}

function withStatus(invoice) {
  return { ...invoice, displayStatus: invoiceStatus(invoice) };
}

function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

module.exports = { PAYMENT_METHODS, isValidPaymentMethod, invoiceStatus, withStatus, parseDate };
