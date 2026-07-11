import { body, param } from 'express-validator';

export const ticketIdParamValidation = [
  param('ticketId').isMongoId().withMessage('ID de ticket inválido'),
];

export const paymentIdParamValidation = [
  param('id').isMongoId().withMessage('ID de pago inválido'),
];

export const reversePaymentValidation = [
  body('reason').trim().notEmpty().withMessage('El motivo del reverso es obligatorio'),
  body('reason').isLength({ max: 300 }),
];

export const paymentLineValidation = [
  body('payments').optional().isArray(),
  body('payments.*.method').optional().isString().trim().notEmpty(),
  body('payments.*.amount').optional().isFloat({ min: 0 }),
  body('payments.*.reference').optional().isString().trim().isLength({ max: 100 }),
];
