import { body, param, query } from 'express-validator';
import { ACTIVATION_REQUEST_STATUSES } from './subscriptionActivationRequest.model.js';
import {
  assertEmail,
  assertPhone,
  EMAIL_MESSAGE,
  PHONE_MESSAGE,
} from '#utils/fieldValidation.js';

export const activationIdParam = [
  param('id').isMongoId().withMessage('ID de solicitud inválido'),
];

export const createActivationValidation = [
  body('company')
    .trim()
    .notEmpty()
    .withMessage('La empresa es obligatoria')
    .isLength({ max: 150 }),
  body('contactName')
    .trim()
    .notEmpty()
    .withMessage('El nombre de contacto es obligatorio')
    .isLength({ max: 120 }),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El correo es obligatorio')
    .custom((value) => assertEmail(value))
    .withMessage(EMAIL_MESSAGE)
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('El teléfono es obligatorio')
    .custom((value) => assertPhone(value))
    .withMessage(PHONE_MESSAGE)
    .isLength({ max: 30 }),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('La ciudad es obligatoria')
    .isLength({ max: 100 }),
  body('dailyVehicles')
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max: 1_000_000 })
    .withMessage('Cantidad de vehículos inválida')
    .toInt(),
  body('branches')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 500 })
    .withMessage('Cantidad de sedes inválida')
    .toInt(),
  body('schedule').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('comments').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
];

export const listActivationValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status')
    .optional()
    .isIn([...ACTIVATION_REQUEST_STATUSES])
    .withMessage('Estado inválido'),
  query('search').optional().isString().isLength({ max: 120 }),
  query('sort').optional().isIn(['createdAt', 'status', 'company', 'updatedAt']),
  query('order').optional().isIn(['asc', 'desc']),
];

export const setStatusValidation = [
  body('status')
    .isIn(['PENDING', 'IN_REVIEW'])
    .withMessage('Estado inválido'),
  body('adminNotes').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
];

export const approveValidation = [
  body('startDate')
    .notEmpty()
    .withMessage('La fecha de inicio es obligatoria')
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  body('endDate')
    .notEmpty()
    .withMessage('La fecha de vencimiento es obligatoria')
    .isISO8601()
    .withMessage('Fecha de vencimiento inválida'),
  body('adminNotes').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
];

export const rejectValidation = [
  body('adminNotes').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
];
