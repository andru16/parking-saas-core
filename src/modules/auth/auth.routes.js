import { Router } from 'express';
import { validate } from '#middlewares/validate.js';
import { loginValidation } from './auth.validation.js';
import { loginRateLimiter, refreshRateLimiter } from './auth.rateLimit.js';
import { authenticate, optionalAuthenticate, requireRequestMetadata } from './auth.middleware.js';
import * as authController from './auth.controller.js';
import { AUTH_ROUTES } from './constants.js';

const router = Router();

router.post(
  AUTH_ROUTES.LOGIN,
  loginRateLimiter,
  requireRequestMetadata,
  validate(loginValidation),
  authController.login,
);

router.post(
  AUTH_ROUTES.LOGOUT,
  optionalAuthenticate,
  requireRequestMetadata,
  authController.logout,
);

router.post(
  AUTH_ROUTES.REFRESH,
  refreshRateLimiter,
  requireRequestMetadata,
  authController.refresh,
);

router.get(AUTH_ROUTES.ME, authenticate, authController.me);

export default router;
