import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { paymentService } from './payment.service.js';
import { paymentMethodConfigService } from '#services/payment/paymentMethodConfig.service.js';

const auditContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const listPaymentMethods = catchAsync(async (req, res) => {
  const methods = await paymentMethodConfigService.getConfiguredMethods(req.auth.organizationId);
  sendSuccess(res, { data: { methods } });
});

export const listByTicket = catchAsync(async (req, res) => {
  const payments = await paymentService.listByTicket(req.auth.organizationId, req.params.ticketId);
  sendSuccess(res, { data: { payments } });
});

export const listHistory = catchAsync(async (req, res) => {
  const result = await paymentService.listHistory(req.auth.organizationId, req.query);
  sendSuccess(res, { data: result });
});

export const reverse = catchAsync(async (req, res) => {
  const result = await paymentService.reversePayment(
    req.auth.organizationId,
    req.auth.userId,
    req.params.id,
    req.body.reason,
    auditContext(req),
  );

  sendSuccess(res, {
    message: 'Reverso registrado',
    data: result,
  });
});
