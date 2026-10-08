const PLACEHOLDER_SECRET = 'change-this-secret-in-production';

function validateEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === PLACEHOLDER_SECRET) {
    throw new Error('JWT_SECRET must be a strong production secret of at least 32 characters.');
  }
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
    throw new Error('DATABASE_URL must point to a local SQLite database in production.');
  }
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.includes('localhost')) {
    throw new Error('CORS_ORIGIN must be configured to the production frontend origin.');
  }
}

module.exports = { validateEnvironment };
