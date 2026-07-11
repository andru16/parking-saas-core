import { body, param, query } from 'express-validator';

export const openCashRegisterValidation = [
  body('cashPointId').optional().isMongoId().withMessage('Punto de caja inválido'),
  body('openingAmount').optional().isFloat({ min: 0 }).withMessage('Fondo inicial inválido'),
  body('openingNotes').optional().isString().trim().isLength({ max: 500 }),
];

export const closeCashRegisterValidation = [
  body('closingAmount').isFloat({ min: 0 }).withMessage('Monto de cierre inválido'),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
  body('confirmed').custom((value) => {
    if (value === true || value === 'true') return true;
    throw new Error('Debe confirmar el cierre de caja');
  }),
];

export const sessionIdParamValidation = [
  param('id').isMongoId().withMessage('ID de sesión inválido'),
];

export const historyQueryValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];
