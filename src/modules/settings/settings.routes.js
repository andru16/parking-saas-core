import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requireOrganizationReadAccess,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as settingsController from './settings.controller.js';
import {
  sectionKeyParamValidation,
  sectionValidationMap,
} from './settings.validation.js';

const router = Router();

const validateSectionBody = (req, res, next) => {
  const bodyValidations = sectionValidationMap[req.params.sectionKey] ?? [];
  return validate([...sectionKeyParamValidation, ...bodyValidations])(req, res, next);
};

router.use(authenticate);
router.use(requirePermission(PERMISSIONS.SETTINGS_MANAGE));

router.get('/', requireOrganizationReadAccess, settingsController.listSections);

router.get(
  '/sections/:sectionKey',
  requireOrganizationReadAccess,
  validate(sectionKeyParamValidation),
  settingsController.getSection,
);

router.put(
  '/sections/:sectionKey',
  requireActiveOrganization,
  validateSectionBody,
  settingsController.saveSection,
);

export default router;
