import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { ticketService } from './ticket.service.js';

const auditContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const listVehicleCategories = catchAsync(async (req, res) => {
  const categories = await ticketService.listVehicleCategories(req.auth.organizationId);
  sendSuccess(res, { data: { categories } });
});

export const lookup = catchAsync(async (req, res) => {
  const result = await ticketService.lookupByPlate(req.auth.organizationId, req.query.plate);

  sendSuccess(res, { data: result });
});

export const listOpen = catchAsync(async (req, res) => {
  const tickets = await ticketService.listOpenTickets(req.auth.organizationId);

  sendSuccess(res, { data: { tickets } });
});

export const getById = catchAsync(async (req, res) => {
  const ticket = await ticketService.getById(req.auth.organizationId, req.params.id);

  sendSuccess(res, { data: { ticket } });
});

export const openEntry = catchAsync(async (req, res) => {
  const ticket = await ticketService.openEntry(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    auditContext(req),
  );

  sendSuccess(res, {
    statusCode: 201,
    message: 'Ingreso registrado',
    data: { ticket },
  });
});

export const getExitPreview = catchAsync(async (req, res) => {
  const preview = await ticketService.getExitPreview(req.auth.organizationId, req.params.id);

  sendSuccess(res, { data: { preview } });
});

export const collectAndClose = catchAsync(async (req, res) => {
  const result = await ticketService.collectAndClose(
    req.auth.organizationId,
    req.auth.userId,
    req.params.id,
    req.body,
    auditContext(req),
  );

  sendSuccess(res, {
    message: 'Cobro registrado y salida completada',
    data: result,
  });
});

export const cancelTicket = catchAsync(async (req, res) => {
  const ticket = await ticketService.cancelTicket(
    req.auth.organizationId,
    req.auth.userId,
    req.params.id,
    req.body.reason,
    auditContext(req),
  );

  sendSuccess(res, {
    message: 'Ticket cancelado',
    data: { ticket },
  });
});

export const getVehicleHistory = catchAsync(async (req, res) => {
  const history = await ticketService.getVehicleHistory(
    req.auth.organizationId,
    req.params.id,
    Number(req.query.limit) || 10,
  );

  sendSuccess(res, { data: { history } });
});
