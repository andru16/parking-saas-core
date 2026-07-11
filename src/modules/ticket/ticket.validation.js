import { body, param, query } from 'express-validator';

export const lookupValidation = [
  query('plate').trim().notEmpty().withMessage('La placa es obligatoria para la búsqueda'),
];

export const openEntryValidation = [
  body('plate').optional({ values: 'null' }).trim(),
  body('vehicleId').optional().isMongoId(),
  body('vehicleCategoryId').optional().isMongoId(),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('entrySource').optional().isIn(['manual', 'qr', 'lpr', 'barrier', 'reentry']),
];

export const ticketIdParamValidation = [
  param('id').isMongoId().withMessage('ID de ticket inválido'),
];

export const collectTicketValidation = [
  body('payments').optional().isArray(),
  body('payments.*.method').optional().isString().trim().notEmpty(),
  body('payments.*.amount').optional().isFloat({ min: 0 }),
  body('payments.*.reference').optional().isString().trim().isLength({ max: 100 }),
];

export const cancelTicketValidation = [body('reason').optional().trim().isLength({ max: 300 })];
