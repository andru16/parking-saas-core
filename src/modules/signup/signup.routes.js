import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import { signupRateLimiter } from '#modules/auth/auth.rateLimit.js';
import { register, verifyEmail, resendVerification } from './signup.controller.js';
import {
  signupValidation,
  signupMetadataValidation,
  verifyEmailValidation,
  resendVerificationValidation,
} from './signup.validator.js';

const router = Router();

router.post(
  '/register',
  signupRateLimiter,
  validate([...signupValidation, ...signupMetadataValidation]),
  register,
);

router.post('/verify-email', signupRateLimiter, validate(verifyEmailValidation), verifyEmail);

router.post(
  '/resend-verification',
  signupRateLimiter,
  validate(resendVerificationValidation),
  resendVerification,
);

export default router;
