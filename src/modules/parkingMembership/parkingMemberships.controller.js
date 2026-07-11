import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { parkingMembershipsService } from './parkingMemberships.service.js';

const audit = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? null });

export const list = catchAsync(async (req, res) => {
  const result = await parkingMembershipsService.list(req.auth.organizationId, req.query);
  sendSuccess(res, { data: result });
});

export const getOne = catchAsync(async (req, res) => {
  const data = await parkingMembershipsService.getById(req.auth.organizationId, req.params.id);
  sendSuccess(res, { data });
});

export const create = catchAsync(async (req, res) => {
  const data = await parkingMembershipsService.create(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { statusCode: 201, message: 'Membresía creada', data });
});

export const update = catchAsync(async (req, res) => {
  const data = await parkingMembershipsService.update(
    req.auth.organizationId,
    req.auth.userId,
    req.params.id,
    req.body,
    audit(req),
  );
  sendSuccess(res, { message: 'Membresía actualizada', data });
});

export const changeStatus = catchAsync(async (req, res) => {
  const data = await parkingMembershipsService.changeStatus(
    req.auth.organizationId,
    req.auth.userId,
    req.params.id,
    req.body.status,
    audit(req),
  );
  sendSuccess(res, { message: 'Estado actualizado', data });
});

export const renew = catchAsync(async (req, res) => {
  const data = await parkingMembershipsService.renew(
    req.auth.organizationId,
    req.auth.userId,
    req.params.id,
    req.body,
    audit(req),
  );
  sendSuccess(res, { message: 'Membresía renovada', data });
});

export const listPayments = catchAsync(async (req, res) => {
  const result = await parkingMembershipsService.listPayments(req.auth.organizationId, req.query);
  sendSuccess(res, { data: result });
});

export const createPayment = catchAsync(async (req, res) => {
  const payment = await parkingMembershipsService.recordPayment(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { statusCode: 201, message: 'Pago registrado', data: { payment } });
});
