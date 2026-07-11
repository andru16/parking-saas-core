import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './backup.controller.js';
import {
  backupIdParam,
  listBackupsValidation,
  restoreValidation,
  runManualValidation,
  updateConfigValidation,
} from './backup.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get('/status', requirePermission(PERMISSIONS.BACKUPS_VIEW), controller.getStatus);

router.get('/config', requirePermission(PERMISSIONS.BACKUPS_MANAGE), controller.getConfig);

router.put(
  '/config',
  requirePermission(PERMISSIONS.BACKUPS_MANAGE),
  validate(updateConfigValidation),
  controller.updateConfig,
);

router.get(
  '/',
  requirePermission(PERMISSIONS.BACKUPS_VIEW),
  validate(listBackupsValidation),
  controller.list,
);

router.post(
  '/run',
  requirePermission(PERMISSIONS.BACKUPS_MANAGE),
  validate(runManualValidation),
  controller.runManual,
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.BACKUPS_VIEW),
  validate(backupIdParam),
  controller.getOne,
);

router.get(
  '/:id/download',
  requirePermission(PERMISSIONS.BACKUPS_MANAGE),
  validate(backupIdParam),
  controller.download,
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.BACKUPS_MANAGE),
  validate(backupIdParam),
  controller.remove,
);

router.get(
  '/:id/restore/preview',
  requirePermission(PERMISSIONS.BACKUPS_RESTORE),
  validate(backupIdParam),
  controller.restorePreview,
);

router.post(
  '/:id/restore',
  requirePermission(PERMISSIONS.BACKUPS_RESTORE),
  validate([...backupIdParam, ...restoreValidation]),
  controller.restore,
);

export default router;
