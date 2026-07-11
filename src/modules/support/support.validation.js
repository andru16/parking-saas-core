import { body, param, query } from 'express-validator';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from './constants.js';

export const listSupportValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(Object.values(SUPPORT_STATUSES)),
  query('priority').optional().isIn(Object.values(SUPPORT_PRIORITIES)),
  query('category').optional().isIn(Object.values(SUPPORT_CATEGORIES)),
  query('organizationId').optional().isMongoId(),
  query('search').optional().isString().trim().isLength({ max: 120 }),
];

export const supportIdParam = [param('id').isMongoId().withMessage('ID inválido')];

export const createSupportValidation = [
  body('subject').isString().trim().isLength({ min: 3, max: 200 }),
  body('description').isString().trim().isLength({ min: 5, max: 5000 }),
  body('category').isIn(Object.values(SUPPORT_CATEGORIES)),
  body('priority').optional().isIn(Object.values(SUPPORT_PRIORITIES)),
];

export const replySupportValidation = [
  body('body').isString().trim().isLength({ min: 1, max: 5000 }),
  body('isInternal').optional().isBoolean(),
];

export const statusSupportValidation = [
  body('status').isIn(Object.values(SUPPORT_STATUSES)),
];

export const assignSupportValidation = [
  body('assignedToUserId').optional({ nullable: true }).isMongoId(),
];
