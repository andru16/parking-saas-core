import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import { signupRateLimiter } from '#modules/auth/auth.rateLimit.js';
import { register } from './signup.controller.js';
import { signupValidation, signupMetadataValidation } from './signup.validator.js';

const router = Router();

router.post(
  '/register',
  signupRateLimiter,
  validate([...signupValidation, ...signupMetadataValidation]),
  register,
);

export default router;
