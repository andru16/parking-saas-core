import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { printService } from '#services/printing/print.service.js';
import { printSettingsService } from '#services/printing/printSettings.service.js';

const getAuditContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const getConfig = catchAsync(async (req, res) => {
  const config = await printSettingsService.getConfig(req.auth.organizationId);
  sendSuccess(res, {
    data: {
      config,
      adapters: printService.listAdapters(),
    },
  });
});

export const listAdapters = catchAsync(async (req, res) => {
  sendSuccess(res, { data: { adapters: printService.listAdapters() } });
});

export const preview = catchAsync(async (req, res) => {
  const result = await printService.getPreview(req.auth.organizationId, {
    type: req.body.type ?? req.query.type ?? 'entry',
    draft: req.body.draft ?? req.body,
    format: req.body.format ?? req.query.format ?? 'html',
    adapter: req.body.adapter,
  });
  sendSuccess(res, { data: result });
});

export const getTicketDocument = catchAsync(async (req, res) => {
  const result = await printService.getTicketDocument(
    req.auth.organizationId,
    req.params.ticketId,
    {
      type: req.query.type ?? 'auto',
      format: req.query.format ?? 'html',
      adapter: req.query.adapter,
      userId: req.auth.userId,
    },
  );
  sendSuccess(res, { data: result });
});

export const reprintTicket = catchAsync(async (req, res) => {
  const result = await printService.reprintTicket(
    req.auth.organizationId,
    req.auth.userId,
    req.params.ticketId,
    req.body,
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: 'Ticket marcado para reimpresión',
    data: result,
  });
});

export const getCashDocument = catchAsync(async (req, res) => {
  const result = await printService.getCashDocument(
    req.auth.organizationId,
    req.params.cashRegisterId,
    {
      type: req.query.type ?? 'cash_close',
      format: req.query.format ?? 'html',
      adapter: req.query.adapter,
      userId: req.auth.userId,
    },
  );
  sendSuccess(res, { data: result });
});

export const getMembershipDocument = catchAsync(async (req, res) => {
  const result = await printService.getMembershipDocument(
    req.auth.organizationId,
    req.params.membershipId,
    {
      type: req.query.type ?? 'membership_payment',
      format: req.query.format ?? 'html',
      adapter: req.query.adapter,
      userId: req.auth.userId,
      operator: {
        firstName: req.auth.firstName,
        lastName: req.auth.lastName,
      },
    },
  );
  sendSuccess(res, { data: result });
});

export const getPaymentDocument = catchAsync(async (req, res) => {
  const result = await printService.getPaymentDocument(
    req.auth.organizationId,
    req.params.paymentId,
    {
      format: req.query.format ?? 'html',
      adapter: req.query.adapter,
      userId: req.auth.userId,
    },
  );
  sendSuccess(res, { data: result });
});

export const reprint = catchAsync(async (req, res) => {
  const result = await printService.reprint(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: 'Documento marcado para reimpresión',
    data: result,
  });
});

export const listJobs = catchAsync(async (req, res) => {
  const result = await printService.listJobs(req.auth.organizationId, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 30,
    resourceType: req.query.resourceType,
    resourceId: req.query.resourceId,
  });
  sendSuccess(res, { data: result });
});
