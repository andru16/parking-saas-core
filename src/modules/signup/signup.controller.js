import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { signupService } from './signup.service.js';

export const register = catchAsync(async (req, res) => {
  const { admin, organization, metadata } = req.body;

  const result = await signupService.register({
    admin,
    organization,
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
