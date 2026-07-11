import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as paymentController from './payment.controller.js';
import { query } from 'express-validator';
import {
  ticketIdParamValidation,
  paymentIdParamValidation,
  reversePaymentValidation,
} from './payment.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get(
  '/methods',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.PAYMENTS_COLLECT),
  paymentController.listPaymentMethods,
);
router.get(
  '/history',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  validate([
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('source').optional().isIn(['all', 'tickets', 'memberships']),
  ]),
  paymentController.listHistory,
);
router.get(
  '/ticket/:ticketId',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.PAYMENTS_COLLECT),
  validate(ticketIdParamValidation),
  paymentController.listByTicket,
);
router.post(
  '/:id/reverse',
  requirePermission(PERMISSIONS.PAYMENTS_REVERSE),
  validate([...paymentIdParamValidation, ...reversePaymentValidation]),
  paymentController.reverse,
);

export default router;
