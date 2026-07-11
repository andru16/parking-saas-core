import { body, param, query } from 'express-validator';
import { BACKUP_FREQUENCIES, STORAGE_PROVIDERS } from './constants.js';

export const listBackupsValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString().trim(),
];

export const backupIdParam = [param('id').isMongoId().withMessage('ID de backup inválido')];

export const updateConfigValidation = [
  body('enabled').optional().isBoolean(),
  body('frequency').optional().isIn(Object.values(BACKUP_FREQUENCIES)),
  body('hour').optional().isInt({ min: 0, max: 23 }),
  body('minute').optional().isInt({ min: 0, max: 59 }),
  body('retentionDays').optional().isInt({ min: 1, max: 3650 }),
  body('retentionCount').optional().isInt({ min: 1, max: 500 }),
  body('storageProvider').optional().isIn(Object.values(STORAGE_PROVIDERS)),
  body('includeAuditLogs').optional().isBoolean(),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
];

export const runManualValidation = [
  body('notes').optional().isString().trim().isLength({ max: 500 }),
];

export const restoreValidation = [
  body('confirm')
    .custom((value) => value === true || value === 'true')
    .withMessage('Debe confirmar la restauración'),
  body('confirmationPhrase')
    .isString()
    .trim()
    .equals('RESTAURAR')
    .withMessage('Frase de confirmación inválida'),
];
