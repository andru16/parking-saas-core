import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { cashRegisterService } from './cashRegister.service.js';

const auditContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const listCashPoints = catchAsync(async (req, res) => {
  const cashPoints = await cashRegisterService.listCashPoints(req.auth.organizationId);
  sendSuccess(res, { data: { cashPoints } });
});

export const getCurrent = catchAsync(async (req, res) => {
  const session = await cashRegisterService.getOpenSession(
    req.auth.organizationId,
    req.auth.userId,
  );
  sendSuccess(res, { data: { session } });
});

export const open = catchAsync(async (req, res) => {
  const session = await cashRegisterService.openSession(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    auditContext(req),
  );

  sendSuccess(res, {
    statusCode: 201,
    message: 'Caja abierta',
    data: { session },
  });
});

export const close = catchAsync(async (req, res) => {
  const session = await cashRegisterService.closeSession(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    auditContext(req),
  );

  sendSuccess(res, {
    message: 'Caja cerrada',
    data: { session },
  });
});

export const getLiveSummary = catchAsync(async (req, res) => {
  const summary = await cashRegisterService.getLiveSummary(
    req.auth.organizationId,
    req.auth.userId,
  );
  sendSuccess(res, { data: { summary } });
});

export const listHistory = catchAsync(async (req, res) => {
  const result = await cashRegisterService.listHistory(req.auth.organizationId, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  });
  sendSuccess(res, { data: result });
});

export const getById = catchAsync(async (req, res) => {
  const session = await cashRegisterService.getById(req.auth.organizationId, req.params.id);
  sendSuccess(res, { data: { session } });
});
