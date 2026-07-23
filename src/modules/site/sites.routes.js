import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { requirePlanFeature } from '#middlewares/requirePlanFeature.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './sites.controller.js';
import {
  createSiteValidation,
  siteIdParam,
  updateSiteValidation,
} from './sites.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get('/', requirePermission(PERMISSIONS.SETTINGS_MANAGE), controller.list);

router.post(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  requirePlanFeature('multi_site'),
  validate(createSiteValidation),
  controller.create,
);

router.get(
  '/:siteId',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(siteIdParam),
  controller.getOne,
);

router.put(
  '/:siteId',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate([...siteIdParam, ...updateSiteValidation]),
  controller.update,
);

export default router;
