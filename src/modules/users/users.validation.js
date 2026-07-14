import { body, param } from 'express-validator';
import {
  assertEmail,
  assertPersonName,
  assertPhone,
  EMAIL_MESSAGE,
  PHONE_MESSAGE,
} from '#utils/fieldValidation.js';

export const userIdParam = [param('userId').isMongoId()];
export const roleIdParam = [param('roleId').isMongoId()];

export const createUserValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ max: 80 })
    .custom((value) => assertPersonName(value, 'El nombre')),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Los apellidos son obligatorios')
    .isLength({ max: 80 })
    .custom((value) => assertPersonName(value, 'Los apellidos')),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El correo es obligatorio')
    .custom((value) => assertEmail(value))
    .withMessage(EMAIL_MESSAGE)
    .normalizeEmail(),
  body('organizationRoleId').isMongoId(),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .custom((value) => assertPhone(value))
    .withMessage(PHONE_MESSAGE),
  body('password').optional().isLength({ min: 8 }),
  body('status').optional().isIn(['active', 'inactive']),
];

export const updateUserValidation = [
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ max: 80 })
    .custom((value) => assertPersonName(value, 'El nombre')),
  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Los apellidos son obligatorios')
    .isLength({ max: 80 })
    .custom((value) => assertPersonName(value, 'Los apellidos')),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .custom((value) => assertPhone(value))
    .withMessage(PHONE_MESSAGE),
  body('organizationRoleId').optional().isMongoId(),
  body('status').optional().isIn(['active', 'inactive']),
];

export const createRoleValidation = [
  body('name').trim().notEmpty(),
  body('key').optional().isString(),
  body('description').optional().isString(),
  body('permissions').optional().isArray(),
  body('isActive').optional().isBoolean(),
];

export const updateRoleValidation = [
  body('name').optional().trim().notEmpty(),
  body('description').optional().isString(),
  body('permissions').optional().isArray(),
  body('isActive').optional().isBoolean(),
];
