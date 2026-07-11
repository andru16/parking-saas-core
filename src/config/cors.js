import env from '#config/env.js';

const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const allowedOrigins = () => {
  const set = new Set([env.client.url].filter(Boolean));
  for (const origin of env.cors.extraOrigins) {
    set.add(origin);
  }
  return set;
};

/**
 * Orígenes permitidos en CORS.
 * En desarrollo acepta localhost/127.0.0.1 en cualquier puerto.
 * En producción: CLIENT_URL + CORS_ORIGINS (coma-separados, p. ej. previews).
 */
export const corsOptions = {
  origin(origin, callback) {
    // Peticiones sin Origin (Postman, health checks internos, Vercel Cron)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins().has(origin)) {
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
