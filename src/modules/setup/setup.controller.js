import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { setupService } from '#services/setup/setup.service.js';

const getAuditContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const getProgress = catchAsync(async (req, res) => {
  const progress = await setupService.getProgress(req.auth.organizationId);

  sendSuccess(res, { data: { progress } });
});

export const getStep = catchAsync(async (req, res) => {
  const result = await setupService.getStepData(req.auth.organizationId, req.params.stepKey);

  sendSuccess(res, { data: result });
});

export const saveStep = catchAsync(async (req, res) => {
  const result = await setupService.saveStep(
    req.auth.organizationId,
    req.auth.userId,
    req.params.stepKey,
    req.body,
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: 'Configuración guardada',
    data: result,
  });
});

export const getSummary = catchAsync(async (req, res) => {
  const summary = await setupService.getSummary(req.auth.organizationId);

  sendSuccess(res, { data: summary });
});

export const complete = catchAsync(async (req, res) => {
  const result = await setupService.complete(
    req.auth.organizationId,
    req.auth.userId,
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: 'Configuración inicial completada',
    data: result,
  });
});
