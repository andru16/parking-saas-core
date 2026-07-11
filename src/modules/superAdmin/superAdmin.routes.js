import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  requireRequestMetadata,
} from '#modules/auth/auth.middleware.js';
import { loginRateLimiter, refreshRateLimiter } from '#modules/auth/auth.rateLimit.js';
import {
  authenticateSuperAdmin,
  requirePlatformPermission,
} from './superAdmin.middleware.js';
import { PLATFORM_PERMISSIONS } from './permissions.catalog.js';
import * as controller from './superAdmin.controller.js';
import {
  changePlanValidation,
  createPlanValidation,
  extendTrialValidation,
  impersonateValidation,
  listOrgsValidation,
  loginValidation,
  orgIdParam,
  planIdParam,
  setPlanActiveValidation,
  statusActionValidation,
  updatePlanValidation,
  subscriptionAlertsValidation,
} from './superAdmin.validation.js';
import {
  auditIdParam,
  exportAuditValidation,
  listAuditValidation,
} from '#modules/audit/audit.validation.js';
import * as auditController from '#modules/audit/audit.controller.js';
import * as notificationController from '#modules/notification/notification.controller.js';
import {
  createNotificationValidation,
  listNotificationsValidation,
  notificationIdParam,
} from '#modules/notification/notification.validation.js';
import * as backupAdminController from '#modules/backup/superAdminBackup.controller.js';
import { listBackupsValidation, runManualValidation } from '#modules/backup/backup.validation.js';
import * as systemSettingsController from '#modules/systemSettings/settings.controller.js';
import { updatePlatformSettingsValidation } from '#modules/systemSettings/settings.validation.js';
import * as supportController from '#modules/support/support.controller.js';
import {
  assignSupportValidation,
  listSupportValidation,
  replySupportValidation,
  statusSupportValidation,
  supportIdParam,
} from '#modules/support/support.validation.js';
import { param, query } from 'express-validator';

const router = Router();

/** Auth independiente — sin authenticateSuperAdmin en login/refresh */
router.post(
  '/auth/login',
  loginRateLimiter,
  requireRequestMetadata,
  validate(loginValidation),
  controller.login,
);
router.post('/auth/refresh', refreshRateLimiter, requireRequestMetadata, controller.refresh);
router.post('/auth/logout', requireRequestMetadata, controller.logout);
router.get('/auth/me', authenticateSuperAdmin, controller.me);

router.use(authenticateSuperAdmin);

router.get(
  '/dashboard',
  requirePlatformPermission(PLATFORM_PERMISSIONS.DASHBOARD_VIEW),
  controller.dashboard,
);

router.get(
  '/subscriptions/alerts',
  requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_VIEW, PLATFORM_PERMISSIONS.DASHBOARD_VIEW),
  validate(subscriptionAlertsValidation),
  controller.listSubscriptionAlerts,
);

router.get(
  '/subscriptions/scheduler',
  requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_MANAGE, PLATFORM_PERMISSIONS.DASHBOARD_VIEW),
  controller.getSchedulerStatus,
);

router.post(
  '/subscriptions/scheduler/run',
  requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_MANAGE),
  controller.runSubscriptionScheduler,
);

router.get(
  '/audit/meta',
  requirePlatformPermission(PLATFORM_PERMISSIONS.AUDIT_VIEW),
  auditController.metaPlatformAudit,
);

router.get(
  '/audit/retention',
  requirePlatformPermission(PLATFORM_PERMISSIONS.AUDIT_VIEW),
  auditController.retentionPlatformAudit,
);

router.get(
  '/audit/export',
  requirePlatformPermission(PLATFORM_PERMISSIONS.AUDIT_VIEW),
  validate(exportAuditValidation),
  auditController.exportPlatformAudit,
);

router.get(
  '/audit',
  requirePlatformPermission(PLATFORM_PERMISSIONS.AUDIT_VIEW),
  validate(listAuditValidation),
  auditController.listPlatformAudit,
);

router.get(
  '/audit/:auditId',
  requirePlatformPermission(PLATFORM_PERMISSIONS.AUDIT_VIEW),
  validate(auditIdParam),
  auditController.getPlatformAudit,
);

router.get(
  '/notifications/meta',
  requirePlatformPermission(PLATFORM_PERMISSIONS.NOTIFICATIONS_VIEW),
  notificationController.metaPlatformNotifications,
);

router.get(
  '/notifications/unread-count',
  requirePlatformPermission(PLATFORM_PERMISSIONS.NOTIFICATIONS_VIEW),
  notificationController.unreadPlatformCount,
);

router.get(
  '/notifications',
  requirePlatformPermission(PLATFORM_PERMISSIONS.NOTIFICATIONS_VIEW),
  validate(listNotificationsValidation),
  notificationController.listPlatformNotifications,
);

router.post(
  '/notifications',
  requirePlatformPermission(PLATFORM_PERMISSIONS.NOTIFICATIONS_VIEW),
  validate(createNotificationValidation),
  notificationController.createPlatformNotification,
);

router.post(
  '/notifications/read-all',
  requirePlatformPermission(PLATFORM_PERMISSIONS.NOTIFICATIONS_VIEW),
  notificationController.markPlatformAllRead,
);

router.get(
  '/notifications/:notificationId',
  requirePlatformPermission(PLATFORM_PERMISSIONS.NOTIFICATIONS_VIEW),
  validate(notificationIdParam),
  notificationController.getPlatformNotification,
);

