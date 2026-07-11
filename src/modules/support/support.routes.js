import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './support.controller.js';
import {
  createSupportValidation,
  listSupportValidation,
  replySupportValidation,
  statusSupportValidation,
  supportIdParam,
} from './support.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get('/meta', requirePermission(PERMISSIONS.SUPPORT_VIEW), controller.getMeta);

router.get(
  '/',
  requirePermission(PERMISSIONS.SUPPORT_VIEW),
  validate(listSupportValidation),
  controller.list,
);

router.post(
  '/',
  requirePermission(PERMISSIONS.SUPPORT_CREATE),
  validate(createSupportValidation),
  controller.create,
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.SUPPORT_VIEW),
  validate(supportIdParam),
  controller.getOne,
);

router.post(
  '/:id/replies',
  requirePermission(PERMISSIONS.SUPPORT_REPLY),
  validate([...supportIdParam, ...replySupportValidation]),
  controller.reply,
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.SUPPORT_CLOSE),
  validate([...supportIdParam, ...statusSupportValidation]),
  controller.close,
);

export default router;
