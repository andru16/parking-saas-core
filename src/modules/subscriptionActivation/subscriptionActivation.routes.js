import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireOrganizationReadAccess,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './subscriptionActivation.controller.js';
import {
  activationIdParam,
  createActivationValidation,
  listActivationValidation,
} from './subscriptionActivation.validation.js';

const router = Router();

/**
 * Lectura (no requireActiveOrganization) para awaiting_activation / trial vencido.
 */
router.use(authenticate, requireOrganizationReadAccess);

router.get('/meta', controller.getMeta);
router.get('/support-contact', controller.getSupportContact);
router.get('/welcome', controller.getWelcome);
router.post('/start-premium-trial', controller.startPremiumTrial);

router.get(
  '/requests',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(listActivationValidation),
  controller.listMine,
);

router.post(
  '/requests',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(createActivationValidation),
  controller.createRequest,
);

router.get(
  '/requests/:id',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(activationIdParam),
  controller.getMine,
);

export default router;
