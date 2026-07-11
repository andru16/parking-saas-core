import { body, param } from 'express-validator';

export const userIdParam = [param('userId').isMongoId()];
export const roleIdParam = [param('roleId').isMongoId()];

export const createUserValidation = [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('email').trim().isEmail().normalizeEmail(),
  body('organizationRoleId').isMongoId(),
  body('phone').optional({ nullable: true }).isString(),
  body('password').optional().isLength({ min: 8 }),
  body('status').optional().isIn(['active', 'inactive']),
];

export const updateUserValidation = [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional({ nullable: true }).isString(),
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
