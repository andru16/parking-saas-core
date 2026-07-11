import rateLimit from 'express-rate-limit';
import env from '#config/env.js';
import { buildResponse } from '#utils/apiResponse.js';
import { settingsService } from '#modules/systemSettings/settings.service.js';

function jsonHandler(message) {
  return (_req, res) => {
    res.status(429).json(
      buildResponse({
        success: false,
        message,
        errors: null,
      }),
    );
  };
}

const skipInTest = () => process.env.NODE_ENV === 'test';

/** Login tenant / Super Admin — anti fuerza bruta (máx. desde System Settings). */
export const loginRateLimiter = rateLimit({
  windowMs: env.rateLimit.login.windowMs,
  max: async () => {
    try {
      const security = await settingsService.getSecurityPolicy();
      return security.maxLoginAttempts;
    } catch {
      return env.rateLimit.login.max;
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: jsonHandler('Demasiados intentos de inicio de sesión. Intenta más tarde.'),
});

/** Refresh de sesión — evita abuso de rotación de tokens. */
export const refreshRateLimiter = rateLimit({
  windowMs: env.rateLimit.refresh.windowMs,
  max: env.rateLimit.refresh.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: jsonHandler('Demasiadas renovaciones de sesión. Intenta más tarde.'),
});

/** Signup / registro público. */
export const signupRateLimiter = rateLimit({
  windowMs: env.rateLimit.signup.windowMs,
  max: env.rateLimit.signup.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: jsonHandler('Demasiados registros desde esta IP. Intenta más tarde.'),
});

/**
 * Techo global de API (estructura lista para producción).
 * Aplicar en `app.use('/api', apiRateLimiter)` cuando se active en env.
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimit.api.windowMs,
  max: env.rateLimit.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !env.rateLimit.api.enabled,
  handler: jsonHandler('Demasiadas solicitudes. Intenta más tarde.'),
});
