import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as setupController from './setup.controller.js';
import { stepKeyParamValidation, stepValidationMap } from './setup.validation.js';

const router = Router();

const validateStepBody = (req, res, next) => {
  const bodyValidations = stepValidationMap[req.params.stepKey] ?? [];
  return validate([...stepKeyParamValidation, ...bodyValidations])(req, res, next);
};

router.use(authenticate, requireActiveOrganization);
router.use(requirePermission(PERMISSIONS.SETTINGS_MANAGE));

router.get('/progress', setupController.getProgress);
router.get('/summary', setupController.getSummary);
router.post('/complete', setupController.complete);

router.get('/steps/:stepKey', validate(stepKeyParamValidation), setupController.getStep);

router.put('/steps/:stepKey', validateStepBody, setupController.saveStep);

export default router;
