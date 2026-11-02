const { validationResult } = require('express-validator');

/**
 * Middleware factory for express-validator rules.
 * Runs all validation chains and returns a standard error format if any fail.
 */
const validate = (validations) => {
  return async (req, res, next) => {
    for (const validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const errorArray = errors.array();
    return res.status(400).json({
      success: false,
      message: errorArray[0]?.msg || 'Validation failed',
      errors: errorArray.map((err) => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  };
};

module.exports = validate;

