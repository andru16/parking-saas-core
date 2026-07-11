import { Router } from 'express';
import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { subscriptionScheduler } from '#services/subscription-engine/index.js';
import { backupScheduler } from '#modules/backup/backup.scheduler.js';
import { requireCronSecret } from './cron.auth.js';

const router = Router();

router.use(requireCronSecret);

/**
 * Vercel Cron / scheduler externo — motor de suscripciones.
 * GET /api/internal/cron/subscriptions
 */
router.get(
  '/subscriptions',
  catchAsync(async (_req, res) => {
    const result = await subscriptionScheduler.runDaily({ source: 'scheduler' });
    sendSuccess(res, {
      message: 'Job de suscripciones ejecutado',
      data: result,
    });
  }),
);

/**
 * Vercel Cron / scheduler externo — backups debidos.
 * GET /api/internal/cron/backups
 */
router.get(
  '/backups',
  catchAsync(async (_req, res) => {
    const result = await backupScheduler.runDue();
    sendSuccess(res, {
      message: 'Job de backups ejecutado',
      data: result,
    });
  }),
);

export default router;
