import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requireOrganizationReadAccess,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as usersController from './users.controller.js';
import {
  createRoleValidation,
  createUserValidation,
  roleIdParam,
  updateRoleValidation,
  updateUserValidation,
  userIdParam,
} from './users.validation.js';

const router = Router();

router.use(authenticate);

router.get(
  '/permissions/catalog',
  requireOrganizationReadAccess,
  requirePermission(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_MANAGE),
  usersController.getPermissionCatalog,
);

router.get(
  '/roles',
  requireOrganizationReadAccess,
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  usersController.listRoles,
);
router.post(
  '/roles',
  requireActiveOrganization,
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(createRoleValidation),
  usersController.createRole,
);
router.get(
  '/roles/:roleId',
  requireOrganizationReadAccess,
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(roleIdParam),
  usersController.getRole,
);
router.put(
  '/roles/:roleId',
  requireActiveOrganization,
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate([...roleIdParam, ...updateRoleValidation]),
  usersController.updateRole,
);
router.post(
  '/roles/:roleId/duplicate',
  requireActiveOrganization,
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(roleIdParam),
  usersController.duplicateRole,
);
router.delete(
  '/roles/:roleId',
  requireActiveOrganization,
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(roleIdParam),
  usersController.deleteRole,
);

router.get(
  '/',
  requireOrganizationReadAccess,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  usersController.listUsers,
);
router.post(
  '/',
  requireActiveOrganization,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  validate(createUserValidation),
  usersController.createUser,
);
router.get(
  '/:userId',
  requireOrganizationReadAccess,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  validate(userIdParam),
  usersController.getUser,
);
router.put(
  '/:userId',
  requireActiveOrganization,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  validate([...userIdParam, ...updateUserValidation]),
  usersController.updateUser,
);
router.post(
  '/:userId/reset-password',
  requireActiveOrganization,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  validate(userIdParam),
  usersController.resetUserPassword,
);

export default router;
