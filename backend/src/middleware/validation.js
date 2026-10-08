const { ApiError } = require('./errorHandler');

function validateObject(body, rules) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body.');
  }

  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field];
    if (rule.required && (value === undefined || value === null || value === '')) {
      throw new ApiError(400, `${field} is required.`);
    }
    if (value !== undefined && value !== null && !rule.validator(value)) {
      throw new ApiError(400, `${field} is invalid.`);
    }
  }

  return body;
}

module.exports = { validateObject };
