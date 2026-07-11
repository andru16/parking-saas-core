import { body, param, query } from 'express-validator';

export const memberIdParam = [param('memberId').isMongoId()];
export const vehicleIdParam = [param('vehicleId').isMongoId()];

export const listMembersValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['active', 'inactive']),
  query('search').optional().isString().trim().isLength({ max: 120 }),
];

export const createMemberValidation = [
  body('name').trim().notEmpty().isLength({ max: 150 }),
  body('memberType').optional().isIn(['person', 'company']),
  body('documentType').optional().isIn(['CC', 'CE', 'NIT', 'PASSPORT', 'OTHER']),
  body('documentNumber').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body('status').optional().isIn(['active', 'inactive']),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];

export const updateMemberValidation = [
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('memberType').optional().isIn(['person', 'company']),
  body('documentType').optional().isIn(['CC', 'CE', 'NIT', 'PASSPORT', 'OTHER']),
  body('documentNumber').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body('status').optional().isIn(['active', 'inactive']),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];

export const linkVehicleValidation = [body('vehicleId').isMongoId()];
