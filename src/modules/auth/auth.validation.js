import { body } from 'express-validator';
import {
  assertBotGuard,
  assertEmail,
  BOT_REJECT_MESSAGE,
  EMAIL_MESSAGE,
} from '#utils/fieldValidation.js';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Validaciones para login.
 */
export const loginValidation = [
  body().custom((_, { req }) =>
    assertBotGuard({
      website: req.body?.website,
      formStartedAt: req.body?.formStartedAt,
    }),
  ),
  body('website').optional({ values: 'falsy' }).isString().isLength({ max: 0 }).withMessage(BOT_REJECT_MESSAGE),
  body('formStartedAt')
    .notEmpty()
    .withMessage(BOT_REJECT_MESSAGE)
    .isNumeric()
    .withMessage(BOT_REJECT_MESSAGE),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El correo es obligatorio')
    .custom((value) => assertEmail(value))
    .withMessage(EMAIL_MESSAGE)
    .normalizeEmail(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
];

/**
 * Validaciones para refresh token (pendiente de activación).
 */
export const refreshValidation = [];

/**
 * Validaciones para recuperación de contraseña (pendiente de activación).
 */
export const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El correo es obligatorio')
    .custom((value) => assertEmail(value))
    .withMessage(EMAIL_MESSAGE)
    .normalizeEmail(),
];

/**
 * Validaciones para restablecimiento de contraseña (pendiente de activación).
 */
export const resetPasswordValidation = [
  body('token').notEmpty().withMessage('El token es obligatorio'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(PASSWORD_REGEX)
    .withMessage('La contraseña debe incluir mayúsculas, minúsculas y números'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('La confirmación de contraseña es obligatoria')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
];
