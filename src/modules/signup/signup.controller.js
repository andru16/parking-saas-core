import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { signupService } from './signup.service.js';
import { verificationTokenService } from '#services/verification/verificationToken.service.js';

export const register = catchAsync(async (req, res) => {
  const { admin, organization, consents, metadata } = req.body;

  const result = await signupService.register({
    admin,
    organization,
    consents,
    planCode: req.body.planCode,
    planId: req.body.planId,
    metadata,
    auditContext: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  sendSuccess(res, {
    statusCode: 201,
    message: result.message,
    data: result,
  });
});

export const verifyEmail = catchAsync(async (req, res) => {
  const result = await verificationTokenService.verifyEmailToken(req.body.token);
  sendSuccess(res, {
    message: result.message,
    data: {
      email: result.email,
      alreadyVerified: result.alreadyVerified,
    },
  });
});

export const resendVerification = catchAsync(async (req, res) => {
  const result = await verificationTokenService.resendVerificationEmail(req.body.email);
  sendSuccess(res, {
    message: result.message,
    data: null,
  });
});
