export function formatCurrency(amount) {
  const n = Number(amount || 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN');
}

export function statusBadgeClass(status) {
  const s = (status || '').toUpperCase();
  if (['PAID', 'ACTIVE', 'IN STOCK', 'RESOLVED', 'APPROVED', 'CLOSED'].includes(s)) return 'badge badge-success';
  if (['PARTIALLY PAID', 'LOW STOCK', 'EXPIRING SOON', 'PENDING', 'OPEN', 'NEW', 'CONTACTED'].includes(s)) return 'badge badge-warn';
  if (['CANCELLED', 'OUT OF STOCK', 'EXPIRED', 'REJECTED', 'REFUNDED', 'OVERDUE'].includes(s)) return 'badge badge-danger';
  return 'badge badge-muted';
}

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];
export const PAYMENT_STATUSES = ['PAID', 'PARTIALLY PAID', 'PENDING', 'OVERDUE'];

// yyyy-mm-dd for <input type="date">
export function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const digits = (v) => String(v || '').replace(/\D/g, '');

export function telLink(phone) {
  const d = digits(phone);
  return d ? `tel:+${d.length === 10 ? `91${d}` : d}` : undefined;
}

export function whatsappLink(phone, text) {
  const d = digits(phone);
  if (!d) return undefined;
  const number = d.length === 10 ? `91${d}` : d;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
