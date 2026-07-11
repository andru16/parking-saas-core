import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { membersService } from './members.service.js';

const audit = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? null });

export const list = catchAsync(async (req, res) => {
  const result = await membersService.list(req.auth.organizationId, req.query);
  sendSuccess(res, { data: result });
});

export const getOne = catchAsync(async (req, res) => {
  const data = await membersService.getById(req.auth.organizationId, req.params.memberId);
  sendSuccess(res, { data });
});

export const create = catchAsync(async (req, res) => {
  const member = await membersService.create(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { statusCode: 201, message: 'Miembro creado', data: { member } });
});

export const update = catchAsync(async (req, res) => {
  const member = await membersService.update(
    req.auth.organizationId,
    req.auth.userId,
    req.params.memberId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { message: 'Miembro actualizado', data: { member } });
});

export const linkVehicle = catchAsync(async (req, res) => {
  const vehicle = await membersService.linkVehicle(
    req.auth.organizationId,
    req.auth.userId,
    req.params.memberId,
    req.body.vehicleId,
    audit(req),
  );
  sendSuccess(res, { message: 'Vehículo asociado', data: { vehicle } });
});

export const unlinkVehicle = catchAsync(async (req, res) => {
  const vehicle = await membersService.unlinkVehicle(
    req.auth.organizationId,
    req.auth.userId,
    req.params.memberId,
    req.params.vehicleId,
    audit(req),
  );
  sendSuccess(res, { message: 'Vehículo desasociado', data: { vehicle } });
});
