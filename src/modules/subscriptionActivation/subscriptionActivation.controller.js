import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { subscriptionActivationService } from './subscriptionActivation.service.js';

export const getMeta = catchAsync(async (_req, res) => {
  sendSuccess(res, { data: { meta: subscriptionActivationService.getMeta() } });
});

export const getSupportContact = catchAsync(async (_req, res) => {
  const support = await subscriptionActivationService.getSupportContact();
  sendSuccess(res, { data: { support } });
});

export const getWelcome = catchAsync(async (req, res) => {
  const data = await subscriptionActivationService.getWelcomeContext(req.auth.organizationId);
  sendSuccess(res, { data });
});

export const startPremiumTrial = catchAsync(async (req, res) => {
  const result = await subscriptionActivationService.startPremiumTrial(
    req.auth.organizationId,
    req.auth.userId,
  );
  sendSuccess(res, {
    data: result,
    message: 'Prueba premium iniciada. Ya puedes usar todas las funciones del plan.',
  });
});

export const createRequest = catchAsync(async (req, res) => {
  const request = await subscriptionActivationService.createRequest(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
  );
  sendSuccess(res, {
    data: { request },
    message: 'Solicitud enviada. Te contactaremos pronto.',
    statusCode: 201,
  });
});

export const listMine = catchAsync(async (req, res) => {
  const result = await subscriptionActivationService.listForOrganization(
    req.auth.organizationId,
    {
      page: req.query.page,
      limit: req.query.limit,
    },
  );
  sendSuccess(res, { data: result });
});

export const getMine = catchAsync(async (req, res) => {
  const request = await subscriptionActivationService.getOne(req.params.id, {
    organizationId: req.auth.organizationId,
  });
  sendSuccess(res, { data: { request } });
});

/** Plataforma (Super Admin) */
export const platformList = catchAsync(async (req, res) => {
  const result = await subscriptionActivationService.listAll({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    search: req.query.search,
    sort: req.query.sort,
    order: req.query.order,
  });
  sendSuccess(res, { data: result });
});

export const platformGetOne = catchAsync(async (req, res) => {
  const request = await subscriptionActivationService.getOne(req.params.id);
  sendSuccess(res, { data: { request } });
});

export const platformSetStatus = catchAsync(async (req, res) => {
  const request = await subscriptionActivationService.setStatus(req.params.id, {
    status: req.body.status,
    adminNotes: req.body.adminNotes,
    actorUserId: req.auth.userId,
  });
  sendSuccess(res, { data: { request }, message: 'Estado actualizado' });
});

export const platformApprove = catchAsync(async (req, res) => {
  const request = await subscriptionActivationService.approve(req.params.id, {
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    adminNotes: req.body.adminNotes,
    actorUserId: req.auth.userId,
  });
  sendSuccess(res, {
    data: { request },
    message: 'Suscripción activada correctamente',
  });
});

export const platformReject = catchAsync(async (req, res) => {
  const request = await subscriptionActivationService.reject(req.params.id, {
    adminNotes: req.body.adminNotes,
    actorUserId: req.auth.userId,
  });
  sendSuccess(res, { data: { request }, message: 'Solicitud rechazada' });
});
