import { body } from 'express-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Validaciones para login (pendiente de activación en rutas).
 */
export const loginValidation = [
  body('email').trim().isEmail().withMessage('Formato de correo inválido').normalizeEmail(),
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
  body('email').trim().isEmail().withMessage('Formato de correo inválido').normalizeEmail(),
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
