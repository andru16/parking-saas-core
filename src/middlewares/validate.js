import { validationResult } from 'express-validator';
import { ApiError } from '#utils/ApiError.js';

/**
 * Middleware que ejecuta validaciones de express-validator.
 */
export const validate = (validations) => async (req, _res, next) => {
  await Promise.all(validations.map((validation) => validation.run(req)));

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new ApiError(
        400,
        'Error de validación',
        errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
        })),
      ),
    );
  }

  return next();
};
