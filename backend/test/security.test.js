const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const {
  sanitizeText,
  parsePositiveInteger,
  validateEmail,
  isSafeUrl,
  isAllowedRole,
} = require('../src/utils/validation');
const { authorize, createAccessToken } = require('../src/middleware/auth');
const { isTokenRevoked } = require('../src/utils/tokenStore');
const { provisionAdmin } = require('../src/utils/adminProvisioning');

test('sanitizeText trims and limits input without changing its meaning', () => {
  assert.equal(sanitizeText('  Acme  ', 10), 'Acme');
  assert.equal(sanitizeText('A'.repeat(20), 5), 'AAAAA');
  assert.equal(sanitizeText(null, 20), '');
});

test('parsePositiveInteger rejects invalid and unsafe values', () => {
  assert.equal(parsePositiveInteger('42'), 42);
  assert.equal(parsePositiveInteger('0'), null);
  assert.equal(parsePositiveInteger('-1'), null);
  assert.equal(parsePositiveInteger('1.5'), null);
  assert.equal(parsePositiveInteger('1e3'), null);
  assert.equal(parsePositiveInteger(''), null);
});

test('validateEmail accepts normal addresses and rejects malformed values', () => {
  assert.equal(validateEmail('user@example.com'), true);
  assert.equal(validateEmail('user@localhost'), false);
  assert.equal(validateEmail('user example.com'), false);
});

test('isSafeUrl permits HTTPS URLs and rejects script and local schemes', () => {
  assert.equal(isSafeUrl('https://example.com/path'), true);
  assert.equal(isSafeUrl('http://example.com'), false);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeUrl('//example.com'), false);
});

test('isAllowedRole accepts only supported roles', () => {
  assert.equal(isAllowedRole('ADMIN'), true);
  assert.equal(isAllowedRole('EMPLOYEE'), true);
  assert.equal(isAllowedRole('SUPER_ADMIN'), false);
  assert.equal(isAllowedRole(''), false);
});

test('authorize rejects users outside the required role', () => {
  const req = { user: { role: 'EMPLOYEE' } };
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  let called = false;
  authorize('ADMIN')(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.code, 403);
  assert.equal(res.body.error, 'Forbidden');
});

test('authorize permits an allowed role', () => {
  const req = { user: { role: 'ADMIN' } };
  let called = false;
  authorize('ADMIN')(req, { status() { throw new Error('Should not be called'); } }, () => { called = true; });
  assert.equal(called, true);
});

test('createAccessToken includes a unique identifier and uses the configured expiry', () => {
  const secret = 'test-secret-that-is-long-enough-for-validation';
  const token = createAccessToken({ id: 7, role: 'ADMIN' }, secret, '1h');
  const decoded = jwt.verify(token, secret);
  assert.equal(decoded.id, 7);
  assert.equal(decoded.role, 'ADMIN');
  assert.ok(decoded.jti);
  assert.equal(decoded.exp - decoded.iat, 3600);
});

test('isTokenRevoked rejects missing and expired tokens but allows active tokens', async () => {
  const client = {
    tokenBlacklist: {
      findUnique: async ({ where }) => ({
        'token-active': { expiresAt: new Date(Date.now() + 60_000) },
        'token-expired': { expiresAt: new Date(Date.now() - 60_000) },
      })[where.jti] || null,
    },
  };
  assert.equal(await isTokenRevoked('token-active', client), false);
  assert.equal(await isTokenRevoked('token-expired', client), true);
  assert.equal(await isTokenRevoked('token-missing', client), true);
  assert.equal(await isTokenRevoked('', client), false);
});

test('provisionAdmin replaces an existing hash and revokes old sessions', async () => {
  const email = 'admin@example.com';
  const password = 'NewSecureAdmin_2026!';
  const user = {
    id: 7,
    name: 'Admin (Demo)',
    email,
    role: 'ADMIN',
    passwordHash: await bcrypt.hash('PreviousSecureAdmin_2026!', 10),
  };
  let updateCount = 0;
  let revokeCount = 0;
  const prisma = {
    user: {
      findUnique: async () => user,
      update: async ({ data }) => { updateCount += 1; Object.assign(user, data); return user; },
    },
    tokenBlacklist: {
      deleteMany: async ({ where }) => { assert.equal(where.userId, user.id); revokeCount += 1; return { count: 1 }; },
    },
  };

  await provisionAdmin(prisma, email, password);
  assert.equal(await bcrypt.compare(password, user.passwordHash), true);
  assert.equal(user.name, 'Administrator');
  assert.equal(updateCount, 1);
  assert.equal(revokeCount, 1);

  const synchronizedHash = user.passwordHash;
  await provisionAdmin(prisma, email, password);
  assert.equal(user.passwordHash, synchronizedHash);
  assert.equal(updateCount, 1);
  assert.equal(revokeCount, 1);
});
