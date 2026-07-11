import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './members.controller.js';
import {
  createMemberValidation,
  linkVehicleValidation,
  listMembersValidation,
  memberIdParam,
  updateMemberValidation,
  vehicleIdParam,
} from './members.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get(
  '/',
  requirePermission(PERMISSIONS.MEMBERS_MANAGE),
  validate(listMembersValidation),
  controller.list,
);
router.post(
  '/',
  requirePermission(PERMISSIONS.MEMBERS_MANAGE),
  validate(createMemberValidation),
  controller.create,
);
router.get(
  '/:memberId',
  requirePermission(PERMISSIONS.MEMBERS_MANAGE),
  validate(memberIdParam),
  controller.getOne,
);
router.put(
  '/:memberId',
  requirePermission(PERMISSIONS.MEMBERS_MANAGE),
  validate([...memberIdParam, ...updateMemberValidation]),
  controller.update,
);
router.post(
  '/:memberId/vehicles',
  requirePermission(PERMISSIONS.MEMBERS_MANAGE),
  validate([...memberIdParam, ...linkVehicleValidation]),
  controller.linkVehicle,
);
router.delete(
  '/:memberId/vehicles/:vehicleId',
  requirePermission(PERMISSIONS.MEMBERS_MANAGE),
  validate([...memberIdParam, ...vehicleIdParam]),
  controller.unlinkVehicle,
);

export default router;
