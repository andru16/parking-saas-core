import env from '#config/env.js';

const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Orígenes permitidos en CORS.
 * En desarrollo acepta localhost/127.0.0.1 en cualquier puerto común del frontend.
 */
export const corsOptions = {
  origin(origin, callback) {
    // Peticiones sin Origin (Postman, health checks internos)
    if (!origin) {
      return callback(null, true);
    }

    if (origin === env.client.url) {
      return callback(null, true);
    }

    if (env.isDevelopment && LOCALHOST_ORIGIN_PATTERN.test(origin)) {
      return callback(null, true);
    }

    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
