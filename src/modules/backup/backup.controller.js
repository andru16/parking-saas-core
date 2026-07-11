import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { backupService } from './backup.service.js';
import { restoreService } from './restore.service.js';
import { BACKUP_TYPES } from './constants.js';

const auditContext = (req) => ({
  userId: req.auth?.userId,
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const getStatus = catchAsync(async (req, res) => {
  const status = await backupService.getStatus(req.auth.organizationId);
  sendSuccess(res, { data: { status } });
});

export const getConfig = catchAsync(async (req, res) => {
  const config = await backupService.getConfig(req.auth.organizationId);
  sendSuccess(res, { data: { config } });
});

export const updateConfig = catchAsync(async (req, res) => {
  const config = await backupService.updateConfig(
    req.auth.organizationId,
    req.body,
    auditContext(req),
  );
  sendSuccess(res, { data: { config }, message: 'Configuración de backups actualizada' });
});

export const list = catchAsync(async (req, res) => {
  const result = await backupService.list(req.auth.organizationId, {
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
  });
  sendSuccess(res, { data: result });
});

export const getOne = catchAsync(async (req, res) => {
  const backup = await backupService.getById(req.auth.organizationId, req.params.id);
  sendSuccess(res, { data: { backup } });
});

export const runManual = catchAsync(async (req, res) => {
  const backup = await backupService.runBackup({
    organizationId: req.auth.organizationId,
    type: BACKUP_TYPES.MANUAL,
    triggeredBy: 'user',
    triggeredByUserId: req.auth.userId,
    notes: req.body.notes,
    auditContext: auditContext(req),
  });
  sendSuccess(res, { data: { backup }, message: 'Backup completado' });
});

export const download = catchAsync(async (req, res) => {
  const file = await backupService.download(
    req.auth.organizationId,
    req.params.id,
    auditContext(req),
  );
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
});

export const remove = catchAsync(async (req, res) => {
  await backupService.deleteBackup(req.auth.organizationId, req.params.id, auditContext(req));
  sendSuccess(res, { message: 'Backup eliminado' });
});

export const restorePreview = catchAsync(async (req, res) => {
  const preview = await restoreService.preview(req.auth.organizationId, req.params.id);
  sendSuccess(res, { data: { preview } });
});

export const restore = catchAsync(async (req, res) => {
  const result = await restoreService.restore(
    req.auth.organizationId,
    req.params.id,
    {
      confirm: req.body.confirm,
      confirmationPhrase: req.body.confirmationPhrase,
    },
    auditContext(req),
  );
  sendSuccess(res, { data: result, message: 'Restauración completada' });
});

/** Alias arquitectura */
export const BackupController = {
  getStatus,
  getConfig,
  updateConfig,
  list,
  getOne,
  runManual,
  download,
  remove,
  restorePreview,
  restore,
};
