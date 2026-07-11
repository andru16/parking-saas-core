import { query, param } from 'express-validator';

export const listAuditValidation = [
  query('search').optional().trim().isLength({ max: 120 }),
  query('module').optional().trim().isLength({ max: 50 }),
  query('action').optional().trim().isLength({ max: 80 }),
  query('result').optional().isIn(['success', 'error']),
  query('userType').optional().isIn(['platform_user', 'organization_user', 'system']),
  query('userId').optional().isMongoId(),
  query('organizationId').optional().isMongoId(),
  query('entityType').optional().trim().isLength({ max: 60 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const exportAuditValidation = [
  ...listAuditValidation,
  query('format').optional().isIn(['csv', 'xlsx', 'pdf']),
];

export const auditIdParam = [param('auditId').isMongoId().withMessage('ID inválido')];
