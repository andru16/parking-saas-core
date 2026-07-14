import { body, param, query } from 'express-validator';
import {
  assertEmail,
  assertPersonName,
  assertPhone,
  EMAIL_MESSAGE,
  PHONE_MESSAGE,
} from '#utils/fieldValidation.js';

export const membershipIdParam = [param('id').isMongoId()];

export const listMembershipsValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['active', 'expired', 'suspended', 'cancelled', 'expiring']),
  query('search').optional().isString().trim().isLength({ max: 120 }),
];

export const createMembershipValidation = [
  body('memberId').optional().isMongoId(),
  body('vehicleId').optional().isMongoId(),
  body('plate').optional().isString().trim().isLength({ min: 3, max: 15 }),
  body('vehicleCategoryId').optional().isMongoId(),
  body('member').optional().isObject(),
  body('member.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El nombre del cliente es obligatorio')
    .isLength({ max: 150 })
    .custom((value) => assertPersonName(value, 'El nombre')),
  body('member.documentType').optional().isIn(['CC', 'CE', 'NIT', 'PASSPORT', 'OTHER']),
  body('member.documentNumber').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('member.email')
    .optional({ values: 'falsy' })
    .trim()
    .custom((value) => assertEmail(value))
    .withMessage(EMAIL_MESSAGE)
    .normalizeEmail(),
  body('member.phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .custom((value) => assertPhone(value))
    .withMessage(PHONE_MESSAGE),
  body('member.address').optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body('member.notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body().custom((_, { req }) => {
    const hasMember = Boolean(req.body.memberId) || Boolean(req.body.member?.name);
    const hasVehicle = Boolean(req.body.vehicleId) || Boolean(req.body.plate);
    if (!hasMember) {
      throw new Error('Debe indicar un cliente existente o los datos del nuevo cliente');
    }
    if (!hasVehicle) {
      throw new Error('Debe indicar un vehículo o una placa');
    }
    return true;
  }),
  body('name').optional().trim().isLength({ max: 100 }),
  body('membershipType').optional().trim().isLength({ max: 100 }),
  body('startDate').isISO8601().toDate(),
  body('endDate').isISO8601().toDate(),
  body('amount').optional().isFloat({ min: 0 }).toFloat(),
  body('autoRenew').optional().isBoolean().toBoolean(),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];

export const updateMembershipValidation = [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('membershipType').optional().trim().isLength({ max: 100 }),
  body('startDate').optional().isISO8601().toDate(),
  body('endDate').optional().isISO8601().toDate(),
  body('amount').optional().isFloat({ min: 0 }).toFloat(),
  body('autoRenew').optional().isBoolean().toBoolean(),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];

export const statusMembershipValidation = [
  body('status').isIn(['active', 'expired', 'suspended', 'cancelled']),
];

export const renewMembershipValidation = [
  body('days').optional().isInt({ min: 1, max: 730 }).toInt(),
  body('amount').optional().isFloat({ min: 0 }).toFloat(),
  body('method').optional().isString().trim(),
  body('recordPayment').optional().isBoolean().toBoolean(),
  body('notes').optional({ nullable: true }).isString(),
];

export const createMembershipPaymentValidation = [
  body('memberId').isMongoId(),
  body('vehicleId').optional({ nullable: true }).isMongoId(),
  body('parkingMembershipId').optional({ nullable: true }).isMongoId(),
  body('amount').isFloat({ min: 0 }).toFloat(),
  body('method').trim().notEmpty(),
  body('paidAt').optional().isISO8601().toDate(),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('kind').optional().isIn(['new', 'renewal', 'other']),
];
