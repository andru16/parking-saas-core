import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './parkingMemberships.controller.js';
import {
  createMembershipPaymentValidation,
  createMembershipValidation,
  listMembershipsValidation,
  membershipIdParam,
  renewMembershipValidation,
  statusMembershipValidation,
  updateMembershipValidation,
} from './parkingMemberships.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get(
  '/payments',
  requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE, PERMISSIONS.PAYMENTS_VIEW),
  controller.listPayments,
);
router.post(
  '/payments',
  requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE, PERMISSIONS.PAYMENTS_COLLECT),
  validate(createMembershipPaymentValidation),
  controller.createPayment,
);

router.get(
  '/',
  requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE),
  validate(listMembershipsValidation),
  controller.list,
);
router.post(
  '/',
  requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE),
  validate(createMembershipValidation),
  controller.create,
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE),
  validate(membershipIdParam),
  controller.getOne,
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE),
  validate([...membershipIdParam, ...updateMembershipValidation]),
  controller.update,
);
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE),
  validate([...membershipIdParam, ...statusMembershipValidation]),
  controller.changeStatus,
);
router.post(
  '/:id/renew',
  requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE),
  validate([...membershipIdParam, ...renewMembershipValidation]),
  controller.renew,
);

export default router;
