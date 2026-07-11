import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireOrganizationReadAccess,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './notification.controller.js';
import {
  createNotificationValidation,
  listNotificationsValidation,
  notificationIdParam,
} from './notification.validation.js';

const router = Router();

router.use(authenticate, requireOrganizationReadAccess);

router.get('/meta', controller.metaOrgNotifications);
router.get('/unread-count', controller.unreadOrgCount);
router.get('/', validate(listNotificationsValidation), controller.listOrgNotifications);
router.post(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.USERS_MANAGE),
  validate(createNotificationValidation),
  controller.createOrgNotification,
);
router.get(
  '/:notificationId',
  validate(notificationIdParam),
  controller.getOrgNotification,
);
router.patch(
  '/:notificationId/read',
  validate(notificationIdParam),
  controller.markOrgRead,
);
router.post('/read-all', controller.markOrgAllRead);
router.delete(
  '/:notificationId',
  validate(notificationIdParam),
  controller.deleteOrgNotification,
);

export default router;
