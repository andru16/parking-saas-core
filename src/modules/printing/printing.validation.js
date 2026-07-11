import { body, param, query } from 'express-validator';
import { PRINTABLE_TYPES } from '#services/printing/constants.js';

export const ticketIdParamValidation = [
  param('ticketId').isMongoId().withMessage('ticketId inválido'),
];

export const cashRegisterIdParamValidation = [
  param('cashRegisterId').isMongoId().withMessage('cashRegisterId inválido'),
];

export const membershipIdParamValidation = [
  param('membershipId').isMongoId().withMessage('membershipId inválido'),
];

export const paymentIdParamValidation = [
  param('paymentId').isMongoId().withMessage('paymentId inválido'),
];

export const documentQueryValidation = [
  query('type').optional().isIn([...PRINTABLE_TYPES]),
  query('format').optional().isIn(['html', 'text', 'pdf', 'escpos']),
  query('adapter').optional().isIn(['browser', 'escpos', 'pdf', 'text', 'bluetooth', 'lan', 'usb']),
];

export const previewValidation = [
  body('type').optional().isIn([...PRINTABLE_TYPES.filter((t) => t !== 'auto')]),
  body('format').optional().isIn(['html', 'text', 'pdf', 'escpos']),
  body('adapter').optional().isIn(['browser', 'escpos', 'pdf', 'text', 'bluetooth', 'lan', 'usb']),
];

export const reprintValidation = [
  body('reason').trim().notEmpty().withMessage('El motivo de reimpresión es obligatorio'),
  body('type').optional().isIn([...PRINTABLE_TYPES]),
  body('format').optional().isIn(['html', 'text', 'pdf', 'escpos']),
  body('adapter').optional().isIn(['browser', 'escpos', 'pdf', 'text', 'bluetooth', 'lan', 'usb']),
  body('ticketId').optional().isMongoId(),
  body('cashRegisterId').optional().isMongoId(),
  body('membershipId').optional().isMongoId(),
  body('paymentId').optional().isMongoId(),
];

export const listJobsValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('resourceType').optional().isIn(['ticket', 'cash_register', 'membership', 'payment', 'preview']),
  query('resourceId').optional().isMongoId(),
];
