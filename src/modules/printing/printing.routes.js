import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as printingController from './printing.controller.js';
import {
  cashRegisterIdParamValidation,
  documentQueryValidation,
  listJobsValidation,
  membershipIdParamValidation,
  paymentIdParamValidation,
  previewValidation,
  reprintValidation,
  ticketIdParamValidation,
} from './printing.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get(
  '/config',
  requirePermission(PERMISSIONS.PRINTING_CONFIG, PERMISSIONS.SETTINGS_MANAGE),
  printingController.getConfig,
);

router.get(
  '/adapters',
  requirePermission(PERMISSIONS.PRINTING_CONFIG, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.PRINTING_PRINT),
  printingController.listAdapters,
);

router.post(
  '/preview',
  requirePermission(PERMISSIONS.PRINTING_CONFIG, PERMISSIONS.SETTINGS_MANAGE),
  validate(previewValidation),
  printingController.preview,
);

router.get(
  '/jobs',
  requirePermission(PERMISSIONS.PRINTING_CONFIG, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.PRINTING_PRINT),
  validate(listJobsValidation),
  printingController.listJobs,
);

router.post(
  '/reprint',
  requirePermission(PERMISSIONS.PRINTING_REPRINT),
  validate(reprintValidation),
  printingController.reprint,
);

router.get(
  '/tickets/:ticketId/document',
  requirePermission(PERMISSIONS.PRINTING_PRINT),
  validate([...ticketIdParamValidation, ...documentQueryValidation]),
  printingController.getTicketDocument,
);

router.post(
  '/tickets/:ticketId/reprint',
  requirePermission(PERMISSIONS.PRINTING_REPRINT),
  validate([...ticketIdParamValidation, ...reprintValidation]),
  printingController.reprintTicket,
);

router.get(
  '/cash-registers/:cashRegisterId/document',
  requirePermission(PERMISSIONS.PRINTING_PRINT),
  validate([...cashRegisterIdParamValidation, ...documentQueryValidation]),
  printingController.getCashDocument,
);

router.get(
  '/memberships/:membershipId/document',
  requirePermission(PERMISSIONS.PRINTING_PRINT),
  validate([...membershipIdParamValidation, ...documentQueryValidation]),
  printingController.getMembershipDocument,
);

router.get(
  '/payments/:paymentId/document',
  requirePermission(PERMISSIONS.PRINTING_PRINT),
  validate([...paymentIdParamValidation, ...documentQueryValidation]),
  printingController.getPaymentDocument,
);

export default router;
