import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import {
  authenticate,
  requireActiveOrganization,
  requirePermission,
} from '#modules/auth/auth.middleware.js';
import { PERMISSIONS } from '#services/rbac/permission.catalog.js';
import * as ticketController from './ticket.controller.js';
import {
  lookupValidation,
  openEntryValidation,
  ticketIdParamValidation,
  collectTicketValidation,
  cancelTicketValidation,
} from './ticket.validation.js';

const router = Router();

router.use(authenticate, requireActiveOrganization);

router.get(
  '/meta/vehicle-categories',
  requirePermission(PERMISSIONS.TICKETS_CREATE, PERMISSIONS.VEHICLES_VIEW),
  ticketController.listVehicleCategories,
);
router.get(
  '/lookup',
  requirePermission(PERMISSIONS.TICKETS_CREATE),
  validate(lookupValidation),
  ticketController.lookup,
);
router.get(
  '/open',
  requirePermission(PERMISSIONS.TICKETS_CREATE, PERMISSIONS.TICKETS_CLOSE),
  ticketController.listOpen,
);
router.post(
  '/entry',
  requirePermission(PERMISSIONS.TICKETS_CREATE),
  validate(openEntryValidation),
  ticketController.openEntry,
);
router.get(
  '/:id/exit-preview',
  requirePermission(PERMISSIONS.TICKETS_CLOSE, PERMISSIONS.PAYMENTS_COLLECT),
  validate(ticketIdParamValidation),
  ticketController.getExitPreview,
);
router.get(
  '/:id/history',
  requirePermission(PERMISSIONS.TICKETS_CREATE, PERMISSIONS.TICKETS_CLOSE),
  validate(ticketIdParamValidation),
  ticketController.getVehicleHistory,
);
router.post(
  '/:id/collect',
  requirePermission(PERMISSIONS.TICKETS_CLOSE, PERMISSIONS.PAYMENTS_COLLECT),
  validate([...ticketIdParamValidation, ...collectTicketValidation]),
  ticketController.collectAndClose,
);
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.TICKETS_CANCEL),
  validate([...ticketIdParamValidation, ...cancelTicketValidation]),
  ticketController.cancelTicket,
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.TICKETS_CREATE, PERMISSIONS.TICKETS_CLOSE),
  validate(ticketIdParamValidation),
  ticketController.getById,
);

export default router;
