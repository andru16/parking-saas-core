import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as cashRegisterController from './cashRegister.controller.js';
import {
  openCashRegisterValidation,
  closeCashRegisterValidation,
  sessionIdParamValidation,
  historyQueryValidation,
} from './cashRegister.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get(
  '/meta/cash-points',
  requirePermission(PERMISSIONS.CASH_VIEW, PERMISSIONS.CASH_OPEN),
  cashRegisterController.listCashPoints,
);
router.get(
  '/current',
  requirePermission(PERMISSIONS.CASH_VIEW, PERMISSIONS.CASH_OPEN, PERMISSIONS.CASH_CLOSE),
  cashRegisterController.getCurrent,
);
router.get(
  '/current/summary',
  requirePermission(PERMISSIONS.CASH_VIEW),
  cashRegisterController.getLiveSummary,
);
router.post(
  '/open',
  requirePermission(PERMISSIONS.CASH_OPEN),
  validate(openCashRegisterValidation),
  cashRegisterController.open,
);
router.post(
  '/close',
  requirePermission(PERMISSIONS.CASH_CLOSE),
  validate(closeCashRegisterValidation),
  cashRegisterController.close,
);
router.get(
  '/history',
  requirePermission(PERMISSIONS.CASH_VIEW),
  validate(historyQueryValidation),
  cashRegisterController.listHistory,
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.CASH_VIEW),
  validate(sessionIdParamValidation),
  cashRegisterController.getById,
);

export default router;
