import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { supportService } from './support.service.js';

const auditContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const getMeta = catchAsync(async (_req, res) => {
  sendSuccess(res, { data: { meta: supportService.getMeta() } });
});

export const list = catchAsync(async (req, res) => {
  const result = await supportService.listOrgTickets(req.auth.organizationId, {
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    priority: req.query.priority,
    category: req.query.category,
    search: req.query.search,
  });
  sendSuccess(res, { data: result });
});

export const create = catchAsync(async (req, res) => {
  const ticket = await supportService.createTicket({
    organizationId: req.auth.organizationId,
    userId: req.auth.userId,
    subject: req.body.subject,
    description: req.body.description,
    category: req.body.category,
    priority: req.body.priority,
    auditContext: auditContext(req),
  });
  sendSuccess(res, { data: { ticket }, message: 'Ticket creado', statusCode: 201 });
});

export const getOne = catchAsync(async (req, res) => {
  const result = await supportService.getOrgTicketDetail(
    req.auth.organizationId,
    req.params.id,
  );
  sendSuccess(res, { data: result });
});

export const reply = catchAsync(async (req, res) => {
  const result = await supportService.replyAsOrg({
    ticketId: req.params.id,
    organizationId: req.auth.organizationId,
    userId: req.auth.userId,
    body: req.body.body,
    auditContext: auditContext(req),
  });
  sendSuccess(res, { data: result, message: 'Respuesta enviada' });
});

export const close = catchAsync(async (req, res) => {
  const ticket = await supportService.closeAsOrg({
    ticketId: req.params.id,
    organizationId: req.auth.organizationId,
    userId: req.auth.userId,
    status: req.body.status || 'closed',
    auditContext: auditContext(req),
  });
  sendSuccess(res, { data: { ticket }, message: 'Ticket actualizado' });
});

/** Plataforma */
export const platformList = catchAsync(async (req, res) => {
  const result = await supportService.listAllTickets({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    priority: req.query.priority,
    category: req.query.category,
    organizationId: req.query.organizationId,
    search: req.query.search,
  });
  sendSuccess(res, { data: result });
});

export const platformGetOne = catchAsync(async (req, res) => {
  const result = await supportService.getPlatformTicketDetail(req.params.id);
  sendSuccess(res, { data: result });
});

export const platformReply = catchAsync(async (req, res) => {
  const result = await supportService.replyAsPlatform({
    ticketId: req.params.id,
    userId: req.auth.userId,
    body: req.body.body,
    isInternal: Boolean(req.body.isInternal),
    auditContext: auditContext(req),
  });
  sendSuccess(res, { data: result, message: 'Respuesta enviada' });
});

export const platformChangeStatus = catchAsync(async (req, res) => {
  const ticket = await supportService.changeStatusAsPlatform({
    ticketId: req.params.id,
    userId: req.auth.userId,
    status: req.body.status,
    auditContext: auditContext(req),
  });
  sendSuccess(res, { data: { ticket }, message: 'Estado actualizado' });
});

export const platformAssign = catchAsync(async (req, res) => {
  const ticket = await supportService.assignTicket({
    ticketId: req.params.id,
    assignedToUserId: req.body.assignedToUserId ?? null,
    userId: req.auth.userId,
    auditContext: auditContext(req),
  });
  sendSuccess(res, { data: { ticket }, message: 'Asignación actualizada' });
});

export const platformMetrics = catchAsync(async (_req, res) => {
  const metrics = await supportService.getMetrics();
  sendSuccess(res, { data: { metrics } });
});

export const SupportController = {
  getMeta,
  list,
  create,
  getOne,
  reply,
  close,
  platformList,
  platformGetOne,
  platformReply,
  platformChangeStatus,
  platformAssign,
  platformMetrics,
};
