import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { vehiclesConsultService } from './vehicles.service.js';

const audit = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? null });

export const list = catchAsync(async (req, res) => {
  const result = await vehiclesConsultService.list(req.auth.organizationId, req.query);
  sendSuccess(res, { data: result });
});

export const frequent = catchAsync(async (req, res) => {
  const items = await vehiclesConsultService.frequent(req.auth.organizationId, req.query);
  sendSuccess(res, { data: { items } });
});

export const getOne = catchAsync(async (req, res) => {
  const data = await vehiclesConsultService.getById(req.auth.organizationId, req.params.id);
  sendSuccess(res, { data });
});

export const update = catchAsync(async (req, res) => {
  const data = await vehiclesConsultService.update(
    req.auth.organizationId,
    req.auth.userId,
    req.params.id,
    req.body,
    audit(req),
  );
  sendSuccess(res, { message: 'Vehículo actualizado', data });
});
