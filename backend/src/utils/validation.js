const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLE_PATTERN = /^(ADMIN|EMPLOYEE)$/;

function sanitizeText(value, maxLength = 500) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, Math.max(1, Number(maxLength) || 1));
}

function parsePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 && value <= max ? value : null;
  }
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
}

function validateEmail(value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

function isStrongPassword(value) {
  return typeof value === 'string'
    && value.length >= 12
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

function isSafeUrl(value, allowedProtocols = ['https:']) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const url = new URL(value.trim());
    return allowedProtocols.includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isAllowedRole(value) {
  return typeof value === 'string' && ROLE_PATTERN.test(value);
}

function validateBody(body, schema) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.entries(schema).every(([field, validator]) => validator(body[field]));
}

module.exports = {
  sanitizeText,
  parsePositiveInteger,
  validateEmail,
  isStrongPassword,
  isSafeUrl,
  isAllowedRole,
  validateBody,
};
