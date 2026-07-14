import { body, param, query } from 'express-validator';
import {
  assertEmail,
  assertPersonName,
  assertPhone,
  EMAIL_MESSAGE,
  PHONE_MESSAGE,
} from '#utils/fieldValidation.js';

export const memberIdParam = [param('memberId').isMongoId()];
export const vehicleIdParam = [param('vehicleId').isMongoId()];

const assertMemberName = (value, { req }) => {
  if (req.body.memberType === 'company') {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('El nombre es obligatorio');
    }
    return true;
  }
  return assertPersonName(value, 'El nombre');
};

export const listMembersValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['active', 'inactive']),
  query('search').optional().isString().trim().isLength({ max: 120 }),
];

export const createMemberValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ max: 150 })
    .custom(assertMemberName),
  body('memberType').optional().isIn(['person', 'company']),
  body('documentType').optional().isIn(['CC', 'CE', 'NIT', 'PASSPORT', 'OTHER']),
  body('documentNumber').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .custom((value) => assertEmail(value))
    .withMessage(EMAIL_MESSAGE)
    .normalizeEmail(),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .custom((value) => assertPhone(value))
    .withMessage(PHONE_MESSAGE),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body('status').optional().isIn(['active', 'inactive']),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];

export const updateMemberValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ max: 150 })
    .custom(assertMemberName),
  body('memberType').optional().isIn(['person', 'company']),
  body('documentType').optional().isIn(['CC', 'CE', 'NIT', 'PASSPORT', 'OTHER']),
  body('documentNumber').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .custom((value) => assertEmail(value))
    .withMessage(EMAIL_MESSAGE)
    .normalizeEmail(),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .custom((value) => assertPhone(value))
    .withMessage(PHONE_MESSAGE),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body('status').optional().isIn(['active', 'inactive']),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];

export const linkVehicleValidation = [body('vehicleId').isMongoId()];
