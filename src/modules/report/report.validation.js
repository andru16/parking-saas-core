import { query, param } from 'express-validator';

export const dashboardQueryValidation = [
  query('organizationId').optional().isMongoId(),
  query('days').optional().isInt({ min: 7, max: 90 }),
];

export const reportFiltersValidation = [
  query('from')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Fecha inválida (YYYY-MM-DD)'),
  query('to')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Fecha inválida (YYYY-MM-DD)'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('vehicleCategoryId').optional().isMongoId(),
  query('status').optional().isString().trim(),
  query('cashRegisterId').optional().isMongoId(),
  query('userId').optional().isMongoId(),
  query('paymentMethod').optional().isString().trim(),
  query('memberId').optional().isMongoId(),
  query('membershipScope')
    .optional()
    .isIn(['active', 'expired', 'expiring', 'renewals', 'vencidas', 'por_vencer', 'renovaciones']),
  query('organizationId').optional().isMongoId(),
];

export const reportTypeParamValidation = [param('type').isString().trim().notEmpty()];

export const exportFormatValidation = [
  query('format').isIn(['csv', 'xlsx', 'pdf']).withMessage('Formato inválido'),
];