router.patch(
  '/notifications/:notificationId/read',
  requirePlatformPermission(PLATFORM_PERMISSIONS.NOTIFICATIONS_VIEW),
  validate(notificationIdParam),
  notificationController.markPlatformRead,
);

router.delete(
  '/notifications/:notificationId',
  requirePlatformPermission(PLATFORM_PERMISSIONS.NOTIFICATIONS_VIEW),
  validate(notificationIdParam),
  notificationController.deletePlatformNotification,
);

router.get(
  '/plans',
  requirePlatformPermission(PLATFORM_PERMISSIONS.PLANS_VIEW, PLATFORM_PERMISSIONS.ORGS_CHANGE_PLAN),
  controller.listPlans,
);

router.get(
  '/plans/features',
  requirePlatformPermission(PLATFORM_PERMISSIONS.PLANS_VIEW, PLATFORM_PERMISSIONS.PLANS_MANAGE),
  controller.listPlanFeatures,
);

router.post(
  '/plans',
  requirePlatformPermission(PLATFORM_PERMISSIONS.PLANS_MANAGE),
  validate(createPlanValidation),
  controller.createPlan,
);

router.get(
  '/plans/:planId',
  requirePlatformPermission(PLATFORM_PERMISSIONS.PLANS_VIEW, PLATFORM_PERMISSIONS.PLANS_MANAGE),
  validate(planIdParam),
  controller.getPlan,
);

router.put(
  '/plans/:planId',
  requirePlatformPermission(PLATFORM_PERMISSIONS.PLANS_MANAGE),
  validate([...planIdParam, ...updatePlanValidation]),
  controller.updatePlan,
);

router.patch(
  '/plans/:planId/status',
  requirePlatformPermission(PLATFORM_PERMISSIONS.PLANS_MANAGE),
  validate(setPlanActiveValidation),
  controller.setPlanActive,
);

router.post(
  '/plans/:planId/duplicate',
  requirePlatformPermission(PLATFORM_PERMISSIONS.PLANS_MANAGE),
  validate(planIdParam),
  controller.duplicatePlan,
);

router.get(
  '/organizations',
  requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_VIEW),
  validate(listOrgsValidation),
  controller.listOrganizations,
);

router.get(
  '/organizations/:organizationId',
  requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_VIEW),
  validate(orgIdParam),
  controller.getOrganization,
);

router.patch(
  '/organizations/:organizationId/status',
  requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_SUSPEND, PLATFORM_PERMISSIONS.ORGS_MANAGE),
  validate(statusActionValidation),
  controller.changeOrganizationStatus,
);

router.post(
  '/organizations/:organizationId/extend-trial',
  requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_EXTEND_TRIAL, PLATFORM_PERMISSIONS.ORGS_MANAGE),
  validate(extendTrialValidation),
  controller.extendTrial,
);

router.post(
  '/organizations/:organizationId/change-plan',
  requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_CHANGE_PLAN, PLATFORM_PERMISSIONS.ORGS_MANAGE),
  validate(changePlanValidation),
  controller.changePlan,
);

router.post(
  '/organizations/:organizationId/impersonate',
  requirePlatformPermission(PLATFORM_PERMISSIONS.IMPERSONATE),
  validate(impersonateValidation),
  controller.startImpersonation,
);

router.get(
  '/backups',
  requirePlatformPermission(PLATFORM_PERMISSIONS.BACKUPS_VIEW),
  validate([
    ...listBackupsValidation,
    query('organizationId').optional().isMongoId(),
  ]),
  backupAdminController.listBackups,
);

router.get(
  '/backups/scheduler',
  requirePlatformPermission(PLATFORM_PERMISSIONS.BACKUPS_VIEW, PLATFORM_PERMISSIONS.BACKUPS_MANAGE),
  backupAdminController.getBackupStatusOverview,
);

router.post(
  '/backups/scheduler/run',
  requirePlatformPermission(PLATFORM_PERMISSIONS.BACKUPS_MANAGE),
  backupAdminController.runSchedulerNow,
);

router.post(
  '/backups/organizations/:orgId/run',
  requirePlatformPermission(PLATFORM_PERMISSIONS.BACKUPS_MANAGE),
  validate([param('orgId').isMongoId(), ...runManualValidation]),
  backupAdminController.runOrgBackup,
);

router.get(
  '/system-settings',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SETTINGS_MANAGE),
  systemSettingsController.getPlatformSettings,
);

router.put(
  '/system-settings',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SETTINGS_MANAGE),
  validate(updatePlatformSettingsValidation),
  systemSettingsController.updatePlatformSettings,
);

router.get(
  '/support/meta',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SUPPORT_MANAGE),
  supportController.getMeta,
);

router.get(
  '/support/metrics',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SUPPORT_MANAGE),
  supportController.platformMetrics,
);

router.get(
  '/support',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SUPPORT_MANAGE),
  validate(listSupportValidation),
  supportController.platformList,
);

router.get(
  '/support/:id',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SUPPORT_MANAGE),
  validate(supportIdParam),
  supportController.platformGetOne,
);

router.post(
  '/support/:id/replies',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SUPPORT_MANAGE),
  validate([...supportIdParam, ...replySupportValidation]),
  supportController.platformReply,
);

router.patch(
  '/support/:id/status',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SUPPORT_MANAGE),
  validate([...supportIdParam, ...statusSupportValidation]),
  supportController.platformChangeStatus,
);

router.patch(
  '/support/:id/assign',
  requirePlatformPermission(PLATFORM_PERMISSIONS.SUPPORT_MANAGE),
  validate([...supportIdParam, ...assignSupportValidation]),
  supportController.platformAssign,
);

export default router;
