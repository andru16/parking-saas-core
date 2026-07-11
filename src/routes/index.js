import { Router } from 'express';
import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import signupRoutes from '#modules/signup/signup.routes.js';
import authRoutes from '#modules/auth/auth.routes.js';
import setupRoutes from '#modules/setup/setup.routes.js';
import settingsRoutes from '#modules/settings/settings.routes.js';
import printingRoutes from '#modules/printing/printing.routes.js';
import usersRoutes from '#modules/users/users.routes.js';
import ticketRoutes from '#modules/ticket/ticket.routes.js';
import cashRegisterRoutes from '#modules/cashRegister/cashRegister.routes.js';
import paymentRoutes from '#modules/payment/payment.routes.js';
import reportRoutes from '#modules/report/report.routes.js';
import auditRoutes from '#modules/audit/audit.routes.js';
import notificationRoutes from '#modules/notification/notification.routes.js';
import backupRoutes from '#modules/backup/backup.routes.js';
import supportRoutes from '#modules/support/support.routes.js';
import membersRoutes from '#modules/member/members.routes.js';
import vehiclesRoutes from '#modules/vehicle/vehicles.routes.js';
import parkingMembershipsRoutes from '#modules/parkingMembership/parkingMemberships.routes.js';
import superAdminRoutes from '#modules/superAdmin/superAdmin.routes.js';

const router = Router();

router.use('/signup', signupRoutes);
router.use('/auth', authRoutes);
router.use('/admin', superAdminRoutes);
router.use('/setup', setupRoutes);
router.use('/settings', settingsRoutes);
router.use('/printing', printingRoutes);
router.use('/users', usersRoutes);
router.use('/tickets', ticketRoutes);
router.use('/cash-registers', cashRegisterRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/audit', auditRoutes);
router.use('/notifications', notificationRoutes);
router.use('/backups', backupRoutes);
router.use('/support', supportRoutes);
router.use('/members', membersRoutes);
router.use('/vehicles', vehiclesRoutes);
router.use('/parking-memberships', parkingMembershipsRoutes);

router.get(
  '/health',
  catchAsync(async (_req, res) => {
    sendSuccess(res, {
      message: 'Parking SaaS API operativa',
      data: { status: 'ok' },
    });
  }),
);

export default router;
