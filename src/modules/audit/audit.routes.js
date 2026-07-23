import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireOrganizationReadAccess,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { requirePlanFeature } from '#middlewares/requirePlanFeature.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as controller from './audit.controller.js';
import {
  auditIdParam,
  exportAuditValidation,
  listAuditValidation,
} from './audit.validation.js';
import { attachAuditContext } from './audit.middleware.js';

const router = Router();

router.use(
  authenticate,
  requireOrganizationReadAccess,
  requirePlanFeature('audit'),
  attachAuditContext,
);
router.use(requirePermission(PERMISSIONS.AUDIT_VIEW));

router.get('/meta', controller.metaOrgAudit);
router.get('/retention', controller.retentionOrgAudit);
router.get('/export', validate(exportAuditValidation), controller.exportOrgAudit);
router.get('/', validate(listAuditValidation), controller.listOrgAudit);
router.get('/:auditId', validate(auditIdParam), controller.getOrgAudit);

export default router;
