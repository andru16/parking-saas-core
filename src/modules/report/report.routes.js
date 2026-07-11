import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireOrganizationReadAccess,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as reportController from './report.controller.js';
import {
  dashboardQueryValidation,
  reportFiltersValidation,
  reportTypeParamValidation,
  exportFormatValidation,
} from './report.validation.js';

const router = Router();

router.use(authenticate);

router.get(
  '/dashboard/kpis',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  requireOrganizationReadAccess,
  validate(dashboardQueryValidation),
  reportController.getDashboardKpis,
);

router.get(
  '/dashboard/charts',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  requireOrganizationReadAccess,
  validate(dashboardQueryValidation),
  reportController.getDashboardCharts,
);

router.get(
  '/meta/filters',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  requireOrganizationReadAccess,
  reportController.getFilterOptions,
);

router.get(
  '/meta/allowed',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  requireOrganizationReadAccess,
  reportController.listAllowedReports,
);

router.get(
  '/:type/export',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  requireOrganizationReadAccess,
  validate([...reportTypeParamValidation, ...exportFormatValidation, ...reportFiltersValidation]),
  reportController.exportReport,
);

router.get(
  '/:type',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  requireOrganizationReadAccess,
  validate([...reportTypeParamValidation, ...reportFiltersValidation]),
  reportController.generateReport,
);

export default router;
