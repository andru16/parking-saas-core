import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './vehicles.controller.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get(
  '/',
  requirePermission(PERMISSIONS.VEHICLES_VIEW),
  validate([
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['active', 'inactive']),
    query('presence').optional().isIn(['inside', 'outside']),
  ]),
  controller.list,
);

router.get(
  '/frequent',
  requirePermission(PERMISSIONS.VEHICLES_VIEW, PERMISSIONS.REPORTS_VIEW),
  controller.frequent,
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.VEHICLES_VIEW),
  validate([param('id').isMongoId()]),
  controller.getOne,
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.VEHICLES_UPDATE),
  validate([
    param('id').isMongoId(),
    body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
    body('status').optional().isIn(['active', 'inactive']),
    body('memberId').optional({ nullable: true }).isMongoId(),
    body('vehicleCategoryId').optional().isMongoId(),
  ]),
  controller.update,
);

export default router;
