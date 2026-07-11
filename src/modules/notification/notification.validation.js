import { body, param, query } from 'express-validator';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
} from '#services/notifications/notification.events.js';

export const listNotificationsValidation = [
  query('search').optional().trim().isLength({ max: 120 }),
  query('type').optional().isIn(Object.values(NOTIFICATION_TYPES)),
  query('category').optional().isIn(Object.values(NOTIFICATION_CATEGORIES)),
  query('priority').optional().isIn([...Object.values(NOTIFICATION_PRIORITIES), 'normal']),
  query('unreadOnly').optional().isIn(['true', 'false', '1', '0']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const notificationIdParam = [
  param('notificationId').isMongoId().withMessage('ID inválido'),
];

export const createNotificationValidation = [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('message').optional().trim().isLength({ max: 2000 }),
  body('body').optional().trim().isLength({ max: 2000 }),
  body('type').optional().isIn(Object.values(NOTIFICATION_TYPES)),
  body('category').optional().isIn(Object.values(NOTIFICATION_CATEGORIES)),
  body('priority').optional().isIn([...Object.values(NOTIFICATION_PRIORITIES), 'normal']),
  body('event').optional().trim().isLength({ max: 120 }),
  body('actionUrl').optional().trim().isLength({ max: 500 }),
  body('userId').optional({ nullable: true }).isMongoId(),
  body('metadata').optional().isObject(),
];
