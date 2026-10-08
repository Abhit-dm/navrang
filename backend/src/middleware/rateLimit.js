const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too Many Attempts', message: 'Please wait 15 minutes before trying again.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayMs: 400,
  maxDelayMs: 5000,
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { loginLimiter, loginSlowDown };
