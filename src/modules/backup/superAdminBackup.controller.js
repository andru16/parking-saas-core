import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { ApiError } from '#utils/ApiError.js';
import { backupService } from '#modules/backup/backup.service.js';
import { backupScheduler } from '#modules/backup/backup.scheduler.js';
import { BACKUP_TYPES } from '#modules/backup/constants.js';

const auditContext = (req) => ({
  userId: req.auth?.userId,
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const listBackups = catchAsync(async (req, res) => {
  const result = await backupService.listPlatform({
    page: req.query.page,
    limit: req.query.limit,
    organizationId: req.query.organizationId,
    status: req.query.status,
  });
  sendSuccess(res, { data: result });
});

export const getBackupStatusOverview = catchAsync(async (req, res) => {
  sendSuccess(res, {
    data: {
      scheduler: {
        enabled: backupScheduler.isRunning || Boolean(backupScheduler.lastRun),
        lastRun: backupScheduler.lastRun,
      },
    },
  });
});

export const runOrgBackup = catchAsync(async (req, res) => {
  const organizationId = req.params.orgId || req.body.organizationId;
  if (!organizationId) throw new ApiError(400, 'organizationId es obligatorio');

  const backup = await backupService.runBackup({
    organizationId,
    type: BACKUP_TYPES.MANUAL,
    triggeredBy: 'super_admin',
    triggeredByUserId: req.auth.userId,
    notes: req.body.notes || 'Backup manual desde Super Admin',
    auditContext: auditContext(req),
  });

  sendSuccess(res, { data: { backup }, message: 'Backup de organización completado' });
});

export const runSchedulerNow = catchAsync(async (req, res) => {
  const result = await backupScheduler.runDue();
  sendSuccess(res, { data: result, message: 'Scheduler de backups ejecutado' });
});
